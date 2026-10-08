'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useTelemetry } from '../hooks/useTelemetry';
import { db } from '../lib/firebase';
import {
  collection,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
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
  VitalRecord,
  ConsultationMessage,
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

  // Data Collections (Real-time Firestore)
  patientAppointments: Appointment[];
  doctorAppointmentsQueue: Appointment[];
  prescriptions: Prescription[];
  medicalRecords: MedicalRecord[];
  clinicalRecords: ClinicalRecord[];
  patientDirectory: PatientDirectoryItem[];
  vitalLogs: VitalRecord[];
  consultationMessages: ConsultationMessage[];
  addAppointment: (apt: Appointment) => Promise<void>;
  updateAppointmentStatus: (id: string, status: string) => Promise<void>;
  addPrescription: (rx: Prescription) => Promise<void>;
  addMedicalRecord: (rec: MedicalRecord) => Promise<void>;
  updateMedicalRecordStatus: (id: string, status: string) => Promise<void>;
  addClinicalNote: (patientId: string, title: string, notes: string, patientName?: string) => Promise<void>;
  logVitalSign: (vitals: { heartRate: number; spo2: number; temperature: number; systolic?: number; diastolic?: number; notes?: string }) => Promise<void>;
  sendConsultationMessage: (appointmentId: string, text: string) => Promise<void>;

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
  const [vitalLogs, setVitalLogs] = useState<VitalRecord[]>([]);
  const [consultationMessages, setConsultationMessages] = useState<ConsultationMessage[]>([]);

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

  // Real-time Firestore Listeners for medical_records, vitals, prescriptions, and directory
  useEffect(() => {
    if (!authState.currentUser) {
      setPrescriptions([]);
      setMedicalRecords([]);
      setClinicalRecords([]);
      setPatientDirectory([]);
      setVitalLogs([]);
      setConsultationMessages([]);
      return;
    }

    const currentUid = authState.currentUser.uid;
    const isDoctor = authState.currentUser.role?.toLowerCase() === 'doctor';
    const unsubscribers: (() => void)[] = [];

    try {
      // 1. medical_records Listener (Strict real-time sync with onSnapshot)
      const medRecordsQuery = isDoctor
        ? query(collection(db, 'medical_records'), where('doctorId', '==', currentUid))
        : query(collection(db, 'medical_records'), where('patientId', '==', currentUid));

      const unsubMedRecords = onSnapshot(
        medRecordsQuery,
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
                dateIssued: c.dateIssued || (data.createdAt?.toDate ? data.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently'),
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
          setPrescriptions(rxs);
          setMedicalRecords(medRecs);
        },
        (err) => console.warn('medical_records listener notice:', err.message)
      );
      unsubscribers.push(unsubMedRecords);

      // 2. clinical_records Listener (Legacy fallback merged seamlessly)
      const clinicalQuery = isDoctor
        ? query(collection(db, 'clinical_records'), where('doctorId', '==', currentUid))
        : query(collection(db, 'clinical_records'), where('patientId', '==', currentUid));

      const unsubClinical = onSnapshot(
        clinicalQuery,
        (snapshot) => {
          snapshot.forEach((d) => {
            const data = d.data();
            const c = data.content || {};
            if (data.type === 'Prescription') {
              const rxItem: Prescription = {
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
              };
              setPrescriptions((prev) => {
                if (prev.some((p) => p.id === d.id)) return prev;
                return [rxItem, ...prev];
              });
            } else {
              const medItem: MedicalRecord = {
                id: d.id,
                patientId: data.patientId,
                date: c.date || (data.createdAt?.toDate ? data.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently'),
                type: (data.recordType as any) || (data['Record Type'] as any) || (data.type as any) || 'Clinical Summary',
                title: data.documentTitle || data['Document Title'] || c.title || (data.type === 'Clinical Note' ? `Clinical Note - ${c.diagnosis || 'Observation'}` : 'Medical Record'),
                doctorName: data.doctorName || 'Attending Physician',
                facility: data.facility || data['Facility'] || c.facility || 'CuraLink Telehealth Network',
                fileSize: c.fileSize || 'HIPAA Certified',
                summary: data.clinicalSummary || data['Clinical Summary'] || c.summary || c.notes || c.diagnosis || 'Clinical evaluation record.',
                downloadUrl: data.downloadUrl || c.downloadUrl,
              };
              setMedicalRecords((prev) => {
                if (prev.some((m) => m.id === d.id)) return prev;
                return [medItem, ...prev];
              });
            }
          });
        },
        (err) => console.warn('clinical_records listener notice:', err.message)
      );
      unsubscribers.push(unsubClinical);

      // 3. vitals Collection Listener
      const vitalsQuery = query(
        collection(db, 'vitals'),
        where('patientId', '==', currentUid)
      );
      const unsubVitals = onSnapshot(
        vitalsQuery,
        (snapshot) => {
          const logs: VitalRecord[] = [];
          snapshot.forEach((d) => {
            logs.push({ ...d.data(), id: d.id } as VitalRecord);
          });
          logs.sort((a, b) => (b.id || '').localeCompare(a.id || ''));
          setVitalLogs(logs);
        },
        (err) => console.warn('vitals listener notice:', err.message)
      );
      unsubscribers.push(unsubVitals);

      // 4. Consultation Messages Listener
      const messagesQuery = isDoctor
        ? query(collection(db, 'consultation_messages'))
        : query(collection(db, 'consultation_messages'), where('senderId', '==', currentUid));
      const unsubMessages = onSnapshot(
        messagesQuery,
        (snapshot) => {
          const msgs: ConsultationMessage[] = [];
          snapshot.forEach((d) => {
            msgs.push({ ...d.data(), id: d.id } as ConsultationMessage);
          });
          setConsultationMessages(msgs);
        },
        (err) => console.warn('consultation_messages listener notice:', err.message)
      );
      unsubscribers.push(unsubMessages);

      // 5. Patient Directory (for Doctors)
      if (isDoctor) {
        const patientsQuery = query(collection(db, 'users'), where('role', 'in', ['patient', 'Patient']));
        const unsubPatients = onSnapshot(patientsQuery, (snapshot) => {
          const dir: PatientDirectoryItem[] = [];
          snapshot.forEach((d) => {
            const data = d.data();
            dir.push({
              id: d.id,
              name: data.fullName || data.name || 'Patient',
              email: data.email || '',
              phone: data.phoneNumber || data.phone || '',
              phoneNumber: data.phoneNumber || data.phone || '',
              age: data.age || 35,
              gender: data.gender || 'Other',
              condition: data.condition || 'General Observation',
              status: 'Stable',
              roomOrBed: data.roomOrBed || 'Remote Home-Care',
              assignedDoctor: authState.currentUser?.fullName || 'Assigned Clinician',
              lastVisit: data.lastVisit || data.lastVisitDate || 'Initial Intake',
              lastVisitDate: data.lastVisitDate || data.lastVisit || '',
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

  // CRUD: Appointments (addDoc / setDoc)
  const addAppointment = async (apt: Appointment) => {
    setPatientAppointments((prev) => [apt, ...prev]);
    setDoctorAppointmentsQueue((prev) => [apt, ...prev]);
    try {
      await setDoc(doc(db, 'appointments', apt.id), apt);
    } catch (err) {
      console.warn('Notice: Firestore save appointment offline fallback:', err);
    }
  };

  // CRUD: Update Appointment Status (updateDoc)
  const updateAppointmentStatus = async (id: string, status: string) => {
    setPatientAppointments((prev) =>
      prev.map((apt) => (apt.id === id ? { ...apt, status } : apt))
    );
    setDoctorAppointmentsQueue((prev) =>
      prev.map((apt) => (apt.id === id ? { ...apt, status } : apt))
    );
    try {
      await updateDoc(doc(db, 'appointments', id), {
        status,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn('Notice: updateAppointmentStatus error:', err);
    }
  };

  // CRUD: Prescriptions (Strictly routed to medical_records collection)
  const addPrescription = async (rx: Prescription) => {
    setPrescriptions((prev) => [rx, ...prev]);
    try {
      await addDoc(collection(db, 'medical_records'), {
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
      console.warn('Notice: Firestore save prescription notice:', err);
    }
  };

  // CRUD: Medical Records & Diagnostics (Strictly routed to medical_records collection)
  const addMedicalRecord = async (rec: MedicalRecord) => {
    setMedicalRecords((prev) => [rec, ...prev]);
    try {
      await addDoc(collection(db, 'medical_records'), {
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
      console.warn('Notice: Firestore save medical record notice:', err);
    }
  };

  // CRUD: Update Medical Record Status (updateDoc)
  const updateMedicalRecordStatus = async (id: string, status: string) => {
    try {
      await updateDoc(doc(db, 'medical_records', id), {
        'content.status': status,
        status,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn('Notice: updateMedicalRecordStatus error:', err);
    }
  };

  // CRUD: Clinical Doctor Notes (Strictly routed to medical_records collection)
  const addClinicalNote = async (patientId: string, title: string, notes: string, patientName?: string) => {
    try {
      await addDoc(collection(db, 'medical_records'), {
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

  // CRUD: Vitals Logging (Strictly routed to vitals collection and telemetry doc)
  const logVitalSign = async (vitals: {
    heartRate: number;
    spo2: number;
    temperature: number;
    systolic?: number;
    diastolic?: number;
    notes?: string;
  }) => {
    const currentUid = authState.currentUser?.uid;
    if (!currentUid) throw new Error('Authentication required to record vitals');

    try {
      await addDoc(collection(db, 'vitals'), {
        patientId: currentUid,
        patientName: authState.currentUser?.fullName || 'Patient',
        heartRate: vitals.heartRate,
        spo2: vitals.spo2,
        temperature: vitals.temperature,
        systolic: vitals.systolic || 120,
        diastolic: vitals.diastolic || 80,
        notes: vitals.notes || '',
        createdAt: serverTimestamp(),
      });

      await setDoc(
        doc(db, 'telemetry', currentUid),
        {
          patientId: currentUid,
          deviceId: 'MANUAL-VITALS-FEED',
          heartRate: vitals.heartRate,
          spo2: vitals.spo2,
          temperature: vitals.temperature,
          systolic: vitals.systolic || 120,
          diastolic: vitals.diastolic || 80,
          timestamp: serverTimestamp(),
          sensorConnected: true,
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('Notice: logVitalSign error:', err);
      throw err;
    }
  };

  // CRUD: Consultation Messages (addDoc to consultation_messages)
  const sendConsultationMessage = async (appointmentId: string, text: string) => {
    const currentUid = authState.currentUser?.uid;
    if (!currentUid) throw new Error('Authentication required to send consultation message');

    try {
      await addDoc(collection(db, 'consultation_messages'), {
        appointmentId,
        senderId: currentUid,
        senderName: authState.currentUser?.fullName || 'User',
        senderRole: authState.currentUser?.role || 'Patient',
        text: text.trim(),
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn('Notice: sendConsultationMessage error:', err);
      throw err;
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
        vitalLogs,
        consultationMessages,
        addAppointment,
        updateAppointmentStatus,
        addPrescription,
        addMedicalRecord,
        updateMedicalRecordStatus,
        addClinicalNote,
        logVitalSign,
        sendConsultationMessage,
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
