'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Appointment } from '../../lib/types';
import { BookAppointmentModal } from './BookAppointmentModal';
import { useTelehealth } from '../../context/TelehealthContext';
import {
  Calendar,
  Video,
  Clock,
  User,
  Plus,
  CheckCircle2,
  CreditCard,
  MapPin,
  Sparkles,
  XCircle,
} from 'lucide-react';

interface AppointmentsListProps {
  appointments: Appointment[];
  onBookAppointment: (appointment: Appointment) => void;
  onJoinVideoCall: (appointment: Appointment) => void;
  patientName: string;
  patientId: string;
}

export function AppointmentsList({
  appointments,
  onBookAppointment,
  onJoinVideoCall,
  patientName,
  patientId,
}: AppointmentsListProps) {
  const { updateAppointmentStatus, currentUser } = useTelehealth();
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [filter, setFilter] = useState<'All' | 'Upcoming' | 'Completed'>('All');
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const isAuthValid = !!currentUser?.uid && patientId !== 'guest_user';

  const isScheduledAppointment = (apt?: Appointment | null) => {
    if (!apt) return false;
    const s = (apt.status || '').toLowerCase();
    return s === 'scheduled' || s === 'upcoming' || s === 'in progress' || (s !== 'completed' && s !== 'cancelled');
  };

  const filteredAppointments = (appointments || []).filter((apt) => {
    if (filter === 'Upcoming') return isScheduledAppointment(apt);
    if (filter === 'Completed') return apt.status === 'Completed' || (apt.status as string)?.toLowerCase() === 'completed';
    return true;
  });

  const nextAppointment = (appointments || []).find(isScheduledAppointment);

  return (
    <div className="space-y-5 max-w-4xl mx-auto pb-6">
      {/* Top Banner Card: Material 3 rounded-3xl container */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
              Telehealth Visits
            </span>
            <span className="text-[11px] text-slate-500 font-medium">Encrypted WebRTC</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight mt-1">
            Doctor Consultations
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Connect with board-certified physicians via encrypted HD video calls
          </p>
        </div>

        <button
          onClick={() => setIsBookModalOpen(true)}
          disabled={!isAuthValid}
          title={!isAuthValid ? 'Sign in to schedule an appointment' : ''}
          className="px-5 py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs shadow-md shadow-teal-600/20 transition-all m3-pressable cursor-pointer flex items-center justify-center gap-2 self-start sm:self-auto w-full sm:w-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Book Consultation</span>
        </button>
      </div>

      {/* Featured Next Scheduled Appointment Mobile Card */}
      {nextAppointment && (
        <div className="bg-gradient-to-br from-teal-900 via-slate-900 to-slate-950 text-white p-5 sm:p-6 rounded-3xl shadow-lg border border-teal-800/40 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-400/30">
                  Next Scheduled Visit
                </span>
                <span className="text-xs text-slate-300 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-teal-400" />
                  {nextAppointment.date} • {nextAppointment.time}
                </span>
                {nextAppointment.paymentStatus === 'Paid' ? (
                  <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    Paid (₹{nextAppointment.paymentAmount || 500})
                  </span>
                ) : (
                  <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30 flex items-center gap-1">
                    <CreditCard className="w-3 h-3 text-amber-400" />
                    Fee Due
                  </span>
                )}
              </div>

              <div>
                <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  {nextAppointment.doctorName}
                </h3>
                <p className="text-xs text-teal-300 font-semibold">
                  {nextAppointment.doctorSpecialty}
                </p>
              </div>

              <p className="text-xs text-slate-300 max-w-xl">
                <strong className="text-slate-200">Reason:</strong> {nextAppointment.symptoms}
              </p>
            </div>

            <div className="shrink-0 w-full sm:w-auto">
              <Link
                href={`/call/${nextAppointment.id}`}
                onClick={() => onJoinVideoCall(nextAppointment)}
                className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white font-bold text-xs shadow-lg shadow-teal-900/50 transition-all m3-pressable cursor-pointer flex items-center justify-center gap-2 group"
              >
                <Video className="w-4 h-4 group-hover:scale-110 transition-transform" />
                <span>Join Call</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Appointment History List Container */}
      <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-sm space-y-4">
        {/* Header & Filter Chips */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">All Scheduled Consultations</h3>
            <p className="text-[11px] text-slate-400">{(filteredAppointments || []).length} record(s)</p>
          </div>

          {/* Material 3 Filter Chips */}
          <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-full self-start sm:self-auto border border-slate-200/50">
            {(['All', 'Upcoming', 'Completed'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-3.5 py-1 rounded-full text-xs font-semibold transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer ${
                  filter === tab
                    ? 'bg-white text-slate-900 shadow-sm font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Clean Mobile Cards with Rounded Corners */}
        <div className="space-y-3">
          {(filteredAppointments || []).length === 0 ? (
            <div className="py-12 px-6 rounded-3xl bg-slate-50/60 border border-dashed border-slate-200 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mb-3">
                <Calendar className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-semibold text-slate-800 mb-1">
                No records found
              </h4>
              <p className="text-xs text-slate-500 max-w-sm mb-4">
                Schedule a virtual or in-clinic visit with a verified clinician.
              </p>
              <button
                onClick={() => setIsBookModalOpen(true)}
                disabled={!isAuthValid}
                title={!isAuthValid ? 'Sign in to schedule an appointment' : ''}
                className="px-4 py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-500 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-xs shadow-md shadow-teal-700/20 transition-all duration-300 flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Book First Consultation</span>
              </button>
            </div>
          ) : (
            (filteredAppointments || []).map((apt) => (
              <div
                key={apt.id}
                className="p-4 sm:p-5 rounded-3xl bg-white/90 backdrop-blur-sm border border-slate-200/80 hover:border-teal-300 shadow-sm hover:shadow-lg hover:scale-[1.01] transition-all duration-300 flex flex-col justify-between gap-3.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0 shadow-xs">
                      {apt.type === 'Video Call' ? (
                        <Video className="w-5 h-5" />
                      ) : (
                        <User className="w-5 h-5" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-900 truncate">
                          {apt.doctorName}
                        </h4>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            apt.status === 'Upcoming'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {apt.status}
                        </span>
                      </div>
                      <p className="text-xs text-teal-700 font-medium mt-0.5">
                        {apt.doctorSpecialty}
                      </p>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{apt.symptoms}</p>
                    </div>
                  </div>

                  {/* Payment Pill */}
                  <div className="shrink-0 text-right">
                    {apt.paymentStatus === 'Paid' ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-teal-50 text-teal-700 border border-teal-200 flex items-center gap-1 font-mono">
                        <CheckCircle2 className="w-3 h-3 text-teal-600" />
                        Paid (₹{apt.paymentAmount || 500})
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1 font-mono">
                        <CreditCard className="w-3 h-3 text-amber-600" />
                        ₹500 Due
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom Row: Date & Action Button */}
                <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <Clock className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                    <span className="font-semibold text-slate-800">{apt.date}</span>
                    <span>•</span>
                    <span className="font-mono text-slate-500">{apt.time}</span>
                  </div>

                  {isScheduledAppointment(apt) && (
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        onClick={async () => {
                          if (confirm('Are you sure you want to cancel this appointment?')) {
                            setCancellingId(apt.id);
                            await updateAppointmentStatus(apt.id, 'cancelled');
                            setCancellingId(null);
                          }
                        }}
                        disabled={cancellingId === apt.id}
                        className="px-3 py-2 rounded-2xl border border-rose-200 text-rose-600 hover:bg-rose-50 font-bold text-xs transition-all m3-pressable cursor-pointer flex items-center justify-center gap-1"
                        title="Cancel this scheduled visit"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>{cancellingId === apt.id ? 'Cancelling...' : 'Cancel'}</span>
                      </button>

                      <Link
                        href={`/call/${apt.id}`}
                        onClick={() => onJoinVideoCall(apt)}
                        className="w-full sm:w-auto px-4 py-2 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs transition-all m3-pressable cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Video className="w-3.5 h-3.5" />
                        <span>Join Call</span>
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Booking Modal */}
      <BookAppointmentModal
        isOpen={isBookModalOpen}
        onClose={() => setIsBookModalOpen(false)}
        onBook={onBookAppointment}
        patientName={patientName}
        patientId={patientId}
      />
    </div>
  );
}
