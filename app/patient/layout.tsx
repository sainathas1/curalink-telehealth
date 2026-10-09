'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTelehealth } from '../../context/TelehealthContext';
import { TopHeader } from '../../components/navbar/TopHeader';
import { MobileTopAppBar } from '../../components/navbar/MobileTopAppBar';
import { Sidebar, type PatientTab } from '../../components/navbar/Sidebar';
import { MobileNav } from '../../components/navbar/MobileNav';
import { MobileDrawer } from '../../components/navbar/MobileDrawer';
import { PortalGate } from '../../components/navbar/PortalGate';
import { ErrorBoundary } from '../../components/ui/ErrorBoundary';
import { VideoCallModal } from '../../components/doctor/VideoCallModal';
import { HardwareSimulatorDrawer } from '../../components/iot/HardwareSimulatorDrawer';
import { ESP32GuideModal } from '../../components/iot/ESP32GuideModal';
import { EmergencySOSModal } from '../../components/patient/EmergencySOSModal';
import { AuthModal } from '../../components/auth/AuthModal';
import { initNativeBridge } from '../../lib/nativeBridge';

const patientRoutes: Record<PatientTab, string> = {
  overview: '/patient/dashboard',
  vitals: '/patient/vitals',
  device: '/patient/device',
  appointments: '/patient/appointments',
  prescriptions: '/patient/prescriptions',
  records: '/patient/records',
  profile: '/patient/profile',
};

