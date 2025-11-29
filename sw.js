const CACHE_NAME = 'aetherschedule-cache-v1';
const API_CACHE_NAME = 'aetherschedule-api-cache-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Opened cache');
      // Precaching a minimal shell for instant loading
      return cache.addAll([
        '/',
        '/index.html',
        '/styles.css',
      ]);
    })
  );
  self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // API calls: Network first, then cache
  if (request.url.includes('/api/')) {
    event.respondWith(
      caches.open(API_CACHE_NAME).then(async (cache) => {
        try {
          const response = await fetch(request);
          // Cache successful GET requests
          if (request.method === 'GET' && response.ok) {
            cache.put(request, response.clone());
          }
          return response;
        } catch (error) {
          // Network failed, try the cache
          const cachedResponse = await cache.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          // If not in cache and it's a GET, return a generic offline error
          if (request.method === 'GET') {
              return new Response(JSON.stringify({ message: 'Offline: Could not fetch data.' }), {
                  status: 503,
                  statusText: 'Service Unavailable',
                  headers: { 'Content-Type': 'application/json' }
              });
          }
          throw error;
        }
      })
    );
    return;
  }

  // Other requests (assets, pages): Cache first, then network
  event.respondWith(
    caches.match(request).then((response) => {
      if (response) {
        return response; // Return from cache
      }
      
      // Not in cache, fetch from network
      return fetch(request).then((networkResponse) => {
        // Check for valid response before caching
        if (!networkResponse || networkResponse.status !== 200 || (networkResponse.type !== 'basic' && !networkResponse.url.startsWith('https://'))) {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache);
        });
        return networkResponse;
      });
    })
  );
});

// Clean up old caches on activation
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME, API_CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});
