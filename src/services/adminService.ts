import { AdminMember, AddAdminRequest } from '../types/auth';
import { getAuthHeaders } from './authService';

const ADMIN_STORAGE_KEY = 'the_helping_squad_admin_members';

const DEFAULT_ADMINS: AdminMember[] = [
  {
    id: 'adm_lead',
    name: 'Suryadeep Dhar',
    identifier: 'dharsuryadeep@gmail.com',
    identifierType: 'gmail',
    email: 'dharsuryadeep@gmail.com',
    role: 'admin',
    canUpload: true,
    password: 'password123',
    addedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
    addedBy: 'System',
    note: 'Lead Admin & Squad Founder',
    isOwner: true,
    uploadsCount: 3,
  },
  {
    id: 'adm_friend_1',
    name: 'Friend 1 (Alex Rivera)',
    identifier: 'alex.friend1@gmail.com',
    identifierType: 'gmail',
    email: 'alex.friend1@gmail.com',
    role: 'admin',
    canUpload: true,
    password: 'password123',
    addedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    addedBy: 'Suryadeep Dhar',
    note: 'Friend 1 • Authorized PDF Uploader',
    isOwner: false,
    uploadsCount: 1,
  },
  {
    id: 'adm_friend_2',
    name: 'Friend 2 (Priya Patel)',
    identifier: 'priya.friend2@gmail.com',
    identifierType: 'gmail',
    email: 'priya.friend2@gmail.com',
    role: 'admin',
    canUpload: true,
    password: 'password123',
    addedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    addedBy: 'Suryadeep Dhar',
    note: 'Friend 2 • Authorized PDF Uploader',
    isOwner: false,
    uploadsCount: 0,
  },
  {
    id: 'adm_friend_3',
    name: 'Friend 3 (Sam Taylor)',
    identifier: '+1 (555) 345-9876',
    identifierType: 'phone',
    phone: '+1 (555) 345-9876',
    email: 'sam.friend3@thehelpingsquad.org',
    role: 'admin',
    canUpload: true,
    password: 'password123',
    addedAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    addedBy: 'Suryadeep Dhar',
    note: 'Friend 3 • Authorized PDF Uploader',
    isOwner: false,
    uploadsCount: 0,
  },
];

