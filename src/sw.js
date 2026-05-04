const CACHE = 'claude-usage-v5';
const ASSETS = [
  '/claude-usage/',
  '/claude-usage/index.html',
  '/claude-usage/manifest.json',
  '/claude-usage/icon.svg',
  '/claude-usage/src/parser.js',
  '/claude-usage/src/stats.js',
  '/claude-usage/src/history.js',
  '/claude-usage/src/alarm.js',
  '/claude-usage/src/styles.css',
  '/claude-usage/src/tailwindcss.min.js',
  '/claude-usage/src/alpine.min.js',
  '/claude-usage/src/app.js',
  '/claude-usage/src/renderer.js',
  '/claude-usage/src/sw.js',
  '/claude-usage/assets/Recover.mp3'
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
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
