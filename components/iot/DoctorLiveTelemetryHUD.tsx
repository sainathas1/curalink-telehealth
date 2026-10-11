'use client';

import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { Heart, Activity, AlertTriangle, CheckCircle2, Radio } from 'lucide-react';

export interface DoctorLiveTelemetryHUDProps {
  appointmentId: string;
  patientName?: string;
  isDoctor?: boolean;
  onViewWaveform?: () => void;
  className?: string;
}

export function DoctorLiveTelemetryHUD({
  appointmentId,
  patientName = 'Patient',
  isDoctor = true,
  onViewWaveform,
  className = '',
}: DoctorLiveTelemetryHUDProps) {
  const [telemetry, setTelemetry] = useState<{
    bpm: number;
    leadsOff: boolean;
    timestamp?: any;
  } | null>(null);
  const [hasReceivedData, setHasReceivedData] = useState(false);
  const [isActivelyReceiving, setIsActivelyReceiving] = useState(false);
  const [lastReceivedAt, setLastReceivedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!appointmentId || !isDoctor) return;

    // Listen to exact Firestore telemetry path: appointments/{appointmentId}/telemetry/live
    const docRef = doc(db, 'appointments', appointmentId, 'telemetry', 'live');
    const unsubscribe = onSnapshot(
      docRef,
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

          setTelemetry({
            bpm: parsedBpm,
            leadsOff: parsedLeadsOff,
            timestamp: data.timestamp,
          });
          setHasReceivedData(true);
          setLastReceivedAt(Date.now());
          setIsActivelyReceiving(true);
        }
      },
      (err) => {
        console.warn('Doctor telemetry listener error:', err.message);
      }
    );

    return () => unsubscribe();
  }, [appointmentId, isDoctor]);

  // Heartbeat check: updates active receiving state based on timestamp or local receive time
  useEffect(() => {
    if (!hasReceivedData) return;

    const timer = setInterval(() => {
      let tsMillis = lastReceivedAt;
      if (telemetry?.timestamp) {
        if (typeof telemetry.timestamp.toMillis === 'function') {
          tsMillis = telemetry.timestamp.toMillis();
        } else if (typeof telemetry.timestamp.seconds === 'number') {
          tsMillis = telemetry.timestamp.seconds * 1000;
        } else if (telemetry.timestamp instanceof Date) {
          tsMillis = telemetry.timestamp.getTime();
        }
      }

      if (tsMillis) {
        const diffSeconds = (Date.now() - tsMillis) / 1000;
        setIsActivelyReceiving(diffSeconds <= 6); // within 6s considered live streaming
      } else {
        setIsActivelyReceiving(false);
      }
    }, 1500);

    return () => clearInterval(timer);
  }, [telemetry?.timestamp, lastReceivedAt, hasReceivedData]);

  if (!isDoctor || !hasReceivedData || !telemetry) {
    return null;
  }

  const isLeadsOff = telemetry.leadsOff;

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border ${
        isLeadsOff
          ? 'border-amber-300 bg-amber-50/90 text-amber-950'
          : isActivelyReceiving
          ? 'border-teal-200/90 bg-teal-50/80 text-teal-950'
          : 'border-slate-200 bg-slate-50 text-slate-800'
      } p-3.5 shadow-xs backdrop-blur-xs transition-all ${className}`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex size-8 shrink-0 items-center justify-center rounded-xl ${
            isLeadsOff
              ? 'bg-amber-600 text-white'
              : isActivelyReceiving
              ? 'bg-teal-600 text-white'
              : 'bg-slate-600 text-white'
          }`}
        >
          <Activity className="size-4" />
        </span>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold">
              {patientName ? `${patientName}'s Live ECG Telemetry` : 'Live Patient ECG Telemetry'}
            </span>
            {isActivelyReceiving ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-300 px-2 py-0.5 text-[9px] font-bold text-emerald-800">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-ping" />
                Live Stream
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-200/80 px-2 py-0.5 text-[9px] font-medium text-slate-600">
                Paused
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            doc(db, &apos;appointments&apos;, &apos;{appointmentId.slice(0, 8)}...&apos;, &apos;telemetry&apos;, &apos;live&apos;)
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3 font-mono text-xs">
        {/* Heart Rate Indicator */}
        <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-1.5 shadow-2xs border border-slate-200/80">
          <Heart
            className={`size-3.5 ${
              isActivelyReceiving ? 'text-rose-500 fill-rose-500 animate-pulse' : 'text-slate-400'
            }`}
          />
          <span className="text-slate-500 text-[10px] font-sans">BPM:</span>
          <span className="font-bold text-slate-900 text-sm">
            {telemetry.bpm > 0 ? Math.round(telemetry.bpm) : '—'}
          </span>
        </div>

        {/* Leads Status Badge */}
        <div
          className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 border font-sans text-xs font-semibold ${
            isLeadsOff
              ? 'bg-rose-100/80 border-rose-300 text-rose-800 animate-pulse'
              : 'bg-emerald-100/80 border-emerald-300 text-emerald-800'
          }`}
        >
          {isLeadsOff ? (
            <>
              <AlertTriangle className="size-3.5 text-rose-600" />
              <span className="text-[11px] font-bold">Leads Off</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="size-3.5 text-emerald-600" />
              <span className="text-[11px] font-bold">Leads Attached</span>
            </>
          )}
        </div>

        {/* View Waveform action */}
        {onViewWaveform && (
          <button
            type="button"
            onClick={onViewWaveform}
            className="rounded-xl bg-teal-700 hover:bg-teal-800 text-white px-3 py-1.5 text-xs font-semibold transition active:scale-[0.98] shadow-2xs cursor-pointer font-sans"
          >
            View Waveform
          </button>
        )}
      </div>
    </div>
  );
}

export default DoctorLiveTelemetryHUD;
