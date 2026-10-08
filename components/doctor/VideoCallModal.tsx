'use client';

import React, { useState, useEffect } from 'react';
import { Appointment, LiveTelemetryPayload, UserRole, UserProfile } from '../../lib/types';
import VideoCall from '../VideoCall';
import {
  FileText,
  ShieldCheck,
  Heart,
  Droplets,
  Thermometer,
  Stethoscope,
  Send,
  X,
  Activity,
  PhoneOff,
  User,
  CreditCard,
  Lock,
  CheckCircle2,
} from 'lucide-react';

interface VideoCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment | null;
  telemetry: LiveTelemetryPayload;
  onOpenEHR?: () => void;
  doctorName?: string;
  role?: UserRole;
  currentUser?: UserProfile | null;
}

export function VideoCallModal({
  isOpen,
  onClose,
  appointment,
  telemetry,
  onOpenEHR,
  doctorName = 'Attending Physician',
  role = 'Doctor',
  currentUser,
}: VideoCallModalProps) {
  const isPatient = role?.toLowerCase() === 'patient';
  const [callDuration, setCallDuration] = useState(0);
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [notesSaved, setNotesSaved] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const timer = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);

    return () => {
      clearInterval(timer);
      setCallDuration(0);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Safe fallback if appointment is null or being loaded
  const currentAppointment: Appointment = appointment || {
    id: `telehealth-session-${Date.now()}`,
    patientId: isPatient ? (currentUser?.uid || 'patient') : 'patient',
    patientName: isPatient ? (currentUser?.fullName || 'Patient') : 'Patient',
    doctorId: isPatient ? 'attending_physician' : (currentUser?.uid || 'doctor'),
    doctorName: isPatient ? doctorName : (currentUser?.fullName || doctorName),
    doctorSpecialty: 'Telehealth Consultation',
    date: 'Today',
    time: 'Now',
    type: 'Video Call',
    status: 'In Progress',
    symptoms: 'Telehealth clinical consultation session.',
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const handleSaveNotes = async () => {
    if (!clinicalNotes.trim()) return;
    setIsSavingNotes(true);
    try {
      const { db } = await import('../../lib/firebase');
      const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');

      await addDoc(collection(db, 'medical_records'), {
        patientId: currentAppointment.patientId,
        patientName: currentAppointment.patientName || 'Patient',
        doctorId: currentUser?.uid || currentAppointment.doctorId || 'attending_physician',
        doctorName: currentUser?.fullName || doctorName,
        type: 'Clinical Note',
        content: {
          title: `Consultation Note - ${currentAppointment.patientName}`,
          notes: clinicalNotes.trim(),
          diagnosis: currentAppointment.symptoms || 'Video Consultation Evaluation',
          facility: 'CuraLink Telehealth Network',
          fileSize: 'HIPAA Certified',
          status: 'Finalized',
          callDurationMinutes: Math.ceil(callDuration / 60),
          recordedAt: new Date().toISOString(),
        },
        createdAt: serverTimestamp(),
      });

      // Also write to clinical_records for legacy compatibility
      await addDoc(collection(db, 'clinical_records'), {
        patientId: currentAppointment.patientId,
        patientName: currentAppointment.patientName || 'Patient',
        doctorId: currentUser?.uid || currentAppointment.doctorId || 'attending_physician',
        doctorName: currentUser?.fullName || doctorName,
        type: 'Clinical Note',
        content: {
          title: `Consultation Note - ${currentAppointment.patientName}`,
          notes: clinicalNotes.trim(),
          diagnosis: currentAppointment.symptoms || 'Video Consultation Evaluation',
          facility: 'CuraLink Telehealth Network',
          fileSize: 'HIPAA Certified',
          status: 'Finalized',
          callDurationMinutes: Math.ceil(callDuration / 60),
          recordedAt: new Date().toISOString(),
        },
        createdAt: serverTimestamp(),
      });

      setNotesSaved(true);
      setClinicalNotes('');
      setTimeout(() => setNotesSaved(false), 3000);
    } catch (err) {
      console.error('Error saving clinical note to medical_records:', err);
    } finally {
      setIsSavingNotes(false);
    }
  };

  // Generate deterministic room name so both patient and doctor join the same room
  const appointmentRoomName = `curalink-${currentAppointment.id.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-2 sm:p-4 md:p-6 overflow-hidden">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-7xl h-[94vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-white">
        {/* Call Top Header */}
        <div className="px-5 py-3.5 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-tight">
                  Encrypted Telehealth Room: {currentAppointment.patientName} & {doctorName}
                </h3>
                <span className="text-[10px] font-bold uppercase bg-teal-500/20 text-teal-300 px-2 py-0.5 rounded-full border border-teal-500/30 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Encrypted WebRTC
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Duration: {formatTimer(callDuration)} • HIPAA Encrypted Session
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isPatient && onOpenEHR && (
              <button
                onClick={onOpenEHR}
                className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Stethoscope className="w-3.5 h-3.5" />
                <span>Write Clinical Rx</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              title="End consultation and close"
            >
              <PhoneOff className="w-3.5 h-3.5" />
              <span>Close Call</span>
            </button>
          </div>
        </div>

        {/* Video Stage & Side EHR Panel */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 p-3 sm:p-4 min-h-0 overflow-hidden">
          {/* Main Video Stage (Left 2 cols) */}
          <div className="lg:col-span-2 relative bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 flex flex-col h-full">
            {/* Real WebRTC Video Call Feed */}
            <VideoCall
              roomName={appointmentRoomName}
              userName={isPatient ? (currentUser?.fullName || currentAppointment.patientName || 'Patient') : doctorName}
              autoStart={!isPatient || currentAppointment.paymentStatus === 'Paid'} // Pre-paid appointments bypass fee screen!
              className="h-full"
              onLeave={onClose}
            />

            {/* Live Telemetry HUD Overlay */}
            <div className="absolute top-14 left-4 z-20 bg-slate-900/85 backdrop-blur-md p-2.5 rounded-xl border border-slate-700/60 shadow-xl space-y-1.5 pointer-events-none">
              <div className="flex items-center gap-1.5 text-[9px] uppercase font-bold text-teal-400 tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-ping" />
                <span>Live IoT Telemetry</span>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono">
                <div className="flex items-center gap-1 text-rose-400 font-bold">
                  <Heart className="w-3.5 h-3.5 fill-rose-500" />
                  <span>{telemetry.heartRate} BPM</span>
                </div>
                <div className="flex items-center gap-1 text-cyan-400 font-bold">
                  <Droplets className="w-3.5 h-3.5" />
                  <span>{telemetry.spo2}%</span>
                </div>
                <div className="flex items-center gap-1 text-amber-400 font-bold">
                  <Thermometer className="w-3.5 h-3.5" />
                  <span>{telemetry.temperature}°C</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Patient Consultation Details vs Doctor Clinical Scratchpad */}
          {isPatient ? (
            <div className="bg-slate-950 rounded-2xl border border-slate-800 p-4 flex flex-col justify-between overflow-hidden">
              <div className="space-y-4 flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-teal-400" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                      Consultation Overview
                    </h4>
                  </div>
                  <span className="text-[10px] text-teal-300 font-semibold bg-teal-500/20 px-2 py-0.5 rounded-full border border-teal-500/30">
                    Patient View
                  </span>
                </div>

                {/* Assigned Clinician Card */}
                <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Assigned Clinician</span>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-600/20 border border-teal-500/30 flex items-center justify-center text-teal-400">
                      <Stethoscope className="w-5 h-5" />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-white">{currentAppointment.doctorName || doctorName}</h5>
                      <p className="text-[11px] text-teal-400">{currentAppointment.doctorSpecialty || 'Cardiology & Virtual Care'}</p>
                    </div>
                  </div>
                </div>

                {/* Consultation Info */}
                <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Appointment Slot:</span>
                    <span className="font-bold text-slate-200">{currentAppointment.date} • {currentAppointment.time}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Visit Modality:</span>
                    <span className="font-bold text-teal-300">HD Virtual Visit</span>
                  </div>
                  <div className="pt-2 border-t border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Chief Reason for Consultation:</span>
                    <p className="text-slate-300 text-[11px] leading-relaxed italic bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
                      &quot;{currentAppointment.symptoms}&quot;
                    </p>
                  </div>
                </div>

                {/* Fee & Payment Notice */}
                <div className="bg-gradient-to-br from-teal-950/50 to-slate-900 p-3.5 rounded-xl border border-teal-500/30 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-teal-300 flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-teal-400" />
                      Consultation Fee:
                    </span>
                    <span className="font-extrabold text-white text-sm">₹500.00</span>
                  </div>
                  {currentAppointment.paymentStatus === 'Paid' ? (
                    <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">Payment Verified • Pre-paid (Txn: {currentAppointment.paymentTxnId || 'CONFIRMED'})</span>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-300">
                      Pay securely via Razorpay, UPI QR, or Debit/Credit Card on the consultation feed to start audio/video streaming.
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 text-center">
                <span className="text-[10px] text-slate-500 flex items-center justify-center gap-1">
                  <Lock className="w-3 h-3 text-slate-400" /> 256-bit Encrypted Telehealth Session
                </span>
              </div>
            </div>
          ) : (
            /* Doctor Clinical Scratchpad */
            <div className="bg-slate-950 rounded-2xl border border-slate-800 p-4 flex flex-col justify-between overflow-hidden">
              <div className="space-y-3 flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-teal-400" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                      Live Clinical Notes
                    </h4>
                  </div>
                  {notesSaved && (
                    <span className="text-[10px] text-emerald-400 font-bold animate-pulse">
                      Saved to EHR
                    </span>
                  )}
                </div>

                {/* Patient Quick Medical Summary */}
                <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-200">{currentAppointment.patientName}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{currentAppointment.time}</span>
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    <strong className="text-slate-300">Chief Complaint:</strong> {currentAppointment.symptoms}
                  </p>
                  <div className="flex items-center gap-2 pt-1 border-t border-slate-800 text-[11px]">
                    <Activity className="w-3 h-3 text-teal-400" />
                    <span className="text-slate-400">IoT Alert Status:</span>
                    <span
                      className={`font-bold ${
                        telemetry.status === 'critical'
                          ? 'text-rose-400'
                          : telemetry.status === 'elevated'
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {telemetry.status.toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Notes Textarea */}
                <div className="flex-1 flex flex-col min-h-[140px]">
                  <label className="text-[10px] text-slate-400 uppercase font-bold mb-1">
                    Physician Assessment & Observations
                  </label>
                  <textarea
                    value={clinicalNotes}
                    onChange={(e) => setClinicalNotes(e.target.value)}
                    placeholder="Patient reports stable resting heart rate. No acute distress observed over video. Recommended continued adherence to beta blocker regimen..."
                    className="w-full flex-1 p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-teal-500 resize-none font-sans leading-relaxed"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
                <button
                  onClick={handleSaveNotes}
                  disabled={isSavingNotes || !clinicalNotes.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-teal-700/20"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSavingNotes ? 'Saving to Firestore...' : 'Save to Medical Record'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
