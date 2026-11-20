/* CT61.B6.Darkride room module -- the room of eyes.
 * B6 (from A1-B1's eye room): a chamber cut in the rock round an S-curve, full of giant eyeballs (the pictures images\eyeballs) hanging on
 * cords from the roof at different heights, and more half sunk in the rock walls; and on the floor, all round the track, a layer of
 * hundreds of small eyes half buried in the dirt, looking up.  Every eye follows your car as you pass (a little lag, an occasional dart);
 * E (Eyes) makes them look away.  Lit as in A2: two green uplights by the walls, a red light down over the track, and a dim light on the
 * floor.  Options (URL): ?flooreyes=600 (0 = none, up to 3000).
 *
 * CT72.A4: eyes keep clear of the timber (a wall eye cut by the far door's frame was the black angular shape); speeds x1.5; the eye
 * spheres are coarser (big 40 x 30, floor 14 x 10; was 64 x 48 and 24 x 18) to save the frame rate.
 * CT72.A3: a bigger room (the S-curve r 7 m, 55 deg each way, was r 5, 50 deg: about 13 m of track, was 9), 18 hanging eyes (as before;
 * a first A2 try had 30), 10 in the walls (was 6), and 600 small floor eyes (as before; a first A2 try had 4000, too many).  About one floor eye in three
 * tracks you, plainly (?trackers=0.33); the rest lie looking up, drifting a little.
 */
