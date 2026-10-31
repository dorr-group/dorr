/* DORR v10 — inspired by the craft of Igloo Inc (abeto, 2024): material quality, light,
   scroll-driven camera and point-and-line rendering. Every object, composition and layout
   here is DORR's own (see the originality checklist at the top of index.html).
   A: a pearl shell of carved nacre blocks rests in still water, light glowing through every
      joint. Scroll opens it on its hinge; the pearl inside is DORR (tap it).
   B: five brand pearls built of points and lines travel past like beads, their details
      written on a ring of text around each one (tap one for its page).
   C: the Services Company: one quiet thread of light carrying a single pearl.
   D: Future Vision: an orrery, the pearl at its centre, the brands on their orbits.
      The cursor tilts it.
   Scene changes pass through a nacre-light bloom with a water-ripple refraction. */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { Sound } from './sound.js?v=20261031v10b';

const root = document.documentElement;
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

/* ------------------------------------------------------------------ helpers */
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (p, a, b) => clamp((p - a) / (b - a));
const smooth = (t) => t * t * (3 - 2 * t);
const sstep = (a, b, x) => smooth(clamp((x - a) / (b - a)));
const inOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const pad2 = (n) => String(n).padStart(2, '0');
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const rand = (a, b) => a + rnd() * (b - a);
const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
const vnoise = (x, y) => {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};
const fbm = (x, y, o = 5) => { let f = 0, amp = 0.5, fr = 1; for (let i = 0; i < o; i++) { f += amp * vnoise(x * fr, y * fr); fr *= 2.03; amp *= 0.5; } return f; };

/* ------------------------------------------------------------------ UI basics */
const mail = $('[data-mail]');
$('[data-copy]').addEventListener('click', (e) => {
  const btn = e.currentTarget;
  const fallback = () => {
    const r = document.createRange(); r.selectNodeContents(mail);
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    btn.textContent = 'Selected';
  };
  try { navigator.clipboard.writeText(mail.textContent.trim()).then(() => { btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = 'Copy'; }, 1800); }, fallback); } catch (err) { fallback(); }
});
const form = $('[data-form]');
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const note = $('[data-note]');
  let ok = true;
  $$('input[required]', form).forEach((input) => {
    const valid = input.value.trim() && (input.type !== 'email' || /.+@.+\..+/.test(input.value));
    input.closest('.field').classList.toggle('is-invalid', !valid);
    if (!valid) ok = false;
  });
  if (!ok) { note.textContent = 'Please add your name and a valid email address.'; return; }
  const data = new FormData(form);
  const to = mail.textContent.trim();
  const body = `Name: ${data.get('name')}\nEmail: ${data.get('email')}\n\n${data.get('message') || ''}`;
  note.textContent = `Opening your email app with this message. If nothing opens, write to ${to}.`;
  location.href = `mailto:${to}?subject=${encodeURIComponent('Enquiry — DORR')}&body=${encodeURIComponent(body)}`;
});

/* ------------------------------------------------------------------ sound: choice + toggle */
const soundBtn = $('[data-sound-toggle]'), soundLabel = $('[data-sound-label]');
const paintSound = (on) => { soundBtn.setAttribute('aria-pressed', on ? 'true' : 'false'); soundLabel.textContent = on ? 'Sound on' : 'Sound off'; soundBtn.setAttribute('aria-label', on ? 'Turn sound off' : 'Turn sound on'); };
Sound.onChange(paintSound);
paintSound(false);
soundBtn.addEventListener('click', () => Sound.setEnabled(!Sound.enabled));
document.addEventListener('visibilitychange', () => Sound.setHidden(document.hidden));
// the loader ends with a choice; that click is the gesture that unlocks audio
function askSound() {
  return new Promise((resolve) => {
    const boot = $('[data-boot]'), box = $('[data-choice]');
    if (!boot || !box) { resolve(); return; }
    boot.classList.add('is-asking');
    boot.removeAttribute('aria-hidden');
    boot.setAttribute('role', 'dialog');
    boot.setAttribute('aria-label', 'Sound');
    box.hidden = false;
    const on = $('[data-sound-on]', box), off = $('[data-sound-off]', box);
    if (window.gsap && !reduce) gsap.fromTo(box.children, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.7, stagger: 0.1, ease: 'power2.out' });
    (Sound.remembered() === 'off' ? off : on).focus({ preventScroll: true });
    const done = (val) => { Sound.setEnabled(val); boot.classList.remove('is-asking'); box.hidden = true; resolve(val); };
    on.addEventListener('click', () => done(true), { once: true });
    off.addEventListener('click', () => done(false), { once: true });
  });
}

