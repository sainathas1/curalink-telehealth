'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useTelemetry } from '../hooks/useTelemetry';
import { db } from '../lib/firebase';
import { collection, doc, setDoc, query, where, onSnapshot } from 'firebase/firestore';
import {
  UserProfile,
  UserRole,
  LiveTelemetryPayload,
  VitalHistoryPoint,
  Appointment,
  Prescription,
  MedicalRecord,
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
  patientDirectory: PatientDirectoryItem[];
  addAppointment: (apt: Appointment) => void;
  addPrescription: (rx: Prescription) => void;
  addMedicalRecord: (rec: MedicalRecord) => void;

  // Modals & UI Actions
  isVideoCallOpen: boolean;
  activeCallAppointment: Appointment | null;
  openVideoCall: (aptOrName: Appointment | string) => void;
  closeVideoCall: () => void;

  isEHRModalOpen: boolean;
  targetEhrPatientName: string;
  openEHR: (patientName?: string) => void;
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
  const [patientDirectory, setPatientDirectory] = useState<PatientDirectoryItem[]>([]);

  // Modals
  const [isVideoCallOpen, setIsVideoCallOpen] = useState(false);
  const [activeCallAppointment, setActiveCallAppointment] = useState<Appointment | null>(null);

  const [isEHRModalOpen, setIsEHRModalOpen] = useState(false);
  const [targetEhrPatientName, setTargetEhrPatientName] = useState('');

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

  // Real-time Firestore Listeners for Prescriptions, Records, Directory
  useEffect(() => {
    if (!authState.currentUser) {
      setPrescriptions([]);
      setMedicalRecords([]);
      setPatientDirectory([]);
      return;
    }

    const currentUid = authState.currentUser.uid;
    const isDoctor = authState.currentUser.role?.toLowerCase() === 'doctor';
    const unsubscribers: (() => void)[] = [];

    try {
      // 2. Prescriptions Listener
      const rxQuery = isDoctor
        ? query(collection(db, 'prescriptions'), where('doctorId', '==', currentUid))
        : query(collection(db, 'prescriptions'), where('patientId', '==', currentUid));

      const unsubRx = onSnapshot(rxQuery, (snapshot) => {
        const rxs: Prescription[] = [];
        snapshot.forEach((d) => rxs.push({ ...d.data(), id: d.id } as Prescription));
        setPrescriptions(rxs);
      }, (err) => console.warn('Prescriptions listener notice:', err.message));
      unsubscribers.push(unsubRx);

      // 3. Medical Records Listener (Patients)
      if (!isDoctor) {
        const recQuery = query(collection(db, 'medicalRecords'), where('patientId', '==', currentUid));
        const unsubRec = onSnapshot(recQuery, (snapshot) => {
          const recs: MedicalRecord[] = [];
          snapshot.forEach((d) => recs.push({ ...d.data(), id: d.id } as MedicalRecord));
          setMedicalRecords(recs);
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
      await setDoc(doc(db, 'prescriptions', rx.id), rx);
    } catch (err) {
      console.warn('Notice: Firestore save prescription offline fallback:', err);
    }
  };

  const addMedicalRecord = async (rec: MedicalRecord) => {
    setMedicalRecords((prev) => [rec, ...prev]);
    try {
      await setDoc(doc(db, 'medicalRecords', rec.id), rec);
    } catch (err) {
      console.warn('Notice: Firestore save medical record offline fallback:', err);
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

  const openEHR = (patientName: string = '') => {
    setTargetEhrPatientName(patientName);
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
        patientDirectory,
        addAppointment,
        addPrescription,
        addMedicalRecord,
        isVideoCallOpen,
        activeCallAppointment,
        openVideoCall,
        closeVideoCall,
        isEHRModalOpen,
        targetEhrPatientName,
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
