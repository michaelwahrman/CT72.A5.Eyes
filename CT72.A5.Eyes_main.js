/* CT72.A5.Eyes (2026-11-15, from CT61.B6.Darkride) -- only the room of eyes, no car seen, ending in the dark.
 * CT61.B6.Darkride (2026-10-31; A1 2026-10-30) -- a classic dark ride, ridden from the seat of one of its cars (MIDI, buttons, keys, movie recorder
 * in the style of CT58 LANight / CT55).
 *
 * You start in the station, third in line; the car just dispatched is rolling into the corner.  The cars ahead are empty; one at a
 * time they are dispatched, roll out and turn the corner into the dark and are gone.  After two more it is your turn: round the corner and down the window hall, where
 * sunlight falls through six stained-glass windows in shafts, across the floor, the track and the cars ahead of you, which
 * stop and go (two stops in the hall).  Then round the next corner after them, up the lift, through the eye room, down the
 * long drop deep down into the bee room, a honeycomb hall full of a swarm of honeybees just buzzing around (CT54.A7's milling
 * flight, CT61.B6.Darkride_bees.js), up the climb to the ground and out into the station to queue again.  It runs forever.
 * A3: a ride gauge at the bottom left shows how far round the ride you are (% and feet, from the dispatch point).
 * A4: the grave is gone; the bee room is where it was.
 * A5: the cars are turning pods: the ride turns each pod to face where the piece says (R.faceAt), and its lap bar comes down by itself
 *     when the car is dispatched and goes up again as it comes back into the station.  The gauge has a slider that moves the whole
 *     train along the track (to get to a room quickly).  A movie is made at most 1920 x 1080 (the window's shape; ?recw= ?rech=).
 * A7: the bees in slow motion (?beespeed=0.35) and the queen; after the bee room the water tank and the bubble room (ride.js).
 * A8: the water tank and the queen are switched off (ride.js WATER, QUEEN).
 * A9: the movie is made at the picture's own size again (as before A5; ?recw= ?rech= still cap it); the cars are further apart (12 cars, was 20;
 *     dispatched every 16 s); the locust plains (?locusts= ?locustcloud= ?locustsize=); a light spec can be on over a stretch (from, to).
 * A10: the locusts motion-blurred (?locustblur= samples, 1 = none) and casting shadows (a light spec can ask for a bigger shadow map,
 *     shadowSize; the sun over the plains has 4096, ?sunshadow=); the swarm's sound follows where the locusts are round you.
 *
 * B1: an old abandoned mine (ride.js): rock tunnels, timber, mine rail, mine cars.  The cars do not turn and have no lap bar; where a
 *     piece wants you to look (its face) your head turns that way instead (at most 60 deg; a backward face is ignored), unless Turn look is off.
 *
 *  * The cars: 20 of them on a closed loop of about 121 m (CT61.B6.Darkride_ride.js).  Each car follows the one ahead (it keeps
 *    a gap), slows for the stops and waits there; at the station it waits to be dispatched (every 16 s by default (A9; it was 9)).
 *  * The light: the ride has a few dozen light positions (each window, the lamps, the room lights); a pool of 6 shadowed
 *    spot lights is given to the ones nearest you along the track (fading in and out), so the windows' light falls with
 *    their pattern (each spot's map is the window as the light sees it) and every car casts its shadow in it.
 *    The shafts are slices of the window drawn additively, the dust in them is coloured by the glass it fell through.
 *  * Camera: your seat (drag to look round, it looks into the turns by itself) or behind your car (V).
 */
