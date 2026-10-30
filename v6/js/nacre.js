/* DORR v6 — Nacre: draws a photograph as concentric nacre growth rings.
   Line weight follows the light of the photo; the real image surfaces from the
   centre like a pearl opening (uReveal). Raw WebGL1, one quad, one texture.
   Falls back silently (the <img> underneath stays visible) when WebGL is missing. */
(function () {
  'use strict';

  var VERT = [
    'attribute vec2 aPos;',
    'varying vec2 vUv;',
    'void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }'
  ].join('\n');

  var FRAG = [
    'precision highp float;',
    'uniform sampler2D uTex;',
    'uniform vec2 uRes;',       // canvas size in device px
    'uniform vec2 uImg;',       // image size
    'uniform vec2 uOff;',       // cover offset (device px, GL coords)
    'uniform vec2 uCenter;',    // ring centre, 0..1 from top-left
    'uniform float uTime;',
    'uniform float uSpacing;',  // ring spacing in device px
    'uniform float uIntro;',    // 0..1 rings drawn outward from centre
    'uniform float uReveal;',   // 0..1 photo radius (fraction of diagonal)
    'uniform float uDpr;',
    'varying vec2 vUv;',
    'const vec3 UMBER = vec3(0.122, 0.102, 0.086);',
    'const vec3 SAND  = vec3(0.722, 0.635, 0.498);',
    'const vec3 PEARL = vec3(0.945, 0.914, 0.855);',
    'void main(){',
    '  vec2 px = vUv * uRes;',
    '  float s = max(uRes.x / uImg.x, uRes.y / uImg.y);',
    '  vec2 uv = (px - uOff) / (uImg * s);',
    '  vec3 col = texture2D(uTex, uv).rgb;',
    '  float lum = dot(col, vec3(0.299, 0.587, 0.114));',
    '  vec2 c = vec2(uCenter.x, 1.0 - uCenter.y) * uRes;',
    '  float dist = length(px - c);',
    '  float d = dist / uSpacing - uTime;',
    '  float f = abs(fract(d) - 0.5) * 2.0;',
    '  float w = clamp(pow(lum, 0.9) * 1.1 + 0.03, 0.035, 0.86);',
    '  float aa = 2.2 / uSpacing;',
    '  float line = 1.0 - smoothstep(w - aa, w + aa, f);',
    '  vec3 ringCol = mix(SAND, PEARL, smoothstep(0.7, 1.0, lum) * 0.8);',
    '  vec3 rings = mix(UMBER, ringCol, line * 0.96);',
    '  float diag = length(uRes);',
    '  float ri = uIntro * diag;',
    '  float introMask = 1.0 - smoothstep(ri - 90.0 * uDpr, ri, dist);',
    '  rings = mix(UMBER, rings, introMask);',
    '  float rr = uReveal * diag;',
    '  float soft = 140.0 * uDpr;',
    '  float photo = 1.0 - smoothstep(rr - soft, rr, dist);',
    '  float halo = smoothstep(rr - soft * 1.6, rr - soft * 0.5, dist) * photo;',
    '  vec3 outc = mix(rings, col, photo);',
    '  outc += PEARL * halo * 0.08;',
    '  gl_FragColor = vec4(outc, 1.0);',
    '}'
  ].join('\n');

  function compile(gl, type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { gl.deleteShader(sh); return null; }
    return sh;
  }

  function Nacre(canvas, img, opts) {
    opts = opts || {};
    this.canvas = canvas;
    this.img = img;
    this.ok = false;
    this.visible = true;
    this.running = false;
    this.state = {
      intro: opts.intro != null ? opts.intro : 0,
      reveal: opts.reveal != null ? opts.reveal : 0,
      scroll: 0,
      cx: opts.cx != null ? opts.cx : 0.5,
      cy: opts.cy != null ? opts.cy : 0.5
    };
    this.target = { cx: this.state.cx, cy: this.state.cy };
    this.base = { cx: this.state.cx, cy: this.state.cy };
    this.focal = opts.focal || null;           // {x,y} point of interest in image (0..1)
    this.spacing = opts.spacing || 7;
    this.speed = opts.speed != null ? opts.speed : 0.22;
    this.still = !!opts.still;
    this.time = 0;
    this.last = 0;
    var mobile = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 760;
    this.dprCap = mobile ? 1.5 : 1.75;

    var gl = null;
    try {
      gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    } catch (e) { gl = null; }
    if (!gl) return;
    var vs = compile(gl, gl.VERTEX_SHADER, VERT);
    var fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;
    var prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    this.u = {};
    var names = ['uTex', 'uRes', 'uImg', 'uOff', 'uCenter', 'uTime', 'uSpacing', 'uIntro', 'uReveal', 'uDpr'];
    for (var i = 0; i < names.length; i++) this.u[names[i]] = gl.getUniformLocation(prog, names[i]);
    this.gl = gl;

    var self = this;
    canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); self.ok = false; self.stop(); canvas.classList.remove('is-on'); }, false);

    var ready = img.complete && img.naturalWidth ? Promise.resolve() : (img.decode ? img.decode() : new Promise(function (r) { img.onload = r; }));
    this.ready = ready.then(function () { return self._upload(); }).catch(function () {});
  }

  Nacre.prototype._upload = function () {
    var gl = this.gl;
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, this.img);
    gl.uniform1i(this.u.uTex, 0);
    gl.uniform2f(this.u.uImg, this.img.naturalWidth, this.img.naturalHeight);
    this.ok = true;
    this.resize();
    var self = this;
    if ('ResizeObserver' in window) {
      this.ro = new ResizeObserver(function () { self.resize(); self.draw(); });
      this.ro.observe(this.canvas);
    }
    if ('IntersectionObserver' in window) {
      this.io = new IntersectionObserver(function (en) {
        self.visible = en[0].isIntersecting;
        if (self.visible) self.start(); else self.stop();
      }, { rootMargin: '80px' });
      this.io.observe(this.canvas);
    }
    document.addEventListener('visibilitychange', function () { if (document.hidden) self.stop(); else if (self.visible) self.start(); });
    this.draw();
    this.canvas.classList.add('is-on');
    this.start();
  };

  Nacre.prototype.resize = function () {
    if (!this.ok) return;
    var dpr = Math.min(window.devicePixelRatio || 1, this.dprCap);
    var w = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
    var h = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w; this.canvas.height = h;
    }
    this.dpr = dpr;
    this.gl.viewport(0, 0, w, h);
    // object-fit: cover with a focal point kept on screen (mirrored on the <img>)
    var iw = this.img.naturalWidth, ih = this.img.naturalHeight;
    var W = this.canvas.clientWidth, H = this.canvas.clientHeight;
    var s = Math.max(W / iw, H / ih), sw = iw * s, sh = ih * s;
    var f = this.focal || { x: 0.5, y: 0.5 };
    var px = sw > W + 1 ? Math.min(1, Math.max(0, (f.x * sw - W * (W < 760 ? 0.58 : 0.62)) / (sw - W))) : 0.5;
    var py = sh > H + 1 ? Math.min(1, Math.max(0, (f.y * sh - H * 0.42) / (sh - H))) : 0.5;
    this.img.style.objectPosition = (px * 100).toFixed(2) + '% ' + (py * 100).toFixed(2) + '%';
    this.offX = (W - sw) * px; this.offY = (H - sh) * py;   // css px, top-left
    this.gl.uniform2f(this.u.uOff, this.offX * dpr, (H - sh - this.offY) * dpr);
    if (this.focal) {
      this.base.cx = (this.offX + f.x * sw) / W;
      this.base.cy = (this.offY + f.y * sh) / H;
      if (!this._centred) { this.state.cx = this.target.cx = this.base.cx; this.state.cy = this.target.cy = this.base.cy; this._centred = true; }
      else { this.target.cx = this.base.cx; this.target.cy = this.base.cy; }
    }
  };

  Nacre.prototype.pointer = function (nx, ny) {
    this.target.cx = this.base.cx + (nx - 0.5) * 0.09;
    this.target.cy = this.base.cy + (ny - 0.5) * 0.07;
  };

  Nacre.prototype.draw = function () {
    if (!this.ok) return;
    var gl = this.gl, u = this.u, st = this.state;
    gl.uniform2f(u.uRes, this.canvas.width, this.canvas.height);
    gl.uniform2f(u.uCenter, st.cx, st.cy);
    gl.uniform1f(u.uTime, this.time);
    gl.uniform1f(u.uSpacing, this.spacing * this.dpr);
    gl.uniform1f(u.uIntro, st.intro);
    gl.uniform1f(u.uReveal, Math.max(st.reveal, st.scroll || 0));
    gl.uniform1f(u.uDpr, this.dpr);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };

  Nacre.prototype._tick = function () {
    var now = performance.now();
    var dt = Math.min(0.05, (now - (this.last || now)) / 1000);
    this.last = now;
    if (!this.still) this.time += dt * this.speed;
    var st = this.state, k = 1 - Math.pow(0.0025, dt);
    st.cx += (this.target.cx - st.cx) * k;
    st.cy += (this.target.cy - st.cy) * k;
    // redraw at full rate only while something visible changes (scroll, intro, pointer);
    // the slow outward drift of the rings alone is drawn at ~30 fps
    var sig = st.intro.toFixed(4) + st.reveal.toFixed(4) + (st.scroll || 0).toFixed(4) + st.cx.toFixed(4) + st.cy.toFixed(4) + this.canvas.width;
    if (sig === this._sig && now - (this._drawn || 0) < 33) return;
    this._sig = sig;
    this._drawn = now;
    this.draw();
  };

  Nacre.prototype.start = function () {
    if (!this.ok || this.running || !this.visible) return;
    if (this.still) { this.draw(); return; }
    this.running = true;
    this.last = performance.now();
    var self = this;
    this._fn = this._fn || function () { self._tick(); };
    if (window.gsap) gsap.ticker.add(this._fn);
    else {
      var loop = function () { if (!self.running) return; self._fn(); self._raf = requestAnimationFrame(loop); };
      this._raf = requestAnimationFrame(loop);
    }
  };

  Nacre.prototype.stop = function () {
    if (!this.running) return;
    this.running = false;
    if (window.gsap && this._fn) gsap.ticker.remove(this._fn);
    if (this._raf) cancelAnimationFrame(this._raf);
  };

  window.Nacre = Nacre;
})();
