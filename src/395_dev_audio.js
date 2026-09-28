// ============================================================================
// Dev audio benches (only reachable with ?dev). Owned by: audio agent.
//   ?dev&test=audio        audition in the dev yard: every music cue, ambience bed, loop, sfx and footstep surface in turn,
//                          named on screen; N skips to the next. &only=music|amb|loop|sfx|step plays one group, &from=name
//                          starts at that name, &sec=N changes how long cues and beds play (default 20 and 12).
//   ?dev&test=audio_check  self-check: renders every sound offline and asserts finite samples, peak < 1 and not silent;
//                          measures the tuning of the theme, the UI pluck and Bub's motif and the click's ping; drives the
//                          live API (positional sfx, far gunshots, loops, beds, cues, tension, duck, muffle, pause, silence,
//                          voice) and checks voices are released. Failures go to console.error; the table is drawn on
//                          screen and left in GAME.audioCheck { pass, rows }.
//   ?dev&test=audio_view&show=sfx:click,music:title&sec=3   offline renders drawn as waveform + log-frequency spectrogram
//                          (50 Hz–16 kHz, 60 dB range), one row per sound, so a sound can be judged by eye.
// ============================================================================
(() => {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const yard = async G => { await G.area('DEV'); G.player(G.actor('chase', 'chase', 'mk_start')); G.control(true); await G.wait(0.5); };
  // a point relative to the listener: x right, z forward (metres)
  const near = (x, z, y = 0) => { const c = Engine.camera, r = V(0, 0, 0).setFromMatrixColumn(c.matrixWorld, 0), f = V(0, 0, 0).setFromMatrixColumn(c.matrixWorld, 2).negate(); return c.position.clone().addScaledVector(r, x).addScaledVector(f, z).setY(c.position.y + y); };
  function panel(css) {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;z-index:99;left:24px;top:24px;padding:14px 18px;background:rgba(8,10,14,.82);color:#d8d2c4;font:13px/1.5 monospace;white-space:pre;border-left:3px solid #FFD400;pointer-events:none;' + (css || '');
    document.body.appendChild(el);
    return el;
  }

  CONTENT.dev.audio = async G => {
    await yard(G);
    const cat = Audio.catalog(), P = PARAMS, only = P.get('only'), sec = +(P.get('sec') || 0), el = panel();
    let skip = false, from = P.get('from');
    const key = e => { if (e.code === 'KeyN') skip = true; };
    addEventListener('keydown', key);
    const hold = async s => { for (let t = 0; t < s && !skip; t += 0.1) await G.wait(0.1); };
    const groups = [
      ['music', cat.music, async id => {
        Audio.music(id);
        if (id === 'tension') for (let t = 0; t <= 1 && !skip; t += 0.05) { Audio.tension(t); await hold((sec || 20) / 20); }
        else await hold(sec || 20);
        Audio.tension(0); Audio.stopMusic(1.5); await hold(2);
      }],
      ['amb', cat.amb, async id => { Audio.amb(id, 1); await hold(sec || 12); }],
      ['loop', cat.loop, async id => { const h = Audio.loop(id, { pos: near(-3, 5) }); await hold(5); h.stop(0.5); await hold(0.6); }],
      ['sfx', cat.sfx, async (id, i) => { Audio.sfx(id, { pos: near(i % 2 ? 3 : -3, 4, 0.5) }); await hold(2.5); }],
      ['step', cat.surfaces, async id => { for (let k = 0; k < 8 && !skip; k++) { Audio.footstep(id, near(k % 2 ? 0.15 : -0.15, 0.6, -1.5), 0.3 + 0.1 * k); await G.wait(0.5); } }],
    ];
    for (const [kind, names, play] of groups) {
      if (only && only !== kind) continue;
      if (kind === 'music') Audio.amb(null, 1);
      for (let i = 0; i < names.length; i++) {
        if (from && names[i] !== from) continue;
        from = null; skip = false;
        el.textContent = `AUDIO AUDITION   ${kind.toUpperCase()} ${i + 1}/${names.length}\n\n  ${names[i]}\n\nN  next`;
        await play(names[i], i);
      }
      if (kind === 'amb') Audio.amb(null, 1);
    }
    removeEventListener('keydown', key);
    el.textContent = 'AUDIO AUDITION   done';
  };

  // ---- self-check measurements ------------------------------------------------------------------------------------------
  function measure(b) {
    let pk = 0, e = 0, bad = 0, hot = 0;
    for (let c = 0; c < b.numberOfChannels; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < d.length; i++) { const v = d[i]; if (!Number.isFinite(v)) { bad++; continue; } const a = Math.abs(v); if (a > pk) pk = a; if (a > 0.98) hot++; e += v * v; }
    }
    return { pk, rms: Math.sqrt(e / (b.length * b.numberOfChannels)), bad, hot };
  }
  // fundamental by autocorrelation over [t0, t1], searched between lo and hi Hz, refined by parabolic interpolation
  function pitch(b, t0, t1, lo, hi) {
    const d = b.getChannelData(0), sr = b.sampleRate, i0 = Math.round(t0 * sr), n = Math.round((t1 - t0) * sr);
    const ac = L => { let s = 0; for (let i = 0; i < n; i++) s += d[i0 + i] * d[i0 + i + L]; return s; };
    let best = 0, bv = -Infinity;
    for (let L = Math.floor(sr / hi); L <= Math.ceil(sr / lo); L++) { const v = ac(L); if (v > bv) { bv = v; best = L; } }
    const y0 = ac(best - 1), y2 = ac(best + 1);
    return sr / (best + (y0 - y2) / (2 * (y0 - 2 * bv + y2)));
  }
  // strongest frequency between lo and hi (Goertzel scan, 25 Hz steps) over [t0, t1]
  function peakFreq(b, t0, t1, lo, hi) {
    const d = b.getChannelData(0), sr = b.sampleRate, i0 = Math.round(t0 * sr), n = Math.round((t1 - t0) * sr);
    let best = lo, bp = -1;
    for (let f = lo; f <= hi; f += 25) {
      const k = 2 * Math.cos(2 * Math.PI * f / sr);
      let s1 = 0, s2 = 0;
      for (let i = 0; i < n; i++) { const s = d[i0 + i] + k * s1 - s2; s2 = s1; s1 = s; }
      const p = s1 * s1 + s2 * s2 - k * s1 * s2;
      if (p > bp) { bp = p; best = f; }
    }
    return best;
  }
  const cents = (f, ref) => 1200 * Math.log2(f / ref);
  // in-place radix-2 FFT of re/im (length a power of two)
  function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
    for (let len = 2; len <= n; len <<= 1) {
      const w = -2 * Math.PI / len;
      for (let i = 0; i < n; i += len) for (let k = 0; k < len / 2; k++) {
        const c = Math.cos(w * k), s = Math.sin(w * k), a = i + k, b = a + len / 2, tr = re[b] * c - im[b] * s, ti = re[b] * s + im[b] * c;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
      }
    }
  }
  function drawSound(g, b, x0, y0, w, h, label) {
    const d = b.getChannelData(0), sr = b.sampleRate, N = 2048, wh = Math.round(h * 0.22), sh = h - wh - 4, lo = Math.log(50), hi = Math.log(16000);
    g.fillStyle = '#0b0d12'; g.fillRect(x0, y0, w, h);
    g.strokeStyle = '#8fb38a'; g.beginPath();
    for (let x = 0; x < w; x++) { const i0 = Math.floor(x / w * d.length), i1 = Math.floor((x + 1) / w * d.length); let mn = 0, mx = 0; for (let i = i0; i < i1; i++) { mn = Math.min(mn, d[i]); mx = Math.max(mx, d[i]); } g.moveTo(x0 + x + 0.5, y0 + wh / 2 - mx * wh / 2); g.lineTo(x0 + x + 0.5, y0 + wh / 2 - mn * wh / 2 + 1); }
    g.stroke();
    const img = g.createImageData(w, sh), re = new Float32Array(N), im = new Float32Array(N);
    for (let x = 0; x < w; x++) {
      const c = Math.floor(x / w * d.length) - N / 2;
      for (let i = 0; i < N; i++) { const v = d[c + i] || 0; re[i] = v * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / N)); im[i] = 0; }
      fft(re, im);
      for (let y = 0; y < sh; y++) {
        const f = Math.exp(lo + (hi - lo) * (1 - y / sh)), k = Math.min(N / 2 - 1, Math.round(f / sr * N)), db = 10 * Math.log10(re[k] * re[k] + im[k] * im[k] + 1e-12);
        const t = Math.max(0, Math.min(1, (db + 20) / 60)), o = (y * w + x) * 4;
        img.data[o] = 255 * Math.min(1, t * 1.6); img.data[o + 1] = 255 * Math.max(0, t * 1.6 - 0.6); img.data[o + 2] = 255 * Math.max(0, 0.5 - Math.abs(t - 0.3)) * 1.4; img.data[o + 3] = 255;
      }
    }
    g.putImageData(img, x0, y0 + wh + 4);
    g.fillStyle = '#d8d2c4'; g.font = '12px monospace';
    g.fillText(`${label}   ${b.duration.toFixed(2)} s`, x0 + 6, y0 + 14);
    for (const f of [100, 1000, 2500, 10000]) { const y = y0 + wh + 4 + sh * (1 - (Math.log(f) - lo) / (hi - lo)); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x0 + w - 44, y, 44, 1); g.fillText(f >= 1000 ? f / 1000 + 'k' : String(f), x0 + w - 40, y - 2); }
  }

  CONTENT.dev.audio_view = async G => {
    await yard(G);
    const show = (PARAMS.get('show') || 'sfx:click').split(','), sec = +(PARAMS.get('sec') || 2), cv = document.createElement('canvas');
    cv.width = innerWidth; cv.height = innerHeight; cv.style.cssText = 'position:fixed;inset:0;z-index:99;background:#05060a';
    document.body.appendChild(cv);
    const g = cv.getContext('2d'), rh = cv.height / show.length;
    for (let i = 0; i < show.length; i++) {
      const [kind, name] = show[i].split(':'), b = await Audio.render(kind, name, sec);
      if (b) drawSound(g, b, 8, i * rh + 4, cv.width - 16, rh - 8, show[i]);
    }
    window.GAME.audioView = true;
  };

  CONTENT.dev.audio_check = async G => {
    await yard(G);
    const rows = [], el = panel('max-height:calc(100vh - 48px);overflow:hidden;font-size:12px;line-height:1.35;');
    const fail = (what, why) => { rows.push([what, 'FAIL', why]); console.error(`audio_check ${what}: ${why}`); };
    const ok = (what, info) => rows.push([what, 'ok', info]);
    const draw = head => { el.textContent = head + '\n\n' + rows.filter(r => r[1] === 'FAIL' || !r[0].includes(':')).map(([w, s, i]) => `${s === 'ok' ? '  ok ' : 'FAIL '} ${w.padEnd(26)} ${i}`).join('\n'); };
    draw('AUDIO SELF-CHECK   rendering…');
    await G.wait(0.1);

    // 1. every sound rendered offline: finite, peak below full scale, audible
    const cat = Audio.catalog(), lens = { music: 8, amb: 5, loop: 3, sfx: 3, step: 2.2 };
    let n = 0, loud = { pk: 0 };
    for (const kind of ['music', 'amb', 'loop', 'sfx', 'step']) {
      let worst = 0, quiet = Infinity;
      for (const name of kind === 'step' ? cat.surfaces : cat[kind]) {
        const b = await Audio.render(kind, name, lens[kind]), what = `${kind}:${name}`;
        if (!b) { fail(what, 'no render'); continue; }
        const m = measure(b); n++;
        if (m.bad) fail(what, `${m.bad} non-finite samples`);
        else if (m.pk >= 1 || m.hot > 2) fail(what, `clipping: peak ${m.pk.toFixed(3)}, ${m.hot} samples above 0.98`);
        else if (m.rms < 1e-4) fail(what, `silent: rms ${m.rms.toExponential(1)}`);
        else ok(what, `peak ${m.pk.toFixed(2)} rms ${m.rms.toFixed(3)}`);
        worst = Math.max(worst, m.pk); quiet = Math.min(quiet, m.rms);
        if (m.pk > loud.pk) loud = { pk: m.pk, what };
      }
      ok(`renders ${kind}`, `max peak ${worst.toFixed(2)}, min rms ${quiet.toFixed(4)}`);
      draw('AUDIO SELF-CHECK   rendering…');
      await G.wait(0.05);
    }
    ok('renders total', `${n} sounds, loudest ${loud.what} at ${loud.pk.toFixed(2)}`);

    // 2. tuning and character (the score is in D minor; the UI plucks phrase A from A3)
    const tune = async (what, kind, name, t0, t1, ref) => {
      const f = pitch(await Audio.render(kind, name, t1 + 0.1), t0, t1, ref * 0.8, ref * 1.25), c = cents(f, ref);
      (Math.abs(c) <= 15 ? ok : fail)(what, `${f.toFixed(1)} Hz (${c >= 0 ? '+' : ''}${c.toFixed(1)} cents from ${ref.toFixed(1)})`);
    };
    await tune('theme_a first note A3', 'music', 'theme_a', 0.35, 0.8, 220);
    await tune('theme_b first note F4', 'music', 'theme_b', 0.35, 0.8, 349.23);
    await tune('chloe_motif F5', 'music', 'chloe_motif', 0.35, 0.7, 698.46);
    await tune('pluck (UI) A3', 'sfx', 'pluck', 0.05, 0.5, 220);
    await tune('phone_boot D5', 'sfx', 'phone_boot', 0.02, 0.11, 587.33);
    const ck = await Audio.render('sfx', 'click', 0.6), fp = peakFreq(ck, 0, 0.12, 1000, 5000);
    (fp >= 2200 && fp <= 2900 ? ok : fail)('click ping', `${fp} Hz (want 2.2–2.9 kHz)`);
    draw('AUDIO SELF-CHECK   live API…');

    // 3. the live API: never throws, unknown names are silent no-ops, voices are released
    const live = async (what, fn) => { try { await fn(); ok(what, ''); } catch (e) { fail(what, e.message); } };
    const s0 = Audio.stats();
    (s0.ready ? ok : fail)('context', `${s0.state}, synthesis ${s0.worker ? 'in a worker' : 'on the main thread'}`);
    await live('unknown names', () => {
      Audio.sfx('no_such_sound').stop(); const h = Audio.loop('no_such_loop'); h.setVol(0.5); h.setPos([0, 0, 0]); h.stop();
      Audio.amb('no_such_bed'); Audio.music('no_such_cue'); Audio.footstep('lava', [0, 0, 0], 3); Audio.footstep('asphalt', null);
    });
    await live('positional sfx', async () => { Audio.sfx('glass_break', { pos: near(4, 3) }); Audio.sfx('gunshot', { pos: near(-2, 90) }); Audio.sfx('punch', { pos: [0, 1, 0], vol: 0.5, rate: 1.2 }); await G.wait(0.5); });
    await live('loop handle', async () => { const h = Audio.loop('fire', { pos: near(0, 6), vol: 0.5 }); await G.wait(0.8); h.setPos(near(3, 3)); h.setVol(0.2); await G.wait(0.4); h.stop(0.3); });
    await live('beds crossfade', async () => { Audio.amb('suburb_night', 0.4); await G.wait(0.8); Audio.amb('house_night', 0.4); await G.wait(0.8); Audio.amb('fire_street', 0.3); await G.wait(0.5); });
    await live('music cue', async () => { Audio.music('theme_a'); await G.wait(1); Audio.music('chloe_motif', { fade: 0.5 }); await G.wait(1); Audio.stopMusic(0.5); });
    await live('tension', async () => { Audio.music('tension'); Audio.tension(1); await G.wait(1.5); Audio.tension(0); Audio.stopMusic(0.5); await G.wait(0.5); });
    await live('duck muffle pause', async () => { Audio.duck(true); Audio.muffle(1); Audio.pause(true); await G.wait(0.3); Audio.pause(false); Audio.muffle(0); Audio.duck(false); Audio.setVolumes(); });
    await live('silence', async () => { Audio.silence(true, 0.3); await G.wait(0.4); Audio.music('theme_a'); Audio.silence(false, 0.3); Audio.stopMusic(0.3); Audio.amb(null, 0.3); });
    const was = SETTINGS.voice;
    SETTINGS.voice = true;
    let said = false;
    Audio.voice('chase', 'This is a test line.', { pitch: 0.8, rate: 0.9 }).then(() => { said = true; });
    for (let t = 0; t < 6 && !said; t += 0.1) await G.wait(0.1);
    SETTINGS.voice = was;
    (said ? ok : fail)('voice resolves', said ? 'on end or its word-count timeout' : 'still pending after 6 s');
    // one-shots finish on the audio clock (wall time), so poll that long
    const w0 = performance.now();
    while (Audio.stats().voices && performance.now() - w0 < 6000) await G.wait(0.1);
    const s1 = Audio.stats();
    (s1.voices === 0 ? ok : fail)('voices released', `${s1.voices} left · ${s1.cached} buffers cached, ${s1.mb} MB`);

    const fails = rows.filter(r => r[1] === 'FAIL').length;
    window.GAME.audioCheck = { pass: !fails, rows };
    draw(`AUDIO SELF-CHECK   ${fails ? fails + ' FAILED' : 'PASS'}   (${rows.length} checks)`);
    el.style.borderLeftColor = fails ? '#e04040' : '#40c060';
  };
})();
