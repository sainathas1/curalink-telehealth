export type UserRole = 'Patient' | 'Doctor';

export interface UserProfile {
  uid: string;
  fullName: string;
  email: string;
  phoneNumber?: string;
  role: UserRole;
  avatarUrl?: string;
  specialty?: string; // For doctors
  licenseNumber?: string; // For doctors
  dateOfBirth?: string; // For patients
  bloodType?: string; // For patients
  emergencyContact?: string; // For patients
  allergies?: string[];
  assignedDoctorId?: string;
}

export type VitalStatus = 'normal' | 'elevated' | 'critical';

export interface VitalMetric {
  value: number;
  unit: string;
  status: VitalStatus;
  minNormal: number;
  maxNormal: number;
  timestamp: string;
}

export interface LiveTelemetryPayload {
  deviceId: string;
  patientId: string;
  timestamp: number;
  heartRate: number; // BPM
  spo2: number; // %
  temperature: number; // °C
  systolic: number; // mmHg
  diastolic: number; // mmHg
  batteryLevel: number; // %
  sensorConnected: boolean;
  status: VitalStatus;
  alertMessage?: string;
}

export interface VitalHistoryPoint {
  time: string;
  heartRate: number;
  spo2: number;
  temperature: number;
  systolic: number;
  diastolic: number;
}

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  doctorSpecialty: string;
  doctorAvatar?: string;
  date: string;
  time: string;
  type: 'Video Call' | 'In-Person Consultation' | 'Routine Checkup';
  status: 'Upcoming' | 'In Progress' | 'Completed' | 'Cancelled';
  symptoms: string;
  meetingLink?: string;
  paymentStatus?: 'Paid' | 'Pending' | 'Waived';
  paymentAmount?: number;
  paymentTxnId?: string;
  paymentMethod?: string;
}

export interface Prescription {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  doctorLicense: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
  dateIssued: string;
  validUntil: string;
  refillsLeft: number;
  status: 'Active' | 'Completed' | 'Expired';
}

export interface MedicalRecord {
  id: string;
  patientId: string;
  date: string;
  type: 'Lab Report' | 'Clinical Summary' | 'Radiology' | 'Discharge Summary';
  title: string;
  doctorName: string;
  facility: string;
  fileSize: string;
  summary: string;
  downloadUrl?: string;
}

export interface PatientDirectoryItem {
  id: string;
  name: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  condition: string;
  status: 'Stable' | 'Monitored' | 'Critical';
  roomOrBed?: string;
  assignedDoctor: string;
  lastVisit: string;
  nextAppointment?: string;
  currentVitals: {
    heartRate: number;
    spo2: number;
    temperature: number;
    bloodPressure: string;
  };
}
