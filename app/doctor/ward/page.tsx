'use client';

import { useRouter } from 'next/navigation';
import { useTelehealth } from '../../../context/TelehealthContext';
import { MultiPatientMonitor } from '../../../components/doctor/MultiPatientMonitor';

export default function DoctorWardRoute() {
  const router = useRouter();
  const { patientDirectory, telemetry, openEHR, openSimulator } = useTelehealth();
  return <MultiPatientMonitor patients={patientDirectory} liveTelemetry={telemetry} onStartVideoCall={(appointment) => router.push('/call/' + appointment.id)} onOpenEHR={openEHR} onOpenSimulator={openSimulator} />;
}
