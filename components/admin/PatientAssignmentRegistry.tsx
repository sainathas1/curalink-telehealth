'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, Users } from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { savePatientAssignment } from './assignment-actions';

const AUTHORIZED_ADMIN_EMAIL = 'sainathas8788@gmail.com';
const buttonStyle = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50';

interface PatientAccount {
  id: string;
  fullName: string;
  email: string;
  assignedDoctorId: string | null;
}
interface AssignmentDoctor { id: string; fullName: string; isVerified: boolean }
interface PatientAssignmentRegistryProps {
  adminUid: string;
  doctors: AssignmentDoctor[];
  cliniciansLoading: boolean;
  cliniciansError: string;
  cliniciansFromCache: boolean;
}
interface RegistryState {
  scope: string;
  patients: PatientAccount[];
  loading: boolean;
  fromCache: boolean;
  error: string;
}
type Feedback = { type: 'success' | 'error'; message: string };

function textValue(...values: unknown[]): string {
  return values.find((value): value is string => typeof value === 'string' && Boolean(value.trim()))?.trim() || '';
}
function failureMessage(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : '';
  if (code === 'permission-denied') return 'Your account does not have permission to manage patient assignments. Contact your Firebase project administrator.';
  if (code === 'unavailable') return 'The service is temporarily unavailable. Check your connection and try again.';
  return error instanceof Error && !code ? error.message : 'The patient assignment could not be saved. Please try again.';
}

