/* DORR — Version 5 · "The Dive"
   GSAP 3.12 + ScrollTrigger + Lenis 1.1. Written from scratch for this version. */
(function () {
  'use strict';

  var html = document.documentElement;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var hasLibs = !!(window.gsap && window.ScrollTrigger);
  var calm = html.classList.contains('calm') || !hasLibs;
  if (calm) { html.classList.remove('motion'); html.classList.add('calm'); }
  var motion = !calm;
  var coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;
  var isNarrow = function () { return window.innerWidth <= 860; };

  /* ------------------------------------------------------------------
     Helpers
     ------------------------------------------------------------------ */
  function splitWords(el) {
    var out = [];
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (ch) {
        if (ch.nodeType === 3) {
          var parts = ch.textContent.split(/(\s+)/), frag = document.createDocumentFragment();
          parts.forEach(function (p) {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(p)); return; }
            var w = document.createElement('span'); w.className = 'w';
            var i = document.createElement('span'); i.textContent = p;
            w.appendChild(i); frag.appendChild(w); out.push(i);
          });
          node.replaceChild(frag, ch);
        } else if (ch.nodeType === 1 && !ch.classList.contains('layer__oval') && ch.tagName !== 'IMG') {
          walk(ch);
        }
      });
    })(el);
    return out;
  }

  function splitChars(el) {
    var txt = el.textContent.trim(); el.textContent = '';
    var wrap = document.createElement('span'); wrap.setAttribute('aria-hidden', 'true');
    var arr = [];
    Array.from(txt).forEach(function (ch) {
      var s = document.createElement('span'); s.className = 'c';
      s.textContent = ch === ' ' ? ' ' : ch;
      wrap.appendChild(s); arr.push(s);
    });
    el.appendChild(wrap);
    return arr;
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /* ------------------------------------------------------------------
     Pearls (WebGL with CSS fallback)
     ------------------------------------------------------------------ */
  var heroPearl = null, deepPearl = null;
  (function initPearls() {
    if (!window.DorrPearl) return;
    var hc = $('canvas[data-pearl="hero"]'), dc = $('canvas[data-pearl="deep"]');
    try {
      if (hc) { heroPearl = new window.DorrPearl(hc, { still: calm }); if (!heroPearl.ok) heroPearl = null; }
      if (dc) { deepPearl = new window.DorrPearl(dc, { still: calm, deep: 1 }); if (!deepPearl.ok) deepPearl = null; }
    } catch (e) { heroPearl = deepPearl = null; }

    if (!coarse && (heroPearl || deepPearl)) {
      window.addEventListener('pointermove', function (e) {
        var x = (e.clientX / window.innerWidth) * 2 - 1, y = -((e.clientY / window.innerHeight) * 2 - 1);
        if (heroPearl) heroPearl.light(x * 0.9, y * 0.9 + 0.2);
        if (deepPearl) deepPearl.light(x * 0.9, y * 0.9 + 0.2);
      }, { passive: true });
    }
  })();

  /* ------------------------------------------------------------------
     Daylight / Moonlight — follows the visitor's local time
     ------------------------------------------------------------------ */
  (function initTide() {
    var tide = $('.tide'), night = $('.hero__img--night'), hero = $('.hero');
    if (!tide || !night) return;
    var note = $('.tide__note', tide), btns = $$('.tide__opt', tide);
    var chosen = false, mode = 'day', nightObj = { v: 0 };

    function clock() {
      var d = new Date();
      return pad(d.getHours()) + ':' + pad(d.getMinutes());
    }
    function writeNote() {
      note.textContent = (chosen ? 'Your local time, ' : 'Following your local time, ') + clock();
    }
    function origin() {
      var b = $('.tide__knob', tide).getBoundingClientRect(), h = hero.getBoundingClientRect();
      return ((b.left + b.width / 2 - h.left) / h.width * 100).toFixed(2) + '% ' + ((b.top + b.height / 2 - h.top) / h.height * 100).toFixed(2) + '%';
    }
    function setMode(m, instant) {
      mode = m;
      tide.setAttribute('data-mode', m);
      btns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-mode') === m)); });
      var at = origin();
      var to = m === 'night' ? 'circle(150% at ' + at + ')' : 'circle(0% at ' + at + ')';
      var day = $('.hero__img--day');
      if (window.gsap && !instant && !calm) {
        gsap.set([night, day], { visibility: 'visible' });
        gsap.to(night, { clipPath: to, duration: 1.7, ease: 'expo.inOut', overwrite: true, onComplete: function () {
          // keep only the visible layer alive: cheaper compositing on low-end devices
          if (m === 'night') day.style.visibility = 'hidden'; else night.style.visibility = 'hidden';
        } });
        gsap.to(nightObj, { v: m === 'night' ? 1 : 0, duration: 1.4, ease: 'power2.inOut', overwrite: true, onUpdate: function () { if (heroPearl) heroPearl.setNight(nightObj.v); } });
      } else {
        night.style.clipPath = to;
        night.style.visibility = m === 'night' ? 'visible' : 'hidden';
        day.style.visibility = m === 'night' ? 'hidden' : 'visible';
        nightObj.v = m === 'night' ? 1 : 0;
        if (heroPearl) heroPearl.setNight(nightObj.v);
      }
      writeNote();
    }
    btns.forEach(function (b) {
      b.addEventListener('click', function () { chosen = true; setMode(b.getAttribute('data-mode')); });
    });
    $('.tide__track', tide).addEventListener('click', function () { chosen = true; setMode(mode === 'day' ? 'night' : 'day'); });

    var hr = new Date().getHours();
    setMode(hr >= 19 || hr < 6 ? 'night' : 'day', true);
    setInterval(writeNote, 30000);
  })();

  /* ------------------------------------------------------------------
     Copy + form
     ------------------------------------------------------------------ */
  (function initContact() {
    var copy = $('.contact__copy');
    if (copy) copy.addEventListener('click', function () {
      var val = copy.getAttribute('data-copy');
      var done = function () { copy.textContent = 'Copied'; setTimeout(function () { copy.textContent = 'Copy'; }, 2000); };
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(val).then(done, function () { fallback(); });
      } else { fallback(); }
      function fallback() {
        var t = document.createElement('textarea'); t.value = val; t.setAttribute('readonly', '');
        t.style.position = 'fixed'; t.style.opacity = '0'; document.body.appendChild(t); t.select();
        try { document.execCommand('copy'); done(); } catch (e) { copy.textContent = val; }
        document.body.removeChild(t);
      }
    });

    var form = $('.form');
    if (!form) return;
    var status = $('.form__status', form);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var ok = true;
      $$('input, textarea', form).forEach(function (f) {
        var bad = !f.value.trim() || (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.value.trim()));
        f.closest('.field').classList.toggle('is-invalid', bad);
        f.setAttribute('aria-invalid', String(bad));
        if (bad && ok) { ok = false; f.focus(); }
      });
      if (!ok) { status.textContent = 'Please complete each field with a valid email address.'; return; }
      var name = form.elements.name.value.trim().split(' ')[0];
      form.classList.add('is-sent');
      status.textContent = 'Thank you, ' + name + '. This page is a preview and the form does not send yet. To reach DORR, please write to hello@dorr.example.';
      $('.form__send span', form).textContent = 'Noted';
    });
  })();

  /* ------------------------------------------------------------------
     Strand map (built for both modes)
     ------------------------------------------------------------------ */
  var strand = (function buildStrand() {
    var map = $('.strand__map');
    if (!map) return null;
    var svg = $('.strand__svg', map), lab = $('.strand__labels', map);
    var NS = 'http://www.w3.org/2000/svg';
    var services = $$('.read__list li').map(function (li) { return li.textContent; });
    var brands = ['DADA', 'SAYAH', 'DÉJÀ VU', 'M04', 'RANDEZVOU'];
    var nodes = [{ kind: 'hold', text: 'Holding Company', sub: 'Clasp' }];
    services.forEach(function (s, i) { nodes.push({ kind: 'svc', text: s, sub: pad(i + 1) }); });
    brands.forEach(function (b, i) { nodes.push({ kind: 'brand', text: b, sub: 'Pearl ' + pad(i + 1) }); });

    function el(tag, cls) { var e = document.createElementNS(NS, tag); if (cls) e.setAttribute('class', cls); return e; }
    svg.innerHTML = '<defs><radialGradient id="stPearl" cx="36%" cy="30%" r="78%"><stop offset="0" stop-color="#ffffff"/><stop offset=".3" stop-color="#f3ede8"/><stop offset=".7" stop-color="#c3bfcb"/><stop offset="1" stop-color="#7c8197"/></radialGradient></defs>';
    var glow = el('path', 'st-thread-glow'), thread = el('path', 'st-thread');
    svg.appendChild(glow); svg.appendChild(thread);
    nodes.forEach(function (n) {
      n.lead = el('line', 'st-lead'); svg.appendChild(n.lead);
      if (n.kind === 'hold') {
        n.g = el('g'); n.ring = el('circle', 'st-clasp'); n.core = el('circle', 'st-clasp-core');
        n.g.appendChild(n.ring); n.g.appendChild(n.core); svg.appendChild(n.g); n.shape = n.g;
      } else {
        n.shape = el('circle', 'st-bead');
        if (n.kind === 'brand') n.shape.setAttribute('fill', 'url(#stPearl)');
        svg.appendChild(n.shape);
      }
      n.label = document.createElement('span');
      n.label.className = 'sl sl--' + n.kind;
      n.label.innerHTML = '<i>' + n.sub + '</i>' + n.text.replace(/&/g, '&amp;');
      lab.appendChild(n.label);
    });

    // positions along the thread (fractions of its length)
    nodes.forEach(function (n, i) {
      if (n.kind === 'hold') n.f = 0.035;
      else if (n.kind === 'svc') n.f = 0.13 + (i - 1) * (0.40 / 7);
      else n.f = 0.62 + (i - 9) * (0.335 / 4);
    });

    var state = { len: 1 };
    function layout() {
      var w = map.clientWidth, h = map.clientHeight;
      if (!w || !h) return;
      var mobile = w < 700;
      svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
      var d = '', N = 160;
      for (var i = 0; i <= N; i++) {
        var t = i / N, x, y;
        if (!mobile) {
          x = w * (0.015 + 0.955 * t);
          y = h * (0.16 + 0.62 * Math.pow(Math.sin(Math.PI * t), 1.15) + 0.05 * Math.sin(Math.PI * 3 * t));
        } else {
          y = h * (0.015 + 0.97 * t);
          x = w * (0.16 + 0.15 * Math.sin(Math.PI * t) + 0.025 * Math.sin(Math.PI * 4 * t)) + 4;
        }
        d += (i ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1);
      }
      thread.setAttribute('d', d); glow.setAttribute('d', d);
      var L = thread.getTotalLength();
      state.len = L;
      var svcSide = 1;
      nodes.forEach(function (n, idx) {
        var p = thread.getPointAtLength(n.f * L);
        var p2 = thread.getPointAtLength(Math.min(L, n.f * L + 1));
        var tx = p2.x - p.x, ty = p2.y - p.y, tl = Math.hypot(tx, ty) || 1;
        var nx = -ty / tl, ny = tx / tl; // normal
        if (ny < 0) { nx = -nx; ny = -ny; } // point downwards / outwards
        var r = n.kind === 'brand' ? (mobile ? 8.5 : 13) : n.kind === 'svc' ? (mobile ? 3.4 : 4.4) : (mobile ? 9 : 12);
        if (n.kind === 'hold') {
          n.ring.setAttribute('cx', p.x); n.ring.setAttribute('cy', p.y); n.ring.setAttribute('r', r);
          n.core.setAttribute('cx', p.x); n.core.setAttribute('cy', p.y); n.core.setAttribute('r', r * 0.38);
        } else {
          n.shape.setAttribute('cx', p.x); n.shape.setAttribute('cy', p.y); n.shape.setAttribute('r', r);
        }
        n.x = p.x; n.y = p.y;
        var lw = n.label.offsetWidth, lh = n.label.offsetHeight, lx, ly, ex, ey;
        if (mobile) {
          var len = n.kind === 'svc' ? 18 : 22;
          ex = p.x + r + len; ey = p.y;
          lx = ex + 6; ly = ey - lh / 2;
          n.lead.setAttribute('x1', p.x + r + 3); n.lead.setAttribute('y1', p.y);
        } else {
          var dir = 1, ll;
          if (n.kind === 'svc') { dir = svcSide; svcSide = -svcSide; ll = dir > 0 ? (idx % 4 === 1 ? 30 : 64) : (idx % 4 === 2 ? 34 : 70); }
          else if (n.kind === 'brand') { dir = 1; ll = 34; }
          else { dir = -1; ll = 30; }
          ex = p.x + nx * (r + ll) * dir; ey = p.y + ny * (r + ll) * dir;
          lx = ex - lw / 2;
          ly = dir > 0 ? ey + 6 : ey - lh - 6;
          if (n.kind === 'hold') { lx = ex - 10; }
          n.lead.setAttribute('x1', p.x + nx * (r + 3) * dir); n.lead.setAttribute('y1', p.y + ny * (r + 3) * dir);
        }
        lx = Math.max(0, Math.min(w - lw, lx));
        n.lead.setAttribute('x2', ex); n.lead.setAttribute('y2', ey);
        n.leadLen = Math.hypot(ex - parseFloat(n.lead.getAttribute('x1')), ey - parseFloat(n.lead.getAttribute('y1')));
        n.label.style.left = lx.toFixed(1) + 'px';
        n.label.style.top = ly.toFixed(1) + 'px';
      });
      if (!motion) {
        thread.style.strokeDasharray = ''; glow.style.strokeDasharray = '';
      }
    }
    layout();
    return { nodes: nodes, layout: layout, state: state, thread: thread, glow: glow, map: map };
  })();

  /* ==================================================================
     CALM MODE — reduced motion or missing libraries
     ================================================================== */
  if (calm) {
    var lastW = window.innerWidth;
    window.addEventListener('resize', function () { if (window.innerWidth !== lastW) { lastW = window.innerWidth; if (strand) strand.layout(); } });
    if ('IntersectionObserver' in window) {
      var fades = $$('.intro__head, .intro__fig, .intro__text, .layers__head, .layer, .strand__head, .strand__map, .read, .pearls__top, .brand, .horizon__copy, .vision__p, .contact__title, .contact__lead, .contact__mail, .form');
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
      }, { rootMargin: '0px 0px -8% 0px' });
      fades.forEach(function (f) { f.classList.add('fade'); io.observe(f); });
    }
    var menuBtnC = $('.bar__menu'), menuC = $('#menu');
    if (menuBtnC && menuC) {
      var toggleC = function (open) {
        menuC.hidden = !open; menuBtnC.setAttribute('aria-expanded', String(open));
        $('.bar').setAttribute('data-tone', open ? 'light' : 'dark');
        if (open) $('a', menuC).focus();
      };
      menuBtnC.addEventListener('click', function () { toggleC(menuC.hidden); });
      $$('a', menuC).forEach(function (a) { a.addEventListener('click', function () { toggleC(false); }); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !menuC.hidden) { toggleC(false); menuBtnC.focus(); } });
    }
    // header tone in calm mode
    var barC = $('.bar');
    var tonesC = $$('main > section, .hero, .aperture, .foot');
    var onScrollC = function () {
      var y = 32, tone = 'dark';
      for (var i = 0; i < tonesC.length; i++) {
        var r = tonesC[i].getBoundingClientRect();
        if (r.top <= y && r.bottom > y) tone = tonesC[i].getAttribute('data-tone') || tone;
      }
      if (menuC && !menuC.hidden) return;
      barC.setAttribute('data-tone', tone);
    };
    window.addEventListener('scroll', onScrollC, { passive: true }); onScrollC();
    return;
  }

  /* ==================================================================
     MOTION MODE
     ================================================================== */
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  var lenis = null;
  try {
    lenis = new Lenis({ lerp: 0.095, smoothWheel: true, wheelMultiplier: 1 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  } catch (e) { lenis = null; }

  var bar = $('.bar'), gauge = $('.gauge');
  var menu = $('#menu'), menuBtn = $('.bar__menu');
  var menuOpen = false, currentTone = 'dark';
  function setTone(t) {
    currentTone = t;
    if (!menuOpen) bar.setAttribute('data-tone', t);
    if (gauge) gauge.setAttribute('data-tone', t);
  }
  var gaugeItems = gauge ? $$('.gauge__list li', gauge) : [];
  var gaugeIdx = -1;
  function setGauge(i) {
    if (i === gaugeIdx || !gauge) return; gaugeIdx = i;
    gaugeItems.forEach(function (li, k) { li.classList.toggle('is-active', k === i); });
  }

  /* ---------- 1 · hero + aperture (pinned dive) ---------- */
  var hero = $('.hero'), ap = $('.aperture'), slot = $('.hero__pearl');
  var letters = $$('.hero__l'), letterInner = $$('.hero__l > span');
  var foot = $('.hero__foot'), media = $('.hero__media');
  var apTitleWords = splitWords($('.aperture__title'));
  var ring = $('.aperture__ring'), lustre = $('.aperture__lustre'), apLabel = $('.aperture__copy .t-label');

  function geo() {
    var d = hero.getBoundingClientRect(), r = slot.getBoundingClientRect();
    var cx = r.left + r.width / 2 - d.left, cy = r.top + r.height / 2 - d.top;
    ap.style.setProperty('--cx', cx.toFixed(1) + 'px'); ap.style.setProperty('--cy', cy.toFixed(1) + 'px');
    return { cx: cx, cy: cy, R: Math.hypot(Math.max(cx, d.width - cx), Math.max(cy, d.height - cy)) + 6 };
  }

  var diveTl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: '.dive', start: 'top top', end: function () { return '+=' + Math.round(window.innerHeight * 1.5); },
      pin: true, scrub: 0.6, invalidateOnRefresh: true, anticipatePin: 1,
      onUpdate: function (self) {
        var p = self.progress;
        setTone(p > 0.42 ? 'light' : 'dark');
        setGauge(p > 0.5 ? 1 : 0);
        if (heroPearl) { if (p > 0.34) heroPearl.stop(); else if (heroPearl.visible) heroPearl.start(); }
        if (gauge) gauge.classList.toggle('is-on', p > 0.6);
      }
    }
  });
  diveTl
    .fromTo(ap, { clipPath: function () { var g = geo(); return 'circle(0px at ' + g.cx + 'px ' + g.cy + 'px)'; } },
                { clipPath: function () { var g = geo(); return 'circle(' + g.R + 'px at ' + g.cx + 'px ' + g.cy + 'px)'; }, duration: 1, ease: 'power2.in' }, 0)
    .fromTo(slot, { scale: 1, autoAlpha: 1 }, { scale: 1.5, autoAlpha: 0, duration: 0.32, ease: 'power1.in' }, 0)
    .fromTo(letters[0], { x: 0, autoAlpha: 1 }, { x: function () { return -window.innerWidth * 0.22; }, autoAlpha: 0, duration: 0.55, ease: 'power2.in' }, 0)
    .fromTo(letters[1], { x: 0, autoAlpha: 1 }, { x: function () { return window.innerWidth * 0.14; }, autoAlpha: 0, duration: 0.55, ease: 'power2.in' }, 0)
    .fromTo(letters[2], { x: 0, autoAlpha: 1 }, { x: function () { return window.innerWidth * 0.26; }, autoAlpha: 0, duration: 0.55, ease: 'power2.in' }, 0)
    .fromTo(media, { scale: 1 }, { scale: 1.12, duration: 1 }, 0)
    .fromTo(foot, { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: 24, duration: 0.2 }, 0)
    .fromTo(ring, { rotation: -50, autoAlpha: 0 }, { rotation: 40, autoAlpha: 1, duration: 1, ease: 'power1.out' }, 0.05)
    .fromTo(apTitleWords, { yPercent: 110 }, { yPercent: 0, duration: 0.42, stagger: 0.04, ease: 'power3.out' }, 0.42)
    .fromTo(apLabel, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.3 }, 0.5)
    .fromTo(lustre, { autoAlpha: 1 }, { autoAlpha: 0.0, duration: 0.35 }, 0.9)
    .to({}, { duration: 0.2 });

  /* ---------- 2 · introduction ---------- */
  function revealWords(el, opts) {
    var words = splitWords(el);
    gsap.fromTo(words, { yPercent: 110 }, {
      yPercent: 0, duration: opts && opts.dur || 1.2, ease: 'expo.out', stagger: opts && opts.stagger || 0.035,
      scrollTrigger: { trigger: el, start: 'top 86%', once: true }
    });
  }
  revealWords($('.intro__title'));
  gsap.fromTo('.intro .hairline--v', { scaleY: 0 }, { scaleY: 1, duration: 1.4, ease: 'expo.inOut', scrollTrigger: { trigger: '.intro .hairline--v', start: 'top 90%', once: true } });

  var win = $('.intro .window__clip'), winImg = $('.intro .window__clip img');
  gsap.fromTo(win, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.6, ease: 'expo.inOut', scrollTrigger: { trigger: win, start: 'top 85%', once: true } });
  gsap.fromTo(winImg, { scale: 1.35 }, { scale: 1.06, duration: 2.2, ease: 'expo.out', scrollTrigger: { trigger: win, start: 'top 85%', once: true } });
  gsap.fromTo(winImg, { yPercent: -4 }, { yPercent: 4, ease: 'none', scrollTrigger: { trigger: win, start: 'top bottom', end: 'bottom top', scrub: true } });

  var lead = $('.intro__lead');
  if (lead) {
    var lw = splitWords(lead);
    gsap.fromTo(lw, { yPercent: 105, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 1, ease: 'expo.out', stagger: 0.012, scrollTrigger: { trigger: lead, start: 'top 86%', once: true } });
  }

  function revealUp(list) {
    list.forEach(function (el) {
      gsap.fromTo(el, { y: 34, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
    });
  }
  revealUp($$('.intro .reveal-up, .layers .reveal-up'));

  /* ---------- layers ---------- */
  revealWords($('.layers__title em'), { stagger: 0.06 });
  $$('.layer').forEach(function (layer) {
    var words = splitWords($('.layer__name', layer));
    var oval = $('.layer__oval', layer), img = $('img', oval);
    var tl = gsap.timeline({ scrollTrigger: { trigger: layer, start: 'top 86%', once: true } });
    tl.fromTo($('.layer__rule', layer), { scaleX: 0 }, { scaleX: 1, duration: 1.4, ease: 'expo.inOut' }, 0)
      .fromTo(words, { yPercent: 110 }, { yPercent: 0, duration: 1.2, ease: 'expo.out', stagger: 0.07 }, 0.15)
      .fromTo(oval, { scaleX: 0 }, { scaleX: 1, duration: 1.3, ease: 'expo.inOut' }, 0.3)
      .fromTo(img, { scale: 1.5 }, { scale: 1, duration: 1.8, ease: 'expo.out' }, 0.45)
      .fromTo([$('.layer__no', layer), $('.layer__text', layer)], { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 1, ease: 'power3.out', stagger: 0.1 }, 0.5);
  });

  /* ---------- 3 · the strand (pinned, drawn on scroll) ---------- */
  var strandTl = null;
  if (strand) {
    var reads = $$('.read');
    var nodes = strand.nodes;
    var dash = function () { return strand.state.len; };
    ScrollTrigger.addEventListener('refreshInit', function () { strand.layout(); });
    gsap.set(reads.slice(1), { autoAlpha: 0, y: 18 });

    strandTl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: '.strand', start: 'top top',
        end: function () { return '+=' + Math.round(window.innerHeight * (isNarrow() ? 2.3 : 2.5)); },
        pin: true, scrub: 0.6, invalidateOnRefresh: true, anticipatePin: 1
      }
    });
    var DRAW = 1;
    strandTl
      .fromTo([strand.thread, strand.glow], { strokeDasharray: dash, strokeDashoffset: dash }, { strokeDasharray: dash, strokeDashoffset: 0, duration: DRAW }, 0)
