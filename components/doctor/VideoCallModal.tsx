'use client';

import { useEffect, useRef, useState } from 'react';
import { FileText, Loader2, X } from 'lucide-react';
import { Appointment, LiveTelemetryPayload, UserRole, UserProfile } from '../../lib/types';
import { useTelehealth } from '../../context/TelehealthContext';
import VideoCall from '../VideoCall';

interface VideoCallModalProps { isOpen: boolean; onClose: () => void; appointment: Appointment | null; telemetry: LiveTelemetryPayload; onOpenEHR?: () => void; doctorName?: string; role?: UserRole; currentUser?: UserProfile | null; }
function ConsultationNote({ appointment, onOpenEHR }: { appointment: Appointment; onOpenEHR?: () => void }) {
  const { addClinicalNote, currentUser } = useTelehealth();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const allowed = currentUser?.role.toLowerCase() === 'doctor' && currentUser.isVerified === true && currentUser.uid === appointment.doctorId;
  if (!allowed) return null;
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (busy || !note.trim()) return;
    setBusy(true); setError(''); setSaved(false);
    try { await addClinicalNote(appointment.patientId, `Consultation note · ${appointment.patientName}`, note.trim(), appointment.patientName); setSaved(true); setNote(''); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'We could not save the note. Please try again.'); }
    finally { setBusy(false); }
  }
  return <aside className="care-card p-5"><h3 className="flex items-center gap-2 text-base font-semibold text-slate-900"><FileText size={18} className="text-teal-700" />Consultation notes</h3><p className="mt-2 text-xs leading-5 text-slate-500">Saved notes are available in the patient’s health records.</p><form onSubmit={save} className="mt-4"><label className="text-sm font-medium text-slate-700">Clinical note<textarea value={note} onChange={event => { setNote(event.target.value); setSaved(false); }} required maxLength={10000} disabled={busy} rows={8} className="mt-2 w-full resize-y rounded-xl border border-slate-300 p-3 text-sm leading-6" placeholder="Record observations and follow-up details…" /></label>{error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}{saved && <p role="status" className="mt-3 text-sm text-teal-800">Note saved to the patient’s records.</p>}<button type="submit" disabled={busy || !note.trim()} className="care-button mt-4 w-full">{busy && <Loader2 size={16} className="animate-spin" />}{busy ? 'Saving note…' : 'Save clinical note'}</button></form>{onOpenEHR && <button type="button" onClick={onOpenEHR} className="mt-3 min-h-11 w-full rounded-xl border border-slate-200 text-sm font-semibold text-teal-800">Write a prescription</button>}</aside>;
}
export function VideoCallModal({ isOpen, onClose, appointment, onOpenEHR, currentUser }: VideoCallModalProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (isOpen) dialog.current?.showModal(); else dialog.current?.close(); }, [isOpen]);
  return <dialog ref={dialog} aria-labelledby="consultation-title" onCancel={onClose} className="m-auto max-h-[95dvh] w-[calc(100%_-_2rem)] max-w-7xl overflow-y-auto rounded-2xl bg-slate-50 p-4 text-slate-800 shadow-2xl backdrop:bg-slate-900/50 sm:p-6"><header className="mb-5 flex items-center justify-between gap-4"><div><p className="care-eyebrow">VIDEO CONSULTATION</p><h2 id="consultation-title" className="mt-1 text-xl font-semibold">{appointment ? `Visit with ${currentUser?.role.toLowerCase() === 'doctor' ? appointment.patientName : appointment.doctorName}` : 'Choose a booked consultation'}</h2></div><button type="button" onClick={onClose} aria-label="Close consultation" className="rounded-xl border border-slate-200 bg-white p-3"><X size={20} /></button></header>{isOpen && appointment && <div className="grid gap-5 lg:grid-cols-[2fr_1fr]"><VideoCall roomName={appointment.id} userName={currentUser?.fullName} autoStart onLeave={onClose} /><ConsultationNote key={appointment.id} appointment={appointment} onOpenEHR={onOpenEHR} /></div>}{isOpen && !appointment && <p className="p-6 text-sm text-slate-500">Open an active video appointment from your dashboard to begin.</p>}</dialog>;
}
