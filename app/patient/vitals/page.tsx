'use client';

import React from 'react';
import { useTelehealth } from '../../../context/TelehealthContext';
import { VitalsMonitor } from '../../../components/patient/VitalsMonitor';

export default function PatientVitalsRoute() {
  const {
    telemetry,
    history,
    temperatureUnit,
    toggleTemperatureUnit,
    audioAlertsEnabled,
    setAudioAlertsEnabled,
    openSimulator,
    isSimulating,
  } = useTelehealth();

  return (
    <VitalsMonitor
      telemetry={telemetry}
      history={history}
      temperatureUnit={temperatureUnit}
      onToggleTempUnit={toggleTemperatureUnit}
      audioAlertsEnabled={audioAlertsEnabled}
      onToggleAudio={() => setAudioAlertsEnabled(!audioAlertsEnabled)}
      onOpenSimulator={openSimulator}
      isSimulating={isSimulating}
    />
  );
}
