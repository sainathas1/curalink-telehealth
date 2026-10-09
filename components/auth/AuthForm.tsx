'use client';

import { useState, useEffect } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, signInWithCredential, GoogleAuthProvider, User } from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { AlertCircle, ArrowRight, Eye, EyeOff, Loader2, Stethoscope, UserRound } from 'lucide-react';
import { auth, db, googleProvider } from '../../lib/firebase';
import { UserProfile, UserRole } from '../../lib/types';

interface AuthFormProps { initialRole?: UserRole; onSuccess: (profile: UserProfile) => void; }

function errorMessage(error: unknown) {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
  if (['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found'].includes(code)) return 'That email and password do not match. Please try again.';
  if (code === 'auth/email-already-in-use') return 'An account already uses this email. Choose Sign in below.';
  if (code === 'auth/popup-closed-by-user') return 'The Google window was closed. You can try again.';
  if (code === 'auth/network-request-failed') return 'We could not connect. Check your connection and try again.';
  if (code === 'permission-denied') return 'Your account signed in, but we could not save or read your profile. Please try again or contact your administrator.';
  return error instanceof Error ? error.message : 'We could not sign you in. Please try again.';
}

export function AuthForm({ initialRole = 'Patient', onSuccess }: AuthFormProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [role, setRole] = useState<UserRole>(initialRole);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [license, setLicense] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isDoctor = role.toLowerCase() === 'doctor';

  async function loadOrCreateProfile(account: User, mayCreate: boolean): Promise<UserProfile> {
    const reference = doc(db, 'users', account.uid);
    const snapshot = await getDoc(reference);
    // Existing role and verification always come from the saved profile.
    if (snapshot.exists()) return { ...snapshot.data(), uid: account.uid } as UserProfile;
    if (!mayCreate) {
      setIsSignUp(true);
      setEmail(account.email || email);
      throw new Error('Your account needs a care profile. Complete the Create account form to continue.');
    }
    if (isDoctor && (!license.trim() || !specialty.trim())) {
      setIsSignUp(true);
      setEmail(account.email || email);
      throw new Error('Enter your clinical specialty and medical license number to submit your clinician profile for review.');
    }
    const profile: UserProfile = {
      uid: account.uid,
      fullName: fullName.trim() || account.displayName || 'New patient',
      email: account.email || email.trim(),
      role: isDoctor ? 'doctor' : 'patient',
      isVerified: false,
      hasCompletedOnboarding: isDoctor,
      ...(isDoctor ? { specialty: specialty.trim(), licenseNumber: license.trim() } : {}),
    };
    await setDoc(reference, { ...profile, createdAt: serverTimestamp() });
    return profile;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(null);
    try {
      if (isSignUp) {
        // Allow a profile-save retry after account creation without replacing an existing profile.
        const account = auth.currentUser?.email?.toLowerCase() === email.trim().toLowerCase()
          ? auth.currentUser : (await createUserWithEmailAndPassword(auth, email.trim(), password)).user;
        onSuccess(await loadOrCreateProfile(account, true));
      } else {
        const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
        onSuccess(await loadOrCreateProfile(credential.user, false));
      }
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        GoogleAuth.initialize();
      } catch {
        // Plugin initialization fallback
      }
    }
  }, []);

  async function handleGoogle() {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      if (Capacitor.isNativePlatform()) {
        const user = await GoogleAuth.signIn();
        const idToken = user?.authentication?.idToken;
        if (!idToken) throw new Error('Could not retrieve authentication token from Google Sign-In.');
        const credential = await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
        onSuccess(await loadOrCreateProfile(credential.user, true));
      } else {
        const credential = await signInWithPopup(auth, googleProvider);
        onSuccess(await loadOrCreateProfile(credential.user, true));
      }
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }

  const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700';
  return <div>
    <p className="care-eyebrow">YOUR CARE, CONNECTED</p>
    <h1 id="auth-title" className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{isSignUp ? 'A healthier connection.' : 'Welcome back.'}</h1>
    <p className="mt-3 text-sm leading-6 text-slate-500">{isSignUp ? 'Create your account to keep your care in one place.' : 'Sign in to pick up where you left off.'}</p>
    {error && <div role="alert" className="mt-5 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm leading-5 text-rose-800"><AlertCircle className="mt-0.5 size-4 shrink-0" />{error}</div>}
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      {isSignUp && <fieldset disabled={busy}><legend className="mb-2 text-sm font-medium text-slate-700">I am joining as a</legend><div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">{(['Patient', 'Doctor'] as const).map(option => <button key={option} type="button" aria-pressed={role.toLowerCase() === option.toLowerCase()} onClick={() => setRole(option)} className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold ${role.toLowerCase() === option.toLowerCase() ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-600'}`}>{option === 'Doctor' ? <Stethoscope size={17} /> : <UserRound size={17} />}{option === 'Doctor' ? 'Clinician' : option}</button>)}</div></fieldset>}
      {isSignUp && <label className="block text-sm font-medium text-slate-700">Full name<input className={`${inputClass} mt-1.5`} value={fullName} onChange={e => setFullName(e.target.value)} autoComplete="name" required maxLength={120} disabled={busy} placeholder="Your full name" /></label>}
      {isSignUp && isDoctor && <div className="space-y-4"><label className="block text-sm font-medium text-slate-700">Clinical specialty<input className={`${inputClass} mt-1.5`} value={specialty} onChange={e => setSpecialty(e.target.value)} required maxLength={120} disabled={busy} placeholder="e.g. Family medicine" /></label><label className="block text-sm font-medium text-slate-700">Medical license number<input className={`${inputClass} mt-1.5`} value={license} onChange={e => setLicense(e.target.value)} required maxLength={80} disabled={busy} placeholder="Your registered license number" /></label><p className="rounded-xl bg-teal-50 p-3 text-xs leading-5 text-teal-800">Your clinical workspace becomes available after an administrator reviews and approves your credentials.</p></div>}
      <label className="block text-sm font-medium text-slate-700">Email address<input className={`${inputClass} mt-1.5`} type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required disabled={busy} placeholder="you@example.com" /></label>
      <label className="block text-sm font-medium text-slate-700">Password<span className="relative mt-1.5 block"><input className={`${inputClass} pr-12`} type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} autoComplete={isSignUp ? 'new-password' : 'current-password'} minLength={isSignUp ? 8 : undefined} required disabled={busy} placeholder={isSignUp ? 'At least 8 characters' : 'Enter your password'} /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-1 top-1 rounded-lg p-2.5 text-slate-500">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></span></label>
      <button type="submit" disabled={busy} className="care-button w-full">{busy ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}{busy ? 'Connecting…' : isSignUp ? 'Create account' : 'Sign in'}</button>
    </form>
    <div className="my-5 flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200" />or<span className="h-px flex-1 bg-slate-200" /></div>
    <button type="button" onClick={handleGoogle} disabled={busy} className="flex min-h-11 w-full items-center justify-center gap-3 rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><span aria-hidden="true" className="text-base font-bold text-blue-600">G</span>Continue with Google</button>
    <p className="mt-6 text-center text-sm text-slate-500">{isSignUp ? 'Already have an account?' : 'New to CuraLink?'} <button type="button" disabled={busy} onClick={() => { setIsSignUp(!isSignUp); setError(null); }} className="rounded px-1 py-2 font-semibold text-teal-800">{isSignUp ? 'Sign in' : 'Create account'}</button></p>
  </div>;
}
