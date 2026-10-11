'use client';

import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  Heart,
  Activity,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Thermometer,
} from 'lucide-react';

export interface PatientVitalsCardProps {
  appointmentId: string;
  className?: string;
}

interface TelemetryState {
  bpm: number | null;
  leadsOff: boolean | null;
  temp: number | null;
  timestamp: any;
}

/**
 * Helper to safely extract milliseconds from various Firestore timestamp formats
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
  // Local state with incoming bpm, leadsOff, and timestamp in real-time
  const [telemetry, setTelemetry] = useState<TelemetryState>({
    bpm: null,
    leadsOff: null,
    temp: null,
    timestamp: null,
  });

  const [isActivelyReceiving, setIsActivelyReceiving] = useState<boolean>(false);
  const [lastReceivedAt, setLastReceivedAt] = useState<number | null>(null);

  // Listen to doc(db, 'appointments', appointmentId, 'telemetry', 'live')
  useEffect(() => {
    if (!appointmentId) return;

    const docRef = doc(db, 'appointments', appointmentId, 'telemetry', 'live');
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();

          const parsedBpm =
            typeof data?.bpm === 'number'
              ? data.bpm
              : typeof data?.bpm === 'string'
              ? parseFloat(data.bpm)
              : null;

          const parsedLeadsOff =
            typeof data?.leadsOff === 'boolean'
              ? data.leadsOff
              : typeof data?.leadsOff === 'string'
              ? data.leadsOff === 'true'
              : null;

          const parsedTemp =
            typeof data?.temp === 'number'
              ? data.temp
              : typeof data?.temp === 'string'
              ? parseFloat(data.temp)
              : null;

          setTelemetry({
            bpm: parsedBpm,
            leadsOff: parsedLeadsOff,
            temp: parsedTemp,
            timestamp: data?.timestamp ?? null,
          });

          setLastReceivedAt(Date.now());
          setIsActivelyReceiving(true);
        }
      },
      (error) => {
        console.warn('Patient Vitals onSnapshot error:', error);
      }
    );

    return () => unsubscribe();
  }, [appointmentId]);

  // Visual indicator that tracks active updates based on Firestore timestamp
  useEffect(() => {
    const timer = setInterval(() => {
      const tsMillis = getTimestampMillis(telemetry.timestamp) || lastReceivedAt;
      if (tsMillis) {
        const diffSeconds = (Date.now() - tsMillis) / 1000;
        // Active stream updates every 2s; consider active if updated within last 5 seconds
        setIsActivelyReceiving(diffSeconds <= 5);
      } else {
        setIsActivelyReceiving(false);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [telemetry.timestamp, lastReceivedAt]);

  const hasData = telemetry.bpm !== null || telemetry.leadsOff !== null;
  const isLeadsOff = telemetry.leadsOff === true;

  return (
    <div
      className={`rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-sm backdrop-blur-xs transition-all ${className}`}
    >
      {/* Header with Title and Pulsing Indicator */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div
            className={`flex size-8 items-center justify-center rounded-lg transition-colors ${
              isActivelyReceiving ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            <Activity className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 leading-tight">Patient Vitals</h3>
            <p className="text-[11px] text-slate-500">AD8232 ECG Telemetry Channel</p>
          </div>
        </div>

        {/* Pulsing Green Dot Active Indicator */}
        <div
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${
            isActivelyReceiving
              ? 'bg-emerald-50 border border-emerald-200/70 text-emerald-700'
              : 'bg-slate-100 border border-slate-200 text-slate-500'
          }`}
        >
          {isActivelyReceiving ? (
            <>
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              <span>Live Receiving</span>
            </>
          ) : (
            <>
              <span className="size-2 rounded-full bg-slate-400" />
              <span>{hasData ? 'Stream Paused' : 'Standby'}</span>
            </>
          )}
        </div>
      </div>

      {/* Vitals Grid Display */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        {/* Heart Rate (BPM) Tile */}
        <div className="rounded-xl border border-rose-200/60 bg-rose-50/60 p-3 transition-colors">
          <div className="flex items-center gap-1.5 text-rose-700 mb-1">
            <Heart
              className={`size-4 ${isActivelyReceiving ? 'fill-rose-500 animate-pulse' : ''}`}
            />
            <span className="text-[10px] font-bold uppercase tracking-wider">Heart Rate</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-black font-mono tracking-tight text-rose-950">
              {telemetry.bpm !== null ? Math.round(telemetry.bpm) : '--'}
            </span>
            <span className="text-xs font-semibold text-rose-700">BPM</span>
          </div>
          <p className="mt-0.5 text-[10px] text-rose-800/80 font-medium">
            {telemetry.bpm !== null
              ? telemetry.bpm >= 100
                ? 'Tachycardia alert'
                : telemetry.bpm < 60
                ? 'Bradycardia alert'
                : 'Normal sinus rhythm'
              : 'Awaiting sensor stream'}
          </p>
        </div>

        {/* ECG Lead Status Tile */}
        <div
          className={`rounded-xl border p-3 transition-colors ${
            isLeadsOff
              ? 'border-amber-300 bg-amber-50/70 text-amber-900'
              : telemetry.leadsOff === false
              ? 'border-emerald-200/60 bg-emerald-50/60 text-emerald-900'
              : 'border-slate-200 bg-slate-50 text-slate-700'
          }`}
        >
          <div className="flex items-center gap-1.5 mb-1">
            {isLeadsOff ? (
              <AlertTriangle className="size-4 text-amber-600 animate-bounce" />
            ) : telemetry.leadsOff === false ? (
              <CheckCircle2 className="size-4 text-emerald-600" />
            ) : (
              <Activity className="size-4 text-slate-400" />
            )}
            <span className="text-[10px] font-bold uppercase tracking-wider">
              {telemetry.temp !== null && telemetry.leadsOff === null
                ? 'Temperature'
                : 'ECG Leads'}
            </span>
          </div>

          <div className="flex items-baseline gap-1">
            {telemetry.leadsOff !== null ? (
              <span
                className={`text-sm font-black tracking-tight ${
                  isLeadsOff ? 'text-amber-800' : 'text-emerald-800'
                }`}
              >
                {isLeadsOff ? 'LEADS OFF' : 'ATTACHED'}
              </span>
            ) : telemetry.temp !== null ? (
              <>
                <span className="text-xl font-black font-mono tracking-tight text-amber-950">
                  {telemetry.temp.toFixed(1)}
                </span>
                <span className="text-xs font-semibold text-amber-700">°C</span>
              </>
            ) : (
              <span className="text-sm font-bold text-slate-400">STANDBY</span>
            )}
          </div>

          <p className="mt-0.5 text-[10px] text-slate-500 font-medium">
            {isLeadsOff
              ? 'Electrodes detached'
              : telemetry.leadsOff === false
              ? 'Signal nominal'
              : 'Awaiting device'}
          </p>
        </div>
      </div>

      {/* Footer Status Message */}
      <div className="mt-3 flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-100 pt-2 font-mono">
        <span className="flex items-center gap-1">
          <Clock className="size-3 text-slate-400" />
          <span>Sync: Every 2s</span>
        </span>
        <span className="text-slate-400">
          {telemetry.timestamp
            ? 'Broadcasted via Firestore live channel'
            : 'Waiting for patient USB connection'}
        </span>
      </div>
    </div>
  );
}

export default PatientVitalsCard;
