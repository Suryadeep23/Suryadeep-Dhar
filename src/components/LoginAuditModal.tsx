import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  Mail,
  Phone,
  Clock,
  Shield,
  Search,
  Download,
  Trash2,
  RefreshCw,
  Check,
  Copy,
  UserCheck,
  Calendar,
  Globe,
  Monitor,
  Sparkles,
} from 'lucide-react';
import { TheHelpingSquadLogo } from './TheHelpingSquadLogo';
import { authService } from '../services/authService';
import { LoginAuditEntry } from '../types/auth';

interface LoginAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LoginAuditModal: React.FC<LoginAuditModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [logs, setLogs] = useState<LoginAuditEntry[]>([]);
  const [members, setMembers] = useState<
    { name: string; email: string; phone?: string; role: string; lastLogin: string; loginCount: number }[]
  >([]);
  const [totalLogins, setTotalLogins] = useState(0);
  const [loading, setLoading] = useState(true);

  // View tabs: 'members' or 'history'
  const [activeTab, setActiveTab] = useState<'members' | 'history'>('members');

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState<'all' | 'gmail' | 'phone'>('all');
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  const fetchLogins = async () => {
    setLoading(true);
    try {
      const data = await authService.getLoginLogs();
      setLogs(data.logs || []);
      setMembers(data.members || []);
      setTotalLogins(data.totalLogins || 0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLogins();
    }
  }, [isOpen]);

  const currentUser = authService.getCurrentUser();
  const isAdmin = Boolean(currentUser && (currentUser.role === 'admin' || currentUser.isOwner));
  if (!isOpen || !isAdmin) return null;

  const handleCopyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  // Export as CSV
  const handleExportCsv = () => {
    const headers = ['Name', 'Email Address', 'Phone Number', 'Role', 'Login Method', 'Login Timestamp', 'IP Address', 'User Agent'];
    const rows = logs.map((l) => [
      `"${l.name.replace(/"/g, '""')}"`,
      `"${l.email.replace(/"/g, '""')}"`,
      `"${(l.phone || '').replace(/"/g, '""')}"`,
      `"${l.role}"`,
      `"${l.identifierType}"`,
      `"${new Date(l.timestamp).toLocaleString()}"`,
      `"${l.ip || 'Unknown'}"`,
      `"${(l.userAgent || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `the_helping_squad_logins_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleClearHistory = async () => {
    try {
      await authService.clearLoginLogs();
      await fetchLogins();
    } catch {}
  };

  // Filtered members
  const filteredMembers = members.filter((m) => {
    const matchesQuery =
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.phone && m.phone.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesQuery;
  });

  // Filtered logs
  const filteredLogs = logs.filter((l) => {
    const matchesQuery =
      l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.phone && l.phone.toLowerCase().includes(searchQuery.toLowerCase()));

    if (methodFilter === 'gmail') return matchesQuery && l.identifierType === 'gmail';
    if (methodFilter === 'phone') return matchesQuery && l.identifierType === 'phone';
    return matchesQuery;
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full p-6 sm:p-7 shadow-2xl text-slate-100 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-0.5 rounded-full bg-amber-400/10 border border-amber-400/30 shrink-0">
              <TheHelpingSquadLogo size={42} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-xs uppercase tracking-wider bg-gradient-to-r from-amber-400 to-orange-400 text-slate-950 px-2.5 py-0.5 rounded-full shadow-sm">
                  The Helping Squad
                </span>
                <h2 className="text-lg font-bold text-white">Login Directory & Audit Trail</h2>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Names and email addresses of everyone who logs into the document portal
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

        {/* Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4 shrink-0">
          <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-2xl">
            <div className="text-[11px] text-slate-400 flex items-center justify-between">
              <span>Total Members</span>
              <Users className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-black text-white mt-1">{members.length}</div>
            <div className="text-[10px] text-slate-500">Unique user accounts</div>
          </div>

          <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-2xl">
            <div className="text-[11px] text-slate-400 flex items-center justify-between">
              <span>Total Logins</span>
              <UserCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-emerald-400 mt-1">{totalLogins}</div>
            <div className="text-[10px] text-slate-500">Recorded sessions</div>
          </div>

          <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-2xl">
            <div className="text-[11px] text-slate-400 flex items-center justify-between">
              <span>Gmail Logins</span>
              <Mail className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl font-black text-white mt-1">
              {logs.filter((l) => l.identifierType === 'gmail').length}
            </div>
            <div className="text-[10px] text-slate-500">Email authenticated</div>
          </div>

          <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-2xl">
            <div className="text-[11px] text-slate-400 flex items-center justify-between">
              <span>Phone Logins</span>
              <Phone className="w-4 h-4 text-sky-400" />
            </div>
            <div className="text-2xl font-black text-sky-400 mt-1">
              {logs.filter((l) => l.identifierType === 'phone').length}
            </div>
            <div className="text-[10px] text-slate-500">SMS / Mobile auth</div>
          </div>
        </div>

        {/* View Tab Switcher & Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 shrink-0">
          <div className="flex items-center gap-1.5 p-1 bg-slate-950 border border-slate-800 rounded-xl">
            <button
              onClick={() => setActiveTab('members')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'members'
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Members ({members.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'history'
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Login History ({logs.length})</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-400 w-44 sm:w-56"
              />
            </div>

            {activeTab === 'history' && (
              <select
                value={methodFilter}
                onChange={(e: any) => setMethodFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-amber-400 cursor-pointer"
              >
                <option value="all">All Methods</option>
                <option value="gmail">Gmail Only</option>
                <option value="phone">Phone Only</option>
              </select>
            )}

            <button
              onClick={fetchLogins}
              className="p-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
              title="Refresh login records"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[220px]">
          {loading ? (
            <div className="py-16 text-center text-slate-400">
              <div className="w-7 h-7 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs">Loading member login directory...</p>
            </div>
          ) : activeTab === 'members' ? (
            /* TAB 1: UNIQUE MEMBERS DIRECTORY WITH NAMES & EMAILS */
            filteredMembers.length === 0 ? (
              <div className="py-12 text-center text-slate-500 bg-slate-950/40 rounded-2xl border border-dashed border-slate-800">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs">No members found matching your search.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredMembers.map((member, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 bg-slate-950/70 hover:bg-slate-950 border border-slate-800/80 hover:border-slate-700 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-400 to-orange-400 text-slate-950 font-black text-sm flex items-center justify-center shrink-0 shadow-md">
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white">{member.name}</h4>
                          <span
                            className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                              member.role === 'admin'
                                ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                : member.role === 'coordinator'
                                ? 'bg-sky-500/15 text-sky-400 border-sky-500/30'
                                : 'bg-slate-800 text-slate-300 border-slate-700'
                            }`}
                          >
                            {member.role === 'admin' ? 'Squad Lead / Admin' : member.role}
                          </span>
                        </div>

                        {/* Highlighted Email Address */}
                        <div className="flex flex-wrap items-center gap-2.5 mt-1 text-xs text-slate-300 font-mono">
                          <span className="flex items-center gap-1.5 text-amber-300 font-medium bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                            <Mail className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span>{member.email}</span>
                          </span>

                          {member.phone && (
                            <span className="flex items-center gap-1.5 text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                              <Phone className="w-3 h-3 text-slate-500 shrink-0" />
                              <span>{member.phone}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 sm:self-center border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800">
                      <div className="text-right text-[11px] text-slate-400">
                        <div className="flex items-center gap-1 justify-end font-semibold text-slate-300">
                          <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{member.loginCount} {member.loginCount === 1 ? 'Login' : 'Logins'}</span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Last: {new Date(member.lastLogin).toLocaleDateString()} {new Date(member.lastLogin).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>

                      <button
                        onClick={() => handleCopyEmail(member.email)}
                        className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl border border-slate-800 transition cursor-pointer"
                        title="Copy email address"
                      >
                        {copiedEmail === member.email ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            /* TAB 2: DETAILED LOGIN AUDIT TRAIL */
            filteredLogs.length === 0 ? (
              <div className="py-12 text-center text-slate-500 bg-slate-950/40 rounded-2xl border border-dashed border-slate-800">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs">No login events match your criteria.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 text-amber-400 flex items-center justify-center font-bold text-xs shrink-0">
                        {log.identifierType === 'gmail' ? <Mail className="w-4 h-4 text-rose-400" /> : <Phone className="w-4 h-4 text-emerald-400" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{log.name}</span>
                          <span className="text-[10px] font-mono text-amber-300 bg-amber-400/10 px-1.5 py-0.2 rounded border border-amber-400/20">
                            {log.email}
                          </span>
                          <span className="text-[10px] text-slate-400 font-semibold bg-slate-900 px-1.5 py-0.2 rounded border border-slate-800 uppercase">
                            {log.identifierType}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5 font-mono">
                          <span>IP: {log.ip || '127.0.0.1'}</span>
                          <span>•</span>
                          <span className="truncate max-w-[220px]">{log.userAgent || 'Web Browser'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right text-[11px] text-slate-400 font-mono shrink-0">
                      <div>{new Date(log.timestamp).toLocaleDateString()}</div>
                      <div className="text-[10px] text-slate-500">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span>All login sessions are logged for security & compliance</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {logs.length > 0 && (
              <button
                onClick={handleClearHistory}
                className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition cursor-pointer border border-transparent hover:border-rose-500/20"
                title="Clear login audit history"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={handleExportCsv}
              disabled={logs.length === 0}
              className="flex-1 sm:flex-none px-3.5 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-semibold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 border border-slate-700"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black rounded-xl transition cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
