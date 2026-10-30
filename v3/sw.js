/* DORR v3 — offline cache. Core files are stored on first visit; everything
   else is cached as it is used, so later visits open fast even on a weak connection. */
const PREFIX = 'dorr-v3-';
const CACHE = PREFIX + '3';
const CORE = ["./", "index.html", "manifest.webmanifest", "css/style.css", "css/fonts.css", "js/main.js", "js/rooms.js", "js/world.js", "img/events.jpg", "../vendor/js/gsap.min.js", "../vendor/js/ScrollTrigger.min.js", "../vendor/js/lenis.min.js", "../vendor/js/three.min.js", "../vendor/fonts/libre-caslon-condensed-latin-wght-normal.woff2", "../vendor/fonts/libre-caslon-condensed-latin-wght-italic.woff2", "../vendor/fonts/pinyon-script-latin-400-normal.woff2", "../vendor/fonts/jost-latin-wght-normal.woff2"];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    // pages: fresh when online, cached when not
    e.respondWith(fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
      return res;
    }).catch(() => caches.match(req).then((hit) => hit || caches.match('./'))));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  })));
});
