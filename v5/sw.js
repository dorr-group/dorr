/* DORR v5 service worker — offline after first visit */
const CACHE = 'dorr-v5-1';
const CORE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/fonts.css',
  'css/style.css',
  'js/main.js',
  'js/pearl.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'img/hero-day.webp',
  'img/hero-night.webp',
  'img/pearl.webp',
  'img/p-governance.webp',
  'img/p-resources.webp',
  'img/p-innovate.webp',
  'img/p-consistency.webp',
  'img/dada.webp',
  'img/sayah.webp',
  'img/dejavu.webp',
  'img/m04.webp',
  'img/randezvou.webp',
  'img/vision.webp',
  '../vendor/js/gsap.min.js',
  '../vendor/js/ScrollTrigger.min.js',
  '../vendor/js/lenis.min.js',
  '../vendor/fonts/noto-serif-display-latin-wdth-normal.woff2',
  '../vendor/fonts/noto-serif-display-latin-wdth-italic.woff2',
  '../vendor/fonts/instrument-sans-latin-wdth-normal.woff2'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('dorr-v5-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req)
          .then((r) => r || caches.match('index.html'))
          .then((r) => r || caches.match('./')))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }))
  );
});
