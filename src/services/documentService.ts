import {
  DocumentRecord,
  DocumentSettings,
  ViewAccessResponse,
  ViewMetaResponse,
  AccessLog,
  PdfDocumentItem,
} from '../types/document';
import { generateSampleMultiDocumentBundle } from './sampleDocs';
import { base64ToUint8Array } from '../lib/pdfWorker';
import { authService, getAuthHeaders } from './authService';

const LOCAL_STORAGE_KEY = 'securedoc_documents_v1';
const IDB_NAME = 'squad_vault_idb_v1';
const IDB_VERSION = 1;
const IDB_DOCS_STORE = 'documents';
const IDB_BINARIES_STORE = 'file_binaries';

// Open IndexedDB for high-capacity permanent storage of uploaded PDFs and binaries
function openVaultIdb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve(null);
      return;
    }
    try {
      const req = window.indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_DOCS_STORE)) {
          db.createObjectStore(IDB_DOCS_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(IDB_BINARIES_STORE)) {
          db.createObjectStore(IDB_BINARIES_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

// Session memory cache for immediate 0ms access to uploaded or viewed Blobs
const sessionFileBlobs = new Map<string, Blob>();

export async function saveFileBinaryToIdb(fileId: string, binaryData: Blob | Uint8Array | string): Promise<void> {
  if (!fileId || !binaryData) return;
  if (binaryData instanceof Blob) {
    sessionFileBlobs.set(fileId, binaryData);
  }
  const db = await openVaultIdb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_BINARIES_STORE, 'readwrite');
      tx.objectStore(IDB_BINARIES_STORE).put(binaryData, fileId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function saveFileChunkToIdb(
  fileId: string,
  chunkIndex: number,
  totalChunks: number,
  totalSize: number,
  chunkBytes: Uint8Array
): Promise<void> {
  if (!fileId || totalSize > 200 * 1024 * 1024) return;
  const db = await openVaultIdb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_BINARIES_STORE, 'readwrite');
      const store = tx.objectStore(IDB_BINARIES_STORE);
      store.put(chunkBytes, `${fileId}_chunk_${chunkIndex}`);
      if (chunkIndex === 0 || chunkIndex === totalChunks - 1) {
        store.put({ totalChunks, totalSize, updatedAt: Date.now() }, `${fileId}_meta`);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function getChunkedBlobFromIdb(fileId: string): Promise<Blob | null> {
  if (!fileId) return null;
  const db = await openVaultIdb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_BINARIES_STORE, 'readonly');
      const store = tx.objectStore(IDB_BINARIES_STORE);
      const metaReq = store.get(`${fileId}_meta`);
      metaReq.onsuccess = () => {
        const meta = metaReq.result;
        if (!meta || typeof meta.totalChunks !== 'number' || meta.totalChunks <= 0) {
          resolve(null);
          return;
        }
        const totalChunks = meta.totalChunks;
        const parts: Uint8Array[] = new Array(totalChunks);
        let loaded = 0;
        let failed = false;

        for (let i = 0; i < totalChunks; i++) {
          const cReq = store.get(`${fileId}_chunk_${i}`);
          cReq.onsuccess = () => {
            if (failed) return;
            const val = cReq.result;
            if (val instanceof Uint8Array && val.byteLength > 0) {
              parts[i] = val;
            } else if (val instanceof ArrayBuffer && val.byteLength > 0) {
              parts[i] = new Uint8Array(val);
            } else {
              failed = true;
              resolve(null);
              return;
            }
            loaded++;
            if (loaded === totalChunks) {
              const assembled = new Blob(parts as any[], { type: 'application/pdf' });
              sessionFileBlobs.set(fileId, assembled);
              resolve(assembled);
            }
          };
          cReq.onerror = () => {
            if (!failed) {
              failed = true;
              resolve(null);
            }
          };
        }
      };
      metaReq.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function getFileBinaryFromIdb(fileId: string): Promise<Blob | Uint8Array | string | null> {
  if (!fileId) return null;
  const memBlob = sessionFileBlobs.get(fileId);
  if (memBlob && memBlob.size > 0) {
    try {
      const probe = await memBlob.slice(0, Math.min(64, memBlob.size)).arrayBuffer();
      if (probe.byteLength > 0) return memBlob;
    } catch {
      sessionFileBlobs.delete(fileId);
    }
  }
  const chunkedBlob = await getChunkedBlobFromIdb(fileId);
  if (chunkedBlob && chunkedBlob.size > 0) {
    return chunkedBlob;
  }
  const db = await openVaultIdb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_BINARIES_STORE, 'readonly');
      const req = tx.objectStore(IDB_BINARIES_STORE).get(fileId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function deleteFileBinaryFromIdb(fileId: string): Promise<void> {
  if (!fileId) return;
  sessionFileBlobs.delete(fileId);
  const db = await openVaultIdb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_BINARIES_STORE, 'readwrite');
      const store = tx.objectStore(IDB_BINARIES_STORE);
      store.delete(fileId);
      const metaReq = store.get(`${fileId}_meta`);
      metaReq.onsuccess = () => {
        const meta = metaReq.result;
        if (meta && typeof meta.totalChunks === 'number') {
          for (let i = 0; i < meta.totalChunks; i++) {
            store.delete(`${fileId}_chunk_${i}`);
          }
        }
        store.delete(`${fileId}_meta`);
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function saveDocsToIdb(docs: DocumentRecord[]): Promise<void> {
  const db = await openVaultIdb();
  if (!db) return;
  const deletedIds = getDeletedDocIds();
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_DOCS_STORE, 'readwrite');
      const store = tx.objectStore(IDB_DOCS_STORE);
      for (const doc of docs) {
        if (doc && doc.id && !deletedIds.includes(doc.id)) {
          store.put(doc);
        }
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function getAllDocsFromIdb(): Promise<DocumentRecord[]> {
  const db = await openVaultIdb();
  if (!db) return [];
  const deletedIds = getDeletedDocIds();
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_DOCS_STORE, 'readonly');
      const req = tx.objectStore(IDB_DOCS_STORE).getAll();
      req.onsuccess = () => {
        const list = Array.isArray(req.result) ? req.result : [];
        resolve(
          list
            .filter((d: any) => d && d.id && !deletedIds.includes(d.id))
            .map(normalizeLocalDoc)
        );
      };
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

async function deleteDocFromIdb(docId: string): Promise<void> {
  if (!docId) return;
  const db = await openVaultIdb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_DOCS_STORE, 'readwrite');
      tx.objectStore(IDB_DOCS_STORE).delete(docId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

function normalizeLocalDoc(doc: any): DocumentRecord {
  const files: PdfDocumentItem[] = Array.isArray(doc.files) && doc.files.length > 0
    ? doc.files
    : doc.pdfBase64
    ? [
        {
          id: 'f_1',
          title: doc.title || 'Document 1',
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
    ...doc,
    files,
    fileSize: totalSize,
    pageCount: totalPages,
    viewsCount: doc.viewsCount || 0,
    accessLogs: doc.accessLogs || [],
  };
}

function getDeletedDocIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem('helping_squad_deleted_doc_ids') || '[]');
  } catch {
    return [];
  }
}

function recordDeletedDocId(id: string) {
  try {
    const list = getDeletedDocIds();
    if (!list.includes(id)) {
      list.push(id);
      localStorage.setItem('helping_squad_deleted_doc_ids', JSON.stringify(list));
    }
  } catch {}
}

export function getLocalFoldersSync(): { customFolders: string[]; deletedFolders: string[] } {
  try {
    const custom = JSON.parse(localStorage.getItem('helping_squad_custom_folders') || '[]');
    const deleted = JSON.parse(localStorage.getItem('helping_squad_deleted_folders') || '[]');
    return {
      customFolders: Array.isArray(custom) ? custom : [],
      deletedFolders: Array.isArray(deleted) ? deleted : [],
    };
  } catch {
    return { customFolders: [], deletedFolders: [] };
  }
}

function getLocalDocuments(): DocumentRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    const deletedIds = getDeletedDocIds();
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((d: any) => d && !deletedIds.includes(d.id))
          .map(normalizeLocalDoc);
      }
    }
  } catch (err) {
    console.warn('Could not read from localStorage', err);
  }
  return [];
}

function saveLocalDocuments(docs: DocumentRecord[]) {
  const deletedIds = getDeletedDocIds();
  const { deletedFolders, customFolders } = getLocalFoldersSync();
  const defaultCandidates = [
    'Official Handbooks',
    'Squad Manuals & Guides',
    'Operational Reports',
    'Confidential Packets',
    'General PDFs',
  ];
  const activeFolders = [...defaultCandidates, ...customFolders].filter(
    (f) => !deletedFolders.some((df) => df.toLowerCase() === f.toLowerCase())
  );
  const safeFallback = activeFolders.includes('General PDFs')
    ? 'General PDFs'
    : activeFolders[0] || 'Uncategorized';

  const cleanDocs = docs
    .filter((d) => d && !deletedIds.includes(d.id))
    .map((d) => {
      const curFolder = (d.folder && d.folder.trim()) ? d.folder.trim() : 'General PDFs';
      return { ...d, folder: curFolder };
    });

  // Save full documents to IndexedDB (no 5MB limit)
  saveDocsToIdb(cleanDocs).catch(() => {});

  // Save lightweight metadata to localStorage (strip large pdfBase64 strings so QuotaExceededError never occurs)
  try {
    const lightweightDocs = cleanDocs.map((d) => ({
      ...d,
      pdfBase64: d.pdfBase64 && d.pdfBase64.length < 150000 ? d.pdfBase64 : '',
      files: (d.files || []).map((f) => ({
        ...f,
        pdfBase64: f.pdfBase64 && f.pdfBase64.length < 150000 ? f.pdfBase64 : '',
      })),
    }));
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(lightweightDocs));
  } catch (err) {
    console.warn('Could not save to localStorage', err);
  }
}

const uploadedServerFileIds = new Set<string>();

// Helper to convert ArrayBuffer to Base64 string safely
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + step)));
  }
  return btoa(binary);
}

