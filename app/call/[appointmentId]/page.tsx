'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  Video,
  PhoneOff,
  ShieldCheck,
  Loader2,
  Sparkles,
  Camera,
  Mic,
  ArrowLeft,
  AlertCircle,
} from 'lucide-react';
import { useTelehealth } from '../../../context/TelehealthContext';

const JitsiMeeting = dynamic(
  () => import('@jitsi/react-sdk').then((mod) => mod.JitsiMeeting),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 text-white gap-3 rounded-2xl">
        <div className="w-10 h-10 border-3 border-teal-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold text-slate-300">Connecting Encrypted Video Consultation...</p>
        <span className="text-xs text-slate-500">Securing WebRTC media streams</span>
      </div>
    ),
  }
);

interface CallPageProps {
  params?: any;
}

export default function TelehealthCallPage({ params }: CallPageProps) {
  const router = useRouter();
  const routeParams = useParams();
  const appointmentId = (routeParams?.appointmentId as string) || '';

  const { currentUser } = useTelehealth();
  const [isLoading, setIsLoading] = useState(true);
  const [hasPermissionError, setHasPermissionError] = useState(false);

  const displayName = currentUser?.fullName || (currentUser?.role?.toLowerCase() === 'doctor' ? 'Attending Physician' : 'Telehealth Patient');

  const handleLeaveCall = () => {
    if (currentUser?.role?.toLowerCase() === 'doctor') {
      router.push('/doctor');
    } else {
      router.push('/patient/dashboard');
    }
  };

  return (
    <div className="w-screen h-screen bg-black overflow-hidden flex flex-col relative select-none">
      {/* Top Telehealth Control Bar */}
      <header className="absolute top-0 left-0 right-0 z-30 bg-gradient-to-b from-black/80 via-black/40 to-transparent p-4 flex items-center justify-between pointer-events-auto">
        <div className="flex items-center gap-3">
          <button
            onClick={handleLeaveCall}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-md transition-all border border-white/10"
            title="Leave and return to dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Exit Call</span>
          </button>

          <div className="flex items-center gap-2 bg-emerald-950/60 border border-emerald-500/30 px-3 py-1.5 rounded-xl backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-bold text-emerald-300 tracking-wide font-mono">
              SECURE ENCRYPTED CONSULTATION
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 text-xs text-slate-300 bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl backdrop-blur-md">
            <ShieldCheck className="w-4 h-4 text-teal-400" />
            <span>Room ID: {appointmentId || 'Connecting...'}</span>
          </div>

          <button
            onClick={handleLeaveCall}
            className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-lg shadow-rose-900/50 transition-all border border-rose-500/30"
          >
            <PhoneOff className="w-4 h-4" />
            <span>End Call</span>
          </button>
        </div>
      </header>

      {/* Loading & Graceful Permission Handler State */}
      {isLoading && (
        <div className="absolute inset-0 z-20 bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
          <div className="relative mb-6">
            <div className="w-20 h-20 rounded-3xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 animate-pulse">
              <Video className="w-10 h-10" />
            </div>
            <Loader2 className="w-8 h-8 text-teal-400 animate-spin absolute -bottom-2 -right-2" />
          </div>

          <h2 className="text-xl font-bold text-white mb-2">Connecting to Telehealth Video Room...</h2>
          <p className="text-sm text-slate-400 max-w-md mb-6">
            Setting up end-to-end encrypted peer connection for consultation <code className="text-teal-300 font-mono">#{appointmentId || 'active'}</code>.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-3 text-xs text-slate-400 bg-white/5 border border-white/10 rounded-2xl px-5 py-3">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-teal-400" />
              <span>Camera check</span>
            </div>
            <span className="hidden sm:inline text-slate-600">•</span>
            <div className="flex items-center gap-2">
              <Mic className="w-4 h-4 text-teal-400" />
              <span>Microphone check</span>
            </div>
            <span className="hidden sm:inline text-slate-600">•</span>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>High definition audio</span>
            </div>
          </div>
        </div>
      )}

      {/* Permission Fallback Notice */}
      {hasPermissionError && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 max-w-md w-full px-4">
          <div className="bg-amber-950/90 border border-amber-500/50 text-amber-200 p-4 rounded-2xl backdrop-blur-md shadow-2xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-bold text-amber-300 mb-1">Microphone or Camera Permission Needed</p>
              <p>Please grant browser permissions to your camera and microphone so the other participant can see and hear you.</p>
            </div>
          </div>
        </div>
      )}

      {/* Jitsi Meeting Video UI - Full Screen */}
      <div className="w-screen h-screen bg-black flex-1 flex">
        <JitsiMeeting
          domain="meet.jit.si"
          roomName={appointmentId}
          configOverwrite={{}}
          interfaceConfigOverwrite={{
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
            SHOW_BRAND_WATERMARK: false,
            SHOW_POWERED_BY: false,
            DEFAULT_REMOTE_DISPLAY_NAME: 'Telehealth Participant',
          }}
          userInfo={{
            displayName: displayName,
            email: currentUser?.email || 'patient@nexacare.health',
          }}
          onApiReady={(externalApi: any) => {
            setIsLoading(false);

            externalApi.on('videoConferenceJoined', () => {
              setIsLoading(false);
            });

            externalApi.on('videoConferenceLeft', () => {
              handleLeaveCall();
            });

            externalApi.on('cameraError', () => {
              setHasPermissionError(true);
            });

            externalApi.on('micError', () => {
              setHasPermissionError(true);
            });
          }}
          getIFrameRef={(iframeRef: any) => {
            if (iframeRef) {
              iframeRef.style.height = '100%';
              iframeRef.style.width = '100%';
              iframeRef.style.border = 'none';
            }
          }}
          spinner={() => (
            <div className="w-full h-full flex flex-col items-center justify-center bg-black text-white">
              <Loader2 className="w-8 h-8 text-teal-400 animate-spin mb-3" />
              <p className="text-sm font-medium text-slate-300">Loading Telehealth Consultation Interface...</p>
            </div>
          )}
        />
      </div>
    </div>
  );
}
