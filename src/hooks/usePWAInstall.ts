import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() => {
    if (typeof window !== 'undefined' && (window as any).__deferredPrompt) {
      return (window as any).__deferredPrompt as BeforeInstallPromptEvent;
    }
    return null;
  });
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isInAppBrowser, setIsInAppBrowser] = useState(false);
  const [inAppBrowserName, setInAppBrowserName] = useState<string>('');

  useEffect(() => {
    // Detect standalone mode (already installed on desktop or mobile)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    // Detect mobile platforms
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    const isAndroidDevice = /android/.test(userAgent);
    setIsIOS(isIOSDevice);
    setIsAndroid(isAndroidDevice);
    setIsMobile(isIOSDevice || isAndroidDevice || /mobile|silk|kindle/.test(userAgent));

    // Detect In-App Browsers (WebView) such as WhatsApp, Instagram, Facebook, TikTok, Snapchat, Telegram
    let inAppName = '';
    if (/fbav|fban|messenger/i.test(userAgent)) inAppName = 'Facebook';
    else if (/instagram/i.test(userAgent)) inAppName = 'Instagram';
    else if (/whatsapp/i.test(userAgent)) inAppName = 'WhatsApp';
    else if (/snapchat/i.test(userAgent)) inAppName = 'Snapchat';
    else if (/telegram/i.test(userAgent)) inAppName = 'Telegram';
    else if (/tiktok/i.test(userAgent)) inAppName = 'TikTok';
    else if (/wv|webview/i.test(userAgent)) inAppName = 'In-App Browser';

    if (inAppName) {
      setIsInAppBrowser(true);
      setInAppBrowserName(inAppName);
    }

    // Check if early listener in index.html already caught the prompt
    if ((window as any).__deferredPrompt) {
      setDeferredPrompt((window as any).__deferredPrompt as BeforeInstallPromptEvent);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      (window as any).__deferredPrompt = e;
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      (window as any).__deferredPrompt = null;
      setDeferredPrompt(null);
    };

    const handleCustomPromptAvailable = () => {
      if ((window as any).__deferredPrompt) {
        setDeferredPrompt((window as any).__deferredPrompt as BeforeInstallPromptEvent);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('pwa-prompt-available', handleCustomPromptAvailable);
    window.addEventListener('pwa-installed', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('pwa-prompt-available', handleCustomPromptAvailable);
      window.removeEventListener('pwa-installed', handleAppInstalled);
    };
  }, []);

  const install = async (): Promise<boolean> => {
    const promptEvent = deferredPrompt || (typeof window !== 'undefined' ? (window as any).__deferredPrompt : null);
    if (!promptEvent) {
      console.info('No beforeinstallprompt event captured. Browser may require menu installation.');
      return false;
    }
    try {
      await promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
        if (typeof window !== 'undefined') {
          (window as any).__deferredPrompt = null;
        }
        return true;
      }
      return false;
    } catch (err) {
      console.warn('Install prompt error:', err);
      return false;
    }
  };

  return {
    isInstallable: !!deferredPrompt || (typeof window !== 'undefined' && !!(window as any).__deferredPrompt),
    isInstalled,
    isIOS,
    isAndroid,
    isMobile,
    isInAppBrowser,
    inAppBrowserName,
    install,
  };
}
