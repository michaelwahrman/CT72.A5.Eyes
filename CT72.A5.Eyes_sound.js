/* CT61.B6.Darkride -- sound (B2: on from the start; the browser lets it play from your first click or key).
 *
 * As in CT55 / CT58: ONE software synthesizer makes every sample, for the speakers and for the movie, so a recording's
 * sound is exactly what you hear and is locked to the picture.
 *   * Not recording: a ScriptProcessor pulls Synth.render() in real time (48 kHz).
 *   * Recording: each movie frame renders exactly 48000/fps samples in the frame loop; they go to the movie's audio
 *     encoder and to a small queue the speakers play from.
 *
 * Voices:  roll  - the car's wheels on the track: low band-passed rumble whose loudness and pitch follow your speed
 *          joint - a soft double knock each time a wheel pair crosses a rail joint (every 1.5 m of track)
 *          chain - the lift's chain dog: a fast ratchet clack while you climb
 *          drone - a dark organ-ish pad (two detuned low tones and a fifth), louder in the rooms, quieter in the corridors
 *          buzz  - A4: the bee room's swarm, as CT54's cloud: a chorus of detuned buzzing tones over the wingbeat range
 *                  (196-256 Hz, each wavering slowly) and band-passed noise round 250 Hz (the rush of the wings); it swells as
 *                  you come into the room and fades as you leave
 *          locust - A9: the plains' swarm: a roar of massed wingbeats under a dry crackling rustle.  A10: it follows where the locusts
 *                  are round you (plains.listen): as loud as the swarm is thick round your head, panned to the side it is thicker on,
 *                  and a whirring rattle for each of the (up to six) locusts going past within 2.5 m, panned and swelling as it passes
 *          rain   - B2: rain outside the windows of the first corridor: a hiss (noise between ~400 Hz and 5 kHz) and a patter of
 *                  drops, as loud as you are near the windows
 *          drip   - B2: water dripping in the mine (most in the crate store): a falling 'plink' and its echo off the rock
 *          creak  - B2: the old car complaining: now and then a stick-slip creak (a burst of clicks through a resonance) while it moves
 * Nothing is loaded from the internet; no sound files.
 */
