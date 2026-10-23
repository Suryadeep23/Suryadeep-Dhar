import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  ShieldAlert,
  Lock,
  Eye,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  AlertTriangle,
  ArrowLeft,
  FileText,
  CheckCircle2,
  Layers,
  FolderArchive,
  Search,
  ExternalLink,
  ShieldCheck,
  ChevronDown,
  Upload,
  Trash2,
} from 'lucide-react';
import { setupPdfWorker, base64ToUint8Array, pdfjsLib } from '../lib/pdfWorker';
import { documentService } from '../services/documentService';
import { ViewMetaResponse, PdfDocumentItem } from '../types/document';
import { TheHelpingSquadLogo } from './TheHelpingSquadLogo';
import { extractAccuratePageCount } from './UploadModal';

interface SecurePdfViewerProps {
  documentId: string;
  onExit?: () => void;
  isOwnerPreview?: boolean;
}

export const SecurePdfViewer: React.FC<SecurePdfViewerProps> = ({
  documentId,
  onExit,
  isOwnerPreview = false,
}) => {
  // Gating & Auth state
  const [meta, setMeta] = useState<ViewMetaResponse | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [accessGranted, setAccessGranted] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Form inputs for gated access
  const [passwordInput, setPasswordInput] = useState('');
  const [viewerNameInput, setViewerNameInput] = useState('');
  const [viewerEmailInput, setViewerEmailInput] = useState('');
  const [submittingAuth, setSubmittingAuth] = useState(false);

  // View mode: 'catalog' shows all individual files separately; 'reader' renders the selected file
  const [viewingMode, setViewingMode] = useState<'catalog' | 'reader'>('catalog');
  const [fileSearchQuery, setFileSearchQuery] = useState('');

  // Multi-Document files
  const [files, setFiles] = useState<PdfDocumentItem[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState<number>(0);

  // PDF Viewer State
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [loadingPdf, setLoadingPdf] = useState<boolean>(false);
  const [pdfLoadError, setPdfLoadError] = useState<string | null>(null);
  const [repairUploading, setRepairUploading] = useState<boolean>(false);
  const [repairProgressText, setRepairProgressText] = useState<string>('');
  const [totalPages, setTotalPages] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.15);
  const [rotation, setRotation] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'single' | 'scroll'>('scroll');
  const [showThumbnails, setShowThumbnails] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showFilePickerDropdown, setShowFilePickerDropdown] = useState<boolean>(false);

  // Security & Watermark State
  const [watermarkText, setWatermarkText] = useState<string>('CONFIDENTIAL • SECURE VIEW ONLY');
  const [watermarkOpacity, setWatermarkOpacity] = useState<number>(0.22);
  const [antiScreenBlur, setAntiScreenBlur] = useState<boolean>(true);
  const [isWindowBlurred, setIsWindowBlurred] = useState<boolean>(false);
  const [securityNotice, setSecurityNotice] = useState<string | null>(null);

  // Refs
  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const pagesContainerRef = useRef<HTMLDivElement>(null);
  const pageCanvasRefs = useRef<{ [key: number]: HTMLCanvasElement | null }>({});
  const repairFileInputRef = useRef<HTMLInputElement>(null);

  const showSecurityWarning = useCallback((msg: string) => {
    setSecurityNotice(msg);
    setTimeout(() => {
      setSecurityNotice(null);
    }, 3800);
  }, []);

  // 1. Initial Meta Load
  useEffect(() => {
    let isMounted = true;
    setupPdfWorker();

    async function loadMeta() {
      setLoadingMeta(true);
      try {
        const docMeta = await documentService.getViewMeta(documentId);
        if (isMounted) {
          setMeta(docMeta);
          // If no password and no email required, auto-request access
          if (!docMeta.requiresPassword && !docMeta.requiresEmail && docMeta.isActive && !docMeta.isExpired && !docMeta.isMaxViewsReached) {
            handleUnlock({});
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setAuthError(err.message || 'Unable to load document.');
        }
      } finally {
        if (isMounted) setLoadingMeta(false);
      }
    }

    loadMeta();
    return () => {
      isMounted = false;
    };
  }, [documentId]);

  // 2. Request Access function
  const handleUnlock = async (overrideCreds?: {
    password?: string;
    viewerName?: string;
    viewerEmail?: string;
  }) => {
    setSubmittingAuth(true);
    setAuthError(null);

    const creds = overrideCreds || {
      password: passwordInput,
      viewerName: viewerNameInput,
      viewerEmail: viewerEmailInput,
    };

    try {
      const res = await documentService.requestViewAccess(documentId, creds);
      if (res.allowed) {
        setAccessGranted(true);
        if (res.watermarkText) setWatermarkText(res.watermarkText);
        if (res.watermarkOpacity !== undefined) setWatermarkOpacity(res.watermarkOpacity);
        if (res.antiScreenBlur !== undefined) setAntiScreenBlur(res.antiScreenBlur);

        const loadedFiles: PdfDocumentItem[] = res.files && res.files.length > 0
          ? res.files
          : res.pdfBase64
          ? [
              {
                id: 'f_1',
                title: res.title || 'Document 1',
                originalFilename: 'document.pdf',
                fileSize: 0,
                pageCount: res.pageCount || 1,
                pdfBase64: res.pdfBase64,
              },
            ]
          : [];

        setFiles(loadedFiles);

        // If there are multiple files, present the catalog of individual files
        // If only 1 file, can open reader directly
        if (loadedFiles.length > 1) {
          setViewingMode('catalog');
          setActiveFileIndex(0);
        } else if (loadedFiles.length === 1) {
          setViewingMode('reader');
          setActiveFileIndex(0);
          initPdf(loadedFiles[0]);
        }
      } else {
        setAuthError(res.error || 'Access verification failed.');
      }
    } catch (err: any) {
      setAuthError(err.message || 'Access request failed.');
    } finally {
      setSubmittingAuth(false);
    }
  };

  // Open an individual file from catalog
  const handleOpenIndividualFile = (index: number) => {
    if (!files[index]) return;
    setActiveFileIndex(index);
    setCurrentPage(1);
    pageCanvasRefs.current = {};
    setViewingMode('reader');
    initPdf(files[index]);
  };

  // Switch document inside reader
  const handleSwitchDocument = (index: number) => {
    if (index === activeFileIndex || !files[index]) return;
    setActiveFileIndex(index);
    setCurrentPage(1);
    pageCanvasRefs.current = {};
    setShowFilePickerDropdown(false);
    initPdf(files[index]);
  };

  // 3. Initialize PDF via PDF.js (loads from local IndexedDB or fetches full binary from server)
  const initPdf = async (fileItemOrBase64?: PdfDocumentItem | string) => {
    setLoadingPdf(true);
    setPdfLoadError(null);
    setPdfDoc(null);

    try {
      let targetItem: PdfDocumentItem | null = null;

      if (typeof fileItemOrBase64 === 'object' && fileItemOrBase64) {
        targetItem = fileItemOrBase64;
      } else if (!fileItemOrBase64 && files[activeFileIndex]) {
        targetItem = files[activeFileIndex];
      }

      if (targetItem) {
        const streamUrl = targetItem.rawUrl || `/api/view/${documentId}/files/${targetItem.id}/raw`;

        // Step A: First check if we have local IndexedDB or inline Base64 binary
        const localBytes = await documentService.getFileBinaryBytes(targetItem.id, targetItem.pdfBase64);
        if (localBytes && localBytes.byteLength > 0) {
          try {
            const doc = await pdfjsLib.getDocument({
              data: localBytes.slice(0),
              cMapPacked: true,
            }).promise;
            setPdfDoc(doc);
            setTotalPages(doc.numPages);

            // If server was missing this binary, upload it in background so all other users can see it!
            if (targetItem.hasBinaryOnServer === false) {
              const fileObj = new File([localBytes as any], targetItem.originalFilename || 'document.pdf', {
                type: 'application/pdf',
              });
              documentService
                .repairDocumentWithFile(
                  {
                    id: documentId,
                    title: meta?.title || targetItem.title,
                    folder: meta?.folder,
                    files: [targetItem],
                    originalFilename: targetItem.originalFilename,
                    fileSize: localBytes.byteLength,
                    pageCount: doc.numPages,
                    createdAt: meta?.createdAt || new Date().toISOString(),
                    isActive: true,
                    viewsCount: 0,
                    settings: {
                      watermarkText,
                      watermarkOpacity,
                      antiScreenBlur,
                    },
                  },
                  fileObj,
                  doc.numPages
                )
                .catch(() => {});
            }
            setLoadingPdf(false);
            return;
          } catch (localErr) {
            console.warn('Local PDF bytes failed to parse, trying server stream:', localErr);
          }
        }

        // Step B: For very large PDFs (> 80 MB), try URL range streaming first so mobile devices don't run out of RAM,
        // and fallback to full ArrayBuffer fetch if needed.
        const isVeryLarge = (targetItem.fileSize || 0) > 80 * 1024 * 1024;
        if (isVeryLarge) {
          try {
            const doc = await pdfjsLib.getDocument({
              url: streamUrl,
              rangeChunkSize: 1024 * 1024,
              disableAutoFetch: false,
              disableStream: false,
              cMapPacked: true,
            }).promise;
            setPdfDoc(doc);
            setTotalPages(doc.numPages);
            setLoadingPdf(false);
            return;
          } catch (rangeErr) {
            console.warn('Range streaming fallback to full buffer:', rangeErr);
          }
        }

        const response = await fetch(streamUrl, { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(
            response.status === 404
              ? 'The PDF file data for this document was not found on the server (0 bytes uploaded).'
              : `Unable to load PDF binary from server (HTTP ${response.status}).`
          );
        }

        const arrayBuffer = await response.arrayBuffer();
        const uint8 = new Uint8Array(arrayBuffer);
        if (uint8.byteLength < 64) {
          throw new Error('The PDF file on the server is empty or incomplete.');
        }

        // Cache binary in local IndexedDB for instant viewing (for files up to 50 MB)
        if (uint8.byteLength <= 50 * 1024 * 1024) {
          documentService.cacheFileBinaryBytes(targetItem.id, uint8).catch(() => {});
        }

        const doc = await pdfjsLib.getDocument({
          data: uint8,
          cMapPacked: true,
        }).promise;

        setPdfDoc(doc);
        setTotalPages(doc.numPages);

        // If the true page count differs from stored pageCount (e.g. stored as 1 page), update server metadata
        if (doc.numPages > 1 && targetItem.pageCount === 1) {
          const updatedFiles = files.map((f) =>
            f.id === targetItem!.id ? { ...f, pageCount: doc.numPages } : f
          );
          setFiles(updatedFiles);
          documentService.updateDocument(documentId, { files: updatedFiles }).catch(() => {});
        }
        setLoadingPdf(false);
        return;
      } else if (typeof fileItemOrBase64 === 'string' && fileItemOrBase64) {
        let bytes: Uint8Array;
        if (
          fileItemOrBase64.startsWith('http://') ||
          fileItemOrBase64.startsWith('https://') ||
          fileItemOrBase64.startsWith('/')
        ) {
          const response = await fetch(fileItemOrBase64, { cache: 'no-store' });
          if (!response.ok) {
            throw new Error('PDF file binary not found on server.');
          }
          bytes = new Uint8Array(await response.arrayBuffer());
        } else {
          bytes = base64ToUint8Array(fileItemOrBase64);
        }
        const doc = await pdfjsLib.getDocument({
          data: bytes,
          cMapPacked: true,
        }).promise;
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        setLoadingPdf(false);
        return;
      }
    } catch (err: any) {
      console.warn('PDF.js loading failed:', err);
      setPdfLoadError(
        err?.message ||
          'The PDF file data for this document was not found on the server. Please re-upload the PDF file.'
      );
      setTotalPages(files[activeFileIndex]?.pageCount || 1);
    } finally {
      setLoadingPdf(false);
    }
  };

  // Handle 1-tap repair when a user selects the PDF file for a broken/incomplete upload
  const handleRepairFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setRepairUploading(true);
    setRepairProgressText(`Analyzing "${selectedFile.name}"...`);
    try {
      const accuratePages = await extractAccuratePageCount(selectedFile);
      const currentItem = files[activeFileIndex] || {
        id: 'f_' + Math.random().toString(36).substring(2, 9),
        title: meta?.title || selectedFile.name.replace(/\.[^/.]+$/, ''),
        originalFilename: selectedFile.name,
        fileSize: selectedFile.size,
        pageCount: accuratePages,
      };

      const repairedDoc = await documentService.repairDocumentWithFile(
        {
          id: documentId,
          title: meta?.title || currentItem.title,
          folder: meta?.folder,
          files: [currentItem],
          originalFilename: selectedFile.name,
          fileSize: selectedFile.size,
          pageCount: accuratePages,
          createdAt: meta?.createdAt || new Date().toISOString(),
          isActive: true,
          viewsCount: 0,
          settings: {
            watermarkText,
            watermarkOpacity,
            antiScreenBlur,
          },
        },
        selectedFile,
        accuratePages,
        (pct, mb) => {
          setRepairProgressText(`Uploading PDF to server... ${pct}% (${mb} MB)`);
        }
      );

      setFiles(repairedDoc.files);
      setPdfLoadError(null);
      await initPdf(repairedDoc.files[0]);
    } catch (err: any) {
      setPdfLoadError('Repair upload failed: ' + (err?.message || 'Unknown error'));
    } finally {
      setRepairUploading(false);
      setRepairProgressText('');
      if (repairFileInputRef.current) repairFileInputRef.current.value = '';
    }
  };

  // 4. Render Canvas Pages (Responsive auto-fit on mobile screens)
  const renderSinglePage = useCallback(
    async (pageNum: number, canvas: HTMLCanvasElement) => {
      if (!pdfDoc) return;
      try {
        const page = await pdfDoc.getPage(pageNum);
        const dpr = window.devicePixelRatio || 1;
        const unscaledViewport = page.getViewport({ scale: 1, rotation });
        const isMobileScreen = typeof window !== 'undefined' && window.innerWidth < 640;
        const availableWidth = Math.max(
          280,
          (pagesContainerRef.current?.clientWidth || window.innerWidth) - (isMobileScreen ? 24 : 64)
        );
        const effectiveScale = isMobileScreen
          ? (availableWidth / unscaledViewport.width) * (scale / 1.15)
          : scale;

        const viewport = page.getViewport({ scale: effectiveScale * dpr, rotation });

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width / dpr}px`;
        canvas.style.height = `${viewport.height / dpr}px`;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const renderContext = {
          canvasContext: ctx,
          viewport: viewport,
        };

        await page.render(renderContext).promise;
      } catch (err) {
        console.warn(`Error rendering page ${pageNum}:`, err);
      }
    },
    [pdfDoc, scale, rotation]
  );

  useEffect(() => {
    if (!pdfDoc || viewingMode !== 'reader') return;
    if (viewMode === 'scroll') {
      for (let i = 1; i <= totalPages; i++) {
        const c = pageCanvasRefs.current[i];
        if (c) renderSinglePage(i, c);
      }
    } else {
      const c = pageCanvasRefs.current[currentPage];
      if (c) renderSinglePage(currentPage, c);
    }
  }, [pdfDoc, scale, rotation, viewMode, currentPage, totalPages, viewingMode, renderSinglePage]);

  // 5. Anti-leak Keyboard and Context Menu Interceptors
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      showSecurityWarning('Right-click is disabled. Document downloading and image saving are prohibited.');
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        e.stopPropagation();
        showSecurityWarning('⚠️ Printing is disabled by the document owner.');
        return false;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        e.stopPropagation();
        showSecurityWarning('⚠️ Saving/Downloading is strictly restricted.');
        return false;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        e.stopPropagation();
        showSecurityWarning('⚠️ Copying document content is disabled.');
        return false;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
        showSecurityWarning('Source inspection is restricted.');
        return false;
      }
      if (e.key === 'F12' || e.key === 'PrintScreen') {
        showSecurityWarning('⚠️ Screen capture / developer tools detected. Activity logged.');
      }
    };

    const handleWindowBlur = () => {
      if (antiScreenBlur) {
        setIsWindowBlurred(true);
      }
    };

    const handleWindowFocus = () => {
      setIsWindowBlurred(false);
    };

    const container = viewerContainerRef.current;
    if (container) {
      container.addEventListener('contextmenu', handleContextMenu);
    }
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      if (container) {
        container.removeEventListener('contextmenu', handleContextMenu);
      }
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [antiScreenBlur, showSecurityWarning]);

  // Fullscreen toggler
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      viewerContainerRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  // Watermark repeating SVG pattern
  const renderWatermarkSvg = () => (
    <div
      className="absolute inset-0 pointer-events-none select-none overflow-hidden z-20"
      style={{ opacity: watermarkOpacity }}
    >
      <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern
            id={`watermark-pattern-${documentId}`}
            width="420"
            height="220"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(-28)"
          >
            <text
              x="20"
              y="60"
              fill="#ef4444"
              fontSize="14"
              fontWeight="bold"
              fontFamily="system-ui, sans-serif"
              letterSpacing="1.5px"
            >
              {watermarkText}
            </text>
            <text
              x="20"
              y="90"
              fill="#475569"
              fontSize="11"
              fontFamily="monospace"
              fontWeight="600"
            >
              SECUREDOC PROTECTED • DO NOT DISTRIBUTE
            </text>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#watermark-pattern-${documentId})`} />
      </svg>
    </div>
  );

  // Filter individual files by search
  const filteredFiles = files.filter(
    (f) =>
      f.title.toLowerCase().includes(fileSearchQuery.toLowerCase()) ||
      f.originalFilename.toLowerCase().includes(fileSearchQuery.toLowerCase())
  );

  // --- RENDERING VIEWS ---

  // Loading state
  if (loadingMeta) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-200">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-xl font-semibold">Verifying Secure Link...</h2>
        <p className="text-sm text-slate-400 mt-1">Establishing encrypted view-only channel</p>
      </div>
    );
  }

  // Document not found / invalid link
  if (!meta) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-slate-100">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-5">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Invalid Document Link</h1>
        <p className="text-slate-400 max-w-md mt-2 text-sm leading-relaxed">
          {authError || 'This link may have expired, been revoked, or the document pack was deleted.'}
        </p>
        {onExit && (
          <button
            onClick={onExit}
            className="mt-6 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-medium transition cursor-pointer flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Return to Dashboard
          </button>
        )}
      </div>
    );
  }

  // Document deactivated or expired
  if (!meta.isActive || meta.isExpired || meta.isMaxViewsReached) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-slate-100">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-5">
          <Lock className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">
          {!meta.isActive
            ? 'Access Revoked'
            : meta.isExpired
            ? 'Link Expired'
            : 'View Limit Reached'}
        </h1>
        <p className="text-slate-400 max-w-md mt-2 text-sm leading-relaxed">
          {!meta.isActive
            ? 'The document owner has disabled public access to this link.'
            : meta.isExpired
            ? 'The scheduled expiration date for this secure view link has passed.'
            : 'This document has reached its allowed maximum view count set by the owner.'}
        </p>
        <div className="mt-6 p-4 bg-slate-900 border border-slate-800 rounded-xl max-w-sm w-full text-left">
          <div className="text-xs text-slate-400 font-medium">Document Info:</div>
          <div className="text-sm font-semibold text-slate-200 mt-1 truncate">{meta.title}</div>
          <div className="text-xs text-slate-400 mt-2">
            Status: <span className="text-rose-400 font-medium">{!meta.isActive ? 'Revoked' : meta.isExpired ? 'Expired' : 'Max views exceeded'}</span>
          </div>
        </div>
        {onExit && (
          <button
            onClick={onExit}
            className="mt-6 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-medium transition cursor-pointer flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </button>
        )}
      </div>
    );
  }

  // Gated Access Screen (Password or Email verification required)
  if (!accessGranted) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900/90 backdrop-blur border border-slate-800 rounded-2xl p-7 shadow-2xl text-slate-100">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="p-1 rounded-full bg-amber-400/10 border border-amber-400/30 mb-3 shadow-inner">
              <TheHelpingSquadLogo size={68} className="drop-shadow-md" />
            </div>
            <span className="text-[10px] font-black tracking-widest uppercase bg-gradient-to-r from-amber-400 to-orange-400 text-slate-950 px-3 py-0.5 rounded-full shadow-sm mb-1.5">
              THE HELPING SQUAD
            </span>
            <div className="flex items-center gap-2 text-indigo-400 font-semibold tracking-wide text-xs uppercase">
              <ShieldAlert className="w-3.5 h-3.5" />
              Protected View-Only Link
            </div>
            {isOwnerPreview && (
              <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-medium mt-2">
                Owner Preview Mode
              </span>
            )}
          </div>

          <div className="mb-5 text-center sm:text-left">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{meta.title}</h1>
            <p className="text-xs text-slate-400 mt-1 flex items-center justify-center sm:justify-start gap-2">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span>{meta.fileCount > 1 ? `${meta.fileCount} Individual Documents in this Link` : '1 Document'}</span>
              <span>•</span>
              <span>{meta.pageCount} Pages Total</span>
            </p>
          </div>

          {/* Files List in Bundle preview */}
          {meta.fileCount > 1 && meta.files && (
            <div className="mb-5 p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Individual Files ({meta.fileCount}):
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {meta.files.map((f, i) => (
                  <div key={f.id || i} className="text-xs text-slate-300 flex items-center justify-between bg-slate-900/60 p-2 rounded-lg border border-slate-800/80">
                    <span className="truncate max-w-[240px] flex items-center gap-2">
                      <span className="w-5 h-5 rounded bg-indigo-500/15 text-indigo-400 text-[10px] flex items-center justify-center font-bold">
                        {i + 1}
                      </span>
                      <span className="font-medium text-white">{f.title}</span>
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">{f.pageCount}p</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 mb-5 text-xs text-slate-300 flex items-start gap-3">
            <Lock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong>Zero-Download Protected:</strong> Downloading and printing are disabled.
              Every page of every file is dynamically watermarked.
            </div>
          </div>

          {authError && (
            <div className="mb-5 p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleUnlock();
            }}
            className="space-y-4"
          >
            {meta.requiresEmail && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Your Full Name <span className="text-slate-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={viewerNameInput}
                    onChange={(e) => setViewerNameInput(e.target.value)}
                    placeholder="e.g. Alex Morgan"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700/80 rounded-lg text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Your Work Email <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={viewerEmailInput}
                    onChange={(e) => setViewerEmailInput(e.target.value)}
                    placeholder="e.g. alex@company.com"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700/80 rounded-lg text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Your email will appear as a dynamic watermark across all documents.
                  </p>
                </div>
              </>
            )}

            {meta.requiresPassword && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Passcode / PIN <span className="text-rose-400">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Enter access passcode"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700/80 rounded-lg text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                />
                {isOwnerPreview && (
                  <p className="text-[11px] text-amber-300/80 mt-1">
                    (Tip: Demo passcode is usually <code className="bg-slate-800 px-1 py-0.5 rounded">demo</code>)
                  </p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={submittingAuth}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-lg text-sm transition shadow-lg shadow-indigo-600/20 cursor-pointer flex items-center justify-center gap-2 mt-2"
            >
              {submittingAuth ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Verifying Credentials...
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4" /> Open Protected Link
                </>
              )}
            </button>
          </form>

          {onExit && (
            <div className="mt-6 pt-4 border-t border-slate-800 text-center">
              <button
                onClick={onExit}
                className="text-xs text-slate-400 hover:text-slate-200 transition cursor-pointer flex items-center justify-center gap-1.5 mx-auto"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Return to Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- CATALOG VIEW: SHOWS EVERY PDF SEPARATELY AS AN INDIVIDUAL FILE ---
  if (viewingMode === 'catalog') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col select-none secure-no-select">
        {/* Header */}
        <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-30">
          <div className="max-w-6xl mx-auto px-3 sm:px-6 py-3 flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              {onExit && (
                <button
                  onClick={onExit}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer shrink-0"
                  title="Return to Dashboard"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              <div className="p-0.5 rounded-full bg-amber-400/10 border border-amber-400/30 shrink-0">
                <TheHelpingSquadLogo size={34} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <span className="font-black text-amber-400 text-[10px] sm:text-xs uppercase tracking-wider bg-amber-400/10 px-1.5 sm:px-2 py-0.5 rounded border border-amber-400/30 shrink-0">
                    The Helping Squad
                  </span>
                  <span className="font-bold text-white text-xs sm:text-base truncate max-w-[140px] sm:max-w-md">
                    {meta.title}
                  </span>
                  <span className="hidden md:inline-flex text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Zero Download
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 truncate">
                  {files.length} Individual PDF Files Available
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {files.length > 0 && (
                <button
                  onClick={() => handleOpenIndividualFile(0)}
                  className="px-2.5 sm:px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black rounded-xl text-[11px] sm:text-xs transition cursor-pointer flex items-center gap-1.5 shadow-lg shadow-amber-500/20"
                >
                  <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span className="hidden xs:inline">Start</span> Reading
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Catalog Main Body */}
        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full space-y-6">
          {/* THE HELPING SQUAD SHOWCASE BANNER */}
          <div className="p-5 sm:p-6 bg-gradient-to-r from-amber-950/40 via-slate-900 to-sky-950/40 border-2 border-amber-500/30 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-5 shadow-xl">
            <div className="flex items-start sm:items-center gap-4">
              <div className="p-1 rounded-2xl bg-amber-400/10 border border-amber-400/30 shadow-inner shrink-0">
                <TheHelpingSquadLogo size={62} className="drop-shadow-md" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest bg-gradient-to-r from-amber-400 to-orange-400 text-slate-950 px-2.5 py-0.5 rounded-full">
                    ★ THE HELPING SQUAD ★
                  </span>
                  <span className="text-xs text-amber-300 font-semibold bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 rounded-full">
                    Single-Link Multi-PDF Vault
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-black text-white">
                  Every PDF in this Link Appears Separately Below
                </h2>
                <p className="text-xs text-slate-300 leading-relaxed max-w-xl">
                  Recipients can choose any document to read in isolated canvas tiles. Direct downloading, file saving, and printing are prohibited.
                </p>
              </div>
            </div>

            {files.length > 2 && (
              <div className="relative shrink-0">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter files..."
                  value={fileSearchQuery}
                  onChange={(e) => setFileSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 w-48"
                />
              </div>
            )}
          </div>

          {/* Individual Files Directory */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold uppercase tracking-wider text-[11px] text-slate-400">
                Individual PDF Documents ({filteredFiles.length}):
              </span>
              <span>Click any file to view</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredFiles.map((file, idx) => (
                <div
                  key={file.id || idx}
                  onClick={() => handleOpenIndividualFile(idx)}
                  className="bg-slate-900/80 border border-slate-800 hover:border-indigo-500/60 rounded-2xl p-5 flex flex-col justify-between transition hover:shadow-xl hover:shadow-indigo-500/5 group cursor-pointer"
                >
                  <div>
                    {/* File Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center font-bold text-xs">
                        PDF
                      </div>
                      <span className="text-[11px] font-semibold bg-slate-950 text-indigo-400 border border-slate-800 px-2 py-0.5 rounded-full font-mono">
                        {file.pageCount} {file.pageCount === 1 ? 'Page' : 'Pages'}
                      </span>
                    </div>

                    {/* File Title and Filename */}
                    <h3 className="text-sm font-bold text-white group-hover:text-indigo-300 transition line-clamp-1 mb-1" title={file.title}>
                      {file.title}
                    </h3>
                    <p className="text-xs text-slate-400 font-mono truncate mb-4" title={file.originalFilename}>
                      {file.originalFilename}
                    </p>

                    {/* Protection Tags */}
                    <div className="flex flex-wrap gap-1.5 mb-4 text-[10px]">
                      <span className="bg-slate-950 border border-slate-800/90 text-emerald-400 px-2 py-0.5 rounded flex items-center gap-1 font-medium">
                        <CheckCircle2 className="w-3 h-3" /> View Only
                      </span>
                      <span className="bg-slate-950 border border-slate-800/90 text-purple-300 px-2 py-0.5 rounded flex items-center gap-1 font-medium">
                        <Eye className="w-3 h-3" /> Watermarked
                      </span>
                      <span className="bg-slate-950 border border-slate-800/90 text-slate-400 px-2 py-0.5 rounded font-mono">
                        {(file.fileSize / 1024).toFixed(0)} KB
                      </span>
                    </div>
                  </div>

                  {/* Open File Button */}
                  <div className="pt-3 border-t border-slate-800/80">
                    <button
                      type="button"
                      className="w-full py-2 px-3 bg-indigo-600/15 hover:bg-indigo-600 text-indigo-300 hover:text-white rounded-xl text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-2 border border-indigo-500/30 group-hover:border-indigo-500"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Open Document</span>
                      <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-800 bg-slate-900/60 py-3 px-6 text-center text-xs text-slate-400">
          <span>All documents protected by SecureDoc • Zero downloads, no printing, dynamic anti-leak watermark</span>
        </footer>
      </div>
    );
  }

  const currentFile = files[activeFileIndex] || files[0];

  // --- READER VIEW: RENDERS THE SELECTED INDIVIDUAL PDF ON CANVAS ---
  return (
    <div
      ref={viewerContainerRef}
      className="min-h-screen bg-slate-950 text-slate-100 flex flex-col select-none secure-no-select relative"
      onContextMenu={(e) => {
        e.preventDefault();
        showSecurityWarning('Right-click is disabled. Document saving is prohibited.');
      }}
    >
      {/* Toast security warning */}
      {securityNotice && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-rose-600/95 backdrop-blur text-white px-5 py-2.5 rounded-full shadow-2xl text-xs font-semibold flex items-center gap-2 animate-bounce border border-rose-400/50">
          <ShieldAlert className="w-4 h-4" />
          <span>{securityNotice}</span>
        </div>
      )}

      {/* Screen Blur shield when window loses focus */}
      {antiScreenBlur && isWindowBlurred && (
        <div className="fixed inset-0 z-40 bg-slate-950/85 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mb-4 animate-pulse">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white">Viewing Paused for Security</h2>
          <p className="text-slate-400 text-sm max-w-sm mt-1">
            This confidential document is protected while your cursor is outside the browser window.
          </p>
          <button
            onClick={() => setIsWindowBlurred(false)}
            className="mt-5 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition cursor-pointer shadow-lg shadow-indigo-600/20"
          >
            Click to Resume Viewing
          </button>
        </div>
      )}

      {/* Top Header & Security Bar - Mobile & Desktop Responsive */}
      <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-3 sm:px-4 py-2 sm:py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-center justify-between gap-2 min-w-0 w-full sm:w-auto">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Back to All Files Catalog */}
            <button
              onClick={() => {
                if (files.length > 1) {
                  setViewingMode('catalog');
                } else if (onExit) {
                  onExit();
                }
              }}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer text-xs font-medium flex items-center gap-1.5 shrink-0 border border-slate-700"
              title={files.length > 1 ? 'Back to All Files' : 'Return'}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{files.length > 1 ? `Files (${files.length})` : 'Back'}</span>
            </button>

            <div className="p-0.5 rounded-full bg-amber-400/10 border border-amber-400/30 shrink-0 hidden sm:block">
              <TheHelpingSquadLogo size={32} />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="hidden lg:inline-flex text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-amber-500/25 to-orange-500/25 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded-full shrink-0">
                  The Helping Squad
                </span>
                <h1 className="text-xs sm:text-sm font-bold text-white truncate max-w-[160px] sm:max-w-xs md:max-w-md">
                  {currentFile?.title || 'Confidential Document'}
                </h1>
                <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full shrink-0">
                  <CheckCircle2 className="w-3 h-3" /> View Only
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-400 flex items-center gap-1.5 truncate">
                <span>{totalPages} Pages</span>
                {files.length > 1 && (
                  <>
                    <span>•</span>
                    <span className="text-indigo-400 font-medium">
                      File {activeFileIndex + 1}/{files.length}
                    </span>
                  </>
                )}
                <span className="hidden sm:inline">•</span>
                <span className="hidden sm:inline text-slate-400">Zero-Download</span>
              </p>
            </div>
          </div>

          {/* Mobile Right Tools (Files Switcher & Fullscreen) */}
          <div className="flex sm:hidden items-center gap-1.5 shrink-0">
            {files.length > 1 && (
              <button
                onClick={() => setShowFilePickerDropdown(!showFilePickerDropdown)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition cursor-pointer flex items-center gap-1 border border-slate-700"
              >
                <FolderArchive className="w-3.5 h-3.5 text-indigo-400" />
                <span>{activeFileIndex + 1}/{files.length}</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>
            )}
            <button
              onClick={toggleFullscreen}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Center / Navigation Bar - Full width centered on mobile */}
        <div className="flex items-center justify-between sm:justify-center gap-1 sm:gap-1.5 bg-slate-950/80 border border-slate-800 rounded-xl px-2.5 py-1 w-full sm:w-auto">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 transition cursor-pointer"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-xs font-medium text-slate-300 px-1 whitespace-nowrap">
              Page <span className="text-white font-bold">{currentPage}</span> / {totalPages}
            </div>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 transition cursor-pointer"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="h-4 w-px bg-slate-800 mx-1" />

          {/* Zoom controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setScale((s) => Math.max(0.6, s - 0.15))}
              className="p-1 rounded text-slate-400 hover:text-white transition cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs text-slate-400 w-10 text-center font-mono">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={() => setScale((s) => Math.min(2.5, s + 0.15))}
              className="p-1 rounded text-slate-400 hover:text-white transition cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          <div className="h-4 w-px bg-slate-800 mx-1" />

          {/* Rotate & Scroll Mode */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setRotation((r) => (r + 90) % 360)}
              className="p-1 rounded text-slate-400 hover:text-white transition cursor-pointer"
              title="Rotate Page"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            <button
              onClick={() => setViewMode((m) => (m === 'scroll' ? 'single' : 'scroll'))}
              className={`p-1 rounded transition cursor-pointer ${
                viewMode === 'scroll' ? 'text-indigo-400' : 'text-slate-400 hover:text-white'
              }`}
              title={viewMode === 'scroll' ? 'Switch to Single Page' : 'Switch to Continuous Scroll'}
            >
              <Layers className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Desktop Right Tools */}
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          {/* File switcher dropdown if multiple files */}
          {files.length > 1 && (
            <div className="relative">
              <button
                onClick={() => setShowFilePickerDropdown(!showFilePickerDropdown)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition cursor-pointer flex items-center gap-1.5 border border-slate-700"
              >
                <FolderArchive className="w-3.5 h-3.5 text-indigo-400" />
                <span>Files ({activeFileIndex + 1}/{files.length})</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>
            </div>
          )}

          {/* Watermark opacity adjuster */}
          <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-slate-400 bg-slate-950/60 border border-slate-800 rounded-lg px-2 py-1">
            <span className="text-slate-400">Watermark:</span>
            <input
              type="range"
              min="0.10"
              max="0.45"
              step="0.05"
              value={watermarkOpacity}
              onChange={(e) => setWatermarkOpacity(parseFloat(e.target.value))}
              className="w-16 accent-indigo-500 cursor-pointer"
              title="Adjust Watermark Intensity"
            />
          </div>

          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>

        {/* Shared File Picker Dropdown (works on both Mobile and Desktop) */}
        {showFilePickerDropdown && files.length > 1 && (
          <div className="absolute right-3 top-14 sm:top-12 w-72 max-w-[calc(100vw-24px)] bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-2 z-50 space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1">
              Switch Individual File:
            </div>
            {files.map((f, i) => (
              <button
                key={f.id || i}
                onClick={() => handleSwitchDocument(i)}
                className={`w-full text-left p-2 rounded-lg text-xs transition cursor-pointer flex items-center justify-between ${
                  activeFileIndex === i
                    ? 'bg-indigo-600 text-white font-semibold'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span className="truncate max-w-[200px]">
                  {i + 1}. {f.title}
                </span>
                <span className="text-[10px] font-mono opacity-70">{f.pageCount}p</span>
              </button>
            ))}
            <div className="pt-1 border-t border-slate-800 mt-1">
              <button
                onClick={() => {
                  setShowFilePickerDropdown(false);
                  setViewingMode('catalog');
                }}
                className="w-full text-center py-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
              >
                View All Files Directory
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Canvas Scroll Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Thumbnails Sidebar */}
        {showThumbnails && (
          <aside className="w-48 bg-slate-900 border-r border-slate-800 p-3 overflow-y-auto space-y-3 z-10">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Page Previews
            </div>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
              <button
                key={pageNum}
                onClick={() => {
                  setCurrentPage(pageNum);
                  if (viewMode === 'scroll') {
                    const el = document.getElementById(`doc-page-${pageNum}`);
                    el?.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
                className={`w-full text-left p-2 rounded-lg border transition cursor-pointer flex flex-col items-center ${
                  currentPage === pageNum
                    ? 'border-indigo-500 bg-indigo-500/10 text-white'
                    : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="w-full aspect-[1/1.4] bg-slate-800 rounded flex items-center justify-center text-xs font-mono font-medium">
                  {pageNum}
                </div>
                <span className="text-[11px] mt-1.5 font-medium">Page {pageNum}</span>
              </button>
            ))}
          </aside>
        )}

        {/* PDF Pages Container */}
        <div
          ref={pagesContainerRef}
          className="flex-1 overflow-auto bg-slate-950 p-4 sm:p-8 flex flex-col items-center space-y-8"
        >
          <input
            ref={repairFileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={handleRepairFileSelect}
          />

          {loadingPdf || repairUploading ? (
            <div className="my-16 p-8 bg-slate-900/80 border border-slate-800 rounded-2xl max-w-md w-full text-center space-y-4 shadow-2xl">
              <div className="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto" />
              <div className="text-base font-bold text-white">
                {repairUploading ? 'Uploading & Publishing PDF...' : 'Loading PDF Document...'}
              </div>
              <p className="text-xs text-slate-400">
                {repairProgressText || 'Rendering high-resolution protected pages...'}
              </p>
            </div>
          ) : pdfLoadError || !pdfDoc ? (
            <div className="my-10 p-6 sm:p-8 bg-slate-900/90 border-2 border-amber-500/40 rounded-2xl max-w-lg w-full text-center space-y-5 shadow-2xl">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg sm:text-xl font-bold text-white">
                  PDF File Data Needs to Be Re-Uploaded
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  This document entry (<span className="font-semibold text-amber-300">"{currentFile?.title || meta?.title}"</span>) was saved locally as a title before the actual PDF file finished uploading to the server. That is why it shows a blank page and is not visible to other users.
                </p>
              </div>

              <div className="p-3.5 bg-slate-950/90 border border-slate-800 rounded-xl text-left text-xs text-slate-300 space-y-1.5">
                <div className="font-bold text-amber-400">How to fix this in 1 tap:</div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Tap <strong className="text-white">"Select PDF File to Upload & Publish Now"</strong> below and pick the PDF file from your phone or computer. It will immediately upload to the server and become visible to all users.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => repairFileInputRef.current?.click()}
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
                >
                  <Upload className="w-4 h-4 stroke-[2.5]" />
                  <span>Select PDF File to Upload & Publish Now</span>
                </button>

                {onExit && (
                  <button
                    type="button"
                    onClick={async () => {
                      await documentService.deleteDocument(documentId);
                      onExit();
                    }}
                    className="py-3 px-4 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Incomplete Entry</span>
                  </button>
                )}
              </div>
            </div>
          ) : viewMode === 'scroll' ? (
            // Continuous Vertical Scroll
            Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
              <div
                key={`${activeFileIndex}-${pageNum}`}
                id={`doc-page-${pageNum}`}
                className="relative bg-white rounded-lg shadow-2xl overflow-hidden group border border-slate-700/50"
              >
                {/* PDF Canvas Tile */}
                <canvas
                  ref={(el) => {
                    pageCanvasRefs.current[pageNum] = el;
                  }}
                  className="block"
                />

                {/* Protective transparent interaction blocker */}
                <div
                  className="absolute inset-0 z-10 pointer-events-auto bg-transparent select-none cursor-default"
                  onContextMenu={(e) => {
                    e.preventDefault();
                    showSecurityWarning('Protected document: saving or copying is restricted.');
                  }}
                />

                {/* Dynamic Repeating Watermark Layer */}
                {renderWatermarkSvg()}

                {/* Page indicator pill at bottom right */}
                <div className="absolute bottom-2 right-2 z-20 bg-slate-900/80 backdrop-blur px-2.5 py-1 rounded text-[10px] font-mono font-medium text-slate-300 border border-slate-700/50 pointer-events-none">
                  {files.length > 1 ? `${currentFile?.title} • ` : ''}Page {pageNum} of {totalPages}
                </div>
              </div>
            ))
          ) : (
            // Single Page Flip Mode
            <div
              id={`doc-page-${currentPage}`}
              className="relative bg-white rounded-lg shadow-2xl overflow-hidden group border border-slate-700/50"
            >
              <canvas
                ref={(el) => {
                  pageCanvasRefs.current[currentPage] = el;
                }}
                className="block"
              />

              {/* Protective transparent interaction blocker */}
              <div
                className="absolute inset-0 z-10 pointer-events-auto bg-transparent select-none cursor-default"
                onContextMenu={(e) => {
                  e.preventDefault();
                  showSecurityWarning('Protected document: saving or copying is restricted.');
                }}
              />

              {/* Dynamic Repeating Watermark Layer */}
              {renderWatermarkSvg()}

              <div className="absolute bottom-2 right-2 z-20 bg-slate-900/80 backdrop-blur px-2.5 py-1 rounded text-[10px] font-mono font-medium text-slate-300 border border-slate-700/50 pointer-events-none">
                {files.length > 1 ? `${currentFile?.title} • ` : ''}Page {currentPage} of {totalPages}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floating Bottom Navigation & Security Banner */}
      <footer className="bg-slate-900/95 backdrop-blur border-t border-slate-800 px-3 sm:px-4 py-2 flex items-center justify-between gap-2 text-xs text-slate-400">
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {files.length > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleSwitchDocument(Math.max(0, activeFileIndex - 1))}
                disabled={activeFileIndex <= 0}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 cursor-pointer flex items-center gap-1 text-[11px]"
              >
                <ChevronLeft className="w-3 h-3" /> Prev
              </button>
              <button
                onClick={() => handleSwitchDocument(Math.min(files.length - 1, activeFileIndex + 1))}
                disabled={activeFileIndex >= files.length - 1}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 cursor-pointer flex items-center gap-1 text-[11px]"
              >
                Next <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="hidden md:inline">
              Zero-Download Policy Enforced across all {files.length} files
            </span>
          </div>
        </div>

        <div className="text-[10px] sm:text-[11px] text-slate-400 font-mono truncate max-w-[180px] sm:max-w-xs">
          File {activeFileIndex + 1}/{files.length} • {currentFile?.originalFilename}
        </div>
      </footer>
    </div>
  );
};
