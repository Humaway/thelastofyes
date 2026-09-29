// ============================================================================
// CharHair — styled hair (chars agent, internal to Chars): a smooth shell over the scalp that follows the
// hairline, swells by style and carries a strand-flow texture (u around the head, v from the hairline to
// the crown, painted with a sheen band); messy cuts and bobs shape their fringe into its front edge; bobs
// and long hair hang as curtains; ponytails are tubes on the hair0..2 spring bones; buns, curls, beards and moustaches.
//   CharHair.hair(ctx)  reads ctx.look.hair = { style, color, len, vol, part, seed, grey } and ctx.look.beard
//   CharHair.headSurf(ctx, phi, y, off, out, nrm?) · CharHair.hairline(h, |phi|) · CharHair.clump(ctx, pts, side, o)
//   CharHair.thick(look) -> hair height above the scalp on top (m, head scale), for hats
//   CharHair.cardMesh(B)  heroes: alpha-cut strand cards over the shell (soft hairline, locks, a broken silhouette), one
//                         Mesh on the head bone rebuilt with the body (ctx.B.cardGeo from CharHair.hair)
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
    const K = [[0, top + rec * 0.015], [0.45, top - 0.004 + rec * 0.02], [0.85, top - temple + rec * 0.035], [1.18, 0.012], [1.33, -0.012 + (h.burns ?? 0)], [1.42, -0.005], [1.55, 0.024], [1.75, 0.02], [2.1, -0.04], [2.6, -0.063], [Math.PI, -0.072]];
    let i = 0; while (i < K.length - 2 && aphi > K[i + 1][0]) i++;
    return lerp(K[i][1], K[i + 1][1], sstep(K[i][0], K[i + 1][0], aphi));
  }

  // shell height above the scalp (m, head scale) by |phi| a, t (0 hairline .. 1 crown), phi
  const VOL = {
    buzz: () => 0.0014, crop: (a, t) => 0.004 + 0.004 * t, receding: (a, t) => 0.0035 + 0.003 * t,
    side_part: (a, t, ph, h) => 0.004 + 0.01 * sstep(0.1, 0.7, t) * (1 - 0.55 * sstep(0.8, 2.2, a)) + 0.007 * Math.exp(-a * a / 0.4) * sstep(0.08, 0.4, t) * (1 - sstep(0.6, 1, t)) + 0.004 * sstep(0.4, 1, t) * Math.max(0, -Math.sin(ph - (h.part ?? 0.35))),   // lift at the front, close at the temples
    short: (a, t) => 0.006 + 0.009 * sstep(0.2, 0.9, t), messy: (a, t) => 0.009 + 0.012 * sstep(0.15, 0.85, t),
    comb: (a, t) => 0.007 + 0.011 * sstep(0.15, 0.8, t) * (1 - 0.4 * sstep(1.5, 2.6, a)),
    bob: (a, t) => 0.009 + 0.008 * sstep(0.1, 0.8, t), ponytail: (a, t) => 0.004 + 0.002 * t, tied_back: (a, t) => 0.0045 + 0.002 * t, buns: () => 0.004,
    curly: (a, t) => 0.02 + 0.01 * t, perm: (a, t) => 0.014 + 0.006 * t, long: (a, t) => 0.008 + 0.004 * t,
  };
  const HATS = ['cap', 'beanie', 'helmet', 'hood_up'], SHORT = { crop: 1, side_part: 1, messy: 1, short: 1, receding: 1, comb: 1 };
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
    const taper = SHORT[st] ? (a, t) => 1 - 0.6 * sstep(1.4, 2.5, a) * (1 - sstep(0.15, 0.6, t)) : () => 1;   // short cuts: close at the nape and over the ears
    const vf = (a, t, ph) => VOL[st](a, t, ph, H) * (h.vol ?? 1) * (hatted ? 0.6 : 1) * taper(a, t);
    const C = { ctx, h: H, R: rng(h.seed ?? 7), vf, hatted, carded: CharBody.LOD >= 1 && !hatted && !!FLOW[st] };
    shell(C);
    if (C.carded) cards(C);
    if (st === 'buzz') return;
    const extra = { bob, ponytail, tied_back: tiedBack, buns, curly: curls, long: longHair }[st];   // short cuts are the shell alone
    if (extra) extra(C);
  }

  // Scalp shell from the hairline to the crown, thinning to nothing at the hairline so it meets the painted edge (over a
  // longer rise at the sides, so short hair lies close over the ears).
  const edgeK = a => 0.22 + 0.14 * sstep(0.9, 1.6, a);
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
      const y = lerp(hairline(h, a) - tongue, 0.126, Math.pow(C.carded ? 0.1 + 0.9 * t : t, 0.85)), edge = sstep(0, edgeK(a), t);   // carded: the painted scalp and the cards make the hairline
      let off = vf(a, t, phi) * edge;
      if (parted && a < 1.5) off -= 0.0022 * gauss(phi - part, 0.05) * sstep(0.1, 0.3, t) * (1 - sstep(0.75, 0.95, t));
      if (curl) off += (st === 'perm' ? 0.004 : 0.007) * edge * (0.5 + 0.5 * Math.sin(phi * (st === 'perm' ? 22 : 13) + seed) * Math.sin(t * (st === 'perm' ? 26 : 15) + phi * 3));
      else off += edge * (0.0009 * vnoise(phi * 9 + seed, t * 3) + (st === 'messy' ? 0.0035 * vnoise(phi * 5 + seed, t * 4 + seed) : 0));
      headSurf(ctx, phi, y, off + 0.0005, p);
      const [u, v] = A.uv(r, s, t);
      const fade = st === 'buzz' ? 0.5 : C.carded ? 0 : sstep(0.07, 0, t) * 0.4;   // the front edge melts into the skin (buzz cuts show scalp throughout)
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

  // ---- strand cards -------------------------------------------------------------------------------------
  // Each card is a ribbon lying on the shell along the style's flow, textured with alpha-cut strands. FLOW[style](phi, t, R)
  // -> card specs: roots (phi, t) with a direction in (phi, t) per step; 'up' cards grow from the hairline toward the crown,
  // 'fall' cards from the crown down the sides and back, 'to' cards toward a point (a tie or a bun).
  const FLOW = {
    side_part: h => ({ front: 70, fall: 70, sweep: (phi, t) => (phi < (h.part ?? 0.35) ? -1 : 0.8) * (0.4 + 0.9 * t), lift: 0.0025 }),
    comb: h => ({ front: 60, fall: 60, sweep: (phi, t) => (phi < (h.part ?? 0.35) ? -0.6 : 0.5) * (0.3 + 0.6 * t), lift: 0.002 }),
    short: () => ({ front: 60, fall: 70, sweep: phi => 0.25 * Math.sign(phi), lift: 0.002 }),
    crop: () => ({ front: 45, fall: 60, sweep: phi => 0.2 * Math.sign(phi), lift: 0.0012, len: 0.6 }),
    receding: () => ({ front: 30, fall: 60, sweep: phi => 0.2 * Math.sign(phi), lift: 0.0012, len: 0.6 }),
    messy: () => ({ front: 80, fall: 80, sweep: (phi, t, R) => (R() - 0.5) * 1.6, lift: 0.004, spike: 1 }),
    ponytail: () => ({ front: 90, fall: 40, to: [Math.PI, 0.02], lift: 0.0012 }),
    tied_back: () => ({ front: 80, fall: 40, to: [Math.PI, 0.02], lift: 0.0012 }),
    buns: () => ({ front: 90, fall: 50, to: [2.25, 0.098], lift: 0.0012 }),
    bob: h => ({ front: 40, fall: 90, sweep: phi => (phi < (h.sweep ?? 0.35) ? -0.5 : 0.5), lift: 0.0025 }),
    long: h => ({ front: 40, fall: 90, sweep: phi => (phi < (h.sweep ?? 0.35) ? -0.5 : 0.5), lift: 0.0025 }),
  };
  function cards(C) {
    const { ctx, h, R, vf } = C, { D, J } = ctx, F = FLOW[h.style](h), hs = D.hs, p = new V3(), n = new V3(), q = new V3();
    const yAt = (phi, t) => { const y0 = hairline(h, Math.abs(phi)); return t < 0 ? y0 + t * (0.126 - y0) : lerp(y0, 0.126, Math.pow(Math.min(t, 1), 0.85)); };
    const at = (phi, t, lift, out, nrm) => { const a = Math.abs(phi), ts = clamp((t - 0.1) / 0.9, 0, 1); return headSurf(ctx, phi, yAt(phi, t), vf(a, ts, phi) * sstep(0, edgeK(a), ts) + lift, out, nrm); };   // on the shell (which starts at t 0.1)
    const pos = [], nor = [], uv = [], col = [], idx = [];
    const card = (phi, t, dir, L, w, lift, tone, tMin = -0.1) => {
      const N = 7, seg = L * hs / (N - 1), pts = [], nrm = [];
      let scale = 0;
      for (let k = 0; k < N; k++) {
        const lk = lift * (1 + k / (N - 1) * (F.spike ? 1.8 : 0.6));
        at(phi, t, lk, p, n); pts.push(p.clone()); nrm.push(n.clone());
        const [dp, dt] = dir(phi, t, k);                                          // step so the 3D segment is ~seg long (scale probed once)
        if (!k) { at(phi + dp * 0.05, t + dt * 0.05, lk, q); scale = 0.05 / Math.max(1e-5, q.distanceTo(p)); }
        phi += dp * seg * scale; t += dt * seg * scale;
        if (t > 0.97 || t < tMin) { if (k < 2) return; break; }
      }
      const n0 = pos.length / 3, u0 = Math.floor(R() * 4) / 4, tilt = (R() - 0.5) * 0.55, Tn = new V3(), B = new V3(), M = pts.length;
      for (let k = 0; k < M; k++) {
        Tn.subVectors(pts[Math.min(M - 1, k + 1)], pts[Math.max(0, k - 1)]).normalize();
        B.crossVectors(Tn, nrm[k]).normalize().multiplyScalar(Math.cos(tilt)).addScaledVector(nrm[k], Math.sin(tilt));
        const ww = w * hs * (1 - 0.55 * (k / (M - 1)) ** 2) * 0.5, v = k / (M - 1);
        for (const sd of [-1, 1]) {
          const c = pts[k].clone().addScaledVector(B, sd * ww).sub(J.head);
          pos.push(c.x, c.y, c.z); nor.push(nrm[k].x, nrm[k].y, nrm[k].z); uv.push(u0 + (sd > 0 ? 0.25 : 0), v); col.push(tone, tone, tone);
        }
        if (k) { const a = n0 + (k - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
    };
    const len = F.len ?? 1;
    const toward = (phi, t) => {                                              // direction toward F.to (both sides mirror to the tie)
      const tp = F.to[0] * (F.to[0] < 3 ? Math.sign(phi) || 1 : 1), ty = F.to[1];
      if (Math.abs(phi) < 1.1 && t < 0.85) return [0.2 * Math.sign(U.wrapAngle(tp - phi)), 1];   // the front is drawn straight back over the top
      return [U.wrapAngle(tp - phi), (ty - yAt(phi, t)) / Math.max(0.02, 0.126 - hairline(h, Math.abs(phi)))];
    };
    // front: from just in front of the hairline, over the top
    for (let i = 0; i < F.front; i++) {
      const phi = (R() * 2 - 1) * (F.to ? 1.55 : 1.3), t = (F.to ? 0.01 : -0.06) + R() * 0.14, sw = F.sweep ? F.sweep(phi, t, R) : 0;   // hair drawn back starts at the hairline
      const dir = F.to ? (ph, tt) => toward(ph, tt) : (ph, tt) => [F.sweep ? F.sweep(ph, tt, R) * 0.5 + sw * 0.5 : 0, 1];
      card(phi, t, dir, (0.05 + R() * 0.05) * len, 0.012 + R() * 0.008, F.lift * (0.5 + R()), 0.85 + R() * 0.3);
    }
    // fall: from the crown down the sides and back (tie styles: along the head toward the tie)
    for (let i = 0; i < F.fall; i++) {
      const phi = (R() * 2 - 1) * Math.PI, a = Math.abs(phi), t = F.to ? 0.1 + R() * 0.5 : 0.35 + R() * 0.55;
      if (!F.to && a < 1.0 && R() < 0.7) continue;
      const dir = F.to ? (ph, tt) => toward(ph, tt) : (ph, tt) => [F.sweep ? F.sweep(ph, tt, R) * 0.3 : 0, -1];
      card(phi, t, dir, (0.05 + R() * 0.05) * len, 0.013 + R() * 0.008, F.lift * (0.5 + R()), 0.8 + R() * 0.3, SHORT[h.style] ? 0.06 : -0.05);   // short cuts end neatly above the ears
    }
    if (!pos.length) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
    ctx.B.cardGeo = g;
  }
  // strand texture: four lock columns of fine strands (alpha-cut), roots at v = 0, thinning to the tips; cached per colour
  const cardMats = new Map();
  function cardMat(h) {
    const key = h.color + '|' + (h.grey || 0) + '|' + h.style;
    if (cardMats.has(key)) return cardMats.get(key);
    const W = 256, Hc = 256, cv = document.createElement('canvas'); cv.width = W; cv.height = Hc;
    const g = cv.getContext('2d'), R = rng(key.length * 97 + 5), { rgbOf, css, mix, mul } = CharPaint, base = rgbOf(h.color), grey = h.grey || 0;
    for (let lock = 0; lock < 4; lock++) for (let i = 0; i < 70; i++) {
      const cx = (lock + 0.5) / 4 * W, x = cx + (R() + R() + R() - 1.5) * W / 4 * 0.42, y0 = Hc * (1 - 0.14 * R()), end = Hc * (0.45 + 0.55 * Math.sqrt(R()));   // staggered roots: no hard card edge
      const c0 = R() < grey ? mix(base, [210, 208, 202], 0.85) : mul(base, 0.75 + R() * 0.5);
      const gr = g.createLinearGradient(0, y0, 0, Hc - end);
      gr.addColorStop(0, css(mul(c0, 0.7))); gr.addColorStop(0.45, css(mix(c0, [255, 240, 220], 0.12 + R() * 0.12))); gr.addColorStop(1, css(c0));
      g.strokeStyle = gr; g.lineWidth = 1 + R() * 1.6; g.beginPath(); g.moveTo(x, y0);
      g.bezierCurveTo(x + (R() - 0.5) * 10, Hc - end * 0.35, x + (R() - 0.5) * 14, Hc - end * 0.7, x + (R() - 0.5) * 16, Hc - end); g.stroke();
    }
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; tex.userData.shared = true;
    const m = new THREE.MeshStandardMaterial({ map: tex, vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.62, metalness: 0 });
    m.userData.shared = true;
    cardMats.set(key, m);
    return m;
  }
  // (re)attach the card mesh to the head bone after the body geometry was generated
  function cardMesh(B) {
    if (B.cards) { B.cards.parent.remove(B.cards); B.cards.geometry.dispose(); B.cards = null; }
    if (!B.cardGeo) return;
    const m = new THREE.Mesh(B.cardGeo, cardMat(B.look.hair)); m.receiveShadow = true;
    B.bones.head.add(m); B.cards = m; B.cardGeo = null;
  }

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

  return { hair, headSurf, hairline, clump, thick, cardMesh };
})();
