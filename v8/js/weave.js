/* DORR v8 — weave.js
   1) Woven wordmarks: glyphs are rasterised once, then rebuilt as vertical warp threads (one SVG path per
      column) with ragged fringe where a thread meets the top or bottom of a letter.
   2) Runtime textures: thread-gradient seam mask, the menu's woven sweep mask, and a fibre grain tile.
   Everything is generated on the client, so nothing heavy ships over the wire. */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';

  // small seeded random so every visit weaves the same cloth
  function rng(seed) {
    var s = seed >>> 0 || 1;
    return function () { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
  }

  function sampleText(text, fs) {
    var c = document.createElement('canvas');
    var ctx = c.getContext('2d', { willReadFrequently: true });
    var font = '400 ' + fs + 'px Michroma, Arial, sans-serif';
    ctx.font = font;
    var track = fs * 0.06;
    var w = 0, i;
    for (i = 0; i < text.length; i++) w += ctx.measureText(text[i]).width + (i < text.length - 1 ? track : 0);
    var pad = Math.ceil(fs * 0.2);
    c.width = Math.ceil(w + pad * 2);
    c.height = Math.ceil(fs * 1.5);
    ctx.font = font;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#000'; ctx.strokeStyle = '#000';
    ctx.lineJoin = 'miter'; ctx.lineWidth = fs * 0.11;
    var x = pad, y = Math.round(fs * 1.12);
    for (i = 0; i < text.length; i++) {
      ctx.fillText(text[i], x, y);
      ctx.strokeText(text[i], x, y);
      x += ctx.measureText(text[i]).width + track;
    }
    var data = ctx.getImageData(0, 0, c.width, c.height).data;
    var W = c.width, H = c.height, x0 = W, x1 = 0, y0 = H, y1 = 0, xx, yy;
    for (yy = 0; yy < H; yy++) for (xx = 0; xx < W; xx++) {
      if (data[(yy * W + xx) * 4 + 3] > 127) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; }
    }
    return { data: data, W: W, H: H, x0: x0, x1: x1, y0: y0, y1: y1 };
  }

  var cache = {};
  function buildWeave(text, cols, seed) {
    var key = text + cols + seed;
    if (cache[key]) return cache[key].cloneNode(true);
    var s = sampleText(text, 360);
    var r = rng(seed || 7);
    var bw = s.x1 - s.x0 + 1, bh = s.y1 - s.y0 + 1;
    var pitch = bw / cols;
    var fringeMax = bh * 0.11;
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 ' + (-fringeMax).toFixed(1) + ' ' + bw.toFixed(1) + ' ' + (bh + fringeMax * 2).toFixed(1));
    svg.setAttribute('class', 'weave-svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    var steps = [0, 0, 0.02, 0.035, 0.06, 0.085, 0.11];
    for (var c = 0; c < cols; c++) {
      var cx = s.x0 + (c + 0.5) * pitch;
      var tw = pitch * (0.74 + r() * 0.14);
      var jit = (r() - 0.5) * pitch * 0.16;
      var runs = [], inRun = false, start = 0;
      for (var y = s.y0; y <= s.y1 + 1; y++) {
        var a = 0, n = 0;
        for (var dx = -1; dx <= 1; dx++) {
          var px = Math.round(cx + dx * pitch * 0.22);
          if (y <= s.y1 && px >= 0 && px < s.W) { a += s.data[(y * s.W + px) * 4 + 3]; n++; }
        }
        var on = n && a / n > 127;
        if (on && !inRun) { inRun = true; start = y; }
        if (!on && inRun) { inRun = false; if (y - start > 1) runs.push([start, y]); }
      }
      if (!runs.length) continue;
      var d = '';
      for (var k = 0; k < runs.length; k++) {
        var top = runs[k][0] - s.y0, bot = runs[k][1] - s.y0;
        var outerTop = top < bh * 0.1, outerBot = bot > bh * 0.9;
        var ft = outerTop ? steps[Math.floor(r() * steps.length)] * bh * (c % 2 ? 1 : 0.55) : (r() < 0.5 ? r() * bh * 0.02 : 0);
        var fb = outerBot ? steps[Math.floor(r() * steps.length)] * bh * (c % 2 ? 0.55 : 1) : (r() < 0.5 ? r() * bh * 0.02 : 0);
        var yA = top - ft, yB = bot + fb;
        var xL = (cx - s.x0) + jit - tw / 2;
        // occasional weft break inside long runs
        if (yB - yA > bh * 0.45 && r() < 0.12) {
          var gy = yA + (yB - yA) * (0.3 + r() * 0.4), gh = bh * (0.012 + r() * 0.02);
          d += 'M' + xL.toFixed(1) + ' ' + yA.toFixed(1) + 'h' + tw.toFixed(1) + 'V' + gy.toFixed(1) + 'h' + (-tw).toFixed(1) + 'Z';
          d += 'M' + xL.toFixed(1) + ' ' + (gy + gh).toFixed(1) + 'h' + tw.toFixed(1) + 'V' + yB.toFixed(1) + 'h' + (-tw).toFixed(1) + 'Z';
        } else {
          d += 'M' + xL.toFixed(1) + ' ' + yA.toFixed(1) + 'h' + tw.toFixed(1) + 'V' + yB.toFixed(1) + 'h' + (-tw).toFixed(1) + 'Z';
        }
      }
      var p = document.createElementNS(NS, 'path');
      p.setAttribute('d', d);
      if (c % 2) p.setAttribute('data-up', '');
      svg.appendChild(p);
    }
    cache[key] = svg.cloneNode(true);
    return svg;
  }

  // Edge mask: solid at the top, threads thinning row by row to nothing at the bottom.
  function edgeMask(seed) {
    var W = 1440, H = 240, pitch = 6, rows = 24, rh = H / rows;
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var g = c.getContext('2d'); g.fillStyle = '#000';
    var r = rng(seed || 3);
    for (var col = 0; col < W / pitch; col++) {
      var off = (r() - 0.5) * 0.24, jit = (r() - 0.5) * 1.2;
      for (var row = 0; row < rows; row++) {
        var t = (row + 0.5) / rows;
        var k = Math.pow(Math.max(0, Math.min(1, 1 - t + off + (r() - 0.5) * 0.12)), 1.35);
        var w = k * pitch * 1.04;
        if (w < 0.3) continue;
        var cx = col * pitch + pitch / 2 + jit * (1 - k);
        g.fillRect(cx - w / 2, row * rh, w, rh + 0.6);
      }
    }
    return c.toDataURL('image/png');
  }

  // Menu mask: transparent top, woven ramp, solid bottom (4 screens tall when sized at 100% 400%).
  function menuMask() {
    var W = 720, H = 1600, pitch = 6, rows = 36;
    var b0 = H * 0.4, b1 = H * 0.6, rh = (b1 - b0) / rows;
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var g = c.getContext('2d'); g.fillStyle = '#000';
    g.fillRect(0, b1, W, H - b1);
    var r = rng(11);
    for (var col = 0; col < W / pitch; col++) {
      var off = (r() - 0.5) * 0.2;
      for (var row = 0; row < rows; row++) {
        var t = (row + 0.5) / rows;
        var k = Math.pow(Math.max(0, Math.min(1, t + off + (r() - 0.5) * 0.1)), 1.3);
        var w = k * pitch * 1.04;
        if (w < 0.3) continue;
        g.fillRect(col * pitch + pitch / 2 - w / 2, b0 + row * rh, w, rh + 0.5);
      }
    }
    return c.toDataURL('image/png');
  }

  // Fibre grain: fine noise with a faint vertical warp bias, like raw linen.
  function grain() {
    var S = 192, c = document.createElement('canvas'); c.width = S; c.height = S;
    var g = c.getContext('2d'), img = g.createImageData(S, S), d = img.data, r = rng(5);
    var colBias = [];
    for (var x = 0; x < S; x++) colBias.push((r() - 0.5) * 40);
    for (var y = 0; y < S; y++) for (x = 0; x < S; x++) {
      var v = r() * 255 + colBias[x];
      var i = (y * S + x) * 4;
      var lum = v > 128 ? 255 : 0;
      d[i] = d[i + 1] = d[i + 2] = lum;
      d[i + 3] = Math.min(255, Math.abs(v - 128) * 0.42);
    }
    g.putImageData(img, 0, 0);
    return c.toDataURL('image/png');
  }

  function installTextures() {
    try {
      var root = document.documentElement.style;
      root.setProperty('--edge-mask', 'url(' + edgeMask(3) + ')');
      root.setProperty('--menu-mask', 'url(' + menuMask() + ')');
      root.setProperty('--grain', 'url(' + grain() + ')');
      document.documentElement.classList.add('has-edge');
    } catch (e) { /* textures are decoration only */ }
  }

  window.DORRWeave = { build: buildWeave, installTextures: installTextures };
})();
