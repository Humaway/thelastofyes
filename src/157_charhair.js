// ============================================================================
// CharHair — sculpted low-poly hair (chars agent, internal to Chars): a scalp cap that follows the
// hairline, tapered clumps that flow by style, ponytails/buns on the hair0..2 spring bones, loose
// face-framing strands on strandL/strandR, beards on the jaw. Strand-noise texture in the atlas.
//   CharHair.hair(ctx)  reads ctx.look.hair = { style, color, len, vol, part, seed } and ctx.look.beard
// Styles: crop side_part messy short buzz bald bob ponytail tied_back buns curly perm long receding comb
// ============================================================================
const CharHair = (() => {
  const { surf, W1, W2, BI, gauss, sstep, clamp, lerp, vnoise, headRing, TAU } = CharBody;
  const V3 = THREE.Vector3;

  // head surface point + outward normal (character space), at angle phi and head-space height y, pushed out by off (m)
  const _p = new V3(), _p1 = new V3(), _p2 = new V3();
  function headSurf(ctx, phi, y, off, out, nrm) {
    const { D } = ctx, HK = D.HK, e = 0.004;
    const yy = Math.min(y, 0.1135);
    headRing(HK, yy, phi, _p);
    headRing(HK, yy, phi + e, _p1); headRing(HK, yy + e * 0.5, phi, _p2);
    const n = nrm || new V3();
    n.crossVectors(_p1.sub(_p), _p2.sub(_p)).normalize();
    if (n.dot(new V3(_p.x, 0, _p.z - HK[10][5])) < 0 && y < 0.1) n.negate();
    if (y > 0.1135) { const k = sstep(0.1135, 0.123, y); n.lerp(new V3(0, 1, -0.1), k).normalize(); _p.y = lerp(0.1135, 0.121, k); _p.x *= 1 - k; _p.z = lerp(_p.z, -0.012, k); }
    if (n.y < -0.2 && y > 0) n.y = -0.2;
    n.normalize();
    out.copy(_p).addScaledVector(n, off / D.hs).multiplyScalar(D.hs).add(D.headO);
    return out;
  }
  const rng = seed => { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };

  // hairline height (head space) by |phi|
  function hairline(h, aphi) {
    const top = h.line ?? 0.066, rec = h.recede || 0, temple = h.temple ?? 0.022;
    const K = [[0, top + rec * 0.015], [0.45, top - 0.004 + rec * 0.02], [0.85, top - temple + rec * 0.035], [1.18, 0.012], [1.33, -0.012 + (h.burns ?? 0)], [1.42, -0.005], [1.55, 0.024], [1.75, 0.02], [2.1, -0.035], [2.6, -0.052], [Math.PI, -0.058]];
    let i = 0; while (i < K.length - 2 && aphi > K[i + 1][0]) i++;
    const t = sstep(K[i][0], K[i + 1][0], aphi);
    return lerp(K[i][1], K[i + 1][1], t);
  }

  // style: [cap volume(aphi, t, phi) in metres, groove amplitude, flow(phi, y) -> [across, up], builder of extra clumps]
  const VOL = {
    buzz: () => 0.0012, crop: (a, t) => 0.004 + 0.005 * t, receding: (a, t) => 0.003 + 0.004 * t,
    side_part: (a, t, ph, h) => 0.005 + 0.013 * sstep(0.35, 0.85, t) * (1 - 0.35 * sstep(1.4, 2.6, a)) + 0.004 * sstep(0.5, 1, t) * Math.max(0, -Math.sin(ph - (h.part ?? 0.35))),
    short: (a, t) => 0.006 + 0.01 * sstep(0.3, 0.9, t), messy: (a, t, ph) => 0.008 + 0.014 * sstep(0.3, 0.9, t) + 0.004 * vnoise(ph * 5, t * 6),
    comb: (a, t) => 0.006 + 0.012 * sstep(0.2, 0.8, t) * (1 - 0.4 * sstep(1.5, 2.6, a)),
    bob: (a, t) => 0.01 + 0.008 * sstep(0.2, 0.8, t), ponytail: (a, t) => 0.0045 + 0.002 * t, tied_back: (a, t) => 0.005 + 0.002 * t, buns: (a, t) => 0.0045,
    curly: (a, t, ph) => 0.018 + 0.01 * t + 0.006 * vnoise(ph * 7, t * 9), perm: (a, t, ph) => 0.013 + 0.006 * t + 0.005 * vnoise(ph * 9, t * 11), long: (a, t) => 0.009 + 0.004 * t,
  };
  function hair(ctx) {
    const { look, A, D } = ctx, h = look.hair;
    if (look.beard) beard(ctx, look.beard);
    if (!h || h.style === 'bald') return;
    const spec = { t: 'hair', color: h.color, grey: h.grey || 0, style: h.style };
    A.alloc('hair', 256, 192, spec); A.alloc('hair_cap', 256, 128, Object.assign({ cap: true }, spec));
    const R = rng(h.seed ?? 7), st = h.style, vol = h.vol ?? 1;
    const hdef = Object.assign({}, h, st === 'receding' ? { recede: 1 } : {});
    const vf = (a, t, ph) => VOL[st](a, t, ph, hdef) * vol;
    cap(ctx, hdef, vf, R);
    if (st === 'buzz') return;
    const C = { ctx, h: hdef, R, vf };
    ({ crop: shortHair, side_part: shortHair, short: shortHair, messy: shortHair, comb: shortHair, receding: shortHair,
       bob, ponytail, tied_back: tiedBack, buns, curly, perm: curly, long: longHair })[st](C);
  }

  // Scalp shell from the hairline to the crown: volume by style, grooves along the combing direction,
  // thinning to nothing at the hairline so it blends into the painted hairline.
  function cap(ctx, h, vf, R) {
    const { mb, A } = ctx, r = A.R.hair_cap, cols = CharBody.LOD < 1 ? 28 : 44, rows = CharBody.LOD < 1 ? 8 : 12, p = new V3(), n = new V3();
    const seed = R() * 100, st = h.style, part = h.part ?? 0.35;
    const flowTo = st === 'ponytail' ? [Math.PI, 0.07] : st === 'tied_back' ? [Math.PI, 0.0] : null;
    surf(mb, rows, cols, (i, j) => {
      const s = j / (cols - 1), phi = s * TAU - Math.PI, t = i / (rows - 1), a = Math.abs(phi);
      const y0 = hairline(h, a), y = lerp(y0, 0.126, Math.pow(t, 0.85));
      const edge = sstep(0, 0.22, t);
      // grooves: noise stretched along the local comb direction
      let ax, ay;
      if (flowTo) { ax = (U_wrap(flowTo[0] - phi)) * 0.075; ay = flowTo[1] - y; }
      else if (st === 'side_part' || st === 'comb') { ax = t > 0.5 && a < 1.6 ? (phi > part ? 1 : -1) * 0.6 : 0; ay = st === 'comb' && a < 1.3 ? 1 : -1; }
      else { ax = 0; ay = -1; }
      const L = Math.hypot(ax, ay) || 1; ax /= L; ay /= L;
      const qx = phi * 0.075, qy = y, along = qx * ax + qy * ay, across = qx * -ay + qy * ax;
      const groove = st === 'buzz' ? 0 : (0.5 + 0.5 * vnoise(across * 260 + seed, along * 30)) * 0.0045 * edge;
      const lump = (0.5 + 0.5 * vnoise(phi * 3 + seed, y * 40)) * 0.002;
      headSurf(ctx, phi, y, (vf(a, t, phi) * edge + groove + lump * edge) + 0.0004, p, n);
      const [u, v] = A.uv(r, s, t);
      return { p: p.clone(), u, v, w: W1('head'), r: 0.62, c: new THREE.Color(1, 1, 1).multiplyScalar(0.82 + 0.18 * edge) };
    }, { wrap: true, rough: 0.62, flat: 0.45 });
  }

  // A tapered clump along a path of points (character space). o: { w (root width), th, bone(s) weight fn, curl }
  function clump(ctx, pts, side, o) {
    const hv = CharBody.hash(pts[0].x * 97.1, pts[0].y * 131.7 + pts[0].z * 71.3);
    if (CharBody.LOD < 1 && hv < 0.4) return;                                // extras: fewer clumps
    const { mb, A } = ctx, r = o.region || A.R.hair, n = pts.length, cols = 5;
    const col = o.c || new THREE.Color(1, 1, 1);
    const u0 = o.u0 ?? hv;
    const T = new V3(), B = new V3();
    surf(mb, n, cols, (i, j) => {
      const t = i / (n - 1), p = pts[i];
      T.subVectors(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)]).normalize();
      B.copy(side).addScaledVector(T, -side.dot(T)).normalize();                   // across the clump, in the surface
      const N = new V3().crossVectors(T, B).normalize();                            // thickness direction
      const taper = Math.pow(1 - t, o.tip ?? 0.7) * (o.flare ? 1 + o.flare * gauss(t - 0.15, 0.2) : 1);
      const a = (j / (cols - 1)) * TAU;
      const wv = o.w * taper, th = (o.th ?? o.w * 0.4) * taper;
      const q = p.clone().addScaledVector(B, Math.cos(a) * wv * 0.5).addScaledVector(N, Math.sin(a) * th * 0.5 + (o.lift ?? 0) * (1 - t) * 0.0);
      const [uu, vv] = A.uv(r, (u0 + (j / (cols - 1)) * 0.12) % 1, t);
      return { p: q, u: uu, v: vv, w: o.wt ? o.wt(t, p) : W1('head'), c: col, r: 0.6 };
    }, { wrap: true, flat: 0.45, rough: 0.6 });
  }
  const shade = (R, k = 0.12) => { const v = 1 - k + R() * k * 2; return new THREE.Color(v, v * (0.98 + R() * 0.04), v * (0.96 + R() * 0.06)); };

  // Grow a clump from a scalp point along the surface. flow(phi, y, t) -> [across, up] physical direction
  // (across = toward +phi); gravity comes from the flow. o: { w, th, lift, puff, steps, minY, wt, tip }
  function grow(C, phi, y, len, flow, o = {}) {
    const { ctx } = C, pts = [], n = new V3(), p = new V3();
    let ph = phi, yy = y;
    const steps = o.steps || 6, ds = len / (steps - 1);
    const capAt = (ph, yy) => { const a = Math.abs(U_wrap(ph)), y0 = hairline(C.h, a), t = clamp((yy - y0) / (0.126 - y0), 0, 1); return C.vf(a, t, ph) * sstep(0, 0.22, t) * 0.85; };
    for (let k = 0; k < steps; k++) {
      const t = k / (steps - 1);
      headSurf(ctx, ph, yy, capAt(ph, yy) + (o.lift ?? 0.003) * (1 - t * 0.3) + (o.puff || 0) * Math.sin(t * Math.PI), p, n);
      pts.push(p.clone());
      const f = flow(ph, yy, t), L = Math.hypot(f[0], f[1]) || 1;
      ph += f[0] / L * ds / 0.075; yy += f[1] / L * ds;
      if (o.minY != null && yy < o.minY) yy = o.minY;
    }
    headSurf(ctx, phi, y, 0, p, n);
    const across = new V3().crossVectors(n, new V3().subVectors(pts[1], pts[0]).normalize()).normalize();
    clump(ctx, pts, across, Object.assign({ w: 0.028 * ctx.D.hs, c: shade(C.R), u0: C.R() }, o));
    return pts;
  }

  // ---- styles -------------------------------------------------------------------------------------
  function shortHair(C) {
    const { h, R, ctx, vf } = C, st = h.style, part = h.part ?? (st === 'side_part' || st === 'comb' ? 0.35 : 0), hs = ctx.D.hs;
    const len = { crop: 0.03, short: 0.045, side_part: 0.055, messy: 0.055, comb: 0.06, receding: 0.03 }[st] * (h.len ?? 1);
    const messy = st === 'messy' ? 1 : st === 'short' ? 0.5 : 0.15;
    // top/front clumps lying on the shell, swept by style
    const N = { crop: 16, short: 24, side_part: 26, messy: 34, comb: 20, receding: 12 }[st];
    for (let k = 0; k < N; k++) {
      const phi = (R() * 2 - 1) * (st === 'messy' ? Math.PI : 1.25), a = Math.abs(phi);
      const y0 = hairline(h, a) + 0.006, y = lerp(y0, 0.112, Math.pow(R(), 1.4));
      if (st === 'receding' && a < 0.9) continue;
      const jit = (R() - 0.5) * messy * 1.4;
      const flow = st === 'comb' ? () => [jit * 0.3, 1] : part ? (ph) => [(ph > part ? 1 : -1) * 1.2 + jit, -0.45] : () => [jit + Math.sign(phi) * 0.3, -1];
      grow(C, phi, y, len * (0.6 + R() * 0.6), flow, { w: (0.026 + R() * 0.014) * hs, th: 0.009 * hs, lift: 0.001 + messy * 0.003 * R(), steps: 5, tip: 0.45, flare: 0.2 });
    }
    // fringe edge along the front hairline and short sideburn pieces
    for (let k = 0; k < 12; k++) {
      const phi = (k / 11 - 0.5) * 2.1, a = Math.abs(phi);
      if (st === 'receding' && a < 0.95) continue;
      const y = hairline(h, a) + 0.01;
      const sweep = part ? (phi > part ? 1 : -1) * 0.9 : phi * 0.5;
      grow(C, phi, y, len * 0.55, () => [sweep, st === 'comb' ? 0.7 : -0.6], { w: 0.03 * hs, th: 0.008 * hs, lift: 0.001, steps: 4, tip: 0.5 });
    }
  }

  function bob(C) {
    const { h, R, ctx } = C, hs = ctx.D.hs, len = (h.len ?? 1);
    const bottom = -0.085 * len;
    for (let k = 0; k < 110; k++) {
      const phi = (R() * 2 - 1) * Math.PI, aphi = Math.abs(phi);
      const y = lerp(0.05, 0.118, Math.pow(R(), 0.6));
      const front = aphi < 0.7;
      const part = h.part ?? 0.3;
      const flow = (ph, yy) => (front && yy > 0.03 ? [Math.sign(ph - part) * 1.2, -1] : [0, -1]);
      const L = (y - bottom) + (front ? -0.02 : 0);
      grow(C, phi, y, Math.max(0.03, L), flow, { w: (0.03 + R() * 0.012) * hs, th: 0.008 * hs, lift: 0.004, steps: 7, puff: 0.006, minY: bottom - 0.02 });
    }
    // bottom curl-under row
    for (let k = 0; k < 28; k++) {
      const phi = (k / 28) * TAU - Math.PI; if (Math.abs(phi) < 0.75) continue;
      grow(C, phi, -0.01, 0.07 * len, () => [0, -1], { w: 0.032 * hs, th: 0.01 * hs, lift: 0.012, steps: 5, puff: 0.004 });
    }
  }

  // hair gathered to a tie point, then a tail on the spring bones
  function toTie(C, tie, n, o = {}) {
    const { h, R, ctx } = C, hs = ctx.D.hs;
    for (let k = 0; k < n; k++) {
      const phi = (R() * 2 - 1) * Math.PI, aphi = Math.abs(phi);
      const y = lerp(hairline(h, aphi) + 0.003, 0.115, Math.pow(R(), 1.3));
      // flow toward the tie (in phi/y space)
      const flow = (ph, yy) => [U_wrap(tie[0] - ph) * 0.075, tie[1] - yy];
      const dist = Math.hypot(U_wrap(tie[0] - phi) * 0.075, tie[1] - y);
      grow(C, phi, y, dist * 0.95, flow, { w: (0.03 + R() * 0.012) * hs, th: 0.006 * hs, lift: 0.0015 + (o.messy || 0) * R() * 0.006, steps: 6 });
    }
  }
  const U_wrap = a => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
  function tail(C, anchor, dir, len, n, o = {}) {
    // clumps hanging from the anchor (character space), weighted along hair0->hair1->hair2
    const { R, ctx } = C, hs = ctx.D.hs, J = ctx.J;
    const wt = (t) => t < 0.35 ? W2('hair0', 'hair1', t / 0.35) : W2('hair1', 'hair2', clamp((t - 0.35) / 0.4, 0, 1));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU, sp = (o.spread ?? 0.012) * hs;
      const start = anchor.clone().add(new V3(Math.cos(a) * sp, Math.sin(a) * sp * 0.6, 0));
      const pts = [];
      const L = len * (0.75 + R() * 0.35), wig = (R() - 0.5) * 0.03;
      for (let s = 0; s < 7; s++) {
        const t = s / 6;
        const bulge = Math.sin(t * Math.PI) * (o.bulge ?? 0.018) * hs;
        const p = start.clone().addScaledVector(dir, t * L).add(new V3(Math.cos(a) * bulge + wig * t * t, Math.sin(a) * bulge * 0.5, Math.sin(a * 2) * 0.004));
        if (o.curlEnd) p.z += o.curlEnd * t * t * hs;
        pts.push(p);
      }
      clump(ctx, pts, new V3(-Math.sin(a), Math.cos(a), 0), { w: (0.024 + R() * 0.01) * hs, th: 0.008 * hs, c: shade(R), u0: R(), wt: (t) => wt(t * L / len), tip: 0.9, flare: 0.3 });
    }
  }

  function ponytail(C) {
    const { ctx, h } = C, hs = ctx.D.hs, O = ctx.D.headO;
    const tie = [Math.PI, 0.07];
    toTie(C, tie, 70, { messy: 1 });
    // hair tie band + tail
    const anchor = ctx.J.hair0.clone();
    tail(C, anchor, new V3(0, -1, -0.35).normalize(), (h.len ?? 0.2) * hs, 12, { spread: 0.014, bulge: 0.022 });
    // loose face-framing strands (spring bones)
    for (const [sd, bn] of [[1, 'strandL'], [-1, 'strandR']]) for (let k = 0; k < 2; k++) {
      const pts = []; const p = new V3();
      for (let s = 0; s < 6; s++) { const t = s / 5; headSurf(ctx, sd * (0.95 + k * 0.12), lerp(0.05, -0.035 - k * 0.012, t), 0.005 + 0.004 * t, p); pts.push(p.clone()); }
      clump(ctx, pts, new V3(0, 0, 1), { w: 0.012 * hs, th: 0.004 * hs, c: shade(C.R), u0: C.R(), wt: (t) => W2('head', bn, sstep(0.2, 0.7, t)) });
    }
  }
  function tiedBack(C) {
    const { ctx, h } = C, hs = ctx.D.hs;
    toTie(C, [Math.PI, 0.0], 64);
    tail(C, ctx.J.hair0.clone(), new V3(0, -1, -0.2).normalize(), (h.len ?? 0.16) * hs, 10, { spread: 0.012, bulge: 0.014 });
  }
  function buns(C) {
    const { ctx, R } = C, hs = ctx.D.hs;
    for (const sd of [1, -1]) {
      const tie = [sd * 2.2, 0.1];
      // hair on this side flows up to the bun
      for (let k = 0; k < 40; k++) {
        const phi = sd * (0.05 + R() * 3.05), y = lerp(hairline(C.h, Math.abs(phi)) + 0.003, 0.11, Math.pow(R(), 1.2));
        const flow = (ph, yy) => [U_wrap(tie[0] - ph) * 0.075, tie[1] - yy];
        grow(C, phi, y, Math.hypot(U_wrap(tie[0] - phi) * 0.075, tie[1] - y) * 0.9, flow, { w: 0.03 * hs, th: 0.006 * hs, lift: 0.002, steps: 5 });
      }
      // the bun: a ball of swirled clumps
      const c = new V3(), n = new V3(); headSurf(ctx, tie[0], tie[1], 0.028 * hs, c, n);
      const rb = 0.034 * hs;
      for (let k = 0; k < 9; k++) {
        const pts = [], a0 = k / 9 * TAU, tilt = (R() - 0.5) * 1.2;
        for (let s = 0; s < 8; s++) {
          const a = a0 + s / 7 * 4.2, e = tilt + Math.sin(a * 0.5) * 0.4;
          pts.push(c.clone().add(new V3(Math.cos(a) * Math.cos(e) * rb, Math.sin(e) * rb * 0.9, Math.sin(a) * Math.cos(e) * rb)));
        }
        clump(ctx, pts, n, { w: 0.03 * hs, th: 0.014 * hs, c: shade(R), u0: R(), tip: 0.4 });
      }
    }
  }
  function curly(C) {
    const { ctx, h, R } = C, hs = ctx.D.hs, perm = h.style === 'perm';
    const N = perm ? 120 : 150;
    for (let k = 0; k < N; k++) {
      const phi = (R() * 2 - 1) * Math.PI, aphi = Math.abs(phi);
      const y = lerp(hairline(h, aphi) + 0.005, 0.12, Math.pow(R(), 0.8));
      const pts = [], p = new V3(), n = new V3();
      const L = (perm ? 0.02 : 0.035) * (0.7 + R() * 0.6) * (h.len ?? 1), rc = (perm ? 0.006 : 0.01) * hs;
      const a0 = R() * TAU, turns = 1 + R();
      for (let s = 0; s < 8; s++) {
        const t = s / 7, a = a0 + t * turns * TAU;
        headSurf(ctx, phi + Math.cos(a) * 0.08 * t, y - t * L * 0.5 + Math.sin(a) * 0.006, C.vf(Math.abs(phi), 0.6, phi) * 0.7 + 0.004 + t * L * 0.4 + Math.sin(a) * rc, p, n);
        pts.push(p.clone());
      }
      clump(ctx, pts, n, { w: (perm ? 0.014 : 0.02) * hs, th: 0.009 * hs, c: shade(R, 0.16), u0: R(), tip: 0.5 });
    }
  }
  function longHair(C) {
    const { ctx, h, R } = C, hs = ctx.D.hs, bottom = -0.2 * (h.len ?? 1);
    for (let k = 0; k < 110; k++) {
      const phi = (R() * 2 - 1) * Math.PI, y = lerp(0.04, 0.118, Math.pow(R(), 0.6));
      const front = Math.abs(phi) < 0.8;
      grow(C, phi, y, y - bottom, (ph, yy) => (front && yy > 0.04 ? [Math.sign(ph - 0.2) * 1.3, -1] : [0, -1]), { w: 0.03 * hs, th: 0.007 * hs, lift: 0.004, steps: 8, puff: 0.008, minY: bottom - 0.05 });
    }
  }

  // Beards: clumps on the jaw/chin (weighted to the jaw) — 'big' reaches the chest; 'full' is trimmed.
  function beard(ctx, b) {
    const { A, D } = ctx, hs = D.hs, R = rng(b.seed ?? 11);
    A.alloc('beard', 256, 128, { t: 'hair', color: b.color, grey: b.grey || 0, beard: true });
    const big = b.style === 'big', p = new V3(), n = new V3();
    const N = big ? 120 : 70;
    for (let k = 0; k < N; k++) {
      const phi = (R() * 2 - 1) * 1.45, aphi = Math.abs(phi);
      const top = aphi > 1.2 ? -0.01 : aphi > 0.6 ? -0.045 : -0.062;
      const y = lerp(-0.118, top, Math.pow(R(), 0.8));
      if (aphi < 0.3 && y > -0.082 && y < -0.066) continue;                 // keep the lips clear
      const mustache = aphi < 0.5 && y > -0.07;
      const L = big ? (0.06 + 0.12 * (1 - aphi / 1.5)) * (b.len ?? 1) : 0.018 + R() * 0.012;
      const pts = [];
      for (let s = 0; s < 6; s++) {
        const t = s / 5;
        headSurf(ctx, phi * (1 - t * (big ? 0.35 : 0.1)), y - t * L * (mustache ? 0.2 : 1), 0.003 + t * (big ? 0.02 : 0.004) + (big ? 0.012 * Math.sin(t * Math.PI) : 0), p, n);
        if (mustache) p.x += Math.sign(phi) * t * 0.012 * hs;
        pts.push(p.clone());
      }
      const jw = t => y < -0.074 ? W2('head', 'jaw', 0.85) : W1('head');
      const saved = A.R.hair; A.R.hair = A.R.beard;
      clump(ctx, pts, new V3(1, 0, 0), { w: (big ? 0.03 : 0.016) * hs, th: (big ? 0.012 : 0.004) * hs, c: shade(R, 0.14), u0: R(), wt: jw, tip: big ? 0.8 : 0.6 });
      A.R.hair = saved;
    }
  }

  return { hair, headSurf, hairline, clump };
})();
