'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  Stethoscope,
  User,
  Cpu,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Heart,
  Droplets,
  Thermometer,
  Calendar,
  Pill,
  Clock,
  Video,
  AlertTriangle,
  Play,
  RotateCw,
} from 'lucide-react';

export function LiveInteractiveSandbox() {
  const [activeTab, setActiveTab] = useState<'patient' | 'doctor' | 'hardware'>('doctor');

  return (
    <section id="interactive-sandbox" className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto relative z-10">
      <div className="text-center max-w-3xl mx-auto mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-300 text-xs font-mono font-bold uppercase tracking-widest mb-4">
          <Activity className="w-3.5 h-3.5 text-teal-400" />
          Interactive Live Sandbox
        </div>
        <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
          Experience Both Sides of <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 via-emerald-400 to-cyan-400">
            CuraLink in Real-Time
          </span>
        </h2>
        <p className="mt-4 text-sm sm:text-base text-slate-400 leading-relaxed">
          Switch between the Clinician Ward Command Center, the Patient Telehealth Hub, and the Hardware Terminal right here.
        </p>

        {/* Tab Switcher Pills */}
        <div className="mt-8 inline-flex p-1.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
          <button
            onClick={() => setActiveTab('doctor')}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'doctor'
                ? 'bg-teal-500 text-slate-950 shadow-lg shadow-teal-500/30'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Stethoscope className="w-4 h-4" />
            <span>Doctor Ward HUD</span>
          </button>

          <button
            onClick={() => setActiveTab('patient')}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'patient'
                ? 'bg-teal-500 text-slate-950 shadow-lg shadow-teal-500/30'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Patient TeleCare Hub</span>
          </button>

          <button
            onClick={() => setActiveTab('hardware')}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'hardware'
                ? 'bg-teal-500 text-slate-950 shadow-lg shadow-teal-500/30'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>ESP32 Hardware Stream</span>
          </button>
        </div>
      </div>

      {/* Sandbox Display Box */}
      <div className="rounded-3xl border border-white/20 bg-slate-950/85 backdrop-blur-2xl p-6 sm:p-8 shadow-2xl shadow-black/80">
        {/* DOCTOR VIEW PREVIEW */}
        {activeTab === 'doctor' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
              <div>
                <span className="text-xs font-mono font-bold text-teal-400 uppercase tracking-wider">
                  CLINICAL WORKSPACE
                </span>
                <h3 className="text-xl font-bold text-white mt-1">Multi-Patient Ward Surveillance</h3>
              </div>

              <Link
                href="/doctor/dashboard"
                className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 self-start"
              >
                <span>Open Full Doctor Portal</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Simulated 3 Patient Beds */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Bed 1 */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-slate-400">BED 01 • ROOM 302</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                    STABLE
                  </span>
                </div>
                <h4 className="text-sm font-bold text-white">Eleanor Vance (Age 64)</h4>
                <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono bg-black/40 p-2 rounded-xl">
                  <div>
                    <span className="text-[10px] text-slate-400 block">HR</span>
                    <span className="font-bold text-white">72 bpm</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">SpO2</span>
                    <span className="font-bold text-white">99%</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">TEMP</span>
                    <span className="font-bold text-white">36.7°C</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link
                    href="/doctor/ehr"
                    className="flex-1 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold text-center"
                  >
                    EHR Note
                  </Link>
                  <Link
                    href="/call/consult-302"
                    className="py-1.5 px-3 rounded-lg bg-teal-500/20 text-teal-300 hover:bg-teal-500/30 text-[11px] font-bold text-center flex items-center justify-center"
                  >
                    <Video className="w-3 h-3" />
                  </Link>
                </div>
              </div>

              {/* Bed 2 (Elevated) */}
              <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-amber-400">BED 02 • ROOM 304</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 animate-pulse">
                    TACHYCARDIA
                  </span>
                </div>
                <h4 className="text-sm font-bold text-white">Marcus Sterling (Age 48)</h4>
                <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono bg-black/40 p-2 rounded-xl">
                  <div>
                    <span className="text-[10px] text-slate-400 block">HR</span>
                    <span className="font-bold text-amber-400">128 bpm</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">SpO2</span>
                    <span className="font-bold text-white">96%</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">TEMP</span>
                    <span className="font-bold text-amber-400">38.4°C</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link
                    href="/doctor/ehr"
                    className="flex-1 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-[11px] font-bold text-center"
                  >
                    Prescribe Rx
                  </Link>
                  <Link
                    href="/call/consult-304"
                    className="py-1.5 px-3 rounded-lg bg-teal-500/20 text-teal-300 hover:bg-teal-500/30 text-[11px] font-bold text-center flex items-center justify-center"
                  >
                    <Video className="w-3 h-3" />
                  </Link>
                </div>
              </div>

              {/* Bed 3 */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-slate-400">BED 03 • TELEMETRY</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                    STABLE
                  </span>
                </div>
                <h4 className="text-sm font-bold text-white">Amina Patel (Age 32)</h4>
                <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono bg-black/40 p-2 rounded-xl">
                  <div>
                    <span className="text-[10px] text-slate-400 block">HR</span>
                    <span className="font-bold text-white">68 bpm</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">SpO2</span>
                    <span className="font-bold text-white">99%</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">TEMP</span>
                    <span className="font-bold text-white">36.6°C</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link
                    href="/doctor/ehr"
                    className="flex-1 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold text-center"
                  >
                    EHR Note
                  </Link>
                  <Link
                    href="/call/consult-306"
                    className="py-1.5 px-3 rounded-lg bg-teal-500/20 text-teal-300 hover:bg-teal-500/30 text-[11px] font-bold text-center flex items-center justify-center"
                  >
                    <Video className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PATIENT VIEW PREVIEW */}
        {activeTab === 'patient' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
              <div>
                <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider">
                  PATIENT EXPERIENCE
                </span>
                <h3 className="text-xl font-bold text-white mt-1">Personal Telehealth & Vital Signs Center</h3>
              </div>

              <Link
                href="/patient/dashboard"
                className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 self-start"
              >
                <span>Launch Patient Portal</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>NEXT CONSULTATION</span>
                  <Calendar className="w-4 h-4 text-teal-400" />
                </div>
                <h4 className="text-base font-bold text-white">Dr. Sarah Jenkins</h4>
                <p className="text-xs text-teal-400">Cardiology Review</p>
                <div className="text-[11px] font-mono text-slate-400 pt-2 border-t border-white/5 flex items-center justify-between">
                  <span>Today at 03:30 PM</span>
                  <Link href="/call/demo-consultation" className="text-teal-400 font-bold hover:underline">
                    Join Call
                  </Link>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>ACTIVE MEDICATIONS</span>
                  <Pill className="w-4 h-4 text-emerald-400" />
                </div>
                <h4 className="text-base font-bold text-white">Atorvastatin 20mg</h4>
                <p className="text-xs text-slate-300">1 Tablet Daily at Bedtime</p>
                <div className="text-[11px] font-mono text-emerald-400 pt-2 border-t border-white/5">
                  Verified Digital Prescription • Active
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>HARDWARE SYNC</span>
                  <Cpu className="w-4 h-4 text-cyan-400" />
                </div>
                <h4 className="text-base font-bold text-white">ESP32 USB / BLE</h4>
                <p className="text-xs text-slate-300">Skin Temp: 36.8°C • Synced to Cloud</p>
                <div className="text-[11px] font-mono text-cyan-400 pt-2 border-t border-white/5">
                  <Link href="/patient/device" className="hover:underline">
                    Connect USB Device →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* HARDWARE VIEW PREVIEW */}
        {activeTab === 'hardware' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
              <div>
                <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider">
                  EMBEDDED HARDWARE TERMINAL
                </span>
                <h3 className="text-xl font-bold text-white mt-1">ESP32 Firmware Stream & Web Serial</h3>
              </div>

              <Link
                href="/patient/device"
                className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 self-start"
              >
                <span>Launch Serial Terminal</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="rounded-2xl bg-black border border-white/10 p-4 font-mono text-xs space-y-1.5 overflow-x-auto text-slate-300">
              <p className="text-teal-400">[ESP32-BOOT] Initializing FreeRTOS dual-core MCU @ 240MHz...</p>
              <p className="text-slate-400">[I2C-INIT] Scanning bus... MAX30102 detected at 0x57. DS18B20 at OneWire GPIO 4.</p>
              <p className="text-emerald-400">[WIFI-CONNECTED] IP: 192.168.1.142 | RSSI: -54 dBm | UDP Socket Active.</p>
              <p className="text-cyan-300">[FIREBASE-STREAM] TLS 1.3 Handshake completed. Broadcasting payload:</p>
              <p className="text-slate-200">
                {`{"deviceId":"ESP32-BIO-NODE-01","heartRate":72,"spo2":99,"temperature":36.8,"timestamp":${Date.now()}}`}
              </p>
              <p className="text-teal-400">[STATUS-200] Realtime payload confirmed by Firestore cloud relay in 28ms.</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
