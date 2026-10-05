import { LiveTelemetryPayload, VitalStatus } from './types';
import { db, rtdb } from './firebase';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, onValue } from 'firebase/database';

export type SimulationMode = 'normal' | 'tachycardia' | 'hypoxia' | 'fever';

export const INITIAL_EMPTY_TELEMETRY: LiveTelemetryPayload = {
  deviceId: 'STANDBY-WAITING-FOR-STREAM',
  patientId: '',
  timestamp: 0,
  heartRate: 0,
  spo2: 0,
  temperature: 0,
  systolic: 0,
  diastolic: 0,
  batteryLevel: 0,
  sensorConnected: false,
  status: 'normal',
};

/**
 * Calculates physiological status based on clinical threshold guidelines:
 * - Heart Rate: Normal 60-100, Elevated 101-119 or 50-59, Critical >= 120 or < 50
 * - SpO2: Normal >= 95%, Elevated 92-94%, Critical < 92%
 * - Temperature: Normal 36.1 - 37.3°C, Elevated 37.4 - 38.2°C, Critical >= 38.3°C
 */
export function evaluateVitalStatus(hr: number, spo2: number, temp: number): {
  status: VitalStatus;
  alertMessage?: string;
} {
  // If sensor is disconnected or zeroed, return normal standby
  if (hr === 0 && spo2 === 0) {
    return { status: 'normal' };
  }

  const alerts: string[] = [];

  if (hr >= 120) alerts.push(`Severe Tachycardia detected: ${hr} BPM`);
  else if (hr < 50) alerts.push(`Severe Bradycardia detected: ${hr} BPM`);
  else if (hr > 100) alerts.push(`Elevated Heart Rate: ${hr} BPM`);

  if (spo2 < 92) alerts.push(`Critical Hypoxia: SpO2 ${spo2.toFixed(1)}%`);
  else if (spo2 < 95) alerts.push(`Low Oxygen Saturation: SpO2 ${spo2.toFixed(1)}%`);

  if (temp >= 38.3) alerts.push(`High Fever / Pyrexia: ${temp.toFixed(1)}°C`);
  else if (temp >= 37.5) alerts.push(`Mild Fever: ${temp.toFixed(1)}°C`);

  if (hr >= 120 || (hr > 0 && hr < 50) || (spo2 > 0 && spo2 < 92) || temp >= 38.3) {
    return { status: 'critical', alertMessage: alerts.join(' | ') };
  }
  if (hr > 100 || (hr > 0 && hr < 60) || (spo2 > 0 && spo2 < 95) || temp >= 37.5) {
    return { status: 'elevated', alertMessage: alerts.join(' | ') };
  }
  return { status: 'normal' };
}

/**
 * Plays a soft clinical alert tone using Web Audio API (pure browser synth)
 */
export function playAlertChime(critical: boolean = false) {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = critical ? 'sawtooth' : 'sine';
    osc.frequency.setValueAtTime(critical ? 880 : 587.33, ctx.currentTime); // A5 or D5
    if (critical) {
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.35);
    }

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (critical ? 0.4 : 0.25));

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + (critical ? 0.4 : 0.25));
  } catch {
    // Audio autoplay might be blocked until user interaction
  }
}

/**
 * Hardware Payload Listener:
 * Subscribes to Firestore `/telemetry/{patientId}` and Firebase Realtime Database
 * Supports physical ESP32/ESP8266 devices writing directly to either service.
 */
export function subscribeToFirebaseTelemetry(
  patientId: string,
  onData: (payload: LiveTelemetryPayload) => void
): () => void {
  const unsubscribers: (() => void)[] = [];

  // 1. Subscribe to Firestore
  try {
    const docRef = doc(db, 'telemetry', patientId);
    const unsubFirestore = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const raw = snapshot.data();
          const hr = Number(raw.heartRate || 0);
          const spo2 = Number(raw.spo2 || 0);
          const temp = Number(raw.temperature || 0);
          const evalResult = evaluateVitalStatus(hr, spo2, temp);

          onData({
            deviceId: String(raw.deviceId || 'ESP32-HARDWARE-FEED'),
            patientId,
            timestamp: raw.timestamp ? (raw.timestamp.toMillis ? raw.timestamp.toMillis() : Date.now()) : Date.now(),
            heartRate: hr,
            spo2,
            temperature: temp,
            systolic: Number(raw.systolic || 0),
            diastolic: Number(raw.diastolic || 0),
            batteryLevel: Number(raw.batteryLevel || 100),
            sensorConnected: true,
            status: evalResult.status,
            alertMessage: evalResult.alertMessage,
          });
        }
      },
      (error) => {
        console.warn('Firestore telemetry listener notice:', error.message);
      }
    );
    unsubscribers.push(unsubFirestore);
  } catch (err) {
    console.warn('Firestore telemetry subscription error:', err);
  }

  // 2. Subscribe to Firebase Realtime Database (rtdb)
  try {
    const rtdbRef = ref(rtdb, `telemetry/${patientId}`);
    const unsubRtdb = onValue(rtdbRef, (snapshot) => {
      if (snapshot.exists()) {
        const raw = snapshot.val();
        const hr = Number(raw.heartRate || 0);
        const spo2 = Number(raw.spo2 || 0);
        const temp = Number(raw.temperature || 0);
        const evalResult = evaluateVitalStatus(hr, spo2, temp);

        onData({
          deviceId: String(raw.deviceId || 'ESP32-RTDB-FEED'),
          patientId,
          timestamp: typeof raw.timestamp === 'number' ? raw.timestamp : Date.now(),
          heartRate: hr,
          spo2,
          temperature: temp,
          systolic: Number(raw.systolic || 0),
          diastolic: Number(raw.diastolic || 0),
          batteryLevel: Number(raw.batteryLevel || 100),
          sensorConnected: true,
          status: evalResult.status,
          alertMessage: evalResult.alertMessage,
        });
      }
    }, (error) => {
      console.warn('Realtime Database telemetry listener notice:', error.message);
    });

    unsubscribers.push(() => unsubRtdb());
  } catch (err) {
    console.warn('Realtime Database subscription error:', err);
  }

  return () => {
    unsubscribers.forEach((fn) => {
      try {
        fn();
      } catch {}
    });
  };
}

