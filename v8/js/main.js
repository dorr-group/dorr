/* DORR v8 — main.js: motion system (GSAP + ScrollTrigger + Lenis), loader, menu, reveals, woven figures. */
(function () {
  'use strict';
  var root = document.documentElement;
  var hasGsap = window.gsap && window.ScrollTrigger;
  if (!hasGsap) { root.classList.remove('js'); return; }
  window.DORR_OK = true;

  var gsap = window.gsap, ST = window.ScrollTrigger, Loom = window.DORRLoom, Weave = window.DORRWeave;
  gsap.registerPlugin(ST);
  var RM = root.classList.contains('rm');
  var mqDesk = window.matchMedia('(min-width: 992px)');
  var canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  // ——— Motion tokens (after Son Daven: Out / InOut / In; 1.2 / .8 / .4; stagger .1; delay .2) ———
  function bezier(x1, y1, x2, y2) {
    function A(a, b) { return 1 - 3 * b + 3 * a; }
    function B(a, b) { return 3 * b - 6 * a; }
    function C(a) { return 3 * a; }
    function calc(t, a, b) { return ((A(a, b) * t + B(a, b)) * t + C(a)) * t; }
    function slope(t, a, b) { return 3 * A(a, b) * t * t + 2 * B(a, b) * t + C(a); }
    return function (x) {
      if (x <= 0) return 0; if (x >= 1) return 1;
      var t = x;
      for (var i = 0; i < 8; i++) { var s = slope(t, x1, x2); if (Math.abs(s) < 1e-6) break; t -= (calc(t, x1, x2) - x) / s; }
      if (t < 0 || t > 1) { var lo = 0, hi = 1; t = x; for (var j = 0; j < 20; j++) { var v = calc(t, x1, x2); if (Math.abs(v - x) < 1e-5) break; if (v < x) lo = t; else hi = t; t = (lo + hi) / 2; } }
      return calc(t, y1, y2);
    };
  }
  var E = { out: bezier(.25, 1, .5, 1), inOut: bezier(.76, 0, .24, 1), in: bezier(.5, 0, .75, 0), ease: bezier(.25, .1, .25, 1) };
  var DL = 1.2, DM = .8, DS = .4, STAG = .1, DELAY = .2;

  // ——— Lenis smooth scroll (wheel only; touch stays native) ———
  var lenis = null;
  ST.config({ ignoreMobileResize: true });
  if (!RM && window.Lenis) {
    lenis = new window.Lenis({ duration: 1.15, easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); }, smoothWheel: true, syncTouch: false });
    lenis.on('scroll', ST.update);
    window.__lenis = lenis;
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
  }
  function scrollToTarget(target, opts) {
    opts = opts || {};
    if (lenis) lenis.scrollTo(target, { offset: 0, duration: opts.immediate ? 0 : 1.6, immediate: !!opts.immediate, force: true });
    else {
      var y = typeof target === 'number' ? target : target.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: y, behavior: opts.immediate || RM ? 'auto' : 'smooth' });
    }
  }
  function lockScroll() { if (lenis) lenis.stop(); else document.body.style.overflow = 'hidden'; }
  function unlockScroll() { if (lenis) lenis.start(); else document.body.style.overflow = ''; }

  // ——— Text splitting (own, small) ———
  function splitWords(el) {
    if (el.__words) return el.__words;
    el.__orig = el.innerHTML;
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var parts = n.textContent.split(/(\s+)/), frag = document.createDocumentFragment();
          parts.forEach(function (p) {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(p)); return; }
            var s = document.createElement('span'); s.className = 'w'; s.textContent = p; frag.appendChild(s);
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1 && n.tagName !== 'BR' && !n.classList.contains('w')) walk(n);
      });
    })(el);
    el.__words = $$('.w', el);
    return el.__words;
  }
  function splitChars(el) {
    if (el.__chars) return el.__chars;
    var words = splitWords(el), chars = [];
    words.forEach(function (w) {
      var t = w.textContent; w.textContent = '';
      for (var i = 0; i < t.length; i++) { var c = document.createElement('span'); c.className = 'ch'; c.textContent = t[i]; w.appendChild(c); chars.push(c); }
    });
    el.__chars = chars;
    return chars;
  }
  function lineIndex(words) {
    var tops = [], idx = [];
    words.forEach(function (w) {
      var t = Math.round(w.offsetTop);
      var i = tops.indexOf(t);
      if (i < 0) { tops.push(t); i = tops.length - 1; }
      idx.push(i);
    });
    return idx;
  }

  // ——— Reveals (word scatter, line rise, block lift, rule wipe) ———
  var wrapIn = gsap.utils.wrap([-150, 75, -75, 150]);
  var R = {
    h: {
      set: function (el) { var w = splitWords(el); gsap.set(w, { yPercent: function (i) { return wrapIn(i); }, scale: 0, opacity: 0 }); },
      play: function (el, d) {
        var w = splitWords(el);
        return gsap.to(w, { yPercent: 0, scale: 1, opacity: 1, duration: DL, delay: d == null ? DELAY : d, ease: E.out, stagger: { each: .25 * STAG, from: 'random' }, overwrite: true });
      },
      hide: function (el) { var w = splitWords(el); return gsap.to(w, { yPercent: function (i) { return [75, -75][i % 2]; }, scale: 0, opacity: 0, duration: DS, ease: E.in, stagger: { each: .25 * STAG, from: 'random' }, overwrite: true }); }
    },
    p: {
      set: function (el) { var w = splitWords(el); gsap.set(w, { yPercent: 250, opacity: 0 }); },
      play: function (el, d) {
        var w = splitWords(el), li = lineIndex(w);
        return gsap.to(w, { yPercent: 0, opacity: 1, duration: DL, ease: E.out, delay: function (i) { return (d == null ? DELAY : d) + li[i] * .5 * STAG; }, overwrite: true,
          onComplete: function () { if (el.__orig != null) { el.innerHTML = el.__orig; el.__words = null; } } });
      }
    },
    ctn: {
      set: function (el) { gsap.set(el, { yPercent: 100, opacity: 0 }); },
      play: function (el, d) { return gsap.to(el, { yPercent: 0, opacity: 1, duration: DL, delay: d == null ? DELAY : d, ease: E.out, overwrite: true }); },
      hide: function (el) { return gsap.to(el, { opacity: 0, duration: DS, ease: E.in, overwrite: true }); }
    },
    line: {
      set: function (el) { gsap.set(el, { clipPath: 'inset(0% 100% -1px 0%)' }); },
      play: function (el, d) { return gsap.to(el, { clipPath: 'inset(0% 0% -1px 0%)', duration: DL, delay: d == null ? DELAY : d, ease: E.out, overwrite: true }); }
    }
  };
  function prepReveal(el) { var k = el.getAttribute('data-r'); if (R[k]) R[k].set(el); el.classList.add('r-set'); }
  function playReveal(el, d) { var k = el.getAttribute('data-r'); if (R[k]) R[k].play(el, d); }

  // ——— Woven wordmarks + runtime textures ———
  Weave.installTextures();
  var weaves = {};
  function buildWeaves() {
    var desk = window.innerWidth > 700;
    var spec = { hero: [desk ? 150 : 96, 7], logo: [62, 7], footer: [desk ? 190 : 110, 9] };
    Object.keys(spec).forEach(function (k) {
      var host = $('[data-weave="' + k + '"]');
      if (!host) return;
      host.innerHTML = '';
      var svg = Weave.build('DORR', spec[k][0], spec[k][1]);
      host.appendChild(svg);
      weaves[k] = svg;
    });
    root.classList.add('has-weave');
  }
  function weaveIn(svg, opts) {
    opts = opts || {};
    var cols = $$('path', svg);
    cols.forEach(function (p) { p.style.transformOrigin = p.hasAttribute('data-up') ? '50% 0%' : '50% 100%'; });
    return gsap.fromTo(cols, { scaleY: 0 }, { scaleY: 1, duration: opts.duration || DL, ease: E.out, delay: opts.delay || 0, stagger: { each: (opts.spread || .9) / cols.length, from: 'random' } });
  }

  // ——— Woven figures (WebGL loom) ———
  var looms = {};
  function hostOf(cv) { return cv.closest('.weft, .vision__media, .prologue__scene, .hero__land, .ft__scene, .loader__object') || cv.parentElement; }
  function setupLooms() {
    if (!Loom || !Loom.supported || RM) { root.classList.add('no-loom'); return; }
    var desk = mqDesk.matches;
    $$('canvas[data-loom]').forEach(function (cv) {
      var type = cv.getAttribute('data-loom'), host = hostOf(cv);
      var o = {
        host: host,
        onReady: function () { host.classList.add('is-woven'); },
        onSleep: function (l, forever) { if (forever) { host.classList.remove('is-woven'); root.classList.add('no-loom'); } }
      };
      if (type === 'oyster') Object.assign(o, { cols: desk ? 120 : 90, invert: 1, lo: .07, hi: .8, gamma: 1.15, key: .1, fg: '#c9bfad', bgA: 0, reveal: 0, fit: 'contain', live: true, maxW: 1 });
      if (type === 'land') Object.assign(o, { cols: desk ? 118 : 56, lo: .22, hi: .74, gamma: 1.25, key: .16, fg: '#141a1b', bgA: 0, sway: .05, fy: .62, maxW: 1.02 });
      if (type === 'prologue-l') Object.assign(o, { cols: desk ? 64 : 46, invert: 1, lo: .08, hi: .8, key: .12, fg: '#c9bfad', bgA: 0, fit: 'contain', sway: .06, maxW: 1 });
      if (type === 'prologue-r') Object.assign(o, { cols: desk ? 52 : 40, invert: 1, lo: .08, hi: .8, key: .12, fg: '#c9bfad', bgA: 0, fit: 'contain', sway: .06, zoom: 1.25, maxW: 1 });
      if (type === 'photo') Object.assign(o, { cell: desk ? 9 : 8, fg: cv.getAttribute('data-fg') || '#141a1b', bg: cv.getAttribute('data-bg') || '#c9bfad', bgA: 1, lo: .05, hi: .95, key: .05, reveal: 0, mix: 0, lens: desk ? 150 : 110, maxW: 1 });
      if (type === 'vision') Object.assign(o, { cell: desk ? 10 : 8, fg: '#d6cdbd', bg: '#141a1b', bgA: 1, invert: 1, lo: .08, hi: .85, key: .06, mix: 1, sway: .035, maxW: 1 });
      if (type === 'footer') Object.assign(o, { cols: desk ? 150 : 64, lo: .12, hi: .6, gamma: 1.1, key: .42, fg: '#34403f', bgA: 0, sway: .05, fy: .7, maxW: 1 });
      var l = Loom.make(cv, o);
      if (!l) return;
      cv.__l = l;
      (looms[type] = looms[type] || []).push(l);
      if (type === 'photo' || type === 'vision') bindLens(l, host);
    });
    gsap.ticker.add(Loom.tick);
  }
  function bindLens(l, host) {
    if (!canHover) return;
    host.addEventListener('pointermove', function (e) { l.pointer(e); });
    host.addEventListener('pointerleave', function () { l.leave(); });
  }
  function loomTween(l, props, vars) {
    var o = {}; Object.keys(props).forEach(function (k) { o[k] = l.o[k]; });
    return gsap.to(o, Object.assign({ onUpdate: function () { l.set(o); } }, props, vars));
  }

  // ——— Header: theme per band, hide on scroll down past 1000px ———
  var header = $('[data-header]'), ground = $('[data-header-ground]');
  var menuOpen = false;
  function setHeaderTheme(dark) { header.classList.toggle('on-dark', !!dark); }
  function setupHeader() {
    var hh = header.offsetHeight / 2;
    $$('[data-theme]').forEach(function (sec) {
      var dark = sec.getAttribute('data-theme') === 'dark';
      if (sec.classList.contains('hero')) return;
      ST.create({ trigger: sec, start: 'top top+=' + hh, end: 'bottom top+=' + hh, onToggle: function (self) { if (self.isActive && !menuOpen) setHeaderTheme(dark); } });
    });
    var hidden = false, last = 0, hasGround = false;
    ST.create({
      start: 0, end: 'max',
      onUpdate: function (self) {
        var y = self.scroll(), d = y - last;
        var wantGround = y > 1000;
        if (wantGround !== hasGround) { hasGround = wantGround; gsap.to(ground, { opacity: wantGround ? 1 : 0, duration: DS, ease: E.out }); }
        if (Math.abs(d) < 40 && !(y < 10)) return;
        var nearEnd = ST.maxScroll(window) - y < 160;
        if (!menuOpen && d > 0 && y > 1000 && !hidden && !nearEnd) { hidden = true; gsap.to(header, { yPercent: -100, duration: DM, ease: E.out }); }
        else if ((d < 0 || nearEnd || y < 10) && hidden) { hidden = false; gsap.to(header, { yPercent: 0, duration: DM, ease: E.out }); }
        last = y;
      }
    });
  }

  // ——— Hover: characters scatter out, twin set scatters in ———
  function setupSwaps() {
    if (!canHover || RM) return;
    $$('[data-swap]').forEach(function (el) {
      var a = $('.swap__a', el), b = $('.swap__b', el);
      if (!a || !b) return;
      var ca = splitChars(a), cb = splitChars(b);
      gsap.set(cb, { yPercent: 75, opacity: 0, scale: 0 });
      var trg = el.closest('button, a') || el;
      trg.addEventListener('mouseenter', function () {
        gsap.fromTo(ca, { opacity: 1, yPercent: 0, scale: 1 }, { opacity: 0, yPercent: -75, scale: 0, duration: DM, ease: E.out, stagger: { each: .25 * STAG, from: 'random' }, overwrite: true });
        gsap.fromTo(cb, { opacity: 0, yPercent: 75, scale: 0 }, { opacity: 1, yPercent: 0, scale: 1, duration: DM, delay: DELAY, ease: E.out, stagger: { each: .25 * STAG, from: 'random' }, overwrite: true });
      });
      trg.addEventListener('mouseleave', function () {
        gsap.to(ca, { opacity: 1, yPercent: 0, scale: 1, duration: DM, delay: DELAY, ease: E.out, stagger: { each: .25 * STAG, from: 'random' }, overwrite: true });
        gsap.to(cb, { opacity: 0, yPercent: 75, scale: 0, duration: DM, ease: E.out, stagger: { each: .25 * STAG, from: 'random' }, overwrite: true });
      });
    });
  }

  // ——— Magnetic orb with elastic return ———
  function setupMagnetic() {
    if (!canHover || RM) return;
    $$('[data-magnetic]').forEach(function (el) {
      var inner = $('[data-magnetic-inner]', el);
      el.addEventListener('mousemove', function (e) {
        var r = el.getBoundingClientRect();
        var x = ((e.clientX - r.left) / r.width - .5), y = ((e.clientY - r.top) / r.height - .5);
        gsap.to(el, { x: x * 34, y: y * 34, duration: 1.6, ease: 'power4.out', overwrite: true });
        if (inner) gsap.to(inner, { x: x * 18, y: y * 18, duration: 2, ease: 'power4.out', overwrite: true });
      });
      el.addEventListener('mouseleave', function () {
        gsap.to(el, { x: 0, y: 0, duration: 1.6, ease: 'elastic.out(1, 0.3)', overwrite: true });
        if (inner) gsap.to(inner, { x: 0, y: 0, duration: 2, ease: 'elastic.out(1, 0.3)', overwrite: true });
      });
    });
  }

  // ——— Dither transition: 20×12 cells close from the far corner, page jumps, cells open ———
  var dither = $('[data-dither]'), cells = [];
  (function () { var f = document.createDocumentFragment(); for (var i = 0; i < 240; i++) { var c = document.createElement('i'); f.appendChild(c); cells.push(c); } dither.appendChild(f); })();
  function ditherTo(target, before) {
    if (RM) { if (before) before(); scrollToTarget(target, { immediate: true }); return; }
    dither.classList.add('is-on');
    gsap.timeline()
      .set(cells, { transformOrigin: '100% 50%' })
      .fromTo(cells, { scaleX: 0 }, { scaleX: 1, duration: DS, ease: E.inOut, stagger: { each: .03, from: 'end', grid: [12, 20] } })
      .add(function () {
        if (before) before();
        scrollToTarget(target, { immediate: true });
        ST.update();
      })
      .set(cells, { transformOrigin: '0% 50%' }, '+=.08')
      .to(cells, { scaleX: 0, duration: DS, ease: E.inOut, stagger: { each: .03, from: 'end', grid: [12, 20] } })
      .add(function () { dither.classList.remove('is-on'); });
  }

  // ——— Menu: woven mask sweep, burger crosses, scatter words, dim siblings ———
  function setupMenu() {
    var btn = $('[data-menu-open]'), menu = $('[data-menu]');
    var lines = $$('.burger__lines i', btn), words = $$('.menu__word', menu), links = $$('[data-menu-link]', menu);
    var aside = $('.menu__aside', menu);
    function open() {
      if (menuOpen) return;
      menuOpen = true;
      menu.hidden = false;
      words.forEach(function (w) { R.h.set(w); });
      btn.setAttribute('aria-expanded', 'true');
      setHeaderTheme(true);
      gsap.set(header, { yPercent: 0 });
      gsap.fromTo(menu, { '--mask-y': '0%', opacity: 1 }, { '--mask-y': '100%', duration: 1.5 * DL, ease: E.out, overwrite: true });
      gsap.to(lines[0], { y: 4, rotation: 28, duration: DM, ease: E.inOut, overwrite: true });
      gsap.to(lines[1], { y: -4, rotation: -28, duration: DM, ease: E.inOut, overwrite: true });
      words.forEach(function (w, i) { R.h.play(w, .4 + i * .5 * STAG); });
      gsap.fromTo(aside, { yPercent: 30, opacity: 0 }, { yPercent: 0, opacity: 1, duration: DL, delay: .5, ease: E.out });
      lockScroll();
      setTimeout(function () { if (links[0]) links[0].focus({ preventScroll: true }); }, 60);
    }
    function close(instant) {
      if (!menuOpen) return;
      menuOpen = false;
      btn.setAttribute('aria-expanded', 'false');
      gsap.to(lines, { y: 0, rotation: 0, duration: DM, ease: E.inOut, overwrite: true });
      if (instant) { gsap.set(menu, { opacity: 0 }); menu.hidden = true; }
      else {
        words.forEach(function (w) { R.h.hide(w); });
        gsap.to(menu, { opacity: 0, duration: DM, delay: DS, ease: E.out, overwrite: true, onComplete: function () { menu.hidden = true; } });
      }
      unlockScroll();
      ST.refresh(true);
      btn.focus({ preventScroll: true });
    }
    btn.addEventListener('click', function () { if (menuOpen) close(); else open(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menuOpen) close();
      if (e.key === 'Tab' && menuOpen) {
        var f = [btn].concat(links, $$('a', aside));
        var i = f.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
      }
    });
    links.forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var t = $(a.getAttribute('href'));
        if (t) ditherTo(t, function () { close(true); });
      });
      if (canHover) {
        a.addEventListener('mouseenter', function () { links.forEach(function (o) { if (o !== a) gsap.to(o, { opacity: .2, duration: DM, ease: E.out, overwrite: true }); }); gsap.to(a, { opacity: 1, duration: .25 * DS, ease: E.out, overwrite: true }); });
        a.addEventListener('mouseleave', function () { gsap.to(links, { opacity: 1, duration: DS, ease: E.out, overwrite: true }); });
      }
    });
  }

  // ——— In-page anchors ———
  function setupAnchors() {
    $$('a[href^="#"]').forEach(function (a) {
      if (a.hasAttribute('data-menu-link')) return;
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href');
        if (id === '#' || id === '#main') return;
        var t = $(id);
        if (!t) return;
        e.preventDefault();
        if (id === '#top' || a.closest('.ft')) ditherTo(t);
        else scrollToTarget(t);
      });
    });
  }

  // ——— Scroll choreography ———
  function setupScroll() {
    if (RM) return; // reduced motion: content stays put, no scroll-linked movement
    // generic reveals (hero ones are played by the intro)
    $$('[data-r]').forEach(function (el) {
      prepReveal(el);
      if (el.closest('.hero')) return;
      ST.create({ trigger: el, start: 'top 94%', once: true, onEnter: function () { playReveal(el); } });
    });

    // prologue: characters highlight as the statement is read
    var hl = $('[data-highlight]');
    if (hl) {
      var chars = splitChars(hl);
      gsap.fromTo(chars, { opacity: .12 }, { opacity: 1, ease: E.out, stagger: STAG, scrollTrigger: { trigger: hl, start: 'top 78%', end: 'bottom 45%', scrub: true } });
    }

    // giant headline lines drift against each other
    $$('[data-drift]').forEach(function (el) {
      var kids = Array.prototype.slice.call(el.children);
      gsap.fromTo(kids, { xPercent: gsap.utils.wrap([6, -6]) }, { xPercent: gsap.utils.wrap([-4, 4]), ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: 1 } });
    });

    // picture grows inside its frame
    $$('[data-scale]').forEach(function (el) {
      gsap.fromTo(el, { scale: 1, transformOrigin: '50% 100%' }, { scale: 1.22, ease: 'none', scrollTrigger: { trigger: el.closest('[data-scale-wrap]') || el, start: 'top bottom', end: 'bottom top', scrub: 1 } });
    });
    $$('[data-parallax]').forEach(function (el) {
      gsap.fromTo(el, { yPercent: -8 }, { yPercent: 8, ease: 'none', scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
    });

    // prologue scenes float
    $$('.prologue__scene').forEach(function (el, i) {
      gsap.fromTo(el, { yPercent: i ? 18 : -6 }, { yPercent: i ? -22 : -34, ease: 'none', scrollTrigger: { trigger: '.prologue', start: 'top bottom', end: 'bottom top', scrub: true } });
    });

    // woven photographs: weave in, then resolve into the photograph
    (looms.photo || []).forEach(function (l) {
      var host = l.host;
      ST.create({ trigger: host, start: 'top 88%', once: true, onEnter: function () {
        loomTween(l, { reveal: 1 }, { duration: 1.3, ease: E.out });
        loomTween(l, { mix: 1 }, { duration: 1.6, delay: .7, ease: E.inOut });
      } });
    });

    // disciplines: hovered row stays, others dim
    if (canHover) $$('[data-dim-group]').forEach(function (g) {
      var items = $$('[data-dim]', g);
      items.forEach(function (it) {
        it.addEventListener('mouseenter', function () { items.forEach(function (o) { gsap.to(o, { opacity: o === it ? 1 : .2, duration: o === it ? .1 : DM, ease: E.out, overwrite: true }); }); });
        it.addEventListener('mouseleave', function () { gsap.to(items, { opacity: 1, duration: DS, ease: E.out, overwrite: true }); });
      });
    });

    // marquee follows scroll velocity
    var mq = $('[data-marquee]');
    if (mq) {
      var lists = $$('[data-marquee-list]', mq);
      var tl = gsap.timeline({ repeat: -1, paused: true }).to(lists, { xPercent: -100, duration: 24, ease: 'none' });
      ST.create({ trigger: mq, start: 'top bottom', end: 'bottom top',
        onToggle: function (s) { if (s.isActive) tl.play(); else tl.pause(); },
        onUpdate: function (s) { var v = gsap.utils.clamp(-3, 5, 1 + s.getVelocity() * .004); gsap.to(tl, { timeScale: v, duration: .3, overwrite: true }); gsap.to(tl, { timeScale: 1, duration: 1.2, delay: .3 }); } });
    }

    var mm = gsap.matchMedia();
    mm.add({ desk: '(min-width: 992px)', mob: '(max-width: 991px)' }, function (ctx) {
      var desk = ctx.conditions.desk;
      var hero = $('.hero'), frame = $('[data-hero-frame]'), content = $('[data-hero-content]'), title = $('.hero__titlewrap'), over = $('[data-hero-over]');
      var vh = function () { return window.innerHeight; };
      // 1) the title rises, halves and fades
      gsap.timeline({ scrollTrigger: { trigger: hero, start: 'top top', end: function () { return '+=' + vh() * .55; }, scrub: .25 } })
        .to(title, { yPercent: -60, scale: .5, opacity: 0, transformOrigin: '0% 0%', ease: 'none' }, 0)
        .to($('.hero__stats'), { yPercent: -80, opacity: 0, ease: 'none' }, 0);
      gsap.timeline({ scrollTrigger: { trigger: hero, start: function () { return 'top+=' + vh() * .25 + ' top'; }, end: function () { return '+=' + vh() * .6; }, scrub: .25 } })
        .to([$('.hero__bottom'), $('.hero__cue')], { yPercent: -40, opacity: 0, ease: 'none' }, 0);
      // 2) the frame shrinks into the ground, 3) a woven landscape rises over it into the dark band
      gsap.timeline({ scrollTrigger: { trigger: hero, start: function () { return 'top+=' + vh() * (desk ? .8 : .6) + ' top'; }, end: function () { return 'top+=' + vh() * (desk ? 1.75 : 1.3) + ' top'; }, scrub: 1 } })
        .to(frame, { scale: desk ? .3 : .55, ease: E.out, duration: 1 }, 0);
      var landL = (looms.land || [])[0];
      var landTl = gsap.timeline({ scrollTrigger: { trigger: hero, start: function () { return 'top+=' + vh() * (desk ? .7 : .55) + ' top'; }, end: function () { return 'top+=' + vh() * (desk ? 1.95 : 1.4) + ' top'; }, scrub: true,
        onUpdate: function (s) { if (!menuOpen) setHeaderTheme(s.progress > .82); },
        onLeaveBack: function () { if (!menuOpen) setHeaderTheme(false); } } })
        .fromTo(over, { yPercent: 101 }, { yPercent: -100, ease: 'none' }, 0);
      if (landL) landTl.fromTo({ r: 0 }, { r: 0 }, { r: 1, ease: 'none', duration: .35, onUpdate: function () { landL.set({ reveal: this.targets()[0].r }); } }, 0);

      // brands: the title grows from nothing, then the rail travels with tilting cards
      var bt = $('[data-brands-title]');
      gsap.fromTo(bt, { scale: .15 }, { scale: 1, ease: E.inOut, scrollTrigger: { trigger: $('.brands__intro'), start: 'top bottom', end: 'bottom 60%', scrub: true } });
      var rail = $('[data-rail]'), track = $('[data-rail-track]'), cardsEls = $$('[data-card]');
      if (desk && rail && !RM) {
        $('.brands').classList.add('is-railed');
        var dist = function () { return track.scrollWidth - window.innerWidth + window.innerWidth * .12; };
        var railTween = gsap.to(track, { x: function () { return -dist(); }, ease: 'none', scrollTrigger: { trigger: rail, start: 'top top', end: function () { return '+=' + dist(); }, pin: true, scrub: true, invalidateOnRefresh: true } });
        cardsEls.forEach(function (c, i) {
          var sx = Math.random() < .5 ? 1 : -1, sy = Math.random() < .5 ? 1 : -1, sr = Math.random() < .5 ? 1 : -1;
          var o = { x: (Math.random() * 8 + 6) * sx, y: (Math.random() * 4 + 2) * sy, r: (Math.random() * 4 + 4) * sr };
          gsap.fromTo(c, { rotation: o.r, xPercent: o.x, yPercent: o.y + 38 + (i % 2 ? -12 : 12) }, { rotation: -o.r, xPercent: -o.x, yPercent: -o.y - 38 + (i % 2 ? 12 : -12), ease: 'none',
            scrollTrigger: { trigger: c, containerAnimation: railTween, start: 'left right', end: 'right left', scrub: true } });
        });
        return function () { $('.brands').classList.remove('is-railed'); };
      } else {
        cardsEls.forEach(function (c) { gsap.fromTo(c, { yPercent: 12, opacity: 0 }, { yPercent: 0, opacity: 1, duration: DL, ease: E.out, scrollTrigger: { trigger: c, start: 'top 92%', once: true } }); });
      }
    });

    // vision: pinned on desktop; the photograph is slowly re-woven while you read the statement
    var visPin = $('[data-vision]'), visL = (looms.vision || [])[0];
    mm.add('(min-width: 992px)', function () {
      var tl = gsap.timeline({ scrollTrigger: { trigger: visPin, start: 'top top', end: '+=110%', pin: true, scrub: true } });
      tl.fromTo($('.vision__media img'), { scale: 1.08 }, { scale: 1, ease: 'none' }, 0);
      if (visL) tl.fromTo({ m: 1 }, { m: 1 }, { m: .08, ease: 'none', onUpdate: function () { visL.set({ mix: this.targets()[0].m }); } }, .1);
    });
    mm.add('(max-width: 991px)', function () {
      if (visL) gsap.fromTo({ m: 1 }, { m: 1 }, { m: .1, ease: 'none', scrollTrigger: { trigger: visPin, start: 'top 60%', end: 'bottom 30%', scrub: true }, onUpdate: function () { visL.set({ mix: this.targets()[0].m }); } });
    });
  }

  // ——— Contact: copy + flip card ———
  function setupContact() {
    var copyBtn = $('[data-copy]'), status = $('[data-copy-status]');
    if (copyBtn) copyBtn.addEventListener('click', function () {
      var v = copyBtn.getAttribute('data-copy');
      var done = function () { status.textContent = 'Copied'; setTimeout(function () { status.textContent = ''; }, 2200); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(v).then(done, function () { status.textContent = v; });
      else { status.textContent = v; }
    });
    var flip = $('[data-flip]'), form = $('[data-form]'), doneCard = $('[data-done]'), err = $('[data-form-error]');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var bad = $$('input, textarea', form).filter(function (f) { return !f.checkValidity(); });
      if (bad.length) { err.textContent = bad[0].type === 'email' && bad[0].value ? 'Please check the email address.' : 'Please fill in every field.'; bad[0].focus(); return; }
      err.textContent = '';
      flip.classList.add('is-done');
      if (RM) { form.style.visibility = 'hidden'; gsap.set(doneCard, { rotateY: 0 }); doneCard.focus(); return; }
      gsap.timeline({ defaults: { duration: DL, ease: E.inOut } })
        .fromTo(form, { rotateY: 0 }, { rotateY: -180 }, 0)
        .fromTo(doneCard, { rotateY: 180 }, { rotateY: 0, onComplete: function () { doneCard.focus({ preventScroll: true }); } }, 0)
        .set(form, { visibility: 'hidden' });
    });
    $('[data-form-reset]').addEventListener('click', function () {
      form.reset();
      gsap.set(form, { visibility: 'visible' });
      gsap.timeline({ defaults: { duration: DL, ease: E.inOut }, onComplete: function () { flip.classList.remove('is-done'); $('input', form).focus({ preventScroll: true }); } })
        .to(doneCard, { rotateY: 180 }, 0)
        .to(form, { rotateY: 0 }, 0);
    });
  }

  // ——— Notice card ———
  var notice = $('[data-notice]');
  function showNotice(delay) {
    var seen = false;
    try { seen = sessionStorage.getItem('dorr8-notice'); } catch (e) {}
    if (seen || !notice) return;
    notice.hidden = false;
    if (!RM) gsap.fromTo(notice, { yPercent: 105 }, { yPercent: 0, duration: DL, delay: delay || 0, ease: E.out });
    $$('[data-notice-close]', notice).forEach(function (b) {
      b.addEventListener('click', function () {
        try { sessionStorage.setItem('dorr8-notice', '1'); } catch (e) {}
        gsap.to(notice, { yPercent: 105, duration: DM, ease: E.in, onComplete: function () { notice.hidden = true; } });
      });
    });
  }

  // ——— Loader → hero ———
  function intro() {
    var loader = $('[data-loader]');
    var heroMedia = $('[data-hero-media]');
    var heroReveals = $$('.hero [data-r]');
    var revisit = root.classList.contains('revisit');
    try { sessionStorage.setItem('dorr8-visited', '1'); } catch (e) {}
    function heroIn(d) {
      heroReveals.forEach(function (el, i) { playReveal(el, d + i * .12); });
      gsap.fromTo('.hero__stats > div', { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: DL, delay: d + .2, stagger: .5 * STAG, ease: E.out });
      gsap.fromTo(['.orb', '.hero__cue'], { opacity: 0, yPercent: 40 }, { opacity: 1, yPercent: 0, duration: DL, delay: d + .4, ease: E.out });
      gsap.fromTo(header, { yPercent: -100 }, { yPercent: 0, duration: DL, delay: d, ease: E.out });
      if (weaves.logo) weaveIn(weaves.logo, { delay: d + .2, duration: DM });
      showNotice(d + 1.2);
    }
    if (RM || !loader) { if (loader) loader.remove(); unlockScroll(); heroReveals.forEach(function (el) { el.style.visibility = 'visible'; }); showNotice(0); return; }
    lockScroll();
    gsap.set(['.hero__stats > div', '.orb', '.hero__cue'], { opacity: 0 });
    gsap.set(header, { yPercent: -100 });

    if (revisit) {
      gsap.set(heroMedia, { scale: 1.2 });
      gsap.timeline()
        .to(loader, { yPercent: -100, duration: DL, ease: E.inOut, delay: .15 })
        .to(heroMedia, { scale: 1, duration: 2 * DL, ease: E.out }, '<')
        .add(function () { loader.remove(); unlockScroll(); ST.refresh(); }, '>-1.2');
      if (weaves.hero) weaveIn(weaves.hero, { delay: .5 });
      heroIn(.6);
      return;
    }

    // first visit: woven object, woven name, percent
    var slot = $('[data-loader-slot]');
    var lw = document.createElement('div');
    lw.className = 'loader__word';
    var lsvg = weaves.hero ? weaves.hero.cloneNode(true) : Weave.build('DORR', 150, 7);
    lw.appendChild(lsvg);
    slot.appendChild(lw);
    var heroWeave = $('[data-weave="hero"]');
    gsap.set(heroWeave, { opacity: 0 });
    weaveIn(lsvg, { delay: .25, duration: 1.4, spread: 1.4 });

    var oy = (looms.oyster || [])[0];
    if (oy) { oy.init(); loomTween(oy, { reveal: 1 }, { duration: 2.2, delay: .3, ease: E.out }); }
    else loader.classList.add('no-gl');

    var pctEl = $('[data-percent]'), pct = { v: 0 };
    var heroImg = $('.hero__media img');
    var assets = [document.fonts ? document.fonts.ready : Promise.resolve(), new Promise(function (res) { if (heroImg.complete) res(); else { heroImg.addEventListener('load', res, { once: true }); heroImg.addEventListener('error', res, { once: true }); } })];
    var loaded = 0;
    assets.forEach(function (p) { p.then(function () { loaded++; }); });
    var minT = gsap.to(pct, { v: 100, duration: 2.6, ease: E.inOut, onUpdate: function () { var cap = loaded >= assets.length ? 100 : 86; pctEl.textContent = String(Math.min(cap, Math.round(pct.v))).padStart(3, '0'); } });
    Promise.all(assets).then(function () {
      var wait = Math.max(0, 2.75 - minT.time());
      gsap.delayedCall(wait, leave);
    });
    function leave() {
      pctEl.textContent = '100';
      var first = lw.getBoundingClientRect(), last = heroWeave.getBoundingClientRect();
      var s = last.width / first.width;
      gsap.set(heroMedia, { scale: 1.5 });
      var tl = gsap.timeline();
      tl.to($$('.loader__top, .loader__object, .loader__notes'), { opacity: 0, duration: DS, ease: E.in }, 0)
        .to(lw, { x: last.left - first.left, y: last.top - first.top, scale: s, transformOrigin: '0% 0%', color: '#141a1b', duration: 1.5 * DL, ease: E.inOut }, .1)
        .to(loader, { backgroundColor: 'rgba(20,26,27,0)', duration: DL, ease: E.inOut }, .25)
        .to(heroMedia, { scale: 1, duration: 2 * DL, ease: E.out }, .25)
        .add(function () {
          gsap.set(heroWeave, { opacity: 1 });
          loader.remove();
          if (oy) oy.destroy();
          unlockScroll();
          ST.refresh();
        }, .1 + 1.5 * DL);
      heroIn(.9);
    }
  }

  // ——— Boot ———
  function boot() {
    buildWeaves();
    setupLooms();
    setupHeader();
    setupSwaps();
    setupMagnetic();
    setupMenu();
    setupAnchors();
    setupScroll();
    setupContact();
    intro();
    var t;
    window.addEventListener('resize', function () {
      clearTimeout(t);
      t = setTimeout(function () { if (Loom) Loom.resizeAll(); }, 120);
    });
    window.addEventListener('load', function () { ST.refresh(); });
    $$('img').forEach(function (img) { if (!img.complete) img.addEventListener('load', function () { ST.refresh(); }, { once: true }); });
  }

  var fontsReady = document.fonts && document.fonts.load ? Promise.all([document.fonts.load('400 100px Michroma'), document.fonts.load('400 40px Marcellus')]) : Promise.resolve();
  var started = false;
  function go() { if (started) return; started = true; try { boot(); } catch (e) { root.classList.remove('js'); if (window.console) console.warn(e); } }
  fontsReady.then(go, go);
  setTimeout(go, 2500);

  // ——— PWA ———
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js', { scope: './' }).catch(function () {}); });
  }
})();
