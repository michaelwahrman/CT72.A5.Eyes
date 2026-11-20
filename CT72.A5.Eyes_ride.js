/* CT72.A5.Eyes (from CT61.B6.Darkride) -- the ride: the order of the rooms, and the mine that runs through them.
 *
 * B6 (2026-11-10): every room is its own module in rooms/ (rooms/README.md says how to write one and how to put one in a ride).  This
 * file only says the order (RIDE below), builds the path, and builds what every stretch of the mine has: the rock tunnels and their
 * portals, the rail and sleepers, timber sets, lanterns, rubble, debris on the track, the dust in the air, the bulbs' glows.  Then it
 * asks each room module to build itself round its own pieces of track, and calls each one's update every frame.
 *
 *   entry way (rooms/station.js)  ->  hall of windows (rooms/windows.js)  ->  down a level, a curve, down a level (rooms/descent.js)
 *   ->  the room of crates (rooms/crates.js)  ->  the room of jails (rooms/prison.js)  ->  down a level, fast, round curves (descent.js
 *   again)  ->  the room of bees (rooms/bees.js)  ->  the room of eyes (rooms/eyes.js)  ->  the room of locusts (rooms/locusts.js)  ->
 *   up three levels on an open trestle, slowly, like a roller coaster's lift hill, three dolls standing level beside the climbing track
 *   (rooms/lifthill.js)  ->  up a level  ->  into the entry way, where the ride ends.
 *   The doll room (rooms/dolls.js, B3-B5's reception line) is not in this ride; ?dollroom=1 puts it back after the jails.
 *
 * The track is one closed loop of pieces (straights that may climb or fall, and arcs), integrated into samples every 5 cm.  Two straights
 * ('fit' 0 and 1) get their lengths solved so the loop closes exactly.
 *
 * (B1-B5's history is in CT61.B6.Darkride.md; the code it describes is in the room modules now.)
 */
