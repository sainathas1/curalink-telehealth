'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import VideoCall from '../../components/VideoCall';

function VideoPageContent() {
  const searchParams = useSearchParams();
  return <main className="min-h-screen bg-slate-50 p-5 sm:p-8"><header className="mx-auto mb-6 max-w-6xl"><Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 py-2 text-sm font-semibold text-teal-800"><ArrowLeft size={18} />Back to CuraLink</Link><h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">Your video consultation</h1></header><div className="mx-auto max-w-6xl"><VideoCall roomName={searchParams.get('room') || undefined} autoStart showInviteControls /></div></main>;
}
export default function VideoCallPage() { return <Suspense fallback={<main className="p-8 text-slate-600">Preparing consultation…</main>}><VideoPageContent /></Suspense>; }
