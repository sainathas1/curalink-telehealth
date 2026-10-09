'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  User,
  Stethoscope,
  Award,
  IndianRupee,
  Phone,
  Mail,
  FileText,
  Save,
  CheckCircle2,
  AlertCircle,
  Edit3,
  X,
  RefreshCw,
  ShieldCheck,
  Calendar,
  Clock,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';
import { useTelehealth } from '../../../context/TelehealthContext';
import { db } from '../../../lib/firebase';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';

const MEDICAL_SPECIALTIES = [
  'General Medicine',
  'Cardiology',
  'Neurology',
  'Pediatrics',
  'Dermatology',
  'Orthopedics',
  'Pulmonology',
  'Psychiatry',
  'Endocrinology',
  'Gynecology & Obstetrics',
  'ENT (Otolaryngology)',
  'Oncology',
  'Emergency Medicine',
];

export default function DoctorProfilePage() {
  const { currentUser, setAuthenticatedProfile } = useTelehealth();

  const [profileData, setProfileData] = useState<any>(currentUser || {});
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Editable fields
  const [fullName, setFullName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [qualifications, setQualifications] = useState('');
  const [consultationFee, setConsultationFee] = useState<number | string>(500);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [bio, setBio] = useState('');

  // Synchronize Firestore user/doctor document in real time
  useEffect(() => {
    if (!currentUser?.uid) return;

    const userDocRef = doc(db, 'users', currentUser.uid);
    const unsubUser = onSnapshot(
      userDocRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setProfileData((prev: any) => ({ ...prev, ...data }));
        }
      },
      (err) => console.warn('Doctor profile sync notice:', err)
    );

    const docRef = doc(db, 'doctors', currentUser.uid);
    const unsubDoc = onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setProfileData((prev: any) => ({ ...prev, ...data }));
        }
      },
      () => {}
    );

    return () => {
      unsubUser();
      unsubDoc();
    };
  }, [currentUser?.uid]);

  // Sync state when entering edit mode or profile data updates
  useEffect(() => {
    const current = profileData || currentUser || {};
    setFullName(current.fullName || currentUser?.fullName || '');
    setSpecialty(current.specialty || currentUser?.specialty || 'General Medicine');
    setQualifications(current.qualifications || currentUser?.qualifications || 'MBBS');
    setConsultationFee(
      typeof current.consultationFee === 'number'
        ? current.consultationFee
        : typeof current.fee === 'number'
        ? current.fee
        : 500
    );
    setPhoneNumber(current.phoneNumber || current.phone || currentUser?.phoneNumber || '');
    setBio(current.bio || currentUser?.bio || '');
  }, [profileData, currentUser, isEditing]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.uid) {
      setSaveError('You must be signed in as a clinician to update this profile.');
      return;
    }

    const cleanName = fullName.trim();
    if (!cleanName) {
      setSaveError('Doctor Full Name is required.');
      return;
    }

    const numericFee = Math.max(0, parseInt(String(consultationFee).trim(), 10) || 0);

    setIsSaving(true);
    setSaveError(null);

    const updatePayload = {
      fullName: cleanName,
      name: cleanName,
      specialty: specialty.trim() || 'General Medicine',
      qualifications: qualifications.trim(),
      consultationFee: numericFee,
      fee: numericFee,
      phone: phoneNumber.trim(),
      phoneNumber: phoneNumber.trim(),
      bio: bio.trim(),
      updatedAt: serverTimestamp(),
    };

    try {
      // Persist edits to Firestore under both users/{doctorId} and doctors/{doctorId}
      await Promise.all([
        setDoc(doc(db, 'users', currentUser.uid), updatePayload, { merge: true }),
        setDoc(doc(db, 'doctors', currentUser.uid), updatePayload, { merge: true }),
      ]);

      if (setAuthenticatedProfile) {
        setAuthenticatedProfile({
          ...currentUser,
          ...updatePayload,
          role: 'Doctor',
        });
      }

      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        setIsEditing(false);
      }, 1200);
    } catch (err: any) {
      console.error('Failed to update doctor profile:', err);
      setSaveError(err.message || 'Unable to update profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const doctorName = profileData.fullName || currentUser?.fullName || 'Dr. Clinician';
  const doctorSpecialty = profileData.specialty || currentUser?.specialty || 'General Medicine';
  const doctorQualifications = profileData.qualifications || currentUser?.qualifications || 'MBBS';
  const doctorFee =
    typeof profileData.consultationFee === 'number'
      ? profileData.consultationFee
      : typeof profileData.fee === 'number'
      ? profileData.fee
      : 500;
  const doctorPhone = profileData.phoneNumber || profileData.phone || currentUser?.phoneNumber || 'Not provided';
  const doctorEmail = profileData.email || currentUser?.email || 'doctor@curalink.health';
  const doctorBio = profileData.bio || currentUser?.bio || 'Certified specialist providing personalized teleconsultations and inpatient telemetry monitoring.';
  const doctorLicense = profileData.licenseNumber || currentUser?.licenseNumber || 'Verified Medical Practitioner';

  return (
    <div className="mx-auto max-w-4xl space-y-6 animate-fade-in-up pb-12">
      {/* Top Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/doctor/dashboard"
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-teal-700"
            >
              <ArrowLeft size={13} aria-hidden="true" />
              <span>Back to Dashboard</span>
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Clinician Profile
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Manage your public doctor credentials, specialty, consultation fee, and clinical biography.
          </p>
        </div>

        {!isEditing && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="care-button self-start sm:self-auto text-xs transition-all active:scale-[0.98]"
          >
            <Edit3 size={15} aria-hidden="true" />
            <span>Edit Profile</span>
          </button>
        )}
      </div>

      {saveSuccess && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800 animate-scale-in">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" aria-hidden="true" />
          <span>Doctor profile and consultation settings successfully updated in Firestore!</span>
        </div>
      )}

      {saveError && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800 animate-scale-in">
          <AlertCircle size={16} className="text-rose-600 shrink-0" aria-hidden="true" />
          <span>{saveError}</span>
        </div>
      )}

      {/* Main Profile Presentation Card */}
      <section className="care-card overflow-hidden">
        <div className="relative bg-gradient-to-r from-teal-900 via-slate-900 to-teal-950 p-6 sm:p-8 text-white">
          <div className="absolute top-0 right-0 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
            <div className="flex items-start sm:items-center gap-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-teal-500/20 border border-teal-400/30 text-2xl font-bold text-white shadow-inner">
                {doctorName
                  .split(' ')
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((n: string) => n[0])
                  .join('')
                  .toUpperCase()}
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-bold">{doctorName}</h2>
                  <span className="inline-flex items-center gap-1 rounded-full bg-teal-400/20 px-2.5 py-0.5 text-[11px] font-semibold text-teal-300 border border-teal-400/30">
                    <ShieldCheck size={12} aria-hidden="true" />
                    Verified Clinician
                  </span>
                </div>
                <p className="mt-1 text-sm font-medium text-teal-200">{doctorSpecialty}</p>
                <p className="mt-0.5 text-xs text-slate-300 flex items-center gap-1">
                  <Award size={13} className="text-teal-400" aria-hidden="true" />
                  {doctorQualifications}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md text-left sm:text-right shrink-0">
              <span className="text-[11px] uppercase tracking-wider text-teal-300 block font-semibold">
                Consultation Fee
              </span>
              <p className="mt-1 text-2xl font-extrabold text-white flex items-center sm:justify-end gap-1">
                <span>₹</span>
                <span>{doctorFee}</span>
                <span className="text-xs font-normal text-slate-300">/ session</span>
              </p>
            </div>
          </div>
        </div>

        {/* Profile Details or Edit Form */}
        {!isEditing ? (
          <div className="p-6 sm:p-8 space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Contact Information
                </span>
                <div className="space-y-1.5 text-xs text-slate-700">
                  <p className="flex items-center gap-2">
                    <Mail size={14} className="text-teal-600 shrink-0" aria-hidden="true" />
                    <span>{doctorEmail}</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <Phone size={14} className="text-teal-600 shrink-0" aria-hidden="true" />
                    <span>{doctorPhone}</span>
                  </p>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Medical Registration & License
                </span>
                <div className="space-y-1 text-xs text-slate-700">
                  <p className="font-semibold text-slate-900">{doctorLicense}</p>
                  <p className="text-[11px] text-slate-500">Authorized teleconsultation practitioner on CuraLink Network</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Clinical Bio & Background
              </h3>
              <p className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-xs leading-relaxed text-slate-700 whitespace-pre-line">
                {doctorBio}
              </p>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100">
              <span className="text-[11px] text-slate-400">
                Synced in real-time with Firestore (<code className="text-teal-700">users</code> & <code className="text-teal-700">doctors</code> collections)
              </span>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-2 text-xs font-semibold text-teal-800 transition hover:bg-teal-100 focus-visible:outline-2 focus-visible:outline-teal-700"
              >
                Update Profile Details
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSave} className="p-6 sm:p-8 space-y-5 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Edit Clinician Credentials & Profile</h3>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Cancel editing"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Dr. Jane Smith"
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-slate-800 focus:border-teal-500 focus:outline-none bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                  Medical Specialty <span className="text-rose-500">*</span>
                </label>
                <select
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-slate-800 focus:border-teal-500 focus:outline-none bg-white"
                >
                  {MEDICAL_SPECIALTIES.map((spec) => (
                    <option key={spec} value={spec}>
                      {spec}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                  Qualifications & Degrees <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={qualifications}
                  onChange={(e) => setQualifications(e.target.value)}
                  placeholder="e.g. MBBS, MD (General Medicine), FRCS"
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-slate-800 focus:border-teal-500 focus:outline-none bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                  Consultation Fee (₹ INR) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 font-bold">
                    ₹
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    required
                    value={consultationFee}
                    onChange={(e) => setConsultationFee(e.target.value)}
                    placeholder="500"
                    className="w-full rounded-xl border border-slate-300 p-2.5 pl-7 text-slate-800 focus:border-teal-500 focus:outline-none bg-white"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                Contact Phone Number
              </label>
              <input
                type="text"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full rounded-xl border border-slate-300 p-2.5 text-slate-800 focus:border-teal-500 focus:outline-none bg-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                Clinical Biography & Specialty Summary
              </label>
              <textarea
                rows={4}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Share your years of clinical experience, areas of interest, hospital affiliations, and approach to patient care..."
                className="w-full rounded-xl border border-slate-300 p-2.5 text-slate-800 focus:border-teal-500 focus:outline-none bg-white"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="rounded-xl px-4 py-2 font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="care-button font-bold text-xs"
              >
                {isSaving ? (
                  <>
                    <RefreshCw size={15} className="motion-safe:animate-spin" aria-hidden="true" />
                    <span>Saving to Firestore…</span>
                  </>
                ) : (
                  <>
                    <Save size={15} aria-hidden="true" />
                    <span>Save Clinician Profile</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
