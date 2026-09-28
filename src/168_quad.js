// ============================================================================
// Quad — quadrupeds for Chars (chars agent): 'horse' (the brumby Chloe calls Horse, saddled and bridled) and
// 'deer' (a sambar stag). Same Character interface as people (Chars adds the shared API); human-only calls
// (emote, speak, gesture, hold, badge...) are harmless no-ops. Poses: stand graze lie dead. Gaits from speed:
// walk (4-beat), trot (diagonal pairs), gallop (rotary). Riders: rider.attach(horse, 'ride' | 'ride_back').
//   Quad.kinds · Quad.create(kind, o) · Quad.frame(c, dt) · Quad.mount(horse, rider, back) · Quad.API
// ============================================================================
const Quad = (() => {
  const V3 = THREE.Vector3;
  const { MB, surf, W1, W2, TAU, lerp, sstep, gauss, clamp, cr } = CharBody;
  const kinds = {
    horse: { H: 1.45, len: 1.0, coat: '#6b4226', dark: '#1e1612', belly: '#7a5234', mane: '#1a1410', neckL: 0.62, headL: 0.55, legL: 0.9, girth: 1, saddle: true },
    deer: { H: 1.3, len: 0.86, coat: '#6a5a46', dark: '#3a3024', belly: '#8a7a62', mane: '#4a3e30', neckL: 0.5, headL: 0.4, legL: 0.85, girth: 0.78, antlers: true },
  };
  const BONES = ['body', 'hips', 'chest', 'neck1', 'neck2', 'head', 'tail0', 'tail1', 'earL', 'earR', 'reins'];
  for (const L of ['FL', 'FR', 'BL', 'BR']) BONES.push('up' + L, 'lo' + L, 'can' + L, 'hoof' + L);
  const BI = Object.fromEntries(BONES.map((n, i) => [n, i]));
  const Wq = n => [[BI[n], 1]], Wq2 = (a, b, t) => t <= 0 ? Wq(a) : t >= 1 ? Wq(b) : [[BI[a], 1 - t], [BI[b], t]];

  function create(kind, o = {}) {
    const K = kinds[kind], s = K.H / 1.45, R = CharPaint.rng((o.seed ?? 3) * 91 + 1);
    // skeleton (bind: standing, facing +Z)
    const J = {}, withers = K.H * 0.97, bodyY = K.H * 0.72;
    J.body = new V3(0, bodyY, 0); J.hips = new V3(0, bodyY + 0.02 * s, -0.45 * s * K.len); J.chest = new V3(0, bodyY + 0.04 * s, 0.4 * s * K.len);
    J.neck1 = new V3(0, withers - 0.05 * s, 0.55 * s * K.len); J.neck2 = J.neck1.clone().add(new V3(0, K.neckL * 0.55 * s, K.neckL * 0.45 * s));
    J.head = J.neck2.clone().add(new V3(0, K.neckL * 0.25 * s, K.neckL * 0.35 * s)); J.reins = J.neck1.clone().add(new V3(0, 0.1 * s, 0.1 * s));
    J.earL = J.head.clone().add(new V3(0.06 * s, 0.06 * s, -0.02 * s)); J.earR = J.earL.clone(); J.earR.x *= -1;
    J.tail0 = new V3(0, bodyY + 0.12 * s, -0.78 * s * K.len); J.tail1 = J.tail0.clone().add(new V3(0, -0.3 * s, -0.08 * s));
    for (const [L, fz, sx] of [['FL', 0.5, 1], ['FR', 0.5, -1], ['BL', -0.55, 1], ['BR', -0.55, -1]]) {
      const x = sx * 0.16 * s * K.girth, z = fz * s * K.len, back = fz < 0;
      J['up' + L] = new V3(x, bodyY - 0.05 * s, z); J['lo' + L] = new V3(x, K.legL * 0.62 * s * (back ? 1.05 : 1), z + (back ? -0.06 : 0.02) * s);
      J['can' + L] = new V3(x, K.legL * 0.32 * s, z + (back ? 0.02 : 0.0) * s); J['hoof' + L] = new V3(x, 0.07 * s, z + 0.02 * s);
    }
    const PARENT = { body: null, hips: 'body', chest: 'body', neck1: 'chest', neck2: 'neck1', head: 'neck2', earL: 'head', earR: 'head', reins: 'neck1', tail0: 'hips', tail1: 'tail0' };
    for (const L of ['FL', 'FR']) Object.assign(PARENT, { ['up' + L]: 'chest', ['lo' + L]: 'up' + L, ['can' + L]: 'lo' + L, ['hoof' + L]: 'can' + L });
    for (const L of ['BL', 'BR']) Object.assign(PARENT, { ['up' + L]: 'hips', ['lo' + L]: 'up' + L, ['can' + L]: 'lo' + L, ['hoof' + L]: 'can' + L });
    const bones = {}, list = [];
    for (const n of BONES) { const b = new THREE.Bone(); b.name = n; bones[n] = b; list.push(b); }
    for (const n of BONES) { const p = PARENT[n]; bones[n].position.copy(J[n]); if (p) { bones[n].position.sub(J[p]); bones[p].add(bones[n]); } }
    const root = new THREE.Group(); root.add(bones.body); bones.body.updateMatrixWorld(true);
    const skeleton = new THREE.Skeleton(list);
    // geometry
    const A = CharBody.Atlas(256), mb = new MB();
    const coat = A.alloc('coat', 256, 128, { t: 'fur', color: K.coat }), dark = A.alloc('dark', 128, 64, { t: 'fur', color: K.dark }), mane = A.alloc('mane', 128, 64, { t: 'hair', color: K.mane });
    const uvc = (r, a, b) => A.uv(r, a, b);
    // barrel: loft along z from rump to chest
    const BK = [[-0.82, 0.02, 0.1, 0.02], [-0.72, 0.17, 0.25, 0.06], [-0.45, 0.22, 0.29, 0.05], [0, 0.22, 0.31, 0.0], [0.35, 0.21, 0.3, 0.02], [0.55, 0.17, 0.27, 0.06], [0.68, 0.1, 0.18, 0.1]];
    const bk = [0, 0, 0];
    surf(mb, 16, 19, (i, j) => {
      const t = i / 15, z = lerp(-0.84, 0.7, t); cr(BK, z, bk);
      const a = j / 18 * TAU, rx = bk[0] * s * K.girth, ry = bk[1] * s * (0.5 + 0.5 * K.girth), yc = bodyY + bk[2] * s * 0.5;
      const p = new V3(Math.sin(a) * rx, yc + Math.cos(a) * ry * (Math.cos(a) < 0 ? 0.9 : 1), z * s * K.len);
      const w = z < -0.3 ? Wq2('body', 'hips', sstep(-0.3, -0.6, z)) : z > 0.25 ? Wq2('body', 'chest', sstep(0.25, 0.5, z)) : Wq('body');
      const bel = Math.max(0, -Math.cos(a)); const [u, v] = uvc(coat, j / 18, t);
      return { p, u, v, w, c: new THREE.Color().lerpColors(new THREE.Color(1, 1, 1), new THREE.Color(K.belly).multiplyScalar(1.4), bel * 0.5), r: 0.75 };
    }, { wrap: true, flat: 0.25, rough: 0.75 });
    // neck and head: tubes with frames perpendicular to their axis
    const nc = [J.neck1.clone().add(new V3(0, -0.16 * s, -0.16 * s)), J.neck1, J.neck2, J.head.clone().add(new V3(0, -0.02 * s, -0.04 * s))];
    const tubeQ = (pts, rows, cols, radius, wt, uvr, colf, o = {}) => {
      const T = new V3(), N1 = new V3(), N2 = new V3(), X = new V3(1, 0, 0);
      return surf(mb, rows, cols, (i, j) => {
        const t = i / (rows - 1), f = t * (pts.length - 1), seg = Math.min(pts.length - 2, Math.floor(f)), k = f - seg;
        const c = pts[seg].clone().lerp(pts[seg + 1], k);
        T.subVectors(pts[seg + 1], pts[seg]).normalize(); N2.crossVectors(T, X).normalize(); N1.crossVectors(N2, T).normalize();
        const a = j / (cols - 1) * TAU, [rx, ry] = radius(t, a);
        const p = c.addScaledVector(X, Math.sin(a) * rx).addScaledVector(N2, -Math.cos(a) * ry);
        const [u, v] = uvc(uvr, j / (cols - 1), t);
        return { p, u, v, w: wt(t), c: colf ? colf(t, a) : undefined, r: 0.75 };
      }, Object.assign({ wrap: true, flat: 0.25, rough: 0.75 }, o));
    };
    tubeQ(nc, 11, 15, t => { const r = lerp(0.24, 0.1, Math.pow(t, 0.7)) * s * (0.7 + 0.3 * K.girth); return [r * 0.55, r * 1.05]; },
      t => t < 0.35 ? Wq2('chest', 'neck1', t / 0.35) : t < 0.75 ? Wq2('neck1', 'neck2', (t - 0.35) / 0.4) : Wq2('neck2', 'head', (t - 0.75) / 0.25), coat);
    const hd = J.head, hl = K.headL * s, muzzle = hd.clone().add(new V3(0, -hl * 0.74, hl * 0.72));
    tubeQ([hd.clone().add(new V3(0, 0.03 * s, -0.05 * s)), hd.clone().add(new V3(0, -hl * 0.25, hl * 0.3)), muzzle], 12, 13,
      (t, a) => { const jaw = 1 + 0.45 * gauss(t - 0.2, 0.14) * Math.max(0, Math.cos(a)); return [lerp(0.1, 0.055, t) * s * (1 + 0.2 * gauss(t - 0.1, 0.1)), lerp(0.13, 0.065, Math.pow(t, 0.8)) * s * jaw]; },
      () => Wq('head'), coat, (t, a) => { const eye = gauss(t - 0.14, 0.05) * gauss(Math.abs(Math.sin(a)) - 0.92, 0.12) * (Math.cos(a) < 0 ? 1 : 0); const muz = sstep(0.72, 0.95, t); return new THREE.Color(1, 1, 1).multiplyScalar(1 - eye * 0.92 - muz * 0.45); },
      { capEnd: { p: muzzle.clone().add(new V3(0, -0.01 * s, 0.03 * s)), n: new V3(0, -0.6, 1).normalize(), w: Wq('head'), u: uvc(dark, 0.5, 0.5)[0], v: uvc(dark, 0.5, 0.5)[1], c: new THREE.Color(0.35, 0.3, 0.3) } });
    for (const L of ['L', 'R']) {
      const sd = L === 'L' ? 1 : -1, e = J['ear' + L];
      surf(mb, 4, 7, (i, j) => { const t = i / 3, a = j / 6 * TAU, r = (1 - t) * 0.028 * s; const [u, v] = uvc(dark, 0.5, t); return { p: e.clone().add(new V3(sd * 0.01 * s * t + Math.cos(a) * r * 0.5, t * 0.12 * s * (kind === 'deer' ? 1.1 : 1), Math.sin(a) * r)), u, v, w: Wq('ear' + L), r: 0.8 }; }, { wrap: true, flat: 0.3 });
    }
    // legs
    for (const L of ['FL', 'FR', 'BL', 'BR']) {
      const back = L[0] === 'B', pts = [J['up' + L].clone().add(new V3(0, 0.12 * s, 0)), J['lo' + L], J['can' + L], J['hoof' + L]];
      const rad = [0.13, 0.07, 0.042, 0.034].map(r => r * s * (back ? 1.15 : 1) * (0.6 + 0.4 * K.girth));
      surf(mb, 13, 11, (i, j) => {
        const t = i / 12, seg = Math.min(2, Math.floor(t * 3)), k = t * 3 - seg, c = pts[seg].clone().lerp(pts[seg + 1], k), r = lerp(rad[seg], rad[seg + 1], Math.pow(k, seg ? 1 : 0.6)) * (1 + 0.3 * gauss(k - 0.02, 0.08) * (seg ? 1 : 0));
        const a = j / 10 * TAU, p = c.add(new V3(Math.sin(a) * r * 0.8, 0, Math.cos(a) * r));
        const bn = ['up', 'lo', 'can'][seg] + L, nx = ['lo', 'can', 'hoof'][seg] + L;
        const lower = t > 0.62;
        const [u, v] = uvc(lower ? dark : coat, j / 10, 1 - t);
        return { p, u, v, w: k > 0.85 ? Wq2(bn, nx, (k - 0.85) / 0.3) : Wq(bn), r: 0.8 };
      }, { wrap: true, flat: 0.3, rough: 0.8 });
      const hf = J['hoof' + L];
      surf(mb, 3, 11, (i, j) => { const a = j / 10 * TAU, r = (0.042 + i * 0.006) * s; const [u, v] = uvc(dark, j / 10, 0.5); return { p: hf.clone().add(new V3(Math.sin(a) * r * 0.85, -0.07 * s + (2 - i) * 0.035 * s, Math.cos(a) * r + 0.008 * s)), u, v, w: Wq('hoof' + L), c: new THREE.Color(0.4, 0.36, 0.34), r: 0.5 }; }, { wrap: true, flat: 0.4, capStart: { p: hf.clone().add(new V3(0, -0.07 * s, 0.008 * s)), n: new V3(0, -1, 0), w: Wq('hoof' + L), u: 0, v: 0, c: new THREE.Color(0.3, 0.28, 0.27) } });
    }
    // mane and tail
    const ma = uvc(mane, 0.5, 0.5);
    for (let k = 0; k < 16; k++) {
      const t = k / 15, c = nc[Math.min(2, Math.floor(t * 3))].clone().lerp(nc[Math.min(3, Math.floor(t * 3) + 1)], (t * 3) % 1);
      const r0 = lerp(0.24, 0.1, Math.pow(t, 0.7)) * s * (0.7 + 0.3 * K.girth), top = c.clone().add(new V3(0, r0 * 0.75, -r0 * 0.6));
      const side = (k % 2 ? 1 : -1) * 0.5, pts = [];
      for (let q = 0; q < 5; q++) pts.push(top.clone().add(new V3(side * 0.03 * s * q, -0.035 * s * q * q * 0.5, -0.02 * s * q)));
      CharHair.clump({ mb, A }, pts, new V3(0, 0, 1), { region: mane, w: (kind === 'deer' ? 0.03 : 0.07) * s, th: 0.02 * s, c: new THREE.Color(1, 1, 1), u0: R(), wt: () => t < 0.5 ? Wq('neck1') : Wq('neck2') });
    }
    for (let k = 0; k < (kind === 'deer' ? 4 : 10); k++) {
      const pts = [], sp = (R() - 0.5) * 0.06 * s;
      for (let q = 0; q < 7; q++) { const t = q / 6; pts.push(J.tail0.clone().add(new V3(sp * t, -t * (kind === 'deer' ? 0.25 : 0.75) * s, -0.06 * s * Math.sin(t * 2) - 0.02 * s))); }
      CharHair.clump({ mb, A }, pts, new V3(1, 0, 0), { region: mane, w: (kind === 'deer' ? 0.05 : 0.06) * s, th: 0.025 * s, c: new THREE.Color(1, 1, 1), u0: R(), wt: t => Wq2('tail0', 'tail1', t) });
    }
    if (K.antlers) for (const sd of [1, -1]) {                         // sambar stag: three-tined antlers
      const b = J.head.clone().add(new V3(sd * 0.045 * s, 0.07 * s, 0.02 * s)), main = [b];
      for (let q = 1; q <= 5; q++) main.push(b.clone().add(new V3(sd * q * 0.03 * s, q * 0.075 * s, -q * 0.015 * s)));
      CharDress.tube({ mb, A }, main, t => (0.018 - t * 0.012) * s, '#6a5a44', Wq('head'), { cols: 5 });
      CharDress.tube({ mb, A }, [main[1], main[1].clone().add(new V3(sd * 0.02 * s, 0.03 * s, 0.1 * s))], t => (0.012 - t * 0.008) * s, '#6a5a44', Wq('head'), { cols: 5 });
      CharDress.tube({ mb, A }, [main[4], main[4].clone().add(new V3(-sd * 0.02 * s, 0.09 * s, 0.03 * s))], t => (0.01 - t * 0.007) * s, '#6a5a44', Wq('head'), { cols: 5 });
    }
    if (K.saddle) {                                                    // stock saddle, blanket, bridle and reins
      const P = (g, m, w, col) => CharDress.prim({ mb, A }, g, m, w, col, { fab: 'leather' });
      const at = (p, e = [0, 0, 0], sc = [1, 1, 1]) => new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromEuler(new THREE.Euler(...e)), new V3(...sc));
      P(new THREE.BoxGeometry(0.52 * s, 0.03 * s, 0.62 * s), at(new V3(0, bodyY + 0.225 * s, 0.05 * s)), Wq('body'), '#6a2a24');
      P(new RoundedBoxGeometry(0.42 * s, 0.1 * s, 0.5 * s, 2, 0.04 * s), at(new V3(0, bodyY + 0.27 * s, 0.05 * s)), Wq('body'), '#5a3620');
      P(new THREE.CylinderGeometry(0.025 * s, 0.03 * s, 0.1 * s, 8), at(new V3(0, bodyY + 0.34 * s, 0.25 * s)), Wq('body'), '#4a2c1a');
      for (const sd of [1, -1]) { CharDress.tube({ mb, A }, [new V3(sd * 0.2 * s, bodyY + 0.24 * s, 0.1 * s), new V3(sd * 0.23 * s, bodyY - 0.1 * s, 0.12 * s), new V3(sd * 0.17 * s, bodyY - 0.28 * s, 0.14 * s)], 0.012 * s, '#3a2418', Wq('body'), { flatten: 0.3 }); P(new THREE.BoxGeometry(0.02 * s, 0.07 * s, 0.07 * s), at(new V3(sd * 0.2 * s, bodyY - 0.14 * s, 0.1 * s)), Wq('body'), '#8a8a86'); }
      const muzzle = J.head.clone().add(new V3(0, -hl * 0.6, hl * 0.62));
      for (const sd of [1, -1]) {
        CharDress.tube({ mb, A }, [J.head.clone().add(new V3(sd * 0.08 * s, 0.03 * s, 0.0)), J.head.clone().add(new V3(sd * 0.075 * s, -hl * 0.3, hl * 0.3)), muzzle.clone().add(new V3(sd * 0.055 * s, 0, 0))], 0.008 * s, '#2a1a12', Wq('head'), { flatten: 0.4 });
        CharDress.tube({ mb, A }, [muzzle.clone().add(new V3(sd * 0.055 * s, 0, 0)), J.neck2.clone().add(new V3(sd * 0.1 * s, 0.02 * s, 0.05 * s)), J.reins.clone().add(new V3(sd * 0.08 * s, 0.05 * s, 0))], 0.006 * s, '#2a1a12', (p, t) => t < 0.5 ? Wq('head') : Wq('neck1'), { flatten: 0.5 });
      }
    }
    const tex = new THREE.CanvasTexture(A.cv); tex.colorSpace = THREE.SRGBColorSpace;
    for (const k in A.R) CharPaintAtlas(A, A.R[k]);
    tex.needsUpdate = true;
    const mat = CharBody.patchBody(new THREE.MeshStandardMaterial({ map: tex, vertexColors: true, roughness: 1 }));
    const body = new THREE.SkinnedMesh(mb.geometry(), mat);
    body.castShadow = body.receiveShadow = true;
    root.add(body); body.bind(skeleton, new THREE.Matrix4());
    body.boundingSphere = new THREE.Sphere(new V3(0, K.H * 0.5, 0), K.H * 1.3);
    Engine.scene.add(root);
    const bindPos = {}; for (const k in bones) bindPos[k] = bones[k].position.clone();
    return {
      quad: true, kind, K, name: o.name || kind, root, bones, bindPos, skeleton, body, mat, tex, height: K.H, D: { H: K.H, s, hs: s, headO: J.head },
      loco: { v: 0, target: 0, phase: 0, dir: new V3(0, 0, 1), crouch: false, carry: false, limp: false, turnRate: 0 }, look: { target: null, yaw: 0, pitch: 0 },
      poseName: 'stand', poseT: 1, poseFrom: 'stand', t: R() * 10, mv: null, turn: null, riders: [], speaking: false, springs: [], heldP: {}, grip: {}, persistent: false,
      get yaw() { return root.rotation.y; }, set yaw(v) { root.rotation.y = v; },
    };
  }
  function CharPaintAtlas(A, r) { CharPaint.paintRegion(A, r, r.spec, { seed: 7 }); }

  // ---- animation ----------------------------------------------------------------------------------------------
  const e = new THREE.Euler();
  const rot = (b, x, y = 0, z = 0) => { e.set(x, y, z, 'YXZ'); b.quaternion.setFromEuler(e); };
  const PHASE = { walk: { FL: 0.25, FR: 0.75, BL: 0, BR: 0.5 }, trot: { FL: 0, FR: 0.5, BL: 0.5, BR: 0 }, gallop: { FL: 0.45, FR: 0.35, BL: 0, BR: 0.1 } };
  function frame(c, dt) {
    const L = c.loco, B = c.bones, s = c.D.s;
    L.v += (L.target - L.v) * (1 - Math.exp(-4 * dt));
    const v = L.v, gait = v < 2.2 ? 'walk' : v < 5 ? 'trot' : 'gallop';
    const hz = v < 0.05 ? 0 : gait === 'walk' ? 0.55 + v * 0.25 : gait === 'trot' ? 1.3 + (v - 2.2) * 0.1 : 1.8 + (v - 5) * 0.06;
    L.phase = (L.phase + hz * dt) % 1;
    const move = sstep(0.03, 0.4, v), amp = gait === 'walk' ? 0.28 : gait === 'trot' ? 0.42 : 0.62;
    // pose blend (stand / graze / lie / dead)
    c.poseT = Math.min(1, c.poseT + dt / 1.2);
    const pw = n => (c.poseName === n ? c.poseT : 0) + (c.poseFrom === n ? 1 - c.poseT : 0);
    const graze = pw('graze'), lie = pw('lie'), dead = pw('dead'), down = Math.max(lie, dead);
    if (c.poseT >= 1 && c.poseRes) { const r = c.poseRes; c.poseRes = null; r(); }
    const P = PHASE[gait];
    for (const k of ['FL', 'FR', 'BL', 'BR']) {
      const back = k[0] === 'B', ph = (L.phase + P[k]) % 1, sw = Math.sin(ph * TAU), lift = Math.max(0, Math.sin(ph * TAU - 0.6));
      const swing = sw * amp * move;
      rot(B['up' + k], -swing * (back ? 0.8 : 1) + (back ? -0.1 : 0.05) * down + down * (back ? 1.2 : -1.1) * (1 - dead) + dead * 0.3);
      rot(B['lo' + k], (back ? -1 : 1) * (lift * (back ? 0.5 : 0.9) * move) + down * (back ? -2.2 : 2.3) * (1 - dead) + dead * (back ? -0.3 : 0.4));
      rot(B['can' + k], (back ? 1 : -1) * (lift * 0.6 * move) + down * (back ? 1.9 : -1.6) * (1 - dead) + dead * 0.2);
      rot(B['hoof' + k], lift * 0.5 * move);
    }
    const bob = (gait === 'gallop' ? 0.06 : gait === 'trot' ? 0.03 : 0.012) * Math.sin(L.phase * TAU * 2) * move * s;
    B.body.position.set(c.bindPos.body.x, c.bindPos.body.y + bob - down * c.K.H * 0.42 - dead * 0.05 * s, c.bindPos.body.z);
    rot(B.body, (gait === 'gallop' ? 0.06 * Math.sin(L.phase * TAU) : 0) * move, 0, dead * 1.45);
    const breath = Math.sin(c.t * 1.6) * 0.01;
    const headDown = graze * 1.1 + dead * 0.3;
    const lk = c.look.target, want = lk ? Math.atan2(...(() => { const p = (lk.isVector3 ? lk : lk.point ? lk.point('head', new V3()) : lk).clone(); c.root.worldToLocal(p); return [p.x, p.z]; })()) : 0;
    c.look.yaw += (clamp(want, -0.9, 0.9) - c.look.yaw) * (1 - Math.exp(-3 * dt));
    rot(B.neck1, 0.15 + headDown * 0.9 + (gait === 'gallop' ? 0.1 * Math.sin(L.phase * TAU) * move : 0) + breath, c.look.yaw * 0.4 + L.turnRate * 0.05);
    rot(B.neck2, 0.05 + headDown * 0.4 + (gait === 'walk' ? 0.06 * Math.sin(L.phase * TAU * 2) * move : 0), c.look.yaw * 0.4);
    rot(B.head, -0.1 + headDown * 0.2 - dead * 0.5, c.look.yaw * 0.2);
    const tw = Math.sin(c.t * 0.7) * 0.2;
    rot(B.earL, Math.sin(c.t * 0.9) * 0.2, 0, 0.3 + tw); rot(B.earR, Math.sin(c.t * 0.8 + 1) * 0.2, 0, -0.3 - tw);
    rot(B.tail0, 0.3 + move * 0.3 * (gait === 'gallop' ? 1.5 : 1), Math.sin(c.t * 1.3) * 0.25 * (1 - move)); rot(B.tail1, 0.2, Math.sin(c.t * 1.3 + 0.8) * 0.3);
    c.root.updateMatrixWorld(true);
    for (const r of c.riders) seat(c, r.c, r.back, dt);
  }
  // riders: sit astride the saddle; the front rider holds the reins, the back rider holds the front rider's waist
  const _p = new V3();
  function seat(h, r, back, dt) {
    h.bones.body.updateMatrixWorld(true);
    _p.set(0, 0.33 * h.D.s, (back ? -0.28 : 0.04) * h.D.s).applyMatrix4(h.bones.body.matrixWorld);
    r.root.position.set(_p.x, _p.y - r.D.yHips + 0.06 * r.D.s, _p.z);
    r.root.rotation.y = h.root.rotation.y;
    r.root.updateMatrixWorld(true);
    const T = (S, p) => { (r.ikT || (r.ikT = {}))[S] = { p, w: 1 }; };
    if (!back) { const q = h.bones.reins.getWorldPosition(new V3()); for (const [S, sd] of [['L', 1], ['R', -1]]) T(S, q.clone().add(new V3(sd * 0.1, 0.05, 0).applyQuaternion(h.root.quaternion))); }
    else { const f = h.riders.find(x => !x.back); if (f) for (const [S, sd] of [['L', 1], ['R', -1]]) T(S, Gest.bonePt(f.c, 'spine', [sd * 0.13, 0.02, 0.04], new V3())); }
  }
  function mount(horse, rider, back) {
    if (!horse || !horse.quad) return;
    horse.riders = horse.riders.filter(x => x.c !== rider).concat([{ c: rider, back }]);
    rider.mount = horse; rider.stop();
    Gest.pose(rider, 'ride', { direct: true, dur: 0.5 });
  }
  function dismount(rider) { const h = rider.mount; if (!h) return; h.riders = h.riders.filter(x => x.c !== rider); rider.mount = null; rider.ikT = {}; rider.root.position.y = World.groundAt(rider.root.position.x, rider.root.position.z, rider.root.position.y + 1, 0.1); Gest.pose(rider, 'stand', { direct: true }); }

  // human-only calls are no-ops on animals; poses and disposal are their own
  const res = () => Promise.resolve();
  const API = {
    emote() {}, speak() {}, blink() {}, gesture: res, hold() { return null; }, drop() { return null; }, decal() {}, badge() {}, phoneGlow() {}, setPart() {}, outfit() {},
    attach() {}, detach() { for (const r of [...this.riders]) dismount(r.c); },
    pose(name) { const n = ['graze', 'lie', 'dead'].includes(name) ? name : 'stand'; if (n === this.poseName) return res(); this.poseFrom = this.poseName; this.poseName = n; this.poseT = 0; if (this.poseRes) this.poseRes(); return new Promise(r => { this.poseRes = r; }); },
    anim(name) { return this.pose(name === 'die' ? 'dead' : name); },
    point(name, out = new V3()) { const b = name === 'head' || name === 'eyes' ? this.bones.head : name === 'feet' ? null : this.bones.body; if (!b) return out.copy(this.root.position); b.updateWorldMatrix(true, false); return out.setFromMatrixPosition(b.matrixWorld); },
    dispose() { this.detach(); if (this.root.parent) this.root.parent.remove(this.root); this.body.geometry.dispose(); this.mat.dispose(); this.tex.dispose(); },
  };
  return { kinds, create, frame, mount, dismount, API };
})();
