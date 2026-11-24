// NEON TIDE — procedural audio. No audio files: every sound is synthesized with WebAudio.
// Radio stations are step-sequenced patterns; engine/siren/shots are live oscillators + noise.

import { RADIO } from './config.js';

export class AudioEngine {
  constructor() {
    this.ctx = null; this.master = null; this.radioGain = null; this.sfxGain = null;
    this.station = 0; this.radioOn = true; this.muted = false;
    this.step = 0; this.nextStepTime = 0; this.radioTimer = null;
    this.engineOsc = null; this.engineGain = null; this.sirenOsc = null; this.sirenGain = null;
    this.noiseBuf = null;
  }
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this.radioGain = this.ctx.createGain(); this.radioGain.gain.value = 0.16;
    this.radioGain.connect(this.master);
    this.sfxGain = this.ctx.createGain(); this.sfxGain.gain.value = 0.5;
    this.sfxGain.connect(this.master);
    // white noise buffer, reused by rain, shots and hi-hats
    const len = this.ctx.sampleRate * 1;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.startRadio();
    this.startRain();
  }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.5; }
  cycleStation() { this.station = (this.station + 1) % RADIO.length; this.step = 0; }
  stationName() { return RADIO[this.station].name + ' — ' + RADIO[this.station].genre; }

  // ---- radio sequencer ----
  startRadio() {
    const st = RADIO[this.station];
    const stepDur = 60 / st.bpm / 2; // eighth notes
    const tick = () => {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      if (this.radioOn && !this.muted) this.playStep(st, this.step, t);
      this.step = (this.step + 1) % 32;
      this.radioTimer = setTimeout(tick, stepDur * 1000);
    };
    tick();
  }
  playStep(st, step, t) {
    const scale = st.scale;
    const bar = Math.floor(step / 8) % 4;
    const roots = [0, 0, -5, 3]; // chord roots per bar (semitones)
    // bass on beats
    if (step % 4 === 0) {
      const f = st.root * Math.pow(2, roots[bar] / 12);
      this.tone(f / 2, 0.5, t, st.wave === 'square' ? 'triangle' : 'sine', this.radioGain);
    }
    // lead arp (synthwave) / sparse pluck (lo-fi) / talk blips (tide talk)
    if (st.id === 'tide') {
      if (step % 8 === 3 || step % 8 === 6) this.tone(st.root * 2 * (1 + (step % 3) * 0.06), 0.08, t, 'square', this.radioGain);
      if (step === 0) this.tone(st.root * 4, 0.15, t, 'sine', this.radioGain);
      return;
    }
    if (step % 2 === 0) {
      const deg = scale[(step * 3 + bar) % scale.length];
      const f = st.root * 2 * Math.pow(2, (deg + roots[bar]) / 12);
      this.tone(f, 0.32, t, st.wave, this.radioGain);
    }
    // hat
    if (step % 2 === 1) this.noiseHit(0.03, t, 6000, this.radioGain);
    // snare-ish on 2 & 4
    if (step % 8 === 4) this.noiseHit(0.12, t, 1800, this.radioGain);
  }
  tone(freq, dur, t, wave, dest) {
    const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.type = wave; o.frequency.value = freq;
    g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(dest || this.sfxGain);
    o.start(t); o.stop(t + dur + 0.02);
  }
  noiseHit(dur, t, freq, dest) {
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.6, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || this.sfxGain);
    s.start(t); s.stop(t + dur + 0.02);
  }
  // ---- rain ambience: looped filtered noise ----
  startRain() {
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 0.4;
    const g = this.ctx.createGain(); g.gain.value = 0.05;
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start();
    this.rainGain = g;
  }
  setRain(intensity) { if (this.rainGain) this.rainGain.gain.value = 0.02 + intensity * 0.06; }
  // ---- engine loop ----
  startEngine() {
    if (!this.ctx || this.engineOsc) return;
    this.engineOsc = this.ctx.createOscillator(); this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 60;
    this.engineGain = this.ctx.createGain(); this.engineGain.gain.value = 0.0;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
    this.engineOsc.connect(f); f.connect(this.engineGain); this.engineGain.connect(this.master);
    this.engineOsc.start();
  }
  setEngine(speed01, on) {
    if (!this.engineOsc) return;
    this.engineOsc.frequency.value = 55 + speed01 * 140;
    this.engineGain.gain.value = on ? 0.05 + speed01 * 0.06 : 0.0;
  }
  stopEngine() {
    if (this.engineOsc) { try { this.engineOsc.stop(); } catch {} this.engineOsc = null; }
  }
  // ---- police siren ----
  startSiren() {
    if (!this.ctx || this.sirenOsc) return;
    this.sirenOsc = this.ctx.createOscillator(); this.sirenOsc.type = 'sine';
    this.sirenGain = this.ctx.createGain(); this.sirenGain.gain.value = 0.05;
    this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
    this.sirenOsc.start();
    this.sirenPhase = 0;
  }
  updateSiren(dt) {
    if (!this.sirenOsc) return;
    this.sirenPhase = (this.sirenPhase + dt * 1.6) % 2;
    this.sirenOsc.frequency.value = this.sirenPhase < 1 ? 700 : 950;
  }
  stopSiren() {
    if (this.sirenOsc) { try { this.sirenOsc.stop(); } catch {} this.sirenOsc = null; }
  }
  // ---- one-shots ----
  shot() { if (!this.ctx) return; const t = this.ctx.currentTime; this.noiseHit(0.14, t, 900); this.tone(120, 0.1, t, 'square'); }
  melee() { if (!this.ctx) return; const t = this.ctx.currentTime; this.noiseHit(0.08, t, 400); }
  pickup() { if (!this.ctx) return; const t = this.ctx.currentTime; this.tone(660, 0.12, t, 'sine'); this.tone(990, 0.18, t + 0.09, 'sine'); }
  mission() { if (!this.ctx) return; const t = this.ctx.currentTime; [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.22, t + i * 0.11, 'triangle')); }
  fail() { if (!this.ctx) return; const t = this.ctx.currentTime; [330, 262, 196].forEach((f, i) => this.tone(f, 0.25, t + i * 0.14, 'sawtooth')); }
  crash() { if (!this.ctx) return; const t = this.ctx.currentTime; this.noiseHit(0.3, t, 300); }
  phone() { if (!this.ctx) return; const t = this.ctx.currentTime; this.tone(880, 0.1, t, 'sine'); this.tone(880, 0.1, t + 0.18, 'sine'); }
}
