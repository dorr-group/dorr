/* DORR v8 service worker: precache core, network-first navigation, cache-first static assets. */
var VERSION = 'dorr-v8-1';
var CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/fonts.css',
  './css/main.css',
  './js/weave.js',
  './js/loom.js',
  './js/main.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './img/hero.webp',
  './img/hero-m.webp',
  './img/oyster.webp',
  './img/mist.webp',
  './img/intro.webp',
  './img/chef.webp',
  './img/dada.webp',
  './img/sayah.webp',
  './img/dejavu.webp',
  './img/m04.webp',
  './img/randezvou.webp',
  './img/vision.webp',
  './img/vision-m.webp',
  '../vendor/js/gsap.min.js',
  '../vendor/js/ScrollTrigger.min.js',
  '../vendor/js/lenis.min.js',
  '../vendor/fonts/michroma-latin-400-normal.woff2',
  '../vendor/fonts/marcellus-latin-400-normal.woff2'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(CORE); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('dorr-v8-') === 0 && k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(function (res) {
      var copy = res.clone();
      caches.open(VERSION).then(function (c) { c.put(req, copy); });
      return res;
    }).catch(function () {
      return caches.match(req).then(function (r) { return r || caches.match('./index.html'); });
    }));
    return;
  }
  e.respondWith(caches.match(req).then(function (hit) {
    if (hit) return hit;
    return fetch(req).then(function (res) {
      if (res && res.ok) { var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(req, copy); }); }
      return res;
    });
  }));
});
