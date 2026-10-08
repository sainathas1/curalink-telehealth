'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Cpu,
  Video,
  FileText,
  AlertTriangle,
  Activity,
  Usb,
  ShieldCheck,
  Zap,
  ArrowRight,
  Sparkles,
  HeartPulse,
  Database,
  Radio,
} from 'lucide-react';

interface FeatureItem {
  id: string;
  icon: React.ElementType;
  badge: string;
  title: string;
  description: string;
  metrics: string;
  actionText: string;
  actionHref: string;
  colorScheme: 'teal' | 'emerald' | 'cyan' | 'purple' | 'rose' | 'amber';
}

const FEATURES: FeatureItem[] = [
  {
    id: 'iot-telemetry',
    icon: Cpu,
    badge: 'Hardware Sync',
    title: 'ESP32 & Wearable IoT Telemetry',
    description:
      'Continuous biometric streaming from MAX30102 pulse oximeters and DS18B20 digital thermometers directly to the cloud without phone tethering.',
    metrics: '<50ms Transmission Latency',
    actionText: 'Explore ESP32 Code',
    actionHref: '/doctor/iot-hub',
    colorScheme: 'teal',
  },
  {
    id: 'webrtc-telehealth',
    icon: Video,
    badge: 'HD Video',
    title: 'WebRTC Peer Video Consultations',
    description:
      'Encrypted end-to-end clinical video consults with live telemetry HUD overlay so clinicians can observe cardiac rhythms and vitals in real-time.',
    metrics: 'Zero Plugin Setup • Peer Encrypted',
    actionText: 'Join Test Call',
    actionHref: '/call/demo-consultation',
    colorScheme: 'cyan',
  },
  {
    id: 'clinical-ehr',
    icon: FileText,
    badge: 'E-Prescribe',
    title: 'Certified Cloud EHR & Digital Rx',
    description:
      'Author consultation notes, differential diagnoses, and issue certified digital prescriptions that sync to the patient in real time.',
    metrics: 'Firestore Realtime Sync',
    actionText: 'Open Doctor EHR',
    actionHref: '/doctor/ehr',
    colorScheme: 'emerald',
  },
  {
    id: 'emergency-sos',
    icon: AlertTriangle,
    badge: 'Rapid Response',
    title: 'Instant Emergency SOS Dispatch',
    description:
      'One-touch critical dispatch broadcasting GPS coordinates, biometric state, and acute telemetry alerts directly to on-call ICU clinicians.',
    metrics: 'Sub-second Dispatch Signal',
    actionText: 'Emergency Protocol',
    actionHref: '/patient/dashboard',
    colorScheme: 'rose',
  },
  {
    id: 'ward-monitoring',
    icon: Activity,
    badge: 'Multi-Patient',
    title: 'Clinician Ward Telemetry Matrix',
    description:
      'Simultaneously monitor multiple remote hospital beds or home-recovery patients on a single unified telemetry surveillance board.',
    metrics: 'Unlimited Concurrent Beds',
    actionText: 'Inspect Ward View',
    actionHref: '/doctor/ward',
    colorScheme: 'purple',
  },
  {
    id: 'web-serial',
    icon: Usb,
    badge: 'Hardware Port',
    title: 'Web Serial API Direct USB Connect',
    description:
      'Plug any micro-controller, Arduino, or medical sensor directly into your USB port. Read baud streams right in your browser.',
    metrics: 'Chrome & Edge Native Support',
    actionText: 'Connect USB Device',
    actionHref: '/patient/device',
    colorScheme: 'amber',
  },
];

export function Features3DGrid() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <section id="features" className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto relative z-10">
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-16 sm:mb-20">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-300 text-xs font-mono font-bold uppercase tracking-widest mb-4">
          <Sparkles className="w-3.5 h-3.5 text-teal-400" />
          Enterprise Telehealth Architecture
        </div>
        <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
          Engineered for Zero-Latency <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 via-emerald-400 to-cyan-400">
            Biomedical Remote Care
          </span>
        </h2>
        <p className="mt-4 text-sm sm:text-base text-slate-400 leading-relaxed">
          From micro-controller firmware to cloud telemetry pipelines and physician video suites — every layer is built for mission-critical reliability.
        </p>
      </div>

      {/* 3D Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 perspective-1000">
        {FEATURES.map((feat, idx) => {
          const Icon = feat.icon;
          const isHovered = hoveredIndex === idx;

          return (
            <div
              key={feat.id}
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
              className="group relative rounded-3xl p-6 sm:p-7 bg-slate-900/60 border border-white/10 hover:border-teal-500/40 backdrop-blur-xl transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-teal-500/10 preserve-3d flex flex-col justify-between"
            >
              {/* Card Ambient Glow */}
              <div className="absolute -inset-0.5 rounded-3xl bg-gradient-to-b from-teal-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10 blur-xl pointer-events-none" />

              <div>
                {/* Header Row: Icon + Badge */}
                <div className="flex items-center justify-between mb-5">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-teal-400 group-hover:scale-110 group-hover:bg-teal-500/20 group-hover:text-teal-300 transition-all duration-300 shadow-lg">
                    <Icon className="w-6 h-6" />
                  </div>

                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/5 text-slate-300 border border-white/10 group-hover:border-teal-500/30 group-hover:text-teal-300 transition-colors">
                    {feat.badge}
                  </span>
                </div>

                {/* Title & Description */}
                <h3 className="text-xl font-bold text-white tracking-tight group-hover:text-teal-300 transition-colors mb-2.5">
                  {feat.title}
                </h3>

                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed mb-6">
                  {feat.description}
                </p>
              </div>

              {/* Bottom Metrics & CTA */}
              <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                <span className="text-[11px] font-mono text-slate-400">
                  {feat.metrics}
                </span>

                <Link
                  href={feat.actionHref}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-400 hover:text-teal-300 group/link transition-colors cursor-pointer"
                >
                  <span>{feat.actionText}</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover/link:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
