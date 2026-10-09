import { doc, runTransaction } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';

const AUTHORIZED_ADMIN_EMAIL = 'sainathas8788@gmail.com';

export interface PatientAssignmentChange {
  adminUid: string;
  patientId: string;
  doctorId: string | null;
  expectedAssignedDoctorId: string | null;
}

function requireAdmin(adminUid: string) {
  const current = auth.currentUser;
  if (!current || current.uid !== adminUid || current.email?.trim().toLowerCase() !== AUTHORIZED_ADMIN_EMAIL) {
    throw new Error('Your administrator session changed. Sign in again before assigning a clinician.');
  }
}

function assignmentId(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export async function savePatientAssignment(change: PatientAssignmentChange): Promise<void> {
  requireAdmin(change.adminUid);
  if (!change.patientId || change.patientId.includes('/') || (change.doctorId && change.doctorId.includes('/'))) {
    throw new Error('The patient or clinician account could not be confirmed.');
  }

  await runTransaction(db, async (transaction) => {
    requireAdmin(change.adminUid);
    const patientRef = doc(db, 'users', change.patientId);
    const patient = await transaction.get(patientRef);
    if (!patient.exists() || String(patient.data().role || '').toLowerCase() !== 'patient') {
      throw new Error('This patient account is no longer available for assignment.');
    }
    if (assignmentId(patient.data().assignedDoctorId) !== assignmentId(change.expectedAssignedDoctorId)) {
      throw new Error('This assignment changed while you were reviewing it. Check the current clinician and try again.');
    }

    if (change.doctorId) {
      const doctor = await transaction.get(doc(db, 'users', change.doctorId));
      if (!doctor.exists() || String(doctor.data().role || '').toLowerCase() !== 'doctor' || doctor.data().isVerified !== true) {
        throw new Error('Choose a currently verified clinician. This clinician is no longer available for assignment.');
      }
    }
    requireAdmin(change.adminUid);
    transaction.update(patientRef, { assignedDoctorId: change.doctorId || null });
  });
}
