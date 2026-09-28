// ============================================================================
// Audio — Web Audio score (Karplus–Strong guitar, drones, piano, phone tones), sfx, ambience,
// voice (speechSynthesis, optional), mixer buses with ducking, positional sound. Owned by: audio agent.
// Everything is synthesised: sfx, footsteps, loops and music notes are rendered once by the JS DSP kit below into
// cached AudioBuffers (heavy ones through a per-frame job queue); reverbs are generated impulse responses.
//
// CONTRACT (every call must be safe before init() and when the AudioContext is unavailable)
//   Audio.init()                      create context on user gesture (idempotent)
//   Audio.update(dt)                  listener follows Engine.camera; ducking; loops
//   Audio.music(cueId, {fade})        cue ids: 'title' (full theme once then silence), 'theme_a', 'theme_b', 'theme' (full),
//                                     'chloe_motif', 'bub_motif', 'wai' (low drone then phrase A), 'film_night',
//                                     'whales', 'choice_drone', 'piano_theme', 'tension' (loop; use Audio.tension(level))
//   Audio.stopMusic(fadeSec=2)
//   Audio.tension(level 0..1)         stealth/combat drone intensity (0 = off)
//   Audio.sfx(name, {pos: Vector3, vol, rate}) -> {stop()}   one-shots. Names (at least):
//      click (clicker), click_counter (security guard counter), notif_chime, phone_ring, phone_buzz, phone_boot (Bub's motif),
//      glass_break, door_knock, door_open, door_slam, wood_crash (table), punch, body_fall, tackle, gunshot, gunshot_far,
//      rifle_shot, revolver_shot, shotgun, reload, dry_fire, car_crash, tyre_screech, horn, truck_horn, siren, scanner_beep,
//      scanner_shriek, swipe, whisper (scroller mutter), scroller_scream, heartbeat, typing_tap, send_whoosh,
//      tv_on, tv_off, radio_static, radio_click, fire_whoosh, explosion, bottle_break, brick_hit, pluck (UI hover), ui_select,
//      page_turn, breath_in, gasp, chirp (digital pet), tape_click, tape_hiss, shovel, bell, water_splash
//   Audio.loop(name, {pos, vol}) -> {stop(fade), setVol(v), setPos(v3)}   continuous sources:
//      fire, engine_idle, engine_drive, rain, wind, tv_murmur, radio_dj, crowd_murmur, fluorescent_hum, water_lap, siren_far,
//      clicks_far (thousands of distant clicks), cicadas, turbine_hum, phone_feed (scrolling murmur)
//   Audio.amb(name|null, fade)        area ambience bed (crossfades). Names: store_night, suburb_night, house_night, car_interior,
//      fire_street, bridge_night, title_dawn, qz_rain, warehouse, tunnel, tower, mall_dawn, outback_day, … (unknown names = silence)
//   Audio.footstep(surface, pos, intensity)   surfaces: concrete gravel grass wood water snow metal tile carpet
//   Audio.voice(who, text, {pitch, rate}) -> Promise   speechSynthesis when SETTINGS.voice; resolves immediately otherwise
//   Audio.duck(on)                    duck music+amb under dialogue
//   Audio.muffle(t 0..1)              low-pass everything (Airplane Mode, underwater)
//   Audio.setVolumes()                re-read SETTINGS.vol
//   Audio.pause(bool)                 pause menu: suspend sfx/amb, keep UI sounds
//   Audio.silence(on, fade)           drop all music and most ambience (heaviest scenes)
//
// DETAILS AND ADDITIONS
//   sfx also: knock (one knuckle rap; door_knock is a rap of three), landline_ring (store/office phone; phone_ring is Bub's
//      smartphone ringtone built on her motif), dial_tone, swing, stab, bow, arrow_hit, pickup, craft (tape rip), metal_hit,
//      battery_whine, battery_burst, ringtone (Ringtone Bomb), dog_bark, car_pass, thunder, scream_far, car_alarm, magpie,
//      kookaburra, crow, bird, mopoke, gull, whale, creak, metal_creak, drip, pigeons, phone_slam (face-down, screen cracks),
//      window_slap (phone slapped on a car window), car_door, engine_start (crank, catch, idle), box_cutter, keys, horse_scream.
//      Gunshots further than 70 m play their far version automatically. whisper uses quiet low speech synthesis near the
//      listener when SETTINGS.voice.
//   loop also: phone_ring, landline_ring, tape_hiss, crickets, traffic_far, fridge_hum, clock_tick, room_tone, birds_dawn,
//      drips, surf, spillway, stove, flies. A loop gets a position only if it is created with one (setPos moves it).
//   amb also: interior (generic hum), office, dam, forest_autumn, snow_wind, blizzard, cliff_wind, underpass, exchange, lab,
//      hut, suburb_day, roof_night. Each bed sets the reverb of positional sfx (car, room, interior, hall, tunnel, outdoor).
//   footstep surfaces also: dirt; aliases asphalt/road → concrete, sand/mud → dirt, leaves → grass, ice → snow. intensity 0..1.
//   music('tension') = tension(0.65) until stopMusic(); the tension layer also follows AI.alertLevel (the max of the three).
//   silence(true) stops the current cue and holds tension off; a cue started during silence plays (P.7's final theme_a).
//   Audio.catalog() -> { sfx, loop, amb, music, surfaces }                       name lists (dev audition)
//   Audio.render(kind 'sfx'|'loop'|'amb'|'music'|'step', name, sec) -> Promise<AudioBuffer|null>   offline render (dev checks)
//   Audio.stats() -> { ready, state, worker, cached, queued, voices, mb }        synthesis/voice counters (dev checks)
// ============================================================================
const Audio = (() => {
  const TAU = Math.PI * 2, H = { stop() {}, setVol() {}, setPos() {} };
  let ctx = null, SR = 44100, B = null, L = null, worker = null;
  let paused = false, silent = false, ducked = false, muf = 0, ambWant = null, space = null, swapAt = 0;
  let cue = null, bed = null, ten = null, tSet = 0, tCue = 0, tLvl = 0, tIdle = 0, tBow = 0, whisperU = false;
  const cache = new Map(), jobs = [], idle = [], busy = new Set(), voices = new Set(), pending = new Set(), fading = new Set(), speech = new Set();
  const rnd = (a, b) => a + (b - a) * Math.random();

  // ---- DSP kit: offline synthesis into Float32Arrays. kit() uses no outer names, so the same source also runs as a Web
  // Worker (see init); returns { SFX, STEPS, LOOPS, SPACES, MOTIF, midi, hz, synth(key, sr) -> { sr, chs: [Float32Array] } }
  function kit() {
    const TAU = Math.PI * 2;
    let SR = 44100;
    const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
    const rng = seed => { let s = (seed >>> 0) || 1; return () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
    const hz = m => 440 * Math.pow(2, (m - 69) / 12);
    const midi = s => { const [, n, acc, o] = /^([A-G])([#b]?)(\d)$/.exec(s); return 12 * (+o + 1) + { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[n] + (acc === '#') - (acc === 'b'); };
    const ex = (t, tau) => Math.exp(-t / tau);
    const ar = (t, a, tau) => t < a ? t / a : Math.exp((a - t) / tau);
    const hump = (t, d) => t <= 0 || t >= d ? 0 : Math.sin(Math.PI * t / d);
    const at = (sr, t) => Math.max(0, Math.round(t * sr));
    const pg = (p, ch) => Math.sqrt(0.5 * (1 + (ch ? p : -p)));            // equal-power pan gain for channel ch
    function bq(type, f, q = 0.707, sr = SR, db = 0) {                       // RBJ biquad: lp hp bp (0 dB peak) pk
      let b0, b1, b2, a1, a2, x1 = 0, x2 = 0, y1 = 0, y2 = 0;
      const p = x => { const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; };
      p.set = (f, qq = q) => {
        const w = TAU * Math.min(Math.max(f, 5), sr * 0.45) / sr, c = Math.cos(w), al = Math.sin(w) / (2 * qq), A = Math.pow(10, db / 40);
        let n0, n1, n2, d0 = 1 + al, d2 = 1 - al;
        if (type === 'lp') { n0 = n2 = (1 - c) / 2; n1 = 1 - c; }
        else if (type === 'hp') { n0 = n2 = (1 + c) / 2; n1 = -1 - c; }
        else if (type === 'bp') { n0 = al; n1 = 0; n2 = -al; }
        else { n0 = 1 + al * A; n1 = -2 * c; n2 = 1 - al * A; d0 = 1 + al / A; d2 = 1 - al / A; }
        b0 = n0 / d0; b1 = n1 / d0; b2 = n2 / d0; a1 = -2 * c / d0; a2 = d2 / d0;
      };
      p.set(f); return p;
    }
    const lp1 = (f, sr) => { const k = 1 - Math.exp(-TAU * f / sr); let y = 0; return x => (y += k * (x - y)); };
    const blep = (p, dt) => { let v = 2 * p - 1; if (p < dt) { const t = p / dt; v -= t + t - t * t - 1; } else if (p > 1 - dt) { const t = (p - 1) / dt; v -= t * t + t + t + 1; } return v; };
    const osc = (w, p, dt) => w === 'saw' ? blep(p, dt) : w === 'sq' ? blep(p, dt) - blep((p + 0.5) % 1, dt) : Math.sin(TAU * p);
    // decaying sinusoid (a struck mode) added at t0
    function mode(a, sr, t0, f, tau, amp) {
      if (f >= sr * 0.48 || f <= 0) return;
      const i0 = at(sr, t0), n = Math.min(a.length - i0, Math.round(tau * sr * 7)), w = TAU * f / sr, c = Math.cos(w), s = Math.sin(w), d = Math.exp(-1 / (tau * sr));
      let x = 0, y = amp;
      for (let i = 0; i < n; i++) { a[i0 + i] += x; const nx = (x * c + y * s) * d; y = (y * c - x * s) * d; x = nx; }
    }
    // white noise shaped by env(t) and an optional filter
    function burst(a, sr, r, t0, dur, env, filt) {
      const i0 = at(sr, t0), n = Math.min(a.length - i0, Math.round(dur * sr));
      for (let i = 0; i < n; i++) { const x = (r() * 2 - 1) * env(i / sr) * Math.min(1, (n - i) / (sr * 0.004)); a[i0 + i] += filt ? filt(x) : x; }
    }
    // oscillator: f is Hz or t => Hz, env t => amp
    function tone(a, sr, t0, dur, f, env, w = 'sine', filt) {
      const i0 = at(sr, t0), n = Math.min(a.length - i0, Math.round(dur * sr)), fn = typeof f === 'function';
      let p = 0;
      for (let i = 0; i < n; i++) { const t = i / sr, dt = (fn ? f(t) : f) / sr; p += dt; p -= Math.floor(p); const x = osc(w, p, dt) * env(t) * Math.min(1, (n - i) / (sr * 0.004)); a[i0 + i] += filt ? filt(x) : x; }
    }
    function fx(a, ...fs) { for (let i = 0; i < a.length; i++) { let x = a[i]; for (const f of fs) x = f(x); a[i] = x; } }
    function norm(a) { let p = 0; for (let i = 0; i < a.length; i++) p = Math.max(p, Math.abs(a[i])); if (p > 0) for (let i = 0; i < a.length; i++) a[i] /= p; }
    function echo(a, sr, taps) { const s = a.slice(); for (const [d, g] of taps) { const k = at(sr, d); for (let i = k; i < a.length; i++) a[i] += s[i - k] * g; } }
    function fade(a, sr, sec) { const n = Math.min(a.length, at(sr, sec)); for (let i = 0; i < n; i++) a[a.length - 1 - i] *= i / n; }
    const noiseTo = (a, sr, r, f, g) => { for (let i = 0; i < a.length; i++) a[i] += f(r() * 2 - 1) * g(i / sr); };
    const brownish = r => { let b = 0; return () => (b = (b + 0.05 * (r() * 2 - 1)) / 1.05); };
    // tiny phone loudspeaker: no bass, a presence peak, gentle breakup
    const speaker = (a, sr, drive = 1.5) => { fx(a, bq('hp', 480, 0.8, sr), bq('pk', 2300, 1.2, sr, 4), bq('lp', 6000, 0.7, sr)); norm(a); fx(a, x => Math.tanh(drive * x)); };

    // shared impact vocabulary
    const thud = (a, sr, t, f, tau, amp) => tone(a, sr, t, tau * 7, u => f * (1 + 0.7 * ex(u, 0.012)), u => amp * ar(u, 0.002, tau));
    const scuff = (a, sr, r, t, f, tau, amp, q = 0.9) => burst(a, sr, r, t, tau * 7, u => amp * ar(u, 0.0012, tau), bq('bp', f, q, sr));
    function tick(a, sr, r, t, amp, f = 3000) {                                // small hard click (metal, plastic)
      burst(a, sr, r, t, 0.003, u => amp * ex(u, 0.0005), bq('hp', 1500, 0.7, sr));
      mode(a, sr, t, f, 0.01, amp * 0.5); mode(a, sr, t, f * 1.73, 0.007, amp * 0.35); mode(a, sr, t, f * 2.87, 0.004, amp * 0.2);
    }
    function grains(a, sr, r, t0, dur, n, lo, hi, amp, q = 1.5) {             // crunchy granular texture (gravel, paper, splinters)
      for (let k = 0; k < n; k++) {
        const u = r(), g = amp * (0.25 + r() * 0.75) * Math.sin(Math.PI * u), tau = 0.0005 + r() * 0.0012;
        burst(a, sr, r, t0 + u * dur, 0.006, v => g * ex(v, tau), bq('bp', lo + r() * (hi - lo), q, sr));
      }
    }
    function shards(a, sr, r, t0, n, spread, amp) {                             // falling glass: inharmonic tinks, density decaying
      for (let k = 0; k < n; k++) {
        const dt = -Math.log(1 - r() * 0.985) * spread, f = 1900 + r() * 6200, g = amp * (0.15 + r() * 0.85) * ex(dt, spread * 3), tau = 0.004 + r() * 0.022;
        mode(a, sr, t0 + dt, f, tau, g); mode(a, sr, t0 + dt, f * 2.32, tau * 0.6, g * 0.5); mode(a, sr, t0 + dt, f * 3.87, tau * 0.35, g * 0.3);
      }
    }
    function stickSlip(a, sr, r, t0, dur, rate, modes, amp) {                  // creaks: friction pulses exciting resonances
      for (let t = 0; t < dur;) { const e = amp * Math.sqrt(hump(t, dur)) * (0.6 + 0.4 * r()); for (const [f, tau, g] of modes) mode(a, sr, t0 + t, f * (1 + 0.02 * r()), tau, e * g); t += 1 / Math.max(4, rate(t / dur) * (0.8 + 0.4 * r())); }
    }
    function bubbles(a, sr, r, t0, dur, n, lo, hi, amp) {
      for (let k = 0; k < n; k++) { const f0 = lo + r() * (hi - lo), d = 0.01 + r() * 0.03, g = amp * (0.3 + r() * 0.7); tone(a, sr, t0 + r() * dur, d * 3, u => f0 * (1 + 0.8 * Math.min(1, u / (3 * d))), u => g * ar(u, 0.001, d)); }
    }
    const whoosh = (a, sr, r, t, d, f0, f1, g, q = 1.4) => { const bp = bq('bp', f0, q, sr); let i = 0; burst(a, sr, r, t, d, u => g * hump(u, d) * hump(u, d), x => { if ((i++ & 15) === 0) bp.set(f0 * Math.pow(f1 / f0, i / (d * sr))); return bp(x); }); };
    // formant babble: syllables of voiced buzz and breath through moving vowel formants (crowds, TV, radio, whispers)
    const VOW = [[730, 1090, 2440], [270, 2290, 3010], [300, 870, 2240], [530, 1840, 2480], [570, 840, 2410], [440, 1020, 2240], [660, 1720, 2410], [490, 1350, 1690]];
    function babble(a, sr, r, t0, dur, o) {
      const fs = [bq('bp', 500, 4, sr), bq('bp', 1500, 6, sr), bq('bp', 2500, 8, sr)], fr = bq('hp', 3000, 0.8, sr), vo = o.voiced ?? 1, ph0 = r() * TAU;
      const i0 = at(sr, t0), n = Math.min(a.length - i0, Math.round(dur * sr));
      let p = 0, s0 = 0, sl = 0, v0 = VOW[0], v1 = VOW[1], on = 1, fric = false;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        if (t >= s0 + sl) { s0 = t; sl = (0.55 + r() * 0.9) / o.rate; v0 = v1; v1 = VOW[r() * VOW.length | 0]; on = r() < (o.gap ?? 0.15) ? 0 : 0.6 + 0.4 * r(); fric = r() < (o.fric ?? 0.3); }
        const u = (t - s0) / sl;
        if ((i & 31) === 0) for (let k = 0; k < 3; k++) fs[k].set(v0[k] + (v1[k] - v0[k]) * u);
        const dt = o.f0 * (1 + 0.1 * Math.sin(TAU * 0.4 * t + ph0) - 0.1 * u) / sr;
        p += dt; if (p >= 1) p -= 1;
        const src = vo * blep(p, dt) + (1.2 - vo) * (r() * 2 - 1) * 0.5;
        let y = (fs[0](src) + fs[1](src) * 0.5 + fs[2](src) * 0.25) * on * Math.sin(Math.PI * u);
        if (fric && u < 0.3) y += fr(r() * 2 - 1) * 0.25 * (1 - u / 0.3) * on;
        a[i0 + i] += y * o.amp;
      }
    }
    // a voiced animal/human call: f0 contour, formants [Hz, Q, gain], roughness
    function call(a, sr, r, t0, dur, f0, F, amp, rough = 0.1, att = 0.01) {
      const fs = F.map(([f, q]) => bq('bp', f, q, sr));
      tone(a, sr, t0, dur, u => f0(u) * (1 + rough * (r() - 0.5)), u => amp * Math.min(1, u / att) * hump(u + dur * 0.08, dur * 1.08), 'saw', x => { let s = 0; for (let k = 0; k < fs.length; k++) s += fs[k](x) * F[k][2]; return s; });
    }

    // ---- instruments -----------------------------------------------------------------------------------------------------
    // Karplus–Strong string: one period of pick-shaped noise into a tuned delay line with a one-zero low-pass and an allpass
    // for the fractional part of the period (exact tuning), loss set for a T60 of o.decay seconds.
    function ks(a, sr, r, t0, f, o) {
      const D = sr / f, S = 0.5 - 0.36 * o.bright, N = Math.max(2, Math.floor(D - S - 0.1)), fr = D - S - N, C = (1 - fr) / (1 + fr);
      const g = Math.pow(10, -3 / (o.decay * f)), dl = new Float32Array(N), e = new Float32Array(N), pl = lp1(1400 + 9000 * o.bright, sr), P = Math.max(1, Math.round(N * o.pick));
      for (let i = 0; i < N; i++) e[i] = pl(r() * 2 - 1);
      let m = 0; for (let i = 0; i < N; i++) { dl[i] = e[i] - (i >= P ? e[i - P] : 0); m += dl[i] / N; }
      for (let i = 0; i < N; i++) dl[i] -= m;
      let k = 0, prev = 0, x1 = 0, y1 = 0;
      for (let i = at(sr, t0); i < a.length; i++) {
        const out = dl[k], l = g * ((1 - S) * out + S * prev); prev = out;
        const y = C * l + x1 - C * y1; x1 = l; y1 = y;
        dl[k] = y; if (++k === N) k = 0;
        a[i] += out * o.vel;
      }
    }
    const ksDur = m => Math.min(6, 4.25 * Math.sqrt(220 / hz(m)));
    function guitarNote(a, sr, r, m, b) {                                        // a ronroco course: two strings a hair apart
      const f = hz(m), bright = [0.22, 0.5, 0.8][b], T = 5 * Math.sqrt(220 / f);
      ks(a, sr, r, 0, f, { decay: T, bright, pick: 0.12 + 0.06 * (2 - b), vel: 1 });
      ks(a, sr, r, 0.004 + r() * 0.005, f * 1.0017, { decay: T * 0.85, bright: bright * 0.9, pick: 0.21, vel: 0.65 });
      burst(a, sr, r, 0, 0.012, u => 0.1 * ex(u, 0.002), bq('bp', 2800, 0.9, sr));
      fx(a, bq('hp', 80, 0.7, sr), bq('pk', 210, 1.3, sr, 4), bq('pk', 480, 1.5, sr, 2), bq('pk', 2700, 1, sr, 2.5));
      fade(a, sr, 0.3);
    }
    const pnTau = m => Math.min(3, Math.max(0.35, 1.3 * Math.pow(262 / hz(m), 0.6)));
    const pnDur = m => Math.min(7, Math.max(2.5, 1.5 + 4 * pnTau(m)));
    function pianoNote(a, sr, r, m, vb) {                                        // additive: stiff-string partials, two strings each
      const f0 = hz(m), vel = [0.35, 0.6, 0.9][vb], Bi = 0.00007 * Math.pow(2, (m - 21) / 12 * 0.95), tau1 = pnTau(m), fc = f0 * (3 + 12 * vel), top = Math.min(sr * 0.45, 9000);
      for (let n = 1; n < 40; n++) {
        const fn = n * f0 * Math.sqrt(1 + Bi * n * n); if (fn > top) break;
        const amp = (0.15 + Math.abs(Math.sin(Math.PI * n * 0.12))) / n / Math.sqrt(1 + Math.pow(fn / fc, 4)), tau = tau1 * Math.pow(f0 / fn, 0.75);
        mode(a, sr, 0, fn * 0.99965, tau, amp * 0.65);
        mode(a, sr, 0, fn * 1.00035, tau * 3, amp * 0.35);
      }
      burst(a, sr, r, 0, 0.03, u => 0.05 * vel * ex(u, 0.006), bq('lp', 900, 0.7, sr));
      fx(a, bq('hp', 40, 0.7, sr), bq('pk', 250, 1, sr, -2));
      fade(a, sr, 1.2);
    }
    function phoneNote(a, sr, m, d) {                                             // Bub's thin sine phone tone
      const f = hz(m);
      for (const [k, g] of [[1, 1], [2, 0.12], [3, 0.05]]) tone(a, sr, 0.005, d + 0.08, f * k, u => g * Math.min(1, u / 0.004) * (u < d ? 1 - 0.3 * u / d : 0.7 * ex(u - d, 0.014)));
      speaker(a, sr, 1.2);
    }
    // ---- sfx recipes: name: [seconds, variants, fill(a, sr, r, variant), {g: mix gain, ref: m, send: reverb, bus, far}] --
    function gun(a, sr, r, o) {
      if (o.nwave) { const n = at(sr, 0.0003); for (let i = 0; i < n; i++) { a[i] += 1.4; a[i + n] -= 1.4; } }
      burst(a, sr, r, 0, 0.004, u => o.crack * ex(u, 0.0007));
      const lpA = bq('lp', o.lp, 0.7, sr), bpB = bq('bp', 700, 0.7, sr);
      burst(a, sr, r, 0, o.tau * 8, u => ex(u, o.tau), x => lpA(x) * 0.9 + bpB(x) * 1.6);
      tone(a, sr, 0, o.boomTau * 7, u => o.boom * (1 + 1.2 * ex(u, 0.012)), u => o.boomAmp * ar(u, 0.001, o.boomTau));
      if (o.ring) { mode(a, sr, 0.001, o.ring, 0.05, 0.06); mode(a, sr, 0.001, o.ring * 1.61, 0.03, 0.04); }
      if (o.mech) tick(a, sr, r, o.mech, 0.12, 2400);
      norm(a); fx(a, x => Math.tanh(1.6 * x));
    }
    function gunFar(a, sr, r, boom) {
      burst(a, sr, r, 0, 0.3, u => ar(u, 0.003, 0.05), bq('lp', 700, 0.7, sr));
      tone(a, sr, 0, 1, u => boom * (1 + 0.6 * ex(u, 0.02)), u => 0.8 * ar(u, 0.004, 0.14));
      burst(a, sr, r, 0.05, 2.6, u => 0.18 * ar(u, 0.3, 0.7), bq('lp', 900, 0.7, sr));
      echo(a, sr, [[0.21, 0.42], [0.47, 0.3], [0.83, 0.2], [1.36, 0.12]]);
    }
    const knuckle = (a, sr, r, t, g) => { for (const [f, tau, k] of [[170, 0.035, 1], [335, 0.025, 0.6], [615, 0.018, 0.45], [1150, 0.01, 0.3]]) mode(a, sr, t, f * (1 + 0.05 * r()), tau, g * k); scuff(a, sr, r, t, 2600, 0.0015, g * 0.6); };
    function punch(a, sr, r, g) {
      tone(a, sr, 0, 0.3, u => 55 + 75 * ex(u, 0.02), u => g * ar(u, 0.002, 0.05));
      scuff(a, sr, r, 0, 1700 + r() * 500, 0.004, g * 1.4, 0.7);
      burst(a, sr, r, 0, 0.15, u => g * 0.6 * ar(u, 0.002, 0.03), bq('lp', 700, 0.7, sr));
      burst(a, sr, r, 0.005, 0.12, u => g * 0.12 * hump(u, 0.1), bq('hp', 3000, 0.7, sr));
    }
    function fall(a, sr, r, t, g) {
      tone(a, sr, t, 0.6, u => 48 + 40 * ex(u, 0.04), u => g * ar(u, 0.003, 0.12));
      burst(a, sr, r, t, 0.4, u => g * 0.8 * ar(u, 0.003, 0.06), bq('lp', 500, 0.7, sr));
      burst(a, sr, r, t, 0.35, u => g * 0.25 * ar(u, 0.01, 0.08), bq('bp', 800, 0.5, sr));
      const t2 = t + 0.09 + r() * 0.05; tone(a, sr, t2, 0.3, u => 70 + 30 * ex(u, 0.02), u => g * 0.4 * ar(u, 0.002, 0.05));
      scuff(a, sr, r, t + 0.25 + r() * 0.08, 1200, 0.006, g * 0.35, 0.8);
    }
    function marimbaNote(a, sr, t, f, g) { mode(a, sr, t, f, 0.18, g); mode(a, sr, t, f * 3.93, 0.03, g * 0.35); mode(a, sr, t, f * 9.2, 0.008, g * 0.12); }
    const MOTIF = ['D5', 'A4', 'D5', 'E5', 'F5'].map(midi);
    function ringCycle(a, sr) { for (const s of [0, 1.05]) MOTIF.forEach((m, k) => { const f = hz(m); marimbaNote(a, sr, s + k * 0.13, f, 1); mode(a, sr, s + k * 0.13, f * 2, 0.08, 0.2); }); speaker(a, sr, 1.3); }
    function landline(a, sr) { for (const s of [0, 0.6]) tone(a, sr, s, 0.4, u => (Math.floor(u * 32) % 2 ? 1450 : 1150), u => Math.min(1, u / 0.005, (0.4 - u) / 0.005), 'sq', bq('bp', 1400, 1.4, sr)); speaker(a, sr, 1.8); }
    function scream(a, sr, r, f0, len, far) {
      const F = [[850, 5, 1], [1250, 6, 0.6], [2900, 8, 0.3]].map(([f, q, g]) => [f * (0.95 + 0.1 * r()), q, g]);
      call(a, sr, r, 0, len, u => f0 * (1 + 0.45 * hump(u, len) + 0.05 * Math.sin(TAU * 6 * u) + 0.08 * Math.sin(TAU * 31 * u)), F, 1, 0.6, 0.05);
      call(a, sr, r, 0, len, u => f0 * 0.5 * (1 + 0.45 * hump(u, len)), F, 0.3, 0.8, 0.05);   // subharmonic: a torn voice
      burst(a, sr, r, 0, len, u => 0.35 * hump(u, len), bq('bp', 2200, 0.8, sr));
      if (far) { fx(a, bq('lp', 2200, 0.7, sr)); echo(a, sr, [[0.23, 0.3], [0.61, 0.15]]); }
    }
    function dog(a, sr, r, t, g) {
      call(a, sr, r, t, 0.16, u => 420 + 280 * hump(u, 0.16) - 120 * u / 0.16, [[750, 2.5, 1], [1600, 3, 0.7], [2900, 4, 0.35]], g, 0.7, 0.006);
      burst(a, sr, r, t, 0.16, u => g * 0.5 * ar(u, 0.004, 0.05), bq('bp', 1200, 0.7, sr));
    }
    const SFX = {
      click: [0.55, 6, (a, sr, r, i) => {                                           // THE click: haptic snap, 2.5 kHz ping, throat rattle
        const n = [1, 2, 3, 2, 4, 1][i], f0 = 2300 + r() * 400, gap = 0.03 + r() * 0.025;
        let t = 0;
        for (let k = 0; k < n; k++) {
          const g = k ? 0.5 + 0.35 * r() : 1;
          burst(a, sr, r, t, 0.004, u => g * ex(u, 0.0005), bq('bp', 4300, 1, sr));
          tone(a, sr, t, 0.17, u => f0 * (1 + 0.05 * ex(u, 0.008)), u => g * 0.55 * ex(u, 0.024));      // the ping: a tongue-tock settling
          mode(a, sr, t, f0 * 1.018, 0.02, g * 0.3);                                                       // a hair sharp: grating beats
          mode(a, sr, t, f0 * 1.51, 0.01, g * 0.22);
          mode(a, sr, t, f0 * 0.49, 0.008, g * 0.2);
          mode(a, sr, t, 850 + r() * 250, 0.005, g * 0.35);
          t += gap * (0.8 + 0.4 * r());
        }
        const len = 0.16 + r() * 0.16;
        for (let u = 0; u < len; u += 1 / (24 + r() * 22)) {
          const g = 0.3 * Math.pow(Math.sin(Math.PI * u / len), 0.6) * (0.6 + 0.4 * r());
          mode(a, sr, t + u, 380 + r() * 80, 0.0045, g); mode(a, sr, t + u, 1150 + r() * 200, 0.0022, g * 0.7); mode(a, sr, t + u, 2500 + r() * 300, 0.0012, g * 0.4);
        }
        burst(a, sr, r, t, len, u => 0.05 * hump(u, len), bq('bp', 1500, 0.8, sr));
      }, { g: 0.95, ref: 4, send: 0.35 }],
      click_counter: [0.2, 3, (a, sr, r) => { tick(a, sr, r, 0, 1, 3100 + r() * 300); mode(a, sr, 0, 5400, 0.008, 0.3); tick(a, sr, r, 0.05 + r() * 0.02, 0.45, 2600); }, { g: 0.5, ref: 2 }],
      notif_chime: [1.9, 1, (a, sr) => { for (const [t, f] of [[0, 1047], [0.11, 1568]]) { mode(a, sr, t, f, 0.35, 1); mode(a, sr, t, f * 2, 0.12, 0.25); mode(a, sr, t, f * 3, 0.05, 0.1); mode(a, sr, t, f * 4.2, 0.03, 0.08); } speaker(a, sr, 1.2); }, { g: 0.5, ref: 2 }],
      phone_ring: [2.2, 1, (a, sr) => ringCycle(a, sr), { g: 0.6, ref: 2 }],
      landline_ring: [1.1, 1, (a, sr) => landline(a, sr), { g: 0.55, ref: 3 }],
      dial_tone: [3, 1, (a, sr) => { tone(a, sr, 0, 3, 425, u => (0.6 + 0.4 * Math.sin(TAU * 25 * u)) * Math.min(1, u / 0.01, (3 - u) / 0.05)); speaker(a, sr, 1.1); }, { g: 0.4, ref: 1.5 }],
      phone_buzz: [1.1, 1, (a, sr, r) => {
        for (const s of [0, 0.6]) { tone(a, sr, s, 0.4, u => 172 + 6 * Math.sin(TAU * 9 * u), u => Math.min(1, u / 0.02, (0.4 - u) / 0.03), 'sq', bq('lp', 900, 0.8, sr)); burst(a, sr, r, s, 0.4, u => 0.08 * hump(u, 0.4) * (1 + Math.sin(TAU * 172 * u)), bq('bp', 3200, 2, sr)); }
      }, { g: 0.5, ref: 2 }],
      phone_boot: [1.6, 1, (a, sr) => MOTIF.forEach((m, k) => { const s = at(sr, k * 0.15), b = new Float32Array(a.length - s); phoneNote(b, sr, m, k === 4 ? 0.55 : 0.12); for (let i = 0; i < b.length; i++) a[s + i] += b[i]; }), { g: 0.5, ref: 1.5 }],
      glass_break: [2, 3, (a, sr, r) => {
        scuff(a, sr, r, 0, 3000, 0.004, 1.5, 0.8); thud(a, sr, 0, 90, 0.03, 0.4);
        shards(a, sr, r, 0.003, 140, 0.22, 0.5);
        for (let k = 0; k < 6; k++) { const t = 0.25 + r() * 0.7; mode(a, sr, t, 1200 + r() * 1400, 0.05, 0.25); scuff(a, sr, r, t, 3500, 0.002, 0.3); shards(a, sr, r, t, 10, 0.04, 0.2); }
        burst(a, sr, r, 0, 1, u => 0.12 * ex(u, 0.15), bq('hp', 2000, 0.7, sr));
      }, { g: 0.9, ref: 6, send: 0.3 }],
      bottle_break: [1.2, 3, (a, sr, r) => { mode(a, sr, 0, 1250 + r() * 300, 0.02, 0.8); mode(a, sr, 0, 2700, 0.012, 0.4); scuff(a, sr, r, 0, 2500, 0.004, 1.2); shards(a, sr, r, 0.004, 50, 0.12, 0.45); for (let k = 0; k < 3; k++) mode(a, sr, 0.15 + r() * 0.4, 1600 + r() * 900, 0.03, 0.2); }, { g: 0.85, ref: 5, send: 0.3 }],
      knock: [0.3, 3, (a, sr, r) => knuckle(a, sr, r, 0, 1), { g: 0.8, ref: 3, send: 0.25 }],
      door_knock: [0.9, 3, (a, sr, r) => { let t = 0; for (let k = 0; k < 3; k++) { knuckle(a, sr, r, t, k === 2 ? 1 : 0.85); t += 0.17 + r() * 0.05; } }, { g: 0.8, ref: 3, send: 0.25 }],
      door_open: [1.5, 2, (a, sr, r) => {
        tick(a, sr, r, 0, 0.8, 2500); tick(a, sr, r, 0.06, 0.5, 2100);
        stickSlip(a, sr, r, 0.15, 0.95 + r() * 0.3, u => 35 + 70 * Math.sin(Math.PI * u) ** 2, [[320, 0.01, 1], [710, 0.008, 0.7], [1290, 0.005, 0.45], [2100, 0.003, 0.25]], 0.3);
        burst(a, sr, r, 0.1, 0.8, u => 0.12 * hump(u, 0.8), bq('lp', 400, 0.7, sr));
      }, { g: 0.7, ref: 3, send: 0.3 }],
      door_slam: [1.2, 2, (a, sr, r) => {
        for (const [f, tau, g] of [[75, 0.12, 1], [160, 0.07, 0.6], [310, 0.04, 0.4], [620, 0.02, 0.3]]) mode(a, sr, 0, f, tau, g);
        burst(a, sr, r, 0, 0.1, u => ex(u, 0.012), bq('lp', 1200, 0.7, sr)); tick(a, sr, r, 0.008, 0.6, 2800);
        for (let k = 0; k < 8; k++) tick(a, sr, r, 0.02 + r() * 0.25, 0.25 * r(), 1200 + r() * 1800);
      }, { g: 1, ref: 5, send: 0.35 }],
      wood_crash: [2.6, 2, (a, sr, r) => {
        thud(a, sr, 0, 65, 0.15, 1); thud(a, sr, 0.01, 140, 0.08, 0.6); burst(a, sr, r, 0, 0.3, u => 0.9 * ex(u, 0.04), bq('lp', 1500, 0.7, sr));
        for (let k = 0; k < 70; k++) { const t = -Math.log(1 - r() * 0.98) * 0.15, g = 0.5 * ex(t, 0.4) * (0.3 + r()); scuff(a, sr, r, t, 1500 + r() * 2500, 0.001 + r() * 0.002, g); mode(a, sr, t, 250 + r() * 1350, 0.01 + r() * 0.03, g * 0.5); }
        for (let k = 0; k < 12; k++) { const t = 0.3 + r() * 1.3, f = 200 + r() * 400, g = 0.25 * r(); mode(a, sr, t, f, 0.02, g); mode(a, sr, t, f * 2.4, 0.012, g * 0.5); tick(a, sr, r, t, 0.1, 900 + r() * 900); }
        for (let k = 0; k < 3; k++) { const t = 0.2 + r() * 0.4; mode(a, sr, t, 2100 + r() * 300, 0.05, 0.25); mode(a, sr, t, 5300, 0.03, 0.12); }
      }, { g: 1, ref: 5, send: 0.3 }],
      punch: [0.35, 4, (a, sr, r) => punch(a, sr, r, 1), { g: 0.85, ref: 3, send: 0.15 }],
      body_fall: [0.9, 3, (a, sr, r) => fall(a, sr, r, 0, 1), { g: 0.85, ref: 3, send: 0.2 }],
      tackle: [1.3, 2, (a, sr, r) => {
        whoosh(a, sr, r, 0, 0.18, 300, 1200, 0.3);
        const b = new Float32Array(a.length), s = at(sr, 0.15); punch(b, sr, r, 1.3); for (let i = s; i < a.length; i++) a[i] += b[i - s];
        fall(a, sr, r, 0.4, 1); grains(a, sr, r, 0.2, 0.8, 50, 600, 3000, 0.25, 0.7);
      }, { g: 0.95, ref: 4, send: 0.2 }],
      gunshot: [0.9, 3, (a, sr, r) => gun(a, sr, r, { crack: 1, lp: 3500, tau: 0.045, boom: 70, boomAmp: 0.9, boomTau: 0.08, mech: 0.07 }), { g: 1, ref: 12, send: 0.5, far: 'gunshot_far', peak: 0.95 }],
      revolver_shot: [1, 3, (a, sr, r) => gun(a, sr, r, { crack: 1.1, lp: 3000, tau: 0.065, boom: 60, boomAmp: 1.1, boomTau: 0.12, ring: 3100 }), { g: 1, ref: 12, send: 0.5, far: 'gunshot_far', peak: 0.95 }],
      rifle_shot: [1.1, 3, (a, sr, r) => gun(a, sr, r, { nwave: true, crack: 1.2, lp: 4500, tau: 0.08, boom: 55, boomAmp: 1.2, boomTau: 0.16 }), { g: 1, ref: 15, send: 0.55, far: 'gunshot_far', peak: 0.95 }],
      shotgun: [1.2, 2, (a, sr, r) => gun(a, sr, r, { crack: 1, lp: 2500, tau: 0.11, boom: 48, boomAmp: 1.4, boomTau: 0.18 }), { g: 1, ref: 14, send: 0.55, far: 'gunshot_far', peak: 0.95 }],
      gunshot_far: [3, 3, (a, sr, r, i) => gunFar(a, sr, r, 55 + i * 8), { g: 0.8, ref: 60, send: 0.3 }],
      reload: [1.8, 1, (a, sr, r) => {
        tick(a, sr, r, 0, 0.7, 2600); whoosh(a, sr, r, 0.1, 0.1, 800, 2000, 0.15); tick(a, sr, r, 0.2, 0.6, 3300);
        for (let k = 0; k < 5; k++) { const t = 0.35 + r() * 0.25, f = 5200 + r() * 1800; mode(a, sr, t, f, 0.02, 0.35); mode(a, sr, t, f * 1.5, 0.01, 0.2); mode(a, sr, t + 0.06 + r() * 0.05, f * 1.02, 0.012, 0.15); }
        for (const t of [0.85, 1.02, 1.16]) { tick(a, sr, r, t, 0.35, 2800); thud(a, sr, t, 400, 0.008, 0.15); }
        tick(a, sr, r, 1.38, 1, 2300);
        for (let k = 0; k < 8; k++) tick(a, sr, r, 1.45 + k * (0.03 + k * 0.004), 0.3 * (1 - k / 8), 3800);
      }, { g: 0.55, ref: 2, send: 0.15 }],
      dry_fire: [0.3, 2, (a, sr, r) => { tick(a, sr, r, 0, 1, 3200); thud(a, sr, 0, 420, 0.01, 0.3); }, { g: 0.6, ref: 2, send: 0.15 }],
      car_crash: [3.6, 1, (a, sr, r) => {
        thud(a, sr, 0, 45, 0.25, 1); burst(a, sr, r, 0, 0.8, u => 1.1 * ex(u, 0.08), bq('lp', 1800, 0.7, sr));
        for (let k = 0; k < 45; k++) { const t = -Math.log(1 - r() * 0.97) * 0.12, g = (0.2 + r() * 0.6) * ex(t, 0.3), f = 180 + r() * 2600; mode(a, sr, t, f, 0.02 + r() * 0.1, g); mode(a, sr, t, f * 2.7, 0.015, g * 0.4); scuff(a, sr, r, t, 1000 + r() * 3000, 0.003, g * 0.6); }
        shards(a, sr, r, 0.03, 160, 0.25, 0.5);
        burst(a, sr, r, 0.3, 1.3, u => 0.35 * hump(u, 1.3) * (0.5 + 0.5 * Math.sin(TAU * 13 * u) * Math.sin(TAU * 3.1 * u)), bq('bp', 1200, 4, sr));
        for (let k = 0; k < 20; k++) tick(a, sr, r, 0.4 + r() * 2.2, 0.3 * r() * ex(k, 12), 1500 + r() * 4000);
        burst(a, sr, r, 1, 2.6, u => 0.04 * Math.min(1, u / 0.5), bq('hp', 3000, 0.7, sr));
      }, { g: 1, ref: 10, send: 0.4 }],
      tyre_screech: [1.7, 2, (a, sr, r) => { let j = 0; tone(a, sr, 0, 1.6, u => 1150 + 120 * Math.sin(TAU * 3 * u) + (j = j * 0.999 + (r() - 0.5) * 8), u => ar(u, 0.08, 0.9) * Math.min(1, (1.6 - u) / 0.1), 'saw', bq('bp', 1300, 3, sr)); burst(a, sr, r, 0, 1.6, u => 0.4 * ar(u, 0.05, 0.9), bq('bp', 1500, 2, sr)); norm(a); fx(a, x => Math.tanh(1.5 * x)); }, { g: 0.8, ref: 10, send: 0.3 }],
      horn: [0.9, 1, (a, sr) => { for (const f of [415, 518]) tone(a, sr, 0, 0.8, f, u => Math.min(1, u / 0.015, (0.8 - u) / 0.04), 'sq', bq('bp', 1800, 1, sr)); norm(a); fx(a, x => Math.tanh(2 * x), bq('lp', 3500, 0.7, sr)); }, { g: 0.8, ref: 8, send: 0.3 }],
      truck_horn: [2, 1, (a, sr, r) => { for (const f of [147, 185, 220]) tone(a, sr, 0, 1.9, u => f * (1 + 0.004 * (r() - 0.5)), u => Math.min(1, u / 0.08, (1.9 - u) / 0.2), 'saw', bq('bp', 900, 0.7, sr)); norm(a); fx(a, x => Math.tanh(1.8 * x)); }, { g: 0.9, ref: 14, send: 0.35 }],
      siren: [5, 1, (a, sr) => { tone(a, sr, 0, 5, u => 650 + 650 * (0.5 - 0.5 * Math.cos(TAU * u / 3.2)), u => Math.min(1, u / 0.1, (5 - u) / 0.4), 'sq', bq('bp', 1200, 0.6, sr)); norm(a); fx(a, x => Math.tanh(1.5 * x)); }, { g: 0.7, ref: 20, send: 0.35 }],
      scanner_beep: [0.6, 1, (a, sr) => { for (const [t, f, d] of [[0, 2900, 0.06], [0.11, 2900, 0.06], [0.26, 3400, 0.18]]) tone(a, sr, t, d, f, u => Math.min(1, u / 0.003, (d - u) / 0.003), 'sq', bq('lp', 6000, 0.7, sr)); }, { g: 0.45, ref: 2 }],
      scanner_shriek: [1.6, 1, (a, sr) => { tone(a, sr, 0, 1.55, u => (Math.floor(u * 18) % 2 ? 3100 : 2300) * (1 + 0.02 * Math.sin(TAU * 40 * u)), u => Math.min(1, u / 0.01, (1.55 - u) / 0.1), 'sq', bq('lp', 7000, 0.7, sr)); norm(a); fx(a, x => Math.tanh(2.5 * x)); }, { g: 0.55, ref: 3 }],
      swipe: [0.25, 3, (a, sr, r) => whoosh(a, sr, r, 0, 0.16, 1800, 4200, 1, 1.5), { g: 0.3, ref: 1.5 }],
      whisper: [1.9, 6, (a, sr, r) => { babble(a, sr, r, 0.02, 1.8, { f0: 95, rate: 5.5, voiced: 0.12, amp: 1, gap: 0.2, fric: 0.5 }); fx(a, bq('lp', 3200, 0.7, sr)); fade(a, sr, 0.1); }, { g: 0.45, ref: 2.5, send: 0.3 }],
      scroller_scream: [1.4, 3, (a, sr, r) => {
        scream(a, sr, r, 440 + r() * 140, 1.05);
        const s = at(sr, 0.9), w = at(sr, 0.025); for (let k = 1; k < 6; k++) for (let i = 0; i < w; i++) a[s + k * w + i] = a[s + i] * (1 - k / 7) + (k % 2 ? 0 : a[s + k * w + i] * 0.3);
        norm(a); fx(a, x => Math.round(Math.tanh(3 * x) * 12) / 12);
      }, { g: 0.95, ref: 8, send: 0.4 }],
      heartbeat: [0.9, 1, (a, sr) => { tone(a, sr, 0, 0.4, u => 58 - 10 * u, u => ar(u, 0.008, 0.07)); tone(a, sr, 0, 0.2, 110, u => 0.3 * ar(u, 0.004, 0.04)); tone(a, sr, 0.3, 0.3, u => 66 - 10 * u, u => 0.7 * ar(u, 0.006, 0.05)); fx(a, bq('lp', 300, 0.7, sr)); }, { g: 0.8, ref: 1 }],
      typing_tap: [0.06, 4, (a, sr, r) => { scuff(a, sr, r, 0, 3500, 0.0007, 1, 1); mode(a, sr, 0, 1500 + r() * 300, 0.004, 0.4); mode(a, sr, 0, 5200, 0.002, 0.2); }, { g: 0.25, ref: 1 }],
      send_whoosh: [0.5, 1, (a, sr, r) => whoosh(a, sr, r, 0, 0.36, 600, 4000, 1, 2), { g: 0.4, ref: 1 }],
      tv_on: [0.7, 1, (a, sr, r) => { tick(a, sr, r, 0, 0.8, 1200); thud(a, sr, 0, 90, 0.02, 0.3); burst(a, sr, r, 0.02, 0.6, u => 0.3 * ex(u, 0.12), bq('bp', 3000, 0.6, sr)); }, { g: 0.5, ref: 3 }],
      tv_off: [0.5, 1, (a, sr, r) => { tick(a, sr, r, 0, 0.8, 1200); tone(a, sr, 0.01, 0.16, u => 1200 * Math.pow(0.15, u / 0.16), u => 0.25 * (1 - u / 0.16)); burst(a, sr, r, 0, 0.15, u => 0.2 * ex(u, 0.04), bq('bp', 3000, 0.6, sr)); }, { g: 0.5, ref: 3 }],
      radio_static: [1.6, 2, (a, sr, r) => {
        burst(a, sr, r, 0, 1.6, u => 0.5 * Math.min(1, u / 0.05, (1.6 - u) / 0.1) * (0.7 + 0.3 * Math.sin(TAU * 1.3 * u)), bq('bp', 1800, 0.5, sr));
        for (let k = 0; k < 45; k++) scuff(a, sr, r, r() * 1.5, 1000 + r() * 3000, 0.0008, 0.8 * r() * r(), 0.8);
        tone(a, sr, 0.2, 1.2, u => 1200 + 300 * Math.sin(TAU * 0.6 * u), u => 0.1 * hump(u, 1.2));
      }, { g: 0.4, ref: 3 }],
      radio_click: [0.35, 1, (a, sr, r) => { tick(a, sr, r, 0, 1, 2000); burst(a, sr, r, 0.02, 0.2, u => 0.6 * ar(u, 0.005, 0.05), bq('bp', 2500, 0.7, sr)); }, { g: 0.4, ref: 2 }],
      fire_whoosh: [2.4, 1, (a, sr, r) => {
        whoosh(a, sr, r, 0, 0.6, 250, 1600, 0.8, 1); const br = brownish(r), lp = bq('lp', 350, 0.7, sr);
        burst(a, sr, r, 0, 2.3, u => ar(u, 0.15, 0.45) * 2, x => lp(br() + x * 0.2));
        for (let k = 0; k < 12; k++) scuff(a, sr, r, 0.2 + r() * 1.4, 1000 + r() * 3500, 0.001, 0.4 * r(), 0.9);
      }, { g: 0.9, ref: 6, send: 0.3 }],
      explosion: [5, 2, (a, sr, r) => {
        burst(a, sr, r, 0, 0.03, u => ex(u, 0.004)); tone(a, sr, 0, 2.5, u => 28 + 30 * ex(u, 0.25), u => 1.2 * ar(u, 0.003, 0.5));
        const br = brownish(r), lp2 = bq('lp', 150, 0.7, sr);
        burst(a, sr, r, 0, 5, u => 1.6 * ar(u, 0.005, 0.7), bq('lp', 700, 0.7, sr));
        burst(a, sr, r, 0, 5, u => 6 * ex(u, 0.9), () => lp2(br()));
        for (let k = 0; k < 60; k++) { const t = 0.2 + r() * 2.4, g = 0.2 * ex(t, 1) * r(); scuff(a, sr, r, t, 800 + r() * 3000, 0.002, g); if (r() < 0.3) tick(a, sr, r, t, g, 2000 + r() * 3000); }
        norm(a); fx(a, x => Math.tanh(1.8 * x));
      }, { g: 1, ref: 25, send: 0.5 }],
      brick_hit: [0.7, 3, (a, sr, r) => {
        for (const [f, tau, g] of [[140, 0.03, 1], [260, 0.02, 0.5], [520, 0.012, 0.3]]) mode(a, sr, 0, f * (1 + 0.1 * r()), tau, g);
        scuff(a, sr, r, 0, 1200, 0.006, 0.9, 0.8); const t = 0.14 + r() * 0.06; thud(a, sr, t, 180, 0.015, 0.4); scuff(a, sr, r, t, 1400, 0.004, 0.4);
        burst(a, sr, r, 0.25, 0.2, u => 0.15 * hump(u, 0.2), bq('bp', 900, 1.5, sr));
      }, { g: 0.8, ref: 5, send: 0.3 }],
      pluck: [1.3, 1, (a, sr, r) => { ks(a, sr, r, 0, hz(57), { decay: 1.4, bright: 0.35, pick: 0.25, vel: 1 }); fx(a, bq('hp', 120, 0.7, sr), bq('pk', 2700, 1, sr, 2)); fade(a, sr, 0.3); }, { g: 0.35, bus: 'ui' }],
      ui_select: [1.3, 1, (a, sr, r) => { ks(a, sr, r, 0, hz(57), { decay: 1.2, bright: 0.4, pick: 0.2, vel: 0.8 }); ks(a, sr, r, 0.035, hz(62), { decay: 1.4, bright: 0.45, pick: 0.2, vel: 1 }); fx(a, bq('hp', 120, 0.7, sr)); fade(a, sr, 0.3); }, { g: 0.4, bus: 'ui' }],
      page_turn: [0.7, 3, (a, sr, r) => { grains(a, sr, r, 0.02, 0.5, 90, 2000, 8000, 0.8); whoosh(a, sr, r, 0.05, 0.4, 1500, 3000, 0.25, 0.7); }, { g: 0.45, bus: 'ui' }],
      breath_in: [0.8, 2, (a, sr, r) => { const f1 = bq('bp', 1500, 1.2, sr), f2 = bq('bp', 2800, 3, sr); burst(a, sr, r, 0, 0.7, u => Math.min(1, (u / 0.55) ** 2, Math.max(0, (0.68 - u) / 0.1)), x => f1(x) + f2(x) * 0.6); }, { g: 0.45, ref: 1.5 }],
      gasp: [0.5, 2, (a, sr, r) => { const f1 = bq('bp', 1100, 1.5, sr), f2 = bq('bp', 2400, 3, sr); burst(a, sr, r, 0, 0.35, u => ar(u, 0.05, 0.1), x => f1(x) + f2(x) * 0.5); call(a, sr, r, 0.02, 0.25, u => 210 + 80 * u, [[800, 5, 1], [1250, 6, 0.5]], 0.15, 0.1, 0.03); }, { g: 0.55, ref: 1.5 }],
      chirp: [0.45, 1, (a, sr) => { for (const [t, f, d] of [[0, 3200, 0.04], [0.09, 4100, 0.04], [0.18, 3200, 0.07]]) tone(a, sr, t, d, f, u => Math.min(1, u / 0.002, (d - u) / 0.002), 'sq', bq('lp', 7000, 0.7, sr)); }, { g: 0.3, ref: 1.5 }],
      tape_click: [0.4, 1, (a, sr, r) => { scuff(a, sr, r, 0, 2200, 0.001, 1); mode(a, sr, 0, 900, 0.015, 0.5); mode(a, sr, 0, 1900, 0.01, 0.3); thud(a, sr, 0, 140, 0.03, 0.4); tick(a, sr, r, 0.09, 0.3, 1800); }, { g: 0.5, ref: 2 }],
      tape_hiss: [4, 1, (a, sr, r) => { const e = t => Math.min(1, t / 0.3, (4 - t) / 0.3); noiseTo(a, sr, r, bq('hp', 2500, 0.7, sr), t => 0.3 * (1 + 0.1 * Math.sin(TAU * 0.5 * t)) * e(t)); tone(a, sr, 0, 4, 50, t => 0.02 * e(t)); }, { g: 0.3, ref: 2 }],
      shovel: [1.2, 2, (a, sr, r) => { whoosh(a, sr, r, 0, 0.18, 1800, 2600, 0.6, 2); mode(a, sr, 0.02, 1800, 0.04, 0.3); mode(a, sr, 0.02, 3100, 0.03, 0.2); burst(a, sr, r, 0.12, 0.2, u => 0.8 * ar(u, 0.003, 0.04), bq('lp', 1500, 0.7, sr)); grains(a, sr, r, 0.12, 0.15, 30, 500, 2500, 0.4); grains(a, sr, r, 0.5, 0.6, 60, 500, 3000, 0.25); }, { g: 0.7, ref: 3, send: 0.2 }],
      bell: [6, 1, (a, sr, r) => { [[0.5, 0.6, 2.4], [1, 1, 2], [1.19, 0.5, 1.6], [1.5, 0.3, 1.2], [2, 0.6, 1], [2.5, 0.2, 0.6], [2.66, 0.2, 0.5], [3.01, 0.15, 0.4], [4.1, 0.1, 0.25]].forEach(([k, g, tau]) => { mode(a, sr, 0, 520 * k, tau, g); mode(a, sr, 0, 520 * k + 0.4, tau, g * 0.5); }); scuff(a, sr, r, 0, 3000, 0.002, 0.8); }, { g: 0.8, ref: 20, send: 0.45 }],
      water_splash: [1.3, 3, (a, sr, r) => { burst(a, sr, r, 0, 0.3, u => ar(u, 0.002, 0.03), bq('lp', 2500, 0.7, sr)); burst(a, sr, r, 0, 0.5, u => 0.6 * ar(u, 0.01, 0.12), bq('bp', 700, 0.8, sr)); bubbles(a, sr, r, 0.02, 0.5, 14, 300, 1400, 0.15); bubbles(a, sr, r, 0.2, 0.8, 8, 900, 2500, 0.06); }, { g: 0.8, ref: 5, send: 0.3 }],
      swing: [0.4, 3, (a, sr, r) => whoosh(a, sr, r, 0, 0.26, 400, 1400, 1, 1.4), { g: 0.45, ref: 2 }],
      stab: [0.4, 3, (a, sr, r) => { burst(a, sr, r, 0, 0.05, u => ar(u, 0.001, 0.012), bq('lp', 1200, 0.7, sr)); burst(a, sr, r, 0.01, 0.2, u => 0.6 * ar(u, 0.01, 0.05), bq('bp', 600, 3, sr)); burst(a, sr, r, 0, 0.1, u => 0.15 * hump(u, 0.08), bq('hp', 3500, 0.7, sr)); }, { g: 0.75, ref: 2, send: 0.15 }],
      bow: [0.6, 2, (a, sr, r) => { mode(a, sr, 0, 110, 0.12, 1); mode(a, sr, 0, 221, 0.08, 0.5); mode(a, sr, 0, 334, 0.05, 0.25); tick(a, sr, r, 0, 0.4, 1500); whoosh(a, sr, r, 0.01, 0.2, 900, 2500, 0.3, 1.5); }, { g: 0.55, ref: 3 }],
      arrow_hit: [0.45, 3, (a, sr, r) => { mode(a, sr, 0, 280, 0.03, 1); mode(a, sr, 0, 650, 0.02, 0.5); burst(a, sr, r, 0, 0.02, u => 0.8 * ex(u, 0.003), bq('lp', 2000, 0.7, sr)); tone(a, sr, 0, 0.4, 90, u => 0.3 * ex(u, 0.1) * Math.sin(TAU * 30 * u)); }, { g: 0.7, ref: 4, send: 0.2 }],
      pickup: [0.35, 3, (a, sr, r) => { grains(a, sr, r, 0, 0.2, 25, 1000, 5000, 0.4, 0.8); tick(a, sr, r, 0.12, 0.3, 2400 + r() * 800); }, { g: 0.4, ref: 1.5 }],
      craft: [1.1, 2, (a, sr, r) => { grains(a, sr, r, 0.05, 0.65, 220, 1500, 4000, 0.6, 2); scuff(a, sr, r, 0.72, 2500, 0.003, 0.8); tick(a, sr, r, 0.9, 0.4, 2000); tick(a, sr, r, 1, 0.3, 2600); }, { g: 0.45, ref: 1.5 }],
      metal_hit: [2.2, 3, (a, sr, r) => { const f = 480 + r() * 200; [[1, 0.5, 1], [2.76, 0.25, 0.6], [5.4, 0.12, 0.35], [8.93, 0.06, 0.2]].forEach(([k, tau, g]) => mode(a, sr, 0, f * k, tau, g)); thud(a, sr, 0, 110, 0.02, 0.5); scuff(a, sr, r, 0, 3000, 0.002, 0.7); }, { g: 0.75, ref: 5, send: 0.3 }],
      battery_whine: [1.4, 1, (a, sr, r) => { tone(a, sr, 0, 1.35, u => 1800 * Math.pow(2, u * 1.8) * (1 + 0.05 * Math.sin(TAU * 70 * u)), u => 0.3 + 0.7 * u / 1.35); burst(a, sr, r, 0, 1.35, u => 0.3 * u, bq('hp', 4000, 0.7, sr)); }, { g: 0.5, ref: 6 }],
      battery_burst: [2, 2, (a, sr, r) => { burst(a, sr, r, 0, 0.02, u => ex(u, 0.003)); thud(a, sr, 0, 90, 0.05, 0.8); burst(a, sr, r, 0, 1.9, u => 0.6 * ar(u, 0.02, 0.5), bq('hp', 2000, 0.7, sr)); burst(a, sr, r, 0.05, 1.8, u => ar(u, 0.1, 0.5), bq('lp', 500, 0.7, sr)); for (let k = 0; k < 25; k++) scuff(a, sr, r, 0.1 + r() * 1.6, 1500 + r() * 3000, 0.001, 0.5 * r(), 0.9); }, { g: 0.9, ref: 6, send: 0.3 }],
      ringtone: [3, 1, (a, sr) => { ['A5', 'E6', 'A5', 'E6', 'F6', 'E6', 'D6', 'C6', 'A5', 'C6', 'D6', 'E6', 'A5', 'E6', 'A5', 'E6', 'G6', 'F6', 'E6', 'D6', 'E6', 'E6', 'E6', 'E6'].forEach((n, k) => tone(a, sr, k * 0.12, 0.1, hz(midi(n)), u => Math.min(1, u / 0.003, (0.1 - u) / 0.004), 'sq')); speaker(a, sr, 2.5); }, { g: 0.6, ref: 8 }],
      dog_bark: [1, 3, (a, sr, r, i) => { dog(a, sr, r, 0, 1); if (i) dog(a, sr, r, 0.3 + r() * 0.08, 0.85); }, { g: 0.7, ref: 6, send: 0.35 }],
      car_pass: [6, 2, (a, sr, r) => { const env = u => 1 / (1 + ((u - 3) / 1.1) ** 2); tone(a, sr, 0, 6, u => 95 * (1 - 0.06 * Math.tanh((u - 3) / 0.8)), u => 0.4 * env(u), 'saw', bq('lp', 400, 0.7, sr)); burst(a, sr, r, 0, 6, env, bq('lp', 900, 0.7, sr)); }, { g: 0.6, ref: 15, send: 0.25 }],
      thunder: [7, 2, (a, sr, r) => { for (let k = 0; k < 4; k++) { const t = r() * 1.5, br = brownish(r), lp = bq('lp', 300, 0.7, sr), at0 = 0.05 + r() * 0.1; burst(a, sr, r, t, 5.5 - t, u => 3 * ar(u, at0, 1.2) * (0.6 + 0.4 * Math.sin(TAU * 0.8 * u)), () => lp(br())); } burst(a, sr, r, 0, 0.6, u => 0.2 * ar(u, 0.01, 0.1), bq('bp', 1200, 0.6, sr)); }, { g: 0.9, ref: 200, send: 0.3 }],
      scream_far: [2.4, 3, (a, sr, r) => scream(a, sr, r, 520 + r() * 180, 1 + r() * 0.5, true), { g: 0.6, ref: 20, send: 0.4 }],
      car_alarm: [4, 1, (a, sr) => { tone(a, sr, 0, 3.9, u => u < 1.3 ? 800 + 1000 * ((u * 4) % 1) : u < 2.6 ? (Math.floor(u * 10) % 2 ? 1500 : 1100) : 1300 + 400 * Math.sin(TAU * 12 * u), u => Math.min(1, u / 0.02, (3.9 - u) / 0.05), 'sq', bq('bp', 1500, 1, sr)); norm(a); fx(a, x => Math.tanh(1.5 * x)); }, { g: 0.55, ref: 15, send: 0.35 }],
      magpie: [2.4, 3, (a, sr, r) => {
        const P = [700, 900, 1100, 1300, 1650, 2000, 2400], n = 7 + (r() * 5 | 0);
        let t = 0, f = P[r() * 7 | 0];
        for (let k = 0; k < n; k++) {
          const d = 0.07 + r() * 0.18, f1 = f, f2 = P[r() * 7 | 0], g = 0.5 + 0.5 * r(), fq = u => f1 + (f2 - f1) * Math.min(1, u / 0.035);
          tone(a, sr, t, d, u => fq(u) + 40 * Math.sin(TAU * 28 * u), u => g * hump(u, d)); tone(a, sr, t, d, u => 2 * fq(u), u => g * 0.2 * hump(u, d));
          if (r() < 0.3) tone(a, sr, t, d, f2 * 1.34, u => g * 0.4 * hump(u, d));
          f = f2; t += d + r() * 0.04;
        }
      }, { g: 0.5, ref: 10, send: 0.3 }],
      kookaburra: [3.8, 2, (a, sr, r) => { let t = 0; for (let k = 0; k < 26; k++) { const x = Math.sin(Math.PI * k / 26), d = 0.06 + 0.05 * x, f0 = (700 + 500 * x) * (x > 0.5 && k % 2 ? 0.78 : 1) + r() * 80; call(a, sr, r, t, d, u => f0 * (1 + 0.5 * hump(u, d)), [[1200, 3, 1], [2400, 4, 0.5]], 0.4 + 0.6 * x, 0.5, 0.005); t += d + 0.08 - 0.05 * x; } }, { g: 0.55, ref: 15, send: 0.35 }],
      crow: [2.6, 2, (a, sr, r) => { let t = 0; for (let k = 0; k < 3; k++) { const d = k === 2 ? 0.8 : 0.35; call(a, sr, r, t, d, u => 390 - 90 * u / d, [[1000, 3, 1], [1800, 4, 0.6], [2600, 5, 0.3]], 1, 0.35, 0.02); t += d + 0.15; } }, { g: 0.55, ref: 15, send: 0.35 }],
      bird: [1, 4, (a, sr, r) => { const n = 3 + (r() * 6 | 0), f0 = 3000 + r() * 2500, s = r() < 0.5 ? -0.3 : 0.3; for (let k = 0; k < n; k++) { const d = 0.03 + r() * 0.04; tone(a, sr, k * (d + 0.03), d, u => f0 * (1 + s * u / d), u => hump(u, d)); } }, { g: 0.35, ref: 8, send: 0.25 }],
      mopoke: [1.2, 1, (a, sr, r) => { for (const [t, f] of [[0, 480], [0.42, 405]]) { tone(a, sr, t, 0.2, u => f * (1 + 0.04 * u), u => hump(u, 0.2)); tone(a, sr, t, 0.2, f * 2, u => 0.1 * hump(u, 0.2)); burst(a, sr, r, t, 0.2, u => 0.03 * hump(u, 0.2), bq('bp', f * 2, 2, sr)); } }, { g: 0.4, ref: 10, send: 0.35 }],
      gull: [1.6, 2, (a, sr, r) => { let t = 0; const n = 2 + (r() * 2 | 0); for (let k = 0; k < n; k++) { call(a, sr, r, t, 0.3, u => 1150 - 350 * u / 0.3, [[2200, 3, 1], [3500, 4, 0.5]], 1, 0.25, 0.01); t += 0.38 + r() * 0.1; } }, { g: 0.45, ref: 12, send: 0.3 }],
      whale: [7.5, 3, (a, sr, r, i) => { const lo = 70 + i * 25, hi = lo * (2.4 + r()), d = 5.5 + r(); for (const [k, g] of [[1, 1], [1.5, 0.25], [2, 0.5], [2.97, 0.2]]) tone(a, sr, 0.3, d, u => k * (lo + (hi - lo) * Math.sin(Math.PI * Math.min(1, u / d) * 0.8) ** 2), u => g * hump(u, d)); fx(a, bq('lp', 1200, 0.7, sr)); echo(a, sr, [[0.4, 0.3], [0.9, 0.15]]); }, { g: 0.6, ref: 40, send: 0.5 }],
      creak: [1.3, 3, (a, sr, r) => stickSlip(a, sr, r, 0.02, 0.7 + r() * 0.5, u => 15 + 45 * Math.sin(Math.PI * u), [[240, 0.012, 1], [580, 0.008, 0.7], [1150, 0.005, 0.4], [2200, 0.003, 0.2]], 0.5), { g: 0.4, ref: 4, send: 0.3 }],
      metal_creak: [3, 3, (a, sr, r) => { const d = 2 + r() * 0.8; stickSlip(a, sr, r, 0.05, d, u => 8 + 22 * Math.sin(Math.PI * u), [[150, 0.08, 1], [410, 0.05, 0.7], [890, 0.03, 0.45], [1500, 0.02, 0.3], [2600, 0.012, 0.15]], 0.3); tone(a, sr, 0.05, d, u => 45 + 8 * u, u => 0.2 * hump(u, d), 'saw', bq('lp', 200, 0.7, sr)); }, { g: 0.55, ref: 10, send: 0.45 }],
      drip: [0.5, 4, (a, sr, r) => { const f0 = 900 + r() * 1300; tone(a, sr, 0, 0.05, u => f0 * (1 + 0.7 * u / 0.015), u => ar(u, 0.001, 0.012)); mode(a, sr, 0, 300 + r() * 150, 0.02, 0.3); echo(a, sr, [[0.07, 0.25], [0.15, 0.12]]); }, { g: 0.35, ref: 4, send: 0.5 }],
      pigeons: [1.6, 2, (a, sr, r) => { const n = 10 + (r() * 7 | 0); for (let k = 0; k < n; k++) { const g = (0.5 + 0.5 * r()) * Math.min(1, (k + 1) / 3) * (1 - k / (n + 2)); burst(a, sr, r, k * (0.085 + r() * 0.02), 0.05, u => g * hump(u, 0.045), bq('bp', 700 + r() * 500, 0.8, sr)); } }, { g: 0.5, ref: 6, send: 0.35 }],
      phone_slam: [0.8, 2, (a, sr, r) => {                                         // a phone slammed face-down, the screen cracking
        thud(a, sr, 0, 160, 0.02, 0.8); for (const [f, tau, g] of [[420, 0.03, 0.6], [980, 0.015, 0.4], [2300, 0.008, 0.3]]) mode(a, sr, 0, f * (1 + 0.05 * r()), tau, g);
        scuff(a, sr, r, 0, 3500, 0.002, 1.2); for (let k = 0; k < 14; k++) tick(a, sr, r, 0.002 + r() * r() * 0.06, 0.25 + 0.4 * r(), 3500 + r() * 4000);
        shards(a, sr, r, 0.01, 12, 0.03, 0.15);
      }, { g: 0.85, ref: 3, send: 0.25 }],
      window_slap: [0.7, 3, (a, sr, r) => {                                        // a phone slapped screen-first against a car window
        thud(a, sr, 0, 110, 0.03, 0.7); for (const [f, tau, g] of [[260, 0.05, 0.7], [610, 0.035, 0.5], [1180, 0.02, 0.35], [2650, 0.01, 0.2]]) mode(a, sr, 0, f * (1 + 0.04 * r()), tau, g);
        scuff(a, sr, r, 0, 1800, 0.003, 0.9, 0.8); tick(a, sr, r, 0.004, 0.35, 3100);
        for (let k = 0; k < 4; k++) tick(a, sr, r, 0.03 + k * (0.018 + 0.01 * r()), 0.12 * (1 - k / 4), 1500 + r() * 800);
      }, { g: 0.8, ref: 3, send: 0.15 }],
      car_door: [1, 2, (a, sr, r) => {                                             // latch, the seal's thump, panel ring, catch
        tick(a, sr, r, 0, 0.5, 2200); thud(a, sr, 0.012, 70, 0.06, 1); burst(a, sr, r, 0.012, 0.12, u => 0.8 * ar(u, 0.002, 0.02), bq('lp', 900, 0.7, sr));
        for (const [f, tau, g] of [[180, 0.05, 0.5], [420, 0.03, 0.35], [1350, 0.02, 0.2]]) mode(a, sr, 0.012, f * (1 + 0.05 * r()), tau, g);
        tick(a, sr, r, 0.02, 0.6, 2900); for (let k = 0; k < 5; k++) tick(a, sr, r, 0.05 + r() * 0.2, 0.12 * r(), 1500 + r() * 2500);
      }, { g: 0.85, ref: 4, send: 0.25 }],
      engine_start: [3.2, 2, (a, sr, r, i) => {                                    // starter cranking, the catch, a rev, settling to idle
        const crank = 0.8 + 0.5 * i;
        tone(a, sr, 0, crank, u => 190 + 30 * Math.sin(TAU * 11 * u), u => 0.12 * Math.min(1, u / 0.05, (crank - u) / 0.05), 'saw', bq('bp', 900, 1.5, sr));
        for (let t = 0; t < crank; t += 1 / (10 + 3 * r())) { scuff(a, sr, r, t, 250, 0.01, 0.5, 0.7); mode(a, sr, t, 70, 0.03, 0.4); }
        for (let t = crank, k = 0; t < 3.2; k++) {
          const u = t - crank, rev = Math.exp(-(((u - 0.3) / 0.22) ** 2)), g = Math.min(1, 0.3 + u / 0.05) * [1, 0.8, 0.9, 0.75][k % 4] * (1 + 0.6 * rev);
          mode(a, sr, t, 55, 0.02, g); mode(a, sr, t, 130, 0.01, g * 0.5); scuff(a, sr, r, t, 300, 0.004, g * 0.6, 0.7);
          t += 1 / (27 + 28 * rev);
        }
        burst(a, sr, r, crank, 3.2 - crank, u => 0.3 * Math.min(1, u / 0.1), bq('lp', 180, 0.7, sr));
      }, { g: 0.8, ref: 5, send: 0.2 }],
      box_cutter: [0.45, 3, (a, sr, r) => {                                        // the blade ratcheting out detent by detent
        const n = 4 + (r() * 3 | 0);
        for (let k = 0; k < n; k++) { const t = k * (0.032 + 0.012 * r()); tick(a, sr, r, t, 0.5 + 0.4 * r(), 3600 + r() * 900); mode(a, sr, t, 7200, 0.004, 0.15); }
        burst(a, sr, r, 0, n * 0.038, () => 0.06, bq('bp', 5000, 1.5, sr));
      }, { g: 0.4, ref: 1.5 }],
      keys: [0.9, 3, (a, sr, r) => { for (let k = 0; k < 16; k++) { const t = Math.pow(r(), 1.5) * 0.45, f = 2200 + r() * 4500, g = 0.2 + 0.8 * r(); mode(a, sr, t, f, 0.03 + r() * 0.08, g * 0.4); mode(a, sr, t, f * 2.41, 0.02, g * 0.2); mode(a, sr, t, f * 3.9, 0.01, g * 0.1); scuff(a, sr, r, t, 5000, 0.0006, g * 0.3); } }, { g: 0.45, ref: 2, send: 0.15 }],
      horse_scream: [2.2, 2, (a, sr, r) => {                                       // a shrill whinny with widening vibrato, then a snort
        const d = 1.5, F = [[900, 4, 1], [1800, 5, 0.6], [3200, 6, 0.3]], f0 = u => (u < 0.25 ? 600 + 1800 * u : 1050 - 440 * (u - 0.25)) * (1 + (0.04 + 0.12 * u) * Math.sin(TAU * (10 - 2 * u) * u));
        call(a, sr, r, 0, d, f0, F, 1, 0.35, 0.03); call(a, sr, r, 0, d, u => f0(u) * 0.5, F, 0.25, 0.8, 0.03);
        burst(a, sr, r, 0, d, u => 0.25 * hump(u, d), bq('bp', 2500, 0.8, sr));
        burst(a, sr, r, 1.6, 0.3, u => 0.5 * ar(u, 0.02, 0.08), bq('lp', 700, 0.7, sr));
      }, { g: 0.8, ref: 15, send: 0.35 }],
    };
    // footsteps per surface: heel strike then a softer toe roll; five variants each
    const toe = r => 0.055 + r() * 0.035;
    const STEPS = {
      concrete: (a, sr, r) => { thud(a, sr, 0, 90, 0.018, 0.5); scuff(a, sr, r, 0, 2400, 0.004, 1); grains(a, sr, r, 0, 0.04, 10, 1500, 5000, 0.3); const t = toe(r); thud(a, sr, t, 110, 0.012, 0.25); scuff(a, sr, r, t, 3000, 0.003, 0.45); },
      tile: (a, sr, r) => { scuff(a, sr, r, 0, 3800, 0.0015, 1, 1.2); mode(a, sr, 0, 2600 + r() * 300, 0.012, 0.25); thud(a, sr, 0, 110, 0.012, 0.3); const t = toe(r); scuff(a, sr, r, t, 4200, 0.0012, 0.5, 1.2); mode(a, sr, t, 2900, 0.008, 0.12); },
      gravel: (a, sr, r) => { thud(a, sr, 0, 80, 0.02, 0.4); grains(a, sr, r, 0, 0.12, 60, 1200, 5000, 0.6); grains(a, sr, r, toe(r), 0.1, 30, 1500, 5000, 0.4); },
      dirt: (a, sr, r) => { thud(a, sr, 0, 70, 0.025, 0.6); grains(a, sr, r, 0, 0.08, 25, 600, 2500, 0.35); burst(a, sr, r, 0, 0.1, u => 0.3 * ar(u, 0.004, 0.02), bq('lp', 900, 0.7, sr)); grains(a, sr, r, toe(r), 0.06, 12, 800, 2500, 0.2); },
      grass: (a, sr, r) => { burst(a, sr, r, 0, 0.14, u => 0.5 * hump(u, 0.13), bq('bp', 3500, 0.6, sr)); grains(a, sr, r, 0, 0.12, 20, 2000, 6000, 0.25); thud(a, sr, 0, 70, 0.02, 0.3); },
      wood: (a, sr, r) => { for (const [f, tau, g] of [[115, 0.05, 0.6], [240, 0.035, 0.4], [510, 0.02, 0.25], [1100, 0.01, 0.2]]) mode(a, sr, 0, f * (1 + 0.06 * r()), tau, g); scuff(a, sr, r, 0, 2000, 0.003, 0.5); const t = toe(r); mode(a, sr, t, 240, 0.02, 0.15); scuff(a, sr, r, t, 2500, 0.002, 0.25); if (r() < 0.25) stickSlip(a, sr, r, 0.05, 0.2, u => 40 + 30 * u, [[330, 0.008, 1], [900, 0.005, 0.5]], 0.08); },
      water: (a, sr, r) => { burst(a, sr, r, 0, 0.2, u => 0.8 * hump(u, 0.18), bq('lp', 1800, 0.7, sr)); bubbles(a, sr, r, 0.02, 0.15, 6, 300, 900, 0.3); burst(a, sr, r, 0.08, 0.2, u => 0.3 * hump(u, 0.2), bq('lp', 500, 0.7, sr)); },
      snow: (a, sr, r) => { grains(a, sr, r, 0, 0.16, 80, 700, 3000, 0.5, 1.2); tone(a, sr, 0.05, 0.04, 900 + r() * 400, u => 0.08 * hump(u, 0.04)); thud(a, sr, 0, 60, 0.02, 0.3); },
      metal: (a, sr, r) => { thud(a, sr, 0, 100, 0.015, 0.5); for (const [f, tau, g] of [[430, 0.12, 0.35], [1190, 0.07, 0.25], [2380, 0.04, 0.18], [3700, 0.02, 0.1]]) mode(a, sr, 0, f * (1 + 0.04 * r()), tau, g); scuff(a, sr, r, 0, 3000, 0.002, 0.5); mode(a, sr, 0, 170, 0.05, 0.2); mode(a, sr, toe(r), 1190, 0.04, 0.1); },
      carpet: (a, sr, r) => { thud(a, sr, 0, 75, 0.02, 0.6); burst(a, sr, r, 0, 0.08, u => 0.3 * hump(u, 0.06), bq('lp', 900, 0.7, sr)); burst(a, sr, r, 0, 0.06, u => 0.04 * hump(u, 0.05), bq('hp', 3000, 0.7, sr)); },
    };
    const STEP_DUR = { metal: 0.7, wood: 0.5, water: 0.5 };

    // ---- loops: name: [seconds, fill(a, sr, r, ch, re), {sr, ch, g, ref, xf}] — re replays one event sequence per channel,
    // so a positioned event (a cricket, a crackle) sits in the same place in both channels
    const LO = 16000, MID = 22050, HI = 32000;
    const LOOPS = {
      fire: [10, (a, sr, r, ch, re) => {
        const lp = bq('lp', 380, 0.6, sr), lp2 = bq('lp', 90, 0.7, sr), hs = bq('hp', 2500, 0.7, sr), br = brownish(r);
        noiseTo(a, sr, r, x => lp(x) + lp2(br()) * 4 + hs(x) * 0.05, t => 0.65 + 0.2 * Math.sin(TAU * 0.31 * t + ch) + 0.15 * Math.sin(TAU * 1.7 * t + 2 * ch));
        const dur = a.length / sr;
        for (let k = 0; k < 11 * dur; k++) { const t = re() * dur, s = re(), f = 800 + re() * 4000, g = (0.1 + s * s * s * 1.2) * pg(re() * 2 - 1, ch); scuff(a, sr, r, t, f, 0.0006 + s * 0.0014, g); if (s > 0.9) burst(a, sr, r, t, 0.3, u => 0.08 * ex(u, 0.08), bq('hp', 4000, 0.7, sr)); }
      }, { sr: HI, ch: 2, g: 0.8, ref: 4 }],
      stove: [8, (a, sr, r, ch, re) => {
        noiseTo(a, sr, r, bq('lp', 250, 0.6, sr), t => 0.25 + 0.08 * Math.sin(TAU * 0.4 * t + ch));
        for (let k = 0; k < 40; k++) { const t = re() * 8, s = re(), f = 1200 + re() * 3500; scuff(a, sr, r, t, f, 0.0005 + s * 0.001, (0.15 + s * s * 0.8) * pg(re() * 0.6 - 0.3, ch)); }
      }, { sr: MID, ch: 2, g: 0.6, ref: 3 }],
      engine_idle: [4, (a, sr, r) => {
        const br = brownish(r), lp = bq('lp', 120, 0.7, sr); noiseTo(a, sr, r, () => lp(br()) * 3, () => 1);
        for (let t = 0, k = 0; t < 4.5; k++) { const g = [1, 0.8, 0.9, 0.75][k % 4]; mode(a, sr, t, 55, 0.02, g); mode(a, sr, t, 130, 0.01, g * 0.5); scuff(a, sr, r, t, 300, 0.004, g * 0.6, 0.7); if (k % 2) scuff(a, sr, r, t + 0.01, 4000, 0.0005, 0.1); t += 1 / 27 * (1 + 0.03 * (r() - 0.5)); }
      }, { sr: LO, g: 0.6, ref: 3 }],
      engine_drive: [8, (a, sr, r) => {
        const br = brownish(r), rl = bq('lp', 180, 0.7, sr), mid = bq('bp', 600, 0.8, sr), ty = bq('bp', 1500, 0.5, sr), wl = bq('hp', 800, 0.7, sr);
        noiseTo(a, sr, r, x => rl(br()) * 4 + mid(x) * 0.4 + ty(x) * 0.12 + wl(x) * 0.04, t => 0.9 + 0.1 * Math.sin(TAU * 0.25 * t));
        tone(a, sr, 0, 8.5, t => 74 * (1 + 0.02 * Math.sin(TAU * 0.125 * t)), () => 0.35, 'saw', bq('lp', 400, 0.9, sr));
        fx(a, bq('lp', 2000, 0.7, sr));
      }, { sr: MID, g: 0.7, ref: 3 }],
      rain: [8, (a, sr, r, ch, re) => {
        const hp = bq('hp', 600, 0.7, sr), lp = bq('lp', 9000, 0.7, sr); noiseTo(a, sr, r, x => lp(hp(x)), () => 0.35);
        const dur = a.length / sr;
        for (let k = 0; k < 250 * dur; k++) { const t = re() * dur, f = 2500 + re() * 4500, tau = 0.001 + re() * 0.002; mode(a, sr, t, f, tau, 0.15 * re() * pg(re() * 2 - 1, ch)); }
        for (let k = 0; k < 25 * dur; k++) { const t = re() * dur, f = 1200 + re() * 1800; scuff(a, sr, r, t, f, 0.004, 0.4 * re() * pg(re() * 2 - 1, ch), 1.5); }
      }, { sr: 44100, ch: 2, g: 0.8, ref: 6 }],
      wind: [16, (a, sr, r, ch) => {
        const bp = bq('bp', 400, 0.8, sr), wh = bq('bp', 800, 12, sr), lp = bq('lp', 200, 0.7, sr), ph = ch * 1.7;
        let i = 0, g = 0;
        noiseTo(a, sr, r, x => { if ((i++ & 31) === 0) { const t = i / sr; g = 0.55 + 0.25 * Math.sin(TAU * t / 16 + ph) + 0.15 * Math.sin(TAU * t * 3 / 16 + 2 * ph) + 0.08 * Math.sin(TAU * t * 7 / 16); bp.set(250 + 500 * g); wh.set(700 + 350 * g); } return (bp(x) + wh(x) * 3 * Math.max(0, g - 0.6) + lp(x) * 0.6) * g; }, () => 1);
      }, { sr: MID, ch: 2, g: 0.7, ref: 10 }],
      tv_murmur: [10, (a, sr, r) => {
        for (let t = 0; t < 10.5;) { const d = 2 + r() * 3; babble(a, sr, r, t, d, { f0: r() < 0.6 ? 195 : 118, rate: 4.2, amp: 1, gap: 0.1 }); t += d + 0.2 + r() * 0.5; }
        for (let k = 0; k < 44; k++) tone(a, sr, k * 0.24, 0.2, hz(60 + [0, 3, 7, 10][k % 4]), u => 0.04 * hump(u, 0.2), 'sq');
        speaker(a, sr, 1.1);
      }, { sr: MID, g: 0.5, ref: 3 }],
      radio_dj: [10, (a, sr, r) => {
        for (let t = 0; t < 10.5;) {
          if (r() < 0.35) { const n = 4 + (r() * 5 | 0); for (let k = 0; k < n; k++) { const f = 200 + 30 * r(); call(a, sr, r, t + k * 0.19, 0.14, u => f - 60 * u, [[800, 4, 1], [1250, 5, 0.5]], 0.8, 0.15, 0.01); } t += n * 0.19 + 0.1; }
          else { const d = 1.2 + r() * 2; babble(a, sr, r, t, d, { f0: 135, rate: 5.5, amp: 1, gap: 0.06 }); t += d + 0.08; }
        }
        burst(a, sr, r, 0, 10.5, () => 0.03, bq('bp', 2000, 0.6, sr));
        fx(a, bq('hp', 350, 0.8, sr), bq('lp', 3200, 0.8, sr)); norm(a); fx(a, x => Math.tanh(1.6 * x));
      }, { sr: LO, g: 0.5, ref: 3 }],
      crowd_murmur: [8, (a, sr, r, ch) => { for (let v = 0; v < 8; v++) for (let t = r() * 0.5; t < 8.5;) { const d = 1 + r() * 2.5; babble(a, sr, r, t, d, { f0: 90 + r() * 140, rate: 3.5 + r() * 2, amp: 0.4 + r() * 0.6, gap: 0.12 }); t += d + 0.2 + r() * 0.8; } echo(a, sr, [[0.031 + ch * 0.007, 0.35], [0.067, 0.25], [0.113 + ch * 0.011, 0.15]]); fx(a, bq('lp', 3500, 0.7, sr)); }, { sr: LO, ch: 2, g: 0.6, ref: 8 }],
      fluorescent_hum: [4, (a, sr, r) => {
        for (const [f, g] of [[100, 0.5], [200, 0.25], [300, 0.12], [100.3, 0.2]]) tone(a, sr, 0, 4.5, f, () => g);
        const b = new Float32Array(a.length); tone(b, sr, 0, 4.5, 100, () => 1, 'sq', bq('bp', 4000, 1, sr)); for (let i = 0; i < a.length; i++) a[i] += b[i] * 0.3 * (0.8 + 0.2 * Math.sin(TAU * 0.37 * i / sr));
        tick(a, sr, r, 2.1, 0.15, 1800);
      }, { sr: MID, g: 0.4, ref: 3 }],
      water_lap: [16, (a, sr, r, ch, re) => {
        noiseTo(a, sr, r, bq('lp', 300, 0.7, sr), () => 0.08);
        for (let t = 0; t < 16.5; t += 0.8 + re() * 1.7) { const s = 0.4 + re() * 0.6, g = s * pg(re() * 1.4 - 0.7, ch), b = re() < 0.5; burst(a, sr, r, t, 1.2, u => g * ar(u, 0.12, 0.35), bq('lp', 400 + 800 * s, 0.7, sr)); if (b) bubbles(a, sr, r, t + 0.1, 0.4, 3, 200, 600, 0.12 * g); }
      }, { sr: MID, ch: 2, g: 0.7, ref: 5 }],
      surf: [24, (a, sr, r, ch) => {
        const lp = bq('lp', 600, 0.7, sr), hp = bq('hp', 2000, 0.7, sr); let i = 0;
        noiseTo(a, sr, r, x => { const c = (i++ / sr + ch * 0.4) % 8 / 8; if ((i & 63) === 0) lp.set(300 + 1800 * Math.sin(Math.PI * Math.min(1, c * 1.6)) ** 2); return lp(x) * (0.3 + 0.7 * Math.sin(Math.PI * Math.min(1, c * 1.4)) ** 1.5) + hp(x) * 0.12 * Math.max(0, c - 0.45); }, () => 1);
      }, { sr: MID, ch: 2, g: 0.7, ref: 20 }],
      spillway: [8, (a, sr, r, ch) => { const lp = bq('lp', 1200, 0.6, sr), br = brownish(r), l2 = bq('lp', 150, 0.7, sr); noiseTo(a, sr, r, x => lp(x) + l2(br()) * 3, t => 0.8 + 0.2 * Math.sin(TAU * 0.5 * t + ch)); }, { sr: MID, ch: 2, g: 0.8, ref: 20 }],
      siren_far: [30, (a, sr, r, ch, re) => {
        for (let k = 0; k < 3; k++) { const t0 = k * 10 + re() * 4, d = 8 + re() * 5, p = re() * 2 - 1, per = 2.8 + re(); tone(a, sr, t0, d, u => 600 + 600 * (0.5 - 0.5 * Math.cos(TAU * u / per)), u => pg(p, ch) * hump(u, d) ** 1.5, 'sq', bq('lp', 1400, 0.7, sr)); }
        echo(a, sr, [[0.35 + ch * 0.04, 0.35], [0.8 + ch * 0.07, 0.2]]);
      }, { sr: LO, ch: 2, g: 0.45, ref: 50 }],
      clicks_far: [12, (a, sr, r, ch) => {
        const dur = a.length / sr;
        for (let t = 0; t < dur;) { t += -Math.log(1 - r()) / (150 + 110 * Math.sin(TAU * t / dur * 2 + ch)); const f = 1900 + r() * 1100, g = 0.05 + r() ** 5 * 0.9; mode(a, sr, t, f, 0.002 + r() * 0.004, g); if (g > 0.6) for (let k = 1; k < 4; k++) mode(a, sr, t + k * 0.035, f, 0.003, g * 0.5); }
        echo(a, sr, [[0.043 + ch * 0.006, 0.5], [0.097, 0.4], [0.161 + ch * 0.01, 0.3], [0.263, 0.2]]); fx(a, bq('lp', 2800, 0.7, sr));
      }, { sr: MID, ch: 2, g: 0.6, ref: 60 }],
      cicadas: [12, (a, sr, r, ch, re) => {
        for (let k = 0; k < 6; k++) {
          const bp = bq('bp', 4200 + re() * 1600, 4, sr), w = TAU * (180 + re() * 80) / sr, per = 4 + re() * 4, off = re() * per, g = (0.4 + 0.6 * re()) * pg(re() * 2 - 1, ch);
          let sw = 0;
          for (let i = 0; i < a.length; i++) { if ((i & 63) === 0) { const c = ((i / sr + off) % per) / per; sw = g * Math.sin(Math.PI * Math.min(1, c * 1.3)) ** 2; } const m = 0.5 + 0.5 * Math.sin(w * i); a[i] += bp(r() * 2 - 1) * sw * m * m; }
        }
      }, { sr: HI, ch: 2, g: 0.6, ref: 15 }],
      turbine_hum: [6, (a, sr, r) => {
        for (const [f, g] of [[50, 0.6], [100, 0.5], [150, 0.25], [100.4, 0.2]]) tone(a, sr, 0, 6.5, f, () => g);
        const bp = bq('bp', 800, 1, sr), br = brownish(r), lp = bq('lp', 120, 0.7, sr); let i = 0;
        noiseTo(a, sr, r, x => bp(x) * 0.3 * (0.8 + 0.2 * Math.sin(TAU * 12 * i++ / sr)) + lp(br()) * 2, () => 1);
      }, { sr: LO, g: 0.6, ref: 8 }],
      phone_feed: [10, (a, sr, r) => {
        for (let t = 0; t < 10.5;) {
          const d = 0.3 + r() * 0.9, k = r();
          if (k < 0.45) babble(a, sr, r, t, d, { f0: 100 + r() * 180, rate: 5 + r() * 2, amp: 1, gap: 0.05 });
          else if (k < 0.7) { const root = 60 + (r() * 12 | 0); for (let j = 0; j * 0.1 < d; j++) tone(a, sr, t + j * 0.1, 0.08, hz(root + [0, 4, 7, 12][j % 4]), v => 0.3 * hump(v, 0.08), 'sq'); }
          else if (k < 0.85) for (let u = 0; u < d; u += 0.16) call(a, sr, r, t + u, 0.12, v => 220 - 50 * v, [[800, 4, 1], [1250, 5, 0.5]], 0.6, 0.2, 0.01);
          else mode(a, sr, t, 1568, 0.2, 0.4);
          whoosh(a, sr, r, t + d, 0.12, 1800, 4000, 0.4); t += d + 0.12;
        }
        speaker(a, sr, 1.4);
      }, { sr: MID, g: 0.4, ref: 1.5 }],
      tape_hiss: [6, (a, sr, r) => { noiseTo(a, sr, r, bq('hp', 2500, 0.7, sr), t => 0.3 * (1 + 0.1 * Math.sin(TAU * t / 1.5))); tone(a, sr, 0, 6.5, 50, () => 0.015); }, { g: 0.3, ref: 2 }],
      phone_ring: [3.4, (a, sr) => ringCycle(a, sr), { g: 0.6, ref: 2, xf: 0 }],
      landline_ring: [3, (a, sr) => landline(a, sr), { g: 0.55, ref: 3, xf: 0 }],
      crickets: [8, (a, sr, r, ch, re) => {
        for (let k = 0; k < 6; k++) { const f = 4200 + re() * 700, per = 0.45 + re() * 0.4, g = (0.3 + 0.7 * re()) * pg(re() * 2 - 1, ch), n = 3 + (re() * 2 | 0); for (let t = re() * per; t < 8.5; t += per * (0.9 + 0.2 * re())) for (let p = 0; p < n; p++) tone(a, sr, t + p * 0.034, 0.02, f, u => g * hump(u, 0.02)); }
      }, { sr: HI, ch: 2, g: 0.45, ref: 10 }],
      traffic_far: [16, (a, sr, r, ch) => { const br = brownish(r), lp = bq('lp', 250, 0.7, sr), lp2 = bq('lp', 600, 0.7, sr); noiseTo(a, sr, r, x => lp(br()) * 4 + lp2(x) * 0.2, t => 0.6 + 0.25 * Math.sin(TAU * t / 8 + ch) + 0.15 * Math.sin(TAU * t * 5 / 16)); }, { sr: LO, ch: 2, g: 0.5, ref: 100 }],
      fridge_hum: [6, (a, sr, r) => { for (const [f, g] of [[50, 0.5], [100, 0.6], [100.3, 0.3], [150, 0.25], [300, 0.1], [480, 0.03]]) tone(a, sr, 0, 6.5, f, () => g); noiseTo(a, sr, r, bq('lp', 200, 0.7, sr), () => 0.2); }, { sr: LO, g: 0.4, ref: 3 }],
      clock_tick: [2, (a, sr, r) => { tick(a, sr, r, 0.01, 1, 3200); mode(a, sr, 0.01, 5100, 0.006, 0.3); tick(a, sr, r, 1.01, 0.75, 2600); mode(a, sr, 1.01, 800, 0.01, 0.2); }, { sr: HI, g: 0.25, ref: 2, xf: 0 }],
      room_tone: [8, (a, sr, r, ch) => { const br = brownish(r), lp = bq('lp', 350, 0.7, sr); noiseTo(a, sr, r, x => lp(x) + br() * 0.5, () => 1); tone(a, sr, 0, 8.5, 50 + ch * 0.1, () => 0.01); }, { sr: LO, ch: 2, g: 0.35, ref: 5 }],
      birds_dawn: [14, (a, sr, r, ch, re) => {
        for (let k = 0; k < 30; k++) { const t = re() * 14, g = (0.2 + 0.8 * re() * re()) * pg(re() * 2 - 1, ch), f0 = 2500 + re() * 3000, n = 2 + (re() * 7 | 0), short = re() < 0.5, d = short ? 0.035 : 0.12, s = short ? 0.3 : -0.25; for (let j = 0; j < n; j++) tone(a, sr, t + j * (d + 0.03), d, u => f0 * (1 + s * u / d + 0.05 * Math.sin(TAU * 60 * u)), u => g * hump(u, d)); }
      }, { sr: HI, ch: 2, g: 0.45, ref: 15 }],
      drips: [10, (a, sr, r, ch, re) => { for (let k = 0; k < 30; k++) { const t = re() * 10, f0 = 900 + re() * 1300, g = (0.2 + 0.8 * re()) * pg(re() * 2 - 1, ch), f1 = 300 + re() * 150; tone(a, sr, t, 0.05, u => f0 * (1 + 0.7 * u / 0.015), u => g * ar(u, 0.001, 0.012)); mode(a, sr, t, f1, 0.02, g * 0.3); } echo(a, sr, [[0.07 + ch * 0.01, 0.3], [0.19, 0.15]]); }, { sr: MID, ch: 2, g: 0.4, ref: 6 }],
      flies: [12, (a, sr, r, ch) => { for (let k = 0; k < 2; k++) { const f = 190 + k * 35, ph = k * 2 + ch * 1.3; tone(a, sr, 0, 12.5, t => f * (1 + 0.06 * Math.sin(TAU * 0.7 * t + ph) + 0.03 * (r() - 0.5)), t => (0.5 + 0.5 * Math.sin(TAU * t / 6 + ph)) ** 3, 'saw', bq('bp', 900, 0.7, sr)); } }, { sr: LO, ch: 2, g: 0.3, ref: 3 }],
    };

    // reverb spaces: [seconds, return level, pre-delay, hi Hz, lo Hz (the tail darkens from hi to lo), discrete slaps [delay, gain]]
    const SPACES = {
      outdoor: [1.6, 0.5, 0.02, 5000, 800, [[0.09, 0.5], [0.17, 0.35], [0.31, 0.25], [0.48, 0.15]]],
      car: [0.25, 0.35, 0.002, 6000, 2000], room: [0.6, 0.7, 0.005, 8000, 2000], interior: [1.1, 0.85, 0.01, 7000, 1500],
      hall: [2.8, 1.1, 0.025, 7000, 1200], tunnel: [3.8, 1.4, 0.02, 4500, 700, [[0.11, 0.3], [0.23, 0.2], [0.35, 0.12]]], music: [4.8, 0, 0.025, 9000, 1800],
    };
    function impulse(a, sr, r, s) {
      const [sec, , pre, hi, lo, slaps] = s, n0 = at(sr, pre);
      let k = 0, y = 0;
      for (let i = n0; i < a.length; i++) {
        const t = (i - n0) / sr;
        if ((i & 31) === 0) k = 1 - Math.exp(-TAU * hi * Math.pow(lo / hi, Math.min(1, t / sec)) / sr);
        y += k * ((r() * 2 - 1) - y);
        a[i] = y * Math.exp(-6.9 * t / sec) * Math.min(1, t / 0.004) * (slaps ? 0.35 : 1);
      }
      for (let e = 0; e < 8; e++) a[n0 + at(sr, r() * 0.05)] += (r() - 0.5) * 0.8;
      if (slaps) for (const [d, g] of slaps) burst(a, sr, r, d, 0.03, u => g * ex(u, 0.006), bq('lp', lo * 2, 0.7, sr));
    }

    // make: fill channels, crossfade the loop seam (loops) or fade the tail (one-shots), then level: one-shots by their loudest
    // 50 ms (RMS 0.25), loops by RMS, notes by peak, never above 0.95; impulse responses to unit energy (convolvers don't normalise)
    function make(key, sec, fill, o = {}) {
      const sr = o.sr || SR, ch = o.ch || 1, n = Math.max(1, Math.round(sec * sr)), xf = o.xf ? at(sr, o.xf) : 0, seed = hash(key), chs = [];
      for (let c = 0; c < ch; c++) {
        const a = new Float32Array(n + xf);
        fill(a, sr, rng(seed + 7919 * (c + 1)), c, rng(seed));
        if (!o.energy) { const dc = lp1(12, sr); for (let i = 0; i < a.length; i++) a[i] -= dc(a[i]); }
        for (let i = 0; i < xf; i++) { const th = i / xf * Math.PI / 2; a[i] = a[i] * Math.sin(th) + a[n + i] * Math.cos(th); }
        if (!o.rms && !o.energy) fade(a, sr, Math.min(0.03, sec * 0.1));
        chs.push(a);
      }
      let pk = 0, e = 0, wmax = 0;
      const W = Math.max(1, at(sr, 0.05));
      for (const a of chs) { let w = 0; for (let i = 0; i < n; i++) { const v = a[i]; pk = Math.max(pk, Math.abs(v)); e += v * v; w += v * v; if (i >= W) w -= a[i - W] * a[i - W]; wmax = Math.max(wmax, w / W); } }
      let k = o.energy ? 1 / Math.sqrt(e / ch) : o.peak ? o.peak / pk : o.rms ? o.rms / Math.sqrt(e / (n * ch)) : 0.25 / Math.sqrt(wmax);
      if (!o.energy) k = Math.min(k, 0.95 / pk);
      if (!Number.isFinite(k)) k = 0;
      return { sr, chs: chs.map(a => { const out = new Float32Array(n); for (let i = 0; i < n; i++) out[i] = a[i] * k; return out; }) };
    }
    // keys: sfx:name:variant · step:surface:variant · loop:name · ks:midi:brightness · pn:midi:velocity · ph:midi:ms · ir:space · noise
    function synth(key, sr) {
      SR = sr;
      const [kind, name, x] = key.split(':'), m = +name;
      if (kind === 'sfx') { const [d, , f, o] = SFX[name]; return make(key, d, (a, sr, r) => f(a, sr, r, +x), { peak: o.peak }); }
      if (kind === 'step') return make(key, STEP_DUR[name] || 0.3, (a, sr, r) => STEPS[name](a, sr, r));
      if (kind === 'loop') { const [d, f, o] = LOOPS[name]; return make(key, d, f, { sr: o.sr, ch: o.ch, xf: o.xf ?? 0.5, rms: 0.12 }); }
      if (kind === 'ks') return make(key, ksDur(m), (a, sr, r) => guitarNote(a, sr, r, m, +x), { peak: 0.9 });
      if (kind === 'pn') return make(key, pnDur(m), (a, sr, r) => pianoNote(a, sr, r, m, +x), { peak: 0.9 });
      if (kind === 'ph') return make(key, +x / 1000 + 0.15, (a, sr) => phoneNote(a, sr, m, +x / 1000), { peak: 0.9 });
      if (kind === 'ir') return make(key, SPACES[name][0] + SPACES[name][2] + 0.1, (a, sr, r) => impulse(a, sr, r, SPACES[name]), { ch: 2, energy: true });
      return make(key, 2, (a, sr, r) => { for (let i = 0; i < a.length; i++) a[i] = r() * 2 - 1; }, { xf: 0.05, rms: 0.3 });
    }
    return { SFX, STEPS, LOOPS, SPACES, MOTIF, midi, hz, synth };
  }
  const K = kit(), { SFX, STEPS, LOOPS, SPACES, MOTIF, midi, hz } = K;
  const SURF = { asphalt: 'concrete', road: 'concrete', sand: 'dirt', mud: 'dirt', leaves: 'grass', ice: 'snow' };

  // ---- ambience beds: sp = reverb space of positional sfx, hush = level kept under silence(), l: [loop, vol, lowpass Hz],
  //      e: [sfx, [min, max] seconds apart, vol, [near, far] metres, keep under silence]
  const AMB = {
    store_night: { sp: 'room', l: [['fluorescent_hum', 0.35], ['room_tone', 0.4], ['crowd_murmur', 0.4, 1100]], e: [['notif_chime', [6, 15], 0.3, [5, 14]], ['car_pass', [18, 40], 0.4, [40, 80]], ['gull', [35, 80], 0.25, [40, 90]]] },
    suburb_night: { sp: 'outdoor', l: [['crickets', 0.5], ['traffic_far', 0.35], ['wind', 0.12]], e: [['dog_bark', [12, 30], 0.6, [50, 120]], ['car_pass', [15, 35], 0.45, [30, 90]], ['mopoke', [18, 45], 0.4, [30, 70]]] },
    house_night: { sp: 'room', l: [['fridge_hum', 0.3], ['clock_tick', 0.3], ['room_tone', 0.35], ['crickets', 0.2, 1400]], e: [['creak', [25, 50], 0.3, [3, 8]], ['dog_bark', [30, 70], 0.35, [80, 150]], ['car_pass', [30, 60], 0.25, [40, 90]]] },
    car_interior: { sp: 'car', l: [['engine_drive', 0.7]], e: [['creak', [15, 35], 0.12, [0.5, 1.5]]] },
    fire_street: { sp: 'outdoor', l: [['fire', 0.6], ['siren_far', 0.4], ['wind', 0.15]], e: [['scream_far', [6, 15], 0.5, [30, 90]], ['car_alarm', [15, 30], 0.35, [40, 80]], ['explosion', [40, 80], 0.45, [150, 300]], ['glass_break', [15, 35], 0.3, [25, 60]], ['dog_bark', [20, 40], 0.4, [60, 120]]] },
    bridge_night: { sp: 'outdoor', hush: 0.85, l: [['water_lap', 0.55], ['wind', 0.3], ['siren_far', 0.3], ['clicks_far', 0.3]], e: [] },
    title_dawn: { sp: 'interior', l: [['birds_dawn', 0.4], ['wind', 0.2, 2000], ['room_tone', 0.15]], e: [['click', [25, 50], 0.5, [60, 120]], ['magpie', [15, 35], 0.4, [20, 60]], ['kookaburra', [40, 90], 0.35, [60, 150]], ['creak', [20, 40], 0.15, [3, 6]]] },
    qz_rain: { sp: 'outdoor', hush: 0.6, l: [['rain', 0.7], ['drips', 0.3], ['wind', 0.2]], e: [['thunder', [25, 60], 0.55, [800, 2000], true]] },
    warehouse: { sp: 'hall', l: [['room_tone', 0.35], ['wind', 0.25, 800], ['drips', 0.25]], e: [['metal_creak', [12, 30], 0.35, [10, 30]], ['pigeons', [25, 50], 0.35, [8, 20]], ['drip', [6, 14], 0.3, [4, 15]]] },
    tunnel: { sp: 'tunnel', l: [['drips', 0.45], ['water_lap', 0.2, 900], ['room_tone', 0.3]], e: [['click', [15, 35], 0.4, [30, 60]], ['metal_creak', [30, 60], 0.3, [20, 40]]] },
    tower: { sp: 'interior', l: [['wind', 0.5], ['room_tone', 0.2], ['drips', 0.15], ['fluorescent_hum', 0.1, 3000]], e: [['metal_creak', [10, 25], 0.35, [8, 25]], ['click', [20, 40], 0.35, [20, 50]]] },
    mall_dawn: { sp: 'hall', l: [['birds_dawn', 0.3], ['wind', 0.2, 1500], ['drips', 0.15]], e: [['magpie', [20, 45], 0.35, [15, 40]], ['pigeons', [20, 50], 0.3, [10, 25]], ['drip', [8, 18], 0.25, [5, 20]]] },
    outback_day: { sp: 'outdoor', l: [['cicadas', 0.55], ['wind', 0.2], ['flies', 0.12]], e: [['crow', [15, 40], 0.45, [30, 100]]] },
    interior: { sp: 'interior', l: [['room_tone', 0.45], ['fridge_hum', 0.1, 400]], e: [] },
    office: { sp: 'interior', l: [['fluorescent_hum', 0.3], ['room_tone', 0.35], ['wind', 0.1, 1200]], e: [['click', [25, 50], 0.3, [30, 60]], ['creak', [30, 60], 0.2, [5, 15]]] },
    dam: { sp: 'outdoor', l: [['spillway', 0.5], ['turbine_hum', 0.25, 600], ['wind', 0.2]], e: [['crow', [30, 60], 0.35, [40, 120]], ['bird', [10, 25], 0.3, [10, 40]]] },
    forest_autumn: { sp: 'outdoor', l: [['wind', 0.3], ['birds_dawn', 0.2], ['water_lap', 0.12, 1500]], e: [['crow', [25, 60], 0.35, [40, 120]], ['bird', [8, 20], 0.3, [10, 40]], ['creak', [30, 60], 0.2, [10, 25]]] },
    snow_wind: { sp: 'outdoor', l: [['wind', 0.6]], e: [['crow', [30, 70], 0.3, [60, 150]], ['creak', [25, 50], 0.2, [10, 25]]] },
    blizzard: { sp: 'outdoor', hush: 0.7, l: [['wind', 0.6], ['wind', 0.3, 600]], e: [] },
    cliff_wind: { sp: 'outdoor', l: [['wind', 0.4], ['surf', 0.35]], e: [['gull', [10, 25], 0.4, [20, 60]], ['whale', [30, 60], 0.35, [80, 200]]] },
    underpass: { sp: 'tunnel', l: [['water_lap', 0.4], ['drips', 0.35], ['room_tone', 0.3]], e: [['click', [12, 30], 0.4, [20, 50]], ['metal_creak', [20, 40], 0.3, [15, 30]]] },
    exchange: { sp: 'hall', l: [['room_tone', 0.4], ['crowd_murmur', 0.1, 700], ['fluorescent_hum', 0.2]], e: [['radio_static', [15, 30], 0.2, [10, 25]], ['typing_tap', [8, 20], 0.15, [5, 12]]] },
    lab: { sp: 'room', l: [['fluorescent_hum', 0.3], ['fridge_hum', 0.3], ['room_tone', 0.3]], e: [['creak', [30, 60], 0.15, [5, 12]]] },
    hut: { sp: 'room', l: [['stove', 0.45], ['wind', 0.35, 900]], e: [['creak', [15, 35], 0.25, [2, 5]]] },
    suburb_day: { sp: 'outdoor', l: [['cicadas', 0.3], ['birds_dawn', 0.25], ['wind', 0.12]], e: [['dog_bark', [20, 45], 0.35, [60, 140]], ['crow', [25, 50], 0.35, [40, 100]], ['magpie', [20, 40], 0.35, [20, 60]]] },
    roof_night: { sp: 'outdoor', hush: 0.8, l: [['wind', 0.5], ['traffic_far', 0.1]], e: [] },
  };

  // ---- the score --------------------------------------------------------------------------------------------------------
  // D minor, 72 bpm. Phrase A: A3 D4 E4 F4 (hold) E4 D4 C4 A3 (hold); phrase B: F4 G4 A4 (hold) G4 F4 E4 D4 (two bars).
  const BEAT = 60 / 72;
  const PA = [['A3', 1], ['D4', 1], ['E4', 1], ['F4', 3, 'D3 A3'], ['E4', 1], ['D4', 1], ['C4', 1], ['A3', 4, 'A2 E3']];
  const PB = [['F4', 1], ['G4', 1], ['A4', 3, 'F3 C4'], ['G4', 1], ['F4', 1], ['E4', 1], ['D4', 8, 'D3 A3']];
  const MOTIF_C = [['F4', 1], ['G4', 1], ['A4', 3, 'C4 F4'], ['G4', 3]];
  const CA = [['D2 A2 D3 F3', 3], ['Bb1 F2 D3 F3', 3], ['C2 G2 C3 E3', 3], ['A1 E2 A2 C#3', 4]];
  const CB = [['F2 C3 F3 A3', 2], ['F2 C3 F3 A3', 3], ['C2 G2 C3 E3', 2], ['A1 E2 A2 C#3', 1], ['D2 A2 D3 F3', 8]];
  const nt = (t, key, v, p = 0) => ({ t, key, v, p });
  // melody plucks with slight timing drift, tempo breath, a lean into the last note and a soft strum under held notes
  function guitar(ev, t, notes, o = {}) {
    const sh = 12 * (o.oct || 0), b = o.b ?? 1, vel = o.v ?? 0.8, rub = o.rub ?? 0.035, drift = o.drift ?? 0.025;
    notes.forEach(([n, beats, chord], i) => {
      const jt = t + rnd(-drift, drift), v = vel * rnd(0.86, 1);
      if (chord) chord.split(' ').forEach((c, k, cs) => ev.push(nt(jt - 0.05 * (cs.length - k), `ks:${midi(c) + sh}:${Math.max(0, b - 1)}`, v * 0.33)));
      ev.push(nt(jt, `ks:${midi(n) + sh}:${b}`, v));
      t += beats * BEAT * (1 + rnd(-rub, rub)) * (i === notes.length - 2 ? 1 + rub * 2 : 1);
    });
    return t;
  }
  function arp(ev, t, chords) {                                                // the soft second guitar: broken chords in eighths
    const pat = [0, 2, 3, 1, 2, 3, 1, 2];
    for (const [ch, beats] of chords) { const ns = ch.split(' ').map(midi); for (let k = 0; k < beats * 2; k++) ev.push(nt(t + k * BEAT / 2 + rnd(-0.012, 0.012), `ks:${ns[pat[k % 8]]}:0`, k % 2 ? 0.16 : 0.24, 0.35)); t += beats * BEAT; }
    return t;
  }
  function piano(ev, t, notes, chords, v = 1) {                                // right hand an octave up, left hand broken chords
    const PBT = BEAT * 1.08;
    let tr = t; for (const [n, beats] of notes) { ev.push(nt(tr + rnd(-0.01, 0.01), `pn:${midi(n) + 12}:1`, 0.7 * v * rnd(0.85, 1))); tr += beats * PBT; }
    let tl = t; for (const [ch, beats] of chords) { const ns = ch.split(' ').map(midi); for (let k = 0; k < beats; k++) if (k < 4 || k % 2 === 0) ev.push(nt(tl + k * PBT + rnd(0, 0.02), `pn:${ns[[0, 1, 2, 3, 2, 1, 2, 3][k % 8]]}:0`, (k ? 0.17 : 0.27) * v)); tl += beats * PBT; }
    return Math.max(tr, tl);
  }
  const dr = (t, m, d, v, a) => ({ t, dr: true, m: midi(m), d, v, a });
  const fin = ev => { ev.sort((x, y) => x.t - y.t); const t0 = Math.min(0, ev[0].t); for (const e of ev) e.t -= t0; const l = ev[ev.length - 1]; ev.end = l.t + (l.d || 0) + 7; return ev; };
  const CUES = {
    theme_a: () => { const ev = []; guitar(ev, 0.2, PA); return fin(ev); },
    theme_b: () => { const ev = []; guitar(ev, 0.2, PB); return fin(ev); },
    theme: () => { const ev = []; guitar(ev, guitar(ev, 0.2, PA) + BEAT * 1.5, PB); return fin(ev); },
    title: () => {
      const ev = []; let t = guitar(ev, 0.4, PA, { v: 0.72 });
      t = guitar(ev, t + BEAT, PB, { v: 0.78 }) + BEAT * 1.5;
      ev.push(nt(t - 0.03, 'ks:38:0', 0.4));
      t = guitar(ev, t, PA, { v: 0.8 });
      guitar(ev, t + BEAT, PB, { v: 0.7 });
      return fin(ev);
    },
    chloe_motif: () => { const ev = []; guitar(ev, 0.2, MOTIF_C, { oct: 1, b: 2, v: 0.8 }); return fin(ev); },
    bub_motif: () => Object.assign(fin(MOTIF.map((m, k) => nt(0.2 + k * 0.34, `ph:${m}:${k === 4 ? 1100 : 300}`, 0.2))), { dry: true }),
    wai: () => { const ev = [dr(0, 'D2', 28, 0.05, 4), dr(1.5, 'A2', 25, 0.025, 5)]; guitar(ev, 6.5, PA, { v: 0.75 }); return fin(ev); },
    film_night: () => {
      const ev = [], o = { b: 0, v: 0.7, rub: 0, drift: 0.015 }; let t = 0.3;
      for (let k = 0; k < 2; k++) { arp(ev, t, CA); t = guitar(ev, t, PA, o); arp(ev, t, CB); t = guitar(ev, t, PB, o); }
      return fin(ev);
    },
    whales: () => { const ev = [dr(0, 'D2', 36, 0.045, 6), dr(2, 'A2', 33, 0.025, 6)]; guitar(ev, guitar(ev, 3, MOTIF_C, { oct: 1, b: 2, v: 0.68 }) + BEAT, PB, { oct: 1, b: 2, v: 0.75 }); return fin(ev); },
    choice_drone: () => fin([dr(0, 'D2', 600, 0.05, 180), dr(30, 'A2', 570, 0.025, 150), dr(60, 'D3', 540, 0.012, 120)]),
    piano_theme: () => {
      const ev = []; let t = piano(ev, 0.3, [], [['D2 A2 D3 F3', 4]]);
      t = piano(ev, t, PA, CA); t = piano(ev, t, PB, CB); t = piano(ev, t, PA, CA, 0.85); t = piano(ev, t, PB, CB, 0.8);
      ['D2', 'A2', 'D3', 'F3', 'A3', 'D4', 'D6'].forEach((n, k) => ev.push(nt(t + k * 0.06, `pn:${midi(n)}:0`, k === 6 ? 0.25 : 0.3)));
      return fin(ev);
    },
  };
  function playEv(c, out, e, when) {
    if (e.dr) return drone(c, out, when, e.m, e.d, e.v, e.a);
    const s = c.createBufferSource(), g = c.createGain(); s.buffer = buf(e.key); g.gain.value = e.v; s.connect(g);
    let tail = g; if (e.p) { tail = c.createStereoPanner(); tail.pan.value = e.p; g.connect(tail); }
    tail.connect(out); s.start(when);
    s.onended = () => { s.disconnect(); g.disconnect(); tail.disconnect(); };
    return { stop: w => s.stop(w) };
  }
  // the score's long hall: dry path plus a generated 4.8 s impulse, its send high-passed so the tail never turns to mud
  function hall(c, dest) {
    const i = c.createGain(), d = c.createGain(), w = c.createGain(), hp = c.createBiquadFilter(), cv = c.createConvolver();
    cv.normalize = false; cv.buffer = buf('ir:music'); d.gain.value = 0.8; w.gain.value = 0.65; hp.type = 'highpass'; hp.frequency.value = 160;
    i.connect(d); d.connect(dest); i.connect(w); w.connect(hp); hp.connect(cv); cv.connect(dest);
    return i;
  }
  // tension: a low pulsing drone, scraped strings (noise through tight resonators, bowed with irregular pressure) and a
  // sul ponticello tremolo cluster that only enters near full alert
  function tensionGraph(c, out) {
    const all = [], srcs = [], mk = n => (all.push(n), n);
    const gain = v => { const x = mk(c.createGain()); x.gain.value = v; return x; };
    const filt = (type, f, q) => { const b = mk(c.createBiquadFilter()); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
    const os = (type, f) => { const o = mk(c.createOscillator()); o.type = type; o.frequency.value = f; srcs.push(o); return o; };
    const g = gain(0), lp = filt('lowpass', 160, 2), throb = gain(0.25), dg = gain(0.9), lfo = os('sine', 0.9), sh = mk(c.createWaveShaper());
    g.connect(out); os('sawtooth', 36.71).connect(lp); os('sawtooth', 55.1).connect(lp); lp.connect(throb); throb.connect(dg); dg.connect(g);
    sh.curve = Float32Array.from({ length: 257 }, (_, i) => Math.max(0, (i - 128) / 128) ** 3); lfo.connect(sh); sh.connect(throb.gain);
    const nz = mk(c.createBufferSource()); nz.buffer = buf('noise'); nz.loop = true; srcs.push(nz);
    const scrape = gain(0), sg = gain(12), shp = filt('highpass', 200, 0.7);
    for (const f of [293.7, 311.1, 440, 466.2, 622.3]) { const b = filt('bandpass', f, 60); nz.connect(b); b.connect(sg); }
    sg.connect(scrape); scrape.connect(shp); shp.connect(g);
    const pont = gain(0), trem = gain(0.5), tl = os('sine', 7.3), tg = gain(0.5), pb = filt('bandpass', 2600, 1.2);
    tl.connect(tg); tg.connect(trem.gain); os('sawtooth', 587.3).connect(pb); os('sawtooth', 622.3).connect(pb); pb.connect(trem); trem.connect(pont); pont.connect(g);
    for (const s of srcs) s.start();
    return { g, lfo, scrape, pont, stop() { for (const s of srcs) s.stop(); for (const n of all) n.disconnect(); } };
  }

  // cello-like drone (live nodes): two detuned saws with delayed vibrato, body resonance, bow noise
  function drone(c, out, when, m, dur, vol, att) {
    const f = hz(m), nodes = [], mk = n => (nodes.push(n), n);
    const g = mk(c.createGain()), lp = mk(c.createBiquadFilter()), body = mk(c.createBiquadFilter()), vib = mk(c.createOscillator()), vg = mk(c.createGain());
    lp.frequency.value = Math.min(1500, f * 10); lp.Q.value = 0.9;
    body.type = 'peaking'; body.frequency.value = 260; body.Q.value = 1.1; body.gain.value = 5;
    vib.frequency.value = rnd(4.4, 5.2); vg.gain.setValueAtTime(0, when); vg.gain.linearRampToValueAtTime(f * 0.005, when + att + 2);
    vib.connect(vg);
    const srcs = [vib, ...[-5, 4].map(ct => { const o = mk(c.createOscillator()); o.type = 'sawtooth'; o.frequency.value = f * Math.pow(2, ct / 1200); vg.connect(o.frequency); o.connect(lp); return o; })];
    const bow = mk(c.createBufferSource()), bb = mk(c.createBiquadFilter()), bg = mk(c.createGain());
    bow.buffer = buf('noise'); bow.loop = true; bb.type = 'bandpass'; bb.frequency.value = 1700; bb.Q.value = 0.8; bg.gain.value = 0.05;
    bow.connect(bb); bb.connect(bg); bg.connect(g); srcs.push(bow);
    const sw = mk(c.createOscillator()), swg = mk(c.createGain()), mod = mk(c.createGain());
    sw.frequency.value = rnd(0.08, 0.15); swg.gain.value = 0.15; sw.connect(swg); swg.connect(mod.gain); srcs.push(sw);
    lp.connect(body); body.connect(g); g.connect(mod); mod.connect(out);
    const rel = Math.min(4, dur * 0.3);
    g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(vol, when + att); g.gain.setValueAtTime(vol, when + dur - rel); g.gain.linearRampToValueAtTime(0, when + dur);
    for (const s of srcs) { s.start(when); s.stop(when + dur + 0.05); }
    srcs[1].onended = () => { for (const n of nodes) n.disconnect(); };
    return { stop: w => { for (const s of srcs) s.stop(w); } };
  }

  // ---- buffer cache and synthesis jobs -------------------------------------------------------------------------------------
  // Buffers are synthesised by a Web Worker running kit()'s own source (the main thread never stalls), two jobs in flight,
  // wanted keys first, then the idle prefetch list; without a worker they are made here within a small per-frame budget.
  // A sound needed right now that no worker has made yet is made on the spot.
  const toBuf = o => { const b = new AudioBuffer({ length: o.chs[0].length, numberOfChannels: o.chs.length, sampleRate: o.sr }); o.chs.forEach((a, c) => b.copyToChannel(a, c)); return b; };
  function buf(key) { let b = cache.get(key); if (!b) { b = toBuf(K.synth(key, SR)); cache.set(key, b); } return b; }
  function want(key, urgent) {
    if (cache.has(key) || busy.has(key)) return;
    const i = jobs.indexOf(key);
    if (i >= 0) { if (!urgent) return; jobs.splice(i, 1); }
    if (urgent) jobs.unshift(key); else jobs.push(key);
  }
  function pump() {
    if (worker) {
      while (busy.size < 2 && (jobs.length || idle.length)) { const k = jobs.length ? jobs.shift() : idle.shift(); if (!cache.has(k) && !busy.has(k)) { busy.add(k); worker.postMessage(k); } }
      return;
    }
    const t0 = performance.now();
    while ((jobs.length || idle.length) && performance.now() - t0 < (jobs.length ? 6 : 2)) buf(jobs.length ? jobs.shift() : idle.shift());
  }
  function startWorker() {
    try {
      const src = `const K = (${kit})(); onmessage = e => { const o = K.synth(e.data, ${SR}); postMessage([e.data, o], o.chs.map(a => a.buffer)); };`;
      worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    } catch (e) { worker = null; return; }
    worker.onmessage = e => { const [k, o] = e.data; busy.delete(k); if (!cache.has(k)) cache.set(k, toBuf(o)); pump(); };
    worker.onerror = e => { e.preventDefault(); worker.terminate(); worker = null; jobs.unshift(...busy); busy.clear(); };
  }
  // drop cached loops or notes that nothing plays or waits for any more (a bed's loops run to megabytes)
  function evict(re, keys) {
    const keep = new Set(keys), playing = new Set([...voices].map(v => v.s.buffer));
    for (const [k, b] of cache) if (re.test(k) && !keep.has(k) && !playing.has(b)) cache.delete(k);
  }
  // a random variant of a one-shot: prefer one already made (and queue the one picked), else make it now
  function variant(kind, name, n) {
    const i = Math.random() * n | 0;
    for (let j = 0; j < n; j++) { const b = cache.get(`${kind}:${name}:${(i + j) % n}`); if (b) { if (j) want(`${kind}:${name}:${i}`); return b; } }
    return buf(`${kind}:${name}:${i}`);
  }

  // ---- live graph ------------------------------------------------------------------------------------------------------------
  //   voices → sfx ──────────────────┐
  //   bed → amb → ambDuck → ambSil ──┴→ world (pause) ┐
  //   cue/tension → musicIn (hall) → music → musicDuck → musicPause ┴→ pre → muffle → master → limiter → out
  //   ui → master (never paused or muffled) · positional sends → envIn → env convolver → envOut → sfx
  function ramp(p, v, sec) { const t = ctx.currentTime; if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(t); else { p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); } p.linearRampToValueAtTime(v, t + Math.max(0.005, sec)); }
  function buildBuses() {
    const g = (v = 1) => { const n = ctx.createGain(); n.gain.value = v; return n; };
    B = { master: g(), pre: g(), world: g(), sfx: g(), amb: g(), ambDuck: g(), ambSil: g(), music: g(), musicDuck: g(), musicPause: g(), ui: g(), envIn: g(), envOut: g(0), muffle: ctx.createBiquadFilter(), limit: ctx.createDynamicsCompressor(), conv: ctx.createConvolver() };
    B.muffle.frequency.value = 20000; B.muffle.Q.value = 0.8; B.conv.normalize = false;
    B.limit.threshold.value = -4; B.limit.knee.value = 4; B.limit.ratio.value = 16; B.limit.attack.value = 0.003; B.limit.release.value = 0.2;
    B.musicIn = hall(ctx, B.music);
    B.sfx.connect(B.world); B.amb.connect(B.ambDuck); B.ambDuck.connect(B.ambSil); B.ambSil.connect(B.world); B.world.connect(B.pre);
    B.music.connect(B.musicDuck); B.musicDuck.connect(B.musicPause); B.musicPause.connect(B.pre);
    B.pre.connect(B.muffle); B.muffle.connect(B.master); B.ui.connect(B.master); B.master.connect(B.limit); B.limit.connect(ctx.destination);
    B.envIn.connect(B.conv); B.conv.connect(B.envOut); B.envOut.connect(B.sfx);
  }
  function setVolumes() { if (!ctx) return; const v = SETTINGS.vol; ramp(B.master.gain, v.master, 0.05); ramp(B.music.gain, v.music, 0.05); ramp(B.sfx.gain, v.sfx, 0.05); ramp(B.ui.gain, v.sfx, 0.05); ramp(B.amb.gain, v.amb, 0.05); }
  // positional voices: HRTF panner + inverse distance, air absorption low-pass and a wetter send the further away
  function place(v, p) {
    v.pos.copy(p); const pn = v.pn;
    if (pn.positionX) { pn.positionX.value = p.x; pn.positionY.value = p.y; pn.positionZ.value = p.z; } else pn.setPosition(p.x, p.y, p.z);
    distance(v, true);
  }
  function distance(v, force) {
    const d = v.pos.distanceTo(L.p);
    if (!force && Math.abs(d - v.d) < 0.5) return;
    v.d = d; v.lp.frequency.value = Math.min(v.lpMax, 20000 / (1 + d / 45));
    if (v.sg) v.sg.gain.value = v.send * Math.min(3, 1 + d / 25);
  }
  function play(b, o) {
    const s = ctx.createBufferSource(), g = ctx.createGain(), now = ctx.currentTime;
    s.buffer = b; s.loop = !!o.loop; s.playbackRate.value = o.rate || 1;
    if (o.fade) { g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(o.vol, now + o.fade); } else g.gain.value = o.vol;
    const v = { s, g, one: !o.loop, send: o.send || 0, lpMax: o.lpMax || 20000, d: 0, nodes: [s, g] };
    s.connect(g);
    let tail = g;
    if (o.pos || o.lpMax) { v.lp = ctx.createBiquadFilter(); v.lp.frequency.value = v.lpMax; v.nodes.push(v.lp); g.connect(v.lp); tail = v.lp; }
    if (o.pos) {
      const p = v.pn = ctx.createPanner(); v.nodes.push(p); v.pos = new THREE.Vector3();
      p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = o.ref || 3; p.maxDistance = 5000; p.rolloffFactor = 1;
      tail.connect(p); tail = p;
    }
    tail.connect(o.bus);
    if (v.send) { v.sg = ctx.createGain(); v.sg.gain.value = v.send; v.nodes.push(v.sg); tail.connect(v.sg); v.sg.connect(B.envIn); }
    if (o.pos) place(v, o.pos);
    s.onended = () => { for (const n of v.nodes) n.disconnect(); voices.delete(v); };
    s.start(now, o.offset || 0);
    voices.add(v);
    if (v.one && voices.size > 48) for (const w of voices) if (w.one && !w.dead) { stopVoice(w, 0.03); break; }
    return v;
  }
  function stopVoice(v, f) { if (v.dead) return; v.dead = true; ramp(v.g.gain, 0, f); v.s.stop(ctx.currentTime + f + 0.02); }
  const posOf = p => p && (p.isVector3 ? p : U.v3(p));

  function sfx(name, o = {}) {
    if (!ctx || !SFX[name]) return H;
    const pos = posOf(o.pos);
    if (SFX[name][3].far && pos && pos.distanceTo(L.p) > 70) name = SFX[name][3].far;
    if (name === 'whisper' && whisperTTS(pos, o.vol ?? 1)) return H;
    const [, n, , op] = SFX[name], ui = op.bus === 'ui';
    const v = play(variant('sfx', name, n), { bus: ui ? B.ui : B.sfx, vol: (op.g ?? 1) * (o.vol ?? 1), rate: (o.rate ?? 1) * (ui ? 1 : rnd(0.97, 1.03)), pos, ref: op.ref, send: ui ? 0 : (op.send ?? 0.2) * (pos ? 1 : 0.5) });
    return { stop: (f = 0.05) => stopVoice(v, f) };
  }
  function footstep(surface, pos, intensity = 0.6) {
    if (!ctx) return;
    const s = STEPS[surface] ? surface : SURF[surface] || 'concrete', i = U.clamp(intensity, 0.05, 1);
    play(variant('step', s, 5), { bus: B.sfx, vol: 0.2 + 0.5 * i, rate: rnd(0.94, 1.04), pos: posOf(pos), ref: 2, send: 0.12, lpMax: 2500 + 15000 * i });
  }
  function loop(name, o = {}) {
    if (!ctx || !LOOPS[name]) return H;
    const key = 'loop:' + name, op = LOOPS[name][2];
    want(key);
    const h = {
      key, op, vol: o.vol ?? 1, pos: posOf(o.pos), v: null,
      stop(f = 1) { pending.delete(h); if (h.v) stopVoice(h.v, f); },
      setVol(x) { h.vol = x; if (h.v) ramp(h.v.g.gain, x * (op.g ?? 1), 0.2); },
      setPos(p) { h.pos = posOf(p); if (h.v && h.v.pn && h.pos) place(h.v, h.pos); },
    };
    pending.add(h);
    return h;
  }
  const startLoop = h => { const b = buf(h.key); h.v = play(b, { bus: B.sfx, loop: true, vol: h.vol * (h.op.g ?? 1), fade: 0.4, offset: Math.random() * b.duration, pos: h.pos, ref: h.op.ref, send: h.pos ? 0.15 : 0 }); };

  // ambience beds
  function amb(name, fade = 2) {
    ambWant = name;
    if (!ctx || (bed && bed.name === name)) return;
    if (bed) { ramp(bed.g.gain, 0, fade); bed.kill = ctx.currentTime + fade + 0.1; fading.add(bed); }
    bed = null;
    const d = name && AMB[name];
    if (!d) return;
    const g = ctx.createGain(); g.gain.value = 0; g.connect(B.amb); ramp(g.gain, 1, fade);
    bed = { name, d, g, src: [], layers: d.l.map(([n, vol, lp]) => ({ key: 'loop:' + n, vol: vol * (LOOPS[n][2].g ?? 1), lp, on: false })), ev: d.e.map(e => ({ e, next: rnd(e[1][0] * 0.3, e[1][1]) })) };
    for (const l of bed.layers) want(l.key);
    for (const [n] of d.e) for (let k = 0; k < SFX[n][1]; k++) want(`sfx:${n}:${k}`);
    setSpace(d.sp);
    ramp(B.ambSil.gain, silent ? d.hush ?? 0.35 : 1, fade);
  }
  function startLayer(l) {
    const b = buf(l.key), s = ctx.createBufferSource(), g = ctx.createGain();
    s.buffer = b; s.loop = true; g.gain.value = 0; ramp(g.gain, l.vol, 1.5); s.connect(g);
    if (l.lp) { const f = ctx.createBiquadFilter(); f.frequency.value = l.lp; g.connect(f); f.connect(bed.g); bed.src.push(f); } else g.connect(bed.g);
    s.start(ctx.currentTime, Math.random() * b.duration);
    bed.src.push(s, g); l.on = true;
  }
  function fireEvent([name, , vol, [d0, d1]]) {                              // an ambient one-shot somewhere around the listener
    const a = Math.random() * TAU, d = rnd(d0, d1), p = new THREE.Vector3(Math.cos(a) * d, rnd(0, Math.min(8, d * 0.2)), Math.sin(a) * d).add(L.p), op = SFX[name][3];
    play(variant('sfx', name, SFX[name][1]), { bus: B.amb, vol: vol * (op.g ?? 1), rate: rnd(0.95, 1.05), pos: p, ref: d, send: op.send ?? 0.3 });
  }
  function setSpace(sp) { if (!sp || sp === space) return; space = sp; want('ir:' + sp, true); ramp(B.envOut.gain, 0, 0.12); swapAt = ctx.currentTime + 0.14; }

  // music cues
  function music(id, o = {}) {
    if (id === 'tension') { tCue = 0.65; return; }
    if (!ctx || !CUES[id] || (cue && cue.id === id)) return;
    if (cue) endCue(cue, o.fade ?? 1.5);
    const ev = CUES[id](), out = ctx.createGain();
    out.gain.value = o.fade ? 0 : 1; out.connect(ev.dry ? B.music : B.musicIn);
    cue = { id, ev, i: 0, t0: 0, out, fade: o.fade || 0, src: [] };
    for (const e of ev) if (e.key) want(e.key);
  }
  function runCue(q, now) {                                                      // schedule 0.3 s ahead once every note is synthesised
    if (!q.t0) { if (q.ev.some(e => e.key && !cache.has(e.key))) return true; q.t0 = now + 0.05; if (q.fade) ramp(q.out.gain, 1, q.fade); }
    while (q.i < q.ev.length && q.t0 + q.ev[q.i].t < now + 0.3) { const e = q.ev[q.i++]; q.src.push(playEv(ctx, q.out, e, Math.max(now, q.t0 + e.t))); }
    return q.i < q.ev.length || now < q.t0 + q.ev.end;
  }
  function endCue(q, fade) { ramp(q.out.gain, 0, fade); q.kill = ctx.currentTime + fade + 0.05; fading.add(q); }
  function stopMusic(fade = 2) { tCue = 0; if (ctx && cue) { endCue(cue, fade); cue = null; } }

  // voice (speech synthesis)
  const FEM = /female|zira|karen|samantha|catherine|hazel|susan|serena|moira|tessa|fiona|victoria|kate|natasha|libby|sonia|jenny|aria|michelle|heather|linda|allison|ava|nicky/i;
  const FEM_SPK = new Set(['chloe', 'bub', 'operator', 'lukes_wife', 'customer', 'newsreader']);
  function pickVoice(who) {
    const vs = speechSynthesis.getVoices().filter(v => /^en/i.test(v.lang));
    if (!vs.length) return null;
    const pref = [...vs.filter(v => /AU/i.test(v.lang)), ...vs.filter(v => /GB|NZ/i.test(v.lang)), ...vs], f = FEM_SPK.has(who), m = pref.filter(v => FEM.test(v.name) === f), l = m.length ? m : pref;
    return l[U.hash(String(who)) % Math.min(3, l.length)];
  }
  function speak(text, o, who) {
    return new Promise(res => {
      const u = new SpeechSynthesisUtterance(text.replace(/[—–]/g, ', ').replace(/\*/g, '')), vc = pickVoice(who);
      if (vc) u.voice = vc;
      u.lang = vc ? vc.lang : 'en-AU'; u.pitch = U.clamp(o.pitch ?? 1, 0, 2); u.rate = U.clamp(o.rate ?? 1, 0.1, 4); u.volume = U.clamp(o.volume ?? 1);
      const tm = { u, t: U.words(text) * 0.45 / u.rate + 1.5, fin: () => { if (speech.delete(tm)) res(); } };   // timeout: game time, in update
      u.onend = u.onerror = tm.fin; speech.add(tm);
      speechSynthesis.speak(u);
    });
  }
  function voice(who, text, o = {}) {
    if (!SETTINGS.voice || !window.speechSynthesis || !text || !/[\p{L}\p{N}]/u.test(text)) return Promise.resolve();
    if (whisperU && speechSynthesis.speaking) speechSynthesis.cancel();
    whisperU = false;
    return speak(text, Object.assign({ volume: SETTINGS.vol.master * SETTINGS.vol.dialogue }, o), who);
  }
  const WHISPERS = ['just one more', 'wait, watch this', 'did you see this', 'refresh', 'lol'];
  function whisperTTS(pos, vol) {
    if (!SETTINGS.voice || !window.speechSynthesis || !pos || speechSynthesis.speaking || !speechSynthesis.getVoices().length) return false;
    const d = pos.distanceTo(L.p); if (d > 10) return false;
    whisperU = true;
    speak(U.pick(WHISPERS), { pitch: 0.1, rate: 0.6, volume: 0.12 * vol * (1 - d / 12) * SETTINGS.vol.master * SETTINGS.vol.dialogue }, 'scroller');
    return true;
  }

  // ---- per frame -------------------------------------------------------------------------------------------------------------
  function listener() {
    const cam = Engine.camera; if (!cam) return;
    cam.updateMatrixWorld(); const e = cam.matrixWorld.elements, l = ctx.listener;
    L.p.set(e[12], e[13], e[14]);
    if (l.positionX) { l.positionX.value = e[12]; l.positionY.value = e[13]; l.positionZ.value = e[14]; l.forwardX.value = -e[8]; l.forwardY.value = -e[9]; l.forwardZ.value = -e[10]; l.upX.value = e[4]; l.upY.value = e[5]; l.upZ.value = e[6]; }
    else { l.setPosition(e[12], e[13], e[14]); l.setOrientation(-e[8], -e[9], -e[10], e[4], e[5], e[6]); }
  }
  function updateTension(dt) {
    const target = silent ? 0 : Math.max(tSet, tCue, (typeof AI !== 'undefined' && AI.alertLevel) || 0);
    tLvl = U.damp(tLvl, target, target > tLvl ? 1.2 : 0.5, dt);
    if (!ten && tLvl > 0.01) ten = tensionGraph(ctx, B.musicIn);
    if (!ten) return;
    if (tLvl < 0.005) { if ((tIdle += dt) > 3) { ten.stop(); ten = null; } return; }
    tIdle = 0;
    ten.g.gain.value = Math.min(1, tLvl * 1.3) * 0.2;
    ten.lfo.frequency.value = 0.7 + tLvl * 1.1;
    ten.pont.gain.value = Math.max(0, tLvl - 0.7) / 0.3 * 0.2;
    if ((tBow -= dt) <= 0) { tBow = rnd(0.4, 1.6); ramp(ten.scrape.gain, tLvl > 0.35 ? rnd(0.2, 1) * (tLvl - 0.3) / 0.7 : 0, rnd(0.2, 0.8)); }
  }
  function update(dt) {
    if (!paused) for (const s of speech) if ((s.t -= dt) <= 0) s.fin();
    if (!ctx) return;
    const now = ctx.currentTime;
    pump();
    listener();
    for (const v of voices) if (v.pn) distance(v);
    for (const h of pending) if (cache.has(h.key)) { pending.delete(h); startLoop(h); }
    if (bed) {
      for (const l of bed.layers) if (!l.on && cache.has(l.key)) startLayer(l);
      if (!paused) for (const q of bed.ev) if ((q.next -= dt) <= 0) { q.next = rnd(...q.e[1]); if (!silent || q.e[4]) fireEvent(q.e); }
    }
    if (cue && !runCue(cue, now)) { cue.kill = now; fading.add(cue); cue = null; }
    for (const q of fading) if (now >= q.kill) {
      fading.delete(q);
      if (q.layers) { for (const n of q.src) { if (n.stop) n.stop(); n.disconnect(); } q.g.disconnect(); evict(/^loop:/, [...(bed ? bed.layers : []), ...pending].map(l => l.key)); }
      else { for (const s of q.src) s.stop(now); q.out.disconnect(); evict(/^(ks|pn|ph):/, cue ? cue.ev.map(e => e.key) : []); }
    }
    updateTension(dt);
    if (swapAt && now >= swapAt && cache.has('ir:' + space)) { swapAt = 0; B.conv.buffer = buf('ir:' + space); ramp(B.envOut.gain, SPACES[space][1], 0.2); }
  }

  // ---- offline render (dev self-check and analysis): raw levels, bus gains 1, no limiter ---------------------------------------
  async function render(kind, name, sec = 4) {
    if (!window.OfflineAudioContext) return null;
    const sr = ctx ? ctx.sampleRate : SR, c = new OfflineAudioContext(2, Math.round(sec * sr), sr), out = c.destination;
    const src = (b, t, vol, lp) => { const s = c.createBufferSource(), g = c.createGain(); s.buffer = b; s.loop = !!lp; g.gain.value = vol; s.connect(g); g.connect(out); s.start(t); };
    if (kind === 'sfx' && SFX[name]) src(buf(`sfx:${name}:0`), 0, SFX[name][3].g ?? 1);
    else if (kind === 'step' && STEPS[name]) for (let k = 0; k < 4; k++) src(buf(`step:${name}:${k}`), k * 0.5, 0.38);
    else if (kind === 'loop' && LOOPS[name]) src(buf('loop:' + name), 0, LOOPS[name][2].g ?? 1, true);
    else if (kind === 'amb' && AMB[name]) {
      for (const [n, vol] of AMB[name].l) src(buf('loop:' + n), 0, vol * (LOOPS[n][2].g ?? 1), true);
      AMB[name].e.forEach((e, k) => src(buf(`sfx:${e[0]}:0`), 0.5 + k * 0.7, e[2] * (SFX[e[0]][3].g ?? 1) * 0.3));
    } else if (kind === 'music' && name === 'tension') {
      const t = tensionGraph(c, hall(c, out)); t.g.gain.value = 0.2; t.pont.gain.value = 0.2; t.lfo.frequency.value = 1.8;
      for (let s = 0; s < sec; s += 0.8) t.scrape.gain.setTargetAtTime(Math.random(), s, 0.2);
    } else if (kind === 'music' && CUES[name]) {
      const ev = CUES[name](), i = ev.dry ? out : hall(c, out);
      for (const e of ev) if (e.t < sec) playEv(c, i, e, e.t);
    } else return null;
    return c.startRendering();
  }

  return {
    init() {
      if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { ctx = null; return; }
      SR = ctx.sampleRate; L = { p: new THREE.Vector3() };
      startWorker(); buildBuses(); setVolumes(); setSpace('outdoor');
      if (ctx.state === 'suspended') { const kick = () => ctx.resume(); addEventListener('pointerdown', kick, { once: true }); addEventListener('keydown', kick, { once: true }); }
      // prefetch: UI sounds, every variant of the busy sounds and footsteps, then one variant of everything else (~25 MB)
      const all = ['pluck', 'ui_select', 'page_turn', 'click', 'swipe', 'whisper', 'scroller_scream', 'punch', 'body_fall', 'gunshot', 'revolver_shot', 'shotgun', 'rifle_shot', 'gunshot_far', 'glass_break', 'bottle_break', 'brick_hit', 'reload', 'dry_fire'];
      for (const n of all) for (let k = 0; k < SFX[n][1]; k++) idle.push(`sfx:${n}:${k}`);
      for (const s of Object.keys(STEPS)) for (let k = 0; k < 5; k++) idle.push(`step:${s}:${k}`);
      for (const n of Object.keys(SFX)) if (!all.includes(n)) idle.push(`sfx:${n}:0`);
      if (ambWant) amb(ambWant, 1);
    },
    update, music, stopMusic, sfx, loop, amb, footstep, voice, setVolumes, render,
    tension(level) { tSet = U.clamp(level || 0); },
    duck(on) { if (!ctx || on === ducked) return; ducked = on; ramp(B.musicDuck.gain, on ? 0.5 : 1, on ? 0.25 : 0.9); ramp(B.ambDuck.gain, on ? 0.6 : 1, on ? 0.25 : 0.9); },
    muffle(t) { t = U.clamp(t || 0); if (!ctx || Math.abs(t - muf) < 0.01) return; muf = t; ramp(B.muffle.frequency, 20000 * Math.pow(350 / 20000, t), 0.08); },
    pause(p) {
      if (!ctx || p === paused) return;
      paused = p; ramp(B.world.gain, p ? 0 : 1, 0.15); ramp(B.musicPause.gain, p ? 0.35 : 1, 0.3);
      if (window.speechSynthesis) p ? speechSynthesis.pause() : speechSynthesis.resume();
    },
    silence(on, fade = 1.5) {
      silent = !!on;
      if (!ctx) return;
      if (on) stopMusic(fade);
      ramp(B.ambSil.gain, on ? (bed && bed.d.hush) ?? 0.35 : 1, fade);
    },
    stats() { let mb = 0; for (const b of cache.values()) mb += b.length * b.numberOfChannels * 4e-6; return { ready: !!ctx, state: ctx && ctx.state, worker: !!worker, cached: cache.size, queued: jobs.length + idle.length + busy.size, voices: voices.size, mb: Math.round(mb) }; },
    catalog: () => ({ sfx: Object.keys(SFX), loop: Object.keys(LOOPS), amb: Object.keys(AMB), music: [...Object.keys(CUES), 'tension'], surfaces: Object.keys(STEPS) }),
  };
})();
