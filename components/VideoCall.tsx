'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Copy, Check, Video, Loader2 } from 'lucide-react';
import { useTelehealth } from '../context/TelehealthContext';

const JitsiMeeting = dynamic(() => import('@jitsi/react-sdk').then(module => module.JitsiMeeting), {
  ssr: false,
  loading: () => <div className="flex min-h-96 items-center justify-center gap-3 bg-slate-950 text-sm text-white"><Loader2 size={20} className="animate-spin" />Preparing your video room…</div>,
});
export interface VideoCallProps {
  roomName?: string; userName?: string; autoStart?: boolean; showInviteControls?: boolean;
  className?: string; onLeave?: () => void;
}

export default function VideoCall({ roomName, userName, showInviteControls = false, className = '', onLeave }: VideoCallProps = {}) {
  const { currentUser, isLoading, dataLoading, dataError, retryData, patientAppointments, doctorAppointmentsQueue } = useTelehealth();
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  const isDoctor = currentUser?.role?.toLowerCase() === 'doctor';
  const appointmentId = roomName?.startsWith('CuraLink-') ? roomName.slice('CuraLink-'.length) : roomName;
  const appointment = [...patientAppointments, ...doctorAppointmentsQueue].find(item => item.id === appointmentId &&
    (isDoctor ? item.doctorId === currentUser?.uid && currentUser?.isVerified === true : item.patientId === currentUser?.uid));
  if (isLoading || dataLoading) return <div className="flex min-h-72 items-center justify-center gap-3 text-slate-600"><Loader2 size={20} className="animate-spin" />Checking your consultation…</div>;
  if (!currentUser) return <div className="care-card flex min-h-72 flex-col items-center justify-center gap-4 p-6 text-center text-slate-800"><Video className="text-teal-700" /><h2 className="text-xl font-semibold">Sign in to join your consultation</h2><Link href="/auth" className="care-button">Sign in</Link></div>;
  if (dataError) return <div className="care-card flex min-h-72 flex-col items-center justify-center gap-4 p-6 text-center"><h2 className="text-xl font-semibold text-slate-800">We could not load your consultation</h2><p role="alert" className="text-sm text-slate-500">{dataError}</p><button type="button" onClick={retryData} className="care-button">Try again</button></div>;
  if (!appointment || !['scheduled', 'upcoming', 'in progress'].includes(appointment.status.toLowerCase())) return <div className="care-card flex min-h-72 flex-col items-center justify-center gap-3 p-6 text-center text-slate-800"><Video className="text-teal-700" /><h2 className="text-xl font-semibold">Consultation not available</h2><p className="max-w-sm text-sm leading-6 text-slate-500">Choose an active video appointment from your dashboard. Only the booked patient and verified clinician can join through CuraLink.</p><Link href={isDoctor ? '/doctor/dashboard' : '/patient/appointments'} className="care-button">View my appointments</Link></div>;
  if (appointment.type !== 'Video Call') return <div className="care-card p-6 text-slate-700">This is an in-person appointment. Check your appointment details for the visit location.</div>;
  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(new URL(`/call/${encodeURIComponent(appointment!.id)}`, window.location.origin).href);
      setCopied(true); setCopyError('');
    } catch { setCopyError('We could not copy the link. You can copy this page address from your browser.'); }
  }
  return (
    <div className={`w-full flex flex-col ${className}`}>
      {showInviteControls && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
          <span>Consultation with {isDoctor ? appointment.patientName : appointment.doctorName}</span>
          <button type="button" onClick={copyInvite} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 font-semibold text-teal-800 transition active:scale-[0.98]">
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? 'Link copied' : 'Copy appointment link'}
          </button>
          {copyError && <p role="alert" className="w-full text-xs text-rose-700">{copyError}</p>}
        </div>
      )}
      <div className="w-full h-[calc(100vh-80px)] min-h-[500px] flex flex-col relative overflow-hidden rounded-2xl bg-slate-950 shadow-inner">
        <JitsiMeeting
          domain="meet.jit.si"
          roomName={`CuraLink-${appointment.id}`}
          configOverwrite={{
            startWithAudioMuted: true,
            startWithVideoMuted: true,
            prejoinPageEnabled: true,
            disableDeepLinking: true,
            enableClosePage: false,
            disableInviteFunctions: true,
          }}
          interfaceConfigOverwrite={{
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
            DEFAULT_REMOTE_DISPLAY_NAME: 'Care team participant',
          }}
          userInfo={{
            displayName: userName || currentUser.fullName,
            email: currentUser.email,
          }}
          onReadyToClose={onLeave}
          getIFrameRef={(iframe) => {
            iframe.style.width = '100%';
            iframe.style.height = '100%';
            iframe.style.border = '0';
            iframe.style.position = 'absolute';
            iframe.style.inset = '0';
            iframe.setAttribute('title', 'CuraLink video consultation');
            iframe.setAttribute('allow', 'camera; microphone; display-capture; autoplay; clipboard-write; screen-wake-lock');
          }}
        />
      </div>
    </div>
  );
}
