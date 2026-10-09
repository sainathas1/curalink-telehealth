'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Activity, AlertTriangle, Menu } from 'lucide-react';
import type { UserProfile, LiveTelemetryPayload } from '../../lib/types';

interface MobileTopAppBarProps {
  currentUser: UserProfile | null;
  telemetry: LiveTelemetryPayload;
  onEmergencySOS: () => void;
  activeCriticalAlertsCount?: number;
  onOpenDrawer?: () => void;
}

export function MobileTopAppBar({ currentUser, telemetry, onEmergencySOS, onOpenDrawer }: MobileTopAppBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const screenTitles: Record<string, string> = { vitals: 'Health monitoring', appointments: 'Appointments', profile: 'My profile', device: 'Connected devices', prescriptions: 'Prescriptions', records: 'Medical records' };
  const route = pathname.split('/')[2];
  const title = screenTitles[route] || 'Your care';
  const isConnected = telemetry.sensorConnected;

  return (
    <header aria-label="Patient application bar" className="sticky top-0 z-30 select-none border-b border-slate-200 bg-white/95 backdrop-blur-xl md:hidden" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div className="flex min-h-[68px] items-center justify-between gap-2 px-4 select-none">
        <div className="flex min-w-0 items-center gap-3">
          {onOpenDrawer && <button type="button" onClick={onOpenDrawer} aria-label="Open navigation" aria-haspopup="dialog" className="select-none flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-teal-600"><Menu size={22} aria-hidden="true" /></button>}
          <div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">{title}</p><p className="mt-0.5 truncate text-[11px] text-slate-400">{route === 'dashboard' ? currentUser?.fullName || 'CuraLink' : 'CuraLink patient portal'}</p></div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isConnected && telemetry.heartRate > 0 && <button type="button" onClick={() => router.push('/patient/vitals')} aria-label={`View vitals, heart rate ${telemetry.heartRate} beats per minute`} className="select-none flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-2 text-[10px] font-semibold text-teal-800 focus-visible:outline-2 focus-visible:outline-teal-600"><Activity size={13} aria-hidden="true" />{telemetry.heartRate} bpm</button>}
          <button type="button" onClick={onEmergencySOS} aria-label="Open emergency help" className="select-none flex min-h-10 items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-2.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 focus-visible:outline-2 focus-visible:outline-rose-600"><AlertTriangle size={15} aria-hidden="true" /><span>SOS</span></button>
        </div>
      </div>
    </header>
  );
}
