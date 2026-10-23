// Polyfill for Iterator global
if (typeof (globalThis as any).Iterator === 'undefined') {
  (globalThis as any).Iterator = class Iterator {};
}
if (typeof window !== 'undefined' && typeof (window as any).Iterator === 'undefined') {
  (window as any).Iterator = (globalThis as any).Iterator;
}

import * as pdfjsLib from 'pdfjs-dist';

import localPdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url';

export const CMAP_URL = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/';
export const STANDARD_FONT_DATA_URL = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/standard_fonts/';

// Configure the worker for pdfjs-dist
export function setupPdfWorker() {
  if (typeof window === 'undefined') return;
  try {
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        localPdfWorkerUrl || `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
    }
  } catch (err) {
    console.warn('Failed to set pdfjs workerSrc:', err);
  }
}

// Build mobile-safe PDF.js getDocument options with CMap & Standard Font fallbacks
export function getPdfDocumentOptions(params: Record<string, any>) {
  setupPdfWorker();
  return {
    cMapUrl: CMAP_URL,
    cMapPacked: true,
    standardFontDataUrl: STANDARD_FONT_DATA_URL,
    enableXfa: true,
    isEvalSupported: false,
    ...params,
  };
}

// Convert Base64 string to Uint8Array for PDF.js getDocument
export function base64ToUint8Array(base64: string): Uint8Array {
  try {
    if (!base64) return new Uint8Array(0);
    // Strip data URL header if present (e.g. data:application/pdf;base64,...)
    const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
    // Remove any whitespace, newlines, or carriage returns that break atob
    const sanitized = cleanBase64.replace(/[\s\r\n]+/g, '');
    const binaryString = window.atob(sanitized);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } catch (err) {
    console.warn('Safe base64ToUint8Array error:', err);
    return new Uint8Array(0);
  }
}

export { pdfjsLib };

