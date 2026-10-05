'use client';

import React, { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTelehealth } from '../../context/TelehealthContext';
import { TopHeader } from '../../components/navbar/TopHeader';
import { Sidebar, DoctorTab } from '../../components/navbar/Sidebar';
import { MobileNav } from '../../components/navbar/MobileNav';

import { VideoCallModal } from '../../components/doctor/VideoCallModal';
import { EHRPrescriptionModal } from '../../components/doctor/EHRPrescriptionModal';
import { HardwareSimulatorDrawer } from '../../components/iot/HardwareSimulatorDrawer';
import { ESP32GuideModal } from '../../components/iot/ESP32GuideModal';
import { AuthModal } from '../../components/auth/AuthModal';
import { ShieldAlert } from 'lucide-react';

export default function DoctorLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const {
    currentUser,
    role,
    toggleRole,
    handleLogout,
    telemetry,
    history,
    isSimulating,
    setIsSimulating,
    simulationMode,
    changeSimulationMode,
    patientDirectory,
    isVideoCallOpen,
    activeCallAppointment,
    closeVideoCall,
    isEHRModalOpen,
    targetEhrPatientName,
    openEHR,
    closeEHR,
    addPrescription,
    isSimulatorDrawerOpen,
    openSimulator,
    closeSimulator,
    isESP32GuideOpen,
    openESP32Guide,
    closeESP32Guide,
    isAuthModalOpen,
    openAuthModal,
    closeAuthModal,
    setAuthenticatedProfile,
  } = useTelehealth();

  // RBAC Access Control Guard: block patients from accessing doctor routes
  if (role === 'Patient') {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8 text-rose-500" />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-rose-400 bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/20 mb-2">
          Clinician Access Restricted
        </span>
        <h2 className="text-2xl font-bold text-white tracking-tight">Physician Credentials Required</h2>
        <p className="text-sm text-slate-400 mt-2 max-w-md">
          You are authenticated with a Patient profile ({currentUser?.fullName || 'Patient'}). Clinical observation records, ward telemetry, and EHR digital prescriptions are strictly restricted to licensed medical personnel.
        </p>
        <button
          onClick={() => router.push('/')}
          className="mt-6 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs transition-all shadow-md shadow-teal-600/20 cursor-pointer"
        >
          Return to Patient Health Portal
        </button>
      </div>
    );
  }

  // Determine active tab from pathname
  let activeTab: DoctorTab = 'clinical-queue';
  if (pathname.includes('/doctor/ward')) activeTab = 'ward-telemetry';
  else if (pathname.includes('/doctor/patients')) activeTab = 'patient-directory';
  else if (pathname.includes('/doctor/ehr')) activeTab = 'ehr-prescribe';
  else if (pathname.includes('/doctor/iot-hub')) activeTab = 'hardware-hub';

  const handleSelectTab = (tab: string) => {
    switch (tab) {
      case 'ward-telemetry':
        router.push('/doctor/ward');
        break;
      case 'patient-directory':
        router.push('/doctor/patients');
        break;
      case 'ehr-prescribe':
        router.push('/doctor/ehr');
        break;
      case 'hardware-hub':
        router.push('/doctor/iot-hub');
        break;
      case 'clinical-queue':
      default:
        router.push('/doctor/dashboard');
        break;
    }
  };

  const handleToggleRole = () => {
    toggleRole();
    router.push('/patient/dashboard');
  };

  const criticalCount = patientDirectory.filter((p) => p.status === 'Critical').length + (telemetry.status === 'critical' ? 1 : 0);

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 flex flex-col font-sans selection:bg-teal-500 selection:text-white pb-20 md:pb-0">
      <TopHeader
        currentUser={currentUser}
        role="Doctor"
        onToggleRole={handleToggleRole}
        onLogout={handleLogout}
        onOpenAuth={openAuthModal}
        telemetry={telemetry}
        isSimulating={isSimulating}
        onToggleSimulatorDrawer={openSimulator}
        onOpenHardwareGuide={openESP32Guide}
        activeCriticalAlertsCount={criticalCount}
      />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          role="Doctor"
          activeTab={activeTab}
          onSelectTab={handleSelectTab}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          onEmergencySOS={() => {}}
          activeAlertCount={criticalCount}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full overflow-y-auto">
          {children}
        </main>
      </div>

      <MobileNav
        role="Doctor"
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        activeAlertCount={criticalCount}
      />

      {/* Shared Modals */}
      <VideoCallModal
        isOpen={isVideoCallOpen}
        onClose={closeVideoCall}
        appointment={activeCallAppointment}
        telemetry={telemetry}
        onOpenEHR={() => {
          if (activeCallAppointment) {
            openEHR(activeCallAppointment.patientName);
          }
        }}
        doctorName={currentUser?.role === 'Doctor' ? currentUser.fullName : 'Attending Physician'}
        role="Doctor"
        currentUser={currentUser}
      />

      <EHRPrescriptionModal
        isOpen={isEHRModalOpen}
        onClose={closeEHR}
        onIssuePrescription={addPrescription}
        defaultPatientName={targetEhrPatientName}
        doctorName={currentUser?.role === 'Doctor' ? currentUser.fullName : 'Attending Physician'}
      />

      <HardwareSimulatorDrawer
        isOpen={isSimulatorDrawerOpen}
        onClose={closeSimulator}
        isSimulating={isSimulating}
        onToggleSimulating={() => setIsSimulating(!isSimulating)}
        simulationMode={simulationMode}
        onChangeMode={changeSimulationMode}
        telemetry={telemetry}
        onOpenCodeGuide={openESP32Guide}
      />

      <ESP32GuideModal
        isOpen={isESP32GuideOpen}
        onClose={closeESP32Guide}
        patientId={telemetry.patientId || 'patient_live'}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={closeAuthModal}
        onSuccess={(profile) => {
          setAuthenticatedProfile(profile);
          if (profile.role === 'Doctor') router.push('/doctor/dashboard');
          else router.push('/patient/dashboard');
        }}
        initialRole="Doctor"
      />
    </div>
  );
}
