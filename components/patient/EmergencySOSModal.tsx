'use client';

import { useEffect, useRef } from 'react';
import { AlertTriangle, HeartPulse, PhoneCall, UserRound, X } from 'lucide-react';
import { useTelehealth } from '../../context/TelehealthContext';
import type { LiveTelemetryPayload } from '../../lib/types';

interface EmergencySOSModalProps {
  isOpen: boolean;
  onClose: () => void;
  telemetry: LiveTelemetryPayload;
  patientName?: string;
}

function contactPhoneNumber(contact: string | undefined): string {
  const candidate = contact?.match(/\+?\d[\d\s().-]{5,}\d/)?.[0];
  const normalized = candidate?.replace(/[\s().-]/g, '') || '';
  return /^\+?\d{7,15}$/.test(normalized) ? normalized : '';
}

function reading(value: number, unit: string): string {
  return Number.isFinite(value) && value > 0 ? `${value}${unit}` : 'Unavailable';
}

export function EmergencySOSModal({
  isOpen,
  onClose,
  telemetry,
  patientName = 'Patient',
}: EmergencySOSModalProps) {
  const { currentUser, isSimulating } = useTelehealth();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const emergencyContact = currentUser?.emergencyContact?.trim();
  const emergencyPhone = contactPhoneNumber(emergencyContact);
  const hasDeviceReadings = telemetry.sensorConnected && !isSimulating;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (isOpen && dialog && !dialog.open) dialog.showModal();
    if (!isOpen && dialog?.open) dialog.close();
  }, [isOpen]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="emergency-help-title"
      aria-describedby="emergency-help-description"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      className="m-auto max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-3xl border-0 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-950/50"
    >
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-700">
            <AlertTriangle className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <h2 id="emergency-help-title" className="text-xl font-semibold tracking-tight">Get urgent help</h2>
            <p className="mt-1 text-sm text-slate-500">For {patientName}</p>
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close emergency help" className="-mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-rose-700">
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <div className="space-y-5 p-6">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
          <div className="flex items-start gap-3">
            <PhoneCall className="mt-1 h-5 w-5 shrink-0 text-rose-700" aria-hidden="true" />
            <div>
              <h3 className="text-base font-semibold text-rose-900">Call your local emergency number</h3>
              <p className="mt-2 text-sm leading-6 text-rose-800">If you need immediate medical help, call emergency services directly or ask someone nearby to call for you.</p>
            </div>
          </div>
        </div>
        <p id="emergency-help-description" className="text-sm leading-6 text-slate-600">CuraLink has not dispatched an ambulance, contacted emergency services, or notified your clinician. Use your phone to request help directly.</p>

        <section aria-label="Saved emergency contact" className="rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold"><UserRound className="h-4 w-4 text-teal-700" aria-hidden="true" />Your emergency contact</div>
          {emergencyContact ? <>
            <p className="mt-2 break-words text-sm leading-6 text-slate-600">{emergencyContact}</p>
            {emergencyPhone ? <a href={`tel:${emergencyPhone}`} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"><PhoneCall className="h-4 w-4" aria-hidden="true" />Call your emergency contact</a> : <p className="mt-3 text-xs leading-5 text-slate-500">A callable phone number is not saved. Contact this person using your phone.</p>}
          </> : <p className="mt-2 text-sm leading-6 text-slate-500">No emergency contact is saved in your profile. Ask someone nearby to help you call.</p>}
        </section>

        <section aria-label="Device readings" className="rounded-2xl bg-slate-50 p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><HeartPulse className="h-4 w-4 text-slate-500" aria-hidden="true" />Latest device readings</h3>
          {hasDeviceReadings ? <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
            <div><dt className="text-xs text-slate-500">Heart rate</dt><dd className="mt-1 font-semibold tabular-nums">{reading(telemetry.heartRate, ' bpm')}</dd></div>
            <div><dt className="text-xs text-slate-500">Oxygen</dt><dd className="mt-1 font-semibold tabular-nums">{reading(telemetry.spo2, '%')}</dd></div>
            <div><dt className="text-xs text-slate-500">Temperature</dt><dd className="mt-1 font-semibold tabular-nums">{reading(telemetry.temperature, '°C')}</dd></div>
          </dl> : <p className="mt-2 text-sm leading-6 text-slate-500">No live device readings are available.</p>}
          <p className="mt-3 text-xs leading-5 text-slate-500">Readings are not sent to emergency services from this dialog.</p>
        </section>
        <button type="button" onClick={onClose} className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">Back to dashboard</button>
      </div>
    </dialog>
  );
}
