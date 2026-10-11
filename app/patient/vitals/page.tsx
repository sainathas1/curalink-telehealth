'use client';

import React from 'react';
import { useTelehealth } from '../../../context/TelehealthContext';
import { VitalsMonitor } from '../../../components/patient/VitalsMonitor';

export default function PatientVitalsRoute() {
  const {
    telemetry,
    history,
    audioAlertsEnabled,
    setAudioAlertsEnabled,
    openSimulator,
    isSimulating,
    activeCallAppointment,
    patientAppointments,
  } = useTelehealth();

  const appointmentId =
    activeCallAppointment?.id ||
    patientAppointments[0]?.id ||
    'live-telemetry';

  return (
    <VitalsMonitor
      telemetry={telemetry}
      history={history}
      audioAlertsEnabled={audioAlertsEnabled}
      onToggleAudio={() => setAudioAlertsEnabled(!audioAlertsEnabled)}
      onOpenSimulator={openSimulator}
      isSimulating={isSimulating}
      appointmentId={appointmentId}
    />
  );
}
