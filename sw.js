const CACHE = 'siomai-king-inventory-v40';
const ASSETS = ['./', './index.html', './styles.css', './app.js', './manifest.webmanifest'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys
        .filter(key =>
          (key.startsWith('siomai-king-inventory-') && key !== CACHE)
          || key === 'siomai-king-pos-v1'
        )
        .map(key => caches.delete(key))
    ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(event.request).then(response => response || fetch(event.request))
    )
  );
});
