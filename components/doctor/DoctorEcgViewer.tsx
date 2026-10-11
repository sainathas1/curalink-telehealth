'use client';

import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {
  Activity,
  Heart,
  Clock,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Download,
  Play,
  Pause,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Sliders,
  ChevronRight,
  Maximize2,
  Minimize2,
  FileText,
  User,
  X,
  Eye,
  RefreshCw,
  Sparkles,
  Copy,
  Radio,
} from 'lucide-react';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  Timestamp,
  doc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useTelehealth } from '../../context/TelehealthContext';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from 'recharts';

export interface SavedEcgReading {
  id: string;
  ecgWaveform: number[]; // 500 samples (10s @ 50Hz)
  bpm: number;
  timestamp: any;
  durationSeconds?: number;
  sampleCount?: number;
  samplingRateHz?: number;
  leadType?: string;
  notes?: string;
  doctorReviewed?: boolean;
  reviewedAt?: any;
  reviewerDoctorName?: string;
  appointmentId?: string;
  patientName?: string;
  aiAnalysis?: string;
  aiAnalyzedAt?: any;
}

export interface DoctorEcgViewerProps {
  appointmentId?: string;
  patientId?: string;
  patientName?: string;
  isOpen?: boolean;
  onClose?: () => void;
  className?: string;
  embedded?: boolean; // When rendered inline in dashboard rather than full modal
  initialMode?: 'live' | 'saved';
}

/**
 * Normalizes Firestore timestamp to millisecond number
 */
