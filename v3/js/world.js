/* DORR v3 — the island.
   A hand-made looking floating round island, built procedurally with three.js:
   the Services Company rotunda at the centre, five brands around a ring path,
   a service van that keeps circling, drifting bougainvillea petals and a
   day/night cycle. Exposes a small API to the page (intro, select, night). */
window.DorrWorld = function (container, opts) {
  const THREE = window.THREE;
  const gsap = window.gsap;
  if (!THREE || !gsap) return null;
  opts = opts || {};

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) {
    return null;
  }
  const narrow = () => container.clientWidth < 700;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, narrow() ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.className = 'world__canvas';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 300);

  const C = {
    grass: 0xa3b07c, grassDark: 0x84935e, sand: 0xefdcbc, path: 0xf5ecdc, white: 0xf7f2e9, cream: 0xefe5d3,
    terracotta: 0xc8643c, clay: 0xb5835f, clayDeep: 0x7b4c36, olive: 0x7d8a58, cypress: 0x51603b,
    leaf: 0x6f8f4e, water: 0x5fbcbc, wood: 0x8a5a3b, straw: 0xd9b56f, gold: 0xd6a64f, magenta: 0xc2407e,
    pink: 0xe58fb3, navy: 0x24384a, charcoal: 0x3a3a3c, glass: 0x9cc6d6,
  };

  /* ---------------- helpers ---------------- */
  const cache = {};
  const mat = (hex, extra) => {
    const key = hex + (extra ? JSON.stringify(extra) : '');
    if (!cache[key]) cache[key] = new THREE.MeshStandardMaterial(Object.assign({ color: hex, roughness: 0.9, metalness: 0, flatShading: true }, extra || {}));
    return cache[key];
  };
  const inkMat = new THREE.MeshBasicMaterial({ color: 0x3b2a22, side: THREE.BackSide });
  const hidden = new THREE.MeshBasicMaterial({ visible: false });
  const mesh = (parent, geo, material, x, y, z) => {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x || 0, y || 0, z || 0);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const ink = (m, s) => { const o = new THREE.Mesh(m.geometry, inkMat); o.scale.setScalar(s || 1.06); m.add(o); return o; };
  const rand = (a, b) => a + Math.random() * (b - a);

  // materials that light up at night
  const glowMats = [];
  const glow = (hex, dayHex) => {
    const m = new THREE.MeshStandardMaterial({ color: dayHex || C.navy, emissive: hex, emissiveIntensity: 0, roughness: 0.4, flatShading: true });
    glowMats.push(m);
    return m;
  };
  const bulbs = [];
  const bulbMat = () => {
    const m = new THREE.MeshStandardMaterial({ color: 0xfff2d6, emissive: 0xffc46b, emissiveIntensity: 0.15 });
    bulbs.push(m);
    return m;
  };
  const string = (parent, a, b, n, sag) => {
    const bm = bulbMat();
    const geo = new THREE.SphereGeometry(0.045, 6, 4);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const p = new THREE.Vector3().lerpVectors(a, b, t);
      p.y -= Math.sin(Math.PI * t) * sag;
      const s = new THREE.Mesh(geo, bm);
      s.position.copy(p);
      parent.add(s);
    }
  };

  /* ---------------- world ---------------- */
  const world = new THREE.Group();
  scene.add(world);
  const island = new THREE.Group();
  world.add(island);
  const R = 7;

  // top: grass disc with a sand wedge for the beach
  const top = mesh(island, new THREE.CylinderGeometry(R, R * 0.97, 0.6, 72), mat(C.grass), 0, -0.3, 0);
  ink(top, 1.012);
  const beachA = (60 * Math.PI) / 180;
  const beach = mesh(island, new THREE.CylinderGeometry(R + 0.02, R * 0.97 + 0.02, 0.62, 24, 1, false, beachA - 0.75, 1.5), mat(C.sand), 0, -0.29, 0);
  beach.castShadow = false;

  // lagoon set into the island beside the beach club, with a sand rim
  const lagA = beachA + 0.62;
  const lagR = R - 1.85;
  const shore = mesh(island, new THREE.CylinderGeometry(1.95, 1.95, 0.06, 40), mat(C.sand), Math.sin(lagA) * lagR, 0.005, Math.cos(lagA) * lagR);
  shore.castShadow = false;
  const lagoon = mesh(island, new THREE.CylinderGeometry(1.55, 1.55, 0.06, 40), mat(C.water, { roughness: 0.15, metalness: 0.1, flatShading: false }), Math.sin(lagA) * lagR, 0.03, Math.cos(lagA) * lagR);
  lagoon.castShadow = false;
  const foam = mesh(island, new THREE.TorusGeometry(1.55, 0.035, 6, 48), mat(0xffffff, { flatShading: false }), lagoon.position.x, 0.06, lagoon.position.z);
  foam.rotation.x = Math.PI / 2;
  foam.castShadow = false;

  // rocky underside with a warm clay gradient
  const coneGeo = new THREE.ConeGeometry(R * 0.98, 6.2, 56, 7);
  coneGeo.rotateX(Math.PI);
  const pos = coneGeo.attributes.position;
  const colors = [];
  const top3 = new THREE.Color(C.clay), deep = new THREE.Color(C.clayDeep), tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const k = (3.1 - y) / 6.2; // 0 at top, 1 at tip
    if (k > 0.04 && k < 0.98) {
      const f = 1 + rand(-0.12, 0.12) * (0.4 + k);
      pos.setX(i, pos.getX(i) * f);
      pos.setZ(i, pos.getZ(i) * f);
      pos.setY(i, y + rand(-0.15, 0.15));
    }
    tmp.copy(top3).lerp(deep, Math.min(1, k * 1.2));
    colors.push(tmp.r, tmp.g, tmp.b);
  }
  coneGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  coneGeo.computeVertexNormals();
  const rock = mesh(island, coneGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }), 0, -3.7, 0);
  ink(rock, 1.01);

  // plaza and ring path
  mesh(island, new THREE.CylinderGeometry(1.9, 1.9, 0.05, 48), mat(C.path), 0, 0.02, 0).castShadow = false;
  const ringPath = mesh(island, new THREE.RingGeometry(4.15, 4.95, 96), mat(C.path, { side: THREE.DoubleSide }), 0, 0.03, 0);
  ringPath.rotation.x = -Math.PI / 2;
  ringPath.castShadow = false;
  [30, 150, 270].forEach((deg) => {
    const a = (deg * Math.PI) / 180;
    const p = mesh(island, new THREE.BoxGeometry(0.45, 0.04, 2.4), mat(C.path), Math.sin(a) * 3.0, 0.025, Math.cos(a) * 3.0);
    p.rotation.y = a;
    p.castShadow = false;
  });

  /* ---------------- vegetation ---------------- */
  const cypress = (parent, x, z, h) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const c = mesh(g, new THREE.ConeGeometry(0.22 * h, 1.6 * h, 7), mat(C.cypress), 0, 0.8 * h, 0);
    ink(c, 1.08);
    parent.add(g);
    return g;
  };
  const olive = (parent, x, z, s) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    mesh(g, new THREE.CylinderGeometry(0.05 * s, 0.08 * s, 0.6 * s, 5), mat(C.wood), 0, 0.3 * s, 0);
    const f = mesh(g, new THREE.IcosahedronGeometry(0.42 * s, 0), mat(C.olive), 0, 0.78 * s, 0);
    f.scale.set(1.2, 0.85, 1.1);
    ink(f, 1.07);
    parent.add(g);
    return g;
  };
  const palm = (parent, x, z, s, lean) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rand(0, Math.PI * 2);
    let y = 0, off = 0;
    for (let i = 0; i < 6; i++) {
      const seg = mesh(g, new THREE.CylinderGeometry(0.06 * s, 0.08 * s, 0.32 * s, 6), mat(C.wood), off, y + 0.16 * s, 0);
      seg.rotation.z = -lean * 0.4;
      y += 0.3 * s;
      off += lean * 0.06 * s * (i + 1) * 0.5;
    }
    for (let i = 0; i < 7; i++) {
      const leaf = mesh(g, new THREE.ConeGeometry(0.09 * s, 0.9 * s, 4), mat(C.leaf), off, y, 0);
      leaf.rotation.z = Math.PI / 2 - 0.35;
      leaf.rotation.y = (i / 7) * Math.PI * 2;
      leaf.position.x += Math.cos(leaf.rotation.y) * 0.35 * s;
      leaf.position.z -= Math.sin(leaf.rotation.y) * 0.35 * s;
      leaf.scale.z = 0.35;
    }
    parent.add(g);
    return g;
  };
  const bush = (parent, x, z, hex, s) => {
    const b = mesh(parent, new THREE.IcosahedronGeometry(0.22 * (s || 1), 0), mat(hex), x, 0.16 * (s || 1), z);
    b.scale.y = 0.75;
    return b;
  };

  /* ---------------- venues ---------------- */
  const venues = [];
  const venue = (id, deg, radius, build) => {
    const a = (deg * Math.PI) / 180;
    const g = new THREE.Group();
    g.position.set(Math.sin(a) * radius, 0, Math.cos(a) * radius);
    g.rotation.y = a; // face outwards toward the rim
    const h = build(g);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(2.4, h + 0.8, 2.4), hidden);
    hit.position.y = (h + 0.8) / 2;
    hit.userData.id = id;
    g.add(hit);
    island.add(g);
    venues.push({ id, a, radius, group: g, hit, height: h });
    return g;
  };

  // Services Company: rotunda with a floating gold ring
  let goldRing = null;
  venue('services', 0, 0, (g) => {
    mesh(g, new THREE.CylinderGeometry(1.25, 1.35, 0.18, 32), mat(C.cream), 0, 0.09, 0);
    const core = mesh(g, new THREE.CylinderGeometry(0.8, 0.8, 1.05, 24), glow(0xffcf8a, C.white), 0, 0.7, 0);
    core.material.color.set(C.white);
    ink(core, 1.04);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      mesh(g, new THREE.CylinderGeometry(0.06, 0.06, 1.05, 6), mat(C.white), Math.sin(a) * 1.08, 0.7, Math.cos(a) * 1.08);
    }
    const roof = mesh(g, new THREE.CylinderGeometry(1.25, 1.25, 0.12, 32), mat(C.cream), 0, 1.28, 0);
    ink(roof, 1.04);
    const dome = mesh(g, new THREE.SphereGeometry(0.78, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(C.terracotta), 0, 1.34, 0);
    ink(dome, 1.04);
    goldRing = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.05, 10, 64), new THREE.MeshStandardMaterial({ color: C.gold, metalness: 0.85, roughness: 0.25, emissive: C.gold, emissiveIntensity: 0.15 }));
    goldRing.position.y = 2.75;
    goldRing.castShadow = true;
    g.add(goldRing);
    return 2.4;
  });

  // DADA Restaurant: white house, terracotta roof, pergola terrace
  venue('dada', 0, 5.75, (g) => {
    const body = mesh(g, new THREE.BoxGeometry(1.7, 0.95, 1.1), mat(C.white), 0, 0.475, -0.25);
    ink(body, 1.03);
    const roof = mesh(g, new THREE.BoxGeometry(1.9, 0.12, 1.3), mat(C.terracotta), 0, 1.01, -0.25);
    ink(roof, 1.03);
    const win = glow(0xffb85c);
    [-0.5, 0, 0.5].forEach((x) => mesh(g, new THREE.BoxGeometry(0.28, 0.42, 0.02), win, x, 0.5, 0.31));
    [-0.75, 0.75].forEach((x) => [0.45, 1.05].forEach((z) => mesh(g, new THREE.CylinderGeometry(0.035, 0.035, 0.75, 5), mat(C.wood), x, 0.375, z)));
    [0.45, 0.75, 1.05].forEach((z) => mesh(g, new THREE.BoxGeometry(1.6, 0.05, 0.05), mat(C.wood), 0, 0.77, z));
    [-0.4, 0.4].forEach((x) => {
      mesh(g, new THREE.CylinderGeometry(0.17, 0.17, 0.03, 12), mat(C.cream), x, 0.32, 0.75);
      mesh(g, new THREE.CylinderGeometry(0.025, 0.025, 0.3, 5), mat(C.wood), x, 0.16, 0.75);
    });
    string(g, new THREE.Vector3(-0.75, 0.74, 1.05), new THREE.Vector3(0.75, 0.74, 1.05), 9, 0.08);
    bush(g, -1.0, 0.2, C.magenta, 1.1);
    bush(g, 1.0, 0.0, C.magenta);
    return 1.1;
  });

  // SAYAH Beachclub: thatched bar, umbrellas, loungers, palms
  venue('sayah', 60, 5.7, (g) => {
    const bar = mesh(g, new THREE.CylinderGeometry(0.5, 0.55, 0.5, 10), mat(C.wood), 0, 0.25, -0.35);
    ink(bar, 1.05);
    const thatch = mesh(g, new THREE.ConeGeometry(0.85, 0.55, 10), mat(C.straw), 0, 0.78, -0.35);
    ink(thatch, 1.05);
    mesh(g, new THREE.CylinderGeometry(0.03, 0.03, 0.5, 5), mat(C.wood), 0, 0.5, -0.35);
    const shades = [C.white, C.terracotta, C.white, C.terracotta, C.white];
    [[-0.95, 0.55], [-0.3, 0.85], [0.35, 0.85], [0.95, 0.55], [0.0, 1.35]].forEach(([x, z], i) => {
      mesh(g, new THREE.CylinderGeometry(0.02, 0.02, 0.6, 4), mat(C.wood), x, 0.3, z);
      const u = mesh(g, new THREE.ConeGeometry(0.34, 0.16, 10), mat(shades[i]), x, 0.62, z);
      ink(u, 1.06);
      mesh(g, new THREE.BoxGeometry(0.16, 0.05, 0.42), mat(C.white), x + 0.2, 0.06, z + 0.05);
    });
    string(g, new THREE.Vector3(-0.95, 0.66, 0.55), new THREE.Vector3(0.95, 0.66, 0.55), 12, 0.12);
    palm(g, -1.25, -0.6, 1.0, 0.8);
    palm(g, 1.3, -0.4, 1.15, -0.7);
    return 1.3;
  });

  // DÉJÀ VU: two storeys, arched windows, rooftop lights
  venue('deja', 132, 5.75, (g) => {
    const body = mesh(g, new THREE.BoxGeometry(1.25, 1.5, 1.15), mat(C.cream), 0, 0.75, -0.1);
    ink(body, 1.03);
    const win = glow(0xffc070);
    const arch = new THREE.Shape();
    arch.moveTo(-0.13, 0); arch.lineTo(0.13, 0); arch.lineTo(0.13, 0.28); arch.absarc(0, 0.28, 0.13, 0, Math.PI, false); arch.lineTo(-0.13, 0);
    const archGeo = new THREE.ShapeGeometry(arch);
    [[-0.35, 0.22], [0.35, 0.22], [-0.35, 0.92], [0, 0.92], [0.35, 0.92]].forEach(([x, y]) => {
      const w = new THREE.Mesh(archGeo, win);
      w.position.set(x, y, 0.481);
      g.add(w);
    });
    const door = mesh(g, new THREE.BoxGeometry(0.26, 0.5, 0.03), mat(C.navy), 0, 0.25, 0.48);
    door.castShadow = false;
    mesh(g, new THREE.BoxGeometry(1.31, 0.12, 1.21), mat(C.white), 0, 1.56, -0.1);
    [[-0.6, -0.65], [0.6, -0.65], [0.6, 0.45], [-0.6, 0.45]].forEach(([x, z]) => mesh(g, new THREE.CylinderGeometry(0.02, 0.02, 0.45, 4), mat(C.wood), x, 1.84, z));
    string(g, new THREE.Vector3(-0.6, 2.05, 0.45), new THREE.Vector3(0.6, 2.05, 0.45), 8, 0.1);
    string(g, new THREE.Vector3(-0.6, 2.05, -0.65), new THREE.Vector3(0.6, 2.05, -0.65), 8, 0.1);
    bush(g, -0.8, 0.5, C.magenta, 1.2);
    cypress(g, 0.95, -0.4, 0.9);
    return 2.1;
  });

  // M04: modern pavilion, dark frame, big glass
  venue('m04', 204, 5.75, (g) => {
    const base = mesh(g, new THREE.BoxGeometry(1.6, 0.08, 1.3), mat(C.cream), 0, 0.04, 0);
    base.castShadow = false;
    const glass = mesh(g, new THREE.BoxGeometry(1.3, 0.9, 1.0), glow(0xffd29a, C.glass), 0, 0.53, -0.05);
    glass.material.color.set(C.glass);
    glass.material.roughness = 0.15;
    glass.material.metalness = 0.2;
    const slab = mesh(g, new THREE.BoxGeometry(1.75, 0.14, 1.45), mat(C.charcoal), 0, 1.05, -0.05);
    ink(slab, 1.03);
    [[-0.68, 0.48], [0.68, 0.48], [-0.68, -0.58], [0.68, -0.58]].forEach(([x, z]) => mesh(g, new THREE.BoxGeometry(0.07, 0.95, 0.07), mat(C.charcoal), x, 0.53, z));
    mesh(g, new THREE.BoxGeometry(0.5, 0.06, 0.3), mat(C.wood), 0.35, 0.36, 0.25);
    olive(g, -1.1, 0.4, 0.9);
    cypress(g, 1.05, -0.5, 1.0);
    return 1.2;
  });

  // RANDEZVOU: café with awning and terrace tables
  venue('randez', 276, 5.75, (g) => {
    const body = mesh(g, new THREE.BoxGeometry(1.4, 0.85, 1.0), mat(C.white), 0, 0.425, -0.3);
    ink(body, 1.03);
    const roof = mesh(g, new THREE.BoxGeometry(1.5, 0.1, 1.1), mat(C.olive), 0, 0.9, -0.3);
    ink(roof, 1.03);
    const win = glow(0xffbd66);
    [-0.4, 0.4].forEach((x) => mesh(g, new THREE.BoxGeometry(0.42, 0.38, 0.02), win, x, 0.45, 0.21));
    for (let i = 0; i < 6; i++) {
      const s = mesh(g, new THREE.BoxGeometry(0.24, 0.03, 0.45), mat(i % 2 ? C.white : C.terracotta), -0.6 + i * 0.24, 0.72, 0.38);
      s.rotation.x = 0.35;
    }
    [[-0.45, 0.95], [0.45, 0.95], [0, 1.35]].forEach(([x, z]) => {
      mesh(g, new THREE.CylinderGeometry(0.14, 0.14, 0.03, 10), mat(C.cream), x, 0.3, z);
      mesh(g, new THREE.CylinderGeometry(0.02, 0.02, 0.3, 4), mat(C.wood), x, 0.15, z);
    });
    olive(g, 1.05, 0.6, 0.85);
    bush(g, -0.95, 0.35, C.pink);
    return 1.0;
  });

  /* ---------------- scatter ---------------- */
  const scatter = [];
  const free = (x, z) => {
    const r = Math.hypot(x, z);
    if (r < 2.2 || (r > 3.95 && r < 5.15) || r > R - 0.45) return false;
    for (const v of venues) {
      if (Math.hypot(x - v.group.position.x, z - v.group.position.z) < 1.55) return false;
    }
    for (const [sx, sz] of scatter) if (Math.hypot(x - sx, z - sz) < 0.55) return false;
    if (Math.hypot(x - shore.position.x, z - shore.position.z) < 2.3) return false;
    const ang = Math.atan2(x, z);
    if (Math.abs(ang - beachA) < 0.55 && r > 3.5) return false;
    return true;
  };
  let tries = 0;
  while (scatter.length < 34 && tries < 2000) {
    tries++;
    const a = rand(0, Math.PI * 2), r = rand(2.3, R - 0.5);
    const x = Math.sin(a) * r, z = Math.cos(a) * r;
    if (!free(x, z)) continue;
    scatter.push([x, z]);
    const k = Math.random();
    if (k < 0.42) cypress(island, x, z, rand(0.75, 1.15));
    else if (k < 0.78) olive(island, x, z, rand(0.75, 1.1));
    else bush(island, x, z, Math.random() < 0.6 ? C.magenta : C.pink, rand(0.8, 1.3));
  }
  palm(island, Math.sin(beachA + 0.4) * 6.4, Math.cos(beachA + 0.4) * 6.4, 1.1, 0.9);
  palm(island, Math.sin(beachA - 0.45) * 6.3, Math.cos(beachA - 0.45) * 6.3, 0.95, -0.8);

  /* ---------------- service van ---------------- */
  const van = new THREE.Group();
  const vb = mesh(van, new THREE.BoxGeometry(0.34, 0.28, 0.62), mat(C.white), 0, 0.22, 0);
  ink(vb, 1.06);
  mesh(van, new THREE.BoxGeometry(0.35, 0.05, 0.63), mat(C.gold, { metalness: 0.5, roughness: 0.4 }), 0, 0.2, 0);
  mesh(van, new THREE.BoxGeometry(0.3, 0.12, 0.14), mat(C.navy), 0, 0.3, 0.26);
  const wheelGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.05, 10);
  [[-0.17, 0.2], [0.17, 0.2], [-0.17, -0.2], [0.17, -0.2]].forEach(([x, z]) => {
    const w = mesh(van, wheelGeo, mat(0x2a2a2a), x, 0.07, z);
    w.rotation.z = Math.PI / 2;
  });
  const headMat = bulbMat();
  [-0.1, 0.1].forEach((x) => { const h = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), headMat); h.position.set(x, 0.18, 0.32); van.add(h); });
  island.add(van);
  let vanA = 0.6;

  /* ---------------- clouds ---------------- */
  const clouds = [];
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.92, emissive: 0xffffff, emissiveIntensity: 0.12 });
  const puff = new THREE.SphereGeometry(1, 18, 12);
  for (let i = 0; i < 7; i++) {
    const c = new THREE.Group();
    const n = 4 + Math.floor(Math.random() * 3);
    for (let j = 0; j < n; j++) {
      const s = new THREE.Mesh(puff, cloudMat);
      const k = 1 - Math.abs(j - (n - 1) / 2) / n;
      s.scale.set(rand(0.55, 0.8) * (0.7 + k * 0.6), rand(0.4, 0.55) * (0.7 + k * 0.6), rand(0.5, 0.7));
      s.position.set(j * 0.62 - n * 0.31, k * 0.25, rand(-0.2, 0.2));
      c.add(s);
    }
    const below = i < 3;
    c.userData = { a: (i / 7) * Math.PI * 2 + rand(-0.3, 0.3), r: below ? rand(7, 10) : rand(14, 18), y: below ? rand(-7.5, -5.5) : rand(4, 7.5), sp: rand(0.015, 0.035) };
    c.scale.setScalar(below ? rand(1.1, 1.5) : rand(1.2, 1.8));
    scene.add(c);
    clouds.push(c);
  }

  /* ---------------- petals ---------------- */
  const PN = narrow() ? 40 : 80;
  const petalGeo = new THREE.CircleGeometry(0.06, 7);
  petalGeo.scale(1, 0.62, 1);
  const petalMat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.8, vertexColors: false });
  const petals = new THREE.InstancedMesh(petalGeo, petalMat, PN);
  const pdata = [];
  const pcol = [new THREE.Color(C.magenta), new THREE.Color(C.pink), new THREE.Color(0xd65a91)];
  const dummy = new THREE.Object3D();
  for (let i = 0; i < PN; i++) {
    pdata.push({ x: rand(-12, 12), y: rand(-4, 9), z: rand(-12, 12), rx: rand(0, 6), ry: rand(0, 6), vr: rand(0.6, 1.8), vy: rand(0.25, 0.6), ph: rand(0, 6) });
    petals.setColorAt(i, pcol[i % 3]);
  }
  scene.add(petals);

  /* ---------------- lights ---------------- */
  const hemi = new THREE.HemisphereLight(0xe3eef5, 0xcaa27f, 1.1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.4);
  sun.position.set(9, 14, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(narrow() ? 1024 : 2048, narrow() ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 40 });
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);
  const venueLights = venues.filter((v) => v.id !== 'services').map((v) => {
    const l = new THREE.PointLight(0xffb45e, 0, 4.5, 1.6);
    l.position.set(0, 1.0, 0.9);
    v.group.add(l);
    return l;
  });
  const coreLight = new THREE.PointLight(0xffcf8a, 0, 6, 1.4);
  coreLight.position.set(0, 1.6, 0);
  island.add(coreLight);

  /* ---------------- camera & state ---------------- */
  const S = {
    intro: 0, night: 0, focus: 0, rotY: -0.35, vel: 0, drag: false,
    focusRot: 0, focusId: null, mx: 0, my: 0,
  };
  const look = new THREE.Vector3();
  const overview = () => {
    const w = container.clientWidth, h = container.clientHeight;
    if (w < 700) return { pos: new THREE.Vector3(0, 23, 54), look: new THREE.Vector3(0, -4.6, 0) };
    const wide = w / Math.max(1, h) > 1.25;
    return { pos: new THREE.Vector3(0, 13.5, 33), look: new THREE.Vector3(wide ? -4.2 : 0, -0.6, 0) };
  };
  const closeup = (v) => {
    const r = v.radius;
    const h = v.height;
    const side = narrow() ? 0 : 2.6; // keep the place clear of the drawer on wide screens
    if (v.id === 'services') return { pos: new THREE.Vector3(0, 7.2, 14.5), look: new THREE.Vector3(side, 1.1, 0) };
    return { pos: new THREE.Vector3(0, 4.4 + h * 0.8, r + (narrow() ? 12 : 9.5)), look: new THREE.Vector3(side, h * 0.35, r - 0.6) };
  };
  let ov = overview();

  const resize = () => {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
    ov = overview();
  };
  window.addEventListener('resize', resize);
  resize();

  /* ---------------- interaction ---------------- */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const hits = venues.map((v) => v.hit);
  let downX = 0, downY = 0, lastX = 0, moved = 0, hoverId = null;
  const el = renderer.domElement;
  const pick = (e) => {
    const r = el.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(hits, false)[0];
    return hit ? hit.object.userData.id : null;
  };
  el.addEventListener('pointerdown', (e) => {
    S.drag = true; moved = 0;
    downX = lastX = e.clientX; downY = e.clientY;
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener('pointermove', (e) => {
    const r = el.getBoundingClientRect();
    S.mx = ((e.clientX - r.left) / r.width - 0.5) * 2;
    S.my = ((e.clientY - r.top) / r.height - 0.5) * 2;
    if (S.drag) {
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      moved += Math.abs(dx) + Math.abs(e.clientY - downY) * 0.2;
      if (!S.focusId) { S.rotY += dx * 0.006; S.vel = dx * 0.006; }
      return;
    }
    const id = pick(e);
    if (id !== hoverId) {
      hoverId = id;
      el.style.cursor = id ? 'pointer' : 'grab';
      opts.onHover && opts.onHover(id);
    }
  });
  const end = (e) => {
    if (!S.drag) return;
    S.drag = false;
    if (moved < 6) {
      const id = pick(e);
      if (id) opts.onSelect && opts.onSelect(id);
    }
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', () => { S.drag = false; });
  el.style.cursor = 'grab';
  el.style.touchAction = 'pan-y';

  const shortest = (from, to) => {
    let d = (to - from) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return from + d;
  };

  /* ---------------- intro: line drawing, then the island assembles ---------------- */
  const lineGeo = new THREE.BufferGeometry();
  const LN = 200;
  const lp = new Float32Array((LN + 1) * 3);
  for (let i = 0; i <= LN; i++) { const a = (i / LN) * Math.PI * 2; lp[i * 3] = Math.sin(a) * R; lp[i * 3 + 1] = 0.02; lp[i * 3 + 2] = Math.cos(a) * R; }
  lineGeo.setAttribute('position', new THREE.BufferAttribute(lp, 3));
  const lineMat = new THREE.LineBasicMaterial({ color: C.gold, transparent: true, opacity: 1 });
  const drawLine = new THREE.Line(lineGeo, lineMat);
  drawLine.renderOrder = 10;
  world.add(drawLine);
  lineGeo.setDrawRange(0, 0);

  const pieces = island.children.filter((c) => c !== top && c !== beach && c !== rock && c !== lagoon && c !== shore && c !== foam && c.type !== 'PointLight');
  const intro = () => {
    island.position.y = -9;
    island.scale.setScalar(0.7);
    pieces.forEach((p) => { p.userData.y0 = p.position.y; p.position.y += 6; p.visible = false; });
    const line = { n: 0 };
    const tl = gsap.timeline();
    tl.to(line, { n: LN + 1, duration: 1.5, ease: 'power2.inOut', onUpdate: () => lineGeo.setDrawRange(0, Math.floor(line.n)) }, 0)
      .to(island.position, { y: 0, duration: 1.6, ease: 'expo.out' }, 1.0)
      .to(island.scale, { x: 1, y: 1, z: 1, duration: 1.6, ease: 'expo.out' }, 1.0)
      .to(lineMat, { opacity: 0, duration: 0.8 }, 1.9)
      .to(S, { intro: 1, duration: 2.6, ease: 'power3.inOut' }, 0);
    pieces.forEach((p, i) => {
      tl.add(() => { p.visible = true; }, 1.5 + i * 0.03);
      tl.to(p.position, { y: p.userData.y0, duration: 0.9, ease: 'back.out(1.6)' }, 1.5 + i * 0.03);
    });
    return tl;
  };

  /* ---------------- loop ---------------- */
  const clock = new THREE.Clock();
  const vTmp = new THREE.Vector3();
  const camPos = new THREE.Vector3();
  const nightSky = new THREE.Color(0x2b2f5c), daySky = new THREE.Color(0xe3eef5);
  const nightGround = new THREE.Color(0x3a2b3a), dayGround = new THREE.Color(0xcaa27f);
  const sunDay = new THREE.Color(0xfff0d8), sunNight = new THREE.Color(0x8fa2ff);
  let running = false, raf = 0;

  const frame = () => {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    // rotation: drag inertia, idle drift, or focus target
    if (S.focusId) {
      S.rotY += (S.focusRot - S.rotY) * Math.min(1, dt * 3.2);
    } else if (!S.drag) {
      S.vel *= 0.94;
      S.rotY += S.vel + dt * 0.045;
    }
    world.rotation.y = S.rotY;
    world.position.y = Math.sin(t * 0.6) * 0.12;

    // camera: intro sweep from above, overview, or close-up
    const fv = S.focusId ? venues.find((v) => v.id === S.focusId) : null;
    const cu = fv ? closeup(fv) : ov;
    const ip = 1 - S.intro;
    camPos.copy(ov.pos).lerp(cu.pos, S.focus);
    camPos.y += ip * 22;
    camPos.z -= ip * 10;
    camPos.x += S.mx * 0.9 * (1 - S.focus * 0.7);
    camPos.y += -S.my * 0.6 * (1 - S.focus * 0.7);
    camera.position.copy(camPos);
    look.copy(ov.look).lerp(cu.look, S.focus);
    camera.lookAt(look);

    // gold ring, van, clouds, petals
    if (goldRing) { goldRing.rotation.x = Math.PI / 2 + Math.sin(t * 0.8) * 0.15; goldRing.rotation.z = t * 0.6; goldRing.position.y = 2.75 + Math.sin(t * 1.3) * 0.08; }
    vanA += dt * 0.32;
    van.position.set(Math.sin(vanA) * 4.55, 0.04, Math.cos(vanA) * 4.55);
    van.rotation.y = vanA + Math.PI / 2;
    clouds.forEach((c) => {
      const d = c.userData;
      d.a += dt * d.sp;
      c.position.set(Math.sin(d.a) * d.r, d.y + Math.sin(t * 0.4 + d.a) * 0.2, Math.cos(d.a) * d.r);
    });
    for (let i = 0; i < PN; i++) {
      const p = pdata[i];
      p.y -= p.vy * dt;
      p.x += Math.sin(t * 0.7 + p.ph) * dt * 0.5 + dt * 0.25;
      p.z += Math.cos(t * 0.5 + p.ph) * dt * 0.3;
      p.rx += p.vr * dt; p.ry += p.vr * 0.7 * dt;
      if (p.y < -5) { p.y = 9; p.x = rand(-12, 12); p.z = rand(-12, 12); }
      if (p.x > 13) p.x = -13;
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(p.rx, p.ry, 0);
      dummy.updateMatrix();
      petals.setMatrixAt(i, dummy.matrix);
    }
    petals.instanceMatrix.needsUpdate = true;

    // day / night
    const n = S.night;
    hemi.color.copy(daySky).lerp(nightSky, n);
    hemi.groundColor.copy(dayGround).lerp(nightGround, n);
    hemi.intensity = 1.1 - 0.75 * n;
    sun.color.copy(sunDay).lerp(sunNight, n);
    sun.intensity = 2.4 - 1.95 * n;
    renderer.toneMappingExposure = 1.05 + 0.15 * n;
    glowMats.forEach((m) => { m.emissiveIntensity = n * 1.8; });
    bulbs.forEach((m) => { m.emissiveIntensity = 0.15 + n * 3; });
    venueLights.forEach((l) => { l.intensity = n * 3.2; });
    coreLight.intensity = n * 4;
    cloudMat.color.setRGB(1 - n * 0.55, 1 - n * 0.5, 1 - n * 0.3);

    // HTML pins follow their buildings
    if (opts.pins) {
      venues.forEach((v) => {
        const pin = opts.pins[v.id];
        if (!pin) return;
        vTmp.set(0, v.height + 0.5, 0);
        v.group.localToWorld(vTmp);
        const facing = Math.cos(v.a + S.rotY);
        vTmp.project(camera);
        const x = (vTmp.x * 0.5 + 0.5) * container.clientWidth;
        const y = (-vTmp.y * 0.5 + 0.5) * container.clientHeight;
        pin.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        const vis = v.id === 'services' ? 1 : Math.max(0, Math.min(1, (facing + 0.35) * 1.6));
        pin.style.opacity = String(S.intro > 0.85 ? (S.focusId && S.focusId !== v.id ? 0 : vis) : 0);
        pin.style.pointerEvents = vis > 0.4 && !S.focusId ? 'auto' : 'none';
      });
    }

    renderer.render(scene, camera);
  };

  return {
    venues: venues.map((v) => v.id),
    intro,
    start() { if (running) return; running = true; clock.getDelta(); frame(); },
    stop() { running = false; cancelAnimationFrame(raf); },
    setNight(on) { gsap.to(S, { night: on ? 1 : 0, duration: 2.2, ease: 'power2.inOut' }); },
    select(id) {
      const v = venues.find((x) => x.id === id);
      if (!v) return;
      S.focusId = id;
      S.focusRot = id === 'services' ? S.rotY : shortest(S.rotY, -v.a);
      S.vel = 0;
      gsap.to(S, { focus: 1, duration: 1.6, ease: 'power3.inOut', overwrite: 'auto' });
    },
    release() {
      gsap.to(S, { focus: 0, duration: 1.4, ease: 'power3.inOut', overwrite: 'auto', onComplete: () => { S.focusId = null; } });
    },
  };
};
