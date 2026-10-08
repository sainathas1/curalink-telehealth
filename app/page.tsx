'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../hooks/useAuth';
import { useTelemetry } from '../hooks/useTelemetry';
import {
  Appointment,
  Prescription,
  MedicalRecord,
  PatientDirectoryItem,
  UserProfile,
} from '../lib/types';

// Landing Page 3D Components
import { LandingHeader } from '../components/landing/LandingHeader';
import { HolographicBiometricsHUD } from '../components/landing/HolographicBiometricsHUD';
import { Features3DGrid } from '../components/landing/Features3DGrid';
import { TelehealthVideoPreview3D } from '../components/landing/TelehealthVideoPreview3D';
import { ArchitectureFlow3D } from '../components/landing/ArchitectureFlow3D';
import { LiveInteractiveSandbox } from '../components/landing/LiveInteractiveSandbox';
import { LandingFooter } from '../components/landing/LandingFooter';

// Portal Navigation Components
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

import {
  HeartPulse,
  Activity,
  ShieldCheck,
  Stethoscope,
  User,
  Cpu,
  Video,
  ArrowRight,
  Sparkles,
  Zap,
  Lock,
  Radio,
  FileText,
  AlertTriangle,
  RotateCw,
  Sliders,
} from 'lucide-react';

const DEFAULT_FALLBACK_USER: UserProfile = {
  uid: 'guest_user',
  email: 'guest@curalink.health',
  fullName: 'Guest User',
  role: 'Patient',
};

