/* DORR v6 — motion & interaction
   GSAP 3.12 + ScrollTrigger + Lenis 1.1. No pins: every long scene is a CSS
   sticky stage driven by a scrubbed ScrollTrigger, which stays steady on
   touch devices (native scrolling) and never needs pin-spacers. */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduced = root.classList.contains('reduced');
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var isSmall = function () { return window.innerWidth < 761; };
  var hasGsap = !!(window.gsap && window.ScrollTrigger);
  var lenis = null;

  /* ------------------------------------------------------------------ */
  /* utilities                                                           */
  /* ------------------------------------------------------------------ */
  // wrap every word in <span class="w"><span class="wi">…</span></span>, keeping <em> etc.
  function splitWords(el) {
    if (el.__split) return el.__split;
    var out = [];
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var parts = n.textContent.split(/(\s+)/);
          var frag = document.createDocumentFragment();
          parts.forEach(function (p) {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(p)); return; }
            var w = document.createElement('span'); w.className = 'w';
            var i = document.createElement('span'); i.className = 'wi'; i.textContent = p;
            w.appendChild(i); frag.appendChild(w); out.push(i);
          });
          n.parentNode.replaceChild(frag, n);
        } else if (n.nodeType === 1 && n.tagName !== 'BR') {
          walk(n);
        }
      });
    })(el);
    el.__split = out;
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* UI that works with or without GSAP                                  */
  /* ------------------------------------------------------------------ */
  var head = $('.head');
  var menu = $('#menu');
  var menuBtn = $('.head__menu');
  var menuOpen = false;

  function setMenu(open, focusBack) {
    if (open === menuOpen) return;
    menuOpen = open;
    menuBtn.setAttribute('aria-expanded', String(open));
    $('.head__menu-label').textContent = open ? 'Close' : 'Menu';
    if (open) {
      menu.hidden = false; menu.inert = false;
      menu.getBoundingClientRect();
      menu.classList.add('is-open');
      root.classList.add('menu-open');
      if (lenis) lenis.stop();
      setTimeout(function () { var a = $('.menu__nav a', menu); if (a) a.focus({ preventScroll: true }); }, 380);
    } else {
      menu.classList.remove('is-open');
      root.classList.remove('menu-open');
      menu.inert = true;
      if (lenis) lenis.start();
      if (focusBack) menuBtn.focus({ preventScroll: true });
    }
  }
  menu.inert = true;
  menuBtn.addEventListener('click', function () { setMenu(!menuOpen, true); });
  document.addEventListener('keydown', function (e) {
    if (!menuOpen) return;
    if (e.key === 'Escape') { setMenu(false, true); return; }
    if (e.key === 'Tab') {
      var f = [menuBtn].concat($$('a', menu));
      var i = f.indexOf(document.activeElement);
      if (e.shiftKey && (i <= 0)) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  });

  // in-page anchors (smooth with Lenis, focus moved for keyboard users)
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute('href');
    if (id.length < 2) return;
    var target = $(id);
    if (!target) return;
    e.preventDefault();
    var wasOpen = menuOpen;
    if (menuOpen) setMenu(false, false);
    var go = function () {
      if (lenis) lenis.scrollTo(id === '#top' ? 0 : target, { duration: 1.6, easing: function (t) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); } });
      else window.scrollTo({ top: id === '#top' ? 0 : target.getBoundingClientRect().top + window.pageYOffset, behavior: reduced ? 'auto' : 'smooth' });
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
      if (history.replaceState) history.replaceState(null, '', id);
    };
    if (wasOpen) setTimeout(go, 420); else go();
  });

  // copy e-mail
  $$('[data-copy]').forEach(function (b) {
    b.addEventListener('click', function () {
      var txt = b.getAttribute('data-copy');
      var done = function () { b.textContent = 'Copied'; setTimeout(function () { b.textContent = 'Copy'; }, 1800); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, done);
      else done();
    });
  });

  // contact form — client-side only
  var form = $('.form');
  if (form) {
    var note = $('.form__note', form);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = form.elements.name, email = form.elements.email;
      var bad = [];
      [name, email].forEach(function (el) { el.removeAttribute('aria-invalid'); el.parentNode.classList.remove('is-error'); });
      if (!name.value.trim()) bad.push(name);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) bad.push(email);
      if (bad.length) {
        bad.forEach(function (el) { el.setAttribute('aria-invalid', 'true'); el.parentNode.classList.add('is-error'); });
        note.textContent = bad[0] === name ? 'Please add your name.' : 'Please add a valid e-mail address.';
        bad[0].focus();
        return;
      }
      var first = name.value.trim().split(/\s+/)[0];
      note.textContent = 'Thank you, ' + first + '. This page is a preview, so for now please also write to hello@dorr.example.';
      form.reset();
    });
  }

  if (!hasGsap) { root.classList.remove('is-loading'); return; }

  /* ------------------------------------------------------------------ */
  /* GSAP + Lenis wiring                                                 */
  /* ------------------------------------------------------------------ */
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  if (!reduced && window.Lenis) {
    lenis = new Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 1, syncTouch: false });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  // header: hide on the way down, return on the way up; ink colour over sand
  var lastDir = 0;
  ScrollTrigger.create({
    start: 0, end: 'max',
    onUpdate: function (self) {
      var y = self.scroll();
      var dir = self.direction;
      if (menuOpen) return;
      if (y < 140) { head.classList.remove('is-hidden'); lastDir = 0; return; }
      if (dir !== lastDir) { head.classList.toggle('is-hidden', dir === 1); lastDir = dir; }
    }
  });
  $$('[data-theme="light"]').forEach(function (el) {
    ScrollTrigger.create({
      trigger: el, start: 'top 36px', end: 'bottom 36px',
      onToggle: function (self) {
        var applies = !el.classList.contains('contact__card') || isSmall();
        head.classList.toggle('is-light', self.isActive && applies);
      }
    });
  });

  /* ------------------------------------------------------------------ */
  /* hero — nacre shader                                                 */
  /* ------------------------------------------------------------------ */
  var heroImg = $('.hero__img');
  var nacre = null;
  if (window.Nacre) {
    nacre = new Nacre($('.hero__gl'), heroImg, {
      focal: { x: 0.655, y: 0.47 }, spacing: isSmall() ? 6 : 7.5,
      intro: reduced ? 1 : 0, reveal: reduced ? 0.07 : 0, still: reduced
    });
    if (!nacre.gl) nacre = null;
  }
  if (nacre && !reduced && window.matchMedia('(pointer: fine)').matches) {
    window.addEventListener('pointermove', function (e) { nacre.pointer(e.clientX / window.innerWidth, e.clientY / window.innerHeight); }, { passive: true });
  }

  var letters = $$('.hero__word > span');

  /* ------------------------------------------------------------------ */
  /* reduced motion: calm fades only                                     */
  /* ------------------------------------------------------------------ */
  if (reduced) {
    root.classList.remove('is-loading');
    var calm = $$('[data-fade], [data-reveal-img], [data-split], [data-words], .aims li, .brand, .vision__close');
    if ('IntersectionObserver' in window) {
      calm.forEach(function (el) { el.classList.add('is-pre'); });
      var io = new IntersectionObserver(function (en) {
        en.forEach(function (x) { if (x.isIntersecting) { x.target.classList.remove('is-pre'); io.unobserve(x.target); } });
      }, { rootMargin: '0px 0px -8% 0px' });
      calm.forEach(function (el) { io.observe(el); });
    }
    $$('.dep').forEach(function (d) { d.classList.add('is-on'); });
    $$('.step').forEach(function (s) { s.classList.add('is-active'); });
    var stepsList = $('.steps');
    if (stepsList) $$('.step', stepsList).forEach(function (s) { s.style.gridArea = 'auto'; });
    return;
  }

  /* ------------------------------------------------------------------ */
  /* loader → hero intro                                                 */
  /* ------------------------------------------------------------------ */
  var loader = $('.loader');
  var rings = $$('.loader__rings circle:not(.loader__pearl)');
  var pearl = $('.loader__pearl');
  var num = $('.loader__num');
  var heroBits = [$('.hero__top'), $('.hero__foot')];

  gsap.set(letters, { y: function () { return window.innerWidth * 0.14; }, opacity: 0 });
  gsap.set(heroBits, { opacity: 0, y: 18 });
  gsap.set(rings, { opacity: 0, scale: 0.86, svgOrigin: '100 100' });
  gsap.set(pearl, { scale: 0, svgOrigin: '100 100' });
  if (lenis) lenis.stop();
  window.scrollTo(0, 0);

  var counter = { v: 0 };
  var loadTl = gsap.timeline();
  loadTl
    .to(pearl, { scale: 1, duration: 1.1, ease: 'expo.out' }, 0.1)
    .to(rings, { opacity: 0.7, scale: 1, duration: 1.1, stagger: 0.09, ease: 'power3.out' }, 0.2)
    .to(counter, { v: 100, duration: 1.6, ease: 'power2.inOut', onUpdate: function () { num.textContent = String(Math.round(counter.v)).padStart(3, '0'); } }, 0);

  var timeout = new Promise(function (r) { setTimeout(r, 3800); });
  var assets = Promise.all([
    document.fonts ? document.fonts.ready : Promise.resolve(),
    heroImg.decode ? heroImg.decode().catch(function () {}) : Promise.resolve(),
    nacre && nacre.ready ? nacre.ready : Promise.resolve(),
    new Promise(function (r) { setTimeout(r, 1750); })
  ]);
  Promise.race([assets, timeout]).then(function () {
    loader.classList.add('is-leaving');
    var out = gsap.timeline({
      onComplete: function () {
        root.classList.remove('is-loading');
        loader.classList.remove('is-leaving');
        loader.style.display = 'none';
        if (lenis) lenis.start();
        ScrollTrigger.refresh();
        if (location.hash && $(location.hash)) {
          var t = $(location.hash);
          if (lenis) lenis.scrollTo(t, { immediate: true }); else t.scrollIntoView();
        }
      }
    });
    out
      .to(rings, { scale: 2.6, opacity: 0, duration: 1.3, stagger: { each: 0.035, from: 'end' }, ease: 'power2.in' }, 0)
      .to(pearl, { scale: 0, duration: 0.7, ease: 'power3.in' }, 0.25)
      .to('.loader .label', { opacity: 0, duration: 0.5 }, 0)
      .to(loader, { opacity: 0, duration: 0.7, ease: 'power1.inOut' }, 0.75);
    heroIntro(0.85);
  });

  function heroIntro(at) {
    var tl = gsap.timeline({ delay: at });
    if (nacre) {
      tl.to(nacre.state, { intro: 1, duration: 2.6, ease: 'power2.inOut' }, 0)
        .to(nacre.state, { reveal: isSmall() ? 0.085 : 0.07, duration: 1.8, ease: 'expo.out' }, 1.3);
    } else {
      tl.fromTo(heroImg, { scale: 1.12 }, { scale: 1, duration: 2.4, ease: 'power3.out' }, 0);
    }
    tl.to(letters, { y: 0, opacity: 1, duration: 1.6, stagger: 0.09, ease: 'expo.out' }, 0.35)
      .to(heroBits, { opacity: 1, y: 0, duration: 1.2, stagger: 0.12, ease: 'power3.out' }, 0.9);
  }

  /* ------------------------------------------------------------------ */
  /* scroll scenes — created in document order                            */
  /* ------------------------------------------------------------------ */
  var mm = gsap.matchMedia();

  // HERO: the photograph surfaces from the pearl while the wordmark lifts away
  (function () {
    var hero = $('.hero');
    var tl = gsap.timeline({ scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
    if (nacre) tl.fromTo(nacre.state, { scroll: 0 }, { scroll: 1.05, ease: 'power1.in', immediateRender: false }, 0);
    else tl.fromTo(heroImg, { yPercent: 0 }, { yPercent: 8, ease: 'none', immediateRender: false }, 0);
    tl.fromTo(letters, { yPercent: 0 }, { yPercent: function (i) { return -14 - i * 11; }, ease: 'none', immediateRender: false }, 0)
      .fromTo('.hero__top > *, .hero__foot > *', { opacity: 1, yPercent: 0 }, { opacity: 0, yPercent: -60, ease: 'none', immediateRender: false }, 0)

  })();

  // generic reveals
  $$('[data-split]').forEach(function (el) {
    var w = splitWords(el);
    gsap.fromTo(w, { yPercent: 108 }, {
      yPercent: 0, duration: 1.35, ease: 'expo.out', stagger: 0.055,
      scrollTrigger: { trigger: el, start: 'top 86%', toggleActions: 'play none none none' }
    });
  });
  $$('[data-words]').forEach(function (el) {
    var w = splitWords(el);
    el.classList.add('is-words');
    gsap.fromTo(w, { opacity: 0.13 }, {
      opacity: 1, ease: 'none', stagger: 0.12,
      scrollTrigger: { trigger: el, start: 'top 82%', end: 'bottom 48%', scrub: true }
    });
  });
  $$('[data-fade]').forEach(function (el) {
    gsap.fromTo(el, { opacity: 0, y: 34 }, {
      opacity: 1, y: 0, duration: 1.3, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none none' }
    });
  });
  $$('[data-reveal-img]').forEach(function (fig) {
    var arch = $('.arch', fig), img = $('img', fig);
    gsap.fromTo(arch, { clipPath: 'inset(100% 0% 0% 0%)' }, {
      clipPath: 'inset(0% 0% 0% 0%)', duration: 1.6, ease: 'expo.inOut',
      scrollTrigger: { trigger: fig, start: 'top 90%', toggleActions: 'play none none none' }
    });
    gsap.fromTo(img, { scale: 1.32 }, {
      scale: 1.08, duration: 2.2, ease: 'expo.out',
      scrollTrigger: { trigger: fig, start: 'top 90%', toggleActions: 'play none none none' }
    });
    gsap.fromTo(img, { yPercent: -5 }, {
      yPercent: 5, ease: 'none',
      scrollTrigger: { trigger: fig, start: 'top bottom', end: 'bottom top', scrub: true }
    });
  });
  $$('.group__aims').forEach(function (box) {
    gsap.fromTo($$('li', box), { opacity: 0, y: 26 }, {
      opacity: 1, y: 0, duration: 1.1, stagger: 0.1, ease: 'power3.out',
      scrollTrigger: { trigger: box, start: 'top 85%', toggleActions: 'play none none none' }
    });
  });

  // STRUCTURE: layer upon layer (sticky stage, one scrubbed timeline)
  (function () {
    var sec = $('.structure');
    var steps = $$('.step');
    var C1 = 2 * Math.PI * 150, C2 = 2 * Math.PI * 250;
    var r1 = $('.nacre__ring--1 circle'), r2 = $('.nacre__ring--2 circle');
    gsap.set('.nacre__ring', { rotation: -90, svgOrigin: '0 0' });
    gsap.set(r1, { attr: { 'stroke-dasharray': C1, 'stroke-dashoffset': C1 } });
    gsap.set(r2, { attr: { 'stroke-dasharray': C2, 'stroke-dashoffset': C2 } });
    var deps = $$('.nacre__deps circle'), pearls = $$('.nacre__brands circle');
    var tagsB = $$('.nacre__tag--b'), tagCore = $('.nacre__tag--core');
    gsap.set(deps.concat(pearls), { scale: 0, transformOrigin: '50% 50%' });
    gsap.set('.nacre__core', { scale: 0.2, transformOrigin: '50% 50%' });
    gsap.set(tagsB.concat(tagCore), { opacity: 0 });
    gsap.set('.structure__title .sl', { yPercent: 40, opacity: 0 });

    var current = -1;
    function setStep(i) {
      if (i === current) return;
      current = i;
      steps.forEach(function (s, k) { s.classList.toggle('is-active', k === i); });
    }
    setStep(0);

    var tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: sec, start: 'top top', end: 'bottom bottom', scrub: true,
        onUpdate: function (self) { var p = self.progress; setStep(p < 0.36 ? 0 : p < 0.68 ? 1 : 2); }
      }
    });
    tl.to('.structure__title .sl', { yPercent: 0, opacity: 1, stagger: 0.25, duration: 0.9, ease: 'power2.out' }, 0)
      .to('.nacre__core', { scale: 1, duration: 1.4, ease: 'power2.out' }, 0)
      .to(tagCore, { opacity: 1, duration: 0.6 }, 0.9)
      .to(r1, { attr: { 'stroke-dashoffset': 0 }, duration: 2.4 }, 2.2)
      .to(deps, { scale: 1, duration: 0.5, stagger: 0.22, ease: 'back.out(2)' }, 2.6)
      .to(r2, { attr: { 'stroke-dashoffset': 0 }, duration: 2.6 }, 5.4)
      .to(pearls, { scale: 1, duration: 0.6, stagger: 0.38, ease: 'back.out(1.8)' }, 5.9)
      .to(tagsB, { opacity: 1, duration: 0.5, stagger: 0.38 }, 6.2)
      .fromTo('.nacre', { scale: 0.9 }, { scale: 1, duration: 9.5 }, 0)
      .to('.structure__bar i', { scaleX: 1, duration: 9.5 }, 0)
      .to({}, { duration: 0.5 }, 9.5);
  })();

  // SERVICES: rows light up as they cross the middle; the dial follows
  (function () {
    var rows = $$('.dep');
    var cur = $('.dial__cur');
    var arc = $('.dial__arc');
    var C = 2 * Math.PI * 96;
    gsap.set(arc, { attr: { 'stroke-dasharray': C, 'stroke-dashoffset': C * (1 - 1 / 8) } });
    var active = 0;
    rows.forEach(function (row, i) {
      ScrollTrigger.create({
        trigger: row, start: 'top 58%', end: 'bottom 58%',
        onToggle: function (self) {
          row.classList.toggle('is-on', self.isActive);
          if (self.isActive && active !== i) {
            active = i;
            gsap.to(cur, { yPercent: -30, opacity: 0, duration: 0.18, ease: 'power2.in', onComplete: function () {
              cur.textContent = String(i + 1).padStart(2, '0');
              gsap.fromTo(cur, { yPercent: 30, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.45, ease: 'power3.out' });
            } });
          }
        }
      });
    });
    gsap.to(arc, {
      attr: { 'stroke-dashoffset': 0 }, ease: 'none',
      scrollTrigger: { trigger: '.deps', start: 'top 58%', end: 'bottom 58%', scrub: true }
    });
    gsap.fromTo('.dial__img img', { scale: 1.3 }, {
      scale: 1.05, ease: 'none',
      scrollTrigger: { trigger: '.services', start: 'top bottom', end: 'bottom top', scrub: true }
    });
  })();

  // BRANDS: five pearls on one strand (sticky stage, horizontal scrub)
  (function () {
    var sec = $('.brands'), stage = $('.brands__stage'), track = $('.brands__track');
    var strand = $('.strand'), pearlEl = $('.strand__pearl');
    function dist() { return Math.max(0, track.scrollWidth - stage.clientWidth); }
    function size() { sec.style.setProperty('--brands-h', (dist() + stage.offsetHeight) + 'px'); }
    size();
    ScrollTrigger.addEventListener('refreshInit', size);

    var move = gsap.to(track, {
      x: function () { return -dist(); }, ease: 'none',
      scrollTrigger: { trigger: sec, start: 'top top', end: function () { return '+=' + dist(); }, scrub: true, invalidateOnRefresh: true }
    });
    gsap.to(pearlEl, {
      x: function () { return strand.clientWidth - pearlEl.offsetWidth; }, ease: 'none',
      scrollTrigger: { trigger: sec, start: 'top top', end: function () { return '+=' + dist(); }, scrub: true, invalidateOnRefresh: true }
    });

    var vw = stage.clientWidth;
    $$('.brand').forEach(function (card, i) {
      var fig = $('.brand__fig', card), img = $('img', fig), name = $('.brand__name', card), meta = $('.brand__meta', card);
      gsap.set(img, { scale: 1.14 });
      var reveal = gsap.timeline({ paused: true })
        .fromTo(fig, { clipPath: 'circle(0% at 50% 55%)' }, { clipPath: 'circle(75% at 50% 55%)', duration: 1.7, ease: 'expo.inOut' }, 0)
        .fromTo(name, { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1.2, ease: 'expo.out' }, 0.5)
        .fromTo(meta, { opacity: 0 }, { opacity: 1, duration: 1, ease: 'power2.out' }, 0.6);
      var inView = card.offsetLeft < vw * 0.92;
      if (inView) {
        ScrollTrigger.create({ trigger: sec, start: 'top 62%', once: true, onEnter: function () { gsap.delayedCall(i * 0.16, function () { reveal.play(); }); } });
      } else {
        ScrollTrigger.create({ trigger: card, containerAnimation: move, start: 'left 94%', once: true, onEnter: function () { reveal.play(); } });
      }
      gsap.fromTo(img, { xPercent: -6 }, {
        xPercent: 6, ease: 'none',
        scrollTrigger: { trigger: card, containerAnimation: move, start: 'left right', end: 'right left', scrub: true }
      });
    });
  })();

  // VISION: the window opens onto the ridges, then the text panel rises over it
  (function () {
    var sec = $('.vision'), win = $('.vision__window'), img = $('img', win), body = $('.vision__body');
    mm.add({ small: '(max-width: 760px)', large: '(min-width: 761px)' }, function (ctx) {
      var from = ctx.conditions.small ? 'inset(22% 9% 22% 9% round 999px)' : 'inset(17% 26% 17% 26% round 999px)';
      var tl = gsap.timeline({
        scrollTrigger: { trigger: sec, start: 'top 80%', end: function () { return 'top+=' + Math.round((body.offsetTop - $('.vision__stage').offsetHeight) * 0.92) + ' top'; }, scrub: true, invalidateOnRefresh: true }
      });
      tl.fromTo(win, { clipPath: from }, { clipPath: 'inset(0% 0% 0% 0% round 0px)', ease: 'power1.inOut' }, 0)
        .fromTo(img, { scale: 1.32 }, { scale: 1, ease: 'power1.out' }, 0)
        .fromTo('.vision__title .vl', { yPercent: 30, opacity: 0.0 }, { yPercent: 0, opacity: 1, stagger: 0.15, ease: 'power2.out', duration: 0.55 }, 0.12)
        .fromTo('.vision__head .label', { opacity: 0 }, { opacity: 1, duration: 0.3 }, 0.3);
    });
    gsap.to('.vision__head', {
      yPercent: -18, opacity: 0.0, ease: 'none',
      scrollTrigger: { trigger: body, start: 'top 70%', end: 'top 15%', scrub: true }
    });
  })();

  // MARQUEE: only runs while on screen
  (function () {
    var m = $('.marquee');
    ScrollTrigger.create({ trigger: m, start: 'top bottom', end: 'bottom top', onToggle: function (self) { m.classList.toggle('is-paused', !self.isActive); } });
    m.classList.add('is-paused');
  })();

  // CONTACT
  gsap.fromTo('.contact__bg img', { yPercent: -7 }, {
    yPercent: 7, ease: 'none', scrollTrigger: { trigger: '.contact', start: 'top bottom', end: 'bottom top', scrub: true }
  });
  gsap.fromTo('.contact__card', { y: 90, opacity: 0 }, {
    y: 0, opacity: 1, duration: 1.5, ease: 'expo.out',
    scrollTrigger: { trigger: '.contact__card', start: 'top 92%', toggleActions: 'play none none none' }
  });

  // FOOTER wordmark
  gsap.fromTo('.foot__word span', { yPercent: 102 }, {
    yPercent: 0, duration: 1.5, stagger: 0.08, ease: 'expo.out',
    scrollTrigger: { trigger: '.foot__word', start: 'top 95%', toggleActions: 'play none none none' }
  });

  // keep measurements honest once fonts and late images settle
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
  window.addEventListener('load', function () { ScrollTrigger.refresh(); });
})();
