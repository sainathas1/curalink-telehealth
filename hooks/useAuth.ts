'use client';

import { useState, useEffect } from 'react';
import { UserProfile, UserRole } from '../lib/types';
import { MOCK_PATIENT_USER, MOCK_DOCTOR_USER } from '../lib/mock-data';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged, signOut as firebaseSignOut, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

export function useAuth() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(MOCK_PATIENT_USER);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [role, setRole] = useState<UserRole>('Patient');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Sync with Firebase Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        setIsLoading(true);
        try {
          const userDoc = await getDoc(doc(db, 'users', fbUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data() as UserProfile;
            setCurrentUser(data);
            setRole(data.role || 'Patient');
          } else {
            // Default profile from Firebase Auth metadata
            const fallback: UserProfile = {
              uid: fbUser.uid,
              fullName: fbUser.displayName || 'Telehealth User',
              email: fbUser.email || 'user@curalink.health',
              phoneNumber: fbUser.phoneNumber || undefined,
              role: 'Patient',
            };
            setCurrentUser(fallback);
            setRole('Patient');
          }
        } catch {
          // If Firestore is offline or restricted, fallback safely
          setCurrentUser({
            uid: fbUser.uid,
            fullName: fbUser.displayName || 'Telehealth User',
            email: fbUser.email || 'user@curalink.health',
            role: 'Patient',
          });
        } finally {
          setIsLoading(false);
        }
      }
    });

    return () => unsub();
  }, []);

  // Quick Role / Persona Switcher for demonstration
  const switchToPatientDemo = () => {
    setCurrentUser(MOCK_PATIENT_USER);
    setRole('Patient');
  };

  const switchToDoctorDemo = () => {
    setCurrentUser(MOCK_DOCTOR_USER);
    setRole('Doctor');
  };

  const toggleRole = () => {
    if (role === 'Patient') {
      switchToDoctorDemo();
    } else {
      switchToPatientDemo();
    }
  };

  const handleLogout = async () => {
    try {
      await firebaseSignOut(auth);
    } catch {
      // Ignore
    }
    setCurrentUser(null);
  };

  const setAuthenticatedProfile = (profile: UserProfile) => {
    setCurrentUser(profile);
    setRole(profile.role);
  };

  return {
    currentUser,
    firebaseUser,
    role,
    setRole,
    isLoading,
    switchToPatientDemo,
    switchToDoctorDemo,
    toggleRole,
    handleLogout,
    setAuthenticatedProfile,
    isAuthenticated: !!currentUser,
  };
}
