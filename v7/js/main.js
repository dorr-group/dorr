/* DORR — Version 7 · "The Return"
   Motion system written for this site: own splitter, own reveal vocabulary,
   own router. GSAP 3.12 + ScrollTrigger + Lenis 1.1 (local copies). */
(() => {
  'use strict';

  const root = document.documentElement;
  const gsap = window.gsap;
  const ST = window.ScrollTrigger;
  const hasGsap = !!(gsap && ST);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const motion = hasGsap && !reduce;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const BP = 992;
  const isDesk = () => innerWidth >= BP;
  const rem = () => parseFloat(getComputedStyle(root).fontSize) || 1;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  /* ---------- easing: cubic-bezier solver (own) ---------- */
  function bezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const sx = (t) => ((ax * t + bx) * t + cx) * t;
    const sy = (t) => ((ay * t + by) * t + cy) * t;
    const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
    return (x) => {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      let t = x;
      for (let i = 0; i < 8; i++) {
        const e = sx(t) - x;
        if (Math.abs(e) < 1e-5) return sy(t);
        const d = dx(t);
        if (Math.abs(d) < 1e-6) break;
        t -= e / d;
      }
      let lo = 0, hi = 1; t = x;
      while (hi - lo > 1e-5) { if (sx(t) < x) lo = t; else hi = t; t = (lo + hi) / 2; }
      return sy(t);
    };
  }
  const E = {
    out: bezier(.25, 1, .5, 1),
    inout: bezier(.76, 0, .24, 1),
    in: bezier(.5, 0, .75, 0),
    ease: bezier(.25, .1, .25, 1),
    dive: bezier(.6, 0, 0, 1),
  };
  // a progress line that hesitates, like a breath held mid-way
  E.breath = (t) => t < .32 ? .46 * E.out(t / .32) : t < .62 ? .46 + .1 * E.ease((t - .32) / .3) : .56 + .44 * E.inout((t - .62) / .38);
  const D = { s: .4, m: .8, l: 1.2 };
  const STAG = .1;
  const DELAY = .3;

  /* ---------- text splitting (own) ---------- */
  function srCopy(el, text) {
    const s = document.createElement('span');
    s.className = 'sr-only';
    s.textContent = text.replace(/\s+/g, ' ').trim();
    el.appendChild(s);
  }
  function tokens(el) {
    const out = [];
    const walk = (node) => {
      node.childNodes.forEach((n) => {
        if (n.nodeType === 3) {
          n.textContent.split(/(\s+)/).forEach((w) => { if (w) out.push(/\s+/.test(w) ? { sp: true } : { w }); });
        } else if (n.nodeName === 'BR') out.push({ br: true });
        else if (n.nodeType === 1 && !n.classList.contains('sr-only')) walk(n);
      });
    };
    walk(el);
    return out;
  }
  function wordSpan(w, chars) {
    const ws = document.createElement('span');
    ws.className = 'sx-w';
    if (chars) {
      Array.from(w).forEach((c) => {
        const cs = document.createElement('span');
        cs.className = 'sx-c';
        cs.textContent = c;
        ws.appendChild(cs);
      });
    } else ws.textContent = w;
    return ws;
  }
  function splitChars(el) {
    if (el._chars) return el._chars;
    const text = el.textContent;
    const toks = tokens(el);
    const wrap = document.createElement('span');
    wrap.setAttribute('aria-hidden', 'true');
    toks.forEach((t) => {
      if (t.br) wrap.appendChild(document.createElement('br'));
      else if (t.sp) wrap.appendChild(document.createTextNode(' '));
      else wrap.appendChild(wordSpan(t.w, true));
    });
    el.textContent = '';
    el.appendChild(wrap);
    srCopy(el, text);
    el._chars = $$('.sx-c', wrap);
    return el._chars;
  }
  function splitLines(el) {
    if (!el._orig) { el._orig = el.innerHTML; el._text = el.textContent; }
    el.innerHTML = el._orig;
    const toks = tokens(el);
    const wrap = document.createElement('span');
    wrap.setAttribute('aria-hidden', 'true');
    wrap.style.display = 'block';
    const words = [];
    toks.forEach((t) => {
      if (t.br) { const b = document.createElement('br'); wrap.appendChild(b); words.push({ br: true }); }
      else if (t.sp) wrap.appendChild(document.createTextNode(' '));
      else { const s = wordSpan(t.w, false); wrap.appendChild(s); words.push({ el: s }); }
    });
    el.textContent = '';
    el.appendChild(wrap);
    const lines = [];
    let cur = null, top = null;
    words.forEach((w) => {
      if (w.br) { cur = null; top = null; return; }
      const y = w.el.offsetTop;
      if (!cur || Math.abs(y - top) > 3) { cur = []; lines.push(cur); top = y; }
      cur.push(w.el.textContent);
    });
    wrap.textContent = '';
    const out = lines.map((ln) => {
      const m = document.createElement('span'); m.className = 'sx-m';
      const l = document.createElement('span'); l.className = 'sx-l';
      l.textContent = ln.join(' ');
      m.appendChild(l); wrap.appendChild(m);
      return l;
    });
    srCopy(el, el._text);
    el._lines = out;
    el._w = el.clientWidth;
    return out;
  }

  /* ---------- reveal vocabulary ---------- */
  const R = {
    a(els, mode, delay) {
      els.forEach((el, i) => {
        const c = splitChars(el);
        const r = rem();
        if (mode === 'init') return gsap.set(c, { opacity: 0, rotateX: -90, x: -10 * r, transformOrigin: '50% 0%', transformPerspective: 600 });
        if (mode === 'show') return gsap.fromTo(c, { opacity: 0, rotateX: 90, x: 10 * r, transformOrigin: '50% 100%', transformPerspective: 600 },
          { opacity: 1, rotateX: 0, x: 0, duration: D.l, delay: (delay ?? DELAY) + i * STAG, stagger: STAG, ease: E.out, overwrite: true });
        return gsap.to(c, { opacity: 0, rotateX: -90, x: -10 * r, transformOrigin: '50% 0%', duration: D.s, delay: delay ?? 0, stagger: STAG / 2, ease: E.in, overwrite: true });
      });
    },
    h(els, mode, delay) {
      els.forEach((el, i) => {
        const c = splitChars(el);
        if (mode === 'init') return gsap.set(c, { opacity: 0, yPercent: 50, rotateY: 90, transformPerspective: 800 });
        if (mode === 'show') return gsap.fromTo(c, { opacity: 0, yPercent: 50, rotateY: 90, transformPerspective: 800 },
          { opacity: 1, yPercent: 0, rotateY: 0, duration: D.l, delay: (delay ?? DELAY) + i * STAG, stagger: STAG / 2, ease: E.out, overwrite: true });
        return gsap.to(c, { opacity: 0, yPercent: -50, rotateY: -90, duration: D.s, delay: delay ?? 0, stagger: STAG / 4, ease: E.in, overwrite: true });
      });
    },
    p(els, mode, delay) {
      els.forEach((el, i) => {
        const l = el._lines || splitLines(el);
        if (mode === 'init') { el._shown = false; return gsap.set(l, { yPercent: 110 }); }
        if (mode === 'show') { el._shown = true; return gsap.fromTo(l, { yPercent: 110 }, { yPercent: 0, duration: D.l, delay: (delay ?? DELAY) + i * STAG, stagger: STAG, ease: E.out, overwrite: true }); }
        el._shown = false;
        return gsap.to(l, { yPercent: -110, duration: D.s, delay: delay ?? 0, stagger: STAG / 2, ease: E.in, overwrite: true });
      });
    },
    ctn(els, mode, delay) {
      if (!els.length) return;
      const y = (isDesk() ? 48 : 40) * rem();
      if (mode === 'init') return gsap.set(els, { opacity: 0, y });
      if (mode === 'show') return gsap.fromTo(els, { opacity: 0, y }, { opacity: 1, y: 0, duration: D.l, delay: delay ?? DELAY, stagger: STAG, ease: E.out, overwrite: true });
      return gsap.to(els, { opacity: 0, y: 0, duration: D.s, delay: delay ?? 0, stagger: STAG / 2, ease: E.in, overwrite: true });
    },
    line(els, mode, delay) {
      if (!els.length) return;
      if (mode === 'init') return gsap.set(els, { clipPath: 'inset(0% 0% 100% 0%)' });
      if (mode === 'show') return gsap.fromTo(els, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: D.l, delay: delay ?? DELAY, stagger: STAG, ease: E.out, overwrite: true });
      return gsap.to(els, { clipPath: 'inset(100% 0% 0% 0%)', duration: D.s, delay: delay ?? 0, ease: E.in, overwrite: true });
    },
    slide(els, mode, delay) {
      if (!els.length) return;
      const kids = els.map((e) => e.firstElementChild).filter(Boolean);
      const hidden = 'polygon(100% 0%, 100% 0%, 101% 100%, 125% 100%)';
      const full = 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)';
      if (mode === 'init') { gsap.set(els, { clipPath: hidden }); return gsap.set(kids, { scale: 1.5, xPercent: 25 }); }
      if (mode === 'show') {
        gsap.fromTo(els, { clipPath: hidden }, { clipPath: full, duration: D.l, delay: delay ?? DELAY, ease: E.inout, overwrite: true });
        return gsap.fromTo(kids, { scale: 1.5, xPercent: 25 }, { scale: 1, xPercent: 0, duration: D.l, delay: delay ?? DELAY, ease: E.inout, overwrite: true });
      }
      gsap.fromTo(els, { clipPath: 'polygon(0% 0%, 100% 0%, 125% 100%, 0% 100%)' }, { clipPath: 'polygon(0% 0%, 0% 0%, 0% 100%, 0% 100%)', duration: D.l, delay: delay ?? 0, ease: E.inout, overwrite: true });
      return gsap.to(kids, { scale: 1.5, xPercent: -25, duration: D.l, delay: delay ?? 0, ease: E.inout, overwrite: true });
    },
  };
  const play = (attr, scope, mode, delay) => {
    Object.keys(R).forEach((k) => {
      const els = $$(`[${attr}="${k}"]`, scope);
      if (els.length) R[k](els, mode, delay);
    });
  };
  const inView = (el) => { const b = el.getBoundingClientRect(); return b.bottom > 0 && b.top < innerHeight && b.right > 0 && b.left < innerWidth; };

  /* ---------- state ---------- */
  let lenis = null;
  let page = null;           // gsap.context for the current page
  let pageCleanups = [];
  let hTween = null;         // horizontal container animation
  const onPageClean = (fn) => pageCleanups.push(fn);

  function lock() {
    if (lenis) lenis.stop();
    root.style.overflow = 'hidden';
  }
  function unlock() {
    root.style.overflow = '';
    if (lenis) lenis.start();
  }
  function scrollTo(target, opts = {}) {
    if (lenis) lenis.scrollTo(target, { duration: opts.immediate ? 0 : 1.6, immediate: !!opts.immediate, offset: opts.offset || 0, force: true });
    else {
      const y = typeof target === 'number' ? target : (target.getBoundingClientRect().top + scrollY + (opts.offset || 0));
      window.scrollTo({ top: y, behavior: opts.immediate || reduce ? 'auto' : 'smooth' });
    }
  }

  /* ---------- smooth scroll ---------- */
  function initLenis() {
    if (!motion || !window.Lenis) return;
    lenis = new window.Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      syncTouch: false,
      touchMultiplier: 2,
    });
    lenis.on('scroll', ST.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  /* ---------- chrome: badge, rail, cue ---------- */
  function initBadge() {
    const ring = $('.badge__ring');
    if (!ring || !motion) return;
    const st = { speed: 30 };
    let ang = 0, dir = 1, timer = 0, user = false;
    const mark = () => { user = true; };
    addEventListener('wheel', mark, { once: true, passive: true });
    addEventListener('touchmove', mark, { once: true, passive: true });
    gsap.ticker.add((t, dt) => {
      ang += st.speed * (Math.min(dt, 100) / 1000);
      ring.setAttribute('transform', `rotate(${ang.toFixed(2)} 60 60)`);
    });
    if (lenis) lenis.on('scroll', ({ velocity }) => {
      if (!user) return;
      if (velocity) dir = velocity > 0 ? 1 : -1;
      gsap.to(st, { speed: dir * (30 + 10 * Math.abs(velocity)), duration: .3, ease: E.out, overwrite: true });
      clearTimeout(timer);
      timer = setTimeout(() => gsap.to(st, { speed: 30 * dir, duration: D.l, ease: E.out }), 100);
    });
  }
  function initRail() {
    const rail = $('.rail');
    if (!rail) return;
    const num = $('.rail__num', rail);
    const thumb = $('.rail__thumb', rail);
    const update = (p) => {
      rail.style.setProperty('--p', (p * 100).toFixed(2) + '%');
      num.textContent = String(Math.round(p * 100)).padStart(2, '0');
    };
    if (hasGsap) ST.create({ start: 0, end: 'max', onUpdate: (s) => update(s.progress) });
    else addEventListener('scroll', () => update(scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight)), { passive: true });
    let drag = false;
    thumb.addEventListener('pointerdown', (e) => { drag = true; thumb.setPointerCapture(e.pointerId); document.body.style.cursor = 'grabbing'; });
    thumb.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const b = rail.getBoundingClientRect();
      const p = Math.max(0, Math.min(1, (e.clientY - b.top) / b.height));
      const max = document.documentElement.scrollHeight - innerHeight;
      if (lenis) lenis.scrollTo(p * max, { duration: 1.2 }); else window.scrollTo(0, p * max);
    });
    const end = () => { drag = false; document.body.style.cursor = ''; };
    thumb.addEventListener('pointerup', end);
    thumb.addEventListener('pointercancel', end);
  }

  /* ---------- micro-interactions ---------- */
  function initRoll(scope) {
    $$('[data-roll]', scope).forEach((el) => {
      if (el._roll) return;
      el._roll = true;
      const text = el.textContent.trim();
      const box = document.createElement('span'); box.className = 'roll'; box.setAttribute('aria-hidden', 'true');
      const a = document.createElement('span'); a.className = 'roll__a'; a.textContent = text;
      const b = document.createElement('span'); b.className = 'roll__b'; b.textContent = text;
      box.append(a, b);
      el.textContent = '';
      el.append(box);
      srCopy(el, text);
      if (!motion || !fine) { b.remove(); return; }
      const ca = splitChars(a), cb = splitChars(b);
      gsap.set(cb, { yPercent: 100, opacity: 0 });
      const byX = (list) => {
        const xs = list.map((c) => c.offsetLeft); const mn = Math.min(...xs); const span = (Math.max(...xs) - mn) || 1;
        return (i) => ((xs[i] - mn) / span) * STAG * 2;
      };
      el.addEventListener('mouseenter', () => {
        gsap.to(ca, { yPercent: -100, opacity: 0, duration: D.m, ease: E.ease, stagger: byX(ca), overwrite: true });
        gsap.to(cb, { yPercent: 0, opacity: 1, duration: D.m, ease: E.ease, stagger: byX(cb), overwrite: true });
      });
      el.addEventListener('mouseleave', () => {
        gsap.to(ca, { yPercent: 0, opacity: 1, duration: D.m, ease: E.ease, stagger: byX(ca), overwrite: true });
        gsap.to(cb, { yPercent: 100, opacity: 0, duration: D.m, ease: E.ease, stagger: byX(cb), overwrite: true });
      });
    });
  }
  function initFlip(scope) {
    $$('[data-flip]', scope).forEach((el) => {
      if (el._flip) return;
      el._flip = true;
      const html = el.innerHTML;
      const text = el.textContent;
      const wrap = document.createElement('span'); wrap.className = 'sx-flip'; wrap.setAttribute('aria-hidden', 'true');
      const a = document.createElement('span'); a.innerHTML = html;
      const b = document.createElement('span'); b.innerHTML = html;
      b.style.cssText = 'position:absolute;left:0;top:0;width:100%;';
      wrap.append(a, b);
      el.textContent = '';
      el.append(wrap);
      srCopy(el, text);
      // one underline per visual line
      const lines = a.innerHTML.split(/<br\s*\/?>/i);
      a.innerHTML = lines.map((l) => `<span class="sx-l">${l}<i class="flip-line"></i></span>`).join('');
      b.innerHTML = lines.map((l) => `<span class="sx-l">${l}</span>`).join('');
      if (el.classList.contains('hd__big')) { a.querySelectorAll('.sx-l').forEach((s) => (s.style.display = 'block')); b.querySelectorAll('.sx-l').forEach((s) => (s.style.display = 'block')); }
      else { a.querySelectorAll('.sx-l').forEach((s) => (s.style.cssText = 'display:inline-block;position:relative')); b.querySelectorAll('.sx-l').forEach((s) => (s.style.display = 'inline-block')); }
      const ul = $$('.flip-line', a);
      if (!el.classList.contains('hd__big')) ul.forEach((u) => (u.style.opacity = '.5'));
      if (!motion || !fine) { b.remove(); return; }
      const ca = [], cb = [];
      $$('.sx-l', a).forEach((s) => { const line = s.querySelector('.flip-line'); line.remove(); ca.push(...splitChars(s)); s.appendChild(line); });
      $$('.sx-l', b).forEach((s) => cb.push(...splitChars(s)));
      gsap.set(cb, { opacity: 0, x: '-0.4em', yPercent: 25, rotateY: 90, transformPerspective: 500 });
      el.addEventListener('mouseenter', () => {
        gsap.fromTo(ca, { opacity: 1, x: 0, yPercent: 0, rotateY: 0 }, { opacity: 0, x: '0.4em', yPercent: -25, rotateY: -90, duration: D.m, ease: E.out, stagger: STAG / 4, overwrite: true });
        gsap.fromTo(cb, { opacity: 0, x: '-0.4em', yPercent: 25, rotateY: 90 }, { opacity: 1, x: 0, yPercent: 0, rotateY: 0, duration: D.m, ease: E.out, delay: .2, stagger: STAG / 4, overwrite: true });
        gsap.fromTo(ul, { scaleX: 1, transformOrigin: '100% 50%' }, { scaleX: 0, duration: D.m, ease: E.out, stagger: STAG, overwrite: true });
      });
      el.addEventListener('mouseleave', () => {
        gsap.to(ca, { opacity: 1, x: 0, yPercent: 0, rotateY: 0, duration: D.m, ease: E.out, delay: .2, stagger: STAG / 4, overwrite: true });
        gsap.to(cb, { opacity: 0, x: '-0.4em', yPercent: 25, rotateY: 90, duration: D.m, ease: E.out, stagger: STAG / 4, overwrite: true });
        gsap.to(ul, { scaleX: 1, transformOrigin: '0% 50%', duration: D.m, ease: E.out, stagger: STAG, overwrite: true });
      });
    });
  }
  function initMagnetic(scope) {
    if (!motion || !fine) return;
    $$('[data-magnetic]', scope).forEach((el) => {
      if (el._mag) return;
      el._mag = true;
      const inner = el.querySelector('.btn__t');
      el.addEventListener('mousemove', (e) => {
        if (!isDesk()) return;
        const b = el.getBoundingClientRect();
        const fx = (e.clientX - b.left) / b.width - .5, fy = (e.clientY - b.top) / b.height - .5;
        gsap.to(el, { x: fx * 26, y: fy * 26, duration: 1.6, ease: 'power4.out' });
        if (inner) gsap.to(inner, { x: fx * 14, y: fy * 14, duration: 2, ease: 'power4.out' });
      });
      el.addEventListener('mouseleave', () => {
        gsap.to(el, { x: 0, y: 0, duration: 1.6, ease: 'elastic.out(1, 0.3)' });
        if (inner) gsap.to(inner, { x: 0, y: 0, duration: 1.6, ease: 'elastic.out(1, 0.3)' });
      });
    });
  }

  /* ---------- floating paper tip ---------- */
  const tip = { el: null, on: false };
  function initTip() {
    tip.el = $('.tip');
    if (!tip.el) return;
    tip.script = $('.tip__script', tip.el); tip.t = $('.tip__t', tip.el); tip.p = $('.tip__p', tip.el);
    if (hasGsap && fine) {
      addEventListener('mousemove', (e) => {
        if (!tip.on) return;
        tip.el.classList.toggle('is-left', e.clientX + 320 > innerWidth);
        gsap.to(tip.el, { x: e.clientX, y: e.clientY, duration: 2 * D.l, ease: 'power3', overwrite: 'auto' });
      }, { passive: true });
    }
  }
  function showTip(pin, x, y) {
    if (!tip.el) return;
    tip.script.textContent = pin.dataset.tipScript || '';
    tip.t.textContent = pin.dataset.tipTitle || '';
    tip.p.textContent = pin.dataset.tipText || '';
    if (hasGsap) gsap.set(tip.el, { x, y }); else tip.el.style.transform = `translate(${x}px,${y}px)`;
    tip.el.classList.toggle('is-left', x + 320 > innerWidth);
    tip.el.classList.add('is-on');
    tip.on = true;
  }
  function hideTip() { if (tip.el) { tip.el.classList.remove('is-on'); tip.on = false; } }

  /* ---------- menu ---------- */
  const menu = { open: false, busy: false };
  function initMenu() {
    menu.el = $('#menu');
    menu.btn = $('.hd__menu');
    if (!menu.el || !menu.btn) return;
    menu.panel = $('.menu__panel', menu.el);
    menu.over = $('.menu__over', menu.el);
    menu.x = $$('.menu__close i', menu.el);
    menu.btn.addEventListener('click', () => (menu.open ? closeMenu() : openMenu()));
    $$('[data-menu-close]', menu.el).forEach((b) => b.addEventListener('click', () => closeMenu()));
    document.addEventListener('keydown', (e) => {
      if (!menu.open) return;
      if (e.key === 'Escape') { closeMenu(); return; }
      if (e.key === 'Tab') {
        const f = $$('a, button', menu.panel);
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    if (motion) { gsap.set(menu.x, { rotate: 180 }); }
  }
  function openMenu() {
    if (menu.open) return;
    menu.open = true;
    menu.el.hidden = false;
    menu.btn.setAttribute('aria-expanded', 'true');
    lock();
    if (motion) {
      gsap.fromTo(menu.over, { opacity: 0 }, { opacity: 1, duration: D.m, ease: E.out });
      gsap.fromTo(menu.panel, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: D.l, ease: E.inout });
      gsap.to(menu.x[0], { rotate: 45, duration: D.m, ease: E.inout, delay: .2 });
      gsap.to(menu.x[1], { rotate: -45, duration: D.m, ease: E.inout, delay: .2 });
      play('data-part', menu.el, 'init');
      play('data-part', menu.el, 'show', .45);
    } else { menu.x[0].style.transform = 'rotate(45deg)'; menu.x[1].style.transform = 'rotate(-45deg)'; }
    setTimeout(() => { const a = $('.menu__nav a', menu.el); if (a) a.focus({ preventScroll: true }); }, 60);
  }
  function closeMenu(fast) {
    if (!menu.open) return Promise.resolve();
    menu.open = false;
    menu.btn.setAttribute('aria-expanded', 'false');
    unlock();
    return new Promise((res) => {
      const done = () => { menu.el.hidden = true; res(); };
      if (!motion || fast) { done(); return; }
      play('data-part', menu.el, 'hide');
      gsap.to(menu.x, { rotate: 180, duration: D.m, ease: E.inout });
      gsap.to(menu.over, { opacity: 0, duration: D.m, ease: E.in });
      gsap.to(menu.panel, { clipPath: 'inset(100% 0% 0% 0%)', duration: D.m, ease: E.inout, delay: .1, onComplete: done });
      menu.btn.focus({ preventScroll: true });
    });
  }

  /* ---------- header theme follows the ground ---------- */
  function setTheme(els, theme) { els.forEach((e) => e.setAttribute('data-theme', theme)); }
  function initThemes(scope) {
    const hd = [$('.hd')];
    const side = $$('.rail, .cue');
    const map = (bg) => (bg === 'image' || bg === 'dark' ? 'dark' : 'light');
    const secs = $$('[data-bg]', scope);
    if (!hasGsap) return;
    secs.forEach((s) => {
      const theme = map(s.dataset.bg);
      ST.create({ trigger: s, start: 'top 60px', end: 'bottom 60px', onToggle: (self) => self.isActive && setTheme(hd, theme) });
      ST.create({ trigger: s, start: 'top center', end: 'bottom center', onToggle: (self) => self.isActive && setTheme(side, theme) });
    });
    // initial state
    const first = secs.find((s) => { const b = s.getBoundingClientRect(); return b.top <= 60 && b.bottom > 60; }) || secs[0];
    if (first) { setTheme(hd, map(first.dataset.bg)); setTheme(side, map(first.dataset.bg)); }
  }

  /* ---------- scroll reveals ---------- */
  function initReveals(scope) {
    const groups = new Map();
    $$('[data-reveal]', scope).forEach((el) => {
      const k = el.dataset.reveal;
      const key = el;
      if (!groups.has(key)) groups.set(key, { el, k });
    });
    groups.forEach(({ el, k }) => {
      if (!motion) return;
      R[k]([el], 'init');
      const inTravel = hTween && el.closest('.travel__track');
      ST.create({
        trigger: el,
        start: inTravel ? 'left 92%' : 'top 94%',
        containerAnimation: inTravel ? hTween : undefined,
        once: true,
        onEnter: () => R[k]([el], 'show', k === 'slide' ? .1 : .15),
      });
    });
  }

  /* ---------- hero: day / night + pins ---------- */
  function initHero(scope) {
    const hero = $('.hero', scope);
    if (!hero) return;
    const night = $('.hero__img--night', hero);
    const btns = $$('[data-light]', hero);
    btns.forEach((b) => b.addEventListener('click', () => {
      const isNight = b.dataset.light === 'night';
      if (isNight === hero.classList.contains('is-night')) return;
      hero.classList.toggle('is-night', isNight);
      btns.forEach((x) => { const on = x === b; x.classList.toggle('is-active', on); x.setAttribute('aria-pressed', String(on)); });
      if (hasGsap) gsap.to(night, { opacity: isNight ? 1 : 0, duration: reduce ? 0 : D.m * 1.5, ease: E.inout });
      else night.style.opacity = isNight ? 1 : 0;
    }));
    $$('.pin', hero).forEach((pin) => {
      if (fine) {
        pin.addEventListener('mouseenter', (e) => showTip(pin, e.clientX, e.clientY));
        pin.addEventListener('mouseleave', hideTip);
      }
      pin.addEventListener('focus', () => { const b = pin.getBoundingClientRect(); showTip(pin, b.right, b.top + b.height / 2); });
      pin.addEventListener('blur', hideTip);
      pin.addEventListener('click', () => {
        const b = pin.getBoundingClientRect();
        if (pin.classList.contains('is-on')) { pin.classList.remove('is-on'); hideTip(); return; }
        $$('.pin', hero).forEach((p) => p.classList.remove('is-on'));
        pin.classList.add('is-on');
        showTip(pin, Math.min(b.left, innerWidth - 300), b.top + b.height / 2);
      });
    });
    onPageClean(hideTip);
    if (!motion) return;
    // the dive
    const media = $('[data-hero-media]', hero);
    const content = $('.hero__content', hero);
    const tl = gsap.timeline({ scrollTrigger: { trigger: hero.parentElement, start: 'top top', end: 'bottom bottom', scrub: true, onLeave: hideTip } });
    if (isDesk()) tl.fromTo(content, { y: 0 }, { y: () => -innerHeight * .62, ease: E.ease, duration: .6 }, 0);
    else tl.fromTo(content, { y: 0 }, { y: () => -innerHeight * .3, ease: 'none', duration: .6 }, 0);
    tl.fromTo(media, { scale: 1 }, { scale: 2, ease: E.in, duration: .6 }, isDesk() ? .2 : 0);
  }

  function heroIntro(scope, delay) {
    const hero = $('.hero', scope);
    if (!hero || !motion) return;
    play('data-part', hero, 'show', delay);
    gsap.fromTo($$('.pin', hero), { opacity: 0, scale: .4 }, { opacity: 1, scale: 1, duration: D.l, ease: E.out, stagger: STAG, delay: (delay || 0) + .8 });
  }

  /* ---------- dome ---------- */
  function initDome(scope) {
    const dome = $('.dome', scope);
    if (!dome || !motion) return;
    const arch = $('.dome__arch', dome);
    gsap.fromTo(arch, { scale: 1 }, { scale: isDesk() ? 1.14 : 1.08, ease: 'none', scrollTrigger: { trigger: dome, start: 'top 55%', end: 'top top', scrub: true } });
    const ring = $('.dome__ring text', dome);
    gsap.fromTo(ring, { '--ws': '0px' }, { '--ws': isDesk() ? '30px' : '18px', ease: 'none', scrollTrigger: { trigger: dome, start: 'top bottom', end: 'top -30%', scrub: true } });
  }

  /* ---------- tabs (four reasons) ---------- */
  function initTabs(scope) {
    const box = $('[data-tabs]', scope);
    if (!box) return;
    const panels = $$('[data-panel]', box);
    const btns = $$('[role="tab"]', box);
    const hilite = $('.benefits__hilite', box);
    const bar = $('.benefits__progress b', box);
    let cur = 0, busy = false, timer = null, visible = false;
    const place = () => {
      const b = btns[cur];
      if (hasGsap) gsap.to(hilite, { x: b.offsetLeft, width: b.offsetWidth, duration: motion ? D.m : 0, ease: E.inout });
    };
    const runBar = () => {
      if (!hasGsap || reduce) return;
      gsap.killTweensOf(bar);
      gsap.fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: 6, ease: 'none' });
    };
    const go = (n, user) => {
      if (n === cur || busy) return;
      const a = panels[cur], b = panels[n];
      btns.forEach((x, i) => { x.classList.toggle('is-active', i === n); x.setAttribute('aria-selected', String(i === n)); x.tabIndex = i === n ? 0 : -1; });
      cur = n;
      place();
      if (!motion) {
        a.classList.remove('is-active'); b.classList.add('is-active');
        return;
      }
      busy = true;
      b.classList.add('is-going');
      const q = (el, k) => $$(`[data-t="${k}"]`, el);
      R.h(q(b, 'h'), 'init'); R.p(q(b, 'p'), 'init'); R.slide(q(b, 'slide'), 'init');
      R.h(q(a, 'h'), 'hide', 0); R.p(q(a, 'p'), 'hide', 0); R.slide(q(a, 'slide'), 'hide', 0);
      gsap.set(b, { zIndex: 2 }); gsap.set(a, { zIndex: 1 });
      R.slide(q(b, 'slide'), 'show', 0);
      gsap.delayedCall(D.m, () => { R.h(q(b, 'h'), 'show', 0); R.p(q(b, 'p'), 'show', D.s); });
      gsap.delayedCall(D.m + D.s, () => { a.classList.remove('is-active'); b.classList.remove('is-going'); b.classList.add('is-active'); busy = false; });
      if (user) restart();
    };
    const restart = () => {
      clearInterval(timer);
      if (reduce || !visible) return;
      runBar();
      timer = setInterval(() => { go((cur + 1) % panels.length); runBar(); }, 6000);
    };
    btns.forEach((b, i) => {
      b.tabIndex = i === 0 ? 0 : -1;
      b.addEventListener('click', () => go(i, true));
      b.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault();
          const n = (cur + (e.key === 'ArrowRight' ? 1 : -1) + btns.length) % btns.length;
          go(n, true); btns[n].focus();
        }
      });
    });
    requestAnimationFrame(place);
    addEventListener('resize', place);
    onPageClean(() => removeEventListener('resize', place));
    const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) restart(); else clearInterval(timer); }, { threshold: .35 });
    io.observe(box);
    onPageClean(() => { io.disconnect(); clearInterval(timer); });
    if (motion) {
      const first = panels[0];
      const q = (k) => $$(`[data-t="${k}"]`, first);
      R.h(q('h'), 'init'); R.p(q('p'), 'init'); R.slide(q('slide'), 'init');
      ST.create({ trigger: box, start: 'top 70%', once: true, onEnter: () => { R.h(q('h'), 'show', .1); R.slide(q('slide'), 'show', 0); R.p(q('p'), 'show', .5); } });
    }
  }

  /* ---------- brands slider ---------- */
  function initSlider(scope) {
    const box = $('[data-slider]', scope);
    if (!box) return;
    const slides = $$('[data-slide]', box);
    const cur$ = $('[data-current]', box), prog = $('[data-progress]', box);
    let cur = 0, busy = false, timer = null, visible = false;
    const pad = (n) => String(n).padStart(2, '0');
    const q = (el, k) => $$(`[data-s="${k}"]`, el);
    const runBar = () => { if (!hasGsap || reduce) return; gsap.killTweensOf(prog); gsap.fromTo(prog, { scaleX: 0 }, { scaleX: 1, duration: 6, ease: 'none' }); };
    const go = (n, user) => {
      if (busy || n === cur) return;
      const a = slides[cur], b = slides[n];
      cur = n;
      cur$.textContent = pad(n + 1);
      if (!motion) { a.classList.remove('is-active'); b.classList.add('is-active'); return; }
      busy = true;
      b.classList.add('is-going');
      gsap.set(b, { zIndex: 2 }); gsap.set(a, { zIndex: 1 });
      R.h(q(b, 'h'), 'init'); R.p(q(b, 'p'), 'init'); R.ctn(q(b, 'ctn'), 'init'); R.slide(q(b, 'slide'), 'init');
      R.h(q(a, 'h'), 'hide', 0); R.p(q(a, 'p'), 'hide', 0); R.ctn(q(a, 'ctn'), 'hide', 0); R.slide(q(a, 'slide'), 'hide', 0);
      R.slide(q(b, 'slide'), 'show', 0);
      gsap.delayedCall(D.m, () => { R.h(q(b, 'h'), 'show', 0); R.p(q(b, 'p'), 'show', 0); R.ctn(q(b, 'ctn'), 'show', D.s); });
      gsap.delayedCall(D.m + D.s, () => { a.classList.remove('is-active'); b.classList.remove('is-going'); b.classList.add('is-active'); busy = false; });
      if (user) restart();
    };
    const restart = () => {
      clearInterval(timer);
      if (reduce || !visible) return;
      runBar();
      timer = setInterval(() => { go((cur + 1) % slides.length); runBar(); }, 6000);
    };
    $('[data-next]', box).addEventListener('click', () => go((cur + 1) % slides.length, true));
    $('[data-prev]', box).addEventListener('click', () => go((cur - 1 + slides.length) % slides.length, true));
    let sx = null;
    box.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
    box.addEventListener('touchend', (e) => {
      if (sx === null) return;
      const dx = e.changedTouches[0].clientX - sx; sx = null;
      if (Math.abs(dx) > 50) go((cur + (dx < 0 ? 1 : -1) + slides.length) % slides.length, true);
    }, { passive: true });
    const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) restart(); else clearInterval(timer); }, { threshold: .4 });
    io.observe(box);
    onPageClean(() => { io.disconnect(); clearInterval(timer); });
    if (motion) {
      const first = slides[0];
      R.h(q(first, 'h'), 'init'); R.p(q(first, 'p'), 'init'); R.ctn(q(first, 'ctn'), 'init'); R.slide(q(first, 'slide'), 'init');
      ST.create({ trigger: box, start: 'top 60%', once: true, onEnter: () => { R.slide(q(first, 'slide'), 'show', 0); R.h(q(first, 'h'), 'show', .5); R.p(q(first, 'p'), 'show', .6); R.ctn(q(first, 'ctn'), 'show', .7); } });
    }
  }

  /* ---------- horizontal travel ---------- */
  function initTravel(scope) {
    const sec = $('.travel', scope);
    if (!sec) return;
    const track = $('.travel__track', sec);
    const route = $('.map__route', sec);
    if (!motion) return;
    if (isDesk()) {
      sec.classList.add('is-hscroll');
      onPageClean(() => { sec.classList.remove('is-hscroll'); sec.style.height = ''; });
      const dist = () => track.scrollWidth - innerWidth;
      const setH = () => { sec.style.height = `${track.scrollWidth}px`; };
      setH();
      hTween = gsap.to(track, { x: () => -dist(), ease: 'none', scrollTrigger: { trigger: sec, start: 'top top', end: 'bottom bottom', scrub: .6, invalidateOnRefresh: true, onRefreshInit: setH } });
      const lines = $$('.travel__tl', sec);
      gsap.fromTo(lines, { xPercent: gsap.utils.wrap([-6, 22, -14]) }, { xPercent: gsap.utils.wrap([6, -22, 22]), ease: 'none', scrollTrigger: { trigger: sec, start: 'top bottom', end: 'bottom bottom', scrub: .4 } });
      R.h(lines, 'init');
      ST.create({ trigger: sec, start: 'top 55%', once: true, onEnter: () => R.h(lines, 'show', 0) });
      gsap.set(route, { clipPath: 'inset(0% 100% 0% 0%)' });
      gsap.to(route, { clipPath: 'inset(0% 0% 0% 0%)', duration: 2 * D.l, ease: E.out, delay: D.m, scrollTrigger: { trigger: route, containerAnimation: hTween, start: 'left 85%', once: true } });
      const stops = $$('.map__stops li', sec);
      gsap.set(stops, { opacity: 0, y: 14 });
      gsap.to(stops, { opacity: 1, y: 0, duration: D.l, ease: E.out, stagger: .12, delay: D.m, scrollTrigger: { trigger: route, containerAnimation: hTween, start: 'left 85%', once: true } });
    } else {
      gsap.set(route, { clipPath: 'inset(0% 100% 0% 0%)' });
      gsap.to(route, { clipPath: 'inset(0% 0% 0% 0%)', duration: 2 * D.l, ease: E.out, scrollTrigger: { trigger: route, start: 'top 80%', once: true } });
      const lines = $$('.travel__tl', sec);
      R.h(lines, 'init');
      ST.create({ trigger: sec, start: 'top 70%', once: true, onEnter: () => R.h(lines, 'show', 0) });
    }
  }

  /* ---------- parallax, flowers, aerial, gather ---------- */
  function initParallax(scope) {
    if (!motion) return;
    $$('[data-parallax]', scope).forEach((img) => {
      const wrap = img.closest('[data-parallax-wrap]');
      gsap.fromTo(img, { yPercent: -12 }, { yPercent: 12, ease: 'none', scrollTrigger: { trigger: wrap.parentElement, start: 'top bottom', end: 'bottom top', scrub: .5 } });
    });
    $$('[data-flower]', scope).forEach((f) => {
      const host = f.parentElement;
      const r = rem();
      gsap.fromTo(f, { y: -50 * r }, { y: 50 * r, ease: 'none', scrollTrigger: { trigger: host, start: 'top bottom', end: 'bottom top', scrub: .5 } });
    });
    const aer = $('.aerial', scope);
    if (aer) {
      gsap.fromTo($('.aerial__media img', aer), { scale: 1.15 }, { scale: 1, ease: E.ease, scrollTrigger: { trigger: aer, start: 'top bottom', end: 'bottom bottom', scrub: .25 } });
      gsap.fromTo($('.clouds', aer), { yPercent: 18 }, { yPercent: -24, ease: 'none', scrollTrigger: { trigger: aer, start: 'top bottom', end: 'bottom top', scrub: .5 } });
    }
    const gat = $('.gather', scope);
    if (gat && isDesk()) {
      $$('.gather__img', gat).forEach((f) => {
        const s = parseFloat(f.dataset.speed) || 10;
        gsap.fromTo(f, { yPercent: s }, { yPercent: -s * 1.6, ease: 'none', scrollTrigger: { trigger: gat, start: 'top bottom', end: 'bottom top', scrub: .5 } });
      });
    }
  }

  /* ---------- arch window (vision) ---------- */
  function initVision(scope) {
    const sec = $('.vision', scope);
    if (!sec) return;
    const text = $('.vision__text', sec);
    if (!motion) return;
    const mask = $('.vision__mask', sec);
    const img = $('.vision__media img', sec);
    const desk = isDesk();
    gsap.timeline({ scrollTrigger: { trigger: sec, start: 'top top', end: '65% bottom', scrub: true } })
      .fromTo(mask, { '--aw': desk ? '30vw' : '62vw', '--ay': desk ? '22vh' : '24vh' }, { '--aw': desk ? '36vw' : '72vw', '--ay': desk ? '14vh' : '16vh', ease: E.inout, duration: .35 }, 0)
      .to(mask, { '--aw': desk ? '190vw' : '260vw', '--ay': '-110vh', ease: E.dive, duration: .65 }, .35)
      .fromTo(img, { scale: 1.3 }, { scale: 1, ease: E.inout, duration: 1 }, 0);
    play('data-v', text, 'init');
    ST.create({ trigger: sec, start: '42% top', onEnter: () => play('data-v', text, 'show', 0), onLeaveBack: () => play('data-v', text, 'hide', 0) });
  }

  /* ---------- footer closes into a frame ---------- */
  function initFooter(scope) {
    const ft = $('.ft:not(.ft--mini)', scope);
    if (!ft || !motion) return;
    const clip = $('.ft__clip', ft), content = $('.ft__content', ft);
    play('data-f', ft, 'init');
    gsap.timeline({ scrollTrigger: { trigger: ft, start: 'top 30%', end: 'bottom bottom', scrub: .5,
      onEnter: () => play('data-f', ft, 'show', .1), onLeaveBack: () => play('data-f', ft, 'hide', 0) } })
      .fromTo(clip, { clipPath: 'inset(0% 0% 0% 0%)' }, { clipPath: isDesk() ? 'inset(8% 22% 12% 22%)' : 'inset(5% 6% 14% 6%)', ease: 'none' }, 0)
      .fromTo(content, { opacity: 0, scale: .75 }, { opacity: 1, scale: 1, ease: 'none' }, 0);
    const cue = $('.cue');
    if (cue) gsap.to(cue, { opacity: 0, ease: E.inout, scrollTrigger: { trigger: ft, start: 'top bottom', end: 'center bottom', scrub: true } });
    onPageClean(() => cue && gsap.set(cue, { opacity: 1 }));
  }

  /* ---------- contact page ---------- */
  function initContact(scope) {
    const copy = $('[data-copy]', scope);
    if (copy) copy.addEventListener('click', async () => {
      const v = copy.dataset.copy;
      try { await navigator.clipboard.writeText(v); copy.textContent = 'Copied'; }
      catch (e) { copy.textContent = v; }
      setTimeout(() => { copy.textContent = 'Copy'; }, 2200);
    });
    const form = $('[data-form]', scope);
    if (!form) return;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const err = $('.form__err', form);
      const name = form.elements.name.value.trim();
      const email = form.elements.email.value.trim();
      const msg = form.elements.message.value.trim();
      let m = '';
      if (!name) m = 'Please add your name.';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) m = 'Please add a valid email address.';
      else if (!msg) m = 'Please write a short message.';
      err.textContent = m;
      if (m) return;
      const done = $('.form__done', form);
      done.hidden = false;
      done.tabIndex = -1;
      if (motion) {
        gsap.fromTo(done, { opacity: 0 }, { opacity: 1, duration: D.m, ease: E.out });
        gsap.fromTo(done.children, { opacity: 0, y: 30 * rem() }, { opacity: 1, y: 0, duration: D.l, ease: E.out, stagger: STAG, delay: .1 });
      }
      done.focus({ preventScroll: true });
    });
  }

  /* ---------- page lifecycle ---------- */
  function initPage(main, opts = {}) {
    pageCleanups = [];
    const run = () => {
      initTravel(main);       // creates the container animation first
      initHero(main);
      initDome(main);
      initTabs(main);
      initSlider(main);
      initParallax(main);
      initVision(main);
      initFooter(main);
      initReveals(main);
      initThemes(main);
      initContact(main);
      initFlip(main);
      initRoll(main);
      initMagnetic(main);
      $$('[data-top]', main).forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); scrollTo(0); }));
    };
    if (hasGsap) page = gsap.context(run, main); else run();
    if (motion && !opts.fromLoader) {
      heroIntro(main, .2);
    }
  }
  function destroyPage() {
    pageCleanups.forEach((f) => { try { f(); } catch (e) { /* noop */ } });
    pageCleanups = [];
    if (page) { page.revert(); page = null; }
    hTween = null;
  }

  /* ---------- loader ---------- */
  function runLoader(main) {
    const loader = $('#loader');
    const finish = () => {
      root.classList.add('is-loaded');
      if (loader) loader.remove();
      try { sessionStorage.setItem('dorr7-visited', '1'); } catch (e) { /* private mode */ }
    };
    if (!loader || !motion || getComputedStyle(loader).display === 'none') { finish(); if (motion) heroIntro(main, .1); return; }
    root.classList.add('is-loaded'); // cancels the css failsafe
    const revisit = root.classList.contains('revisit');
    const media = $('[data-hero-media]', main);
    const desk = isDesk();
    const aw0 = desk ? '24vw' : '40vw', aw1 = desk ? '36vw' : '52vw', s0 = desk ? .75 : 1.15;
    lock();
    scrollTo(0, { immediate: true });
    if (media) gsap.set(media, { scale: s0, transformOrigin: '50% 0%' });
    const hero = $('.hero', main);
    if (hero) { play('data-part', hero, 'init'); gsap.set($$('.pin', hero), { opacity: 0 }); }
    const tl = gsap.timeline({ onComplete: () => { unlock(); finish(); ST.refresh(); } });
    tl.set(loader, { '--aw': aw0, '--ay': '104vh' });
    if (!revisit) {
      play('data-part', loader, 'init');
      gsap.set('.loader__watermark', { opacity: 0 });
      root.classList.add('loader-go');
      tl.add(() => play('data-part', loader, 'show', .15))
        .fromTo('.loader__watermark', { opacity: 0 }, { opacity: .045, duration: D.l * 1.5, ease: E.out }, .15)
        .fromTo('.loader__progress i', { yPercent: -100 }, { yPercent: 0, duration: 2.4, ease: E.breath }, .7);
    } else {
      root.classList.add('loader-go');
      tl.fromTo('.loader__watermark', { opacity: 0 }, { opacity: .045, duration: D.m, ease: E.out });
    }
    tl.to(loader, { '--aw': aw1, '--ay': '15vh', duration: 1.25 * D.l, ease: E.inout })
      .to(loader, { '--aw': '170vw', '--ay': '-110vh', duration: 2 * D.l, ease: E.dive }, '>-0.15')
      .add(() => { if (media) gsap.to(media, { scale: 1, duration: 1.25 * D.l, ease: E.inout, onComplete: () => gsap.set(media, { clearProps: 'transformOrigin' }) }); }, '<')
      .add(() => heroIntro(main, 0), '<25%');
  }

  /* ---------- router (page transitions) ---------- */
  let routing = false;
  // gsap tweens are thenables that resolve to themselves; wrap to avoid recursive await
  const tween = (t, v) => new Promise((res) => gsap.to(t, { ...v, onComplete: res }));
  const norm = (p) => p.replace(/index\.html$/, '');
  let curPath = norm(location.pathname);
  function sameDoc(url) { return norm(url.pathname) === norm(location.pathname); }
  function initRouter() {
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href]');
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target === '_blank') return;
      const url = new URL(a.getAttribute('href'), location.href);
      if (url.origin !== location.origin || a.hasAttribute('download') || url.protocol.indexOf('http') !== 0) return;
      if (!/\.html$|\/$/.test(url.pathname)) return;
      if (sameDoc(url)) {
        e.preventDefault();
        const id = url.hash.slice(1);
        const t = id ? document.getElementById(id) : null;
        const go = () => scrollTo(t || 0);
        if (menu.open) closeMenu().then(go); else go();
        if (url.hash !== location.hash) history.pushState(null, '', url.href);
        return;
      }
      if (!hasGsap) return; // plain navigation
      e.preventDefault();
      navigate(url.href, true);
    });
    addEventListener('popstate', () => {
      const url = new URL(location.href);
      if (norm(url.pathname) === curPath) {
        const t = url.hash ? document.getElementById(url.hash.slice(1)) : null;
        scrollTo(t || 0);
        return;
      }
      navigate(location.href, false);
    });
  }
  async function navigate(href, push) {
    if (routing) return;
    routing = true;
    const url = new URL(href);
    const main = $('#main');
    hideTip();
    try {
      const fetching = fetch(url.pathname, { credentials: 'same-origin' }).then((r) => { if (!r.ok) throw new Error(r.status); return r.text(); });
      if (menu.open) await closeMenu(true);
      if (motion) {
        Object.keys(R).forEach((k) => {
          $$(`[data-reveal="${k}"], [data-part="${k}"], [data-t="${k}"], [data-s="${k}"], [data-v="${k}"], [data-f="${k}"]`, main)
            .filter((el) => inView(el) && (k !== 'p' || el._lines))
            .forEach((el) => R[k]([el], 'hide', 0));
        });
        await tween(main, { opacity: 0, duration: D.m, ease: E.in, delay: .15 });
      }
      const html = await fetching;
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const next = doc.querySelector('main');
      if (!next) throw new Error('no main');
      destroyPage();
      main.replaceWith(next);
      document.title = doc.title;
      const hdTheme = doc.querySelector('.hd')?.getAttribute('data-theme');
      if (hdTheme) $('.hd').setAttribute('data-theme', hdTheme);
      if (push) history.pushState(null, '', url.href);
      curPath = norm(url.pathname);
      if (lenis) lenis.scrollTo(0, { immediate: true, force: true }); else window.scrollTo(0, 0);
      if (motion) gsap.set(next, { opacity: 0 });
      initPage(next);
      ST.refresh(true);
      if (url.hash) { const t = document.getElementById(url.hash.slice(1)); if (t) scrollTo(t, { immediate: true }); }
      if (motion) await tween(next, { opacity: 1, duration: D.m, ease: E.inout });
      next.focus({ preventScroll: true });
    } catch (err) {
      console.warn('[dorr] transition fallback:', err && err.message, err && err.stack && err.stack.split('\n').slice(0,8).join(' / '));
      location.href = href;
    }
    routing = false;
  }

  /* ---------- boot ---------- */
  function boot() {
    const main = $('#main');
    if (hasGsap) {
      gsap.registerPlugin(ST);
      ST.config({ ignoreMobileResize: true });
      if (!motion) gsap.defaults({ duration: 0 });
    }
    initLenis();
    initBadge();
    initRail();
    initTip();
    initMenu();
    initRouter();
    const chrome = [$('.hd'), $('#menu')].filter(Boolean);
    chrome.forEach((c) => { initFlip(c); initRoll(c); });
    initPage(main, { fromLoader: true });
    runLoader(main);
    if (location.hash) {
      const t = document.getElementById(location.hash.slice(1));
      if (t) setTimeout(() => scrollTo(t, { immediate: true }), 50);
    }
    // refresh after images settle
    let rt = 0;
    const refresh = () => { clearTimeout(rt); rt = setTimeout(() => hasGsap && ST.refresh(), 120); };
    addEventListener('load', refresh);
    $$('img').forEach((img) => { if (!img.complete) img.addEventListener('load', refresh, { once: true }); });
    // re-split lines when the width changes
    let lw = innerWidth, side = isDesk();
    addEventListener('resize', () => {
      if (hasGsap && isDesk() !== side) {
        side = isDesk();
        const m = $('#main');
        destroyPage();
        initPage(m, { fromLoader: true });
        if (motion) play('data-part', m, 'show', 0);
        ST.refresh();
      }
      if (Math.abs(innerWidth - lw) < 40) return;
      lw = innerWidth;
      $$('[data-reveal="p"], [data-part="p"], [data-t="p"], [data-s="p"], [data-v="p"], [data-f="p"]').forEach((el) => {
        if (!el._lines) return;
        const shown = el._shown;
        splitLines(el);
        if (motion) gsap.set(el._lines, { yPercent: shown === false ? 110 : 0 });
      });
      refresh();
    });
  }

  if (!hasGsap) {
    // libraries missing: show everything, keep basic behaviour
    root.classList.remove('motion');
    root.classList.add('is-loaded');
    const l = document.getElementById('loader'); if (l) l.remove();
  }

  const fontsReady = document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]) : Promise.resolve();
  fontsReady.then(boot);

  /* ---------- PWA ---------- */
  if ('serviceWorker' in navigator) {
    addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
  }
})();
