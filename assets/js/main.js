/* DORR — motion & interaction
   Loader ring → hero aperture → word reveals → pinned orbit → horizontal brands.
   Every effect has a static fallback (no JS / prefers-reduced-motion). */
(() => {
  const root = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  /* ------------------------------------------------- text splitting (words) */
  const splitWords = (el, wrap) => {
    [...el.childNodes].forEach((node) => {
      if (node.nodeType === 3) {
        const frag = document.createDocumentFragment();
        node.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          frag.appendChild(/^\s+$/.test(part) ? document.createTextNode(' ') : wrap(part));
        });
        node.replaceWith(frag);
      } else if (node.nodeType === 1) {
        splitWords(node, wrap);
      }
    });
  };
  $$('.split').forEach((el) => splitWords(el, (word) => {
    const w = document.createElement('span');
    w.className = 'w';
    const wi = document.createElement('span');
    wi.className = 'wi';
    wi.textContent = word;
    w.appendChild(wi);
    return w;
  }));
  $$('.scrub-words').forEach((el) => splitWords(el, (word) => {
    const s = document.createElement('span');
    s.className = 'sw';
    s.textContent = word;
    return s;
  }));

  /* ------------------------------------------------- services accordion */
  $$('.svc__item').forEach((item) => {
    const btn = $('.svc__row', item);
    btn.addEventListener('click', () => {
      const open = !item.classList.contains('is-open');
      $$('.svc__item.is-open').forEach((o) => {
        if (o !== item) { o.classList.remove('is-open'); $('.svc__row', o).setAttribute('aria-expanded', 'false'); }
      });
      item.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', String(open));
      setTimeout(() => window.ScrollTrigger && ScrollTrigger.refresh(), 850);
    });
  });

  /* ----------------------------------------------------------------- form */
  const form = $('[data-form]');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const status = $('[data-form-status]');
      let ok = true;
      $$('input[required]', form).forEach((input) => {
        const valid = input.value.trim() && (input.type !== 'email' || /.+@.+\..+/.test(input.value));
        input.closest('.field').classList.toggle('is-invalid', !valid);
        if (!valid) ok = false;
      });
      if (!ok) { status.textContent = 'Please add your name and a valid email.'; return; }
      const data = new FormData(form);
      const body = [
        `Name: ${data.get('name')}`,
        `Company: ${data.get('company') || '—'}`,
        `Email: ${data.get('email')}`,
        `Interested in: ${data.getAll('topic').join(', ') || '—'}`,
        '',
        data.get('message') || '',
      ].join('\n');
      const to = $('[data-contact-email]')?.textContent.trim() || '';
      location.href = `mailto:${to}?subject=${encodeURIComponent('Enquiry — DORR')}&body=${encodeURIComponent(body)}`;
      status.textContent = `Opening your email app with this message. If nothing opens, write to ${to}.`;
    });
  }

  /* ----------------------------------------------------------------- menu */
  const menu = $('[data-menu]');
  const menuBtn = $('[data-menu-toggle]');
  let lenis = null;
  const setMenu = (open) => {
    menu.classList.toggle('is-open', open);
    menu.setAttribute('aria-hidden', String(!open));
    menuBtn.setAttribute('aria-expanded', String(open));
    if (lenis) open ? lenis.stop() : lenis.start();
  };
  menuBtn?.addEventListener('click', () => setMenu(!menu.classList.contains('is-open')));
  $$('.menu a').forEach((a) => {
    a.addEventListener('click', () => setMenu(false));
    a.addEventListener('mouseenter', () => { const img = $('[data-menu-img]'); if (img && a.dataset.img) img.src = a.dataset.img; });
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.classList.contains('is-open')) setMenu(false); });

  /* ----------------------------------------------------- no-animation path */
  const loader = $('.loader');
  if (reduce || !window.gsap || !window.ScrollTrigger) {
    loader?.remove();
    root.classList.add('rm');
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });
  const EASE = 'expo.out';
  // Pins are applied in the same frame as Lenis scrolls, so anticipating them only
  // makes sections jump early. Native touch scrolling runs off-thread and needs it.
  const ANTICIPATE = ScrollTrigger.isTouch === 1 ? 1 : 0;

  /* -------------------------------------------------------- smooth scroll */
  if (window.Lenis) {
    lenis = new Lenis({ duration: 1.25, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    // While stopped (loader, menu) Lenis blocks wheel and touch; keep the keyboard
    // from scrolling the page hidden behind them too.
    const scrollKeys = [' ', 'PageDown', 'PageUp', 'ArrowDown', 'ArrowUp', 'Home', 'End'];
    document.addEventListener('keydown', (e) => {
      if (lenis.isStopped && scrollKeys.includes(e.key) && !e.target.closest('button, input, textarea')) e.preventDefault();
    });
    $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      const target = id === '#top' ? 0 : $(id);
      if (target === null) return;
      e.preventDefault();
      lenis.scrollTo(target, { duration: 1.6 });
    }));
  }

  /* --------------------------------------------------------------- cursor */
  const cursor = $('.cursor');
  if (finePointer && cursor) {
    const dot = $('.cursor__dot', cursor);
    const ring = $('.cursor__ring', cursor);
    const label = $('.cursor__label', cursor);
    const dx = gsap.quickTo(dot, 'x', { duration: 0.12, ease: 'power3' });
    const dy = gsap.quickTo(dot, 'y', { duration: 0.12, ease: 'power3' });
    const rx = gsap.quickTo(ring, 'x', { duration: 0.55, ease: 'power3' });
    const ry = gsap.quickTo(ring, 'y', { duration: 0.55, ease: 'power3' });
    window.addEventListener('pointermove', (e) => {
      cursor.classList.remove('is-hidden');
      dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY);
    });
    document.addEventListener('pointerleave', () => cursor.classList.add('is-hidden'));
    $$('.svc__row').forEach((r) => { r.dataset.cursor = 'Open'; });
    document.addEventListener('pointerover', (e) => {
      const view = e.target.closest('[data-cursor]');
      const link = e.target.closest('a, button, label, input, textarea');
      cursor.classList.toggle('is-view', !!view);
      cursor.classList.toggle('is-link', !view && !!link);
      label.textContent = view ? view.dataset.cursor : '';
    });
  }

  /* -------------------------------------------------------- magnetic CTAs */
  if (finePointer) {
    $$('.magnetic').forEach((el) => {
      const mx = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3' });
      const my = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3' });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        mx((e.clientX - r.left - r.width / 2) * 0.32);
        my((e.clientY - r.top - r.height / 2) * 0.42);
      });
      el.addEventListener('pointerleave', () => gsap.to(el, { x: 0, y: 0, duration: 1, ease: 'elastic.out(1, 0.45)' }));
    });
  }

  /* ------------------------------------- floating image over services list */
  const float = $('.svc-float');
  if (finePointer && float) {
    const inner = $('.svc-float__inner', float);
    const cache = {};
    const fx = gsap.quickTo(float, 'x', { duration: 0.7, ease: 'power3' });
    const fy = gsap.quickTo(float, 'y', { duration: 0.7, ease: 'power3' });
    const fr = gsap.quickTo(float, 'rotation', { duration: 0.8, ease: 'power3' });
    let lastX = 0;
    const show = (src) => {
      if (!cache[src]) { const img = new Image(); img.src = src; img.alt = ''; inner.appendChild(img); cache[src] = img; }
      Object.values(cache).forEach((img) => { img.style.opacity = img === cache[src] ? 1 : 0; });
      float.classList.add('is-on');
    };
    const hide = () => float.classList.remove('is-on');
    window.addEventListener('pointermove', (e) => {
      fx(e.clientX); fy(e.clientY);
      fr(gsap.utils.clamp(-10, 10, (e.clientX - lastX) * 0.6));
      lastX = e.clientX;
    });
    // Build and decode every image the first time the pointer reaches the list,
    // so the first hover doesn't stall on a full-size decode.
    $('[data-svc]').addEventListener('pointerenter', () => {
      $$('.svc__item').forEach((item) => {
        const src = item.dataset.img;
        if (cache[src]) return;
        const img = new Image(); img.src = src; img.alt = ''; img.style.opacity = 0;
        img.decode?.().catch(() => {});
        inner.appendChild(img); cache[src] = img;
      });
    }, { once: true });
    $$('.svc__item').forEach((item) => {
      item.addEventListener('pointerenter', () => { if (!item.classList.contains('is-open')) show(item.dataset.img); });
      item.addEventListener('pointerleave', hide);
      $('.svc__row', item).addEventListener('click', hide);
    });
  }

  /* --------------------------------------------------------- nav on scroll */
  const nav = $('[data-nav]');
  ScrollTrigger.create({
    start: 0, end: 'max',
    onUpdate: (self) => {
      if (menu.classList.contains('is-open')) return;
      nav.classList.toggle('is-hidden', self.direction === 1 && self.scroll() > window.innerHeight * 0.6);
    },
  });

  /* ---------------------------------------------------------------- hero */
  // Scroll owns --r (radius) and the img scale; the intro owns --k (0→1) and
  // the media wrapper, so both are set up front without fighting.
  const hero = $('[data-hero]');
  const aperture = $('[data-aperture]');
  const heroMedia = $('.hero__media', aperture);
  const heroImg = $('img', aperture);
  const heroWords = $$('.hero__title .wi');
  const stage = $('.hero__stage');
  const startR = () => Math.min(innerWidth, innerHeight) * (innerWidth < 640 ? 0.26 : 0.17);
  // measured on the stage itself: it has a min-height, so on short screens it is taller than the window
  const endR = () => Math.hypot(stage.offsetWidth / 2, stage.offsetHeight * 0.52) * 1.02;
  gsap.set(aperture, { '--k': 0 });
  gsap.set(heroWords, { yPercent: 115 });
  gsap.set('.hero .reveal', { autoAlpha: 0, y: 24 });
  gsap.set('.nav > *', { autoAlpha: 0, y: -20 });

  gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: hero, start: 'top top', end: '+=110%', scrub: 0.9, pin: stage, anticipatePin: ANTICIPATE, invalidateOnRefresh: true },
  })
    .fromTo(aperture, { '--r': () => startR() + 'px' }, { '--r': () => endR() + 'px' }, 0)
    .fromTo(heroImg, { scale: 1.22 }, { scale: 1 }, 0)
    .to('.hero__title', { yPercent: -18, opacity: 0 }, 0.35)
    .to('.hero__foot', { y: -40, opacity: 0 }, 0.2);

  const runIntro = () => {
    gsap.timeline()
      .to(aperture, { '--k': 1, duration: 1.6, ease: 'expo.inOut' }, 0)
      .fromTo(heroMedia, { scale: 1.35 }, { scale: 1, duration: 2.2, ease: EASE }, 0)
      .to(heroWords, { yPercent: 0, duration: 1.4, stagger: 0.07, ease: EASE }, 0.55)
      .to('.hero .reveal', { autoAlpha: 1, y: 0, duration: 1.2, stagger: 0.12, ease: EASE }, 1.0)
      .to('.nav > *', { y: 0, autoAlpha: 1, duration: 1, stagger: 0.08, ease: EASE }, 0.9);
  };

  /* -------------------------------------------------------------- loader */
  const ringCircle = $('.loader__ring circle');
  const countEl = $('[data-count]');
  let seen = false;
  try { seen = sessionStorage.getItem('dorr-seen') === '1'; sessionStorage.setItem('dorr-seen', '1'); } catch (e) {}

  // No scrollTo(0, 0) here: on reload the browser restores the reader's place after
  // this runs anyway, so forcing the top only raced it. The loader covers either case.
  if (lenis) lenis.stop();
  const progress = { v: 0 };
  const paint = () => {
    ringCircle.style.strokeDashoffset = 578 * (1 - progress.v / 100);
    countEl.textContent = Math.round(progress.v);
  };
  const minTime = seen ? 0.5 : 1.8;
  const ready = Promise.all([
    document.fonts ? document.fonts.ready : Promise.resolve(),
    heroImg.complete ? Promise.resolve() : new Promise((r) => { heroImg.addEventListener('load', r, { once: true }); heroImg.addEventListener('error', r, { once: true }); }),
    new Promise((r) => setTimeout(r, minTime * 1000)),
  ]);
  const fake = gsap.to(progress, { v: 86, duration: minTime, ease: 'power2.out', onUpdate: paint });
  ready.then(() => {
    fake.kill();
    gsap.timeline()
      .to(progress, { v: 100, duration: 0.5, ease: 'power2.inOut', onUpdate: paint })
      .to('.loader__mark', { autoAlpha: 0, y: -10, duration: 0.5, ease: 'power2.in' })
      .add(runIntro, '-=0.1')
      .to('.loader__ring', { scale: 0.92, autoAlpha: 0, duration: 0.9, ease: 'power3.inOut' }, '<')
      .to(loader, { autoAlpha: 0, duration: 0.8, ease: 'power2.out' }, '<0.2')
      .add(() => { loader.remove(); if (lenis) lenis.start(); ScrollTrigger.refresh(); });
  });

  /* ------------------------------------- structure: the orbit (pinned) */
  // Pinned sections are created first and in page order: a trigger below a pin
  // must be measured after that pin's spacer exists, or it fires screens early.
  const structure = $('[data-structure]');
  if (structure) {
    const nodes = $$('.node', structure);
    const caps = $$('.cap', structure);
    const imgs = $$('[data-node-img]', structure);
    const n = nodes.length;
    let current = 0;
    const setNode = (i) => {
      if (i === current) return;
      current = i;
      nodes.forEach((el, k) => { el.classList.toggle('is-active', k === i); el.classList.toggle('is-done', k < i); });
      caps.forEach((el, k) => el.classList.toggle('is-active', k === i));
      imgs.forEach((el, k) => el.classList.toggle('is-active', k === i));
    };
    gsap.timeline({
      defaults: { ease: 'none' },
      // follow the scrubbed timeline, not the raw scroll, so a node lights up
      // exactly when the travelling dot reaches it
      onUpdate() { setNode(Math.min(n - 1, Math.floor(this.progress() * n))); },
      scrollTrigger: {
        trigger: structure, start: 'top top', end: '+=' + n * 70 + '%', scrub: 0.6, pin: '.structure__pin', anticipatePin: ANTICIPATE,
      },
    })
      .fromTo('[data-ring]', { strokeDashoffset: 1131 }, { strokeDashoffset: 0 }, 0)
      .fromTo('[data-ring-dot]', { rotation: 0 }, { rotation: 360, svgOrigin: '200 200' }, 0)
      .fromTo('.orbit', { scale: 0.94 }, { scale: 1 }, 0);
  }

  /* --------------------------------------------- brands: horizontal */
  const brands = $('[data-brands]');
  if (brands) {
    const track = $('[data-track]', brands);
    const distance = () => Math.max(0, track.scrollWidth - innerWidth);
    // the progress bar is driven by the same scrubbed tween, so it never runs ahead of the cards
    const setBar = gsap.quickSetter('[data-brands-bar]', 'scaleX');
    const horiz = gsap.to(track, {
      x: () => -distance(), ease: 'none',
      onUpdate() { setBar(this.progress()); },
      scrollTrigger: {
        trigger: brands, start: 'top top', end: () => '+=' + distance(), scrub: 0.8,
        pin: '.brands__pin', anticipatePin: ANTICIPATE, invalidateOnRefresh: true,
      },
    });
    $$('.brand-card', brands).forEach((card) => {
      const img = $('img', card);
      gsap.fromTo(img, { xPercent: 7 }, {
        xPercent: -7, ease: 'none',
        scrollTrigger: { trigger: card, containerAnimation: horiz, start: 'left right', end: 'right left', scrub: true },
      });
      // Cards visible before the pin starts reveal with the section; the rest about a
      // card-width before they slide in, so they never arrive as empty frames.
      const inFirstView = card.offsetLeft < innerWidth;
      gsap.fromTo(card, { clipPath: 'inset(0% 0% 100% 0%)' }, {
        clipPath: 'inset(0% 0% 0% 0%)', duration: 1.4, ease: 'expo.inOut', delay: inFirstView ? card.offsetLeft / innerWidth * 0.4 : 0,
        scrollTrigger: inFirstView
          ? { trigger: brands, start: 'top 60%', once: true }
          : { trigger: card, containerAnimation: horiz, start: () => 'left right+=' + Math.round(card.offsetWidth + innerWidth * 0.25), toggleActions: 'play none none none' },
      });
    });
  }

  /* ---------------------------------------------------- generic reveals */
  $$('.split').forEach((el) => {
    if (el.closest('.hero')) return;
    const words = $$('.wi', el);
    gsap.set(words, { yPercent: 115 });
    ScrollTrigger.create({
      trigger: el, start: 'top 88%', once: true,
      onEnter: () => gsap.to(words, { yPercent: 0, duration: 1.3, stagger: 0.05, ease: EASE }),
    });
  });

  const reveals = $$('.reveal').filter((el) => !el.closest('.hero'));
  gsap.set(reveals, { autoAlpha: 0, y: 36 });
  ScrollTrigger.batch(reveals, {
    start: 'top 90%', once: true,
    onEnter: (els) => gsap.to(els, { autoAlpha: 1, y: 0, duration: 1.2, stagger: 0.12, ease: EASE }),
  });

  $$('.parallax').forEach((el) => {
    gsap.fromTo($('img', el), { yPercent: -8 }, { yPercent: 8, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  $$('.scrub-words').forEach((el) => {
    gsap.to($$('.sw', el), {
      opacity: 1, stagger: 0.1, ease: 'none',
      scrollTrigger: { trigger: el, start: 'top 78%', end: 'bottom 50%', scrub: true },
    });
  });

  /* ---------------------------------------------------- footer mark */
  gsap.fromTo('.footer__mark span', { yPercent: 55 }, {
    yPercent: 0, ease: 'none',
    scrollTrigger: { trigger: '.footer', start: 'top bottom', end: 'bottom bottom', scrub: true },
  });

  /* ------------------------------------- keep the reader's place on resize */
  // A resize or phone rotation changes every pin length, so the same pixel offset
  // lands in a different section. Remember where we are within the current section
  // when scrolling stops, and put the reader back there after the refresh.
  // inside a pinned section its own progress is the exact place; elsewhere the section's
  const pins = ScrollTrigger.getAll().filter((t) => t.pin);
  const marks = $$('main > section').map((el) => ScrollTrigger.create({ trigger: el, start: 'top top', end: 'bottom top' }));
  let place = null;
  let hold = 0; // a rotation can refresh more than once: keep restoring for a moment
  // the window size the current layout was measured at; address-bar (height-only)
  // changes on touch devices don't trigger a refresh, so they don't count there
  const touchOnly = ScrollTrigger.isTouch === 1;
  let laidOut = { w: innerWidth, h: innerHeight };
  const sameSize = (a) => a.w === innerWidth && (touchOnly || a.h === innerHeight);
  ScrollTrigger.addEventListener('scrollEnd', () => {
    // resized but not refreshed yet, or our own restore: not the reader scrolling
    if (performance.now() < hold || !sameSize(laidOut)) return;
    const m = pins.find((t) => t.isActive) || marks.find((t) => t.isActive);
    place = m ? { m, p: m.progress, w: innerWidth, h: innerHeight } : null;
  });
  ScrollTrigger.addEventListener('refresh', () => {
    laidOut = { w: innerWidth, h: innerHeight };
    if (!place) return;
    if (!sameSize(place)) { place.w = innerWidth; place.h = innerHeight; hold = performance.now() + 1500; }
    else if (performance.now() >= hold) return;
    const y = place.m.start + place.p * (place.m.end - place.m.start);
    // Lenis may not have re-measured the page yet and would clamp to the old height
    if (lenis) { lenis.resize(); lenis.scrollTo(y, { immediate: true, force: true }); } else window.scrollTo(0, y);
  });

  window.addEventListener('load', () => ScrollTrigger.refresh());
})();
