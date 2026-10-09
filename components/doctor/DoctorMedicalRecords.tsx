'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, query } from 'firebase/firestore';
import {
  FileText,
  Download,
  Calendar,
  Building,
  User,
  Eye,
  X,
  Search,
  Filter,
  FileCheck,
  ImageIcon,
  File,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

interface ClinicalRecordItem {
  id: string;
  patientId: string;
  patientName?: string;
  title: string;
  documentTitle?: string;
  type: string;
  recordType?: string;
  facility: string;
  notes?: string;
  clinicalSummary?: string;
  summary?: string;
  date: string;
  fileSize?: string;
  fileData?: string;
  downloadUrl?: string;
  doctorName?: string;
  createdAt?: any;
}

export function DoctorMedicalRecords() {
  const [records, setRecords] = useState<ClinicalRecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('All');
  const [selectedRecord, setSelectedRecord] = useState<ClinicalRecordItem | null>(null);

  // Subscribe in real-time to clinical_records collection
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    try {
      const q = query(collection(db, 'clinical_records'));
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const list: ClinicalRecordItem[] = snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            const content = data.content || {};

            const docTitle =
              data['Document Title'] ||
              data.documentTitle ||
              data.title ||
              content.title ||
              'Clinical Document';

            const docType =
              data['Record Type'] ||
              data.recordType ||
              data.type ||
              content.type ||
              'Lab Report';

            const docNotes =
              data.notes ||
              data['Notes'] ||
              data.clinicalSummary ||
              data['Clinical Summary'] ||
              data.summary ||
              content.notes ||
              content.summary ||
              'No clinical notes provided.';

            const rawDate =
              data.createdAt?.toDate
                ? data.createdAt.toDate().toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : content.date || 'Recent';

            const base64Data =
              data.fileData ||
              content.fileData ||
              data.downloadUrl ||
              content.downloadUrl;

            return {
              id: docSnap.id,
              patientId: data.patientId || 'unknown_patient',
              patientName: data.patientName || content.patientName || 'Patient',
              title: docTitle,
              documentTitle: docTitle,
              type: docType,
              recordType: docType,
              facility: data.facility || data['Facility'] || content.facility || 'CuraLink Diagnostics',
              notes: docNotes,
              clinicalSummary: docNotes,
              summary: docNotes,
              date: rawDate,
              fileSize: data.fileSize || content.fileSize || 'HIPAA Encrypted',
              fileData: base64Data,
              downloadUrl: base64Data,
              doctorName: data.doctorName || 'Attending Physician',
              createdAt: data.createdAt,
            };
          });

          // Sort client-side descending by timestamp
          list.sort((a, b) => {
            const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
            const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
            return timeB - timeA;
          });

          if (isMounted) {
            setRecords(list);
            setLoading(false);
          }
        },
        (error) => {
          console.error('Doctor Medical Records listener error:', error);
          if (isMounted) setLoading(false);
        }
      );

      return () => {
        isMounted = false;
        unsubscribe();
      };
    } catch (err) {
      console.error('Error attaching records listener:', err);
      setLoading(false);
    }
  }, []);

  const filteredRecords = useMemo(() => {
    return records.filter((rec) => {
      const q = search.toLowerCase();
      const matchSearch =
        rec.title.toLowerCase().includes(q) ||
        (rec.patientName && rec.patientName.toLowerCase().includes(q)) ||
        (rec.notes && rec.notes.toLowerCase().includes(q)) ||
        rec.facility.toLowerCase().includes(q);

      const matchType = filterType === 'All' || rec.type.toLowerCase() === filterType.toLowerCase();

      return matchSearch && matchType;
    });
  }, [records, search, filterType]);

  const recordTypes = ['All', 'Lab Report', 'Imaging', 'Prescription', 'Clinical Summary'];

  const isImageFile = (rec: ClinicalRecordItem) => {
    const data = rec.fileData || rec.downloadUrl || '';
    return (
      data.startsWith('data:image/') ||
      rec.type === 'Imaging' ||
      /\.(png|jpe?g|gif|webp|svg)$/i.test(rec.title)
    );
  };

  const isPdfFile = (rec: ClinicalRecordItem) => {
    const data = rec.fileData || rec.downloadUrl || '';
    return data.startsWith('data:application/pdf') || /\.pdf$/i.test(rec.title);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
              Clinician Repository
            </span>
            <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Verified EHR Telehealth Vault
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1.5">
            Doctor&apos;s Medical Records & Diagnostics Hub
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Live clinical documents, diagnostic lab reports, radiology imaging, and notes uploaded across all patients.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <div className="px-3.5 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-700">
            Total Records: <span className="text-teal-600">{records.length}</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search records, patients, notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2.5 rounded-2xl border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {(recordTypes || []).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                filterType === type
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Records Grid */}
      {loading ? (
        <div className="py-20 text-center bg-white rounded-3xl border border-slate-200 p-8 shadow-xs">
          <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-bold text-slate-700">Loading Clinical Records...</p>
        </div>
      ) : (filteredRecords || []).length === 0 ? (
        <div className="py-16 text-center bg-white rounded-3xl border border-slate-200 p-8 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto mb-3">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">No medical records found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            {search
              ? `No documents matched "${search}". Try searching another patient or keyword.`
              : 'Patients have not uploaded any diagnostic files or clinical records yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {(filteredRecords || []).map((record) => {
            const hasFile = !!(record.fileData || record.downloadUrl);
            const isImg = isImageFile(record);
            const isPdf = isPdfFile(record);

            return (
              <div
                key={record.id}
                className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  {/* Top Meta Badges */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                      {record.type}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">{record.date}</span>
                  </div>

                  {/* Title & Patient */}
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 leading-snug">
                      {record.title}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
                      <User className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                      <span className="font-semibold text-slate-700 truncate">
                        {record.patientName}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-500">
                      <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{record.facility}</span>
                    </div>
                  </div>

                  {/* Notes / Clinical Summary */}
                  {record.notes && (
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                      <p className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">
                        Clinical Notes
                      </p>
                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                        {record.notes}
                      </p>
                    </div>
                  )}

                  {/* Inline Document Preview (Base64 Data URL) */}
                  {hasFile && (
                    <div className="rounded-2xl border border-slate-200/90 overflow-hidden bg-slate-50/50 p-2">
                      {isImg ? (
                        <div className="relative rounded-xl overflow-hidden bg-slate-900/5 aspect-video flex items-center justify-center">
                          {/* Image render: <img src={record.fileData} /> */}
                          <img
                            src={record.fileData}
                            alt={record.title}
                            className="w-full h-full object-contain"
                          />
                        </div>
                      ) : isPdf ? (
                        <div className="space-y-1.5">
                          <div className="rounded-xl overflow-hidden bg-slate-100 h-40">
                            {/* PDF render: <iframe src={record.fileData} /> */}
                            <iframe
                              src={record.fileData}
                              className="w-full h-full border-0"
                              title={record.title}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 p-2 text-xs text-slate-600">
                          <File className="w-4 h-4 text-teal-600" />
                          <span className="truncate">Attached Document</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Footer / Action Links */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-400">
                    {record.fileSize || 'HIPAA Certified'}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedRecord(record)}
                      className="px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View</span>
                    </button>

                    {hasFile && (
                      <a
                        href={record.fileData}
                        download={`${record.title.replace(/\s+/g, '_')}${isPdf && !record.title.endsWith('.pdf') ? '.pdf' : ''}`}
                        className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                        title="Download Document"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full Preview Modal */}
      {selectedRecord && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200"
          onClick={() => setSelectedRecord(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-200 my-8 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300">
                  <FileCheck className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-teal-300">
                    {selectedRecord.type}
                  </span>
                  <h3 className="text-base font-bold text-white tracking-tight leading-snug">
                    {selectedRecord.title}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto text-xs text-slate-700">
              {/* Record Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Patient</span>
                  <p className="text-xs font-bold text-slate-800 mt-0.5 truncate">
                    {selectedRecord.patientName}
                  </p>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Date</span>
                  <p className="text-xs font-bold text-slate-800 mt-0.5 truncate">
                    {selectedRecord.date}
                  </p>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Facility</span>
                  <p className="text-xs font-bold text-slate-800 mt-0.5 truncate">
                    {selectedRecord.facility}
                  </p>
                </div>
                <div className="p-3 rounded-2xl border border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Attending</span>
                  <p className="text-xs font-bold text-slate-800 mt-0.5 truncate">
                    {selectedRecord.doctorName}
                  </p>
                </div>
              </div>

              {/* Notes / Clinical Summary */}
              {selectedRecord.notes && (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                  <p className="font-bold text-slate-900 text-xs">Diagnostic Notes & Summary</p>
                  <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                    {selectedRecord.notes}
                  </p>
                </div>
              )}

              {/* Base64 Data URL Display */}
              {selectedRecord.fileData && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                      Physical Document Attachment
                    </p>
                    <a
                      href={selectedRecord.fileData}
                      download={`${selectedRecord.title.replace(/\s+/g, '_')}${isPdfFile(selectedRecord) && !selectedRecord.title.endsWith('.pdf') ? '.pdf' : ''}`}
                      className="text-xs font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download File</span>
                    </a>
                  </div>

                  {isImageFile(selectedRecord) ? (
                    <div className="rounded-2xl border border-slate-200 overflow-hidden bg-slate-900/5 p-3 flex items-center justify-center">
                      {/* Image render: <img src={record.fileData} /> */}
                      <img
                        src={selectedRecord.fileData}
                        alt={selectedRecord.title}
                        className="max-h-96 w-full object-contain rounded-xl"
                      />
                    </div>
                  ) : isPdfFile(selectedRecord) ? (
                    <div className="space-y-2">
                      <div className="rounded-2xl border border-slate-200 overflow-hidden bg-slate-100">
                        {/* PDF render: <iframe src={record.fileData} /> or clickable download link */}
                        <iframe
                          src={selectedRecord.fileData}
                          className="w-full h-96 border-0"
                          title={selectedRecord.title}
                        />
                      </div>
                      <div className="p-3 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-between">
                        <span className="text-xs text-teal-900 font-medium">
                          Need offline copy? Download verified clinical PDF.
                        </span>
                        <a
                          href={selectedRecord.fileData}
                          download={`${selectedRecord.title.replace(/\s+/g, '_')}.pdf`}
                          className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Clickable Download Link</span>
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <File className="w-5 h-5 text-teal-600" />
                        <span className="font-bold text-slate-800">{selectedRecord.title}</span>
                      </div>
                      <a
                        href={selectedRecord.fileData}
                        download={selectedRecord.title}
                        className="px-3 py-1.5 rounded-xl bg-teal-600 text-white font-bold text-xs"
                      >
                        Download Attachment
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setSelectedRecord(null)}
                className="px-4 py-2 rounded-xl text-slate-700 hover:bg-slate-200 font-bold text-xs transition-colors cursor-pointer"
              >
                Close
              </button>
              {selectedRecord.fileData && (
                <a
                  href={selectedRecord.fileData}
                  download={`${selectedRecord.title.replace(/\s+/g, '_')}${isPdfFile(selectedRecord) && !selectedRecord.title.endsWith('.pdf') ? '.pdf' : ''}`}
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Document</span>
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
