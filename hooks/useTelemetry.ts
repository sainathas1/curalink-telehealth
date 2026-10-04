'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { LiveTelemetryPayload, VitalHistoryPoint } from '../lib/types';
import {
  INITIAL_LIVE_TELEMETRY,
  MOCK_VITALS_24H_TREND,
} from '../lib/mock-data';
import {
  createHardwareStreamSimulator,
  subscribeToFirebaseTelemetry,
  playAlertChime,
  SimulationMode,
} from '../lib/iot-service';

export function useTelemetry(patientId: string = 'patient_sarah_jenkins_01') {
  const [telemetry, setTelemetry] = useState<LiveTelemetryPayload>(INITIAL_LIVE_TELEMETRY);
  const [history, setHistory] = useState<VitalHistoryPoint[]>(MOCK_VITALS_24H_TREND);
  const [isSimulating, setIsSimulating] = useState<boolean>(true);
  const [simulationMode, setSimulationMode] = useState<SimulationMode>('normal');
  const [audioAlertsEnabled, setAudioAlertsEnabled] = useState<boolean>(true);
  const [temperatureUnit, setTemperatureUnit] = useState<'C' | 'F'>('C');
  const [lastAlertTime, setLastAlertTime] = useState<number>(0);

  const simulatorRef = useRef<{ stop: () => void; setMode: (m: SimulationMode) => void } | null>(null);

  // Handle new incoming payload (from hardware or simulator)
  const handleIncomingPayload = useCallback((payload: LiveTelemetryPayload) => {
    setTelemetry(payload);

    // If critical alert and audio enabled, throttle alarm to once every 12 seconds
    if (payload.status === 'critical' && audioAlertsEnabled) {
      const now = Date.now();
      if (now - lastAlertTime > 12000) {
        playAlertChime(true);
        setLastAlertTime(now);
      }
    }

    // Append to real-time trend history (keep last 30 points)
    const timeLabel = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setHistory((prev) => {
      const next = [
        ...prev,
        {
          time: timeLabel,
          heartRate: payload.heartRate,
          spo2: payload.spo2,
          temperature: payload.temperature,
          systolic: payload.systolic,
          diastolic: payload.diastolic,
        },
      ];
      return next.slice(-24); // Keep last 24 points for clean chart
    });
  }, [audioAlertsEnabled, lastAlertTime]);

  // Setup Firebase Listener
  useEffect(() => {
    const unsub = subscribeToFirebaseTelemetry(patientId, (firebasePayload) => {
      // If real hardware is streaming, we can feed it in
      handleIncomingPayload(firebasePayload);
    });
    return () => unsub();
  }, [patientId, handleIncomingPayload]);

  // Setup Hardware Simulator
  useEffect(() => {
    if (isSimulating) {
      simulatorRef.current = createHardwareStreamSimulator(patientId, simulationMode, (simData) => {
        handleIncomingPayload(simData);
      });
    } else {
      if (simulatorRef.current) {
        simulatorRef.current.stop();
        simulatorRef.current = null;
      }
    }

    return () => {
      if (simulatorRef.current) {
        simulatorRef.current.stop();
        simulatorRef.current = null;
      }
    };
  }, [isSimulating, patientId, handleIncomingPayload, simulationMode]);

  const changeSimulationMode = (mode: SimulationMode) => {
    setSimulationMode(mode);
    if (simulatorRef.current) {
      simulatorRef.current.setMode(mode);
    }
  };

  const toggleTemperatureUnit = () => {
    setTemperatureUnit((prev) => (prev === 'C' ? 'F' : 'C'));
  };

  const formatTemperature = (tempInC: number) => {
    if (temperatureUnit === 'F') {
      return `${((tempInC * 9) / 5 + 32).toFixed(1)} °F`;
    }
    return `${tempInC.toFixed(1)} °C`;
  };

  return {
    telemetry,
    history,
    isSimulating,
    setIsSimulating,
    simulationMode,
    changeSimulationMode,
    audioAlertsEnabled,
    setAudioAlertsEnabled,
    temperatureUnit,
    toggleTemperatureUnit,
    formatTemperature,
  };
}
