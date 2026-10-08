'use client';

import React, { useState, useEffect } from 'react';
import { PatientDirectoryItem } from '../../lib/types';
import { db } from '../../lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  doc,
} from 'firebase/firestore';
import {
  Users,
  Search,
  Video,
  FileText,
  Activity,
  Droplet,
  AlertTriangle,
  Pill,
  ClipboardList,
  CheckCircle2,
  Clock,
  X,
  Thermometer,
  Cpu,
  Mail,
  Phone,
  Calendar,
  Loader2,
} from 'lucide-react';

interface PatientDirectoryProps {
  patients?: PatientDirectoryItem[];
  onStartVideoCall?: (patientName: string) => void;
  onOpenEHR?: (patientName: string, patientId?: string) => void;
}

interface LivePatientIoTData {
  lastSyncedTemperature?: number;
  lastSyncedAt?: string;
  temperatureStatus?: string;
  deviceModel?: string;
  temperatureUnit?: string;
}

export function PatientDirectory({
  patients = [],
  onStartVideoCall,
  onOpenEHR,
}: PatientDirectoryProps) {
  const [patientList, setPatientList] = useState<PatientDirectoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<PatientDirectoryItem | null>(null);
  const [livePatientDoc, setLivePatientDoc] = useState<any>(null);
  const [liveIoTData, setLiveIoTData] = useState<LivePatientIoTData | null>(null);
  const [isLiveListening, setIsLiveListening] = useState(false);

  // Direct Firestore query: collection 'users' where role is in ['patient', 'Patient']
  // Strictly without orderBy() to prevent missing index exceptions
  useEffect(() => {
    let isMounted = true;

    const fetchPatients = async () => {
      try {
        setLoading(true);
        const q = query(
          collection(db, 'users'),
          where('role', 'in', ['patient', 'Patient'])
        );
        const snapshot = await getDocs(q);
        const docsData: PatientDirectoryItem[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            name: data.fullName || data.name || '',
            email: data.email || '',
            phone: data.phoneNumber || data.phone || '',
            phoneNumber: data.phoneNumber || data.phone || '',
            lastVisit: data.lastVisit || data.lastVisitDate || '',
            lastVisitDate: data.lastVisitDate || data.lastVisit || '',
            age: data.age || 35,
            gender: data.gender || 'Other',
            condition: data.condition || 'General Care',
            status: data.status || 'Stable',
            roomOrBed: data.roomOrBed || 'Remote Care',
            assignedDoctor: data.assignedDoctor || 'Assigned Clinician',
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
              heartRate: 0,
              spo2: 0,
              temperature: 0,
              bloodPressure: '--/--',
            },
          };
        });

        // Client-side sort alphabetically (.sort())
        docsData.sort((a, b) => {
          const nameA = (a.name || '').toLowerCase();
          const nameB = (b.name || '').toLowerCase();
          return nameA.localeCompare(nameB);
        });

        if (isMounted) {
          setPatientList(docsData);
          setLoading(false);
        }
      } catch (error) {
        console.error('Patient Directory Error:', error);
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchPatients();

    // Set up real-time listener with exact query
    try {
      const q = query(
        collection(db, 'users'),
        where('role', 'in', ['patient', 'Patient'])
      );
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const docsData: PatientDirectoryItem[] = snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              name: data.fullName || data.name || '',
              email: data.email || '',
              phone: data.phoneNumber || data.phone || '',
              phoneNumber: data.phoneNumber || data.phone || '',
              lastVisit: data.lastVisit || data.lastVisitDate || '',
              lastVisitDate: data.lastVisitDate || data.lastVisit || '',
              age: data.age || 35,
              gender: data.gender || 'Other',
              condition: data.condition || 'General Care',
              status: data.status || 'Stable',
              roomOrBed: data.roomOrBed || 'Remote Care',
              assignedDoctor: data.assignedDoctor || 'Assigned Clinician',
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
                heartRate: 0,
                spo2: 0,
                temperature: 0,
                bloodPressure: '--/--',
              },
            };
          });

          // Sort alphabetically (.sort())
          docsData.sort((a, b) => {
            const nameA = (a.name || '').toLowerCase();
            const nameB = (b.name || '').toLowerCase();
            return nameA.localeCompare(nameB);
          });

          if (isMounted) {
            setPatientList(docsData);
            setLoading(false);
          }
        },
        (error) => {
          console.error('Patient Directory Error:', error);
          if (isMounted) {
            setLoading(false);
          }
        }
      );

      return () => {
        isMounted = false;
        unsubscribe();
      };
    } catch (error) {
      console.error('Patient Directory Error:', error);
      return () => {
        isMounted = false;
      };
    }
  }, []);

  // Listen to single patient document when modal is open for live telemetry
  useEffect(() => {
    if (!selectedPatient?.id) {
      setLivePatientDoc(null);
      setLiveIoTData(null);
      setIsLiveListening(false);
      return;
    }

    if (selectedPatient.lastSyncedTemperature !== undefined) {
      setLiveIoTData({
        lastSyncedTemperature: selectedPatient.lastSyncedTemperature,
        lastSyncedAt: selectedPatient.lastSyncedAt,
        temperatureStatus: selectedPatient.temperatureStatus,
        deviceModel: selectedPatient.deviceModel,
        temperatureUnit: '°C',
      });
    } else {
      setLiveIoTData(null);
    }

    setIsLiveListening(true);
    const userDocRef = doc(db, 'users', selectedPatient.id);
    const unsubscribe = onSnapshot(
      userDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setLivePatientDoc(data);
          if (data.lastSyncedTemperature !== undefined) {
            setLiveIoTData({
              lastSyncedTemperature: data.lastSyncedTemperature,
              lastSyncedAt: data.lastSyncedAt,
              temperatureStatus: data.temperatureStatus,
              deviceModel: data.deviceModel || 'USB Temperature Sensor',
              temperatureUnit: data.temperatureUnit || '°C',
            });
          }
        }
      },
      (error) => {
        console.warn('Doctor live patient medical document onSnapshot notice:', error);
      }
    );

    return () => {
      unsubscribe();
      setIsLiveListening(false);
    };
  }, [selectedPatient?.id]);

  // Combine fetched list with prop fallback
  const effectivePatients = patientList.length > 0 ? patientList : patients;

  const filtered = effectivePatients.filter((p) => {
    const q = search.toLowerCase();
    const name = (p.name || '').toLowerCase();
    const email = (p.email || '').toLowerCase();
    const phone = (p.phone || p.phoneNumber || '').toLowerCase();
    const lastVisit = (p.lastVisit || p.lastVisitDate || '').toLowerCase();
    const condition = (p.condition || '').toLowerCase();
    return (
      name.includes(q) ||
      email.includes(q) ||
      phone.includes(q) ||
      lastVisit.includes(q) ||
      condition.includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Assigned Patient Directory
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Comprehensive roster of active remote monitoring patients, contact profiles & verified medical histories
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name, email, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-teal-500 bg-slate-50"
          />
        </div>
      </div>

      {/* Directory Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-500 uppercase font-bold text-[10px] tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Patient Name</th>
                <th className="px-5 py-3.5">Email</th>
                <th className="px-5 py-3.5">Phone Number</th>
                <th className="px-5 py-3.5">Last Visit Date</th>
                <th className="px-5 py-3.5">Clinical Baseline</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading && effectivePatients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-14 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 text-teal-600 animate-spin" />
                      <span className="text-xs font-semibold text-slate-600">
                        Loading patient directory...
                      </span>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-14 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mb-3.5 border border-teal-100 shadow-xs">
                        <Users className="w-7 h-7" />
                      </div>
                      <h4 className="text-base font-bold text-slate-900 mb-1">
                        {search ? 'No matching patients found' : 'No patients registered yet'}
                      </h4>
                      <p className="text-xs text-slate-500 max-w-sm">
                        {search
                          ? `No patient records match "${search}". Try searching by another keyword.`
                          : 'No patients registered yet'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((pt) => {
                  const hasAllergies =
                    pt.knownAllergies &&
                    pt.knownAllergies.toLowerCase() !== 'none' &&
                    pt.knownAllergies.toLowerCase() !== 'none reported';

                  return (
                    <tr
                      key={pt.id}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      onClick={() => setSelectedPatient(pt)}
                    >
                      {/* 1. Patient Name */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-800 font-bold flex items-center justify-center shrink-0 border border-teal-100">
                            {pt.name && pt.name.trim() !== ''
                              ? pt.name
                                  .split(' ')
                                  .map((n) => n[0])
                                  .join('')
                                  .slice(0, 2)
                                  .toUpperCase()
                              : 'PT'}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 group-hover:text-teal-700 transition-colors">
                              {pt.name && pt.name.trim() !== '' ? pt.name : 'Not provided'}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              {pt.age ? `${pt.age} yrs` : 'Not provided'} • {pt.gender || 'Not provided'}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* 2. Email */}
                      <td className="px-5 py-4 text-slate-700">
                        {pt.email && pt.email.trim() !== '' ? (
                          <div className="flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="font-mono text-xs text-slate-800">{pt.email}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Not provided</span>
                        )}
                      </td>

                      {/* 3. Phone Number */}
                      <td className="px-5 py-4 text-slate-700">
                        {(pt.phoneNumber && pt.phoneNumber.trim() !== '') ||
                        (pt.phone && pt.phone.trim() !== '') ? (
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="font-mono text-xs text-slate-800">
                              {pt.phoneNumber || pt.phone}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Not provided</span>
                        )}
                      </td>

                      {/* 4. Last Visit Date */}
                      <td className="px-5 py-4 text-slate-700">
                        {(pt.lastVisit && pt.lastVisit.trim() !== '') ||
                        (pt.lastVisitDate && pt.lastVisitDate.trim() !== '') ? (
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                            <span className="text-xs font-medium text-slate-800">
                              {pt.lastVisit || pt.lastVisitDate}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Not provided</span>
                        )}
                      </td>

                      {/* Clinical Baseline & Intake Status */}
                      <td className="px-5 py-4">
                        <div className="space-y-1">
                          {pt.hasCompletedOnboarding ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Intake Verified</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>Pending Intake</span>
                            </span>
                          )}

                          {pt.bloodGroup && pt.bloodGroup !== 'Not specified' && (
                            <div className="flex items-center gap-1 text-[10px] text-rose-700 font-bold font-mono">
                              <Droplet className="w-2.5 h-2.5 fill-rose-500 text-rose-500" />
                              <span>{pt.bloodGroup}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right">
                        <div
                          className="flex items-center justify-end gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => setSelectedPatient(pt)}
                            className="p-2 rounded-xl text-teal-700 hover:bg-teal-50 border border-teal-200 transition-all cursor-pointer"
                            title="View Complete Medical History & IoT Telemetry"
                          >
                            <ClipboardList className="w-4 h-4" />
                          </button>

                          {onOpenEHR && (
                            <button
                              onClick={() => onOpenEHR(pt.name || 'Patient', pt.id)}
                              className="p-2 rounded-xl text-slate-600 hover:text-teal-700 hover:bg-teal-50 border border-slate-200 transition-all cursor-pointer"
                              title="Open EHR & Write Prescription"
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                          )}

                          {onStartVideoCall && (
                            <button
                              onClick={() => onStartVideoCall(pt.name || 'Patient')}
                              className="p-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white shadow-xs transition-all cursor-pointer"
                              title="Start Telehealth Video Consultation"
                            >
                              <Video className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Patient Medical History & IoT Vitals Inspection Modal */}
      {selectedPatient && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 overflow-y-auto"
          onClick={() => setSelectedPatient(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200 my-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 text-white p-6 relative">
              <button
                onClick={() => setSelectedPatient(null)}
                className="absolute right-4 top-4 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-400/30">
                  Clinical Intake Record
                </span>
                {selectedPatient.hasCompletedOnboarding ? (
                  <span className="text-[10px] font-semibold text-emerald-300 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    Onboarding Complete
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold text-amber-300 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-400" />
                    Pending Patient Intake
                  </span>
                )}
              </div>

              <h3 className="text-xl font-black tracking-tight">
                {selectedPatient.name && selectedPatient.name.trim() !== ''
                  ? selectedPatient.name
                  : 'Not provided'}
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                {selectedPatient.age ? `${selectedPatient.age} yrs` : 'Not provided'} •{' '}
                {selectedPatient.gender || 'Not provided'} •{' '}
                {selectedPatient.roomOrBed || 'Remote Care'}
              </p>
            </div>

            {/* Medical Data Details */}
            <div className="p-6 space-y-5 text-xs text-slate-700 max-h-[75vh] overflow-y-auto">
              {/* Patient Contact & Intake Overview */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Email Address
                  </span>
                  <p className="text-xs font-semibold text-slate-800 truncate mt-0.5">
                    {selectedPatient.email && selectedPatient.email.trim() !== ''
                      ? selectedPatient.email
                      : 'Not provided'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Phone Number
                  </span>
                  <p className="text-xs font-semibold text-slate-800 mt-0.5 font-mono">
                    {selectedPatient.phoneNumber || selectedPatient.phone || 'Not provided'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Last Visit Date
                  </span>
                  <p className="text-xs font-semibold text-slate-800 mt-0.5">
                    {selectedPatient.lastVisit || selectedPatient.lastVisitDate || 'Not provided'}
                  </p>
                </div>
              </div>

              {/* Dedicated IoT Vitals Section (Real-Time USB Telemetry Stream) */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-teal-950 text-white border border-teal-500/30 shadow-md space-y-3 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-36 h-36 bg-teal-500/10 rounded-full blur-2xl pointer-events-none" />

                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300">
                      <Thermometer className="w-4 h-4 text-teal-300" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-xs tracking-tight">IoT Vitals</h4>
                      <p className="text-[10px] text-teal-200/80">USB Sensor Hardware Telemetry</p>
                    </div>
                  </div>

                  {isLiveListening && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      Live onSnapshot
                    </span>
                  )}
                </div>

                {liveIoTData?.lastSyncedTemperature !== undefined &&
                liveIoTData.lastSyncedTemperature !== null ? (
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3.5 border border-white/15 space-y-2.5 relative z-10">
                    <div className="flex items-baseline justify-between">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-teal-200 tracking-wider">
                          Body Temperature (Synced)
                        </span>
                        <div className="flex items-baseline gap-2 mt-0.5">
                          <span className="text-3xl font-black font-mono text-white">
                            {liveIoTData.lastSyncedTemperature.toFixed(1)}°C
                          </span>
                          <span className="text-xs text-slate-300 font-mono">
                            ({((liveIoTData.lastSyncedTemperature * 9) / 5 + 32).toFixed(1)}°F)
                          </span>
                        </div>
                      </div>

                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          liveIoTData.temperatureStatus === 'critical'
                            ? 'bg-rose-500 text-white animate-pulse'
                            : liveIoTData.temperatureStatus === 'elevated'
                            ? 'bg-amber-400 text-slate-900'
                            : 'bg-emerald-500 text-white'
                        }`}
                      >
                        {liveIoTData.temperatureStatus === 'critical'
                          ? 'High Fever'
                          : liveIoTData.temperatureStatus === 'elevated'
                          ? 'Mild Fever'
                          : 'Normal'}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-300">
                      <span className="flex items-center gap-1.5 truncate">
                        <Cpu className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                        <span>{liveIoTData.deviceModel || 'USB Serial Temperature Sensor'}</span>
                      </span>
                      <span className="flex items-center gap-1.5 shrink-0 font-mono text-teal-200">
                        <Clock className="w-3.5 h-3.5" />
                        <span>
                          {liveIoTData.lastSyncedAt
                            ? new Date(liveIoTData.lastSyncedAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                              })
                            : 'Synced'}
                        </span>
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white/5 rounded-xl p-3 border border-white/10 text-center relative z-10">
                    <p className="text-xs text-slate-300 font-medium">No USB telemetry synced yet</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Patient has not synced temperature data via /patient/device.
                    </p>
                  </div>
                )}
              </div>

              {/* Blood Group */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-rose-50/60 border border-rose-200/80">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600 font-bold">
                    <Droplet className="w-4 h-4 fill-rose-600" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-xs">Blood Group / Type</p>
                    <p className="text-[11px] text-slate-500">Clinical cross-matching baseline</p>
                  </div>
                </div>
                <span className="text-base font-black font-mono text-rose-700 bg-white px-3 py-1 rounded-xl border border-rose-200 shadow-xs">
                  {livePatientDoc?.bloodGroup ||
                    livePatientDoc?.bloodType ||
                    selectedPatient.bloodGroup ||
                    selectedPatient.bloodType ||
                    'Not provided'}
                </span>
              </div>

              {/* Known Allergies */}
              <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 space-y-1.5">
                <div className="flex items-center gap-2 text-amber-800 font-bold">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Known Drug & Environmental Allergies</span>
                </div>
                <p className="text-xs text-slate-800 bg-white p-3 rounded-xl border border-amber-200/60 font-medium">
                  {(() => {
                    const allergiesVal =
                      livePatientDoc?.knownAllergies ||
                      (Array.isArray(livePatientDoc?.allergies)
                        ? livePatientDoc.allergies.join(', ')
                        : '') ||
                      selectedPatient.knownAllergies;
                    return allergiesVal &&
                      allergiesVal.toLowerCase() !== 'none' &&
                      allergiesVal.toLowerCase() !== 'none reported'
                      ? allergiesVal
                      : 'Not provided';
                  })()}
                </p>
              </div>

              {/* Chronic Conditions */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center gap-2 text-slate-800 font-bold">
                  <Activity className="w-4 h-4 text-teal-600" />
                  <span>Diagnosed Chronic Conditions</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(() => {
                    const conditions =
                      Array.isArray(livePatientDoc?.chronicConditions) &&
                      livePatientDoc.chronicConditions.length > 0
                        ? livePatientDoc.chronicConditions
                        : selectedPatient.chronicConditions;
                    const validConditions =
                      conditions?.filter((c: string) => c !== 'None' && c !== 'Not provided') ||
                      [];

                    if (validConditions.length > 0) {
                      return validConditions.map((cond: string) => (
                        <span
                          key={cond}
                          className="px-3 py-1 rounded-xl text-xs font-bold border bg-teal-50 text-teal-800 border-teal-200"
                        >
                          {cond}
                        </span>
                      ));
                    }
                    return <span className="text-slate-500 font-medium">Not provided</span>;
                  })()}
                </div>
              </div>

              {/* Current Medications */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="flex items-center gap-2 text-slate-800 font-bold">
                  <Pill className="w-4 h-4 text-teal-600" />
                  <span>Current Medications & Dosages</span>
                </div>
                <p className="text-xs text-slate-800 bg-white p-3 rounded-xl border border-slate-200 font-mono whitespace-pre-wrap">
                  {(() => {
                    const meds =
                      livePatientDoc?.currentMedications || selectedPatient.currentMedications;
                    return meds &&
                      meds.toLowerCase() !== 'none' &&
                      meds.toLowerCase() !== 'none reported'
                      ? meds
                      : 'Not provided';
                  })()}
                </p>
              </div>

              {/* Emergency Contact on File */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Emergency Contact on File
                </span>
                <p className="text-xs text-slate-800 font-semibold">
                  {livePatientDoc?.emergencyContact ||
                    selectedPatient.emergencyContact ||
                    'Not provided'}
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              {onOpenEHR && (
                <button
                  onClick={() => {
                    const ptName = selectedPatient.name || 'Patient';
                    const ptId = selectedPatient.id;
                    setSelectedPatient(null);
                    onOpenEHR(ptName, ptId);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-teal-600" />
                  <span>Issue Prescription</span>
                </button>
              )}

              {onStartVideoCall && (
                <button
                  onClick={() => {
                    const ptName = selectedPatient.name || 'Patient';
                    setSelectedPatient(null);
                    onStartVideoCall(ptName);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Video className="w-4 h-4" />
                  <span>Start Video Call</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
