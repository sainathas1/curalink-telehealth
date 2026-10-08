'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useTelemetry } from '../hooks/useTelemetry';
import { db } from '../lib/firebase';
import { collection, doc, setDoc, addDoc, query, where, onSnapshot, serverTimestamp } from 'firebase/firestore';
import {
  UserProfile,
  UserRole,
  LiveTelemetryPayload,
  VitalHistoryPoint,
  Appointment,
  Prescription,
  MedicalRecord,
  ClinicalRecord,
  PatientDirectoryItem,
} from '../lib/types';
import { SimulationMode } from '../lib/iot-service';

interface TelehealthContextType {
  // Auth & Profile
  currentUser: UserProfile | null;
  role: UserRole;
  setRole: (r: UserRole) => void;
  toggleRole: () => void;
  handleLogout: () => void;
  setAuthenticatedProfile: (profile: UserProfile) => void;
  isLoading: boolean;
  isAuthenticated: boolean;

  // IoT Telemetry
  telemetry: LiveTelemetryPayload;
  history: VitalHistoryPoint[];
  isSimulating: boolean;
  setIsSimulating: (sim: boolean) => void;
  simulationMode: SimulationMode;
  changeSimulationMode: (mode: SimulationMode) => void;
  audioAlertsEnabled: boolean;
  setAudioAlertsEnabled: (enabled: boolean) => void;
  temperatureUnit: 'C' | 'F';
  toggleTemperatureUnit: () => void;

  // Data Collections
  patientAppointments: Appointment[];
  doctorAppointmentsQueue: Appointment[];
  prescriptions: Prescription[];
  medicalRecords: MedicalRecord[];
  clinicalRecords: ClinicalRecord[];
  patientDirectory: PatientDirectoryItem[];
  addAppointment: (apt: Appointment) => void;
  addPrescription: (rx: Prescription) => void;
  addMedicalRecord: (rec: MedicalRecord) => void;
  addClinicalNote: (patientId: string, title: string, notes: string, patientName?: string) => Promise<void>;

  // Modals & UI Actions
  isVideoCallOpen: boolean;
  activeCallAppointment: Appointment | null;
  openVideoCall: (aptOrName: Appointment | string) => void;
  closeVideoCall: () => void;

  isEHRModalOpen: boolean;
  targetEhrPatientName: string;
  targetEhrPatientId: string;
  openEHR: (patientName?: string, patientId?: string) => void;
  closeEHR: () => void;

  isSimulatorDrawerOpen: boolean;
  openSimulator: () => void;
  closeSimulator: () => void;

  isESP32GuideOpen: boolean;
  openESP32Guide: () => void;
  closeESP32Guide: () => void;

  isEmergencySOSOpen: boolean;
  openEmergencySOS: () => void;
  closeEmergencySOS: () => void;

  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
}

const TelehealthContext = createContext<TelehealthContextType | null>(null);

