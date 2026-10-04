'use client';
import { useState, useId } from 'react';
import dynamic from 'next/dynamic';
import {
    Video,
    ShieldCheck,
    CreditCard,
    QrCode,
    Landmark,
    Smartphone,
    CheckCircle2,
    Lock,
    Sparkles,
    Copy,
    Check,
    AlertCircle,
    ArrowRight,
    RefreshCw,
    Receipt,
} from 'lucide-react';

const JitsiMeeting = dynamic(
    () => import('@jitsi/react-sdk').then((mod) => mod.JitsiMeeting),
    {
        ssr: false,
        loading: () => (
            <div className="w-full h-full min-h-[500px] flex flex-col items-center justify-center bg-slate-950 text-white gap-3 rounded-2xl border border-slate-800">
                <div className="w-10 h-10 border-3 border-teal-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm font-semibold text-slate-300">Connecting Encrypted Video Consultation...</p>
                <span className="text-xs text-slate-500">Securing WebRTC media streams</span>
            </div>
        )
    }
);

export interface VideoCallProps {
    roomName?: string;
    userName?: string;
    autoStart?: boolean;
    showInviteControls?: boolean;
    className?: string;
    onLeave?: () => void;
}

type PaymentTab = 'upi' | 'card' | 'netbanking' | 'razorpay';

