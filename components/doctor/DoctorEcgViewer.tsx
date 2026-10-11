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
}: DoctorEcgViewerProps) {
  const { doctorAppointmentsQueue = [], currentUser } = useTelehealth();

  // Selected appointment ID state (defaults to prop or first queue appointment)
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string>(
    propAppointmentId || doctorAppointmentsQueue[0]?.id || ''
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
  const [aiAnalysisResult, setAiAnalysisResult] = useState<string | null>(null);
  const [aiAnalysisError, setAiAnalysisError] = useState<string | null>(null);
  const [aiAnalysisTimestamp, setAiAnalysisTimestamp] = useState<string | null>(null);
  const [copiedAiText, setCopiedAiText] = useState<boolean>(false);

  // Canvas Reference
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Sync prop appointment change
  useEffect(() => {
    if (propAppointmentId) {
      setSelectedAppointmentId(propAppointmentId);
    }
  }, [propAppointmentId]);

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

  // Sync doctor notes & AI analysis when selected reading changes
  useEffect(() => {
    if (selectedReading) {
      setDoctorNotes(selectedReading.notes || '');
      setNotesSuccess(false);
      setPlaybackIndex(selectedReading.ecgWaveform?.length || 500);
      setIsPlaying(false);
      setAiAnalysisResult(selectedReading.aiAnalysis || null);
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
  }, [selectedReading]);

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
  const handleAnalyzeWithGemini = async () => {
    if (!selectedReading || !selectedReading.ecgWaveform || selectedReading.ecgWaveform.length === 0) {
      setAiAnalysisError('No ECG waveform data available to analyze.');
      return;
    }

    setIsAnalyzingWithAi(true);
    setAiAnalysisError(null);

    try {
      const response = await fetch('/api/analyze-ecg', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ecgWaveform: selectedReading.ecgWaveform,
          bpm: selectedReading.bpm,
          patientName: effectivePatientName,
          durationSeconds: selectedReading.durationSeconds || 10,
          samplingRateHz: selectedReading.samplingRateHz || 50,
          leadType: selectedReading.leadType || 'Lead I (AD8232)',
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to analyze ECG with Gemini.');
      }

      setAiAnalysisResult(data.analysis);
      setAiAnalysisTimestamp(
        new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );

      // Persist analysis to Firestore reading document if reading has an ID
      if (selectedAppointmentId && selectedReading.id) {
        try {
          const readingDocRef = doc(
            db,
            'appointments',
            selectedAppointmentId,
            'saved_readings',
            selectedReading.id
          );
          await updateDoc(readingDocRef, {
            aiAnalysis: data.analysis,
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
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold tracking-tight text-white truncate">
                Clinical ECG Diagnostics
              </h2>
              <span className="rounded-md bg-teal-500/10 px-2 py-0.5 text-[10px] font-mono font-bold text-teal-300 border border-teal-500/30">
                AD8232 · 50Hz
              </span>
            </div>
            <p className="text-xs text-slate-400 truncate flex items-center gap-2 mt-0.5">
              <span>Patient: <strong className="text-slate-200">{effectivePatientName}</strong></span>
              <span className="text-slate-600">·</span>
              <span className="font-mono text-slate-400">Apt: #{selectedAppointmentId.slice(0, 10)}</span>
            </p>
          </div>
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

          {/* Ask Gemini: Draft Analysis */}
          <button
            type="button"
            onClick={handleAnalyzeWithGemini}
            disabled={isAnalyzingWithAi || !selectedReading}
            title="Request AI-assisted preliminary ECG pre-screening from Gemini"
            className="flex h-9 items-center gap-1.5 px-3 rounded-xl bg-gradient-to-r from-teal-500 via-indigo-600 to-purple-600 hover:from-teal-400 hover:to-purple-500 text-white text-xs font-bold border border-indigo-400/30 shadow-md shadow-indigo-950/40 disabled:opacity-50 transition cursor-pointer"
          >
            {isAnalyzingWithAi ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span className="hidden sm:inline">Analyzing...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Ask Gemini: Draft Analysis</span>
              </>
            )}
          </button>

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

      {/* 2. Main Body Grid: Sidebar Snapshots List + Main Oscilloscope Monitor */}
      <div className="grid grid-cols-1 lg:grid-cols-[310px_minmax(0,1fr)] flex-1 overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-slate-800">
        {/* Left Sidebar: Saved Snapshots History */}
        <aside className="flex flex-col bg-slate-900/40 p-4 overflow-y-auto max-h-[260px] lg:max-h-[640px] space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-teal-400" />
              <span>Patient 10s Strips</span>
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
            <div className="space-y-2">
              {savedReadings.map((reading, idx) => {
                const isSelected = selectedReading?.id === reading.id;
                const millis = toMillis(reading.timestamp);
                const bpm = reading.bpm || 0;

                return (
                  <button
                    key={reading.id}
                    type="button"
                    onClick={() => setSelectedReading(reading)}
                    className={`w-full text-left p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col gap-2 ${
                      isSelected
                        ? 'bg-teal-950/40 border-teal-500/60 shadow-lg shadow-teal-950/30 ring-1 ring-teal-500/40'
                        : 'bg-slate-900/60 border-slate-800/90 hover:bg-slate-800/70 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono text-slate-400">
                        {formatTime(millis)}
                      </span>
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

                    <div className="flex items-baseline justify-between">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-2xl font-black font-mono text-white">
                          {bpm}
                        </span>
                        <span className="text-xs font-bold text-rose-400">BPM</span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400">
                        {reading.ecgWaveform?.length || 500} pts · 10s
                      </span>
                    </div>

                    {reading.notes && (
                      <p className="text-[11px] text-slate-400 italic line-clamp-1 border-t border-slate-800/80 pt-1">
                        &quot;{reading.notes}&quot;
                      </p>
                    )}
                  </button>
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

                    {/* Ask Gemini: Draft Analysis button next to chart */}
                    <button
                      type="button"
                      onClick={handleAnalyzeWithGemini}
                      disabled={isAnalyzingWithAi || !selectedReading}
                      title="Request AI-assisted preliminary ECG pre-screening from Gemini"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-teal-500 via-indigo-600 to-purple-600 hover:from-teal-400 hover:to-purple-500 text-white font-bold text-xs shadow-md shadow-indigo-950/40 border border-indigo-400/40 transition cursor-pointer disabled:opacity-50"
                    >
                      {isAnalyzingWithAi ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Analyzing...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                          <span>Ask Gemini: Draft Analysis</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* 3. AI-Assisted Pre-Screening Clinical Box (Gemini 3.8 Flash) */}
              <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-b from-indigo-950/25 via-slate-900/60 to-slate-950/80 p-5 space-y-4 shadow-xl backdrop-blur-md relative overflow-hidden">
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
                      onClick={handleAnalyzeWithGemini}
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
                        onClick={handleAnalyzeWithGemini}
                        className="mt-2 text-[11px] font-bold text-rose-200 hover:text-white underline cursor-pointer"
                      >
                        Try Again
                      </button>
                    </div>
                  </div>
                ) : aiAnalysisResult ? (
                  <div className="rounded-xl bg-slate-950/80 border border-slate-800/80 p-4 shadow-inner">
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
                      onClick={handleAnalyzeWithGemini}
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
