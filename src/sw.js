const CACHE = 'claude-usage-v5';
const ASSETS = [
  '/claude-usage/',
  '/claude-usage/index.html',
  '/claude-usage/manifest.json',
  '/claude-usage/icon.svg',
  '/claude-usage/parser.js',
  '/claude-usage/stats.js',
  '/claude-usage/history.js',
  '/claude-usage/alarm.js',
  '/claude-usage/tailwindcss.min.js',
  '/claude-usage/alpine.min.js',
  '/claude-usage/app.js',
  '/claude-usage/Recover.mp3'
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
