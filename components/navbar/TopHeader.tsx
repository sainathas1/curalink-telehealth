'use client';

import React from 'react';
import { UserProfile, UserRole, LiveTelemetryPayload } from '../../lib/types';
import {
  HeartPulse,
  Stethoscope,
  User,
  Radio,
  Sliders,
  LogOut,
  Bell,
  Cpu,
  ShieldCheck,
} from 'lucide-react';

interface TopHeaderProps {
  currentUser: UserProfile | null;
  role: UserRole;
  onToggleRole: () => void;
  onLogout: () => void;
  onOpenAuth: () => void;
  telemetry: LiveTelemetryPayload;
  isSimulating: boolean;
  onToggleSimulatorDrawer: () => void;
  onOpenHardwareGuide: () => void;
  activeCriticalAlertsCount?: number;
}

export function TopHeader({
  currentUser,
  role,
  onToggleRole,
  onLogout,
  onOpenAuth,
  telemetry,
  isSimulating,
  onToggleSimulatorDrawer,
  onOpenHardwareGuide,
  activeCriticalAlertsCount = 0,
}: TopHeaderProps) {
  const isDoctor = role?.toLowerCase() === 'doctor';

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 py-3 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-teal-600 via-teal-700 to-emerald-800 flex items-center justify-center text-white shadow-md shadow-teal-700/20">
            <HeartPulse className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-black tracking-tight text-slate-900">
                Cura<span className="text-teal-600">Link</span>
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200/80">
                Telehealth
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
              Continuous IoT Monitoring & Virtual Care
            </p>
          </div>
        </div>

        {/* Center / IoT Hardware Status */}
        <div className="hidden md:flex items-center gap-2 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/70 text-xs">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-white shadow-xs">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                telemetry.status === 'critical'
                  ? 'bg-rose-500 animate-ping'
                  : telemetry.status === 'elevated'
                  ? 'bg-amber-500'
                  : 'bg-emerald-500 animate-pulse'
              }`}
            />
            <span className="font-semibold text-slate-700 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-teal-600" />
              {isDoctor ? (isSimulating ? 'ESP32 Simulator' : 'Physical Sensor') : 'Wearable Sensor'}
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              ({telemetry.heartRate} BPM | {telemetry.spo2}%)
            </span>
          </div>

          {/* Clinician Hardware & Simulator controls: restricted to Doctor */}
          {isDoctor && (
            <>
              <button
                onClick={onToggleSimulatorDrawer}
                className="px-2.5 py-1 text-slate-600 hover:text-teal-700 hover:bg-white rounded-xl transition-all font-medium flex items-center gap-1 cursor-pointer"
                title="Adjust live sensor readings & test tachycardia/fever alarms"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Simulate</span>
              </button>

              <button
                onClick={onOpenHardwareGuide}
                className="px-2.5 py-1 text-slate-600 hover:text-teal-700 hover:bg-white rounded-xl transition-all font-medium flex items-center gap-1 cursor-pointer"
                title="ESP32 C++ Code & Hardware Wiring Guide"
              >
                <Cpu className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">ESP32 Code</span>
              </button>
            </>
          )}
        </div>

        {/* Right Actions & Persona Badge */}
        <div className="flex items-center gap-2.5">
          {/* Locked Role Badge (Role is strictly tied to account) */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200/80 text-xs font-bold text-slate-700 shadow-2xs">
            {isDoctor ? (
              <>
                <Stethoscope className="w-3.5 h-3.5 text-teal-600" />
                <span>Doctor Portal</span>
              </>
            ) : (
              <>
                <User className="w-3.5 h-3.5 text-teal-600" />
                <span>Patient Portal</span>
              </>
            )}
          </div>


          {/* Alarm Notifications indicator */}
          {activeCriticalAlertsCount > 0 && (
            <div className="relative">
              <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center animate-bounce">
                <Bell className="w-4 h-4" />
              </div>
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center">
                {activeCriticalAlertsCount}
              </span>
            </div>
          )}

          {/* User Profile / Auth Button */}
          {currentUser ? (
            <div className="flex items-center gap-2 pl-1">
              <div className="hidden sm:block text-right">
                <p className="text-xs font-bold text-slate-800 leading-tight">
                  {currentUser.fullName}
                </p>
                <p className="text-[10px] text-teal-600 font-semibold flex items-center justify-end gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  {currentUser.role?.toLowerCase() === 'doctor' ? currentUser.specialty || 'Clinician' : 'Verified Patient'}
                </p>
              </div>

              <button
                onClick={onLogout}
                className="w-9 h-9 rounded-xl border border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 flex items-center justify-center transition-colors cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-sm shadow-teal-600/20 transition-all cursor-pointer"
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
