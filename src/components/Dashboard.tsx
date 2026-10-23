import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ShieldAlert,
  Upload,
  Download,
  Sparkles,
  Search,
  Filter,
  Share2,
  Eye,
  Activity,
  Settings,
  Lock,
  Mail,
  Clock,
  CheckCircle2,
  FileText,
  AlertTriangle,
  ChevronRight,
  ShieldCheck,
  Power,
  Copy,
  Check,
  Trash2,
  Layers,
  LogOut,
  User,
  Users,
  Folder,
  FolderOpen,
  FolderPlus,
  FolderArchive,
  Plus,
  BookOpen,
  Smartphone,
  X,
} from 'lucide-react';
import { DocumentRecord } from '../types/document';
import { documentService, getLocalFoldersSync } from '../services/documentService';
import { TheHelpingSquadLogo } from './TheHelpingSquadLogo';
import { AuthUser } from '../types/auth';
import { LoginAuditModal } from './LoginAuditModal';
import { AdminPortalModal } from './AdminPortalModal';
import { InstallModal } from './InstallModal';
import { extractAccuratePageCount } from './UploadModal';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface DashboardProps {
  documents: DocumentRecord[];
  onUploadClick: () => void;
  onSeedSampleClick: () => void;
  onBundleAllClick?: () => void;
  onShareClick: (doc: DocumentRecord) => void;
  onAnalyticsClick: (doc: DocumentRecord) => void;
  onSettingsClick: (doc: DocumentRecord) => void;
  onPreviewClick: (docId: string) => void;
  onToggleActive: (docId: string, currentActive: boolean) => Promise<void>;
  onDeleteDocument: (docId: string) => Promise<void>;
  onDeleteFile?: (docId: string, fileId: string) => Promise<void>;
  currentUser?: AuthUser | null;
  onLogout?: () => void;
  onOpenLogin?: () => void;
  onSwitchUser?: (user: AuthUser) => void;
  onReloadDocuments?: () => Promise<void>;
  loading: boolean;
  selectedFolder?: string;
  onSelectFolder?: (folder: string) => void;
  recentUploadToast?: string | null;
}

const DEFAULT_FOLDERS = [
  'Official Handbooks',
  'Squad Manuals & Guides',
  'Operational Reports',
  'Confidential Packets',
  'General PDFs',
];

