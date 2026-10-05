'use client';

import React from 'react';
import { useTelehealth } from '../../../context/TelehealthContext';
import { AppointmentsList } from '../../../components/patient/AppointmentsList';

export default function PatientAppointmentsRoute() {
  const {
    currentUser,
    patientAppointments,
    addAppointment,
    openVideoCall,
  } = useTelehealth();

  const patientName = currentUser?.fullName || 'Patient';

  return (
    <AppointmentsList
      appointments={patientAppointments}
      onBookAppointment={addAppointment}
      onJoinVideoCall={openVideoCall}
      patientName={patientName}
      patientId={currentUser?.uid || 'patient_user'}
    />
  );
}
