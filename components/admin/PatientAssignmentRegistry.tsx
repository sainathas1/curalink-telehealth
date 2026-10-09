'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Filter, Loader2, Search, UserCheck, UserMinus, Users } from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { savePatientAssignment } from './assignment-actions';

const AUTHORIZED_ADMIN_EMAIL = 'sainathas8788@gmail.com';
const buttonStyle = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]';

interface PatientAccount {
  id: string;
  fullName: string;
  email: string;
  assignedDoctorId: string | null;
}

interface AssignmentDoctor {
  id: string;
  fullName: string;
  isVerified: boolean;
}

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
type AssignmentFilter = 'all' | 'unassigned' | 'assigned';

function textValue(...values: unknown[]): string {
  return values.find((value): value is string => typeof value === 'string' && Boolean(value.trim()))?.trim() || '';
}

function failureMessage(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? (error as { code: string }).code : '';
  if (code === 'permission-denied') return 'Your account does not have permission to manage patient assignments. Contact your Firebase project administrator.';
  if (code === 'unavailable') return 'The service is temporarily unavailable. Check your connection and try again.';
  return error instanceof Error && !code ? error.message : 'The patient assignment could not be saved. Please try again.';
}

export function PatientAssignmentRegistry({
  adminUid,
  doctors = [],
  cliniciansLoading,
  cliniciansError,
  cliniciansFromCache,
}: PatientAssignmentRegistryProps) {
  const [registry, setRegistry] = useState<RegistryState>(() => ({
    scope: adminUid,
    patients: [],
    loading: true,
    fromCache: true,
    error: '',
  }));
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<AssignmentFilter>('all');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Record<string, Feedback>>({});
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const pendingRef = useRef(new Set<string>());

  const isCurrentAdmin = () =>
    Boolean(
      adminUid &&
        auth.currentUser?.uid === adminUid &&
        auth.currentUser.email?.trim().toLowerCase() === AUTHORIZED_ADMIN_EMAIL
    );

  useEffect(() => {
    if (
      !adminUid ||
      auth.currentUser?.uid !== adminUid ||
      auth.currentUser.email?.trim().toLowerCase() !== AUTHORIZED_ADMIN_EMAIL
    ) {
      return;
    }
    let active = true;
    const patientsQuery = query(collection(db, 'users'), where('role', 'in', ['patient', 'Patient']));
    const unsubscribe = onSnapshot(
      patientsQuery,
      { includeMetadataChanges: true },
      (snapshot) => {
        if (!active || auth.currentUser?.uid !== adminUid || auth.currentUser.email?.trim().toLowerCase() !== AUTHORIZED_ADMIN_EMAIL) return;
        const patientsList = (snapshot?.docs || [])
          .map((record): PatientAccount => {
            const data = record.data() || {};
            return {
              id: record.id,
              fullName: textValue(data?.fullName, data?.name, data?.displayName) || 'Name not provided',
              email: textValue(data?.email),
              assignedDoctorId: textValue(data?.assignedDoctorId) || null,
            };
          })
          .sort((a, b) => (a?.fullName || '').localeCompare(b?.fullName || ''));

        setRegistry({
          scope: adminUid,
          patients: patientsList,
          loading: false,
          fromCache: snapshot.metadata.fromCache,
          error: '',
        });
      },
      (error) => {
        if (!active || auth.currentUser?.uid !== adminUid) return;
        setRegistry((previous) => ({
          ...previous,
          scope: adminUid,
          loading: false,
          fromCache: true,
          error: failureMessage(error),
        }));
      }
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, [adminUid, revision]);

  const view = registry.scope === adminUid ? registry : { patients: [], loading: true, fromCache: true, error: '' };
  const allPatients = view.patients || [];
  const verifiedDoctors = (doctors || []).filter((doctor) => doctor?.isVerified);
  const liveDataUnavailable =
    view.loading || view.fromCache || Boolean(view.error) || cliniciansLoading || cliniciansFromCache || Boolean(cliniciansError);

  const term = search.trim().toLowerCase();
  const unassignedCount = allPatients.filter((p) => !p?.assignedDoctorId).length;
  const assignedCount = allPatients.filter((p) => Boolean(p?.assignedDoctorId)).length;

  const filteredByStatus =
    filter === 'unassigned'
      ? allPatients.filter((p) => !p?.assignedDoctorId)
      : filter === 'assigned'
      ? allPatients.filter((p) => Boolean(p?.assignedDoctorId))
      : allPatients;

  const patients = (filteredByStatus || []).filter((patient) => {
    if (!term) return true;
    const nameMatch = (patient?.fullName || '').toLowerCase().includes(term);
    const emailMatch = (patient?.email || '').toLowerCase().includes(term);
    return nameMatch || emailMatch;
  });

  const retry = () => {
    setRegistry({ scope: adminUid, patients: view.patients, loading: true, fromCache: true, error: '' });
    setRevision((value) => value + 1);
  };

  const saveAssignment = async (patient: PatientAccount, selectedId: string) => {
    if (liveDataUnavailable || !isCurrentAdmin() || pendingRef.current.has(patient.id)) return;
    pendingRef.current.add(patient.id);
    setPendingIds(new Set(pendingRef.current));
    setFeedback((previous) => {
      const next = { ...previous };
      delete next[patient.id];
      return next;
    });
    try {
      await savePatientAssignment({
        adminUid,
        patientId: patient.id,
        doctorId: selectedId || null,
        expectedAssignedDoctorId: patient.assignedDoctorId,
      });
      if (isCurrentAdmin()) {
        setFeedback((previous) => ({
          ...previous,
          [patient.id]: {
            type: 'success',
            message: selectedId ? 'Clinician assignment saved successfully.' : 'Patient has been unassigned.',
          },
        }));
      }
    } catch (error) {
      if (isCurrentAdmin()) {
        setFeedback((previous) => ({
          ...previous,
          [patient.id]: { type: 'error', message: failureMessage(error) },
        }));
      }
    } finally {
      pendingRef.current.delete(patient.id);
      setPendingIds(new Set(pendingRef.current));
    }
  };

  return (
    <section
      id="patient-assignments"
      className="mt-8 overflow-hidden rounded-3xl border border-slate-200/70 bg-white/80 shadow-xs backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-900/80"
      aria-labelledby="patient-assignments-title"
    >
      {/* Header bar */}
      <div className="flex flex-col justify-between gap-5 border-b border-slate-100 p-6 dark:border-slate-800/70 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-400">
              <Users size={16} aria-hidden="true" />
            </span>
            <h2 id="patient-assignments-title" className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              Patient Care Assignments
            </h2>
          </div>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            Link unassigned patients to verified clinicians so they appear in the clinician&apos;s active care directory.
          </p>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-3.5 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search patient name or email…"
            aria-label="Search patient names or email addresses"
            className="min-h-11 w-full rounded-2xl border border-slate-200/80 bg-slate-50/70 pl-10 pr-4 text-xs font-medium text-slate-900 transition-all placeholder:text-slate-400 focus:border-teal-600 focus:bg-white focus:outline-2 focus:outline-offset-2 focus:outline-teal-100 dark:border-slate-800/80 dark:bg-slate-800/50 dark:text-white dark:focus:bg-slate-850"
          />
        </div>
      </div>

      {/* Tabs Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-3.5 dark:border-slate-800/70">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter patients by assignment status">
          {[
            { key: 'all' as const, label: 'All patients', count: allPatients.length },
            { key: 'unassigned' as const, label: 'Unassigned', count: unassignedCount, alert: unassignedCount > 0 },
            { key: 'assigned' as const, label: 'Assigned', count: assignedCount },
          ].map((item) => {
            const isActive = filter === item.key;
            return (
              <button
                type="button"
                key={item.key}
                aria-pressed={isActive}
                onClick={() => setFilter(item.key)}
                className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all duration-150 active:scale-[0.98] ${
                  isActive
                    ? 'bg-teal-700 text-white shadow-xs'
                    : 'bg-slate-100/70 text-slate-600 hover:bg-slate-200/70 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                <span>{item.label}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : item.alert
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                      : 'bg-slate-200/60 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                  }`}
                >
                  {view.loading ? '–' : item.count}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500" aria-live="polite">
          {view.loading ? 'Loading patients…' : `${(patients || []).length} patient${(patients || []).length === 1 ? '' : 's'} listed`}
        </p>
      </div>

      {view.error && (
        <div role="alert" className="m-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50/90 p-4 text-xs font-medium text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
          <p className="max-w-2xl leading-relaxed">{view.error}</p>
          <button type="button" onClick={retry} className={`${buttonStyle} border border-rose-200 bg-white dark:bg-slate-900`}>
            Try again
          </button>
        </div>
      )}

      {!view.loading && !view.error && liveDataUnavailable && (
        <p role="status" className="m-6 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-xs leading-relaxed text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
          Assignments require live patient and clinician records. Real-time updates will connect automatically.
        </p>
      )}

      {view.loading ? (
        <div role="status" className="flex items-center justify-center gap-3 px-6 py-16 text-sm text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin text-teal-700 dark:text-teal-400" aria-hidden="true" />
          Loading patient directory…
        </div>
      ) : (patients || []).length === 0 ? (
        <div className="px-6 py-16 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50/60 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400">
            {filter === 'unassigned' ? <UserCheck size={26} aria-hidden="true" /> : <Users size={26} aria-hidden="true" />}
          </div>
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
            {filter === 'unassigned'
              ? 'All registered patients are currently assigned'
              : term
              ? 'No patients match your search'
              : 'No patient accounts registered'}
          </h3>
          <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {filter === 'unassigned'
              ? 'Every patient in the system is linked to a verified doctor.'
              : term
              ? 'Try another name or email address, or switch filters.'
              : 'When patients register on CuraLink, they will be listed here for clinician assignment.'}
          </p>
          {filter !== 'all' && (
            <button
              type="button"
              onClick={() => {
                setFilter('all');
                setSearch('');
              }}
              className="mt-4 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-teal-800 transition-all hover:bg-teal-50 dark:border-slate-700 dark:bg-slate-800 dark:text-teal-300"
            >
              View all patients
            </button>
          )}
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
          {(patients || []).map((patient) => {
            const patientId = patient?.id || '';
            const selectedId = Object.hasOwn(drafts, patientId) ? drafts[patientId] : patient?.assignedDoctorId || '';
            const selectedUnavailable = Boolean(selectedId && !(verifiedDoctors || []).some((doctor) => doctor?.id === selectedId));
            const assignedDoctor = (doctors || []).find((doctor) => doctor?.id === patient?.assignedDoctorId);
            const pending = pendingIds.has(patientId);
            const response = feedback[patientId];
            const isAssigned = Boolean(patient?.assignedDoctorId);

            return (
              <article key={patientId} className="group p-5 transition-colors duration-150 hover:bg-slate-50/60 dark:hover:bg-slate-850/40 sm:p-6">
                <div className="grid items-start gap-4 lg:grid-cols-[1.2fr_1.2fr_auto]">
                  {/* Patient Info */}
                  <div className="flex items-start gap-3.5">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-sm font-bold text-teal-800 shadow-xs dark:bg-teal-950/60 dark:text-teal-300">
                      {(patient?.fullName || 'P')
                        .split(' ')
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((p) => p[0])
                        .join('')
                        .toUpperCase() || 'P'}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                          {patient?.fullName || 'Unnamed Patient'}
                        </h3>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            isAssigned
                              ? 'bg-teal-50 text-teal-800 dark:bg-teal-950/50 dark:text-teal-300'
                              : 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                          }`}
                        >
                          {isAssigned ? (
                            <>
                              <UserCheck size={11} aria-hidden="true" />
                              Assigned
                            </>
                          ) : (
                            <>
                              <UserMinus size={11} aria-hidden="true" />
                              Unassigned
                            </>
                          )}
                        </span>
                      </div>
                      <p className="mt-1 break-all text-xs text-slate-500 dark:text-slate-400">
                        {patient?.email || 'Email not provided'}
                      </p>
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        Current Clinician:{' '}
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {assignedDoctor?.fullName ||
                            (patient?.assignedDoctorId ? 'Assigned clinician unavailable' : 'None (Unassigned)')}
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Doctor Selector */}
                  <div>
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                        Assign Verified Clinician
                      </span>
                      <select
                        aria-label={`Assign clinician to ${patient?.fullName || 'patient'}`}
                        value={selectedId}
                        disabled={pending || liveDataUnavailable}
                        onChange={(event) => {
                          const val = event.target.value;
                          setDrafts((previous) => ({ ...previous, [patientId]: val }));
                          setFeedback((previous) => {
                            const next = { ...previous };
                            delete next[patientId];
                            return next;
                          });
                        }}
                        className="min-h-11 w-full rounded-2xl border border-slate-200/80 bg-white px-3.5 text-xs font-medium text-slate-800 shadow-xs transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:bg-slate-50 dark:border-slate-800 dark:bg-slate-850 dark:text-white dark:disabled:bg-slate-900"
                      >
                        <option value="">Unassigned (No doctor)</option>
                        {selectedUnavailable && (
                          <option value={selectedId} disabled>
                            Clinician no longer verified or available
                          </option>
                        )}
                        {(verifiedDoctors || []).map((doctor) => (
                          <option key={doctor?.id} value={doctor?.id}>
                            Dr. {doctor?.fullName} (Verified)
                          </option>
                        ))}
                      </select>
                    </label>
                    {selectedUnavailable && (
                      <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">
                        Please choose an active verified clinician or unassign.
                      </p>
                    )}
                  </div>

                  {/* Action Button */}
                  <div className="flex items-center lg:pt-5">
                    <button
                      type="button"
                      aria-label={`Save assignment for ${patient?.fullName || 'patient'}`}
                      disabled={
                        pending ||
                        liveDataUnavailable ||
                        selectedUnavailable ||
                        selectedId === (patient?.assignedDoctorId || '')
                      }
                      onClick={() => saveAssignment(patient, selectedId)}
                      className={`${buttonStyle} w-full min-w-36 bg-teal-700 text-white shadow-xs hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500`}
                    >
                      {pending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          <span>Saving…</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                          <span>Save Assignment</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {response && (
                  <p
                    role={response.type === 'error' ? 'alert' : 'status'}
                    className={`mt-3 rounded-xl p-2.5 text-xs font-medium leading-relaxed ${
                      response.type === 'error'
                        ? 'border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300'
                        : 'border border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-900/40 dark:bg-teal-950/30 dark:text-teal-300'
                    }`}
                  >
                    {response.message}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}

      <footer className="border-t border-slate-100 bg-slate-50/60 px-6 py-4 text-xs leading-relaxed text-slate-500 dark:border-slate-800/70 dark:bg-slate-900/60 dark:text-slate-400">
        {(verifiedDoctors || []).length} verified clinician{(verifiedDoctors || []).length === 1 ? '' : 's'} ready for assignment. Unassigning a patient safely removes the assigned care relationship while preserving all existing medical history and appointments.
      </footer>
    </section>
  );
}
