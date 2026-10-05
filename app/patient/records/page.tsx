'use client';

import React from 'react';
import { useTelehealth } from '../../../context/TelehealthContext';
import { MedicalRecordsList } from '../../../components/patient/MedicalRecordsList';

export default function PatientRecordsRoute() {
  const { currentUser, medicalRecords, addMedicalRecord } = useTelehealth();
  const patientName = currentUser?.fullName || 'Patient';

  return (
    <MedicalRecordsList
      records={medicalRecords}
      onUploadRecord={addMedicalRecord}
      patientName={patientName}
      patientId={currentUser?.uid || 'patient_user'}
    />
  );
}
