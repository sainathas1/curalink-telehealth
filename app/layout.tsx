import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'CuraLink Telehealth & IoT Patient Monitoring',
  description: 'Continuous real-time biomedical telemetry monitoring, HD virtual consultations, digital prescriptions, and clinical EHR workspace.',
  openGraph: {
    title: 'CuraLink Telehealth & IoT Patient Monitoring',
    description: 'Continuous real-time biomedical telemetry monitoring, HD virtual consultations, digital prescriptions, and clinical EHR workspace.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CuraLink Telehealth & IoT Patient Monitoring',
    description: 'Continuous real-time biomedical telemetry monitoring, HD virtual consultations, digital prescriptions, and clinical EHR workspace.',
  },
};

import { AppProviders } from '../components/providers/AppProviders';

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
