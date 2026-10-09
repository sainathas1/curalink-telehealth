'use client';

import { useState } from 'react';
import { Activity, FileText, Heart, Search, Sliders, Thermometer, Video } from 'lucide-react';
import type { Appointment, LiveTelemetryPayload, PatientDirectoryItem } from '../../lib/types';
import { useTelehealth } from '../../context/TelehealthContext';
import { activeAppointmentStatuses, ClinicalNoteDialog, fieldClass, hasRecordedVitals, timestampValue, WorkspaceDataNotice } from './DoctorWorkspaceSupport';

interface MultiPatientMonitorProps {
  patients: PatientDirectoryItem[];
  liveTelemetry?: LiveTelemetryPayload;
  onStartVideoCall: (appointment: Appointment) => void;
  onOpenEHR: (patientName: string, patientId?: string) => void;
  onOpenSimulator: () => void;
}

export function MultiPatientMonitor({ onStartVideoCall, onOpenEHR, onOpenSimulator }: MultiPatientMonitorProps) {
  const { patientDirectory, doctorAppointmentsQueue, dataLoading } = useTelehealth();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'All' | 'With readings' | 'No readings' | 'Needs attention'>('All');
  const [notePatient, setNotePatient] = useState<{ id: string; name: string } | null>(null);
  const hasReadings = hasRecordedVitals;
  const withReadings = patientDirectory.filter(hasReadings);
  const needsAttention = withReadings.filter((patient) => patient.status === 'Critical');
  const patients = patientDirectory.filter((patient) => patient.name.toLowerCase().includes(search.trim().toLowerCase()) && (filter === 'All' || (filter === 'With readings' ? hasReadings(patient) : filter === 'No readings' ? !hasReadings(patient) : hasReadings(patient) && patient.status === 'Critical')));
  const stats = [['Patients with readings', withReadings.length], ['Need attention', needsAttention.length], ['Awaiting readings', patientDirectory.length - withReadings.length]];

  return <div className="mx-auto max-w-7xl space-y-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><p className="care-eyebrow mb-2">Connected to your patients</p><h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Patient monitoring</h1><p className="mt-2 text-sm text-slate-500">Review the recorded readings shared by patients in your care.</p></div><button type="button" onClick={onOpenSimulator} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 focus-visible:outline-2 focus-visible:outline-teal-700"><Sliders size={16} aria-hidden="true" />Open simulator</button></div>
    <WorkspaceDataNotice />
    <div className="grid gap-4 sm:grid-cols-3">{stats.map(([label, value]) => <div key={label} className="care-card p-5"><p className="text-xs text-slate-500">{label}</p><p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{dataLoading ? '—' : value}</p></div>)}</div>
    <div className="care-card flex flex-col gap-4 p-4 sm:flex-row sm:items-center"><div className="relative flex-1"><label htmlFor="monitor-search" className="sr-only">Search monitored patients</label><Search size={17} className="absolute left-3 top-3.5 text-slate-400" aria-hidden="true" /><input id="monitor-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search patient name" className={fieldClass + ' pl-9'} /></div><div className="flex flex-wrap gap-1 rounded-xl bg-slate-50 p-1" aria-label="Filter patient readings">{(['All', 'With readings', 'No readings', 'Needs attention'] as const).map((value) => <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)} className={`min-h-9 rounded-lg px-3 text-xs font-medium focus-visible:outline-2 focus-visible:outline-teal-700 ${filter === value ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-500'}`}>{value}</button>)}</div></div>
    {!patients.length ? <div className="care-card px-5 py-16 text-center"><span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-teal-700"><Activity size={25} aria-hidden="true" /></span><h2 className="text-base font-semibold text-slate-800">{dataLoading ? 'Loading recorded readings' : 'No patients match this view'}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500">Your assigned patients and their recorded measurements will appear here. Try another filter to see patients awaiting readings.</p></div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{patients.map((patient) => {
      const appointment = doctorAppointmentsQueue.find((entry) => entry.patientId === patient.id && entry.type === 'Video Call' && activeAppointmentStatuses.has(entry.status.toLowerCase()));
      const lastUpdate = timestampValue(patient.lastSyncedAt);
      const temperature = patient.lastSyncedTemperature || patient.currentVitals.temperature;
      const metrics = [
        { label: 'Heart rate', value: patient.currentVitals.heartRate > 0 ? patient.currentVitals.heartRate + ' bpm' : '—', icon: Heart },
        { label: 'Oxygen level', value: patient.currentVitals.spo2 > 0 ? patient.currentVitals.spo2 + '%' : '—', icon: Activity },
        { label: 'Temperature', value: temperature > 0 ? temperature.toFixed(1) + ' °C' : '—', icon: Thermometer },
      ];
      return <article key={patient.id} className={`care-card p-5 ${hasReadings(patient) && patient.status === 'Critical' ? 'border-rose-200' : ''}`}><div className="flex items-start justify-between gap-2"><div><h2 className="text-sm font-semibold text-slate-900">{patient.name}</h2><p className="mt-1 text-xs text-slate-400">{patient.deviceModel || 'Device information not provided'}</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] ${hasReadings(patient) && patient.status === 'Critical' ? 'bg-rose-50 text-rose-700' : 'bg-slate-50 text-slate-500'}`}>{hasReadings(patient) ? patient.status : 'No readings'}</span></div><dl className="mt-5 space-y-3">{metrics.map(({ label, value, icon: Icon }) => <div key={label} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3"><dt className="flex items-center gap-2 text-xs text-slate-500"><Icon size={15} className="text-teal-700" aria-hidden="true" />{label}</dt><dd className="text-sm font-semibold text-slate-800">{value}</dd></div>)}{patient.currentVitals.bloodPressure && !['0/0', '—', 'Not provided', 'N/A'].includes(patient.currentVitals.bloodPressure) && <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3"><dt className="text-xs text-slate-500">Blood pressure</dt><dd className="text-sm font-semibold text-slate-800">{patient.currentVitals.bloodPressure}</dd></div>}</dl><p className="mt-4 text-[10px] text-slate-400">{lastUpdate > 0 ? 'Last recorded ' + new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }).format(lastUpdate) : 'Update time not provided'}</p><div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={() => setNotePatient({ id: patient.id, name: patient.name })} className="mr-auto min-h-10 rounded-lg text-xs font-semibold text-teal-800 focus-visible:outline-2 focus-visible:outline-teal-700">Add note</button><button type="button" onClick={() => onOpenEHR(patient.name, patient.id)} aria-label={'Prescribe for ' + patient.name} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 focus-visible:outline-2 focus-visible:outline-teal-700"><FileText size={16} aria-hidden="true" /></button>{appointment && <button type="button" onClick={() => onStartVideoCall(appointment)} aria-label={'Join booked video visit with ' + patient.name} className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700 text-white focus-visible:outline-2 focus-visible:outline-teal-700"><Video size={16} aria-hidden="true" /></button>}</div></article>;
    })}</div>}
    {notePatient && <ClinicalNoteDialog key={notePatient.id} patient={notePatient} onClose={() => setNotePatient(null)} />}
  </div>;
}
