'use client';

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Download, Eye, FileText, LoaderCircle, X } from 'lucide-react';
import type { ClinicalRecord, PatientDirectoryItem } from '../../lib/types';
import { useTelehealth } from '../../context/TelehealthContext';

export const fieldClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/10';
export const activeAppointmentStatuses = new Set(['scheduled', 'upcoming', 'in progress']);

export function hasRecordedVitals(patient: PatientDirectoryItem) {
  return [patient.currentVitals.heartRate, patient.currentVitals.spo2, patient.currentVitals.temperature, patient.lastSyncedTemperature].some((value) => typeof value === 'number' && value > 0)
    || /^\d{2,3}\/\d{2,3}$/.test(patient.currentVitals.bloodPressure || '');
}

export function clinicDate() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  return ['year', 'month', 'day'].map((type) => parts.find((part) => part.type === type)?.value || '').join('-');
}

export function WorkspaceDataNotice() {
  const { dataLoading, dataError, retryData } = useTelehealth();
  if (dataError) return <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 shadow-sm"><p>{dataError}</p><button type="button" onClick={retryData} className="min-h-10 rounded-xl border border-rose-200 bg-white px-3 font-semibold transition active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-rose-600">Try again</button></div>;
  if (dataLoading) return (
    <div role="status" aria-label="Loading clinical workspace" className="space-y-4 animate-in fade-in duration-200">
      <div className="flex items-center gap-2.5 rounded-2xl border border-slate-200/80 bg-white/80 p-4 text-sm text-slate-500 shadow-sm backdrop-blur-md">
        <LoaderCircle size={17} className="motion-safe:animate-spin text-teal-700" aria-hidden="true" />
        <span>Loading your clinical workspace…</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="skeleton h-28 rounded-2xl" />
        <div className="skeleton h-28 rounded-2xl" />
        <div className="skeleton h-28 rounded-2xl" />
      </div>
    </div>
  );
  return null;
}

export function WorkspaceDialog({ title, onClose, children, busy = false }: { title: string; onClose: () => void; children: ReactNode; busy?: boolean }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog?.showModal();
    return () => { dialog?.close(); document.body.style.overflow = previousOverflow; };
  }, []);
  return <dialog ref={dialogRef} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }} className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-2xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-0 text-slate-800 shadow-2xl backdrop:bg-slate-950/35 backdrop:backdrop-blur-sm"><div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-5 sm:px-7"><h2 id={titleId} className="text-lg font-semibold tracking-tight text-slate-900">{title}</h2><button type="button" onClick={onClose} disabled={busy} aria-label="Close dialog" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-teal-700 disabled:opacity-40"><X size={20} aria-hidden="true" /></button></div><div className="p-5 sm:p-7">{children}</div></dialog>;
}

export function textValue(...values: unknown[]) {
  return values.find((value): value is string => typeof value === 'string' && value.trim().length > 0) || '';
}

export function timestampValue(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Date.parse(value) || 0;
  if (value && typeof value === 'object') {
    const timestamp = value as { toMillis?: () => number; toDate?: () => Date; seconds?: number };
    if (typeof timestamp.toMillis === 'function') return timestamp.toMillis();
    if (typeof timestamp.toDate === 'function') return timestamp.toDate().getTime();
    if (typeof timestamp.seconds === 'number') return timestamp.seconds * 1000;
  }
  return 0;
}

export function recordedDate(value: unknown): string {
  const timestamp = timestampValue(value);
  return timestamp > 0 ? new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' }).format(timestamp) : 'Date not provided';
}

export interface WorkspaceRecord {
  id: string;
  patientId: string;
  patientName: string;
  title: string;
  type: string;
  notes: string;
  date: string;
  doctorName: string;
  attachment: string;
  content: Record<string, unknown>;
  timestamp: number;
}

export function normalizeWorkspaceRecords(records: ClinicalRecord[], patients: PatientDirectoryItem[]): WorkspaceRecord[] {
  return records.map((record) => {
    const raw = record as ClinicalRecord & Record<string, unknown>;
    const content = record.content && typeof record.content === 'object' ? record.content as Record<string, unknown> : {};
    const patient = patients.find((entry) => entry.id === record.patientId);
    const timestamp = timestampValue(record.createdAt);
    return {
      id: record.id, patientId: record.patientId, patientName: textValue(patient?.name, record.patientName, content.patientName) || 'Patient name unavailable',
      title: textValue(record.documentTitle, raw['Document Title'], raw.title, content.title, content.medicationName) || 'Medical record',
      type: textValue(record.recordType, raw['Record Type'], record.type, content.type) || 'Medical record',
      notes: textValue(record.notes, raw['Notes'], raw.summary, raw.clinicalSummary, content.notes, content.summary, typeof record.content === 'string' ? record.content : ''),
      date: timestamp > 0 ? recordedDate(record.createdAt) : textValue(content.date, content.dateIssued, raw.date) || 'Date not provided',
      doctorName: textValue(record.doctorName, content.doctorName),
      attachment: textValue(record.fileData, content.fileData, record.downloadUrl, content.downloadUrl),
      content, timestamp,
    };
  }).sort((left, right) => right.timestamp - left.timestamp);
}

