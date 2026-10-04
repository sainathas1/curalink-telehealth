'use client';

import React from 'react';
import { UserRole } from '../../lib/types';
import { ActiveTab, PatientTab, DoctorTab } from './Sidebar';
import {
  LayoutDashboard,
  Activity,
  Calendar,
  Pill,
  FileText,
  Users,
  Video,
  Stethoscope,
  Cpu,
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
  const patientTabs: { id: PatientTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Home', icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'vitals', label: 'Vitals', icon: <Activity className="w-5 h-5" /> },
    { id: 'appointments', label: 'Visits', icon: <Calendar className="w-5 h-5" /> },
    { id: 'prescriptions', label: 'Rx', icon: <Pill className="w-5 h-5" /> },
    { id: 'records', label: 'Records', icon: <FileText className="w-5 h-5" /> },
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

  const tabs = role === 'Patient' ? patientTabs : doctorTabs;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800 px-2 py-2 flex items-center justify-around shadow-lg">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer relative ${
              isActive
                ? 'text-teal-400 font-bold scale-105'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="relative">
              {tab.icon}
              {'badge' in tab && tab.badge && (
                <span className="absolute -top-1 -right-2 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center animate-pulse">
                  {tab.badge}
                </span>
              )}
            </div>
            <span className="text-[10px] tracking-tight mt-0.5">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
