'use client';

import React from 'react';
import { PhoneCall, MessageSquare, ShieldAlert, AlertTriangle, ShieldCheck } from 'lucide-react';

export const SUPERADMIN_HOTLINE = '8788246552';
export const SUPERADMIN_WHATSAPP = 'https://wa.me/918788246552';

interface EmergencySOSProps {
  variant?: 'banner' | 'card' | 'compact';
  onOpenModal?: () => void;
  className?: string;
}

export function EmergencySOS({ variant = 'banner', onOpenModal, className = '' }: EmergencySOSProps) {
  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <a
          href={`tel:${SUPERADMIN_HOTLINE}`}
          aria-label="Direct call Superadmin Emergency Hotline"
          className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition-colors shadow-2xs"
        >
          <PhoneCall size={13} className="shrink-0" aria-hidden="true" />
          <span>Call SOS {SUPERADMIN_HOTLINE}</span>
        </a>
        <a
          href={SUPERADMIN_WHATSAPP}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="WhatsApp Superadmin Emergency Hotline"
          className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition-colors shadow-2xs"
        >
          <MessageSquare size={13} className="shrink-0" aria-hidden="true" />
          <span>WhatsApp</span>
        </a>
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label="Superadmin Emergency Hotline"
      className={`relative overflow-hidden rounded-3xl border border-rose-200/90 bg-gradient-to-br from-rose-50 via-white to-rose-100/60 p-5 shadow-xs ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-600 text-white shadow-md shadow-rose-600/25">
            <ShieldAlert size={22} aria-hidden="true" />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-2xs">
                <ShieldCheck size={11} aria-hidden="true" />
                Superadmin 24/7 Hotline
              </span>
              <span className="text-[11px] font-semibold text-rose-700">Immediate Clinical Escalation</span>
            </div>
            <h3 className="mt-1 text-base font-bold text-slate-900">
              Emergency SOS Hotline: <span className="font-mono text-rose-700">{SUPERADMIN_HOTLINE}</span>
            </h3>
            <p className="mt-0.5 text-xs text-slate-600">
              Immediate connection to CuraLink Superadmin emergency medical dispatch and duty clinician.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:self-center shrink-0">
          <a
            href={`tel:${SUPERADMIN_HOTLINE}`}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 text-xs font-bold text-white shadow-md shadow-rose-600/30 transition-all hover:bg-rose-700 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-rose-700"
          >
            <PhoneCall size={14} aria-hidden="true" />
            <span>Direct Dial ({SUPERADMIN_HOTLINE})</span>
          </a>

          <a
            href={SUPERADMIN_WHATSAPP}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 text-xs font-bold text-emerald-800 transition-all hover:bg-emerald-100 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-emerald-700"
          >
            <MessageSquare size={14} className="text-emerald-600" aria-hidden="true" />
            <span>WhatsApp Support</span>
          </a>

          {onOpenModal && (
            <button
              type="button"
              onClick={onOpenModal}
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.98]"
            >
              More Options
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
