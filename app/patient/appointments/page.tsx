'use client';

import { useRouter } from 'next/navigation';
import { useTelehealth } from '../../../context/TelehealthContext';
import { AppointmentsList } from '../../../components/patient/AppointmentsList';

export default function PatientAppointmentsRoute() {
  const router = useRouter();
  const {
    currentUser,
    patientAppointments,
    addAppointment,
  } = useTelehealth();

  const patientName = currentUser?.fullName || 'Patient';

  return (
    <AppointmentsList
      appointments={patientAppointments}
      onBookAppointment={addAppointment}
      onJoinVideoCall={(appointment) => router.push(`/call/${appointment.id}`)}
      patientName={patientName}
      patientId={currentUser?.uid || 'patient_user'}
    />
  );
}
