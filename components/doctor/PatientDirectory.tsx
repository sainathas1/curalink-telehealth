'use client';

import React, { useState } from 'react';
import { PatientDirectoryItem } from '../../lib/types';
import {
  Users,
  Search,
  Filter,
  Video,
  FileText,
  UserCheck,
  Phone,
  Calendar,
  Activity,
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
      p.assignedDoctor.toLowerCase().includes(search.toLowerCase())
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
            Comprehensive roster of active remote monitoring patients & clinical histories
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by patient name, condition..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-teal-500 bg-slate-50"
          />
        </div>
      </div>

      {/* Directory Table / Cards */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-500 uppercase font-bold text-[10px] tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Patient Details</th>
                <th className="px-5 py-3.5">Clinical Condition</th>
                <th className="px-5 py-3.5">Ward Status</th>
                <th className="px-5 py-3.5">Current Vitals</th>
                <th className="px-5 py-3.5">Last Consultation</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filtered.map((pt) => (
                <tr
                  key={pt.id}
                  className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                  onClick={() => setSelectedPatient(pt)}
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-800 font-bold flex items-center justify-center shrink-0 border border-teal-100">
                        {pt.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{pt.name}</p>
                        <p className="text-[11px] text-slate-400">
                          {pt.age} yrs • {pt.gender} • {pt.roomOrBed}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="px-5 py-4 text-slate-700">
                    <p className="font-semibold">{pt.condition}</p>
                    <p className="text-[11px] text-slate-400">Attending: {pt.assignedDoctor.split(',')[0]}</p>
                  </td>

                  <td className="px-5 py-4">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        pt.status === 'Critical'
                          ? 'bg-rose-100 text-rose-800 border border-rose-300 animate-pulse'
                          : pt.status === 'Monitored'
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      }`}
                    >
                      {pt.status}
                    </span>
                  </td>

                  <td className="px-5 py-4 font-mono text-[11px] text-slate-700">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{pt.currentVitals.heartRate} BPM</span>
                      <span>•</span>
                      <span>{pt.currentVitals.spo2}%</span>
                      <span>•</span>
                      <span>{pt.currentVitals.bloodPressure}</span>
                    </div>
                  </td>

                  <td className="px-5 py-4 text-slate-500">
                    <p>{pt.lastVisit}</p>
                    <p className="text-[11px] text-teal-600 font-semibold">{pt.nextAppointment}</p>
                  </td>

                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
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
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
