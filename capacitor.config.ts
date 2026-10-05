import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.curalink.app',
  appName: 'CuraLink',
  webDir: 'public',
  server: {
    url: 'https://curalink-telehealth.vercel.app', // This links directly to your live site
    cleartext: true
  }
};

export default config;