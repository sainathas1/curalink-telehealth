'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { collection, doc, getDocs, query, where } from 'firebase/firestore';
import { ArrowLeft, ArrowRight, Calendar, Check, CheckCircle2, CreditCard, LoaderCircle, Search, ShieldCheck, X } from 'lucide-react';
import { auth, db } from '../../lib/firebase';
import type { Appointment } from '../../lib/types';
import { useTelehealth } from '../../context/TelehealthContext';

export interface ClinicianOption {
  id: string;
  name: string;
  specialty: string;
  avatar: string;
}

interface BookAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBook: (newAppointment: Appointment) => Promise<void>;
  patientName: string;
  patientId: string;
}

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayCheckout {
  open: () => void;
  on: (event: 'payment.failed', handler: (response: { error?: { description?: string } }) => void) => void;
}

type RazorpayConstructor = new (options: Record<string, unknown>) => RazorpayCheckout;
type CheckoutWindow = Window & { Razorpay?: RazorpayConstructor };

const TIME_SLOTS = ['09:00 AM - 09:30 AM', '10:00 AM - 10:30 AM', '02:30 PM - 03:00 PM', '04:30 PM - 05:00 PM'];
const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/10';

/** Canonical dates for the next seven days in the clinic's India Standard Time. */
export function generateAvailableDates(count = 7): string[] {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);
  return Array.from({ length: count }, (_, index) => new Date(Date.UTC(value('year'), value('month') - 1, value('day') + index + 1)).toISOString().slice(0, 10));
}

export function formatAppointmentDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value + 'T12:00:00+05:30');
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(parsed);
}

async function loadRazorpay(): Promise<RazorpayConstructor> {
  const checkoutWindow = window as CheckoutWindow;
  if (checkoutWindow.Razorpay) return checkoutWindow.Razorpay;
  await new Promise<void>((resolve, reject) => {
    const existing = document.getElementById('curalink-razorpay-sdk') as HTMLScriptElement | null;
    const script = existing || document.createElement('script');
    const timer = window.setTimeout(() => reject(new Error('The payment checkout took too long to load. Please try again.')), 15000);
    script.addEventListener('load', () => { window.clearTimeout(timer); resolve(); }, { once: true });
    script.addEventListener('error', () => { window.clearTimeout(timer); script.remove(); reject(new Error('Payment checkout could not load. Please check your connection.')); }, { once: true });
    if (!existing) {
      script.id = 'curalink-razorpay-sdk';
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      document.body.appendChild(script);
    }
  });
  if (!checkoutWindow.Razorpay) throw new Error('Payment checkout is unavailable. Please try again.');
  return checkoutWindow.Razorpay;
}

