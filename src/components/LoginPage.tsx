import React, { useState, useEffect } from 'react';
import {
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  User,
  KeyRound,
  X,
  Globe,
} from 'lucide-react';
import { TheHelpingSquadLogo } from './TheHelpingSquadLogo';
import { authService, DEMO_ACCOUNTS } from '../services/authService';
import { adminService } from '../services/adminService';
import { AuthUser, AdminMember } from '../types/auth';

interface LoginPageProps {
  onLoginSuccess: (user: AuthUser) => void;
  onContinueAsGuest?: () => void;
}

const COUNTRY_CODES = [
  { code: '+1', country: 'US/CA', flag: '🇺🇸' },
  { code: '+91', country: 'IN', flag: '🇮🇳' },
  { code: '+44', country: 'UK', flag: '🇬🇧' },
  { code: '+61', country: 'AU', flag: '🇦🇺' },
  { code: '+81', country: 'JP', flag: '🇯🇵' },
  { code: '+49', country: 'DE', flag: '🇩🇪' },
  { code: '+33', country: 'FR', flag: '🇫🇷' },
  { code: '+971', country: 'UAE', flag: '🇦🇪' },
  { code: '+65', country: 'SG', flag: '🇸🇬' },
];

export const LoginPage: React.FC<LoginPageProps> = ({
  onLoginSuccess,
}) => {
  const [hasAccountOnDevice, setHasAccountOnDevice] = useState<boolean>(() =>
    authService.hasCreatedAccount()
  );

  // Mode: First-time visitors start on 'signup' (Create Account); returning visitors start on 'signin'
  const [mode, setMode] = useState<'signin' | 'signup'>(() =>
    authService.hasCreatedAccount() ? 'signin' : 'signup'
  );

  // Identifier type: 'gmail' or 'phone'
  const [identifierType, setIdentifierType] = useState<'gmail' | 'phone'>('gmail');

  // Form Fields
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [countryCode, setCountryCode] = useState('+1');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  // Status
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [justRegisteredName, setJustRegisteredName] = useState<string | null>(null);

  // Dedicated Admin Login Modal states (Bottom Admin Login option)
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [adminIdentifier, setAdminIdentifier] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminShowPassword, setAdminShowPassword] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminSuccess, setAdminSuccess] = useState<string | null>(null);

  // Forgot password modal
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotStatus, setForgotStatus] = useState<string | null>(null);
  const [forgotSubmitting, setForgotSubmitting] = useState(false);

  // Admin Members Registry
  const [, setAdminList] = useState<AdminMember[]>(() => adminService.getLocalMembers());

  useEffect(() => {
    authService.syncRegisteredUsersWithServer().catch(() => {});
    adminService.getMembers().then((res) => {
      if (res.members && res.members.length > 0) {
        setAdminList(res.members);
      }
    }).catch(() => {});
  }, []);

  // Handle Form Submit for Regular / General Users
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setErrorCode(null);
    setSuccessMsg(null);

    const cleanPass = password.trim();
    if (!cleanPass) {
      setError('Please enter your account password.');
      return;
    }

    if (mode === 'signup') {
      if (cleanPass.length < 6) {
        setError('Password must be at least 6 characters long.');
        return;
      }
      if (confirmPassword.trim() && confirmPassword.trim() !== cleanPass) {
        setError('Passwords do not match. Please confirm your password.');
        return;
      }
    }

    setLoading(true);

    try {
      if (mode === 'signin') {
        const res = await authService.login({
          identifier: identifier.trim(),
          password: cleanPass,
          identifierType,
          countryCode: identifierType === 'phone' ? countryCode : undefined,
          rememberMe,
        });

        if (!res.success || !res.user) {
          setError(res.error || 'Login failed. Please verify your credentials and password.');
          setErrorCode(res.code || null);
        } else {
          setSuccessMsg(`Welcome back, ${res.user.name}! Signing you in...`);
          setTimeout(() => {
            onLoginSuccess(res.user!);
          }, 350);
        }
      } else {
        // Step 1: Create Account -> Then switch to Sign In so they can sign in with their credentials
        const res = await authService.register({
          name: name.trim(),
          identifier: identifier.trim(),
          password: cleanPass,
          identifierType,
          countryCode: identifierType === 'phone' ? countryCode : undefined,
          role: 'volunteer',
        });

        if (!res.success || !res.user) {
          setError(res.error || 'Registration failed.');
          setErrorCode(res.code || null);
        } else {
          setHasAccountOnDevice(true);
          setJustRegisteredName(res.user.name);
          setMode('signin');
          setPassword('');
          setConfirmPassword('');
          setSuccessMsg(
            `Account created successfully for ${res.user.name}! Please enter your password below to sign in using your credentials.`
          );
        }
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  // Dedicated Admin Login submission handler - strictly verifies admin status
  const handleAdminLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError(null);
    setAdminSuccess(null);

    const cleanId = adminIdentifier.trim();
    const cleanPass = adminPassword.trim();

    if (!cleanId || !cleanPass) {
      setAdminError('Administrator identifier and password are both required.');
      return;
    }

    setAdminLoading(true);

    try {
      const res = await authService.adminLogin({
        identifier: cleanId,
        password: cleanPass,
        identifierType: cleanId.includes('@') ? 'gmail' : 'phone',
        rememberMe: true,
      });

      if (!res.success || !res.user) {
        setAdminError(
          res.error ||
            'Access Denied: Regular users must not open the Administrator Portal. Only verified administrators can access.'
        );
      } else {
        setAdminSuccess(`Access Authorized: Welcome, ${res.user.name} (Squad Administrator)`);
        setTimeout(() => {
          setAdminModalOpen(false);
          onLoginSuccess(res.user!);
        }, 450);
      }
    } catch (err: any) {
      setAdminError(err.message || 'Access Denied: Regular users cannot open the Administrator Portal.');
    } finally {
      setAdminLoading(false);
    }
  };

  // Submit password reset
  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotIdentifier.trim()) return;

    setForgotSubmitting(true);
    try {
      const res = await authService.requestPasswordReset(forgotIdentifier);
      setForgotStatus(res.message);
      setTimeout(() => {
        setForgotModalOpen(false);
        setForgotStatus(null);
      }, 3500);
    } finally {
      setForgotSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between relative overflow-hidden select-none">
      {/* Background radial glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-b from-amber-500/15 via-orange-500/5 to-transparent blur-3xl pointer-events-none" />

      {/* Top mini header */}
      <header className="p-4 sm:p-6 max-w-7xl mx-auto w-full flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="p-0.5 rounded-full bg-amber-400/10 border border-amber-400/30">
            <TheHelpingSquadLogo size={42} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-white text-base tracking-tight">The Helping Squad</span>
              <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded-full">
                Portal
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Secure Document Management & Sharing</p>
          </div>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="max-w-md w-full mx-auto px-4 py-6 sm:py-8 z-10 flex-1 flex flex-col justify-center">
        <div className="bg-slate-900/90 backdrop-blur-xl border-2 border-slate-800 rounded-3xl p-5 sm:p-8 shadow-2xl shadow-amber-950/20">
          {/* Logo & Headline */}
          <div className="text-center mb-5">
            <div className="inline-block p-1.5 rounded-full bg-amber-400/10 border border-amber-400/30 mb-3 shadow-inner">
              <TheHelpingSquadLogo size={66} className="drop-shadow-lg" />
            </div>

            <div className="flex items-center justify-center gap-2 mb-1.5">
              <span className="text-[10px] font-black tracking-widest uppercase bg-gradient-to-r from-amber-400 to-orange-400 text-slate-950 px-3 py-0.5 rounded-full shadow-sm">
                ★ THE HELPING SQUAD ★
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {mode === 'signup' ? 'Create Your Squad Account' : 'Sign In to Document Vault'}
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              {mode === 'signup'
                ? 'First-time visitors: create an account below before signing in'
                : 'Sign in using your registered Gmail ID or Phone number'}
            </p>
          </div>

          {/* Step / First-Time Visitor Guidance Banner */}
          {!hasAccountOnDevice && mode === 'signup' && (
            <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-bold text-amber-300">First-Time Visitor?</span> Create your account first (Step 1). Right after creating your account, you can sign in using your credentials (Step 2).
              </div>
            </div>
          )}

          {justRegisteredName && mode === 'signin' && (
            <div className="mb-4 p-3 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-200 text-xs flex items-start gap-2.5">
              <KeyRound className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-bold text-white">Step 2 of 2: Sign In</span> — Your account for{' '}
                <span className="font-semibold text-amber-300">{justRegisteredName}</span> is ready. Enter your password below to sign in.
              </div>
            </div>
          )}

          {/* Mode Switcher: Create Account vs Sign In */}
          <div className="grid grid-cols-2 p-1 bg-slate-950 border border-slate-800 rounded-xl mb-5">
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError(null);
                setErrorCode(null);
                setSuccessMsg(null);
              }}
              className={`py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
                mode === 'signup'
                  ? 'bg-amber-400 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              1. Create Account
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setError(null);
                setErrorCode(null);
              }}
              className={`py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
                mode === 'signin'
                  ? 'bg-amber-400 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              2. Sign In
            </button>
          </div>

          {/* Identifier Toggle: Gmail ID vs Phone Number */}
          <div className="mb-4">
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2">
              {mode === 'signup' ? 'Choose Account Credential Type' : 'Choose Sign-In Method'}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setIdentifierType('gmail');
                  setIdentifier('');
                  setError(null);
                  setErrorCode(null);
                }}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                  identifierType === 'gmail'
                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 shadow-sm shadow-indigo-500/20'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <Mail className="w-4 h-4 text-rose-400" />
                <span>Gmail ID</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIdentifierType('phone');
                  setIdentifier('');
                  setError(null);
                  setErrorCode(null);
                }}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                  identifierType === 'phone'
                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 shadow-sm shadow-indigo-500/20'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <Phone className="w-4 h-4 text-emerald-400" />
                <span>Phone Number</span>
              </button>
            </div>
          </div>

          {/* Error & Success alerts */}
          {error && (
            <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl text-xs space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <span className="leading-relaxed">{error}</span>
              </div>
              {errorCode === 'ACCOUNT_NOT_FOUND' && mode === 'signin' && (
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setError(null);
                    setErrorCode(null);
                  }}
                  className="w-full py-2 px-3 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>Create an Account First</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
              {errorCode === 'ALREADY_EXISTS' && mode === 'signup' && (
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setError(null);
                    setErrorCode(null);
                  }}
                  className="w-full py-2 px-3 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>Proceed to Sign In</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
              <span className="leading-relaxed">{successMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* If Sign Up mode, ask for full name */}
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Full Name <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your full name"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>
            )}

            {/* Identifier Field: Gmail ID or Phone Number */}
            {identifierType === 'gmail' ? (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-rose-400" />
                    <span>Gmail ID / Email Address</span>
                    <span className="text-rose-400">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (!identifier.includes('@') && identifier.trim()) {
                        setIdentifier((prev) => `${prev.trim()}@gmail.com`);
                      }
                    }}
                    className="text-[10px] text-amber-400 hover:text-amber-300 font-mono cursor-pointer"
                  >
                    + @gmail.com
                  </button>
                </div>

                <div className="relative">
                  <input
                    type="email"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="yourname@gmail.com"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Phone Number <span className="text-rose-400">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="py-2.5 px-2 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-400 shrink-0"
                  >
                    {COUNTRY_CODES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.code}
                      </option>
                    ))}
                  </select>
                  <div className="relative flex-1">
                    <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      required
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="(555) 019-2834"
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400 font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Password Field - Mandatory for all users */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>{mode === 'signup' ? 'Create Password (min. 6 chars)' : 'Password'}</span>
                  <span className="text-rose-400">*</span>
                </label>
                {mode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => {
                      setForgotIdentifier(identifier);
                      setForgotModalOpen(true);
                    }}
                    className="text-[11px] text-amber-400 hover:text-amber-300 font-medium cursor-pointer"
                  >
                    Forgot password?
                  </button>
                )}
              </div>

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'signup' ? 'Create a strong password' : 'Enter your account password'}
                  className="w-full pl-3.5 pr-10 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1 cursor-pointer"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password in Signup Mode */}
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Confirm Password</span>
                  <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your password"
                    className="w-full pl-3.5 pr-10 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 text-slate-950 font-black rounded-xl text-sm transition shadow-lg shadow-amber-500/20 cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>{mode === 'signup' ? 'Creating Account...' : 'Verifying Credentials...'}</span>
                </>
              ) : (
                <>
                  <span>{mode === 'signup' ? 'Create Account & Continue to Sign In' : 'Sign In with Credentials'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* Quick toggle prompt below submit */}
            <div className="text-center pt-1">
              {mode === 'signup' ? (
                <p className="text-xs text-slate-400">
                  Already created an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signin');
                      setError(null);
                      setErrorCode(null);
                    }}
                    className="text-amber-400 hover:text-amber-300 font-bold underline cursor-pointer"
                  >
                    Sign in here
                  </button>
                </p>
              ) : (
                <p className="text-xs text-slate-400">
                  First-time visitor?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signup');
                      setError(null);
                      setErrorCode(null);
                      setSuccessMsg(null);
                    }}
                    className="text-amber-400 hover:text-amber-300 font-bold underline cursor-pointer"
                  >
                    Create an account first
                  </button>
                </p>
              )}
            </div>
          </form>

          {/* Admin Login Option at Bottom (Only admins can access, regular users cannot open) */}
          <div className="mt-6 pt-5 border-t border-slate-800">
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-slate-950 to-orange-500/10 border-2 border-amber-500/30 text-center space-y-2.5">
              <div className="flex items-center justify-center gap-1.5 text-amber-300 text-xs font-black uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span>Squad Administrator Login</span>
                <span className="text-[9px] bg-amber-400/20 border border-amber-400/40 text-amber-300 px-2 py-0.5 rounded-full font-bold">
                  Admins Only
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed max-w-xs mx-auto">
                Dedicated portal for designated administrators. Regular members must not attempt to access this area.
              </p>
              <button
                type="button"
                onClick={() => {
                  setAdminModalOpen(true);
                  setAdminError(null);
                  setAdminSuccess(null);
                  setAdminIdentifier('');
                  setAdminPassword('');
                }}
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800/90 text-amber-300 hover:text-amber-200 border border-amber-500/50 hover:border-amber-400 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center justify-center gap-2 shadow-sm"
              >
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Squad Admin Login Portal →</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-4 text-center text-xs text-slate-500 border-t border-slate-900 z-10">
        <span>The Helping Squad • Secure Multi-PDF Sharing • Zero-Download Guarantee</span>
      </footer>

      {/* Forgot Password Modal */}
      {forgotModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Reset Password</h3>
              </div>
              <button
                onClick={() => setForgotModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {forgotStatus ? (
              <div className="my-5 p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-xl text-xs flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{forgotStatus}</span>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} className="mt-4 space-y-4">
                <p className="text-xs text-slate-400 leading-relaxed">
                  Enter your registered Gmail address or phone number. We will send a secure password reset link or SMS PIN.
                </p>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Gmail ID or Phone Number
                  </label>
                  <input
                    type="text"
                    required
                    value={forgotIdentifier}
                    onChange={(e) => setForgotIdentifier(e.target.value)}
                    placeholder="dharsuryadeep@gmail.com"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setForgotModalOpen(false)}
                    className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={forgotSubmitting}
                    className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition cursor-pointer disabled:opacity-50"
                  >
                    {forgotSubmitting ? 'Sending...' : 'Send Reset Link'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Restricted Admin Login Modal (Strict: Regular users cannot open) */}
      {adminModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-amber-500/50 rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl text-slate-100 shadow-amber-950/40">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-1 rounded-xl bg-amber-400/10 border border-amber-400/30 text-amber-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Administrator Portal Sign-In</h3>
                  <span className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider">
                    Restricted Access • Admins Only
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAdminModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-200/90 leading-relaxed flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                <strong>Warning:</strong> This portal is strictly restricted to designated Squad Admins. Regular squad users are not authorized and cannot open it.
              </span>
            </div>

            {adminError && (
              <div className="mb-4 p-3 bg-rose-500/15 border border-rose-500/40 text-rose-300 rounded-xl text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{adminError}</span>
              </div>
            )}

            {adminSuccess && (
              <div className="mb-4 p-3 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{adminSuccess}</span>
              </div>
            )}

            <form onSubmit={handleAdminLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-amber-400" />
                  <span>Admin Gmail ID or Phone</span>
                  <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={adminIdentifier}
                  onChange={(e) => setAdminIdentifier(e.target.value)}
                  placeholder="e.g. dharsuryadeep@gmail.com"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Admin Password</span>
                  <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type={adminShowPassword ? 'text' : 'password'}
                    required
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Enter administrator password"
                    className="w-full pl-3.5 pr-10 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="button"
                    onClick={() => setAdminShowPassword(!adminShowPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1 cursor-pointer"
                  >
                    {adminShowPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAdminModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adminLoading}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-black transition cursor-pointer disabled:opacity-50 shadow-md shadow-amber-500/20 flex items-center justify-center gap-1.5"
                >
                  {adminLoading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4 text-slate-950" />
                      <span>Admin Sign-In</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
