'use client';

import React, { useState } from 'react';
import { PatientDirectoryItem, LiveTelemetryPayload } from '../../lib/types';
import {
  Activity,
  Heart,
  Droplets,
  Thermometer,
  Gauge,
  AlertTriangle,
  Video,
  FileText,
  User,
  Search,
  Filter,
  Radio,
  Sliders,
} from 'lucide-react';

interface MultiPatientMonitorProps {
  patients: PatientDirectoryItem[];
  liveTelemetry?: LiveTelemetryPayload;
  onStartVideoCall: (patientName: string) => void;
  onOpenEHR: (patientName: string, patientId?: string) => void;
  onOpenSimulator: () => void;
}

export function MultiPatientMonitor({
  patients,
  liveTelemetry,
  onStartVideoCall,
  onOpenEHR,
  onOpenSimulator,
}: MultiPatientMonitorProps) {
  const [filter, setFilter] = useState<'All' | 'Critical' | 'Monitored' | 'Stable'>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const activeTelemetry = liveTelemetry;

  // Update patient card with live telemetry stream if patient matches
  const updatedPatients = patients.map((pt) => {
    if (activeTelemetry && pt.id === activeTelemetry.patientId) {
      const isStandby = !activeTelemetry.sensorConnected || activeTelemetry.heartRate === 0;
      const status = isStandby
        ? pt.status
        : activeTelemetry.status === 'critical'
        ? ('Critical' as const)
        : activeTelemetry.status === 'elevated'
        ? ('Monitored' as const)
        : ('Stable' as const);

      return {
        ...pt,
        status,
        currentVitals: {
          heartRate: activeTelemetry.heartRate,
          spo2: activeTelemetry.spo2,
          temperature: activeTelemetry.temperature,
          bloodPressure: `${activeTelemetry.systolic}/${activeTelemetry.diastolic}`,
        },
      };
    }
    return pt;
  });

  const filtered = updatedPatients.filter((pt) => {
    const matchesFilter = filter === 'All' ? true : pt.status === filter;
    const matchesSearch =
      pt.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pt.condition.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const criticalCount = updatedPatients.filter((p) => p.status === 'Critical').length;
  const monitoredCount = updatedPatients.filter((p) => p.status === 'Monitored').length;

  return (
    <div className="space-y-6">
      {/* Top Banner & Emergency Counter */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Live Patient Telemetry & Ward Command
            </h2>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
              Active Multi-Stream
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time biometric feed from deployed ESP32 wearable hospital and home-care nodes
          </p>
        </div>

        {/* Status Counters & Simulator Quick Trigger */}
        <div className="flex items-center flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200/70">
            <span className="px-2.5 py-1 rounded-lg bg-rose-500 text-white font-bold flex items-center gap-1 shadow-xs">
              <AlertTriangle className="w-3.5 h-3.5" />
              {criticalCount} Critical
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-amber-500 text-white font-bold">
              {monitoredCount} Monitored
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold">
              {updatedPatients.length - criticalCount - monitoredCount} Stable
            </span>
          </div>

          <button
            onClick={onOpenSimulator}
            className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            title="Simulate Arrhythmias and Fevers"
          >
            <Sliders className="w-3.5 h-3.5 text-teal-400" />
            <span>Telemetry Simulator</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search patients, conditions, beds..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium focus:outline-none focus:border-teal-500 shadow-xs"
          />
        </div>

        <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-xs w-full sm:w-auto">
          {(['All', 'Critical', 'Monitored', 'Stable'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                filter === tab
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Patient Telemetry Cards or Empty State */}
      {filtered.length === 0 ? (
        <div className="py-12 px-6 rounded-2xl bg-white border border-slate-200/80 flex flex-col items-center justify-center text-center shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mb-3">
            <Radio className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-semibold text-slate-800 mb-1">
            No records found
          </h4>
          <p className="text-xs text-slate-500 max-w-sm">
            There are currently no patients streaming IoT vitals under the selected filter. When patient IoT nodes connect or register in the ward, their live vitals will appear here in real time.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((pt) => {
          const isCritical = pt.status === 'Critical';
          const isMonitored = pt.status === 'Monitored';

          return (
            <div
              key={pt.id}
              className={`rounded-2xl p-5 border-2 transition-all shadow-xs flex flex-col justify-between ${
                isCritical
                  ? 'bg-rose-50/40 border-rose-400 shadow-rose-100'
                  : isMonitored
                  ? 'bg-amber-50/30 border-amber-300'
                  : 'bg-white border-slate-200/80 hover:border-slate-300'
              }`}
            >
              <div className="space-y-4">
                {/* Header: Name, Room, Status badge */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 shadow-xs ${
                        isCritical
                          ? 'bg-rose-600 text-white animate-bounce'
                          : 'bg-teal-50 text-teal-800 border border-teal-200/70'
                      }`}
                    >
                      {pt.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900">{pt.name}</h3>
                        <span className="text-xs text-slate-400">
                          {pt.age}y • {pt.gender}
                        </span>
                      </div>
                      <p className="text-xs text-teal-700 font-medium">{pt.condition}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{pt.roomOrBed}</p>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                      isCritical
                        ? 'bg-rose-600 text-white animate-pulse'
                        : isMonitored
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    }`}
                  >
                    {pt.status}
                  </span>
                </div>

                {/* Vitals Telemetry Row */}
                <div className="grid grid-cols-4 gap-2 text-center">
                  {/* Heart Rate */}
                  <div
                    className={`p-2 rounded-xl border ${
                      pt.currentVitals.heartRate >= 120 || pt.currentVitals.heartRate < 50
                        ? 'bg-rose-100 border-rose-300 text-rose-900 animate-pulse'
                        : pt.currentVitals.heartRate > 100
                        ? 'bg-amber-100 border-amber-300 text-amber-900'
                        : 'bg-slate-50 border-slate-100 text-slate-800'
                    }`}
                  >
                    <Heart className="w-3.5 h-3.5 mx-auto mb-0.5 text-rose-500 fill-rose-500" />
                    <span className="text-sm font-black font-mono block">
                      {pt.currentVitals.heartRate}
                    </span>
                    <span className="text-[9px] text-slate-500 uppercase font-semibold">BPM</span>
                  </div>

                  {/* SpO2 */}
                  <div
                    className={`p-2 rounded-xl border ${
                      pt.currentVitals.spo2 < 92
                        ? 'bg-rose-100 border-rose-300 text-rose-900 animate-pulse'
                        : pt.currentVitals.spo2 < 95
                        ? 'bg-amber-100 border-amber-300 text-amber-900'
                        : 'bg-slate-50 border-slate-100 text-slate-800'
                    }`}
                  >
                    <Droplets className="w-3.5 h-3.5 mx-auto mb-0.5 text-cyan-500" />
                    <span className="text-sm font-black font-mono block">
                      {pt.currentVitals.spo2}%
                    </span>
                    <span className="text-[9px] text-slate-500 uppercase font-semibold">SpO2</span>
                  </div>

                  {/* Body Temp */}
                  <div
                    className={`p-2 rounded-xl border ${
                      pt.currentVitals.temperature >= 38.3
                        ? 'bg-rose-100 border-rose-300 text-rose-900 animate-pulse'
                        : pt.currentVitals.temperature >= 37.5
                        ? 'bg-amber-100 border-amber-300 text-amber-900'
                        : 'bg-slate-50 border-slate-100 text-slate-800'
                    }`}
                  >
                    <Thermometer className="w-3.5 h-3.5 mx-auto mb-0.5 text-amber-500" />
                    <span className="text-sm font-black font-mono block">
                      {pt.currentVitals.temperature}°C
                    </span>
                    <span className="text-[9px] text-slate-500 uppercase font-semibold">Temp</span>
                  </div>

                  {/* Blood Pressure */}
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 text-slate-800">
                    <Gauge className="w-3.5 h-3.5 mx-auto mb-0.5 text-indigo-500" />
                    <span className="text-xs font-black font-mono block mt-0.5">
                      {pt.currentVitals.bloodPressure}
                    </span>
                    <span className="text-[9px] text-slate-500 uppercase font-semibold">mmHg</span>
                  </div>
                </div>

                {isCritical && (
                  <p className="text-[11px] font-bold text-rose-700 bg-rose-100/80 p-2 rounded-xl border border-rose-200 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Threshold breach: Immediate clinician evaluation recommended.</span>
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-4 pt-3 border-t border-slate-200/70 flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-400 font-mono">
                  Next: {pt.nextAppointment || 'None scheduled'}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onOpenEHR(pt.name, pt.id)}
                    className="px-3 py-1.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>EHR / Rx</span>
                  </button>

                  <button
                    onClick={() => onStartVideoCall(pt.name)}
                    className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs transition-all cursor-pointer"
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>Video Visit</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        </div>
      )}
    </div>
  );
}
