import {
  Activity, Calendar, Cpu, FileText, LayoutDashboard, Link, Pill,
  Stethoscope, User, Users, Video, type LucideIcon,
} from 'lucide-react';
import type { UserRole } from '../../lib/types';

export type PatientTab = 'overview' | 'vitals' | 'device' | 'appointments' | 'prescriptions' | 'records' | 'profile';
export type DoctorTab = 'clinical-queue' | 'ward-telemetry' | 'patient-directory' | 'records' | 'ehr-prescribe' | 'hardware-hub' | 'profile';
export type ActiveTab = PatientTab | DoctorTab;

export interface NavigationItem {
  id: ActiveTab;
  label: string;
  mobileLabel?: string;
  icon: LucideIcon;
  badge?: string;
}

const patientItems: NavigationItem[] = [
  { id: 'overview', label: 'Overview', mobileLabel: 'Home', icon: LayoutDashboard },
  { id: 'appointments', label: 'Appointments', mobileLabel: 'Visits', icon: Calendar },
  { id: 'vitals', label: 'Health monitoring', mobileLabel: 'Vitals', icon: Activity },
  { id: 'prescriptions', label: 'Prescriptions', icon: Pill },
  { id: 'records', label: 'Medical records', icon: FileText },
  { id: 'device', label: 'Connected devices', icon: Link },
  { id: 'profile', label: 'My profile', mobileLabel: 'Profile', icon: User },
];

const doctorItems: NavigationItem[] = [
  { id: 'clinical-queue', label: 'Consultation queue', mobileLabel: 'Queue', icon: Video },
  { id: 'patient-directory', label: 'My patients', mobileLabel: 'Patients', icon: Users },
  { id: 'ward-telemetry', label: 'Patient monitoring', mobileLabel: 'Monitor', icon: Activity },
  { id: 'records', label: 'Medical records', icon: FileText },
  { id: 'ehr-prescribe', label: 'Prescribe & notes', mobileLabel: 'Prescribe', icon: Stethoscope },
  { id: 'hardware-hub', label: 'Device hub', icon: Cpu },
  { id: 'profile', label: 'Clinician profile', mobileLabel: 'Profile', icon: User },
];

export function getNavigation(role: UserRole, activeAlertCount = 0): NavigationItem[] {
  const isPatient = role.toLowerCase() === 'patient';
  const monitoredTab = isPatient ? 'vitals' : 'ward-telemetry';
  return (isPatient ? patientItems : doctorItems).map((item) => (
    item.id === monitoredTab && activeAlertCount > 0
      ? { ...item, badge: String(activeAlertCount) }
      : item
  ));
}
