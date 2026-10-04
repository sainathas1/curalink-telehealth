'use client';

import React from 'react';
import { useTelehealth } from '../../../context/TelehealthContext';
import { PatientDirectory } from '../../../components/doctor/PatientDirectory';

export default function DoctorPatientsRoute() {
  const {
    patientDirectory,
    openVideoCall,
    openEHR,
  } = useTelehealth();

  return (
    <PatientDirectory
      patients={patientDirectory}
      onStartVideoCall={openVideoCall}
      onOpenEHR={openEHR}
    />
  );
}
