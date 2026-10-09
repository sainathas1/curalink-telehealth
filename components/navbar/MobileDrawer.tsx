'use client';

import React from 'react';
import { UserProfile, UserRole } from '../../lib/types';
import { ActiveTab, PatientTab, DoctorTab } from './Sidebar';
import {
  LayoutDashboard,
  Activity,
  Calendar,
  Pill,
  FileText,
  Users,
  Video,
  Cpu,
  Stethoscope,
  Link as LinkIcon,
  User,
  X,
  LogOut,
  Shield,
  HeartPulse,
  AlertTriangle,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  role: UserRole;
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  currentUser: UserProfile | null;
  onToggleRole: () => void;
  onLogout: () => void;
  onOpenAuth: () => void;
  onEmergencySOS?: () => void;
  activeAlertCount?: number;
}

export function MobileDrawer({
  isOpen,
  onClose,
  role,
  activeTab,
  onSelectTab,
  currentUser,
  onToggleRole,
  onLogout,
  onOpenAuth,
  onEmergencySOS,
  activeAlertCount = 0,
}: MobileDrawerProps) {
  if (!isOpen) return null;

  const isPatient = role?.toLowerCase() === 'patient';

  const patientNavItems: { id: PatientTab; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'vitals', label: 'IoT Vitals Monitor', icon: <Activity className="w-5 h-5" /> },
    { id: 'device', label: 'Connected Devices', icon: <LinkIcon className="w-5 h-5" />, badge: 'USB' },
    { id: 'appointments', label: 'Appointments', icon: <Calendar className="w-5 h-5" /> },
    { id: 'prescriptions', label: 'Prescriptions', icon: <Pill className="w-5 h-5" /> },
    { id: 'records', label: 'Medical Records', icon: <FileText className="w-5 h-5" /> },
    { id: 'profile', label: 'Profile', icon: <User className="w-5 h-5" /> },
  ];

  const doctorNavItems: { id: DoctorTab; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'clinical-queue', label: 'Clinical Queue', icon: <Video className="w-5 h-5" />, badge: 'Today' },
    { id: 'ward-telemetry', label: 'Ward Telemetry', icon: <Activity className="w-5 h-5" />, badge: activeAlertCount > 0 ? `${activeAlertCount} Alert` : undefined },
    { id: 'patient-directory', label: 'Patient Directory', icon: <Users className="w-5 h-5" /> },
    { id: 'records', label: 'Medical Records', icon: <FileText className="w-5 h-5" /> },
    { id: 'ehr-prescribe', label: 'EHR Workspace', icon: <Stethoscope className="w-5 h-5" /> },
    { id: 'hardware-hub', label: 'IoT Hardware Hub', icon: <Cpu className="w-5 h-5" /> },
  ];

  const items = isPatient ? patientNavItems : doctorNavItems;

  return (
    <div className="fixed inset-0 z-50 md:hidden flex animate-in fade-in duration-200">
      {/* Frosted Acrylic Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Slide-in Fluent Drawer Panel */}
      <div className="relative w-80 max-w-[85vw] h-full bg-slate-900/95 backdrop-blur-2xl text-white border-r border-slate-800 shadow-2xl flex flex-col justify-between p-5 z-10 animate-in slide-in-from-left duration-250">
        <div className="space-y-6 overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-700 flex items-center justify-center text-white shadow-md shadow-teal-500/20">
                <HeartPulse className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <span className="text-base font-black tracking-tight text-white">
                  Cura<span className="text-teal-400">Link</span>
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider block text-teal-400">
                  {isPatient ? 'Patient Portal' : 'Clinician Command'}
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* User Profile Pill */}
          {currentUser ? (
            <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-400/30 flex items-center justify-center font-bold text-sm shrink-0">
                {currentUser.fullName ? currentUser.fullName[0].toUpperCase() : 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white truncate">{currentUser.fullName || 'User'}</p>
                <p className="text-[11px] text-slate-400 truncate">{currentUser.email || 'Signed in'}</p>
              </div>
            </div>
          ) : (
            <button
              onClick={() => {
                onClose();
                onOpenAuth();
              }}
              className="w-full py-2.5 px-4 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md shadow-teal-600/20 transition-all hover:scale-105 active:scale-95 duration-200 cursor-pointer flex items-center justify-center gap-2"
            >
              <User className="w-4 h-4" />
              <span>Sign In / Register</span>
            </button>
          )}

          {/* Navigation Links */}
          <nav className="space-y-1">
            <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider px-3 mb-2">
              Menu Navigation
            </p>
            {items.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelectTab(item.id);
                    onClose();
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-teal-500/20 text-teal-300 border border-teal-400/30 shadow-xs'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={isActive ? 'text-teal-400' : 'text-slate-400'}>{item.icon}</span>
                    <span>{item.label}</span>
                  </div>

                  {item.badge && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-400/30 font-mono">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-slate-800 space-y-2.5">
          {/* Switch Role Button */}
          <button
            onClick={() => {
              onToggleRole();
              onClose();
            }}
            className="w-full py-2.5 px-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 flex items-center justify-between transition-all duration-200 cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-teal-400" />
              <span>Switch to {isPatient ? 'Doctor Portal' : 'Patient Portal'}</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500" />
          </button>

          {/* Emergency SOS Button for Patients */}
          {isPatient && onEmergencySOS && (
            <button
              onClick={() => {
                onClose();
                onEmergencySOS();
              }}
              className="w-full py-2.5 px-3.5 rounded-2xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold text-xs border border-rose-500/30 flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer"
            >
              <AlertTriangle className="w-4 h-4 text-rose-400 animate-pulse" />
              <span>Emergency SOS Protocol</span>
            </button>
          )}

          {/* Logout */}
          {currentUser && (
            <button
              onClick={() => {
                onClose();
                onLogout();
              }}
              className="w-full py-2 px-3.5 rounded-2xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
