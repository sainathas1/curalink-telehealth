'use client';

import { useState } from 'react';
import { Calendar, Clock, Plus, Video } from 'lucide-react';
import type { Appointment } from '../../lib/types';
import { BookAppointmentModal, formatAppointmentDate } from './BookAppointmentModal';
import { useTelehealth } from '../../context/TelehealthContext';

interface AppointmentsListProps {
  appointments: Appointment[];
  onBookAppointment: (appointment: Appointment) => Promise<void>;
  onJoinVideoCall: (appointment: Appointment) => void;
  patientName: string;
  patientId: string;
}

const activeStatuses = new Set(['scheduled', 'upcoming', 'in progress']);
const isActive = (appointment?: Appointment | null) => !!appointment?.status && activeStatuses.has(appointment.status.toLowerCase());

function appointmentTimestamp(appointment: Appointment) {
  if (!appointment?.date) return NaN;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(appointment.date)) return Date.parse(appointment.date);
  const time = /^(\d{1,2}):(\d{2})\s*(AM|PM)/i.exec(appointment.time || '');
  const hour = time ? Number(time[1]) % 12 + (time[3].toUpperCase() === 'PM' ? 12 : 0) : 0;
  const minute = time ? time[2] : '00';
  return Date.parse(appointment.date + 'T' + String(hour).padStart(2, '0') + ':' + minute + ':00+05:30');
}