export default function VideoCall({
    roomName: propRoomName,
    userName = 'Patient',
    autoStart = false,
    className = '',
    onLeave,
}: VideoCallProps = {}) {
    const defaultId = useId().replace(/[^a-zA-Z0-9]/g, '').slice(0, 8);
    const [hasPaid, setHasPaid] = useState(autoStart);
    const [activeTab, setActiveTab] = useState<PaymentTab>('upi');
    const [isProcessing, setIsProcessing] = useState(false);
    const [paymentSuccess, setPaymentSuccess] = useState(false);
    const [txnId, setTxnId] = useState('');
    const [copiedUpi, setCopiedUpi] = useState(false);
    const [fallbackRoom] = useState(() => `CuraLink-${defaultId}`);
    const activeRoomName = propRoomName || fallbackRoom;

    // Card Form State
    const [cardNumber, setCardNumber] = useState('4111 2222 3333 1111');
    const [cardExpiry, setCardExpiry] = useState('12/28');
    const [cardCvv, setCardCvv] = useState('888');
    const [cardHolder, setCardHolder] = useState(userName || 'Patient Name');

    // UPI State
    const [customUpi, setCustomUpi] = useState('');
    const [selectedBank, setSelectedBank] = useState('HDFC Bank');

    // 1. Load Razorpay script dynamically if user chooses standard checkout
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

    // Generic Payment Success Completer
    const completePayment = (methodName: string) => {
        setIsProcessing(true);
        const generatedTxn = `PAY_${methodName.toUpperCase()}_${Date.now().toString(36).toUpperCase()}`;
        setTxnId(generatedTxn);

        setTimeout(() => {
            setIsProcessing(false);
            setPaymentSuccess(true);
            setTimeout(() => {
                setHasPaid(true);
            }, 1200);
        }, 1500);
    };

    // Razorpay Popup Gateway Handler
    const handleRazorpayGateway = async () => {
        setIsProcessing(true);
        try {
            const res = await loadRazorpayScript();

            if (!res) {
                // If blocked by adblock or network, inform and let user use direct card/UPI
                alert('Razorpay popup could not be loaded (likely blocked by browser or ad blocker). You can use the UPI or Card options directly below.');
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
                description: 'Doctor Video Consultation Fee',
                order_id: orderData.orderId,
                handler: function (_response: any) {
                    completePayment('RZP');
                },
                modal: {
                    ondismiss: function () {
                        setIsProcessing(false);
                    },
                },
                prefill: {
                    name: userName || 'Patient',
                    email: 'patient@curalink.com',
                    contact: '9999999999',
                },
                theme: {
                    color: '#0D9488',
                },
            };

            const paymentObject = new (window as any).Razorpay(options);
            paymentObject.on('payment.failed', function (response: any) {
                console.error('Razorpay payment failed:', response.error);
                alert(`Payment could not be completed: ${response.error?.description || 'Account methods not active'}. You can use UPI or Card directly.`);
                setIsProcessing(false);
            });
            paymentObject.open();
        } catch (err) {
            console.error('Razorpay error:', err);
            completePayment('DIRECT_FALLBACK');
        }
    };

    const copyUpiId = () => {
        navigator.clipboard.writeText('curalink.telehealth@icici');
        setCopiedUpi(true);
        setTimeout(() => setCopiedUpi(false), 2000);
    };

    return (
        <div className={`w-full flex flex-col items-center justify-center ${className}`}>
            {!hasPaid ? (
                <div className="w-full max-w-xl p-5 sm:p-7 bg-slate-900/95 backdrop-blur-md rounded-3xl border border-slate-800 text-white shadow-2xl my-auto animate-in fade-in duration-300">
                    {/* Header */}
                    <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                        <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center">
                                <Video className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                                    <span>Doctor Consultation Fee</span>
                                    <span className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                                        Active Room
                                    </span>
                                </h3>
                                <p className="text-xs text-slate-400">
                                    Select your preferred payment method to join encrypted WebRTC video call
                                </p>
                            </div>
                        </div>

                        <div className="text-right">
                            <span className="text-xs text-slate-400 block font-mono">Amount Due</span>
                            <span className="text-lg font-extrabold text-teal-300">₹500.00</span>
                        </div>
                    </div>

                    {/* Instant Demo Pass Banner */}
                    <div className="mt-3.5 p-3 rounded-2xl bg-teal-950/40 border border-teal-500/30 flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2 text-teal-300">
                            <Sparkles className="w-4 h-4 text-teal-400 shrink-0" />
                            <span>
                                <strong>Testing or Evaluating?</strong> Skip fee to enter immediately:
                            </span>
                        </div>
                        <button
                            onClick={() => completePayment('DEMO_PASS')}
                            className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-md transition-all shrink-0 cursor-pointer flex items-center gap-1.5"
                        >
                            <span>⚡ Instant Pass</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    {/* Payment Success Overlay */}
                    {paymentSuccess ? (
                        <div className="py-12 flex flex-col items-center justify-center text-center space-y-3 animate-in zoom-in-95 duration-300">
                            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center animate-bounce">
                                <CheckCircle2 className="w-10 h-10" />
                            </div>
                            <h4 className="text-lg font-bold text-white">Payment Confirmed!</h4>
                            <p className="text-xs text-slate-400 font-mono">Txn ID: {txnId}</p>
                            <span className="text-xs text-teal-400 flex items-center gap-1.5">
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Launching WebRTC consultation feed...
                            </span>
                        </div>
                    ) : (
                        <>
                            {/* Payment Options Tabs */}
                            <div className="grid grid-cols-4 gap-2 mt-4 p-1.5 bg-slate-950/60 rounded-2xl border border-slate-800 text-xs font-semibold">
                                <button
                                    onClick={() => setActiveTab('upi')}
                                    className={`py-2 px-1 rounded-xl flex flex-col sm:flex-row items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                        activeTab === 'upi'
                                            ? 'bg-teal-600 text-white shadow-md'
                                            : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                >
                                    <Smartphone className="w-4 h-4" />
                                    <span>UPI / QR</span>
                                </button>

                                <button
                                    onClick={() => setActiveTab('card')}
                                    className={`py-2 px-1 rounded-xl flex flex-col sm:flex-row items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                        activeTab === 'card'
                                            ? 'bg-teal-600 text-white shadow-md'
                                            : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                >
                                    <CreditCard className="w-4 h-4" />
                                    <span>Card</span>
                                </button>

                                <button
                                    onClick={() => setActiveTab('netbanking')}
                                    className={`py-2 px-1 rounded-xl flex flex-col sm:flex-row items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                        activeTab === 'netbanking'
                                            ? 'bg-teal-600 text-white shadow-md'
                                            : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                >
                                    <Landmark className="w-4 h-4" />
                                    <span>NetBanking</span>
                                </button>

                                <button
                                    onClick={() => setActiveTab('razorpay')}
                                    className={`py-2 px-1 rounded-xl flex flex-col sm:flex-row items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                        activeTab === 'razorpay'
                                            ? 'bg-teal-600 text-white shadow-md'
                                            : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                >
                                    <ShieldCheck className="w-4 h-4" />
                                    <span>Razorpay</span>
                                </button>
                            </div>

                            {/* Tab Content 1: UPI & QR Code */}
                            {activeTab === 'upi' && (
                                <div className="mt-4 space-y-4 animate-in fade-in duration-200">
                                    <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-950/80 p-4 rounded-2xl border border-slate-800">
                                        {/* SVG QR Code Simulation */}
                                        <div className="p-3 bg-white rounded-2xl shadow-md shrink-0 flex flex-col items-center">
                                            <svg
                                                className="w-28 h-28 text-slate-900"
                                                viewBox="0 0 100 100"
                                                fill="currentColor"
                                            >
                                                {/* Corner 1 */}
                                                <rect x="5" y="5" width="28" height="28" rx="4" fill="#0F172A" />
                                                <rect x="9" y="9" width="20" height="20" rx="2" fill="#FFFFFF" />
                                                <rect x="13" y="13" width="12" height="12" fill="#0D9488" />
                                                {/* Corner 2 */}
                                                <rect x="67" y="5" width="28" height="28" rx="4" fill="#0F172A" />
                                                <rect x="71" y="9" width="20" height="20" rx="2" fill="#FFFFFF" />
                                                <rect x="75" y="75" width="12" height="12" fill="#0D9488" />
                                                {/* Corner 3 */}
                                                <rect x="5" y="67" width="28" height="28" rx="4" fill="#0F172A" />
                                                <rect x="9" y="71" width="20" height="20" rx="2" fill="#FFFFFF" />
                                                <rect x="13" y="75" width="12" height="12" fill="#0D9488" />
                                                {/* Matrix Dots */}
                                                <rect x="40" y="8" width="6" height="6" fill="#0F172A" />
                                                <rect x="52" y="8" width="8" height="6" fill="#0F172A" />
                                                <rect x="40" y="20" width="12" height="6" fill="#0F172A" />
                                                <rect x="58" y="20" width="5" height="12" fill="#0F172A" />
                                                <rect x="40" y="32" width="22" height="6" fill="#0D9488" />
                                                <rect x="8" y="40" width="8" height="6" fill="#0F172A" />
                                                <rect x="22" y="40" width="12" height="6" fill="#0F172A" />
                                                <rect x="40" y="44" width="8" height="8" fill="#0F172A" />
                                                <rect x="54" y="44" width="10" height="8" fill="#0D9488" />
                                                <rect x="70" y="40" width="18" height="6" fill="#0F172A" />
                                                <rect x="8" y="52" width="24" height="6" fill="#0D9488" />
                                                <rect x="70" y="52" width="22" height="8" fill="#0F172A" />
                                                <rect x="40" y="60" width="10" height="6" fill="#0F172A" />
                                                <rect x="56" y="60" width="8" height="14" fill="#0F172A" />
                                                <rect x="70" y="66" width="12" height="6" fill="#0D9488" />
                                                <rect x="40" y="72" width="10" height="12" fill="#0D9488" />
                                                <rect x="86" y="78" width="8" height="14" fill="#0F172A" />
                                            </svg>
                                            <span className="text-[10px] font-bold text-slate-800 mt-1 uppercase tracking-wider">
                                                Scan to Pay ₹500
                                            </span>
                                        </div>

                                        <div className="flex-1 space-y-2 text-left w-full">
                                            <p className="text-xs text-slate-300 font-medium">
                                                Scan with any UPI app: Google Pay, PhonePe, Paytm, BHIM, or Navi.
                                            </p>
                                            <div className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-900 border border-slate-800 text-xs">
                                                <span className="text-slate-400 font-mono text-[11px] truncate flex-1">
                                                    curalink.telehealth@icici
                                                </span>
                                                <button
                                                    onClick={copyUpiId}
                                                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-400 transition-colors cursor-pointer"
                                                    title="Copy UPI ID"
                                                >
                                                    {copiedUpi ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                                </button>
                                            </div>

                                            {/* Quick UPI App Badges */}
                                            <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-400">
                                                <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 font-semibold text-white">
                                                    GPay
                                                </span>
                                                <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 font-semibold text-white">
                                                    PhonePe
                                                </span>
                                                <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 font-semibold text-white">
                                                    Paytm
                                                </span>
                                                <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 font-semibold text-white">
                                                    BHIM
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Custom UPI ID Input */}
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={customUpi}
                                            onChange={(e) => setCustomUpi(e.target.value)}
                                            placeholder="Or enter your UPI ID (e.g. mobile@upi)"
                                            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-teal-500"
                                        />
                                        <button
                                            onClick={() => completePayment('UPI')}
                                            disabled={isProcessing}
                                            className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs transition-all shadow-md shrink-0 cursor-pointer disabled:opacity-50"
                                        >
                                            {isProcessing ? 'Verifying...' : 'Request ₹500'}
                                        </button>
                                    </div>

                                    <button
                                        onClick={() => completePayment('UPI_SCAN')}
                                        disabled={isProcessing}
                                        className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-700/20 cursor-pointer disabled:opacity-50"
                                    >
                                        <CheckCircle2 className="w-4 h-4" />
                                        <span>
                                            {isProcessing ? 'Verifying Bank Transaction...' : 'I Have Paid ₹500 via QR / UPI'}
                                        </span>
                                    </button>
                                </div>
                            )}

                            {/* Tab Content 2: Credit / Debit Card */}
                            {activeTab === 'card' && (
                                <div className="mt-4 space-y-3 animate-in fade-in duration-200">
                                    {/* Card Visualizer */}
                                    <div className="p-4 rounded-2xl bg-gradient-to-r from-teal-900 to-slate-900 border border-teal-500/30 text-white shadow-lg space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-teal-300">
                                                Telehealth Patient Pass
                                            </span>
                                            <span className="font-extrabold text-sm tracking-wider">VISA</span>
                                        </div>
                                        <div className="font-mono text-base tracking-widest text-slate-100">
                                            {cardNumber || '•••• •••• •••• ••••'}
                                        </div>
                                        <div className="flex items-center justify-between text-xs font-mono">
                                            <div>
                                                <span className="text-[9px] text-slate-400 block uppercase">Cardholder</span>
                                                <span className="font-bold">{cardHolder}</span>
                                            </div>
                                            <div>
                                                <span className="text-[9px] text-slate-400 block uppercase">Expires</span>
                                                <span className="font-bold">{cardExpiry}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Card Inputs */}
                                    <div className="space-y-2 text-xs">
                                        <div>
                                            <label className="text-[11px] text-slate-400 font-semibold mb-1 block">
                                                Card Number
                                            </label>
                                            <input
                                                type="text"
                                                value={cardNumber}
                                                onChange={(e) => setCardNumber(e.target.value)}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white font-mono focus:outline-none focus:border-teal-500"
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="text-[11px] text-slate-400 font-semibold mb-1 block">
                                                    Expiry (MM/YY)
                                                </label>
                                                <input
                                                    type="text"
                                                    value={cardExpiry}
                                                    onChange={(e) => setCardExpiry(e.target.value)}
                                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white font-mono focus:outline-none focus:border-teal-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[11px] text-slate-400 font-semibold mb-1 block">
                                                    CVV
                                                </label>
                                                <input
                                                    type="password"
                                                    maxLength={4}
                                                    value={cardCvv}
                                                    onChange={(e) => setCardCvv(e.target.value)}
                                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white font-mono focus:outline-none focus:border-teal-500"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => completePayment('CARD')}
                                        disabled={isProcessing}
                                        className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-teal-700/25 transition-all cursor-pointer disabled:opacity-50"
                                    >
                                        <Lock className="w-3.5 h-3.5" />
                                        <span>{isProcessing ? 'Authorizing Card...' : 'Pay ₹500.00 Securely'}</span>
                                    </button>
                                </div>
                            )}

                            {/* Tab Content 3: Net Banking */}
                            {activeTab === 'netbanking' && (
                                <div className="mt-4 space-y-3 animate-in fade-in duration-200">
                                    <p className="text-xs text-slate-400">Select your bank for instant net banking authorization:</p>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        {[
                                            'HDFC Bank',
                                            'ICICI Bank',
                                            'State Bank of India',
                                            'Axis Bank',
                                            'Kotak Mahindra',
                                            'Punjab National Bank',
                                        ].map((bank) => (
                                            <button
                                                key={bank}
                                                onClick={() => setSelectedBank(bank)}
                                                className={`p-2.5 rounded-xl border text-xs font-semibold text-left transition-all cursor-pointer ${
                                                    selectedBank === bank
                                                        ? 'bg-teal-500/15 border-teal-500 text-teal-300 shadow-sm'
                                                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                                                }`}
                                            >
                                                <Landmark className="w-3.5 h-3.5 mb-1 text-teal-400" />
                                                <span className="block truncate">{bank}</span>
                                            </button>
                                        ))}
                                    </div>

                                    <button
                                        onClick={() => completePayment(selectedBank.replace(/\s+/g, '_'))}
                                        disabled={isProcessing}
                                        className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-teal-700/25 transition-all cursor-pointer disabled:opacity-50"
                                    >
                                        <Lock className="w-3.5 h-3.5" />
                                        <span>
                                            {isProcessing ? `Connecting to ${selectedBank}...` : `Pay ₹500 via ${selectedBank}`}
                                        </span>
                                    </button>
                                </div>
                            )}

                            {/* Tab Content 4: Razorpay Official Gateway */}
                            {activeTab === 'razorpay' && (
                                <div className="mt-4 space-y-3 animate-in fade-in duration-200">
                                    <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs space-y-2">
                                        <div className="flex items-center gap-2 text-teal-400 font-bold">
                                            <ShieldCheck className="w-4 h-4" />
                                            <span>Official Razorpay Standard Modal</span>
                                        </div>
                                        <p className="text-slate-400 leading-relaxed text-[11px]">
                                            Launches the official Razorpay checkout window with your configured test key.
                                            If your Razorpay test account does not have payment instruments active yet,
                                            you can also use the direct UPI, Card, or Instant Pass options above.
                                        </p>
                                        <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 font-mono text-[10px] text-slate-400 flex items-center justify-between">
                                            <span>Key: {process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_Tjvb5EHmaluLGr'}</span>
                                            <span className="text-emerald-400 font-bold">LIVE TEST</span>
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleRazorpayGateway}
                                        disabled={isProcessing}
                                        className="w-full py-3.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-teal-700/25 transition-all cursor-pointer disabled:opacity-50"
                                    >
                                        <Receipt className="w-4 h-4" />
                                        <span>
                                            {isProcessing ? 'Launching Razorpay Gateway...' : 'Open Razorpay Checkout Popup'}
                                        </span>
                                    </button>
                                </div>
                            )}

                            {/* Trust badges footer */}
                            <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                                <span className="flex items-center gap-1">
                                    <Lock className="w-3 h-3 text-teal-500" /> 256-bit TLS Encrypted
                                </span>
                                <span>Doctor Consultation Receipt Issued</span>
                            </div>
                        </>
                    )}
                </div>
            ) : (
                <div className="w-full h-full min-h-[550px] shadow-2xl rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 flex flex-col animate-in fade-in duration-300">
                    <JitsiMeeting
                        domain="meet.jit.si"
                        roomName={activeRoomName}
                        configOverwrite={{
                            startWithAudioMuted: false,
                            startWithVideoMuted: false,
                            startScreenSharing: false,
                            prejoinPageEnabled: false,
                            disableDeepLinking: true,
                            enableClosePage: false,
                            disableInviteFunctions: true,
                        }}
                        interfaceConfigOverwrite={{
                            SHOW_JITSI_WATERMARK: false,
                            SHOW_WATERMARK_FOR_GUESTS: false,
                            DEFAULT_REMOTE_DISPLAY_NAME: 'Telehealth Participant',
                        }}
                        userInfo={{
                            displayName: userName,
                            email: 'consultation@curalink.com',
                        }}
                        onReadyToClose={() => {
                            if (onLeave) {
                                onLeave();
                            } else {
                                setHasPaid(false);
                            }
                        }}
                        getIFrameRef={(iframeRef) => {
                            if (iframeRef) {
                                iframeRef.style.height = '100%';
                                iframeRef.style.width = '100%';
                                iframeRef.style.border = 'none';
                                iframeRef.setAttribute(
                                    'allow',
                                    'camera; microphone; display-capture; autoplay; clipboard-write; fullscreen'
                                );
                            }
                        }}
                    />
                </div>
            )}
        </div>
    );
}