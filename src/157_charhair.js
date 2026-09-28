// ============================================================================
// CharHair — styled hair (chars agent, internal to Chars): a smooth shell over the scalp that follows the
// hairline, swells by style and carries a strand-flow texture (u around the head, v from the hairline to
// the crown, painted with a sheen band); messy cuts and bobs shape their fringe into its front edge; bobs
// and long hair hang as curtains; ponytails are tubes on the hair0..2 spring bones; buns, curls, beards and moustaches.
//   CharHair.hair(ctx)  reads ctx.look.hair = { style, color, len, vol, part, seed, grey } and ctx.look.beard
//   CharHair.headSurf(ctx, phi, y, off, out, nrm?) · CharHair.hairline(h, |phi|) · CharHair.clump(ctx, pts, side, o)
//   CharHair.thick(look) -> hair height above the scalp on top (m, head scale), for hats
// Styles: crop side_part messy short buzz bald bob ponytail tied_back buns curly perm long receding comb
// ============================================================================
const CharHair = (() => {
  const { surf, W1, W2, gauss, sstep, clamp, lerp, vnoise, TAU } = CharBody;
  const V3 = THREE.Vector3;
  const headSurf = (ctx, phi, y, off, out, nrm) => CharHead.surf(ctx.D, phi, y, off, out, nrm);
  const rng = seed => { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
  const wrap = a => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
  const lodN = n => Math.max(4, Math.round(n * (CharBody.LOD < 1 ? 0.55 : 1)));

  // hairline height (head space) by |phi|
  function hairline(h, aphi) {
    const top = h.line ?? 0.066, rec = h.recede || 0, temple = h.temple ?? 0.022;
    const K = [[0, top + rec * 0.015], [0.45, top - 0.004 + rec * 0.02], [0.85, top - temple + rec * 0.035], [1.18, 0.012], [1.33, -0.012 + (h.burns ?? 0)], [1.42, -0.005], [1.55, 0.024], [1.75, 0.02], [2.1, -0.035], [2.6, -0.052], [Math.PI, -0.058]];
    let i = 0; while (i < K.length - 2 && aphi > K[i + 1][0]) i++;
    return lerp(K[i][1], K[i + 1][1], sstep(K[i][0], K[i + 1][0], aphi));
  }

  // shell height above the scalp (m, head scale) by |phi| a, t (0 hairline .. 1 crown), phi
  const VOL = {
    buzz: () => 0.0014, crop: (a, t) => 0.004 + 0.004 * t, receding: (a, t) => 0.0035 + 0.003 * t,
    side_part: (a, t, ph, h) => 0.005 + 0.011 * sstep(0.1, 0.7, t) * (1 - 0.45 * sstep(1.0, 2.4, a)) + 0.006 * Math.exp(-a * a / 0.5) * sstep(0.08, 0.4, t) * (1 - sstep(0.6, 1, t)) + 0.004 * sstep(0.4, 1, t) * Math.max(0, -Math.sin(ph - (h.part ?? 0.35))),
    short: (a, t) => 0.006 + 0.009 * sstep(0.2, 0.9, t), messy: (a, t) => 0.009 + 0.012 * sstep(0.15, 0.85, t),
    comb: (a, t) => 0.007 + 0.011 * sstep(0.15, 0.8, t) * (1 - 0.4 * sstep(1.5, 2.6, a)),
    bob: (a, t) => 0.009 + 0.008 * sstep(0.1, 0.8, t), ponytail: (a, t) => 0.004 + 0.002 * t, tied_back: (a, t) => 0.0045 + 0.002 * t, buns: () => 0.004,
    curly: (a, t) => 0.02 + 0.01 * t, perm: (a, t) => 0.014 + 0.006 * t, long: (a, t) => 0.008 + 0.004 * t,
  };
  const HATS = ['cap', 'beanie', 'helmet', 'hood_up'];
  const thick = look => { const h = look.hair; if (!h || h.style === 'bald') return 0.001; return VOL[h.style](0.3, 0.9, 0, h) * (h.vol ?? 1) + (h.style === 'curly' || h.style === 'perm' ? 0.006 : 0.002); };

  function hair(ctx) {
    const { look, A } = ctx, h = look.hair;
    if (look.beard) beard(ctx, look.beard);
    if (!h || h.style === 'bald') return;
    const st = h.style, parts = look.parts || {}, hatted = (look.acc || []).some(a => HATS.includes(a.k) && parts[a.part || a.k] !== false);
    const curl = st === 'curly' || st === 'perm';
    const spec = { t: 'hair', color: h.color, grey: h.grey || 0, curl, buzz: st === 'buzz' };
    A.alloc('hair_cap', 512, 256, Object.assign({ cap: true, part: st === 'side_part' || st === 'comb' ? h.part ?? 0.35 : null }, spec));
    A.alloc('hair', 256, 256, spec);
    const H = Object.assign({}, h, st === 'receding' ? { recede: 1 } : {});
    const vf = (a, t, ph) => VOL[st](a, t, ph, H) * (h.vol ?? 1) * (hatted ? 0.6 : 1);
    const C = { ctx, h: H, R: rng(h.seed ?? 7), vf, hatted };
    shell(C);
    if (st === 'buzz') return;
    const extra = { bob, ponytail, tied_back: tiedBack, buns, curly: curls, long: longHair }[st];   // short cuts are the shell alone
    if (extra) extra(C);
  }

  // Scalp shell from the hairline to the crown, thinning to nothing at the hairline so it meets the painted edge.
  function shell(C) {
    const { ctx, h, vf } = C, { mb, A } = ctx, r = A.R.hair_cap, rows = lodN(15), cols = lodN(64), p = new V3();
    const st = h.style, part = h.part ?? 0.35, seed = C.R() * 100, curl = st === 'curly' || st === 'perm';
    const parted = st === 'side_part' || st === 'comb';
    const swept = (st === 'bob' || st === 'long') && !C.hatted, sw = h.sweep ?? 0.35;
    const fringeAt = (st === 'messy' || st === 'short') && !C.hatted ? phi => { const a = Math.abs(phi); return a > 1.3 ? 0 : (st === 'messy' ? 0.016 : 0.008) * Math.pow(Math.max(0, Math.sin(phi * 9 + seed) * 0.6 + Math.sin(phi * 4.3 + seed * 2) * 0.5), 1.5) * sstep(1.3, 0.9, a); }
      : swept ? phi => 0.03 * Math.exp(-((phi - sw) ** 2) / 0.35) * sstep(1.4, 0.8, Math.abs(phi)) : null;   // bob/long: a fringe swept to one side
    const hc = new THREE.Color(h.color), sk = new THREE.Color(ctx.look.skin || '#c89070'), ratio = (a, b) => Math.min(3, a / Math.max(0.02, b)), toSkin = new THREE.Color(ratio(sk.r, hc.r), ratio(sk.g, hc.g), ratio(sk.b, hc.b)).multiplyScalar(0.8);   // a shaded skin tone: thin hair over scalp, not a pale band
    surf(mb, rows, cols, (i, j) => {
      const s = j / (cols - 1), phi = s * TAU - Math.PI, t = i / (rows - 1), a = Math.abs(phi);
      const tongue = fringeAt ? fringeAt(phi) : 0;                          // messy/short cuts: the front edge falls in uneven locks
      const y = lerp(hairline(h, a) - tongue, 0.126, Math.pow(t, 0.85)), edge = sstep(0, 0.14, t);
      let off = vf(a, t, phi) * edge;
      if (parted && a < 1.5) off -= 0.0022 * gauss(phi - part, 0.05) * sstep(0.1, 0.3, t) * (1 - sstep(0.75, 0.95, t));
      if (curl) off += (st === 'perm' ? 0.004 : 0.007) * edge * (0.5 + 0.5 * Math.sin(phi * (st === 'perm' ? 22 : 13) + seed) * Math.sin(t * (st === 'perm' ? 26 : 15) + phi * 3));
      else off += edge * (0.0009 * vnoise(phi * 9 + seed, t * 3) + (st === 'messy' ? 0.0035 * vnoise(phi * 5 + seed, t * 4 + seed) : 0));
      headSurf(ctx, phi, y, off + 0.0005, p);
      const [u, v] = A.uv(r, s, t);
      const fade = st === 'buzz' ? 0.5 : sstep(0.07, 0, t) * 0.4;           // the front edge melts into the skin (buzz cuts show scalp throughout)
      return { p: p.clone(), u, v, w: W1('head'), c: new THREE.Color(0.85, 0.85, 0.85).lerp(toSkin, fade * (a < 1.4 ? 1 : 0.6)), r: curl ? 0.8 : 0.7 };
    }, { wrap: true, rough: 0.7 });
  }

  // A tapered lock along a path of points (character space): flattened, rounded, smooth.
  // o: { w (root width), th (thickness), tip (taper power), flare, wt(t, p) -> weights, c, u0, region }
  function clump(ctx, pts, side, o) {
    const { mb, A } = ctx, r = o.region || A.R.hair, n = pts.length, cols = lodN(8);
    const col = o.c || new THREE.Color(1, 1, 1), u0 = o.u0 ?? 0;
    const T = new V3(), B = new V3(), N = new V3();
    surf(mb, n, cols, (i, j) => {
      const t = i / (n - 1), p = pts[i];
      T.subVectors(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)]).normalize();
      B.copy(side).addScaledVector(T, -side.dot(T)).normalize();
      N.crossVectors(T, B).normalize();
      const taper = Math.pow(1 - t * 0.96, o.tip ?? 0.7) * (o.flare ? 1 + o.flare * gauss(t - 0.15, 0.2) : 1);
      const a = (j / (cols - 1)) * TAU, wv = o.w * taper, th = (o.th ?? o.w * 0.35) * taper;
      const q = p.clone().addScaledVector(B, Math.cos(a) * wv * 0.5).addScaledVector(N, Math.sin(a) * th * 0.5);
      const [uu, vv] = A.uv(r, (u0 + (j / (cols - 1)) * 0.1) % 1, t);
      return { p: q, u: uu, v: vv, w: o.wt ? o.wt(t, p) : W1('head'), c: col, r: 0.7 };
    }, { wrap: true, rough: 0.7 });
  }
  const shade = (R, k = 0.1) => { const v = 1 - k + R() * k * 2; return new THREE.Color(v, v, v); };

  // ---- styles -------------------------------------------------------------------------------------
  // hair falling from the shell's edge as one smooth curtain between phi0..phi1 down to head-space y1,
  // bulging off the head and neck (two layers: the outside and the underside); lower rows follow the
  // neck/chest bones. o: { bulge, curl (inward turn at the ends), rows, cols }
  function curtain(C, phi0, phi1, y1, o = {}) {
    const { ctx, h } = C, { mb, A, D } = ctx, r = A.R.hair, cols = lodN(o.cols || 30), rows = lodN(o.rows || 12), p = new V3(), n = new V3();
    const G = [];
    for (let i = 0; i < rows; i++) {
      const row = [];
      for (let j = 0; j < cols; j++) {
        const s = j / (cols - 1), phi = lerp(phi0, phi1, s), a = Math.abs(wrap(phi)), t = i / (rows - 1);
        const top = hairline(h, a) + 0.02, y = lerp(top, y1, t), yh = Math.max(y, -0.118);
        const off = C.vf(a, 0.2, phi) * 0.9 + 0.003 + (o.bulge ?? 0.008) * Math.sin(Math.min(1, t * 1.3) * Math.PI * 0.8) + Math.max(0, -0.118 - y) * 0.45;
        headSurf(ctx, phi, yh, off, p, n);
        const q = p.clone(); if (y < -0.118) q.y -= (-0.118 - y) * D.hs;
        if (o.curl) { const k = sstep(0.75, 1, t) * o.curl * 0.012 * D.hs; q.x -= n.x * k; q.z -= n.z * k; }
        const lw = sstep(0.35, 1, t) * (y < -0.12 ? 1 : 0.4);
        row.push({ q, n: n.clone(), s, t, w: lw > 0.01 ? W2('head', y < -0.2 ? 'chest' : 'neck', lw * 0.8) : W1('head') });
      }
      G.push(row);
    }
    for (const inner of [false, true]) surf(mb, rows, cols, (i, j) => {
      const e = G[i][j], [u, v] = A.uv(r, e.s, e.t), th = inner ? 0.004 * D.hs * (1 - e.t * 0.6) : 0;
      return { p: e.q.clone().addScaledVector(e.n, -th), u, v, w: e.w, r: 0.7, c: inner ? new THREE.Color(0.6, 0.6, 0.6) : undefined };
    }, { rough: 0.7, back: inner });
  }

  function bob(C) {
    const { h } = C, len = h.len ?? 1, y1 = -0.075 - 0.035 * len;
    curtain(C, 0.62, TAU - 0.62, y1, { bulge: 0.008, curl: 1, cols: 34 });
  }
  function longHair(C) {
    const { h } = C, y1 = -0.16 - 0.12 * (h.len ?? 1);
    curtain(C, 0.75, TAU - 0.75, y1, { bulge: 0.01, rows: 16, cols: 34 });
  }
  // tail along the hair0 -> hair1 -> hair2 spring chain: a tapered, slightly flattened tube with a tie at the root
  function tail(C, len, thick, o = {}) {
    const { ctx } = C, { mb, A, J, D } = ctx, r = A.R.hair, hs = D.hs, rows = lodN(12), cols = lodN(12);
    const P0 = J.hair0, P1 = J.hair1, P2 = J.hair2, dir0 = new V3().subVectors(P1, P0).normalize();
    const end = P2.clone().addScaledVector(new V3().subVectors(P2, P1).normalize(), (len - 0.7) * 0.1 * hs + 0.02 * hs);
    const curve = new THREE.CatmullRomCurve3([P0.clone().addScaledVector(dir0, -0.01 * hs), P0, P1, P2, end]);
    const wt = t => t < 0.3 ? W2('hair0', 'hair1', t / 0.3) : W2('hair1', 'hair2', clamp((t - 0.3) / 0.45, 0, 1));
    const X = new V3(1, 0, 0), T = new V3(), N = new V3(), B = new V3();
    surf(mb, rows, cols, (i, j) => {
      const t = i / (rows - 1), c = curve.getPoint(t);
      curve.getTangent(t, T); B.copy(X).addScaledVector(T, -X.dot(T)).normalize(); N.crossVectors(T, B).normalize();
      const rr = thick * hs * (t < 0.12 ? lerp(0.55, 1, t / 0.12) : 1 + (o.bulge ?? 0.4) * Math.sin((t - 0.12) / 0.88 * Math.PI) - 0.85 * sstep(0.6, 1, t));
      const a = j / (cols - 1) * TAU;
      const q = c.clone().addScaledVector(B, Math.cos(a) * rr).addScaledVector(N, Math.sin(a) * rr * 0.8);
      const [u, v] = A.uv(r, j / (cols - 1), t);
      return { p: q, u, v, w: wt(t), r: 0.7 };
    }, { wrap: true, rough: 0.7 });
    band(ctx, curve.getPoint(0.06), dir0, thick * hs * 0.72, o.tie || '#1c1a1c');
  }
  function band(ctx, c, dir, rad, color) {
    const { mb, A } = ctx, r = A.alloc('tie' + color, 8, 8, { t: 'plain', color }), [u, v] = A.uv(r, 0.5, 0.5);
    const B = new V3(1, 0, 0).addScaledVector(dir, -dir.x).normalize(), N = new V3().crossVectors(dir, B), w = W2('head', 'hair0', 0.5);
    surf(mb, 3, 10, (i, j) => { const a = j / 9 * TAU, k = [0.9, 1.1, 0.9][i]; return { p: c.clone().addScaledVector(dir, (i - 1) * 0.004).addScaledVector(B, Math.cos(a) * rad * k).addScaledVector(N, Math.sin(a) * rad * k * 0.8), u, v, w }; }, { wrap: true, rough: 0.4 });
  }
  function ponytail(C) {
    const { ctx, h } = C;
    tail(C, (h.len ?? 0.2) / 0.2, 0.017, { bulge: 0.5 });
    // loose strands framing the face (spring bones): two thin, rounded wavy locks a side, the front one longer
    for (const [sd, bn] of [[1, 'strandL'], [-1, 'strandR']]) for (const [ph, y1, w] of [[0.93, -0.045, 0.0078], [1.06, -0.022, 0.0064]]) {
      const pts = [], p = new V3();
      for (let s = 0; s < 8; s++) { const t = s / 7; headSurf(ctx, sd * (ph - 0.07 * Math.sin(t * Math.PI) + 0.04 * t), lerp(0.058, y1, t), 0.0035 + 0.006 * t + 0.0015 * Math.sin(t * 9 + ph * 7), p); pts.push(p.clone()); }
      clump(ctx, pts, new V3(sd * 0.35, 0, 1).normalize(), { w: w * ctx.D.hs, th: w * 0.62 * ctx.D.hs, tip: 1.1, c: shade(C.R), u0: C.R(), wt: t => W2('head', bn, sstep(0.2, 0.7, t)) });
    }
  }
  function tiedBack(C) { tail(C, (C.h.len ?? 0.14) / 0.2, 0.012, { bulge: 0.25 }); }

  function buns(C) {
    const { ctx, R } = C, { mb, A, D } = ctx, hs = D.hs, r = A.R.hair, n = new V3(), c = new V3();
    for (const sd of [1, -1]) {
      headSurf(ctx, sd * 2.25, 0.098, 0.022 * hs, c, n);
      const rb = 0.03 * hs, up = n.clone(), B = new V3(0, 1, 0).cross(up).normalize(), N = new V3().crossVectors(up, B);
      const rows = lodN(12), cols = lodN(16), seed = R() * 10;
      surf(mb, rows, cols, (i, j) => {                                         // a swirled ball: u winds around, v from the base up
        const e = -0.35 + i / (rows - 1) * (Math.PI / 2 + 0.35), a = j / (cols - 1) * TAU;
        const bump = 1 + 0.08 * Math.sin(a * 3 + e * 4 + seed);
        const q = c.clone().addScaledVector(B, Math.cos(a) * Math.cos(e) * rb * bump).addScaledVector(N, Math.sin(a) * Math.cos(e) * rb * bump).addScaledVector(up, Math.sin(e) * rb * 0.9);
        const [u, v] = A.uv(r, ((j / (cols - 1)) + i / (rows - 1) * 0.6) % 1, i / (rows - 1));
        return { p: q, u, v, w: W1("head"), r: 0.7 };
      }, { wrap: true, rough: 0.7 });
      band(ctx, c.clone().addScaledVector(up, -rb * 0.3), up, rb * 0.75, '#e05a8a');
    }
  }
  // curls: the shell carries the bumps; loose ringlets hang round the edge
  function curls(C) {
    const { ctx, h, R } = C, hs = ctx.D.hs, perm = h.style === 'perm';
    if (perm || C.hatted) return;
    for (let k = 0; k < lodN(14); k++) {
      const phi = (R() * 2 - 1) * Math.PI, a = Math.abs(phi);
      if (a < 0.5 && C.hatted) continue;
      const y = hairline(h, a) + 0.004 + R() * 0.01, pts = [], p = new V3(), n = new V3();
      const L = (perm ? 0.018 : 0.03) * (h.len ?? 1), rc = (perm ? 0.004 : 0.006) * hs, a0 = R() * TAU;
      for (let s = 0; s < 8; s++) { const t = s / 7, an = a0 + t * TAU * 1.3; headSurf(ctx, phi + Math.cos(an) * 0.05 * t, y - t * L + Math.sin(an) * 0.004, C.vf(a, 0.05, phi) + 0.004 + Math.sin(an) * rc / hs, p, n); pts.push(p.clone()); }
      clump(ctx, pts, n, { w: (perm ? 0.012 : 0.018) * hs, th: 0.008 * hs, c: shade(R, 0.14), u0: R(), tip: 0.4 });
    }
  }

  // Beards: a shell over the jaw, chin, cheeks and upper lip (the mouth kept clear), weighted to the jaw below
  // the lip line; 'big' adds locks from the chin down the chest.
  function beard(ctx, b) {
    const { A, mb, D } = ctx, hs = D.hs, K = D.sdf.P, mY = K.mY, tY = K.tipY;
    const r = A.alloc('beard', 256, 128, { t: 'hair', color: b.color, grey: b.grey || 0, beard: true });
    const big = b.style === 'big', rows = lodN(16), cols = lodN(40), p = new V3(), seed = (b.seed ?? 11) * 1.7;
    const hc = new THREE.Color(b.color), sk = new THREE.Color(ctx.look.skin || '#c89070'), toSkin = new THREE.Color(sk.r / Math.max(0.02, hc.r), sk.g / Math.max(0.02, hc.g), sk.b / Math.max(0.02, hc.b));
    const top = a => a < 0.35 ? tY - 0.011 : a < 1.05 ? lerp(tY - 0.004, -0.018, (a - 0.35) / 0.7) : lerp(-0.018, 0.0, sstep(1.05, 1.4, a));
    const at = (i, j) => { const phi = (j / (cols - 1) * 2 - 1) * 1.42; return [phi, lerp(-0.127, top(Math.abs(phi)), i / (rows - 1))]; };
    surf(mb, rows, cols, (i, j) => {
      const [phi, y] = at(i, j), a = Math.abs(phi), t = i / (rows - 1);
      const edge = sstep(1, 0.8, t) * sstep(1.42, 1.25, a) * sstep(0, 0.2, t);
      const lip = Math.exp(-((phi / 0.42) ** 2) - ((y - mY + 0.001) / 0.009) ** 2);
      const off = (big ? 0.012 : 0.0045) * (b.len ?? 1) * edge * (1 - lip) * (1 + 0.25 * vnoise(phi * 12 + seed, y * 90)) + 0.0006;
      headSurf(ctx, phi, y, off, p);
      const [u, v] = A.uv(r, j / (cols - 1), t);
      const fade = Math.max(sstep(0.86, 1, t), sstep(1.25, 1.42, a)) * 0.6;   // the upper edge on the cheeks melts into the skin
      return { p: p.clone(), u, v, w: y < mY && a < 1.2 ? W2('head', 'jaw', 0.85 * sstep(mY, mY - 0.006, y)) : W1('head'), r: 0.65, c: new THREE.Color(1, 1, 1).lerp(toSkin, fade) };
    }, { rough: 0.7, skip: (i, j) => { const [phi, y] = at(i + 0.5, j + 0.5); return Math.abs(phi) < 0.36 && y > mY - 0.009 && y < mY + 0.004; } });
    if (big) {                                                             // the long beard: a full sheet from the jaw down the chest
      const L = 0.11 * (b.len ?? 1), rows2 = lodN(8), cols2 = lodN(18), G = [];
      for (let i = 0; i < rows2; i++) { const row = []; for (let j = 0; j < cols2; j++) {
        const t = i / (rows2 - 1), s2 = j / (cols2 - 1), phi = (s2 * 2 - 1) * 1.05 * (1 - 0.45 * t), q = new V3(), n = new V3();
        headSurf(ctx, phi, -0.112, 0.01, q, n);
        const hang = L * hs * t * (1 - 0.35 * Math.abs(s2 * 2 - 1) ** 2);
        q.y -= hang; q.z += (0.012 + 0.03 * Math.sin(t * 1.8)) * hs * t; row.push({ q, s2, t });
      } G.push(row); }
      for (const inner of [false, true]) surf(mb, rows2, cols2, (i, j) => {
        const e = G[i][j], [u, v] = A.uv(r, e.s2, 1 - e.t);
        return { p: e.q.clone().add(new V3(0, 0, inner ? -0.008 * hs * (1 - e.t * 0.5) : 0)), u, v, w: W2('head', 'jaw', 0.85), r: 0.7, c: inner ? new THREE.Color(0.6, 0.6, 0.6) : undefined };
      }, { rough: 0.7, back: inner });
    }
  }

  return { hair, headSurf, hairline, clump, thick };
})();
