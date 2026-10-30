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
  const setMode = (night) => {
    root.dataset.mode = night ? 'night' : 'day';
    modeBtn.setAttribute('aria-pressed', String(night));
    modeLabel.textContent = night ? 'Day' : 'Night';
    themeMeta.setAttribute('content', night ? '#121828' : '#f8f3ea');
    if (world) world.setNight(night);
    try { localStorage.setItem('dorr-mode', night ? 'night' : 'day'); } catch (e) {}
  };
  modeBtn.addEventListener('click', () => setMode(root.dataset.mode !== 'night'));

  /* ---------- mobile sheet ---------- */
  const burger = $('[data-burger]');
  const sheet = $('[data-sheet]');
  let lenis = null;
  const setSheet = (open) => {
    sheet.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.textContent = open ? 'Close' : 'Menu';
    if (lenis) open ? lenis.stop() : lenis.start();
  };
  burger.addEventListener('click', () => setSheet(!sheet.classList.contains('is-open')));
  $$('a', sheet).forEach((a) => a.addEventListener('click', () => setSheet(false)));

  /* ---------- drawer ---------- */
  const drawer = $('[data-drawer]');
  const d = { img: $('[data-d-img]'), kind: $('[data-d-kind]'), name: $('[data-d-name]'), text: $('[data-d-text]'), count: $('[data-d-count]') };
  let current = null;
  const islandInView = () => window.scrollY < window.innerHeight * 0.5;
  const fill = (id) => {
    const p = PLACES[id];
    d.img.src = p.img; d.img.alt = p.name;
    d.kind.textContent = p.kind; d.name.textContent = p.name; d.text.textContent = p.text;
    d.count.textContent = `${ORDER.indexOf(id) + 1} / ${ORDER.length}`;
  };
  const openDrawer = (id) => {
    if (!PLACES[id]) return;
    const swap = current && drawer.classList.contains('is-open');
    current = id;
    if (swap && window.gsap) {
      gsap.timeline()
        .to(drawer.children, { autoAlpha: 0, y: 10, duration: 0.25, stagger: 0.02 })
        .add(() => fill(id))
        .to(drawer.children, { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.03, ease: 'power3.out' });
    } else {
      fill(id);
    }
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    root.classList.add('is-visiting');
    if (world && islandInView()) world.select(id);
  };
  const closeDrawer = () => {
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    root.classList.remove('is-visiting');
    current = null;
    if (world) world.release();
  };
  $('[data-drawer-close]').addEventListener('click', closeDrawer);
  $('[data-d-next]').addEventListener('click', () => openDrawer(ORDER[(ORDER.indexOf(current) + 1) % ORDER.length]));
  $('[data-d-prev]').addEventListener('click', () => openDrawer(ORDER[(ORDER.indexOf(current) - 1 + ORDER.length) % ORDER.length]));
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (drawer.classList.contains('is-open')) closeDrawer();
    if (sheet.classList.contains('is-open')) setSheet(false);
  });
  $$('[data-open]').forEach((b) => b.addEventListener('click', () => openDrawer(b.dataset.open)));
  const pins = {};
  $$('[data-pin]').forEach((p) => {
    pins[p.dataset.pin] = p;
    p.addEventListener('click', () => openDrawer(p.dataset.pin));
  });

  /* ---------- colonnade ---------- */
  const cols = $$('.col');
  const openCol = (col) => {
    cols.forEach((c) => {
      const on = c === col;
      c.classList.toggle('is-open', on);
      $('.col__head', c).setAttribute('aria-expanded', String(on));
    });
  };
  cols.forEach((c) => {
    $('.col__head', c).addEventListener('click', () => openCol(c));
    c.addEventListener('mouseenter', () => { if (window.matchMedia('(hover: hover) and (min-width: 961px)').matches) openCol(c); });
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
      onSelect: (id) => openDrawer(id),
      onHover: (id) => Object.entries(pins).forEach(([k, p]) => p.classList.toggle('is-hot', k === id)),
    }) : null;
  } catch (e) {
    world = null;
  }
  if (!world) root.classList.add('nogl');
  let saved = null;
  try { saved = localStorage.getItem('dorr-mode'); } catch (e) {}
  if (saved === 'night') setMode(true);

  if (world) {
    world.start();
    new IntersectionObserver(([en]) => (en.isIntersecting ? world.start() : world.stop())).observe($('[data-island]'));
  }

  /* ---------- motion (skipped for reduced motion) ---------- */
  const veil = $('[data-veil]');
  if (reduce || !window.gsap || !window.ScrollTrigger) {
    veil && veil.remove();
    if (world) world.intro().progress(1);
    return;
  }
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  if (window.Lenis) {
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  }
  window.scrollTo(0, 0);
  $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const target = $(a.getAttribute('href'));
    if (!target || !lenis) return;
    e.preventDefault();
    lenis.scrollTo(target, { duration: 1.8 });
  }));

  // header
  const top = $('[data-top]');
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
    gsap.to('[data-stage]', { yPercent: 14, ease: 'none', scrollTrigger: { trigger: '[data-island]', start: 'top top', end: 'bottom top', scrub: true } });
  }

  // loading veil → island intro
  const num = $('[data-veil-num]');
  const v = { n: 0 };
  gsap.timeline()
    .to(v, { n: 100, duration: 1.2, ease: 'power2.inOut', onUpdate: () => { num.textContent = Math.round(v.n); } })
    .to(veil, { autoAlpha: 0, duration: 0.8, ease: 'power2.out' })
    .add(() => {
      veil.remove();
      if (lenis) lenis.start();
      ScrollTrigger.refresh();
      if (world) world.intro();
    }, '-=0.6')
    .to(titleLines, { yPercent: 0, duration: 1.5, stagger: 0.12, ease: 'expo.out' }, '+=1.4')
    .to('.island__copy .script, [data-island-hint], .top', { autoAlpha: 1, duration: 1.2, stagger: 0.1 }, '<0.2');

  window.addEventListener('load', () => ScrollTrigger.refresh());
})();
