import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';

export const firebaseConfig = {
  apiKey: "AIzaSyBW5RmoqsIcHqU5sOCiboPXeeAzoTnyymg",
  authDomain: "curalink-telehealth.firebaseapp.com",
  databaseURL: "https://curalink-telehealth-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "curalink-telehealth",
  storageBucket: "curalink-telehealth.firebasestorage.app",
  messagingSenderId: "173041146452",
  appId: "1:173041146452:web:119bf5252b45ad2743abc1",
  measurementId: "G-S1YHNP4BLF"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);
export const rtdb = getDatabase(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase connection test notice: Client offline or unreachable.');
    }
  }
}
