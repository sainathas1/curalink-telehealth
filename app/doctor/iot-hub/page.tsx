'use client';

import React from 'react';
import { useTelehealth } from '../../../context/TelehealthContext';
import { MultiPatientMonitor } from '../../../components/doctor/MultiPatientMonitor';

export default function DoctorIoTHubRoute() {
  const {
    patientDirectory,
    telemetry,
    openVideoCall,
    openEHR,
    openSimulator,
    openESP32Guide,
  } = useTelehealth();

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            IoT Biomedical Telemetry Command Center
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Manage deployed ESP32/ESP8266 remote wearable nodes, test physiological anomaly alarms, and inspect firmware
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openSimulator}
            className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
          >
            Launch Sensor Simulator
          </button>
          <button
            onClick={openESP32Guide}
            className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md shadow-teal-600/20 transition-all cursor-pointer"
          >
            Inspect ESP32 C++ Code
          </button>
        </div>
      </div>

      <MultiPatientMonitor
        patients={patientDirectory}
        liveTelemetry={telemetry}
        onStartVideoCall={openVideoCall}
        onOpenEHR={openEHR}
        onOpenSimulator={openSimulator}
      />
    </div>
  );
}