(function () {
  'use strict';
  const ROOMS = window.CT61Rooms = window.CT61Rooms || {};
  ROOMS.eyes = {
    title: 'the room of eyes',
    zones: { eyes: 'the room of eyes' },
    pieces: () => [
      { id: 'eyesIn', kind: 'S', len: 2.5, hw: 1.5, h: 3.0, speed: 1.15, zone: 'corner', floor: 'dirt', wall: 'rock', ceil: 'rock' },
      { id: 'eyesA', kind: 'T', ang: -55, r: 7, speed: 0.95, zone: 'eyes', room: true, gaze: -14, face: [[0, 45], [0.55, -40]] },
      { id: 'eyesB', kind: 'T', ang: 55, r: 7, speed: 0.95, zone: 'eyes', room: true, gaze: -14, face: [[0.15, 50], [0.6, -50], [0.92, 0]] },
    ],
    async build(ctx, inst) {
      const { T, C, group, path, put, MAT, specs, A, opts, next } = ctx;
      const { clamp, rng, UP, frameBox, rockPanel, portal, springOf } = C;
      const [pIn, a, b] = inst.pieces, out = next(b);
      const f0 = path.frame(a.s0), f1 = path.frame(b.s1);
      const loc = (v) => { const r = v.clone().sub(f0.p); return [r.dot(f0.t), r.dot(f0.l)]; };
      const [A1, B1] = loc(f1.p);                                // the far door: forward A1, lateral B1 (+ = left)
      const bL = Math.max(0, B1) + 4.0, bR = Math.min(0, B1) - 4.0, H = 6.0;
      const W = (fa, fb, up = 0) => f0.p.clone().addScaledVector(f0.t, fa).addScaledVector(f0.l, fb).addScaledVector(UP, up);
      const RA = 0.4;
      // the chamber: a dirt floor, rough rock walls and roof, timber-framed portals at both ends
      put('dirt', frameBox(W(A1 / 2, (bL + bR) / 2), f0.l, f0.t, 0, -0.05, 0, bL - bR + 1.4, 0.1, A1 + 1.4));
      put('rock', rockPanel(W(0, 0, H), f0.t, f0.l, UP.clone().negate(), -0.5, A1 + 0.5, bR - 0.5, bL + 0.5, RA, 0.3));
      put('rock', rockPanel(W(0, bL), f0.t, UP, f0.l.clone().negate(), -0.5, A1 + 0.5, -0.05, H + 0.4, RA, 0.28));
      put('rock', rockPanel(W(0, bR), f0.t, UP, f0.l.clone(), -0.5, A1 + 0.5, -0.05, H + 0.4, RA, 0.28));
      for (const q of portal(W(0, 0), f0.l, f0.t, 1, 0, pIn.hw, springOf(pIn), bR - 0.5, bL + 0.5, H + 0.4, RA)) put(q.key, q.geo);
      for (const q of portal(W(A1, 0), f0.l, f0.t, -1, B1, out.hw, springOf(out), bR - 0.5, bL + 0.5, H + 0.4, RA)) put(q.key, q.geo);
      // a few timber props holding the roof up, clear of the track
      const trk = []; for (let s = a.s0 - 1; s <= b.s1 + 1; s += 0.2) trk.push(loc(path.frame(s).p));
      const clearBy = (fa, fb) => Math.sqrt(trk.reduce((m, [x, y]) => Math.min(m, (x - fa) ** 2 + (y - fb) ** 2), 1e9));
      const R = rng(6161);
      const props = [];
      for (const [fa, fb] of [[1.2, bL - 0.5], [A1 - 1.0, bR + 0.5], [A1 * 0.5, bL - 0.4], [A1 * 0.35, bR + 0.4]]) {
        if (clearBy(fa, fb) < 1.4) continue;
        put('timber', frameBox(W(fa, fb), f0.l, f0.t, 0, H / 2, 0, 0.22, H, 0.22, 1)); props.push([fa, fb]);
      }
      // CT72.A4: an eye must clear the timber: the two portals (the frame is at fa = 0 and fa = A1) and the props.  (A3: eyes sunk in the wall
      // near the far door, and one beside a prop, were cut by the unlit timber into black angular shapes: "a hexagonal black obstruction".)
      const PORTAL = 0.9, GAP = 0.35;
      const clearOfTimber = (fa, fb, r, wall) => fa >= r + PORTAL && fa <= A1 - r - PORTAL && props.every(([pa, pb]) => (wall && Math.abs(pb - fb) > 1.0) || Math.hypot(pa - fa, pb - fb) > r + GAP + 0.11);

      // ---------------- the eyes
      const eyeTex = A.eyes.map(e => { const t = new T.Texture(e.img); t.colorSpace = T.SRGBColorSpace; t.needsUpdate = true; t.anisotropy = 8; return t; });
      /** a whole eyeball: the picture is its surface seen from the front (+z), equidistant (texture radius 0.5 = the back pole) */
      const eyeGeo = (ws, hs) => {
        const g = new T.SphereGeometry(1, ws, hs), P0 = g.attributes.position, uv = g.attributes.uv;
        for (let i = 0; i < P0.count; i++) {
          const x = P0.getX(i), y = P0.getY(i), z = P0.getZ(i), q = Math.hypot(x, y), r = Math.acos(clamp(z, -1, 1)) / Math.PI * 0.5;
          uv.setXY(i, q > 1e-6 ? 0.5 + x / q * r : 0.5, q > 1e-6 ? 0.5 + y / q * r : 0.5);
        }
        return g;
      };
      const bigGeo = eyeGeo(40, 30), eyeMats = eyeTex.map(t => new T.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.16, roughness: 0.25 }));
      const eyes = [];
      const addEye = (c, r, which, n) => {
        const m = new T.Mesh(bigGeo, eyeMats[which]); m.position.copy(c); m.scale.setScalar(r); m.castShadow = true; group.add(m);
        eyes.push({ m, rest: (n || f0.t.clone().negate()).clone(), wall: !!n, dart: new T.Vector3(), nextDart: R() * 3, r, rate: 3 + R() * 4 });
      };
      // hanging from the roof on cords, at different heights: the big ones high, the ones you could touch kept off the track
      let nh = 0;
      for (let tries = 0; tries < 3000 && nh < 18; tries++) {
        const r = 0.22 + R() * R() * 0.6, fa = r + PORTAL + R() * Math.max(0.1, A1 - 2 * (r + PORTAL)), fb = bR + 0.9 + R() * (bL - bR - 1.8), up = 1.3 + R() * (H - 2.3 - r);
        const cl = clearBy(fa, fb), low = up - r < 2.7;
        if (!clearOfTimber(fa, fb, r, false) || cl < (low ? r + 1.25 : r + 0.25) || eyes.some(e => e.m.position.distanceTo(W(fa, fb, up)) < e.r + r + 0.5)) continue;
        const c = W(fa, fb, up); addEye(c, r, nh % 2, null); nh++;
        const cord = new T.Mesh(new T.CylinderGeometry(0.012, 0.012, H - up - r, 5), MAT.channel); cord.position.copy(c).add(new T.Vector3(0, r + (H - up - r) / 2, 0)); group.add(cord);
      }
      // half sunk in the walls (A2: no socket ring)
      for (const [fa0, fb, up, r, which] of [[1.6, bL, 2.4, 0.75, 0], [5.0, bL, 3.6, 1.1, 1], [7.6, bL, 1.5, 0.5, 0], [2.2, bR, 3.1, 0.9, 1], [5.4, bR, 1.6, 0.6, 0], [7.8, bR, 3.8, 1.2, 1],
          [10.2, bL, 2.8, 0.85, 1], [12.0, bL, 1.4, 0.45, 0], [10.0, bR, 2.2, 0.7, 0], [12.2, bR, 3.4, 1.0, 1]]) {
        let fa = null;                                             // (A2: spread along the longer room)
        for (const dx of [0, -0.7, 0.7, -1.4, 1.4, -2.1, 2.1]) { const c = fa0 * A1 / 13 + dx; if (clearOfTimber(c, fb, r, true)) { fa = c; break; } }
        if (fa == null) continue;
        const n = fb === bL ? f0.l.clone().negate() : f0.l.clone();
        addEye(W(fa, fb, up).addScaledVector(n, r * 0.45 - RA * 0.3), r, which, n);
      }
      // the floor: hundreds of small eyes half buried in the dirt, looking up (two InstancedMeshes, one per picture); clear of the car
      const NF = clamp(opts.floorEyes != null ? opts.floorEyes : 600, 0, 10000), floor = [], TRK = clamp(opts.trackers != null ? opts.trackers : 0.33, 0, 1);
      for (let tries = 0; tries < NF * 12 && floor.length < NF; tries++) {
        const fa = -0.2 + R() * (A1 + 0.4), fb = bR + 0.35 + R() * (bL - bR - 0.7), r = 0.04 + R() * R() * 0.11;
        if (clearBy(fa, fb) < 0.8 + r) continue;
        floor.push({ p: W(fa, fb, r * 0.3 - 0.01), r, q: new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 0, 1), new T.Vector3((R() - 0.5) * 0.6, 1, (R() - 0.5) * 0.6).normalize()),
          rate: 2 + R() * 6, ph: R() * 100, k: floor.length % 2, trk: R() < TRK });
        const e = floor[floor.length - 1]; e.up = new T.Vector3(0, 0, 1).applyQuaternion(e.q);       // (A2: where a still one looks)
      }
      const floorMats = eyeTex.map(t => new T.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.3, roughness: 0.2 }));
      const smallGeo = eyeGeo(14, 10), fims = [0, 1].map(k => {
        const n = floor.filter(e => e.k === k).length, im = new T.InstancedMesh(smallGeo, floorMats[k], Math.max(1, n));
        im.count = n; im.instanceMatrix.setUsage(T.DynamicDrawUsage); im.receiveShadow = true; group.add(im); return im;
      });
      const Mx = new T.Matrix4(), Z = new T.Vector3(0, 0, 1), sc = new T.Vector3(), tq = new T.Quaternion(), dv = new T.Vector3(), ctr = W(A1 / 2, (bL + bR) / 2, 1);
      const writeFloor = () => {
        const ii = [0, 0];
        for (const e of floor) fims[e.k].setMatrixAt(ii[e.k]++, Mx.compose(e.p, e.q, sc.setScalar(e.r)));
        for (const im of fims) im.instanceMatrix.needsUpdate = true;
      };
      writeFloor();

      // ---------------- the light (A2's colours): two green uplights by the walls, a red light down over the track, a dim one on the floor
      const mid = (a.s0 + b.s1) / 2;
      specs.push({ s: mid - 2, kind: 'lamp', pos: W(1.0, bL - 0.4, 0.2), target: W(5.5, bL, 3.5), color: new T.Color(0.45, 1, 0.4), intensity: 90, angle: 0.65, penumbra: 0.5, distance: 12, map: null, name: 'eye room left' });
      specs.push({ s: mid + 1, kind: 'lamp', pos: W(2.0, bR + 0.4, 0.2), target: W(7.2, bR, 3.4), color: new T.Color(0.45, 1, 0.4), intensity: 90, angle: 0.6, penumbra: 0.5, distance: 12, map: null, name: 'eye room right' });
      specs.push({ s: mid, kind: 'lamp', pos: W(A1 / 2, B1 / 2, H - 0.2), target: W(A1 / 2 + 0.5, B1 / 2, 0), color: new T.Color(1, 0.22, 0.18), intensity: 100, angle: 0.75, penumbra: 0.6, distance: 10, map: null, name: 'eye room red' });
      specs.push({ s: mid - 0.5, kind: 'lamp', flick: 0.04, pos: W(A1 * 0.3, (bL + bR) / 2, H - 0.3), target: W(A1 * 0.6, (bL + bR) / 2, 0), color: new T.Color(0.85, 0.8, 0.7), intensity: 40, angle: 1.3, penumbra: 0.9, distance: 12, map: null, name: 'eye room floor' });

      // ---------------- every frame: the eyes follow the camera (a little lag, now and then a dart), or wander when it is far away
      const tmpV = new T.Vector3(), tmpQ = new T.Quaternion(), tmpM = new T.Matrix4();
      let rest = false;
      return { eyes, floor,
        update(t, dt, cam, S) {
          for (const e of eyes) {
            const d = tmpV.copy(cam.position).sub(e.m.position), dist = d.length();
            e.nextDart -= dt;
            if (e.nextDart < 0) { e.nextDart = 0.6 + Math.random() * 3; e.dart.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(dist < 14 ? 0.5 : 6); }
            let look;
            if (!S.eyes || dist > 16) look = e.rest.clone().multiplyScalar(4).add(e.dart.clone().multiplyScalar(0.3)).normalize();
            else look = d.normalize().multiplyScalar(dist).addScaledVector(e.dart, 0.25).normalize();
            if (e.wall) { const an = look.angleTo(e.rest); if (an > 1.22) { const ax = tmpV.crossVectors(e.rest, look).normalize(); look = e.rest.clone().applyAxisAngle(ax, 1.22); } }
            tmpM.lookAt(new T.Vector3(), look.negate(), UP);          // (Matrix4.lookAt points -z at the target: aim +z, the iris, at it)
            tmpQ.setFromRotationMatrix(tmpM);
            e.m.quaternion.slerp(tmpQ, 1 - Math.exp(-dt * (S.eyes ? e.rate : 1)));
          }
          // the floor eyes: only while you are near (they are still otherwise)
          const near = cam.position.distanceTo(ctr) < 22;
          if (!near) { if (!rest) { rest = true; } return; }
          rest = false;
          for (const e of floor) {
            dv.copy(cam.position).sub(e.p);
            if (!e.trk) dv.copy(e.up).multiplyScalar(3).add(tmpV.set(Math.sin(t * 0.21 + e.ph), 0, Math.cos(t * 0.17 + e.ph)));   // (A2: the still ones drift)
            else if (!S.eyes) dv.set(Math.sin(t * 0.3 + e.ph), 2, Math.cos(t * 0.23 + e.ph));
            else dv.normalize().add(tmpV.set(Math.sin(t * 1.7 + e.ph) * 0.06, 0, Math.cos(t * 1.3 + e.ph) * 0.06));
            dv.y = Math.max(dv.y, 0.15 * dv.length());               // (half buried: they cannot look into the ground)
            tq.setFromUnitVectors(Z, dv.normalize());
            e.q.slerp(tq, 1 - Math.exp(-dt * (e.trk && S.eyes ? e.rate : 0.5)));
          }
          writeFloor();
        } };
    },
    stops: (ctx, inst) => [{ s: (inst.pieces[1].s0 + inst.pieces[2].s1) / 2, kind: 'show', hold: 4, name: 'the room of eyes' }],
  };
})();
