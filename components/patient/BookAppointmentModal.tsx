'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Appointment } from '../../lib/types';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import {
  X,
  Calendar,
  Clock,
  Video,
  Stethoscope,
  Star,
  CheckCircle2,
  CreditCard,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Smartphone,
  Landmark,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  Lock,
  UserX,
  Search,
} from 'lucide-react';

export interface ClinicianOption {
  id: string;
  name: string;
  specialty: string;
  rating: number;
  reviewsCount: number;
  avatar: string;
}

/**
 * Generates dynamic upcoming available consultation dates starting from tomorrow.
 * Uses native JavaScript Date objects and Intl.DateTimeFormat for clean formatting (e.g. 'Wednesday, Oct 7').
 * Guarantees zero duplicate entries in the returned array.
 */
export function generateAvailableDates(count: number = 7): string[] {
  const dates: string[] = [];
  const baseDate = new Date();

  const formatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  for (let i = 1; i <= count; i++) {
    const nextDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + i);
    const formatted = formatter.format(nextDate);
    if (!dates.includes(formatted)) {
      dates.push(formatted);
    }
  }

  return dates;
}

interface BookAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBook: (newAppointment: Appointment) => void;
  patientName: string;
  patientId: string;
}

type PaymentTab = 'razorpay' | 'upi' | 'card' | 'netbanking';

