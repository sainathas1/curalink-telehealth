'use client';

import React, { useState } from 'react';
import { Appointment } from '../../lib/types';
import { BookAppointmentModal } from './BookAppointmentModal';
import {
  Calendar,
  Video,
  Clock,
  User,
  Plus,
  CheckCircle,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  MapPin,
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
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [filter, setFilter] = useState<'All' | 'Upcoming' | 'Completed'>('All');

  const filteredAppointments = appointments.filter((apt) => {
    if (filter === 'Upcoming') return apt.status === 'Upcoming' || apt.status === 'In Progress';
    if (filter === 'Completed') return apt.status === 'Completed';
    return true;
  });

  const nextAppointment = appointments.find((a) => a.status === 'Upcoming');

  return (
    <div className="space-y-6">
      {/* Top Header & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Consultations & Telehealth Visits
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Connect with board-certified physicians via encrypted HD video calls
          </p>
        </div>

        <button
          onClick={() => setIsBookModalOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md shadow-teal-600/20 transition-all cursor-pointer flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Book New Consultation</span>
        </button>
      </div>

      {/* Featured Next Appointment Card (if available) */}
      {nextAppointment && (
        <div className="bg-gradient-to-br from-teal-900 via-slate-900 to-slate-950 text-white p-6 rounded-3xl shadow-lg border border-teal-800/40 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-teal-500/20 text-teal-300 border border-teal-400/30">
                  Next Scheduled Visit
                </span>
                <span className="text-xs text-slate-300 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-teal-400" />
                  {nextAppointment.date} at {nextAppointment.time}
                </span>
                {nextAppointment.paymentStatus === 'Paid' ? (
                  <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    Paid (₹{nextAppointment.paymentAmount || 500})
                  </span>
                ) : (
                  <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30 flex items-center gap-1">
                    <CreditCard className="w-3 h-3 text-amber-400" />
                    Fee: ₹500 Due
                  </span>
                )}
              </div>

              <div>
                <h3 className="text-xl font-bold text-white tracking-tight">
                  {nextAppointment.doctorName}
                </h3>
                <p className="text-xs text-teal-300 font-medium">
                  {nextAppointment.doctorSpecialty}
                </p>
              </div>

              <p className="text-xs text-slate-300 max-w-xl">
                <strong className="text-slate-200">Reason:</strong> {nextAppointment.symptoms}
              </p>
            </div>

            <div className="shrink-0 flex flex-col sm:flex-row gap-3">
              {nextAppointment.type === 'Video Call' ? (
                <button
                  onClick={() => onJoinVideoCall(nextAppointment)}
                  className="px-5 py-3 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white font-bold text-xs shadow-lg shadow-teal-900/50 transition-all cursor-pointer flex items-center justify-center gap-2 group"
                >
                  <Video className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  <span>Start / Join Video Call</span>
                </button>
              ) : (
                <div className="px-4 py-3 rounded-2xl bg-white/10 text-xs font-semibold text-slate-200 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-teal-400" />
                  <span>In-Clinic Visit</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Appointment History List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">All Appointments & Records</h3>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {(['All', 'Upcoming', 'Completed'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  filter === tab
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {filteredAppointments.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No appointments found for the selected filter.
            </div>
          ) : (
            filteredAppointments.map((apt) => (
              <div
                key={apt.id}
                className="p-4 rounded-2xl border border-slate-200/80 hover:border-slate-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                    {apt.type === 'Video Call' ? (
                      <Video className="w-5 h-5" />
                    ) : (
                      <User className="w-5 h-5" />
                    )}
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900">{apt.doctorName}</h4>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          apt.status === 'Upcoming'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {apt.status}
                      </span>
                      {apt.paymentStatus === 'Paid' ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-teal-50 text-teal-700 border border-teal-200 flex items-center gap-1 font-mono">
                          <CheckCircle2 className="w-3 h-3 text-teal-600" />
                          Paid (₹{apt.paymentAmount || 500})
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1 font-mono">
                          <CreditCard className="w-3 h-3 text-amber-600" />
                          ₹500 Fee Due
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-teal-700 font-medium">{apt.doctorSpecialty}</p>
                    <p className="text-xs text-slate-500 mt-1">{apt.symptoms}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  <div className="text-left sm:text-right">
                    <p className="text-xs font-bold text-slate-800">{apt.date}</p>
                    <p className="text-[11px] text-slate-500 font-mono">{apt.time}</p>
                  </div>

                  {apt.status === 'Upcoming' && apt.type === 'Video Call' && (
                    <button
                      onClick={() => onJoinVideoCall(apt)}
                      className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Video className="w-3.5 h-3.5" />
                      <span>Join Visit</span>
                    </button>
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
