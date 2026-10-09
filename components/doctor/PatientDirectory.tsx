'use client';

import { useState } from 'react';
import { Calendar, FileText, Mail, Phone, Plus, Search, UserCheck, Users, Video } from 'lucide-react';
import type { Appointment, PatientDirectoryItem } from '../../lib/types';
import { useTelehealth } from '../../context/TelehealthContext';
import {
  activeAppointmentStatuses,
  ClinicalNoteDialog,
  fieldClass,
  hasRecordedVitals,
  normalizeWorkspaceRecords,
  PatientHistory,
  RecordAttachment,
  WorkspaceDataNotice,
  WorkspaceDialog,
} from './DoctorWorkspaceSupport';

interface PatientDirectoryProps {
  patients?: PatientDirectoryItem[];
  onStartVideoCall?: (appointment: Appointment) => void;
  onOpenEHR?: (patientName: string, patientId?: string) => void;
}

export function PatientDirectory({ onStartVideoCall, onOpenEHR }: PatientDirectoryProps) {
  const { currentUser, patientDirectory = [], doctorAppointmentsQueue = [], clinicalRecords = [], dataLoading, openEHR } =
    useTelehealth();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'All' | 'Assigned to me' | 'With readings' | 'Needs attention'>('All');
  const [selectedId, setSelectedId] = useState('');
  const [notePatient, setNotePatient] = useState<{ id: string; name: string } | null>(null);

  const selected = (patientDirectory || []).find((patient) => patient?.id === selectedId);
  const myUid = currentUser?.uid || '';
  const myName = currentUser?.fullName || '';

  const isAssignedToMe = (patient: PatientDirectoryItem) =>
    Boolean(
      (patient?.assignedDoctorId && patient.assignedDoctorId === myUid) ||
      (patient?.assignedDoctor && patient.assignedDoctor === myName)
    );

  const filtered = (patientDirectory || []).filter((patient) => {
    const haystack = `${patient?.name || ''} ${patient?.email || ''} ${patient?.condition || ''}`.toLowerCase();
    const matchesSearch = !search.trim() || haystack.includes(search.trim().toLowerCase());
    if (!matchesSearch) return false;

    if (filter === 'Assigned to me') return isAssignedToMe(patient);
    if (filter === 'With readings') return hasRecordedVitals(patient);
    if (filter === 'Needs attention') return patient?.status === 'Critical';
    return true;
  });

  const records = normalizeWorkspaceRecords(clinicalRecords, patientDirectory);
  const selectedRecords = records.filter((record) => record?.patientId === selected?.id);

  const videoAppointment = (patientId: string) =>
    (doctorAppointmentsQueue || []).find(
      (appointment) =>
        appointment?.patientId === patientId &&
        appointment?.type === 'Video Call' &&
        activeAppointmentStatuses.has((appointment?.status || '').toLowerCase())
    );

  const prescribe = (patient: PatientDirectoryItem) =>
    (onOpenEHR || openEHR)(patient?.name || '', patient?.id);

  const assignedToMeCount = (patientDirectory || []).filter(isAssignedToMe).length;

  return (
    <div className="mx-auto max-w-7xl space-y-6 animate-fade-in-up">
      {/* Header Banner */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="care-eyebrow mb-2">People in your care network</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
            Patient Directory
          </h1>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            Real-time directory of clinic patients, assignments, telemetry readings, and shared medical records.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-fit rounded-full border border-teal-200/80 bg-teal-50/80 px-3 py-1.5 text-xs font-semibold text-teal-800 dark:border-teal-900/60 dark:bg-teal-950/40 dark:text-teal-300">
            {assignedToMeCount} assigned to you
          </span>
          <span className="w-fit rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            {dataLoading ? 'Loading…' : `${(patientDirectory || []).length} total patients`}
          </span>
        </div>
      </div>

      <WorkspaceDataNotice />

      {/* Search & Filter Bar */}
      <div className="care-card flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <label htmlFor="patient-search" className="sr-only">
            Search assigned patients
          </label>
          <Search size={16} className="pointer-events-none absolute left-3.5 top-3.5 text-slate-400" aria-hidden="true" />
          <input
            id="patient-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, email, or clinical condition…"
            className={fieldClass + ' pl-10'}
          />
        </div>
        <div className="flex flex-wrap gap-1 rounded-2xl bg-slate-100/70 p-1 dark:bg-slate-800/60" aria-label="Filter patients">
          {(['All', 'Assigned to me', 'With readings', 'Needs attention'] as const).map((value) => {
            const isActive = filter === value;
            return (
              <button
                type="button"
                key={value}
                aria-pressed={isActive}
                onClick={() => setFilter(value)}
                className={`min-h-9 rounded-xl px-3.5 text-xs font-semibold transition-all duration-150 active:scale-[0.98] ${
                  isActive
                    ? 'bg-white text-teal-800 shadow-xs dark:bg-slate-900 dark:text-teal-300'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {value}
              </button>
            );
          })}
        </div>
      </div>

      {/* Patient Grid */}
      {(filtered || []).length === 0 ? (
        <div className="care-card px-5 py-16 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400">
            <Users size={26} aria-hidden="true" />
          </div>
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">
            {dataLoading
              ? 'Loading patient records…'
              : (patientDirectory || []).length
              ? 'No matching patients found'
              : 'Your patient directory is ready'}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {(patientDirectory || []).length
              ? 'Try adjusting your search keywords or filter options.'
              : 'Patients registered on CuraLink will appear here. The administrator can link patients directly to your clinician profile.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(filtered || []).map((patient) => {
            const appointment = videoAppointment(patient?.id);
            const assignedHere = isAssignedToMe(patient);
            const heartRate = patient?.currentVitals?.heartRate;
            const spo2 = patient?.currentVitals?.spo2;
            const temp = patient?.lastSyncedTemperature || patient?.currentVitals?.temperature;

            return (
              <article
                key={patient?.id}
                className="care-card flex flex-col justify-between p-5 transition-all duration-200 hover:border-teal-200/80 hover:shadow-md"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedId(patient?.id)}
                      className="group flex min-w-0 items-center gap-3 rounded-xl text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700"
                    >
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-sm font-bold text-teal-800 shadow-xs transition-transform duration-200 group-hover:scale-105 dark:bg-teal-950/60 dark:text-teal-300">
                        {(patient?.name || 'P')
                          .split(' ')
                          .filter(Boolean)
                          .slice(0, 2)
                          .map((n) => n[0])
                          .join('')
                          .toUpperCase()}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold text-slate-900 group-hover:text-teal-800 dark:text-white dark:group-hover:text-teal-300">
                          {patient?.name || 'Unnamed Patient'}
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-400">
                          {patient?.age && patient.age > 0 ? `${patient.age} yrs` : 'Age not specified'} · {patient?.gender || 'Patient'}
                        </span>
                      </span>
                    </button>

                    <div className="flex flex-col items-end gap-1">
                      {assignedHere ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-[9px] font-bold text-teal-800 dark:bg-teal-950/50 dark:text-teal-300">
                          <UserCheck size={10} aria-hidden="true" />
                          Assigned
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                          Clinic
                        </span>
                      )}

                      <span
                        className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${
                          hasRecordedVitals(patient) && patient?.status === 'Critical'
                            ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                            : 'bg-slate-50 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400'
                        }`}
                      >
                        {hasRecordedVitals(patient) ? patient?.status : 'No vitals'}
                      </span>
                    </div>
                  </div>

                  <p className="mt-3.5 line-clamp-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    {patient?.condition || 'No chronic condition noted'}
                  </p>

                  {/* Vitals Summary Pill Grid */}
                  <dl className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-slate-50/80 p-3 dark:bg-slate-850/60">
                    <div>
                      <dt className="text-[9px] font-medium uppercase tracking-wider text-slate-400">Heart rate</dt>
                      <dd className="mt-1 text-xs font-bold text-slate-800 dark:text-slate-200">
                        {heartRate && heartRate > 0 ? `${heartRate} bpm` : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[9px] font-medium uppercase tracking-wider text-slate-400">SpO₂</dt>
                      <dd className="mt-1 text-xs font-bold text-slate-800 dark:text-slate-200">
                        {spo2 && spo2 > 0 ? `${spo2}%` : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[9px] font-medium uppercase tracking-wider text-slate-400">Temp</dt>
                      <dd className="mt-1 text-xs font-bold text-slate-800 dark:text-slate-200">
                        {temp && temp > 0 ? `${temp.toFixed(1)}°C` : '—'}
                      </dd>
                    </div>
                  </dl>
                </div>

                {/* Card Action Buttons */}
                <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4 dark:border-slate-800/70">
                  <button
                    type="button"
                    onClick={() => setSelectedId(patient?.id)}
                    className="mr-auto min-h-10 rounded-xl px-2 text-xs font-semibold text-teal-800 transition-colors hover:text-teal-900 focus-visible:outline-2 focus-visible:outline-teal-700 dark:text-teal-400"
                  >
                    View history
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotePatient({ id: patient?.id, name: patient?.name || 'Patient' })}
                    title={`Add clinical note for ${patient?.name || 'patient'}`}
                    aria-label={`Add clinical note for ${patient?.name || 'patient'}`}
                    className="flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition-all hover:border-teal-200 hover:bg-teal-50 hover:text-teal-800 active:scale-[0.98] dark:border-slate-700 dark:text-slate-300"
                  >
                    <Plus size={14} aria-hidden="true" />
                    <span>Note</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => prescribe(patient)}
                    title={`Prescribe for ${patient?.name || 'patient'}`}
                    aria-label={`Prescribe for ${patient?.name || 'patient'}`}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition-all hover:border-teal-200 hover:bg-teal-50 hover:text-teal-800 active:scale-[0.98] dark:border-slate-700 dark:text-slate-300"
                  >
                    <FileText size={16} aria-hidden="true" />
                  </button>
                  {appointment && onStartVideoCall && (
                    <button
                      type="button"
                      onClick={() => onStartVideoCall(appointment)}
                      title={`Join booked video visit with ${patient?.name || 'patient'}`}
                      aria-label={`Join booked video visit with ${patient?.name || 'patient'}`}
                      className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700 text-white shadow-xs transition-all hover:bg-teal-800 active:scale-[0.98]"
                    >
                      <Video size={16} aria-hidden="true" />
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Patient Detail Modal */}
      {selected && (
        <WorkspaceDialog title={selected.name} onClose={() => setSelectedId('')}>
          <div className="space-y-6">
            <div className="flex flex-wrap gap-3 text-xs text-slate-500">
              {selected.email && (
                <span className="flex items-center gap-1.5">
                  <Mail size={14} aria-hidden="true" />
                  {selected.email}
                </span>
              )}
              {(selected.phoneNumber || selected.phone) && (
                <span className="flex items-center gap-1.5">
                  <Phone size={14} aria-hidden="true" />
                  {selected.phoneNumber || selected.phone}
                </span>
              )}
            </div>

            <PatientHistory patient={selected} />

            <section>
              <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">
                Shared Clinical & Medical Records
              </h3>
              {(selectedRecords || []).length ? (
                <ul className="space-y-3">
                  {(selectedRecords || []).map((record) => (
                    <li key={record?.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{record?.title}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {record?.type} · {record?.date}
                      </p>
                      {record?.notes && (
                        <p className="my-3 whitespace-pre-wrap text-xs leading-relaxed text-slate-500">
                          {record.notes}
                        </p>
                      )}
                      <div className="mt-3">
                        <RecordAttachment record={record} />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-2xl bg-slate-50 p-4 text-xs text-slate-400 dark:bg-slate-800/50">
                  No shared records are available for this patient.
                </p>
              )}
            </section>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-5 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setNotePatient({ id: selected.id, name: selected.name });
                  setSelectedId('');
                }}
                className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-semibold text-slate-600 transition-all hover:bg-slate-50 active:scale-[0.98]"
              >
                <Plus size={15} aria-hidden="true" />
                Add Clinical Note
              </button>
              <button
                type="button"
                onClick={() => {
                  prescribe(selected);
                  setSelectedId('');
                }}
                className="care-button text-xs"
              >
                <FileText size={16} aria-hidden="true" />
                Write Prescription
              </button>
            </div>
          </div>
        </WorkspaceDialog>
      )}

      {notePatient && (
        <ClinicalNoteDialog key={notePatient.id} patient={notePatient} onClose={() => setNotePatient(null)} />
      )}
    </div>
  );
}
