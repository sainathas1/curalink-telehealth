'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useTelemetry } from '../hooks/useTelemetry';
import {
  MOCK_APPOINTMENTS,
  MOCK_DOCTOR_APPOINTMENTS_QUEUE,
  MOCK_PRESCRIPTIONS,
  MOCK_MEDICAL_RECORDS,
  MOCK_PATIENT_DIRECTORY,
  MOCK_DOCTOR_USER,
} from '../lib/mock-data';
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
  switchToPatientDemo: () => void;
  switchToDoctorDemo: () => void;
  setAuthenticatedProfile: (profile: UserProfile) => void;

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
  const telemetryState = useTelemetry('patient_sarah_jenkins_01');

  // Collections
  const [patientAppointments, setPatientAppointments] = useState<Appointment[]>(MOCK_APPOINTMENTS);
  const [doctorAppointmentsQueue, setDoctorAppointmentsQueue] = useState<Appointment[]>(MOCK_DOCTOR_APPOINTMENTS_QUEUE);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>(MOCK_PRESCRIPTIONS);
  const [medicalRecords, setMedicalRecords] = useState<MedicalRecord[]>(MOCK_MEDICAL_RECORDS);
  const [patientDirectory, setPatientDirectory] = useState<PatientDirectoryItem[]>(MOCK_PATIENT_DIRECTORY);

  // Modals
  const [isVideoCallOpen, setIsVideoCallOpen] = useState(false);
  const [activeCallAppointment, setActiveCallAppointment] = useState<Appointment | null>(null);

  const [isEHRModalOpen, setIsEHRModalOpen] = useState(false);
  const [targetEhrPatientName, setTargetEhrPatientName] = useState('Sarah Jenkins');

  const [isSimulatorDrawerOpen, setIsSimulatorDrawerOpen] = useState(false);
  const [isESP32GuideOpen, setIsESP32GuideOpen] = useState(false);
  const [isEmergencySOSOpen, setIsEmergencySOSOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const addAppointment = (apt: Appointment) => {
    setPatientAppointments((prev) => [apt, ...prev]);
    setDoctorAppointmentsQueue((prev) => [apt, ...prev]);
  };

  const addPrescription = (rx: Prescription) => {
    setPrescriptions((prev) => [rx, ...prev]);
  };

  const addMedicalRecord = (rec: MedicalRecord) => {
    setMedicalRecords((prev) => [rec, ...prev]);
  };

  const openVideoCall = (aptOrName: Appointment | string) => {
    if (typeof aptOrName === 'string') {
      const apt: Appointment = {
        id: `apt_quick_${Date.now()}`,
        patientId: 'patient_sarah_jenkins_01',
        patientName: aptOrName,
        doctorId: MOCK_DOCTOR_USER.uid,
        doctorName: authState.currentUser?.role === 'Doctor' ? authState.currentUser.fullName : MOCK_DOCTOR_USER.fullName,
        doctorSpecialty: 'Cardiology & Intensive Care',
        date: 'Today, Oct 4',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: 'Video Call',
        status: 'In Progress',
        symptoms: 'Urgent telemetry triage review session.',
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

  const openEHR = (patientName: string = 'Sarah Jenkins') => {
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
