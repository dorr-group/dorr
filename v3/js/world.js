/* DORR v3 — the island.
   A hand-made looking floating round island, built procedurally with three.js:
   the Services Company rotunda at the centre, five brands around a ring path,
   a service van that keeps circling, drifting bougainvillea petals and a
   day/night cycle. Every place can be entered: the camera flies to its door,
   through it, into a small hand-made interior (see rooms.js), and back out.
   Look: soft toon (cel) shading, crisp constant-width ink outlines and gentle
   baked contact shading, in the spirit of hand-drawn tiny-planet worlds.
   Exposes a small API to the page (intro, night, enter, exit, go). */
window.DorrWorld = function (container, opts) {
  const THREE = window.THREE;
  const gsap = window.gsap;
  if (!THREE || !gsap) return null;
  opts = opts || {};
  const reduced = !!opts.reduced;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) {
    return null;
  }
  // container size is cached (read once per resize, never inside the render loop)
  let cw = container.clientWidth || window.innerWidth, ch = container.clientHeight || window.innerHeight;
  const narrow = () => cw < 700;
  // phones (also held sideways): fewer petals, smaller shadow maps, no interior shadows, lower pixel ratio
  const phone = Math.min(window.screen.width || 9999, window.screen.height || 9999) < 700;
  const small = phone || narrow();
  const dprCap = (w) => Math.min(window.devicePixelRatio || 1, phone || w < 700 ? 1.5 : 1.75);
  renderer.setPixelRatio(dprCap(cw));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping; // flat, true-to-palette toon colours
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = small ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  renderer.domElement.className = 'world__canvas';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.08, 300);

  const C = {
    grass: 0xa3b07c, grassDark: 0x84935e, sand: 0xefdcbc, path: 0xf5ecdc, white: 0xf7f2e9, cream: 0xefe5d3,
    terracotta: 0xc8643c, clay: 0xb5835f, clayDeep: 0x7b4c36, olive: 0x7d8a58, cypress: 0x51603b,
    leaf: 0x6f8f4e, water: 0x5fbcbc, wood: 0x8a5a3b, straw: 0xd9b56f, gold: 0xd6a64f, magenta: 0xc2407e,
    pink: 0xe58fb3, navy: 0x24384a, charcoal: 0x3a3a3c, glass: 0x9cc6d6,
  };
  const rand = (a, b) => a + Math.random() * (b - a);

  /* ---------------- toon kit: materials, outlines, geometry baking ---------------- */
  // three-step light ramp: shadow / half-tone / lit, hard steps like cel animation
  const ramp = new THREE.DataTexture(new Uint8Array([88, 88, 88, 255, 160, 160, 160, 255, 255, 255, 255, 255, 255, 255, 255, 255]), 4, 1, THREE.RGBAFormat);
  ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
  ramp.generateMipmaps = false;
  ramp.needsUpdate = true;
  const toon = (o) => new THREE.MeshToonMaterial(Object.assign({ gradientMap: ramp }, o));
  // all plain painted surfaces are merged into one vertex-coloured toon material (few draw calls)
  const paintMat = toon({ vertexColors: true });
  const cache = {};
  const mat = (hex, extra) => {
    const key = hex + (extra ? JSON.stringify(extra) : '');
    if (!cache[key]) { cache[key] = toon(Object.assign({ color: hex }, extra || {})); cache[key].userData.paint = true; }
    return cache[key];
  };
  const hidden = new THREE.MeshBasicMaterial({ visible: false });

  // ink: inverted hull pushed out along smoothed normals by a constant number of pixels
  const ink = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(0x2e2731) }, uWidth: { value: 1.6 }, uRes: { value: new THREE.Vector2(1, 1) } },
    vertexShader: [
      'attribute vec3 onormal;',
      'uniform float uWidth;',
      'uniform vec2 uRes;',
      'void main() {',
      '  vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
      '  vec3 vn = normalize(normalMatrix * onormal);',
      '  vec2 d = (projectionMatrix * vec4(vn, 0.0)).xy;',
      '  float l = length(d);',
      '  if (l > 1e-5) d /= l;',
      '  clip.xy += d * uWidth * 2.0 / uRes * clip.w;',
      '  clip.z += 0.00002 * clip.w;',
      '  gl_Position = clip;',
      '}',
    ].join('\n'),
    fragmentShader: 'uniform vec3 uColor;\nvoid main() {\n  gl_FragColor = vec4(uColor, 1.0);\n  #include <colorspace_fragment>\n}',
    side: THREE.BackSide,
  });
  const vkey = (P, i) => Math.round(P.getX(i) * 2000) + ',' + Math.round(P.getY(i) * 2000) + ',' + Math.round(P.getZ(i) * 2000);
  // averaged normals per position: smooth shading for blobs, and gap-free outlines on hard-edged shapes
  const averaged = (g) => {
    const P = g.attributes.position, N = g.attributes.normal;
    const acc = new Map(), keys = new Array(P.count);
    for (let i = 0; i < P.count; i++) {
      const k = vkey(P, i); keys[i] = k;
      let a = acc.get(k); if (!a) acc.set(k, a = [0, 0, 0]);
      a[0] += N.getX(i); a[1] += N.getY(i); a[2] += N.getZ(i);
    }
    const out = new Float32Array(P.count * 3);
    for (let i = 0; i < P.count; i++) {
      const a = acc.get(keys[i]); const l = Math.hypot(a[0], a[1], a[2]) || 1;
      out[i * 3] = a[0] / l; out[i * 3 + 1] = a[1] / l; out[i * 3 + 2] = a[2] / l;
    }
    return out;
  };
  const outline = (m) => {
    if (!m.geometry.attributes.onormal) m.geometry.setAttribute('onormal', new THREE.BufferAttribute(averaged(m.geometry), 3));
    const o = new THREE.Mesh(m.geometry, ink);
    o.raycast = () => {};
    o.userData.ink = true;
    m.add(o);
    return o;
  };
  // soft, slightly lumpy blob (foliage, bushes, clouds)
  const blob = (r, detail, jitter, sy) => {
    const g = new THREE.IcosahedronGeometry(r, detail == null ? 1 : detail);
    const P = g.attributes.position, off = new Map();
    for (let i = 0; i < P.count; i++) {
      const k = vkey(P, i);
      if (!off.has(k)) off.set(k, 1 + rand(-(jitter == null ? 0.1 : jitter), jitter == null ? 0.1 : jitter));
      const f = off.get(k);
      P.setXYZ(i, P.getX(i) * f, P.getY(i) * f * (sy || 1), P.getZ(i) * f);
    }
    g.computeVertexNormals();
    g.setAttribute('normal', new THREE.BufferAttribute(averaged(g), 3));
    return g;
  };
  // merge every plain mesh under `root` into one mesh per material (vertex colours for paint),
  // add baked contact shading near the floor and one ink outline. Objects marked userData.keep stay live.
  const tmpM = new THREE.Matrix4(), tmpN = new THREE.Matrix3(), tv = new THREE.Vector3(), tc = new THREE.Color();
  const bake = (root, o) => {
    o = o || {};
    root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const buckets = new Map(), doomed = [];
    const kept = (m) => { for (let p = m; p && p !== root; p = p.parent) if (p.userData.keep) return true; return false; };
    root.traverse((m) => {
      if (!m.isMesh || m.isInstancedMesh || m.userData.ink || m.material === hidden || kept(m)) return;
      const paint = !!m.material.userData.paint;
      const key = paint ? paintMat : m.material;
      // casters and non-casters stay apart (walls and ceilings must not block the light)
      const bk = key.uuid + (m.castShadow ? '1' : '0');
      let b = buckets.get(bk);
      if (!b) buckets.set(bk, b = { key, pos: [], nor: [], col: [], cast: m.castShadow });
      tmpM.multiplyMatrices(inv, m.matrixWorld);
      tmpN.getNormalMatrix(tmpM);
      const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry;
      const P = g.attributes.position, N = g.attributes.normal, VC = g.attributes.color;
      if (paint) tc.copy(m.material.color);
      for (let i = 0; i < P.count; i++) {
        tv.fromBufferAttribute(P, i).applyMatrix4(tmpM); b.pos.push(tv.x, tv.y, tv.z);
        tv.fromBufferAttribute(N, i).applyMatrix3(tmpN).normalize(); b.nor.push(tv.x, tv.y, tv.z);
        if (key === paintMat) { if (VC && m.material.vertexColors) tc.fromBufferAttribute(VC, i); b.col.push(tc.r, tc.g, tc.b); }
      }
      doomed.push(m);
    });
    doomed.forEach((m) => m.parent && m.parent.remove(m));
    const made = [];
    buckets.forEach((b) => {
      const material = b.key;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
      if (b.col.length) {
        if (o.ao !== false) {
          // gentle contact shading: surfaces close to the ground are a touch darker
          const floor = o.floor || 0, reach = o.reach || 0.45;
          for (let i = 0; i < b.col.length; i += 3) {
            const y = b.pos[i + 1] - floor;
            const k = 0.74 + 0.26 * Math.min(1, Math.max(0, y / reach));
            b.col[i] *= k; b.col[i + 1] *= k; b.col[i + 2] *= k * 1.02;
          }
        }
        g.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
      }
      const m = new THREE.Mesh(g, material);
      m.castShadow = o.shadow !== false && b.cast;
      m.receiveShadow = true;
      if (material === paintMat && o.ink !== false) outline(m);
      else if (material.userData.ink) outline(m);
      root.add(m);
      made.push(m);
    });
    return made;
  };

  const mesh = (parent, geo, material, x, y, z) => {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x || 0, y || 0, z || 0);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  // materials that light up at night
  const glowMats = [];
  const glow = (hex, dayHex) => {
    const m = toon({ color: dayHex || C.navy, emissive: hex, emissiveIntensity: 0 });
    glowMats.push(m);
    return m;
  };
  const bulbs = [];
  const bulbMat = () => {
    const m = toon({ color: 0xfff2d6, emissive: 0xffc46b, emissiveIntensity: 0.15 });
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
  // warm light seen through an open door
  const doorLight = new THREE.MeshBasicMaterial({ color: 0xffe2ad });
  const door = (g, o) => {
    // o: { x, z (front face), w, h, y (sill), hex }
    const y = o.y || 0;
    const light = new THREE.Mesh(new THREE.PlaneGeometry(o.w * 0.94, o.h * 0.96), doorLight);
    light.position.set(o.x, y + o.h / 2, o.z + 0.004);
    g.add(light);
    const hinge = new THREE.Group();
    hinge.position.set(o.x - o.w / 2, y, o.z + 0.018);
    hinge.userData.keep = true;
    const panel = mesh(hinge, new THREE.BoxGeometry(o.w, o.h, 0.03), mat(o.hex || C.navy), o.w / 2, o.h / 2, 0);
    outline(panel);
    mesh(hinge, new THREE.SphereGeometry(0.018, 6, 4), mat(C.gold), o.w * 0.85, o.h * 0.48, 0.02).castShadow = false;
    g.add(hinge);
    const anchor = new THREE.Object3D();
    anchor.position.set(o.x, y + Math.min(o.h * 0.55, 0.42), o.z);
    g.add(anchor);
    g.userData.door = { hinge, anchor };
  };

  /* ---------------- world ---------------- */
  const world = new THREE.Group();
  scene.add(world);
  const island = new THREE.Group();
  world.add(island);
  const R = 7;

  // the ground: grass disc, beach wedge, lagoon and the rocky underside, baked into one piece
  const ground = new THREE.Group();
  island.add(ground);
  mesh(ground, new THREE.CylinderGeometry(R, R * 0.97, 0.6, 96, 1), mat(C.grass), 0, -0.3, 0);
  const beachA = (60 * Math.PI) / 180;
  mesh(ground, new THREE.CylinderGeometry(R + 0.02, R * 0.97 + 0.02, 0.62, 32, 1, false, beachA - 0.75, 1.5), mat(C.sand), 0, -0.29, 0);
  const lagA = beachA + 0.62;
  const lagR = R - 1.85;
  const lagX = Math.sin(lagA) * lagR, lagZ = Math.cos(lagA) * lagR;
  mesh(ground, new THREE.CylinderGeometry(1.95, 1.95, 0.06, 48), mat(C.sand), lagX, 0.005, lagZ);
  mesh(ground, new THREE.CylinderGeometry(1.55, 1.55, 0.06, 48), mat(C.water), lagX, 0.03, lagZ);
  const foam = mesh(ground, new THREE.TorusGeometry(1.5, 0.035, 6, 64), mat(0xffffff), lagX, 0.065, lagZ);
  foam.rotation.x = Math.PI / 2;
  // rocky underside with a warm clay gradient
  const coneGeo = new THREE.ConeGeometry(R * 0.98, 6.2, 64, 8);
  coneGeo.rotateX(Math.PI);
  {
    const pos = coneGeo.attributes.position;
    const colors = [];
    const top3 = new THREE.Color(C.clay), deep = new THREE.Color(C.clayDeep), tmp = new THREE.Color();
    const off = new Map();
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const k = (3.1 - y) / 6.2; // 0 at top, 1 at tip
      if (k > 0.04 && k < 0.98) {
        const key = vkey(pos, i);
        if (!off.has(key)) off.set(key, [1 + rand(-0.1, 0.1) * (0.4 + k), rand(-0.15, 0.15)]);
        const [f, dy] = off.get(key);
        pos.setXYZ(i, pos.getX(i) * f, y + dy, pos.getZ(i) * f);
      }
      tmp.copy(top3).lerp(deep, Math.min(1, k * 1.2));
      colors.push(tmp.r, tmp.g, tmp.b);
    }
    coneGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    coneGeo.computeVertexNormals();
  }
  const rockMat = toon({ vertexColors: true });
  rockMat.userData.paint = true;
  mesh(ground, coneGeo, rockMat, 0, -3.7, 0);

  // plaza and ring path (one piece, drops in during the intro)
  const paths = new THREE.Group();
  island.add(paths);
  mesh(paths, new THREE.CylinderGeometry(1.9, 1.9, 0.05, 64), mat(C.path), 0, 0.02, 0);
  const ringPath = mesh(paths, new THREE.RingGeometry(4.15, 4.95, 128), mat(C.path), 0, 0.03, 0);
  ringPath.rotation.x = -Math.PI / 2;
  [30, 150, 270].forEach((deg) => {
    const a = (deg * Math.PI) / 180;
    const p = mesh(paths, new THREE.BoxGeometry(0.45, 0.04, 2.4), mat(C.path), Math.sin(a) * 3.0, 0.025, Math.cos(a) * 3.0);
    p.rotation.y = a;
  });

  /* ---------------- vegetation ---------------- */
  // cypress: a rounded flame, turned on a lathe
  const cypressProfile = [[0, 0], [0.16, 0.04], [0.24, 0.3], [0.23, 0.7], [0.16, 1.15], [0.07, 1.45], [0, 1.6]];
  const cypress = (parent, x, z, h) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    mesh(g, new THREE.CylinderGeometry(0.035 * h, 0.05 * h, 0.2 * h, 6), mat(C.wood), 0, 0.1 * h, 0);
    const pts = cypressProfile.map(([r, y]) => new THREE.Vector2(r * h * (0.92 + Math.random() * 0.16), y * h + 0.12 * h));
    mesh(g, new THREE.LatheGeometry(pts, 12), mat(C.cypress), 0, 0, 0);
    parent.add(g);
    return g;
  };
  const olive = (parent, x, z, s) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    mesh(g, new THREE.CylinderGeometry(0.045 * s, 0.075 * s, 0.6 * s, 6), mat(C.wood), 0, 0.3 * s, 0);
    mesh(g, blob(0.36 * s, 1, 0.12, 0.8), mat(C.olive), 0, 0.78 * s, 0);
    mesh(g, blob(0.22 * s, 1, 0.12, 0.85), mat(C.olive), 0.24 * s, 0.68 * s, 0.08 * s);
    mesh(g, blob(0.2 * s, 1, 0.12, 0.85), mat(C.olive), -0.2 * s, 0.7 * s, -0.12 * s);
    parent.add(g);
    return g;
  };
  const palm = (parent, x, z, s, lean) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rand(0, Math.PI * 2);
    let y = 0, off = 0;
    for (let i = 0; i < 6; i++) {
      const seg = mesh(g, new THREE.CylinderGeometry(0.06 * s, 0.08 * s, 0.32 * s, 7), mat(C.wood), off, y + 0.16 * s, 0);
      seg.rotation.z = -lean * 0.4;
      y += 0.3 * s;
      off += lean * 0.06 * s * (i + 1) * 0.5;
    }
    for (let i = 0; i < 7; i++) {
      const leaf = mesh(g, new THREE.ConeGeometry(0.09 * s, 0.9 * s, 5), mat(C.leaf), off, y, 0);
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
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    mesh(g, blob(0.22 * (s || 1), 1, 0.14, 0.75), mat(hex), 0, 0.15 * (s || 1), 0);
    parent.add(g);
    return g;
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
    venues.push({ id, a, radius, group: g, hit, height: h, door: g.userData.door });
    return g;
  };

  // Services Company: rotunda with a floating gold ring
  let goldRing = null;
  venue('services', 0, 0, (g) => {
    mesh(g, new THREE.CylinderGeometry(1.25, 1.35, 0.18, 40), mat(C.cream), 0, 0.09, 0);
    const core = mesh(g, new THREE.CylinderGeometry(0.8, 0.8, 1.05, 32), glow(0xffcf8a, C.white), 0, 0.7, 0);
    core.material.color.set(C.white);
    core.material.userData.ink = true;
    for (let i = 0; i < 10; i++) {
      const a = ((i + 0.5) / 10) * Math.PI * 2;
      mesh(g, new THREE.CylinderGeometry(0.06, 0.06, 1.05, 8), mat(C.white), Math.sin(a) * 1.08, 0.7, Math.cos(a) * 1.08);
    }
    mesh(g, new THREE.CylinderGeometry(1.25, 1.25, 0.12, 40), mat(C.cream), 0, 1.28, 0);
    mesh(g, new THREE.SphereGeometry(0.78, 32, 14, 0, Math.PI * 2, 0, Math.PI / 2), mat(C.terracotta), 0, 1.34, 0);
    door(g, { x: 0, z: 0.8, w: 0.34, h: 0.62, y: 0.18, hex: C.terracotta });
    goldRing = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.05, 12, 72), toon({ color: C.gold, emissive: C.gold, emissiveIntensity: 0.12 }));
    goldRing.position.y = 2.75;
    goldRing.castShadow = true;
    goldRing.userData.keep = true;
    outline(goldRing);
    g.add(goldRing);
    return 2.4;
  });

  // DADA Restaurant: white house, terracotta roof, pergola terrace
  venue('dada', 0, 5.75, (g) => {
    mesh(g, new THREE.BoxGeometry(1.7, 0.95, 1.1), mat(C.white), 0, 0.475, -0.25);
    mesh(g, new THREE.BoxGeometry(1.9, 0.12, 1.3), mat(C.terracotta), 0, 1.01, -0.25);
    const win = glow(0xffb85c);
    [-0.5, 0.5].forEach((x) => mesh(g, new THREE.BoxGeometry(0.28, 0.42, 0.02), win, x, 0.5, 0.31));
    door(g, { x: 0, z: 0.3, w: 0.3, h: 0.6, hex: C.wood });
    [-0.75, 0.75].forEach((x) => [0.45, 1.05].forEach((z) => mesh(g, new THREE.CylinderGeometry(0.035, 0.035, 0.75, 6), mat(C.wood), x, 0.375, z)));
    [0.45, 0.75, 1.05].forEach((z) => mesh(g, new THREE.BoxGeometry(1.6, 0.05, 0.05), mat(C.wood), 0, 0.77, z));
    [-0.45, 0.45].forEach((x) => {
      mesh(g, new THREE.CylinderGeometry(0.17, 0.17, 0.03, 16), mat(C.cream), x, 0.32, 0.75);
      mesh(g, new THREE.CylinderGeometry(0.025, 0.025, 0.3, 6), mat(C.wood), x, 0.16, 0.75);
    });
    string(g, new THREE.Vector3(-0.75, 0.74, 1.05), new THREE.Vector3(0.75, 0.74, 1.05), 9, 0.08);
    bush(g, -1.0, 0.2, C.magenta, 1.1);
    bush(g, 1.0, 0.0, C.magenta);
    return 1.1;
  });

  // SAYAH Beachclub: thatched bar, umbrellas, loungers, palms, a little gate onto the deck
  venue('sayah', 60, 5.7, (g) => {
    mesh(g, new THREE.CylinderGeometry(0.5, 0.55, 0.5, 14), mat(C.wood), 0, 0.25, -0.35);
    mesh(g, new THREE.ConeGeometry(0.85, 0.55, 14), mat(C.straw), 0, 0.78, -0.35);
    mesh(g, new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6), mat(C.wood), 0, 0.5, -0.35);
    const shades = [C.white, C.terracotta, C.white, C.terracotta, C.white];
    [[-0.95, 0.55], [-0.55, 0.95], [0.55, 0.95], [0.95, 0.55], [0.0, 0.25]].forEach(([x, z], i) => {
      mesh(g, new THREE.CylinderGeometry(0.02, 0.02, 0.6, 5), mat(C.wood), x, 0.3, z);
      mesh(g, new THREE.ConeGeometry(0.34, 0.16, 14), mat(shades[i]), x, 0.62, z);
      mesh(g, new THREE.BoxGeometry(0.16, 0.05, 0.42), mat(C.white), x + 0.2, 0.06, z + 0.05);
    });
    string(g, new THREE.Vector3(-0.95, 0.66, 0.55), new THREE.Vector3(0.95, 0.66, 0.55), 12, 0.12);
    // gate
    [-0.28, 0.28].forEach((x) => mesh(g, new THREE.CylinderGeometry(0.035, 0.04, 0.72, 6), mat(C.wood), x, 0.36, 1.55));
    mesh(g, new THREE.BoxGeometry(0.7, 0.06, 0.06), mat(C.wood), 0, 0.72, 1.55);
    mesh(g, new THREE.BoxGeometry(0.4, 0.12, 0.03), mat(C.white), 0, 0.62, 1.56);
    const anchor = new THREE.Object3D();
    anchor.position.set(0, 0.34, 1.55);
    g.add(anchor);
    g.userData.door = { hinge: null, anchor };
    palm(g, -1.25, -0.6, 1.0, 0.8);
    palm(g, 1.3, -0.4, 1.15, -0.7);
    return 1.3;
  });

  // DÉJÀ VU: two storeys, arched windows, rooftop lights
  venue('deja', 132, 5.75, (g) => {
    mesh(g, new THREE.BoxGeometry(1.25, 1.5, 1.15), mat(C.cream), 0, 0.75, -0.1);
    const win = glow(0xffc070);
    const arch = new THREE.Shape();
    arch.moveTo(-0.13, 0); arch.lineTo(0.13, 0); arch.lineTo(0.13, 0.28); arch.absarc(0, 0.28, 0.13, 0, Math.PI, false); arch.lineTo(-0.13, 0);
    const archGeo = new THREE.ShapeGeometry(arch, 8);
    [[-0.35, 0.22], [0.35, 0.22], [-0.35, 0.92], [0, 0.92], [0.35, 0.92]].forEach(([x, y]) => {
      const w = new THREE.Mesh(archGeo, win);
      w.position.set(x, y, 0.481);
      g.add(w);
    });
    door(g, { x: 0, z: 0.475, w: 0.26, h: 0.5, hex: C.navy });
    mesh(g, new THREE.BoxGeometry(1.31, 0.12, 1.21), mat(C.white), 0, 1.56, -0.1);
    [[-0.6, -0.65], [0.6, -0.65], [0.6, 0.45], [-0.6, 0.45]].forEach(([x, z]) => mesh(g, new THREE.CylinderGeometry(0.02, 0.02, 0.45, 5), mat(C.wood), x, 1.84, z));
    string(g, new THREE.Vector3(-0.6, 2.05, 0.45), new THREE.Vector3(0.6, 2.05, 0.45), 8, 0.1);
    string(g, new THREE.Vector3(-0.6, 2.05, -0.65), new THREE.Vector3(0.6, 2.05, -0.65), 8, 0.1);
    bush(g, -0.8, 0.5, C.magenta, 1.2);
    cypress(g, 0.95, -0.4, 0.9);
    return 2.1;
  });

  // M04: modern pavilion, dark frame, big glass
  venue('m04', 204, 5.75, (g) => {
    mesh(g, new THREE.BoxGeometry(1.6, 0.08, 1.3), mat(C.cream), 0, 0.04, 0);
    const glass = mesh(g, new THREE.BoxGeometry(1.3, 0.9, 1.0), glow(0xffd29a, C.glass), 0, 0.53, -0.05);
    glass.material.userData.ink = true;
    mesh(g, new THREE.BoxGeometry(1.75, 0.14, 1.45), mat(C.charcoal), 0, 1.05, -0.05);
    [[-0.68, 0.48], [0.68, 0.48], [-0.68, -0.58], [0.68, -0.58]].forEach(([x, z]) => mesh(g, new THREE.BoxGeometry(0.07, 0.95, 0.07), mat(C.charcoal), x, 0.53, z));
    door(g, { x: -0.25, z: 0.45, w: 0.3, h: 0.62, y: 0.08, hex: C.charcoal });
    mesh(g, new THREE.BoxGeometry(0.5, 0.06, 0.3), mat(C.wood), 0.35, 0.36, 0.25);
    olive(g, -1.1, 0.4, 0.9);
    cypress(g, 1.05, -0.5, 1.0);
    return 1.2;
  });

  // RANDEZVOU: café with awning and terrace tables
  venue('randez', 276, 5.75, (g) => {
    mesh(g, new THREE.BoxGeometry(1.4, 0.85, 1.0), mat(C.white), 0, 0.425, -0.3);
    mesh(g, new THREE.BoxGeometry(1.5, 0.1, 1.1), mat(C.olive), 0, 0.9, -0.3);
    const win = glow(0xffbd66);
    [-0.42, 0.42].forEach((x) => mesh(g, new THREE.BoxGeometry(0.34, 0.36, 0.02), win, x, 0.45, 0.21));
    door(g, { x: 0, z: 0.2, w: 0.28, h: 0.55, hex: C.olive });
    for (let i = 0; i < 6; i++) {
      const s = mesh(g, new THREE.BoxGeometry(0.24, 0.03, 0.45), mat(i % 2 ? C.white : C.terracotta), -0.6 + i * 0.24, 0.72, 0.38);
      s.rotation.x = 0.35;
    }
    [[-0.55, 0.95], [0.55, 0.95], [0.8, 1.5]].forEach(([x, z]) => {
      mesh(g, new THREE.CylinderGeometry(0.14, 0.14, 0.03, 14), mat(C.cream), x, 0.3, z);
      mesh(g, new THREE.CylinderGeometry(0.02, 0.02, 0.3, 5), mat(C.wood), x, 0.15, z);
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
      if (Math.hypot(x - v.group.position.x, z - v.group.position.z) < 1.65) return false;
    }
    for (const [sx, sz] of scatter) if (Math.hypot(x - sx, z - sz) < 0.55) return false;
    if (Math.hypot(x - lagX, z - lagZ) < 2.3) return false;
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
  mesh(van, new THREE.BoxGeometry(0.34, 0.28, 0.62), mat(C.white), 0, 0.22, 0);
  mesh(van, new THREE.BoxGeometry(0.35, 0.05, 0.63), mat(C.gold), 0, 0.2, 0);
  mesh(van, new THREE.BoxGeometry(0.3, 0.12, 0.14), mat(C.navy), 0, 0.3, 0.26);
  const wheelGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.05, 12);
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
  const cloudMat = toon({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.18 });
  cloudMat.userData.ink = true;
  for (let i = 0; i < 7; i++) {
    const c = new THREE.Group();
    const n = 4 + Math.floor(Math.random() * 3);
    for (let j = 0; j < n; j++) {
      const k = 1 - Math.abs(j - (n - 1) / 2) / n;
      const s = mesh(c, blob(1, 1, 0.06), cloudMat, j * 0.62 - n * 0.31, k * 0.25, rand(-0.2, 0.2));
      s.scale.set(rand(0.55, 0.8) * (0.7 + k * 0.6), rand(0.4, 0.55) * (0.7 + k * 0.6), rand(0.5, 0.7));
      s.castShadow = false;
    }
    bake(c, { ao: false, shadow: false });
    const below = i < 3;
    c.userData = { a: (i / 7) * Math.PI * 2 + rand(-0.3, 0.3), r: below ? rand(7, 10) : rand(14, 18), y: below ? rand(-7.5, -5.5) : rand(4, 7.5), sp: rand(0.015, 0.035) };
    c.scale.setScalar(below ? rand(1.1, 1.5) : rand(1.2, 1.8));
    scene.add(c);
    clouds.push(c);
  }

  /* ---------------- petals ---------------- */
  const PN = small ? 40 : 80;
  const petalGeo = new THREE.CircleGeometry(0.06, 7);
  petalGeo.scale(1, 0.62, 1);
  const petalMat = toon({ side: THREE.DoubleSide });
  const petals = new THREE.InstancedMesh(petalGeo, petalMat, PN);
  const pdata = [];
  const pcol = [new THREE.Color(C.magenta), new THREE.Color(C.pink), new THREE.Color(0xd65a91)];
  const dummy = new THREE.Object3D();
  for (let i = 0; i < PN; i++) {
    pdata.push({ x: rand(-12, 12), y: rand(-4, 9), z: rand(-12, 12), rx: rand(0, 6), ry: rand(0, 6), vr: rand(0.6, 1.8), vy: rand(0.25, 0.6), ph: rand(0, 6) });
    petals.setColorAt(i, pcol[i % 3]);
  }
  petals.visible = !reduced;
  scene.add(petals);

  /* ---------------- lights ---------------- */
  // toon lights: sun ≈ 0.7π and sky fill ≈ 0.35π keep lit faces true to the palette;
  // the cool sky fill tints the shadow side, like painted shade
  const hemi = new THREE.HemisphereLight(0xdfe9f7, 0xcab09a, 1.15);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff3e0, 2.2);
  sun.position.set(9, 14, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 40 });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 3;
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

  /* ---------------- bake: every piece becomes 1–3 meshes + one outline ---------------- */
  bake(ground, { ao: false });
  island.children.forEach((c) => { if (c !== ground && c.isGroup) bake(c); });
  // phones: only the larger pieces cast shadows
  if (small) {
    island.traverse((o) => {
      if (!o.isMesh || !o.castShadow || o.userData.ink) return;
      if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
      if (o.geometry.boundingSphere.radius < 0.45) o.castShadow = false;
    });
  }

  /* ---------------- interiors (built lazily, on first visit) ---------------- */
  const inScene = new THREE.Scene();
  const inHemi = new THREE.HemisphereLight(0xfff3e4, 0xb59c88, 1.2);
  const inSun = new THREE.DirectionalLight(0xfff0d8, 1.4);
  inSun.castShadow = !small;
  inSun.shadow.mapSize.set(1024, 1024);
  Object.assign(inSun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 0.5, far: 30 });
  inSun.shadow.bias = -0.0015;
  inSun.shadow.normalBias = 0.06;
  inSun.shadow.radius = 4;
  const lamps = [0, 1, 2].map(() => { const l = new THREE.PointLight(0xffc27a, 0, 9, 1.4); inScene.add(l); return l; });
  inScene.add(inHemi, inSun, inSun.target);
  const kit = { THREE, C, mat, toon, glow, bulbMat, mesh, blob, outline, rand, small, cypress, olive, palm, bush, string };
  const ROOMS = window.DorrRooms ? window.DorrRooms(kit) : {};
  const built = {};
  const tagLayer = document.createElement('div');
  tagLayer.className = 'world__tags';
  container.appendChild(tagLayer);
  const getRoom = (id) => {
    if (built[id]) return built[id];
    if (!ROOMS[id]) return null;
    const r = ROOMS[id]();
    r.group.visible = false;
    bake(r.group, { floor: 0, reach: 0.6 });
    if (small) r.group.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    inScene.add(r.group);
    r.tagEls = (r.tags || []).map((t) => {
      const e = document.createElement('span');
      e.className = 'world__tag';
      e.innerHTML = `<b>${t.n}</b>${t.label}`;
      tagLayer.appendChild(e);
      return e;
    });
    ['view', 'door'].forEach((k) => { r[k] = { pos: new THREE.Vector3().fromArray(r[k].pos), look: new THREE.Vector3().fromArray(r[k].look) }; });
    r.bgDay = new THREE.Color(r.bg[0]); r.bgNight = new THREE.Color(r.bg[1]);
    try { renderer.compile(inScene, camera); } catch (e) {}
    built[id] = r;
    return r;
  };

  /* ---------------- the door-light transition ---------------- */
  const flashEl = document.createElement('div');
  flashEl.className = 'world__flash';
  container.appendChild(flashEl);
  const F = { a: 0, s: 0.02, x: 0, y: 0, color: '' };
  let flashKey = '';
  const drawFlash = () => {
    const k = F.a.toFixed(3) + F.s.toFixed(3) + (F.x | 0) + (F.y | 0);
    if (k === flashKey) return;
    flashKey = k;
    flashEl.style.opacity = F.a.toFixed(3);
    flashEl.style.transform = `translate3d(${F.x.toFixed(1)}px, ${F.y.toFixed(1)}px, 0) scale(${F.s.toFixed(3)})`;
  };

  /* ---------------- camera & state ---------------- */
  const S = {
    intro: 0, night: 0, focus: 0, focusT: 0, focusV: 0, swap: 1, rotY: -0.35, vel: 0, drag: false,
    focusRot: 0, focusId: null, mx: 0, my: 0, cmx: 0, cmy: 0,
    approach: 0, inside: 0, yaw: 0, pitch: 0, yawT: 0, pitchT: 0,
  };
  // where we are: 'island' (outside), 'in' (inside a place), 'busy' (flying in or out)
  let mode = 'island';
  let phase = 'out'; // which scene is drawn: 'out' (island) or 'in' (interior)
  let room = null, roomId = null;
  const look = new THREE.Vector3();
  const ovT = { pos: new THREE.Vector3(), look: new THREE.Vector3() }; // overview target (changes on resize)
  const ov = { pos: new THREE.Vector3(), look: new THREE.Vector3() }; // overview, eased toward ovT
  const overview = (out) => {
    if (cw < 700) { out.pos.set(0, 23, 54); out.look.set(0, -4.6, 0); return out; }
    const wide = cw / Math.max(1, ch) > 1.25;
    out.pos.set(0, 13.5, 33); out.look.set(wide ? -4.2 : 0, -0.6, 0);
    return out;
  };
  const closeup = (v, out) => {
    const r = v.radius;
    const h = v.height;
    const side = narrow() ? 0 : 1.2;
    if (v.id === 'services') { out.pos.set(0, 5.6, 11.5); out.look.set(side, 1.0, 0); return out; }
    out.pos.set(0, 3.2 + h * 0.8, r + (narrow() ? 10 : 7.5)); out.look.set(side, h * 0.35, r - 0.6);
    return out;
  };
  // close-up actually used: blends from the previous place to the new one when switching places
  const cu = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
  const cuFrom = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
  const cuTo = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
  let fv = null;
  overview(ovT); overview(ov);
  const interiorFov = () => (cw / Math.max(1, ch) < 0.8 ? 66 : cw / Math.max(1, ch) < 1.2 ? 58 : 50);

  const resize = () => {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    const dpr = dprCap(w);
    const touch = window.matchMedia('(pointer: coarse)').matches;
    // a phone's address bar showing/hiding only changes the height a little: ignore it
    if (w === cw && h === ch && dpr === renderer.getPixelRatio() && renderer.domElement.width) return;
    if (touch && w === cw && Math.abs(h - ch) < 120 && renderer.domElement.width) return;
    cw = w; ch = h;
    if (dpr !== renderer.getPixelRatio()) renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    if (phase === 'in') camera.fov = interiorFov();
    camera.updateProjectionMatrix();
    sizeInk();
    overview(ovT);
    measurePins = true;
  };
  const inkRes = new THREE.Vector2();
  const sizeInk = () => {
    renderer.getDrawingBufferSize(inkRes);
    ink.uniforms.uRes.value.copy(inkRes);
    ink.uniforms.uWidth.value = Math.max(1, 1.45 * renderer.getPixelRatio());
  };
  let resizeT = 0;
  const queueResize = () => { clearTimeout(resizeT); resizeT = setTimeout(resize, 120); };
  if (window.ResizeObserver) new ResizeObserver(queueResize).observe(container);
  else window.addEventListener('resize', queueResize);
  renderer.setSize(cw, ch, false);
  camera.aspect = cw / Math.max(1, ch);
  camera.updateProjectionMatrix();
  sizeInk();

  /* ---------------- interaction ---------------- */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const hits = venues.map((v) => v.hit);
  let downY = 0, lastX = 0, lastY = 0, moved = 0, hoverId = null, dragDX = 0, dragDY = 0;
  let hoverDirty = false, px = 0, py = 0;
  const el = renderer.domElement;
  const pick = (x, y) => {
    const r = el.getBoundingClientRect();
    ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(hits, false)[0];
    return hit ? hit.object.userData.id : null;
  };
  el.addEventListener('pointerdown', (e) => {
    S.drag = true; moved = 0; dragDX = 0; dragDY = 0;
    if (mode === 'island') S.vel = 0;
    lastX = e.clientX; lastY = e.clientY; downY = e.clientY;
    el.setPointerCapture(e.pointerId);
  });
  // pointer events only record; the work (rotation, hover ray-cast) happens once per frame
  el.addEventListener('pointermove', (e) => {
    px = e.clientX; py = e.clientY;
    if (e.pointerType === 'mouse') {
      S.mx = (e.offsetX / Math.max(1, cw) - 0.5) * 2;
      S.my = (e.offsetY / Math.max(1, ch) - 0.5) * 2;
    }
    if (S.drag) {
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      moved += Math.abs(dx) + Math.abs(e.clientY - downY) * 0.2;
      if (!S.focusId || mode === 'in') { dragDX += dx; dragDY += dy; }
      return;
    }
    if (e.pointerType === 'mouse' && mode === 'island') hoverDirty = true;
  });
  const end = (e) => {
    if (!S.drag) return;
    S.drag = false;
    if (moved < 6 && mode === 'island' && S.intro > 0.85) {
      const id = pick(e.clientX, e.clientY);
      if (id) opts.onSelect && opts.onSelect(id);
    }
  };
  el.addEventListener('pointerup', end);
  // a vertical swipe on a phone becomes a page scroll: stop turning straight away
  el.addEventListener('pointercancel', () => { S.drag = false; if (mode === 'island') S.vel = 0; dragDX = 0; dragDY = 0; });
  el.addEventListener('pointerleave', (e) => {
    if (e.pointerType !== 'mouse') return;
    S.mx = 0; S.my = 0;
    if (hoverId) { hoverId = null; el.style.cursor = 'grab'; opts.onHover && opts.onHover(null); }
  });
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

  // compile every shader now, while everything is visible, so the intro never hitches on a first draw
  camera.position.set(0, 13.5, 33);
  camera.lookAt(0, 0, 0);
  try { renderer.compile(scene, camera); } catch (e) {}

  // start in the "before intro" state straight away, so nothing is drawn assembled and then snapped away
  lineGeo.setDrawRange(0, 0);
  const pieces = island.children.filter((c) => c !== ground && c.type !== 'PointLight');
  island.position.y = -9;
  island.scale.setScalar(0.7);
  pieces.forEach((p) => { p.userData.y0 = p.position.y; p.position.y += 6; p.visible = false; });
  let introTl = null;
  const intro = () => {
    if (introTl) return introTl;
    const line = { n: 0 };
    const tl = gsap.timeline();
    tl.to(line, { n: LN + 1, duration: 1.5, ease: 'power2.inOut', onUpdate: () => lineGeo.setDrawRange(0, Math.floor(line.n)) }, 0)
      .to(island.position, { y: 0, duration: 1.6, ease: 'expo.out' }, 1.0)
      .to(island.scale, { x: 1, y: 1, z: 1, duration: 1.6, ease: 'expo.out' }, 1.0)
      .to(lineMat, { opacity: 0, duration: 0.8 }, 1.9)
      .to(S, { intro: 1, duration: 2.6, ease: 'power3.inOut' }, 0)
      .add(() => { drawLine.visible = false; });
    pieces.forEach((p, i) => {
      tl.add(() => { p.visible = true; }, 1.5 + i * 0.03);
      tl.to(p.position, { y: p.userData.y0, duration: 0.9, ease: 'back.out(1.6)' }, 1.5 + i * 0.03);
    });
    introTl = tl;
    return tl;
  };

  /* ---------------- loop ---------------- */
  const clock = new THREE.Clock();
  const vTmp = new THREE.Vector3();
  const camPos = new THREE.Vector3();
  const dPos = new THREE.Vector3(), dLook = new THREE.Vector3(), nOut = new THREE.Vector3(), dir = new THREE.Vector3(), right = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  const nightSky = new THREE.Color(0x2b2f5c), daySky = new THREE.Color(0xdfe9f7);
  const nightGround = new THREE.Color(0x3a2b3a), dayGround = new THREE.Color(0xcab09a);
  const sunDay = new THREE.Color(0xfff3e0), sunNight = new THREE.Color(0x8fa2ff);
  const inkDay = new THREE.Color(0x2e2731), inkNight = new THREE.Color(0x14142a);
  const inNightSky = new THREE.Color(0x4a4670), inNightGround = new THREE.Color(0x2c2430);
  const tmpCol = new THREE.Color();
  const pinState = venues.map(() => ({ tf: '', op: '', pe: '', nx: '', w: 0 }));
  let measurePins = true; // label widths, read once after the intro and after each resize
  let running = false;
  let lastNight = -1, lastRoomNight = -1;
  const damp = (k, dt) => 1 - Math.exp(-k * dt);
  const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const project = (v) => { vTmp.copy(v).project(camera); return [(vTmp.x * 0.5 + 0.5) * cw, (-vTmp.y * 0.5 + 0.5) * ch, vTmp.z]; };

  const islandFrame = (dt, t, amb) => {
    // fly in / out: a critically damped spring, so turning back halfway keeps the camera's momentum
    if (reduced) { S.focus = S.focusT; S.focusV = 0; }
    else {
      const k = 3.6;
      S.focusV += (k * k * (S.focusT - S.focus) - 2 * k * S.focusV) * dt;
      S.focus += S.focusV * dt;
      if (S.focus < 0) { S.focus = 0; S.focusV = 0; } else if (S.focus > 1) { S.focus = 1; S.focusV = 0; }
    }
    if (S.focusId && S.focusT === 0 && S.focus < 0.0005 && Math.abs(S.focusV) < 0.002) { S.focus = 0; S.focusV = 0; S.focusId = null; }

    // rotation: drag, inertia + idle drift, or focus target (frame-rate independent)
    if (S.focusId) {
      const k = reduced ? 12 : 3.4;
      S.vel += (k * k * (S.focusRot - S.rotY) - 2 * k * S.vel) * dt;
      S.rotY += S.vel * dt;
      dragDX = 0; dragDY = 0;
    } else if (S.drag) {
      const d = dragDX * 0.006;
      dragDX = 0; dragDY = 0;
      S.rotY += d;
      if (dt > 0) S.vel = Math.max(-6, Math.min(6, S.vel * 0.5 + (d / dt) * 0.5));
    } else {
      S.vel *= Math.exp(-3.7 * dt);
      S.rotY += (S.vel + 0.045 * amb) * dt;
    }
    world.rotation.y = S.rotY;
    world.position.y = Math.sin(t * 0.6) * 0.12 * amb * (1 - S.focus);

    // camera: intro sweep from above, overview, or close-up — every target is eased, nothing snaps
    ov.pos.lerp(ovT.pos, damp(4, dt));
    ov.look.lerp(ovT.look, damp(4, dt));
    if (S.focusId) {
      if (!fv || fv.id !== S.focusId) fv = venues.find((v) => v.id === S.focusId);
      closeup(fv, cuTo);
      if (S.swap < 1) {
        cu.pos.copy(cuFrom.pos).lerp(cuTo.pos, S.swap);
        cu.look.copy(cuFrom.look).lerp(cuTo.look, S.swap);
      } else {
        cu.pos.copy(cuTo.pos);
        cu.look.copy(cuTo.look);
      }
    } else {
      fv = null;
      cu.pos.copy(ov.pos);
      cu.look.copy(ov.look);
    }
    if (!reduced) {
      S.cmx += (S.mx - S.cmx) * damp(4, dt);
      S.cmy += (S.my - S.cmy) * damp(4, dt);
    }
    const ip = 1 - S.intro;
    camPos.copy(ov.pos).lerp(cu.pos, S.focus);
    camPos.y += ip * 22;
    camPos.z -= ip * 10;
    const par = (1 - S.focus * 0.7) * (1 - S.approach);
    camPos.x += S.cmx * 0.9 * par;
    camPos.y += -S.cmy * 0.6 * par;
    look.copy(ov.look).lerp(cu.look, S.focus);

    // approach: swoop to the front of the door, then dolly through it
    if (S.approach > 0 && fv && fv.door) {
      world.updateMatrixWorld(true);
      fv.door.anchor.getWorldPosition(dLook);
      nOut.set(0, 0, 1).transformDirection(fv.group.matrixWorld);
      nOut.y = 0; nOut.normalize();
      const a = S.approach;
      const dist = 1.7 * (1 - sstep(0.35, 1, a)) + 0.12;
      dPos.copy(dLook).addScaledVector(nOut, dist);
      dPos.y += 0.22 * (1 - sstep(0.3, 1, a));
      const w = sstep(0, 0.45, a);
      camPos.lerp(dPos, w);
      dir.copy(dLook).addScaledVector(nOut, -1.2);
      look.lerp(dir, w);
    }
    camera.position.copy(camPos);
    camera.lookAt(look);
    if (S.approach > 0 && fv && fv.door && phase === 'out' && mode === 'busy' && F.track) {
      // the door light grows from the doorway until it fills the view
      camera.updateMatrixWorld();
      const p = project(dLook);
      F.x = p[0]; F.y = p[1];
      F.a = sstep(0.5, 0.72, S.approach);
      F.s = 0.015 + 0.985 * Math.pow(sstep(0.48, 0.99, S.approach), 2.2);
    }

    // gold ring, van, clouds, petals
    if (goldRing) { goldRing.rotation.x = Math.PI / 2 + Math.sin(t * 0.8) * 0.15 * amb; goldRing.rotation.z = t * 0.6 * amb; goldRing.position.y = 2.75 + Math.sin(t * 1.3) * 0.08 * amb; }
    vanA += dt * 0.32 * amb;
    van.position.set(Math.sin(vanA) * 4.55, 0.04, Math.cos(vanA) * 4.55);
    van.rotation.y = vanA + Math.PI / 2;
    for (let i = 0; i < clouds.length; i++) {
      const c = clouds[i], d = c.userData;
      d.a += dt * d.sp * amb;
      c.position.set(Math.sin(d.a) * d.r, d.y + Math.sin(t * 0.4 + d.a) * 0.2 * amb, Math.cos(d.a) * d.r);
    }
    if (petals.visible) {
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
    }
    renderer.render(scene, camera);
  };

  const roomFrame = (dt, t) => {
    // look around: drag turns the head (free all the way round in the rotunda), mouse adds a little parallax
    const free = room.yaw === 'free';
    const lim = free ? Infinity : room.yaw || 0.6;
    S.yawT -= dragDX * 0.005;
    S.pitchT -= dragDY * 0.003;
    dragDX = 0; dragDY = 0;
    if (!free) S.yawT = Math.max(-lim, Math.min(lim, S.yawT));
    S.pitchT = Math.max(-0.2, Math.min(0.22, S.pitchT));
    if (!reduced) {
      S.cmx += (S.mx - S.cmx) * damp(3, dt);
      S.cmy += (S.my - S.cmy) * damp(3, dt);
    }
    S.yaw += (S.yawT - S.cmx * 0.1 - S.yaw) * damp(reduced ? 30 : 5, dt);
    S.pitch += (S.pitchT - S.cmy * 0.05 - S.pitch) * damp(reduced ? 30 : 5, dt);
    camPos.copy(room.door.pos).lerp(room.view.pos, S.inside);
    look.copy(room.door.look).lerp(room.view.look, S.inside);
    // a slight breathing sway, like holding a camera
    camPos.y += Math.sin(t * 0.9) * 0.012 * (reduced ? 0 : 1);
    dir.subVectors(look, camPos);
    const k = sstep(0.2, 1, S.inside);
    dir.applyAxisAngle(UP, S.yaw * k);
    right.crossVectors(dir, UP).normalize();
    dir.applyAxisAngle(right, S.pitch * k);
    camera.position.copy(camPos);
    look.copy(camPos).add(dir);
    camera.lookAt(look);
    if (room.update) room.update(t, dt, S.night, reduced);
    renderer.render(inScene, camera);
    // station labels (rotunda)
    if (room.tagEls.length) {
      const show = mode === 'in' ? 1 : 0;
      room.tags.forEach((tg, i) => {
        const e = room.tagEls[i];
        vTmp.fromArray(tg.pos).project(camera);
        const vis = show && vTmp.z < 1 && Math.abs(vTmp.x) < 1.1 && Math.abs(vTmp.y) < 1.1;
        e.style.opacity = vis ? '1' : '0';
        if (vis) e.style.transform = `translate3d(${((vTmp.x * 0.5 + 0.5) * cw).toFixed(1)}px, ${((-vTmp.y * 0.5 + 0.5) * ch).toFixed(1)}px, 0)`;
      });
    }
  };

  const applyNight = () => {
    const n = S.night;
    if (n !== lastNight) {
      lastNight = n;
      hemi.color.copy(daySky).lerp(nightSky, n);
      hemi.groundColor.copy(dayGround).lerp(nightGround, n);
      hemi.intensity = 1.15 - 0.6 * n;
      sun.color.copy(sunDay).lerp(sunNight, n);
      sun.intensity = 2.2 - 1.6 * n;
      glowMats.forEach((m) => { m.emissiveIntensity = n * 1.5; });
      bulbs.forEach((m) => { m.emissiveIntensity = 0.15 + n * 2.2; });
      venueLights.forEach((l) => { l.intensity = n * 3.2; });
      coreLight.intensity = n * 4;
      cloudMat.color.setRGB(1 - n * 0.5, 1 - n * 0.45, 1 - n * 0.25);
      cloudMat.emissiveIntensity = 0.18 * (1 - n);
      ink.uniforms.uColor.value.copy(inkDay).lerp(inkNight, n);
      doorLight.color.setRGB(1, 0.89 - n * 0.08, 0.68 - n * 0.2);
    }
    if (phase === 'in' && room && (n !== lastRoomNight || room.dirty)) {
      lastRoomNight = n;
      room.dirty = false;
      const h = room.hemi || [0xfff3e4, 0xb59c88, 1.2];
      inHemi.color.set(h[0]).lerp(inNightSky, n * 0.85);
      inHemi.groundColor.set(h[1]).lerp(inNightGround, n * 0.85);
      inHemi.intensity = h[2] * 1.7 * (1 - 0.55 * n);
      inSun.color.set(room.sunColor || 0xfff0d8).lerp(sunNight, n);
      inSun.intensity = (room.sunInt || 1.4) * (1 - 0.8 * n);
      lamps.forEach((l, i) => {
        const p = room.lamps[i];
        l.visible = !!p;
        if (p) { l.position.fromArray(p); l.intensity = (room.lampDay || 0.4) + n * (room.lampNight || 4); }
      });
      tmpCol.copy(room.bgDay).lerp(room.bgNight, n);
      renderer.setClearColor(tmpCol, 1);
      if (room.night) room.night(n);
    }
  };

  const frame = () => {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    const amb = reduced ? 0 : 1; // ambient motion (drift, bobbing, van, clouds) off for reduced motion
    applyNight();

    if (phase === 'in' && room) roomFrame(dt, t);
    else islandFrame(dt, t, amb);
    drawFlash();

    // hover ray-cast, at most once per frame
    if (hoverDirty && !S.drag && phase === 'out') {
      hoverDirty = false;
      const id = mode === 'island' ? pick(px, py) : null;
      if (id !== hoverId) {
        hoverId = id;
        el.style.cursor = id ? 'pointer' : 'grab';
        opts.onHover && opts.onHover(id);
      }
    }

    // HTML pins follow their buildings. Done after render(), so the matrices are this frame's.
    if (opts.pins && phase === 'out') {
      if (measurePins && S.intro > 0.85) {
        measurePins = false;
        venues.forEach((v, i) => { const sp = opts.pins[v.id] && opts.pins[v.id].querySelector('span'); pinState[i].w = sp ? sp.offsetWidth : 0; });
      }
      for (let i = 0; i < venues.length; i++) {
        const v = venues[i];
        const pin = opts.pins[v.id];
        if (!pin) continue;
        const st = pinState[i];
        vTmp.set(0, v.height + 0.5, 0);
        v.group.localToWorld(vTmp);
        const facing = Math.cos(v.a + S.rotY);
        vTmp.project(camera);
        const x = (vTmp.x * 0.5 + 0.5) * cw;
        const y = (-vTmp.y * 0.5 + 0.5) * ch;
        const tf = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
        const vis = v.id === 'services' ? 1 : Math.max(0, Math.min(1, (facing + 0.35) * 1.6));
        const shown = S.intro > 0.85 && mode === 'island';
        const op = String(shown ? (S.focusId && S.focusId !== v.id ? 0 : Math.round(vis * (1 - S.focus * 0.6) * 100) / 100) : 0);
        const pe = shown && vis > 0.4 && !S.focusId ? 'auto' : 'none';
        if (tf !== st.tf) { pin.style.transform = tf; st.tf = tf; }
        if (op !== st.op) { pin.style.opacity = op; st.op = op; }
        if (pe !== st.pe) { pin.style.pointerEvents = pe; st.pe = pe; }
        // keep the label inside the frame when its building sits near the edge (the dot stays on the building)
        const half = st.w / 2, m = 16;
        const nx = String(Math.round(x - half < m ? m - (x - half) : x + half > cw - m ? cw - m - (x + half) : 0));
        if (nx !== st.nx) { pin.style.setProperty('--nx', nx + 'px'); st.nx = nx; }
      }
    }
  };

  /* ---------------- going in and out ---------------- */
  let tl = null;
  const kill = () => { if (tl) { tl.kill(); tl = null; } };
  const focusOn = (v) => {
    if (S.focusId && S.focusId !== v.id && S.focus > 0.001) {
      cuFrom.pos.copy(cu.pos); cuFrom.look.copy(cu.look);
      S.swap = 0;
      gsap.to(S, { swap: 1, duration: 1.6, ease: 'power3.inOut', overwrite: 'auto' });
    } else if (S.focusId !== v.id) {
      gsap.killTweensOf(S, 'swap');
      S.swap = 1;
    }
    S.focusId = v.id;
    S.focusRot = v.id === 'services' ? S.rotY + S.vel * 0.3 : shortest(S.rotY, -v.a);
    S.focusT = 1;
  };
  const toRoom = (id) => {
    room = getRoom(id);
    roomId = id;
    Object.values(built).forEach((r) => { r.group.visible = r === room; r.tagEls.forEach((e) => { e.style.opacity = '0'; }); });
    room.dirty = true;
    inSun.position.fromArray(room.sun || [4, 8, 5]);
    inSun.castShadow = !small && room.shadows !== false;
    inSun.target.position.set(0, 0, 0);
    S.inside = 0; S.yaw = S.yawT = room.startYaw || 0; S.pitch = S.pitchT = 0;
    phase = 'in';
    camera.fov = interiorFov();
    camera.near = 0.05;
    camera.updateProjectionMatrix();
    el.style.touchAction = 'none'; // inside, every swipe looks around (the page is locked anyway)
    tagLayer.classList.toggle('is-on', room.tagEls.length > 0);
  };
  const toIsland = () => {
    phase = 'out';
    if (room) { room.group.visible = false; room.tagEls.forEach((e) => { e.style.opacity = '0'; }); }
    tagLayer.classList.remove('is-on');
    renderer.setClearColor(0x000000, 0);
    camera.fov = 30;
    camera.near = 0.08;
    camera.updateProjectionMatrix();
    el.style.touchAction = 'pan-y';
  };
  const setFlashColor = (id) => {
    const c = id === 'sayah' ? '#fff6e2' : S.night > 0.5 ? '#ffd9a3' : '#fff0d6';
    if (c !== F.color) { F.color = c; flashEl.style.setProperty('--flash', c); }
  };
  const enter = (id) => {
    const v = venues.find((x) => x.id === id);
    if (!v || !ROOMS[id] || S.intro < 0.85) return false;
    if (mode !== 'island') return false;
    mode = 'busy';
    kill();
    hoverId = null; el.style.cursor = 'grab'; opts.onHover && opts.onHover(null);
    getRoom(id); // build now (first visit only); the work hides under the click
    setFlashColor(id);
    const wasFocused = S.focusId === id && S.focus > 0.9;
    focusOn(v);
    F.track = true;
    const d = v.door;
    tl = gsap.timeline();
    if (reduced) {
      // reduced motion: a soft fade through the light, no flight
      tl.add(() => { S.focus = 1; S.approach = 1; F.track = false; F.x = cw / 2; F.y = ch / 2; F.s = 1; })
        .to(F, { a: 1, duration: 0.35 })
        .add(() => { toRoom(id); S.inside = 1; })
        .to(F, { a: 0, duration: 0.45 })
        .add(() => { mode = 'in'; opts.onInside && opts.onInside(id); });
      return true;
    }
    const lead = wasFocused ? 0.1 : 1.15;
    tl.to(S, { approach: 1, duration: 1.9, ease: 'power2.in' }, lead);
    if (d && d.hinge) tl.to(d.hinge.rotation, { y: -1.9, duration: 1.0, ease: 'power2.inOut' }, lead + 0.35);
    tl.addLabel('in', lead + 1.9);
    tl.add(() => {
      F.track = false; F.a = 1; F.s = 1;
      toRoom(id);
      S.approach = 0;
      if (d && d.hinge) d.hinge.rotation.y = 0;
    }, 'in');
    tl.to(S, { inside: 1, duration: 2.0, ease: 'power2.out' }, 'in');
    tl.to(F, { a: 0, duration: 0.9, ease: 'power1.out' }, 'in+=0.05');
    tl.add(() => { mode = 'in'; opts.onInside && opts.onInside(id); }, 'in+=0.8');
    return true;
  };
  // fly back out to the island; `then` (optional) continues somewhere else instead of the overview
  const exit = (then) => {
    if (mode !== 'in' || !room) return false;
    mode = 'busy';
    kill();
    const v = venues.find((x) => x.id === roomId);
    opts.onLeave && opts.onLeave(roomId, !!then);
    setFlashColor(roomId);
    F.track = false; F.x = cw / 2; F.y = ch / 2;
    if (room.yaw === 'free') { const y = Math.atan2(Math.sin(S.yaw), Math.cos(S.yaw)); S.yawT = S.yawT - S.yaw + y; S.yaw = y; }
    tl = gsap.timeline();
    const outside = () => {
      toIsland();
      S.approach = 1;
      if (v.door && v.door.hinge) v.door.hinge.rotation.y = -1.9;
    };
    const done = () => {
      tl = null;
      if (then) { mode = 'island'; then(); return; }
      mode = 'island';
      opts.onOutside && opts.onOutside();
    };
    if (reduced) {
      tl.add(() => { F.s = 1; })
        .to(F, { a: 1, duration: 0.35 })
        .add(() => { outside(); S.approach = 0; if (v.door && v.door.hinge) v.door.hinge.rotation.y = 0; })
        .to(F, { a: 0, duration: 0.45 })
        .add(done);
      return true;
    }
    F.s = 0.02; F.a = 0;
    tl.to(S, { inside: 0, yawT: 0, pitchT: 0, duration: 1.3, ease: 'power2.in' }, 0)
      .to(F, { a: 1, duration: 0.45, ease: 'power1.in' }, 0.75)
      .to(F, { s: 1, duration: 0.6, ease: 'power2.in' }, 0.7)
      .add(outside, 1.32)
      .to(S, { approach: 0, duration: 1.7, ease: 'power2.out' }, 1.34)
      .to(F, { a: 0, duration: 0.8, ease: 'power1.out' }, 1.4);
    if (v.door && v.door.hinge) tl.to(v.door.hinge.rotation, { y: 0, duration: 0.9, ease: 'power2.inOut' }, 2.2);
    // heading back to the overview starts while still backing away; the next place waits for the step back
    if (!then) tl.add(() => { S.focusT = 0; }, 2.35);
    tl.add(done, 3.05);
    return true;
  };

  return {
    venues: venues.map((v) => v.id),
    intro,
    // driven by gsap's ticker: one rAF for the whole page, and tweens are already updated when we draw
    start() { if (running) return; running = true; clock.getDelta(); gsap.ticker.add(frame); },
    stop() { if (!running) return; running = false; gsap.ticker.remove(frame); },
    setNight(on, instant) {
      gsap.killTweensOf(S, 'night');
      if (instant) S.night = on ? 1 : 0;
      else gsap.to(S, { night: on ? 1 : 0, duration: 2.2, ease: 'power2.inOut' });
    },
    enter,
    exit() { return exit(); },
    // go to another place: from inside, out through the door, across the island and in again
    go(id) {
      if (mode === 'in') return exit(() => enter(id));
      return enter(id);
    },
    canEnter: (id) => !!ROOMS[id],
    get mode() { return mode; },
    get place() { return mode === 'island' ? null : roomId; },
    select(id) { const v = venues.find((x) => x.id === id); if (v && mode === 'island') focusOn(v); },
    release() { if (S.focusId && mode === 'island') S.focusT = 0; },
  };
};
