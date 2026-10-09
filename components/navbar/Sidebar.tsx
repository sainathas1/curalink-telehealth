'use client';

import { AlertTriangle, ChevronLeft, ChevronRight, ShieldCheck } from 'lucide-react';
import type { UserRole } from '../../lib/types';
import { getNavigation, type ActiveTab } from './navigation';

export type { ActiveTab, PatientTab, DoctorTab } from './navigation';

interface SidebarProps {
  role: UserRole;
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onEmergencySOS: () => void;
  activeAlertCount?: number;
}

export function Sidebar({ role, activeTab, onSelectTab, isCollapsed, onToggleCollapse, onEmergencySOS, activeAlertCount = 0 }: SidebarProps) {
  const isPatient = role.toLowerCase() === 'patient';

  return (
    <aside className={`sticky top-[77px] hidden h-[calc(100dvh-77px)] shrink-0 flex-col border-r border-slate-200/80 bg-white md:flex ${isCollapsed ? 'w-20' : 'w-64'} transition-[width] duration-200`}>
      <div className="flex items-center gap-2 px-5 pb-3 pt-7">
        {!isCollapsed && <p className="flex-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{isPatient ? 'Your care' : 'Clinical workspace'}</p>}
        <button type="button" onClick={onToggleCollapse} aria-label={isCollapsed ? 'Expand navigation' : 'Collapse navigation'} aria-expanded={!isCollapsed} className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600">
          {isCollapsed ? <ChevronRight size={16} aria-hidden="true" /> : <ChevronLeft size={16} aria-hidden="true" />}
        </button>
      </div>
      <nav aria-label={isPatient ? 'Patient navigation' : 'Doctor navigation'} className="flex-1 space-y-1 overflow-y-auto px-3">
        {getNavigation(role, activeAlertCount).map(({ id, label, icon: Icon, badge }) => {
          const selected = activeTab === id;
          return (
            <button type="button" key={id} onClick={() => onSelectTab(id)} aria-label={label} aria-current={selected ? 'page' : undefined} title={isCollapsed ? label : undefined} className={`group relative flex min-h-11 w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 ${selected ? 'bg-teal-50 font-semibold text-teal-800' : 'font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}>
              {selected && <span className="absolute inset-y-3 left-0 w-[3px] rounded-full bg-teal-600" aria-hidden="true" />}
              <Icon size={19} strokeWidth={selected ? 2 : 1.7} className="shrink-0" aria-hidden="true" />
              {!isCollapsed && <span className="flex-1 text-left">{label}</span>}
              {badge && <span aria-label={`${badge} alerts`} className={`${isCollapsed ? 'absolute right-1 top-1' : ''} flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-100 px-1.5 text-[10px] font-semibold text-rose-700`}>{badge}</span>}
            </button>
          );
        })}
      </nav>
      <div className="mt-8 border-t border-slate-100 p-4">
        {isPatient ? (
          <div className={isCollapsed ? '' : 'rounded-2xl border border-rose-100 bg-rose-50/60 p-4'}>
            {!isCollapsed && <><p className="mb-1 text-sm font-semibold text-slate-800">Need urgent help?</p><p className="mb-3 text-xs leading-relaxed text-slate-500">Find emergency contacts when you need urgent assistance.</p></>}
            <button type="button" onClick={onEmergencySOS} aria-label="Open emergency help" className={`flex min-h-10 items-center justify-center gap-2 rounded-xl font-semibold text-rose-700 transition-colors hover:bg-rose-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 ${isCollapsed ? 'h-11 w-11' : 'w-full border border-rose-200 bg-white px-3 text-xs'}`}><AlertTriangle size={17} aria-hidden="true" />{!isCollapsed && 'Emergency help'}</button>
          </div>
        ) : (
          <div className={`flex items-start gap-2.5 rounded-xl bg-slate-50 p-3 ${isCollapsed ? 'justify-center' : ''}`}>
            <ShieldCheck size={18} className="shrink-0 text-teal-600" aria-hidden="true" />
            {!isCollapsed && <div><p className="text-xs font-semibold text-slate-700">Your clinical workspace</p><p className="mt-1 text-[11px] leading-relaxed text-slate-400">Care information for your assigned patients.</p></div>}
          </div>
        )}
      </div>
    </aside>
  );
}