export default function PatientLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const {
    currentUser, isLoading, authError, retryAuth, handleLogout, telemetry, isSimulating, setIsSimulating,
    simulationMode, changeSimulationMode, isVideoCallOpen, activeCallAppointment,
    closeVideoCall, isSimulatorDrawerOpen, openSimulator, closeSimulator,
    isESP32GuideOpen, openESP32Guide, closeESP32Guide, isEmergencySOSOpen,
    openEmergencySOS, closeEmergencySOS, isAuthModalOpen, openAuthModal,
    closeAuthModal, setAuthenticatedProfile,
  } = useTelehealth();

  useEffect(() => {
    const cleanup = initNativeBridge();
    return cleanup;
  }, []);

  const accountRole = currentUser?.role?.toLowerCase();
  const needsOnboarding = currentUser?.hasCompletedOnboarding === false;
  useEffect(() => {
    if (isLoading || !currentUser) return;
    if (accountRole === 'doctor') router.replace('/doctor/dashboard');
    else if (accountRole === 'patient' && needsOnboarding) router.replace('/onboarding');
  }, [isLoading, currentUser, accountRole, needsOnboarding, router]);

  const authModal = <AuthModal isOpen={isAuthModalOpen} onClose={closeAuthModal} initialRole="Patient" onSuccess={(profile) => {
    setAuthenticatedProfile(profile);
    closeAuthModal();
    if (profile.role.toLowerCase() === 'doctor') router.replace('/doctor/dashboard');
    else if (profile.hasCompletedOnboarding === false) router.replace('/onboarding');
    else router.replace(pathname);
  }} />;

  if (isLoading) return <PortalGate eyebrow="Your patient portal" title="Getting your care ready" description="Checking your account and loading your health workspace." loading />;
  if (authError) return <PortalGate eyebrow="Account connection" title="We could not load your care profile" description={authError} actionLabel="Try again" onAction={retryAuth} secondaryLabel="Go to sign in" onSecondaryAction={() => router.push('/auth')} />;
  if (!currentUser) return <><PortalGate eyebrow="Your patient portal" title="Welcome to your care space" description="Sign in to view your appointments, health readings, prescriptions, and medical records." actionLabel="Sign in to continue" onAction={openAuthModal} secondaryLabel="Back to CuraLink" onSecondaryAction={() => router.push('/')} />{authModal}</>;
  if (accountRole !== 'patient') return <PortalGate eyebrow="Account access" title="Opening your doctor portal" description="Your account is registered for clinical care. Your workspace will open shortly." actionLabel="Go to doctor portal" onAction={() => router.replace('/doctor/dashboard')} />;
  if (needsOnboarding) return <PortalGate eyebrow="One more step" title="Let's complete your health profile" description="Add your medical history so your care team has the right information for your appointments." actionLabel="Complete health profile" onAction={() => router.replace('/onboarding')} />;

  const activeTab = (Object.entries(patientRoutes).find(([, path]) => pathname === path || pathname.startsWith(path + '/'))?.[0] || 'overview') as PatientTab;
  const handleSelectTab = (tab: string) => {
    const destination = patientRoutes[tab as PatientTab];
    if (destination) router.push(destination);
  };
  const criticalCount = telemetry.status === 'critical' ? 1 : 0;

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-800">
      <a href="#patient-content" className="care-skip">Skip to main content</a>
      <MobileTopAppBar currentUser={currentUser} telemetry={telemetry} onEmergencySOS={openEmergencySOS} activeCriticalAlertsCount={criticalCount} onOpenDrawer={() => setIsMobileDrawerOpen(true)} />
      <div className="sticky top-0 z-30 hidden md:block"><TopHeader currentUser={currentUser} role="Patient" onLogout={handleLogout} onOpenAuth={openAuthModal} telemetry={telemetry} isSimulating={isSimulating} onToggleSimulatorDrawer={openSimulator} onOpenHardwareGuide={openESP32Guide} activeCriticalAlertsCount={criticalCount} activeTab={activeTab} onSelectTab={handleSelectTab} onEmergencySOS={openEmergencySOS} /></div>
      <div className="flex items-start">
        <Sidebar role="Patient" activeTab={activeTab} onSelectTab={handleSelectTab} isCollapsed={isSidebarCollapsed} onToggleCollapse={() => setIsSidebarCollapsed((collapsed) => !collapsed)} onEmergencySOS={openEmergencySOS} activeAlertCount={criticalCount} />
        <main id="patient-content" tabIndex={-1} className="mx-auto min-w-0 flex-1 px-4 pb-28 pt-6 outline-none sm:px-6 md:pb-10 lg:px-8 lg:pt-8">
          <div className="mx-auto max-w-7xl"><ErrorBoundary sectionName="Patient Portal">{children}</ErrorBoundary></div>
        </main>
      </div>
      <MobileNav role="Patient" activeTab={activeTab} onSelectTab={handleSelectTab} activeAlertCount={criticalCount} />
      <VideoCallModal isOpen={isVideoCallOpen} onClose={closeVideoCall} appointment={activeCallAppointment} telemetry={telemetry} doctorName={activeCallAppointment?.doctorName || 'Attending Physician'} role="Patient" currentUser={currentUser} />
      <HardwareSimulatorDrawer isOpen={isSimulatorDrawerOpen} onClose={closeSimulator} isSimulating={isSimulating} onToggleSimulating={() => setIsSimulating(!isSimulating)} simulationMode={simulationMode} onChangeMode={changeSimulationMode} telemetry={telemetry} onOpenCodeGuide={openESP32Guide} />
      <ESP32GuideModal isOpen={isESP32GuideOpen} onClose={closeESP32Guide} patientId={currentUser.uid} />
      <EmergencySOSModal isOpen={isEmergencySOSOpen} onClose={closeEmergencySOS} telemetry={telemetry} patientName={currentUser.fullName || 'Patient'} />
      {authModal}
      <MobileDrawer isOpen={isMobileDrawerOpen} onClose={() => setIsMobileDrawerOpen(false)} role="Patient" activeTab={activeTab} onSelectTab={handleSelectTab} currentUser={currentUser} onLogout={handleLogout} onOpenAuth={openAuthModal} onEmergencySOS={openEmergencySOS} activeAlertCount={criticalCount} />
    </div>
  );
}
