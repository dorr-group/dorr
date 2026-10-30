/* DORR v8 — strand.js
   "Pearl strand" rendering: a picture is restrung as rows of pearls on gently sagging threads. Each pearl samples
   the photograph once; its size follows the light there, it is shaded as a small sphere with a highlight and a
   faint nacre sheen, and it can carry the photograph's own colour. Uniforms let pearls string on along each thread
   (uReveal), resolve into the photograph (uMix), sway, and swell/roll aside under the cursor.
   Engine: ONE shared WebGL1 context for the whole page. The program is compiled once at start-up and every picture
   is decoded and uploaded during idle time, so a figure never compiles, uploads or switches GL contexts on its
   first visible frame. Each figure draws into its own 2D canvas (a blit from the shared buffer); figures render only
   while visible and changing, hand back to the plain <img> once resolved, and everything falls back to the <img>
   when WebGL is missing or frames run slow. */
(function () {
  'use strict';

  var VERT = 'attribute vec2 aPos;varying vec2 vUv;void main(){vUv=aPos*0.5+0.5;gl_Position=vec4(aPos,0.0,1.0);}';
  var FRAG = [
    'precision mediump float;',
    'varying vec2 vUv;',
    'uniform sampler2D uTex;uniform vec2 uRes;uniform vec4 uFit;',
    'uniform float uCell;uniform float uSag;uniform float uLine;',
    'uniform vec3 uGround;uniform float uGroundA;uniform vec3 uThread;uniform float uThreadA;uniform vec3 uPearl;',
    'uniform float uTint;uniform float uLo;uniform float uHi;uniform float uGamma;uniform float uMinR;uniform float uMaxR;',
    'uniform float uMix;uniform float uReveal;uniform float uTime;uniform float uSway;uniform vec3 uMouse;uniform float uLens;',
    'float h1(float n){return fract(sin(n*91.7+3.1)*43758.5453);}',
    'vec2 tUv(vec2 uv){return uv*uFit.xy+uFit.zw;}',
    'void main(){',
    '  vec2 px=vUv*uRes;',
    '  float xn=px.x/uRes.x;',
    '  float u=2.0*xn-1.0;',
    '  float sag=uSag*uCell*(1.0-u*u);',
    '  float y=px.y+sag;',
    '  float row=floor(y/uCell);',
    '  float rr=h1(row);',
    '  float sway=sin(uTime*0.6+row*0.45)*uSway*uCell;',
    '  float off=mod(row,2.0)*0.5*uCell;',
    '  float x=px.x+sway+off;',
    '  float col=floor(x/uCell);',
    '  vec2 c=vec2((col+0.5)*uCell-sway-off,(row+0.5)*uCell-sag);',
    '  vec2 lp=vec2(x-(col+0.5)*uCell,y-(row+0.5)*uCell);',
    '  vec2 tu=tUv(clamp(c/uRes,0.0,1.0));',
    '  vec3 tx=texture2D(uTex,tu).rgb;',
    '  float l=dot(tx,vec3(0.299,0.587,0.114));',
    '  l=pow(clamp((l-uLo)/max(uHi-uLo,0.001),0.0,1.0),uGamma);',
    '  float dm=length(c-uMouse.xy);',
    '  float lens=uMouse.z*(1.0-smoothstep(0.0,uLens,dm));',
    '  vec2 dir=dm>0.5?(c-uMouse.xy)/dm:vec2(0.0);',
    '  lp-=dir*lens*0.32*uCell;',
    '  float thr=uReveal*1.45-rr*0.45;',
    '  float grow=clamp((thr-xn)*14.0,0.0,1.0);',
    '  float r=mix(uMinR,uMaxR,l)*0.5*uCell*grow*(1.0+0.5*lens);',
    '  float d=length(lp)/max(r,0.0001);',
    '  float aa=1.4/max(r,1.0);',
    '  float bead=(1.0-smoothstep(1.0-aa,1.0,d))*step(0.001,r);',
    '  vec2 n2=lp/max(r,0.0001);',
    '  vec3 n=vec3(n2,sqrt(max(0.0,1.0-dot(n2,n2))));',
    '  vec3 L=normalize(vec3(-0.45,0.55,0.75));',
    '  float diff=0.5+0.5*max(dot(n,L),0.0);',
    '  float spec=pow(max(dot(reflect(-L,n),vec3(0.0,0.0,1.0)),0.0),26.0);',
    '  vec3 base=mix(uPearl,min(tx*1.08+0.04,vec3(1.0)),uTint);',
    '  vec3 sheen=0.5+0.5*cos(6.2831*(d*0.85+rr*0.3+vec3(0.0,0.33,0.67)));',
    '  vec3 pc=base*diff+spec*0.65+sheen*0.045;',
    '  pc*=mix(1.0,0.78,smoothstep(0.72,1.0,d));',
    '  float line=(1.0-smoothstep(uLine*0.5,uLine*0.5+1.0,abs(lp.y)))*step(xn,thr)*uThreadA;',
    '  vec3 colr=uGround*uGroundA;float al=uGroundA;',
    '  colr=mix(colr,uThread,line);al=max(al,line);',
    '  colr=mix(colr,pc,bead);al=max(al,bead);',
    '  vec3 ph=texture2D(uTex,tUv(vUv)).rgb;',
    '  float m=clamp(uMix*1.6-rr*0.6,0.0,1.0)*(1.0-lens);',
    '  gl_FragColor=mix(vec4(colr,al),vec4(ph,1.0),m);',
    '}'
  ].join('\n');

  function hex(c) {
    c = (c || '#000').replace('#', '');
    return [parseInt(c.slice(0, 2), 16) / 255, parseInt(c.slice(2, 4), 16) / 255, parseInt(c.slice(4, 6), 16) / 255];
  }
  function abs(src) { var a = document.createElement('a'); a.href = src; return a.href; }
  var isPhone = window.matchMedia('(max-width: 700px)').matches;
  var DPR_CAP = isPhone ? 1.5 : 1.75, BIG_CAP = isPhone ? 1 : 1.25, MAX_TEX = isPhone ? 720 : 1024;
  var level = 0, forceGL = /[?&]gl=force/.test(location.search), all = [];

  // ——— shared GL ———
  var G = null;
  function shared() {
    if (G) return G.gl ? G : null;
    G = { gl: null, texs: {}, pending: {} };
    try {
      var cv = document.createElement('canvas'); cv.width = 2; cv.height = 2;
      var gl = cv.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false, powerPreference: 'default' });
      if (!gl) return null;
      var sh = function (t, s) { var x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); return x; };
      var p = gl.createProgram();
      gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return null;
      gl.useProgram(p);
      var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
      var loc = gl.getAttribLocation(p, 'aPos'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      var u = {};
      ['uTex', 'uRes', 'uFit', 'uCell', 'uSag', 'uLine', 'uGround', 'uGroundA', 'uThread', 'uThreadA', 'uPearl', 'uTint', 'uLo', 'uHi', 'uGamma', 'uMinR', 'uMaxR', 'uMix', 'uReveal', 'uTime', 'uSway', 'uMouse', 'uLens']
        .forEach(function (n) { u[n] = gl.getUniformLocation(p, n); });
      gl.uniform1i(u.uTex, 0);
      cv.addEventListener('webglcontextlost', function (e) { e.preventDefault(); Strand.disableAll(); }, false);
      G.gl = gl; G.cv = cv; G.u = u;
      // compile + first draw now, off-screen, so the driver has everything ready
      gl.viewport(0, 0, 2, 2); gl.drawArrays(gl.TRIANGLES, 0, 6); gl.flush();
      return G;
    } catch (e) { return null; }
  }
  // decode a reduced bitmap off the main thread and upload it once; keyed by absolute URL
  function texture(img, cb) {
    var g = shared(); if (!g) return;
    var key = abs(img.currentSrc || img.src);
    if (g.texs[key]) { cb(g.texs[key]); return; }
    if (g.pending[key]) { g.pending[key].push(cb); return; }
    g.pending[key] = [cb];
    var put = function (src, flip, w, h) {
      var gl = g.gl; if (!gl) return;
      var tex = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flip);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); } catch (e) { return; }
      if (src.close) src.close();
      // touch the texture once so the upload is finished before anyone needs it
      gl.viewport(0, 0, 2, 2); gl.drawArrays(gl.TRIANGLES, 0, 6); gl.flush();
      var t = g.texs[key] = { tex: tex, w: w, h: h };
      var cbs = g.pending[key]; delete g.pending[key];
      cbs.forEach(function (f) { f(t); });
    };
    var go = function () {
      var nw = img.naturalWidth, nh = img.naturalHeight, k = Math.min(1, MAX_TEX / Math.max(nw, nh));
      if (window.createImageBitmap) {
        createImageBitmap(img, { resizeWidth: Math.round(nw * k), resizeHeight: Math.round(nh * k), resizeQuality: 'medium', imageOrientation: 'flipY' })
          .then(function (bm) { put(bm, false, nw, nh); }, function () { put(img, true, nw, nh); });
      } else put(img, true, nw, nh);
    };
    if (img.complete && img.naturalWidth) go();
    else { img.loading = 'eager'; img.addEventListener('load', go, { once: true }); }
  }
  function loadSrc(src, cb) {
    var im = new Image(); im.decoding = 'async';
    im.onload = function () { texture(im, cb); };
    im.onerror = function () { cb(null); };
    im.src = src;
  }

  function Strand(canvas, opts) {
    this.canvas = canvas;
    this.o = Object.assign({
      cell: 14, sag: 0.9, line: 1, ground: '#141a1b', groundA: 1, thread: '#8f8676', threadA: .55, pearl: '#efe8dc',
      tint: .85, lo: .02, hi: .98, gamma: 1, minR: .18, maxR: 1, mix: 0, reveal: 1, sway: .06, zoom: 1, fx: .5, fy: .5,
      lens: 140, dprCap: DPR_CAP
    }, opts || {});
    this.host = this.o.host || canvas.parentElement;
    this.img = this.o.img || this.host.querySelector('img');
    this.ctx = null; this.visible = false; this.dirty = true; this.ready = false; this.t = 0;
    this.mouse = [0, 0, 0]; this.mTarget = 0;
    all.push(this);
  }
  Strand.prototype.set = function (p) {
    for (var k in p) { if (this.o[k] !== p[k]) { this.o[k] = p[k]; this.dirty = true; } }
    return this;
  };
  Strand.prototype.init = function () {
    if (this.ctx || level >= 2 || !shared()) return;
    var self = this;
    this.ctx = this.canvas.getContext('2d');
    if (!this.ctx) return;
    texture(this.img, function (t) {
      if (level >= 2) return;
      self.use(t); self.ready = true; self.resize(); self.render(0);
      if (self.o.onReady) self.o.onReady(self);
      if (self.o.preload) { var list = self.o.preload.slice(); (function next() { var s = list.shift(); if (s) idle(function () { loadSrc(s, function () { next(); }); }); })(); }
    });
  };
  Strand.prototype.use = function (t) { this.tx = t; this.dirty = true; };
  Strand.prototype.swap = function (src) { var g = shared(); var t = g && g.texs[abs(src)]; if (!t) return false; this.use(t); return true; };
  Strand.prototype.upload = function (img) { var self = this; texture(img, function (t) { self.use(t); }); };
  Strand.prototype.resize = function () {
    if (!this.ctx) return;
    var r = this.canvas.getBoundingClientRect();
    var d = Math.min(window.devicePixelRatio || 1, this.o.dprCap);
    var w = Math.max(2, Math.round(r.width * d)), h = Math.max(2, Math.round(r.height * d));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    this.dpr = d; this.dirty = true;
  };
  Strand.prototype.fit = function () {
    var o = this.o, ca = this.canvas.width / this.canvas.height, ia = this.tx.w / this.tx.h, sx, sy;
    if (ca > ia) { sx = 1; sy = ia / ca; } else { sx = ca / ia; sy = 1; }
    sx /= o.zoom; sy /= o.zoom;
    return [sx, sy, o.fx * (1 - sx), (1 - o.fy) * (1 - sy)];
  };
  Strand.prototype.render = function (dt) {
    var g = shared();
    if (!g || !this.ready || !this.ctx || !this.tx) return;
    var gl = g.gl, u = g.u, o = this.o, d = this.dpr || 1, m = this.mouse;
    var W = this.canvas.width, H = this.canvas.height;
    if (o.sway && level === 0) this.t += dt;
    m[2] += (this.mTarget - m[2]) * Math.min(1, dt * 7);
    if (Math.abs(this.mTarget - m[2]) < 0.004) m[2] = this.mTarget;
    if (g.cv.width < W || g.cv.height < H) { g.cv.width = Math.max(g.cv.width, W); g.cv.height = Math.max(g.cv.height, H); }
    var BH = g.cv.height;
    var sx0 = 0, sy0 = 0, sw = W, shh = H;
    gl.disable(gl.SCISSOR_TEST);
    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    if (o.clipEl) {
      // only shade (and copy) the part of the canvas the round window shows
      var cr = this.canvas.getBoundingClientRect(), pr = o.clipEl.getBoundingClientRect();
      var kx = W / cr.width, ky = H / cr.height;
      var x0 = Math.max(0, Math.floor((pr.left - cr.left) * kx)), x1 = Math.min(W, Math.ceil((pr.right - cr.left) * kx));
      var yt = Math.max(0, Math.floor((pr.top - cr.top) * ky)), yb = Math.min(H, Math.ceil((pr.bottom - cr.top) * ky));
      if (x1 <= x0 || yb <= yt) return;
      gl.enable(gl.SCISSOR_TEST); gl.scissor(x0, H - yb, x1 - x0, yb - yt);
      sx0 = x0; sy0 = yt; sw = x1 - x0; shh = yb - yt;
    }
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tx.tex);
    gl.uniform2f(u.uRes, W, H);
    var f = this.fit(); gl.uniform4f(u.uFit, f[0], f[1], f[2], f[3]);
    gl.uniform1f(u.uCell, o.cell * d); gl.uniform1f(u.uSag, o.sag); gl.uniform1f(u.uLine, o.line * d);
    if (this._g !== o.ground) { this._g = o.ground; this._gv = hex(o.ground); }
    if (this._t !== o.thread) { this._t = o.thread; this._tv = hex(o.thread); }
    if (this._p !== o.pearl) { this._p = o.pearl; this._pv = hex(o.pearl); }
    gl.uniform3fv(u.uGround, this._gv); gl.uniform1f(u.uGroundA, o.groundA);
    gl.uniform3fv(u.uThread, this._tv); gl.uniform1f(u.uThreadA, o.threadA); gl.uniform3fv(u.uPearl, this._pv);
    gl.uniform1f(u.uTint, o.tint); gl.uniform1f(u.uLo, o.lo); gl.uniform1f(u.uHi, o.hi); gl.uniform1f(u.uGamma, o.gamma);
    gl.uniform1f(u.uMinR, o.minR); gl.uniform1f(u.uMaxR, o.maxR);
    gl.uniform1f(u.uMix, o.mix); gl.uniform1f(u.uReveal, o.reveal); gl.uniform1f(u.uTime, this.t);
    gl.uniform1f(u.uSway, level === 0 ? o.sway : 0);
    gl.uniform3f(u.uMouse, m[0], m[1], m[2]); gl.uniform1f(u.uLens, o.lens * d);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    // blit the drawn region (bottom-left of the shared buffer) into this figure's canvas
    this.ctx.clearRect(sx0, sy0, sw, shh);
    this.ctx.drawImage(g.cv, sx0, BH - H + sy0, sw, shh, sx0, sy0, sw, shh);
    this.dirty = false;
  };
  Strand.prototype.needsFrame = function () {
    var beads = this.o.mix < 0.999 || this.mouse[2] > 0.001 || this.mTarget > 0;
    return this.dirty || (beads && this.o.sway && level === 0) || this.mouse[2] !== this.mTarget;
  };
  Strand.prototype.pointer = function (e) {
    var r = this.canvas.getBoundingClientRect(), d = this.dpr || 1;
    this.mouse[0] = (e.clientX - r.left) * d; this.mouse[1] = (r.bottom - e.clientY) * d;
    this.mTarget = 1; this.dirty = true;
  };
  Strand.prototype.leave = function () { this.mTarget = 0; this.dirty = true; };
  Strand.prototype.destroy = function () { this.ready = false; };

  var idle = function (f) { return (window.requestIdleCallback || function (x) { return setTimeout(x, 120); })(f, { timeout: 1500 }); };
  function watch(l) {
    new IntersectionObserver(function (es) {
      var e = es[0];
      if (e.isIntersecting) { l.init(); l.resize(); }
    }, { rootMargin: '120% 0px 120% 0px' }).observe(l.canvas);
    new IntersectionObserver(function (es) { l.visible = es[0].isIntersecting; if (l.visible) l.dirty = true; }).observe(l.canvas);
  }

  var slow = 0, warm = 0;
  function tick(time, deltaMs) {
    if (level >= 2) return;
    var dt = Math.min(deltaMs / 1000, 0.1), drew = 0;
    for (var i = 0; i < all.length; i++) {
      var l = all[i];
      if (!l.ready || !l.visible) continue;
      var still = l.o.mix >= 0.999 && l.mouse[2] === 0 && l.mTarget === 0;
      if (still !== !!l.photo) { l.photo = still; l.host.classList.toggle('is-photo', still); if (!still) l.dirty = true; }
      if (still) continue;
      if (l.needsFrame()) { l.render(dt); drew++; }
    }
    if (!drew || forceGL) return;
    warm += deltaMs; if (warm < 2500) return;
    if (deltaMs > 48) slow++; else slow = Math.max(0, slow - .5);
    if (slow > 45) {
      slow = 0; level++;
      document.documentElement.setAttribute('data-strand-level', level);
      if (level >= 2) Strand.disableAll();
    }
  }
  Strand.disableAll = function () { level = 2; all.forEach(function (l) { l.ready = false; if (l.o.onSleep) l.o.onSleep(l); }); };
  Strand.resizeAll = function () { all.forEach(function (l) { if (l.ctx) l.resize(); }); };
  // set everything up during idle time: shared program, every figure's texture, the viewer's other pictures
  Strand.prewarm = function () {
    var list = all.slice();
    (function next() { var l = list.shift(); if (!l) return; if (level < 2) l.init(); idle(next); })();
  };
  Strand.make = function (canvas, opts) { if (!supported) return null; var l = new Strand(canvas, opts); watch(l); return l; };
  var supported = (function () { try { var c = document.createElement('canvas'); return !!c.getContext('webgl'); } catch (e) { return false; } })();
  Strand.supported = supported;
  Strand.tick = tick;
  Strand.BIG_CAP = BIG_CAP;
  window.DORRStrand = Strand;
})();
