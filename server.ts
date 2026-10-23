import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, 'data');
const DB_FILE = path.resolve(DATA_DIR, 'documents.json');
const LOGINS_FILE = path.resolve(DATA_DIR, 'logins.json');
const FOLDERS_FILE = path.resolve(DATA_DIR, 'folders.json');
const UPLOADS_DIR = path.resolve(DATA_DIR, 'uploads');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Helpers to save and load PDF binary content directly to/from disk for high-capacity 400MB support
function savePdfFileToDisk(fileId: string, pdfBase64: string): string {
  try {
    if (!pdfBase64) return '';
    const filePath = path.resolve(UPLOADS_DIR, `${fileId}.pdf`);
    const cleanBase64 = pdfBase64.includes(',') ? pdfBase64.split(',')[1] : pdfBase64;
    const sanitized = cleanBase64.replace(/[\s\r\n]+/g, '');
    const buffer = Buffer.from(sanitized, 'base64');
    fs.writeFileSync(filePath, buffer);
    return filePath;
  } catch (err) {
    console.error(`Error saving PDF ${fileId} to disk:`, err);
    return '';
  }
}

function loadPdfBase64FromDisk(fileId: string, fallbackBase64?: string): string {
  try {
    const filePath = path.resolve(UPLOADS_DIR, `${fileId}.pdf`);
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      // For large files (>15MB), do not create huge Base64 strings to prevent Node.js V8 heap crashes; streaming route is used instead
      if (stats.size > 15 * 1024 * 1024) {
        return '';
      }
      const buffer = fs.readFileSync(filePath);
      return `data:application/pdf;base64,${buffer.toString('base64')}`;
    }
  } catch (err) {
    console.error(`Error loading PDF ${fileId} from disk:`, err);
  }
  return fallbackBase64 || '';
}

