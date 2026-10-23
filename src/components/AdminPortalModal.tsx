import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  UserPlus,
  Users,
  Upload,
  Copy,
  Check,
  Sparkles,
  Trash2,
  Mail,
  Phone,
  KeyRound,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Lock,
  ArrowRight,
  ShieldAlert,
  Edit2,
  RefreshCw,
  LogIn,
  Settings,
  Sliders,
  SlidersHorizontal,
  Power,
  FileText,
  Save,
  RotateCcw,
  Shield,
  Clock,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import { TheHelpingSquadLogo } from './TheHelpingSquadLogo';
import { adminService } from '../services/adminService';
import { settingsService } from '../services/settingsService';
import { authService, DEMO_ACCOUNTS } from '../services/authService';
import { AdminMember, AddAdminRequest, AuthUser, LoginAuditEntry } from '../types/auth';
import { SquadPortalSettings, DEFAULT_PORTAL_SETTINGS } from '../types/settings';
import { DocumentRecord } from '../types/document';

interface AdminPortalModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: AuthUser | null;
  onSwitchUser?: (user: AuthUser) => void;
  onOpenUpload?: () => void;
  documents?: DocumentRecord[];
  onToggleActive?: (docId: string, currentActive: boolean) => Promise<void>;
  onDeleteDocument?: (docId: string) => Promise<void>;
  onSettingsClick?: (doc: DocumentRecord) => void;
  initialTab?: 'friends' | 'settings' | 'documents' | 'audit';
}

