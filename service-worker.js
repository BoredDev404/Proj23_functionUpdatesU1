// service-worker.js - Updated for Google Sheets Sync
const CACHE_NAME = 'life-tracker-google-sheets-v1.0';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/db.js',
  '/google-sheets.js',
  '/manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/dexie@3.2.4/dist/dexie.min.js',
  'https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', function(event) {
  // Skip Google Sheets API calls
  if (event.request.url.includes('google.com/macros') || 
      event.request.url.includes('script.google.com')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Sync event for background sync
self.addEventListener('sync', function(event) {
  if (event.tag === 'google-sheets-sync') {
    event.waitUntil(syncGoogleSheets());
  }
});

async function syncGoogleSheets() {
  console.log('Background sync: Syncing with Google Sheets...');
  // This would be called when the device comes back online
  // The actual sync logic is in the google-sheets.js file
}
