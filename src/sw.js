const CACHE = 'claude-usage-v7';
const ASSETS = [
  '/claude-usage/',
  '/claude-usage/index.html',
  '/claude-usage/manifest.json',
  '/claude-usage/icon.svg',
  '/claude-usage/tailwindcss.min.js',
  '/claude-usage/src/parser.js',
  '/claude-usage/src/stats.js',
  '/claude-usage/src/history.js',
  '/claude-usage/src/alarm.js',
  '/claude-usage/src/app.js',
  '/claude-usage/src/renderer.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(e.request)
        .then(r => {
          caches.open(CACHE).then(c => c.put(e.request, r.clone()));
          return r;
        })
        .catch(() => caches.match(e.request))
    );
  } else {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
  }
});
