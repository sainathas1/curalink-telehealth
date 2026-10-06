import { App, BackButtonListenerEvent } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';

export interface NativeBridgeConfig {
  onBackPress?: () => boolean | void; // Return true to prevent default back behavior
  statusBarColor?: string;
}

let isBridgeInitialized = false;

/**
 * Configure and make the Android top status bar dark.
 * Sets the background to a dark color and style to Dark (so icons are light).
 */
export async function configureDarkStatusBar(color: string = '#0f172a'): Promise<void> {
  if (!Capacitor.isPluginAvailable('StatusBar')) {
    return;
  }

  try {
    // Style.Dark sets light text/icons suitable for dark backgrounds
    await StatusBar.setStyle({ style: Style.Dark });
    
    // Set background color on Android
    if (Capacitor.getPlatform() === 'android') {
      await StatusBar.setBackgroundColor({ color });
      await StatusBar.setOverlaysWebView({ overlay: false });
    }
  } catch (err) {
    console.warn('[NativeBridge] StatusBar configuration notice:', err);
  }
}

/**
 * Listen for the Android hardware back button and handle navigation.
 */
export function setupHardwareBackButton(
  customHandler?: (event: BackButtonListenerEvent) => boolean | void
): () => void {
  if (!Capacitor.isPluginAvailable('App')) {
    return () => {};
  }

  try {
    const handleListener = App.addListener('backButton', (event: BackButtonListenerEvent) => {
      // If a custom handler handled the back action (e.g., closing an open modal)
      if (customHandler) {
        const handled = customHandler(event);
        if (handled) return;
      }

      // Default Android behavior: go back in browser history if possible, else exit app
      if (event.canGoBack && typeof window !== 'undefined' && window.history.length > 1) {
        window.history.back();
      } else {
        App.exitApp();
      }
    });

    return () => {
      handleListener.then((listener) => listener.remove()).catch(() => {});
    };
  } catch (err) {
    console.warn('[NativeBridge] Hardware back button listener notice:', err);
    return () => {};
  }
}

/**
 * Initialize the full native bridge:
 * - Makes the Android top status bar dark
 * - Listens for the hardware back button
 */
export function initNativeBridge(config?: NativeBridgeConfig): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  // 1. Setup dark status bar
  configureDarkStatusBar(config?.statusBarColor || '#0f172a');

  // 2. Setup hardware back button listener
  const cleanupBackButton = setupHardwareBackButton((event) => {
    if (config?.onBackPress) {
      return config.onBackPress();
    }
  });

  isBridgeInitialized = true;

  return () => {
    cleanupBackButton();
  };
}

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

export { App, StatusBar, Style };

const nativeBridge = {
  configureDarkStatusBar,
  setupHardwareBackButton,
  initNativeBridge,
  isNativePlatform,
};

export default nativeBridge;
