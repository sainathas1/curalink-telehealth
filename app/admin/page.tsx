'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ShieldCheck,
  Stethoscope,
  Mail,
  FileBadge,
  Search,
  Check,
  X,
  ExternalLink,
  LogOut,
  RefreshCw,
  Clock,
  CheckCircle2,
  PlusCircle,
  Activity,
  Home,
  UserCheck,
  UserX,
} from 'lucide-react';
import { auth, db } from '../../lib/firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import {
  collection,
  doc,
  updateDoc,
  onSnapshot,
  setDoc,
  query,
  where,
} from 'firebase/firestore';

const AUTHORIZED_ADMIN_EMAIL = 'sainathas8788@gmail.com';

interface DoctorUser {
  id: string;
  uid: string;
  fullName: string;
  email: string;
  licenseNumber?: string;
  specialty?: string;
  role: string;
  isVerified?: boolean;
  verifiedAt?: string;
  createdAt?: string;
  rawCreatedAt?: any;
}

export default function AdminMasterCommandCenterPage() {
  const router = useRouter();

  // Authentication & Clearance State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);

  // Firestore Real-Time Data State: ONLY Doctors
  const [doctors, setDoctors] = useState<DoctorUser[]>([]);
  const [dataLoading, setDataLoading] = useState<boolean>(true);

  // Search & Filtering State
  const [doctorSearch, setDoctorSearch] = useState<string>('');
  const [doctorFilter, setDoctorFilter] = useState<'all' | 'verified' | 'pending'>('all');

  // Interactive States
  const [actionDoctorId, setActionDoctorId] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [isSeedingDemo, setIsSeedingDemo] = useState<boolean>(false);

  // 1. Strict Authentication & Security Check
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false);

      if (!user || user.email?.trim().toLowerCase() !== AUTHORIZED_ADMIN_EMAIL.toLowerCase()) {
        setIsAuthorized(false);
        router.replace('/');
      } else {
        setIsAuthorized(true);
      }
    });

    return () => unsubscribeAuth();
  }, [router]);

  // 2. Real-Time Firestore Listener: ONLY role == 'doctor'
  useEffect(() => {
    if (!isAuthorized) return;

    setDataLoading(true);

    let unsubscribeDoctors = () => {};

    try {
      const doctorsQuery = query(collection(db, 'users'), where('role', '==', 'doctor'));
      unsubscribeDoctors = onSnapshot(
        doctorsQuery,
        (snapshot) => {
          const docsList: DoctorUser[] = snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            const isVerified = data.isVerified === true;
            return {
              id: docSnap.id,
              uid: data.uid || docSnap.id,
              fullName: (data.fullName || data.name || data.displayName || 'Dr. Clinician').trim(),
              email: (data.email || 'N/A').trim(),
              licenseNumber: (data.licenseNumber || data.medicalLicense || '').trim(),
              specialty: (data.specialty || 'General Tele-Medicine').trim(),
              role: data.role || 'doctor',
              isVerified: isVerified,
              verifiedAt: data.verifiedAt,
              createdAt: data.createdAt
                ? typeof data.createdAt === 'string'
                  ? data.createdAt
                  : data.createdAt?.toDate?.()?.toLocaleDateString?.() || 'Recent'
                : 'Recent',
              rawCreatedAt: data.createdAt,
            };
          });

          // Sort by creation date descending
          docsList.sort((a, b) => {
            const parseTime = (val: any): number => {
              if (!val) return 0;
              if (typeof val?.toMillis === 'function') return val.toMillis();
              if (typeof val?.toDate === 'function') return val.toDate().getTime();
              if (typeof val === 'number') return val;
              const t = new Date(val).getTime();
              return isNaN(t) ? 0 : t;
            };
            return parseTime(b.rawCreatedAt) - parseTime(a.rawCreatedAt);
          });

          setDoctors(docsList);
          setDataLoading(false);
        },
        (error) => {
          console.error('Error fetching doctors in Master Command Center:', error);
          setDataLoading(false);
        }
      );
    } catch (error) {
      console.error('Exception setting up doctors fetch in Master Command Center:', error);
      setDataLoading(false);
    }

    return () => {
      try {
        unsubscribeDoctors();
      } catch {}
    };
  }, [isAuthorized]);

  // Doctor Verification Action (Approve / Revoke Toggle)
  const handleToggleVerification = async (user: DoctorUser) => {
    if (actionDoctorId) return;
    setActionDoctorId(user.id);

    const isCurrentlyVerified = user.isVerified === true;
    const newVerifiedState = !isCurrentlyVerified;

    try {
      const docRef = doc(db, 'users', user.id);
      await updateDoc(docRef, {
        isVerified: newVerifiedState,
        verifiedAt: newVerifiedState ? new Date().toISOString() : null,
        verifiedBy: currentUser?.email || AUTHORIZED_ADMIN_EMAIL,
      });

      setSuccessToast(
        newVerifiedState
          ? `Privileges Granted: Dr. ${user.fullName || 'Clinician'} is now verified.`
          : `Privileges Revoked: Dr. ${user.fullName || 'Clinician'} set to unverified status.`
      );
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err: any) {
      console.error('Failed to toggle verification:', err);
      alert(`Firestore update error: ${err.message || 'Operation failed'}`);
    } finally {
      setActionDoctorId(null);
    }
  };

  // Seed demo clinician for quick testing
  const handleSeedDemoDoctor = async () => {
    setIsSeedingDemo(true);
    try {
      const demoId = `demo-doc-${Date.now()}`;
      const randomLicense = `MD-CA-${Math.floor(100000 + Math.random() * 900000)}`;
      const specialties = ['Cardiovascular Medicine', 'Tele-Neurology', 'Internal Medicine', 'Family Medicine'];
      const pickedSpecialty = specialties[Math.floor(Math.random() * specialties.length)];

      await setDoc(doc(db, 'users', demoId), {
        uid: demoId,
        fullName: `Dr. Candidate ${Math.floor(10 + Math.random() * 89)}`,
        email: `physician.${Math.floor(100 + Math.random() * 899)}@curalink-network.org`,
        role: 'doctor',
        specialty: pickedSpecialty,
        licenseNumber: randomLicense,
        isVerified: false,
        createdAt: new Date().toISOString(),
      });
      setSuccessToast('Submitted pending doctor application into verification queue.');
      setTimeout(() => setSuccessToast(null), 3500);
    } catch (e: any) {
      console.error('Seed demo doctor failed:', e);
    } finally {
      setIsSeedingDemo(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    router.push('/auth');
  };

  // Filtered Doctors
  const filteredDoctors = doctors.filter((doc) => {
    if (doctorFilter === 'verified' && !doc.isVerified) return false;
    if (doctorFilter === 'pending' && doc.isVerified) return false;

    const q = doctorSearch.toLowerCase().trim();
    if (!q) return true;
    const fullName = (doc.fullName || '').toLowerCase();
    const email = (doc.email || '').toLowerCase();
    const license = (doc.licenseNumber || '').toLowerCase();
    const specialty = (doc.specialty || '').toLowerCase();
    return (
      fullName.includes(q) ||
      email.includes(q) ||
      license.includes(q) ||
      specialty.includes(q)
    );
  });

  // Clinician Metrics
  const totalDoctorsCount = doctors.length;
  const verifiedDoctorsCount = doctors.filter((d) => d.isVerified).length;
  const pendingDoctorsCount = doctors.filter((d) => !d.isVerified).length;

  // Loading Screen
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6">
        <div className="bg-slate-900/90 border border-teal-500/30 p-8 rounded-3xl shadow-2xl backdrop-blur-xl max-w-md w-full text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-teal-500/10 border border-teal-400/30 flex items-center justify-center text-teal-400 mx-auto">
            <ShieldCheck className="w-8 h-8 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white">Validating Security Clearance</h2>
            <p className="text-xs text-slate-400 mt-1">Authenticating Master Command Center credentials...</p>
          </div>
          <div className="flex items-center justify-center gap-2 text-teal-400 text-xs font-mono">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Establishing secure administrative session...</span>
          </div>
        </div>
      </div>
    );
  }

  // Unauthorized Screen
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-slate-900 border border-rose-500/30 p-8 rounded-3xl shadow-2xl max-w-md w-full space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
            <ShieldCheck className="w-8 h-8 text-rose-500" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white">Administrative Access Restricted</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Only designated root administrators (<span className="text-teal-400 font-mono">{AUTHORIZED_ADMIN_EMAIL}</span>) are granted access.
          </p>
          <button
            onClick={() => router.push('/')}
            className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs transition-all shadow-lg shadow-teal-600/20 cursor-pointer"
          >
            Return to Public Portal
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row antialiased selection:bg-teal-500 selection:text-white">
      {/* ------------------------------------------------------------- */}
      {/* SIDEBAR NAVIGATION                                            */}
      {/* ------------------------------------------------------------- */}
      <aside className="w-full md:w-64 bg-slate-900/90 border-r border-slate-800 flex flex-col justify-between shrink-0 backdrop-blur-md">
        <div>
          {/* Brand Header */}
          <div className="p-6 border-b border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-teal-500/20">
                <ShieldCheck className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <span className="font-black text-sm tracking-tight text-white block">
                  Cura<span className="text-teal-400">Link</span>
                </span>
                <span className="text-[10px] font-mono uppercase tracking-widest text-teal-400 block font-bold">
                  Admin Command
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5 text-xs font-semibold">
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl bg-teal-600 text-white shadow-md shadow-teal-950/40 transition-all cursor-pointer"
            >
              <Activity className="w-4 h-4" />
              <span>Platform Overview</span>
            </button>

            <button
              onClick={() => document.getElementById('doctor-section')?.scrollIntoView({ behavior: 'smooth' })}
              className="w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-slate-400 hover:text-white hover:bg-slate-800/60 transition-all cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Stethoscope className="w-4 h-4" />
                <span>Doctor Verification</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-slate-800 text-teal-300 text-[10px] font-mono">
                {doctors.length}
              </span>
            </button>

            <Link
              href="/"
              className="flex items-center gap-3 px-3.5 py-3 rounded-2xl text-slate-400 hover:text-white hover:bg-slate-800/60 transition-all"
            >
              <Home className="w-4 h-4" />
              <span>Public Portal</span>
              <ExternalLink className="w-3.5 h-3.5 ml-auto text-slate-500" />
            </Link>
          </nav>
        </div>

        {/* Admin Clearance & Sign Out Footer */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/50 space-y-3">
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <div className="truncate">
              <p className="text-[11px] font-bold text-white truncate">{currentUser?.email}</p>
              <p className="text-[10px] text-teal-400 font-mono">RBAC Super Admin</p>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            className="w-full py-2.5 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 border border-rose-500/30 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out Session</span>
          </button>
        </div>
      </aside>

      {/* ------------------------------------------------------------- */}
      {/* MAIN CONTENT AREA                                             */}
      {/* ------------------------------------------------------------- */}
      <main className="flex-1 min-w-0 p-5 sm:p-8 space-y-8 overflow-y-auto">
        {/* Toast Notification */}
        {successToast && (
          <div className="bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 px-4 py-3 rounded-2xl flex items-center justify-between text-xs sm:text-sm shadow-xl shadow-emerald-950/30 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span className="font-semibold">{successToast}</span>
            </div>
            <button
              onClick={() => setSuccessToast(null)}
              className="text-emerald-400 hover:text-emerald-200 text-xs font-bold px-2 py-0.5 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Top Header / Welcome Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 p-6 sm:p-8 border border-slate-700/60 shadow-xl">
          <div className="absolute -top-12 -right-12 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-400/30">
                  Doctor Verification Oversight
                </span>
                <span className="text-xs text-slate-300 flex items-center gap-1 font-mono">
                  <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
                  Live Sync
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                Master Command Center
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                Centralized credential verification and privileged license review for licensed physicians in the CuraLink clinical network.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleSeedDemoDoctor}
                disabled={isSeedingDemo}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs border border-slate-600 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-xs"
                title="Seed a candidate doctor application for verification review"
              >
                <PlusCircle className="w-4 h-4 text-teal-400" />
                <span>{isSeedingDemo ? 'Seeding...' : '+ Seed Doctor Application'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* STAT CARDS: Focused Clinician Oversight                       */}
        {/* ------------------------------------------------------------- */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Clinician Credential Metrics
            </h3>
            <span className="text-[11px] text-teal-400 font-mono flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Live Firestore Registry
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Card 1: Total Doctors */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-lg hover:border-slate-700 transition-all relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-28 h-28 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-indigo-500/10 transition-colors" />

              <div className="flex items-center justify-between relative z-10">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Total Doctors
                </span>
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-inner">
                  <Stethoscope className="w-5 h-5" />
                </div>
              </div>

              <div className="mt-4 flex items-baseline gap-2 relative z-10">
                <span className="text-4xl font-black text-white font-mono tracking-tight">
                  {totalDoctorsCount}
                </span>
                <span className="text-xs text-slate-400 font-medium">clinician account{totalDoctorsCount === 1 ? '' : 's'}</span>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 relative z-10">
                <span className="text-slate-400 font-medium">Role: doctor</span>
                <span className="text-teal-400 font-mono">collection(&apos;users&apos;)</span>
              </div>
            </div>

            {/* Card 2: Verified Clinicians */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-lg hover:border-slate-700 transition-all relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-28 h-28 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/10 transition-colors" />

              <div className="flex items-center justify-between relative z-10">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Verified Doctors
                </span>
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
                  <UserCheck className="w-5 h-5" />
                </div>
              </div>

              <div className="mt-4 flex items-baseline gap-2 relative z-10">
                <span className="text-4xl font-black text-emerald-300 font-mono tracking-tight">
                  {verifiedDoctorsCount}
                </span>
                <span className="text-xs text-slate-400 font-medium">active credential{verifiedDoctorsCount === 1 ? '' : 's'}</span>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 relative z-10">
                <span className="text-emerald-400 font-semibold">isVerified == true</span>
                <span className="text-slate-400">Full EHR & Rx Enabled</span>
              </div>
            </div>

            {/* Card 3: Pending Review */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-lg hover:border-slate-700 transition-all relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-28 h-28 bg-amber-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-amber-500/10 transition-colors" />

              <div className="flex items-center justify-between relative z-10">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Pending Verification
                </span>
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
                  <UserX className="w-5 h-5" />
                </div>
              </div>

              <div className="mt-4 flex items-baseline gap-2 relative z-10">
                <span className="text-4xl font-black text-amber-300 font-mono tracking-tight">
                  {pendingDoctorsCount}
                </span>
                <span className="text-xs text-slate-400 font-medium">awaiting review</span>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 relative z-10">
                <span className="text-amber-400 font-semibold">Action Required</span>
                <span className="text-slate-400">Awaiting Admin Toggle</span>
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------- */}
        {/* DOCTOR VERIFICATION TABLE SECTION                             */}
        {/* ------------------------------------------------------------- */}
        <section id="doctor-section" className="space-y-4 pt-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-sm">
            {/* Header & Search */}
            <div className="p-5 sm:p-6 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
                    <Stethoscope className="w-4 h-4" />
                  </div>
                  <h2 className="text-lg font-bold text-white tracking-tight">Doctor Verification Registry</h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-teal-300 text-xs font-mono font-bold">
                    {filteredDoctors.length}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Review clinician medical licenses and toggle verification privileges in real-time.
                </p>
              </div>

              {/* Sub-filters & Search Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  <button
                    onClick={() => setDoctorFilter('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      doctorFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All ({doctors.length})
                  </button>
                  <button
                    onClick={() => setDoctorFilter('verified')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      doctorFilter === 'verified'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'text-slate-400 hover:text-emerald-300'
                    }`}
                  >
                    Verified ({verifiedDoctorsCount})
                  </button>
                  <button
                    onClick={() => setDoctorFilter('pending')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      doctorFilter === 'pending'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'text-slate-400 hover:text-amber-300'
                    }`}
                  >
                    Pending ({pendingDoctorsCount})
                  </button>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={doctorSearch}
                    onChange={(e) => setDoctorSearch(e.target.value)}
                    placeholder="Search doctor, email, license..."
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Table Content */}
            {dataLoading ? (
              <div className="py-16 text-center space-y-3">
                <RefreshCw className="w-8 h-8 text-teal-400 animate-spin mx-auto" />
                <p className="text-xs text-slate-400 font-mono">Querying clinician registry from Firestore...</p>
              </div>
            ) : filteredDoctors.length === 0 ? (
              <div className="py-16 px-6 text-center space-y-3">
                <Stethoscope className="w-10 h-10 text-slate-600 mx-auto stroke-1" />
                <h3 className="text-base font-bold text-white tracking-tight">No Doctors Found</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  {doctorSearch
                    ? `No clinician records match "${doctorSearch}".`
                    : 'No doctors registered in the system yet.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3.5 px-6">Clinician Name</th>
                      <th className="py-3.5 px-6">Email Address</th>
                      <th className="py-3.5 px-6">License Number</th>
                      <th className="py-3.5 px-6">Specialty</th>
                      <th className="py-3.5 px-6">Status</th>
                      <th className="py-3.5 px-6 text-right">Verification Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300 font-medium">
                    {filteredDoctors.map((docItem) => {
                      const isActing = actionDoctorId === docItem.id;
                      const isVerified = docItem.isVerified === true;

                      return (
                        <tr key={docItem.id} className="hover:bg-slate-800/40 transition-colors group">
                          {/* Name */}
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center font-bold text-teal-300 text-xs shrink-0">
                                <Stethoscope className="w-4 h-4 text-teal-400" />
                              </div>
                              <div>
                                <div className="font-semibold text-white text-xs group-hover:text-teal-300 transition-colors">
                                  {docItem.fullName}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono">
                                  UID: {docItem.id.slice(0, 10)}...
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Email */}
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-2 font-mono text-[11px] text-slate-300">
                              <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                              <a
                                href={`mailto:${docItem.email}`}
                                className="hover:text-teal-300 hover:underline"
                              >
                                {docItem.email}
                              </a>
                            </div>
                          </td>

                          {/* License */}
                          <td className="py-4 px-6">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] text-teal-300">
                              <FileBadge className="w-3.5 h-3.5 text-teal-400" />
                              <span>{docItem.licenseNumber || 'Pending Filing'}</span>
                            </div>
                          </td>

                          {/* Specialty */}
                          <td className="py-4 px-6">
                            <span className="text-slate-300 text-xs">
                              {docItem.specialty || 'General Tele-Medicine'}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="py-4 px-6">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                isVerified
                                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                              }`}
                            >
                              {isVerified ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Clock className="w-3.5 h-3.5 text-amber-400" />
                              )}
                              <span>{isVerified ? 'Verified' : 'Unverified (Pending)'}</span>
                            </span>
                          </td>

                          {/* Action Toggle */}
                          <td className="py-4 px-6 text-right">
                            {isVerified ? (
                              <button
                                onClick={() => handleToggleVerification(docItem)}
                                disabled={isActing}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 border border-rose-500/30 font-bold text-xs transition-all cursor-pointer disabled:opacity-50"
                                title="Revoke clinician verification"
                              >
                                {isActing ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <X className="w-3.5 h-3.5" />
                                )}
                                <span>Revoke</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => handleToggleVerification(docItem)}
                                disabled={isActing}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs shadow-md shadow-emerald-950/40 transition-all cursor-pointer disabled:opacity-50 border border-emerald-400/40"
                                title="Approve doctor credentials"
                              >
                                {isActing ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                )}
                                <span>Approve</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
