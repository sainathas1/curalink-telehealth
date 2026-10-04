'use client';

import React from 'react';
import { TelehealthProvider } from '../../context/TelehealthContext';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return <TelehealthProvider>{children}</TelehealthProvider>;
}
