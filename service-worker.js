// service-worker.js - Fixed Version
const CACHE_NAME = 'life-tracker-google-sheets-v2.0';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './db.js',
  './google-sheets.js',
  './manifest.json'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('Opened cache');
        // Try to add all, but don't fail if some fail
        return Promise.all(
          urlsToCache.map(function(url) {
            return cache.add(url).catch(function(error) {
              console.log('Failed to cache:', url, error);
              return Promise.resolve(); // Don't fail the entire install
            });
          })
        );
      })
  );
});

self.addEventListener('fetch', function(event) {
  // Skip Google Sheets API calls
  if (event.request.url.includes('google.com/macros') || 
      event.request.url.includes('script.google.com')) {
    return;
  }
  
  // Skip CDN requests
  if (event.request.url.includes('cdnjs.cloudflare.com') ||
      event.request.url.includes('cdn.jsdelivr.net')) {
    return fetch(event.request);
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
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
