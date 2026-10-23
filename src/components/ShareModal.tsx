import React, { useState } from 'react';
import {
  X,
  Copy,
  Check,
  ExternalLink,
  ShieldAlert,
  QrCode,
  Mail,
  Lock,
  Eye,
  Clock,
  Sparkles,
} from 'lucide-react';
import { DocumentRecord } from '../types/document';
import { documentService } from '../services/documentService';
import { TheHelpingSquadLogo } from './TheHelpingSquadLogo';

interface ShareModalProps {
  document: DocumentRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenViewer: (docId: string) => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  document,
  isOpen,
  onClose,
  onOpenViewer,
}) => {
  const [copied, setCopied] = useState(false);
  const [copiedTemplate, setCopiedTemplate] = useState(false);
  const [showQr, setShowQr] = useState(false);

  if (!isOpen || !document) return null;

  const shareUrl = documentService.getShareUrl(document.id);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2400);
  };

  const emailSubject = encodeURIComponent(`The Helping Squad Document: ${document.title}`);
  const emailBody = `Hi,\n\nPlease find the confidential, view-only document link from The Helping Squad below:\n\n${document.title}\n${shareUrl}\n\nNotice: This document is protected with a strict zero-download and anti-print policy. Every page is dynamically watermarked.\n\nBest regards,\nThe Helping Squad`;

  const handleCopyEmailTemplate = () => {
    navigator.clipboard.writeText(emailBody);
    setCopiedTemplate(true);
    setTimeout(() => setCopiedTemplate(false), 2400);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl text-slate-100">
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
                <h2 className="text-base font-bold text-white">Share Secure Link</h2>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Recipients can view only — zero downloading or saving</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-slate-300">Document Bundle</span>
              {document.files && document.files.length > 1 && (
                <span className="text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full">
                  {document.files.length} PDFs in 1 Link
                </span>
              )}
            </div>
            <div className="text-sm font-bold text-white truncate">{document.title}</div>
            {document.files && document.files.length > 1 && (
              <div className="mt-2 p-2.5 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1 text-xs">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Included in this link:
                </div>
                {document.files.map((f, i) => (
                  <div key={f.id || i} className="text-slate-300 flex items-center justify-between">
                    <span className="truncate max-w-[280px]">
                      <span className="text-indigo-400 font-bold">{i + 1}.</span> {f.title}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">{f.pageCount}p</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Share Link Input with One-Click Copy */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Secure Shareable URL
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-indigo-300 truncate focus:outline-none"
              />
              <button
                onClick={handleCopyLink}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shrink-0 shadow-lg shadow-indigo-600/20"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-300" /> Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" /> Copy Link
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Active Security Protections Card */}
          <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Enforced Security Controls
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1.5 text-emerald-400">
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span>Download & Save Disabled</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-400">
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span>Printing (Ctrl+P) Blocked</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-300">
                <Lock className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span>
                  Passcode: {document.settings?.password ? 'Protected' : 'None'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-300">
                <Eye className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span>
                  Watermark: {document.settings?.watermarkText ? 'Active' : 'Disabled'}
                </span>
              </div>
            </div>
          </div>

          {/* QR Code toggle */}
          {showQr && (
            <div className="p-4 bg-white rounded-xl flex flex-col items-center justify-center text-slate-900">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                  shareUrl
                )}`}
                alt="QR Code"
                className="w-40 h-40"
              />
              <p className="text-xs font-medium text-slate-600 mt-2">
                Scan on mobile to test View-Only Mode
              </p>
            </div>
          )}

          {/* Action Row */}
          <div className="pt-2 flex flex-wrap items-center gap-2">
            <button
              onClick={() => onOpenViewer(document.id)}
              className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium transition cursor-pointer flex items-center justify-center gap-1.5 border border-slate-700"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Test Recipient View
            </button>
            <button
              onClick={() => setShowQr(!showQr)}
              className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5 border border-slate-700"
            >
              <QrCode className="w-3.5 h-3.5" /> {showQr ? 'Hide QR' : 'Show QR'}
            </button>
            <button
              onClick={handleCopyEmailTemplate}
              className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5 border border-slate-700"
            >
              <Mail className="w-3.5 h-3.5" />
              {copiedTemplate ? 'Template Copied!' : 'Copy Email Text'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
