/* DORR v10 — sound: the ambient music bed only ("Rest Now", audio/CREDITS.txt).
   No synthesised effects. The file is fetched and decoded once, the first time sound is
   turned on, and plays as a gapless looping buffer through one gain for fades and ducking. */
const KEY = 'dorr-v10-sound';
const MUSIC_URL = 'audio/dorr-ambient.mp3';
const MUSIC_VOL = 0.5;
const DUCK = 0.6;

const store = {
  get() { try { return localStorage.getItem(KEY); } catch (e) { return null; } },
  set(v) { try { localStorage.setItem(KEY, v); } catch (e) { /* private mode: fine */ } },
};

let ctx = null, master = null, musicBus = null;
let music = null, musicBuf = null, musicLoading = null;
let enabled = false, ducked = false, hidden = false;
let musicState = 'none';
const listeners = new Set();

function build() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  ctx = new AC({ latencyHint: 'playback' });
  // the same gentle bus compression the music has always had, so it sounds unchanged
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16; comp.knee.value = 14; comp.ratio.value = 2.5; comp.attack.value = 0.01; comp.release.value = 0.4;
  master = ctx.createGain(); master.gain.value = 0;
  master.connect(comp).connect(ctx.destination);
  musicBus = ctx.createGain(); musicBus.gain.value = 0; musicBus.connect(master);
  return true;
}

const now = () => ctx.currentTime;

export const Sound = {
  get enabled() { return enabled; },
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
      musicState = 'offline';
      window.addEventListener('online', () => this.startMusic(), { once: true });
      return;
    }
    if (!musicLoading) {
      musicState = 'loading';
      musicLoading = fetch(MUSIC_URL)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('music unavailable'))))
        .then((b) => new Promise((res, rej) => ctx.decodeAudioData(b, res, rej)))
        .then((buf) => { musicBuf = buf; })
        .catch(() => { musicState = 'unavailable'; musicLoading = null; });
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
    musicState = 'playing';
  },

  // a little quieter while a pearl or a sheet is open
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

  state() {
    return {
      ctx: ctx ? ctx.state : 'none', enabled, hidden, ducked,
      master: master ? +master.gain.value.toFixed(3) : 0,
      musicGain: musicBus ? +musicBus.gain.value.toFixed(3) : 0,
      music: musicState,
    };
  },
};
window.__dorrSound = Sound;
