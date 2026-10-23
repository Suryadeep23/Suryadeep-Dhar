export interface AuthUser {
  id: string;
  name: string;
  identifier: string; // Gmail address or Phone number
  identifierType: 'gmail' | 'phone';
  email?: string;
  phone?: string;
  role: 'admin' | 'coordinator' | 'volunteer';
  canUpload?: boolean;
  avatarColor?: string;
  lastLoginAt: string;
  isOwner?: boolean;
}

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

export interface AddAdminRequest {
  name: string;
  identifier: string;
  identifierType: 'gmail' | 'phone';
  countryCode?: string;
  password?: string;
  role?: 'admin' | 'coordinator' | 'volunteer';
  canUpload?: boolean;
  note?: string;
}

export interface LoginCredentials {
  identifier: string; // Gmail or phone
  password: string;
  identifierType: 'gmail' | 'phone';
  countryCode?: string;
  rememberMe?: boolean;
}

export interface RegisterCredentials {
  name: string;
  identifier: string;
  password: string;
  identifierType: 'gmail' | 'phone';
  countryCode?: string;
  role?: 'admin' | 'coordinator' | 'volunteer';
}

export interface RegisteredAccount {
  id: string;
  name: string;
  identifier: string; // Gmail or phone
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

export interface AuthResponse {
  success: boolean;
  user?: AuthUser;
  error?: string;
  code?: 'ACCOUNT_NOT_FOUND' | 'ALREADY_EXISTS' | 'INVALID_PASSWORD';
  token?: string;
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
  ip?: string;
  userAgent?: string;
}
