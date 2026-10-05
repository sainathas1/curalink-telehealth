'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useTelehealth } from '../../../context/TelehealthContext';
import { DoctorDashboard } from '../../../components/doctor/DoctorDashboard';
import { UserProfile } from '../../../lib/types';

const DEFAULT_DOCTOR: UserProfile = {
  uid: '',
  fullName: 'Dr. Clinician',
  email: '',
  role: 'Doctor',
  specialty: 'Clinical Telehealth Care',
  licenseNumber: 'MD-VERIFIED',
};

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
      doctor={currentUser || DEFAULT_DOCTOR}
      appointmentsQueue={doctorAppointmentsQueue}
      patients={patientDirectory}
      liveTelemetry={telemetry}
      onNavigateTab={handleNavigateTab}
      onStartVideoCall={openVideoCall}
      onOpenEHR={openEHR}
    />
  );
}
