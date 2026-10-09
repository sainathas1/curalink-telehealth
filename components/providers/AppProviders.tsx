'use client';

import React from 'react';
import { TelehealthProvider } from '../../context/TelehealthContext';
import { PageTransition } from './PageTransition';
import { ErrorBoundary } from '../ui/ErrorBoundary';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary sectionName="CuraLink Application">
      <TelehealthProvider>
        <PageTransition>{children}</PageTransition>
      </TelehealthProvider>
    </ErrorBoundary>
  );
}
