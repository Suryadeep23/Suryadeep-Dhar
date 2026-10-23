import React, { useState, useEffect } from 'react';
import {
  Download,
  Monitor,
  Smartphone,
  Terminal,
  CheckCircle2,
  Copy,
  ExternalLink,
  ShieldCheck,
  X,
  Sparkles,
  ArrowRight,
  Laptop,
  QrCode,
  Share2,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Compass
} from 'lucide-react';
import QRCode from 'qrcode';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface InstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'mobile' | 'pwa' | 'windows' | 'mac-linux';
}

export const InstallModal: React.FC<InstallModalProps> = ({
  isOpen,
  onClose,
  initialTab,
}) => {
  const {
    isInstallable,
    isInstalled,
    isIOS,
    isAndroid,
    isMobile,
    isInAppBrowser,
    inAppBrowserName,
    install,
  } = usePWAInstall();

  const [activeTab, setActiveTab] = useState<'mobile' | 'pwa' | 'windows' | 'mac-linux'>(
    initialTab || (isMobile ? 'mobile' : 'mobile')
  );
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [mobileSubTab, setMobileSubTab] = useState<'android' | 'ios' | 'qr'>('android');
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);
  const [menuGuideHighlight, setMenuGuideHighlight] = useState(false);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    } else if (isMobile) {
      setActiveTab('mobile');
    }
  }, [initialTab, isMobile, isOpen]);

  useEffect(() => {
    if (isIOS) {
      setMobileSubTab('ios');
    } else if (isAndroid) {
      setMobileSubTab('android');
    }
  }, [isIOS, isAndroid]);

  // Generate QR code for mobile scanning
  useEffect(() => {
    if (isOpen) {
      const currentUrl = window.location.origin;
      QRCode.toDataURL(currentUrl, {
        width: 240,
        margin: 2,
        color: {
          dark: '#030712',
          light: '#f59e0b',
        },
      })
        .then((url) => setQrCodeUrl(url))
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePwaInstall = async () => {
    setInstalling(true);
    const success = await install();
    setInstalling(false);
    if (success) {
      setInstallSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } else {
      // If browser doesn't offer prompt or user dismissed, guide them to menu install
      setMenuGuideHighlight(true);
      setTimeout(() => setMenuGuideHighlight(false), 5000);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-2xl w-full p-5 sm:p-8 shadow-2xl text-slate-100 my-4 sm:my-6 relative animate-in fade-in zoom-in-95 duration-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 sm:top-5 sm:right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3.5 sm:gap-4 mb-5 sm:mb-6 pr-8 sm:pr-0">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-amber-500/20 to-blue-600/20 border border-amber-500/30 flex items-center justify-center shadow-lg p-2 shrink-0">
            <img
              src="/the_helping_squad_logo.svg"
              alt="The Helping Squad Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-2xl font-bold text-white tracking-tight truncate">
                Install Squad Vault App
              </h2>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <ShieldCheck className="w-3.5 h-3.5" /> Mobile & Desktop
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5 line-clamp-1 sm:line-clamp-none">
              Run standalone on Android, iPhone, iPad, Windows, or Mac with 400MB PDF streaming.
            </p>
          </div>
        </div>

        {/* In-App Browser Warning Banner */}
        {isInAppBrowser && (
          <div className="mb-4 sm:mb-5 bg-amber-950/60 border border-amber-500/40 rounded-xl p-3 sm:p-4 text-amber-200 text-xs sm:text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
            <div className="flex items-start gap-2.5 min-w-0">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-300">
                  Opened inside {inAppBrowserName} (In-App Browser)
                </p>
                <p className="text-xs text-amber-200/90 mt-0.5 leading-relaxed">
                  Apps like {inAppBrowserName} block direct PWA installation. Tap the <strong className="text-white">⋮ menu</strong> in the top-right corner and choose <strong className="text-white">"Open in Chrome"</strong> (or external browser) to install.
                </p>
              </div>
            </div>
            <button
              onClick={() => copyToClipboard(window.location.origin, 'in-app-url')}
              className="py-1.5 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shrink-0 transition cursor-pointer"
            >
              {copiedCmd === 'in-app-url' ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-slate-950" />
                  <span>Copied! Open in Chrome</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Link for Chrome</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Status Notification if already installed */}
        {isInstalled && (
          <div className="mb-5 bg-emerald-950/50 border border-emerald-500/30 rounded-xl p-3.5 sm:p-4 flex items-center gap-3 text-emerald-300">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div className="text-xs sm:text-sm">
              <span className="font-semibold text-emerald-200">App Running in Standalone Mode!</span> Squad Vault is installed and operating with offline caching & anti-leak protection.
            </div>
          </div>
        )}

        {/* Success toast after install prompt accepted */}
        {installSuccess && (
          <div className="mb-5 bg-emerald-900/60 border border-emerald-400 rounded-xl p-4 flex items-center gap-3 text-emerald-100 animate-in fade-in">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
            <div>
              <div className="font-bold text-white text-sm">Squad Vault Successfully Installed!</div>
              <div className="text-xs text-emerald-200 mt-0.5">
                The app icon is now on your home screen and app launcher.
              </div>
            </div>
          </div>
        )}

        {/* Main Installation Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 bg-slate-950/70 border border-slate-800 rounded-xl mb-5 text-xs sm:text-sm font-medium">
          <button
            onClick={() => setActiveTab('mobile')}
            className={`py-2 px-2.5 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
              activeTab === 'mobile'
                ? 'bg-amber-400 text-slate-950 font-bold shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Smartphone className="w-4 h-4 shrink-0" />
            <span>Mobile App</span>
          </button>
          <button
            onClick={() => setActiveTab('pwa')}
            className={`py-2 px-2.5 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
              activeTab === 'pwa'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Monitor className="w-4 h-4 shrink-0" />
            <span>Desktop (PWA)</span>
          </button>
          <button
            onClick={() => setActiveTab('windows')}
            className={`py-2 px-2.5 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
              activeTab === 'windows'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Laptop className="w-4 h-4 shrink-0" />
            <span>Windows (.bat)</span>
          </button>
          <button
            onClick={() => setActiveTab('mac-linux')}
            className={`py-2 px-2.5 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
              activeTab === 'mac-linux'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Terminal className="w-4 h-4 shrink-0" />
            <span>Mac & Linux</span>
          </button>
        </div>

        {/* TAB 1: DEDICATED MOBILE INSTALLER */}
        {activeTab === 'mobile' && (
          <div className="space-y-4">
            {/* Sub-platform Switcher (Android, iOS, QR Code) */}
            <div className="flex p-1 bg-slate-950/80 border border-slate-800/80 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setMobileSubTab('android')}
                className={`flex-1 py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  mobileSubTab === 'android'
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>🤖 Android</span>
              </button>
              <button
                onClick={() => setMobileSubTab('ios')}
                className={`flex-1 py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  mobileSubTab === 'ios'
                    ? 'bg-indigo-600 text-white font-bold shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>🍏 iPhone / iPad</span>
              </button>
              <button
                onClick={() => setMobileSubTab('qr')}
                className={`flex-1 py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  mobileSubTab === 'qr'
                    ? 'bg-amber-400 text-slate-950 font-bold shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Scan QR</span>
              </button>
            </div>

            {/* ANDROID VIEW */}
            {mobileSubTab === 'android' && (
              <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 sm:p-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-white text-base flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-emerald-400" />
                      Install on Android Phone or Tablet
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">
                      Installs as a native standalone app in your Android app drawer and home screen with zero browser address bar.
                    </p>
                  </div>
                </div>

                {/* Primary Install Trigger Button */}
                <div>
                  <button
                    onClick={handlePwaInstall}
                    disabled={installing}
                    className="w-full py-3.5 px-5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 font-black text-slate-950 shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer text-sm sm:text-base"
                  >
                    <Download className="w-5 h-5 text-slate-950 stroke-[2.5]" />
                    {installing
                      ? 'Opening Install Prompt...'
                      : isInstallable
                      ? 'Install Squad Vault on Android'
                      : 'Install / Add to Home Screen'}
                  </button>
                  <p className="text-[11px] text-slate-400 text-center mt-1.5">
                    {isInstallable
                      ? '✓ Browser install prompt ready — tap to install now'
                      : 'Tap button to trigger install prompt, or use the 2-step menu method below'}
                  </p>
                </div>

                {/* Highlighted Step-by-Step for Chrome & Mobile Browsers */}
                <div
                  className={`rounded-xl p-4 border transition-all ${
                    menuGuideHighlight
                      ? 'bg-amber-950/60 border-amber-400 ring-2 ring-amber-400/50'
                      : 'bg-slate-950/80 border-slate-800/90'
                  } space-y-2.5 text-xs sm:text-sm`}
                >
                  <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>How to Install via Mobile Browser Menu (100% Reliable):</span>
                  </div>

                  <div className="flex items-start gap-2.5 text-slate-200">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/25 text-emerald-400 font-black flex items-center justify-center shrink-0 text-xs">
                      1
                    </span>
                    <span>
                      In <strong className="text-white">Google Chrome</strong> (or Samsung Internet, Brave, Edge), tap the{' '}
                      <strong className="text-amber-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700">⋮ (three dots menu)</strong> in the top-right corner.
                    </span>
                  </div>

                  <div className="flex items-start gap-2.5 text-slate-200">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/25 text-emerald-400 font-black flex items-center justify-center shrink-0 text-xs">
                      2
                    </span>
                    <span>
                      Tap <strong className="text-emerald-300 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700">"Install app"</strong> or <strong className="text-emerald-300 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700">"Add to Home screen"</strong>.
                    </span>
                  </div>

                  <div className="flex items-start gap-2.5 text-slate-200">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/25 text-emerald-400 font-black flex items-center justify-center shrink-0 text-xs">
                      3
                    </span>
                    <span>
                      Tap <strong className="text-white">Install</strong>. Squad Vault is placed directly onto your home screen!
                    </span>
                  </div>
                </div>

                {/* Expandable Troubleshooting Guide */}
                <div className="border border-slate-800 rounded-xl bg-slate-950/50 overflow-hidden">
                  <button
                    onClick={() => setShowTroubleshooting(!showTroubleshooting)}
                    className="w-full p-3 flex items-center justify-between text-xs font-semibold text-slate-300 hover:text-white transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <HelpCircle className="w-4 h-4 text-amber-400" />
                      <span>Why is the app not installing? (Troubleshooting & Fixes)</span>
                    </div>
                    {showTroubleshooting ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </button>

                  {showTroubleshooting && (
                    <div className="p-3.5 pt-0 border-t border-slate-800/80 space-y-3 text-xs text-slate-300">
                      <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                        <div className="font-bold text-amber-300 flex items-center gap-1.5 mb-1">
                          <span>1. Are you using an In-App Browser?</span>
                        </div>
                        <p className="text-slate-400 leading-relaxed">
                          If you clicked the website link inside <strong>WhatsApp, Instagram, Facebook, TikTok, or Telegram</strong>, in-app webviews disable PWA installation. Tap the <strong>⋮</strong> menu in the upper corner of the in-app browser and tap <strong>"Open in Chrome"</strong> or copy the URL and open in Chrome.
                        </p>
                      </div>

                      <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                        <div className="font-bold text-amber-300 flex items-center gap-1.5 mb-1">
                          <span>2. Are you in Incognito / Private Mode?</span>
                        </div>
                        <p className="text-slate-400 leading-relaxed">
                          Chromium intentionally blocks PWA installation in Incognito tabs to protect private browsing. Open a regular standard tab in Google Chrome.
                        </p>
                      </div>

                      <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                        <div className="font-bold text-amber-300 flex items-center gap-1.5 mb-1">
                          <span>3. Is it already installed?</span>
                        </div>
                        <p className="text-slate-400 leading-relaxed">
                          Check your Android app drawer or home screen for <strong>"SquadVault"</strong> or <strong>"The Helping Squad"</strong>. If already installed, opening the site will show "App Running in Standalone Mode".
                        </p>
                      </div>

                      <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                        <div className="font-bold text-amber-300 flex items-center gap-1.5 mb-1">
                          <span>4. Recommended Android Browsers</span>
                        </div>
                        <p className="text-slate-400 leading-relaxed">
                          Best support is provided by Google Chrome, Samsung Internet, Microsoft Edge, and Brave.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Instant Standalone Backup */}
                <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                  <a
                    href="/squad-vault-mobile.html"
                    download="SquadVault-Mobile.html"
                    className="w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-semibold text-slate-200 flex items-center justify-center gap-2 transition"
                  >
                    <Download className="w-4 h-4 text-amber-400" />
                    <span>Download Standalone Mobile Launcher (.html)</span>
                  </a>

                  <button
                    onClick={() => copyToClipboard(window.location.origin, 'mobile-url-btn')}
                    className="w-full sm:w-auto py-2.5 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-semibold text-slate-200 flex items-center justify-center gap-1.5 transition shrink-0 cursor-pointer"
                  >
                    {copiedCmd === 'mobile-url-btn' ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>Link Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-slate-400" />
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* IOS VIEW */}
            {mobileSubTab === 'ios' && (
              <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 sm:p-5 space-y-4">
                <div>
                  <h3 className="font-bold text-white text-base flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-indigo-400" />
                    Install on iPhone or iPad (Safari)
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">
                    Adds Squad Vault directly to your iOS Home Screen with the official app icon and black-translucent status bar.
                  </p>
                </div>

                <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-xl p-4 text-xs sm:text-sm text-indigo-200 space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-indigo-500/30 text-indigo-300 font-black flex items-center justify-center shrink-0 text-xs">
                      1
                    </span>
                    <div>
                      <div className="font-semibold text-white">Tap the Share button in Safari</div>
                      <div className="text-slate-300 text-xs mt-0.5">
                        Look for the square icon with an arrow pointing up <span className="font-mono text-amber-300 font-bold">[ ⎋ ]</span> at the bottom of your iPhone screen (or top on iPad).
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-indigo-500/30 text-indigo-300 font-black flex items-center justify-center shrink-0 text-xs">
                      2
                    </span>
                    <div>
                      <div className="font-semibold text-white">Select "Add to Home Screen"</div>
                      <div className="text-slate-300 text-xs mt-0.5">
                        Scroll down the share menu options and tap the icon with a plus sign labelled <strong>"Add to Home Screen"</strong>.
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-indigo-500/30 text-indigo-300 font-black flex items-center justify-center shrink-0 text-xs">
                      3
                    </span>
                    <div>
                      <div className="font-semibold text-white">Tap "Add" in top-right corner</div>
                      <div className="text-slate-300 text-xs mt-0.5">
                        Confirm the name <strong>Squad Vault</strong> and tap Add. The app icon appears on your home screen ready to use!
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-center text-xs text-slate-400">
                  ⚡ Once added, the app opens full screen with zero Safari browser address bars.
                </div>
              </div>
            )}

            {/* QR CODE VIEW */}
            {mobileSubTab === 'qr' && (
              <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-5 text-center space-y-4">
                <div>
                  <h3 className="font-bold text-white text-base">
                    Scan with Your Phone Camera
                  </h3>
                  <p className="text-xs text-slate-300 mt-1">
                    Open your iPhone Camera or Android QR scanner to immediately open and install Squad Vault on your mobile device.
                  </p>
                </div>

                {qrCodeUrl ? (
                  <div className="flex justify-center p-3">
                    <div className="p-3 bg-white rounded-2xl shadow-xl inline-block">
                      <img src={qrCodeUrl} alt="Scan QR Code to install mobile app" className="w-48 h-48 object-contain" />
                    </div>
                  </div>
                ) : (
                  <div className="w-48 h-48 mx-auto bg-slate-950 flex items-center justify-center rounded-2xl text-slate-500 text-xs">
                    Generating QR Code...
                  </div>
                )}

                <div className="flex items-center justify-center gap-2 max-w-md mx-auto">
                  <input
                    type="text"
                    readOnly
                    value={window.location.origin}
                    className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono text-amber-300 select-all"
                  />
                  <button
                    onClick={() => copyToClipboard(window.location.origin, 'mobile-url')}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedCmd === 'mobile-url' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedCmd === 'mobile-url' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: 1-Click Desktop PWA */}
        {activeTab === 'pwa' && (
          <div className="space-y-4">
            <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 sm:p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-white text-base flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    Desktop Standalone Web App
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">
                    Installs directly to your Windows Taskbar or macOS Dock. Runs in a dedicated full-screen window with zero browser bars and full 400MB PDF streaming.
                  </p>
                </div>
              </div>

              {/* Install Action Button */}
              <div className="mt-5">
                <button
                  onClick={handlePwaInstall}
                  disabled={installing}
                  className="w-full py-3 px-5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 font-semibold text-white shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
                >
                  <Download className="w-5 h-5" />
                  {installing ? 'Installing...' : 'Install App to Desktop / Device'}
                </button>
                <p className="text-xs text-slate-400 text-center mt-2">
                  Tip: In Google Chrome or Microsoft Edge, you can also click the <strong>Install</strong> icon in the address bar.
                </p>
              </div>
            </div>

            {/* Benefits feature list */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-300">
              <div className="flex items-center gap-2 bg-slate-800/30 border border-slate-800 rounded-lg p-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Zero browser address bars or tabs</span>
              </div>
              <div className="flex items-center gap-2 bg-slate-800/30 border border-slate-800 rounded-lg p-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Instant launch from Windows Start or Mac Dock</span>
              </div>
              <div className="flex items-center gap-2 bg-slate-800/30 border border-slate-800 rounded-lg p-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Full 400 MB per-PDF streaming</span>
              </div>
              <div className="flex items-center gap-2 bg-slate-800/30 border border-slate-800 rounded-lg p-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Offline caching & quick reload</span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Windows Installer (.bat) */}
        {activeTab === 'windows' && (
          <div className="space-y-4">
            <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 sm:p-5 space-y-4">
              <div>
                <h3 className="font-semibold text-white text-base flex items-center gap-2">
                  <Laptop className="w-4 h-4 text-blue-400" />
                  Windows Standalone Desktop Setup
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 mt-1">
                  Automated Windows installer script (<code className="text-amber-300">install-windows.bat</code>) that sets up the vault, generates a Windows Desktop shortcut icon, and launches the app.
                </p>
              </div>

              {/* Download .bat button */}
              <a
                href="/install-windows.bat"
                download="install-windows.bat"
                className="w-full py-3 px-5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 font-semibold text-white shadow-lg flex items-center justify-center gap-2 transition"
              >
                <Download className="w-5 h-5" />
                Download Windows Installer (install-windows.bat)
              </a>

              {/* 3 Step Instructions */}
              <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800/80 space-y-2 text-xs sm:text-sm">
                <div className="font-semibold text-slate-200">How to run on Windows:</div>
                <div className="flex items-start gap-2.5 text-slate-300">
                  <span className="w-5 h-5 rounded-full bg-blue-600/30 text-blue-400 font-bold flex items-center justify-center shrink-0 text-xs">1</span>
                  <span>Download <strong className="text-white">install-windows.bat</strong> into your project or app folder.</span>
                </div>
                <div className="flex items-start gap-2.5 text-slate-300">
                  <span className="w-5 h-5 rounded-full bg-blue-600/30 text-blue-400 font-bold flex items-center justify-center shrink-0 text-xs">2</span>
                  <span>Double-click the file to run. It installs dependencies and creates a desktop shortcut.</span>
                </div>
                <div className="flex items-start gap-2.5 text-slate-300">
                  <span className="w-5 h-5 rounded-full bg-blue-600/30 text-blue-400 font-bold flex items-center justify-center shrink-0 text-xs">3</span>
                  <span>Double-click the new <strong>The Helping Squad Vault</strong> icon on your Desktop anytime!</span>
                </div>
              </div>

              {/* Terminal command */}
              <div>
                <label className="text-xs text-slate-400 block mb-1.5 font-medium">
                  Alternative: Run via Command Prompt / PowerShell
                </label>
                <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg p-2.5">
                  <code className="text-xs text-amber-400 font-mono flex-1 overflow-x-auto whitespace-nowrap">
                    cmd /c install-windows.bat
                  </code>
                  <button
                    onClick={() => copyToClipboard('cmd /c install-windows.bat', 'win')}
                    className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition cursor-pointer"
                    title="Copy command"
                  >
                    {copiedCmd === 'win' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: macOS & Linux (.sh) */}
        {activeTab === 'mac-linux' && (
          <div className="space-y-4">
            <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 sm:p-5 space-y-4">
              <div>
                <h3 className="font-semibold text-white text-base flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  macOS & Linux One-Click Installer
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 mt-1">
                  Shell script (<code className="text-amber-300">install-mac-linux.sh</code>) that configures the app, sets permissions, and creates a desktop launcher on macOS or Linux.
                </p>
              </div>

              {/* Download .sh button */}
              <a
                href="/install-mac-linux.sh"
                download="install-mac-linux.sh"
                className="w-full py-3 px-5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 font-semibold text-white shadow-lg flex items-center justify-center gap-2 transition"
              >
                <Download className="w-5 h-5" />
                Download Mac & Linux Installer (install-mac-linux.sh)
              </a>

              {/* 3 Step Instructions */}
              <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800/80 space-y-2 text-xs sm:text-sm">
                <div className="font-semibold text-slate-200">Terminal Quick Start:</div>
                <div className="flex items-start gap-2.5 text-slate-300">
                  <span className="w-5 h-5 rounded-full bg-emerald-600/30 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-xs">1</span>
                  <span>Open your Terminal in the app folder.</span>
                </div>
                <div className="flex items-start gap-2.5 text-slate-300">
                  <span className="w-5 h-5 rounded-full bg-emerald-600/30 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-xs">2</span>
                  <span>Run: <code className="text-amber-300">bash install-mac-linux.sh</code></span>
                </div>
                <div className="flex items-start gap-2.5 text-slate-300">
                  <span className="w-5 h-5 rounded-full bg-emerald-600/30 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-xs">3</span>
                  <span>A launcher icon is placed on your Desktop for 1-click startup!</span>
                </div>
              </div>

              {/* Terminal command */}
              <div>
                <label className="text-xs text-slate-400 block mb-1.5 font-medium">
                  Copy Terminal Command
                </label>
                <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg p-2.5">
                  <code className="text-xs text-amber-400 font-mono flex-1 overflow-x-auto whitespace-nowrap">
                    chmod +x install-mac-linux.sh && ./install-mac-linux.sh
                  </code>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        'chmod +x install-mac-linux.sh && ./install-mac-linux.sh',
                        'mac'
                      )
                    }
                    className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition cursor-pointer"
                    title="Copy command"
                  >
                    {copiedCmd === 'mac' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="mt-5 sm:mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Mobile App • 400 MB per-PDF Ready</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition font-medium cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
