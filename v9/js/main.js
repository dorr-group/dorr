/* DORR — Version 9 · main.js (written for v9)
   GSAP + ScrollTrigger + Lenis; transform/opacity only; content visible without JS. */
(function () {
  'use strict';

  var doc = document.documentElement;
  var reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  var reduce = reduceMQ.matches;
  var hasGSAP = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  var motion = !reduce && hasGSAP;
  if (!motion) doc.classList.remove('motion');

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---------- veil: race readiness with a 4 s timeout; never block on the film ---------- */
  var veil = $('#veil');
  function liftVeil() {
    if (!veil || veil.classList.contains('is-gone')) return;
    veil.classList.add('is-gone');
    setTimeout(function () { if (veil && veil.parentNode) veil.parentNode.removeChild(veil); }, 1300);
  }
  var poster = $('.film__poster');
  var ready = [];
  if (document.fonts && document.fonts.ready) ready.push(document.fonts.ready);
  if (poster && !poster.complete) {
    ready.push(new Promise(function (res) { poster.addEventListener('load', res, { once: true }); poster.addEventListener('error', res, { once: true }); }));
  }
  Promise.race([
    Promise.all(ready),
    new Promise(function (res) { setTimeout(res, 4000); })
  ]).then(function () { requestAnimationFrame(function () { setTimeout(liftVeil, 250); }); }, liftVeil);

  /* ---------- smooth scroll (Lenis driven by GSAP's ticker) ---------- */
  var lenis = null;
  if (motion && typeof window.Lenis !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true });
    lenis = new Lenis({ lerp: 0.085, smoothWheel: true, syncTouch: false, wheelMultiplier: 0.9 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
    window.__dorrLenis = lenis;
  } else if (hasGSAP) {
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true });
  }

  function scrollToTarget(target) {
    if (!target) return;
    if (lenis) lenis.scrollTo(target, { offset: 0, duration: 1.8, easing: function (t) { return 1 - Math.pow(1 - t, 3); } });
    else target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }
  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      if (id.length < 2) return;
      var t = document.getElementById(id.slice(1));
      if (!t) return;
      e.preventDefault();
      closeIndex(false);
      scrollToTarget(t);
      if (history.replaceState) history.replaceState(null, '', id);
      t.setAttribute('tabindex', '-1');
      setTimeout(function () { t.focus({ preventScroll: true }); }, 900);
    });
  });

  /* ---------- header: solid backing once scrolling; hide on the way down ---------- */
  var header = $('#header');
  var lastY = window.scrollY || 0;
  var filmEl = $('.film');
  function onScrollY(y) {
    // transparent only while the film is beneath it; a linen backing everywhere else
    var solidAt = filmEl ? Math.max(40, filmEl.offsetHeight - header.offsetHeight - 140) : 40;
    header.classList.toggle('is-solid', y >= solidAt);
    var down = y > lastY + 2, up = y < lastY - 2;
    if (y > solidAt + 160 && down) header.classList.add('is-hidden');
    else if (up || y < solidAt) header.classList.remove('is-hidden');
    lastY = y;
  }
  if (lenis) lenis.on('scroll', function (e) { onScrollY(e.scroll); });
  else window.addEventListener('scroll', function () { onScrollY(window.scrollY); }, { passive: true });
  onScrollY(window.scrollY || 0);

  /* ---------- index overlay ---------- */
  var index = $('#index'), openBtn = $('#indexOpen'), closeBtn = $('#indexClose');
  var lastFocus = null;
  function openIndex() {
    lastFocus = document.activeElement;
    index.classList.add('is-open');
    index.setAttribute('aria-hidden', 'false');
    openBtn.setAttribute('aria-expanded', 'true');
    if (lenis) lenis.stop();
    setTimeout(function () { var f = $('.index__list a', index); if (f) f.focus(); }, 60);
  }
  function closeIndex(restore) {
    if (!index.classList.contains('is-open')) return;
    index.classList.remove('is-open');
    index.setAttribute('aria-hidden', 'true');
    openBtn.setAttribute('aria-expanded', 'false');
    if (lenis) lenis.start();
    if (restore !== false && lastFocus) lastFocus.focus();
  }
  openBtn.addEventListener('click', openIndex);
  closeBtn.addEventListener('click', function () { closeIndex(true); });
  document.addEventListener('keydown', function (e) {
    if (!index.classList.contains('is-open')) return;
    if (e.key === 'Escape') closeIndex(true);
    if (e.key === 'Tab') {
      var f = $$('a, button', index);
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* ---------- the film ---------- */
  var film = $('#film');
  var filmSection = $('.film');
  var filmToggle = $('#filmToggle');
  var filmPlayBtn = $('#filmPlay');
  var userPaused = false;
  var filmVisible = true;

  function markPlaying() { film.classList.add('is-playing'); }
  function setPausedUI(p) {
    filmToggle.classList.toggle('is-paused', p);
    filmToggle.setAttribute('aria-pressed', p ? 'true' : 'false');
    $('.ctl__label', filmToggle).textContent = p ? 'Play' : 'Pause';
  }
  function hasSource() { return !!film.querySelector('source'); }
  function tryPlay() {
    if (!hasSource()) return;
    film.muted = true;
    var p = film.play();
    if (p && p.catch) p.catch(function () { /* autoplay refused: poster stays, play button available */ filmSection.classList.add('is-still'); setPausedUI(true); });
  }
  function loadStill(reason) {
    filmSection.classList.add('is-still');
    setPausedUI(true);
  }
  function startFromButton() {
    if (!hasSource()) {
      var phone = window.matchMedia('(max-width: 700px) and (orientation: portrait)').matches;
      var list = phone ? [[film.dataset.phoneWebm, 'video/webm'], [film.dataset.phoneMp4, 'video/mp4']]
                       : [[film.dataset.deskWebm, 'video/webm'], [film.dataset.deskMp4, 'video/mp4']];
      list.forEach(function (it) { var s = document.createElement('source'); s.src = it[0]; s.type = it[1]; film.appendChild(s); });
      film.preload = 'auto';
      film.load();
    }
    filmSection.classList.remove('is-still');
    userPaused = false;
    setPausedUI(false);
    tryPlay();
  }
  if (film) {
    film.addEventListener('playing', markPlaying);
    // a failed <source> fires error on the source element; only give up when the last one fails
    var srcs = film.querySelectorAll('source');
    if (srcs.length) srcs[srcs.length - 1].addEventListener('error', function () { loadStill('error'); });
    if (film.getAttribute('data-still')) loadStill(film.getAttribute('data-still'));
    else tryPlay();
    filmPlayBtn.addEventListener('click', startFromButton);
    filmToggle.addEventListener('click', function () {
      if (filmSection.classList.contains('is-still') || film.paused) {
        userPaused = false;
        if (!hasSource()) { startFromButton(); return; }
        filmSection.classList.remove('is-still');
        setPausedUI(false); tryPlay();
      } else {
        userPaused = true; film.pause(); setPausedUI(true);
      }
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          filmVisible = en.isIntersecting;
          if (!filmVisible) { if (!film.paused) film.pause(); }
          else if (!userPaused && !filmSection.classList.contains('is-still')) tryPlay();
          duckAudio();
        });
      }, { threshold: 0.02 }).observe(filmSection);
    }
  }

  /* ---------- ambient sound: starts off; gentle fades; pauses when the tab is hidden ---------- */
  var audio = $('#ambience');
  var soundBtn = $('#soundToggle');
  var soundOn = false;
  var fadeRAF = 0;
  var MAX_VOL = 0.55;
  function fadeTo(target, ms, done) {
    cancelAnimationFrame(fadeRAF);
    var from = audio.volume, t0 = performance.now();
    if (reduce) ms = Math.min(ms, 300);
    (function step(now) {
      var k = Math.min(1, (now - t0) / ms);
      var e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      audio.volume = Math.max(0, Math.min(1, from + (target - from) * e));
      if (k < 1) fadeRAF = requestAnimationFrame(step); else if (done) done();
    })(t0);
  }
  function targetVol() { return filmVisible ? MAX_VOL : MAX_VOL * 0.4; }
  function duckAudio() { if (soundOn && !audio.paused) fadeTo(targetVol(), 1600); }
  function setSoundUI(on) {
    soundBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    $('.ctl__label', soundBtn).textContent = on ? 'Sound on' : 'Sound off';
    filmSection.classList.toggle('is-sound', on && !reduce);
  }
  if (audio && soundBtn) {
    soundBtn.addEventListener('click', function () {
      if (!soundOn) {
        soundOn = true; setSoundUI(true);
        audio.volume = 0;
        var p = audio.play();
        if (p && p.then) p.then(function () { fadeTo(targetVol(), 2600); }, function () { soundOn = false; setSoundUI(false); });
        else fadeTo(targetVol(), 2600);
      } else {
        soundOn = false; setSoundUI(false);
        fadeTo(0, 1400, function () { audio.pause(); });
      }
    });
  }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      if (film && !film.paused) film.pause();
      if (audio && !audio.paused) audio.pause();
      if (dusk && !dusk.paused) dusk.pause();
    } else {
      if (film && filmVisible && !userPaused && !filmSection.classList.contains('is-still')) tryPlay();
      if (audio && soundOn) { audio.volume = 0; audio.play().then(function () { fadeTo(targetVol(), 1800); }, function () {}); }
      if (dusk && duskVisible && duskLoaded) dusk.play().catch(function () {});
    }
  });

  /* ---------- dusk interlude clip: loads only near view, plays only on screen ---------- */
  var dusk = $('#dusk');
  var duskVisible = false, duskLoaded = false;
  var saveData = (navigator.connection && navigator.connection.saveData) === true;
  if (dusk && !reduce && !saveData && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting && !duskLoaded) {
          duskLoaded = true;
          [[dusk.dataset.webm, 'video/webm'], [dusk.dataset.mp4, 'video/mp4']].forEach(function (it) {
            var so = document.createElement('source'); so.src = it[0]; so.type = it[1]; dusk.appendChild(so);
          });
          dusk.muted = true;
          dusk.preload = 'auto';
          dusk.load();
          dusk.addEventListener('playing', function () { dusk.style.opacity = '1'; }, { once: true });
        }
      });
    }, { rootMargin: '600px 0px' }).observe(dusk);
    new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        duskVisible = en.isIntersecting;
        if (duskVisible && duskLoaded && !document.hidden) { var p = dusk.play(); if (p && p.catch) p.catch(function () {}); }
        else if (!dusk.paused) dusk.pause();
      });
    }, { threshold: 0.05 }).observe(dusk);
  }

  /* ---------- copy e-mail ---------- */
  var copyBtn = $('#copyMail');
  if (copyBtn) copyBtn.addEventListener('click', function () {
    var mail = copyBtn.dataset.mail;
    var done = function () { copyBtn.textContent = 'Copied'; setTimeout(function () { copyBtn.textContent = 'Copy'; }, 2200); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(mail).then(done, done);
    else done();
  });

  /* ---------- contact form: client-side preview state ---------- */
  var form = $('#contactForm');
  if (form) form.addEventListener('submit', function (e) {
    e.preventDefault();
    var bad = $$('[required]', form).filter(function (f) { return !f.value.trim() || (f.type === 'email' && !/^\S+@\S+\.\S+$/.test(f.value)); });
    $$('[required]', form).forEach(function (f) { f.setAttribute('aria-invalid', bad.indexOf(f) > -1 ? 'true' : 'false'); });
    if (bad.length) { bad[0].focus(); return; }
    form.classList.add('is-sent');
    var t = $('#formThanks'); if (t) t.focus({ preventScroll: true });
  });

  /* ---------- decode upcoming images in idle time ---------- */
  var idle = window.requestIdleCallback || function (cb) { return setTimeout(cb, 200); };
  // once the page has settled, fetch and decode the remaining images quietly so none is ever blank
  window.addEventListener('load', function () {
    idle(function () {
      $$('img[loading="lazy"]').forEach(function (img, i) {
        setTimeout(function () {
          idle(function () { img.loading = 'eager'; if (img.decode) img.decode().catch(function () {}); });
        }, 400 + i * 180);
      });
    });
  });

  /* ---------- motion ---------- */
  if (!motion) return;

  // reveals: one-shot, transform + opacity
  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 88%',
    once: true,
    onEnter: function (els) {
      gsap.to(els, { opacity: 1, y: 0, duration: 1.5, ease: 'power2.out', stagger: 0.12, overwrite: true });
    }
  });

  // statement rule draws down (scaleY)
  $$('[data-rule]').forEach(function (r) {
    gsap.fromTo(r, { scaleY: 0 }, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: r, start: 'top 85%', end: 'bottom 55%', scrub: 0.6 } });
  });

  // gentle image drift (inner image only, transform)
  $$('[data-parallax]').forEach(function (frame) {
    var img = frame.querySelector('img');
    if (!img) return;
    gsap.set(img, { scale: 1.12 });
    gsap.fromTo(img, { yPercent: -4 }, { yPercent: 4, ease: 'none', scrollTrigger: { trigger: frame, start: 'top bottom', end: 'bottom top', scrub: 0.8 } });
  });
  $$('[data-parallax-inner]').forEach(function (el) {
    gsap.fromTo(el, { yPercent: -5 }, { yPercent: 5, ease: 'none', scrollTrigger: { trigger: '.interlude', start: 'top bottom', end: 'bottom top', scrub: 0.8 } });
  });

  // the film settles back as the page arrives (transform/opacity only)
  gsap.to('#filmFrame', { yPercent: 14, ease: 'none', scrollTrigger: { trigger: '.film', start: 'top top', end: 'bottom top', scrub: 0.5 } });
  gsap.to('.film__caption', { opacity: 0, y: -24, ease: 'none', scrollTrigger: { trigger: '.film', start: 'top top', end: '35% top', scrub: 0.5 } });
  gsap.to('.film__controls', { opacity: 0, ease: 'none', scrollTrigger: { trigger: '.film', start: '45% top', end: '70% top', scrub: 0.4 } });

  window.addEventListener('load', function () { ScrollTrigger.refresh(); });
})();

/* ---------- PWA ---------- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js?v=20261030', { scope: './' }).catch(function () {});
  });
}
