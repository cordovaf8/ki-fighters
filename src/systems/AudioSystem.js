import { VOICES, defeatVoice } from './CharacterVoices.js';
// AudioSystem: all music and combat sounds are synthesised with the Web Audio
// API, so no audio files are required.
const SFX = {
  charge: a => { a.tone({type:'sine',freq:180,to:700,dur:.19,vol:.065});a.noise({dur:.16,vol:.035,freq:1700}); },
  guard: a => a.tone({type:'triangle',freq:320,to:650,dur:.065,vol:.08}),
  guardbreak: a => { a.noise({dur:.27,vol:.23,freq:4200});a.tone({freq:440,to:55,dur:.3,vol:.13}); },
  swing: a => a.noise({dur:.09,vol:.09,freq:2700}),
  uppercut: a => { a.noise({dur:.16,vol:.14,freq:1600});a.tone({type:'triangle',freq:150,to:600,dur:.12,vol:.08}); },
  technique: a => { a.tone({type:'triangle',freq:460,to:1500,dur:.16,vol:.1}); },
  blast: (a) => a.tone({ type: 'square', freq: 880, to: 300, dur: 0.09, vol: 0.12 }),
  bigblast: (a) => { a.tone({ type: 'sawtooth', freq: 520, to: 110, dur: 0.28, vol: 0.2 }); a.noise({ dur: 0.2, vol: 0.14, freq: 2400 }); },
  charged: (a) => a.tone({ type: 'triangle', freq: 300, to: 1200, dur: 0.18, vol: 0.14 }),
  beamcharge: (a) => a.tone({ type: 'sawtooth', freq: 120, to: 700, dur: 0.6, vol: 0.14 }),
  beam: (a) => { a.tone({ type: 'sawtooth', freq: 180, to: 90, dur: 0.7, vol: 0.24 }); a.noise({ dur: 0.7, vol: 0.2, freq: 1800 }); },
  hit: (a) => { a.noise({ dur: 0.07, vol: 0.2, freq: 3200 }); a.tone({ type: 'square', freq: 220, to: 90, dur: 0.07, vol: 0.12 }); },
  heavy: (a) => { a.noise({ dur: 0.22, vol: 0.32, freq: 1400 }); a.tone({ type: 'sine', freq: 150, to: 40, dur: 0.25, vol: 0.4 }); },
  block: (a) => a.tone({ type: 'triangle', freq: 500, to: 380, dur: 0.07, vol: 0.2 }),
  parry: (a) => { a.tone({ type: 'triangle', freq: 1300, to: 2200, dur: 0.09, vol: 0.22 }); a.tone({ type: 'sine', freq: 2600, to: 1600, dur: 0.14, vol: 0.12 }); },
  explode: (a) => { a.noise({ dur: 0.5, vol: 0.4, freq: 900 }); a.tone({ type: 'sine', freq: 110, to: 30, dur: 0.5, vol: 0.45 }); },
  teleport: (a) => a.tone({ type: 'sine', freq: 1500, to: 400, dur: 0.1, vol: 0.14 }),
  move: (a) => a.tone({ type: 'sine', freq: 260, to: 200, dur: 0.03, vol: 0.05 }),
  punch: (a) => { a.noise({ dur: 0.05, vol: 0.24, freq: 2000 }); a.tone({ type: 'square', freq: 160, to: 70, dur: 0.06, vol: 0.16 }); },
  crack: (a) => a.noise({ dur: 0.18, vol: 0.2, freq: 700 }),
  capture: (a) => { a.tone({ type: 'square', freq: 330, to: 660, dur: 0.14, vol: 0.12 }); a.tone({ type: 'square', freq: 660, to: 990, dur: 0.14, vol: 0.12, delay: 0.12 }); },
  restore: (a) => { [523, 659, 784, 1047].forEach((f, i) => a.tone({ type: 'triangle', freq: f, dur: 0.12, vol: 0.12, delay: i * 0.06 })); },
  transform: (a) => { a.tone({ type: 'sawtooth', freq: 80, to: 900, dur: 0.6, vol: 0.22 }); a.noise({ dur: 0.7, vol: 0.2, freq: 1200 }); a.tone({ type: 'square', freq: 1320, dur: 0.25, vol: 0.1, delay: 0.55 }); },
  powerdown: (a) => a.tone({ type: 'sawtooth', freq: 600, to: 90, dur: 0.3, vol: 0.14 }),
  clash: (a) => { a.noise({ dur: 0.4, vol: 0.3, freq: 2600 }); a.tone({ type: 'sawtooth', freq: 240, to: 480, dur: 0.4, vol: 0.2 }); },
  press: (a) => a.tone({ type: 'square', freq: 700 + Math.random() * 200, dur: 0.03, vol: 0.06 }),
  select: (a) => a.tone({ type: 'square', freq: 660, dur: 0.05, vol: 0.1 }),
  confirm: (a) => { a.tone({ type: 'square', freq: 660, dur: 0.06, vol: 0.1 }); a.tone({ type: 'square', freq: 990, dur: 0.1, vol: 0.1, delay: 0.06 }); },
  deny: (a) => a.tone({ type: 'square', freq: 160, to: 120, dur: 0.12, vol: 0.12 }),
  ready: (a) => { a.tone({ type: 'triangle', freq: 784, dur: 0.08, vol: 0.14 }); a.tone({ type: 'triangle', freq: 1175, dur: 0.14, vol: 0.14, delay: 0.08 }); },
  ko: (a) => { a.noise({ dur: 0.5, vol: 0.09, freq: 600 }); a.tone({ type: 'sine', freq: 200, to: 30, dur: 0.6, vol: 0.14 }); },
  win: (a) => { [523, 659, 784, 1047, 1319].forEach((f, i) => a.tone({ type: 'square', freq: f, dur: 0.18, vol: 0.12, delay: i * 0.12 })); },
  lose: (a) => { [392, 330, 262, 196].forEach((f, i) => a.tone({ type: 'triangle', freq: f, dur: 0.26, vol: 0.16, delay: i * 0.2 })); },
};

