'use client';

import React, { useState } from 'react';
import { LiveTelemetryPayload, VitalHistoryPoint } from '../../lib/types';
import { useTelehealth } from '../../context/TelehealthContext';
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
  Plus,
  X,
  FileCheck,
  Clock,
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
  const { currentUser, logVitalSign, vitalLogs } = useTelehealth();
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [logHr, setLogHr] = useState('75');
  const [logSpo2, setLogSpo2] = useState('98');
  const [logTemp, setLogTemp] = useState('36.8');
  const [logSystolic, setLogSystolic] = useState('120');
  const [logDiastolic, setLogDiastolic] = useState('80');
  const [logNotes, setLogNotes] = useState('');
  const [isLogging, setIsLogging] = useState(false);
  const [logSuccess, setLogSuccess] = useState(false);

  const isAuthValid = !!currentUser?.uid;

  const handleLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthValid) return;
    setIsLogging(true);
    try {
      await logVitalSign({
        heartRate: Number(logHr) || 75,
        spo2: Number(logSpo2) || 98,
        temperature: Number(logTemp) || 36.8,
        systolic: Number(logSystolic) || 120,
        diastolic: Number(logDiastolic) || 80,
        notes: logNotes.trim(),
      });
      setIsLogging(false);
      setLogSuccess(true);
      setTimeout(() => {
        setLogSuccess(false);
        setIsLogModalOpen(false);
        setLogNotes('');
      }, 1000);
    } catch (err) {
      console.error('Error logging vital signs:', err);
      setIsLogging(false);
    }
  };

  const isStandby = !telemetry.sensorConnected || telemetry.heartRate === 0;

  // Temperature conversion
  const formattedTemp = isStandby
    ? '--'
    : temperatureUnit === 'F'
    ? `${((telemetry.temperature * 9) / 5 + 32).toFixed(1)}°F`
    : `${telemetry.temperature.toFixed(1)}°C`;

  // Status badge styling helper
  const getBadgeStyle = (status: 'normal' | 'elevated' | 'critical' | 'standby') => {
    switch (status) {
      case 'standby':
        return 'bg-slate-100 text-slate-600 border-slate-200';
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
    if (isStandby) return 'standby';
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
                isStandby ? 'standby' : telemetry.status
              )}`}
            >
              {isStandby ? 'STANDBY / AWAITING FEED' : telemetry.status.toUpperCase()}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
            <span>Node: <strong className="font-mono text-slate-700">{isStandby ? 'Awaiting Device' : telemetry.deviceId}</strong></span>
            <span>•</span>
            <span>Status: <strong className={isStandby ? 'text-slate-500' : 'text-teal-600 font-semibold'}>{isStandby ? 'Listening to Firebase' : 'Live Syncing'}</strong></span>
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

          {/* Record Vitals Button */}
          <button
            onClick={() => setIsLogModalOpen(true)}
            disabled={!isAuthValid}
            title={!isAuthValid ? 'Sign in to record vitals' : 'Record physiological vitals to Firestore'}
            className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{!isAuthValid ? 'Sign In to Log' : 'Record Vitals'}</span>
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
      {!isStandby && telemetry.status === 'critical' && (
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
      {!isStandby && telemetry.status === 'elevated' && (
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
              <Heart className={`w-4 h-4 fill-rose-500 ${isStandby ? '' : 'animate-pulse'}`} />
            </div>
          </div>

          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 font-mono tracking-tight">
              {isStandby ? '--' : telemetry.heartRate}
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
              {isStandby ? '--' : telemetry.spo2.toFixed(1)}
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
              {isStandby ? '--/--' : `${telemetry.systolic}/${telemetry.diastolic}`}
            </span>
            <span className="text-xs font-semibold text-slate-500">mmHg</span>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${isStandby ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-teal-50 text-teal-700 border-teal-200'}`}>
              {isStandby ? 'STANDBY' : 'OPTIMAL'}
            </span>
            <span className="text-[11px] text-slate-400 font-medium">Norm: &lt;120/&lt;80</span>
          </div>
        </div>
      </div>

      {/* Sensor Hardware Health & Battery Strip */}
      <div className="bg-slate-50 rounded-2xl border border-slate-200/80 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <CheckCircle2 className={`w-4 h-4 ${isStandby ? 'text-slate-400' : 'text-emerald-600'}`} />
          <span className="text-slate-700 font-medium">
            IoT Biosensor Stream: <strong className={isStandby ? 'text-slate-600' : 'text-emerald-700'}>{isStandby ? 'Standby (Awaiting Firebase telemetry feed)' : 'Optimal Node Contact'}</strong>
          </span>
        </div>

        <div className="flex items-center gap-4 text-slate-500">
          <div className="flex items-center gap-1.5">
            <BatteryCharging className="w-4 h-4 text-teal-600" />
            <span>Battery: <strong className="font-mono text-slate-700">{isStandby ? 'Standby' : `${telemetry.batteryLevel}%`}</strong></span>
          </div>
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Signal Quality: <strong className="text-slate-700">{isStandby ? 'Standby' : 'Optimal (SNR High)'}</strong></span>
          </div>
        </div>
      </div>

      {/* 24-Hour IoT Telemetry Dynamic Trend Line Chart */}
      <VitalsChart history={history} temperatureUnit={temperatureUnit} />

      {/* Logged Vitals from Firestore Collection */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Clock className="w-4 h-4 text-teal-600" />
              <span>Patient Logged Vitals Records (Firestore)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              History of validated vital measurements recorded to the <code className="font-mono text-teal-600">vitals</code> collection
            </p>
          </div>
          <button
            onClick={() => setIsLogModalOpen(true)}
            disabled={!isAuthValid}
            className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Record Entry</span>
          </button>
        </div>

        {(vitalLogs || []).length === 0 ? (
          <div className="py-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <Heart className="w-6 h-6 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-600">No manual entries recorded yet</p>
            <p className="text-[11px] text-slate-400 max-w-xs mx-auto mt-0.5">
              Click &quot;Record Entry&quot; above to log your heart rate, oxygen saturation, and body temperature.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold text-[10px]">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Heart Rate</th>
                  <th className="px-4 py-3">SpO2</th>
                  <th className="px-4 py-3">Temperature</th>
                  <th className="px-4 py-3">Blood Pressure</th>
                  <th className="px-4 py-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {(vitalLogs || []).map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-mono text-slate-500 text-[11px]">
                      {log.createdAt?.toDate ? log.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }) : 'Recently'}
                    </td>
                    <td className="px-4 py-3 font-bold text-rose-600 font-mono">
                      {log.heartRate} BPM
                    </td>
                    <td className="px-4 py-3 font-bold text-cyan-600 font-mono">
                      {log.spo2}%
                    </td>
                    <td className="px-4 py-3 font-bold text-amber-600 font-mono">
                      {log.temperature}°C
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-700">
                      {log.systolic || '--'}/{log.diastolic || '--'} mmHg
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-xs truncate">
                      {log.notes || 'Routine checkup log'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual Vitals Recording Modal */}
      {isLogModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-teal-800 to-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300">
                  <Heart className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Record Vitals to Firestore</h3>
                  <p className="text-xs text-teal-200">Logs directly to the vitals collection & telemetry</p>
                </div>
              </div>
              <button
                onClick={() => setIsLogModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {logSuccess ? (
              <div className="p-8 text-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-md">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h4 className="text-base font-bold text-slate-900">Vitals Recorded Successfully!</h4>
                <p className="text-xs text-slate-500">Document saved to Firestore and live stream synchronized.</p>
              </div>
            ) : (
              <form onSubmit={handleLogSubmit} className="p-5 space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Heart Rate (BPM)
                    </label>
                    <input
                      type="number"
                      required
                      min={30}
                      max={240}
                      value={logHr}
                      onChange={(e) => setLogHr(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Oxygen SpO2 (%)
                    </label>
                    <input
                      type="number"
                      required
                      min={70}
                      max={100}
                      value={logSpo2}
                      onChange={(e) => setLogSpo2(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Temp (°C)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      min={34}
                      max={43}
                      value={logTemp}
                      onChange={(e) => setLogTemp(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Systolic BP
                    </label>
                    <input
                      type="number"
                      min={60}
                      max={220}
                      value={logSystolic}
                      onChange={(e) => setLogSystolic(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Diastolic BP
                    </label>
                    <input
                      type="number"
                      min={40}
                      max={140}
                      value={logDiastolic}
                      onChange={(e) => setLogDiastolic(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Clinical Notes / Symptoms (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Taken post-exercise, mild shortness of breath..."
                    value={logNotes}
                    onChange={(e) => setLogNotes(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsLogModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLogging}
                    className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold flex items-center gap-1.5 shadow-md shadow-teal-600/20"
                  >
                    <FileCheck className="w-4 h-4" />
                    <span>{isLogging ? 'Writing to Firestore...' : 'Commit to Firestore'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

