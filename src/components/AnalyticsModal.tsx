import React, { useEffect, useState } from 'react';
import {
  X,
  Activity,
  User,
  Mail,
  Clock,
  Globe,
  Monitor,
  Shield,
  FileText,
} from 'lucide-react';
import { DocumentRecord, AccessLog } from '../types/document';
import { documentService } from '../services/documentService';
import { TheHelpingSquadLogo } from './TheHelpingSquadLogo';

interface AnalyticsModalProps {
  document: DocumentRecord | null;
  isOpen: boolean;
  onClose: () => void;
}

export const AnalyticsModal: React.FC<AnalyticsModalProps> = ({
  document,
  isOpen,
  onClose,
}) => {
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [totalViews, setTotalViews] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!isOpen || !document) return;

    let isMounted = true;
    async function loadAnalytics() {
      setLoading(true);
      try {
        const data = await documentService.getAnalytics(document!.id);
        if (isMounted) {
          setLogs(data.accessLogs || []);
          setTotalViews(data.viewsCount || 0);
        }
      } catch (err) {
        console.warn('Failed to load analytics', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadAnalytics();
    return () => {
      isMounted = false;
    };
  }, [isOpen, document]);

  if (!isOpen || !document) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl text-slate-100 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-0.5 rounded-full bg-amber-400/10 border border-amber-400/30 shrink-0">
              <TheHelpingSquadLogo size={40} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-xs uppercase tracking-wider bg-gradient-to-r from-amber-400 to-orange-400 text-slate-950 px-2 py-0.5 rounded shadow-sm">
                  The Helping Squad
                </span>
                <h2 className="text-base font-bold text-white">Viewer Audit & Analytics</h2>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Track viewing sessions for <span className="text-slate-200 font-medium">{document.title}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick KPI stats */}
        <div className="grid grid-cols-3 gap-3 my-4 shrink-0">
          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl text-center">
            <div className="text-xs text-slate-400 font-medium">Total Views</div>
            <div className="text-2xl font-bold text-white mt-0.5">{totalViews}</div>
          </div>
          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl text-center">
            <div className="text-xs text-slate-400 font-medium">Verified Viewers</div>
            <div className="text-2xl font-bold text-indigo-400 mt-0.5">
              {new Set(logs.map((l) => l.viewerEmail).filter((e) => e && e !== 'Undisclosed')).size}
            </div>
          </div>
          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl text-center">
            <div className="text-xs text-slate-400 font-medium">Link Status</div>
            <div className="text-sm font-semibold mt-1">
              {document.isActive ? (
                <span className="text-emerald-400">Active</span>
              ) : (
                <span className="text-rose-400">Deactivated</span>
              )}
            </div>
          </div>
        </div>

        {/* Access Log Table / List */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Access Session Logs ({logs.length})
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              Loading audit logs...
            </div>
          ) : logs.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs bg-slate-950/40 rounded-xl border border-slate-800/60 p-6">
              No viewers have accessed this document yet. Share the link to begin tracking!
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="p-3 bg-slate-950/80 border border-slate-800/80 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:border-slate-700 transition"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="font-semibold text-white">{log.viewerName || 'Anonymous Viewer'}</span>
                    {log.viewerEmail && log.viewerEmail !== 'Undisclosed' && (
                      <span className="text-slate-400 bg-slate-900 px-2 py-0.5 rounded text-[11px] font-mono border border-slate-800">
                        {log.viewerEmail}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <Globe className="w-3 h-3" />
                      IP: {log.ip || 'Local'}
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 bg-slate-900/60 px-2.5 py-1 rounded border border-slate-800 truncate max-w-xs">
                  {log.userAgent ? (
                    log.userAgent.includes('Mac')
                      ? 'macOS'
                      : log.userAgent.includes('Windows')
                      ? 'Windows'
                      : log.userAgent.includes('iPhone')
                      ? 'iPhone'
                      : log.userAgent.includes('Android')
                      ? 'Android'
                      : 'Web Browser'
                  ) : (
                    'Browser'
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="pt-4 border-t border-slate-800 mt-3 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
