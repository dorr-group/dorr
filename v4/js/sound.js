/* DORR v4 — sound. Every effect is synthesised here with the Web Audio API (no samples):
   glass-and-nacre chimes for the pearls (one pitch per brand, a set in D major pentatonic),
   an airy swell when a sheet opens, a softer fall when it closes, a slow resonant swell as
   the shell opens, and a very quiet hover tick on desktop. The ambient bed is a licensed
   loop (audio/CREDITS.txt), fetched only after the visitor chooses sound.
   Nothing here can block the page: every call is a no-op until the visitor opts in. */
const KEY = 'dorr-v4-sound';
const MUSIC_URL = 'audio/dorr-ambient.mp3';
const MUSIC_VOL = 0.5;
const DUCK = 0.5;

const store = {
  get() { try { return localStorage.getItem(KEY); } catch (e) { return null; } },
  set(v) { try { localStorage.setItem(KEY, v); } catch (e) { /* private mode: fine */ } },
};

// pentatonic set: D5 E5 F#5 A5 B5; the DORR pearl sits lower, on A4
const BRAND_HZ = [587.33, 659.25, 739.99, 880.0, 987.77];
const DORR_HZ = 440.0;
// inharmonic partials of a small glass bell / struck nacre disc
const PARTIALS = [[1, 1, 2.6], [2.76, 0.42, 1.5], [5.4, 0.2, 0.9], [8.93, 0.09, 0.55], [13.34, 0.04, 0.35]];

let ctx = null, master = null, comp = null, sfxBus = null, musicBus = null, verbIn = null, noiseBuf = null;
let music = null, musicBuf = null, musicLoading = null;
let enabled = false, ducked = false, hidden = false;
const debug = { sfx: 0, last: '', byKind: {}, musicState: 'none' };
const listeners = new Set();

function makeImpulse(c, seconds, decay) {
  const len = Math.floor(c.sampleRate * seconds);
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

function build() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  ctx = new AC({ latencyHint: 'interactive' });
  comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = 0.005; comp.release.value = 0.25;
  master = ctx.createGain();
  master.gain.value = 0;
  master.connect(comp).connect(ctx.destination);
  musicBus = ctx.createGain(); musicBus.gain.value = 0; musicBus.connect(master);
  sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
  const verb = ctx.createConvolver();
  verb.buffer = makeImpulse(ctx, 3.4, 3.2);
  verbIn = ctx.createGain(); verbIn.gain.value = 0.38;
  const verbOut = ctx.createGain(); verbOut.gain.value = 0.6;
  verbIn.connect(verb).connect(verbOut).connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const n = noiseBuf.getChannelData(0);
  for (let i = 0; i < n.length; i++) n[i] = Math.random() * 2 - 1;
  return true;
}

const now = () => ctx.currentTime;
function out(node, wet = 1) {
  node.connect(sfxBus);
  if (wet > 0) { const s = ctx.createGain(); s.gain.value = wet; node.connect(s).connect(verbIn); }
}
function count(kind) {
  debug.sfx++; debug.last = kind; debug.byKind[kind] = (debug.byKind[kind] || 0) + 1;
}
const live = () => enabled && ctx && ctx.state === 'running' && !hidden;

// a crystalline chime: additive bell partials + a quick FM shimmer + a soft upper fifth
function chime(f, level = 0.22, when = 0) {
  const t = now() + when;
  const bus = ctx.createGain(); bus.gain.value = level;
  const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  if (pan) { pan.pan.value = (Math.random() - 0.5) * 0.5; bus.connect(pan); out(pan, 1); } else out(bus, 1);
  for (const [r, a, d] of PARTIALS) {
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.value = f * r * (1 + (Math.random() - 0.5) * 0.002);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(a, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(bus); o.start(t); o.stop(t + d + 0.05);
  }
  // FM shimmer, the nacre glint
  const c = ctx.createOscillator(), m = ctx.createOscillator(), mg = ctx.createGain(), cg = ctx.createGain();
  c.frequency.value = f * 2; m.frequency.value = f * 2 * 3.5;
  mg.gain.setValueAtTime(f * 1.4, t); mg.gain.exponentialRampToValueAtTime(1, t + 0.8);
  cg.gain.setValueAtTime(0.0001, t); cg.gain.exponentialRampToValueAtTime(0.16, t + 0.01); cg.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
  m.connect(mg).connect(c.frequency); c.connect(cg).connect(bus);
  c.start(t); m.start(t); c.stop(t + 1.2); m.stop(t + 1.2);
}

function air(from, to, dur, level, q = 1.2) {
  const t = now();
  const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = q;
  bp.frequency.setValueAtTime(from, t); bp.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(level, t + dur * 0.35);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bp).connect(g); out(g, 0.8);
  src.start(t, Math.random()); src.stop(t + dur + 0.05);
}

