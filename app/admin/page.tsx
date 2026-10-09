'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, ArrowUpRight, Check, CheckCircle2, ChevronRight, Clock3,
  FileBadge, HeartPulse, LayoutDashboard, Loader2, LogOut, Search,
  ShieldCheck, Stethoscope, Users, Wifi, WifiOff, X,
} from 'lucide-react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import {
  collection, doc, onSnapshot, query, runTransaction, serverTimestamp,
  Timestamp, where,
} from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { PatientAssignmentRegistry } from '../../components/admin/PatientAssignmentRegistry';

const AUTHORIZED_ADMIN_EMAIL = 'sainathas8788@gmail.com';
type RegistryFilter = 'all' | 'pending' | 'verified';
type Notice = { type: 'success' | 'error'; message: string; doctorId?: string };

interface DoctorUser {
  id: string;
  fullName: string;
  email: string;
  specialty: string;
  licenseNumber: string;
  isVerified: boolean;
  createdAt: number;
  verifiedAt: number;
  verifiedBy: string;
}

const buttonStyle = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50';

function textValue(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function dateValue(value: unknown): number {
  if (value instanceof Timestamp) return value.toMillis();
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : 0;
  if (typeof value !== 'string' && typeof value !== 'number') return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function formatDate(value: number): string {
  return value ? new Intl.DateTimeFormat('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  }).format(value) : 'Not provided';
}

function errorMessage(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : '';
  if (code === 'permission-denied') return 'Your account does not have permission to access this registry. Contact your Firebase project administrator.';
  if (code === 'unavailable') return 'The service is temporarily unavailable. Check your connection and try again.';
  if (error instanceof Error && !code) return error.message;
  return 'We could not complete this request. Please try again.';
}

function VerificationBadge({ verified }: { verified: boolean }) {
  const Icon = verified ? CheckCircle2 : Clock3;
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${verified ? 'bg-teal-50 text-teal-800' : 'bg-amber-50 text-amber-800'}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {verified ? 'Verified' : 'Pending review'}
    </span>
  );
}

export default function AdminRegistryPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [doctors, setDoctors] = useState<DoctorUser[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState('');
  const [fromCache, setFromCache] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<RegistryFilter>('all');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});
  const pendingRef = useRef(new Set<string>());
  const dialogRef = useRef<HTMLDialogElement>(null);
  const isAuthorized = currentUser?.email?.trim().toLowerCase() === AUTHORIZED_ADMIN_EMAIL;

  useEffect(() => onAuthStateChanged(auth, (user) => {
    setCurrentUser(user);
    setAuthLoading(false);
    setAuthError('');
    setDataLoading(true);
    setDataError('');
    setFromCache(true);
    if (user?.email?.trim().toLowerCase() !== AUTHORIZED_ADMIN_EMAIL) {
      setDoctors([]);
      setReviewId(null);
      setNotice(null);
      setActionErrors({});
    }
  }, () => {
    setAuthLoading(false);
    setAuthError('We could not check your session. Refresh this page to try again.');
  }), []);

  useEffect(() => {
    if (!isAuthorized) return;

    // Keep verification changes live across the Admin, Doctor, and booking portals.
    const doctorsQuery = query(collection(db, 'users'), where('role', 'in', ['doctor', 'Doctor']));
    return onSnapshot(doctorsQuery, { includeMetadataChanges: true }, (snapshot) => {
      const records = snapshot.docs.map((record): DoctorUser => {
        const data = record.data();
        return {
          id: record.id,
          fullName: textValue(data.fullName, data.name, data.displayName) || 'Name not provided',
          email: textValue(data.email),
          specialty: textValue(data.specialty, data.specialization),
          licenseNumber: textValue(data.licenseNumber, data.medicalLicense),
          isVerified: data.isVerified === true,
          createdAt: dateValue(data.createdAt),
          verifiedAt: dateValue(data.verifiedAt),
          verifiedBy: textValue(data.verifiedBy),
        };
      });
      records.sort((a, b) => b.createdAt - a.createdAt || a.fullName.localeCompare(b.fullName));
      setDoctors(records);
      setFromCache(snapshot.metadata.fromCache);
      setDataLoading(false);
      setDataError('');
    }, (error) => {
      setDataError(errorMessage(error));
      setDataLoading(false);
    });
  }, [isAuthorized, currentUser?.uid, retryCount]);

  const reviewedDoctor = doctors.find((doctor) => doctor.id === reviewId);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (reviewId && isAuthorized && dialog && !dialog.open) dialog.showModal();
    if ((!reviewId || !isAuthorized) && dialog?.open) dialog.close();
  }, [reviewId, isAuthorized]);

  const verifiedCount = doctors.filter((doctor) => doctor.isVerified).length;
  const pendingCount = doctors.length - verifiedCount;
  const filteredDoctors = useMemo(() => {
    const term = search.trim().toLowerCase();
    return doctors.filter((doctor) => {
      if (filter === 'pending' && doctor.isVerified) return false;
      if (filter === 'verified' && !doctor.isVerified) return false;
      return !term || [doctor.fullName, doctor.email, doctor.specialty, doctor.licenseNumber]
        .some((value) => value.toLowerCase().includes(term));
    });
  }, [doctors, filter, search]);

  const handleVerification = async (doctor: DoctorUser, verified: boolean) => {
    if (!isAuthorized || fromCache || dataError || pendingRef.current.has(doctor.id)) return;
    pendingRef.current.add(doctor.id);
    setPendingIds(new Set(pendingRef.current));
    setActionErrors((previous) => ({ ...previous, [doctor.id]: '' }));
    setNotice(null);
    try {
      await runTransaction(db, async (transaction) => {
        if (auth.currentUser?.email?.trim().toLowerCase() !== AUTHORIZED_ADMIN_EMAIL) {
          throw new Error('Your admin session has ended. Sign in again before reviewing an account.');
        }
        const doctorRef = doc(db, 'users', doctor.id);
        const snapshot = await transaction.get(doctorRef);
        if (!snapshot.exists() || textValue(snapshot.data().role).toLowerCase() !== 'doctor') {
          throw new Error('This doctor account is no longer available in the registry.');
        }
        if ((snapshot.data().isVerified === true) !== doctor.isVerified) {
          throw new Error('This verification status changed while you were reviewing it. Check the updated status and try again.');
        }
        if (auth.currentUser?.email?.trim().toLowerCase() !== AUTHORIZED_ADMIN_EMAIL) {
          throw new Error('Your admin session has ended. Sign in again before reviewing an account.');
        }
        transaction.update(doctorRef, {
          isVerified: verified,
          verifiedAt: verified ? serverTimestamp() : null,
          verifiedBy: auth.currentUser.email,
        });
      });
      setNotice({ type: 'success', doctorId: doctor.id, message: verified
        ? `${doctor.fullName} is now verified. Their account status has been updated.`
        : `Verification revoked for ${doctor.fullName}. Their account is pending review.` });
      setConfirmRevoke(false);
    } catch (error) {
      const message = errorMessage(error);
      setActionErrors((previous) => ({ ...previous, [doctor.id]: message }));
      setNotice({ type: 'error', doctorId: doctor.id, message });
    } finally {
      pendingRef.current.delete(doctor.id);
      setPendingIds(new Set(pendingRef.current));
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut(auth);
      router.replace('/auth');
    } catch {
      setNotice({ type: 'error', message: 'We could not sign you out. Please try again.' });
    } finally {
      setSigningOut(false);
    }
  };

  const retryRegistry = () => {
    setDataLoading(true);
    setDataError('');
    setFromCache(true);
    setRetryCount((count) => count + 1);
  };

  const openReview = (id: string) => {
    setConfirmRevoke(false);
    setReviewId(id);
  };

  if (authLoading || authError || !isAuthorized) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-12 text-slate-900">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <Link href="/" className="mb-8 inline-flex items-center gap-2 text-lg font-bold"><HeartPulse className="h-6 w-6 text-teal-700" aria-hidden="true" />CuraLink</Link>
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
            {authLoading ? <Loader2 className="h-7 w-7 animate-spin" aria-hidden="true" /> : <ShieldCheck className="h-7 w-7" aria-hidden="true" />}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{authLoading ? 'Checking your session' : authError ? 'Session unavailable' : currentUser ? 'Admin access required' : 'Welcome to the Admin portal'}</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600" role={authError ? 'alert' : 'status'}>{authLoading ? 'Your registry will be ready in a moment.' : authError || (currentUser ? 'This account does not have access to the doctor registry. Sign in with your designated administrator account.' : 'Sign in with your administrator account to review doctor registrations.')}</p>
          {!authLoading && <div className="mt-7 flex flex-col gap-3">
            {currentUser && !authError ? <button type="button" className={`${buttonStyle} bg-teal-700 text-white hover:bg-teal-800`} onClick={handleSignOut} disabled={signingOut}>{signingOut ? 'Signing out…' : 'Sign out and switch account'}</button> : <Link href="/auth" className={`${buttonStyle} bg-teal-700 text-white hover:bg-teal-800`}>Sign in<ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Link>}
            <Link href="/" className={`${buttonStyle} text-slate-600 hover:bg-slate-100`}><ArrowLeft className="h-4 w-4" aria-hidden="true" />Back to CuraLink</Link>
          </div>}
          {notice?.type === 'error' && <p className="mt-4 text-sm text-rose-700" role="alert">{notice.message}</p>}
        </div>
      </main>
    );
  }

  const metricUnavailable = dataLoading || ((fromCache || Boolean(dataError)) && doctors.length === 0);
  const verificationDisabled = fromCache || Boolean(dataError) || dataLoading;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 lg:flex">
      <a href="#admin-main" className="sr-only z-50 rounded-lg bg-white p-3 text-teal-800 focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to registry</a>
      <aside className="flex flex-col border-b border-slate-200 bg-white lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between px-6 py-6 lg:block">
          <Link href="/" className="flex items-center gap-2.5 text-xl font-bold tracking-tight"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700 text-white"><HeartPulse className="h-6 w-6" aria-hidden="true" /></span>CuraLink</Link>
          <p className="text-xs font-semibold text-slate-500 lg:ml-12 lg:mt-1">ADMIN PORTAL</p>
        </div>
        <nav aria-label="Admin navigation" className="flex gap-1 px-4 pb-4 lg:mt-6 lg:flex-col lg:gap-2">
          <a href="#admin-main" className="flex min-h-11 items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50"><LayoutDashboard className="h-4 w-4" aria-hidden="true" /><span>Overview</span></a>
          <a href="#doctor-registry" aria-current="page" className="flex min-h-11 items-center gap-3 rounded-xl bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-800"><Stethoscope className="h-4 w-4" aria-hidden="true" /><span>Doctor registry</span><span className="ml-auto hidden rounded-full bg-white px-2 py-0.5 text-xs lg:inline">{metricUnavailable ? '–' : pendingCount}</span></a>
          <Link href="/" className="hidden min-h-11 items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 lg:flex"><ArrowUpRight className="h-4 w-4" aria-hidden="true" />Public website</Link>
        </nav>
        <div className="hidden p-4 lg:mt-auto lg:block">
          <div className="rounded-2xl bg-slate-50 p-4"><div className="mb-2 flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-teal-700" aria-hidden="true" />Administrator</div><p className="break-all text-xs leading-5 text-slate-500">{currentUser?.email}</p></div>
          <button type="button" onClick={handleSignOut} disabled={signingOut} className={`${buttonStyle} mt-3 w-full text-slate-600 hover:bg-slate-100`}><LogOut className="h-4 w-4" aria-hidden="true" />{signingOut ? 'Signing out…' : 'Sign out'}</button>
        </div>
      </aside>

      <main id="admin-main" className="min-w-0 flex-1 px-5 py-7 sm:px-8 lg:px-10 lg:py-9">
        <div className="mx-auto max-w-7xl">
          <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
            <div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">Care network management</p><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Doctor registry</h1><p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">A trusted care network starts here. Review clinician credentials and manage verification in one place.</p></div>
            <div className="flex items-center gap-3"><span className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium ${dataError ? 'border-rose-200 bg-rose-50 text-rose-700' : fromCache ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-teal-100 bg-white text-teal-700'}`}>{fromCache || dataError ? <WifiOff className="h-3.5 w-3.5" aria-hidden="true" /> : <Wifi className="h-3.5 w-3.5" aria-hidden="true" />}{dataError ? 'Connection interrupted' : dataLoading ? 'Connecting…' : fromCache ? 'Waiting for connection' : 'Live updates'}</span><button type="button" onClick={handleSignOut} disabled={signingOut} aria-label="Sign out of Admin portal" className={`${buttonStyle} border border-slate-200 bg-white text-slate-600 lg:hidden`}><LogOut className="h-4 w-4" aria-hidden="true" /></button></div>
          </header>

          {notice && <div role={notice.type === 'error' ? 'alert' : 'status'} className={`mb-6 flex items-start gap-3 rounded-2xl border p-4 text-sm ${notice.type === 'error' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-teal-200 bg-teal-50 text-teal-900'}`}><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" /><p className="flex-1 leading-6">{notice.message}</p><button type="button" onClick={() => setNotice(null)} aria-label="Dismiss notification" className="-m-2 flex h-11 w-11 items-center justify-center rounded-lg hover:bg-white/60"><X className="h-4 w-4" aria-hidden="true" /></button></div>}

          <section aria-label="Registry summary" className="mb-8 grid gap-4 sm:grid-cols-3">
            {[
              { label: 'Registered doctors', value: doctors.length, Icon: Users, description: 'Across your care network', style: 'bg-slate-100 text-slate-600' },
              { label: 'Pending review', value: pendingCount, Icon: Clock3, description: 'Awaiting credential verification', style: 'bg-amber-50 text-amber-700' },
              { label: 'Verified doctors', value: verifiedCount, Icon: ShieldCheck, description: 'Approved clinician accounts', style: 'bg-teal-50 text-teal-700' },
            ].map(({ label, value, Icon, description, style }) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"><div className="flex items-center justify-between"><p className="text-sm font-medium text-slate-500">{label}</p><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${style}`}><Icon className="h-5 w-5" aria-hidden="true" /></span></div><p className="mt-4 text-3xl font-semibold tracking-tight tabular-nums">{metricUnavailable ? '—' : value}</p><p className="mt-2 text-xs leading-5 text-slate-500">{description}</p></div>)}
          </section>

          <section id="doctor-registry" className="scroll-mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-5 border-b border-slate-100 p-5 sm:p-6"><div><h2 className="text-lg font-semibold tracking-tight">Your clinicians</h2><p className="mt-1 text-sm text-slate-500">Review account details before approving verification.</p></div><label className="relative w-full sm:w-80"><span className="sr-only">Search by doctor name, email, specialty, or license</span><Search className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" aria-hidden="true" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search clinicians…" className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-2 focus:outline-offset-2 focus:outline-teal-100" /></label></div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6"><div className="flex flex-wrap gap-1" role="group" aria-label="Filter by verification status">{([{ key: 'all', label: 'All doctors', count: doctors.length }, { key: 'pending', label: 'Pending review', count: pendingCount }, { key: 'verified', label: 'Verified', count: verifiedCount }] as const).map((item) => <button type="button" key={item.key} aria-pressed={filter === item.key} onClick={() => setFilter(item.key)} className={`${buttonStyle} px-3 ${filter === item.key ? 'bg-teal-50 text-teal-800' : 'text-slate-500 hover:bg-slate-50'}`}>{item.label}<span className={`rounded-md px-1.5 py-0.5 text-xs ${filter === item.key ? 'bg-white' : 'bg-slate-100'}`}>{metricUnavailable ? '–' : item.count}</span></button>)}</div><p className="text-xs text-slate-500" aria-live="polite">{dataLoading ? 'Loading registry…' : `${filteredDoctors.length} result${filteredDoctors.length === 1 ? '' : 's'}`}</p></div>

            {dataError && <div role="alert" className="m-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><p className="max-w-2xl leading-6">{dataError}{doctors.length > 0 && ' Previously loaded records are shown below. Verification actions are paused.'}</p><button type="button" onClick={retryRegistry} className={`${buttonStyle} border border-rose-200 bg-white`}>Try again</button></div>}
            {!dataError && !dataLoading && fromCache && <p role="status" className="mx-5 mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">Waiting for a live connection. Any saved records may be out of date; verification becomes available when the registry reconnects.</p>}

            {dataLoading ? <div role="status" className="flex flex-col items-center gap-4 px-6 py-20"><Loader2 className="h-7 w-7 animate-spin text-teal-700" aria-hidden="true" /><p className="text-sm text-slate-500">Loading doctor accounts…</p></div> : filteredDoctors.length === 0 ? <div className="px-6 py-16 text-center"><span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-400"><Stethoscope className="h-6 w-6" aria-hidden="true" /></span><h3 className="text-base font-semibold">{dataError ? 'Registry unavailable' : fromCache && doctors.length === 0 ? 'Waiting for your registry' : doctors.length === 0 ? 'Your care network starts here' : 'No matching clinicians'}</h3><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">{dataError ? 'Reconnect to load doctor accounts and review their status.' : fromCache && doctors.length === 0 ? 'Doctor accounts will appear when a connection is established.' : doctors.length === 0 ? 'Registered doctor accounts will appear here, ready for you to review.' : 'Try another name, email, specialty, or verification filter.'}</p>{doctors.length > 0 && <button type="button" onClick={() => { setSearch(''); setFilter('all'); }} className={`${buttonStyle} mt-5 text-teal-700 hover:bg-teal-50`}>Clear filters</button>}</div> : <>
              <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[760px] text-left text-sm"><caption className="sr-only">Doctor accounts and credential verification status</caption><thead className="border-b border-slate-100 bg-slate-50/70 text-xs font-medium text-slate-500"><tr><th scope="col" className="px-6 py-3.5">Clinician</th><th scope="col" className="px-5 py-3.5">Specialty</th><th scope="col" className="px-5 py-3.5">License number</th><th scope="col" className="px-5 py-3.5">Status</th><th scope="col" className="px-6 py-3.5 text-right">Review</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredDoctors.map((doctor) => <tr key={doctor.id} className="hover:bg-slate-50/60"><th scope="row" className="px-6 py-5 font-normal"><div className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-50 text-sm font-semibold text-teal-700">{doctor.fullName.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</span><div><p className="font-semibold text-slate-800">{doctor.fullName}</p><p className="mt-1 break-all text-xs text-slate-500">{doctor.email || 'Email not provided'}</p></div></div></th><td className="px-5 py-5 text-slate-600">{doctor.specialty || 'Not provided'}</td><td className="px-5 py-5 font-mono text-xs text-slate-600">{doctor.licenseNumber || 'Not provided'}</td><td className="px-5 py-5"><VerificationBadge verified={doctor.isVerified} /></td><td className="px-6 py-5 text-right"><button type="button" aria-label={`Review ${doctor.fullName}`} onClick={() => openReview(doctor.id)} className={`${buttonStyle} border border-slate-200 text-slate-700 hover:border-teal-200 hover:bg-teal-50 hover:text-teal-800`}>{pendingIds.has(doctor.id) ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ChevronRight className="h-4 w-4" aria-hidden="true" />}Review</button></td></tr>)}</tbody></table></div>
              <div className="divide-y divide-slate-100 md:hidden">{filteredDoctors.map((doctor) => <article key={doctor.id} className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{doctor.fullName}</h3><p className="mt-1 break-all text-xs text-slate-500">{doctor.email || 'Email not provided'}</p></div><VerificationBadge verified={doctor.isVerified} /></div><dl className="my-4 grid grid-cols-2 gap-4 text-xs"><div><dt className="mb-1 text-slate-400">Specialty</dt><dd className="leading-5 text-slate-600">{doctor.specialty || 'Not provided'}</dd></div><div><dt className="mb-1 text-slate-400">License number</dt><dd className="break-all font-mono leading-5 text-slate-600">{doctor.licenseNumber || 'Not provided'}</dd></div></dl><button type="button" onClick={() => openReview(doctor.id)} aria-label={`Review ${doctor.fullName}`} className={`${buttonStyle} w-full border border-slate-200 text-teal-800 hover:bg-teal-50`}>Review account<ChevronRight className="h-4 w-4" aria-hidden="true" /></button></article>)}</div>
            </>}
            <footer className="border-t border-slate-100 px-5 py-4 text-xs leading-5 text-slate-500 sm:px-6">Verification changes are reflected in the clinician account and patient booking directory.</footer>
          </section>
          <PatientAssignmentRegistry key={currentUser?.uid} adminUid={currentUser?.uid || ''} doctors={doctors} cliniciansLoading={dataLoading} cliniciansError={dataError} cliniciansFromCache={fromCache} />
          <p className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400"><ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />CuraLink · Admin workspace</p>
        </div>
      </main>

      <dialog ref={dialogRef} onClose={() => { setReviewId(null); setConfirmRevoke(false); }} aria-labelledby="review-title" className="m-auto w-[calc(100%_-_2rem)] max-w-lg rounded-3xl border-0 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-950/40">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5"><h2 id="review-title" className="text-lg font-semibold">Review clinician</h2><button type="button" onClick={() => dialogRef.current?.close()} aria-label="Close clinician review" className="-mr-2 flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-50"><X className="h-5 w-5" aria-hidden="true" /></button></div>
        {reviewedDoctor ? <div className="p-6"><div className="mb-6 flex items-center gap-4"><span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-700"><Stethoscope className="h-6 w-6" aria-hidden="true" /></span><div><h3 className="mb-2 text-xl font-semibold tracking-tight">{reviewedDoctor.fullName}</h3><VerificationBadge verified={reviewedDoctor.isVerified} /></div></div><dl className="space-y-4 text-sm">{[
          ['Email address', reviewedDoctor.email || 'Not provided'],
          ['Specialty', reviewedDoctor.specialty || 'Not provided'],
          ['License number', reviewedDoctor.licenseNumber || 'Not provided'],
          ['Registered', formatDate(reviewedDoctor.createdAt)],
          ...(reviewedDoctor.isVerified ? [['Verified on', formatDate(reviewedDoctor.verifiedAt)], ['Verified by', reviewedDoctor.verifiedBy || 'Not provided']] : []),
        ].map(([label, value]) => <div key={label} className="grid grid-cols-[110px_1fr] gap-4"><dt className="text-slate-500">{label}</dt><dd className="break-words font-medium text-slate-800">{value}</dd></div>)}</dl><div className="mt-6 flex items-start gap-3 rounded-xl bg-slate-50 p-4"><FileBadge className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" aria-hidden="true" /><p className="text-xs leading-6 text-slate-600">Confirm this clinician&apos;s identity and license with the issuing authority before approving. The account details shown here are submitted by the clinician.</p></div>
          {actionErrors[reviewedDoctor.id] && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm leading-6 text-rose-700">{actionErrors[reviewedDoctor.id]}</p>}
          {notice?.type === 'success' && notice.doctorId === reviewedDoctor.id && <p role="status" className="mt-4 rounded-xl bg-teal-50 p-3 text-sm leading-6 text-teal-800">{notice.message}</p>}
          {verificationDisabled && <p className="mt-4 text-xs leading-6 text-amber-800">A live registry connection is required to change verification. Close this review and reconnect to continue.</p>}
          {confirmRevoke && reviewedDoctor.isVerified && <div role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4"><p className="text-sm font-semibold text-rose-900">Revoke this verification?</p><p className="mt-1 text-xs leading-6 text-rose-800">This doctor will return to pending review and will no longer appear as verified in the booking directory.</p></div>}
          <div className="mt-6 flex flex-wrap gap-3">
            {reviewedDoctor.isVerified ? confirmRevoke ? <><button type="button" disabled={verificationDisabled || pendingIds.has(reviewedDoctor.id)} onClick={() => handleVerification(reviewedDoctor, false)} className={`${buttonStyle} flex-1 bg-rose-700 text-white hover:bg-rose-800`}>{pendingIds.has(reviewedDoctor.id) ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <X className="h-4 w-4" aria-hidden="true" />}{pendingIds.has(reviewedDoctor.id) ? 'Revoking…' : 'Confirm revoke'}</button><button type="button" disabled={pendingIds.has(reviewedDoctor.id)} onClick={() => setConfirmRevoke(false)} className={`${buttonStyle} border border-slate-200 text-slate-600`}>Cancel</button></> : <button type="button" disabled={verificationDisabled || pendingIds.has(reviewedDoctor.id)} onClick={() => setConfirmRevoke(true)} className={`${buttonStyle} flex-1 border border-rose-200 text-rose-700 hover:bg-rose-50`}>Revoke verification</button> : <button type="button" disabled={verificationDisabled || pendingIds.has(reviewedDoctor.id)} onClick={() => handleVerification(reviewedDoctor, true)} className={`${buttonStyle} flex-1 bg-teal-700 text-white hover:bg-teal-800`}>{pendingIds.has(reviewedDoctor.id) ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}{pendingIds.has(reviewedDoctor.id) ? 'Approving…' : 'Approve verification'}</button>}
          </div>
        </div> : <p className="p-6 text-sm leading-6 text-slate-600">This clinician is no longer available in the registry. Close this window to review another account.</p>}
      </dialog>
    </div>
  );
}
