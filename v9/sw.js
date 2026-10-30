/* DORR v9 service worker — never touches video/audio or ranged requests */
const PREFIX = 'dorr-v9-';
const CACHE = PREFIX + '1';
const V = '?v=20261030';
const CORE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/fonts.css' + V,
  'css/style.css' + V,
  'js/main.js' + V,
  '../vendor/js/gsap.min.js' + V,
  '../vendor/js/ScrollTrigger.min.js' + V,
  '../vendor/js/lenis.min.js' + V,
  '../vendor/fonts/eb-garamond-latin-wght-normal.woff2',
  '../vendor/fonts/eb-garamond-latin-wght-italic.woff2',
  '../vendor/fonts/albert-sans-latin-wght-normal.woff2',
  'media/dorr-film-poster.webp',
  'media/dorr-film-poster-720.webp',
  'media/dorr-film-poster.jpg',
  'media/dorr-dusk-poster.webp',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function networkFirst(req) {
  return fetch(req).then((res) => {
    if (res && res.ok && res.type === 'basic') {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
    }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: false }).then((hit) => hit || caches.match(req, { ignoreSearch: true })));
}

function cacheFirst(req) {
  return caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    if (res && res.ok && res.type === 'basic') {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
    }
    return res;
  }));
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (req.headers.has('range')) return;                       // let the browser stream media itself
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const dest = req.destination;
  if (dest === 'video' || dest === 'audio' || /\.(mp4|webm|m4a|mp3|ogg)$/i.test(url.pathname)) return;

  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put('index.html', copy));
      return res;
    }).catch(() => caches.match(req)
      .then((hit) => hit || caches.match('index.html'))
      .then((hit) => hit || caches.match('./'))));
    return;
  }
  if (dest === 'script' || dest === 'style' || /\.(js|css)$/i.test(url.pathname)) { e.respondWith(networkFirst(req)); return; }
  if (dest === 'image' || dest === 'font' || /\.(webp|jpg|jpeg|png|svg|woff2?)$/i.test(url.pathname)) { e.respondWith(cacheFirst(req)); return; }
});
