'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTelehealth } from '../../../context/TelehealthContext';
import {
  User,
  ShieldCheck,
  Phone,
  Mail,
  Heart,
  Activity,
  AlertTriangle,
  LogOut,
  ChevronRight,
  Settings,
  Bell,
  Volume2,
  VolumeX,
  Thermometer,
  Usb,
  FileText,
  Pill,
  Sparkles,
  Smartphone,
  CheckCircle2,
  Calendar,
} from 'lucide-react';

export default function PatientProfileRoute() {
  const router = useRouter();
  const {
    currentUser,
    telemetry,
    temperatureUnit,
    toggleTemperatureUnit,
    audioAlertsEnabled,
    setAudioAlertsEnabled,
    openEmergencySOS,
    handleLogout,
    toggleRole,
  } = useTelehealth();

  const [notificationState, setNotificationState] = useState(true);

  const patientName = currentUser?.fullName || 'Sarah Jenkins';
  const patientEmail = currentUser?.email || 'patient@curalink.health';
  const patientPhone = currentUser?.phoneNumber || '+1 (555) 382-9012';

  return (
    <div className="space-y-5 max-w-2xl mx-auto pb-6">
      {/* Material 3 Top Profile Header Card */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-teal-950 text-white rounded-3xl p-6 shadow-md border border-slate-700/60 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex items-center gap-4">
          {/* Avatar with M3 rounded pill badge */}
          <div className="relative shrink-0">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-teal-500 to-emerald-400 p-0.5 shadow-md">
              <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center text-white font-bold text-xl">
                {patientName.charAt(0)}
              </div>
            </div>
            <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-emerald-500 border-2 border-slate-900" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white truncate">{patientName}</h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-400/30 shrink-0">
                Patient ID: #PX-9824
              </span>
            </div>
            <p className="text-xs text-slate-300 truncate mt-0.5 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-teal-400 shrink-0" />
              <span>{patientEmail}</span>
            </p>
            <p className="text-xs text-slate-300 truncate mt-0.5 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-teal-400 shrink-0" />
              <span>{patientPhone}</span>
            </p>
          </div>
        </div>

        {/* Live Telemetry Health Strip */}
        <div className="mt-5 pt-4 border-t border-slate-700/60 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                telemetry.status === 'critical'
                  ? 'bg-rose-500 animate-ping'
                  : telemetry.status === 'elevated'
                  ? 'bg-amber-500'
                  : 'bg-emerald-500 animate-pulse'
              }`}
            />
            <span className="font-medium">Wearable Biosensor:</span>
            <span className="font-bold text-white font-mono">
              {telemetry.heartRate > 0 ? `${telemetry.heartRate} BPM | ${telemetry.spo2}%` : 'Standby'}
            </span>
          </div>

          <span className="text-[11px] font-bold text-teal-300 bg-teal-900/50 px-2 py-0.5 rounded-full border border-teal-700/50">
            HIPAA Verified
          </span>
        </div>
      </div>

      {/* Emergency Contact & Quick Triage Card */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Emergency & Triage Contact</h2>
              <p className="text-[11px] text-slate-500">Immediate hospital & doctor escalation</p>
            </div>
          </div>
          <button
            onClick={openEmergencySOS}
            className="px-3.5 py-1.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm transition-all m3-pressable flex items-center gap-1.5 cursor-pointer"
          >
            <span>Trigger SOS</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs pt-1">
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Primary Doctor</span>
            <span className="font-bold text-slate-800 text-xs">Dr. Michael Chen, MD</span>
            <span className="text-[11px] text-teal-700 block">Cardiology Department</span>
          </div>
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Emergency Contact</span>
            <span className="font-bold text-slate-800 text-xs">David Jenkins (Spouse)</span>
            <span className="text-[11px] text-slate-500 block font-mono">+1 (555) 234-8765</span>
          </div>
        </div>
      </div>

      {/* Health Profile Metrics Card */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center">
            <Activity className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-bold text-slate-900">Clinical Health Vitals Profile</h2>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Blood Group</span>
            <span className="text-sm font-black text-slate-900 mt-0.5 block">O+ Positive</span>
          </div>
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Height / Weight</span>
            <span className="text-sm font-black text-slate-900 mt-0.5 block">172 cm / 68 kg</span>
          </div>
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Allergies</span>
            <span className="text-sm font-black text-rose-600 mt-0.5 block">Penicillin</span>
          </div>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1">
          Patient Records & Devices
        </h3>

        <div className="bg-white rounded-3xl border border-slate-200/80 divide-y divide-slate-100 shadow-xs overflow-hidden">
          <button
            onClick={() => router.push('/patient/device')}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors m3-pressable cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center">
                <Usb className="w-5 h-5" />
              </div>
              <div>
                <span className="text-sm font-bold text-slate-900 block">Connected Devices</span>
                <span className="text-xs text-slate-500">USB Serial Thermometer & Biosensor</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>

          <button
            onClick={() => router.push('/patient/prescriptions')}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors m3-pressable cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <Pill className="w-5 h-5" />
              </div>
              <div>
                <span className="text-sm font-bold text-slate-900 block">Prescriptions & Rx</span>
                <span className="text-xs text-slate-500">Digitally signed active medications</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>

          <button
            onClick={() => router.push('/patient/records')}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors m3-pressable cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <span className="text-sm font-bold text-slate-900 block">Medical Records</span>
                <span className="text-xs text-slate-500">Lab test diagnostics & PDF summaries</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>

          <button
            onClick={() => router.push('/patient/appointments')}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors m3-pressable cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <span className="text-sm font-bold text-slate-900 block">Consultation Visits</span>
                <span className="text-xs text-slate-500">HD video appointments & schedule</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>

      {/* App Preferences & Native Bridge Settings */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1">
          Preferences & Native App Controls
        </h3>

        <div className="bg-white rounded-3xl border border-slate-200/80 divide-y divide-slate-100 shadow-xs overflow-hidden">
          {/* Temperature Unit Preference */}
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center">
                <Thermometer className="w-4 h-4" />
              </div>
              <div>
                <span className="text-sm font-bold text-slate-900 block">Temperature Unit</span>
                <span className="text-xs text-slate-500">Currently {temperatureUnit === 'C' ? 'Celsius (°C)' : 'Fahrenheit (°F)'}</span>
              </div>
            </div>
            <button
              onClick={toggleTemperatureUnit}
              className="px-3.5 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all m3-pressable cursor-pointer"
            >
              Switch to {temperatureUnit === 'C' ? '°F' : '°C'}
            </button>
          </div>

          {/* Audio Alert Chimes */}
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center">
                {audioAlertsEnabled ? <Volume2 className="w-4 h-4 text-teal-600" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
              </div>
              <div>
                <span className="text-sm font-bold text-slate-900 block">Vital Alert Chimes</span>
                <span className="text-xs text-slate-500">Audible warnings on arrhythmia or fever</span>
              </div>
            </div>
            <button
              onClick={() => setAudioAlertsEnabled(!audioAlertsEnabled)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all m3-pressable cursor-pointer ${
                audioAlertsEnabled
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {audioAlertsEnabled ? 'Enabled' : 'Muted'}
            </button>
          </div>

          {/* Android Native Status Bar Bridge indicator */}
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <span className="text-sm font-bold text-slate-900 block">Native Android Bridge</span>
                <span className="text-xs text-slate-500">Dark status bar & Hardware back active</span>
              </div>
            </div>
            <span className="text-[11px] font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200">
              Active
            </span>
          </div>
        </div>
      </div>

      {/* Account Actions: Switch Mode & Logout */}
      <div className="pt-2 space-y-3">
        <button
          onClick={handleLogout}
          className="w-full py-3 px-4 rounded-2xl border border-rose-200 text-rose-700 hover:bg-rose-50 font-bold text-xs transition-all m3-pressable flex items-center justify-center gap-2 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out of Patient Account</span>
        </button>

        <p className="text-center text-[10px] text-slate-400 font-mono">
          CuraLink TeleCare Mobile v2.4 • Android Material 3 Edition
        </p>
      </div>
    </div>
  );
}
