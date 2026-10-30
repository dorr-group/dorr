/* DORR — Version 7 · "Nacre"
   Own motion system: word/line splitter, reveal vocabulary, shell loader, pearl menu,
   curtain page transitions. GSAP 3.12 + ScrollTrigger + Lenis 1.1 (local copies).
   Performance rules: animate transform/opacity only; no ScrollTrigger refresh while the
   user scrolls; offscreen loops paused; lazy images pre-decoded during idle time. */
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

  /* ---------- easing: cubic-bezier solver ---------- */
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
  const E = { out: bezier(.25, 1, .5, 1), inout: bezier(.76, 0, .24, 1), in: bezier(.5, 0, .75, 0), soft: bezier(.33, 0, .2, 1) };
  const D = { s: .4, m: .8, l: 1.2 };
  const STAG = .08;
  const DELAY = .2;

  /* ---------- splitting (words keep their <em>) ---------- */
  function srCopy(el, text) {
    const s = document.createElement('span');
    s.className = 'sr-only';
    s.textContent = text.replace(/\s+/g, ' ').trim();
    el.appendChild(s);
  }
  function tokens(el) {
    const out = [];
    const walk = (node, em) => {
      node.childNodes.forEach((n) => {
        if (n.nodeType === 3) n.textContent.split(/(\s+)/).forEach((w) => { if (w) out.push(/^\s+$/.test(w) ? { sp: true } : { w, em }); });
        else if (n.nodeName === 'BR') out.push({ br: true });
        else if (n.nodeType === 1 && !n.classList.contains('sr-only')) walk(n, em || n.nodeName === 'EM');
      });
    };
    walk(el, false);
    return out;
  }
  function word(t) {
    const s = document.createElement('span');
    s.className = 'sx-w';
    if (t.em) { const e = document.createElement('em'); e.textContent = t.w; s.appendChild(e); } else s.textContent = t.w;
    return s;
  }
  function splitWords(el) {
    if (el._words) return el._words;
    const text = el.textContent;
    const wrap = document.createElement('span');
    wrap.setAttribute('aria-hidden', 'true');
    const words = [];
    tokens(el).forEach((t) => {
      if (t.br) wrap.appendChild(document.createElement('br'));
      else if (t.sp) wrap.appendChild(document.createTextNode(' '));
      else { const m = document.createElement('span'); m.className = 'sx-wm'; const w = word(t); m.appendChild(w); wrap.appendChild(m); words.push(w); }
    });
    el.textContent = '';
    el.appendChild(wrap);
    srCopy(el, text);
    el._words = words;
    return words;
  }
  function splitLines(el) {
    if (!el._orig) { el._orig = el.innerHTML; el._text = el.textContent; }
    el.innerHTML = el._orig;
    const toks = tokens(el);
    const wrap = document.createElement('span');
    wrap.setAttribute('aria-hidden', 'true');
    wrap.style.display = 'block';
    const items = [];
    toks.forEach((t) => {
      if (t.br) { wrap.appendChild(document.createElement('br')); items.push({ br: true }); }
      else if (t.sp) wrap.appendChild(document.createTextNode(' '));
      else { const w = word(t); wrap.appendChild(w); items.push({ el: w }); }
    });
    el.textContent = '';
    el.appendChild(wrap);
    const lines = [];
    let cur = null, top = null;
    items.forEach((it) => {
      if (it.br) { cur = null; return; }
      const y = it.el.offsetTop;
      if (!cur || Math.abs(y - top) > 3) { cur = []; lines.push(cur); top = y; }
      cur.push(it.el);
    });
    wrap.textContent = '';
    const out = lines.map((ln) => {
      const m = document.createElement('span'); m.className = 'sx-m';
      const l = document.createElement('span'); l.className = 'sx-l';
      ln.forEach((w, i) => { if (i) l.appendChild(document.createTextNode(' ')); l.appendChild(w); });
      m.appendChild(l); wrap.appendChild(m);
      return l;
    });
    srCopy(el, el._text);
    el._lines = out;
    return out;
  }

  /* ---------- reveal vocabulary (transform + opacity only) ---------- */
  const R = {
    w(els, mode, delay) {
      els.forEach((el, i) => {
        const w = splitWords(el);
        if (mode === 'init') return gsap.set(w, { yPercent: 115 });
        if (mode === 'show') return gsap.fromTo(w, { yPercent: 115 }, { yPercent: 0, duration: D.l, delay: (delay ?? DELAY) + i * STAG, stagger: .035, ease: E.out, overwrite: true });
        return gsap.to(w, { yPercent: -115, duration: D.s, delay: delay ?? 0, stagger: .01, ease: E.in, overwrite: true });
      });
    },
    p(els, mode, delay) {
      els.forEach((el, i) => {
        const l = el._lines || splitLines(el);
        if (mode === 'init') { el._shown = false; return gsap.set(l, { yPercent: 110 }); }
        el._shown = mode === 'show';
        if (mode === 'show') return gsap.fromTo(l, { yPercent: 110 }, { yPercent: 0, duration: D.l, delay: (delay ?? DELAY) + i * STAG, stagger: STAG, ease: E.out, overwrite: true });
        return gsap.to(l, { yPercent: -110, duration: D.s, delay: delay ?? 0, stagger: STAG / 2, ease: E.in, overwrite: true });
      });
    },
    ctn(els, mode, delay) {
      if (!els.length) return;
      const y = 36 * rem();
      if (mode === 'init') return gsap.set(els, { opacity: 0, y });
      if (mode === 'show') return gsap.fromTo(els, { opacity: 0, y }, { opacity: 1, y: 0, duration: D.l, delay: delay ?? DELAY, stagger: STAG, ease: E.out, overwrite: true });
      return gsap.to(els, { opacity: 0, duration: D.s, delay: delay ?? 0, ease: E.in, overwrite: true });
    },
    oval(els, mode, delay) {
      if (!els.length) return;
      const imgs = els.map((e) => e.querySelector('img')).filter(Boolean);
      if (mode === 'init') { gsap.set(els, { scale: .82, opacity: 0 }); return gsap.set(imgs, { scale: 1.35 }); }
      if (mode === 'show') {
        gsap.to(els, { scale: 1, opacity: 1, duration: D.l * 1.2, delay: delay ?? DELAY, stagger: .12, ease: E.out, overwrite: true });
        return gsap.to(imgs, { scale: 1, duration: D.l * 1.6, delay: delay ?? DELAY, stagger: .12, ease: E.out, overwrite: true });
      }
      return gsap.to(els, { scale: .9, opacity: 0, duration: D.s, ease: E.in, overwrite: true });
    },
    veil(els, mode, delay) {
      if (!els.length) return;
      const veils = els.map((e) => {
        let v = e.querySelector(':scope > .veil');
        if (!v) { v = document.createElement('i'); v.className = 'veil'; v.setAttribute('aria-hidden', 'true'); e.appendChild(v); }
        return v;
      });
      const imgs = els.map((e) => e.querySelector('img')).filter(Boolean);
      if (mode === 'init') { gsap.set(veils, { yPercent: 0 }); return gsap.set(imgs, { scale: 1.22 }); }
      if (mode === 'show') {
        gsap.to(veils, { yPercent: -101, duration: D.l, delay: delay ?? DELAY, stagger: .1, ease: E.inout, overwrite: true });
        return gsap.to(imgs, { scale: 1, duration: D.l * 1.4, delay: delay ?? DELAY, stagger: .1, ease: E.out, overwrite: true });
      }
      return gsap.to(veils, { yPercent: 0, duration: D.m, ease: E.inout, overwrite: true });
    },
  };
  const play = (attr, scope, mode, delay) => {
    Object.keys(R).forEach((k) => { const els = $$(`[${attr}="${k}"]`, scope); if (els.length) R[k](els, mode, delay); });
  };
  const inView = (el) => { const b = el.getBoundingClientRect(); return b.bottom > 0 && b.top < innerHeight; };

  /* ---------- state ---------- */
  let lenis = null;
  let page = null;
  let cleanups = [];
  const onClean = (fn) => cleanups.push(fn);
  const lock = () => { if (lenis) lenis.stop(); root.style.overflow = 'hidden'; };
  const unlock = () => { root.style.overflow = ''; if (lenis) lenis.start(); };
  function scrollTo(target, opts = {}) {
    if (lenis) lenis.scrollTo(target, { duration: opts.immediate ? 0 : 1.4, immediate: !!opts.immediate, offset: opts.offset || 0, force: true });
    else {
      const y = typeof target === 'number' ? target : target.getBoundingClientRect().top + scrollY + (opts.offset || 0);
      window.scrollTo({ top: y, behavior: opts.immediate || reduce ? 'auto' : 'smooth' });
    }
  }

  function initLenis() {
    if (!motion || !window.Lenis) return;
    lenis = new window.Lenis({ duration: 1.15, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true, syncTouch: false });
    window.__dorrLenis = lenis;
    lenis.on('scroll', ST.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  /* reading line under the header: one transform per frame, no layout */
  function initProgress() {
    const bar = $('.hd__progress');
    if (!bar || !hasGsap) return;
    const set = gsap.quickSetter(bar, 'scaleX');
    ST.create({ start: 0, end: 'max', onUpdate: (s) => set(s.progress) });
  }

  /* ---------- micro-interactions ---------- */
  function initRoll(scope) {
    $$('[data-roll]', scope).forEach((el) => {
      if (el._roll) return;
      el._roll = true;
      const text = el.textContent.trim();
      const box = document.createElement('span'); box.className = 'roll'; box.setAttribute('aria-hidden', 'true');
      const a = document.createElement('span'); a.textContent = text;
      const b = document.createElement('span'); b.textContent = text;
      box.append(a, b);
      el.textContent = '';
      el.append(box);
      srCopy(el, text);
    });
  }
  function initMagnetic(scope) {
    if (!motion || !fine) return;
    $$('[data-magnetic]', scope).forEach((el) => {
      if (el._mag) return;
      el._mag = true;
      const xTo = gsap.quickTo(el, 'x', { duration: 1.2, ease: 'power3.out' });
      const yTo = gsap.quickTo(el, 'y', { duration: 1.2, ease: 'power3.out' });
      el.addEventListener('mousemove', (e) => {
        const b = el.getBoundingClientRect();
        xTo(((e.clientX - b.left) / b.width - .5) * 22);
        yTo(((e.clientY - b.top) / b.height - .5) * 22);
      });
      el.addEventListener('mouseleave', () => { xTo(0); yTo(0); });
    });
  }

  /* ---------- menu: a pearl blooms from the button ---------- */
  const menu = { open: false };
  function initMenu() {
    menu.el = $('#menu');
    menu.btn = $('.hd__menu');
    if (!menu.el || !menu.btn) return;
    menu.bloom = $('.menu__bloom', menu.el);
    menu.panel = $('.menu__panel', menu.el);
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
  }
  function placeBloom() {
    const b = menu.btn.getBoundingClientRect();
    const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
    const r = Math.hypot(Math.max(cx, innerWidth - cx), Math.max(cy, innerHeight - cy));
    gsap.set(menu.bloom, { width: r * 2, height: r * 2, x: cx - r, y: cy - r });
  }
  function openMenu() {
    if (menu.open) return;
    menu.open = true;
    menu.el.hidden = false;
    menu.btn.setAttribute('aria-expanded', 'true');
    lock();
    if (motion) {
      placeBloom();
      gsap.fromTo(menu.bloom, { scale: 0 }, { scale: 1, duration: D.l, ease: E.inout });
      play('data-part', menu.el, 'init');
      play('data-part', menu.el, 'show', .45);
      gsap.fromTo('.menu__close', { opacity: 0 }, { opacity: 1, duration: D.m, delay: .6 });
    } else {
      menu.bloom.style.cssText = 'transform:none;inset:0;width:auto;height:auto;border-radius:0';
    }
    setTimeout(() => { const a = $('.menu__list a', menu.el); if (a) a.focus({ preventScroll: true }); }, 60);
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
      gsap.to('.menu__close', { opacity: 0, duration: D.s });
      gsap.to(menu.bloom, { scale: 0, duration: D.m * 1.2, ease: E.inout, delay: .15, onComplete: done });
      menu.btn.focus({ preventScroll: true });
    });
  }

  /* ---------- header colour follows the ground ---------- */
  function initThemes(scope) {
    const hd = $('.hd');
    if (!hasGsap || !hd) return;
    const map = (bg) => (bg === 'image' || bg === 'dark' ? 'dark' : 'light');
    const set = (bg) => { if (hd.dataset.bg !== bg) { hd.dataset.bg = bg; hd.dataset.theme = map(bg); } };
    const secs = $$('[data-bg]', scope);
    // the header backing takes the colour of the band beneath it
    secs.forEach((s) => ST.create({ trigger: s, start: 'top 64px', end: 'bottom 64px', onToggle: (self) => { if (self.isActive) set(s.dataset.bg); } }));
    const first = secs.find((s) => { const b = s.getBoundingClientRect(); return b.top <= 64 && b.bottom > 64; }) || secs[0];
    if (first) set(first.dataset.bg);
  }

  /* header: backing once the page moves; hides on scroll down, returns on scroll up */
  function initHeaderScroll() {
    const hd = $('.hd');
    if (!hd) return;
    let lastY = scrollY, ticking = false;
    const update = () => {
      ticking = false;
      const y = scrollY;
      hd.classList.toggle('is-backed', y > 8);
      if (!menu.open) hd.classList.toggle('is-hidden', y > 240 && y > lastY + 2 ? true : y < lastY - 2 ? false : hd.classList.contains('is-hidden') && y > 240);
      lastY = y;
    };
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    hd.addEventListener('focusin', () => hd.classList.remove('is-hidden'));
    update();
  }

  /* ---------- scroll reveals ---------- */
  function initReveals(scope) {
    if (!motion) return;
    $$('[data-reveal]', scope).forEach((el) => {
      const k = el.dataset.reveal;
      R[k]([el], 'init');
      ST.create({ trigger: el, start: 'top 92%', once: true, onEnter: () => R[k]([el], 'show', .1) });
    });
  }

  /* ---------- hero ---------- */
  function heroIntro(scope, delay) {
    const hero = $('.hero', scope);
    if (!hero || !motion) return;
    play('data-part', hero, 'init');
    play('data-part', hero, 'show', delay);
    gsap.fromTo($$('.nacre', hero), { opacity: 0, scale: .9 }, { opacity: 1, scale: 1, duration: D.l * 1.5, delay: (delay || 0) + .3, stagger: .15, ease: E.out });
  }
  function initHero(scope) {
    const hero = $('.hero', scope);
    if (!hero || !motion) return;
    const big = $('.hero__oval', hero), sm = $('.hero__oval-sm', hero);
    const n1 = $('.nacre--1', hero), n2 = $('.nacre--2', hero);
    gsap.timeline({ scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: .4 } })
      .to(big, { yPercent: 10, ease: 'none' }, 0)
      .to(sm, { yPercent: -28, ease: 'none' }, 0)
      .to(n1, { rotate: 4, ease: 'none' }, 0)
      .to(n2, { rotate: -6, ease: 'none' }, 0);
  }

  /* ---------- nacre layers (structure) ---------- */
  function initLayers(scope) {
    const sec = $('.layers', scope);
    if (!sec || !motion) return;
    const steps = $$('.step', sec);
    const l1 = $('.rings__l--1', sec), l2 = $('.rings__l--2', sec);
    const deps = $$('.rings__deps li', sec), brands = $$('.rings__brands li', sec);
    const svg = $('.rings__svg', sec);
    if (!isDesk()) {
      // phones: simple reveals, no pinning
      gsap.set([l1, l2], { opacity: 0, scale: .8, transformOrigin: '50% 50%' });
      ST.create({ trigger: svg, start: 'top 80%', once: true, onEnter: () => gsap.to([l1, l2], { opacity: 1, scale: 1, duration: D.l * 1.4, stagger: .25, ease: E.out }) });
      R.ctn(steps, 'init');
      ST.create({ trigger: sec, start: 'top 80%', once: true, onEnter: () => R.ctn(steps, 'show', 0) });
      return;
    }
    sec.classList.add('is-staged');
    onClean(() => sec.classList.remove('is-staged'));
    gsap.set([l1, l2], { opacity: 0, scale: .72, transformOrigin: '50% 50%' });
    gsap.set([deps, brands], { opacity: 0 });
    let cur = 0;
    const show = (n) => {
      if (n === cur) return;
      const a = steps[cur], b = steps[n];
      cur = n;
      steps.forEach((s, i) => s.classList.toggle('is-on', i === n));
      gsap.fromTo(b, { opacity: 0, y: 24 * rem() }, { opacity: 1, y: 0, duration: D.m, ease: E.out, overwrite: true });
      gsap.set(a, { opacity: 0 });
    };
    gsap.timeline({ scrollTrigger: { trigger: sec, start: 'top top', end: 'bottom bottom', scrub: .6,
      onUpdate: (s) => show(s.progress < .34 ? 0 : s.progress < .67 ? 1 : 2) } })
      .to(svg, { rotate: 24, ease: 'none', duration: 1 }, 0)
      .to(l1, { opacity: 1, scale: 1, ease: E.soft, duration: .18 }, .2)
      .to(deps, { opacity: 1, stagger: .02, duration: .1 }, .28)
      .to(l2, { opacity: 1, scale: 1, ease: E.soft, duration: .18 }, .55)
      .to(brands, { opacity: 1, stagger: .025, duration: .1 }, .63);
  }

  /* ---------- parallax groups ---------- */
  function initParallax(scope) {
    if (!motion || !isDesk()) return;
    $$('.card[data-speed], .expertise__img[data-speed]', scope).forEach((el) => {
      const s = parseFloat(el.dataset.speed) || 0;
      if (!s) return;
      gsap.fromTo(el, { yPercent: s }, { yPercent: -s, ease: 'none', scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: .5 } });
    });
    const band = $('.ft__band img', scope);
    if (band) gsap.fromTo(band, { yPercent: -12 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: band.parentElement, start: 'top bottom', end: 'bottom top', scrub: .5 } });
  }

  /* ---------- brand index: an oval follows the cursor ---------- */
  function initIndex(scope) {
    const list = $('.index', scope);
    const peek = $('.peek');
    if (!list || !peek || !motion || !fine || !isDesk()) return;
    peek.style.display = 'block';
    const oval = $('.peek__oval', peek), img = $('img', peek);
    const xTo = gsap.quickTo(peek, 'x', { duration: .9, ease: 'power3.out' });
    const yTo = gsap.quickTo(peek, 'y', { duration: .9, ease: 'power3.out' });
    const move = (e) => { xTo(e.clientX); yTo(e.clientY); };
    list.addEventListener('mousemove', move);
    $$('.index__row', list).forEach((row) => row.addEventListener('mouseenter', () => {
      if (img.getAttribute('src') !== row.dataset.peek) img.setAttribute('src', row.dataset.peek);
    }));
    list.addEventListener('mouseenter', (e) => { gsap.set(peek, { x: e.clientX, y: e.clientY }); gsap.to(oval, { scale: 1, duration: D.m, ease: E.out, overwrite: true }); });
    list.addEventListener('mouseleave', () => gsap.to(oval, { scale: 0, duration: D.s, ease: E.in, overwrite: true }));
    onClean(() => { gsap.set(oval, { scale: 0 }); peek.style.display = 'none'; });
  }

  /* ---------- future vision: the pearl grows (scale only) ---------- */
  function initVision(scope) {
    const sec = $('.vision', scope);
    if (!sec || !motion) return;
    const pearl = $('.vision__pearl', sec), img = $('img', pearl), title = $('.vision__title', sec);
    play('data-v', sec, 'init');
    if (!isDesk()) {
      gsap.fromTo(pearl, { scale: .55, rotate: -8 }, { scale: 1, rotate: 0, ease: 'none', scrollTrigger: { trigger: pearl, start: 'top bottom', end: 'center center', scrub: .5 } });
      ST.create({ trigger: title, start: 'top 85%', once: true, onEnter: () => play('data-v', sec, 'show', 0) });
      return;
    }
    sec.classList.add('is-staged');
    onClean(() => sec.classList.remove('is-staged'));
    gsap.timeline({ scrollTrigger: { trigger: sec, start: 'top top', end: 'bottom bottom', scrub: .6 } })
      .fromTo(pearl, { scale: .38, rotate: -10 }, { scale: 1, rotate: 0, ease: E.soft, duration: .7 }, 0)
      .fromTo(img, { scale: 1.5 }, { scale: 1, ease: E.soft, duration: .7 }, 0);
    ST.create({ trigger: sec, start: '35% top', onEnter: () => play('data-v', sec, 'show', 0), onLeaveBack: () => play('data-v', sec, 'hide', 0) });
  }

  /* ---------- flowers sway only while visible ---------- */
  function initFlowers(scope) {
    const fl = $$('[data-flower]', scope);
    if (!fl.length || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((en) => en.forEach((e) => e.target.classList.toggle('is-visible', e.isIntersecting)));
    fl.forEach((f) => io.observe(f));
    onClean(() => io.disconnect());
  }

  /* ---------- contact ---------- */
  function initContact(scope) {
    const copy = $('[data-copy]', scope);
    if (copy) copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(copy.dataset.copy); copy.textContent = 'Copied'; } catch (e) { copy.textContent = copy.dataset.copy; }
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
      if (motion) gsap.fromTo(done.children, { opacity: 0, y: 24 * rem() }, { opacity: 1, y: 0, duration: D.l, ease: E.out, stagger: STAG });
      done.focus({ preventScroll: true });
    });
  }

  /* ---------- page lifecycle ---------- */
  function initPage(main, opts = {}) {
    cleanups = [];
    const run = () => {
      initHero(main);
      initLayers(main);
      initParallax(main);
      initVision(main);
      initReveals(main);
      initThemes(main);
      initIndex(main);
      initFlowers(main);
      initContact(main);
      initRoll(main);
      initMagnetic(main);
      $$('[data-top]', main).forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); scrollTo(0); }));
    };
    if (hasGsap) page = gsap.context(run, main); else run();
    if (motion && !opts.fromLoader) heroIntro(main, .15);
  }
  function destroyPage() {
    cleanups.forEach((f) => { try { f(); } catch (e) { /* noop */ } });
    cleanups = [];
    if (page) { page.revert(); page = null; }
  }

  /* ---------- loader: the shell opens, the pearl travels into the wordmark ---------- */
  function runLoader(main) {
    const shell = $('#shell');
    const finish = () => {
      root.classList.add('is-loaded');
      if (shell) shell.remove();
      try { sessionStorage.setItem('dorr7-visited', '1'); } catch (e) { /* private mode */ }
      predecode();
    };
    if (!shell || !motion || getComputedStyle(shell).display === 'none') { finish(); if (motion) heroIntro(main, .1); return; }
    root.classList.add('is-loaded');
    const revisit = root.classList.contains('revisit');
    const hero = $('.hero', main);
    if (hero) { play('data-part', hero, 'init'); gsap.set($$('.nacre', hero), { opacity: 0 }); }
    lock();
    scrollTo(0, { immediate: true });
    const pearl = $('.shell__pearl', shell);
    const rings = $$('.shell__ring', shell);
    const word = $('.shell__word', shell);
    root.classList.add('shell-go');
    const tl = gsap.timeline({ onComplete: () => { unlock(); finish(); } });
    if (!revisit) {
      tl.fromTo(pearl, { scale: 0 }, { scale: 1, duration: D.l, ease: E.out }, .1)
        .fromTo(rings, { scale: .55, opacity: 0, xPercent: -50, yPercent: -50 }, { scale: 1, opacity: 1, duration: D.l * 1.2, stagger: .32, ease: E.out }, .35)
        .fromTo(word, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: D.l, ease: E.out }, .5)
        .to([rings, word], { opacity: 0, duration: D.m, ease: E.in }, 2.25);
    } else {
      tl.fromTo(pearl, { scale: 0 }, { scale: 1, duration: D.m, ease: E.out }, 0);
    }
    // the pearl travels to the wordmark dot
    const dot = $('.hd__pearl');
    tl.add(() => {
      if (!dot) return;
      const a = pearl.getBoundingClientRect(), b = dot.getBoundingClientRect();
      gsap.to(pearl, { x: b.left + b.width / 2 - (a.left + a.width / 2), y: b.top + b.height / 2 - (a.top + a.height / 2), scale: b.width / a.width, duration: 1.3, ease: E.inout });
      gsap.fromTo(dot, { opacity: 0 }, { opacity: 1, duration: .2, delay: 1.25 });
      gsap.to(pearl, { opacity: 0, duration: .2, delay: 1.3 });
    }, revisit ? .5 : 2.5)
      .to('.shell__seam', { opacity: 1, duration: .2 }, revisit ? .55 : 2.55)
      .to('.shell__half--top', { yPercent: -102, duration: 1.4, ease: E.inout }, revisit ? .6 : 2.6)
      .to('.shell__half--bottom', { yPercent: 102, duration: 1.4, ease: E.inout }, '<')
      .add(() => heroIntro(main, .1), '<35%');
  }

  /* decode lazy images during idle time so nothing decodes mid-scroll */
  function predecode() {
    const imgs = $$('img[loading="lazy"]');
    const idle = window.requestIdleCallback || ((cb) => setTimeout(() => cb({ timeRemaining: () => 8 }), 120));
    const next = () => {
      const img = imgs.shift();
      if (!img) return;
      img.loading = 'eager';
      const go = () => idle(next);
      if (img.decode) img.decode().then(go, go); else go();
    };
    idle(next);
  }

  /* ---------- router: a scalloped pearl curtain passes over the page ---------- */
  let routing = false;
  const norm = (p) => p.replace(/index\.html$/, '');
  let curPath = norm(location.pathname);
  const sameDoc = (url) => norm(url.pathname) === norm(location.pathname);
  const tween = (t, v) => new Promise((res) => gsap.to(t, { ...v, onComplete: res }));
  function initRouter() {
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href]');
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target === '_blank') return;
      const url = new URL(a.getAttribute('href'), location.href);
      if (url.origin !== location.origin || a.hasAttribute('download') || url.protocol.indexOf('http') !== 0) return;
      if (!/\.html$|\/$/.test(url.pathname)) return;
      if (sameDoc(url)) {
        e.preventDefault();
        const t = url.hash ? document.getElementById(url.hash.slice(1)) : null;
        const go = () => scrollTo(t || 0);
        if (menu.open) closeMenu().then(go); else go();
        if (url.hash !== location.hash) history.pushState(null, '', url.href);
        return;
      }
      if (!hasGsap) return;
      e.preventDefault();
      navigate(url.href, true);
    });
    addEventListener('popstate', () => {
      const url = new URL(location.href);
      if (norm(url.pathname) === curPath) { const t = url.hash ? document.getElementById(url.hash.slice(1)) : null; scrollTo(t || 0); return; }
      navigate(location.href, false);
    });
  }
  async function navigate(href, push) {
    if (routing) return;
    routing = true;
    const url = new URL(href);
    const main = $('#main');
    const curtain = $('.curtain');
    try {
      const fetching = fetch(url.pathname, { credentials: 'same-origin' }).then((r) => { if (!r.ok) throw new Error(r.status); return r.text(); });
      if (menu.open) await closeMenu(true);
      if (motion) {
        ['w', 'p'].forEach((k) => $$(`[data-reveal="${k}"], [data-part="${k}"]`, main).filter((el) => inView(el) && (el._words || el._lines)).forEach((el) => R[k]([el], 'hide', 0)));
        gsap.set(curtain, { visibility: 'visible', yPercent: 101 });
        await tween(curtain, { yPercent: 0, duration: D.l, ease: E.inout, delay: .1 });
      }
      const html = await fetching;
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const next = doc.querySelector('main');
      if (!next) throw new Error('no main');
      destroyPage();
      main.replaceWith(next);
      document.title = doc.title;
      if (push) history.pushState(null, '', url.href);
      curPath = norm(url.pathname);
      if (lenis) lenis.scrollTo(0, { immediate: true, force: true }); else window.scrollTo(0, 0);
      initPage(next);
      ST.refresh(true);
      if (url.hash) { const t = document.getElementById(url.hash.slice(1)); if (t) scrollTo(t, { immediate: true }); }
      if (motion) {
        await tween(curtain, { yPercent: -101, duration: D.l, ease: E.inout });
        gsap.set(curtain, { visibility: 'hidden', yPercent: 101 });
      }
      next.focus({ preventScroll: true });
    } catch (err) {
      console.warn('[dorr] transition fallback:', err && err.message);
      location.href = href;
    }
    routing = false;
  }

  /* ---------- boot ---------- */
  function boot() {
    const main = $('#main');
    if (hasGsap) {
      gsap.registerPlugin(ST);
      ST.config({ ignoreMobileResize: true, autoRefreshEvents: 'visibilitychange,DOMContentLoaded,load' });
    }
    initLenis();
    initProgress();
    initMenu();
    initHeaderScroll();
    initRouter();
    initRoll($('.hd'));
    initPage(main, { fromLoader: true });
    runLoader(main);
    if (location.hash) { const t = document.getElementById(location.hash.slice(1)); if (t) setTimeout(() => scrollTo(t, { immediate: true }), 50); }
    // one refresh after everything has loaded (images carry width/height, so no per-image refresh)
    if (hasGsap) addEventListener('load', () => ST.refresh(), { once: true });
    // rebuild across the breakpoint; re-split lines when the width really changes
    let lw = innerWidth, lh = innerHeight, side = isDesk(), rt = 0;
    addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(() => {
        if (hasGsap && isDesk() !== side) {
          side = isDesk();
          const m = $('#main');
          destroyPage();
          initPage(m, { fromLoader: true });
          if (motion) play('data-part', m, 'show', 0);
          ST.refresh();
          lw = innerWidth;
          return;
        }
        if (Math.abs(innerWidth - lw) < 40) {
          if (isDesk() && Math.abs(innerHeight - lh) > 80 && hasGsap) { lh = innerHeight; ST.refresh(); }
          return;
        }
        lw = innerWidth; lh = innerHeight;
        $$('[data-reveal="p"], [data-part="p"]').forEach((el) => {
          if (!el._lines) return;
          const shown = el._shown;
          splitLines(el);
          if (motion) gsap.set(el._lines, { yPercent: shown === false ? 110 : 0 });
        });
        if (hasGsap) ST.refresh();
      }, 200);
    });
  }

  if (!hasGsap) {
    root.classList.remove('motion');
    root.classList.add('is-loaded');
    const l = document.getElementById('shell'); if (l) l.remove();
  }
  const fontsReady = document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 4000))]) : Promise.resolve();
  fontsReady.then(boot);

  if ('serviceWorker' in navigator) addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
})();