export const AdminPortalModal: React.FC<AdminPortalModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSwitchUser,
  onOpenUpload,
  documents = [],
  onToggleActive,
  onDeleteDocument,
  onSettingsClick,
  initialTab = 'friends',
}) => {
  const isAdmin = Boolean(currentUser?.role === 'admin' || currentUser?.isOwner);

  const [activeTab, setActiveTab] = useState<'friends' | 'settings' | 'documents' | 'audit'>(initialTab);
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // 3 Friends Persistent Configuration State (persists draft to localStorage so it never disappears)
  const [friend1Name, setFriend1Name] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('squad_vault_admin_friends_draft') || '{}');
      return saved.friend1Name ?? '';
    } catch {
      return '';
    }
  });
  const [friend1Id, setFriend1Id] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('squad_vault_admin_friends_draft') || '{}');
      return saved.friend1Id ?? '';
    } catch {
      return '';
    }
  });
  const [friend1Password, setFriend1Password] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('squad_vault_admin_friends_draft') || '{}');
      return saved.friend1Password || 'password123';
    } catch {
      return 'password123';
    }
  });

  const [friend2Name, setFriend2Name] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('squad_vault_admin_friends_draft') || '{}');
      return saved.friend2Name ?? '';
    } catch {
      return '';
    }
  });
  const [friend2Id, setFriend2Id] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('squad_vault_admin_friends_draft') || '{}');
      return saved.friend2Id ?? '';
    } catch {
      return '';
    }
  });
  const [friend2Password, setFriend2Password] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('squad_vault_admin_friends_draft') || '{}');
      return saved.friend2Password || 'password123';
    } catch {
      return 'password123';
    }
  });

  const [friend3Name, setFriend3Name] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('squad_vault_admin_friends_draft') || '{}');
      return saved.friend3Name ?? '';
    } catch {
      return '';
    }
  });
  const [friend3Id, setFriend3Id] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('squad_vault_admin_friends_draft') || '{}');
      return saved.friend3Id ?? '';
    } catch {
      return '';
    }
  });
  const [friend3Password, setFriend3Password] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('squad_vault_admin_friends_draft') || '{}');
      return saved.friend3Password || 'password123';
    } catch {
      return 'password123';
    }
  });

  // Save draft helper so entered friend details never disappear
  const saveFriendsToLocalStorage = (overrides?: Record<string, string>) => {
    try {
      const current = {
        friend1Name,
        friend1Id,
        friend1Password,
        friend2Name,
        friend2Id,
        friend2Password,
        friend3Name,
        friend3Id,
        friend3Password,
        ...overrides,
      };
      localStorage.setItem('squad_vault_admin_friends_draft', JSON.stringify(current));
    } catch {}
  };

  const [saving3Friends, setSaving3Friends] = useState(false);

  // Add individual custom admin state
  const [showAddForm, setShowAddForm] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customId, setCustomId] = useState('');
  const [customIdType, setCustomIdType] = useState<'gmail' | 'phone'>('gmail');
  const [customPassword, setCustomPassword] = useState('password123');
  const [customCanUpload, setCustomCanUpload] = useState(true);
  const [customNote, setCustomNote] = useState('');
  const [submittingCustom, setSubmittingCustom] = useState(false);

  // Portal & Security Settings State (Managed ONLY by Admin)
  const [portalSettings, setPortalSettings] = useState<SquadPortalSettings>(DEFAULT_PORTAL_SETTINGS);
  const [savingSettings, setSavingSettings] = useState(false);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<LoginAuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Load members and settings
  const fetchData = async () => {
    setLoading(true);
    try {
      const [membersData, settingsData] = await Promise.all([
        adminService.getMembers(),
        settingsService.getSettings(),
      ]);

      setMembers(membersData.members || []);
      setPortalSettings(settingsData);

      // Check if user has an active custom draft in localStorage so we never wipe out what they typed
      let hasCustomDraft = false;
      try {
        const rawDraft = localStorage.getItem('squad_vault_admin_friends_draft');
        if (rawDraft) {
          const draft = JSON.parse(rawDraft);
          const isCustom = (val?: string) =>
            Boolean(
              val &&
              !val.startsWith('Friend ') &&
              !val.includes('.friend') &&
              val !== 'Test Friend One' &&
              val !== 'Test Friend Two' &&
              val !== 'Test Friend Three' &&
              val !== 'test1@gmail.com' &&
              val !== 'test2@gmail.com' &&
              val !== 'test3@gmail.com'
            );
          if (
            isCustom(draft.friend1Name) ||
            isCustom(draft.friend1Id) ||
            isCustom(draft.friend2Name) ||
            isCustom(draft.friend2Id) ||
            isCustom(draft.friend3Name) ||
            isCustom(draft.friend3Id)
          ) {
            hasCustomDraft = true;
          }
        }
      } catch {}

      if (!hasCustomDraft) {
        const nonOwners = (membersData.members || []).filter((m) => !m.isOwner);
        const f1 = membersData.members.find((m) => m.id === 'adm_friend_1') || nonOwners[0];
        const f2 = membersData.members.find((m) => m.id === 'adm_friend_2') || nonOwners[1];
        const f3 = membersData.members.find((m) => m.id === 'adm_friend_3') || nonOwners[2];

        if (f1) {
          setFriend1Name(f1.name);
          setFriend1Id(f1.identifier);
          if (f1.password) setFriend1Password(f1.password);
        }
        if (f2) {
          setFriend2Name(f2.name);
          setFriend2Id(f2.identifier);
          if (f2.password) setFriend2Password(f2.password);
        }
        if (f3) {
          setFriend3Name(f3.name);
          setFriend3Id(f3.identifier);
          if (f3.password) setFriend3Password(f3.password);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    setAuditLoading(true);
    try {
      const data = await authService.getLoginLogs();
      setAuditLogs(data.logs || []);
    } finally {
      setAuditLoading(false);
    }
  };

  // Only run fetchData on modal open, NEVER on tab switch so typed inputs are never wiped out!
  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  // Load audit logs only when audit tab is selected
  useEffect(() => {
    if (isOpen && activeTab === 'audit') {
      fetchAuditLogs();
    }
  }, [isOpen, activeTab]);

  if (!isOpen || !isAdmin) return null;

  const showNotification = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  // Save 3 Friends Batch (or any number of entered friends)
  const handleSave3Friends = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving3Friends(true);
    try {
      const candidates = [
        {
          slotId: 'adm_friend_1',
          name: friend1Name.trim(),
          identifier: friend1Id.trim(),
          identifierType: (friend1Id.includes('@') ? 'gmail' : 'phone') as 'gmail' | 'phone',
          password: friend1Password || 'password123',
          note: 'Friend 1 • Authorized PDF Uploader',
        },
        {
          slotId: 'adm_friend_2',
          name: friend2Name.trim(),
          identifier: friend2Id.trim(),
          identifierType: (friend2Id.includes('@') ? 'gmail' : 'phone') as 'gmail' | 'phone',
          password: friend2Password || 'password123',
          note: 'Friend 2 • Authorized PDF Uploader',
        },
        {
          slotId: 'adm_friend_3',
          name: friend3Name.trim(),
          identifier: friend3Id.trim(),
          identifierType: (friend3Id.includes('@') ? 'gmail' : 'phone') as 'gmail' | 'phone',
          password: friend3Password || 'password123',
          note: 'Friend 3 • Authorized PDF Uploader',
        },
      ];

      const validFriends = candidates.filter((f) => f.name && f.identifier);
      if (validFriends.length === 0) {
        showNotification('Please enter at least one friend with a Name and Gmail ID / Phone Number.');
        setSaving3Friends(false);
        return;
      }

      const updated = await adminService.quickSetup3Friends(validFriends);
      setMembers(updated);
      saveFriendsToLocalStorage();
      showNotification(`✓ Saved ${validFriends.length} friend admin(s)! They can now log in and upload PDFs.`);
    } catch (err: any) {
      showNotification(err.message || 'Error saving friends');
    } finally {
      setSaving3Friends(false);
    }
  };

  // Save an individual friend directly
  const handleSaveSingleFriend = async (slotNum: 1 | 2 | 3) => {
    const friendData =
      slotNum === 1
        ? { slotId: 'adm_friend_1', name: friend1Name.trim(), identifier: friend1Id.trim(), password: friend1Password || 'password123' }
        : slotNum === 2
        ? { slotId: 'adm_friend_2', name: friend2Name.trim(), identifier: friend2Id.trim(), password: friend2Password || 'password123' }
        : { slotId: 'adm_friend_3', name: friend3Name.trim(), identifier: friend3Id.trim(), password: friend3Password || 'password123' };

    if (!friendData.name || !friendData.identifier) {
      showNotification(`Please enter Friend ${slotNum}'s Full Name and Gmail ID or Phone.`);
      return;
    }

    try {
      const updated = await adminService.quickSetup3Friends([
        {
          ...friendData,
          identifierType: friendData.identifier.includes('@') ? 'gmail' : 'phone',
          note: `Friend ${slotNum} • Authorized PDF Uploader`,
        },
      ]);
      setMembers(updated);
      saveFriendsToLocalStorage();
      showNotification(`✓ Saved Friend ${slotNum} (${friendData.name}) with PDF upload rights!`);
    } catch (err: any) {
      showNotification(err.message || 'Failed to save friend');
    }
  };

  // Copy 3 friends invite text
  const handleCopy3FriendsInvite = () => {
    const inviteText = `🌟 The Helping Squad - Admin Portal Invite 🌟
You have been granted full Squad Admin access with PDF Upload rights.

🔑 Admin 1: ${friend1Name}
Login: ${friend1Id}
Password: ${friend1Password}

🔑 Admin 2: ${friend2Name}
Login: ${friend2Id}
Password: ${friend2Password}

🔑 Admin 3: ${friend3Name}
Login: ${friend3Id}
Password: ${friend3Password}

Portal Link: ${window.location.origin}${window.location.pathname}
Sign in with your Gmail ID or Phone Number to upload, manage links, and share view-only PDFs!`;

    navigator.clipboard.writeText(inviteText);
    setCopiedText('3friends');
    setTimeout(() => setCopiedText(null), 2500);
    showNotification('Copied 3 Friends login credentials to clipboard!');
  };

  // Add individual custom admin
  const handleAddCustomAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim() || !customId.trim()) return;

    setSubmittingCustom(true);
    try {
      const added = await adminService.addMember({
        name: customName.trim(),
        identifier: customId.trim(),
        identifierType: customIdType,
        password: customPassword || 'password123',
        role: 'admin',
        canUpload: customCanUpload,
        note: customNote.trim() || 'Co-Admin • PDF Uploader',
      });

      setMembers((prev) => [...prev.filter((m) => m.id !== added.id), added]);
      setShowAddForm(false);
      setCustomName('');
      setCustomId('');
      setCustomNote('');
      showNotification(`Added ${added.name} as Admin with PDF upload rights!`);
    } catch (err: any) {
      showNotification(err.message || 'Failed to add admin');
    } finally {
      setSubmittingCustom(false);
    }
  };

  // Toggle upload permission
  const handleToggleUpload = async (member: AdminMember) => {
    try {
      const updated = await adminService.updateMember(member.id, {
        canUpload: !member.canUpload,
      });
      setMembers((prev) => prev.map((m) => (m.id === member.id ? updated : m)));
      showNotification(
        `${member.name} PDF upload permission is now ${updated.canUpload ? 'ALLOWED' : 'DISABLED'}.`
      );
    } catch (err: any) {
      showNotification(err.message || 'Failed to update permission');
    }
  };

  // Remove admin
  const handleRemoveMember = async (member: AdminMember) => {
    if (member.isOwner) {
      showNotification('The primary Lead Admin cannot be removed.');
      return;
    }
    await adminService.removeMember(member.id);
    setMembers((prev) => prev.filter((m) => m.id !== member.id));
    showNotification(`Removed ${member.name} from Admins.`);
  };

  // Test Login As This Admin
  const handleTestLoginAs = (member: AdminMember) => {
    if (onSwitchUser) {
      const user: AuthUser = {
        id: member.id,
        name: member.name,
        identifier: member.identifier,
        identifierType: member.identifierType,
        email: member.email,
        phone: member.phone,
        role: member.role,
        canUpload: member.canUpload,
        isOwner: Boolean(member.isOwner),
        avatarColor: member.role === 'admin' ? '#f59e0b' : '#0284c7',
        lastLoginAt: new Date().toISOString(),
      };
      onSwitchUser(user);
      onClose();
    }
  };

  // Save Global Portal Settings (Admin Only)
  const handleSavePortalSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      showNotification('Admin Permission Required: Only administrators can modify global portal settings.');
      return;
    }
    setSavingSettings(true);
    try {
      const updated = await settingsService.updateSettings(
        portalSettings,
        currentUser?.name || 'Squad Admin'
      );
      setPortalSettings(updated);
      showNotification('Success: All portal and security settings saved by Admin!');
    } catch (err: any) {
      showNotification(err.message || 'Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  // Reset settings to default
  const handleResetSettings = async () => {
    const def = await settingsService.resetToDefaults(currentUser?.name);
    setPortalSettings(def);
    showNotification('Settings reset to squad defaults.');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-5xl w-full p-5 sm:p-7 shadow-2xl text-slate-100 max-h-[94vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-1 rounded-2xl bg-amber-400/10 border border-amber-400/30 shrink-0">
              <TheHelpingSquadLogo size={46} className="drop-shadow" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black text-[11px] uppercase tracking-wider bg-gradient-to-r from-amber-400 to-orange-400 text-slate-950 px-2.5 py-0.5 rounded-full shadow-sm">
                  The Helping Squad
                </span>
                <span className="text-xs text-amber-300 font-bold bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                  Admin Portal • Manage All Settings
                </span>
                <span className="text-[10px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-full">
                  Admin Only
                </span>
              </div>
              <h2 className="text-xl font-black text-white mt-1 tracking-tight">
                Squad Command Center & Settings Hub
              </h2>
              <p className="text-xs text-slate-400">
                Manage 3 friend admins, PDF upload rights, security watermarks, passcode policies, and access controls.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Success Toast */}
        {successToast && (
          <div className="my-3 p-3 bg-emerald-500/15 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex items-center gap-2.5 animate-fadeIn shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successToast}</span>
          </div>
        )}

        {/* NON-ADMIN ACCESS BLOCK SCREEN */}
        {!isAdmin ? (
          <div className="flex-1 overflow-y-auto py-10 px-4 text-center space-y-6">
            <div className="w-16 h-16 rounded-3xl bg-rose-500/10 border-2 border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto shadow-xl">
              <Lock className="w-8 h-8" />
            </div>
            <div className="max-w-md mx-auto space-y-2">
              <h3 className="text-lg font-black text-white">Squad Admin Authorization Required</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                All settings, security policies, 3-friend invitations, and document controls are managed <strong>only by Squad Admins</strong>.
              </p>
              <p className="text-[11px] text-slate-400">
                You are currently signed in as <strong>{currentUser?.name || 'Guest'}</strong> ({currentUser?.role || 'Guest'}).
              </p>
            </div>

            <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-2xl max-w-lg mx-auto text-left space-y-3">
              <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                <span>Switch to Authorized Squad Admin:</span>
              </div>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    const lead = DEMO_ACCOUNTS[0];
                    if (onSwitchUser) {
                      onSwitchUser({
                        id: 'adm_lead',
                        name: lead.name,
                        identifier: lead.identifier,
                        identifierType: 'gmail',
                        email: lead.identifier,
                        role: 'admin',
                        canUpload: true,
                        isOwner: true,
                        avatarColor: '#f59e0b',
                        lastLoginAt: new Date().toISOString(),
                      });
                    }
                  }}
                  className="w-full p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-xl flex items-center justify-between text-xs transition cursor-pointer text-left"
                >
                  <div>
                    <span className="font-bold text-white block">Suryadeep Dhar</span>
                    <span className="text-[11px] text-amber-400 font-mono">dharsuryadeep@gmail.com • Lead Admin</span>
                  </div>
                  <span className="px-2.5 py-1 bg-amber-400 text-slate-950 rounded-lg font-bold text-[10px]">
                    Sign In
                  </span>
                </button>

                {members.filter((m) => !m.isOwner).slice(0, 3).map((friend) => (
                  <button
                    key={friend.id}
                    type="button"
                    onClick={() => handleTestLoginAs(friend)}
                    className="w-full p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-xl flex items-center justify-between text-xs transition cursor-pointer text-left"
                  >
                    <div>
                      <span className="font-bold text-white block">{friend.name}</span>
                      <span className="text-[11px] text-slate-400 font-mono">{friend.identifier} • Co-Admin</span>
                    </div>
                    <span className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg font-bold text-[10px]">
                      Sign In
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition cursor-pointer"
            >
              Return to Reader
            </button>
          </div>
        ) : (
          <>
            {/* TABS NAVIGATION */}
            <div className="flex items-center gap-2 border-b border-slate-800 pt-3 pb-2 shrink-0 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab('friends')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'friends'
                    ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>1. 3 Friends & Admins ({members.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'settings'
                    ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>2. Manage All Settings</span>
                <span className="text-[9px] bg-slate-950/70 text-amber-300 px-1.5 py-0.5 rounded-full uppercase">
                  Admin Only
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('documents')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'documents'
                    ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>3. Document Links ({documents.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('audit');
                  fetchAuditLogs();
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'audit'
                    ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>4. Login Audit Directory</span>
              </button>
            </div>

            {/* TAB CONTENT */}
            <div className="flex-1 overflow-y-auto space-y-6 pr-1 pt-4">
              {/* TAB 1: 3 FRIENDS & ADMINS */}
              {activeTab === 'friends' && (
                <>
                  {/* 3-FRIEND ADMIN QUICK SETUP SLOTS */}
                  <div className="bg-gradient-to-br from-indigo-950/60 via-slate-900 to-amber-950/40 border-2 border-amber-500/40 rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="p-1 rounded-lg bg-amber-400/20 text-amber-400">
                            <UserPlus className="w-4 h-4" />
                          </span>
                          <h3 className="text-base font-extrabold text-white">
                            Quick Setup: Add 3 Friends As Admins
                          </h3>
                          <span className="text-[10px] uppercase font-black bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full">
                            Can Upload PDFs
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-1">
                          Configure your 3 friends below. Each friend will have full Admin rights to upload and share PDFs.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleCopy3FriendsInvite}
                          className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-sm"
                          title="Copy login details for all 3 friends"
                        >
                          {copiedText === '3friends' ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy 3 Friends Logins</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* 3 Friend Cards Grid */}
                    <form onSubmit={handleSave3Friends} className="mt-4 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* FRIEND 1 */}
                        <div className="p-4 bg-slate-950/80 border border-amber-500/30 rounded-2xl space-y-3 relative flex flex-col justify-between">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 font-black text-xs flex items-center justify-center">
                                1
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <Upload className="w-2.5 h-2.5" /> PDF Uploader
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleSaveSingleFriend(1)}
                                  className="text-[10px] bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold px-2 py-0.5 rounded-lg transition cursor-pointer"
                                  title="Save Friend 1 only"
                                >
                                  Save #1
                                </button>
                              </div>
                            </div>

                            <div>
                              <label className="text-[11px] font-semibold text-slate-300">Friend 1 Full Name</label>
                              <input
                                type="text"
                                value={friend1Name}
                                onChange={(e) => {
                                  setFriend1Name(e.target.value);
                                  saveFriendsToLocalStorage({ friend1Name: e.target.value });
                                }}
                                placeholder="e.g. Alex Rivera"
                                className="w-full mt-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
                              />
                            </div>

                            <div>
                              <label className="text-[11px] font-semibold text-slate-300">Gmail ID or Phone Number</label>
                              <div className="relative mt-1">
                                <input
                                  type="text"
                                  value={friend1Id}
                                  onChange={(e) => {
                                    setFriend1Id(e.target.value);
                                    saveFriendsToLocalStorage({ friend1Id: e.target.value });
                                  }}
                                  placeholder="name@gmail.com or +1 (555)..."
                                  className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono text-amber-300 focus:outline-none focus:border-amber-400"
                                />
                                <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                              </div>
                            </div>

                            <div>
                              <label className="text-[11px] font-semibold text-slate-300">Password</label>
                              <div className="relative mt-1">
                                <input
                                  type="text"
                                  value={friend1Password}
                                  onChange={(e) => {
                                    setFriend1Password(e.target.value);
                                    saveFriendsToLocalStorage({ friend1Password: e.target.value });
                                  }}
                                  placeholder="password123"
                                  className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-400"
                                />
                                <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* FRIEND 2 */}
                        <div className="p-4 bg-slate-950/80 border border-amber-500/30 rounded-2xl space-y-3 relative flex flex-col justify-between">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 font-black text-xs flex items-center justify-center">
                                2
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <Upload className="w-2.5 h-2.5" /> PDF Uploader
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleSaveSingleFriend(2)}
                                  className="text-[10px] bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold px-2 py-0.5 rounded-lg transition cursor-pointer"
                                  title="Save Friend 2 only"
                                >
                                  Save #2
                                </button>
                              </div>
                            </div>

                            <div>
                              <label className="text-[11px] font-semibold text-slate-300">Friend 2 Full Name</label>
                              <input
                                type="text"
                                value={friend2Name}
                                onChange={(e) => {
                                  setFriend2Name(e.target.value);
                                  saveFriendsToLocalStorage({ friend2Name: e.target.value });
                                }}
                                placeholder="e.g. Priya Patel"
                                className="w-full mt-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
                              />
                            </div>

                            <div>
                              <label className="text-[11px] font-semibold text-slate-300">Gmail ID or Phone Number</label>
                              <div className="relative mt-1">
                                <input
                                  type="text"
                                  value={friend2Id}
                                  onChange={(e) => {
                                    setFriend2Id(e.target.value);
                                    saveFriendsToLocalStorage({ friend2Id: e.target.value });
                                  }}
                                  placeholder="name@gmail.com or +1 (555)..."
                                  className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono text-amber-300 focus:outline-none focus:border-amber-400"
                                />
                                <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                              </div>
                            </div>

                            <div>
                              <label className="text-[11px] font-semibold text-slate-300">Password</label>
                              <div className="relative mt-1">
                                <input
                                  type="text"
                                  value={friend2Password}
                                  onChange={(e) => {
                                    setFriend2Password(e.target.value);
                                    saveFriendsToLocalStorage({ friend2Password: e.target.value });
                                  }}
                                  placeholder="password123"
                                  className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-400"
                                />
                                <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* FRIEND 3 */}
                        <div className="p-4 bg-slate-950/80 border border-amber-500/30 rounded-2xl space-y-3 relative flex flex-col justify-between">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 font-black text-xs flex items-center justify-center">
                                3
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <Upload className="w-2.5 h-2.5" /> PDF Uploader
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleSaveSingleFriend(3)}
                                  className="text-[10px] bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold px-2 py-0.5 rounded-lg transition cursor-pointer"
                                  title="Save Friend 3 only"
                                >
                                  Save #3
                                </button>
                              </div>
                            </div>

                            <div>
                              <label className="text-[11px] font-semibold text-slate-300">Friend 3 Full Name</label>
                              <input
                                type="text"
                                value={friend3Name}
                                onChange={(e) => {
                                  setFriend3Name(e.target.value);
                                  saveFriendsToLocalStorage({ friend3Name: e.target.value });
                                }}
                                placeholder="e.g. Sam Taylor"
                                className="w-full mt-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
                              />
                            </div>

                            <div>
                              <label className="text-[11px] font-semibold text-slate-300">Gmail ID or Phone Number</label>
                              <div className="relative mt-1">
                                <input
                                  type="text"
                                  value={friend3Id}
                                  onChange={(e) => {
                                    setFriend3Id(e.target.value);
                                    saveFriendsToLocalStorage({ friend3Id: e.target.value });
                                  }}
                                  placeholder="+1 (555) 345-9876 or name@gmail.com"
                                  className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono text-amber-300 focus:outline-none focus:border-amber-400"
                                />
                                <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                              </div>
                            </div>

                            <div>
                              <label className="text-[11px] font-semibold text-slate-300">Password</label>
                              <div className="relative mt-1">
                                <input
                                  type="text"
                                  value={friend3Password}
                                  onChange={(e) => {
                                    setFriend3Password(e.target.value);
                                    saveFriendsToLocalStorage({ friend3Password: e.target.value });
                                  }}
                                  placeholder="password123"
                                  className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-400"
                                />
                                <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                        <div className="text-[11px] text-slate-400">
                          ⚡ Any configured friend can immediately sign in with their Gmail / Phone and password to upload PDFs.
                        </div>
                        <button
                          type="submit"
                          disabled={saving3Friends}
                          className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black rounded-xl text-xs transition cursor-pointer flex items-center gap-2 shadow-lg shadow-amber-500/20"
                        >
                          <Save className="w-4 h-4 text-slate-950" />
                          <span>{saving3Friends ? 'Saving Friends...' : 'Save Friends as Admins'}</span>
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* CUSTOM ADMIN FORM TOGGLE */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white">All Squad Admins & Uploaders</h4>
                      <p className="text-xs text-slate-400">
                        Total Admins: <strong className="text-white">{members.filter((m) => m.role === 'admin').length}</strong> • Authorized Uploaders: <strong className="text-emerald-400">{members.filter((m) => m.canUpload).length}</strong>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAddForm(!showAddForm)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
                    >
                      <UserPlus className="w-3.5 h-3.5 text-amber-400" />
                      <span>{showAddForm ? 'Cancel Form' : 'Add Another Admin'}</span>
                    </button>
                  </div>

                  {/* ADD CUSTOM ADMIN FORM */}
                  {showAddForm && (
                    <form onSubmit={handleAddCustomAdmin} className="p-4 bg-slate-950/90 border border-slate-800 rounded-2xl space-y-3 animate-fadeIn">
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <UserPlus className="w-3.5 h-3.5 text-amber-400" />
                        <span>Add Custom Admin or Field Officer</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div>
                          <label className="text-[11px] text-slate-400 block mb-1">Full Name</label>
                          <input
                            type="text"
                            value={customName}
                            onChange={(e) => setCustomName(e.target.value)}
                            placeholder="e.g. Jordan Blake"
                            className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                            required
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-400 block mb-1">Gmail or Phone</label>
                          <input
                            type="text"
                            value={customId}
                            onChange={(e) => {
                              setCustomId(e.target.value);
                              setCustomIdType(e.target.value.includes('@') ? 'gmail' : 'phone');
                            }}
                            placeholder="jordan@gmail.com"
                            className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono text-amber-300"
                            required
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-400 block mb-1">Password</label>
                          <input
                            type="text"
                            value={customPassword}
                            onChange={(e) => setCustomPassword(e.target.value)}
                            placeholder="password123"
                            className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-400 block mb-1">Role / Note</label>
                          <input
                            type="text"
                            value={customNote}
                            onChange={(e) => setCustomNote(e.target.value)}
                            placeholder="e.g. Field Coordinator"
                            className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2">
                        <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={customCanUpload}
                            onChange={(e) => setCustomCanUpload(e.target.checked)}
                            className="accent-emerald-500"
                          />
                          <span>Grant PDF Upload Rights</span>
                        </label>
                        <button
                          type="submit"
                          disabled={submittingCustom}
                          className="px-4 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-xl text-xs transition cursor-pointer"
                        >
                          {submittingCustom ? 'Adding...' : 'Add Admin Member'}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* ADMINS LIST TABLE */}
                  <div className="space-y-2">
                    {members.map((admin) => (
                      <div
                        key={admin.id}
                        className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-slate-700 transition"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-slate-950 font-black text-sm flex items-center justify-center shrink-0">
                            {admin.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-white text-xs">{admin.name}</span>
                              {admin.isOwner && (
                                <span className="text-[9px] font-black uppercase bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full">
                                  Lead Admin & Owner
                                </span>
                              )}
                              <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                                {admin.role.toUpperCase()}
                              </span>
                              {admin.canUpload ? (
                                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <Upload className="w-2.5 h-2.5" /> Can Upload PDFs
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
                                  Upload Disabled
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-xs text-slate-400 font-mono flex-wrap">
                              <span className="text-amber-300 font-medium">{admin.identifier}</span>
                              {admin.password && (
                                <span className="text-[11px] text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                                  pwd: {admin.password}
                                </span>
                              )}
                              {admin.note && <span className="text-slate-400 font-sans italic text-[11px]">• {admin.note}</span>}
                            </div>
                          </div>
                        </div>

                        {/* Controls */}
                        <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                          <button
                            type="button"
                            onClick={() => handleToggleUpload(admin)}
                            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer flex items-center gap-1.5 ${
                              admin.canUpload
                                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25'
                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                            }`}
                            title="Toggle PDF upload permission"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>{admin.canUpload ? 'Upload Allowed' : 'Enable Upload'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const info = `The Helping Squad Login:\nEmail/Phone: ${admin.identifier}\nPassword: ${admin.password || 'password123'}\nPortal: ${window.location.origin}`;
                              navigator.clipboard.writeText(info);
                              showNotification(`Copied login for ${admin.name}!`);
                            }}
                            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition cursor-pointer"
                            title="Copy credentials"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>

                          {onSwitchUser && (
                            <button
                              type="button"
                              onClick={() => handleTestLoginAs(admin)}
                              className="px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold transition cursor-pointer flex items-center gap-1"
                              title="Switch session to this admin"
                            >
                              <LogIn className="w-3.5 h-3.5 text-amber-400" />
                              <span className="hidden sm:inline">Test Login</span>
                            </button>
                          )}

                          {!admin.isOwner && (
                            <button
                              type="button"
                              onClick={() => handleRemoveMember(admin)}
                              className="p-2 rounded-xl bg-slate-900 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-800 transition cursor-pointer"
                              title="Remove admin"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* TAB 2: MANAGE ALL SETTINGS (ADMIN ONLY) */}
              {activeTab === 'settings' && (
                <form onSubmit={handleSavePortalSettings} className="space-y-5 animate-fadeIn">
                  <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start gap-3">
                    <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                        Squad Global Settings & Security Policies
                      </h4>
                      <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                        These settings are managed <strong>exclusively by Squad Administrators</strong>. Any changes configured here apply to newly generated links, watermark overlays, viewer authentication requirements, and PDF upload boundaries.
                      </p>
                    </div>
                  </div>

                  {/* Watermark Settings */}
                  <div className="p-5 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                      <div className="flex items-center gap-2">
                        <Eye className="w-4 h-4 text-amber-400" />
                        <h4 className="text-xs font-bold text-white">1. Forensic Watermarking Settings</h4>
                      </div>
                      <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                        Live Anti-Leak Protection
                      </span>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-300 block mb-1">
                        Default Watermark Text
                      </label>
                      <input
                        type="text"
                        value={portalSettings.defaultWatermarkText}
                        onChange={(e) => setPortalSettings({ ...portalSettings, defaultWatermarkText: e.target.value })}
                        className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
                        required
                      />
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] text-slate-400">Presets:</span>
                        {['THE HELPING SQUAD • VIEW ONLY', 'CONFIDENTIAL • SQUAD VAULT', 'RESTRICTED • DO NOT DISTRIBUTE'].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setPortalSettings({ ...portalSettings, defaultWatermarkText: preset })}
                            className="text-[10px] bg-slate-900 hover:bg-slate-800 text-slate-300 px-2 py-0.5 rounded-lg border border-slate-800 transition cursor-pointer"
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                      <div>
                        <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
                          <span>Watermark Opacity</span>
                          <span className="font-mono text-amber-400 font-bold">
                            {(portalSettings.defaultWatermarkOpacity * 100).toFixed(0)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0.10"
                          max="0.50"
                          step="0.02"
                          value={portalSettings.defaultWatermarkOpacity}
                          onChange={(e) => setPortalSettings({ ...portalSettings, defaultWatermarkOpacity: parseFloat(e.target.value) })}
                          className="w-full accent-amber-400"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={portalSettings.showForensicAuditInfo}
                            onChange={(e) => setPortalSettings({ ...portalSettings, showForensicAuditInfo: e.target.checked })}
                            className="accent-amber-400"
                          />
                          <span>Embed dynamic viewer email & timestamp in watermark</span>
                        </label>
                        <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={portalSettings.antiScreenBlur}
                            onChange={(e) => setPortalSettings({ ...portalSettings, antiScreenBlur: e.target.checked })}
                            className="accent-amber-400"
                          />
                          <span>Anti-Screen Blur on window focus loss / screenshots</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Access & Upload Boundaries */}
                  <div className="p-5 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-indigo-400" />
                        <h4 className="text-xs font-bold text-white">2. Access Policies & Upload Rules</h4>
                      </div>
                      <span className="text-[10px] text-amber-300 font-mono bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                        Admin Enforced
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
                        <label className="flex items-center justify-between cursor-pointer">
                          <span className="text-xs font-semibold text-white">Enforce Admin-Only PDF Uploads</span>
                          <input
                            type="checkbox"
                            checked={portalSettings.enforceAdminOnlyUploads}
                            onChange={(e) => setPortalSettings({ ...portalSettings, enforceAdminOnlyUploads: e.target.checked })}
                            className="accent-indigo-500"
                          />
                        </label>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          When checked, only admins with explicitly granted upload rights can upload PDFs.
                        </p>
                      </div>

                      <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
                        <label className="flex items-center justify-between cursor-pointer">
                          <span className="text-xs font-semibold text-white">Block Printing & Save Shortcuts</span>
                          <input
                            type="checkbox"
                            checked={portalSettings.blockPrintingAndSave}
                            onChange={(e) => setPortalSettings({ ...portalSettings, blockPrintingAndSave: e.target.checked })}
                            className="accent-indigo-500"
                          />
                        </label>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          Intercepts Ctrl+P, Print Screen, and file download commands across all viewer links.
                        </p>
                      </div>

                      <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
                        <label className="flex items-center justify-between cursor-pointer">
                          <span className="text-xs font-semibold text-white">Require Recipient Email by Default</span>
                          <input
                            type="checkbox"
                            checked={portalSettings.requireEmailDefault}
                            onChange={(e) => setPortalSettings({ ...portalSettings, requireEmailDefault: e.target.checked })}
                            className="accent-indigo-500"
                          />
                        </label>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          Recipients opening any link must submit their email address to read the PDF.
                        </p>
                      </div>

                      <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
                        <label className="flex items-center justify-between cursor-pointer">
                          <span className="text-xs font-semibold text-white">Allow Public / Guest Readers</span>
                          <input
                            type="checkbox"
                            checked={portalSettings.allowGuestsToView}
                            onChange={(e) => setPortalSettings({ ...portalSettings, allowGuestsToView: e.target.checked })}
                            className="accent-indigo-500"
                          />
                        </label>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          Enables recipients with the link to open view-only reader without needing portal accounts.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div className="pt-2 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={handleResetSettings}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition cursor-pointer flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset to Defaults</span>
                    </button>

                    <button
                      type="submit"
                      disabled={savingSettings}
                      className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black rounded-xl text-xs transition cursor-pointer flex items-center gap-2 shadow-lg shadow-amber-500/20"
                    >
                      <Save className="w-4 h-4 text-slate-950" />
                      <span>{savingSettings ? 'Saving All Settings...' : 'Save All Admin Settings'}</span>
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 3: DOCUMENT LINKS MANAGEMENT */}
              {activeTab === 'documents' && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white">All Active & Revoked Links</h4>
                      <p className="text-xs text-slate-400">
                        Admin killswitch controls: instantly revoke, reactivate, or delete any document link.
                      </p>
                    </div>
                    {onOpenUpload && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenUpload();
                        }}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload New Link</span>
                      </button>
                    )}
                  </div>

                  <div className="space-y-2.5">
                    {documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-700 transition"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${doc.isActive ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                            <h5 className="font-bold text-white text-xs line-clamp-1">{doc.title}</h5>
                            {doc.files && doc.files.length > 1 && (
                              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded font-mono">
                                {doc.files.length} PDFs
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-1">
                            <span>{doc.pageCount} Pages</span>
                            <span>•</span>
                            <span>{doc.viewsCount || 0} Views</span>
                            <span>•</span>
                            <span className={doc.isActive ? 'text-emerald-400 font-medium' : 'text-rose-400 font-medium'}>
                              {doc.isActive ? 'Active Link' : 'Revoked Link'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          {onToggleActive && (
                            <button
                              type="button"
                              onClick={() => onToggleActive(doc.id, doc.isActive)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer flex items-center gap-1.5 ${
                                doc.isActive
                                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                                  : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                              }`}
                            >
                              <Power className="w-3.5 h-3.5" />
                              <span>{doc.isActive ? 'Revoke Link' : 'Reactivate'}</span>
                            </button>
                          )}

                          {onSettingsClick && (
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                onSettingsClick(doc);
                              }}
                              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition cursor-pointer"
                              title="Edit link settings"
                            >
                              <Settings className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {onDeleteDocument && (
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteDocument(doc.id);
                                showNotification(`Deleted "${doc.title}".`);
                              }}
                              className="p-2 rounded-xl bg-slate-900 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-800 transition cursor-pointer"
                              title="Delete link"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 4: LOGIN AUDIT DIRECTORY */}
              {activeTab === 'audit' && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white">Login Audit Directory</h4>
                      <p className="text-xs text-slate-400">
                        Tracks names, Gmail IDs, and phone numbers of everyone accessing the portal.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          const csv = auditLogs.map((l) => `${l.name},${l.email || l.identifier},${l.role},${l.timestamp}`).join('\n');
                          const blob = new Blob([`Name,Identifier,Role,Timestamp\n${csv}`], { type: 'text/csv' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `squad_login_audit_${new Date().toISOString().slice(0, 10)}.csv`;
                          a.click();
                        }}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Export CSV</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {auditLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 font-bold text-xs flex items-center justify-center">
                            {log.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-white">{log.name}</div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              {log.identifier} • {log.role}
                            </div>
                          </div>
                        </div>

                        <div className="text-right text-[11px] text-slate-400">
                          <div>{new Date(log.timestamp).toLocaleString()}</div>
                          <div className="text-[10px] text-slate-500">{log.userAgent}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Footer */}
        <div className="pt-4 mt-2 border-t border-slate-800 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-400">
            Active User: <strong className="text-white">{currentUser?.name || 'Suryadeep Dhar'}</strong> ({currentUser?.role || 'admin'})
            {isAdmin && <span className="ml-2 text-emerald-400 font-semibold">• Settings Management Authorized</span>}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
