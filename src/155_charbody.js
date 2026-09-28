// ============================================================================
// CharBody — procedural character construction used by Chars (chars agent). Internal module:
// only Chars calls it, and only from inside functions.
//
//   CharBody.build(look) -> { root: Group, bones: {name: Bone}, skeleton, body: SkinnedMesh, head: SkinnedMesh,
//        layout (face UV layout for CharFace), D (dimensions/landmarks), atlas, attach: {name: {bone, pos, nrm}} }
//   CharBody.rebuild(built, look)      regenerate the body mesh (outfit/part change) on the same skeleton
//   CharBody.mat(kind)                 shared vertex-coloured PBR materials for props ('prop', 'glow', 'screen')
//   CharBody.patchBody(material)       per-vertex roughness patch (attribute `rough`)
//
// Everything is built in the bind pose in character space: feet at the origin, facing +Z, Y up, the
// character's left is +X. Bones carry identity rotations in the bind pose (arms hang in a slight A).
// The body is ONE SkinnedMesh (skin + every clothing layer + hair + worn accessories) using one
// per-look canvas atlas; the head is a second SkinnedMesh (head + jaw bones) textured by the live
// face canvas (CharFace). Surfaces are lofts/tubes whose rings are weighted to their bones, with
// smooth blends across joints; clothing is the same surfaces pushed outward, with flat-shaded folds.
// ============================================================================
const CharBody = (() => {
  const V3 = THREE.Vector3;
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const gauss = (x, s) => Math.exp(-(x * x) / (s * s));
  const lerp = (a, b, t) => a + (b - a) * t;
  const WHITE = new THREE.Color(1, 1, 1);

  // Catmull-Rom interpolation through keyed rows [[x, v1, v2, ...], ...] (sorted by x).
  function cr(keys, x, out) {
    const n = keys.length, m = keys[0].length - 1;
    let i = 0; while (i < n - 2 && x > keys[i + 1][0]) i++;
    const k1 = keys[i], k2 = keys[i + 1], k0 = keys[Math.max(0, i - 1)], k3 = keys[Math.min(n - 1, i + 2)];
    const t = clamp((x - k1[0]) / (k2[0] - k1[0]), 0, 1), t2 = t * t, t3 = t2 * t;
    for (let j = 1; j <= m; j++) {
      const p0 = k0[j], p1 = k1[j], p2 = k2[j], p3 = k3[j];
      out[j - 1] = 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
    }
    return out;
  }
  // deterministic value noise (for folds, hair, paint)
  const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
  function vnoise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return lerp(lerp(hash(xi, yi), hash(xi + 1, yi), u), lerp(hash(xi, yi + 1), hash(xi + 1, yi + 1), u), v) * 2 - 1;
  }

  // ---------------------------------------------------------------------------------------------
  // Mesh builder: positions, normals, uvs, colours, 4-bone skin weights, roughness.
  class MB {
    constructor() { this.P = []; this.N = []; this.T = []; this.C = []; this.SI = []; this.SW = []; this.R = []; this.I = []; this.marks = {}; }
    get n() { return this.P.length / 3; }
    v(p, nrm, u, v, c, w, r) {
      this.P.push(p.x, p.y, p.z); this.N.push(nrm.x, nrm.y, nrm.z); this.T.push(u, v); this.C.push(c.r, c.g, c.b); this.R.push(r);
      w.sort((a, b) => b[1] - a[1]);
      let s = 0; for (let k = 0; k < 4 && k < w.length; k++) s += w[k][1];
      for (let k = 0; k < 4; k++) { const e = w[k]; this.SI.push(e ? e[0] : 0); this.SW.push(e ? e[1] / s : 0); }
      return this.n - 1;
    }
    tri(a, b, c) { this.I.push(a, b, c); }
    mark(name) { this.marks[name] = [this.n, 0]; }
    endMark(name) { this.marks[name][1] = this.n - this.marks[name][0]; }
    geometry() {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(this.T, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(this.C, 3));
      g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.SI, 4));
      g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.SW, 4));
      g.setAttribute('rough', new THREE.Float32BufferAttribute(this.R, 1));
      g.setIndex(this.n > 65535 ? new THREE.Uint32BufferAttribute(this.I, 1) : new THREE.Uint16BufferAttribute(this.I, 1));
      return g;
    }
  }

  // Surface from a vertex grid. f(i, j) -> { p: V3, u, v, w: [[bone, weight]...], c?: Color, r? }.
  // Rows i run along the surface, columns j across/around it. Faces are oriented outward automatically:
  // away from the grid centroid (closed tubes/lofts) or along o.out (a V3, for open sheets).
  // o: { flat 0..1 (faceted normals), wrap (first/last column coincide), skip(i, j) -> bool, color, rough, out, capStart, capEnd }
  const _a = new V3(), _b = new V3(), _fn = new V3(), _n = new V3(), _c = new V3();
  let LOD = 1;                                                           // detail of the character being built (extras < 1)
  const lodN = n => Math.max(3, Math.round(n * (LOD < 1 ? 0.65 : 1)));
  function surf(mb, R, Cn, f, o = {}) {
    const G = [];
    for (let i = 0; i < R; i++) { const row = []; for (let j = 0; j < Cn; j++) row.push(f(i, j)); G.push(row); }
    const N = G.map(r => r.map(() => new V3()));
    const QN = [];
    _c.set(0, 0, 0); for (const r of G) for (const d of r) _c.add(d.p); _c.divideScalar(R * Cn);
    let orient = 0;
    for (let i = 0; i < R - 1; i++) {
      const qr = [];
      for (let j = 0; j < Cn - 1; j++) {
        _a.subVectors(G[i + 1][j + 1].p, G[i][j].p); _b.subVectors(G[i + 1][j].p, G[i][j + 1].p);
        const q = new V3().crossVectors(_a, _b);            // = normal of triangle (A, B, C)
        qr.push(q);
        if (o.skip && o.skip(i, j)) continue;
        N[i][j].add(q); N[i][j + 1].add(q); N[i + 1][j].add(q); N[i + 1][j + 1].add(q);
        orient += o.out ? q.dot(o.out) : q.dot(_a.copy(G[i][j].p).sub(_c));
      }
      QN.push(qr);
    }
    const flip = orient < 0;
    if (o.wrap) for (let i = 0; i < R; i++) { N[i][0].add(N[i][Cn - 1]); N[i][Cn - 1].copy(N[i][0]); }
    for (const r of N) for (const n of r) { if (n.lengthSq() < 1e-16) n.set(0, 1, 0); n.normalize(); if (flip) n.negate(); }
    const col = o.color || WHITE, rough = o.rough ?? 0.85, flat = LOD < 1 ? 0 : o.flat || 0;
    const emit = (d, nrm) => mb.v(d.p, nrm, d.u, d.v, d.c || col, d.w, d.r ?? rough);
    const quad = (A, B, C, D) => { if (flip) { mb.tri(A, C, B); mb.tri(B, C, D); } else { mb.tri(A, B, C); mb.tri(B, D, C); } };
    if (!flat) {
      const idx = G.map((r, i) => r.map((d, j) => emit(d, N[i][j])));
      for (let i = 0; i < R - 1; i++) for (let j = 0; j < Cn - 1; j++) {
        if (o.skip && o.skip(i, j)) continue;
        quad(idx[i][j], idx[i][j + 1], idx[i + 1][j], idx[i + 1][j + 1]);
      }
    } else {
      for (let i = 0; i < R - 1; i++) for (let j = 0; j < Cn - 1; j++) {
        if (o.skip && o.skip(i, j)) continue;
        _fn.copy(QN[i][j]); if (_fn.lengthSq() < 1e-16) continue; _fn.normalize(); if (flip) _fn.negate();
        const k = [];
        for (const [di, dj] of [[0, 0], [0, 1], [1, 0], [1, 1]]) { _n.copy(N[i + di][j + dj]).lerp(_fn, flat).normalize(); k.push(emit(G[i + di][j + dj], _n.clone())); }
        quad(k[0], k[1], k[2], k[3]);
      }
    }
    if (o.capStart) capRing(mb, G[0], o.capStart, col, rough);
    if (o.capEnd) capRing(mb, G[R - 1], o.capEnd, col, rough);
    return G;
  }
  // Close a ring with a fan to a centre point; faces point along cap.n. cap: { p: V3, n: V3, w, u, v, c? }
  function capRing(mb, ring, cap, col, rough) {
    const c = mb.v(cap.p, cap.n, cap.u, cap.v, cap.c || col, cap.w, cap.r ?? rough);
    const ids = ring.map(d => mb.v(d.p, cap.n, d.u, d.v, d.c || col, d.w, d.r ?? rough));
    for (let j = 0; j < ring.length - 1; j++) {
      _a.subVectors(ring[j].p, cap.p); _b.subVectors(ring[j + 1].p, cap.p);
      _fn.crossVectors(_a, _b).dot(cap.n) >= 0 ? mb.tri(c, ids[j], ids[j + 1]) : mb.tri(c, ids[j + 1], ids[j]);
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Proportions. Torso cross-section keys [h (fraction of height), halfWidth, front, back, zCentre] for a
  // 1.75 m adult; the look's build multipliers and `fem` (0 male .. 1 female) shape them.
  const TORSO_M = [
    [0.450, .050, .040, .048, -.005], [0.468, .112, .066, .082, -.010], [0.500, .160, .084, .104, -.016],
    [0.545, .165, .090, .098, -.010], [0.585, .150, .092, .085, 0], [0.620, .142, .095, .080, .004],
    [0.660, .149, .100, .082, .005], [0.700, .158, .110, .088, .004], [0.735, .165, .116, .092, 0],
    [0.770, .163, .108, .095, -.005], [0.795, .166, .094, .092, -.012], [0.812, .158, .076, .080, -.015],
    [0.826, .114, .058, .066, -.018], [0.836, .072, .050, .056, -.017], [0.844, .054, .045, .050, -.015]];
  const TORSO_F = [
    [0.450, .056, .042, .052, -.008], [0.468, .122, .068, .090, -.014], [0.500, .174, .084, .112, -.020],
    [0.545, .172, .088, .100, -.012], [0.585, .148, .088, .082, -.002], [0.620, .126, .088, .074, .003],
    [0.660, .131, .092, .075, .004], [0.700, .140, .100, .080, .004], [0.735, .146, .103, .085, 0],
    [0.770, .147, .097, .087, -.005], [0.795, .150, .084, .085, -.012], [0.812, .142, .069, .073, -.015],
    [0.826, .104, .053, .060, -.017], [0.836, .066, .046, .051, -.016], [0.844, .050, .042, .046, -.015]];
  const HMIN = 0.450, HMAX = 0.842;

  function dims(look) {
    const H = look.H, s = H / 1.75, b = look.build || {}, fem = look.fem ?? (look.sex === 'f' ? 1 : 0);
    const D = { H, s, fem, b: Object.assign({ sh: 1, ch: 1, wa: 1, hi: 1, arm: 1, leg: 1, neck: 1, belly: 0, bust: fem, fat: 0, musc: 0, legLen: 1, armLen: 1 }, b) };
    const B = D.b;
    D.hs = (look.headSize ?? ((0.86 + 0.14 * s) * (1 - fem * 0.05))) * 1.05;
    // landmarks (character space, bind pose)
    const legK = B.legLen;
    D.yHipJ = 0.500 * H * (0.93 + 0.07 * legK); D.yKnee = 0.268 * H * legK; D.yAnkle = 0.043 * H;
    D.xHip = (0.050 + fem * 0.006) * H * (0.92 + 0.08 * B.hi);
    D.yHips = 0.535 * H; D.ySpine = 0.60 * H; D.yChest = 0.70 * H; D.yNeck = 0.835 * H; D.yHead = 0.896 * H;
    D.shX = (0.097 - fem * 0.008) * H * (0.9 + 0.1 * B.sh); D.shY = 0.797 * H; D.shZ = -0.012 * s;
    D.aAng = 0.16;                                         // A-pose angle of the arms in the bind pose (rad)
    D.Lu = 0.172 * H * B.armLen; D.Lf = 0.150 * H * B.armLen; D.Lp = 0.056 * H; D.Lfi = 0.047 * H; D.Lt = 0.031 * H;
    D.Lth = D.yHipJ - D.yKnee; D.Lsh = D.yKnee - D.yAnkle; D.footL = 0.150 * H * (1 - fem * 0.06);
    // torso ring keys (scaled)
    D.torso = TORSO_M.map((k, i) => {
      const f = TORSO_F[i], h = k[0];
      let w = lerp(k[1], f[1], fem), fr = lerp(k[2], f[2], fem), bk = lerp(k[3], f[3], fem), zc = lerp(k[4], f[4], fem);
      const zone = (a, c, bw) => sstep(a - bw, a, h) * (1 - sstep(c, c + bw, h));
      const mw = 1 + (B.sh - 1) * sstep(0.74, 0.79, h) + (B.ch - 1) * zone(0.66, 0.78, 0.03) + (B.wa - 1) * zone(0.58, 0.66, 0.03) + (B.hi - 1) * (1 - sstep(0.54, 0.6, h));
      w *= mw * (1 + B.fat * 0.14 * (1 - sstep(0.78, 0.83, h)));
      fr *= 1 + B.fat * 0.12 + (B.ch - 1) * 0.6 * zone(0.66, 0.78, 0.03);
      bk *= 1 + B.fat * 0.1;
      fr += B.belly * 0.055 * gauss(h - 0.61, 0.055) + B.musc * 0.008 * gauss(h - 0.73, 0.03);
      w += B.belly * 0.022 * gauss(h - 0.6, 0.06);
      return [h * H, w * s, fr * s, bk * s, zc * s];
    });
    return D;
  }
  // torso ring (skin surface) at height y and angle phi (0 = front, +PI/2 = left/+X)
  const _ring = [0, 0, 0, 0];
  function torsoPt(D, y, phi, off, out) {
    cr(D.torso, off && off.skirt ? Math.max(y, D.H * 0.5) : y, _ring);
    const [w, f, b, zc] = _ring;
    const s = Math.sin(phi), c = Math.cos(phi), n = 2.35;
    let x = w * Math.sign(s) * Math.pow(Math.abs(s), 2 / n);
    let z = zc + (c >= 0 ? f : b) * Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
    // anatomy on the skin surface (softened on clothing via `off.soft`)
    const h = y / D.H, soft = off ? off.soft ?? 1 : 1;
    if (c > 0) {
      const bust = D.b.bust * 0.03 * D.s * gauss(h - 0.722, 0.032) * (gauss(x - 0.055 * D.s, 0.05 * D.s) + gauss(x + 0.055 * D.s, 0.05 * D.s));
      const pec = (1 - D.fem) * (0.006 + D.b.musc * 0.008) * D.s * gauss(h - 0.745, 0.025) * (gauss(x - 0.06 * D.s, 0.055 * D.s) + gauss(x + 0.06 * D.s, 0.055 * D.s));
      z += (bust + pec * soft) * c;
    } else {
      z += soft * 0.004 * D.s * gauss(x, 0.012 * D.s) * sstep(0.58, 0.64, h) * (1 - sstep(0.78, 0.82, h));            // spine groove
      z -= soft * 0.007 * D.s * gauss(h - 0.755, 0.03) * (gauss(x - 0.065 * D.s, 0.04 * D.s) + gauss(x + 0.065 * D.s, 0.04 * D.s)) * c; // blades
      z -= 0.012 * D.s * gauss(h - 0.505, 0.03) * (gauss(x - 0.06 * D.s, 0.055 * D.s) + gauss(x + 0.06 * D.s, 0.055 * D.s)) * (0.4 + D.fem * 0.6) * -c; // buttocks
    }
    out.set(x, y, z);
    if (off && off.d) {
      const d = typeof off.d === 'function' ? off.d(h, phi) : off.d;
      // outward normal in the xz plane from the superellipse tangent
      const e = 0.01, s1 = Math.sin(phi + e), c1 = Math.cos(phi + e), s0 = Math.sin(phi - e), c0 = Math.cos(phi - e);
      const tx = w * (Math.sign(s1) * Math.pow(Math.abs(s1), 2 / n) - Math.sign(s0) * Math.pow(Math.abs(s0), 2 / n));
      const tz = (c1 >= 0 ? f : b) * Math.sign(c1) * Math.pow(Math.abs(c1), 2 / n) - (c0 >= 0 ? f : b) * Math.sign(c0) * Math.pow(Math.abs(c0), 2 / n);
      const L = Math.hypot(tx, tz) || 1;
      out.x += (-tz / L) * d; out.z += (tx / L) * d;
    }
    return out;
  }

  // ---------------------------------------------------------------------------------------------
  // Skeleton. Absolute bind positions -> Bones with local offsets, identity rotations.
  const BONES = ['hips', 'spine', 'chest', 'neck', 'head', 'jaw',
    'clavL', 'upperArmL', 'foreArmL', 'handL', 'fingersL', 'fingers2L', 'thumbL', 'thumb2L',
    'clavR', 'upperArmR', 'foreArmR', 'handR', 'fingersR', 'fingers2R', 'thumbR', 'thumb2R',
    'thighL', 'shinL', 'footL', 'toeL', 'thighR', 'shinR', 'footR', 'toeR',
    'hair0', 'hair1', 'hair2', 'strandL', 'strandR', 'coatL', 'coatR', 'coatB'];
  const PARENT = { hips: null, spine: 'hips', chest: 'spine', neck: 'chest', head: 'neck', jaw: 'head',
    thighL: 'hips', shinL: 'thighL', footL: 'shinL', toeL: 'footL', thighR: 'hips', shinR: 'thighR', footR: 'shinR', toeR: 'footR',
    hair0: 'head', hair1: 'hair0', hair2: 'hair1', strandL: 'head', strandR: 'head', coatL: 'hips', coatR: 'hips', coatB: 'hips' };
  for (const S of 'LR') Object.assign(PARENT, { ['clav' + S]: 'chest', ['upperArm' + S]: 'clav' + S, ['foreArm' + S]: 'upperArm' + S, ['hand' + S]: 'foreArm' + S,
    ['fingers' + S]: 'hand' + S, ['fingers2' + S]: 'fingers' + S, ['thumb' + S]: 'hand' + S, ['thumb2' + S]: 'thumb' + S });
  const BI = Object.fromEntries(BONES.map((n, i) => [n, i]));

  function joints(D, look) {
    const J = {}, s = D.s, H = D.H;
    J.hips = new V3(0, D.yHips, 0); J.spine = new V3(0, D.ySpine, -0.004 * s); J.chest = new V3(0, D.yChest, -0.01 * s);
    J.neck = new V3(0, D.yNeck, -0.016 * s); J.head = new V3(0, D.yHead, -0.008 * s);
    // head space: origin between the eyes. Head pivot sits 0.035 hs below and 0.02 hs behind it.
    D.headO = new V3(0, D.yHead + 0.036 * D.hs, 0.012 * D.hs);
    J.jaw = D.headO.clone().add(new V3(0, -0.036 * D.hs, -0.016 * D.hs));
    for (const [S, sd] of [['L', 1], ['R', -1]]) {
      const dirA = new V3(sd * Math.sin(D.aAng), -Math.cos(D.aAng), 0);
      J['clav' + S] = new V3(sd * 0.022 * s, D.shY + 0.012 * s, 0.018 * s);
      J['upperArm' + S] = new V3(sd * D.shX, D.shY, D.shZ);
      J['foreArm' + S] = J['upperArm' + S].clone().addScaledVector(dirA, D.Lu);
      J['hand' + S] = J['foreArm' + S].clone().addScaledVector(dirA, D.Lf);
      J['fingers' + S] = J['hand' + S].clone().addScaledVector(dirA, D.Lp);
      J['fingers2' + S] = J['fingers' + S].clone().addScaledVector(dirA, D.Lfi * 0.45);
      J['thumb' + S] = J['hand' + S].clone().addScaledVector(dirA, 0.012 * s).add(new V3(-sd * 0.004 * s, 0, 0.018 * s));
      J['thumb2' + S] = J['thumb' + S].clone().add(new V3(-sd * 0.006 * s, -0.024 * s, 0.018 * s));
      J['thigh' + S] = new V3(sd * D.xHip, D.yHipJ, 0);
      J['shin' + S] = new V3(sd * D.xHip * 1.02, D.yKnee, 0.006 * s);
      J['foot' + S] = new V3(sd * D.xHip * 1.03, D.yAnkle, -0.012 * s);
      J['toe' + S] = J['foot' + S].clone().add(new V3(sd * 0.004 * s, -D.yAnkle + 0.022 * s, D.footL * 0.72));
    }
    const hb = look.hairBase || [0, 0.02, -0.1];                                         // ponytail anchor (head space)
    J.hair0 = D.headO.clone().add(new V3(hb[0], hb[1], hb[2]).multiplyScalar(D.hs));
    const hl = look.hairLen || 0.1;
    J.hair1 = J.hair0.clone().add(new V3(0, -hl * 0.4, -0.02 * s)); J.hair2 = J.hair1.clone().add(new V3(0, -hl * 0.35, -0.004));
    J.strandL = D.headO.clone().add(new V3(0.06, 0.02, 0.04).multiplyScalar(D.hs)); J.strandR = J.strandL.clone(); J.strandR.x *= -1;
    J.coatL = new V3(0.09 * s, D.yHips - 0.02 * s, 0.1 * s); J.coatR = new V3(-0.09 * s, D.yHips - 0.02 * s, 0.1 * s); J.coatB = new V3(0, D.yHips - 0.02 * s, -0.11 * s);
    return J;
  }
  function makeSkeleton(J) {
    const bones = {}, list = [];
    for (const n of BONES) { const b = new THREE.Bone(); b.name = n; bones[n] = b; list.push(b); }
    for (const n of BONES) {
      const p = PARENT[n], b = bones[n];
      b.position.copy(J[n]); if (p) { b.position.sub(J[p]); bones[p].add(b); }
    }
    bones.hips.updateMatrixWorld(true);
    return { bones, list, skeleton: new THREE.Skeleton(list) };
  }

  // ---------------------------------------------------------------------------------------------
  // Atlas: one canvas per look, regions shelf-packed; painters (CharPaint below) fill them.
  function Atlas(size) {
    const cv = document.createElement('canvas'); cv.width = cv.height = size;
    const A = { size, cv, ctx: cv.getContext('2d', { willReadFrequently: true }), R: {}, sky: [{ x: 0, y: 0, w: size }] };
    // skyline bottom-left packing (regions arrive one at a time while geometry is generated)
    A.alloc = (key, w, h, spec) => {
      if (A.R[key]) return A.R[key];
      const k = size / 1024; w = Math.max(8, Math.round(w * k)); h = Math.max(8, Math.round(h * k));
      const S = A.sky;
      let best = null;
      for (let i = 0; i < S.length; i++) {
        const x = S[i].x; if (x + w > size) break;
        let y = 0, j = i, cov = 0;
        while (cov < w) { y = Math.max(y, S[j].y); cov += S[j].w - (j === i ? 0 : 0); j++; if (j >= S.length && cov < w) { y = Infinity; break; } }
        if (y + h <= size && (!best || y < best.y || (y === best.y && x < best.x))) best = { x, y };
      }
      if (!best) { const sh = Math.max(8, Math.floor(h / 2)), sw = Math.max(8, Math.floor(w / 2)); return A.alloc(key, sw * 1024 / size, sh * 1024 / size, spec); }
      const r = { x: best.x, y: best.y, w, h, key, spec };
      // update the skyline
      const nx = r.x, ne = r.x + w, out = [];
      for (const seg of S) {
        const se = seg.x + seg.w;
        if (se <= nx || seg.x >= ne) { out.push(seg); continue; }
        if (seg.x < nx) out.push({ x: seg.x, y: seg.y, w: nx - seg.x });
        if (se > ne) out.push({ x: ne, y: seg.y, w: se - ne });
      }
      out.push({ x: nx, y: r.y + h, w });
      out.sort((a, b) => a.x - b.x);
      A.sky = out.reduce((m, sg) => { const l = m[m.length - 1]; if (l && l.y === sg.y && l.x + l.w === sg.x) l.w += sg.w; else m.push(sg); return m; }, []);
      return (A.R[key] = r);
    };
    // uv inside a region: s across (0..1, left->right), t along (0 bottom .. 1 top); half-texel inset
    A.uv = (r, s, t) => [(r.x + 0.5 + clamp(s, 0, 1) * (r.w - 1)) / size, 1 - (r.y + 0.5 + (1 - clamp(t, 0, 1)) * (r.h - 1)) / size];
    return A;
  }

  // ---------------------------------------------------------------------------------------------
  // Body assembly. `ctx` = { D, J, look, mb, A (atlas), layers }
  function W1(n) { return [[BI[n], 1]]; }
  function W2(a, b, t) { return t <= 0 ? W1(a) : t >= 1 ? W1(b) : [[BI[a], 1 - t], [BI[b], t]]; }

  // torso skin weights by height (+ clavicle for the shoulder tops, thighs for the buttocks/crotch)
  function torsoW(D, p, sideAware) {
    const h = p.y / D.H, ax = Math.abs(p.x), sd = p.x >= 0 ? 'L' : 'R';
    const w = [];
    const t1 = sstep(0.555, 0.625, h), t2 = sstep(0.64, 0.72, h), t3 = sstep(0.822, 0.85, h) * (1 - sstep(0.06 * D.s, 0.1 * D.s, ax));
    let hips = 1 - t1, spine = t1 * (1 - t2), chest = t2 * (1 - t3), neck = t3;
    const clav = sstep(0.1 * D.s, 0.16 * D.s, ax) * sstep(0.765, 0.8, h) * 0.55;
    chest *= 1 - clav;
    const thigh = (1 - sstep(0.47, 0.53, h)) * sstep(0.015 * D.s, 0.06 * D.s, ax) * 0.55 * (sideAware === false ? 0 : 1);
    hips *= 1 - thigh;
    if (hips > 0.001) w.push([BI.hips, hips]);
    if (spine > 0.001) w.push([BI.spine, spine]);
    if (chest > 0.001) w.push([BI.chest, chest]);
    if (neck > 0.001) w.push([BI.neck, neck]);
    if (clav > 0.001) w.push([BI['clav' + sd], clav]);
    if (thigh > 0.001) w.push([BI['thigh' + sd], thigh]);
    return w;
  }

  // coats: lower panels ride the coat spring bones (hem sway)
  function coatW(D, p, phi) {
    const base = torsoW(D, p), h = p.y / D.H, k = sstep(0.6, 0.5, h) * 0.7;
    if (k <= 0) return base;
    const bn = Math.cos(phi) < -0.3 ? 'coatB' : Math.sin(phi) >= 0 ? 'coatL' : 'coatR';
    return base.map(e => [e[0], e[1] * (1 - k)]).concat([[BI[bn], k]]);
  }
  // Loft of the torso surface between heights y0..y1 (character space) with an outward offset.
  // o: { off: {d, soft}, region, rows, cols, flat, color, rough, gap: [phiA, phiB] (open front between), skip(h, phi), folds(h, phi) -> extra offset,
  //      hem: flare below the waist, capBottom, uvT: (h) -> t }
  function torsoLoft(ctx, y0, y1, o) {
    const { D, mb, A } = ctx, rows = lodN(o.rows || Math.max(4, Math.round((y1 - y0) / (0.022 * D.s)))), cols = lodN(o.cols || 24);
    const r = A.alloc(o.region, ...(o.regionSize || [512, 256]), o.paint);
    const gap = o.gap || 0;                                                              // open front half-angle (rad)
    const p = new V3();
    const f = (i, j) => {
      const s = j / (cols - 1);
      const phi = gap ? lerp(gap, TAU - gap, s) : s * TAU - Math.PI;                // seam at the back for closed, at the front edges for open garments
      const y = lerp(o.bottom ? o.bottom(phi) * D.H : y0, o.top ? o.top(phi) * D.H : y1, i / (rows - 1)), h = y / D.H;
      const off = { d: (o.off ? (typeof o.off.d === 'function' ? o.off.d(h, phi) : o.off.d) : 0) + (o.folds ? o.folds(h, phi) : 0), soft: o.off ? o.off.soft : 1, skirt: o.skirt };
      torsoPt(D, y, phi, off, p);
      if (o.flareY != null && y < o.flareY) {                                           // hem hanging clear of the hips
        const k = (o.flareY - y) / (D.H * 0.1);
        cr(D.torso, o.flareY, _ring);
        const ex = o.flare * k; p.x += Math.sign(p.x) * ex * Math.abs(Math.sin(phi)); p.z += (Math.cos(phi) > 0 ? 1 : 0.6) * ex * Math.cos(phi);
      }
      const [u, v] = A.uv(r, s, i / (rows - 1));
      return { p: p.clone(), u, v, w: o.coat ? coatW(D, p, phi) : torsoW(D, p), c: o.shade ? o.shade(h, phi, p) : undefined };
    };
    return surf(mb, rows, cols, f, { flat: o.flat, color: o.color, rough: o.rough, wrap: !gap, skip: o.skip ? (i, j) => o.skip(lerp(y0, y1, (i + 0.5) / (rows - 1)) / D.H, gap ? lerp(gap, TAU - gap, (j + 0.5) / (cols - 1)) : (j + 0.5) / (cols - 1) * TAU - Math.PI) : null,
      capStart: o.capBottom ? { p: new V3(0, y0 - 0.01 * D.s, -0.01 * D.s), n: new V3(0, -1, 0), w: W1('hips'), u: A.uv(r, 0.5, 0)[0], v: A.uv(r, 0.5, 0)[1] } : null });
  }

  // Tube along a joint chain (arm or leg). chain: [[jointName, s]...] positions from J; prof(s) -> [ra (front/back), rb (side), dz, dx]
  // s0..s1 range along the chain (0 = first joint, 1 = last); off: outward offset; weights by chain segments with blends.
  function limb(ctx, side, kind, s0, s1, o) {
    const { D, J, mb, A } = ctx, sd = side === 'L' ? 1 : -1, S = side;
    const arm = kind === 'arm';
    const j0 = J[(arm ? 'upperArm' : 'thigh') + S], j1 = J[(arm ? 'foreArm' : 'shin') + S], j2 = J[(arm ? 'hand' : 'foot') + S];
    const L1 = j0.distanceTo(j1), L2 = j1.distanceTo(j2), se = L1 / (L1 + L2);
    const b0 = (arm ? 'upperArm' : 'thigh') + S, b1 = (arm ? 'foreArm' : 'shin') + S, b2 = (arm ? 'hand' : 'foot') + S, bp = arm ? 'clav' + S : 'hips';
    const rows = lodN(o.rows || Math.max(3, Math.round((s1 - s0) * (L1 + L2) / (0.02 * D.s)) + 1)), cols = lodN(o.cols || (arm ? 14 : 16));
    const r = A.alloc(o.region, ...(o.regionSize || [256, 256]), o.paint);
    const T = new V3(), N1 = new V3(0, 0, 1), N2 = new V3(), c = new V3();
    const prof = arm ? armProf : legProf;
    const pr = [0, 0, 0, 0];
    const seamPhi = sd * Math.PI / 2;                                                   // UV seam on the inner side
    const f = (i, j) => {
      const s = lerp(s0, s1, i / (rows - 1));
      const d = s * (L1 + L2);
      if (d <= L1) { T.subVectors(j1, j0).normalize(); c.copy(j0).addScaledVector(T, d); }
      else { T.subVectors(j2, j1).normalize(); c.copy(j1).addScaledVector(T, d - L1); }
      if (s < 0) { T.subVectors(j1, j0).normalize(); c.copy(j0).addScaledVector(T, d); }
      N2.crossVectors(T, N1).normalize();
      const N1p = new V3().crossVectors(N2, T).normalize();
      prof(D, s, se, pr, o);
      const phi = seamPhi + (j / (cols - 1)) * TAU;
      const cs = Math.cos(phi), sn = Math.sin(phi);
      const dd = (o.off ? (typeof o.off === 'function' ? o.off(s, phi) : o.off) : 0) + (o.folds ? o.folds(s, phi, se) : 0);
      const ra = pr[0] + dd, rb = pr[1] + dd;
      const p = c.clone().addScaledVector(N1p, cs * ra + pr[2]).addScaledVector(N2, sn * rb - pr[3] * sd);
      // weights
      const bw = arm ? 0.06 : 0.05;
      let w;
      if (s < se) {
        const t = sstep(se - bw, se + bw * 0.6, s);
        w = t > 0 ? W2(b0, b1, t) : W1(b0);
        const top = arm ? (1 - sstep(-0.02, 0.12, s)) * 0.45 : (1 - sstep(-0.05, 0.1, s)) * 0.45;
        if (top > 0) w = w.map(e => [e[0], e[1] * (1 - top)]).concat([[BI[bp], top]]);
      } else {
        const t = sstep(se - bw * 0.6, se + bw, s);
        w = W2(b0, b1, t);
        const e = sstep(0.93, 1.02, s) * (arm ? 0.8 : 0.5);
        if (e > 0) w = w.map(x => [x[0], x[1] * (1 - e)]).concat([[BI[b2], e]]);
      }
      const [u, v] = A.uv(r, j / (cols - 1), 1 - (i / (rows - 1)));
      return { p, u, v, w, c: o.shade ? o.shade(s, phi) : undefined };
    };
    const G = surf(mb, rows, cols, f, { flat: o.flat, color: o.color, rough: o.rough, wrap: true });
    if (o.capTop) { const ring = G[0], cp = ring.reduce((a, d) => a.add(d.p), new V3()).divideScalar(ring.length); capRing(mb, ring, { p: cp.addScaledVector(new V3().subVectors(j1, j0).normalize(), -0.012 * D.s), n: new V3().subVectors(j0, j1).normalize(), w: ring[0].w, u: ring[0].u, v: ring[0].v }, o.color || WHITE, o.rough ?? 0.8); }
    if (o.capEnd) { const ring = G[rows - 1], cp = ring.reduce((a, d) => a.add(d.p), new V3()).divideScalar(ring.length); capRing(mb, ring, { p: cp, n: T.clone(), w: ring[0].w, u: ring[0].u, v: ring[0].v }, o.color || WHITE, o.rough ?? 0.8); }
    return { G, se };
  }
  // radius profiles [ra (front-back), rb (side), dz (centre shift fwd), dx (centre shift outward)]
  function armProf(D, s, se, out) {
    const k = D.s * (1 - D.fem * 0.14) * D.b.arm * (1 + D.b.fat * 0.12), m = 1 + D.b.musc * 0.12;
    const t = s < se ? s / se : (s - se) / (1 - se);
    let r;
    if (s < 0) r = 0.047 * Math.sqrt(Math.max(0, 1 - (s / 0.036) ** 2));
    else if (s < se) r = lerp(0.047, 0.037, sstep(0, 1, t)) + 0.006 * m * gauss(t - 0.12, 0.14) + 0.003 * m * gauss(t - 0.5, 0.25);
    else r = lerp(0.036, 0.026, sstep(0, 1, t)) + 0.006 * m * gauss(t - 0.22, 0.2);
    out[0] = r * k * (s > se ? lerp(1, 1.1, t) : 1.02); out[1] = r * k * (s > se ? lerp(1, 0.78, t) : 0.95);
    out[2] = s < se ? 0.002 * k * gauss(t - 0.5, 0.3) : 0; out[3] = 0;
  }
  function legProf(D, s, se, out) {
    const k = D.s * D.b.leg * (1 + D.b.fat * 0.12) * (1 + D.fem * 0.04), m = 1 + D.b.musc * 0.1;
    const t = s < se ? s / se : (s - se) / (1 - se);
    let r, dz = 0;
    if (s < 0) r = 0.082;
    else if (s < se) r = lerp(0.083, 0.052, sstep(0, 1, t)) + 0.004 * gauss(t - 0.3, 0.3);
    else { r = lerp(0.049, 0.032, sstep(0, 1, t)) + 0.012 * m * gauss(t - 0.28, 0.2); dz = -0.009 * gauss(t - 0.3, 0.22); }
    out[0] = r * k; out[1] = r * k * (s < se ? 0.97 : 0.9); out[2] = dz * k; out[3] = s < se ? 0.006 * k * gauss(t - 0.15, 0.25) : 0;
  }

  // neck tube (skin)
  function neckTube(ctx, o = {}) {
    const { D, mb, A } = ctx, r = A.alloc('skin', 128, 128);
    const y0 = D.yNeck - 0.035 * D.s, y1 = D.headO.y - 0.045 * D.hs, rows = 7, cols = 16;
    const rn = 0.059 * D.s * D.b.neck * (1 - D.fem * 0.16);
    return surf(mb, rows, cols, (i, j) => {
      const t = i / (rows - 1), y = lerp(y0, y1, t), phi = j / (cols - 1) * TAU - Math.PI;
      const rx = rn * lerp(1.12, 0.9, t), rz = rn * lerp(1.05, 0.98, t), zc = -0.015 * D.s + t * 0.004;
      const p = new V3(Math.sin(phi) * rx, y, zc + Math.cos(phi) * rz + (Math.cos(phi) > 0 ? 0.004 * D.s * gauss(t - 0.55, 0.2) * gauss(Math.sin(phi), 0.3) * (1 - D.fem) : 0));
      const [u, v] = A.uv(r, j / (cols - 1), t);
      const w = t < 0.35 ? W2('chest', 'neck', sstep(0, 0.35, t)) : W2('neck', 'head', sstep(0.6, 1, t));
      return { p, u, v, w };
    }, { wrap: true, rough: 0.6 });
  }

  // Hands: palm, four slim fingers (proximal -> fingers, distal -> fingers2) and a two-segment thumb.
  // In the bind pose the palm faces the thigh (-X for the left hand), fingers point down, thumb forward.
  function hand(ctx, S, o = {}) {
    const { D, J, mb, A } = ctx, sd = S === 'L' ? 1 : -1, s = D.s * (1 - D.fem * 0.08) * (o.scale || 1);
    const r = A.alloc(o.region || 'skin_hand', 128, 128, o.paint);
    const dir = new V3(sd * Math.sin(D.aAng), -Math.cos(D.aAng), 0), side = new V3().crossVectors(dir, new V3(0, 0, 1)).normalize(); // side: across the palm thickness
    const w0 = J['hand' + S], wk = J['fingers' + S];
    const col = o.color || WHITE, rough = o.rough ?? 0.6;
    const [u, v] = A.uv(r, 0.5, 0.5);
    // palm: rounded box from wrist to knuckles
    const box = (c, along, across, thick, wts, ku = 0.5, taper = 1, cut) => {
      const rows = 5, cols = 13;
      return surf(mb, rows, cols, (i, j) => {
        const t = i / (rows - 1), phi = (j / (cols - 1)) * TAU;
        const cs = Math.cos(phi), sn = Math.sin(phi);
        const ex = 1.8, a = Math.sign(cs) * Math.pow(Math.abs(cs), 2 / ex), b = Math.sign(sn) * Math.pow(Math.abs(sn), 2 / ex);
        const tt = 1 - (1 - taper) * t;
        const round = Math.sqrt(Math.max(0, 1 - Math.pow(Math.abs(t - 0.5) * 2, 6))) * 0.25 + 0.75;
        const p = c.clone().addScaledVector(dir, (t - 0.5) * along).addScaledVector(new V3(0, 0, 1), a * across * 0.5 * tt * round).addScaledVector(side, b * thick * 0.5 * tt * round);
        const [uu, vv] = A.uv(r, j / (cols - 1), (ku + t * 0.2) % 1);
        return { p, u: uu, v: vv, w: typeof wts === 'function' ? wts(t) : wts, c: cut ? cut(t, phi) : undefined };
      }, { wrap: true, color: col, rough, flat: 0.25,
        capStart: { p: c.clone().addScaledVector(dir, -along * 0.5), n: dir.clone().negate(), w: typeof wts === 'function' ? wts(0) : wts, u, v },
        capEnd: { p: c.clone().addScaledVector(dir, along * 0.5), n: dir.clone(), w: typeof wts === 'function' ? wts(1) : wts, u, v } });
    };
    const palmW = 0.083 * s, palmT = 0.028 * s;
    box(w0.clone().addScaledVector(dir, D.Lp * 0.5).addScaledVector(side, 0.002 * s), D.Lp * 1.08, palmW, palmT, t => t < 0.2 ? W2('foreArm' + S, 'hand' + S, 0.5 + t * 2.5) : W1('hand' + S), 0.1, 0.94);
    // fingers: spread across the palm width (Z), index at the front (+Z)
    const lens = [0.94, 1, 0.95, 0.78], fw = palmW / 4.3;
    for (let k = 0; k < 4; k++) {
      const z = (1.5 - k) * fw * 1.02, L = D.Lfi * lens[k];
      const base = wk.clone().add(new V3(0, 0, z)).addScaledVector(side, 0.001 * s);
      box(base.clone().addScaledVector(dir, L * 0.24), L * 0.5, fw * 0.96, palmT * 0.72, W1('fingers' + S), 0.4, 0.94);
      if (!o.fingerless) box(base.clone().addScaledVector(dir, L * 0.45 + L * 0.29), L * 0.58, fw * 0.9, palmT * 0.64, W1('fingers2' + S), 0.6, 0.8, (t) => t > 0.8 ? new THREE.Color().copy(col).multiplyScalar(1.08) : undefined);
    }
    // thumb
    const t0 = J['thumb' + S], t1 = J['thumb2' + S], td = new V3().subVectors(t1, t0).normalize();
    const tb = (a, b, len, wd, bone) => {
      const rows = 4, cols = 11, c = a;
      surf(mb, rows, cols, (i, j) => {
        const t = i / (rows - 1), phi = (j / (cols - 1)) * TAU;
        const n1 = new V3().crossVectors(td, side).normalize(), n2 = new V3().crossVectors(td, n1).normalize();
        const rr = wd * (1 - t * 0.2) * (i === rows - 1 ? 0.8 : 1);
        const p = c.clone().addScaledVector(b, t * len).addScaledVector(n1, Math.cos(phi) * rr).addScaledVector(n2, Math.sin(phi) * rr * 0.85);
        const [uu, vv] = A.uv(r, j / (cols - 1), 0.8);
        return { p, u: uu, v: vv, w: W1(bone) };
      }, { wrap: true, color: col, rough, flat: 0.2,
        capStart: { p: c.clone().addScaledVector(b, -wd * 0.4), n: b.clone().negate(), w: W1(bone), u, v },
        capEnd: { p: c.clone().addScaledVector(b, len + wd * 0.5), n: b.clone(), w: W1(bone), u, v } });
    };
    tb(t0.clone().addScaledVector(td, -0.012 * s), td, t0.distanceTo(t1) + 0.012 * s, 0.0125 * s, 'thumb' + S);
    if (!o.fingerless) tb(t1, td, D.Lt * 0.62, 0.0108 * s, 'thumb2' + S);
  }

  // Foot / shoe: a lofted shape from heel to toe around the ankle joint (weighted foot + toe).
  function foot(ctx, S, o) {
    const { D, J, mb, A } = ctx, sd = S === 'L' ? 1 : -1, s = D.s * (o.scale || 1);
    const r = A.alloc(o.region, ...(o.regionSize || [256, 128]), o.paint);
    const a = J['foot' + S], L = D.footL * (o.len || 1), wdt = (0.047 + D.b.fat * 0.004) * s * (o.wide || 1), top = (o.top || 0.075) * s;
    const rows = 12, cols = 14;
    const heel = -0.26 * L, toe = 0.74 * L;
    return surf(mb, rows, cols, (i, j) => {
      const t = i / (rows - 1), z = lerp(heel, toe, t);
      const phi = (j / (cols - 1)) * TAU;                 // around the foot's long axis; 0 = top
      const cs = Math.cos(phi), sn = Math.sin(phi);
      // cross-section: flat sole, rounded top; width peaks at the ball
      const wz = wdt * (0.62 + 0.38 * gauss(t - 0.62, 0.3)) * (t > 0.9 ? lerp(1, 0.55, (t - 0.9) / 0.1) : 1) * (t < 0.08 ? lerp(0.7, 1, t / 0.08) : 1);
      const hz = lerp(top, 0.03 * s * (o.toeH || 1), sstep(0.25, 0.95, t)) * (t < 0.06 ? lerp(0.6, 1, t / 0.06) : 1);
      const yb = -D.yAnkle + (o.sole || 0.004) * s;
      const y = cs >= 0 ? yb + (o.sole || 0) * s + hz * Math.pow(cs, 0.8) + (o.soleH || 0.012) * s : yb + (o.soleH || 0.012) * s * (1 + cs);
      const x = sd * (0.004 * s) + Math.sign(sn) * Math.pow(Math.abs(sn), 0.8) * wz * 0.5 * (sn * sd < 0 ? 1.08 : 0.92);
      const p = new V3(a.x + x, a.y + y, a.z + z + (o.dz || 0));
      const [u, v] = A.uv(r, j / (cols - 1), t);
      const w = t > 0.72 ? W2('foot' + S, 'toe' + S, sstep(0.72, 0.8, t)) : (t < 0.2 && cs > 0.3 ? W2('shin' + S, 'foot' + S, 0.7) : W1('foot' + S));
      return { p, u, v, w, c: o.shade ? o.shade(t, phi) : undefined };
    }, { wrap: true, color: o.color, rough: o.rough ?? 0.7, flat: o.flat ?? 0.35,
      capStart: { p: new V3(a.x, a.y - D.yAnkle + 0.03 * s, a.z + heel - 0.004 * s + (o.dz || 0)), n: new V3(0, 0, -1), w: W1('foot' + S), u: A.uv(r, 0.5, 0)[0], v: A.uv(r, 0.5, 0)[1] },
      capEnd: { p: new V3(a.x + sd * 0.004 * s, a.y - D.yAnkle + 0.02 * s, a.z + toe + 0.004 * s + (o.dz || 0)), n: new V3(0, 0, 1), w: W1('toe' + S), u: A.uv(r, 0.5, 1)[0], v: A.uv(r, 0.5, 1)[1] } });
  }

  // ---------------------------------------------------------------------------------------------
  // Head. Rings of cross-sections in head space (origin between the eyes, metres for hs = 1):
  // [y, wFront, wBack, zFront, zBack, zCentre]; features (sockets, brow, lips, chin) displace it.
  const HEAD = [
    [-0.128, .020, .036, .034, .016, .010], [-0.121, .028, .045, .052, .024, .004], [-0.110, .034, .052, .066, .030, .002],
    [-0.098, .041, .058, .074, .036, .0], [-0.087, .047, .061, .078, .042, .0], [-0.080, .051, .063, .080, .048, .0],
    [-0.0755, .053, .064, .080, .052, .0], [-0.0715, .055, .065, .080, .056, .0], [-0.064, .058, .066, .080, .064, .0],
    [-0.054, .061, .067, .079, .074, .0], [-0.044, .064, .068, .079, .084, .0], [-0.030, .067, .071, .081, .094, .0],
    [-0.016, .069, .073, .083, .100, .0], [-0.004, .070, .074, .084, .104, .0], [0.008, .070, .075, .084, .106, .0],
    [0.020, .069, .075, .087, .107, .0], [0.034, .067, .075, .087, .107, .0], [0.050, .064, .074, .084, .106, .0],
    [0.066, .058, .070, .077, .101, .0], [0.080, .050, .064, .066, .093, .0], [0.094, .039, .053, .050, .079, .0],
    [0.106, .025, .037, .031, .058, .0], [0.114, .011, .018, .013, .030, .0]];
  const HY0 = -0.128, HY1 = 0.117, UMAX = 1.55;
  function headKeys(look) {
    const h = look.head || {};
    const jaw = h.jaw ?? 1, chin = h.chin ?? 1, wid = h.width ?? 1, cr0 = h.cranium ?? 1, fem = look.fem ?? (look.sex === 'f' ? 1 : 0);
    const hollow = h.hollow || 0, full = h.full || 0;
    return HEAD.map(k => {
      const y = k[0];
      const lower = sstep(-0.02, -0.1, y), upper = sstep(0.0, 0.08, y);
      const wm = wid * (1 + (jaw - 1) * lower * 0.9 - fem * 0.04 * lower + full * 0.06 * lower - hollow * 0.035 * gauss(y + 0.05, 0.03)) * (1 + (cr0 - 1) * upper);
      const zf = k[3] * (1 + (chin - 1) * 0.3 * sstep(-0.08, -0.11, y)), zb = k[4] * (1 + (cr0 - 1) * upper * 0.6);
      return [y, k[1] * wm, k[2] * wm, zf, zb, k[5]];
    });
  }
  const _hk = [0, 0, 0, 0, 0];
  function headRing(HK, y, phi, out) {
    cr(HK, y, _hk);
    const [wf, wb, zf, zb, zc] = _hk;
    const c = Math.cos(phi), s = Math.sin(phi);
    const nF = 2.6, nB = 2.1, n = c > 0 ? nF : nB;
    const fw = c > 0 ? lerp(wb, wf, Math.pow(c, 0.7)) : wb;
    out.x = fw * Math.sign(s) * Math.pow(Math.abs(s), 2 / n);
    out.z = zc + (c >= 0 ? zf : zb) * Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
    out.y = y;
    return out;
  }
  // phi at which the front surface reaches x (for placing painted features)
  function headPhi(HK, y, x) {
    let lo = -Math.PI / 2, hi = Math.PI / 2; const p = new V3();
    for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; headRing(HK, y, m, p); if (p.x < x) lo = m; else hi = m; }
    return (lo + hi) / 2;
  }
  const headUV = (phi, y) => [0.5 + clamp(phi, -UMAX, UMAX) / (2 * UMAX), clamp((y - HY0) / (HY1 - HY0), 0, 1)];

  function buildHead(D, look) {
    const hs = D.hs, HK = D.HK, h = look.head || {}, fem = look.fem ?? (look.sex === 'f' ? 1 : 0);
    const mb = new MB(), O = D.headO;
    const ipd = (h.ipd ?? (0.0625 - fem * 0.002)), eyeW = h.eyeW ?? 0.0148, eyeY = 0.0;
    const eyePhi = headPhi(HK, eyeY, ipd / 2);
    const brow = (h.brow ?? (1 - fem * 0.6)), cheek = h.cheek ?? 1, lip = h.lips ?? 1, chin = h.chin ?? 1;
    const mouthY = -0.0735 + (h.mouthUp ?? fem * 0.0035), mouthW = (h.mouthW ?? (0.025 - fem * 0.001)), mY = mouthY;
    // feature displacement (head space, before scaling)
    const feat = (phi, y, p) => {
      const ae = Math.abs(phi) - eyePhi;
      let d = 0;
      d -= 0.0098 * gauss(ae, 0.2) * gauss(y - 0.002, 0.014) * Math.max(0, Math.cos(phi));                                  // sockets
      d += 0.0032 * gauss(ae + 0.01, 0.1) * gauss(y - 0.001, 0.007);                                                         // eyeball under the lids
      d += 0.0045 * brow * gauss(Math.abs(phi) - eyePhi * 0.95, 0.3) * gauss(y - 0.021, 0.008) * Math.max(0, Math.cos(phi));   // brow ridge
      d += 0.004 * cheek * gauss(Math.abs(phi) - 0.78, 0.2) * gauss(y + 0.02, 0.014);                                        // cheekbones
      d -= 0.0016 * gauss(Math.abs(phi) - lerp(0.3, 0.42, sstep(-0.05, -0.08, y)), 0.06) * sstep(-0.042, -0.05, y) * (1 - sstep(mY - 0.004, mY - 0.012, y)); // nasolabial fold
      d += 0.0015 * gauss(ae, 0.25) * gauss(y + 0.016, 0.006);                                                              // lower orbital rim
      d += 0.0048 * lip * gauss(phi, 0.26) * gauss(y - mY - 0.0075, 0.0055);                                                        // upper lip
      d += 0.0058 * lip * gauss(phi, 0.24) * gauss(y - mY + 0.008, 0.0058);                                                       // lower lip
      d -= 0.0022 * gauss(phi, 0.33) * gauss(y - mouthY, 0.0022);                                                             // mouth line
      d -= 0.0028 * gauss(phi, 0.26) * gauss(y - mY + 0.016, 0.004);                                                              // under the lower lip
      d += 0.006 * chin * gauss(phi, 0.3) * gauss(y + 0.102, 0.009);                                                         // chin
      d += 0.0018 * gauss(phi, 0.06) * gauss(y - mY - 0.0155, 0.004);                                                               // philtrum
      d -= 0.004 * gauss(Math.abs(phi) - 1.12, 0.2) * gauss(y - 0.036, 0.018);                                               // temples
      d -= (h.hollow || 0) * 0.006 * gauss(Math.abs(phi) - 0.8, 0.22) * gauss(y + 0.056, 0.016);                             // hollow cheeks
      d += (h.full || 0) * 0.005 * gauss(Math.abs(phi) - 0.75, 0.3) * gauss(y + 0.055, 0.02);                                // full cheeks
      d += 0.004 * (h.jaw ?? 1) * gauss(Math.abs(phi) - 1.25, 0.25) * gauss(y + 0.085, 0.012) * (1 - fem * 0.6);             // jaw angle
      const L = Math.hypot(p.x, p.z - _hk[4]) || 1;
      p.x += p.x / L * d; p.z += (p.z - _hk[4]) / L * d;
    };
    const cols = LOD < 1 ? 31 : 41, rows = LOD < 1 ? 26 : 34;
    const phiAt = j => { const t = j / (cols - 1) * 2 - 1; return Math.PI * (0.52 * t + 0.48 * t * t * t); };
    const yAt = i => { const t = i / (rows - 1); return HY0 + (HY1 - HY0) * (0.5 - 0.5 * Math.cos(Math.PI * (t * 0.86 + 0.07 * Math.sin(Math.PI * t)))) ; };
    const ys = []; for (let i = 0; i < rows; i++) ys.push(yAt(i));
    // force rings on the lip line so the jaw opens cleanly between the lips
    const lipRows = [-0.011, -0.006, -0.0022, 0, 0.0022, 0.006, 0.0115].map(o => mY + o);
    for (const ly of lipRows) { let bi = 0, bd = 9; ys.forEach((y, i) => { const d = Math.abs(y - ly); if (d < bd) { bd = d; bi = i; } }); ys[bi] = ly; }
    ys.sort((a, b) => a - b);
    const jawW = y => 1 - sstep(mY - 0.001, mY + 0.0009, y);
    const pv = new V3();
    const G = surf(mb, rows, cols, (i, j) => {
      const y = ys[i], phi = phiAt(j);
      headRing(HK, y, phi, pv); feat(phi, y, pv);
      const p = pv.clone().multiplyScalar(hs).add(O);
      const [u, v] = headUV(phi, y);
      const front = sstep(-0.3, 0.2, Math.cos(phi));
      const jw = jawW(y) * front * (1 - sstep(0.8, 1.3, Math.abs(phi))) + jawW(y) * (1 - front) * 0.3 * sstep(-0.1, -0.12, y);
      const w = y < -0.112 && Math.cos(phi) < 0 ? W2('neck', 'head', 0.55) : W2('head', 'jaw', clamp(jw, 0, 1));
      return { p, u, v, w, r: 0.55 };
    }, { wrap: true, rough: 0.55,
      capEnd: { p: new V3(0, HY1 + 0.002, -0.012).multiplyScalar(hs).add(O), n: new V3(0, 1, 0), w: W1('head'), u: 0.5, v: 1 },
      capStart: { p: new V3(0, HY0 - 0.004, 0.004).multiplyScalar(hs).add(O), n: new V3(0, -1, 0), w: W2('head', 'jaw', 0.5), u: 0.5, v: 0 } });
    // nose: one surface from the bridge (between the eyes) over the tip to the subnasale, flaring into the alae;
    // its edges sink into the face. theta runs top -> bottom, phi across (front = 0).
    const nose = h.nose ?? 1, noseW = h.noseW ?? 1, bump = h.noseBump || 0;
    const zAt = (y, x) => { const ph = headPhi(HK, y, x); headRing(HK, y, ph, pv); feat(ph, y, pv); return pv.z; };
    const NK = [[0, 0.012, 0.0018, 0.0052], [0.25, -0.006, 0.0075, 0.0068], [0.5, -0.024, 0.0135, 0.0088], [0.66, -0.036, 0.0198, 0.0112], [0.76, -0.0425, 0.0222, 0.0135],
      [0.85, -0.047, 0.0182, 0.0158], [0.93, -0.0505, 0.0098, 0.0162], [1, -0.0532, 0.0012, 0.0118]];
    const nk = [0, 0, 0];
    const nr = 19, nc = 19;
    surf(mb, nr, nc, (i, j) => {
      const t = i / (nr - 1);
      cr(NK, t, nk);
      const y = nk[0] * (0.8 + 0.2 * nose) * (1 - fem * 0.07), zf = nk[1] * nose * (1 - fem * 0.12) + bump * 0.0035 * gauss(t - 0.4, 0.12), hw = nk[2] * noseW;
      const a = (j / (nc - 1)) * 2 - 1, aa = Math.abs(a), x = hw * a;
      const lobe = lerp(1, 0.6, sstep(0.55, 0.88, t));                   // the tip narrows to a lobule between the wings
      const tipP = Math.pow(Math.max(0, Math.cos(Math.min(1, aa / lobe) * Math.PI / 2)), lerp(1.3, 0.75, sstep(0.45, 0.72, t)));
      const ala = 0.0056 * noseW * sstep(0.55, 0.86, t) * (1 - sstep(0.94, 1, t)) * Math.sqrt(Math.max(0, 1 - aa * aa)) * (1 - fem * 0.2);
      const base = zAt(y, x * 1.02) - 0.0015;
      const z = base + Math.max(zf * tipP + 0.0016 * gauss(t - 0.74, 0.07) * tipP, ala);
      const [u, v] = headUV(headPhi(HK, y, x), y);
      return { p: new V3(x, y - 0.0015 * gauss(t - 0.9, 0.08) * sstep(0.4, 0.8, aa), z).multiplyScalar(hs).add(O), u, v, w: W1('head'), r: 0.42 };
    }, { rough: 0.42, out: new V3(0, 0, 1) });
    // ears: front face with a raised helix rim and a hollow concha, flat back; the front edge sits on the
    // head and the back edge stands out, the whole ear facing slightly forward.
    const earY = -0.02, ear = h.ear ?? 1;
    for (const sd of [1, -1]) {
      headRing(HK, earY, sd * 1.52, pv);
      const ec = new V3(pv.x, earY, pv.z - 0.006);
      const nOut = new V3(sd, 0, 0.18).normalize(), up = new V3(0, 1, -0.12).normalize(), fw = new V3().crossVectors(up, nOut).multiplyScalar(sd).normalize();
      const [eu, evv] = headUV(sd * 1.6, earY);
      const NR = 5, NT = 18;
      surf(mb, NR * 2 + 1, NT + 1, (i, j) => {
        const front = i <= NR, r = front ? i / NR : (2 * NR - i) / NR, th = j / NT * TAU;
        const st = Math.sin(th), ct = Math.cos(th);
        const ha = 0.0138 * ear * (1 - 0.22 * Math.max(0, -st)), hb = 0.026 * ear;
        const u = ct * ha * r, v = st * hb * r - (st < 0 ? 0.003 * r : 0);
        const base = Math.max(0, 0.011 - u) * 0.42 + 0.001;
        const rim = r > 0.72 ? 0.0038 * Math.sin((r - 0.72) / 0.28 * Math.PI) * (1 - 0.6 * Math.max(0, ct)) : 0;
        const bowl = -0.0034 * Math.exp(-((r - 0.35) ** 2) / 0.06) * (1 - 0.5 * Math.max(0, st));
        const w = front ? base + 0.0032 + rim + bowl : base - 0.001;
        const p = ec.clone().addScaledVector(fw, u).addScaledVector(up, v).addScaledVector(nOut, w);
        const inner = front && r < 0.72 ? Math.exp(-((r - 0.35) ** 2) / 0.08) : 0;
        return { p: p.multiplyScalar(hs).add(O), u: eu, v: evv, w: W1('head'), c: new THREE.Color(0.93 - inner * 0.3, 0.8 - inner * 0.42, 0.78 - inner * 0.42), r: 0.5 };
      }, { wrap: true, rough: 0.5 });
    }
    // Layout for the face painter and eye shader (UV space). toUV(x, y) inverts the ring mapping with a lookup table.
    const TY = [], ny = 50, nphi = 120;
    for (let i = 0; i <= ny; i++) {
      const y = HY0 + (HY1 - HY0) * i / ny, xs = new Float32Array(nphi + 1);
      for (let k = 0; k <= nphi; k++) { headRing(HK, y, -UMAX + 2 * UMAX * k / nphi, pv); xs[k] = pv.x; }
      TY.push(xs);
    }
    const rowPhi = (xs, x) => { let lo = 0, hi = nphi; if (x <= xs[0]) return -UMAX; if (x >= xs[nphi]) return UMAX; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (xs[m] < x) lo = m; else hi = m; } const t = (x - xs[lo]) / (xs[hi] - xs[lo] || 1); return -UMAX + 2 * UMAX * (lo + t) / nphi; };
    const toUV = (x, y) => {
      const fy = clamp((y - HY0) / (HY1 - HY0) * ny, 0, ny - 1e-6), i = Math.floor(fy), t = fy - i;
      const phi = lerp(rowPhi(TY[i], x), rowPhi(TY[i + 1], x), t);
      return headUV(phi, y);
    };
    const sv = 1 / (HY1 - HY0), e = 0.002;
    const su = (toUV(ipd / 2 + e, eyeY)[0] - toUV(ipd / 2 - e, eyeY)[0]) / (2 * e);
    const L = {
      toUV, sv, su, eyeL: toUV(ipd / 2, eyeY), eyeR: toUV(-ipd / 2, eyeY), eyeW, ipd,
      mouth: toUV(0, mouthY), mouthW, mouthY, noseK: (0.8 + 0.2 * nose) * (1 - fem * 0.07), nose, noseW, chinY: -0.104, browY: 0.0165, hairY: h.hairline ?? 0.068, eyePhi,
    };
    return { geo: mb.geometry(), layout: L };
  }

  // ---------------------------------------------------------------------------------------------
  // Materials
  function patchBody(m) {
    m.onBeforeCompile = sh => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float rough;\nvarying float vRough;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRough = rough;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vRough;')
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor *= vRough;');
    };
    m.customProgramCacheKey = () => 'charbody';
    return m;
  }
  const shared = {};
  function mat(kind) {
    if (shared[kind]) return shared[kind];
    let m;
    if (kind === 'prop') m = patchBody(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }));
    else if (kind === 'metal') m = patchBody(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0.85 }));
    else if (kind === 'glow') m = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    m.userData.shared = true;
    return (shared[kind] = m);
  }

  // ---------------------------------------------------------------------------------------------
  function build(look) {
    const D = dims(look), J = joints(D, look);
    D.HK = headKeys(look);
    LOD = look.detail ?? (look.gen ? 0.6 : 1);
    const sk = makeSkeleton(J);
    const root = new THREE.Group();
    root.add(sk.bones.hips);
    const B = { D, J, look, root, bones: sk.bones, skeleton: sk.skeleton, attach: {} };
    B.atlas = CharPaint.atlas(look, D);
    B.body = new THREE.SkinnedMesh(bodyGeometry(B), null);
    const hd = buildHead(D, look);
    B.layout = hd.layout;
    B.head = new THREE.SkinnedMesh(hd.geo, null);
    for (const m of [B.body, B.head]) {
      m.castShadow = m.receiveShadow = true;
      root.add(m); m.bind(sk.skeleton, new THREE.Matrix4());
      m.boundingSphere = new THREE.Sphere(new V3(0, D.H * 0.5, 0), D.H * 0.95);
    }
    return B;
  }
  function bodyGeometry(B) {
    const mb = new MB();
    const ctx = { D: B.D, J: B.J, look: B.look, mb, A: B.atlas.A, B };
    CharDress.dress(ctx);
    B.marks = mb.marks;
    return mb.geometry();
  }
  function rebuild(B, look) {
    B.look = look; LOD = look.detail ?? (look.gen ? 0.6 : 1);
    const g = bodyGeometry(B);
    B.body.geometry.dispose(); B.body.geometry = g;
  }

  return { get LOD() { return LOD; }, build, rebuild, mat, patchBody, MB, surf, capRing, torsoLoft, torsoPt, limb, hand, foot, neckTube, W1, W2, BI, BONES, cr, gauss, sstep, clamp, lerp, vnoise, hash, Atlas, headRing, headPhi, headUV, TAU };
})();
