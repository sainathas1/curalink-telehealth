'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ShieldAlert,
  ShieldCheck,
  Check,
  UserCheck,
  Stethoscope,
  Mail,
  FileBadge,
  Search,
  ArrowLeft,
  RefreshCw,
  Lock,
  HeartPulse,
  LogOut,
  Clock,
  CheckCircle2,
  ExternalLink,
  PlusCircle,
} from 'lucide-react';
import { auth, db } from '../../lib/firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import {
  collection,
  doc,
  updateDoc,
  onSnapshot,
  setDoc,
} from 'firebase/firestore';

const AUTHORIZED_ADMIN_EMAIL = 'sainathas8788@gmail.com';

interface PendingDoctor {
  id: string;
  uid: string;
  fullName: string;
  email: string;
  licenseNumber: string;
  specialty?: string;
  role: string;
  isVerified?: boolean;
  createdAt?: string;
}

export default function AdminCommandCenterPage() {
  const router = useRouter();

  // Security & Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);

  // Doctors State
  const [pendingDoctors, setPendingDoctors] = useState<PendingDoctor[]>([]);
  const [verifiedCount, setVerifiedCount] = useState<number>(0);
  const [dataLoading, setDataLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [isCreatingDemo, setIsCreatingDemo] = useState<boolean>(false);

  // 1. Security & Authentication Check
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false);

      if (user && user.email?.trim().toLowerCase() === AUTHORIZED_ADMIN_EMAIL.toLowerCase()) {
        setIsAuthorized(true);
      } else {
        setIsAuthorized(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // 2. Real-time Firestore Query for Doctors
  useEffect(() => {
    if (!isAuthorized) return;

    setDataLoading(true);
    const usersCol = collection(db, 'users');

    const unsubscribeSnapshot = onSnapshot(
      usersCol,
      (snapshot) => {
        const pendingList: PendingDoctor[] = [];
        let verifiedTotal = 0;

        snapshot.docs.forEach((docSnap) => {
          const data = docSnap.data();
          const role = (data.role || '').toLowerCase();

          if (role === 'doctor') {
            const isDocVerified = data.isVerified === true;
            if (isDocVerified) {
              verifiedTotal++;
            } else {
              pendingList.push({
                id: docSnap.id,
                uid: data.uid || docSnap.id,
                fullName: data.fullName || data.name || data.displayName || 'Dr. Unnamed Clinician',
                email: data.email || 'N/A',
                licenseNumber: data.licenseNumber || data.medicalLicense || 'Pending Submission',
                specialty: data.specialty || 'General Tele-Medicine',
                role: data.role,
                isVerified: false,
                createdAt: data.createdAt
                  ? typeof data.createdAt === 'string'
                    ? data.createdAt
                    : data.createdAt?.toDate?.()?.toLocaleDateString?.() || 'Recent'
                  : 'Recent',
              });
            }
          }
        });

        setPendingDoctors(pendingList);
        setVerifiedCount(verifiedTotal);
        setDataLoading(false);
      },
      (error) => {
        console.error('Error listening to doctors collection:', error);
        setDataLoading(false);
      }
    );

    return () => unsubscribeSnapshot();
  }, [isAuthorized]);

  // Handle Doctor Approval Action
  const handleApprove = async (doctor: PendingDoctor) => {
    if (approvingId) return;
    setApprovingId(doctor.id);

    try {
      // Optimistically remove from pending list immediately
      setPendingDoctors((prev) => prev.filter((d) => d.id !== doctor.id));
      setVerifiedCount((prev) => prev + 1);

      // Update Firestore document
      const doctorRef = doc(db, 'users', doctor.id);
      await updateDoc(doctorRef, {
        isVerified: true,
        verifiedAt: new Date().toISOString(),
        verifiedBy: currentUser?.email || AUTHORIZED_ADMIN_EMAIL,
      });

      setSuccessToast(`Successfully verified credentials for ${doctor.fullName}. Privileges granted.`);
      setTimeout(() => {
        setSuccessToast(null);
      }, 4000);
    } catch (err: any) {
      console.error('Approval failed:', err);
      // Rollback on error by re-adding
      setPendingDoctors((prev) => [...prev, doctor]);
      alert(`Approval error: ${err.message || 'Failed to update Firestore document.'}`);
    } finally {
      setApprovingId(null);
    }
  };

  // Helper: Seed a test pending doctor for administrative verification demonstration
  const handleCreateTestDoctor = async () => {
    setIsCreatingDemo(true);
    try {
      const demoId = `test-doc-${Date.now()}`;
      const randomLicense = `MD-CA-${Math.floor(100000 + Math.random() * 900000)}`;
      const specialties = ['Cardiovascular Medicine', 'Tele-Neurology', 'Family Practice', 'Emergency Care'];
      const pickedSpecialty = specialties[Math.floor(Math.random() * specialties.length)];

      await setDoc(doc(db, 'users', demoId), {
        uid: demoId,
        fullName: `Dr. Candidate ${Math.floor(10 + Math.random() * 89)}`,
        email: `clinician.${Math.floor(100 + Math.random() * 899)}@health-network.org`,
        role: 'Doctor',
        specialty: pickedSpecialty,
        licenseNumber: randomLicense,
        isVerified: false,
        createdAt: new Date().toISOString(),
      });

      setSuccessToast('New pending doctor application submitted to verification queue.');
      setTimeout(() => setSuccessToast(null), 3500);
    } catch (e: any) {
      console.error('Failed to create test doctor:', e);
    } finally {
      setIsCreatingDemo(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    router.push('/auth');
  };

  // Filtered doctors list based on search query
  const filteredDoctors = pendingDoctors.filter((doc) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      doc.fullName.toLowerCase().includes(q) ||
      doc.email.toLowerCase().includes(q) ||
      doc.licenseNumber.toLowerCase().includes(q) ||
      (doc.specialty && doc.specialty.toLowerCase().includes(q))
    );
  });

  // -------------------------------------------------------------
  // STATE A: Loading Security Authorization
  // -------------------------------------------------------------
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 text-white flex flex-col items-center justify-center p-6">
        <div className="bg-slate-900/90 border border-teal-500/30 p-8 rounded-3xl shadow-2xl backdrop-blur-xl max-w-md w-full text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-teal-500/10 border border-teal-400/30 flex items-center justify-center text-teal-400 mx-auto shadow-inner">
            <ShieldCheck className="w-8 h-8 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white">Authenticating Security Credentials</h2>
            <p className="text-xs text-slate-400 mt-1">Verifying administrative role clearance for CuraLink Command Center...</p>
          </div>
          <div className="flex items-center justify-center gap-2 text-teal-400 text-xs font-mono">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Establishing secure RBAC handshake...</span>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // STATE B: Unauthorized Access Screen (Security Gate)
  // -------------------------------------------------------------
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-rose-950 text-white flex flex-col items-center justify-center p-4 sm:p-6">
        <div className="max-w-md w-full bg-slate-900/95 border border-rose-500/30 rounded-3xl p-8 shadow-2xl shadow-rose-950/50 backdrop-blur-xl text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
          {/* Lock / Warning Icon */}
          <div className="w-20 h-20 rounded-3xl bg-rose-500/10 border border-rose-500/40 flex items-center justify-center text-rose-400 mx-auto shadow-lg shadow-rose-500/20">
            <ShieldAlert className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-bold uppercase tracking-wider">
              <Lock className="w-3.5 h-3.5" />
              <span>403 Forbidden Access</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white">
              Unauthorized Access
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              This administrative command center is strictly restricted to verified startup administrators.
              Only <span className="font-semibold text-rose-300 underline underline-offset-2">{AUTHORIZED_ADMIN_EMAIL}</span> holds clearance to verify medical clinician licenses.
            </p>
          </div>

          {/* Current Auth Status Card */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 text-left space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between text-slate-400">
              <span>Authentication Status:</span>
              <span className={currentUser ? 'text-amber-400 font-bold' : 'text-rose-400 font-bold'}>
                {currentUser ? 'Signed In (Insufficient Clearance)' : 'Unauthenticated'}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-400 truncate">
              <span>Current Identity:</span>
              <span className="text-white font-medium truncate max-w-[200px]">
                {currentUser?.email || 'None (Guest Session)'}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>Required Role:</span>
              <span className="text-teal-400 font-bold">Super Admin Clearance</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 pt-2">
            <Link
              href="/"
              className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-all flex items-center justify-center gap-2 border border-slate-700"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Public Home</span>
            </Link>

            <Link
              href="/auth"
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 text-white font-bold text-xs shadow-lg shadow-teal-900/40 transition-all flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Sign In as Authorized Administrator</span>
            </Link>
          </div>

          <div className="text-[10px] text-slate-500 pt-2 border-t border-slate-800">
            CuraLink Telehealth Security Layer • Continuous Access Audit Logging
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // STATE C: Authorized Super Admin Command Center
  // -------------------------------------------------------------
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Admin Navigation Bar */}
      <header className="border-b border-slate-800/80 bg-slate-900/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-teal-400 shadow-sm">
              <HeartPulse className="w-5 h-5 text-teal-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-base sm:text-lg tracking-tight text-white">
                  Cura<span className="text-teal-400">Link</span>
                </span>
                <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Command Center
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">Administrative Medical Credentialing Hub</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Admin identity pill */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-xs text-slate-300">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
              <span className="font-mono text-white text-[11px]">{currentUser?.email}</span>
            </div>

            {/* Link to public portal */}
            <Link
              href="/"
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-colors flex items-center gap-1.5 border border-slate-700"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Portal</span>
            </Link>

            {/* Sign Out */}
            <button
              onClick={handleSignOut}
              className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 text-xs font-semibold transition-colors flex items-center gap-1.5 border border-rose-500/30 cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Success Toast Notification */}
        {successToast && (
          <div className="bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 px-4 py-3 rounded-2xl flex items-center justify-between text-xs sm:text-sm shadow-lg shadow-emerald-950/30 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span className="font-medium">{successToast}</span>
            </div>
            <button
              onClick={() => setSuccessToast(null)}
              className="text-emerald-400 hover:text-emerald-200 text-xs font-bold px-2 py-0.5 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Hero Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 p-6 sm:p-8 border border-slate-700/60 shadow-xl">
          <div className="absolute -top-12 -right-12 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-400/30">
                  Super Admin Console
                </span>
                <span className="text-xs text-slate-300 flex items-center gap-1 font-mono">
                  <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
                  RBAC Level 4 Clearance
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                Pending Doctors Dashboard
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                Review verified medical licensing credentials and authorize telemedicine practice rights for onboarded physicians across the CuraLink network.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleCreateTestDoctor}
                disabled={isCreatingDemo}
                className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold text-xs border border-slate-600 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                title="Inject a test pending physician to test credential review"
              >
                <PlusCircle className="w-4 h-4 text-teal-400" />
                <span>{isCreatingDemo ? 'Submitting...' : 'Seed Test Doctor'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Clinical KPI Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Awaiting Verification
              </span>
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black text-amber-400 tracking-tight">
                {pendingDoctors.length}
              </span>
              <span className="text-xs text-slate-400">clinician{pendingDoctors.length === 1 ? '' : 's'} pending</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">Doctor accounts requiring manual license credential check.</p>
          </div>

          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Verified Medical Roster
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <UserCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black text-emerald-400 tracking-tight">
                {verifiedCount}
              </span>
              <span className="text-xs text-slate-400">active doctors</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">Active practitioners with full prescription and video privileges.</p>
          </div>

          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Security & Real-time Sync
              </span>
              <div className="w-8 h-8 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-xl font-bold text-teal-300 tracking-tight">Live Firestore</span>
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
            </div>
            <p className="text-[11px] text-slate-400 mt-2">Encrypted Firestore stream active with security rules enforcement.</p>
          </div>
        </div>

        {/* Dashboard Card & Table */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-sm">
          {/* Table Header & Search Filter */}
          <div className="p-5 sm:p-6 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">Pending Clinician Approvals</h2>
                <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-teal-300 text-xs font-mono font-bold">
                  {filteredDoctors.length}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Review identity, contact details, and state licensing before granting telehealth authority.
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, email, or license..."
                className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 transition-colors"
              />
            </div>
          </div>

          {/* Table Content */}
          {dataLoading ? (
            <div className="py-16 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-teal-400 animate-spin mx-auto" />
              <p className="text-xs text-slate-400 font-mono">Querying Firestore credential registry...</p>
            </div>
          ) : filteredDoctors.length === 0 ? (
            /* EMPTY STATE: As strictly specified */
            <div className="py-16 px-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 mx-auto shadow-inner">
                <CheckCircle2 className="w-8 h-8 text-teal-400" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h3 className="text-base font-bold text-white tracking-tight">
                  All doctor accounts are currently verified.
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  There are no pending doctor registrations awaiting credential verification at this moment. New doctor sign-ups will automatically populate here in real-time.
                </p>
              </div>

              {pendingDoctors.length > 0 && searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-xs text-teal-400 hover:text-teal-300 underline underline-offset-2 cursor-pointer"
                >
                  Clear search filter
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3.5 px-6">Clinician Name</th>
                    <th className="py-3.5 px-6">Email Address</th>
                    <th className="py-3.5 px-6">License Number</th>
                    <th className="py-3.5 px-6">Verification Status</th>
                    <th className="py-3.5 px-6 text-right">Approval Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {filteredDoctors.map((doc) => {
                    const isApproving = approvingId === doc.id;

                    return (
                      <tr
                        key={doc.id}
                        className="hover:bg-slate-800/40 transition-colors group"
                      >
                        {/* Clinician Name */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-300 font-bold shrink-0">
                              <Stethoscope className="w-4 h-4 text-teal-400" />
                            </div>
                            <div>
                              <div className="font-semibold text-white text-xs group-hover:text-teal-300 transition-colors">
                                {doc.fullName}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                {doc.specialty || 'General Tele-Medicine'}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Email */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2 font-mono text-[11px] text-slate-300">
                            <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <a
                              href={`mailto:${doc.email}`}
                              className="hover:text-teal-300 hover:underline transition-colors"
                            >
                              {doc.email}
                            </a>
                          </div>
                        </td>

                        {/* License Number */}
                        <td className="py-4 px-6">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700/80 font-mono text-[11px] text-teal-300">
                            <FileBadge className="w-3.5 h-3.5 text-teal-400" />
                            <span>{doc.licenseNumber}</span>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-4 px-6">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[10px] font-bold tracking-wide">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                            Pending Review
                          </span>
                        </td>

                        {/* Approval Action: Clean Green Approve Button */}
                        <td className="py-4 px-6 text-right">
                          <button
                            onClick={() => handleApprove(doc)}
                            disabled={isApproving}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs shadow-md shadow-emerald-950/40 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border border-emerald-400/40"
                          >
                            {isApproving ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                <span>Verifying...</span>
                              </>
                            ) : (
                              <>
                                <Check className="w-4 h-4 stroke-[2.5]" />
                                <span>Approve</span>
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Table Footer */}
          <div className="p-4 bg-slate-950/70 border-t border-slate-800 text-[11px] text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div>
              Showing {filteredDoctors.length} of {pendingDoctors.length} pending physician account{pendingDoctors.length === 1 ? '' : 's'}.
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              Authorized Security Clearance: {AUTHORIZED_ADMIN_EMAIL}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
