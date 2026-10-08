'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Cpu,
  Activity,
  Thermometer,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  ShieldCheck,
  Usb,
  Radio,
  Play,
  Square,
  Clock,
  Send,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Database,
} from 'lucide-react';
import { auth, db } from '../../../lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, updateDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { useTelehealth } from '../../../context/TelehealthContext';

interface SyncHistoryItem {
  id: string;
  temperature: number;
  timestamp: string;
  status: 'normal' | 'elevated' | 'critical';
  source: string;
}

export default function ConnectedDevicesPage() {
  const router = useRouter();
  const { currentUser, setAuthenticatedProfile } = useTelehealth();

  // Auth
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  // Serial & Sensor State
  const [isSerialSupported, setIsSerialSupported] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [port, setPort] = useState<any>(null);
  const [reader, setReader] = useState<any>(null);
  const [baudRate, setBaudRate] = useState<number>(115200);
  const [currentTemperature, setCurrentTemperature] = useState<number>(36.8);
  const [rawLogs, setRawLogs] = useState<string[]>([]);
  const [autoSync, setAutoSync] = useState<boolean>(false);

  // Firestore Sync State
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncedTemp, setLastSyncedTemp] = useState<number | null>(null);
  const [lastSyncedTime, setLastSyncedTime] = useState<string | null>(null);
  const [syncHistory, setSyncHistory] = useState<SyncHistoryItem[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const logsEndRef = useRef<HTMLDivElement | null>(null);

  // Check Web Serial support
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serial' in navigator) {
      setIsSerialSupported(true);
    }
  }, []);

  // Listen to Auth & Firestore User doc in real-time
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthLoading(false);

      if (user) {
        // Listen to live synced temperature from Firestore user doc
        const userDocRef = doc(db, 'users', user.uid);
        const unsubDoc = onSnapshot(userDocRef, (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            if (data.lastSyncedTemperature !== undefined) {
              setLastSyncedTemp(data.lastSyncedTemperature);
            }
            if (data.lastSyncedAt) {
              setLastSyncedTime(data.lastSyncedAt);
            }
          }
        });

        return () => unsubDoc();
      }
    });

    return () => unsubAuth();
  }, []);

  // Auto-scroll serial logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [rawLogs]);

  // Connect to Web Serial USB Device
  const handleConnectUSB = async () => {
    if (!('serial' in navigator)) {
      alert('Web Serial API is not supported by your browser. Please use Chrome, Edge, or Opera on Desktop.');
      return;
    }

    try {
      addLog('Requesting USB Serial device authorization from browser...');
      const selectedPort = await (navigator as any).serial.requestPort();
      await selectedPort.open({ baudRate });
      setPort(selectedPort);
      setIsConnected(true);
      addLog(`USB Serial connection established at ${baudRate} baud. Reading sensor stream...`);

      readSerialStream(selectedPort);
    } catch (err: any) {
      console.error('Serial connection error:', err);
      addLog(`Connection failed or cancelled: ${err.message}`);
    }
  };

  // Disconnect
  const handleDisconnectUSB = async () => {
    try {
      if (reader) {
        await reader.cancel();
      }
      if (port) {
        await port.close();
      }
      setIsConnected(false);
      setPort(null);
      setReader(null);
      addLog('USB Serial device disconnected.');
    } catch (err: any) {
      console.error('Disconnect error:', err);
      setIsConnected(false);
    }
  };

  // Stream reader
  const readSerialStream = async (activePort: any) => {
    const textDecoder = new TextDecoderStream();
    const readableStreamClosed = activePort.readable.pipeTo(textDecoder.writable);
    const streamReader = textDecoder.readable.getReader();
    setReader(streamReader);

    let buffer = '';

    try {
      while (true) {
        const { value, done } = await streamReader.read();
        if (done) {
          break;
        }
        if (value) {
          buffer += value;
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const cleanLine = line.trim();
            if (cleanLine) {
              addLog(`[RX]: ${cleanLine}`);
              // Parse temperature patterns like: "TEMP: 36.8" or "36.8 C" or JSON
              const match = cleanLine.match(/(\d{2}\.?\d{0,2})/);
              if (match) {
                const parsedTemp = parseFloat(match[1]);
                if (parsedTemp >= 30 && parsedTemp <= 45) {
                  setCurrentTemperature(parsedTemp);
                  if (autoSync) {
                    syncTemperatureToFirestore(parsedTemp);
                  }
                }
              }
            }
          }
        }
      }
    } catch (err: any) {
      addLog(`Stream error: ${err.message}`);
    } finally {
      streamReader.releaseLock();
    }
  };

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setRawLogs((prev) => [...prev.slice(-40), `[${time}] ${msg}`]);
  };

  // Helper to determine status
  const getTempStatus = (t: number): 'normal' | 'elevated' | 'critical' => {
    if (t >= 38.3) return 'critical';
    if (t >= 37.4) return 'elevated';
    return 'normal';
  };

  // Save & Sync Temperature to Firestore
  const syncTemperatureToFirestore = async (tempToSync = currentTemperature) => {
    const user = firebaseUser || auth.currentUser;
    if (!user) {
      alert('Please sign in to sync your vitals.');
      return;
    }

    setIsSyncing(true);
    const nowIso = new Date().toISOString();
    const status = getTempStatus(tempToSync);

    try {
      const userRef = doc(db, 'users', user.uid);
      const updateData = {
        lastSyncedTemperature: tempToSync,
        lastSyncedAt: nowIso,
        temperatureStatus: status,
        temperatureUnit: '°C',
        deviceModel: isConnected ? 'USB Sensor (Serial Stream)' : 'Biomedical Telemetry Probe',
      };

      await setDoc(userRef, updateData, { merge: true });

      // Also record history item in local list
      const newItem: SyncHistoryItem = {
        id: `sync_${Date.now()}`,
        temperature: tempToSync,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        status,
        source: isConnected ? 'USB Hardware (Live)' : 'Hardware Telemetry Sync',
      };
      setSyncHistory((prev) => [newItem, ...prev.slice(0, 9)]);

      setLastSyncedTemp(tempToSync);
      setLastSyncedTime(nowIso);
      setToastMessage(`Synced ${tempToSync.toFixed(1)}°C to your EHR chart in real-time.`);
      setTimeout(() => setToastMessage(null), 4000);
      addLog(`[FIRESTORE SYNC]: Uploaded ${tempToSync.toFixed(1)}°C to patient record.`);
    } catch (err: any) {
      console.error('Firestore sync error:', err);
      alert(`Sync failed: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Simulate hardware sensor reading
  const handleSimulateReading = (temp: number) => {
    setCurrentTemperature(temp);
    addLog(`Simulated hardware sensor read event: ${temp.toFixed(1)}°C`);
    syncTemperatureToFirestore(temp);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 space-y-3">
        <RefreshCw className="w-8 h-8 text-teal-400 animate-spin" />
        <p className="text-xs text-slate-400 font-mono">Initializing Hardware Telemetry Bridge...</p>
      </div>
    );
  }

  const currentStatus = getTempStatus(currentTemperature);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 text-white p-6 sm:p-8 rounded-3xl shadow-xl border border-slate-700/60 relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-400/30">
                Hardware Device Hub
              </span>
              <span className="text-xs text-slate-300 flex items-center gap-1 font-mono">
                <Usb className="w-3.5 h-3.5 text-teal-400" />
                Web Serial & USB Telemetry
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Connected Biomedical Devices
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
              Connect your USB clinical thermometer or physiological sensor probe via serial communication to stream live vitals directly into your secure EHR chart.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/patient/dashboard')}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/20 transition-all flex items-center gap-2 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Dashboard</span>
            </button>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="font-semibold">{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-emerald-400 hover:text-white font-bold text-xs px-2 cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Grid: Live Gauge & Connection Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Live Reading & Metric Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-6 text-center">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Live Sensor Telemetry
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  isConnected
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 animate-pulse'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {isConnected ? 'USB Active' : 'Standby'}
              </span>
            </div>

            {/* Big Temperature Gauge Display */}
            <div className="relative py-4 flex flex-col items-center justify-center">
              <div
                className={`w-40 h-40 rounded-full flex flex-col items-center justify-center border-4 shadow-inner transition-colors ${
                  currentStatus === 'critical'
                    ? 'bg-rose-50 border-rose-400 text-rose-700'
                    : currentStatus === 'elevated'
                    ? 'bg-amber-50 border-amber-400 text-amber-700'
                    : 'bg-teal-50 border-teal-400 text-teal-700'
                }`}
              >
                <Thermometer className="w-8 h-8 mb-1 animate-pulse" />
                <span className="text-4xl font-black tracking-tight font-mono">
                  {currentTemperature.toFixed(1)}°
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mt-1">Celsius</span>
              </div>

              {/* Status Badge */}
              <div className="mt-4">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                    currentStatus === 'critical'
                      ? 'bg-rose-100 text-rose-800 border border-rose-300'
                      : currentStatus === 'elevated'
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      currentStatus === 'critical'
                        ? 'bg-rose-500'
                        : currentStatus === 'elevated'
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                  />
                  {currentStatus === 'critical'
                    ? 'High Fever Alert'
                    : currentStatus === 'elevated'
                    ? 'Mild Elevation'
                    : 'Normal Physiological Range'}
                </span>
              </div>
            </div>

            {/* Sync Action Button */}
            <div className="pt-2 space-y-3">
              <button
                onClick={() => syncTemperatureToFirestore(currentTemperature)}
                disabled={isSyncing}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold text-xs shadow-lg shadow-teal-900/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Syncing to EHR...</span>
                  </>
                ) : (
                  <>
                    <Database className="w-4 h-4" />
                    <span>Sync Reading to Doctor ({currentTemperature.toFixed(1)}°C)</span>
                  </>
                )}
              </button>

              {/* Auto Sync Toggle */}
              <label className="flex items-center justify-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoSync}
                  onChange={(e) => setAutoSync(e.target.checked)}
                  className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
                <span>Auto-sync when sensor reading updates</span>
              </label>
            </div>
          </div>

          {/* Quick Simulation / Test Readouts */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-slate-700 font-bold text-xs">
              <Sparkles className="w-4 h-4 text-teal-600" />
              <span>Simulate / Calibration Presets</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Test real-time doctor synchronization without physical USB hardware:
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleSimulateReading(36.8)}
                className="py-2 px-1 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 text-[11px] font-bold border border-teal-200 transition-colors cursor-pointer"
              >
                36.8°C (Normal)
              </button>
              <button
                onClick={() => handleSimulateReading(37.6)}
                className="py-2 px-1 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-[11px] font-bold border border-amber-200 transition-colors cursor-pointer"
              >
                37.6°C (Mild)
              </button>
              <button
                onClick={() => handleSimulateReading(38.8)}
                className="py-2 px-1 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 text-[11px] font-bold border border-rose-200 transition-colors cursor-pointer"
              >
                38.8°C (Fever)
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: USB Connection & Serial Log Interface */}
        <div className="lg:col-span-2 space-y-6">
          {/* USB Device Control Box */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">USB Serial Interface</h3>
                <p className="text-xs text-slate-500">Connect to Arduino, ESP32, or DS18B20 USB probe</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">Baud:</span>
                <select
                  value={baudRate}
                  onChange={(e) => setBaudRate(Number(e.target.value))}
                  disabled={isConnected}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-mono font-bold text-slate-700"
                >
                  <option value={9600}>9600</option>
                  <option value={115200}>115200</option>
                </select>
              </div>
            </div>

            {/* Connection Actions */}
            <div className="flex flex-wrap items-center gap-3">
              {!isConnected ? (
                <button
                  onClick={handleConnectUSB}
                  className="py-3 px-5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-2 shadow-md transition-all cursor-pointer"
                >
                  <Usb className="w-4 h-4 text-teal-400" />
                  <span>Connect USB Sensor</span>
                </button>
              ) : (
                <button
                  onClick={handleDisconnectUSB}
                  className="py-3 px-5 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Square className="w-4 h-4" />
                  <span>Disconnect USB Device</span>
                </button>
              )}

              <div className="text-[11px] text-slate-500 flex items-center gap-1.5 ml-auto">
                <ShieldCheck className="w-4 h-4 text-teal-600" />
                <span>Encrypted Telehealth Channel</span>
              </div>
            </div>

            {/* Live Terminal / Serial Monitor */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                <span>Serial Stream Monitor</span>
                <span>{rawLogs.length} events</span>
              </div>
              <div className="bg-slate-950 text-emerald-400 rounded-2xl p-4 font-mono text-xs h-56 overflow-y-auto border border-slate-800 space-y-1 shadow-inner">
                {rawLogs.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-600 text-center">
                    <Radio className="w-6 h-6 mb-2 stroke-1" />
                    <p>Sensor stream on standby.</p>
                    <p className="text-[10px]">Click &quot;Connect USB Sensor&quot; or select a calibration preset.</p>
                  </div>
                ) : (
                  rawLogs.map((log, i) => (
                    <div key={i} className="leading-relaxed">
                      {log}
                    </div>
                  ))
                )}
                <div ref={logsEndRef} />
              </div>
            </div>
          </div>

          {/* Sync History & Doctor Visibility Confirmation */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-teal-600" />
                <h4 className="text-sm font-bold text-slate-900">Synchronized Clinical Vitals Log</h4>
              </div>
              {lastSyncedTemp !== null && (
                <span className="text-xs font-mono font-bold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
                  Latest: {lastSyncedTemp.toFixed(1)}°C
                </span>
              )}
            </div>

            <p className="text-xs text-slate-500">
              Readings synced below are broadcast instantly via Firestore WebSocket listeners directly to your attending clinician&apos;s EHR workspace.
            </p>

            {syncHistory.length === 0 ? (
              <div className="p-6 text-center rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-xs text-slate-400">
                <Clock className="w-6 h-6 mx-auto mb-1 text-slate-300" />
                No readings recorded in this session yet. Sync a temperature reading above.
              </div>
            ) : (
              <div className="space-y-2">
                {syncHistory.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <Thermometer className="w-4 h-4 text-teal-600" />
                      <span className="font-bold text-slate-900 font-mono text-sm">
                        {item.temperature.toFixed(1)}°C
                      </span>
                      <span className="text-[11px] text-slate-500">via {item.source}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.status === 'critical'
                            ? 'bg-rose-100 text-rose-800'
                            : item.status === 'elevated'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {item.status.toUpperCase()}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">{item.timestamp}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
