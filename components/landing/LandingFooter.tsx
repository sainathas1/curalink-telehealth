'use client';

import React from 'react';
import Link from 'next/link';
import {
  HeartPulse,
  ShieldCheck,
  Lock,
  Radio,
  FileText,
  AlertTriangle,
  ExternalLink,
  Activity,
} from 'lucide-react';

export function LandingFooter() {
  return (
    <footer className="relative bg-slate-950 border-t border-white/10 pt-16 pb-12 px-4 sm:px-6 lg:px-8 text-slate-400 text-xs z-10">
      {/* Top Status Bar Ticker */}
      <div className="max-w-7xl mx-auto mb-12 pb-8 border-b border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <span className="font-mono text-slate-300 font-bold">
            CURALINK CLOUD STATUS: ALL RELAYS OPERATIONAL
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono text-slate-500">
          <span className="flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-teal-400" />
            <span>WebSockets: ACTIVE</span>
          </span>
          <span>•</span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>HIPAA AES-256</span>
          </span>
          <span>•</span>
          <span className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span>Jitsi WebRTC: READY</span>
          </span>
        </div>
      </div>

      {/* Main Grid */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 mb-12">
        {/* Brand Col */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-teal-500/20">
              <HeartPulse className="w-5 h-5 animate-pulse" />
            </div>
            <span className="text-xl font-black tracking-tight text-white">
              Cura<span className="text-teal-400">Link</span>
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
            Continuous IoT biomedical telemetry monitoring, WebRTC HD teleconsultations, certified clinical EHR workspace, and automated emergency triage.
          </p>

          <div className="flex items-center gap-2 pt-2">
            <span className="px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 text-[10px] font-mono text-slate-300">
              HIPAA Compliant
            </span>
            <span className="px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 text-[10px] font-mono text-slate-300">
              SOC-2 Ready
            </span>
            <span className="px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 text-[10px] font-mono text-slate-300">
              End-to-End Encrypted
            </span>
          </div>
        </div>

        {/* Col 2: Patient Portal */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-white">Patient Portal</h4>
          <ul className="space-y-2">
            <li>
              <Link href="/patient/dashboard" className="hover:text-teal-400 transition-colors">
                Personal Health Hub
              </Link>
            </li>
            <li>
              <Link href="/patient/vitals" className="hover:text-teal-400 transition-colors">
                Live Vitals Stream
              </Link>
            </li>
            <li>
              <Link href="/patient/appointments" className="hover:text-teal-400 transition-colors">
                Schedule Consultation
              </Link>
            </li>
            <li>
              <Link href="/patient/device" className="hover:text-teal-400 transition-colors">
                Connect USB Sensor
              </Link>
            </li>
            <li>
              <Link href="/patient/prescriptions" className="hover:text-teal-400 transition-colors">
                Digital Prescriptions
              </Link>
            </li>
          </ul>
        </div>

        {/* Col 3: Doctor Clinical Suite */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-white">Clinician Suite</h4>
          <ul className="space-y-2">
            <li>
              <Link href="/doctor/dashboard" className="hover:text-teal-400 transition-colors">
                Clinical Command Station
              </Link>
            </li>
            <li>
              <Link href="/doctor/ward" className="hover:text-teal-400 transition-colors">
                Multi-Patient Ward
              </Link>
            </li>
            <li>
              <Link href="/doctor/ehr" className="hover:text-teal-400 transition-colors">
                EHR & Digital Prescribing
              </Link>
            </li>
            <li>
              <Link href="/doctor/iot-hub" className="hover:text-teal-400 transition-colors">
                ESP32 Firmware Hub
              </Link>
            </li>
            <li>
              <Link href="/doctor/patients" className="hover:text-teal-400 transition-colors">
                Patient Medical Directory
              </Link>
            </li>
          </ul>
        </div>

        {/* Col 4: Telehealth & Emergency */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-white">Emergency & System</h4>
          <ul className="space-y-2">
            <li>
              <Link href="/call/demo-consultation" className="hover:text-teal-400 transition-colors">
                WebRTC Video Consult
              </Link>
            </li>
            <li>
              <Link href="/auth" className="hover:text-teal-400 transition-colors">
                Sign In / Join Network
              </Link>
            </li>
            <li>
              <Link href="/onboarding" className="hover:text-teal-400 transition-colors">
                Medical Onboarding
              </Link>
            </li>
            <li>
              <span className="text-rose-400 font-bold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Emergency Hotline: 911 / 112
              </span>
            </li>
          </ul>
        </div>
      </div>

      {/* Bottom Legal Disclaimer */}
      <div className="max-w-7xl mx-auto pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500">
        <p>
          © {new Date().getFullYear()} CuraLink Health Inc. All rights reserved. Telehealth and remote patient monitoring system.
        </p>

        <p className="max-w-md text-center sm:text-right">
          Disclaimer: In the event of a life-threatening medical emergency, call your local emergency services immediately.
        </p>
      </div>
    </footer>
  );
}
