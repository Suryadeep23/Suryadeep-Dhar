// The Helping Squad Vault - Service Worker
const CACHE_NAME = 'squad-vault-cache-v7';
const PRECACHE_ASSETS = [
  '/manifest.webmanifest',
  '/manifest.json',
  '/the_helping_squad_logo.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
  '/apple-touch-icon.png',
  '/favicon.ico'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch(() => {});
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never intercept API calls, non-GET requests, or HTML navigation requests so mobile browsers & PWAs always fetch live data directly
  if (
    url.pathname.startsWith('/api/') ||
    event.request.method !== 'GET' ||
    event.request.mode === 'navigate'
  ) {
    return;
  }

  // Only handle static precached icon/manifest assets; let JS/CSS bundles go directly to network
  if (!PRECACHE_ASSETS.includes(url.pathname)) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          return new Response('Network offline', { status: 503, statusText: 'Service Unavailable' });
        });
      })
  );
});