export const Dashboard: React.FC<DashboardProps> = ({
  documents,
  onUploadClick,
  onSeedSampleClick,
  onBundleAllClick,
  onShareClick,
  onAnalyticsClick,
  onSettingsClick,
  onPreviewClick,
  onToggleActive,
  onDeleteDocument,
  onDeleteFile,
  currentUser,
  onLogout,
  onOpenLogin,
  onSwitchUser,
  onReloadDocuments,
  loading,
  selectedFolder: propSelectedFolder,
  onSelectFolder: propOnSelectFolder,
  recentUploadToast,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [internalSelectedFolder, setInternalSelectedFolder] = useState<string>('all');
  const selectedFolder = propSelectedFolder ?? internalSelectedFolder;
  const setSelectedFolder = propOnSelectFolder ?? setInternalSelectedFolder;

  const [customFolders, setCustomFolders] = useState<string[]>(() => getLocalFoldersSync().customFolders);
  const [deletedFolders, setDeletedFolders] = useState<string[]>(() => getLocalFoldersSync().deletedFolders);
  const [newFolderInputOpen, setNewFolderInputOpen] = useState(false);
  const [newFolderInputName, setNewFolderInputName] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedMaster, setCopiedMaster] = useState<boolean>(false);
  const { isInstallable, isInstalled, isMobile } = usePWAInstall();
  const [showMobileInstallBanner, setShowMobileInstallBanner] = useState<boolean>(true);
  const [isLoginAuditOpen, setIsLoginAuditOpen] = useState<boolean>(false);
  const [isAdminPortalOpen, setIsAdminPortalOpen] = useState<boolean>(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState<boolean>(false);
  const [installModalInitialTab, setInstallModalInitialTab] = useState<'mobile' | 'pwa' | 'windows' | 'mac-linux'>('mobile');
  const [uploadBlockedToast, setUploadBlockedToast] = useState<string | null>(null);

  // In-app deletion confirm dialog (bypasses iframe native confirm block)
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    onConfirm: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm Delete',
    onConfirm: () => {},
  });
  const [isDeleting, setIsDeleting] = useState(false);

  // 1-Tap Repair state for local-only ghost documents missing their PDF binary on server
  const [repairTargetDoc, setRepairTargetDoc] = useState<DocumentRecord | null>(null);
  const [repairingDocId, setRepairingDocId] = useState<string | null>(null);
  const [repairProgress, setRepairProgress] = useState<string>('');
  const repairInputRef = useRef<HTMLInputElement>(null);

  const handleTriggerRepair = (doc: DocumentRecord) => {
    if (!isAdmin) {
      setUploadBlockedToast('Admin Access Notice: Only administrators can upload or repair PDF files.');
      setTimeout(() => setUploadBlockedToast(null), 5000);
      return;
    }
    setRepairTargetDoc(doc);
    setTimeout(() => {
      repairInputRef.current?.click();
    }, 30);
  };

  const handleRepairFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !repairTargetDoc) return;

    const target = repairTargetDoc;
    setRepairingDocId(target.id);
    setRepairProgress(`Analyzing "${file.name}"...`);

    try {
      const accuratePages = await extractAccuratePageCount(file);
      await documentService.repairDocumentWithFile(
        target,
        file,
        accuratePages,
        (pct, mb) => {
          setRepairProgress(`Uploading to server... ${pct}% (${mb} MB)`);
        }
      );
      if (onReloadDocuments) {
        await onReloadDocuments();
      }
    } catch (err: any) {
      setUploadBlockedToast('Failed to upload PDF: ' + (err?.message || 'Unknown error'));
    } finally {
      setRepairingDocId(null);
      setRepairTargetDoc(null);
      setRepairProgress('');
      if (repairInputRef.current) repairInputRef.current.value = '';
    }
  };

  // Check if current authenticated user has administrative privileges
  const isAdmin = Boolean(currentUser?.role === 'admin' || currentUser?.isOwner);

  // Load persisted folders configuration
  const refreshFolders = useCallback(async () => {
    try {
      const data = await documentService.getFolders();
      if (Array.isArray(data.customFolders)) setCustomFolders(data.customFolders);
      if (Array.isArray(data.deletedFolders)) setDeletedFolders(data.deletedFolders);
    } catch {}
  }, []);

  useEffect(() => {
    refreshFolders();
  }, [refreshFolders]);

  // Collect all unique folders across documents, defaults, and custom folders.
  // Any folder that currently contains active documents is ALWAYS visible.
  const activeDocFolders = new Set(
    documents
      .map((d) => (d.folder || '').trim())
      .filter((f) => Boolean(f) && f !== 'Master Collection' && f !== 'Uncategorized')
      .map((f) => f.toLowerCase())
  );

  const allFolders = Array.from(
    new Set(
      DEFAULT_FOLDERS.concat(
        documents
          .map((d) => (d.folder || '').trim())
          .filter((f) => Boolean(f) && f !== 'Master Collection' && f !== 'Uncategorized'),
        customFolders
      )
    )
  ).filter(
    (f) =>
      Boolean(f) &&
      f !== 'Uncategorized' &&
      f !== 'Master Collection' &&
      (activeDocFolders.has(f.toLowerCase()) ||
        !deletedFolders.some((d) => d.toLowerCase() === f.toLowerCase()))
  );

  // Create folder handler
  const handleCreateFolder = async () => {
    if (!isAdmin) {
      setUploadBlockedToast('Admin Access Notice: Only administrators have permission to create folders.');
      setTimeout(() => setUploadBlockedToast(null), 5000);
      return;
    }
    const trimmed = newFolderInputName.trim();
    if (!trimmed) return;
    await documentService.createFolder(trimmed);
    setCustomFolders((prev) => (prev.some((f) => f.toLowerCase() === trimmed.toLowerCase()) ? prev : [...prev, trimmed]));
    setDeletedFolders((prev) => prev.filter((f) => f.toLowerCase() !== trimmed.toLowerCase()));
    setSelectedFolder(trimmed);
    setNewFolderInputName('');
    setNewFolderInputOpen(false);
    setUploadBlockedToast(`Folder "${trimmed}" created.`);
    setTimeout(() => setUploadBlockedToast(null), 3000);
  };

  // Delete folder handler - permanently deletes ANY folder and never lets it reappear
  const handleDeleteFolder = async (folderNameToDelete: string) => {
    if (!isAdmin) {
      setUploadBlockedToast('Admin Access Notice: Only administrators can delete folders.');
      setTimeout(() => setUploadBlockedToast(null), 5000);
      return;
    }

    const docsInFolder = documents.filter(
      (d) => (d.folder || 'Official Handbooks').toLowerCase() === folderNameToDelete.toLowerCase()
    );

    const remainingFolders = allFolders.filter(
      (f) => f.toLowerCase() !== folderNameToDelete.toLowerCase()
    );
    const fallback = remainingFolders.includes('General PDFs')
      ? 'General PDFs'
      : remainingFolders[0] || 'Uncategorized';

    const confirmMsg =
      docsInFolder.length > 0
        ? `Are you sure you want to permanently delete folder "${folderNameToDelete}"?\n\nThere are ${docsInFolder.length} PDF document(s) in this folder. They will be safely moved to "${fallback}".`
        : `Are you sure you want to permanently delete folder "${folderNameToDelete}"? It will not reappear.`;

    setConfirmDialog({
      isOpen: true,
      title: `Permanently Delete Folder "${folderNameToDelete}"?`,
      message: confirmMsg,
      confirmText: 'Permanently Delete Folder',
      onConfirm: async () => {
        try {
          setDeletedFolders((prev) =>
            prev.some((f) => f.toLowerCase() === folderNameToDelete.toLowerCase())
              ? prev
              : [...prev, folderNameToDelete]
          );
          setCustomFolders((prev) =>
            prev.filter((f) => f.toLowerCase() !== folderNameToDelete.toLowerCase())
          );

          if (selectedFolder.toLowerCase() === folderNameToDelete.toLowerCase()) {
            setSelectedFolder('all');
          }

          await documentService.deleteFolder(folderNameToDelete, fallback);

          if (onReloadDocuments) {
            await onReloadDocuments();
          }

          setUploadBlockedToast(
            `Folder "${folderNameToDelete}" permanently deleted.${
              docsInFolder.length > 0 ? ` ${docsInFolder.length} PDFs moved to "${fallback}".` : ''
            }`
          );
          setTimeout(() => setUploadBlockedToast(null), 4500);
        } catch (err: any) {
          setUploadBlockedToast('Failed to delete folder: ' + (err.message || 'Unknown error'));
          setTimeout(() => setUploadBlockedToast(null), 5000);
        }
      },
    });
  };

  const handleUploadClickSafe = () => {
    if (!isAdmin) {
      setUploadBlockedToast(
        'Admin Access Notice: Only authorized administrators have permission to upload PDF documents.'
      );
      setTimeout(() => setUploadBlockedToast(null), 5000);
      return;
    }
    onUploadClick();
  };

  const handleDeleteDoc = (doc: DocumentRecord) => {
    if (!isAdmin) {
      setUploadBlockedToast(
        'Admin Permission Required: Only Squad Admins can permanently delete documents.'
      );
      setTimeout(() => setUploadBlockedToast(null), 5000);
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: `Permanently Delete "${doc.title}"?`,
      message: `Are you sure you want to permanently delete "${doc.title}"?\n\nThis will immediately and permanently erase the uploaded PDF file from storage and database. The document will NOT be recoverable.`,
      confirmText: 'Permanently Delete',
      onConfirm: async () => {
        await onDeleteDocument(doc.id);
        setUploadBlockedToast(`PDF "${doc.title}" was permanently deleted and cannot be recovered.`);
        setTimeout(() => setUploadBlockedToast(null), 4000);
      },
    });
  };

  const handleDeleteSingleFile = (doc: DocumentRecord, fileId: string, fileTitle: string) => {
    if (!isAdmin) {
      setUploadBlockedToast(
        'Admin Permission Required: Only Squad Admins can delete files from a document.'
      );
      setTimeout(() => setUploadBlockedToast(null), 5000);
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: `Delete File "${fileTitle}"?`,
      message: `Are you sure you want to delete individual file "${fileTitle}" from "${doc.title}"?\n\nThis will immediately and permanently erase this PDF file from storage. It will NOT be recoverable.`,
      confirmText: 'Delete File',
      onConfirm: async () => {
        if (onDeleteFile) {
          await onDeleteFile(doc.id, fileId);
        } else {
          await documentService.deleteFileFromDocument(doc.id, fileId);
        }
        setUploadBlockedToast(`File "${fileTitle}" was permanently deleted and cannot be recovered.`);
        setTimeout(() => setUploadBlockedToast(null), 4000);
      },
    });
  };

  // Identify Master document containing all handbooks
  const masterDoc =
    documents.find((d) => d.id === 'all_handbooks') ||
    documents.find((d) => d.files && d.files.length >= 3);

  // Filter documents strictly by folder, search query, and status (if admin)
  const filteredDocs = documents.filter((doc) => {
    // Regular users can only see active documents
    if (!isAdmin && !doc.isActive) {
      return false;
    }

    const docFolder = (doc.folder || '').trim();
    if (selectedFolder !== 'all') {
      if (docFolder.toLowerCase() !== selectedFolder.toLowerCase()) {
        return false;
      }
    } else {
      // In 'all' view, master collection is kept unless user wants specific folders
    }

    const matchesSearch =
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.originalFilename && doc.originalFilename.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (doc.files && doc.files.some((f) => f.title.toLowerCase().includes(searchQuery.toLowerCase())));

    if (isAdmin) {
      if (statusFilter === 'active') return matchesSearch && doc.isActive;
      if (statusFilter === 'inactive') return matchesSearch && !doc.isActive;
    }
    return matchesSearch;
  });

  const totalViews = documents.reduce((sum, d) => sum + (d.viewsCount || 0), 0);
  const activeLinks = documents.filter((d) => d.isActive).length;
  const totalPagesCount = documents.reduce((sum, d) => sum + (d.pageCount || 0), 0);

  const handleQuickCopy = (doc: DocumentRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = documentService.getShareUrl(doc.id);
    navigator.clipboard.writeText(url);
    setCopiedId(doc.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col overflow-x-hidden">
      {/* Top Navigation - Mobile & Desktop Optimized */}
      <nav className="border-b border-slate-800/80 bg-slate-900/85 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-0 sm:min-h-16 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {/* Top Row on Mobile: Logo & Brand + User Profile */}
          <div className="flex items-center justify-between gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-0.5 rounded-full bg-amber-400/10 border border-amber-400/30 shrink-0">
                <TheHelpingSquadLogo size={36} className="hover:scale-105 transition-transform" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-black text-sm sm:text-base text-white tracking-tight truncate">
                    The Helping Squad
                  </span>
                  <span className="text-[9px] sm:text-[10px] uppercase font-black tracking-wider bg-gradient-to-r from-amber-500/25 to-orange-500/25 text-amber-300 border border-amber-400/40 px-1.5 sm:px-2 py-0.5 rounded-full shadow-sm shrink-0">
                    {isAdmin ? 'Admin' : 'Member'}
                  </span>
                </div>
                <p className="text-[10px] sm:text-[11px] text-slate-400 truncate hidden xs:block sm:block">
                  {isAdmin
                    ? 'Official Administrative Portal • PDF Governance'
                    : 'Authorized Document Reader • Zero-Download'}
                </p>
              </div>
            </div>

            {/* Mobile-only User Profile / Sign Out on Top Right */}
            <div className="flex sm:hidden items-center gap-1.5 shrink-0">
              {currentUser ? (
                <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-2 py-1 rounded-xl text-xs">
                  <div
                    className={`w-5 h-5 rounded-full font-black text-[9px] flex items-center justify-center shrink-0 ${
                      isAdmin
                        ? 'bg-gradient-to-tr from-amber-400 to-orange-400 text-slate-950'
                        : 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/30'
                    }`}
                  >
                    {currentUser.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-bold text-white text-[11px] truncate max-w-[72px]">
                    {currentUser.name.split(' ')[0]}
                  </span>
                  {onLogout && (
                    <button
                      onClick={onLogout}
                      className="text-slate-400 hover:text-rose-400 p-1 rounded hover:bg-slate-800 transition cursor-pointer"
                      title="Sign Out"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ) : (
                onOpenLogin && (
                  <button
                    onClick={onOpenLogin}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold transition cursor-pointer"
                  >
                    <User className="w-3.5 h-3.5 text-amber-400" />
                    <span>Sign In</span>
                  </button>
                )
              )}
            </div>
          </div>

          {/* Menu Options - Scrollable / Wrapped Action Bar on Mobile */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-0.5 sm:pb-0 w-full sm:w-auto justify-start sm:justify-end no-scrollbar">
            {/* ADMIN ONLY: Menu Option for Adding New PDFs */}
            {isAdmin && (
              <button
                onClick={handleUploadClickSafe}
                className="flex items-center gap-1 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-400 hover:to-orange-400 text-xs font-black text-slate-950 shadow-lg shadow-amber-500/25 transition cursor-pointer shrink-0"
                title="Add New PDF into a folder"
              >
                <Plus className="w-3.5 h-3.5 text-slate-950 stroke-[3]" />
                <span>Add PDF</span>
              </button>
            )}

            {/* ADMIN ONLY: Re-Bundle All */}
            {isAdmin && onBundleAllClick && (
              <button
                onClick={onBundleAllClick}
                className="hidden lg:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700/80 transition cursor-pointer shrink-0"
                title="Consolidate all uploaded documents into 1 master link"
              >
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden xl:inline">Re-Bundle</span>
              </button>
            )}

            {/* ADMIN ONLY: Demo Squad Manuals */}
            {isAdmin && (
              <button
                onClick={onSeedSampleClick}
                className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700/80 transition cursor-pointer shrink-0"
                title="Seed sample manuals"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden lg:inline">Demo Manuals</span>
              </button>
            )}

            {/* ADMIN ONLY: Admin Portal (Settings & Governance) */}
            {isAdmin && (
              <button
                onClick={() => setIsAdminPortalOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 text-xs font-bold text-amber-300 border border-amber-500/40 transition cursor-pointer shadow-sm shrink-0"
                title="Admin Portal: Manage administrators, security, and global settings"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>Admin Portal</span>
              </button>
            )}

            {/* ADMIN ONLY: Login Management (Audit Directory) */}
            {isAdmin && (
              <button
                onClick={() => setIsLoginAuditOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-amber-300 border border-amber-500/30 transition cursor-pointer shadow-sm shrink-0"
                title="Login Management: View names, email addresses, and timestamps of all user logins"
              >
                <Users className="w-3.5 h-3.5 text-amber-400" />
                <span>Logins</span>
              </button>
            )}

            {/* Mobile App Installer Button */}
            <button
              onClick={() => {
                setInstallModalInitialTab('mobile');
                setIsInstallModalOpen(true);
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 text-xs font-bold text-amber-300 border border-amber-500/40 transition cursor-pointer shadow-sm shrink-0"
              title="Install Mobile App on Android, iPhone, or iPad"
            >
              <Smartphone className="w-3.5 h-3.5 text-amber-400" />
              <span>Mobile App</span>
            </button>

            {/* Install Desktop App Button - Accessible by all users */}
            <button
              onClick={() => {
                setInstallModalInitialTab('pwa');
                setIsInstallModalOpen(true);
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-gradient-to-r from-blue-600/20 to-indigo-600/20 hover:from-blue-600/30 hover:to-indigo-600/30 text-xs font-bold text-blue-300 border border-blue-500/40 transition cursor-pointer shadow-sm shrink-0"
              title="Install Desktop or Mobile App with 400MB PDF support"
            >
              <Download className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">Install App</span>
            </button>

            {/* Desktop Auth Profile / Sign Out */}
            <div className="hidden sm:flex items-center">
              {currentUser ? (
                <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
                  <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-2.5 py-1.5 rounded-xl text-xs">
                    <div
                      className={`w-6 h-6 rounded-full font-black text-[10px] flex items-center justify-center ${
                        isAdmin
                          ? 'bg-gradient-to-tr from-amber-400 to-orange-400 text-slate-950'
                          : 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/30'
                      }`}
                    >
                      {currentUser.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="text-left">
                      <div className="font-bold text-white text-[11px] leading-tight truncate max-w-[110px]">
                        {currentUser.name}
                      </div>
                      <div className="text-[10px] font-mono truncate max-w-[110px] flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${isAdmin ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                        <span className={isAdmin ? 'text-amber-400 font-semibold' : 'text-slate-400'}>
                          {isAdmin ? 'Admin' : 'Regular User'}
                        </span>
                      </div>
                    </div>
                    {onLogout && (
                      <button
                        onClick={onLogout}
                        className="text-[10px] text-slate-400 hover:text-rose-400 p-1 rounded hover:bg-slate-800 transition cursor-pointer ml-1"
                        title="Sign Out"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                onOpenLogin && (
                  <button
                    onClick={onOpenLogin}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold transition cursor-pointer"
                  >
                    <User className="w-3.5 h-3.5 text-amber-400" />
                    <span>Sign In</span>
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Body */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-8 flex-1 w-full space-y-5 sm:space-y-7">
        <input
          ref={repairInputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={handleRepairFileSelected}
        />

        {/* Mobile PWA Install Reminder Bar - visible on mobile when not yet running standalone */}
        {isMobile && !isInstalled && showMobileInstallBanner && (
          <div className="bg-gradient-to-r from-amber-500/15 via-slate-900 to-emerald-500/15 border border-amber-500/40 rounded-2xl p-3.5 shadow-xl flex items-center justify-between gap-3 text-xs animate-in fade-in">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                <Smartphone className="w-5 h-5 text-amber-400" />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-white text-xs sm:text-sm truncate">
                  Install Squad Vault Mobile App
                </div>
                <div className="text-[11px] text-slate-300 truncate">
                  Full screen reading, zero address bars, and instant launch
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => {
                  setInstallModalInitialTab('mobile');
                  setIsInstallModalOpen(true);
                }}
                className="py-1.5 px-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 font-black text-slate-950 rounded-lg text-xs shadow-md transition cursor-pointer flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Install</span>
              </button>
              <button
                onClick={() => setShowMobileInstallBanner(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* HEADER HERO BANNER - ROLE DIFFERENTIATED */}
        {isAdmin ? (
          /* ADMIN COMMAND BANNER */
          <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border-2 border-amber-500/40 bg-gradient-to-r from-amber-950/40 via-slate-900 to-sky-950/40 p-4 sm:p-7 shadow-2xl shadow-amber-950/20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
              <div className="flex items-start sm:items-center gap-3.5 sm:gap-5">
                <div className="shrink-0 p-1 sm:p-1.5 rounded-2xl bg-amber-400/10 border border-amber-400/30 shadow-inner hidden xs:block sm:block">
                  <TheHelpingSquadLogo size={56} className="drop-shadow-lg sm:w-[74px] sm:h-[74px]" />
                </div>
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest bg-gradient-to-r from-amber-400 to-orange-400 text-slate-950 px-2.5 py-0.5 rounded-full shadow-md">
                      ★ THE HELPING SQUAD ★
                    </span>
                    <span className="text-[11px] sm:text-xs text-amber-300 font-semibold bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                      Administrator Console
                    </span>
                    <span className="text-[11px] sm:text-xs text-emerald-400 font-bold bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                      Up to 400 MB / PDF
                    </span>
                  </div>
                  <h1 className="text-xl sm:text-3xl font-black text-white tracking-tight">
                    Document Vault & PDF Management
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl">
                    Add new PDF documents, organize files into folders, manage squad admins, monitor member logins, and maintain view-only security guarantees.
                  </p>
                </div>
              </div>

              {/* Admin Actions - Touch Grid on Mobile, Row on Desktop */}
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-2.5 shrink-0 w-full md:w-auto">
                <button
                  onClick={handleUploadClickSafe}
                  className="px-3.5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20"
                >
                  <Plus className="w-4 h-4 stroke-[3] shrink-0" />
                  <span>Add New PDF</span>
                </button>
                <button
                  onClick={() => setIsAdminPortalOpen(true)}
                  className="px-3 py-2.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 text-amber-300 font-extrabold rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5 border border-amber-500/40 shadow-md"
                >
                  <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Admin Portal</span>
                </button>
                <button
                  onClick={() => setIsLoginAuditOpen(true)}
                  className="px-3 py-2.5 bg-slate-800/95 hover:bg-slate-700 text-amber-300 font-bold rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5 border border-amber-500/30 shadow-md"
                >
                  <Users className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Login Audit</span>
                </button>
                <button
                  onClick={() => setIsInstallModalOpen(true)}
                  className="px-3 py-2.5 bg-gradient-to-r from-blue-600/30 to-indigo-600/30 hover:from-blue-600/40 hover:to-indigo-600/40 text-blue-300 font-bold rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5 border border-blue-500/40 shadow-md"
                >
                  <Download className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>Install App</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* REGULAR USER / READER WELCOME BANNER (NO ADMIN OPTIONS) */
          <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-800 bg-gradient-to-r from-slate-900 via-indigo-950/30 to-slate-900 p-4 sm:p-7 shadow-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6">
              <div className="flex items-start sm:items-center gap-3.5 sm:gap-5">
                <div className="shrink-0 p-1 sm:p-1.5 rounded-2xl bg-amber-400/10 border border-amber-400/30 shadow-inner">
                  <TheHelpingSquadLogo size={52} className="drop-shadow-lg sm:w-[68px] sm:h-[68px]" />
                </div>
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest bg-gradient-to-r from-amber-400 to-orange-400 text-slate-950 px-2.5 py-0.5 rounded-full shadow-sm">
                      ★ THE HELPING SQUAD ★
                    </span>
                    <span className="text-[11px] sm:text-xs text-indigo-300 font-semibold bg-indigo-500/15 border border-indigo-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                      Authorized Reader Library
                    </span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    Welcome, {currentUser?.name || 'Squad Member'}
                  </h1>
                  <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
                    Select any available PDF document or browse by folder below to read official handbooks and guides. All files are protected with zero-download and anti-leak watermarking security.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 shrink-0">
                <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-2xl text-xs text-slate-300 space-y-1">
                  <div className="font-bold text-amber-400 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" />
                    <span>View-Only Access Enforced</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Downloading, printing, and file extraction are disabled.
                  </p>
                </div>
                <button
                  onClick={() => setIsInstallModalOpen(true)}
                  className="px-4 py-2.5 sm:py-3 bg-gradient-to-r from-blue-600/30 to-indigo-600/30 hover:from-blue-600/40 hover:to-indigo-600/40 text-blue-300 font-bold rounded-2xl text-xs transition cursor-pointer flex items-center justify-center gap-2 border border-blue-500/40 shadow-md"
                >
                  <Download className="w-4 h-4 text-blue-400" />
                  <span>Install App</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Upload Warning Toast if triggered */}
        {uploadBlockedToast && (
          <div className="p-4 bg-rose-500/15 border border-rose-500/40 rounded-2xl text-xs text-rose-300 flex items-center justify-between gap-3 animate-fadeIn">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{uploadBlockedToast}</span>
            </div>
            <button
              onClick={() => setUploadBlockedToast(null)}
              className="text-[11px] text-slate-400 hover:text-white"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Upload Success Toast if triggered */}
        {recentUploadToast && (
          <div className="p-4 bg-emerald-500/15 border border-emerald-500/40 rounded-2xl text-xs text-emerald-300 flex items-center justify-between gap-3 animate-fadeIn">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-semibold">{recentUploadToast}</span>
            </div>
          </div>
        )}

        {/* STATS OVERVIEW - ROLE DIFFERENTIATED */}
        {isAdmin ? (
          /* ADMIN KPI STATS */
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
            <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-2xl">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>PDF Documents</span>
                <FileText className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="text-xl font-bold text-white mt-1.5">{documents.length}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{allFolders.length} Folders active</div>
            </div>

            <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-2xl">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Total View Sessions</span>
                <Activity className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-xl font-bold text-emerald-400 mt-1.5">{totalViews}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Audit logged sessions</div>
            </div>

            <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-2xl">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Active PDF Documents</span>
                <FileText className="w-4 h-4 text-sky-400" />
              </div>
              <div className="text-xl font-bold text-white mt-1.5">{activeLinks}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Instant revocation</div>
            </div>

            <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-2xl">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Download Blocking</span>
                <ShieldCheck className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-xl font-bold text-purple-400 mt-1.5">100%</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Canvas & print blocker</div>
            </div>

            {/* Login Management Card (Admin Only) */}
            <button
              onClick={() => setIsLoginAuditOpen(true)}
              className="p-3.5 bg-slate-900/70 border border-slate-800 hover:border-amber-500/40 rounded-2xl transition text-left cursor-pointer group shadow-md"
            >
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                <span>Login Management</span>
                <Users className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-lg font-black text-white mt-1.5 flex items-center gap-1.5">
                <span>Who Logged In</span>
              </div>
              <div className="text-[10px] text-amber-300 mt-0.5 flex items-center gap-1">
                <span>View user audit log</span>
                <ChevronRight className="w-3 h-3 text-amber-400" />
              </div>
            </button>

            {/* Admin Portal Card (Admin Only) */}
            <button
              onClick={() => setIsAdminPortalOpen(true)}
              className="p-3.5 bg-gradient-to-br from-indigo-950/60 via-slate-900 to-amber-950/40 border-2 border-amber-500/40 hover:border-amber-400 rounded-2xl transition text-left cursor-pointer group shadow-lg"
            >
              <div className="flex items-center justify-between text-amber-400 text-xs font-semibold">
                <span>Admin Portal</span>
                <ShieldCheck className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-lg font-black text-white mt-1.5 flex items-center gap-1">
                <span>All Settings</span>
              </div>
              <div className="text-[10px] text-amber-300 mt-0.5 flex items-center gap-1">
                <span>Admins & Friends</span>
                <ChevronRight className="w-3 h-3 text-amber-400" />
              </div>
            </button>
          </div>
        ) : (
          /* REGULAR USER / READER STATS (NO ADMIN MANAGEMENT CARDS) */
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-slate-400 font-medium">Available Documents</div>
                <div className="text-xl font-bold text-white mt-0.5">{documents.length} PDF Packs</div>
              </div>
            </div>

            <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                <FolderOpen className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-slate-400 font-medium">Organized Folders</div>
                <div className="text-xl font-bold text-white mt-0.5">{allFolders.length} Folders</div>
              </div>
            </div>

            <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-slate-400 font-medium">Reader Security</div>
                <div className="text-xl font-bold text-emerald-400 mt-0.5">100% Zero-Download</div>
              </div>
            </div>
          </div>
        )}

        {/* SEPARATE FOLDER SYSTEM FOR PDF FILES */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-5 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-400 shrink-0">
                <FolderOpen className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm font-bold text-white tracking-tight">PDF Document Folders</h2>
                  <span className="text-[10px] bg-slate-800 text-amber-300 border border-slate-700 px-2 py-0.5 rounded-full font-mono">
                    {allFolders.length} Folders
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {isAdmin
                    ? 'Organize documents into separate folders or permanently delete unused folders'
                    : 'Tap any folder to view and read documents in that specific collection'}
                </p>
              </div>
            </div>

            {/* Folder Controls (Create Folder & Add PDF to Folder) - ADMIN ONLY */}
            {isAdmin && (
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto shrink-0">
                {newFolderInputOpen ? (
                  <div className="flex items-center gap-1.5 w-full sm:w-auto animate-fadeIn">
                    <input
                      type="text"
                      value={newFolderInputName}
                      onChange={(e) => setNewFolderInputName(e.target.value)}
                      placeholder="New folder name..."
                      className="flex-1 sm:w-44 px-3 py-1.5 bg-slate-950 border border-amber-500/50 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreateFolder();
                        if (e.key === 'Escape') setNewFolderInputOpen(false);
                      }}
                    />
                    <button
                      onClick={handleCreateFolder}
                      className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl transition cursor-pointer shrink-0"
                    >
                      Create
                    </button>
                    <button
                      onClick={() => setNewFolderInputOpen(false)}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl transition cursor-pointer shrink-0"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setNewFolderInputOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-amber-300 border border-amber-500/30 rounded-xl transition cursor-pointer"
                    title="Create a new folder for PDF files"
                  >
                    <FolderPlus className="w-3.5 h-3.5 text-amber-400" />
                    <span>+ Create Folder</span>
                  </button>
                )}

                {selectedFolder !== 'all' && (
                  <button
                    onClick={() => handleDeleteFolder(selectedFolder)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-xs font-semibold text-rose-300 border border-rose-500/30 rounded-xl transition cursor-pointer"
                    title={`Permanently delete folder "${selectedFolder}"`}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span>Delete Folder</span>
                  </button>
                )}

                <button
                  onClick={handleUploadClickSafe}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-xs font-bold text-slate-950 rounded-xl transition cursor-pointer shadow-sm shadow-amber-500/20 ml-auto sm:ml-0"
                  title="Upload and place new PDF in a folder"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Add PDF</span>
                </button>
              </div>
            )}
          </div>

          {/* Folder Filter Tabs */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              onClick={() => setSelectedFolder('all')}
              className={`px-3 sm:px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-2 border ${
                selectedFolder === 'all'
                  ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-md shadow-amber-400/20 font-bold'
                  : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
              }`}
            >
              <FolderArchive className="w-3.5 h-3.5 shrink-0" />
              <span>All PDF Files</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  selectedFolder === 'all'
                    ? 'bg-slate-950 text-amber-400 font-bold'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {documents.length}
              </span>
            </button>

            {allFolders.map((folderName) => {
              const count = documents.filter(
                (d) => (d.folder || '').trim().toLowerCase() === folderName.toLowerCase()
              ).length;
              const isSelected = selectedFolder.toLowerCase() === folderName.toLowerCase();

              return (
                <div
                  key={folderName}
                  className={`inline-flex items-center rounded-xl text-xs font-semibold transition border max-w-full ${
                    isSelected
                      ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-md shadow-amber-400/20 font-bold'
                      : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  <button
                    onClick={() => setSelectedFolder(folderName)}
                    className="px-3 sm:px-3.5 py-2 flex items-center gap-2 cursor-pointer min-w-0"
                  >
                    <Folder className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-slate-950' : 'text-amber-400'}`} />
                    <span className="truncate max-w-[165px] sm:max-w-none">{folderName}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono shrink-0 ${
                        isSelected
                          ? 'bg-slate-950 text-amber-400 font-bold'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {count}
                    </span>
                  </button>

                  {/* Delete folder button (Admin Only) */}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFolder(folderName);
                      }}
                      className={`p-2 mr-1 rounded-lg transition cursor-pointer shrink-0 ${
                        isSelected
                          ? 'text-slate-950 hover:text-rose-950 hover:bg-amber-500/40'
                          : 'text-slate-500 hover:text-rose-400 hover:bg-rose-500/10'
                      }`}
                      title={`Permanently delete folder "${folderName}"`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Search & Status Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-white truncate">
                {selectedFolder === 'all' ? 'All PDF Documents' : `Folder: ${selectedFolder}`}
              </h2>
              <span className="text-xs text-slate-400 font-mono">
                ({filteredDocs.length} {filteredDocs.length === 1 ? 'file pack' : 'file packs'})
              </span>
              {isAdmin && selectedFolder !== 'all' && (
                <button
                  onClick={() => handleDeleteFolder(selectedFolder)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/30 text-[11px] font-semibold transition cursor-pointer"
                  title={`Permanently delete folder "${selectedFolder}"`}
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>Delete Folder</span>
                </button>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {isAdmin
                ? 'Manage active status, security settings, watermarks, or launch the zero-download reader'
                : 'Tap any document or file to open the zero-download reader and view contents'}
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-initial">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search PDF files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-400 w-full sm:w-60"
              />
            </div>

            {/* Admin Only: Status Filter */}
            {isAdmin && (
              <select
                value={statusFilter}
                onChange={(e: any) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-amber-400 cursor-pointer shrink-0"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="inactive">Revoked Only</option>
              </select>
            )}
          </div>
        </div>

        {/* Documents Grid */}
        {loading ? (
          <div className="py-20 text-center text-slate-400">
            <div className="w-8 h-8 border-3 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs">Loading secure document vault...</p>
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="p-12 text-center bg-slate-900/40 border border-dashed border-slate-800 rounded-3xl">
            <div className="w-16 h-16 rounded-2xl bg-amber-400/10 border border-amber-400/20 text-amber-400 flex items-center justify-center mx-auto mb-4">
              <FolderOpen className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-white">No PDF Documents Found</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 leading-relaxed">
              {isAdmin
                ? `No documents found in folder "${selectedFolder}". Add a new PDF to this folder or switch to "All PDF Files".`
                : `There are currently no PDF documents available in "${selectedFolder}". Please check back soon or browse another folder.`}
            </p>
            {isAdmin && (
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={handleUploadClickSafe}
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black rounded-xl text-xs transition cursor-pointer flex items-center gap-2 shadow-lg shadow-amber-500/20"
                >
                  <Plus className="w-4 h-4 stroke-[3]" /> Add New PDF Document
                </button>
                <button
                  onClick={onSeedSampleClick}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" /> Load Official Squad Manuals
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredDocs.map((doc) => {
              const isExpired = doc.settings?.expiresAt
                ? new Date(doc.settings.expiresAt) < new Date()
                : false;
              const hasPassword = Boolean(doc.settings?.password);
              const hasWatermark = Boolean(doc.settings?.watermarkText);
              const docFolder = doc.folder || 'Official Handbooks';

              return (
                <div
                  key={doc.id}
                  className={`bg-slate-900/70 border rounded-2xl p-5 flex flex-col justify-between transition hover:border-slate-700 hover:shadow-xl ${
                    !doc.isActive ? 'border-slate-800/60 opacity-75' : 'border-slate-800'
                  }`}
                >
                  <div>
                    {/* Header: Folder Badge & Status / Admin Controls */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {/* Folder Pill */}
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-300 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full">
                          <Folder className="w-3 h-3 text-amber-400" />
                          <span>{docFolder}</span>
                        </span>

                        {isAdmin && (
                          doc.isActive ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full">
                              Revoked
                            </span>
                          )
                        )}

                        {isExpired && (
                          <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                            Expired
                          </span>
                        )}
                      </div>

                      {/* ADMIN ONLY: Settings and Delete Buttons */}
                      {isAdmin && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => onSettingsClick(doc)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                            title="Admin Settings & Folder Management"
                          >
                            <Settings className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteDoc(doc)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                            title="Delete PDF Document Permanently"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Title and details */}
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="text-sm font-bold text-white line-clamp-1" title={doc.title}>
                        {doc.title}
                      </h3>
                      {doc.files && doc.files.length > 1 && (
                        <span className="shrink-0 text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full">
                          {doc.files.length} PDFs
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-400 mb-2 truncate flex items-center gap-2">
                      <span>
                        {doc.files?.length || 1} {doc.files?.length === 1 ? 'File' : 'Files'}
                      </span>
                      <span>•</span>
                      <span>{doc.pageCount} Pages total</span>
                      <span>•</span>
                      <span>{((doc.fileSize || 0) / 1024).toFixed(0)} KB</span>
                    </p>

                    {/* Files inside document card */}
                    {doc.files && doc.files.length > 0 && (
                      <div className="mb-3 p-2.5 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1.5 text-[11px]">
                        <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                          <span>PDFs in this document ({doc.files.length}):</span>
                          <span className="text-amber-400/80 font-normal">Click to read</span>
                        </div>
                        {doc.files.map((f, i) => (
                          <div
                            key={f.id || i}
                            onClick={() => onPreviewClick(doc.id)}
                            className="text-slate-300 flex items-center justify-between py-1 px-1.5 rounded hover:bg-slate-900 transition cursor-pointer group/file"
                          >
                            <span className="truncate max-w-[190px] flex items-center gap-1.5">
                              <span className="text-amber-400 font-bold">{i + 1}.</span>
                              <span className="truncate font-medium text-slate-200 group-hover/file:text-amber-300 transition">
                                {f.title}
                              </span>
                            </span>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-slate-500 text-[10px] font-mono">{f.pageCount}p</span>

                              {/* ADMIN ONLY: Delete single file */}
                              {isAdmin && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteSingleFile(doc, f.id, f.title);
                                  }}
                                  className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition cursor-pointer"
                                  title={`Delete "${f.title}"`}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Alert if this document was saved locally without its PDF binary on the server */}
                    {isAdmin && doc.hasBinaryOnServer === false && doc.id !== 'all_handbooks' && (
                      <div className="mb-3 p-3 bg-amber-500/15 border-2 border-amber-500/40 rounded-xl space-y-2 text-xs">
                        <div className="flex items-start gap-2 text-amber-300 font-bold">
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                          <span>Not Visible to Other Users Yet (PDF File Missing on Server)</span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed">
                          This entry was saved locally before its PDF file finished uploading. Select the PDF file below to publish it so everyone can see and read it.
                        </p>
                        <button
                          type="button"
                          disabled={repairingDocId === doc.id}
                          onClick={() => handleTriggerRepair(doc)}
                          className="w-full py-2 px-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-60 text-slate-950 font-black rounded-lg text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md"
                        >
                          <Upload className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>
                            {repairingDocId === doc.id
                              ? repairProgress || 'Uploading PDF...'
                              : 'Select PDF File to Upload & Publish Now'}
                          </span>
                        </button>
                      </div>
                    )}

                    {/* Security badges */}
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-slate-950 px-2 py-0.5 rounded text-emerald-400 border border-slate-800">
                        <ShieldCheck className="w-3 h-3" /> Zero Download
                      </span>
                      {hasPassword && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-slate-950 px-2 py-0.5 rounded text-indigo-300 border border-slate-800">
                          <Lock className="w-3 h-3 text-indigo-400" /> Passcode Protected
                        </span>
                      )}
                      {doc.settings?.requireEmail && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-slate-950 px-2 py-0.5 rounded text-sky-300 border border-slate-800">
                          <Mail className="w-3 h-3 text-sky-400" /> Email Required
                        </span>
                      )}
                      {hasWatermark && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-slate-950 px-2 py-0.5 rounded text-purple-300 border border-slate-800">
                          <Eye className="w-3 h-3 text-purple-400" /> Watermarked
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Actions - STRICTLY ROLE DIFFERENTIATED */}
                  {isAdmin ? (
                    /* ADMIN FULL ACTIONS: Analytics, Preview, Share, Copy, Power, Delete */
                    <div className="pt-3 border-t border-slate-800/80 space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <button
                          onClick={() => onAnalyticsClick(doc)}
                          className="text-slate-400 hover:text-indigo-400 transition cursor-pointer flex items-center gap-1 font-medium"
                        >
                          <Activity className="w-3.5 h-3.5" />
                          <span>{doc.viewsCount || 0} Views</span>
                        </button>

                        <button
                          onClick={() => onPreviewClick(doc.id)}
                          className="text-xs text-amber-400 hover:text-amber-300 transition cursor-pointer flex items-center gap-1 font-medium"
                        >
                          <Eye className="w-3.5 h-3.5" /> Open Reader View
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onShareClick(doc)}
                          className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20"
                        >
                          <Share2 className="w-3.5 h-3.5" /> Share Link
                        </button>
                        <button
                          onClick={(e) => handleQuickCopy(doc, e)}
                          className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs transition cursor-pointer border border-slate-700"
                          title="Quick Copy Link"
                        >
                          {copiedId === doc.id ? (
                            <Check className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => onToggleActive(doc.id, doc.isActive)}
                          className={`p-2 rounded-xl text-xs transition cursor-pointer border ${
                            doc.isActive
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                          }`}
                          title={doc.isActive ? 'Revoke / Pause Access' : 'Reactivate Link'}
                        >
                          <Power className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteDoc(doc)}
                          className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/20 hover:border-rose-500/40 rounded-xl text-xs transition cursor-pointer"
                          title="Delete PDF Document Permanently"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* REGULAR USER ACTION: ONLY VIEW / READ PDF */
                    <div className="pt-3 border-t border-slate-800 space-y-2">
                      <button
                        onClick={() => onPreviewClick(doc.id)}
                        className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
                      >
                        <Eye className="w-4 h-4 text-slate-950 stroke-[2.5]" />
                        <span>
                          Open & Read PDF ({doc.files?.length || 1}{' '}
                          {doc.files?.length === 1 ? 'file' : 'files'})
                        </span>
                      </button>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                        <span className="flex items-center gap-1 text-emerald-400">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          View-Only Protected
                        </span>
                        <span>{doc.pageCount} Pages Total</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Security architecture card */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 sm:p-8">
          <div className="max-w-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-400" />
              The Helping Squad View-Only PDF Protection Architecture
            </h3>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              Standard web links or Google Drive links expose the raw PDF file, letting recipients download or re-upload it. The Helping Squad vault enforces four defense layers:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-2xl">
              <div className="w-8 h-8 rounded-lg bg-indigo-600/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mb-3">
                <FileText className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-white">1. Canvas Rasterization</h4>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                Raw PDF files are never exposed in the browser. Pages are dynamically rasterized onto HTML5 canvas tiles.
              </p>
            </div>

            <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-2xl">
              <div className="w-8 h-8 rounded-lg bg-emerald-600/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mb-3">
                <Eye className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-white">2. Forensic Watermarks</h4>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                Tiled dynamic watermarks containing the viewer's identifier and timestamp prevent smartphone photography leaks.
              </p>
            </div>

            <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-2xl">
              <div className="w-8 h-8 rounded-lg bg-purple-600/15 border border-purple-500/30 text-purple-400 flex items-center justify-center mb-3">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-white">3. Print & Save Blocker</h4>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                Right-clicks, Ctrl+P, browser print previews, and saving shortcuts are intercepted and physically blocked.
              </p>
            </div>

            <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-2xl">
              <div className="w-8 h-8 rounded-lg bg-rose-600/15 border border-rose-500/30 text-rose-400 flex items-center justify-center mb-3">
                <Power className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-white">4. Remote Killswitch</h4>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                Admins can revoke access instantly at any second, set auto-expiration dates, or restrict access to authorized users.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Login Directory & Audit Trail Modal (Names & Emails) - ADMIN ONLY */}
      {isAdmin && (
        <LoginAuditModal
          isOpen={isLoginAuditOpen}
          onClose={() => setIsLoginAuditOpen(false)}
        />
      )}

      {/* Admin Portal Modal (Manage Admins & 3 Friends) - ADMIN ONLY */}
      {isAdmin && (
        <AdminPortalModal
          isOpen={isAdminPortalOpen}
          onClose={() => setIsAdminPortalOpen(false)}
          currentUser={currentUser}
          onSwitchUser={onSwitchUser}
          onOpenUpload={handleUploadClickSafe}
        />
      )}

      {/* App Installer Modal (1-Click PWA, Windows .bat, Mac/Linux .sh) */}
      <InstallModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
        initialTab={installModalInitialTab}
      />

      {/* In-App Deletion Confirm Dialog - Works seamlessly in iframes and mobile */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl max-w-md w-full p-6 shadow-2xl text-slate-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">{confirmDialog.title}</h3>
                <span className="text-[10px] text-rose-400 font-bold uppercase tracking-wider">
                  Permanent & Unrecoverable Deletion
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed mb-6 whitespace-pre-line">
              {confirmDialog.message}
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={async () => {
                  setIsDeleting(true);
                  try {
                    await confirmDialog.onConfirm();
                  } finally {
                    setIsDeleting(false);
                    setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
                  }
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 shadow-lg shadow-rose-600/30 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeleting ? 'Deleting...' : confirmDialog.confirmText}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
