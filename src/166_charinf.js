// ============================================================================
// CharInf — how the Update shows on a body (chars agent, internal to Chars).
//   CharInf.prep(look)   adjusts a seeded look by stage (look.inf: scroller | lurker | clicker | bloatware)
//   CharInf.attach(c)    per-character extras: raw thumbs, the glowing screen growth (a skinned emissive mesh)
//   CharInf.tick(dt)     flickers the shared Feed glow with the scroll rhythm
// Scrollers still look human: stooped, phone raised, red wet eyes, raw thumbs. Lurkers are greyer and gaunter
// with a cracked, dimmed screen. Clickers have the phone fused over the face and cracked screen plates blooming
// out of the eye sockets, glowing blue. Bloatware are armoured in fused phones, tablets and power banks with
// charging cables trailing like roots, a few screens still lit.
// ============================================================================
const CharInf = (() => {
  const V3 = THREE.Vector3;
  const { W1, W2, BI, MB, TAU } = CharBody;
  const mixHex = (a, b, t) => '#' + [1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t).toString(16).padStart(2, '0')).join('');

  function prep(L) {
    const st = L.inf, dirt = { scroller: 0.7, lurker: 1, clicker: 1, bloatware: 1 }[st];
    L.outfit = L.outfit.map(g => Object.assign({}, g, { dirt: Math.max(g.dirt || 0, dirt), blood: st === 'scroller' ? g.blood : Math.max(g.blood || 0, 0.7) }));
    L.acc = st === 'scroller' ? L.acc.filter(a => ['cap', 'beanie', 'watch', 'glasses'].includes(a.k)) : [];
    L.decals = ['feed', 'grime'];
    L.rosy = 0.1;
    if (st === 'scroller') { L.skin = mixHex(L.skin, '#b0b4a8', 0.28); L.stoop = 0.55; L.hold = L.seed % 3 ? 'phone' : 'phone_cracked'; L.pose = 'phone'; }
    if (st === 'lurker') { L.skin = mixHex(L.skin, '#8e948c', 0.45); L.stoop = 0.8; L.head = Object.assign({}, L.head, { hollow: 1.2 }); L.hold = 'phone_cracked'; L.pose = 'phone'; L.tired = 1.2; }
    if (st === 'clicker' || st === 'bloatware') {
      L.skin = mixHex(L.skin, st === 'clicker' ? '#6e7466' : '#7a7066', 0.6); L.stoop = st === 'clicker' ? 1 : 0.7; L.blind = true; L.pose = 'feed'; L.jawOpen = 0.08;
      L.head = Object.assign({}, L.head, { hollow: 1.3 });
      if (L.hair && L.hair.style !== 'bald') L.hair = Object.assign({}, L.hair, { style: st === 'clicker' ? 'messy' : L.hair.style, color: mixHex(L.hair.color || '#333333', '#555a50', 0.4) });
      L.infAcc = st === 'clicker' ? clickerGeo : bloatGeo;
    }
    if (st === 'bloatware') { L.build = Object.assign({}, L.build, { fat: 1.2, belly: 1, sh: 1.25, ch: 1.3, arm: 1.3, leg: 1.2, neck: 1.4 }); L.H = Math.max(L.H, 1.92); L.beard = null; }
  }

  // ---- body-mesh parts (in the character atlas) ----------------------------------------------------------
  const DEV = ['#16181b', '#22252a', '#2e3136', '#e8e6e0', '#b8bcc0', '#3a2e2a', '#1a1c28'];
  const RB = (w, h, d, r) => new RoundedBoxGeometry(w, h, d, 1, r);
  const M = (p, e, s = 1) => new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromEuler(new THREE.Euler(...e)), new V3(s, s, s));
  function clickerGeo(ctx) {
    const R = CharPaint.rng(ctx.look.seed * 13 + 7), P = CharDress.prim, hm = CharDress.headM;
    // the phone fused across the face, sunk into swollen grey growth
    P(ctx, RB(0.085, 0.16, 0.014, 0.008), hm(ctx, [0, -0.012, 0.09], [-0.12, 0, (R() - 0.5) * 0.3]), W1('head'), '#15171a', { rough: 0.3 });
    for (let i = 0; i < 18; i++) {
      const a = R() * TAU, r = 0.03 + R() * 0.035;
      P(ctx, new THREE.SphereGeometry(0.012 + R() * 0.012, 7, 5), hm(ctx, [Math.cos(a) * r * 1.2, Math.sin(a) * r * 1.2 - 0.01, 0.075 + R() * 0.012], [R(), R(), R()], [1, 0.7 + R() * 0.5, 0.6]), W1('head'), mixHex('#5a5e56', '#2a2c32', R()), { rough: 0.5, flat: true });
    }
  }
  function bloatGeo(ctx) {
    const { D } = ctx, R = CharPaint.rng(ctx.look.seed * 17 + 3), P = CharDress.prim, s = D.s, on = CharDress.onTorso, W = CharDress.CharBodyW;
    for (let i = 0; i < 70; i++) {                                         // phones, tablets, power banks fused over the torso
      const phi = R() * TAU - Math.PI, h = 0.46 + R() * 0.38, p = on(ctx, phi, h, 0.01 + R() * 0.03), kind = R();
      const w = kind < 0.5 ? 0.075 : kind < 0.8 ? 0.16 + R() * 0.06 : 0.07, hh = kind < 0.5 ? 0.15 : kind < 0.8 ? 0.22 : 0.11, d = kind < 0.8 ? 0.012 : 0.03;
      P(ctx, RB(w * s, hh * s, d * s, 0.006 * s), M(p, [(R() - 0.5) * 0.8, phi + (R() - 0.5) * 0.5, (R() - 0.5) * 1.2]), W(D, p), DEV[Math.floor(R() * DEV.length)], { rough: 0.35, flat: true });
    }
    for (const S of 'LR') for (let i = 0; i < 8; i++) {                    // swollen batteries and devices on the arms
      const t = R(), b = (t < 0.5 ? 'upperArm' : 'foreArm') + S, j0 = ctx.J[b], j1 = ctx.J[(t < 0.5 ? 'foreArm' : 'hand') + S];
      const p = j0.clone().lerp(j1, (t % 0.5) * 2).add(new V3((R() - 0.5) * 0.12, (R() - 0.5) * 0.06, (R() - 0.5) * 0.12).multiplyScalar(s));
      P(ctx, RB(0.07 * s, 0.13 * s, 0.03 * s, 0.012 * s), M(p, [R() * 3, R() * 3, R() * 3]), W1(b), DEV[Math.floor(R() * DEV.length)], { rough: 0.4 });
    }
    for (let i = 0; i < 10; i++) P(ctx, RB(0.06, 0.1, 0.018, 0.006), CharDress.headM(ctx, [(R() - 0.5) * 0.12, 0.02 + R() * 0.1, (R() - 0.3) * 0.14], [R() * 3, R() * 3, R() * 3]), W1('head'), DEV[Math.floor(R() * DEV.length)], { rough: 0.35 });
    for (let i = 0; i < 14; i++) {                                         // charging cables trailing like roots
      const phi = R() * TAU - Math.PI, p0 = on(ctx, phi, 0.5 + R() * 0.3, 0.03), pts = [p0];
      let p = p0.clone(); const dir = new V3(Math.sin(phi), -1.5, Math.cos(phi)).normalize();
      for (let k = 0; k < 7; k++) { dir.add(new V3((R() - 0.5) * 0.6, -0.2, (R() - 0.5) * 0.6)).normalize(); p = p.clone().addScaledVector(dir, 0.1 * s); if (p.y < 0.02) p.y = 0.02; pts.push(p); }
      CharDress.tube(ctx, pts, 0.0035 * s, R() < 0.6 ? '#e8e6e0' : '#1a1a1a', (q, t) => t < 0.3 ? W(D, p0) : W2('hips', q.x > 0 ? 'thighL' : 'thighR', 0.4), { cols: 4 });
    }
  }

  // ---- the glow: cracked screen plates (clicker) / still-lit screens (bloatware) --------------------------
  let glowMat = null;
  function gmat() {
    if (glowMat) return glowMat;
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d'), R = CharPaint.rng(77);
    const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#5ab4ff'); gr.addColorStop(1, '#1a4ad8'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(${200 + R() * 55 | 0},${230 + R() * 25 | 0},255,${0.2 + R() * 0.5})`; g.fillRect(R() * 128, R() * 128, 4 + R() * 30, 3 + R() * 6); }
    g.strokeStyle = 'rgba(10,20,40,0.85)'; g.lineWidth = 1.5;
    for (let i = 0; i < 12; i++) { g.beginPath(); let x = R() * 128, y = R() * 128; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (R() - 0.5) * 50; y += (R() - 0.5) * 50; g.lineTo(x, y); } g.stroke(); }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.userData.shared = true;
    glowMat = new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(1.8, 1.8, 2.2), toneMapped: false });
    glowMat.userData.shared = true;
    return glowMat;
  }
  function attach(c) {
    const st = c.infected, B = c.B;
    const g = B.body.geometry, si = g.attributes.skinIndex, col = g.attributes.color;         // raw thumbs
    for (let i = 0; i < si.count; i++) { const b = si.getX(i); if (b === BI.thumb2L || b === BI.thumb2R) col.setXYZ(i, 1, 0.55, 0.5); }
    col.needsUpdate = true;
    if (st !== 'clicker' && st !== 'bloatware') return;
    const mb = new MB(), R = CharPaint.rng(c.look.seed * 31 + 5), D = B.D, hs = D.hs, WHITE = new THREE.Color(1, 1, 1);
    const plate = (center, nrm, size, bone) => {                        // a cracked screen shard blooming outward
      const t1 = new V3().crossVectors(nrm, new V3(0, 1, 0)).normalize(), t2 = new V3().crossVectors(t1, nrm), n = 5, base = mb.n;
      mb.v(center.clone().addScaledVector(nrm, size * 0.15), nrm, 0.5, 0.5, WHITE, W1(bone), 1);
      for (let k = 0; k < n; k++) { const a = k / n * TAU + R() * 0.5, r = size * (0.6 + R() * 0.5); mb.v(center.clone().addScaledVector(t1, Math.cos(a) * r).addScaledVector(t2, Math.sin(a) * r), nrm, 0.5 + Math.cos(a) * 0.4, 0.5 + Math.sin(a) * 0.4, WHITE, W1(bone), 1); }
      mb.v(center.clone().addScaledVector(nrm, -size * 0.6), nrm.clone().negate(), 0.5, 0.5, new THREE.Color(0.3, 0.3, 0.4), W1(bone), 1);
      for (let k = 0; k < n; k++) { mb.tri(base, base + 1 + k, base + 1 + (k + 1) % n); mb.tri(base + n + 1, base + 1 + (k + 1) % n, base + 1 + k); }
    };
    if (st === 'clicker') {
      const ipd = (c.look.head && c.look.head.ipd) || 0.062;
      for (const sd of [1, -1]) for (let i = 0; i < 7; i++) {
        const a = R() * TAU, spread = 0.012 + R() * 0.03;
        const cc = new V3(sd * ipd / 2 + Math.cos(a) * spread, Math.sin(a) * spread * 1.2 + 0.004, 0.1 + R() * 0.02).multiplyScalar(hs).add(D.headO);
        const nrm = new V3(sd * 0.3 + Math.cos(a) * 0.6, Math.sin(a) * 0.6 + 0.1, 0.8).normalize();
        plate(cc.addScaledVector(nrm, 0.01 * hs), nrm, (0.012 + R() * 0.016) * hs, 'head');
      }
    } else for (let i = 0; i < 12; i++) {
      const phi = R() * TAU - Math.PI, h = 0.5 + R() * 0.32, p = CharBody.torsoPt(D, h * D.H, phi, { d: 0.045 * D.s }, new V3());
      plate(p, new V3(Math.sin(phi), (R() - 0.5) * 0.4, Math.cos(phi)).normalize(), (0.03 + R() * 0.03) * D.s, h > 0.64 ? 'chest' : 'spine');
    }
    const m = new THREE.SkinnedMesh(mb.geometry(), gmat());
    m.bind(B.skeleton, new THREE.Matrix4()); m.boundingSphere = B.body.boundingSphere;
    B.root.add(m); c.glowMesh = m;
  }
  let t = 0;
  function tick(dt) { t += dt; if (glowMat) { const k = 1.5 + 0.35 * Math.sin(t * 9) * Math.sin(t * 2.3) + (Math.sin(t * 31) > 0.96 ? 0.6 : 0); glowMat.color.setRGB(k, k, k * 1.25); } }
  return { prep, attach, tick };
})();
