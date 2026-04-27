const CACHE_NAME = 'blu-v3';

// Standard files to cache immediately
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Use silent failure for assets if they fail to load
      return cache.addAll(ASSETS).catch(err => console.log('Pre-cache failed:', err));
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests and avoid extension/external URLs if possible
  if (event.request.method !== 'GET') return;
  
  const url = new URL(event.request.url);
  
  // Ignore chrome extensions or non-http protocols
  if (!['http:', 'https:'].includes(url.protocol)) return;

  event.respondWith(
    fetch(event.request).then((networkResponse) => {
      // Check if we received a valid response
      if (!networkResponse || networkResponse.status !== 200 || (networkResponse.type !== 'basic' && networkResponse.type !== 'cors')) {
        return networkResponse;
      }

      // Clone the response because it's a stream and can only be consumed once
      const responseToCache = networkResponse.clone();

      caches.open(CACHE_NAME).then((cache) => {
        // Avoid caching API responses or very large files if needed
        if (!url.pathname.includes('/api/')) {
          cache.put(event.request, responseToCache);
        }
      });

      return networkResponse;
    }).catch(() => {
      // Fallback to cache on network failure
      return caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        // Fallback for single page application (SPA)
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
        return null;
      });
    })
  );
});