function PaymentStatus({ appointment }: { appointment?: Appointment | null }) {
  const paid = appointment?.paymentStatus === 'Paid';
  const waived = appointment?.paymentStatus === 'Waived';
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-medium ${paid || waived ? 'bg-teal-50 text-teal-800' : 'bg-amber-50 text-amber-800'}`}>{paid ? 'Paid' : waived ? 'Fee waived' : appointment?.paymentStatus === 'Pending' ? 'Payment pending' : 'Payment status unavailable'}{paid && typeof appointment?.paymentAmount === 'number' ? ' · ₹' + appointment.paymentAmount : ''}</span>;
}

export function AppointmentsList({ appointments, onBookAppointment, onJoinVideoCall, patientName, patientId }: AppointmentsListProps) {
  const { updateAppointmentStatus, currentUser } = useTelehealth();
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [filter, setFilter] = useState<'All' | 'Upcoming' | 'Completed' | 'Cancelled'>('All');
  const [cancellingId, setCancellingId] = useState('');
  const [confirmCancelId, setConfirmCancelId] = useState('');
  const [error, setError] = useState('');
  const canBook = currentUser?.uid === patientId && currentUser?.role?.toLowerCase() === 'patient';
  const safeAppointments = appointments || [];
  const sorted = [...safeAppointments].sort((left, right) => {
    const first = appointmentTimestamp(left);
    const second = appointmentTimestamp(right);
    return (Number.isNaN(first) ? Infinity : first) - (Number.isNaN(second) ? Infinity : second);
  });
  const filtered = sorted.filter((appointment) => filter === 'All' || (filter === 'Upcoming' ? isActive(appointment) : (appointment?.status || '').toLowerCase() === filter.toLowerCase()));
  const next = sorted.find(isActive);

  const cancelAppointment = async (appointment: Appointment) => {
    if (cancellingId) return;
    setCancellingId(appointment.id);
    setError('');
    try {
      await updateAppointmentStatus(appointment.id, 'cancelled');
      setConfirmCancelId('');
    } catch {
      setError('Your appointment could not be cancelled. Please try again.');
    } finally {
      setCancellingId('');
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><p className="care-eyebrow mb-2">Your care calendar</p><h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Appointments</h1><p className="mt-2 text-sm text-slate-500">Make time for your health. Book a visit and stay connected to your care team.</p></div><button type="button" onClick={() => setIsBookModalOpen(true)} disabled={!canBook} className="care-button shrink-0"><Plus size={17} aria-hidden="true" />Book an appointment</button></div>
      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
      {next && <section aria-labelledby="next-visit-title" className="rounded-3xl border border-teal-100 bg-teal-50/60 p-5 sm:p-7"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center"><div><p id="next-visit-title" className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-teal-700">Your next visit</p><h2 className="text-xl font-semibold tracking-tight text-slate-900">{next.doctorName}</h2><p className="mt-1 text-sm text-teal-800">{next.doctorSpecialty}</p><p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500"><Calendar size={14} aria-hidden="true" />{formatAppointmentDate(next.date)}<span aria-hidden="true">·</span>{next.time}</p><div className="mt-3"><PaymentStatus appointment={next} /></div></div>{next.type === 'Video Call' && <button type="button" onClick={() => onJoinVideoCall(next)} className="care-button"><Video size={17} aria-hidden="true" />Join consultation</button>}</div></section>}
      <section aria-labelledby="visit-history-title" className="care-card overflow-hidden">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:px-7"><div><h2 id="visit-history-title" className="text-base font-semibold text-slate-900">Your visits</h2><p className="mt-1 text-xs text-slate-400">{filtered.length} {filtered.length === 1 ? 'appointment' : 'appointments'}</p></div><div aria-label="Filter appointments" className="flex flex-wrap gap-1 rounded-xl bg-slate-50 p-1">{(['All', 'Upcoming', 'Completed', 'Cancelled'] as const).map((value) => <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)} className={`min-h-9 rounded-lg px-3 text-xs font-medium focus-visible:outline-2 focus-visible:outline-teal-600 ${filter === value ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>{value}</button>)}</div></div>
        {filtered.length === 0 ? <div className="px-5 py-14 text-center"><span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-teal-700"><Calendar size={25} aria-hidden="true" /></span><h3 className="text-base font-semibold text-slate-800">{filter === 'All' ? 'Your care journey starts here' : 'No ' + filter.toLowerCase() + ' appointments'}</h3><p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-500">{filter === 'All' ? 'Choose a verified clinician and a time that works for you.' : 'Your visits will appear here when they match this filter.'}</p>{filter === 'All' && <button type="button" onClick={() => setIsBookModalOpen(true)} disabled={!canBook} className="care-button mt-6"><Plus size={16} aria-hidden="true" />Book your first visit</button>}</div> : <ul className="divide-y divide-slate-100">{filtered.map((appointment) => <li key={appointment.id} className="px-5 py-5 sm:px-7"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div className="flex min-w-0 items-start gap-3.5"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-teal-700">{appointment.type === 'Video Call' ? <Video size={19} aria-hidden="true" /> : <Calendar size={19} aria-hidden="true" />}</span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold text-slate-900">{appointment.doctorName}</h3><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${isActive(appointment) ? 'bg-teal-50 text-teal-800' : 'bg-slate-100 text-slate-500'}`}>{appointment.status.toLowerCase() === 'scheduled' ? 'Upcoming' : appointment.status}</span></div><p className="mt-1 text-xs text-slate-500">{appointment.doctorSpecialty}</p><p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-slate-500"><Clock size={13} aria-hidden="true" />{formatAppointmentDate(appointment.date)}<span aria-hidden="true">·</span>{appointment.time}</p>{appointment.symptoms && <p className="mt-2 max-w-lg text-xs leading-relaxed text-slate-400">{appointment.symptoms}</p>}</div></div><div className="sm:shrink-0"><PaymentStatus appointment={appointment} /></div></div>
          {isActive(appointment) && <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-4">{confirmCancelId === appointment.id ? <div className="flex w-full flex-wrap items-center justify-end gap-2"><p className="mr-auto text-xs font-medium text-slate-600">Cancel this appointment?</p><button type="button" disabled={!!cancellingId} onClick={() => setConfirmCancelId('')} className="min-h-10 rounded-lg px-3 text-xs font-semibold text-slate-500 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-teal-600">Keep visit</button><button type="button" disabled={!!cancellingId} onClick={() => void cancelAppointment(appointment)} className="min-h-10 rounded-lg bg-rose-50 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-100 focus-visible:outline-2 focus-visible:outline-rose-600 disabled:opacity-50">{cancellingId === appointment.id ? 'Cancelling…' : 'Confirm cancellation'}</button></div> : <><button type="button" onClick={() => { setConfirmCancelId(appointment.id); setError(''); }} className="min-h-10 rounded-lg px-3 text-xs font-medium text-slate-400 hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-2 focus-visible:outline-teal-600">Cancel visit</button>{appointment.type === 'Video Call' && <button type="button" onClick={() => onJoinVideoCall(appointment)} className="care-button text-xs"><Video size={15} aria-hidden="true" />Join consultation</button>}</>}</div>}
        </li>)}</ul>}
      </section>
      <BookAppointmentModal isOpen={isBookModalOpen} onClose={() => setIsBookModalOpen(false)} onBook={onBookAppointment} patientName={patientName} patientId={patientId} />
    </div>
  );
}
