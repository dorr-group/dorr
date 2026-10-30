/* DORR v5 — a live, iridescent pearl drawn with a single WebGL fragment shader.
   Cheap by design: one quad, capped pixel ratio, renders only while on screen. */
(function () {
  'use strict';

  var VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.0,1.0);}';
  var FS = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    'uniform vec2 uRes;uniform float uTime;uniform vec2 uLight;uniform float uNight;uniform float uDeep;',
    'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
    'float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);',
    ' return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),f.x),f.y);}',
    'void main(){',
    ' float s=min(uRes.x,uRes.y);',
    ' vec2 uv=(gl_FragCoord.xy-0.5*uRes)/(0.5*s)*1.18;',
    ' float r=length(uv);',
    ' float aa=3.0/s*1.18;',
    ' float body=1.0-smoothstep(1.0-aa,1.0,r);',
    ' float halo=exp(-max(r-1.0,0.0)*14.0)*(1.0-body)*(1.0-smoothstep(1.06,1.17,r));',
    ' vec3 n=vec3(uv,sqrt(max(0.0,1.0-r*r)));',
    ' vec3 L=normalize(vec3(uLight,0.8));',
    ' vec3 V=vec3(0.0,0.0,1.0);',
    ' float wrap=clamp((dot(n,L)+0.25)/1.25,0.0,1.0);',
    ' vec3 H=normalize(L+V);',
    ' float nh=max(dot(n,H),0.0);',
    ' float spec=pow(nh,260.0);',
    ' float soft=pow(nh,16.0);',
    ' float fres=pow(1.0-n.z,2.6);',
    ' float nz=noise(n.xy*2.2+uTime*0.05)*0.6+noise(n.xy*5.5-uTime*0.035)*0.3;',
    ' float film=n.z*1.3+nz+uTime*0.012;',
    ' vec3 irid=0.5+0.5*cos(6.28318*(film+vec3(0.0,0.33,0.67)));',
    ' vec3 base=mix(vec3(0.93,0.9,0.87),vec3(0.84,0.865,0.92),uNight);',
    ' base=mix(base,vec3(0.88,0.9,0.95),uDeep);',
    ' vec3 shade=mix(vec3(0.52,0.47,0.52),vec3(0.26,0.31,0.45),max(uNight,uDeep*0.8));',
    ' vec3 rim=mix(vec3(0.93,0.78,0.80),vec3(0.58,0.68,0.88),max(uNight,uDeep));',
    ' vec3 col=mix(shade,base,smoothstep(0.0,1.0,wrap));',
    ' col+=(irid-0.5)*(0.05+0.16*fres);',
    ' col=mix(col,rim,fres*0.38);',
    ' col*=mix(1.0,0.8,pow(1.0-n.z,4.0));',
    ' float ry=2.0*n.z*n.y;',
    ' vec3 sky=mix(mix(vec3(0.97,0.83,0.82),vec3(0.5,0.56,0.68),uNight),vec3(0.36,0.42,0.56),uDeep);',
    ' vec3 sea=mix(mix(vec3(0.42,0.56,0.62),vec3(0.12,0.16,0.23),uNight),vec3(0.07,0.09,0.14),uDeep);',
    ' vec3 env=mix(sea,sky,smoothstep(-0.12,0.12,ry));',
    ' col=mix(col,env,0.1+0.3*fres);',
    ' col+=vec3(1.0,0.99,0.97)*(spec*1.3+soft*0.12);',
    ' vec3 haloCol=mix(vec3(1.0,0.95,0.92),vec3(0.78,0.86,1.0),max(uNight,uDeep));',
    ' float ha=halo*mix(0.18,0.34,uDeep);',
    ' gl_FragColor=vec4(col*body+haloCol*ha,body+ha);',
    '}'
  ].join('\n');

  function Pearl(canvas, opts) {
    opts = opts || {};
    this.canvas = canvas;
    this.night = opts.night || 0;
    this.deep = opts.deep || 0;
    this.still = !!opts.still;
    this.lx = -0.45; this.ly = 0.55; this.tx = this.lx; this.ty = this.ly;
    this.visible = false; this.raf = 0; this.t0 = performance.now();
    this.ok = this._init();
  }

  Pearl.prototype._init = function () {
    var c = this.canvas, gl;
    try {
      gl = c.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' }) ||
           c.getContext('experimental-webgl');
    } catch (e) { gl = null; }
    if (!gl) return false;
    this.gl = gl;
    function sh(type, src) {
      var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { return null; }
      return s;
    }
    var vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) return false;
    var pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return false;
    gl.useProgram(pr);
    var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.u = {
      res: gl.getUniformLocation(pr, 'uRes'), time: gl.getUniformLocation(pr, 'uTime'),
      light: gl.getUniformLocation(pr, 'uLight'), night: gl.getUniformLocation(pr, 'uNight'), deep: gl.getUniformLocation(pr, 'uDeep')
    };
    gl.clearColor(0, 0, 0, 0);
    var self = this;
    c.addEventListener('webglcontextlost', function (e) { e.preventDefault(); self.stop(); self.ok = false; c.parentNode && c.parentNode.classList.remove('gl-ok'); });
    this.resize();
    if (window.ResizeObserver) { new ResizeObserver(function () { self.resize(); self.draw(); }).observe(c); }
    if (window.IntersectionObserver) {
      new IntersectionObserver(function (es) {
        self.visible = es[0].isIntersecting;
        if (self.visible) self.start(); else self.stop();
      }, { rootMargin: '80px' }).observe(c);
    } else { this.visible = true; this.start(); }
    document.addEventListener('visibilitychange', function () { if (document.hidden) self.stop(); else if (self.visible) self.start(); });
    this.draw();
    c.parentNode && c.parentNode.classList.add('gl-ok');
    return true;
  };

  Pearl.prototype.resize = function () {
    var c = this.canvas, r = { width: c.offsetWidth, height: c.offsetHeight };
    var touch = window.matchMedia && matchMedia('(pointer: coarse)').matches;
    var dpr = Math.min(window.devicePixelRatio || 1, touch ? 1.5 : 1.75) * (this.q || 1);
    var w = Math.max(2, Math.round(r.width * dpr)), h = Math.max(2, Math.round(r.height * dpr));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    if (this.gl) this.gl.viewport(0, 0, w, h);
  };

  Pearl.prototype.draw = function () {
    var gl = this.gl; if (!gl) return;
    var now = performance.now(), t = (now - this.t0) / 1000;
    if (!this.still && now - (this.lastPointer || 0) > 2600) {
      this.tx = -0.42 + Math.sin(t * 0.35) * 0.22; this.ty = 0.5 + Math.cos(t * 0.27) * 0.16;
    }
    this.lx += (this.tx - this.lx) * 0.06; this.ly += (this.ty - this.ly) * 0.06;
    gl.uniform2f(this.u.res, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.u.time, this.still ? 2.0 : t);
    gl.uniform2f(this.u.light, this.lx, this.ly);
    gl.uniform1f(this.u.night, this.night);
    gl.uniform1f(this.u.deep, this.deep);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  Pearl.prototype.start = function () {
    if (this.raf || !this.ok) return;
    if (this.still) { this.draw(); return; }
    var self = this;
    self.lastT = 0; self.frames = 0; self.slow = 0;
    (function loop() {
      var now = performance.now();
      if (self.lastT) {
        // adaptive quality: if frames keep arriving late, halve the resolution, then freeze
        if (now - self.lastT > 40) self.slow++;
        if (++self.frames === 20) { if (self.slow > 10) self.degrade(); self.frames = 0; self.slow = 0; }
      }
      self.lastT = now;
      if (!self.raf && self.still) return;
      self.draw();
      if (self.still) { self.raf = 0; return; }
      self.raf = requestAnimationFrame(loop);
    })();
  };
  Pearl.prototype.degrade = function () {
    if ((this.q || 1) > 0.5) { this.q = 0.5; this.resize(); }
    else { this.still = true; }
  };
  Pearl.prototype.stop = function () { if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; };
  Pearl.prototype.light = function (x, y) { this.lastPointer = performance.now(); this.tx = x; this.ty = y; if (this.still) { this.lx = x; this.ly = y; this.draw(); } };
  Pearl.prototype.setNight = function (v) { this.night = v; if (this.still || !this.raf) this.draw(); };

  window.DorrPearl = Pearl;
})();
