import React, { useState, useEffect } from 'react';
import {
  X,
  Settings,
  Lock,
  Eye,
  Mail,
  Clock,
  Trash2,
  Save,
  AlertTriangle,
  Power,
  Shield,
  FileText,
  Folder,
} from 'lucide-react';
import { DocumentRecord, DocumentSettings, PdfDocumentItem } from '../types/document';
import { documentService } from '../services/documentService';
import { TheHelpingSquadLogo } from './TheHelpingSquadLogo';
import { AuthUser } from '../types/auth';

interface EditSettingsModalProps {
  document: DocumentRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (docId: string, updates: any) => Promise<void>;
  onDelete: (docId: string) => Promise<void>;
  currentUser?: AuthUser | null;
}

export const EditSettingsModal: React.FC<EditSettingsModalProps> = ({
  document,
  isOpen,
  onClose,
  onSave,
  onDelete,
  currentUser,
}) => {
  const isAdmin = Boolean(currentUser?.role === 'admin' || currentUser?.isOwner);

  const [title, setTitle] = useState(document?.title || '');
  const [folder, setFolder] = useState(document?.folder || 'Official Handbooks');
  const [isActive, setIsActive] = useState(document?.isActive ?? true);
  const [hasPassword, setHasPassword] = useState(Boolean(document?.settings?.password));
  const [password, setPassword] = useState(document?.settings?.password || '');
  const [requireEmail, setRequireEmail] = useState(Boolean(document?.settings?.requireEmail));
  const [watermarkText, setWatermarkText] = useState(
    document?.settings?.watermarkText || 'CONFIDENTIAL'
  );
  const [includeViewerEmail, setIncludeViewerEmail] = useState(
    document?.settings?.includeViewerEmailInWatermark ?? true
  );
  const [includeTimestamp, setIncludeTimestamp] = useState(
    document?.settings?.includeTimestampInWatermark ?? true
  );
  const [watermarkOpacity, setWatermarkOpacity] = useState(
    document?.settings?.watermarkOpacity ?? 0.22
  );
  const [antiScreenBlur, setAntiScreenBlur] = useState(
    document?.settings?.antiScreenBlur ?? true
  );
  const [enclosedFiles, setEnclosedFiles] = useState<PdfDocumentItem[]>(document?.files || []);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (document) {
      setTitle(document.title);
      setFolder(document.folder || 'Official Handbooks');
      setIsActive(document.isActive);
      setHasPassword(Boolean(document.settings?.password));
      setPassword(document.settings?.password || '');
      setRequireEmail(Boolean(document.settings?.requireEmail));
      setWatermarkText(document.settings?.watermarkText || 'CONFIDENTIAL');
      setEnclosedFiles(document.files || []);
    }
  }, [document]);

  if (!isOpen || !document || !isAdmin) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setErrorMsg('Admin Permission Required: Only squad administrators can modify document settings.');
      return;
    }
    setSaving(true);
    const updatedSettings: DocumentSettings = {
      ...document.settings,
      password: hasPassword ? password.trim() : undefined,
      requireEmail,
      watermarkText: watermarkText.trim(),
      includeViewerEmailInWatermark: includeViewerEmail,
      includeTimestampInWatermark: includeTimestamp,
      watermarkOpacity,
      antiScreenBlur,
    };

    try {
      await onSave(document.id, {
        title: title.trim(),
        folder: folder.trim(),
        isActive,
        settings: updatedSettings,
        files: enclosedFiles,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSingleFile = async (fileId: string, _fileTitle: string) => {
    if (!isAdmin) {
      setErrorMsg('Admin Permission Required: Only squad administrators can delete files.');
      return;
    }

    setDeletingFileId(fileId);
    try {
      const res = await documentService.deleteFileFromDocument(document.id, fileId);
      if (res.deletedEntireDocument) {
        await onDelete(document.id);
        onClose();
      } else {
        setEnclosedFiles((prev) => prev.filter((f) => f.id !== fileId));
      }
    } catch (err: any) {
      setErrorMsg('Error deleting file: ' + err.message);
    } finally {
      setDeletingFileId(null);
    }
  };

  const handleDeleteEntireDocument = async () => {
    if (!isAdmin) {
      setErrorMsg('Admin Permission Required: Only squad administrators can delete documents.');
      return;
    }
    setIsDeletingAll(true);
    try {
      await onDelete(document.id);
      onClose();
    } finally {
      setIsDeletingAll(false);
    }
  };

  const totalPagesCount = enclosedFiles.reduce((sum, f) => sum + (f.pageCount || 1), 0);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-0.5 rounded-full bg-amber-400/10 border border-amber-400/30 shrink-0">
              <TheHelpingSquadLogo size={40} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-xs uppercase tracking-wider bg-gradient-to-r from-amber-400 to-orange-400 text-slate-950 px-2 py-0.5 rounded shadow-sm">
                  The Helping Squad
                </span>
                <h2 className="text-base font-bold text-white">Manage & Edit Document</h2>
                {isAdmin ? (
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Shield className="w-3 h-3 text-emerald-400" />
                    Admin Control
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Lock className="w-3 h-3 text-amber-400" />
                    Admin Only (Read-Only)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Delete PDFs anytime, modify security passcode, or revoke access</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!isAdmin && (
          <div className="mt-4 p-3.5 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-xl text-xs flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong>Admin Only:</strong> Document security settings, passcode protection, watermarks, expiration, and killswitch controls can only be modified by squad administrators.
            </div>
          </div>
        )}

        <form onSubmit={handleSave} className="mt-5 space-y-4">
          {/* Active status switcher */}
          <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Power className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-rose-400'}`} />
              <div>
                <div className="text-xs font-semibold text-white">
                  Link Status: {isActive ? 'Active (Public)' : 'Revoked (Deactivated)'}
                </div>
                <div className="text-[11px] text-slate-400">
                  {isActive
                    ? 'Anyone with the link can request view access'
                    : 'Access blocked. Recipients will see an access revoked notice'}
                </div>
              </div>
            </div>
            <button
              type="button"
              disabled={!isAdmin}
              onClick={() => setIsActive(!isActive)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
                !isAdmin
                  ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed opacity-60'
                  : isActive
                  ? 'bg-rose-500/10 text-rose-300 border-rose-500/30 hover:bg-rose-500/20 cursor-pointer'
                  : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20 cursor-pointer'
              }`}
            >
              {isActive ? 'Revoke Access' : 'Reactivate Link'}
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Link / Bundle Name
            </label>
            <input
              type="text"
              value={title}
              disabled={!isAdmin}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
              <Folder className="w-3.5 h-3.5 text-amber-400" />
              <span>PDF Folder Location</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={folder}
                disabled={!isAdmin}
                onChange={(e) => setFolder(e.target.value)}
                placeholder="e.g. Official Handbooks, Squad Manuals"
                className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-amber-400 disabled:opacity-60 disabled:cursor-not-allowed"
              />
              <select
                disabled={!isAdmin}
                onChange={(e) => setFolder(e.target.value)}
                value={['Official Handbooks', 'Squad Manuals & Guides', 'Operational Reports', 'Confidential Packets', 'General PDFs'].includes(folder) ? folder : ''}
                className="px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-400 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                <option value="" disabled>Presets...</option>
                <option value="Official Handbooks">Official Handbooks</option>
                <option value="Squad Manuals & Guides">Squad Manuals & Guides</option>
                <option value="Operational Reports">Operational Reports</option>
                <option value="Confidential Packets">Confidential Packets</option>
                <option value="General PDFs">General PDFs</option>
              </select>
            </div>
          </div>

          {/* INDIVIDUAL PDF DELETION & MANAGEMENT */}
          {enclosedFiles.length > 0 && (
            <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>PDFs in this Document ({enclosedFiles.length}):</span>
                <span className="font-mono text-indigo-400 font-normal">{totalPagesCount} Pages Total</span>
              </div>
              <div className="text-[11px] text-slate-400">
                You can delete any individual PDF at any time:
              </div>

              <div className="space-y-1.5 pt-1 max-h-48 overflow-y-auto pr-1">
                {enclosedFiles.map((f, i) => (
                  <div
                    key={f.id || i}
                    className="text-xs text-slate-300 flex items-center justify-between bg-slate-900/80 p-2.5 rounded-xl border border-slate-800/80 hover:border-slate-700 transition"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                      <span className="w-5 h-5 rounded-lg bg-indigo-600/25 text-indigo-300 text-[10px] flex items-center justify-center font-bold shrink-0">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-white truncate" title={f.title}>
                          {f.title}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
                          <span className="truncate max-w-[140px]">{f.originalFilename}</span>
                          <span>•</span>
                          <span>{f.pageCount}p</span>
                          <span>•</span>
                          <span>{(f.fileSize / 1024).toFixed(0)} KB</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteSingleFile(f.id, f.title)}
                      disabled={!isAdmin || deletingFileId === f.id}
                      className={`px-2.5 py-1 rounded-lg transition shrink-0 flex items-center gap-1 text-[11px] font-semibold border ${
                        !isAdmin
                          ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed opacity-60'
                          : 'text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600 border-rose-500/20 hover:border-rose-500 cursor-pointer'
                      }`}
                      title={!isAdmin ? 'Admin Only: Cannot delete files' : `Delete ${f.title} from this link`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{deletingFileId === f.id ? 'Deleting...' : 'Delete PDF'}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Passcode */}
          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-xs font-medium text-white">Require Passcode to View</span>
              </div>
              <input
                type="checkbox"
                checked={hasPassword}
                disabled={!isAdmin}
                onChange={(e) => setHasPassword(e.target.checked)}
                className="accent-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            {hasPassword && (
              <input
                type="text"
                value={password}
                disabled={!isAdmin}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter new passcode"
                className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500 mt-1 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            )}
          </div>

          {/* Email Gate */}
          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-xs font-medium text-white">Require Recipient Email</span>
            </div>
            <input
              type="checkbox"
              checked={requireEmail}
              disabled={!isAdmin}
              onChange={(e) => setRequireEmail(e.target.checked)}
              className="accent-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Watermarking */}
          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center gap-2">
              <Eye className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-xs font-medium text-white">Watermark Text</span>
            </div>
            <input
              type="text"
              value={watermarkText}
              disabled={!isAdmin}
              onChange={(e) => setWatermarkText(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
            />
            <div className="flex items-center gap-4 text-xs text-slate-300 pt-1">
              <label className={`flex items-center gap-1.5 ${isAdmin ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
                <input
                  type="checkbox"
                  checked={includeViewerEmail}
                  disabled={!isAdmin}
                  onChange={(e) => setIncludeViewerEmail(e.target.checked)}
                  className="accent-indigo-500"
                />
                <span>Include viewer email</span>
              </label>
              <label className={`flex items-center gap-1.5 ${isAdmin ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
                <input
                  type="checkbox"
                  checked={includeTimestamp}
                  disabled={!isAdmin}
                  onChange={(e) => setIncludeTimestamp(e.target.checked)}
                  className="accent-indigo-500"
                />
                <span>Include timestamp</span>
              </label>
            </div>
          </div>

          {/* Action Row & Delete Entire Document */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
            {isAdmin ? (
              <button
                type="button"
                onClick={handleDeleteEntireDocument}
                disabled={isDeletingAll}
                className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/30 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeletingAll ? 'Deleting Link...' : 'Delete Entire Link'}</span>
              </button>
            ) : (
              <span className="text-xs text-amber-400/90 flex items-center gap-1.5 font-medium">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Settings locked to Admins</span>
              </span>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-lg text-slate-400 hover:text-white text-xs font-medium cursor-pointer"
              >
                {isAdmin ? 'Cancel' : 'Close'}
              </button>
              {isAdmin && (
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" /> Save Changes
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
