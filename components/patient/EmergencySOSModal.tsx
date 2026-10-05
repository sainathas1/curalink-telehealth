'use client';

import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  PhoneCall,
  X,
  ShieldAlert,
  Ambulance,
  CheckCircle2,
} from 'lucide-react';
import { LiveTelemetryPayload } from '../../lib/types';

interface EmergencySOSModalProps {
  isOpen: boolean;
  onClose: () => void;
  telemetry: LiveTelemetryPayload;
  patientName?: string;
}

export function EmergencySOSModal({
  isOpen,
  onClose,
  telemetry,
  patientName = 'Patient',
}: EmergencySOSModalProps) {
  const [countdown, setCountdown] = useState(5);
  const [isDispatched, setIsDispatched] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isOpen && !isDispatched) {
      setCountdown(5);
      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            setIsDispatched(true);
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isOpen, isDispatched]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-rose-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full border-4 border-rose-500 shadow-2xl overflow-hidden text-xs">
        {/* Top Header */}
        <div className="bg-rose-600 text-white p-6 text-center relative">
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3 animate-ping">
            <AlertTriangle className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-xl font-black uppercase tracking-tight">
            Emergency Medical SOS
          </h3>
          <p className="text-xs text-rose-100 mt-1">
            Immediate Clinical Triage & 911 Ambulance Dispatch Protocol
          </p>

          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {!isDispatched ? (
            <div className="text-center space-y-3">
              <p className="text-sm font-bold text-slate-900">
                Dispatching emergency telemetry in:
              </p>
              <div className="text-5xl font-black font-mono text-rose-600 animate-pulse">
                00:0{countdown}
              </div>
              <p className="text-slate-500">
                Transmitting current physiological vitals to Dr. Vance and nearest emergency room.
              </p>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-all cursor-pointer"
              >
                Cancel Dispatch (False Alarm)
              </button>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900">Emergency Protocol Active</h4>
                <p className="text-slate-500 mt-0.5">
                  Telemetry transmitted. On-call cardiologist and ambulance dispatch notified.
                </p>
              </div>

              {/* Vitals Snapshot */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 font-mono flex items-center justify-around text-slate-800">
                <div>
                  <span className="text-[10px] text-slate-400 block font-sans">HR</span>
                  <span className="font-bold text-rose-600">{telemetry.heartRate} BPM</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-sans">SPO2</span>
                  <span className="font-bold text-cyan-600">{telemetry.spo2}%</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-sans">TEMP</span>
                  <span className="font-bold text-amber-600">{telemetry.temperature}°C</span>
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <a
                  href="tel:911"
                  className="w-full py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-rose-900/40 transition-all"
                >
                  <PhoneCall className="w-4 h-4 animate-bounce" />
                  <span>Call Emergency 911 Now</span>
                </a>
                <button
                  onClick={onClose}
                  className="w-full py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold"
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
