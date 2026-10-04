'use client';

import React, { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTelehealth } from '../../context/TelehealthContext';
import { TopHeader } from '../../components/navbar/TopHeader';
import { Sidebar, PatientTab } from '../../components/navbar/Sidebar';
import { MobileNav } from '../../components/navbar/MobileNav';

import { VideoCallModal } from '../../components/doctor/VideoCallModal';
import { HardwareSimulatorDrawer } from '../../components/iot/HardwareSimulatorDrawer';
import { ESP32GuideModal } from '../../components/iot/ESP32GuideModal';
import { EmergencySOSModal } from '../../components/patient/EmergencySOSModal';
import { AuthModal } from '../../components/auth/AuthModal';

export default function PatientLayout({ children }: { children: React.ReactNode }) {
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
    isSimulatorDrawerOpen,
    openSimulator,
    closeSimulator,
    isESP32GuideOpen,
    openESP32Guide,
    closeESP32Guide,
    isEmergencySOSOpen,
    openEmergencySOS,
    closeEmergencySOS,
    isAuthModalOpen,
    openAuthModal,
    closeAuthModal,
    setAuthenticatedProfile,
    switchToPatientDemo,
    switchToDoctorDemo,
  } = useTelehealth();

  // Determine active tab from pathname
  let activeTab: PatientTab = 'overview';
  if (pathname.includes('/patient/vitals')) activeTab = 'vitals';
  else if (pathname.includes('/patient/appointments')) activeTab = 'appointments';
  else if (pathname.includes('/patient/prescriptions')) activeTab = 'prescriptions';
  else if (pathname.includes('/patient/records')) activeTab = 'records';

  const handleSelectTab = (tab: string) => {
    switch (tab) {
      case 'vitals':
        router.push('/patient/vitals');
        break;
      case 'appointments':
        router.push('/patient/appointments');
        break;
      case 'prescriptions':
        router.push('/patient/prescriptions');
        break;
      case 'records':
        router.push('/patient/records');
        break;
      case 'overview':
      default:
        router.push('/patient/dashboard');
        break;
    }
  };

  const handleToggleRole = () => {
    toggleRole();
    router.push('/doctor/dashboard');
  };

  const patientName = currentUser?.fullName || 'Sarah Jenkins';
  const criticalCount = patientDirectory.filter((p) => p.status === 'Critical').length + (telemetry.status === 'critical' ? 1 : 0);

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 flex flex-col font-sans selection:bg-teal-500 selection:text-white pb-20 md:pb-0">
      <TopHeader
        currentUser={currentUser}
        role="Patient"
        onToggleRole={handleToggleRole}
        onLogout={handleLogout}
        onOpenAuth={openAuthModal}
        telemetry={telemetry}
        isSimulating={isSimulating}
        onToggleSimulatorDrawer={openSimulator}
        onOpenHardwareGuide={openESP32Guide}
        activeCriticalAlertsCount={telemetry.status === 'critical' ? 1 : 0}
      />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          role="Patient"
          activeTab={activeTab}
          onSelectTab={handleSelectTab}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          onEmergencySOS={openEmergencySOS}
          activeAlertCount={criticalCount}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full overflow-y-auto">
          {children}
        </main>
      </div>

      <MobileNav
        role="Patient"
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
        doctorName="Dr. Marcus Vance, MD"
        role="Patient"
        currentUser={currentUser}
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
        patientId="patient_sarah_jenkins_01"
      />

      <EmergencySOSModal
        isOpen={isEmergencySOSOpen}
        onClose={closeEmergencySOS}
        telemetry={telemetry}
        patientName={patientName}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={closeAuthModal}
        onSuccess={(profile) => {
          setAuthenticatedProfile(profile);
          if (profile.role === 'Doctor') router.push('/doctor/dashboard');
          else router.push('/patient/dashboard');
        }}
        initialRole="Patient"
        onSelectDemoPatient={() => {
          switchToPatientDemo();
          router.push('/patient/dashboard');
        }}
        onSelectDemoDoctor={() => {
          switchToDoctorDemo();
          router.push('/doctor/dashboard');
        }}
      />
    </div>
  );
}
