/* DORR v3 — the interiors.
   One small hand-made room per place, built from simple shapes and baked by
   world.js into a few toon meshes with ink outlines. Every builder returns
   { group, door, view, ... }: the camera arrives at `door` (just inside the
   entrance, under the door light) and glides to `view`.
   Coordinates: floor at y = 0, entrance on +z, the room looks toward -z. */
window.DorrRooms = function (kit) {
  const { THREE, C, mat, toon, mesh, blob, outline, rand, small } = kit;

  /* ---------------- tiny modelling kit ---------------- */
  // y is the bottom of the shape (easier to stack things)
  const Bx = (p, w, h, d, hex, x, y, z, ry) => { const m = mesh(p, new THREE.BoxGeometry(w, h, d), typeof hex === 'number' ? mat(hex) : hex, x, y + h / 2, z); if (ry) m.rotation.y = ry; return m; };
  const B = Bx;
  const Cy = (p, rt, rb, h, hex, x, y, z, seg) => mesh(p, new THREE.CylinderGeometry(rt, rb, h, seg || 20), typeof hex === 'number' ? mat(hex) : hex, x, y + h / 2, z);
  const Sp = (p, r, hex, x, y, z) => mesh(p, new THREE.SphereGeometry(r, 18, 12), typeof hex === 'number' ? mat(hex) : hex, x, y, z);
  const lathe = (p, pts, hex, x, y, z, seg) => mesh(p, new THREE.LatheGeometry(pts.map(([r, h]) => new THREE.Vector2(r, h)), seg || 20), typeof hex === 'number' ? mat(hex) : hex, x, y, z);
  const Blob = (p, r, hex, x, y, z, sy) => mesh(p, blob(r, 1, 0.12, sy || 0.85), mat(hex), x, y, z);
  const keep = (o) => { o.userData.keep = true; o.traverse((m) => { if (m.isMesh && !m.userData.ink) outline(m); }); return o; };

  // window glass: bright sky by day, deep blue at night
  const paneMat = (day, night) => {
    const m = new THREE.MeshBasicMaterial({ color: day });
    m.userData.day = new THREE.Color(day); m.userData.night = new THREE.Color(night);
    return m;
  };
  const tintPanes = (panes, n) => panes.forEach((m) => m.color.copy(m.userData.day).lerp(m.userData.night, n));
  // lamp shades / bulbs: softly on by day, glowing at night
  const lampMat = (hex, glowHex) => toon({ color: hex, emissive: glowHex || 0xffc46b, emissiveIntensity: 0.5 });
  const lightLamps = (ms, n, day) => ms.forEach((m) => { m.emissiveIntensity = (day == null ? 0.45 : day) + n * 1.9; });

  // a closed room with a doorway in the front wall
  const noCast = (m) => { m.castShadow = false; return m; };
  const shell = (g, o) => {
    const { w, d, h } = o;
    const B = (...a) => noCast(Bx(...a));
    const t = 0.16;
    B(g, w + t * 2, 0.12, d + t * 2, o.floor, 0, -0.12, 0);
    B(g, w + t * 2, h, t, o.wall, 0, 0, -d / 2 - t / 2); // back
    B(g, t, h, d, o.wallSide || o.wall, -w / 2 - t / 2, 0, 0); // left
    B(g, t, h, d, o.wallSide || o.wall, w / 2 + t / 2, 0, 0); // right
    const dw = 1.3, dh = 2.45;
    B(g, (w - dw) / 2 + t, h, t, o.wall, -(dw / 2 + (w - dw) / 4) - t / 2, 0, d / 2 + t / 2);
    B(g, (w - dw) / 2 + t, h, t, o.wall, dw / 2 + (w - dw) / 4 + t / 2, 0, d / 2 + t / 2);
    B(g, dw, h - dh, t, o.wall, 0, dh, d / 2 + t / 2);
    if (o.ceil !== false) B(g, w + t * 2, 0.14, d + t * 2, o.ceil || o.wall, 0, h, 0);
    if (o.base) { // skirting
      B(g, w, 0.14, 0.04, o.base, 0, 0, -d / 2 + 0.02);
      B(g, 0.04, 0.14, d, o.base, -w / 2 + 0.02, 0, 0);
      B(g, 0.04, 0.14, d, o.base, w / 2 - 0.02, 0, 0);
    }
    // the door light behind you
    const glowDoor = new THREE.Mesh(new THREE.PlaneGeometry(dw, dh), new THREE.MeshBasicMaterial({ color: 0xfff0d6 }));
    glowDoor.position.set(0, dh / 2, d / 2 + t + 0.01);
    glowDoor.rotation.y = Math.PI;
    g.add(glowDoor);
  };
  // a framed window on a wall (ry turns it to face into the room)
  const windowOn = (g, pane, x, y, z, w, h, ry, frameHex, arched) => {
    const f = new THREE.Group();
    f.position.set(x, y, z);
    f.rotation.y = ry || 0;
    const fh = frameHex || C.white;
    if (arched) {
      const s = new THREE.Shape();
      s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h - w / 2); s.absarc(0, h - w / 2, w / 2, 0, Math.PI, false); s.lineTo(-w / 2, 0);
      const p = new THREE.Mesh(new THREE.ShapeGeometry(s, 16), pane);
      p.position.z = 0.012;
      f.add(p);
      const arc = mesh(f, new THREE.TorusGeometry(w / 2, 0.045, 6, 24, Math.PI), mat(fh), 0, h - w / 2, 0.03);
      arc.castShadow = false;
      B(f, 0.09, h - w / 2, 0.06, fh, -w / 2, 0, 0.03);
      B(f, 0.09, h - w / 2, 0.06, fh, w / 2, 0, 0.03);
      B(f, w + 0.2, 0.08, 0.16, fh, 0, -0.04, 0.06);
      B(f, 0.04, h - 0.05, 0.04, fh, 0, 0, 0.035);
    } else {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), pane);
      p.position.set(0, h / 2, 0.012);
      f.add(p);
      B(f, w + 0.12, 0.07, 0.06, fh, 0, -0.035, 0.03);
      B(f, w + 0.12, 0.07, 0.06, fh, 0, h - 0.035, 0.03);
      B(f, 0.07, h, 0.06, fh, -w / 2, 0, 0.03);
      B(f, 0.07, h, 0.06, fh, w / 2, 0, 0.03);
      B(f, 0.04, h, 0.04, fh, 0, 0, 0.035);
      B(f, w, 0.04, 0.04, fh, 0, h * 0.55, 0.035);
      B(f, w + 0.24, 0.06, 0.18, fh, 0, -0.08, 0.08);
    }
    g.add(f);
    return f;
  };
  const chair = (g, x, z, ry, seat, legs) => {
    const c = new THREE.Group(); c.position.set(x, 0, z); c.rotation.y = ry || 0;
    B(c, 0.44, 0.06, 0.42, seat, 0, 0.44, 0);
    [[-0.18, -0.17], [0.18, -0.17], [-0.18, 0.17], [0.18, 0.17]].forEach(([a, b]) => Cy(c, 0.02, 0.018, 0.44, legs || C.wood, a, 0, b, 6));
    B(c, 0.44, 0.42, 0.05, seat, 0, 0.5, -0.19);
    g.add(c);
    return c;
  };
  const stool = (g, x, z, seat, legs) => {
    Cy(g, 0.2, 0.18, 0.08, seat, x, 0.72, z, 18);
    Cy(g, 0.025, 0.025, 0.72, legs, x, 0, z, 8);
    Cy(g, 0.17, 0.2, 0.03, legs, x, 0, z, 18);
    mesh(g, new THREE.TorusGeometry(0.15, 0.012, 5, 18), mat(legs), x, 0.3, z).rotation.x = Math.PI / 2;
  };
  const roundTable = (g, x, z, top, leg, r, cloth) => {
    if (cloth) {
      Cy(g, (r || 0.45) + 0.02, (r || 0.45) + 0.08, 0.5, cloth, x, 0.27, z, 28);
      Cy(g, (r || 0.45) + 0.02, (r || 0.45) + 0.02, 0.02, cloth, x, 0.76, z, 28);
    } else {
      Cy(g, r || 0.45, r || 0.45, 0.04, top, x, 0.72, z, 28);
      Cy(g, 0.04, 0.05, 0.72, leg, x, 0, z, 10);
      Cy(g, 0.22, 0.25, 0.03, leg, x, 0, z, 18);
    }
  };
  const pendant = (g, x, z, top, len, shade, bulbM, kind) => {
    const y = top - len;
    Cy(g, 0.008, 0.008, len, C.charcoal, x, y, z, 4);
    if (kind === 'globe') Sp(g, 0.18, bulbM, x, y - 0.12, z);
    else if (kind === 'bulb') { Sp(g, 0.06, bulbM, x, y - 0.07, z); Cy(g, 0.025, 0.025, 0.06, C.gold, x, y - 0.03, z, 8); }
    else {
      lathe(g, [[0.0, -0.26], [0.27, -0.26], [0.24, -0.18], [0.12, -0.04], [0.02, 0]], shade, x, y, z, 22);
      Sp(g, 0.06, bulbM, x, y - 0.24, z);
    }
  };
  const plant = (g, x, z, s, potHex, leaf) => {
    Cy(g, 0.2 * s, 0.15 * s, 0.38 * s, potHex || C.terracotta, x, 0, z, 16);
    Blob(g, 0.3 * s, leaf || C.leaf, x, 0.62 * s, z);
    Blob(g, 0.22 * s, leaf || C.leaf, x + 0.16 * s, 0.86 * s, z + 0.05 * s);
    Blob(g, 0.2 * s, leaf || C.leaf, x - 0.14 * s, 0.9 * s, z - 0.06 * s);
  };
  const bottle = (g, x, y, z, hex, s) => {
    s = s || 1;
    Cy(g, 0.035 * s, 0.035 * s, 0.17 * s, hex, x, y, z, 10);
    Cy(g, 0.012 * s, 0.03 * s, 0.07 * s, hex, x, y + 0.17 * s, z, 8);
  };
  const tiles = (g, w, d, a, b, size, y) => {
    const nx = Math.round(w / size), nz = Math.round(d / size);
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      B(g, size - 0.012, 0.02, size - 0.012, (i + j) % 2 ? a : b, -w / 2 + size * (i + 0.5), y || 0, -d / 2 + size * (j + 0.5));
    }
  };
  const planks = (g, w, d, a, b, size, alongZ) => {
    const n = Math.round((alongZ ? w : d) / size);
    for (let i = 0; i < n; i++) {
      const hex = i % 3 === 0 ? b : a;
      if (alongZ) B(g, size - 0.01, 0.02, d, hex, -w / 2 + size * (i + 0.5), 0, 0);
      else B(g, w, 0.02, size - 0.01, hex, 0, 0, -d / 2 + size * (i + 0.5));
    }
  };
  const art = (g, x, y, z, ry, w, h, bg, marks) => {
    const f = new THREE.Group(); f.position.set(x, y, z); f.rotation.y = ry || 0;
    B(f, w + 0.08, h + 0.08, 0.04, C.wood, 0, -0.04, 0);
    B(f, w, h, 0.02, bg, 0, 0, 0.03);
    marks.forEach(([hex, mx, my, r]) => { const c = mesh(f, new THREE.CircleGeometry(r, 28), mat(hex), mx, my + h / 2, 0.045); c.castShadow = false; });
    g.add(f);
  };
  // shared sky dome (open-air and big-window rooms)
  const sky = (g, top, hor, nTop, nHor) => {
    const m = new THREE.ShaderMaterial({
      uniforms: { uTop: { value: new THREE.Color(top) }, uHor: { value: new THREE.Color(hor) }, uNTop: { value: new THREE.Color(nTop) }, uNHor: { value: new THREE.Color(nHor) }, uNight: { value: 0 } },
      vertexShader: 'varying vec3 vP;\nvoid main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 uTop, uHor, uNTop, uNHor; uniform float uNight; varying vec3 vP;\nvoid main(){ float h = clamp(vP.y * 2.2 + 0.04, 0.0, 1.0); h = h * h * (3.0 - 2.0 * h);\n vec3 d = mix(uHor, uTop, h); vec3 n = mix(uNHor, uNTop, h);\n gl_FragColor = vec4(mix(d, n, uNight), 1.0);\n #include <colorspace_fragment>\n}',
      side: THREE.BackSide, depthWrite: false,
    });
    const s = new THREE.Mesh(new THREE.SphereGeometry(90, 32, 16), m);
    s.userData.keep = true;
    s.renderOrder = -1;
    g.add(s);
    return m;
  };
  // painted flat clouds on the sky
  const skyClouds = (g, n, y, dist) => {
    const cm = toon({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.35 });
    cm.userData.ink = true;
    for (let i = 0; i < n; i++) {
      const a = -0.9 + (i / (n - 1)) * 1.8 + rand(-0.1, 0.1);
      const c = new THREE.Group();
      c.position.set(Math.sin(a) * dist, y + rand(-2, 3), -Math.cos(a) * dist);
      for (let j = 0; j < 4; j++) { const m = mesh(c, blob(1.6, 1, 0.08), cm, j * 1.8 - 2.7, Math.sin(j) * 0.4, 0); m.scale.set(1.3, 0.55, 0.5); m.castShadow = false; }
      c.lookAt(0, c.position.y, 0);
      g.add(c);
    }
    return cm;
  };

  const ROOMS = {};

  /* ======================= DADA · Restaurant ======================= */
  ROOMS.dada = () => {
    const g = new THREE.Group();
    const w = 9, d = 8, h = 3.6;
    const wall = 0xf3e8d8, beam = 0x8a5a3b;
    shell(g, { w, d, h, wall, floor: 0xb8603c, ceil: 0xf6eee2, base: 0xa4583a });
    tiles(g, w, d, 0xc8714a, 0xbb6440, 0.5);
    for (let i = 0; i < 6; i++) B(g, 0.18, 0.22, d, beam, -w / 2 + 0.75 + i * 1.5, h - 0.22, 0);
    const pane = paneMat(0xcfe8ee, 0x1e2a4f);
    [-2.8, 0, 2.8].forEach((x) => windowOn(g, pane, x, 1.0, -d / 2, 1.2, 2.0, 0, C.white, true));
    // banquette along the back wall
    B(g, 8.2, 0.45, 0.6, 0x7d8a58, 0, 0, -d / 2 + 0.3);
    B(g, 8.2, 0.55, 0.16, 0x6f7b4d, 0, 0.45, -d / 2 + 0.08);
    for (let i = 0; i < 9; i++) Sp(g, 0.11, 0x8c9a65, -3.6 + i * 0.9, 0.62, -d / 2 + 0.24).scale.set(1.3, 0.6, 0.6);
    const shadeHex = C.terracotta;
    const bulbM = lampMat(0xfff4dd);
    const shades = [];
    const tableAt = (x, z, seats) => {
      roundTable(g, x, z, C.white, C.charcoal, 0.42, 0xfbf6ee);
      Cy(g, 0.12, 0.12, 0.012, 0xffffff, x - 0.18, 0.78, z + 0.1, 18);
      Cy(g, 0.12, 0.12, 0.012, 0xffffff, x + 0.18, 0.78, z - 0.05, 18);
      Cy(g, 0.025, 0.02, 0.12, 0xd9e8ea, x + 0.05, 0.78, z + 0.22, 8);
      Cy(g, 0.02, 0.022, 0.1, 0xfff7e6, x - 0.02, 0.78, z - 0.2, 8);
      seats.forEach((a) => chair(g, x + Math.sin(a) * 0.72, z + Math.cos(a) * 0.72, a + Math.PI, 0xd8b98c, C.wood));
      pendant(g, x, z, h, 1.25, shadeHex, bulbM);
    };
    tableAt(-2.6, -2.55, [0, 0.9, -0.9]);
    tableAt(0, -2.55, [0, 0.9, -0.9]);
    tableAt(2.6, -2.55, [0, 0.9, -0.9]);
    tableAt(-1.5, -0.2, [0, Math.PI, Math.PI / 2, -Math.PI / 2]);
    tableAt(1.5, -0.2, [0, Math.PI, Math.PI / 2, -Math.PI / 2]);
    // open kitchen pass on the right
    B(g, 0.8, 1.05, 3.2, 0xefe5d3, w / 2 - 0.4, 0, 1.0);
    B(g, 0.9, 0.06, 3.3, 0x3a3a3c, w / 2 - 0.42, 1.05, 1.0);
    Cy(g, 0.17, 0.15, 0.18, 0xb87333, w / 2 - 0.4, 1.11, 0.2, 18);
    Cy(g, 0.13, 0.11, 0.14, 0xb87333, w / 2 - 0.45, 1.11, 0.75, 18);
    for (let i = 0; i < 4; i++) Cy(g, 0.11, 0.11, 0.012, 0xffffff, w / 2 - 0.4, 1.11, 1.3 + i * 0.25, 16);
    B(g, 0.3, 0.05, 3.2, beam, w / 2 - 0.15, 2.0, 1.0);
    for (let i = 0; i < 5; i++) Cy(g, 0.12 - i * 0.008, 0.1, 0.12, 0xb87333, w / 2 - 0.15, 2.05, -0.3 + i * 0.6, 14);
    // left wall: sideboard with wine, art, an olive tree
    B(g, 0.5, 0.9, 2.4, beam, -w / 2 + 0.25, 0, 0.9);
    for (let i = 0; i < 8; i++) bottle(g, -w / 2 + 0.25, 0.9, 0.0 + i * 0.25, i % 3 ? 0x5b2333 : 0x3f5a35);
    art(g, -w / 2 + 0.02, 1.55, 0.9, Math.PI / 2, 1.3, 0.9, 0xf7efe2, [[C.terracotta, -0.25, -0.05, 0.22], [0x7d8a58, 0.2, 0.05, 0.16], [C.gold, 0.05, -0.25, 0.08]]);
    const tree = kit.olive(g, -w / 2 + 0.9, -1.0, 2.0);
    Cy(g, 0.32, 0.26, 0.5, C.terracotta, -w / 2 + 0.9, 0, -1.0, 18);
    tree.position.y = 0.4;
    plant(g, w / 2 - 0.6, -d / 2 + 0.7, 1.4, C.terracotta, 0x6f8f4e);
    return {
      group: g,
      door: { pos: [0, 1.55, d / 2 + 0.05], look: [0, 1.45, -d / 2] },
      view: { pos: [0.25, 1.62, d / 2 - 1.5], look: [-0.15, 1.15, -d / 2 + 0.5] },
      bg: [0xf3e8d8, 0x2a2230], hemi: [0xfff2e2, 0xc59a7c, 1.25], sun: [3, 9, 6], sunInt: 1.4,
      lamps: [[-2.6, 2.1, -2.55], [0, 2.1, -2.55], [0, 2.1, -0.2]], lampDay: 0.25, lampNight: 3.2,
      night(n) { tintPanes([pane], n); lightLamps([bulbM], n, 0.6); },
    };
  };

  /* ======================= SAYAH · Beachclub ======================= */
  ROOMS.sayah = () => {
    const g = new THREE.Group();
    const skyM = sky(g, 0x8fc9dc, 0xf6dcb6, 0x111a3a, 0x3b3466);
    const cloudM = skyClouds(g, 5, 9, 60);
    // the sea, with drawn ripples and a foam line
    const seaM = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }, uNight: { value: 0 },
        uShallow: { value: new THREE.Color(0x67c9c4) }, uDeep: { value: new THREE.Color(0x2f8f9a) }, uFoam: { value: new THREE.Color(0xf7fbf8) },
        uNShallow: { value: new THREE.Color(0x2e5d78) }, uNDeep: { value: new THREE.Color(0x15264a) },
      },
      vertexShader: 'varying vec2 vUv; uniform float uTime;\nvoid main(){ vUv = uv; vec3 p = position; p.z += sin(p.x * 0.35 + uTime * 0.8) * 0.06 * (1.0 - uv.y); gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }',
      fragmentShader: [
        'uniform float uTime, uNight; uniform vec3 uShallow, uDeep, uFoam, uNShallow, uNDeep; varying vec2 vUv;',
        'void main(){',
        '  float y = vUv.y; float x = vUv.x;',
        '  vec3 sh = mix(uShallow, uNShallow, uNight); vec3 dp = mix(uDeep, uNDeep, uNight);',
        '  vec3 col = mix(sh, dp, smoothstep(0.02, 0.22, y));',
        '  float r = sin(x * 140.0 + sin(y * 60.0 + uTime * 0.6) * 2.5 + uTime * 0.4) * sin(y * 220.0 - uTime * 0.9 + sin(x * 30.0) * 1.5);',
        '  col = mix(col, mix(sh, uFoam, 0.45), step(0.82, r) * (1.0 - smoothstep(0.1, 0.5, y)) * 0.8);',
        '  float shore = 0.012 + 0.006 * sin(x * 90.0 + uTime * 1.2);',
        '  col = mix(col, uFoam * (1.0 - uNight * 0.5), step(y, shore));',
        '  gl_FragColor = vec4(col, 1.0);',
        '  #include <colorspace_fragment>',
        '}',
      ].join('\n'),
    });
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(160, 80, 40, 1), seaM);
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(0, -0.62, -46);
    sea.userData.keep = true;
    g.add(sea);
    // sand in front of the deck
    B(g, 160, 0.3, 10, 0xefdcbc, 0, -0.95, -1.2);
    B(g, 160, 0.3, 4, 0xe6cfa9, 0, -0.98, -7.5);
    // the deck
    const deckW = 11, deckD = 6.4;
    for (let i = 0; i < 18; i++) B(g, deckW, 0.08, 0.34, i % 4 === 0 ? 0xa06a45 : 0xb17a50, 0, 0.0, deckD / 2 - 0.18 - i * 0.355);
    for (let i = 0; i < 6; i++) Cy(g, 0.07, 0.07, 0.75, 0x7a4f33, -deckW / 2 + 0.2 + i * 2.12, -0.7, -deckD / 2 + 0.2, 8);
    // rope rail at the sea edge
    for (let i = 0; i < 7; i++) Cy(g, 0.035, 0.04, 0.85, 0x8a5a3b, -deckW / 2 + 0.3 + i * 1.73, 0.08, -deckD / 2 + 0.25, 8);
    [0.6, 0.85].forEach((y) => B(g, deckW - 0.4, 0.025, 0.025, 0xd9c49c, 0, y, -deckD / 2 + 0.25));
    // loungers with towels, umbrellas between
    const towel = [0xc8643c, 0x2f8f9a, 0xe58fb3, 0xd6a64f];
    [-3.4, -1.15, 1.15, 3.4].forEach((x, i) => {
      const l = new THREE.Group(); l.position.set(x, 0.08, -1.1);
      B(l, 0.7, 0.08, 1.7, 0xf7f2e9, 0, 0.3, 0.2);
      const back = B(l, 0.7, 0.08, 0.8, 0xf7f2e9, 0, 0.62, 1.1); back.rotation.x = -0.9; back.position.y = 0.6; back.position.z = 1.05;
      [[-0.3, -0.55], [0.3, -0.55], [-0.3, 0.9], [0.3, 0.9]].forEach(([a, b]) => Cy(l, 0.025, 0.025, 0.3, 0x8a5a3b, a, 0, b, 6));
      B(l, 0.5, 0.03, 1.0, towel[i], 0, 0.38, 0.15);
      B(l, 0.5, 0.03, 0.06, 0xffffff, 0, 0.39, -0.1);
      g.add(l);
      if (i % 2 === 0) {
        const ux = x + 1.12;
        Cy(g, 0.03, 0.03, 2.25, 0x8a5a3b, ux, 0.08, -1.0, 8);
        const um = new THREE.Group(); um.position.set(ux, 2.2, -1.0);
        for (let k = 0; k < 8; k++) {
          const seg = mesh(um, new THREE.ConeGeometry(1.25, 0.42, 3, 1, false, (k / 8) * Math.PI * 2, Math.PI / 4), mat(k % 2 ? 0xf7f2e9 : 0xc8643c), 0, 0.12, 0);
          seg.castShadow = true;
        }
        Sp(um, 0.05, 0x8a5a3b, 0, 0.36, 0);
        g.add(um);
        Cy(g, 0.22, 0.22, 0.04, 0xf7f2e9, x + 1.12, 0.5, -0.1, 18);
        Cy(g, 0.025, 0.025, 0.42, 0x8a5a3b, x + 1.12, 0.08, -0.1, 6);
        Cy(g, 0.035, 0.03, 0.14, 0xf0a23c, x + 1.05, 0.54, -0.05, 10);
      }
    });
    // thatched bar on the left
    const bar = new THREE.Group(); bar.position.set(-4.2, 0.08, 1.4);
    B(bar, 2.2, 1.05, 0.7, 0xb17a50, 0, 0, 0);
    B(bar, 2.4, 0.07, 0.85, 0xf7f2e9, 0, 1.05, 0);
    [[-1.05, -0.5], [1.05, -0.5], [-1.05, 0.9], [1.05, 0.9]].forEach(([a, b]) => Cy(bar, 0.06, 0.06, 2.5, 0x7a4f33, a, 0, b, 8));
    const thatch = mesh(bar, new THREE.ConeGeometry(2.0, 0.9, 4, 1), mat(0xd9b56f), 0, 2.85, 0.2);
    thatch.rotation.y = Math.PI / 4; thatch.scale.set(1, 1, 0.8);
    for (let i = 0; i < 9; i++) bottle(bar, -0.9 + i * 0.22, 1.12, -0.1, [0xf0a23c, 0x3f8f6a, 0xc2407e][i % 3], 0.9);
    g.add(bar);
    [-4.9, -4.2, -3.5].forEach((x) => stool(g, x, 2.25, 0xd9b56f, 0x7a4f33));
    // palms
    const p1 = kit.palm(g, 4.9, -2.6, 2.4, -0.9); p1.position.y = 0.05;
    const p2 = kit.palm(g, -5.6, -2.8, 2.1, 0.8); p2.position.y = -0.6;
    plant(g, 4.6, 2.2, 1.3, 0xefe5d3, 0x6f8f4e);
    // string lights between posts across the deck
    [-1.5, 1.5].forEach((zz) => {
      Cy(g, 0.04, 0.05, 2.8, 0x7a4f33, -deckW / 2 + 0.15, 0.08, zz, 8);
      Cy(g, 0.04, 0.05, 2.8, 0x7a4f33, deckW / 2 - 0.15, 0.08, zz, 8);
    });
    const bulbM = lampMat(0xfff2d6);
    const wireM = toon({ color: 0x4a3a30 }); // thin wires: no ink outline
    [-1.5, 1.5].forEach((zz) => {
      let px = 0, py = 0;
      for (let i = 0; i <= 16; i++) {
        const t = i / 16;
        const x = -deckW / 2 + 0.15 + t * (deckW - 0.3), y = 2.8 - Math.sin(Math.PI * t) * 0.45;
        Sp(g, 0.055, bulbM, x, y - 0.06, zz);
        if (i) { // the wire between bulbs
          const len = Math.hypot(x - px, y - py);
          const wire = mesh(g, new THREE.CylinderGeometry(0.007, 0.007, len, 4), wireM, (x + px) / 2, (y + py) / 2, zz);
          wire.rotation.z = Math.atan2(y - py, x - px) - Math.PI / 2; wire.castShadow = false;
        }
        px = x; py = y;
      }
    });
    // the sun low over the sea (the moon at night)
    const discM = new THREE.MeshBasicMaterial({ color: 0xfff1cf });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(4.5, 40), discM);
    disc.position.set(-14, 9, -78); disc.lookAt(0, 1.5, 0);
    disc.userData.keep = true;
    g.add(disc);
    // the gate behind you
    [-0.75, 0.75].forEach((x) => Cy(g, 0.06, 0.07, 2.6, 0x7a4f33, x, 0.08, deckD / 2 - 0.05, 8));
    B(g, 1.9, 0.1, 0.12, 0x7a4f33, 0, 2.6, deckD / 2 - 0.05);
    return {
      group: g,
      door: { pos: [0, 1.7, deckD / 2 + 0.4], look: [0, 1.4, -10] },
      view: { pos: [0, 2.15, deckD / 2 + 0.1], look: [0, 0.55, -12] },
      bg: [0xf6dcb6, 0x111a3a], hemi: [0xe8f1f6, 0xe2c9a4, 1.15], sun: [-6, 9, -20], sunInt: 1.8, sunColor: 0xfff0d6,
      lamps: [[-4.2, 2.0, 1.4], [0, 2.4, 0], [3, 2.4, -1]], lampDay: 0, lampNight: 2.6, yaw: 0.75,
      update(t) { seaM.uniforms.uTime.value = t; },
      night(n) {
        skyM.uniforms.uNight.value = n; seaM.uniforms.uNight.value = n;
        discM.color.setRGB(1, 0.95 - n * 0.02, 0.81 + n * 0.15);
        disc.scale.setScalar(1 - n * 0.45);
        cloudM.color.setRGB(1 - n * 0.6, 1 - n * 0.55, 1 - n * 0.35); cloudM.emissiveIntensity = 0.35 * (1 - n);
        lightLamps([bulbM], n, 0.12);
      },
    };
  };

  /* ======================= DÉJÀ VU · lounge & bar ======================= */
  ROOMS.deja = () => {
    const g = new THREE.Group();
    const w = 9, d = 8, h = 3.8;
    const wall = 0x2f4b55, wains = 0x5b3a2c;
    shell(g, { w, d, h, wall, floor: 0x6b4430, ceil: 0x26333d, base: 0x3e2a20 });
    planks(g, w, d, 0x8a5a3b, 0x7a4f33, 0.32, true);
    // wainscot
    B(g, w, 1.1, 0.06, wains, 0, 0, -d / 2 + 0.03);
    B(g, 0.06, 1.1, d, wains, -w / 2 + 0.03, 0, 0);
    B(g, 0.06, 1.1, d, wains, w / 2 - 0.03, 0, 0);
    [-d / 2 + 0.08].forEach((z) => B(g, w, 0.05, 0.1, C.gold, 0, 1.1, z));
    const pane = paneMat(0xcfe0e6, 0x16203f);
    [-1.5, 1.5].forEach((z) => windowOn(g, pane, -w / 2, 1.0, z, 1.0, 2.1, Math.PI / 2, 0x3e2a20, true));
    // bar along the back
    const brass = 0xd6a64f;
    B(g, 5.2, 1.08, 0.7, 0x3e2a20, 0.9, 0, -d / 2 + 1.55);
    B(g, 5.4, 0.07, 0.85, 0x1f2a30, 0.9, 1.08, -d / 2 + 1.55);
    B(g, 5.2, 0.04, 0.04, brass, 0.9, 0.22, -d / 2 + 1.93);
    for (let i = 0; i < 6; i++) stool(g, -1.2 + i * 0.85, -d / 2 + 2.45, 0xa8336a, brass);
    // back bar: arched mirror and shelves of bottles
    const mirror = paneMat(0x9fb4b8, 0x3b4660);
    windowOn(g, mirror, 0.9, 1.25, -d / 2 + 0.01, 1.4, 2.1, 0, brass, true);
    const bcol = [0xd98c3a, 0x3f6f4a, 0xe9e2c8, 0x8c2f3a, 0xc9a34a];
    [-1.3, 3.1].forEach((x) => {
      [1.3, 1.85, 2.4].forEach((y, r) => {
        B(g, 1.6, 0.04, 0.3, 0x3e2a20, x, y, -d / 2 + 0.17);
        for (let i = 0; i < 6; i++) bottle(g, x - 0.65 + i * 0.26, y + 0.04, -d / 2 + 0.17, bcol[(i + r) % 5], 1.1);
      });
    });
    // lounge on the left: velvet sofas, brass table, candles
    const sofa = (x, z, ry) => {
      const s = new THREE.Group(); s.position.set(x, 0, z); s.rotation.y = ry;
      B(s, 1.9, 0.42, 0.8, 0xa8336a, 0, 0.0, 0);
      B(s, 1.9, 0.5, 0.22, 0x962b5d, 0, 0.42, -0.29);
      [-0.95, 0.95].forEach((a) => { const arm = mesh(s, new THREE.CylinderGeometry(0.16, 0.16, 0.8, 16), mat(0x962b5d), a, 0.5, 0); arm.rotation.x = Math.PI / 2; });
      [-0.45, 0.45].forEach((a) => B(s, 0.85, 0.12, 0.62, 0xb8407a, a, 0.42, 0.06));
      g.add(s);
    };
    sofa(-2.6, -0.4, Math.PI / 2);
    sofa(-0.5, 1.0, Math.PI);
    Cy(g, 0.5, 0.5, 0.05, brass, -1.4, 0.42, 0.1, 28);
    Cy(g, 0.06, 0.08, 0.42, brass, -1.4, 0, 0.1, 10);
    const candleM = lampMat(0xfff4dd, 0xffb347);
    [[-1.5, 0.0], [-1.25, 0.2], [-1.45, 0.3]].forEach(([x, z], i) => { Cy(g, 0.035, 0.035, 0.12 + i * 0.04, 0xfff7e6, x, 0.47, z, 10); Sp(g, 0.02, candleM, x, 0.62 + i * 0.04, z); });
    // round rug
    const rug = mesh(g, new THREE.CylinderGeometry(1.6, 1.6, 0.015, 40), mat(0x7b2d4f), -1.5, 0.01, 0.2); rug.castShadow = false;
    const rug2 = mesh(g, new THREE.CylinderGeometry(1.35, 1.35, 0.016, 40), mat(0x9a3d60), -1.5, 0.012, 0.2); rug2.castShadow = false;
    // globe pendants over the bar, brass sconces
    const globeM = lampMat(0xfff6e6, 0xffd08a);
    [-0.9, 0.9, 2.7].forEach((x) => pendant(g, x, -d / 2 + 1.55, h, 1.2, null, globeM, 'globe'));
    [-1.5, 1.5].forEach((z) => { B(g, 0.08, 0.3, 0.08, brass, w / 2 - 0.05, 1.7, z); Sp(g, 0.09, globeM, w / 2 - 0.15, 2.05, z); });
    plant(g, -w / 2 + 0.6, -d / 2 + 0.6, 1.6, 0x3e2a20, 0x4f6b3e);
    plant(g, w / 2 - 0.6, 2.4, 1.4, 0x3e2a20, 0x4f6b3e);
    art(g, w / 2 - 0.02, 1.6, 0.2, -Math.PI / 2, 1.1, 1.4, 0x1f2a30, [[0xa8336a, 0, 0.1, 0.32], [C.gold, 0.2, -0.3, 0.1]]);
    return {
      group: g,
      door: { pos: [0, 1.55, d / 2 + 0.05], look: [0, 1.45, -d / 2] },
      view: { pos: [0.4, 1.6, d / 2 - 1.4], look: [-0.25, 1.2, -d / 2 + 0.6] },
      bg: [0x2f4b55, 0x161c26], hemi: [0xffe8d0, 0x7a5a4a, 1.0], sun: [-4, 9, 4], sunInt: 1.0, sunColor: 0xffe2c0,
      lamps: [[0.9, 2.2, -2.4], [-1.4, 1.2, 0.1], [3.4, 2.0, 0]], lampDay: 1.2, lampNight: 3.4,
      night(n) { tintPanes([pane, mirror], n); lightLamps([globeM, candleM], n, 0.9); },
    };
  };

  /* ======================= M04 · glass pavilion ======================= */
  ROOMS.m04 = () => {
    const g = new THREE.Group();
    const w = 10, d = 8, h = 3.7;
    const wall = 0xf2eee8;
    // no back wall: a full-height glass front onto the garden
    B(g, w + 0.32, 0.12, d + 0.32, 0xd5d0c7, 0, -0.12, 0);
    for (let i = 1; i < 5; i++) B(g, w, 0.005, 0.02, 0xbdb7ad, 0, 0.0, -d / 2 + i * (d / 5));
    for (let i = 1; i < 5; i++) B(g, 0.02, 0.005, d, 0xbdb7ad, -w / 2 + i * (w / 5), 0.0, 0);
    B(g, 0.16, h, d, wall, -w / 2 - 0.08, 0, 0);
    B(g, 0.16, h, d, wall, w / 2 + 0.08, 0, 0);
    B(g, (w - 1.3) / 2 + 0.16, h, 0.16, wall, -(0.65 + (w - 1.3) / 4) - 0.08, 0, d / 2 + 0.08);
    B(g, (w - 1.3) / 2 + 0.16, h, 0.16, wall, 0.65 + (w - 1.3) / 4 + 0.08, 0, d / 2 + 0.08);
    B(g, 1.3, h - 2.45, 0.16, wall, 0, 2.45, d / 2 + 0.08);
    B(g, w + 0.32, 0.18, d + 0.32, 0x3a3a3c, 0, h, 0);
    const glowDoor = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 2.45), new THREE.MeshBasicMaterial({ color: 0xfff0d6 }));
    glowDoor.position.set(0, 1.225, d / 2 + 0.17); glowDoor.rotation.y = Math.PI; g.add(glowDoor);
    // glass wall: thin dark mullions
    for (let i = 0; i <= 5; i++) B(g, 0.07, h, 0.1, 0x2b2b2d, -w / 2 + i * (w / 5), 0, -d / 2);
    B(g, w, 0.08, 0.1, 0x2b2b2d, 0, 0, -d / 2);
    B(g, w, 0.08, 0.1, 0x2b2b2d, 0, h - 0.08, -d / 2);
    B(g, w, 0.05, 0.08, 0x2b2b2d, 0, 2.6, -d / 2);
    // the garden outside
    const skyM = sky(g, 0x9fcbe0, 0xeaf0e8, 0x10183a, 0x2f2f5a);
    B(g, 60, 0.1, 40, 0xa3b07c, 0, -0.2, -d / 2 - 20);
    B(g, 14, 0.04, 2.4, 0xefe5d3, 0, -0.12, -d / 2 - 1.6);
    [[-3.5, -7.5, 2.4], [-1.2, -9.5, 2.9], [2.2, -8.4, 2.6], [4.6, -6.6, 2.2], [6.5, -10, 3]].forEach(([x, z, s]) => kit.cypress(g, x, z, s));
    [[-5.5, -9, 2.2], [0.6, -12, 2.6], [3.6, -12.5, 2.4]].forEach(([x, z, s]) => kit.olive(g, x, z, s));
    kit.bush(g, -2.4, -6.0, C.magenta, 2.2); kit.bush(g, 1.0, -6.2, C.pink, 2.0); kit.bush(g, 3.4, -5.6, C.magenta, 1.8);
    const cloudM = skyClouds(g, 4, 12, 55);
    // long oak table and benches
    const oak = 0xc39a6b;
    B(g, 4.2, 0.07, 1.1, oak, 0, 0.73, -1.3);
    [[-1.9, -1.3], [1.9, -1.3]].forEach(([x, z]) => { B(g, 0.08, 0.73, 0.9, 0x2b2b2d, x, 0, z); });
    [-1.95, -0.65].forEach((z) => { B(g, 3.8, 0.06, 0.38, oak, 0, 0.44, z); [-1.7, 1.7].forEach((x) => B(g, 0.06, 0.44, 0.32, 0x2b2b2d, x, 0, z)); });
    for (let i = 0; i < 5; i++) {
      Cy(g, 0.09, 0.07, 0.16 + (i % 2) * 0.1, [0xc8643c, 0xefe5d3, 0x7d8a58][i % 3], -1.4 + i * 0.7, 0.8, -1.3 + (i % 2 ? 0.2 : -0.15), 14);
    }
    // a big ring of light above the table
    const ringM = lampMat(0xfff4e0, 0xffe0b0);
    const ring = mesh(g, new THREE.TorusGeometry(1.1, 0.05, 10, 64), ringM, 0, 2.6, -1.3); ring.rotation.x = Math.PI / 2;
    [-1, 1].forEach((x) => Cy(g, 0.006, 0.006, 1.1, 0x2b2b2d, x * 0.78, 2.6, -1.3 + x * 0.78, 4));
    // shelves on the right wall with ceramics
    for (let r = 0; r < 4; r++) {
      B(g, 0.4, 0.04, 3.2, 0x2b2b2d, w / 2 - 0.2, 0.5 + r * 0.55, 1.2);
      for (let i = 0; i < 5; i++) {
        const hx = [0xc8643c, 0xefe5d3, 0x7d8a58, 0xd6a64f, 0x3a3a3c][(i + r) % 5];
        if ((i + r) % 2) Sp(g, 0.1, hx, w / 2 - 0.2, 0.64 + r * 0.55, -0.1 + i * 0.6);
        else Cy(g, 0.08, 0.1, 0.22, hx, w / 2 - 0.2, 0.54 + r * 0.55, -0.1 + i * 0.6, 14);
      }
    }
    for (let i = 0; i < 2; i++) B(g, 0.04, 2.2, 0.04, 0x2b2b2d, w / 2 - 0.05, 0, -0.4 + i * 3.2);
    // lounge corner: sofa, rug, arc lamp
    const rug = mesh(g, new THREE.CylinderGeometry(1.4, 1.4, 0.015, 40), mat(0x7d8a58), -3.2, 0.01, 1.6); rug.castShadow = false;
    B(g, 2.0, 0.4, 0.85, 0xefe5d3, -4.3, 0, 1.6, Math.PI / 2);
    B(g, 0.22, 0.45, 2.0, 0xe2d6c2, -4.68, 0.4, 1.6);
    Cy(g, 0.3, 0.3, 0.04, 0x2b2b2d, -3.0, 0.45, 1.6, 22);
    Cy(g, 0.03, 0.03, 0.45, 0x2b2b2d, -3.0, 0, 1.6, 8);
    const arcM = lampMat(0xfff4e0);
    const arc = mesh(g, new THREE.TorusGeometry(1.0, 0.025, 6, 32, Math.PI * 0.75), mat(0x2b2b2d), -4.3, 1.2, 2.6);
    arc.rotation.y = Math.PI / 2;
    Sp(g, 0.16, arcM, -4.3 + 0.0, 2.18, 1.65);
    art(g, -w / 2 + 0.01, 1.4, -1.4, Math.PI / 2, 1.6, 1.6, 0xf7efe2, [[C.terracotta, 0, 0, 0.55]]);
    plant(g, w / 2 - 0.7, -d / 2 + 0.8, 2.0, 0x3a3a3c, 0x557a45);
    plant(g, -w / 2 + 0.7, -d / 2 + 0.8, 1.6, 0x3a3a3c, 0x6f8f4e);
    return {
      group: g,
      door: { pos: [0, 1.55, d / 2 + 0.1], look: [0, 1.4, -d / 2 - 2] },
      view: { pos: [0.3, 1.8, d / 2 - 0.5], look: [0, 1.15, -d / 2 - 1] },
      bg: [0xeaf0e8, 0x10183a], hemi: [0xf4f6f2, 0xbcb3a3, 1.2], sun: [5, 9, -8], sunInt: 1.7,
      lamps: [[0, 2.3, -1.3], [-4.0, 2.0, 1.6], [3.5, 2.0, 1.5]], lampDay: 0.0, lampNight: 3.0,
      night(n) {
        skyM.uniforms.uNight.value = n;
        cloudM.color.setRGB(1 - n * 0.6, 1 - n * 0.55, 1 - n * 0.35); cloudM.emissiveIntensity = 0.35 * (1 - n);
        lightLamps([ringM, arcM], n, 0.35);
      },
    };
  };

  /* ======================= RANDEZVOU · café ======================= */
  ROOMS.randez = () => {
    const g = new THREE.Group();
    const w = 8, d = 7, h = 3.4;
    const wall = 0xf4ecdc, green = 0x7d8a58;
    shell(g, { w, d, h, wall, floor: 0xd8c8ad, ceil: 0xf8f1e4, base: green });
    tiles(g, w, d, 0xf3ead8, 0xc8643c, 0.5);
    // olive wainscot
    B(g, w, 1.0, 0.05, green, 0, 0, -d / 2 + 0.03);
    B(g, 0.05, 1.0, d, green, -w / 2 + 0.03, 0, 0);
    B(g, 0.05, 1.0, d, green, w / 2 - 0.03, 0, 0);
    // striped valance over the counter
    for (let i = 0; i < 16; i++) {
      const s = B(g, 0.35, 0.42, 0.04, i % 2 ? 0xf7f2e9 : 0xc8643c, -2.62 + i * 0.35, 2.55, -d / 2 + 1.25);
      s.rotation.x = 0.25;
    }
    // counter with a pastry case and an espresso machine
    B(g, 5.6, 1.0, 0.75, green, 0, 0, -d / 2 + 1.0);
    B(g, 5.8, 0.06, 0.9, 0xf7f4ee, 0, 1.0, -d / 2 + 1.0);
    const glass = paneMat(0xe8f4f4, 0x8fa3b8);
    glass.transparent = true; glass.opacity = 0.35; glass.depthWrite = false;
    const caseG = new THREE.Group(); caseG.position.set(-1.3, 1.06, -d / 2 + 1.05);
    B(caseG, 1.8, 0.04, 0.6, 0xf7f4ee, 0, 0.0, 0);
    const front = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.45), glass); front.position.set(0, 0.25, 0.31); front.rotation.x = -0.25; caseG.add(front);
    B(caseG, 1.8, 0.03, 0.6, 0xf7f4ee, 0, 0.48, 0);
    [-0.88, 0.88].forEach((x) => B(caseG, 0.04, 0.48, 0.6, 0x3a3a3c, x, 0, 0));
    const pastry = [0xd6a64f, 0xb5835f, 0xe58fb3, 0xefdcbc];
    for (let i = 0; i < 7; i++) { const b = mesh(caseG, blob(0.07, 1, 0.15, 0.6), mat(pastry[i % 4]), -0.75 + i * 0.25, 0.08, 0.02 * (i % 2)); b.castShadow = false; }
    for (let i = 0; i < 6; i++) { const b = mesh(caseG, blob(0.06, 1, 0.15, 0.6), mat(pastry[(i + 2) % 4]), -0.65 + i * 0.26, 0.28, 0); b.castShadow = false; }
    g.add(caseG);
    const em = new THREE.Group(); em.position.set(1.4, 1.06, -d / 2 + 0.95);
    B(em, 0.8, 0.5, 0.45, 0xc9c9c4, 0, 0, 0);
    B(em, 0.84, 0.06, 0.49, 0x3a3a3c, 0, 0.5, 0);
    [-0.2, 0.2].forEach((x) => { Cy(em, 0.03, 0.03, 0.08, 0x3a3a3c, x, 0.12, 0.26, 8); Cy(em, 0.05, 0.04, 0.07, 0xffffff, x, 0.02, 0.28, 12); });
    Sp(em, 0.035, C.gold, -0.3, 0.38, 0.23); Sp(em, 0.035, C.gold, 0.3, 0.38, 0.23);
    g.add(em);
    for (let i = 0; i < 6; i++) Cy(g, 0.045, 0.04, 0.09, 0xffffff, 2.3 + (i % 3) * 0.12, 1.06 + Math.floor(i / 3) * 0.09, -d / 2 + 1.1, 10);
    // back wall: shelves of cups and a chalkboard
    [1.45, 1.95].forEach((y) => {
      B(g, 2.0, 0.04, 0.25, 0x8a5a3b, 1.6, y, -d / 2 + 0.13);
      for (let i = 0; i < 7; i++) Cy(g, 0.05, 0.04, 0.1, i % 3 ? 0xffffff : 0xc8643c, 0.8 + i * 0.27, y + 0.04, -d / 2 + 0.13, 10);
    });
    B(g, 1.6, 1.0, 0.04, 0x2f3533, -1.5, 1.4, -d / 2 + 0.02);
    B(g, 1.7, 1.1, 0.03, 0x8a5a3b, -1.5, 1.35, -d / 2 + 0.01);
    for (let i = 0; i < 5; i++) B(g, 0.5 + (i % 2) * 0.5, 0.025, 0.01, 0xf3ead8, -1.75 + (i % 2) * 0.2, 1.6 + i * 0.15, -d / 2 + 0.045);
    // bulbs on cords
    const bulbM = lampMat(0xfff4dd);
    [-2.2, -0.8, 0.6, 2.0].forEach((x) => pendant(g, x, -d / 2 + 1.0, h, 1.2, null, bulbM, 'bulb'));
    // marble tables, bistro chairs, little vases
    [[-2.0, 0.6], [0.0, 1.0], [2.0, 0.6], [-1.0, 2.2]].forEach(([x, z], i) => {
      roundTable(g, x, z, 0xf7f4ee, 0x2b2b2d, 0.36);
      chair(g, x - 0.6, z + 0.15, Math.PI / 2 - 0.2, 0x8a5a3b, 0x2b2b2d);
      chair(g, x + 0.6, z - 0.1, -Math.PI / 2 + 0.2, 0x8a5a3b, 0x2b2b2d);
      Cy(g, 0.04, 0.05, 0.12, 0xd9e8ea, x, 0.76, z, 10);
      Blob(g, 0.07, i % 2 ? C.pink : C.magenta, x, 0.93, z, 1);
      Cy(g, 0.045, 0.04, 0.07, 0xffffff, x + 0.15, 0.76, z + 0.1, 10);
    });
    // window with a striped awning outside
    const pane = paneMat(0xd3ebf0, 0x1c2648);
    windowOn(g, pane, -w / 2, 0.95, 0.6, 1.8, 1.7, Math.PI / 2, 0xf7f2e9, false);
    plant(g, w / 2 - 0.55, 2.6, 1.3, 0xc8643c, 0x6f8f4e);
    plant(g, -w / 2 + 0.5, -d / 2 + 2.0, 1.1, 0xf7f2e9, 0x7d8a58);
    art(g, w / 2 - 0.02, 1.5, 0.6, -Math.PI / 2, 1.0, 1.2, 0xf7efe2, [[0x7d8a58, -0.1, 0.1, 0.25], [0xe58fb3, 0.18, -0.2, 0.14]]);
    return {
      group: g,
      door: { pos: [0, 1.5, d / 2 + 0.05], look: [0, 1.35, -d / 2] },
      view: { pos: [0.25, 1.75, d / 2 - 0.45], look: [0, 1.0, -d / 2 + 0.6] },
      bg: [0xf4ecdc, 0x251f2c], hemi: [0xfff4e6, 0xc8a88a, 1.25], sun: [-4, 9, 5], sunInt: 1.4,
      lamps: [[-1.5, 2.0, -2.5], [1.4, 2.0, -2.5], [0, 2.2, 1.2]], lampDay: 0.2, lampNight: 2.8,
      night(n) { tintPanes([pane], n); glass.color.copy(glass.userData.day).lerp(glass.userData.night, n); lightLamps([bulbM], n, 0.6); },
    };
  };

  /* ======================= Services Company · the rotunda, eight stations ======================= */
  const DEPTS = ['Culinary & Beverage', 'Creative & Experience', 'Marketing & CRM', 'People & Culture', 'Operations Excellence', 'Project Development & Opening', 'Procurement & Supply Chain', 'Technology, Data & Systems'];
  ROOMS.services = () => {
    const g = new THREE.Group();
    const RR = 5.2, h = 4.0;
    const wall = 0xf4ebdc, cream = 0xefe5d3, gold = 0xd6a64f;
    // floor rings
    Cy(g, RR + 0.2, RR + 0.2, 0.12, 0xe6d8c2, 0, -0.12, 0, 64);
    Cy(g, 3.2, 3.2, 0.02, 0xd9b9a0, 0, 0, 0, 64);
    Cy(g, 2.9, 2.9, 0.025, 0xf6efe4, 0, 0, 0, 64);
    const inlay = mesh(g, new THREE.TorusGeometry(2.0, 0.035, 4, 72), mat(gold), 0, 0.03, 0); inlay.rotation.x = Math.PI / 2; inlay.castShadow = false;
    Cy(g, 1.2, 1.2, 0.03, C.terracotta, 0, 0, 0, 48);
    // the wall: panels with pilasters, an opening at the door (+z)
    const N = 24;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.14) continue; // doorway
      const p = B(g, (2 * Math.PI * RR) / N + 0.04, h, 0.2, wall, Math.sin(a) * (RR + 0.1), 0, Math.cos(a) * (RR + 0.1));
      p.rotation.y = a;
      if (i % 3 === 0) { const pil = Cy(g, 0.13, 0.15, h, cream, Math.sin(a) * (RR - 0.05), 0, Math.cos(a) * (RR - 0.05), 14); pil.castShadow = true; }
    }
    // lintel over the door and the door light
    B(g, 1.5, h - 2.45, 0.22, wall, 0, 2.45, RR + 0.1);
    const glowDoor = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 2.45), new THREE.MeshBasicMaterial({ color: 0xfff0d6 }));
    glowDoor.position.set(0, 1.225, RR + 0.22); glowDoor.rotation.y = Math.PI; g.add(glowDoor);
    // cornice and the dome
    const cor = mesh(g, new THREE.TorusGeometry(RR - 0.05, 0.12, 6, 64), mat(cream), 0, h, 0); cor.rotation.x = Math.PI / 2;
    const domeGeo = new THREE.SphereGeometry(RR + 0.1, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    domeGeo.scale(1, 0.55, 1);
    // turn it inside out so we see it from below
    { const idx = domeGeo.index.array; for (let i = 0; i < idx.length; i += 3) { const t = idx[i]; idx[i] = idx[i + 2]; idx[i + 2] = t; } const nn = domeGeo.attributes.normal; for (let i = 0; i < nn.count; i++) nn.setXYZ(i, -nn.getX(i), -nn.getY(i), -nn.getZ(i)); }
    const dome = mesh(g, domeGeo, mat(0xf2e3cf), 0, h, 0); dome.castShadow = false;
    const oculusM = lampMat(0xfff8e6, 0xffe9c0);
    const oc = mesh(g, new THREE.CircleGeometry(0.75, 40), oculusM, 0, h + (RR + 0.1) * 0.55 - 0.02, 0); oc.rotation.x = Math.PI / 2; oc.castShadow = false;
    // central plinth and the floating gold ring
    Cy(g, 0.75, 0.85, 0.5, cream, 0, 0, 0, 32);
    Cy(g, 0.78, 0.78, 0.05, gold, 0, 0.5, 0, 32);
    const ringG = new THREE.Group(); ringG.position.set(0, 2.8, 0); ringG.rotation.x = Math.PI / 2;
    const ringMesh = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.055, 12, 96), toon({ color: gold, emissive: gold, emissiveIntensity: 0.15 }));
    ringG.add(ringMesh);
    keep(ringG);
    g.add(ringG);
    // eight stations
    const st = new THREE.Group();
    g.add(st);
    const step = (Math.PI * 2) / 9;
    const tags = [];
    const screenM = lampMat(0xbfe7ef, 0x7fd0e0);
    const ledM = lampMat(0x9fe0a0, 0x7fe08a);
    DEPTS.forEach((name, i) => {
      const a = Math.PI - 3.5 * step + i * step;
      const r = 3.75;
      const s = new THREE.Group();
      s.position.set(Math.sin(a) * r, 0, Math.cos(a) * r);
      s.rotation.y = a + Math.PI; // face the centre
      Cy(s, 0.55, 0.62, 0.85, cream, 0, 0, 0, 28);
      Cy(s, 0.57, 0.57, 0.05, gold, 0, 0.85, 0, 28);
      // number plaque on the floor
      const pl = mesh(s, new THREE.CircleGeometry(0.22, 24), mat(C.terracotta), 0, 0.012, 0.95); pl.rotation.x = -Math.PI / 2; pl.castShadow = false;
      const top = 0.9;
      if (i === 0) { // culinary & beverage: a copper pot, a bottle, a cup
        Cy(s, 0.2, 0.17, 0.24, 0xb87333, -0.08, top, 0, 22);
        Cy(s, 0.21, 0.21, 0.03, 0xa0612b, -0.08, top + 0.24, 0, 22);
        Sp(s, 0.04, 0x3a3a3c, -0.08, top + 0.3, 0);
        bottle(s, 0.28, top, -0.12, 0x5b2333, 1.6);
        Cy(s, 0.06, 0.05, 0.09, 0xffffff, 0.25, top, 0.2, 12);
      } else if (i === 1) { // creative & experience: an easel with a painting
        const e = new THREE.Group(); e.position.set(0, top, 0);
        [[-0.25, 0.08], [0.25, 0.08]].forEach(([x, z]) => { const l = B(e, 0.04, 1.1, 0.04, 0x8a5a3b, x, 0, z); l.rotation.x = -0.12; });
        const back = B(e, 0.04, 1.0, 0.04, 0x8a5a3b, 0, 0, -0.25); back.rotation.x = 0.3;
        B(e, 0.62, 0.48, 0.03, 0xfbf6ee, 0, 0.45, 0.1);
        [[C.terracotta, -0.12, 0.72, 0.1], [0x2f8f9a, 0.12, 0.62, 0.08], [gold, 0.02, 0.55, 0.06], [C.magenta, -0.15, 0.55, 0.05]].forEach(([hx, x, y, rr]) => { const c = mesh(e, new THREE.CircleGeometry(rr, 20), mat(hx), x, y, 0.118); c.castShadow = false; });
        B(e, 0.6, 0.03, 0.08, 0x8a5a3b, 0, 0.42, 0.13);
        s.add(e);
      } else if (i === 2) { // marketing & CRM: a megaphone and a rising chart
        const mg = lathe(s, [[0.04, 0], [0.06, 0.12], [0.2, 0.42], [0.22, 0.45], [0.0, 0.45]], 0xf7f2e9, -0.12, top + 0.2, 0, 22);
        mg.rotation.z = Math.PI / 2 + 0.25;
        Cy(s, 0.03, 0.03, 0.18, C.terracotta, -0.05, top, 0, 8);
        [[0.18, 0.18, 0x2f8f9a], [0.3, 0.3, gold], [0.42, 0.44, C.terracotta]].forEach(([x, hh, hx]) => B(s, 0.09, hh, 0.09, hx, x, top, 0.12));
      } else if (i === 3) { // people & culture: little figures together
        [[0, -0.15, C.terracotta], [-0.2, 0.1, 0x2f8f9a], [0.2, 0.1, gold], [0, 0.22, 0x7d8a58]].forEach(([x, z, hx]) => {
          Cy(s, 0.07, 0.1, 0.26, hx, x, top, z, 16);
          Sp(s, 0.075, 0xf3d9c0, x, top + 0.35, z);
        });
      } else if (i === 4) { // operations excellence: a gear and a checklist
        const gear = new THREE.Group(); gear.position.set(-0.08, top + 0.38, 0);
        const ring = mesh(gear, new THREE.TorusGeometry(0.24, 0.07, 8, 32), mat(0x8c8a84), 0, 0, 0);
        ring.castShadow = true;
        for (let k = 0; k < 10; k++) { const tt = B(gear, 0.09, 0.1, 0.1, 0x8c8a84, Math.cos((k / 10) * Math.PI * 2) * 0.33, -0.05, 0); tt.position.y = Math.sin((k / 10) * Math.PI * 2) * 0.33; tt.rotation.z = (k / 10) * Math.PI * 2; }
        Cy(gear, 0.06, 0.06, 0.16, gold, 0, -0.08, 0, 12).rotation.x = Math.PI / 2;
        s.add(gear);
        Cy(s, 0.03, 0.03, 0.3, 0x8c8a84, -0.08, top, 0, 8);
        const cb = B(s, 0.26, 0.34, 0.02, 0x8a5a3b, 0.3, top, 0.1); cb.rotation.x = -0.3;
        for (let k = 0; k < 3; k++) B(s, 0.16, 0.02, 0.01, 0xfbf6ee, 0.32, top + 0.08 + k * 0.08, 0.11 + k * 0.02);
      } else if (i === 5) { // project development & opening: an architectural model
        B(s, 0.8, 0.04, 0.6, 0xf7f2e9, 0, top, 0);
        [[-0.25, -0.1, 0.22, C.white], [0.05, 0.08, 0.32, C.cream], [0.25, -0.12, 0.16, C.white]].forEach(([x, z, hh, hx]) => {
          B(s, 0.18, hh, 0.18, hx, x, top + 0.04, z);
          const roof = mesh(s, new THREE.ConeGeometry(0.15, 0.1, 4), mat(C.terracotta), x, top + 0.04 + hh + 0.05, z); roof.rotation.y = Math.PI / 4;
        });
        const tree = Blob(s, 0.07, 0x7d8a58, -0.05, top + 0.12, 0.2, 1);
        tree.castShadow = false;
        B(s, 0.03, 0.6, 0.03, gold, 0.36, top + 0.04, 0.2);
        B(s, 0.36, 0.03, 0.03, gold, 0.22, top + 0.62, 0.2);
      } else if (i === 6) { // procurement & supply chain: stacked crates
        const crate = (x, y, z, sz, ry) => { const c = B(s, sz, sz, sz, 0xb5835f, x, y, z, ry); for (let k = 0; k < 2; k++) B(s, sz + 0.01, 0.03, sz + 0.01, 0x8a5a3b, x, y + sz * (0.3 + k * 0.4), z, ry); return c; };
        crate(-0.15, top, 0, 0.32, 0.1);
        crate(0.2, top, 0.05, 0.28, -0.2);
        crate(0.0, top + 0.32, 0.0, 0.26, 0.35);
      } else { // technology, data & systems: a screen and a server
        B(s, 0.07, 0.24, 0.07, 0x3a3a3c, -0.1, top, 0);
        B(s, 0.6, 0.38, 0.04, 0x3a3a3c, -0.1, top + 0.24, 0);
        const scr = mesh(s, new THREE.PlaneGeometry(0.52, 0.3), screenM, -0.1, top + 0.43, 0.022); scr.castShadow = false;
        B(s, 0.22, 0.5, 0.3, 0x2b2b2d, 0.36, top, -0.05);
        for (let k = 0; k < 4; k++) Sp(s, 0.018, ledM, 0.3 + (k % 2) * 0.08, top + 0.12 + Math.floor(k / 2) * 0.15, 0.11);
      }
      st.add(s);
      tags.push({ n: String(i + 1).padStart(2, '0'), label: name, pos: [Math.sin(a) * r, 2.15, Math.cos(a) * r] });
    });
    return {
      group: g,
      door: { pos: [0, 1.6, RR + 0.4], look: [0, 1.5, 0] },
      view: { pos: [0, 1.65, 2.5], look: [0, 1.55, -3.8] },
      shadows: false, // lit from the oculus; curved walls and soft shadows do not mix
      bg: [0xf4ebdc, 0x1f1d2c], hemi: [0xfff6e8, 0xd9b9a0, 1.3], sun: [3, 11, 4], sunInt: 1.2,
      lamps: [[0, 3.4, 0], [-2.8, 2.6, -1.5], [2.8, 2.6, -1.5]], lampDay: 0.3, lampNight: 3.4,
      yaw: 'free', tags,
      update(t, dt, n, reduced) { if (!reduced) { ringG.rotation.y = t * 0.5; ringG.rotation.x = Math.PI / 2 + Math.sin(t * 0.7) * 0.2; ringG.position.y = 2.8 + Math.sin(t * 1.1) * 0.06; } },
      night(n) { lightLamps([oculusM], n, 0.2); lightLamps([screenM, ledM], n, 0.8); },
    };
  };

  return ROOMS;
};