/* typed reveal with a caret: the HUD's way of writing */
function scramble(el, text, dur = 0.6) {
  if (!el) return;
  if (reduce) { el.textContent = text; return; }
  const n = text.length, t0 = performance.now(), id = (el._sid = (el._sid || 0) + 1);
  const tick = (now) => {
    if (el._sid !== id) return;
    const t = Math.min(1, (now - t0) / (dur * 1000));
    el.textContent = t < 1 ? `${text.slice(0, Math.floor(t * n))}_` : text;
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/* ------------------------------------------------------------------ sheets (a pearl, opened) */
const mainEl = $('main');
const sheetEls = { dorr: $('[data-sheet="dorr"]'), brand: $('[data-sheet="brand"]') };
const brandLis = $$('[data-brand]');
const BRANDS = brandLis.map((li) => ({
  name: li.querySelector('b').textContent.trim(),
  type: li.dataset.type,
  text: li.querySelector('p').textContent.trim(),
}));
const SH = { kind: null, idx: 0, last: null, hooks: {} };
const idxBtns = $$('[data-b-index] button');
idxBtns.forEach((x, k) => x.addEventListener('click', () => setBrand(k)));
const bEl = { num: $('[data-b-num]'), name: $('[data-b-name]'), type: $('[data-b-type]'), text: $('[data-b-text]'), prev: $('[data-prev-name]'), next: $('[data-next-name]') };
function fillBrand(i, animate) {
  const b = BRANDS[i];
  bEl.num.textContent = pad2(i + 1);
  if (animate) scramble(bEl.name, b.name, 0.7); else bEl.name.textContent = b.name;
  bEl.type.textContent = b.type;
  bEl.text.textContent = b.text;
  bEl.prev.textContent = BRANDS[(i + 4) % 5].name;
  bEl.next.textContent = BRANDS[(i + 1) % 5].name;
  idxBtns.forEach((x, k) => { x.classList.toggle('is-now', k === i); x.setAttribute('aria-current', k === i ? 'true' : 'false'); });
  const build = $('[data-b-build-row]');
  if (SH.hooks.fill) { build.hidden = false; SH.hooks.fill(i); } else build.hidden = true;
}
const anim = () => window.gsap && !reduce;
function openSheet(kind, i = 0) {
  if (SH.hooks.enter && SH.hooks.enter(kind, i)) return;
  if (SH.kind === 'brand' && kind === 'brand') { setBrand(i); return; }
  if (SH.kind) closeSheet(true);
  SH.kind = kind; SH.idx = i;
  SH.last = document.activeElement;
  const el = sheetEls[kind];
  if (kind === 'brand') fillBrand(i, false);
  el.hidden = false;
  mainEl.inert = true;
  const panel = $('.sheet__panel', el);
  panel.scrollTop = 0;
  if (anim()) {
    const phone = innerWidth < 760;
    gsap.killTweensOf(panel);
    gsap.fromTo(panel, phone ? { yPercent: 18, autoAlpha: 0 } : { xPercent: 14, autoAlpha: 0 }, { xPercent: 0, yPercent: 0, autoAlpha: 1, duration: 0.9, ease: 'power3.out', delay: 0.25 });
    gsap.fromTo(panel.children, { y: 14, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.7, stagger: 0.05, ease: 'power2.out', delay: 0.4 });
  }
  scramble($('.sheet__name', el), kind === 'brand' ? BRANDS[i].name : 'DORR', 0.9);
  Sound.pearl(kind === 'brand' ? i : -1);
  Sound.open();
  Sound.duck(true);
  $('[data-close]', el).focus({ preventScroll: true });
  if (SH.hooks.open) SH.hooks.open(kind, i);
}
function closeSheet(instant) {
  if (!SH.kind) return;
  const kind = SH.kind;
  const el = sheetEls[kind];
  SH.kind = null;
  mainEl.inert = false;
  const panel = $('.sheet__panel', el);
  if (instant === true || !anim()) el.hidden = true;
  else {
    gsap.killTweensOf(panel);
    gsap.to(panel, { autoAlpha: 0, x: innerWidth < 760 ? 0 : 40, y: innerWidth < 760 ? 40 : 0, duration: 0.5, ease: 'power2.in', onComplete: () => { el.hidden = true; gsap.set(panel, { x: 0, y: 0 }); } });
  }
  if (instant !== true) Sound.close();
  Sound.duck(false);
  if (SH.hooks.close) SH.hooks.close(kind);
  if (SH.last && SH.last.focus && instant !== true) SH.last.focus({ preventScroll: true });
}
function setBrand(i) {
  SH.idx = (i + 5) % 5;
  fillBrand(SH.idx, true);
  Sound.pearl(SH.idx);
  const panel = $('.sheet__panel', sheetEls.brand);
  if (anim()) gsap.fromTo($$('.sheet__type, .sheet__fig, .sheet__body', panel), { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.06, ease: 'power2.out' });
  if (SH.hooks.brand) SH.hooks.brand(SH.idx);
}
brandLis.forEach((li, i) => li.querySelector('button').addEventListener('click', () => openSheet('brand', i)));
$('[data-open-dorr]').addEventListener('click', () => openSheet('dorr'));
$$('[data-close]').forEach((b) => b.addEventListener('click', () => closeSheet()));
$('[data-prev]').addEventListener('click', () => setBrand(SH.idx - 1));
$('[data-next]').addEventListener('click', () => setBrand(SH.idx + 1));
$('[data-goto-brands]').addEventListener('click', () => {
  closeSheet();
  if (SH.hooks.gotoBrands) SH.hooks.gotoBrands(); else $('[data-brands]').scrollIntoView();
});
Object.values(sheetEls).forEach((el) => el.addEventListener('click', (e) => { if (e.target === el) closeSheet(); }));
window.addEventListener('keydown', (e) => {
  if (!SH.kind) return;
  if (e.key === 'Escape') { e.preventDefault(); closeSheet(); return; }
  if (SH.kind === 'brand' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !/input|textarea/i.test(e.target.tagName)) { setBrand(SH.idx + (e.key === 'ArrowRight' ? 1 : -1)); return; }
  if (e.key === 'Tab') {
    const f = $$('button, a[href], [tabindex]:not([tabindex="-1"])', sheetEls[SH.kind]).filter((x) => !x.closest('[hidden]'));
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});

const goStatic = () => {
  root.classList.add('static');
  askSound().then(() => $('[data-boot]')?.remove());
};

/* ------------------------------------------------------------------ GLSL bits */
const ORIENT = 'vec3 orientTint(float x){ return 0.5 + 0.5 * cos(6.28318 * (x + vec3(0.0, 0.33, 0.67))); }';
const NOISE = /* glsl */`
  float hash31(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float vnoise3(vec3 x){
    vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash31(i), hash31(i + vec3(1,0,0)), f.x), mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x), mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x), f.y), f.z);
  }`;

/* ================================================================== the 3D film */
async function main() {
  if (reduce || !window.gsap || !window.ScrollTrigger) { goStatic(); return; }
  const canvas = $('[data-gl]');
  // probe for WebGL quietly first, so a browser without it gets the readable page, not console errors
  try { const t = document.createElement('canvas'); if (!(t.getContext('webgl2') || t.getContext('webgl'))) { goStatic(); return; } } catch (e) { goStatic(); return; }
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const isPhone = innerWidth < 760 || (coarse && Math.min(screen.width, screen.height) < 820);
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !isPhone, powerPreference: 'high-performance', stencil: false });
  } catch (e) { goStatic(); return; }
  if (!renderer.getContext()) { goStatic(); return; }
  const DPR = Math.min(window.devicePixelRatio || 1, isPhone ? 1.5 : 1.75);
  renderer.setPixelRatio(DPR);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.82;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const bootMsg = $('[data-boot-msg]');
  const step = async (msg) => { if (bootMsg) bootMsg.textContent = msg; await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))); };

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.05, 400);
  scene.fog = new THREE.FogExp2(new THREE.Color('#c9c1b6'), 0.03);
  const FOGD = { value: 0.03 };

  /* --------------------------------------------- environment (our own light studio) */
  const pmrem = new THREE.PMREMGenerator(renderer);
  {
    const s = new THREE.Scene();
    const sky = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `varying vec3 vP; void main(){ float h = vP.y;
        vec3 top = vec3(1.0, 0.96, 0.9) * 0.8, hor = vec3(0.55, 0.51, 0.47), bot = vec3(0.16, 0.14, 0.12);
        vec3 c = h > 0.0 ? mix(hor, top, pow(h, 0.6)) : mix(hor, bot, pow(-h, 0.5));
        gl_FragColor = vec4(c, 1.0); }`,
    }));
    s.add(sky);
    const panel = (w, h, col, k, x, y, z) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(k), side: THREE.DoubleSide }));
      m.position.set(x, y, z); m.lookAt(0, 0, 0); s.add(m);
    };
    panel(34, 14, '#fff7ec', 1.7, 0, 30, 6);
    panel(8, 22, '#fff1e2', 3.0, -26, 6, 16);
    panel(12, 12, '#ffe3ee', 1.7, 24, 5, -10);
    panel(12, 12, '#e2f2ff', 1.5, 20, 3, 22);
    panel(44, 6, '#ffffff', 1.6, 0, 9, -30);
    scene.environment = pmrem.fromScene(s, 0.035).texture;
  }

  /* --------------------------------------------- a procedural detail normal map (frost / grain) */
  const detailTex = (() => {
    const N = isPhone ? 192 : 256;
    const H = new Float32Array(N * N);
    const hi = (x, y) => { let h = Math.imul(x, 374761393) + Math.imul(y, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
    const tn = (x, y, per) => {
      const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      const x0 = ((xi % per) + per) % per, x1 = (x0 + 1) % per, y0 = ((yi % per) + per) % per, y1 = (y0 + 1) % per;
      const a = hi(x0, y0), b = hi(x1, y0), c = hi(x0, y1), d = hi(x1, y1);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      let h = 0, amp = 0.5;
      for (const f of [4, 8, 16, 32, 64]) { h += amp * tn((x / N) * f, (y / N) * f, f); amp *= 0.55; }
      h -= 0.35 * Math.pow(tn((x / N) * 24, (y / N) * 24, 24), 5);
      H[y * N + x] = h;
    }
    const c = document.createElement('canvas'); c.width = c.height = N;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(N, N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dx = H[y * N + ((x + 1) % N)] - H[y * N + ((x - 1 + N) % N)];
      const dy = H[((y + 1) % N) * N + x] - H[((y - 1 + N) % N) * N + x];
      let nx = -dx * 5, ny = -dy * 5, nz = 1;
      const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      const o = (y * N + x) * 4;
      img.data[o] = (nx * 0.5 + 0.5) * 255; img.data[o + 1] = (ny * 0.5 + 0.5) * 255; img.data[o + 2] = (nz * 0.5 + 0.5) * 255; img.data[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    return t;
  })();

  await step('Carving the shell');

  /* --------------------------------------------- sky dome (follows the camera) */
  const skyU = { uTop: { value: new THREE.Color() }, uHor: { value: scene.fog.color }, uBot: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3(0.45, 0.35, -0.82).normalize() }, uSun: { value: new THREE.Color('#fff4e6') } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 20), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
    vertexShader: 'varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uTop, uHor, uBot, uSunDir, uSun; varying vec3 vD;
      void main(){ vec3 d = normalize(vD); float h = d.y;
        vec3 c = h > 0.0 ? mix(uHor, uTop, pow(smoothstep(0.0, 0.85, h), 1.35)) : mix(uHor, uBot, smoothstep(0.0, -0.5, h) * 0.5);
        float s = max(dot(d, uSunDir), 0.0); c += uSun * (pow(s, 5.0) * 0.18 + pow(s, 80.0) * 0.35);
        gl_FragColor = vec4(c, 1.0); }`,
  }));
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  scene.add(sky);

  /* --------------------------------------------- lights */
  const hemi = new THREE.HemisphereLight('#fff6ec', '#6f665a', 0.22);
  scene.add(hemi);
  const key = new THREE.DirectionalLight('#ffeedb', 1.9);
  key.position.set(7.5, 5.5, 3.5);
  key.castShadow = true;
  key.shadow.mapSize.set(isPhone ? 1024 : 2048, isPhone ? 1024 : 2048);
  Object.assign(key.shadow.camera, { left: -5.5, right: 5.5, top: 5.5, bottom: -5.5, near: 2, far: 26 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.025;
  key.shadow.radius = 4;
  scene.add(key, key.target);

  /* ============================================================ A · the shell */
  const stageA = new THREE.Group();
  scene.add(stageA);

  // ---- the shell: two valves of carved, fitted blocks, nacre inside, light in every joint
  const R = 2.7, FAN = THREE.MathUtils.degToRad(66), HH = 0.8, U0 = 0.07, T = 0.2;
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3(), tmpD = new THREE.Vector3();
  const surf = (sign, phi, u, out) => {
    const k = phi / FAN;
    const r = R * (1 - 0.09 * k * k) * (U0 + (1 - U0) * u);
    const amp = sign > 0 ? 0.74 : 1.0;
    const h = HH * amp * Math.pow(Math.sin(Math.PI * clamp(u)), 0.72) * Math.pow(Math.max(0, 1 - k * k), 0.5);
    return out.set(Math.sin(phi) * r, sign * h, Math.cos(phi) * r);
  };
  const surfN = (sign, phi, u, out) => {
    const e = 1e-3;
    surf(sign, phi, Math.min(1, u + e), tmpA); surf(sign, phi, Math.max(0, u - e), tmpB); tmpC.subVectors(tmpA, tmpB);
    surf(sign, Math.min(FAN, phi + e), u, tmpA); surf(sign, Math.max(-FAN, phi - e), u, tmpB); tmpD.subVectors(tmpA, tmpB);
    out.crossVectors(tmpC, tmpD).normalize();
    if (out.y * sign < 0) out.negate();
    if (!Number.isFinite(out.x)) out.set(0, sign, 0);
    return out;
  };
  // a rounded block whose vertices crowd towards its edges, so bevels stay crisp
  const cluster = (s) => Math.sign(s) * 0.5 * (1 - Math.pow(1 - Math.abs(s) * 2, 1.9));
  const roundedBlock = (w, l, t, rad, segs = 10) => {
    const g = new THREE.BoxGeometry(1, 1, 1, segs, segs, 3);
    g.deleteAttribute('uv'); g.deleteAttribute('normal');
    const p = g.attributes.position;
    const h = [w / 2, l / 2, t / 2];
    const v = [0, 0, 0], inner = [0, 0, 0];
    for (let i = 0; i < p.count; i++) {
      v[0] = cluster(p.getX(i)) * w; v[1] = cluster(p.getY(i)) * l; v[2] = cluster(p.getZ(i)) * t;
      let dl = 0;
      for (let a = 0; a < 3; a++) { inner[a] = clamp(v[a], -h[a] + rad, h[a] - rad); dl += (v[a] - inner[a]) ** 2; }
      dl = Math.sqrt(dl);
      if (dl > 1e-6) for (let a = 0; a < 3; a++) v[a] = inner[a] + ((v[a] - inner[a]) / dl) * rad;
      p.setXYZ(i, v[0], v[1], v[2]);
    }
    return mergeVertices(g, 1e-5);
  };
  const P = new THREE.Vector3(), N = new THREE.Vector3();
  const makeBlock = (sign, p0, p1, u0, u1, t, crown, tiltA, tiltB) => {
    const rm = R * (U0 + (1 - U0) * (u0 + u1) / 2);
    const w = Math.max(0.05, rm * (p1 - p0)), l = Math.max(0.05, R * (1 - U0) * (u1 - u0));
    const g = roundedBlock(w, l, t, Math.min(0.03, 0.25 * Math.min(w, l, t)));
    const pos = g.attributes.position;
    const n = pos.count;
    const aEdge = new Float32Array(n), aOut = new Float32Array(n), aTint = new Float32Array(n).fill(rnd());
    for (let i = 0; i < n; i++) {
      const a = pos.getX(i) / w + 0.5, b = pos.getY(i) / l + 0.5, c = pos.getZ(i) / t + 0.5;
      const phi = p0 + a * (p1 - p0), u = u0 + b * (u1 - u0);
      surf(sign, phi, u, P); surfN(sign, phi, u, N);
      const bulge = crown * Math.pow(Math.max(0, 1 - (2 * a - 1) ** 2), 0.8) * (1 - 0.35 * (2 * b - 1) ** 2);
      const chip = (fbm(P.x * 2.3 + P.y * 2 + 9, P.z * 2.3 - P.y * 2, 3) - 0.5) * 0.07 + (fbm(P.x * 9 + 3, P.z * 9 - P.y * 5, 2) - 0.5) * 0.02;
      const off = c * (t + bulge + (a - 0.5) * tiltA + (b - 0.5) * tiltB + chip);
      pos.setXYZ(i, P.x + N.x * off, P.y + N.y * off, P.z + N.z * off);
      aEdge[i] = Math.max(Math.abs(2 * a - 1), Math.abs(2 * b - 1));
      aOut[i] = c;
    }
    g.setAttribute('aEdge', new THREE.BufferAttribute(aEdge, 1));
    g.setAttribute('aOut', new THREE.BufferAttribute(aOut, 1));
    g.setAttribute('aTint', new THREE.BufferAttribute(aTint, 1));
    // uv by planar projection (the detail map is a frost grain; any consistent mapping works)
    const uv = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { uv[i * 2] = pos.getX(i) * 1.6 + pos.getY(i) * 0.5; uv[i * 2 + 1] = pos.getZ(i) * 1.6 - pos.getY(i) * 0.5; }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.computeVertexNormals();
    return g;
  };
  // a smooth sheet following the valve (nacre lining, and the light layer under the blocks)
  const valveSheet = (sign, off, nu, nv, inward) => {
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) {
      const u = i / nu, phi = -FAN + (2 * FAN * j) / nv;
      surf(sign, phi, u, P); surfN(sign, phi, u, N);
      pos.push(P.x + N.x * off, P.y + N.y * off, P.z + N.z * off);
      uv.push(u, j / nv);
    }
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
      const a = i * (nv + 1) + j, b = a + nv + 1;
      if ((sign > 0) === inward) idx.push(a, a + 1, b, b, a + 1, b + 1); else idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  };

  const blockU = { uGlow: { value: 1 }, uGlowCol: { value: new THREE.Color('#ffcf9e') }, uRim: { value: new THREE.Color('#fff5e8') } };
  const blockMat = new THREE.MeshPhysicalMaterial({
    color: '#b2a797', roughness: 0.34, metalness: 0,
    clearcoat: 0.3, clearcoatRoughness: 0.42,
    sheen: 0.3, sheenRoughness: 0.5, sheenColor: new THREE.Color('#fff0e2'),
    iridescence: isPhone ? 0 : 0.28, iridescenceIOR: 1.35, iridescenceThicknessRange: [140, 420],
    normalMap: detailTex, normalScale: new THREE.Vector2(0.35, 0.35),
    envMapIntensity: 0.42,
  });
  blockMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, blockU);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aEdge; attribute float aTint; attribute float aOut;
        varying float vEdge; varying float vTint; varying float vOut; varying vec3 vOPos; varying vec3 vRad;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vEdge = aEdge; vTint = aTint; vOut = aOut; vOPos = position;
        vRad = normalize(normalMatrix * normalize(vec3(position.x, 0.0, position.z) + 1e-4));`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uGlow; uniform vec3 uGlowCol; uniform vec3 uRim;
        varying float vEdge; varying float vTint; varying float vOut; varying vec3 vOPos; varying vec3 vRad;
        ${NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float mott = vnoise3(vOPos * 2.7) * 0.55 + vnoise3(vOPos * 9.0) * 0.3 + vnoise3(vOPos * 31.0) * 0.15;
        diffuseColor.rgb *= mix(0.88, 1.04, vTint) * mix(0.88, 1.05, mott) * (1.0 - 0.22 * pow(vEdge, 5.0) * vOut);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + (mott - 0.5) * 0.35, 0.08, 1.0);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        float rr = length(vOPos.xz);
        float growth = sin(rr * 58.0 + vnoise3(vOPos * 2.0) * 5.0);
        normal = normalize(normal - vRad * growth * 0.09 * smoothstep(0.55, 1.0, vOut));`)
      .replace('#include <opaque_fragment>', `
        float fres = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 3.0);
        float edge = pow(vEdge, 12.0);
        float inner = 1.0 - vOut;
        vec3 sss = uGlowCol * uGlow * (edge * inner * inner * 0.9 + 0.02);
        outgoingLight += sss + uRim * fres * 0.12;
        #include <opaque_fragment>`);
  };

  const nacreTex = (() => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 32;
    const x = c.getContext('2d'); const img = x.createImageData(512, 32);
    for (let i = 0; i < 512; i++) for (let j = 0; j < 32; j++) {
      const u = i / 512;
      const v = 0.5 + 0.28 * Math.sin(u * 92 + fbm(u * 6, j / 32 * 3, 3) * 7) + 0.22 * (fbm(u * 20, j / 8, 3) - 0.5);
      const o = (j * 512 + i) * 4; const g = clamp(v) * 255;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = g; img.data[o + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    return new THREE.CanvasTexture(c);
  })();
  const nacreMat = new THREE.MeshPhysicalMaterial({
    color: '#cfc5bc', roughness: 0.2, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.06,
    iridescence: 1, iridescenceIOR: 1.8, iridescenceThicknessRange: [200, 900], iridescenceThicknessMap: nacreTex,
    sheen: 0.5, sheenColor: new THREE.Color('#ffc9de'), side: THREE.DoubleSide, envMapIntensity: 1.1,
  });
  nacreMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vNUv; varying vec3 vOPos;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvNUv = uv; vOPos = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec2 vNUv; varying vec3 vOPos;\n${NOISE}\n${ORIENT}`)
      .replace('#include <opaque_fragment>', `
        float vz = saturate(abs(dot(normal, normalize(vViewPosition))));
        float band = sin(vNUv.x * 64.0 + vnoise3(vOPos * 3.0) * 6.0) * 0.5 + 0.5;
        vec3 tn = orientTint(band * 0.35 + (1.0 - vz) * 0.8 + vNUv.y * 0.3 + 0.05);
        outgoingLight *= mix(vec3(1.0), 0.74 + 0.52 * tn, 0.42);
        outgoingLight *= 0.95 + 0.07 * band;
        #include <opaque_fragment>`);
  };
  const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd9b0'), side: THREE.DoubleSide });
  const GLOWBASE = new THREE.Color('#ffd9b0');

  const shell = new THREE.Group();
  stageA.add(shell);
  const topValve = new THREE.Group(), botValve = new THREE.Group();
  shell.add(topValve, botValve);
  const ROWS = [0, 0.17, 0.34, 0.5, 0.66, 0.83, 1.0];
  const PER = [5, 15, 15, 15, 15, 15];
  const GAP = 0.026;
  let pieceCount = 0;
  const valveMeshes = [];
  for (const [valve, sign] of [[topValve, 1], [botValve, -1]]) {
    const geos = [];
    for (let r = 0; r < ROWS.length - 1; r++) {
      const n = PER[r];
      for (let k = 0; k < n; k++) {
        const u0 = ROWS[r], u1 = ROWS[r + 1];
        const rm = R * (U0 + (1 - U0) * (u0 + u1) / 2);
        const pg = GAP / rm, ug = GAP / (R * (1 - U0));
        const p0 = -FAN + (2 * FAN * k) / n + pg, p1 = -FAN + (2 * FAN * (k + 1)) / n - pg;
        const edgeTaper = 1 - 0.35 * Math.pow(Math.abs((k + 0.5) / n * 2 - 1), 3);
        geos.push(makeBlock(sign, p0, p1, u0 + (r ? ug : 0.004), u1 - (r === ROWS.length - 2 ? 0.004 : ug),
          T * rand(0.88, 1.1) * edgeTaper * (r === 5 ? 0.8 : 1), rand(0.03, 0.05), rand(-0.02, 0.02), rand(-0.02, 0.02)));
        pieceCount++;
      }
    }
    const mesh = new THREE.Mesh(mergeGeometries(geos), blockMat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    valve.add(mesh);
    valveMeshes.push(mesh);
    geos.forEach((g) => g.dispose());
    const lining = new THREE.Mesh(valveSheet(sign, -0.004, isPhone ? 30 : 46, isPhone ? 44 : 70, true), nacreMat);
    lining.receiveShadow = true;
    valve.add(lining);
    valve.add(new THREE.Mesh(valveSheet(sign, 0.068, 30, 60, false), glowMat));
  }
  // hinge barrel with turned rings
  {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 1.5, 32, 1), blockMat);
    bar.rotation.z = Math.PI / 2; bar.position.set(0, 0, -0.17);
    shell.add(bar);
    for (let i = 0; i < 5; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.083, 0.014, 10, 36), blockMat);
      ring.rotation.y = Math.PI / 2; ring.position.set(-0.6 + i * 0.3, 0, -0.17);
      shell.add(ring);
    }
  }
  // the seam where the valves meet, glowing
  const rimPts = [];
  for (let i = 0; i <= 10; i++) rimPts.push(surf(1, -FAN, i / 10, new THREE.Vector3()));
  for (let i = 1; i <= 30; i++) rimPts.push(surf(1, -FAN + (2 * FAN * i) / 30, 1, new THREE.Vector3()));
  for (let i = 9; i >= 0; i--) rimPts.push(surf(1, FAN, i / 10, new THREE.Vector3()));
  const seam = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rimPts), 160, 0.016, 6, false), glowMat);
  botValve.add(seam);

  // the pearl: DORR
  const PR = 0.5;
  const pearlU = { uLum: { value: 0.2 } };
  const pearlMat = new THREE.MeshPhysicalMaterial({
    color: '#d9cfc6', roughness: 0.1, metalness: 0.04, clearcoat: 1, clearcoatRoughness: 0.03,
    iridescence: 1, iridescenceIOR: 1.8, iridescenceThicknessRange: [250, 800],
    sheen: 1, sheenRoughness: 0.35, sheenColor: new THREE.Color('#ffcfe0'), envMapIntensity: 1.35,
  });
  pearlMat.onBeforeCompile = (sh) => {
    sh.uniforms.uLum = pearlU.uLum;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vOPos;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvOPos = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uLum; varying vec3 vOPos;\n${NOISE}\n${ORIENT}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float orient = vnoise3(vOPos * 3.0) * 0.6 + vnoise3(vOPos * 7.0) * 0.4;
        diffuseColor.rgb *= mix(vec3(1.0, 0.965, 0.95), vec3(0.965, 0.98, 1.0), orient);`)
      .replace('#include <opaque_fragment>', `
        float fz = saturate(dot(normal, normalize(vViewPosition)));
        float gz = 1.0 - fz;
        vec3 tn = orientTint(gz * 0.9 + orient * 0.7 + 0.08);
        outgoingLight *= mix(vec3(1.0), 0.78 + 0.44 * tn, 0.6 * smoothstep(0.05, 0.85, gz));
        outgoingLight += vec3(1.0, 0.92, 0.84) * uLum * (0.05 + 0.3 * pow(fz, 2.0));
        #include <opaque_fragment>`);
  };
  const pearl = new THREE.Mesh(new THREE.SphereGeometry(PR, isPhone ? 64 : 96, isPhone ? 48 : 72), pearlMat);
  const pearlLocal = new THREE.Vector3();
  surf(-1, 0, 0.45, pearlLocal);
  pearlLocal.y += PR + 0.02;
  pearl.position.copy(pearlLocal);
  pearl.castShadow = true;
  shell.add(pearl);
  const softTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d');
    const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,246,236,1)'); gr.addColorStop(0.3, 'rgba(255,236,220,0.4)'); gr.addColorStop(1, 'rgba(255,236,220,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false }));
  halo.scale.setScalar(2.8);
  pearl.add(halo);
  const pearlLight = new THREE.PointLight('#ffe9d6', 0, 6, 2);
  pearlLight.position.set(0, 0.9, 0.2);
  pearl.add(pearlLight);
  const pearlHit = new THREE.Mesh(new THREE.SphereGeometry(PR * 1.35, 12, 8), new THREE.MeshBasicMaterial());
  pearlHit.visible = false;
  pearl.add(pearlHit);
  const shellHit = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial());
  shellHit.scale.set(2.4, 1.0, 1.7); shellHit.position.set(0, 0, 1.35); shellHit.visible = false;
  shell.add(shellHit);

  const SHELL_Y = 0.84;
  shell.position.set(0, SHELL_Y, -1.35);
  stageA.updateMatrixWorld(true);
  const pearlWorld = new THREE.Vector3();
  pearl.getWorldPosition(pearlWorld);
  key.target.position.set(0, 0.8, 0);
  // ---- the sea: still, mirror-like water the shell rests in, rings of light spreading from it
  const waterU = { uTime: { value: 0 }, uFogD: FOGD, uFog: { value: scene.fog.color }, uGlow: { value: 0 }, uDeep: { value: new THREE.Color('#4f483f') } };
  const water = new Reflector(new THREE.PlaneGeometry(420, 420), {
    textureWidth: Math.round(innerWidth * DPR * (isPhone ? 0.35 : 0.5)),
    textureHeight: Math.round(innerHeight * DPR * (isPhone ? 0.35 : 0.5)),
    clipBias: 0.003, multisample: 0, color: 0xffffff,
    shader: {
      name: 'DorrWater',
      uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null } },
      vertexShader: 'uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vW; void main(){ vUv = textureMatrix * vec4(position, 1.0); vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uFogD, uGlow; uniform vec3 uFog, uDeep; varying vec4 vUv; varying vec3 vW;
        ${NOISE}
        void main(){
          vec2 q = vW.xz;
          vec2 slope = vec2(vnoise3(vec3(q * 0.8, uTime * 0.22)) - 0.5, vnoise3(vec3(q * 0.8 + 7.0, uTime * 0.22)) - 0.5) * 0.5;
          slope += (vec2(vnoise3(vec3(q * 3.1, uTime * 0.5)), vnoise3(vec3(q * 3.1 + 3.0, uTime * 0.5))) - 0.5) * 0.18;
          float r = length(q * vec2(0.8, 1.1));
          float wave = sin(r * 6.0 - uTime * 1.3);
          float ring = wave * exp(-r * 0.32) * smoothstep(2.2, 3.0, r);
          slope += normalize(q + 1e-4) * ring * 0.45;
          vec3 V = normalize(cameraPosition - vW);
          float fres = 0.1 + 0.9 * pow(1.0 - max(V.y, 0.0), 4.0);
          vec4 uv = vUv; uv.xy += slope * 0.07 * uv.w;
          vec3 refl = texture2DProj(tDiffuse, uv).rgb;
          vec3 col = mix(uDeep, refl, clamp(fres * 1.1 + 0.3, 0.0, 1.0));
          float lit = smoothstep(0.75, 1.0, wave) * exp(-r * 0.45) * smoothstep(2.0, 2.8, r);
          col += vec3(1.0, 0.83, 0.64) * uGlow * (exp(-r * 0.8) * 0.5 + lit * 0.9);
          col = mix(col, uFog, 1.0 - exp(-pow(uFogD * length(cameraPosition - vW), 2.0)));
          gl_FragColor = vec4(col, 1.0);
        }`,
    },
  });
  Object.assign(water.material.uniforms, waterU);
  water.rotation.x = -Math.PI / 2;
  water.position.z = -1.35 + R * 0.5;
  stageA.add(water);

  await step('Threading the pearls');

  /* ============================================================ plexus: points + lines */
  const plexusVert = (lines) => /* glsl */`
    uniform float uTime, uReveal, uScan, uAlpha, uSize, uSplit, uWave, uEcho, uHover, uFogD, uActive, uPix, uInside;
    attribute float aRand; attribute vec2 aK; attribute float aSeg;
    ${lines ? 'attribute vec3 aOther; attribute float aT; attribute vec2 aK2; varying float vT; varying float vR;' : 'attribute float aNode; varying float vNode;'}
    varying float vA;
    vec3 deform(vec3 p, vec2 k){
      p.x += k.x * uSplit;
      if (k.y > 0.5) { float a = uTime * 0.35 * uEcho; float c = cos(a), s = sin(a); p.xz = mat2(c, -s, s, c) * p.xz; }
      p *= 1.0 + uWave * 0.05 * sin(uTime * 1.4 + p.y * 5.0 + atan(p.z, p.x) * 3.0);
      return p;
    }
    void main(){
      vec3 me = deform(position, aK);
      ${lines ? `
      vec3 ot = deform(aOther, aK2);
      vec3 st = aT < 0.5 ? me : ot;
      float th = (st.y * 0.5 + 0.5) * 0.7 + aRand * 0.22 + 0.06;
      #ifdef SEG
        th = aRand * 0.8 + 0.1;
      #endif
      float g = smoothstep(th, th + 0.1, uReveal);
      vec3 p = aT < 0.5 ? me : mix(ot, me, g);
      vT = aT; vR = aRand;` : `
      float th = (me.y * 0.5 + 0.5) * 0.7 + aRand * 0.22;
      #ifdef SEG
        th = aRand * 0.8;
      #endif
      float g = smoothstep(th - 0.06, th, uReveal);
      vec3 p = me + vec3(sin(aRand * 91.0 + uTime * 23.0), cos(aRand * 57.0 + uTime * 19.0), sin(aRand * 33.0 + uTime * 29.0)) * 0.16 * (1.0 - g);
      p *= 1.0 + 0.01 * sin(uTime * 1.3 + aRand * 6.28);
      vNode = aNode;`}
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      vec4 c = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      float front = mix(clamp((mv.z - c.z) * 0.45 + 0.5, 0.0, 1.0), 0.95, uInside);
      #ifdef SEG
        front = 0.8;
      #endif
      float scan = exp(-pow((p.y - uScan) * 8.0, 2.0));
      float seg = 1.0;
      #ifdef SEG
        float dd = abs(aSeg - uActive);
        seg = aSeg < -0.5 ? 0.85 : 0.28 + 0.72 * exp(-dd * dd * 2.5);
      #endif
      float fog = exp(-pow(uFogD * length(mv.xyz), 2.0));
      ${lines
        ? 'vA = uAlpha * step(0.001, g) * (0.1 + 0.42 * front + scan * 0.5 + uHover * 0.15) * (0.75 + 0.25 * sin(uTime * 2.0 + aRand * 40.0)) * seg * fog;'
        : `float tw = 0.6 + 0.4 * sin(uTime * (1.5 + aRand * 3.0) + aRand * 40.0);
      vA = g * uAlpha * (0.22 + 0.78 * front) * (tw + scan * 1.6 + uHover * 0.4) * seg * fog * (aNode < -0.5 ? 0.35 : 1.0);
      gl_PointSize = min(uSize * (0.75 + max(aNode, 0.0) * 1.7 + scan * 0.9 + aRand * 0.5) * (0.6 + 0.4 * seg) / max(-mv.z, 0.05), 26.0 * uPix);
      vA *= smoothstep(0.15, 0.9, -mv.z);`}
      gl_Position = projectionMatrix * mv;
    }`;
  const plexusFragPts = /* glsl */`
    uniform vec3 uColor; varying float vA; varying float vNode;
    void main(){
      vec2 q = gl_PointCoord - 0.5; float d = length(q);
      float disc = smoothstep(0.5, 0.12, d);
      float ring = smoothstep(0.07, 0.0, abs(d - 0.36)) + smoothstep(0.14, 0.04, d);
      float a = vNode > 0.5 ? ring : disc;
      a *= vA;
      if (a < 0.01) discard;
      gl_FragColor = vec4(uColor * (1.0 + max(vNode, 0.0) * 0.25), min(a, 1.0));
    }`;
  const plexusFragLines = /* glsl */`
    uniform vec3 uColor; uniform float uTime; varying float vA; varying float vT; varying float vR;
    void main(){
      float pulse = smoothstep(0.1, 0.0, abs(fract(uTime * 0.3 + vR * 7.0) - vT)) * step(0.7, vR);
      float a = vA * (1.0 + pulse * 3.0);
      if (a < 0.004) discard;
      gl_FragColor = vec4(uColor, min(a, 1.0));
    }`;
  const plexusUniforms = (color) => ({
    uTime: { value: 0 }, uReveal: { value: 0 }, uScan: { value: -2 }, uAlpha: { value: 1 }, uSize: { value: 30 * DPR },
    uSplit: { value: 0 }, uWave: { value: 0 }, uEcho: { value: 0 }, uHover: { value: 0 }, uFogD: FOGD, uActive: { value: 0 }, uPix: { value: DPR }, uInside: { value: 0 },
    uColor: { value: new THREE.Color(color || '#fffaf2').multiplyScalar(1.25) },
  });
  // build Points + LineSegments from points and edges
  const buildPlexus = (pts, edges, opts = {}) => {
    const n = pts.length;
    const pos = new Float32Array(n * 3), aRand = new Float32Array(n), aK = new Float32Array(n * 2), aNode = new Float32Array(n), aSeg = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const q = pts[i];
      pos[i * 3] = q.x; pos[i * 3 + 1] = q.y; pos[i * 3 + 2] = q.z;
      aRand[i] = rnd(); aK[i * 2] = q.side || 0; aK[i * 2 + 1] = q.shell || 0;
      aNode[i] = q.inner ? -1 : (rnd() < (opts.nodes ?? 0.06) ? 1 : 0);
      aSeg[i] = q.seg ?? -1;
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    pg.setAttribute('aRand', new THREE.BufferAttribute(aRand, 1));
    pg.setAttribute('aK', new THREE.BufferAttribute(aK, 2));
    pg.setAttribute('aNode', new THREE.BufferAttribute(aNode, 1));
    pg.setAttribute('aSeg', new THREE.BufferAttribute(aSeg, 1));
    const m = edges.length;
    const lp = new Float32Array(m * 6), lo = new Float32Array(m * 6), lt = new Float32Array(m * 2), lr = new Float32Array(m * 2), lk = new Float32Array(m * 4), lk2 = new Float32Array(m * 4), ls = new Float32Array(m * 2);
    for (let e = 0; e < m; e++) {
      const [a, b] = edges[e];
      const A = pts[a], B = pts[b], r = rnd();
      lp.set([A.x, A.y, A.z, B.x, B.y, B.z], e * 6);
      lo.set([B.x, B.y, B.z, A.x, A.y, A.z], e * 6);
      lt[e * 2] = 0; lt[e * 2 + 1] = 1; lr[e * 2] = lr[e * 2 + 1] = r;
      lk.set([A.side || 0, A.shell || 0, B.side || 0, B.shell || 0], e * 4);
      lk2.set([B.side || 0, B.shell || 0, A.side || 0, A.shell || 0], e * 4);
      ls[e * 2] = ls[e * 2 + 1] = A.seg ?? -1;
    }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(lp, 3));
    lg.setAttribute('aOther', new THREE.BufferAttribute(lo, 3));
    lg.setAttribute('aT', new THREE.BufferAttribute(lt, 1));
    lg.setAttribute('aRand', new THREE.BufferAttribute(lr, 1));
    lg.setAttribute('aK', new THREE.BufferAttribute(lk, 2));
    lg.setAttribute('aK2', new THREE.BufferAttribute(lk2, 2));
    lg.setAttribute('aSeg', new THREE.BufferAttribute(ls, 1));
    const U = plexusUniforms(opts.color);
    const defines = opts.seg ? { SEG: '' } : {};
    const pm = new THREE.ShaderMaterial({ uniforms: U, defines, vertexShader: plexusVert(false), fragmentShader: plexusFragPts, transparent: true, depthWrite: false });
    const lm = new THREE.ShaderMaterial({ uniforms: U, defines, vertexShader: plexusVert(true), fragmentShader: plexusFragLines, transparent: true, depthWrite: false });
    const points = new THREE.Points(pg, pm), lines = new THREE.LineSegments(lg, lm);
    points.frustumCulled = lines.frustumCulled = false;
    const g = new THREE.Group();
    g.add(lines, points);
    return { group: g, U, pts };
  };
  const fib = (n, r, out = [], extra = {}) => {
    for (let i = 0; i < n; i++) {
      const y = 1 - (2 * (i + 0.5)) / n, rad = Math.sqrt(1 - y * y), th = i * 2.399963;
      out.push(Object.assign(new THREE.Vector3(Math.cos(th) * rad * r, y * r, Math.sin(th) * rad * r), extra));
    }
    return out;
  };
  const knn = (pts, k, maxD, from = 0, to = pts.length, set = new Set(), edges = []) => {
    const md2 = maxD * maxD;
    const best = [];
    for (let i = from; i < to; i++) {
      best.length = 0;
      for (let j = from; j < to; j++) {
        if (j === i) continue;
        const d = pts[i].distanceToSquared(pts[j]);
        if (d > md2) continue;
        if (best.length < k) { best.push([d, j]); best.sort((a, b) => a[0] - b[0]); } else if (d < best[k - 1][0]) { best[k - 1] = [d, j]; best.sort((a, b) => a[0] - b[0]); }
      }
      for (const [, j] of best) { const a = Math.min(i, j), b = Math.max(i, j), key = a * 100000 + b; if (!set.has(key)) { set.add(key); edges.push([a, b]); } }
    }
    return edges;
  };
  const sprinkle = (pts, n, r) => { for (let i = 0; i < n; i++) { const v = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)); if (v.lengthSq() > 1) { i--; continue; } pts.push(Object.assign(v.multiplyScalar(r), { inner: true })); } return pts; };
  const DENS = isPhone ? 0.55 : 1;

  // five constructions, one per brand
  const brandBuilders = [
    () => { // DADA: a geodesic pearl, the clearest structure
      const ico = mergeVertices(new THREE.IcosahedronGeometry(1, isPhone ? 2 : 3).deleteAttribute('normal').deleteAttribute('uv'));
      const p = ico.attributes.position, pts = [];
      for (let i = 0; i < p.count; i++) pts.push(new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i)));
      const set = new Set(), edges = [], ix = ico.index.array;
      for (let t = 0; t < ix.length; t += 3) for (const [a, b] of [[ix[t], ix[t + 1]], [ix[t + 1], ix[t + 2]], [ix[t + 2], ix[t]]]) { const lo = Math.min(a, b), hi = Math.max(a, b), k = lo * 100000 + hi; if (!set.has(k)) { set.add(k); edges.push([lo, hi]); } }
      sprinkle(pts, Math.round(90 * DENS), 0.85);
      return buildPlexus(pts, edges);
    },
    () => { // SAYAH: rippling like water
      const pts = fib(Math.round(560 * DENS), 1);
      pts.forEach((v) => v.multiplyScalar(1 + 0.05 * Math.sin(Math.atan2(v.z, v.x) * 6 + v.y * 4)));
      const edges = knn(pts, 3, 0.4);
      sprinkle(pts, Math.round(80 * DENS), 0.85);
      const b = buildPlexus(pts, edges); b.U.uWave.value = 1; return b;
    },
    () => { // DÉJÀ VU: a pearl inside a pearl, turning against each other
      const pts = fib(Math.round(380 * DENS), 1);
      const nOut = pts.length;
      fib(Math.round(170 * DENS), 0.56, pts, { shell: 1 });
      const set = new Set();
      const edges = knn(pts, 3, 0.45, 0, nOut, set);
      knn(pts, 3, 0.4, nOut, pts.length, set, edges);
      for (let i = nOut; i < pts.length; i += 3) { let bj = 0, bd = 1e9; for (let j = 0; j < nOut; j++) { const d = pts[i].distanceToSquared(pts[j]); if (d < bd) { bd = d; bj = j; } } edges.push([bj, i]); }
      const b = buildPlexus(pts, edges); b.U.uEcho.value = 1; return b;
    },
    () => { // M04: a measured globe of meridians and parallels
      const M = isPhone ? 16 : 22, Pn = isPhone ? 9 : 13, pts = [], edges = [];
      for (let pi = 1; pi <= Pn; pi++) {
        const lat = -Math.PI / 2 + (Math.PI * pi) / (Pn + 1);
        for (let mi = 0; mi < M; mi++) { const lon = (2 * Math.PI * mi) / M; pts.push(new THREE.Vector3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon))); }
      }
      const id = (pi, mi) => (pi - 1) * M + (mi % M);
      for (let pi = 1; pi <= Pn; pi++) for (let mi = 0; mi < M; mi++) {
        edges.push([id(pi, mi), id(pi, mi + 1)]);
        if (pi < Pn) { edges.push([id(pi, mi), id(pi + 1, mi)]); if ((mi + pi) % 3 === 0) edges.push([id(pi, mi), id(pi + 1, mi + 1)]); }
      }
      const s = pts.length; pts.push(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 1, 0));
      for (let mi = 0; mi < M; mi += 2) { edges.push([s, id(1, mi)]); edges.push([s + 1, id(Pn, mi)]); }
      sprinkle(pts, Math.round(70 * DENS), 0.8);
      return buildPlexus(pts, edges);
    },
    () => { // RANDEZVOU: two halves that come together and meet
      const all = fib(Math.round(600 * DENS), 1);
      all.forEach((v) => { v.side = v.x < 0 ? -1 : 1; v.addScaledVector(new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)), 0.035); });
      const pts = all.filter((v) => v.side < 0).concat(all.filter((v) => v.side > 0));
      const h = pts.findIndex((v) => v.side > 0);
      const set = new Set();
      const edges = knn(pts, 3, 0.42, 0, h, set);
      knn(pts, 3, 0.42, h, pts.length, set, edges);
      for (let i = 0; i < h; i++) if (Math.abs(pts[i].x) < 0.12) { let bj = h, bd = 1e9; for (let j = h; j < pts.length; j++) { const d = pts[i].distanceToSquared(pts[j]); if (d < bd) { bd = d; bj = j; } } if (bd < 0.12) edges.push([i, bj]); }
      sprinkle(pts, Math.round(70 * DENS), 0.8);
      return buildPlexus(pts, edges);
    },
  ];

  const stageB = new THREE.Group();
  scene.add(stageB);
  const SP = 7.2;
  const scanRingGeo = (() => { const a = []; for (let i = 0; i <= 96; i++) { const t = (i / 96) * Math.PI * 2; a.push(Math.cos(t), 0, Math.sin(t)); } return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(a, 3)); })();
  const rimMat = (alpha) => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { uA: { value: alpha }, uFogD: FOGD },
    vertexShader: 'varying vec3 vN; varying vec3 vV; varying float vF; uniform float uFogD; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vF = exp(-pow(uFogD * length(mv.xyz), 2.0)); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform float uA; varying vec3 vN; varying vec3 vV; varying float vF; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.6); gl_FragColor = vec4(vec3(1.0, 0.97, 0.93) * 1.2, f * uA * vF); }',
  });
  const pearls = BRANDS.map((b, i) => {
    const P = brandBuilders[i]();
    const g = new THREE.Group();
    g.add(P.group);
    const body = new THREE.Mesh(new THREE.SphereGeometry(1.03, 48, 32), rimMat(0.35));
    g.add(body);
    const ring = new THREE.LineLoop(scanRingGeo, new THREE.LineBasicMaterial({ color: new THREE.Color('#fffaf2').multiplyScalar(1.3), transparent: true, opacity: 0, depthWrite: false }));
    g.add(ring);
    const hit = new THREE.Mesh(new THREE.SphereGeometry(1.2, 12, 8), new THREE.MeshBasicMaterial());
    hit.visible = false; hit.userData.brand = i;
    g.add(hit);
    const x0 = 0, y0 = i % 2 ? -0.2 : 0.2;
    g.position.set(i * SP, y0, 0);
    stageB.add(g);
    // three node anchors for the tiny point labels
    const nodes = [];
    for (let k = 0; k < P.pts.length && nodes.length < 3; k += Math.max(1, Math.floor(P.pts.length / 7))) if (!P.pts[k].inner && P.pts[k].z > 0.2) nodes.push(k);
    const nPts = P.pts.filter((q) => !q.inner).length;
    const nLines = P.group.children[0].geometry.attributes.position.count / 2;
    return { g, P, body, ring, hit, x0, y0, i, nodes, rev: 0, nPts, nLines };
  });
  const brandHits = pearls.map((p) => p.hit);
  const innerDorr = (() => {
    const ico = mergeVertices(new THREE.IcosahedronGeometry(1, isPhone ? 3 : 4).deleteAttribute('normal').deleteAttribute('uv'));
    const p = ico.attributes.position, pts = [], set = new Set(), edges = [], ix = ico.index.array;
    for (let i = 0; i < p.count; i++) pts.push(new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i)));
    for (let t = 0; t < ix.length; t += 3) for (const [a, b] of [[ix[t], ix[t + 1]], [ix[t + 1], ix[t + 2]], [ix[t + 2], ix[t]]]) { const lo = Math.min(a, b), hi = Math.max(a, b), k = lo * 100000 + hi; if (!set.has(k)) { set.add(k); edges.push([lo, hi]); } }
    const from = pts.length;
    fib(Math.round(420 * DENS), 0.62, pts, { shell: 1 });
    knn(pts, 3, 0.42, from, pts.length, set, edges);
    sprinkle(pts, Math.round(160 * DENS), 0.95);
    const b = buildPlexus(pts, edges, { color: '#fff1e2' });
    b.U.uEcho.value = 0.6;
    return b;
  })();
  innerDorr.group.scale.setScalar(3.7);
  innerDorr.U.uInside.value = 1;
  innerDorr.group.position.copy(pearlWorld);
  innerDorr.group.visible = false;
  scene.add(innerDorr.group);

  /* ============================================================ C · the Services Company: one thread of light, one pearl */
  const stageC = new THREE.Group();
  scene.add(stageC);
  const BEAD_R = 0.95;
  const strand = (x, out) => out.set(x, 0.05 * x * x - 0.9, -0.035 * x * x);
  const thread = (() => {
    const pts = [], set = new Set(), edges = [];
    const c = strand(0, new THREE.Vector3());
    const bead = fib(Math.round(260 * DENS), BEAD_R);
    for (const v of bead) { v.add(c); v.seg = 0; pts.push(v); }
    knn(pts, 3, 0.5, 0, pts.length, set, edges);
    const x0 = -16, x1 = 16, steps = Math.round((x1 - x0) / 0.16);
    let prev = -1;
    for (let i = 0; i <= steps; i++) {
      const x = x0 + (i / steps) * (x1 - x0);
      if (Math.abs(x) < BEAD_R * 0.92) { prev = -1; continue; }
      const v = strand(x, new THREE.Vector3());
      v.seg = 0; v.inner = true;
      pts.push(v);
      if (prev >= 0) edges.push([prev, pts.length - 1]);
      prev = pts.length - 1;
    }
    return buildPlexus(pts, edges, { seg: true, nodes: 0.05 });
  })();
  const threadG = thread.group;
  stageC.add(threadG);

  /* ============================================================ D · Future Vision: an orrery around the pearl */
  const stageD = new THREE.Group();
  scene.add(stageD);
  const orrery = new THREE.Group();
  stageD.add(orrery);
  const bigPearl = new THREE.Mesh(pearl.geometry, pearlMat);
  bigPearl.scale.setScalar(1.7);
  orrery.add(bigPearl);
  const ORB = [2.0, 3.0, 4.2];
  const orbitMat = new THREE.LineBasicMaterial({ color: new THREE.Color('#fffaf2').multiplyScalar(1.15), transparent: true, opacity: 0.5, depthWrite: false });
  ORB.slice(0, 2).forEach((r) => { const l = new THREE.LineLoop(scanRingGeo, orbitMat); l.scale.set(r, 1, r); orrery.add(l); });
  {
    const a = [];
    for (let i = 0; i < 180; i++) { const t = (i / 180) * Math.PI * 2; a.push(Math.cos(t) * ORB[2], 0, Math.sin(t) * ORB[2]); }
    const dotted = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(a, 3)), new THREE.PointsMaterial({ color: new THREE.Color('#fffaf2').multiplyScalar(1.2), size: 0.035, transparent: true, opacity: 0.8, depthWrite: false }));
    orrery.add(dotted);
  }
  const orbs = BRANDS.map((b, k) => {
    const m = new THREE.Mesh(pearl.geometry, pearlMat);
    m.scale.setScalar(k < 2 ? 0.42 : 0.36);
    orrery.add(m);
    return { m, r: ORB[k < 2 ? 0 : 1], a0: k < 2 ? k * Math.PI + 0.6 : ((k - 2) * Math.PI * 2) / 3 + 1.4, sp: k < 2 ? 0.16 : 0.1 };
  });
  const slots = Array.from({ length: 6 }, (_, k) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.007, 6, 48), glowMat);
    orrery.add(m);
    return { m, a0: (k * Math.PI * 2) / 6 + 0.3 };
  });
  const qTmp = new THREE.Quaternion();

  /* ============================================================ dust / snow, everywhere */
  const DN = isPhone ? 600 : 1400;
  const dustSeed = new Float32Array(DN * 3);
  for (let i = 0; i < DN * 3; i++) dustSeed[i] = rnd();
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustSeed, 3));
  const dustU = { uCam: { value: new THREE.Vector3() }, uTime: { value: 0 }, uSize: { value: 26 * DPR }, uA: { value: 0.8 } };
  const dust = new THREE.Points(dustGeo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: dustU,
    vertexShader: `uniform vec3 uCam; uniform float uTime, uSize, uA; varying float vA;
      void main(){
        vec3 box = vec3(24.0, 14.0, 24.0);
        vec3 p = position * box;
        p.y -= uTime * (0.16 + position.x * 0.18);
        p.x += sin(uTime * 0.35 + position.z * 20.0) * 0.6 + uTime * 0.12;
        p.z += cos(uTime * 0.3 + position.y * 20.0) * 0.4;
        p = mod(p - uCam + box * 0.5, box) + uCam - box * 0.5;
        vec4 mv = viewMatrix * vec4(p, 1.0);
        float d = -mv.z;
        vA = uA * smoothstep(0.4, 1.8, d) * (1.0 - smoothstep(7.0, 12.0, d)) * (0.35 + 0.65 * position.y);
        gl_PointSize = uSize * (0.35 + position.z * 0.9) / max(d, 0.1);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `varying float vA; void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); float a = smoothstep(0.5, 0.0, d) * vA; if (a < 0.01) discard; gl_FragColor = vec4(1.0, 0.98, 0.95, a); }`,
  }));
  dust.frustumCulled = false;
  dust.renderOrder = 5;
  scene.add(dust);

  await step('Lighting the room');

  /* ============================================================ post: bloom, then frost / aberration / grain */
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(DPR);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.4, 0.5, 1.1);
  if (!isPhone) composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const finalPass = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uTrans: { value: 0 }, uCA: { value: 0.0015 }, uGrain: { value: 0.035 }, uRes: { value: new THREE.Vector2(1, 1) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uTrans, uCA, uGrain; uniform vec2 uRes; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      void main(){
        vec2 uv = vUv; float t = uTrans;
        vec2 c = uv - 0.5; vec2 ca = c * vec2(uRes.x / uRes.y, 1.0); float d = length(ca);
        float w = sin(d * 46.0 - uTime * 5.0);
        uv += normalize(c + 1e-4) * w * 0.012 * t * (1.0 - smoothstep(0.0, 1.0, t * 1.2 - d));
        vec2 off = c * (uCA + t * 0.01) * (0.5 + d);
        vec3 col = vec3(texture2D(tDiffuse, uv + off).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - off).b);
        vec3 nac = 0.5 + 0.5 * cos(6.28318 * (d * 1.4 - uTime * 0.08 + vec3(0.0, 0.33, 0.67)));
        vec3 pearlLight = vec3(0.97, 0.95, 0.92) * (0.9 + 0.12 * nac);
        float m = clamp(t * 1.7 - d * 0.9 + n2(uv * 5.0 + uTime * 0.2) * 0.25 * t, 0.0, 1.0);
        col = mix(col, pearlLight, smoothstep(0.0, 1.0, m));
        col *= mix(1.0, smoothstep(1.05, 0.3, d * 1.05), 0.3);
        col += (h(vUv * uRes + fract(uTime * 7.0) * 100.0) - 0.5) * uGrain;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  composer.addPass(finalPass);

  let W = 1, H = 1, baseFov = 36;
  const resize = () => {
    W = window.innerWidth; H = window.innerHeight;
    renderer.setSize(W, H, false);
    composer.setSize(W, H);
    camera.aspect = W / H;
    camera.fov = baseFov = W / H < 0.8 ? 50 : 36;
    camera.updateProjectionMatrix();
    finalPass.uniforms.uRes.value.set(W * DPR, H * DPR);
  };
  window.addEventListener('resize', resize);
  resize();

  /* ============================================================ the HUD tags pinned to 3D */
  const tagsEl = $('[data-tags]');
  const wiresEl = $('[data-wires]');
  const SVGNS = 'http://www.w3.org/2000/svg';
  const wires = Array.from({ length: 14 }, () => { const l = document.createElementNS(SVGNS, 'line'); l.style.opacity = '0'; wiresEl.appendChild(l); return l; });
  const dots = Array.from({ length: 14 }, () => { const c = document.createElementNS(SVGNS, 'circle'); c.setAttribute('r', '3'); c.style.opacity = '0'; wiresEl.appendChild(c); return c; });
  let wireN = 0, dotN = 0;
  const wire = (x1, y1, x2, y2, o) => { const l = wires[wireN++]; if (!l) return; l.setAttribute('x1', x1.toFixed(1)); l.setAttribute('y1', y1.toFixed(1)); l.setAttribute('x2', x2.toFixed(1)); l.setAttribute('y2', y2.toFixed(1)); l.style.opacity = o.toFixed(2); };
  const dot = (x, y, o, r) => { const c = dots[dotN++]; if (!c) return; c.setAttribute('cx', x.toFixed(1)); c.setAttribute('cy', y.toFixed(1)); c.setAttribute('r', r || 3); c.style.opacity = o.toFixed(2); };
  const mkTag = (html, cls = '') => { const d = document.createElement('div'); d.className = `tag ${cls}`; d.innerHTML = html; tagsEl.appendChild(d); return { el: d, o: -1, w: 0, h: 0 }; };
  const place = (t, x, y, o) => {
    const oo = Math.round(o * 100) / 100;
    if (oo !== t.o) { t.el.style.opacity = String(oo); t.o = oo; }
    if (oo > 0) t.el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
  };
  const measure = (t) => { t.w = t.el.offsetWidth; t.h = t.el.offsetHeight; };
  const sv = new THREE.Vector3();
  const scr = { x: 0, y: 0, ok: true };
  const toScreen = (v) => { sv.copy(v).project(camera); scr.x = (sv.x * 0.5 + 0.5) * W; scr.y = (-sv.y * 0.5 + 0.5) * H; scr.ok = sv.z < 1; return scr; };

  // ring labels: text written around a pearl
  const mkRing = () => {
    const g = document.createElementNS(SVGNS, 'g'); g.style.opacity = '0';
    const c = document.createElementNS(SVGNS, 'circle'); c.setAttribute('class', 'ring-c');
    const id = `rp${Math.random().toString(36).slice(2, 8)}`;
    const path = document.createElementNS(SVGNS, 'path'); path.setAttribute('id', id); path.setAttribute('fill', 'none');
    const text = document.createElementNS(SVGNS, 'text'); const tp = document.createElementNS(SVGNS, 'textPath');
    tp.setAttribute('href', `#${id}`); tp.setAttribute('lengthAdjust', 'spacing'); text.appendChild(tp);
    g.append(c, path, text); wiresEl.appendChild(g);
    return { g, c, path, tp, o: -1, r: -1, txt: '' };
  };
  const placeRing = (R, cx, cy, rad, rot, o, txt) => {
    const oo = Math.round(o * 100) / 100;
    if (oo !== R.o) { R.g.style.opacity = String(oo); R.o = oo; }
    if (oo <= 0) return;
    if (txt !== R.txt) { R.txt = txt; R.tp.textContent = txt; R.r = -1; }
    if (Math.abs(rad - R.r) > 0.6) {
      R.r = rad;
      R.path.setAttribute('d', `M ${(-rad).toFixed(1)},0 a ${rad.toFixed(1)},${rad.toFixed(1)} 0 1,1 ${(2 * rad).toFixed(1)},0 a ${rad.toFixed(1)},${rad.toFixed(1)} 0 1,1 ${(-2 * rad).toFixed(1)},0`);
      R.c.setAttribute('r', Math.max(1, rad - 10).toFixed(1));
      R.tp.setAttribute('textLength', (2 * Math.PI * rad * 0.985).toFixed(1));
    }
    R.g.setAttribute('transform', `translate(${cx.toFixed(1)} ${cy.toFixed(1)}) rotate(${(rot % 360).toFixed(2)})`);
  };
  const repeatTxt = (t, rad) => { const n = Math.max(1, Math.round((2 * Math.PI * rad) / (t.length * 9))); return t.repeat(n); };
  const ringA = mkRing(), ringB = mkRing(), ringC = mkRing(), ringD = mkRing();
  const pearlTag = mkTag('<span class="tag__box tag__box--ink" data-pearl-cta>Open the pearl ↗</span>');
  const bTag = mkTag('<span class="tag__row"><span class="tag__box" data-tb-num>01 / 05</span><span class="tag__box" data-tb-type>Restaurant</span></span><span class="tag__big" data-tb-name>DADA</span><span class="tag__txt" data-tb-text></span><span class="tag__row"><span class="tag__box tag__box--ink" data-tb-cta>Open ↗</span></span>', 'tag--c');
  const vTags = BRANDS.map((b) => mkTag(`<span class="tag__box">${b.name}</span>`));
  const slotTag = mkTag('<span class="tag__tiny">Room for new concepts</span>');
  const tb = { num: $('[data-tb-num]'), type: $('[data-tb-type]'), name: $('[data-tb-name]'), text: $('[data-tb-text]'), cta: $('[data-tb-cta]') };
  const pearlCta = $('[data-pearl-cta]');
  const verb = coarse ? 'Tap' : 'Click';
  tb.cta.textContent = `${verb} the pearl ↗`; pearlCta.textContent = `${verb} to open the pearl ↗`;
  const pearlRingTxt = 'DORR · THE PEARL · HOSPITALITY GROUP · ';
  const visRingTxt = 'DORR · ONE STRATEGIC DIRECTION · MANY DISTINCT BRANDS · ';
  [pearlTag].forEach(measure);
  let shownBrand = -1, brandRingTxt = '';
  const showBrandTags = (i) => {
    shownBrand = i;
    const b = BRANDS[i];
    tb.num.textContent = `${pad2(i + 1)} / 05`;
    tb.type.textContent = b.type;
    scramble(tb.name, b.name, 0.6);
    tb.text.textContent = b.text;
    brandRingTxt = `${b.name} · ${b.type} · ${pad2(i + 1)} / 05 · DORR HOSPITALITY GROUP · `;
    requestAnimationFrame(() => measure(bTag));
    setTimeout(() => measure(bTag), 700);
    brandLis.forEach((li, k) => li.classList.toggle('is-now', k === i));
  };

  /* ============================================================ stage looks */
  const LOOK = {
    A: { fog: new THREE.Color('#b9b0a4'), top: new THREE.Color('#e4dbcf'), bot: new THREE.Color('#968d81'), d: 0.03 },
    B: { fog: new THREE.Color('#9f968b'), top: new THREE.Color('#c2b9ad'), bot: new THREE.Color('#7f776c'), d: 0.06 },
    C: { fog: new THREE.Color('#a49b8f'), top: new THREE.Color('#c9c0b4'), bot: new THREE.Color('#857c70'), d: 0.04 },
    D: { fog: new THREE.Color('#aaa195'), top: new THREE.Color('#d4cbbf'), bot: new THREE.Color('#887f73'), d: 0.035 },
    I: { fog: new THREE.Color('#665e54'), top: new THREE.Color('#8d8478'), bot: new THREE.Color('#4c453d'), d: 0.016 },
  };
  const applyLook = (a, b, t) => {
    scene.fog.color.copy(a.fog).lerp(b.fog, t);
    skyU.uTop.value.copy(a.top).lerp(b.top, t);
    skyU.uBot.value.copy(a.bot).lerp(b.bot, t);
    FOGD.value = a.d + (b.d - a.d) * t;
  };

  /* ============================================================ camera paths */
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const pw = pearlWorld;
  const PATH_A = [
    { p: 0.0, pos: V(0, 2.7, 10.4), look: V(0, 0.45, 0), c: V(0, 0.75, 0) },
    { p: 0.085, pos: V(2.6, 1.7, 7.4), look: V(-1.3, 0.6, 0.8), c: V(0, 0.6, 0) },
    { p: 0.14, pos: V(0.9, 2.9, 7.6), look: V(-1.6, 0.6, 0.4), c: V(0, 0.6, 0) },
    { p: 0.225, pos: V(-3.3, 3.7, 6.4), look: V(1.25, 0.7, 0.9), c: V(0, 0.7, 0) },
    { p: 0.27, pos: V(-0.7, 4.5, 5.7), look: V(0, 0.45, 0.35) },
    { p: 0.33, pos: V(pw.x + 0.2, pw.y + 1.15, pw.z + 2.75), look: V(pw.x, pw.y + 0.05, pw.z) },
    { p: 0.37, pos: V(pw.x, pw.y + 0.2, pw.z + 1.05), look: V(pw.x, pw.y, pw.z) },
  ];
  const PATH_AP = PATH_A.map((k) => ({ p: k.p, pos: k.pos, look: k.c || k.look }));
  const cr = (a, b, c, d, t, out) => {
    const t2 = t * t, t3 = t2 * t;
    out.x = 0.5 * (2 * b.x + (-a.x + c.x) * t + (2 * a.x - 5 * b.x + 4 * c.x - d.x) * t2 + (-a.x + 3 * b.x - 3 * c.x + d.x) * t3);
    out.y = 0.5 * (2 * b.y + (-a.y + c.y) * t + (2 * a.y - 5 * b.y + 4 * c.y - d.y) * t2 + (-a.y + 3 * b.y - 3 * c.y + d.y) * t3);
    out.z = 0.5 * (2 * b.z + (-a.z + c.z) * t + (2 * a.z - 5 * b.z + 4 * c.z - d.z) * t2 + (-a.z + 3 * b.z - 3 * c.z + d.z) * t3);
  };
  const samplePath = (K, p, pos, look) => {
    let i = 0;
    while (i < K.length - 2 && p > K[i + 1].p) i++;
    const t = smooth(seg(p, K[i].p, K[i + 1].p)) * 0.35 + seg(p, K[i].p, K[i + 1].p) * 0.65;
    const a = K[Math.max(0, i - 1)], b = K[i], c = K[i + 1], d = K[Math.min(K.length - 1, i + 2)];
    cr(a.pos, b.pos, c.pos, d.pos, t, pos);
    cr(a.look, b.look, c.look, d.look, t, look);
  };

  /* ============================================================ interaction */
  const ptr = { x: 0, y: 0, sx: 0, sy: 0, nx: 0, ny: 0, moved: false, has: false };
  window.addEventListener('pointermove', (e) => {
    ptr.nx = (e.clientX / W) * 2 - 1; ptr.ny = -(e.clientY / H) * 2 + 1; ptr.has = true; ptr.moved = true;
    if (e.pointerType === 'mouse') { ptr.x = ptr.nx; ptr.y = ptr.ny; }
  }, { passive: true });
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const hits = [];
  let hover = null;
  const pick = (x, y) => {
    ndc.set(x, y);
    raycaster.setFromCamera(ndc, camera);
    hits.length = 0;
    if (stage === 'A') {
      if (openAmt > 0.35) raycaster.intersectObject(pearlHit, false, hits);
      else raycaster.intersectObject(shellHit, false, hits);
      if (hits.length) return openAmt > 0.35 ? 'pearl' : 'shell';
    } else if (stage === 'B') {
      for (let i = 0; i < pearls.length; i++) if (pearls[i].rev > 0.4) raycaster.intersectObject(pearls[i].hit, false, hits);
      if (hits.length) { hits.sort((a, b) => a.distance - b.distance); return hits[0].object.userData.brand; }
    }
    return null;
  };
  window.addEventListener('click', (e) => {
    if (SH.kind || IN.on || menuOpen || !S.ready || S.mode !== 'film' || root.classList.contains('static')) return;
    if (e.target.closest('a, button, input, textarea, label, .sheet, .dossier, .hud, .rail, .inside, .menu')) return;
    const h = pick((e.clientX / W) * 2 - 1, -(e.clientY / H) * 2 + 1);
    if (h === 'pearl') enterPearl('dorr', 0);
    else if (h === 'shell') goStep(3);
    else if (typeof h === 'number') enterPearl('brand', h);
  });

  /* ============================================================ navigation: one gesture, one step */
  // The film is a list of stops. A wheel gesture, a swipe or a key moves exactly one stop with a
  // fixed-length, gently eased transition, then rests. Momentum during a transition is ignored.
  // After the last stop the page hands over to the dossier, which scrolls freely.
  gsap.registerPlugin(ScrollTrigger);
  const lenis = window.Lenis ? new Lenis({ lerp: 0.1, smoothWheel: true }) : null;
  if (lenis) {
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  }
  window.scrollTo(0, 0);
  const dossierEl = $('#dossier');
  const S = { p: 0, intro: 0, vel: 0, flash: 0, dossierVisible: false, mode: 'film', step: 0, busy: false, ready: false, swell: false, inDossier: false };
  const track = $('[data-track]');
  const st = ScrollTrigger.create({ trigger: track, start: 'top top', end: 'bottom bottom' });
  ScrollTrigger.create({ trigger: '#dossier', start: 'top bottom', end: 'bottom top', onToggle: (self) => { S.dossierVisible = self.isActive; } });
  const progressBar = $('[data-progress]');
  const pToY = (p) => st.start + p * (st.end - st.start);
  const PB0 = 0.372, PB1 = 0.652;
  const brandP = (i) => PB0 + ((i + 0.5) / 5) * (PB1 - PB0);
  const STOPS = [{ p: 0, ch: 0 }, { p: 0.14, ch: 1 }, { p: 0.228, ch: 1 }, { p: 0.31, ch: 2 }];
  for (let i = 0; i < 5; i++) STOPS.push({ p: brandP(i), ch: 3, brand: i });
  STOPS.push({ p: 0.755, ch: 4 });
  STOPS.push({ p: 0.905, ch: 5 }, { p: 0.985, ch: 5 });
  const LAST = STOPS.length - 1;
  const CH_FIRST = [0, 1, 3, 4, 9, 10];
  const brandStep = (i) => 4 + i;
  const easeSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
  const syncScroll = () => { const y = Math.round(pToY(S.p)); if (S.mode === 'film' && Math.abs(window.scrollY - y) > 1) window.scrollTo(0, y); };
  const hashFor = (t) => (t === 'dossier' ? '#dossier' : `#s${t}`);
  const writeHistory = (t, push) => { try { history[push ? 'pushState' : 'replaceState']({ step: t }, '', hashFor(t)); } catch (e) { /* file:// or sandbox */ } };
  let afterStep = null;
  let stepTween = null;

  function goStep(i, opts = {}) {
    if (!S.ready) return;
    i = Math.round(clamp(i, 0, LAST));
    if (i === S.step && !opts.force) return;
    const from = S.p, to = STOPS[i].p;
    S.step = i;
    S.busy = true;
    if (stepTween) stepTween.kill();
    const d = opts.duration || clamp(1.6 + Math.abs(to - from) * 4.5, 1.8, 2.8);
    stepTween = gsap.to(S, {
      p: to, duration: reduce ? 0.01 : d, ease: 'sine.inOut',
      onComplete: () => {
        stepTween = null; S.busy = false; syncScroll();
        if (afterStep) { const f = afterStep; afterStep = null; f(); }
      },
    });
    Sound.step();
    writeHistory(i, false);
  }
  function stepBy(dir) {
    if (dir > 0 && S.step === LAST) { toDossier(); return; }
    goStep(S.step + dir);
  }

  // jumps (menu, rail, links): a short veil of pearl light instead of travelling through everything
  const veil = $('[data-veil]');
  function jumpTo(target, { push = true } = {}) {
    if (!S.ready) return;
    if (IN.on) leaveInsideNow();
    closeMenu(false);
    if (target !== 'dossier' && target === S.step && S.mode === 'film') return;
    if (stepTween) { stepTween.kill(); stepTween = null; }
    afterStep = null;
    S.busy = true;
    Sound.jump();
    gsap.timeline({ onComplete: () => { S.busy = false; } })
      .to(veil, { opacity: 1, duration: reduce ? 0.01 : 0.55, ease: 'sine.inOut' })
      .to(S, { flash: 1, duration: 0.55, ease: 'sine.inOut' }, 0)
      .add(() => {
        if (target === 'dossier') {
          S.mode = 'dossier';
          if (lenis) { lenis.start(); lenis.scrollTo(dossierEl, { immediate: true, force: true }); } else window.scrollTo(0, dossierEl.offsetTop);
        } else {
          if (S.mode === 'dossier') { S.mode = 'film'; if (lenis) lenis.stop(); }
          S.step = target; S.p = STOPS[target].p;
          syncScroll();
          for (let k = 0; k < pearls.length; k++) pearls[k].rev = 0;
        }
        writeHistory(target, push);
      })
      .to(veil, { opacity: 0, duration: reduce ? 0.01 : 1.1, ease: 'sine.inOut' }, '+=0.2')
      .to(S, { flash: 0, duration: 1.1, ease: 'sine.inOut' }, '<');
  }
  const dossierTop = () => dossierEl.getBoundingClientRect().top + window.scrollY;
  function toDossier() {
    if (S.mode === 'dossier' || S.busy) return;
    S.mode = 'dossier'; S.busy = true;
    syncScroll();
    Sound.step();
    writeHistory('dossier', false);
    if (lenis) {
      lenis.start();
      lenis.scrollTo(dossierEl, { duration: reduce ? 0.01 : 1.8, easing: easeSine, force: true, lock: true, onComplete: () => { S.busy = false; } });
    } else { window.scrollTo(0, dossierTop()); S.busy = false; }
  }
  function toFilm() {
    if (S.mode !== 'dossier' || S.busy) return;
    S.busy = true;
    S.step = LAST; S.p = STOPS[LAST].p;
    writeHistory(LAST, false);
    Sound.step();
    const finish = () => { S.mode = 'film'; if (lenis) lenis.stop(); S.busy = false; syncScroll(); };
    if (lenis) lenis.scrollTo(pToY(S.p), { duration: reduce ? 0.01 : 1.8, easing: easeSine, force: true, lock: true, onComplete: finish });
    else { window.scrollTo(0, pToY(S.p)); finish(); }
  }
  const atDossierTop = () => window.scrollY <= dossierTop() + 4;
  // free scrolling in the dossier past its top (scrollbar, keyboard) hands back to the film
  if (lenis) lenis.on('scroll', () => { if (S.mode === 'dossier' && !S.busy && window.scrollY < dossierTop() - 8) { S.busy = true; S.step = LAST; S.p = STOPS[LAST].p; S.mode = 'film'; lenis.stop(); syncScroll(); S.busy = false; writeHistory(LAST, false); } });

  // ---- wheel: one gesture = one step (trackpad inertia stays within its gesture)
  const G = { last: 0, start: 0, lastAbs: 0, used: true };
  const blocked = () => !S.ready || IN.on || menuOpen || !!SH.kind;
  window.addEventListener('wheel', (e) => {
    if (e.ctrlKey) return; // pinch zoom
    const now = performance.now();
    const d = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * H : e.deltaY;
    const a = Math.abs(d);
    const gap = now - G.last;
    const fresh = gap > 220 || (a > G.lastAbs * 2.5 && a > 30 && now - G.start > 450 && !S.busy);
    G.last = now; G.lastAbs = a;
    if (fresh) { G.start = now; G.used = S.busy; }
    if (IN.on) { e.preventDefault(); if (fresh && d < -4 && !IN.busy) exitPearl(); return; }
    if (menuOpen || SH.kind) return;
    if (S.mode === 'dossier') {
      if (d < 0 && atDossierTop() && !S.busy) { e.preventDefault(); if (!G.used) { G.used = true; toFilm(); } }
      return;
    }
    e.preventDefault();
    if (blocked() || G.used || S.busy || a < 4) return;
    G.used = true;
    stepBy(d > 0 ? 1 : -1);
  }, { passive: false });

  // ---- touch: one swipe = one step
  const TC = { x: 0, y: 0, t: 0, top: false };
  window.addEventListener('touchstart', (e) => { const t = e.touches[0]; TC.x = t.clientX; TC.y = t.clientY; TC.t = performance.now(); TC.top = S.mode === 'dossier' && atDossierTop(); }, { passive: true });
  window.addEventListener('touchmove', (e) => {
    if (S.mode === 'film' && !e.target.closest('.inside__text, .menu__panel, .sheet__panel')) e.preventDefault();
  }, { passive: false });
  window.addEventListener('touchend', (e) => {
    const t = e.changedTouches[0];
    const dy = TC.y - t.clientY, dx = TC.x - t.clientX;
    if (Math.abs(dy) < 40 || Math.abs(dy) < Math.abs(dx) * 1.2) return;
    if (IN.on) { if (dy < 0 && !IN.busy && !e.target.closest('.inside__text')) exitPearl(); return; }
    if (menuOpen || SH.kind || !S.ready) return;
    if (S.mode === 'dossier') { if (dy < 0 && TC.top && !S.busy) toFilm(); return; }
    if (S.busy) return;
    stepBy(dy > 0 ? 1 : -1);
  }, { passive: true });

  // ---- keys
  window.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.altKey || e.metaKey || e.ctrlKey) return;
    const tag = (e.target.tagName || '').toLowerCase();
    if (/input|textarea|select/.test(tag) || e.target.isContentEditable) return;
    if (IN.on) {
      if (e.key === 'Escape' || e.key === 'Backspace') { e.preventDefault(); exitPearl(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); insideStep(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); insideStep(-1); }
      return;
    }
    if (menuOpen) { if (e.key === 'Escape') { e.preventDefault(); closeMenu(true); } return; }
    if (SH.kind || !S.ready) return;
    const down = e.key === 'ArrowDown' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey && tag !== 'button' && tag !== 'a');
    const upk = e.key === 'ArrowUp' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey && tag !== 'button' && tag !== 'a');
    if (S.mode === 'dossier') { if (upk && atDossierTop()) { e.preventDefault(); toFilm(); } return; }
    if (down) { e.preventDefault(); if (!S.busy) stepBy(1); }
    else if (upk) { e.preventDefault(); if (!S.busy) stepBy(-1); }
    else if (e.key === 'Home') { e.preventDefault(); jumpTo(0); }
    else if (e.key === 'End') { e.preventDefault(); jumpTo('dossier'); }
  });
  // keyboard focus landing in the dossier while the film is showing: hand over
  dossierEl.addEventListener('focusin', () => { if (S.mode === 'film' && S.ready) { S.mode = 'dossier'; if (lenis) lenis.start(); writeHistory('dossier', false); } });

  // ---- links, rail, menu
  $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if (id !== '#top' && id !== '#dossier' && id !== '#contact') return;
    e.preventDefault();
    if (!S.ready) return;
    if (SH.kind) closeSheet(true);
    jumpTo(id === '#top' ? 0 : 'dossier');
  }));
  const menuEl = $('[data-menu]');
  let menuOpen = false, menuLast = null;
  function openMenu() {
    if (menuOpen || !S.ready) return;
    menuOpen = true; menuLast = document.activeElement;
    menuEl.hidden = false;
    mainEl.inert = true;
    const cur = S.mode === 'dossier' ? 6 : STOPS[S.step].ch;
    $$('.menu__list > li > button', menuEl).forEach((b, k) => b.classList.toggle('is-now', k === cur));
    if (anim()) gsap.fromTo($('.menu__panel', menuEl), { xPercent: 10, autoAlpha: 0 }, { xPercent: 0, autoAlpha: 1, duration: 0.7, ease: 'power3.out' });
    $('[data-menu-close]', menuEl).focus({ preventScroll: true });
    Sound.tick();
  }
  function closeMenu(restore) {
    if (!menuOpen) return;
    menuOpen = false;
    menuEl.hidden = true;
    mainEl.inert = false;
    if (restore && menuLast && menuLast.focus) menuLast.focus({ preventScroll: true });
  }
  $('[data-menu-open]').addEventListener('click', openMenu);
  $('[data-menu-close]').addEventListener('click', () => closeMenu(true));
  menuEl.addEventListener('click', (e) => { if (e.target === menuEl) closeMenu(true); });
  menuEl.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const f = $$('button', menuEl); const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  $$('[data-goto]').forEach((b) => b.addEventListener('click', () => { const g = b.dataset.goto; jumpTo(g === 'dossier' ? 'dossier' : CH_FIRST[+g]); }));
  $$('[data-goto-brand]').forEach((b) => b.addEventListener('click', () => jumpTo(brandStep(+b.dataset.gotoBrand))));
  window.addEventListener('popstate', (e) => {
    const stt = e.state;
    if (IN.on) { if (!(stt && stt.inside)) { IN.pushed = false; exitPearl(true); } return; }
    if (!S.ready) return;
    if (stt && stt.step !== undefined) jumpTo(stt.step, { push: false });
    else if (location.hash === '#dossier') jumpTo('dossier', { push: false });
    else if (/^#s\d+$/.test(location.hash)) jumpTo(+location.hash.slice(2), { push: false });
  });

  window.addEventListener('resize', () => {
    ScrollTrigger.refresh();
    if (S.mode === 'film') syncScroll();
    else if (lenis && !S.busy && Math.abs(window.scrollY - dossierTop()) < H) { /* stay where the reader is */ }
    measure(bTag); measure(pearlTag);
    const rt = water.getRenderTarget && water.getRenderTarget();
    if (rt) rt.setSize(Math.round(innerWidth * DPR * (isPhone ? 0.35 : 0.5)), Math.round(innerHeight * DPR * (isPhone ? 0.35 : 0.5)));
  });

  /* ============================================================ inside a pearl */
  // the camera flies into the sphere of points; they part around it and close into a lit space,
  // where the pearl's content appears. Back reverses the flight to exactly where we were.
  const F = { v: 0, kind: null, idx: 0, open: 0, look: new THREE.Vector3() };
  const IN = { on: false, busy: false, pushed: false, last: null };
  let exitWaiter = null;
  const inEl = $('[data-inside]');
  const inUI = { num: $('[data-in-num]', inEl), kicker: $('[data-in-kicker]', inEl), name: $('[data-in-name]', inEl), type: $('[data-in-type]', inEl), copy: $('[data-in-copy]', inEl), prev: $('[data-in-prev]', inEl), next: $('[data-in-next]', inEl), prevName: $('[data-in-prev-name]', inEl), nextName: $('[data-in-next-name]', inEl), back: $('[data-in-back]', inEl) };
  const KIND = ['Geodesic sphere', 'Rippled sphere', 'A sphere within a sphere', 'Meridians and parallels', 'Two halves that meet'];
  function fillInside(kind, i) {
    if (kind === 'dorr') {
      inUI.num.textContent = '00';
      inUI.kicker.textContent = 'Inside the pearl · the Group';
      inUI.name.textContent = 'DORR';
      inUI.type.textContent = 'Hospitality Group';
      const src = $('[data-sheet="dorr"] .sheet__panel');
      inUI.copy.innerHTML = '';
      $$('.sheet__body p', src).forEach((p) => inUI.copy.appendChild(p.cloneNode(true)));
      inUI.copy.appendChild($('.tree', src).cloneNode(true));
      inUI.prev.hidden = true;
      inUI.next.hidden = false; inUI.nextName.textContent = 'The five brands';
    } else {
      const b = BRANDS[i], pe = pearls[i];
      inUI.num.textContent = pad2(i + 1);
      inUI.kicker.textContent = `Inside the pearl · ${pad2(i + 1)} / 05`;
      inUI.name.textContent = b.name;
      inUI.type.textContent = b.type;
      inUI.copy.innerHTML = `<p></p><dl class="sheet__meta"><div><dt>Part of</dt><dd>DORR Hospitality Group</dd></div><div><dt>Supported by</dt><dd>The Services Company</dd></div><div><dt>Governance</dt><dd>The Holding Company</dd></div><div><dt>Drawn as</dt><dd></dd></div></dl>`;
      inUI.copy.querySelector('p').textContent = b.text;
      inUI.copy.querySelector('dl > div:last-child dd').textContent = `${KIND[i]} · ${pe.nPts} points · ${pe.nLines} lines`;
      inUI.prev.hidden = false; inUI.next.hidden = false;
      inUI.prevName.textContent = BRANDS[(i + 4) % 5].name;
      inUI.nextName.textContent = BRANDS[(i + 1) % 5].name;
    }
  }
  function showInside() {
    inEl.classList.remove('is-out');
    inEl.classList.add('is-in');
    inUI.back.focus({ preventScroll: true });
  }
  function enterPearl(kind, i) {
    if (!S.ready || IN.busy || S.mode !== 'film') return;
    if (IN.on) { if (kind === 'brand' && F.kind === 'brand' && i !== F.idx) insideStep(i - F.idx, i); return; }
    // not there yet: travel to the pearl first, then enter
    if (kind === 'brand' && S.step !== brandStep(i)) { if (!S.busy) { afterStep = () => enterPearl('brand', i); goStep(brandStep(i)); } return; }
    if (kind === 'dorr' && S.step !== 3) { if (!S.busy) { afterStep = () => enterPearl('dorr', 0); goStep(3); } return; }
    if (S.busy) return;
    IN.on = true; IN.busy = true; IN.last = document.activeElement;
    F.kind = kind; F.idx = i;
    fillInside(kind, i);
    inEl.hidden = false; inEl.classList.remove('is-in', 'is-out');
    mainEl.inert = true;
    Sound.pearl(kind === 'brand' ? i : -1);
    Sound.enter();
    Sound.duck(true);
    try { history.pushState({ inside: true, step: S.step }, '', location.hash); IN.pushed = true; } catch (e) { IN.pushed = false; }
    gsap.killTweensOf(F);
    if (kind === 'dorr') gsap.to(F, { open: 1, duration: 1.2, ease: 'sine.inOut' });
    gsap.to(F, { v: 1, duration: reduce ? 0.01 : 2.6, ease: 'power2.inOut', onComplete: () => { IN.busy = false; showInside(); } });
  }
  function exitPearl(fromPop) {
    if (!IN.on) return;
    if (IN.busy && !fromPop) return;
    if (IN.pushed && fromPop !== true) { IN.pushed = false; try { history.back(); return; } catch (e) { /* fall through */ } }
    IN.busy = true;
    inEl.classList.remove('is-in'); inEl.classList.add('is-out');
    Sound.exit();
    Sound.duck(false);
    gsap.killTweensOf(F);
    gsap.to(F, {
      v: 0, open: 0, duration: reduce ? 0.01 : 2.3, delay: reduce ? 0 : 0.3, ease: 'power2.inOut',
      onComplete: () => {
        F.kind = null; IN.on = false; IN.busy = false;
        inEl.hidden = true; inEl.classList.remove('is-out');
        mainEl.inert = false;
        if (IN.last && IN.last.focus && document.contains(IN.last)) IN.last.focus({ preventScroll: true });
        if (exitWaiter) { const fn = exitWaiter; exitWaiter = null; fn(); }
      },
    });
  }
  function leaveInsideNow() {
    gsap.killTweensOf(F);
    F.v = 0; F.open = 0; F.kind = null; IN.on = false; IN.busy = false; IN.pushed = false;
    inEl.hidden = true; inEl.classList.remove('is-in', 'is-out');
    mainEl.inert = false;
    Sound.duck(false);
  }
  // pearl to pearl without leaving the portfolio: out a little, travel, in again
  function insideStep(dir, target) {
    if (!IN.on || IN.busy || S.busy) return;
    if (F.kind === 'dorr') { if (dir > 0) { exitPearl(); afterExit(() => goStep(brandStep(0))); } return; }
    const next = target !== undefined ? target : (F.idx + dir + 5) % 5;
    IN.busy = true;
    inEl.classList.remove('is-in'); inEl.classList.add('is-out');
    Sound.exit();
    const d = reduce ? 0.01 : 1;
    gsap.timeline()
      .to(F, { v: 0, duration: 1.6 * d, ease: 'power2.inOut' }, 0.25 * d)
      .add(() => {
        F.idx = next;
        fillInside('brand', next);
        S.step = brandStep(next);
        writeHistory(S.step, false);
        try { history.replaceState({ inside: true, step: S.step }, '', `#s${S.step}`); } catch (e) { /* ignore */ }
      })
      .to(S, { p: STOPS[brandStep(next)].p, duration: 1.8 * d, ease: 'sine.inOut' })
      .add(() => { Sound.pearl(next); Sound.enter(); })
      .to(F, { v: 1, duration: 2.0 * d, ease: 'power2.inOut', onComplete: () => { IN.busy = false; syncScroll(); showInside(); } });
  }
  const afterExit = (fn) => { exitWaiter = fn; };
  inUI.back.addEventListener('click', () => exitPearl());
  inUI.prev.addEventListener('click', () => insideStep(-1));
  inUI.next.addEventListener('click', () => insideStep(1));
  inEl.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const f = $$('button:not([hidden]), a[href]', inEl); if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  SH.hooks.enter = (kind, i) => { if (kind === 'brand' && IN.on) return true; enterPearl(kind, i); return true; };
  SH.hooks.gotoBrands = () => goStep(brandStep(0));

  /* ============================================================ UI hooks */
  const panels = $$('[data-panel]').map((el) => { const [a, b] = el.dataset.panel.split(',').map(Number); return { el, a, b, on: false, k: el.querySelector('.kicker span:last-child'), kt: (el.querySelector('.kicker span:last-child') || {}).textContent }; });
  const chNum = $('[data-ch-num]'), chName = $('[data-ch-name]'), hint = $('[data-hint]');
  const ticks = $$('[data-ticks] li');
  const CHAPTERS = [[0, '01', 'The Shell'], [0.085, '02', 'The Holding'], [0.27, '03', 'The Pearl'], [0.365, '04', 'The Portfolio'], [0.66, '05', 'Services Company'], [0.85, '06', 'Future Vision']];

  /* ============================================================ frame */
  const clock = new THREE.Clock();
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), tmpV = new THREE.Vector3(), tmpW = new THREE.Vector3();
  const sph = new THREE.Spherical();
  const right = new THREE.Vector3(), up = new THREE.Vector3(), fwd = new THREE.Vector3();
  let stage = 'A', openAmt = 0, lastChapter = -1, lastHint = '';
  let raf = 0, running = true;
  const setHint = (s) => { if (s !== lastHint) { lastHint = s; hint.textContent = s; } };
  const trans = (p, c, w) => sstep(w, 0, Math.abs(p - c));
  const tagPearl = new THREE.Vector3();
  const hide = (arr) => { for (let i = 0; i < arr.length; i++) place(arr[i], 0, 0, 0); };

  const frame = () => {
    raf = requestAnimationFrame(frame);
    if (!running) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    const time = clock.elapsedTime;
    const prevP = S.prevP === undefined ? S.p : S.prevP;
    S.prevP = S.p;
    S.vel += (Math.min(0.03, (Math.abs(S.p - prevP) / Math.max(dt, 1e-3)) * 0.02) - S.vel) * 0.1;
    const p = S.p;
    const dTop = S.dossierVisible ? dossierEl.getBoundingClientRect().top : 1e9;
    const inDossier = dTop < 70;
    if (inDossier !== S.inDossier) { S.inDossier = inDossier; root.classList.toggle('in-dossier', inDossier); }
    if (dTop <= 0) return; // the dossier covers the scene
    wireN = 0; dotN = 0;

    // which stage, which look
    stage = p < 0.365 ? 'A' : p < 0.66 ? 'B' : p < 0.85 ? 'C' : 'D';
    const inDorr = F.kind === 'dorr' && F.v > 0.52;
    stageA.visible = stage === 'A' && !inDorr; stageB.visible = stage === 'B'; stageC.visible = stage === 'C'; stageD.visible = stage === 'D';
    innerDorr.group.visible = inDorr;
    const tr = Math.max(trans(p, 0.365, 0.024), trans(p, 0.66, 0.022), trans(p, 0.85, 0.022));
    if (p < 0.365) applyLook(LOOK.A, LOOK.B, sstep(0.35, 0.365, p));
    else if (p < 0.66) applyLook(LOOK.B, LOOK.C, sstep(0.645, 0.66, p));
    else if (p < 0.85) applyLook(LOOK.C, LOOK.D, sstep(0.835, 0.85, p));
    else applyLook(LOOK.D, LOOK.D, 0);
    const introFog = 1 + (1 - S.intro) * 3.5;
    FOGD.value *= introFog;
    if (F.kind) {
      const k = sstep(0.42, 0.95, F.v);
      FOGD.value += (LOOK.I.d - FOGD.value) * k;
      scene.fog.color.lerp(LOOK.I.fog, k); skyU.uTop.value.lerp(LOOK.I.top, k); skyU.uBot.value.lerp(LOOK.I.bot, k);
    }
    scene.fog.density = FOGD.value;

    // ---------------------------------------------------- camera from scroll
    if (stage === 'A') {
      samplePath(W / H < 1 ? PATH_AP : PATH_A, p, camPos, camLook);
      if (W / H < 0.8) { tmpV.subVectors(camPos, camLook).multiplyScalar(p < 0.3 ? 1.5 : 1.25); camPos.copy(camLook).add(tmpV); }
    } else if (stage === 'B') {
      const q = clamp((p - PB0) / (PB1 - PB0)) * 5;
      const i = Math.min(4, Math.floor(q)), f = q - i;
      const g = 0.5 + 0.5 * Math.sign(f - 0.5) * Math.pow(Math.abs(2 * f - 1), 2.3);
      const x = SP * (i - 0.5 + g);
      const portrait = W / H < 0.8;
      camPos.set(x - 0.6, 0.6 + Math.sin(time * 0.1) * 0.1, portrait ? 8.8 : W / H < 1.45 ? 8.6 : 7.6);
      camLook.set(x + (portrait ? 0 : 1.15), portrait ? -0.95 : W / H < 1.45 ? -0.45 : 0.05, 0);
    } else if (stage === 'C') {
      const q = seg(p, 0.66, 0.85);
      const portrait = W / H < 0.8;
      strand(0, tmpW);
      camPos.set(tmpW.x + 0.9 - q * 1.2, tmpW.y + 1.1, tmpW.z + (portrait ? 10.5 : 8.2));
      camLook.set(tmpW.x - (portrait ? 0 : 1.6), tmpW.y - (portrait ? 1.2 : 0.1), tmpW.z);
    } else {
      const q = seg(p, 0.85, 1);
      const portrait = W / H < 0.8;
      const a = 0.35 - q * 0.6, r = (portrait ? 15 : 11) - q * 1.5;
      camPos.set(Math.sin(a) * r, 2.6 - q * 0.5, Math.cos(a) * r);
      camLook.set(portrait ? 0 : -2.6, portrait ? -1.6 : -0.9, 0);
    }
    // the opened pearl takes the camera
    if (F.kind && F.v > 0) {
      const P = F.kind === 'dorr' ? pearlWorld : pearls[F.idx].g.position;
      const e = F.v;
      camPos.lerp(P, e);
      // the gaze settles on the pearl first, then passes through it into the space beyond
      F.look.set(P.x, P.y, P.z - 1.2);
      tmpV.copy(P).lerp(F.look, sstep(0.5, 1, e));
      camLook.lerp(tmpV, sstep(0, 0.55, e));
      if (e > 0.6) camLook.y += Math.sin(time * 0.21) * 0.06 * (e - 0.6);
    }
    // cursor-reactive orbit + a slow handheld drift
    ptr.sx += (ptr.x - ptr.sx) * (1 - Math.exp(-dt * 1.6));
    ptr.sy += (ptr.y - ptr.sy) * (1 - Math.exp(-dt * 1.6));
    tmpV.subVectors(camPos, camLook);
    sph.setFromVector3(tmpV);
    sph.theta += ptr.sx * 0.11 + Math.sin(time * 0.13) * 0.025;
    sph.phi = clamp(sph.phi - ptr.sy * 0.06 + Math.sin(time * 0.17) * 0.012, 0.15, 1.65);
    tmpV.setFromSpherical(sph);
    camera.position.copy(camLook).add(tmpV);
    camera.lookAt(camLook);
    const fovT = baseFov + (Math.max(baseFov, 64) - baseFov) * (F.kind ? sstep(0.5, 1, F.v) : 0);
    if (Math.abs(camera.fov - fovT) > 0.01) { camera.fov = fovT; camera.updateProjectionMatrix(); }
    root.classList.toggle('is-inside', IN.on);
    camera.updateMatrixWorld();
    sky.position.copy(camera.position);
    dustU.uCam.value.copy(camera.position);
    dustU.uTime.value = time;
    dustU.uA.value = stage === 'B' ? 0.55 : 0.8;

    if (F.kind === 'dorr') {
      const U = innerDorr.U;
      U.uTime.value = time;
      U.uReveal.value = sstep(0.5, 0.95, F.v) * 1.15;
      U.uScan.value = -1.3 + 2.6 * ((time * 0.16) % 1);
      innerDorr.group.rotation.y = time * 0.04;
    }
    if (window.__dorr && window.__dorr.tracing) {
      const tr0 = window.__dorr.trace;
      tr0.push([+performance.now().toFixed(1), +p.toFixed(5), S.step, +camera.position.x.toFixed(3), +camera.position.y.toFixed(3), +camera.position.z.toFixed(3), +F.v.toFixed(3), stage]);
      if (tr0.length > 4000) tr0.shift();
    }
    // ---------------------------------------------------- A · the shell in the water
    if (stage === 'A') {
      const open = Math.max(inOut(seg(p, 0.13, 0.255)), F.open);
      if (open > 0.06 && !S.swell) { S.swell = true; Sound.shell(); }
      else if (open < 0.02) S.swell = false;
      openAmt = open;
      topValve.rotation.x = -open * 1.02 - Math.sin(time * 0.8) * 0.006 * open;
      shell.position.y = SHELL_Y + Math.sin(time * 0.55) * 0.015;
      shell.rotation.x = Math.sin(time * 0.41) * 0.006;
      shell.rotation.z = Math.sin(time * 0.33) * 0.008;
      const glow = (0.75 + 0.15 * Math.sin(time * 1.7)) * (1 - open * 0.5) + sstep(0.1, 0.2, p) * (1 - open) * 0.9;
      blockU.uGlow.value = glow * S.intro;
      glowMat.color.copy(GLOWBASE).multiplyScalar((0.6 + glow * 2.2) * S.intro);
      waterU.uTime.value = time;
      waterU.uGlow.value = (glow * 0.35 + open * 0.5) * S.intro;
      pearlU.uLum.value = 0.1 + open * 0.3 + (hover === 'pearl' ? 0.3 : 0) + F.open * 0.15;
      pearlLight.intensity = open * 2.6;
      halo.material.opacity = open * 0.22 + (hover === 'pearl' ? 0.12 : 0);
      pearl.rotation.y = time * 0.15;
      key.position.set(7.5, 5.5, 3.5);
      const pOn = sstep(0.24, 0.27, p) * (1 - sstep(0.345, 0.36, p)) * (F.v < 0.01 ? 1 : 0);
      if (pOn > 0.01) {
        pearl.getWorldPosition(tagPearl);
        toScreen(tagPearl); const cx = scr.x, cy = scr.y;
        right.setFromMatrixColumn(camera.matrixWorld, 0);
        tmpW.copy(tagPearl).addScaledVector(right, PR); toScreen(tmpW);
        const rad = Math.hypot(scr.x - cx, scr.y - cy) * 1.25 + 18;
        placeRing(ringA, cx, cy, rad, time * 7, pOn, repeatTxt(pearlRingTxt, rad));
        place(pearlTag, clamp(cx - pearlTag.w / 2, 16, W - pearlTag.w - 50), Math.max(84, cy - rad - pearlTag.h - 14), pOn);
      } else { placeRing(ringA, 0, 0, 0, 0, 0, ''); place(pearlTag, 0, 0, 0); }
    } else { placeRing(ringA, 0, 0, 0, 0, 0, ''); place(pearlTag, 0, 0, 0); openAmt = 0; }

    // ---------------------------------------------------- B · five pearls of points and lines
    if (stage === 'B') {
      const q = clamp((p - PB0) / (PB1 - PB0)) * 5;
      let active = clamp(Math.round(q - 0.5), 0, 4);
      if (F.kind === 'brand') active = F.idx;
      let pres = sstep(0.48, 0.2, Math.abs(q - (active + 0.5)));
      if (F.kind === 'brand') pres = Math.max(pres, F.v);
      for (let i = 0; i < pearls.length; i++) {
        const pe = pearls[i];
        const dq = Math.abs(q - (i + 0.5));
        const focusMe = F.kind === 'brand' && F.idx === i ? F.v : 0;
        const rv = Math.max(sstep(1.25, 0.35, dq), focusMe);
        pe.rev += (rv - pe.rev) * Math.min(1, dt * 2.5);
        const U = pe.P.U;
        U.uTime.value = time;
        U.uReveal.value = pe.rev * 1.15;
        U.uScan.value = -1.3 + 2.6 * ((time * 0.22 + i * 0.2) % 1);
        U.uSplit.value = i === 4 ? 0.5 * (1 - pe.rev) + 0.04 * Math.sin(time * 0.9) : 0;
        U.uHover.value += ((hover === i ? 1 : 0) - U.uHover.value) * 0.1;
        U.uAlpha.value = 0.4 + 0.6 * pe.rev;
        pe.g.visible = (dq < 2.2 && !(F.kind === 'brand' && F.v > 0.5 && F.idx !== i)) || focusMe > 0;
        pe.g.scale.setScalar(1 + 2.7 * sstep(0.3, 0.92, focusMe));
        U.uInside.value = sstep(0.4, 0.9, focusMe);
        if (focusMe > 0) U.uAlpha.value = Math.min(1, U.uAlpha.value + focusMe * 0.4);
        pe.P.group.rotation.y = time * (0.1 + focusMe * 0.06) + i * 1.3;
        pe.P.group.rotation.x = Math.sin(time * 0.12 + i) * 0.22;
        pe.g.position.y = pe.y0 + Math.sin(time * 0.6 + i) * 0.05;
        pe.body.material.uniforms.uA.value = 0.3 * pe.rev * (1 - sstep(0.4, 0.8, focusMe));
        pe.ring.position.y = U.uScan.value;
        const rr = Math.sqrt(Math.max(0, 1 - U.uScan.value * U.uScan.value)) * 1.01;
        pe.ring.scale.set(rr + 1e-3, 1, rr + 1e-3);
        pe.ring.material.opacity = 0.55 * pe.rev * (rr > 0.05 ? 1 : 0);
      }
      if (active !== shownBrand && pres > 0.3) showBrandTags(active);
      const pe = pearls[active];
      const tOn = pres * (F.v > 0.01 ? 1 - F.v : 1);
      if (tOn > 0.01 && shownBrand === active) {
        toScreen(pe.g.position); const cx = scr.x, cy = scr.y;
        right.setFromMatrixColumn(camera.matrixWorld, 0);
        tmpW.copy(pe.g.position).addScaledVector(right, 1.0); toScreen(tmpW);
        const rad = Math.hypot(scr.x - cx, scr.y - cy) * 1.18 + 16;
        placeRing(ringB, cx, cy, rad, -time * 5, tOn, repeatTxt(brandRingTxt, rad));
        let x, y;
        if (W < 760) { x = 16; y = cy + rad + 16; } else { x = cx + rad + 44; y = cy - bTag.h * 0.5; if (x + bTag.w > W - 70) x = cx - rad - 44 - bTag.w; }
        place(bTag, x, y, tOn);
      } else { placeRing(ringB, 0, 0, 0, 0, 0, ''); place(bTag, 0, 0, 0); }
    } else { placeRing(ringB, 0, 0, 0, 0, 0, ''); place(bTag, 0, 0, 0); if (shownBrand !== -1) { shownBrand = -1; brandLis.forEach((li) => li.classList.remove('is-now')); } }

    // ---------------------------------------------------- C · one thread, one pearl
    if (stage === 'C') {
      const U = thread.U;
      U.uTime.value = time;
      U.uActive.value = 0;
      U.uReveal.value += (1.15 - U.uReveal.value) * Math.min(1, dt * 1.6);
      U.uScan.value = -2.2 + 4.4 * ((time * 0.12) % 1);
      threadG.rotation.z = Math.sin(time * 0.3) * 0.01;
      threadG.updateMatrixWorld();
      const tOn = sstep(0.668, 0.686, p) * (1 - sstep(0.835, 0.85, p));
      right.setFromMatrixColumn(camera.matrixWorld, 0);
      strand(0, tmpW).applyMatrix4(threadG.matrixWorld);
      toScreen(tmpW); const cx = scr.x, cy = scr.y;
      tmpW.addScaledVector(right, BEAD_R); toScreen(tmpW);
      const rad = Math.hypot(scr.x - cx, scr.y - cy) * 1.3 + 16;
      placeRing(ringC, cx, cy, rad, time * 5, tOn, repeatTxt('Services Company · Shared expertise for every brand in the Group · ', rad));
    } else { placeRing(ringC, 0, 0, 0, 0, 0, ''); thread.U.uReveal.value = 0; }

    // ---------------------------------------------------- D · the orrery
    if (stage === 'D') {
      const q = seg(p, 0.85, 1);
      orrery.rotation.set(0.42 + ptr.sy * 0.12, 0, -0.12 - ptr.sx * 0.1);
      orrery.position.y = Math.sin(time * 0.4) * 0.05;
      bigPearl.rotation.y = time * 0.1;
      key.position.set(4, 8, 7);
      qTmp.copy(orrery.quaternion).invert().multiply(camera.quaternion);
      for (let k = 0; k < orbs.length; k++) {
        const o = orbs[k], a = o.a0 + time * o.sp + q * 1.6;
        o.m.position.set(Math.cos(a) * o.r, 0, Math.sin(a) * o.r);
      }
      for (let k = 0; k < slots.length; k++) {
        const a = slots[k].a0 + time * 0.05 + q * 0.8;
        slots[k].m.position.set(Math.cos(a) * ORB[2], 0, Math.sin(a) * ORB[2]);
        slots[k].m.quaternion.copy(qTmp);
      }
      orrery.updateMatrixWorld();
      const vOn = sstep(0.87, 0.9, p);
      for (let k = 0; k < orbs.length; k++) {
        orbs[k].m.getWorldPosition(tmpW); toScreen(tmpW);
        const vw = vTags[k].w || 70;
        place(vTags[k], Math.min(scr.x + 14, W - vw - 46), scr.y - 9, vOn * (tmpW.z > -0.5 ? 1 : 0.45));
      }
      slots[0].m.getWorldPosition(tmpW); toScreen(tmpW);
      place(slotTag, scr.x + 14, scr.y - 6, vOn * 0.9);
      bigPearl.getWorldPosition(tagPearl); toScreen(tagPearl); const cx = scr.x, cy = scr.y;
      right.setFromMatrixColumn(camera.matrixWorld, 0);
      tmpW.copy(tagPearl).addScaledVector(right, PR * 1.7); toScreen(tmpW);
      const rad = Math.hypot(scr.x - cx, scr.y - cy) * 1.3 + 16;
      placeRing(ringD, cx, cy, rad, -time * 4, vOn, repeatTxt(visRingTxt, rad));
    } else { hide(vTags); place(slotTag, 0, 0, 0); placeRing(ringD, 0, 0, 0, 0, 0, ''); }

    // hover (mouse only)
    if (ptr.moved && !SH.kind) {
      ptr.moved = false;
      const was = hover;
      hover = coarse ? null : pick(ptr.x, ptr.y);
      if (hover !== was && hover !== null && hover !== 'shell') Sound.tick();
      root.classList.toggle('is-pointer', hover !== null);
    }

    // hide unused wires / dots
    for (let i = wireN; i < wires.length; i++) if (wires[i].style.opacity !== '0') wires[i].style.opacity = '0';
    for (let i = dotN; i < dots.length; i++) if (dots[i].style.opacity !== '0') dots[i].style.opacity = '0';

    // ---------------------------------------------------- HTML panels and HUD
    for (let i = 0; i < panels.length; i++) {
      const pn = panels[i];
      const hero = pn.a === 0;
      let o = sstep(pn.a, pn.a + 0.015, p) * (1 - sstep(pn.b - 0.015, pn.b, p));
      if (hero) o = Math.max(o, 1 - sstep(0.05, 0.075, p)) * S.intro;
      if (F.v > 0) o *= 1 - F.v;
      const on = o > 0.5;
      if (on !== pn.on) {
        pn.on = on;
        pn.el.classList.toggle('is-in', on);
        if (on && pn.k) scramble(pn.k, pn.kt, 0.5);
      }
      const oo = Math.round(o * 100) / 100;
      if (pn.o !== oo) {
        pn.o = oo;
        pn.el.style.opacity = String(oo);
        pn.el.style.visibility = oo > 0.01 ? 'visible' : 'hidden';
        pn.el.style.translate = `0 ${((1 - oo) * 14).toFixed(1)}px`;
      }
    }
    let sk = 0;
    while (sk < LAST && p >= STOPS[sk + 1].p - 1e-6) sk++;
    const sf = sk < LAST ? clamp((p - STOPS[sk].p) / (STOPS[sk + 1].p - STOPS[sk].p)) : 0;
    const ci = STOPS[sf > 0.5 ? sk + 1 : sk].ch;
    const fill = S.mode === 'dossier' ? 1 : (sk + sf) / LAST;
    if (Math.abs(fill - (S.fill || -1)) > 0.0005) { S.fill = fill; progressBar.style.transform = `scaleY(${fill.toFixed(4)})`; }
    if (ci !== lastChapter) {
      lastChapter = ci;
      chNum.textContent = CHAPTERS[ci][1];
      scramble(chName, CHAPTERS[ci][2], 0.5);
      for (let i = 0; i < ticks.length; i++) { ticks[i].classList.toggle('is-on', i < ci); ticks[i].classList.toggle('is-now', i === ci); }
    }
    setHint(IN.on ? (coarse ? 'Swipe down · back' : 'Esc · back') : stage === 'A' && openAmt > 0.5 ? `${verb} the pearl` : stage === 'B' ? `${verb} a pearl` : stage === 'D' && !coarse ? 'Move to tilt' : coarse ? 'Swipe' : 'Scroll');

    // ---------------------------------------------------- post
    const fu = finalPass.uniforms;
    fu.uTime.value = time;
    const dorrFlash = F.kind === 'dorr' ? Math.exp(-Math.pow((F.v - 0.52) / 0.075, 2)) * 0.9 : 0;
    fu.uTrans.value = Math.max(tr, 1 - S.intro, S.flash * 0.9, dorrFlash * 0.95) * 0.98 + Math.min(S.vel * 2, 0.04);
    fu.uCA.value = 0.0012 + S.vel * 0.04;
    bloom.strength = (stage === 'B' || stage === 'C' ? 0.55 : 0.32) + (F.kind ? 0.25 * F.v : 0);
    bloom.threshold = stage === 'A' ? 1.35 : 1.1;
    composer.render();
  };

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { running = false; cancelAnimationFrame(raf); }
    else if (!running) { running = true; clock.getDelta(); raf = requestAnimationFrame(frame); }
  });

  window.__dorr = {
    S, F, pearls, thread, camera, renderer, bloom, finalPass, scene, LOOK, blockU, glowMat,
    setP: (v) => { S.p = v; let k = 0, b = 1e9; STOPS.forEach((st0, i) => { const d0 = Math.abs(st0.p - v); if (d0 < b) { b = d0; k = i; } }); S.step = k; },
    STOPS, IN, goStep, stepBy, jumpTo, enterPearl, exitPearl, insideStep, toDossier, toFilm, mode: () => S.mode,
    trace: [], tracing: false,
    open: openSheet, close: closeSheet,
  };

  /* ============================================================ boot */
  const bootNum = $('[data-boot-num]'), bootBar = $('[data-boot-bar]');
  const v = { n: 0 };
  const paint = () => { bootNum.textContent = String(Math.round(v.n)).padStart(3, '0'); bootBar.style.transform = `scaleX(${v.n / 100})`; };
  await step('Opening the room');
  try { await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]); } catch (e) { /* fonts are optional */ }
  measure(pearlTag);
  vTags.forEach(measure);
  // compile every stage once so later chapters do not hitch
  stageA.visible = stageB.visible = stageC.visible = stageD.visible = true;
  samplePath(PATH_A, 0, camPos, camLook);
  camera.position.copy(camPos); camera.lookAt(camLook);
  try { renderer.compile(scene, camera); } catch (e) { /* compile is a warm-up only */ }
  frame();
  await new Promise((r) => gsap.to(v, { n: 100, duration: 1.2, ease: 'power2.inOut', onUpdate: paint, onComplete: r }));
  await askSound();
  const hm = /^#s(\d+)$/.exec(location.hash);
  const startDossier = location.hash === '#dossier' || location.hash === '#contact';
  if (hm) { S.step = clamp(+hm[1], 0, LAST); S.p = STOPS[S.step].p; }
  gsap.timeline()
    .to('[data-boot]', { autoAlpha: 0, duration: 0.9, ease: 'power2.out' })
    .add(() => {
      $('[data-boot]')?.remove();
      ScrollTrigger.refresh();
      S.ready = true;
      if (startDossier) { S.mode = 'dossier'; if (lenis) { lenis.start(); lenis.scrollTo(dossierEl, { immediate: true, force: true }); } writeHistory('dossier', false); }
      else { syncScroll(); writeHistory(S.step, false); }
    }, '-=0.5')
    .to(S, { intro: 1, duration: 2.8, ease: 'power2.inOut' }, '-=0.7')
    .from('.hud', { autoAlpha: 0, duration: 1.2, stagger: 0.15 }, '<0.8');
}

main().catch((e) => { console.warn('DORR v10: falling back to the static page', e); goStatic(); });
