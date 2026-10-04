'use client';

import React from 'react';
import {
  UserProfile,
  Appointment,
  LiveTelemetryPayload,
  PatientDirectoryItem,
} from '../../lib/types';
import { DoctorTab } from '../navbar/Sidebar';
import {
  Video,
  Users,
  Activity,
  Stethoscope,
  Clock,
  AlertTriangle,
  Calendar,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  FilePlus,
} from 'lucide-react';

interface DoctorDashboardProps {
  doctor: UserProfile;
  appointmentsQueue: Appointment[];
  patients: PatientDirectoryItem[];
  liveSarahTelemetry: LiveTelemetryPayload;
  onNavigateTab: (tab: DoctorTab) => void;
  onStartVideoCall: (appointment: Appointment) => void;
  onOpenEHR: (patientName: string) => void;
}

export function DoctorDashboard({
  doctor,
  appointmentsQueue,
  patients,
  liveSarahTelemetry,
  onNavigateTab,
  onStartVideoCall,
  onOpenEHR,
}: DoctorDashboardProps) {
  const criticalCount = patients.filter((p) => p.status === 'Critical').length;
  const nextVisit = appointmentsQueue[0];

  return (
    <div className="space-y-6">
      {/* Clinician Welcome Hero */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 text-white p-6 sm:p-8 rounded-3xl shadow-lg border border-slate-700/60 relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-400/30">
                Clinician Workspace
              </span>
              <span className="text-xs text-slate-300 flex items-center gap-1 font-mono">
                <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
                {doctor.licenseNumber || 'Verified MD'}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              {doctor.fullName}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
              {doctor.specialty || 'Cardiology & Intensive Care'} • CuraLink Telehealth Network. 4 continuous remote patient streams currently reporting telemetry.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => onNavigateTab('ward-telemetry')}
              className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-md shadow-teal-900/50 transition-all cursor-pointer flex items-center gap-2"
            >
              <Activity className="w-4 h-4" />
              <span>Ward Telemetry Stream</span>
            </button>

            <button
              onClick={() => onOpenEHR(nextVisit?.patientName || 'Sarah Jenkins')}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/20 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <FilePlus className="w-4 h-4 text-teal-300" />
              <span>Issue Digital Rx</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 Clinical Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Today's Queue */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Today&apos;s Appointments
            </span>
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 font-mono">
              {appointmentsQueue.length}
            </span>
            <span className="text-xs text-slate-500 font-medium">Scheduled</span>
          </div>
          <p className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-teal-700 font-semibold">
            Next: {nextVisit ? `${nextVisit.patientName} (${nextVisit.time})` : 'All clear'}
          </p>
        </div>

        {/* Card 2: Critical Ward Alarms */}
        <div
          className={`rounded-2xl p-5 border shadow-xs cursor-pointer transition-all ${
            criticalCount > 0
              ? 'bg-rose-50/50 border-rose-300'
              : 'bg-white border-slate-200/80'
          }`}
          onClick={() => onNavigateTab('ward-telemetry')}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Ward Alerts
            </span>
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                criticalCount > 0 ? 'bg-rose-500 text-white animate-bounce' : 'bg-slate-100 text-slate-600'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-rose-600 font-mono">{criticalCount}</span>
            <span className="text-xs text-slate-500 font-medium">Critical Thresholds</span>
          </div>
          <p className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-rose-700 font-bold">
            {criticalCount > 0 ? 'Urgent attention required' : 'All parameters nominal'}
          </p>
        </div>

        {/* Card 3: Active IoT Streams */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Monitored Patients
            </span>
            <div className="w-8 h-8 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 font-mono">
              {patients.length}
            </span>
            <span className="text-xs text-slate-500 font-medium">ESP32 Nodes</span>
          </div>
          <p className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>100% Signal Integrity</span>
          </p>
        </div>

        {/* Card 4: Prescription Compliance */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Clinical Queue
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Stethoscope className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 font-mono">3</span>
            <span className="text-xs text-slate-500 font-medium">Pending EHR Notes</span>
          </div>
          <p className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-500 font-mono">
            Digital Rx Ready
          </p>
        </div>
      </div>

      {/* Today's Scheduled Patient Queue with 1-Click Video Call Action */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">Today&apos;s Telehealth Queue</h3>
            <p className="text-xs text-slate-500">Upcoming virtual consultations and clinical triage slots</p>
          </div>
          <span className="text-xs font-bold text-teal-700 bg-teal-50 px-3 py-1 rounded-full border border-teal-200/60">
            {appointmentsQueue.length} Visits Scheduled
          </span>
        </div>

        <div className="space-y-3">
          {appointmentsQueue.map((apt, index) => (
            <div
              key={apt.id}
              className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                index === 0
                  ? 'bg-teal-50/40 border-teal-300 shadow-xs'
                  : 'bg-white border-slate-200/80 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-teal-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
                  {apt.patientName
                    .split(' ')
                    .map((n) => n[0])
                    .join('')}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-900">{apt.patientName}</h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      {apt.type}
                    </span>
                    {index === 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 animate-pulse">
                        Ready to Start
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-1 max-w-xl">
                    <strong className="text-slate-800">Chief Symptoms:</strong> {apt.symptoms}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200">
                <div className="text-left sm:text-right">
                  <p className="text-xs font-bold text-slate-800 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-teal-600" />
                    <span>{apt.time}</span>
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono">{apt.date}</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onOpenEHR(apt.patientName)}
                    className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition-all cursor-pointer"
                    title="Open EHR"
                  >
                    <Stethoscope className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => onStartVideoCall(apt)}
                    className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md shadow-teal-600/20 transition-all cursor-pointer flex items-center gap-2"
                  >
                    <Video className="w-4 h-4" />
                    <span>Start Video Call</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
