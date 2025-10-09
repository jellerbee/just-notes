/**
 * Service Worker for jnotes
 * Provides offline support and background sync
 */

const CACHE_NAME = 'jnotes-v1';
const API_CACHE_NAME = 'jnotes-api-v1';

// Files to cache for offline use (app shell)
// Note: In production, Vite bundles assets with hashed filenames.
// We'll cache them dynamically as they're fetched instead of pre-caching.
const STATIC_ASSETS = [
  '/',
  '/index.html',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching app shell');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting()) // Activate immediately
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim()) // Take control immediately
  );
});

// Fetch event - handle network requests
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests - POST/PUT/DELETE handled separately
  if (request.method !== 'GET') {
    return; // Let it go to network
  }

  // API requests - network first, cache fallback
  if (url.pathname.startsWith('/notes') || url.pathname.startsWith('/search')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone and cache successful responses
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(API_CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Network failed - try cache
          return caches.match(request)
            .then((cachedResponse) => {
              if (cachedResponse) {
                console.log('[SW] Serving from cache:', request.url);
                return cachedResponse;
              }
              // Return offline response
              return new Response(
                JSON.stringify({ error: 'Offline', offline: true }),
                {
                  status: 503,
                  headers: { 'Content-Type': 'application/json' }
                }
              );
            });
        })
    );
    return;
  }

  // Static assets - cache first, network fallback
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request)
          .then((response) => {
            // Cache new static assets
            if (response.ok && request.url.startsWith(self.location.origin)) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseClone);
              });
            }
            return response;
          });
      })
  );
});

// Background Sync event - sync queued writes when back online
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);

  if (event.tag === 'sync-appends') {
    event.waitUntil(syncQueuedAppends());
  }
});

/**
 * Sync queued appends from IndexedDB
 */
async function syncQueuedAppends() {
  console.log('[SW] Syncing queued appends...');

  // This will be called by the main app through postMessage
  // We'll notify all clients to trigger their sync logic
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({
      type: 'BACKGROUND_SYNC',
      tag: 'sync-appends'
    });
  });
}

// Listen for messages from main app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
