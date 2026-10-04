'use client';

import React, { useState } from 'react';
import { Prescription } from '../../lib/types';
import {
  X,
  Stethoscope,
  Pill,
  ShieldCheck,
  CheckCircle2,
  FileCheck,
  Calendar,
} from 'lucide-react';

interface EHRPrescriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onIssuePrescription: (prescription: Prescription) => void;
  defaultPatientName?: string;
  defaultPatientId?: string;
  doctorName?: string;
  doctorLicense?: string;
}

export function EHRPrescriptionModal({
  isOpen,
  onClose,
  onIssuePrescription,
  defaultPatientName = 'Sarah Jenkins',
  defaultPatientId = 'patient_sarah_jenkins_01',
  doctorName = 'Dr. Marcus Vance, MD',
  doctorLicense = 'MD-CA-9938210',
}: EHRPrescriptionModalProps) {
  const [patientName, setPatientName] = useState(defaultPatientName);
  const [diagnosis, setDiagnosis] = useState('Essential Primary Hypertension (I10)');
  const [medicationName, setMedicationName] = useState('Lisinopril-Hydrochlorothiazide');
  const [dosage, setDosage] = useState('20 mg / 12.5 mg Oral Tablet');
  const [frequency, setFrequency] = useState('Once daily in the morning');
  const [duration, setDuration] = useState('90 Days');
  const [refills, setRefills] = useState<number>(3);
  const [instructions, setInstructions] = useState('Take with full glass of water. Monitor resting BP via IoT wearable.');
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newRx: Prescription = {
      id: `rx_${Date.now()}`,
      patientId: defaultPatientId,
      patientName,
      doctorId: 'doc_marcus_vance_01',
      doctorName,
      doctorLicense,
      medicationName,
      dosage,
      frequency,
      duration,
      instructions,
      dateIssued: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      validUntil: 'Jan 04, 2027',
      refillsLeft: refills,
      status: 'Active',
    };

    setIsSuccess(true);
    setTimeout(() => {
      onIssuePrescription(newRx);
      setIsSuccess(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-800 to-slate-900 text-white p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold">EHR Clinical Consultation & Prescription</h3>
              <p className="text-xs text-teal-200">Electronic Health Record & Cryptographic Digital Rx</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isSuccess ? (
          <div className="p-10 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto animate-bounce">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="text-xl font-bold text-slate-900">E-Prescription Certified & Transmitted</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Prescription for <strong className="text-slate-800">{medicationName}</strong> has been signed by {doctorName} and securely saved to {patientName}&apos;s medical record.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5 text-xs">
            {/* Patient & Diagnosis Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Patient Name
                </label>
                <input
                  type="text"
                  required
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-semibold text-slate-800 focus:outline-none focus:border-teal-500 bg-slate-50/50"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Clinical Diagnosis (ICD-10)
                </label>
                <input
                  type="text"
                  required
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-semibold text-slate-800 focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            {/* Medication Details */}
            <div className="p-4 rounded-2xl bg-teal-50/50 border border-teal-100 space-y-3">
              <div className="flex items-center gap-2 text-teal-800 font-bold">
                <Pill className="w-4 h-4" />
                <span>Medication Specification</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                    Medication Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Atorvastatin Calcium"
                    value={medicationName}
                    onChange={(e) => setMedicationName(e.target.value)}
                    className="w-full p-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                    Dosage & Strength
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 20 mg Oral Tablet"
                    value={dosage}
                    onChange={(e) => setDosage(e.target.value)}
                    className="w-full p-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                    Frequency
                  </label>
                  <input
                    type="text"
                    required
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                    className="w-full p-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                    Duration
                  </label>
                  <input
                    type="text"
                    required
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="w-full p-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                    Refills Authorized
                  </label>
                  <select
                    value={refills}
                    onChange={(e) => setRefills(Number(e.target.value))}
                    className="w-full p-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-teal-500"
                  >
                    <option value={0}>0 (No Refills)</option>
                    <option value={1}>1 Refill</option>
                    <option value={2}>2 Refills</option>
                    <option value={3}>3 Refills</option>
                    <option value={5}>5 Refills</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                  Pharmacy & Patient Instructions
                </label>
                <textarea
                  rows={2}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Instructions for consumption, diet restrictions, etc."
                  className="w-full p-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            {/* Physician Digital Stamp Preview */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between text-[11px] text-slate-600">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>
                  Signing Physician: <strong className="text-slate-800">{doctorName}</strong> ({doctorLicense})
                </span>
              </div>
              <span className="text-teal-700 font-bold">SHA-256 Enabled</span>
            </div>

            {/* Footer Buttons */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold shadow-md shadow-teal-600/20 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <FileCheck className="w-4 h-4" />
                <span>Digitally Sign & Issue Rx</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
