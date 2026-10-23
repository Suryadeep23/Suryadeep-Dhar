// Polyfill for Iterator global
if (typeof (globalThis as any).Iterator === 'undefined') {
  (globalThis as any).Iterator = class Iterator {};
}
if (typeof window !== 'undefined' && typeof (window as any).Iterator === 'undefined') {
  (window as any).Iterator = (globalThis as any).Iterator;
}

import * as pdfjsLib from 'pdfjs-dist';

import localPdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url';

// Configure the worker for pdfjs-dist
export function setupPdfWorker() {
  if (typeof window === 'undefined') return;
  try {
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = localPdfWorkerUrl || `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
    }
  } catch (err) {
    console.warn('Failed to set pdfjs workerSrc:', err);
  }
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