/**
 * Simulate live hardware stream (2-second interval)
 */
export function createHardwareStreamSimulator(
  patientId: string,
  mode: SimulationMode,
  onTick: (data: LiveTelemetryPayload) => void
): { stop: () => void; setMode: (m: SimulationMode) => void } {
  let currentMode = mode;
  let baseHr = 75;
  let baseSpo2 = 98.4;
  let baseTemp = 36.7;
  let battery = 96;

  const intervalId = setInterval(() => {
    // Drift simulation based on mode
    if (currentMode === 'tachycardia') {
      baseHr = Math.min(145, Math.max(122, baseHr + (Math.random() * 6 - 2.5)));
      baseSpo2 = Math.min(99, Math.max(94, baseSpo2 + (Math.random() * 0.4 - 0.2)));
      baseTemp = Math.min(37.6, Math.max(36.8, baseTemp + (Math.random() * 0.1 - 0.05)));
    } else if (currentMode === 'hypoxia') {
      baseHr = Math.min(108, Math.max(92, baseHr + (Math.random() * 4 - 2)));
      baseSpo2 = Math.min(91.8, Math.max(86.5, baseSpo2 + (Math.random() * 0.6 - 0.35)));
      baseTemp = Math.min(37.2, Math.max(36.5, baseTemp + (Math.random() * 0.1 - 0.05)));
    } else if (currentMode === 'fever') {
      baseHr = Math.min(115, Math.max(96, baseHr + (Math.random() * 4 - 2)));
      baseSpo2 = Math.min(98, Math.max(94, baseSpo2 + (Math.random() * 0.4 - 0.2)));
      baseTemp = Math.min(39.4, Math.max(38.4, baseTemp + (Math.random() * 0.15 - 0.05)));
    } else {
      // Normal drift
      baseHr = Math.min(84, Math.max(68, baseHr + (Math.random() * 3 - 1.5)));
      baseSpo2 = Math.min(99.6, Math.max(96.8, baseSpo2 + (Math.random() * 0.3 - 0.15)));
      baseTemp = Math.min(37.1, Math.max(36.4, baseTemp + (Math.random() * 0.08 - 0.04)));
    }

    battery = Math.max(15, battery - 0.01);
    const finalHr = Math.round(baseHr);
    const finalSpo2 = Number(baseSpo2.toFixed(1));
    const finalTemp = Number(baseTemp.toFixed(1));
    const evalResult = evaluateVitalStatus(finalHr, finalSpo2, finalTemp);

    const payload: LiveTelemetryPayload = {
      deviceId: 'ESP32-SIMULATOR-NODE-01',
      patientId,
      timestamp: Date.now(),
      heartRate: finalHr,
      spo2: finalSpo2,
      temperature: finalTemp,
      systolic: Math.round(118 + (finalHr - 70) * 0.3 + (Math.random() * 4 - 2)),
      diastolic: Math.round(78 + (finalHr - 70) * 0.15 + (Math.random() * 3 - 1.5)),
      batteryLevel: Math.round(battery),
      sensorConnected: true,
      status: evalResult.status,
      alertMessage: evalResult.alertMessage,
    };

    onTick(payload);
  }, 2000);

  return {
    stop: () => clearInterval(intervalId),
    setMode: (m: SimulationMode) => {
      currentMode = m;
    },
  };
}

/**
 * Pushes hardware payload to Firestore
 */
export async function pushHardwarePayload(payload: Partial<LiveTelemetryPayload> & { patientId: string }) {
  try {
    const docRef = doc(db, 'telemetry', payload.patientId);
    await setDoc(
      docRef,
      {
        ...payload,
        timestamp: serverTimestamp(),
      },
      { merge: true }
    );
    return true;
  } catch (error) {
    console.warn('Notice: pushHardwarePayload fallback to local stream:', error);
    return false;
  }
}