export interface DecodedAttachment {
  blob: Blob;
  objectUrl: string;
  mimeType: string;
  isPdf: boolean;
  isImage: boolean;
  filename: string;
}

export function parseAttachmentToBlob(attachment: string, title: string, id: string): DecodedAttachment | null {
  if (!attachment || typeof attachment !== 'string') return null;
  const trimmed = attachment.trim();
  if (trimmed.length < 10) return null;

  let mimeType = 'application/pdf';
  let base64Data = trimmed;

  const dataUriMatch = trimmed.match(/^data:([^;,]+)(?:;charset=[^;,]+)?(?:;base64)?,([\s\S]*)$/i);
  if (dataUriMatch) {
    mimeType = dataUriMatch[1].toLowerCase();
    base64Data = dataUriMatch[2].replace(/\s/g, '');
  } else {
    const sample = trimmed.slice(0, 30);
    if (sample.startsWith('JVBER')) {
      mimeType = 'application/pdf';
    } else if (sample.startsWith('/9j/')) {
      mimeType = 'image/jpeg';
    } else if (sample.startsWith('iVBOR')) {
      mimeType = 'image/png';
    } else if (sample.startsWith('R0lGO')) {
      mimeType = 'image/gif';
    } else if (sample.startsWith('UklGR')) {
      mimeType = 'image/webp';
    } else if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return null;
    }
    base64Data = trimmed.replace(/\s/g, '');
  }

  try {
    const binaryStr = atob(base64Data);
    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mimeType });
    const objectUrl = URL.createObjectURL(blob);
    const isPdf = mimeType.includes('pdf');
    const isImage = mimeType.startsWith('image/');
    const ext = isPdf ? '.pdf' : mimeType === 'image/jpeg' ? '.jpg' : mimeType === 'image/png' ? '.png' : mimeType === 'image/webp' ? '.webp' : '';
    const safeTitle = (title || 'medical_record_' + id).replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_');
    const filename = safeTitle.toLowerCase().endsWith(ext) ? safeTitle : `${safeTitle}${ext}`;

    return { blob, objectUrl, mimeType, isPdf, isImage, filename };
  } catch (err) {
    console.warn('Failed to decode base64 attachment:', err);
    return null;
  }
}

export function downloadAttachment(attachment: string, title: string, id: string): boolean {
  if (attachment.startsWith('http://') || attachment.startsWith('https://')) {
    const a = document.createElement('a');
    a.href = attachment;
    a.download = title || 'medical_record';
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
  }

  const decoded = parseAttachmentToBlob(attachment, title, id);
  if (!decoded) return false;

  const a = document.createElement('a');
  a.href = decoded.objectUrl;
  a.download = decoded.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  setTimeout(() => {
    URL.revokeObjectURL(decoded.objectUrl);
  }, 2000);

  return true;
}

