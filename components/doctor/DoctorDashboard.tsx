'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Calendar, Clock, FileText, LoaderCircle, Plus, Users, Video } from 'lucide-react';
import type { UserProfile, Appointment, LiveTelemetryPayload, PatientDirectoryItem } from '../../lib/types';
import type { DoctorTab } from '../navbar/Sidebar';
import { useTelehealth } from '../../context/TelehealthContext';
import { formatAppointmentDate } from '../patient/BookAppointmentModal';
import { activeAppointmentStatuses, ClinicalNoteDialog, normalizeWorkspaceRecords, recordedDate, WorkspaceDataNotice } from './DoctorWorkspaceSupport';

interface DoctorDashboardProps {
  doctor: UserProfile;
  appointmentsQueue: Appointment[];
  patients: PatientDirectoryItem[];
  liveTelemetry?: LiveTelemetryPayload;
  onNavigateTab: (tab: DoctorTab) => void;
  onStartVideoCall: (appointment: Appointment) => void;
  onOpenEHR: (patientName: string, patientId?: string) => void;
}

export function DoctorDashboard({ doctor, onNavigateTab, onStartVideoCall, onOpenEHR }: DoctorDashboardProps) {
  const { doctorAppointmentsQueue, patientDirectory, clinicalRecords, dataLoading, updateAppointmentStatus } = useTelehealth();
  const [filter, setFilter] = useState<'Upcoming' | 'Completed' | 'All'>('Upcoming');
  const [updatingId, setUpdatingId] = useState('');
  const [error, setError] = useState('');
  const [notePatient, setNotePatient] = useState<{ id: string; name: string } | null>(null);
  const updatingRef = useRef(false);
  const upcoming = doctorAppointmentsQueue.filter((appointment) => activeAppointmentStatuses.has(appointment.status.toLowerCase()));
  const completed = doctorAppointmentsQueue.filter((appointment) => appointment.status.toLowerCase() === 'completed');
  const queue = filter === 'Upcoming' ? upcoming : filter === 'Completed' ? completed : doctorAppointmentsQueue;
  const records = normalizeWorkspaceRecords(clinicalRecords, patientDirectory);
  const stats = [
    { label: 'Upcoming visits', value: upcoming.length, icon: Calendar, detail: 'Appointments in your queue' },
    { label: 'Assigned patients', value: patientDirectory.length, icon: Users, detail: 'People connected to your care' },
    { label: 'Completed visits', value: completed.length, icon: FileText, detail: 'Consultations marked complete' },
  ];

  const updateStatus = async (appointment: Appointment, status: string) => {
    if (updatingRef.current) return;
    updatingRef.current = true; setUpdatingId(appointment.id); setError('');
    try { await updateAppointmentStatus(appointment.id, status); }
    catch { setError('The appointment could not be updated. Please try again.'); }
    finally { updatingRef.current = false; setUpdatingId(''); }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><p className="care-eyebrow mb-2">Your clinical workspace</p><h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Welcome, {doctor.fullName}</h1><p className="mt-2 text-sm text-slate-500">A clear view of your consultations and the people in your care.</p></div><p className="flex items-center gap-2 text-xs text-slate-400"><Calendar size={15} aria-hidden="true" />{recordedDate(new Date())}</p></div>
      <WorkspaceDataNotice />
      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
      <div className="grid gap-4 sm:grid-cols-3">{stats.map(({ label, value, icon: Icon, detail }) => <div key={label} className="care-card p-5"><div className="flex items-center justify-between"><p className="text-xs font-medium text-slate-500">{label}</p><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-700"><Icon size={18} aria-hidden="true" /></span></div><p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{dataLoading ? '—' : value}</p><p className="mt-1 text-[11px] text-slate-400">{detail}</p></div>)}</div>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section aria-labelledby="consultation-queue-title" className="care-card overflow-hidden">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center"><div><h2 id="consultation-queue-title" className="text-base font-semibold text-slate-900">Consultation queue</h2><p className="mt-1 text-xs text-slate-400">Your assigned appointments, updated as they change.</p></div><div className="flex gap-1 rounded-xl bg-slate-50 p-1" aria-label="Filter consultation queue">{(['Upcoming', 'Completed', 'All'] as const).map((value) => <button type="button" key={value} onClick={() => setFilter(value)} aria-pressed={filter === value} className={`min-h-9 rounded-lg px-3 text-xs font-medium focus-visible:outline-2 focus-visible:outline-teal-700 ${filter === value ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-500'}`}>{value}</button>)}</div></div>
          {!queue.length ? <div className="px-5 py-14 text-center"><span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-teal-700"><Calendar size={25} aria-hidden="true" /></span><h3 className="text-base font-semibold text-slate-800">{dataLoading ? 'Loading your queue' : 'Your queue is clear'}</h3><p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-500">{dataLoading ? 'Your consultations will appear shortly.' : 'Appointments booked with you will appear here. Use the patient directory to review your existing care relationships.'}</p></div> : <ul className="divide-y divide-slate-100">{queue.map((appointment) => {
            const active = activeAppointmentStatuses.has(appointment.status.toLowerCase());
            return <li key={appointment.id} className="p-5"><div className="flex flex-col justify-between gap-3 sm:flex-row"><div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal-50 text-sm font-semibold text-teal-800">{appointment.patientName.split(' ').filter(Boolean).slice(0, 2).map((name) => name[0]).join('')}</span><div><h3 className="text-sm font-semibold text-slate-900">{appointment.patientName}</h3><p className="mt-1 text-xs text-slate-500">{appointment.type}</p><p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-slate-500"><Clock size={13} aria-hidden="true" />{formatAppointmentDate(appointment.date)}<span aria-hidden="true">·</span>{appointment.time}</p></div></div><span className={`h-fit w-fit rounded-full px-2.5 py-1 text-[10px] font-medium ${active ? 'bg-teal-50 text-teal-800' : 'bg-slate-100 text-slate-500'}`}>{appointment.status.toLowerCase() === 'scheduled' ? 'Upcoming' : appointment.status}</span></div>{appointment.symptoms && <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-500">{appointment.symptoms}</p>}<div className="mt-4 flex flex-wrap items-center justify-end gap-2"><button type="button" onClick={() => setNotePatient({ id: appointment.patientId, name: appointment.patientName })} className="min-h-10 rounded-lg px-3 text-xs font-medium text-slate-500 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-teal-700"><Plus size={14} className="mr-1.5 inline" aria-hidden="true" />Add note</button><button type="button" onClick={() => onOpenEHR(appointment.patientName, appointment.patientId)} className="min-h-10 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-teal-700">Prescribe</button>{active && <button type="button" onClick={() => void updateStatus(appointment, 'Completed')} disabled={!!updatingId} className="min-h-10 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-500 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-teal-700 disabled:opacity-50">{updatingId === appointment.id ? <LoaderCircle size={15} className="motion-safe:animate-spin" aria-label="Updating appointment" /> : 'Complete visit'}</button>}{active && appointment.type === 'Video Call' && <button type="button" onClick={() => onStartVideoCall(appointment)} className="care-button text-xs"><Video size={16} aria-hidden="true" />Start video visit</button>}</div></li>;
          })}</ul>}
        </section>
        <div className="space-y-5"><section className="care-card p-5"><h2 className="text-sm font-semibold text-slate-900">Keep care moving</h2><p className="mt-2 text-xs leading-relaxed text-slate-400">Review a patient’s history before your next consultation.</p><button type="button" onClick={() => onNavigateTab('patient-directory')} className="mt-4 flex min-h-11 w-full items-center justify-between rounded-xl bg-teal-50 px-3 text-xs font-semibold text-teal-800 focus-visible:outline-2 focus-visible:outline-teal-700">Open patient directory<ArrowRight size={15} aria-hidden="true" /></button></section><section className="care-card p-5"><div className="flex items-center justify-between"><h2 className="text-sm font-semibold text-slate-900">Recent records</h2><Link href="/doctor/records" className="rounded-lg p-2 text-teal-700 focus-visible:outline-2 focus-visible:outline-teal-700" aria-label="View all medical records"><ArrowRight size={16} aria-hidden="true" /></Link></div>{!records.length ? <p className="mt-4 text-xs leading-relaxed text-slate-400">{dataLoading ? 'Loading records…' : 'Records from your assigned patients will appear here.'}</p> : <ul className="mt-3 divide-y divide-slate-100">{records.slice(0, 4).map((record) => <li key={record.id} className="py-3"><p className="text-xs font-semibold text-slate-700">{record.title}</p><p className="mt-1 text-[11px] text-slate-400">{record.patientName} · {record.date}</p></li>)}</ul>}</section></div>
      </div>
      {notePatient && <ClinicalNoteDialog key={notePatient.id} patient={notePatient} onClose={() => setNotePatient(null)} />}
    </div>
  );
}