export function TelehealthProvider({ children }: { children: ReactNode }) {
  const authState = useAuth();
  const telemetryState = useTelemetry(authState.currentUser?.uid || '');

  // Collections initialized to clean empty states
  const [patientAppointments, setPatientAppointments] = useState<Appointment[]>([]);
  const [doctorAppointmentsQueue, setDoctorAppointmentsQueue] = useState<Appointment[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [medicalRecords, setMedicalRecords] = useState<MedicalRecord[]>([]);
  const [clinicalRecords, setClinicalRecords] = useState<ClinicalRecord[]>([]);
  const [patientDirectory, setPatientDirectory] = useState<PatientDirectoryItem[]>([]);

  // Modals
  const [isVideoCallOpen, setIsVideoCallOpen] = useState(false);
  const [activeCallAppointment, setActiveCallAppointment] = useState<Appointment | null>(null);

  const [isEHRModalOpen, setIsEHRModalOpen] = useState(false);
  const [targetEhrPatientName, setTargetEhrPatientName] = useState('');
  const [targetEhrPatientId, setTargetEhrPatientId] = useState('');

  const [isSimulatorDrawerOpen, setIsSimulatorDrawerOpen] = useState(false);
  const [isESP32GuideOpen, setIsESP32GuideOpen] = useState(false);
  const [isEmergencySOSOpen, setIsEmergencySOSOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Real-time Firestore Appointments Listener (Always Active for Doctor & Patient Realtime Sync)
  useEffect(() => {
    let unsubApts: (() => void) | undefined;
    try {
      const aptsCol = collection(db, 'appointments');
      unsubApts = onSnapshot(
        aptsCol,
        (snapshot) => {
          const apts: Appointment[] = [];
          snapshot.forEach((d) => {
            const data = d.data();
            apts.push({ ...data, id: d.id } as Appointment);
          });

          // Sort by newest first
          apts.sort((a, b) => (b.id || '').localeCompare(a.id || ''));

          // Live UI Refresh: Instantly update doctor queue
          setDoctorAppointmentsQueue(apts);

          // Live UI Refresh: Update patient appointments
          const currentUid = authState.currentUser?.uid;
          const currentName = authState.currentUser?.fullName;
          if (currentUid) {
            const userApts = apts.filter(
              (a) =>
                a.patientId === currentUid ||
                a.patientId === 'patient_user' ||
                (currentName && a.patientName?.toLowerCase() === currentName.toLowerCase())
            );
            setPatientAppointments(userApts.length > 0 ? userApts : apts);
          } else {
            setPatientAppointments(apts);
          }
        },
        (err) => console.warn('Appointments real-time onSnapshot listener notice:', err.message)
      );
    } catch (err) {
      console.warn('Error attaching appointments listener:', err);
    }

    return () => {
      if (unsubApts) {
        try {
          unsubApts();
        } catch {}
      }
    };
  }, [authState.currentUser?.uid, authState.currentUser?.fullName]);

  // Real-time Firestore Listeners for Clinical Records, Prescriptions, Records, Directory
  useEffect(() => {
    if (!authState.currentUser) {
      setPrescriptions([]);
      setMedicalRecords([]);
      setClinicalRecords([]);
      setPatientDirectory([]);
      return;
    }

    const currentUid = authState.currentUser.uid;
    const isDoctor = authState.currentUser.role?.toLowerCase() === 'doctor';
    const unsubscribers: (() => void)[] = [];

    try {
      // 1. Clinical Records Listener (Strict real-time sync with onSnapshot)
      const clinicalQuery = isDoctor
        ? query(collection(db, 'clinical_records'), where('doctorId', '==', currentUid))
        : query(collection(db, 'clinical_records'), where('patientId', '==', currentUid));

      const unsubClinical = onSnapshot(
        clinicalQuery,
        (snapshot) => {
          const recs: ClinicalRecord[] = [];
          const rxs: Prescription[] = [];
          const medRecs: MedicalRecord[] = [];

          snapshot.forEach((d) => {
            const data = d.data();
            const recordItem: ClinicalRecord = {
              id: d.id,
              patientId: data.patientId,
              doctorId: data.doctorId,
              doctorName: data.doctorName,
              patientName: data.patientName,
              type: data.type,
              content: data.content,
              createdAt: data.createdAt,
            };
            recs.push(recordItem);

            const c = data.content || {};
            if (data.type === 'Prescription') {
              rxs.push({
                id: d.id,
                patientId: data.patientId,
                patientName: data.patientName || 'Patient',
                doctorId: data.doctorId,
                doctorName: data.doctorName || 'Attending Physician',
                doctorLicense: c.doctorLicense || 'MED-LICENSED',
                medicationName: c.medicationName || 'Prescription',
                dosage: c.dosage || 'Standard Dosage',
                frequency: c.frequency || 'Daily',
                duration: c.duration || '30 Days',
                instructions: c.instructions || 'Follow physician directions.',
                dateIssued: c.dateIssued || 'Recently',
                validUntil: c.validUntil || 'Active',
                refillsLeft: c.refillsLeft ?? 1,
                status: c.status || 'Active',
              });
            } else {
              medRecs.push({
                id: d.id,
                patientId: data.patientId,
                date: c.date || (data.createdAt?.toDate ? data.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently'),
                type: (data.type as any) || 'Clinical Summary',
                title: c.title || (data.type === 'Clinical Note' ? `Clinical Note - ${c.diagnosis || 'Observation'}` : 'Medical Record'),
                doctorName: data.doctorName || 'Attending Physician',
                facility: c.facility || 'CuraLink Telehealth Network',
                fileSize: c.fileSize || 'HIPAA Certified',
                summary: c.summary || c.notes || c.diagnosis || 'Clinical evaluation record.',
                downloadUrl: c.downloadUrl,
              });
            }
          });

          setClinicalRecords(recs);
          if (rxs.length > 0) setPrescriptions(rxs);
          if (medRecs.length > 0) setMedicalRecords(medRecs);
        },
        (err) => console.warn('clinical_records listener notice:', err.message)
      );
      unsubscribers.push(unsubClinical);

      // 2. Prescriptions Listener (Fallback for legacy entries)
      const rxQuery = isDoctor
        ? query(collection(db, 'prescriptions'), where('doctorId', '==', currentUid))
        : query(collection(db, 'prescriptions'), where('patientId', '==', currentUid));

      const unsubRx = onSnapshot(rxQuery, (snapshot) => {
        const rxs: Prescription[] = [];
        snapshot.forEach((d) => rxs.push({ ...d.data(), id: d.id } as Prescription));
        if (rxs.length > 0) {
          setPrescriptions((prev) => {
            const map = new Map<string, Prescription>();
            prev.forEach((p) => map.set(p.id, p));
            rxs.forEach((p) => map.set(p.id, p));
            return Array.from(map.values());
          });
        }
      }, (err) => console.warn('Prescriptions listener notice:', err.message));
      unsubscribers.push(unsubRx);

      // 3. Medical Records Listener (Fallback for legacy entries)
      if (!isDoctor) {
        const recQuery = query(collection(db, 'medicalRecords'), where('patientId', '==', currentUid));
        const unsubRec = onSnapshot(recQuery, (snapshot) => {
          const recs: MedicalRecord[] = [];
          snapshot.forEach((d) => recs.push({ ...d.data(), id: d.id } as MedicalRecord));
          if (recs.length > 0) {
            setMedicalRecords((prev) => {
              const map = new Map<string, MedicalRecord>();
              prev.forEach((r) => map.set(r.id, r));
              recs.forEach((r) => map.set(r.id, r));
              return Array.from(map.values());
            });
          }
        }, (err) => console.warn('Medical records listener notice:', err.message));
        unsubscribers.push(unsubRec);
      }

      // 4. Patient Directory (Doctors)
      if (isDoctor) {
        const patientsQuery = query(collection(db, 'users'), where('role', 'in', ['patient', 'Patient']));
        const unsubPatients = onSnapshot(patientsQuery, (snapshot) => {
          const dir: PatientDirectoryItem[] = [];
          snapshot.forEach((d) => {
            const data = d.data();
            dir.push({
              id: d.id,
              name: data.fullName || 'Patient',
              age: data.age || 35,
              gender: data.gender || 'Other',
              condition: data.condition || 'General Observation',
              status: 'Stable',
              roomOrBed: data.roomOrBed || 'Remote Home-Care',
              assignedDoctor: authState.currentUser?.fullName || 'Assigned Clinician',
              lastVisit: data.lastVisit || 'Initial Intake',
              nextAppointment: data.nextAppointment,
              currentVitals: {
                heartRate: 0,
                spo2: 0,
                temperature: 0,
                bloodPressure: '--/--',
              },
              bloodGroup: data.bloodGroup || data.bloodType || 'Not specified',
              bloodType: data.bloodType || data.bloodGroup || 'Not specified',
              allergies: data.allergies || (data.knownAllergies ? [data.knownAllergies] : []),
              knownAllergies: data.knownAllergies || (data.allergies ? data.allergies.join(', ') : 'None Reported'),
              chronicConditions: data.chronicConditions || [],
              currentMedications: data.currentMedications || 'None Reported',
              hasCompletedOnboarding: data.hasCompletedOnboarding === true,
              lastSyncedTemperature: data.lastSyncedTemperature !== undefined ? data.lastSyncedTemperature : undefined,
              lastSyncedAt: data.lastSyncedAt || undefined,
              temperatureStatus: data.temperatureStatus || undefined,
              deviceModel: data.deviceModel || undefined,
            });
          });
          setPatientDirectory(dir);
        }, (err) => console.warn('Patient directory listener notice:', err.message));
        unsubscribers.push(unsubPatients);
      }
    } catch (err) {
      console.warn('Firestore subscription setup error:', err);
    }

    return () => {
      unsubscribers.forEach((fn) => {
        try {
          fn();
        } catch {}
      });
    };
  }, [authState.currentUser]);

  const addAppointment = async (apt: Appointment) => {
    setPatientAppointments((prev) => [apt, ...prev]);
    setDoctorAppointmentsQueue((prev) => [apt, ...prev]);
    try {
      await setDoc(doc(db, 'appointments', apt.id), apt);
    } catch (err) {
      console.warn('Notice: Firestore save appointment offline fallback:', err);
    }
  };

  const addPrescription = async (rx: Prescription) => {
    setPrescriptions((prev) => [rx, ...prev]);
    try {
      // Strict write to clinical_records collection
      await addDoc(collection(db, 'clinical_records'), {
        patientId: rx.patientId,
        doctorId: rx.doctorId || authState.currentUser?.uid || 'attending_physician',
        doctorName: rx.doctorName || authState.currentUser?.fullName || 'Attending Physician',
        patientName: rx.patientName,
        type: 'Prescription',
        content: {
          medicationName: rx.medicationName,
          dosage: rx.dosage,
          frequency: rx.frequency,
          duration: rx.duration,
          instructions: rx.instructions,
          dateIssued: rx.dateIssued,
          validUntil: rx.validUntil,
          refillsLeft: rx.refillsLeft,
          status: rx.status || 'Active',
          doctorLicense: rx.doctorLicense || 'MED-LICENSED',
        },
        createdAt: serverTimestamp(),
      });
      await setDoc(doc(db, 'prescriptions', rx.id), rx);
    } catch (err) {
      console.warn('Notice: Firestore save prescription offline fallback:', err);
    }
  };

  const addMedicalRecord = async (rec: MedicalRecord) => {
    setMedicalRecords((prev) => [rec, ...prev]);
    try {
      // Strict write to clinical_records collection
      await addDoc(collection(db, 'clinical_records'), {
        patientId: rec.patientId,
        doctorId: authState.currentUser?.role?.toLowerCase() === 'doctor' ? authState.currentUser.uid : 'clinician',
        doctorName: rec.doctorName || authState.currentUser?.fullName || 'Attending Physician',
        patientName: authState.currentUser?.fullName || 'Patient',
        type: rec.type || 'Medical Record',
        content: {
          title: rec.title,
          facility: rec.facility,
          summary: rec.summary,
          fileSize: rec.fileSize,
          date: rec.date,
          downloadUrl: rec.downloadUrl || '',
        },
        createdAt: serverTimestamp(),
      });
      await setDoc(doc(db, 'medicalRecords', rec.id), rec);
    } catch (err) {
      console.warn('Notice: Firestore save medical record offline fallback:', err);
    }
  };

  const addClinicalNote = async (patientId: string, title: string, notes: string, patientName?: string) => {
    try {
      await addDoc(collection(db, 'clinical_records'), {
        patientId,
        doctorId: authState.currentUser?.uid || 'attending_physician',
        doctorName: authState.currentUser?.fullName || 'Attending Physician',
        patientName: patientName || 'Patient',
        type: 'Clinical Note',
        content: {
          title,
          notes,
          date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          status: 'Finalized',
        },
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn('Notice: Firestore save clinical note error:', err);
    }
  };

  const openVideoCall = (aptOrName: Appointment | string) => {
    if (typeof aptOrName === 'string') {
      const apt: Appointment = {
        id: `apt_quick_${Date.now()}`,
        patientId: authState.currentUser?.uid || 'patient_direct',
        patientName: aptOrName || authState.currentUser?.fullName || 'Patient',
        doctorId: authState.currentUser?.role?.toLowerCase() === 'doctor' ? authState.currentUser.uid : 'doctor_on_call',
        doctorName: authState.currentUser?.role?.toLowerCase() === 'doctor' ? authState.currentUser.fullName : 'Attending Clinician',
        doctorSpecialty: 'Telehealth Care',
        date: 'Today',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: 'Video Call',
        status: 'In Progress',
        symptoms: 'Virtual clinical consultation.',
      };
      setActiveCallAppointment(apt);
    } else {
      setActiveCallAppointment(aptOrName);
    }
    setIsVideoCallOpen(true);
  };

  const closeVideoCall = () => {
    setIsVideoCallOpen(false);
    setActiveCallAppointment(null);
  };

  const openEHR = (patientName: string = '', patientId: string = '') => {
    setTargetEhrPatientName(patientName);
    setTargetEhrPatientId(patientId);
    setIsEHRModalOpen(true);
  };

  const closeEHR = () => {
    setIsEHRModalOpen(false);
  };

  return (
    <TelehealthContext.Provider
      value={{
        ...authState,
        ...telemetryState,
        patientAppointments,
        doctorAppointmentsQueue,
        prescriptions,
        medicalRecords,
        clinicalRecords,
        patientDirectory,
        addAppointment,
        addPrescription,
        addMedicalRecord,
        addClinicalNote,
        isVideoCallOpen,
        activeCallAppointment,
        openVideoCall,
        closeVideoCall,
        isEHRModalOpen,
        targetEhrPatientName,
        targetEhrPatientId,
        openEHR,
        closeEHR,
        isSimulatorDrawerOpen,
        openSimulator: () => setIsSimulatorDrawerOpen(true),
        closeSimulator: () => setIsSimulatorDrawerOpen(false),
        isESP32GuideOpen,
        openESP32Guide: () => setIsESP32GuideOpen(true),
        closeESP32Guide: () => setIsESP32GuideOpen(false),
        isEmergencySOSOpen,
        openEmergencySOS: () => setIsEmergencySOSOpen(true),
        closeEmergencySOS: () => setIsEmergencySOSOpen(false),
        isAuthModalOpen,
        openAuthModal: () => setIsAuthModalOpen(true),
        closeAuthModal: () => setIsAuthModalOpen(false),
      }}
    >
      {children}
    </TelehealthContext.Provider>
  );
}

export function useTelehealth() {
  const context = useContext(TelehealthContext);
  if (!context) {
    throw new Error('useTelehealth must be used within a TelehealthProvider');
  }
  return context;
}
