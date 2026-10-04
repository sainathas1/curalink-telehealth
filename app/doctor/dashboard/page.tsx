'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useTelehealth } from '../../../context/TelehealthContext';
import { DoctorDashboard } from '../../../components/doctor/DoctorDashboard';
import { MOCK_DOCTOR_USER } from '../../../lib/mock-data';

export default function DoctorDashboardRoute() {
  const router = useRouter();
  const {
    currentUser,
    doctorAppointmentsQueue,
    patientDirectory,
    telemetry,
    openVideoCall,
    openEHR,
  } = useTelehealth();

  const handleNavigateTab = (tab: string) => {
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
      default:
        break;
    }
  };

  return (
    <DoctorDashboard
      doctor={currentUser || MOCK_DOCTOR_USER}
      appointmentsQueue={doctorAppointmentsQueue}
      patients={patientDirectory}
      liveSarahTelemetry={telemetry}
      onNavigateTab={handleNavigateTab}
      onStartVideoCall={openVideoCall}
      onOpenEHR={openEHR}
    />
  );
}