export function PatientAssignmentRegistry({ adminUid, doctors, cliniciansLoading, cliniciansError, cliniciansFromCache }: PatientAssignmentRegistryProps) {
  const [registry, setRegistry] = useState<RegistryState>(() => ({ scope: adminUid, patients: [], loading: true, fromCache: true, error: '' }));
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Record<string, Feedback>>({});
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const pendingRef = useRef(new Set<string>());
  const isCurrentAdmin = () => Boolean(adminUid && auth.currentUser?.uid === adminUid && auth.currentUser.email?.trim().toLowerCase() === AUTHORIZED_ADMIN_EMAIL);

  useEffect(() => {
    if (!adminUid || auth.currentUser?.uid !== adminUid || auth.currentUser.email?.trim().toLowerCase() !== AUTHORIZED_ADMIN_EMAIL) return;
    let active = true;
    const patientsQuery = query(collection(db, 'users'), where('role', 'in', ['patient', 'Patient']));
    const unsubscribe = onSnapshot(patientsQuery, { includeMetadataChanges: true }, (snapshot) => {
      if (!active || auth.currentUser?.uid !== adminUid || auth.currentUser.email?.trim().toLowerCase() !== AUTHORIZED_ADMIN_EMAIL) return;
      const patients = snapshot.docs.map((record): PatientAccount => {
        const data = record.data();
        return { id: record.id, fullName: textValue(data.fullName, data.name, data.displayName) || 'Name not provided', email: textValue(data.email), assignedDoctorId: textValue(data.assignedDoctorId) || null };
      }).sort((a, b) => a.fullName.localeCompare(b.fullName));
      setRegistry({ scope: adminUid, patients, loading: false, fromCache: snapshot.metadata.fromCache, error: '' });
    }, (error) => {
      if (!active || auth.currentUser?.uid !== adminUid) return;
      setRegistry((previous) => ({ ...previous, scope: adminUid, loading: false, fromCache: true, error: failureMessage(error) }));
    });
    return () => { active = false; unsubscribe(); };
  }, [adminUid, revision]);

  const view = registry.scope === adminUid ? registry : { patients: [], loading: true, fromCache: true, error: '' };
  const verifiedDoctors = doctors.filter((doctor) => doctor.isVerified);
  const liveDataUnavailable = view.loading || view.fromCache || Boolean(view.error) || cliniciansLoading || cliniciansFromCache || Boolean(cliniciansError);
  const term = search.trim().toLowerCase();
  const patients = view.patients.filter((patient) => !term || patient.fullName.toLowerCase().includes(term) || patient.email.toLowerCase().includes(term));

  const retry = () => {
    setRegistry({ scope: adminUid, patients: view.patients, loading: true, fromCache: true, error: '' });
    setRevision((value) => value + 1);
  };
  const saveAssignment = async (patient: PatientAccount, selectedId: string) => {
    if (liveDataUnavailable || !isCurrentAdmin() || pendingRef.current.has(patient.id)) return;
    pendingRef.current.add(patient.id);
    setPendingIds(new Set(pendingRef.current));
    setFeedback((previous) => { const next = { ...previous }; delete next[patient.id]; return next; });
    try {
      await savePatientAssignment({ adminUid, patientId: patient.id, doctorId: selectedId || null, expectedAssignedDoctorId: patient.assignedDoctorId });
      if (isCurrentAdmin()) setFeedback((previous) => ({ ...previous, [patient.id]: { type: 'success', message: selectedId ? 'Clinician assignment saved.' : 'Patient is now unassigned.' } }));
    } catch (error) {
      if (isCurrentAdmin()) setFeedback((previous) => ({ ...previous, [patient.id]: { type: 'error', message: failureMessage(error) } }));
    } finally {
      pendingRef.current.delete(patient.id);
      setPendingIds(new Set(pendingRef.current));
    }
  };

  return (
    <section id="patient-assignments" className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white" aria-labelledby="patient-assignments-title">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 p-5 sm:p-6">
        <div>
          <h2 id="patient-assignments-title" className="text-lg font-semibold tracking-tight">Patient care assignments</h2>
          <p className="mt-1 text-sm text-slate-500">Assign registered patients to a verified clinician so they appear in the clinician&apos;s care directory.</p>
        </div>
        <label className="w-full sm:w-72">
          <span className="sr-only">Search patient names or email addresses</span>
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search patients…" className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 focus:border-teal-600 focus:outline-2 focus:outline-offset-2 focus:outline-teal-100" />
        </label>
      </div>
      {view.error && <div role="alert" className="m-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><p className="max-w-2xl leading-6">{view.error}</p><button type="button" onClick={retry} className={`${buttonStyle} border border-rose-200 bg-white`}>Try again</button></div>}
      {!view.loading && !view.error && liveDataUnavailable && <p role="status" className="m-5 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">Assignments require live patient and clinician records. Changes become available when both registries are connected.</p>}
      {view.loading ? <div role="status" className="flex items-center justify-center gap-3 px-6 py-12 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin text-teal-700" aria-hidden="true" />Loading patient accounts…</div> : patients.length === 0 ? <div className="px-6 py-12 text-center"><Users className="mx-auto mb-3 h-6 w-6 text-slate-400" aria-hidden="true" /><h3 className="font-semibold">{view.error ? 'Patient registry unavailable' : view.fromCache ? 'Waiting for patient records' : term ? 'No matching patients' : 'No patients registered yet'}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{term ? 'Try another name or email address.' : 'Patient accounts will appear here when they are available.'}</p></div> : <div className="divide-y divide-slate-100">
        {patients.map((patient) => {
          const selectedId = Object.hasOwn(drafts, patient.id) ? drafts[patient.id] : patient.assignedDoctorId || '';
          const selectedUnavailable = Boolean(selectedId && !verifiedDoctors.some((doctor) => doctor.id === selectedId));
          const assignedDoctor = doctors.find((doctor) => doctor.id === patient.assignedDoctorId);
          const pending = pendingIds.has(patient.id);
          const response = feedback[patient.id];
          return <article key={patient.id} className="p-5 sm:p-6">
            <div className="grid items-start gap-4 lg:grid-cols-[1fr_1fr_auto]">
              <div><h3 className="font-semibold text-slate-800">{patient.fullName}</h3><p className="mt-1 break-all text-xs text-slate-500">{patient.email || 'Email not provided'}</p><p className="mt-2 text-xs leading-5 text-slate-500">Current clinician: <span className="font-medium text-slate-700">{assignedDoctor?.fullName || (patient.assignedDoctorId ? 'Assigned clinician unavailable' : 'Unassigned')}</span></p></div>
              <label className="block"><span className="mb-2 block text-xs font-medium text-slate-500">Verified clinician</span><select aria-label={`Assign clinician to ${patient.fullName}`} value={selectedId} disabled={pending || liveDataUnavailable} onChange={(event) => {
                setDrafts((previous) => ({ ...previous, [patient.id]: event.target.value }));
                setFeedback((previous) => { const next = { ...previous }; delete next[patient.id]; return next; });
              }} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:bg-slate-50"><option value="">Unassigned</option>{selectedUnavailable && <option value={selectedId} disabled>Clinician no longer verified or available</option>}{verifiedDoctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.fullName}</option>)}</select>{selectedUnavailable && <p className="mt-2 text-xs leading-5 text-amber-800">Choose a verified clinician or unassign this patient.</p>}</label>
              <button type="button" aria-label={`Save assignment for ${patient.fullName}`} disabled={pending || liveDataUnavailable || selectedUnavailable || selectedId === (patient.assignedDoctorId || '')} onClick={() => saveAssignment(patient, selectedId)} className={`${buttonStyle} bg-teal-700 text-white hover:bg-teal-800 lg:mt-6`}>{pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}{pending ? 'Saving…' : 'Save assignment'}</button>
            </div>
            {response && <p role={response.type === 'error' ? 'alert' : 'status'} className={`mt-3 text-sm leading-6 ${response.type === 'error' ? 'text-rose-700' : 'text-teal-800'}`}>{response.message}</p>}
          </article>;
        })}
      </div>}
      <footer className="border-t border-slate-100 px-5 py-4 text-xs leading-5 text-slate-500 sm:px-6">{verifiedDoctors.length} verified clinician{verifiedDoctors.length === 1 ? '' : 's'} available. Unassigning a patient removes the assigned care relationship; existing booked consultations are retained.</footer>
    </section>
  );
}
