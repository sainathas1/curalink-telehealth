'use client';

import React from 'react';
import { UserRole } from '../../lib/types';
import {
  LayoutDashboard,
  Activity,
  Calendar,
  Pill,
  FileText,
  Users,
  Video,
  Cpu,
  AlertTriangle,
  Stethoscope,
  ChevronLeft,
  ChevronRight,
  Shield,
} from 'lucide-react';

export type PatientTab = 'overview' | 'vitals' | 'appointments' | 'prescriptions' | 'records';
export type DoctorTab = 'clinical-queue' | 'ward-telemetry' | 'patient-directory' | 'ehr-prescribe' | 'hardware-hub';
export type ActiveTab = PatientTab | DoctorTab;

interface SidebarProps {
  role: UserRole;
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onEmergencySOS: () => void;
  activeAlertCount?: number;
}

export function Sidebar({
  role,
  activeTab,
  onSelectTab,
  isCollapsed,
  onToggleCollapse,
  onEmergencySOS,
  activeAlertCount = 0,
}: SidebarProps) {
  const patientNavItems: { id: PatientTab; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'vitals', label: 'IoT Vitals Monitor', icon: <Activity className="w-5 h-5" />, badge: 'Live' },
    { id: 'appointments', label: 'Appointments', icon: <Calendar className="w-5 h-5" /> },
    { id: 'prescriptions', label: 'Prescriptions', icon: <Pill className="w-5 h-5" /> },
    { id: 'records', label: 'Medical Records', icon: <FileText className="w-5 h-5" /> },
  ];

  const doctorNavItems: { id: DoctorTab; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'clinical-queue', label: 'Clinical Queue', icon: <Video className="w-5 h-5" />, badge: 'Today' },
    { id: 'ward-telemetry', label: 'Ward Telemetry', icon: <Activity className="w-5 h-5" />, badge: activeAlertCount > 0 ? `${activeAlertCount} Alert` : undefined },
    { id: 'patient-directory', label: 'Patient Directory', icon: <Users className="w-5 h-5" /> },
    { id: 'ehr-prescribe', label: 'EHR Workspace', icon: <Stethoscope className="w-5 h-5" /> },
    { id: 'hardware-hub', label: 'IoT Hardware Hub', icon: <Cpu className="w-5 h-5" /> },
  ];

  const items = role === 'Patient' ? patientNavItems : doctorNavItems;

  return (
    <aside
      className={`hidden md:flex flex-col justify-between bg-slate-900 text-white transition-all duration-300 relative border-r border-slate-800 ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Top Navigation Links */}
      <div className="p-4 space-y-6">
        {/* Portal Identifier Tag */}
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-teal-400">
                {role === 'Doctor' ? 'Clinician Command' : 'Patient Health Portal'}
              </span>
              <p className="text-xs text-slate-400 font-medium">CuraLink TeleCare</p>
            </div>
          )}
          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer ml-auto"
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Item List */}
        <nav className="space-y-1.5">
          {items.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-xs font-semibold transition-all cursor-pointer group relative ${
                  isActive
                    ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-md shadow-teal-900/40'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
                title={isCollapsed ? item.label : undefined}
              >
                <div
                  className={`shrink-0 transition-transform group-hover:scale-110 ${
                    isActive ? 'text-white' : 'text-slate-400 group-hover:text-teal-400'
                  }`}
                >
                  {item.icon}
                </div>

                {!isCollapsed && (
                  <span className="flex-1 text-left truncate">{item.label}</span>
                )}

                {!isCollapsed && item.badge && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      item.badge.includes('Alert')
                        ? 'bg-rose-500 text-white animate-pulse'
                        : isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-teal-500/20 text-teal-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Emergency SOS Card (Patient) or Security Status (Doctor) */}
      <div className="p-4 border-t border-slate-800">
        {role === 'Patient' ? (
          !isCollapsed ? (
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-rose-950/70 to-slate-900 border border-rose-800/40 space-y-2">
              <div className="flex items-center gap-2 text-rose-400">
                <AlertTriangle className="w-4 h-4 animate-bounce" />
                <span className="text-xs font-bold uppercase tracking-wider">Emergency SOS</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-snug">
                Immediate dispatch to CuraLink on-call ICU doctor & local 911.
              </p>
              <button
                onClick={onEmergencySOS}
                className="w-full py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-900/50 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>Trigger Medical SOS</span>
              </button>
            </div>
          ) : (
            <button
              onClick={onEmergencySOS}
              className="w-12 h-12 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-md shadow-rose-900/50 transition-all cursor-pointer mx-auto"
              title="Trigger Medical SOS"
            >
              <AlertTriangle className="w-5 h-5 animate-pulse" />
            </button>
          )
        ) : (
          !isCollapsed ? (
            <div className="p-3 rounded-2xl bg-slate-800/50 border border-slate-700/50 text-[11px] text-slate-400 space-y-1">
              <div className="flex items-center gap-1.5 text-teal-400 font-semibold">
                <Shield className="w-3.5 h-3.5" />
                <span>HIPAA & HITECH Compliant</span>
              </div>
              <p className="text-[10px] text-slate-400">256-bit encrypted telemetry channel active.</p>
            </div>
          ) : (
            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-teal-400 mx-auto" title="HIPAA Compliant">
              <Shield className="w-5 h-5" />
            </div>
          )
        )}
      </div>
    </aside>
  );
}
