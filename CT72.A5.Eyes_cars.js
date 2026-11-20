/* CT61.B6.Darkride -- the mine cars (B6: split out of B5's ride.js unchanged).  window.CT61Cars = { CAR_LEN, POD, BAR_UP, carParts, makeCarFactory }. */
(function () {
  'use strict';
  const { T, rng, merge } = CT61Core;
  // ------------------------------------------------------------------ the cars
  const CAR_LEN = 1.95;
  // B1: a MINE CAR.  A rusty riveted iron tub, flared toward the top, on a timber-and-iron underframe with four flanged wheels that run on
  // the rails, a coupler and a wooden buffer at each end, a plank bench across the inside.  No lap bar; the car does not turn (the
  // pieces' faces turn your head instead, main.js).  Car frame: +x ahead, +y up, +z right.
  const TUB = { y0: 0.46, y1: 1.02, l0: 0.74, w0: 0.44, l1: 0.86, w1: 0.53 };
  const WHEEL_R = 0.17;
  const POD = { seat: [-0.12, 1.45, 0] };   // (CT72.A5: 1.45, was 1.55, so the rim of your car shows at the bottom of the picture)
  const BAR_UP = 0;
  /** B2: one of three old cars (v = 0, 1, 2): the tub dented in (a grid per side, pushed in by a few dents, never at its edges), the rim
   *  bent, a strap gone, the bench broken, a floor board missing */
  function carParts(v = 0) {
    const parts = {}, RV = rng(4711 + v * 977);
    const { y0, y1, l0, w0, l1, w1 } = TUB;
    // the tub: four flared sides and a bottom, open at the top (a thin shell, drawn both sides)
    {
      const B = [[l0, y0, w0], [-l0, y0, w0], [-l0, y0, -w0], [l0, y0, -w0]], Tp = [[l1, y1, w1], [-l1, y1, w1], [-l1, y1, -w1], [l1, y1, -w1]];
      const pos = [], uv = [], ind = [];
      const NU = 16, NV = 7;
      for (let k = 0; k < 4; k++) {
        const j = (k + 1) % 4, a = Tp[k], b = Tp[j], c = B[k], d = B[j], ua = k % 2 ? 2 * w1 : 2 * l1, va = y1 - y0;
        const out = k % 2 ? [Math.sign(a[0]), 0, 0] : [0, 0, Math.sign(a[2])];
        const dents = []; for (let q = 0, nq = 1 + Math.floor(RV() * 3); q < nq; q++) dents.push([0.15 + RV() * 0.7, 0.2 + RV() * 0.7, 0.07 + RV() * 0.12, 0.012 + RV() * 0.03]);
        const base = pos.length / 3;
        for (let iu = 0; iu <= NU; iu++) for (let iv = 0; iv <= NV; iv++) {
          const u = iu / NU, w = iv / NV, P = [0, 1, 2].map(e => (c[e] + (d[e] - c[e]) * u) * (1 - w) + (a[e] + (b[e] - a[e]) * u) * w);
          let dd = 0; for (const [cu, cv, r, dp] of dents) { const du = (u - cu) * ua, dv = (w - cv) * va; dd += dp * Math.exp(-(du * du + dv * dv) / (r * r)); }
          dd *= Math.sin(Math.PI * u) * Math.sin(Math.PI * Math.min(1, w * 1.15));
          pos.push(P[0] - out[0] * dd, P[1], P[2] - out[2] * dd); uv.push(u * ua / 1.2, w * va / 1.2);
        }
        for (let iu = 0; iu < NU; iu++) for (let iv = 0; iv < NV; iv++) { const q = base + iu * (NV + 1) + iv, r = q + NV + 1; ind.push(q, r, q + 1, q + 1, r, r + 1); }
      }
      const o = pos.length / 3;
      for (const [p, q] of [[B[0], [0, 0]], [B[1], [1.5, 0]], [B[2], [1.5, 0.9]], [B[3], [0, 0.9]]]) { pos.push(...p); uv.push(q[0], q[1]); }
      ind.push(o, o + 1, o + 2, o, o + 2, o + 3);
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(ind);
      g.computeVertexNormals();
      parts.tub = g;
    }
    // angle iron round the rim, and iron straps up the sides (following the flare)
    const box = (w, h, d, x, y, z, rx = 0, rz = 0) => { const g = new T.BoxGeometry(w, h, d); if (rx) g.rotateX(rx); if (rz) g.rotateZ(rz); g.translate(x, y, z); return g; };
    const fz = Math.atan2(w1 - w0, y1 - y0), fx = Math.atan2(l1 - l0, y1 - y0), ym = (y0 + y1) / 2, hs = Math.hypot(y1 - y0, w1 - w0) + 0.02;
    const bend = (0.04 + RV() * 0.05) * (RV() < 0.5 ? -1 : 1);      // (B2) one side of the rim knocked out of true
    parts.iron = [
      box(2 * l1 + 0.08, 0.05, 0.07, 0, y1 - Math.abs(bend) * 0.4, w1, bend, 0), box(2 * l1 + 0.08, 0.05, 0.07, 0, y1, -w1),
      box(0.07, 0.05, 2 * w1 + 0.08, l1, y1, 0, 0, v === 1 ? 0.06 : 0), box(0.07, 0.05, 2 * w1 + 0.08, -l1, y1, 0),
      ...[-0.45, 0.45].flatMap((x, k) => [...(v === 2 && k === 0 ? [] : [box(0.08, hs, 0.025, x, ym, (w0 + w1) / 2 + 0.012, fz)]), box(0.08, hs, 0.025, x, ym, -(w0 + w1) / 2 - 0.012, -fz)]),
      ...[-0.22, 0.22].flatMap(z => [box(0.025, hs, 0.08, (l0 + l1) / 2 + 0.012, ym, z, 0, -fx), box(0.025, hs, 0.08, -(l0 + l1) / 2 - 0.012, ym, z, 0, fx)]),
      // the underframe: two iron sole bars, the axle guards
      box(1.72, 0.1, 0.08, 0, y0 - 0.06, 0.3), box(1.72, 0.1, 0.08, 0, y0 - 0.06, -0.3),
      ...[-0.55, 0.55].flatMap(x => [box(0.12, 0.16, 0.05, x, WHEEL_R + 0.12, 0.52), box(0.12, 0.16, 0.05, x, WHEEL_R + 0.12, -0.52)]),
      // couplers: a drawbar and a link at each end
      box(0.24, 0.06, 0.06, 1.0, y0 - 0.02, 0), box(0.24, 0.06, 0.06, -1.0, y0 - 0.02, 0),
    ];
    for (const x of [1.13, -1.13]) { const k = new T.TorusGeometry(0.05, 0.012, 6, 14); k.rotateX(Math.PI / 2); k.translate(x, y0 - 0.02, 0); parts.iron.push(k); }
    parts.wood = [box(0.08, 0.16, 0.62, 0.9, y0 - 0.02, 0), box(0.08, 0.16, 0.62, -0.9, y0 - 0.02, 0),       // buffers
      ...(v === 1 ? [box(0.3, 0.05, 0.84, -0.38, 0.66, 0, 0.16), box(0.06, 0.24, 0.06, -0.38, 0.59, 0.3), box(0.06, 0.1, 0.06, -0.38, 0.52, -0.3)]   // (B2) a leg gone, the bench down on that side
        : [box(0.3, 0.05, 0.84, -0.38, 0.72, 0, (RV() - 0.5) * 0.04), box(0.06, 0.24, 0.06, -0.38, 0.59, 0.3), box(0.06, 0.24, 0.06, -0.38, 0.59, -0.3)]),   // the bench and its legs
      ...[-0.3, -0.1, 0.1, 0.3].filter((z, k) => k !== (v + 1) % 4).map(z => box(1.4 - RV() * 0.25, 0.03, 0.18, (RV() - 0.5) * 0.1, y0 + 0.02, z, 0, (RV() - 0.5) * 0.03))];   // floor boards, one gone
    // a wheel: a disc with a flange on its inner side and a hub; spins about z
    // (one geometry per side: the flange on the inner side)
    for (const sd of [1, -1]) {
      const wh = new T.CylinderGeometry(WHEEL_R, WHEEL_R, 0.06, 22); wh.rotateX(Math.PI / 2);
      const fl = new T.CylinderGeometry(WHEEL_R + 0.03, WHEEL_R + 0.03, 0.015, 22); fl.rotateX(Math.PI / 2); fl.translate(0, 0, -sd * 0.035);
      const sp = [0, 1, 2].filter(k => !(v === 2 && sd > 0 && k === 1)).map(k => {   /* (B2) a spoke broken off one wheel */ const b = new T.BoxGeometry(2 * WHEEL_R * 0.9, 0.03, 0.07); b.rotateZ(k * Math.PI / 3); b.translate(0, 0, sd * 0.032); return b; });
      parts[sd > 0 ? 'wheelR' : 'wheelL'] = merge([wh, fl, ...sp]);
    }
    for (const x of [-0.55, 0.55]) { const a = new T.CylinderGeometry(0.03, 0.03, 1.08, 10); a.rotateX(Math.PI / 2); a.translate(x, WHEEL_R + 0.1, 0); parts.iron.push(a); }
    parts.iron = merge(parts.iron); parts.wood = merge(parts.wood);
    return parts;
  }
  const CAR_COLORS = [0xe0b49a, 0xc88a74, 0xa8b098, 0x9a948c, 0xd0b088];     // (B1) tints on the rust: bare, old red paint, old green, black iron, ochre (B2: duller)
  function makeCarFactory(getTex) {
    const PV = [0, 1, 2].map(v => carParts(v));
    const rustTex = getTex('rust'), planks = getTex('planks');
    const mats = {
      iron: new T.MeshStandardMaterial({ color: 0x6a5a4c, map: rustTex, bumpMap: rustTex, bumpScale: 1.2, metalness: 0.2, roughness: 0.85 }),
      dark: new T.MeshStandardMaterial({ color: 0x4a3e36, map: rustTex, metalness: 0.25, roughness: 0.8 }),
      wood: new T.MeshStandardMaterial({ map: planks, bumpMap: planks, bumpScale: 1.5, color: 0x8a7a66, roughness: 1 }),
    };
    const bodies = CAR_COLORS.map(c => new T.MeshStandardMaterial({ color: c, map: rustTex, bumpMap: rustTex, bumpScale: 2.2, metalness: 0.1, roughness: 0.9, side: T.DoubleSide }));   // (B2: rust is not metal)
    function make(i, num) {
      const g = new T.Group(), body = bodies[i % bodies.length], P = PV[(i * 7) % 3];
      const add = (parent, geo, mat, x = 0, y = 0, z = 0) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
      const pod = new T.Group(); g.add(pod);           // (main.js still knows the car's body as its pod; it no longer turns)
      add(pod, P.tub, body);
      add(pod, P.iron, mats.iron); add(pod, P.wood, mats.wood);
      const wheels = [];
      for (const x of [-0.55, 0.55]) {
        for (const z of [-0.42, 0.42]) {
          const w = new T.Group(); w.position.set(x, WHEEL_R + 0.1, z); pod.add(w);
          add(w, z > 0 ? P.wheelR : P.wheelL, mats.dark);
          wheels.push(w);
        }
      }
      g.userData.num = num; g.userData.pod = pod; g.userData.bar = null; g.userData.wheels = wheels; g.userData.wheelR = WHEEL_R;
      return g;
    }
    return { make, mats };
  }
  window.CT61Cars = { CAR_LEN, POD, BAR_UP, TUB, WHEEL_R, carParts, makeCarFactory };
})();
