/* Service Worker: liefert die App-Dateien aus dem Cache, damit die App schnell und auch ohne Netz startet.
   Jede Version hat einen eigenen Cache, der bei der Installation komplett und am Browser-Cache vorbei gefüllt wird.
   CACHE_VERSION bei jeder Änderung an den App-Dateien erhöhen und mit version.js gleich halten. */
const CACHE_VERSION = '1.9.3';
const CACHE_NAME = 'essensplaner-' + CACHE_VERSION;

const ASSETS = [
  './index.html',
  './theme.js',
  './version.js',
  './boot.js',
  './ha.js',
  './swipe.js',
  './transfer.js',
  './settings.js',
  './app.js',
  './styles.css',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
  './font-archivo.woff2',
  './font-space-grotesk.woff2',
  './font-work-sans.woff2',
  './font-dm-sans.woff2',
  './font-manrope.woff2',
  './font-figtree.woff2',
  './font-bricolage-grotesque.woff2',
  './font-inter.woff2',
];

self.addEventListener('install', (event) => {
  // cache: 'reload' umgeht den Browser-Cache. Eine fehlende Datei bricht die Installation nicht ab.
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(ASSETS.map((a) => cache.add(new Request(a, { cache: 'reload' })).catch((e) => console.warn('Nicht im Cache:', a, e)))),
    ),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Nur eigene alte Caches löschen. Caches des HA-Frontends auf derselben Adresse bleiben.
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.indexOf('essensplaner-') === 0 && k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/auth/') || url.pathname.startsWith('/api/')) return;
  const scopePath = new URL(self.registration.scope).pathname;
  if (url.pathname.indexOf(scopePath) !== 0) return;

  // Seitenaufrufe (auch mit ?code=… nach der Anmeldung) bekommen die gecachte index.html.
  const isStart = req.mode === 'navigate' && (url.pathname.endsWith('/') || url.pathname.endsWith('/index.html'));
  if (req.mode === 'navigate' && !isStart) return; // z. B. diag.html immer direkt vom Server
  const key = isStart ? new Request(new URL('./index.html', self.location).href) : new Request(url.origin + url.pathname);

  // Nur aus dem Cache dieser Version, damit sich beim Update keine alten und neuen Dateien mischen.
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const hit = await cache.match(key);
      if (hit) return hit;
      try {
        const res = await fetch(key.url, { cache: 'reload' });
        if (res.ok && res.type === 'basic') cache.put(key, res.clone());
        return res;
      } catch (e) {
        return Response.error();
      }
    }),
  );
});
