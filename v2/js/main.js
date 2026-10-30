/* DORR v2 — scenes and interaction.
   Loader → particle intro → hero ring/aperture → chapters → orbit → disciplines → vision. */
(() => {
  const root = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  /* ---------------------------------------------------------- text splitting */
  const walkText = (el, wrapWord) => {
    [...el.childNodes].forEach((node) => {
      if (node.nodeType === 3) {
        const frag = document.createDocumentFragment();
        node.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          frag.appendChild(/^\s+$/.test(part) ? document.createTextNode(' ') : wrapWord(part));
        });
        node.replaceWith(frag);
      } else if (node.nodeType === 1 && node.tagName !== 'BR') {
        walkText(node, wrapWord);
      }
    });
  };
  const charWord = (word) => {
    const w = document.createElement('span');
    w.className = 'w';
    [...word].forEach((ch) => {
      const c = document.createElement('span');
      c.className = 'c';
      c.textContent = ch;
      w.appendChild(c);
    });
    return w;
  };
  $$('[data-chars]').forEach((el) => walkText(el, charWord));
  $$('[data-words], [data-vision-quote]').forEach((el) => walkText(el, (word) => {
    const s = document.createElement('span');
    s.className = 'sw';
    s.textContent = word;
    return s;
  }));
  const mark = $('[data-ftr-mark]');
  if (mark) mark.innerHTML = [...mark.textContent].map((c) => `<span class="c">${c}</span>`).join('');

  /* --------------------------------------------------------------- basic UI */
  const burger = $('[data-burger]');
  const mnav = $('[data-mnav]');
  let lenis = null;
  const setMenu = (open) => {
    mnav.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.textContent = open ? 'Close' : 'Menu';
    if (lenis) open ? lenis.stop() : lenis.start();
  };
  burger?.addEventListener('click', () => setMenu(!mnav.classList.contains('is-open')));
  $$('a', mnav).forEach((a) => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && mnav.classList.contains('is-open')) setMenu(false); });

  const mailEl = $('[data-mail]');
  $('[data-copy]')?.addEventListener('click', (e) => {
    const btn = e.currentTarget;
    const text = mailEl.textContent.trim();
    const done = () => { btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = 'Copy email'; }, 1800); };
    const fallback = () => {
      const range = document.createRange();
      range.selectNodeContents(mailEl);
      const sel = window.getSelection();
      sel.removeAllRanges(); sel.addRange(range);
      btn.textContent = 'Selected, press Ctrl+C';
    };
    try { navigator.clipboard.writeText(text).then(done, fallback); } catch (err) { fallback(); }
  });

  const form = $('[data-form]');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const note = $('[data-form-note]');
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
    const to = mailEl.textContent.trim();
    note.textContent = `Opening your email app with this message. If nothing opens, write to ${to}.`;
    location.href = `mailto:${to}?subject=${encodeURIComponent('Enquiry — DORR')}&body=${encodeURIComponent(body)}`;
  });

  /* ------------------------------------------------------ static fallback */
  const loader = $('[data-loader]');
  if (reduce || !window.gsap || !window.ScrollTrigger) {
    root.classList.add('rm');
    loader?.remove();
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });
  const mobile = () => window.innerWidth < 700;

  /* ------------------------------------------------------- smooth scroll */
  if (window.Lenis) {
    lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  }
  window.scrollTo(0, 0);
  $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    const target = id === '#top' ? 0 : $(id);
    if (target === null || !lenis) return;
    e.preventDefault();
    lenis.scrollTo(target, { duration: 1.8 });
  }));

  /* ---------------------------------------------------------------- cursor */
  const cursor = $('[data-cursor]');
  if (fine && cursor) {
    const cx = gsap.quickTo(cursor, 'x', { duration: 0.35, ease: 'power3' });
    const cy = gsap.quickTo(cursor, 'y', { duration: 0.35, ease: 'power3' });
    const label = $('[data-cursor-label]');
    $('[data-hero-pin]').dataset.cursorText = 'Move';
    window.addEventListener('pointermove', (e) => { cursor.classList.add('is-on'); cx(e.clientX); cy(e.clientY); }, { passive: true });
    document.addEventListener('pointerleave', () => cursor.classList.remove('is-on'));
    document.addEventListener('pointerover', (e) => {
      const link = e.target.closest('a, button, label, input, textarea');
      const lab = !link && e.target.closest('[data-cursor-text]');
      cursor.classList.toggle('is-link', !!link);
      cursor.classList.toggle('is-label', !!lab);
      label.textContent = lab ? lab.dataset.cursorText : '';
    });
  }

  /* ---------------------------------------------------------------- header */
  const hdr = $('[data-hdr]');
  gsap.set(hdr, { autoAlpha: 0 });
  if (lenis) {
    lenis.on('scroll', ({ direction, scroll }) => {
      if (mnav.classList.contains('is-open')) return;
      if (direction === 1 && scroll > 240) hdr.classList.add('is-hidden');
      else if (direction === -1) hdr.classList.remove('is-hidden');
    });
  }

  /* ---------------------------------------------------------------- loader */
  const num = $('[data-loader-num]');
  const bar = $('[data-loader-bar]');
  const load = { v: 0 };
  const paint = () => { num.textContent = Math.round(load.v); bar.style.transform = `scaleX(${load.v / 100})`; };
  const pre = gsap.to(load, { v: 82, duration: 1.4, ease: 'power2.out', onUpdate: paint });
  const heroImg = $('[data-aperture-img]');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const fontsReady = document.fonts
    ? Promise.race([document.fonts.load('400 120px "Bodoni Moda"').then(() => document.fonts.ready), wait(3000)])
    : Promise.resolve();
  const imgReady = heroImg.complete ? Promise.resolve() : new Promise((r) => {
    heroImg.addEventListener('load', r, { once: true });
    heroImg.addEventListener('error', r, { once: true });
  });

  Promise.all([fontsReady, Promise.race([imgReady, wait(4000)]), wait(1400)]).then(() => {
    const intro = init();
    pre.kill();
    gsap.timeline()
      .to(load, { v: 100, duration: 0.5, ease: 'power2.inOut', onUpdate: paint })
      .to(loader, { yPercent: -100, duration: 1.2, ease: 'expo.inOut' }, '+=0.1')
      .add(() => { loader.remove(); if (lenis) lenis.start(); ScrollTrigger.refresh(); })
      .add(intro, '-=0.7');
  });

  /* ================================================================ scenes */
  function init() {
    /* ---------- hero: particles → DORR → ring → room ---------- */
    const ringRadius = (w, h) => Math.min(w, h) * (w < 700 ? 0.36 : 0.25);
    let P = null;
    try { P = window.DorrParticles ? window.DorrParticles($('[data-canvas]'), { ringRadius }) : null; } catch (e) { P = null; }
    if (P) root.classList.add('gl');
    const hs = P ? P.state : { intro: 0, morph: 0, scale: 1, alpha: 1 };
    const ringR = () => (P ? P.ringRadius() : ringRadius(innerWidth, innerHeight));
    const aperture = $('[data-aperture]');
    const ap = { k: 0, s: 1 };
    const applyHero = () => {
      aperture.style.setProperty('--r', `${ringR() * ap.s * ap.k}px`);
      hs.scale = ap.s;
    };
    const endScale = () => (Math.hypot(innerWidth / 2, innerHeight / 2) * 1.04) / ringR();

    gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: '[data-hero]', start: 'top top', end: '+=200%', scrub: 1, pin: '[data-hero-pin]', invalidateOnRefresh: true, onRefresh: applyHero },
    })
      .to(hs, { morph: 1, duration: 0.36 }, 0)
      .to('[data-hero-fade]', { autoAlpha: 0, y: -30, duration: 0.18 }, 0)
      .to('.hero__fallback', { opacity: 0, duration: 0.2 }, 0)
      .to(ap, { k: 1, duration: 0.2, onUpdate: applyHero }, 0.3)
      .fromTo(heroImg, { scale: 1.3 }, { scale: 1, duration: 0.7 }, 0.3)
      .to(ap, { s: () => endScale(), duration: 0.5, ease: 'power1.in', onUpdate: applyHero }, 0.5)
      .to(hs, { alpha: 0, duration: 0.22 }, 0.74);

    if (P) {
      ScrollTrigger.create({
        trigger: '[data-hero]', start: 'top bottom', end: 'bottom top',
        onToggle: (self) => (self.isActive ? P.start() : P.stop()),
      });
      P.start();
    }

    const heroChars = $$('.hero__title .c');
    gsap.set(heroChars, { yPercent: 115, rotate: 8 });
    gsap.set('.hero [data-reveal], .hero__top', { autoAlpha: 0, y: 20 });
    const intro = () => {
      gsap.timeline()
        .to(hs, { intro: 1, duration: 3, ease: 'power2.inOut' }, 0)
        .to('.hero__top', { autoAlpha: 1, y: 0, duration: 1.2, ease: 'expo.out' }, 1.4)
        .to(heroChars, { yPercent: 0, rotate: 0, duration: 1.3, stagger: 0.018, ease: 'expo.out' }, 1.5)
        .to('.hero [data-reveal]', { autoAlpha: 1, y: 0, duration: 1.2, stagger: 0.12, ease: 'expo.out' }, 1.9)
        .to(hdr, { autoAlpha: 1, duration: 1.2 }, 1.8);
    };

    /* ---------- marquee: velocity driven ---------- */
    const track = $('[data-marquee-track]');
    if (track) {
      const set = track.firstElementChild;
      let x = 0, dir = 1, visible = false;
      new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe(track);
      gsap.ticker.add((t, dt) => {
        if (!visible) return;
        const v = lenis ? lenis.velocity : 0;
        if (lenis && lenis.direction) dir = lenis.direction;
        x -= (0.05 + Math.min(Math.abs(v) * 0.05, 1.6)) * dir * dt;
        const w = set.offsetWidth;
        if (x <= -w) x += w;
        if (x > 0) x -= w;
        track.style.transform = `translate3d(${x}px,0,0)`;
      });
    }

    /* ---------- chapters ---------- */
    const chs = $$('[data-chapter]');
    if (chs.length) {
      const fitNames = () => {
        $$('.chapter__name').forEach((el) => {
          el.style.fontSize = '100px';
          const w = el.scrollWidth;
          const size = Math.min((innerWidth * 0.9 * 100) / w, innerHeight * 0.48);
          el.style.fontSize = `${size}px`;
        });
      };
      fitNames();
      ScrollTrigger.addEventListener('refreshInit', fitNames);
      gsap.set(chs.slice(1), { clipPath: 'inset(100% 0% 0% 0%)' });
      const brandCount = chs.length - 1;
      const starts = [];
      const chNum = $('[data-ch-num]');
      const chBar = $('[data-ch-bar]');
      const tl = gsap.timeline({ defaults: { ease: 'none' } });
      chs.forEach((c, i) => {
        if (i > 0) {
          tl.to(c, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1, ease: 'power2.inOut' });
          tl.to(chs[i - 1], { yPercent: -14, duration: 1, ease: 'power2.inOut' }, '<');
        }
        starts.push(tl.duration());
        if (c.classList.contains('chapter--end')) {
          tl.fromTo($$('.chapter__more, .chapter__note', c), { autoAlpha: 0, y: 50 }, { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.2, ease: 'power3.out' }, '-=0.4');
          tl.to({}, { duration: 0.6 });
          return;
        }
        const name = $('.chapter__name', c);
        const wrap = $('.chapter__img', c);
        const img = $('img', wrap);
        const meta = $('.chapter__meta', c);
        if (i > 0) tl.fromTo(name, { clipPath: 'inset(0% 0% 100% 0%)', yPercent: 14 }, { clipPath: 'inset(0% 0% 0% 0%)', yPercent: 0, duration: 0.8, ease: 'power3.out' }, '-=0.3');
        tl.to({}, { duration: 0.35 });
        tl.fromTo(wrap, { clipPath: 'circle(0% at 50% 50%)' }, { clipPath: 'circle(75% at 50% 50%)', duration: 1.2, ease: 'power2.in' });
        tl.fromTo(img, { scale: 1.4 }, { scale: 1, duration: 1.7, ease: 'power2.out' }, '<');
        tl.to(name, { scale: 1.2, autoAlpha: 0, duration: 0.9 }, '<0.35');
        tl.fromTo(meta, { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power3.out' }, '-=0.45');
        tl.to({}, { duration: 0.6 });
      });
      ScrollTrigger.create({
        trigger: '[data-chapters]', start: 'top top', end: () => `+=${innerHeight * chs.length * 1.15}`,
        pin: '[data-chapters-pin]', scrub: 1, animation: tl, invalidateOnRefresh: true,
        onUpdate: (self) => {
          const t = self.progress * tl.duration();
          let idx = 0;
          starts.forEach((s, k) => { if (t >= s - 0.01) idx = k; });
          chNum.textContent = String(Math.min(idx + 1, brandCount)).padStart(2, '0');
          chBar.style.transform = `scaleX(${self.progress})`;
        },
      });
    }

    /* ---------- orbit ---------- */
    const orbs = $$('[data-orb]');
    if (orbs.length) {
      const n = orbs.length;
      const step = 360 / n;
      const ellipse = $('[data-orbit-path] ellipse');
      const cap = { k: $('[data-oc-k]'), t: $('[data-oc-t]'), d: $('[data-oc-d]') };
      const capBox = $('[data-orbit-caption]');
      const o = { rot: 0 };
      let Rx = 0, Ry = 0, front = 0;
      const measure = () => {
        Rx = mobile() ? innerWidth * 0.34 : Math.min(innerWidth * 0.34, 560);
        Ry = Rx * (mobile() ? 0.62 : 0.3);
        ellipse.setAttribute('rx', Rx);
        ellipse.setAttribute('ry', Ry);
      };
      const place = () => {
        orbs.forEach((orb, i) => {
          const th = ((90 + i * step + o.rot) * Math.PI) / 180;
          const depth = (Math.sin(th) + 1) / 2;
          orb.style.transform = `translate3d(${Math.cos(th) * Rx}px, ${Math.sin(th) * Ry}px, 0) scale(${0.42 + 0.78 * depth})`;
          orb.style.zIndex = String(10 + Math.round(depth * 100));
          orb.style.opacity = String(0.3 + 0.7 * depth);
          orb.style.filter = `grayscale(${(1 - depth).toFixed(2)}) brightness(${(0.5 + 0.5 * depth).toFixed(2)})`;
        });
        const f = ((Math.round(-o.rot / step) % n) + n) % n;
        if (f !== front) {
          orbs[front].classList.remove('is-front');
          front = f;
          orbs[f].classList.add('is-front');
          const d = orbs[f].dataset;
          gsap.timeline()
            .to(capBox, { autoAlpha: 0, y: 12, duration: 0.2, ease: 'power2.in' })
            .add(() => { cap.k.textContent = d.k; cap.t.textContent = d.t; cap.d.textContent = d.d; })
            .to(capBox, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'expo.out' });
        }
      };
      $('.orbit__core').style.zIndex = '60';
      orbs[0].classList.add('is-front');
      measure(); place();
      ScrollTrigger.addEventListener('refresh', () => { measure(); place(); });
      gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: '[data-orbit]', start: 'top top', end: () => `+=${innerHeight * 3.6}`, pin: '[data-orbit-pin]', scrub: 1, invalidateOnRefresh: true },
      })
        .to({}, { duration: 0.12 })
        .to(o, { rot: -(n - 1) * step, duration: 1, onUpdate: place })
        .to({}, { duration: 0.12 });
    }

    /* ---------- disciplines: sticky frame ---------- */
    const items = $$('[data-disc]');
    const stack = $$('[data-disc-stack] img');
    const discNum = $('[data-disc-num]');
    if (items.length && stack.length) {
      let cur = 0, z = 2;
      items[0].classList.add('is-active');
      const activate = (i) => {
        if (i === cur) return;
        const forward = i > cur;
        items[cur].classList.remove('is-active');
        items[i].classList.add('is-active');
        cur = i;
        discNum.textContent = String(i + 1).padStart(2, '0');
        const img = stack[i];
        img.style.zIndex = String(++z);
        gsap.fromTo(img, { clipPath: forward ? 'inset(100% 0% 0% 0%)' : 'inset(0% 0% 100% 0%)', scale: 1.18 },
          { clipPath: 'inset(0% 0% 0% 0%)', scale: 1, duration: 1.1, ease: 'expo.out', overwrite: true });
      };
      const mm = gsap.matchMedia();
      mm.add('(min-width: 961px)', () => {
        items.forEach((item, i) => {
          ScrollTrigger.create({ trigger: item, start: 'top 55%', end: 'bottom 55%', onEnter: () => activate(i), onEnterBack: () => activate(i) });
        });
      });
    }

    /* ---------- vision: image closes into a circle ---------- */
    const vimg = $('[data-vision-img]');
    if (vimg) {
      const vr = { p: 0 };
      const big = () => Math.hypot(innerWidth, innerHeight);
      const small = () => Math.min(innerWidth, innerHeight) * (mobile() ? 0.3 : 0.27);
      const applyV = () => vimg.style.setProperty('--vr', `${big() + (small() - big()) * vr.p}px`);
      applyV();
      gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: '[data-vision]', start: 'top top', end: '+=170%', pin: '[data-vision-pin]', scrub: 1, invalidateOnRefresh: true, onRefresh: applyV },
      })
        .to($$('[data-vision-quote] .sw'), { opacity: 1, stagger: 0.04, duration: 0.3 }, 0)
        .to(vr, { p: 1, duration: 0.55, ease: 'power2.inOut', onUpdate: applyV }, 0.4)
        .fromTo($('img', vimg), { scale: 1.12 }, { scale: 1, duration: 0.95 }, 0);
    }

    /* ---------- generic reveals (created after the pins so their positions include pin spacing) ---------- */
    $$('[data-chars]').forEach((el) => {
      if (el.closest('.hero')) return;
      const chars = $$('.c', el);
      gsap.set(chars, { yPercent: 115, rotate: 8 });
      ScrollTrigger.create({
        trigger: el, start: 'top 86%', once: true,
        onEnter: () => gsap.to(chars, { yPercent: 0, rotate: 0, duration: 1.3, stagger: 0.02, ease: 'expo.out' }),
      });
    });
    const reveals = $$('[data-reveal]').filter((el) => !el.closest('.hero'));
    gsap.set(reveals, { autoAlpha: 0, y: 32 });
    ScrollTrigger.batch(reveals, {
      start: 'top 90%', once: true,
      onEnter: (els) => gsap.to(els, { autoAlpha: 1, y: 0, duration: 1.2, stagger: 0.1, ease: 'expo.out' }),
    });
    $$('[data-words]').forEach((el) => {
      gsap.to($$('.sw', el), { opacity: 1, stagger: 0.1, ease: 'none', scrollTrigger: { trigger: el, start: 'top 80%', end: 'bottom 55%', scrub: true } });
    });

    /* ---------- footer mark ---------- */
    gsap.fromTo('[data-ftr-mark] .c', { yPercent: 100 }, {
      yPercent: 0, stagger: 0.08, ease: 'none',
      scrollTrigger: { trigger: '.ftr', start: 'top 85%', end: 'bottom bottom', scrub: true },
    });

    window.addEventListener('load', () => ScrollTrigger.refresh());
    return intro;
  }
})();
