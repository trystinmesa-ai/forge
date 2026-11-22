// Offline support: cache the app shell and serve it cache-first.
// Only this app's own files are cached; sync requests to Supabase always go to the network.
// Bump VERSION on every release (with js/version.js) or phones keep the old copy.
const VERSION = 'forge-v1.1.0';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/styles.css',
  'js/app.js', 'js/version.js', 'js/db.js', 'js/prefs.js', 'js/backup.js', 'js/cloud.js', 'js/ui.js', 'js/util.js', 'js/history-read.js',
  'js/data/taxonomy.js', 'js/data/exercises.js', 'js/data/lookup.js', 'js/data/programming.js', 'js/data/sources.js', 'js/musclemap.js', 'js/workout.js', 'js/timer.js', 'js/sheets.js', 'js/plan-ui.js', 'js/stats.js', 'js/charts.js', 'js/screens/workout.js',
  'js/engine/index.js', 'js/engine/planner.js', 'js/engine/recovery.js', 'js/engine/progression.js', 'js/engine/schedule.js',
  'js/screens/today.js', 'js/screens/log.js', 'js/screens/history.js', 'js/screens/library.js', 'js/screens/progress.js', 'js/screens/settings.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('forge-') && k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.includes('/tests/')) return;
  if (req.mode === 'navigate') {
    e.respondWith(caches.match('index.html').then((r) => r || fetch(req)));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
    return res;
  })));
});
