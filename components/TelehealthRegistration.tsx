'use client';

import React, { useState, useEffect } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  type Timestamp,
} from 'firebase/firestore';
import {
  Stethoscope,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  HeartPulse,
  LogOut,
  Hospital,
  CalendarCheck,
  ArrowRight,
  ClipboardList,
  ExternalLink,
  Info,
  Phone,
} from 'lucide-react';
import { auth, db, testConnection } from '@/lib/firebase';
import { handleFirestoreError, OperationType } from '@/lib/firestore-errors';
import firebaseConfig from '../firebase-applet-config.json';

export type UserRole = 'Patient' | 'Doctor';

export interface UserProfileData {
  uid: string;
  fullName: string;
  email: string;
  phoneNumber?: string;
  role: UserRole;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

const FIREBASE_PROJECT_ID = (firebaseConfig as { projectId?: string }).projectId || 'gen-lang-client-0885497074';
const FIREBASE_AUTH_SETTINGS_URL = `https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}/authentication/providers`;

export default function TelehealthRegistration() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole>('Patient');
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Status states
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isOperationNotAllowed, setIsOperationNotAllowed] = useState(false);

  // Active registered user / session state
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfileData | null>(null);
  const [, setIsFetchingProfile] = useState(false);

  // Mode: 'register' | 'login'
  const [authMode, setAuthMode] = useState<'register' | 'login'>('register');

  useEffect(() => {
    testConnection();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        setIsFetchingProfile(true);
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const snap = await getDoc(userDocRef);
          if (snap.exists()) {
            setUserProfile(snap.data() as UserProfileData);
          } else {
            setUserProfile(null);
          }
        } catch (err) {
          console.warn('Could not fetch existing profile', err);
        } finally {
          setIsFetchingProfile(false);
        }
      } else {
        setUserProfile(null);
      }
    });

    return () => unsubscribe();
  }, []);

  const resetForm = () => {
    setFullName('');
    setEmail('');
    setPhoneNumber('');
    setPassword('');
    setConfirmPassword('');
    setAgreedToTerms(false);
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsOperationNotAllowed(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsOperationNotAllowed(false);

    // Validation
    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName || trimmedName.length < 2) {
      setErrorMessage('Please enter your full legal name (at least 2 characters).');
      return;
    }
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setErrorMessage('Please provide a valid medical contact email address.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please verify and re-enter.');
      return;
    }
    if (!agreedToTerms) {
      setErrorMessage('You must acknowledge HIPAA compliance and terms to register.');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Create user in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        trimmedEmail,
        password
      );
      const user = userCredential.user;

      // Update displayName on Firebase Auth profile
      try {
        await updateProfile(user, { displayName: trimmedName });
      } catch (profileErr) {
        console.warn('Profile display name update notice:', profileErr);
      }

      // 2. Save user's Full Name, Email, Phone, and Role to Firestore collection 'users'
      const userDocRef = doc(db, 'users', user.uid);
      const trimmedPhone = phoneNumber.trim();
      const newUserData: Record<string, unknown> = {
        uid: user.uid,
        fullName: trimmedName,
        email: trimmedEmail,
        role: role,
        isVerified: false,
        createdAt: serverTimestamp(),
        hasCompletedOnboarding: role === 'Patient' ? false : true,
      };
      if (trimmedPhone) {
        newUserData.phoneNumber = trimmedPhone;
      }

      try {
        await setDoc(userDocRef, newUserData);
      } catch (firestoreErr) {
        handleFirestoreError(firestoreErr, OperationType.WRITE, `users/${user.uid}`);
      }

      setUserProfile({
        uid: user.uid,
        fullName: trimmedName,
        email: trimmedEmail,
        phoneNumber: trimmedPhone || undefined,
        role: role,
      });

      setSuccessMessage(
        `Registration successful! Welcome to CuraLink Telehealth, ${role === 'Doctor' ? `Dr. ${trimmedName}` : trimmedName
        }.`
      );
      resetForm();
    } catch (err: unknown) {
      console.error('Registration failed:', err);
      let friendlyError = 'An error occurred during registration. Please try again.';
      if (err instanceof Error) {
        if (err.message.includes('auth/operation-not-allowed')) {
          setIsOperationNotAllowed(true);
          friendlyError =
            'Email/Password sign-in is not yet enabled in the Firebase Console. You can enable it with 1 click in the console, or register instantly with Google below.';
        } else if (err.message.includes('auth/email-already-in-use')) {
          friendlyError = 'This email address is already registered. Please sign in instead.';
        } else if (err.message.includes('auth/weak-password')) {
          friendlyError = 'Password is too weak. Please use at least 6 characters.';
        } else if (err.message.includes('auth/invalid-email')) {
          friendlyError = 'The email address format is invalid.';
        } else {
          friendlyError = err.message;
        }
      }
      setErrorMessage(friendlyError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsOperationNotAllowed(false);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setErrorMessage('Please provide both your email and password.');
      return;
    }

    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, trimmedEmail, password);
      setSuccessMessage('Welcome back! Successfully authenticated.');
      resetForm();
    } catch (err: unknown) {
      console.error('Sign-in error:', err);
      let friendly = 'Failed to sign in. Please verify your credentials.';
      if (err instanceof Error) {
        if (err.message.includes('auth/operation-not-allowed')) {
          setIsOperationNotAllowed(true);
          friendly =
            'Email/Password sign-in is disabled in your Firebase console. Please enable it or sign in with Google.';
        } else if (
          err.message.includes('auth/user-not-found') ||
          err.message.includes('auth/wrong-password') ||
          err.message.includes('auth/invalid-credential')
        ) {
          friendly = 'Invalid email or password. Please try again.';
        } else {
          friendly = err.message;
        }
      }
      setErrorMessage(friendly);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsOperationNotAllowed(false);
    setIsLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const userDocRef = doc(db, 'users', user.uid);
      const existingSnap = await getDoc(userDocRef);

      const resolvedName = user.displayName?.trim() || fullName.trim() || 'Telehealth User';
      const resolvedEmail = user.email || email.trim();

      const resolvedPhone = phoneNumber.trim() || user.phoneNumber || '';

      if (!existingSnap.exists()) {
        const newUserData: Record<string, unknown> = {
          uid: user.uid,
          fullName: resolvedName,
          email: resolvedEmail,
          role: role,
          isVerified: false,
          hasCompletedOnboarding: role === 'Patient' ? false : true,
          createdAt: serverTimestamp(),
        };
        if (resolvedPhone) {
          newUserData.phoneNumber = resolvedPhone;
        }

        try {
          await setDoc(userDocRef, newUserData);
        } catch (firestoreErr) {
          handleFirestoreError(firestoreErr, OperationType.WRITE, `users/${user.uid}`);
        }

        setUserProfile({
          uid: user.uid,
          fullName: resolvedName,
          email: resolvedEmail,
          phoneNumber: resolvedPhone || undefined,
          role: role,
        });

        setSuccessMessage(
          `Registered successfully as ${role} with Google! Welcome, ${role === 'Doctor' ? `Dr. ${resolvedName}` : resolvedName
          }.`
        );
      } else {
        const data = existingSnap.data() as UserProfileData;
        setUserProfile(data);
        setSuccessMessage(
          `Welcome back, ${data.role === 'Doctor' ? `Dr. ` : ''}${data.fullName}!`
        );
      }
      resetForm();
    } catch (err: unknown) {
      console.warn('Google Auth notice:', err);
      let friendly = 'Google authentication encountered an error. Please try again.';
      if (err instanceof Error) {
        if (err.message.includes('auth/popup-closed-by-user')) {
          friendly = 'Google sign-in popup was closed before completing.';
        } else if (err.message.includes('auth/operation-not-allowed')) {
          friendly = 'Google sign-in provider is not enabled in Firebase Authentication.';
          setIsOperationNotAllowed(true);
        } else {
          friendly = err.message;
        }
      }
      setErrorMessage(friendly);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setUserProfile(null);
      setCurrentUser(null);
      setSuccessMessage('You have been securely signed out.');
    } catch (err) {
      console.error('Error signing out:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50/70 via-slate-50 to-teal-100/40 text-slate-800 flex flex-col justify-between selection:bg-teal-500 selection:text-white">
      {/* Top Telehealth Brand Header */}
      <header className="border-b border-teal-100 bg-white/80 backdrop-blur-md sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-teal-600 to-teal-800 flex items-center justify-center text-white shadow-md shadow-teal-700/20">
              <HeartPulse className="h-6 w-6 stroke-[2.2]" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-1.5">
                Cura<span className="text-teal-600">Link</span>
                <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-teal-100 text-teal-800">
                  Telehealth
                </span>
              </span>
              <p className="text-xs text-slate-500 hidden sm:block">
                Secure Clinical Consultations & Patient Care
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-xs text-teal-700 bg-teal-50 border border-teal-200/80 px-2.5 py-1 rounded-full font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
              <span>HIPAA Compliant Cloud</span>
            </div>
            {currentUser && (
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-red-600 transition-colors px-3 py-1.5 rounded-lg border border-slate-200 hover:border-red-200 bg-white hover:bg-red-50 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-12 flex items-center justify-center">
        <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left Hero / Medical Credentials Showcase */}
          <div className="lg:col-span-5 bg-gradient-to-br from-teal-700 via-teal-800 to-slate-900 text-white p-8 rounded-3xl shadow-xl shadow-teal-900/10 flex flex-col justify-between relative overflow-hidden">
            {/* Background ambient accents */}
            <div className="absolute -top-16 -right-16 w-52 h-52 bg-teal-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-16 -left-16 w-52 h-52 bg-emerald-400/20 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-600/50 border border-teal-400/30 text-teal-100 text-xs font-medium">
                <Hospital className="w-3.5 h-3.5" />
                <span>Virtual Clinic Portal</span>
              </div>

              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-snug">
                  Transforming Care Through Trusted Connection.
                </h1>
                <p className="mt-3 text-sm text-teal-100/90 leading-relaxed">
                  Join licensed doctors and patients on CuraLink for verified telehealth consultations, digital prescriptions, and encrypted health records.
                </p>
              </div>

              {/* Role distinction pills */}
              <div className="space-y-3 pt-2">
                <div className="p-3.5 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/15 flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-teal-500/30 text-teal-200 mt-0.5">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">For Patients</h3>
                    <p className="text-xs text-teal-100/80 mt-0.5">
                      Consult licensed physicians 24/7, review lab results, and receive home delivery prescriptions.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/15 flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-teal-500/30 text-teal-200 mt-0.5">
                    <Stethoscope className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">For Doctors</h3>
                    <p className="text-xs text-teal-100/80 mt-0.5">
                      Streamlined clinical scheduling, HD video consults, and encrypted electronic health records (EHR).
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quality assurance badges */}
            <div className="relative z-10 pt-8 mt-6 border-t border-teal-600/50 flex items-center justify-between text-xs text-teal-200">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> 256-bit AES
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Firebase Auth
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Realtime Sync
              </span>
            </div>
          </div>

          {/* Right Column: Dynamic Registration & Authenticated View */}
          <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/60 border border-slate-100 flex flex-col justify-between">
            {/* Show Authenticated State Card if user is already registered & logged in */}
            {currentUser && userProfile ? (
              <div className="space-y-6 my-auto py-4">
                <div className="text-center space-y-2">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-teal-50 border-2 border-teal-200 text-teal-600 mb-2">
                    {userProfile.role === 'Doctor' ? (
                      <Stethoscope className="w-8 h-8" />
                    ) : (
                      <User className="w-8 h-8" />
                    )}
                  </div>
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-teal-100 text-teal-800">
                    {userProfile.role} Profile Active
                  </span>
                  <h2 className="text-2xl font-bold text-slate-900">
                    {userProfile.role === 'Doctor' ? `Dr. ${userProfile.fullName}` : userProfile.fullName}
                  </h2>
                  <p className="text-sm text-slate-500">{userProfile.email}</p>
                </div>

                {/* Firestore Stored Data Card */}
                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/80 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                    <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider">
                      Firestore Document Saved
                    </span>
                    <span className="text-xs text-teal-700 bg-teal-50 font-mono px-2 py-0.5 rounded border border-teal-200">
                      users/{userProfile.uid}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm pt-1">
                    <div>
                      <span className="text-xs text-slate-500 block">Full Name:</span>
                      <span className="font-semibold text-slate-800">{userProfile.fullName}</span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 block">Assigned Role:</span>
                      <span className="inline-flex items-center gap-1 font-semibold text-teal-700">
                        {userProfile.role === 'Doctor' ? (
                          <Stethoscope className="w-3.5 h-3.5" />
                        ) : (
                          <User className="w-3.5 h-3.5" />
                        )}
                        {userProfile.role}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 block">Registered Email:</span>
                      <span className="font-medium text-slate-800 break-all">{userProfile.email}</span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 block">Phone Number:</span>
                      <span className="font-medium text-slate-800">
                        {userProfile.phoneNumber ? (
                          <span className="inline-flex items-center gap-1 text-slate-800">
                            <Phone className="w-3 h-3 text-teal-600" />
                            {userProfile.phoneNumber}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Not provided</span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Action Clinical Shortcuts */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Telehealth Portal Modules
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl border border-teal-100 bg-teal-50/50 flex items-center gap-3">
                      <CalendarCheck className="w-5 h-5 text-teal-600" />
                      <div>
                        <p className="text-xs font-bold text-slate-800">
                          {userProfile.role === 'Doctor' ? 'Manage Schedule' : 'Book Appointment'}
                        </p>
                        <p className="text-[11px] text-slate-500">Virtual video consultation</p>
                      </div>
                    </div>
                    <div className="p-3 rounded-xl border border-teal-100 bg-teal-50/50 flex items-center gap-3">
                      <ClipboardList className="w-5 h-5 text-teal-600" />
                      <div>
                        <p className="text-xs font-bold text-slate-800">
                          {userProfile.role === 'Doctor' ? 'Patient Charts' : 'Health Records'}
                        </p>
                        <p className="text-[11px] text-slate-500">Encrypted medical files</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="flex-1 py-3 px-4 rounded-xl border border-slate-300 hover:border-red-300 text-slate-700 hover:text-red-700 hover:bg-red-50 text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out & Register Another
                  </button>
                </div>
              </div>
            ) : (
              /* Registration & Login Form Card */
              <div>
                {/* Form Mode Header Tabs */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                      {authMode === 'register' ? 'Register New Account' : 'Telehealth Sign In'}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {authMode === 'register'
                        ? 'Select Patient or Doctor role and create your credentials.'
                        : 'Enter your verified account email and password.'}
                    </p>
                  </div>
                  <div className="flex rounded-lg bg-slate-100 p-1">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('register');
                        setErrorMessage(null);
                        setSuccessMessage(null);
                        setIsOperationNotAllowed(false);
                      }}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${authMode === 'register'
                        ? 'bg-white text-teal-800 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                      Register
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('login');
                        setErrorMessage(null);
                        setSuccessMessage(null);
                        setIsOperationNotAllowed(false);
                      }}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${authMode === 'login'
                        ? 'bg-white text-teal-800 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                      Sign In
                    </button>
                  </div>
                </div>

                {/* Error Banner */}
                {errorMessage && (
                  <div
                    role="alert"
                    className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5 animate-fadeIn"
                  >
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <div className="flex-1 font-medium">{errorMessage}</div>
                  </div>
                )}

                {/* Special Helper for auth/operation-not-allowed */}
                {isOperationNotAllowed && (
                  <div className="mb-5 p-4 rounded-2xl bg-amber-50 border border-amber-200/90 text-amber-900 text-xs space-y-3">
                    <div className="flex items-start gap-2.5">
                      <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-amber-900 text-sm">
                          Enable Email/Password in Firebase Console:
                        </p>
                        <p className="text-amber-800 mt-1 leading-relaxed">
                          By default, newly provisioned Firebase projects require toggling the &ldquo;Email/Password&rdquo; provider switch once in the Firebase console:
                        </p>
                        <ol className="list-decimal list-inside space-y-1 mt-2 font-medium text-amber-900">
                          <li>
                            Open the{' '}
                            <a
                              href={FIREBASE_AUTH_SETTINGS_URL}
                              target="_blank"
                              rel="noreferrer"
                              className="text-teal-700 underline font-bold inline-flex items-center gap-1 hover:text-teal-800"
                            >
                              Firebase Authentication Sign-in Providers
                              <ExternalLink className="w-3 h-3 inline" />
                            </a>
                          </li>
                          <li>Click &ldquo;Email/Password&rdquo; under Sign-in providers</li>
                          <li>Toggle &ldquo;Enable&rdquo; to ON and click &ldquo;Save&rdquo;</li>
                        </ol>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-amber-200/60 flex items-center justify-between">
                      <span className="text-amber-800 font-semibold">
                        Or authenticate instantly with Google (already enabled):
                      </span>
                    </div>
                  </div>
                )}


                {/* Success Banner */}
                {successMessage && (
                  <div
                    role="status"
                    className="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2.5 animate-fadeIn"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="flex-1 font-medium">{successMessage}</div>
                  </div>
                )}

                {/* Main Registration Form */}
                {authMode === 'register' ? (
                  <form onSubmit={handleRegister} className="space-y-4">
                    {/* Role Selection Dropdown (Required) */}
                    <div>
                      <label
                        htmlFor="role-select"
                        className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
                      >
                        Select Your Role <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <select
                          id="role-select"
                          value={role}
                          onChange={(e) => setRole(e.target.value as UserRole)}
                          className="w-full appearance-none pl-10 pr-10 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 shadow-xs transition-all cursor-pointer"
                        >
                          <option value="Patient">Patient (Seeking Healthcare & Teleconsults)</option>
                          <option value="Doctor">Doctor (Licensed Medical Practitioner)</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center text-teal-600">
                          {role === 'Doctor' ? (
                            <Stethoscope className="w-5 h-5" />
                          ) : (
                            <User className="w-5 h-5" />
                          )}
                        </div>
                        <div className="pointer-events-none absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400">
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>

                      {/* Role Context Helper */}
                      <p className="text-[11px] text-teal-700 bg-teal-50/70 border border-teal-100 rounded-lg p-2 mt-1.5 flex items-center gap-1.5">
                        <span className="font-semibold">Selected Role:</span>
                        {role === 'Doctor'
                          ? 'Doctor profile will be saved to Firestore users collection with clinical credentials.'
                          : 'Patient profile will be saved to Firestore users collection for virtual care.'}
                      </p>
                    </div>

                    {/* Full Name Input */}
                    <div>
                      <label
                        htmlFor="full-name"
                        className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
                      >
                        Full Name <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                          <User className="w-4 h-4" />
                        </div>
                        <input
                          id="full-name"
                          type="text"
                          required
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder={role === 'Doctor' ? 'Dr. Elizabeth Blackwell' : 'Jane Doe'}
                          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 shadow-xs transition-all"
                        />
                      </div>
                    </div>

                    {/* Email Input */}
                    <div>
                      <label
                        htmlFor="email"
                        className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
                      >
                        Email Address <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                          <Mail className="w-4 h-4" />
                        </div>
                        <input
                          id="email"
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="doctor@hospital.org or patient@domain.com"
                          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 shadow-xs transition-all"
                        />
                      </div>
                    </div>

                    {/* Phone Number Input */}
                    <div>
                      <label
                        htmlFor="phone-number"
                        className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
                      >
                        Phone Number <span className="text-slate-400 font-normal lowercase">(optional for SMS consults)</span>
                      </label>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                          <Phone className="w-4 h-4" />
                        </div>
                        <input
                          id="phone-number"
                          type="tel"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          placeholder="+1 (555) 234-5678"
                          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 shadow-xs transition-all"
                        />
                      </div>
                    </div>

                    {/* Password & Confirm Password Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="password"
                          className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
                        >
                          Password <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                            <Lock className="w-4 h-4" />
                          </div>
                          <input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            required
                            minLength={6}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Min 6 characters"
                            className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 shadow-xs transition-all"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor="confirm-password"
                          className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
                        >
                          Confirm Password <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                            <Lock className="w-4 h-4" />
                          </div>
                          <input
                            id="confirm-password"
                            type={showPassword ? 'text' : 'password'}
                            required
                            minLength={6}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Re-enter password"
                            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 shadow-xs transition-all"
                          />
                        </div>
                      </div>
                    </div>

                    {/* HIPAA Compliance & Terms Checkbox */}
                    <div className="pt-1">
                      <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-600">
                        <input
                          type="checkbox"
                          checked={agreedToTerms}
                          onChange={(e) => setAgreedToTerms(e.target.checked)}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                        />
                        <span>
                          I agree to the{' '}
                          <span className="text-teal-700 font-semibold underline">
                            Telehealth Terms of Service
                          </span>{' '}
                          and acknowledge the{' '}
                          <span className="text-teal-700 font-semibold underline">
                            HIPAA Privacy & Security Practices
                          </span>.
                        </span>
                      </label>
                    </div>

                    {/* Email/Password Register Button */}
                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white font-semibold text-sm shadow-md shadow-teal-700/20 hover:shadow-lg hover:shadow-teal-700/30 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                      >
                        {isLoading ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Processing Registration...</span>
                          </>
                        ) : (
                          <>
                            <span>Register with Email as {role}</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>

                    {/* Divider */}
                    <div className="relative my-4">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-slate-200" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-white px-3 text-slate-400 font-semibold">Or continue with</span>
                      </div>
                    </div>

                    {/* Google Sign-in Button (Pre-configured & instant) */}
                    <div>
                      <button
                        type="button"
                        onClick={handleGoogleAuth}
                        disabled={isLoading}
                        className="w-full py-2.5 px-4 rounded-xl border border-slate-300 hover:border-teal-500 bg-white hover:bg-teal-50/40 text-slate-700 font-semibold text-sm transition-all flex items-center justify-center gap-2.5 shadow-2xs cursor-pointer disabled:opacity-60"
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
                        <span>Register with Google (Instant {role})</span>
                      </button>
                    </div>
                  </form>
                ) : (
                  /* Sign In Form */
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div>
                      <label
                        htmlFor="signin-email"
                        className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
                      >
                        Email Address <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                          <Mail className="w-4 h-4" />
                        </div>
                        <input
                          id="signin-email"
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="doctor@hospital.org or patient@domain.com"
                          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 shadow-xs transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="signin-password"
                        className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
                      >
                        Password <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                          <Lock className="w-4 h-4" />
                        </div>
                        <input
                          id="signin-password"
                          type={showPassword ? 'text' : 'password'}
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Your account password"
                          className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 shadow-xs transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white font-semibold text-sm shadow-md shadow-teal-700/20 hover:shadow-lg hover:shadow-teal-700/30 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                      >
                        {isLoading ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Authenticating...</span>
                          </>
                        ) : (
                          <>
                            <span>Sign In to Telehealth Portal</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>

                    {/* Divider */}
                    <div className="relative my-4">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-slate-200" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-white px-3 text-slate-400 font-semibold">Or continue with</span>
                      </div>
                    </div>

                    {/* Google Sign-in Button */}
                    <div>
                      <button
                        type="button"
                        onClick={handleGoogleAuth}
                        disabled={isLoading}
                        className="w-full py-2.5 px-4 rounded-xl border border-slate-300 hover:border-teal-500 bg-white hover:bg-teal-50/40 text-slate-700 font-semibold text-sm transition-all flex items-center justify-center gap-2.5 shadow-2xs cursor-pointer disabled:opacity-60"
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
                        <span>Sign In with Google</span>
                      </button>
                    </div>
                  </form>
                )}

                {/* Footer Switcher */}
                <div className="mt-6 pt-4 border-t border-slate-100 text-center text-xs text-slate-500">
                  {authMode === 'register' ? (
                    <p>
                      Already registered with a hospital or clinic?{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode('login');
                          setErrorMessage(null);
                          setIsOperationNotAllowed(false);
                        }}
                        className="text-teal-700 font-semibold hover:underline cursor-pointer"
                      >
                        Sign in here
                      </button>
                    </p>
                  ) : (
                    <p>
                      Need a new Telehealth patient or practitioner account?{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode('register');
                          setErrorMessage(null);
                          setIsOperationNotAllowed(false);
                        }}
                        className="text-teal-700 font-semibold hover:underline cursor-pointer"
                      >
                        Register now
                      </button>
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Medical Footer */}
      <footer className="border-t border-teal-100 bg-white/60 py-4 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>&copy; {new Date().getFullYear()} CuraLink Telehealth Network. All rights reserved.</span>
          <span className="flex items-center gap-1.5 text-teal-700 font-medium">
            <ShieldCheck className="w-3.5 h-3.5" /> Encrypted with Firebase Firestore & Authentication
          </span>
        </div>
      </footer>
    </div>
  );
}
