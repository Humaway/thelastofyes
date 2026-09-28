// ============================================================================
// CharDress — turns a look's outfit and accessories into geometry on the body MB (chars agent,
// internal to Chars).   CharDress.dress(ctx)   ctx = { D, J, look, mb, A (atlas), B }
// Garments are the body surfaces pushed outward per layer (inner -> outer), with flat-shaded folds.
// Skin is generated only where nothing covers it. Every region is registered in the atlas with a paint
// spec (CharPaint paints them once per look).
// Garments (look.outfit, {k, color, fab, ...}): tee polo shirt singlet hoodie jumper cardigan jacket vest puffer
//   coat robe scrubs armour apron pants shorts shoes.   Accessories (look.acc, {k, ...}): belt watch cap beanie
//   helmet glasses goggles head_torch gas_mask tie_headband headset switchboard earpiece lanyard backpack bumbag
//   toolbelt holster sweatband armband gloves radio pet manual_pocket hood_up
// look.parts toggles (c.setPart): jacket glasses cap goggles ('up'|'on'|false) beanie lanyard backpack sweatband ('up'|'down')
// ============================================================================
const CharDress = (() => {
  const { torsoLoft, limb, hand, foot, neckTube, surf, W1, W2, BI, gauss, sstep, clamp, lerp, vnoise, TAU } = CharBody;
  const V3 = THREE.Vector3, M4 = THREE.Matrix4;
  const WH = new THREE.Color(1, 1, 1);
  const TOPS = { tee: 1, polo: 1, shirt: 1, hoodie: 1, jumper: 1, jacket: 1, vest: 1, cardigan: 1, scrubs: 1, robe: 1, puffer: 1, coat: 1, armour: 1, apron: 1, singlet: 1 };
  const LEGS = { pants: 1, shorts: 1 };
  const INNER = { tee: 1, polo: 1, shirt: 1, singlet: 1, scrubs: 1 };
  const part = (ctx, n) => (ctx.look.parts || {})[n];

  function dress(ctx) {
    const { look } = ctx;
    const out = (look.outfit || []).filter(g => !(g.part && part(ctx, g.part) === false));
    ctx.sleeve = { L: 0, R: 0 }; ctx.legCover = 0; ctx.shoeTop = 0; ctx.layer = 0; ctx.outerD = 0;
    for (const g of out) {
      const sl = g.sleeve ?? SLEEVE[g.k];
      if (TOPS[g.k] && sl) for (const S of 'LR') ctx.sleeve[S] = Math.max(ctx.sleeve[S], sl);
      if (LEGS[g.k]) ctx.legCover = Math.max(ctx.legCover, g.len ?? (g.k === 'shorts' ? 0.4 : 1));
      if (g.k === 'shoes') ctx.shoeTop = Math.max(ctx.shoeTop, g.shaft || SHAFT[g.style || 'sneaker']);
    }
    skin(ctx, out);
    const rank = g => g.k === 'shoes' ? 0 : INNER[g.k] && g.tuck ? 1 : LEGS[g.k] ? 2 + (g.over ? 0.5 : 0) : INNER[g.k] ? 3 : 4 + (g.outer || 0);
    const ordered = out.map((g, i) => [g, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map(e => e[0]);
    let li = 0;
    ordered.forEach((g, i) => { ctx.layer = g.k === 'shoes' ? 0 : li++; ctx.outerSleeve = Math.max(0, ...ordered.slice(i + 1).filter(o => TOPS[o.k]).map(o => o.sleeve ?? SLEEVE[o.k] ?? 0)); G[g.k](ctx, g); });
    for (const a of look.acc || []) if (ACC[a.k] && !(a.part && part(ctx, a.part) === false)) ACC[a.k](ctx, a);   // gloves are drawn with the hands
    if (look.infAcc) look.infAcc(ctx);
    CharHair.hair(ctx);
  }
  const SLEEVE = { tee: 0.24, polo: 0.26, shirt: 1, hoodie: 1, jumper: 1, cardigan: 1, jacket: 1, puffer: 1, coat: 1, robe: 0.95, scrubs: 0.24 };
  const SHAFT = { sneaker: 0.06, boot: 0.2, dress: 0.05, slipper: 0.04, sock: 0.22, fluffy: 0.16, sandal: 0.02 };
  const offL = (ctx, g) => (0.0045 + ctx.layer * 0.0075 + (g.ease || 0)) * ctx.D.s;

  // ---- skin ------------------------------------------------------------------------------------
  function skin(ctx, out) {
    const { D, look } = ctx, sp = { t: 'skin', color: look.skin, look };
    ctx.A.alloc('skin', 128, 128, sp); ctx.A.alloc('skin_hand', 128, 128, Object.assign({ hand: true }, sp)); ctx.A.alloc('skin_arm', 128, 128, sp);
    if (!out.some(g => TOPS[g.k] && g.k !== 'apron')) torsoLoft(ctx, D.H * 0.455, D.H * 0.842, { region: 'skin', rough: 0.6 });
    neckTube(ctx);
    const gl = (look.acc || []).find(a => a.k === 'gloves');
    for (const S of 'LR') {
      const s0 = ctx.sleeve[S] > 0 ? ctx.sleeve[S] - 0.04 : -0.05;
      if (s0 < 1) limb(ctx, S, 'arm', s0, 1.0, { region: 'skin_arm', rough: 0.6, capTop: ctx.sleeve[S] <= 0 });
      hand(ctx, S, { region: 'skin_hand', color: look.handTint ? new THREE.Color(look.handTint) : WH, rough: 0.6 });
      if (gl) hand(ctx, S, { region: 'glove', paint: { t: 'cloth', fab: 'leather', color: gl.color || '#1c1b1a' }, scale: 1.08, fingerless: gl.fingerless, rough: 0.7 });
      const l0 = ctx.legCover > 0 ? ctx.legCover - 0.05 : -0.08, l1 = 1 - Math.max(0, ctx.shoeTop - 0.02);
      if (l0 < l1) limb(ctx, S, 'leg', l0, l1, { region: 'skin', rough: 0.6, capTop: ctx.legCover <= 0 });
      if (!out.some(g => g.k === 'shoes')) foot(ctx, S, { region: 'skin', rough: 0.6, soleH: 0.004, top: 0.06, flat: 0 });
    }
  }
  const ao = k => new THREE.Color(k, k, k);

  // ---- building blocks ------------------------------------------------------------------------------
  // torso-riding weights
  function CharBodyW(D, p) {
    const h = p.y / D.H;
    if (h > 0.83) return W2('chest', 'neck', sstep(0.83, 0.86, h));
    if (h > 0.64) return W2('spine', 'chest', sstep(0.64, 0.72, h));
    return W2('hips', 'spine', sstep(0.555, 0.625, h));
  }
  // coat hem sway: blend the lower panels onto the coat spring bones
  function coatW(D, p, phi, base) {
    const h = p.y / D.H, k = sstep(0.62, 0.5, h) * 0.75;
    if (k <= 0) return base;
    const c = Math.cos(phi), sn = Math.sin(phi);
    const bn = c < -0.3 ? 'coatB' : sn >= 0 ? 'coatL' : 'coatR';
    return base.map(e => [e[0], e[1] * (1 - k)]).concat([[BI[bn], k]]);
  }
  // Common top: torso loft + sleeves + neckline. g: { color, fab, sleeve, tuck, hem (h), loose, gap (open-front half angle), vDepth }
  function top(ctx, g, key, o = {}) {
    const { D } = ctx, H = D.H, d = offL(ctx, g), loose = g.loose ?? 1;
    const hem = (g.hem ?? (g.tuck ? 0.575 : o.hem ?? 0.49)) * H;
    const paint = Object.assign({ t: 'cloth' }, g, { key });
    const seed = (g.seed ?? 3) + ctx.layer * 7, puff = o.puff || 0;
    const folds = (h, phi) => {
      const waist = gauss(h - 0.585, 0.045) * (g.tuck ? 1 : 0.5), low = sstep(0.62, 0.5, h);
      return D.s * (loose * 0.004 * (1 + vnoise(phi * 3.2 + seed, h * 18)) * (0.4 + low) + 0.0035 * waist * vnoise(phi * 7 + seed, h * 40) + (g.tuck ? 0.004 * waist : 0) + (puff ? puff * Math.pow(Math.abs(Math.sin(h * H / 0.075 * Math.PI)), 0.5) : 0));
    };
    const off = { d: (h, phi) => d + (loose * (g.tuck ? 0.002 : 0.006) * sstep(0.7, 0.55, h) + 0.003 * loose * gauss(h - 0.72, 0.05) + (g.tuck ? 0 : 0.016 * sstep(0.54, 0.47, h) * (0.6 + 0.4 * Math.abs(Math.sin(phi)))) + (o.bulk || 0)) * D.s * (Math.cos(phi) > 0 ? 1 : 0.8), soft: 0.35 };
    const gap = g.gap || 0, nk = o.neck ?? 0.842, drop = o.drop ?? 0.012, dw = o.dropW || 0.3;
    const neckline = phi => { const f = U.wrapAngle(phi); return nk - drop * Math.exp(-(f * f) / dw); };
    const skip = o.skip || (o.armholes ? (h, phi) => h > 0.715 && Math.abs(Math.sin(phi)) > 0.78 : null);
    torsoLoft(ctx, hem, nk * H, { region: key, regionSize: [512, 256], paint, off, folds, flat: o.flat ?? 0.55, rough: g.rough ?? 0.9, gap, top: neckline, skirt: hem < 0.5 * H, skip,
      flareY: g.tuck ? null : Math.max(hem + 0.04 * H, 0.53 * H), flare: loose * (o.flare ?? 0.02) * D.s, rows: Math.round((nk * H - hem) / (0.02 * D.s)), cols: gap ? 30 : 26,
      coat: o.coat, shade: (h, phi) => ao(1 - 0.12 * gauss(h - 0.77, 0.03) * gauss(Math.abs(Math.sin(phi)) - 1, 0.25)) });
    const sl = g.sleeve ?? SLEEVE[g.k] ?? 0.25;
    if (sl > 0 && ctx.outerSleeve < Math.max(sl, 0.5)) for (const S of 'LR') {
      limb(ctx, S, 'arm', -0.05, sl, { region: key + '_sl', regionSize: [256, 128], paint: Object.assign({ sleeve: true }, paint), flat: o.flat ?? 0.4, rough: g.rough ?? 0.9, capTop: true, cols: 16,
        off: s => d + ((o.bulk || 0) * 0.8 + 0.003 + 0.008 * loose * sstep(0.05, sl, s) * (sl < 0.6 ? 1 : 0.4)) * D.s + (sl >= 0.9 ? 0.004 * D.s * sstep(0.85, 0.98, s) : 0),
        folds: (s, phi, se) => D.s * (0.0035 * loose * vnoise(phi * 2.5 + seed + (S === 'L' ? 5 : 0), s * 22) * (sl > 0.6 ? 1 + 1.5 * gauss(s - se, 0.08) : 1) + (puff ? puff * Math.pow(Math.abs(Math.sin(s * 14)), 0.5) : 0)) });
      if (g.cuff !== false && sl > 0.8) limb(ctx, S, 'arm', sl - 0.035, sl + 0.002, { region: key + '_rib', regionSize: [128, 64], paint: Object.assign({ rib: true }, paint), off: d + ((o.bulk || 0) * 0.8 + 0.0035) * D.s, flat: 0.3, rough: 0.95, cols: 14 });
    }
    const dS = d + ((o.bulk || 0) + 0.003 * loose) * D.s;              // outer surface incl. bulk and typical folds
    ctx.outerD = Math.max(ctx.outerD, dS);
    return { hem, d: dS, neckline, paint, gap };
  }
  // band following the torso surface between heights h0..h1 (fractions or phi-functions)
  function band(ctx, key, paint, h0, h1, d0, d1, o = {}) {
    const { D, mb, A } = ctx, r = A.alloc(key, ...(o.size || [256, 64]), paint);
    const rows = o.rows || 3, cols = o.cols || 26, gap = o.gap || 0, p = new V3();
    return surf(mb, rows, cols, (i, j) => {
      const t = i / (rows - 1), s = j / (cols - 1);
      const phi = gap ? lerp(gap, TAU - gap, s) : s * TAU - Math.PI;
      const h = typeof h0 === 'function' ? lerp(h0(phi), h1(phi), t) : lerp(h0, h1, t);
      CharBody.torsoPt(D, h * D.H, phi, { d: lerp(d0, d1, t) * D.s + (o.dPhi ? o.dPhi(phi, t) * D.s : 0), soft: 0.3 }, p);
      const [u, v] = A.uv(r, s, t);
      return { p: p.clone(), u, v, w: CharBodyW(D, p) };
    }, { wrap: !gap, flat: o.flat ?? 0.3, rough: o.rough ?? 0.9, skip: o.skip });
  }
  // flat patch conforming to the torso (badges, pockets, logos). at: [phi, h]; size [dPhi (rad), dH (fraction)]
  function patch(ctx, key, spec, at, size, dOff, o = {}) {
    const { D, mb, A } = ctx, r = A.alloc(key, ...(o.px || [128, 64]), spec), p = new V3(), rows = 3, cols = 4;
    return surf(mb, rows, cols, (i, j) => {
      const phi = at[0] + (j / (cols - 1) - 0.5) * size[0], h = at[1] + (i / (rows - 1) - 0.5) * size[1];
      CharBody.torsoPt(D, h * D.H, phi, { d: dOff + (o.bulge ? o.bulge * D.s * Math.sin(Math.PI * i / (rows - 1)) * Math.sin(Math.PI * j / (cols - 1)) : 0), soft: 0.3 }, p);
      const [u, v] = A.uv(r, j / (cols - 1), i / (rows - 1));
      return { p: p.clone(), u, v, w: CharBodyW(D, p) };
    }, { flat: 0.2, rough: o.rough ?? 0.7, out: new V3(Math.sin(at[0]), 0, Math.cos(at[0])) });
  }
  // vertical strip along a front edge (zips, button bands, lapels)
  function edge(ctx, key, spec, phi, h0, h1, d, w, o = {}) {
    const { D, mb, A } = ctx, r = A.alloc(key, 32, 128, spec), p = new V3(), rows = o.rows || 10;
    return surf(mb, rows, 3, (i, j) => {
      const t = i / (rows - 1), h = lerp(h0, typeof h1 === 'function' ? h1() : h1, t), ph = phi + (j - 1) * w * 0.5;
      CharBody.torsoPt(D, h * D.H, ph, { d: d + (o.lift || 0) * D.s * (j === 1 ? 1 : 0.4), soft: 0.3, skirt: h < 0.5 }, p);
      const [u, v] = A.uv(r, j / 2, t);
      return { p: p.clone(), u, v, w: o.coat ? coatW(D, p, ph, CharBodyW(D, p)) : CharBodyW(D, p) };
    }, { flat: 0.3, rough: o.rough ?? 0.8, out: new V3(Math.sin(phi), 0, Math.cos(phi)) });
  }
  function collarFold(ctx, key, paint, t, o = {}) {                   // shirt/polo/jacket collar: stand + fall with points at the front
    const { D } = ctx, d = t.d / D.s, nl = t.neckline, big = o.big || 1, gap = Math.max(t.gap || 0, o.gap ?? 0.16);
    const stand = phi => nl(phi) + 0.011 * big * (1 - 0.6 * Math.exp(-phi * phi / 0.2));
    band(ctx, key + '_col', Object.assign({ collar: true }, paint), nl, stand, d + 0.0008, d + 0.0002, { gap, rows: 2, cols: 24, flat: 0.2 });
    band(ctx, key + '_col', paint, stand, phi => nl(phi) - (0.009 + 0.012 * Math.exp(-phi * phi / 0.08)) * big - (o.lapel || 0) * Math.exp(-phi * phi / 0.12), d + 0.003, d + 0.011 * big, { gap: gap - 0.06, rows: 3, cols: 24, flat: 0.5,
      dPhi: (phi, tt) => tt * 0.004 * big * Math.exp(-phi * phi / 0.1) });
  }
  function crewNeck(ctx, key, paint, t) {
    band(ctx, key + '_rib', Object.assign({ rib: true }, paint), t.neckline, phi => t.neckline(phi) + 0.007, t.d / ctx.D.s + 0.0012, t.d / ctx.D.s + 0.0006, { rows: 2, cols: 28, size: [256, 32] });
  }
  function hemBand(ctx, key, paint, t, h, d) {
    band(ctx, key + '_hem', Object.assign({ rib: true }, paint), h, h + 0.018, d, d, { rows: 2, cols: 28, size: [256, 32], gap: t.gap });
  }
  // rigid primitive (accessories): geometry in local units, placed by matrix M, weighted by wt (array or fn(p)), flat colour
  const _p = new V3(), _n = new V3(), _nm = new THREE.Matrix3();
  function prim(ctx, geo, M, wt, color, o = {}) {
    const { mb, A } = ctx, r = A.alloc('c' + color + (o.fab || ''), 16, 16, { t: o.fab ? 'cloth' : 'plain', color, fab: o.fab });
    const [u, v] = A.uv(r, 0.5, 0.5);
    const g = o.flat && geo.index ? geo.toNonIndexed() : geo;
    if (o.flat) g.computeVertexNormals();
    const P = g.attributes.position, N = g.attributes.normal, base = mb.n, col = o.c || WH;
    _nm.getNormalMatrix(M);
    for (let i = 0; i < P.count; i++) {
      _p.fromBufferAttribute(P, i).applyMatrix4(M); _n.fromBufferAttribute(N, i).applyMatrix3(_nm).normalize();
      mb.v(_p, _n, u, v, col, typeof wt === 'function' ? wt(_p) : wt, o.rough ?? 0.6);
    }
    if (g.index) for (let i = 0; i < g.index.count; i += 3) mb.tri(base + g.index.getX(i), base + g.index.getX(i + 1), base + g.index.getX(i + 2));
    else for (let i = 0; i < P.count; i += 3) mb.tri(base + i, base + i + 1, base + i + 2);
    geo.dispose(); if (g !== geo) g.dispose();
  }
  // head space -> character space
  const headM = (ctx, pos, rot = [0, 0, 0], sc = [1, 1, 1]) => new M4().makeTranslation(ctx.D.headO.x, ctx.D.headO.y, ctx.D.headO.z).multiply(new M4().makeScale(ctx.D.hs, ctx.D.hs, ctx.D.hs))
    .multiply(new M4().compose(new V3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new V3(...sc)));
  const at = (p, rot = [0, 0, 0], sc = [1, 1, 1]) => new M4().compose(p, new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new V3(...sc));
  // tube along a path of points (character space)
  function tube(ctx, pts, rad, color, wt, o = {}) {
    const { mb, A } = ctx, r = A.alloc('c' + color, 16, 16, { t: 'plain', color }), [u, v] = A.uv(r, 0.5, 0.5), n = pts.length, cols = o.cols || 6;
    const T = new V3(), N1 = new V3(), N2 = new V3(), up = new V3(0, 1, 0);
    surf(mb, n, cols + 1, (i, j) => {
      T.subVectors(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)]).normalize();
      N1.crossVectors(T, Math.abs(T.y) > 0.9 ? new V3(1, 0, 0) : up).normalize(); N2.crossVectors(T, N1);
      const a = j / cols * TAU, rr = typeof rad === 'function' ? rad(i / (n - 1)) : rad;
      const p = pts[i].clone().addScaledVector(N1, Math.cos(a) * rr).addScaledVector(N2, Math.sin(a) * rr * (o.flatten || 1));
      return { p, u, v, w: typeof wt === 'function' ? wt(pts[i], i / (n - 1)) : wt };
    }, { wrap: true, rough: o.rough ?? 0.6, flat: o.flat ?? 0.2 });
  }
  // point on the outermost clothing surface of the torso
  const onTorso = (ctx, phi, h, extra = 0) => CharBody.torsoPt(ctx.D, h * ctx.D.H, phi, { d: (ctx.outerD || offL(ctx, {})) + extra * ctx.D.s, soft: 0.3 }, new V3());

  // ---- garments -------------------------------------------------------------------------------------
  const G = {
    tee(ctx, g) {
      const k = 'tee' + ctx.layer, t = top(ctx, Object.assign({ loose: 1.2 }, g), k, { neck: 0.842, drop: 0.014, dropW: 0.5 });
      crewNeck(ctx, k, t.paint, t);
      if (g.print) patch(ctx, k + '_pr', { t: 'print', print: g.print, color: g.color, ink: g.ink }, [0, 0.715], [0.9, 0.07], t.d + 0.005 * ctx.D.s, { px: [256, 128] });
    },
    singlet(ctx, g) { const k = 'singlet' + ctx.layer, t = top(ctx, Object.assign({ sleeve: 0, loose: 0.9 }, g), k, { neck: 0.842, drop: 0.04, dropW: 0.5, armholes: true }); crewNeck(ctx, k, t.paint, t); },
    polo(ctx, g) {
      const k = 'polo' + ctx.layer, t = top(ctx, Object.assign({ sleeve: g.cut ? 0.06 : 0.26, loose: 1, fab: 'pique' }, g), k, { neck: 0.841, drop: 0.026, dropW: 0.07 });
      collarFold(ctx, k, t.paint, t);
      patch(ctx, k + '_plk', { t: 'placket', color: g.color, buttons: 3 }, [0, 0.79], [0.16, 0.045], t.d + 0.005 * ctx.D.s, { px: [64, 128] });
      if (g.logo) patch(ctx, k + '_logo', { t: 'logo', color: g.color, logo: g.logo, ink: g.logoInk }, [0.5, 0.758], [0.22, 0.016], t.d + 0.005 * ctx.D.s, { px: [128, 64] });
      if (g.badge) patch(ctx, 'badge', { t: 'badge', text: g.badge, worn: g.worn }, [g.badgeAt ?? -0.52, 0.752], [0.44, 0.0185], t.d + 0.0045 * ctx.D.s, { px: [384, 112], rough: 0.4 });
    },
    shirt(ctx, g) {                                                    // collared button shirt (plaid, Hawaiian, business, flannel)
      const k = 'shirt' + ctx.layer, t = top(ctx, Object.assign({ loose: 1.1 }, g), k, { neck: 0.842, drop: g.open ? 0.045 : 0.012, dropW: 0.08 });
      collarFold(ctx, k, t.paint, t, { lapel: g.open ? 0.01 : 0 });
      edge(ctx, k + '_btn', { t: 'placket', color: g.color, buttons: 6, fab: g.fab }, 0.0001, t.hem / ctx.D.H + 0.005, g.open ? 0.79 : 0.83, t.d + 0.004 * ctx.D.s, 0.1);
      if (g.badge) patch(ctx, 'badge', { t: 'badge', text: g.badge, worn: g.worn }, [-0.52, 0.752], [0.44, 0.0185], t.d + 0.0075 * ctx.D.s, { px: [384, 112], rough: 0.4 });
      if (g.pocket !== false) patch(ctx, k + '_pk', Object.assign({ pocketPatch: true }, t.paint, { t: 'pocket' }), [0.5, 0.735], [0.3, 0.05], t.d + 0.004 * ctx.D.s, { px: [64, 64] });
    },
    scrubs(ctx, g) { const k = 'scrubs' + ctx.layer, t = top(ctx, Object.assign({ loose: 1.4, fab: 'scrubs' }, g), k, { neck: 0.842, drop: 0.05, dropW: 0.12 }); crewNeck(ctx, k, t.paint, t); patch(ctx, k + '_pk', Object.assign({}, t.paint, { t: 'pocket' }), [0.5, 0.735], [0.32, 0.05], t.d + 0.004 * ctx.D.s, { px: [64, 64] }); },
    hoodie(ctx, g) {                                                   // zip (gap) or pullover; hood lying on the upper back
      const k = 'hoodie' + ctx.layer, zip = !!g.gap, t = top(ctx, Object.assign({ loose: 1.3, fab: 'fleece', hem: 0.505 }, g), k, { neck: 0.844, drop: zip ? 0.05 : 0.01, dropW: 0.05, bulk: 0.004, flat: 0.45 });
      hemBand(ctx, k, t.paint, t, t.hem / ctx.D.H, t.d / ctx.D.s + 0.006);
      band(ctx, k + '_hood', Object.assign({ hood: true }, t.paint), 0.797, 0.853, t.d / ctx.D.s + 0.004, t.d / ctx.D.s + 0.004, { gap: zip ? g.gap + 0.1 : 0.55, rows: 5, cols: 22, size: [256, 96], flat: 0.5,
        dPhi: (phi, tt) => 0.026 * Math.sin(Math.PI * tt) * sstep(0.6, 2.2, Math.abs(U.wrapAngle(phi))) + 0.006 * Math.sin(Math.PI * tt) });
      if (zip) for (const sd of [1, -1]) edge(ctx, k + '_zip', { t: 'plain', color: g.zip || '#3a3a36' }, sd * (g.gap + 0.005), t.hem / ctx.D.H, 0.8, t.d + 0.0045 * ctx.D.s, 0.05);
      else { patch(ctx, k + '_pouch', Object.assign({}, t.paint, { t: 'pocket' }), [0, 0.585], [1.5, 0.07], t.d + 0.005 * ctx.D.s, { px: [128, 64], bulge: 0.004 }); for (const sd of [1, -1]) tube(ctx, [onTorso(ctx, sd * 0.13, 0.815, 0.004), onTorso(ctx, sd * 0.14, 0.77, 0.006), onTorso(ctx, sd * 0.13, 0.74, 0.008)], 0.0025 * ctx.D.s, g.cord || '#e8e4d8', p => CharBodyW(ctx.D, p)); }
      if (g.print) patch(ctx, k + '_pr', { t: 'print', print: g.print, color: g.color, ink: g.ink }, [0, 0.72], [0.9, 0.06], t.d + 0.006 * ctx.D.s, { px: [256, 96] });
    },
    jumper(ctx, g) { const k = 'jumper' + ctx.layer, t = top(ctx, Object.assign({ loose: 1.2, fab: 'knit', hem: 0.5 }, g), k, { neck: 0.844, drop: 0.012, dropW: 0.5, bulk: 0.004, flat: 0.5 }); hemBand(ctx, k, t.paint, t, t.hem / ctx.D.H, t.d / ctx.D.s + 0.005); crewNeck(ctx, k, Object.assign({}, t.paint), t); },
    cardigan(ctx, g) {
      const k = 'cardi' + ctx.layer, t = top(ctx, Object.assign({ loose: 1.2, fab: 'knit', hem: 0.5, gap: 0.22 }, g), k, { neck: 0.843, drop: 0.07, dropW: 0.05, bulk: 0.004 });
      for (const sd of [1, -1]) edge(ctx, k + '_btn', Object.assign({}, t.paint, { t: 'placket', buttons: 6 }), sd * (t.gap + 0.01), t.hem / ctx.D.H, 0.77, t.d + 0.004 * ctx.D.s, 0.1);
      hemBand(ctx, k, t.paint, t, t.hem / ctx.D.H, t.d / ctx.D.s + 0.005);
      for (const sd of [1, -1]) patch(ctx, k + '_pk', Object.assign({}, t.paint, { t: 'pocket' }), [sd * 0.8, 0.56], [0.4, 0.05], t.d + 0.005 * ctx.D.s, { px: [64, 64] });
    },
    jacket(ctx, g) {                                                   // open jacket (canvas work, denim, bomber) with collar, pockets, hem sway
      if (part(ctx, 'jacket') === false) return;
      ctx.look.coat = true;
      const k = 'jacket' + ctx.layer, t = top(ctx, Object.assign({ loose: 1.25, fab: 'canvas', hem: 0.515, gap: 0.3 }, g), k, { neck: 0.844, drop: 0.07, dropW: 0.05, bulk: 0.007, flat: 0.55, coat: true, flare: 0.012 });
      collarFold(ctx, k, Object.assign({}, t.paint, { fab: g.collarFab || t.paint.fab, color: g.collar || g.color }), t, { big: 1.4, gap: t.gap, lapel: 0.03 });
      for (const sd of [1, -1]) {
        edge(ctx, k + '_fac', Object.assign({}, t.paint, { t: 'cloth', rib: true }), sd * (t.gap + 0.01), t.hem / ctx.D.H, 0.78, t.d + 0.004 * ctx.D.s, 0.12, { coat: true });
        patch(ctx, k + '_cpk', Object.assign({}, t.paint, { t: 'pocket', flap: true }), [sd * 0.62, 0.735], [0.36, 0.05], t.d + 0.006 * ctx.D.s, { px: [64, 64] });
        patch(ctx, k + '_hpk', Object.assign({}, t.paint, { t: 'pocket' }), [sd * 0.78, 0.565], [0.42, 0.06], t.d + 0.008 * ctx.D.s, { px: [64, 64] });
      }
      if (g.patchRect) patch(ctx, k + '_patch', { t: 'plain', color: g.patchColor || '#8aa2c0' }, [Math.PI, 0.73], [0.55, 0.06], t.d + 0.0045 * ctx.D.s, { px: [32, 32] });
    },
    vest(ctx, g) {                                                     // sleeveless: fleece, hi-vis, bodywarmer; optional front text/badge
      const k = 'vest' + ctx.layer, t = top(ctx, Object.assign({ sleeve: 0, loose: 1, fab: 'fleece', hem: 0.52 }, g), k, { neck: 0.844, drop: g.gap ? 0.06 : 0.018, dropW: 0.08, armholes: true, bulk: g.puffer ? 0.012 : 0.004, puff: g.puffer ? 0.004 : 0 });
      band(ctx, k + '_col', t.paint, t.neckline, phi => t.neckline(phi) + 0.014, t.d / ctx.D.s + 0.003, t.d / ctx.D.s + 0.002, { rows: 2, cols: 24, gap: g.gap || 0.02 });
      edge(ctx, k + '_zip', { t: 'plain', color: g.zip || '#2a2a28' }, 0.0001 + (g.gap || 0), t.hem / ctx.D.H, 0.84, t.d + 0.004 * ctx.D.s, 0.04);
      if (g.gap) edge(ctx, k + '_zip', { t: 'plain', color: g.zip || '#2a2a28' }, -g.gap, t.hem / ctx.D.H, 0.84, t.d + 0.004 * ctx.D.s, 0.04);
      if (g.text) patch(ctx, k + '_txt', { t: 'text', bg: g.color, fg: g.ink || '#e8e4d8', lines: g.text.split('\n'), emb: true }, [0.55, 0.742], [0.5, 0.035], t.d + 0.0045 * ctx.D.s, { px: [256, 96] });
      if (g.badge) patch(ctx, 'badge', { t: 'badge', text: g.badge, worn: g.worn }, [-0.55, 0.748], [0.44, 0.0185], t.d + 0.007 * ctx.D.s, { px: [384, 112], rough: 0.4 });
      if (g.back) patch(ctx, k + '_back', { t: 'text', bg: g.color, fg: g.backInk || '#f4f4f0', lines: [g.back] }, [Math.PI, 0.73], [1.3, 0.05], t.d + 0.004 * ctx.D.s, { px: [256, 64] });
    },
    puffer(ctx, g) {
      const k = 'puffer' + ctx.layer, t = top(ctx, Object.assign({ loose: 1.2, fab: 'nylon', hem: 0.49, gap: 0.03 }, g), k, { neck: 0.848, drop: 0.004, dropW: 0.1, bulk: 0.016, puff: 0.0055, flat: 0.35 });
      band(ctx, k + '_col', t.paint, t.neckline, phi => t.neckline(phi) + 0.028, t.d / ctx.D.s + 0.004, t.d / ctx.D.s + 0.001, { rows: 3, cols: 24, gap: 0.05 });
      for (const sd of [1, -1]) edge(ctx, k + '_zip', { t: 'plain', color: '#2a2a2a' }, sd * 0.035, t.hem / ctx.D.H, 0.87, t.d + 0.017 * ctx.D.s, 0.04);
    },
    coat(ctx, g) {                                                     // long coat / raincoat to the knee, hem sways
      ctx.look.coat = true;
      const k = 'coat' + ctx.layer, t = top(ctx, Object.assign({ loose: 1.35, fab: g.fab || 'nylon', hem: 0.3, gap: 0.12 }, g), k, { neck: 0.846, drop: 0.03, dropW: 0.05, bulk: 0.008, coat: true, flare: 0.05 });
      collarFold(ctx, k, t.paint, t, { big: 1.3, gap: t.gap });
      for (const sd of [1, -1]) edge(ctx, k + '_btn', Object.assign({}, t.paint, { t: 'placket', buttons: 5 }), sd * (t.gap + 0.01), t.hem / ctx.D.H, 0.8, t.d + 0.004 * ctx.D.s, 0.1, { coat: true, rows: 14 });
    },
    robe(ctx, g) {                                                     // dressing gown: shawl-collared wrap to the shin, belt with hanging ends
      ctx.look.coat = true;
      const k = 'robe' + ctx.layer, vw = (h) => h > 0.6 ? 0.3 * sstep(0.6, 0.8, h) + 0.05 : h < 0.44 ? 0.12 * sstep(0.44, 0.3, h) : 0;
      const t = top(ctx, Object.assign({ loose: 1.3, fab: 'terry', hem: 0.27 }, g), k, { neck: 0.844, drop: 0.12, dropW: 0.04, bulk: 0.006, coat: true, flare: 0.012, skip: (h, phi) => Math.abs(U.wrapAngle(phi)) < vw(h), flat: 0.5 });
      band(ctx, k + '_shawl', Object.assign({}, t.paint, { rib: false }), phi => t.neckline(phi) - 0.004, phi => t.neckline(phi) + 0.012, t.d / ctx.D.s + 0.004, t.d / ctx.D.s + 0.012, { rows: 3, cols: 26, gap: 0.25, flat: 0.4 });
      for (const sd of [1, -1]) edge(ctx, k + '_lap', t.paint, sd * 0.24, 0.6, 0.8, t.d + 0.008 * ctx.D.s, 0.16, { lift: 0.004 });
      band(ctx, k + '_belt', Object.assign({}, t.paint, { rib: true }), 0.582, 0.6, t.d / ctx.D.s + 0.007, t.d / ctx.D.s + 0.007, { rows: 2, cols: 28, size: [256, 32] });
      for (const sd of [1, -1]) tube(ctx, [onTorso(ctx, sd * 0.2, 0.59, 0.01), onTorso(ctx, sd * 0.22, 0.54, 0.014), onTorso(ctx, sd * 0.24, 0.48, 0.016)], 0.008 * ctx.D.s, g.color, p => W2('hips', 'coat' + (sd > 0 ? 'L' : 'R'), 0.5), { flatten: 0.4 });
    },
    armour(ctx, g) {                                                   // plate carrier: thick front/back plates, shoulder straps, pouches
      const k = 'armour' + ctx.layer, d = offL(ctx, g) + 0.018 * ctx.D.s, D = ctx.D;
      const plate = (c) => torsoLoft(ctx, D.H * 0.6, D.H * 0.8, { region: k, regionSize: [256, 128], paint: { t: 'cloth', fab: 'nylon', color: g.color || '#2f332c' }, off: { d, soft: 0.1 }, flat: 0.6, rough: 0.85, cols: 26,
        skip: (h, phi) => c ? Math.abs(Math.sin(phi)) > 0.72 && h > 0.63 : false, top: phi => 0.8 - 0.04 * gauss(U.wrapAngle(phi), 0.5) - 0.06 * gauss(Math.abs(Math.sin(phi)) - 1, 0.3) });
      plate(true);
      for (const sd of [1, -1]) band(ctx, k + '_st', { t: 'cloth', fab: 'nylon', color: g.color || '#2f332c' }, 0.795, 0.832, d / D.s, d / D.s, { gap: 0, rows: 2, cols: 26, skip: (i, j) => { const phi = (j + 0.5) / 25 * TAU - Math.PI; return Math.abs(Math.sin(phi) * sd - 0.72) > 0.22; } });
      for (let i = 0; i < 3; i++) patch(ctx, k + '_pch', { t: 'pocket', color: g.pouch || '#3a3f36', fab: 'nylon', flap: true }, [(i - 1) * 0.42, 0.635], [0.36, 0.04], d + 0.012 * D.s, { px: [64, 64], bulge: 0.008 });
      ctx.outerD = Math.max(ctx.outerD, d);
    },
    apron(ctx, g) {                                                    // front panel chest to knee, neck strap, ties
      const k = 'apron', D = ctx.D, d = (ctx.outerD || offL(ctx, g)) + 0.006 * D.s, r = ctx.A.alloc(k, 256, 256, { t: 'cloth', fab: 'cotton', color: g.color || '#e8e4dc', dirt: g.dirt ?? 0.6, blood: g.blood || 0 }), p = new V3();
      surf(ctx.mb, 16, 9, (i, j) => {
        const t = i / 15, h = lerp(0.3, 0.77, t), w = h > 0.62 ? 0.5 : 1.05, phi = (j / 8 - 0.5) * w * 2;
        CharBody.torsoPt(D, h * D.H, phi, { d: d + 0.01 * D.s * sstep(0.52, 0.4, h), soft: 0.2, skirt: h < 0.5 }, p);
        const [u, v] = ctx.A.uv(r, j / 8, t);
        return { p: p.clone(), u, v, w: h < 0.47 ? W2('hips', p.x > 0 ? 'thighL' : 'thighR', 0.4 * sstep(0.47, 0.35, h)) : CharBodyW(D, p) };
      }, { flat: 0.4, rough: 0.85, out: new V3(0, 0, 1) });
      tube(ctx, [onTorso(ctx, 0.25, 0.77, 0.008), onTorso(ctx, 0.4, 0.83, 0.006), onTorso(ctx, 0, 0.843, 0.02).add(new V3(0, 0, -0.07 * D.s)), onTorso(ctx, -0.4, 0.83, 0.006), onTorso(ctx, -0.25, 0.77, 0.008)], 0.004 * D.s, g.color || '#e8e4dc', p => CharBodyW(D, p), { flatten: 0.4 });
    },
    pants(ctx, g) {
      const { D } = ctx, k = 'pants' + ctx.layer, d = offL(ctx, g), paint = Object.assign({ t: 'cloth', fab: g.fab || 'twill' }, g, { key: k });
      const len = g.len ?? 1, seed = g.seed ?? 5, rise = g.rise ?? 0.598;
      const bag = g.bag ?? (g.style === 'cargo' ? 1.25 : g.style === 'trackies' ? 1.3 : g.style === 'chinos' ? 0.9 : g.style === 'tights' ? 0.15 : 1);
      torsoLoft(ctx, D.H * 0.452, D.H * rise, { region: k, regionSize: [512, 128], paint: Object.assign({ pelvis: true }, paint), off: { d: d + 0.002 * D.s * bag, soft: 0.6 }, flat: 0.45, rough: 0.9, capBottom: true, cols: 24,
        folds: (h, phi) => D.s * 0.003 * bag * vnoise(phi * 4 + seed, h * 30) * sstep(0.53, 0.47, h) });
      if (g.style !== 'tights') band(ctx, k + '_wb', Object.assign({ waistband: true }, paint), rise - 0.02, rise + 0.002, d / D.s + 0.004, d / D.s + 0.004, { rows: 2, cols: 26, size: [256, 32], flat: 0.2 });
      for (const S of 'LR') {
        limb(ctx, S, 'leg', -0.03, len, { region: k + '_leg', regionSize: [256, 256], paint: Object.assign({ leg: true }, paint), flat: 0.5, rough: 0.9, cols: 16,
          off: s => d + D.s * (0.006 * bag + 0.008 * bag * sstep(0.45, 0.95, s) * (1 - (g.taper || 0)) + (len < 0.6 ? 0.012 * bag * sstep(0.1, len, s) : 0)),
          folds: (s, phi, se) => D.s * bag * (0.004 * vnoise(phi * 2.2 + seed + (S === 'L' ? 3 : 0), s * 16) + 0.004 * gauss(s - se, 0.06) * vnoise(phi * 5, s * 50) + (len > 0.9 ? 0.006 * sstep(0.88, 1, s) * (0.5 + 0.5 * vnoise(phi * 3, 7)) : 0)) });
        if (g.roll) limb(ctx, S, 'leg', len - 0.035, len + 0.004, { region: k + '_roll', regionSize: [128, 32], paint: Object.assign({}, paint, { color: g.rollColor || g.color, rib: false }), off: d + D.s * 0.02 * bag, flat: 0.4, cols: 16 });
        if (g.style === 'cargo') legPocket(ctx, S, k, paint, d);
      }
      if (g.stripes) for (const S of 'LR') limb(ctx, S, 'leg', 0.05, len - 0.05, { region: k + '_str', regionSize: [64, 64], paint: { t: 'plain', color: g.stripes }, off: d + D.s * 0.009 * bag, cols: 16, skip: null });
      ctx.pantsD = d;
    },
    shorts(ctx, g) { G.pants(ctx, Object.assign({ len: 0.4 }, g)); },
    shoes(ctx, g) {
      const style = g.style || 'sneaker', k = 'shoe_' + style, sp = Object.assign({ t: 'shoe' }, g);
      const P = { sneaker: { top: 0.08, soleH: 0.024, wide: 1.15, len: 1.08, toeH: 1.45 }, boot: { top: 0.092, soleH: 0.03, wide: 1.18, len: 1.09, toeH: 1.5 }, dress: { top: 0.072, soleH: 0.018, wide: 1.07, len: 1.07, toeH: 1.2 },
        slipper: { top: 0.066, soleH: 0.015, wide: 1.16, len: 1.05, toeH: 1.5 }, sock: { top: 0.066, soleH: 0.006, wide: 1.1, len: 1.03, toeH: 1.2 }, fluffy: { top: 0.08, soleH: 0.012, wide: 1.34, len: 1.08, toeH: 1.6 },
        sandal: { top: 0.06, soleH: 0.02, wide: 1.08, len: 1.06, toeH: 1.1 } }[style];
      for (const S of 'LR') {
        foot(ctx, S, Object.assign({ region: k, regionSize: [128, 64], paint: sp, color: WH, rough: style === 'dress' ? 0.45 : 0.8, flat: style === 'fluffy' ? 0.1 : 0.3 }, P, S === 'R' && g.tapeR ? { paint: Object.assign({}, sp, { tape: true }), region: k + '_t' } : {}));
        const shaft = g.shaft || SHAFT[style];
        limb(ctx, S, 'leg', 1 - shaft, 1.01, { region: k + '_shaft', regionSize: [128, 64], paint: Object.assign({ shaft: true }, sp), rough: 0.8, flat: style === 'fluffy' ? 0.1 : 0.4, cols: 14,
          off: s => ctx.D.s * ({ boot: 0.01, fluffy: 0.013 + 0.004 * vnoise(s * 30, 2), sock: 0.0025, sneaker: 0.0065 + 0.006 * sstep(0.96, 1, s), dress: 0.005, slipper: 0.005, sandal: 0.004 }[style]) });
      }
    },
  };
  function legPocket(ctx, S, k, paint, d) {                            // cargo pocket on the outer thigh
    const { D, J, mb, A } = ctx, sd = S === 'L' ? 1 : -1, r = A.alloc(k + '_cp', 64, 64, Object.assign({}, paint, { t: 'pocket', flap: true }));
    const a = J['thigh' + S], b = J['shin' + S];
    surf(mb, 3, 4, (i, j) => {
      const t = lerp(0.46, 0.7, i / 2), s = j / 3 - 0.5, c = a.clone().lerp(b, t);
      const R = 0.066 * D.s * (1 - t * 0.35) + d + 0.013 * D.s, phi = s * 0.9;
      const [u, v] = A.uv(r, j / 3, 1 - i / 2);
      return { p: new V3(c.x + sd * Math.cos(phi) * R, c.y, c.z + Math.sin(phi) * R), u, v, w: W1('thigh' + S) };
    }, { flat: 0.6, rough: 0.9, out: new V3(sd, 0, 0) });
  }

  // ---- accessories ----------------------------------------------------------------------------------------
  function headShell(ctx, key, spec, y0, off, o = {}) {                // caps, beanies, helmets, hoods
    const { mb, A } = ctx, r = A.alloc(key, ...(o.px || [256, 128]), spec), p = new V3();
    const cols = o.cols || 30, rows = o.rows || 7;
    return surf(mb, rows, cols, (i, j) => {
      const s = j / (cols - 1), phi = s * TAU - Math.PI, t = i / (rows - 1);
      const y = lerp(y0(phi), 0.126, Math.pow(t, o.pow || 0.8));
      CharHair.headSurf(ctx, phi, y, off(phi, t), p);
      const [u, v] = A.uv(r, s, t);
      return { p: p.clone(), u, v, w: W1('head') };
    }, { wrap: true, flat: o.flat ?? 0.35, rough: o.rough ?? 0.8, skip: o.skip });
  }
  const hairOff = ctx => { const h = ctx.look.hair; return !h || h.style === 'bald' ? 0.001 : ({ buzz: 0.0025, crop: 0.009, receding: 0.007, curly: 0.03, perm: 0.022, messy: 0.02, bob: 0.02, side_part: 0.018, short: 0.015, comb: 0.017, long: 0.014 }[h.style] ?? 0.01); };
  function strap(ctx, color, y, w, off, tilt = 0) {
    const { mb, A } = ctx, r = A.alloc('c' + color, 16, 16, { t: 'plain', color }), [u, v] = A.uv(r, 0.5, 0.5), p = new V3();
    surf(mb, 2, 31, (i, j) => { const phi = j / 30 * TAU - Math.PI; CharHair.headSurf(ctx, phi, y + (i - 0.5) * w + tilt * Math.cos(phi), off, p); return { p: p.clone(), u, v, w: W1('head') }; }, { wrap: true, rough: 0.7, flat: 0.2 });
  }
  const box = (w, h, d, r = 0) => r ? new RoundedBoxGeometry(w, h, d, 2, r) : new THREE.BoxGeometry(w, h, d);
  const cyl = (r1, r2, h, n = 12) => new THREE.CylinderGeometry(r1, r2, h, n);
  const sph = (r, a = 10, b = 8) => new THREE.SphereGeometry(r, a, b);
  const torsoAt = (ctx, phi, h, extra, rot) => at(onTorso(ctx, phi, h, extra), rot || [0, phi, 0]);

  const ACC = {
    belt(ctx, a) {
      const { D } = ctx, d = (ctx.pantsD || offL(ctx, {})) / D.s + 0.006, h = a.h || 0.588;
      band(ctx, 'belt' + (a.color || ''), { t: 'cloth', fab: 'leather', color: a.color || '#1e1a17' }, h - 0.012, h + 0.012, d, d, { rows: 2, cols: 28, size: [256, 32], flat: 0.2, rough: 0.45 });
      patch(ctx, 'buckle', { t: 'plain', color: a.buckle || '#8a8a86' }, [0, h], [0.22, 0.03], (d + 0.004) * D.s, { px: [16, 16], rough: 0.25 });
    },
    watch(ctx, a) { limb(ctx, a.side || 'L', 'arm', 0.9, 0.955, { region: 'watch', regionSize: [32, 16], paint: { t: 'plain', color: a.color || '#2a2a2c' }, off: 0.0045 * ctx.D.s, rough: 0.35, cols: 12 }); },
    cap(ctx, a) {
      if (part(ctx, 'cap') === false) return;
      const { D, mb, A } = ctx, ho = hairOff(ctx), back = !!a.back, face = back ? Math.PI : 0;
      const spec = { t: 'cap', color: a.color || '#222', text: a.text, back, fade: a.fade, ink: a.ink };
      const y0 = phi => 0.052 - 0.05 * (1 - Math.cos(phi)) / 2;
      headShell(ctx, 'cap', spec, y0, (phi, t) => ho + 0.004 + 0.008 * Math.sin(t * Math.PI * 0.9) * (0.6 + 0.4 * Math.cos(phi - face)), { px: [256, 96], pow: 0.9, flat: 0.25, rough: 0.85 });
      const r = A.alloc('cap_brim', 64, 32, { t: 'plain', color: a.brim || a.color || '#222' }), p = new V3(), q = new V3(), n = new V3();
      for (const side of [1, -1]) surf(mb, 4, 13, (i, j) => {
        const t = i / 3, ph = face + (j / 12 - 0.5) * 2.0;
        CharHair.headSurf(ctx, ph, y0(ph), ho + 0.004, p, n);
        const out = new V3(n.x, 0, n.z).normalize(), L = 0.074 * D.hs * (1 - Math.pow(Math.abs(j / 12 - 0.5) * 2, 2) * 0.45);
        q.copy(p).addScaledVector(out, L * t).add(new V3(0, (-(back ? 0.004 : 0.016) * t * t + (back ? 0.012 * t : 0) + (side > 0 ? 0.0025 : -0.0005)) * D.hs, 0));
        const [u, v] = A.uv(r, j / 12, t);
        return { p: q.clone(), u, v, w: W1('head') };
      }, { flat: 0.1, rough: 0.8, out: new V3(0, side, 0) });
      const top = new V3(); CharHair.headSurf(ctx, 0, 0.126, ho + 0.012, top);
      prim(ctx, sph(0.007 * D.hs, 8, 6), at(top), W1('head'), a.color || '#222');
    },
    beanie(ctx, a) {
      if (part(ctx, 'beanie') === false) return;
      const ho = Math.min(hairOff(ctx), 0.012), spec = { t: 'cloth', fab: 'knit', color: a.color || '#3a4a5a', rib: true };
      headShell(ctx, 'beanie', spec, phi => 0.05 - 0.05 * (1 - Math.cos(phi)) / 2, (phi, t) => ho + 0.006 + 0.012 * Math.sin(t * Math.PI * 0.8), { px: [256, 96], flat: 0.45, rough: 0.95 });
      headShell(ctx, 'beanie_cuff', spec, phi => 0.046 - 0.05 * (1 - Math.cos(phi)) / 2, () => ho + 0.013, { px: [256, 32], rows: 2, pow: 1, flat: 0.3, rough: 0.95 });
      if (a.pom) { const top = new V3(); CharHair.headSurf(ctx, 0, 0.126, ho + 0.03, top); prim(ctx, sph(0.03 * ctx.D.hs), at(top), W1('head'), a.pom, { fab: 'terry' }); }
    },
    helmet(ctx, a) {
      headShell(ctx, 'helmet', { t: 'cloth', fab: 'nylon', color: a.color || '#4a5238' }, phi => 0.02 - 0.04 * (1 - Math.cos(phi)) / 2, (phi, t) => hairOff(ctx) + 0.022 + 0.004 * Math.sin(t * 3), { px: [128, 64], flat: 0.3, rough: 0.7 });
      strap(ctx, '#2a2a26', -0.075, 0.008, 0.012);
    },
    hood_up(ctx, a) {                                                  // raincoat/hoodie hood over the head, open at the face
      headShell(ctx, 'hood', { t: 'cloth', fab: a.fab || 'nylon', color: a.color || '#3a4038' }, phi => lerp(-0.11, 0.075, Math.pow(Math.max(0, Math.cos(phi)), 3)), (phi, t) => hairOff(ctx) + 0.02 + 0.01 * (1 - t), { px: [256, 128], flat: 0.5, rough: 0.8, skip: (i, j) => false });
    },
    glasses(ctx, a) {
      if (part(ctx, 'glasses') === false) return;
      const { D } = ctx, ipd = (ctx.look.head && ctx.look.head.ipd) || 0.0625, ex = ipd / 2, rw = a.round ? 0.02 : 0.023, rh = a.round ? 0.019 : 0.0155, zf = 0.1, col = a.color || '#2a2622';
      if (a.cord) {                                                    // reading glasses hanging on a cord on the chest
        const c = onTorso(ctx, 0, 0.75, 0.01);
        for (const sd of [1, -1]) prim(ctx, new THREE.TorusGeometry(rw * D.hs, 0.0025 * D.hs, 5, 14), at(c.clone().add(new V3(sd * ex * D.hs, 0, 0.004)), [0.3, 0, 0], [1, rh / rw, 1]), p => CharBodyW(D, p), col, { rough: 0.35 });
        tube(ctx, [onTorso(ctx, 0.9, 0.83, 0.004), onTorso(ctx, 0.5, 0.78, 0.008), c.clone().add(new V3(ex * D.hs * 2, 0, 0)), c.clone().add(new V3(-ex * D.hs * 2, 0, 0)), onTorso(ctx, -0.5, 0.78, 0.008), onTorso(ctx, -0.9, 0.83, 0.004)], 0.0012 * D.s, a.cordColor || '#8a6a3a', p => CharBodyW(D, p), { cols: 4 });
        return;
      }
      for (const sd of [1, -1]) {
        prim(ctx, new THREE.TorusGeometry(rw, 0.0024, 5, 18), headM(ctx, [sd * ex, 0.002, zf], [0, 0, 0], [1, rh / rw, 1]), W1('head'), col, { rough: 0.35 });
        tube(ctx, [new V3(sd * (ex + rw), 0.004, zf - 0.004), new V3(sd * 0.071, 0.004, 0.02), new V3(sd * 0.074, -0.004, -0.012)].map(p => p.multiplyScalar(D.hs).add(D.headO)), 0.0017 * D.hs, col, W1('head'), { cols: 4 });
      }
      tube(ctx, [new V3(-(ex - rw), 0.006, zf + 0.004), new V3(0, 0.009, zf + 0.008), new V3(ex - rw, 0.006, zf + 0.004)].map(p => p.multiplyScalar(D.hs).add(D.headO)), 0.0018 * D.hs, col, W1('head'), { cols: 4 });
      if (a.tape) prim(ctx, cyl(0.0045, 0.0045, 0.013, 8), headM(ctx, [0, 0.008, zf + 0.008], [0, 0, Math.PI / 2]), W1('head'), '#e0dccf', { rough: 0.9 });
    },
    goggles(ctx, a) {                                                  // Night Shift goggles: red lenses, strap; 'up' on the forehead or 'on'
      const st = part(ctx, 'goggles') ?? a.pos ?? 'up';
      if (st === false) return;
      const up = st === 'up', y = up ? 0.058 : 0.004, tilt = up ? -0.55 : 0, z = up ? 0.085 : 0.1, D = ctx.D;
      strap(ctx, '#2a2622', y + (up ? 0.004 : 0), 0.014, hairOff(ctx) * 0.7 + 0.004);
      for (const sd of [1, -1]) {
        prim(ctx, cyl(0.02, 0.018, 0.018, 14), headM(ctx, [sd * 0.031, y, z], [Math.PI / 2 + tilt, 0, 0]), W1('head'), '#23201c', { rough: 0.5 });
        prim(ctx, new THREE.CircleGeometry(0.0165, 14), headM(ctx, [sd * 0.031, y + (up ? 0.009 : 0), z + (up ? 0.006 : 0.0095)], [tilt, 0, 0]), W1('head'), a.lens || '#b3121a', { rough: 0.08, c: new THREE.Color(1.4, 0.35, 0.3) });
      }
    },
    head_torch(ctx, a) {
      strap(ctx, a.strap || '#2a2e30', 0.058, 0.016, hairOff(ctx) * 0.8 + 0.003);
      prim(ctx, box(0.032, 0.024, 0.02, 0.004), headM(ctx, [0, 0.062, 0.088]), W1('head'), '#303436', { rough: 0.5 });
      prim(ctx, new THREE.CircleGeometry(0.009, 12), headM(ctx, [0, 0.062, 0.0985]), W1('head'), '#f4f0e0', { rough: 0.1, c: new THREE.Color(1.6, 1.6, 1.5) });
    },
    gas_mask(ctx, a) {                                                 // COMMS respirator: a rubber face piece over a smooth dome (nose inside),
      const D = ctx.D, col = a.color || '#1c1d1c', { mb, A } = ctx, hs = D.hs;  // one dark visor, the voicemitter, a side filter, the harness
      const r = A.alloc('mask', 128, 64, { t: 'cloth', fab: 'rubber', color: col }), rv = A.alloc('visor', 32, 16, { t: 'plain', color: '#1e262c' });
      const o = [0, 0, 0, 0, 0, 0], q = new V3(), p = new V3();
      const dome = (phi, y) => {                                        // outward hit of the ray with an ellipsoid shell in front of the face
        CharHead.rayOf(phi, y, o);
        const [cx, cy, cz, ax, ay, az] = [0, -0.042, 0.0, 0.074, 0.098, 0.121];
        const ox = (o[0] - cx) / ax, oy = (o[1] - cy) / ay, oz = (o[2] - cz) / az, dx = o[3] / ax, dy = o[4] / ay, dz = o[5] / az;
        const qa = dx * dx + dy * dy + dz * dz, qb = 2 * (ox * dx + oy * dy + oz * dz), qc = ox * ox + oy * oy + oz * oz - 1, disc = qb * qb - 4 * qa * qc;
        return disc > 0 ? (-qb + Math.sqrt(disc)) / (2 * qa) : 0;
      };
      const at = (phi, y, lift) => {                                    // face-piece point: the dome, or the face + lift where the face is fuller
        const rf = CharHead.sample(D.sdf, phi, y, p), rr = Math.max(rf + lift, dome(phi, y) * sstep(1.3, 0.9, Math.abs(phi)) + (rf + lift) * (1 - sstep(1.3, 0.9, Math.abs(phi))));
        CharHead.rayOf(phi, y, o);
        return q.set(o[0] + o[3] * rr, o[1] + o[4] * rr, o[2] + o[5] * rr).multiplyScalar(hs).add(D.headO).clone();
      };
      const rows = 12, cols = 26, top = phi => 0.042 - 0.03 * sstep(0.6, 1.3, Math.abs(phi));
      surf(mb, rows, cols, (i, j) => {
        const t = i / (rows - 1), phi = (j / (cols - 1) * 2 - 1) * 1.32, y = lerp(-0.13, top(phi), t), rim = Math.min(t, 1 - t, 1 - Math.abs(phi) / 1.32);
        const [u, v] = A.uv(r, j / (cols - 1), t);
        return { p: at(phi, y, 0.002 + 0.004 * sstep(0, 0.12, rim)), u, v, w: y < -0.08 ? W2('head', 'jaw', 0.5) : W1('head') };
      }, { rough: 0.55 });
      surf(mb, 5, 15, (i, j) => {                                       // visor
        const phi = (j / 14 * 2 - 1) * 0.78, y = lerp(-0.019, 0.03, i / 4) - 0.006 * (phi * phi);
        const [u, v] = A.uv(rv, j / 14, i / 4);
        return { p: at(phi, y, 0.009), u, v, w: W1('head') };
      }, { rough: 0.08 });
      prim(ctx, cyl(0.017, 0.02, 0.022, 16), headM(ctx, [0, -0.077, 0.118], [Math.PI / 2, 0, 0]), W2('head', 'jaw', 0.5), '#2a2b2a', { rough: 0.6 });
      prim(ctx, cyl(0.011, 0.011, 0.006, 12), headM(ctx, [0, -0.077, 0.131], [Math.PI / 2, 0, 0]), W2('head', 'jaw', 0.5), '#111212', { rough: 0.5 });
      prim(ctx, cyl(0.026, 0.028, 0.034, 16), headM(ctx, [0.058, -0.08, 0.066], [Math.PI / 2, 0.75, 0.2]), W2('head', 'jaw', 0.5), '#3a3c38', { rough: 0.6 });
      prim(ctx, cyl(0.02, 0.02, 0.004, 14), headM(ctx, [0.071, -0.082, 0.078], [Math.PI / 2, 0.75, 0.2]), W2('head', 'jaw', 0.5), '#1a1b1a', { rough: 0.5 });
      strap(ctx, '#1a1a1a', 0.034, 0.012, hairOff(ctx) + 0.004, -0.02); strap(ctx, '#1a1a1a', -0.05, 0.012, 0.008, 0.03);
    },
    tie_headband(ctx, a) {                                             // the Closer: his tie knotted round his head, tail down the back
      const D = ctx.D, c = a.color || '#a82a2a';
      strap(ctx, c, 0.062, 0.016, hairOff(ctx) + 0.003, -0.01);
      const p0 = new V3(), n = new V3(); CharHair.headSurf(ctx, Math.PI - 0.3, 0.06, hairOff(ctx) + 0.008, p0, n);
      prim(ctx, box(0.02, 0.022, 0.012, 0.004), at(p0), W1('head'), c);
      tube(ctx, [p0.clone(), p0.clone().add(new V3(-0.01, -0.05, -0.02).multiplyScalar(D.hs)), p0.clone().add(new V3(-0.015, -0.12, -0.035).multiplyScalar(D.hs))], t => 0.006 * D.hs, c, W1('head'), { flatten: 0.35 });
    },
    headset(ctx, a) {                                                  // dead call-centre headset around the neck (or worn)
      const D = ctx.D, nk = [];
      for (let i = 0; i <= 12; i++) { const phi = Math.PI * (0.5 + i / 12); nk.push(CharBody.torsoPt(D, 0.848 * D.H, phi, { d: 0.018 * D.s, soft: 0 }, new V3())); }
      const wt = p => W2('neck', 'chest', 0.4);
      tube(ctx, nk, 0.0035 * D.s, a.color || '#2a2a2c', wt);
      for (const sd of [1, -1]) prim(ctx, cyl(0.026, 0.026, 0.014, 14), at(onTorso(ctx, sd * 1.2, 0.83, 0.012), [0, 0, Math.PI / 2]), wt, a.color || '#2a2a2c', { rough: 0.5 });
      tube(ctx, [onTorso(ctx, 1.1, 0.83, 0.02), onTorso(ctx, 0.7, 0.8, 0.02), onTorso(ctx, 0.35, 0.79, 0.018)], 0.002 * D.s, '#1a1a1a', wt);
    },
    switchboard(ctx, a) {                                              // the Operator: vintage headset round her neck, coiled cord down the front
      ACC.headset(ctx, { color: '#1a1714' });
      const D = ctx.D, pts = [];
      for (let i = 0; i <= 60; i++) { const t = i / 60, c = onTorso(ctx, -0.35 + t * 0.2, 0.8 - t * 0.2, 0.02); pts.push(c.add(new V3(Math.cos(t * 50) * 0.008 * D.s, Math.sin(t * 50) * 0.008 * D.s, 0.004))); }
      tube(ctx, pts, 0.0018 * D.s, '#141210', p => CharBodyW(D, p), { cols: 4 });
      prim(ctx, cyl(0.006, 0.006, 0.045, 8), at(pts[60].clone().add(new V3(0, -0.02 * D.s, 0))), p => CharBodyW(D, p), '#8a6a3a', { rough: 0.4 });
    },
    earpiece(ctx) { const D = ctx.D; tube(ctx, [new V3(-0.075, -0.02, 0.0), new V3(-0.07, -0.07, -0.02), new V3(-0.055, -0.12, -0.04)].map(p => p.multiplyScalar(D.hs).add(D.headO)).concat([onTorso(ctx, -1.2, 0.83, 0.004)]), 0.0022 * D.s, '#d8d4c8', p => p.y > D.headO.y - 0.1 ? W1('head') : W1('neck'), { cols: 4 }); },
    lanyard(ctx, a) {                                                  // cord (beads optional) from behind the neck to an ID card on the chest
      if (part(ctx, 'lanyard') === false) return;
      const D = ctx.D, h = a.h || 0.7, pts = [];
      for (const sd of [1, -1]) {
        const side = [];
        for (let i = 0; i <= 8; i++) { const t = i / 8, phi = sd * lerp(1.35, 0.06, sstep(0, 1, t)), hh = lerp(0.845, h + 0.02, Math.pow(t, 1.3)); side.push(onTorso(ctx, phi, hh, 0.006 + 0.004 * Math.sin(t * Math.PI))); }
        tube(ctx, side, 0.0025 * D.s, a.cord || '#1c1c20', p => CharBodyW(D, p), { cols: 4 });
        if (a.beads) side.slice(2, 8).forEach((p, i) => { for (let b = 0; b < 3; b++) prim(ctx, sph(0.0048 * D.s, 6, 5), at(p.clone().lerp(side[Math.min(8, i + 3)], b / 3).add(new V3(0, 0, 0.002))), q => CharBodyW(D, q), a.beads[(i * 3 + b + (sd > 0 ? 0 : 5)) % a.beads.length], { rough: 0.3 }); });
      }
      patch(ctx, 'idcard' + (a.text || ''), { t: 'badge', text: a.text || 'STAFF', worn: a.worn }, [0, h - 0.018], [0.42, 0.034], (ctx.outerD || offL(ctx, {})) + 0.011 * D.s, { px: [256, 160], rough: 0.35 });
    },
    backpack(ctx, a) {                                                 // big pack on the back with shoulder straps (+ plush keyring)
      if (part(ctx, 'backpack') === false) return;
      const D = ctx.D, s = D.s * (a.size || 1), back = onTorso(ctx, Math.PI, 0.7, 0), wt = p => W2('spine', 'chest', 0.7);
      const c = back.clone().add(new V3(0, 0, -0.1 * s));
      prim(ctx, box(0.33 * s, 0.44 * s, 0.2 * s, 0.05 * s), at(c), wt, a.color || '#3a3f46', { fab: 'nylon' });
      prim(ctx, box(0.26 * s, 0.18 * s, 0.07 * s, 0.03 * s), at(c.clone().add(new V3(0, -0.08 * s, -0.11 * s))), wt, a.pocket || a.color || '#3a3f46', { fab: 'nylon' });
      prim(ctx, box(0.3 * s, 0.1 * s, 0.17 * s, 0.04 * s), at(c.clone().add(new V3(0, 0.22 * s, 0.0))), wt, a.flap || '#2e3238', { fab: 'nylon' });
      for (const sd of [1, -1]) tube(ctx, [c.clone().add(new V3(sd * 0.09 * s, 0.2 * s, 0.07 * s)), onTorso(ctx, sd * 2.4, 0.83, 0.012), onTorso(ctx, sd * 1.35, 0.832, 0.014), onTorso(ctx, sd * 0.75, 0.79, 0.012), onTorso(ctx, sd * 0.85, 0.72, 0.012), onTorso(ctx, sd * 1.25, 0.66, 0.012), c.clone().add(new V3(sd * 0.13 * s, -0.16 * s, 0.07 * s))], 0.011 * D.s, a.strap || '#23262a', p => CharBodyW(D, p), { flatten: 0.3, cols: 6 });
      if (a.plush) { const k = c.clone().add(new V3(0.12 * s, 0.05 * s, -0.11 * s)); tube(ctx, [k.clone(), k.clone().add(new V3(0, -0.04 * s, -0.01 * s))], 0.002 * D.s, '#c0c0c0', wt); prim(ctx, sph(0.028 * s), at(k.clone().add(new V3(0, -0.07 * s, -0.015 * s)), [0, 0, 0], [1, 1.15, 0.8]), wt, a.plush, { fab: 'terry' }); for (const sd of [1, -1]) prim(ctx, sph(0.011 * s), at(k.clone().add(new V3(sd * 0.018 * s, -0.04 * s, -0.015 * s))), wt, a.plush, { fab: 'terry' }); }
    },
    bumbag(ctx, a) {
      const D = ctx.D, c = onTorso(ctx, 0.25, 0.575, 0.03);
      band(ctx, 'bbstrap', { t: 'cloth', fab: 'nylon', color: '#1c1c1c' }, 0.57, 0.585, (ctx.outerD || offL(ctx, {})) / D.s + 0.004, (ctx.outerD || offL(ctx, {})) / D.s + 0.004, { rows: 2, cols: 26, size: [64, 16] });
      prim(ctx, box(0.2 * D.s, 0.1 * D.s, 0.07 * D.s, 0.03 * D.s), at(c, [0, 0.25, 0]), W2('hips', 'spine', 0.3), a.color || '#262a30', { fab: 'nylon' });
      for (let i = 0; i < 3; i++) prim(ctx, cyl(0.011 * D.s, 0.011 * D.s, 0.035 * D.s, 8), at(c.clone().add(new V3((i - 1) * 0.022 * D.s, 0.06 * D.s, 0.01 * D.s)), [0, 0, 0]), W2('hips', 'spine', 0.3), ['#d8a020', '#2a8a4a', '#c83a2a'][i], { rough: 0.4 });
    },
    toolbelt(ctx, a) {
      ACC.belt(ctx, { color: '#5a3a22', h: 0.585 });
      const D = ctx.D;
      for (const [phi, col] of [[1.1, '#6a4a2a'], [-1.1, '#6a4a2a'], [1.9, '#5a3e24']]) {
        const c = onTorso(ctx, phi, 0.555, 0.02);
        prim(ctx, box(0.09 * D.s, 0.1 * D.s, 0.05 * D.s, 0.01 * D.s), at(c, [0, phi, 0]), W1('hips'), col, { fab: 'leather' });
        for (let i = 0; i < 3; i++) prim(ctx, cyl(0.006 * D.s, 0.007 * D.s, 0.05 * D.s, 6), at(c.clone().add(new V3(Math.cos(phi) * (i - 1) * 0.02 * D.s, 0.06 * D.s, -Math.sin(phi) * (i - 1) * 0.02 * D.s))), W1('hips'), ['#e0b020', '#d83a2a', '#2a6ab0'][i], { rough: 0.4 });
      }
    },
    holster(ctx, a) { const D = ctx.D, c = onTorso(ctx, -1.35, 0.545, 0.025); prim(ctx, box(0.045 * D.s, 0.16 * D.s, 0.09 * D.s, 0.012 * D.s), at(c, [0, 0, 0.1]), W1('hips'), a.color || '#4a3220', { fab: 'leather' }); prim(ctx, box(0.03 * D.s, 0.08 * D.s, 0.035 * D.s, 0.01 * D.s), at(c.clone().add(new V3(0, 0.1 * D.s, -0.012 * D.s)), [0.35, 0, 0]), W1('hips'), '#5a3a22', { fab: 'leather' }); },
    sweatband(ctx, a) {
      const up = part(ctx, 'sweatband') === 'up', s0 = up ? 0.6 : 0.73;
      limb(ctx, a.side || 'L', 'arm', s0, s0 + 0.1, { region: 'sweatband', regionSize: [64, 32], paint: { t: 'cloth', fab: 'terry', color: a.color || '#d8d4ca', dirt: 0.4 }, off: 0.007 * ctx.D.s, rough: 0.95, cols: 14, flat: 0.2 });
    },
    armband(ctx, a) { limb(ctx, a.side || 'L', 'arm', 0.26, 0.33, { region: 'armband', regionSize: [128, 32], paint: { t: 'text', bg: a.color || '#1a1a1a', fg: '#e8e4d8', lines: ['~@@@@~'] }, off: (ctx.sleeve[a.side || 'L'] > 0.3 ? 0.02 : 0.004) * ctx.D.s, rough: 0.8, cols: 14 }); },
    radio(ctx, a) { const D = ctx.D, c = onTorso(ctx, a.phi ?? 0.6, 0.76, 0.02); prim(ctx, box(0.05 * D.s, 0.1 * D.s, 0.03 * D.s, 0.008 * D.s), at(c, [0, a.phi ?? 0.6, 0]), p => CharBodyW(D, p), '#1c1e20'); prim(ctx, cyl(0.004 * D.s, 0.003 * D.s, 0.08 * D.s, 6), at(c.clone().add(new V3(0.012 * D.s, 0.085 * D.s, 0))), p => CharBodyW(D, p), '#111'); },
    pet(ctx, a) {                                                      // digital pet on a cord round the neck, or clipped to a belt loop
      const D = ctx.D;
      if (a.neck) { const p = onTorso(ctx, 0, 0.72, 0.012); tube(ctx, [onTorso(ctx, 1.2, 0.84, 0.006), onTorso(ctx, 0.5, 0.78, 0.01), p, onTorso(ctx, -0.5, 0.78, 0.01), onTorso(ctx, -1.2, 0.84, 0.006)], 0.0015 * D.s, '#d0ccc0', q => CharBodyW(D, q), { cols: 4 }); prim(ctx, sph(0.024 * D.s), at(p.clone().add(new V3(0, -0.025 * D.s, 0.01 * D.s)), [0, 0, 0], [1, 1.2, 0.55]), q => CharBodyW(D, q), '#8fd1c4', { rough: 0.35 }); return; }
      const p = onTorso(ctx, 1.15, 0.555, 0.02); prim(ctx, sph(0.024 * D.s), at(p, [0, 0, 0], [0.55, 1.2, 1]), W1('hips'), '#8fd1c4', { rough: 0.35 });
    },
    manual_pocket(ctx) { const D = ctx.D, p = onTorso(ctx, Math.PI - 0.5, 0.5, 0.008); prim(ctx, box(0.1 * D.s, 0.13 * D.s, 0.01 * D.s), at(p, [0, Math.PI - 0.5, 0]), W1('hips'), '#f2c200', { rough: 0.8 }); },
  };
  return { dress, G, ACC, top, band, patch, edge, prim, tube, headM, onTorso, offL, CharBodyW, TOPS };
})();