// Consistent 1 MB chunk size for fast parallel transfers and 100% compatibility across mobile proxies & Cloud Run
const UPLOAD_CHUNK_SIZE = 1024 * 1024; // 1 MB

// Upload a single chunk at its exact byte offset with up to 5 automatic retries and JSON fallback
async function uploadSingleChunkWithRetry(
  fileId: string,
  chunkIdx: number,
  totalChunks: number,
  byteOffset: number,
  chunkBuffer: ArrayBuffer,
  resetUpload: boolean,
  isClientSync = false
): Promise<void> {
  let uploaded = false;
  let lastError = '';

  const extraHeaders: Record<string, string> = isClientSync ? { 'x-client-sync': 'true' } : {};

  for (let attempt = 1; attempt <= 5 && !uploaded; attempt++) {
    try {
      // Attempt 1: Fast raw binary octet-stream
      const res = await fetch('/api/upload/chunk', {
        method: 'POST',
        headers: {
          'x-file-id': fileId,
          'x-chunk-index': String(chunkIdx),
          'x-total-chunks': String(totalChunks),
          'x-byte-offset': String(byteOffset),
          ...(resetUpload ? { 'x-upload-reset': 'true' } : {}),
          'Content-Type': 'application/octet-stream',
          ...getAuthHeaders(),
          ...extraHeaders,
        },
        body: chunkBuffer,
      });

      if (res.ok) {
        const resData = await res.json().catch(() => null);
        if (resData && resData.success) {
          uploaded = true;
          break;
        }
      }

      if (res.status === 403) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || 'Administrative permission required to upload PDF files.');
      }

      // Attempt 2: Fallback to JSON Base64 chunk if raw binary was blocked or corrupted by proxy
      const chunkBase64 = arrayBufferToBase64(chunkBuffer);
      const jsonRes = await fetch('/api/upload/chunk-json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
          ...extraHeaders,
        },
        body: JSON.stringify({
          fileId,
          chunkIndex: chunkIdx,
          totalChunks,
          byteOffset,
          resetUpload,
          chunkBase64,
          isClientSync,
        }),
      });

      if (jsonRes.ok) {
        const jsonData = await jsonRes.json().catch(() => null);
        if (jsonData && jsonData.success) {
          uploaded = true;
          break;
        }
      }

      const jsonErr = await jsonRes.json().catch(() => null);
      lastError = jsonErr?.error || `HTTP ${jsonRes.status}`;
    } catch (err: any) {
      if (err?.message?.includes('permission') || err?.message?.includes('Permission Denied')) {
        throw err;
      }
      lastError = err?.message || 'Network connectivity error';
    }

    if (!uploaded && attempt < 5) {
      await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
    }
  }

  if (!uploaded) {
    throw new Error(`Failed to upload chunk ${chunkIdx + 1} of ${totalChunks}: ${lastError}`);
  }
}

