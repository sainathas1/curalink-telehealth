'use client';

import React from 'react';
import { useTelehealth } from '../../../context/TelehealthContext';
import { MultiPatientMonitor } from '../../../components/doctor/MultiPatientMonitor';

export default function DoctorWardRoute() {
  const {
    patientDirectory,
    telemetry,
    openVideoCall,
    openEHR,
    openSimulator,
  } = useTelehealth();

  return (
    <MultiPatientMonitor
      patients={patientDirectory}
      liveTelemetry={telemetry}
      onStartVideoCall={openVideoCall}
      onOpenEHR={openEHR}
      onOpenSimulator={openSimulator}
    />
  );
}