export function RecordAttachment({ record, preview = false }: { record: WorkspaceRecord; preview?: boolean }) {
  const attachment = record.attachment;
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [decoded, setDecoded] = useState<DecodedAttachment | null>(null);

  useEffect(() => {
    if (!attachment) return;
    const parsed = parseAttachmentToBlob(attachment, record.title, record.id);
    setDecoded(parsed);
    return () => {
      if (parsed) URL.revokeObjectURL(parsed.objectUrl);
    };
  }, [attachment, record.title, record.id]);

  if (!attachment || attachment.trim().length < 10) {
    return <p className="text-xs text-slate-400">No document attached.</p>;
  }

  const isRemote = attachment.startsWith('http://') || attachment.startsWith('https://');
  const previewUrl = decoded ? decoded.objectUrl : isRemote ? attachment : '';
  const isImage = decoded?.isImage || /^data:image\//i.test(attachment);
  const isPdf = decoded?.isPdf || /^data:application\/pdf/i.test(attachment) || (!isImage && !isRemote);

  const handleDownload = () => {
    downloadAttachment(attachment, record.title, record.id);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleDownload}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-teal-800 transition hover:border-teal-300 hover:bg-teal-50 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-teal-700"
        >
          <Download size={14} aria-hidden="true" />Download
        </button>
        {previewUrl && (
          <button
            type="button"
            onClick={() => setIsPreviewOpen(true)}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800 transition hover:bg-teal-100 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-teal-700"
          >
            <Eye size={14} aria-hidden="true" />Preview
          </button>
        )}
      </div>

      {(preview || isPreviewOpen) && previewUrl && (
        preview ? (
          <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
            {isImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt={record.title} className="max-h-96 w-full rounded-xl object-contain shadow-sm" />
            )}
            {isPdf && (
              <iframe src={previewUrl} title={record.title + ' preview'} className="h-96 w-full rounded-xl border border-slate-200 bg-white shadow-sm" />
            )}
          </div>
        ) : (
          <WorkspaceDialog title={`Document Preview: ${record.title}`} onClose={() => setIsPreviewOpen(false)}>
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <span className="text-xs text-slate-500">Format: {decoded?.mimeType || (isPdf ? 'PDF' : 'Image')}</span>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 transition active:scale-[0.98]"
                >
                  <Download size={14} />Download Document
                </button>
              </div>
              <div className="flex items-center justify-center min-h-[400px] rounded-2xl border border-slate-200 bg-slate-900/5 p-2">
                {isImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewUrl} alt={record.title} className="max-h-[70vh] w-auto max-w-full rounded-xl object-contain shadow-md" />
                )}
                {isPdf && (
                  <iframe src={previewUrl} title={record.title} className="h-[70vh] w-full rounded-xl border border-slate-200 bg-white shadow-md" />
                )}
              </div>
            </div>
          </WorkspaceDialog>
        )
      )}
    </div>
  );
}

export function ClinicalNoteDialog({ patient, onClose }: { patient: { id: string; name: string }; onClose: () => void }) {
  const { addClinicalNote } = useTelehealth();
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const savingRef = useRef(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (savingRef.current || !title.trim() || !notes.trim()) return;
    savingRef.current = true; setBusy(true); setError('');
    try { await addClinicalNote(patient.id, title.trim(), notes.trim(), patient.name); setSaved(true); }
    catch { setError('The clinical note could not be saved. Please try again.'); }
    finally { savingRef.current = false; setBusy(false); }
  };
  return <WorkspaceDialog title={saved ? 'Clinical note saved' : 'Add a clinical note'} onClose={onClose} busy={busy}>{saved ? <div><p role="status" className="rounded-xl bg-teal-50 p-4 text-sm text-teal-800">Your note has been saved to {patient.name}’s records.</p><button type="button" autoFocus onClick={onClose} className="care-button mt-5 w-full">Done</button></div> : <form onSubmit={submit} className="space-y-5"><p className="text-sm text-slate-500">Record your observations and follow-up plan for <strong className="font-semibold text-slate-800">{patient.name}</strong>.</p><label className="block text-xs font-semibold text-slate-700">Note title<input required maxLength={200} disabled={busy} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Consultation follow-up" className={fieldClass + ' mt-2'} /></label><label className="block text-xs font-semibold text-slate-700">Clinical observations<textarea required maxLength={10000} rows={6} disabled={busy} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Observations, assessment, and next steps." className={fieldClass + ' mt-2'} /></label>{error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}<button type="submit" disabled={busy || !title.trim() || !notes.trim()} className="care-button w-full">{busy ? <LoaderCircle size={16} className="motion-safe:animate-spin" aria-hidden="true" /> : <FileText size={16} aria-hidden="true" />}{busy ? 'Saving note…' : 'Save clinical note'}</button></form>}</WorkspaceDialog>;
}

export function PatientHistory({ patient }: { patient: PatientDirectoryItem }) {
  const history = [
    ['Blood group', patient.bloodGroup || patient.bloodType || 'Not provided'],
    ['Allergies', patient.knownAllergies || patient.allergies?.join(', ') || 'Not provided'],
    ['Current medication', patient.currentMedications || 'Not provided'],
    ['Conditions', patient.chronicConditions?.join(', ') || patient.condition || 'Not provided'],
    ['Emergency contact', patient.emergencyContact || 'Not provided'],
    ['Last visit', patient.lastVisit || patient.lastVisitDate || 'Not provided'],
  ];
  return <dl className="grid gap-3 sm:grid-cols-2">{history.map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4"><dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</dt><dd className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{value}</dd></div>)}</dl>;
}
