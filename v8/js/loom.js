/* DORR v8 — loom.js
   Photographs rendered as a loom: the frame is cut into narrow columns and short rows; each cell samples the
   picture once and becomes a vertical thread whose width follows how dark that cell is. Neighbouring cells of a
   column join into continuous warp threads, so silhouettes come out stepped and woven. Uniforms let a picture
   weave in column by column, resolve into the full photograph (uMix), sway like cloth in air, and part under the
   cursor. One small WebGL1 context per figure, created near the viewport, paused off-screen, released when far,
   and dropped entirely (static <img> fallback) when frames run slow. */
(function () {
  'use strict';

  var VERT = 'attribute vec2 aPos;varying vec2 vUv;void main(){vUv=aPos*0.5+0.5;gl_Position=vec4(aPos,0.0,1.0);}';
  var FRAG = [
    'precision mediump float;',
    'varying vec2 vUv;',
    'uniform sampler2D uTex;',
    'uniform vec2 uRes;uniform vec4 uFit;',
    'uniform float uCell;uniform float uRow;',
    'uniform vec3 uFg;uniform vec3 uBg;uniform float uBgA;',
    'uniform float uLo;uniform float uHi;uniform float uGamma;uniform float uInv;',
    'uniform float uKey;uniform float uTint;uniform float uMix;uniform float uReveal;',
    'uniform float uTime;uniform float uSway;uniform vec3 uMouse;uniform float uLens;',
    'uniform float uMinW;uniform float uMaxW;',
    'float h1(float n){return fract(sin(n*127.1+11.7)*43758.5453);}',
    'float h2(vec2 p){return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5453);}',
    'vec2 tUv(vec2 uv){return uv*uFit.xy+uFit.zw;}',
    'float inside(vec2 t){return step(0.0,t.x)*step(t.x,1.0)*step(0.0,t.y)*step(t.y,1.0);}',
    'void main(){',
    '  vec2 px=vUv*uRes;',
    '  float col=floor(px.x/uCell);',
    '  float rc=h1(col);',
    '  float row=floor(px.y/uRow);',
    '  vec2 cell=vec2(col,row);',
    '  vec2 cc=(cell+0.5)*vec2(uCell,uRow);',
    '  float dm=length(px-uMouse.xy);',
    '  float lens=uMouse.z*(1.0-smoothstep(0.0,uLens,dm));',
    '  cc.x+=sin(row*0.31+uTime*0.8+rc*6.2831)*uSway*uCell;',
    '  vec2 tu=tUv(cc/uRes);',
    '  vec4 tx=texture2D(uTex,tu);',
    '  float ins=inside(tu);',
    '  float l=dot(tx.rgb,vec3(0.299,0.587,0.114));',
    '  l=clamp((l-uLo)/max(uHi-uLo,0.001),0.0,1.0);',
    '  l=pow(l,uGamma);',
    '  float dens=mix(1.0-l,l,uInv)*ins;',
    '  float w=mix(uMinW,uMaxW,dens)*(0.86+0.28*h2(cell+7.0));',
    '  w*=(1.0-0.6*lens);',
    '  float side=sign(px.x-uMouse.x+0.001);',
    '  float fx=fract(px.x/uCell)-0.5-(rc-0.5)*0.14-side*lens*0.22;',
    '  float aa=1.2/uCell;',
    '  float th=1.0-smoothstep(w*0.5-aa,w*0.5+aa,abs(fx));',
    '  th*=step(uKey,dens);',
    '  float yN=mod(col,2.0)>0.5?1.0-vUv.y:vUv.y;',
    '  float rv=clamp(uReveal*1.5-rc*0.5,0.0,1.0);',
    '  th*=step(1.0-rv,1.0-yN+0.0001)*step(0.0001,rv);',
    '  vec3 tc=mix(uFg,min(tx.rgb*1.12,vec3(1.0)),uTint)*(0.9+0.18*h2(cell));',
    '  vec3 pre=tc*th+uBg*uBgA*(1.0-th);',
    '  float al=th+uBgA*(1.0-th);',
    '  vec3 ph=texture2D(uTex,tUv(vUv)).rgb;',
    '  float m=clamp(uMix*1.6-rc*0.6,0.0,1.0)*(1.0-lens);',
    '  gl_FragColor=mix(vec4(pre,al),vec4(ph,1.0),m);',
    '}'
  ].join('\n');

  function hex(c) {
    c = (c || '#000').replace('#', '');
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    return [parseInt(c.slice(0, 2), 16) / 255, parseInt(c.slice(2, 4), 16) / 255, parseInt(c.slice(4, 6), 16) / 255];
  }

  var isPhone = window.matchMedia('(max-width: 700px)').matches || /Mobi|Android/i.test(navigator.userAgent);
  var DPR_CAP = isPhone ? 1.5 : 1.75;
  var MAX_LIVE = isPhone ? 5 : 8;

  var supported = (function () {
    try {
      var c = document.createElement('canvas');
      var g = c.getContext('webgl') || c.getContext('experimental-webgl');
      var ok = !!g;
      if (g && g.getExtension('WEBGL_lose_context')) g.getExtension('WEBGL_lose_context').loseContext();
      return ok;
    } catch (e) { return false; }
  })();

  var all = [];
  var level = 0; // 0 full, 1 still (no sway), 2 off
  var forceGL = /[?&]gl=force/.test(location.search);

  function Loom(canvas, opts) {
    this.canvas = canvas;
    this.o = Object.assign({
      fg: '#d6cdbd', bg: '#141a1b', bgA: 0, cell: 6, row: 1.0, lo: 0.0, hi: 1.0, gamma: 1.0, invert: 0,
      key: 0.04, tint: 0, mix: 0, reveal: 1, sway: 0, zoom: 1, fx: 0.5, fy: 0.5, panX: 0, panY: 0,
      fit: 'cover', hover: false, lens: 120, minW: 0.0, maxW: 0.95, live: false
    }, opts || {});
    this.host = this.o.host || canvas.parentElement;
    this.img = this.o.img || this.host.querySelector('img');
    this.gl = null; this.visible = false; this.near = false; this.dirty = true; this.ready = false;
    this.mouse = [0, 0, 0]; this.mouseTarget = 0; this.t = Math.random() * 10;
    this.onReady = this.o.onReady || null;
    all.push(this);
  }

  Loom.prototype.set = function (props) { Object.assign(this.o, props); this.dirty = true; return this; };

  Loom.prototype.init = function () {
    if (this.gl || level >= 2 || !supported) return;
    var self = this, cv = this.canvas;
    var gl = cv.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false, powerPreference: 'low-power' });
    if (!gl) return;
    function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }
    var p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { return; }
    gl.useProgram(p);
    var b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(p, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var names = ['uTex', 'uRes', 'uFit', 'uCell', 'uRow', 'uFg', 'uBg', 'uBgA', 'uLo', 'uHi', 'uGamma', 'uInv', 'uKey', 'uTint', 'uMix', 'uReveal', 'uTime', 'uSway', 'uMouse', 'uLens', 'uMinW', 'uMaxW'];
    this.u = {};
    for (var i = 0; i < names.length; i++) this.u[names[i]] = gl.getUniformLocation(p, names[i]);
    this.gl = gl; this.prog = p;
    this.lost = function (e) { e.preventDefault(); self.gl = null; self.ready = false; };
    cv.addEventListener('webglcontextlost', this.lost, false);
    var img = this.img;
    var upload = function () {
      if (!self.gl) return;
      var tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img); } catch (e) { self.destroy(); return; }
      self.iw = img.naturalWidth; self.ih = img.naturalHeight;
      self.tex = tex; self.ready = true; self.dirty = true; self.resize();
      self.render(0);
      if (self.onReady && !self.readyFired) { self.readyFired = true; self.onReady(self); }
    };
    if (img.complete && img.naturalWidth) upload();
    else { img.loading = 'eager'; img.addEventListener('load', upload, { once: true }); }
  };

  Loom.prototype.resize = function () {
    if (!this.gl) return;
    var r = this.canvas.getBoundingClientRect();
    var d = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    var w = Math.max(2, Math.round(r.width * d)), h = Math.max(2, Math.round(r.height * d));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    this.dpr = d; this.cssW = r.width; this.cssH = r.height; this.dirty = true;
  };

  Loom.prototype.fit = function () {
    var o = this.o, ca = this.canvas.width / this.canvas.height, ia = this.iw / this.ih, sx, sy;
    var cover = o.fit === 'cover';
    if ((ca > ia) === cover) { sx = 1; sy = ia / ca; } else { sx = ca / ia; sy = 1; }
    sx /= o.zoom; sy /= o.zoom;
    var fyb = 1 - o.fy;
    return [sx, sy, o.fx * (1 - sx) + o.panX, fyb * (1 - sy) - o.panY];
  };

  Loom.prototype.render = function (dt) {
    var gl = this.gl;
    if (!gl || !this.ready) return;
    var o = this.o, u = this.u, d = this.dpr || 1;
    if (o.sway && level === 0) this.t += dt;
    // ease the cursor strength
    var m = this.mouse; m[2] += (this.mouseTarget - m[2]) * Math.min(1, dt * 7);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.uniform1i(u.uTex, 0);
    gl.uniform2f(u.uRes, this.canvas.width, this.canvas.height);
    var f = this.fit(); gl.uniform4f(u.uFit, f[0], f[1], f[2], f[3]);
    var cell = o.cols ? this.canvas.width / o.cols : o.cell * d;
    var rowH = o.rows ? this.canvas.height / o.rows : cell * o.row;
    gl.uniform1f(u.uCell, cell); gl.uniform1f(u.uRow, rowH);
    var fg = this._fg || (this._fg = hex(o.fg)), bg = this._bg || (this._bg = hex(o.bg));
    if (this._fgS !== o.fg) { this._fg = fg = hex(o.fg); this._fgS = o.fg; }
    if (this._bgS !== o.bg) { this._bg = bg = hex(o.bg); this._bgS = o.bg; }
    gl.uniform3f(u.uFg, fg[0], fg[1], fg[2]); gl.uniform3f(u.uBg, bg[0], bg[1], bg[2]);
    gl.uniform1f(u.uBgA, o.bgA); gl.uniform1f(u.uLo, o.lo); gl.uniform1f(u.uHi, o.hi); gl.uniform1f(u.uGamma, o.gamma);
    gl.uniform1f(u.uInv, o.invert); gl.uniform1f(u.uKey, o.key); gl.uniform1f(u.uTint, o.tint);
    gl.uniform1f(u.uMix, o.mix); gl.uniform1f(u.uReveal, o.reveal); gl.uniform1f(u.uTime, this.t);
    gl.uniform1f(u.uSway, level === 0 ? o.sway : 0);
    gl.uniform3f(u.uMouse, m[0], m[1], m[2]); gl.uniform1f(u.uLens, o.lens * d);
    gl.uniform1f(u.uMinW, o.minW); gl.uniform1f(u.uMaxW, o.maxW);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    this.dirty = false;
  };

  Loom.prototype.needsFrame = function () {
    return this.dirty || (this.o.sway && level === 0) || Math.abs(this.mouse[2] - this.mouseTarget) > 0.004;
  };

  Loom.prototype.pointer = function (e) {
    var r = this.canvas.getBoundingClientRect(), d = this.dpr || 1;
    this.mouse[0] = (e.clientX - r.left) * d; this.mouse[1] = (r.bottom - e.clientY) * d;
    this.mouseTarget = 1; this.dirty = true;
  };
  Loom.prototype.leave = function () { this.mouseTarget = 0; this.dirty = true; };

  Loom.prototype.destroy = function () {
    var gl = this.gl;
    this.ready = false; this.gl = null;
    if (gl) {
      try { var ext = gl.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext(); } catch (e) {}
    }
    if (this.lost) this.canvas.removeEventListener('webglcontextlost', this.lost);
  };

  // ——— manager ———
  var io = null;
  function liveCount() { var n = 0; for (var i = 0; i < all.length; i++) if (all[i].gl) n++; return n; }
  function prune() {
    if (liveCount() <= MAX_LIVE) return;
    for (var i = 0; i < all.length && liveCount() > MAX_LIVE; i++) {
      var l = all[i];
      if (l.gl && !l.near && !l.o.live) { l.destroy(); if (l.onSleep) l.onSleep(l); }
    }
  }
  function watch(l) {
    if (!io) {
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          var inst = en.target.__loom;
          if (!inst) return;
          inst.near = en.isIntersecting;
          if (en.isIntersecting) { inst.init(); inst.resize(); inst.dirty = true; prune(); }
        });
      }, { rootMargin: '80% 0px 80% 0px' });
    }
    l.canvas.__loom = l;
    io.observe(l.canvas);
    if (!l.vio) {
      l.vio = new IntersectionObserver(function (en) { l.visible = en[0].isIntersecting; if (l.visible) l.dirty = true; }, { rootMargin: '0px' });
      l.vio.observe(l.canvas);
    }
  }

  var slow = 0, frames = 0, warm = 0;
  function tick(time, deltaMs) {
    if (level >= 2) return;
    var dt = Math.min(deltaMs / 1000, 0.1), drew = 0;
    for (var i = 0; i < all.length; i++) {
      var l = all[i];
      if (l.gl && l.ready && (l.visible || l.o.live) && l.needsFrame()) { l.render(dt); drew++; }
    }
    if (!drew || forceGL) return;
    warm += deltaMs;
    if (warm < 2500) return;
    frames++;
    if (deltaMs > 48) slow++; else slow = Math.max(0, slow - 0.5);
    if (slow > 45) {
      slow = 0;
      level++;
      if (level >= 2) Loom.disableAll();
      document.documentElement.setAttribute('data-loom-level', level);
    }
  }

  Loom.disableAll = function () {
    level = 2;
    all.forEach(function (l) { l.destroy(); if (l.onSleep) l.onSleep(l, true); });
  };
  Loom.resizeAll = function () { all.forEach(function (l) { if (l.gl) l.resize(); }); };
  Loom.make = function (canvas, opts) {
    if (!supported) return null;
    var l = new Loom(canvas, opts);
    watch(l);
    return l;
  };
  Loom.supported = supported;
  Loom.tick = tick;
  Loom.level = function () { return level; };
  Loom.all = all;
  window.DORRLoom = Loom;
})();