export function BookAppointmentModal({ isOpen, onClose, onBook, patientName, patientId }: BookAppointmentModalProps) {
  const { currentUser } = useTelehealth();
  const [step, setStep] = useState<'details' | 'review'>('details');
  const [doctors, setDoctors] = useState<ClinicianOption[]>([]);
  const [isLoadingDoctors, setIsLoadingDoctors] = useState(true);
  const [doctorsError, setDoctorsError] = useState('');
  const [reloadDoctors, setReloadDoctors] = useState(0);
  const [search, setSearch] = useState('');
  const [specialty, setSpecialty] = useState('All');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const dates = useMemo(() => isOpen ? generateAvailableDates() : [], [isOpen]);
  const [date, setDate] = useState(() => generateAvailableDates()[0]);
  const [time, setTime] = useState(TIME_SLOTS[1]);
  const [visitType, setVisitType] = useState<Appointment['type']>('Video Call');
  const [symptoms, setSymptoms] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [savedAppointment, setSavedAppointment] = useState<Appointment | null>(null);
  const [paymentReceipt, setPaymentReceipt] = useState<RazorpayResponse | null>(null);
  const paymentReceiptRef = useRef<RazorpayResponse | null>(null);
  const appointmentIdRef = useRef('');
  const savingRef = useRef(false);
  const launchingRef = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [isOpen]);

  useEffect(() => {
    if (savedAppointment) closeRef.current?.focus();
  }, [savedAppointment]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const verified = query(collection(db, 'users'), where('role', 'in', ['doctor', 'Doctor']), where('isVerified', '==', true));
    getDocs(verified).then((snapshot) => {
      if (cancelled) return;
      const options = snapshot.docs.filter((entry) => entry.data().isVerified === true && String(entry.data().role).toLowerCase() === 'doctor').map((entry) => {
        const profile = entry.data();
        return { id: entry.id, name: profile.fullName || profile.name || 'Clinician', specialty: profile.specialty || 'General medicine', avatar: profile.avatarUrl || profile.photoURL || '' };
      });
      setDoctors(options);
      setSelectedDoctorId((previous) => options.some((doctor) => doctor.id === previous) ? previous : '');
    }).catch(() => {
      if (!cancelled) { setDoctors([]); setDoctorsError('We could not load the doctor directory. Please try again.'); }
    }).finally(() => { if (!cancelled) setIsLoadingDoctors(false); });
    return () => { cancelled = true; };
  }, [isOpen, reloadDoctors]);

  const selectedDoctor = doctors.find((doctor) => doctor.id === selectedDoctorId);
  const specialties = ['All', ...Array.from(new Set(doctors.map((doctor) => doctor.specialty)))];
  const visibleDoctors = doctors.filter((doctor) => (specialty === 'All' || doctor.specialty === specialty) && (doctor.name + ' ' + doctor.specialty).toLowerCase().includes(search.trim().toLowerCase()));
  const hasValidPatient = currentUser?.uid === patientId && currentUser.role.toLowerCase() === 'patient';
  const selectedDate = dates.includes(date) || paymentReceipt ? date : dates[0] || '';
  const canContinue = hasValidPatient && !!selectedDoctor && dates.includes(selectedDate) && !isLoadingDoctors;

  const handleClose = () => {
    if (isProcessing) return;
    if (savedAppointment) {
      setSavedAppointment(null);
      setPaymentReceipt(null);
      paymentReceiptRef.current = null;
      appointmentIdRef.current = '';
      setStep('details');
      setSymptoms('');
      setError('');
    }
    setIsLoadingDoctors(true);
    setDoctorsError('');
    onClose();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') { event.preventDefault(); handleClose(); }
    if (event.key !== 'Tab') return;
    const controls = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]');
    if (!controls?.length) return;
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  const saveAppointment = async (receipt: RazorpayResponse | null = paymentReceiptRef.current) => {
    if (savingRef.current) return;
    if (!selectedDoctor || !hasValidPatient || !currentUser) {
      setError('Your account or selected clinician could not be confirmed. Please reopen booking and try again.');
      return;
    }
    savingRef.current = true;
    setIsProcessing(true);
    setError('');
    if (!appointmentIdRef.current) appointmentIdRef.current = doc(collection(db, 'appointments')).id;
    const id = appointmentIdRef.current;
    const appointment: Appointment = {
      id, patientId: currentUser.uid, patientName: patientName || currentUser.fullName,
      patientEmail: currentUser.email, patientPhone: currentUser.phoneNumber || '',
      doctorId: selectedDoctor.id, doctorName: selectedDoctor.name,
      doctorSpecialty: selectedDoctor.specialty, doctorAvatar: selectedDoctor.avatar,
      date: selectedDate, time, type: visitType, status: 'scheduled', symptoms: symptoms.trim(),
      meetingLink: '/call/' + id, bloodGroup: currentUser.bloodGroup || currentUser.bloodType || '',
      knownAllergies: currentUser.knownAllergies || currentUser.allergies?.join(', ') || '',
      chronicConditions: currentUser.chronicConditions || [], currentMedications: currentUser.currentMedications || '',
      emergencyContact: currentUser.emergencyContact || '', paymentStatus: 'Pending', paymentAmount: 500,
      paymentMethod: receipt ? 'Razorpay' : 'Payment pending', paymentTxnId: receipt?.razorpay_payment_id || '',
      createdAt: new Date().toISOString(),
    };
    try {
      // The context callback is the only appointment writer. Reuse this id on retries.
      await onBook(appointment);
      setSavedAppointment(appointment);
    } catch {
      setError(receipt ? 'Your payment response was received, but the appointment could not be saved. Retry saving below; do not make another payment.' : 'Your appointment could not be saved. Please check your connection and try again.');
    } finally {
      savingRef.current = false;
      setIsProcessing(false);
    }
  };

  const handleRazorpay = async () => {
    if (!canContinue || isProcessing || launchingRef.current || paymentReceiptRef.current) return;
    launchingRef.current = true;
    setIsProcessing(true);
    setError('');
    try {
      const key = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
      if (!key) throw new Error('Online payment is currently unavailable. You can book with payment pending.');
      const Razorpay = await loadRazorpay();
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Please sign in again before opening checkout.');
      const response = await fetch('/api/create-order', { method: 'POST', headers: { Authorization: 'Bearer ' + token } });
      const order = await response.json();
      if (!response.ok || order.fallback || typeof order.orderId !== 'string' || !order.orderId.startsWith('order_') || order.amount !== 50000 || order.currency !== 'INR') throw new Error('Payment checkout is unavailable. Please try again or book with payment pending.');
      const checkout = new Razorpay({
        key, amount: order.amount, currency: order.currency, order_id: order.orderId,
        name: 'CuraLink Telehealth', description: 'Consultation with ' + selectedDoctor?.name,
        prefill: { name: currentUser?.fullName || patientName, email: currentUser?.email || '', contact: currentUser?.phoneNumber || '' },
        theme: { color: '#0f766e' },
        handler: (receipt: RazorpayResponse) => {
          launchingRef.current = false;
          if (!receipt.razorpay_payment_id || receipt.razorpay_order_id !== order.orderId || !receipt.razorpay_signature) {
            setError('The payment response was incomplete. Check your payment status before trying again.');
            setIsProcessing(false);
            return;
          }
          paymentReceiptRef.current = receipt;
          setPaymentReceipt(receipt);
          void saveAppointment(receipt);
        },
        modal: { ondismiss: () => { launchingRef.current = false; if (!savingRef.current) setIsProcessing(false); } },
      });
      checkout.on('payment.failed', ({ error: paymentError }) => {
        launchingRef.current = false;
        setIsProcessing(false);
        setError(paymentError?.description || 'The payment did not complete. No appointment has been saved.');
      });
      checkout.open();
    } catch (checkoutError) {
      launchingRef.current = false;
      setIsProcessing(false);
      setError(checkoutError instanceof Error ? checkoutError.message : 'Checkout could not open. Please try again.');
    }
  };

  const handleReview = (event: FormEvent) => {
    event.preventDefault();
    if (!canContinue) return;
    setError('');
    setStep('review');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-3 backdrop-blur-sm sm:p-6">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="booking-title" onKeyDown={handleKeyDown} className="flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-5 sm:px-7">
          <div><p className="care-eyebrow mb-2">Your next step to better care</p><h2 id="booking-title" className="text-xl font-semibold tracking-tight text-slate-900">{savedAppointment ? 'Your visit is booked' : step === 'review' ? 'Review your appointment' : 'Find the right care'}</h2><p className="mt-1 text-xs text-slate-500">{savedAppointment ? 'Your appointment has been saved to your account.' : 'Choose a verified clinician and a preferred consultation time.'}</p></div>
          <button ref={closeRef} type="button" onClick={handleClose} disabled={isProcessing} aria-label="Close booking" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-teal-600 disabled:opacity-40"><X size={20} aria-hidden="true" /></button>
        </div>
        <div className="overflow-y-auto p-5 sm:p-7">
          {error && <p role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
          {savedAppointment ? <div className="text-center"><span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-teal-50 text-teal-700"><CheckCircle2 size={30} aria-hidden="true" /></span><h3 className="text-lg font-semibold text-slate-900">{savedAppointment.doctorName}</h3><p className="mt-1 text-sm text-slate-500">{formatAppointmentDate(savedAppointment.date)} · {savedAppointment.time}</p><p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm leading-relaxed text-amber-800">{paymentReceipt ? 'A payment response was received. Payment remains pending until it is confirmed.' : 'Your consultation fee is pending. No payment has been taken by this booking.'}</p>{paymentReceipt && <p className="mt-3 break-all text-xs text-slate-400">Payment reference: {paymentReceipt.razorpay_payment_id}</p>}<button type="button" onClick={handleClose} className="care-button mt-6 w-full justify-center">Done<Check size={16} aria-hidden="true" /></button></div> : step === 'review' ? <div className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><p className="text-base font-semibold text-slate-900">{selectedDoctor?.name}</p><p className="mt-1 text-sm text-teal-700">{selectedDoctor?.specialty}</p><div className="mt-4 space-y-2 text-sm text-slate-500"><p>{formatAppointmentDate(selectedDate)} · {time}</p><p>{visitType} · India Standard Time</p>{symptoms && <p className="border-t border-slate-200 pt-3">{symptoms}</p>}</div><div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4"><span className="text-sm text-slate-500">Consultation fee</span><strong className="text-lg text-slate-900">₹500</strong></div></div>
            <div className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4"><CreditCard size={20} className="mt-0.5 shrink-0 text-teal-700" aria-hidden="true" /><div><h3 className="text-sm font-semibold text-slate-800">Payment options</h3><p className="mt-1 text-xs leading-relaxed text-slate-500">Use Razorpay for card, UPI, or bank payments, or book with the fee pending. Payment status will show as pending until confirmed.</p></div></div>
            {paymentReceipt ? <button type="button" disabled={isProcessing} onClick={() => void saveAppointment()} className="care-button w-full justify-center">{isProcessing ? <LoaderCircle size={16} className="motion-safe:animate-spin" aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}Retry saving appointment</button> : <><button type="button" disabled={isProcessing || !canContinue} onClick={() => void handleRazorpay()} className="care-button w-full justify-center">{isProcessing ? <LoaderCircle size={16} className="motion-safe:animate-spin" aria-hidden="true" /> : <ShieldCheck size={16} aria-hidden="true" />}{isProcessing ? 'Please wait…' : 'Pay ₹500 with Razorpay'}</button><button type="button" disabled={isProcessing || !canContinue} onClick={() => void saveAppointment(null)} className="flex min-h-11 w-full items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-teal-600 disabled:opacity-40">Book with payment pending</button></>}
            <button type="button" disabled={isProcessing || !!paymentReceipt} onClick={() => setStep('details')} className="flex min-h-10 items-center gap-2 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-teal-600 disabled:opacity-40"><ArrowLeft size={15} aria-hidden="true" />Edit appointment details</button>
          </div> : <form onSubmit={handleReview} className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2"><div><label htmlFor="doctor-search" className="mb-2 block text-xs font-semibold text-slate-700">Find a clinician</label><div className="relative"><Search size={16} className="absolute left-3 top-3.5 text-slate-400" aria-hidden="true" /><input id="doctor-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name or specialty" className={inputClass + ' pl-9'} /></div></div><div><label htmlFor="doctor-specialty" className="mb-2 block text-xs font-semibold text-slate-700">Specialty</label><select id="doctor-specialty" value={specialty} onChange={(event) => setSpecialty(event.target.value)} className={inputClass}>{specialties.map((value) => <option key={value} value={value}>{value === 'All' ? 'All specialties' : value}</option>)}</select></div></div>
            <fieldset><legend className="mb-3 text-xs font-semibold text-slate-700">Choose your clinician</legend>{isLoadingDoctors ? <p role="status" className="flex items-center gap-2 rounded-xl bg-slate-50 p-5 text-sm text-slate-500"><LoaderCircle size={17} className="motion-safe:animate-spin" aria-hidden="true" />Loading verified clinicians…</p> : doctorsError ? <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700"><p>{doctorsError}</p><button type="button" onClick={() => { setIsLoadingDoctors(true); setDoctorsError(''); setReloadDoctors((count) => count + 1); }} className="mt-2 min-h-10 rounded-lg font-semibold underline focus-visible:outline-2 focus-visible:outline-rose-600">Try again</button></div> : visibleDoctors.length === 0 ? <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center"><p className="text-sm font-medium text-slate-700">{doctors.length ? 'No matching clinicians' : 'No verified clinicians available yet'}</p><p className="mt-1 text-xs text-slate-500">{doctors.length ? 'Try a different name or specialty.' : 'Please check again after clinician credentials have been approved.'}</p></div> : <div className="grid max-h-56 gap-2 overflow-y-auto sm:grid-cols-2">{visibleDoctors.map((doctor) => <label key={doctor.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 ${selectedDoctorId === doctor.id ? 'border-teal-600 bg-teal-50/60' : 'border-slate-200 hover:bg-slate-50'}`}><input type="radio" name="clinician" value={doctor.id} checked={selectedDoctorId === doctor.id} onChange={() => setSelectedDoctorId(doctor.id)} className="h-4 w-4 shrink-0 accent-teal-700" /><span className="min-w-0"><span className="block truncate text-sm font-semibold text-slate-900">{doctor.name}</span><span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{doctor.specialty}</span></span></label>)}</div>}</fieldset>
            <div className="grid gap-3 sm:grid-cols-3"><div><label htmlFor="visit-type" className="mb-2 block text-xs font-semibold text-slate-700">Visit type</label><select id="visit-type" value={visitType} onChange={(event) => setVisitType(event.target.value as Appointment['type'])} className={inputClass}><option>Video Call</option><option>In-Person Consultation</option><option>Routine Checkup</option></select></div><div><label htmlFor="visit-date" className="mb-2 block text-xs font-semibold text-slate-700">Preferred date</label><select id="visit-date" value={selectedDate} onChange={(event) => setDate(event.target.value)} className={inputClass}>{dates.map((value) => <option key={value} value={value}>{formatAppointmentDate(value)}</option>)}</select></div><div><label htmlFor="visit-time" className="mb-2 block text-xs font-semibold text-slate-700">Preferred time</label><select id="visit-time" value={time} onChange={(event) => setTime(event.target.value)} className={inputClass}>{TIME_SLOTS.map((value) => <option key={value}>{value}</option>)}</select></div></div>
            <p className="text-[11px] text-slate-400">Times are shown in India Standard Time. Your care team can update the appointment if a different time is needed.</p>
            <div><label htmlFor="visit-reason" className="mb-2 block text-xs font-semibold text-slate-700">What would you like help with? <span className="font-normal text-slate-400">(optional)</span></label><textarea id="visit-reason" value={symptoms} maxLength={2000} onChange={(event) => setSymptoms(event.target.value)} rows={3} placeholder="Share symptoms, questions, or the reason for your visit." className={inputClass} /></div>
            <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-5"><div><p className="text-xs text-slate-500">Consultation fee</p><p className="mt-1 text-lg font-semibold text-slate-900">₹500</p></div><button type="submit" disabled={!canContinue} className="care-button">{hasValidPatient ? 'Review appointment' : 'Sign in required'}<ArrowRight size={16} aria-hidden="true" /></button></div>
          </form>}
        </div>
      </div>
    </div>
  );
}
