'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useTelehealth } from '../../../context/TelehealthContext';
import { PatientDirectory } from '../../../components/doctor/PatientDirectory';

export default function DoctorPatientsRoute() {
  const router = useRouter();
  const {
    patientDirectory,
    openEHR,
  } = useTelehealth();

  return (
    <PatientDirectory
      patients={patientDirectory}
      onStartVideoCall={(patientName) => {
        const roomId = `consult-${patientName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
        router.push(`/call/${roomId}`);
      }}
      onOpenEHR={openEHR}
    />
  );
}
