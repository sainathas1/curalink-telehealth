'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  UserProfile,
  LiveTelemetryPayload,
  Appointment,
  Prescription,
  MedicalRecord,
} from '../../lib/types';
import { PatientTab } from '../navbar/Sidebar';
import { db } from '../../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  Heart,
  Droplets,
  Thermometer,
  Calendar,
  Pill,
  FileText,
  Video,
  ArrowRight,
  ShieldCheck,
  Activity,
  AlertTriangle,
  Clock,
  Sparkles,
  PhoneCall,
} from 'lucide-react';

interface PatientDashboardProps {
  user: UserProfile;
  telemetry: LiveTelemetryPayload;
  appointments: Appointment[];
  prescriptions: Prescription[];
  records: MedicalRecord[];
  onNavigateTab: (tab: PatientTab) => void;
  onJoinVideoCall: (appointment: Appointment) => void;
  onEmergencySOS: () => void;
}

export function PatientDashboard({
  user,
  telemetry,
  appointments,
  prescriptions,
  records,
  onNavigateTab,
  onJoinVideoCall,
  onEmergencySOS,
}: PatientDashboardProps) {
  const isScheduledAppointment = (apt?: Appointment | null) => {
    if (!apt) return false;
    const s = (apt.status || '').toLowerCase();
    return s === 'scheduled' || s === 'upcoming' || s === 'in progress' || (s !== 'completed' && s !== 'cancelled');
  };

  const nextAppointment = appointments.find(isScheduledAppointment);
  const activePrescriptions = prescriptions.filter((p) => p.status === 'Active');

  const [hardwareTemp, setHardwareTemp] = useState<number | null>(null);
  const [hardwareTime, setHardwareTime] = useState<string | null>(null);
  const [hardwareStatus, setHardwareStatus] = useState<string>('normal');
  const [deviceModel, setDeviceModel] = useState<string>('USB Sensor');

  useEffect(() => {
    if (!user?.uid) return;

    const userDocRef = doc(db, 'users', user.uid);
    const unsub = onSnapshot(
      userDocRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.lastSyncedTemperature !== undefined) {
            setHardwareTemp(data.lastSyncedTemperature);
          }
          if (data.lastSyncedAt) {
            setHardwareTime(data.lastSyncedAt);
          }
          if (data.temperatureStatus) {
            setHardwareStatus(data.temperatureStatus);
          }
          if (data.deviceModel) {
            setDeviceModel(data.deviceModel);
          }
        }
      },
      (err) => console.warn('Hardware telemetry fetch notice:', err)
    );

    return () => unsub();
  }, [user?.uid]);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-teal-900 via-slate-900 to-emerald-950 text-white p-6 sm:p-8 rounded-3xl shadow-lg border border-teal-800/40 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-400/30">
                Patient Health Hub
              </span>
              <span className="text-xs text-slate-300 flex items-center gap-1 font-mono">
                <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
                Verified Patient
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Welcome back, {user?.fullName ? user.fullName.split(' ')[0] : 'Patient'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
              Continuous IoT biomedical telemetry monitoring and encrypted virtual clinical consultations.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => onNavigateTab('vitals')}
              className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-md shadow-teal-900/50 transition-all cursor-pointer flex items-center gap-2"
            >
              <Activity className="w-4 h-4" />
              <span>Inspect Vitals</span>
            </button>

            <button
              onClick={onEmergencySOS}
              className="px-4 py-2.5 rounded-xl bg-rose-600/90 hover:bg-rose-600 text-white font-bold text-xs shadow-md shadow-rose-900/40 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>Emergency SOS</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 Summary Cards: Next Appointment, Active Prescriptions, Latest Vitals, Hardware Telemetry */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Next Appointment */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Next Appointment
              </span>
              <div className="w-8 h-8 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600">
                <Calendar className="w-4 h-4" />
              </div>
            </div>

            {nextAppointment ? (
              <div className="mt-4 space-y-2">
                <div className="flex items-baseline gap-2">
                  <h4 className="text-base font-bold text-slate-900">
                    {nextAppointment.doctorName}
                  </h4>
                </div>
                <p className="text-xs text-teal-700 font-medium">{nextAppointment.doctorSpecialty}</p>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs flex items-center gap-2 text-slate-700">
                  <Clock className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                  <span className="font-semibold">{nextAppointment.date} at {nextAppointment.time}</span>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-slate-400">
                <Calendar className="w-6 h-6 text-slate-300 mx-auto mb-1 stroke-1" />
                <p className="font-semibold text-slate-600">No upcoming appointments</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Schedule a consultation to meet with a doctor.</p>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            {nextAppointment && isScheduledAppointment(nextAppointment) ? (
              <Link
                href={`/call/${nextAppointment.id}`}
                onClick={() => onJoinVideoCall(nextAppointment)}
                className="w-full py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Video className="w-3.5 h-3.5" />
                <span>Join Call</span>
              </Link>
            ) : (
              <button
                onClick={() => onNavigateTab('appointments')}
                className="w-full py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <span>{nextAppointment ? 'View Appointments' : 'Book Consultation'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Card 2: Active Prescriptions */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Active Prescriptions
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                <Pill className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-900 font-mono">
                  {activePrescriptions.length}
                </span>
                <span className="text-xs text-slate-500 font-medium">Medications Active</span>
              </div>

              {activePrescriptions.length > 0 ? (
                <div className="space-y-1.5">
                  {activePrescriptions.slice(0, 2).map((rx) => (
                    <div
                      key={rx.id}
                      className="p-2 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
                    >
                      <span className="font-bold text-slate-800 truncate">{rx.medicationName}</span>
                      <span className="text-[11px] text-teal-700 font-semibold">{rx.dosage}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-3 text-center text-xs text-slate-400">
                  <p className="font-semibold text-slate-600">No active prescriptions</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Clinical medications will appear here.</p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100">
            <button
              onClick={() => onNavigateTab('prescriptions')}
              className="w-full py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <span>Manage & Refill Rx</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Card 3: Latest Vitals Snapshot */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Latest IoT Telemetry
              </span>
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  telemetry.heartRate === 0
                    ? 'bg-slate-300'
                    : telemetry.status === 'critical'
                    ? 'bg-rose-500 animate-ping'
                    : telemetry.status === 'elevated'
                    ? 'bg-amber-500'
                    : 'bg-emerald-500 animate-pulse'
                }`}
              />
            </div>

            {telemetry.heartRate > 0 || telemetry.sensorConnected ? (
              <>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <Heart className="w-4 h-4 text-rose-500 mx-auto mb-1 animate-pulse" />
                    <span className="text-sm font-black text-slate-900 font-mono block">
                      {telemetry.heartRate}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">BPM</span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <Droplets className="w-4 h-4 text-cyan-500 mx-auto mb-1" />
                    <span className="text-sm font-black text-slate-900 font-mono block">
                      {telemetry.spo2.toFixed(1)}%
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">SpO2</span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <Thermometer className="w-4 h-4 text-amber-500 mx-auto mb-1" />
                    <span className="text-sm font-black text-slate-900 font-mono block">
                      {telemetry.temperature.toFixed(1)}°
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">Temp</span>
                  </div>
                </div>

                <div className="mt-3 text-center">
                  <span
                    className={`inline-block px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      telemetry.status === 'critical'
                        ? 'bg-rose-100 text-rose-800'
                        : telemetry.status === 'elevated'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    Vitals Status: {telemetry.status}
                  </span>
                </div>
              </>
            ) : (
              <div className="py-6 text-center text-xs text-slate-400">
                <Activity className="w-6 h-6 text-slate-300 mx-auto mb-1 stroke-1" />
                <p className="font-semibold text-slate-600">Awaiting Telemetry Stream</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Connect wearable sensor to start monitoring.</p>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100">
            <button
              onClick={() => onNavigateTab('vitals')}
              className="w-full py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Activity className="w-3.5 h-3.5 text-teal-400" />
              <span>Open Vitals Monitor</span>
            </button>
          </div>
        </div>

        {/* Card 4: Hardware Telemetry */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Hardware Telemetry
              </span>
              <div className="w-8 h-8 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600">
                <Thermometer className="w-4 h-4" />
              </div>
            </div>

            {hardwareTemp !== null ? (
              <div className="mt-4 space-y-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-slate-900 font-mono">
                    {hardwareTemp.toFixed(1)}°C
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      hardwareStatus === 'critical'
                        ? 'bg-rose-100 text-rose-800'
                        : hardwareStatus === 'elevated'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {hardwareStatus === 'critical'
                      ? 'Fever'
                      : hardwareStatus === 'elevated'
                      ? 'Mild'
                      : 'Normal'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium">Source: {deviceModel}</p>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-[11px] flex items-center gap-2 text-slate-600">
                  <Clock className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                  <span className="truncate">
                    {hardwareTime ? `Synced: ${new Date(hardwareTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Synced recently'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-slate-400">
                <Thermometer className="w-6 h-6 text-slate-300 mx-auto mb-1 stroke-1" />
                <p className="font-semibold text-slate-600">No USB Telemetry Synced</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Connect your USB sensor to stream vitals.</p>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100">
            <button
              onClick={() => onNavigateTab('device')}
              className="w-full py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
            >
              <Thermometer className="w-3.5 h-3.5" />
              <span>Record Vitals</span>
            </button>
          </div>
        </div>
      </div>

      {/* Quick Access Grid: Medical Records, Clinical Consultations, IoT Setup */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Recent Medical Records Quick View */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-teal-600" />
              <h3 className="text-sm font-bold text-slate-900">Recent Lab & Clinical Records</h3>
            </div>
            <button
              onClick={() => onNavigateTab('records')}
              className="text-xs font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1 cursor-pointer"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {records.length > 0 ? (
            <div className="mt-3 space-y-2">
              {records.slice(0, 3).map((rec) => (
                <div
                  key={rec.id}
                  className="p-3 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors flex items-center justify-between text-xs"
                >
                  <div>
                    <h5 className="font-bold text-slate-800">{rec.title}</h5>
                    <p className="text-[11px] text-slate-400">{rec.facility} • {rec.date}</p>
                  </div>
                  <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md">
                    {rec.type}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-slate-400">
              <p className="font-semibold text-slate-600">No medical records found</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Uploaded diagnostic files will appear here.</p>
            </div>
          )}
        </div>

        {/* Patient Care Team & Emergency Hotline */}
        <div className="bg-gradient-to-br from-slate-900 to-teal-950 text-white rounded-2xl border border-slate-800 p-5 shadow-xs flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-teal-400" />
              <h3 className="text-sm font-bold text-white">Your Primary Care Team</h3>
            </div>

            <div className="p-3 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-teal-200">CuraLink Medical Directorate</span>
                <span className="text-[10px] font-bold bg-teal-500/20 text-teal-300 px-2 py-0.5 rounded-full">
                  24/7 On-Duty
                </span>
              </div>
              <p className="text-[11px] text-slate-300">Board-Certified Telehealth Clinicians</p>
              <p className="text-[10px] text-slate-400">Encrypted Clinical Consultation Network</p>
            </div>

            <p className="text-xs text-slate-300">
              Need immediate triage? Contact CuraLink 24/7 Remote Clinical Support or trigger SOS.
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
            <span className="text-xs text-teal-400 font-mono font-bold flex items-center gap-1.5">
              <PhoneCall className="w-3.5 h-3.5" />
              1-800-CURALINK
            </span>
            <button
              onClick={() => onNavigateTab('appointments')}
              className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs transition-all cursor-pointer"
            >
              Book Session
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
