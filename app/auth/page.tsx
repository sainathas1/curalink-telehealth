'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTelehealth } from '../../context/TelehealthContext';
import { UserRole, UserProfile } from '../../lib/types';
import { auth, db, googleProvider } from '../../lib/firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import {
  HeartPulse,
  Lock,
  Mail,
  User,
  Stethoscope,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';

export default function AuthPage() {
  const router = useRouter();
  const {
    setAuthenticatedProfile,
  } = useTelehealth();

  const [isSignUp, setIsSignUp] = useState(false);
  const [role, setRole] = useState<UserRole>('Patient');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [specialty, setSpecialty] = useState('Cardiology & Intensive Care');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSuccessRedirect = (profile: UserProfile) => {
    setAuthenticatedProfile(profile);
    if (profile.role?.toLowerCase() === 'doctor') {
      router.push('/doctor/dashboard');
    } else if (profile.hasCompletedOnboarding === false) {
      router.push('/onboarding');
    } else {
      router.push('/patient/dashboard');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (isSignUp) {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        const enforcedRole: UserRole = role.toLowerCase() === 'doctor' ? 'doctor' : 'patient';
        const profile: UserProfile = {
          uid: userCred.user.uid,
          fullName: fullName || (enforcedRole === 'doctor' ? 'Dr. Clinician' : 'New Patient'),
          email: userCred.user.email || email,
          role: enforcedRole,
          specialty: enforcedRole === 'doctor' ? specialty : undefined,
          licenseNumber: enforcedRole === 'doctor' ? `MD-CA-${Math.floor(100000 + Math.random() * 900000)}` : undefined,
          isVerified: false,
          hasCompletedOnboarding: enforcedRole === 'patient' ? false : true,
        };

        try {
          await setDoc(doc(db, 'users', userCred.user.uid), profile);
        } catch {}

        handleSuccessRedirect(profile);
      } else {
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        let profile: UserProfile;

        try {
          const userDoc = await getDoc(doc(db, 'users', userCred.user.uid));
          if (userDoc.exists()) {
            profile = userDoc.data() as UserProfile;
          } else {
            profile = {
              uid: userCred.user.uid,
              fullName: userCred.user.displayName || email.split('@')[0],
              email: userCred.user.email || email,
              role,
            };
          }
        } catch {
          profile = {
            uid: userCred.user.uid,
            fullName: email.split('@')[0],
            email,
            role,
          };
        }

        handleSuccessRedirect(profile);
      }
    } catch (err: any) {
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        setError('Invalid email or password. Please verify your credentials.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered. Please switch to Sign In.');
      } else {
        setError(err.message || 'Authentication failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const userCred = await signInWithPopup(auth, googleProvider);
      const enforcedRole: UserRole = role.toLowerCase() === 'doctor' ? 'doctor' : 'patient';
      const profile: UserProfile = {
        uid: userCred.user.uid,
        fullName: userCred.user.displayName || 'Google Telehealth User',
        email: userCred.user.email || 'user@curalink.health',
        role: enforcedRole,
        specialty: enforcedRole === 'doctor' ? 'General Tele-Medicine' : undefined,
        licenseNumber: enforcedRole === 'doctor' ? `MD-GOOG-${Math.floor(100000 + Math.random() * 900000)}` : undefined,
        isVerified: false,
        hasCompletedOnboarding: enforcedRole === 'patient' ? false : true,
      };

      try {
        await setDoc(doc(db, 'users', userCred.user.uid), profile, { merge: true });
      } catch {}

      handleSuccessRedirect(profile);
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Google sign-in popup was closed before completing.');
      } else {
        setError(err.message || 'Google Sign-in failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-teal-950 text-white flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white text-slate-800 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in duration-300 text-xs">
        {/* Brand Banner */}
        <div className="bg-gradient-to-r from-teal-800 via-teal-900 to-slate-900 text-white p-7 text-center">
          <div className="w-12 h-12 rounded-2xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300 mx-auto mb-3 shadow-md">
            <HeartPulse className="w-6 h-6 animate-pulse" />
          </div>
          <h2 className="text-xl font-black tracking-tight">
            Cura<span className="text-teal-400">Link</span> Telehealth
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            Continuous IoT Patient Telemetry & Encrypted Clinical Hub
          </p>
        </div>

        <div className="p-6 sm:p-7 space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Role Switcher Pill */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
              Select Your Role:
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setRole('Patient')}
                className={`py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  role === 'Patient'
                    ? 'bg-white text-teal-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <User className="w-3.5 h-3.5 text-teal-600" />
                <span>Patient</span>
              </button>

              <button
                type="button"
                onClick={() => setRole('Doctor')}
                className={`py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  role === 'Doctor'
                    ? 'bg-white text-teal-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Stethoscope className="w-3.5 h-3.5 text-teal-600" />
                <span>Clinician</span>
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {isSignUp && (
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Full Legal Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder={role === 'Doctor' ? 'Dr. John Watson, MD' : 'Jane Doe'}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>
            )}

            {isSignUp && role === 'Doctor' && (
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Clinical Specialty
                </label>
                <input
                  type="text"
                  required
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-teal-500"
                />
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  placeholder="name@telehealth.org"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md shadow-teal-600/20 transition-all cursor-pointer flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
            >
              <span>{isSignUp ? 'Create My Account' : 'Sign In & Enter Dashboard'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Google Auth Button */}
          <div className="pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={handleGoogleAuth}
              disabled={isLoading}
              className="w-full py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>
          </div>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
              }}
              className="text-teal-700 hover:underline font-semibold"
            >
              {isSignUp
                ? 'Already have an account? Sign In'
                : "Don't have an account? Create an account"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
