'use client';

import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, PhoneOff } from 'lucide-react';
import VideoCall from '../../../components/VideoCall';
import { useTelehealth } from '../../../context/TelehealthContext';

export default function TelehealthCallPage() {
  const router = useRouter();
  const params = useParams<{ appointmentId: string }>();
  const { currentUser } = useTelehealth();
  const back = () => router.push(currentUser?.role?.toLowerCase() === 'doctor' ? '/doctor/dashboard' : '/patient/appointments');
  return <main className="flex min-h-dvh flex-col bg-slate-50 p-4 sm:p-6"><header className="mx-auto mb-5 flex w-full max-w-7xl items-center justify-between gap-3"><div className="flex items-center gap-3"><button type="button" onClick={back} className="flex size-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600" aria-label="Return to appointments"><ArrowLeft size={19} /></button><div><p className="care-eyebrow">CURALINK CONSULTATION</p><h1 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">A space for your care</h1></div></div><button type="button" onClick={back} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700"><PhoneOff size={17} /><span className="hidden sm:inline">Leave consultation</span></button></header><div className="mx-auto w-full max-w-7xl flex-1"><VideoCall roomName={params.appointmentId} userName={currentUser?.fullName} autoStart showInviteControls onLeave={back} className="h-full" /></div></main>;
}