export default function CuraLinkApp() {
  const router = useRouter();
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

  // View Mode: 'website' (3D showcase) or 'portal' (in-app dashboard workspace)
  const [viewMode, setViewMode] = useState<'website' | 'portal'>('website');

  // Active Tab State inside Portal mode
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Core Data Lists
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

  // Handle Role Switch in Portal Mode
  const handleToggleRole = () => {
    toggleRole();
    if (role?.toLowerCase() === 'patient') {
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
        doctorId: currentUser?.role?.toLowerCase() === 'doctor' ? currentUser.uid : 'attending_physician',
        doctorName: currentUser?.role?.toLowerCase() === 'doctor' ? currentUser.fullName : 'Attending Physician',
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

  // =========================================================================
  // VIEW MODE: 3D WEBSITE LANDING EXPERIENCE
  // =========================================================================
  if (viewMode === 'website') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-teal-500 selection:text-slate-950 relative overflow-x-hidden">
        {/* Futuristic Background Grids & Ambient Glow Orbs */}
        <div className="fixed inset-0 bg-grid-pattern opacity-40 pointer-events-none" />
        <div className="fixed -top-40 -left-40 w-96 h-96 rounded-full bg-teal-500/15 blur-[120px] pointer-events-none" />
        <div className="fixed top-1/3 -right-40 w-96 h-96 rounded-full bg-cyan-500/15 blur-[120px] pointer-events-none" />
        <div className="fixed bottom-0 left-1/3 w-96 h-96 rounded-full bg-emerald-500/15 blur-[120px] pointer-events-none" />

        {/* 1. Sleek 3D Glassmorphic Header */}
        <LandingHeader
          onOpenAuth={() => setIsAuthModalOpen(true)}
          onLaunchPortal={() => setViewMode('portal')}
          onToggleDemoMode={() => setViewMode('portal')}
          isDemoMode={false}
          currentUser={currentUser}
        />

        {/* 2. Hero Section */}
        <section className="relative pt-32 sm:pt-40 pb-16 sm:pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex flex-col items-center text-center z-10">
          {/* Top Medical Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs font-mono font-bold uppercase tracking-wider mb-8 shadow-lg shadow-teal-500/10 animate-pulse-glow">
            <Radio className="w-3.5 h-3.5 text-teal-400 animate-pulse" />
            <span>Continuous IoT Telemetry • WebRTC HD Calls • Certified EHR</span>
          </div>

          {/* High-Impact 3D Headline */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white max-w-5xl leading-[1.1]">
            Real-Time Biomedical <br className="hidden sm:inline" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 via-emerald-400 to-cyan-400">
              Telehealth & Remote Care
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mt-6 text-base sm:text-lg text-slate-300 max-w-2xl leading-relaxed">
            Continuous wearable vital signs monitoring, sub-second cardiac telemetry, encrypted HD consultations, and certified electronic health records in one unified platform.
          </p>

          {/* Hero CTAs */}
          <div className="mt-8 sm:mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/patient/dashboard"
              className="px-6 sm:px-8 py-3.5 sm:py-4 rounded-2xl bg-gradient-to-r from-teal-500 via-teal-400 to-emerald-400 hover:from-teal-400 hover:to-emerald-300 text-slate-950 font-black text-sm sm:text-base shadow-xl shadow-teal-500/30 transition-all flex items-center gap-2 group cursor-pointer"
            >
              <User className="w-4 h-4 sm:w-5 sm:h-5 text-slate-950" />
              <span>Launch Patient Portal</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>

            <Link
              href="/doctor/dashboard"
              className="px-6 sm:px-8 py-3.5 sm:py-4 rounded-2xl bg-slate-900/90 hover:bg-slate-800 text-white font-bold text-sm sm:text-base border border-teal-500/30 hover:border-teal-400/60 shadow-xl transition-all flex items-center gap-2 cursor-pointer"
            >
              <Stethoscope className="w-4 h-4 sm:w-5 sm:h-5 text-teal-400" />
              <span>Doctor Clinical Workspace</span>
            </Link>

            <button
              onClick={() => setIsSimulatorDrawerOpen(true)}
              className="px-5 py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-bold text-xs sm:text-sm border border-white/10 transition-all flex items-center gap-2 cursor-pointer"
              title="Test Tachycardia, Fever, or Arrhythmia Alarms"
            >
              <Sliders className="w-4 h-4 text-emerald-400" />
              <span>Test IoT Simulator</span>
            </button>
          </div>

          {/* Floating 3D Stat Counters */}
          <div className="mt-14 sm:mt-16 grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 w-full max-w-4xl text-left">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
              <span className="text-2xl sm:text-3xl font-black text-white font-mono">99.98%</span>
              <p className="text-xs text-slate-400 font-mono mt-0.5">Telemetry Uptime</p>
            </div>
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
              <span className="text-2xl sm:text-3xl font-black text-teal-400 font-mono">&lt;45ms</span>
              <p className="text-xs text-slate-400 font-mono mt-0.5">Stream Latency</p>
            </div>
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
              <span className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">AES-256</span>
              <p className="text-xs text-slate-400 font-mono mt-0.5">HIPAA Encryption</p>
            </div>
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
              <span className="text-2xl sm:text-3xl font-black text-cyan-400 font-mono">10,000+</span>
              <p className="text-xs text-slate-400 font-mono mt-0.5">Tele-Consultations</p>
            </div>
          </div>
        </section>

        {/* 3. Holographic 3D Biometrics HUD */}
        <HolographicBiometricsHUD />

        {/* 4. 3D Features Matrix */}
        <Features3DGrid />

        {/* 5. 3D Telehealth Video Consultation Showcase */}
        <TelehealthVideoPreview3D />

        {/* 6. 3D Architecture Pipeline Visualizer */}
        <ArchitectureFlow3D />

        {/* 7. Live Interactive Sandbox (Direct Test Drive) */}
        <LiveInteractiveSandbox />

        {/* 8. Call to Action Banner */}
        <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-center relative z-10">
          <div className="rounded-3xl border border-teal-500/30 bg-gradient-to-b from-slate-900 to-slate-950 p-8 sm:p-12 shadow-2xl relative overflow-hidden">
            <div className="absolute -top-24 -right-24 w-60 h-60 rounded-full bg-teal-500/20 blur-3xl" />
            <div className="absolute -bottom-24 -left-24 w-60 h-60 rounded-full bg-emerald-500/20 blur-3xl" />

            <div className="relative z-10 space-y-4 max-w-2xl mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-teal-500/20 border border-teal-400/40 text-teal-300 flex items-center justify-center mx-auto shadow-lg shadow-teal-500/20">
                <HeartPulse className="w-7 h-7 animate-pulse" />
              </div>

              <h3 className="text-2xl sm:text-4xl font-black text-white">
                Transform Your Clinical Practice Today
              </h3>

              <p className="text-sm text-slate-300 leading-relaxed">
                Connect your patients to continuous remote care, schedule virtual visits, and issue certified digital prescriptions with zero setup friction.
              </p>

              <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="px-6 py-3.5 rounded-2xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-sm shadow-xl shadow-teal-500/30 transition-all cursor-pointer"
                >
                  Create Free Account
                </button>

                <button
                  onClick={() => setViewMode('portal')}
                  className="px-6 py-3.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm border border-white/10 transition-all cursor-pointer"
                >
                  Enter Portal Mode
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* 9. Sleek 3D Footer */}
        <LandingFooter />

        {/* Global Modals wired into Website Mode */}
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          onSuccess={(profile) => {
            setAuthenticatedProfile(profile);
            if (profile.role?.toLowerCase() === 'doctor') {
              router.push('/doctor/dashboard');
            } else {
              router.push('/patient/dashboard');
            }
          }}
          initialRole={role}
        />

        <VideoCallModal
          isOpen={isVideoCallOpen}
          onClose={() => {
            setIsVideoCallOpen(false);
            setActiveCallAppointment(null);
          }}
          appointment={activeCallAppointment}
          telemetry={telemetry}
          onOpenEHR={() => {
            if (role?.toLowerCase() === 'doctor' && activeCallAppointment) {
              handleOpenEHR(activeCallAppointment.patientName);
            }
          }}
          doctorName={currentUser?.role?.toLowerCase() === 'doctor' ? currentUser.fullName : 'Attending Physician'}
          role={role}
          currentUser={currentUser}
        />

        <EHRPrescriptionModal
          isOpen={isEHRModalOpen}
          onClose={() => setIsEHRModalOpen(false)}
          onIssuePrescription={handleIssuePrescription}
          defaultPatientName={targetEhrPatientName}
          doctorName={currentUser?.role?.toLowerCase() === 'doctor' ? currentUser.fullName : 'Attending Physician'}
        />

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

        <ESP32GuideModal
          isOpen={isESP32GuideOpen}
          onClose={() => setIsESP32GuideOpen(false)}
          patientId={activePatientId}
        />

        <EmergencySOSModal
          isOpen={isEmergencySOSOpen}
          onClose={() => setIsEmergencySOSOpen(false)}
          telemetry={telemetry}
          patientName={patientName}
        />
      </div>
    );
  }

  // =========================================================================
  // VIEW MODE: IN-APP PORTAL WORKSPACE
  // =========================================================================
  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 flex flex-col font-sans selection:bg-teal-500 selection:text-white pb-20 md:pb-0">
      {/* Return to 3D Website presentation banner */}
      <div className="bg-slate-950 text-white px-4 py-2 text-xs flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
          <span className="font-mono text-slate-300">
            PORTAL WORKSPACE ACTIVE • Role: {role || 'Patient'}
          </span>
        </div>
        <button
          onClick={() => setViewMode('website')}
          className="px-3 py-1 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1"
        >
          <span>← Return to 3D Website</span>
        </button>
      </div>

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
          {role?.toLowerCase() === 'patient' && (
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
          {role?.toLowerCase() === 'doctor' && (
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
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={(profile) => {
          setAuthenticatedProfile(profile);
          if (profile.role?.toLowerCase() === 'doctor') setActiveTab('clinical-queue');
          else setActiveTab('overview');
        }}
        initialRole={role}
      />

      <VideoCallModal
        isOpen={isVideoCallOpen}
        onClose={() => {
          setIsVideoCallOpen(false);
          setActiveCallAppointment(null);
        }}
        appointment={activeCallAppointment}
        telemetry={telemetry}
        onOpenEHR={() => {
          if (role?.toLowerCase() === 'doctor' && activeCallAppointment) {
            handleOpenEHR(activeCallAppointment.patientName);
          }
        }}
        doctorName={currentUser?.role?.toLowerCase() === 'doctor' ? currentUser.fullName : 'Attending Physician'}
        role={role}
        currentUser={currentUser}
      />

      <EHRPrescriptionModal
        isOpen={isEHRModalOpen}
        onClose={() => setIsEHRModalOpen(false)}
        onIssuePrescription={handleIssuePrescription}
        defaultPatientName={targetEhrPatientName}
        doctorName={currentUser?.role?.toLowerCase() === 'doctor' ? currentUser.fullName : 'Attending Physician'}
      />

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

      <ESP32GuideModal
        isOpen={isESP32GuideOpen}
        onClose={() => setIsESP32GuideOpen(false)}
        patientId={activePatientId}
      />

      <EmergencySOSModal
        isOpen={isEmergencySOSOpen}
        onClose={() => setIsEmergencySOSOpen(false)}
        telemetry={telemetry}
        patientName={patientName}
      />
    </div>
  );
}
