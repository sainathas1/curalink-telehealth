'use client';

import React, { useState } from 'react';
import { MedicalRecord } from '../../lib/types';
import {
  FileText,
  Download,
  Calendar,
  Building,
  Upload,
  CheckCircle2,
  Eye,
  X,
  FileCheck,
} from 'lucide-react';

interface MedicalRecordsListProps {
  records: MedicalRecord[];
  onUploadRecord: (record: MedicalRecord) => void;
  patientName: string;
  patientId?: string;
}

export function MedicalRecordsList({
  records,
  onUploadRecord,
  patientName,
  patientId,
}: MedicalRecordsListProps) {
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecord | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<MedicalRecord['type']>('Lab Report');
  const [newFacility, setNewFacility] = useState('CuraLink Diagnostics');
  const [newSummary, setNewSummary] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newRec: MedicalRecord = {
      id: `rec_${Date.now()}`,
      patientId: patientId || 'patient_user',
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      type: newType,
      title: newTitle || 'Lab Diagnostics Report',
      doctorName: 'Attending Physician',
      facility: newFacility,
      fileSize: '1.8 MB (PDF)',
      summary: newSummary || 'Patient-uploaded diagnostics summary for doctor evaluation.',
    };

    setUploadSuccess(true);
    setTimeout(() => {
      onUploadRecord(newRec);
      setUploadSuccess(false);
      setIsUploadOpen(false);
      setNewTitle('');
      setNewSummary('');
    }, 1000);
  };

  return (
    <div className="space-y-5 max-w-4xl mx-auto pb-6">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
              EHR Diagnostics
            </span>
            <span className="text-[11px] text-slate-500 font-medium">HIPAA Encrypted</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight mt-1">
            Medical Records & Diagnostics
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Access, view, and share clinical lab reports, imaging readings, and summaries
          </p>
        </div>

        <button
          onClick={() => setIsUploadOpen(true)}
          className="px-5 py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md shadow-teal-600/20 transition-all m3-pressable cursor-pointer flex items-center justify-center gap-2 self-start sm:self-auto w-full sm:w-auto"
        >
          <Upload className="w-4 h-4" />
          <span>Upload Lab Document</span>
        </button>
      </div>

      {/* Record Cards or Empty State */}
      {records.length === 0 ? (
        <div className="py-12 px-6 rounded-3xl bg-white border border-slate-200/80 flex flex-col items-center justify-center text-center shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mb-3">
            <FileText className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-semibold text-slate-800 mb-1">
            No records found
          </h4>
          <p className="text-xs text-slate-500 max-w-sm mb-4">
            You don&apos;t have any uploaded medical records or lab reports yet. You can upload diagnostic PDFs or pathology reports anytime.
          </p>
          <button
            onClick={() => setIsUploadOpen(true)}
            className="px-4 py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-medium text-xs shadow-xs transition-all m3-pressable flex items-center gap-1.5 cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Upload First Document</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {records.map((rec) => (
            <div
              key={rec.id}
              className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between gap-3.5"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase bg-teal-50 text-teal-700 border border-teal-200/60">
                    {rec.type}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">{rec.date}</span>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-900 leading-snug">{rec.title}</h3>
                  <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-1">
                    <Building className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                    <span className="truncate">{rec.facility}</span>
                  </p>
                </div>

                <p className="text-xs text-slate-600 line-clamp-2 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  {rec.summary}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-400 font-mono">{rec.fileSize}</span>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setSelectedRecord(rec)}
                    className="p-2 rounded-xl text-slate-600 hover:text-teal-700 hover:bg-teal-50 transition-colors m3-pressable cursor-pointer"
                    title="View Details"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <a
                    href={`#download-${rec.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      alert(`Downloading verified clinical document: ${rec.title}`);
                    }}
                    className="p-2 rounded-xl text-slate-600 hover:text-teal-700 hover:bg-teal-50 transition-colors m3-pressable cursor-pointer"
                    title="Download PDF"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Record Detail Modal with Rounded Corners */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-teal-400" />
                <span className="text-sm font-bold">Diagnostic Document Preview</span>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors m3-pressable cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-teal-50 text-teal-700 border border-teal-200">
                  {selectedRecord.type}
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-2">{selectedRecord.title}</h3>
                <p className="text-slate-500 mt-0.5">{selectedRecord.facility} • {selectedRecord.date}</p>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
                <p className="font-bold text-slate-800">Diagnostic Findings Summary</p>
                <p className="text-slate-600 leading-relaxed">{selectedRecord.summary}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-slate-600">
                <div className="p-3 rounded-2xl border border-slate-100 bg-slate-50">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Signed Clinician</p>
                  <p className="font-semibold text-slate-800 mt-0.5">{selectedRecord.doctorName}</p>
                </div>
                <div className="p-3 rounded-2xl border border-slate-100 bg-slate-50">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Document Size</p>
                  <p className="font-semibold text-slate-800 mt-0.5">{selectedRecord.fileSize}</p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  onClick={() => setSelectedRecord(null)}
                  className="px-4 py-2 rounded-2xl text-slate-600 hover:bg-slate-100 font-bold m3-pressable cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    alert(`Downloading ${selectedRecord.title}...`);
                    setSelectedRecord(null);
                  }}
                  className="px-4 py-2 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold flex items-center gap-1.5 shadow-sm transition-all m3-pressable cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Verified PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Document Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-teal-400" />
                <span className="text-sm font-bold">Upload Medical Document</span>
              </div>
              <button
                onClick={() => setIsUploadOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors m3-pressable cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {uploadSuccess ? (
              <div className="p-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto animate-bounce">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="text-base font-bold text-slate-900">Record Uploaded Successfully</h4>
                <p className="text-xs text-slate-500">
                  Your document has been securely encrypted and shared with your care team.
                </p>
              </div>
            ) : (
              <form onSubmit={handleUploadSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Document Title
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Complete Metabolic Panel, ECG Strip"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Record Type
                    </label>
                    <select
                      value={newType}
                      onChange={(e) => setNewType(e.target.value as any)}
                      className="w-full px-3 py-2.5 rounded-2xl border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                    >
                      <option value="Lab Report">Lab Report</option>
                      <option value="Imaging">Imaging / X-Ray</option>
                      <option value="Prescription">Prescription</option>
                      <option value="Clinical Summary">Clinical Summary</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Facility / Lab
                    </label>
                    <input
                      type="text"
                      required
                      value={newFacility}
                      onChange={(e) => setNewFacility(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Clinical Summary / Notes
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Brief findings, notes from doctor, or purpose of test..."
                    value={newSummary}
                    onChange={(e) => setNewSummary(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div className="border border-dashed border-slate-300 rounded-2xl p-4 text-center bg-slate-50 space-y-1">
                  <Upload className="w-5 h-5 text-teal-600 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">Attach Document (PDF, PNG)</p>
                  <p className="text-[10px] text-slate-400">Files up to 25MB automatically encrypted</p>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsUploadOpen(false)}
                    className="px-4 py-2 rounded-2xl text-slate-600 hover:bg-slate-100 font-bold text-xs m3-pressable cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md shadow-teal-600/20 transition-all m3-pressable cursor-pointer"
                  >
                    Save & Upload
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
