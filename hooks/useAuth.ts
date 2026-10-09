'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import type { UserProfile, UserRole } from '../lib/types';

export function useAuth() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    let identity = '';
    let stopProfile: (() => void) | undefined;
    const stopAuth = onAuthStateChanged(auth, account => {
      if (!active) return;
      stopProfile?.(); identity = account?.uid || '';
      setFirebaseUser(account); setCurrentUser(null); setAuthError(null);
      if (!account) { setIsLoading(false); return; }
      setIsLoading(true);
      const uid = account.uid;
      stopProfile = onSnapshot(doc(db, 'users', uid), snapshot => {
        if (!active || identity !== uid) return;
        if (!snapshot.exists()) {
          setCurrentUser(null);
          setAuthError('Your account needs a care profile. Complete account setup from the sign-in page.');
        } else {
          const data = snapshot.data();
          const role = String(data.role || '').toLowerCase();
          if (role !== 'doctor' && role !== 'patient') {
            setCurrentUser(null); setAuthError('Your account role could not be confirmed. Contact your administrator.');
          } else {
            setCurrentUser({ ...data, uid, email: account.email || '', fullName: data.fullName || account.displayName || 'CuraLink user', role } as UserProfile);
            setAuthError(null);
          }
        }
        setIsLoading(false);
      }, () => {
        if (!active || identity !== uid) return;
        setCurrentUser(null); setAuthError('We could not load your care profile. Check your connection and try again.'); setIsLoading(false);
      });
    }, () => { if (active) { setCurrentUser(null); setAuthError('We could not check your session. Please try again.'); setIsLoading(false); } });
    return () => { active = false; identity = ''; stopProfile?.(); stopAuth(); };
  }, [revision]);
  const handleLogout = async () => { await signOut(auth); setCurrentUser(null); setAuthError(null); };
  const setAuthenticatedProfile = (profile: UserProfile) => {
    if (auth.currentUser?.uid !== profile.uid) return;
    setCurrentUser({ ...profile, uid: auth.currentUser.uid }); setAuthError(null); setIsLoading(false);
  };
  return {
    currentUser, firebaseUser, isLoading, authError, retryAuth: () => setRevision(value => value + 1),
    role: (currentUser?.role || 'Patient') as UserRole,
    // Kept for source compatibility; a local role switch cannot grant portal access.
    setRole: (_role: UserRole) => {}, toggleRole: () => {},
    handleLogout, setAuthenticatedProfile, isAuthenticated: Boolean(currentUser),
  };
}