;
    nodes.forEach(function (n) {
      var at = Math.max(0, n.f * DRAW - 0.02);
      strandTl.fromTo(n.shape, { scale: 0, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.05, ease: 'back.out(2)' }, at)
        .fromTo(n.lead, { strokeDasharray: function () { return n.leadLen + 1; }, strokeDashoffset: function () { return n.leadLen + 1; } },
                        { strokeDasharray: function () { return n.leadLen + 1; }, strokeDashoffset: 0, duration: 0.05 }, at + 0.02)
        .fromTo(n.label, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.06, ease: 'power2.out' }, at + 0.04);
    });
    strandTl
      .to(reads[0], { autoAlpha: 0, y: -14, duration: 0.05 }, 0.105)
      .fromTo(reads[1], { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.06, immediateRender: false }, 0.125)
      .to(reads[1], { autoAlpha: 0, y: -14, duration: 0.05 }, 0.575)
      .fromTo(reads[2], { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.06, immediateRender: false }, 0.595)
      .to({}, { duration: 0.25 }, DRAW);

    gsap.fromTo($$('.strand__head > *, .strand__legend li'), { y: 40, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1.2, ease: 'expo.out', stagger: 0.1, scrollTrigger: { trigger: '.strand', start: 'top 70%', once: true } });
  }

  /* ---------- 4 · five pearls (pinned sequence) ---------- */
  var brands = $$('.brand');
  var pearlsTl = null;
  if (brands.length) {
    var B = brands.map(function (b) {
      return {
        fig: $('.brand__fig', b), img: $('.brand__fig img', b),
        chars: splitChars($('.brand__name', b)),
        info: [$('.brand__meta', b), $('.brand__line', b)]
      };
    });
    var idxItems = $$('.pearls__index li'), bead = $('.pearls__bead'), prog = $('.pearls__progress i');
    B.forEach(function (b, i) {
      if (!i) return;
      gsap.set(b.fig, { clipPath: 'inset(100% 0% 0% 0%)' });
      gsap.set(b.chars, { yPercent: 135 });
      gsap.set(b.info, { autoAlpha: 0, y: 16 });
    });

    // entry of the first pearl, scrubbed while the section rises into view
    var entry = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: '.pearls', start: 'top 85%', end: 'top top', scrub: 0.6 } });
    entry.fromTo(B[0].fig, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1, ease: 'power2.out' }, 0)
      .fromTo(B[0].img, { scale: 1.3 }, { scale: 1, duration: 1 }, 0)
      .fromTo(B[0].chars, { yPercent: 135 }, { yPercent: 0, duration: 0.5, stagger: 0.06, ease: 'power3.out' }, 0.35)
      .fromTo(B[0].info, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.4 }, 0.6)
      .fromTo('.pearls__top', { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.5 }, 0.3);

    var STEP = 1.3, total = (B.length - 1) * STEP + 0.6;
    var activeIdx = -1;
    function setActive(i) {
      if (i === activeIdx) return; activeIdx = i;
      idxItems.forEach(function (li, k) { li.classList.toggle('is-on', k === i); });
    }
    setActive(0);
    pearlsTl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: '.pearls', start: 'top top',
        end: function () { return '+=' + Math.round(window.innerHeight * (isNarrow() ? 3.4 : 3.8)); },
        pin: true, scrub: 0.6, invalidateOnRefresh: true, anticipatePin: 1,
        onUpdate: function (self) {
          var t = self.progress * total, i = 0;
          for (var k = 1; k < B.length; k++) if (t > (k - 1) * STEP + 0.3 + 0.5) i = k;
          setActive(i);
        }
      }
    });
    for (var i = 1; i < B.length; i++) {
      var p = (i - 1) * STEP + 0.3, cur = B[i], prev = B[i - 1];
      pearlsTl
        .fromTo(cur.fig, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.9, ease: 'power2.inOut', immediateRender: false }, p)
        .fromTo(cur.img, { scale: 1.3, yPercent: 6 }, { scale: 1, yPercent: 0, duration: 1, ease: 'power2.out', immediateRender: false }, p)
        .to(prev.img, { scale: 1.12, duration: 0.9, ease: 'power1.in' }, p)
        .to(prev.chars, { yPercent: -135, duration: 0.45, stagger: 0.035, ease: 'power3.in' }, p)
        .fromTo(cur.chars, { yPercent: 135 }, { yPercent: 0, duration: 0.5, stagger: 0.04, ease: 'power3.out', immediateRender: false }, p + 0.4)
        .to(prev.info, { autoAlpha: 0, y: -12, duration: 0.3 }, p)
        .fromTo(cur.info, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.35, immediateRender: false }, p + 0.55);
      if (bead && idxItems[i]) {
        pearlsTl.to(bead, { y: function (k) { return function () { return idxItems[k].offsetTop + idxItems[k].offsetHeight / 2 - 4.5; }; }(i)(), duration: 0.6, ease: 'power2.inOut' }, p + 0.2);
      }
    }
    if (bead && idxItems[0]) gsap.set(bead, { y: idxItems[0].offsetTop + idxItems[0].offsetHeight / 2 - 4.5 });
    if (prog) pearlsTl.fromTo(prog, { scaleX: 0.2 }, { scaleX: 1, duration: total, ease: 'none' }, 0);
    pearlsTl.to({}, { duration: 0.01 }, total);
  }

  /* ---------- 5 · horizon ---------- */
  var hz = $('.horizon');
  if (hz) {
    var hzMedia = $('.horizon__media'), hzImg = $('.horizon__media img');
    var hzBits = [$('.horizon__copy .t-label'), $('.horizon__big'), $('.horizon__it')];
    var startInset = function () { return isNarrow() ? 'ellipse(30% 20% at 50% 50%)' : 'ellipse(15% 26% at 50% 50%)'; };
    var hzTl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: hz, start: 'top top', end: 'bottom bottom', scrub: 0.6, invalidateOnRefresh: true } });
    hzTl.fromTo(hzMedia, { clipPath: startInset }, { clipPath: 'ellipse(80% 80% at 50% 50%)', duration: 0.55, ease: 'power2.inOut' }, 0)
      .fromTo(hzImg, { scale: 1.3 }, { scale: 1, duration: 0.7 }, 0)
      .fromTo(hzBits, { autoAlpha: 0, y: 50 }, { autoAlpha: 1, y: 0, duration: 0.22, stagger: 0.08, ease: 'power2.out' }, 0.5)
      .to({}, { duration: 0.15 });
    // the small window rises into view before the section sticks
    gsap.set(hzMedia, { clipPath: startInset() });
  }

  /* ---------- vision + contact ---------- */
  revealUp($$('.vision .reveal-up'));
  var ct = $('.contact__title');
  if (ct) {
    var cw = splitWords(ct);
    gsap.fromTo(cw, { yPercent: 110 }, { yPercent: 0, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: ct, start: 'top 88%', once: true } });
  }
  revealUp($$('.contact__kicker, .contact__lead, .contact__mail'));
  gsap.fromTo('.contact__pearl', { scale: 0.6, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 2, ease: 'expo.out', scrollTrigger: { trigger: '.contact', start: 'top 75%', once: true } });
  gsap.fromTo('.contact__pearl', { y: -30 }, { y: 30, ease: 'none', scrollTrigger: { trigger: '.contact', start: 'top bottom', end: 'bottom top', scrub: true } });

  /* ---------- header tone + gauge (created after all pins) ---------- */
  var toneMap = [
    ['.intro', 'light', 1], ['.layers', 'light', 1], ['.strand', 'dark', 2], ['.pearls', 'light', 3],
    ['.horizon', 'dark', 4], ['.vision', 'dark', 4], ['.contact', 'dark', 5], ['.foot', 'dark', 5]
  ];
  toneMap.forEach(function (row) {
    var el = $(row[0]); if (!el) return;
    var spacer = el.parentElement && el.parentElement.classList.contains('pin-spacer') ? el.parentElement : el;
    ScrollTrigger.create({
      trigger: spacer, start: 'top 32px', end: 'bottom 32px',
      onToggle: function (self) { if (self.isActive) { setTone(row[1]); setGauge(row[2]); } }
    });
  });
  if (gauge) {
    var gp = $('.gauge__pearl'), gLine = $('.gauge__line');
    var setY = gsap.quickSetter(gp, 'y', 'px');
    ScrollTrigger.create({ start: 0, end: 'max', onUpdate: function (self) { setY(self.progress * gLine.offsetHeight); } });
    gaugeItems.forEach(function (li) {
      li.addEventListener('click', function () { goTo('#' + li.getAttribute('data-target')); });
    });
  }

  /* ---------- navigation ---------- */
  function targetY(hash) {
    var stDive = diveTl.scrollTrigger;
    if (hash === '#surface' || hash === '#main') return 0;
    if (hash === '#shell') return stDive.end;
    if (hash === '#strand' && strandTl) return strandTl.scrollTrigger.start + 1;
    if (hash === '#pearls' && pearlsTl) return pearlsTl.scrollTrigger.start - window.innerHeight * 0.0 + 1;
    var el = $(hash); if (!el) return null;
    return el.getBoundingClientRect().top + window.scrollY;
  }
  function goTo(hash, instant) {
    var y = targetY(hash); if (y == null) return;
    if (lenis) lenis.scrollTo(y, { duration: instant ? 0 : 1.8, immediate: !!instant, force: true });
    else window.scrollTo(0, y);
    var t = $(hash);
    if (t && !instant) { setTimeout(function () { if (!t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true }); }, 900); }
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var hash = a.getAttribute('href');
    if (hash.length < 2 || hash === '#main') return;
    e.preventDefault();
    if (menuOpen) { closeMenu(function () { goTo(hash); }); }
    else goTo(hash);
  });

  /* ---------- menu ---------- */
  var main = $('#main');
  function openMenu() {
    if (menuOpen) return; menuOpen = true;
    menu.hidden = false; menuBtn.setAttribute('aria-expanded', 'true');
    $('.bar__menu-label').textContent = 'Close';
    bar.setAttribute('data-tone', 'light');
    if (lenis) lenis.stop();
    if (main) main.setAttribute('inert', '');
    var b = menuBtn.getBoundingClientRect(), at = (b.left + b.width / 2) + 'px ' + (b.top + b.height / 2) + 'px';
    gsap.fromTo(menu, { clipPath: 'circle(0% at ' + at + ')' }, { clipPath: 'circle(150% at ' + at + ')', duration: 1.1, ease: 'expo.inOut' });
    gsap.fromTo($$('.menu__word, .menu__list .t-label', menu), { yPercent: 120 }, { yPercent: 0, duration: 1, ease: 'expo.out', stagger: 0.04, delay: 0.35 });
    gsap.fromTo($$('.menu__kicker, .menu__foot', menu), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.8, delay: 0.6 });
    setTimeout(function () { var f = $('a', menu); if (f) f.focus({ preventScroll: true }); }, 400);
  }
  function closeMenu(cb) {
    if (!menuOpen) { if (cb) cb(); return; }
    var b = menuBtn.getBoundingClientRect(), at = (b.left + b.width / 2) + 'px ' + (b.top + b.height / 2) + 'px';
    gsap.to(menu, {
      clipPath: 'circle(0% at ' + at + ')', duration: 0.8, ease: 'expo.inOut',
      onComplete: function () {
        menu.hidden = true; menuOpen = false;
        menuBtn.setAttribute('aria-expanded', 'false');
        $('.bar__menu-label').textContent = 'Menu';
        bar.setAttribute('data-tone', currentTone);
        if (main) main.removeAttribute('inert');
        if (lenis) lenis.start();
        if (cb) cb();
      }
    });
  }
  if (menuBtn) menuBtn.addEventListener('click', function () { if (menuOpen) { closeMenu(); menuBtn.focus(); } else openMenu(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && menuOpen) { closeMenu(); menuBtn.focus(); } });

  /* ---------- loader → opening ---------- */
  var loader = $('.loader');
  var count = $('.loader__count'), ringC = $('.loader__ring circle');
  var heroImg = $('.hero__img--day');
  var hashOnLoad = location.hash && location.hash.length > 1 ? location.hash : null;
  window.scrollTo(0, 0);

  var slotKids = $$('.hero__pearl > *'), footKids = $$('.hero__foot > *'), heroImgs = $$('.hero__img');
  gsap.set(letterInner, { yPercent: 105 });
  gsap.set(slotKids, { scale: 0 });
  gsap.set(footKids, { autoAlpha: 0, y: 20 });
  gsap.set(heroImgs, { scale: 1.14 });

  var ready = Promise.all([
    document.fonts && document.fonts.ready ? document.fonts.ready.catch(function () {}) : Promise.resolve(),
    heroImg && heroImg.decode ? heroImg.decode().catch(function () {}) : Promise.resolve()
  ]);
  var timeout = new Promise(function (r) { setTimeout(r, 3200); });
  var minTime = new Promise(function (r) { setTimeout(r, 900); });
  var counter = { v: 0 };
  var countTween = gsap.to(counter, {
    v: 86, duration: 1.6, ease: 'power2.out',
    onUpdate: function () { count.textContent = pad(Math.round(counter.v)); gsap.set(ringC, { strokeDashoffset: 340 * (1 - counter.v / 100) }); }
  });

  Promise.all([Promise.race([ready, timeout]), minTime]).then(function () {
    countTween.kill();
    gsap.to(counter, {
      v: 100, duration: 0.45, ease: 'power2.inOut',
      onUpdate: function () { count.textContent = pad(Math.round(counter.v)); gsap.set(ringC, { strokeDashoffset: 340 * (1 - counter.v / 100) }); },
      onComplete: open
    });
  });

  var opened = false;
  function open() {
    if (opened) return; opened = true;
    var tl = gsap.timeline({
      onComplete: function () {
        if (loader && loader.parentNode) loader.parentNode.removeChild(loader);
        html.classList.add('is-ready');
        if (lenis) lenis.start();
        ScrollTrigger.refresh();
        if (hashOnLoad) goTo(hashOnLoad, true);
      }
    });
    tl.to(loader, { clipPath: 'inset(0% 0% 100% 0%)', duration: 1.15, ease: 'expo.inOut' }, 0)
      .to(heroImgs, { scale: 1, duration: 2.4, ease: 'expo.out' }, 0.35)
      .to(letterInner, { yPercent: 0, duration: 1.5, ease: 'expo.out', stagger: 0.09 }, 0.65)
      .to(slotKids, { scale: 1, duration: 1.8, ease: 'expo.out' }, 0.8)
      .to(footKids, { autoAlpha: 1, y: 0, duration: 1.2, ease: 'expo.out', stagger: 0.08 }, 1.1)
      .add(function () { html.classList.add('is-ready'); if (lenis) lenis.start(); }, 1.3);
  }

  /* ---------- refresh after fonts & late images ---------- */
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
  window.addEventListener('load', function () { ScrollTrigger.refresh(); });

  // safety net: never leave content hidden if something goes wrong
  window.addEventListener('error', function () {
    if (!opened && loader) { loader.style.display = 'none'; gsap.set([letterInner, slotKids, footKids, heroImgs], { clearProps: 'transform,opacity,visibility' }); if (lenis) lenis.start(); }
  });
})();
