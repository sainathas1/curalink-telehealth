'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export default function PatientIndexPage() {
  const router = useRouter();

  useEffect(() => {
    const checkAndRedirect = async () => {
      const user = auth.currentUser;
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            if (data.role === 'Patient' && data.hasCompletedOnboarding === false) {
              router.replace('/onboarding');
              return;
            }
          }
        } catch {}
      }
      router.replace('/patient/dashboard');
    };

    checkAndRedirect();
  }, [router]);

  return null;
}