(function () {
  'use strict';
  const C = CT61Core, { T, clamp, rng, UP, D2R, ribbon, merge, frameBox, rockGeo, rockAmp, springOf, tunnelGeo, portal, canvasTexture, texCanvas, halo, flicker } = C;
  const ROOMS = window.CT61Rooms;
  const qs = new URLSearchParams(location.search);

  // ------------------------------------------------------------------ the ride: rooms in order, and the plain tunnels between them
  // Each entry is a room module instance { room: 'name', o: {options} } or a plain tunnel piece (kind S = straight (len, rise), T = turn
  // (ang degrees, + = left; r); hw half width, h height; speed m/s; zone; fit 0 / 1 = length solved to close the loop).
  const tun = (o) => Object.assign({ hw: 1.3, h: 2.9, speed: 0.6, zone: 'corner', floor: 'dirt', wall: 'rock', ceil: 'rock' }, o);
  // CT72.A3: only the room of eyes.  A dark tunnel in (rooms/dark.js), the room (rooms/eyes.js, CT61.B6's, unchanged), the darkness on the
  // far side, where the ride ends; the rest of the loop is dark tunnel that is never ridden (it only closes the track: four right turns).
  const dk = (o) => tun(Object.assign({ zone: 'dark', noLanterns: true, speed: 0.6 }, o));
  const RIDE = [
    { room: 'dark', part: 'head' },                                           // the way in: a dark rock tunnel, the room's glow ahead
    { room: 'eyes' },                                                         // the room of eyes
    { room: 'dark', part: 'tail' },                                           // into the darkness on the far side: the ride ends here
    dk({ id: 'back1', kind: 'T', ang: -90, r: 5 }),
    dk({ id: 'side1', kind: 'S', len: 0, fit: 0 }),
    dk({ id: 'back2', kind: 'T', ang: -90, r: 5 }),
    dk({ id: 'backRun', kind: 'S', len: 0, fit: 1 }),
    dk({ id: 'back3', kind: 'T', ang: -90, r: 5 }),
  ];     // (CT72.A4: the way round is three right turns now, not four: the ridden corner after the room (rooms/dark.js, darkTurn) is the fourth)
  const UP_GRADE = 0.2;

  /** the pieces of the ride, in order, each tagged with the module instance it belongs to */
  function layout() {
    const insts = [], out = [];
    for (const e of RIDE) {
      if (!e.room) { out.push(Object.assign({}, e)); continue; }
      const mod = ROOMS[e.room]; if (!mod) throw new Error('no room module ' + e.room + ' (is rooms/' + e.room + '.js loaded?)');
      const list = (e.part === 'tail' ? mod.tailPieces : mod.pieces)(e.o || {});
      let inst = e.part === 'tail' ? insts.find(x => x.name === e.room) : null;
      if (!inst) { inst = { name: e.room, mod, o: e.o || {}, ids: [] }; insts.push(inst); }
      for (const p of list) { const q = Object.assign({}, p); q.inst = inst; inst.ids.push(q.id); out.push(q); }
    }
    // the last climb ("up a level") makes up whatever the descents dropped and the lift hill did not climb
    const drop = -out.reduce((a, p) => a + (p.rise || 0), 0);
    const b = out.find(p => p.id === 'upLastB'); if (b) { b.rise = drop; b.len = Math.max(1, drop / UP_GRADE); }     // (CT72: no climb; the loop is level)
    return { pieces: out, insts };
  }
  const L0 = layout();
  const ids = new Set(); for (const p of L0.pieces) { if (ids.has(p.id)) throw new Error('two pieces called ' + p.id); ids.add(p.id); }
  const ZONE_NAME = { corner: 'a mine tunnel', lift: 'the incline', exit: 'the way out' };
  for (const i of L0.insts) Object.assign(ZONE_NAME, i.mod.zones || {});

  // ------------------------------------------------------------------ build everything
  async function build(scene, opts = {}) {
    const A = await C.loadAssets();
    const path = C.makePath(L0.pieces);
    const L = path.L, pieces = path.pieces;
    const P = Object.fromEntries(pieces.map(p => [p.id, p]));
    const tex = {};
    const getTex = (k) => tex[k] || (tex[k] = canvasTexture(texCanvas(k)));
    const MAT = {};
    const mat = (k) => MAT[k] || (MAT[k] = new T.MeshStandardMaterial({ map: getTex(k), roughness: k === 'tile' ? 0.45 : k === 'stone' ? 0.8 : 0.92, metalness: 0,
      ...(k === 'rock' || k === 'dirt' ? { bumpMap: getTex(k), bumpScale: k === 'rock' ? 4 : 2 } : {}), ...(k === 'rock' ? { side: T.DoubleSide } : {}) }));
    MAT.steel = new T.MeshStandardMaterial({ color: 0x5a524c, metalness: 0.75, roughness: 0.55 });
    MAT.railTop = new T.MeshStandardMaterial({ color: 0x9a9898, metalness: 0.85, roughness: 0.3 });
    MAT.channel = new T.MeshStandardMaterial({ color: 0x1a1a1c, metalness: 0.5, roughness: 0.6 });
    MAT.copper = new T.MeshStandardMaterial({ color: 0xb06a3a, metalness: 0.8, roughness: 0.35 });
    MAT.tie = new T.MeshStandardMaterial({ map: getTex('timber'), color: 0x9a8670, roughness: 0.95 });
    MAT.timber = new T.MeshStandardMaterial({ map: getTex('timber'), bumpMap: getTex('timber'), bumpScale: 1.5, color: 0xb8a088, roughness: 0.95 });
    MAT.frame = MAT.timber;
    MAT.giltFrame = new T.MeshStandardMaterial({ color: 0x6a5a40, metalness: 0.6, roughness: 0.5 });
    MAT.barRust = new T.MeshStandardMaterial({ map: getTex('rust'), bumpMap: getTex('rust'), bumpScale: 1.5, color: 0x8a6a58, metalness: 0.25, roughness: 0.85 });
    MAT.pipe = new T.MeshStandardMaterial({ map: getTex('rust'), color: 0x6a5446, metalness: 0.3, roughness: 0.8 });
    MAT.void = new T.MeshBasicMaterial({ color: 0x000000 });

    const buckets = new Map();            // material key -> [geometries] (cast shadow?)
    const put = (key, geo, cast = true) => { const k = key + (cast ? '' : '|nc'); if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(geo); };
    const group = new T.Group(); scene.add(group);
    const specs = [];                     // light specs for main.js's pool
    const anim = [];                      // per-frame scenery updates: f(t, cam, S, dt, cars)
    const glows = [];                     // [position, colour, size, flicker] -> one Points cloud
    const pool = [];                      // main.js puts its spot lights here
    const bulbHalo = halo();
    const idx = new Map(pieces.map((p, i) => [p, i]));
    const prev = (p) => pieces[(idx.get(p) + pieces.length - 1) % pieces.length], next = (p) => pieces[(idx.get(p) + 1) % pieces.length];
    const carFactory = () => CT61Cars.makeCarFactory(getTex);
    const ctx = { T, C, scene, group, path, L, pieces, P, put, mat, MAT, getTex, specs, glows, anim, pool, A, opts, prev, next, bulbHalo, rod: C.makeRod(put), carFactory, flicker };

    // ---------------- the tunnels: each corridor piece is a rock bore on a dirt floor; where it meets a bigger space (or a room) the bore runs
    // on a little way into the timber frame of the portal there
    const bigger = (q, p) => q.room || q.hw * q.h > p.hw * p.h + 0.01;
    pieces.forEach((p) => {
      if (p.room) return;
      const { s0, s1, hw, h } = p, pv = prev(p), nx = next(p);
      const amp = rockAmp(hw), sp = springOf(p), ext = (q) => !bigger(q, p) ? 0 : q.zone === 'plains' ? 0.8 : q.room ? 0.55 : rockAmp(q.hw) + 0.05, e0 = ext(pv), e1 = ext(nx);
      put(p.floor, ribbon(path, s0, s1, [[hw + amp + 0.1, 0], [-hw - amp - 0.1, 0]], 2, 2));
      put(p.wall, tunnelGeo(path, s0 - e0, s1 + e1, hw, h, sp, amp, 1));
      put(p.wall, tunnelGeo(path, s0 - e0, s1 + e1, hw, h, sp, amp, -1), !p.windows);       // (the window wall casts no shadow)
    });
    for (let i = 0; i < pieces.length; i++) {        // portals where the tunnel changes size
      const a = pieces[i], b = pieces[(i + 1) % pieces.length];
      if (a.room || b.room) continue;
      if (Math.abs(a.hw - b.hw) < 0.01 && Math.abs(a.h - b.h) < 0.01 && Math.abs(springOf(a) - springOf(b)) < 0.01) continue;
      const big = a.hw * a.h > b.hw * b.h ? a : b, small = big === a ? b : a;
      const f = path.frame(a.s1), amp = rockAmp(big.hw), W = big.hw + amp + 0.3;
      for (const q of portal(f.p, f.l, f.t, big === a ? -1 : 1, 0, small.hw, springOf(small), -W, W, big.h + amp + 0.3, amp)) put(q.key, q.geo);
    }
    // ---------------- the track (mine rail): two dull rails worn bright on top, on rough sleepers laid a little crooked
    {
      const prof = (c, w, b, ht) => [[c + w / 2, b], [c + w / 2, ht], [c - w / 2, ht], [c - w / 2, b]];
      for (const c of [0.42, -0.42]) {
        put('steel', ribbon(path, 0, L, prof(c, 0.06, 0.05, 0.095), 2, 2, 0.15));
        put('railTop', ribbon(path, 0, L, [[c + 0.025, 0.1], [c - 0.025, 0.1]], 2, 2, 0.15), false);
        put('steel', ribbon(path, 0, L, [[c + 0.03, 0.095], [c + 0.025, 0.1], [c - 0.025, 0.1], [c - 0.03, 0.095]], 2, 2, 0.15), false);
      }
      const SP = 0.55, n = Math.floor(L / SP), ties = new T.InstancedMesh(new T.BoxGeometry(1.2, 0.06, 0.15), MAT.tie, n);
      const m = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), sc = new T.Vector3(), R = rng(61061);
      for (let i = 0; i < n; i++) {
        const f = path.frame(i * SP + (R() - 0.5) * 0.08);
        m.makeBasis(f.l, UP, f.t);
        q.setFromRotationMatrix(m).multiply(new T.Quaternion().setFromEuler(e.set((R() - 0.5) * 0.04, (R() - 0.5) * 0.14, (R() - 0.5) * 0.03)));
        sc.set(0.9 + R() * 0.2, 0.8 + R() * 0.4, 0.85 + R() * 0.3);
        m.compose(new T.Vector3(f.p.x, f.p.y + 0.028, f.p.z).addScaledVector(f.l, (R() - 0.5) * 0.08), q, sc);
        ties.setMatrixAt(i, m);
      }
      ties.receiveShadow = true; ties.castShadow = true; group.add(ties);
    }

    // ---------------- the mine's furniture along the tunnels: timber sets (two posts and a cap at the springing), lanterns hung on them,
    // rubble along the walls.  A piece may give its own set positions (setsAt, offsets from its start: the hall of windows sets them
    // between its windows); a piece with noLanterns has no lanterns; rubbleSides limits the rubble to those sides (the station's platform).
    {
      const R = rng(1961), setAt = [];
      for (const p of pieces) {
        if (p.room || p.hw > 4.5 || p.length < 0.8) continue;
        const sp = springOf(p);
        let ss = [];
        if (p.setsAt) ss = p.setsAt.map(o => p.s0 + o);
        else { const D = p.hw > 2.5 ? 3 : 1.6; for (let s = Math.ceil((p.s0 + 0.45) / D) * D; s < p.s1 - 0.45; s += D) ss.push(s); }
        for (const s of ss) {
          if (s < p.s0 + 0.35 || s > p.s1 - 0.35) continue;
          const f = path.frame(s), lean = (R() - 0.5) * 0.06;
          for (const sd of [-1, 1]) {
            const g = frameBox(new T.Vector3(), f.l, f.t, 0, sp / 2, 0, 0.2, sp, 0.2, 1);
            g.applyMatrix4(new T.Matrix4().makeRotationAxis(f.t, sd * 0.035 + lean));
            g.translate(f.p.x + f.l.x * sd * (p.hw - 0.1), f.p.y, f.p.z + f.l.z * sd * (p.hw - 0.1));
            put('timber', g);
          }
          put('timber', frameBox(f.p, f.l, f.t, (R() - 0.5) * 0.05, sp + 0.02, 0, 2 * p.hw + 0.25, 0.24, 0.24, 1));
          for (let b = 0; b < 3; b++) if (R() < 0.6) put('timber', frameBox(f.p, f.l, f.t, (b - 1) * p.hw * 0.6, sp + 0.17, (R() - 0.5) * 0.3, 0.22, 0.04, 0.9 + R() * 0.5, 1));
          setAt.push([p, s, f]);
        }
      }
      let alt = 0;
      for (const [p, s, f] of setAt) {
        if (p.noLanterns) continue;
        const col = p.bulbs || 0xffa850, sides = p.bulbs ? [1, -1] : (alt++ % 2 ? [] : [alt % 4 < 2 ? 1 : -1]);
        for (const sd of sides) glows.push([f.p.clone().addScaledVector(f.l, sd * (p.hw - 0.32)).addScaledVector(UP, springOf(p) - 0.2), col, p.bulbs ? 0.32 : 0.26]);
      }
      // a warm lantern light every 8 m or so in every tunnel (pool spots, shadowed by the timber): dark between the rooms, never black
      for (const p of pieces.filter(p => !p.room && !p.noLanterns && p.hw <= 3.2 && p.length >= 1.2)) {
        const n = Math.max(1, Math.round(p.length / 8));
        for (let k = 0; k < n; k++) {
          const s = p.s0 + (k + 0.5) * p.length / n, f = path.frame(s), sp = springOf(p);
          specs.push({ s, kind: 'lamp', pos: f.p.clone().addScaledVector(f.l, p.hw * 0.45).addScaledVector(UP, sp - 0.25), target: f.p.clone().addScaledVector(f.l, -p.hw * 0.3),
            color: new T.Color(1, 0.66, 0.36), intensity: 30, angle: 1.15, penumbra: 0.8, distance: 8, near: 0.15, map: null, name: 'lantern (' + p.id + ')' });
          glows.push([f.p.clone().addScaledVector(f.l, p.hw * 0.45).addScaledVector(UP, sp - 0.2), 0xffb060, 0.34]);
        }
      }
      // a lantern over the crest of each climb out of the mine
      for (const p of pieces.filter(p => p.crest)) {
        const f = path.frame(p.s1 - 0.5);
        specs.push({ s: p.s1 - 0.5, kind: 'lamp', pos: f.p.clone().add(new T.Vector3(0, 1.85, 0)).addScaledVector(f.t, 0.6), target: f.p.clone().addScaledVector(f.t, -3),
          color: new T.Color(1, 0.7, 0.35), intensity: 45, angle: 0.6, penumbra: 0.7, distance: 9, map: null, name: 'crest (' + p.id + ')' });
      }
      const items = [];
      for (const p of pieces) {
        if (p.room) continue;
        const per = p.hw > 2.5 ? 1.2 : 2.6;
        for (const sd of p.rubbleSides || [-1, 1]) {
          const n = Math.floor(p.length * per);
          for (let k = 0; k < n; k++) {
            const s = p.s0 + R() * p.length, big = R() * R(), sc = 0.05 + big * Math.min(0.35, (p.hw - 0.95) * 0.5);
            items.push([s, sd * (p.hw - R() * 0.2 - sc * 0.3), sc, R() * 6.28]);
          }
        }
      }
      const m = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler();
      for (let v = 0; v < 4; v++) {
        const big = v >= 2, sel = items.filter(([, , sc], i) => (sc > 0.12) === big && i % 2 === v % 2);
        if (!sel.length) continue;
        const rub = new T.InstancedMesh(rockGeo(31 + v, big ? 3 : 2), mat('rock'), sel.length);
        sel.forEach(([s, lat, sc, rot], i) => {
          const f = path.frame(s);
          m.compose(f.p.clone().addScaledVector(f.l, lat).add(new T.Vector3(0, sc * 0.35, 0)), q.setFromEuler(e.set(rot * 0.3, rot, rot * 0.7)), new T.Vector3(sc * (0.8 + 0.4 * Math.sin(rot * 3)), sc, sc));
          rub.setMatrixAt(i, m);
        });
        rub.castShadow = rub.receiveShadow = true; group.add(rub);
      }
    }

    // ---------------- debris on the track (B5): gravel and small stones between and beside the rails, and now and then a big piece (a stone
    // fallen from the roof, a broken board) lying across a rail: going over one jerks the car (main.js, debrisS).  None on a piece with
    // noDebris (the station, the open trestle of the lift hill); no big pieces in the hall of windows.
    const debrisS = [];
    {
      const R = rng(5555), small = [], big = [], boards = [];
      for (const p of pieces) {
        if (p.noDebris) continue;
        for (let s = p.s0 + 0.2; s < p.s1; s += 0.25 + R() * 0.3) small.push([s, (R() - 0.5) * (R() < 0.6 ? 0.7 : 1.9), 0.02 + R() * R() * 0.07]);
      }
      for (let s = 6; s < L - 4; s += 9 + R() * 16) {
        const p = path.pieceAt(s); if (p.noDebris || p.windows) continue;
        const side = R() < 0.5 ? -1 : 1;
        if (R() < 0.7) big.push([s, side * 0.42, 0.09 + R() * 0.07]); else boards.push([s, side]);
        debrisS.push({ s, k: 0.7 + R() * 0.6, side });
      }
      const m = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler();
      for (const [list, geo, flat] of [[small, rockGeo(901, 1), 0.6], [big, rockGeo(902, 2), 0.75]]) {
        if (!list.length) continue;
        const im = new T.InstancedMesh(geo, mat('rock'), list.length);
        list.forEach(([s, lat, r], i) => { const f = path.frame(s); im.setMatrixAt(i, m.compose(f.p.clone().addScaledVector(f.l, lat).add(new T.Vector3(0, r * flat * 0.6 + 0.02, 0)), q.setFromEuler(e.set(R() * 3, R() * 3, R() * 3)), new T.Vector3(r * (0.8 + R() * 0.6), r * flat, r))); });
        im.castShadow = im.receiveShadow = true; group.add(im);
      }
      for (const [s, side] of boards) { const f = path.frame(s); put('planks', frameBox(f.p, f.l, f.t, side * 0.3, 0.14, 0, 1.1, 0.04, 0.16)); }
    }

    // ---------------- dust hanging in the air everywhere (B2): motes in a box that wraps round the camera, drifting, lit by the pool's lights
    // near them (inside their cones) and faintly by the work light
    const airDust = (() => {
      const N = Math.max(0, opts.airDust != null ? opts.airDust : 7000), R = rng(5150), seed = new Float32Array(N * 4);
      for (let i = 0; i < N * 4; i++) seed[i] = R();
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(new Float32Array(N * 3), 3)); g.setAttribute('seed', new T.Float32BufferAttribute(seed, 4));
      const NL = 8, m = new T.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uCam: { value: new T.Vector3() }, uBox: { value: 9 }, uScale: { value: 800 }, uGain: { value: 1 }, uAmb: { value: 0.02 },
          uLp: { value: Array.from({ length: NL }, () => new T.Vector4(0, -1e4, 0, 0)) }, uLd: { value: Array.from({ length: NL }, () => new T.Vector4(0, -1, 0, 0.5)) }, uLc: { value: Array.from({ length: NL }, () => new T.Color()) } },
        vertexShader: `attribute vec4 seed; uniform float uTime, uBox, uScale, uAmb; uniform vec3 uCam; uniform vec4 uLp[${NL}], uLd[${NL}]; uniform vec3 uLc[${NL}]; varying vec3 vCol; varying float vA;
          void main() {
            vec3 p = seed.xyz * uBox + vec3(sin(uTime * 0.07 + seed.w * 40.0) * 0.6 + uTime * 0.02, sin(uTime * 0.05 + seed.w * 23.0) * 0.4 - uTime * 0.012, cos(uTime * 0.06 + seed.w * 31.0) * 0.6);
            vec3 rel = mod(p - uCam + 0.5 * uBox, uBox) - 0.5 * uBox, P = uCam + rel;
            vec3 c = vec3(uAmb);
            for (int k = 0; k < ${NL}; k++) {
              vec3 d = P - uLp[k].xyz; float d2 = dot(d, d), cs = dot(d, uLd[k].xyz) / sqrt(d2 + 1e-4);
              c += uLc[k] * uLp[k].w * smoothstep(uLd[k].w, uLd[k].w + 0.08, cs) / (1.0 + d2);
            }
            float dist = length(rel);
            vA = smoothstep(0.5 * uBox, 0.38 * uBox, max(max(abs(rel.x), abs(rel.y)), abs(rel.z))) * smoothstep(0.15, 0.5, dist) * (0.4 + 0.6 * fract(seed.w * 7.7));
            vCol = min(c, vec3(3.0));
            vec4 mv = modelViewMatrix * vec4(P, 1.0);
            gl_PointSize = clamp(uScale * 0.0045 / max(0.1, -mv.z), 1.0, 5.0);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `uniform float uGain; varying vec3 vCol; varying float vA;
          void main() { vec2 q = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.1, length(q)); gl_FragColor = vec4(vCol * a * vA * uGain * 0.5, 1.0); }`,
        transparent: true, depthWrite: false, blending: T.AdditiveBlending,
      });
      const pts = new T.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 5; group.add(pts);
      const dir = new T.Vector3();
      return { pts, mat: m, update(t, cam, S) {
        const u = m.uniforms; pts.visible = !!S.dust && N > 0; if (!pts.visible) return;
        u.uTime.value = t; u.uCam.value.copy(cam.position); u.uScale.value = opts.pixelScale ? opts.pixelScale() : 800;
        u.uAmb.value = 0.01 + 0.05 * (S.houseNow != null ? S.houseNow : S.house);
        for (let k = 0; k < NL; k++) {
          const l = pool[k];
          if (!l || l.intensity <= 0) { u.uLp.value[k].set(0, -1e4, 0, 0); continue; }
          dir.copy(l.target.position).sub(l.position).normalize();
          u.uLp.value[k].set(l.position.x, l.position.y, l.position.z, Math.min(l.intensity, 2000) * 0.004);
          u.uLd.value[k].set(dir.x, dir.y, dir.z, Math.cos(l.angle)); u.uLc.value[k].copy(l.color);
        }
      } };
    })();

    // ---------------- the rooms: each module builds itself round its pieces (in ride order)
    const built = [];
    for (const inst of L0.insts) {
      inst.pieces = inst.ids.map(id => P[id]);
      const api = (inst.mod.build && await inst.mod.build(ctx, inst)) || {};
      inst.api = api; built.push(inst);
    }
    const apiOf = (name) => (built.find(i => i.name === name) || {}).api || {};

    // ---------------- all the static geometry, one mesh per material, split by where it is (16 m cells) so the far ones are culled
    for (const [k, all] of buckets) {
      const [key, nc] = k.split('|'), cells = new Map();
      for (const g of all) {
        g.computeBoundingSphere(); const c = g.boundingSphere.center, ck = g.boundingSphere.radius > 30 ? 'big' : `${Math.floor(c.x / 16)},${Math.floor(c.y / 8)},${Math.floor(c.z / 16)}`;
        if (!cells.has(ck)) cells.set(ck, []); cells.get(ck).push(g);
      }
      for (const geos of cells.values()) {
        const m = new T.Mesh(merge(geos), MAT[key] || mat(key));
        m.receiveShadow = true; m.castShadow = nc !== 'nc';
        group.add(m);
        for (const g of geos) g.dispose();
      }
    }
    // ---------------- bulbs: one cloud of glows (and a small sphere each); they flicker (B2)
    {
      const pos = [], col = [], size = [], fk = [];
      const bulbGeo = new T.SphereGeometry(0.035, 32, 20), bulbs = new T.InstancedMesh(bulbGeo, new T.MeshBasicMaterial({ color: 0xffffff }), Math.max(1, glows.length));
      const m = new T.Matrix4();
      glows.forEach(([p, c, sz, fl], i) => {
        pos.push(p.x, p.y, p.z); const cc = new T.Color(c); col.push(cc.r, cc.g, cc.b); size.push(sz); fk.push(fl != null ? fl : 0.08);
        bulbs.setMatrixAt(i, m.makeTranslation(p.x, p.y, p.z)); bulbs.setColorAt(i, cc.clone().multiplyScalar(1.6));
      });
      group.add(bulbs);
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('col', new T.Float32BufferAttribute(col, 3)); g.setAttribute('sz', new T.Float32BufferAttribute(size, 1)); g.setAttribute('fk', new T.Float32BufferAttribute(fk, 1));
      const gm = new T.ShaderMaterial({
        uniforms: { sprite: { value: bulbHalo }, scale: { value: 800 }, gain: { value: 1 }, time: { value: 0 } },
        vertexShader: `attribute vec3 col; attribute float sz, fk; uniform float scale, time; varying vec3 vCol;
          float h1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
          float n1(float x) { float i = floor(x), f = fract(x); return mix(h1(i), h1(i + 1.0), f * f * (3.0 - 2.0 * f)); }
          void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float sd = fract(sin(dot(position, vec3(12.9898, 78.233, 37.719))) * 43758.5453) * 50.0;
          float dn = n1(time * 0.6 + sd * 3.0), dip = dn > 0.8 ? (dn - 0.8) / 0.2 * (0.5 + 0.5 * n1(time * 15.0 + sd)) : 0.0;
          vCol = col * max(0.05, 1.0 - fk * (0.6 * n1(time * 9.0 + sd * 17.0) + 0.4 * n1(time * 23.0 + sd * 5.0)) - fk * 1.5 * dip);
          gl_PointSize = clamp(scale * sz / max(0.1, -mv.z), 1.0, 160.0); gl_Position = projectionMatrix * mv; }`,
        fragmentShader: `uniform sampler2D sprite; uniform float gain; varying vec3 vCol; void main() { float a = texture2D(sprite, gl_PointCoord).a; gl_FragColor = vec4(vCol * a * gain, 1.0); }`,
        transparent: true, depthWrite: false, blending: T.AdditiveBlending,
      });
      const pts = new T.Points(g, gm); pts.frustumCulled = false; group.add(pts);
      anim.push((t, cam, S) => { gm.uniforms.scale.value = opts.pixelScale ? opts.pixelScale() : 800; gm.uniforms.gain.value = S.bulbs; gm.uniforms.time.value = t; });
    }

    // ---------------- per frame: the fog goes back to black unless a room changes it this frame; then every room's own update
    function update(t, dt, cam, S, assigned, cars) {
      scene.fog.color.setRGB(0, 0, 0);
      airDust.update(t, cam, S);
      for (const inst of built) if (inst.api.update) inst.api.update(t, dt, cam, S, cars);
      for (const f of anim) f(t, cam, S, dt, cars);
    }

    // which way you look along the track (A5; B1: your head, not the car): cues [{s, face (deg)}], sorted; a piece without a face faces ahead
    const faceCues = [];
    for (const p of pieces) { if (p.face) for (const [fr, a] of p.face) faceCues.push({ s: p.s0 + fr * p.length, face: a }); else faceCues.push({ s: p.s0, face: 0 }); }
    faceCues.sort((a, b) => a.s - b.s);
    function faceAt(u) { const s = path.wrap(u); let f = faceCues[faceCues.length - 1].face; for (const c of faceCues) { if (c.s <= s + 1e-6) f = c.face; else break; } return f; }

    const win = apiOf('windows'), bees = apiOf('bees'), loc = apiOf('locusts');
    const Cc = CT61Cars;
    return { path, L, debrisS, specs, update, pool, flicker, faceAt, ZONE_NAME, pieces, P, group, rooms: built,
      hallWins: win.hallWins || [], setGlass: win.setGlass || (() => []), swarm: bees.swarm || null, plains: loc.plains || null,
      CAR_LEN: Cc.CAR_LEN, POD: Cc.POD, BAR_UP: Cc.BAR_UP, makeCars: carFactory,
      /** where the ride ends: just inside the entry way (main.js stops your car there, for good) */
      fadeAt: apiOf('dark').fadeAt || (() => 0),      // (CT72.A4: 0..1, how black the picture is: the fade after the corner)
      endS: apiOf('dark').endS,      // (CT72: in the darkness beyond the room of eyes)
      stopsFor: () => built.flatMap(i => i.mod.stops ? i.mod.stops(ctx, i) : []) };
  }

  window.CT61Ride = { build, RIDE, layout: () => layout(), ZONE_NAME, rockGeo };
  window.CT61Layout = { LAYOUT: L0.pieces };      // (for tools: the pieces in order, before the loop is closed)
})();
