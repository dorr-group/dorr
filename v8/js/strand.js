/* DORR v8 — strand.js
   "Pearl strand" rendering: a picture is restrung as rows of pearls on gently sagging threads. Each pearl samples
   the photograph once; its size follows the light there, it is shaded as a small sphere with a highlight and a
   faint nacre sheen, and it can carry the photograph's own colour. Uniforms let pearls string on along each thread
   (uReveal), resolve into the photograph (uMix), sway, and swell/roll aside under the cursor.
   One small WebGL1 context per figure: created near the viewport, idle when nothing changes, paused off-screen,
   released when far, and dropped (static <img>) when frames run slow. */
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
  var isPhone = window.matchMedia('(max-width: 700px)').matches;
  var DPR_CAP = isPhone ? 1.5 : 1.75, BIG_CAP = isPhone ? 1 : 1.25;
  var MAX_LIVE = isPhone ? 4 : 6;
  var supported = (function () {
    try {
      var c = document.createElement('canvas');
      var g = c.getContext('webgl');
      if (g && g.getExtension('WEBGL_lose_context')) g.getExtension('WEBGL_lose_context').loseContext();
      return !!g;
    } catch (e) { return false; }
  })();
  var all = [], level = 0, forceGL = /[?&]gl=force/.test(location.search);

  function Strand(canvas, opts) {
    this.canvas = canvas;
    this.o = Object.assign({
      cell: 14, sag: 0.9, line: 1, ground: '#141a1b', groundA: 1, thread: '#8f8676', threadA: .55, pearl: '#efe8dc',
      tint: .85, lo: .02, hi: .98, gamma: 1, minR: .18, maxR: 1, mix: 0, reveal: 1, sway: .06, zoom: 1, fx: .5, fy: .5,
      lens: 140, dprCap: DPR_CAP, live: false, maxTex: isPhone ? 720 : 1024
    }, opts || {});
    this.host = this.o.host || canvas.parentElement;
    this.img = this.o.img || this.host.querySelector('img');
    this.gl = null; this.visible = false; this.near = false; this.dirty = true; this.ready = false;
    this.mouse = [0, 0, 0]; this.mTarget = 0; this.t = 0;
    all.push(this);
  }
  Strand.prototype.set = function (p) {
    for (var k in p) { if (this.o[k] !== p[k]) { this.o[k] = p[k]; this.dirty = true; } }
    return this;
  };
  Strand.prototype.init = function () {
    if (this.gl || level >= 2 || !supported) return;
    var self = this, cv = this.canvas;
    var gl = cv.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
    if (!gl) return;
    function sh(t, s) { var x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); return x; }
    var p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return;
    gl.useProgram(p);
    var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(p, 'aPos'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.u = {};
    ['uTex', 'uRes', 'uFit', 'uCell', 'uSag', 'uLine', 'uGround', 'uGroundA', 'uThread', 'uThreadA', 'uPearl', 'uTint', 'uLo', 'uHi', 'uGamma', 'uMinR', 'uMaxR', 'uMix', 'uReveal', 'uTime', 'uSway', 'uMouse', 'uLens']
      .forEach(function (n) { self.u[n] = gl.getUniformLocation(p, n); });
    this.gl = gl;
    this.texs = {};
    this.lost = function (e) { e.preventDefault(); self.gl = null; self.ready = false; };
    cv.addEventListener('webglcontextlost', this.lost, false);
    this.upload(this.img);
  };
  // decode a reduced bitmap off the main thread (pearls only need a modest texture; the resolved state hands back
  // to the <img>) and keep one texture per picture, so later swaps are a bind, not an upload
  Strand.prototype.texture = function (img, cb) {
    var self = this, key = img.currentSrc || img.src;
    if (this.texs[key]) { cb(this.texs[key]); return; }
    var put = function (src, flip, w, h) {
      var gl = self.gl;
      if (!gl) return;
      var tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flip);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); } catch (e) { return; }
      if (src.close) src.close();
      self.texs[key] = { tex: tex, w: w, h: h };
      cb(self.texs[key]);
    };
    var go = function () {
      var nw = img.naturalWidth, nh = img.naturalHeight, k = Math.min(1, self.o.maxTex / Math.max(nw, nh));
      if (window.createImageBitmap) {
        createImageBitmap(img, { resizeWidth: Math.round(nw * k), resizeHeight: Math.round(nh * k), resizeQuality: 'medium', imageOrientation: 'flipY' })
          .then(function (bm) { put(bm, false, nw, nh); }, function () { put(img, true, nw, nh); });
      } else put(img, true, nw, nh);
    };
    if (img.complete && img.naturalWidth) go();
    else { img.loading = 'eager'; img.addEventListener('load', go, { once: true }); }
  };
  Strand.prototype.use = function (t) { this.tex = t.tex; this.iw = t.w; this.ih = t.h; this.dirty = true; };
  Strand.prototype.has = function (src) { var a = document.createElement('a'); a.href = src; return !!(this.texs && this.texs[a.href]); };
  Strand.prototype.swap = function (src) {
    var a = document.createElement('a'); a.href = src;
    var t = this.texs && this.texs[a.href]; if (!t) return false; this.use(t); return true;
  };
  Strand.prototype.upload = function (img) {
    var self = this;
    this.img = img;
    if (!this.gl) return;
    this.texture(img, function (t) {
      self.use(t); self.ready = true; self.resize();
      // warm-up: shade one full frame while still hidden, then the real state
      var o = self.o, r = o.reveal, m = o.mix; o.reveal = 1; o.mix = 0; self.render(0); o.reveal = r; o.mix = m; self.render(0);
      if (self.gl) self.gl.flush();
      if (self.o.onReady) self.o.onReady(self);
      if (self.o.preload && !self.preloaded) { self.preloaded = true; self.preload(self.o.preload); }
    });
  };
  // decode + upload further pictures during idle time (used by the brand viewer)
  Strand.prototype.preload = function (srcs) {
    var self = this, list = srcs.slice();
    var idle = window.requestIdleCallback || function (f) { return setTimeout(f, 120); };
    (function next() {
      var src = list.shift(); if (!src || !self.gl) return;
      var im = new Image(); im.decoding = 'async';
      im.onload = function () { self.texture(im, function () { idle(next, { timeout: 1200 }); }); };
      im.onerror = function () { idle(next, { timeout: 1200 }); };
      im.src = src;
    })();
  };
  Strand.prototype.resize = function () {
    if (!this.gl) return;
    var r = this.canvas.getBoundingClientRect();
    var d = Math.min(window.devicePixelRatio || 1, this.o.dprCap);
    var w = Math.max(2, Math.round(r.width * d)), h = Math.max(2, Math.round(r.height * d));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    this.dpr = d; this.dirty = true;
  };
  Strand.prototype.fit = function () {
    var o = this.o, ca = this.canvas.width / this.canvas.height, ia = this.iw / this.ih, sx, sy;
    if (ca > ia) { sx = 1; sy = ia / ca; } else { sx = ca / ia; sy = 1; }
    sx /= o.zoom; sy /= o.zoom;
    return [sx, sy, o.fx * (1 - sx), (1 - o.fy) * (1 - sy)];
  };
  Strand.prototype.render = function (dt) {
    var gl = this.gl;
    if (!gl || !this.ready) return;
    var o = this.o, u = this.u, d = this.dpr || 1, m = this.mouse;
    if (o.sway && level === 0) this.t += dt;
    m[2] += (this.mTarget - m[2]) * Math.min(1, dt * 7);
    if (Math.abs(this.mTarget - m[2]) < 0.004) m[2] = this.mTarget;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.disable(gl.SCISSOR_TEST);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    if (o.clipEl) {
      // only shade the part of the canvas that the round window actually shows
      var cr = this.canvas.getBoundingClientRect(), pr = o.clipEl.getBoundingClientRect();
      var sx = this.canvas.width / cr.width, sy = this.canvas.height / cr.height;
      var x0 = Math.max(0, Math.floor((pr.left - cr.left) * sx)), x1 = Math.min(this.canvas.width, Math.ceil((pr.right - cr.left) * sx));
      var y0 = Math.max(0, Math.floor((cr.bottom - pr.bottom) * sy)), y1 = Math.min(this.canvas.height, Math.ceil((cr.bottom - pr.top) * sy));
      if (x1 <= x0 || y1 <= y0) return;
      gl.enable(gl.SCISSOR_TEST); gl.scissor(x0, y0, x1 - x0, y1 - y0);
    }
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex); gl.uniform1i(u.uTex, 0);
    gl.uniform2f(u.uRes, this.canvas.width, this.canvas.height);
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
    this.dirty = false;
  };
  Strand.prototype.needsFrame = function () {
    var beadsShow = this.o.mix < 0.999 || this.mouse[2] > 0.001 || this.mTarget > 0;
    return this.dirty || (beadsShow && this.o.sway && level === 0) || this.mouse[2] !== this.mTarget;
  };
  Strand.prototype.pointer = function (e) {
    var r = this.canvas.getBoundingClientRect(), d = this.dpr || 1;
    this.mouse[0] = (e.clientX - r.left) * d; this.mouse[1] = (r.bottom - e.clientY) * d;
    this.mTarget = 1; this.dirty = true;
  };
  Strand.prototype.leave = function () { this.mTarget = 0; this.dirty = true; };
  Strand.prototype.destroy = function () {
    var gl = this.gl; this.ready = false; this.gl = null; this.texs = {}; this.preloaded = false;
    if (gl) { try { var x = gl.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); } catch (e) {} }
    if (this.lost) this.canvas.removeEventListener('webglcontextlost', this.lost);
  };

  var io = null;
  function live() { var n = 0; all.forEach(function (l) { if (l.gl) n++; }); return n; }
  function prune() {
    for (var i = 0; i < all.length && live() > MAX_LIVE; i++) {
      var l = all[i]; if (l.gl && !l.near && !l.o.live) { l.destroy(); if (l.o.onSleep) l.o.onSleep(l); }
    }
  }
  function watch(l) {
    if (!io) io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var s = e.target.__strand; if (!s) return;
        s.near = e.isIntersecting;
        if (e.isIntersecting) { s.init(); s.resize(); prune(); }
      });
    }, { rootMargin: '70% 0px 70% 0px' });
    l.canvas.__strand = l; io.observe(l.canvas);
    new IntersectionObserver(function (es) { l.visible = es[0].isIntersecting; if (l.visible) l.dirty = true; }).observe(l.canvas);
  }

  var slow = 0, warm = 0;
  function tick(time, deltaMs) {
    if (level >= 2) return;
    var dt = Math.min(deltaMs / 1000, 0.1), drew = 0;
    for (var i = 0; i < all.length; i++) {
      var l = all[i];
      if (!l.gl || !l.ready || !(l.visible || l.o.live)) continue;
      // fully resolved and untouched: let the plain <img> show and keep the GPU idle
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
  Strand.disableAll = function () { level = 2; all.forEach(function (l) { l.destroy(); if (l.o.onSleep) l.o.onSleep(l); }); };
  Strand.prewarm = function () {
    var list = all.slice();
    (function next() {
      var l = list.shift(); if (!l) return;
      if (!l.gl && level < 2) l.init();
      (window.requestIdleCallback || function (f) { setTimeout(f, 200); })(next, { timeout: 1500 });
    })();
  };
  Strand.resizeAll = function () { all.forEach(function (l) { if (l.gl) l.resize(); }); };
  Strand.make = function (canvas, opts) { if (!supported) return null; var l = new Strand(canvas, opts); watch(l); return l; };
  Strand.supported = supported;
  Strand.tick = tick;
  Strand.BIG_CAP = BIG_CAP;
  window.DORRStrand = Strand;
})();