// Upload a Blob in streaming 1 MB chunks to server disk with 3x parallel workers, materialized IndexedDB chunk caching, and server disk verification
async function uploadBlobInChunksToServer(
  fileId: string,
  blob: Blob,
  onProgress?: (percent: number, mbUploaded: number) => void,
  isClientSync = false
): Promise<void> {
  sessionFileBlobs.set(fileId, blob);
  const totalChunks = Math.max(1, Math.ceil(blob.size / UPLOAD_CHUNK_SIZE));
  let completedChunks = 0;
  let bytesUploaded = 0;

  const processSingleChunk = async (chunkIdx: number, resetUpload: boolean) => {
    const start = chunkIdx * UPLOAD_CHUNK_SIZE;
    const end = Math.min(blob.size, start + UPLOAD_CHUNK_SIZE);
    const chunkSlice = blob.slice(start, end);
    const chunkBuffer = await chunkSlice.arrayBuffer();

    // Persist materialized Uint8Array chunk into IndexedDB so it never expires when mobile file pickers close
    saveFileChunkToIdb(fileId, chunkIdx, totalChunks, blob.size, new Uint8Array(chunkBuffer)).catch(() => {});

    await uploadSingleChunkWithRetry(
      fileId,
      chunkIdx,
      totalChunks,
      start,
      chunkBuffer,
      resetUpload,
      isClientSync
    );

    completedChunks++;
    bytesUploaded += end - start;
    if (onProgress) {
      const percent = Math.min(99, Math.round((completedChunks / totalChunks) * 100));
      const mbUploaded = Number((bytesUploaded / (1024 * 1024)).toFixed(1));
      onProgress(percent, mbUploaded);
    }
  };

  // Step 1: Upload chunk 0 first with resetUpload=true to initialize the target file cleanly on server disk
  await processSingleChunk(0, true);

  // Step 2: Upload remaining chunks (1 .. totalChunks - 1) using up to 3 concurrent workers for 3x faster large PDF transfers
  if (totalChunks > 1) {
    let nextChunkIdx = 1;
    const workerCount = Math.min(3, totalChunks - 1);
    const workers = Array.from({ length: workerCount }, async () => {
      while (nextChunkIdx < totalChunks) {
        const currentIdx = nextChunkIdx++;
        await processSingleChunk(currentIdx, false);
      }
    });
    await Promise.all(workers);
  }

  // Step 3: Verify on server disk that the file exists and has size > 0
  try {
    const statusRes = await fetch(`/api/upload/status/${encodeURIComponent(fileId)}`, {
      cache: 'no-store',
    });
    if (statusRes.ok) {
      const statusData = await statusRes.json();
      if (!statusData.exists || statusData.totalBytes <= 0) {
        throw new Error('Server disk verification failed: PDF binary was not persisted on server.');
      }
    }
  } catch (verifyErr: any) {
    if (verifyErr?.message?.includes('Server disk verification failed')) {
      throw verifyErr;
    }
  }

  if (onProgress) {
    onProgress(100, Number((blob.size / (1024 * 1024)).toFixed(1)));
  }

  uploadedServerFileIds.add(fileId);
}

// Resolve a file's binary from IndexedDB or fallback Base64 into a verified readable Blob for chunked server upload
async function resolveFileBinaryAsBlob(fileId: string, fallbackBase64?: string): Promise<Blob | null> {
  try {
    const stored = await getFileBinaryFromIdb(fileId);
    if (stored instanceof Blob && stored.size > 0) {
      // Verify the Blob is actually readable (guards against expired Android File handles from older uploads)
      try {
        const probe = await stored.slice(0, Math.min(64, stored.size)).arrayBuffer();
        if (probe.byteLength > 0) {
          return stored;
        }
      } catch {
        // Expired OS file handle; fall through to fallbackBase64
      }
    }
    if (stored instanceof Uint8Array && stored.byteLength > 0) {
      return new Blob([stored as any], { type: 'application/pdf' });
    }
    if (typeof stored === 'string' && stored.length > 50) {
      const bytes = base64ToUint8Array(stored);
      if (bytes.byteLength > 0) {
        return new Blob([bytes as any], { type: 'application/pdf' });
      }
    }
    if (fallbackBase64 && fallbackBase64.length > 50) {
      const bytes = base64ToUint8Array(fallbackBase64);
      if (bytes.byteLength > 0) {
        return new Blob([bytes as any], { type: 'application/pdf' });
      }
    }
  } catch (err) {
    console.warn('Error resolving file binary as Blob:', err);
  }
  return null;
}

// Re-sync a locally saved document (and its PDF binaries from IndexedDB) back to the server so all other users can see and view it.
// Returns true if ALL PDF binaries existed and were synced to the server; returns false if the local record was a 0-byte ghost entry.
async function syncMissingDocToServer(doc: DocumentRecord): Promise<boolean> {
  try {
    if (!doc || !Array.isArray(doc.files) || doc.files.length === 0) {
      return false;
    }

    const filesToSync: PdfDocumentItem[] = [];

    for (const f of doc.files) {
      const blob = await resolveFileBinaryAsBlob(f.id, f.pdfBase64 || doc.pdfBase64);
      if (!blob || blob.size === 0) {
        // Missing binary for this file -> cannot sync a 0-byte ghost entry
        return false;
      }
      await uploadBlobInChunksToServer(f.id, blob, undefined, true);
      // Always strip huge pdfBase64 from JSON payload so POST /api/documents is <2KB and never hits proxy limits
      filesToSync.push({
        id: f.id,
        title: f.title,
        originalFilename: f.originalFilename,
        fileSize: blob.size || f.fileSize,
        pageCount: f.pageCount || 1,
        pdfBase64: '',
      });
    }

    const res = await fetch('/api/documents', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-sync': 'true',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        id: doc.id,
        title: doc.title,
        folder: doc.folder,
        files: filesToSync,
        originalFilename: doc.originalFilename,
        fileSize: doc.fileSize,
        pageCount: doc.pageCount,
        settings: doc.settings,
        createdAt: doc.createdAt,
        isActive: doc.isActive !== false,
        viewsCount: doc.viewsCount,
        accessLogs: doc.accessLogs,
        pdfBase64: '',
        isClientSync: true,
      }),
    });
    return res.ok;
  } catch (err) {
    console.warn('Background document sync skipped:', err);
    return false;
  }
}

