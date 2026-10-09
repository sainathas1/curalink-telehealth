'use client';

import type { UserRole } from '../../lib/types';
import { getNavigation, type ActiveTab } from './navigation';

interface MobileNavProps {
  role: UserRole;
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  activeAlertCount?: number;
}

export function MobileNav({ role, activeTab, onSelectTab, activeAlertCount = 0 }: MobileNavProps) {
  const primaryTabs = role.toLowerCase() === 'patient'
    ? ['overview', 'appointments', 'vitals', 'profile']
    : ['clinical-queue', 'patient-directory', 'ward-telemetry', 'ehr-prescribe'];
  const items = getNavigation(role, activeAlertCount).filter((item) => primaryTabs.includes(item.id));

  return (
    <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-2 pt-2 backdrop-blur-xl md:hidden" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))' }}>
      <div className="mx-auto flex max-w-lg items-center justify-around">
        {items.map(({ id, label, mobileLabel, icon: Icon, badge }) => {
          const selected = activeTab === id;
          return (
            <button type="button" key={id} aria-label={label} aria-current={selected ? 'page' : undefined} onClick={() => onSelectTab(id)} className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-xl text-[10px] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-teal-600 ${selected ? 'font-semibold text-teal-800' : 'font-medium text-slate-500 hover:text-slate-900'}`}>
              <span className={`relative flex h-7 w-14 items-center justify-center rounded-full ${selected ? 'bg-teal-50' : ''}`}><Icon size={20} aria-hidden="true" />{badge && <span aria-label={`${badge} alerts`} className="absolute -top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-semibold text-white">{badge}</span>}</span>
              <span>{mobileLabel || label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