(function () {
  'use strict';
  const LABEL = 'CT72.A5.Eyes';
  const $ = (id) => document.getElementById(id);
  const qs = new URLSearchParams(location.search);
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const D2R = Math.PI / 180;

  // ------------------------------------------------------------------ renderer, scene, camera
  const stage = $('stage'), canvas = $('c');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x000000, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = parseFloat(qs.get('exposure') || '1.35');
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.04, 200);
  scene.fog = new THREE.FogExp2(0x000000, 0.05);
  // CT72.A4: the fade to black at the end of the ride is a black sheet on the camera, so it is in the movie too
  const fadeMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false, toneMapped: false });
  const fadeSheet = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), fadeMat); fadeSheet.position.z = -0.2; fadeSheet.renderOrder = 1e6; fadeSheet.frustumCulled = false; fadeSheet.visible = false;
  camera.add(fadeSheet); scene.add(camera);
  const house = new THREE.HemisphereLight(0x8a7a66, 0x1c140c, 0.3);   // the work lights (B1: a faint dusty warm fill, the mine's)
  scene.add(house);
  // CT72.A3: Lights (L) -- 'turn the lights on': an even light on everything, so no geometry is hidden in black
  const allLight = new THREE.AmbientLight(0xfff2e0, 0); scene.add(allLight);
  // CT72.A3: a dim light over the track ahead in the darkness, so the rails stay visible to the end (no shadow)
  const trackLight = new THREE.SpotLight(0xffd9b0, 0, 12, 0.7, 0.9, 1.4); scene.add(trackLight, trackLight.target);
  // CT72.A5: a small warm light just ahead of the camera, so your car and the rails close to it are never black (A1-A4 hid the car)
  const carLight = new THREE.PointLight(0xffc890, 0, 4.5, 1.5); scene.add(carLight);

  // ------------------------------------------------------------------ state
  const LADDERS = {
    speed: [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3],
    sun: [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2],
    beams: [0, 0.25, 0.5, 0.75, 1, 1.5, 2, 3],
    house: [0, 0.05, 0.1, 0.2, 0.3, 0.5, 0.75, 1],
    look: [90, 60, 30, 0, -30, -60, -90, 180],
    dispatch: [10, 16, 25, 40, 60, 90, 120, 180],     // (B4: longer: few cars on a long ride)
  };
  const S = {
    playing: true, recording: false, time: 0, speed: parseFloat(qs.get('speed') || '1'), sun: 1, beams: 1, dust: qs.get('dust') === '1', car: qs.get('car') !== '0', fade: qs.get('fade') === '1', house: 0.25, bulbs: 1,
    fog: 0.05, dispatchEvery: 90, showStops: false,     // (B4: hardly ever stop; the Stops button (S) brings the show stops back)
    hold: false, view: 'seat', turnLook: true, eyes: true, sound: qs.get('sound') !== '0', hud: false, bar: false,   // (Harness 6: info and buttons off at start)
    lightsOn: qs.get('lightson') === '1', shadows: qs.get('shadows') !== '0',     // (CT72.A3: Lights L, Shadows O)
    lookYaw: 0, lookPitch: 0, fov: 62, glass: 0, dispatchNow: false, gauge: qs.get('gauge') !== '0',   // (A3: the ride gauge is on at start)
  };
  const look = { yaw: 0, pitch: 0, fov: 62 };

  let R = null, path = null, L = 1, cars = [], ours = null, stops = [], lastDispatch = 0, slots = [];
  const NSLOT = clamp(parseInt(qs.get('lights') || '6', 10), 2, 8);
  const NCARS = clamp(parseInt(qs.get('cars') || '5', 10), 3, 40);     // (B4: 5 cars, was 12: not so many ahead of you)
  const MINGAP = 1.3, ACC = 0.55, DEC = 1.6, STOPDEC = 0.55;

  // ------------------------------------------------------------------ sound
  const synth = new CT61Sound.Synth(), speaker = new CT61Sound.Speaker(synth);
  // B2: the sound is on from the start.  A browser only lets a page play sound once you have clicked or pressed a key on it, so it starts at
  // once if it may, and otherwise on your first click, key or touch.
  synth.muted = !S.sound;
  const kickSound = () => { if (S.sound) speaker.start(); };
  if (S.sound) try { speaker.start(); } catch (e) { /* (waits for a gesture) */ }
  for (const ev of ['pointerdown', 'keydown', 'touchstart']) window.addEventListener(ev, kickSound, { capture: true, passive: true });
  // B5: the sound must never outlive the page: closed when the page goes away, silent while it is hidden (another tab, minimised)
  window.addEventListener('pagehide', () => speaker.stop());
  window.addEventListener('beforeunload', () => speaker.stop());
  document.addEventListener('visibilitychange', () => { if (document.hidden) { if (!S.recording) speaker.suspend(); } else if (S.sound) speaker.start(); });

  // ------------------------------------------------------------------ building (async: the pictures load first)
  const pixelScale = () => canvas.height / (2 * Math.tan(camera.fov * D2R / 2));
  CT61Ride.build(scene, { pixelScale, beeCount: clamp(parseInt(qs.get('bees') || '2500', 10), 0, 20000), beeSize: clamp(parseFloat(qs.get('beesize') || '2.5'), 1, 10), beeTime: clamp(parseFloat(qs.get('beespeed') || '0.35'), 0.05, 1),
    locustCount: clamp(parseInt(qs.get('locusts') || '24000', 10), 0, 200000), locustCloud: clamp(parseInt(qs.get('locustcloud') || '1200000', 10), 0, 5000000),
    locustSize: clamp(parseFloat(qs.get('locustsize') || '2.2'), 1, 10), locustBlur: clamp(parseInt(qs.get('locustblur') || '3', 10), 1, 8),
    sunShadow: clamp(parseInt(qs.get('sunshadow') || '4096', 10), 512, 8192),
    floorEyes: clamp(parseInt(qs.get('flooreyes') || '600', 10), 0, 10000), trackers: qs.has('trackers') ? clamp(parseFloat(qs.get('trackers')), 0, 1) : null,     // (CT72.A3: more floor eyes, a third of them track you)
    carolers: qs.get('carolers') !== '0' }).then((ride) => {     // (B6: the room of eyes, the lift hill's dolls)
    R = ride; path = R.path; L = R.L;
    stops = R.stopsFor().sort((a, b) => a.s - b.s);
    const factory = R.makeCars();
    // light pool
    const white = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 8; const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 8, 8); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    const SM = parseInt(qs.get('shadow') || '1024', 10);
    for (let i = 0; i < NSLOT; i++) {
      const l = new THREE.SpotLight(0xffffff, 0, 12, 0.5, 0.3, 2);
      l.castShadow = true; l.shadow.mapSize.set(SM, SM); l.shadow.bias = -0.0005; l.shadow.normalBias = 0.025; l.shadow.camera.near = 0.3;
      l.map = white;
      scene.add(l, l.target);
      slots.push({ light: l, spec: null, level: 0, sm: SM });
    }
    for (const sp of R.specs) if (!sp.map) sp.map = white;
    R.pool.push(...slots.map(sl => sl.light));                        // (B2: the dust in the air is lit by them)
    R.specs.forEach((sp, i) => { if (sp.seed == null) sp.seed = i * 1.618 + 0.3; });
    S.glassNames = R.setGlass(S.glass);
    const { us, ourU, sD } = startPositions(NCARS);
    cars = us.map((u, i) => {
      const c = { u, v: 0, wait: 0, stopIdx: 0, stopU: 0, mesh: null, num: 0, ours: Math.abs(u - ourU) < 1e-6, i, yaw: 0, yawV: 0, bar: 0, barDown: false };
      return c;
    });
    // numbers: count from the dispatch point so the cars ahead of you have the lower numbers
    const order = cars.slice().sort((a, b) => path.wrap(sD - a.u + 0.001) - path.wrap(sD - b.u + 0.001));
    order.forEach((c, k) => { c.num = k + 1; });
    for (const c of cars) {
      c.mesh = factory.make(c.num, c.num); scene.add(c.mesh); c.mesh.visible = S.car;     // (CT72.A5: the mine cars show unless Car (C) is off; A1-A4 hid them)
      initStop(c);
    }
    ours = cars.find(c => c.ours);
    settlePods();
    startMoving();
    S.startU = ours.u;
    joint = Math.floor(ours.u / 1.5);
    placeCars(); updateCamera(1 / 60, true);
    $('loading').style.display = 'none';
    notify();
    if (qs.get('t')) { const sec = parseFloat(qs.get('t')); for (let t = 0; t < sec; t += 1 / 30) step(1 / 30); placeCars(); updateCamera(1, true); }
    requestAnimationFrame(tick);
  }).catch((e) => { console.error(e); $('loading').textContent = 'Could not build the ride: ' + (e && e.message || e); });

  // ------------------------------------------------------------------ the cars
  function initStop(c) {
    let best = 0, bd = Infinity;
    stops.forEach((st, k) => { const d = path.wrap(st.s - c.u + 0.02) - 0.02; if (d < bd) { bd = d; best = k; } });
    c.stopIdx = best; c.stopU = c.u + bd; c.wait = 0;
  }
  function advanceStop(c) {
    const a = stops[c.stopIdx], k = (c.stopIdx + 1) % stops.length, b = stops[k];
    let d = path.wrap(b.s - a.s); if (d < 0.01) d += L;
    c.stopIdx = k; c.stopU += d; c.wait = 0;
  }
  const stopActive = (st) => st.kind === 'dispatch' || S.showStops;
  let joint = 0, lastU = 0;
  const jolt = { a: 0, v: 0 };                                     // (B5: the lurch when you hit debris: a roll, sprung)
  function step(dt) {
    S.time += dt;
    const n = cars.length;
    const gaps = cars.map((c, i) => path.wrap(cars[(i + 1) % n].u - c.u) - R.CAR_LEN);
    cars.forEach((c, i) => {
      const gap = gaps[i], piece = path.pieceAt(c.u);
      let vt = piece.speed * S.speed;
      // B5: downhill the car runs away fast (as if by gravity), and picks up speed quickly
      const grade = (path.at(c.u + 0.6).y - path.at(c.u - 0.6).y) / 1.2, down = Math.max(0, -grade - 0.02);
      if (down > 0 && piece.fast) {       // (B6: on the pieces that say so: the descents (rooms/descent.js); it brakes in time for the next room's pace)
        let cap = 5.0;
        for (let d = 1; d <= 12; d += 1) { const q = path.pieceAt(c.u + d); if (q.room || q.hw >= 3.5 || q.zone === 'station') cap = Math.min(cap, Math.sqrt(q.speed * q.speed + 2 * 1.3 * d)); }
        vt = Math.max(vt, Math.min(cap, piece.speed + 18 * down) * S.speed);       // (B6: a little faster: up to 5 m/s, was 4.2)
      }
      c.acc = ACC + 7 * down;
      vt = Math.min(vt, Math.max(0, (gap - MINGAP) * 1.4));
      let st = stops[c.stopIdx];
      while (!stopActive(st) && c.u >= c.stopU - 0.03) { advanceStop(c); st = stops[c.stopIdx]; }
      if (stopActive(st)) {
        const dist = c.stopU - c.u;
        if (dist < 0.03) {
          let go = false;
          if (st.kind === 'dispatch') {
            if (!S.ended && (S.dispatchNow || S.time - lastDispatch >= S.dispatchEvery) && gap > 2.2 && !S.hold) { go = true; lastDispatch = S.time; S.dispatchNow = false; c.dispatched = S.time; c.dispatchU = c.u; c.barDown = true; }
          } else { c.wait += dt; if (c.wait >= st.hold) go = true; }
          if (go) advanceStop(c); else { vt = 0; c.v = 0; }
        } else vt = Math.min(vt, Math.sqrt(2 * STOPDEC * dist));
      }
      // B6: the ride ends in the entry way: once your car has been round it stops there, for good, and so does every other car
      if (c === ours && c.dispatchU != null && !S.ended) {
        const dist = c.dispatchU + rideLen() - c.u;
        vt = Math.min(vt, Math.sqrt(2 * STOPDEC * Math.max(0, dist)));
        if (dist < 0.03) { S.ended = true; c.v = 0; toast('The ride is over. Reset (Backspace) to ride again.', 8000); }
      }
      if (S.hold || S.ended) vt = 0;
      c.v += vt > c.v ? Math.min((c.acc || ACC) * dt, vt - c.v) : Math.max(-DEC * dt, vt - c.v);
      c.v = Math.max(0, Math.min(c.v, Math.max(0, gap - 0.15) / Math.max(dt, 1e-3)));
      c.u += c.v * dt;
      podStep(c, dt);
    });
    // the sound of your car
    const j = Math.floor(ours.u / 1.5);
    if (j !== joint) { joint = j; synth.joint(ours.v); bump.v -= 0.006 * Math.min(1.5, ours.v); }     // (B5: half B4's bounce)
    // B5: debris lying on the track: going over a big piece jerks the car (a kick up, a lurch to one side, a clunk)
    if (R.debrisS && ours.v > 0.05) for (const d of R.debrisS) {
      const a = path.wrap(d.s - lastU), b = path.wrap(ours.u - lastU);
      if (a <= b && b < 5) { bump.v += 0.55 * Math.min(2.5, 0.5 + ours.v) * d.k; jolt.v += (d.side || 1) * 0.9 * Math.min(2, 0.4 + ours.v) * d.k; synth.joint(Math.min(4, 1.5 + ours.v * 1.5)); }
    }
    lastU = ours.u;
    const piece = path.pieceAt(ours.u);
    const room = { station: 0.6, hall: 0.8, crates: 1, dolls: 0.8, eyes: 0.9, lifthill: 1, descent: 0.3, shaft: 1, upshaft: 1, prison: 0.8, bees: 0.7, dive: 0.6, water: 1, surface: 0.8, plains: 0.9, exit: 0.6, corner: 0.15, lift: 0.3, drop: 0.3 }[piece.zone] || 0.3;
    let wd = 1e9; for (const w of R.hallWins) wd = Math.min(wd, w.C.distanceTo(camera.position));
    const env = { rain: clamp(1.25 - wd / 7, 0, 1), drip: { crates: 1.6, dolls: 0.5, prison: 0.7, eyes: 0.4, lifthill: 0.7, descent: 0.3, shaft: 0.6, upshaft: 0.6, corner: 0.25, lift: 0.3 }[piece.zone] || 0.08 };   // (B2: rain at the windows, drips in the mine)
    synth.setScene(ours.v, !!piece.lift, room, R.swarm ? R.swarm.nearness(camera.position) : 0,   // (A4: the buzz of the bees)
      R.plains ? R.plains.listen(camera, S.time) : 0, env);                                        // (A9: the roar of the locusts; A10: where they are)
  }
  // A5: the pod turns toward the piece's face (a spring, at most 40 deg/s); the lap bar comes down at dispatch, up in the unload
  // stretch ('return'), taking 1.4 s each way, with a clunk in your car when it locks
  const POD_RATE = 40, POD_K = 3.0, BAR_T = 1.4;
  function podStep(c, dt) {
    const want = R.faceAt(c.u);
    c.yawV += (POD_K * (want - c.yaw) - 2 * Math.sqrt(POD_K) * c.yawV) * dt;
    c.yawV = clamp(c.yawV, -POD_RATE, POD_RATE);
    c.yaw += c.yawV * dt;
    if (c.barDown && path.pieceAt(c.u).id === 'return') c.barDown = false;
    c.bar = clamp(c.bar + (c.barDown ? 1 : -1) * dt / BAR_T, 0, 1);      // (B1: no lap bar any more; the state is kept, nothing shows it)
  }
  /** pods straight to their face, bars down for every car out on the ride (Reset, start, the slider) */
  function settlePods() {
    for (const c of cars) {
      c.yaw = R.faceAt(c.u); c.yawV = 0;
      const id = path.pieceAt(c.u).id, sD = stops.find(st => st.kind === 'dispatch').s;
      c.barDown = !(id === 'return' || (id === 'station' && path.wrap(c.u) < sD - 0.05)) || (c.dispatched != null && id === 'station');
      c.bar = c.barDown ? 1 : 0;
    }
  }
  const _a = {}, _b = {}, _fw = new THREE.Vector3(), _up = new THREE.Vector3(), _rt = new THREE.Vector3(), _m = new THREE.Matrix4();
  /** the pose of a car at u: midpoint of its two axles (1.3 m apart), pointing from the back one to the front one */
  function carPose(u, obj) {
    path.at(u + 0.65, _a); path.at(u - 0.65, _b);
    obj.position.set((_a.x + _b.x) / 2, (_a.y + _b.y) / 2, (_a.z + _b.z) / 2);
    _fw.set(_a.x - _b.x, _a.y - _b.y, _a.z - _b.z).normalize();
    _rt.crossVectors(_fw, THREE.Object3D.DEFAULT_UP).normalize();
    _up.crossVectors(_rt, _fw);
    _m.makeBasis(_fw, _up, _rt);
    obj.quaternion.setFromRotationMatrix(_m);
  }
  const ease = (x) => x * x * (3 - 2 * x);
  /** B2: the old car rocks and pitches a little on its worn wheels and the uneven rail (by where it is, so it is still when the car is) */
  function wobble(c) {
    c.mesh.rotateX(0.005 * Math.sin(c.u * 4.3 + c.num * 1.7) + 0.002 * Math.sin(c.u * 11.9 + c.num));     // (B5: about a third of B4's rocking)
    c.mesh.rotateZ(0.002 * Math.sin(c.u * 6.1 + c.num * 2.3));
    if (c === ours) c.mesh.rotateX(jolt.a);
  }
  function placeCars() {
    for (const c of cars) {
      carPose(c.u, c.mesh); wobble(c);
      const ud = c.mesh.userData;                                  // (B1: the mine car does not turn; its wheels roll)
      if (ud.wheels) for (const w of ud.wheels) w.rotation.z = -c.u / ud.wheelR;
    }
  }

  // ------------------------------------------------------------------ the camera
  const bump = { y: 0, v: 0 };
  const camPos = new THREE.Vector3(), camQ = new THREE.Quaternion();
  const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _w = new THREE.Vector3();
  let headYaw = 0;
  const headTurn = (y) => Math.abs(y) > 100 ? 0 : clamp(y * 0.35, -22, 22);     // (B5: a little of that goes a long way: about a third, at most 22 deg)
  const BASEQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2);   // camera -z -> car +x
  function updateCamera(dt, snap) {
    const k = snap ? 1 : 1 - Math.exp(-dt * 4);
    carPose(ours.u, ours.mesh); wobble(ours);
    // look: your own look, plus a look into the turns (the heading 2.5 m ahead)
    let into = 0;
    if (S.turnLook) { const h0 = path.at(ours.u).th, h1 = path.at(ours.u + 2.6).th; into = -Math.atan2(Math.sin(h1 - h0), Math.cos(h1 - h0)) * 0.25; }     // (B5: 0.25, was 0.55)   // (the heading jumps 2 pi where the loop closes)
    headYaw = S.turnLook && S.view === 'seat' ? headTurn(ours.yaw) * D2R : 0;     // (B1: the piece's face turns your head, not the car)
    look.yaw += (S.lookYaw * D2R + into + headYaw - look.yaw) * (snap ? 1 : 1 - Math.exp(-dt * 1.2));     // (B5: slower, 1.2, was 2.5)
    // a piece's gaze tilts your look up, eased in and out over its first and last 3 m (A3's grave; A4: no piece has one)
    const gp = path.pieceAt(ours.u), gs = path.wrap(ours.u) - gp.s0;
    const gaze = gp.gaze && S.turnLook ? gp.gaze * D2R * Math.min(clamp(gs / 3, 0, 1), clamp((gp.length - gs) / 3, 0, 1)) : 0;
    look.pitch += (S.lookPitch * D2R + gaze - look.pitch) * (snap ? 1 : 1 - Math.exp(-dt * 1.5));
    look.fov += (S.fov - look.fov) * k;
    // a little bounce from the rail joints
    // (B1: a big dt (the slider, Reset: 1 s) made this stiff spring blow up and threw the camera away: it is settled then, and otherwise
    // stepped in pieces of at most 1/120 s)
    if (snap || dt > 0.1) { bump.y = 0; bump.v = 0; jolt.a = 0; jolt.v = 0; }
    else for (let k = 0, nb = Math.ceil(dt * 120), db = dt / nb; k < nb; k++) { bump.v += (-bump.y * 140 - bump.v * 9) * db; bump.y += bump.v * db; jolt.v += (-jolt.a * 160 - jolt.v * 10) * db; jolt.a += jolt.v * db; }
    if (S.view === 'seat') {
      const m = ours.mesh, sp = R.POD.seat;                     // (A5: you sit in the pod, which turns on the chassis)
      const podQ = _q3.copy(m.quaternion);
      camPos.set(sp[0], sp[1] + bump.y, sp[2]).applyQuaternion(podQ).add(m.position);
      _e.set(look.pitch, 0, 0, 'XYZ');
      camQ.copy(_q1.setFromAxisAngle(_v.set(0, 1, 0), look.yaw)).multiply(podQ).multiply(BASEQ).multiply(_q2.setFromEuler(_e));   // (B3: the head turns about the vertical, so on the shafts' slopes the horizon stays level)
      camera.position.copy(camPos); camera.quaternion.copy(camQ);
    } else {
      const f = path.at(ours.u - 4.4);
      _v.set(f.x, f.y + 2.35, f.z);
      const tgt = _w.copy(ours.mesh.position).add(new THREE.Vector3(0, 0.8, 0));
      const ah = path.at(ours.u + 2.5); tgt.lerp(new THREE.Vector3(ah.x, ah.y + 0.8, ah.z), 0.45);
      if (snap) camera.position.copy(_v); else camera.position.lerp(_v, 1 - Math.exp(-dt * 3));
      camera.lookAt(tgt);
      camera.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), look.yaw - into);
      camera.rotateX(look.pitch);
    }
    if (Math.abs(camera.fov - look.fov) > 0.01) { camera.fov = look.fov; camera.updateProjectionMatrix(); }
  }

  // ------------------------------------------------------------------ the light pool
  const lightNames = new Set();
  function updateLights(dt) {
    const s = path.wrap(ours.u);
    const scored = R.specs.map(sp => { const a = path.wrap(sp.s - s); if (sp.to != null && path.wrap(s - sp.from) < sp.to - sp.from) return [0, sp]; return [a > L / 2 ? (L - a) * 3 : a, sp]; }).sort((x, y) => x[0] - y[0]);
    const want = new Set(scored.slice(0, NSLOT).map(x => x[1]));
    for (const sl of slots) {
      const keep = sl.spec && want.has(sl.spec);
      sl.level = clamp(sl.level + (keep ? 1 : -1) * dt * 2.2, 0, 1);
      if (!keep && sl.level === 0) sl.spec = null;
    }
    for (const sp of want) {
      if (slots.some(sl => sl.spec === sp)) continue;
      const sl = slots.find(x => !x.spec); if (!sl) continue;
      sl.spec = sp; sl.level = 0;
      const l = sl.light;
      l.position.copy(sp.pos); l.target.position.copy(sp.target); l.target.updateMatrixWorld();
      l.color.copy(sp.color); l.angle = sp.angle; l.penumbra = sp.penumbra; l.distance = sp.distance; l.map = sp.map;
      l.shadow.camera.near = sp.near || 0.3; l.shadow.camera.updateProjectionMatrix();
      const sm = sp.shadowSize || sl.sm;                              // (A10: the sun over the plains has a bigger shadow map)
      if (l.shadow.mapSize.x !== sm) { l.shadow.mapSize.set(sm, sm); if (l.shadow.map) { l.shadow.map.dispose(); l.shadow.map = null; } }
    }
    lightNames.clear();
    for (const sl of slots) {
      const sp = sl.spec;
      if (!sp) { sl.light.intensity = 0; continue; }
      lightNames.add(sp.name);
      if (sl.light.map !== sp.map) sl.light.map = sp.map;            // the glass changed
      if (sp.kind === 'sun') { sl.light.position.copy(sp.pos); sl.light.target.position.copy(sp.target); sl.light.target.updateMatrixWorld(); sl.light.angle = sp.angle; sl.light.shadow.camera.near = sp.near; }
      sl.light.intensity = sp.intensity * sl.level * (sp.kind === 'sun' ? S.sun : sp.kind === 'moon' ? S.sun * 1.7 : 1.7)
        * R.flicker(sp.seed, S.time, sp.flick != null ? sp.flick : sp.kind === 'candle' ? 0.4 : sp.kind === 'sun' ? 0.03 : 0.08);   // (B3: a light may say how much it flickers)     // (B2: every light flickers a little, the candles a lot)
    }
  }

  function draw() {
    if (!R) return;
    placeCars(); updateLights(lastDt);
    // B2: the work light is off in the bee cavern and the locust chamber and low in the crate store and the doll room (eased as you go)
    const hz = { dark: 0, approach: 0.25, bees: 0.12, plains: 0.12, crates: 0.6, dolls: 0.6, prison: 0.7, corner: 0.45, lift: 0.45, descent: 0.45, hall: 0.6, exit: 0.6, eyes: 0.3, lifthill: 0.7 }[path.pieceAt(ours.u).zone];     // (B5: dark between the rooms, never black)
    houseK += (Math.max(hz === 0 ? 0 : 0.12, hz != null ? hz : 1) - houseK)     // (CT72: the darkness beyond the room of eyes is black)
           // (B4: never quite black)
       * (1 - Math.exp(-Math.min(lastDt, 1) * 1.2));
    S.houseNow = S.house * houseK;
    house.intensity = S.lightsOn ? 2.2 : S.house * 1.6 * houseK * R.flicker(7.7, S.time, 0.05);
    allLight.intensity = S.lightsOn ? 1.6 : 0;
    scene.fog.density = S.lightsOn ? Math.min(S.fog, 0.008) : S.fog;
    for (const sl of slots) if (sl.light.castShadow !== S.shadows) sl.light.castShadow = S.shadows;     // (A3: Shadows on / off)
    { // the track light: only in the darkness, eased in; from just above the seat, down onto the rails a few metres ahead
      const inDark = path.pieceAt(ours.u).zone === 'dark' && !S.lightsOn ? 1 : 0;
      trackK += (inDark - trackK) * (1 - Math.exp(-Math.min(lastDt, 1) * 0.8));
      const f = path.frame(ours.u), a = path.frame(ours.u + 3.2);
      trackLight.position.copy(f.p).add(new THREE.Vector3(0, 2.0, 0)); trackLight.target.position.copy(a.p); trackLight.target.updateMatrixWorld();
      trackLight.intensity = 80 * trackK;
      carLight.position.copy(camera.position).add(new THREE.Vector3(0, 0.25, 0)).addScaledVector(f.t, 0.5); carLight.intensity = S.car && !S.lightsOn ? 5 : 0;
    }
    R.update(S.time, lastDt, camera, S, lightNames, cars);
    for (const c of cars) if (c.mesh && c.mesh.visible !== S.car) c.mesh.visible = S.car;
    fadeMat.opacity = S.fade ? R.fadeAt(ours.u) : 0; fadeSheet.visible = fadeMat.opacity > 0.002;
    renderer.render(scene, camera);
  }
  let lastDt = 1 / 60, houseK = 1, trackK = 0;

  // ------------------------------------------------------------------ mouse: drag = look round, wheel = zoom, double-click = look ahead
  {
    let drag = null;
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); canvas.classList.add('drag'); });
    canvas.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
      const k = look.fov / Math.max(200, canvas.clientHeight);
      S.lookYaw = clamp(S.lookYaw + dx * k, -180, 180); S.lookPitch = clamp(S.lookPitch + dy * k, -70, 70);
      notify();
    });
    const up = (e) => { drag = null; canvas.classList.remove('drag'); try { canvas.releasePointerCapture(e.pointerId); } catch { /* */ } };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); S.fov = clamp(S.fov * Math.exp(e.deltaY * 0.0008), 25, 110); notify(); }, { passive: false });
    canvas.addEventListener('dblclick', () => act('lookAhead'));
  }

  // ------------------------------------------------------------------ picture size
  let PW = 0, PH = 0, resizeT = 0;
  // CT72.A4: the picture's size follows the frame rate.  It starts at 1.6 million pixels (A3 drew up to 4K, far too much for a laptop's graphics:
  // about 20 fps), goes down a step when frames are slower than 40 fps and up again when they are faster than 57; a movie is always at full size.
  const AUTO = qs.get('auto') !== '0'; let budget = parseFloat(qs.get('mpix') || '1.6') * 1e6, fullRes = false;
  const adaptSt = { t: 0, n: 0, hold: 0 };
  function adapt(now, real) {
    if (!AUTO || S.recording || fullRes || document.hidden) { adaptSt.t = 0; return; }
    if (real > 0.4) { adaptSt.t = 0; return; }
    if (!adaptSt.t) { adaptSt.t = now; adaptSt.n = 0; return; }
    adaptSt.n++; if (now - adaptSt.t < 1200) return;
    const fps = adaptSt.n * 1000 / (now - adaptSt.t); adaptSt.t = now; adaptSt.n = 0;
    if (now < adaptSt.hold) return;
    if (fps < 40 && budget > 0.3e6) { budget *= Math.max(0.6, fps / 48); adaptSt.hold = now + 1500; fit(true); }
    else if (fps > 57 && budget < 8.3e6) { budget *= 1.15; adaptSt.hold = now + 3000; fit(true); }
  }
  function pictureSize() {
    if (qs.has('w') && qs.has('h')) return [Math.max(320, parseInt(qs.get('w'), 10) & ~1), Math.max(180, parseInt(qs.get('h'), 10) & ~1)];
    const dpr = window.devicePixelRatio || 1;
    let w = Math.max(320, stage.clientWidth * dpr), h = Math.max(180, stage.clientHeight * dpr);
    let s = Math.min(1, Math.sqrt(3840 * 2160 / (w * h)), 4096 / w, 2304 / h);
    if (!fullRes && AUTO) s = Math.min(s, Math.sqrt(budget / (w * h)));      // (CT72.A4: not more pixels than the machine can draw smoothly)
    return [Math.max(320, Math.floor(w * s / 2) * 2), Math.max(180, Math.floor(h * s / 2) * 2)];
  }
  function fit(quiet) {
    if (S.recording) return;
    const [w, h] = pictureSize();
    if (w === PW && h === PH) return;
    PW = w; PH = h; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    if (!quiet) { clearTimeout(resizeT); resizeT = setTimeout(prepareRecorder, 900); }
  }
  addEventListener('resize', fit);

  /** A5: the movie's size: the picture's shape, at most REC_W x REC_H (A9: the picture's own size again unless ?recw= ?rech=) */
  const REC_W = parseInt(qs.get('recw') || '99999', 10), REC_H = parseInt(qs.get('rech') || '99999', 10);
  function recSize() {
    const s = Math.min(1, REC_W / PW, REC_H / PH);
    return [Math.max(320, Math.floor(PW * s / 2) * 2), Math.max(180, Math.floor(PH * s / 2) * 2)];
  }
  // ------------------------------------------------------------------ recording (the CT55.A7 / CT58 recorder: WebCodecs H.264 + AAC, constant frame rate)
  const FPS_KEY = 'CT61.fps';
  let FPS = parseInt(qs.get('fps') || (() => { try { return localStorage.getItem(FPS_KEY); } catch { return null; } })() || '60', 10) === 30 ? 30 : 60;
  let take = null, recBusy = false, recReady = '', lastMovie = null;
  async function prepareRecorder() {
    if (!CT61Rec.supported()) { recReady = 'this browser cannot make movies (use Chrome or Edge)'; return; }
    recReady = 'preparing…';
    const [w, h] = recSize(), f = FPS;
    const pk = await CT61Rec.prepare(w, h, f, CT61Sound.SR);
    if (w === recSize()[0] && h === recSize()[1] && f === FPS) recReady = pk ? `${pk.name}${CT61Rec.audioPick ? ' + ' + (CT61Rec.audioPick.mux === 'aac' ? 'AAC' : 'Opus') + ' sound' : ' (no sound encoder)'}` : 'no video encoder works at this size';
  }
  async function startRecording() {
    if (recBusy || S.recording) return;
    if (!CT61Rec.supported()) { toast('This browser cannot make movies — use Chrome or Edge. Everything else works.'); return; }
    recBusy = true; fullRes = true; fit();
    toast('Starting the recorder…');
    const [w, h] = recSize();
    let pk = CT61Rec.cached(w, h, FPS);
    if (pk === undefined) pk = await CT61Rec.prepare(w, h, FPS, CT61Sound.SR);
    recBusy = false;
    if (!pk) { fullRes = false; toast('No video encoder works at ' + w + '×' + h + ' here. (' + CT61Rec.tried.slice(-3).join('; ') + ')'); return; }
    // the picture is drawn at the movie's size while recording (CSS scales it to the window); fit() puts it back afterwards
    if (w !== PW || h !== PH) { PW = w; PH = h; renderer.setSize(w, h, false); }
    try { take = CT61Rec.Take(canvas, w, h, FPS, CT61Sound.SR, pk, CT61Rec.audioPick); }
    catch (e) { toast('The recorder could not start: ' + (e && e.message || e)); fit(); return; }
    S.recording = true; speaker.setMode('film'); document.body.classList.add('recording');
    toast(`● Recording ${w}×${h}, ${FPS} fps, ${pk.name}, sound ${take.audio}${S.sound ? '' : ' (Sound is off: silent track)'}. Press Record again to stop and download the MP4.`, 5000);
    notify();
  }
  async function stopRecording() {
    if (!S.recording || !take) return;
    const t = take; take = null; S.recording = false; fullRes = false; speaker.setMode('live'); document.body.classList.remove('recording'); notify();
    if (t.frames === 0) { t.abort(); toast('Nothing was recorded.'); fit(); return; }
    toast(`Finishing the movie (${t.frames} frames)…`, 60000);
    let blob;
    try { blob = await t.finish(); } catch (e) { toast('The movie failed in the browser encoder: ' + (e && e.message || e), 12000); fit(); return; }
    const d = new Date(), p2 = (x) => String(x).padStart(2, '0');
    const name = `${LABEL}_movie_${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}.mp4`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 120000);
    lastMovie = { name, bytes: blob.size, frames: t.frames, seconds: t.seconds, w: t.w, h: t.h, fps: t.fps, codec: t.codec, audio: t.audio, mbps: t.mbps };
    $('toast').innerHTML = `Movie downloaded: <b>${name}</b> — ${t.seconds.toFixed(1)} s, ${t.w}×${t.h}, ${t.fps} fps, ${(blob.size / 1048576).toFixed(1)} MB (in your Downloads folder) · <a href="${url}" download="${name}">save another copy</a>`;
    $('toast').classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => $('toast').classList.remove('on'), 12000);
    fit();
  }

  // ------------------------------------------------------------------ actions (buttons, keys and MIDI all come here)
  const listeners = [];
  function notify() { refreshUI(); for (const f of listeners) try { f(); } catch { /* */ } }
  function reset() {
    if (!R) return;
    S.time = 0;
    // the cars never overtake, so the array keeps its order: each goes back to the place it started from (yours 3rd in line)
    const { us } = startPositions(cars.length);
    cars.forEach((c, i) => { c.u = us[i]; initStop(c); c.dispatched = null; c.dispatchU = null; });
    S.ended = false;
    settlePods();
    startMoving();
    S.startU = ours.u; joint = Math.floor(ours.u / 1.5);
    S.lookYaw = 0; S.lookPitch = 0; S.hold = false;
    placeCars(); updateCamera(1, true);
    toast('Reset: back at the start, before the room of eyes');
  }
  /** where the cars start: you 3rd in the station's line, three more behind you, one just dispatched and rolling into the
   *  corner, the rest out on the ride about as far apart as the dispatches put them */
  function startPositions(n) {
    const sD = stops.find(st => st.kind === 'dispatch').s, GAP = R.CAR_LEN + 1.1;
    const us = [];
    // (B4: you are FIRST in line, two cars behind you; the rest spread evenly round the ride ahead, so you hardly ever catch one up)
    for (let k = 0; k < 3; k++) us.push(sD - k * GAP);
    const nOut = n - 3, from = sD + L / (nOut + 1), to = sD + L * nOut / (nOut + 1);
    for (let k = 0; k < nOut; k++) us.push(from + (to - from) * k / Math.max(1, nOut - 1));
    us.sort((a, b) => a - b);
    return { us, ourU: sD, sD };
  }
  /** the cars out on the ride start at their speed (not from a standstill); the next dispatch is 1 s away */
  function startMoving() {
    for (const c of cars) { c.v = stops[c.stopIdx].kind === 'dispatch' && c.stopU - c.u < 30 ? 0 : path.pieceAt(c.u).speed * S.speed; c.wait = 0; }
    lastDispatch = -S.dispatchEvery + 1.0;
  }
  const ladderAct = {};
  for (const [k, vals] of Object.entries(LADDERS)) vals.forEach((v, i) => {
    ladderAct[k + 'At' + i] = () => {
      if (k === 'look') { S.lookYaw = v; S.lookPitch = 0; } else if (k === 'dispatch') S.dispatchEvery = v; else S[k] = v;
    };
  });
  const ACT = Object.assign({
    reset,
    forward() { S.playing = true; },
    pause() { S.playing = false; },
    playPause() { S.playing = !S.playing; },
    record() { if (S.recording) stopRecording(); else startRecording(); },
    stopAll() { S.hold = !S.hold; toast(S.hold ? 'Every car stops where it is' : 'The ride runs again'); },
    dispatchNow() { S.dispatchNow = true; toast('Dispatch: the car at the front of the station goes now'); },
    showStops() { S.showStops = !S.showStops; toast(S.showStops ? 'The cars stop at the show scenes' : 'No show stops (the station still dispatches)'); },
    faster() { S.speed = clamp(Math.round((S.speed + 0.1) * 20) / 20, 0, 3); },
    slower() { S.speed = clamp(Math.round((S.speed - 0.1) * 20) / 20, 0, 3); },
    sooner() { S.dispatchEvery = clamp(S.dispatchEvery - 1, 2, 30); },
    later() { S.dispatchEvery = clamp(S.dispatchEvery + 1, 2, 30); },
    view() { S.view = S.view === 'seat' ? 'behind' : 'seat'; updateCamera(1, true); toast(S.view === 'seat' ? 'From your seat' : 'From behind your car'); },
    lookAhead() { S.lookYaw = 0; S.lookPitch = 0; },
    lookLeft() { S.lookYaw = clamp(S.lookYaw + 30, -180, 180); },
    lookRight() { S.lookYaw = clamp(S.lookYaw - 30, -180, 180); },
    lookUp() { S.lookPitch = clamp(S.lookPitch + 12, -70, 70); },
    lookDown() { S.lookPitch = clamp(S.lookPitch - 12, -70, 70); },
    turnLook() { S.turnLook = !S.turnLook; toast(S.turnLook ? 'You look into the turns' : 'You look straight ahead in the turns'); },
    sunUp() { S.sun = clamp(Math.round((S.sun + 0.1) * 20) / 20, 0, 3); },
    sunDown() { S.sun = clamp(Math.round((S.sun - 0.1) * 20) / 20, 0, 3); },
    beamsUp() { S.beams = clamp(Math.round((S.beams + 0.1) * 20) / 20, 0, 4); },
    beamsDown() { S.beams = clamp(Math.round((S.beams - 0.1) * 20) / 20, 0, 4); },
    houseUp() { S.house = clamp(Math.round((S.house + 0.05) * 100) / 100, 0, 1.5); },
    houseDown() { S.house = clamp(Math.round((S.house - 0.05) * 100) / 100, 0, 1.5); },
    dust() { S.dust = !S.dust; },
    lights() { S.lightsOn = !S.lightsOn; toast(S.lightsOn ? 'Lights on: everything lit, nothing hidden in the dark' : 'Lights off: the ride as it is meant to be seen'); },
    car() { S.car = !S.car; toast(S.car ? 'Mine car shown' : 'Mine car hidden'); },
    shadows() { S.shadows = !S.shadows; toast(S.shadows ? 'Shadows on' : 'Shadows off'); },
    glass() { S.glass++; S.glassNames = R.setGlass(S.glass); toast('Other windows: ' + S.glassNames.join(', ')); },
    eyes() { S.eyes = !S.eyes; toast(S.eyes ? 'The eyes follow you' : 'The eyes look away'); },
    sound() { S.sound = !S.sound; synth.muted = !S.sound; if (S.sound) speaker.start(); },
    display() { S.bar = !S.bar; document.body.classList.toggle('nobar', !S.bar); setTimeout(fit, 30); },
    panels() { const on = !(S.bar || S.hud); S.bar = S.hud = on; document.body.classList.toggle('nobar', !on); document.body.classList.toggle('nohud', !on); setTimeout(fit, 30); },
    hud() { S.hud = !S.hud; document.body.classList.toggle('nohud', !S.hud); setTimeout(fit, 30); },
    gauge() { S.gauge = !S.gauge; document.body.classList.toggle('nogauge', !S.gauge); },
  }, ladderAct);
  function act(name, phase = 'press') {
    const f = ACT[name]; if (!f || phase === 'release') return;
    if (!R && name !== 'sound' && name !== 'display' && name !== 'hud' && name !== 'panels') return;
    f(); flash(name); notify();
  }
  const VALUES = {     // knob value 0..1 -> setting; encoder detent -> step
    speed: ['speed', (v) => v * 3, 0.05, 0, 3],
    sun: ['sun', (v) => v * 2, 0.05, 0, 3],
    beams: ['beams', (v) => v * 3, 0.05, 0, 4],
    house: ['house', (v) => v * v, 0.02, 0, 1.5],
    dispatch: ['dispatchEvery', (v) => 2 + v * 18, 0.5, 2, 30],
    lookYaw: ['lookYaw', (v) => (0.5 - v) * 360, 3, -180, 180],
    lookPitch: ['lookPitch', (v) => (v - 0.5) * 120, 2, -70, 70],
    fov: ['fov', (v) => 25 + v * 85, 1, 25, 110],
    fog: ['fog', (v) => v * 0.15, 0.004, 0, 0.3],
  };
  function setValue(name, how) {
    const d = VALUES[name]; if (!d) return;
    const [key, fromKnob, stepv, lo, hi] = d;
    if (how.value !== undefined) S[key] = clamp(fromKnob(clamp(how.value, 0, 1)), lo, hi);
    else S[key] = clamp(S[key] + Math.sign(how.delta) * Math.max(1, Math.round(Math.abs(how.delta))) * stepv * (name === 'lookYaw' ? -1 : 1), lo, hi);
    notify();
  }
  const isOn = (name) => {
    let m;
    if ((m = /^(\w+)At(\d)$/.exec(name)) && LADDERS[m[1]]) {
      const v = LADDERS[m[1]][+m[2]];
      if (m[1] === 'look') return Math.abs(S.lookYaw - v) < 1 && Math.abs(S.lookPitch) < 1;
      if (m[1] === 'dispatch') return S.dispatchEvery <= v;
      return S[m[1]] >= v - 1e-6;
    }
    return ({ forward: S.playing, pause: !S.playing, record: S.recording, stopAll: S.hold, showStops: S.showStops, view: S.view === 'behind', turnLook: S.turnLook,
      car: S.car, dust: S.dust, lights: S.lightsOn, shadows: S.shadows, eyes: S.eyes, sound: S.sound, display: S.bar, hud: S.hud, gauge: S.gauge, lookAhead: Math.abs(S.lookYaw) < 1 && Math.abs(S.lookPitch) < 1 })[name];
  };

  // ------------------------------------------------------------------ on-screen buttons and keys
  const btns = [...document.querySelectorAll('#bar button[data-action]')];
  let learnHook = null;
  for (const b of btns) {
    const name = b.dataset.action;
    b.addEventListener('pointerdown', (e) => { if (e.button !== 0) return; act(name, 'press'); });
    b.addEventListener('contextmenu', (e) => { e.preventDefault(); if (learnHook) learnHook(name, b); });
    b.addEventListener('click', (e) => e.preventDefault());
  }
  function flash(name) { const b = btns.find(x => x.dataset.action === name); if (b) { b.classList.add('hit'); setTimeout(() => b.classList.remove('hit'), 120); } }
  const KEYS = { Backspace: 'reset', Enter: 'forward', p: 'pause', ' ': 'playPause', r: 'record', x: 'stopAll', n: 'dispatchNow', s: 'showStops',
    '-': 'slower', '_': 'slower', '=': 'faster', '+': 'faster', '[': 'sooner', ']': 'later', v: 'view', Home: 'lookAhead', '0': 'lookAhead',
    ArrowLeft: 'lookLeft', ArrowRight: 'lookRight', ArrowUp: 'lookUp', ArrowDown: 'lookDown', t: 'turnLook',
    '1': 'sunDown', '2': 'sunUp', '3': 'beamsDown', '4': 'beamsUp', '5': 'houseDown', '6': 'houseUp', u: 'dust', c: 'car', l: 'lights', o: 'shadows', g: 'glass', e: 'eyes', m: 'sound', i: 'hud', h: 'panels', d: 'display', f: 'gauge' };
  const REPEATS = new Set(['faster', 'slower', 'sooner', 'later', 'lookLeft', 'lookRight', 'lookUp', 'lookDown', 'sunUp', 'sunDown', 'beamsUp', 'beamsDown', 'houseUp', 'houseDown']);
  addEventListener('keydown', (e) => {
    if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.key === 'Escape') { for (const p of document.querySelectorAll('.panel.on')) p.classList.remove('on'); return; }
    if (e.key === '?' || e.key === '/') { $('helpPanel').classList.toggle('on'); return; }
    const name = KEYS[e.key.length === 1 ? e.key.toLowerCase() : e.key];
    if (!name || e.ctrlKey || e.altKey || e.metaKey) return;
    e.preventDefault();
    if (e.repeat && !REPEATS.has(name)) return;
    act(name, 'press');
  });
  $('b_help').onclick = () => $('helpPanel').classList.toggle('on');
  $('b_panels').addEventListener('click', (e) => { e.preventDefault(); act('panels'); });
  for (const x of document.querySelectorAll('[data-close]')) x.onclick = () => x.closest('.panel').classList.remove('on');
  $('fpsSel').value = String(FPS);
  $('fpsSel').onchange = () => { if (S.recording) { $('fpsSel').value = String(FPS); toast('Stop recording first'); return; } FPS = parseInt($('fpsSel').value, 10); try { localStorage.setItem(FPS_KEY, String(FPS)); } catch { /* */ } prepareRecorder(); };

  const fmtTime = (t) => { const m = Math.floor(t / 60), s = t - m * 60; return `${String(m).padStart(2, '0')}:${s.toFixed(1).padStart(4, '0')}`; };
  function refreshUI() {
    for (const b of btns) { const on = isOn(b.dataset.action); if (on !== undefined) b.classList.toggle('on', !!on); }
    $('v_speed').textContent = S.speed.toFixed(2) + '×';
    $('v_every').textContent = S.dispatchEvery.toFixed(S.dispatchEvery % 1 ? 1 : 0) + ' s';
    $('v_sun').textContent = Math.round(S.sun * 100) + '%';
    $('v_beams').textContent = Math.round(S.beams * 100) + '%';
    $('v_house').textContent = Math.round(S.house * 100) + '%';
    $('t_view').textContent = S.view === 'seat' ? 'View: seat' : 'View: behind';
  }
  let toastT = 0;
  function toast(msg, ms = 2600) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), ms); }

  // ------------------------------------------------------------------ HUD text
  const perf = { n: 0, t0: 0, fps: 0 };
  let midiLine = '';
  function status() {
    const st = stops[ours.stopIdx], dist = ours.stopU - ours.u;
    if (S.ended) return 'the ride is over (Reset to ride again)';
    if (S.hold) return 'held (Stop all)';
    if (st.kind === 'dispatch' && dist < 25) {
      const sD = st.s, mine = path.wrap(sD - ours.u + 0.01);
      const ahead = cars.filter(c => c !== ours && path.wrap(sD - c.u + 0.01) < mine).length;
      if (dist < 0.05) return `at the front: dispatch in ${Math.max(0, S.dispatchEvery - (S.time - lastDispatch)).toFixed(1)} s`;
      if (ours.v < 0.02) return `waiting in the station, ${ahead + 1}${['st', 'nd', 'rd'][ahead] || 'th'} in line`;
      return `moving up in the station, ${ahead + 1}${['st', 'nd', 'rd'][ahead] || 'th'} in line`;
    }
    if (dist < 0.05 && st.kind === 'show' && S.showStops) return `stopped in ${st.name} (${(st.hold - ours.wait).toFixed(1)} s)`;
    if (ours.v < 0.02) return 'stopped behind the car ahead';
    return 'moving';
  }
  /** B6: the length of the ride: from the dispatch point round to where it ends in the entry way */
  const rideLen = () => path.wrap(R.endS - stops.find(st => st.kind === 'dispatch').s);
  /** how far round the ride you are: from the dispatch point (0 until your car has been dispatched since Reset) */
  const FT = 3.28084;
  function rideGauge() {
    if (!R || !S.gauge) return;
    const sD = stops.find(st => st.kind === 'dispatch').s;
    const RL = rideLen(), d = S.ended ? RL : ours.dispatchU != null ? clamp(ours.u - ours.dispatchU, 0, RL) : 0, f = d / RL;     // (B6: the ride is dispatch to the end, in the entry way)
    $('g_pct').textContent = (f * 100).toFixed(0) + '%';
    $('g_ft').textContent = `${Math.round(d * FT)} ft of ${Math.round(RL * FT)} ft`;
    $('g_where').textContent = ours.dispatched != null ? R.ZONE_NAME[path.pieceAt(ours.u).zone] || '' : 'boarding';
    $('g_fill').style.width = (f * 100).toFixed(2) + '%';
    if (!seeking) $('g_seek').value = Math.round(f * 1000);
  }
  /** A5: the slider moves the whole train along the track (every car by the same amount, so their spacing stays) and puts your car
   *  that far round the ride from the dispatch point, dispatched; the pods face and the bars are set for where each car lands */
  let seeking = false;
  function seekTo(f) {
    if (!R) return;
    const sD = stops.find(st => st.kind === 'dispatch').s;
    const d = path.wrap(sD + clamp(f, 0, 0.999) * rideLen() - ours.u);
    for (const c of cars) { c.u += d; initStop(c); }
    if (ours.dispatched == null) ours.dispatched = S.time;
    ours.dispatchU = ours.u - path.wrap(ours.u - sD); S.ended = false;      // (B6: as if dispatched this lap)
    settlePods();
    for (const c of cars) c.v = path.pieceAt(c.u).speed * S.speed * (stops[c.stopIdx].kind === 'dispatch' && c.stopU - c.u < 3 ? 0 : 1);
    joint = Math.floor(ours.u / 1.5);
    placeCars(); updateCamera(1, true); rideGauge();
  }
  {
    const el = $('g_seek');
    el.addEventListener('pointerdown', () => { seeking = true; });
    el.addEventListener('input', () => { seeking = true; seekTo(el.value / 1000); });
    el.addEventListener('change', () => { seeking = false; el.blur(); });
    el.addEventListener('pointerup', () => { seeking = false; el.blur(); });
    el.addEventListener('keydown', (e) => e.stopPropagation());
  }
  function hud(now) {
    perf.n++; if (now - perf.t0 > 500) { perf.fps = perf.n * 1000 / (now - perf.t0); perf.n = 0; perf.t0 = now; }
    $('v_timer').textContent = fmtTime(S.time);
    rideGauge();
    if (S.recording && take) $('recTime').textContent = `${Math.floor(take.seconds / 60)}:${String(Math.floor(take.seconds) % 60).padStart(2, '0')}`;
    if (!S.hud || perf.n % 6 || !R) return;
    const piece = path.pieceAt(ours.u), lap = Math.floor((ours.u - S.startU) / L) + 1;
    const ahead = cars[(cars.indexOf(ours) + 1) % cars.length], gap = path.wrap(ahead.u - ours.u) - R.CAR_LEN;
    const inStation = cars.filter(c => path.pieceAt(c.u).zone === 'station').length;
    const lines = [];
    lines.push(`<b>${LABEL}</b>  ${S.playing ? '▶' : '❚❚ paused'}  ${fmtTime(S.time)}`);
    lines.push(`car <b>#${ours.num}</b> in ${R.ZONE_NAME[piece.zone] || piece.zone} · ${ours.v.toFixed(2)} m/s · ${status()}`);
    lines.push(`car #${ahead.num} ahead, ${gap.toFixed(1)} m · ride ${(path.wrap(ours.u - S.startU) / L * 100).toFixed(0)}% of ${L.toFixed(0)} m, lap ${lap} · ${cars.length} cars, ${inStation} in the station · dispatch every ${S.dispatchEvery} s`);
    lines.push(`lights: ${[...lightNames].join(', ') || '—'} · sun ${Math.round(S.sun * 100)}% · shafts ${Math.round(S.beams * 100)}%${S.dust ? ' · dust' : ''}`);
    lines.push(S.recording && take ? `<b>● REC</b> ${take.seconds.toFixed(1)} s · ${take.frames} frames · ${take.w}×${take.h} @ ${take.fps} · ${take.codec} · ${take.mbps.toFixed(0)} Mbit/s${take.failed ? ' · ERROR ' + take.failed : ''}`
      : `movie: ${recSize().join('×')} @ ${FPS} fps · ${recReady}`);
    lines.push(`${perf.fps.toFixed(0)} fps · ${renderer.info.render.calls} draws · ${midiLine}`);
    $('hud').innerHTML = lines.join('\n');
  }

  // ------------------------------------------------------------------ the frame loop
  let lastTick = 0, frozen = false;
  function tick(now) {
    requestAnimationFrame(tick);
    if (frozen) { lastTick = 0; return; }
    const filming = S.recording && take;
    if (filming) {
      if (now - lastTick < 1000 / FPS - 2) return;
      if (take.busy()) return;
      lastTick = now;
      const dt = 1 / FPS; lastDt = dt;
      if (S.playing) step(dt);
      updateCamera(dt); draw();
      if (!take) return;
      const audio = synth.render(take.samplesForNextFrame());
      take.add(audio); speaker.feed(audio);
    } else {
      // CT72.A4: the ride keeps real time even when frames are slow: up to 0.5 s is covered, in steps of at most 1/20 s (A3 stopped at 0.1 s, so under 10 fps the ride ran in slow motion)
      const real = lastTick ? Math.min(0.5, Math.max(0.001, (now - lastTick) / 1000)) : 1 / 60, ns = Math.max(1, Math.ceil(real / 0.05)), dt = real / ns;
      lastTick = now; lastDt = Math.min(0.1, real);
      if (S.playing) for (let k = 0; k < ns; k++) step(dt);
      updateCamera(Math.min(0.1, real)); draw(); adapt(now, real);
    }
    hud(now);
  }

  window.CT61 = {
    LABEL, S, LADDERS, act, setValue, isOn, onChange: (f) => listeners.push(f), toast, synth, speaker, notify,
    setMidiLine(t) { midiLine = t; }, setLearnHook(f) { learnHook = f; }, buttons: btns,
    get ride() { return R; }, get cars() { return cars; }, get ours() { return ours; }, get slots() { return slots; }, get picture() { return [PW, PH]; }, get fps() { return FPS; },
    get take() { return take; }, get lastMovie() { return lastMovie; }, get recReady() { return recReady; },
    renderer, scene, camera, step, updateCamera, draw, freeze(v) { frozen = !!v; }, status: () => status(),
    stepTo(sec, dt = 1 / 30) { for (let t = 0; t < sec; t += dt) { step(dt); lastDt = dt; updateCamera(dt); updateLights(dt); } draw(); },
  };

  if (!S.gauge) document.body.classList.add('nogauge');
  fit();
  setTimeout(prepareRecorder, 1500);
  notify();
})();
