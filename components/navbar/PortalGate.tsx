'use client';

import Link from 'next/link';
import { ArrowRight, HeartPulse, LoaderCircle, ShieldCheck } from 'lucide-react';

interface PortalGateProps {
  eyebrow: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondaryAction?: () => void;
  loading?: boolean;
  detail?: string;
}

export function PortalGate({ eyebrow, title, description, actionLabel, onAction, secondaryLabel, onSecondaryAction, loading = false, detail }: PortalGateProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 px-5 py-7 text-slate-800">
      <Link href="/" aria-label="CuraLink home" className="flex w-fit items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-600"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700 text-white"><HeartPulse size={22} aria-hidden="true" /></span><span className="text-xl font-bold tracking-tight">Cura<span className="text-teal-700">Link</span></span></Link>
      <div className="flex flex-1 items-center justify-center py-12">
        <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-[0_12px_48px_-24px_rgba(15,23,42,0.15)] sm:p-10" role={loading ? 'status' : undefined}>
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">{loading ? <LoaderCircle className="motion-safe:animate-spin" size={24} aria-hidden="true" /> : <ShieldCheck size={26} aria-hidden="true" />}</div>
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-teal-700">{eyebrow}</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-500">{description}</p>
          {detail && <p className="mt-4 break-words rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500">{detail}</p>}
          {actionLabel && onAction && <button type="button" onClick={onAction} className="care-button mt-7 w-full justify-center">{actionLabel}<ArrowRight size={16} aria-hidden="true" /></button>}
          {secondaryLabel && onSecondaryAction && <button type="button" onClick={onSecondaryAction} className="mt-3 min-h-11 rounded-xl px-4 text-sm font-medium text-slate-500 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-teal-600">{secondaryLabel}</button>}
        </div>
      </div>
    </div>
  );
}
