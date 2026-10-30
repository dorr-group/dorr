/* DORR v2 — gold particle field (three.js, orthographic, pixel units).
   Each particle has three homes: scattered dust, a point on the DORR wordmark,
   and a point on the ring. GSAP drives `state`; the shader blends between homes. */
window.DorrParticles = function (canvas, opts) {
  const THREE = window.THREE;
  if (!THREE) return null;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'high-performance' });
  } catch (e) {
    return null;
  }
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);

  const state = { intro: 0, morph: 0, scale: 1, alpha: 1 };
  let W = 0, H = 0, count = 0, ringR = 0;
  let points = null;
  const mouse = { x: 9999, y: 9999, tx: 9999, ty: 9999 };

  const vertex = `
    attribute vec3 aWord;
    attribute vec3 aRing;
    attribute vec3 aDust;
    attribute float aRand;
    uniform float uTime, uIntro, uMorph, uScale, uSize;
    uniform vec2 uMouse;
    uniform float uMouseR;
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
      float f = smoothstep(uMouseR, 0.0, dist);
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
    uSize: { value: 2.3 * dpr }, uMouse: { value: new THREE.Vector2(9999, 9999) },
    uMouseR: { value: 130 }, uAlpha: { value: 1 },
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

  const build = () => {
    const rect = canvas.getBoundingClientRect();
    W = Math.max(1, Math.round(rect.width));
    H = Math.max(1, Math.round(rect.height));
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

  let running = false, raf = 0, last = performance.now();
  const tick = (now) => {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    uniforms.uTime.value += dt;
    mouse.x += (mouse.tx - mouse.x) * 0.12;
    mouse.y += (mouse.ty - mouse.y) * 0.12;
    uniforms.uMouse.value.set(mouse.x, mouse.y);
    uniforms.uIntro.value = state.intro;
    uniforms.uMorph.value = state.morph;
    uniforms.uScale.value = state.scale;
    uniforms.uAlpha.value = state.alpha;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  };

  const onMove = (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.tx = e.clientX - r.left - W / 2;
    mouse.ty = -(e.clientY - r.top - H / 2);
  };
  const onLeave = () => { mouse.tx = 9999; mouse.ty = 9999; };
  window.addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerleave', onLeave);

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const r = canvas.getBoundingClientRect();
      if (Math.abs(r.width - W) > 2 || Math.abs(r.height - H) > 80) build();
    }, 200);
  });

  build();

  return {
    state,
    ringRadius: () => ringR,
    start() { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(tick); },
    stop() { running = false; cancelAnimationFrame(raf); },
  };
};
