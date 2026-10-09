'use client';

import Link from 'next/link';
import { ArrowRight, HeartPulse, LoaderCircle, ShieldAlert, ShieldCheck, Stethoscope } from 'lucide-react';
import type { ReactNode } from 'react';

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
  icon?: 'shield' | 'loading' | 'alert' | 'stethoscope' | ReactNode;
}

export function PortalGate({
  eyebrow,
  title,
  description,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondaryAction,
  loading = false,
  detail,
  icon,
}: PortalGateProps) {
  const renderIcon = () => {
    if (loading) {
      return <LoaderCircle className="motion-safe:animate-spin text-teal-600" size={28} aria-hidden="true" />;
    }
    if (icon === 'alert') {
      return <ShieldAlert size={28} className="text-amber-600" aria-hidden="true" />;
    }
    if (icon === 'stethoscope') {
      return <Stethoscope size={28} className="text-teal-600" aria-hidden="true" />;
    }
    if (typeof icon === 'object' && icon !== null) {
      return icon;
    }
    return <ShieldCheck size={28} className="text-teal-600" aria-hidden="true" />;
  };

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-gradient-to-b from-slate-50 via-teal-50/20 to-slate-100 px-5 py-7 text-slate-800 antialiased dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 dark:text-slate-100">
      {/* Decorative ambient glow */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-96 w-96 -translate-x-1/2 rounded-full bg-teal-400/15 blur-3xl"
        aria-hidden="true"
      />

      <header className="relative z-10 mx-auto w-full max-w-7xl">
        <Link
          href="/"
          aria-label="CuraLink home"
          className="group inline-flex items-center gap-2.5 rounded-xl p-1 transition-all focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-600"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-700 text-white shadow-md shadow-teal-700/20 transition-transform duration-200 group-hover:scale-105 active:scale-95">
            <HeartPulse size={22} aria-hidden="true" />
          </span>
          <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Cura<span className="text-teal-600 dark:text-teal-400">Link</span>
          </span>
        </Link>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center py-10 sm:py-16">
        <div
          className="w-full max-w-lg rounded-3xl border border-slate-200/60 bg-white/75 p-8 text-center shadow-[0_20px_60px_-15px_rgba(15,23,42,0.08)] backdrop-blur-xl transition-all dark:border-slate-800/60 dark:bg-slate-900/75 dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.4)] sm:p-11"
          role={loading ? 'status' : undefined}
          aria-live="polite"
        >
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-teal-100 bg-teal-50/80 shadow-xs dark:border-teal-900/40 dark:bg-teal-950/40">
            {renderIcon()}
          </div>

          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-teal-700 dark:text-teal-400">
            {eyebrow}
          </p>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            {title}
          </h1>

          <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            {description}
          </p>

          {detail && (
            <p className="mt-4 break-words rounded-2xl border border-slate-200/50 bg-slate-100/60 px-4 py-3 font-mono text-xs text-slate-600 dark:border-slate-800/50 dark:bg-slate-800/50 dark:text-slate-400">
              {detail}
            </p>
          )}

          <div className="mt-8 flex flex-col gap-3">
            {actionLabel && onAction && (
              <button
                type="button"
                onClick={onAction}
                className="care-button inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-5 text-sm font-semibold shadow-md shadow-teal-700/15 transition-all duration-200 hover:shadow-lg active:scale-[0.98]"
              >
                {actionLabel}
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            )}

            {secondaryLabel && onSecondaryAction && (
              <button
                type="button"
                onClick={onSecondaryAction}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl px-4 text-sm font-medium text-slate-500 transition-all duration-200 hover:bg-slate-100/80 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-teal-600 active:scale-[0.98] dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-white"
              >
                {secondaryLabel}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