export const adminService = {
  // Read local backup cache
  getLocalMembers(): AdminMember[] {
    try {
      const raw = localStorage.getItem(ADMIN_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_ADMINS;
  },

  // Save local backup cache
  saveLocalMembers(members: AdminMember[]) {
    try {
      localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(members));
    } catch {}
  },

  // Fetch all admins & uploaders
  async getMembers(): Promise<{
    members: AdminMember[];
    totalAdmins: number;
    canUploadCount: number;
  }> {
    try {
      const res = await fetch('/api/admin/members', {
        headers: {
          ...getAuthHeaders(),
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.members) {
          this.saveLocalMembers(data.members);
          return data;
        }
      }
    } catch {}

    const local = this.getLocalMembers();
    return {
      members: local,
      totalAdmins: local.filter((m) => m.role === 'admin').length,
      canUploadCount: local.filter((m) => m.canUpload).length,
    };
  },

  // Add new admin or friend
  async addMember(data: AddAdminRequest): Promise<AdminMember> {
    try {
      const res = await fetch('/api/admin/members', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const result = await res.json();
        if (result.member) {
          const current = this.getLocalMembers().filter((m) => m.id !== result.member.id);
          current.push(result.member);
          this.saveLocalMembers(current);
          return result.member;
        }
      }
    } catch {}

    // Fallback local addition
    const local = this.getLocalMembers();
    const isGmail = data.identifierType === 'gmail' || data.identifier.includes('@');
    const newMember: AdminMember = {
      id: 'adm_' + Math.random().toString(36).substring(2, 9),
      name: data.name.trim(),
      identifier: data.identifier.trim(),
      identifierType: isGmail ? 'gmail' : 'phone',
      email: isGmail ? data.identifier.trim() : `${data.name.toLowerCase().replace(/[^a-z0-9]/g, '.')}@thehelpingsquad.org`,
      phone: !isGmail ? `${data.countryCode || '+1'} ${data.identifier.trim()}` : undefined,
      role: data.role || 'admin',
      canUpload: data.canUpload ?? true,
      password: data.password || 'password123',
      addedAt: new Date().toISOString(),
      addedBy: 'Suryadeep Dhar',
      uploadsCount: 0,
      note: data.note || 'Friend Admin • PDF Uploader',
      isOwner: false,
    };

    const existingIdx = local.findIndex(
      (m) =>
        m.identifier.toLowerCase() === newMember.identifier.toLowerCase() ||
        (m.email && m.email.toLowerCase() === newMember.identifier.toLowerCase())
    );

    if (existingIdx >= 0) {
      local[existingIdx] = { ...local[existingIdx], ...newMember, id: local[existingIdx].id };
    } else {
      local.push(newMember);
    }

    this.saveLocalMembers(local);
    return newMember;
  },

  // Fast 3-Friends Batch Setup
  async quickSetup3Friends(
    friends: {
      name: string;
      identifier: string;
      identifierType: 'gmail' | 'phone';
      password?: string;
      note?: string;
    }[]
  ): Promise<AdminMember[]> {
    try {
      const res = await fetch('/api/admin/quick-setup-3-friends', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ friends }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.members) {
          this.saveLocalMembers(data.members);
          return data.members;
        }
      }
    } catch {}

    // Local batch update
    const local = [...this.getLocalMembers()];
    friends.forEach((f, idx) => {
      if (!f.name || !f.identifier) return;
      const isGmail = f.identifierType === 'gmail' || f.identifier.includes('@');
      const slotId = (f as any).slotId || (f as any).id || `adm_friend_${idx + 1}`;
      const existingIdx = local.findIndex((m) => m.id === slotId || m.identifier.toLowerCase() === f.identifier.toLowerCase());

      const memberObj: AdminMember = {
        id: slotId,
        name: f.name.trim(),
        identifier: f.identifier.trim(),
        identifierType: isGmail ? 'gmail' : 'phone',
        email: isGmail ? f.identifier.trim() : `${f.name.toLowerCase().replace(/[^a-z0-9]/g, '.')}@thehelpingsquad.org`,
        phone: !isGmail ? f.identifier.trim() : undefined,
        role: 'admin',
        canUpload: true,
        password: f.password || 'password123',
        addedAt: new Date().toISOString(),
        addedBy: 'Suryadeep Dhar',
        uploadsCount: existingIdx >= 0 ? local[existingIdx].uploadsCount || 0 : 0,
        note: f.note || `Friend ${idx + 1} • Authorized PDF Uploader`,
        isOwner: false,
      };

      if (existingIdx >= 0) {
        local[existingIdx] = memberObj;
      } else {
        local.push(memberObj);
      }
    });

    this.saveLocalMembers(local);
    return local;
  },

  // Update member
  async updateMember(id: string, updates: Partial<AdminMember>): Promise<AdminMember> {
    try {
      const res = await fetch(`/api/admin/members/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.member) {
          const local = this.getLocalMembers().map((m) => (m.id === id ? data.member : m));
          this.saveLocalMembers(local);
          return data.member;
        }
      }
    } catch {}

    const local = this.getLocalMembers();
    const idx = local.findIndex((m) => m.id === id);
    if (idx >= 0) {
      local[idx] = { ...local[idx], ...updates };
      this.saveLocalMembers(local);
      return local[idx];
    }
    throw new Error('Member not found');
  },

  // Remove admin member
  async removeMember(id: string): Promise<void> {
    try {
      await fetch(`/api/admin/members/${id}`, {
        method: 'DELETE',
        headers: {
          ...getAuthHeaders(),
        },
      });
    } catch {}

    const local = this.getLocalMembers().filter((m) => m.id !== id);
    this.saveLocalMembers(local);
  },

  // Check if a given identifier has PDF upload permission
  async checkCanUpload(identifier?: string): Promise<boolean> {
    if (!identifier) return false;
    const clean = identifier.toLowerCase();
    if (clean.includes('dharsuryadeep') || clean.includes('admin')) return true;

    try {
      const data = await this.getMembers();
      const found = data.members.find(
        (m) =>
          m.identifier.toLowerCase() === clean ||
          (m.email && m.email.toLowerCase() === clean)
      );
      if (found) {
        return found.canUpload && found.role === 'admin';
      }
    } catch {}

    return false;
  },
};
