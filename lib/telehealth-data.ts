import type { Appointment, ClinicalRecord, MedicalRecord, PatientDirectoryItem, Prescription } from './types';

export interface StoredRecord { id: string; source: string; data: Record<string, any>; }
export const recordSources = ['medical_records', 'clinical_records', 'prescriptions', 'medicalRecords'] as const;
export function timeValue(value: any): number {
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  const result = typeof value === 'number' ? value : Date.parse(value || '');
  return Number.isFinite(result) ? result : 0;
}
export function appointmentTime(appointment: Appointment): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(appointment.date || '')) return timeValue(appointment.createdAt);
  const match = appointment.time?.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  let hour = match ? Number(match[1]) % 12 + (match[3].toUpperCase() === 'PM' ? 12 : 0) : 0;
  if (!match) hour = Number(appointment.time?.split(':')[0]) || 0;
  const minute = match?.[2] || appointment.time?.match(/^\d{1,2}:(\d{2})/)?.[1] || '00';
  return Date.parse(`${appointment.date}T${String(hour).padStart(2, '0')}:${minute}:00+05:30`);
}
export function sortAppointments(appointments: Appointment[]): Appointment[] {
  return [...appointments].sort((a, b) => appointmentTime(a) - appointmentTime(b) || a.id.localeCompare(b.id));
}
export function normalizeClinicalRecord(record: StoredRecord): ClinicalRecord {
  const data = record.data;
  const content = data.content && typeof data.content === 'object' ? data.content : data;
  const type = record.source === 'prescriptions' ? 'Prescription' : data.recordType || data['Record Type'] || data.type || 'Medical Record';
  return {
    ...data, id: `${record.source}/${record.id}`, patientId: data.patientId,
    doctorId: data.doctorId, doctorName: data.doctorName, patientName: data.patientName,
    type, createdAt: data.createdAt, content,
    fileData: data.fileData || content.fileData,
    downloadUrl: data.downloadUrl || content.downloadUrl,
    documentTitle: data.documentTitle || data['Document Title'] || data.title || content.title,
    recordType: type, notes: data.notes || data['Notes'] || content.notes || content.summary,
  };
}
export function mergeClinicalRecords(records: StoredRecord[]): ClinicalRecord[] {
  const priority = (source: string) => recordSources.indexOf(source as typeof recordSources[number]);
  const ordered = [...records].sort((a, b) => priority(a.source) - priority(b.source));
  const fingerprints = new Map<string, string>();
  const merged: ClinicalRecord[] = [];
  for (const stored of ordered) {
    const record = normalizeClinicalRecord(stored);
    const content = record.content || {};
    const attachment = record.fileData || record.downloadUrl;
    let fingerprint = '';
    if (attachment) fingerprint = JSON.stringify([record.patientId, record.type, record.documentTitle, attachment]);
    else if (record.type === 'Prescription') fingerprint = JSON.stringify([record.patientId, record.doctorId, content.medicationName, content.dosage, content.frequency, content.duration, content.dateIssued]);
    else if (content.recordedAt) fingerprint = JSON.stringify([record.patientId, record.doctorId, record.type, record.documentTitle, record.notes, content.recordedAt]);
    else fingerprint = `${record.patientId}:${record.type}:${stored.id}`;
    // Collapse cross-collection mirrors, preserving repeated entries in a single source.
    const previousSource = fingerprints.get(fingerprint);
    if (previousSource && previousSource !== stored.source) continue;
    fingerprints.set(fingerprint, stored.source);
    merged.push(record);
  }
  return merged.sort((a, b) => timeValue(b.createdAt) - timeValue(a.createdAt));
}
export function toMedicalRecord(record: ClinicalRecord): MedicalRecord {
  const content = record.content || {};
  const timestamp = timeValue(record.createdAt);
  return {
    id: record.id, patientId: record.patientId,
    date: content.date || (timestamp ? new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' }).format(timestamp) : 'Date not recorded'),
    type: record.type, title: record.documentTitle || content.title || 'Clinical record',
    doctorName: record.doctorName || '', facility: content.facility || 'CuraLink',
    fileSize: content.fileSize || '', summary: record.notes || content.summary || content.diagnosis || '',
    notes: record.notes, fileData: record.fileData || content.fileData,
    downloadUrl: record.downloadUrl || content.downloadUrl || record.fileData || content.fileData,
  };
}
export function toPrescription(record: ClinicalRecord): Prescription {
  const content = record.content || {};
  return {
    id: record.id, patientId: record.patientId, patientName: record.patientName || '',
    doctorId: record.doctorId || '', doctorName: record.doctorName || '', doctorLicense: content.doctorLicense || '',
    medicationName: content.medicationName || '', dosage: content.dosage || '', frequency: content.frequency || '',
    duration: content.duration || '', instructions: content.instructions || '', dateIssued: content.dateIssued || '',
    validUntil: content.validUntil || '', refillsLeft: content.refillsLeft ?? 0, status: content.status || 'Active',
  };
}
export function toPatient(id: string, data: Record<string, any>, clinicianName: string, telemetry?: Record<string, any>): PatientDirectoryItem {
  const vitals = telemetry || data.currentVitals || {};
  const temperature = typeof data.lastSyncedTemperature === 'number' ? data.lastSyncedTemperature : vitals.temperature || 0;
  const gender = ['Male', 'Female', 'Other'].includes(data.gender) ? data.gender : 'Other';
  return {
    id, name: data.fullName || data.name || 'Patient', age: typeof data.age === 'number' ? data.age : 0,
    gender, condition: data.condition || data.chronicConditions?.join(', ') || 'Not provided',
    status: vitals.status === 'critical' || data.temperatureStatus === 'critical' ? 'Critical' : 'Monitored',
    assignedDoctor: data.assignedDoctorName || clinicianName,
    assignedDoctorId: data.assignedDoctorId || undefined,
    lastVisit: data.lastVisitDate || data.lastVisit || 'Not recorded',
    roomOrBed: data.roomOrBed, nextAppointment: data.nextAppointment,
    email: data.email || '', phone: data.phoneNumber || data.phone || '', phoneNumber: data.phoneNumber || data.phone || '',
    bloodGroup: data.bloodGroup || data.bloodType || '', bloodType: data.bloodType || data.bloodGroup || '',
    allergies: Array.isArray(data.allergies) ? data.allergies : [], knownAllergies: data.knownAllergies || '',
    chronicConditions: Array.isArray(data.chronicConditions) ? data.chronicConditions : [], currentMedications: data.currentMedications || '',
    emergencyContact: data.emergencyContact || '', hasCompletedOnboarding: data.hasCompletedOnboarding === true,
    lastSyncedTemperature: data.lastSyncedTemperature, lastSyncedAt: data.lastSyncedAt,
    temperatureStatus: data.temperatureStatus, deviceModel: data.deviceModel,
    currentVitals: { heartRate: vitals.heartRate || 0, spo2: vitals.spo2 || 0, temperature,
      bloodPressure: vitals.systolic > 0 && vitals.diastolic > 0 ? `${vitals.systolic}/${vitals.diastolic}` : vitals.bloodPressure || '—' },
  };
}
