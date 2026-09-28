// ============================================================================
// CharHead — sculpted heads (chars agent, internal to Chars). The head is a signed-distance sculpt
// (cranium, brow, cheekbones, eye sockets with eyeballs, nose, lips, jaw, chin, neck) sampled along
// rays from the head's vertical axis into one smooth skinned mesh (head, jaw and neck bones) with
// normals from the distance field; ears are separate shells. Head space: metres at hs = 1, origin
// between the eyes, +Z forward, +X the character's left.
//   CharHead.sdfOf(look, neckR) -> (x, y, z) => signed distance   (.P = resolved shape parameters)
//   CharHead.build(D, look) -> { geo, layout }     layout = face UV layout for CharFace (toUV, eyes, mouth, nose)
//   CharHead.surf(D, phi, y, off, out, nrm?)       character-space point on the head at angle phi (0 = front,
//                                                  +PI/2 = left) and head-space height y, pushed out by off (m);
//                                                  y above YC climbs over the crown (0.126 = the top)
//   CharHead.uv(phi, y) -> [u, v]                  face-canvas UV (the front gets most of the canvas)
//   CharHead.sample(sdf, phi, y, p, n?) -> r · CharHead.rayOf(phi, y, o[6]) -> [ox, oy, oz, dx, dy, dz]   the sampling rays (head space)
//   CharHead.sd = { ell, ellX, cap, smin, smax }   distance primitives (Quad sculpts the animals with them)
// ============================================================================
const CharHead = (() => {
  const V3 = THREE.Vector3;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const HY0 = -0.19, YB = -0.085, YC = 0.088, HY1 = 0.126, UMAX = 1.55, ZAX = -0.012;

  // ---- distance primitives ----------------------------------------------------------------------------
  function ell(x, y, z, cx, cy, cz, rx, ry, rz) {
    const X = (x - cx) / rx, Y = (y - cy) / ry, Z = (z - cz) / rz;
    const k0 = Math.sqrt(X * X + Y * Y + Z * Z), k1 = Math.sqrt(X * X / (rx * rx) + Y * Y / (ry * ry) + Z * Z / (rz * rz));
    return k1 > 1e-9 ? k0 * (k0 - 1) / k1 : -Math.min(rx, ry, rz);
  }
  // ellipsoid tilted about X by a (its +Y axis leans toward -Z)
  function ellX(x, y, z, cx, cy, cz, rx, ry, rz, a) {
    const c = Math.cos(a), s = Math.sin(a), dy = y - cy, dz = z - cz;
    return ell(x, dy * c - dz * s, dy * s + dz * c, cx, 0, 0, rx, ry, rz);
  }
  function cap(x, y, z, ax, ay, az, bx, by, bz, ra, rb) {
    const px = x - ax, py = y - ay, pz = z - az, ux = bx - ax, uy = by - ay, uz = bz - az;
    const h = clamp((px * ux + py * uy + pz * uz) / (ux * ux + uy * uy + uz * uz), 0, 1);
    return Math.hypot(px - ux * h, py - uy * h, pz - uz * h) - (ra + (rb - ra) * h);
  }
  const NOX = { smile: 0, frown: 0, brow: 0, fur: 0, pucker: 0, wide: 0 };
  const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
  const smax = (a, b, k) => -smin(-a, -b, k);

  // ---- the sculpt -----------------------------------------------------------------------------------------
  function params(look) {
    const h = look.head || {}, fem = look.fem ?? (look.sex === 'f' ? 1 : 0), kid = look.child ? 1 : 0, age = look.age ?? 30;
    const P = {
      fem, kid, age, wid: h.width ?? 1, cr: h.cranium ?? 1, jaw: (h.jaw ?? 1) * (1 - fem * 0.12), chin: (h.chin ?? 1) * (1 - fem * 0.08),
      brow: (h.brow ?? 1) * (1 - fem * 0.6) * (1 - kid * 0.5), cheek: h.cheek ?? 1, lips: (h.lips ?? 1) * (1 + fem * 0.04),
      nose: h.nose ?? 1, noseW: (h.noseW ?? 1) * (1 - fem * 0.08), bump: h.noseBump || 0, full: (h.full || 0) * (1 - kid * 0.5) + kid * 0.25, hollow: h.hollow || 0,
      ex: (h.ipd ?? (0.0625 - fem * 0.002)) / 2, mw: (h.mouthW ?? (0.025 - fem * 0.001)) / 0.025,
      mY: -0.0745 + fem * 0.003 + (h.mouthUp || 0),
    };
    P.nl = 0.047 * (0.8 + 0.2 * P.nose) * (1 - fem * 0.07) * (1 - kid * 0.12);              // nasion -> tip drop
    P.tipY = 0.004 - P.nl; P.tipZ = 0.103 + 0.013 * (P.nose - 1) - fem * 0.003 - kid * 0.005;
    P.chinY = -0.103 + kid * 0.004;
    P.lf = 1 - kid * 0.1 - fem * 0.04;
    // sculpt coordinates below the cheeks are stretched by 1/lf; the landmarks others use are the real ones
    const real = y => y < -0.035 ? -0.035 + (y + 0.035) * P.lf : y;
    P.S = { mY: P.mY, tipY: P.tipY, chinY: P.chinY };
    P.mY = real(P.mY); P.tipY = real(P.tipY); P.chinY = real(P.chinY);
    return P;
  }
  // X: expression shapes for the morph targets { smile, frown, brow (raise), fur (knit), pucker, wide }, each 0..1.
  // The sculpt is a list of primitives blended in order. Each carries a bounding box: when the box is farther than
  // the running distance plus the blend radius, the primitive cannot change the result and is skipped.
  function sdfOf(look, neckR = 0.05, X = NOX) {
    const P = params(look), { wid, cr, jaw, chin, brow, cheek, lips, noseW, bump, full, hollow, ex, mw, tipZ } = P, { mY, tipY, chinY } = P.S;
    const jx = 0.041 * jaw * wid, lf = P.lf, { smile, frown, pucker, wide, fur } = X, raise = X.brow;
    const fn = 1 - P.fem * 0.05;                                        // women's faces taper below the cheekbones
    const lw = mw * (1 + wide * 0.12 - pucker * 0.24 + smile * 0.06), cw = 1 / (0.023 * mw);
    const L = [];
    const E = (k, cx, cy, cz, rx, ry, rz, sub) => L.push({ t: 0, k, sub, cx, cy, cz, ix: 1 / rx, iy: 1 / ry, iz: 1 / rz, x0: cx - rx, x1: cx + rx, y0: cy - ry, y1: cy + ry, z0: cz - rz, z1: cz + rz });
    const Cp = (k, ax, ay, az, bx, by, bz, ra, rb) => { const m = Math.max(ra, rb); L.push({ t: 1, k, a: [ax, ay, az, bx, by, bz, ra, rb], x0: Math.min(ax, bx) - m, x1: Math.max(ax, bx) + m, y0: Math.min(ay, by) - m, y1: Math.max(ay, by) + m, z0: Math.min(az, bz) - m, z1: Math.max(az, bz) + m }); };
    const G = (k, x0, x1, y0, y1, z0, z1, fn) => L.push({ t: 2, k, fn, x0, x1, y0, y1, z0, z1 });
    E(0, 0, 0.027, -0.013, 0.0745 * wid, 0.092 * cr, 0.1 * cr);                                        // cranium
    E(0.015, 0, -0.01, -0.02, 0.068 * wid, 0.055, 0.08);                                                // temporal / parietal sides
    E(0.02, 0, -0.026, 0.004, 0.064 * wid * (1 - P.fem * 0.03), 0.056, 0.078);                                               // midface
    E(0.02, 0, -0.07, 0.014, 0.05 * jaw * wid, 0.032, 0.066);                                           // lower face
    Cp(0.015, 0.052 * wid * fn, -0.035, -0.016, jx, -0.086, -0.024, 0.011, 0.01);                            // ramus
    Cp(0.016, jx, -0.086, -0.024, 0.016 * chin, chinY - 0.003, 0.06, 0.01, 0.01);                       // mandible
    E(0.016, 0, chinY + frown * 0.003, 0.066 + P.kid * 0.002 + frown * 0.002, 0.019 * chin, 0.017, 0.019); // chin
    E(0.024, 0, -0.07, 0.036 - P.kid * 0.004, 0.037 * mw, 0.03, 0.048);                                // dental arch
    E(0.02, 0.041 * wid * fn, -0.058, -0.002, 0.016 * (1 - P.fem * 0.25), 0.03, 0.032);                                           // masseters
    const jf = Math.min(1, 0.55 + 0.45 * jaw);
    E(0.022, 0.034 * jf * fn * (1 - hollow * 0.12), -0.043, 0.018, 0.026 * (1 - hollow * 0.3) * (1 - P.fem * 0.1), 0.042, 0.042); // cheeks (buccal fill; hollow cheeks lose it)
    E(0.024, 0.048, -0.017, 0.04, 0.019, 0.014, 0.019 * cheek);                                         // cheekbones
    E(0.014, 0.032, -0.036 + smile * 0.007, 0.058 + smile * 0.003, 0.019 * (1 + smile * 0.12), 0.018, 0.017 * (1 + smile * 0.25)); // malar fat
    E(0.018, (0.026 + 0.014 * full - 0.008 * hollow) * jf, -0.056, 0.03, 0.024, 0.024, 0.028);           // cheek fullness
    E(0.02, 0.083, 0.03, 0.03, 0.008, 0.018, 0.02, true);                                               // temples
    E(0.02, 0.029 - fur * 0.003, 0.016 + raise * 0.0045 - fur * 0.0028, 0.068 + fur * 0.0015, 0.024, 0.011, 0.014 * (0.6 + 0.4 * brow)); // brow ridge
    E(0.01, 0, 0.014 - fur * 0.002, 0.079 + fur * 0.0022, 0.014, 0.012, 0.009);                         // glabella
    E(0.013, ex * 1.02, 0.002 + raise * 0.0015, 0.091, 0.0155, 0.011, 0.012, true);                     // eye socket
    G(0.008, ex - 0.0145, ex + 0.0145, -0.015, 0.014, 0.049, 0.079, (ax, y, z, d) => smin(d, Math.hypot(ax - ex, y + 0.0005, z - 0.064) - 0.0145, 0.008)); // eyeball
    G(0.009, 0, 0.022, tipY - 0.012, 0.013, 0.07, tipZ + 0.012, (ax, y, z, d) => {                                      // nose
      let n = cap(ax, y, z, 0, 0.006, 0.077, 0, tipY + 0.008, tipZ - 0.004, 0.0056 * noseW, 0.0078 * noseW);
      n = smin(n, ell(ax, y, z, 0, tipY + 0.003, tipZ - 0.001, 0.0102 * noseW, 0.0092, 0.0098), 0.006);
      n = smin(n, ell(ax, y, z, 0.0112 * noseW, tipY - 0.003, tipZ - 0.0155, 0.0064 * noseW, 0.0056, 0.0088), 0.006);
      n = smin(n, ell(ax, y, z, 0, tipY - 0.005, tipZ - 0.009, 0.0048, 0.0042, 0.0092), 0.004);
      if (bump) n = smin(n, ell(ax, y, z, 0, lerp(0.006, tipY, 0.4), lerp(0.077, tipZ, 0.42) + 0.0015, 0.0052, 0.009, 0.0035 + 0.002 * bump), 0.004);
      return smin(d, n, 0.009);
    });
    G(0.008, 0, 0.032, mY - 0.026, mY + 0.014, 0.07, 0.11, (ax, y, z, d) => {                                 // lips (corners bend with the expression)
      const cq = Math.min(1.6, (ax * cw) ** 2), yl = y - (smile * 0.0045 - frown * 0.0035) * cq, zl = z + (smile * 0.004 + wide * 0.002) * cq - pucker * 0.005 * (1 - cq * 0.4);
      d = smin(d, ellX(ax, yl, zl, 0, mY + 0.0045, 0.083, 0.0228 * lw, 0.0056 * lips * (1 + pucker * 0.15), 0.0078, 0.5), 0.008);
      d = smin(d, ell(ax, yl, zl, 0, mY + 0.0026, 0.0866, 0.0065, 0.0028 * lips, 0.005), 0.004);         // tubercle
      d = smin(d, ellX(ax, yl, zl, 0, mY - 0.0062 + frown * 0.0015, 0.08 + frown * 0.0015, 0.02 * lw, 0.0066 * lips * (1 + pucker * 0.15), 0.0084, -0.35), 0.007);
      d = smax(d, -ell(ax, yl, zl, 0, mY, 0.1075, 0.022 * lw, 0.0007, 0.0135), 0.0018);                    // lip line
      return smax(d, -ell(ax, y, z, 0, mY - 0.02, 0.093, 0.02, 0.0045, 0.011), 0.006);                    // mentolabial sulcus
    });
    if (full > 0.3) E(0.02, 0, chinY - 0.016, 0.042, 0.034 * jaw, 0.022 * full, 0.034);              // a heavy face's double chin
    Cp(0.03, 0, -0.045, -0.03, 0, -0.22, -0.024, neckR * 0.92, neckR * 1.04);                          // neck (blend narrows toward the jaw)
    L[L.length - 1].neck = true;
    if (!P.fem && !P.kid) E(0.012, 0, -0.142, -0.03 + neckR - 0.004, 0.009, 0.013, 0.012);              // Adam's apple
    const n = L.length;
    const f = (x, y0, z) => {
      const ax = x < 0 ? -x : x, y = y0 < -0.035 ? -0.035 + (y0 + 0.035) / lf : y0;           // shorter lower face for children
      let d = 1;
      for (let i = 0; i < n; i++) {
        const e = L[i];
        if (i) {
          const bx = ax < e.x0 ? e.x0 - ax : ax > e.x1 ? ax - e.x1 : 0, by = y < e.y0 ? e.y0 - y : y > e.y1 ? y - e.y1 : 0, bz = z < e.z0 ? e.z0 - z : z > e.z1 ? z - e.z1 : 0;
          const bd = bx || by || bz ? Math.sqrt(bx * bx + by * by + bz * bz) : 0;
          if (e.sub ? bd >= e.k - d : bd >= d + e.k) continue;
        }
        if (e.t === 2) { d = e.fn(ax, y, z, d); continue; }
        let v;
        if (e.t === 0) {
          const X = (ax - e.cx) * e.ix, Y = (y - e.cy) * e.iy, Z = (z - e.cz) * e.iz;
          const k0 = Math.sqrt(X * X + Y * Y + Z * Z), k1 = Math.sqrt(X * X * e.ix * e.ix + Y * Y * e.iy * e.iy + Z * Z * e.iz * e.iz);
          v = k1 > 1e-9 ? k0 * (k0 - 1) / k1 : -0.01;
        } else { const a = e.a; v = cap(ax, y, z, a[0], a[1], a[2], a[3], a[4], a[5], a[6], a[7]); }
        d = i === 0 ? v : e.neck ? smin(d, v, lerp(0.03, 0.01, sstep(-0.05, 0.0, z))) : e.sub ? smax(d, -v, e.k) : smin(d, v, e.k);
      }
      return d;
    };
    f.P = P; f.neckR = neckR;
    return f;
  }

  // ---- ray sampling ----------------------------------------------------------------------------------------
  // outermost surface crossing along o + r*d (d unit), r in (0, 0.25]; r0: a start just outside the surface
  // (the neighbouring sample's radius + margin) saves most of the steps
  function march(f, ox, oy, oz, dx, dy, dz, r0 = 0.25) {
    let r = r0, v = f(ox + dx * r, oy + dy * r, oz + dz * r), lo = r;
    while (v < 0 && r < 0.25) { r = Math.min(0.25, r + 0.012); v = f(ox + dx * r, oy + dy * r, oz + dz * r); }
    lo = r;
    for (let i = 0; i < 80 && v > 2e-5; i++) {
      lo = r; r -= Math.max(v * 0.85, 2e-5);
      if (r <= 0) return 0;
      v = f(ox + dx * r, oy + dy * r, oz + dz * r);
    }
    if (v < 0) {                                                               // stepped inside: bisect back to the crossing
      let hi = r;
      for (let i = 0; i < 16; i++) { const m = (lo + hi) / 2, vm = f(ox + dx * m, oy + dy * m, oz + dz * m); if (vm > 0) lo = m; else hi = m; }
      r = (lo + hi) / 2;
    }
    return r;
  }
  // ray for a (phi, y) sample: horizontal from the axis between YB and YC; above YC, from (0, YC, ZAX) climbing
  // to the crown; below YB, from (0, YB, ZAX) tilting down under the jaw and chin and on down the neck
  function rayOf(phi, y, o) {
    const s = Math.sin(phi), c = Math.cos(phi);
    const el = y > YC ? Math.min(1, (y - YC) / (HY1 - YC)) * Math.PI / 2 : y < YB ? -(YB - y) / (YB - HY0) * 1.36 : 0, ce = Math.cos(el);
    o[0] = 0; o[1] = clamp(y, YB, YC); o[2] = ZAX; o[3] = s * ce; o[4] = Math.sin(el); o[5] = c * ce;
    return o;
  }
  const _o = [0, 0, 0, 0, 0, 0];
  function sample(f, phi, y, p, n, r0) {
    const o = rayOf(phi, y, _o), r = march(f, o[0], o[1], o[2], o[3], o[4], o[5], r0);
    p.set(o[0] + o[3] * r, o[1] + o[4] * r, o[2] + o[5] * r);
    if (n) grad(f, p, n);
    return r;
  }
  function grad(f, p, n) {
    const e = 0.0006, x = p.x, y = p.y, z = p.z;
    const k1 = f(x + e, y - e, z - e), k2 = f(x - e, y - e, z + e), k3 = f(x - e, y + e, z - e), k4 = f(x + e, y + e, z + e);
    return n.set(k1 - k2 - k3 + k4, -k1 - k2 + k3 + k4, -k1 + k2 - k3 + k4).normalize();
  }
  const warp = t => 1.35 * t - 0.35 * t * t * t;
  const uv = (phi, y) => [0.5 + 0.5 * warp(clamp(phi / UMAX, -1, 1)), clamp((y - HY0) / (HY1 - HY0), 0, 1)];

  // hair/hat anchor: character-space point pushed out along the normal
  const _p = new V3(), _n = new V3();
  function surf(D, phi, y, off, out, nrm) {
    const n = nrm || _n;
    sample(D.sdf, phi, y, _p, n);
    if (y > 0.02 && n.y < -0.2) { n.y = -0.2; n.normalize(); }
    return out.copy(_p).addScaledVector(n, off / D.hs).multiplyScalar(D.hs).add(D.headO);
  }

  // ---- mesh ---------------------------------------------------------------------------------------------------
  function rows(P, lod) {
    const ys = [], k = lod < 1 ? 2.6 : 1;
    for (let y = HY0; y < HY1; ) { ys.push(y); const fine = y > -0.118 && y < 0.03; y += (fine ? 0.0024 : 0.0055) * (fine ? k * 1.1 : k); }
    ys.push(HY1);
    for (const o of [-0.0024, -0.0005, 0.0005, 0.0024]) {                    // rows on the lip line so the jaw parts the lips cleanly
      const t = P.mY + o; let bi = 0, bd = 9;
      ys.forEach((y, i) => { const d = Math.abs(y - t); if (d < bd && y < YC) { bd = d; bi = i; } });
      ys[bi] = t;
    }
    return ys.sort((a, b) => a - b);
  }
  function cols(lod) {
    const C = lod < 1 ? 35 : 101, out = [];
    for (let j = 0; j < C; j++) { const t = j / (C - 1) * 2 - 1; out.push(Math.PI * (0.22 * t + 0.78 * Math.pow(Math.abs(t), 5) * Math.sign(t))); }
    return out;
  }

  function build(D, look) {
    const CB = CharBody, { BI } = CB, f = D.sdf, P = f.P, hs = D.hs, O = D.headO, lod = CB.LOD;
    const mb = new CB.MB(), ys = rows(P, lod), phis = cols(lod), R = ys.length, C = phis.length;
    const p = new V3(), n = new V3(), q = new V3(), grid = [];
    const mY = P.mY, jawAt = (phi, y) => {
      const a = Math.abs(phi), lip = 1 - sstep(mY - 0.0009, mY + 0.0009, y);
      const front = 1 - sstep(0.5, 1.15, a), low = sstep(-0.08, -0.1, y) * (1 - sstep(1.2, 1.7, a));
      return lip * Math.max(front, low * 0.9) * (y > -0.035 ? 0 : 1);
    };
    // positions and normals along the rays
    const pts = [], nrm = [], hints = [];
    let hint = 0.25;
    for (let i = 0; i < R; i++) {
      const pr = [], nr = [], hr = [];
      for (let j = 0; j < C; j++) {
        hint = sample(f, phis[j], ys[i], p, n, j ? hint + 0.015 : 0.25);
        pr.push(p.clone()); nr.push(n.clone()); hr.push(hint);
      }
      pts.push(pr); nrm.push(nr); hints.push(hr);
    }
    for (let i = 0; i < R; i++) {
      const row = [];
      for (let j = 0; j < C; j++) {
        const phi = phis[j], y = ys[i], pp = pts[i][j];
        const [u, v] = uv(phi, y);
        const dn = cap(Math.abs(pp.x), pp.y, pp.z, 0, -0.045, -0.03, 0, -0.22, -0.024, f.neckR, f.neckR * 1.04);
        const neck = (1 - sstep(0.0005, 0.005, dn)) * sstep(-0.075, -0.125, pp.y) * 0.9;
        const jw = jawAt(phi, y) * (1 - neck);
        const w = [[BI.head, Math.max(0, 1 - jw - neck)]];
        if (jw > 0.001) w.push([BI.jaw, jw]);
        if (neck > 0.001) w.push([BI.neck, neck]);
        q.copy(pp).multiplyScalar(hs).add(O);
        row.push({ i: mb.v(q, nrm[i][j], u, v, WHITE, w, 0.55), x: pp.x, r: hints[i][j] });
      }
      grid.push(row);
    }
    for (let i = 0; i < R - 1; i++) for (let j = 0; j < C - 1; j++) {
      const a = grid[i][j].i, b = grid[i][j + 1].i, c = grid[i + 1][j].i, d = grid[i + 1][j + 1].i;
      mb.tri(a, b, c); mb.tri(b, d, c);
    }
    ears(mb, D, look);
    const geo = mb.geometry();
    if (lod >= 1) morphs(geo, D, look, grid, ys, phis, mb.n);
    // face-canvas layout: invert (x, y) on the front to the ray angle through the sampled rows
    const front = []; for (let j = 0; j < C; j++) if (Math.abs(phis[j]) <= UMAX) front.push(j);
    const hy = ys.filter(y => y <= YC && y >= YB), rowIdx = hy.map(y => ys.indexOf(y));
    const mid = front.indexOf(phis.indexOf(phis.reduce((a, b) => Math.abs(b) < Math.abs(a) ? b : a)));
    const mono = grid.map(row => {                                          // x per front column, forced monotonic outward from the centre
      const xs = front.map(j => row[j].x);
      for (let k = mid + 1; k < xs.length; k++) xs[k] = Math.max(xs[k], xs[k - 1] + 1e-7);
      for (let k = mid - 1; k >= 0; k--) xs[k] = Math.min(xs[k], xs[k + 1] - 1e-7);
      return xs;
    });
    const phiOnRow = (i, x) => {
      const xs = mono[i]; let lo = 0, hi = xs.length - 1;
      if (x <= xs[lo]) return phis[front[lo]];
      if (x >= xs[hi]) return phis[front[hi]];
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (xs[m] < x) lo = m; else hi = m; }
      return lerp(phis[front[lo]], phis[front[hi]], (x - xs[lo]) / (xs[hi] - xs[lo] || 1));
    };
    const toUV = (x, y) => {
      let lo = 0, hi = hy.length - 1;
      y = clamp(y, hy[0], hy[hi]);
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (hy[m] < y) lo = m; else hi = m; }
      const t = (y - hy[lo]) / (hy[hi] - hy[lo] || 1);
      return uv(lerp(phiOnRow(rowIdx[lo], x), phiOnRow(rowIdx[hi], x), t), y);
    };
    const eyeW = (look.head && look.head.eyeW) ?? 0.0148, e = 0.002, sv = 1 / (HY1 - HY0);
    const su = (toUV(P.ex + e, 0)[0] - toUV(P.ex - e, 0)[0]) / (2 * e);
    const L = { toUV, sv, su, eyeL: toUV(P.ex, 0), eyeR: toUV(-P.ex, 0), eyeW, ipd: P.ex * 2, mouth: toUV(0, mY), mouthW: 0.025 * P.mw * (1 - P.fem * 0.04), mouthY: mY,
      tipY: P.tipY, noseW: P.noseW, chinY: P.chinY, browY: 0.0165, hairY: (look.head && look.head.hairline) ?? 0.068, P };
    return { geo, layout: L };
  }

  // Expression morph targets: the sculpt re-sampled along the same rays with an expression applied; smile and
  // brow raise split per side / inner-outer. Names: smileL smileR frown browIn browOut fur pucker wide.
  const MORPHS = [['smile', { smile: 1 }, -0.125, 0.014, 1.35], ['frown', { frown: 1 }, -0.13, -0.035, 1.1], ['brow', { brow: 1 }, -0.012, 0.07, 1.25],
    ['fur', { fur: 1 }, -0.015, 0.05, 0.9], ['pucker', { pucker: 1 }, -0.115, -0.04, 0.9], ['wide', { wide: 1 }, -0.115, -0.04, 1.05]];
  function morphs(geo, D, look, grid, ys, phis, nV) {
    const hs = D.hs, p = new V3(), n = new V3(), pos = geo.attributes.position, nrm = geo.attributes.normal, O = D.headO;
    const out = { position: [], normal: [] };
    const push = (name, dp, dn) => { const a = new THREE.Float32BufferAttribute(dp, 3), b = new THREE.Float32BufferAttribute(dn, 3); a.name = b.name = name; out.position.push(a); out.normal.push(b); };
    for (const [name, X, y0, y1, amax] of MORPHS) {
      const f = sdfOf(look, D.sdf.neckR, Object.assign({}, NOX, X)), dp = new Float32Array(nV * 3), dn = new Float32Array(nV * 3);
      for (let i = 0; i < ys.length; i++) {
        if (ys[i] < y0 || ys[i] > y1) continue;
        for (let j = 0; j < phis.length; j++) {
          if (Math.abs(phis[j]) > amax) continue;
          const k = grid[i][j].i;
          sample(f, phis[j], ys[i], p, n, grid[i][j].r + 0.012);
          dp[k * 3] = p.x * hs + O.x - pos.getX(k); dp[k * 3 + 1] = p.y * hs + O.y - pos.getY(k); dp[k * 3 + 2] = p.z * hs + O.z - pos.getZ(k);
          dn[k * 3] = n.x - nrm.getX(k); dn[k * 3 + 1] = n.y - nrm.getY(k); dn[k * 3 + 2] = n.z - nrm.getZ(k);
        }
      }
      if (name === 'smile' || name === 'brow') {                            // split: left/right, inner/outer
        const a = [new Float32Array(nV * 3), new Float32Array(nV * 3)], b = [new Float32Array(nV * 3), new Float32Array(nV * 3)];
        for (let k = 0; k < nV; k++) {
          const x = (pos.getX(k) - O.x) / hs, w = name === 'smile' ? sstep(-0.006, 0.006, x) : 1 - sstep(0.012, 0.032, Math.abs(x));
          for (let c = 0; c < 3; c++) { a[0][k * 3 + c] = dp[k * 3 + c] * w; a[1][k * 3 + c] = dp[k * 3 + c] * (1 - w); b[0][k * 3 + c] = dn[k * 3 + c] * w; b[1][k * 3 + c] = dn[k * 3 + c] * (1 - w); }
        }
        const nm = name === 'smile' ? ['smileL', 'smileR'] : ['browIn', 'browOut'];
        push(nm[0], a[0], b[0]); push(nm[1], a[1], b[1]);
      } else push(name, dp, dn);
    }
    geo.morphAttributes.position = out.position; geo.morphAttributes.normal = out.normal; geo.morphTargetsRelative = true;
  }
  const WHITE = new THREE.Color(1, 1, 1);

  // ears: front face with a raised helix rim and a hollow concha, flat back, standing slightly forward
  function ears(mb, D, look) {
    const CB = CharBody, hs = D.hs, O = D.headO, h = look.head || {}, ear = h.ear ?? 1, earY = -0.02, p = new V3();
    for (const sd of [1, -1]) {
      sample(D.sdf, sd * 1.5, earY, p);
      const ec = new V3(p.x - sd * 0.002, earY, p.z - 0.008);
      const nOut = new V3(sd, 0, 0.2).normalize(), up = new V3(0, 1, -0.14).normalize(), fw = new V3().crossVectors(up, nOut).multiplyScalar(sd).normalize();
      const [eu, ev] = uv(sd * 1.55, earY);
      const NR = 5, NT = CB.LOD < 1 ? 12 : 18;
      CB.surf(mb, NR * 2 + 1, NT + 1, (i, j) => {
        const fr = i <= NR, r = fr ? i / NR : (2 * NR - i) / NR, th = j / NT * Math.PI * 2;
        const st = Math.sin(th), ct = Math.cos(th);
        const ha = 0.0135 * ear * (1 - 0.22 * Math.max(0, -st)), hb = 0.0265 * ear;
        const u = ct * ha * r, v = st * hb * r - (st < 0 ? 0.003 * r : 0);
        const base = Math.max(0, 0.011 - u) * 0.42 + 0.001;
        const rim = r > 0.72 ? 0.0036 * Math.sin((r - 0.72) / 0.28 * Math.PI) * (1 - 0.6 * Math.max(0, ct)) : 0;
        const bowl = -0.0034 * Math.exp(-((r - 0.35) ** 2) / 0.06) * (1 - 0.5 * Math.max(0, st));
        const w = fr ? base + 0.0032 + rim + bowl : base - 0.001;
        const q = ec.clone().addScaledVector(fw, u).addScaledVector(up, v).addScaledVector(nOut, w);
        const inner = fr && r < 0.72 ? Math.exp(-((r - 0.35) ** 2) / 0.08) : 0;
        return { p: q.multiplyScalar(hs).add(O), u: eu, v: ev, w: CB.W1('head'), c: new THREE.Color(0.95 - inner * 0.28, 0.84 - inner * 0.4, 0.82 - inner * 0.4), r: 0.5 };
      }, { wrap: true, rough: 0.5 });
    }
  }

  return { sdfOf, build, surf, uv, sample, rayOf, sd: { ell, ellX, cap, smin, smax }, HY0, HY1, YC, UMAX };
})();
