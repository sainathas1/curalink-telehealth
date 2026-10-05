'use client';

import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useTelemetry } from '../hooks/useTelemetry';
import {
  Appointment,
  Prescription,
  MedicalRecord,
  PatientDirectoryItem,
  UserProfile,
} from '../lib/types';

// Navigation Components
import { TopHeader } from '../components/navbar/TopHeader';
import { Sidebar, ActiveTab } from '../components/navbar/Sidebar';
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

const DEFAULT_FALLBACK_USER: UserProfile = {
  uid: 'guest_user',
  email: 'guest@curalink.health',
  fullName: 'Guest User',
  role: 'Patient',
};

export default function CuraLinkApp() {
  const {
    currentUser,
    role,
    toggleRole,
    handleLogout,
    setAuthenticatedProfile,
  } = useAuth();

  const activePatientId = currentUser?.uid || 'patient_live';

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
  } = useTelemetry(activePatientId);

  // Active Tab State (synced with current role)
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Core Data Lists - Empty by default, populated by real Firestore / user actions
  const [patientAppointments, setPatientAppointments] = useState<Appointment[]>([]);
  const [doctorAppointmentsQueue, setDoctorAppointmentsQueue] = useState<Appointment[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [medicalRecords, setMedicalRecords] = useState<MedicalRecord[]>([]);
  const [patientDirectory, setPatientDirectory] = useState<PatientDirectoryItem[]>([]);

  // Modals
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isVideoCallOpen, setIsVideoCallOpen] = useState(false);
  const [activeCallAppointment, setActiveCallAppointment] = useState<Appointment | null>(null);
  const [isEHRModalOpen, setIsEHRModalOpen] = useState(false);
  const [targetEhrPatientName, setTargetEhrPatientName] = useState('');
  const [isSimulatorDrawerOpen, setIsSimulatorDrawerOpen] = useState(false);
  const [isESP32GuideOpen, setIsESP32GuideOpen] = useState(false);
  const [isEmergencySOSOpen, setIsEmergencySOSOpen] = useState(false);

  // Handle Role Switch
  const handleToggleRole = () => {
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
        patientId: activePatientId,
        patientName: appointmentOrName,
        doctorId: currentUser?.role === 'Doctor' ? currentUser.uid : 'attending_physician',
        doctorName: currentUser?.role === 'Doctor' ? currentUser.fullName : 'Attending Physician',
        doctorSpecialty: 'Telehealth Consultation',
        date: 'Today',
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

  const patientName = currentUser?.fullName || 'Patient';
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
                  user={currentUser || DEFAULT_FALLBACK_USER}
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
                  patientId={activePatientId}
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
                  patientId={activePatientId}
                />
              )}
            </>
          )}

          {/* ================= DOCTOR PORTAL VIEWS ================= */}
          {role === 'Doctor' && (
            <>
              {(activeTab === 'clinical-queue' || activeTab === ('overview' as any)) && (
                <DoctorDashboard
                  doctor={currentUser || { ...DEFAULT_FALLBACK_USER, role: 'Doctor', fullName: 'Attending Physician' }}
                  appointmentsQueue={doctorAppointmentsQueue}
                  patients={patientDirectory}
                  liveTelemetry={telemetry}
                  onNavigateTab={(tab) => setActiveTab(tab)}
                  onStartVideoCall={handleStartVideoCall}
                  onOpenEHR={handleOpenEHR}
                />
              )}

              {activeTab === 'ward-telemetry' && (
                <MultiPatientMonitor
                  patients={patientDirectory}
                  liveTelemetry={telemetry}
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
                      onClick={() => handleOpenEHR('')}
                      className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md shadow-teal-600/20 cursor-pointer"
                    >
                      + Write New Prescription
                    </button>
                  </div>
                  <PrescriptionsList
                    prescriptions={prescriptions}
                    patientName="Patient"
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

                  {/* Multi-patient ward monitor */}
                  <MultiPatientMonitor
                    patients={patientDirectory}
                    liveTelemetry={telemetry}
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
        doctorName={currentUser?.role === 'Doctor' ? currentUser.fullName : 'Attending Physician'}
        role={role}
        currentUser={currentUser}
      />

      {/* EHR & Prescription Drafting Modal */}
      <EHRPrescriptionModal
        isOpen={isEHRModalOpen}
        onClose={() => setIsEHRModalOpen(false)}
        onIssuePrescription={handleIssuePrescription}
        defaultPatientName={targetEhrPatientName}
        doctorName={currentUser?.role === 'Doctor' ? currentUser.fullName : 'Attending Physician'}
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
        patientId={activePatientId}
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
