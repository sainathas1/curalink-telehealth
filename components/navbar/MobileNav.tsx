'use client';

import React from 'react';
import { UserRole } from '../../lib/types';
import { ActiveTab, PatientTab, DoctorTab } from './Sidebar';
import {
  LayoutDashboard,
  Activity,
  Calendar,
  User,
  Video,
  Stethoscope,
  Cpu,
  Users,
} from 'lucide-react';

interface MobileNavProps {
  role: UserRole;
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  activeAlertCount?: number;
}

export function MobileNav({
  role,
  activeTab,
  onSelectTab,
  activeAlertCount = 0,
}: MobileNavProps) {
  // Material 3 Mobile Navigation Bar guidelines: exactly 4 primary destinations for patient
  const patientTabs: { id: PatientTab; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'overview', label: 'Home', icon: <LayoutDashboard className="w-5 h-5" /> },
    {
      id: 'vitals',
      label: 'Vitals',
      icon: <Activity className="w-5 h-5" />,
      badge: activeAlertCount > 0 ? String(activeAlertCount) : undefined,
    },
    { id: 'appointments', label: 'Appointments', icon: <Calendar className="w-5 h-5" /> },
    { id: 'profile', label: 'Profile', icon: <User className="w-5 h-5" /> },
  ];

  const doctorTabs: { id: DoctorTab; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'clinical-queue', label: 'Queue', icon: <Video className="w-5 h-5" /> },
    {
      id: 'ward-telemetry',
      label: 'Ward',
      icon: <Activity className="w-5 h-5" />,
      badge: activeAlertCount > 0 ? String(activeAlertCount) : undefined,
    },
    { id: 'patient-directory', label: 'Patients', icon: <Users className="w-5 h-5" /> },
    { id: 'ehr-prescribe', label: 'EHR', icon: <Stethoscope className="w-5 h-5" /> },
    { id: 'hardware-hub', label: 'IoT Hub', icon: <Cpu className="w-5 h-5" /> },
  ];

  const tabs = role?.toLowerCase() === 'patient' ? patientTabs : doctorTabs;

  return (
    <nav
      aria-label="Mobile Bottom Navigation Bar"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800/80 px-2 pt-2 shadow-[0_-4px_20px_rgba(0,0,0,0.35)]"
      style={{
        paddingBottom: 'max(0.6rem, env(safe-area-inset-bottom, 0px))',
      }}
    >
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className="flex flex-col items-center justify-center flex-1 py-1 transition-all m3-pressable cursor-pointer group select-none min-h-[48px]"
              aria-current={isActive ? 'page' : undefined}
            >
              {/* Material 3 Active Indicator Pill */}
              <div
                className={`relative px-5 py-1 rounded-full transition-all duration-200 flex items-center justify-center ${
                  isActive
                    ? 'bg-teal-500/20 text-teal-400 shadow-xs'
                    : 'text-slate-400 group-hover:text-slate-200'
                }`}
              >
                {tab.icon}

                {/* Badge indicator */}
                {'badge' in tab && tab.badge && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center animate-pulse shadow-xs">
                    {tab.badge}
                  </span>
                )}
              </div>

              {/* Material 3 Label */}
              <span
                className={`text-[11px] tracking-tight mt-1 transition-colors duration-150 ${
                  isActive
                    ? 'font-bold text-teal-300'
                    : 'font-medium text-slate-400 group-hover:text-slate-300'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
