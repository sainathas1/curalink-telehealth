'use client';

import React, { useState } from 'react';
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
  Appointment,
  Prescription,
  MedicalRecord,
  PatientDirectoryItem,
} from '../lib/types';

// Navigation Components
import { TopHeader } from '../components/navbar/TopHeader';
import { Sidebar, ActiveTab, PatientTab, DoctorTab } from '../components/navbar/Sidebar';
import { MobileNav } from '../components/navbar/MobileNav';

// Patient Portal Components
import { PatientDashboard } from '../components/patient/PatientDashboard';
import { VitalsMonitor } from '../components/patient/VitalsMonitor';
import { AppointmentsList } from '../components/patient/AppointmentsList';
import { PrescriptionsList } from '../components/patient/PrescriptionsList';
import { MedicalRecordsList } from '../components/patient/MedicalRecordsList';
import { EmergencySOSModal } from '../components/patient/EmergencySOSModal';

// Doctor Portal Components
import { DoctorDashboard } from '../components/doctor/DoctorDashboard';
import { MultiPatientMonitor } from '../components/doctor/MultiPatientMonitor';
import { PatientDirectory } from '../components/doctor/PatientDirectory';
import { VideoCallModal } from '../components/doctor/VideoCallModal';
import { EHRPrescriptionModal } from '../components/doctor/EHRPrescriptionModal';

// IoT Components
import { HardwareSimulatorDrawer } from '../components/iot/HardwareSimulatorDrawer';
import { ESP32GuideModal } from '../components/iot/ESP32GuideModal';

// Auth Modal
import { AuthModal } from '../components/auth/AuthModal';

