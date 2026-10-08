'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Video,
  Mic,
  Camera,
  PhoneOff,
  ShieldCheck,
  Activity,
  Heart,
  Droplets,
  Sparkles,
  ArrowRight,
  User,
  Stethoscope,
} from 'lucide-react';

export function TelehealthVideoPreview3D() {
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState(false);

  return (
    <section id="telehealth-video" className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto relative z-10">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Left Column: Copy & Details */}
        <div className="lg:col-span-5 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-mono font-bold uppercase tracking-widest">
            <Video className="w-3.5 h-3.5 text-cyan-400" />
            Zero-Plugin Telehealth
          </div>

          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
            Next-Gen Virtual Care <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400">
              With Live Vitals Injection
            </span>
          </h2>

          <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
            Clinicians no longer consult blind. During high-definition WebRTC video sessions, live biomedical telemetry (BPM, SpO2, Temperature, Blood Pressure) streams straight into the clinician's viewport.
          </p>

          <ul className="space-y-3.5 text-xs sm:text-sm text-slate-300">
            <li className="flex items-center gap-2.5">
              <span className="w-5 h-5 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center shrink-0">
                ✓
              </span>
              <span>Ultra-low latency WebRTC peer connection powered by Jitsi & Daily</span>
            </li>
            <li className="flex items-center gap-2.5">
              <span className="w-5 h-5 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center shrink-0">
                ✓
              </span>
              <span>In-call clinical notes & one-click digital e-prescribing</span>
            </li>
            <li className="flex items-center gap-2.5">
              <span className="w-5 h-5 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center shrink-0">
                ✓
              </span>
              <span>End-to-end encryption compliant with HIPAA & GDPR telemedicine rules</span>
            </li>
          </ul>

          <div className="pt-4 flex flex-wrap items-center gap-4">
            <Link
              href="/call/demo-consultation"
              className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-slate-950 font-black text-xs sm:text-sm shadow-xl shadow-teal-500/30 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Video className="w-4 h-4" />
              <span>Launch Live Consultation Room</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href="/doctor/dashboard"
              className="px-5 py-3.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm border border-white/10 transition-all"
            >
              Doctor Appointments Queue
            </Link>
          </div>
        </div>

        {/* Right Column: 3D Holographic Video Room Preview */}
        <div className="lg:col-span-7 perspective-1500">
          <div className="relative rounded-3xl border border-white/20 bg-slate-950/90 backdrop-blur-2xl p-4 sm:p-6 shadow-2xl shadow-cyan-950/60 preserve-3d">
            {/* Ambient Background Aura */}
            <div className="absolute -inset-4 bg-cyan-500/15 rounded-3xl blur-2xl -z-10 pointer-events-none" />

            {/* Room Header Bar */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-mono font-bold text-white">
                  ROOM #CURA-SECURE-902
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  AES-256 ENCRYPTED
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
                <span>1080p 60fps</span>
              </div>
            </div>

            {/* Main Video Viewport (Simulated Consultation) */}
            <div className="relative rounded-2xl bg-slate-900 border border-white/10 overflow-hidden aspect-video shadow-inner">
              {/* Simulated Doctor Feed Background */}
              <div className="absolute inset-0 bg-gradient-to-tr from-slate-950 via-slate-900 to-teal-950/60 flex items-center justify-center">
                <div className="text-center space-y-3">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-teal-600 to-emerald-600 flex items-center justify-center text-white mx-auto shadow-2xl shadow-teal-500/30">
                    <Stethoscope className="w-10 h-10" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white">Dr. Sarah Jenkins, MD</h4>
                    <p className="text-xs text-teal-400 font-mono">Attending Cardiologist • Live Consultation</p>
                  </div>
                </div>
              </div>

              {/* In-Call Live Telemetry HUD Overlay in Bottom Left */}
              <div className="absolute bottom-4 left-4 z-20 bg-slate-950/80 backdrop-blur-md border border-white/10 rounded-2xl p-3 shadow-xl">
                <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-teal-400 mb-1.5">
                  <Activity className="w-3 h-3 animate-pulse" />
                  <span>PATIENT LIVE VITALS HUD</span>
                </div>
                <div className="flex items-center gap-3 text-xs font-mono">
                  <div className="flex items-center gap-1 text-rose-400">
                    <Heart className="w-3.5 h-3.5 animate-bounce" />
                    <span className="font-bold text-white">74</span>
                    <span className="text-[10px] text-slate-400">BPM</span>
                  </div>
                  <div className="flex items-center gap-1 text-cyan-400">
                    <Droplets className="w-3.5 h-3.5" />
                    <span className="font-bold text-white">99%</span>
                  </div>
                  <div className="flex items-center gap-1 text-emerald-400">
                    <span className="font-bold text-white">98.6°F</span>
                  </div>
                </div>
              </div>

              {/* Floating Self-View (Patient Pip in Top Right) */}
              <div className="absolute top-4 right-4 z-20 w-32 sm:w-40 aspect-video rounded-xl bg-slate-950 border border-white/20 shadow-2xl overflow-hidden flex items-center justify-center">
                <div className="text-center">
                  <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 mx-auto mb-1">
                    <User className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-300">You (Patient)</span>
                </div>
                <span className="absolute bottom-1 right-2 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
            </div>

            {/* Bottom In-Call Controls Bar */}
            <div className="mt-4 pt-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsAudioMuted(!isAudioMuted)}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                    isAudioMuted
                      ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                      : 'bg-white/10 text-white border-white/10 hover:bg-white/20'
                  }`}
                  title="Toggle Microphone"
                >
                  <Mic className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setIsVideoDisabled(!isVideoDisabled)}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                    isVideoDisabled
                      ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                      : 'bg-white/10 text-white border-white/10 hover:bg-white/20'
                  }`}
                  title="Toggle Camera"
                >
                  <Camera className="w-4 h-4" />
                </button>
              </div>

              {/* End Call Simulated Button */}
              <Link
                href="/call/demo-consultation"
                className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-teal-500/20 flex items-center gap-1.5"
              >
                <span>Enter Fullscreen Video</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
