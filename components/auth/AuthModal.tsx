'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { UserProfile, UserRole } from '../../lib/types';
import { AuthForm } from './AuthForm';

interface AuthModalProps { isOpen: boolean; onClose: () => void; onSuccess: (profile: UserProfile) => void; initialRole?: UserRole; }
export function AuthModal({ isOpen, onClose, onSuccess, initialRole = 'Patient' }: AuthModalProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (isOpen) dialog.current?.showModal();
    else dialog.current?.close();
  }, [isOpen]);
  return <dialog ref={dialog} aria-labelledby="auth-title" onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }} className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-md overflow-y-auto rounded-3xl border border-slate-200 bg-white p-7 text-slate-900 shadow-2xl backdrop:bg-slate-900/40"><button type="button" onClick={onClose} aria-label="Close sign in" className="absolute right-3 top-3 rounded-xl p-2 text-slate-500 hover:bg-slate-100"><X size={20} /></button>{isOpen && <AuthForm initialRole={initialRole} onSuccess={profile => { onSuccess(profile); onClose(); }} />}</dialog>;
}
