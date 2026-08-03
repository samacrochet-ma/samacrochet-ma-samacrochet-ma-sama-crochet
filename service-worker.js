const CACHE_NAME = 'sama-crochet-v4';

const CORE_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&family=Poppins:wght@400;500;600&display=swap'
];

const NETWORK_FIRST = ['index.html', 'app.js', 'style.css', 'manifest.json'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll())
      .then(clients => clients.forEach(client => client.postMessage({ type: 'SW_UPDATED' })))
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = req.url;
  const isNetworkFirst =
    req.mode === 'navigate' ||
    NETWORK_FIRST.some(name => url.includes(name));

  if (url.includes('script.google.com')) {
    event.respondWith(
      fetch(req).catch(() => new Response(JSON.stringify({ status: 'error', message: 'offline' }), { headers: { 'Content-Type': 'application/json' } }))
    );
    return;
  }

  if (isNetworkFirst) {
    event.respondWith(
      fetch(req).then(res => {
        if (res.ok) {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, resClone));
        }
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(req).then(cached => {
        const networkFetch = fetch(req).then(res => {
          if (req.method === 'GET' && res.ok) {
            cache.put(req, res.clone());
          }
          return res;
        }).catch(() => cached);
        return cached || networkFetch;
      })
    )
  );
});
