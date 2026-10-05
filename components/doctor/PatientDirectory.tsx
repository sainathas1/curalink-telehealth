'use client';

import React, { useState } from 'react';
import { PatientDirectoryItem } from '../../lib/types';
import {
  Users,
  Search,
  Video,
  FileText,
  Activity,
  Droplet,
  AlertTriangle,
  Pill,
  ClipboardList,
  CheckCircle2,
  Clock,
  X,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react';

interface PatientDirectoryProps {
  patients: PatientDirectoryItem[];
  onStartVideoCall: (patientName: string) => void;
  onOpenEHR: (patientName: string) => void;
}

export function PatientDirectory({
  patients,
  onStartVideoCall,
  onOpenEHR,
}: PatientDirectoryProps) {
  const [search, setSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<PatientDirectoryItem | null>(null);

  const filtered = patients.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.condition.toLowerCase().includes(search.toLowerCase()) ||
      p.assignedDoctor.toLowerCase().includes(search.toLowerCase()) ||
      (p.bloodGroup && p.bloodGroup.toLowerCase().includes(search.toLowerCase())) ||
      (p.knownAllergies && p.knownAllergies.toLowerCase().includes(search.toLowerCase())) ||
      (p.chronicConditions && p.chronicConditions.some((c) => c.toLowerCase().includes(search.toLowerCase())))
  );

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Assigned Patient Directory
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Comprehensive roster of active remote monitoring patients, baseline telemetry & verified medical histories
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search name, blood group, allergies, condition..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-teal-500 bg-slate-50"
          />
        </div>
      </div>

      {/* Directory Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-500 uppercase font-bold text-[10px] tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Patient Details</th>
                <th className="px-5 py-3.5">Medical History & Baseline</th>
                <th className="px-5 py-3.5">Intake Status</th>
                <th className="px-5 py-3.5">Current Vitals</th>
                <th className="px-5 py-3.5">Last Consultation</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mb-3">
                        <Users className="w-6 h-6" />
                      </div>
                      <h4 className="text-sm font-semibold text-slate-800 mb-1">
                        No patients found
                      </h4>
                      <p className="text-xs text-slate-400 max-w-sm">
                        {search ? `No patient profiles match "${search}".` : 'There are currently no registered patient records in the directory.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((pt) => {
                  const hasAllergies = pt.knownAllergies && pt.knownAllergies.toLowerCase() !== 'none' && pt.knownAllergies.toLowerCase() !== 'none reported';
                  const chronicList = pt.chronicConditions && pt.chronicConditions.length > 0 ? pt.chronicConditions.filter(c => c !== 'None') : [];

                  return (
                    <tr
                      key={pt.id}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      onClick={() => setSelectedPatient(pt)}
                    >
                      {/* Patient Details */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-800 font-bold flex items-center justify-center shrink-0 border border-teal-100">
                            {pt.name
                              .split(' ')
                              .map((n) => n[0])
                              .join('')}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="font-bold text-slate-900 group-hover:text-teal-700 transition-colors">{pt.name}</p>
                              {pt.bloodGroup && pt.bloodGroup !== 'Not specified' && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold font-mono">
                                  <Droplet className="w-2.5 h-2.5 fill-rose-500 text-rose-500" />
                                  {pt.bloodGroup}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400">
                              {pt.age} yrs • {pt.gender} • {pt.roomOrBed}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Medical History & Baseline */}
                      <td className="px-5 py-4 text-slate-700">
                        <div className="space-y-1 max-w-xs">
                          {/* Chronic Conditions */}
                          <div className="flex flex-wrap items-center gap-1">
                            {chronicList.length > 0 ? (
                              chronicList.map((cond) => (
                                <span
                                  key={cond}
                                  className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200 text-[10px] font-semibold"
                                >
                                  {cond}
                                </span>
                              ))
                            ) : (
                              <span className="text-[11px] text-slate-500">No chronic illnesses</span>
                            )}
                          </div>

                          {/* Allergies Notice */}
                          {hasAllergies ? (
                            <div className="flex items-center gap-1 text-[10px] text-amber-700 font-semibold">
                              <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                              <span className="truncate" title={pt.knownAllergies}>
                                Allergy: {pt.knownAllergies}
                              </span>
                            </div>
                          ) : (
                            <p className="text-[10px] text-slate-400">No known drug allergies</p>
                          )}
                        </div>
                      </td>

                      {/* Intake / Onboarding Status */}
                      <td className="px-5 py-4">
                        {pt.hasCompletedOnboarding ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Intake Verified</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>Pending Intake</span>
                          </span>
                        )}
                      </td>

                      {/* Current Vitals */}
                      <td className="px-5 py-4 font-mono text-[11px] text-slate-700">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{pt.currentVitals.heartRate} BPM</span>
                          <span>•</span>
                          <span>{pt.currentVitals.spo2}%</span>
                          <span>•</span>
                          <span>{pt.currentVitals.bloodPressure}</span>
                        </div>
                      </td>

                      {/* Last Consultation */}
                      <td className="px-5 py-4 text-slate-500">
                        <p>{pt.lastVisit}</p>
                        <p className="text-[11px] text-teal-600 font-semibold">{pt.nextAppointment}</p>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setSelectedPatient(pt)}
                            className="p-2 rounded-xl text-teal-700 hover:bg-teal-50 border border-teal-200 transition-all cursor-pointer"
                            title="View Complete Medical History"
                          >
                            <ClipboardList className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => onOpenEHR(pt.name)}
                            className="p-2 rounded-xl text-slate-600 hover:text-teal-700 hover:bg-teal-50 border border-slate-200 transition-all cursor-pointer"
                            title="Open EHR & Write Prescription"
                          >
                            <FileText className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => onStartVideoCall(pt.name)}
                            className="p-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white shadow-xs transition-all cursor-pointer"
                            title="Start Telehealth Video Consultation"
                          >
                            <Video className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Patient Medical History Inspection Modal */}
      {selectedPatient && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setSelectedPatient(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 text-white p-6 relative">
              <button
                onClick={() => setSelectedPatient(null)}
                className="absolute right-4 top-4 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-400/30">
                  Clinical Intake Record
                </span>
                {selectedPatient.hasCompletedOnboarding ? (
                  <span className="text-[10px] font-semibold text-emerald-300 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    Onboarding Complete
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold text-amber-300 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-400" />
                    Pending Patient Intake
                  </span>
                )}
              </div>

              <h3 className="text-xl font-black tracking-tight">{selectedPatient.name}</h3>
              <p className="text-xs text-slate-300 mt-0.5">
                {selectedPatient.age} yrs • {selectedPatient.gender} • {selectedPatient.roomOrBed}
              </p>
            </div>

            {/* Medical Data Details */}
            <div className="p-6 space-y-5 text-xs text-slate-700">
              {/* Blood Group */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-rose-50/60 border border-rose-200/80">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600 font-bold">
                    <Droplet className="w-4 h-4 fill-rose-600" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-xs">Blood Group / Type</p>
                    <p className="text-[11px] text-slate-500">Clinical cross-matching baseline</p>
                  </div>
                </div>
                <span className="text-base font-black font-mono text-rose-700 bg-white px-3 py-1 rounded-xl border border-rose-200 shadow-xs">
                  {selectedPatient.bloodGroup || 'Not Reported'}
                </span>
              </div>

              {/* Known Allergies */}
              <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 space-y-1.5">
                <div className="flex items-center gap-2 text-amber-800 font-bold">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Known Drug & Environmental Allergies</span>
                </div>
                <p className="text-xs text-slate-800 bg-white p-3 rounded-xl border border-amber-200/60 font-medium">
                  {selectedPatient.knownAllergies || 'None reported by patient.'}
                </p>
              </div>

              {/* Chronic Conditions */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center gap-2 text-slate-800 font-bold">
                  <Activity className="w-4 h-4 text-teal-600" />
                  <span>Diagnosed Chronic Conditions</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedPatient.chronicConditions && selectedPatient.chronicConditions.length > 0 ? (
                    selectedPatient.chronicConditions.map((cond) => (
                      <span
                        key={cond}
                        className={`px-3 py-1 rounded-xl text-xs font-bold border ${
                          cond === 'None'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-teal-50 text-teal-800 border-teal-200'
                        }`}
                      >
                        {cond}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-500">None reported</span>
                  )}
                </div>
              </div>

              {/* Current Medications */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="flex items-center gap-2 text-slate-800 font-bold">
                  <Pill className="w-4 h-4 text-teal-600" />
                  <span>Current Medications & Dosages</span>
                </div>
                <p className="text-xs text-slate-800 bg-white p-3 rounded-xl border border-slate-200 font-mono whitespace-pre-wrap">
                  {selectedPatient.currentMedications || 'None currently prescribed or reported.'}
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                onClick={() => {
                  const ptName = selectedPatient.name;
                  setSelectedPatient(null);
                  onOpenEHR(ptName);
                }}
                className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <FileText className="w-4 h-4 text-teal-600" />
                <span>Issue Prescription</span>
              </button>

              <button
                onClick={() => {
                  const ptName = selectedPatient.name;
                  setSelectedPatient(null);
                  onStartVideoCall(ptName);
                }}
                className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Video className="w-4 h-4" />
                <span>Start Video Call</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
