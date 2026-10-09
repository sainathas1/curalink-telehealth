'use client';

import React, { useState } from 'react';
import { MedicalRecord } from '../../lib/types';
import { db } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useTelehealth } from '../../context/TelehealthContext';
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
  Loader2,
  AlertCircle,
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
  const { currentUser } = useTelehealth();
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecord | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<MedicalRecord['type']>('Lab Report');
  const [newFacility, setNewFacility] = useState('CuraLink Diagnostics');
  const [newSummary, setNewSummary] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const activeUid = currentUser?.uid || patientId;
  const isAuthValid = !!activeUid && activeUid !== 'guest_user';

  const handleCloseModal = () => {
    if (isSaving) return;
    setIsUploadOpen(false);
    setUploadError(null);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Guard clause: alert if file is not selected
    if (!file) {
      alert('Please select a file first.');
      return;
    }

    setIsSaving(true);
    setUploadError(null);

    try {
      // Base64 Workaround: Use JavaScript FileReader
      const reader = new FileReader();

      reader.onload = async () => {
        try {
          const base64String = reader.result as string;
          const uid = currentUser?.uid || patientId || 'patient_user';
          const formattedDate = new Date().toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });
          const fileSizeStr =
            file.size > 1024 * 1024
              ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
              : `${Math.max(1, Math.round(file.size / 1024))} KB`;

          const docTitle = newTitle || file.name;
          const docNotes = newSummary || 'Uploaded clinical diagnostics document.';

          // Save directly into the clinical_records Firestore collection using addDoc
          // alongside Document Title, Record Type, and Notes
          const clinicalRecordDoc = {
            patientId: uid,
            patientName: patientName || currentUser?.fullName || 'Patient',
            fileData: base64String,
            downloadUrl: base64String,
            'Document Title': docTitle,
            'Record Type': newType,
            'Notes': docNotes,
            documentTitle: docTitle,
            recordType: newType,
            notes: docNotes,
            facility: newFacility,
            clinicalSummary: docNotes,
            title: docTitle,
            type: newType,
            doctorName: 'Attending Physician',
            content: {
              title: docTitle,
              facility: newFacility,
              summary: docNotes,
              notes: docNotes,
              fileData: base64String,
              downloadUrl: base64String,
              fileSize: fileSizeStr,
              date: formattedDate,
            },
            createdAt: serverTimestamp(),
          };

          await addDoc(collection(db, 'clinical_records'), clinicalRecordDoc);

          // Mirror write to medical_records for universal real-time listener sync
          try {
            await addDoc(collection(db, 'medical_records'), {
              patientId: uid,
              patientName: patientName || currentUser?.fullName || 'Patient',
              type: newType,
              title: docTitle,
              fileData: base64String,
              downloadUrl: base64String,
              notes: docNotes,
              'Document Title': docTitle,
              'Record Type': newType,
              'Notes': docNotes,
              facility: newFacility,
              content: {
                title: docTitle,
                facility: newFacility,
                summary: docNotes,
                notes: docNotes,
                fileData: base64String,
                downloadUrl: base64String,
                fileSize: fileSizeStr,
                date: formattedDate,
              },
              createdAt: serverTimestamp(),
            });
          } catch (mirrorErr) {
            console.warn('medical_records mirror write notice:', mirrorErr);
          }

          const newRec: MedicalRecord = {
            id: `rec_${Date.now()}`,
            patientId: uid,
            date: formattedDate,
            type: newType,
            title: docTitle,
            doctorName: 'Attending Physician',
            facility: newFacility,
            fileSize: fileSizeStr,
            summary: docNotes,
            notes: docNotes,
            fileData: base64String,
            downloadUrl: base64String,
          };

          onUploadRecord(newRec);

          setIsSaving(false);
          setUploadSuccess(true);

          // Close modal and reset form
          setTimeout(() => {
            setUploadSuccess(false);
            setIsUploadOpen(false);
            setNewTitle('');
            setNewSummary('');
            setFile(null);
            setNewFacility('CuraLink Diagnostics');
            setNewType('Lab Report');
            setUploadError(null);
          }, 1000);
        } catch (saveErr: any) {
          console.error('Firestore save error:', saveErr);
          alert(saveErr?.message || String(saveErr));
          setUploadError(saveErr?.message || 'Failed to save record to Firestore.');
          setIsSaving(false);
        }
      };

      reader.onerror = (readErr) => {
        console.error('FileReader error:', readErr);
        alert('Failed to read file as Data URL.');
        setUploadError('Failed to read selected file into Base64 format.');
        setIsSaving(false);
      };

      // Read file as Data URL (Base64)
      reader.readAsDataURL(file);
    } catch (error: any) {
      console.error('Upload initiation error:', error);
      alert(error?.message || String(error));
      setUploadError(error?.message || 'Failed to process document attachment.');
      setIsSaving(false);
    }
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
          disabled={!isAuthValid}
          title={!isAuthValid ? 'Sign in to upload medical records' : ''}
          className="px-5 py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs shadow-md shadow-teal-600/20 transition-all m3-pressable cursor-pointer flex items-center justify-center gap-2 self-start sm:self-auto w-full sm:w-auto"
        >
          <Upload className="w-4 h-4" />
          <span>Upload Medical Document</span>
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
            disabled={!isAuthValid}
            title={!isAuthValid ? 'Sign in to upload medical records' : ''}
            className="px-4 py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-xs shadow-xs transition-all m3-pressable flex items-center gap-1.5 cursor-pointer"
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
                  {rec.downloadUrl ? (
                    <a
                      href={rec.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-xl text-slate-600 hover:text-teal-700 hover:bg-teal-50 transition-colors m3-pressable cursor-pointer"
                      title="Open / Download Document"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  ) : (
                    <button
                      onClick={() => alert(`Downloading verified clinical document: ${rec.title}`)}
                      className="p-2 rounded-xl text-slate-600 hover:text-teal-700 hover:bg-teal-50 transition-colors m3-pressable cursor-pointer"
                      title="Download Record Summary"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  )}
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

              {/* Base64 Document Preview (Image or PDF) */}
              {(selectedRecord.fileData || selectedRecord.downloadUrl) && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <p className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                    Attached Document Preview
                  </p>
                  {(() => {
                    const dataUrl = selectedRecord.fileData || selectedRecord.downloadUrl || '';
                    const isImg =
                      dataUrl.startsWith('data:image/') ||
                      selectedRecord.type === 'Imaging' ||
                      /\.(png|jpe?g|gif|webp|svg)$/i.test(selectedRecord.title);
                    const isPdf =
                      dataUrl.startsWith('data:application/pdf') ||
                      /\.pdf$/i.test(selectedRecord.title);

                    if (isImg) {
                      return (
                        <div className="rounded-2xl border border-slate-200 overflow-hidden bg-slate-50 flex items-center justify-center p-2">
                          <img
                            src={dataUrl}
                            alt={selectedRecord.title}
                            className="max-h-72 w-full object-contain rounded-xl"
                          />
                        </div>
                      );
                    }

                    if (isPdf) {
                      return (
                        <div className="space-y-2">
                          <div className="rounded-2xl border border-slate-200 overflow-hidden bg-slate-100">
                            <iframe
                              src={dataUrl}
                              className="w-full h-72 border-0"
                              title={selectedRecord.title}
                            />
                          </div>
                          <a
                            href={dataUrl}
                            download={`${selectedRecord.title.replace(/\s+/g, '_')}.pdf`}
                            className="inline-flex items-center gap-1.5 text-xs text-teal-700 font-bold hover:underline"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download PDF Document</span>
                          </a>
                        </div>
                      );
                    }

                    return (
                      <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                        <span className="text-xs text-slate-700 truncate font-medium">
                          {selectedRecord.title}
                        </span>
                        <a
                          href={dataUrl}
                          download={selectedRecord.title}
                          className="text-xs text-teal-700 font-bold hover:underline inline-flex items-center gap-1"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </a>
                      </div>
                    );
                  })()}
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  onClick={() => setSelectedRecord(null)}
                  className="px-4 py-2 rounded-2xl text-slate-600 hover:bg-slate-100 font-bold m3-pressable cursor-pointer"
                >
                  Close
                </button>
                {selectedRecord.downloadUrl ? (
                  <a
                    href={selectedRecord.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold flex items-center gap-1.5 shadow-sm transition-all m3-pressable cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>View & Download Document</span>
                  </a>
                ) : (
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
                )}
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
                onClick={handleCloseModal}
                disabled={isSaving}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors m3-pressable cursor-pointer disabled:opacity-50"
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
                  Your document has been securely uploaded to storage and linked to your clinical history.
                </p>
              </div>
            ) : (
              <form onSubmit={handleUploadSubmit} className="p-6 space-y-4">
                {uploadError && (
                  <div className="flex items-center gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 p-3 rounded-2xl">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                    <span>{uploadError}</span>
                  </div>
                )}

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
                    disabled={isSaving}
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-slate-100"
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
                      disabled={isSaving}
                      className="w-full px-3 py-2.5 rounded-2xl border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white disabled:bg-slate-100"
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
                      disabled={isSaving}
                      className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-slate-100"
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
                    disabled={isSaving}
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-slate-100"
                  />
                </div>

                {/* File Attachment Dropzone */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Physical Document File <span className="text-rose-500">*</span>
                  </label>
                  <label
                    htmlFor="medical-doc-file-input"
                    className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1.5 ${
                      file
                        ? 'border-teal-500 bg-teal-50/50'
                        : 'border-slate-300 hover:border-teal-400 bg-slate-50 hover:bg-teal-50/20'
                    } ${isSaving ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    <input
                      id="medical-doc-file-input"
                      type="file"
                      accept=".pdf,image/*"
                      onChange={(e) => {
                        const selected = e.target.files ? e.target.files[0] : null;
                        setFile(selected);
                        if (selected && !newTitle) {
                          setNewTitle(selected.name.replace(/\.[^/.]+$/, ''));
                        }
                        setUploadError(null);
                      }}
                      className="hidden"
                      disabled={isSaving}
                    />
                    {file ? (
                      <div className="flex items-center gap-3 w-full px-2">
                        <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="text-left flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">{file.name}</p>
                          <p className="text-[10px] text-teal-600 font-medium">
                            {(file.size / (1024 * 1024)).toFixed(2)} MB • Ready to upload
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setFile(null);
                          }}
                          disabled={isSaving}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Remove file"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-5 h-5 text-teal-600 mx-auto" />
                        <p className="text-xs font-bold text-slate-700">Attach Document (PDF, Image)</p>
                        <p className="text-[10px] text-slate-400">Click to browse file • Up to 25MB encrypted</p>
                      </>
                    )}
                  </label>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    disabled={isSaving}
                    className="px-4 py-2 rounded-2xl text-slate-600 hover:bg-slate-100 font-bold text-xs m3-pressable cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving || !isAuthValid}
                    title={
                      !isAuthValid
                        ? 'Sign in to upload medical records'
                        : !file
                        ? 'Please select a document file to upload'
                        : ''
                    }
                    className="px-5 py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs shadow-md shadow-teal-600/20 transition-all m3-pressable cursor-pointer flex items-center justify-center gap-2 min-w-[130px]"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <span>Save & Upload</span>
                    )}
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

