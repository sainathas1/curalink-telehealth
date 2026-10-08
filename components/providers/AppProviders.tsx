'use client';

import React from 'react';
import { TelehealthProvider } from '../../context/TelehealthContext';
import { PageTransition } from './PageTransition';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <TelehealthProvider>
      <PageTransition>{children}</PageTransition>
    </TelehealthProvider>
  );
}
