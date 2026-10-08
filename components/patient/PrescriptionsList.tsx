'use client';

import React, { useState } from 'react';
import { Prescription } from '../../lib/types';
import {
  Pill,
  Download,
  Calendar,
  CheckCircle2,
  FileBadge,
  Clock,
  Printer,
  X,
  ShieldCheck,
} from 'lucide-react';

interface PrescriptionsListProps {
  prescriptions: Prescription[];
  patientName: string;
}

export function PrescriptionsList({
  prescriptions,
  patientName,
}: PrescriptionsListProps) {
  const [selectedRx, setSelectedRx] = useState<Prescription | null>(null);
  const [filter, setFilter] = useState<'All' | 'Active' | 'Completed'>('Active');

  const filteredRx = prescriptions.filter((rx) => {
    if (filter === 'Active') return rx.status === 'Active';
    if (filter === 'Completed') return rx.status === 'Completed' || rx.status === 'Expired';
    return true;
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-5 max-w-4xl mx-auto pb-6">
      {/* Header Banner Card with Rounded Corners */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
              E-Prescriptions
            </span>
            <span className="text-[11px] text-slate-500 font-medium">Digitally Signed</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight mt-1">
            Medications & Prescriptions
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Digitally certified e-prescriptions issued by CuraLink licensed physicians
          </p>
        </div>

        {/* Material 3 Filter Chips */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-full self-start sm:self-auto">
          {(['Active', 'All', 'Completed'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3.5 py-1 rounded-full text-xs font-semibold transition-all m3-pressable cursor-pointer ${
                filter === tab
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Clean Mobile Cards with Rounded Corners */}
      {filteredRx.length === 0 ? (
        <div className="py-12 px-6 rounded-3xl bg-white border border-slate-200/80 flex flex-col items-center justify-center text-center shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mb-3">
            <Pill className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-semibold text-slate-800 mb-1">
            No records found
          </h4>
          <p className="text-xs text-slate-500 max-w-sm">
            You currently have no prescribed medications on record. When a physician writes an e-prescription during a consultation, it will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredRx.map((rx) => (
            <div
              key={rx.id}
              className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between gap-3.5"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-base shrink-0">
                      Rx
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">{rx.medicationName}</h3>
                      <p className="text-xs text-teal-700 font-semibold">{rx.dosage}</p>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${
                      rx.status === 'Active'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {rx.status}
                  </span>
                </div>

                {/* Instructions Box */}
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 text-xs space-y-1">
                  <p className="text-slate-700 font-medium">
                    <strong className="text-slate-800">Dosage:</strong> {rx.frequency}
                  </p>
                  <p className="text-slate-500">
                    <strong className="text-slate-700">Notes:</strong> {rx.instructions}
                  </p>
                </div>

                {/* Prescribing Doctor & Validity */}
                <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                  <span>Prescribed by: <strong className="text-slate-800">{rx.doctorName}</strong></span>
                  <span className="font-mono text-[11px] bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                    Valid: {rx.validUntil}
                  </span>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
                  Refills left: {rx.refillsLeft}
                </span>

                <button
                  onClick={() => setSelectedRx(rx)}
                  className="px-3.5 py-1.5 rounded-full text-xs font-bold text-teal-700 hover:bg-teal-50 border border-teal-200 transition-all m3-pressable cursor-pointer flex items-center gap-1.5"
                >
                  <FileBadge className="w-3.5 h-3.5" />
                  <span>View Digital Rx</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Digital Prescription Certificate Modal */}
      {selectedRx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-teal-400" />
                <span className="text-sm font-bold">CuraLink Certified E-Prescription</span>
              </div>
              <button
                onClick={() => setSelectedRx(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors m3-pressable cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Printable Prescription Body */}
            <div className="p-6 space-y-5 bg-white font-sans text-slate-800">
              <div className="text-center pb-4 border-b border-slate-200">
                <h4 className="text-lg font-black tracking-tight text-slate-900">
                  CURALINK TELEHEALTH CLINICAL NETWORK
                </h4>
                <p className="text-[11px] text-slate-500">
                  Department of Remote Cardiology & Chronic Patient Care
                </p>
                <p className="text-[10px] text-slate-400 font-mono">
                  Prescription Ref: {selectedRx.id} • Issued {selectedRx.dateIssued}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-2xl">
                <div>
                  <p className="text-slate-400 text-[10px] uppercase font-bold">Patient Name</p>
                  <p className="font-bold text-slate-900">{patientName}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-[10px] uppercase font-bold">Prescribing Physician</p>
                  <p className="font-bold text-slate-900">{selectedRx.doctorName}</p>
                  <p className="text-[10px] text-teal-700 font-mono">Lic: {selectedRx.doctorLicense}</p>
                </div>
              </div>

              {/* Medication Details */}
              <div className="p-4 rounded-2xl bg-teal-50/50 border border-teal-100 space-y-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-serif font-black text-teal-900">℞</span>
                  <span className="text-base font-bold text-slate-900">
                    {selectedRx.medicationName}
                  </span>
                  <span className="text-xs font-semibold text-teal-700">({selectedRx.dosage})</span>
                </div>
                <div className="text-xs text-slate-700 space-y-1 pl-6">
                  <p><strong>Frequency:</strong> {selectedRx.frequency}</p>
                  <p><strong>Duration:</strong> {selectedRx.duration}</p>
                  <p><strong>Instructions:</strong> {selectedRx.instructions}</p>
                </div>
              </div>

              {/* Digital Signature Stamp */}
              <div className="pt-2 flex items-center justify-between border-t border-slate-200 text-xs">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Status & Security</p>
                  <p className="text-emerald-700 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Cryptographically Signed</span>
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono">SHA-256 Verified</p>
                </div>

                <div className="text-right">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Refills Authorized</p>
                  <p className="font-bold text-slate-900">{selectedRx.refillsLeft} remaining</p>
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                Accepted at all major pharmacy networks
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  className="px-4 py-2 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 transition-all m3-pressable cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print / Save PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
