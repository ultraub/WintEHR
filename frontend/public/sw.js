// Service Worker for WintEHR
// Provides caching for better performance and offline capabilities

const CACHE_NAME = 'medgen-emr-v1.0.1';
const STATIC_CACHE_NAME = 'medgen-static-v1.0.1';
const API_CACHE_NAME = 'medgen-api-v1.0.1';

// Static assets to cache
const STATIC_ASSETS = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json',
  // Add other static assets as needed
];

// API endpoints to cache
const API_ENDPOINTS = [
  '/api/auth/config',
  '/fhir/R4/Patient',
  '/api/clinical/catalogs',
];

// Cache-first strategy for static assets
const cacheFirst = async (request) => {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('Network failed for:', request.url);
    return new Response('Offline', { status: 503 });
  }
};

// Network-first strategy for API calls
const networkFirst = async (request) => {
  try {
    const networkResponse = await fetch(request);
    
    // Only cache successful responses (200-299 status codes)
    if (networkResponse.ok && networkResponse.status >= 200 && networkResponse.status < 300) {
      const cache = await caches.open(API_CACHE_NAME);
      // Only cache GET requests
      if (request.method === 'GET') {
        cache.put(request, networkResponse.clone());
      }
    } else if (networkResponse.status >= 400) {
      // For error responses, remove any existing cache to prevent serving stale data
      const cache = await caches.open(API_CACHE_NAME);
      await cache.delete(request);
    }
    
    return networkResponse;
  } catch (error) {
    console.log('Network failed, trying cache for:', request.url);
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      // Check if cached response is recent (less than 5 minutes old)
      const cacheDate = new Date(cachedResponse.headers.get('date') || 0);
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      
      if (cacheDate > fiveMinutesAgo) {
        return cachedResponse;
      } else {
        // Remove stale cache
        const cache = await caches.open(API_CACHE_NAME);
        await cache.delete(request);
      }
    }
    
    return new Response(
      JSON.stringify({ error: 'Offline - data not available' }), 
      { 
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('Caching static assets...');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('Static assets cached successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Error caching static assets:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE_NAME && 
              cacheName !== API_CACHE_NAME &&
              cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker activated');
      return self.clients.claim();
    })
  );
});

// Fetch event - handle requests
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests for caching
  if (request.method !== 'GET') {
    return;
  }
  
  // Handle different types of requests
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/fhir/')) {
    // API requests - network first
    event.respondWith(networkFirst(request));
  } else if (
    url.pathname.startsWith('/static/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.svg')
  ) {
    // Static assets - cache first
    event.respondWith(cacheFirst(request));
  } else {
    // HTML pages - network first with cache fallback
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match('/') || new Response('Offline', { status: 503 });
      })
    );
  }
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('Background sync:', event.tag);
  
  if (event.tag === 'patient-data-sync') {
    event.waitUntil(syncPatientData());
  }
});

// Sync patient data when back online
async function syncPatientData() {
  try {
    // This would sync any offline changes when back online
    console.log('Syncing patient data...');
    // Implementation would depend on your offline storage strategy
  } catch (error) {
    console.error('Error syncing patient data:', error);
  }
}

// Push notifications (for future use)
self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);
  
  const options = {
    body: event.data ? event.data.text() : 'New update available',
    icon: '/logo192.png',
    badge: '/logo192.png',
    tag: 'medgen-notification',
    data: {
      url: '/'
    }
  };
  
  event.waitUntil(
    self.registration.showNotification('WintEHR', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/')
  );
});