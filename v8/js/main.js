/* DORR v8 — "Strand": motion system (GSAP + ScrollTrigger + Lenis), loader, iris, necklace, pearls. */
(function () {
  'use strict';
  var root = document.documentElement;
  if (!(window.gsap && window.ScrollTrigger)) { root.classList.remove('js'); return; }
  window.DORR_OK = true;

  var gsap = window.gsap, ST = window.ScrollTrigger, Strand = window.DORRStrand;
  gsap.registerPlugin(ST);
  var RM = root.classList.contains('rm');
  var canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  // ——— Easing + timing family ———
  function bezier(x1, y1, x2, y2) {
    function a(p, q) { return 1 - 3 * q + 3 * p; } function b(p, q) { return 3 * q - 6 * p; } function c(p) { return 3 * p; }
    function f(t, p, q) { return ((a(p, q) * t + b(p, q)) * t + c(p)) * t; }
    function d(t, p, q) { return 3 * a(p, q) * t * t + 2 * b(p, q) * t + c(p); }
    return function (x) {
      if (x <= 0) return 0; if (x >= 1) return 1;
      var t = x;
      for (var i = 0; i < 8; i++) { var s = d(t, x1, x2); if (Math.abs(s) < 1e-6) break; t -= (f(t, x1, x2) - x) / s; }
      return f(Math.min(1, Math.max(0, t)), y1, y2);
    };
  }
  var E = { out: bezier(.25, 1, .5, 1), inOut: bezier(.76, 0, .24, 1), in: bezier(.5, 0, .75, 0) };
  var DL = 1.2, DM = .8, DS = .4;

  // ——— Smooth scroll (wheel smoothing; touch stays native) ———
  var lenis = null;
  ST.config({ ignoreMobileResize: true });
  if (!RM && window.Lenis) {
    lenis = new window.Lenis({ duration: 1.1, easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); }, smoothWheel: true, syncTouch: false });
    lenis.on('scroll', ST.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
  }
  function jump(target) {
    var y = typeof target === 'number' ? target : target.getBoundingClientRect().top + window.scrollY;
    if (target && target.id === 'top') y = 0;
    if (lenis) lenis.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y);
    ST.update();
  }
  function lock() { if (lenis) lenis.stop(); else document.body.style.overflow = 'hidden'; }
  function unlock() { if (lenis) lenis.start(); else document.body.style.overflow = ''; }

  // ——— Paper grain (runtime) ———
  (function grain() {
    try {
      var S = 220, c = document.createElement('canvas'); c.width = S; c.height = S;
      var g = c.getContext('2d'), im = g.createImageData(S, S), d = im.data, seed = 9;
      function r() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
      for (var i = 0; i < S * S; i++) {
        var v = r(), fib = (i % S) % 7 === 0 ? 0.25 : 0;
        var dark = v < 0.5;
        d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = dark ? 60 : 255;
        d[i * 4 + 3] = Math.round((Math.abs(v - 0.5) * 2 * 26) + fib * 20);
      }
      g.putImageData(im, 0, 0);
      root.style.setProperty('--grain', 'url(' + c.toDataURL('image/png') + ')');
    } catch (e) {}
  })();

  // ——— Text: words with inner spans for masked rises ———
  function words(el) {
    if (el.__w) return el.__w;
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (p) {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(' ')); return; }
            var w = document.createElement('span'); w.className = 'w';
            var i = document.createElement('span'); i.className = 'wi'; i.textContent = p;
            w.appendChild(i); frag.appendChild(w);
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1 && !n.classList.contains('w') && !n.classList.contains('inl')) walk(n);
      });
    })(el);
    el.__w = $$('.wi', el);
    return el.__w;
  }
  function lineOf(inners) {
    var tops = [];
    return inners.map(function (i) { var t = Math.round(i.parentNode.offsetTop); var k = tops.indexOf(t); if (k < 0) { tops.push(t); k = tops.length - 1; } return k; });
  }
  var R = {
    lines: {
      set: function (el) { gsap.set(words(el), { yPercent: 112, rotate: 5, transformOrigin: '0% 100%' }); },
      play: function (el, d) {
        var w = words(el), li = lineOf(w);
        gsap.to(w, { yPercent: 0, rotate: 0, duration: DL, ease: E.out, delay: function (i) { return (d || 0) + li[i] * .09 + i * .012; } });
      }
    },
    up: {
      set: function (el) { gsap.set(el, { y: 28, opacity: 0 }); },
      play: function (el, d) { gsap.to(el, { y: 0, opacity: 1, duration: DL, delay: d || 0, ease: E.out }); }
    }
  };

  // ——— Pearl-strand figures ———
  var S = {};
  function setupStrands() {
    if (!Strand || !Strand.supported || RM) { root.classList.add('no-strand'); return; }
    var desk = window.innerWidth > 991;
    $$('canvas[data-strand]').forEach(function (cv) {
      var type = cv.getAttribute('data-strand'), host = cv.parentElement;
      var ground = cv.getAttribute('data-ground');
      var o = { host: host, onReady: function () { host.classList.add('is-strung'); }, onSleep: function () { host.classList.remove('is-strung'); } };
      if (type === 'hero') Object.assign(o, { clipEl: document.querySelector('[data-hero-pearl]'), cell: desk ? 18 : 13, sag: desk ? 3.5 : 1.6, ground: '#141a1b', thread: '#6f685d', tint: .92, lo: .18, hi: .92, gamma: 1.5, minR: .16, maxR: 1.04, mix: 0, reveal: 0, sway: .08, dprCap: Strand.BIG_CAP });
      if (type === 'photo') Object.assign(o, { cell: desk ? 12 : 10, sag: 3, gamma: 1.25, lo: .08, ground: ground, thread: '#a89c8a', tint: .9, minR: .2, maxR: 1, mix: 0, reveal: 0, sway: .05, lens: 130 });
      if (type === 'viewer') Object.assign(o, { cell: desk ? 15 : 11, sag: 3, ground: '#1d2526', thread: '#6f685d', tint: .95, lo: .05, hi: .9, gamma: 1.15, minR: .3, maxR: 1.04, mix: 0, reveal: 0, sway: .06, lens: 120, preload: $$('[data-brand]').map(function (b) { return b.getAttribute('data-src'); }) });
      if (type === 'vision') Object.assign(o, { cell: desk ? 15 : 12, sag: desk ? 4 : 2, gamma: 1.25, lo: .06, ground: ground, thread: '#a89c8a', tint: .92, minR: .2, maxR: 1, mix: 0, reveal: 0, sway: .06, lens: 160, dprCap: Strand.BIG_CAP });
      var s = Strand.make(cv, o);
      if (!s) return;
      S[type] = S[type] || []; S[type].push(s);
      if (canHover && type !== 'hero') {
        host.addEventListener('pointermove', function (e) { s.pointer(e); });
        host.addEventListener('pointerleave', function () { s.leave(); });
      }
    });
    gsap.ticker.add(Strand.tick);
  }
  function tw(s, props, vars) {
    var o = {}; Object.keys(props).forEach(function (k) { o[k] = s.o[k]; });
    return gsap.to(o, Object.assign({ onUpdate: function () { s.set(o); } }, props, vars));
  }

  // ——— Header + chapter strand: theme and progress ———
  var header = $('[data-header]'), strandNav = $('[data-strand-nav]'), showHeader = function () {};
  function setupChrome() {
    var sections = $$('main > section');
    sections.forEach(function (sec) {
      var light = sec.getAttribute('data-theme') === 'light';
      var bg = getComputedStyle(sec).backgroundColor;
      ST.create({ trigger: sec, start: 'top 60px', end: 'bottom 60px', onToggle: function (s) { if (s.isActive) { header.classList.toggle('on-light', light); header.style.setProperty('--hd-bg', bg); } } });
      ST.create({ trigger: sec, start: 'top center', end: 'bottom center', onToggle: function (s) { if (s.isActive) strandNav.classList.toggle('on-light', light); } });
    });
    var ft = $('.ft');
    ST.create({ trigger: ft, start: 'top 60px', onToggle: function (s) { if (s.isActive) { header.classList.remove('on-light'); header.style.setProperty('--hd-bg', 'rgb(20, 26, 27)'); } } });
    // a soft backing once the page has moved, and the header steps aside while reading downward
    var hidden = false, last = 0;
    ST.create({ start: 0, end: 'max', onUpdate: function (s) {
      var y = s.scroll(), d = y - last;
      header.classList.toggle('has-bg', y > 60);
      if (indexOpen) { last = y; return; }
      if (Math.abs(d) < 6) return;
      var near = ST.maxScroll(window) - y < 80;
      if (d > 0 && y > window.innerHeight * .6 && !hidden && !near) { hidden = true; gsap.to(header, { yPercent: -110, duration: DM, ease: E.out, overwrite: true }); }
      else if ((d < 0 || near) && hidden) { hidden = false; gsap.to(header, { yPercent: 0, duration: DM, ease: E.out, overwrite: true }); }
      last = y;
    } });
    showHeader = function () { if (hidden) { hidden = false; gsap.to(header, { yPercent: 0, duration: DM, ease: E.out, overwrite: true }); } };
    ST.create({ trigger: ft, start: 'top center', onToggle: function (s) { if (s.isActive) strandNav.classList.remove('on-light'); } });
    var links = $$('[data-strand-link]');
    links.forEach(function (a) {
      var t = $(a.getAttribute('href'));
      if (!t) return;
      ST.create({ trigger: t, start: 'top center', end: 'bottom center', onToggle: function (s) { if (s.isActive) { links.forEach(function (l) { l.classList.toggle('is-on', l === a); l.removeAttribute('aria-current'); }); a.setAttribute('aria-current', 'true'); } } });
    });
    var fill = $('[data-strand-fill]');
    if (!RM) gsap.to(fill, { scaleY: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: true } });
  }

  // ——— Iris: a nacre circle opens from the click, the page moves, it closes to a pearl ———
  var iris = $('[data-iris]');
  function irisTo(target, x, y, before) {
    if (RM) { if (before) before(); jump(target); return; }
    var w = window.innerWidth, h = window.innerHeight;
    var R1 = Math.hypot(Math.max(x, w - x), Math.max(y, h - y)) + 4, R2 = Math.hypot(w / 2, h / 2) + 4;
    iris.classList.add('is-on');
    gsap.timeline()
      .fromTo(iris, { clipPath: 'circle(0px at ' + x + 'px ' + y + 'px)' }, { clipPath: 'circle(' + R1 + 'px at ' + x + 'px ' + y + 'px)', duration: DM, ease: E.inOut })
      .add(function () { if (before) before(); jump(target); })
      .fromTo(iris, { clipPath: 'circle(' + R2 + 'px at 50% 50%)' }, { clipPath: 'circle(0px at 50% 50%)', duration: DM, ease: E.inOut, immediateRender: false }, '+=.06')
      .add(function () { iris.classList.remove('is-on'); });
  }

  // ——— Index overlay ———
  var indexOpen = false;
  function setupIndex() {
    var btn = $('[data-index-open]'), idx = $('[data-index]'), label = $('.hd__index-label', btn);
    var items = $$('.index__list li', idx), aside = $('.index__aside', idx);
    var cx = 0, cy = 0;
    function open() {
      indexOpen = true;
      var r = btn.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2;
      var R = Math.hypot(Math.max(cx, window.innerWidth - cx), Math.max(cy, window.innerHeight - cy)) + 4;
      showHeader();
      idx.hidden = false; btn.setAttribute('aria-expanded', 'true'); label.textContent = 'Close';
      header.classList.add('index-open');
      if (RM) { gsap.set(idx, { clipPath: 'none' }); }
      else {
        gsap.fromTo(idx, { clipPath: 'circle(0px at ' + cx + 'px ' + cy + 'px)' }, { clipPath: 'circle(' + R + 'px at ' + cx + 'px ' + cy + 'px)', duration: DL, ease: E.inOut });
        gsap.fromTo(items, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: DL, ease: E.out, delay: .35, stagger: .06 });
        gsap.fromTo(aside, { opacity: 0 }, { opacity: 1, duration: DL, delay: .6, ease: E.out });
      }
      lock();
      setTimeout(function () { var a = $('a', items[0]); if (a) a.focus({ preventScroll: true }); }, 50);
    }
    function close(instant) {
      indexOpen = false;
      btn.setAttribute('aria-expanded', 'false'); label.textContent = 'Index';
      header.classList.remove('index-open');
      var done = function () { idx.hidden = true; };
      if (instant || RM) { done(); }
      else gsap.to(idx, { clipPath: 'circle(0px at ' + cx + 'px ' + cy + 'px)', duration: DM, ease: E.inOut, onComplete: done });
      unlock();
      btn.focus({ preventScroll: true });
    }
    btn.addEventListener('click', function () { if (indexOpen) close(); else open(); });
    document.addEventListener('keydown', function (e) {
      if (!indexOpen) return;
      if (e.key === 'Escape') close();
      if (e.key === 'Tab') {
        var f = [btn].concat($$('a', idx));
        var i = f.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
      }
    });
    return { close: close };
  }

  // ——— All in-page navigation goes through the iris ———
  function setupNav(index) {
    $$('a[href^="#"]').forEach(function (a) {
      var id = a.getAttribute('href');
      if (id === '#' || id === '#main') return;
      a.addEventListener('click', function (e) {
        var t = $(id); if (!t) return;
        e.preventDefault();
        var x = e.clientX || window.innerWidth / 2, y = e.clientY || window.innerHeight / 2;
        irisTo(t, x, y, function () { if (indexOpen) index.close(true); });
      });
    });
  }

  // ——— Scroll choreography ———
  function setupScroll() {
    $$('[data-r]').forEach(function (el) {
      var k = el.getAttribute('data-r');
      if (!RM && R[k]) {
        R[k].set(el);
        ST.create({ trigger: el, start: 'top 92%', once: true, onEnter: function () { R[k].play(el); } });
      }
      el.classList.add('r-set');
    });
    if (RM) return;

    // the idea, read word by word
    var st = $('[data-fill]');
    if (st) {
      var ws = words(st).map(function (i) { return i.parentNode; });
      gsap.fromTo(ws, { opacity: .16 }, { opacity: 1, ease: 'none', stagger: .1, scrollTrigger: { trigger: st, start: 'top 80%', end: 'bottom 55%', scrub: true } });
      $$('.inl', st).forEach(function (p) {
        gsap.fromTo(p, { scale: .3, opacity: 0 }, { scale: 1, opacity: 1, duration: DL, ease: E.out, scrollTrigger: { trigger: p, start: 'top 82%', once: true } });
      });
    }
    $$('[data-parallax]').forEach(function (el) {
      gsap.fromTo(el, { yPercent: -6, scale: 1.12 }, { yPercent: 6, scale: 1.12, ease: 'none', scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
    });

    // what the shell is for: the strand is drawn and four pearls settle on it
    var sh = $('[data-shell-strand]');
    if (sh) {
      var tl = gsap.timeline({ paused: true });
      tl.fromTo($('.shell__line', sh), { scaleX: 0 }, { scaleX: 1, duration: 1.6, ease: E.inOut })
        .fromTo($$('.shell__pearl', sh), { y: -60, opacity: 0 }, { y: 0, opacity: 1, duration: DL, ease: 'bounce.out', stagger: .14 }, .5)
        .fromTo($$('.shell__list strong, .shell__list .small, .shell__list .num', sh), { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: DL, ease: E.out, stagger: .04 }, .8);
      ST.create({ trigger: sh, start: 'top 82%', once: true, onEnter: function () { tl.play(); } });
    }

    // strand figures: string on, then resolve into the photograph
    (S.photo || []).forEach(function (s) {
      ST.create({ trigger: s.host, start: 'top 85%', once: true, onEnter: function () {
        tw(s, { reveal: 1 }, { duration: 1.6, ease: E.out });
        tw(s, { mix: 1 }, { duration: 1.6, delay: 1.2, ease: E.inOut });
      } });
    });
    (S.vision || []).forEach(function (s) {
      gsap.timeline({ scrollTrigger: { trigger: s.host, start: 'top 90%', end: 'center 45%', scrub: true } })
        .fromTo({ v: 0 }, { v: 0 }, { v: 1, ease: 'none', duration: .45, onUpdate: function () { s.set({ reveal: this.targets()[0].v }); } }, 0)
        .fromTo({ v: 0 }, { v: 0 }, { v: 1, ease: 'none', duration: .55, onUpdate: function () { s.set({ mix: this.targets()[0].v }); } }, .45);
    });
    var pano = $('[data-pano]');
    if (pano) gsap.fromTo(pano, { clipPath: 'inset(0% 18% 0% 18% round 999px)' }, { clipPath: 'inset(0% 0% 0% 0% round 999px)', ease: 'none', scrollTrigger: { trigger: pano, start: 'top bottom', end: 'center center', scrub: true } });
  }

  // ——— Hero: the pearl opens ———
  function setupHero() {
    var pearl = $('[data-hero-pearl]'), media = $('[data-hero-media]'), stage = $('.hero__stage');
    var title = $('[data-hero-title]'), caps = $$('[data-hero-cap]'), cue = $('[data-hero-cue]'), open = $('[data-hero-open]'), veil = $('[data-hero-veil]');
    if (RM) { gsap.set(open, { opacity: 0 }); return; }
    var hs = (S.hero || [])[0];
    function cover() {
      var r = pearl.offsetWidth / 2, w = window.innerWidth, h = window.innerHeight;
      var cy = pearl.offsetTop + r;
      return Math.hypot(w / 2, Math.max(cy, h - cy)) / r + .02;
    }
    var k = { s: 1 };
    var apply = function () { gsap.set(pearl, { scale: k.s }); gsap.set(media, { scale: 1 / k.s }); };
    var tl = gsap.timeline({ scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom bottom', scrub: true, invalidateOnRefresh: true } });
    tl.to(k, { s: function () { return cover(); }, ease: 'power2.inOut', duration: .5, onUpdate: apply }, 0)
      .to(title, { yPercent: 60, opacity: 0, ease: 'none', duration: .22 }, 0)
      .to(caps, { opacity: 0, x: function (i) { return i ? 40 : -40; }, ease: 'none', duration: .2 }, 0)
      .to(cue, { opacity: 0, ease: 'none', duration: .1 }, 0)
      .to(veil, { opacity: 1, ease: 'none', duration: .2 }, .5)
      .fromTo(open, { opacity: 0, y: 40 }, { opacity: 1, y: 0, ease: 'none', duration: .2 }, .55)
      .to({}, { duration: .25 });
    if (hs) tl.fromTo({ m: 0 }, { m: 0 }, { m: 1, ease: 'none', duration: .35, onUpdate: function () { hs.set({ mix: this.targets()[0].m }); } }, .15);
  }

  // ——— The necklace ———
  function setupNecklace() {
    var svg = $('.necklace__svg'); if (!svg) return;
    var NS = 'http://www.w3.org/2000/svg';
    svg.setAttribute('viewBox', window.innerWidth > 991 ? '-290 0 1780 880' : '0 0 1200 880');
    var path = $('[data-nk-thread]'), L = path.getTotalLength();
    var gB = $('[data-nk-beads]'), gP = $('[data-nk-pendants]');
    var disc = $$('[data-disc] li').map(function (li) { return li.textContent.replace(/^\d+/, '').trim(); });
    var brands = ['DADA', 'SAYAH', 'DÉJÀ VU', 'M04', 'RANDEZVOU'];
    var kinds = ['Restaurant', 'Beachclub', 'Concept', 'Concept', 'Concept'];
    function el(n, a) { var e = document.createElementNS(NS, n); for (var k in a) e.setAttribute(k, a[k]); return e; }
    var beads = [], pend = [];
    [.1, .165, .23, .295, .705, .77, .835, .9].forEach(function (t, i) {
      var p = path.getPointAtLength(t * L), left = t < .5;
      var g = el('g', { class: 'nk__bead' });
      g.appendChild(el('circle', { cx: p.x, cy: p.y, r: 11, fill: 'url(#pearl-dark)' }));
      var tx = el('text', { x: p.x + (left ? -24 : 24), y: p.y + 5, class: 'nk__t nk__t--dim', 'text-anchor': left ? 'end' : 'start' });
      tx.textContent = disc[i] || '';
      g.appendChild(tx); gB.appendChild(g); beads.push(g);
    });
    [.38, .44, .5, .56, .62].forEach(function (t, i) {
      var p = path.getPointAtLength(t * L), drop = i % 2 ? 54 : 104;
      var g = el('g', { class: 'nk__pend' });
      g.appendChild(el('line', { x1: p.x, y1: p.y, x2: p.x, y2: p.y + drop, class: 'nk__drop' }));
      g.appendChild(el('circle', { cx: p.x, cy: p.y + drop + 24, r: 24, fill: 'url(#pearl-dark)' }));
      var tn = el('text', { x: p.x, y: p.y + drop + 84, class: 'nk__t nk__t--brand' }); tn.textContent = brands[i];
      var tk = el('text', { x: p.x, y: p.y + drop + 106, class: 'nk__t nk__t--c nk__t--sm' }); tk.textContent = kinds[i];
      g.appendChild(tn); g.appendChild(tk); gP.appendChild(g); pend.push(g);
    });
    if (RM) return;
    var lis = $$('[data-disc] li');
    gsap.set(path, { strokeDasharray: L, strokeDashoffset: L });
    gsap.set(beads, { opacity: 0, scale: .2, transformOrigin: '50% 50%', transformBox: 'fill-box' });
    gsap.set(pend, { opacity: 0, y: -50 });
    gsap.set($$('[data-nk-clasp], [data-nk-center]'), { opacity: 0 });
    var desk = window.innerWidth > 991;
    var tl = gsap.timeline({ scrollTrigger: desk
      ? { trigger: '[data-necklace]', start: 'top top', end: '+=150%', pin: true, scrub: true, anticipatePin: 1 }
      : { trigger: svg, start: 'top 85%', end: 'bottom 45%', scrub: true } });
    tl.to($('[data-nk-clasp]'), { opacity: 1, duration: .08, ease: 'none' }, 0)
      .to(path, { strokeDashoffset: 0, duration: .45, ease: 'none' }, .02)
      .to($$('[data-nk-center]'), { opacity: 1, duration: .1, ease: 'none' }, .2);
    beads.forEach(function (b, i) {
      var at = .12 + [.04, .08, .12, .16, .4, .36, .32, .28][i];
      tl.to(b, { opacity: 1, scale: 1, duration: .07, ease: 'none', onStart: function () { lis.forEach(function (l, j) { l.classList.toggle('is-on', j === i); }); } }, at);
    });
    tl.to(pend, { opacity: 1, y: 0, duration: .14, stagger: .04, ease: 'none' }, .5)
      .add(function () { lis.forEach(function (l) { l.classList.remove('is-on'); }); }, .72)
      .to({}, { duration: .15 });
  }

  // ——— Five pearls: one sticky viewer re-strings itself for each name ———
  function setupPearls() {
    var rows = $$('[data-brand]'), viewer = $('[data-viewer]'), num = $('[data-viewer-num]'), vimg = $('[data-viewer-img]');
    if (!rows.length) return;
    var vs = (S.viewer || [])[0], current = 0, busy = null, cache = {};
    function img(src) {
      if (cache[src]) return cache[src];
      var p = new Promise(function (res) { var i = new Image(); i.decoding = 'async'; i.onload = function () { res(i); }; i.onerror = function () { res(null); }; i.src = src; });
      cache[src] = p; return p;
    }
    function show(i) {
      if (i === current) return;
      current = i;
      rows.forEach(function (r, j) { r.classList.toggle('is-on', j === i); });
      num.textContent = String(i + 1).padStart(2, '0');
      var src = rows[i].getAttribute('data-src');
      if (!vs || !vs.ready || RM) { vimg.src = src; return; }
      if (busy) busy.kill();
      busy = gsap.timeline();
      busy.add(tw(vs, { mix: 0 }, { duration: .35, ease: E.in }))
        .add(tw(vs, { reveal: 0 }, { duration: .45, ease: E.in }))
        .add(function () {
          var again = function () { vimg.src = src; tw(vs, { reveal: 1 }, { duration: .7, ease: E.out }); tw(vs, { mix: 1 }, { duration: .8, delay: .55, ease: E.inOut }); };
          if (vs.swap(src)) again(); // texture prepared during idle: a bind, no upload
          else img(src).then(function (im) { if (im && current === i) { vs.upload(im); again(); } });
        });
    }
    rows[0].classList.add('is-on');
    rows.forEach(function (r, i) {
      ST.create({ trigger: r, start: 'top 55%', end: 'bottom 55%', onToggle: function (s) { if (s.isActive) show(i); } });
    });
    rows.forEach(function (r) { img(r.getAttribute('data-src')); });
    if (vs) ST.create({ trigger: viewer, start: 'top 85%', once: true, onEnter: function () {
      tw(vs, { reveal: 1 }, { duration: 1.4, ease: E.out }); tw(vs, { mix: 1 }, { duration: 1.4, delay: 1, ease: E.inOut });
    } });
  }

  // ——— Contact: copy + a pearl grows into the thank-you ———
  function setupContact() {
    var copy = $('[data-copy]'), status = $('[data-copy-status]');
    copy.addEventListener('click', function () {
      var v = copy.getAttribute('data-copy');
      var ok = function () { status.textContent = 'Copied'; setTimeout(function () { status.textContent = ''; }, 2200); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(v).then(ok, function () { status.textContent = v; });
      else status.textContent = v;
    });
    var card = $('[data-card]'), form = $('[data-form]'), done = $('[data-done]'), grow = $('[data-grow]'), err = $('[data-form-error]'), send = $('[data-send]');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var bad = $$('input, textarea', form).filter(function (f) { return !f.checkValidity(); });
      if (bad.length) { err.textContent = bad[0].type === 'email' && bad[0].value ? 'Please check the email address.' : 'Please fill in every field.'; bad[0].focus(); return; }
      err.textContent = '';
      var cr = card.getBoundingClientRect(), br = send.getBoundingClientRect();
      var x = br.left - cr.left + 22, y = br.top - cr.top + br.height / 2;
      var R = Math.hypot(Math.max(x, cr.width - x), Math.max(y, cr.height - y));
      gsap.set(grow, { left: x - 10, top: y - 10 });
      var finish = function () { card.classList.add('is-done'); done.hidden = false; done.focus({ preventScroll: true }); };
      if (RM) { gsap.set(grow, { scale: R / 10 + 1 }); finish(); return; }
      gsap.timeline()
        .to(grow, { scale: R / 10 + 1, duration: DL, ease: E.inOut })
        .add(finish, '-=.3')
        .fromTo(Array.prototype.slice.call(done.children), { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: DL, stagger: .08, ease: E.out }, '-=.3');
    });
    $('[data-form-reset]').addEventListener('click', function () {
      form.reset(); done.hidden = true; card.classList.remove('is-done');
      gsap.to(grow, { scale: 0, duration: RM ? 0 : DM, ease: E.inOut });
      $('input', form).focus({ preventScroll: true });
    });
  }

  // ——— Footer strand: pearls lean toward the pointer ———
  function setupFooter() {
    var host = $('[data-ft-strand]'), box = $('[data-ft-beads]');
    if (!host) return;
    var N = 13, beads = [], sizes = [10, 12, 14, 16, 19, 22, 26, 22, 19, 16, 14, 12, 10];
    for (var i = 0; i < N; i++) { var s = document.createElement('span'); s.style.width = s.style.height = sizes[i] + 'px'; box.appendChild(s); beads.push(s); }
    function curveY(t) { var a = 1 - t; return a * a * a * 40 + 3 * a * a * t * 100 + 3 * a * t * t * 100 + t * t * t * 40; } // viewBox 1200×120
    var W = 0, H = 0, mx = -1, state = beads.map(function (b, i) { return { t: (i + 1) / (N + 1), x: 0 }; });
    var setters = beads.map(function (b) { return { x: gsap.quickSetter(b, 'x', 'px'), y: gsap.quickSetter(b, 'y', 'px') }; });
    function layout() { W = host.offsetWidth; H = host.offsetHeight; }
    function frame() {
      for (var i = 0; i < N; i++) {
        var st = state[i], base = st.t, target = base;
        if (mx >= 0) { var d = mx - base; target = base + d * .55 * Math.exp(-(d * d) / .045); }
        st.x += (target - st.x) * .08;
        if (!st.x) st.x = base;
        var t = Math.min(.999, Math.max(.001, st.x)), sz = sizes[i];
        setters[i].x(t * W - sz / 2); setters[i].y(curveY(t) / 120 * H - sz / 2);
      }
    }
    layout(); state.forEach(function (s) { s.x = s.t; }); frame();
    window.addEventListener('resize', function () { layout(); frame(); });
    if (RM) return;
    var on = false;
    ST.create({ trigger: host, start: 'top bottom', end: 'bottom top', onToggle: function (s) { on = s.isActive; } });
    gsap.ticker.add(function () { if (on) frame(); });
    if (canHover) {
      host.parentElement.addEventListener('pointermove', function (e) { var r = host.getBoundingClientRect(); mx = (e.clientX - r.left) / r.width; });
      host.parentElement.addEventListener('pointerleave', function () { mx = -1; });
    }
  }

  // ——— Loader: draw the thread, string seven pearls, open into the hero pearl ———
  function intro() {
    var loader = $('[data-loader]');
    var pearl = $('[data-hero-pearl]'), title = $('[data-hero-title]'), caps = $$('[data-hero-cap]'), cue = $('[data-hero-cue]');
    var revisit = root.classList.contains('revisit');
    try { sessionStorage.setItem('dorr8-visited', '1'); } catch (e) {}
    var hs = (S.hero || [])[0];
    function heroIn(d) {
      gsap.fromTo(pearl, { scale: .35, opacity: 0 }, { scale: 1, opacity: 1, duration: 1.8, delay: d, ease: E.out, onComplete: function () { if (hs) hs.resize(); } });
      if (hs) { hs.init(); tw(hs, { reveal: 1 }, { duration: 2.4, delay: d + .2, ease: E.out }); }
      gsap.fromTo($$('.hero__sub, .hero__name', title), { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: DL, delay: d + .5, stagger: .12, ease: E.out });
      gsap.fromTo(caps, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: DL, delay: d + .8, stagger: .1, ease: E.out });
      gsap.fromTo([header, strandNav, cue], { opacity: 0 }, { opacity: 1, duration: DL, delay: d + .9, ease: E.out });
    }
    if (RM || !loader) { if (loader) loader.remove(); if (hs) hs.set({ reveal: 1 }); return; }
    lock();
    gsap.set([pearl, header, strandNav, cue, caps, $$('.hero__sub, .hero__name', title)], { opacity: 0 });
    if (revisit) {
      gsap.to(loader, { opacity: 0, duration: DM, ease: E.out, delay: .1, onComplete: function () { loader.remove(); unlock(); ST.refresh(); if (Strand && Strand.prewarm) setTimeout(Strand.prewarm, 1200); } });
      heroIn(.2);
      return;
    }
    var thread = $('[data-loader-thread]'), L = thread.getTotalLength();
    var pearls = $$('[data-loader-pearls] circle');
    var spots = [.29, .355, .425, .5, .575, .645, .71];
    gsap.set(thread, { strokeDasharray: L, strokeDashoffset: L });
    var pos = pearls.map(function () { return { t: 0 }; });
    function place(i) { var p = thread.getPointAtLength(pos[i].t * L); pearls[i].setAttribute('cx', p.x.toFixed(1)); pearls[i].setAttribute('cy', (p.y - +pearls[i].getAttribute('r') + 1).toFixed(1)); }
    pearls.forEach(function (c, i) { place(i); gsap.set(c, { opacity: 0 }); });
    var tl = gsap.timeline();
    tl.to(thread, { strokeDashoffset: 0, duration: 1.1, ease: E.inOut })
      .fromTo($$('.loader__name, .loader__note'), { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: DL, stagger: .1, ease: E.out }, .3);
    // pearls string on in order of arrival (rightmost first), each sliding from the left end
    var order = [6, 5, 4, 3, 2, 1, 0];
    order.forEach(function (i, k) {
      tl.set(pearls[i], { opacity: 1 }, .8 + k * .2)
        .to(pos[i], { t: spots[i], duration: 1.1, ease: E.out, onUpdate: function () { place(i); } }, .8 + k * .2);
    });
    var heroImg = $('.hero__media img');
    var ready = Promise.all([
      document.fonts ? document.fonts.ready : Promise.resolve(),
      new Promise(function (res) { if (heroImg.complete) res(); else { heroImg.addEventListener('load', res, { once: true }); heroImg.addEventListener('error', res, { once: true }); } })
    ]);
    var minDone = new Promise(function (res) { tl.eventCallback('onComplete', res); });
    // never hold the page hostage: a slow hero image or a font that never settles (seen on iOS)
    // must not keep the loader up, so readiness gives up after a few seconds
    ready = Promise.race([ready, new Promise(function (res) { setTimeout(res, 4000); })]);
    Promise.all([ready, minDone]).then(function () {
      var mid = pearls[3];
      gsap.timeline()
        .to(pearls.filter(function (p) { return p !== mid; }), { opacity: 0, duration: DS, stagger: { each: .04, from: 'center' }, ease: E.in }, 0)
        .to([thread, $('.loader__name'), $('.loader__note')], { opacity: 0, duration: DS, ease: E.in }, 0)
        .to(mid, { attr: { r: 60 }, opacity: 0, duration: 1, ease: E.inOut }, .1)
        .to(loader, { backgroundColor: 'rgba(236,230,218,0)', duration: DM, ease: E.inOut }, .35)
        .add(function () { loader.style.pointerEvents = 'none'; }, .5)
        .add(function () { loader.remove(); unlock(); ST.refresh(); if (Strand && Strand.prewarm) setTimeout(Strand.prewarm, 1200); }, 1.3);
      heroIn(.4);
    });
  }

  function boot() {
    setupStrands();
    var index = setupIndex();
    setupNav(index);
    setupScroll();
    setupHero();
    setupNecklace();
    setupPearls();
    setupChrome(); // after the pins, so band positions include pin spacing
    setupContact();
    setupFooter();
    intro();
    if (Strand && Strand.prewarm && !RM) setTimeout(Strand.prewarm, 600); // program + textures ready long before they are seen
    var t;
    window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(function () { if (Strand) Strand.resizeAll(); }, 150); });
    window.addEventListener('load', function () { ST.refresh(); });
  }
  var fonts = document.fonts && document.fonts.load ? Promise.all([document.fonts.load('300 60px Cormorant'), document.fonts.load('400 16px "Hanken Grotesk"')]) : Promise.resolve();
  var started = false;
  function go() { if (started) return; started = true; try { boot(); } catch (e) { root.classList.remove('js'); if (window.console) console.warn(e); } }
  fonts.then(go, go);
  setTimeout(go, 2500);

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js', { scope: './' }).catch(function () {}); });
  }
})();
