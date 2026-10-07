'use client';

import { useRouter } from 'next/navigation';
import { useTelehealth } from '../../../context/TelehealthContext';
import { MultiPatientMonitor } from '../../../components/doctor/MultiPatientMonitor';

export default function DoctorWardRoute() {
  const router = useRouter();
  const {
    patientDirectory,
    telemetry,
    openEHR,
    openSimulator,
  } = useTelehealth();

  return (
    <MultiPatientMonitor
      patients={patientDirectory}
      liveTelemetry={telemetry}
      onStartVideoCall={(patientName) => {
        const roomId = `ward-${patientName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
        router.push(`/call/${roomId}`);
      }}
      onOpenEHR={openEHR}
      onOpenSimulator={openSimulator}
    />
  );
}
