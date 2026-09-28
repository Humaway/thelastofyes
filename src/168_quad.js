// ============================================================================
// Quad — quadrupeds for Chars (chars agent): 'horse' (the brumby Chloe calls Horse, saddled and bridled) and
// 'deer' (a sambar stag). Same Character interface as people (Chars adds the shared API); human-only calls
// (emote, speak, gesture, hold, badge...) are harmless no-ops. Poses: stand graze lie dead. Gaits from speed:
// walk (4-beat), trot (diagonal pairs), gallop (rotary). Riders: rider.attach(horse, 'ride' | 'ride_back').
// The trunk, neck and head are one distance-field sculpt (CharHead.sd primitives) meshed with surface nets;
// legs are lofted along their joints (forearm, knee, cannon, fetlock, pastern, hoof); mane and tail are sheets.
//   Quad.kinds · Quad.create(kind, o) · Quad.frame(c, dt) · Quad.mount(horse, rider, back) · Quad.dismount(rider) · Quad.API
// ============================================================================
const Quad = (() => {
  const V3 = THREE.Vector3;
  const { MB, surf, TAU, lerp, sstep, gauss, clamp } = CharBody;
  const { ell, cap, smin } = CharHead.sd;
  // anatomy (metres, standing, facing +Z): joints, trunk/neck/head primitives [k, kind, ...], leg radii, bounds
  const kinds = {
    horse: { H: 1.45, coat: '#6b4226', dark: '#1e1612', belly: '#8a6040', mane: '#1a1410', hoof: '#2a2522', ear: 0.12, saddle: true, points: 0.62, h: 0.022,
      box: [0.36, 0.6, 2.02, -0.98, 1.76],
      J: { body: [0, 1.04, 0], hips: [0, 1.12, -0.46], chest: [0, 1.1, 0.42], neck1: [0, 1.3, 0.62], neck2: [0, 1.52, 0.86], head: [0, 1.76, 1.1], reins: [0, 1.42, 0.52],
        earL: [0.05, 1.84, 1.09], tail0: [0, 1.3, -0.77], tail1: [0, 1.0, -0.86],
        upF: [0.15, 0.94, 0.5], loF: [0.14, 0.5, 0.53], canF: [0.13, 0.21, 0.55], hoofF: [0.13, 0.075, 0.56],
        upB: [0.17, 0.96, -0.38], loB: [0.145, 0.55, -0.64], canB: [0.135, 0.21, -0.6], hoofB: [0.13, 0.075, -0.59] },
      prims: [[0, 'E', 0, 1.06, -0.04, 0.265, 0.31, 0.6], [0.08, 'E', 0, 1.1, 0.42, 0.22, 0.3, 0.3], [0.06, 'E', 0, 1.0, 0.6, 0.15, 0.19, 0.14], [0.05, 'E', 0.13, 1.17, 0.46, 0.085, 0.26, 0.16],
        [0.08, 'E', 0, 1.33, 0.32, 0.08, 0.13, 0.24], [0.08, 'E', 0, 1.18, -0.48, 0.235, 0.27, 0.3], [0.06, 'E', 0.13, 1.26, -0.46, 0.11, 0.17, 0.26], [0.06, 'E', 0.14, 1.0, -0.56, 0.1, 0.26, 0.17],
        [0.05, 'E', 0.165, 0.9, -0.42, 0.07, 0.17, 0.12], [0.05, 'E', 0.155, 0.9, 0.49, 0.065, 0.14, 0.09],
        [0.07, 'C', 0, 1.22, 0.58, 0, 1.66, 1.02, 0.2, 0.095, 1.55], [0.05, 'C', 0, 1.42, 0.5, 0, 1.75, 0.98, 0.07, 0.05, 1.4], [0.05, 'E', 0, 1.56, 1.04, 0.065, 0.1, 0.1],
        [0.05, 'E', 0, 1.77, 1.15, 0.092, 0.095, 0.12], [0.04, 'E', 0.062, 1.63, 1.15, 0.048, 0.1, 0.11], [0.04, 'C', 0, 1.74, 1.26, 0, 1.47, 1.54, 0.07, 0.052, 1.12],
        [0.04, 'E', 0, 1.43, 1.575, 0.068, 0.072, 0.08], [0.02, 'E', 0, 1.365, 1.53, 0.048, 0.03, 0.06], [0.02, 'E', 0.042, 1.45, 1.62, 0.022, 0.028, 0.03],
        [0.01, 'E', 0.092, 1.735, 1.24, 0.02, 0.017, 0.02], [0.04, 'C', 0, 1.33, -0.7, 0, 1.22, -0.82, 0.06, 0.045, 1]],
      neck: [[0, 1.25, 0.6], [0, 1.76, 1.1]], face: [[0, 1.76, 1.1], [0, 1.43, 1.57]], eye: [0.098, 1.735, 1.245, 0.017], muzzle: [0, 1.42, 1.57],
      legF: [0.075, 0.066, 0.046, 0.052, 0.033, 0.043, 0.033, 0.044], legB: [0.08, 0.06, 0.052, 0.034, 0.043, 0.033, 0.044] },
    deer: { H: 1.3, coat: '#6a5a46', dark: '#2e2820', belly: '#c2b49a', mane: '#4a3e30', hoof: '#15120f', ear: 0.16, antlers: true, points: 0.4, rump: true, h: 0.018,
      box: [0.28, 0.6, 1.82, -0.8, 1.36],
      J: { body: [0, 0.93, 0], hips: [0, 1.0, -0.4], chest: [0, 0.98, 0.34], neck1: [0, 1.15, 0.5], neck2: [0, 1.33, 0.66], head: [0, 1.58, 0.88], reins: [0, 1.25, 0.42],
        earL: [0.042, 1.65, 0.86], tail0: [0, 1.12, -0.64], tail1: [0, 0.98, -0.68],
        upF: [0.11, 0.82, 0.4], loF: [0.1, 0.46, 0.42], canF: [0.095, 0.18, 0.43], hoofF: [0.095, 0.055, 0.44],
        upB: [0.12, 0.84, -0.32], loB: [0.105, 0.5, -0.52], canB: [0.1, 0.18, -0.49], hoofB: [0.1, 0.055, -0.48] },
      prims: [[0, 'E', 0, 0.95, -0.02, 0.19, 0.24, 0.5], [0.07, 'E', 0, 0.98, 0.34, 0.16, 0.24, 0.24], [0.05, 'E', 0, 0.9, 0.5, 0.11, 0.15, 0.1], [0.04, 'E', 0.1, 1.04, 0.38, 0.06, 0.2, 0.12],
        [0.06, 'E', 0, 1.18, 0.26, 0.06, 0.1, 0.2], [0.07, 'E', 0, 1.05, -0.4, 0.18, 0.22, 0.25], [0.05, 'E', 0.1, 1.12, -0.38, 0.08, 0.14, 0.2], [0.05, 'E', 0.1, 0.9, -0.46, 0.075, 0.2, 0.13],
        [0.04, 'E', 0.12, 0.8, -0.34, 0.05, 0.13, 0.09], [0.04, 'E', 0.11, 0.8, 0.4, 0.045, 0.11, 0.07],
        [0.06, 'C', 0, 1.08, 0.48, 0, 1.5, 0.8, 0.14, 0.075, 1.4], [0.04, 'C', 0, 1.22, 0.42, 0, 1.56, 0.76, 0.05, 0.04, 1.3], [0.04, 'E', 0, 1.42, 0.82, 0.05, 0.08, 0.08],
        [0.04, 'E', 0, 1.6, 0.9, 0.07, 0.075, 0.09], [0.03, 'E', 0.045, 1.5, 0.9, 0.035, 0.07, 0.08], [0.03, 'C', 0, 1.57, 0.99, 0, 1.37, 1.2, 0.052, 0.032, 1.1],
        [0.03, 'E', 0, 1.35, 1.22, 0.04, 0.045, 0.05], [0.015, 'E', 0, 1.31, 1.18, 0.03, 0.02, 0.04], [0.015, 'E', 0.025, 1.36, 1.25, 0.013, 0.017, 0.018],
        [0.008, 'E', 0.065, 1.59, 0.97, 0.016, 0.014, 0.016], [0.03, 'C', 0, 1.14, -0.6, 0, 1.02, -0.66, 0.045, 0.035, 1]],
      neck: [[0, 1.12, 0.48], [0, 1.58, 0.88]], face: [[0, 1.58, 0.88], [0, 1.34, 1.23]], eye: [0.068, 1.59, 0.975, 0.013], muzzle: [0, 1.34, 1.23],
      legF: [0.055, 0.046, 0.03, 0.036, 0.021, 0.028, 0.02, 0.028], legB: [0.058, 0.042, 0.036, 0.022, 0.028, 0.02, 0.028] },
  };
  const BONES = ['body', 'hips', 'chest', 'neck1', 'neck2', 'head', 'tail0', 'tail1', 'earL', 'earR', 'reins'];
  for (const L of ['FL', 'FR', 'BL', 'BR']) BONES.push('up' + L, 'lo' + L, 'can' + L, 'hoof' + L);
  const BI = Object.fromEntries(BONES.map((n, i) => [n, i]));
  const Wq = n => [[BI[n], 1]], Wq2 = (a, b, t) => t <= 0.001 ? Wq(a) : t >= 0.999 ? Wq(b) : [[BI[a], 1 - t], [BI[b], t]];
  const PARENT = { body: null, hips: 'body', chest: 'body', neck1: 'chest', neck2: 'neck1', head: 'neck2', earL: 'head', earR: 'head', reins: 'neck1', tail0: 'hips', tail1: 'tail0' };
  for (const L of ['FL', 'FR']) Object.assign(PARENT, { ['up' + L]: 'chest', ['lo' + L]: 'up' + L, ['can' + L]: 'lo' + L, ['hoof' + L]: 'can' + L });
  for (const L of ['BL', 'BR']) Object.assign(PARENT, { ['up' + L]: 'hips', ['lo' + L]: 'up' + L, ['can' + L]: 'lo' + L, ['hoof' + L]: 'can' + L });

  // trunk + neck + head distance field (x mirrored); 'C' = tapered capsule squeezed sideways by its last value
  function sdfOf(K, s) {
    const P = K.prims.map(p => p.map((v, i) => i >= 2 && typeof v === 'number' && !(p[1] === 'C' && i === 10) ? v * s : v));
    return (x, y, z) => {
      const ax = Math.abs(x);
      let d = 1;
      for (const p of P) {
        const v = p[1] === 'E' ? ell(ax, y, z, p[2], p[3], p[4], p[5], p[6], p[7]) : cap(ax * p[10], y, z, p[2], p[3], p[4], p[5], p[6], p[7], p[8], p[9]) / p[10];
        d = p[0] ? smin(d, v, p[0] * s) : v;
      }
      return d;
    };
  }

  // naive surface nets over the box: one vertex per sign-changing cell, a quad per sign-changing grid edge
  function nets(f, x0, y0, z0, nx, ny, nz, h) {
    const V = new Float32Array(nx * ny * nz), id = (i, j, k) => i + nx * (j + ny * k);
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) V[id(i, j, k)] = f(x0 + i * h, y0 + j * h, z0 + k * h);
    const cx = nx - 1, cy = ny - 1, cid = (i, j, k) => i + cx * (j + cy * k), vid = new Int32Array(cx * cy * (nz - 1)).fill(-1), P = [], Q = [];
    const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]], c = new Float32Array(8);
    for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
      let neg = 0;
      for (let q = 0; q < 8; q++) { c[q] = V[id(i + (q & 1), j + ((q >> 1) & 1), k + (q >> 2))]; if (c[q] < 0) neg++; }
      if (neg === 0 || neg === 8) continue;
      let sx = 0, sy = 0, sz = 0, n = 0;
      for (const [a, b] of E) {
        if ((c[a] < 0) === (c[b] < 0)) continue;
        const t = c[a] / (c[a] - c[b]);
        sx += (a & 1) + t * ((b & 1) - (a & 1)); sy += ((a >> 1) & 1) + t * (((b >> 1) & 1) - ((a >> 1) & 1)); sz += (a >> 2) + t * ((b >> 2) - (a >> 2)); n++;
      }
      vid[cid(i, j, k)] = P.length / 3; P.push(x0 + (i + sx / n) * h, y0 + (j + sy / n) * h, z0 + (k + sz / n) * h);
    }
    // quads: for each grid edge with a sign change, the four cells around it (oriented from inside to outside)
    const quad = (a, b, cc, d, flip) => { if (a < 0 || b < 0 || cc < 0 || d < 0) return; flip ? Q.push(a, cc, b, a, d, cc) : Q.push(a, b, cc, a, cc, d); };
    for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const s0 = V[id(i, j, k)] < 0; if (s0 === (V[id(i + 1, j, k)] < 0)) continue;
      quad(vid[cid(i, j - 1, k - 1)], vid[cid(i, j, k - 1)], vid[cid(i, j, k)], vid[cid(i, j - 1, k)], s0);
    }
    for (let k = 1; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
      const s0 = V[id(i, j, k)] < 0; if (s0 === (V[id(i, j + 1, k)] < 0)) continue;
      quad(vid[cid(i - 1, j, k - 1)], vid[cid(i - 1, j, k)], vid[cid(i, j, k)], vid[cid(i, j, k - 1)], s0);
    }
    for (let k = 0; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
      const s0 = V[id(i, j, k)] < 0; if (s0 === (V[id(i, j, k + 1)] < 0)) continue;
      quad(vid[cid(i - 1, j - 1, k)], vid[cid(i, j - 1, k)], vid[cid(i, j, k)], vid[cid(i - 1, j, k)], s0);
    }
    return { P, Q };
  }

  // distance of p to segment ab and the parameter along it
  const _s = new V3();
  function seg(p, a, b) { _s.subVectors(b, a); const t = clamp(new V3().subVectors(p, a).dot(_s) / _s.lengthSq(), 0, 1); return [p.distanceTo(a.clone().addScaledVector(_s, t)), t]; }

  function create(kind, o = {}) {
    const K = kinds[kind], s = K.H / (kind === 'horse' ? 1.45 : 1.3), R = CharPaint.rng((o.seed ?? 3) * 91 + 1);
    const J = {}; for (const n of ['body', 'hips', 'chest', 'neck1', 'neck2', 'head', 'reins', 'earL', 'tail0', 'tail1']) J[n] = new V3(...K.J[n]).multiplyScalar(s);
    J.earR = J.earL.clone(); J.earR.x *= -1;
    for (const [L, sx] of [['FL', 1], ['FR', -1], ['BL', 1], ['BR', -1]]) for (const b of ['up', 'lo', 'can', 'hoof']) { J[b + L] = new V3(...K.J[b + L[0]]).multiplyScalar(s); J[b + L].x *= sx; }
    const bones = {}, list = [];
    for (const n of BONES) { const b = new THREE.Bone(); b.name = n; bones[n] = b; list.push(b); }
    for (const n of BONES) { const p = PARENT[n]; bones[n].position.copy(J[n]); if (p) { bones[n].position.sub(J[p]); bones[p].add(bones[n]); } }
    const root = new THREE.Group(); root.add(bones.body); bones.body.updateMatrixWorld(true);
    const skeleton = new THREE.Skeleton(list);
    const A = CharBody.Atlas(512), mb = new MB();
    const coat = A.alloc('coat', 512, 256, { t: 'coat', color: K.coat }), dark = A.alloc('dark', 256, 128, { t: 'coat', color: K.dark }), mane = A.alloc('mane', 256, 256, { t: 'hair', color: K.mane });
    const f = sdfOf(K, s), X = K.box.map(v => v * s), h = K.h * s;
    // trunk, neck and head
    const nx = Math.ceil(2 * X[0] / h) + 1, ny = Math.ceil((X[2] - X[1]) / h) + 1, nz = Math.ceil((X[4] - X[3]) / h) + 1;
    const { P, Q } = nets(f, -X[0], X[1], X[3], nx, ny, nz, h);
    const N0 = new V3(...K.neck[0]).multiplyScalar(s), N1 = new V3(...K.neck[1]).multiplyScalar(s), F0 = new V3(...K.face[0]).multiplyScalar(s), F1 = new V3(...K.face[1]).multiplyScalar(s);
    const eye = new V3(...K.eye).multiplyScalar(s), er = K.eye[3] * s, mz = new V3(...K.muzzle).multiplyScalar(s), p = new V3(), n = new V3(), e = 0.004 * s, base = mb.n;
    const white = new THREE.Color(1, 1, 1), bellyC = new THREE.Color(K.belly), coatC = new THREE.Color(K.coat), col = new THREE.Color();
    const zA = X[3], zB = X[4];
    for (let i = 0; i < P.length; i += 3) {
      p.set(P[i], P[i + 1], P[i + 2]);
      n.set(f(p.x + e, p.y, p.z) - f(p.x - e, p.y, p.z), f(p.x, p.y + e, p.z) - f(p.x, p.y - e, p.z), f(p.x, p.y, p.z + e) - f(p.x, p.y, p.z - e)).normalize();
      const [dh, th] = seg(p, F0, F1), [dn, tn] = seg(p, N0, N1);
      let w;
      if (th > 0.02 && dh < 0.13 * s) w = Wq('head');
      else if (p.z > N0.z - 0.06 * s && p.y > N0.y - 0.08 * s && dn < 0.26 * s) w = tn < 0.4 ? Wq2('chest', 'neck1', sstep(0.05, 0.4, tn)) : tn < 0.85 ? Wq2('neck1', 'neck2', sstep(0.4, 0.8, tn)) : Wq2('neck2', 'head', sstep(0.85, 1, tn));
      else if (p.z < J.tail0.z + 0.04 * s) w = Wq2('hips', 'tail0', sstep(J.tail0.z + 0.04 * s, J.tail0.z - 0.05 * s, p.z) * 0.8);
      else w = p.z < -0.1 * s ? Wq2('body', 'hips', sstep(-0.1 * s, -0.35 * s, p.z)) : Wq2('body', 'chest', sstep(0.12 * s, 0.35 * s, p.z));
      // colour zones: lighter belly (and the deer's rump patch), dark eyes, dark muzzle
      const under = sstep(0.1, -0.7, n.y) * sstep(0.95 * s, 0.85 * s, p.y) * (p.z < N0.z ? 1 : 0.3);
      const rump = K.rump ? sstep(0.2, -0.6, n.z) * sstep(0.1 * s, 0.03 * s, Math.abs(p.x)) * sstep(0.85 * s, 1.0 * s, p.y) * (p.z < -0.4 * s ? 1 : 0) : 0;
      col.copy(white).lerp(new THREE.Color(bellyC.r / coatC.r, bellyC.g / coatC.g, bellyC.b / coatC.b), Math.max(under, rump * 1.3) * 0.9);
      const de = Math.hypot(Math.abs(p.x) - eye.x, p.y - eye.y, p.z - eye.z), dm = p.distanceTo(mz);
      col.multiplyScalar(1 - 0.9 * sstep(er * 1.6, er * 0.9, de)).multiplyScalar(1 - 0.55 * sstep(0.1 * s, 0.03 * s, dm));
      const [u, v] = A.uv(coat, (p.z - zA) / (zB - zA), (p.y - X[1]) / (X[2] - X[1]));
      mb.v(p, n, u, v, col, w, 0.75 - 0.5 * sstep(er * 1.4, er, de));
    }
    for (let i = 0; i < Q.length; i += 3) mb.tri(base + Q[i], base + Q[i + 1], base + Q[i + 2]);
    // legs: from inside the trunk down through elbow/stifle, knee/hock, fetlock, pastern to the coronet
    for (const L of ['FL', 'FR', 'BL', 'BR']) {
      const back = L[0] === 'B', sd = L[1] === 'L' ? 1 : -1, radii = (back ? K.legB : K.legF).map(r => r * s);
      const up = J['up' + L], lo = J['lo' + L], ca = J['can' + L], ho = J['hoof' + L];
      const pts = back ? [up.clone().add(new V3(0, 0.1 * s, 0.03 * s)), up, lo.clone().lerp(up, 0.5), lo, ca.clone().lerp(lo, 0.25), ca, ho.clone().lerp(ca, 0.45), ho.clone().add(new V3(0, 0.012 * s, 0))]
        : [up.clone().add(new V3(0, 0.12 * s, 0)), up, lo.clone().lerp(up, 0.3), lo, ca.clone().lerp(lo, 0.25), ca, ho.clone().lerp(ca, 0.45), ho.clone().add(new V3(0, 0.012 * s, 0))];
      const rr = back ? [radii[0] * 1.05, radii[0], radii[1], radii[2], radii[3], radii[4], radii[5], radii[6]] : radii;
      const bn = back ? ['up', 'up', 'up', 'lo', 'lo', 'can', 'can', 'hoof'] : ['up', 'up', 'up', 'lo', 'lo', 'can', 'can', 'hoof'];
      const curve = new THREE.CatmullRomCurve3(pts), rows = 22, cols = 12, T = new V3(), B1 = new V3(), B2 = new V3();
      surf(mb, rows, cols, (i, j) => {
        const t = i / (rows - 1), c = curve.getPoint(t), k = t * (pts.length - 1), a = Math.min(pts.length - 2, Math.floor(k)), q = k - a;
        curve.getTangent(t, T); B1.set(1, 0, 0).addScaledVector(T, -T.x).normalize(); B2.crossVectors(T, B1).normalize();
        const r = lerp(rr[a], rr[a + 1], q), th = j / (cols - 1) * TAU, narrow = t > 0.4 ? 0.78 : 0.9;
        const pp = c.clone().addScaledVector(B1, Math.cos(th) * r * narrow).addScaledVector(B2, Math.sin(th) * r * (t > 0.4 && Math.sin(th) < 0 ? 1.15 : 1));
        const bone = bn[Math.min(7, Math.round(k))] + L, lower = t > (back ? 0.5 : 0.42);
        const w = a === 0 ? Wq2(back ? 'hips' : 'chest', 'up' + L, q) : Wq(bone);
        const pointK = sstep(0.35, 0.6, t) * (K.points || 0);
        const [u, v] = A.uv(lower ? dark : coat, j / (cols - 1), 1 - t);
        return { p: pp, u, v, w, c: lower ? white : new THREE.Color(1, 1, 1).multiplyScalar(1 - pointK * 0.5), r: 0.8 };
      }, { wrap: true, rough: 0.8 });
      // hoof: a truncated cone, wider at the ground
      const hr = rr[7] * 1.05, hc = new THREE.Color(K.hoof);
      surf(mb, 3, 14, (i, j) => { const th = j / 13 * TAU, r = hr * (1 + i * 0.12), y = ho.y + 0.012 * s - i * (ho.y + 0.012 * s) / 2; const [u, v] = A.uv(dark, j / 13, 0.5); return { p: new V3(ho.x + Math.cos(th) * r * 0.9, y, ho.z + 0.01 * s + Math.sin(th) * r), u, v, w: Wq('hoof' + L), c: hc.clone().multiplyScalar(1 / new THREE.Color(K.dark).r * 0.5 + 0.5), r: 0.45 }; },
        { wrap: true, rough: 0.45, capEnd: { p: new V3(ho.x, 0.002 * s, ho.z + 0.01 * s), n: new V3(0, -1, 0), w: Wq('hoof' + L), u: 0, v: 0 } });
    }
    // ears: cupped leaves on the poll
    for (const [S, sd] of [['L', 1], ['R', -1]]) {
      const b = J['ear' + S], len = K.ear * s, wd = len * (kind === 'deer' ? 0.42 : 0.32);
      surf(mb, 7, 9, (i, j) => {
        const t = i / 6, a = (j / 8 * 2 - 1), wv = Math.sin(Math.PI * Math.min(1, t * 1.15 + 0.08)) * wd * (1 - t * 0.35);
        const q = b.clone().add(new V3(sd * (0.012 * s * t) + a * wv * 0.5, t * len, 0.018 * s * t - (1 - a * a) * 0.012 * s * Math.sin(t * Math.PI)));
        const [u, v] = A.uv(coat, 0.5 + a * 0.05, 0.9);
        return { p: q, u, v, w: Wq('ear' + S), c: new THREE.Color(1, 1, 1).multiplyScalar(1 - 0.4 * (1 - a * a) * sstep(0.1, 0.5, t)), r: 0.8 };
      }, { rough: 0.8, out: new V3(0, 0, 1) });
      surf(mb, 7, 9, (i, j) => {
        const t = i / 6, a = (j / 8 * 2 - 1), wv = Math.sin(Math.PI * Math.min(1, t * 1.15 + 0.08)) * wd * (1 - t * 0.35);
        const q = b.clone().add(new V3(sd * (0.012 * s * t) + a * wv * 0.5, t * len, 0.018 * s * t - 0.006 * s - (1 - a * a) * 0.006 * s * Math.sin(t * Math.PI)));
        const [u, v] = A.uv(coat, 0.5 + a * 0.05, 0.9);
        return { p: q, u, v, w: Wq('ear' + S), r: 0.8 };
      }, { rough: 0.8, out: new V3(0, 0, -1) });
    }
    // eyes: glossy dark domes
    for (const sd of [1, -1]) CharDress.prim({ mb, A }, new THREE.SphereGeometry(er * 0.95, 10, 8), new THREE.Matrix4().compose(new V3(sd * eye.x, eye.y, eye.z), new THREE.Quaternion(), new V3(0.8, 0.85, 1)), Wq('head'), '#0c0908', { rough: 0.12 });
    // mane (horse): a sheet lying on the right side of the neck from the crest, found on the sculpt; forelock; tail
    const onNeck = (t, th, lift, out) => {                                // neck surface point at axis parameter t, angle th from the top toward -X
      const c = N0.clone().lerp(N1, t), ax = new V3().subVectors(N1, N0).normalize(), up = new V3(0, 1, 0).addScaledVector(ax, -ax.y).normalize();
      const d = up.clone().multiplyScalar(Math.cos(th)).add(new V3(-Math.sin(th), 0, 0)).normalize();
      let r = 0.35 * s; while (r > 0 && f(c.x + d.x * r, c.y + d.y * r, c.z + d.z * r) > 0) r -= 0.003 * s;
      return out.copy(c).addScaledVector(d, r + lift);
    };
    if (kind === 'horse') {
      const rows = 7, cols = 12, G = [];
      for (let i = 0; i < rows; i++) { const row = []; for (let j = 0; j < cols; j++) { const t = 0.04 + j / (cols - 1) * 0.86, v = i / (rows - 1); row.push(onNeck(t, -0.15 + v * (1.05 + 0.15 * Math.sin(j * 1.9)), (0.012 + 0.025 * v) * s * (1 - 0.3 * t), new V3())); } G.push(row); }
      for (const back of [false, true]) surf(mb, rows, cols, (i, j) => {
        const [u, v] = A.uv(mane, j / (cols - 1), 1 - i / (rows - 1)), t = j / (cols - 1);
        return { p: G[i][j].clone().addScaledVector(new V3(-1, 0.3, 0).normalize(), back ? -0.012 * s * (1 - i / rows) : 0), u, v, w: t > 0.8 ? Wq2('neck2', 'head', (t - 0.8) / 0.2) : t > 0.35 ? Wq2('neck1', 'neck2', (t - 0.35) / 0.45) : Wq2('chest', 'neck1', t / 0.35), r: 0.7 };
      }, { rough: 0.7, back });
      const fl = J.head.clone().add(new V3(0, 0.03 * s, 0.07 * s));
      CharHair.clump({ mb, A }, [0, 1, 2, 3, 4].map(i => fl.clone().add(new V3(0, -i * 0.03 * s, i * 0.03 * s + 0.012 * s))), new V3(1, 0, 0), { region: mane, w: 0.07 * s, th: 0.018 * s, u0: 0.3, wt: () => Wq('head'), tip: 0.6 });
    }
    const tl = (kind === 'horse' ? 0.74 : 0.16) * s, tw = (kind === 'horse' ? 0.07 : 0.05) * s;
    const tp = [0, 1, 2, 3, 4, 5, 6].map(i => { const t = i / 6; return J.tail0.clone().add(new V3(0, -t * tl + 0.02 * s, -0.09 * s * Math.sin(t * 2.0) - 0.02 * s)); });
    CharHair.clump({ mb, A }, tp, new V3(1, 0, 0), { region: kind === 'horse' ? mane : coat, w: tw * 1.3, th: tw * 1.1, u0: 0.1, wt: t => Wq2('tail0', 'tail1', clamp(t * 1.3, 0, 1)), tip: kind === 'horse' ? 0.4 : 0.8, flare: kind === 'horse' ? 0.9 : 0 });
    if (K.antlers) for (const sd of [1, -1]) {                         // sambar stag: three-tined antlers
      const b0 = J.head.clone().add(new V3(sd * 0.04 * s, 0.05 * s, 0.03 * s)), main = [b0];
      for (let q = 1; q <= 5; q++) main.push(b0.clone().add(new V3(sd * q * 0.028 * s, q * 0.075 * s, -q * 0.018 * s + Math.sin(q * 0.9) * 0.02 * s)));
      CharDress.tube({ mb, A }, main, t => (0.017 - t * 0.011) * s, '#6a5a44', Wq('head'), { cols: 6 });
      CharDress.tube({ mb, A }, [main[1], main[1].clone().add(new V3(sd * 0.02 * s, 0.035 * s, 0.1 * s))], t => (0.011 - t * 0.008) * s, '#6a5a44', Wq('head'), { cols: 5 });
      CharDress.tube({ mb, A }, [main[4], main[4].clone().add(new V3(-sd * 0.025 * s, 0.09 * s, 0.035 * s))], t => (0.009 - t * 0.006) * s, '#6a5a44', Wq('head'), { cols: 5 });
    }
    // stock saddle, blanket, girth, stirrups, bridle and reins, sitting on the sculpted back
    const backY = z => { let y = X[2]; while (y > X[1] && f(0, y, z) > 0) y -= 0.004 * s; return y; };
    let seatY = backY(0.02 * s) + 0.08 * s;
    if (K.saddle) {
      const P2 = (g, m, w, c) => CharDress.prim({ mb, A }, g, m, w, c, { fab: 'leather' });
      const at = (q, r = [0, 0, 0], sc = [1, 1, 1]) => new THREE.Matrix4().compose(q, new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), new V3(...sc));
      const by = backY(0.05 * s);
      surf(mb, 6, 12, (i, j) => {                                          // blanket draped over the back
        const u = j / 11 * 2 - 1, v = i / 5, z = (0.3 - v * 0.62) * s, ang = u * 1.05;
        const q = new V3(Math.sin(ang) * 0.3 * s, by + 0.012 * s - (1 - Math.cos(ang)) * 0.22 * s, z);
        const dn = f(q.x, q.y, q.z); if (dn < 0.01 * s) q.y += 0.01 * s - dn;
        const r0 = A.alloc('cblanket', 16, 16, { t: 'cloth', fab: 'wool', color: '#6a2a24' }); const [uu, vv] = A.uv(r0, 0.5, 0.5);
        return { p: q, u: uu, v: vv, w: Wq('body'), r: 0.9 };
      }, { rough: 0.9, out: new V3(0, 1, 0) });
      P2(new RoundedBoxGeometry(0.36 * s, 0.09 * s, 0.46 * s, 2, 0.04 * s), at(new V3(0, by + 0.07 * s, 0.03 * s)), Wq('body'), '#5a3620');
      P2(new RoundedBoxGeometry(0.3 * s, 0.07 * s, 0.1 * s, 2, 0.03 * s), at(new V3(0, by + 0.12 * s, -0.19 * s)), Wq('body'), '#4e2e1a');
      P2(new THREE.CylinderGeometry(0.022 * s, 0.028 * s, 0.1 * s, 8), at(new V3(0, by + 0.14 * s, 0.23 * s)), Wq('body'), '#4a2c1a');
      seatY = by + 0.1 * s;
      for (const sd of [1, -1]) {
        const top = new V3(sd * 0.17 * s, by + 0.05 * s, 0.1 * s), mid = new V3(sd * 0.28 * s, by - 0.25 * s, 0.12 * s);
        CharDress.tube({ mb, A }, [top, mid, new V3(sd * 0.26 * s, by - 0.42 * s, 0.13 * s)], 0.01 * s, '#3a2418', Wq('body'), { flatten: 0.3 });
        P2(new THREE.TorusGeometry(0.045 * s, 0.009 * s, 5, 12), at(new V3(sd * 0.26 * s, by - 0.46 * s, 0.13 * s), [0, Math.PI / 2, 0], [1, 0.8, 1]), Wq('body'), '#8a8a86');
        CharDress.tube({ mb, A }, [new V3(sd * 0.2 * s, by + 0.02 * s, 0.26 * s), new V3(sd * 0.25 * s, by - 0.35 * s, 0.3 * s), new V3(0, backY(0.3 * s) - 0.62 * s, 0.3 * s)], 0.013 * s, '#2e2016', Wq('body'), { flatten: 0.5 });
        const cheek = J.head.clone().lerp(F1, 0.55).add(new V3(sd * 0.07 * s, 0, 0));
        CharDress.tube({ mb, A }, [J.head.clone().add(new V3(sd * 0.08 * s, 0.04 * s, 0)), cheek, F1.clone().add(new V3(sd * 0.06 * s, -0.01 * s, -0.03 * s))], 0.008 * s, '#2a1a12', Wq('head'), { flatten: 0.4 });
        CharDress.tube({ mb, A }, [F1.clone().add(new V3(sd * 0.06 * s, -0.01 * s, -0.03 * s)), J.neck2.clone().add(new V3(sd * 0.12 * s, 0.0, 0.08 * s)), J.reins.clone().add(new V3(sd * 0.1 * s, 0.1 * s, 0.05 * s))], 0.006 * s, '#2a1a12', (q, t) => t < 0.5 ? Wq('head') : Wq('reins'), { flatten: 0.5 });
      }
      CharDress.tube({ mb, A }, [J.head.clone().add(new V3(0.08 * s, 0.04 * s, 0.02 * s)), J.head.clone().add(new V3(0, 0.07 * s, 0.06 * s)), J.head.clone().add(new V3(-0.08 * s, 0.04 * s, 0.02 * s))], 0.008 * s, '#2a1a12', Wq('head'), { flatten: 0.4 });
      CharDress.tube({ mb, A }, [F1.clone().add(new V3(0.07 * s, 0.02 * s, -0.06 * s)), F1.clone().add(new V3(0, 0.05 * s, -0.04 * s)), F1.clone().add(new V3(-0.07 * s, 0.02 * s, -0.06 * s))], 0.008 * s, '#2a1a12', Wq('head'), { flatten: 0.4 });
    }
    const tex = new THREE.CanvasTexture(A.cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    for (const k in A.R) if (A.R[k].spec) CharPaint.paintRegion(A, A.R[k], A.R[k].spec, { seed: 7 });
    tex.needsUpdate = true;
    const mat = CharBody.patchBody(new THREE.MeshStandardMaterial({ map: tex, vertexColors: true, roughness: 1 }));
    const body = new THREE.SkinnedMesh(mb.geometry(), mat);
    body.castShadow = body.receiveShadow = true;
    root.add(body); body.bind(skeleton, new THREE.Matrix4());
    body.boundingSphere = new THREE.Sphere(new V3(0, K.H * 0.6, 0.2 * s), K.H * 1.4);
    Engine.scene.add(root);
    const bindPos = {}; for (const k in bones) bindPos[k] = bones[k].position.clone();
    return {
      quad: true, kind, K, name: o.name || kind, root, bones, bindPos, skeleton, body, mat, tex, height: K.H, seatY: seatY - J.body.y, D: { H: K.H, s, hs: s, headO: J.head },
      loco: { v: 0, target: 0, phase: 0, dir: new V3(0, 0, 1), crouch: false, carry: false, limp: false, turnRate: 0 }, look: { target: null, yaw: 0, pitch: 0 },
      poseName: 'stand', poseT: 1, poseFrom: 'stand', t: R() * 10, mv: null, turn: null, riders: [], speaking: false, springs: [], heldP: {}, grip: {}, persistent: false,
      get yaw() { return root.rotation.y; }, set yaw(v) { root.rotation.y = v; },
    };
  }

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
    rot(B.neck1, headDown * 0.9 + (gait === 'gallop' ? 0.1 * Math.sin(L.phase * TAU) * move : 0) + breath, c.look.yaw * 0.4 + L.turnRate * 0.05);
    rot(B.neck2, headDown * 0.4 + (gait === 'walk' ? 0.06 * Math.sin(L.phase * TAU * 2) * move : 0), c.look.yaw * 0.4);
    rot(B.head, headDown * 0.2 - dead * 0.5, c.look.yaw * 0.2);
    const tw = Math.sin(c.t * 0.7) * 0.2;
    rot(B.earL, Math.sin(c.t * 0.9) * 0.2, 0, -0.2 - tw); rot(B.earR, Math.sin(c.t * 0.8 + 1) * 0.2, 0, 0.2 + tw);
    rot(B.tail0, 0.1 + move * 0.3 * (gait === 'gallop' ? 1.5 : 1), Math.sin(c.t * 1.3) * 0.25 * (1 - move)); rot(B.tail1, 0.1, Math.sin(c.t * 1.3 + 0.8) * 0.3);
    c.root.updateMatrixWorld(true);
    for (const r of c.riders) seat(c, r.c, r.back, dt);
  }
  // riders: sit astride the saddle; the front rider holds the reins, the back rider holds the front rider's waist
  const _p = new V3();
  function seat(h, r, back, dt) {
    h.bones.body.updateMatrixWorld(true);
    _p.set(0, h.seatY, (back ? -0.3 : 0.02) * h.D.s).applyMatrix4(h.bones.body.matrixWorld);
    r.root.position.set(_p.x, _p.y - r.D.yHips + 0.06 * r.D.s, _p.z);
    r.root.rotation.y = h.root.rotation.y;
    r.root.updateMatrixWorld(true);
    const T = (S, p) => { (r.ikT || (r.ikT = {}))[S] = { p, w: 1 }; };
    if (!back) { const q = h.bones.reins.getWorldPosition(new V3()); for (const [S, sd] of [['L', 1], ['R', -1]]) T(S, q.clone().add(new V3(sd * 0.1, 0.12, -0.05).applyQuaternion(h.root.quaternion))); }
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
