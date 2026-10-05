'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  HeartPulse,
  ShieldCheck,
  Droplet,
  AlertCircle,
  Activity,
  Pill,
  ArrowRight,
  CheckCircle2,
  Lock,
  RefreshCw,
  FileCheck,
  Info,
} from 'lucide-react';
import { auth, db } from '../../lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useTelehealth } from '../../context/TelehealthContext';

const BLOOD_GROUPS = [
  'A+',
  'A-',
  'B+',
  'B-',
  'AB+',
  'AB-',
  'O+',
  'O-',
  'Unknown / Needs Test',
];

const CHRONIC_CONDITION_OPTIONS = [
  { id: 'Diabetes', label: 'Diabetes (Type 1 or Type 2)', desc: 'Affects blood glucose regulation' },
  { id: 'Hypertension', label: 'Hypertension (High Blood Pressure)', desc: 'Affects arterial pressure & cardiovascular workload' },
  { id: 'Asthma', label: 'Asthma (Respiratory Condition)', desc: 'Chronic airway inflammation & breathing reactivity' },
  { id: 'None', label: 'None', desc: 'No diagnosed chronic health conditions' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { currentUser, setAuthenticatedProfile } = useTelehealth();

  // Auth State
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  // Form Fields
  const [bloodGroup, setBloodGroup] = useState<string>('');
  const [knownAllergies, setKnownAllergies] = useState<string>('');
  const [chronicConditions, setChronicConditions] = useState<string[]>([]);
  const [currentMedications, setCurrentMedications] = useState<string>('');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isAlreadyOnboarded, setIsAlreadyOnboarded] = useState<boolean>(false);

  // Quick allergy chip options
  const allergyPresets = ['Penicillin', 'Sulfa Drugs', 'Aspirin', 'Peanuts', 'Latex', 'No Known Allergies'];

  // 1. Listen for user and pre-fill existing data if any
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            if (data.bloodGroup || data.bloodType) {
              setBloodGroup(data.bloodGroup || data.bloodType || '');
            }
            if (data.knownAllergies) {
              setKnownAllergies(data.knownAllergies);
            } else if (data.allergies && Array.isArray(data.allergies)) {
              setKnownAllergies(data.allergies.join(', '));
            }
            if (data.chronicConditions && Array.isArray(data.chronicConditions)) {
              setChronicConditions(data.chronicConditions);
            }
            if (data.currentMedications) {
              setCurrentMedications(data.currentMedications);
            }
            if (data.hasCompletedOnboarding === true) {
              setIsAlreadyOnboarded(true);
            }
          }
        } catch (err) {
          console.warn('Error reading existing medical profile:', err);
        }
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Handle Chronic Condition Toggle with 'None' mutual exclusivity
  const handleToggleCondition = (conditionId: string) => {
    if (conditionId === 'None') {
      if (chronicConditions.includes('None')) {
        setChronicConditions([]);
      } else {
        setChronicConditions(['None']);
      }
    } else {
      let updated = chronicConditions.filter((c) => c !== 'None');
      if (updated.includes(conditionId)) {
        updated = updated.filter((c) => c !== conditionId);
      } else {
        updated.push(conditionId);
      }
      setChronicConditions(updated);
    }
  };

  // Add Allergy Preset Chip
  const handleAddAllergyChip = (chip: string) => {
    if (chip === 'No Known Allergies') {
      setKnownAllergies('None');
      return;
    }
    if (!knownAllergies || knownAllergies.toLowerCase() === 'none') {
      setKnownAllergies(chip);
    } else if (!knownAllergies.toLowerCase().includes(chip.toLowerCase())) {
      setKnownAllergies(`${knownAllergies}, ${chip}`);
    }
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!firebaseUser) {
      setFormError('Please sign in first to submit your medical profile.');
      return;
    }

    if (!bloodGroup) {
      setFormError('Please select your Blood Group.');
      return;
    }

    if (chronicConditions.length === 0) {
      setFormError('Please select at least one option under Chronic Conditions (or choose "None").');
      return;
    }

    setIsSubmitting(true);

    try {
      const allergyArray = knownAllergies
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && s.toLowerCase() !== 'none');

      const updatedPayload = {
        bloodGroup,
        bloodType: bloodGroup,
        knownAllergies: knownAllergies.trim() || 'None Reported',
        allergies: allergyArray,
        chronicConditions,
        currentMedications: currentMedications.trim() || 'None Reported',
        hasCompletedOnboarding: true,
        onboardingCompletedAt: new Date().toISOString(),
      };

      // 1. Update Firestore User Document
      const userRef = doc(db, 'users', firebaseUser.uid);
      await updateDoc(userRef, updatedPayload);

      // 2. Update Telehealth Context state if present
      if (currentUser && setAuthenticatedProfile) {
        setAuthenticatedProfile({
          ...currentUser,
          ...updatedPayload,
          role: currentUser.role || 'Patient',
        });
      }

      // 3. Automatically redirect to patient dashboard
      router.push('/patient/dashboard');
    } catch (err: any) {
      console.error('Failed to submit onboarding medical history:', err);
      setFormError(err.message || 'Failed to save medical records. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 space-y-4">
        <RefreshCw className="w-8 h-8 text-teal-400 animate-spin" />
        <p className="text-xs text-slate-400 font-mono">Loading patient intake portal...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 text-slate-100 flex flex-col py-8 px-4 sm:px-6 lg:px-8">
      {/* Brand Header */}
      <div className="max-w-2xl w-full mx-auto flex items-center justify-between mb-6">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-10 h-10 rounded-2xl bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-teal-400 shadow-md group-hover:scale-105 transition-transform">
            <HeartPulse className="w-5 h-5 text-teal-400 animate-pulse" />
          </div>
          <div>
            <span className="font-black text-lg tracking-tight text-white">
              Cura<span className="text-teal-400">Link</span>
            </span>
            <span className="text-[10px] block font-mono text-slate-400">Clinical Telehealth Network</span>
          </div>
        </Link>

        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 text-[11px] font-mono">
          <Lock className="w-3.5 h-3.5 text-teal-400" />
          <span>HIPAA Encrypted Intake</span>
        </div>
      </div>

      {/* Main Card */}
      <div className="max-w-2xl w-full mx-auto bg-slate-900/90 border border-slate-800 rounded-3xl shadow-2xl backdrop-blur-xl overflow-hidden">
        {/* Banner */}
        <div className="bg-gradient-to-r from-teal-800/80 via-teal-900/80 to-slate-900 p-6 sm:p-8 border-b border-teal-500/20 relative">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-teal-400/20 text-teal-300 border border-teal-400/30">
              Mandatory Patient Intake
            </span>
            <span className="text-xs text-slate-300 font-mono flex items-center gap-1">
              <FileCheck className="w-3.5 h-3.5 text-teal-400" />
              Step 1 of 1
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Medical History Onboarding
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
            Welcome to CuraLink! To ensure safe telemedicine consultations, personalized IoT telemetry baseline tracking, and safe electronic prescriptions, please provide your baseline medical history below.
          </p>

          {isAlreadyOnboarded && (
            <div className="mt-4 p-3 bg-emerald-500/15 border border-emerald-500/40 rounded-2xl flex items-center justify-between text-xs text-emerald-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>You have previously completed onboarding. Updating below will update your clinical chart.</span>
              </div>
              <Link
                href="/patient/dashboard"
                className="underline font-bold hover:text-white ml-2 shrink-0"
              >
                Go to Dashboard
              </Link>
            </div>
          )}
        </div>

        {/* Error Alert */}
        {formError && (
          <div className="m-6 p-4 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-7">
          {/* 1. Blood Group */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Droplet className="w-4 h-4 text-rose-400" />
              <span>Blood Group / Type <span className="text-rose-400">*</span></span>
            </label>
            <p className="text-[11px] text-slate-400">
              Essential for surgical triage, emergency transfusions, and clinical compatibility.
            </p>
            <div className="relative">
              <select
                value={bloodGroup}
                onChange={(e) => setBloodGroup(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-2xl px-4 py-3 text-xs sm:text-sm text-white focus:outline-none focus:border-teal-500 transition-colors appearance-none cursor-pointer"
                required
              >
                <option value="" disabled className="text-slate-500">
                  Select your blood group...
                </option>
                {BLOOD_GROUPS.map((bg) => (
                  <option key={bg} value={bg} className="bg-slate-900 text-white">
                    {bg}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                ▼
              </div>
            </div>
          </div>

          {/* 2. Known Allergies */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <span>Known Allergies (Medications, Food, Environmental)</span>
            </label>
            <p className="text-[11px] text-slate-400">
              Critical for your doctor to avoid prescribing contraindicated pharmaceutical compounds.
            </p>
            <input
              type="text"
              value={knownAllergies}
              onChange={(e) => setKnownAllergies(e.target.value)}
              placeholder="e.g., Penicillin, Peanuts, Sulfa drugs, Latex (or type 'None')"
              className="w-full bg-slate-950 border border-slate-700/80 rounded-2xl px-4 py-3 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 transition-colors"
            />
            {/* Quick chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] text-slate-500">Quick insert:</span>
              {allergyPresets.map((preset) => (
                <button
                  type="button"
                  key={preset}
                  onClick={() => handleAddAllergyChip(preset)}
                  className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  + {preset}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Chronic Conditions Checkboxes */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Activity className="w-4 h-4 text-teal-400" />
                <span>Chronic Conditions <span className="text-rose-400">*</span></span>
              </label>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Check all that apply. If you have no diagnosed chronic conditions, select &quot;None&quot;.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {CHRONIC_CONDITION_OPTIONS.map((item) => {
                const isChecked = chronicConditions.includes(item.id);

                return (
                  <div
                    key={item.id}
                    onClick={() => handleToggleCondition(item.id)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer select-none flex items-start gap-3 ${
                      isChecked
                        ? item.id === 'None'
                          ? 'bg-emerald-500/10 border-emerald-500/50 shadow-sm'
                          : 'bg-teal-500/10 border-teal-500/50 shadow-sm'
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleCondition(item.id)}
                      className="mt-0.5 rounded border-slate-700 text-teal-500 focus:ring-teal-500 cursor-pointer"
                    />
                    <div>
                      <p className={`text-xs font-bold ${isChecked ? 'text-white' : 'text-slate-300'}`}>
                        {item.label}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4. Current Medications */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Pill className="w-4 h-4 text-teal-400" />
              <span>Current Medications & Dosages</span>
            </label>
            <p className="text-[11px] text-slate-400">
              List any active prescriptions, vitamins, or supplements currently taken.
            </p>
            <textarea
              rows={3}
              value={currentMedications}
              onChange={(e) => setCurrentMedications(e.target.value)}
              placeholder="e.g., Metformin 500mg (twice daily with meals), Lisinopril 10mg (morning). If none, type 'None'."
              className="w-full bg-slate-950 border border-slate-700/80 rounded-2xl px-4 py-3 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 transition-colors resize-none"
            />
          </div>

          {/* Privacy Note */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
            <div>
              Your medical intake data is securely stored within your private patient document. It is accessible solely to authorized licensed medical practitioners attending your telehealth visits and assigned clinical care team.
            </div>
          </div>

          {/* Save & Continue Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-teal-600 via-teal-500 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 active:scale-[0.99] text-white font-bold text-sm shadow-xl shadow-teal-900/40 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border border-teal-400/30"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Saving Clinical History...</span>
                </>
              ) : (
                <>
                  <span>Save & Continue to Patient Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Footer Info */}
      <div className="max-w-2xl w-full mx-auto text-center text-[11px] text-slate-500 mt-6">
        CuraLink Biomedical Telehealth • Patient Confidentiality Standard (HIPAA Security Rule 45 CFR Part 160)
      </div>
    </div>
  );
}
