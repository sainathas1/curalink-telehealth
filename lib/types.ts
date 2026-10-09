export type UserRole = 'Patient' | 'Doctor' | 'patient' | 'doctor';

export interface UserProfile {
  uid: string;
  fullName: string;
  email: string;
  phoneNumber?: string;
  role: UserRole;
  avatarUrl?: string;
  specialty?: string; // For doctors
  licenseNumber?: string; // For doctors
  isVerified?: boolean; // For doctor credential verification
  hasCompletedOnboarding?: boolean; // Mandatory medical onboarding for patients
  dateOfBirth?: string; // For patients
  bloodType?: string; // For patients
  bloodGroup?: string; // Blood Group (A+, B+, etc.)
  emergencyContact?: string; // For patients
  allergies?: string[];
  knownAllergies?: string; // Known allergies text
  chronicConditions?: string[]; // Diabetes, Hypertension, Asthma, None, etc.
  currentMedications?: string; // Current medications
  assignedDoctorId?: string;
  age?: number | string; // Mandatory for patients
  gender?: string;
  phone?: string;
  qualifications?: string; // For doctors
  consultationFee?: number; // For doctors (₹)
  bio?: string; // For doctors
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
  status: 'Upcoming' | 'In Progress' | 'Completed' | 'Cancelled' | 'scheduled' | string;
  symptoms: string;
  meetingLink?: string;
  patientEmail?: string;
  patientPhone?: string;
  emergencyContact?: string;
  patientAge?: number;
  bloodGroup?: string;
  knownAllergies?: string;
  chronicConditions?: string[];
  currentMedications?: string;
  paymentStatus?: 'Paid' | 'Pending' | 'Waived';
  paymentAmount?: number;
  paymentTxnId?: string;
  paymentMethod?: string;
  createdAt?: string;
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
  type: 'Lab Report' | 'Clinical Summary' | 'Radiology' | 'Discharge Summary' | string;
  title: string;
  doctorName: string;
  facility: string;
  fileSize: string;
  summary: string;
  notes?: string;
  downloadUrl?: string;
  fileData?: string;
}

export interface ClinicalRecord {
  id: string;
  patientId: string;
  doctorId?: string;
  doctorName?: string;
  patientName?: string;
  type: 'Prescription' | 'Clinical Note' | 'Medical Record' | 'Lab Report' | string;
  content: any;
  createdAt?: any;
  fileData?: string;
  downloadUrl?: string;
  documentTitle?: string;
  recordType?: string;
  notes?: string;
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
  assignedDoctorId?: string;
  lastVisit: string;
  nextAppointment?: string;
  bloodGroup?: string;
  bloodType?: string;
  allergies?: string[];
  knownAllergies?: string;
  chronicConditions?: string[];
  currentMedications?: string;
  email?: string;
  phone?: string;
  phoneNumber?: string;
  lastVisitDate?: string;
  emergencyContact?: string;
  hasCompletedOnboarding?: boolean;
  lastSyncedTemperature?: number;
  lastSyncedAt?: string;
  temperatureStatus?: 'normal' | 'elevated' | 'critical' | string;
  deviceModel?: string;
  currentVitals: {
    heartRate: number;
    spo2: number;
    temperature: number;
    bloodPressure: string;
  };
}

export interface VitalRecord {
  id: string;
  patientId: string;
  heartRate: number;
  spo2: number;
  temperature: number;
  systolic?: number;
  diastolic?: number;
  notes?: string;
  createdAt?: any;
}

export interface ConsultationMessage {
  id: string;
  appointmentId: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt?: any;
}
