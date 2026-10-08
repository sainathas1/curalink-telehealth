'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Cpu,
  Cloud,
  Stethoscope,
  Smartphone,
  ShieldCheck,
  Zap,
  ArrowRight,
  Database,
  Radio,
  FileCode,
  Lock,
} from 'lucide-react';

interface ArchStep {
  id: string;
  number: string;
  title: string;
  tech: string;
  description: string;
  icon: React.ElementType;
  details: string[];
}

const STEPS: ArchStep[] = [
  {
    id: 'step-1',
    number: '01',
    title: 'Biometric Edge Sensor',
    tech: 'ESP32 / MAX30102 / DS18B20',
    description: 'Hardware firmware reads photoplethysmogram (PPG) infrared curves and temperature gradients at 500Hz.',
    icon: Cpu,
    details: ['C++ FreeRTOS firmware', 'I2C Bus communication', 'Web Serial USB / Wi-Fi UDP'],
  },
  {
    id: 'step-2',
    number: '02',
    title: 'Encrypted Cloud Relay',
    tech: 'Google Cloud & Firestore',
    description: 'Sub-second real-time streaming pipeline synchronizing biometrics to authenticated doctor listeners with zero polling.',
    icon: Cloud,
    details: ['Firestore onSnapshot WebSockets', 'Strict security rules', 'HIPAA encrypted payloads'],
  },
  {
    id: 'step-3',
    number: '03',
    title: 'Clinician Ward Command',
    tech: 'Doctor Clinical Workspace',
    description: 'Multi-bed live telemetry monitor, cardiac arrhythmia detectors, and certified digital e-prescribing studio.',
    icon: Stethoscope,
    details: ['Multi-bed concurrent triage', 'WebRTC video call integration', 'EHR & consultation notes'],
  },
  {
    id: 'step-4',
    number: '04',
    title: 'Patient TeleCare App',
    tech: 'Next.js 15 & Mobile PWA',
    description: 'Patients monitor their continuous biometric trends, connect USB sensors, attend consultations, and view active prescriptions.',
    icon: Smartphone,
    details: ['Real-time vitals graphs', 'One-touch emergency SOS', 'Digital medication wallet'],
  },
];

export function ArchitectureFlow3D() {
  const [activeStep, setActiveStep] = useState<string>('step-1');
  const currentStep = STEPS.find((s) => s.id === activeStep) || STEPS[0];

  return (
    <section id="iot-hardware" className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto relative z-10">
      <div className="text-center max-w-3xl mx-auto mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-mono font-bold uppercase tracking-widest mb-4">
          <Zap className="w-3.5 h-3.5 text-emerald-400" />
          End-to-End Biomedical Pipeline
        </div>
        <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
          How CuraLink Streams Vitals in <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400">
            Under 50 Milliseconds
          </span>
        </h2>
        <p className="mt-4 text-sm sm:text-base text-slate-400 leading-relaxed">
          From micro-controller sensor registers to clinician screens across the world with zero polling and maximum cryptographic security.
        </p>
      </div>

      {/* 4 Pipeline Step Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 perspective-1000 mb-12">
        {STEPS.map((step) => {
          const Icon = step.icon;
          const isActive = activeStep === step.id;

          return (
            <button
              key={step.id}
              onClick={() => setActiveStep(step.id)}
              className={`text-left p-6 rounded-3xl border transition-all duration-300 cursor-pointer relative overflow-hidden preserve-3d ${
                isActive
                  ? 'bg-slate-900 border-teal-400/60 shadow-2xl shadow-teal-500/20 -translate-y-2'
                  : 'bg-slate-950/60 border-white/10 hover:border-white/20 hover:-translate-y-1'
              }`}
            >
              {isActive && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-400 to-emerald-400" />
              )}

              <div className="flex items-center justify-between mb-4">
                <span className="text-2xl font-black text-slate-600 font-mono">
                  {step.number}
                </span>
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                    isActive
                      ? 'bg-teal-500 text-slate-950'
                      : 'bg-white/5 text-slate-400'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
              </div>

              <h3 className="text-base font-bold text-white mb-1">{step.title}</h3>
              <p className="text-xs font-mono text-teal-400 mb-3">{step.tech}</p>
              <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">
                {step.description}
              </p>
            </button>
          );
        })}
      </div>

      {/* Deep-Dive Active Step Inspector Card */}
      <div className="rounded-3xl border border-white/15 bg-slate-950/90 backdrop-blur-2xl p-6 sm:p-8 shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-teal-400 font-bold uppercase tracking-wider">
                Active Architecture Node:
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 text-xs font-mono font-bold">
                {currentStep.tech}
              </span>
            </div>

            <h4 className="text-2xl font-black text-white">{currentStep.title}</h4>
            <p className="text-sm text-slate-300 max-w-2xl">{currentStep.description}</p>

            <div className="flex flex-wrap items-center gap-2 pt-2">
              {currentStep.details.map((item, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 rounded-xl bg-white/5 border border-white/10 text-xs font-mono text-slate-300 flex items-center gap-1.5"
                >
                  <Lock className="w-3 h-3 text-teal-400" />
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
            <Link
              href="/doctor/iot-hub"
              className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs text-center shadow-lg shadow-teal-500/20 flex items-center justify-center gap-2"
            >
              <FileCode className="w-4 h-4" />
              <span>Inspect C++ Firmware</span>
            </Link>

            <Link
              href="/patient/device"
              className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs text-center border border-white/10 flex items-center justify-center gap-2"
            >
              <Radio className="w-4 h-4 text-emerald-400" />
              <span>Test Web Serial USB</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
