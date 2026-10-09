'use client';

import { useEffect, useRef, type KeyboardEvent } from 'react';
import { AlertTriangle, HeartPulse, LogOut, PhoneCall, User, X } from 'lucide-react';
import type { UserProfile, UserRole } from '../../lib/types';
import { getNavigation, type ActiveTab } from './navigation';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  role: UserRole;
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  currentUser: UserProfile | null;
  onLogout: () => void;
  onOpenAuth: () => void;
  onEmergencySOS?: () => void;
  activeAlertCount?: number;
}

export function MobileDrawer({ isOpen, onClose, role, activeTab, onSelectTab, currentUser, onLogout, onOpenAuth, onEmergencySOS, activeAlertCount = 0 }: MobileDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const closeActionRef = useRef(onClose);
  const isPatient = role.toLowerCase() === 'patient';

  useEffect(() => { closeActionRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const desktopViewport = window.matchMedia('(min-width: 768px)');
    const closeOnDesktop = () => { if (desktopViewport.matches) closeActionRef.current(); };
    desktopViewport.addEventListener('change', closeOnDesktop);
    return () => {
      desktopViewport.removeEventListener('change', closeOnDesktop);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [isOpen]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const controls = panelRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex="0"]');
    if (!controls?.length) return;
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex md:hidden">
      <button type="button" tabIndex={-1} aria-label="Close navigation" className="absolute inset-0 bg-slate-950/35 backdrop-blur-sm" onClick={onClose} />
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="mobile-navigation-title" onKeyDown={handleKeyDown} className="relative flex h-full w-80 max-w-[88vw] flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-5">
          <div className="flex items-center gap-2.5"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-700 text-white"><HeartPulse size={20} aria-hidden="true" /></span><div><p className="text-lg font-bold tracking-tight text-slate-900">Cura<span className="text-teal-700">Link</span></p><p id="mobile-navigation-title" className="text-[11px] text-slate-500">{isPatient ? 'Patient portal' : 'Doctor portal'}</p></div></div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close navigation" className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-teal-600"><X size={20} aria-hidden="true" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {currentUser ? <div className="mb-6 flex items-center gap-3 rounded-2xl bg-slate-50 p-3.5"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal-100 text-sm font-semibold text-teal-800">{(currentUser.fullName || 'U').split(' ').filter(Boolean).slice(0, 2).map((name) => name[0]).join('')}</span><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">{currentUser.fullName}</p><p className="mt-0.5 truncate text-xs text-slate-500">{currentUser.email}</p></div></div> : <button type="button" onClick={() => { onClose(); onOpenAuth(); }} className="care-button mb-5 w-full"><User size={16} aria-hidden="true" />Sign in</button>}
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{isPatient ? 'Your care' : 'Clinical workspace'}</p>
          <nav aria-label="All portal pages" className="space-y-1">
            {getNavigation(role, activeAlertCount).map(({ id, label, icon: Icon, badge }) => (
              <button type="button" key={id} aria-current={activeTab === id ? 'page' : undefined} onClick={() => { onSelectTab(id); onClose(); }} className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm focus-visible:outline-2 focus-visible:outline-teal-600 ${activeTab === id ? 'bg-teal-50 font-semibold text-teal-800' : 'font-medium text-slate-600 hover:bg-slate-50'}`}><Icon size={19} aria-hidden="true" /><span className="flex-1 text-left">{label}</span>{badge && <span aria-label={`${badge} alerts`} className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] text-rose-700">{badge}</span>}</button>
            ))}
          </nav>
        </div>
        <div className="space-y-2 border-t border-slate-100 p-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }}>
          {isPatient && (
            <div className="space-y-1.5">
              <a
                href="tel:8788246552"
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-rose-600 text-xs font-bold text-white hover:bg-rose-700 active:scale-[0.98]"
              >
                <PhoneCall size={15} aria-hidden="true" />
                <span>Call Hotline (8788246552)</span>
              </a>
              {onEmergencySOS && (
                <button
                  type="button"
                  onClick={() => { onClose(); onEmergencySOS(); }}
                  className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 text-xs font-semibold text-rose-700 hover:bg-rose-100 active:scale-[0.98]"
                >
                  <AlertTriangle size={15} aria-hidden="true" />
                  <span>More SOS Options</span>
                </button>
              )}
            </div>
          )}
          {currentUser && <button type="button" onClick={() => { onClose(); onLogout(); }} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-teal-600"><LogOut size={16} aria-hidden="true" />Sign out</button>}
        </div>
      </div>
    </div>
  );
}
