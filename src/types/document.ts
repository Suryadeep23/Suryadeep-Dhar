export interface DocumentSettings {
  password?: string;
  expiresAt?: string | null;
  maxViews?: number | null;
  requireEmail?: boolean;
  watermarkText?: string;
  includeViewerEmailInWatermark?: boolean;
  includeTimestampInWatermark?: boolean;
  watermarkOpacity?: number; // 0.1 to 0.5
  antiScreenBlur?: boolean;
}

export interface AccessLog {
  id: string;
  timestamp: string;
  viewerName?: string;
  viewerEmail?: string;
  ip?: string;
  userAgent?: string;
}

export interface PdfDocumentItem {
  id: string;
  title: string;
  originalFilename: string;
  fileSize: number;
  pageCount: number;
  pdfBase64?: string;
  rawUrl?: string;
  hasBinaryOnServer?: boolean;
}

export interface PdfDocumentItemMeta {
  id: string;
  title: string;
  originalFilename: string;
  fileSize: number;
  pageCount: number;
  rawUrl?: string;
  hasBinaryOnServer?: boolean;
}

export interface DocumentRecord {
  id: string;
  title: string;
  folder?: string;
  files: PdfDocumentItem[];
  originalFilename?: string;
  fileSize: number; // total file size in bytes
  pageCount: number; // total page count across all files
  createdAt: string;
  isActive: boolean;
  viewsCount: number;
  settings: DocumentSettings;
  pdfBase64?: string; // fallback
  hasPassword?: boolean;
  hasBinaryOnServer?: boolean;
  accessLogs?: AccessLog[];
}

export interface ViewMetaResponse {
  id: string;
  title: string;
  folder?: string;
  pageCount: number;
  fileCount: number;
  files: PdfDocumentItemMeta[];
  isActive: boolean;
  isExpired: boolean;
  isMaxViewsReached: boolean;
  requiresPassword: boolean;
  requiresEmail: boolean;
  watermarkText?: string;
  antiScreenBlur?: boolean;
  createdAt: string;
}

export interface ViewAccessResponse {
  allowed: boolean;
  files?: PdfDocumentItem[];
  pdfBase64?: string;
  watermarkText?: string;
  watermarkOpacity?: number;
  antiScreenBlur?: boolean;
  title?: string;
  pageCount?: number;
  error?: string;
}
