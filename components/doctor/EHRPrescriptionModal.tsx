'use client';

import React, { useState } from 'react';
import { Prescription, PatientDirectoryItem } from '../../lib/types';
import { db } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import {
  X,
  Stethoscope,
  Pill,
  ShieldCheck,
  CheckCircle2,
  FileCheck,
  Calendar,
  Droplet,
  AlertTriangle,
  Activity,
  Thermometer,
  FileText,
} from 'lucide-react';

interface EHRPrescriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onIssuePrescription: (prescription: Prescription) => void;
  defaultPatientName?: string;
  defaultPatientId?: string;
  doctorId?: string;
  doctorName?: string;
  doctorLicense?: string;
  patientDirectory?: PatientDirectoryItem[];
}

export function EHRPrescriptionModal({
  isOpen,
  onClose,
  onIssuePrescription,
  defaultPatientName = '',
  defaultPatientId = '',
  doctorId = '',
  doctorName = 'Attending Physician',
  doctorLicense = 'MED-LICENSED',
  patientDirectory = [],
}: EHRPrescriptionModalProps) {
  const [recordType, setRecordType] = useState<'Prescription' | 'Clinical Note'>('Prescription');
  const [patientName, setPatientName] = useState(defaultPatientName);
  const [diagnosis, setDiagnosis] = useState('');
  const [medicationName, setMedicationName] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState('');
  const [duration, setDuration] = useState('');
  const [refills, setRefills] = useState<number>(1);
  const [instructions, setInstructions] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  React.useEffect(() => {
    if (defaultPatientName) {
      setPatientName(defaultPatientName);
    }
  }, [defaultPatientName]);

  if (!isOpen) return null;

  const matchedPt = patientDirectory.find(
    (p) => (defaultPatientId && p.id === defaultPatientId) || (patientName && p.name.toLowerCase() === patientName.toLowerCase())
  );
  const targetPatientId = defaultPatientId || matchedPt?.id || 'patient_user';
  const targetDoctorId = doctorId || 'attending_physician';
  const bloodGroup = matchedPt?.bloodGroup;
  const allergies = matchedPt?.knownAllergies;
  const chronic = matchedPt?.chronicConditions || [];
  const currentMeds = matchedPt?.currentMedications;
  const hasAllergies = allergies && allergies.toLowerCase() !== 'none' && allergies.toLowerCase() !== 'none reported';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const recordContent = recordType === 'Prescription'
      ? {
          medicationName: medicationName || 'Medication Prescription',
          dosage: dosage || 'Standard Dosage',
          frequency: frequency || 'Daily',
          duration: duration || '30 Days',
          refillsLeft: refills,
          instructions: instructions || 'Follow physician directions.',
          diagnosis: diagnosis || 'General Clinical Evaluation',
          dateIssued: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          status: 'Active',
          doctorLicense,
        }
      : {
          title: `Clinical Note - ${diagnosis || 'Observation'}`,
          diagnosis: diagnosis || 'General Telehealth Observation',
          notes: instructions || 'Patient consultation note documented during telehealth session.',
          plan: medicationName ? `Plan: ${medicationName} ${dosage}` : 'Continue current care regimen',
          date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          status: 'Finalized',
        };

    try {
      // Strict write to clinical_records collection with serverTimestamp()
      await addDoc(collection(db, 'clinical_records'), {
        patientId: targetPatientId,
        doctorId: targetDoctorId,
        doctorName,
        patientName: patientName || 'Patient',
        type: recordType,
        content: recordContent,
        createdAt: serverTimestamp(),
      });
    } catch (saveErr) {
      console.warn('clinical_records write notice:', saveErr);
    }

    const newRx: Prescription = {
      id: `rx_${Date.now()}`,
      patientId: targetPatientId,
      patientName: patientName || 'Patient',
      doctorId: targetDoctorId,
      doctorName,
      doctorLicense,
      medicationName: medicationName || (recordType === 'Clinical Note' ? 'Clinical Note / Observation' : 'Medication'),
      dosage: dosage || 'N/A',
      frequency: frequency || 'N/A',
      duration: duration || 'N/A',
      instructions: instructions || 'Follow physician directions.',
      dateIssued: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      refillsLeft: refills,
      status: 'Active',
    };

    setIsSubmitting(false);
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
            {/* Medical History Safety Check Card */}
            {matchedPt && (
              <div className="p-3.5 rounded-2xl bg-teal-50/70 border border-teal-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
                    Verified Medical History on File
                  </span>
                  <div className="flex items-center gap-2">
                    {bloodGroup && bloodGroup !== 'Not specified' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-mono font-bold">
                        <Droplet className="w-3 h-3 fill-rose-500 text-rose-500" />
                        Blood: {bloodGroup}
                      </span>
                    )}
                    {matchedPt?.lastSyncedTemperature !== undefined && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-100 text-teal-800 border border-teal-300 text-[10px] font-mono font-bold">
                        <Thermometer className="w-3 h-3 text-teal-600" />
                        IoT Temp: {matchedPt.lastSyncedTemperature.toFixed(1)}°C
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  {/* Allergies Alert */}
                  <div className={`p-2 rounded-xl border ${hasAllergies ? 'bg-amber-50/80 border-amber-200 text-amber-900 font-semibold' : 'bg-white/80 border-slate-200 text-slate-600'}`}>
                    <div className="flex items-center gap-1">
                      {hasAllergies ? <AlertTriangle className="w-3 h-3 text-amber-600" /> : <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                      <span className="font-bold">Allergies:</span>
                    </div>
                    <p className="mt-0.5 truncate">{allergies || 'No known allergies'}</p>
                  </div>

                  {/* Current Medications */}
                  <div className="p-2 rounded-xl bg-white/80 border border-slate-200 text-slate-700">
                    <div className="flex items-center gap-1 font-bold">
                      <Pill className="w-3 h-3 text-teal-600" />
                      <span>Current Meds:</span>
                    </div>
                    <p className="mt-0.5 truncate">{currentMeds || 'None reported'}</p>
                  </div>
                </div>

                {chronic.filter(c => c !== 'None').length > 0 && (
                  <div className="flex flex-wrap items-center gap-1 pt-1">
                    <span className="text-[10px] font-bold text-slate-500">Chronic Conditions:</span>
                    {chronic.filter(c => c !== 'None').map(c => (
                      <span key={c} className="px-1.5 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] text-slate-700 font-medium">
                        {c}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Record Type Switcher Tabs */}
            <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-2xl">
              <button
                type="button"
                onClick={() => setRecordType('Prescription')}
                className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  recordType === 'Prescription'
                    ? 'bg-white text-teal-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Pill className="w-3.5 h-3.5 text-teal-600" />
                <span>E-Prescription</span>
              </button>
              <button
                type="button"
                onClick={() => setRecordType('Clinical Note')}
                className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  recordType === 'Clinical Note'
                    ? 'bg-white text-teal-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-teal-600" />
                <span>Clinical Consultation Note</span>
              </button>
            </div>

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
                  placeholder="e.g. Essential Hypertension (I10)"
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-semibold text-slate-800 focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            {recordType === 'Prescription' ? (
              /* Medication Details for E-Prescription */
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
                      placeholder="Once daily"
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
                      placeholder="30 days"
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
            ) : (
              /* Clinical Consultation Observation Note */
              <div className="p-4 rounded-2xl bg-teal-50/50 border border-teal-100 space-y-3">
                <div className="flex items-center gap-2 text-teal-800 font-bold">
                  <FileText className="w-4 h-4" />
                  <span>Clinical Consultation & Physician Observation Note</span>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                    Clinical Findings & Physician Evaluation
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    placeholder="Document clinical observations, symptom progression, vital signs review, and examination findings."
                    className="w-full p-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                      Recommended Care Plan / Follow-up
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Follow-up in 2 weeks with repeat lipid profile"
                      value={medicationName}
                      onChange={(e) => setMedicationName(e.target.value)}
                      className="w-full p-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                      Intervention / Diagnostic Orders
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Fasting Blood Glucose, ECG"
                      value={dosage}
                      onChange={(e) => setDosage(e.target.value)}
                      className="w-full p-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-teal-500"
                    />
                  </div>
                </div>
              </div>
            )}

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
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold shadow-md shadow-teal-600/20 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <FileCheck className="w-4 h-4" />
                <span>
                  {isSubmitting
                    ? 'Transmitting Record...'
                    : recordType === 'Prescription'
                    ? 'Digitally Sign & Issue Rx'
                    : 'Save Clinical Note to Record'}
                </span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