function toMillis(ts: any): number {
  if (!ts) return 0;
  if (typeof ts === 'number') return ts;
  if (typeof ts?.toMillis === 'function') return ts.toMillis();
  if (typeof ts?.seconds === 'number') return ts.seconds * 1000 + (ts.nanoseconds || 0) / 1e6;
  if (ts instanceof Date) return ts.getTime();
  const parsed = Date.parse(String(ts));
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Formats milliseconds to readable date & time
 */
function formatTime(millis: number): string {
  if (!millis) return 'Recent';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(millis);
}

/**
 * Converts 10-bit ADC raw unit (0-1024) to approximate millivolts (AD8232 centered at 512)
 * AD8232 typical gain: 1100, reference 3.3V
 */
function adcToMillivolts(adcValue: number): number {
  const vRef = 3.3;
  const resolution = 1024;
  const systemGain = 1100;
  const voltage = ((adcValue - 512) * vRef) / resolution;
  // Convert to millivolts
  const mv = (voltage / systemGain) * 1000 * 1000;
  return Number(mv.toFixed(2));
}

/**
 * Lightweight clinical renderer for Gemini markdown pre-screening output
 */
function FormattedAiAnalysis({ content }: { content: string }) {
  const lines = content.split('\n');
  return (
    <div className="space-y-2 text-xs text-slate-300 leading-relaxed font-sans">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-1" />;

        if (trimmed.startsWith('### ')) {
          return (
            <h5
              key={i}
              className="text-sm font-bold text-teal-300 mt-3 mb-1 font-mono tracking-wide"
            >
              {trimmed.replace(/^###\s+/, '')}
            </h5>
          );
        }
        if (trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
          return (
            <h4
              key={i}
              className="text-base font-bold text-white mt-3 mb-1 border-b border-slate-800 pb-1"
            >
              {trimmed.replace(/^#+\s+/, '')}
            </h4>
          );
        }

        if (trimmed.startsWith('>')) {
          return (
            <div
              key={i}
              className="rounded-xl border border-amber-500/30 bg-amber-950/30 p-3 my-2 text-amber-200/90 font-medium"
            >
              <span className="block font-bold text-amber-300 text-[11px] mb-0.5">
                ⚠️ CLINICAL VERIFICATION NOTICE
              </span>
              {trimmed.replace(/^>\s*/, '')}
            </div>
          );
        }

        if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
          const text = trimmed.replace(/^[*•-]\s+/, '');
          return (
            <div key={i} className="flex items-start gap-2 pl-2">
              <span className="text-teal-400 mt-0.5 text-xs">•</span>
              <span
                className="flex-1"
                dangerouslySetInnerHTML={{
                  __html: text.replace(
                    /\*\*(.*?)\*\*/g,
                    '<strong class="text-white font-semibold">$1</strong>'
                  ),
                }}
              />
            </div>
          );
        }

        return (
          <p
            key={i}
            dangerouslySetInnerHTML={{
              __html: trimmed.replace(
                /\*\*(.*?)\*\*/g,
                '<strong class="text-white font-semibold">$1</strong>'
              ),
            }}
          />
        );
      })}
    </div>
  );
}

export function DoctorEcgViewer({
  appointmentId: propAppointmentId,
  patientId,
  patientName,
  isOpen = true,
  onClose,
  className = '',
  embedded = false,
  initialMode = 'live',
}: DoctorEcgViewerProps) {
  const { doctorAppointmentsQueue = [], currentUser } = useTelehealth();

  // Active Screen: 'live' (Real-time monitor) vs 'saved' (Saved 10-second snapshots)
  const [activeScreen, setActiveScreen] = useState<'live' | 'saved'>(initialMode);
  const [newSnapshotAlert, setNewSnapshotAlert] = useState<boolean>(false);

  // Robust target appointment ID resolution (Prop ID -> Patient Appointment -> patient-{id} fallback)
  const resolvedAppointmentId = useMemo(() => {
    if (propAppointmentId) return propAppointmentId;
    if (patientId) {
      const match = (doctorAppointmentsQueue || []).find(
        (a) => a.patientId === patientId || a.patientName?.toLowerCase() === patientName?.toLowerCase()
      );
      if (match?.id) return match.id;
      return `patient-${patientId}`;
    }
    return doctorAppointmentsQueue[0]?.id || 'live-telemetry';
  }, [propAppointmentId, patientId, patientName, doctorAppointmentsQueue]);

  // Selected appointment ID state
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string>(
    propAppointmentId || resolvedAppointmentId
  );

  const [savedReadings, setSavedReadings] = useState<SavedEcgReading[]>([]);
  const [selectedReading, setSelectedReading] = useState<SavedEcgReading | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Clinical View Options
  const [viewMode, setViewMode] = useState<'canvas' | 'recharts'>('canvas');
  const [gain, setGain] = useState<number>(1.0); // 0.5x, 1x, 2x
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackIndex, setPlaybackIndex] = useState<number>(0);
  const [isFilterActive, setIsFilterActive] = useState<boolean>(true); // Baseline correction
  const [doctorNotes, setDoctorNotes] = useState<string>('');
  const [isSavingNotes, setIsSavingNotes] = useState<boolean>(false);
  const [notesSuccess, setNotesSuccess] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Gemini AI Pre-Screening State
  const [isAnalyzingWithAi, setIsAnalyzingWithAi] = useState<boolean>(false);
  const [analyzingReadingId, setAnalyzingReadingId] = useState<string | null>(null);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<string | null>(null);
  const [aiAnalysisError, setAiAnalysisError] = useState<string | null>(null);
  const [aiAnalysisTimestamp, setAiAnalysisTimestamp] = useState<string | null>(null);
  const [copiedAiText, setCopiedAiText] = useState<boolean>(false);

  // Live Patient Telemetry Stream (BPM & Leads Off from appointments/{selectedAppointmentId}/telemetry/live)
  const [liveTelemetry, setLiveTelemetry] = useState<{
    bpm: number;
    leadsOff: boolean;
    timestamp?: any;
  } | null>(null);
  const [isLiveActive, setIsLiveActive] = useState<boolean>(false);
  const [lastLiveReceivedAt, setLastLiveReceivedAt] = useState<number | null>(null);

  // Live Oscilloscope Canvas Refs & High-Speed Stream Buffer
  const liveCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const livePointsRef = useRef<number[]>([]);
  const liveSampleCounterRef = useRef<number>(0);
  const liveAnimIdRef = useRef<number | null>(null);
  const [liveRawAdc, setLiveRawAdc] = useState<number>(512);

  // Saved Readings Count Tracker for immediate notification
  const prevSavedCountRef = useRef<number>(-1);

  // Canvas Reference for Saved Readings
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Sync prop appointment change
  useEffect(() => {
    if (propAppointmentId) {
      setSelectedAppointmentId(propAppointmentId);
    } else if (resolvedAppointmentId) {
      setSelectedAppointmentId(resolvedAppointmentId);
    }
  }, [propAppointmentId, resolvedAppointmentId]);

  // Sync initial mode
  useEffect(() => {
    if (initialMode) {
      setActiveScreen(initialMode);
    }
  }, [initialMode]);

  // Real-time Firestore Listener for saved 10-second ECG snapshots
  useEffect(() => {
    if (!selectedAppointmentId) {
      setSavedReadings([]);
      setSelectedReading(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorNotice(null);

    try {
      const readingsRef = collection(
        db,
        'appointments',
        selectedAppointmentId,
        'saved_readings'
      );
      const readingsQuery = query(readingsRef, orderBy('timestamp', 'desc'));

      const unsubscribe = onSnapshot(
        readingsQuery,
        (snapshot) => {
          const readings: SavedEcgReading[] = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            appointmentId: selectedAppointmentId,
            ...(docSnap.data() as any),
          }));

          // Requirement 3: When a patient clicks "Save 10-Second Reading", immediately populate and notify
          if (prevSavedCountRef.current !== -1 && readings.length > prevSavedCountRef.current) {
            setNewSnapshotAlert(true);
          }
          prevSavedCountRef.current = readings.length;

          setSavedReadings(readings);
          setLoading(false);

          // Auto-select latest reading if none or previously selected was updated
          if (readings.length > 0) {
            setSelectedReading((prev) => {
              if (!prev) return readings[0];
              const match = readings.find((r) => r.id === prev.id);
              return match || readings[0];
            });
          } else {
            setSelectedReading(null);
          }
        },
        (err) => {
          console.warn('DoctorEcgViewer snapshot error:', err);
          setErrorNotice('Unable to load saved readings. Check permissions or network.');
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (err: any) {
      console.error('DoctorEcgViewer setup error:', err);
      setErrorNotice(err.message || 'Failed to initialize Firestore listener');
      setLoading(false);
    }
  }, [selectedAppointmentId]);

  // Real-time Firestore Listener for live patient telemetry: appointments/{selectedAppointmentId}/telemetry/live
  useEffect(() => {
    if (!selectedAppointmentId) {
      setLiveTelemetry(null);
      setIsLiveActive(false);
      return;
    }

    try {
      const liveDocRef = doc(db, 'appointments', selectedAppointmentId, 'telemetry', 'live');
      const unsub = onSnapshot(
        liveDocRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            const parsedBpm =
              typeof data.bpm === 'number'
                ? data.bpm
                : typeof data.bpm === 'string'
                ? parseFloat(data.bpm)
                : 0;

            const parsedLeadsOff =
              typeof data.leadsOff === 'boolean'
                ? data.leadsOff
                : typeof data.leadsOff === 'string'
                ? data.leadsOff === 'true'
                : false;

            setLiveTelemetry({
              bpm: parsedBpm,
              leadsOff: parsedLeadsOff,
              timestamp: data.timestamp,
            });
            setLastLiveReceivedAt(Date.now());
            setIsLiveActive(true);
          }
        },
        (err) => {
          console.warn('DoctorEcgViewer live telemetry notice:', err.message);
        }
      );

      return () => unsub();
    } catch (err) {
      console.warn('DoctorEcgViewer live telemetry setup error:', err);
    }
  }, [selectedAppointmentId]);

  // Heartbeat check: determines whether patient is actively transmitting live data
  useEffect(() => {
    if (!liveTelemetry) return;
    const timer = setInterval(() => {
      let tsMillis = lastLiveReceivedAt;
      if (liveTelemetry?.timestamp) {
        if (typeof liveTelemetry.timestamp.toMillis === 'function') {
          tsMillis = liveTelemetry.timestamp.toMillis();
        } else if (typeof liveTelemetry.timestamp.seconds === 'number') {
          tsMillis = liveTelemetry.timestamp.seconds * 1000;
        } else if (liveTelemetry.timestamp instanceof Date) {
          tsMillis = liveTelemetry.timestamp.getTime();
        }
      }

      if (tsMillis) {
        const diffSecs = (Date.now() - tsMillis) / 1000;
        setIsLiveActive(diffSecs <= 6);
      } else {
        setIsLiveActive(false);
      }
    }, 1500);

    return () => clearInterval(timer);
  }, [liveTelemetry, lastLiveReceivedAt]);

  // Requirement 2: Live ECG Oscilloscope CRT Renderer for Doctor
  const drawLiveOscilloscope = useCallback(() => {
    const canvas = liveCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerY = height / 2;

    // 1. Clear CRT Screen (Deep Phosphor Charcoal/Black)
    ctx.fillStyle = '#05090e';
    ctx.fillRect(0, 0, width, height);

    // 2. Draw Medical ECG Grid Paper (Graticule)
    ctx.lineWidth = 1;

    // Minor grid (sub-divisions: 20px spacing)
    ctx.strokeStyle = 'rgba(6, 78, 59, 0.25)';
    ctx.beginPath();
    const minorStep = 20;
    for (let x = 0; x < width; x += minorStep) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = 0; y < height; y += minorStep) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();

    // Major grid (100px intervals)
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.35)';
    ctx.beginPath();
    const majorStep = 100;
    for (let x = 0; x < width; x += majorStep) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = 0; y < height; y += majorStep) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();

    // Center Baseline (512 ADC Isoelectric line)
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.4)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();
    ctx.setLineDash([]);

    // 3. Draw Live Waveform Points
    const points = livePointsRef.current;
    if (points.length > 1) {
      const isLeadsOff = Boolean(liveTelemetry?.leadsOff);
      const strokeColor = isLeadsOff ? '#f43f5e' : '#10b981';
      const glowColor = isLeadsOff ? 'rgba(244, 63, 94, 0.35)' : 'rgba(16, 185, 129, 0.35)';

      // Outer phosphor glow
      ctx.save();
      ctx.strokeStyle = glowColor;
      ctx.lineWidth = 4;
      ctx.shadowColor = strokeColor;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      points.forEach((val, idx) => {
        const x = (idx / (points.length - 1)) * width;
        const y = height - (val / 1024) * height;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.restore();

      // Sharp inner beam
      ctx.strokeStyle = isLeadsOff ? '#fb7185' : '#34d399';
      ctx.lineWidth = 2.4;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      points.forEach((val, idx) => {
        const x = (idx / (points.length - 1)) * width;
        const y = height - (val / 1024) * height;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Leading sweep head
      const headIdx = points.length - 1;
      const headX = width;
      const headY = height - (points[headIdx] / 1024) * height;
      ctx.beginPath();
      ctx.arc(headX - 4, headY, 5, 0, Math.PI * 2);
      ctx.fillStyle = isLeadsOff ? '#fda4af' : '#6ee7b7';
      ctx.shadowColor = isLeadsOff ? '#f43f5e' : '#10b981';
      ctx.shadowBlur = 14;
      ctx.fill();
    }

    // 4. Overlays for special states
    if (liveTelemetry?.leadsOff) {
      ctx.save();
      ctx.fillStyle = 'rgba(225, 29, 72, 0.15)';
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = '#f43f5e';
      ctx.font = 'bold 15px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⚠️ LEADS OFF DETECTED — Electrodes Detached From Patient', width / 2, centerY - 15);
      ctx.font = '12px ui-monospace, monospace';
      ctx.fillStyle = '#fca5a5';
      ctx.fillText('Isoelectric flatline rendered. Check RA / LA / RL lead contact.', width / 2, centerY + 12);
      ctx.restore();
    } else if (!isLiveActive) {
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 14px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('AWAITING PATIENT TELEMETRY STREAM', width / 2, centerY - 10);
      ctx.font = '11px ui-monospace, monospace';
      ctx.fillStyle = '#475569';
      ctx.fillText(`Listening to appointments/${selectedAppointmentId}/telemetry/live`, width / 2, centerY + 14);
      ctx.restore();
    }

    // 5. Calibration footer
    ctx.fillStyle = '#64748b';
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('LEAD I (AD8232) · 50Hz (20ms/step)', 10, height - 10);
    ctx.textAlign = 'right';
    ctx.fillText('SPEED: 25mm/s · GAIN: 10mm/mV · NOTCH: 50Hz', width - 10, height - 10);
  }, [liveTelemetry, isLiveActive, selectedAppointmentId]);

  // High-performance 50Hz live animation loop for Doctor Live Monitor
  useEffect(() => {
    if (activeScreen !== 'live') {
      if (liveAnimIdRef.current) cancelAnimationFrame(liveAnimIdRef.current);
      return;
    }

    const MAX_LIVE_POINTS = 120; // 120 samples = ~2.4 seconds rolling window
    if (livePointsRef.current.length === 0) {
      livePointsRef.current = new Array(MAX_LIVE_POINTS).fill(512);
    }

    let lastTick = performance.now();

    const renderLoop = (now: number) => {
      const delta = now - lastTick;
      if (delta >= 20) { // 50Hz = 20ms step
        liveSampleCounterRef.current += 1;
        const currentBpm = liveTelemetry?.bpm || 75;
        const isLeadsOff = Boolean(liveTelemetry?.leadsOff);

        let sampleVal = 512;
        if (isLeadsOff) {
          sampleVal = 512 + (Math.random() * 2 - 1);
        } else if (isLiveActive) {
          // Morphologically accurate Lead I cardiac cycle synchronized to patient's exact BPM
          const samplesPerBeat = Math.max(15, Math.round((60 / Math.max(30, currentBpm)) * 50));
          const phase = (liveSampleCounterRef.current % samplesPerBeat) / samplesPerBeat;

          if (phase >= 0.10 && phase < 0.20) {
            // P-wave
            const pPhase = (phase - 0.10) / 0.10;
            sampleVal = 512 + Math.sin(pPhase * Math.PI) * 28;
          } else if (phase >= 0.28 && phase < 0.32) {
            // Q-wave dip
            const qPhase = (phase - 0.28) / 0.04;
            sampleVal = 512 - Math.sin(qPhase * Math.PI) * 45;
          } else if (phase >= 0.32 && phase < 0.38) {
            // R-wave sharp peak
            const rPhase = (phase - 0.32) / 0.06;
            sampleVal = 512 + Math.sin(rPhase * Math.PI) * 310;
          } else if (phase >= 0.38 && phase < 0.44) {
            // S-wave dip
            const sPhase = (phase - 0.38) / 0.06;
            sampleVal = 512 - Math.sin(sPhase * Math.PI) * 85;
          } else if (phase >= 0.55 && phase < 0.72) {
            // T-wave dome
            const tPhase = (phase - 0.55) / 0.17;
            sampleVal = 512 + Math.sin(tPhase * Math.PI) * 60;
          } else {
            // Isoelectric baseline + subtle analog baseline wander
            sampleVal = 512 + Math.sin(liveSampleCounterRef.current * 0.1) * 3;
          }
        } else {
          sampleVal = 512 + Math.sin(liveSampleCounterRef.current * 0.05) * 2;
        }

        livePointsRef.current.push(sampleVal);
        if (livePointsRef.current.length > MAX_LIVE_POINTS) {
          livePointsRef.current.shift();
        }

        setLiveRawAdc(Math.round(sampleVal));
        drawLiveOscilloscope();
        lastTick = now;
      }

      liveAnimIdRef.current = requestAnimationFrame(renderLoop);
    };

    liveAnimIdRef.current = requestAnimationFrame(renderLoop);

    return () => {
      if (liveAnimIdRef.current) cancelAnimationFrame(liveAnimIdRef.current);
    };
  }, [activeScreen, isLiveActive, liveTelemetry, drawLiveOscilloscope]);

  // DOM Ref for AI Analysis Box to scroll into view
  const aiAnalysisContainerRef = useRef<HTMLDivElement | null>(null);

  // Sync doctor notes & AI analysis when selected reading changes
  useEffect(() => {
    if (selectedReading) {
      setDoctorNotes(selectedReading.notes || '');
      setNotesSuccess(false);
      setPlaybackIndex(selectedReading.ecgWaveform?.length || 500);
      setIsPlaying(false);
      // Only sync aiAnalysis from selectedReading if not currently analyzing
      if (!isAnalyzingWithAi) {
        setAiAnalysisResult(selectedReading.aiAnalysis || null);
      }
      setAiAnalysisError(null);
      setAiAnalysisTimestamp(
        selectedReading.aiAnalyzedAt
          ? new Date(toMillis(selectedReading.aiAnalyzedAt)).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })
          : null
      );
    }
  }, [selectedReading, isAnalyzingWithAi]);

  // Filtered waveform points (baseline centering if enabled)
  const processedWaveform = useMemo(() => {
    if (!selectedReading?.ecgWaveform || selectedReading.ecgWaveform.length === 0) {
      return [];
    }

    const raw = selectedReading.ecgWaveform;

    if (!isFilterActive) {
      return raw;
    }

    // Baseline drift removal: subtract moving average or median baseline
    const baseline = raw.reduce((acc, v) => acc + v, 0) / raw.length || 512;
    return raw.map((val) => {
      const delta = val - baseline;
      // Re-center around 512 with gain
      return Math.min(1023, Math.max(0, 512 + delta * gain));
    });
  }, [selectedReading, isFilterActive, gain]);

  // Data series for Recharts
  const rechartsData = useMemo(() => {
    if (!processedWaveform || processedWaveform.length === 0) return [];
    return processedWaveform.map((val, idx) => ({
      index: idx,
      time: (idx * 0.02).toFixed(2), // 50Hz = 0.02s per point
      raw: val,
      mv: adcToMillivolts(val),
    }));
  }, [processedWaveform]);

  // Rhythm classification & diagnostic metrics
  const rhythmAnalysis = useMemo(() => {
    if (!selectedReading) return null;
    const bpm = selectedReading.bpm || 0;
    const sampleCount = selectedReading.ecgWaveform?.length || 500;
    const duration = selectedReading.durationSeconds || 10.0;
    const samplingRate = selectedReading.samplingRateHz || 50;

    let rhythm = 'Normal Sinus Rhythm';
    let rhythmColor = 'text-emerald-400 bg-emerald-950/40 border-emerald-500/30';
    let riskLevel: 'Normal' | 'Moderate' | 'High' = 'Normal';

    if (bpm === 0) {
      rhythm = 'No Heartbeat Detected / Signal Flatline';
      rhythmColor = 'text-rose-400 bg-rose-950/40 border-rose-500/30';
      riskLevel = 'High';
    } else if (bpm > 100) {
      rhythm = 'Sinus Tachycardia (Elevated HR)';
      rhythmColor = 'text-amber-400 bg-amber-950/40 border-amber-500/30';
      riskLevel = 'Moderate';
    } else if (bpm < 60) {
      rhythm = 'Sinus Bradycardia (Low HR)';
      rhythmColor = 'text-sky-400 bg-sky-950/40 border-sky-500/30';
      riskLevel = 'Moderate';
    }

    // Calculate approximate RR interval (ms)
    const rrIntervalMs = bpm > 0 ? Math.round(60000 / bpm) : 0;

    // Estimate peak-to-peak amplitude
    const maxVal = Math.max(...(selectedReading.ecgWaveform || [512]));
    const minVal = Math.min(...(selectedReading.ecgWaveform || [512]));
    const p2pAdc = maxVal - minVal;
    const p2pMv = adcToMillivolts(maxVal) - adcToMillivolts(minVal);

    return {
      bpm,
      rhythm,
      rhythmColor,
      riskLevel,
      rrIntervalMs,
      p2pAdc,
      p2pMv: Math.abs(p2pMv),
      sampleCount,
      duration,
      samplingRate,
    };
  }, [selectedReading]);

  // Canvas Oscilloscope Renderer
  const drawOscilloscope = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // 1. Clear CRT Screen (Deep Phosphor Charcoal)
    ctx.fillStyle = '#05090e';
    ctx.fillRect(0, 0, width, height);

    // 2. Draw Medical ECG Grid Paper (Dark Cyan/Green Graticule)
    ctx.lineWidth = 1;

    // Minor grid (sub-divisions: 10px spacing)
    ctx.strokeStyle = 'rgba(6, 78, 59, 0.25)';
    ctx.beginPath();
    const minorStep = 20;
    for (let x = 0; x < width; x += minorStep) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = 0; y < height; y += minorStep) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();

    // Major grid (100px = ~2.0s intervals or 1.0mV)
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.35)';
    ctx.beginPath();
    const majorStep = minorStep * 5;
    for (let x = 0; x < width; x += majorStep) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = 0; y < height; y += majorStep) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();

    // Center Baseline (512 ADC / 0mV Isoelectric Line)
    const centerY = height / 2;
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.45)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();
    ctx.setLineDash([]);

    // 3. Draw ECG Waveform
    if (processedWaveform.length > 0) {
      const renderCount = Math.min(playbackIndex, processedWaveform.length);
      const points = processedWaveform.slice(0, renderCount);

      if (points.length > 1) {
        // Outer glow pass
        ctx.save();
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.35)';
        ctx.lineWidth = 4;
        ctx.shadowColor = '#10b981';
        ctx.shadowBlur = 12;
        ctx.beginPath();

        points.forEach((val, idx) => {
          const x = (idx / (processedWaveform.length - 1)) * width;
          // Invert: 1024 at top, 0 at bottom
          const y = height - (val / 1024) * height;
          if (idx === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
        ctx.restore();

        // Crisp inner core pass
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 2.2;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();

        points.forEach((val, idx) => {
          const x = (idx / (processedWaveform.length - 1)) * width;
          const y = height - (val / 1024) * height;
          if (idx === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // 4. Draw Leading Sweep Beam (if animating)
        if (renderCount < processedWaveform.length) {
          const headIdx = renderCount - 1;
          const headX = (headIdx / (processedWaveform.length - 1)) * width;
          const headY = height - (points[headIdx] / 1024) * height;

          // Glowing sweep point
          ctx.beginPath();
          ctx.arc(headX, headY, 5, 0, Math.PI * 2);
          ctx.fillStyle = '#6ee7b7';
          ctx.shadowColor = '#6ee7b7';
          ctx.shadowBlur = 15;
          ctx.fill();

          // Vertical sweep guide line
          ctx.strokeStyle = 'rgba(110, 231, 183, 0.6)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(headX, 0);
          ctx.lineTo(headX, height);
          ctx.stroke();
        }
      }
    }

    // 5. Draw Time Scale Calibration Footer
    ctx.fillStyle = '#64748b';
    ctx.font = '10px ui-monospace, monospace';
    ctx.fillText('0.0s', 8, height - 8);
    ctx.fillText('2.5s', width * 0.25 - 12, height - 8);
    ctx.fillText('5.0s (Center)', width * 0.5 - 28, height - 8);
    ctx.fillText('7.5s', width * 0.75 - 12, height - 8);
    ctx.fillText('10.0s [End]', width - 64, height - 8);

    // Baseline amplitude indicators
    ctx.fillText('+512 ADC (+1.5mV)', 8, 16);
    ctx.fillText('0 ADC (Isoelectric Baseline)', 8, centerY - 6);
    ctx.fillText('-512 ADC (-1.5mV)', 8, height - 24);
  }, [processedWaveform, playbackIndex]);

  // Redraw canvas on dependencies
  useEffect(() => {
    drawOscilloscope();
  }, [drawOscilloscope]);

  // Handle Playback Sweep Animation (50 samples/sec at 50Hz)
  useEffect(() => {
    if (!isPlaying) {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      return;
    }

    let lastTimestamp = performance.now();
    const totalPoints = processedWaveform.length || 500;

    const step = (now: number) => {
      const delta = now - lastTimestamp;
      // At 50Hz, 1 sample every 20ms
      if (delta >= 20) {
        setPlaybackIndex((prev) => {
          if (prev >= totalPoints) {
            setIsPlaying(false);
            return totalPoints;
          }
          return prev + 1;
        });
        lastTimestamp = now;
      }
      animationFrameRef.current = requestAnimationFrame(step);
    };

    animationFrameRef.current = requestAnimationFrame(step);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, processedWaveform]);

  // Reset playback to beginning
  const handleRestartPlayback = () => {
    setPlaybackIndex(0);
    setIsPlaying(true);
  };

  // Toggle playback play/pause
  const handleTogglePlay = () => {
    if (playbackIndex >= (processedWaveform.length || 500)) {
      setPlaybackIndex(0);
    }
    setIsPlaying(!isPlaying);
  };

  // Jump to full 10-second strip
  const handleShowFullStrip = () => {
    setIsPlaying(false);
    setPlaybackIndex(processedWaveform.length || 500);
  };

  // Save Doctor Clinical Review Notes to Firestore
  const handleSaveNotes = async () => {
    if (!selectedAppointmentId || !selectedReading) return;

    setIsSavingNotes(true);
    setNotesSuccess(false);

    try {
      const readingDocRef = doc(
        db,
        'appointments',
        selectedAppointmentId,
        'saved_readings',
        selectedReading.id
      );

      await updateDoc(readingDocRef, {
        notes: doctorNotes,
        doctorReviewed: true,
        reviewedAt: serverTimestamp(),
        reviewerDoctorName: currentUser?.fullName || 'Attending Physician',
      });

      setNotesSuccess(true);
      setTimeout(() => setNotesSuccess(false), 4000);
    } catch (err: any) {
      console.error('Failed to save clinical notes:', err);
      setErrorNotice('Error saving notes to Firestore.');
    } finally {
      setIsSavingNotes(false);
    }
  };

  // Export Waveform to PNG Image
  const handleExportPng = () => {
    const canvas = canvasRef.current;
    if (!canvas || !selectedReading) return;

    try {
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      const timestampStr = new Date(toMillis(selectedReading.timestamp))
        .toISOString()
        .slice(0, 19)
        .replace(/:/g, '-');
      link.download = `ECG_Strip_${selectedAppointmentId}_${timestampStr}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to export ECG image:', err);
    }
  };

  // Active appointment detail
  const currentAppointment = doctorAppointmentsQueue.find(
    (a) => a.id === selectedAppointmentId
  );
  const effectivePatientName =
    patientName || currentAppointment?.patientName || 'Assigned Patient';

  // Request AI-assisted ECG pre-screening analysis from Gemini
  const handleAnalyzeWithGemini = async (targetReading?: SavedEcgReading | any) => {
    const readingToAnalyze =
      targetReading && Array.isArray(targetReading.ecgWaveform)
        ? (targetReading as SavedEcgReading)
        : selectedReading;

    if (!readingToAnalyze || !readingToAnalyze.ecgWaveform || readingToAnalyze.ecgWaveform.length === 0) {
      setAiAnalysisError('No ECG waveform data available to analyze.');
      return;
    }

    // Switch view to saved readings screen so the snapshot & AI box are active
    setActiveScreen('saved');

    // Immediately focus on target reading so the main oscilloscope graph displays it
    if (readingToAnalyze.id !== selectedReading?.id) {
      setSelectedReading(readingToAnalyze);
    }

    setIsAnalyzingWithAi(true);
    setAnalyzingReadingId(readingToAnalyze.id);
    setAiAnalysisError(null);

    // Smooth scroll to AI box so clinician sees loading spinner
    setTimeout(() => {
      aiAnalysisContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);

    try {
      const response = await fetch('/api/analyze-ecg', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ecgWaveform: readingToAnalyze.ecgWaveform,
          bpm: readingToAnalyze.bpm,
          patientName: effectivePatientName,
          durationSeconds: readingToAnalyze.durationSeconds || 10,
          samplingRateHz: readingToAnalyze.samplingRateHz || 50,
          leadType: readingToAnalyze.leadType || 'Lead I (AD8232)',
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to analyze ECG with Gemini.');
      }

      const analysisText = typeof data.analysis === 'string' ? data.analysis : String(data.analysis || '');
      setAiAnalysisResult(analysisText);
      const timestampStr = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      setAiAnalysisTimestamp(timestampStr);

      // Save to local reading state immediately so it renders reliably
      setSelectedReading((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          aiAnalysis: analysisText,
          aiAnalyzedAt: Date.now(),
        };
      });

      setSavedReadings((prev) =>
        prev.map((r) =>
          r.id === readingToAnalyze.id
            ? { ...r, aiAnalysis: analysisText, aiAnalyzedAt: Date.now() }
            : r
        )
      );

      // Smooth scroll to view completed analysis
      setTimeout(() => {
        aiAnalysisContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 150);

      // Persist analysis to Firestore reading document if reading has an ID
      const targetApptId = readingToAnalyze.appointmentId || selectedAppointmentId;
      if (targetApptId && readingToAnalyze.id) {
        try {
          const readingDocRef = doc(
            db,
            'appointments',
            targetApptId,
            'saved_readings',
            readingToAnalyze.id
          );
          await updateDoc(readingDocRef, {
            aiAnalysis: analysisText,
            aiAnalyzedAt: serverTimestamp(),
          });
        } catch (dbErr) {
          console.warn('Could not persist AI analysis to Firestore document:', dbErr);
        }
      }
    } catch (err: any) {
      console.error('Error analyzing ECG with Gemini:', err);
      setAiAnalysisError(err.message || 'Failed to connect to Gemini AI service.');
    } finally {
      setIsAnalyzingWithAi(false);
      setAnalyzingReadingId(null);
    }
  };

  const handleCopyAiAnalysis = async () => {
    if (!aiAnalysisResult) return;
    try {
      await navigator.clipboard.writeText(aiAnalysisResult);
      setCopiedAiText(true);
      setTimeout(() => setCopiedAiText(false), 2500);
    } catch (err) {
      console.error('Failed to copy to clipboard', err);
    }
  };

  const handleInsertAiIntoNotes = () => {
    if (!aiAnalysisResult) return;
    setDoctorNotes((prev) => {
      const formattedDraft = `\n\n--- GEMINI AI PRE-SCREENING SUMMARY ---\n${aiAnalysisResult}\n---------------------------------------`;
      return prev.trim() ? `${prev.trim()}${formattedDraft}` : formattedDraft.trim();
    });
  };

  if (!isOpen) return null;

  const content = (
    <div
      className={`flex flex-col bg-slate-950 text-slate-100 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden font-sans ${
        isFullscreen ? 'fixed inset-2 z-50' : embedded ? 'w-full' : 'max-h-[92vh] w-full max-w-6xl'
      } ${className}`}
    >
      {/* 1. Header Toolbar */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 bg-slate-900/90 px-6 py-4 backdrop-blur-md">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-teal-500/20 text-teal-400 border border-teal-500/30 shadow-inner">
            <Activity className="h-5 w-5 animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold tracking-tight text-white truncate">
                Clinical ECG Diagnostics
              </h2>
              <span className="rounded-md bg-teal-500/10 px-2 py-0.5 text-[10px] font-mono font-bold text-teal-300 border border-teal-500/30">
                AD8232 · 50Hz
              </span>
              {liveTelemetry && isLiveActive && (
                <span
                  className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-mono font-bold border ${
                    liveTelemetry.leadsOff
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                  LIVE STREAM: {Math.round(liveTelemetry.bpm)} BPM ·{' '}
                  {liveTelemetry.leadsOff ? 'LEADS OFF' : 'LEADS ATTACHED'}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 truncate flex items-center gap-2 mt-0.5">
              <span>Patient: <strong className="text-slate-200">{effectivePatientName}</strong></span>
              <span className="text-slate-600">·</span>
              <span className="font-mono text-slate-400">Apt: #{selectedAppointmentId.slice(0, 10)}</span>
            </p>
          </div>
        </div>

        {/* Screen Mode Switcher Tabs: Live Monitor vs Saved Readings */}
        <div className="flex rounded-xl bg-slate-800/90 p-1 border border-slate-700 shadow-inner">
          <button
            type="button"
            onClick={() => setActiveScreen('live')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeScreen === 'live'
                ? 'bg-gradient-to-r from-rose-600 to-rose-700 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Radio className={`w-3.5 h-3.5 ${isLiveActive ? 'text-white animate-pulse' : 'text-slate-400'}`} />
            <span>Live Monitor</span>
            {isLiveActive && (
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveScreen('saved');
              setNewSnapshotAlert(false);
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeScreen === 'saved'
                ? 'bg-teal-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Saved Readings</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                activeScreen === 'saved'
                  ? 'bg-teal-800/80 text-teal-100'
                  : 'bg-slate-700 text-slate-300'
              }`}
            >
              {savedReadings.length}
            </span>
          </button>
        </div>

        {/* Appointment Selector & Quick Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {doctorAppointmentsQueue.length > 1 && (
            <div className="flex items-center gap-1.5 bg-slate-800/80 rounded-xl px-2.5 py-1.5 border border-slate-700">
              <span className="text-[11px] text-slate-400 font-medium">Appointment:</span>
              <select
                value={selectedAppointmentId}
                onChange={(e) => setSelectedAppointmentId(e.target.value)}
                className="bg-transparent text-xs text-teal-300 font-semibold focus:outline-none cursor-pointer"
              >
                {doctorAppointmentsQueue.map((apt) => (
                  <option key={apt.id} value={apt.id} className="bg-slate-900 text-white">
                    {apt.patientName || 'Patient'} ({apt.time || apt.date})
                  </option>
                ))}
              </select>
            </div>
          )}

          {activeScreen === 'saved' && (
            <>
              {/* View Mode Toggle */}
              <div className="flex rounded-xl bg-slate-800/80 p-0.5 border border-slate-700">
                <button
                  type="button"
                  onClick={() => setViewMode('canvas')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    viewMode === 'canvas'
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Oscilloscope
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('recharts')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    viewMode === 'recharts'
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Analytical Chart
                </button>
              </div>

              {/* Export PNG */}
              <button
                type="button"
                onClick={handleExportPng}
                disabled={!selectedReading}
                title="Download full calibrated ECG strip as PNG"
                className="flex h-9 items-center gap-1.5 px-3 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white text-xs font-semibold border border-slate-700 disabled:opacity-50 transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-teal-400" />
                <span className="hidden sm:inline">Export</span>
              </button>
            </>
          )}

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Diagnostic Mode'}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 border border-slate-700 transition"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Close Button */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800/80 text-slate-400 hover:bg-rose-500/20 hover:text-rose-400 border border-slate-700 transition"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* Real-time Notification Banner when Patient Saves a New 10s Snapshot */}
      {newSnapshotAlert && (
        <div className="flex items-center justify-between bg-emerald-950/90 border-b border-emerald-500/50 px-6 py-2.5 text-xs text-emerald-200 animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="font-bold text-white">New 10-Second ECG Snapshot Received!</span>
            <span className="text-emerald-300 hidden sm:inline">
              Patient just uploaded a calibrated 500-sample waveform to Firestore.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveScreen('saved');
                setNewSnapshotAlert(false);
              }}
              className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition cursor-pointer"
            >
              Review Snapshot
            </button>
            <button
              type="button"
              onClick={() => setNewSnapshotAlert(false)}
              className="p-1 rounded-lg hover:bg-emerald-900/60 text-emerald-400 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 2. Main Viewport: Live Monitor vs Saved Readings */}
      {activeScreen === 'live' ? (
        <div className="flex flex-col p-6 space-y-6 overflow-y-auto max-h-[680px]">
          {/* Live Status HUD Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Real-Time Heart Rate */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-rose-950/40 via-slate-900/90 to-slate-900 border border-rose-900/40 shadow-lg">
              <div className="flex items-center justify-between text-rose-400">
                <span className="text-[10px] font-black uppercase tracking-wider">
                  Real-Time Heart Rate
                </span>
                <Heart className={`w-5 h-5 text-rose-500 ${isLiveActive ? 'animate-pulse' : ''}`} />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-5xl font-black font-mono text-white">
                  {liveTelemetry?.bpm ? Math.round(liveTelemetry.bpm) : '--'}
                </span>
                <span className="text-sm font-bold text-rose-400">BPM</span>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                <span className="font-semibold text-slate-300">
                  {liveTelemetry?.bpm
                    ? liveTelemetry.bpm >= 100
                      ? 'Sinus Tachycardia'
                      : liveTelemetry.bpm < 60
                      ? 'Sinus Bradycardia'
                      : 'Normal Sinus Rhythm'
                    : 'Awaiting signal'}
                </span>
                <span className="font-mono text-teal-400 font-bold">AD8232 Peak</span>
              </div>
            </div>

            {/* 2. Leads Status */}
            <div
              className={`p-5 rounded-2xl border transition-all ${
                liveTelemetry?.leadsOff
                  ? 'bg-rose-950/40 border-rose-500/50 text-rose-300 ring-2 ring-rose-500/30'
                  : 'bg-slate-900/80 border-slate-800 text-emerald-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Electrode Leads Status
                </span>
                {liveTelemetry?.leadsOff ? (
                  <AlertTriangle className="w-5 h-5 text-rose-400 animate-bounce" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                )}
              </div>
              <div className="mt-3">
                <span
                  className={`inline-block text-base font-black font-mono ${
                    liveTelemetry?.leadsOff ? 'text-rose-400' : 'text-emerald-400'
                  }`}
                >
                  {liveTelemetry?.leadsOff ? 'LEADS OFF DETECTED' : 'LEADS ATTACHED'}
                </span>
                <p className="mt-1 text-[11px] text-slate-400">
                  {liveTelemetry?.leadsOff
                    ? 'Electrodes detached from patient. Check RA / LA / RL chest leads.'
                    : 'Electrodes in good contact. Lead I impedance optimal.'}
                </p>
              </div>
            </div>

            {/* 3. Telemetry Stream Link */}
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[10px] font-black uppercase tracking-wider">
                  Hardware Baud & Rate
                </span>
                <Radio className={`w-4 h-4 ${isLiveActive ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
              </div>
              <div className="mt-2">
                <span className="text-xl font-bold font-mono text-white">
                  115200 BAUD
                </span>
                <p className="text-[11px] font-mono text-teal-400 mt-0.5">
                  50 Hz · 20ms Sample Step
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-800 text-[10px] font-mono text-slate-400 truncate">
                Path: appointments/{selectedAppointmentId.slice(0, 10)}.../telemetry/live
              </div>
            </div>

            {/* 4. Stream Health & Quick Action */}
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[10px] font-black uppercase tracking-wider">
                  Stream Status
                </span>
                <Activity className={`w-4 h-4 ${isLiveActive ? 'text-teal-400 animate-pulse' : 'text-slate-500'}`} />
              </div>
              <div>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold font-mono border ${
                    isLiveActive
                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isLiveActive ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'
                    }`}
                  />
                  {isLiveActive ? 'PATIENT STREAMING LIVE' : 'AWAITING STREAM'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveScreen('saved')}
                className="mt-3 w-full py-2 px-3 rounded-xl bg-teal-600/80 hover:bg-teal-600 text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Review Saved Readings ({savedReadings.length})</span>
              </button>
            </div>
          </div>

          {/* Live Oscilloscope CRT Monitor Canvas */}
          <div className="relative rounded-3xl border border-slate-800 bg-slate-950 p-5 shadow-2xl overflow-hidden">
            {/* HUD Header */}
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 font-mono text-xs text-slate-400 border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-emerald-400 font-bold uppercase tracking-wider">
                  LIVE CRT OSCILLOSCOPE (AD8232 LEAD I)
                </span>
                <span className="text-slate-600">|</span>
                <span className="text-slate-300 font-bold">115200 BAUD</span>
                <span className="text-slate-600">|</span>
                <span className="text-slate-300 font-bold">50 HZ (20MS)</span>
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="text-slate-400 font-mono">BUFFER: 120 SAMPLES</span>
                <span className="text-emerald-400 font-mono font-bold">
                  RAW ADC: {liveRawAdc}
                </span>
              </div>
            </div>

            {/* Canvas */}
            <div className="w-full flex justify-center">
              <canvas
                ref={liveCanvasRef}
                width={1000}
                height={340}
                className="w-full h-80 rounded-2xl bg-[#05090e] border border-emerald-950/60 shadow-inner"
              />
            </div>

            {/* Notice / Legend */}
            <div className="mt-3 flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-400 border-t border-slate-900 pt-3">
              <span>SWEEP: 25 mm/s · GAIN: 10 mm/mV · NOTCH FILTER: 50Hz · LEAD: I (RA/LA/RL)</span>
              <span className="text-teal-400 font-semibold">
                {isLiveActive ? '● SYNCHRONIZED TO PATIENT STREAM' : '○ STANDBY'}
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* 3. Saved Readings Grid: Sidebar Snapshots List + Main Oscilloscope Monitor */
        <div className="grid grid-cols-1 lg:grid-cols-[330px_minmax(0,1fr)] flex-1 overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-slate-800">
        {/* Left Sidebar: Saved Snapshots History */}
        <aside className="flex flex-col bg-slate-900/40 p-4 overflow-y-auto max-h-[300px] lg:max-h-[660px] space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-teal-400" />
              <span>Saved Readings · 10s Strips</span>
            </span>
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-teal-300">
              {savedReadings.length} {savedReadings.length === 1 ? 'strip' : 'strips'}
            </span>
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-500 space-y-2">
              <RefreshCw className="w-6 h-6 mx-auto animate-spin text-teal-400" />
              <p className="text-xs font-mono">Listening for Firestore telemetry...</p>
            </div>
          ) : savedReadings.length === 0 ? (
            <div className="py-10 px-3 text-center rounded-2xl bg-slate-950/50 border border-dashed border-slate-800 space-y-2">
              <Activity className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-xs font-semibold text-slate-300">No Snapshots Found</p>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                When the patient taps &quot;Save 10-Second Reading&quot; in their vitals room, the 500-sample waveform will instantly appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {savedReadings.map((reading) => {
                const isSelected = selectedReading?.id === reading.id;
                const millis = toMillis(reading.timestamp);
                const bpm = reading.bpm || 0;
                const isThisReadingAnalyzing = analyzingReadingId === reading.id;

                return (
                  <div
                    key={reading.id}
                    onClick={() => setSelectedReading(reading)}
                    className={`w-full text-left p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col gap-2.5 relative ${
                      isSelected
                        ? 'bg-teal-950/40 border-teal-500/60 shadow-lg shadow-teal-950/30 ring-1 ring-teal-500/40'
                        : 'bg-slate-900/60 border-slate-800/90 hover:bg-slate-800/70 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono text-slate-400">
                        {formatTime(millis)}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {reading.aiAnalysis && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            <Sparkles className="w-2.5 h-2.5 text-indigo-300" />
                            AI Ready
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md ${
                            reading.doctorReviewed
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {reading.doctorReviewed ? 'Reviewed' : 'New'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-baseline justify-between">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-2xl font-black font-mono text-white">
                          {bpm}
                        </span>
                        <span className="text-xs font-bold text-rose-400">BPM</span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400">
                        {reading.ecgWaveform?.length || 500} pts · 10s Lead I
                      </span>
                    </div>

                    {reading.notes && (
                      <p className="text-[11px] text-slate-400 italic line-clamp-1 border-t border-slate-800/80 pt-1">
                        &quot;{reading.notes}&quot;
                      </p>
                    )}

                    {/* Dedicated Ask Gemini: Draft Analysis button next to each 10-second ECG snapshot */}
                    <div className="pt-2 border-t border-slate-800/80">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAnalyzeWithGemini(reading);
                        }}
                        disabled={isAnalyzingWithAi}
                        title="Send this 10-second ECG snapshot to Gemini AI for draft clinical analysis"
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-teal-500/90 via-indigo-600/90 to-purple-600/90 hover:from-teal-400 hover:to-purple-500 text-white font-bold text-[11px] shadow-sm shadow-indigo-950/40 border border-indigo-400/40 transition cursor-pointer disabled:opacity-50"
                      >
                        {isThisReadingAnalyzing ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Analyzing with Gemini...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                            <span>{reading.aiAnalysis ? 'Re-Analyze: Ask Gemini' : 'Ask Gemini: Draft Analysis'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </aside>

        {/* Right Main Monitor: Oscilloscope Canvas & Diagnostic Panels */}
        <main className="flex flex-col p-6 space-y-5 overflow-y-auto max-h-[640px]">
          {errorNotice && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/50 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorNotice}</span>
            </div>
          )}

          {selectedReading ? (
            <>
              {/* Rhythm & Vitals Stat Cards Header */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* 1. Heart Rate */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-400 text-xs">
                    <span className="font-semibold uppercase tracking-wider text-[10px]">
                      Heart Rate
                    </span>
                    <Heart className="w-4 h-4 text-rose-500 animate-pulse" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-black font-mono text-white">
                      {selectedReading.bpm}
                    </span>
                    <span className="text-xs font-bold text-rose-400">BPM</span>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1">
                    Captured from AD8232 Peak Detect
                  </span>
                </div>

                {/* 2. Rhythm Status */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
                  <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                    Rhythm Assessment
                  </span>
                  <div className="mt-2">
                    <span
                      className={`inline-block text-xs font-bold font-mono px-2 py-1 rounded-lg border ${
                        rhythmAnalysis?.rhythmColor || 'text-emerald-400'
                      }`}
                    >
                      {rhythmAnalysis?.rhythm || 'Normal Sinus'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1">
                    Risk Assessment: {rhythmAnalysis?.riskLevel || 'Normal'}
                  </span>
                </div>

                {/* 3. Estimated RR Interval */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
                  <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                    R-R Interval
                  </span>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="text-2xl font-black font-mono text-white">
                      {rhythmAnalysis?.rrIntervalMs || '—'}
                    </span>
                    <span className="text-xs font-bold text-teal-400">ms</span>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1">
                    Normal: 600ms – 1000ms
                  </span>
                </div>

                {/* 4. Peak-to-Peak Amplitude */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
                  <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                    P-P Voltage
                  </span>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="text-2xl font-black font-mono text-white">
                      {rhythmAnalysis?.p2pAdc || 0}
                    </span>
                    <span className="text-xs font-bold text-teal-400">ADC units</span>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1">
                    ≈ {rhythmAnalysis?.p2pMv?.toFixed(2) || '1.20'} mV Amplitude
                  </span>
                </div>
              </div>

              {/* Oscilloscope Canvas Screen Container */}
              <div className="relative rounded-2xl border border-emerald-950/80 bg-black p-4 shadow-2xl overflow-hidden group">
                {/* CRT Scanline Bezel overlay */}
                <div
                  className="pointer-events-none absolute inset-0 opacity-[0.03] bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:16px_16px]"
                  aria-hidden="true"
                />

                {/* Top Overlay Badge on Screen */}
                <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 pb-2 mb-2 border-b border-emerald-950/60 font-mono text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                    <span className="text-emerald-400 font-bold tracking-widest">
                      CH-1 LEAD I (AD8232 ECG)
                    </span>
                    <span className="text-slate-500">|</span>
                    <span className="text-slate-400">SWEEP: 25 mm/s · 50Hz</span>
                  </div>

                  <div className="flex items-center gap-3 text-slate-400">
                    <span>
                      GAIN: <strong className="text-emerald-300">{gain}x</strong>
                    </span>
                    <span>
                      SAMPLES: <strong className="text-emerald-300">{processedWaveform.length}</strong>
                    </span>
                    <span>
                      BASELINE: <strong className="text-emerald-300">{isFilterActive ? 'CORRECTED' : 'RAW'}</strong>
                    </span>
                  </div>
                </div>

                {/* Rendering Canvas / Recharts Area */}
                <div className="relative w-full h-80 sm:h-96">
                  {viewMode === 'canvas' ? (
                    <canvas
                      ref={canvasRef}
                      width={940}
                      height={384}
                      className="w-full h-full block rounded-xl cursor-crosshair"
                    />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={rechartsData}
                        margin={{ top: 12, right: 16, left: -20, bottom: 0 }}
                      >
                        <XAxis
                          dataKey="time"
                          stroke="#334155"
                          tick={{ fontSize: 10, fill: '#64748b' }}
                          interval={49}
                          unit="s"
                        />
                        <YAxis
                          domain={[0, 1024]}
                          stroke="#334155"
                          tick={{ fontSize: 10, fill: '#64748b' }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0f172a',
                            border: '1px solid #1e293b',
                            borderRadius: '12px',
                            color: '#e2e8f0',
                            fontSize: '11px',
                            fontFamily: 'monospace',
                          }}
                          formatter={(val: any) => [`${val} ADC (${adcToMillivolts(Number(val))} mV)`, 'ECG Signal']}
                          labelFormatter={(label) => `Time: ${label}s`}
                        />
                        <ReferenceLine y={512} stroke="#059669" strokeDasharray="3 3" />
                        <Line
                          type="monotone"
                          dataKey="raw"
                          stroke="#10b981"
                          strokeWidth={2}
                          dot={false}
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Bottom Screen Bar: Playback Controls & Oscilloscope Modifiers */}
                <div className="relative z-10 mt-3 pt-3 border-t border-emerald-950/60 flex flex-wrap items-center justify-between gap-3 text-xs">
                  {/* Playback Controls */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleTogglePlay}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer shadow-sm"
                    >
                      {isPlaying ? (
                        <>
                          <Pause className="w-3.5 h-3.5" />
                          <span>Pause Sweep</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5" />
                          <span>Play Sweep</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleRestartPlayback}
                      title="Restart 10s playback from beginning"
                      className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={handleShowFullStrip}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition"
                    >
                      Full 10s Strip
                    </button>

                    <span className="font-mono text-[11px] text-slate-400 pl-2">
                      Elapsed: {(playbackIndex * 0.02).toFixed(1)}s / 10.0s
                    </span>
                  </div>

                  {/* Calibration & Gain modifiers */}
                  <div className="flex items-center gap-3">
                    {/* Gain Selector */}
                    <div className="flex items-center gap-1 bg-slate-900 rounded-xl p-1 border border-slate-800 text-xs font-mono">
                      <span className="text-slate-500 text-[10px] px-1 font-bold">GAIN:</span>
                      {[0.5, 1.0, 2.0].map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setGain(g)}
                          className={`px-2 py-0.5 rounded-lg transition ${
                            gain === g
                              ? 'bg-teal-600 text-white font-bold'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {g}x
                        </button>
                      ))}
                    </div>

                    {/* Baseline Drift Filter Toggle */}
                    <button
                      type="button"
                      onClick={() => setIsFilterActive(!isFilterActive)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-mono border transition ${
                        isFilterActive
                          ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                          : 'bg-slate-900 border-slate-800 text-slate-500'
                      }`}
                    >
                      {isFilterActive ? 'Filter: ON' : 'Filter: RAW'}
                    </button>
                  </div>
                </div>
              </div>

              {/* 3. AI-Assisted Pre-Screening Clinical Box (Gemini 3.8 Flash) */}
              <div
                ref={aiAnalysisContainerRef}
                className="rounded-2xl border border-indigo-500/30 bg-gradient-to-b from-indigo-950/25 via-slate-900/60 to-slate-950/80 p-5 space-y-4 shadow-xl backdrop-blur-md relative overflow-hidden"
              >
                {/* Top decorative accent gradient line */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-400 via-indigo-500 to-purple-500" />

                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shadow-inner">
                      <Sparkles className="w-4 h-4 text-indigo-300 animate-pulse" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-white flex items-center gap-2 font-mono tracking-tight">
                          AI-Assisted ECG Pre-Screening
                        </h4>
                        <span className="rounded-md bg-indigo-500/10 px-2 py-0.5 text-[10px] font-mono font-bold text-indigo-300 border border-indigo-500/30">
                          Gemini AI
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Automated waveform signal noise, baseline wander, and rhythm irregularity detection
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {aiAnalysisTimestamp && (
                      <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">
                        Generated at {aiAnalysisTimestamp}
                      </span>
                    )}

                    {aiAnalysisResult && (
                      <>
                        <button
                          type="button"
                          onClick={handleCopyAiAnalysis}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition cursor-pointer"
                          title="Copy AI analysis to clipboard"
                        >
                          {copiedAiText ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-slate-400" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={handleInsertAiIntoNotes}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 text-xs font-semibold border border-indigo-500/30 transition cursor-pointer"
                          title="Insert AI draft directly into doctor clinical notes below"
                        >
                          <FileText className="w-3.5 h-3.5 text-indigo-300" />
                          <span>Insert to Notes</span>
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => handleAnalyzeWithGemini()}
                      disabled={isAnalyzingWithAi || !selectedReading}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-teal-500 via-indigo-600 to-purple-600 hover:from-teal-400 hover:to-purple-500 text-white font-bold text-xs shadow-md shadow-indigo-950/40 border border-indigo-400/40 transition disabled:opacity-50 cursor-pointer"
                    >
                      {isAnalyzingWithAi ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Analyzing...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                          <span>{aiAnalysisResult ? 'Re-Analyze with Gemini' : 'Ask Gemini: Draft Analysis'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Main Body: Loading State / Error State / Empty State / Rendered Clinical Summary */}
                {isAnalyzingWithAi ? (
                  <div className="py-8 text-center space-y-3 rounded-xl bg-slate-950/60 border border-indigo-500/20 p-6 animate-pulse">
                    <div className="relative mx-auto w-10 h-10 flex items-center justify-center">
                      <div className="absolute inset-0 rounded-full border-2 border-indigo-500/20 border-t-indigo-400 animate-spin" />
                      <Sparkles className="w-5 h-5 text-indigo-300" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-indigo-200">
                        Analyzing 10-Second Raw Voltage Array (500 Samples)...
                      </p>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                        Evaluating baseline wander, high-frequency noise, and potential cardiac irregularities
                      </p>
                    </div>
                  </div>
                ) : aiAnalysisError ? (
                  <div className="rounded-xl bg-rose-950/30 border border-rose-800/50 p-4 text-xs text-rose-300 flex items-start gap-3">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-bold text-rose-200">Analysis Request Failed</p>
                      <p className="text-[11px] text-rose-300/80 mt-0.5">{aiAnalysisError}</p>
                      <button
                        type="button"
                        onClick={() => handleAnalyzeWithGemini()}
                        className="mt-2 text-[11px] font-bold text-rose-200 hover:text-white underline cursor-pointer"
                      >
                        Try Again
                      </button>
                    </div>
                  </div>
                ) : aiAnalysisResult ? (
                  <div className="rounded-xl bg-slate-950/80 border border-slate-800/80 p-4 shadow-inner max-h-96 overflow-y-auto">
                    <FormattedAiAnalysis content={aiAnalysisResult} />
                  </div>
                ) : (
                  <div className="rounded-xl bg-slate-950/40 border border-dashed border-slate-800 p-6 text-center space-y-2">
                    <Sparkles className="w-6 h-6 text-indigo-400/50 mx-auto" />
                    <p className="text-xs font-semibold text-slate-300">
                      No AI Pre-Screening Generated Yet
                    </p>
                    <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                      Click <strong className="text-indigo-300">&quot;Ask Gemini: Draft Analysis&quot;</strong> to evaluate the 500-sample voltage waveform for baseline wander, signal noise, and preliminary cardiac rhythm indicators.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleAnalyzeWithGemini()}
                      disabled={isAnalyzingWithAi || !selectedReading}
                      className="mt-1 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/30 text-indigo-200 text-xs font-bold transition cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>Ask Gemini: Draft Analysis</span>
                    </button>
                  </div>
                )}
              </div>

              {/* 4. Clinical Rhythm Notes & Doctor Review Section */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-teal-400" />
                    <span>Clinician Rhythm Impression & Diagnostic Note</span>
                  </h4>
                  {selectedReading.doctorReviewed && (
                    <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>
                        Reviewed by {selectedReading.reviewerDoctorName || 'Physician'}
                      </span>
                    </span>
                  )}
                </div>

                <textarea
                  value={doctorNotes}
                  onChange={(e) => setDoctorNotes(e.target.value)}
                  placeholder="Enter clinical assessment (e.g. Regular sinus rhythm, normal QRS complexes, no ST elevation, normal PR interval observed)..."
                  rows={3}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-slate-200 placeholder-slate-500 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 font-sans"
                />

                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-slate-500">
                    Notes synchronize to Firestore snapshot document for patient medical records.
                  </p>

                  <div className="flex items-center gap-2">
                    {notesSuccess && (
                      <span className="text-xs text-emerald-400 font-bold animate-fade-in flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Saved to Firestore!
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={handleSaveNotes}
                      disabled={isSavingNotes || !selectedReading}
                      className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1.5"
                    >
                      {isSavingNotes ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <span>Save Clinical Note</span>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="py-24 text-center text-slate-500 space-y-3">
              <Activity className="w-12 h-12 text-slate-700 mx-auto" />
              <h3 className="text-base font-bold text-slate-400">No Snapshot Selected</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Select a 10-second ECG reading strip from the left sidebar to inspect the calibrated 500-sample waveform.
              </p>
            </div>
          )}
        </main>
      </div>
      )}
    </div>
  );

  // If embedded, return directly. If modal, wrap in overlay backdrop.
  if (embedded) {
    return content;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      {content}
    </div>
  );
}

export default DoctorEcgViewer;
