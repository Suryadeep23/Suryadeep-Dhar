// Polyfill for Iterator global in environments where modern ECMAScript Iterator is not yet native
if (typeof (globalThis as any).Iterator === 'undefined') {
  (globalThis as any).Iterator = class Iterator {};
}
if (typeof window !== 'undefined' && typeof (window as any).Iterator === 'undefined') {
  (window as any).Iterator = (globalThis as any).Iterator;
}

import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);

// Register Service Worker for PWA installability and automatic update
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });

  const registerSw = () => {
    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        reg.update().catch(() => {});
      })
      .catch((err) => {
        console.warn('PWA ServiceWorker registration failed:', err);
      });
  };

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    registerSw();
  } else {
    window.addEventListener('load', registerSw);
  }
}
