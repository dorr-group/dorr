/* DORR v7 service worker — works offline after the first visit */
const PREFIX = 'dorr-v7-';
const CACHE = 'dorr-v7-3';
const CORE = [
  './',
  'index.html',
  'contact.html',
  'manifest.webmanifest',
  'css/fonts.css?v=20261030b',
  'css/style.css?v=20261030b',
  'js/main.js?v=20261030b',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'img/grain.webp',
  'img/hero-day-m.webp',
  'img/sayah.webp',
  'img/flower-a.webp',
  'img/b-governance.webp',
  'img/b-resources.webp',
  'img/b-innovate.webp',
  'img/b-consistency.webp',
  'img/travel.webp',
  'img/dada.webp',
  'img/dejavu.webp',
  'img/m04.webp',
  'img/randezvou.webp',
  'img/g-dining.webp',
  'img/g-room.webp',
  'img/g-pool.webp',
  'img/aerial.webp',
  'img/footer.webp',
  'img/contact.webp',
  '../vendor/js/gsap.min.js',
  '../vendor/js/ScrollTrigger.min.js',
  '../vendor/js/lenis.min.js',
  '../vendor/fonts/fraunces-latin-full-normal.woff2',
  '../vendor/fonts/fraunces-latin-opsz-italic.woff2',
  '../vendor/fonts/jost-latin-wght-normal.woff2',
  '../vendor/fonts/amiri-dorr-subset.woff2'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // pages (and the router's fetches of pages): network first, cache fallback
  const isPage = req.mode === 'navigate' || /\.html$|\/$/.test(url.pathname);
  if (isPage) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
          return res;
        })
        .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('index.html')))
    );
    return;
  }

  // scripts and styles: network first so an old cache can never pair stale js/css with new html
  if (req.destination === 'script' || req.destination === 'style') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match(req, { ignoreSearch: true })))
    );
    return;
  }

  // everything else same-origin: cache first, then network + store
  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }))
  );
});
