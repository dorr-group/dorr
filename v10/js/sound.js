/* DORR v10 — sound. All effects are synthesised with the Web Audio API and written to sit
   inside the ambient bed ("Rest Now", audio/CREDITS.txt). Analysis of the loop (ffmpeg +
   numpy chroma): tonal centre F#, strong C#, E, B and G#, bass moving between E and B, a slow
   pulse around 65 BPM. So every effect uses only F# minor-pentatonic tones (F# A B C# E,
   with G#), low and mid register, soft attacks and a dark, long room:
   - a pearl: one muted felt-piano note (a dyad for DORR), its own degree per brand;
   - entering a pearl: a deep, slow swell of a low F#–C#–E pad opening a low-pass filter;
   - leaving: the same swell reversed (it grows, then the filter closes);
   - a step / a jump: a barely-there felt tap / a soft low-passed breath;
   - the shell opening: a long, very low resonant swell.
   No bells, nothing bright or metallic. Effects stay quieter than the music. */
const KEY = 'dorr-v10-sound';
const MUSIC_URL = 'audio/dorr-ambient.mp3';
const MUSIC_VOL = 0.5;
const DUCK = 0.6;

const store = {
  get() { try { return localStorage.getItem(KEY); } catch (e) { return null; } },
  set(v) { try { localStorage.setItem(KEY, v); } catch (e) { /* private mode: fine */ } },
};

const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
// F#3 G#3 B3 C#4 E4 for the five brands; DORR is a low F#2 + C#3 dyad
const BRAND_NOTES = [54, 56, 59, 61, 64];
const DORR_NOTES = [42, 49];
const PAD = [42, 49, 52, 54]; // F#2 C#3 E3 F#3

let ctx = null, master = null, sfxBus = null, meterNode = null, meterBuf = null, musicBus = null, verbIn = null, noiseBuf = null;
let music = null, musicBuf = null, musicLoading = null;
let enabled = false, ducked = false, hidden = false;
const debug = { sfx: 0, last: '', byKind: {}, musicState: 'none' };
const listeners = new Set();

// a dark, smooth room: decaying noise that loses its highs as it fades
function makeRoom(c, seconds) {
  const len = Math.floor(c.sampleRate * seconds);
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const k = 0.5 - 0.45 * t; // one-pole low-pass that closes over time
      lp += k * ((Math.random() * 2 - 1) - lp);
      d[i] = lp * Math.pow(1 - t, 2.4) * (i < c.sampleRate * 0.02 ? i / (c.sampleRate * 0.02) : 1);
    }
  }
  return buf;
}

function build() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  ctx = new AC({ latencyHint: 'interactive' });
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16; comp.knee.value = 14; comp.ratio.value = 2.5; comp.attack.value = 0.01; comp.release.value = 0.4;
  master = ctx.createGain(); master.gain.value = 0;
  master.connect(comp).connect(ctx.destination);
  meterNode = ctx.createAnalyser(); meterNode.fftSize = 2048; comp.connect(meterNode);
  meterBuf = new Float32Array(meterNode.fftSize);
  musicBus = ctx.createGain(); musicBus.gain.value = 0; musicBus.connect(master);
  sfxBus = ctx.createGain(); sfxBus.gain.value = 0.85;
  const sfxTone = ctx.createBiquadFilter(); sfxTone.type = 'lowpass'; sfxTone.frequency.value = 3200; sfxTone.Q.value = 0.4;
  sfxBus.connect(sfxTone).connect(master);
  const verb = ctx.createConvolver(); verb.buffer = makeRoom(ctx, 4.6);
  verbIn = ctx.createGain(); verbIn.gain.value = 0.5;
  const verbOut = ctx.createGain(); verbOut.gain.value = 0.55;
  verbIn.connect(verb).connect(verbOut).connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
  const n = noiseBuf.getChannelData(0);
  for (let i = 0; i < n.length; i++) n[i] = Math.random() * 2 - 1;
  return true;
}

const now = () => ctx.currentTime;
function out(node, wet = 0.6) {
  node.connect(sfxBus);
  if (wet > 0) { const g = ctx.createGain(); g.gain.value = wet; node.connect(g).connect(verbIn); }
}
function count(kind) { debug.sfx++; debug.last = kind; debug.byKind[kind] = (debug.byKind[kind] || 0) + 1; }
const live = () => enabled && ctx && ctx.state === 'running' && !hidden;

