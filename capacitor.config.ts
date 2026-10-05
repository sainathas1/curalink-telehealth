import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.curalink.admin',
  appName: 'CuraLink Admin',
  webDir: 'public',
  server: {
    url: 'https://curalink-telehealth.vercel.app/admin',
    cleartext: true,
  },
};

export default config;