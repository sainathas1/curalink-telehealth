'use client';

import { useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTelehealth } from '../../context/TelehealthContext';
import { TopHeader } from '../../components/navbar/TopHeader';
import { Sidebar, type DoctorTab } from '../../components/navbar/Sidebar';
import { MobileNav } from '../../components/navbar/MobileNav';
import { PortalGate } from '../../components/navbar/PortalGate';
import { VideoCallModal } from '../../components/doctor/VideoCallModal';
import { EHRPrescriptionModal } from '../../components/doctor/EHRPrescriptionModal';
import { HardwareSimulatorDrawer } from '../../components/iot/HardwareSimulatorDrawer';
import { ESP32GuideModal } from '../../components/iot/ESP32GuideModal';
import { AuthModal } from '../../components/auth/AuthModal';
import { ErrorBoundary } from '../../components/ui/ErrorBoundary';

const doctorRoutes: Record<DoctorTab, string> = {
  'clinical-queue': '/doctor/dashboard',
  'ward-telemetry': '/doctor/ward',
  'patient-directory': '/doctor/patients',
  records: '/doctor/records',
  'ehr-prescribe': '/doctor/ehr',
  'hardware-hub': '/doctor/iot-hub',
};

export default function DoctorLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const {
    currentUser, isLoading, authError, retryAuth, handleLogout, telemetry, isSimulating, setIsSimulating,
    simulationMode, changeSimulationMode, patientDirectory, isVideoCallOpen,
    activeCallAppointment, closeVideoCall, isEHRModalOpen, targetEhrPatientName,
    targetEhrPatientId, openEHR, closeEHR, addPrescription, isSimulatorDrawerOpen,
    openSimulator, closeSimulator, isESP32GuideOpen, openESP32Guide, closeESP32Guide,
    isAuthModalOpen, openAuthModal, closeAuthModal, setAuthenticatedProfile,
  } = useTelehealth();

  const authModal = <AuthModal isOpen={isAuthModalOpen} onClose={closeAuthModal} initialRole="Doctor" onSuccess={(profile) => {
    setAuthenticatedProfile(profile);
    closeAuthModal();
    if (profile.role.toLowerCase() === 'doctor') router.replace(pathname);
    else router.replace(profile.hasCompletedOnboarding === false ? '/onboarding' : '/patient/dashboard');
  }} />;

  if (isLoading) return <PortalGate eyebrow="Your clinical workspace" title="Preparing your workspace" description="Checking your account and clinician access." loading />;
  if (authError) return <PortalGate eyebrow="Account connection" title="We could not load your care profile" description={authError} actionLabel="Try again" onAction={retryAuth} secondaryLabel="Go to sign in" onSecondaryAction={() => router.push('/auth')} />;
  if (!currentUser) return <><PortalGate eyebrow="Doctor portal" title="Care begins with a connection" description="Sign in with your clinician account to view consultations, assigned patients, and clinical records." actionLabel="Sign in to continue" onAction={openAuthModal} secondaryLabel="Back to CuraLink" onSecondaryAction={() => router.push('/')} />{authModal}</>;
  if (currentUser.role?.toLowerCase() !== 'doctor') return <PortalGate eyebrow="Account access" title="Your patient portal is ready" description="This workspace requires a doctor account. You can access your appointments and health information in your patient portal." actionLabel="Go to patient portal" onAction={() => router.replace(currentUser.hasCompletedOnboarding === false ? '/onboarding' : '/patient/dashboard')} secondaryLabel="Sign out" onSecondaryAction={handleLogout} />;
  if (currentUser.isVerified !== true) return <PortalGate eyebrow="Clinician verification" title="Your credentials are under review" description="Your account is registered. An administrator must verify your clinician credentials before patient information and clinical tools become available. This page will update when your account is approved." detail={currentUser.email} actionLabel="Back to CuraLink" onAction={() => router.push('/')} secondaryLabel="Sign out" onSecondaryAction={handleLogout} />;

  const activeTab = (Object.entries(doctorRoutes).find(([, path]) => pathname === path || pathname.startsWith(path + '/'))?.[0] || 'clinical-queue') as DoctorTab;
  const handleSelectTab = (tab: string) => {
    const destination = doctorRoutes[tab as DoctorTab];
    if (destination) router.push(destination);
  };
  const criticalCount = patientDirectory.filter((patient) => patient.status === 'Critical').length;

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-800">
      <a href="#doctor-content" className="care-skip">Skip to main content</a>
      <TopHeader currentUser={currentUser} role="Doctor" onLogout={handleLogout} onOpenAuth={openAuthModal} telemetry={telemetry} isSimulating={isSimulating} onToggleSimulatorDrawer={openSimulator} onOpenHardwareGuide={openESP32Guide} activeCriticalAlertsCount={criticalCount} activeTab={activeTab} onSelectTab={handleSelectTab} />
      <div className="flex items-start">
        <Sidebar role="Doctor" activeTab={activeTab} onSelectTab={handleSelectTab} isCollapsed={isSidebarCollapsed} onToggleCollapse={() => setIsSidebarCollapsed((collapsed) => !collapsed)} onEmergencySOS={() => {}} activeAlertCount={criticalCount} />
        <main id="doctor-content" tabIndex={-1} className="mx-auto min-w-0 flex-1 px-4 pb-28 pt-6 outline-none sm:px-6 md:pb-10 lg:px-8 lg:pt-8">
          <div className="mx-auto max-w-7xl"><ErrorBoundary sectionName="Doctor Clinical Portal">{children}</ErrorBoundary></div>
        </main>
      </div>
      <MobileNav role="Doctor" activeTab={activeTab} onSelectTab={handleSelectTab} activeAlertCount={criticalCount} />
      <VideoCallModal isOpen={isVideoCallOpen} onClose={closeVideoCall} appointment={activeCallAppointment} telemetry={telemetry} onOpenEHR={() => { if (activeCallAppointment) openEHR(activeCallAppointment.patientName, activeCallAppointment.patientId); }} doctorName={currentUser.fullName} role="Doctor" currentUser={currentUser} />
      <EHRPrescriptionModal isOpen={isEHRModalOpen} onClose={closeEHR} onIssuePrescription={addPrescription} defaultPatientName={targetEhrPatientName} defaultPatientId={targetEhrPatientId} doctorId={currentUser.uid} doctorName={currentUser.fullName} doctorLicense={currentUser.licenseNumber || ''} patientDirectory={patientDirectory} />
      <HardwareSimulatorDrawer isOpen={isSimulatorDrawerOpen} onClose={closeSimulator} isSimulating={isSimulating} onToggleSimulating={() => setIsSimulating(!isSimulating)} simulationMode={simulationMode} onChangeMode={changeSimulationMode} telemetry={telemetry} onOpenCodeGuide={openESP32Guide} />
      <ESP32GuideModal isOpen={isESP32GuideOpen} onClose={closeESP32Guide} patientId={telemetry.patientId || 'patient_live'} />
      {authModal}
    </div>
  );
}
