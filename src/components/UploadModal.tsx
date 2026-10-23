import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Upload,
  ShieldCheck,
  Lock,
  Mail,
  Clock,
  Eye,
  FileText,
  AlertCircle,
  Sparkles,
  Check,
  Plus,
  Trash2,
  Layers,
  FolderArchive,
  Folder,
  FolderPlus,
  CheckCircle2,
} from 'lucide-react';
import { DocumentSettings, PdfDocumentItem } from '../types/document';
import { AuthUser } from '../types/auth';
import { generateSampleMultiDocumentBundle } from '../services/sampleDocs';
import { setupPdfWorker, base64ToUint8Array, pdfjsLib } from '../lib/pdfWorker';
import { documentService } from '../services/documentService';
import { TheHelpingSquadLogo } from './TheHelpingSquadLogo';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploaded: (doc: any) => void;
  currentUser?: AuthUser | null;
  initialFolder?: string;
}

interface QueuedFile {
  id: string;
  title: string;
  originalFilename: string;
  fileSize: number;
  pageCount: number;
  file?: Blob;
  pdfBase64?: string;
  uploadStatus?: 'pending' | 'uploading' | 'done' | 'error';
  uploadPct?: number;
  uploadError?: string;
}

// Extract accurate page count from a PDF File or Blob using ultra-fast header/trailer scan
export async function extractAccuratePageCount(file: Blob): Promise<number> {
  // 1. Ultra-fast header/trailer binary scan (takes < 10ms, reads only 256KB from start and end)
  try {
    const decoder = new TextDecoder('latin1');
    const headLen = Math.min(file.size, 256 * 1024);
    const headSlice = await file.slice(0, headLen).arrayBuffer();
    let combinedText = decoder.decode(new Uint8Array(headSlice));

    if (file.size > 256 * 1024) {
      const tailStart = Math.max(headLen, file.size - 256 * 1024);
      const tailSlice = await file.slice(tailStart, file.size).arrayBuffer();
      combinedText += '\n' + decoder.decode(new Uint8Array(tailSlice));
    }

    const countMatches = combinedText.match(/\/Count\s+(\d+)/g);
    if (countMatches && countMatches.length > 0) {
      let maxCount = 1;
      for (const m of countMatches) {
        const num = parseInt(m.replace(/\/Count\s+/, ''), 10);
        if (num > maxCount && num < 100000) maxCount = num;
      }
      if (maxCount > 1) return maxCount;
    }

    const pageMatches = combinedText.match(/\/Type\s*\/Page\b(?!\s*s)/g);
    if (pageMatches && pageMatches.length > 0) {
      return pageMatches.length;
    }
  } catch (err) {
    console.warn('Fast page count extraction error:', err);
  }

  // 2. Fast PDF.js check only for small files (< 5MB) if scan was inconclusive
  if (file.size <= 5 * 1024 * 1024) {
    try {
      setupPdfWorker();
      const buf = await file.arrayBuffer();
      const docPromise = pdfjsLib.getDocument({
        data: new Uint8Array(buf),
        cMapPacked: true,
      }).promise;
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500));
      const doc: any = await Promise.race([docPromise, timeoutPromise]);
      if (doc && typeof doc.numPages === 'number' && doc.numPages >= 1) {
        return doc.numPages;
      }
    } catch {}
  }

  return 1;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onUploaded,
  currentUser,
  initialFolder,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [bundleTitle, setBundleTitle] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string>(initialFolder || 'Official Handbooks');
  const [customFolder, setCustomFolder] = useState<string>('');
  const [isCreatingNewFolder, setIsCreatingNewFolder] = useState<boolean>(false);
  const [filesQueue, setFilesQueue] = useState<QueuedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [processingFiles, setProcessingFiles] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [folderOptions, setFolderOptions] = useState<string[]>([
    'Official Handbooks',
    'Squad Manuals & Guides',
    'Operational Reports',
    'Confidential Packets',
    'General PDFs',
  ]);

  // Security Settings
  const [hasPassword, setHasPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [requireEmail, setRequireEmail] = useState(false);
  const [enableWatermark, setEnableWatermark] = useState(true);
  const [watermarkText, setWatermarkText] = useState('CONFIDENTIAL • RESTRICTED ACCESS');
  const [includeViewerEmail, setIncludeViewerEmail] = useState(true);
  const [includeTimestamp, setIncludeTimestamp] = useState(true);
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.22);
  const [expirationPreset, setExpirationPreset] = useState<'never' | '1h' | '24h' | '7d' | '30d'>('7d');
  const [maxViewsPreset, setMaxViewsPreset] = useState<'unlimited' | '1' | '5' | '20'>('unlimited');
  const [antiScreenBlur, setAntiScreenBlur] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadPromisesRef = useRef<{ [key: string]: Promise<void> }>({});
  const activeProgressCallbackRef = useRef<{ [key: string]: (pct: number, mbUploaded: number) => void }>({});

  // Sync folder with initialFolder and load persisted folders
  useEffect(() => {
    if (initialFolder && initialFolder !== 'all') {
      setSelectedFolder(initialFolder);
    }
  }, [initialFolder, isOpen]);

  useEffect(() => {
    if (isOpen) {
      documentService.getFolders().then((f) => {
        const defaults = [
          'Official Handbooks',
          'Squad Manuals & Guides',
          'Operational Reports',
          'Confidential Packets',
          'General PDFs',
        ];
        const custom = Array.isArray(f.customFolders) ? f.customFolders : [];
        const deleted = Array.isArray(f.deletedFolders) ? f.deletedFolders : [];
        const combined = Array.from(new Set([...defaults, ...custom])).filter(
          (folder) => !deleted.some((d) => d.toLowerCase() === folder.toLowerCase())
        );

        if (initialFolder && initialFolder !== 'all' && !combined.includes(initialFolder)) {
          combined.push(initialFolder);
        }

        if (combined.length > 0) {
          setFolderOptions(combined);
          if (initialFolder && initialFolder !== 'all') {
            setSelectedFolder(initialFolder);
          } else if (selectedFolder && combined.includes(selectedFolder)) {
            // keep user's existing selection
          } else {
            setSelectedFolder(combined[0]);
          }
        }
      }).catch(() => {});
    }
  }, [isOpen, initialFolder]);

  const isAdmin = Boolean(currentUser && (currentUser.role === 'admin' || currentUser.isOwner));
  if (!isOpen || !isAdmin) return null;

  // Start background streaming for a queued file immediately upon selection so OS file handles never expire
  const startImmediateFileUpload = (itemId: string, file: Blob, filename: string) => {
    const promise = (async () => {
      setFilesQueue((prev) =>
        prev.map((q) => (q.id === itemId ? { ...q, uploadStatus: 'uploading', uploadPct: 0, uploadError: undefined } : q))
      );
      try {
        await documentService.uploadFileInChunks(itemId, file, (pct, mbUploaded) => {
          setFilesQueue((prev) =>
            prev.map((q) => (q.id === itemId ? { ...q, uploadStatus: 'uploading', uploadPct: pct } : q))
          );
          const liveCb = activeProgressCallbackRef.current[itemId];
          if (liveCb) {
            liveCb(pct, mbUploaded);
          }
        });
        setFilesQueue((prev) =>
          prev.map((q) => (q.id === itemId ? { ...q, uploadStatus: 'done', uploadPct: 100, uploadError: undefined } : q))
        );
      } catch (err: any) {
        setFilesQueue((prev) =>
          prev.map((q) =>
            q.id === itemId
              ? { ...q, uploadStatus: 'error', uploadError: err?.message || `Failed uploading ${filename}` }
              : q
          )
        );
        throw err;
      }
    })();

    // Prevent unhandled rejection warning if it rejects before handleSubmit awaits it
    promise.catch(() => {});
    uploadPromisesRef.current[itemId] = promise;
    return promise;
  };

  // Process multiple selected or dropped files with up to 400 MB per PDF capacity
  const processFiles = async (filesList: FileList | File[]) => {
    const rawFiles = Array.from(filesList);
    const pdfFiles = rawFiles.filter((f) => {
      const name = (f.name || '').toLowerCase();
      const type = (f.type || '').toLowerCase();
      return (
        name.endsWith('.pdf') ||
        type.includes('pdf') ||
        type === 'application/x-pdf' ||
        type === 'application/octet-stream' ||
        type === ''
      );
    });

    if (pdfFiles.length === 0) {
      setError('Please select valid PDF documents (.pdf).');
      return;
    }

    // 400 MB per PDF size limit check
    const MAX_FILE_SIZE = 400 * 1024 * 1024; // 400 MB
    for (const f of pdfFiles) {
      if (f.size > MAX_FILE_SIZE) {
        setError(
          `File "${f.name}" is ${(f.size / (1024 * 1024)).toFixed(1)} MB, which exceeds the 400 MB per-PDF limit.`
        );
        return;
      }
    }

    setError(null);
    setProcessingFiles(true);

    try {
      const newItems: QueuedFile[] = [];

      for (let i = 0; i < pdfFiles.length; i++) {
        const f = pdfFiles[i];
        const itemId = 'item_' + Math.random().toString(36).substring(2, 9);
        const mbSize = (f.size / (1024 * 1024)).toFixed(1);
        setUploadProgressText(`Analyzing ${f.name} (${mbSize} MB) [${i + 1}/${pdfFiles.length}]...`);

        // Fast page count extraction in < 10ms without holding full file in memory
        const pages = await extractAccuratePageCount(f);

        // Optional tiny inline Base64 fallback only for small files under 500 KB
        let smallBase64 = '';
        if (f.size <= 500 * 1024) {
          try {
            smallBase64 = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                const res = (reader.result as string) || '';
                resolve(res.includes(',') ? res.split(',')[1] : res);
              };
              reader.onerror = () => resolve('');
              reader.readAsDataURL(f);
            });
          } catch {}
        }

        const cleanTitle = f.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        newItems.push({
          id: itemId,
          title: cleanTitle,
          originalFilename: f.name,
          fileSize: f.size,
          pageCount: Math.max(1, pages),
          file: f,
          pdfBase64: smallBase64 || undefined,
          uploadStatus: 'uploading',
          uploadPct: 0,
        });
      }

      setFilesQueue((prev) => {
        const updated = [...prev, ...newItems];
        if (!bundleTitle && updated.length > 1) {
          setBundleTitle(`Confidential Document Pack (${updated.length} Documents)`);
        } else if (!bundleTitle && updated.length === 1) {
          setBundleTitle(updated[0].title);
        }
        return updated;
      });

      // Immediately start streaming each selected file to server & IndexedDB so mobile handles never expire
      for (const item of newItems) {
        if (item.file) {
          startImmediateFileUpload(item.id, item.file, item.originalFilename);
        }
      }
    } catch (err: any) {
      setError('Failed reading PDF file: ' + (err.message || 'Please try selecting the file again.'));
    } finally {
      setProcessingFiles(false);
      setUploadProgressText('');
      // Keep fileInputRef.current.value intact while files are queued so mobile browser descriptors remain valid
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleLoadSampleBundle = () => {
    setError(null);
    const sampleItems = generateSampleMultiDocumentBundle();
    const queued: QueuedFile[] = sampleItems.map((s, idx) => ({
      id: `sample_${idx + 1}`,
      title: s.title,
      originalFilename: s.originalFilename,
      fileSize: s.fileSize,
      pageCount: s.pageCount,
      pdfBase64: s.pdfBase64,
      uploadStatus: 'done',
      uploadPct: 100,
    }));
    setFilesQueue(queued);
    setBundleTitle('Series B Investor Data Room (3 Documents in 1 Link)');
  };

  const handleRemoveFile = (id: string) => {
    delete uploadPromisesRef.current[id];
    setFilesQueue((prev) => {
      const remaining = prev.filter((f) => f.id !== id);
      if (remaining.length === 0 && fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return remaining;
    });
  };

  const handleUpdateItemTitle = (id: string, newTitle: string) => {
    setFilesQueue((prev) =>
      prev.map((f) => (f.id === id ? { ...f, title: newTitle } : f))
    );
  };

  const calculateExpiresAt = (): string | null => {
    const now = Date.now();
    switch (expirationPreset) {
      case '1h':
        return new Date(now + 60 * 60 * 1000).toISOString();
      case '24h':
        return new Date(now + 24 * 60 * 60 * 1000).toISOString();
      case '7d':
        return new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();
      case '30d':
        return new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();
      default:
        return null;
    }
  };

  const calculateMaxViews = (): number | null => {
    switch (maxViewsPreset) {
      case '1':
        return 1;
      case '5':
        return 5;
      case '20':
        return 20;
      default:
        return null;
    }
  };

  const totalPages = filesQueue.reduce((sum, f) => sum + f.pageCount, 0);
  const totalSize = filesQueue.reduce((sum, f) => sum + f.fileSize, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (filesQueue.length === 0) {
      setError('Please add at least one PDF document.');
      return;
    }

    if (hasPassword && !password.trim()) {
      setError('Please specify a passcode or disable passcode protection.');
      return;
    }

    let finalFolder = '';
    if (isCreatingNewFolder) {
      finalFolder = customFolder.trim();
      if (!finalFolder) {
        setError('Please enter a folder name for the new folder, or choose an existing folder.');
        return;
      }
    } else {
      finalFolder = (selectedFolder || '').trim();
      if (!finalFolder) {
        setError('Please select a destination folder for this PDF.');
        return;
      }
    }

    setUploading(true);
    setError(null);
    const mbTotal = ((totalSize || 0) / (1024 * 1024)).toFixed(1);
    setUploadProgressText(`Finalizing ${filesQueue.length} document(s) (${mbTotal} MB) in vault... Please keep this page open.`);

    const settings: DocumentSettings = {
      password: hasPassword ? password.trim() : undefined,
      expiresAt: calculateExpiresAt(),
      maxViews: calculateMaxViews(),
      requireEmail,
      watermarkText: enableWatermark ? watermarkText.trim() : undefined,
      includeViewerEmailInWatermark: enableWatermark && includeViewerEmail,
      includeTimestampInWatermark: enableWatermark && includeTimestamp,
      watermarkOpacity: enableWatermark ? watermarkOpacity : 0,
      antiScreenBlur,
    };

    const finalTitle =
      bundleTitle.trim() ||
      (filesQueue.length > 1
        ? `Document Pack (${filesQueue.length} Files)`
        : filesQueue[0].title);

    try {
      if (isCreatingNewFolder) {
        try {
          await documentService.createFolder(finalFolder);
        } catch {}
      }

      // Step 1: Ensure each queued file has finished streaming to server disk
      const uploadedToServerIds = new Set<string>();
      for (let i = 0; i < filesQueue.length; i++) {
        const item = filesQueue[i];
        if (item.file) {
          const mbSize = (item.file.size / (1024 * 1024)).toFixed(1);
          try {
            const existingPromise = uploadPromisesRef.current[item.id];
            if (existingPromise && item.uploadStatus !== 'error') {
              setUploadProgressText(
                `Uploading "${item.originalFilename}" (${mbSize} MB) [${i + 1}/${filesQueue.length}]... ${item.uploadPct ?? 0}%`
              );
              activeProgressCallbackRef.current[item.id] = (pct, mbUploaded) => {
                setUploadProgressText(
                  `Uploading "${item.originalFilename}" (${mbSize} MB) [${i + 1}/${filesQueue.length}]... ${pct}% (${mbUploaded} MB)`
                );
              };
              try {
                await existingPromise;
              } finally {
                delete activeProgressCallbackRef.current[item.id];
              }
            } else {
              setUploadProgressText(
                `Uploading "${item.originalFilename}" (${mbSize} MB) [${i + 1}/${filesQueue.length}]... 0%`
              );
              await documentService.uploadFileInChunks(item.id, item.file, (pct, mbUploaded) => {
                setUploadProgressText(
                  `Uploading "${item.originalFilename}" (${mbSize} MB) [${i + 1}/${filesQueue.length}]... ${pct}% (${mbUploaded} MB)`
                );
              });
            }
            uploadedToServerIds.add(item.id);
          } catch (chunkErr: any) {
            if (!item.pdfBase64) {
              throw chunkErr;
            }
            console.warn('Chunk upload fallback used for file:', item.originalFilename);
          }
        } else if (item.pdfBase64) {
          uploadedToServerIds.add(item.id);
        }
      }

      setUploadProgressText('Securing and publishing document in vault for all users...');

      // Step 2: Strip native File handle & transient UI status fields
      const serializableFiles = filesQueue.map(({ file: _, uploadStatus: _s, uploadPct: _p, uploadError: _e, ...meta }) => ({
        ...meta,
        pdfBase64: uploadedToServerIds.has(meta.id)
          ? (meta.pdfBase64 && meta.pdfBase64.length < 100000 ? meta.pdfBase64 : '')
          : (meta.pdfBase64 || ''),
      }));

      await onUploaded({
        title: finalTitle,
        folder: finalFolder,
        isExplicitNewFolder: Boolean(isCreatingNewFolder && customFolder.trim()),
        files: serializableFiles,
        originalFilename: filesQueue[0]?.originalFilename || 'document.pdf',
        fileSize: totalSize,
        pageCount: totalPages,
        pdfBase64: '',
        settings,
        uploaderId: currentUser?.id,
        uploaderName: currentUser?.name || 'Admin',
        uploaderIdentifier: currentUser?.identifier || '',
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      uploadPromisesRef.current = {};
      setFilesQueue([]);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Upload failed.');
    } finally {
      setUploading(false);
      setUploadProgressText('');
    }
  };

  const handleModalClose = () => {
    if (uploading) return;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    uploadPromisesRef.current = {};
    setFilesQueue([]);
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl my-3 sm:my-6 text-slate-100 max-h-[94vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-0.5 rounded-full bg-amber-400/10 border border-amber-400/30 shrink-0">
              <TheHelpingSquadLogo size={42} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black text-xs uppercase tracking-wider bg-gradient-to-r from-amber-400 to-orange-400 text-slate-950 px-2 py-0.5 rounded shadow-sm">
                  The Helping Squad
                </span>
                <span className="text-[10px] font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full">
                  Max 400 MB / PDF
                </span>
                <h2 className="text-base sm:text-lg font-bold text-white">Add PDF to Vault</h2>
                {currentUser && (
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    Uploader: {currentUser.name}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Upload PDF documents (up to 400 MB each) directly into your selected folder; all authorized readers can view them instantly
              </p>
            </div>
          </div>
          <button
            onClick={handleModalClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          {/* PDF Files Folder (Strict Folder Isolation) */}
          <div className="p-3.5 bg-slate-950/80 border-2 border-amber-500/40 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <Folder className="w-4 h-4 text-amber-400" />
                <span>PDF Destination Folder (Strict Isolation)</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setIsCreatingNewFolder(!isCreatingNewFolder);
                }}
                className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 transition cursor-pointer"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>{isCreatingNewFolder ? 'Choose Existing Folder' : '+ Create New Folder'}</span>
              </button>
            </div>

            <p className="text-[11px] text-slate-300 leading-snug">
              Strict isolation guaranteed: your PDF will be uploaded <span className="text-amber-300 font-bold underline">only</span> to this folder and will never be placed or leaked into any other folder.
            </p>

            {isCreatingNewFolder ? (
              <div className="space-y-1.5">
                <input
                  type="text"
                  value={customFolder}
                  onChange={(e) => setCustomFolder(e.target.value)}
                  placeholder="Enter new folder name (e.g. Community Projects, Legal 2026)"
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-amber-500/60 rounded-lg text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                  autoFocus
                />
                <div className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>
                    New dedicated folder "{customFolder.trim() || 'Your New Folder'}" will be created and will exclusively contain this PDF.
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <select
                  value={selectedFolder}
                  onChange={(e) => setSelectedFolder(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-medium focus:outline-none focus:border-amber-400 cursor-pointer"
                >
                  {folderOptions.map((folder) => (
                    <option key={folder} value={folder}>
                      📁 {folder} (Upload only here)
                    </option>
                  ))}
                </select>
                <div className="text-[11px] text-amber-300/90 flex items-center gap-1 font-medium bg-amber-500/10 px-2.5 py-1 rounded-md border border-amber-500/20">
                  <Folder className="w-3 h-3 text-amber-400 shrink-0" />
                  <span className="truncate">
                    Destination: <strong>{selectedFolder}</strong> only (will not appear in other folders).
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Bundle Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Link / Bundle Name
            </label>
            <input
              type="text"
              value={bundleTitle}
              onChange={(e) => setBundleTitle(e.target.value)}
              placeholder="e.g. Q4 Executive Pack (Pitch Deck + Financials + NDA)"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700/80 rounded-lg text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Multiple File Upload & Queue Area */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-indigo-400" />
                Attached PDF Documents ({filesQueue.length})
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleLoadSampleBundle}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/20 transition cursor-pointer flex items-center gap-1 font-medium"
                >
                  <Sparkles className="w-3 h-3" /> Load 3 Sample PDFs
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[11px] text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded-lg border border-slate-700 transition cursor-pointer flex items-center gap-1 font-medium"
                >
                  <Plus className="w-3 h-3 text-indigo-400" /> Add PDFs
                </button>
              </div>
            </div>

            {/* Hidden multi-file input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,application/pdf,application/x-pdf,application/octet-stream"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  const selectedFiles = Array.from(e.target.files);
                  processFiles(selectedFiles);
                }
              }}
            />

            {/* Drag & drop dropzone */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition ${
                dragActive
                  ? 'border-indigo-500 bg-indigo-500/15'
                  : 'border-slate-700 bg-slate-950/50 hover:border-slate-600 hover:bg-slate-950/80'
              }`}
            >
              <div className="flex items-center justify-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-600/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
                  <Upload className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-semibold text-white">
                    Drop PDF files here (up to <span className="text-amber-400 font-bold">400 MB</span> per PDF), or <span className="text-indigo-400 underline">browse</span>
                  </p>
                  <p className="text-[11px] text-slate-400">
                    High-capacity vault accepts PDF files up to 400 MB with instant protected view-only streaming.
                  </p>
                </div>
              </div>
            </div>

            {/* Processing indicator */}
            {(processingFiles || uploading) && (
              <div className="mt-2 text-xs text-amber-300 flex items-center gap-2 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <div className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin shrink-0" />
                <span>{uploadProgressText || (processingFiles ? 'Processing PDF pages...' : 'Saving documents to vault...')}</span>
              </div>
            )}

            {/* Files Queue List */}
            {filesQueue.length > 0 && (
              <div className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-1">
                {filesQueue.map((item, idx) => (
                  <div
                    key={item.id}
                    className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0 font-bold text-[11px]">
                        {idx + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <input
                          type="text"
                          value={item.title}
                          onChange={(e) => handleUpdateItemTitle(item.id, e.target.value)}
                          className="w-full bg-transparent font-medium text-white hover:bg-slate-900 px-1 py-0.5 rounded border border-transparent hover:border-slate-700 focus:outline-none focus:border-indigo-500 truncate"
                          placeholder="Document title"
                        />
                        <div className="text-[11px] text-slate-400 px-1 flex items-center gap-2 flex-wrap">
                          <span className="truncate max-w-[140px]">{item.originalFilename}</span>
                          <span>•</span>
                          <span>{item.pageCount} Pages</span>
                          <span>•</span>
                          <span>
                            {item.fileSize >= 1024 * 1024
                              ? `${(item.fileSize / (1024 * 1024)).toFixed(1)} MB`
                              : `${(item.fileSize / 1024).toFixed(0)} KB`}
                          </span>
                          {item.uploadStatus === 'uploading' && (
                            <span className="text-amber-300 font-semibold flex items-center gap-1">
                              • Uploading {item.uploadPct ?? 0}%
                            </span>
                          )}
                          {item.uploadStatus === 'done' && (
                            <span className="text-emerald-400 font-semibold flex items-center gap-1">
                              • Ready on Server ✓
                            </span>
                          )}
                          {item.uploadStatus === 'error' && (
                            <span className="text-rose-400 font-semibold flex items-center gap-1">
                              • Will retry on publish
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveFile(item.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition cursor-pointer shrink-0"
                      title="Remove from link"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                {/* Queue Summary */}
                <div className="p-2.5 bg-indigo-950/30 border border-indigo-500/20 rounded-xl text-xs text-indigo-200 flex items-center justify-between">
                  <span className="font-semibold">
                    Total: {filesQueue.length} Documents in this 1 link
                  </span>
                  <span className="text-slate-400 font-mono text-[11px]">
                    {totalPages} total pages • {(totalSize / 1024).toFixed(0)} KB
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Security & Access Protection Section */}
          <div className="space-y-3.5 pt-3 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Zero-Download Protection for All Files
              </h3>
              <span className="text-[11px] text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                100% Download Blocked
              </span>
            </div>

            {/* Passcode Protection */}
            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-indigo-400" />
                  <div>
                    <div className="text-xs font-semibold text-white">Passcode Protection</div>
                    <div className="text-[11px] text-slate-400">
                      Recipients must enter this passcode to unlock the document pack
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={hasPassword}
                  onChange={(e) => setHasPassword(e.target.checked)}
                  className="w-4 h-4 accent-indigo-500 cursor-pointer"
                />
              </div>
              {hasPassword && (
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter passcode (e.g. secret2026)"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 mt-2"
                />
              )}
            </div>

            {/* Email Gate */}
            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-indigo-400" />
                <div>
                  <div className="text-xs font-semibold text-white">Require Recipient Work Email</div>
                  <div className="text-[11px] text-slate-400">
                    Captures viewer email and burns it into the dynamic watermark
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={requireEmail}
                onChange={(e) => setRequireEmail(e.target.checked)}
                className="w-4 h-4 accent-indigo-500 cursor-pointer"
              />
            </div>

            {/* Dynamic Watermarking */}
            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-indigo-400" />
                  <div>
                    <div className="text-xs font-semibold text-white">Dynamic Watermark Overlay</div>
                    <div className="text-[11px] text-slate-400">
                      Diagonal repeating anti-leak watermark across all pages in all files
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={enableWatermark}
                  onChange={(e) => setEnableWatermark(e.target.checked)}
                  className="w-4 h-4 accent-indigo-500 cursor-pointer"
                />
              </div>

              {enableWatermark && (
                <div className="space-y-2 pt-2 border-t border-slate-800 text-xs">
                  <input
                    type="text"
                    value={watermarkText}
                    onChange={(e) => setWatermarkText(e.target.value)}
                    placeholder="Custom watermark text"
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                  <div className="flex items-center gap-4 text-slate-300 text-[11px]">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeViewerEmail}
                        onChange={(e) => setIncludeViewerEmail(e.target.checked)}
                        className="accent-indigo-500"
                      />
                      <span>Include viewer email in watermark</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeTimestamp}
                        onChange={(e) => setIncludeTimestamp(e.target.checked)}
                        className="accent-indigo-500"
                      />
                      <span>Include timestamp</span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Expiration & Max Views */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
                <label className="block text-xs font-semibold text-white mb-1.5 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-400" />
                  Link Expiration
                </label>
                <select
                  value={expirationPreset}
                  onChange={(e: any) => setExpirationPreset(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="never">Never expires</option>
                  <option value="1h">Expires in 1 Hour</option>
                  <option value="24h">Expires in 24 Hours</option>
                  <option value="7d">Expires in 7 Days (Recommended)</option>
                  <option value="30d">Expires in 30 Days</option>
                </select>
              </div>

              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
                <label className="block text-xs font-semibold text-white mb-1.5 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-indigo-400" />
                  View Limit
                </label>
                <select
                  value={maxViewsPreset}
                  onChange={(e: any) => setMaxViewsPreset(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="unlimited">Unlimited views</option>
                  <option value="1">1 View only (Burn after reading)</option>
                  <option value="5">Max 5 Views</option>
                  <option value="20">Max 20 Views</option>
                </select>
              </div>
            </div>

            {/* Anti-Screen Blur Shield */}
            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-white">Anti-Screen Grab Shield</div>
                <div className="text-[11px] text-slate-400">
                  Blurs document when viewer switches window or uses snipping tools
                </div>
              </div>
              <input
                type="checkbox"
                checked={antiScreenBlur}
                onChange={(e) => setAntiScreenBlur(e.target.checked)}
                className="w-4 h-4 accent-indigo-500 cursor-pointer"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 text-xs font-medium transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || filesQueue.length === 0}
              className="px-5 py-2.5 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 text-xs font-black shadow-lg shadow-amber-400/25 transition cursor-pointer flex items-center gap-2"
            >
              {uploading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Uploading to Vault ({((totalSize || 0) / (1024 * 1024)).toFixed(1)} MB)...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 text-slate-950" />
                  <span>
                    Upload to "{isCreatingNewFolder ? (customFolder.trim() || 'New Folder') : selectedFolder}" Only ({filesQueue.length} {filesQueue.length === 1 ? 'PDF' : 'PDFs'}
                    {totalSize > 0 ? ` • ${((totalSize || 0) / (1024 * 1024)).toFixed(1)} MB` : ''})
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
