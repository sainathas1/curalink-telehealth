'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  HeartPulse,
  ArrowLeft,
  AlertTriangle,
  Radio,
  Video,
  Shield,
  Activity,
  User,
} from 'lucide-react';
import { UserProfile, LiveTelemetryPayload } from '../../lib/types';

interface MobileTopAppBarProps {
  currentUser: UserProfile | null;
  telemetry: LiveTelemetryPayload;
  onEmergencySOS: () => void;
  activeCriticalAlertsCount?: number;
}

export function MobileTopAppBar({
  currentUser,
  telemetry,
  onEmergencySOS,
  activeCriticalAlertsCount = 0,
}: MobileTopAppBarProps) {
  const router = useRouter();
  const pathname = usePathname();

  // Determine if on subroute that should show a Back button
  const isSubroute =
    pathname.includes('/patient/device') ||
    pathname.includes('/patient/prescriptions') ||
    pathname.includes('/patient/records');

  // Dynamic screen title based on route
  const getScreenTitle = () => {
    if (pathname.includes('/patient/vitals')) return 'Vitals Monitor';
    if (pathname.includes('/patient/appointments')) return 'Appointments';
    if (pathname.includes('/patient/profile')) return 'My Profile';
    if (pathname.includes('/patient/device')) return 'Connected Devices';
    if (pathname.includes('/patient/prescriptions')) return 'Prescriptions & Rx';
    if (pathname.includes('/patient/records')) return 'Medical Records';
    if (pathname.includes('/doctor/records')) return 'Medical Records & Vault';
    return 'CuraLink Health';
  };

  const getScreenSubtitle = () => {
    if (pathname.includes('/patient/vitals')) {
      return telemetry.heartRate > 0 ? 'Live IoT Stream' : 'Sensor Standby';
    }
    if (pathname.includes('/patient/appointments')) return 'HD Video Consultations';
    if (pathname.includes('/patient/profile')) return currentUser?.fullName || 'Verified Patient';
    if (pathname.includes('/patient/device')) return 'Web Serial USB Probe';
    return 'Continuous Telemetry';
  };

  return (
    <header
      role="banner"
      aria-label="Mobile Application Bar"
      className="md:hidden sticky top-0 z-30 bg-slate-900/95 backdrop-blur-xl border-b border-slate-800 text-white shadow-md transition-all select-none"
      style={{
        paddingTop: 'max(0.6rem, env(safe-area-inset-top, 0px))',
      }}
    >
      <div className="px-4 py-2.5 flex items-center justify-between gap-3">
        {/* Leading Item: Back button on subroutes, or brand avatar on root routes */}
        <div className="flex items-center gap-2.5 min-w-0">
          {isSubroute ? (
            <button
              onClick={() => router.back()}
              aria-label="Go back"
              className="w-9 h-9 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-200 flex items-center justify-center transition-all m3-pressable cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-5 h-5 text-teal-400" />
            </button>
          ) : (
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-500 flex items-center justify-center text-white shadow-xs shrink-0">
              <HeartPulse className="w-5 h-5 animate-pulse" />
            </div>
          )}

          <div className="min-w-0">
            <h1 className="text-base font-black tracking-tight text-white truncate leading-tight">
              {getScreenTitle()}
            </h1>
            <p className="text-[11px] text-teal-300 font-medium truncate flex items-center gap-1">
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  telemetry.status === 'critical'
                    ? 'bg-rose-500 animate-ping'
                    : telemetry.status === 'elevated'
                    ? 'bg-amber-400'
                    : 'bg-emerald-400'
                }`}
              />
              <span className="truncate">{getScreenSubtitle()}</span>
            </p>
          </div>
        </div>

        {/* Trailing Actions: Live Vitals Chip + Emergency SOS */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Live Vitals Pill */}
          {telemetry.heartRate > 0 && (
            <div
              onClick={() => router.push('/patient/vitals')}
              className="px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/80 text-[11px] font-mono font-bold text-teal-300 flex items-center gap-1.5 m3-pressable cursor-pointer shadow-xs"
              title="View live vitals stream"
            >
              <Activity className="w-3.5 h-3.5 text-teal-400 animate-pulse" />
              <span>{telemetry.heartRate} BPM</span>
            </div>
          )}

          {/* Quick SOS Trigger Button */}
          <button
            onClick={onEmergencySOS}
            aria-label="Trigger Emergency SOS"
            className="px-3 py-1.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-950/60 transition-all m3-pressable flex items-center gap-1.5 cursor-pointer"
          >
            <AlertTriangle className="w-3.5 h-3.5 animate-pulse" />
            <span className="text-[11px] font-extrabold uppercase tracking-wider">SOS</span>
          </button>
        </div>
      </div>
    </header>
  );
}