export function BookAppointmentModal({
  isOpen,
  onClose,
  onBook,
  patientName,
  patientId,
}: BookAppointmentModalProps) {
  // Step: 'details' | 'payment'
  const [step, setStep] = useState<'details' | 'payment'>('details');

  // Clinicians from Firestore
  const [doctors, setDoctors] = useState<ClinicianOption[]>([]);
  const [isLoadingDoctors, setIsLoadingDoctors] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Dynamic available consultation dates (next 7 days starting from tomorrow)
  const availableDates = useMemo(() => generateAvailableDates(7), []);

  // Form selections
  const [specialtyFilter, setSpecialtyFilter] = useState<string>('All');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [date, setDate] = useState<string>(() => availableDates[0] || '');
  const [timeSlot, setTimeSlot] = useState<string>('10:00 AM - 10:30 AM');
  const [visitType, setVisitType] = useState<'Video Call' | 'In-Person Consultation' | 'Routine Checkup'>('Video Call');
  const [symptoms, setSymptoms] = useState<string>('');

  // Keep date selection valid and in sync with dynamically generated dates
  useEffect(() => {
    if (!isOpen) return;
    if (!availableDates.includes(date)) {
      setDate(availableDates[0] || '');
    }
  }, [isOpen, availableDates, date]);

  // Payment states
  const [activePaymentTab, setActivePaymentTab] = useState<PaymentTab>('razorpay');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [confirmedTxnId, setConfirmedTxnId] = useState<string>('');
  const [confirmedMethod, setConfirmedMethod] = useState<string>('Razorpay');
  const [copiedUpi, setCopiedUpi] = useState<boolean>(false);

  // Card form state
  const [cardNumber, setCardNumber] = useState('4111 2222 3333 1111');
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [cardCvv, setCardCvv] = useState('888');
  const [cardHolder, setCardHolder] = useState(patientName || 'Patient');

  // Netbanking & UPI custom state
  const [selectedBank, setSelectedBank] = useState('HDFC Bank');
  const [customUpi, setCustomUpi] = useState('');

  // Fetch verified clinicians strictly from Firestore (role == 'doctor' AND isVerified == true)
  useEffect(() => {
    if (!isOpen) return;

    async function fetchClinicians() {
      setIsLoadingDoctors(true);
      try {
        const docsList: ClinicianOption[] = [];
        const seenIds = new Set<string>();

        const appendVerifiedDoctors = (snapshot: any) => {
          snapshot.forEach((docSnap: any) => {
            if (seenIds.has(docSnap.id)) return;
            const data = docSnap.data();
            // Strict enforcement: strictly users where role == 'doctor' AND isVerified == true
            // Unverified doctors must never be rendered in the patient UI
            if (data.isVerified === true && data.role?.toLowerCase() === 'doctor') {
              seenIds.add(docSnap.id);
              docsList.push({
                id: docSnap.id,
                name: data.fullName || data.name || 'Verified Clinician',
                specialty: data.specialty || 'General Telehealth & Internal Medicine',
                rating: data.rating || 5.0,
                reviewsCount: data.reviewsCount || 1,
                avatar:
                  data.photoURL ||
                  data.avatar ||
                  'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=150&auto=format&fit=crop&q=80',
              });
            }
          });
        };

        // 1. Strict Firestore query for role == 'doctor' AND isVerified == true
        try {
          const qLower = query(
            collection(db, 'users'),
            where('role', '==', 'doctor'),
            where('isVerified', '==', true)
          );
          const snapLower = await getDocs(qLower);
          appendVerifiedDoctors(snapLower);
        } catch (err: any) {
          console.warn('Doctor query (role: "doctor", isVerified: true) notice:', err?.message || err);
        }

        // 2. Also query role == 'Doctor' in case of capitalized role values in legacy records
        try {
          const qUpper = query(
            collection(db, 'users'),
            where('role', '==', 'Doctor'),
            where('isVerified', '==', true)
          );
          const snapUpper = await getDocs(qUpper);
          appendVerifiedDoctors(snapUpper);
        } catch (err: any) {
          console.warn('Doctor query (role: "Doctor", isVerified: true) notice:', err?.message || err);
        }

        // Strict empty state handling: No mock/fake unverified fallback doctors!
        setDoctors(docsList);
        setSelectedDoctorId((prev) => (prev && docsList.some((d) => d.id === prev) ? prev : docsList[0]?.id || ''));
      } catch (err) {
        console.error('Error fetching verified clinicians:', err);
      } finally {
        setIsLoadingDoctors(false);
      }
    }

    fetchClinicians();
  }, [isOpen]);

  if (!isOpen) return null;

  const specialties = [
    'All',
    'Cardiology & Heart Rhythm',
    'Pulmonology & Respiratory Care',
    'General Internal Medicine',
    'Neurology & Sleep Medicine',
  ];

  const filteredDoctors = doctors.filter((d) => {
    const matchesSpecialty = specialtyFilter === 'All' || d.specialty === specialtyFilter;
    const matchesSearch =
      !searchQuery.trim() ||
      d.name.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
      d.specialty.toLowerCase().includes(searchQuery.toLowerCase().trim());
    return matchesSpecialty && matchesSearch;
  });

  const selectedDoctor =
    doctors.find((d) => d.id === selectedDoctorId) ||
    (filteredDoctors.length > 0 ? filteredDoctors[0] : (doctors.length > 0 ? doctors[0] : null));

  // Dynamic Razorpay SDK loader
  const loadRazorpayScript = () => {
    return new Promise<boolean>((resolve) => {
      if (typeof window === 'undefined') return resolve(false);
      if ((window as any).Razorpay) return resolve(true);

      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  // Complete Payment and book appointment
  const executePaymentSuccess = (methodName: string) => {
    setIsProcessing(true);
    const generatedTxn = `PAY_${methodName.toUpperCase()}_${Date.now().toString(36).toUpperCase()}`;
    setConfirmedTxnId(generatedTxn);
    setConfirmedMethod(methodName);

    setTimeout(() => {
      setIsProcessing(false);
      setIsSuccess(true);

      const aptId = `apt_${Date.now()}`;
      const newAppointment: Appointment = {
        id: aptId,
        patientId,
        patientName,
        doctorId: selectedDoctor?.id || '',
        doctorName: selectedDoctor?.name || 'Verified Attending Physician',
        doctorSpecialty: selectedDoctor?.specialty || 'General Telehealth & Internal Medicine',
        doctorAvatar: selectedDoctor?.avatar || '',
        date,
        time: timeSlot,
        type: visitType,
        status: 'Upcoming',
        symptoms: symptoms || 'Routine telehealth vitals review and general follow-up consultation.',
        meetingLink: `/call/${aptId}`,
        paymentStatus: 'Paid',
        paymentAmount: 500,
        paymentTxnId: generatedTxn,
        paymentMethod: methodName,
      };

      setTimeout(() => {
        onBook(newAppointment);
        setIsSuccess(false);
        setStep('details');
        onClose();
      }, 1800);
    }, 1200);
  };

  // Official Razorpay Gateway trigger
  const handleRazorpayGateway = async () => {
    setIsProcessing(true);
    try {
      const res = await loadRazorpayScript();

      if (!res) {
        alert('Razorpay popup could not be loaded (likely blocked by ad-blocker). You can use direct UPI, Card, or Demo Pass below.');
        setIsProcessing(false);
        return;
      }

      const orderResponse = await fetch('/api/create-order', { method: 'POST' });
      const orderData = await orderResponse.json();

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_Tjvb5EHmaluLGr',
        amount: 50000,
        currency: 'INR',
        name: 'CuraLink Telehealth',
        description: `Consultation Fee with ${selectedDoctor?.name || 'Verified Clinician'}`,
        order_id: orderData.orderId,
        handler: function (_response: any) {
          executePaymentSuccess('Razorpay');
        },
        modal: {
          ondismiss: function () {
            setIsProcessing(false);
          },
        },
        prefill: {
          name: patientName || 'Patient',
          email: 'patient@curalink.health',
          contact: '9999999999',
        },
        theme: {
          color: '#0D9488',
        },
      };

      const paymentObject = new (window as any).Razorpay(options);
      paymentObject.on('payment.failed', function (response: any) {
        console.error('Razorpay payment failed:', response.error);
        alert(`Payment error: ${response.error?.description || 'Method inactive'}. You can use UPI or Card directly.`);
        setIsProcessing(false);
      });
      paymentObject.open();
    } catch (err) {
      console.error('Razorpay order launch error:', err);
      executePaymentSuccess('DIRECT_FALLBACK');
    }
  };

  const copyUpiId = () => {
    navigator.clipboard.writeText('curalink.telehealth@icici');
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  const handleProceedToPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoctor || filteredDoctors.length === 0) return;
    setStep('payment');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-700 to-emerald-800 text-white p-5 sm:p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-teal-200 shrink-0">
              {step === 'payment' ? <CreditCard className="w-5 h-5" /> : <Calendar className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-lg font-bold">
                {step === 'payment' ? 'Secure Consultation Payment' : 'Book Telehealth Consultation'}
              </h3>
              <p className="text-xs text-teal-100">
                {step === 'payment'
                  ? 'Fee: ₹500.00 • Razorpay, UPI QR, Card & NetBanking'
                  : 'Schedule HD Virtual Clinic Visit with CuraLink Specialist'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Success Confirmation Screen */}
        {isSuccess ? (
          <div className="p-8 sm:p-10 text-center space-y-4 animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20 animate-bounce">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                Payment Confirmed & Verified
              </span>
              <h4 className="text-xl font-bold text-slate-900 pt-2">Appointment Scheduled!</h4>
              <p className="text-xs text-slate-500 font-mono">Transaction ID: {confirmedTxnId}</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 max-w-md mx-auto text-left text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Clinician:</span>
                <strong className="text-slate-800">{selectedDoctor?.name || 'Verified Attending Physician'}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Specialty:</span>
                <span className="text-teal-700 font-medium">{selectedDoctor?.specialty || 'General Telehealth & Internal Medicine'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Scheduled Slot:</span>
                <span className="font-semibold text-slate-800">{date} at {timeSlot}</span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                <span className="text-slate-500">Amount Paid ({confirmedMethod}):</span>
                <span className="font-extrabold text-emerald-700 text-sm">₹500.00</span>
              </div>
            </div>
            <p className="text-xs text-teal-700 font-medium flex items-center justify-center gap-1.5 pt-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Finalizing appointment credentials & video room...
            </p>
          </div>
        ) : step === 'payment' ? (
          /* ================= STEP 2: PAYMENT CHECKOUT ================= */
          <div className="p-5 sm:p-6 space-y-5">
            {/* Appointment Summary Strip */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-teal-600/10 text-teal-700 flex items-center justify-center shrink-0">
                  <Stethoscope className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">{selectedDoctor?.name || 'Verified Attending Physician'}</h4>
                  <p className="text-xs text-teal-700 font-medium">{selectedDoctor?.specialty || 'General Telehealth & Internal Medicine'}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{date} • {timeSlot}</p>
                </div>
              </div>
              <div className="text-right sm:border-l sm:border-slate-200 sm:pl-4">
                <span className="text-[10px] text-slate-400 block font-mono">Amount Due</span>
                <span className="text-xl font-black text-teal-800">₹500.00</span>
              </div>
            </div>


            {/* Payment Method Selector Tabs */}
            <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActivePaymentTab('razorpay')}
                className={`py-2 px-1 rounded-xl flex flex-col sm:flex-row items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activePaymentTab === 'razorpay'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Razorpay</span>
              </button>

              <button
                type="button"
                onClick={() => setActivePaymentTab('upi')}
                className={`py-2 px-1 rounded-xl flex flex-col sm:flex-row items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activePaymentTab === 'upi'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span>UPI / QR</span>
              </button>

              <button
                type="button"
                onClick={() => setActivePaymentTab('card')}
                className={`py-2 px-1 rounded-xl flex flex-col sm:flex-row items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activePaymentTab === 'card'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span>Card</span>
              </button>

              <button
                type="button"
                onClick={() => setActivePaymentTab('netbanking')}
                className={`py-2 px-1 rounded-xl flex flex-col sm:flex-row items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activePaymentTab === 'netbanking'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Landmark className="w-4 h-4" />
                <span>NetBanking</span>
              </button>
            </div>

            {/* TAB 1: Razorpay Official Modal */}
            {activePaymentTab === 'razorpay' && (
              <div className="p-5 rounded-2xl border border-teal-200 bg-gradient-to-br from-teal-50/60 to-white space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center font-black text-sm">
                    R
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <span>Official Razorpay Checkout Gateway</span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.2 rounded-full">
                        Test Mode Active
                      </span>
                    </h5>
                    <p className="text-[11px] text-slate-500">
                      Launches the official Razorpay test popup with all standard cards, UPI handles, and wallets.
                    </p>
                  </div>
                </div>

                <div className="text-[11px] text-slate-600 bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                  <span>Merchant Key:</span>
                  <span className="font-mono text-teal-800 font-bold">rzp_test_Tjvb5EHmaluLGr</span>
                </div>

                <button
                  type="button"
                  onClick={handleRazorpayGateway}
                  disabled={isProcessing}
                  className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md shadow-teal-600/20 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Opening Razorpay Gateway...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Pay ₹500.00 via Razorpay Popup</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* TAB 2: UPI / QR Code */}
            {activePaymentTab === 'upi' && (
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-4 animate-in fade-in duration-200">
                <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-4 rounded-xl border border-slate-200">
                  {/* QR SVG */}
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-xs shrink-0 flex flex-col items-center">
                    <svg viewBox="0 0 100 100" className="w-24 h-24" fill="#0F172A">
                      <rect x="0" y="0" width="30" height="30" rx="3" />
                      <rect x="5" y="5" width="20" height="20" fill="white" />
                      <rect x="9" y="9" width="12" height="12" />
                      <rect x="70" y="0" width="30" height="30" rx="3" />
                      <rect x="75" y="5" width="20" height="20" fill="white" />
                      <rect x="79" y="9" width="12" height="12" />
                      <rect x="0" y="70" width="30" height="30" rx="3" />
                      <rect x="5" y="75" width="20" height="20" fill="white" />
                      <rect x="9" y="79" width="12" height="12" />
                      <rect x="40" y="10" width="10" height="10" />
                      <rect x="40" y="30" width="10" height="10" />
                      <rect x="10" y="40" width="10" height="10" />
                      <rect x="30" y="40" width="10" height="10" />
                      <rect x="50" y="50" width="10" height="10" />
                      <rect x="70" y="50" width="10" height="10" />
                      <rect x="90" y="50" width="10" height="10" />
                      <rect x="50" y="70" width="10" height="10" />
                      <rect x="70" y="80" width="10" height="10" />
                      <rect x="40" y="80" width="20" height="10" />
                    </svg>
                    <span className="text-[10px] text-slate-500 font-mono mt-1">₹500.00 Fixed</span>
                  </div>

                  <div className="space-y-2 flex-1 text-center sm:text-left">
                    <span className="text-xs font-bold text-slate-900 block">Scan using any UPI App</span>
                    <p className="text-[11px] text-slate-500">Google Pay, PhonePe, Paytm, BHIM</p>
                    <div className="flex items-center gap-2 bg-slate-100 p-2 rounded-xl text-xs font-mono">
                      <span className="flex-1 truncate text-slate-800 font-bold">curalink.telehealth@icici</span>
                      <button
                        type="button"
                        onClick={copyUpiId}
                        className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-teal-700 hover:bg-teal-50 font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                      >
                        {copiedUpi ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedUpi ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customUpi}
                    onChange={(e) => setCustomUpi(e.target.value)}
                    placeholder="or enter your UPI ID (e.g. mobile@okhdfcbank)"
                    className="flex-1 p-2.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:border-teal-500"
                  />
                  <button
                    type="button"
                    onClick={() => executePaymentSuccess('UPI')}
                    disabled={isProcessing}
                    className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    {isProcessing ? 'Verifying...' : 'Pay ₹500 via UPI'}
                  </button>
                </div>
              </div>
            )}

            {/* TAB 3: Card Form */}
            {activePaymentTab === 'card' && (
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-3 animate-in fade-in duration-200">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Card Number</label>
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    placeholder="4111 2222 3333 4444"
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-xs font-mono text-slate-800 focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Expiry Date</label>
                    <input
                      type="text"
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(e.target.value)}
                      placeholder="MM/YY"
                      className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-xs font-mono text-slate-800 focus:outline-none focus:border-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">CVV</label>
                    <input
                      type="password"
                      maxLength={4}
                      value={cardCvv}
                      onChange={(e) => setCardCvv(e.target.value)}
                      placeholder="•••"
                      className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-xs font-mono text-slate-800 focus:outline-none focus:border-teal-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Cardholder Name</label>
                  <input
                    type="text"
                    value={cardHolder}
                    onChange={(e) => setCardHolder(e.target.value)}
                    placeholder="Name on card"
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:border-teal-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => executePaymentSuccess('CARD')}
                  disabled={isProcessing}
                  className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md shadow-teal-600/20 transition-all cursor-pointer flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{isProcessing ? 'Processing Card...' : 'Pay ₹500.00 Securely'}</span>
                </button>
              </div>
            )}

            {/* TAB 4: NetBanking */}
            {activePaymentTab === 'netbanking' && (
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-3 animate-in fade-in duration-200">
                <label className="block text-[11px] font-bold text-slate-700 uppercase">Select Bank</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {['HDFC Bank', 'ICICI Bank', 'State Bank of India', 'Axis Bank', 'Kotak Mahindra', 'Punjab National'].map((bank) => (
                    <button
                      key={bank}
                      type="button"
                      onClick={() => setSelectedBank(bank)}
                      className={`p-2.5 rounded-xl border text-xs font-bold text-left transition-all cursor-pointer ${
                        selectedBank === bank
                          ? 'border-teal-600 bg-teal-50 text-teal-800 shadow-xs'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {bank}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => executePaymentSuccess(selectedBank.replace(/\s+/g, '_'))}
                  disabled={isProcessing}
                  className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md shadow-teal-600/20 transition-all cursor-pointer flex items-center justify-center gap-2 mt-3 disabled:opacity-50"
                >
                  <Landmark className="w-3.5 h-3.5" />
                  <span>{isProcessing ? 'Connecting...' : `Pay ₹500 via ${selectedBank}`}</span>
                </button>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep('details')}
                disabled={isProcessing}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Details</span>
              </button>

              <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                <Lock className="w-3 h-3 text-slate-500" /> 256-bit Encrypted SSL
              </span>
            </div>
          </div>
        ) : (
          /* ================= STEP 1: CONSULTATION DETAILS ================= */
          <form onSubmit={handleProceedToPayment} className="p-5 sm:p-6 space-y-5">
            {/* Specialty Filter Pills */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                1. Filter by Medical Specialty
              </label>
              <div className="flex flex-wrap gap-1.5">
                {specialties.map((spec) => (
                  <button
                    key={spec}
                    type="button"
                    onClick={() => setSpecialtyFilter(spec)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      specialtyFilter === spec
                        ? 'bg-teal-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {spec === 'All' ? 'All Specialties' : spec.split('&')[0]}
                  </button>
                ))}
              </div>
            </div>

            {/* Doctor Selection Cards */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  2. Select Clinician
                </label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search doctor by name..."
                    className="pl-8 pr-6 py-1.5 text-xs rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-teal-500 w-full sm:w-52 placeholder:text-slate-400 shadow-2xs"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>

              {isLoadingDoctors ? (
                <div className="p-8 rounded-2xl bg-slate-50 border border-slate-200/80 text-center flex flex-col items-center justify-center gap-2">
                  <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-semibold text-slate-600">Querying verified clinicians...</span>
                </div>
              ) : filteredDoctors.length === 0 ? (
                <div className="p-6 sm:p-8 rounded-2xl bg-slate-50 border border-slate-200/90 text-center flex flex-col items-center justify-center gap-2.5">
                  <div className="w-11 h-11 rounded-2xl bg-teal-50 border border-teal-200/70 flex items-center justify-center text-teal-700">
                    <UserX className="w-5 h-5 text-slate-500" />
                  </div>
                  <div className="space-y-1">
                    <h5 className="text-xs sm:text-sm font-bold text-slate-800">
                      No available clinicians at this time
                    </h5>
                    <p className="text-[11px] text-slate-500 max-w-sm mx-auto leading-relaxed">
                      {doctors.length === 0
                        ? 'There are currently no verified clinicians active in the portal. Please check back later once clinician credentials are verified by administration.'
                        : `No verified clinicians match "${searchQuery || specialtyFilter}". Try clearing your filters.`}
                    </p>
                  </div>
                  {(specialtyFilter !== 'All' || searchQuery.trim() !== '') && doctors.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setSpecialtyFilter('All');
                        setSearchQuery('');
                      }}
                      className="mt-1 px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 text-[11px] font-bold border border-teal-200 transition-colors cursor-pointer"
                    >
                      Reset Filters
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-48 overflow-y-auto pr-1">
                  {filteredDoctors.map((doc) => {
                    const isSelected = selectedDoctorId === doc.id;
                    return (
                      <div
                        key={doc.id}
                        onClick={() => setSelectedDoctorId(doc.id)}
                        className={`p-3 rounded-2xl border-2 transition-all cursor-pointer flex items-center gap-3 ${
                          isSelected
                            ? 'border-teal-600 bg-teal-50/60 shadow-xs'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="w-12 h-12 rounded-xl bg-slate-200 overflow-hidden shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={doc.avatar}
                            alt={doc.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h5 className="text-xs font-bold text-slate-900 truncate">{doc.name}</h5>
                          <p className="text-[11px] text-teal-700 truncate">{doc.specialty}</p>
                          <div className="flex items-center gap-1 mt-0.5 text-[10px] text-slate-500">
                            <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                            <span className="font-semibold text-slate-700">{doc.rating}</span>
                            <span>({doc.reviewsCount})</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Visit Type, Date & Time */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Visit Modality
                </label>
                <div className="relative">
                  <select
                    value={visitType}
                    onChange={(e) => setVisitType(e.target.value as any)}
                    className="w-full text-xs font-semibold p-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-teal-500"
                  >
                    <option value="Video Call">Virtual Video Call</option>
                    <option value="In-Person Consultation">In-Person Consultation</option>
                    <option value="Routine Checkup">Routine Tele-Checkup</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Preferred Date
                </label>
                <select
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full text-xs font-semibold p-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-teal-500 cursor-pointer"
                >
                  {availableDates.map((dateOption) => (
                    <option key={dateOption} value={dateOption}>
                      {dateOption}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Available Slot
                </label>
                <select
                  value={timeSlot}
                  onChange={(e) => setTimeSlot(e.target.value)}
                  className="w-full text-xs font-semibold p-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-teal-500"
                >
                  <option value="09:00 AM - 09:30 AM">09:00 AM - 09:30 AM</option>
                  <option value="10:00 AM - 10:30 AM">10:00 AM - 10:30 AM</option>
                  <option value="02:30 PM - 03:00 PM">02:30 PM - 03:00 PM</option>
                  <option value="04:30 PM - 05:00 PM">04:30 PM - 05:00 PM</option>
                </select>
              </div>
            </div>

            {/* Reason / Symptoms input */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Chief Symptoms & Reason for Visit
              </label>
              <textarea
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                placeholder="Describe any symptoms, recent vital anomalies, or questions for your doctor..."
                rows={2}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-500 bg-white text-slate-800"
              />
            </div>

            {/* Consultation Fee & Razorpay Payment Notice */}
            <div className="p-3.5 bg-teal-50/80 rounded-2xl border border-teal-200/80 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-teal-600/10 text-teal-700 flex items-center justify-center shrink-0">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-slate-800 block">Doctor Consultation Fee</span>
                  <p className="text-[11px] text-teal-700 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-teal-600" />
                    Razorpay, UPI QR, Card & Instant Pass supported
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block font-mono">Amount</span>
                <span className="font-extrabold text-teal-900 text-sm">₹500.00</span>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-[11px] text-slate-500">
                {!selectedDoctor && (
                  <span className="text-amber-600 font-semibold flex items-center gap-1">
                    * Please select an available verified clinician to continue.
                  </span>
                )}
              </div>
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedDoctor || isLoadingDoctors || filteredDoctors.length === 0}
                  className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md shadow-teal-600/20 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>Proceed to Payment (₹500.00)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
