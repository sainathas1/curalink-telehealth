'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { Activity, ArrowRight, CalendarDays, Clock, Droplets, FileText, Heart, LoaderCircle, Pill, Plus, Thermometer, Video, Wifi, WifiOff } from 'lucide-react';
import { db } from '../../lib/firebase';
import { Appointment, LiveTelemetryPayload, MedicalRecord, Prescription, UserProfile } from '../../lib/types';
import { PatientTab } from '../navbar/Sidebar';
import { useTelehealth } from '../../context/TelehealthContext';
import { EmergencySOS } from './EmergencySOS';

interface PatientDashboardProps {
  user: UserProfile; telemetry: LiveTelemetryPayload; appointments: Appointment[];
  prescriptions: Prescription[]; records: MedicalRecord[];
  onNavigateTab: (tab: PatientTab) => void;
  onJoinVideoCall: (appointment: Appointment) => void;
  onEmergencySOS: () => void;
}
interface HardwareReading { uid: string; temperature: number | null; syncedAt: string; deviceModel: string; }

export function PatientDashboard({ user, telemetry, appointments, prescriptions, records, onNavigateTab, onJoinVideoCall, onEmergencySOS }: PatientDashboardProps) {
  const { isSimulating, history, dataLoading, dataError, retryData } = useTelehealth();
  const [hardware, setHardware] = useState<HardwareReading | null>(null);
  const [now, setNow] = useState(0);
  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(clock);
  }, []);
  // Keep the existing saved hardware reading flow; USB connection logic lives in the device page.
  useEffect(() => {
    if (!user.uid) return;
    return onSnapshot(doc(db, 'users', user.uid), snapshot => {
      const data = snapshot.data();
      setHardware({
        uid: user.uid, temperature: typeof data?.lastSyncedTemperature === 'number' ? data.lastSyncedTemperature : null,
        syncedAt: typeof data?.lastSyncedAt === 'string' ? data.lastSyncedAt : '', deviceModel: data?.deviceModel || 'Connected device'
      });
    }, () => setHardware(null));
  }, [user.uid]);

  const safeAppointments = appointments || [];
  const safePrescriptions = prescriptions || [];
  const safeRecords = records || [];
  const upcoming = safeAppointments.filter(appointment => ['upcoming', 'scheduled', 'in progress'].includes((appointment?.status || '').toLowerCase()));
  const nextAppointment = upcoming[0];
  const activePrescriptions = safePrescriptions.filter(prescription => (prescription?.status || '').toLowerCase() === 'active');
  const savedHardware = hardware?.uid === user?.uid ? hardware : null;
  const hasTelemetry = telemetry?.patientId === user?.uid && (telemetry?.timestamp || 0) > 0;
  const live = hasTelemetry && !!telemetry?.sensorConnected && now > 0 && now - telemetry.timestamp >= 0 && now - telemetry.timestamp < 120000;
  const temperature = savedHardware?.temperature ?? (hasTelemetry ? telemetry?.temperature : null);
  const formatReading = (value: number | null | undefined, decimals = 0) => typeof value === 'number' && Number.isFinite(value) && value > 0 ? value.toFixed(decimals) : '—';
  const readings = [
    { label: 'Heart rate', value: formatReading(hasTelemetry ? telemetry?.heartRate : null), unit: 'bpm', icon: Heart, color: 'bg-rose-50 text-rose-600' },
    { label: 'Blood oxygen', value: formatReading(hasTelemetry ? telemetry?.spo2 : null), unit: '%', icon: Droplets, color: 'bg-sky-50 text-sky-700' },
    { label: 'Temperature', value: formatReading(temperature, 1), unit: '°C', icon: Thermometer, color: 'bg-amber-50 text-amber-700' },
    { label: 'Blood pressure', value: hasTelemetry && (telemetry?.systolic || 0) > 0 && (telemetry?.diastolic || 0) > 0 ? `${telemetry.systolic}/${telemetry.diastolic}` : '—', unit: 'mmHg', icon: Activity, color: 'bg-teal-50 text-teal-700' },
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="skeleton h-28 rounded-2xl" />
          <div className="skeleton h-28 rounded-2xl" />
          <div className="skeleton h-28 rounded-2xl" />
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
      <button type="button" onClick={() => onNavigateTab('appointments')} className="care-button self-start transition-all active:scale-[0.98]">
        <Plus size={17} />Book a consultation
      </button>
    </div>

    {/* Superadmin Emergency SOS Hotline Banner */}
    <EmergencySOS onOpenModal={onEmergencySOS} />

    <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
      <section className="relative overflow-hidden rounded-3xl bg-teal-800 p-6 text-white shadow-sm sm:p-7">
        <span className="absolute -right-10 -top-10 size-56 rounded-full border-[35px] border-white/5" aria-hidden="true" />
        <div className="relative">
          <p className="flex items-center gap-2 text-xs font-medium text-teal-100">
            <CalendarDays size={16} />{nextAppointment ? 'YOUR NEXT CONSULTATION' : 'MAKE TIME FOR YOUR HEALTH'}
          </p>
          {nextAppointment ? (
            <>
              <h2 className="mt-5 text-2xl font-semibold tracking-tight">{nextAppointment.doctorName || 'Doctor'}</h2>
              <p className="mt-1 text-sm text-teal-100">{nextAppointment.doctorSpecialty || 'Clinician'}</p>
              <p className="mt-5 flex items-center gap-2 text-sm"><Clock size={16} />{nextAppointment.date} · {nextAppointment.time}</p>
              <div className="mt-6 flex flex-wrap gap-3">
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
              <h2 className="mt-5 max-w-sm text-2xl font-semibold leading-snug tracking-tight">Your next conversation could make a difference.</h2>
              <p className="mt-3 max-w-md text-sm leading-6 text-teal-100">Find a verified clinician and choose a time that works for you.</p>
              <button type="button" onClick={() => onNavigateTab('appointments')} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-teal-900 transition-all hover:bg-teal-50 active:scale-[0.98]">
                Find a clinician<ArrowRight size={17} />
              </button>
            </>
          )}
        </div>
      </section>
      <section className="care-card flex flex-col justify-between p-6 sm:p-7">
        <div>
          <span className="flex size-11 items-center justify-center rounded-2xl bg-[#edf3ed] text-teal-800">
            <Wifi size={21} />
          </span>
          <h2 className="mt-5 text-xl font-semibold tracking-tight">Your health, connected.</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {savedHardware?.temperature !== null && savedHardware ? `Your last temperature reading from ${savedHardware.deviceModel || 'connected device'} is saved to your profile.` : 'Connect a supported device to bring your health readings into view.'}
          </p>
        </div>
        <button type="button" onClick={() => onNavigateTab('device')} className="mt-5 flex min-h-11 items-center justify-between rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-teal-800 transition-all hover:bg-teal-50 active:scale-[0.98]">
          {savedHardware?.temperature !== null && savedHardware ? 'Manage my device' : 'Connect my device'}
          <ArrowRight size={17} />
        </button>
      </section>
    </div>
    <section aria-labelledby="readings-title">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="readings-title" className="text-lg font-semibold tracking-tight text-slate-900">Your latest readings</h2>
          <p className="mt-1 text-xs text-slate-500">
            {isSimulating ? 'Simulation is on. These readings are for demonstration.' : live ? 'Receiving readings from your connected device.' : 'Saved readings stay available here. Connect a device for updates.'}
          </p>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${isSimulating ? 'bg-amber-50 text-amber-800' : live ? 'bg-teal-50 text-teal-800' : 'bg-slate-100 text-slate-600'}`}>
          {live ? <Wifi size={13} /> : <WifiOff size={13} />}
          {isSimulating ? 'Simulation' : live ? 'Device connected' : 'No live connection'}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {readings.map(({ label, value, unit, icon: Icon, color }) => (
          <article key={label} className="care-card p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-600">{label}</span>
              <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${color}`}>
                <Icon size={16} />
              </span>
            </div>
            <p className="mt-5 flex flex-wrap items-baseline gap-1.5">
              <span className="text-3xl font-semibold tracking-tight text-slate-900">{value}</span>
              <span className="text-xs text-slate-500">{unit}</span>
            </p>
            <p className="mt-2 text-xs text-slate-500">
              {value === '—' ? 'No reading received' : label === 'Temperature' && savedHardware?.syncedAt ? 'Last saved on your profile' : 'Last received reading'}
            </p>
          </article>
        ))}
      </div>
      {trend.length > 1 && (
        <div className="care-card mt-3 p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-600">Recent heart rate readings</p>
            <button type="button" onClick={() => onNavigateTab('vitals')} className="rounded-lg px-2 py-1 text-xs font-semibold text-teal-800 transition hover:bg-teal-50 active:scale-[0.98]">
              View trends
            </button>
          </div>
          <svg viewBox="0 0 600 100" role="img" aria-label={`Heart rate over the last ${trend.length} readings, ranging from ${low} to ${high} bpm`} className="mt-3 h-24 w-full text-teal-700">
            <path d={path} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
    </section>
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="care-card p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">Your prescriptions</h2>
          <button type="button" onClick={() => onNavigateTab('prescriptions')} className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-xs font-semibold text-teal-800 transition hover:bg-teal-50 active:scale-[0.98]">
            View all<ArrowRight size={14} />
          </button>
        </div>
        {activePrescriptions.length ? (
          <div className="mt-4 divide-y divide-slate-100">
            {activePrescriptions.slice(0, 3).map(prescription => (
              <div key={prescription.id} className="flex items-center gap-3 py-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                  <Pill size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{prescription.medicationName || 'Medication'}</p>
                  <p className="mt-1 text-xs text-slate-500">{prescription.dosage || 'Dosage'} · {prescription.frequency || 'As directed'}</p>
                </div>
                <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-800">Active</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-9 text-center">
            <Pill className="mx-auto size-7 text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-700">No active prescriptions</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">Prescriptions from your care team will appear here.</p>
          </div>
        )}
      </section>
      <section className="care-card p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">Your health records</h2>
          <button type="button" onClick={() => onNavigateTab('records')} className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-xs font-semibold text-teal-800 transition hover:bg-teal-50 active:scale-[0.98]">
            View all<ArrowRight size={14} />
          </button>
        </div>
        {safeRecords.length ? (
          <div className="mt-4 divide-y divide-slate-100">
            {safeRecords.slice(0, 3).map(record => (
              <button type="button" key={record.id} onClick={() => onNavigateTab('records')} className="flex w-full items-center gap-3 rounded-xl py-3.5 px-2 text-left transition hover:bg-slate-50 active:scale-[0.98]">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                  <FileText size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-800">{record.title || 'Medical Record'}</span>
                  <span className="mt-1 block text-xs text-slate-500">{record.type || 'Clinical Document'} · {record.date || ''}</span>
                </span>
                <ArrowRight size={16} className="text-slate-400" />
              </button>
            ))}
          </div>
        ) : (
          <div className="py-9 text-center">
            <FileText className="mx-auto size-7 text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-700">Start your health story</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">Upload a document or find notes from your next visit.</p>
            <button type="button" onClick={() => onNavigateTab('records')} className="mt-3 rounded-lg px-3 py-2 text-xs font-semibold text-teal-800 transition hover:bg-teal-50 active:scale-[0.98]">
              Add a document<Plus size={13} className="ml-1 inline" />
            </button>
          </div>
        )}
      </section>
    </div>
  </div>
  );
}
