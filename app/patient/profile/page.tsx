'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTelehealth } from '../../../context/TelehealthContext';
import { db } from '../../../lib/firebase';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import {
  User,
  ShieldCheck,
  Phone,
  Mail,
  Heart,
  Activity,
  AlertTriangle,
  LogOut,
  ChevronRight,
  Settings,
  Bell,
  Volume2,
  VolumeX,
  Thermometer,
  Usb,
  FileText,
  Pill,
  Sparkles,
  Smartphone,
  CheckCircle2,
  Calendar,
  Edit3,
  X,
  Save,
  Droplet,
  RefreshCw,
} from 'lucide-react';

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
  { id: 'Diabetes', label: 'Diabetes (Type 1 or Type 2)' },
  { id: 'Hypertension', label: 'Hypertension (High Blood Pressure)' },
  { id: 'Asthma', label: 'Asthma (Respiratory Condition)' },
  { id: 'None', label: 'None' },
];

export default function PatientProfileRoute() {
  const router = useRouter();
  const {
    currentUser,
    setAuthenticatedProfile,
    telemetry,
    temperatureUnit,
    toggleTemperatureUnit,
    audioAlertsEnabled,
    setAudioAlertsEnabled,
    openEmergencySOS,
    handleLogout,
  } = useTelehealth();

  // Real-time Firestore Profile State
  const [profileData, setProfileData] = useState<any>(currentUser || {});
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Form edit states
  const [editFullName, setEditFullName] = useState('');
  const [editPhoneNumber, setEditPhoneNumber] = useState('');
  const [editEmergencyContact, setEditEmergencyContact] = useState('');
  const [editBloodGroup, setEditBloodGroup] = useState('');
  const [editKnownAllergies, setEditKnownAllergies] = useState('');
  const [editChronicConditions, setEditChronicConditions] = useState<string[]>([]);
  const [editCurrentMedications, setEditCurrentMedications] = useState('');

  // Real-time onSnapshot synchronization for patient profile
  useEffect(() => {
    if (!currentUser?.uid) return;

    const userDocRef = doc(db, 'users', currentUser.uid);
    const unsubscribe = onSnapshot(
      userDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setProfileData(data);
        }
      },
      (err) => console.warn('Real-time patient profile onSnapshot notice:', err)
    );

    return () => unsubscribe();
  }, [currentUser?.uid]);

  // Sync edit modal fields when opening
  useEffect(() => {
    if (isEditModalOpen) {
      setEditFullName(profileData.fullName || currentUser?.fullName || '');
      setEditPhoneNumber(profileData.phoneNumber || currentUser?.phoneNumber || '');
      setEditEmergencyContact(profileData.emergencyContact || currentUser?.emergencyContact || '');
      setEditBloodGroup(profileData.bloodGroup || profileData.bloodType || currentUser?.bloodGroup || '');
      setEditKnownAllergies(
        profileData.knownAllergies ||
        (Array.isArray(profileData.allergies) ? profileData.allergies.join(', ') : '') ||
        currentUser?.knownAllergies ||
        ''
      );
      setEditChronicConditions(
        Array.isArray(profileData.chronicConditions)
          ? profileData.chronicConditions
          : Array.isArray(currentUser?.chronicConditions)
          ? currentUser.chronicConditions
          : []
      );
      setEditCurrentMedications(profileData.currentMedications || currentUser?.currentMedications || '');
      setSaveError(null);
    }
  }, [isEditModalOpen, profileData, currentUser]);

  const handleToggleChronicCondition = (conditionId: string) => {
    if (conditionId === 'None') {
      if (editChronicConditions.includes('None')) {
        setEditChronicConditions([]);
      } else {
        setEditChronicConditions(['None']);
      }
    } else {
      let updated = editChronicConditions.filter((c) => c !== 'None');
      if (updated.includes(conditionId)) {
        updated = updated.filter((c) => c !== conditionId);
      } else {
        updated.push(conditionId);
      }
      setEditChronicConditions(updated);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.uid) {
      setSaveError('You must be signed in to update your profile.');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const allergyArray = editKnownAllergies
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && s.toLowerCase() !== 'none');

      const updatedPayload = {
        fullName: editFullName.trim() || profileData.fullName || 'Patient',
        phoneNumber: editPhoneNumber.trim(),
        emergencyContact: editEmergencyContact.trim(),
        bloodGroup: editBloodGroup.trim(),
        bloodType: editBloodGroup.trim(),
        knownAllergies: editKnownAllergies.trim() || 'None Reported',
        allergies: allergyArray,
        chronicConditions: editChronicConditions.length > 0 ? editChronicConditions : ['None'],
        currentMedications: editCurrentMedications.trim() || 'None Reported',
        updatedAt: serverTimestamp(),
      };

      // Strict requirement: execute setDoc(doc(db, 'users', currentUser.uid), { ...data }, { merge: true })
      await setDoc(doc(db, 'users', currentUser.uid), updatedPayload, { merge: true });

      if (setAuthenticatedProfile) {
        setAuthenticatedProfile({
          ...currentUser,
          ...updatedPayload,
          role: currentUser.role || 'Patient',
        });
      }

      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        setIsEditModalOpen(false);
      }, 1000);
    } catch (err: any) {
      console.error('Error updating patient profile:', err);
      setSaveError(err.message || 'Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  // Resolved dynamic fields from Firestore with clean graceful fallbacks
  const patientName = profileData.fullName || currentUser?.fullName || 'Patient';
  const patientEmail = profileData.email || currentUser?.email || 'patient@curalink.health';
  const patientPhone = profileData.phoneNumber || currentUser?.phoneNumber || 'No phone number provided';
  const patientEmergency = profileData.emergencyContact || currentUser?.emergencyContact || 'No emergency contact provided';
  const bloodGroup = profileData.bloodGroup || profileData.bloodType || currentUser?.bloodGroup || 'Not specified';
  const rawAllergies = profileData.knownAllergies || (profileData.allergies?.length ? profileData.allergies.join(', ') : '') || currentUser?.knownAllergies || 'No known allergies';
  const allergies = rawAllergies.trim().length > 0 ? rawAllergies : 'No known allergies';
  const chronicConditions = Array.isArray(profileData.chronicConditions) && profileData.chronicConditions.length > 0
    ? profileData.chronicConditions
    : Array.isArray(currentUser?.chronicConditions) && currentUser.chronicConditions.length > 0
    ? currentUser.chronicConditions
    : ['None reported'];
  const currentMedications = profileData.currentMedications || currentUser?.currentMedications || 'None reported';

  return (
    <div className="space-y-5 max-w-2xl mx-auto pb-6">
      {/* Material 3 Top Profile Header Card */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-teal-950 text-white rounded-3xl p-6 shadow-md border border-slate-700/60 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Avatar with M3 rounded pill badge */}
            <div className="relative shrink-0">
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-teal-500 to-emerald-400 p-0.5 shadow-md">
                <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center text-white font-bold text-xl">
                  {patientName.charAt(0)}
                </div>
              </div>
              <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-emerald-500 border-2 border-slate-900" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white truncate">{patientName}</h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-400/30 shrink-0">
                  Patient Portal
                </span>
              </div>
              <p className="text-xs text-slate-300 truncate mt-0.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                <span>{patientEmail}</span>
              </p>
              <p className="text-xs text-slate-300 truncate mt-0.5 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                <span>{patientPhone}</span>
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsEditModalOpen(true)}
            className="self-start sm:self-auto px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-md shadow-teal-900/40 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit Medical Profile</span>
          </button>
        </div>

        {/* Live Telemetry Health Strip */}
        <div className="mt-5 pt-4 border-t border-slate-700/60 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                telemetry.status === 'critical'
                  ? 'bg-rose-500 animate-ping'
                  : telemetry.status === 'elevated'
                  ? 'bg-amber-500'
                  : 'bg-emerald-500 animate-pulse'
              }`}
            />
            <span className="font-medium">Wearable Biosensor:</span>
            <span className="font-bold text-white font-mono">
              {telemetry.heartRate > 0 ? `${telemetry.heartRate} BPM | ${telemetry.spo2}%` : 'Standby'}
            </span>
          </div>

          <span className="text-[11px] font-bold text-teal-300 bg-teal-900/50 px-2 py-0.5 rounded-full border border-teal-700/50">
            HIPAA Verified
          </span>
        </div>
      </div>

      {/* Emergency Contact & Quick Triage Card */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Emergency & Triage Contact</h2>
              <p className="text-[11px] text-slate-500">Immediate hospital & doctor escalation</p>
            </div>
          </div>
          <button
            onClick={openEmergencySOS}
            className="px-3.5 py-1.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm transition-all m3-pressable flex items-center gap-1.5 cursor-pointer"
          >
            <span>Trigger SOS</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Attending Clinician Team</span>
            <span className="font-bold text-slate-800 text-xs">CuraLink Telehealth Network</span>
            <span className="text-[11px] text-teal-700 block">24/7 Clinical Directorate</span>
          </div>
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Emergency Contact</span>
            <span className="font-bold text-slate-800 text-xs">{patientEmergency}</span>
            <span className="text-[11px] text-slate-500 block font-mono">On file in EHR</span>
          </div>
        </div>
      </div>

      {/* Health Profile Metrics Card - Real Firestore Data */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Clinical Health Profile</h2>
              <p className="text-[11px] text-slate-500">Real-time medical intake data synced from Firestore</p>
            </div>
          </div>

          <button
            onClick={() => setIsEditModalOpen(true)}
            disabled={!currentUser?.uid}
            title={!currentUser?.uid ? 'Sign in to update profile' : 'Edit health profile'}
            className="text-xs font-semibold text-teal-600 hover:text-teal-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
          >
            <span>Update Details</span>
            <Edit3 className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
          {/* Blood Group */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
            <span className="text-[10px] uppercase font-bold text-slate-400 block flex items-center gap-1">
              <Droplet className="w-3 h-3 text-rose-500" />
              Blood Group
            </span>
            <span className="text-sm font-black text-slate-900 mt-1 block font-mono">
              {bloodGroup}
            </span>
          </div>

          {/* Allergies */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 sm:col-span-2">
            <span className="text-[10px] uppercase font-bold text-slate-400 block flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-amber-500" />
              Known Allergies
            </span>
            <span className="text-xs font-bold text-slate-800 mt-1 block truncate">
              {allergies}
            </span>
          </div>
        </div>

        {/* Chronic Conditions & Medications */}
        <div className="space-y-2 pt-1 text-xs">
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 space-y-1.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Diagnosed Chronic Conditions</span>
            <div className="flex flex-wrap gap-1.5">
              {(Array.isArray(chronicConditions) ? chronicConditions : []).map((cond: string) => (
                <span
                  key={cond}
                  className={`px-2.5 py-0.5 rounded-lg text-xs font-semibold border ${
                    cond === 'None' || cond === 'None reported'
                      ? 'bg-slate-100 text-slate-600 border-slate-200'
                      : 'bg-teal-50 text-teal-800 border-teal-200'
                  }`}
                >
                  {cond}
                </span>
              ))}
            </div>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 block flex items-center gap-1">
              <Pill className="w-3 h-3 text-teal-600" />
              Current Medications
            </span>
            <p className="text-xs text-slate-800 font-medium">
              {currentMedications}
            </p>
          </div>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1">
          Patient Records & Devices
        </h3>

        <div className="bg-white rounded-3xl border border-slate-200/80 divide-y divide-slate-100 shadow-xs overflow-hidden">
          <button
            onClick={() => router.push('/patient/device')}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors m3-pressable cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center">
                <Usb className="w-5 h-5" />
              </div>
              <div>
                <span className="text-sm font-bold text-slate-900 block">Connected Devices</span>
                <span className="text-xs text-slate-500">USB Serial Thermometer & Biosensor</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>

          <button
            onClick={() => router.push('/patient/prescriptions')}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors m3-pressable cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <Pill className="w-5 h-5" />
              </div>
              <div>
                <span className="text-sm font-bold text-slate-900 block">Prescriptions & Rx</span>
                <span className="text-xs text-slate-500">Digitally signed active medications</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>

          <button
            onClick={() => router.push('/patient/records')}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors m3-pressable cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <span className="text-sm font-bold text-slate-900 block">Medical Records</span>
                <span className="text-xs text-slate-500">Lab test diagnostics & PDF summaries</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>

          <button
            onClick={() => router.push('/patient/appointments')}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors m3-pressable cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <span className="text-sm font-bold text-slate-900 block">Consultation Visits</span>
                <span className="text-xs text-slate-500">HD video appointments & schedule</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>

      {/* App Preferences & Settings */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1">
          Preferences & Controls
        </h3>

        <div className="bg-white rounded-3xl border border-slate-200/80 divide-y divide-slate-100 shadow-xs overflow-hidden">
          {/* Temperature Unit */}
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center">
                <Thermometer className="w-4 h-4" />
              </div>
              <div>
                <span className="text-sm font-bold text-slate-900 block">Temperature Unit</span>
                <span className="text-xs text-slate-500">Currently {temperatureUnit === 'C' ? 'Celsius (°C)' : 'Fahrenheit (°F)'}</span>
              </div>
            </div>
            <button
              onClick={toggleTemperatureUnit}
              className="px-3.5 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all m3-pressable cursor-pointer"
            >
              Switch to {temperatureUnit === 'C' ? '°F' : '°C'}
            </button>
          </div>

          {/* Audio Alert Chimes */}
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center">
                {audioAlertsEnabled ? <Volume2 className="w-4 h-4 text-teal-600" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
              </div>
              <div>
                <span className="text-sm font-bold text-slate-900 block">Vital Alert Chimes</span>
                <span className="text-xs text-slate-500">Audible warnings on arrhythmia or fever</span>
              </div>
            </div>
            <button
              onClick={() => setAudioAlertsEnabled(!audioAlertsEnabled)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all m3-pressable cursor-pointer ${
                audioAlertsEnabled
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {audioAlertsEnabled ? 'Enabled' : 'Muted'}
            </button>
          </div>
        </div>
      </div>

      {/* Account Actions */}
      <div className="pt-2 space-y-3">
        <button
          onClick={handleLogout}
          className="w-full py-3 px-4 rounded-2xl border border-rose-200 text-rose-700 hover:bg-rose-50 font-bold text-xs transition-all m3-pressable flex items-center justify-center gap-2 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out of Patient Account</span>
        </button>
      </div>

      {/* Edit Medical Profile Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Edit3 className="w-5 h-5 text-teal-400" />
                <div>
                  <h3 className="text-sm font-bold">Update Medical Profile</h3>
                  <p className="text-[11px] text-teal-200/80">Direct Firestore Synchronization</p>
                </div>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {saveSuccess ? (
              <div className="p-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto animate-bounce">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="text-base font-bold text-slate-900">Profile Updated in Real-Time</h4>
                <p className="text-xs text-slate-500">
                  Your medical history, allergies, and personal details have been saved to Firestore.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSaveProfile} className="p-6 space-y-4 text-xs">
                {saveError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{saveError}</span>
                  </div>
                )}

                {/* Personal Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      value={editFullName}
                      onChange={(e) => setEditFullName(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 text-slate-800 focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      value={editPhoneNumber}
                      onChange={(e) => setEditPhoneNumber(e.target.value)}
                      placeholder="+1 (555) 000-0000"
                      className="w-full p-2.5 rounded-xl border border-slate-300 text-slate-800 focus:outline-none focus:border-teal-500"
                    />
                  </div>
                </div>

                {/* Emergency Contact & Blood Group */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Emergency Contact
                    </label>
                    <input
                      type="text"
                      value={editEmergencyContact}
                      onChange={(e) => setEditEmergencyContact(e.target.value)}
                      placeholder="Name, Relation & Phone"
                      className="w-full p-2.5 rounded-xl border border-slate-300 text-slate-800 focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Blood Group
                    </label>
                    <select
                      value={editBloodGroup}
                      onChange={(e) => setEditBloodGroup(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 text-slate-800 focus:outline-none focus:border-teal-500 bg-white"
                    >
                      <option value="">Select Blood Group...</option>
                      {BLOOD_GROUPS.map((bg) => (
                        <option key={bg} value={bg}>{bg}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Known Allergies */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Known Allergies (Medications, Foods, Environmental)
                  </label>
                  <input
                    type="text"
                    value={editKnownAllergies}
                    onChange={(e) => setEditKnownAllergies(e.target.value)}
                    placeholder="e.g. Penicillin, Peanuts, Sulfa (or 'None')"
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-slate-800 focus:outline-none focus:border-teal-500"
                  />
                </div>

                {/* Chronic Conditions */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1.5">
                    Chronic Conditions
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {CHRONIC_CONDITION_OPTIONS.map((opt) => {
                      const isChecked = editChronicConditions.includes(opt.id);
                      return (
                        <div
                          key={opt.id}
                          onClick={() => handleToggleChronicCondition(opt.id)}
                          className={`p-2 rounded-xl border text-xs cursor-pointer select-none flex items-center gap-2 ${
                            isChecked
                              ? 'bg-teal-50 border-teal-400 text-teal-900 font-bold'
                              : 'bg-slate-50 border-slate-200 text-slate-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleChronicCondition(opt.id)}
                            className="rounded border-slate-300 text-teal-600"
                          />
                          <span className="truncate">{opt.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Current Medications */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Current Medications & Dosages
                  </label>
                  <textarea
                    rows={2}
                    value={editCurrentMedications}
                    onChange={(e) => setEditCurrentMedications(e.target.value)}
                    placeholder="e.g. Metformin 500mg daily, Lisinopril 10mg (or 'None')"
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-slate-800 focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving || !currentUser?.uid}
                    className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold flex items-center gap-1.5 shadow-md shadow-teal-600/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>Save to Firestore</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