// a muted felt-piano note: few soft harmonics, a felt thump, a damper that closes the tone
function felt(midi, level, when = 0, len = 3.2) {
  const t = now() + when, f = hz(midi);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.5;
  lp.frequency.setValueAtTime(Math.min(2400, f * 7), t);
  lp.frequency.exponentialRampToValueAtTime(Math.max(260, f * 1.6), t + 1.2);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(level, t + 0.028);
  g.gain.exponentialRampToValueAtTime(level * 0.35, t + 0.5);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  lp.connect(g); out(g, 0.7);
  [[1, 1], [2, 0.32], [3, 0.1], [4.01, 0.04]].forEach(([r, a]) => {
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.value = f * r; o.detune.value = (Math.random() - 0.5) * 4;
    const og = ctx.createGain(); og.gain.value = a;
    o.connect(og).connect(lp); o.start(t); o.stop(t + len + 0.1);
  });
  // the felt: a short, dark knock under the note
  const src = ctx.createBufferSource(); src.buffer = noiseBuf;
  const bp = ctx.createBiquadFilter(); bp.type = 'lowpass'; bp.frequency.value = 420;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.0001, t); ng.gain.exponentialRampToValueAtTime(level * 0.5, t + 0.006); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
  src.connect(bp).connect(ng); out(ng, 0.2);
  src.start(t, Math.random() * 2); src.stop(t + 0.12);
}

// a soft pad swell through a moving low-pass; reverse=true grows then closes (a reversed swell)
function swell(notes, { attack, release, level, from, to, reverse = false, air = 0 }) {
  const t = now();
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.7;
  const g = ctx.createGain();
  if (!reverse) {
    lp.frequency.setValueAtTime(from, t); lp.frequency.exponentialRampToValueAtTime(to, t + attack);
    lp.frequency.exponentialRampToValueAtTime(from, t + attack + release);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(level, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + release);
  } else {
    lp.frequency.setValueAtTime(to, t); lp.frequency.exponentialRampToValueAtTime(from, t + attack);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(level, t + attack * 0.9);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + release);
  }
  lp.connect(g); out(g, 0.8);
  const end = t + attack + release + 0.1;
  for (const m of notes) for (const det of [-5, 5]) {
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = hz(m); o.detune.value = det;
    const og = ctx.createGain(); og.gain.value = 0.55 / notes.length;
    o.connect(og).connect(lp); o.start(t); o.stop(end);
  }
  if (air > 0) breath(reverse ? 1200 : 240, reverse ? 240 : 1200, attack + release * 0.5, air);
}

// filtered noise: an airy breath
function breath(from, to, dur, level) {
  const t = now();
  const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.6;
  lp.frequency.setValueAtTime(from, t); lp.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(level, t + dur * 0.45); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(lp).connect(g); out(g, 0.7);
  src.start(t, Math.random() * 2); src.stop(t + dur + 0.05);
}

/* ------------------------------------------------------------------ public */
export const Sound = {
  get enabled() { return enabled; },
  debug,
  remembered() { return store.get(); },
  onChange(fn) { listeners.add(fn); },

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
    musicBus.gain.setTargetAtTime(ducked ? MUSIC_VOL * DUCK : MUSIC_VOL, now(), 1.0);
    music.start();
    debug.musicState = 'playing';
  },

  duck(on) {
    ducked = on;
    if (ctx && music) musicBus.gain.setTargetAtTime(on ? MUSIC_VOL * DUCK : MUSIC_VOL, now(), 0.9);
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
    if (i < 0) { felt(DORR_NOTES[0], 0.08, 0, 4.2); felt(DORR_NOTES[1], 0.05, 0.11, 3.8); }
    else felt(BRAND_NOTES[i], 0.075, 0, 3.4);
  },
  enter() {
    if (!live()) return;
    count('enter');
    swell(PAD, { attack: 1.9, release: 3.2, level: 0.075, from: 180, to: 1400, air: 0.012 });
  },
  exit() {
    if (!live()) return;
    count('exit');
    swell([42, 49, 54], { attack: 1.7, release: 0.9, level: 0.06, from: 220, to: 1300, reverse: true, air: 0.01 });
  },
  open() { this.enter(); },
  close() { this.exit(); },
  step() {
    if (!live()) return;
    count('step');
    felt(30, 0.035, 0, 1.2); // a low F#1 felt tap, felt more than heard
    breath(160, 520, 1.6, 0.006);
  },
  jump() {
    if (!live()) return;
    count('jump');
    breath(200, 900, 1.5, 0.018);
    felt(54, 0.04, 0.25, 2.6);
  },
  shell() {
    if (!live()) return;
    count('shell');
    swell([30, 37, 42, 49], { attack: 2.6, release: 3.6, level: 0.08, from: 120, to: 700, air: 0.008 });
  },
  tick() {
    if (!live()) return;
    count('tick');
    const t = now();
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.012, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    src.connect(lp).connect(g); out(g, 0.3);
    src.start(t, Math.random() * 2); src.stop(t + 0.07);
  },

  // test hooks: output peak / RMS of the last ~45 ms, and a way to hear effects alone
  meter() {
    if (!meterNode) return { peak: 0, rms: 0 };
    meterNode.getFloatTimeDomainData(meterBuf);
    let pk = 0, sq = 0;
    for (let i = 0; i < meterBuf.length; i++) { const v = Math.abs(meterBuf[i]); if (v > pk) pk = v; sq += v * v; }
    return { peak: pk, rms: Math.sqrt(sq / meterBuf.length) };
  },
  _music(level) { if (musicBus) { musicBus.gain.cancelScheduledValues(now()); musicBus.gain.setValueAtTime(level, now()); } },

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
