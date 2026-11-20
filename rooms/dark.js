/* CT72.A5.Eyes room module -- the short way in to the room of eyes and the darkness after it.
 * In place of CT61's entry way (rooms/station.js), so main.js still finds a dispatch point and the end of the ride:
 *   head (put first in the ride):  'start'  -- a short rock tunnel; you start (the dispatch point) just short of the room's portal, so the
 *                                              first picture is the track running into the room, the eyes filling the frame.
 *                                              (A1 started 12 m back in a black tunnel: the room was a postage stamp.)
 *   tail (put right after the room):  'darkA'  -- the tunnel on the far side of the room, no lanterns, no work light (zone 'dark').
 *                                              A2: not blank -- a few pairs of faint glowing eyes open in the walls and follow you; the
 *                                              ride ends 8 m in (endS), with the room still glowing behind you.  (A1 rode 26 m of pure
 *                                              black, half the ride: "the app seems to go blank halfway through".)
 * The rest of the loop (plain tunnels in RIDE, zone 'dark') is never ridden; it only closes the track.
 */
(function () {
  'use strict';
  const ROOMS = window.CT61Rooms = window.CT61Rooms || {};
  const tun = (o) => Object.assign({ kind: 'S', hw: 1.3, h: 2.9, speed: 0.6, floor: 'dirt', wall: 'rock', ceil: 'rock' }, o);
  const A_LEN = 4, B_LEN = 7, END_IN_B = 5.5;     // CT72.A4: 4 m straight, a right-hand corner, 7 m straight; the ride ends 5.5 m into the last one
  ROOMS.dark = {
    title: 'the way in and the darkness',
    zones: { approach: 'the way in', dark: 'the darkness' },
    pieces: () => [tun({ id: 'start', len: 5, zone: 'approach', speed: 1.05, noLanterns: true, noDebris: true })],
    tailPieces: () => [tun({ id: 'darkA', len: A_LEN, zone: 'dark', speed: 1.05, noLanterns: true }),
      tun({ id: 'darkTurn', kind: 'T', ang: -90, r: 4.5, zone: 'dark', speed: 1.05, noLanterns: true }),
      tun({ id: 'darkB', len: B_LEN, zone: 'dark', speed: 1.05, noLanterns: true })],
    async build(ctx) {
      const { T, P, path, specs, glows, group } = ctx;
      const st = P.start;
      // one dim lantern by the start, so the timber and the track nearest you are not black
      const s = st.s0 + 3.0, f = path.frame(s);
      specs.push({ s, kind: 'lamp', pos: f.p.clone().addScaledVector(f.l, 0.7).add(new T.Vector3(0, 2.1, 0)), target: f.p.clone().addScaledVector(f.t, 4),
        color: new T.Color(1, 0.66, 0.36), intensity: 10, angle: 1.0, penumbra: 0.8, distance: 8, near: 0.15, map: null, name: 'start lantern' });
      glows.push([f.p.clone().addScaledVector(f.l, 0.7).add(new T.Vector3(0, 2.15, 0)), 0xffb060, 0.3]);

      // A2: eyes in the dark -- pairs of eyeballs (the room's eye pictures, glowing faintly, unlit) just off the tunnel walls; they open as
      // you come near, blink now and then, and turn to follow you
      const dk = P.darkA, dB = P.darkB, endS = dB.s0 + END_IN_B, pairs = [], R = ((a) => () => ((a = (a * 16807) % 2147483647) - 1) / 2147483646)(7272);
      const geo = new T.SphereGeometry(1, 24, 16), P0 = geo.attributes.position, uv = geo.attributes.uv;
      for (let i = 0; i < P0.count; i++) {        // (as rooms/eyes.js: the picture is the eye seen from the front, +z)
        const x = P0.getX(i), y = P0.getY(i), z = P0.getZ(i), q = Math.hypot(x, y), r = Math.acos(Math.max(-1, Math.min(1, z))) / Math.PI * 0.5;
        uv.setXY(i, q > 1e-6 ? 0.5 + x / q * r : 0.5, q > 1e-6 ? 0.5 + y / q * r : 0.5);
      }
      const tex = ctx.A.eyes.map(e => { const t = new T.Texture(e.img); t.colorSpace = T.SRGBColorSpace; t.needsUpdate = true; return t; });
      const NE = 28, gapS = (dB.s1 - 0.3 - (dk.s0 + 0.8)) / NE;      // (A4: spread over the straight, the corner and the last straight; A5: on to the end of it, so there are eyes ahead where the ride stops)
      for (let i = 0; i < NE; i++) {
        const sAt = dk.s0 + 0.8 + i * gapS + R() * gapS * 0.9, fr = path.frame(sAt), side = i % 2 ? 1 : -1;
        const r = 0.07 + R() * 0.07, up = 0.6 + R() * 1.3, gap = r * 2.5;
        // (A3: well clear of the rock and the timber sets, so no black rock cuts across them; A2 had hw - 0.3, up to 2.4 m)
        const base = fr.p.clone().addScaledVector(fr.l, side * (dk.hw - 0.6)).add(new T.Vector3(0, up, 0));
        const mat = new T.MeshBasicMaterial({ map: tex[i % tex.length], color: 0x000000, transparent: true, opacity: 1, fog: false });
        const pr = { mat, eyes: [], open: 0, ph: R() * 10, blink: 2.5 + R() * 4, glow: 0.55 + R() * 0.35 };
        for (const k of [-1, 1]) {
          const m = new T.Mesh(geo, mat); m.position.copy(base).addScaledVector(fr.t, k * gap / 2); m.scale.setScalar(r); group.add(m);
          pr.eyes.push(m);
        }
        pairs.push(pr);
      }
      return {
        endS,                                      // where the ride ends
        // CT72.A4: after the corner (the start of the last straight) the picture fades to black, to full black where the ride stops
        fadeAt(u) { const s = path.wrap(u), x = Math.min(1, Math.max(0, (s - dB.s0) / (endS - dB.s0))); return x * x * (3 - 2 * x); },
        update(t, dt, cam) {
          for (const pr of pairs) {
            // they open as you come near and stay open; each blinks now and then (a quick dim)
            const dist = cam.position.distanceTo(pr.eyes[0].position);
            if (dist < 10) pr.open += (1 - pr.open) * (1 - Math.exp(-dt * 1.2));     // (A4: and they do not close again behind you)
            const g = pr.glow * pr.open;                    // (A4: no blinking: once open they stay open, steady)
            pr.mat.color.setRGB(g, g, g);
            for (const m of pr.eyes) m.lookAt(cam.position);       // (Object3D.lookAt aims +z, the iris, at you)
          }
        },
      };
    },
    stops: (ctx) => [{ s: ctx.P.start.s0 + 3.5, kind: 'dispatch', name: 'start' }],
  };
})();
