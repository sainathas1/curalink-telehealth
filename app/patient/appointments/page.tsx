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

  const patientName = currentUser?.fullName || 'Sarah Jenkins';

  return (
    <AppointmentsList
      appointments={patientAppointments}
      onBookAppointment={addAppointment}
      onJoinVideoCall={openVideoCall}
      patientName={patientName}
      patientId="patient_sarah_jenkins_01"
    />
  );
}
