'use client';

import { useEffect, useState } from 'react';
import { Activity, ArrowRight, CalendarDays, Clock, FileText, Heart, LoaderCircle, Pill, Plus, Video, Wifi, WifiOff } from 'lucide-react';
import { Appointment, LiveTelemetryPayload, MedicalRecord, Prescription, UserProfile } from '../../lib/types';
import { PatientTab } from '../navbar/Sidebar';
import { useTelehealth } from '../../context/TelehealthContext';
import { EmergencySOS } from './EmergencySOS';
import { GeminiHealthAssistant } from './GeminiHealthAssistant';

interface PatientDashboardProps {
  user: UserProfile; telemetry: LiveTelemetryPayload; appointments: Appointment[];
  prescriptions: Prescription[]; records: MedicalRecord[];
  onNavigateTab: (tab: PatientTab) => void;
  onJoinVideoCall: (appointment: Appointment) => void;
  onEmergencySOS: () => void;
}


export function PatientDashboard({ user, telemetry, appointments, prescriptions, records, onNavigateTab, onJoinVideoCall, onEmergencySOS }: PatientDashboardProps) {
  const { isSimulating, history, dataLoading, dataError, retryData } = useTelehealth();
  const [now, setNow] = useState(0);
  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(clock);
  }, []);

  const safeAppointments = appointments || [];
  const safePrescriptions = prescriptions || [];
  const safeRecords = records || [];
  const upcoming = safeAppointments.filter(appointment => ['upcoming', 'scheduled', 'in progress'].includes((appointment?.status || '').toLowerCase()));
  const nextAppointment = upcoming[0];
  const activePrescriptions = safePrescriptions.filter(prescription => (prescription?.status || '').toLowerCase() === 'active');
  const hasTelemetry = telemetry?.patientId === user?.uid && (telemetry?.timestamp || 0) > 0;
  const live = hasTelemetry && !!telemetry?.sensorConnected && now > 0 && now - telemetry.timestamp >= 0 && now - telemetry.timestamp < 120000;
  const formatReading = (value: number | null | undefined, decimals = 0) => typeof value === 'number' && Number.isFinite(value) && value > 0 ? value.toFixed(decimals) : '—';
  const readings = [
    { label: 'Heart rate', value: formatReading(hasTelemetry ? telemetry?.heartRate : null), unit: 'bpm', icon: Heart, color: 'bg-rose-50 text-rose-600' },
  ];
  const trend = (history || []).filter(point => typeof point?.heartRate === 'number' && Number.isFinite(point.heartRate) && point.heartRate > 0);
  const trendValues = trend.map(point => point.heartRate);
  const low = trendValues.length ? Math.min(...trendValues) : 60, high = trendValues.length ? Math.max(...trendValues) : 100;
  const path = trend.map((point, index) => `${index === 0 ? 'M' : 'L'}${(index / Math.max(1, trend.length - 1)) * 600},${85 - ((point.heartRate - low) / Math.max(10, high - low)) * 65}`).join(' ');

  const firstName = (user?.fullName || '').trim().split(' ')[0] || 'there';

  return (
    <div className="space-y-7 animate-in fade-in duration-200">
    {dataError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-900 shadow-sm backdrop-blur-md"><span>{dataError}</span><button type="button" onClick={retryData} className="rounded-xl border border-amber-300 bg-white px-3 py-2 font-semibold transition active:scale-[0.98]">Try again</button></div>}
    {dataLoading && (
      <div role="status" aria-label="Loading health workspace" className="space-y-4 animate-in fade-in duration-200">
        <div className="flex items-center gap-2.5 rounded-2xl border border-slate-200/80 bg-white/80 p-4 text-sm text-slate-500 shadow-sm backdrop-blur-md">
          <LoaderCircle size={17} className="motion-safe:animate-spin text-teal-700" aria-hidden="true" />
          <span>Loading your appointments and care records…</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="skeleton h-28 rounded-2xl" />
        </div>
      </div>
    )}
    <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
      <div>
        <p className="care-eyebrow">YOUR HEALTH, TOGETHER</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          Welcome back, {firstName}.
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">A little clarity for your everyday care.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3 self-start">
        <EmergencySOS variant="compact" onOpenModal={onEmergencySOS} />
        <button type="button" onClick={() => onNavigateTab('appointments')} className="care-button transition-all active:scale-[0.98]">
          <Plus size={17} />Book a consultation
        </button>
      </div>
    </div>

    {/* Gemini Health Assistant Widget */}
    <GeminiHealthAssistant
      prescriptions={safePrescriptions}
      records={safeRecords}
      patientName={firstName}
      onNavigateTab={onNavigateTab}
    />

    <div className="grid gap-6 lg:grid-cols-2">
      {/* Col 1: Clinical Consultations & Cardiac Telemetry */}
      <div className="space-y-6">
        {/* Next Consultation Card */}
        <section className="relative overflow-hidden rounded-3xl bg-teal-800 p-6 text-white shadow-sm sm:p-7">
          <span className="absolute -right-10 -top-10 size-56 rounded-full border-[35px] border-white/5" aria-hidden="true" />
          <div className="relative">
            <p className="flex items-center gap-2 text-xs font-medium text-teal-100">
              <CalendarDays size={16} />{nextAppointment ? 'YOUR NEXT CONSULTATION' : 'MAKE TIME FOR YOUR HEALTH'}
            </p>
            {nextAppointment ? (
              <>
                <h2 className="mt-4 text-2xl font-semibold tracking-tight">{nextAppointment.doctorName || 'Doctor'}</h2>
                <p className="mt-1 text-sm text-teal-100">{nextAppointment.doctorSpecialty || 'Clinician'}</p>
                <p className="mt-4 flex items-center gap-2 text-sm"><Clock size={16} />{nextAppointment.date} · {nextAppointment.time}</p>
                <div className="mt-5 flex flex-wrap gap-3">
                  {nextAppointment.type === 'Video Call' && (
                    <button type="button" onClick={() => onJoinVideoCall(nextAppointment)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-teal-900 transition-all hover:bg-teal-50 active:scale-[0.98]">
                      <Video size={17} />Join consultation
                    </button>
                  )}
                  <button type="button" onClick={() => onNavigateTab('appointments')} className="rounded-xl border border-white/30 px-4 py-2.5 text-sm font-medium transition-all hover:bg-white/10 active:scale-[0.98]">
                    View appointments
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="mt-4 max-w-sm text-2xl font-semibold leading-snug tracking-tight">Your next conversation could make a difference.</h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-teal-100">Find a verified clinician and choose a time that works for you.</p>
                <button type="button" onClick={() => onNavigateTab('appointments')} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-teal-900 transition-all hover:bg-teal-50 active:scale-[0.98]">
                  Find a clinician<ArrowRight size={17} />
                </button>
              </>
            )}
          </div>
        </section>

        {/* Live Cardiac Telemetry Card */}
        <section aria-labelledby="cardiac-telemetry-title" className="care-card p-6">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <span className="flex size-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                <Heart size={20} className={live ? 'animate-pulse fill-rose-600' : ''} />
              </span>
              <div>
                <h2 id="cardiac-telemetry-title" className="text-base font-bold text-slate-900">
                  Cardiac Telemetry (ECG)
                </h2>
                <p className="text-xs text-slate-500">AD8232 Biosensor · Lead I</p>
              </div>
            </div>

            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${isSimulating ? 'bg-amber-50 text-amber-800' : live ? 'bg-teal-50 text-teal-800' : 'bg-slate-100 text-slate-600'}`}>
              {live ? <Wifi size={13} /> : <WifiOff size={13} />}
              {isSimulating ? 'Simulation' : live ? 'Sensor Connected' : 'Standby'}
            </span>
          </div>

          <div className="mt-5 flex items-baseline justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">Resting Heart Rate</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-4xl font-extrabold font-mono tracking-tight text-slate-900">
                  {readings[0].value}
                </span>
                <span className="text-sm font-bold text-slate-500">BPM</span>
              </div>
            </div>
            <div className="text-right">
              <span className="inline-block rounded-full bg-teal-50 px-2.5 py-0.5 text-[11px] font-bold text-teal-800 border border-teal-200/60">
                Target: 60–100 BPM
              </span>
              <p className="mt-1 text-[11px] text-slate-400">
                {live ? 'Real-time telemetry' : 'Awaiting sensor stream'}
              </p>
            </div>
          </div>

          {trend.length > 1 && (
            <div className="mt-4 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                <span className="font-medium">Recent rhythm trend</span>
                <span className="font-mono text-[11px]">{low}–{high} BPM range</span>
              </div>
              <svg viewBox="0 0 600 100" role="img" aria-label={`Heart rate trend ranging from ${low} to ${high} bpm`} className="h-20 w-full text-teal-700">
                <path d={path} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          )}

          <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">Continuous 50Hz cardiac acquisition</span>
            <button
              type="button"
              onClick={() => onNavigateTab('vitals')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-teal-50 px-3 py-1.5 text-xs font-bold text-teal-800 hover:bg-teal-100 transition active:scale-[0.98]"
            >
              <span>Full ECG Monitor</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </section>
      </div>

      {/* Col 2: Clinical Records & Prescriptions */}
      <div className="space-y-6">
        {/* Prescriptions Section */}
        <section className="care-card p-6">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                <Pill size={16} />
              </span>
              <h2 className="text-base font-bold text-slate-900">Active Prescriptions</h2>
            </div>
            <button type="button" onClick={() => onNavigateTab('prescriptions')} className="inline-flex items-center gap-1 text-xs font-semibold text-teal-800 hover:text-teal-900 transition">
              View all<ArrowRight size={13} />
            </button>
          </div>
          {activePrescriptions.length ? (
            <div className="mt-3 divide-y divide-slate-100">
              {activePrescriptions.slice(0, 3).map(prescription => (
                <div key={prescription.id} className="flex items-center gap-3 py-3.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                    <Pill size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{prescription.medicationName || 'Medication'}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{prescription.dosage || 'Dosage'} · {prescription.frequency || 'As directed'}</p>
                  </div>
                  <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-[11px] font-bold text-teal-800">Active</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center">
              <Pill className="mx-auto size-6 text-slate-300" />
              <p className="mt-2 text-sm font-medium text-slate-700">No active prescriptions</p>
              <p className="mt-1 text-xs text-slate-500">Prescriptions from your doctor will appear here.</p>
            </div>
          )}
        </section>

        {/* Health Records Section */}
        <section className="care-card p-6">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                <FileText size={16} />
              </span>
              <h2 className="text-base font-bold text-slate-900">Health Records & Labs</h2>
            </div>
            <button type="button" onClick={() => onNavigateTab('records')} className="inline-flex items-center gap-1 text-xs font-semibold text-teal-800 hover:text-teal-900 transition">
              View all<ArrowRight size={13} />
            </button>
          </div>
          {safeRecords.length ? (
            <div className="mt-3 divide-y divide-slate-100">
              {safeRecords.slice(0, 3).map(record => (
                <button type="button" key={record.id} onClick={() => onNavigateTab('records')} className="flex w-full items-center gap-3 rounded-xl py-3 px-1 text-left transition hover:bg-slate-50 active:scale-[0.98]">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                    <FileText size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-800">{record.title || 'Medical Record'}</span>
                    <span className="mt-0.5 block text-xs text-slate-500">{record.type || 'Clinical Document'} · {record.date || ''}</span>
                  </span>
                  <ArrowRight size={15} className="text-slate-400" />
                </button>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center">
              <FileText className="mx-auto size-6 text-slate-300" />
              <p className="mt-2 text-sm font-medium text-slate-700">No records uploaded yet</p>
              <p className="mt-1 text-xs text-slate-500">Upload reports or access consultation notes.</p>
              <button type="button" onClick={() => onNavigateTab('records')} className="mt-3 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-teal-800 hover:bg-teal-50 transition active:scale-[0.98]">
                Add document<Plus size={12} className="ml-1 inline" />
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  </div>
  );
}
