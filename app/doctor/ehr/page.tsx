'use client';

import React from 'react';
import { useTelehealth } from '../../../context/TelehealthContext';
import { PrescriptionsList } from '../../../components/patient/PrescriptionsList';

export default function DoctorEHRRoute() {
  const { prescriptions, openEHR } = useTelehealth();

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Clinical EHR & E-Prescription Studio
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Author clinical observations, record differential diagnoses, and issue certified digital prescriptions
          </p>
        </div>
        <button
          onClick={() => openEHR('Sarah Jenkins')}
          className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md shadow-teal-600/20 transition-all cursor-pointer"
        >
          + Write New Prescription
        </button>
      </div>

      <PrescriptionsList
        prescriptions={prescriptions}
        patientName="Sarah Jenkins"
      />
    </div>
  );
}
