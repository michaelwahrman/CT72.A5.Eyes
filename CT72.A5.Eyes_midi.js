/* CT61.B6.Darkride -- MIDI, through the CT45.A1.USB standard layer (lib/ct45midi.js + lib/ct45.profiles.js); the CT55.A7 / CT58 glue.
 *
 *  * Default assignments: CT61.A2.Darkride_midimap.js (X-TOUCH MINI, Launchpad Mini MK3 / original, nanoKEY2).
 *  * Right-click any on-screen button, then press (or turn) a MIDI control: it is assigned to that button.
 *    Learned assignments live in this browser (localStorage) and override the file. Any MIDI device works this way.
 *  * Lights: X-TOUCH buttons light when their switch is on (Record blinks); encoder rings show their values;
 *    Launchpad pads show each action in its colour, and the ladders show each setting as a bar.
 *  * Encoders: one step per detent; knobs / faders: set the value directly.
 */
(function () {
  'use strict';
  const C = window.CT61, $ = (id) => document.getElementById(id);
  const LEARN_KEY = 'CT61.midimap.learned';
  const DEFAULTS = window.CT61_MIDIMAP || {};
  const VALUE_ACTIONS = new Set(['speed', 'sun', 'beams', 'house', 'dispatch', 'lookYaw', 'lookPitch', 'fov', 'fog']);
  const BUTTON_TO_VALUE = { faster: 'speed', slower: 'speed', sunUp: 'sun', sunDown: 'sun', beamsUp: 'beams', beamsDown: 'beams', houseUp: 'house', houseDown: 'house',
    sooner: 'dispatch', later: 'dispatch', lookLeft: 'lookYaw', lookRight: 'lookYaw', lookUp: 'lookPitch', lookDown: 'lookPitch' };
  const COLORS = { reset: '#ffffff', forward: '#4ff0a8', pause: '#ffd23a', playPause: '#4ff0a8', record: '#ff2a3a', stopAll: '#ff3a3a', dispatchNow: '#ffbf6a', showStops: '#ffbf6a',
    faster: '#c0c0c0', slower: '#c0c0c0', sooner: '#ffbf6a', later: '#ffbf6a', view: '#7fc4ff', lookAhead: '#7fc4ff', lookLeft: '#7fc4ff', lookRight: '#7fc4ff', lookUp: '#7fc4ff', lookDown: '#7fc4ff',
    turnLook: '#7fc4ff', sunUp: '#ffd23a', sunDown: '#ffd23a', beamsUp: '#ffe08a', beamsDown: '#ffe08a', houseUp: '#9a9a9a', houseDown: '#9a9a9a', dust: '#ffe08a', glass: '#ff4a6a',
    eyes: '#b48cff', sound: '#4ff0a8', display: '#9a9a9a', hud: '#9a9a9a' };
  const NAMES = { reset: 'Reset', forward: 'Forward', pause: 'Pause', playPause: 'Play / pause', record: 'Record', stopAll: 'Stop all cars', dispatchNow: 'Dispatch now', showStops: 'Show stops on / off',
    faster: 'Ride faster', slower: 'Ride slower', sooner: 'Dispatch sooner', later: 'Dispatch later', view: 'View: seat / behind', lookAhead: 'Look ahead', lookLeft: 'Look left', lookRight: 'Look right',
    lookUp: 'Look up', lookDown: 'Look down', turnLook: 'Look into the turns', sunUp: 'Sun brighter', sunDown: 'Sun dimmer', beamsUp: 'Shafts stronger', beamsDown: 'Shafts weaker',
    houseUp: 'House lights up', houseDown: 'House lights down', dust: 'Dust on / off', glass: 'Other glass', eyes: 'Eyes follow on / off', sound: 'Sound', display: 'Show / hide buttons (D)', hud: 'Show / hide text',
    speed: 'Ride speed (value)', sun: 'Sun (value)', beams: 'Shafts (value)', house: 'House lights (value)', dispatch: 'Seconds between dispatches (value)', lookYaw: 'Look left / right (value)',
    lookPitch: 'Look up / down (value)', fov: 'Zoom (value)', fog: 'Haze (value)' };
  const LADDER_COL = { speed: '#c0c0c0', sun: '#ffd23a', beams: '#ffe08a', house: '#9a9a9a', look: '#7fc4ff', dispatch: '#ffbf6a' };
  const LADDER_NAME = { speed: (v) => `Speed ${v}×`, sun: (v) => `Sun ${Math.round(v * 100)}%`, beams: (v) => `Shafts ${Math.round(v * 100)}%`, house: (v) => `House lights ${Math.round(v * 100)}%`,
    look: (v) => v === 0 ? 'Look ahead' : v === 180 ? 'Look back' : `Look ${v > 0 ? 'left' : 'right'} ${Math.abs(v)}°`, dispatch: (v) => `Dispatch every ${v} s` };
  for (const [k, vals] of Object.entries(C.LADDERS)) vals.forEach((v, i) => { NAMES[k + 'At' + i] = LADDER_NAME[k](v); COLORS[k + 'At' + i] = LADDER_COL[k]; });

  let learned = {};
  try { learned = JSON.parse(localStorage.getItem(LEARN_KEY) || '{}') || {}; } catch { learned = {}; }
  const saveLearned = () => { try { localStorage.setItem(LEARN_KEY, JSON.stringify(learned)); } catch { /* */ } };
  const mapFor = (pid) => Object.assign({}, DEFAULTS[pid] || {}, learned[pid] || {});
  const lookup = (pid, control) => { const a = mapFor(pid)[control]; return typeof a === 'string' && !control.startsWith('_') ? a : null; };

  // short names for the hints under the buttons
  const DEV_SHORT = { 'behringer-xtouch-mini': 'XT', 'novation-launchpad-mini-mk3': 'LP', 'novation-launchpad-mini': 'LP', 'korg-nanokey2': 'nK' };
  const NOTE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  function ctlShort(pid, id) {
    let m;
    if ((m = /^btn([ab])(\d)$/.exec(id))) return (m[1] === 'a' ? 'top' : 'bot') + m[2];
    if ((m = /^pad\.(\d)\.(\d)$/.exec(id))) return `r${+m[1] + 1}c${+m[2] + 1}`;
    if ((m = /^side(\d)$/.exec(id))) return 'side' + m[1];
    if ((m = /^key(\d+)$/.exec(id))) return NOTE[+m[1] % 12] + (+m[1] >= 12 ? (+m[1] >= 24 ? "''" : "'") : '');
    if ((m = /^enc(\d)$/.exec(id))) return 'knob' + m[1];
    return id;
  }

  // ------------------------------------------------------------------ the hub
  const hub = new CT45.MidiHub();
  let status = hub.supported ? 'not connected' : 'Web MIDI is not available in this browser (use Chrome or Edge)';
  hub.on('connect', (d) => { d.autoRing = false; setTimeout(() => { lights(d, true); refresh(); C.toast(`MIDI: ${d.profile.name || d.profile.id} connected`); }, 60); });
  hub.on('disconnect', (d) => { refresh(); C.toast(`MIDI: ${d.profile.name || d.profile.id} disconnected`); });
  hub.on('status', () => refresh());

  let learning = null;
  hub.on('input', (e) => {
    const d = e.device, pid = d.profile.id, ctl = e.control;
    if (learning) {                                          // assign this control to the button being learned
      const isValue = e.type === 'encoder' || e.type === 'knob' || e.type === 'fader';
      if (!isValue && e.action !== 'press') return;
      if (e.type === 'bender') return;
      let action = learning.action;
      if (isValue) action = BUTTON_TO_VALUE[action] || (VALUE_ACTIONS.has(action) ? action : null);
      if (!action) { C.toast(`"${NAMES[learning.action]}" needs a button, pad or key (not a knob)`); return; }
      (learned[pid] = learned[pid] || {})[ctl] = action; saveLearned();
      C.toast(`${d.profile.name || pid} · ${ctlShort(pid, ctl)} → ${NAMES[action]}`);
      endLearn(); lights(d, true); refresh();
      return;
    }
    const action = lookup(pid, ctl);
    if (!action) return;
    if (VALUE_ACTIONS.has(action)) {
      if (e.type === 'encoder' && e.delta) C.setValue(action, { delta: e.delta });
      else if (e.type === 'knob' || e.type === 'fader') C.setValue(action, { value: e.value });
      else if (e.type === 'bender') C.setValue(action, { value: (e.value + 1) / 2 });
      else if (e.action === 'press') C.setValue(action, { delta: 1 });
      return;
    }
    if (e.action === 'press') C.act(action, 'press');
    else if (e.action === 'release') C.act(action, 'release');
  });

  async function connect() {
    if (!hub.supported) { refresh(); return; }
    status = 'asking the browser for MIDI…'; refresh();
    const r = await hub.start();
    status = r.ok ? `on${r.sysex ? ' (with sysex — full Launchpad colours)' : ' (no sysex — approximate Launchpad colours)'}` : 'refused: ' + r.error;
    refresh();
    for (const d of hub.list()) lights(d, true);
  }

  // ------------------------------------------------------------------ lights
  const dim = (hex, k) => { const n = parseInt(hex.slice(1), 16); return '#' + [16, 8, 0].map(s => Math.round(((n >> s) & 255) * k).toString(16).padStart(2, '0')).join(''); };
  const VALUE_FRAC = { speed: () => C.S.speed / 3, sun: () => C.S.sun / 2, beams: () => C.S.beams / 3, house: () => Math.sqrt(C.S.house), dispatch: () => (C.S.dispatchEvery - 2) / 18,
    lookYaw: () => 0.5 - C.S.lookYaw / 360, lookPitch: () => 0.5 + C.S.lookPitch / 120, fov: () => (C.S.fov - 25) / 85, fog: () => C.S.fog / 0.15 };
  function lights(d, force) {
    if (!d || !d.connected && !d.simulated) return;
    const map = mapFor(d.profile.id);
    for (const [ctl, action] of Object.entries(map)) {
      if (ctl.startsWith('_')) continue;
      const c = d.control(ctl); if (!c || !c.led) continue;
      const kind = c.led.kind;
      try {
        if (kind === 'ring-mackie') { if (VALUE_FRAC[action]) d.setLight(ctl, clamp01(VALUE_FRAC[action]()), { style: 'fan' }); continue; }
        const on = C.isOn(action);
        if (kind === 'mono') d.setLight(ctl, action === 'record' && on ? 'blink' : !!on);
        else {
          const col = COLORS[action] || '#ffffff';
          d.setLight(ctl, on === undefined ? dim(col, 0.35) : on ? col : dim(col, 0.12));
        }
      } catch (err) { if (force) console.warn('CT61 light', ctl, err); }
    }
  }
  const clamp01 = (x) => Math.max(0.02, Math.min(1, x));
  C.onChange(() => { for (const d of hub.list()) lights(d); hints(); });

  // ------------------------------------------------------------------ learning (right-click a button)
  function endLearn() { if (learning) learning.btn.classList.remove('learn'); learning = null; }
  C.setLearnHook((action, btn) => {
    endLearn();
    if (!hub.list().length) { C.toast('Connect a MIDI device first (MIDI button), then right-click a button and press a control'); return; }
    learning = { action, btn }; btn.classList.add('learn');
    C.toast(`Press (or turn) the MIDI control for "${NAMES[action]}" — Esc cancels`, 8000);
  });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && learning) { endLearn(); C.toast('Cancelled'); } });

  // ------------------------------------------------------------------ panel, chip, hints
  function hints() {
    const devs = hub.list();
    for (const b of C.buttons) {
      const a = b.dataset.action, out = [];
      for (const d of devs) {
        const map = mapFor(d.profile.id), sh = DEV_SHORT[d.profile.id] || 'MIDI';
        for (const [ctl, act] of Object.entries(map)) if (act === a && !ctl.startsWith('_')) { out.push(sh + ' ' + ctlShort(d.profile.id, ctl)); break; }
      }
      const m = b.querySelector('.m'); if (m) m.textContent = out.slice(0, 2).join(' · ');
    }
  }
  function refresh() {
    const devs = hub.list();
    $('midiChip').textContent = hub.status === 'running' ? (devs.length ? devs.length + ' device' + (devs.length > 1 ? 's' : '') : 'no devices') : (hub.supported ? 'off' : 'n/a');
    $('midiStatus').textContent = 'MIDI: ' + status + (hub.status === 'running' ? ` · ${devs.length} device(s)` : '');
    C.setMidiLine('MIDI: ' + (hub.status === 'running' ? (devs.length ? devs.map(d => (d.profile.name || d.profile.id) + (d.simulated ? ' (sim)' : '')).join(', ') : 'no devices plugged in') : status));
    const box = $('midiDevices'); box.innerHTML = '';
    for (const d of devs) {
      const pid = d.profile.id, map = mapFor(pid), lr = learned[pid] || {};
      const h = document.createElement('h3'); h.textContent = `${d.profile.name || pid}  (${d.portNames.join(' | ')})`; box.appendChild(h);
      const t = document.createElement('table');
      t.innerHTML = '<tr><th>control</th><th>action</th></tr>' + Object.entries(map).filter(([k]) => !k.startsWith('_'))
        .map(([k, a]) => `<tr><td>${ctlShort(pid, k)} <span style="color:#8a8597">(${k})</span></td><td class="${lr[k] ? 'learned' : ''}">${NAMES[a] || a}</td></tr>`).join('');
      if (map._layout) { const p = document.createElement('p'); p.textContent = map._layout; box.appendChild(p); }
      box.appendChild(t);
    }
    hints();
  }
  $('b_midi').onclick = () => { $('midiPanel').classList.toggle('on'); refresh(); };
  $('midiConnect').onclick = () => connect();
  $('midiForget').onclick = () => { learned = {}; saveLearned(); refresh(); for (const d of hub.list()) lights(d, true); C.toast('Learned MIDI forgotten — back to the defaults'); };

  window.CT61.midi = { hub, connect, lookup, get learned() { return learned; }, refresh };
  refresh();
  if (new URLSearchParams(location.search).get('midi') !== '0') connect();   // ask at once; Chrome remembers the answer
})();