function pad(freqs, attack, hold, release, level, cutoff = 1400) {
  const t = now();
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cutoff; lp.Q.value = 0.3;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(level, t + attack);
  g.gain.setValueAtTime(level, t + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
  lp.connect(g); out(g, 0.9);
  const end = t + attack + hold + release + 0.05;
  for (const f of freqs) for (const det of [-4, 4]) {
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f; o.detune.value = det;
    const og = ctx.createGain(); og.gain.value = 0.5 / freqs.length;
    o.connect(og).connect(lp); o.start(t); o.stop(end);
  }
}

/* ------------------------------------------------------------------ public */
export const Sound = {
  get enabled() { return enabled; },
  debug,
  remembered() { return store.get(); },
  onChange(fn) { listeners.add(fn); },

  // call only from a user gesture
  async setEnabled(on) {
    enabled = !!on;
    store.set(enabled ? 'on' : 'off');
    listeners.forEach((fn) => fn(enabled));
    if (enabled) {
      if (!ctx && !build()) { enabled = false; return; }
      try { await ctx.resume(); } catch (e) { /* stays suspended; harmless */ }
      if (!hidden) master.gain.setTargetAtTime(0.9, now(), 0.4);
      this.startMusic();
    } else if (ctx) {
      master.gain.setTargetAtTime(0, now(), 0.25);
      setTimeout(() => { if (!enabled && ctx && ctx.state === 'running') ctx.suspend().catch(() => {}); }, 1600);
    }
  },

  async startMusic() {
    if (!ctx || !enabled) return;
    if (music) { musicBus.gain.setTargetAtTime(ducked ? MUSIC_VOL * DUCK : MUSIC_VOL, now(), 1.0); return; }
    if (!musicLoading && navigator.onLine === false) {
      // offline: no music file (it is streamed, not cached); try again when the network returns
      debug.musicState = 'offline';
      window.addEventListener('online', () => this.startMusic(), { once: true });
      return;
    }
    if (!musicLoading) {
      debug.musicState = 'loading';
      musicLoading = fetch(MUSIC_URL)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('music unavailable'))))
        .then((b) => new Promise((res, rej) => ctx.decodeAudioData(b, res, rej)))
        .then((buf) => { musicBuf = buf; })
        .catch(() => { debug.musicState = 'unavailable'; musicLoading = null; });
    }
    await musicLoading;
    if (!musicBuf || music || !enabled) return;
    music = ctx.createBufferSource();
    music.buffer = musicBuf; music.loop = true;
    music.connect(musicBus);
    musicBus.gain.cancelScheduledValues(now());
    musicBus.gain.setValueAtTime(0.0001, now());
    musicBus.gain.setTargetAtTime(ducked ? MUSIC_VOL * DUCK : MUSIC_VOL, now(), 1.0); // ~3 s to full
    music.start();
    debug.musicState = 'playing';
  },

  duck(on) {
    ducked = on;
    if (ctx && music) musicBus.gain.setTargetAtTime(on ? MUSIC_VOL * DUCK : MUSIC_VOL, now(), 0.6);
  },

  setHidden(h) {
    hidden = h;
    if (!ctx) return;
    if (h) {
      master.gain.setTargetAtTime(0, now(), 0.15);
      setTimeout(() => { if (hidden && ctx.state === 'running') ctx.suspend().catch(() => {}); }, 500);
    } else if (enabled) {
      ctx.resume().then(() => master.gain.setTargetAtTime(0.9, now(), 0.5)).catch(() => {});
    }
  },

  // index 0–4 for the brand pearls, -1 for the DORR pearl
  pearl(i) {
    if (!live()) return;
    count(i < 0 ? 'pearl-dorr' : `pearl-${i}`);
    if (i < 0) { chime(DORR_HZ, 0.2); chime(DORR_HZ * 1.5, 0.08, 0.09); chime(DORR_HZ * 2, 0.05, 0.18); }
    else { const f = BRAND_HZ[i]; chime(f, 0.18); chime(f * 1.5, 0.06, 0.07); }
  },
  open() {
    if (!live()) return;
    count('open');
    air(380, 2600, 1.4, 0.07);
    pad([146.83, 220, 293.66], 0.5, 0.2, 1.6, 0.05, 1800);
  },
  close() {
    if (!live()) return;
    count('close');
    air(2200, 420, 0.9, 0.045);
  },
  shell() {
    if (!live()) return;
    count('shell');
    pad([73.42, 110, 146.83, 220], 1.8, 0.6, 3.2, 0.09, 700);
    air(160, 900, 4.2, 0.03, 0.8);
  },
  tick() {
    if (!live()) return;
    count('tick');
    const t = now();
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 2600;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.025, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    o.connect(g); out(g, 0.3); o.start(t); o.stop(t + 0.08);
  },

  state() {
    return {
      ctx: ctx ? ctx.state : 'none', enabled, hidden, ducked,
      master: master ? +master.gain.value.toFixed(3) : 0,
      musicGain: musicBus ? +musicBus.gain.value.toFixed(3) : 0,
      music: debug.musicState, sfx: debug.sfx, last: debug.last, byKind: { ...debug.byKind },
    };
  },
};
window.__dorrSound = Sound;
