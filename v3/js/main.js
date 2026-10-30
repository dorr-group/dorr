/* DORR v3 — page behaviour: island, drawer, day/night, reveals. */
(() => {
  const root = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  if (reduce) root.classList.add('rm');

  const PLACES = {
    services: { name: 'Services Company', kind: 'At the centre', img: 'img/service.jpg', text: 'Specialized expertise and coordinated execution for every brand in the Group: culinary, creative, marketing, people, operations, openings, procurement and technology.' },
    dada: { name: 'DADA', kind: 'Restaurant', img: 'img/dining.jpg', text: 'A distinct dining concept with its own identity, supported by shared Group expertise.' },
    sayah: { name: 'SAYAH', kind: 'Beachclub', img: 'img/beach.jpg', text: 'A beach club with its own rhythm by the water, backed by the Group’s operating standards.' },
    deja: { name: 'DÉJÀ VU', kind: 'Hospitality concept', img: 'img/g1.jpg', text: 'A hospitality concept with its own character within the DORR portfolio.' },
    m04: { name: 'M04', kind: 'Hospitality concept', img: 'img/g3.jpg', text: 'A hospitality concept with its own character within the DORR portfolio.' },
    randez: { name: 'RANDEZVOU', kind: 'Hospitality concept', img: 'img/g5.jpg', text: 'A hospitality concept with its own character within the DORR portfolio.' },
  };
  const ORDER = Object.keys(PLACES);
  // the card shown inside each place
  const INSIDE = {
    services: { kind: 'The Services Company', text: 'Eight disciplines under one roof, each with its own station. Turn around to see them all.' },
    dada: { kind: 'Restaurant' },
    sayah: { kind: 'Beachclub' },
    deja: { kind: 'A DORR hospitality concept' },
    m04: { kind: 'A DORR hospitality concept' },
    randez: { kind: 'A DORR hospitality concept' },
  };

  /* ---------- split lines on <br> ---------- */
  $$('[data-lines]').forEach((el) => {
    el.innerHTML = el.innerHTML.split(/<br\s*\/?>/i).map((part) => `<span class="ln"><span>${part.trim()}</span></span>`).join('');
  });
  $$('.col').forEach((c) => { $('.col__body', c).dataset.title = $('.col__t', c).textContent; });

  /* ---------- day / night ---------- */
  const modeBtn = $('[data-mode-toggle]');
  const modeLabel = $('[data-mode-label]');
  const themeMeta = $('meta[name="theme-color"]');
  let world = null;
  // instant: used for the saved mode on load (the <head> already applied it before first paint)
  const setMode = (night, instant) => {
    root.dataset.mode = night ? 'night' : 'day';
    modeBtn.setAttribute('aria-pressed', String(night));
    modeLabel.textContent = night ? 'Day' : 'Night';
    themeMeta.setAttribute('content', night ? '#121828' : '#f8f3ea');
    if (world) world.setNight(night, instant);
    if (!instant) { try { localStorage.setItem('dorr-mode', night ? 'night' : 'day'); } catch (e) {} }
  };
  modeBtn.addEventListener('click', () => setMode(root.dataset.mode !== 'night'));

  /* ---------- mobile sheet ---------- */
  const burger = $('[data-burger]');
  const sheet = $('[data-sheet]');
  let lenis = null;
  let veilOn = true;
  const drawer = $('[data-drawer]');
  let insideOpen = false; // inside a place (or flying in / out)
  // the page stays still while the menu, the brand panel or a place is open
  const syncScrollLock = () => {
    const lock = sheet.classList.contains('is-open') || drawer.classList.contains('is-open') || insideOpen;
    if (!lenis) { root.classList.toggle('is-locked', insideOpen); return; }
    if (veilOn) return;
    if (lock) lenis.stop();
    else lenis.start();
  };
  const setSheet = (open) => {
    sheet.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.textContent = open ? 'Close' : 'Menu';
    syncScrollLock();
  };
  burger.addEventListener('click', () => setSheet(!sheet.classList.contains('is-open')));
  $$('a', sheet).forEach((a) => a.addEventListener('click', () => setSheet(false)));

  /* ---------- drawer ---------- */
  const d = { img: $('[data-d-img]'), kind: $('[data-d-kind]'), name: $('[data-d-name]'), text: $('[data-d-text]'), count: $('[data-d-count]') };
  let current = null;
  const fill = (id) => {
    const p = PLACES[id];
    d.img.src = p.img; d.img.alt = p.name;
    d.kind.textContent = p.kind; d.name.textContent = p.name; d.text.textContent = p.text;
    d.count.textContent = `${ORDER.indexOf(id) + 1} / ${ORDER.length}`;
  };
  let swapTl = null;
  drawer.inert = true;
  const openDrawer = (id) => {
    if (!PLACES[id]) return;
    const swap = current && drawer.classList.contains('is-open');
    current = id;
    // one swap at a time: rapid Next/Previous clicks used to stack fades and flicker
    if (swapTl) { swapTl.kill(); swapTl = null; }
    if (swap && window.gsap && !reduce) {
      swapTl = gsap.timeline({ onComplete: () => { swapTl = null; } })
        .to(drawer.children, { autoAlpha: 0, y: 10, duration: 0.25, stagger: 0.02, overwrite: 'auto' })
        .add(() => fill(id))
        .to(drawer.children, { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.03, ease: 'power3.out' });
    } else {
      if (window.gsap) gsap.set(drawer.children, { clearProps: 'opacity,visibility,transform' });
      fill(id);
    }
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    drawer.inert = false;
    root.classList.add('is-visiting');
    syncScrollLock();
  };
  const closeDrawer = () => {
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    drawer.inert = true;
    if (!insideOpen) root.classList.remove('is-visiting');
    current = null;
    syncScrollLock();
  };
  $('[data-drawer-close]').addEventListener('click', closeDrawer);
  $('[data-d-next]').addEventListener('click', () => openDrawer(ORDER[(ORDER.indexOf(current) + 1) % ORDER.length]));
  $('[data-d-prev]').addEventListener('click', () => openDrawer(ORDER[(ORDER.indexOf(current) - 1 + ORDER.length) % ORDER.length]));
  $$('[data-open]').forEach((b) => b.addEventListener('click', () => openDrawer(b.dataset.open)));

  /* ---------- stepping inside a place ---------- */
  const card = $('[data-inside]');
  const ci = { kind: $('[data-in-kind]'), name: $('[data-in-name]'), text: $('[data-in-text]'), next: $('[data-in-next]'), exit: $('[data-in-exit]') };
  const top = $('[data-top]');
  let savedY = 0, afterExit = null, popGuard = false, exitQueued = false;
  const nextOf = (id) => ORDER[(ORDER.indexOf(id) + 1) % ORDER.length];
  const scrollToY = (y, done) => {
    if (lenis) lenis.scrollTo(y, { duration: Math.min(1.4, 0.5 + Math.abs(window.scrollY - y) / 1500), force: true, onComplete: done });
    else { window.scrollTo(0, y); if (done) done(); }
  };
  const fillCard = (id) => {
    const p = PLACES[id], k = INSIDE[id] || {};
    ci.kind.textContent = k.kind || p.kind;
    ci.name.textContent = p.name;
    ci.text.textContent = k.text || p.text;
    const n = nextOf(id);
    ci.next.textContent = `Next: ${PLACES[n].name} →`;
    ci.next.dataset.go = n;
  };
  const enterPlace = (id) => {
    if (!world || !world.canEnter(id)) { openDrawer(id); return; }
    if (world.mode !== 'island' || insideOpen) return;
    savedY = window.scrollY;
    insideOpen = true;
    exitQueued = false;
    root.classList.add('is-visiting', 'is-inside');
    top.classList.remove('is-hidden');
    top.classList.add('is-solid'); // readable over any room
    // bring the island fully into view, then hold the page still while inside
    if (savedY > 2) scrollToY(0, syncScrollLock);
    else syncScrollLock();
    try { history.pushState({ dorrInside: id }, ''); } catch (e) {}
    world.enter(id);
  };
  // leave the place; `fromHistory` when the browser's back already popped our entry
  const exitPlace = (fromHistory) => {
    if (!world || !insideOpen) return;
    if (world.mode !== 'in') { exitQueued = true; return; }
    if (!fromHistory && history.state && history.state.dorrInside) { popGuard = true; history.back(); }
    world.exit();
  };
  ci.exit.addEventListener('click', () => exitPlace(false));
  ci.next.addEventListener('click', () => {
    const n = ci.next.dataset.go;
    if (!world || world.mode !== 'in' || !n) return;
    try { history.replaceState({ dorrInside: n }, ''); } catch (e) {}
    world.go(n);
  });
  window.addEventListener('popstate', () => {
    if (popGuard) { popGuard = false; return; }
    if (insideOpen) exitPlace(true);
  });
  const onInside = (id) => {
    fillCard(id);
    root.classList.add('is-inside-ready');
    card.inert = false;
    card.setAttribute('aria-hidden', 'false');
    try { ci.exit.focus({ preventScroll: true }); } catch (e) {}
    if (exitQueued) { exitQueued = false; exitPlace(true); }
  };
  const onLeave = () => {
    root.classList.remove('is-inside-ready');
    card.inert = true;
    card.setAttribute('aria-hidden', 'true');
  };
  const onOutside = () => {
    insideOpen = false;
    root.classList.remove('is-inside', 'is-inside-ready');
    top.classList.toggle('is-solid', window.scrollY > window.innerHeight * 0.85);
    if (!drawer.classList.contains('is-open')) root.classList.remove('is-visiting');
    syncScrollLock();
    const then = afterExit;
    afterExit = null;
    // back to where the visitor was on the page (or on to the section they picked meanwhile)
    if (then) then();
    else if (savedY > 2) scrollToY(savedY);
  };

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (insideOpen) { exitPlace(false); return; }
    if (drawer.classList.contains('is-open')) closeDrawer();
    if (sheet.classList.contains('is-open')) setSheet(false);
  });
  const pins = {};
  $$('[data-pin]').forEach((p) => {
    pins[p.dataset.pin] = p;
    p.addEventListener('click', () => enterPlace(p.dataset.pin));
  });

  /* ---------- colonnade ---------- */
  const cols = $$('.col');
  const stacked = window.matchMedia('(max-width: 960px)');
  let holdRaf = 0;
  // stacked accordion (phones): when the open panel above shrinks, keep the tapped row under the finger
  // instead of letting it slide ~340px up the screen
  const holdInPlace = (col) => {
    cancelAnimationFrame(holdRaf);
    const y0 = col.getBoundingClientRect().top;
    const until = performance.now() + 1100;
    let stop = false;
    const quit = () => { stop = true; };
    window.addEventListener('touchstart', quit, { once: true, passive: true });
    window.addEventListener('wheel', quit, { once: true, passive: true });
    const step = () => {
      if (stop || performance.now() > until) { window.removeEventListener('touchstart', quit); window.removeEventListener('wheel', quit); return; }
      const dy = col.getBoundingClientRect().top - y0;
      if (Math.abs(dy) >= 1) {
        if (lenis) lenis.scrollTo(window.scrollY + dy, { immediate: true, force: true });
        else window.scrollBy(0, dy);
      }
      holdRaf = requestAnimationFrame(step);
    };
    holdRaf = requestAnimationFrame(step);
  };
  const openCol = (col) => {
    const prev = cols.find((c) => c.classList.contains('is-open'));
    if (prev === col) return;
    if (stacked.matches && prev && cols.indexOf(prev) < cols.indexOf(col)) holdInPlace(col);
    cols.forEach((c) => {
      const on = c === col;
      c.classList.toggle('is-open', on);
      $('.col__head', c).setAttribute('aria-expanded', String(on));
    });
  };
  // hover intent: sweeping the mouse across the row no longer re-flows all eight columns on every pass
  const hoverCols = window.matchMedia('(hover: hover) and (min-width: 961px)');
  let colT = 0;
  cols.forEach((c) => {
    $('.col__head', c).addEventListener('click', () => { clearTimeout(colT); openCol(c); });
    c.addEventListener('mouseenter', () => {
      clearTimeout(colT);
      if (hoverCols.matches && !c.classList.contains('is-open')) colT = setTimeout(() => openCol(c), 110);
    });
    c.addEventListener('mouseleave', () => clearTimeout(colT));
  });

  /* ---------- contact ---------- */
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
    const body = [`Name: ${data.get('name')}`, `Company: ${data.get('company') || '—'}`, `Email: ${data.get('email')}`,
      `Interested in: ${data.getAll('topic').join(', ') || '—'}`, '', data.get('message') || ''].join('\n');
    const to = mail.textContent.trim();
    note.textContent = `Opening your email app with this message. If nothing opens, write to ${to}.`;
    location.href = `mailto:${to}?subject=${encodeURIComponent('Enquiry — DORR')}&body=${encodeURIComponent(body)}`;
  });

  /* ---------- the island ---------- */
  const stage = $('[data-stage]');
  try {
    world = window.DorrWorld ? window.DorrWorld(stage, {
      pins,
      reduced: reduce,
      onSelect: (id) => enterPlace(id),
      onInside,
      onLeave,
      onOutside,
      onHover: (id) => Object.entries(pins).forEach(([k, p]) => p.classList.toggle('is-hot', k === id)),
    }) : null;
  } catch (e) {
    world = null;
  }
  if (!world) root.classList.add('nogl');
  let saved = null;
  try { saved = localStorage.getItem('dorr-mode'); } catch (e) {}
  if (saved === 'night') setMode(true, true);

  if (world) {
    // render only while the island is on screen and the tab is visible
    let onScreen = true;
    const syncWorld = () => (onScreen && !document.hidden ? world.start() : world.stop());
    new IntersectionObserver(([en]) => { onScreen = en.isIntersecting; syncWorld(); }).observe($('[data-island]'));
    document.addEventListener('visibilitychange', syncWorld);
    syncWorld();
  }

  /* ---------- motion (skipped for reduced motion) ---------- */
  const veil = $('[data-veil]');
  if (reduce || !window.gsap || !window.ScrollTrigger) {
    veil && veil.remove();
    veilOn = false;
    if (world) world.intro().progress(1);
    // header still turns solid over the content
    let ticking = false;
    const solid = () => { ticking = false; top.classList.toggle('is-solid', window.scrollY > window.innerHeight * 0.85); };
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(solid); } }, { passive: true });
    solid();
    return;
  }
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });
  // ScrollTrigger remembers the restoration mode it saw first ("auto") and puts it back on every refresh,
  // so a reload mid-page used to jump down after load while the intro played at the top
  ScrollTrigger.clearScrollMemory('manual');

  if (window.Lenis) {
    lenis = new Lenis({
      lerp: 0.1,
      smoothWheel: true,
      // sideways trackpad swipes over the arches row (tablet widths) stay native
      virtualScroll: ({ deltaX, deltaY, event }) => !(Math.abs(deltaX) > Math.abs(deltaY) && event.target.closest && event.target.closest('.arches')),
    });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  }
  const hashTarget = location.hash.length > 1 ? document.getElementById(location.hash.slice(1)) : null;
  window.scrollTo(0, 0);
  $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const target = $(a.getAttribute('href'));
    if (!target || !lenis) return;
    e.preventDefault();
    // inside a place: step out first, then travel to the section
    if (insideOpen) {
      afterExit = () => lenis.scrollTo(target, { duration: 1.8 });
      exitPlace(false);
      return;
    }
    lenis.scrollTo(target, { duration: 1.8 });
  }));

  // header
  ScrollTrigger.create({
    start: () => window.innerHeight * 0.85, end: 'max',
    onToggle: (self) => top.classList.toggle('is-solid', self.isActive),
  });
  if (lenis) {
    lenis.on('scroll', ({ direction, scroll }) => {
      if (sheet.classList.contains('is-open')) return;
      if (direction === 1 && scroll > window.innerHeight) top.classList.add('is-hidden');
      else if (direction === -1) top.classList.remove('is-hidden');
    });
  }

  // reveals
  const lineReveal = (el, delay) => gsap.fromTo($$('.ln > span', el), { yPercent: 105 }, { yPercent: 0, duration: 1.4, stagger: 0.1, ease: 'expo.out', delay: delay || 0 });
  const titleLines = $$('.island__title .ln > span');
  gsap.set(titleLines, { yPercent: 105 });
  gsap.set('.island__copy .script, [data-island-hint], .top', { autoAlpha: 0 });
  $$('[data-lines]').forEach((el) => {
    if (el.closest('.island')) return;
    gsap.set($$('.ln > span', el), { yPercent: 105 });
    ScrollTrigger.create({ trigger: el, start: 'top 85%', once: true, onEnter: () => lineReveal(el) });
  });
  const rises = $$('[data-rise]');
  gsap.set(rises, { autoAlpha: 0, y: 36 });
  ScrollTrigger.batch(rises, { start: 'top 90%', once: true, onEnter: (els) => gsap.to(els, { autoAlpha: 1, y: 0, duration: 1.2, stagger: 0.1, ease: 'expo.out' }) });
  gsap.from('.arches li', { yPercent: 18, autoAlpha: 0, duration: 1.4, stagger: 0.1, ease: 'expo.out', scrollTrigger: { trigger: '.arches', start: 'top 82%', once: true } });
  gsap.from('.col', { yPercent: 12, autoAlpha: 0, duration: 1.2, stagger: 0.06, ease: 'expo.out', scrollTrigger: { trigger: '.colonnade', start: 'top 82%', once: true } });

  // scroll-linked
  gsap.to('[data-ring]', { rotation: 140, transformOrigin: '50% 50%', ease: 'none', scrollTrigger: { trigger: '.group', start: 'top bottom', end: 'bottom top', scrub: true } });
  gsap.fromTo('[data-vision-img] img', { yPercent: -6 }, { yPercent: 6, ease: 'none', scrollTrigger: { trigger: '[data-vision-img]', start: 'top bottom', end: 'bottom top', scrub: true } });
  gsap.fromTo('.foot__mark', { yPercent: 30 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: '.foot', start: 'top bottom', end: 'bottom bottom', scrub: true } });
  if (world) {
    // the pins layer moves with the canvas, otherwise the labels slide off their buildings while scrolling
    gsap.to('[data-stage], [data-pins]', { yPercent: 14, ease: 'none', scrollTrigger: { trigger: '[data-island]', start: 'top top', end: 'bottom top', scrub: true } });
  }

  // loading veil → island intro
  const num = $('[data-veil-num]');
  const v = { n: 0 };
  gsap.timeline()
    .to(v, { n: 100, duration: 1.2, ease: 'power2.inOut', onUpdate: () => { num.textContent = Math.round(v.n); } })
    .to(veil, { autoAlpha: 0, duration: 0.8, ease: 'power2.out' })
    .add(() => {
      veil.remove();
      veilOn = false;
      syncScrollLock();
      ScrollTrigger.refresh();
      if (hashTarget && lenis) lenis.scrollTo(hashTarget, { immediate: true, force: true });
      if (world) world.intro();
    }, '-=0.6')
    .to(titleLines, { yPercent: 0, duration: 1.5, stagger: 0.12, ease: 'expo.out' }, '+=1.4')
    // inline opacity is cleared afterwards so the CSS states (.is-visiting) can hide the hint again
    .to('.island__copy .script, [data-island-hint], .top', { autoAlpha: 1, duration: 1.2, stagger: 0.1, clearProps: 'opacity,visibility' }, '<0.2');

  // late layout changes (web fonts swapping in, images) move trigger positions: re-measure
  window.addEventListener('load', () => ScrollTrigger.refresh());
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
})();
