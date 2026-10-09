'use client';

import React, { useState, useEffect } from 'react';
import { PatientDirectoryItem, LiveTelemetryPayload } from '../../lib/types';
import { db } from '../../lib/firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { useTelehealth } from '../../context/TelehealthContext';
import {
  Activity,
  Heart,
  Droplets,
  Thermometer,
  Gauge,
  AlertTriangle,
  Video,
  FileText,
  User,
  Search,
  Filter,
  Radio,
  Sliders,
  Edit3,
  Loader2,
  CheckCircle2,
  X,
  Stethoscope,
} from 'lucide-react';

interface MultiPatientMonitorProps {
  patients: PatientDirectoryItem[];
  liveTelemetry?: LiveTelemetryPayload;
  onStartVideoCall: (patientName: string) => void;
  onOpenEHR: (patientName: string, patientId?: string) => void;
  onOpenSimulator: () => void;
}

export function MultiPatientMonitor({
  patients,
  liveTelemetry,
  onStartVideoCall,
  onOpenEHR,
  onOpenSimulator,
}: MultiPatientMonitorProps) {
  const { currentUser } = useTelehealth();
  const [firestorePatients, setFirestorePatients] = useState<PatientDirectoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState<'All' | 'Critical' | 'Monitored' | 'Stable'>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Doctor Note state
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [notePatient, setNotePatient] = useState<{ id: string; name: string } | null>(null);
  const [doctorNoteDiagnosis, setDoctorNoteDiagnosis] = useState('');
  const [doctorNoteText, setDoctorNoteText] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [noteSuccess, setNoteSuccess] = useState(false);

  // Firestore fallback query for patients where role == 'patient'
  useEffect(() => {
    if (patients && patients.length > 0) return;

    let isMounted = true;
    setIsLoading(true);

    try {
      const q = query(
        collection(db, 'users'),
        where('role', 'in', ['patient', 'Patient'])
      );

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const list: PatientDirectoryItem[] = (snapshot.docs || []).map((docSnap) => {
            const data = docSnap.data() || {};
            return {
              id: docSnap.id,
              name: data.fullName || data.name || 'Patient',
              email: data.email || '',
              phone: data.phoneNumber || data.phone || '',
              phoneNumber: data.phoneNumber || data.phone || '',
              age: data.age || 35,
              gender: data.gender || 'Other',
              condition: data.condition || 'General Observation',
              status: data.status || 'Stable',
              roomOrBed: data.roomOrBed || 'Remote Ward Care',
              assignedDoctor: data.assignedDoctor || 'Attending Clinician',
              lastVisit: data.lastVisit || data.lastVisitDate || 'Initial Intake',
              lastVisitDate: data.lastVisitDate || data.lastVisit || '',
              nextAppointment: data.nextAppointment,
              bloodGroup: data.bloodGroup || data.bloodType || '',
              bloodType: data.bloodType || data.bloodGroup || '',
              allergies: data.allergies || [],
              knownAllergies: data.knownAllergies || '',
              chronicConditions: data.chronicConditions || [],
              currentMedications: data.currentMedications || '',
              hasCompletedOnboarding: data.hasCompletedOnboarding === true,
              emergencyContact: data.emergencyContact || '',
              lastSyncedTemperature: data.lastSyncedTemperature,
              lastSyncedAt: data.lastSyncedAt,
              temperatureStatus: data.temperatureStatus,
              deviceModel: data.deviceModel,
              currentVitals: data.currentVitals || {
                heartRate: 72,
                spo2: 98,
                temperature: data.lastSyncedTemperature || 37.0,
                bloodPressure: '120/80',
              },
            };
          });

          // Sort client-side alphabetically
          list.sort((a, b) => (a?.name || '').localeCompare(b?.name || ''));

          if (isMounted) {
            setFirestorePatients(list);
            setIsLoading(false);
          }
        },
        (error) => {
          console.warn('MultiPatientMonitor patients query notice:', error);
          if (isMounted) setIsLoading(false);
        }
      );

      return () => {
        isMounted = false;
        unsubscribe();
      };
    } catch (err) {
      console.warn('Error setting up MultiPatientMonitor query:', err);
      if (isMounted) setIsLoading(false);
    }
  }, [patients]);

  // Actionable Feature: Add Doctor Note wired to addDoc
  const handleSaveDoctorNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notePatient || !doctorNoteText.trim()) return;

    try {
      setIsSavingNote(true);
      const noteTitle = `Doctor Clinical Note - ${doctorNoteDiagnosis.trim() || 'General Ward Observation'}`;
      const doctorId = currentUser?.uid || 'doctor_attending';
      const doctorName = currentUser?.fullName || 'Attending Physician';

      // 1. Add to clinical_records collection
      await addDoc(collection(db, 'clinical_records'), {
        patientId: notePatient.id,
        doctorId,
        doctorName,
        patientName: notePatient.name || 'Patient',
        type: 'Clinical Note',
        'Record Type': 'Clinical Note',
        'Document Title': noteTitle,
        title: noteTitle,
        notes: doctorNoteText.trim(),
        diagnosis: doctorNoteDiagnosis.trim() || 'Ward Observation',
        facility: 'CuraLink Ward Telemetry',
        createdAt: serverTimestamp(),
      });

      // 2. Add to medical_records collection
      await addDoc(collection(db, 'medical_records'), {
        patientId: notePatient.id,
        doctorId,
        doctorName,
        patientName: notePatient.name || 'Patient',
        type: 'Clinical Note',
        content: {
          title: noteTitle,
          notes: doctorNoteText.trim(),
          diagnosis: doctorNoteDiagnosis.trim() || 'Ward Observation',
          date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          status: 'Finalized',
        },
        createdAt: serverTimestamp(),
      });

      setNoteSuccess(true);
      setTimeout(() => {
        setNoteSuccess(false);
        setIsNoteModalOpen(false);
        setDoctorNoteText('');
        setDoctorNoteDiagnosis('');
        setNotePatient(null);
      }, 1000);
    } catch (err) {
      console.error('Error saving doctor note from ward monitor:', err);
    } finally {
      setIsSavingNote(false);
    }
  };

  const effectivePatients = (patients && patients.length > 0) ? patients : firestorePatients;
  const activeTelemetry = liveTelemetry;

  // Update patient card with live telemetry stream if patient matches
  const updatedPatients = (effectivePatients || []).map((pt) => {
    if (activeTelemetry && pt?.id === activeTelemetry.patientId) {
      const isStandby = !activeTelemetry.sensorConnected || activeTelemetry.heartRate === 0;
      const status = isStandby
        ? pt?.status || 'Stable'
        : activeTelemetry.status === 'critical'
        ? ('Critical' as const)
        : activeTelemetry.status === 'elevated'
        ? ('Monitored' as const)
        : ('Stable' as const);

      return {
        ...pt,
        status,
        currentVitals: {
          heartRate: activeTelemetry.heartRate,
          spo2: activeTelemetry.spo2,
          temperature: activeTelemetry.temperature,
          bloodPressure: `${activeTelemetry.systolic}/${activeTelemetry.diastolic}`,
        },
      };
    }
    return pt;
  });

  const filtered = (updatedPatients || []).filter((pt) => {
    const matchesFilter = filter === 'All' ? true : pt?.status === filter;
    const matchesSearch =
      (pt?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (pt?.condition || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (pt?.roomOrBed || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const criticalCount = (updatedPatients || []).filter((p) => p?.status === 'Critical').length;
  const monitoredCount = (updatedPatients || []).filter((p) => p?.status === 'Monitored').length;
  const stableCount = (updatedPatients || []).filter((p) => p?.status === 'Stable').length;

  return (
    <div className="space-y-6">
      {/* Top Banner & Emergency Counter */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Live Patient Telemetry & Ward Command
            </h2>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
              Active Multi-Stream
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time biometric feed from deployed ESP32 wearable hospital and home-care nodes
          </p>
        </div>

        {/* Status Counters & Simulator Quick Trigger */}
        <div className="flex items-center flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200/70">
            <span className="px-2.5 py-1 rounded-lg bg-rose-500 text-white font-bold flex items-center gap-1 shadow-xs">
              <AlertTriangle className="w-3.5 h-3.5" />
              {criticalCount} Critical
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-amber-500 text-white font-bold">
              {monitoredCount} Monitored
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold">
              {stableCount} Stable
            </span>
          </div>

          <button
            onClick={onOpenSimulator}
            className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            title="Simulate Arrhythmias and Fevers"
          >
            <Sliders className="w-3.5 h-3.5 text-teal-400" />
            <span>Telemetry Simulator</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search patients, conditions, beds..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium focus:outline-none focus:border-teal-500 shadow-xs"
          />
        </div>

        <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-xs w-full sm:w-auto">
          {(['All', 'Critical', 'Monitored', 'Stable'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                filter === tab
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Patient Telemetry Cards or Empty State */}
      {isLoading && (effectivePatients || []).length === 0 ? (
        <div className="py-16 px-6 rounded-2xl bg-white border border-slate-200/80 flex flex-col items-center justify-center text-center shadow-xs">
          <Loader2 className="w-8 h-8 text-teal-600 animate-spin mb-3" />
          <h4 className="text-sm font-semibold text-slate-800 mb-1">
            Loading Ward Patient Directory...
          </h4>
          <p className="text-xs text-slate-500 max-w-sm">
            Fetching registered patients and synchronizing live telemetry streams from Firestore.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 px-6 rounded-2xl bg-white border border-slate-200/80 flex flex-col items-center justify-center text-center shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mb-3">
            <Radio className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-semibold text-slate-800 mb-1">
            No records found
          </h4>
          <p className="text-xs text-slate-500 max-w-sm">
            There are currently no patients streaming IoT vitals under the selected filter. When patient IoT nodes connect or register in the ward, their live vitals will appear here in real time.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(filtered || []).map((pt) => {
            const isCritical = pt?.status === 'Critical';
            const isMonitored = pt?.status === 'Monitored';
            const vitals = pt?.currentVitals || {
              heartRate: 0,
              spo2: 0,
              temperature: 0,
              bloodPressure: '--/--',
            };
            const hr = Number(vitals.heartRate) || 0;
            const spo2 = Number(vitals.spo2) || 0;
            const temp = Number(vitals.temperature) || 0;
            const bp = vitals.bloodPressure || '--/--';

            return (
              <div
                key={pt?.id}
                className={`rounded-2xl p-5 border-2 transition-all shadow-xs flex flex-col justify-between ${
                  isCritical
                    ? 'bg-rose-50/40 border-rose-400 shadow-rose-100'
                    : isMonitored
                    ? 'bg-amber-50/30 border-amber-300'
                    : 'bg-white border-slate-200/80 hover:border-slate-300'
                }`}
              >
                <div className="space-y-4">
                  {/* Header: Name, Room, Status badge */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 shadow-xs ${
                          isCritical
                            ? 'bg-rose-600 text-white animate-bounce'
                            : 'bg-teal-50 text-teal-800 border border-teal-200/70'
                        }`}
                      >
                        {(pt?.name || 'Patient')
                          .split(' ')
                          .map((n) => n[0] || '')
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-slate-900">{pt?.name || 'Patient'}</h3>
                          <span className="text-xs text-slate-400">
                            {pt?.age ? `${pt.age}y` : 'Adult'} • {pt?.gender || 'Patient'}
                          </span>
                        </div>
                        <p className="text-xs text-teal-700 font-medium">{pt?.condition || 'General Care'}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{pt?.roomOrBed || 'Remote Ward'}</p>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                        isCritical
                          ? 'bg-rose-600 text-white animate-pulse'
                          : isMonitored
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      }`}
                    >
                      {pt?.status || 'Stable'}
                    </span>
                  </div>

                  {/* Vitals Telemetry Row - safe optional chaining throughout */}
                  <div className="grid grid-cols-4 gap-2 text-center">
                    {/* Heart Rate */}
                    <div
                      className={`p-2 rounded-xl border ${
                        hr >= 120 || (hr > 0 && hr < 50)
                          ? 'bg-rose-100 border-rose-300 text-rose-900 animate-pulse'
                          : hr > 100
                          ? 'bg-amber-100 border-amber-300 text-amber-900'
                          : 'bg-slate-50 border-slate-100 text-slate-800'
                      }`}
                    >
                      <Heart className="w-3.5 h-3.5 mx-auto mb-0.5 text-rose-500 fill-rose-500" />
                      <span className="text-sm font-black font-mono block">
                        {hr > 0 ? hr : '--'}
                      </span>
                      <span className="text-[9px] text-slate-500 uppercase font-semibold">BPM</span>
                    </div>

                    {/* SpO2 */}
                    <div
                      className={`p-2 rounded-xl border ${
                        spo2 > 0 && spo2 < 92
                          ? 'bg-rose-100 border-rose-300 text-rose-900 animate-pulse'
                          : spo2 > 0 && spo2 < 95
                          ? 'bg-amber-100 border-amber-300 text-amber-900'
                          : 'bg-slate-50 border-slate-100 text-slate-800'
                      }`}
                    >
                      <Droplets className="w-3.5 h-3.5 mx-auto mb-0.5 text-cyan-500" />
                      <span className="text-sm font-black font-mono block">
                        {spo2 > 0 ? `${spo2}%` : '--'}
                      </span>
                      <span className="text-[9px] text-slate-500 uppercase font-semibold">SpO2</span>
                    </div>

                    {/* Body Temp */}
                    <div
                      className={`p-2 rounded-xl border ${
                        temp >= 38.3
                          ? 'bg-rose-100 border-rose-300 text-rose-900 animate-pulse'
                          : temp >= 37.5
                          ? 'bg-amber-100 border-amber-300 text-amber-900'
                          : 'bg-slate-50 border-slate-100 text-slate-800'
                      }`}
                    >
                      <Thermometer className="w-3.5 h-3.5 mx-auto mb-0.5 text-amber-500" />
                      <span className="text-sm font-black font-mono block">
                        {temp > 0 ? `${temp.toFixed(1)}°C` : '--'}
                      </span>
                      <span className="text-[9px] text-slate-500 uppercase font-semibold">Temp</span>
                    </div>

                    {/* Blood Pressure */}
                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 text-slate-800">
                      <Gauge className="w-3.5 h-3.5 mx-auto mb-0.5 text-indigo-500" />
                      <span className="text-xs font-black font-mono block mt-0.5">
                        {bp}
                      </span>
                      <span className="text-[9px] text-slate-500 uppercase font-semibold">mmHg</span>
                    </div>
                  </div>

                  {isCritical && (
                    <p className="text-[11px] font-bold text-rose-700 bg-rose-100/80 p-2 rounded-xl border border-rose-200 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>Threshold breach: Immediate clinician evaluation recommended.</span>
                    </p>
                  )}
                </div>

                {/* Action Buttons: Add Doctor Note, Write Prescription, Video Visit */}
                <div className="mt-4 pt-3 border-t border-slate-200/70 flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[11px] text-slate-400 font-mono">
                    Next: {pt?.nextAppointment || 'None scheduled'}
                  </span>

                  <div className="flex items-center gap-1.5">
                    {/* Add Doctor Note Button */}
                    <button
                      onClick={() => {
                        setNotePatient({ id: pt?.id, name: pt?.name || 'Patient' });
                        setIsNoteModalOpen(true);
                      }}
                      className="px-2.5 py-1.5 rounded-xl border border-indigo-200 hover:bg-indigo-50 text-indigo-700 font-bold text-xs flex items-center gap-1 transition-all cursor-pointer"
                      title="Add Doctor Note"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Note</span>
                    </button>

                    {/* Write Prescription Button */}
                    <button
                      onClick={() => onOpenEHR(pt?.name || 'Patient', pt?.id)}
                      className="px-3 py-1.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-1 transition-all cursor-pointer"
                      title="Write Prescription & EHR"
                    >
                      <FileText className="w-3.5 h-3.5 text-teal-600" />
                      <span>Write Prescription</span>
                    </button>

                    {/* Video Visit Button */}
                    <button
                      onClick={() => onStartVideoCall(pt?.name || 'Patient')}
                      className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs transition-all cursor-pointer"
                      title="Start Video Consultation"
                    >
                      <Video className="w-3.5 h-3.5" />
                      <span>Visit</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Doctor Note Modal */}
      {isNoteModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Add Doctor Clinical Note</h3>
                  <p className="text-xs text-slate-500">Patient: {notePatient?.name}</p>
                </div>
              </div>
              <button
                onClick={() => setIsNoteModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveDoctorNote} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Primary Diagnosis / Impression
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ward telemetry review, stable sinus rhythm"
                  value={doctorNoteDiagnosis}
                  onChange={(e) => setDoctorNoteDiagnosis(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Clinical Observation & Care Directives *
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Enter detailed physician notes, continuous monitoring evaluation, treatment response, and follow-up guidance..."
                  value={doctorNoteText}
                  onChange={(e) => setDoctorNoteText(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                />
              </div>

              {noteSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-semibold flex items-center gap-2 border border-emerald-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Clinical note recorded successfully into patient chart.</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNoteModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingNote || !doctorNoteText.trim()}
                  className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-teal-600/20 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {isSavingNote ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Note...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Save Clinical Note</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
