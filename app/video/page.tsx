'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import VideoCall from '@/components/VideoCall';
import Link from 'next/link';
import { Stethoscope, ArrowLeft, ShieldCheck, Activity } from 'lucide-react';

function VideoPageContent() {
  const searchParams = useSearchParams();
  const room = searchParams.get('room') || undefined;
  const name = searchParams.get('name') || 'Consultation Participant';

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Navigation Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400">
              <Stethoscope className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-tight">CuraLink TeleCare Video Room</h1>
              <p className="text-[11px] text-slate-400">Direct WebRTC Telehealth Channel</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-teal-400 bg-teal-500/10 border border-teal-500/20 px-3 py-1 rounded-full">
            <ShieldCheck className="w-3.5 h-3.5" /> HIPAA Encrypted
          </span>
          <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
            <Activity className="w-3.5 h-3.5" /> WebRTC Active
          </span>
        </div>
      </header>

      {/* Main Video Arena */}
      <main className="flex-1 p-4 sm:p-6 max-w-6xl w-full mx-auto flex flex-col">
        <div className="flex-1 rounded-2xl border border-slate-800 bg-slate-900/40 p-2 shadow-2xl flex flex-col">
          <VideoCall
            roomName={room}
            userName={name}
            autoStart={!!room}
            showInviteControls={true}
            className="flex-1 min-h-[600px]"
          />
        </div>
      </main>
    </div>
  );
}

export default function VideoCallPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-teal-500" />
        </div>
      }
    >
      <VideoPageContent />
    </Suspense>
  );
}
