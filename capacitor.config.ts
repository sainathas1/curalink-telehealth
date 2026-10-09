import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.curalink.app', // Your main app identifier
  appName: 'CuraLink',       // The name patients will see
  webDir: 'public',
  server: {
    url: 'https://curalink-telehealth.vercel.app', // Your main patient dashboard
    cleartext: true
  },
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '173041146452-qdgf347ljf2vkvksqq7erb7dui3gs3oi.apps.googleusercontent.com',
      forceCodeForRefreshToken: true
    }
  }
};

export default config;