(function (global) {
  'use strict';
  const SR = 48000;

  class Synth {
    constructor() {
      this.seed = 0x61d4;
      this.roll = { level: 0, target: 0, fc: 120, fcT: 120, lp: 0, bp: 0, lp2: 0, bp2: 0 };
      this.knocks = [];                 // pending knocks: {t (s from now), amp}
      this.chain = { on: 0, onT: 0, ph: 0, rate: 9 };
      this.drone = { level: 0, target: 0.25, ph: [0, 0, 0, 0] };
      this.buzz = { level: 0, target: 0, ph: new Float64Array(8), lfo: new Float64Array(8), lp: new Float64Array(8), bp: 0, bpl: 0, t: 0 };
      this.locust = { level: 0, target: 0, lp: 0, bp: 0, lp2: 0, bp2: 0, crk: 0, wph: 0,   // A9: the swarm of locusts
        bal: 0, balT: 0, lpR: 0, bpR: 0, w2: 0, w3: 0 };                                    // A10: which side, the right channel, more flutter
      this.flies = Array.from({ length: 6 }, () => ({ id: -1, amp: 0, ampT: 0, pan: 0, panT: 0, f: 19, fc: 800, ph: 0, lp: 0, bp: 0 }));   // A10: locusts going by
      this.env = { rain: 0, rainT: 0, drip: 0, creak: 0 };                                // B2
      this.rn = { a: 0, b: 0, c: 0, d: 0, tick: 0, tickR: 0 }; this.plinks = []; this.creaks = [];
      this.master = 0.8; this.muted = true;
    }
    rnd() { this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0; return this.seed / 4294967296; }
    clear() { this.roll.level = 0; this.knocks.length = 0; }
    /** speed m/s of your car, lift true while the chain pulls you, room 0..1 (how big the space is), bees 0..1 (how near the swarm) */
    setScene(speed, lift, room, bees = 0, locusts = 0, env = null) {
      if (env) { this.env.rainT = env.rain || 0; this.env.drip = env.drip || 0; this.env.creak = speed > 0.05 ? 1 : 0; }   // (B2)
      this.buzz.target = bees;
      if (typeof locusts === 'number') { this.locust.target = locusts; this.setFlies([]); }
      else { this.locust.target = locusts.level; this.locust.balT = locusts.bal; this.setFlies(locusts.flies); }
      this.roll.target = Math.min(1, 0.05 + speed * 0.55);
      this.roll.fcT = 70 + speed * 90;
      this.chain.onT = lift && speed > 0.05 ? 1 : 0; this.chain.rate = 6 + speed * 10;
      this.drone.target = 0.12 + 0.22 * room;
    }
    /** A10: the locusts going by: each keeps its voice while it is among the nearest */
    setFlies(list) {
      const F = this.flies;
      for (const v of F) if (!list.some((x) => x.id === v.id)) { v.ampT = 0; if (v.amp < 1e-3) v.id = -1; }
      for (const x of list) {
        let v = F.find((y) => y.id === x.id) || F.find((y) => y.id < 0) || null;
        if (!v) continue;
        if (v.id !== x.id) { v.id = x.id; v.amp = 0; v.pan = x.pan; v.ph = Math.random(); }
        v.ampT = Math.min(1, x.amp); v.panT = x.pan; v.f = x.f; v.fc = 800 * x.dop * (0.85 + 0.3 * ((x.id * 0.618) % 1));
      }
    }
    /** a rail joint under the front (and 1.2 m later the back) wheels */
    joint(speed) {
      if (speed < 0.05) return;
      const a = Math.min(1, 0.25 + speed * 0.4);
      this.knocks.push({ t: 0, amp: a, ph: 0 }, { t: 1.2 / Math.max(0.1, speed), amp: a * 0.8, ph: 0 });
    }
    /** A5: the lap bar locking: one heavy knock */
    clunk(amp) { this.knocks.push({ t: 0, amp, ph: 0 }); }
    /** n stereo samples, planar [L0..Ln-1, R0..Rn-1] */
    render(n) {
      const out = new Float32Array(2 * n), dt = 1 / SR, R = this.roll, C = this.chain, D = this.drone;
      const k = 1 - Math.exp(-dt / 0.25), kd = 1 - Math.exp(-dt / 2.5);
      const freqs = [55, 55.4, 82.4, 110.3];
      // the buzz: each tone's pitch wavers slowly (set once per block)
      const B = this.buzz, kb = 1 - Math.exp(-dt / 0.6), bf = new Float64Array(8), kf = 1 - Math.exp(-dt / 0.05);
      B.t += n * dt;
      for (let i = 0; i < 8; i++) bf[i] = (196 + 60 * (i + 0.5) / 8) * (1 + 0.03 * Math.sin(B.t * (0.31 + 0.11 * i) * 2 * Math.PI + i * 1.7));
      const Fb = 2 * Math.sin(Math.PI * 250 / SR), Fl = 1 - Math.exp(-2 * Math.PI * 1100 / SR);
      for (let s = 0; s < n; s++) {
        R.level += (R.target - R.level) * k; R.fc += (R.fcT - R.fc) * k;
        C.on += (C.onT - C.on) * k; D.level += (D.target - D.level) * kd;
        // rumble: two band-passes on noise (a low hum and a higher hiss of the wheels)
        const nz = this.rnd() * 2 - 1;
        const F = 2 * Math.sin(Math.PI * R.fc / SR), F2 = 2 * Math.sin(Math.PI * Math.min(3000, R.fc * 9) / SR);
        R.lp += F * R.bp; const hp = nz - R.lp - 0.7 * R.bp; R.bp += F * hp;
        R.lp2 += F2 * R.bp2; const hp2 = nz - R.lp2 - 1.2 * R.bp2; R.bp2 += F2 * hp2;
        let L = R.bp * R.level * 0.5 + R.bp2 * R.level * 0.04, Rr = L;
        // knocks: a damped low thud
        for (const kn of this.knocks) {
          if (kn.t > 0) { kn.t -= dt; continue; }
          kn.ph += dt;
          const e = Math.exp(-kn.ph * 38) * kn.amp;
          const v = (Math.sin(2 * Math.PI * 95 * kn.ph) + (this.rnd() - 0.5) * 0.6) * e * 0.45;
          L += v; Rr += v * 0.9;
        }
        // chain dog: a quick metallic tick at the chain rate
        if (C.on > 0.01) {
          C.ph += C.rate * dt; if (C.ph >= 1) C.ph -= 1;
          const e = Math.exp(-C.ph * 60);
          const v = (Math.sin(2 * Math.PI * 1900 * C.ph / C.rate) * 0.5 + (this.rnd() - 0.5)) * e * 0.22 * C.on;
          L += v; Rr += v;
        }
        // drone
        let dr = 0;
        for (let i = 0; i < 4; i++) { D.ph[i] += freqs[i] * dt; if (D.ph[i] >= 1) D.ph[i] -= 1; const p = D.ph[i]; dr += (Math.sin(2 * Math.PI * p) + 0.3 * Math.sin(4 * Math.PI * p) + 0.12 * Math.sin(6 * Math.PI * p)) * (i === 3 ? 0.35 : 1); }
        dr *= D.level * 0.09;
        // buzz: eight soft saws (low-passed) and the wings' rushing noise
        B.level += (B.target - B.level) * kb;
        if (B.level > 1e-4) {
          let bl = 0, br = 0;
          for (let i = 0; i < 8; i++) { B.ph[i] += bf[i] * dt; if (B.ph[i] >= 1) B.ph[i] -= 1; B.lp[i] += (2 * B.ph[i] - 1 - B.lp[i]) * Fl; if (i & 1) bl += B.lp[i]; else br += B.lp[i]; }
          B.bpl += Fb * B.bp; const hpb = (this.rnd() * 2 - 1) - B.bpl - 0.5 * B.bp; B.bp += Fb * hpb;
          const g = B.level * B.level * 0.06;
          L += (bl * 0.8 + br * 0.3 + B.bp * 2.2) * g; Rr += (br * 0.8 + bl * 0.3 + B.bp * 2.2) * g;
        }
        // A9: the locusts: a roar of massed wingbeats (low noise fluttering at ~18 Hz) under a dry crackling rustle (band-passed noise
        // struck by thousands of tiny clicks)
        const LO = this.locust;
        LO.level += (LO.target - LO.level) * kb;
        if (LO.level > 1e-4) {
          LO.wph += 18 * dt; if (LO.wph >= 1) LO.wph -= 1;
          const nz2 = this.rnd() * 2 - 1;
          const Fr = 2 * Math.sin(Math.PI * 320 / SR); LO.lp += Fr * LO.bp; const hpr = nz2 - LO.lp - 1.1 * LO.bp; LO.bp += Fr * hpr;
          if (this.rnd() < 900 / SR) LO.crk = 0.6 + this.rnd() * 0.8;
          LO.crk *= 0.995;
          const Fc = 2 * Math.sin(Math.PI * 3200 / SR); LO.lp2 += Fc * LO.bp2; const hpc = (this.rnd() * 2 - 1) - LO.lp2 - 0.9 * LO.bp2; LO.bp2 += Fc * hpc;
          LO.lpR += Fr * LO.bpR; const hrr = (this.rnd() * 2 - 1) - LO.lpR - 1.1 * LO.bpR; LO.bpR += Fr * hrr;   // (A10: the right ear's own)
          LO.w2 += 19.1 * dt; if (LO.w2 >= 1) LO.w2 -= 1; LO.w3 += 21.4 * dt; if (LO.w3 >= 1) LO.w3 -= 1;
          LO.bal += (LO.balT - LO.bal) * kb;
          const g = LO.level * LO.level, fl = 0.7 + 0.1 * (Math.sin(2 * Math.PI * LO.wph) + Math.sin(2 * Math.PI * LO.w2 + 1) + Math.sin(2 * Math.PI * LO.w3 + 2));
          const gl = Math.sqrt(1 - 0.7 * LO.bal), gr = Math.sqrt(1 + 0.7 * LO.bal);
          const crack = LO.bp2 * (0.25 + LO.crk) * 0.09 * g;
          L += (LO.bp * fl * 0.5 * g + crack * (0.6 + this.rnd() * 0.8)) * gl; Rr += (LO.bpR * fl * 0.5 * g + crack * (0.6 + this.rnd() * 0.8)) * gr;
        }
        // A10: the locusts going past your head: a whirring rattle (noise band-passed round 800 Hz, struck once a wingbeat), panned
        for (const v of this.flies) {
          if (v.id < 0 && v.amp < 1e-4) continue;
          v.amp += (v.ampT - v.amp) * kf; v.pan += (v.panT - v.pan) * kf;
          if (v.amp < 1e-4) continue;
          v.ph += v.f * dt; if (v.ph >= 1) v.ph -= 1;
          const Fv = 2 * Math.sin(Math.PI * v.fc / SR); v.lp += Fv * v.bp; const hv = (this.rnd() * 2 - 1) - v.lp - 0.7 * v.bp; v.bp += Fv * hv;
          const x = (v.bp * Math.exp(-v.ph * 6) * 0.9 + Math.sin(4 * Math.PI * v.ph) * 0.12) * v.amp * 0.55;
          const a = (v.pan + 1) * Math.PI / 4;
          L += x * Math.cos(a) * 1.41; Rr += x * Math.sin(a) * 1.41;
        }
        // B2: rain beyond the windows: a band of noise and a patter of drops (each ear its own)
        const E = this.env, RN = this.rn;
        E.rain += (E.rainT - E.rain) * kb;
        if (E.rain > 1e-4) {
          const n1 = this.rnd() * 2 - 1, n2 = this.rnd() * 2 - 1;
          RN.a += (n1 - RN.a) * 0.48; RN.b += (n1 - RN.b) * 0.05; RN.c += (n2 - RN.c) * 0.48; RN.d += (n2 - RN.d) * 0.05;
          if (this.rnd() < 160 / SR) { RN.tick = 0.4 + this.rnd() * 0.6; RN.tickR = this.rnd(); }
          RN.tick *= 0.985;
          const pat = RN.tick * (this.rnd() - 0.5);
          L += ((RN.a - RN.b) * 0.22 + pat * (1 - RN.tickR) * 0.5) * E.rain; Rr += ((RN.c - RN.d) * 0.22 + pat * RN.tickR * 0.5) * E.rain;
        }
        // B2: drips: a plink falling in pitch, and its echo
        if (E.drip > 0 && this.rnd() < E.drip * 0.7 / SR) {
          const f = 900 + this.rnd() * 1300, a = 0.05 + this.rnd() * 0.08, pan = this.rnd();
          this.plinks.push({ age: 0, f, a, pan, ph: 0 }, { age: -0.07 - this.rnd() * 0.06, f, a: a * 0.3, pan: 1 - pan, ph: 0 });
        }
        for (const q of this.plinks) {
          q.age += dt; if (q.age < 0) continue;
          q.ph += q.f * (1 + 0.6 * Math.exp(-q.age * 60)) * dt;
          const v = Math.sin(2 * Math.PI * q.ph) * Math.exp(-q.age * 32) * q.a;
          L += v * (1 - q.pan) * 1.4; Rr += v * q.pan * 1.4;
        }
        // B2: the car creaking: stick-slip clicks (30-70 a second) through a resonance, for half a second or so
        if (E.creak > 0 && this.rnd() < 0.22 / SR) this.creaks.push({ age: 0, dur: 0.25 + this.rnd() * 0.5, rate: 30 + this.rnd() * 40, F: 2 * Math.sin(Math.PI * (380 + this.rnd() * 600) / SR), a: 0.25 + this.rnd() * 0.3, ph: 0, lp: 0, bp: 0 });
        for (const c of this.creaks) {
          c.age += dt; if (c.age > c.dur + 0.1) continue;
          const env = Math.sin(Math.PI * Math.min(1, c.age / c.dur)), rate = c.rate * (1 + 0.4 * Math.sin(c.age * 9));
          c.ph += rate * dt; let x = 0; if (c.ph >= 1) { c.ph -= 1; x = (0.6 + this.rnd() * 0.4) * env; }
          c.lp += c.F * c.bp; const hp = x - c.lp - 0.08 * c.bp; c.bp += c.F * hp;
          const v = c.bp * c.a * 0.5; L += v; Rr += v * 0.85;
        }
        out[s] = L + dr * 1.05; out[n + s] = Rr + dr * 0.95;
      }
      this.knocks = this.knocks.filter(kn => kn.t > 0 || kn.ph < 0.15);
      if (this.plinks.length) this.plinks = this.plinks.filter(q => q.age < 0.25);
      if (this.creaks.length) this.creaks = this.creaks.filter(c => c.age < c.dur + 0.1);
      const m = this.muted ? 0 : this.master;
      for (let i = 0; i < 2 * n; i++) out[i] = Math.tanh(out[i] * m * 1.4);
      return out;
    }
  }

  /** speakers: real-time pull when live; a queue fed by the movie frames while recording (from CT55.A7) */
  class Speaker {
    constructor(synth) { this.synth = synth; this.ctx = null; this.mode = 'live'; this.q = []; this.qLen = 0; this.qOff = 0; }
    get running() { return !!this.ctx && this.ctx.state === 'running'; }
    start() {
      if (this.ctx) { if (this.ctx.state !== 'running') this.ctx.resume(); return; }
      const AC = global.AudioContext || global.webkitAudioContext; if (!AC) return;
      try { this.ctx = new AC({ sampleRate: SR }); } catch { this.ctx = new AC(); }
      const node = this.ctx.createScriptProcessor(1024, 0, 2);
      node.onaudioprocess = (e) => {
        const L = e.outputBuffer.getChannelData(0), R = e.outputBuffer.getChannelData(1), n = L.length;
        if (this.mode === 'live') { const b = this.synth.render(n); L.set(b.subarray(0, n)); R.set(b.subarray(n)); return; }
        let w = 0;
        while (w < n && this.q.length) {
          const b = this.q[0], bn = b.length / 2, take = Math.min(n - w, bn - this.qOff);
          L.set(b.subarray(this.qOff, this.qOff + take), w); R.set(b.subarray(bn + this.qOff, bn + this.qOff + take), w);
          w += take; this.qOff += take; this.qLen -= take;
          if (this.qOff >= bn) { this.q.shift(); this.qOff = 0; }
        }
        for (; w < n; w++) { L[w] = 0; R[w] = 0; }
      };
      node.connect(this.ctx.destination);
      this.node = node;
      if (this.ctx.state !== 'running') this.ctx.resume();
    }
    /** B5: silence: suspend (the page is hidden) or close for good (the page is going away) */
    suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend(); }
    stop() { if (!this.ctx) return; try { if (this.node) { this.node.onaudioprocess = null; this.node.disconnect(); } this.ctx.close(); } catch (e) { /* already closed */ } this.ctx = null; this.node = null; }
    setMode(m) { this.mode = m; this.q.length = 0; this.qLen = 0; this.qOff = 0; }
    feed(buf) {
      if (this.mode !== 'film' || !this.running) return;
      this.q.push(buf); this.qLen += buf.length / 2;
      while (this.qLen > SR * 0.35 && this.q.length > 1) { const b = this.q.shift(); this.qLen -= b.length / 2 - this.qOff; this.qOff = 0; }
    }
  }

  global.CT61Sound = { SR, Synth, Speaker };
})(window);
