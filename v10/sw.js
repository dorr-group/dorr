/* DORR v10 service worker — offline after the first visit */
const CACHE = 'dorr-v10-2';
const CORE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/fonts.css?v=20261031v10',
  'css/style.css?v=20261031v10',
  'js/main.js?v=20261031v10',
  'js/sound.js?v=20261031v10',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  '../vendor/js/gsap.min.js',
  '../vendor/js/ScrollTrigger.min.js',
  '../vendor/js/lenis.min.js',
  '../vendor/fonts/archivo-latin-standard-normal.woff2',
  '../vendor/fonts/ibm-plex-mono-latin-400-normal.woff2',
  '../vendor/fonts/ibm-plex-mono-latin-500-normal.woff2',
  '../vendor/three/build/three.module.js',
  '../vendor/three/examples/jsm/postprocessing/EffectComposer.js',
  '../vendor/three/examples/jsm/postprocessing/RenderPass.js',
  '../vendor/three/examples/jsm/postprocessing/ShaderPass.js',
  '../vendor/three/examples/jsm/postprocessing/MaskPass.js',
  '../vendor/three/examples/jsm/postprocessing/Pass.js',
  '../vendor/three/examples/jsm/postprocessing/UnrealBloomPass.js',
  '../vendor/three/examples/jsm/postprocessing/OutputPass.js',
  '../vendor/three/examples/jsm/shaders/CopyShader.js',
  '../vendor/three/examples/jsm/shaders/LuminosityHighPassShader.js',
  '../vendor/three/examples/jsm/shaders/OutputShader.js',
  '../vendor/three/examples/jsm/utils/BufferGeometryUtils.js',
  '../vendor/three/examples/jsm/objects/Reflector.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('dorr-v10-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // never intercept audio / media or ranged requests: let the browser stream them
  if (req.headers.has('range') || req.destination === 'audio' || req.destination === 'video' || /\.(mp3|m4a|aac|ogg|oga|wav|webm|mp4)$/i.test(url.pathname)) return;

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

  // scripts and styles: network first (fresh code when online), cache as the fallback
  if (req.destination === 'script' || req.destination === 'style' || /\.(m?js|css)$/.test(url.pathname)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match(req, { ignoreSearch: true })))
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
