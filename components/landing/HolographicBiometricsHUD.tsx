'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Heart,
  Activity,
  Droplets,
  Thermometer,
  ShieldCheck,
  Radio,
  Zap,
  Volume2,
  VolumeX,
  AlertTriangle,
  RotateCw,
  Cpu,
  Sparkles,
} from 'lucide-react';

type CardiacRhythm = 'normal' | 'tachycardia' | 'arrhythmia' | 'bradycardia';

interface RhythmConfig {
  name: string;
  bpm: number;
  spo2: number;
  temp: number;
  systolic: number;
  diastolic: number;
  status: 'normal' | 'elevated' | 'critical';
  frequency: number;
  alertText: string;
}

const RHYTHMS: Record<CardiacRhythm, RhythmConfig> = {
  normal: {
    name: 'Normal Sinus Rhythm',
    bpm: 72,
    spo2: 99,
    temp: 36.8,
    systolic: 120,
    diastolic: 80,
    status: 'normal',
    frequency: 1,
    alertText: 'All biometrics stable. Sinus rhythm confirmed.',
  },
  tachycardia: {
    name: 'Sinus Tachycardia',
    bpm: 134,
    spo2: 96,
    temp: 38.4,
    systolic: 142,
    diastolic: 92,
    status: 'elevated',
    frequency: 1.8,
    alertText: 'Elevated cardiac rate & febrile body temperature.',
  },
  arrhythmia: {
    name: 'Ventricular Arrhythmia',
    bpm: 158,
    spo2: 91,
    temp: 39.1,
    systolic: 165,
    diastolic: 105,
    status: 'critical',
    frequency: 2.2,
    alertText: 'CRITICAL: Acute arrhythmia detected. Tele-ICU alert triggered.',
  },
  bradycardia: {
    name: 'Sinus Bradycardia',
    bpm: 48,
    spo2: 97,
    temp: 36.4,
    systolic: 108,
    diastolic: 68,
    status: 'elevated',
    frequency: 0.65,
    alertText: 'Sub-normal pulse rate. Continuous monitoring active.',
  },
};

