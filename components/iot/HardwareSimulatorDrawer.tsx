'use client';

import React from 'react';
import { SimulationMode } from '../../lib/iot-service';
import { LiveTelemetryPayload } from '../../lib/types';
import {
  X,
  Sliders,
  Radio,
  Zap,
  Flame,
  Activity,
  Droplets,
  Heart,
  Cpu,
  CheckCircle2,
} from 'lucide-react';

interface HardwareSimulatorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  isSimulating: boolean;
  onToggleSimulating: () => void;
  simulationMode: SimulationMode;
  onChangeMode: (mode: SimulationMode) => void;
  telemetry: LiveTelemetryPayload;
  onOpenCodeGuide: () => void;
}

export function HardwareSimulatorDrawer({
  isOpen,
  onClose,
  isSimulating,
  onToggleSimulating,
  simulationMode,
  onChangeMode,
  telemetry,
  onOpenCodeGuide,
}: HardwareSimulatorDrawerProps) {
  if (!isOpen) return null;

  const modes: {
    id: SimulationMode;
    label: string;
    desc: string;
    icon: React.ReactNode;
    color: string;
  }[] = [
    {
      id: 'normal',
      label: 'Nominal Baseline',
      desc: 'Resting normal vitals: HR 72-82 BPM, SpO2 98.4%, Temp 36.7°C',
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
      color: 'border-emerald-500 bg-emerald-50/40',
    },
    {
      id: 'tachycardia',
      label: 'Acute Tachycardia',
      desc: 'High heart rate spike (125 - 145 BPM), triggers cardiac rhythm alarm',
      icon: <Heart className="w-4 h-4 text-rose-500 fill-rose-500 animate-pulse" />,
      color: 'border-rose-500 bg-rose-50/50',
    },
    {
      id: 'hypoxia',
      label: 'Respiratory Hypoxia',
      desc: 'Critical oxygen desaturation (SpO2 86% - 91%), triggers respiratory alarm',
      icon: <Droplets className="w-4 h-4 text-cyan-600" />,
      color: 'border-cyan-500 bg-cyan-50/50',
    },
    {
      id: 'fever',
      label: 'Hyperpyrexia / Fever',
      desc: 'Elevated body temperature (38.5°C - 39.4°C), triggers febrile alert',
      icon: <Flame className="w-4 h-4 text-amber-500" />,
      color: 'border-amber-500 bg-amber-50/50',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col justify-between overflow-y-auto border-l border-slate-200">
        {/* Header */}
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">IoT Sensor Testbed & Simulator</h3>
              <p className="text-xs text-slate-400">Emulate real-time biomedical sensor hardware</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 flex-1 text-xs">
          {/* Hardware Toggle */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex items-center justify-between">
            <div>
              <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-teal-600" />
                <span>Simulate Hardware Stream</span>
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {isSimulating ? 'Streaming mock sensor feed every 2s' : 'Listening to physical ESP32'}
              </p>
            </div>

            <button
              onClick={onToggleSimulating}
              className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                isSimulating ? 'bg-teal-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full bg-white shadow-md absolute top-0.5 transition-transform ${
                  isSimulating ? 'left-6.5' : 'left-0.5'
                }`}
              />
            </button>
          </div>

          {/* Current Live Values Display */}
          <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-3 font-mono">
            <div className="flex items-center justify-between text-slate-400 text-[10px] uppercase font-bold tracking-wider">
              <span>Telemetry Node Output</span>
              <span className="text-teal-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-ping" />
                2000ms Poll
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-slate-800 p-2 rounded-xl">
                <span className="text-[10px] text-slate-400 block">HEART RATE</span>
                <span className="text-lg font-bold text-rose-400">{telemetry.heartRate}</span>
                <span className="text-[9px] text-slate-500">BPM</span>
              </div>
              <div className="bg-slate-800 p-2 rounded-xl">
                <span className="text-[10px] text-slate-400 block">SPO2</span>
                <span className="text-lg font-bold text-cyan-400">{telemetry.spo2}%</span>
                <span className="text-[9px] text-slate-500">O2</span>
              </div>
              <div className="bg-slate-800 p-2 rounded-xl">
                <span className="text-[10px] text-slate-400 block">TEMP</span>
                <span className="text-lg font-bold text-amber-400">{telemetry.temperature}°</span>
                <span className="text-[9px] text-slate-500">CELSIUS</span>
              </div>
            </div>

            <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800 flex justify-between">
              <span>Status: <strong className="text-teal-300 uppercase">{telemetry.status}</strong></span>
              <span>Battery: {telemetry.batteryLevel}%</span>
            </div>
          </div>

          {/* Select Simulation Scenario */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Select Physiological Scenario:
            </label>

            <div className="space-y-2.5">
              {modes.map((m) => {
                const isActive = simulationMode === m.id;
                return (
                  <div
                    key={m.id}
                    onClick={() => onChangeMode(m.id)}
                    className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-3 ${
                      isActive ? m.color : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="shrink-0 mt-0.5">{m.icon}</div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h5 className="font-bold text-slate-900">{m.label}</h5>
                        {isActive && (
                          <span className="text-[10px] font-bold text-teal-700 bg-teal-100 px-2 py-0.5 rounded-full">
                            Streaming
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">{m.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-50 border-t border-slate-200 space-y-3">
          <button
            onClick={() => {
              onClose();
              onOpenCodeGuide();
            }}
            className="w-full py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md shadow-teal-600/20 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <Cpu className="w-4 h-4" />
            <span>View ESP32 C++ Code & Pinout</span>
          </button>
        </div>
      </div>
    </div>
  );
}
