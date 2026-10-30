/* DORR v2 — gold particle field (three.js, orthographic, pixel units).
   Each particle has three homes: scattered dust, a point on the DORR wordmark,
   and a point on the ring. GSAP drives `state`; the shader blends between homes.
   opts.ticker (gsap.ticker) drives rendering so the page has a single frame loop;
   the owner calls resize() once layout has settled (ScrollTrigger refresh). */
window.DorrParticles = function (canvas, opts) {
  const THREE = window.THREE;
  if (!THREE) return null;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'high-performance' });
  } catch (e) {
    return null;
  }
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  // points are cheap: keep the crisp 2x sparkle of the gold dust (3x buffers add nothing)
  const pixelRatio = () => Math.min(window.devicePixelRatio || 1, 2);
  let dpr = pixelRatio();
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);

  const state = { intro: 0, morph: 0, scale: 1, alpha: 1 };
  let W = 0, H = 0, count = 0, ringR = 0;
  let points = null;
  // cursor: position eases toward the pointer, strength k fades in/out (no sweep in from off-screen)
  const mouse = { x: 0, y: 0, tx: 0, ty: 0, k: 0, tk: 0, cx: 0, cy: 0, dirty: false };

  const vertex = `
    attribute vec3 aWord;
    attribute vec3 aRing;
    attribute vec3 aDust;
    attribute float aRand;
    uniform float uTime, uIntro, uMorph, uScale, uSize;
    uniform vec2 uMouse;
    uniform float uMouseR, uMouseK;
    varying float vRand;
    varying float vGlow;
    void main() {
      float t = clamp(uIntro * 1.5 - aRand * 0.5, 0.0, 1.0);
      t = t * t * (3.0 - 2.0 * t);
      float m = clamp(uMorph * 1.4 - aRand * 0.4, 0.0, 1.0);
      m = m * m * (3.0 - 2.0 * m);

      vec3 home = mix(aWord, aRing, m);
      // spin the ring slowly once formed
      float a = uTime * 0.12 * m;
      home.xy = mat2(cos(a), -sin(a), sin(a), cos(a)) * home.xy;
      vec3 p = mix(aDust, home, t);

      // breathing drift
      p.x += sin(uTime * 0.9 + aRand * 60.0) * (1.2 + 6.0 * (1.0 - t));
      p.y += cos(uTime * 0.7 + aRand * 40.0) * (1.2 + 6.0 * (1.0 - t));
      p.xy *= uScale;

      // cursor pushes particles away
      vec2 d = p.xy - uMouse;
      float dist = length(d);
      float f = smoothstep(uMouseR, 0.0, dist) * uMouseK;
      p.xy += (d / max(dist, 0.001)) * f * 70.0 * t;

      vGlow = f;
      vRand = aRand;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      gl_PointSize = uSize * (0.55 + aRand * 1.1) * (1.0 + f * 0.8);
    }`;

  const fragment = `
    uniform float uAlpha, uTime;
    varying float vRand;
    varying float vGlow;
    void main() {
      vec2 c = gl_PointCoord - 0.5;
      float d = length(c);
      if (d > 0.5) discard;
      float soft = smoothstep(0.5, 0.0, d);
      vec3 deep = vec3(0.78, 0.55, 0.24);
      vec3 pale = vec3(1.0, 0.9, 0.7);
      vec3 col = mix(deep, pale, vRand * vRand + vGlow * 0.6);
      float tw = 0.55 + 0.45 * sin(uTime * 2.2 + vRand * 80.0);
      gl_FragColor = vec4(col, soft * tw * uAlpha * (0.45 + 0.55 * vRand));
    }`;

  const uniforms = {
    uTime: { value: 0 }, uIntro: { value: 0 }, uMorph: { value: 0 }, uScale: { value: 1 },
    uSize: { value: 2.3 * dpr }, uMouse: { value: new THREE.Vector2(0, 0) },
    uMouseR: { value: 130 }, uMouseK: { value: 0 }, uAlpha: { value: 1 },
  };

  const sampleWord = (n) => {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    const face = (size) => `400 ${size}px "Bodoni Moda", Didot, Georgia, serif`;
    ctx.font = face(100);
    const per100 = ctx.measureText('DORR').width || 300;
    const fs = Math.min(H * 0.46, (W * (W < 700 ? 0.9 : 0.78) * 100) / per100);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = face(fs);
    ctx.fillText('DORR', W / 2, H * 0.47);
    const data = ctx.getImageData(0, 0, W, H).data;
    const pts = [];
    const step = W > 900 ? 2 : 1;
    for (let y = 0; y < H; y += step) {
      for (let x = 0; x < W; x += step) {
        if (data[(y * W + x) * 4 + 3] > 140) pts.push(x - W / 2, -(y - H / 2));
      }
    }
    const out = new Float32Array(n * 3);
    const total = pts.length / 2;
    for (let i = 0; i < n; i++) {
      const k = total ? Math.floor(Math.random() * total) : 0;
      out[i * 3] = total ? pts[k * 2] + (Math.random() - 0.5) * step : 0;
      out[i * 3 + 1] = total ? pts[k * 2 + 1] + (Math.random() - 0.5) * step : 0;
    }
    return out;
  };

  const ringPositions = (n) => {
    const out = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const spread = Math.random() < 0.12 ? (Math.random() - 0.5) * 46 : (Math.random() - 0.5) * 7;
      const r = ringR + spread;
      out[i * 3] = Math.cos(a) * r;
      out[i * 3 + 1] = Math.sin(a) * r;
    }
    return out;
  };

  const dustPositions = (n) => {
    const out = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.max(W, H) * (0.35 + Math.random() * 0.75);
      out[i * 3] = Math.cos(a) * r;
      out[i * 3 + 1] = Math.sin(a) * r;
    }
    return out;
  };

  const build = (w, h) => {
    W = w; H = h;
    dpr = pixelRatio();
    renderer.setPixelRatio(dpr);
    uniforms.uSize.value = 2.3 * dpr;
    renderer.setSize(W, H, false);
    camera.left = -W / 2; camera.right = W / 2; camera.top = H / 2; camera.bottom = -H / 2;
    camera.updateProjectionMatrix();
    ringR = opts.ringRadius(W, H);
    count = W < 700 ? 9000 : 22000;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute('aWord', new THREE.BufferAttribute(sampleWord(count), 3));
    geo.setAttribute('aRing', new THREE.BufferAttribute(ringPositions(count), 3));
    geo.setAttribute('aDust', new THREE.BufferAttribute(dustPositions(count), 3));
    const rand = new Float32Array(count);
    for (let i = 0; i < count; i++) rand[i] = Math.random();
    geo.setAttribute('aRand', new THREE.BufferAttribute(rand, 1));

    if (points) { scene.remove(points); points.geometry.dispose(); }
    else {
      points = new THREE.Points(geo, new THREE.ShaderMaterial({
        vertexShader: vertex, fragmentShader: fragment, uniforms,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      }));
    }
    points.geometry = geo;
    points.frustumCulled = false;
    scene.add(points);
  };

  const ticker = opts.ticker || null;
  let running = false, raf = 0, last = performance.now(), blank = false;
  const tick = () => {
    if (!running) return;
    if (!ticker) raf = requestAnimationFrame(tick);
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    // fully faded out (end of the hero scroll): clear once, then skip the GPU work
    if (state.alpha <= 0.002) {
      if (!blank) { renderer.clear(); blank = true; }
      return;
    }
    blank = false;
    uniforms.uTime.value += dt;
    if (mouse.dirty) {
      // at most one layout read per frame, and only while the pointer moves
      const r = canvas.getBoundingClientRect();
      mouse.tx = mouse.cx - r.left - W / 2;
      mouse.ty = -(mouse.cy - r.top - H / 2);
      if (mouse.k < 0.01) { mouse.x = mouse.tx; mouse.y = mouse.ty; }
      mouse.dirty = false;
    }
    const ease = 1 - Math.exp(-dt * 8);
    mouse.x += (mouse.tx - mouse.x) * ease;
    mouse.y += (mouse.ty - mouse.y) * ease;
    mouse.k += (mouse.tk - mouse.k) * (1 - Math.exp(-dt * 4));
    uniforms.uMouse.value.set(mouse.x, mouse.y);
    uniforms.uMouseK.value = mouse.k;
    uniforms.uIntro.value = state.intro;
    uniforms.uMorph.value = state.morph;
    uniforms.uScale.value = state.scale;
    uniforms.uAlpha.value = state.alpha;
    renderer.render(scene, camera);
  };

  const onMove = (e) => {
    if (!running || e.pointerType === 'touch') return;
    mouse.cx = e.clientX; mouse.cy = e.clientY; mouse.dirty = true; mouse.tk = 1;
  };
  const onLeave = () => { mouse.tk = 0; };
  window.addEventListener('pointermove', onMove, { passive: true });
  // touch: the dust parts around the finger while it moves (touchmove keeps firing during a
  // scroll), and the push fades out softly once the finger lifts, so nothing stays stuck
  const onTouch = (e) => {
    if (!running || !e.touches.length) return;
    const t = e.touches[0];
    mouse.cx = t.clientX; mouse.cy = t.clientY; mouse.dirty = true; mouse.tk = 1;
  };
  window.addEventListener('touchstart', onTouch, { passive: true });
  window.addEventListener('touchmove', onTouch, { passive: true });
  window.addEventListener('touchend', (e) => { if (!e.touches.length) onLeave(); }, { passive: true });
  window.addEventListener('touchcancel', onLeave, { passive: true });
  document.addEventListener('pointerleave', onLeave);
  window.addEventListener('blur', onLeave);

  const measure = () => {
    const r = canvas.getBoundingClientRect();
    return [Math.max(1, Math.round(r.width)), Math.max(1, Math.round(r.height))];
  };
  // Rebuilds only on a real size change. On touch screens a height-only change is the
  // address bar showing or hiding, so it is ignored (re-sampling would make the dust jump).
  const resize = () => {
    const [w, h] = measure();
    const widthChanged = Math.abs(w - W) > 2;
    const heightChanged = Math.abs(h - H) > 2;
    if (!widthChanged && (coarse || !heightChanged)) return false;
    build(w, h);
    return true;
  };

  build(...measure());

  return {
    state,
    ringRadius: () => ringR,
    size: () => [W, H],
    resize,
    start() {
      if (running) return;
      running = true; last = performance.now();
      if (ticker) ticker.add(tick); else raf = requestAnimationFrame(tick);
    },
    stop() {
      running = false;
      if (ticker) ticker.remove(tick); else cancelAnimationFrame(raf);
    },
  };
};