export const documentService = {
  // Retrieve raw PDF bytes from IndexedDB or fallback Base64 for instant offline/container-reset viewing
  async getFileBinaryBytes(fileId: string, fallbackBase64?: string): Promise<Uint8Array | null> {
    try {
      const stored = await getFileBinaryFromIdb(fileId);
      if (stored instanceof Uint8Array && stored.byteLength > 0) {
        return stored;
      }
      if (stored instanceof Blob && stored.size > 0) {
        try {
          const buf = await stored.arrayBuffer();
          if (buf.byteLength > 0) {
            return new Uint8Array(buf);
          }
        } catch {
          // Expired OS File handle; fall through to fallbackBase64
        }
      }
      if (typeof stored === 'string' && stored.length > 50) {
        const arr = base64ToUint8Array(stored);
        if (arr.byteLength > 0) return arr;
      }
      if (fallbackBase64 && fallbackBase64.length > 50) {
        const arr = base64ToUint8Array(fallbackBase64);
        if (arr.byteLength > 0) return arr;
      }
    } catch (err) {
      console.warn('Error reading file binary from IndexedDB:', err);
    }
    return null;
  },

  async cacheFileBinaryBytes(fileId: string, bytes: Uint8Array): Promise<void> {
    if (!fileId || !bytes || bytes.byteLength === 0) return;
    const blob = new Blob([bytes as any], { type: 'application/pdf' });
    await saveFileBinaryToIdb(fileId, blob);
  },

  // Get all documents for the dashboard (merges server + local IndexedDB/localStorage and ensures all uploads are synced to the server for all users)
  async getDocuments(): Promise<DocumentRecord[]> {
    // Gather locally persisted documents: load localStorage first, then IndexedDB second so full IndexedDB records are never overwritten by stripped localStorage records
    const lsDocs = getLocalDocuments();
    const idbDocs = await getAllDocsFromIdb();
    const localMap = new Map<string, DocumentRecord>();
    for (const d of [...lsDocs, ...idbDocs]) {
      if (d && d.id) {
        const existing = localMap.get(d.id);
        if (!existing) {
          localMap.set(d.id, d);
        } else {
          localMap.set(d.id, {
            ...existing,
            ...d,
            pdfBase64: d.pdfBase64 || existing.pdfBase64 || '',
            files: (d.files || existing.files || []).map((f, idx) => ({
              ...f,
              pdfBase64: f.pdfBase64 || existing.files?.[idx]?.pdfBase64 || '',
            })),
          });
        }
      }
    }

    try {
      // Sync folder deletions first so server doesn't hold stale folders
      await this.getFolders();

      const currentUser = authService.getCurrentUser();
      const isUserAdmin = Boolean(currentUser && (currentUser.role === 'admin' || currentUser.isOwner));
      const localDeletedIds = getDeletedDocIds();
      if (isUserAdmin && localDeletedIds.length > 0) {
        fetch('/api/documents/sync-deleted', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify({ deletedIds: localDeletedIds }),
        }).catch(() => {});
      }

      const res = await fetch('/api/documents', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        let serverDeletedIds: string[] = [];
        try {
          const delRes = await fetch('/api/documents/deleted-ids', { cache: 'no-store' });
          if (delRes.ok) {
            const delData = await delRes.json();
            if (Array.isArray(delData.deletedIds)) {
              serverDeletedIds = delData.deletedIds;
              serverDeletedIds.forEach((id) => recordDeletedDocId(id));
            }
          }
        } catch {}

        const deletedIds = Array.from(new Set([...getDeletedDocIds(), ...serverDeletedIds]));
        const rawServerList: any[] = Array.isArray(data) ? data : [];
        const serverDocs: DocumentRecord[] = rawServerList
          .filter((d: any) => d && !deletedIds.includes(d.id))
          .map(normalizeLocalDoc);

        const serverIds = new Set(serverDocs.map((d) => d.id));
        const mergedDocs: DocumentRecord[] = [...serverDocs];

        // If any locally cached document has a valid PDF binary in IndexedDB/memory, push it to the server so all users see it.
        // If a local document is NOT on the server and has NO binary (0-byte ghost entry from an old interrupted session), purge it so it never shows a blank page.
        for (const [docId, localDoc] of localMap.entries()) {
          if (deletedIds.includes(docId)) continue;
          if (!serverIds.has(docId)) {
            const syncedOk = await syncMissingDocToServer(localDoc);
            if (syncedOk) {
              const docWithStatus: DocumentRecord = {
                ...localDoc,
                hasBinaryOnServer: true,
                files: (localDoc.files || []).map((f) => ({
                  ...f,
                  hasBinaryOnServer: true,
                })),
              };
              mergedDocs.unshift(docWithStatus);
            } else {
              // Purge unrecoverable 0-byte local ghost entry
              await deleteDocFromIdb(docId);
            }
          } else {
            const idx = mergedDocs.findIndex((d) => d.id === docId);
            if (idx >= 0) {
              const sDoc = mergedDocs[idx];
              const rawServerDoc = rawServerList.find((rd) => rd && rd.id === docId);
              const missingBinaryOnServer =
                Array.isArray(rawServerDoc?.files) &&
                rawServerDoc.files.some((rf: any) => rf && rf.hasBinaryOnServer === false);

              let fixedOnServer = !missingBinaryOnServer;
              if (missingBinaryOnServer && docId !== 'all_handbooks') {
                fixedOnServer = await syncMissingDocToServer(localDoc);
              }

              mergedDocs[idx] = {
                ...sDoc,
                hasBinaryOnServer: fixedOnServer,
                files: sDoc.files.map((sf, fIdx) => ({
                  ...sf,
                  hasBinaryOnServer: fixedOnServer ? true : sf.hasBinaryOnServer,
                  pdfBase64: sf.pdfBase64 || localDoc.files?.[fIdx]?.pdfBase64 || '',
                })),
              };
            }
          }
        }

        // Sort newest first (keeping all_handbooks available)
        mergedDocs.sort((a, b) => {
          const timeA = new Date(a.createdAt || 0).getTime();
          const timeB = new Date(b.createdAt || 0).getTime();
          return timeB - timeA;
        });

        saveLocalDocuments(mergedDocs);
        return mergedDocs;
      }
    } catch {
      // Fallback to local storage + IndexedDB if API is offline
    }

    const fallbackList = Array.from(localMap.values());
    saveLocalDocuments(fallbackList);
    return fallbackList;
  },

  // Upload a file in streaming chunks (handles any file size up to 400 MB per PDF with zero memory bloat)
  async uploadFileInChunks(
    fileId: string,
    file: Blob,
    onProgress?: (percent: number, mbUploaded: number) => void
  ): Promise<boolean> {
    const user = authService.getCurrentUser();
    if (!user || (user.role !== 'admin' && !user.isOwner)) {
      throw new Error('Access Denied: Only administrators have permission to upload PDF files.');
    }
    await uploadBlobInChunksToServer(fileId, file, onProgress);
    if (file.size <= 10 * 1024 * 1024) {
      try { await saveFileBinaryToIdb(fileId, file); } catch {}
    }
    return true;
  },

  // Repair an incomplete / local-only document by uploading its actual PDF file to the server so all users can view it
  async repairDocumentWithFile(
    doc: DocumentRecord,
    file: File,
    pageCount: number,
    onProgress?: (percent: number, mbUploaded: number) => void
  ): Promise<DocumentRecord> {
    const user = authService.getCurrentUser();
    if (!user || (user.role !== 'admin' && !user.isOwner)) {
      throw new Error('Access Denied: Only administrators have permission to repair PDF files.');
    }

    const targetFileId = doc.files?.[0]?.id || 'f_' + Math.random().toString(36).substring(2, 9);
    await uploadBlobInChunksToServer(targetFileId, file, onProgress);
    if (file.size <= 10 * 1024 * 1024) {
      try { await saveFileBinaryToIdb(targetFileId, file); } catch {}
    }

    const updatedFileItem: PdfDocumentItem = {
      id: targetFileId,
      title: doc.files?.[0]?.title || doc.title || file.name.replace(/\.[^/.]+$/, ''),
      originalFilename: file.name,
      fileSize: file.size,
      pageCount: Math.max(1, pageCount),
      pdfBase64: '',
      rawUrl: `/api/view/${doc.id}/files/${targetFileId}/raw`,
      hasBinaryOnServer: true,
    };

    const res = await fetch('/api/documents', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        id: doc.id,
        title: doc.title,
        folder: doc.folder || 'Official Handbooks',
        files: [updatedFileItem],
        originalFilename: file.name,
        fileSize: file.size,
        pageCount: Math.max(1, pageCount),
        settings: doc.settings,
        createdAt: doc.createdAt || new Date().toISOString(),
        isActive: doc.isActive !== false,
        viewsCount: doc.viewsCount || 0,
        accessLogs: doc.accessLogs || [],
        pdfBase64: '',
        forceRestore: true,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      throw new Error(errData?.error || 'Failed to upload repaired PDF to server');
    }

    const saved = normalizeLocalDoc(await res.json());
    const enriched: DocumentRecord = {
      ...saved,
      hasBinaryOnServer: true,
      files: saved.files.map((f) => ({ ...f, hasBinaryOnServer: true })),
    };

    const currentLocal = getLocalDocuments().filter((d) => d.id !== enriched.id);
    currentLocal.unshift(enriched);
    saveLocalDocuments(currentLocal);
    return enriched;
  },

  // Upload / create new document (supports 1 or MULTIPLE documents in 1 link)
  async createDocument(data: {
    title: string;
    folder?: string;
    files?: PdfDocumentItem[];
    originalFilename?: string;
    fileSize?: number;
    pageCount?: number;
    pdfBase64?: string;
    settings: DocumentSettings;
    uploaderId?: string;
    uploaderName?: string;
    uploaderIdentifier?: string;
    isExplicitNewFolder?: boolean;
  }): Promise<DocumentRecord> {
    const user = authService.getCurrentUser();
    if (!user || (user.role !== 'admin' && !user.isOwner)) {
      throw new Error('Access Denied: Only administrators have permission to upload PDF files.');
    }

    // Ensure destination folder is removed from local deletedFolders so background sync never re-deletes it
    const chosenFolder = (data.folder || '').trim();
    if (chosenFolder) {
      try {
        const deleted: string[] = JSON.parse(localStorage.getItem('helping_squad_deleted_folders') || '[]');
        if (Array.isArray(deleted)) {
          const updatedDeleted = deleted.filter((f) => f.toLowerCase() !== chosenFolder.toLowerCase());
          localStorage.setItem('helping_squad_deleted_folders', JSON.stringify(updatedDeleted));
        }
      } catch {}
    }

    const incomingFiles: PdfDocumentItem[] =
      data.files && data.files.length > 0
        ? data.files
        : [
            {
              id: 'f_' + Math.random().toString(36).substring(2, 9),
              title: data.title,
              originalFilename: data.originalFilename || 'document.pdf',
              fileSize: data.fileSize || 0,
              pageCount: data.pageCount || 1,
              pdfBase64: data.pdfBase64 || '',
            },
          ];

    // Ensure every file binary is uploaded to the server disk in streaming chunks
    for (const f of incomingFiles) {
      if (!uploadedServerFileIds.has(f.id)) {
        const blob = await resolveFileBinaryAsBlob(f.id, f.pdfBase64 || data.pdfBase64);
        if (blob && blob.size > 0) {
          await uploadBlobInChunksToServer(f.id, blob);
        }
      }
    }

    // Strip large pdfBase64 strings when the binary chunks are confirmed uploaded to the server disk
    const lightweightFilesForServer = incomingFiles.map((f) => ({
      id: f.id,
      title: f.title,
      originalFilename: f.originalFilename,
      fileSize: f.fileSize,
      pageCount: f.pageCount,
      pdfBase64: uploadedServerFileIds.has(f.id)
        ? (f.pdfBase64 && f.pdfBase64.length < 100000 ? f.pdfBase64 : '')
        : (f.pdfBase64 || data.pdfBase64 || ''),
    }));

    // Retry POST /api/documents up to 4 times on transient network issues; never save a fake local-only ghost entry
    let lastError = 'Failed to publish document to server.';
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        const res = await fetch('/api/documents', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            ...data,
            files: lightweightFilesForServer,
            pdfBase64: '',
          }),
        });
        if (res.ok) {
          const createdServerDoc = normalizeLocalDoc(await res.json());
          const enrichedDoc: DocumentRecord = {
            ...createdServerDoc,
            hasBinaryOnServer: true,
            files: createdServerDoc.files.map((sf, idx) => ({
              ...sf,
              hasBinaryOnServer: true,
              pdfBase64: sf.pdfBase64 || incomingFiles[idx]?.pdfBase64 || '',
            })),
          };
          const currentLocal = getLocalDocuments().filter((d) => d.id !== enrichedDoc.id);
          currentLocal.unshift(enrichedDoc);
          saveLocalDocuments(currentLocal);
          return enrichedDoc;
        } else {
          const errorData = await res.json().catch(() => null);
          lastError = errorData?.error || `Upload failed (Status ${res.status})`;
          if (res.status === 400 || res.status === 403) {
            throw new Error(lastError);
          }
        }
      } catch (err: any) {
        lastError = err?.message || 'Network connectivity error while publishing document.';
        if (lastError.includes('Permission Denied') || lastError.includes('Access Denied')) {
          throw err;
        }
      }
      if (attempt < 4) {
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
      }
    }

    throw new Error(lastError);
  },

  // Update document settings / files
  async updateDocument(
    id: string,
    updates: {
      isActive?: boolean;
      title?: string;
      folder?: string;
      settings?: Partial<DocumentSettings>;
      files?: PdfDocumentItem[];
    }
  ): Promise<DocumentRecord | null> {
    const user = authService.getCurrentUser();
    if (!user || (user.role !== 'admin' && !user.isOwner)) {
      throw new Error('Access Denied: Only administrators have permission to modify documents.');
    }

    let serverUpdated: DocumentRecord | null = null;
    try {
      const res = await fetch(`/api/documents/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        serverUpdated = normalizeLocalDoc(await res.json());
      }
    } catch {
      // Fallback
    }

    const local = getLocalDocuments();
    const doc = local.find((d) => d.id === id);
    if (doc) {
      if (typeof updates.isActive === 'boolean') doc.isActive = updates.isActive;
      if (updates.title) doc.title = updates.title;
      if (updates.folder) doc.folder = updates.folder;
      if (updates.settings) doc.settings = { ...doc.settings, ...updates.settings };
      if (updates.files) {
        doc.files = updates.files;
        doc.fileSize = doc.files.reduce((sum, f) => sum + (f.fileSize || 0), 0);
        doc.pageCount = doc.files.reduce((sum, f) => sum + (f.pageCount || 1), 0);
        doc.pdfBase64 = doc.files[0]?.pdfBase64;
      }
      saveLocalDocuments(local);
      return doc;
    }

    if (serverUpdated) {
      local.unshift(serverUpdated);
      saveLocalDocuments(local);
      return serverUpdated;
    }
    return null;
  },

  // Delete document permanently (unrecoverable)
  async deleteDocument(id: string): Promise<boolean> {
    const user = authService.getCurrentUser();
    if (!user || (user.role !== 'admin' && !user.isOwner)) {
      throw new Error('Access Denied: Only administrators have permission to delete documents.');
    }

    recordDeletedDocId(id);
    const local = getLocalDocuments();
    const docToDelete = local.find((d) => d.id === id);
    if (docToDelete && Array.isArray(docToDelete.files)) {
      for (const f of docToDelete.files) {
        await deleteFileBinaryFromIdb(f.id);
      }
    }
    await deleteDocFromIdb(id);

    try {
      await fetch(`/api/documents/${id}`, {
        method: 'DELETE',
        headers: {
          ...getAuthHeaders(),
        },
      });
    } catch {
      // Fallback
    }
    // Permanently remove from client cache & local storage
    const filtered = local.filter((d) => d.id !== id);
    saveLocalDocuments(filtered);
    return true;
  },

  // Delete an individual PDF file from inside a document pack permanently (unrecoverable)
  async deleteFileFromDocument(
    docId: string,
    fileId: string
  ): Promise<{ success: boolean; deletedEntireDocument?: boolean }> {
    const user = authService.getCurrentUser();
    if (!user || (user.role !== 'admin' && !user.isOwner)) {
      throw new Error('Access Denied: Only administrators have permission to delete files.');
    }

    await deleteFileBinaryFromIdb(fileId);
    let serverRes: any = null;
    try {
      const res = await fetch(`/api/documents/${docId}/files/${fileId}`, {
        method: 'DELETE',
        headers: {
          ...getAuthHeaders(),
        },
      });
      if (res.ok) {
        serverRes = await res.json();
      }
    } catch {
      // Fallback
    }

    // Permanently update local storage & IndexedDB
    const local = getLocalDocuments();
    const doc = local.find((d) => d.id === docId);
    if (!doc) return serverRes || { success: false };

    doc.files = (doc.files || []).filter((f) => f.id !== fileId);
    if (doc.files.length === 0) {
      recordDeletedDocId(docId);
      await deleteDocFromIdb(docId);
      const filtered = local.filter((d) => d.id !== docId);
      saveLocalDocuments(filtered);
      return { success: true, deletedEntireDocument: true };
    }

    doc.fileSize = doc.files.reduce((sum, f) => sum + (f.fileSize || 0), 0);
    doc.pageCount = doc.files.reduce((sum, f) => sum + (f.pageCount || 1), 0);
    doc.pdfBase64 = doc.files[0]?.pdfBase64;
    saveLocalDocuments(local);
    return serverRes || { success: true };
  },

  // Get public metadata for a viewer
  async getViewMeta(id: string): Promise<ViewMetaResponse> {
    try {
      const res = await fetch(`/api/view/${id}/meta`);
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }

    const local = getLocalDocuments();
    const idbDocs = await getAllDocsFromIdb();
    const doc = local.find((d) => d.id === id) || idbDocs.find((d) => d.id === id);
    if (!doc) {
      throw new Error('Document link is invalid or document has been removed.');
    }

    // Also restore to server in background if server 404'd
    syncMissingDocToServer(doc);

    const isExpired = doc.settings.expiresAt
      ? new Date(doc.settings.expiresAt) < new Date()
      : false;
    const isMaxViewsReached =
      doc.settings.maxViews !== null &&
      doc.settings.maxViews !== undefined &&
      doc.settings.maxViews > 0 &&
      doc.viewsCount >= doc.settings.maxViews;

    const filesMeta = (doc.files || []).map((f) => ({
      id: f.id,
      title: f.title,
      originalFilename: f.originalFilename,
      fileSize: f.fileSize,
      pageCount: f.pageCount,
    }));

    return {
      id: doc.id,
      title: doc.title,
      pageCount: doc.pageCount,
      fileCount: filesMeta.length,
      files: filesMeta,
      isActive: doc.isActive,
      isExpired,
      isMaxViewsReached,
      requiresPassword: Boolean(doc.settings.password),
      requiresEmail: Boolean(doc.settings.requireEmail),
      watermarkText: doc.settings.watermarkText,
      antiScreenBlur: doc.settings.antiScreenBlur ?? true,
      createdAt: doc.createdAt,
    };
  },

  // Viewer requests access by submitting password or email
  async requestViewAccess(
    id: string,
    credentials: { password?: string; viewerEmail?: string; viewerName?: string }
  ): Promise<ViewAccessResponse> {
    try {
      const res = await fetch(`/api/view/${id}/access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });
      if (res.ok) {
        const data = await res.json();
        return data;
      } else if (res.status !== 404) {
        const data = await res.json().catch(() => ({}));
        return { allowed: false, error: data.error || 'Access denied' };
      }
    } catch {
      // Fallback to local
    }

    const local = getLocalDocuments();
    const idbDocs = await getAllDocsFromIdb();
    const doc = local.find((d) => d.id === id) || idbDocs.find((d) => d.id === id);
    if (!doc) return { allowed: false, error: 'Document not found' };

    if (!doc.isActive) {
      return { allowed: false, error: 'Access to this document has been revoked by the owner.' };
    }

    if (doc.settings.expiresAt && new Date(doc.settings.expiresAt) < new Date()) {
      return { allowed: false, error: 'This secure link has expired.' };
    }

    if (
      doc.settings.maxViews !== null &&
      doc.settings.maxViews !== undefined &&
      doc.settings.maxViews > 0 &&
      doc.viewsCount >= doc.settings.maxViews
    ) {
      return { allowed: false, error: 'This link has reached its maximum view limit.' };
    }

    if (doc.settings.password && doc.settings.password.trim() !== '') {
      if (!credentials.password || credentials.password !== doc.settings.password) {
        return { allowed: false, error: 'Incorrect passcode. Please verify and try again.' };
      }
    }

    if (doc.settings.requireEmail && (!credentials.viewerEmail || !credentials.viewerEmail.includes('@'))) {
      return { allowed: false, error: 'Valid email address is required.' };
    }

    // Record view locally
    doc.viewsCount += 1;
    if (!doc.accessLogs) doc.accessLogs = [];
    doc.accessLogs.unshift({
      id: 'log_' + Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      viewerName: credentials.viewerName || 'Anonymous Viewer',
      viewerEmail: credentials.viewerEmail || 'Undisclosed',
      ip: '127.0.0.1',
      userAgent: navigator.userAgent,
    });
    saveLocalDocuments(local);

    let watermark = doc.settings.watermarkText || 'CONFIDENTIAL';
    if (doc.settings.includeViewerEmailInWatermark && credentials.viewerEmail) {
      watermark += ` • ${credentials.viewerEmail}`;
    }
    if (doc.settings.includeTimestampInWatermark) {
      watermark += ` • ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }

    return {
      allowed: true,
      files: doc.files,
      pdfBase64: doc.files[0]?.pdfBase64 || doc.pdfBase64,
      watermarkText: watermark,
      watermarkOpacity: doc.settings.watermarkOpacity ?? 0.22,
      antiScreenBlur: doc.settings.antiScreenBlur ?? true,
      title: doc.title,
      pageCount: doc.pageCount,
    };
  },

  // Get analytics for a document
  async getAnalytics(id: string): Promise<{ viewsCount: number; accessLogs: AccessLog[] }> {
    try {
      const res = await fetch(`/api/documents/${id}/analytics`);
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }

    const local = getLocalDocuments();
    const doc = local.find((d) => d.id === id);
    return {
      viewsCount: doc?.viewsCount || 0,
      accessLogs: doc?.accessLogs || [],
    };
  },

  // Seed sample multi-document bundle in 1 link (The Helping Squad)
  async seedDemoDocument(): Promise<DocumentRecord> {
    const user = authService.getCurrentUser();
    if (!user || (user.role !== 'admin' && !user.isOwner)) {
      throw new Error('Access Denied: Only administrators have permission to seed demo documents.');
    }
    const multiFiles = generateSampleMultiDocumentBundle();
    return this.createDocument({
      title: 'The Helping Squad - Official Handbooks (3 Documents in 1 Link)',
      files: multiFiles,
      settings: {
        password: 'demo',
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        maxViews: 50,
        requireEmail: true,
        watermarkText: 'THE HELPING SQUAD • CONFIDENTIAL HANDBOOK',
        includeViewerEmailInWatermark: true,
        includeTimestampInWatermark: true,
        watermarkOpacity: 0.24,
        antiScreenBlur: true,
      },
    });
  },

  // Bundle all uploaded unique PDFs into a single final master link
  async bundleAllDocuments(): Promise<DocumentRecord> {
    const user = authService.getCurrentUser();
    if (!user || (user.role !== 'admin' && !user.isOwner)) {
      throw new Error('Access Denied: Only administrators have permission to bundle documents.');
    }

    try {
      const res = await fetch('/api/documents/bundle-all', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
        },
      });
      if (res.ok) {
        return normalizeLocalDoc(await res.json());
      }
    } catch {
      // Fallback
    }

    const local = getLocalDocuments();
    const uniqueFiles: PdfDocumentItem[] = [];
    const seen = new Set<string>();

    for (const doc of local) {
      if (doc.id === 'all_handbooks') continue;
      for (const f of doc.files || []) {
        const key = (f.title || f.originalFilename).toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          uniqueFiles.push(f);
        }
      }
    }

    const masterDoc: DocumentRecord = {
      id: 'all_handbooks',
      title: `Complete Collection (${uniqueFiles.length} PDFs in 1 Link)`,
      files: uniqueFiles,
      originalFilename: 'All_Uploaded_PDFs.pdf',
      fileSize: uniqueFiles.reduce((s, f) => s + f.fileSize, 0),
      pageCount: uniqueFiles.reduce((s, f) => s + f.pageCount, 0),
      createdAt: new Date().toISOString(),
      isActive: true,
      viewsCount: 0,
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
      accessLogs: [],
    };

    const existingIdx = local.findIndex((d) => d.id === 'all_handbooks');
    if (existingIdx >= 0) {
      local[existingIdx] = masterDoc;
    } else {
      local.unshift(masterDoc);
    }
    saveLocalDocuments(local);
    return masterDoc;
  },

  // Generate public view URL
  getShareUrl(docId: string): string {
    const origin = window.location.origin;
    return `${origin}?v=${docId}`;
  },

  // Get folders configuration (bi-directionally synced so deleted folders NEVER reappear, while active folders are always visible to all users)
  async getFolders(): Promise<{ customFolders: string[]; deletedFolders: string[] }> {
    const local = getLocalFoldersSync();
    const user = authService.getCurrentUser();
    const isAdmin = Boolean(user && (user.role === 'admin' || user.isOwner));

    if (isAdmin) {
      try {
        const res = await fetch('/api/folders/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            customFolders: local.customFolders,
            deletedFolders: local.deletedFolders,
          }),
        });
        if (res.ok) {
          const synced = await res.json();
          const serverDeleted = Array.isArray(synced.deletedFolders) ? synced.deletedFolders : [];
          const serverCustom = Array.from(
            new Set([...local.customFolders, ...(Array.isArray(synced.customFolders) ? synced.customFolders : [])])
          ).filter((cf) => !serverDeleted.some((df: string) => df.toLowerCase() === cf.toLowerCase()));

          localStorage.setItem('helping_squad_custom_folders', JSON.stringify(serverCustom));
          localStorage.setItem('helping_squad_deleted_folders', JSON.stringify(serverDeleted));
          return { customFolders: serverCustom, deletedFolders: serverDeleted };
        }
      } catch {
        // Fallback to local storage
      }
    } else {
      try {
        const res = await fetch('/api/folders', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          const serverCustom = Array.isArray(data.customFolders) ? data.customFolders : [];
          const serverDeleted = Array.isArray(data.deletedFolders) ? data.deletedFolders : [];
          localStorage.setItem('helping_squad_custom_folders', JSON.stringify(serverCustom));
          localStorage.setItem('helping_squad_deleted_folders', JSON.stringify(serverDeleted));
          return {
            customFolders: serverCustom,
            deletedFolders: serverDeleted,
          };
        }
      } catch {}
    }

    return local;
  },

  // Create new folder
  async createFolder(name: string): Promise<void> {
    const user = authService.getCurrentUser();
    if (!user || (user.role !== 'admin' && !user.isOwner)) {
      throw new Error('Access Denied: Only administrators have permission to create folders.');
    }

    const trimmed = name.trim();
    if (!trimmed) return;

    try {
      const custom: string[] = JSON.parse(localStorage.getItem('helping_squad_custom_folders') || '[]');
      const deleted: string[] = JSON.parse(localStorage.getItem('helping_squad_deleted_folders') || '[]');
      const updatedDeleted = deleted.filter((f) => f.toLowerCase() !== trimmed.toLowerCase());
      if (!custom.some((f) => f.toLowerCase() === trimmed.toLowerCase())) {
        custom.push(trimmed);
      }
      localStorage.setItem('helping_squad_custom_folders', JSON.stringify(custom));
      localStorage.setItem('helping_squad_deleted_folders', JSON.stringify(updatedDeleted));
    } catch {}

    try {
      await fetch('/api/folders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ name: trimmed }),
      });
    } catch {}
  },

  // Delete folder permanently
  async deleteFolder(
    folderName: string,
    fallbackFolder = 'General PDFs'
  ): Promise<{ success: boolean; reassignedCount: number }> {
    const user = authService.getCurrentUser();
    if (!user || (user.role !== 'admin' && !user.isOwner)) {
      throw new Error('Access Denied: Only administrators have permission to delete folders.');
    }

    const cleanName = folderName.trim();

    // Immediately persist deletion in localStorage FIRST so it can never revert
    try {
      const custom: string[] = JSON.parse(localStorage.getItem('helping_squad_custom_folders') || '[]');
      const deleted: string[] = JSON.parse(localStorage.getItem('helping_squad_deleted_folders') || '[]');
      if (!deleted.some((f) => f.toLowerCase() === cleanName.toLowerCase())) {
        deleted.push(cleanName);
      }
      const updatedCustom = custom.filter((f) => f.toLowerCase() !== cleanName.toLowerCase());
      localStorage.setItem('helping_squad_custom_folders', JSON.stringify(updatedCustom));
      localStorage.setItem('helping_squad_deleted_folders', JSON.stringify(deleted));

      // Also update local storage & IndexedDB documents immediately
      const docs = getLocalDocuments();
      let affected = 0;
      docs.forEach((d) => {
        const cur = d.folder || 'Official Handbooks';
        if (cur.toLowerCase() === cleanName.toLowerCase()) {
          d.folder = fallbackFolder;
          affected++;
        }
      });
      saveLocalDocuments(docs);
    } catch {}

    let serverRes = null;
    try {
      const res = await fetch(
        `/api/folders/${encodeURIComponent(cleanName)}?fallback=${encodeURIComponent(fallbackFolder)}`,
        {
          method: 'DELETE',
          headers: {
            ...getAuthHeaders(),
          },
        }
      );
      if (res.ok) {
        serverRes = await res.json();
      }
    } catch {}

    return serverRes || { success: true, reassignedCount: 0 };
  },
};

