/* CT61.B6.Darkride -- the core: shared helpers every room module uses (B6: split out of B5's ride.js unchanged).
 *   the track path (integrate, makePath(layout)), procedural canvas textures, geometry helpers (ribbon, merge, frameBox, doorWall),
 *   the mine's rock (rockD, rockGeo, tunnelGeo, rockPanel, portal), pictures (loadImage, loadAssets, archCanvas, boardAsset, leadedAsset, softSpot,
 *   halo), flicker.  Exposed as window.CT61Core.  No room is built here.
 *
 * Coordinates: three.js, y up, metres.  A piece heading th moves along (cos th, 0, sin th); its left is (sin th, 0, -cos th).
 */
(function () {
  'use strict';
  const T = THREE;
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const rng = (seed) => { let s = seed >>> 0 || 1; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; };
  const UP = new T.Vector3(0, 1, 0);
  const D2R = Math.PI / 180;

  // ------------------------------------------------------------------ the path
  const DS = 0.05;
  function integrate(pieces) {
    let x = 0, y = 0, z = 0, th = 0, s = 0;
    const S = [0], X = [0], Y = [0], Z = [0], TH = [0];
    for (const p of pieces) {
      p.s0 = s; p.th0 = th; p.y0 = y; p.x0 = x; p.z0 = z;
      const len = p.kind === 'T' ? p.r * Math.abs(p.ang) * Math.PI / 180 : p.len;
      p.length = len;
      const n = Math.max(1, Math.ceil(len / DS)), ds = len / n, dth = p.kind === 'T' ? -(p.ang * Math.PI / 180) / n : 0, rise = p.rise || 0;
      for (let k = 1; k <= n; k++) {
        const tm = th + dth / 2;
        x += ds * Math.cos(tm); z += ds * Math.sin(tm); th += dth; s += ds;
        const u = k / n, e = p.ease === 'lin' ? u : p.ease === 'in' ? u * u : p.ease === 'out' ? 1 - (1 - u) * (1 - u) : sstep(0, 1, u);   // (B5: grades that run on from piece to piece)
        S.push(s); X.push(x); Y.push(p.y0 + rise * e); Z.push(z); TH.push(th);
      }
      y = p.y0 + rise; p.s1 = s;
    }
    return { S, X, Y, Z, TH, L: s, end: { x, y, z, th } };
  }
  function makePath(LAYOUT) {
    const pieces = LAYOUT.map(p => Object.assign({}, p));
    let r = integrate(pieces);
    const fa = pieces.find(p => p.fit === 0), fb = pieces.find(p => p.fit === 1);
    // end = e0 + a * dirA + b * dirB  ->  (0, 0)
    const ax = Math.cos(fa.th0), az = Math.sin(fa.th0), bx = Math.cos(fb.th0), bz = Math.sin(fb.th0);
    const det = ax * bz - az * bx, ex = -r.end.x, ez = -r.end.z;
    fa.len = (ex * bz - ez * bx) / det; fb.len = (ax * ez - az * ex) / det;
    if (!(fa.len > 0.5 && fb.len > 0.5)) console.warn('CT61 layout does not close well', fa.len, fb.len);
    r = integrate(pieces);
    const { S, X, Y, Z, TH, L } = r;
    const N = S.length;
    function idx(s) { let lo = 0, hi = N - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (S[m] <= s) lo = m; else hi = m; } return lo; }
    const wrap = (s) => ((s % L) + L) % L;
    /** the track at s: point (floor level), heading, out = {x,y,z,th} */
    function at(s, out = {}) {
      s = wrap(s);
      const i = idx(s), j = Math.min(N - 1, i + 1), f = S[j] > S[i] ? (s - S[i]) / (S[j] - S[i]) : 0;
      out.x = X[i] + (X[j] - X[i]) * f; out.y = Y[i] + (Y[j] - Y[i]) * f; out.z = Z[i] + (Z[j] - Z[i]) * f; out.th = TH[i] + (TH[j] - TH[i]) * f;
      return out;
    }
    function frame(s) {
      const a = at(s);
      return { p: new T.Vector3(a.x, a.y, a.z), t: new T.Vector3(Math.cos(a.th), 0, Math.sin(a.th)), l: new T.Vector3(Math.sin(a.th), 0, -Math.cos(a.th)), th: a.th };
    }
    function pieceAt(s) { s = wrap(s); for (const p of pieces) if (s < p.s1) return p; return pieces[pieces.length - 1]; }
    return { pieces, L, at, frame, pieceAt, wrap, closeErr: Math.hypot(r.end.x, r.end.z), endTh: r.end.th };
  }

  // ------------------------------------------------------------------ procedural textures (canvas)
  function noiseField(R, n, oct) {          // value noise, n x n, tiling
    const out = new Float32Array(n * n);
    let amp = 1, tot = 0;
    for (let o = 0; o < oct; o++) {
      const g = 4 << o, grid = new Float32Array(g * g);
      for (let i = 0; i < g * g; i++) grid[i] = R();
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const fx = x / n * g, fy = y / n * g, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
        const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
        const a = grid[(y0 % g) * g + x0 % g], b = grid[(y0 % g) * g + (x0 + 1) % g], c = grid[((y0 + 1) % g) * g + x0 % g], d = grid[((y0 + 1) % g) * g + (x0 + 1) % g];
        out[y * n + x] += amp * (a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy);
      }
      tot += amp; amp *= 0.5;
    }
    for (let i = 0; i < n * n; i++) out[i] /= tot;
    return out;
  }
  const hex = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
  function texCanvas(kind, seed = 7) {
    const n = 512, cv = document.createElement('canvas'); cv.width = cv.height = n;
    const g = cv.getContext('2d'), R = rng(seed + kind.length * 101);
    const nf = noiseField(R, n, 6);
    const img = g.createImageData(n, n), d = img.data;
    const base = { comb: 0x5a3408, concrete: 0x2c2c2e, stone: 0x4b4741, plaster: 0x3f463f, black: 0x111113, panel: 0x2a1a12, velvet: 0x4a0a10, tile: 0x1d4a4c, ochre: 0x5e4526, wood: 0x2b1c13, crypt: 0x34312d,
      rock: 0x62564a, dirt: 0x463a2f, rust: 0x8a5230, timber: 0x5c4630, planks: 0x4e3a28 }[kind] || 0x333333;
    const [br, bg, bb] = hex(base);
    const nf2 = (kind === 'rock' || kind === 'rust' || kind === 'dirt') ? noiseField(R, n, 5) : null;     // (B1) a second field: veins, rust patches, damp
    const ALT = { rock: [0x2a2622, 0x7a5a36], rust: [0x2e2824, 0x9a5426], dirt: [0x2a221c, 0x5a4a38] }[kind];
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const i = y * n + x, v = nf[i];
      let k = 0.75 + (v - 0.5) * (kind === 'black' ? 0.5 : 0.9);
      if (kind === 'velvet') k *= 0.65 + 0.35 * Math.pow(Math.abs(Math.sin(x / n * Math.PI * 9 + v * 2)), 0.6);     // folds
      if (kind === 'panel' || kind === 'wood' || kind === 'timber' || kind === 'planks') k *= 0.85 + 0.25 * Math.sin((kind === 'panel' ? x : y) / n * 220 + v * 30) * 0.5;   // grain
      let r = br, gg = bg, b = bb;
      if (nf2) {      // (B1) rock: dark damp patches and ochre veins; rust: bare iron vs orange rust; dirt: damp and dry
        const w = nf2[i], [a0, a1] = ALT.map(hex);
        const dark = sstep(0.42, 0.3, w), vein = kind === 'rock' ? Math.pow(Math.max(0, 1 - Math.abs(w - 0.62) * 22), 2) * 0.8 : sstep(0.58, 0.72, w);
        r = r + (a0[0] - r) * dark + (a1[0] - r) * vein; gg = gg + (a0[1] - gg) * dark + (a1[1] - gg) * vein; b = b + (a0[2] - b) * dark + (a1[2] - b) * vein;
        if (kind === 'rock') k *= 0.88 + 0.12 * Math.sin(y / n * 40 + v * 9);           // faint strata
      }
      d[i * 4] = clamp(r * k, 0, 255); d[i * 4 + 1] = clamp(gg * k, 0, 255); d[i * 4 + 2] = clamp(b * k, 0, 255); d[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    g.globalAlpha = 1;
    if (kind === 'rock') {          // (B1) cracks, pick marks and mineral flecks
      for (let c = 0; c < 26; c++) {
        let x = R() * n, y = R() * n, a = R() * 6.28;
        g.strokeStyle = `rgba(10,8,6,${0.35 + R() * 0.45})`; g.lineWidth = 1 + R() * 2.2; g.beginPath(); g.moveTo(x, y);
        for (let s = 0, m = 4 + R() * 10; s < m; s++) { a += (R() - 0.5) * 1.3; x += Math.cos(a) * 14; y += Math.sin(a) * 14; g.lineTo(x, y); }
        g.stroke();
      }
      for (let c = 0; c < 140; c++) { const x = R() * n, y = R() * n; g.fillStyle = `rgba(0,0,0,${0.15 + R() * 0.2})`; g.fillRect(x, y, 3 + R() * 9, 1.5 + R() * 2); }   // pick marks
      for (let c = 0; c < 400; c++) { g.fillStyle = R() < 0.7 ? `rgba(200,190,160,${R() * 0.35})` : `rgba(220,170,60,${R() * 0.5})`; g.fillRect(R() * n, R() * n, 1.5, 1.5); }
    } else if (kind === 'dirt') {   // pebbles and grit
      for (let c = 0; c < 900; c++) { const x = R() * n, y = R() * n, r = 1 + R() * R() * 7, t = R();
        g.fillStyle = t < 0.5 ? `rgba(110,98,84,${0.3 + R() * 0.4})` : `rgba(15,12,10,${0.3 + R() * 0.4})`; g.beginPath(); g.ellipse(x, y, r, r * (0.6 + R() * 0.4), R() * 3, 0, 6.3); g.fill(); }
    } else if (kind === 'rust') {   // rust streaks running down, and rows of rivets
      for (let c = 0; c < 70; c++) { const x = R() * n, y = R() * n, l = 20 + R() * 120; const gr = g.createLinearGradient(0, y, 0, y + l);
        gr.addColorStop(0, `rgba(130,60,20,${0.2 + R() * 0.3})`); gr.addColorStop(1, 'rgba(130,60,20,0)'); g.fillStyle = gr; g.fillRect(x, y, 2 + R() * 4, l); }
      // (B2) very old: scabs of rust, pitting, flakes of the old paint, scratches and dents' dark rims, grime
      for (let c = 0; c < 90; c++) { const x = R() * n, y = R() * n, r = 6 + R() * 30; const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, `rgba(${90 + R() * 60},${38 + R() * 20},${12},${0.5 + R() * 0.4})`); gr.addColorStop(1, 'rgba(90,40,12,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
      for (let c = 0; c < 1800; c++) { g.fillStyle = `rgba(${R() < 0.4 ? '30,18,10' : '190,110,55'},${0.25 + R() * 0.4})`; g.fillRect(R() * n, R() * n, 1 + R() * 2.5, 1 + R() * 2.5); }
      for (let c = 0; c < 60; c++) { const x = R() * n, y = R() * n; g.fillStyle = R() < 0.5 ? `rgba(${110 + R() * 40},${118 + R() * 30},${96 + R() * 20},${0.45 + R() * 0.3})` : `rgba(${170 + R() * 40},${120 + R() * 30},${60 + R() * 20},${0.45 + R() * 0.3})`;
        g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 7; k++) g.lineTo(x + (R() - 0.5) * 40, y + (R() - 0.5) * 30); g.fill(); }
      for (let c = 0; c < 40; c++) { const x = R() * n, y = R() * n, a = R() * 6.3; g.strokeStyle = `rgba(200,150,110,${0.15 + R() * 0.2})`; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 60, y + Math.sin(a) * 60); g.stroke(); }
      for (let c = 0; c < 18; c++) { const x = R() * n, y = R() * n, r = 8 + R() * 22; g.strokeStyle = 'rgba(15,8,4,0.55)'; g.lineWidth = 2 + R() * 3; g.beginPath(); g.ellipse(x, y, r, r * (0.5 + R() * 0.5), R() * 3, 0.3, 2.6 + R() * 2); g.stroke(); }
      for (let row = 32; row < n; row += 128) for (let x = 12; x < n; x += 32) { g.fillStyle = 'rgba(20,14,10,0.75)'; g.beginPath(); g.arc(x, row, 4, 0, 6.3); g.fill(); g.fillStyle = 'rgba(170,110,60,0.5)'; g.beginPath(); g.arc(x - 1, row - 1, 2, 0, 6.3); g.fill(); }
    } else if (kind === 'timber' || kind === 'planks') {   // plank seams, knots, splits
      g.fillStyle = 'rgba(0,0,0,0.7)';
      if (kind === 'planks') for (let k = 0; k < n; k += 64) g.fillRect(k, 0, 4, n);
      for (let c = 0; c < 14; c++) { const x = R() * n, y = R() * n; g.fillStyle = 'rgba(20,12,6,0.6)'; g.beginPath(); g.ellipse(x, y, 4 + R() * 6, 8 + R() * 10, 0, 0, 6.3); g.fill(); }
      for (let c = 0; c < 20; c++) { const x = R() * n, y = R() * n; g.fillStyle = 'rgba(8,5,3,0.7)'; g.fillRect(x, y, 1.5, 30 + R() * 90); }
      if (kind === 'planks') for (let c = 0; c < 26; c++) { const x = R() * n, y = R() * n, r = 10 + R() * 40; const gr = g.createRadialGradient(x, y, 0, x, y, r);   // (B2) rot and mould
        gr.addColorStop(0, `rgba(${R() < 0.5 ? '10,8,5' : '60,66,50'},0.6)`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
    } else if (kind === 'stone' || kind === 'crypt') {     // flagstones (and the crypt's ashlar): rows of stones, dark grout, each stone its own tint
      for (let row = 0, y = 0; row < 6; row++) {
        const h = n / 6; let x = -R() * 80;
        while (x < n) {
          const w = 60 + R() * 110, t = R();
          g.fillStyle = `rgba(${t < 0.5 ? '0,0,0' : '255,240,220'},${0.04 + R() * 0.1})`; g.fillRect(x, y, w, h);
          g.fillStyle = 'rgba(8,7,6,0.85)'; g.fillRect(x, y, 3, h);
          x += w;
        }
        g.fillStyle = 'rgba(8,7,6,0.85)'; g.fillRect(0, y, n, 3);
        y += h;
      }
    } else if (kind === 'comb') {     // honeycomb: wax hexagons, 16 across, dark rims, honey in some, pale caps on others
      const cols = 16, rows = 18, dx = n / cols, dy = n / rows, r = dx / Math.sqrt(3);
      const hexPath = (x, y, s) => { g.beginPath(); for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; g.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s * dy / (1.5 * r)); } g.closePath(); };
      for (let row = -1; row <= rows; row++) for (let col = -1; col <= cols; col++) {
        const x = (col + (row & 1 ? 0.5 : 0)) * dx, y = row * dy, t = R();
        hexPath(x, y, r * 0.86);
        g.fillStyle = t < 0.3 ? `rgba(225,170,70,${0.55 + R() * 0.3})` : t < 0.75 ? `rgba(150,80,10,${0.35 + R() * 0.4})` : `rgba(20,10,2,${0.4 + R() * 0.3})`;
        g.fill();
        g.lineWidth = 3; g.strokeStyle = 'rgba(40,20,4,0.9)'; g.stroke();
        if (t < 0.3) { hexPath(x - r * 0.2, y - r * 0.2, r * 0.3); g.fillStyle = 'rgba(255,235,180,0.25)'; g.fill(); }     // the shine on a cap
      }
    } else if (kind === 'tile') {
      g.fillStyle = 'rgba(5,15,16,0.8)';
      for (let k = 0; k < n; k += 32) { g.fillRect(k, 0, 2, n); g.fillRect(0, k, n, 2); }
      for (let k = 0; k < 220; k++) { g.fillStyle = `rgba(${R() < 0.5 ? '120,220,210' : '0,0,0'},${R() * 0.18})`; g.fillRect(Math.floor(R() * 16) * 32 + 2, Math.floor(R() * 16) * 32 + 2, 30, 30); }
    } else if (kind === 'panel') {
      g.fillStyle = 'rgba(0,0,0,0.6)';
      for (let k = 0; k < n; k += 64) g.fillRect(k, 0, 3, n);
    } else if (kind === 'wood') {
      g.fillStyle = 'rgba(0,0,0,0.65)';
      for (let k = 0; k < n; k += 85) g.fillRect(0, k, n, 4);
    }
    if (kind === 'plaster' || kind === 'ochre') {     // wainscot: dark panelling in the bottom quarter, a rail on top (v = 0 at the floor)
      const top = n * 0.76;
      g.fillStyle = kind === 'plaster' ? 'rgba(26,16,10,0.93)' : 'rgba(40,22,12,0.9)'; g.fillRect(0, top, n, n - top);
      g.fillStyle = 'rgba(0,0,0,0.55)'; for (let k = 0; k < n; k += 128) { g.fillRect(k + 14, top + 18, 100, n - top - 36); }
      g.fillStyle = 'rgba(255,220,170,0.05)'; for (let k = 0; k < n; k += 128) { g.fillRect(k + 18, top + 22, 92, n - top - 44); }
      g.fillStyle = 'rgba(80,52,30,1)'; g.fillRect(0, top - 8, n, 10);
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(0, top + 2, n, 3);
    }
    return cv;
  }
  function canvasTexture(cv, repeat = true) {
    const t = new T.CanvasTexture(cv);
    t.colorSpace = T.SRGBColorSpace; t.anisotropy = 8;
    if (repeat) t.wrapS = t.wrapT = T.RepeatWrapping;
    return t;
  }

  // ------------------------------------------------------------------ geometry helpers
  /** a strip along the track from s0 to s1; prof = [[lat, up], ...]; each profile segment gets its own flat-shaded strip. */
  function ribbon(path, s0, s1, prof, uTile = 2, vTile = 2, step = 0.2) {
    const n = Math.max(1, Math.ceil((s1 - s0) / step)), pos = [], nor = [], uv = [], ind = [];
    const frames = [];
    for (let i = 0; i <= n; i++) { const s = s0 + (s1 - s0) * i / n; frames.push([s, path.frame(s)]); }
    for (let j = 0; j + 1 < prof.length; j++) {
      const [la, ua] = prof[j], [lb, ub] = prof[j + 1];
      const vert = Math.abs(ub - ua) > Math.abs(lb - la);
      const base = pos.length / 3;
      for (const [s, f] of frames) {
        const q = new T.Vector3().addScaledVector(f.l, lb - la).addScaledVector(UP, ub - ua).normalize();
        const nn = new T.Vector3().crossVectors(q, f.t).normalize();
        for (const [lat, up] of [[la, ua], [lb, ub]]) {
          pos.push(f.p.x + f.l.x * lat, f.p.y + up, f.p.z + f.l.z * lat);
          nor.push(nn.x, nn.y, nn.z);
          uv.push(s / uTile, (vert ? up : lat) / vTile);
        }
      }
      for (let i = 0; i < n; i++) {
        const a = base + i * 2, b = a + 2, c = a + 1, d = b + 1;
        ind.push(a, c, b, b, c, d);
      }
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
    geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    geo.setIndex(ind);
    return geo;
  }
  function merge(geos) {
    let nv = 0, ni = 0;
    for (const g of geos) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), ind = new Uint32Array(ni);
    let ov = 0, oi = 0;
    for (const g of geos) {
      const c = g.attributes.position.count;
      pos.set(g.attributes.position.array, ov * 3); nor.set(g.attributes.normal.array, ov * 3);
      if (g.attributes.uv) uv.set(g.attributes.uv.array, ov * 2);
      if (g.index) { const a = g.index.array; for (let i = 0; i < a.length; i++) ind[oi + i] = a[i] + ov; oi += a.length; }
      else { for (let i = 0; i < c; i++) ind[oi + i] = ov + i; oi += c; }
      ov += c;
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new T.BufferAttribute(nor, 3));
    geo.setAttribute('uv', new T.BufferAttribute(uv, 2));
    geo.setIndex(new T.BufferAttribute(ind, 1));
    return geo;
  }
  /** a box in the frame (l, up, t) at point p: lat / up / along = centre offsets, w / h / d = sizes; uv scaled to metres */
  function frameBox(p, l, t, lat, up, along, w, h, d, tile = 2) {
    const g = new T.BoxGeometry(w, h, d);
    const uv = g.attributes.uv, P = g.attributes.position, N = g.attributes.normal;
    for (let i = 0; i < uv.count; i++) {        // world-ish uv: by the two axes the face spans
      const nx = Math.abs(N.getX(i)), ny = Math.abs(N.getY(i));
      const a = nx > 0.5 ? P.getZ(i) : P.getX(i), b = ny > 0.5 ? P.getZ(i) : P.getY(i);
      uv.setXY(i, (a + lat + along) / tile, (b + up) / tile);
    }
    const m = new T.Matrix4().makeBasis(l, UP, t).setPosition(p.clone().addScaledVector(l, lat).addScaledVector(UP, up).addScaledVector(t, along));
    g.applyMatrix4(m);
    return g;
  }
  /** a wall across the track at frame f covering [-hwB, hwB] x [0, hB] with a doorway [-hwS, hwS] x [0, hS] (lat offset c) */
  function doorWall(f, hwB, hB, hwS, hS, c = 0, thick = 0.2, latMin = -hwB, latMax = hwB) {
    const out = [];
    const L0 = c - hwS, L1 = c + hwS;
    if (latMax - L1 > 0.01) out.push(frameBox(f.p, f.l, f.t, (L1 + latMax) / 2, hB / 2, 0, latMax - L1, hB, thick));
    if (L0 - latMin > 0.01) out.push(frameBox(f.p, f.l, f.t, (latMin + L0) / 2, hB / 2, 0, L0 - latMin, hB, thick));
    if (hB - hS > 0.01) out.push(frameBox(f.p, f.l, f.t, c, (hS + hB) / 2, 0, L1 - L0, hB - hS, thick));
    return out;
  }

  // ------------------------------------------------------------------ B1: the mine's rock
  /** smooth 3D value noise 0..1 (world position in metres), three octaves: the one field all the rock is pushed out by, so pieces meet */
  function hash3(x, y, z) { let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1440662683); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function vnoise(x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), tx = x - xi, ty = y - yi, tz = z - zi;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty), sz = tz * tz * (3 - 2 * tz);
    const L = (a, b, t) => a + (b - a) * t;
    const c = (i, j, k) => hash3(xi + i, yi + j, zi + k);
    return L(L(L(c(0, 0, 0), c(1, 0, 0), sx), L(c(0, 1, 0), c(1, 1, 0), sx), sy), L(L(c(0, 0, 1), c(1, 0, 1), sx), L(c(0, 1, 1), c(1, 1, 1), sx), sy), sz);
  }
  const rockN = (x, y, z) => 0.5 * vnoise(x * 0.7, y * 0.7, z * 0.7) + 0.32 * vnoise(x * 1.9 + 17, y * 1.9, z * 1.9) + 0.18 * vnoise(x * 4.7 + 31, y * 4.7, z * 4.7);
  /** B3: much more geometric detail in the rock: the B1 field broken into ledges (strata steps, tilted by the noise), sharp ridged creases
   *  where the rock has split, and fine knobbly roughness; 0..about 1.  `rockPush` is how far out (m) a face is pushed for a piece's amp. */
  function rockD(x, y, z) {
    const b = rockN(x, y, z), tt = b * 5 + 0.6 * vnoise(x * 0.9 + 3, y * 0.4, z * 0.9), fl = Math.floor(tt), terr = (fl + sstep(0.3, 0.7, tt - fl)) / 5;
    const rg = 1 - Math.abs(2 * vnoise(x * 2.6 + 5, y * 2.6 + 1, z * 2.6 + 9) - 1), rg2 = 1 - Math.abs(2 * vnoise(x * 5.3 + 13, y * 5.3, z * 5.3 + 2) - 1);
    return { base: 0.55 * b + 0.45 * terr, fine: 0.5 * rg * rg * rg + 0.3 * rg2 * rg2 + 0.2 * vnoise(x * 9.1 + 7, y * 9.1 + 3, z * 9.1) };
  }
  const rockPush = (amp, x, y, z) => { const r = rockD(x, y, z); return amp * (0.12 + 0.88 * r.base) + (0.05 + 0.3 * amp) * r.fine; };
  const ROCK_CELL = 0.1;                     // B3: the rock's mesh spacing (m; B1-B2: 0.2-0.3)
  /** how far a piece's rock is pushed out at most (m): more in the big chambers */
  const rockAmp = (hw) => clamp(0.16 + 0.08 * hw, 0.26, 0.6);     // (B5: rougher, more uneven: was 0.1 + 0.06 hw, 0.15-0.45)
  /** B3: a loose rock (rubble, a fallen stone, a boulder): a fine sphere broken by a few flat fracture faces and pushed about by the rock
   *  field (ledges, creases, knobs), so it reads as a broken stone, not a ball.  Unit size; seed picks the stone. */
  function rockGeo(seed, detail = 3) {
    const g = new T.IcosahedronGeometry(1, detail), P0 = g.attributes.position, R = rng(seed * 7919 + 17), o = [R() * 50, R() * 50, R() * 50];
    const cuts = []; for (let k = 0, n = 3 + Math.floor(R() * 4); k < n; k++) { const v = new T.Vector3(R() - 0.5, R() - 0.5, R() - 0.5).normalize(); cuts.push([v, 0.55 + R() * 0.3]); }
    const v = new T.Vector3();
    for (let i = 0; i < P0.count; i++) {
      v.set(P0.getX(i), P0.getY(i), P0.getZ(i));
      const r = rockD(v.x * 1.4 + o[0], v.y * 1.4 + o[1], v.z * 1.4 + o[2]);
      let k = 0.72 + 0.4 * r.base + 0.12 * r.fine;
      for (const [n, d] of cuts) { const dd = v.dot(n) * k; if (dd > d) k *= d / dd; }      // flat fracture faces
      P0.setXYZ(i, v.x * k, v.y * k * 0.78, v.z * k);
    }
    g.computeVertexNormals();
    return g;
  }
  /** where a tunnel's walls stop and its vault starts */
  const springOf = (p) => p.spring || p.h * 0.72;
  /** a tunnel bore along the track, s0..s1: vertical walls to the springing, an elliptic vault to the crown; two halves (right: lat < 0,
   *  left) so the window wall can cast no shadow.  Every vertex is pushed outward (never in) by amp x the rock noise, so nothing
   *  inside the profile (cars, lamps) is ever touched by rock. */
  function tunnelGeo(path, s0, s1, hw, h, sp, amp, half, step = ROCK_CELL) {
    const prof = [];      // [lat, up, nLat, nUp, arc]
    const push = (lat, up, nl, nu) => { const q = prof[prof.length - 1]; prof.push([lat, up, nl, nu, q ? q[4] + Math.hypot(lat - q[0], up - q[1]) : 0]); };
    const nWall = Math.max(2, Math.ceil(sp / ROCK_CELL)), va = h - sp, nArc = Math.max(4, Math.ceil(Math.PI / 2 * Math.max(hw, va) / ROCK_CELL));
    const arcPt = (a) => { const nl = Math.cos(a) / hw, nu = Math.sin(a) / Math.max(0.01, va), l = Math.hypot(nl, nu); return [hw * Math.cos(a), sp + va * Math.sin(a), nl / l, nu / l]; };
    if (half < 0) {       // right: from the floor up the wall at -hw, over the vault to the crown
      for (let j = 0; j <= nWall; j++) push(-hw, sp * j / nWall, -1, 0);
      for (let j = 1; j <= nArc; j++) push(...arcPt(Math.PI - j / nArc * Math.PI / 2));
    } else {              // left: from the crown down the vault and the wall at +hw
      for (let j = 0; j <= nArc; j++) push(...arcPt(Math.PI / 2 - j / nArc * Math.PI / 2));
      for (let j = 1; j <= nWall; j++) push(hw, sp * (1 - j / nWall), 1, 0);
    }
    const m = prof.length, n = Math.max(1, Math.ceil((s1 - s0) / step)), pos = new Float32Array((n + 1) * m * 3), uv = new Float32Array((n + 1) * m * 2), ind = [];
    for (let i = 0; i <= n; i++) {
      const s = s0 + (s1 - s0) * i / n, f = path.frame(s);
      for (let j = 0; j < m; j++) {
        const [lat, up, nl, nu, arc] = prof[j];
        const bx = f.p.x + f.l.x * lat, by = f.p.y + up, bz = f.p.z + f.l.z * lat;
        const d = rockPush(amp, bx, by, bz) * (up < 0.05 ? 0.5 : 1);
        const o = (i * m + j) * 3;
        pos[o] = bx + (f.l.x * nl) * d; pos[o + 1] = by + nu * d; pos[o + 2] = bz + (f.l.z * nl) * d;
        uv[(i * m + j) * 2] = s / 2; uv[(i * m + j) * 2 + 1] = arc / 2;
      }
    }
    for (let i = 0; i < n; i++) for (let j = 0; j + 1 < m; j++) { const a = i * m + j, b = a + m, c = a + 1, d = b + 1; ind.push(a, b, c, c, b, d); }
    // face inward: check the first quad against the outward normal there, flip if needed
    const P = (k) => new T.Vector3(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]);
    const nrm = new T.Vector3().crossVectors(P(m).sub(P(0)), P(1).sub(P(0))), f0 = path.frame(s0);
    const out = new T.Vector3().addScaledVector(f0.l, prof[0][2]).addScaledVector(UP, prof[0][3]);
    if (nrm.dot(out) > 0) for (let k = 0; k < ind.length; k += 3) { const t = ind[k + 1]; ind[k + 1] = ind[k + 2]; ind[k + 2] = t; }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('uv', new T.BufferAttribute(uv, 2)); geo.setIndex(ind);
    geo.computeVertexNormals();
    return geo;
  }
  /** a rock face: a grid over [u0,u1] x [v0, top(u)] on the plane O + U u + V v, facing N, pushed back (away from N) by the rock noise */
  function rockPanel(O, U, V, N, u0, u1, v0, v1, amp, cell = 0.25, top = null) {
    cell = Math.max(ROCK_CELL, cell * (cell > 0.5 ? 0.4 : 0.45));       // (B3: finer, for the rock's new detail)
    const nu = Math.max(1, Math.ceil((u1 - u0) / cell)), nv = Math.max(1, Math.ceil(((top ? Math.max(top(u0), top((u0 + u1) / 2), top(u1)) : v1) - v0) / cell));
    const pos = [], uv = [], ind = [];
    for (let i = 0; i <= nu; i++) {
      const u = u0 + (u1 - u0) * i / nu, vt = top ? top(u) : v1;
      for (let j = 0; j <= nv; j++) {
        const v = v0 + (vt - v0) * j / nv;
        const x = O.x + U.x * u + V.x * v, y = O.y + U.y * u + V.y * v, z = O.z + U.z * u + V.z * v;
        const d = rockPush(amp, x, y, z);
        pos.push(x - N.x * d, y - N.y * d, z - N.z * d); uv.push(u / 2, v / 2);
      }
    }
    const flip = new T.Vector3().crossVectors(U, V).dot(N) < 0;
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
      const a = i * (nv + 1) + j, b = a + nv + 1, c = a + 1, d = b + 1;
      if (flip) ind.push(a, c, b, b, c, d); else ind.push(a, b, c, c, b, d);
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); geo.setIndex(ind);
    geo.computeVertexNormals();
    return geo;
  }
  /** a mine portal: a rock face across the track at fp (frame l, t), facing sign * t (into the bigger space), with a timber-framed opening
   *  hw wide (each side of lat0) and hh high; the face reaches latMin..latMax and up to top(u).  Returns [{key, geo}]. */
  function portal(fp, l, t, sign, lat0, hw, hh, latMin, latMax, top, amp) {
    const N = t.clone().multiplyScalar(sign), O = fp.clone().addScaledVector(N, amp + 0.02), out = [];
    const topFn = typeof top === 'function' ? top : () => top;
    out.push({ key: 'rock', geo: rockPanel(O, l, UP, N, lat0 + hw, latMax, -0.05, 0, amp, 0.22, topFn) });
    out.push({ key: 'rock', geo: rockPanel(O, l, UP, N, latMin, lat0 - hw, -0.05, 0, amp, 0.22, topFn) });
    out.push({ key: 'rock', geo: rockPanel(O, l, UP, N, lat0 - hw, lat0 + hw, hh, 0, amp, 0.22, topFn) });
    // the timber frame: two posts and a cap, standing proud of the rock
    const along = sign * (amp + 0.02);
    for (const sd of [-1, 1]) out.push({ key: 'timber', geo: frameBox(fp, l, t, lat0 + sd * (hw + 0.08), (hh + 0.1) / 2, along, 0.24, hh + 0.1, 0.32, 1) });
    out.push({ key: 'timber', geo: frameBox(fp, l, t, lat0, hh + 0.13, along, 2 * hw + 0.62, 0.26, 0.34, 1) });
    return out;
  }

  // the pointed (gothic) arch, in a w x h box with the springing at h - 0.866 w; for canvases (y down) and shapes
  function archPath(g, x, y, w, h) {
    const rise = Math.min(h * 0.6, 0.866 * w), sy = y + rise;
    g.beginPath();
    g.moveTo(x, y + h); g.lineTo(x, sy);
    g.arc(x + w, sy, w, Math.PI, Math.PI + Math.PI / 3, false);
    g.arc(x, sy, w, -Math.PI / 3, 0, false);
    g.lineTo(x + w, y + h); g.closePath();
  }

  /** the same pointed arch as points, centred on x = 0, from y = 0 up (y up), radius w: for shapes and for clipping canvases */
  function archPts(w, h, n = 16) {
    const sy = h - 0.866 * w, pts = [[-w / 2, 0], [-w / 2, sy]];
    for (let i = 1; i <= n; i++) { const a = Math.PI - i / n * Math.PI / 3; pts.push([w / 2 + w * Math.cos(a), sy + w * Math.sin(a)]); }
    for (let i = 1; i <= n; i++) { const a = Math.PI / 3 - i / n * Math.PI / 3; pts.push([-w / 2 + w * Math.cos(a), sy + w * Math.sin(a)]); }
    pts.push([w / 2, 0]);
    return pts;
  }
  function archShape(w, h, hole) {
    const s = new T.Shape(archPts(w, h).map(([x, y]) => new T.Vector2(x, y)));
    if (hole) s.holes.push(new T.Path(archPts(hole[0], hole[1]).map(([x, y]) => new T.Vector2(x, y + hole[2]))));
    return s;
  }
  /** clip a canvas (px x py, the arch filling it) */
  function clipArch(g, px, py) {
    const pts = archPts(1, py / px * 1);
    g.beginPath(); pts.forEach(([x, y], i) => { const X = (x + 0.5) * px, Y = py - y * px; if (i) g.lineTo(X, Y); else g.moveTo(X, Y); }); g.closePath(); g.clip();
  }

  // ------------------------------------------------------------------ pictures
  function loadImage(url) { return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = url; }); }
  /** B6: load every picture the ride's assets name (each list once); B6 loads the eyes again (the room of eyes) */
  async function loadAssets() {
    const A = window.CT61_ASSETS;
    if (A._loaded) return A;
    const all = (list, key = 'url', to = 'img') => Promise.all((list || []).map(x => loadImage(x[key]).then(im => { x[to] = im; })));
    await Promise.all([all(A.windows), all(A.eyes), all(A.leaded), all(A.crates), all(A.dolls.faces), all(A.dolls.dresses), all([A.dolls.bonnet]),
      all([A.crateLabel]), all(A.suitcases), all(A.suitcases, 'skin', 'skinImg')]);
    A._loaded = true;
    return A;
  }
  /** the window cut to its arch (transparent outside); inset > 0 cuts off the stone frame too (for the light) */
  function archCanvas(img, inset) {
    const w = img.width, h = img.height, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d');
    const ix = w * inset, iy = h * inset * 0.6;
    if (img.dataset && img.dataset.free) { g.beginPath(); g.rect(ix, iy, w - 2 * ix, h - 2 * iy); }     // (B1: a boarded opening has its own ragged outline)
    else archPath(g, ix, iy, w - 2 * ix, h - 2 * iy);
    g.clip(); g.drawImage(img, 0, 0);
    return cv;
  }
  /** B1: a boarded-up opening in the gallery's rock, as a picture (in place of the stained glass): daylight behind, weathered planks
   *  nailed across with gaps between them, one or two gone or hanging askew, two battens.  The light through it is striped by the gaps. */
  function boardAsset(seed, k) {
    const w = 360, h = 640, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d'), R = rng(seed * 1009 + k * 131 + 7);
    cv.dataset.free = '1';
    // a ragged opening hacked in the rock: a rough rounded oblong (transparent outside, the rock shows there)
    g.beginPath();
    for (let i = 0; i < 48; i++) {
      const a = i / 48 * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a), sq = (v) => Math.sign(v) * Math.pow(Math.abs(v), 0.55);
      const r = 0.9 + 0.1 * Math.sin(a * 5 + R() * 2) + (R() - 0.5) * 0.05;
      const x = w / 2 + sq(c) * w / 2 * r * 0.98, y = h / 2 + sq(sn) * h / 2 * r * 0.98;
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    }
    g.closePath(); g.clip();
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#f4f2ea'); sky.addColorStop(0.55, '#fff4dc'); sky.addColorStop(1, '#ffe2b0');
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    const plank = (y, ph, ang, x0 = -20, x1 = w + 20) => {
      g.save(); g.translate(w / 2, y + ph / 2); g.rotate(ang);
      const c = 46 + R() * 30;
      g.fillStyle = `rgb(${c},${c * 0.72},${c * 0.5})`; g.fillRect(x0 - w / 2, -ph / 2, x1 - x0, ph);
      for (let i = 0; i < 18; i++) { g.fillStyle = `rgba(0,0,0,${0.15 + R() * 0.3})`; g.fillRect(x0 - w / 2 + R() * (x1 - x0), -ph / 2 + R() * ph, 30 + R() * 140, 1.5); }
      g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(x0 - w / 2, ph / 2 - 3, x1 - x0, 3);
      g.restore();
    };
    let y = -8;
    while (y < h) {
      const ph = 52 + R() * 34, gap = 3 + R() * R() * 26, t = R();
      if (t > 0.12) plank(y, ph, t < 0.22 ? (R() - 0.5) * 0.22 : (R() - 0.5) * 0.03, t < 0.3 ? R() * 120 - 20 : -20, t > 0.9 ? w - R() * 120 : w + 20);
      y += ph + gap;
    }
    for (const x of [w * 0.2, w * 0.78]) { g.fillStyle = 'rgb(38,27,18)'; g.fillRect(x - 13 + (R() - 0.5) * 10, 0, 26, h); }
    for (let i = 0; i < 30; i++) { g.fillStyle = 'rgba(120,120,120,0.9)'; g.fillRect(w * (R() < 0.5 ? 0.2 : 0.78) - 2, R() * h, 4, 4); }   // nail heads
    return { img: cv, aspect: w / h, name: 'boards ' + (k + 1), lum: 0.3, red: 0 };
  }
  /** B2: a leaded window (one of the darkride pictures), maybe mirrored, as a picture with its own (rectangular) outline */
  function leadedAsset(A, i, flip) {
    const im = A.leaded[i % A.leaded.length].img, cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height;
    const g = cv.getContext('2d'); if (flip) { g.translate(cv.width, 0); g.scale(-1, 1); } g.drawImage(im, 0, 0);
    cv.dataset.free = '1';
    return { img: cv, aspect: im.width / im.height, name: A.leaded[i % A.leaded.length].name + (flip ? ' (mirrored)' : ''), lum: 0.35, red: 0 };
  }
  function softSpot(px = 256, hard = 0.35) {
    const cv = document.createElement('canvas'); cv.width = cv.height = px;
    const g = cv.getContext('2d'), gr = g.createRadialGradient(px / 2, px / 2, 0, px / 2, px / 2, px / 2);
    gr.addColorStop(0, '#fff'); gr.addColorStop(hard, '#fff'); gr.addColorStop(0.92, '#000'); gr.addColorStop(1, '#000');
    g.fillStyle = gr; g.fillRect(0, 0, px, px);
    return canvasTexture(cv, false);
  }
  function halo(px = 64) {
    const cv = document.createElement('canvas'); cv.width = cv.height = px;
    const g = cv.getContext('2d'), gr = g.createRadialGradient(px / 2, px / 2, 0, px / 2, px / 2, px / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.15, 'rgba(255,255,255,0.6)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, px, px);
    const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; return t;
  }

  // ------------------------------------------------------------------ B2: flicker
  const fhash = (n) => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); };
  const fnoise = (x) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return fhash(i) + (fhash(i + 1) - fhash(i)) * u; };
  /** a light's flicker (1 = steady) at time t: amt 0.06 = a lamp's slight unsteadiness .. 0.4 = a guttering candle; now and then a dip */
  function flicker(seed, t, amt) {
    const n = fnoise(t * 9 + seed * 17) * 0.6 + fnoise(t * 23 + seed * 5) * 0.4;
    const dn = fnoise(t * 0.6 + seed * 3), dip = dn > 0.8 ? (dn - 0.8) / 0.2 * (0.5 + 0.5 * fnoise(t * 15 + seed)) : 0;
    return Math.max(0.05, 1 - amt * n - amt * 1.5 * dip);
  }

  // ------------------------------------------------------------------ B6: small helpers the rooms share (were inside B5's build)
  /** a straight line as a path (for a drift's bore off a landing): frame(s) like the track's */
  const linePath = (p0, dir) => { const t = dir.clone().normalize(), l = new T.Vector3(t.z, 0, -t.x); return { frame: (s) => ({ p: p0.clone().addScaledVector(t, s), t, l }) }; };
  /** a bar (a thin cylinder) from A to B, into put's bucket key */
  const makeRod = (put) => (key, A0, B0, r, seg = 6, cast = true) => {
    const d = B0.clone().sub(A0), len = d.length(); if (len < 1e-3) return;
    const g = new T.CylinderGeometry(r, r, len, seg, 1);
    g.applyMatrix4(new T.Matrix4().compose(A0.clone().add(B0).multiplyScalar(0.5), new T.Quaternion().setFromUnitVectors(UP, d.divideScalar(len)), new T.Vector3(1, 1, 1)));
    put(key, g, cast);
  };
  /** a texture from a loaded picture */
  const imgTex = (img) => { const t = new T.Texture(img); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 8; t.needsUpdate = true; return t; };

  window.CT61Core = { T, clamp, sstep, rng, UP, D2R, DS, integrate, makePath, noiseField, hex, texCanvas, canvasTexture, ribbon, merge, frameBox, doorWall,
    hash3, vnoise, rockN, rockD, rockPush, ROCK_CELL, rockAmp, rockGeo, springOf, tunnelGeo, rockPanel, portal, archPath, archPts, archShape, clipArch,
    loadImage, loadAssets, archCanvas, boardAsset, leadedAsset, softSpot, halo, flicker, linePath, makeRod, imgTex };
})();
