'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ShieldCheck,
  ShieldAlert,
  Users,
  Stethoscope,
  Cpu,
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
  AlertTriangle,
  Radio,
  Thermometer,
  HardDrive,
  Copy,
  ChevronRight,
  PlusCircle,
  Activity,
  Layers,
  HelpCircle,
  SlidersHorizontal,
  Home,
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
}

interface PatientUser {
  id: string;
  uid: string;
  fullName: string;
  email: string;
  role: string;
  hasCompletedOnboarding: boolean;
  bloodGroup?: string;
  knownAllergies?: string;
  chronicConditions?: string[];
  currentMedications?: string;
  isDeactivated?: boolean;
  lastSyncedTemperature?: number;
  lastSyncedAt?: string;
  temperatureStatus?: string;
  deviceModel?: string;
  hardwareId?: string;
  createdAt?: string;
}

export default function AdminMasterCommandCenterPage() {
  const router = useRouter();

  // Authentication & Clearance State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);

  // Firestore Real-Time Data State
  const [doctors, setDoctors] = useState<DoctorUser[]>([]);
  const [patients, setPatients] = useState<PatientUser[]>([]);
  const [dataLoading, setDataLoading] = useState<boolean>(true);

  // Search & Filtering State
  const [doctorSearch, setDoctorSearch] = useState<string>('');
  const [doctorFilter, setDoctorFilter] = useState<'all' | 'verified' | 'pending'>('all');
  const [patientSearch, setPatientSearch] = useState<string>('');
  const [patientFilter, setPatientFilter] = useState<'all' | 'connected' | 'onboarded'>('all');

  // Interactive States
  const [actionDoctorId, setActionDoctorId] = useState<string | null>(null);
  const [selectedPatientForHardware, setSelectedPatientForHardware] = useState<PatientUser | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [copiedHardwareId, setCopiedHardwareId] = useState<boolean>(false);
  const [isSeedingDemo, setIsSeedingDemo] = useState<boolean>(false);
  const [activeNavSection, setActiveNavSection] = useState<'overview' | 'doctors' | 'patients'>('overview');

  // 1. Strict Authentication & Security Check
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false);

      if (!user || user.email?.trim().toLowerCase() !== AUTHORIZED_ADMIN_EMAIL.toLowerCase()) {
        setIsAuthorized(false);
        // Requirement: If no user logged in, or if email is NOT sainathas8788@gmail.com, immediately redirect to /
        router.replace('/');
      } else {
        setIsAuthorized(true);
      }
    });

    return () => unsubscribeAuth();
  }, [router]);

  // 2. Real-Time Firestore Listener for Users Collection
  useEffect(() => {
    if (!isAuthorized) return;

    setDataLoading(true);
    // Queries strictly matching the exact PascalCase role casing used during registration ('Doctor' and 'Patient')
    const doctorsQuery = query(collection(db, 'users'), where('role', '==', 'Doctor'));
    const patientsQuery = query(collection(db, 'users'), where('role', '==', 'Patient'));

    let doctorsLoaded = false;
    let patientsLoaded = false;
    const checkLoadingDone = () => {
      if (doctorsLoaded && patientsLoaded) {
        setDataLoading(false);
      }
    };

    const unsubscribeDoctors = onSnapshot(
      doctorsQuery,
      (snapshot) => {
        const docsList: DoctorUser[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          // Data fallback: if isVerified is missing or undefined, default to false
          const isVerified = data.isVerified === true;
          return {
            id: docSnap.id,
            uid: data.uid || docSnap.id,
            fullName: (data.fullName || data.name || data.displayName || 'Dr. Clinician').trim(),
            email: (data.email || 'N/A').trim(),
            licenseNumber: (data.licenseNumber || data.medicalLicense || '').trim(),
            specialty: (data.specialty || 'General Tele-Medicine').trim(),
            role: data.role || 'Doctor',
            isVerified: isVerified,
            verifiedAt: data.verifiedAt,
            createdAt: data.createdAt
              ? typeof data.createdAt === 'string'
                ? data.createdAt
                : data.createdAt?.toDate?.()?.toLocaleDateString?.() || 'Recent'
              : 'Recent',
          };
        });
        setDoctors(docsList);
        doctorsLoaded = true;
        checkLoadingDone();
      },
      (error) => {
        console.error('Error fetching doctors in Master Command Center:', error);
        doctorsLoaded = true;
        checkLoadingDone();
      }
    );

    const unsubscribePatients = onSnapshot(
      patientsQuery,
      (snapshot) => {
        const patsList: PatientUser[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          const hasHardware = data.lastSyncedTemperature !== undefined || !!data.deviceModel || !!data.hardwareId;
          const deterministicHardwareId = data.hardwareId || (hasHardware ? `USB-IOT-${docSnap.id.slice(0, 8).toUpperCase()}` : undefined);

          return {
            id: docSnap.id,
            uid: data.uid || docSnap.id,
            fullName: (data.fullName || data.name || data.displayName || 'Patient User').trim(),
            email: (data.email || 'N/A').trim(),
            role: data.role || 'Patient',
            hasCompletedOnboarding: data.hasCompletedOnboarding === true,
            bloodGroup: data.bloodGroup,
            knownAllergies: data.knownAllergies,
            chronicConditions: data.chronicConditions,
            currentMedications: data.currentMedications,
            isDeactivated: data.isDeactivated === true,
            lastSyncedTemperature: data.lastSyncedTemperature,
            lastSyncedAt: data.lastSyncedAt,
            temperatureStatus: data.temperatureStatus,
            deviceModel: data.deviceModel,
            hardwareId: deterministicHardwareId,
            createdAt: data.createdAt
              ? typeof data.createdAt === 'string'
                ? data.createdAt
                : data.createdAt?.toDate?.()?.toLocaleDateString?.() || 'Recent'
              : 'Recent',
          };
        });
        setPatients(patsList);
        patientsLoaded = true;
        checkLoadingDone();
      },
      (error) => {
        console.error('Error fetching patients in Master Command Center:', error);
        patientsLoaded = true;
        checkLoadingDone();
      }
    );

    return () => {
      unsubscribeDoctors();
      unsubscribePatients();
    };
  }, [isAuthorized]);



  // Doctor Verification Action (Approve / Revoke Toggle)
  const handleToggleVerification = async (doctor: DoctorUser) => {
    if (actionDoctorId) return;
    setActionDoctorId(doctor.id);

    // Fallback: If doctor.isVerified is missing or undefined, default toggle state to false (so toggle sets to true)
    const isCurrentlyVerified = doctor.isVerified === true;
    const newVerifiedState = !isCurrentlyVerified;

    try {
      const docRef = doc(db, 'users', doctor.id);
      await updateDoc(docRef, {
        isVerified: newVerifiedState,
        verifiedAt: newVerifiedState ? new Date().toISOString() : null,
        verifiedBy: currentUser?.email || AUTHORIZED_ADMIN_EMAIL,
      });

      setSuccessToast(
        newVerifiedState
          ? `Privileges Granted: Dr. ${doctor.fullName || 'Clinician'} is now verified.`
          : `Privileges Revoked: Dr. ${doctor.fullName || 'Clinician'} set to unverified status.`
      );
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err: any) {
      console.error('Failed to toggle verification:', err);
      alert(`Firestore update error: ${err.message || 'Operation failed'}`);
    } finally {
      setActionDoctorId(null);
    }
  };

  // Seed demo clinician or patient for quick demonstration
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
        role: 'Doctor',
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

  const handleCopyHardwareId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedHardwareId(true);
    setTimeout(() => setCopiedHardwareId(false), 2000);
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

  // Filtered Patients
  const filteredPatients = patients.filter((pt) => {
    if (patientFilter === 'connected' && !pt.hardwareId && pt.lastSyncedTemperature === undefined) return false;
    if (patientFilter === 'onboarded' && !pt.hasCompletedOnboarding) return false;

    const q = patientSearch.toLowerCase().trim();
    if (!q) return true;
    const fullName = (pt.fullName || '').toLowerCase();
    const email = (pt.email || '').toLowerCase();
    const deviceModel = (pt.deviceModel || '').toLowerCase();
    const hardwareId = (pt.hardwareId || '').toLowerCase();
    return (
      fullName.includes(q) ||
      email.includes(q) ||
      deviceModel.includes(q) ||
      hardwareId.includes(q)
    );
  });

  // Top Metrics Calculation
  const totalPatientsCount = patients.length;
  const totalDoctorsCount = doctors.length;
  const hardwareDeployedCount = patients.filter(
    (p) => p.lastSyncedTemperature !== undefined || !!p.deviceModel || !!p.hardwareId
  ).length;

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

  // Unauthorized Gate (Redirecting to /)
  if (!isAuthorized) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row font-sans selection:bg-teal-500 selection:text-white">
      {/* ------------------------------------------------------------- */}
      {/* SIDEBAR NAVIGATION                                            */}
      {/* ------------------------------------------------------------- */}
      <aside className="w-full md:w-64 bg-slate-900/95 border-b md:border-b-0 md:border-r border-slate-800/80 flex flex-col justify-between shrink-0 md:min-h-screen sticky top-0 z-30 backdrop-blur-md">
        <div>
          {/* Brand & Portal Header */}
          <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-400 shadow-sm">
                <ShieldCheck className="w-5 h-5 text-teal-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-base tracking-tight text-white">
                    Cura<span className="text-teal-400">Link</span>
                  </span>
                  <span className="text-[9px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Master
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-medium">Command Center</p>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5 text-xs font-semibold">
            <button
              onClick={() => {
                setActiveNavSection('overview');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl transition-all cursor-pointer ${
                activeNavSection === 'overview'
                  ? 'bg-teal-600 text-white shadow-md shadow-teal-950/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Platform Overview</span>
            </button>

            <button
              onClick={() => {
                setActiveNavSection('doctors');
                document.getElementById('doctor-section')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl transition-all cursor-pointer ${
                activeNavSection === 'doctors'
                  ? 'bg-teal-600 text-white shadow-md shadow-teal-950/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <Stethoscope className="w-4 h-4" />
                <span>Doctor Verification</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-slate-800 text-teal-300 text-[10px] font-mono">
                {doctors.length}
              </span>
            </button>

            <button
              onClick={() => {
                setActiveNavSection('patients');
                document.getElementById('patient-section')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl transition-all cursor-pointer ${
                activeNavSection === 'patients'
                  ? 'bg-teal-600 text-white shadow-md shadow-teal-950/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <Users className="w-4 h-4" />
                <span>Patient Management</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-slate-800 text-teal-300 text-[10px] font-mono">
                {patients.length}
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
                  Real-Time Administrative Oversight
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
                Platform-wide control over physician credentials, patient enrollment, and connected USB IoT biomedical sensors.
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
        {/* TOP STAT CARDS (Total Patients, Total Doctors, Hardware)      */}
        {/* ------------------------------------------------------------- */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Platform Biometrics & Capacity Metrics
            </h3>
            <span className="text-[11px] text-teal-400 font-mono flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Live Firestore Feeds
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Card 1: Total Patients */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-lg hover:border-slate-700 transition-all relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-28 h-28 bg-teal-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-teal-500/10 transition-colors" />

              <div className="flex items-center justify-between relative z-10">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Total Patients
                </span>
                <div className="w-10 h-10 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 shadow-inner">
                  <Users className="w-5 h-5" />
                </div>
              </div>

              <div className="mt-4 flex items-baseline gap-2 relative z-10">
                <span className="text-4xl font-black text-white font-mono tracking-tight">
                  {totalPatientsCount}
                </span>
                <span className="text-xs text-slate-400 font-medium">registered user{totalPatientsCount === 1 ? '' : 's'}</span>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 relative z-10">
                <span>{patients.filter((p) => p.hasCompletedOnboarding).length} intake verified</span>
                <span className="text-teal-400 font-medium">Role: patient</span>
              </div>
            </div>

            {/* Card 2: Total Doctors */}
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
                <span className="text-emerald-400 font-semibold">
                  {doctors.filter((d) => d.isVerified).length} verified
                </span>
                <span className="text-amber-400 font-semibold">
                  {doctors.filter((d) => !d.isVerified).length} pending review
                </span>
              </div>
            </div>

            {/* Card 3: Hardware Deployed */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-lg hover:border-slate-700 transition-all relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-28 h-28 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-cyan-500/10 transition-colors" />

              <div className="flex items-center justify-between relative z-10">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Hardware Deployed
                </span>
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-inner">
                  <Cpu className="w-5 h-5" />
                </div>
              </div>

              <div className="mt-4 flex items-baseline gap-2 relative z-10">
                <span className="text-4xl font-black text-cyan-300 font-mono tracking-tight">
                  {hardwareDeployedCount}
                </span>
                <span className="text-xs text-slate-400 font-medium">USB sensor node{hardwareDeployedCount === 1 ? '' : 's'}</span>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 relative z-10">
                <span className="text-cyan-400 font-medium flex items-center gap-1">
                  <Radio className="w-3 h-3" />
                  Active Telemetry Probes
                </span>
                <span className="text-slate-500 font-mono">/patient/device</span>
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
                  <h2 className="text-lg font-bold text-white tracking-tight">Doctor Verification</h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-teal-300 text-xs font-mono font-bold">
                    {filteredDoctors.length}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Manage medical practice credentials and toggle approval privileges across the clinical network.
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
                    onClick={() => setDoctorFilter('pending')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      doctorFilter === 'pending'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'text-slate-400 hover:text-amber-300'
                    }`}
                  >
                    Pending ({doctors.filter((d) => !d.isVerified).length})
                  </button>
                  <button
                    onClick={() => setDoctorFilter('verified')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      doctorFilter === 'verified'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'text-slate-400 hover:text-emerald-300'
                    }`}
                  >
                    Verified ({doctors.filter((d) => d.isVerified).length})
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
                <p className="text-xs text-slate-400 font-mono">Querying clinician roster from Firestore...</p>
              </div>
            ) : filteredDoctors.length === 0 ? (
              <div className="py-16 px-6 text-center space-y-3">
                <Stethoscope className="w-10 h-10 text-slate-600 mx-auto stroke-1" />
                <h3 className="text-base font-bold text-white tracking-tight">No Doctors Found</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  {doctorSearch
                    ? `No doctor matches "${doctorSearch}".`
                    : doctorFilter === 'pending'
                    ? 'All registered doctor accounts are currently verified.'
                    : 'No doctors registered in the system yet.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3.5 px-6">Doctor Name</th>
                      <th className="py-3.5 px-6">Email Address</th>
                      <th className="py-3.5 px-6">Medical License Number</th>
                      <th className="py-3.5 px-6">Status</th>
                      <th className="py-3.5 px-6 text-right">Approve / Revoke Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300 font-medium">
                    {filteredDoctors.map((doc) => {
                      const isActing = actionDoctorId === doc.id;
                      const isVerified = doc.isVerified === true;

                      return (
                        <tr key={doc.id} className="hover:bg-slate-800/40 transition-colors group">
                          {/* Name & Specialty */}
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-9 h-9 rounded-xl border flex items-center justify-center font-bold text-xs shrink-0 ${
                                  isVerified
                                    ? 'bg-teal-500/15 border-teal-500/30 text-teal-300'
                                    : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                                }`}
                              >
                                {(doc.fullName || 'Dr. Clinician')
                                  .split(' ')
                                  .filter(Boolean)
                                  .map((n) => n[0])
                                  .join('')
                                  .slice(0, 2)
                                  .toUpperCase() || 'DR'}
                              </div>
                              <div>
                                <div className="font-semibold text-white text-xs group-hover:text-teal-300 transition-colors">
                                  {doc.fullName?.trim() || 'Dr. Clinician'}
                                </div>
                                <div className="text-[11px] text-slate-400">{doc.specialty?.trim() || 'General Tele-Medicine'}</div>
                              </div>
                            </div>
                          </td>

                          {/* Email */}
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-2 font-mono text-[11px] text-slate-300">
                              <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                              <a
                                href={doc.email && doc.email !== 'N/A' ? `mailto:${doc.email}` : '#'}
                                className="hover:text-teal-300 hover:underline"
                              >
                                {doc.email?.trim() || 'No email provided'}
                              </a>
                            </div>
                          </td>

                          {/* License Number: with fallback for empty/undefined */}
                          <td className="py-4 px-6">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700/80 font-mono text-[11px]">
                              <FileBadge className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                              <span className={doc.licenseNumber && doc.licenseNumber.trim() ? 'text-teal-300' : 'text-slate-400 italic'}>
                                {doc.licenseNumber && doc.licenseNumber.trim() ? doc.licenseNumber.trim() : 'Pending Submission'}
                              </span>
                            </div>
                          </td>

                          {/* Verification Status */}
                          <td className="py-4 px-6">
                            {isVerified ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Verified Active</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                                <Clock className="w-3.5 h-3.5 text-amber-400" />
                                <span>Pending Approval</span>
                              </span>
                            )}
                          </td>

                          {/* Action: Approve / Revoke Toggle */}
                          <td className="py-4 px-6 text-right">
                            {isVerified ? (
                              <button
                                onClick={() => handleToggleVerification(doc)}
                                disabled={isActing}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 border border-rose-500/30 font-bold text-xs transition-all cursor-pointer disabled:opacity-50"
                                title="Revoke medical verification privileges"
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
                                onClick={() => handleToggleVerification(doc)}
                                disabled={isActing}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs shadow-md shadow-emerald-950/40 transition-all cursor-pointer disabled:opacity-50 border border-emerald-400/40"
                                title="Approve medical license and grant practice clearance"
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

        {/* ------------------------------------------------------------- */}
        {/* PATIENT MANAGEMENT TABLE SECTION                              */}
        {/* ------------------------------------------------------------- */}
        <section id="patient-section" className="space-y-4 pt-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-sm">
            {/* Header & Search */}
            <div className="p-5 sm:p-6 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <Users className="w-4 h-4" />
                  </div>
                  <h2 className="text-lg font-bold text-white tracking-tight">Patient Management</h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-teal-300 text-xs font-mono font-bold">
                    {filteredPatients.length}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Inspect patient onboarding records and view individual connected USB IoT hardware telemetry IDs.
                </p>
              </div>

              {/* Sub-filters & Search Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  <button
                    onClick={() => setPatientFilter('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      patientFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All ({patients.length})
                  </button>
                  <button
                    onClick={() => setPatientFilter('connected')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      patientFilter === 'connected'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : 'text-slate-400 hover:text-cyan-300'
                    }`}
                  >
                    IoT Paired ({hardwareDeployedCount})
                  </button>
                  <button
                    onClick={() => setPatientFilter('onboarded')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      patientFilter === 'onboarded'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'text-slate-400 hover:text-emerald-300'
                    }`}
                  >
                    Onboarded ({patients.filter((p) => p.hasCompletedOnboarding).length})
                  </button>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    placeholder="Search patient, email, hardware ID..."
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Table Content */}
            {dataLoading ? (
              <div className="py-16 text-center space-y-3">
                <RefreshCw className="w-8 h-8 text-teal-400 animate-spin mx-auto" />
                <p className="text-xs text-slate-400 font-mono">Querying patient accounts from Firestore...</p>
              </div>
            ) : filteredPatients.length === 0 ? (
              <div className="py-16 px-6 text-center space-y-3">
                <Users className="w-10 h-10 text-slate-600 mx-auto stroke-1" />
                <h3 className="text-base font-bold text-white tracking-tight">No Patients Found</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  {patientSearch
                    ? `No patient records match "${patientSearch}".`
                    : 'No patients registered in the directory yet.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3.5 px-6">Patient Name</th>
                      <th className="py-3.5 px-6">Email Address</th>
                      <th className="py-3.5 px-6">Medical Onboarding</th>
                      <th className="py-3.5 px-6">Hardware Status</th>
                      <th className="py-3.5 px-6 text-right">IoT Hardware Oversight</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300 font-medium">
                    {filteredPatients.map((pt) => {
                      const hasHardware = pt.lastSyncedTemperature !== undefined || !!pt.deviceModel || !!pt.hardwareId;

                      return (
                        <tr key={pt.id} className="hover:bg-slate-800/40 transition-colors group">
                          {/* Name */}
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center font-bold text-cyan-300 text-xs shrink-0">
                                {(pt.fullName || 'Patient User')
                                  .split(' ')
                                  .filter(Boolean)
                                  .map((n) => n[0])
                                  .join('')
                                  .slice(0, 2)
                                  .toUpperCase() || 'PT'}
                              </div>
                              <div>
                                <div className="font-semibold text-white text-xs group-hover:text-cyan-300 transition-colors flex items-center gap-1.5">
                                  <span>{pt.fullName?.trim() || 'Patient User'}</span>
                                  {pt.bloodGroup && pt.bloodGroup !== 'Not specified' && (
                                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                      {pt.bloodGroup}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono">
                                  UID: {pt.id.slice(0, 10)}...
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Email */}
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-2 font-mono text-[11px] text-slate-300">
                              <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                              <a
                                href={pt.email && pt.email !== 'N/A' ? `mailto:${pt.email}` : '#'}
                                className="hover:text-cyan-300 hover:underline"
                              >
                                {pt.email?.trim() || 'No email provided'}
                              </a>
                            </div>
                          </td>

                          {/* Medical Onboarding */}
                          <td className="py-4 px-6">
                            {pt.hasCompletedOnboarding ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Onboarded</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                                <Clock className="w-3.5 h-3.5 text-amber-400" />
                                <span>Pending Intake</span>
                              </span>
                            )}
                          </td>

                          {/* Hardware Connection Status */}
                          <td className="py-4 px-6">
                            {hasHardware ? (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-500/20 text-teal-300 border border-teal-500/40 text-[10px] font-mono font-bold">
                                  <Thermometer className="w-3 h-3 text-teal-400" />
                                  <span>{pt.lastSyncedTemperature ? `${pt.lastSyncedTemperature.toFixed(1)}°C` : 'USB Stream'}</span>
                                </span>
                                <p className="text-[10px] text-slate-400 truncate max-w-[130px]">
                                  {pt.deviceModel || 'USB Serial Sensor'}
                                </p>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-500 flex items-center gap-1">
                                <Radio className="w-3 h-3 text-slate-600" />
                                <span>Standby / Unpaired</span>
                              </span>
                            )}
                          </td>

                          {/* Action: View Connected IoT Hardware ID Button */}
                          <td className="py-4 px-6 text-right">
                            <button
                              onClick={() => setSelectedPatientForHardware(pt)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-teal-600/20 text-slate-200 hover:text-teal-300 border border-slate-700 hover:border-teal-500/50 font-bold text-xs transition-all cursor-pointer"
                              title="View connected USB IoT Hardware ID and telemetry specs"
                            >
                              <Cpu className="w-3.5 h-3.5 text-teal-400" />
                              <span>View IoT Hardware ID</span>
                            </button>
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

      {/* ------------------------------------------------------------- */}
      {/* CONNECTED IOT HARDWARE ID INSPECTOR MODAL                     */}
      {/* ------------------------------------------------------------- */}
      {selectedPatientForHardware && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150 overflow-y-auto"
          onClick={() => setSelectedPatientForHardware(null)}
        >
          <div
            className="bg-slate-900 border border-teal-500/40 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl text-left animate-in zoom-in-95 duration-200 my-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-teal-950 p-6 border-b border-slate-800 relative">
              <button
                onClick={() => setSelectedPatientForHardware(null)}
                className="absolute right-4 top-4 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-400/30 flex items-center gap-1">
                  <Cpu className="w-3 h-3 text-teal-400" />
                  Hardware Registry Telemetry
                </span>
                <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Live Node
                </span>
              </div>

              <h3 className="text-xl font-black tracking-tight text-white">
                {selectedPatientForHardware.fullName}
              </h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                {selectedPatientForHardware.email}
              </p>
            </div>

            {/* Modal Body: Hardware Details */}
            <div className="p-6 space-y-4 text-xs">
              {/* Primary Hardware ID Display */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-teal-500/30 space-y-2">
                <span className="text-[10px] uppercase font-bold text-teal-300 tracking-wider">
                  Assigned IoT Hardware ID (Web Serial / USB Node)
                </span>
                <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="font-mono text-xs sm:text-sm text-white font-bold tracking-wide truncate">
                    {selectedPatientForHardware.hardwareId ||
                      `USB-IOT-${selectedPatientForHardware.id.slice(0, 10).toUpperCase()}`}
                  </span>
                  <button
                    onClick={() =>
                      handleCopyHardwareId(
                        selectedPatientForHardware.hardwareId ||
                          `USB-IOT-${selectedPatientForHardware.id.slice(0, 10).toUpperCase()}`
                      )
                    }
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0 flex items-center gap-1 text-[11px]"
                    title="Copy Hardware ID to Clipboard"
                  >
                    {copiedHardwareId ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400 font-bold">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Hardware Telemetry Parameters */}
              <div className="grid grid-cols-2 gap-3">
                {/* Last Synced Temp */}
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
                    <Thermometer className="w-3.5 h-3.5 text-teal-400" />
                    Last Synced Temp
                  </span>
                  <div className="text-xl font-black font-mono text-white">
                    {selectedPatientForHardware.lastSyncedTemperature !== undefined
                      ? `${selectedPatientForHardware.lastSyncedTemperature.toFixed(1)}°C`
                      : 'None recorded'}
                  </div>
                  {selectedPatientForHardware.lastSyncedTemperature !== undefined && (
                    <p className="text-[10px] text-slate-400 font-mono">
                      ({((selectedPatientForHardware.lastSyncedTemperature * 9) / 5 + 32).toFixed(1)}°F)
                    </p>
                  )}
                </div>

                {/* Connection Protocol */}
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
                    <Radio className="w-3.5 h-3.5 text-cyan-400" />
                    Hardware Protocol
                  </span>
                  <div className="text-xs font-bold font-mono text-white pt-1">
                    Web Serial API (USB)
                  </div>
                  <p className="text-[10px] text-emerald-400 font-mono">Baud Rate: 115200</p>
                </div>
              </div>

              {/* Hardware Model & Specifications */}
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1 text-slate-300">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Sensor Device Model:</span>
                  <span className="font-mono text-white font-semibold">
                    {selectedPatientForHardware.deviceModel || 'USB Serial Sensor (LM35/DS18B20)'}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                  <span className="text-slate-400">Last Telemetry Sync:</span>
                  <span className="font-mono text-teal-300">
                    {selectedPatientForHardware.lastSyncedAt
                      ? new Date(selectedPatientForHardware.lastSyncedAt).toLocaleString()
                      : 'Awaiting initial stream'}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                  <span className="text-slate-400">Patient Status:</span>
                  <span
                    className={`font-bold capitalize ${
                      selectedPatientForHardware.temperatureStatus === 'critical'
                        ? 'text-rose-400'
                        : selectedPatientForHardware.temperatureStatus === 'elevated'
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {selectedPatientForHardware.temperatureStatus || 'Nominal'}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-5 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-mono">
                Encrypted Patient Device Bridge
              </span>
              <button
                onClick={() => setSelectedPatientForHardware(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
