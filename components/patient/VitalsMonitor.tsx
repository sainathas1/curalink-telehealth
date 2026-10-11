'use client';

import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../lib/firebase';
import {
  doc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  addDoc,
  collection,
  query,
  orderBy,
} from 'firebase/firestore';
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
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Loader2,
  PowerOff,
  RefreshCw,
  Clock,
  Zap,
  Droplets,
  Gauge,
  Plus,
  X,
  FileCheck,
  Volume2,
  VolumeX,
  Sliders,
  Sparkles,
  ShieldAlert,
  Bookmark,
  Eye,
  LineChart as LineChartIcon,
} from 'lucide-react';
import { LiveTelemetryPayload, VitalHistoryPoint } from '../../lib/types';
import { useTelehealth } from '../../context/TelehealthContext';
import { VitalsChart } from './VitalsChart';

export interface VitalsMonitorProps {
  telemetry?: LiveTelemetryPayload;
  history?: VitalHistoryPoint[];
  audioAlertsEnabled?: boolean;
  onToggleAudio?: () => void;
  onOpenSimulator?: () => void;
  isSimulating?: boolean;
  appointmentId?: string;
}

interface ECGPoint {
  index: number;
  ecg: number;
}

interface VitalsState {
  ecg: number;
  bpm: number;
  leadsOff: boolean;
  timestamp?: any;
}

interface SavedReadingItem {
  id: string;
  ecgWaveform: number[];
  bpm: number;
  timestamp: any;
  durationSeconds?: number;
  sampleCount?: number;
  samplingRateHz?: number;
}

const MAX_ECG_POINTS = 100; // Real-time scrolling window: last 100 ecg values
const SNAPSHOT_TARGET_SAMPLES = 500; // Requirement 2: 500 points (10 seconds @ 50Hz)

/**
 * Safely parse timestamps from various Firestore & JS formats
 */
function getTimestampMillis(ts: any): number | null {
  if (!ts) return null;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.seconds === 'number') {
    return ts.seconds * 1000 + Math.floor((ts.nanoseconds || 0) / 1000000);
  }
  if (typeof ts === 'number') return ts;
  if (ts instanceof Date) return ts.getTime();
  return null;
}

