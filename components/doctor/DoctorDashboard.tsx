'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  UserProfile,
  Appointment,
  LiveTelemetryPayload,
  PatientDirectoryItem,
} from '../../lib/types';
import { DoctorTab } from '../navbar/Sidebar';
import { db } from '../../lib/firebase';
import {
  collection,
  query,
  where,
  doc,
  getDoc,
  onSnapshot,
  addDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { useTelehealth } from '../../context/TelehealthContext';
import {
  Video,
  Users,
  Activity,
  Stethoscope,
  Clock,
  AlertTriangle,
  Calendar,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  FilePlus,
  Droplet,
  Pill,
  Thermometer,
  Cpu,
  X,
  FileText,
  ClipboardList,
  Download,
  Loader2,
  Edit3,
} from 'lucide-react';

interface DoctorDashboardProps {
  doctor: UserProfile;
  appointmentsQueue: Appointment[];
  patients: PatientDirectoryItem[];
  liveTelemetry?: LiveTelemetryPayload;
  onNavigateTab: (tab: DoctorTab) => void;
  onStartVideoCall: (appointment: Appointment) => void;
  onOpenEHR: (patientName: string, patientId?: string) => void;
}

interface LivePatientIoTData {
  lastSyncedTemperature?: number;
  lastSyncedAt?: string;
  temperatureStatus?: string;
  deviceModel?: string;
  temperatureUnit?: string;
}

export function DoctorDashboard({
  doctor,
  appointmentsQueue,
  patients,
  liveTelemetry,
  onNavigateTab,
  onStartVideoCall,
  onOpenEHR,
}: DoctorDashboardProps) {
  const { currentUser } = useTelehealth();
  const [selectedPatient, setSelectedPatient] = useState<PatientDirectoryItem | null>(null);
  const [liveIoTData, setLiveIoTData] = useState<LivePatientIoTData | null>(null);
  const [isLiveListening, setIsLiveListening] = useState(false);
  const [liveAppointments, setLiveAppointments] = useState<Appointment[]>([]);
  const [isAppointmentsLoading, setIsAppointmentsLoading] = useState(true);
  const [updatingAptId, setUpdatingAptId] = useState<string | null>(null);
  const [patientProfiles, setPatientProfiles] = useState<Record<string, any>>({});
  const [hasFetchedLiveApts, setHasFetchedLiveApts] = useState(false);
  const [patientRecords, setPatientRecords] = useState<any[]>([]);

  // Direct Firestore query for patient directory: users collection where role == 'patient'
  const [firestorePatients, setFirestorePatients] = useState<PatientDirectoryItem[]>([]);
  const [isPatientsLoading, setIsPatientsLoading] = useState(true);

  // Real-time Firestore query for clinical_records across all patients
  const [allClinicalRecords, setAllClinicalRecords] = useState<any[]>([]);
  const [isRecordsLoading, setIsRecordsLoading] = useState(true);

  // Doctor Note composer state
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [notePatient, setNotePatient] = useState<{ id: string; name: string } | null>(null);
  const [doctorNoteDiagnosis, setDoctorNoteDiagnosis] = useState('');
  const [doctorNoteText, setDoctorNoteText] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [noteSuccess, setNoteSuccess] = useState(false);

  // 1. Appointments Query: Query real patient appointments from appointments collection
  // Wrapped in useEffect with proper loading state and safe client-side sorting
  // CRITICAL: Do NOT use orderBy() in Firestore query to avoid index exceptions; sort client-side in JS
  useEffect(() => {
    let isMounted = true;
    try {
      setIsAppointmentsLoading(true);
      const q = query(collection(db, 'appointments'));

      const unsubscribe = onSnapshot(
        q,
        async (snapshot) => {
          const data: Appointment[] = [];
          snapshot.forEach((docSnap) => {
            data.push({ ...docSnap.data(), id: docSnap.id } as Appointment);
          });

          // Mandatory console.log as required by user prompt
          console.log('Fetched Appointments:', data);

          // Frontend JavaScript sort by date/time
          data.sort((a, b) => {
            const timeA = new Date(`${a?.date || ''} ${a?.time?.split(' - ')[0] || ''}`).getTime();
            const timeB = new Date(`${b?.date || ''} ${b?.time?.split(' - ')[0] || ''}`).getTime();
            if (!isNaN(timeA) && !isNaN(timeB)) {
              return timeA - timeB;
            }
            return (b?.id || '').localeCompare(a?.id || '');
          });

          if (isMounted) {
            setLiveAppointments(data);
            setHasFetchedLiveApts(true);
            setIsAppointmentsLoading(false);
          }

          // Fetch patient user documents via Promise.all for unique patientIds
          const uniquePatientIds = Array.from(
            new Set((data || []).map((apt) => apt?.patientId).filter(Boolean))
          );

          if (uniquePatientIds.length > 0) {
            try {
              const patientDocs = await Promise.all(
                uniquePatientIds.map((pId) => getDoc(doc(db, 'users', pId)))
              );
              const profiles: Record<string, any> = {};
              patientDocs.forEach((pDoc) => {
                if (pDoc.exists()) {
                  profiles[pDoc.id] = pDoc.data();
                }
              });
              if (isMounted) {
                setPatientProfiles((prev) => ({ ...prev, ...profiles }));
              }
            } catch (pErr) {
              console.warn('Error fetching patient user documents via Promise.all:', pErr);
            }
          }
        },
        (error) => {
          console.warn('Doctor appointments query onSnapshot notice:', error);
          if (isMounted) setIsAppointmentsLoading(false);
        }
      );

      return () => {
        isMounted = false;
        unsubscribe();
      };
    } catch (err) {
      console.warn('Error setting up doctor appointments query:', err);
      if (isMounted) setIsAppointmentsLoading(false);
    }
  }, []);

  // 2. Patient Directory Query: Fetch documents from users collection where role == 'patient'
  // Wrapped in useEffect with proper loading state and safe mapping
  useEffect(() => {
    let isMounted = true;
    try {
      setIsPatientsLoading(true);
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
              lastVisit: data.lastVisit || data.lastVisitDate || 'Initial Intake',
              lastVisitDate: data.lastVisitDate || data.lastVisit || '',
              age: data.age || 35,
              gender: data.gender || 'Other',
              condition: data.condition || 'General Care',
              status: data.status || 'Stable',
              roomOrBed: data.roomOrBed || 'Remote Care',
              assignedDoctor: data.assignedDoctor || doctor?.fullName || 'Attending Clinician',
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

          // Client-side sort alphabetically (.sort())
          list.sort((a, b) => (a?.name || '').localeCompare(b?.name || ''));

          if (isMounted) {
            setFirestorePatients(list);
            setIsPatientsLoading(false);
          }
        },
        (error) => {
          console.error('Doctor Dashboard Patients query error:', error);
          if (isMounted) setIsPatientsLoading(false);
        }
      );

      return () => {
        isMounted = false;
        unsubscribe();
      };
    } catch (err) {
      console.error('Error setting up doctor dashboard patients query:', err);
      if (isMounted) setIsPatientsLoading(false);
    }
  }, [doctor?.fullName]);

  // 3. Clinical Records Query: Real-time query to pull in real data generated by patients
  // Wrapped in useEffect with proper loading state
  useEffect(() => {
    let isMounted = true;
    try {
      setIsRecordsLoading(true);
      const q = query(collection(db, 'clinical_records'));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const list: any[] = (snapshot.docs || []).map((docSnap) => {
            const data = docSnap.data() || {};
            return {
              id: docSnap.id,
              patientId: data.patientId || '',
              patientName: data.patientName || 'Patient',
              title: data['Document Title'] || data.documentTitle || data.title || 'Clinical Document',
              type: data['Record Type'] || data.recordType || data.type || 'Lab Report',
              notes: data.notes || data['Notes'] || data.clinicalSummary || '',
              facility: data.facility || data['Facility'] || 'CuraLink Diagnostics',
              date: data.createdAt?.toDate
                ? data.createdAt.toDate().toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : 'Recent',
              fileData: data.fileData || data.downloadUrl,
              createdAt: data.createdAt,
            };
          });

          // Client-side sort descending by timestamp
          list.sort((a, b) => {
            const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
            const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
            return timeB - timeA;
          });

          if (isMounted) {
            setAllClinicalRecords(list);
            setIsRecordsLoading(false);
          }
        },
        (error) => {
          console.warn('Dashboard clinical_records query error:', error);
          if (isMounted) setIsRecordsLoading(false);
        }
      );

      return () => {
        isMounted = false;
        unsubscribe();
      };
    } catch (err) {
      console.warn('Error setting up dashboard clinical_records query:', err);
      if (isMounted) setIsRecordsLoading(false);
    }
  }, []);

  // Actionable Feature: Update Appointment Status wired to updateDoc
  const handleUpdateAppointmentStatus = async (aptId: string, newStatus: string) => {
    try {
      setUpdatingAptId(aptId);
      await updateDoc(doc(db, 'appointments', aptId), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
      setLiveAppointments((prev) =>
        (prev || []).map((apt) => (apt?.id === aptId ? { ...apt, status: newStatus } : apt))
      );
    } catch (err) {
      console.error('Error updating appointment status:', err);
    } finally {
      setUpdatingAptId(null);
    }
  };

  // Actionable Feature: Add Doctor Note wired to addDoc
  const handleSaveDoctorNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notePatient || !doctorNoteText.trim()) return;

    try {
      setIsSavingNote(true);
      const noteTitle = `Doctor Clinical Note - ${doctorNoteDiagnosis.trim() || 'General Evaluation'}`;
      const doctorId = currentUser?.uid || doctor?.uid || 'doctor_attending';
      const doctorName = currentUser?.fullName || doctor?.fullName || 'Attending Physician';

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
        diagnosis: doctorNoteDiagnosis.trim() || 'General Telehealth Observation',
        facility: 'CuraLink Clinical Suite',
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
          diagnosis: doctorNoteDiagnosis.trim() || 'General Telehealth Observation',
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
      console.error('Error saving doctor clinical note:', err);
    } finally {
      setIsSavingNote(false);
    }
  };

  // Fetch full medical history when selectedPatient opens if not already cached
  useEffect(() => {
    if (!selectedPatient?.id || patientProfiles[selectedPatient.id]) return;
    getDoc(doc(db, 'users', selectedPatient.id))
      .then((docSnap) => {
        if (docSnap.exists()) {
          setPatientProfiles((prev) => ({ ...prev, [docSnap.id]: docSnap.data() }));
        }
      })
      .catch((err) => console.warn('Error fetching selected patient profile:', err));
  }, [selectedPatient?.id, patientProfiles]);

  useEffect(() => {
    if (!selectedPatient?.id) {
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
          setPatientProfiles((prev) => ({ ...prev, [selectedPatient.id]: data }));
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
      (err) => console.warn('Doctor dashboard live patient user onSnapshot notice:', err)
    );

    // Real-time listener for patient's clinical_records / diagnostic attachments
    const recsQuery = query(
      collection(db, 'clinical_records'),
      where('patientId', '==', selectedPatient.id)
    );
    const unsubRecs = onSnapshot(
      recsQuery,
      (snapshot) => {
        const docs = snapshot.docs.map((d) => {
          const data = d.data();
          const content = data.content || {};
          return {
            id: d.id,
            title:
              data['Document Title'] ||
              data.documentTitle ||
              data.title ||
              content.title ||
              'Clinical Document',
            type:
              data['Record Type'] ||
              data.recordType ||
              data.type ||
              content.type ||
              'Lab Report',
            notes:
              data.notes ||
              data['Notes'] ||
              data.clinicalSummary ||
              data['Clinical Summary'] ||
              data.summary ||
              content.notes ||
              content.summary ||
              '',
            facility:
              data.facility ||
              data['Facility'] ||
              content.facility ||
              'CuraLink Diagnostics',
            date: data.createdAt?.toDate
              ? data.createdAt.toDate().toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : content.date || 'Recent',
            fileData:
              data.fileData ||
              content.fileData ||
              data.downloadUrl ||
              content.downloadUrl,
            downloadUrl:
              data.downloadUrl ||
              content.downloadUrl ||
              data.fileData ||
              content.fileData,
            createdAt: data.createdAt,
          };
        });
        docs.sort((a: any, b: any) => {
          const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
          const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
          return timeB - timeA;
        });
        setPatientRecords(docs);
      },
      (err) => console.warn('Doctor dashboard clinical_records listener notice:', err)
    );

    return () => {
      unsubscribe();
      unsubRecs();
      setIsLiveListening(false);
    };
  }, [selectedPatient?.id]);

  // Real-time Firestore fetch for doctor's isVerified status
  const [isVerified, setIsVerified] = useState<boolean | undefined>(doctor?.isVerified);

  useEffect(() => {
    if (!doctor?.uid) return;

    try {
      const userDocRef = doc(db, 'users', doctor.uid);
      const unsubscribe = onSnapshot(
        userDocRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            setIsVerified(data.isVerified === true);
          } else {
            setIsVerified(false);
          }
        },
        (error) => {
          console.warn('Doctor verification status listener notice:', error);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.warn('Error subscribing to doctor verification status:', err);
    }
  }, [doctor?.uid]);

  useEffect(() => {
    if (doctor?.isVerified !== undefined) {
      setIsVerified(doctor.isVerified);
    }
  }, [doctor?.isVerified]);

  const displayedAppointments = hasFetchedLiveApts
    ? liveAppointments
    : (appointmentsQueue && appointmentsQueue.length > 0 ? appointmentsQueue : liveAppointments);
  const nextVisit = displayedAppointments[0];
  const activePatientsDirectory = firestorePatients.length > 0 ? firestorePatients : (patients || []);
  const criticalCount = (activePatientsDirectory || []).filter((p) => p?.status === 'Critical').length;

  // Build a unique patients roster from appointments + active patients directory
  const uniquePatientsList: PatientDirectoryItem[] = React.useMemo(() => {
    const list: PatientDirectoryItem[] = [];
    const seenIds = new Set<string>();

    // 1. From appointments with denormalized & fetched profile data
    (displayedAppointments || []).forEach((apt) => {
      const pid = apt?.patientId || `apt_pt_${apt?.patientName}`;
      if (seenIds.has(pid)) return;
      seenIds.add(pid);

      const profile = patientProfiles[apt?.patientId] || {};
      const matched = (activePatientsDirectory || []).find((p) => p?.id === apt?.patientId || p?.name?.toLowerCase() === apt?.patientName?.toLowerCase());

      const bloodGroupRaw = apt?.bloodGroup || profile.bloodGroup || profile.bloodType || matched?.bloodGroup;
      const bloodGroup = (bloodGroupRaw && bloodGroupRaw !== 'Not specified') ? bloodGroupRaw : 'No data provided';

      const rawAllergies = apt?.knownAllergies || profile.knownAllergies || (profile.allergies ? profile.allergies.join(', ') : matched?.knownAllergies);
      const allergies = (rawAllergies && rawAllergies.trim().length > 0 && rawAllergies.toLowerCase() !== 'none' && rawAllergies.toLowerCase() !== 'none reported')
        ? rawAllergies
        : 'No data provided';

      const rawChronic = (apt?.chronicConditions && apt.chronicConditions.length > 0 && apt.chronicConditions[0] !== 'None')
        ? apt.chronicConditions
        : (profile.chronicConditions && profile.chronicConditions.length > 0 && profile.chronicConditions[0] !== 'None')
          ? profile.chronicConditions
          : (matched?.chronicConditions && matched.chronicConditions.length > 0 && matched.chronicConditions[0] !== 'None')
            ? matched.chronicConditions
            : [];
      const chronic = rawChronic.length > 0 ? rawChronic : ['No data provided'];

      const currentMedications = apt?.currentMedications || profile.currentMedications || matched?.currentMedications || 'No data provided';
      const patientEmail = apt?.patientEmail || profile.email || matched?.email || 'No data provided';
      const patientPhone = apt?.patientPhone || profile.phoneNumber || matched?.phoneNumber || 'No data provided';
      const emergencyContact = apt?.emergencyContact || profile.emergencyContact || matched?.emergencyContact || 'No data provided';

      list.push({
        id: apt?.patientId,
        name: apt?.patientName,
        age: profile.age || matched?.age || 35,
        gender: profile.gender || matched?.gender || 'Other',
        condition: apt?.symptoms || profile.condition || matched?.condition || 'No data provided',
        status: matched?.status || 'Stable',
        roomOrBed: profile.roomOrBed || matched?.roomOrBed || 'Remote Telehealth',
        assignedDoctor: doctor?.fullName || 'Attending Clinician',
        lastVisit: apt?.date || matched?.lastVisit || 'Initial Intake',
        nextAppointment: apt?.time || matched?.nextAppointment,
        bloodGroup,
        bloodType: bloodGroup,
        allergies: allergies !== 'No data provided' ? [allergies] : [],
        knownAllergies: allergies,
        chronicConditions: chronic,
        currentMedications,
        email: patientEmail,
        phoneNumber: patientPhone,
        emergencyContact,
        hasCompletedOnboarding: profile.hasCompletedOnboarding ?? matched?.hasCompletedOnboarding ?? false,
        lastSyncedTemperature: profile.lastSyncedTemperature ?? matched?.lastSyncedTemperature,
        lastSyncedAt: profile.lastSyncedAt ?? matched?.lastSyncedAt,
        temperatureStatus: profile.temperatureStatus ?? matched?.temperatureStatus,
        deviceModel: profile.deviceModel ?? matched?.deviceModel,
        currentVitals: matched?.currentVitals || {
          heartRate: profile.currentVitals?.heartRate || 72,
          spo2: profile.currentVitals?.spo2 || 98,
          temperature: profile.lastSyncedTemperature || 37.0,
          bloodPressure: profile.currentVitals?.bloodPressure || '120/80',
        },
      });
    });

    // 2. Also append any patients from directory not yet in the list
    (activePatientsDirectory || []).forEach((p) => {
      if (seenIds.has(p?.id)) return;
      seenIds.add(p?.id);

      const profile = patientProfiles[p?.id] || {};
      const bloodGroupRaw = p?.bloodGroup || profile.bloodGroup || profile.bloodType;
      const bloodGroup = (bloodGroupRaw && bloodGroupRaw !== 'Not specified') ? bloodGroupRaw : 'No data provided';

      const rawAllergies = p?.knownAllergies || profile.knownAllergies || (profile.allergies ? profile.allergies.join(', ') : undefined);
      const allergies = (rawAllergies && rawAllergies.trim().length > 0 && rawAllergies.toLowerCase() !== 'none' && rawAllergies.toLowerCase() !== 'none reported')
        ? rawAllergies
        : 'No data provided';

      const rawChronic = (p?.chronicConditions && p.chronicConditions.length > 0 && p.chronicConditions[0] !== 'None')
        ? p.chronicConditions
        : (profile.chronicConditions && profile.chronicConditions.length > 0 && profile.chronicConditions[0] !== 'None')
          ? profile.chronicConditions
          : [];
      const chronic = rawChronic.length > 0 ? rawChronic : ['No data provided'];

      list.push({
        ...p,
        bloodGroup,
        bloodType: bloodGroup,
        knownAllergies: allergies,
        chronicConditions: chronic,
        currentMedications: p?.currentMedications || profile.currentMedications || 'No data provided',
        email: p?.email || profile.email || 'No data provided',
        phoneNumber: p?.phoneNumber || profile.phoneNumber || 'No data provided',
        emergencyContact: p?.emergencyContact || profile.emergencyContact || 'No data provided',
      });
    });

    return list;
  }, [displayedAppointments, activePatientsDirectory, patientProfiles, doctor?.fullName]);

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------- */}
      {/* CLINICIAN CREDENTIAL VERIFICATION STATUS BANNER / BADGE       */}
      {/* ------------------------------------------------------------- */}
      {isVerified === true ? (
        /* GREEN 'Status: Verified' BADGE / BANNER */
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md shadow-emerald-950/20 animate-in fade-in duration-200">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-sm text-white">Status: Verified</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-mono">
                  Active Clinician
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Your medical license credentials have been reviewed and approved by the Super Administrator. Full telehealth consultations and digital prescriptions are active.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 font-mono text-xs font-bold border border-emerald-500/40 shadow-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Verified License: {doctor?.licenseNumber || 'Active MD'}
            </span>
          </div>
        </div>
      ) : (
        /* YELLOW 'Status: Unverified - Pending Admin Approval' WARNING BANNER */
        <div className="bg-amber-500/15 border-2 border-amber-500/40 text-amber-200 p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg shadow-amber-950/20 animate-in fade-in duration-200">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
              <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div className="space-y-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-black text-sm sm:text-base text-amber-300">
                  Status: Unverified - Pending Admin Approval
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-amber-500/25 text-amber-300 border border-amber-500/40 font-mono">
                  Pending Review
                </span>
              </div>
              <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                Your medical license and clinician account are currently under administrative review by the Super Administrator. You will receive active consultation privileges once credentials are verified.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900/90 text-amber-400 font-mono text-xs font-bold border border-amber-500/40 shadow-xs">
              <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              Awaiting Admin Approval
            </span>
          </div>
        </div>
      )}

      {/* Clinician Welcome Hero */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 text-white p-6 sm:p-8 rounded-3xl shadow-lg border border-slate-700/60 relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-400/30">
                Clinician Workspace
              </span>
              <span className="text-xs text-slate-300 flex items-center gap-1 font-mono">
                <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
                {doctor?.licenseNumber || 'Verified MD'}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              {doctor?.fullName || 'Dr. Clinician'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
              {doctor?.specialty || 'General Tele-Medicine'} • CuraLink Telehealth Network. {activePatientsDirectory.length > 0 ? `${activePatientsDirectory.length} registered patient stream${activePatientsDirectory.length === 1 ? '' : 's'} reporting.` : 'No patient telemetry streams active.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => onNavigateTab('ward-telemetry')}
              className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-md shadow-teal-900/50 transition-all cursor-pointer flex items-center gap-2"
            >
              <Activity className="w-4 h-4" />
              <span>Ward Telemetry Stream</span>
            </button>

            <button
              onClick={() => onOpenEHR(nextVisit?.patientName || '')}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/20 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <FilePlus className="w-4 h-4 text-teal-300" />
              <span>Write Prescription</span>
            </button>

            <button
              onClick={() => {
                setNotePatient({
                  id: nextVisit?.patientId || activePatientsDirectory[0]?.id || '',
                  name: nextVisit?.patientName || activePatientsDirectory[0]?.name || 'Patient',
                });
                setIsNoteModalOpen(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-indigo-600/90 hover:bg-indigo-600 text-white font-bold text-xs border border-indigo-400/40 transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-indigo-950/40"
            >
              <Edit3 className="w-4 h-4 text-indigo-200" />
              <span>Add Doctor Note</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 Clinical Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Today's Queue */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Today&apos;s Appointments
            </span>
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 font-mono">
              {isAppointmentsLoading ? (
                <Loader2 className="w-6 h-6 animate-spin text-teal-600 inline" />
              ) : (
                displayedAppointments.length
              )}
            </span>
            <span className="text-xs text-slate-500 font-medium">Scheduled</span>
          </div>
          <p className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-teal-700 font-semibold truncate">
            Next: {nextVisit ? `${nextVisit.patientName} (${nextVisit.time})` : 'No upcoming appointments'}
          </p>
        </div>

        {/* Card 2: Critical Ward Alarms */}
        <div
          className={`rounded-2xl p-5 border shadow-xs cursor-pointer transition-all ${
            criticalCount > 0
              ? 'bg-rose-50/50 border-rose-300'
              : 'bg-white border-slate-200/80'
          }`}
          onClick={() => onNavigateTab('ward-telemetry')}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Ward Alerts
            </span>
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                criticalCount > 0 ? 'bg-rose-500 text-white animate-bounce' : 'bg-slate-100 text-slate-600'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-rose-600 font-mono">{criticalCount}</span>
            <span className="text-xs text-slate-500 font-medium">Critical Thresholds</span>
          </div>
          <p className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-rose-700 font-bold">
            {criticalCount > 0 ? 'Urgent attention required' : 'All parameters nominal'}
          </p>
        </div>

        {/* Card 3: Active Patient Roster */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Patient Directory
            </span>
            <div className="w-8 h-8 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 font-mono">
              {isPatientsLoading ? (
                <Loader2 className="w-6 h-6 animate-spin text-cyan-600 inline" />
              ) : (
                activePatientsDirectory.length
              )}
            </span>
            <span className="text-xs text-slate-500 font-medium">Registered Patients</span>
          </div>
          <p className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{activePatientsDirectory.length > 0 ? 'Live Firestore Database' : 'Awaiting patient signups'}</span>
          </p>
        </div>

        {/* Card 4: Clinical Records Vault */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Clinical Records
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Stethoscope className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 font-mono">
              {isRecordsLoading ? (
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600 inline" />
              ) : (
                allClinicalRecords.length
              )}
            </span>
            <span className="text-xs text-slate-500 font-medium">Diagnostic Files</span>
          </div>
          <p className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-500 font-mono">
            {allClinicalRecords.length > 0 ? 'Patient Uploads Live' : 'No records yet'}
          </p>
        </div>
      </div>

      {/* Today's Scheduled Patient Queue with 1-Click Video Call Action */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">Today&apos;s Telehealth Queue</h3>
            <p className="text-xs text-slate-500">Upcoming virtual consultations and clinical triage slots</p>
          </div>
          <span className="text-xs font-bold text-teal-700 bg-teal-50 px-3 py-1 rounded-full border border-teal-200/60">
            {displayedAppointments.length} Visits Scheduled
          </span>
        </div>

        {displayedAppointments.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center">
            <Calendar className="w-10 h-10 text-slate-300 mb-2 stroke-1" />
            <p className="font-bold text-slate-700 text-sm">No records found</p>
            <p className="text-slate-400 mt-1 max-w-sm">There are no patient consultations currently in your queue.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {(displayedAppointments || []).map((apt, index) => {
              const profile = patientProfiles[apt.patientId] || {};
              const matchedPt = (patients || []).find(
                (p) => p?.id === apt?.patientId || p?.name?.toLowerCase() === apt?.patientName?.toLowerCase()
              );

              // Graceful Fallbacks: If patient medical data is missing, display 'No data provided'
              const bloodGroupRaw = apt.bloodGroup || profile.bloodGroup || profile.bloodType || matchedPt?.bloodGroup;
              const bloodGroup = (bloodGroupRaw && bloodGroupRaw !== 'Not specified') ? bloodGroupRaw : 'No data provided';

              const rawAllergies = apt.knownAllergies || profile.knownAllergies || (profile.allergies ? profile.allergies.join(', ') : matchedPt?.knownAllergies);
              const allergies = (rawAllergies && rawAllergies.trim().length > 0 && rawAllergies.toLowerCase() !== 'none' && rawAllergies.toLowerCase() !== 'none reported')
                ? rawAllergies
                : 'No data provided';

              const rawChronic = (apt.chronicConditions && apt.chronicConditions.length > 0 && apt.chronicConditions[0] !== 'None')
                ? apt.chronicConditions
                : (profile.chronicConditions && profile.chronicConditions.length > 0 && profile.chronicConditions[0] !== 'None')
                  ? profile.chronicConditions
                  : (matchedPt?.chronicConditions && matchedPt.chronicConditions.length > 0 && matchedPt.chronicConditions[0] !== 'None')
                    ? matchedPt.chronicConditions
                    : [];
              const chronic = rawChronic.length > 0 ? rawChronic : ['No data provided'];

              const chiefSymptoms = apt.symptoms || profile.condition || matchedPt?.condition || 'No data provided';
              const patientEmail = apt.patientEmail || profile.email || matchedPt?.email || 'No data provided';
              const patientPhone = apt.patientPhone || profile.phoneNumber || matchedPt?.phoneNumber || 'No data provided';

              return (
              <div
                key={apt.id}
                className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  index === 0
                    ? 'bg-teal-50/40 border-teal-300 shadow-xs'
                    : 'bg-white border-slate-200/80 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-teal-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
                    {(apt.patientName || 'Patient')
                      .split(' ')
                      .map((n) => (n || '')[0] || '')
                      .join('')}
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900">{apt.patientName}</h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {apt.type}
                      </span>
                      {bloodGroup !== 'No data provided' ? (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold font-mono">
                          <Droplet className="w-2.5 h-2.5 fill-rose-500 text-rose-500" />
                          {bloodGroup}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-slate-50 text-slate-500 border border-slate-200 text-[10px]">
                          Blood Group: No data provided
                        </span>
                      )}
                      {(matchedPt?.lastSyncedTemperature !== undefined || profile.lastSyncedTemperature !== undefined) && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-200 text-[10px] font-bold font-mono">
                          <Thermometer className="w-2.5 h-2.5 text-teal-600" />
                          <span>{(matchedPt?.lastSyncedTemperature ?? profile.lastSyncedTemperature)?.toFixed(1)}°C (IoT)</span>
                        </span>
                      )}
                      {index === 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 animate-pulse">
                          Ready to Start
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-600 mt-1 max-w-xl">
                      <strong className="text-slate-800">Chief Symptoms:</strong> {chiefSymptoms}
                    </p>

                    {/* Medical History Badges with Graceful Fallbacks */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      {allergies !== 'No data provided' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-semibold">
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          <span>Allergy: {allergies}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-50 text-slate-500 border border-slate-200 text-[10px]">
                          <span>Allergies: No data provided</span>
                        </span>
                      )}
                      {(chronic || []).map((c: string) => (
                        <span
                          key={c}
                          className={`px-2 py-0.5 rounded-md border text-[10px] ${
                            c === 'No data provided'
                              ? 'bg-slate-50 text-slate-500 border-slate-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200 font-medium'
                          }`}
                        >
                          {c === 'No data provided' ? 'Conditions: No data provided' : c}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200">
                  <div className="text-left sm:text-right space-y-1">
                    <p className="text-xs font-bold text-slate-800 flex items-center gap-1 sm:justify-end">
                      <Clock className="w-3.5 h-3.5 text-teal-600" />
                      <span>{apt?.time || 'Consultation Slot'}</span>
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono">{apt?.date}</p>

                    {/* Interactive Appointment Status Updater */}
                    <div className="flex items-center gap-1.5 sm:justify-end">
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Status:</span>
                      <select
                        value={apt?.status || 'scheduled'}
                        disabled={updatingAptId === apt?.id}
                        onChange={(e) => handleUpdateAppointmentStatus(apt?.id, e.target.value)}
                        className="text-[11px] font-bold rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-slate-700 hover:border-teal-400 focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer disabled:opacity-50"
                        title="Update Appointment Status"
                      >
                        <option value="scheduled">Scheduled</option>
                        <option value="in-progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                      {updatingAptId === apt?.id && (
                        <Loader2 className="w-3 h-3 animate-spin text-teal-600" />
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const targetPt: PatientDirectoryItem = matchedPt || {
                          id: apt?.patientId,
                          name: apt?.patientName,
                          age: profile.age || 35,
                          gender: profile.gender || 'Other',
                          condition: chiefSymptoms,
                          status: 'Stable',
                          roomOrBed: profile.roomOrBed || 'Remote Telehealth',
                          assignedDoctor: doctor?.fullName || 'Attending Clinician',
                          lastVisit: apt?.date || 'Today',
                          nextAppointment: apt?.time,
                          bloodGroup,
                          bloodType: bloodGroup,
                          knownAllergies: allergies,
                          chronicConditions: chronic,
                          currentMedications: apt?.currentMedications || profile.currentMedications || 'No data provided',
                          email: patientEmail,
                          phoneNumber: patientPhone,
                          emergencyContact: apt?.emergencyContact || profile.emergencyContact || 'No data provided',
                          hasCompletedOnboarding: profile.hasCompletedOnboarding ?? false,
                          lastSyncedTemperature: profile.lastSyncedTemperature,
                          lastSyncedAt: profile.lastSyncedAt,
                          temperatureStatus: profile.temperatureStatus,
                          deviceModel: profile.deviceModel,
                          currentVitals: {
                            heartRate: profile.currentVitals?.heartRate || 72,
                            spo2: profile.currentVitals?.spo2 || 98,
                            temperature: profile.lastSyncedTemperature || 37.0,
                            bloodPressure: profile.currentVitals?.bloodPressure || '120/80',
                          },
                        };
                        setSelectedPatient(targetPt);
                      }}
                      className="p-2 rounded-xl border border-teal-200 hover:bg-teal-50 text-teal-700 transition-all cursor-pointer"
                      title="Inspect Patient & IoT Vitals"
                    >
                      <ClipboardList className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => {
                        setNotePatient({ id: apt?.patientId || '', name: apt?.patientName || 'Patient' });
                        setIsNoteModalOpen(true);
                      }}
                      className="p-2 rounded-xl border border-indigo-200 hover:bg-indigo-50 text-indigo-700 transition-all cursor-pointer"
                      title="Add Doctor Note"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => onOpenEHR(apt?.patientName || '', apt?.patientId)}
                      className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition-all cursor-pointer"
                      title="Write Prescription"
                    >
                      <FileText className="w-4 h-4" />
                    </button>

                    <Link
                      href={`/call/${apt?.id}`}
                      onClick={() => onStartVideoCall(apt)}
                      className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md shadow-teal-600/20 transition-all cursor-pointer flex items-center gap-2"
                    >
                      <Video className="w-4 h-4" />
                      <span>Join Call</span>
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        )}
      </div>

      {/* My Patients - Unique Consultation Roster */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">My Patients</h3>
            <p className="text-xs text-slate-500">Active roster of assigned and scheduled telehealth patients</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-teal-700 bg-teal-50 px-3 py-1 rounded-full border border-teal-200/60">
              {uniquePatientsList.length} Registered Patients
            </span>
            <button
              onClick={() => onNavigateTab('patient-directory')}
              className="text-xs text-teal-600 hover:text-teal-700 font-bold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>View Full Directory</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {uniquePatientsList.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center">
            <Users className="w-10 h-10 text-slate-300 mb-2 stroke-1" />
            <p className="font-bold text-slate-700 text-sm">No records found</p>
            <p className="text-slate-400 mt-1 max-w-sm">Patient records will appear here as appointments are scheduled or assigned.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(uniquePatientsList || []).map((pt) => {
              const hasAllergies = pt.knownAllergies && pt.knownAllergies !== 'No data provided' && pt.knownAllergies.toLowerCase() !== 'none';
              const chronicList = pt.chronicConditions && pt.chronicConditions.length > 0 && pt.chronicConditions[0] !== 'None'
                ? pt.chronicConditions
                : ['No data provided'];

              return (
                <div
                  key={pt.id}
                  className="p-4 rounded-2xl border border-slate-200/80 hover:border-teal-300 hover:shadow-xs transition-all bg-white flex flex-col justify-between gap-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-800 font-bold flex items-center justify-center shrink-0 border border-teal-100">
                      {(pt.name || 'Patient')
                        .split(' ')
                        .map((n) => (n || '')[0] || '')
                        .join('')}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-bold text-slate-900 truncate">{pt.name}</h4>
                        {pt.bloodGroup && pt.bloodGroup !== 'No data provided' && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold font-mono shrink-0">
                            <Droplet className="w-2.5 h-2.5 fill-rose-500 text-rose-500" />
                            {pt.bloodGroup}
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {pt.email || 'No data provided'} • {pt.gender} • {pt.roomOrBed || 'Remote Home-Care'}
                      </p>

                      {/* Medical History Badges with Graceful Fallbacks */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        {hasAllergies ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-semibold">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            <span>Allergy: {pt.knownAllergies}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-50 text-slate-500 border border-slate-200 text-[10px]">
                            <span>Allergies: No data provided</span>
                          </span>
                        )}

                        {(chronicList || []).map((c: string) => (
                          <span
                            key={c}
                            className={`px-2 py-0.5 rounded-md border text-[10px] ${
                              c === 'No data provided'
                                ? 'bg-slate-50 text-slate-500 border-slate-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200 font-medium'
                            }`}
                          >
                            {c === 'No data provided' ? 'Conditions: No data provided' : c}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                    <span className="text-[11px] text-slate-500">
                      Intake: <strong className={pt.hasCompletedOnboarding ? 'text-emerald-700' : 'text-amber-700'}>{pt.hasCompletedOnboarding ? 'Complete' : 'Pending Intake'}</strong>
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setSelectedPatient(pt)}
                        className="px-2.5 py-1.5 rounded-lg border border-teal-200 hover:bg-teal-50 text-teal-700 font-semibold text-[11px] transition-all flex items-center gap-1 cursor-pointer"
                        title="View Medical Intake"
                      >
                        <ClipboardList className="w-3.5 h-3.5" />
                        <span>History</span>
                      </button>

                      <button
                        onClick={() => {
                          setNotePatient({ id: pt?.id, name: pt?.name || 'Patient' });
                          setIsNoteModalOpen(true);
                        }}
                        className="px-2.5 py-1.5 rounded-lg border border-indigo-200 hover:bg-indigo-50 text-indigo-700 font-semibold text-[11px] transition-all flex items-center gap-1 cursor-pointer"
                        title="Add Doctor Note"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Note</span>
                      </button>

                      <button
                        onClick={() => onOpenEHR(pt.name, pt.id)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-[11px] transition-all flex items-center gap-1 cursor-pointer"
                        title="Write Prescription"
                      >
                        <FileText className="w-3.5 h-3.5 text-teal-600" />
                        <span>Rx</span>
                      </button>

                      {/* Video Call button routes to /call/[appointmentId] */}
                      {(() => {
                        const matchedApt = displayedAppointments.find((a) => a.patientId === pt.id || a.patientName === pt.name);
                        const targetCallUrl = matchedApt ? `/call/${matchedApt.id}` : `/call/consult-${pt.id.replace(/[^a-zA-Z0-9]/g, '-')}`;
                        return (
                          <Link
                            href={targetCallUrl}
                            className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-[11px] transition-all flex items-center gap-1 shadow-xs cursor-pointer"
                          >
                            <Video className="w-3.5 h-3.5" />
                            <span>Call</span>
                          </Link>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Patient Details & Real-Time IoT Vitals Modal */}
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

              <h3 className="text-xl font-black tracking-tight">{selectedPatient.name}</h3>
              <p className="text-xs text-slate-300 mt-0.5">
                {selectedPatient.age} yrs • {selectedPatient.gender} • {selectedPatient.roomOrBed}
              </p>
            </div>

            {/* Medical Data Details & Dedicated IoT Vitals */}
            <div className="p-6 space-y-5 text-xs text-slate-700 max-h-[75vh] overflow-y-auto">
              {/* Dedicated IoT Vitals Section */}
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

                {liveIoTData?.lastSyncedTemperature !== undefined && liveIoTData.lastSyncedTemperature !== null ? (
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
                            ? new Date(liveIoTData.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
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
                  {selectedPatient.bloodGroup && selectedPatient.bloodGroup !== 'Not specified'
                    ? selectedPatient.bloodGroup
                    : patientProfiles[selectedPatient.id]?.bloodGroup && patientProfiles[selectedPatient.id]?.bloodGroup !== 'Not specified'
                      ? patientProfiles[selectedPatient.id]?.bloodGroup
                      : 'No data provided'}
                </span>
              </div>

              {/* Known Allergies */}
              <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 space-y-1.5">
                <div className="flex items-center gap-2 text-amber-800 font-bold">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Known Drug & Environmental Allergies</span>
                </div>
                <p className="text-xs text-slate-800 bg-white p-3 rounded-xl border border-amber-200/60 font-medium">
                  {selectedPatient.knownAllergies && selectedPatient.knownAllergies.toLowerCase() !== 'none reported' && selectedPatient.knownAllergies.toLowerCase() !== 'none'
                    ? selectedPatient.knownAllergies
                    : patientProfiles[selectedPatient.id]?.knownAllergies && patientProfiles[selectedPatient.id]?.knownAllergies.toLowerCase() !== 'none'
                      ? patientProfiles[selectedPatient.id]?.knownAllergies
                      : (patientProfiles[selectedPatient.id]?.allergies && patientProfiles[selectedPatient.id].allergies.length > 0)
                        ? patientProfiles[selectedPatient.id].allergies.join(', ')
                        : 'No data provided'}
                </p>
              </div>

              {/* Chronic Conditions */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center gap-2 text-slate-800 font-bold">
                  <Activity className="w-4 h-4 text-teal-600" />
                  <span>Diagnosed Chronic Conditions</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {((selectedPatient?.chronicConditions && selectedPatient.chronicConditions.length > 0 && selectedPatient.chronicConditions[0] !== 'None' && selectedPatient.chronicConditions[0] !== 'No data provided') ||
                    (patientProfiles[selectedPatient?.id]?.chronicConditions && patientProfiles[selectedPatient.id]?.chronicConditions.length > 0 && patientProfiles[selectedPatient.id]?.chronicConditions[0] !== 'None')) ? (
                    ((selectedPatient?.chronicConditions && selectedPatient.chronicConditions.length > 0 && selectedPatient.chronicConditions[0] !== 'None' && selectedPatient.chronicConditions[0] !== 'No data provided')
                      ? selectedPatient.chronicConditions
                      : (patientProfiles[selectedPatient?.id]?.chronicConditions || [])
                    ).map((cond: string) => (
                      <span
                        key={cond}
                        className={`px-3 py-1 rounded-xl text-xs font-bold border ${
                          cond === 'None'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-teal-50 text-teal-800 border-teal-200'
                        }`}
                      >
                        {cond}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-500 font-medium">No data provided</span>
                  )}
                </div>
              </div>

              {/* Current Medications */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="flex items-center gap-2 text-slate-800 font-bold">
                  <Pill className="w-4 h-4 text-teal-600" />
                  <span>Current Medications & Dosages</span>
                </div>
                <p className="text-xs text-slate-800 bg-white p-3 rounded-xl border border-slate-200 font-mono whitespace-pre-wrap">
                  {selectedPatient?.currentMedications && selectedPatient.currentMedications.toLowerCase() !== 'none reported' && selectedPatient.currentMedications.toLowerCase() !== 'none'
                    ? selectedPatient.currentMedications
                    : patientProfiles[selectedPatient?.id]?.currentMedications && patientProfiles[selectedPatient.id]?.currentMedications.toLowerCase() !== 'none'
                      ? patientProfiles[selectedPatient?.id]?.currentMedications
                      : 'No data provided'}
                </p>
              </div>

              {/* Patient's Uploaded Medical Records & Diagnostic Vault (Base64 View) */}
              <div className="p-4 rounded-2xl bg-teal-50/50 border border-teal-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-teal-600" />
                    <span className="font-bold text-slate-900 text-xs">
                      Uploaded Diagnostic Records ({(patientRecords || []).length})
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-teal-700 bg-white px-2 py-0.5 rounded-full border border-teal-200">
                    Base64 EHR Vault
                  </span>
                </div>

                {(patientRecords || []).length === 0 ? (
                  <p className="text-xs text-slate-500 bg-white p-3 rounded-xl border border-teal-100 text-center">
                    No clinical documents or diagnostics uploaded by this patient yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {(patientRecords || []).map((rec) => {
                      const isImg =
                        rec.fileData?.startsWith('data:image/') ||
                        rec.type === 'Imaging' ||
                        /\.(png|jpe?g|gif|webp|svg)$/i.test(rec.title);
                      const isPdf =
                        rec.fileData?.startsWith('data:application/pdf') ||
                        /\.pdf$/i.test(rec.title);

                      return (
                        <div
                          key={rec.id}
                          className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                                {rec.type}
                              </span>
                              <h5 className="font-bold text-slate-900 text-xs mt-1.5">{rec.title}</h5>
                              <p className="text-[11px] text-slate-400">
                                {rec.facility} • {rec.date}
                              </p>
                            </div>

                            {rec.fileData && (
                              <a
                                href={rec.fileData}
                                download={`${rec.title.replace(/\s+/g, '_')}${isPdf && !rec.title.endsWith('.pdf') ? '.pdf' : ''}`}
                                className="p-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 transition-colors"
                                title="Download File"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>

                          {rec.notes && (
                            <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                              {rec.notes}
                            </p>
                          )}

                          {/* Base64 Data URL Display */}
                          {rec.fileData && (
                            <div className="pt-2 border-t border-slate-100">
                              {isImg ? (
                                <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50 p-2 flex items-center justify-center">
                                  {/* Image render: <img src={record.fileData} /> */}
                                  <img
                                    src={rec.fileData}
                                    alt={rec.title}
                                    className="max-h-60 w-full object-contain rounded-lg"
                                  />
                                </div>
                              ) : isPdf ? (
                                <div className="space-y-1.5">
                                  <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-100 h-52">
                                    {/* PDF render: <iframe src={record.fileData} /> or clickable download link */}
                                    <iframe
                                      src={rec.fileData}
                                      className="w-full h-full border-0"
                                      title={rec.title}
                                    />
                                  </div>
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-[11px] text-slate-500">PDF Document</span>
                                    <a
                                      href={rec.fileData}
                                      download={`${rec.title.replace(/\s+/g, '_')}.pdf`}
                                      className="text-teal-700 font-bold hover:underline inline-flex items-center gap-1 text-xs"
                                    >
                                      <Download className="w-3 h-3" />
                                      <span>Clickable download link</span>
                                    </a>
                                  </div>
                                </div>
                              ) : (
                                <a
                                  href={rec.fileData}
                                  download={rec.title}
                                  className="text-xs text-teal-700 font-bold hover:underline inline-flex items-center gap-1"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  <span>Download Attachment</span>
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-end gap-2.5">
              <button
                onClick={() => {
                  const pt = selectedPatient;
                  setNotePatient({ id: pt.id, name: pt.name });
                  setIsNoteModalOpen(true);
                }}
                className="px-4 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs border border-indigo-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Add Doctor Clinical Note"
              >
                <Edit3 className="w-4 h-4 text-indigo-600" />
                <span>Add Doctor Note</span>
              </button>

              <button
                onClick={() => {
                  const ptName = selectedPatient.name;
                  const ptId = selectedPatient.id;
                  setSelectedPatient(null);
                  onOpenEHR(ptName, ptId);
                }}
                className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Write Prescription"
              >
                <FileText className="w-4 h-4 text-teal-600" />
                <span>Write Prescription</span>
              </button>

              <button
                onClick={() => {
                  const matchedApt = displayedAppointments.find((a) => a.patientId === selectedPatient.id || a.patientName === selectedPatient.name);
                  setSelectedPatient(null);
                  if (matchedApt) {
                    onStartVideoCall(matchedApt);
                  } else {
                    const fallbackRoomId = `consult-${selectedPatient.id.replace(/[^a-zA-Z0-9]/g, '-')}`;
                    onStartVideoCall({
                      id: fallbackRoomId,
                      patientId: selectedPatient.id,
                      patientName: selectedPatient.name,
                      patientEmail: selectedPatient.email || 'No data provided',
                      patientPhone: selectedPatient.phoneNumber || 'No data provided',
                      doctorId: doctor?.uid || 'doctor_attending',
                      doctorName: doctor?.fullName || 'Attending Physician',
                      doctorSpecialty: doctor?.specialty || 'Telehealth Care',
                      date: 'Today',
                      time: 'Now',
                      type: 'Video Call',
                      status: 'scheduled',
                      symptoms: selectedPatient.condition || 'General Telehealth Observation',
                      meetingLink: `/call/${fallbackRoomId}`,
                    });
                  }
                }}
                className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Video className="w-4 h-4" />
                <span>Video Consult</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Actionable Feature: Add Doctor Note Modal */}
      {isNoteModalOpen && notePatient && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 overflow-y-auto"
          onClick={() => {
            if (!isSavingNote) {
              setIsNoteModalOpen(false);
              setNotePatient(null);
            }
          }}
        >
          <div
            className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200 my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 relative">
              <button
                onClick={() => {
                  if (!isSavingNote) {
                    setIsNoteModalOpen(false);
                    setNotePatient(null);
                  }
                }}
                className="absolute right-4 top-4 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                  Clinician Record
                </span>
              </div>
              <h3 className="text-xl font-black tracking-tight">Add Doctor Clinical Note</h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Document observation for <strong className="text-white">{notePatient.name}</strong>
              </p>
            </div>

            <form onSubmit={handleSaveDoctorNote} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Clinical Impression / Diagnosis
                </label>
                <input
                  type="text"
                  placeholder="e.g. Acute Upper Respiratory Infection, Mild Hypertension"
                  value={doctorNoteDiagnosis}
                  onChange={(e) => setDoctorNoteDiagnosis(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Doctor Observation & Clinical Notes *
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Enter clinical examination notes, observations, treatment plan, and follow-up guidance..."
                  value={doctorNoteText}
                  onChange={(e) => setDoctorNoteText(e.target.value)}
                  className="w-full text-xs p-3.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
                />
              </div>

              {noteSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Clinical note saved to patient records in Firestore!</span>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={isSavingNote}
                  onClick={() => {
                    setIsNoteModalOpen(false);
                    setNotePatient(null);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingNote || !doctorNoteText.trim()}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/30 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSavingNote ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving to Firestore...</span>
                    </>
                  ) : (
                    <>
                      <Edit3 className="w-4 h-4" />
                      <span>Save Doctor Note</span>
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
