'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { Serial } from '@awesome-cordova-plugins/serial';
import { db } from '../../lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  YAxis,
  XAxis,
  ReferenceLine,
} from 'recharts';
import {
  Usb,
  Activity,
  Heart,
  Radio,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  PowerOff,
  RefreshCw,
  Zap,
} from 'lucide-react';

export interface PatientHealthDeviceConnectorProps {
  appointmentId: string;
  isPatient?: boolean;
  className?: string;
}

export interface ParsedECGPayload {
  ecg: number;
  bpm: number;
  leadsOff: boolean;
}

interface ECGChartPoint {
  index: number;
  ecg: number;
  bpm: number;
  leadsOff: boolean;
}

const MAX_CHART_POINTS = 120; // ~2.4 seconds of history at 50Hz for smooth scrolling

export function PatientHealthDeviceConnector({
  appointmentId,
  isPatient = true,
  className = '',
}: PatientHealthDeviceConnectorProps) {
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<
    'disconnected' | 'connecting' | 'connected' | 'error'
  >('disconnected');
  const [platformType, setPlatformType] = useState<'web' | 'android' | null>(null);
  const [latestVitals, setLatestVitals] = useState<ParsedECGPayload | null>(null);
  const [ecgHistory, setEcgHistory] = useState<ECGChartPoint[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastPushedAt, setLastPushedAt] = useState<Date | null>(null);
  const [pushCount, setPushCount] = useState<number>(0);

  // References for active ports, readers, and subscriptions
  const webPortRef = useRef<any>(null);
  const webReaderRef = useRef<any>(null);
  const isReadingRef = useRef<boolean>(false);
  const serialSubscriptionRef = useRef<any>(null);

  // High-frequency 50Hz ECG buffer & indexing
  const latestParsedRef = useRef<ParsedECGPayload | null>(null);
  const ecgBufferRef = useRef<ECGChartPoint[]>([]);
  const sampleIndexRef = useRef<number>(0);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  /**
   * Process high-frequency incoming sample (50Hz / every 20ms)
   * Local UI graph buffer updates instantly
   */
  const handleIncomingSample = (ecg: number, bpm: number, leadsOff: boolean) => {
    const payload: ParsedECGPayload = { ecg, bpm, leadsOff };
    latestParsedRef.current = payload;
    sampleIndexRef.current += 1;

    // Push into sliding window for live scrolling waveform
    ecgBufferRef.current.push({
      index: sampleIndexRef.current,
      ecg: leadsOff ? 512 : ecg, // Show baseline if leads are detached
      bpm,
      leadsOff,
    });

    if (ecgBufferRef.current.length > MAX_CHART_POINTS) {
      ecgBufferRef.current.shift();
    }
  };

  /**
   * Smooth 60fps render loop syncing 50Hz serial stream with monitor refresh
   */
  useEffect(() => {
    if (connectionStatus !== 'connected') return;

    let animId: number;
    const renderFrame = () => {
      if (ecgBufferRef.current.length > 0) {
        setEcgHistory([...ecgBufferRef.current]);
        if (latestParsedRef.current) {
          setLatestVitals(latestParsedRef.current);
        }
      }
      animId = requestAnimationFrame(renderFrame);
    };

    animId = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(animId);
  }, [connectionStatus]);

  /**
   * Helper to parse serial buffer chunks into {"ecg": 512, "bpm": 75, "leadsOff": false}
   */
  const parseBuffer = (rawBuffer: string): string => {
    const segments = rawBuffer.split(/[\r\n]+/);
    const incompleteRemainder = segments.pop() || '';

    for (const segment of segments) {
      const line = segment.trim();
      if (!line) continue;

      // 1. Direct JSON parse attempt
      try {
        const parsed = JSON.parse(line);
        if (
          parsed &&
          (typeof parsed.ecg !== 'undefined' || typeof parsed.bpm !== 'undefined')
        ) {
          const ecg = typeof parsed.ecg === 'number' ? parsed.ecg : 512;
          const bpm = typeof parsed.bpm === 'number' ? parsed.bpm : 75;
          const leadsOff = Boolean(parsed.leadsOff);

          if (!isNaN(ecg) && !isNaN(bpm)) {
            handleIncomingSample(ecg, bpm, leadsOff);
            continue;
          }
        }
      } catch {
        // Not a single valid JSON line, proceed to regex pattern match
      }

      // 2. Embedded JSON pattern extraction: {"ecg": 512, "bpm": 75, "leadsOff": false}
      const match = line.match(
        /\{[^{}]*"ecg"\s*:\s*([0-9.]+)[^{}]*"bpm"\s*:\s*([0-9.]+)[^{}]*"leadsOff"\s*:\s*(true|false)[^{}]*\}/i
      );

      if (match) {
        const ecg = parseFloat(match[1]);
        const bpm = parseFloat(match[2]);
        const leadsOff = match[3].toLowerCase() === 'true';

        if (!isNaN(ecg) && !isNaN(bpm)) {
          handleIncomingSample(ecg, bpm, leadsOff);
        }
      }
    }

    return incompleteRemainder;
  };

  /**
   * Continuous stream reader for Web Serial API
   */
  const readWebSerialLoop = async (port: any) => {
    try {
      const reader = port.readable.getReader();
      webReaderRef.current = reader;
      const decoder = new TextDecoder();
      let streamBuffer = '';

      while (isReadingRef.current) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          streamBuffer += decoder.decode(value, { stream: true });
          streamBuffer = parseBuffer(streamBuffer);
        }
      }
    } catch (err: any) {
      if (isReadingRef.current) {
        console.error('Web Serial read error:', err);
        setErrorMessage(err?.message || 'USB ECG stream read interrupted.');
        setConnectionStatus('error');
      }
    } finally {
      if (webReaderRef.current) {
        try {
          webReaderRef.current.releaseLock();
        } catch {}
        webReaderRef.current = null;
      }
    }
  };

  /**
   * Connect to Hardware:
   * 1. Arduino streams at 115200 baud
   * - If !Capacitor.isNativePlatform(): Web Serial API (navigator.serial.requestPort()) @ 115200 baud
   * - If Capacitor.isNativePlatform(): Cordova Serial plugin with USB OTG permissions @ 115200 baud
   */
  const connectHardware = async () => {
    setErrorMessage(null);
    setConnectionStatus('connecting');

    // Reset buffer
    ecgBufferRef.current = [];
    sampleIndexRef.current = 0;

    try {
      const isNative = Capacitor.isNativePlatform();

      if (!isNative) {
        // --- Web Serial API (Desktop / Browser) ---
        if (typeof navigator === 'undefined' || !('serial' in navigator)) {
          throw new Error(
            'Web Serial API is not supported in this browser. Please use Chrome, Edge, or Opera with USB OTG/Serial enabled.'
          );
        }

        setPlatformType('web');
        // Prompt user to pick USB Arduino AD8232 device
        const port = await (navigator as any).serial.requestPort();
        // 1. Updated baudRate: 115200
        await port.open({ baudRate: 115200 });

        webPortRef.current = port;
        isReadingRef.current = true;
        setConnectionStatus('connected');

        // Start background reading stream
        readWebSerialLoop(port);
      } else {
        // --- Cordova Serial Plugin (Capacitor Native Android) ---
        setPlatformType('android');

        // 1. Request USB OTG permissions
        await new Promise<void>((resolve, reject) => {
          if (typeof (window as any).serial?.requestPermission === 'function') {
            (window as any).serial.requestPermission(
              () => resolve(),
              (err: any) =>
                reject(new Error(typeof err === 'string' ? err : 'USB OTG permission denied by user.'))
            );
          } else if (Serial && typeof Serial.requestPermission === 'function') {
            Serial.requestPermission()
              .then(() => resolve())
              .catch((err: any) =>
                reject(new Error(typeof err === 'string' ? err : 'USB OTG permission denied.'))
              );
          } else {
            reject(
              new Error('Cordova Serial plugin is not installed or available on this mobile platform.')
            );
          }
        });

        // 2. Open connection at 115200 baud
        await new Promise<void>((resolve, reject) => {
          const serialOpts = {
            baudRate: 115200, // 1. Updated baudRate: 115200
            dataBits: 8,
            stopBits: 1,
            parity: 0,
            dtr: true,
            rts: true,
            sleepOnPause: false,
          };

          if (typeof (window as any).serial?.open === 'function') {
            (window as any).serial.open(
              serialOpts,
              () => resolve(),
              (err: any) =>
                reject(
                  new Error(
                    typeof err === 'string' ? err : 'Failed to open serial port at 115200 baud.'
                  )
                )
            );
          } else if (Serial && typeof Serial.open === 'function') {
            Serial.open(serialOpts as any)
              .then(() => resolve())
              .catch((err: any) =>
                reject(
                  new Error(
                    typeof err === 'string' ? err : 'Failed to open serial port at 115200 baud.'
                  )
                )
              );
          } else {
            reject(new Error('Serial open method is not available.'));
          }
        });

        isReadingRef.current = true;
        setConnectionStatus('connected');

        // 3. Register read callback to stream incoming data
        let androidSerialBuffer = '';
        const onDataReceived = (data: any) => {
          let text = '';
          if (typeof data === 'string') {
            text = data;
          } else if (data instanceof ArrayBuffer) {
            text = new TextDecoder('utf-8').decode(new Uint8Array(data));
          } else if (data?.buffer instanceof ArrayBuffer) {
            text = new TextDecoder('utf-8').decode(new Uint8Array(data.buffer));
          } else if (Array.isArray(data)) {
            text = new TextDecoder('utf-8').decode(new Uint8Array(data));
          }

          if (text) {
            androidSerialBuffer += text;
            androidSerialBuffer = parseBuffer(androidSerialBuffer);
          }
        };

        if (typeof (window as any).serial?.registerReadCallback === 'function') {
          (window as any).serial.registerReadCallback(
            (data: any) => onDataReceived(data),
            (err: any) => console.error('Serial registerReadCallback error:', err)
          );
        } else if (Serial && typeof Serial.registerReadCallback === 'function') {
          const sub = Serial.registerReadCallback().subscribe(
            (data: any) => onDataReceived(data),
            (err: any) => console.error('Serial registerReadCallback observable error:', err)
          );
          serialSubscriptionRef.current = sub;
        }
      }
    } catch (err: any) {
      console.error('connectHardware failed:', err);
      setConnectionStatus('error');
      setErrorMessage(err?.message || 'Could not connect to AD8232 ECG sensor.');
      isReadingRef.current = false;
    }
  };

  /**
   * Disconnect hardware and cleanup ports
   */
  const disconnectHardware = async () => {
    isReadingRef.current = false;

    // Web Serial cleanup
    if (webReaderRef.current) {
      try {
        await webReaderRef.current.cancel();
        webReaderRef.current.releaseLock();
      } catch {}
      webReaderRef.current = null;
    }
    if (webPortRef.current) {
      try {
        await webPortRef.current.close();
      } catch {}
      webPortRef.current = null;
    }

    // Cordova Serial cleanup
    if (serialSubscriptionRef.current) {
      try {
        serialSubscriptionRef.current.unsubscribe();
      } catch {}
      serialSubscriptionRef.current = null;
    }
    if (typeof (window as any).serial?.close === 'function') {
      (window as any).serial.close(
        () => {},
        () => {}
      );
    } else if (Serial && typeof Serial.close === 'function') {
      Serial.close().catch(() => {});
    }

    setConnectionStatus('disconnected');
    latestParsedRef.current = null;
    setLatestVitals(null);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnectHardware();
    };
  }, []);

  /**
   * 4. CRITICAL DATABASE FIX:
   * Do NOT write raw ECG to Firestore every 20ms!
   * The local UI graph updates instantly above via handleIncomingSample and requestAnimationFrame,
   * but we ONLY write the bpm and leadsOff status to Firestore once every 2 seconds.
   */
  useEffect(() => {
    if (connectionStatus !== 'connected' || !appointmentId) {
      return;
    }

    const intervalId = setInterval(async () => {
      const current = latestParsedRef.current;
      if (!current) return;

      try {
        // Only write bpm, leadsOff, and serverTimestamp once every 2 seconds
        await setDoc(
          doc(db, 'appointments', appointmentId, 'telemetry', 'live'),
          {
            bpm: current.bpm,
            leadsOff: current.leadsOff,
            timestamp: serverTimestamp(),
          },
          { merge: true }
        );

        setLastPushedAt(new Date());
        setPushCount((prev) => prev + 1);
      } catch (err) {
        console.error('Error pushing ECG bpm/leads telemetry to Firestore:', err);
      }
    }, 2000);

    return () => clearInterval(intervalId);
  }, [connectionStatus, appointmentId]);

  if (!isPatient) {
    return null;
  }

  const isLeadsOff = latestVitals?.leadsOff ?? false;

  return (
    <div
      className={`rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-sm backdrop-blur-xs transition-all ${className}`}
    >
      {/* Top Bar: Connection & Status */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Device Status & Controls */}
        <div className="flex items-center gap-3">
          <div
            className={`flex size-10 items-center justify-center rounded-xl transition-colors ${
              connectionStatus === 'connected'
                ? isLeadsOff
                  ? 'bg-amber-500/15 text-amber-700 ring-1 ring-amber-500/30'
                  : 'bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-500/30'
                : connectionStatus === 'connecting'
                ? 'bg-teal-500/15 text-teal-700 animate-pulse'
                : connectionStatus === 'error'
                ? 'bg-rose-500/15 text-rose-700'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {connectionStatus === 'connecting' ? (
              <Loader2 className="size-5 animate-spin text-teal-600" />
            ) : connectionStatus === 'connected' ? (
              <Activity className="size-5 text-emerald-600 animate-pulse" />
            ) : (
              <Usb className="size-5" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900">
                {connectionStatus === 'connected'
                  ? 'AD8232 ECG Sensor Active'
                  : connectionStatus === 'connecting'
                  ? 'Opening 115200 Baud Connection...'
                  : 'AD8232 ECG Health Device'}
              </span>
              {connectionStatus === 'connected' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-ping" />
                  {platformType === 'web' ? 'Web Serial (115200)' : 'Android OTG (115200)'}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              {connectionStatus === 'connected'
                ? '50Hz native local ECG stream · 2s cloud telemetry sync'
                : 'Connect your USB AD8232 ECG node at 115200 baud'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {connectionStatus !== 'connected' ? (
            <button
              type="button"
              onClick={connectHardware}
              disabled={connectionStatus === 'connecting'}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-teal-700 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-800 active:scale-[0.98] disabled:opacity-60 cursor-pointer"
            >
              {connectionStatus === 'connecting' ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Connecting 115200...</span>
                </>
              ) : (
                <>
                  <Usb className="size-3.5" />
                  <span>Connect Health Device</span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={disconnectHardware}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 shadow-xs transition hover:bg-rose-50 active:scale-[0.98] cursor-pointer"
            >
              <PowerOff className="size-3.5" />
              <span>Disconnect</span>
            </button>
          )}
        </div>
      </div>

      {/* Live ECG Waveform Oscilloscope & Vitals (when connected) */}
      {connectionStatus === 'connected' && (
        <div className="mt-4 space-y-3">
          {/* Vitals Summary Strip */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {/* Heart Rate Tile */}
            <div className="rounded-xl border border-rose-200/60 bg-rose-50/70 p-2.5 text-rose-900">
              <div className="flex items-center gap-1.5 text-rose-700">
                <Heart className="size-3.5 fill-rose-500 animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-wider">HEART RATE</span>
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-xl font-black font-mono tracking-tight text-rose-950">
                  {latestVitals ? Math.round(latestVitals.bpm) : '--'}
                </span>
                <span className="text-xs font-semibold text-rose-700">BPM</span>
              </div>
            </div>

            {/* Leads Off / On Status Tile */}
            <div
              className={`rounded-xl border p-2.5 transition-colors ${
                isLeadsOff
                  ? 'border-amber-300 bg-amber-50 text-amber-900'
                  : 'border-emerald-200/60 bg-emerald-50/70 text-emerald-900'
              }`}
            >
              <div className="flex items-center gap-1.5">
                {isLeadsOff ? (
                  <AlertTriangle className="size-3.5 text-amber-600 animate-bounce" />
                ) : (
                  <CheckCircle2 className="size-3.5 text-emerald-600" />
                )}
                <span className="text-[10px] font-bold uppercase tracking-wider">LEADS STATUS</span>
              </div>
              <div className="mt-1">
                <span
                  className={`text-xs font-bold ${
                    isLeadsOff ? 'text-amber-800' : 'text-emerald-800'
                  }`}
                >
                  {isLeadsOff ? 'LEADS OFF' : 'LEADS ATTACHED'}
                </span>
                <p className="text-[10px] text-slate-500">
                  {isLeadsOff ? 'Check LO+ / LO- electrode pads' : 'Signal nominal'}
                </p>
              </div>
            </div>

            {/* Sampling Frequency Tile */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-800">
              <div className="flex items-center gap-1.5 text-slate-600">
                <Zap className="size-3.5 text-teal-600" />
                <span className="text-[10px] font-bold uppercase tracking-wider">ECG SAMPLING</span>
              </div>
              <div className="mt-1">
                <span className="text-xs font-bold font-mono text-slate-900">50 Hz (20ms)</span>
                <p className="text-[10px] text-slate-500">Live local chart</p>
              </div>
            </div>

            {/* Cloud Push Tile (Every 2s) */}
            <div className="rounded-xl border border-slate-900 bg-slate-900 p-2.5 text-white">
              <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                <span className="flex items-center gap-1 text-teal-400">
                  <RefreshCw className="size-3 animate-spin" />
                  CLOUD SYNC
                </span>
                {pushCount > 0 && (
                  <span className="rounded bg-teal-500/20 px-1 font-mono text-teal-300">
                    #{pushCount}
                  </span>
                )}
              </div>
              <div className="mt-1">
                <span className="text-xs font-semibold text-slate-200">BPM & Leads every 2s</span>
                <p className="text-[10px] text-slate-400">Zero raw ECG db write</p>
              </div>
            </div>
          </div>

          {/* 3. Live Scrolling ECG Line Chart (Recharts) */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-900 bg-slate-950 p-3 shadow-inner">
            <div className="mb-2 flex items-center justify-between text-[11px] font-mono text-slate-400">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-emerald-400 font-bold uppercase">
                  LEAD I ECG OSCILLOSCOPE
                </span>
                <span className="text-slate-500">· 115200 BAUD</span>
              </div>
              <div className="flex items-center gap-3 text-[10px]">
                <span className="text-slate-500">ADC: 0 – 1023</span>
                <span className="text-teal-400 font-bold">
                  RAW: {latestVitals ? latestVitals.ecg : 512}
                </span>
              </div>
            </div>

            {/* Chart Area */}
            <div className="h-44 w-full">
              {isMounted && (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={ecgHistory}
                    margin={{ top: 8, right: 8, left: -24, bottom: 0 }}
                  >
                    <YAxis
                      domain={[0, 1024]}
                      tick={false}
                      stroke="#1e293b"
                      axisLine={false}
                    />
                    <XAxis dataKey="index" hide />
                    {/* Baseline Reference Line */}
                    <ReferenceLine y={512} stroke="#1e293b" strokeDasharray="3 3" />
                    <Line
                      type="monotone"
                      dataKey="ecg"
                      stroke={isLeadsOff ? '#f59e0b' : '#10b981'}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false} // Crucial for 50Hz native real-time scrolling
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Leads Off Warning Overlay */}
            {isLeadsOff && (
              <div className="absolute inset-x-0 bottom-4 mx-auto flex w-max items-center gap-2 rounded-full border border-amber-500/40 bg-amber-950/80 px-4 py-1.5 text-xs font-bold text-amber-300 backdrop-blur-xs">
                <AlertTriangle className="size-4 text-amber-400 animate-bounce" />
                <span>LEADS DETACHED — REATTACH ELECTRODE PADS</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="mt-3 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={connectHardware}
            className="font-semibold underline hover:text-rose-950 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}

export default PatientHealthDeviceConnector;