export default function CuraLinkApp() {
  const {
    currentUser,
    role,
    setRole,
    toggleRole,
    handleLogout,
    switchToPatientDemo,
    switchToDoctorDemo,
    setAuthenticatedProfile,
  } = useAuth();

  const {
    telemetry,
    history,
    isSimulating,
    setIsSimulating,
    simulationMode,
    changeSimulationMode,
    audioAlertsEnabled,
    setAudioAlertsEnabled,
    temperatureUnit,
    toggleTemperatureUnit,
  } = useTelemetry('patient_sarah_jenkins_01');

  // Active Tab State (synced with current role)
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Core Data Lists
  const [patientAppointments, setPatientAppointments] = useState<Appointment[]>(MOCK_APPOINTMENTS);
  const [doctorAppointmentsQueue, setDoctorAppointmentsQueue] = useState<Appointment[]>(MOCK_DOCTOR_APPOINTMENTS_QUEUE);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>(MOCK_PRESCRIPTIONS);
  const [medicalRecords, setMedicalRecords] = useState<MedicalRecord[]>(MOCK_MEDICAL_RECORDS);
  const [patientDirectory, setPatientDirectory] = useState<PatientDirectoryItem[]>(MOCK_PATIENT_DIRECTORY);

  // Modals
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isVideoCallOpen, setIsVideoCallOpen] = useState(false);
  const [activeCallAppointment, setActiveCallAppointment] = useState<Appointment | null>(null);
  const [isEHRModalOpen, setIsEHRModalOpen] = useState(false);
  const [targetEhrPatientName, setTargetEhrPatientName] = useState('Sarah Jenkins');
  const [isSimulatorDrawerOpen, setIsSimulatorDrawerOpen] = useState(false);
  const [isESP32GuideOpen, setIsESP32GuideOpen] = useState(false);
  const [isEmergencySOSOpen, setIsEmergencySOSOpen] = useState(false);

  // Handle Role Switch (Locked when authenticated to an actual account)
  const handleToggleRole = () => {
    if (currentUser?.uid && !currentUser.uid.startsWith('demo_')) {
      // Locked session: role is permanently tied to verified account
      return;
    }
    toggleRole();
    if (role === 'Patient') {
      setActiveTab('clinical-queue');
    } else {
      setActiveTab('overview');
    }
  };

  // Video Call Action
  const handleStartVideoCall = (appointmentOrName: Appointment | string) => {
    if (typeof appointmentOrName === 'string') {
      const apt: Appointment = {
        id: `apt_quick_${Date.now()}`,
        patientId: 'patient_sarah_jenkins_01',
        patientName: appointmentOrName,
        doctorId: MOCK_DOCTOR_USER.uid,
        doctorName: currentUser?.role === 'Doctor' ? currentUser.fullName : MOCK_DOCTOR_USER.fullName,
        doctorSpecialty: 'Cardiology & Intensive Care',
        date: 'Today, Oct 4',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: 'Video Call',
        status: 'In Progress',
        symptoms: 'Urgent telemetry triage review session.',
      };
      setActiveCallAppointment(apt);
    } else {
      setActiveCallAppointment(appointmentOrName);
    }
    setIsVideoCallOpen(true);
  };

  // Open EHR Modal for a patient
  const handleOpenEHR = (patientName: string) => {
    setTargetEhrPatientName(patientName);
    setIsEHRModalOpen(true);
  };

  // Issue new prescription
  const handleIssuePrescription = (newRx: Prescription) => {
    setPrescriptions((prev) => [newRx, ...prev]);
  };

  // Book new appointment
  const handleBookAppointment = (newApt: Appointment) => {
    setPatientAppointments((prev) => [newApt, ...prev]);
    setDoctorAppointmentsQueue((prev) => [newApt, ...prev]);
  };

  // Upload new medical record
  const handleUploadRecord = (newRec: MedicalRecord) => {
    setMedicalRecords((prev) => [newRec, ...prev]);
  };

  const patientName = currentUser?.role === 'Patient' ? currentUser.fullName : 'Sarah Jenkins';
  const criticalCount = patientDirectory.filter((p) => p.status === 'Critical').length + (telemetry.status === 'critical' ? 1 : 0);

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 flex flex-col font-sans selection:bg-teal-500 selection:text-white pb-20 md:pb-0">
      {/* 1. Sticky Top Navigation Header */}
      <TopHeader
        currentUser={currentUser}
        role={role}
        onToggleRole={handleToggleRole}
        onLogout={handleLogout}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        telemetry={telemetry}
        isSimulating={isSimulating}
        onToggleSimulatorDrawer={() => setIsSimulatorDrawerOpen(true)}
        onOpenHardwareGuide={() => setIsESP32GuideOpen(true)}
        activeCriticalAlertsCount={telemetry.status === 'critical' ? 1 : 0}
      />

      {/* 2. Main Portal Shell (Sidebar + Content Stage) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Collapsible Navigation Sidebar */}
        <Sidebar
          role={role}
          activeTab={activeTab}
          onSelectTab={(tab) => setActiveTab(tab)}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          onEmergencySOS={() => setIsEmergencySOSOpen(true)}
          activeAlertCount={criticalCount}
        />

        {/* Content View Stage */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full overflow-y-auto">
          {/* ================= PATIENT PORTAL VIEWS ================= */}
          {role === 'Patient' && (
            <>
              {activeTab === 'overview' && (
                <PatientDashboard
                  user={currentUser || MOCK_DOCTOR_USER}
                  telemetry={telemetry}
                  appointments={patientAppointments}
                  prescriptions={prescriptions}
                  records={medicalRecords}
                  onNavigateTab={(tab) => setActiveTab(tab)}
                  onJoinVideoCall={handleStartVideoCall}
                  onEmergencySOS={() => setIsEmergencySOSOpen(true)}
                />
              )}

              {activeTab === 'vitals' && (
                <VitalsMonitor
                  telemetry={telemetry}
                  history={history}
                  temperatureUnit={temperatureUnit}
                  onToggleTempUnit={toggleTemperatureUnit}
                  audioAlertsEnabled={audioAlertsEnabled}
                  onToggleAudio={() => setAudioAlertsEnabled(!audioAlertsEnabled)}
                  onOpenSimulator={() => setIsSimulatorDrawerOpen(true)}
                  isSimulating={isSimulating}
                />
              )}

              {activeTab === 'appointments' && (
                <AppointmentsList
                  appointments={patientAppointments}
                  onBookAppointment={handleBookAppointment}
                  onJoinVideoCall={handleStartVideoCall}
                  patientName={patientName}
                  patientId="patient_sarah_jenkins_01"
                />
              )}

              {activeTab === 'prescriptions' && (
                <PrescriptionsList
                  prescriptions={prescriptions}
                  patientName={patientName}
                />
              )}

              {activeTab === 'records' && (
                <MedicalRecordsList
                  records={medicalRecords}
                  onUploadRecord={handleUploadRecord}
                  patientName={patientName}
                />
              )}
            </>
          )}

          {/* ================= DOCTOR PORTAL VIEWS ================= */}
          {role === 'Doctor' && (
            <>
              {(activeTab === 'clinical-queue' || activeTab === ('overview' as any)) && (
                <DoctorDashboard
                  doctor={currentUser || MOCK_DOCTOR_USER}
                  appointmentsQueue={doctorAppointmentsQueue}
                  patients={patientDirectory}
                  liveSarahTelemetry={telemetry}
                  onNavigateTab={(tab) => setActiveTab(tab)}
                  onStartVideoCall={handleStartVideoCall}
                  onOpenEHR={handleOpenEHR}
                />
              )}

              {activeTab === 'ward-telemetry' && (
                <MultiPatientMonitor
                  patients={patientDirectory}
                  liveSarahTelemetry={telemetry}
                  onStartVideoCall={handleStartVideoCall}
                  onOpenEHR={handleOpenEHR}
                  onOpenSimulator={() => setIsSimulatorDrawerOpen(true)}
                />
              )}

              {activeTab === 'patient-directory' && (
                <PatientDirectory
                  patients={patientDirectory}
                  onStartVideoCall={handleStartVideoCall}
                  onOpenEHR={handleOpenEHR}
                />
              )}

              {activeTab === 'ehr-prescribe' && (
                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                        EHR Consultation & Prescription Studio
                      </h2>
                      <p className="text-xs text-slate-500 mt-1">
                        Author clinical observations, record differential diagnoses, and issue certified digital prescriptions
                      </p>
                    </div>
                    <button
                      onClick={() => handleOpenEHR('Sarah Jenkins')}
                      className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md shadow-teal-600/20 cursor-pointer"
                    >
                      + Write New Prescription
                    </button>
                  </div>
                  <PrescriptionsList
                    prescriptions={prescriptions}
                    patientName="Sarah Jenkins"
                  />
                </div>
              )}

              {activeTab === 'hardware-hub' && (
                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                        IoT Biomedical Telemetry Hub
                      </h2>
                      <p className="text-xs text-slate-500 mt-1">
                        Manage ESP32/ESP8266 remote wearable nodes, test alarms, and inspect firmware
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setIsSimulatorDrawerOpen(true)}
                        className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer"
                      >
                        Open Simulator Drawer
                      </button>
                      <button
                        onClick={() => setIsESP32GuideOpen(true)}
                        className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs cursor-pointer"
                      >
                        View ESP32 C++ Code
                      </button>
                    </div>
                  </div>

                  {/* Multi-patient ward monitor preview */}
                  <MultiPatientMonitor
                    patients={patientDirectory}
                    liveSarahTelemetry={telemetry}
                    onStartVideoCall={handleStartVideoCall}
                    onOpenEHR={handleOpenEHR}
                    onOpenSimulator={() => setIsSimulatorDrawerOpen(true)}
                  />
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* 3. Mobile Bottom Navigation Bar */}
      <MobileNav
        role={role}
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab)}
        activeAlertCount={criticalCount}
      />

      {/* ================= MODALS & DRAWERS ================= */}

      {/* Unified Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={(profile) => {
          setAuthenticatedProfile(profile);
          if (profile.role === 'Doctor') setActiveTab('clinical-queue');
          else setActiveTab('overview');
        }}
        initialRole={role}
        onSelectDemoPatient={() => {
          switchToPatientDemo();
          setActiveTab('overview');
        }}
        onSelectDemoDoctor={() => {
          switchToDoctorDemo();
          setActiveTab('clinical-queue');
        }}
      />

      {/* Interactive Telehealth Video Consultation Room */}
      <VideoCallModal
        isOpen={isVideoCallOpen}
        onClose={() => {
          setIsVideoCallOpen(false);
          setActiveCallAppointment(null);
        }}
        appointment={activeCallAppointment}
        telemetry={telemetry}
        onOpenEHR={() => {
          if (role === 'Doctor' && activeCallAppointment) {
            handleOpenEHR(activeCallAppointment.patientName);
          }
        }}
        doctorName={currentUser?.role === 'Doctor' ? currentUser.fullName : 'Dr. Marcus Vance, MD'}
        role={role}
        currentUser={currentUser}
      />

      {/* EHR & Prescription Drafting Modal */}
      <EHRPrescriptionModal
        isOpen={isEHRModalOpen}
        onClose={() => setIsEHRModalOpen(false)}
        onIssuePrescription={handleIssuePrescription}
        defaultPatientName={targetEhrPatientName}
        doctorName={currentUser?.role === 'Doctor' ? currentUser.fullName : 'Dr. Marcus Vance, MD'}
      />

      {/* IoT Hardware Simulator Drawer */}
      <HardwareSimulatorDrawer
        isOpen={isSimulatorDrawerOpen}
        onClose={() => setIsSimulatorDrawerOpen(false)}
        isSimulating={isSimulating}
        onToggleSimulating={() => setIsSimulating(!isSimulating)}
        simulationMode={simulationMode}
        onChangeMode={changeSimulationMode}
        telemetry={telemetry}
        onOpenCodeGuide={() => setIsESP32GuideOpen(true)}
      />

      {/* ESP32 Firmware & Pinout Documentation Modal */}
      <ESP32GuideModal
        isOpen={isESP32GuideOpen}
        onClose={() => setIsESP32GuideOpen(false)}
        patientId="patient_sarah_jenkins_01"
      />

      {/* Emergency Medical SOS Modal */}
      <EmergencySOSModal
        isOpen={isEmergencySOSOpen}
        onClose={() => setIsEmergencySOSOpen(false)}
        telemetry={telemetry}
        patientName={patientName}
      />
    </div>
  );
}
