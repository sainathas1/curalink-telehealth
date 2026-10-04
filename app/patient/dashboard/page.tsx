'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useTelehealth } from '../../../context/TelehealthContext';
import { PatientDashboard } from '../../../components/patient/PatientDashboard';
import { MOCK_PATIENT_USER } from '../../../lib/mock-data';

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
      user={currentUser || MOCK_PATIENT_USER}
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