export function VitalsMonitor({
  telemetry: initialTelemetry,
  history = [],
  audioAlertsEnabled = false,
  onToggleAudio,
  onOpenSimulator,
  isSimulating = false,
  appointmentId: propAppointmentId,
}: VitalsMonitorProps) {
  const {
    currentUser,
    logVitalSign,
    vitalLogs,
    activeCallAppointment,
    patientAppointments,
  } = useTelehealth();

  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<
    'disconnected' | 'connecting' | 'connected' | 'error'
  >('disconnected');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Active appointment target for telemetry sync & saved readings
  const resolvedAppointmentId =
    propAppointmentId ||
    activeCallAppointment?.id ||
    patientAppointments[0]?.id ||
    (currentUser?.uid ? `patient-${currentUser.uid}` : 'live-telemetry');

  // Requirement 1 & 2: 10-Second ECG Snapshot Recording state
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordedSamplesCount, setRecordedSamplesCount] = useState<number>(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Firestore Saved Readings List & Waveform Viewer Modal
  const [savedReadings, setSavedReadings] = useState<SavedReadingItem[]>([]);
  const [viewingReading, setViewingReading] = useState<SavedReadingItem | null>(null);

  // State array of the last 100 ecg values for recharts real-time scrolling Line Chart
  const [ecgData, setEcgData] = useState<ECGPoint[]>(() =>
    Array.from({ length: MAX_ECG_POINTS }, (_, i) => ({ index: i, ecg: 512 }))
  );

  // Live Vitals State: parsed from incoming AD8232 JSON stream
  const [vitals, setVitals] = useState<VitalsState>({
    ecg: 512,
    bpm: initialTelemetry?.heartRate || 75,
    leadsOff: false,
    timestamp: null,
  });

  // Cloud sync status indicators
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncCount, setSyncCount] = useState<number>(0);
  const [isActivelyReceiving, setIsActivelyReceiving] = useState<boolean>(false);
  const [lastReceivedAt, setLastReceivedAt] = useState<number | null>(null);

  // Manual logging modal state
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [logHr, setLogHr] = useState('75');
  const [logNotes, setLogNotes] = useState('');
  const [isLogging, setIsLogging] = useState(false);
  const [logSuccess, setLogSuccess] = useState(false);

  // Hardware Web Serial refs
  const portRef = useRef<any>(null);
  const readerRef = useRef<any>(null);
  const isReadingRef = useRef<boolean>(false);
  const latestVitalsRef = useRef<VitalsState>({
    ecg: 512,
    bpm: initialTelemetry?.heartRate || 75,
    leadsOff: false,
  });

  // High-frequency 100-point ECG live scrolling buffer & index counter
  const ecgPointsRef = useRef<ECGPoint[]>(
    Array.from({ length: MAX_ECG_POINTS }, (_, i) => ({ index: i, ecg: 512 }))
  );
  const sampleIndexRef = useRef<number>(MAX_ECG_POINTS);

  // Requirement 2: 500-sample temporary buffer & recording flag ref (prevents re-render lag at 50Hz)
  const isRecordingRef = useRef<boolean>(false);
  const recordingBufferRef = useRef<number[]>([]);
  const recordingAppointmentIdRef = useRef<string>(resolvedAppointmentId);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Update target appointment ref when appointment changes
  useEffect(() => {
    recordingAppointmentIdRef.current = resolvedAppointmentId;
  }, [resolvedAppointmentId]);

  /**
   * Real-time listener for saved 10-second ECG readings in Firestore
   * collection(db, 'appointments', resolvedAppointmentId, 'saved_readings')
   */
  useEffect(() => {
    if (!resolvedAppointmentId) return;

    try {
      const readingsCol = collection(
        db,
        'appointments',
        resolvedAppointmentId,
        'saved_readings'
      );
      const q = query(readingsCol, orderBy('timestamp', 'desc'));
      const unsub = onSnapshot(
        q,
        (snap) => {
          const items: SavedReadingItem[] = snap.docs.map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as any),
          }));
          setSavedReadings(items);
        },
        (err) => {
          console.warn('Saved readings subscription notice:', err.message);
        }
      );
      return () => unsub();
    } catch (err) {
      console.warn('Saved readings setup error:', err);
    }
  }, [resolvedAppointmentId]);

  /**
   * Requirement 1 & 2: Start 10-Second ECG Reading Capture
   * - Sets isRecording to true
   * - Resets temporary buffer to capture next 500 incoming ecg data points (10s @ 50Hz)
   */
  const startTenSecondRecording = () => {
    if (connectionStatus !== 'connected') {
      setToastMessage('⚠️ Please connect USB hardware first before recording.');
      setTimeout(() => setToastMessage(null), 4000);
      return;
    }

    if (isRecordingRef.current) return;

    recordingBufferRef.current = [];
    recordingAppointmentIdRef.current = resolvedAppointmentId;
    setRecordedSamplesCount(0);
    isRecordingRef.current = true;
    setIsRecording(true);
  };

  /**
   * Requirement 3 & 4: Write captured 500 points to Firestore and show success toast
   */
  const saveSnapshotToFirestore = async (waveform: number[], finalBpm: number) => {
    const targetAppointmentId =
      recordingAppointmentIdRef.current || resolvedAppointmentId;

    if (!targetAppointmentId) {
      setIsRecording(false);
      isRecordingRef.current = false;
      setRecordedSamplesCount(0);
      return;
    }

    try {
      // Requirement 3: addDoc to appointments/{appointmentId}/saved_readings
      await addDoc(
        collection(db, 'appointments', targetAppointmentId, 'saved_readings'),
        {
          ecgWaveform: waveform, // The 500 points
          bpm: finalBpm, // Final captured BPM
          timestamp: serverTimestamp(),
          durationSeconds: 10,
          sampleCount: waveform.length,
          samplingRateHz: 50,
          leadType: 'Lead I (AD8232)',
        }
      );

      // Requirement 4: Set isRecording to false & display success toast
      setIsRecording(false);
      isRecordingRef.current = false;
      setRecordedSamplesCount(0);
      setToastMessage(
        `✅ 10-Second ECG snapshot saved successfully (${finalBpm} BPM, 500 samples). The doctor can now view the waveform!`
      );
      setTimeout(() => {
        setToastMessage(null);
      }, 5500);
    } catch (err: any) {
      console.error('Failed to write 10-second ECG reading to Firestore:', err);
      setIsRecording(false);
      isRecordingRef.current = false;
      setRecordedSamplesCount(0);
      setErrorMessage(
        err?.message || 'Failed to save 10-second ECG snapshot to Firestore.'
      );
    }
  };

  /**
   * Web Serial API - connectHardware()
   * - Uses navigator.serial.requestPort()
   * - Opens connection at 115200 baud
   * - Parses incoming JSON stream: {"ecg": val, "bpm": val, "leadsOff": boolean}
   */
  const connectHardware = async () => {
    setErrorMessage(null);
    setConnectionStatus('connecting');

    try {
      if (typeof navigator === 'undefined' || !('serial' in navigator)) {
        throw new Error(
          'Web Serial API is not supported in this browser. Please use Chrome, Edge, or Opera on Desktop/Android.'
        );
      }

      // 1. Request USB serial port authorization from user
      const port = await (navigator as any).serial.requestPort();

      // 2. Open serial connection at 115200 baud rate
      await port.open({ baudRate: 115200 });
      portRef.current = port;
      isReadingRef.current = true;
      setConnectionStatus('connected');
      setIsActivelyReceiving(true);

      // 3. Initiate continuous stream reader loop
      readSerialStream(port);
    } catch (err: any) {
      console.error('Failed to open Web Serial hardware connection:', err);
      setConnectionStatus('error');
      setErrorMessage(err?.message || 'Could not connect to AD8232 ECG hardware device.');
      isReadingRef.current = false;
    }
  };

  /**
   * Read raw serial stream chunks, split by newline, and parse AD8232 JSON packets
   */
  const readSerialStream = async (port: any) => {
    try {
      const reader = port.readable.getReader();
      readerRef.current = reader;
      const decoder = new TextDecoder();
      let buffer = '';

      while (isReadingRef.current) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          buffer += decoder.decode(value, { stream: true });

          // Split incoming text chunks by carriage return / newline
          const lines = buffer.split(/[\r\n]+/);
          buffer = lines.pop() || ''; // Preserve incomplete trailing chunk

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            // Direct JSON parse attempt: {"ecg": val, "bpm": val, "leadsOff": boolean}
            try {
              const parsed = JSON.parse(trimmed);
              if (
                parsed &&
                (typeof parsed.ecg !== 'undefined' || typeof parsed.bpm !== 'undefined')
              ) {
                const ecg = typeof parsed.ecg === 'number' ? parsed.ecg : 512;
                const bpm = typeof parsed.bpm === 'number' ? parsed.bpm : 75;
                const leadsOff = Boolean(parsed.leadsOff);

                handleNewSample(ecg, bpm, leadsOff);
                continue;
              }
            } catch {
              // Not pure JSON line, try regex fallback for noisy serial buffers
            }

            // Regex extraction fallback: handles noisy line beginnings or debug prefixes
            const match = trimmed.match(
              /\{[^{}]*"ecg"\s*:\s*([0-9.]+)[^{}]*"bpm"\s*:\s*([0-9.]+)[^{}]*"leadsOff"\s*:\s*(true|false)[^{}]*\}/i
            );
            if (match) {
              const ecg = parseFloat(match[1]);
              const bpm = parseFloat(match[2]);
              const leadsOff = match[3].toLowerCase() === 'true';

              if (!isNaN(ecg) && !isNaN(bpm)) {
                handleNewSample(ecg, bpm, leadsOff);
              }
            }
          }
        }
      }
    } catch (err: any) {
      if (isReadingRef.current) {
        console.error('Web Serial read stream error:', err);
        setErrorMessage(err?.message || 'USB ECG stream connection interrupted.');
        setConnectionStatus('error');
      }
    } finally {
      if (readerRef.current) {
        try {
          readerRef.current.releaseLock();
        } catch {}
        readerRef.current = null;
      }
    }
  };

  /**
   * Handle incoming high-speed sample
   * Requirement 5: Ensure live real-time scrolling graph continues working seamlessly
   * while the 500-sample snapshot is being recorded in the background
   */
  const handleNewSample = (ecg: number, bpm: number, leadsOff: boolean) => {
    const nextIndex = sampleIndexRef.current + 1;
    sampleIndexRef.current = nextIndex;

    const newVitals: VitalsState = { ecg, bpm, leadsOff, timestamp: Date.now() };
    latestVitalsRef.current = newVitals;

    // 1. Live real-time scrolling wave continues UNINTERRUPTED
    ecgPointsRef.current.push({
      index: nextIndex,
      ecg: leadsOff ? 512 : ecg,
    });

    if (ecgPointsRef.current.length > MAX_ECG_POINTS) {
      ecgPointsRef.current.shift();
    }

    setLastReceivedAt(Date.now());
    setIsActivelyReceiving(true);

    // 2. Requirement 2: Capture next 500 incoming ecg data points from the stream
    if (isRecordingRef.current) {
      recordingBufferRef.current.push(leadsOff ? 512 : ecg);
      const currentCount = recordingBufferRef.current.length;

      // Throttled UI progress update every 10 samples (5 times per second)
      if (currentCount % 10 === 0 || currentCount >= SNAPSHOT_TARGET_SAMPLES) {
        setRecordedSamplesCount(currentCount);
      }

      // Requirement 2 & 3: Once 500 samples are collected (10 seconds @ 50Hz)
      if (currentCount >= SNAPSHOT_TARGET_SAMPLES) {
        isRecordingRef.current = false;
        const final500Points = recordingBufferRef.current.slice(0, SNAPSHOT_TARGET_SAMPLES);
        // Capture the bpm at the end of the 10 seconds
        const finalBpm = Math.round(bpm) || Math.round(latestVitalsRef.current.bpm) || 75;

        // Write payload to Firestore
        saveSnapshotToFirestore(final500Points, finalBpm);
      }
    }
  };

  /**
   * High-Performance animation frame loop:
   * Flushes the 100-sample buffer to React state at monitor refresh rate (60fps)
   * Decouples the 50Hz serial stream from React re-renders to ensure smooth scrolling
   */
  useEffect(() => {
    if (connectionStatus !== 'connected') return;

    let animId: number;
    const renderTick = () => {
      if (ecgPointsRef.current.length > 0) {
        setEcgData([...ecgPointsRef.current]);
        setVitals({ ...latestVitalsRef.current });
      }
      animId = requestAnimationFrame(renderTick);
    };

    animId = requestAnimationFrame(renderTick);
    return () => cancelAnimationFrame(animId);
  }, [connectionStatus]);

  /**
   * Disconnect hardware safely
   */
  const disconnectHardware = async () => {
    isReadingRef.current = false;
    isRecordingRef.current = false;
    setIsRecording(false);
    setRecordedSamplesCount(0);

    if (readerRef.current) {
      try {
        await readerRef.current.cancel();
        readerRef.current.releaseLock();
      } catch {}
      readerRef.current = null;
    }

    if (portRef.current) {
      try {
        await portRef.current.close();
      } catch {}
      portRef.current = null;
    }

    setConnectionStatus('disconnected');
    setIsActivelyReceiving(false);
  };

  useEffect(() => {
    return () => {
      disconnectHardware();
    };
  }, []);

  /**
   * DATABASE THROTTLING:
   * Only push bpm and leadsOff values to doc(db, 'appointments', appointmentId, 'telemetry', 'live')
   * once every 2 seconds. High-speed raw stream stays in local client memory.
   */
  useEffect(() => {
    if (connectionStatus !== 'connected' || !resolvedAppointmentId) {
      return;
    }

    const intervalId = setInterval(async () => {
      const current = latestVitalsRef.current;
      if (!current) return;

      try {
        const recentSamples = (ecgPointsRef.current || []).slice(-120).map((p) => p.ecg);
        await setDoc(
          doc(db, 'appointments', resolvedAppointmentId, 'telemetry', 'live'),
          {
            bpm: current.bpm,
            leadsOff: current.leadsOff,
            samples: recentSamples,
            timestamp: serverTimestamp(),
          },
          { merge: true }
        );

        setLastSyncTime(new Date());
        setSyncCount((prev) => prev + 1);
      } catch (err) {
        console.error('Failed to write throttled telemetry to Firestore:', err);
      }
    }, 2000);

    return () => clearInterval(intervalId);
  }, [connectionStatus, resolvedAppointmentId]);

  /**
   * Dual-Mode Remote Mirror:
   * When this client is NOT locally connected via USB, listen to remote Firestore telemetry
   */
  useEffect(() => {
    if (connectionStatus === 'connected' || !resolvedAppointmentId) {
      return;
    }

    const docRef = doc(db, 'appointments', resolvedAppointmentId, 'telemetry', 'live');
    const unsub = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const parsedBpm =
            typeof data?.bpm === 'number'
              ? data.bpm
              : typeof data?.bpm === 'string'
              ? parseFloat(data.bpm)
              : 75;

          const parsedLeadsOff =
            typeof data?.leadsOff === 'boolean'
              ? data.leadsOff
              : typeof data?.leadsOff === 'string'
              ? data.leadsOff === 'true'
              : false;

          setVitals((prev) => ({
            ...prev,
            bpm: parsedBpm,
            leadsOff: parsedLeadsOff,
            timestamp: data?.timestamp ?? null,
          }));

          setLastReceivedAt(Date.now());
          setIsActivelyReceiving(true);
        }
      },
      (err) => console.warn('Remote telemetry listener notice:', err.message)
    );

    return () => unsub();
  }, [connectionStatus, resolvedAppointmentId]);

  // Heartbeat liveness timer
  useEffect(() => {
    const timer = setInterval(() => {
      const tsMillis = getTimestampMillis(vitals.timestamp) || lastReceivedAt;
      if (tsMillis) {
        const diffSeconds = (Date.now() - tsMillis) / 1000;
        setIsActivelyReceiving(diffSeconds <= 5);
      } else {
        setIsActivelyReceiving(false);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [vitals.timestamp, lastReceivedAt]);

  const isAuthValid = !!currentUser?.uid;

  // Handle manual vital sign submission
  const handleLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthValid) return;
    setIsLogging(true);
    try {
      await logVitalSign({
        heartRate: Number(logHr) || vitals.bpm || 75,
        spo2: 98,
        temperature: 36.8,
        systolic: 120,
        diastolic: 80,
        notes: logNotes.trim(),
      });
      setIsLogging(false);
      setLogSuccess(true);
      setTimeout(() => {
        setLogSuccess(false);
        setIsLogModalOpen(false);
        setLogNotes('');
      }, 1000);
    } catch (err) {
      console.error('Error logging vital signs:', err);
      setIsLogging(false);
    }
  };

  const isLeadsOff = vitals.leadsOff;

  return (
    <div className="space-y-6">
      {/* 1. Header with Title, Live Telemetry Badge, and Aligned Action Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm">
        <div className="flex items-center gap-4">
          <div
            className={`flex size-14 items-center justify-center rounded-2xl transition-all shadow-xs ${
              isLeadsOff
                ? 'bg-rose-500/15 text-rose-600 ring-2 ring-rose-500/30'
                : isActivelyReceiving
                ? 'bg-emerald-500/15 text-emerald-600 ring-2 ring-emerald-500/30'
                : 'bg-teal-500/10 text-teal-700'
            }`}
          >
            <Activity className={`size-7 ${isActivelyReceiving ? 'animate-pulse' : ''}`} />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                AD8232 ECG Clinical Telemetry
              </h2>
              {/* Dynamic Status Badge */}
              <div
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold transition-all ${
                  isActivelyReceiving
                    ? 'bg-emerald-50 border border-emerald-300 text-emerald-700 shadow-xs'
                    : 'bg-slate-100 border border-slate-200 text-slate-600'
                }`}
              >
                {isActivelyReceiving ? (
                  <>
                    <span className="relative flex size-2">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                    </span>
                    <span className="font-mono tracking-wide">115200 BAUD LIVE</span>
                  </>
                ) : (
                  <>
                    <span className="size-2 rounded-full bg-slate-400" />
                    <span>AWAITING STREAM</span>
                  </>
                )}
              </div>
            </div>

            <p className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-2">
              <span>Sensor: <strong className="text-slate-800 font-semibold">Analog Devices AD8232 (Lead I)</strong></span>
              <span>•</span>
              <span>Sync Target: <strong className="font-mono text-teal-700">{resolvedAppointmentId}</strong></span>
              <span>•</span>
              <span>Rate: <strong className="text-emerald-700 font-semibold">50Hz (20ms Oscilloscope)</strong></span>
            </p>
          </div>
        </div>

        {/* Action Controls: "Connect USB Device", "Save 10-Second Reading", "Record Vitals", "Sound" */}
        <div className="flex flex-wrap items-center gap-3">
          {/* 1. Prominent "Connect USB Device" Button */}
          {connectionStatus !== 'connected' ? (
            <button
              type="button"
              onClick={connectHardware}
              disabled={connectionStatus === 'connecting'}
              className="inline-flex h-11 items-center gap-2 rounded-2xl bg-gradient-to-r from-teal-700 to-emerald-700 px-5 text-xs font-bold text-white shadow-md shadow-teal-700/25 transition-all hover:from-teal-800 hover:to-emerald-800 active:scale-[0.98] disabled:opacity-60 cursor-pointer"
            >
              {connectionStatus === 'connecting' ? (
                <>
                  <Loader2 className="size-4 animate-spin text-white" />
                  <span>Opening 115200 Port...</span>
                </>
              ) : (
                <>
                  <Usb className="size-4 text-emerald-200" />
                  <span>Connect USB Device</span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={disconnectHardware}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-5 text-xs font-bold text-rose-700 transition hover:bg-rose-100 active:scale-[0.98] cursor-pointer"
            >
              <PowerOff className="size-4" />
              <span>Disconnect USB</span>
            </button>
          )}

          {/* 2. Requirement 1: "Save 10-Second Reading" Button */}
          <button
            type="button"
            onClick={startTenSecondRecording}
            disabled={isRecording || connectionStatus !== 'connected'}
            className={`inline-flex h-11 items-center gap-2 rounded-2xl px-5 text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-[0.98] ${
              isRecording
                ? 'bg-rose-600 text-white animate-pulse shadow-rose-600/30 ring-2 ring-rose-400'
                : connectionStatus !== 'connected'
                ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60'
                : 'bg-gradient-to-r from-rose-600 to-pink-600 text-white hover:from-rose-700 hover:to-pink-700 shadow-md shadow-rose-600/20'
            }`}
            title={
              connectionStatus !== 'connected'
                ? 'Connect USB ECG hardware to capture a 10-second reading'
                : 'Capture 500 data points (10 seconds @ 50Hz) to Firestore for doctor review'
            }
          >
            {isRecording ? (
              <>
                <span className="relative flex size-2.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-white" />
                </span>
                <span>
                  Recording {Math.min(SNAPSHOT_TARGET_SAMPLES, recordedSamplesCount)}/500 ({Math.min(100, Math.round((recordedSamplesCount / SNAPSHOT_TARGET_SAMPLES) * 100))}%)
                </span>
              </>
            ) : (
              <>
                <Bookmark className="size-4" />
                <span>Save 10-Second Reading</span>
              </>
            )}
          </button>

          {/* 3. Record Vitals Button */}
          <button
            type="button"
            onClick={() => setIsLogModalOpen(true)}
            disabled={!isAuthValid}
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-teal-600 px-5 text-xs font-bold text-white shadow-xs transition-all hover:bg-teal-700 disabled:opacity-50 cursor-pointer active:scale-[0.98]"
          >
            <Plus className="size-4" />
            <span>Record Vitals</span>
          </button>

          {/* 4. Sound Button */}
          {onToggleAudio && (
            <button
              type="button"
              onClick={onToggleAudio}
              className={`inline-flex h-11 items-center gap-2 rounded-2xl border px-5 text-xs font-semibold shadow-xs transition-all cursor-pointer active:scale-[0.98] ${
                audioAlertsEnabled
                  ? 'bg-teal-50 border-teal-200 text-teal-700'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
              title="Toggle Audio Rhythm Alerts"
            >
              {audioAlertsEnabled ? (
                <Volume2 className="size-4 text-teal-600" />
              ) : (
                <VolumeX className="size-4 text-slate-400" />
              )}
              <span>{audioAlertsEnabled ? 'Sound On' : 'Sound Muted'}</span>
            </button>
          )}

          {/* 5. Optional Simulator Trigger */}
          {onOpenSimulator && (
            <button
              type="button"
              onClick={onOpenSimulator}
              className="inline-flex h-11 items-center gap-2 rounded-2xl bg-slate-900 px-4 text-xs font-semibold text-white shadow-xs transition-all hover:bg-slate-800 cursor-pointer active:scale-[0.98]"
              title="Tune Simulator"
            >
              <Sliders className="size-4 text-teal-400" />
              <span>{isSimulating ? 'Tune Sensor' : 'Simulator'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Requirement 4: Success Toast Notification */}
      {toastMessage && (
        <div className="flex items-center justify-between rounded-2xl border border-emerald-300 bg-emerald-50/95 p-4 text-xs text-emerald-900 shadow-md animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
            <span className="font-semibold">{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="rounded-lg p-1 text-emerald-700 hover:bg-emerald-100 cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 shadow-xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="size-5 shrink-0 text-rose-600" />
            <span className="font-medium">{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={connectHardware}
            className="font-bold underline hover:text-rose-950 cursor-pointer"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Modern Clinical Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column: BPM Stat Card, Conditional "Leads Off" Warning, and Throttling Stat (1 Col) */}
        <div className="space-y-4 lg:col-span-1">
          {/* BPM Stat Card */}
          <div className="rounded-3xl border border-rose-100 bg-gradient-to-br from-rose-50/70 via-white to-rose-50/30 p-5 shadow-xs">
            <div className="flex items-center justify-between text-rose-700">
              <span className="text-[11px] font-black uppercase tracking-wider">
                Real-Time Heart Rate
              </span>
              <Heart
                className={`size-5 text-rose-500 ${
                  isActivelyReceiving ? 'fill-rose-500 animate-pulse' : ''
                }`}
              />
            </div>

            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-5xl font-black font-mono tracking-tight text-slate-900">
                {Math.round(vitals.bpm) || '--'}
              </span>
              <span className="text-sm font-bold text-rose-600">BPM</span>
            </div>

            <div className="mt-4 border-t border-rose-100/90 pt-3 text-xs text-slate-600">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">
                  {vitals.bpm >= 100
                    ? 'Tachycardia Rhythm'
                    : vitals.bpm < 60
                    ? 'Bradycardia Rhythm'
                    : 'Normal Sinus Rhythm'}
                </span>
                <span className="rounded-md bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                  Lead I
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                AD8232 QRS wave peak detection active
              </p>
            </div>
          </div>

          {/* Conditional Red "Leads Off" Warning Badge */}
          <div
            className={`rounded-3xl border p-5 transition-all shadow-xs ${
              isLeadsOff
                ? 'border-rose-400 bg-rose-50/90 text-rose-900 ring-4 ring-rose-500/20'
                : 'border-emerald-200 bg-emerald-50/70 text-emerald-900'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {isLeadsOff ? (
                <AlertTriangle className="size-5 text-rose-600 animate-bounce" />
              ) : (
                <CheckCircle2 className="size-5 text-emerald-600" />
              )}
              <span className="text-xs font-black uppercase tracking-wider">
                {isLeadsOff ? 'LEADS OFF DETECTED' : 'LEADS ATTACHED'}
              </span>
            </div>

            <p
              className={`mt-2 text-xs font-semibold leading-relaxed ${
                isLeadsOff ? 'text-rose-700' : 'text-emerald-700'
              }`}
            >
              {isLeadsOff
                ? 'LO+ / LO- triggered: Electrode pad detached from skin. Re-attach chest/arm leads.'
                : 'Bio-potential impedance nominal: Clean QRS wave acquired.'}
            </p>
          </div>

          {/* Database Throttling Stat Card */}
          <div className="rounded-3xl border border-slate-200 bg-slate-50/90 p-4 text-xs text-slate-600 space-y-2 shadow-xs">
            <div className="flex items-center justify-between font-bold text-slate-800 text-[11px]">
              <span className="flex items-center gap-1.5 text-teal-800">
                <RefreshCw className="size-3.5 text-teal-600 animate-spin" />
                Firestore Throttling
              </span>
              {syncCount > 0 && (
                <span className="rounded-md bg-teal-100 px-2 py-0.5 text-[10px] font-mono font-bold text-teal-800">
                  SYNC #{syncCount}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Pushing <strong>BPM & LeadsOff</strong> telemetry every <strong>2.0s</strong> to prevent database crashes.
            </p>
            <div className="rounded-xl bg-white p-2.5 border border-slate-200/80 text-[10px] text-slate-500">
              <span className="font-semibold text-slate-700 block">Snapshots on Demand:</span>
              Use &quot;Save 10-Second Reading&quot; to write 500-sample high-res waveforms directly to <code className="font-mono text-teal-700">saved_readings</code>.
            </div>
            {lastSyncTime && (
              <p className="text-[10px] text-slate-400 font-mono">
                Last synced: {lastSyncTime.toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>

        {/* Right Column: Large Live ECG Line Chart (3 Cols) */}
        <div className="lg:col-span-3">
          <div className="relative overflow-hidden rounded-3xl border border-slate-900 bg-slate-950 p-5 shadow-2xl">
            {/* Monitor HUD Header Bar */}
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 font-mono text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-emerald-400 font-bold uppercase tracking-wider">
                  LEAD I ECG OSCILLOSCOPE
                </span>
                <span className="text-slate-600">|</span>
                <span className="text-slate-400 font-bold">115200 BAUD</span>
                <span className="text-slate-600">|</span>
                <span className="text-slate-400 font-bold">50 HZ (20MS)</span>
              </div>

              <div className="flex items-center gap-3 text-[11px]">
                {/* Active Snapshot Recording Badge in Oscilloscope HUD */}
                {isRecording && (
                  <div className="flex items-center gap-2 rounded-full bg-rose-600/90 px-3 py-1 font-bold text-white shadow-lg animate-pulse">
                    <span className="size-2 rounded-full bg-white animate-ping" />
                    <span>
                      CAPTURING SNAPSHOT: {recordedSamplesCount}/500 ({((recordedSamplesCount / 500) * 10).toFixed(1)}s)
                    </span>
                  </div>
                )}
                <span className="text-slate-500">BUFFER: 100 SAMPLES</span>
                <span className="text-emerald-400 font-bold">
                  RAW ADC: {vitals.ecg ?? 512}
                </span>
              </div>
            </div>

            {/* Requirement 5: Large Live ECG Line Chart (recharts) scrolls seamlessly */}
            <div className="h-72 w-full">
              {isMounted && (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={ecgData}
                    margin={{ top: 16, right: 12, left: -24, bottom: 4 }}
                  >
                    <YAxis
                      domain={[0, 1024]}
                      tick={false}
                      stroke="#1e293b"
                      axisLine={false}
                    />
                    <XAxis dataKey="index" hide />
                    {/* Baseline Reference at 512 */}
                    <ReferenceLine y={512} stroke="#334155" strokeDasharray="3 3" />
                    <Line
                      type="monotone"
                      dataKey="ecg"
                      stroke={isLeadsOff ? '#f43f5e' : '#10b981'}
                      strokeWidth={2.5}
                      dot={false}
                      isAnimationActive={false} // Instant 50Hz native real-time scroll
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* In-Chart Conditional Warning Overlay for Leads Off */}
            {isLeadsOff && (
              <div className="absolute inset-0 m-auto flex size-fit items-center gap-3 rounded-2xl border border-rose-500/70 bg-rose-950/95 px-6 py-3.5 text-xs font-bold text-rose-200 shadow-2xl backdrop-blur-md animate-pulse">
                <AlertTriangle className="size-6 text-rose-400 shrink-0" />
                <div>
                  <span className="block font-black text-rose-300 text-sm">
                    LEADS OFF WARNING
                  </span>
                  <span className="text-[11px] text-rose-200 font-normal">
                    Electrodes detached from patient. Check RA / LA / RL leads on chest.
                  </span>
                </div>
              </div>
            )}

            {/* Oscilloscope Grid Legend / Medical Notation */}
            <div className="mt-3 flex items-center justify-between text-[10px] font-mono text-slate-500 border-t border-slate-900 pt-3">
              <span>SWEEP SPEED: 25 mm/s · GAIN: 10 mm/mV · NOTCH FILTER: 50Hz</span>
              <span>
                {connectionStatus === 'connected'
                  ? isRecording
                    ? '10-SECOND HIGH-RES SNAPSHOT STREAMING...'
                    : 'DIRECT HARDWARE STREAM ACTIVE'
                  : isActivelyReceiving
                  ? 'REMOTE TELEMETRY MIRROR'
                  : 'READY FOR USB CONNECTION'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Saved 10-Second ECG Readings Section (Allows Doctor & Patient to view graphs) */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Bookmark className="w-4 h-4 text-rose-600" />
              <span>Saved 10-Second ECG Readings (Firestore)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              500-sample high-resolution ECG strips saved for doctor analysis in <code className="font-mono text-teal-700">appointments/{resolvedAppointmentId}/saved_readings</code>
            </p>
          </div>
          <button
            type="button"
            onClick={startTenSecondRecording}
            disabled={isRecording || connectionStatus !== 'connected'}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-50 text-xs font-bold transition-all cursor-pointer border border-rose-200"
          >
            <Bookmark className="size-3.5 text-rose-600" />
            <span>{isRecording ? 'Recording in Progress...' : 'Take New 10s Reading'}</span>
          </button>
        </div>

        {savedReadings.length === 0 ? (
          <div className="py-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <LineChartIcon className="w-7 h-7 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-600">No saved 10-second ECG readings yet</p>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto mt-1">
              Click &quot;Save 10-Second Reading&quot; above to capture a 500-sample waveform snapshot to the appointment for clinical diagnostic review.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {savedReadings.map((reading, idx) => {
              const tsMillis = getTimestampMillis(reading.timestamp);
              const dateStr = tsMillis
                ? new Date(tsMillis).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    month: 'short',
                    day: 'numeric',
                  })
                : `Reading #${savedReadings.length - idx}`;

              return (
                <div
                  key={reading.id}
                  className="rounded-2xl border border-slate-200/90 bg-gradient-to-br from-slate-50/70 to-white p-4 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between gap-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-mono text-slate-500 block">
                        {dateStr}
                      </span>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-2xl font-black font-mono text-slate-900">
                          {reading.bpm}
                        </span>
                        <span className="text-xs font-bold text-rose-600">BPM</span>
                      </div>
                    </div>
                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200">
                      10s · 500 pts
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 font-mono">
                      50Hz ADC Waveform
                    </span>
                    <button
                      type="button"
                      onClick={() => setViewingReading(reading)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                    >
                      <Eye className="size-3.5 text-teal-400" />
                      <span>View Graph</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>




      {/* 24-Hour IoT Telemetry Trend Chart */}
      {history.length > 0 && <VitalsChart history={history} />}

      {/* Patient Logged Vitals Records (Firestore Table) */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Clock className="w-4 h-4 text-teal-600" />
              <span>Validated Clinical Records (Firestore)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Historical vitals saved to the <code className="font-mono text-teal-600">vitals</code> collection
            </p>
          </div>
          <button
            onClick={() => setIsLogModalOpen(true)}
            disabled={!isAuthValid}
            className="px-4 py-2 rounded-2xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Record Entry</span>
          </button>
        </div>

        {(vitalLogs || []).length === 0 ? (
          <div className="py-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <Heart className="w-6 h-6 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-600">No manual entries recorded yet</p>
            <p className="text-[11px] text-slate-400 max-w-xs mx-auto mt-0.5">
              Click &quot;Record Entry&quot; above to log your heart rate.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold text-[10px]">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Heart Rate</th>
                  <th className="px-4 py-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {(vitalLogs || []).map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-mono text-slate-500 text-[11px]">
                      {log.createdAt?.toDate
                        ? log.createdAt.toDate().toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            month: 'short',
                            day: 'numeric',
                          })
                        : 'Recently'}
                    </td>
                    <td className="px-4 py-3 font-bold text-rose-600 font-mono">
                      {log.heartRate} BPM
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-xs truncate">
                      {log.notes || 'Routine checkup log'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 10-Second Saved Reading Full Waveform Inspection Modal (For Doctor & Patient) */}
      {viewingReading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-4xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="bg-slate-950 text-white p-5 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
                  <Activity className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold flex items-center gap-2">
                    <span>10-Second High-Resolution ECG Waveform</span>
                    <span className="rounded-md bg-rose-500/20 border border-rose-500/30 px-2 py-0.5 text-[11px] font-mono text-rose-300">
                      500 SAMPLES (50Hz)
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Lead I diagnostic strip · Heart Rate: <strong className="text-rose-400">{viewingReading.bpm} BPM</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingReading(null)}
                className="size-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Modal Body: 500-Point Recharts Line Chart */}
            <div className="p-6 overflow-y-auto space-y-4">
              <div className="rounded-2xl border border-slate-900 bg-slate-950 p-4 shadow-inner">
                <div className="mb-2 flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span className="text-emerald-400 font-bold">FULL 10-SECOND STRIP (0.0s – 10.0s)</span>
                  <span>SAMPLE COUNT: {viewingReading.ecgWaveform?.length || 500} POINTS</span>
                </div>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={(viewingReading.ecgWaveform || []).map((val, idx) => ({
                        time: (idx * 0.02).toFixed(2), // 50Hz = 0.02s per point
                        ecg: val,
                      }))}
                      margin={{ top: 12, right: 12, left: -24, bottom: 0 }}
                    >
                      <YAxis
                        domain={[0, 1024]}
                        stroke="#334155"
                        tick={{ fontSize: 10, fill: '#64748b' }}
                      />
                      <XAxis
                        dataKey="time"
                        stroke="#334155"
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        interval={49} // Show 1-second ticks
                        unit="s"
                      />
                      <ReferenceLine y={512} stroke="#334155" strokeDasharray="3 3" />
                      <Line
                        type="monotone"
                        dataKey="ecg"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-slate-500 border-t border-slate-900 pt-2">
                  <span>SWEEP SPEED: 25 mm/s · CALIBRATION: 1 mV = 10 mm</span>
                  <span>RECORDING ID: {viewingReading.id}</span>
                </div>
              </div>

              {/* Clinical Metrics & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Recorded Rhythm
                  </span>
                  <span className="text-xl font-bold font-mono text-slate-900 mt-1 block">
                    {viewingReading.bpm} BPM
                  </span>
                  <span className="text-[11px] text-slate-600">
                    {viewingReading.bpm >= 100
                      ? 'Tachycardia Rhythm'
                      : viewingReading.bpm < 60
                      ? 'Bradycardia Rhythm'
                      : 'Normal Sinus Rhythm'}
                  </span>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Recording Duration
                  </span>
                  <span className="text-xl font-bold font-mono text-slate-900 mt-1 block">
                    10.0 Seconds
                  </span>
                  <span className="text-[11px] text-slate-600">
                    500 points (50 samples / sec)
                  </span>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Captured Timestamp
                  </span>
                  <span className="text-sm font-bold font-mono text-slate-900 mt-1 block">
                    {getTimestampMillis(viewingReading.timestamp)
                      ? new Date(getTimestampMillis(viewingReading.timestamp)!).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })
                      : 'Recently'}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Stored in appointments subcollection
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setViewingReading(null)}
                className="px-5 py-2.5 rounded-2xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition cursor-pointer"
              >
                Close Waveform Viewer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Vitals Recording Modal */}
      {isLogModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-teal-800 to-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300">
                  <Heart className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Record Vitals to Firestore</h3>
                  <p className="text-xs text-teal-200">
                    Synchronizes directly with clinical EHR & telemetry
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsLogModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {logSuccess ? (
              <div className="p-8 text-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-md">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h4 className="text-base font-bold text-slate-900">
                  Vitals Recorded Successfully!
                </h4>
                <p className="text-xs text-slate-500">
                  Document saved to Firestore and live stream synchronized.
                </p>
              </div>
            ) : (
              <form onSubmit={handleLogSubmit} className="p-5 space-y-4 text-xs">
                {/* Heart Rate */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Heart Rate (BPM)
                  </label>
                  <input
                    type="number"
                    required
                    min={30}
                    max={240}
                    value={logHr}
                    onChange={(e) => setLogHr(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Clinical Notes / Symptoms (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Mild palpitations, recorded during quiet rest..."
                    value={logNotes}
                    onChange={(e) => setLogNotes(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsLogModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLogging}
                    className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold flex items-center gap-1.5 shadow-md shadow-teal-600/20"
                  >
                    <FileCheck className="w-4 h-4" />
                    <span>{isLogging ? 'Writing to Firestore...' : 'Commit to Firestore'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default VitalsMonitor;