function deletePdfFileFromDisk(fileId: string) {
  try {
    const filePath = path.resolve(UPLOADS_DIR, `${fileId}.pdf`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.error(`Error deleting PDF ${fileId} from disk:`, err);
  }
}

export interface FolderData {
  customFolders: string[];
  deletedFolders: string[];
}

function loadFoldersData(): FolderData {
  try {
    if (fs.existsSync(FOLDERS_FILE)) {
      const data = fs.readFileSync(FOLDERS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      return {
        customFolders: Array.isArray(parsed.customFolders) ? parsed.customFolders : [],
        deletedFolders: Array.isArray(parsed.deletedFolders) ? parsed.deletedFolders : [],
      };
    }
  } catch (err) {
    console.error('Error loading folders:', err);
  }
  return { customFolders: [], deletedFolders: [] };
}

function saveFoldersData(data: FolderData) {
  try {
    fs.writeFileSync(FOLDERS_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error saving folders:', err);
  }
}

export interface LoginAuditEntry {
  id: string;
  name: string;
  email: string;
  phone?: string;
  identifier: string;
  identifierType: 'gmail' | 'phone';
  role: 'admin' | 'coordinator' | 'volunteer';
  timestamp: string;
  ip: string;
  userAgent: string;
}

function loadLogins(): LoginAuditEntry[] {
  try {
    if (fs.existsSync(LOGINS_FILE)) {
      const data = fs.readFileSync(LOGINS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (err) {
    console.error('Error loading logins:', err);
  }
  return [
    {
      id: 'login_seed_1',
      name: 'Suryadeep Dhar',
      email: 'dharsuryadeep@gmail.com',
      identifier: 'dharsuryadeep@gmail.com',
      identifierType: 'gmail',
      role: 'admin',
      timestamp: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
      ip: '192.168.1.42',
      userAgent: 'Chrome on macOS',
    },
    {
      id: 'login_seed_2',
      name: 'Elena Rostova',
      email: 'elena.rostova@thehelpingsquad.org',
      phone: '+1 (555) 789-2341',
      identifier: '+1 (555) 789-2341',
      identifierType: 'phone',
      role: 'coordinator',
      timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      ip: '192.168.1.18',
      userAgent: 'Safari on iPhone',
    },
    {
      id: 'login_seed_3',
      name: 'Marcus Vance',
      email: 'volunteer.marcus@gmail.com',
      identifier: 'volunteer.marcus@gmail.com',
      identifierType: 'gmail',
      role: 'volunteer',
      timestamp: new Date(Date.now() - 1000 * 60 * 95).toISOString(),
      ip: '192.168.1.88',
      userAgent: 'Firefox on Windows',
    },
  ];
}

function saveLogins(logs: LoginAuditEntry[]) {
  try {
    fs.writeFileSync(LOGINS_FILE, JSON.stringify(logs, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving logins to disk:', err);
  }
}

let loginLogs: LoginAuditEntry[] = loadLogins();

const ADMINS_FILE = path.resolve(DATA_DIR, 'admins.json');

export interface AdminMember {
  id: string;
  name: string;
  identifier: string; // Gmail or phone
  identifierType: 'gmail' | 'phone';
  email?: string;
  phone?: string;
  role: 'admin' | 'coordinator' | 'volunteer';
  canUpload: boolean;
  password?: string;
  addedAt: string;
  addedBy?: string;
  lastLoginAt?: string;
  uploadsCount?: number;
  note?: string;
  isOwner?: boolean;
}

function loadAdmins(): AdminMember[] {
  try {
    if (fs.existsSync(ADMINS_FILE)) {
      const data = fs.readFileSync(ADMINS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (err) {
    console.error('Error loading admins:', err);
  }
  return [
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
}

function saveAdmins(adm: AdminMember[]) {
  try {
    fs.writeFileSync(ADMINS_FILE, JSON.stringify(adm, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving admins to disk:', err);
  }
}

let adminMembers: AdminMember[] = loadAdmins();

const USERS_FILE = path.resolve(DATA_DIR, 'users.json');

export interface RegisteredUserRecord {
  id: string;
  name: string;
  identifier: string;
  identifierType: 'gmail' | 'phone';
  email?: string;
  phone?: string;
  countryCode?: string;
  password: string;
  role: 'admin' | 'coordinator' | 'volunteer';
  canUpload?: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

function loadRegisteredUsers(): RegisteredUserRecord[] {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const data = fs.readFileSync(USERS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed.map((u) => {
          const isLead =
            u.email?.toLowerCase() === 'dharsuryadeep@gmail.com' ||
            u.identifier?.toLowerCase() === 'dharsuryadeep@gmail.com';
          const isAdminMember = adminMembers.some(
            (a) =>
              a.role === 'admin' &&
              (a.id === u.id || (a.email && a.email.toLowerCase() === u.email?.toLowerCase()))
          );
          if (isLead || isAdminMember) {
            return { ...u, role: 'admin' as const, canUpload: true };
          }
          return { ...u, role: 'volunteer' as const, canUpload: false };
        });
      }
    }
  } catch (err) {
    console.error('Error loading registered users:', err);
  }
  return [];
}

function saveRegisteredUsers(users: RegisteredUserRecord[]) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving registered users to disk:', err);
  }
}

let registeredUsers: RegisteredUserRecord[] = loadRegisteredUsers();

const SETTINGS_FILE = path.resolve(DATA_DIR, 'portal-settings.json');

export interface SquadPortalSettings {
  defaultWatermarkText: string;
  defaultWatermarkOpacity: number;
  antiScreenBlur: boolean;
  requireEmailDefault: boolean;
  requirePasscodeDefault: boolean;
  defaultPasscode: string;
  enforceAdminOnlyUploads: boolean;
  allowGuestsToView: boolean;
  autoExpireDays: number;
  blockPrintingAndSave: boolean;
  showForensicAuditInfo: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

const DEFAULT_PORTAL_SETTINGS: SquadPortalSettings = {
  defaultWatermarkText: 'THE HELPING SQUAD • VIEW ONLY',
  defaultWatermarkOpacity: 0.22,
  antiScreenBlur: true,
  requireEmailDefault: false,
  requirePasscodeDefault: false,
  defaultPasscode: '',
  enforceAdminOnlyUploads: true,
  allowGuestsToView: true,
  autoExpireDays: 0,
  blockPrintingAndSave: true,
  showForensicAuditInfo: true,
};

function loadSettings(): SquadPortalSettings {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      return { ...DEFAULT_PORTAL_SETTINGS, ...parsed };
    }
  } catch (err) {
    console.error('Error loading settings:', err);
  }
  return DEFAULT_PORTAL_SETTINGS;
}

function saveSettings(settings: SquadPortalSettings) {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving settings to disk:', err);
  }
}

let portalSettings: SquadPortalSettings = loadSettings();


export interface AccessLog {
  id: string;
  timestamp: string;
  viewerName?: string;
  viewerEmail?: string;
  ip?: string;
  userAgent?: string;
}

export interface DocumentSettings {
  password?: string;
  expiresAt?: string | null;
  maxViews?: number | null;
  requireEmail?: boolean;
  watermarkText?: string;
  includeViewerEmailInWatermark?: boolean;
  includeTimestampInWatermark?: boolean;
  watermarkOpacity?: number;
  antiScreenBlur?: boolean;
}

export interface PdfDocumentItem {
  id: string;
  title: string;
  originalFilename: string;
  fileSize: number;
  pageCount: number;
  pdfBase64: string;
  rawUrl?: string;
}

export interface DocumentRecord {
  id: string;
  title: string;
  folder?: string;
  files: PdfDocumentItem[];
  originalFilename?: string;
  fileSize: number;
  pageCount: number;
  createdAt: string;
  isActive: boolean;
  viewsCount: number;
  settings: DocumentSettings;
  pdfBase64?: string;
  accessLogs: AccessLog[];
}

function normalizeDoc(doc: any): DocumentRecord {
  const files: PdfDocumentItem[] = Array.isArray(doc.files) && doc.files.length > 0
    ? doc.files.map((f: any, idx: number) => ({
        id: f.id || `f_${idx + 1}`,
        title: f.title || f.originalFilename || `Document ${idx + 1}`,
        originalFilename: f.originalFilename || 'document.pdf',
        fileSize: f.fileSize || 0,
        pageCount: f.pageCount || 1,
        pdfBase64: f.pdfBase64 || '',
      }))
    : doc.pdfBase64
    ? [
        {
          id: 'f_1',
          title: doc.title || doc.originalFilename || 'Document 1',
          originalFilename: doc.originalFilename || 'document.pdf',
          fileSize: doc.fileSize || 0,
          pageCount: doc.pageCount || 1,
          pdfBase64: doc.pdfBase64,
        },
      ]
    : [];

  const totalSize = files.reduce((sum, f) => sum + (f.fileSize || 0), 0) || doc.fileSize || 0;
  const totalPages = files.reduce((sum, f) => sum + (f.pageCount || 1), 0) || doc.pageCount || 1;

  return {
    id: doc.id,
    title: doc.title || files[0]?.title || 'Untitled Document Pack',
    folder: (doc.folder && typeof doc.folder === 'string' && doc.folder.trim()) ? doc.folder.trim() : (doc.id === 'all_handbooks' ? 'Master Collection' : 'General PDFs'),
    files,
    originalFilename: files[0]?.originalFilename || doc.originalFilename || 'document.pdf',
    fileSize: totalSize,
    pageCount: totalPages,
    createdAt: doc.createdAt || new Date().toISOString(),
    isActive: doc.isActive !== false,
    viewsCount: doc.viewsCount || 0,
    settings: {
      password: doc.settings?.password || '',
      expiresAt: doc.settings?.expiresAt || null,
      maxViews: doc.settings?.maxViews || null,
      requireEmail: Boolean(doc.settings?.requireEmail),
      watermarkText: doc.settings?.watermarkText || 'CONFIDENTIAL • VIEW ONLY',
      includeViewerEmailInWatermark: doc.settings?.includeViewerEmailInWatermark ?? true,
      includeTimestampInWatermark: doc.settings?.includeTimestampInWatermark ?? true,
      watermarkOpacity: doc.settings?.watermarkOpacity ?? 0.22,
      antiScreenBlur: doc.settings?.antiScreenBlur ?? true,
    },
    pdfBase64: files[0]?.pdfBase64,
    accessLogs: doc.accessLogs || [],
  };
}

const DELETED_DOCS_FILE = path.resolve(DATA_DIR, 'deleted_docs.json');

function loadDeletedDocs(): string[] {
  try {
    if (fs.existsSync(DELETED_DOCS_FILE)) {
      const data = fs.readFileSync(DELETED_DOCS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.error('Error loading deleted docs list:', err);
  }
  return [];
}

function saveDeletedDocs(ids: string[]) {
  try {
    fs.writeFileSync(DELETED_DOCS_FILE, JSON.stringify(ids, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving deleted docs list:', err);
  }
}

let deletedDocIds: string[] = loadDeletedDocs();

function loadDocuments(): DocumentRecord[] {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((d) => d && !deletedDocIds.includes(d.id))
          .map(normalizeDoc);
      }
    }
  } catch (err) {
    console.error('Error loading documents from disk:', err);
  }
  return [];
}

function saveDocuments(docs: DocumentRecord[]) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(docs, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving documents to disk:', err);
  }
}

const dbFileExisted = fs.existsSync(DB_FILE);
let documents: DocumentRecord[] = loadDocuments();

// ONLY seed sample documents if the database file has NEVER been created AND the user hasn't deleted all documents.
// Never re-seed if the user has deleted all documents!
if (!dbFileExisted && documents.length === 0 && !deletedDocIds.includes('all_handbooks')) {
  try {
    const files: PdfDocumentItem[] = [
      {
        id: 'f_seed_1',
        title: 'The Helping Squad - Volunteer & Community Handbook',
        originalFilename: 'The_Helping_Squad_Volunteer_Handbook.pdf',
        fileSize: 42000,
        pageCount: 2,
        pdfBase64: '',
      },
      {
        id: 'f_seed_2',
        title: 'The Helping Squad - Field Logistics & Safety Protocol',
        originalFilename: 'Field_Logistics_Safety_Protocol.pdf',
        fileSize: 39000,
        pageCount: 2,
        pdfBase64: '',
      },
      {
        id: 'f_seed_3',
        title: 'The Helping Squad - Emergency Aid & Resource Playbook',
        originalFilename: 'Emergency_Aid_Resource_Playbook.pdf',
        fileSize: 45000,
        pageCount: 2,
        pdfBase64: '',
      },
    ];
    const docId = 'all_handbooks';
    const totalSize = files.reduce((s, f) => s + f.fileSize, 0);
    const totalPages = files.reduce((s, f) => s + f.pageCount, 0);
    const initialBundle: DocumentRecord = {
      id: docId,
      title: 'The Helping Squad - Official Handbooks (All Documents)',
      files,
      originalFilename: 'The_Helping_Squad_Handbooks.pdf',
      fileSize: totalSize,
      pageCount: totalPages,
      createdAt: new Date().toISOString(),
      isActive: true,
      viewsCount: 3,
      settings: {
        password: '',
        expiresAt: null,
        maxViews: null,
        requireEmail: false,
        watermarkText: 'THE HELPING SQUAD • CONFIDENTIAL HANDBOOK',
        includeViewerEmailInWatermark: true,
        includeTimestampInWatermark: true,
        watermarkOpacity: 0.22,
        antiScreenBlur: true,
      },
      pdfBase64: files[0]?.pdfBase64,
      accessLogs: [
        {
          id: 'log_seed_1',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          viewerName: 'Community Lead',
          viewerEmail: 'lead@thehelpingsquad.org',
          ip: '192.168.1.10',
          userAgent: 'Chrome on macOS',
        },
      ],
    };
    documents = [initialBundle];
    saveDocuments(documents);
  } catch (err) {
    console.warn('Initial seed skipped:', err);
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Raw binary parser for fast binary chunks (mounted before express.json so any Content-Type on /api/upload/chunk is parsed as Buffer)
  app.use('/api/upload/chunk', express.raw({ type: '*/*', limit: '50mb' }));
  // Support up to 600MB payload to support 400MB per PDF uploads
  app.use(express.json({ limit: '600mb' }));
  app.use(express.urlencoded({ extended: true, limit: '600mb' }));

  // Prevent browser, PWA service worker, or proxy caching on all API endpoints so newly uploaded PDFs are immediately visible to all users
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });

  // API Routes
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Helper to check if an email, identifier, phone, or ID matches a verified Squad Administrator
  function isVerifiedAdminIdentity(idOrNothing?: string, emailOrId?: string, phoneStr?: string): boolean {
    const cleanId = (idOrNothing || '').trim();
    const cleanEmail = (emailOrId || '').trim().toLowerCase();
    const cleanPhone = (phoneStr || '').trim();
    const digits = (cleanEmail + ' ' + cleanPhone).replace(/\D/g, '');

    const builtInAdminEmails = [
      'dharsuryadeep@gmail.com',
      'alex.friend1@gmail.com',
      'priya.friend2@gmail.com',
      'sam.friend3@thehelpingsquad.org',
    ];
    if (cleanEmail && builtInAdminEmails.includes(cleanEmail)) {
      return true;
    }
    if (cleanId === 'adm_lead' || cleanId === 'adm_friend_1' || cleanId === 'adm_friend_2' || cleanId === 'adm_friend_3') {
      return true;
    }

    for (const a of adminMembers) {
      if (a.role !== 'admin' && !a.isOwner) continue;
      if (cleanId && a.id === cleanId) return true;
      if (cleanEmail && a.email && a.email.toLowerCase() === cleanEmail) return true;
      if (cleanEmail && a.identifier && a.identifier.toLowerCase() === cleanEmail) return true;
      if (digits.length >= 7) {
        const aDigits = ((a.phone || '') + ' ' + (a.identifier || '')).replace(/\D/g, '');
        if (aDigits.length >= 7 && (aDigits === digits || aDigits.endsWith(digits) || digits.endsWith(aDigits))) {
          return true;
        }
      }
    }
    return false;
  }

  // Helper to determine if an incoming request is authenticated as an administrator
  function isRequestFromAdmin(req: express.Request): boolean {
    const userRole = ((req.headers['x-user-role'] as string) || '').trim().toLowerCase();
    const userEmail = ((req.headers['x-user-email'] as string) || '').trim().toLowerCase();
    const userIdentifier = ((req.headers['x-user-identifier'] as string) || '').trim().toLowerCase();
    const userPhone = ((req.headers['x-user-phone'] as string) || '').trim();
    const userId = ((req.headers['x-user-id'] as string) || '').trim();
    const isBodyObj = req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body);
    const bodyEmail = isBodyObj
      ? ((req.body.uploaderIdentifier || req.body.userEmail || req.body.adminEmail || '') as string).trim().toLowerCase()
      : '';
    const uploaderId = isBodyObj ? ((req.body.uploaderId || '') as string).trim() : '';

    const candidateEmail = userIdentifier || userEmail || bodyEmail;
    const candidateId = userId || uploaderId;

    // 1. Check against verified admin identities (founder, adminMembers, phone/email/id)
    if (
      isVerifiedAdminIdentity(candidateId, candidateEmail, userPhone) ||
      isVerifiedAdminIdentity(userId, userEmail, userPhone) ||
      isVerifiedAdminIdentity(uploaderId, bodyEmail, userPhone)
    ) {
      return true;
    }

    // 2. If user is in registeredUsers and has role === 'admin', allow
    if (candidateId || candidateEmail) {
      const regAdmin = registeredUsers.find(
        (u) =>
          u.role === 'admin' &&
          ((candidateId && u.id === candidateId) ||
            (candidateEmail && u.email?.toLowerCase() === candidateEmail) ||
            (candidateEmail && u.identifier?.toLowerCase() === candidateEmail))
      );
      if (regAdmin) return true;
    }

    // 3. If header explicitly claims 'admin' role or owner status, verify it is not a hardcoded demo non-admin account
    const isOwnerHeader = req.headers['x-user-is-owner'] === 'true';
    if ((userRole === 'admin' || isOwnerHeader) && (userId || userEmail || userIdentifier)) {
      const knownDemoNonAdmin =
        candidateEmail === 'volunteer.marcus@gmail.com' ||
        candidateEmail === 'elena.rostova@thehelpingsquad.org' ||
        candidateEmail === 'member.john@gmail.com';
      if (!knownDemoNonAdmin) {
        return true;
      }
    }

    return false;
  }

  function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
    if (!isRequestFromAdmin(req)) {
      return res.status(401).json({
        error: 'Permission Denied: Administrative action blocked. Only verified Squad Administrators can upload, delete, or perform administrative actions on PDF files.',
        code: 'ADMIN_REQUIRED',
      });
    }
    next();
  }

  // Allows verified admins OR automated client-sync self-healing when restoring an existing document binary after a container restart
  function requireAdminOrSync(req: express.Request, res: express.Response, next: express.NextFunction) {
    const isSyncHeader = req.headers['x-client-sync'] === 'true';
    const isSyncBody = req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body) && req.body.isClientSync === true;
    if (isSyncHeader || isSyncBody || isRequestFromAdmin(req)) {
      return next();
    }
    return res.status(401).json({
      error: 'Permission Denied: Administrative action blocked. Only verified Squad Administrators can upload, delete, or perform administrative actions on PDF files.',
      code: 'ADMIN_REQUIRED',
    });
  }

  // Track received chunks per fileId for direct positional writes
  const uploadReceivedChunks = new Map<string, Set<number>>();

  // Write a chunk buffer directly to its exact byte offset in ${fileId}.pdf (zero extra disk space, zero assembly latency, safe for parallel & retried chunks)
  function writeUploadChunkToDisk(
    fileId: string,
    chunkIndex: number,
    totalChunks: number,
    chunkData: Buffer,
    byteOffset?: number,
    resetUpload?: boolean
  ) {
    const safeFileId = String(fileId).replace(/[^a-zA-Z0-9_-]/g, '');
    const finalPath = path.resolve(UPLOADS_DIR, `${safeFileId}.pdf`);

    if (resetUpload || totalChunks <= 1) {
      uploadReceivedChunks.delete(safeFileId);
      if (totalChunks <= 1 && fs.existsSync(finalPath)) {
        try { fs.unlinkSync(finalPath); } catch {}
      }
    }

    // For single-chunk uploads, write directly in one atomic operation
    if (totalChunks <= 1) {
      fs.writeFileSync(finalPath, chunkData);
      const stats = fs.statSync(finalPath);
      return {
        success: true,
        completed: true,
        fileId: safeFileId,
        totalBytes: stats.size,
      };
    }

    const position =
      typeof byteOffset === 'number' && !isNaN(byteOffset) && byteOffset >= 0
        ? byteOffset
        : chunkIndex * (1024 * 1024);

    if (resetUpload && chunkIndex === 0 && fs.existsSync(finalPath)) {
      try { fs.unlinkSync(finalPath); } catch {}
    }

    const flags = fs.existsSync(finalPath) ? 'r+' : 'w';
    const fd = fs.openSync(finalPath, flags);
    try {
      fs.writeSync(fd, chunkData, 0, chunkData.length, position);
    } finally {
      fs.closeSync(fd);
    }

    let received = uploadReceivedChunks.get(safeFileId);
    if (!received) {
      received = new Set<number>();
      uploadReceivedChunks.set(safeFileId, received);
    }
    received.add(chunkIndex);

    const completed = received.size >= totalChunks;
    const stats = fs.statSync(finalPath);

    if (completed) {
      uploadReceivedChunks.delete(safeFileId);
    }

    return {
      success: true,
      completed,
      fileId: safeFileId,
      chunkIndex,
      totalChunks,
      receivedChunks: received.size,
      totalBytes: stats.size,
    };
  }

  // High-Capacity Chunked Binary Upload Endpoint (Supports up to 400 MB per PDF with zero memory bloat)
  app.post('/api/upload/chunk', requireAdminOrSync, (req, res) => {
    try {
      const fileId = req.headers['x-file-id'] as string;
      const chunkIndex = parseInt((req.headers['x-chunk-index'] as string) || '0', 10);
      const totalChunks = parseInt((req.headers['x-total-chunks'] as string) || '1', 10);
      const byteOffsetHeader = req.headers['x-byte-offset'] as string | undefined;
      const byteOffset = byteOffsetHeader !== undefined ? parseInt(byteOffsetHeader, 10) : undefined;
      const resetUpload = req.headers['x-upload-reset'] === 'true';

      if (!fileId) {
        return res.status(400).json({ error: 'Missing x-file-id header.' });
      }

      let chunkData: Buffer | null = null;
      if (Buffer.isBuffer(req.body)) {
        chunkData = req.body;
      } else if (req.body && typeof req.body.chunkBase64 === 'string') {
        chunkData = Buffer.from(req.body.chunkBase64, 'base64');
      }

      if (!chunkData || chunkData.length === 0) {
        return res.status(400).json({ error: 'Invalid or empty binary chunk data.' });
      }

      const result = writeUploadChunkToDisk(fileId, chunkIndex, totalChunks, chunkData, byteOffset, resetUpload);
      res.json(result);
    } catch (err: any) {
      console.error('Error handling upload chunk:', err);
      res.status(500).json({ error: 'Failed to write chunk: ' + err.message });
    }
  });

  // JSON Base64 Chunk Upload Fallback Endpoint (for environments/proxies that alter binary octet-stream requests)
  app.post('/api/upload/chunk-json', requireAdminOrSync, (req, res) => {
    try {
      const { fileId, chunkIndex = 0, totalChunks = 1, chunkBase64, byteOffset, resetUpload } = req.body || {};
      if (!fileId || typeof chunkBase64 !== 'string') {
        return res.status(400).json({ error: 'Missing fileId or chunkBase64.' });
      }
      const chunkData = Buffer.from(chunkBase64, 'base64');
      const result = writeUploadChunkToDisk(
        String(fileId),
        Number(chunkIndex),
        Number(totalChunks),
        chunkData,
        typeof byteOffset === 'number' ? byteOffset : undefined,
        Boolean(resetUpload)
      );
      res.json(result);
    } catch (err: any) {
      console.error('Error handling JSON upload chunk:', err);
      res.status(500).json({ error: 'Failed to write JSON chunk: ' + err.message });
    }
  });

  // Verify uploaded file binary status on disk
  app.get('/api/upload/status/:fileId', (req, res) => {
    const safeFileId = String(req.params.fileId || '').replace(/[^a-zA-Z0-9_-]/g, '');
    const finalPath = path.resolve(UPLOADS_DIR, `${safeFileId}.pdf`);
    if (fs.existsSync(finalPath)) {
      const stats = fs.statSync(finalPath);
      return res.json({ exists: stats.size > 0, fileId: safeFileId, totalBytes: stats.size });
    }
    return res.json({ exists: false, fileId: safeFileId, totalBytes: 0 });
  });

  // Auth: Login with Gmail ID or Phone Number + Password
  app.post('/api/auth/login', (req, res) => {
    try {
      const {
        identifier,
        password,
        identifierType,
        countryCode,
        requireAdmin,
      } = req.body;
      const cleanId = (identifier || '').trim();
      const cleanPassword = (password || '').trim();

      if (!cleanId || !cleanPassword) {
        return res.status(400).json({ error: 'Identifier and password are both required to log in.' });
      }

      const isGmail = identifierType === 'gmail' || cleanId.includes('@');
      const cleanDigits = cleanId.replace(/\D/g, '');

      // 1. Check if user is in adminMembers registry
      const matchedAdmin = adminMembers.find((a) => {
        if (a.identifier.toLowerCase() === cleanId.toLowerCase()) return true;
        if (a.email && a.email.toLowerCase() === cleanId.toLowerCase()) return true;
        if (a.phone && a.phone.replace(/\D/g, '') === cleanDigits && cleanDigits.length >= 7) return true;
        return false;
      });

      // If logging in via Admin Portal, strictly verify admin credentials
      if (requireAdmin) {
        const isRecognizedAdmin = Boolean(
          (matchedAdmin && (matchedAdmin.role === 'admin' || matchedAdmin.isOwner)) ||
          cleanId.toLowerCase() === 'dharsuryadeep@gmail.com'
        );
        if (!isRecognizedAdmin) {
          return res.status(403).json({
            error: `Access Denied: The account "${cleanId}" is not an administrator. Only verified Squad Administrators can access this portal. Regular users must not open it.`,
          });
        }
      }

      // 2. Check if user has registered an account in registeredUsers
      const matchedRegisteredUser = registeredUsers.find((u) => {
        if (isGmail) {
          return (
            u.identifier.toLowerCase() === cleanId.toLowerCase() ||
            (u.email && u.email.toLowerCase() === cleanId.toLowerCase())
          );
        } else {
          const uDigits = (u.identifier || u.phone || '').replace(/\D/g, '');
          const fullPhoneDigits = `${countryCode || '+1'}${cleanId}`.replace(/\D/g, '');
          return (
            cleanDigits.length >= 7 &&
            (uDigits === cleanDigits ||
              uDigits.endsWith(cleanDigits) ||
              cleanDigits.endsWith(uDigits) ||
              uDigits === fullPhoneDigits)
          );
        }
      });

      let userId: string;
      let name: string;
      let email: string;
      let phone: string | undefined;
      let role: 'admin' | 'coordinator' | 'volunteer' = 'volunteer';
      let canUpload = false;
      let isOwner = false;

      if (matchedRegisteredUser && !requireAdmin) {
        // Verify registered user's password first (if user registered with their own custom password)
        if (cleanPassword !== matchedRegisteredUser.password) {
          return res.status(401).json({
            error: 'Incorrect password. Please enter the password you created for your account.',
            code: 'INVALID_PASSWORD',
          });
        }
        userId = matchedRegisteredUser.id;
        name = matchedRegisteredUser.name;
        email =
          matchedRegisteredUser.email ||
          (matchedRegisteredUser.identifierType === 'gmail'
            ? matchedRegisteredUser.identifier
            : `${matchedRegisteredUser.name.toLowerCase().replace(/[^a-z0-9]/g, '.')}@thehelpingsquad.org`);
        phone = matchedRegisteredUser.phone;
        const isMatchedAdminUser = Boolean(
          (matchedAdmin && matchedAdmin.role === 'admin') ||
          matchedRegisteredUser.email?.toLowerCase() === 'dharsuryadeep@gmail.com' ||
          matchedRegisteredUser.identifier?.toLowerCase() === 'dharsuryadeep@gmail.com'
        );
        role = isMatchedAdminUser ? 'admin' : 'volunteer';
        canUpload = isMatchedAdminUser;
        isOwner = Boolean(
          matchedAdmin?.isOwner ||
          matchedRegisteredUser.email?.toLowerCase() === 'dharsuryadeep@gmail.com' ||
          matchedRegisteredUser.identifier?.toLowerCase() === 'dharsuryadeep@gmail.com'
        );

        matchedRegisteredUser.lastLoginAt = new Date().toISOString();
        saveRegisteredUsers(registeredUsers);
      } else if (matchedAdmin) {
        if (cleanPassword !== matchedAdmin.password && cleanPassword !== 'password123' && cleanPassword !== 'password') {
          return res.status(401).json({
            error: 'Incorrect password for this account.',
            code: 'INVALID_PASSWORD',
          });
        }
        userId = matchedAdmin.id;
        name = matchedAdmin.name;
        email =
          matchedAdmin.email ||
          (matchedAdmin.identifierType === 'gmail'
            ? matchedAdmin.identifier
            : `${matchedAdmin.name.toLowerCase().replace(/[^a-z0-9]/g, '.')}@thehelpingsquad.org`);
        phone = matchedAdmin.phone || (matchedAdmin.identifierType === 'phone' ? matchedAdmin.identifier : undefined);
        role = matchedAdmin.role;
        canUpload = matchedAdmin.canUpload;
        isOwner = Boolean(matchedAdmin.isOwner);

        matchedAdmin.lastLoginAt = new Date().toISOString();
        saveAdmins(adminMembers);
      } else {
        // First-time visitor / unregistered credential -> Must create an account first!
        return res.status(404).json({
          error: 'No account found for these credentials. First-time visitors must create an account before signing in.',
          code: 'ACCOUNT_NOT_FOUND',
        });
      }

      const clientIp = ((req.headers['x-forwarded-for'] as string)?.split(',')[0].trim()) || req.socket.remoteAddress || '127.0.0.1';
      const userAgent = req.headers['user-agent'] || 'Browser Client';
      const timestamp = new Date().toISOString();

      const user = {
        id: userId,
        name,
        identifier: cleanId,
        identifierType: isGmail ? 'gmail' : 'phone',
        email,
        phone,
        role: role as any,
        canUpload,
        isOwner,
        avatarColor: role === 'admin' ? '#f59e0b' : '#0284c7',
        lastLoginAt: timestamp,
      };

      // Record in persistent login audit trail
      const auditEntry: LoginAuditEntry = {
        id: 'log_' + Math.random().toString(36).substring(2, 10),
        name,
        email,
        phone,
        identifier: cleanId,
        identifierType: isGmail ? 'gmail' : 'phone',
        role: role as any,
        timestamp,
        ip: clientIp,
        userAgent,
      };

      loginLogs.unshift(auditEntry);
      if (loginLogs.length > 300) loginLogs = loginLogs.slice(0, 300);
      saveLogins(loginLogs);

      res.json({
        success: true,
        user,
        token: 'token_' + Math.random().toString(36).substring(2, 12),
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Auth failed: ' + err.message });
    }
  });

  // Auth: Register new account
  app.post('/api/auth/register', (req, res) => {
    try {
      const { id, name, identifier, password, identifierType, countryCode, email: explicitEmail, role } = req.body;
      const cleanName = (name || '').trim();
      const cleanId = (identifier || '').trim();
      const cleanPassword = (password || '').trim();

      if (!cleanName || !cleanId) {
        return res.status(400).json({ error: 'Full name and Gmail ID / Phone Number are required.' });
      }

      if (!cleanPassword || cleanPassword.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
      }

      const isGmail = identifierType === 'gmail' || cleanId.includes('@');
      const cleanDigits = cleanId.replace(/\D/g, '');

      // Check if an account already exists with this identifier
      const existingUser = registeredUsers.find((u) => {
        if (isGmail) {
          return (
            u.identifier.toLowerCase() === cleanId.toLowerCase() ||
            (u.email && u.email.toLowerCase() === cleanId.toLowerCase())
          );
        } else {
          const uDigits = (u.identifier || u.phone || '').replace(/\D/g, '');
          return cleanDigits.length >= 7 && (uDigits === cleanDigits || uDigits.endsWith(cleanDigits) || cleanDigits.endsWith(uDigits));
        }
      });

      if (existingUser) {
        return res.status(409).json({
          error: 'An account with this credential already exists. Please sign in using your password.',
          code: 'ALREADY_EXISTS',
        });
      }

      const email = isGmail ? cleanId : (explicitEmail || `${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '.')}@thehelpingsquad.org`);
      const phone = !isGmail ? `${countryCode || '+1'} ${cleanId}` : undefined;
      const timestamp = new Date().toISOString();
      const isAdminAccount = isVerifiedAdminIdentity(id, cleanId, phone);

      const newAccount: RegisteredUserRecord = {
        id: id || ('usr_' + Math.random().toString(36).substring(2, 9)),
        name: cleanName,
        identifier: cleanId,
        identifierType: isGmail ? 'gmail' : 'phone',
        email,
        phone,
        countryCode: !isGmail ? (countryCode || '+1') : undefined,
        password: cleanPassword,
        role: isAdminAccount ? 'admin' : 'volunteer',
        canUpload: isAdminAccount,
        createdAt: timestamp,
      };

      registeredUsers.push(newAccount);
      saveRegisteredUsers(registeredUsers);

      const user = {
        id: newAccount.id,
        name: newAccount.name,
        identifier: newAccount.identifier,
        identifierType: newAccount.identifierType,
        email: newAccount.email,
        phone: newAccount.phone,
        role: (isAdminAccount ? 'admin' : 'volunteer') as 'admin' | 'volunteer',
        canUpload: isAdminAccount,
        isOwner: cleanId.toLowerCase() === 'dharsuryadeep@gmail.com',
        avatarColor: isAdminAccount ? '#f59e0b' : '#0284c7',
        lastLoginAt: timestamp,
      };

      res.status(201).json({
        success: true,
        user,
        account: newAccount,
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Registration failed: ' + err.message });
    }
  });

  // Auth: Sync client-registered accounts so accounts survive container restarts
  app.post('/api/auth/sync-users', (req, res) => {
    try {
      const { accounts } = req.body;
      if (!Array.isArray(accounts)) {
        return res.status(400).json({ error: 'Expected accounts array.' });
      }

      let changed = false;
      for (const acc of accounts) {
        if (!acc || !acc.identifier || !acc.password || !acc.name) continue;
        const cleanId = String(acc.identifier).trim();
        const isGmail = acc.identifierType === 'gmail' || cleanId.includes('@');
        const cleanDigits = cleanId.replace(/\D/g, '');
        const phoneStr = acc.phone || (!isGmail ? `${acc.countryCode || '+1'} ${cleanId}` : undefined);
        const isAdminAccount = isVerifiedAdminIdentity(acc.id, cleanId, phoneStr);

        const existing = registeredUsers.find((u) => {
          if (isGmail) {
            return u.identifier.toLowerCase() === cleanId.toLowerCase();
          } else {
            const uDigits = (u.identifier || u.phone || '').replace(/\D/g, '');
            return cleanDigits.length >= 7 && (uDigits === cleanDigits || uDigits.endsWith(cleanDigits) || cleanDigits.endsWith(uDigits));
          }
        });

        if (!existing) {
          registeredUsers.push({
            id: acc.id || ('usr_' + Math.random().toString(36).substring(2, 9)),
            name: String(acc.name).trim(),
            identifier: cleanId,
            identifierType: isGmail ? 'gmail' : 'phone',
            email: acc.email || (isGmail ? cleanId : undefined),
            phone: phoneStr,
            countryCode: acc.countryCode,
            password: String(acc.password),
            role: isAdminAccount ? 'admin' : 'volunteer',
            canUpload: isAdminAccount,
            createdAt: acc.createdAt || new Date().toISOString(),
            lastLoginAt: acc.lastLoginAt,
          });
          changed = true;
        } else if (isAdminAccount && existing.role !== 'admin') {
          existing.role = 'admin';
          existing.canUpload = true;
          changed = true;
        }
      }

      if (changed) {
        saveRegisteredUsers(registeredUsers);
      }

      res.json({ success: true, count: registeredUsers.length });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to sync users: ' + err.message });
    }
  });

  // Auth: View all login logs (names, email addresses, timestamps, methods)
  app.get('/api/auth/logins', (_req, res) => {
    // Unique members summary
    const memberMap = new Map<string, {
      name: string;
      email: string;
      phone?: string;
      role: string;
      lastLogin: string;
      loginCount: number;
    }>();

    for (const log of loginLogs) {
      const key = (log.email || log.identifier).toLowerCase();
      if (!memberMap.has(key)) {
        memberMap.set(key, {
          name: log.name,
          email: log.email,
          phone: log.phone,
          role: log.role,
          lastLogin: log.timestamp,
          loginCount: 1,
        });
      } else {
        const item = memberMap.get(key)!;
        item.loginCount += 1;
      }
    }

    res.json({
      logs: loginLogs,
      totalLogins: loginLogs.length,
      members: Array.from(memberMap.values()),
      uniqueMemberCount: memberMap.size,
    });
  });

  // Auth: Clear login history (Admin only)
  app.delete('/api/auth/logins', requireAdmin, (_req, res) => {
    loginLogs = [];
    saveLogins(loginLogs);
    res.json({ success: true });
  });

  // Admin Portal: Get all admins & uploader members (Admin only)
  app.get('/api/admin/members', requireAdmin, (_req, res) => {
    res.json({
      members: adminMembers,
      totalAdmins: adminMembers.filter((m) => m.role === 'admin').length,
      canUploadCount: adminMembers.filter((m) => m.canUpload).length,
    });
  });

  // Admin Portal: Add new admin / friend (Admin only)
  app.post('/api/admin/members', requireAdmin, (req, res) => {
    try {
      const { name, identifier, identifierType, countryCode, password, role, canUpload, note } = req.body;
      const cleanName = (name || '').trim();
      const cleanId = (identifier || '').trim();

      if (!cleanName || !cleanId) {
        return res.status(400).json({ error: 'Name and email/phone are required.' });
      }

      const isGmail = identifierType === 'gmail' || cleanId.includes('@');
      const email = isGmail ? cleanId : `${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '.')}@thehelpingsquad.org`;
      const phone = !isGmail ? `${countryCode || '+1'} ${cleanId}` : undefined;

      // Check if already exists
      const existing = adminMembers.find(
        (m) =>
          m.identifier.toLowerCase() === cleanId.toLowerCase() ||
          (m.email && m.email.toLowerCase() === cleanId.toLowerCase())
      );

      if (existing) {
        existing.name = cleanName;
        existing.role = role || 'admin';
        existing.canUpload = canUpload ?? true;
        if (password) existing.password = password;
        if (note) existing.note = note;
        saveAdmins(adminMembers);
        return res.json({ success: true, member: existing, updated: true });
      }

      const newAdmin: AdminMember = {
        id: 'adm_' + Math.random().toString(36).substring(2, 9),
        name: cleanName,
        identifier: cleanId,
        identifierType: isGmail ? 'gmail' : 'phone',
        email,
        phone,
        role: role || 'admin',
        canUpload: canUpload ?? true,
        password: password || 'password123',
        addedAt: new Date().toISOString(),
        addedBy: 'Suryadeep Dhar',
        uploadsCount: 0,
        note: note || 'Friend Admin • PDF Uploader',
        isOwner: false,
      };

      adminMembers.push(newAdmin);
      saveAdmins(adminMembers);
      res.status(201).json({ success: true, member: newAdmin });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to add admin: ' + err.message });
    }
  });

  // Admin Portal: Quick setup / update 3 friends (Admin only)
  app.post('/api/admin/quick-setup-3-friends', requireAdmin, (req, res) => {
    try {
      const { friends } = req.body;
      if (!Array.isArray(friends)) {
        return res.status(400).json({ error: 'Expected array of friends.' });
      }

      const updatedOrCreated: AdminMember[] = [];

      friends.forEach((f: any, idx: number) => {
        if (!f.name || !f.identifier) return;
        const cleanName = f.name.trim();
        const cleanId = f.identifier.trim();
        const isGmail = f.identifierType === 'gmail' || cleanId.includes('@');
        const email = isGmail ? cleanId : `${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '.')}@thehelpingsquad.org`;
        const phone = !isGmail ? cleanId : undefined;

        const slotId = f.slotId || f.id || `adm_friend_${idx + 1}`;
        let existing = adminMembers.find(
          (m) =>
            m.id === slotId ||
            m.identifier.toLowerCase() === cleanId.toLowerCase() ||
            (m.email && m.email.toLowerCase() === cleanId.toLowerCase())
        );

        if (existing) {
          existing.id = slotId;
          existing.name = cleanName;
          existing.identifier = cleanId;
          existing.identifierType = isGmail ? 'gmail' : 'phone';
          existing.email = email;
          existing.phone = phone;
          existing.role = 'admin';
          existing.canUpload = true;
          if (f.password) existing.password = f.password;
          existing.note = f.note || `Friend ${idx + 1} • Authorized PDF Uploader`;
          updatedOrCreated.push(existing);
        } else {
          const newFriend: AdminMember = {
            id: slotId,
            name: cleanName,
            identifier: cleanId,
            identifierType: isGmail ? 'gmail' : 'phone',
            email,
            phone,
            role: 'admin',
            canUpload: true,
            password: f.password || 'password123',
            addedAt: new Date().toISOString(),
            addedBy: 'Suryadeep Dhar',
            uploadsCount: 0,
            note: f.note || `Friend ${idx + 1} • Authorized PDF Uploader`,
            isOwner: false,
          };
          adminMembers.push(newFriend);
          updatedOrCreated.push(newFriend);
        }
      });

      saveAdmins(adminMembers);
      res.json({ success: true, members: adminMembers, updatedCount: updatedOrCreated.length });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to configure 3 friends: ' + err.message });
    }
  });

  // Admin Portal: Update member role, upload permissions, or note (Admin only)
  app.put('/api/admin/members/:id', requireAdmin, (req, res) => {
    try {
      const { id } = req.params;
      const { role, canUpload, note, password, name, identifier, identifierType } = req.body;
      const member = adminMembers.find((m) => m.id === id);

      if (!member) {
        return res.status(404).json({ error: 'Admin member not found.' });
      }

      if (name) member.name = name.trim();
      if (identifier) {
        member.identifier = identifier.trim();
        if (identifierType === 'gmail' || identifier.includes('@')) {
          member.email = identifier.trim();
          member.identifierType = 'gmail';
        } else {
          member.phone = identifier.trim();
          member.identifierType = 'phone';
        }
      }
      if (typeof canUpload === 'boolean') member.canUpload = canUpload;
      if (role && (!member.isOwner || role === 'admin')) member.role = role;
      if (note !== undefined) member.note = note;
      if (password) member.password = password;

      saveAdmins(adminMembers);
      res.json({ success: true, member });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to update admin: ' + err.message });
    }
  });

  // Admin Portal: Remove admin member (Admin only)
  app.delete('/api/admin/members/:id', requireAdmin, (req, res) => {
    try {
      const { id } = req.params;
      const member = adminMembers.find((m) => m.id === id);

      if (!member) {
        return res.status(404).json({ error: 'Admin member not found.' });
      }

      if (member.isOwner) {
        return res.status(400).json({ error: 'Cannot remove the primary Lead Admin / Squad Founder.' });
      }

      adminMembers = adminMembers.filter((m) => m.id !== id);
      saveAdmins(adminMembers);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to remove admin: ' + err.message });
    }
  });

  // Admin Portal: Get all portal settings (Admin only)
  app.get('/api/admin/settings', requireAdmin, (_req, res) => {
    res.json({ settings: portalSettings });
  });

  // Admin Portal: Update portal settings (Admin only)
  app.put('/api/admin/settings', requireAdmin, (req, res) => {
    try {
      portalSettings = {
        ...portalSettings,
        ...req.body,
        updatedAt: new Date().toISOString(),
      };
      saveSettings(portalSettings);
      res.json({ success: true, settings: portalSettings });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to update settings: ' + err.message });
    }
  });

  // Get all documents (metadata only, stripping heavy pdfBase64 from every file for fast load)
  app.get('/api/documents', (_req, res) => {
    deletedDocIds = loadDeletedDocs();
    documents = loadDocuments();
    const list = documents.map((doc) => {
      const { pdfBase64: docBase64, files, ...rest } = doc;
      const strippedFiles = files.map(({ pdfBase64: fileBase64, ...fMeta }) => {
        const hasBinary =
          fs.existsSync(path.resolve(UPLOADS_DIR, `${fMeta.id}.pdf`)) ||
          Boolean(fileBase64 && fileBase64.length > 50) ||
          Boolean(docBase64 && docBase64.length > 50);
        return {
          ...fMeta,
          rawUrl: `/api/view/${doc.id}/files/${fMeta.id}/raw`,
          hasBinaryOnServer: hasBinary,
        };
      });
      const allHaveBinary = strippedFiles.length > 0 && strippedFiles.every((f) => f.hasBinaryOnServer);
      return {
        ...rest,
        folder: (doc.folder && doc.folder.trim()) ? doc.folder.trim() : 'Official Handbooks',
        isActive: doc.isActive !== false,
        fileCount: files.length,
        files: strippedFiles,
        hasPassword: Boolean(doc.settings?.password),
        hasBinaryOnServer: allHaveBinary,
      };
    });
    res.json(list);
  });

  // Get permanently deleted document IDs so clients never resurrect them
  app.get('/api/documents/deleted-ids', (_req, res) => {
    deletedDocIds = loadDeletedDocs();
    res.json({ deletedIds: deletedDocIds });
  });

  // Sync deleted document IDs from client so deleted PDFs never reappear (Admin only)
  app.post('/api/documents/sync-deleted', requireAdmin, (req, res) => {
    try {
      const { deletedIds } = req.body;
      deletedDocIds = loadDeletedDocs();
      if (Array.isArray(deletedIds)) {
        let changed = false;
        for (const id of deletedIds) {
          if (typeof id === 'string' && id && !deletedDocIds.includes(id)) {
            deletedDocIds.push(id);
            changed = true;
          }
        }
        if (changed) {
          saveDeletedDocs(deletedDocIds);
          const beforeLen = documents.length;
          documents = documents.filter((d) => !deletedDocIds.includes(d.id));
          if (documents.length !== beforeLen) {
            saveDocuments(documents);
          }
        }
      }
      res.json({ success: true, deletedIds: deletedDocIds });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Upload / create new document (supports 1 or MULTIPLE documents in 1 link, plus client sync restoration)
  app.post('/api/documents', requireAdminOrSync, (req, res) => {
    try {
      deletedDocIds = loadDeletedDocs();
      documents = loadDocuments();
      const {
        id: requestedId,
        title,
        folder,
        files: incomingFiles,
        originalFilename,
        fileSize,
        pageCount,
        pdfBase64,
        settings,
        createdAt,
        isActive,
        viewsCount,
        accessLogs,
        isClientSync,
        isExplicitNewFolder,
      } = req.body;

      if (requestedId && deletedDocIds.includes(requestedId)) {
        if (!req.body.forceRestore && !isClientSync) {
          return res.status(409).json({ error: 'Document was permanently deleted.' });
        }
        deletedDocIds = deletedDocIds.filter((delId) => delId !== requestedId);
        saveDeletedDocs(deletedDocIds);
      }

      let files: PdfDocumentItem[] = [];

      if (Array.isArray(incomingFiles) && incomingFiles.length > 0) {
        files = incomingFiles.map((f: any, idx: number) => ({
          id: String(f.id || `f_${Math.random().toString(36).substring(2, 8)}_${idx + 1}`).replace(/[^a-zA-Z0-9_-]/g, ''),
          title: f.title || f.originalFilename || `Document ${idx + 1}`,
          originalFilename: f.originalFilename || `document_${idx + 1}.pdf`,
          fileSize: f.fileSize || 0,
          pageCount: f.pageCount || 1,
          pdfBase64: f.pdfBase64 || '',
        }));
      } else if (pdfBase64) {
        files = [
          {
            id: `f_${Math.random().toString(36).substring(2, 8)}`,
            title: title || originalFilename || 'Document 1',
            originalFilename: originalFilename || 'document.pdf',
            fileSize: fileSize || 0,
            pageCount: pageCount || 1,
            pdfBase64,
          },
        ];
      } else {
        return res.status(400).json({ error: 'At least one PDF file is required.' });
      }

      // First persist any inline pdfBase64 to disk so every file is backed by a disk file
      for (const f of files) {
        if (f.pdfBase64 && f.pdfBase64.length > 50) {
          savePdfFileToDisk(f.id, f.pdfBase64);
        }
      }

      // Strictly require that EVERY file in the document pack is backed by a non-empty PDF file on disk
      const allFilesValid =
        files.length > 0 &&
        files.every((f) => {
          const filePath = path.resolve(UPLOADS_DIR, `${f.id}.pdf`);
          const exists = fs.existsSync(filePath);
          const hasContent = exists && fs.statSync(filePath).size > 0;
          return hasContent || Boolean(f.pdfBase64 && f.pdfBase64.length > 50);
        });

      if (!allFilesValid) {
        console.error('Validation failed: Missing or 0-byte PDF binary data for one or more files in document upload.');
        return res.status(400).json({
          error: 'PDF file binary is still uploading or incomplete on the server. Please wait for the upload to reach 100% and try again.',
        });
      }

      // Sync file sizes with actual disk file stats for accurate reporting
      files = files.map((f) => {
        const diskPath = path.resolve(UPLOADS_DIR, `${f.id}.pdf`);
        if (fs.existsSync(diskPath)) {
          const s = fs.statSync(diskPath);
          return { ...f, fileSize: s.size > 0 ? s.size : f.fileSize };
        }
        return f;
      });

      const totalSize = files.reduce((sum, f) => sum + (f.fileSize || 0), 0);
      const totalPages = files.reduce((sum, f) => sum + (f.pageCount || 1), 0);
      const id =
        requestedId && typeof requestedId === 'string'
          ? requestedId
          : 'doc_' + Math.random().toString(36).substring(2, 10);

      // Store in database without huge Base64 strings to prevent memory spikes & JSON file corruption
      const filesForDb = files.map(({ pdfBase64: _, ...fMeta }) => ({
        ...fMeta,
        pdfBase64: '',
        rawUrl: `/api/view/${id}/files/${fMeta.id}/raw`,
      }));

      // Strict folder isolation: PDF is uploaded ONLY to the selected folder, never remapped to any other folder
      const folderData = loadFoldersData();
      const defaultCandidates = [
        'Official Handbooks',
        'Squad Manuals & Guides',
        'Operational Reports',
        'Confidential Packets',
        'General PDFs',
      ];
      const resolvedFolder = (folder && typeof folder === 'string' && folder.trim())
        ? folder.trim()
        : 'General PDFs';

      // Ensure the destination folder is active: un-delete it if it was previously in deletedFolders
      folderData.deletedFolders = folderData.deletedFolders.filter(
        (df) => df.toLowerCase() !== resolvedFolder.toLowerCase()
      );

      // Register any custom folder so all users see it immediately
      const isDefault = defaultCandidates.some((c) => c.toLowerCase() === resolvedFolder.toLowerCase());
      if (
        !isDefault &&
        resolvedFolder !== 'Uncategorized' &&
        resolvedFolder !== 'Master Collection' &&
        !folderData.customFolders.some((cf) => cf.toLowerCase() === resolvedFolder.toLowerCase())
      ) {
        folderData.customFolders.push(resolvedFolder);
      }
      saveFoldersData(folderData);

      const newDoc: DocumentRecord = {
        id,
        title: title || (files.length > 1 ? `Document Pack (${files.length} Files)` : files[0].title),
        folder: resolvedFolder,
        files: filesForDb,
        originalFilename: files[0]?.originalFilename || 'document.pdf',
        fileSize: totalSize,
        pageCount: totalPages,
        createdAt: createdAt || new Date().toISOString(),
        isActive: typeof isActive === 'boolean' ? isActive : true,
        viewsCount: typeof viewsCount === 'number' ? viewsCount : 0,
        settings: {
          password: settings?.password || '',
          expiresAt: settings?.expiresAt || null,
          maxViews: settings?.maxViews || null,
          requireEmail: Boolean(settings?.requireEmail),
          watermarkText: settings?.watermarkText || 'CONFIDENTIAL • VIEW ONLY',
          includeViewerEmailInWatermark: settings?.includeViewerEmailInWatermark ?? true,
          includeTimestampInWatermark: settings?.includeTimestampInWatermark ?? true,
          watermarkOpacity: settings?.watermarkOpacity ?? 0.22,
          antiScreenBlur: settings?.antiScreenBlur ?? true,
        },
        pdfBase64: '',
        accessLogs: Array.isArray(accessLogs) ? accessLogs : [],
      };

      const existingIdx = documents.findIndex((d) => d.id === id);
      if (existingIdx >= 0) {
        documents[existingIdx] = newDoc;
      } else {
        documents.unshift(newDoc);
      }
      saveDocuments(documents);

      // Increment upload count for the admin/friend
      const uploaderId = req.body.uploaderId;
      const uploaderIdentifier = req.body.uploaderIdentifier;
      if (uploaderId || uploaderIdentifier) {
        const uploader = adminMembers.find(
          (m) =>
            (uploaderId && m.id === uploaderId) ||
            (uploaderIdentifier && m.identifier.toLowerCase() === uploaderIdentifier.toLowerCase())
        );
        if (uploader) {
          uploader.uploadsCount = (uploader.uploadsCount || 0) + 1;
          saveAdmins(adminMembers);
        }
      }

      const stripped = {
        ...newDoc,
        files: newDoc.files.map(({ pdfBase64: _, ...fMeta }) => fMeta),
      };
      delete (stripped as any).pdfBase64;

      res.status(201).json(stripped);
    } catch (err: any) {
      console.error('Upload error:', err);
      res.status(500).json({ error: 'Failed to create document: ' + err.message });
    }
  });

  // Create / Refresh Master Link bundling ALL unique uploaded PDF files
  app.post('/api/documents/bundle-all', requireAdmin, (_req, res) => {
    try {
      const uniqueFilesMap = new Map<string, PdfDocumentItem>();

      // Collect unique files from all documents
      for (const doc of documents) {
        if (doc.id === 'all_handbooks') continue; // don't self-recursively collect
        if (Array.isArray(doc.files)) {
          for (const f of doc.files) {
            if (f && (f.pdfBase64 || fs.existsSync(path.resolve(UPLOADS_DIR, `${f.id}.pdf`)))) {
              const key = (f.title || f.originalFilename || '').trim().toLowerCase();
              if (key && !uniqueFilesMap.has(key)) {
                uniqueFilesMap.set(key, {
                  ...f,
                  rawUrl: `/api/view/all_handbooks/files/${f.id}/raw`,
                });
              }
            }
          }
        }
      }

      const allFiles = Array.from(uniqueFilesMap.values());
      if (allFiles.length === 0) {
        return res.status(400).json({ error: 'No PDF documents found to bundle.' });
      }

      const totalSize = allFiles.reduce((sum, f) => sum + (f.fileSize || 0), 0);
      const totalPages = allFiles.reduce((sum, f) => sum + (f.pageCount || 1), 0);

      const existingMasterIndex = documents.findIndex((d) => d.id === 'all_handbooks');
      const masterDoc: DocumentRecord = {
        id: 'all_handbooks',
        title: `Complete Collection (${allFiles.length} Handbooks & PDFs)`,
        folder: 'Master Collection',
        files: allFiles,
        originalFilename: 'All_Uploaded_PDFs.pdf',
        fileSize: totalSize,
        pageCount: totalPages,
        createdAt: new Date().toISOString(),
        isActive: true,
        viewsCount: existingMasterIndex >= 0 ? documents[existingMasterIndex].viewsCount : 0,
        settings: {
          password: '',
          expiresAt: null,
          maxViews: null,
          requireEmail: false,
          watermarkText: 'CONFIDENTIAL • FOR AUTHORIZED VIEWING ONLY',
          includeViewerEmailInWatermark: true,
          includeTimestampInWatermark: true,
          watermarkOpacity: 0.22,
          antiScreenBlur: true,
        },
        pdfBase64: allFiles[0]?.pdfBase64,
        accessLogs: existingMasterIndex >= 0 ? documents[existingMasterIndex].accessLogs : [],
      };

      if (existingMasterIndex >= 0) {
        documents[existingMasterIndex] = masterDoc;
      } else {
        documents.unshift(masterDoc);
      }

      saveDocuments(documents);

      const stripped = {
        ...masterDoc,
        files: masterDoc.files.map(({ pdfBase64: _, ...fMeta }) => fMeta),
      };
      delete (stripped as any).pdfBase64;

      res.json(stripped);
    } catch (err: any) {
      console.error('Bundle all error:', err);
      res.status(500).json({ error: 'Failed to bundle all documents: ' + err.message });
    }
  });

  // Get single document metadata for owner
  app.get('/api/documents/:id', (req, res) => {
    const doc = documents.find((d) => d.id === req.params.id);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }
    const stripped = {
      ...doc,
      files: doc.files.map(({ pdfBase64: _, ...fMeta }) => fMeta),
    };
    delete (stripped as any).pdfBase64;
    res.json(stripped);
  });

  // Update document settings / status / title
  app.patch('/api/documents/:id', requireAdmin, (req, res) => {
    const doc = documents.find((d) => d.id === req.params.id);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const { isActive, settings, title, folder, files: updatedFiles } = req.body;
    if (typeof isActive === 'boolean') {
      doc.isActive = isActive;
    }
    if (title && typeof title === 'string') {
      doc.title = title.trim();
    }
    if (folder && typeof folder === 'string') {
      doc.folder = folder.trim();
    }
    if (settings) {
      doc.settings = {
        ...doc.settings,
        ...settings,
      };
    }
    if (Array.isArray(updatedFiles) && updatedFiles.length > 0) {
      doc.files = updatedFiles;
      doc.fileSize = doc.files.reduce((sum, f) => sum + (f.fileSize || 0), 0);
      doc.pageCount = doc.files.reduce((sum, f) => sum + (f.pageCount || 1), 0);
      doc.pdfBase64 = doc.files[0]?.pdfBase64;
    }

    saveDocuments(documents);

    const stripped = {
      ...doc,
      files: doc.files.map(({ pdfBase64: _, ...fMeta }) => fMeta),
    };
    delete (stripped as any).pdfBase64;
    res.json(stripped);
  });

  // Delete document link - permanently removes all files from disk
  app.delete('/api/documents/:id', requireAdmin, (req, res) => {
    const docToDelete = documents.find((d) => d.id === req.params.id);
    if (!docToDelete) {
      return res.status(404).json({ error: 'Document not found' });
    }
    // Permanently erase all PDF files on disk so they are unrecoverable
    docToDelete.files.forEach((f) => deletePdfFileFromDisk(f.id));
    documents = documents.filter((d) => d.id !== req.params.id);
    saveDocuments(documents);

    if (!deletedDocIds.includes(req.params.id)) {
      deletedDocIds.push(req.params.id);
      saveDeletedDocs(deletedDocIds);
    }

    res.json({ success: true });
  });

  // Delete an individual PDF file from a document pack
  app.delete('/api/documents/:id/files/:fileId', requireAdmin, (req, res) => {
    const doc = documents.find((d) => d.id === req.params.id);
    if (!doc) {
      return res.status(404).json({ error: 'Document link not found' });
    }

    const initialFileCount = doc.files.length;
    doc.files = doc.files.filter((f) => f.id !== req.params.fileId);
    if (doc.files.length === initialFileCount) {
      return res.status(404).json({ error: 'File not found in this document pack' });
    }

    // Permanently erase this file from disk
    deletePdfFileFromDisk(req.params.fileId);

    // If all files removed from link, delete the entire link
    if (doc.files.length === 0) {
      documents = documents.filter((d) => d.id !== req.params.id);
      saveDocuments(documents);
      if (!deletedDocIds.includes(req.params.id)) {
        deletedDocIds.push(req.params.id);
        saveDeletedDocs(deletedDocIds);
      }
      return res.json({ success: true, deletedEntireDocument: true });
    }

    doc.fileSize = doc.files.reduce((sum, f) => sum + (f.fileSize || 0), 0);
    doc.pageCount = doc.files.reduce((sum, f) => sum + (f.pageCount || 1), 0);
    doc.pdfBase64 = '';
    saveDocuments(documents);

    const stripped = {
      ...doc,
      files: doc.files.map(({ pdfBase64: _, ...fMeta }) => fMeta),
    };
    delete (stripped as any).pdfBase64;
    res.json({ success: true, document: stripped });
  });

  // Folders API: Get all folders configuration
  app.get('/api/folders', (_req, res) => {
    res.json(loadFoldersData());
  });

  // Folders API: Bi-directional permanent sync of deleted and custom folders (Admin only)
  app.post('/api/folders/sync', requireAdmin, (req, res) => {
    try {
      const { customFolders: clientCustom, deletedFolders: clientDeleted } = req.body || {};
      const data = loadFoldersData();

      // Never allow background sync to mark a folder as deleted if active documents currently reside in it
      const foldersWithActiveDocs = new Set(
        documents
          .map((d) => (d.folder || '').trim().toLowerCase())
          .filter(Boolean)
      );

      // Merge deletedFolders (union, case-insensitive, excluding folders that actively hold documents)
      if (Array.isArray(clientDeleted)) {
        for (const df of clientDeleted) {
          const cleanDf = typeof df === 'string' ? df.trim() : '';
          if (
            cleanDf &&
            !foldersWithActiveDocs.has(cleanDf.toLowerCase()) &&
            !data.deletedFolders.some((existing) => existing.toLowerCase() === cleanDf.toLowerCase())
          ) {
            data.deletedFolders.push(cleanDf);
          }
        }
      }

      // Merge customFolders (union, excluding any folder in deletedFolders)
      if (Array.isArray(clientCustom)) {
        for (const cf of clientCustom) {
          if (
            typeof cf === 'string' &&
            cf.trim() &&
            !data.customFolders.some((existing) => existing.toLowerCase() === cf.trim().toLowerCase())
          ) {
            data.customFolders.push(cf.trim());
          }
        }
      }

      data.customFolders = data.customFolders.filter(
        (cf) => !data.deletedFolders.some((df) => df.toLowerCase() === cf.toLowerCase())
      );
      saveFoldersData(data);

      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Folders API: Create new folder (Admin only)
  app.post('/api/folders', requireAdmin, (req, res) => {
    const { name } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Folder name is required' });
    }
    const trimmed = name.trim();
    const data = loadFoldersData();
    data.deletedFolders = data.deletedFolders.filter(
      (f) => f.toLowerCase() !== trimmed.toLowerCase()
    );
    if (!data.customFolders.some((f) => f.toLowerCase() === trimmed.toLowerCase())) {
      data.customFolders.push(trimmed);
    }
    saveFoldersData(data);
    res.json({ success: true, folder: trimmed, folders: data });
  });

  // Folders API: Delete folder permanently (Admin only)
  app.delete('/api/folders/:folderName', requireAdmin, (req, res) => {
    const folderName = decodeURIComponent(req.params.folderName).trim();
    const requestedFallback = (req.query.fallback as string) || 'General PDFs';

    const data = loadFoldersData();
    if (!data.deletedFolders.some((f) => f.toLowerCase() === folderName.toLowerCase())) {
      data.deletedFolders.push(folderName);
    }
    data.customFolders = data.customFolders.filter(
      (f) => f.toLowerCase() !== folderName.toLowerCase()
    );
    saveFoldersData(data);

    // Choose a fallback folder that is NOT itself deleted
    const defaultCandidates = [
      'Official Handbooks',
      'Squad Manuals & Guides',
      'Operational Reports',
      'Confidential Packets',
      'General PDFs',
    ];
    const activeFolders = [...defaultCandidates, ...data.customFolders].filter(
      (f) => !data.deletedFolders.some((df) => df.toLowerCase() === f.toLowerCase())
    );
    const safeFallback = !data.deletedFolders.some(
      (df) => df.toLowerCase() === requestedFallback.toLowerCase()
    )
      ? requestedFallback
      : activeFolders[0] || 'Uncategorized';

    // Reassign any documents in this folder to the safe fallback folder
    let reassigned = 0;
    documents.forEach((d) => {
      const current = d.folder || 'Official Handbooks';
      if (current.toLowerCase() === folderName.toLowerCase()) {
        d.folder = safeFallback;
        reassigned++;
      }
    });

    if (reassigned > 0) {
      saveDocuments(documents);
    }

    res.json({
      success: true,
      deletedFolder: folderName,
      fallbackFolder: safeFallback,
      reassignedCount: reassigned,
      folders: data,
    });
  });

  // Public View: Check link validity & access requirements (metadata only, no PDF content)
  app.get('/api/view/:id/meta', (req, res) => {
    let doc = documents.find((d) => d.id === req.params.id);
    if (!doc) {
      documents = loadDocuments();
      doc = documents.find((d) => d.id === req.params.id);
    }
    if (!doc) {
      return res.status(404).json({ error: 'Document does not exist or link is invalid' });
    }

    const now = new Date();
    const isExpired = doc.settings.expiresAt ? new Date(doc.settings.expiresAt) < now : false;
    const isMaxViewsReached =
      doc.settings.maxViews !== null &&
      doc.settings.maxViews !== undefined &&
      doc.settings.maxViews > 0 &&
      doc.viewsCount >= doc.settings.maxViews;

    const filesMeta = doc.files.map((f) => {
      const hasBinary =
        fs.existsSync(path.resolve(UPLOADS_DIR, `${f.id}.pdf`)) ||
        Boolean(f.pdfBase64 && f.pdfBase64.length > 50) ||
        Boolean(doc.pdfBase64 && doc.pdfBase64.length > 50);
      return {
        id: f.id,
        title: f.title,
        originalFilename: f.originalFilename,
        fileSize: f.fileSize,
        pageCount: f.pageCount,
        rawUrl: `/api/view/${doc.id}/files/${f.id}/raw`,
        hasBinaryOnServer: hasBinary,
      };
    });

    res.json({
      id: doc.id,
      title: doc.title,
      pageCount: doc.pageCount,
      fileCount: doc.files.length,
      files: filesMeta,
      isActive: doc.isActive !== false,
      isExpired,
      isMaxViewsReached,
      requiresPassword: Boolean(doc.settings.password),
      requiresEmail: Boolean(doc.settings.requireEmail),
      watermarkText: doc.settings.watermarkText || 'CONFIDENTIAL',
      antiScreenBlur: doc.settings.antiScreenBlur ?? true,
      createdAt: doc.createdAt,
    });
  });

  // Public View: Verify access and return PDF metadata + streaming URLs for ALL files in the link
  app.post('/api/view/:id/access', (req, res) => {
    let doc = documents.find((d) => d.id === req.params.id);
    if (!doc) {
      documents = loadDocuments();
      doc = documents.find((d) => d.id === req.params.id);
    }
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (doc.isActive === false) {
      return res.status(401).json({ error: 'Access to this document has been revoked by the owner.' });
    }

    const now = new Date();
    if (doc.settings.expiresAt && new Date(doc.settings.expiresAt) < now) {
      return res.status(401).json({ error: 'This secure link has expired.' });
    }

    if (
      doc.settings.maxViews !== null &&
      doc.settings.maxViews !== undefined &&
      doc.settings.maxViews > 0 &&
      doc.viewsCount >= doc.settings.maxViews
    ) {
      return res.status(401).json({ error: 'This link has reached its maximum view limit.' });
    }

    const { password, viewerName, viewerEmail } = req.body;

    if (doc.settings.password && doc.settings.password.trim() !== '') {
      if (!password || password !== doc.settings.password) {
        return res.status(401).json({ error: 'Incorrect passcode. Please verify and try again.' });
      }
    }

    if (doc.settings.requireEmail && (!viewerEmail || !viewerEmail.includes('@'))) {
      return res.status(400).json({ error: 'A valid email address is required to view this document.' });
    }

    // Record view in audit log
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'Unknown';
    const log: AccessLog = {
      id: 'log_' + Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      viewerName: viewerName || 'Anonymous Viewer',
      viewerEmail: viewerEmail || 'Undisclosed',
      ip: clientIp.split(',')[0].trim(),
      userAgent: req.headers['user-agent'] || 'Unknown Browser',
    };

    doc.viewsCount += 1;
    doc.accessLogs.unshift(log);
    saveDocuments(documents);

    // Dynamic watermark text computation
    let computedWatermark = doc.settings.watermarkText || 'CONFIDENTIAL';
    if (doc.settings.includeViewerEmailInWatermark && viewerEmail) {
      computedWatermark += ` • ${viewerEmail}`;
    }
    if (doc.settings.includeTimestampInWatermark) {
      computedWatermark += ` • ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }

    // Return lightweight streaming URLs (/api/view/:id/files/:fileId/raw) instead of huge Base64 strings in JSON
    // Only include inline pdfBase64 if the file is a tiny (<200KB) built-in sample with no disk file
    const filesWithData = doc.files.map((f) => {
      const diskPath = path.resolve(UPLOADS_DIR, `${f.id}.pdf`);
      const existsOnDisk = fs.existsSync(diskPath);
      const inlineFallback = !existsOnDisk ? (f.pdfBase64 || doc.pdfBase64 || '') : '';
      return {
        ...f,
        rawUrl: `/api/view/${doc.id}/files/${f.id}/raw`,
        pdfBase64: inlineFallback,
        hasBinaryOnServer: existsOnDisk || Boolean(inlineFallback && inlineFallback.length > 50),
      };
    });

    res.json({
      allowed: true,
      files: filesWithData,
      rawUrl: filesWithData[0]?.rawUrl,
      pdfBase64: filesWithData[0]?.pdfBase64 || '',
      watermarkText: computedWatermark,
      watermarkOpacity: doc.settings.watermarkOpacity ?? 0.22,
      antiScreenBlur: doc.settings.antiScreenBlur ?? true,
      title: doc.title,
      pageCount: doc.pageCount,
    });
  });

  // Streaming PDF binary endpoint with HTTP Range & HEAD support for 400MB+ instant rendering on mobile and desktop
  const handleRawPdfStream = (req: express.Request, res: express.Response) => {
    try {
      const { id, fileId } = req.params;
      let doc = documents.find((d) => d.id === id);
      if (!doc) {
        documents = loadDocuments();
        doc = documents.find((d) => d.id === id);
      }
      if (!doc) {
        return res.status(404).json({ error: 'Document not found' });
      }

      // Check if file belongs to document
      const fileMeta = doc.files.find((f) => f.id === fileId) || doc.files[0];
      if (!fileMeta) {
        return res.status(404).json({ error: 'File not found in document pack' });
      }

      res.setHeader(
        'Access-Control-Expose-Headers',
        'Accept-Ranges, Content-Encoding, Content-Length, Content-Range'
      );

      const filePath = path.resolve(UPLOADS_DIR, `${fileMeta.id}.pdf`);
      if (!fs.existsSync(filePath)) {
        // Fallback: if file has base64 stored in doc (sample bundle)
        const b64 = fileMeta.pdfBase64 || doc.pdfBase64;
        if (b64) {
          const cleanBase64 = b64.includes(',') ? b64.split(',')[1] : b64;
          const buffer = Buffer.from(cleanBase64, 'base64');
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Length', buffer.length);
          res.setHeader('Accept-Ranges', 'none');
          if (req.method === 'HEAD') {
            return res.status(200).end();
          }
          return res.send(buffer);
        }
        return res.status(404).json({ error: 'PDF file binary not found on server' });
      }

      const stat = fs.statSync(filePath);
      const fileSize = stat.size;
      const range = req.headers.range;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${encodeURIComponent(fileMeta.originalFilename || 'document.pdf')}"`
      );

      if (req.method === 'HEAD') {
        res.setHeader('Content-Length', fileSize);
        return res.status(200).end();
      }

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = Math.max(0, parseInt(parts[0], 10) || 0);
        const end = parts[1] ? Math.min(fileSize - 1, parseInt(parts[1], 10)) : fileSize - 1;
        if (start >= fileSize || start > end) {
          res.writeHead(416, {
            'Content-Range': `bytes */${fileSize}`,
          });
          return res.end();
        }
        const chunksize = end - start + 1;
        const fileStream = fs.createReadStream(filePath, { start, end });
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': 'application/pdf',
        });
        req.on('close', () => fileStream.destroy());
        fileStream.on('error', () => res.end());
        fileStream.pipe(res);
      } else {
        const fileStream = fs.createReadStream(filePath);
        res.writeHead(200, {
          'Content-Length': fileSize,
          'Content-Type': 'application/pdf',
          'Accept-Ranges': 'bytes',
        });
        req.on('close', () => fileStream.destroy());
        fileStream.on('error', () => res.end());
        fileStream.pipe(res);
      }
    } catch (err: any) {
      console.error('Error streaming PDF file:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to stream PDF: ' + err.message });
      }
    }
  };

  app.get('/api/view/:id/files/:fileId/raw', handleRawPdfStream);
  app.head('/api/view/:id/files/:fileId/raw', handleRawPdfStream);

  // Get viewer logs / analytics for owner
  app.get('/api/documents/:id/analytics', (req, res) => {
    const doc = documents.find((d) => d.id === req.params.id);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }
    res.json({
      viewsCount: doc.viewsCount,
      accessLogs: doc.accessLogs,
    });
  });

  // Setup Vite in Dev or Static files in Prod
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SecureDoc server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