export function HolographicBiometricsHUD() {
  const [selectedRhythm, setSelectedRhythm] = useState<CardiacRhythm>('normal');
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [temperatureUnit, setTemperatureUnit] = useState<'C' | 'F'>('C');
  const [packetCount, setPacketCount] = useState(14820);
  const [liveBpm, setLiveBpm] = useState(72);

  // 3D Tilt State
  const cardRef = useRef<HTMLDivElement>(null);
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  // Canvas Ref for Real-Time Cardiac ECG Rendering
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const xOffsetRef = useRef<number>(0);

  const currentCfg = RHYTHMS[selectedRhythm];

  // Minor natural biometrics variance
  useEffect(() => {
    const timer = setInterval(() => {
      const variance = (Math.random() - 0.5) * 3;
      setLiveBpm(Math.round(currentCfg.bpm + variance));
      setPacketCount((prev) => prev + 1);
    }, 1200);

    return () => clearInterval(timer);
  }, [selectedRhythm, currentCfg.bpm]);

  // Handle 3D Mouse Parallax
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Constrain tilt angle
    const maxTilt = 10;
    const rotX = ((y - centerY) / centerY) * -maxTilt;
    const rotY = ((x - centerX) / centerX) * maxTilt;

    setRotateX(rotX);
    setRotateY(rotY);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setRotateX(0);
    setRotateY(0);
  };

  // Continuous ECG Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const renderECG = () => {
      const width = canvas.width;
      const height = canvas.height;
      const midY = height / 2;

      // Increment x offset based on rhythm frequency
      xOffsetRef.current = (xOffsetRef.current + 2.2 * currentCfg.frequency) % 240;

      // Clear with dark medical radar phosphor background
      ctx.fillStyle = 'rgba(6, 13, 26, 0.25)';
      ctx.fillRect(0, 0, width, height);

      // Draw medical grid lines
      ctx.strokeStyle = 'rgba(20, 184, 166, 0.08)';
      ctx.lineWidth = 1;

      // Draw subtle grid
      for (let x = 0; x < width; x += 30) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 20) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Draw ECG Cardiac Path
      ctx.beginPath();
      ctx.lineWidth = 2.5;

      const color =
        currentCfg.status === 'critical'
          ? '#f43f5e'
          : currentCfg.status === 'elevated'
          ? '#f59e0b'
          : '#10b981';

      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;

      const wavelength = 240 / currentCfg.frequency;

      for (let x = 0; x < width; x += 2) {
        const cycleX = (x + xOffsetRef.current * 1.5) % wavelength;
        let y = midY;

        // P-Q-R-S-T wave calculation
        if (cycleX >= 0 && cycleX < wavelength * 0.15) {
          y = midY; // Baseline
        } else if (cycleX >= wavelength * 0.15 && cycleX < wavelength * 0.25) {
          // P-Wave
          const p = (cycleX - wavelength * 0.15) / (wavelength * 0.1);
          y = midY - Math.sin(p * Math.PI) * 10;
        } else if (cycleX >= wavelength * 0.25 && cycleX < wavelength * 0.32) {
          y = midY; // PR segment
        } else if (cycleX >= wavelength * 0.32 && cycleX < wavelength * 0.35) {
          // Q-Dip
          y = midY + 8;
        } else if (cycleX >= wavelength * 0.35 && cycleX < wavelength * 0.42) {
          // R-Peak (high amplitude spike)
          const r = (cycleX - wavelength * 0.35) / (wavelength * 0.07);
          const amp = currentCfg.status === 'critical' ? 58 : 46;
          y = midY - Math.sin(r * Math.PI) * amp;
        } else if (cycleX >= wavelength * 0.42 && cycleX < wavelength * 0.46) {
          // S-Dip
          y = midY + 16;
        } else if (cycleX >= wavelength * 0.46 && cycleX < wavelength * 0.58) {
          y = midY; // ST segment
        } else if (cycleX >= wavelength * 0.58 && cycleX < wavelength * 0.75) {
          // T-Wave
          const t = (cycleX - wavelength * 0.58) / (wavelength * 0.17);
          const tAmp = currentCfg.status === 'critical' ? 22 : 14;
          y = midY - Math.sin(t * Math.PI) * tAmp;
        } else {
          y = midY; // TP interval
        }

        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.stroke();
      ctx.shadowBlur = 0;

      // Draw laser scanning head line
      const scanX = (xOffsetRef.current * 3.8) % width;
      const grad = ctx.createLinearGradient(scanX - 30, 0, scanX, 0);
      grad.addColorStop(0, 'transparent');
      grad.addColorStop(1, color);

      ctx.fillStyle = grad;
      ctx.fillRect(scanX - 30, 0, 30, height);

      ctx.beginPath();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.moveTo(scanX, 0);
      ctx.lineTo(scanX, height);
      ctx.stroke();

      animId = requestAnimationFrame(renderECG);
    };

    animId = requestAnimationFrame(renderECG);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [currentCfg]);

  const displayTemp =
    temperatureUnit === 'C'
      ? `${currentCfg.temp.toFixed(1)}°C`
      : `${((currentCfg.temp * 9) / 5 + 32).toFixed(1)}°F`;

  return (
    <div
      id="biometrics-hud"
      className="relative w-full max-w-5xl mx-auto my-12 px-4 sm:px-6 perspective-1500"
    >
      {/* Ambient 3D Neon Backlight */}
      <div
        className={`absolute -inset-4 sm:-inset-8 rounded-3xl blur-3xl opacity-50 transition-all duration-700 pointer-events-none ${
          currentCfg.status === 'critical'
            ? 'bg-rose-500/25'
            : currentCfg.status === 'elevated'
            ? 'bg-amber-500/25'
            : 'bg-teal-500/25'
        }`}
      />

      {/* Main 3D Card Shell */}
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={handleMouseLeave}
        style={{
          transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg) ${
            isHovered ? 'scale3d(1.015, 1.015, 1.015)' : 'scale3d(1, 1, 1)'
          }`,
          transition: isHovered
            ? 'transform 0.08s ease-out'
            : 'transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}
        className="relative rounded-3xl border border-white/15 bg-slate-950/85 backdrop-blur-2xl shadow-2xl shadow-black/80 p-6 sm:p-8 preserve-3d overflow-hidden"
      >
        {/* Hologram Reflection Sheen */}
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10 pointer-events-none rounded-3xl" />

        {/* Top HUD Bar: Device Identity & Status Indicators */}
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-teal-300 shadow-lg shadow-teal-500/20">
              <Cpu className="w-6 h-6 animate-pulse" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black tracking-tight text-white">
                  ESP32 Biometric Telemetry Node
                </h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  ONLINE
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Node ID: <span className="text-teal-300">ESP32-BIO-NODE-01</span> • 115200 Baud • AES-256
              </p>
            </div>
          </div>

          {/* Quick Rhythm Mode Toggles */}
          <div className="flex flex-wrap items-center gap-1.5 bg-white/5 p-1.5 rounded-2xl border border-white/10">
            <span className="text-[10px] font-bold text-slate-400 px-2 uppercase tracking-wider hidden md:inline">
              Simulate:
            </span>
            {(['normal', 'tachycardia', 'arrhythmia', 'bradycardia'] as CardiacRhythm[]).map(
              (rhythm) => (
                <button
                  key={rhythm}
                  onClick={() => setSelectedRhythm(rhythm)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    selectedRhythm === rhythm
                      ? rhythm === 'arrhythmia'
                        ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30 scale-105'
                        : rhythm === 'tachycardia'
                        ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30 scale-105'
                        : 'bg-teal-500 text-slate-950 shadow-lg shadow-teal-500/30 scale-105'
                      : 'text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {rhythm === 'normal'
                    ? 'Normal (72)'
                    : rhythm === 'tachycardia'
                    ? 'Tachycardia'
                    : rhythm === 'arrhythmia'
                    ? 'Arrhythmia'
                    : 'Bradycardia'}
                </button>
              )
            )}
          </div>
        </div>

        {/* Live Cardiac Waveform Display (Canvas ECG) */}
        <div className="relative z-10 my-6 bg-slate-950 rounded-2xl border border-teal-500/20 overflow-hidden shadow-inner">
          <div className="absolute top-3 left-4 z-20 flex items-center gap-2">
            <Activity className="w-4 h-4 text-teal-400" />
            <span className="text-xs font-mono font-bold text-teal-300 tracking-wider">
              LEAD II ECG TELEMETRY MONITOR
            </span>
            <span className="text-[10px] font-mono text-slate-500">
              [Gain: 10mm/mV • 25mm/s]
            </span>
          </div>

          <div className="absolute top-3 right-4 z-20 flex items-center gap-2">
            <span
              className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-lg border ${
                currentCfg.status === 'critical'
                  ? 'bg-rose-950/80 text-rose-300 border-rose-500/40 animate-pulse'
                  : currentCfg.status === 'elevated'
                  ? 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                  : 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
              }`}
            >
              {currentCfg.name.toUpperCase()}
            </span>
          </div>

          <canvas
            ref={canvasRef}
            width={900}
            height={160}
            className="w-full h-36 sm:h-44 block"
          />

          {/* Scanning status banner */}
          <div className="bg-slate-900/90 border-t border-white/5 px-4 py-2 flex items-center justify-between text-xs text-slate-400 font-mono">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
              <span>{currentCfg.alertText}</span>
            </div>
            <div className="hidden sm:flex items-center gap-3">
              <span>Packets: {packetCount.toLocaleString()}</span>
              <span>Sampling: 500Hz</span>
            </div>
          </div>
        </div>

        {/* 4 Interactive 3D Vital Hologram Gauges */}
        <div className="relative z-10 grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Gauge 1: Heart Rate */}
          <div className="group relative rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-teal-500/10">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Heart Rate</span>
              <div
                className={`w-7 h-7 rounded-xl flex items-center justify-center ${
                  currentCfg.status === 'critical'
                    ? 'bg-rose-500/20 text-rose-400'
                    : 'bg-teal-500/20 text-teal-400'
                }`}
              >
                <Heart className="w-4 h-4 animate-bounce" />
              </div>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-black text-white font-mono tracking-tight">
                {liveBpm}
              </span>
              <span className="text-xs font-bold text-slate-400">BPM</span>
            </div>

            <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>Target: 60-100</span>
              <span
                className={
                  currentCfg.status === 'critical'
                    ? 'text-rose-400 font-bold'
                    : 'text-emerald-400 font-bold'
                }
              >
                {currentCfg.status.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Gauge 2: SpO2 Oxygen */}
          <div className="group relative rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-cyan-500/10">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">SpO2 Blood Oxygen</span>
              <div className="w-7 h-7 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                <Droplets className="w-4 h-4" />
              </div>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-black text-white font-mono tracking-tight">
                {currentCfg.spo2}
              </span>
              <span className="text-xs font-bold text-slate-400">%</span>
            </div>

            {/* Visual Ring Bar */}
            <div className="mt-3 w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-teal-400 to-cyan-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${currentCfg.spo2}%` }}
              />
            </div>
          </div>

          {/* Gauge 3: Body Temperature */}
          <div className="group relative rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-500/10">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Core Body Temp</span>
              <button
                onClick={() => setTemperatureUnit(temperatureUnit === 'C' ? 'F' : 'C')}
                className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg bg-white/10 text-slate-300 hover:text-white hover:bg-white/20 transition-all cursor-pointer"
                title="Toggle °C / °F"
              >
                °{temperatureUnit}
              </button>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-black text-white font-mono tracking-tight">
                {displayTemp}
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>Calibrated DS18B20</span>
              <span
                className={
                  currentCfg.temp > 38.0
                    ? 'text-amber-400 font-bold'
                    : 'text-emerald-400 font-bold'
                }
              >
                {currentCfg.temp > 38.0 ? 'FEVER' : 'AFEBRILE'}
              </span>
            </div>
          </div>

          {/* Gauge 4: Arterial Blood Pressure */}
          <div className="group relative rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-teal-500/10">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Blood Pressure</span>
              <div className="w-7 h-7 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                <Activity className="w-4 h-4" />
              </div>
            </div>

            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl sm:text-4xl font-black text-white font-mono tracking-tight">
                {currentCfg.systolic}
              </span>
              <span className="text-lg text-slate-500">/</span>
              <span className="text-2xl font-bold text-slate-300 font-mono">
                {currentCfg.diastolic}
              </span>
              <span className="text-[10px] font-bold text-slate-400 ml-1">mmHg</span>
            </div>

            <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>Arterial Mean: {Math.round((currentCfg.systolic + 2 * currentCfg.diastolic) / 3)}</span>
              <span className="text-teal-400 font-bold">OPTIMAL</span>
            </div>
          </div>
        </div>

        {/* Bottom Interactive Notice & 3D Layer Elevation */}
        <div className="relative z-10 mt-6 pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-teal-400" />
            <span>
              Real-time Firestore stream updates with zero polling latency via WebSocket protocol.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-slate-500">
              Tilt card with mouse for 3D spatial depth
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
