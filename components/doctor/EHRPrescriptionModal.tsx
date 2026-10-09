'use client';

import { useRef, useState, type FormEvent } from 'react';
import { collection, doc } from 'firebase/firestore';
import { CheckCircle2, FileText, LoaderCircle, Pill } from 'lucide-react';
import { db } from '../../lib/firebase';
import type { Prescription, PatientDirectoryItem } from '../../lib/types';
import { useTelehealth } from '../../context/TelehealthContext';
import { clinicDate, fieldClass, PatientHistory, WorkspaceDialog } from './DoctorWorkspaceSupport';

interface EHRPrescriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onIssuePrescription: (prescription: Prescription) => Promise<void>;
  defaultPatientName?: string;
  defaultPatientId?: string;
  doctorId?: string;
  doctorName?: string;
  doctorLicense?: string;
  patientDirectory?: PatientDirectoryItem[];
}

export function EHRPrescriptionModal(props: EHRPrescriptionModalProps) {
  if (!props.isOpen) return null;
  return <PrescriptionEditor key={props.defaultPatientId || 'select-patient'} {...props} />;
}

function PrescriptionEditor({ onClose, onIssuePrescription, defaultPatientId = '', doctorId, doctorName, doctorLicense, patientDirectory = [] }: EHRPrescriptionModalProps) {
  const { currentUser, addClinicalNote, dataLoading } = useTelehealth();
  const [recordType, setRecordType] = useState<'Prescription' | 'Clinical Note'>('Prescription');
  const [patientId, setPatientId] = useState(defaultPatientId);
  const [medication, setMedication] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState('');
  const [duration, setDuration] = useState('');
  const [refills, setRefills] = useState(0);
  const [instructions, setInstructions] = useState('');
  const [noteTitle, setNoteTitle] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const prescriptionIdRef = useRef('');
  const savingRef = useRef(false);
  const patient = patientDirectory.find((entry) => entry.id === patientId);
  const accountId = currentUser?.uid || '';
  const accountName = currentUser?.fullName || doctorName || '';
  const license = currentUser?.licenseNumber || doctorLicense || '';
  const dateIssued = clinicDate();
  const canWrite = !!patient && currentUser?.role.toLowerCase() === 'doctor' && currentUser.isVerified === true && (!doctorId || doctorId === accountId);
  const canSubmit = canWrite && !busy && (recordType === 'Clinical Note' ? !!noteTitle.trim() && !!instructions.trim() : !!license && !!medication.trim() && !!dosage.trim() && !!frequency.trim() && !!duration.trim() && !!validUntil && validUntil >= dateIssued);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (savingRef.current || !canSubmit || !patient) return;
    savingRef.current = true; setBusy(true); setError('');
    try {
      if (recordType === 'Clinical Note') {
        await addClinicalNote(patient.id, noteTitle.trim(), instructions.trim(), patient.name);
      } else {
        if (!prescriptionIdRef.current) prescriptionIdRef.current = doc(collection(db, 'prescriptions')).id;
        const prescription: Prescription = {
          id: prescriptionIdRef.current, patientId: patient.id, patientName: patient.name,
          doctorId: accountId, doctorName: accountName, doctorLicense: license,
          medicationName: medication.trim(), dosage: dosage.trim(), frequency: frequency.trim(),
          duration: duration.trim(), instructions: instructions.trim(), dateIssued, validUntil,
          refillsLeft: refills, status: 'Active',
        };
        // The context callback owns the only prescription write.
        await onIssuePrescription(prescription);
      }
      setSaved(true);
    } catch {
      setError('The ' + (recordType === 'Prescription' ? 'prescription' : 'clinical note') + ' could not be saved. Please try again.');
    } finally { savingRef.current = false; setBusy(false); }
  };

  return <WorkspaceDialog title={saved ? recordType + ' saved' : 'Prescribe & document care'} onClose={onClose} busy={busy}>
    {saved ? <div className="text-center"><span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-teal-50 text-teal-700"><CheckCircle2 size={27} aria-hidden="true" /></span><p role="status" className="text-sm leading-relaxed text-slate-600">The {recordType.toLowerCase()} has been saved to {patient?.name}’s care records.</p><button type="button" autoFocus onClick={onClose} className="care-button mt-6 w-full">Done</button></div> : <form onSubmit={submit} className="space-y-5">
      <div className="flex gap-1 rounded-xl bg-slate-50 p-1" aria-label="Choose record type">{(['Prescription', 'Clinical Note'] as const).map((type) => <button type="button" key={type} disabled={busy} aria-pressed={recordType === type} onClick={() => { setRecordType(type); setError(''); }} className={`flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg text-xs font-semibold focus-visible:outline-2 focus-visible:outline-teal-700 ${recordType === type ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-500'}`}>{type === 'Prescription' ? <Pill size={16} aria-hidden="true" /> : <FileText size={16} aria-hidden="true" />}{type === 'Clinical Note' ? 'Clinical note' : type}</button>)}</div>
      <label className="block text-xs font-semibold text-slate-700">Patient<select value={patientId} required disabled={busy || dataLoading} onChange={(event) => { setPatientId(event.target.value); prescriptionIdRef.current = ''; }} className={fieldClass + ' mt-2'}><option value="">Select an assigned patient</option>{(patientDirectory || []).map((entry) => <option key={entry?.id} value={entry?.id}>{entry?.name}</option>)}</select></label>
      {!(patientDirectory || []).length && <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">{dataLoading ? 'Loading your assigned patients…' : 'No assigned patients are available. A care relationship is required before writing a record.'}</p>}
      {patient && <details className="rounded-xl border border-slate-200 p-4"><summary className="cursor-pointer text-xs font-semibold text-teal-800">Review patient health history</summary><div className="mt-4"><PatientHistory patient={patient} /></div></details>}
      {recordType === 'Prescription' ? <><div className="grid gap-4 sm:grid-cols-2"><label className="block text-xs font-semibold text-slate-700">Medication name<input value={medication} onChange={(event) => setMedication(event.target.value)} required maxLength={200} disabled={busy} className={fieldClass + ' mt-2'} placeholder="Medication and formulation" /></label><label className="block text-xs font-semibold text-slate-700">Dosage<input value={dosage} onChange={(event) => setDosage(event.target.value)} required maxLength={120} disabled={busy} className={fieldClass + ' mt-2'} placeholder="Enter prescribed dosage" /></label><label className="block text-xs font-semibold text-slate-700">Frequency<input value={frequency} onChange={(event) => setFrequency(event.target.value)} required maxLength={120} disabled={busy} className={fieldClass + ' mt-2'} placeholder="Enter prescribed frequency" /></label><label className="block text-xs font-semibold text-slate-700">Duration<input value={duration} onChange={(event) => setDuration(event.target.value)} required maxLength={120} disabled={busy} className={fieldClass + ' mt-2'} placeholder="Enter treatment duration" /></label><label className="block text-xs font-semibold text-slate-700">Valid until<input type="date" value={validUntil} min={dateIssued} onChange={(event) => setValidUntil(event.target.value)} required disabled={busy} className={fieldClass + ' mt-2'} /></label><label className="block text-xs font-semibold text-slate-700">Refills<input type="number" value={refills} min={0} max={12} step={1} onChange={(event) => setRefills(Number(event.target.value))} required disabled={busy} className={fieldClass + ' mt-2'} /></label></div>{!license && <p className="rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">Your account needs a registered medical license number before a prescription can be saved. Contact your administrator to update your credentials.</p>}</> : <label className="block text-xs font-semibold text-slate-700">Clinical note title<input value={noteTitle} onChange={(event) => setNoteTitle(event.target.value)} required maxLength={200} disabled={busy} className={fieldClass + ' mt-2'} placeholder="Assessment or follow-up title" /></label>}
      <label className="block text-xs font-semibold text-slate-700">{recordType === 'Prescription' ? 'Patient instructions' : 'Clinical observations'}<textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} required={recordType === 'Clinical Note'} maxLength={10000} disabled={busy} rows={4} className={fieldClass + ' mt-2'} placeholder={recordType === 'Prescription' ? 'Administration instructions and follow-up guidance.' : 'Assessment, observations, and follow-up plan.'} /></label>
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-5"><p className="text-[11px] leading-relaxed text-slate-400">Recorded by {accountName}{recordType === 'Prescription' && license ? ' · ' + license : ''}</p><button type="submit" disabled={!canSubmit} className="care-button shrink-0">{busy && <LoaderCircle size={16} className="motion-safe:animate-spin" aria-hidden="true" />}{busy ? 'Saving…' : recordType === 'Prescription' ? 'Save prescription' : 'Save note'}</button></div>
    </form>}
  </WorkspaceDialog>;
}
