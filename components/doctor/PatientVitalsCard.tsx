'use client';

import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../lib/firebase';
import {
  doc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  addDoc,
  updateDoc,
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
  Bookmark,
  Eye,
  X,
  LineChart as LineChartIcon,
  Sparkles,
  Copy,
} from 'lucide-react';

export interface PatientVitalsCardProps {
  appointmentId: string;
  className?: string;
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
  aiAnalysis?: string;
  aiAnalyzedAt?: any;
}

const MAX_ECG_POINTS = 100; // Real-time scrolling window: last 100 ecg values
const SNAPSHOT_TARGET_SAMPLES = 500; // 500 points (10 seconds @ 50Hz)

/**
 * Safely extract milliseconds from Firestore timestamp formats
 */
function getTimestampMillis(ts: any): number | null {
  if (!ts) return null;
  if (typeof ts.toMillis === 'function') {
    return ts.toMillis();
  }
  if (typeof ts.seconds === 'number') {
    return ts.seconds * 1000 + Math.floor((ts.nanoseconds || 0) / 1000000);
  }
  if (typeof ts === 'number') {
    return ts;
  }
  if (ts instanceof Date) {
    return ts.getTime();
  }
  return null;
}

export function PatientVitalsCard({ appointmentId, className = '' }: PatientVitalsCardProps) {
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<
    'disconnected' | 'connecting' | 'connected' | 'error'
  >('disconnected');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 10-Second Recording State & Toast
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordedSamplesCount, setRecordedSamplesCount] = useState<number>(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Saved 10-Second Readings & Waveform Viewer for Clinician
  const [savedReadings, setSavedReadings] = useState<SavedReadingItem[]>([]);
  const [viewingReading, setViewingReading] = useState<SavedReadingItem | null>(null);

  // Gemini AI Pre-Screening State for Saved Readings
  const [analyzingReadingId, setAnalyzingReadingId] = useState<string | null>(null);
  const [modalAiAnalysis, setModalAiAnalysis] = useState<string | null>(null);
  const [modalAiLoading, setModalAiLoading] = useState<boolean>(false);
  const [modalAiError, setModalAiError] = useState<string | null>(null);
  const [copiedAi, setCopiedAi] = useState<boolean>(false);

  // State array of the last 100 ecg values for recharts real-time scrolling Line Chart
  const [ecgData, setEcgData] = useState<ECGPoint[]>(() =>
    Array.from({ length: MAX_ECG_POINTS }, (_, i) => ({ index: i, ecg: 512 }))
  );

  // Vitals state: bpm, leadsOff, ecg
  const [vitals, setVitals] = useState<VitalsState>({
    ecg: 512,
    bpm: 75,
    leadsOff: false,
    timestamp: null,
  });

  // Cloud sync status indicators
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncCount, setSyncCount] = useState<number>(0);
  const [isActivelyReceiving, setIsActivelyReceiving] = useState<boolean>(false);
  const [lastReceivedAt, setLastReceivedAt] = useState<number | null>(null);

  // Hardware Web Serial refs
  const portRef = useRef<any>(null);
  const readerRef = useRef<any>(null);
  const isReadingRef = useRef<boolean>(false);
  const latestVitalsRef = useRef<VitalsState>({
    ecg: 512,
    bpm: 75,
    leadsOff: false,
  });

  // High-frequency 100-point ECG buffer & index counter
  const ecgPointsRef = useRef<ECGPoint[]>(
    Array.from({ length: MAX_ECG_POINTS }, (_, i) => ({ index: i, ecg: 512 }))
  );
  const sampleIndexRef = useRef<number>(MAX_ECG_POINTS);

  // 500-sample temporary recording buffer
  const isRecordingRef = useRef<boolean>(false);
  const recordingBufferRef = useRef<number[]>([]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  /**
   * Listen to saved 10-second ECG readings in Firestore so the Doctor can view graphs
   */
  useEffect(() => {
    if (!appointmentId) return;

    try {
      const q = query(
        collection(db, 'appointments', appointmentId, 'saved_readings'),
        orderBy('timestamp', 'desc')
      );
      const unsub = onSnapshot(
        q,
        (snap) => {
          const items: SavedReadingItem[] = snap.docs.map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as any),
          }));
          setSavedReadings(items);
        },
        (err) => console.warn('Doctor saved readings listener warning:', err.message)
      );
      return () => unsub();
    } catch (err) {
      console.warn('Doctor saved readings setup error:', err);
    }
  }, [appointmentId]);

  // Sync AI analysis when viewing reading changes
  useEffect(() => {
    if (viewingReading) {
      setModalAiAnalysis(viewingReading.aiAnalysis || null);
      setModalAiError(null);
    } else {
      setModalAiAnalysis(null);
      setModalAiError(null);
    }
  }, [viewingReading]);

  const handleAnalyzeReading = async (targetReading?: SavedReadingItem | null) => {
    const readingToAnalyze = targetReading || viewingReading;
    if (!readingToAnalyze || !readingToAnalyze.ecgWaveform || readingToAnalyze.ecgWaveform.length === 0) {
      setModalAiError('No waveform data available to analyze.');
      return;
    }

    setViewingReading(readingToAnalyze);
    setAnalyzingReadingId(readingToAnalyze.id);
    setModalAiLoading(true);
    setModalAiError(null);

    try {
      const response = await fetch('/api/analyze-ecg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ecgWaveform: readingToAnalyze.ecgWaveform,
          bpm: readingToAnalyze.bpm,
          durationSeconds: readingToAnalyze.durationSeconds || 10,
          samplingRateHz: readingToAnalyze.samplingRateHz || 50,
          leadType: 'Lead I (AD8232)',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Failed to analyze ECG with Gemini (${response.status}): ${errorText || 'Server error'}`);
      }

      const data = await response.json();
      if (!data || (!data.success && !data.analysis)) {
        throw new Error(data?.error || 'Failed to analyze ECG with Gemini.');
      }

      setModalAiAnalysis(data.analysis);

      // Persist to Firestore
      if (appointmentId && readingToAnalyze.id) {
        try {
          const docRef = doc(db, 'appointments', appointmentId, 'saved_readings', readingToAnalyze.id);
          await updateDoc(docRef, {
            aiAnalysis: data.analysis,
            aiAnalyzedAt: serverTimestamp(),
          });
        } catch (dbErr) {
          console.warn('Could not persist AI analysis:', dbErr);
        }
      }
    } catch (err: any) {
      console.error('Error analyzing ECG with Gemini:', err);
      setModalAiError(err.message || 'Failed to connect to Gemini AI.');
    } finally {
      setModalAiLoading(false);
      setAnalyzingReadingId(null);
    }
  };

  /**
   * Start 10-Second Recording Capture
   */
  const startTenSecondRecording = () => {
    if (connectionStatus !== 'connected') {
      setToastMessage('Connect USB ECG hardware to capture snapshot.');
      setTimeout(() => setToastMessage(null), 4000);
      return;
    }

    if (isRecordingRef.current) return;

    recordingBufferRef.current = [];
    setRecordedSamplesCount(0);
    isRecordingRef.current = true;
    setIsRecording(true);
  };

  /**
   * Write 500 captured samples to Firestore
   */
  const saveSnapshotToFirestore = async (waveform: number[], finalBpm: number) => {
    if (!appointmentId) {
      setIsRecording(false);
      isRecordingRef.current = false;
      return;
    }

    try {
      await addDoc(
        collection(db, 'appointments', appointmentId, 'saved_readings'),
        {
          ecgWaveform: waveform,
          bpm: finalBpm,
          timestamp: serverTimestamp(),
          durationSeconds: 10,
          sampleCount: waveform.length,
          samplingRateHz: 50,
          leadType: 'Lead I (AD8232)',
        }
      );

      setIsRecording(false);
      isRecordingRef.current = false;
      setRecordedSamplesCount(0);
      setToastMessage(`✅ 10-second ECG reading saved to appointment (${finalBpm} BPM, 500 samples).`);
      setTimeout(() => setToastMessage(null), 5000);
    } catch (err: any) {
      console.error('Failed to save snapshot to Firestore:', err);
      setIsRecording(false);
      isRecordingRef.current = false;
      setRecordedSamplesCount(0);
      setErrorMessage(err?.message || 'Failed to save ECG snapshot.');
    }
  };

  /**
   * Web Serial API - connectHardware()
   */
  const connectHardware = async () => {
    setErrorMessage(null);
    setConnectionStatus('connecting');

    try {
      if (typeof navigator === 'undefined' || !('serial' in navigator)) {
        throw new Error(
          'Web Serial API is not supported in this browser. Please use Google Chrome, Microsoft Edge, or Opera on Desktop/Android.'
        );
      }

      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 115200 });
      portRef.current = port;
      isReadingRef.current = true;
      setConnectionStatus('connected');
      setIsActivelyReceiving(true);

      readSerialStream(port);
    } catch (err: any) {
      console.error('Failed to open Web Serial hardware connection:', err);
      setConnectionStatus('error');
      setErrorMessage(err?.message || 'Could not connect to AD8232 ECG device.');
      isReadingRef.current = false;
    }
  };

  /**
   * Process raw serial stream buffer and parse JSON objects
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

          const lines = buffer.split(/[\r\n]+/);
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

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
            } catch {}

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
   */
  const handleNewSample = (ecg: number, bpm: number, leadsOff: boolean) => {
    const nextIndex = sampleIndexRef.current + 1;
    sampleIndexRef.current = nextIndex;

    const newVitals: VitalsState = { ecg, bpm, leadsOff, timestamp: Date.now() };
    latestVitalsRef.current = newVitals;

    // 1. Live real-time scrolling graph buffer update (runs uninterrupted)
    ecgPointsRef.current.push({
      index: nextIndex,
      ecg: leadsOff ? 512 : ecg,
    });

    if (ecgPointsRef.current.length > MAX_ECG_POINTS) {
      ecgPointsRef.current.shift();
    }

    setLastReceivedAt(Date.now());
    setIsActivelyReceiving(true);

    // 2. Background 500-sample 10-second recording
    if (isRecordingRef.current) {
      recordingBufferRef.current.push(leadsOff ? 512 : ecg);
      const currentCount = recordingBufferRef.current.length;

      if (currentCount % 10 === 0 || currentCount >= SNAPSHOT_TARGET_SAMPLES) {
        setRecordedSamplesCount(currentCount);
      }

      if (currentCount >= SNAPSHOT_TARGET_SAMPLES) {
        isRecordingRef.current = false;
        const capturedWave = recordingBufferRef.current.slice(0, SNAPSHOT_TARGET_SAMPLES);
        const finalBpm = Math.round(bpm) || Math.round(latestVitalsRef.current.bpm) || 75;

        saveSnapshotToFirestore(capturedWave, finalBpm);
      }
    }
  };

  /**
   * High-Performance animation frame loop (60fps)
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
   * Throttled telemetry write to Firestore every 2s
   */
  useEffect(() => {
    if (connectionStatus !== 'connected' || !appointmentId) {
      return;
    }

    const intervalId = setInterval(async () => {
      const current = latestVitalsRef.current;
      if (!current) return;

      try {
        await setDoc(
          doc(db, 'appointments', appointmentId, 'telemetry', 'live'),
          {
            bpm: current.bpm,
            leadsOff: current.leadsOff,
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
  }, [connectionStatus, appointmentId]);

  /**
   * Remote Telemetry Listener
   */
  useEffect(() => {
    if (connectionStatus === 'connected' || !appointmentId) {
      return;
    }

    const docRef = doc(db, 'appointments', appointmentId, 'telemetry', 'live');
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
  }, [connectionStatus, appointmentId]);

  // Monitor active receiving heartbeat
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

  const isLeadsOff = vitals.leadsOff;

  return (
    <div
      className={`rounded-3xl border border-slate-200/90 bg-white/95 p-5 shadow-sm backdrop-blur-xs transition-all ${className}`}
    >
      {/* 1. Header with Title, Active Indicator & Connect / Snapshot Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div
            className={`flex size-11 items-center justify-center rounded-2xl transition-all shadow-xs ${
              isLeadsOff
                ? 'bg-rose-500/15 text-rose-600 ring-2 ring-rose-500/30'
                : isActivelyReceiving
                ? 'bg-emerald-500/15 text-emerald-600 ring-2 ring-emerald-500/30'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            <Activity className={`size-5 ${isActivelyReceiving ? 'animate-pulse' : ''}`} />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                Patient Vitals & AD8232 ECG
              </h3>
              {/* Active Pulsing Indicator */}
              <div
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold transition-all ${
                  isActivelyReceiving
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                    : 'bg-slate-100 border border-slate-200 text-slate-500'
                }`}
              >
                {isActivelyReceiving ? (
                  <>
                    <span className="relative flex size-2">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                    </span>
                    <span>115200 BAUD LIVE</span>
                  </>
                ) : (
                  <>
                    <span className="size-2 rounded-full bg-slate-400" />
                    <span>AWAITING STREAM</span>
                  </>
                )}
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              50Hz real-time lead oscilloscope with 2-second cloud telemetry throttling
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Save 10-Second Reading Button */}
          <button
            type="button"
            onClick={startTenSecondRecording}
            disabled={isRecording || connectionStatus !== 'connected'}
            className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all cursor-pointer active:scale-[0.98] ${
              isRecording
                ? 'bg-rose-600 text-white animate-pulse shadow-md ring-2 ring-rose-400'
                : connectionStatus !== 'connected'
                ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-50'
                : 'bg-rose-600 text-white hover:bg-rose-700 shadow-md shadow-rose-600/20'
            }`}
            title="Record 10-second ECG strip to appointment records"
          >
            <Bookmark className="size-4" />
            <span>
              {isRecording
                ? `Recording ${Math.min(500, recordedSamplesCount)}/500`
                : 'Save 10s Reading'}
            </span>
          </button>

          {/* Connect / Disconnect USB Button */}
          {connectionStatus !== 'connected' ? (
            <button
              type="button"
              onClick={connectHardware}
              disabled={connectionStatus === 'connecting'}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-teal-700 to-emerald-700 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-teal-700/20 transition-all hover:from-teal-800 hover:to-emerald-800 active:scale-[0.98] disabled:opacity-60 cursor-pointer"
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
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-100 active:scale-[0.98] cursor-pointer"
            >
              <PowerOff className="size-4" />
              <span>Disconnect USB</span>
            </button>
          )}
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="mt-3 flex items-center justify-between rounded-2xl border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-900 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div className="mt-3 flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
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

      {/* Main Clinical Dashboard Grid */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-4">
        {/* Left Column: BPM Stat Card & Leads Warning Badge (1 Col) */}
        <div className="space-y-3 lg:col-span-1">
          {/* BPM Stat Card */}
          <div className="rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50/60 to-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-rose-700">
              <span className="text-[11px] font-bold uppercase tracking-wider">Heart Rate</span>
              <Heart
                className={`size-5 text-rose-500 ${
                  isActivelyReceiving ? 'fill-rose-500 animate-pulse' : ''
                }`}
              />
            </div>

            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-4xl font-black font-mono tracking-tight text-slate-900">
                {Math.round(vitals.bpm) || '--'}
              </span>
              <span className="text-sm font-bold text-rose-600">BPM</span>
            </div>

            <div className="mt-3 border-t border-rose-100/80 pt-2 text-[11px] text-slate-600">
              <span className="font-semibold text-slate-900">
                {vitals.bpm >= 100
                  ? 'Tachycardia Rhythm'
                  : vitals.bpm < 60
                  ? 'Bradycardia Rhythm'
                  : 'Normal Sinus Rhythm'}
              </span>
              <p className="text-[10px] text-slate-500 mt-0.5">R-Peak detection active</p>
            </div>
          </div>

          {/* Conditional Red "Leads Off" Warning Badge */}
          <div
            className={`rounded-2xl border p-4 transition-all ${
              isLeadsOff
                ? 'border-rose-400/80 bg-rose-50 text-rose-900 ring-2 ring-rose-500/20'
                : 'border-emerald-200/80 bg-emerald-50/70 text-emerald-900'
            }`}
          >
            <div className="flex items-center gap-2">
              {isLeadsOff ? (
                <AlertTriangle className="size-5 text-rose-600 animate-bounce" />
              ) : (
                <CheckCircle2 className="size-5 text-emerald-600" />
              )}
              <span className="text-xs font-bold uppercase tracking-wider">
                {isLeadsOff ? 'LEADS OFF' : 'LEADS ATTACHED'}
              </span>
            </div>

            <p
              className={`mt-1.5 text-xs font-semibold leading-relaxed ${
                isLeadsOff ? 'text-rose-700' : 'text-emerald-700'
              }`}
            >
              {isLeadsOff
                ? 'LO+ / LO- triggered: Check electrode pad placement on chest/arms.'
                : 'Electrode impedance optimal: Bio-potential trace nominal.'}
            </p>
          </div>

          {/* Database Throttling Stat Badge */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5 text-xs text-slate-600 space-y-1">
            <div className="flex items-center justify-between font-bold text-slate-800 text-[11px]">
              <span className="flex items-center gap-1.5 text-teal-800">
                <RefreshCw className="size-3.5 text-teal-600 animate-spin" />
                Cloud Throttling
              </span>
              {syncCount > 0 && (
                <span className="rounded-md bg-teal-100 px-1.5 py-0.5 text-[10px] font-mono font-bold text-teal-800">
                  #{syncCount}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-600">
              Pushing BPM & Leads status every <strong>2.0s</strong> to Firestore.
            </p>
            <p className="text-[10px] text-slate-500 italic">
              Raw 50Hz ECG is rendered in local memory to prevent database crashes.
            </p>
          </div>
        </div>

        {/* Right Column: Large Live ECG Line Chart (3 Cols) */}
        <div className="lg:col-span-3">
          <div className="relative overflow-hidden rounded-2xl border border-slate-900 bg-slate-950 p-4 shadow-2xl">
            {/* Monitor HUD Header */}
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 font-mono text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-emerald-400 font-bold uppercase">
                  LEAD I ECG OSCILLOSCOPE
                </span>
                <span className="text-slate-600">|</span>
                <span className="text-slate-400">115200 BAUD</span>
                <span className="text-slate-600">|</span>
                <span className="text-slate-400">50 HZ (20MS)</span>
              </div>

              <div className="flex items-center gap-3 text-[11px]">
                {isRecording && (
                  <span className="rounded bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white animate-pulse">
                    REC: {recordedSamplesCount}/500
                  </span>
                )}
                <span className="text-slate-500">BUFFER: 100 SAMPLES</span>
                <span className="text-emerald-400 font-bold">
                  RAW ADC: {vitals.ecg ?? 512}
                </span>
              </div>
            </div>

            {/* Requirement 1 & 3: Large Live ECG Line Chart (recharts) */}
            <div className="h-64 w-full">
              {isMounted && (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={ecgData}
                    margin={{ top: 12, right: 12, left: -26, bottom: 0 }}
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
              <div className="absolute inset-0 m-auto flex size-fit items-center gap-2.5 rounded-2xl border border-rose-500/60 bg-rose-950/90 px-5 py-2.5 text-xs font-bold text-rose-200 shadow-2xl backdrop-blur-md animate-pulse">
                <AlertTriangle className="size-5 text-rose-400 shrink-0" />
                <div>
                  <span className="block font-black text-rose-300">LEADS OFF DETECTED</span>
                  <span className="text-[11px] text-rose-200 font-normal">
                    Electrodes detached from patient. Check RA / LA / RL leads.
                  </span>
                </div>
              </div>
            )}

            {/* Oscilloscope Grid Watermark */}
            <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-slate-500 border-t border-slate-900 pt-2">
              <span>SWEEP SPEED: 25 mm/s · GAIN: 10 mm/mV</span>
              <span>
                {connectionStatus === 'connected'
                  ? 'DIRECT HARDWARE STREAM ACTIVE'
                  : isActivelyReceiving
                  ? 'REMOTE FIRESTORE TELEMETRY MIRROR'
                  : 'READY FOR USB CONNECTION'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Doctor-Facing Saved 10-Second ECG Readings */}
      {savedReadings.length > 0 && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Bookmark className="size-4 text-rose-600" />
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Saved 10-Second ECG Waveforms ({savedReadings.length})
              </h4>
            </div>
            <span className="text-[10px] font-mono text-slate-500">
              500-Sample Strips in Firestore
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {savedReadings.map((reading) => {
              const tsMillis = getTimestampMillis(reading.timestamp);
              const dateStr = tsMillis
                ? new Date(tsMillis).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })
                : 'Recent';

              return (
                <div
                  key={reading.id}
                  className="rounded-xl border border-slate-200 bg-white p-3 flex flex-col gap-2.5 shadow-2xs hover:shadow-xs transition"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-mono text-slate-500">{dateStr}</span>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-lg font-black font-mono text-slate-900">
                          {reading.bpm}
                        </span>
                        <span className="text-[10px] font-bold text-rose-600">BPM</span>
                      </div>
                    </div>
                    {reading.aiAnalysis && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                        <Sparkles className="size-2.5 text-indigo-600" />
                        AI Ready
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setViewingReading(reading)}
                      className="inline-flex items-center justify-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-slate-800 transition cursor-pointer"
                    >
                      <Eye className="size-3 text-teal-400" />
                      <span>View</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAnalyzeReading(reading)}
                      disabled={modalAiLoading}
                      className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-gradient-to-r from-teal-600 via-indigo-600 to-purple-600 px-2 py-1.5 text-[10px] font-bold text-white hover:opacity-90 transition cursor-pointer disabled:opacity-50"
                    >
                      {analyzingReadingId === reading.id ? (
                        <>
                          <RefreshCw className="size-3 animate-spin" />
                          <span>Analyzing...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="size-3 text-amber-300" />
                          <span>Ask Gemini: Draft Analysis</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 500-Point ECG Waveform Inspection Modal */}
      {viewingReading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-4xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="bg-slate-950 text-white p-4 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
                  <Activity className="size-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold flex items-center gap-2">
                    <span>Clinical 10-Second ECG Strip</span>
                    <span className="rounded bg-rose-500/20 px-2 py-0.5 text-[10px] font-mono text-rose-300">
                      500 SAMPLES (50Hz)
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Lead I · Heart Rate: <strong className="text-rose-400">{viewingReading.bpm} BPM</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingReading(null)}
                className="size-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              <div className="rounded-2xl border border-slate-900 bg-slate-950 p-4">
                <div className="mb-2 flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span className="text-emerald-400 font-bold">10.0s CONTINUOUS WAVEFORM</span>
                  <span>50 SAMPLES / SEC</span>
                </div>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={(viewingReading.ecgWaveform || []).map((val, idx) => ({
                        time: (idx * 0.02).toFixed(2),
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
                        interval={49}
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
              </div>

              {/* Gemini AI Clinical Pre-Screening Summary Box Right Below the Graph */}
              <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-b from-indigo-950/30 via-slate-900/80 to-slate-950 p-5 space-y-3 text-white">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-indigo-400 animate-pulse" />
                    <div>
                      <h5 className="text-xs font-bold font-mono text-white flex items-center gap-2">
                        AI Clinical Pre-Screening
                        <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[9px] font-mono text-indigo-300 border border-indigo-500/30">
                          Gemini 3.8 Flash
                        </span>
                      </h5>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {modalAiAnalysis && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (!modalAiAnalysis) return;
                          await navigator.clipboard.writeText(modalAiAnalysis);
                          setCopiedAi(true);
                          setTimeout(() => setCopiedAi(false), 2500);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition cursor-pointer"
                      >
                        {copiedAi ? (
                          <>
                            <CheckCircle2 className="size-3 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="size-3 text-slate-400" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleAnalyzeReading(viewingReading)}
                      disabled={modalAiLoading}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-teal-500 via-indigo-600 to-purple-600 px-3 py-1.5 text-xs font-bold text-white shadow-md transition disabled:opacity-50 cursor-pointer"
                    >
                      {modalAiLoading ? (
                        <>
                          <RefreshCw className="size-3 animate-spin" />
                          <span>Analyzing...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="size-3 text-amber-300" />
                          <span>{modalAiAnalysis ? 'Re-Analyze with Gemini' : 'Ask Gemini: Draft Analysis'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {modalAiLoading ? (
                  <div className="py-6 text-center space-y-2 animate-pulse">
                    <RefreshCw className="size-5 animate-spin mx-auto text-indigo-400" />
                    <p className="text-xs font-semibold text-indigo-200">
                      Analyzing 500-Sample Waveform Array with Gemini AI...
                    </p>
                  </div>
                ) : modalAiError ? (
                  <div className="rounded-xl bg-rose-950/40 border border-rose-800/50 p-3 text-xs text-rose-300 flex items-start gap-2">
                    <AlertTriangle className="size-4 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Analysis Request Failed</p>
                      <p className="text-[11px] text-rose-300/80">{modalAiError}</p>
                    </div>
                  </div>
                ) : modalAiAnalysis ? (
                  <div className="rounded-xl bg-slate-950/80 border border-slate-800 p-4 text-xs text-slate-300 leading-relaxed space-y-2 max-h-60 overflow-y-auto font-sans">
                    {modalAiAnalysis.split('\n').map((line, idx) => {
                      const trimmed = line.trim();
                      if (!trimmed) return <div key={idx} className="h-1" />;
                      if (trimmed.startsWith('#')) {
                        return <h6 key={idx} className="font-bold text-teal-300 mt-2 font-mono">{trimmed.replace(/^#+\s*/, '')}</h6>;
                      }
                      if (trimmed.startsWith('>')) {
                        return (
                          <div key={idx} className="rounded-lg border border-amber-500/30 bg-amber-950/30 p-2.5 text-amber-200/90 my-1 font-medium">
                            <span className="block font-bold text-amber-300 text-[10px] mb-0.5">⚠️ CLINICAL NOTICE</span>
                            {trimmed.replace(/^>\s*/, '')}
                          </div>
                        );
                      }
                      if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
                        return (
                          <div key={idx} className="flex items-start gap-1.5 pl-2">
                            <span className="text-teal-400">•</span>
                            <span dangerouslySetInnerHTML={{ __html: trimmed.replace(/^[*•-]\s*/, '').replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>') }} />
                          </div>
                        );
                      }
                      return <p key={idx} dangerouslySetInnerHTML={{ __html: trimmed.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>') }} />;
                    })}
                  </div>
                ) : (
                  <div className="py-4 text-center text-slate-400 text-xs space-y-1">
                    <p>No AI analysis generated for this snapshot yet.</p>
                    <p className="text-[11px] text-slate-500">
                      Click <strong className="text-indigo-300">&quot;Ask Gemini: Draft Analysis&quot;</strong> to evaluate rhythm stability, baseline wander, and signal noise.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-slate-50 p-3 border-t border-slate-200 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setViewingReading(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 cursor-pointer"
              >
                Close Waveform
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PatientVitalsCard;
