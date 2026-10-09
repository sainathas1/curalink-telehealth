'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { collection, doc, onSnapshot, query, where, serverTimestamp, runTransaction, writeBatch, type Transaction } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { useTelemetry } from '../hooks/useTelemetry';
import type { UserProfile, UserRole, LiveTelemetryPayload, VitalHistoryPoint, Appointment, Prescription, MedicalRecord, ClinicalRecord, PatientDirectoryItem, VitalRecord, ConsultationMessage } from '../lib/types';
import type { SimulationMode } from '../lib/iot-service';
import { mergeClinicalRecords, recordSources, sortAppointments, timeValue, toMedicalRecord, toPatient, toPrescription, type StoredRecord } from '../lib/telehealth-data';
interface TelehealthContextType {
  authError: string | null;
  retryAuth: () => void;
  dataLoading: boolean;
  dataError: string | null;
  retryData: () => void;
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
interface DataState {
  scope: string; loading: boolean; error: string | null;
  patientAppointments: Appointment[]; doctorAppointmentsQueue: Appointment[];
  prescriptions: Prescription[]; medicalRecords: MedicalRecord[]; clinicalRecords: ClinicalRecord[];
  patientDirectory: PatientDirectoryItem[]; vitalLogs: VitalRecord[]; consultationMessages: ConsultationMessage[];
}
const emptyData = (scope = ''): DataState => ({ scope, loading: false, error: null, patientAppointments: [], doctorAppointmentsQueue: [], prescriptions: [], medicalRecords: [], clinicalRecords: [], patientDirectory: [], vitalLogs: [], consultationMessages: [] });
const chunks = (values: string[]) => Array.from({ length: Math.ceil(values.length / 30) }, (_, index) => values.slice(index * 30, index * 30 + 30));
const defined = (value: Record<string, any>) => Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
const safeId = (id: string) => /^[a-zA-Z0-9_-]{1,128}$/.test(id);
const TelehealthContext = createContext<TelehealthContextType | null>(null);

export function TelehealthProvider({ children }: { children: ReactNode }) {
  const authState = useAuth();
  const account = authState.currentUser;
  const identity = `${account?.uid || ''}:${account?.role?.toLowerCase() || ''}:${account?.isVerified === true}`;
  // Remount the entire workspace synchronously when identity or access changes.
  // This also resets the existing telemetry hook without changing hardware logic.
  return <ScopedTelehealthProvider key={identity} authState={authState}>{children}</ScopedTelehealthProvider>;
}
function ScopedTelehealthProvider({ children, authState }: { children: ReactNode; authState: ReturnType<typeof useAuth> }) {
  const currentUser = authState.currentUser;
  const uid = currentUser?.uid || '';
  const profileRole = currentUser?.role?.toLowerCase() || '';
  const verified = currentUser?.isVerified === true;
  const name = currentUser?.fullName || '';
  const isDoctor = profileRole === 'doctor';
  const permitted = Boolean(uid && (profileRole === 'patient' || (isDoctor && verified)));
  const telemetryState = useTelemetry(permitted ? uid : '');
  const [revision, setRevision] = useState(0);
  const scopeKey = `${uid}:${profileRole}:${verified}:${revision}`;
  const [data, setData] = useState<DataState>(() => emptyData());
  const [actionError, setActionError] = useState<{ scope: string; message: string } | null>(null);
  const view = permitted && data.scope === scopeKey ? data : emptyData(scopeKey);

  const [isVideoCallOpen, setIsVideoCallOpen] = useState(false);
  const [activeCallAppointment, setActiveCallAppointment] = useState<Appointment | null>(null);
  const [isEHRModalOpen, setIsEHRModalOpen] = useState(false);
  const [targetEhrPatientName, setTargetEhrPatientName] = useState('');
  const [targetEhrPatientId, setTargetEhrPatientId] = useState('');
  const [isSimulatorDrawerOpen, setIsSimulatorDrawerOpen] = useState(false);
  const [isESP32GuideOpen, setIsESP32GuideOpen] = useState(false);
  const [isEmergencySOSOpen, setIsEmergencySOSOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  useEffect(() => {
    if (!permitted) return;
    let active = true;
    const local = emptyData(scopeKey);
    const pending = new Set<string>();
    const errors = new Map<string, string>();
    const stops = new Map<string, () => void>();
    const recordMaps = new Map<string, StoredRecord[]>();
    const vitalMaps = new Map<string, VitalRecord[]>();
    const messageMaps = new Map<string, ConsultationMessage[]>();
    const patients = new Map<string, Record<string, any>>();
    const telemetry = new Map<string, Record<string, any>>();
    let relatedIds = new Set<string>();
    let recordsKey = '', messagesKey = '';

    const publish = () => {
      if (!active) return;
      local.clinicalRecords = mergeClinicalRecords(Array.from(recordMaps.values()).flat());
      local.prescriptions = local.clinicalRecords.filter(record => record.type === 'Prescription').map(toPrescription);
      local.medicalRecords = local.clinicalRecords.filter(record => record.type !== 'Prescription').map(toMedicalRecord);
      local.patientDirectory = Array.from(patients.entries()).filter(([id]) => relatedIds.has(id)).map(([id, profile]) => toPatient(id, profile, name, telemetry.get(id))).sort((a, b) => a.name.localeCompare(b.name));
      local.vitalLogs = Array.from(vitalMaps.values()).flat().sort((a, b) => timeValue(b.createdAt) - timeValue(a.createdAt));
      local.consultationMessages = Array.from(messageMaps.values()).flat().sort((a, b) => timeValue(a.createdAt) - timeValue(b.createdAt));
      setData({ ...local, loading: pending.size > 0, error: errors.size ? 'Some care information could not be loaded. Check your connection and try again.' : null });
    };
    const stopPrefix = (prefix: string) => {
      for (const [key, stop] of stops) if (key.startsWith(prefix)) { stop(); stops.delete(key); pending.delete(key); errors.delete(key); }
    };
    const listen = (key: string, target: any, receive: (snapshot: any) => void, clear: () => void) => {
      let listening = true;
      pending.add(key);
      try {
        const unsubscribe = onSnapshot(target, snapshot => {
          if (!active || !listening) return;
          errors.delete(key); pending.delete(key); receive(snapshot); publish();
        }, () => {
          if (!active || !listening) return;
          errors.set(key, 'Unavailable'); pending.delete(key); clear(); publish();
        });
        stops.set(key, () => { listening = false; unsubscribe(); });
      } catch {
        listening = false; pending.delete(key); errors.set(key, 'Unavailable'); clear();
        queueMicrotask(publish);
      }
    };
    const scopedQuery = (source: string, field: string, ids: string[]) => query(collection(db, source), where(field, ids.length === 1 ? '==' : 'in', ids.length === 1 ? ids[0] : ids));
    const replaceRecordScope = (ids: string[]) => {
      const key = [...ids].sort().join(',');
      if (key === recordsKey) return;
      recordsKey = key; stopPrefix('records/'); stopPrefix('vitals/'); recordMaps.clear(); vitalMaps.clear();
      for (const [index, batch] of chunks(ids).entries()) {
        for (const source of recordSources) {
          const sourceKey = `records/${source}/${index}`;
          listen(sourceKey, scopedQuery(source, 'patientId', batch), snapshot => recordMaps.set(sourceKey, snapshot.docs.map((item: any) => ({ id: item.id, source, data: item.data() }))), () => recordMaps.delete(sourceKey));
        }
        const vitalKey = `vitals/${index}`;
        listen(vitalKey, scopedQuery('vitals', 'patientId', batch), snapshot => vitalMaps.set(vitalKey, snapshot.docs.map((item: any) => ({ ...item.data(), id: item.id }))), () => vitalMaps.delete(vitalKey));
      }
    };
    const replaceMessageScope = (appointments: Appointment[]) => {
      const ids = appointments.map(appointment => appointment.id).sort();
      const key = ids.join(','); if (key === messagesKey) return;
      messagesKey = key; stopPrefix('messages/'); messageMaps.clear();
      for (const [index, batch] of chunks(ids).entries()) {
        const messageKey = `messages/${index}`;
        listen(messageKey, scopedQuery('consultation_messages', 'appointmentId', batch), snapshot => messageMaps.set(messageKey, snapshot.docs.map((item: any) => ({ ...item.data(), id: item.id }))), () => messageMaps.delete(messageKey));
      }
    };
    const refreshPatientRecordScope = () => replaceRecordScope(Array.from(patients.keys()).filter(id => relatedIds.has(id)));
    const refreshRelations = () => {
      const bookedIds = Array.from(new Set(
        local.doctorAppointmentsQueue
          .filter(appointment => appointment.status.toLowerCase() !== 'cancelled')
          .map(appointment => appointment.patientId)
          .filter(safeId)
      ));
      relatedIds = new Set(bookedIds);
      for (const id of Array.from(patients.keys())) if (!relatedIds.has(id)) { patients.delete(id); telemetry.delete(id); }
      for (const key of Array.from(stops.keys())) {
        if ((key.startsWith('patient/') || key.startsWith('telemetry/')) && !relatedIds.has(key.split('/')[1])) {
          stops.get(key)?.(); stops.delete(key); pending.delete(key); errors.delete(key);
        }
      }
      refreshPatientRecordScope();
      for (const id of relatedIds) {
        if (!stops.has(`patient/${id}`)) listen(`patient/${id}`, doc(db, 'users', id), snapshot => {
          const profile = snapshot.data();
          if (profile && String(profile.role).toLowerCase() === 'patient') patients.set(id, profile);
          else patients.delete(id);
          refreshPatientRecordScope();
        }, () => { patients.delete(id); refreshPatientRecordScope(); });
        if (!stops.has(`telemetry/${id}`)) listen(`telemetry/${id}`, doc(db, 'telemetry', id), snapshot => {
          const reading = snapshot.data(); if (reading) telemetry.set(id, reading); else telemetry.delete(id);
        }, () => telemetry.delete(id));
      }
    };
    listen('appointments', query(collection(db, 'appointments'), where(isDoctor ? 'doctorId' : 'patientId', '==', uid)), snapshot => {
      const appointments = sortAppointments(snapshot.docs.map((item: any) => ({ ...item.data(), id: item.id })));
      if (isDoctor) { local.doctorAppointmentsQueue = appointments; refreshRelations(); }
      else local.patientAppointments = appointments;
      replaceMessageScope(appointments);
    }, () => {
      local.patientAppointments = []; local.doctorAppointmentsQueue = [];
      if (isDoctor) refreshRelations(); replaceMessageScope([]);
    });
    if (isDoctor) {
      refreshRelations();
    } else {
      replaceRecordScope([uid]);
    }
    return () => { active = false; for (const stop of stops.values()) stop(); };
  }, [uid, profileRole, verified, isDoctor, permitted, scopeKey, name]);

  const requireAccount = () => {
    if (!currentUser || auth.currentUser?.uid !== currentUser.uid) throw new Error('Sign in again before making changes.');
    return currentUser;
  };
  const requirePatient = () => {
    const account = requireAccount(); if (account.role.toLowerCase() !== 'patient') throw new Error('A patient account is required.'); return account;
  };
  const validateDoctorRelation = async (transaction: Transaction, patientId: string) => {
    const account = requireAccount();
    if (account.role.toLowerCase() !== 'doctor' || account.isVerified !== true || !safeId(patientId)) throw new Error('A verified clinician account is required.');
    const physician = await transaction.get(doc(db, 'users', account.uid));
    if (!physician.exists() || String(physician.data().role).toLowerCase() !== 'doctor' || physician.data().isVerified !== true) throw new Error('Your clinician access is no longer verified.');
    const patient = await transaction.get(doc(db, 'users', patientId));
    if (!patient.exists() || String(patient.data().role).toLowerCase() !== 'patient') throw new Error('Choose a registered patient.');
    const pData = patient.data();
    if (pData?.assignedDoctorId === account.uid) {
      return account;
    }
    const bookedApt = view.doctorAppointmentsQueue.find(apt => apt.patientId === patientId);
    if (!bookedApt) {
      throw new Error('This patient is not assigned to you or booked for an appointment.');
    }
    const appointmentDoc = await transaction.get(doc(db, 'appointments', bookedApt.id));
    if (!appointmentDoc.exists() || appointmentDoc.data()?.doctorId !== account.uid || appointmentDoc.data()?.patientId !== patientId || appointmentDoc.data()?.status?.toLowerCase() === 'cancelled') {
      throw new Error('Your appointment details could not be confirmed.');
    }
    return account;
  };
  const addAppointment = async (appointment: Appointment) => {
    const account = requirePatient();
    if (appointment.patientId !== account.uid || !safeId(appointment.id) || !safeId(appointment.doctorId)) throw new Error('Your appointment details could not be confirmed.');
    await runTransaction(db, async transaction => {
      requirePatient();
      const clinician = await transaction.get(doc(db, 'users', appointment.doctorId));
      const reference = doc(db, 'appointments', appointment.id);
      const existing = await transaction.get(reference);
      if (!clinician.exists() || String(clinician.data().role).toLowerCase() !== 'doctor' || clinician.data().isVerified !== true) throw new Error('This clinician is no longer available for booking. Please choose another clinician.');
      if (existing.exists()) {
        if (existing.data().patientId !== account.uid || existing.data().doctorId !== appointment.doctorId) throw new Error('This appointment identifier is already in use.');
        return;
      }
      requirePatient();
      transaction.set(reference, defined({ ...appointment, patientId: account.uid, patientName: account.fullName, patientEmail: account.email,
        doctorName: clinician.data().fullName || clinician.data().name || 'Clinician', doctorSpecialty: clinician.data().specialty || '',
        status: 'scheduled', paymentStatus: 'Pending', meetingLink: `/call/${appointment.id}`, createdAt: serverTimestamp() }));
    });
  };
  const updateAppointmentStatus = async (id: string, status: string) => {
    const account = requireAccount(); const normalized = status.toLowerCase();
    if (!safeId(id) || !['in progress', 'completed', 'cancelled'].includes(normalized)) throw new Error('Choose a valid appointment action.');
    await runTransaction(db, async transaction => {
      const reference = doc(db, 'appointments', id); const snapshot = await transaction.get(reference);
      if (!snapshot.exists()) throw new Error('This appointment is no longer available.');
      const appointment = snapshot.data();
      if (account.role.toLowerCase() === 'patient') {
        if (appointment.patientId !== account.uid || normalized !== 'cancelled') throw new Error('You can only cancel your own appointments.');
      } else {
        if (appointment.doctorId !== account.uid) throw new Error('This appointment is not assigned to you.');
        await validateDoctorRelation(transaction, appointment.patientId);
      }
      if (['completed', 'cancelled'].includes(String(appointment.status).toLowerCase())) {
        if (String(appointment.status).toLowerCase() === normalized) return;
        throw new Error('This appointment has already ended.');
      }
      requireAccount();
      transaction.update(reference, { status, updatedAt: serverTimestamp() });
    });
  };
  const addPrescription = async (prescription: Prescription) => {
    if (!safeId(prescription.id) || !prescription.medicationName.trim() || !prescription.dosage.trim()) throw new Error('Choose a patient and complete the prescription.');
    await runTransaction(db, async transaction => {
      const account = await validateDoctorRelation(transaction, prescription.patientId);
      const reference = doc(db, 'medical_records', prescription.id); const existing = await transaction.get(reference);
      if (existing.exists()) {
        const stored = existing.data();
        const sameContent = ['medicationName', 'dosage', 'frequency', 'duration', 'instructions'].every(field => stored.content?.[field] === prescription[field as keyof Prescription]);
        if (stored.patientId === prescription.patientId && stored.doctorId === account.uid && stored.type === 'Prescription' && sameContent) return;
        throw new Error('This prescription identifier is already in use.');
      }
      requireAccount();
      transaction.set(reference, { patientId: prescription.patientId, patientName: prescription.patientName, doctorId: account.uid,
        doctorName: account.fullName, type: 'Prescription', content: defined({ medicationName: prescription.medicationName, dosage: prescription.dosage,
          frequency: prescription.frequency, duration: prescription.duration, instructions: prescription.instructions,
          dateIssued: prescription.dateIssued, validUntil: prescription.validUntil, refillsLeft: prescription.refillsLeft,
          status: prescription.status || 'Active', doctorLicense: account.licenseNumber || '' }), createdAt: serverTimestamp() });
      const rxRef = doc(db, 'prescriptions', prescription.id);
      transaction.set(rxRef, defined({ patientId: prescription.patientId, patientName: prescription.patientName, doctorId: account.uid,
        doctorName: account.fullName, medicationName: prescription.medicationName, dosage: prescription.dosage,
        frequency: prescription.frequency, duration: prescription.duration, instructions: prescription.instructions,
        dateIssued: prescription.dateIssued, validUntil: prescription.validUntil, refillsLeft: prescription.refillsLeft,
        status: prescription.status || 'Active', doctorLicense: account.licenseNumber || '', createdAt: serverTimestamp() }));
    });
  };
  const addMedicalRecord = async (record: MedicalRecord) => {
    const account = requireAccount();
    if (account.role.toLowerCase() === 'patient' && record.patientId !== account.uid) throw new Error('You can only add your own health records.');
    // The protected uploader already writes both collections before this callback.
    if (record.fileData?.startsWith('data:') || record.downloadUrl?.startsWith('data:')) return;
    if (!safeId(record.id)) throw new Error('The record identifier is invalid.');
    await runTransaction(db, async transaction => {
      if (account.role.toLowerCase() === 'doctor') await validateDoctorRelation(transaction, record.patientId);
      const reference = doc(db, 'medical_records', record.id);
      const existing = await transaction.get(reference);
      if (existing.exists()) {
        if (existing.data().patientId === record.patientId && (existing.data().title || existing.data().content?.title) === record.title) return;
        throw new Error('This record identifier is already in use.');
      }
      requireAccount();
      transaction.set(reference, defined({ patientId: record.patientId, doctorId: isDoctor ? account.uid : null,
        doctorName: isDoctor ? account.fullName : record.doctorName, type: record.type, title: record.title,
        content: defined({ title: record.title, facility: record.facility, summary: record.summary, fileSize: record.fileSize, date: record.date, downloadUrl: record.downloadUrl }), createdAt: serverTimestamp() }));
    });
  };
  const updateMedicalRecordStatus = async (id: string, status: string) => {
    const record = view.clinicalRecords.find(item => item.id === id);
    if (!record) throw new Error('This clinical record is no longer available.');
    const [source, storageId] = id.split('/');
    if (!recordSources.includes(source as typeof recordSources[number]) || !safeId(storageId)) throw new Error('Invalid record identifier.');
    await runTransaction(db, async transaction => {
      await validateDoctorRelation(transaction, record.patientId);
      const reference = doc(db, source, storageId); const existing = await transaction.get(reference);
      if (!existing.exists() || existing.data().patientId !== record.patientId) throw new Error('The record could not be confirmed.');
      requireAccount();
      transaction.update(reference, { status, 'content.status': status, updatedAt: serverTimestamp() });
    });
  };
  const addClinicalNote = async (patientId: string, title: string, notes: string, patientName = '') => {
    if (!title.trim() || !notes.trim()) throw new Error('Enter a title and clinical note.');
    const reference = doc(collection(db, 'medical_records'));
    await runTransaction(db, async transaction => {
      const account = await validateDoctorRelation(transaction, patientId);
      requireAccount();
      transaction.set(reference, { patientId, patientName, doctorId: account.uid, doctorName: account.fullName, type: 'Clinical Note',
        content: { title: title.trim(), notes: notes.trim(), status: 'Finalized', date: new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date()) }, createdAt: serverTimestamp() });
    });
  };
  const logVitalSign = async (vitals: { heartRate: number; spo2: number; temperature: number; systolic?: number; diastolic?: number; notes?: string }) => {
    const account = requirePatient();
    if (![vitals.heartRate, vitals.spo2, vitals.temperature].every(value => Number.isFinite(value) && value > 0)) throw new Error('Enter valid measurements before saving.');
    const readings = defined(vitals); const batch = writeBatch(db);
    batch.set(doc(collection(db, 'vitals')), { ...readings, patientId: account.uid, patientName: account.fullName, createdAt: serverTimestamp() });
    batch.set(doc(db, 'telemetry', account.uid), { ...readings, patientId: account.uid, deviceId: 'MANUAL-VITALS-FEED', timestamp: Date.now(), sensorConnected: false }, { merge: true });
    await batch.commit();
  };
  const sendConsultationMessage = async (appointmentId: string, text: string) => {
    const account = requireAccount(); if (!safeId(appointmentId) || !text.trim()) throw new Error('Enter a message for a booked consultation.');
    await runTransaction(db, async transaction => {
      const appointment = await transaction.get(doc(db, 'appointments', appointmentId));
      if (!appointment.exists() || (isDoctor ? appointment.data().doctorId !== account.uid : appointment.data().patientId !== account.uid)) throw new Error('You are not a participant in this appointment.');
      if (isDoctor) await validateDoctorRelation(transaction, appointment.data().patientId);
      requireAccount();
      transaction.set(doc(collection(db, 'consultation_messages')), { appointmentId, senderId: account.uid, senderName: account.fullName, senderRole: account.role, text: text.trim(), createdAt: serverTimestamp() });
    });
  };
  const openVideoCall = (input: Appointment | string) => {
    const appointments = isDoctor ? view.doctorAppointmentsQueue : view.patientAppointments;
    const appointment = typeof input === 'string' ? appointments.find(item => item.patientId === input || item.patientName === input) : appointments.find(item => item.id === input.id);
    if (!appointment || appointment.type !== 'Video Call' || !['scheduled', 'upcoming', 'in progress'].includes(appointment.status.toLowerCase())) { setActionError({ scope: scopeKey, message: 'Choose an active booked video consultation.' }); return; }
    setActionError(null); setActiveCallAppointment(appointment); setIsVideoCallOpen(true);
  };
  const closeVideoCall = () => { setIsVideoCallOpen(false); setActiveCallAppointment(null); };
  const openEHR = (patientName = '', patientId = '') => {
    if (!isDoctor || !verified) return;
    if (patientId && !view.patientDirectory.some(patient => patient.id === patientId)) { setActionError({ scope: scopeKey, message: 'Choose a patient in your care directory.' }); return; }
    setActionError(null); setTargetEhrPatientName(patientName); setTargetEhrPatientId(patientId); setIsEHRModalOpen(true);
  };
  return <TelehealthContext.Provider value={{
    ...authState, ...telemetryState, ...view,
    dataLoading: permitted && (data.scope !== scopeKey || data.loading), dataError: view.error || (actionError?.scope === scopeKey ? actionError.message : null),
    retryData: () => { setActionError(null); setRevision(value => value + 1); },
    addAppointment, updateAppointmentStatus, addPrescription, addMedicalRecord, updateMedicalRecordStatus, addClinicalNote, logVitalSign, sendConsultationMessage,
    isVideoCallOpen: permitted && isVideoCallOpen && view.doctorAppointmentsQueue.concat(view.patientAppointments).some(item => item.id === activeCallAppointment?.id), activeCallAppointment, openVideoCall, closeVideoCall,
    isEHRModalOpen: permitted && isEHRModalOpen, targetEhrPatientName, targetEhrPatientId, openEHR, closeEHR: () => setIsEHRModalOpen(false),
    isSimulatorDrawerOpen, openSimulator: () => setIsSimulatorDrawerOpen(true), closeSimulator: () => setIsSimulatorDrawerOpen(false),
    isESP32GuideOpen, openESP32Guide: () => setIsESP32GuideOpen(true), closeESP32Guide: () => setIsESP32GuideOpen(false),
    isEmergencySOSOpen, openEmergencySOS: () => setIsEmergencySOSOpen(true), closeEmergencySOS: () => setIsEmergencySOSOpen(false),
    isAuthModalOpen, openAuthModal: () => setIsAuthModalOpen(true), closeAuthModal: () => setIsAuthModalOpen(false),
  }}>{children}</TelehealthContext.Provider>;
}
export function useTelehealth() {
  const context = useContext(TelehealthContext);
  if (!context) throw new Error('useTelehealth must be used within a TelehealthProvider');
  return context;
}
