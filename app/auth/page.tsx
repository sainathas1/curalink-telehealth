'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { HeartPulse, Activity, FileText, Video } from 'lucide-react';
import { AuthForm } from '../../components/auth/AuthForm';
import { useTelehealth } from '../../context/TelehealthContext';
import { UserProfile, UserRole } from '../../lib/types';

function AuthPageContent() {
  const router = useRouter();
  const { setAuthenticatedProfile } = useTelehealth();
  const searchParams = useSearchParams();
  const initialRole: UserRole = searchParams.get('role') === 'doctor' ? 'Doctor' : 'Patient';
  function handleSuccess(profile: UserProfile) {
    setAuthenticatedProfile(profile);
    if (profile.email.toLowerCase() === 'sainathas8788@gmail.com') router.replace('/admin');
    else if (profile.role.toLowerCase() === 'doctor') router.replace('/doctor/dashboard');
    else if (profile.hasCompletedOnboarding === false) router.replace('/onboarding');
    else router.replace('/patient/dashboard');
  }
  return <main className="min-h-screen bg-[#f6f8f5] p-5 sm:p-8"><Link href="/" className="inline-flex items-center gap-2.5 text-xl font-bold tracking-tight text-slate-900"><span className="flex size-10 items-center justify-center rounded-2xl bg-teal-800 text-white"><HeartPulse size={23} /></span>CuraLink</Link><div className="mx-auto grid max-w-5xl items-center gap-14 py-10 sm:py-16 lg:grid-cols-2"><aside className="hidden lg:block"><p className="care-eyebrow">A LITTLE CLOSER TO BETTER CARE</p><h2 className="mt-5 text-5xl font-semibold leading-tight tracking-[-.04em] text-slate-900">Your health.<br /><span className="text-teal-800">Your space.</span></h2><p className="mt-5 max-w-sm text-base leading-7 text-slate-600">Bring your care team, daily readings, and health story together.</p><div className="mt-10 space-y-5">{[[Video, 'Connect with your clinician'], [Activity, 'Keep your daily readings in view'], [FileText, 'Find your records when you need them']].map(([Icon, title]) => { const CareIcon = Icon as typeof Video; return <div key={String(title)} className="flex items-center gap-3 text-sm text-slate-600"><span className="flex size-10 items-center justify-center rounded-xl bg-white text-teal-700"><CareIcon size={19} /></span>{String(title)}</div>; })}</div></aside><section className="mx-auto w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_15px_50px_-25px_rgba(15,23,42,.15)] sm:p-9"><AuthForm key={initialRole} initialRole={initialRole} onSuccess={handleSuccess} /></section></div></main>;
}

export default function AuthPage() { return <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">Preparing sign in…</main>}><AuthPageContent /></Suspense>; }
