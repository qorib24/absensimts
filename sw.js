const CACHE_NAME = 'absensi-mts-cache-v2';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  // script.js tidak di cache agar selalu fresh (atau bisa dicache jika butuh offline)
];

// Install SW
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Activate SW
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch - Online First Strategy untuk API, dan Cache First untuk Statis
self.addEventListener('fetch', event => {
  // Jangan intercept request ke Firebase/API eksternal
  if (event.request.url.startsWith('https://firestore.googleapis.com') ||
      event.request.url.startsWith('https://catatannomer-f2924') ||
      event.request.url.includes('firebasedatabase.app')) {
    return; // biarkan browser menghandle request secara normal (online)
  }

  // Network First, fallback to cache
  event.respondWith(
    fetch(event.request)
      .catch(() => caches.match(event.request))
  );
});
