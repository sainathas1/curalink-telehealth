'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useTelehealth } from '../../../context/TelehealthContext';
import { PatientDashboard } from '../../../components/patient/PatientDashboard';
import { UserProfile } from '../../../lib/types';

const DEFAULT_PATIENT: UserProfile = {
  uid: '',
  fullName: 'Patient',
  email: '',
  role: 'Patient',
};

export default function PatientDashboardRoute() {
  const router = useRouter();
  const {
    currentUser,
    telemetry,
    patientAppointments,
    prescriptions,
    medicalRecords,
    openVideoCall,
    openEmergencySOS,
  } = useTelehealth();

  const handleNavigateTab = (tab: string) => {
    switch (tab) {
      case 'vitals':
        router.push('/patient/vitals');
        break;
      case 'device':
        router.push('/patient/device');
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
      default:
        break;
    }
  };

  return (
    <PatientDashboard
      user={currentUser || DEFAULT_PATIENT}
      telemetry={telemetry}
      appointments={patientAppointments}
      prescriptions={prescriptions}
      records={medicalRecords}
      onNavigateTab={handleNavigateTab}
      onJoinVideoCall={openVideoCall}
      onEmergencySOS={openEmergencySOS}
    />
  );
}
