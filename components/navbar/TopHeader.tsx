'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Bell, Cpu, HeartPulse, LogOut, Menu, Sliders, Stethoscope, User } from 'lucide-react';
import type { UserProfile, UserRole, LiveTelemetryPayload } from '../../lib/types';
import { getNavigation, type ActiveTab } from './navigation';
import { MobileDrawer } from './MobileDrawer';

interface TopHeaderProps {
  currentUser: UserProfile | null;
  role: UserRole;
  onLogout: () => void;
  onOpenAuth: () => void;
  telemetry: LiveTelemetryPayload;
  isSimulating: boolean;
  onToggleSimulatorDrawer: () => void;
  onOpenHardwareGuide: () => void;
  activeCriticalAlertsCount?: number;
  activeTab?: ActiveTab;
  onSelectTab?: (tab: ActiveTab) => void;
  onEmergencySOS?: () => void;
}

export function TopHeader({ currentUser, role, onLogout, onOpenAuth, telemetry, isSimulating, onToggleSimulatorDrawer, onOpenHardwareGuide, activeCriticalAlertsCount = 0, activeTab, onSelectTab, onEmergencySOS }: TopHeaderProps) {
  const isDoctor = role.toLowerCase() === 'doctor';
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const hasReadings = telemetry.sensorConnected || isSimulating;
  const title = getNavigation(role).find((item) => item.id === activeTab)?.label;
  const initials = (currentUser?.fullName || 'U').split(' ').filter(Boolean).slice(0, 2).map((name) => name[0]).join('');

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl">
        <div className="flex min-h-[77px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => setIsMobileDrawerOpen(true)} aria-label="Open navigation" aria-haspopup="dialog" aria-expanded={isMobileDrawerOpen} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-teal-600 md:hidden"><Menu size={21} aria-hidden="true" /></button>
            <Link href="/" aria-label="CuraLink home" className="flex items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-600"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700 text-white shadow-sm"><HeartPulse size={22} aria-hidden="true" /></span><span className="hidden text-xl font-bold tracking-tight text-slate-900 sm:block">Cura<span className="text-teal-700">Link</span></span></Link>
            <span className="mx-2 hidden h-7 w-px bg-slate-200 lg:block" aria-hidden="true" />
            <div className="min-w-0 lg:ml-0"><p className="truncate text-sm font-semibold text-slate-800">{title || (isDoctor ? 'Doctor portal' : 'Patient portal')}</p><p className="mt-0.5 hidden text-[11px] text-slate-400 lg:block">{isDoctor ? 'Your connected clinical workspace' : 'Your health, all in one place'}</p></div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-[11px] font-medium text-slate-500 xl:flex"><span className={`h-1.5 w-1.5 rounded-full ${isSimulating ? 'bg-amber-500' : telemetry.sensorConnected ? 'bg-teal-500' : 'bg-slate-300'}`} aria-hidden="true" />{isSimulating ? 'Demo readings' : telemetry.sensorConnected ? 'Device connected' : 'Device offline'}{hasReadings && <span className="border-l border-slate-200 pl-2 text-slate-700">{telemetry.heartRate} bpm</span>}</div>
            {isDoctor && <div className="hidden items-center gap-1 md:flex"><button type="button" onClick={onToggleSimulatorDrawer} aria-label="Open sensor simulator" title="Sensor simulator" className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-teal-700 focus-visible:outline-2 focus-visible:outline-teal-600"><Sliders size={18} aria-hidden="true" /></button><button type="button" onClick={onOpenHardwareGuide} aria-label="Open device setup guide" title="Device setup guide" className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-teal-700 focus-visible:outline-2 focus-visible:outline-teal-600"><Cpu size={18} aria-hidden="true" /></button></div>}
            <span className="hidden items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1.5 text-[11px] font-medium text-slate-500 lg:flex">{isDoctor ? <Stethoscope size={13} aria-hidden="true" /> : <User size={13} aria-hidden="true" />}{isDoctor ? 'Doctor' : 'Patient'}</span>
            {activeCriticalAlertsCount > 0 && <button type="button" aria-label={`View ${activeCriticalAlertsCount} critical alerts`} onClick={() => onSelectTab?.(isDoctor ? 'ward-telemetry' : 'vitals')} className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600 focus-visible:outline-2 focus-visible:outline-rose-600"><Bell size={18} aria-hidden="true" /><span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] text-white">{activeCriticalAlertsCount}</span></button>}
            {!isDoctor && (
              <a
                href="tel:8788246552"
                aria-label="Direct dial Superadmin Emergency Hotline 8788246552"
                title="Superadmin Emergency Hotline: 8788246552"
                className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-bold text-rose-700 hover:bg-rose-100 transition-colors shadow-2xs"
              >
                <span className="hidden sm:inline">SOS:</span>
                <span>8788246552</span>
              </a>
            )}
            {currentUser ? <div className="flex items-center gap-2 border-l border-slate-200 pl-3 sm:gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-50 text-xs font-semibold text-teal-800">{initials}</span><div className="hidden max-w-36 sm:block"><p className="truncate text-xs font-semibold text-slate-800">{currentUser.fullName}</p><p className="mt-0.5 truncate text-[10px] text-slate-400">{isDoctor ? currentUser.specialty || 'Clinician' : 'My account'}</p></div><button type="button" onClick={onLogout} aria-label="Sign out" title="Sign out" className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-2 focus-visible:outline-teal-600"><LogOut size={16} aria-hidden="true" /></button></div> : <button type="button" onClick={onOpenAuth} className="care-button text-xs">Sign in</button>}
          </div>
        </div>
      </header>
      <MobileDrawer isOpen={isMobileDrawerOpen} onClose={() => setIsMobileDrawerOpen(false)} role={role} activeTab={activeTab || (isDoctor ? 'clinical-queue' : 'overview')} onSelectTab={(tab) => { onSelectTab?.(tab); setIsMobileDrawerOpen(false); }} currentUser={currentUser} onLogout={onLogout} onOpenAuth={onOpenAuth} onEmergencySOS={onEmergencySOS} activeAlertCount={activeCriticalAlertsCount} />
    </>
  );
}
