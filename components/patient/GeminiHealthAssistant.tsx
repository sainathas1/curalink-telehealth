'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Sparkles, Pill, FileText, RefreshCw, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';
import type { Prescription, MedicalRecord } from '../../lib/types';
import type { PatientTab } from '../navbar/Sidebar';

interface GeminiHealthAssistantProps {
  prescriptions: Prescription[];
  records: MedicalRecord[];
  patientName?: string;
  onNavigateTab?: (tab: PatientTab) => void;
  className?: string;
}

export function GeminiHealthAssistant({
  prescriptions = [],
  records = [],
  patientName = 'there',
  onNavigateTab,
  className = '',
}: GeminiHealthAssistantProps) {
  const [summary, setSummary] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const hasFetchedRef = useRef<boolean>(false);
  const cacheKeyRef = useRef<string>('');

  const activePrescriptions = (prescriptions || []).filter(
    (p) => (p?.status || '').toLowerCase() === 'active'
  );
  const safeRecords = records || [];

  // Stable cache key based on counts and IDs
  const currentKey = `${activePrescriptions.map((p) => p.id).join(',')}_${safeRecords.map((r) => r.id).join(',')}_${patientName}`;

  const fetchSummary = useCallback(async (force = false) => {
    if (!force && hasFetchedRef.current && cacheKeyRef.current === currentKey) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/patient-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prescriptions: activePrescriptions,
          records: safeRecords,
          patientName,
        }),
      });

      if (!response.ok) {
        throw new Error('AI Summary currently unavailable');
      }

      const data = await response.json();
      if (!data || !data.summary) {
        throw new Error('AI Summary currently unavailable');
      }

      setSummary(data.summary);
      hasFetchedRef.current = true;
      cacheKeyRef.current = currentKey;
      setLastUpdated(
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      );
    } catch (err: any) {
      console.warn('Gemini Health Assistant summary notice:', err?.message);
      setSummary('AI Summary currently unavailable');
    } finally {
      setIsLoading(false);
    }
  }, [activePrescriptions, safeRecords, patientName, currentKey]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return (
    <aside
      aria-label="Gemini Health Assistant Overview"
      className={`relative overflow-hidden rounded-3xl border border-teal-200/80 bg-gradient-to-br from-teal-50/70 via-white to-emerald-50/50 p-5 sm:p-6 shadow-sm transition-all duration-200 ${className}`}
    >
      {/* Decorative ambient top glow */}
      <div
        className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-gradient-to-br from-teal-400/15 via-emerald-400/10 to-transparent blur-2xl"
        aria-hidden="true"
      />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Header Badge */}
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-600 to-emerald-700 text-white shadow-md shadow-teal-700/20">
            <Sparkles size={20} className={isLoading ? 'animate-spin' : 'animate-pulse text-amber-200'} aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold tracking-tight text-slate-900 sm:text-base">
                Gemini Health Assistant
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-white/90 px-2.5 py-0.5 text-[10px] font-bold text-teal-800 shadow-2xs">
                <ShieldCheck size={11} className="text-teal-600" />
                Care Summary
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Personalized AI clarity on your prescriptions and records
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {lastUpdated && !isLoading && (
            <span className="text-[11px] font-medium text-slate-400 hidden sm:inline">
              Updated {lastUpdated}
            </span>
          )}
          <button
            type="button"
            onClick={() => fetchSummary(true)}
            disabled={isLoading}
            title="Refresh AI health summary"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white/80 px-3 text-xs font-semibold text-slate-600 transition hover:bg-white hover:text-teal-800 hover:border-teal-200 active:scale-[0.98] disabled:opacity-50"
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin text-teal-600' : ''} />
            <span className="hidden xs:inline">{isLoading ? 'Updating…' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Main AI Summary Box */}
      <div className="relative mt-4 rounded-2xl border border-teal-100 bg-white/90 p-4 sm:p-5 shadow-2xs backdrop-blur-sm">
        {isLoading ? (
          <div className="space-y-2 py-1">
            <div className="skeleton h-4 w-5/6 rounded-md bg-teal-100/60" />
            <div className="skeleton h-4 w-2/3 rounded-md bg-teal-100/40" />
          </div>
        ) : error ? (
          <div className="text-xs text-rose-700 flex items-center justify-between gap-2">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => fetchSummary(true)}
              className="font-bold underline hover:text-rose-900"
            >
              Try again
            </button>
          </div>
        ) : (
          <p className="text-sm sm:text-base font-medium leading-relaxed text-slate-800">
            {summary}
          </p>
        )}

        {/* Contextual Quick Links */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          {activePrescriptions.length > 0 && onNavigateTab && (
            <button
              type="button"
              onClick={() => onNavigateTab('prescriptions')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800 transition hover:bg-teal-100 active:scale-[0.98]"
            >
              <Pill size={13} className="text-teal-700" />
              <span>{activePrescriptions.length} Active Prescription{activePrescriptions.length > 1 ? 's' : ''}</span>
              <ArrowRight size={12} className="opacity-70" />
            </button>
          )}

          {safeRecords.length > 0 && onNavigateTab && (
            <button
              type="button"
              onClick={() => onNavigateTab('records')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 active:scale-[0.98]"
            >
              <FileText size={13} className="text-slate-600" />
              <span>{safeRecords.length} Medical Document{safeRecords.length > 1 ? 's' : ''}</span>
              <ArrowRight size={12} className="opacity-70" />
            </button>
          )}

          <div className="ml-auto hidden sm:flex items-center gap-1 text-[11px] font-medium text-slate-400">
            <CheckCircle2 size={12} className="text-teal-600" />
            <span>Synced with medical records</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
