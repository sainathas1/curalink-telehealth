import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.curalink.app', // Your main app identifier
  appName: 'CuraLink',       // The name patients will see
  webDir: 'public',
  server: {
    url: 'https://curalink-telehealth.vercel.app', // Your main patient dashboard
    cleartext: true
  }
};

export default config;