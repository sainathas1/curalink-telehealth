'use client';

import React from 'react';
import { useTelehealth } from '../../../context/TelehealthContext';
import { PrescriptionsList } from '../../../components/patient/PrescriptionsList';

export default function PatientPrescriptionsRoute() {
  const { currentUser, prescriptions } = useTelehealth();
  const patientName = currentUser?.fullName || 'Sarah Jenkins';

  return (
    <PrescriptionsList
      prescriptions={prescriptions}
      patientName={patientName}
    />
  );
}
