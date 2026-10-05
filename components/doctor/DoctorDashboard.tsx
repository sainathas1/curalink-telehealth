'use client';

import React, { useState, useEffect } from 'react';
import {
  UserProfile,
  Appointment,
  LiveTelemetryPayload,
  PatientDirectoryItem,
} from '../../lib/types';
import { DoctorTab } from '../navbar/Sidebar';
import { db } from '../../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
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
  Droplet,
  Pill,
  Thermometer,
  Cpu,
  X,
  FileText,
  ClipboardList,
} from 'lucide-react';

interface DoctorDashboardProps {
  doctor: UserProfile;
  appointmentsQueue: Appointment[];
  patients: PatientDirectoryItem[];
  liveTelemetry?: LiveTelemetryPayload;
  onNavigateTab: (tab: DoctorTab) => void;
  onStartVideoCall: (appointment: Appointment) => void;
  onOpenEHR: (patientName: string) => void;
}

interface LivePatientIoTData {
  lastSyncedTemperature?: number;
  lastSyncedAt?: string;
  temperatureStatus?: string;
  deviceModel?: string;
  temperatureUnit?: string;
}

export function DoctorDashboard({
  doctor,
  appointmentsQueue,
  patients,
  liveTelemetry,
  onNavigateTab,
  onStartVideoCall,
  onOpenEHR,
}: DoctorDashboardProps) {
  const [selectedPatient, setSelectedPatient] = useState<PatientDirectoryItem | null>(null);
  const [liveIoTData, setLiveIoTData] = useState<LivePatientIoTData | null>(null);
  const [isLiveListening, setIsLiveListening] = useState(false);

  useEffect(() => {
    if (!selectedPatient?.id) {
      setLiveIoTData(null);
      setIsLiveListening(false);
      return;
    }

    if (selectedPatient.lastSyncedTemperature !== undefined) {
      setLiveIoTData({
        lastSyncedTemperature: selectedPatient.lastSyncedTemperature,
        lastSyncedAt: selectedPatient.lastSyncedAt,
        temperatureStatus: selectedPatient.temperatureStatus,
        deviceModel: selectedPatient.deviceModel,
        temperatureUnit: '°C',
      });
    } else {
      setLiveIoTData(null);
    }

    setIsLiveListening(true);
    const userDocRef = doc(db, 'users', selectedPatient.id);
    const unsubscribe = onSnapshot(
      userDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.lastSyncedTemperature !== undefined) {
            setLiveIoTData({
              lastSyncedTemperature: data.lastSyncedTemperature,
              lastSyncedAt: data.lastSyncedAt,
              temperatureStatus: data.temperatureStatus,
              deviceModel: data.deviceModel || 'USB Temperature Sensor',
              temperatureUnit: data.temperatureUnit || '°C',
            });
          }
        }
      },
      (err) => console.warn('Doctor dashboard live IoT onSnapshot notice:', err)
    );

    return () => {
      unsubscribe();
      setIsLiveListening(false);
    };
  }, [selectedPatient?.id]);

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
              {doctor?.fullName || 'Dr. Clinician'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
              {doctor?.specialty || 'General Tele-Medicine'} • CuraLink Telehealth Network. {patients.length > 0 ? `${patients.length} remote patient stream${patients.length === 1 ? '' : 's'} reporting telemetry.` : 'No remote patient telemetry streams active.'}
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
              onClick={() => onOpenEHR(nextVisit?.patientName || '')}
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
            Next: {nextVisit ? `${nextVisit.patientName} (${nextVisit.time})` : 'No upcoming appointments'}
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
            <span className="text-xs text-slate-500 font-medium">Wearable Nodes</span>
          </div>
          <p className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{patients.length > 0 ? 'Real-Time Telemetry Live' : 'Awaiting sensor connect'}</span>
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
            <span className="text-3xl font-black text-slate-900 font-mono">{appointmentsQueue.length}</span>
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

        {appointmentsQueue.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center">
            <Calendar className="w-10 h-10 text-slate-300 mb-2 stroke-1" />
            <p className="font-bold text-slate-700 text-sm">No upcoming appointments</p>
            <p className="text-slate-400 mt-1 max-w-sm">There are no patient consultations currently in your queue.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {appointmentsQueue.map((apt, index) => {
              const matchedPt = patients.find(
                (p) => p.id === apt.patientId || p.name.toLowerCase() === apt.patientName.toLowerCase()
              );
              const bloodGroup = apt.bloodGroup || matchedPt?.bloodGroup;
              const allergies = apt.knownAllergies || matchedPt?.knownAllergies;
              const chronic = apt.chronicConditions || matchedPt?.chronicConditions || [];
              const hasAllergies = allergies && allergies.toLowerCase() !== 'none' && allergies.toLowerCase() !== 'none reported';

              return (
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
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900">{apt.patientName}</h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {apt.type}
                      </span>
                      {bloodGroup && bloodGroup !== 'Not specified' && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold font-mono">
                          <Droplet className="w-2.5 h-2.5 fill-rose-500 text-rose-500" />
                          {bloodGroup}
                        </span>
                      )}
                      {matchedPt?.lastSyncedTemperature !== undefined && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-200 text-[10px] font-bold font-mono">
                          <Thermometer className="w-2.5 h-2.5 text-teal-600" />
                          <span>{matchedPt.lastSyncedTemperature.toFixed(1)}°C (IoT)</span>
                        </span>
                      )}
                      {index === 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 animate-pulse">
                          Ready to Start
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-600 mt-1 max-w-xl">
                      <strong className="text-slate-800">Chief Symptoms:</strong> {apt.symptoms}
                    </p>

                    {/* Medical History Badges */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      {hasAllergies && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-semibold">
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          <span>Allergy: {allergies}</span>
                        </span>
                      )}
                      {chronic.filter(c => c !== 'None').map((c) => (
                        <span
                          key={c}
                          className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-medium"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
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
                    {matchedPt && (
                      <button
                        onClick={() => setSelectedPatient(matchedPt)}
                        className="p-2 rounded-xl border border-teal-200 hover:bg-teal-50 text-teal-700 transition-all cursor-pointer"
                        title="Inspect Patient & IoT Vitals"
                      >
                        <ClipboardList className="w-4 h-4" />
                      </button>
                    )}

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
            );
          })}
          </div>
        )}
      </div>

      {/* Patient Details & Real-Time IoT Vitals Modal */}
      {selectedPatient && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 overflow-y-auto"
          onClick={() => setSelectedPatient(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200 my-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 text-white p-6 relative">
              <button
                onClick={() => setSelectedPatient(null)}
                className="absolute right-4 top-4 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-400/30">
                  Clinical Intake Record
                </span>
                {selectedPatient.hasCompletedOnboarding ? (
                  <span className="text-[10px] font-semibold text-emerald-300 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    Onboarding Complete
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold text-amber-300 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-400" />
                    Pending Patient Intake
                  </span>
                )}
              </div>

              <h3 className="text-xl font-black tracking-tight">{selectedPatient.name}</h3>
              <p className="text-xs text-slate-300 mt-0.5">
                {selectedPatient.age} yrs • {selectedPatient.gender} • {selectedPatient.roomOrBed}
              </p>
            </div>

            {/* Medical Data Details & Dedicated IoT Vitals */}
            <div className="p-6 space-y-5 text-xs text-slate-700 max-h-[75vh] overflow-y-auto">
              {/* Dedicated IoT Vitals Section */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-teal-950 text-white border border-teal-500/30 shadow-md space-y-3 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-36 h-36 bg-teal-500/10 rounded-full blur-2xl pointer-events-none" />

                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300">
                      <Thermometer className="w-4 h-4 text-teal-300" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-xs tracking-tight">IoT Vitals</h4>
                      <p className="text-[10px] text-teal-200/80">USB Sensor Hardware Telemetry</p>
                    </div>
                  </div>

                  {isLiveListening && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      Live onSnapshot
                    </span>
                  )}
                </div>

                {liveIoTData?.lastSyncedTemperature !== undefined && liveIoTData.lastSyncedTemperature !== null ? (
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3.5 border border-white/15 space-y-2.5 relative z-10">
                    <div className="flex items-baseline justify-between">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-teal-200 tracking-wider">
                          Body Temperature (Synced)
                        </span>
                        <div className="flex items-baseline gap-2 mt-0.5">
                          <span className="text-3xl font-black font-mono text-white">
                            {liveIoTData.lastSyncedTemperature.toFixed(1)}°C
                          </span>
                          <span className="text-xs text-slate-300 font-mono">
                            ({((liveIoTData.lastSyncedTemperature * 9) / 5 + 32).toFixed(1)}°F)
                          </span>
                        </div>
                      </div>

                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          liveIoTData.temperatureStatus === 'critical'
                            ? 'bg-rose-500 text-white animate-pulse'
                            : liveIoTData.temperatureStatus === 'elevated'
                            ? 'bg-amber-400 text-slate-900'
                            : 'bg-emerald-500 text-white'
                        }`}
                      >
                        {liveIoTData.temperatureStatus === 'critical'
                          ? 'High Fever'
                          : liveIoTData.temperatureStatus === 'elevated'
                          ? 'Mild Fever'
                          : 'Normal'}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-300">
                      <span className="flex items-center gap-1.5 truncate">
                        <Cpu className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                        <span>{liveIoTData.deviceModel || 'USB Serial Temperature Sensor'}</span>
                      </span>
                      <span className="flex items-center gap-1.5 shrink-0 font-mono text-teal-200">
                        <Clock className="w-3.5 h-3.5" />
                        <span>
                          {liveIoTData.lastSyncedAt
                            ? new Date(liveIoTData.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                            : 'Synced'}
                        </span>
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white/5 rounded-xl p-3 border border-white/10 text-center relative z-10">
                    <p className="text-xs text-slate-300 font-medium">No USB telemetry synced yet</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Patient has not synced temperature data via /patient/device.
                    </p>
                  </div>
                )}
              </div>

              {/* Blood Group */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-rose-50/60 border border-rose-200/80">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600 font-bold">
                    <Droplet className="w-4 h-4 fill-rose-600" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-xs">Blood Group / Type</p>
                    <p className="text-[11px] text-slate-500">Clinical cross-matching baseline</p>
                  </div>
                </div>
                <span className="text-base font-black font-mono text-rose-700 bg-white px-3 py-1 rounded-xl border border-rose-200 shadow-xs">
                  {selectedPatient.bloodGroup || 'Not Reported'}
                </span>
              </div>

              {/* Known Allergies */}
              <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 space-y-1.5">
                <div className="flex items-center gap-2 text-amber-800 font-bold">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Known Drug & Environmental Allergies</span>
                </div>
                <p className="text-xs text-slate-800 bg-white p-3 rounded-xl border border-amber-200/60 font-medium">
                  {selectedPatient.knownAllergies || 'None reported by patient.'}
                </p>
              </div>

              {/* Chronic Conditions */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center gap-2 text-slate-800 font-bold">
                  <Activity className="w-4 h-4 text-teal-600" />
                  <span>Diagnosed Chronic Conditions</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedPatient.chronicConditions && selectedPatient.chronicConditions.length > 0 ? (
                    selectedPatient.chronicConditions.map((cond) => (
                      <span
                        key={cond}
                        className={`px-3 py-1 rounded-xl text-xs font-bold border ${
                          cond === 'None'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-teal-50 text-teal-800 border-teal-200'
                        }`}
                      >
                        {cond}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-500">None reported</span>
                  )}
                </div>
              </div>

              {/* Current Medications */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="flex items-center gap-2 text-slate-800 font-bold">
                  <Pill className="w-4 h-4 text-teal-600" />
                  <span>Current Medications & Dosages</span>
                </div>
                <p className="text-xs text-slate-800 bg-white p-3 rounded-xl border border-slate-200 font-mono whitespace-pre-wrap">
                  {selectedPatient.currentMedications || 'None currently prescribed or reported.'}
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                onClick={() => {
                  const ptName = selectedPatient.name;
                  setSelectedPatient(null);
                  onOpenEHR(ptName);
                }}
                className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <FileText className="w-4 h-4 text-teal-600" />
                <span>Issue Prescription</span>
              </button>

              <button
                onClick={() => {
                  const matchedApt = appointmentsQueue.find((a) => a.patientId === selectedPatient.id || a.patientName === selectedPatient.name);
                  setSelectedPatient(null);
                  if (matchedApt) {
                    onStartVideoCall(matchedApt);
                  } else {
                    onStartVideoCall({
                      id: `apt_quick_${Date.now()}`,
                      patientId: selectedPatient.id,
                      patientName: selectedPatient.name,
                      doctorId: doctor.uid,
                      doctorName: doctor.fullName,
                      doctorSpecialty: doctor.specialty || 'Telehealth Care',
                      date: 'Today',
                      time: 'Now',
                      type: 'Video Call',
                      status: 'Upcoming',
                      symptoms: selectedPatient.condition || 'General Telehealth Observation',
                    });
                  }
                }}
                className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Video className="w-4 h-4" />
                <span>Start Video Call</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
