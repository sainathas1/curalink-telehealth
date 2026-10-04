'use client';

import React from 'react';
import { LiveTelemetryPayload, VitalHistoryPoint } from '../../lib/types';
import { VitalsChart } from './VitalsChart';
import {
  Heart,
  Droplets,
  Thermometer,
  Gauge,
  BatteryCharging,
  Volume2,
  VolumeX,
  Sliders,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

interface VitalsMonitorProps {
  telemetry: LiveTelemetryPayload;
  history: VitalHistoryPoint[];
  temperatureUnit: 'C' | 'F';
  onToggleTempUnit: () => void;
  audioAlertsEnabled: boolean;
  onToggleAudio: () => void;
  onOpenSimulator: () => void;
  isSimulating: boolean;
}

export function VitalsMonitor({
  telemetry,
  history,
  temperatureUnit,
  onToggleTempUnit,
  audioAlertsEnabled,
  onToggleAudio,
  onOpenSimulator,
  isSimulating,
}: VitalsMonitorProps) {
  // Temperature conversion
  const formattedTemp =
    temperatureUnit === 'F'
      ? `${((telemetry.temperature * 9) / 5 + 32).toFixed(1)}°F`
      : `${telemetry.temperature.toFixed(1)}°C`;

  // Status badge styling helper
  const getBadgeStyle = (status: 'normal' | 'elevated' | 'critical') => {
    switch (status) {
      case 'critical':
        return 'bg-rose-100 text-rose-800 border-rose-200 animate-pulse';
      case 'elevated':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'normal':
      default:
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    }
  };

  const getMetricStatus = (key: 'hr' | 'spo2' | 'temp') => {
    if (key === 'hr') {
      if (telemetry.heartRate >= 120 || telemetry.heartRate < 50) return 'critical';
      if (telemetry.heartRate > 100 || telemetry.heartRate < 60) return 'elevated';
      return 'normal';
    }
    if (key === 'spo2') {
      if (telemetry.spo2 < 92) return 'critical';
      if (telemetry.spo2 < 95) return 'elevated';
      return 'normal';
    }
    if (key === 'temp') {
      if (telemetry.temperature >= 38.3) return 'critical';
      if (telemetry.temperature >= 37.5) return 'elevated';
      return 'normal';
    }
    return 'normal';
  };

  const hrStatus = getMetricStatus('hr');
  const spo2Status = getMetricStatus('spo2');
  const tempStatus = getMetricStatus('temp');

  return (
    <div className="space-y-6">
      {/* Top Banner & Control Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Real-Time IoT Patient Telemetry
            </h2>
            <span
              className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${getBadgeStyle(
                telemetry.status
              )}`}
            >
              {telemetry.status.toUpperCase()}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
            <span>Node: <strong className="font-mono text-slate-700">{telemetry.deviceId}</strong></span>
            <span>•</span>
            <span>Sync: <strong className="text-teal-600 font-semibold">Every 2s</strong></span>
          </p>
        </div>

        {/* Controls: Audio Toggle, Temp Unit Toggle, Simulator Drawer */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Temperature Unit Button */}
          <button
            onClick={onToggleTempUnit}
            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
            title="Switch Celsius / Fahrenheit"
          >
            <Thermometer className="w-3.5 h-3.5 text-teal-600" />
            <span>Unit: {temperatureUnit === 'C' ? '°C' : '°F'}</span>
          </button>

          {/* Audio Chime Button */}
          <button
            onClick={onToggleAudio}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs ${
              audioAlertsEnabled
                ? 'bg-teal-50 border-teal-200 text-teal-700'
                : 'bg-slate-50 border-slate-200 text-slate-500'
            }`}
            title="Enable / Disable Vital Alert Chimes"
          >
            {audioAlertsEnabled ? (
              <Volume2 className="w-3.5 h-3.5 text-teal-600" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span>{audioAlertsEnabled ? 'Sound On' : 'Muted'}</span>
          </button>

          {/* Simulator Trigger */}
          <button
            onClick={onOpenSimulator}
            className="px-3 py-1.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
            title="Open Simulator to test arrhythmias & fevers"
          >
            <Sliders className="w-3.5 h-3.5 text-teal-400" />
            <span>{isSimulating ? 'Tune Sensor' : 'Start Simulation'}</span>
          </button>
        </div>
      </div>

      {/* Critical Alert Warning Banner */}
      {telemetry.status === 'critical' && (
        <div className="bg-rose-50 border-l-4 border-rose-600 p-4 rounded-2xl shadow-sm flex items-start gap-3.5 animate-pulse">
          <div className="p-2 rounded-xl bg-rose-100 text-rose-600 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-rose-900">
              Biomedical Threshold Breached — Immediate Alert
            </h4>
            <p className="text-xs text-rose-700 mt-0.5">
              {telemetry.alertMessage || 'Abnormal vital telemetry detected. CuraLink clinical staff notified.'}
            </p>
            <div className="mt-2 flex items-center gap-3">
              <span className="text-[11px] font-semibold text-rose-800 bg-rose-200/60 px-2 py-0.5 rounded-md">
                Telemetry Protocol v2.4 Active
              </span>
              <span className="text-[11px] text-rose-600 underline cursor-pointer font-medium">
                On-call cardiologist alerted
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Elevated Warning Banner */}
      {telemetry.status === 'elevated' && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-2xl shadow-sm flex items-start gap-3.5">
          <div className="p-2 rounded-xl bg-amber-100 text-amber-700 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-amber-900">Elevated Biomarkers Detected</h4>
            <p className="text-xs text-amber-700 mt-0.5">
              {telemetry.alertMessage || 'One or more vitals are slightly outside standard resting thresholds. Please rest quietly.'}
            </p>
          </div>
        </div>
      )}

      {/* 4 Primary Telemetry Sensor Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Heart Rate */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs relative overflow-hidden transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Heart Rate
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 flex items-center justify-center text-rose-500">
              <Heart className="w-4 h-4 fill-rose-500 animate-pulse" />
            </div>
          </div>

          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 font-mono tracking-tight">
              {telemetry.heartRate}
            </span>
            <span className="text-xs font-semibold text-slate-500">BPM</span>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getBadgeStyle(hrStatus)}`}>
              {hrStatus.toUpperCase()}
            </span>
            <span className="text-[11px] text-slate-400 font-medium">Norm: 60-100</span>
          </div>
        </div>

        {/* Card 2: SpO2 */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs relative overflow-hidden transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Oxygen (SpO2)
            </span>
            <div className="w-8 h-8 rounded-xl bg-cyan-50 flex items-center justify-center text-cyan-500">
              <Droplets className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 font-mono tracking-tight">
              {telemetry.spo2.toFixed(1)}
            </span>
            <span className="text-xs font-semibold text-slate-500">%</span>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getBadgeStyle(spo2Status)}`}>
              {spo2Status.toUpperCase()}
            </span>
            <span className="text-[11px] text-slate-400 font-medium">Norm: &ge; 95%</span>
          </div>
        </div>

        {/* Card 3: Body Temperature */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs relative overflow-hidden transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Body Temp
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500">
              <Thermometer className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 font-mono tracking-tight">
              {formattedTemp}
            </span>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getBadgeStyle(tempStatus)}`}>
              {tempStatus.toUpperCase()}
            </span>
            <span className="text-[11px] text-slate-400 font-medium">Norm: 36.1 - 37.3°C</span>
          </div>
        </div>

        {/* Card 4: Blood Pressure */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs relative overflow-hidden transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Blood Pressure
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500">
              <Gauge className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 font-mono tracking-tight">
              {telemetry.systolic}/{telemetry.diastolic}
            </span>
            <span className="text-xs font-semibold text-slate-500">mmHg</span>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-teal-50 text-teal-700 border-teal-200">
              OPTIMAL
            </span>
            <span className="text-[11px] text-slate-400 font-medium">Norm: &lt;120/&lt;80</span>
          </div>
        </div>
      </div>

      {/* Sensor Hardware Health & Battery Strip */}
      <div className="bg-slate-50 rounded-2xl border border-slate-200/80 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span className="text-slate-700 font-medium">
            IoT PPG & Thermistor Sensor Probe Contact: <strong className="text-emerald-700">Optimal Skin Contact</strong>
          </span>
        </div>

        <div className="flex items-center gap-4 text-slate-500">
          <div className="flex items-center gap-1.5">
            <BatteryCharging className="w-4 h-4 text-teal-600" />
            <span>Battery: <strong className="font-mono text-slate-700">{telemetry.batteryLevel}%</strong></span>
          </div>
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Signal Quality: <strong className="text-slate-700">99.4% (SNR High)</strong></span>
          </div>
        </div>
      </div>

      {/* 24-Hour IoT Telemetry Dynamic Trend Line Chart */}
      <VitalsChart history={history} temperatureUnit={temperatureUnit} />
    </div>
  );
}
