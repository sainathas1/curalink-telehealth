'use client';

import { useRouter } from 'next/navigation';
import { useTelehealth } from '../../../context/TelehealthContext';
import { PatientDirectory } from '../../../components/doctor/PatientDirectory';

export default function DoctorPatientsRoute() {
  const router = useRouter();
  const { patientDirectory, openEHR } = useTelehealth();
  return <PatientDirectory patients={patientDirectory} onStartVideoCall={(appointment) => router.push('/call/' + appointment.id)} onOpenEHR={openEHR} />;
}