export class AudioSystem {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.musicLayer = null;
  }

  /** Browsers only allow audio after a user gesture; call this from a click. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.sfxBus = this.ctx.createGain();
      this.musicBus = this.ctx.createGain();
      this.sfxBus.connect(this.ctx.destination);
      this.musicBus.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noiseBuffer = this.ctx.createBuffer(1, len, len);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.applySettings();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  /** True once the browser has actually let sound start. */
  get running() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  applySettings() {
    if (!this.ctx) return;
    this.sfxBus.gain.value = this.settings.sfx;
    this.musicBus.gain.value = this.settings.music * 0.6;
  }

  tone(o) {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + (o.delay || 0);
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(o.freq, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + o.dur);
    g.gain.setValueAtTime(o.vol ?? 0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + o.dur);
    osc.connect(g).connect(o.bus || this.sfxBus);
    osc.start(t);
    osc.stop(t + o.dur + 0.02);
  }

  noise(o) {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + (o.delay || 0);
    const src = c.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(o.freq || 2000, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(80, (o.freq || 2000) * 0.2), t + o.dur);
    const g = c.createGain();
    g.gain.setValueAtTime(o.vol ?? 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + o.dur);
    src.connect(filter).connect(g).connect(o.bus || this.sfxBus);
    src.start(t);
    src.stop(t + o.dur + 0.02);
  }

  play(name, fighter) {
    if (!this.ctx) return;
    const id = typeof fighter === 'string' ? fighter : fighter?.id;
    if (name === 'defeat') { defeatVoice(this, id); return; }
    if (!SFX[name]) return;
    // Tune energy attacks to their owner's voice without changing UI pitches.
    const themed = id && ['blast','bigblast','beam','beamcharge','charge','transform','technique'].includes(name);
    const ratio = themed ? Math.max(.7, Math.min(1.45, (VOICES[id]?.pitch || 155) / 155)) : 1;
    const emitter = Object.create(this);
    emitter.tone = o => this.tone({...o, freq:o.freq*ratio, to:o.to ? o.to*ratio : undefined});
    SFX[name](emitter);
  }

  /** A steady low ambient bed, with a soft entrance and no percussive pulse. */
  startMusic() {
    if (!this.ctx || this.musicLayer) return;
    const c = this.ctx, now = c.currentTime;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + 1.5);
    gain.connect(this.musicBus);
    const voices = [
      [55, .075], [82.41, .035], [110, .025], [130.81, .018],
    ].map(([freq, volume]) => {
      const osc = c.createOscillator(), level = c.createGain();
      osc.type = 'sine'; osc.frequency.value = freq;
      level.gain.value = volume;
      osc.connect(level).connect(gain); osc.start(now);
      return osc;
    });
    this.musicLayer = { gain, voices };
  }

  stopMusic() {
    const layer = this.musicLayer;
    if (!layer || !this.ctx) return;
    this.musicLayer = null;
    const now = this.ctx.currentTime;
    layer.gain.gain.cancelAndHoldAtTime(now);
    layer.gain.gain.linearRampToValueAtTime(0, now + .4);
    let remaining = layer.voices.length;
    layer.voices.forEach(voice => {
      voice.onended = () => {
        voice.disconnect();
        if (--remaining === 0) layer.gain.disconnect();
        voice.onended = null;
      };
      voice.stop(now + .45);
    });
  }
}
