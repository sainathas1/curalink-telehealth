'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { LiveTelemetryPayload, VitalHistoryPoint } from '../lib/types';
import {
  createHardwareStreamSimulator,
  subscribeToFirebaseTelemetry,
  playAlertChime,
  SimulationMode,
  INITIAL_EMPTY_TELEMETRY,
} from '../lib/iot-service';

export function useTelemetry(patientId: string = '') {
  const [telemetry, setTelemetry] = useState<LiveTelemetryPayload>(INITIAL_EMPTY_TELEMETRY);
  const [history, setHistory] = useState<VitalHistoryPoint[]>([]);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
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

    // Only append to real-time trend history if telemetry has valid readings
    if (payload.heartRate > 0 || payload.spo2 > 0) {
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
    }
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
