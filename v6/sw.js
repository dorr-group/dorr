/* DORR v6 — service worker */
const CACHE = 'dorr-v6-1';
const CORE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/fonts.css',
  'css/style.css',
  'js/main.js',
  'js/nacre.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'img/grain.png',
  'img/hero.jpg',
  'img/plate.jpg',
  'img/shell.jpg',
  'img/table.jpg',
  'img/chef.jpg',
  'img/dada.jpg',
  'img/sayah.jpg',
  'img/dejavu.jpg',
  'img/m04.jpg',
  'img/randezvou.jpg',
  'img/ridges.jpg',
  'img/embers.jpg',
  '../vendor/js/gsap.min.js',
  '../vendor/js/ScrollTrigger.min.js',
  '../vendor/js/lenis.min.js',
  '../vendor/fonts/newsreader-latin-opsz-normal.woff2',
  '../vendor/fonts/newsreader-latin-opsz-italic.woff2',
  '../vendor/fonts/unbounded-latin-wght-normal.woff2'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('dorr-v6-') && k !== CACHE).map((k) => caches.delete(k))))
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
