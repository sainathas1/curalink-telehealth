'use client';

import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { Heart, Thermometer, Radio, Activity } from 'lucide-react';

interface DoctorLiveTelemetryHUDProps {
  appointmentId: string;
  isDoctor?: boolean;
  className?: string;
}

export function DoctorLiveTelemetryHUD({
  appointmentId,
  isDoctor = false,
  className = '',
}: DoctorLiveTelemetryHUDProps) {
  const [telemetry, setTelemetry] = useState<{ temp: number; bpm: number; timestamp?: any } | null>(
    null
  );
  const [hasReceivedData, setHasReceivedData] = useState(false);

  useEffect(() => {
    if (!appointmentId || !isDoctor) return;

    const docRef = doc(db, 'appointments', appointmentId, 'telemetry', 'live');
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (typeof data.temp !== 'undefined' || typeof data.bpm !== 'undefined') {
            setTelemetry({
              temp: Number(data.temp || 0),
              bpm: Number(data.bpm || 0),
              timestamp: data.timestamp,
            });
            setHasReceivedData(true);
          }
        }
      },
      (err) => {
        console.warn('Doctor telemetry listener error:', err.message);
      }
    );

    return () => unsubscribe();
  }, [appointmentId, isDoctor]);

  if (!isDoctor || !hasReceivedData || !telemetry) {
    return null;
  }

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-teal-200/60 bg-teal-50/70 p-3 shadow-xs backdrop-blur-xs ${className}`}
    >
      <div className="flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-lg bg-teal-600 text-white">
          <Activity className="size-4" />
        </span>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-teal-950">Patient USB Biometric Stream</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-teal-200/80 px-1.5 py-0.2 text-[9px] font-bold text-teal-900">
              <span className="size-1 rounded-full bg-emerald-500 animate-ping" />
              Live Feed
            </span>
          </div>
          <span className="text-[10px] text-teal-800">Direct Arduino USB sensor telemetry</span>
        </div>
      </div>

      <div className="flex items-center gap-3 font-mono text-xs">
        <div className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 shadow-xs border border-teal-100">
          <Thermometer className="size-3.5 text-amber-500" />
          <span className="text-slate-500 text-[10px]">TEMP:</span>
          <span className="font-bold text-slate-800">{telemetry.temp.toFixed(1)}°C</span>
        </div>

        <div className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 shadow-xs border border-teal-100">
          <Heart className="size-3.5 text-rose-500 fill-rose-500 animate-pulse" />
          <span className="text-slate-500 text-[10px]">HR:</span>
          <span className="font-bold text-slate-800">{Math.round(telemetry.bpm)} BPM</span>
        </div>
      </div>
    </div>
  );
}

export default DoctorLiveTelemetryHUD;
