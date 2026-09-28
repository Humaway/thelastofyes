// ============================================================================
// Tex — procedural canvas textures and cached PBR materials. Every texture/material is
// generated once and cached; cached objects carry userData.shared = true so area unloads
// never dispose them. Owned by: world agent.
//
// UV CONVENTION: every Build.* geometry has UVs in METRES (world-aligned projection), and every
// Tex.mat texture defaults to its natural real-world tile size (Tex.info(name).tile, metres), so a
// material looks right on a box of any size with no repeat maths. Pass `repeat` only for geometry
// with 0..1 UVs (a raw THREE.PlaneGeometry), or `scale` (metres per tile) to resize a pattern.
//
// CONTRACT
//   Tex.get(name, {repeat}) -> THREE.Texture  colour map (sRGB, RepeatWrapping, 512 px, tileable). Names:
//      concrete, concrete_wet (puddles), brick (QLD face brick), brick_painted, asphalt, asphalt_lines (one lane, dashed
//      centre line), rust, metal (brushed), metal_painted (chipped), wood, planks (weathered deck/fence boards),
//      floorboards (varnished), plywood, moss, grass, dirt, gravel, sand, snow, leaves (leaf litter), bark, bark_gum,
//      fabric, carpet, tiles (30 cm glazed), tiles_mall (60 cm polished stone), plaster, wallpaper, render (painted wall),
//      roof_tiles, corrugated, glass_dirty (RGBA), paper, water, noise, screenrot (blue growth, RGBA),
//      screen_feed (endless phone feed; animated), skin, denim, knit,
//      + cardboard, laminate (counter tops), leather (vinyl/leather upholstery), sandstone (ashlar), weatherboard,
//        fibro (fibre-cement sheet), tarp, pavers, chainlink (RGBA wire mesh; use alphaTest), paint (worn road-marking paint, RGBA)
//   Tex.normal(name) / Tex.rough(name) -> normal map (Sobel of the height pattern) / roughness map (G channel)
//   Tex.info(name) -> { tile: [u, v] metres, metal, alpha }        Tex.names -> every material texture name
//   Tex.mat(name, opts) -> cached MeshStandardMaterial with map + normalMap + roughnessMap
//      opts: { color (tint, multiplies the texture), repeat:[u,v] | scale (m per tile), rough (multiplies the map),
//              metal, normal (normalScale), emissive, emissiveIntensity, transparent, opacity, side, alphaTest,
//              vc (vertexColors), key }. Same name+opts returns the same instance.
//      Special names: 'screen_feed' (emissive animated feed), 'screenrot' (opaque glowing growth; flickers).
//   Tex.color(hex, opts) -> cached plain MeshStandardMaterial (opts: rough, metal, emissive, emissiveIntensity,
//      transparent, opacity, side, vc, flat)
//   Tex.vc(material) -> cached twin of a material with vertexColors on (Build uses it for baked AO/tints)
//   Tex.text(text, {w, h, font, size, color, bg, align, pad, weight, italic, glow, lineGap}) -> Texture ('\n' = new line)
//   Tex.sign(kind, text, {faded 0..1, color}) -> Texture. kinds:
//      shopfront  the yellow "yes" lightbox fascia; text = store line ('REDCLIFFE')              1024x256
//      banner     promo vinyl banner; 'MIDNIGHT LAUNCH — BE FIRST' ('—' splits headline/subline)  1024x256
//      street     street-name blade ('ANZAC AVE')                                                  512x96
//      road_sign  '60' speed disc | 'STOP' | 'GIVE WAY' | any other text = yellow warning diamond (RGBA)  256x256
//      stencil    COMMS stencil board; 'ROAD CLOSED — SCREEN CHECK' ('—' splits lines)             1024x384
//      comms      COMMS emblem board ('CHECKPOINT 4')                                              1024x384
//      neon       glowing tube lettering (opts.color)                                              512x256
//      whiteboard marker handwriting; lines by '\n'; prefix a line 'r:' red, 'b:' blue, 'g:' green, 'k:' black  1024x640
//      plaque     engraved brass ('STORE OF THE YEAR\nOPTUS REDCLIFFE')                             512x320
//      price_tag  shelf talker 'PRODUCT|$PRICE'                                                    256x160
//      ration     hand-painted 'RATIONS — PLEASE TAKE A NUMBER'                                     1024x320
//      lanyard_card staff ID 'NAME\nTITLE'                                                         256x384
//      door       small door plate ('STAFF ONLY')                                                   256x96
//      fuel_prices servo pylon price board; lines 'UNLEADED 91|189.9' ('\n' separated)             256x512
//      hand       hand-painted board text (plywood, black paint; 'FILM NIGHT — FRIDAY')              1024x384
//      logo       the "yes" wordmark alone, transparent (opts.color)                                  512x256
//      phone_box  retail phone box print                                                          256x256
//      plate      Queensland number plate ('425 KDL')                                             256x96
//      police     blue/white Battenburg strip with POLICE                                        1024x128
//   Tex.poster(kind, {worn 0..1}) -> Texture (512x724, RGBA with torn edges when worn). kinds:
//      comms_look_up, comms_report, comms_execution, comms_curfew, band, promo_launch, promo_upgrade, promo_rest,
//      say_yes (YES crossed out), missing_person, landlines_dialtone, school_notice, fitness, party_toga,
//      values_teamwork, first_aid
//   Tex.graffiti(text, {color, style:'spray'|'drip'|'stencil'|'tally'|'cord', w, h}) -> Texture (RGBA)
//      tally: text = count. cord: the Landlines coiled-cord symbol (text ignored).
//   Tex.decal(kind) -> Texture (RGBA 512): blood, stain, crack, water_stain, soot, moss_patch, coffee_ring, footprints,
//      skid, oil, puddle, scorch
//   Tex.photo(kind) -> Texture (painted print with border): baby_in_polo, fridge_faces, store_team, launch_night,
//      school_report ('SEE ME' in red)
//   Tex.screen(kind, {time, pct}) -> Texture for TVs/phones/monitors: lock (INFINITE notification; opts.time), installing
//      (opts.pct), news (newsreader), news_scroll (newsreader scrolling her phone on air), demo (store attract loop),
//      monitor (POS), eftpos, off, feed (= the animated screen_feed texture)
//   Tex.foliage(kind) -> RGBA leaf-card texture: gum, broad, palm, pine, willow, ivy, grass
//   Tex.preload() -> [jobs]           warms the common textures during the loading screen
//   Tex.animate(dt, t)                advances animated textures (feed swipes, screen-rot flicker). Build registers an
//                                     area updater that calls it, so nobody else needs to.
//   Tex.time                          { value: seconds } shared shader-time uniform (Build FX use it too)
// ============================================================================
const Tex = (() => {
  const cache = new Map(), mats = new Map(), feeds = [], rots = [];
  const time = { value: 0 };
  let clock = 0, aniso = 0;
  const shared = x => (x.userData.shared = true, x);
  const FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';
  const sat = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const ss = (a, b, v) => { const t = sat((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const hh = (a, b = 0, c = 0) => { let h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 1440662683); h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967296; };
  const C = hex => [(hex >> 16 & 255) / 255, (hex >> 8 & 255) / 255, (hex & 255) / 255];
  const canvas = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const ctx = c => c.getContext('2d', { willReadFrequently: true });
  const ANISO = () => aniso || (aniso = Engine.renderer ? Math.min(8, Engine.renderer.capabilities.getMaxAnisotropy()) : 1);
  function toTex(c, srgb = true, wrap = true) {
    const t = shared(new THREE.CanvasTexture(c));
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = ANISO();
    return t;
  }

  // ---- tileable noise ------------------------------------------------------
  // value-noise fBm; px/py = lattice cells across the tile (integers), octaves double them
  function field(S, px, py, oct, r, gain = 0.5) {
    const out = new Float32Array(S * S); let amp = 1, tot = 0;
    for (let o = 0; o < oct; o++, px *= 2, py *= 2, amp *= gain) {
      const L = new Float32Array(px * py); for (let k = 0; k < L.length; k++) L[k] = r();
      tot += amp;
      for (let y = 0, i = 0; y < S; y++) {
        const fy = y / S * py, yi = fy | 0, ty = fy - yi, sy = ty * ty * (3 - 2 * ty), r0 = yi * px, r1 = ((yi + 1) % py) * px;
        for (let x = 0; x < S; x++, i++) {
          const fx = x / S * px, xi = fx | 0, tx = fx - xi, sx = tx * tx * (3 - 2 * tx), x1 = (xi + 1) % px;
          const a = L[r0 + xi], b = L[r0 + x1], c = L[r1 + xi], d = L[r1 + x1];
          out[i] += amp * (a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy);
        }
      }
    }
    for (let i = 0; i < out.length; i++) out[i] /= tot;
    return out;
  }
  const fbm = (S, p, oct, r, gain) => field(S, p, p, oct, r, gain);
  // tileable Worley: f1/f2 distances in cell units, id = random per cell
  function cells(S, n, r, jit = 1, wx = null, wy = null, wa = 0) {
    const jx = new Float32Array(n * n), jy = new Float32Array(n * n);
    for (let k = 0; k < n * n; k++) { jx[k] = 0.5 + (r() - 0.5) * jit; jy[k] = 0.5 + (r() - 0.5) * jit; }
    const f1 = new Float32Array(S * S), f2 = new Float32Array(S * S), id = new Float32Array(S * S);
    for (let y = 0, i = 0; y < S; y++) for (let x = 0; x < S; x++, i++) {
      const u = x / S * n + (wx ? (wx[i] - 0.5) * wa : 0), v = y / S * n + (wy ? (wy[i] - 0.5) * wa : 0), cx = Math.floor(u), cy = Math.floor(v);
      let d1 = 9, d2 = 9, best = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const X = cx + dx, Y = cy + dy, k = ((Y + n) % n) * n + (X + n) % n;
        const ex = X + jx[k] - u, ey = Y + jy[k] - v, d = Math.sqrt(ex * ex + ey * ey);
        if (d < d1) { d2 = d1; d1 = d; best = k; } else if (d < d2) d2 = d;
      }
      f1[i] = d1; f2[i] = d2; id[i] = hh(best, n, 17);
    }
    return { f1, f2, id };
  }
  // canvas-drawn tileable mask (draw is called for all 9 wrap offsets with a fresh seeded rng)
  function wrapDraw(S, seed, draw, blur = 0, bg = '#000') {
    const c = canvas(S), g = ctx(c); g.fillStyle = bg; g.fillRect(0, 0, S, S);
    if (blur) g.filter = `blur(${blur}px)`;
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { g.save(); g.translate(ox, oy); draw(g, U.rng(seed)); g.restore(); }
    return c;
  }
  function mask(S, seed, draw, blur = 0) {
    const d = ctx(wrapDraw(S, seed, draw, blur)).getImageData(0, 0, S, S).data, m = new Float32Array(S * S);
    for (let i = 0; i < m.length; i++) m[i] = d[i * 4] / 255;
    return m;
  }
  function crackLines(g, S, r, n, len = 1, w = 1) {
    g.strokeStyle = '#fff'; g.lineCap = g.lineJoin = 'round';
    const walk = (x, y, a, steps, lw) => {
      g.lineWidth = lw; g.beginPath(); g.moveTo(x, y);
      for (let s = 0; s < steps; s++) {
        a += (r() - 0.5) * 0.9; const l = S * 0.012 * (0.5 + r()); x += Math.cos(a) * l; y += Math.sin(a) * l; g.lineTo(x, y);
        if (r() < 0.05 && lw > 0.5) { g.stroke(); walk(x, y, a + (r() - 0.5) * 2.4, steps * 0.4 | 0, lw * 0.6); g.lineWidth = lw; g.beginPath(); g.moveTo(x, y); }
      }
      g.stroke();
    };
    for (let k = 0; k < n; k++) walk(r() * S, r() * S, r() * 6.283, 12 + r() * 36 * len | 0, w * (0.6 + r() * 0.8));
  }
  function blobs(g, S, r, n, rmin, rmax, alpha = 1) {
    for (let k = 0; k < n; k++) {
      const x = r() * S, y = r() * S, rad = rmin + r() * (rmax - rmin), gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, `rgba(255,255,255,${alpha})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
  }
  function dots(g, S, r, n, rmin, rmax, col = '#fff') { g.fillStyle = col; for (let k = 0; k < n; k++) { g.beginPath(); g.arc(r() * S, r() * S, rmin + r() * (rmax - rmin), 0, 6.283); g.fill(); } }
  function scratches(g, S, r, n, alpha = 0.5) {
    g.lineCap = 'round';
    for (let k = 0; k < n; k++) { const x = r() * S, y = r() * S, a = r() * 6.283, l = S * (0.01 + r() * 0.06); g.strokeStyle = `rgba(255,255,255,${alpha * r()})`; g.lineWidth = 0.5 + r(); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + r() * 3, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  }

  // ---- per-pixel painter ---------------------------------------------------
  function paint(S, fn, base) {
    const c = new Uint8ClampedArray(S * S * 4), h = new Float32Array(S * S), ro = new Float32Array(S * S), o = { r: 0, g: 0, b: 0, h: 0.5, ro: 0.8, a: 1 };
    for (let y = 0, i = 0; y < S; y++) for (let x = 0; x < S; x++, i++) {
      if (base) { o.r = base[i * 4] / 255; o.g = base[i * 4 + 1] / 255; o.b = base[i * 4 + 2] / 255; }
      o.a = 1; fn(x, y, i, o);
      const j = i * 4; c[j] = o.r * 255; c[j + 1] = o.g * 255; c[j + 2] = o.b * 255; c[j + 3] = o.a * 255; h[i] = o.h; ro[i] = o.ro;
    }
    return { c, h, ro };
  }
  const setc = (o, c, k = 1) => { o.r = c[0] * k; o.g = c[1] * k; o.b = c[2] * k; };
  const mixc = (o, c, t) => { o.r += (c[0] - o.r) * t; o.g += (c[1] - o.g) * t; o.b += (c[2] - o.b) * t; };
  const mul = (o, k) => { o.r *= k; o.g *= k; o.b *= k; };
  const grey = (o, v, w = 0) => { o.r = v * (1 + w); o.g = v; o.b = v * (1 - w); };

  // ---- material textures -----------------------------------------------------
  function concreteDraw(S, r, wet) {
    const a = fbm(S, 3, 6, r), b = fbm(S, 24, 3, r), f = fbm(S, 128, 2, r), pd = fbm(S, 2, 5, r),
      cr = mask(S, 11, (g, q) => crackLines(g, S, q, 4, 0.8, 1), 0.6),
      pr = mask(S, 12, (g, q) => dots(g, S, q, 900, 0.5, 1.5)),
      st = mask(S, 13, (g, q) => blobs(g, S, q, 10, S * 0.05, S * 0.18, 0.5), 2);
    return paint(S, (x, y, i, o) => {
      let v = 0.56 + (a[i] - 0.5) * 0.32 + (b[i] - 0.5) * 0.1 + (f[i] - 0.5) * 0.12 - pr[i] * 0.12 - cr[i] * 0.25 - st[i] * 0.08;
      o.h = 0.5 + (b[i] - 0.5) * 0.3 + (f[i] - 0.5) * 0.5 - pr[i] * 0.6 - cr[i] * 0.8;
      o.ro = 0.8 + (a[i] - 0.5) * 0.25 - st[i] * 0.15;
      if (wet) {
        const p = ss(0.54, 0.6, pd[i] + (b[i] - 0.5) * 0.1);
        v *= 0.62 - p * 0.18; o.h = o.h * (1 - p) + 0.5 * p; o.ro = (0.42 + (a[i] - 0.5) * 0.3) * (1 - p) + 0.03 * p;
      }
      grey(o, v, -0.02);
    });
  }
  function brickDraw(S, r, painted) {
    const n = fbm(S, 16, 4, r), f = fbm(S, 96, 2, r), big = fbm(S, 3, 4, r), fl = fbm(S, 6, 5, r);
    const PAL = [C(0x9a4a30), C(0xa85a3a), C(0x86402c), C(0xb06a48), C(0x7a3a28), C(0x9c5238), C(0x8c5a42)];
    return paint(S, (x, y, i, o) => {
      const fv = y / S * 12, row = fv | 0, lv = fv - row, fu = x / S * 4 + (row & 1) * 0.5, col = fu | 0, lu = fu - col;
      const d = Math.min(Math.min(lu, 1 - lu) * 240, Math.min(lv, 1 - lv) * 86), edge = 4.5 + (n[i] - 0.5) * 7;
      const mortar = d < edge;
      if (mortar) { const m = 0.6 + (f[i] - 0.5) * 0.15; setc(o, [m, m * 0.96, m * 0.88]); o.h = 0.2 + f[i] * 0.1; o.ro = 0.95; }
      else {
        const k = 0.8 + hh(col % 4, row, 7) * 0.3 + (n[i] - 0.5) * 0.35 + (f[i] - 0.5) * 0.22 - (1 - lu) * hh(col % 4, row, 3) * 0.15;
        setc(o, PAL[hh(col % 4, row) * PAL.length | 0], k);
        o.h = 0.62 + ss(edge, edge + 9, d) * 0.2 + (f[i] - 0.5) * 0.25; o.ro = 0.86;
      }
      if (painted && fl[i] > 0.4) { const pv = 0.86 + (big[i] - 0.5) * 0.1 - (mortar ? 0.1 : 0); setc(o, [pv, pv * 0.97, pv * 0.9]); o.h += 0.05; o.ro = 0.72; }
      else if (painted) mul(o, 0.9);
      mul(o, 1 + (big[i] - 0.5) * 0.25);
    });
  }
  function asphaltDraw(S, r, lines) {
    const a = fbm(S, 4, 5, r), f = fbm(S, 160, 1, r), w = cells(S, 110, r), wear = fbm(S, 16, 4, r),
      cr = mask(S, 21, (g, q) => crackLines(g, S, q, 6, 1, 1.1), 0.5),
      oil = mask(S, 22, (g, q) => blobs(g, S, q, 5, S * 0.03, S * 0.09, 0.8), 3),
      patch = mask(S, 23, (g, q) => { g.fillStyle = '#fff'; for (let k = 0; k < 2; k++) g.fillRect(q() * S, q() * S, S * (0.15 + q() * 0.2), S * (0.1 + q() * 0.15)); }, 6);
    return paint(S, (x, y, i, o) => {
      const stone = ss(0.42, 0.18, w.f1[i]);
      let v = 0.19 + (a[i] - 0.5) * 0.1 + (f[i] - 0.5) * 0.07 + stone * (w.id[i] - 0.45) * 0.34 - patch[i] * 0.02 - oil[i] * 0.07 - cr[i] * 0.09;
      o.h = 0.5 + stone * 0.35 + (f[i] - 0.5) * 0.3 - cr[i] * 0.7;
      o.ro = 0.9 - oil[i] * 0.45;
      if (lines) {
        const u = x / S, vv = y / S, pnt = ss(0.019, 0.013, Math.abs(u - 0.5)) * (vv < 0.5 ? 1 : 0) * ss(0.3, 0.5, wear[i] + f[i] * 0.2);
        v += (0.8 - v) * pnt; o.ro -= pnt * 0.25; o.h += pnt * 0.1;
      }
      grey(o, v, -0.01);
    });
  }
  function plankDraw(S, r, n, joints, base, gap, rough, weather, nails) {
    const w = field(S, 3, 2, 4, r), fib = field(S, 160, 3, 2, r), big = fbm(S, 3, 4, r), f = fbm(S, 128, 1, r);
    return paint(S, (x, y, i, o) => {
      const fb = x / S * n, b = fb | 0, lx = fb - b, v = y / S;
      let jd = 1;
      for (let k = 0; k < joints; k++) { const jv = (hh(b, k, 5) + k) / joints % 1, d = Math.abs(v - jv); jd = Math.min(jd, Math.min(d, 1 - d)); }
      const t = (lx + hh(b, 9) * 7) * 3.2 + (w[i] - 0.5) * 3 + v * hh(b, 4) * 2, ring = Math.pow(0.5 + 0.5 * Math.sin(t * 6.283), 3);
      setc(o, base, 0.78 + hh(b, 2) * 0.38 - ring * 0.2 + (fib[i] - 0.5) * 0.25 + (big[i] - 0.5) * weather);
      const edge = Math.min(lx, 1 - lx) * S / n, g = ss(gap * 0.4, gap, edge) * ss(0.0015, 0.004, jd);
      mul(o, 0.35 + 0.65 * g);
      const nail = (nails && jd < 0.03 && Math.abs(lx - 0.5) > 0.2 && Math.abs(lx - 0.5) < 0.32 && Math.abs(jd - 0.016) < 0.006) ? 1 : 0;
      if (nail) grey(o, 0.2);
      o.h = 0.25 + g * 0.55 + ring * 0.05 + (fib[i] - 0.5) * 0.2 - nail * 0.1;
      o.ro = rough + (f[i] - 0.5) * 0.1 + (1 - g) * 0.1;
    });
  }
  // straight-grained timber: growth rings as thin late-wood bands, fibre streaks, gentle waviness, one soft knot
  function grainDraw(S, r, base, dark, rings, warp, ro) {
    const w = field(S, 2, 2, 4, r), fib = field(S, 256, 3, 2, r), tone = fbm(S, 3, 4, r), k = [r(), r()];
    return paint(S, (x, y, i, o) => {
      let dx = x / S - k[0], dy = (y / S - k[1]) * 0.25; dx -= Math.round(dx); dy -= Math.round(dy);
      const kn = Math.exp(-(dx * dx + dy * dy) * 2500);
      const t = x / S * rings + (w[i] - 0.5) * warp + kn * 1.2, f = t - Math.floor(t);
      const ring = ss(0.72, 0.9, f) * (1 - ss(0.93, 1, f));
      setc(o, base, 0.94 + (tone[i] - 0.5) * 0.18); mixc(o, dark, ring * 0.26 + (fib[i] - 0.5) * 0.3 + kn * 0.4);
      o.h = 0.5 - ring * 0.12 + (fib[i] - 0.5) * 0.35; o.ro = ro + ring * 0.08;
    });
  }
  function tileDraw(S, r, n, grout, base, vary, ro, speck) {
    const a = fbm(S, 4, 5, r), f = fbm(S, 128, 2, r), sp = speck ? cells(S, 150, r) : null, dirt = fbm(S, 12, 3, r);
    return paint(S, (x, y, i, o) => {
      const fu = x / S * n, fv = y / S * n, tu = fu | 0, tv = fv | 0, lu = fu - tu, lv = fv - tv;
      const d = Math.min(lu, 1 - lu, lv, 1 - lv) * S / n, id = hh(tu, tv, 3);
      if (d < grout) { const g = 0.6 - dirt[i] * 0.15; setc(o, [g, g * 0.97, g * 0.92]); o.h = 0.2; o.ro = 0.92; return; }
      setc(o, base, 1 - vary + id * vary * 2 + (a[i] - 0.5) * 0.08 + (f[i] - 0.5) * 0.03);
      if (sp) { const s = ss(0.26, 0.1, sp.f1[i]) * (sp.id[i] < 0.3 || sp.id[i] > 0.8 ? 1 : 0); mixc(o, sp.id[i] < 0.3 ? [0.3, 0.29, 0.28] : [0.97, 0.96, 0.93], s * 0.6); }
      o.h = 0.6 + ss(grout, grout + 2.5, d) * 0.2; o.ro = ro + (a[i] - 0.5) * 0.1;
    });
  }

  const DEF = {
    noise: { tile: 2, ns: 1, draw(S, r) { const n = fbm(S, 4, 6, r); return paint(S, (x, y, i, o) => { grey(o, n[i]); o.h = n[i]; o.ro = 0.8; }); } },
    concrete: { tile: 3, ns: 2.5, draw: (S, r) => concreteDraw(S, r, false) },
    concrete_wet: { tile: 3, ns: 2, draw: (S, r) => concreteDraw(S, r, true) },
    brick: { tile: [0.96, 1.032], ns: 3, draw: (S, r) => brickDraw(S, r, false) },
    brick_painted: { tile: [0.96, 1.032], ns: 3, draw: (S, r) => brickDraw(S, r, true) },
    asphalt: { tile: 4, ns: 2.5, draw: (S, r) => asphaltDraw(S, r, false) },
    asphalt_lines: { tile: [3.5, 6], ns: 2.5, draw: (S, r) => asphaltDraw(S, r, true) },
    rust: { tile: 1.5, ns: 3, metal: 0.3, draw(S, r) {
      const a = fbm(S, 4, 6, r), b = fbm(S, 16, 4, r), f = fbm(S, 128, 2, r), st = field(S, 24, 2, 4, r), pit = mask(S, 31, (g, q) => dots(g, S, q, 1500, 0.4, 1.4));
      return paint(S, (x, y, i, o) => {
        const t = ss(0.35, 0.62, a[i] * 0.7 + b[i] * 0.3);
        setc(o, [0.2, 0.17, 0.15]); mixc(o, [0.38, 0.2, 0.11], t); mixc(o, [0.64, 0.33, 0.13], ss(0.52, 0.75, b[i] * 0.6 + f[i] * 0.4) * t);
        mul(o, 0.85 + (f[i] - 0.5) * 0.4 - pit[i] * 0.3 + (st[i] - 0.5) * 0.25);
        o.h = 0.5 + t * 0.2 + (f[i] - 0.5) * 0.6 - pit[i] * 0.5; o.ro = 0.55 + t * 0.4;
      });
    } },
    metal: { tile: 1, ns: 0.8, metal: 0.85, draw(S, r) {
      const br = field(S, 2, 256, 2, r), a = fbm(S, 4, 5, r), sc = mask(S, 41, (g, q) => scratches(g, S, q, 160));
      return paint(S, (x, y, i, o) => { grey(o, 0.62 + (br[i] - 0.5) * 0.14 + (a[i] - 0.5) * 0.12 + sc[i] * 0.12, -0.015); o.h = 0.5 + (br[i] - 0.5) * 0.3 - sc[i] * 0.2; o.ro = 0.36 + (a[i] - 0.5) * 0.3 + sc[i] * 0.1; });
    } },
    metal_painted: { tile: 1.5, ns: 1.5, metal: 0.15, draw(S, r) {
      const a = fbm(S, 5, 5, r), op = fbm(S, 180, 1, r), chip = fbm(S, 28, 4, r), sc = mask(S, 51, (g, q) => scratches(g, S, q, 70, 0.7));
      return paint(S, (x, y, i, o) => {
        const ch = ss(0.71, 0.73, chip[i]), v = 0.82 + (a[i] - 0.5) * 0.12 + (op[i] - 0.5) * 0.03;
        grey(o, v); mixc(o, [0.3, 0.2, 0.15], ch); mixc(o, [0.55, 0.55, 0.55], sc[i] * 0.6);
        o.h = 0.55 + (op[i] - 0.5) * 0.1 - ch * 0.3 - sc[i] * 0.1; o.ro = 0.48 + (a[i] - 0.5) * 0.2 + ch * 0.4;
      });
    } },
    wood: { tile: 1, ns: 0.8, draw: (S, r) => grainDraw(S, r, [0.8, 0.64, 0.46], [0.5, 0.34, 0.2], 14, 0.9, 0.6) },
    plywood: { tile: 1.2, ns: 1, draw(S, r) {
      const w = fbm(S, 3, 5, r), f = field(S, 128, 6, 2, r), p = fbm(S, 8, 3, r);
      return paint(S, (x, y, i, o) => {
        const ring = Math.pow(0.5 + 0.5 * Math.sin(w[i] * 60), 3);
        setc(o, [0.8, 0.66, 0.46], 0.95 - ring * 0.07 + (f[i] - 0.5) * 0.12 + (p[i] - 0.5) * 0.1);
        o.h = 0.5 - ring * 0.15 + (f[i] - 0.5) * 0.2; o.ro = 0.75;
      });
    } },
    planks: { tile: [1.68, 2.4], ns: 2.5, draw: (S, r) => plankDraw(S, r, 12, 1, [0.55, 0.47, 0.37], 3, 0.85, 0.35, true) },
    floorboards: { tile: [2, 2], ns: 1.5, draw: (S, r) => plankDraw(S, r, 24, 2, [0.66, 0.44, 0.25], 1.2, 0.32, 0.1) },
    moss: { tile: 1, ns: 3, draw(S, r) {
      const a = fbm(S, 6, 6, r), f = fbm(S, 96, 2, r), c = cells(S, 40, r);
      return paint(S, (x, y, i, o) => {
        const cl = 1 - ss(0.2, 0.9, c.f1[i]);
        setc(o, [0.17, 0.26, 0.09]); mixc(o, [0.42, 0.5, 0.17], a[i] * 0.8 + cl * 0.3); mul(o, 0.8 + (f[i] - 0.5) * 0.6);
        o.h = cl * 0.6 + f[i] * 0.4; o.ro = 0.95;
      });
    } },
    grass: { tile: 2, ns: 2.5, draw(S, r) {
      const a = fbm(S, 4, 5, r), dry = fbm(S, 3, 4, r), f = fbm(S, 128, 1, r),
        bl = mask(S, 61, (g, q) => { g.lineCap = 'round'; for (let k = 0; k < 5000; k++) { const x = q() * S, y = q() * S, l = 3 + q() * 9, an = -1.57 + (q() - 0.5) * 1.4; g.strokeStyle = `rgba(255,255,255,${0.3 + q() * 0.7})`; g.lineWidth = 0.6 + q() * 0.9; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(an) * l, y + Math.sin(an) * l); g.stroke(); } });
      return paint(S, (x, y, i, o) => {
        setc(o, [0.13, 0.2, 0.07]); mixc(o, [0.3, 0.42, 0.13], a[i]); mixc(o, [0.52, 0.5, 0.26], ss(0.52, 0.7, dry[i]) * 0.8);
        mul(o, 0.72 + bl[i] * 0.45 + (f[i] - 0.5) * 0.2); o.h = bl[i] * 0.7 + f[i] * 0.3; o.ro = 0.95;
      });
    } },
    dirt: { tile: 2, ns: 3, draw(S, r) {
      const a = fbm(S, 3, 6, r), f = fbm(S, 128, 2, r), c = cells(S, 48, r), damp = fbm(S, 4, 4, r);
      return paint(S, (x, y, i, o) => {
        const peb = c.id[i] > 0.86 ? ss(0.36, 0.2, c.f1[i]) : 0;
        setc(o, [0.36, 0.27, 0.19], 0.82 + (a[i] - 0.5) * 0.5 + (f[i] - 0.5) * 0.3); mul(o, 1 - ss(0.55, 0.7, damp[i]) * 0.25);
        mixc(o, [0.46, 0.42, 0.36], peb * 0.6); o.h = 0.4 + (f[i] - 0.5) * 0.4 + peb * 0.5 + (a[i] - 0.5) * 0.3; o.ro = 0.95 - peb * 0.1;
      });
    } },
    gravel: { tile: 1, ns: 4, draw(S, r) {
      const c = cells(S, 26, r, 0.9), f = fbm(S, 128, 2, r);
      return paint(S, (x, y, i, o) => {
        const e = c.f2[i] - c.f1[i], st = ss(0.02, 0.2, e), id = c.id[i];
        grey(o, (0.4 + id * 0.3 + (f[i] - 0.5) * 0.15) * (0.3 + 0.7 * st) * (0.75 + 0.35 * (1 - c.f1[i])), (hh(id * 1e6) - 0.5) * 0.12);
        o.h = st * 0.8 + (f[i] - 0.5) * 0.2; o.ro = 0.85;
      });
    } },
    sand: { tile: 2, ns: 2, draw(S, r) {
      const w = fbm(S, 3, 4, r), f = fbm(S, 200, 1, r), a = fbm(S, 4, 4, r);
      return paint(S, (x, y, i, o) => { const rip = 0.5 + 0.5 * Math.sin((y / S * 18 + (w[i] - 0.5) * 5) * 6.283); setc(o, [0.78, 0.68, 0.51], 0.9 + (f[i] - 0.5) * 0.25 + rip * 0.05 + (a[i] - 0.5) * 0.15); o.h = rip * 0.4 + f[i] * 0.3; o.ro = 0.95; });
    } },
    snow: { tile: 2, ns: 1.5, draw(S, r) {
      const a = fbm(S, 4, 6, r), f = fbm(S, 64, 3, r), sp = mask(S, 71, (g, q) => dots(g, S, q, 400, 0.3, 0.8));
      return paint(S, (x, y, i, o) => { const h = a[i] * 0.6 + f[i] * 0.4; setc(o, [0.86, 0.9, 0.96], 0.92 + h * 0.1 + sp[i] * 0.1); o.h = h; o.ro = 0.7 - sp[i] * 0.4; });
    } },
    leaves: { tile: 1, ns: 2.5, draw(S, r) {
      const lf = (g, q, hm) => {
        for (let k = 0; k < 1400; k++) {
          const x = q() * S, y = q() * S, a = q() * 6.283, l = 10 + q() * 16, w = l * (0.18 + q() * 0.1), c = q();
          const col = c < 0.3 ? [120, 92, 50] : c < 0.55 ? [96, 90, 52] : c < 0.75 ? [140, 108, 58] : c < 0.9 ? [84, 58, 36] : [150, 70, 40];
          const k2 = 0.7 + q() * 0.4;
          g.save(); g.translate(x, y); g.rotate(a);
          g.fillStyle = hm ? `rgb(${140 + k * 0.08 | 0},0,0)` : `rgb(${col[0] * k2 | 0},${col[1] * k2 | 0},${col[2] * k2 | 0})`;
          g.beginPath(); g.moveTo(-l / 2, 0); g.quadraticCurveTo(0, -w, l / 2, 0); g.quadraticCurveTo(0, w * 0.6, -l / 2, 0); g.fill(); g.restore();
        }
      };
      const col = ctx(wrapDraw(S, 81, (g, q) => lf(g, q, false), 0, '#2e2519')).getImageData(0, 0, S, S).data, hm = mask(S, 81, (g, q) => lf(g, q, true)), f = fbm(S, 64, 2, r);
      return paint(S, (x, y, i, o) => { o.h = hm[i] + (f[i] - 0.5) * 0.1; o.ro = 0.9; mul(o, 0.9 + (f[i] - 0.5) * 0.2); }, col);
    } },
    bark: { tile: [1, 2], ns: 5, draw(S, r) {
      const rid = field(S, 16, 2, 5, r, 0.6), f = fbm(S, 64, 3, r), li = fbm(S, 12, 4, r);
      return paint(S, (x, y, i, o) => {
        const d = ss(0.38, 0.52, rid[i]);
        setc(o, [0.36, 0.31, 0.26], 0.35 + d * 0.75 + (f[i] - 0.5) * 0.35); mixc(o, [0.55, 0.58, 0.5], ss(0.7, 0.76, li[i]) * d * 0.5);
        o.h = d * 0.8 + (f[i] - 0.5) * 0.2; o.ro = 0.95;
      });
    } },
    bark_gum: { tile: [1, 2], ns: 1.5, draw(S, r) {
      const p1 = field(S, 3, 2, 5, r), p2 = field(S, 4, 2, 5, r), st = field(S, 40, 3, 3, r), f = fbm(S, 64, 2, r);
      return paint(S, (x, y, i, o) => {
        setc(o, [0.86, 0.83, 0.76]); const a = ss(0.5, 0.56, p1[i]), b = ss(0.52, 0.58, p2[i]);
        mixc(o, [0.64, 0.66, 0.62], a); mixc(o, [0.8, 0.62, 0.5], b * (1 - a * 0.5)); mul(o, 0.88 + (st[i] - 0.5) * 0.3 + (f[i] - 0.5) * 0.1);
        o.h = 0.5 + (a - b) * 0.15 + (st[i] - 0.5) * 0.2; o.ro = 0.6;
      });
    } },
    fabric: { tile: 0.25, ns: 1.5, draw(S, r) {
      const f = fbm(S, 64, 2, r), sl = field(S, 4, 90, 2, r);
      return paint(S, (x, y, i, o) => {
        const top = ((x >> 2) + (y >> 2)) & 1, p = top ? Math.sin((x % 4 + 0.5) / 4 * Math.PI) : Math.sin((y % 4 + 0.5) / 4 * Math.PI);
        grey(o, 0.7 + p * 0.1 + (f[i] - 0.5) * 0.12 + (sl[i] - 0.5) * 0.1); o.h = p * 0.7 + f[i] * 0.3; o.ro = 0.95;
      });
    } },
    carpet: { tile: 0.5, ns: 2, draw(S, r) {
      const c = cells(S, 110, r), f = fbm(S, 200, 1, r), a = fbm(S, 6, 4, r);
      return paint(S, (x, y, i, o) => { const l = 1 - ss(0.1, 0.7, c.f1[i]); grey(o, 0.42 + l * 0.12 + (f[i] - 0.5) * 0.2 + (a[i] - 0.5) * 0.08, 0.02); o.h = l * 0.6 + f[i] * 0.4; o.ro = 1; });
    } },
    tiles: { tile: 1.2, ns: 2, draw: (S, r) => tileDraw(S, r, 4, 1.4, [0.88, 0.86, 0.8], 0.04, 0.16, false) },
    tiles_mall: { tile: 2.4, ns: 0.5, draw: (S, r) => tileDraw(S, r, 4, 1.1, [0.82, 0.8, 0.76], 0.035, 0.12, true) },
    pavers: { tile: 1.2, ns: 2.5, draw: (S, r) => tileDraw(S, r, 4, 1.8, [0.52, 0.5, 0.47], 0.07, 0.85, false) },
    plaster: { tile: 2, ns: 0.12, draw(S, r) {
      const a = fbm(S, 3, 6, r), f = fbm(S, 64, 3, r), t = field(S, 6, 2, 4, r);
      return paint(S, (x, y, i, o) => { grey(o, 0.86 + (a[i] - 0.5) * 0.06 + (t[i] - 0.5) * 0.04 + (f[i] - 0.5) * 0.02, 0.02); o.h = f[i] * 0.3; o.ro = 0.9; });
    } },
    render: { tile: 2, ns: 1.4, draw(S, r) {
      const g = fbm(S, 160, 2, r), t = fbm(S, 8, 3, r), st = field(S, 20, 2, 4, r), a = fbm(S, 3, 5, r);
      return paint(S, (x, y, i, o) => { grey(o, 0.86 + (g[i] - 0.5) * 0.1 - ss(0.55, 0.75, st[i] * 0.6 + a[i] * 0.4) * 0.12, 0.03); o.h = g[i] * 0.7 + t[i] * 0.3; o.ro = 0.9; });
    } },
    wallpaper: { tile: 0.53, ns: 0.6, draw(S, r) {
      const pat = ctx(wrapDraw(S, 91, g => {
        g.fillStyle = '#c9c4a8'; g.fillRect(0, 0, S, S);
        for (let k = 0; k < 4; k++) { g.fillStyle = 'rgba(120,130,100,0.35)'; g.fillRect(k * S / 4 + S / 8 - 6, 0, 3, S); g.fillRect(k * S / 4 + S / 8 + 3, 0, 3, S); }
        g.fillStyle = 'rgba(150,120,90,0.4)';
        for (let k = 0; k < 4; k++) for (let j = 0; j < 4; j++) {
          const x = k * S / 4 + (j & 1) * S / 8, y = j * S / 4 + S / 8; g.save(); g.translate(x, y);
          for (let a = 0; a < 4; a++) { g.rotate(Math.PI / 2); g.beginPath(); g.ellipse(0, -10, 5, 11, 0, 0, 6.283); g.fill(); }
          g.restore();
        }
      })).getImageData(0, 0, S, S).data, a = fbm(S, 3, 5, r), f = fbm(S, 128, 1, r), wst = field(S, 3, 1, 4, r);
      return paint(S, (x, y, i, o) => { mul(o, 0.95 + (a[i] - 0.5) * 0.15 + (f[i] - 0.5) * 0.05 - ss(0.6, 0.8, wst[i]) * 0.12); o.h = 0.5 + (f[i] - 0.5) * 0.2; o.ro = 0.9; }, pat);
    } },
    roof_tiles: { tile: [1.2, 1.02], ns: 4, draw(S, r) {
      const f = fbm(S, 64, 3, r), a = fbm(S, 4, 5, r), li = mask(S, 101, (g, q) => blobs(g, S, q, 40, 3, 12, 0.9));
      return paint(S, (x, y, i, o) => {
        const fv = y / S * 3, row = fv | 0, lv = fv - row, fu = x / S * 4 + (row & 1) * 0.25, col = fu | 0, lu = fu - col;
        const prof = Math.abs(Math.sin(lu * Math.PI * 2)), sh = ss(0.8, 1, lv);
        setc(o, [0.58, 0.28, 0.19], 0.75 + hh(col % 4, row) * 0.3 + prof * 0.15 - sh * 0.45 + (f[i] - 0.5) * 0.2 + (a[i] - 0.5) * 0.2);
        mixc(o, [0.6, 0.6, 0.5], li[i] * 0.5);
        o.h = prof * 0.5 + lv * 0.4 - sh * 0.5 + f[i] * 0.1; o.ro = 0.8;
      });
    } },
    corrugated: { tile: 1, ns: 5, metal: 0.55, draw(S, r) {
      const c = cells(S, 40, r), st = field(S, 30, 2, 4, r), a = fbm(S, 4, 5, r), f = fbm(S, 128, 1, r);
      return paint(S, (x, y, i, o) => {
        const p = 0.5 + 0.5 * Math.sin(x / S * 13 * 6.283), rs = ss(0.6, 0.74, st[i] * 0.7 + a[i] * 0.3) * (0.3 + 0.5 * y / S);
        grey(o, 0.62 + (c.id[i] - 0.5) * 0.06 + p * 0.06 + (f[i] - 0.5) * 0.05, -0.02); mixc(o, [0.45, 0.25, 0.12], rs);
        o.h = p; o.ro = 0.42 + rs * 0.5;
      });
    } },
    glass_dirty: { tile: 1, ns: 0.3, alpha: true, draw(S, r) {
      const a = fbm(S, 4, 6, r), sm = mask(S, 111, (g, q) => { g.lineCap = 'round'; for (let k = 0; k < 30; k++) { g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 6 + q() * 20; g.beginPath(); const x = q() * S, y = q() * S; g.arc(x, y, 20 + q() * 60, q() * 6, q() * 6 + 2); g.stroke(); } }, 4), dr = field(S, 24, 3, 3, r);
      return paint(S, (x, y, i, o) => {
        const d = ss(0.5, 0.8, a[i] * 0.6 + dr[i] * 0.4);
        setc(o, [0.24, 0.27, 0.27]); mixc(o, [0.45, 0.4, 0.32], d); o.a = 0.16 + d * 0.5 + sm[i] * 0.25; o.h = 0.5; o.ro = 0.05 + d * 0.6 + sm[i] * 0.3;
      });
    } },
    paper: { tile: 0.3, ns: 0.6, draw(S, r) {
      const fb = field(S, 200, 20, 2, r), a = fbm(S, 4, 4, r);
      return paint(S, (x, y, i, o) => { setc(o, [0.93, 0.91, 0.86], 0.95 + (fb[i] - 0.5) * 0.08 + (a[i] - 0.5) * 0.08); o.h = fb[i]; o.ro = 0.95; });
    } },
    cardboard: { tile: 0.6, ns: 1, draw(S, r) {
      const fb = field(S, 128, 10, 2, r), a = fbm(S, 4, 5, r), st = mask(S, 121, (g, q) => blobs(g, S, q, 6, 10, 50, 0.5), 2);
      return paint(S, (x, y, i, o) => { const ridge = 0.5 + 0.5 * Math.sin(x / S * 80 * 6.283); setc(o, [0.64, 0.49, 0.32], 0.92 + (fb[i] - 0.5) * 0.1 + (a[i] - 0.5) * 0.12 - st[i] * 0.15 + ridge * 0.02); o.h = ridge * 0.2 + fb[i] * 0.3; o.ro = 0.95; });
    } },
    laminate: { tile: 1, ns: 0.3, draw(S, r) {
      const a = fbm(S, 4, 5, r), sp = mask(S, 131, (g, q) => dots(g, S, q, 300, 0.4, 0.9));
      return paint(S, (x, y, i, o) => { grey(o, 0.9 + (a[i] - 0.5) * 0.04 - sp[i] * 0.05); o.h = 0.5; o.ro = 0.28 + (a[i] - 0.5) * 0.1; });
    } },
    leather: { tile: 0.3, ns: 2, draw(S, r) {
      const c = cells(S, 80, r), a = fbm(S, 4, 4, r), cr = mask(S, 141, (g, q) => crackLines(g, S, q, 6, 0.5, 0.6), 0.4);
      return paint(S, (x, y, i, o) => { const p = ss(0, 0.5, c.f2[i] - c.f1[i]); grey(o, 0.46 + p * 0.06 + (a[i] - 0.5) * 0.12 - cr[i] * 0.12, 0.05); o.h = p * 0.6 - cr[i] * 0.3; o.ro = 0.48 + (1 - p) * 0.15 + (a[i] - 0.5) * 0.15 + cr[i] * 0.2; });
    } },
    sandstone: { tile: [1.2, 0.9], ns: 3, draw(S, r) {
      const str = field(S, 2, 40, 3, r), a = fbm(S, 4, 5, r), f = fbm(S, 128, 2, r);
      return paint(S, (x, y, i, o) => {
        const fv = y / S * 3, row = fv | 0, lv = fv - row, fu = x / S * 2 + (row & 1) * 0.5, col = fu | 0, lu = fu - col;
        const d = Math.min(Math.min(lu, 1 - lu) * 600, Math.min(lv, 1 - lv) * 300);
        if (d < 5) { setc(o, [0.78, 0.74, 0.66]); o.h = 0.2; o.ro = 0.95; return; }
        setc(o, [0.84, 0.72, 0.56], 0.86 + hh(col % 2, row) * 0.14 + (str[i] - 0.5) * 0.1 + (a[i] - 0.5) * 0.2 + (f[i] - 0.5) * 0.1);
        o.h = 0.6 + ss(5, 14, d) * 0.2 + (f[i] - 0.5) * 0.3; o.ro = 0.92;
      });
    } },
    weatherboard: { tile: [1.2, 1.19], ns: 4, draw(S, r) {
      const fl = fbm(S, 14, 4, r), f = field(S, 64, 4, 2, r), a = fbm(S, 3, 4, r);
      return paint(S, (x, y, i, o) => {
        const fv = y / S * 7, lv = fv - (fv | 0), sh = ss(0.9, 1, lv), peel = ss(0.68, 0.7, fl[i]);
        grey(o, 0.88 + (a[i] - 0.5) * 0.08 - sh * 0.45, 0.02); mixc(o, [0.5, 0.46, 0.4], peel);
        o.h = lv * 0.8 - sh * 0.8 - peel * 0.05 + (f[i] - 0.5) * 0.1; o.ro = 0.7 + peel * 0.2;
      });
    } },
    fibro: { tile: [1.2, 1.2], ns: 2, draw(S, r) {
      const st = fbm(S, 140, 1, r), a = fbm(S, 4, 5, r), dr = field(S, 16, 2, 4, r);
      return paint(S, (x, y, i, o) => {
        const u = x / S, strip = u < 0.04 ? 1 : 0, se = ss(0.04, 0.05, u) * ss(0, 0.005, u);
        grey(o, 0.84 + (st[i] - 0.5) * 0.06 + (a[i] - 0.5) * 0.08 - ss(0.6, 0.8, dr[i]) * 0.12 - (1 - se) * 0.1 * (1 - strip), 0.03);
        o.h = 0.5 + strip * 0.3 + (st[i] - 0.5) * 0.2; o.ro = 0.85;
      });
    } },
    tarp: { tile: 1, ns: 2, draw(S, r) {
      const cr = fbm(S, 5, 5, r), f = fbm(S, 128, 1, r);
      return paint(S, (x, y, i, o) => { const w = ((x >> 1) + (y >> 1)) & 1; setc(o, [0.16, 0.34, 0.62], 0.85 + (cr[i] - 0.5) * 0.35 + w * 0.04 + (f[i] - 0.5) * 0.08); o.h = cr[i] * 0.8 + w * 0.1; o.ro = 0.6; });
    } },
    water: { tile: 4, ns: 5, draw(S, r) {
      const a = fbm(S, 6, 5, r), b = field(S, 4, 12, 4, r);
      return paint(S, (x, y, i, o) => { setc(o, [0.02, 0.03, 0.035]); o.h = a[i] * 0.6 + b[i] * 0.4; o.ro = 0.05; });
    } },
    skin: { tile: 0.15, ns: 0.8, draw(S, r) {
      const a = fbm(S, 5, 5, r), p = mask(S, 151, (g, q) => dots(g, S, q, 1200, 0.3, 0.9));
      return paint(S, (x, y, i, o) => { setc(o, [0.8, 0.62, 0.52], 0.95 + (a[i] - 0.5) * 0.12 - p[i] * 0.04); o.r += (a[i] - 0.5) * 0.04; o.h = 0.5 - p[i] * 0.3; o.ro = 0.55; });
    } },
    denim: { tile: 0.1, ns: 1.5, draw(S, r) {
      const sl = field(S, 3, 80, 2, r), f = fbm(S, 128, 1, r), fade = fbm(S, 4, 4, r);
      return paint(S, (x, y, i, o) => { const tw = ((x + y) % 6) < 3 ? 1 : 0; setc(o, [0.2, 0.28, 0.44], 0.85 + tw * 0.12 + (sl[i] - 0.5) * 0.25); mixc(o, [0.7, 0.72, 0.75], (f[i] > 0.75 ? 0.3 : 0) + ss(0.6, 0.8, fade[i]) * 0.3); o.h = tw * 0.6 + sl[i] * 0.3; o.ro = 0.9; });
    } },
    knit: { tile: 0.08, ns: 3, draw(S, r) {
      const f = fbm(S, 64, 2, r);
      return paint(S, (x, y, i, o) => { const cx = x % 16, cy = y % 16, lx = cx < 8 ? cx : 15 - cx, v = Math.sin(Math.min(1, Math.abs(cy - lx * 0.8 - 4) / 6) * Math.PI); grey(o, 0.62 + v * 0.18 + (f[i] - 0.5) * 0.1); o.h = v; o.ro = 1; });
    } },
    chainlink: { tile: 0.3, ns: 1, alpha: true, metal: 0.7, draw(S, r) {
      const f = fbm(S, 32, 2, r);
      return paint(S, (x, y, i, o) => {
        const u = x / S * 6, v = y / S * 6, a = Math.abs(((u + v) % 1 + 1) % 1 - 0.5), b = Math.abs(((u - v) % 1 + 1) % 1 - 0.5), d = Math.min(a, b);
        const wv = ss(0.06, 0.03, d); grey(o, 0.55 + wv * 0.2 + (f[i] - 0.5) * 0.2); o.a = wv; o.h = wv; o.ro = 0.5;
      });
    } },
    paint: { tile: 2, ns: 0.6, alpha: true, draw(S, r) {
      const a = fbm(S, 16, 4, r), f = fbm(S, 128, 2, r);
      return paint(S, (x, y, i, o) => { const wear = a[i] * 0.6 + f[i] * 0.4; grey(o, 0.86 - (f[i] - 0.5) * 0.12, 0.01); o.a = ss(0.3, 0.36, wear); o.h = 0.5 + o.a * 0.2; o.ro = 0.55; });
    } },
    screenrot: { tile: 2, ns: 2, alpha: true, draw(S, r) {
      const wx = fbm(S, 4, 4, r), wy = fbm(S, 4, 4, r), c = cells(S, 10, r, 1, wx, wy, 6), c2 = cells(S, 28, r, 1, wy, wx, 10), cov = fbm(S, 3, 5, r), f = fbm(S, 96, 2, r), th = fbm(S, 8, 3, r);
      return paint(S, (x, y, i, o) => {
        const vein = 1 - ss(0.0, 0.03 + th[i] * 0.09, c.f2[i] - c.f1[i]), fine = (1 - ss(0, 0.05, c2.f2[i] - c2.f1[i])) * ss(0.45, 0.6, th[i]), node = (1 - ss(0.02, 0.22, c.f1[i])) * ss(0.4, 0.7, f[i]);
        const m = ss(0.42, 0.56, cov[i] + (f[i] - 0.5) * 0.1), g = sat(vein * 0.9 + fine * 0.4 * m + node * 0.5) * m;
        setc(o, [0.03, 0.08, 0.14]); mixc(o, [0.2, 0.62, 1], g); mixc(o, [0.8, 0.95, 1], sat(g - 0.6) * 1.5);
        o.a = sat(m * 0.85 + g * 0.3); o.h = g * 0.7 + f[i] * 0.3 * m; o.ro = 0.3;
      });
    } },
  };
  const NAMES = [...Object.keys(DEF), 'screen_feed'];
  const tileOf = n => { const t = n === 'screen_feed' ? [1, 1] : DEF[n] ? DEF[n].tile : 1; return Array.isArray(t) ? t : [t, t]; };

  function build(name) {
    const d = DEF[name], S = 512, P = d.draw(S, U.rng(U.hash(name)));
    const col = canvas(S), g = ctx(col); g.putImageData(new ImageData(P.c, S, S), 0, 0);
    const nc = canvas(S), ng = ctx(nc), nim = ng.createImageData(S, S), nd = nim.data, H = P.h, k = d.ns * S / 1024;
    const rc = canvas(S), rg = ctx(rc), rim = rg.createImageData(S, S), rd = rim.data;
    for (let y = 0, i = 0; y < S; y++) {
      const ym = ((y - 1 + S) % S) * S, yp = ((y + 1) % S) * S, y0 = y * S;
      for (let x = 0; x < S; x++, i++) {
        const xm = (x - 1 + S) % S, xp = (x + 1) % S;
        const dx = (H[y0 + xp] * 2 + H[ym + xp] + H[yp + xp]) - (H[y0 + xm] * 2 + H[ym + xm] + H[yp + xm]);
        const dy = (H[yp + x] * 2 + H[yp + xm] + H[yp + xp]) - (H[ym + x] * 2 + H[ym + xm] + H[ym + xp]);
        const nx = -dx * k, ny = dy * k, l = 1 / Math.sqrt(nx * nx + ny * ny + 1), j = i * 4;
        nd[j] = (nx * l * 0.5 + 0.5) * 255; nd[j + 1] = (ny * l * 0.5 + 0.5) * 255; nd[j + 2] = (l * 0.5 + 0.5) * 255; nd[j + 3] = 255;
        rd[j] = rd[j + 1] = rd[j + 2] = sat(P.ro[i]) * 255; rd[j + 3] = 255;
      }
    }
    ng.putImageData(nim, 0, 0); rg.putImageData(rim, 0, 0);
    return { map: toTex(col), normal: toTex(nc, false), rough: toTex(rc, false) };
  }
  function set(name) {
    const k = 'set:' + name;
    if (!cache.has(k)) {
      if (name === 'screen_feed') { const t = feedTex(); cache.set(k, { map: t, normal: null, rough: null }); }
      else if (!DEF[name]) { console.error('Tex: unknown texture ' + name); return set('noise'); }
      else cache.set(k, build(name));
    }
    return cache.get(k);
  }
  // repeat-specific clones share the GPU image
  function variant(t, rep) {
    if (!t || (rep[0] === 1 && rep[1] === 1)) return t;
    const k = t.uuid + rep.join(',');
    if (!cache.has(k)) { const c = shared(t.clone()); c.repeat.set(rep[0], rep[1]); cache.set(k, c); if (t.userData.feed) { c.userData.feed = true; feeds.push(c); } }
    return cache.get(k);
  }
  const get = (name, o = {}) => variant(set(name).map, o.repeat || [1, 1]);
  const normal = name => set(name).normal;
  const rough = name => set(name).rough;

  function mat(name, o = {}) {
    const key = 'm:' + name + JSON.stringify(o);
    if (mats.has(key)) return mats.get(key);
    const T = set(name), d = DEF[name] || {}, t = tileOf(name);
    const rep = o.repeat || (o.scale ? [1 / o.scale, 1 / o.scale] : [1 / t[0], 1 / t[1]]);
    const p = {
      map: variant(T.map, rep), color: o.color ?? 0xffffff, roughness: o.rough ?? 1, metalness: o.metal ?? d.metal ?? 0,
      side: o.side ?? THREE.FrontSide, vertexColors: !!o.vc, transparent: o.transparent ?? !!d.alpha, opacity: o.opacity ?? 1,
    };
    if (T.normal) { p.normalMap = variant(T.normal, rep); p.normalScale = new THREE.Vector2(o.normal ?? 1, o.normal ?? 1); }
    if (T.rough) p.roughnessMap = variant(T.rough, rep);
    if (o.alphaTest) p.alphaTest = o.alphaTest;
    if (d.alpha) p.depthWrite = !p.transparent;
    if (o.emissive != null) { p.emissive = o.emissive; p.emissiveIntensity = o.emissiveIntensity ?? 1; }
    if (name === 'screen_feed') Object.assign(p, { color: 0x050608, map: null, emissive: 0xffffff, emissiveMap: variant(T.map, o.repeat || [1, 0.5]), emissiveIntensity: o.emissiveIntensity ?? 1.6, roughness: 0.25 });
    if (name === 'screenrot') Object.assign(p, { emissive: 0xffffff, emissiveMap: p.map, emissiveIntensity: o.emissiveIntensity ?? 1.4, transparent: o.transparent ?? false, depthWrite: !o.transparent, alphaTest: o.transparent ? 0 : 0.02 });
    const m = shared(new THREE.MeshStandardMaterial(p));
    if (name === 'screenrot') rotify(m);
    else if (o.color != null && !o.vc && name !== 'screen_feed') { const { color: _, ...rest } = o; m.userData.tintOf = [name, rest]; }
    mats.set(key, m); return m;
  }
  function color(hex, o = {}) {
    const k = 'c' + hex + JSON.stringify(o);
    if (!mats.has(k)) {
      const m = shared(new THREE.MeshStandardMaterial({ color: hex, roughness: o.rough ?? 0.8, metalness: o.metal ?? 0, emissive: o.emissive ?? 0, emissiveIntensity: o.emissiveIntensity ?? 1, transparent: !!o.transparent, opacity: o.opacity ?? 1, side: o.side ?? THREE.FrontSide, vertexColors: !!o.vc, flatShading: !!o.flat, depthWrite: !o.transparent }));
      if (hex !== 0xffffff && !o.transparent && !o.emissive && !o.vc) m.userData.plainOf = o;
      mats.set(k, m);
    }
    return mats.get(k);
  }
  const twins = new WeakMap();
  function vc(m) {
    if (m.vertexColors || m.isShaderMaterial || m.userData.novc) return m;
    if (!twins.has(m)) { const t = m.clone(); t.vertexColors = true; t.userData.shared = !!m.userData.shared; t.onBeforeCompile = m.onBeforeCompile; t.customProgramCacheKey = m.customProgramCacheKey; twins.set(m, t); if (rots.includes(m)) { t.userData.base = m.userData.base; rots.push(t); } }
    return twins.get(m);
  }

  // screen-rot: flickering emissive with faint scrolling pixel shapes
  let pxTex = null;
  function rotify(m) {
    if (!pxTex) pxTex = cached('rotpx', 128, 128, (g, w, h, r) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); for (let k = 0; k < 90; k++) { const s = 2 + (r() * 4 | 0) * 2; g.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.7})`; g.fillRect(r() * w | 0, r() * h | 0, s, s * (r() < 0.3 ? 3 : 1)); } }, true, true);
    m.userData.base = m.emissiveIntensity;
    m.onBeforeCompile = s => {
      s.uniforms.uT = time; s.uniforms.tPx = { value: pxTex };
      s.fragmentShader = 'uniform float uT; uniform sampler2D tPx;\n' + s.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float px = texture2D(tPx, vEmissiveMapUv * 4.0 + vec2(0.0, uT * 0.03)).r;
        totalEmissiveRadiance *= 0.75 + px * (0.9 + 0.6 * sin(uT * 5.0 + vEmissiveMapUv.x * 30.0));`);
    };
    m.customProgramCacheKey = () => 'screenrot';
    rots.push(m);
  }

  // ---- canvas helpers for signage / print ----------------------------------------
  function cached(key, w, h, draw, srgb = true, wrap = false) {
    if (cache.has(key)) return cache.get(key);
    const c = canvas(w, h), g = ctx(c); draw(g, w, h, U.rng(U.hash(key)));
    const t = toTex(c, srgb, wrap); cache.set(key, t); return t;
  }
  const font = (size, weight = 'bold', fam = FONT, italic = false) => `${italic ? 'italic ' : ''}${weight} ${Math.round(size)}px ${fam}`;
  function fitText(g, text, maxW, size, weight = 'bold', fam = FONT) {
    g.font = font(size, weight, fam);
    const w = g.measureText(text).width;
    if (w > maxW) { size *= maxW / w; g.font = font(size, weight, fam); }
    return size;
  }
  function spaced(g, text, x, y, sp, align = 'center') {
    const chars = [...text], ws = chars.map(c => g.measureText(c).width), tot = ws.reduce((a, b) => a + b, 0) + sp * (chars.length - 1);
    let cx = align === 'center' ? x - tot / 2 : align === 'right' ? x - tot : x;
    const al = g.textAlign; g.textAlign = 'left';
    chars.forEach((c, i) => { g.fillText(c, cx, y); cx += ws[i] + sp; });
    g.textAlign = al; return tot;
  }
  function rrect(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
  function handwrite(g, text, x, y, size, color, r, align = 'left', maxW = 1e9) {
    g.font = font(size, '600', FONT, true);
    const tw = g.measureText(text).width * 0.92; if (tw > maxW) { size *= maxW / tw; g.font = font(size, '600', FONT, true); }
    g.fillStyle = color; g.textBaseline = 'alphabetic';
    const chars = [...text], ws = chars.map(c => g.measureText(c).width * 0.92);
    let cx = align === 'center' ? x - ws.reduce((a, b) => a + b, 0) / 2 : x;
    chars.forEach((c, i) => {
      g.save(); g.translate(cx, y + (r() - 0.5) * size * 0.08); g.rotate((r() - 0.5) * 0.12); g.scale(1 + (r() - 0.5) * 0.1, 1 + (r() - 0.5) * 0.12);
      g.fillText(c, 0, 0); g.restore(); cx += ws[i];
    });
  }
  // aging: fade, stains, specks, scratches, torn edges (RGBA)
  function age(g, w, h, r, amt, tear = true) {
    if (amt <= 0) return;
    g.save();
    g.filter = `saturate(${1 - amt * 0.55}) brightness(${1 + amt * 0.08})`; g.drawImage(g.canvas, 0, 0); g.filter = 'none';
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = `rgba(235,225,200,${amt * 0.22})`; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 6 * amt; k++) { const x = r() * w, y = r() * h, rad = 20 + r() * w * 0.25, gr = g.createRadialGradient(x, y, rad * 0.6, x, y, rad); gr.addColorStop(0, `rgba(120,95,60,${0.1 * amt})`); gr.addColorStop(0.9, `rgba(110,80,45,${0.22 * amt})`); gr.addColorStop(1, 'rgba(110,80,45,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
    for (let k = 0; k < 3; k++) { const x = r() * w; const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, `rgba(90,70,40,${0.15 * amt})`); gr.addColorStop(1, 'rgba(90,70,40,0)'); g.fillStyle = gr; g.fillRect(x, 0, 6 + r() * 20, h * (0.3 + r() * 0.7)); }
    for (let k = 0; k < 400 * amt; k++) { g.fillStyle = `rgba(${r() < 0.5 ? '40,30,20' : '255,250,240'},${r() * 0.35})`; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); }
    g.strokeStyle = `rgba(255,255,255,${0.25 * amt})`; g.lineWidth = 1.5;
    for (let k = 0; k < 3; k++) { g.beginPath(); const y = r() * h; g.moveTo(0, y); g.lineTo(w, y + (r() - 0.5) * 40); g.stroke(); }
    g.globalCompositeOperation = 'destination-out';
    if (tear && amt > 0.3) for (let k = 0; k < 4 * amt; k++) {
      const cx = r() < 0.5 ? 0 : w, cy = r() * h, s = 20 + r() * 60 * amt;
      g.beginPath(); g.moveTo(cx, cy - s); for (let j = 0; j < 7; j++) g.lineTo(cx + (cx ? -1 : 1) * r() * s * 0.8, cy - s + j * s / 3); g.lineTo(cx, cy + s); g.fill();
    }
    g.restore();
  }

  // the "yes" wordmark (Optus-parody retail brand): lowercase wordmark with a smile swoosh
  function yesMark(g, x, y, size, col = '#0e3a47', align = 'center') {
    g.save(); g.fillStyle = col; g.strokeStyle = col; g.textBaseline = 'alphabetic';
    g.font = font(size, '900'); g.textAlign = align;
    const w = g.measureText('yes').width, left = align === 'center' ? x - w / 2 : x;
    g.fillText('yes', x, y);
    g.lineWidth = size * 0.07; g.lineCap = 'round';
    g.beginPath(); g.moveTo(left + w * 0.08, y + size * 0.14); g.quadraticCurveTo(left + w * 0.55, y + size * 0.34, left + w * 1.02, y + size * 0.02); g.stroke();
    g.restore(); return w;
  }
  const cordPath = (g, x0, y0, x1, y1, loops, amp) => {
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
    g.beginPath();
    for (let i = 0; i <= loops * 24; i++) { const t = i / (loops * 24), a = t * loops * 6.283, px = t * L + Math.cos(a) * amp * 0.55 - amp * 0.55, py = Math.sin(a) * amp; const X = x0 + ux * px - uy * py, Y = y0 + uy * px + ux * py; i ? g.lineTo(X, Y) : g.moveTo(X, Y); }
  };
  // COMMS emblem: roundel with an open eye over a horizon line
  function commsMark(g, x, y, rad, col = '#fff', bg = '#1d2a1f') {
    g.save(); g.translate(x, y);
    g.fillStyle = bg; g.beginPath(); g.arc(0, 0, rad, 0, 6.283); g.fill();
    g.strokeStyle = col; g.lineWidth = rad * 0.08; g.beginPath(); g.arc(0, 0, rad * 0.86, 0, 6.283); g.stroke();
    g.lineWidth = rad * 0.07; g.beginPath(); g.moveTo(-rad * 0.55, 0); g.quadraticCurveTo(0, -rad * 0.55, rad * 0.55, 0); g.quadraticCurveTo(0, rad * 0.55, -rad * 0.55, 0); g.stroke();
    g.fillStyle = col; g.beginPath(); g.arc(0, -rad * 0.02, rad * 0.16, 0, 6.283); g.fill();
    g.font = font(rad * 0.26, '900'); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('COMMS', 0, rad * 0.56);
    g.restore();
  }
  function stencilText(g, text, x, y, size, col, align = 'center') {
    g.save(); g.font = font(size, '900'); g.textAlign = align; g.textBaseline = 'middle';
    g.shadowColor = col; g.shadowBlur = size * 0.12; g.fillStyle = col; g.globalAlpha = 0.25; g.fillText(text, x, y);
    g.shadowBlur = 0; g.globalAlpha = 0.95; g.fillText(text, x, y);
    const w = g.measureText(text).width, x0 = align === 'center' ? x - w / 2 : x;
    g.globalCompositeOperation = 'destination-out';
    for (let cx = x0; cx < x0 + w; cx += size * 0.33) g.fillRect(cx + size * 0.12, y - size * 0.05, size * 0.05, size * 0.1);
    g.restore();
  }

  function text(str, o = {}) {
    const key = 'text:' + str + JSON.stringify(o);
    return cached(key, o.w || 512, o.h || 128, (g, w, h) => {
      if (o.bg) { g.fillStyle = o.bg; g.fillRect(0, 0, w, h); }
      const lines = String(str).split('\n'), pad = o.pad ?? 12, gap = o.lineGap ?? 1.15;
      let size = o.size || Math.min((h - pad * 2) / (lines.length * gap), 200);
      g.font = font(size, o.weight || 'bold', o.font || FONT, o.italic);
      const widest = Math.max(...lines.map(l => g.measureText(l).width));
      if (widest > w - pad * 2) size *= (w - pad * 2) / widest;
      g.font = font(size, o.weight || 'bold', o.font || FONT, o.italic);
      g.fillStyle = o.color || '#fff'; g.textBaseline = 'middle'; g.textAlign = o.align || 'center';
      if (o.glow) { g.shadowColor = o.glow === true ? g.fillStyle : o.glow; g.shadowBlur = size * 0.3; }
      const x = g.textAlign === 'left' ? pad : g.textAlign === 'right' ? w - pad : w / 2, y0 = h / 2 - (lines.length - 1) * size * gap / 2;
      lines.forEach((l, i) => g.fillText(l, x, y0 + i * size * gap));
    });
  }

  // ---- signs -------------------------------------------------------------------
  const SIGNS = {
    shopfront: [1024, 256, (g, w, h, r, t, o) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#ffd83a'); gr.addColorStop(0.5, '#ffcf12'); gr.addColorStop(1, '#f2bb00');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(0, 8, w, 6); g.fillStyle = 'rgba(120,80,0,0.25)'; g.fillRect(0, h - 10, w, 10);
      const mw = yesMark(g, 70, h * 0.66, 190, '#0e3a47', 'left');
      if (t) { g.fillStyle = '#0e3a47'; g.font = font(54, '600'); g.textBaseline = 'middle'; spaced(g, t.toUpperCase(), 70 + mw + 60, h * 0.52, 12, 'left'); }
    }],
    banner: [1024, 256, (g, w, h, r, t, o) => {
      const [a, b] = t.split(/\s*—\s*/);
      g.fillStyle = '#10222f'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#ffcf12'; g.beginPath(); g.moveTo(0, 0); g.lineTo(150, 0); g.lineTo(90, h); g.lineTo(0, h); g.fill();
      g.fillStyle = '#0e3a47'; g.beginPath(); g.moveTo(150, 0); g.lineTo(172, 0); g.lineTo(112, h); g.lineTo(90, h); g.fill();
      g.fillStyle = '#ffcf12'; g.beginPath(); g.arc(w - 120, h / 2, 80, 0, 6.283); g.fill(); yesMark(g, w - 120, h / 2 + 22, 72);
      g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillStyle = '#ffcf12';
      const sz = fitText(g, a.toUpperCase(), w - 460, b ? 100 : 120, '900'); g.fillText(a.toUpperCase(), 210, b ? h * 0.4 : h / 2);
      if (b) { g.fillStyle = '#fff'; g.font = font(sz * 0.62, '800'); spaced(g, b.toUpperCase(), 214, h * 0.76, 12, 'left'); }
      g.fillStyle = '#9aa'; for (const [x, y] of [[20, 20], [w - 20, 20], [20, h - 20], [w - 20, h - 20]]) { g.beginPath(); g.arc(x, y, 9, 0, 6.283); g.fill(); g.fillStyle = '#333'; g.beginPath(); g.arc(x, y, 4, 0, 6.283); g.fill(); g.fillStyle = '#9aa'; }
    }],
    street: [512, 96, (g, w, h, r, t) => {
      g.fillStyle = '#0d5a3c'; rrect(g, 0, 0, w, h, 12); g.fill(); g.strokeStyle = '#f2f2f2'; g.lineWidth = 5; rrect(g, 7, 7, w - 14, h - 14, 8); g.stroke();
      g.fillStyle = '#f4f4f4'; g.textAlign = 'center'; g.textBaseline = 'middle'; fitText(g, t.toUpperCase(), w - 50, 60, '700'); g.fillText(t.toUpperCase(), w / 2, h / 2 + 2);
    }],
    road_sign: [256, 256, (g, w, h, r, t) => {
      g.textAlign = 'center'; g.textBaseline = 'middle';
      if (/^\d+$/.test(t)) {
        g.fillStyle = '#f4f4f0'; g.beginPath(); g.arc(128, 128, 124, 0, 6.283); g.fill(); g.strokeStyle = '#c8102e'; g.lineWidth = 22; g.beginPath(); g.arc(128, 128, 108, 0, 6.283); g.stroke();
        g.fillStyle = '#111'; fitText(g, t, 150, 110, '700'); g.fillText(t, 128, 134);
      } else if (t === 'STOP') {
        g.fillStyle = '#c8102e'; g.beginPath(); for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * 6.283; g.lineTo(128 + Math.cos(a) * 124, 128 + Math.sin(a) * 124); } g.fill();
        g.strokeStyle = '#fff'; g.lineWidth = 6; g.beginPath(); for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * 6.283; g.lineTo(128 + Math.cos(a) * 112, 128 + Math.sin(a) * 112); } g.closePath(); g.stroke();
        g.fillStyle = '#fff'; fitText(g, 'STOP', 190, 76, '700'); g.fillText('STOP', 128, 132);
      } else if (t === 'GIVE WAY') {
        g.fillStyle = '#c8102e'; g.beginPath(); g.moveTo(4, 24); g.lineTo(252, 24); g.lineTo(128, 240); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(38, 44); g.lineTo(218, 44); g.lineTo(128, 200); g.fill();
        g.fillStyle = '#111'; fitText(g, 'GIVE', 90, 40, '700'); g.fillText('GIVE', 128, 78); g.fillText('WAY', 128, 118);
      } else {
        g.fillStyle = '#ffc20e'; g.beginPath(); g.moveTo(128, 2); g.lineTo(254, 128); g.lineTo(128, 254); g.lineTo(2, 128); g.fill();
        g.strokeStyle = '#111'; g.lineWidth = 6; g.beginPath(); g.moveTo(128, 14); g.lineTo(242, 128); g.lineTo(128, 242); g.lineTo(14, 128); g.closePath(); g.stroke();
        g.fillStyle = '#111'; const ls = t.split(' '), sz = fitText(g, ls.reduce((a, b) => a.length > b.length ? a : b), 116, 34, '700');
        ls.forEach((l, i) => g.fillText(l, 128, 128 + (i - (ls.length - 1) / 2) * sz * 1.1));
      }
    }],
    stencil: [1024, 384, (g, w, h, r, t) => {
      g.fillStyle = '#d9d2bd'; g.fillRect(0, 0, w, h);
      for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(90,80,60,${r() * 0.06})`; g.fillRect(0, r() * h, w, 2 + r() * 6); }
      g.fillStyle = '#c8102e'; g.fillRect(0, 0, w, 26); g.fillRect(0, h - 26, w, 26);
      for (let x = -40; x < w; x += 80) { g.fillStyle = '#f2f2f2'; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 30, 0); g.lineTo(x + 10, 26); g.lineTo(x - 20, 26); g.fill(); g.beginPath(); g.moveTo(x, h - 26); g.lineTo(x + 30, h - 26); g.lineTo(x + 10, h); g.lineTo(x - 20, h); g.fill(); }
      commsMark(g, 130, h / 2, 90, '#1b1b1b', 'rgba(0,0,0,0)');
      const ls = t.split(/\s*—\s*/);
      g.font = font(100, '900'); const sz = Math.min(110, 100 * (w - 300) / Math.max(...ls.map(l => g.measureText(l).width)));
      ls.forEach((l, i) => stencilText(g, l, 250, h / 2 + (i - (ls.length - 1) / 2) * sz * 1.05, sz, '#161616', 'left'));
    }],
    comms: [1024, 384, (g, w, h, r, t) => {
      g.fillStyle = '#2b3524'; g.fillRect(0, 0, w, h); g.strokeStyle = '#e8e4d4'; g.lineWidth = 10; g.strokeRect(18, 18, w - 36, h - 36);
      commsMark(g, 170, h / 2, 120, '#e8e4d4', '#2b3524');
      g.fillStyle = '#e8e4d4'; g.textAlign = 'left'; g.textBaseline = 'middle'; fitText(g, t.toUpperCase(), w - 380, 96, '900'); g.fillText(t.toUpperCase(), 330, h * 0.42);
      g.font = font(34, '700'); spaced(g, 'LOOK UP. STAY ALIVE.', 334, h * 0.72, 8, 'left');
    }],
    neon: [512, 256, (g, w, h, r, t, o) => {
      const c = o.color || '#ff4fa0';
      g.fillStyle = '#060608'; g.fillRect(0, 0, w, h);
      g.textAlign = 'center'; g.textBaseline = 'middle'; const sz = fitText(g, t, w - 60, 150, '300'); g.lineWidth = sz * 0.06; g.lineJoin = 'round';
      g.shadowColor = c; g.shadowBlur = 40; g.strokeStyle = c; g.strokeText(t, w / 2, h / 2); g.shadowBlur = 16; g.strokeText(t, w / 2, h / 2);
      g.shadowBlur = 0; g.lineWidth = sz * 0.025; g.strokeStyle = '#fff'; g.strokeText(t, w / 2, h / 2);
    }],
    whiteboard: [1024, 640, (g, w, h, r, t) => {
      g.fillStyle = '#f3f4f1'; g.fillRect(0, 0, w, h);
      for (let k = 0; k < 14; k++) { const x = r() * w, y = r() * h, gr = g.createRadialGradient(x, y, 0, x, y, 60 + r() * 140); gr.addColorStop(0, 'rgba(150,160,175,0.12)'); gr.addColorStop(1, 'rgba(150,160,175,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
      g.globalAlpha = 0.08; handwrite(g, 'TARGET 250  ~ roster ~', 120, 560, 60, '#224', r); g.globalAlpha = 1;
      const COL = { r: '#c21d24', b: '#1d3fa8', g: '#197a3c', k: '#1a1c22' };
      const ls = t.split('\n'), size = Math.min(110, (h - 80) / ls.length / 1.15);
      ls.forEach((l, i) => { const m = /^([rbgk]):/.exec(l), col = m ? COL[m[1]] : i === 0 && ls.length > 2 ? COL.b : COL.k; handwrite(g, m ? l.slice(2) : l, 70, 40 + size * (i + 0.85) * 1.15, size * (i === 0 && ls.length > 2 ? 0.8 : 1), col, r, 'left', w - 120); });
    }],
    plaque: [512, 320, (g, w, h, r, t) => {
      const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#b8914a'); gr.addColorStop(0.45, '#e2c27a'); gr.addColorStop(0.55, '#c9a55c'); gr.addColorStop(1, '#8a6a30');
      g.fillStyle = gr; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 2) { g.fillStyle = `rgba(255,255,255,${r() * 0.05})`; g.fillRect(0, y, w, 1); }
      g.strokeStyle = 'rgba(70,50,20,0.6)'; g.lineWidth = 4; g.strokeRect(16, 16, w - 32, h - 32);
      for (const [x, y] of [[32, 32], [w - 32, 32], [32, h - 32], [w - 32, h - 32]]) { g.fillStyle = '#7a5c28'; g.beginPath(); g.arc(x, y, 8, 0, 6.283); g.fill(); }
      const ls = t.split('\n'); g.textAlign = 'center'; g.textBaseline = 'middle';
      ls.forEach((l, i) => { const y = h / 2 + (i - (ls.length - 1) / 2) * 56; fitText(g, l, w - 110, i ? 30 : 40, i ? '600' : '800'); g.fillStyle = 'rgba(255,240,200,0.5)'; g.fillText(l, w / 2 + 1, y + 2); g.fillStyle = '#3d2a0e'; g.fillText(l, w / 2, y); });
    }],
    price_tag: [256, 160, (g, w, h, r, t) => {
      const [a, b] = t.split('|'); g.fillStyle = '#ffcf12'; g.fillRect(0, 0, w, h); g.fillStyle = '#0e3a47'; g.fillRect(0, h - 34, w, 34);
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#0e3a47'; fitText(g, b || '', w - 30, 70, '900'); g.fillText(b || '', w / 2, 68);
      g.fillStyle = '#fff'; fitText(g, a.toUpperCase(), w - 20, 20, '700'); g.fillText(a.toUpperCase(), w / 2, h - 17);
    }],
    ration: [1024, 320, (g, w, h, r, t) => {
      g.fillStyle = '#e4dfd2'; g.fillRect(0, 0, w, h);
      for (let k = 0; k < 60; k++) { g.fillStyle = `rgba(80,70,50,${r() * 0.07})`; g.fillRect(r() * w, 0, 1 + r() * 4, h); }
      const ls = t.split(/\s*—\s*/);
      g.textBaseline = 'middle';
      ls.forEach((l, i) => { g.globalAlpha = 0.92; fitText(g, l, w - 80, i ? 60 : 130, '900'); g.fillStyle = i ? '#1b1b1b' : '#b3121b'; spaced(g, l, w / 2, i ? h * 0.8 : h * 0.4, i ? 6 : 3); });
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-atop';
      for (let k = 0; k < 30; k++) { g.fillStyle = `rgba(228,223,210,${r() * 0.5})`; g.fillRect(r() * w, r() * h, 2 + r() * 30, 1 + r() * 3); }
      g.globalCompositeOperation = 'source-over';
    }],
    lanyard_card: [256, 384, (g, w, h, r, t) => {
      const [nm, title] = t.split('\n');
      g.fillStyle = '#fbfbf8'; rrect(g, 0, 0, w, h, 18); g.fill(); g.fillStyle = '#ffcf12'; g.fillRect(0, 0, w, 96); yesMark(g, w / 2, 74, 54);
      g.fillStyle = '#c9ccd0'; g.fillRect(68, 110, 120, 140); g.fillStyle = '#8d9298'; g.beginPath(); g.arc(128, 160, 30, 0, 6.283); g.fill(); g.beginPath(); g.ellipse(128, 250, 52, 44, 0, Math.PI, 0); g.fill();
      g.fillStyle = '#0e3a47'; g.textAlign = 'center'; g.textBaseline = 'middle'; fitText(g, (nm || '').toUpperCase(), w - 30, 38, '900'); g.fillText((nm || '').toUpperCase(), w / 2, 290);
      g.fillStyle = '#555'; fitText(g, (title || '').toUpperCase(), w - 30, 18, '600'); g.fillText((title || '').toUpperCase(), w / 2, 326);
      g.fillStyle = '#222'; g.fillRect(110, 8, 36, 8);
    }],
    door: [256, 96, (g, w, h, r, t) => { g.fillStyle = '#2c3034'; rrect(g, 0, 0, w, h, 10); g.fill(); g.fillStyle = '#f2f2f2'; g.textAlign = 'center'; g.textBaseline = 'middle'; fitText(g, t.toUpperCase(), w - 30, 40, '700'); g.fillText(t.toUpperCase(), w / 2, h / 2 + 2); }],
    fuel_prices: [256, 512, (g, w, h, r, t) => {
      g.fillStyle = '#16181b'; g.fillRect(0, 0, w, h); g.fillStyle = '#e01b24'; g.fillRect(0, 0, w, 110);
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = font(70, '900'); g.fillText('FUEL', w / 2, 58);
      (t || 'UNLEADED|189.9\nPREMIUM 95|203.9\nDIESEL|199.9\nE10|185.9').split('\n').forEach((l, i) => {
        const [n, p] = l.split('|'), y = 150 + i * 92; g.fillStyle = '#fff'; g.font = font(20, '700'); g.textAlign = 'left'; g.fillText(n, 16, y - 26);
        g.fillStyle = '#0a0a0a'; g.fillRect(12, y - 8, w - 24, 58); g.fillStyle = '#ff3b1f'; g.shadowColor = '#ff3b1f'; g.shadowBlur = 12; g.font = font(50, '700', 'monospace'); g.textAlign = 'right'; g.fillText(p, w - 20, y + 22); g.shadowBlur = 0;
      });
    }],
    logo: [512, 256, (g, w, h, r, t, o) => { yesMark(g, w / 2, h * 0.66, 170, o.color || '#0e3a47'); }],
    phone_box: [256, 256, (g, w, h) => {
      g.fillStyle = '#f7f7f5'; g.fillRect(0, 0, w, h); phoneArt(g, 88, 40, 80, 160); g.fillStyle = '#0e3a47'; g.font = font(16, '800'); g.textAlign = 'center'; g.fillText('FLAGSHIP', w / 2, 226); yesMark(g, 34, 34, 26);
    }],
    plate: [256, 96, (g, w, h, r, t) => {
      g.fillStyle = '#f5f5f0'; rrect(g, 0, 0, w, h, 8); g.fill(); g.strokeStyle = '#6a1a2a'; g.lineWidth = 4; rrect(g, 4, 4, w - 8, h - 8, 6); g.stroke();
      g.fillStyle = '#6a1a2a'; g.textAlign = 'center'; g.textBaseline = 'middle'; fitText(g, t || '425 KDL', w - 30, 52, '800'); g.fillText(t || '425 KDL', w / 2, 50); g.font = font(12, '700'); g.fillText('QUEENSLAND - SUNSHINE STATE', w / 2, 84);
    }],
    police: [1024, 128, (g, w, h) => {
      for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) { g.fillStyle = (i + j) & 1 ? '#f4f4f4' : '#1d3f9a'; g.fillRect(i * 64, j * 64, 64, 64); }
      g.fillStyle = '#1d3f9a'; g.fillRect(360, 20, 300, 88); g.fillStyle = '#fff'; g.font = font(72, '900'); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('POLICE', 510, 66);
    }],
    hand: [1024, 384, (g, w, h, r, t) => {
      g.fillStyle = '#c9a877'; g.fillRect(0, 0, w, h); for (let k = 0; k < 50; k++) { g.fillStyle = `rgba(110,70,30,${r() * 0.12})`; g.fillRect(0, r() * h, w, 1 + r() * 5); }
      const ls = t.split(/\s*—\s*/), sz = Math.min(140, (h - 60) / ls.length / 1.1);
      ls.forEach((l, i) => handwrite(g, l, w / 2, h / 2 + (i - (ls.length - 1) / 2) * sz * 1.1 + sz * 0.35, sz, i ? '#8a1414' : '#1a1410', r, 'center', w - 80));
    }],
  };
  function sign(kind, t = '', o = {}) {
    const S = SIGNS[kind]; if (!S) { console.error('Tex.sign: unknown kind ' + kind); return text(t); }
    return cached(`sign:${kind}:${t}:${JSON.stringify(o)}`, S[0], S[1], (g, w, h, r) => { S[2](g, w, h, r, t, o); if (o.faded) age(g, w, h, r, o.faded, false); });
  }

  // ---- posters ---------------------------------------------------------------------
  function phoneArt(g, x, y, w, h, glow = '#3aa7ff') {
    g.save(); g.fillStyle = '#15171b'; rrect(g, x, y, w, h, w * 0.14); g.fill();
    const gr = g.createLinearGradient(x, y, x + w, y + h); gr.addColorStop(0, '#0b2a6b'); gr.addColorStop(0.5, glow); gr.addColorStop(1, '#7a2bd6');
    g.fillStyle = gr; rrect(g, x + w * 0.06, y + w * 0.06, w * 0.88, h - w * 0.12, w * 0.1); g.fill();
    infinity(g, x + w / 2, y + h * 0.45, w * 0.26, 'rgba(255,255,255,0.85)', w * 0.05);
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.moveTo(x + w * 0.1, y + w * 0.1); g.lineTo(x + w * 0.6, y + w * 0.1); g.lineTo(x + w * 0.1, y + h * 0.45); g.fill(); g.restore();
  }
  const POSTERS = {
    comms_look_up: g => {
      g.fillStyle = '#e9e1cc'; g.fillRect(0, 0, 512, 724); g.fillStyle = '#b5121b'; g.fillRect(0, 0, 512, 250);
      g.fillStyle = '#e9e1cc'; for (let i = 0; i < 14; i++) { g.beginPath(); g.moveTo(256, 250); const a = Math.PI + i / 13 * Math.PI; g.lineTo(256 + Math.cos(a - 0.05) * 400, 250 + Math.sin(a - 0.05) * 400); g.lineTo(256 + Math.cos(a + 0.05) * 400, 250 + Math.sin(a + 0.05) * 400); g.fill(); }
      g.fillStyle = '#1a1a1a'; g.beginPath(); g.ellipse(256, 370, 70, 84, -0.35, 0, 6.283); g.fill(); g.fillRect(170, 430, 172, 150); g.beginPath(); g.moveTo(120, 580); g.lineTo(392, 580); g.lineTo(430, 724); g.lineTo(82, 724); g.fill();
      g.fillStyle = '#e9e1cc'; g.fillRect(0, 560, 512, 164);
      g.fillStyle = '#1a1a1a'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = font(92, '900'); g.fillText('LOOK UP.', 256, 612); g.fillStyle = '#b5121b'; g.font = font(62, '900'); g.fillText('STAY ALIVE.', 256, 676);
      commsMark(g, 452, 60, 42, '#e9e1cc', '#1a1a1a');
    },
    comms_report: g => {
      g.fillStyle = '#e9e1cc'; g.fillRect(0, 0, 512, 724); g.fillStyle = '#1a1a1a'; g.textAlign = 'center'; g.textBaseline = 'middle';
      fitText(g, 'SEE A SCREEN?', 470, 64, '900'); g.fillText('SEE A SCREEN?', 256, 90);
      g.fillStyle = '#b5121b'; g.beginPath(); g.arc(256, 330, 160, 0, 6.283); g.fill(); g.fillStyle = '#e9e1cc'; g.beginPath(); g.arc(256, 330, 128, 0, 6.283); g.fill();
      phoneArt(g, 206, 230, 100, 200, '#3a7fd0'); g.strokeStyle = '#b5121b'; g.lineWidth = 30; g.beginPath(); g.moveTo(166, 240); g.lineTo(346, 420); g.stroke();
      g.fillStyle = '#b5121b'; fitText(g, 'REPORT A SCREEN.', 470, 58, '900'); g.fillText('REPORT A SCREEN.', 256, 560);
      g.fillStyle = '#1a1a1a'; fitText(g, 'TELL YOUR NEAREST COMMS POST. REWARDS PAID IN BARS.', 470, 20, '700'); g.fillText('TELL YOUR NEAREST COMMS POST. REWARDS PAID IN BARS.', 256, 620);
      commsMark(g, 256, 675, 34, '#e9e1cc', '#1a1a1a');
    },
    comms_execution: (g, r) => {
      g.fillStyle = '#efe9da'; g.fillRect(0, 0, 512, 724); g.fillStyle = '#111'; g.fillRect(24, 24, 464, 110);
      g.fillStyle = '#efe9da'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = font(84, '900'); g.fillText('NOTICE', 256, 82);
      g.fillStyle = '#111'; g.font = font(30, '800');
      ['POSSESSION OF A', 'SMARTPHONE OR ANY', 'SCREEN DEVICE IS', 'PUNISHABLE BY DEATH.'].forEach((l, i) => g.fillText(l, 256, 200 + i * 42));
      g.font = font(18, '600'); ['Devices must be surrendered at any COMMS post.', 'Concealment is treated as possession.', 'Those who report a screen will be rewarded.'].forEach((l, i) => g.fillText(l, 256, 400 + i * 28));
      g.font = font(22, '800'); g.fillText('EXECUTED THIS WEEK:', 200, 530);
      g.strokeStyle = '#111'; g.lineWidth = 4; for (let k = 0; k < 7; k++) { const x = 340 + (k % 5) * 16 + (k >= 5 ? 90 : 0); if (k === 4) { g.beginPath(); g.moveTo(334, 548); g.lineTo(410, 512); g.stroke(); } else { g.beginPath(); g.moveTo(x + (r() - 0.5) * 3, 510); g.lineTo(x, 550); g.stroke(); } }
      g.save(); g.translate(360, 640); g.rotate(-0.15); g.strokeStyle = 'rgba(180,20,25,0.85)'; g.lineWidth = 6; g.strokeRect(-110, -36, 220, 72); g.fillStyle = 'rgba(180,20,25,0.85)'; g.font = font(30, '900'); g.fillText('BY ORDER', 0, -8); g.font = font(20, '800'); g.fillText('OF COMMS', 0, 20); g.restore();
      commsMark(g, 90, 640, 50, '#efe9da', '#111');
    },
    comms_curfew: g => {
      g.fillStyle = '#23301f'; g.fillRect(0, 0, 512, 724); g.fillStyle = '#e8e4d4'; g.textAlign = 'center'; g.textBaseline = 'middle';
      commsMark(g, 256, 170, 110, '#e8e4d4', '#23301f');
      g.fillStyle = '#e8e4d4'; g.font = font(90, '900'); g.fillText('CURFEW', 256, 380); g.fillStyle = '#e0b020'; g.font = font(120, '900'); g.fillText('1800', 256, 490);
      g.fillStyle = '#e8e4d4'; g.font = font(30, '800'); g.fillText('LOOK UP. STAY ALIVE.', 256, 620); g.font = font(18, '600'); g.fillText('PATROLS WILL FIRE ON ANY LIT SCREEN', 256, 660);
    },
    band: (g, r) => {
      const gr = g.createLinearGradient(0, 0, 0, 724); gr.addColorStop(0, '#1b1036'); gr.addColorStop(0.55, '#e0467c'); gr.addColorStop(1, '#f7a541'); g.fillStyle = gr; g.fillRect(0, 0, 512, 724);
      g.fillStyle = '#fbd26a'; g.beginPath(); g.arc(256, 430, 120, Math.PI, 0); g.fill();
      g.fillStyle = '#1b1036'; for (let y = 330; y < 440; y += 16) g.fillRect(120, y, 272, 5 + (y - 330) / 25);
      g.fillStyle = '#12091f'; g.beginPath(); g.moveTo(0, 470); g.lineTo(512, 470); g.lineTo(512, 724); g.lineTo(0, 724); g.fill();
      g.strokeStyle = '#fbd26a'; g.lineWidth = 4; for (let i = 0; i < 8; i++) { g.beginPath(); g.moveTo(256 + (i - 3.5) * 8, 474); g.lineTo(256 + (i - 3.5) * 130, 724); g.stroke(); }
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = font(96, '900', FONT, true); g.fillText('NIGHT', 256, 120); g.fillText('DRIVES', 256, 210);
      g.fillStyle = '#fbd26a'; g.font = font(28, '700'); spaced(g, 'LIVE · ALL AGES · FRIDAY', 256, 560, 4);
      g.fillStyle = '#fff'; g.font = font(20, '600'); g.fillText('THE SUMMER NOISE TOUR', 256, 610);
      for (let k = 0; k < 600; k++) { g.fillStyle = `rgba(255,255,255,${r() * 0.08})`; g.fillRect(r() * 512, r() * 724, 2, 2); }
    },
    promo_launch: g => {
      g.fillStyle = '#ffcf12'; g.fillRect(0, 0, 512, 724);
      const gr = g.createRadialGradient(256, 360, 20, 256, 360, 300); gr.addColorStop(0, 'rgba(255,255,255,0.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 512, 724);
      phoneArt(g, 166, 180, 180, 360);
      g.fillStyle = '#0e3a47'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = font(62, '900'); g.fillText('MIDNIGHT', 256, 70); g.fillText('LAUNCH', 256, 128);
      g.font = font(48, '900'); g.fillText('BE FIRST.', 256, 600); g.font = font(18, '600'); g.fillText('DOORS OPEN 11PM · LIMITED STOCK', 256, 645); yesMark(g, 256, 700, 44);
    },
    promo_upgrade: g => {
      g.fillStyle = '#0e3a47'; g.fillRect(0, 0, 512, 724); g.fillStyle = '#ffcf12'; g.beginPath(); g.arc(256, 330, 190, 0, 6.283); g.fill();
      phoneArt(g, 190, 190, 132, 264); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = font(70, '900'); g.fillText('UPGRADE', 256, 590); g.fillStyle = '#ffcf12'; g.font = font(50, '900'); g.fillText('YOUR LIFE.', 256, 648);
      g.fillStyle = '#fff'; g.font = font(18, '600'); g.fillText('$0 UPFRONT ON SELECTED PLANS', 256, 690); yesMark(g, 256, 90, 60, '#ffcf12');
    },
    promo_rest: g => {
      g.fillStyle = '#ffcf12'; g.fillRect(0, 0, 512, 724); g.fillStyle = '#0e3a47'; g.fillRect(0, 440, 512, 284);
      for (let i = 0; i < 5; i++) { g.fillStyle = `hsl(${200 + i * 25},70%,${40 + i * 5}%)`; g.beginPath(); g.arc(100 + i * 78, 300 - (i % 2) * 40, 60, 0, 6.283); g.fill(); }
      g.fillStyle = '#0e3a47'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = font(58, '900'); g.fillText('SAY YES', 256, 100); g.font = font(44, '900'); g.fillText('TO THE REST.', 256, 160);
      g.fillStyle = '#fff'; g.font = font(28, '700'); g.fillText('EVERYONE ELSE ALREADY HAS.', 256, 520); yesMark(g, 256, 640, 80, '#ffcf12');
    },
    say_yes: (g, r) => {
      g.fillStyle = '#ffcf12'; g.fillRect(0, 0, 512, 724); g.fillStyle = '#0e3a47'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = font(120, '900'); g.fillText('SAY', 256, 190); g.font = font(190, '900'); g.fillText('YES.', 256, 390);
      fitText(g, 'THE FEED THAT FINALLY UNDERSTANDS YOU', 460, 24, '700'); g.fillText('THE FEED THAT FINALLY UNDERSTANDS YOU', 256, 560); yesMark(g, 256, 660, 70);
      g.strokeStyle = 'rgba(20,20,20,0.92)'; g.lineCap = 'round'; g.lineWidth = 34; g.shadowColor = '#000'; g.shadowBlur = 8;
      g.beginPath(); g.moveTo(40, 300 + (r() - 0.5) * 20); g.lineTo(480, 470); g.stroke(); g.beginPath(); g.moveTo(40, 480); g.lineTo(470, 290); g.stroke();
      g.shadowBlur = 0; g.fillStyle = 'rgba(20,20,20,0.9)'; for (let k = 0; k < 6; k++) { const x = 60 + r() * 400; g.fillRect(x, 330 + r() * 150, 7, 40 + r() * 90); }
    },
    missing_person: (g, r) => {
      g.fillStyle = '#f4f1e8'; g.fillRect(0, 0, 512, 724); g.fillStyle = '#111'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = font(96, '900'); g.fillText('MISSING', 256, 80);
      g.fillStyle = '#8b8f94'; g.fillRect(126, 140, 260, 270); g.fillStyle = '#6a6e73'; g.beginPath(); g.arc(256, 250, 62, 0, 6.283); g.fill(); g.beginPath(); g.ellipse(256, 410, 110, 90, 0, Math.PI, 0); g.fill();
      g.fillStyle = '#111'; g.font = font(40, '800'); g.fillText('OUR DAD', 256, 452);
      g.font = font(20, '600'); ['Tall. Grey work jacket. Glasses.', 'Last seen launch night, walking to the station.', 'He answers to "Dad". Please look up.'].forEach((l, i) => g.fillText(l, 256, 494 + i * 30));
      const torn = [];
      for (let k = 0; k < 8; k++) { const x = 12 + k * 62; if (r() < 0.4) { torn.push(x); continue; } g.save(); g.translate(x + 29, 660); g.rotate(-Math.PI / 2); g.font = font(13, '600'); g.fillText('CALL THE HALL', 0, 0); g.restore(); g.strokeStyle = '#999'; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(x + 60, 600); g.lineTo(x + 60, 724); g.stroke(); g.setLineDash([]); }
      g.globalCompositeOperation = 'destination-out'; for (const x of torn) g.fillRect(x, 604, 60, 120); g.globalCompositeOperation = 'source-over';
    },
    landlines_dialtone: g => {
      g.fillStyle = '#e7e0cf'; g.fillRect(0, 0, 512, 724); g.strokeStyle = '#1d2b3a'; g.lineWidth = 10; g.lineCap = 'round';
      cordPath(g, 110, 150, 400, 420, 9, 36); g.stroke();
      g.fillStyle = '#1d2b3a'; g.beginPath(); g.ellipse(400, 440, 44, 26, 0.8, 0, 6.283); g.fill();
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = font(30, '800', FONT, true);
      ["WHEN YOU'RE LOST", 'IN THE STATIC,', 'LISTEN FOR THE', 'DIAL TONE.'].forEach((l, i) => g.fillText(l, 256, 540 + i * 40));
    },
    school_notice: g => {
      g.fillStyle = '#fbfbf6'; g.fillRect(0, 0, 512, 724); g.fillStyle = '#1e4d8c'; g.fillRect(0, 0, 512, 120);
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = font(40, '800'); g.fillText('SCHOOL NOTICE', 256, 62);
      g.fillStyle = '#1e4d8c'; g.font = font(46, '900'); g.fillText('ATHLETICS', 256, 220); g.fillText('CARNIVAL', 256, 272);
      g.fillStyle = '#222'; g.font = font(26, '600'); ['FRIDAY — ALL YEARS', 'Bring a hat, water bottle', 'and your house colours.', 'NO PHONES ON THE OVAL.'].forEach((l, i) => g.fillText(l, 256, 370 + i * 44));
      g.fillStyle = '#e8b400'; g.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283 - 1.57, rr = i & 1 ? 26 : 60; g.lineTo(256 + Math.cos(a) * rr, 630 + Math.sin(a) * rr); } g.fill();
    },
    fitness: g => {
      g.fillStyle = '#111'; g.fillRect(0, 0, 512, 724); g.fillStyle = '#e8352e'; g.fillRect(0, 520, 512, 204);
      g.fillStyle = '#333'; g.beginPath(); g.arc(256, 190, 50, 0, 6.283); g.fill(); g.fillRect(206, 240, 100, 180); g.fillRect(80, 150, 352, 20); g.fillRect(60, 120, 24, 80); g.fillRect(428, 120, 24, 80); g.fillRect(140, 170, 30, 90); g.fillRect(342, 170, 30, 90);
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = font(86, '900', FONT, true); g.fillText('NO', 256, 470); g.fillStyle = '#111'; g.fillText('EXCUSES.', 256, 580);
      g.fillStyle = '#fff'; g.font = font(20, '700'); g.fillText('24/7 · FIRST MONTH FREE', 256, 670);
    },
    party_toga: g => {
      g.fillStyle = '#5b2a86'; g.fillRect(0, 0, 512, 724); g.fillStyle = '#f5d142';
      for (let i = 0; i < 9; i++) { g.save(); g.translate(256, 250); g.rotate(i / 9 * 6.283); g.beginPath(); g.ellipse(0, -110, 26, 70, 0, 0, 6.283); g.fill(); g.restore(); }
      g.fillStyle = '#fff'; g.beginPath(); g.arc(256, 250, 70, 0, 6.283); g.fill();
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = font(96, '900'); g.fillText('TOGA', 256, 450); g.fillStyle = '#f5d142'; g.font = font(60, '900'); g.fillText('PARTY', 256, 520);
      g.fillStyle = '#fff'; g.font = font(24, '700'); g.fillText('FRIDAY · STUDENT BAR · $5', 256, 600); g.font = font(18, '600'); g.fillText('BEDSHEETS MANDATORY', 256, 640);
    },
    values_teamwork: g => {
      g.fillStyle = '#f7f7f4'; g.fillRect(0, 0, 512, 724); g.fillStyle = '#ffcf12'; g.fillRect(0, 0, 512, 380);
      ['#e3b18f', '#c68a62', '#8d5a3b', '#f0c8a8', '#b07850'].forEach((s, i) => { g.fillStyle = s; g.save(); g.translate(256, 250); g.rotate(i / 5 * 6.283); g.beginPath(); g.ellipse(0, -80, 34, 90, 0, 0, 6.283); g.fill(); g.restore(); });
      g.fillStyle = '#0e3a47'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = font(70, '900'); g.fillText('TEAMWORK', 256, 460);
      g.font = font(26, '600', FONT, true); g.fillText('Together, we always say yes.', 256, 530); yesMark(g, 256, 650, 60);
    },
    first_aid: g => {
      g.fillStyle = '#f5f5f0'; g.fillRect(0, 0, 512, 724); g.fillStyle = '#12814a'; g.fillRect(0, 0, 512, 140);
      g.fillStyle = '#fff'; g.fillRect(226, 20, 60, 100); g.fillRect(206, 40, 100, 60);
      g.fillStyle = '#12814a'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = font(52, '900'); g.fillText('FIRST AID', 256, 200);
      g.fillStyle = '#222'; g.font = font(24, '700'); g.textAlign = 'left';
      ['D  DANGER', 'R  RESPONSE', 'S  SEND FOR HELP', 'A  AIRWAY', 'B  BREATHING', 'C  CPR', 'D  DEFIBRILLATION'].forEach((l, i) => g.fillText(l, 80, 280 + i * 58));
    },
  };
  function poster(kind, o = {}) {
    const P = POSTERS[kind]; if (!P) { console.error('Tex.poster: unknown kind ' + kind); return text(kind); }
    const worn = o.worn ?? 0.2;
    return cached(`poster:${kind}:${worn}`, 512, 724, (g, w, h, r) => { P(g, r); age(g, w, h, r, worn); });
  }

  // ---- graffiti -----------------------------------------------------------------
  function graffiti(t, o = {}) {
    const style = o.style || 'spray', sq = style === 'tally' || style === 'cord';
    const w = o.w || (sq ? 512 : 1024), h = o.h || (sq ? 512 : 384);
    const col = o.color || (style === 'stencil' ? '#161616' : style === 'cord' ? '#e8e2cf' : style === 'tally' ? '#e9e4d8' : '#c8161d');
    return cached(`graf:${t}:${JSON.stringify(o)}`, w, h, (g, W, H, r) => {
      g.lineCap = g.lineJoin = 'round';
      if (style === 'tally') {
        const n = +t || 1; g.strokeStyle = col; g.lineWidth = 7;
        for (let k = 0; k < n; k++) {
          const grp = k / 5 | 0, j = k % 5, gx = 40 + (grp % 4) * 115, gy = 50 + (grp / 4 | 0) * 120;
          g.beginPath(); if (j < 4) { g.moveTo(gx + j * 20 + (r() - 0.5) * 6, gy); g.lineTo(gx + j * 20 + (r() - 0.5) * 6, gy + 90); } else { g.moveTo(gx - 10, gy + 70); g.lineTo(gx + 80, gy + 15); } g.stroke();
        }
        return;
      }
      if (style === 'cord') {
        g.strokeStyle = col; g.lineWidth = 16; g.shadowColor = col; g.shadowBlur = 10;
        cordPath(g, 70, 360, 380, 150, 7, 40); g.stroke();
        g.beginPath(); g.moveTo(380, 150); g.lineTo(450, 100); g.stroke(); g.beginPath(); g.moveTo(425, 85); g.lineTo(455, 98); g.lineTo(440, 128); g.stroke();
        return;
      }
      const ls = String(t).split(/\s*—\s*|\n/), size = Math.min(H * 0.8 / ls.length, 220);
      g.font = font(size, '900'); const widest = Math.max(...ls.map(l => g.measureText(l).width)), sz = widest > W * 0.9 ? size * W * 0.9 / widest : size;
      ls.forEach((l, li) => {
        const y = H / 2 + (li - (ls.length - 1) / 2) * sz * 1.05;
        if (style === 'stencil') { stencilText(g, l, W / 2, y, sz, col); return; }
        g.font = font(sz, '900', FONT, true); g.fillStyle = col; g.textBaseline = 'middle';
        const cw = [...l].map(c => g.measureText(c).width * 0.95); let x = W / 2 - cw.reduce((a, b) => a + b, 0) / 2;
        [...l].forEach((c, i) => {
          g.save(); g.translate(x, y + (r() - 0.5) * sz * 0.1); g.rotate((r() - 0.5) * 0.18);
          g.shadowColor = col; g.shadowBlur = sz * 0.1; g.globalAlpha = 0.9; g.fillText(c, 0, 0); g.shadowBlur = 0; g.globalAlpha = 1; g.fillText(c, 0, 0);
          if (style === 'drip' && c !== ' ') for (let d = 0; d < 2; d++) if (r() < 0.6) { const dx = r() * cw[i], len = sz * (0.2 + r() * 0.9); g.fillRect(dx, sz * 0.25, 3 + r() * 3, len); g.beginPath(); g.arc(dx + 3, sz * 0.25 + len, 4, 0, 6.283); g.fill(); }
          g.restore(); x += cw[i];
        });
        g.fillStyle = col; for (let k = 0; k < 500; k++) { g.globalAlpha = r() * 0.5; g.fillRect(W / 2 + (r() - 0.5) * W * 0.9, y + (r() - 0.5) * sz * 1.2, 1.5, 1.5); }
        g.globalAlpha = 1;
      });
    });
  }

  // ---- decals ---------------------------------------------------------------------
  const DECALS = {
    blood: (g, r) => {
      g.fillStyle = 'rgba(92,6,8,0.92)';
      for (let k = 0; k < 26; k++) { const a = r() * 6.283, d = r() * 70; g.beginPath(); g.arc(256 + Math.cos(a) * d, 256 + Math.sin(a) * d, 20 + r() * 50, 0, 6.283); g.fill(); }
      for (let k = 0; k < 70; k++) { const a = r() * 6.283, d = 120 + r() * 120; g.beginPath(); g.arc(256 + Math.cos(a) * d, 256 + Math.sin(a) * d, 2 + r() * 8, 0, 6.283); g.fill(); }
      g.fillStyle = 'rgba(60,2,4,0.5)'; for (let k = 0; k < 10; k++) { g.beginPath(); g.arc(256 + (r() - 0.5) * 120, 256 + (r() - 0.5) * 120, 10 + r() * 30, 0, 6.283); g.fill(); }
    },
    stain: (g, r) => { for (let k = 0; k < 18; k++) { const x = 256 + (r() - 0.5) * 220, y = 256 + (r() - 0.5) * 220, rad = 40 + r() * 90, gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(70,52,30,0.18)'); gr.addColorStop(0.85, 'rgba(60,42,22,0.3)'); gr.addColorStop(1, 'rgba(60,42,22,0)'); g.fillStyle = gr; g.fillRect(0, 0, 512, 512); } },
    crack: (g, r) => {
      g.strokeStyle = 'rgba(12,12,12,0.85)'; g.lineCap = 'round';
      for (let k = 0; k < 9; k++) { let x = 256, y = 256, a = k / 9 * 6.283 + r() * 0.5; g.beginPath(); g.moveTo(x, y); for (let s = 0; s < 14; s++) { a += (r() - 0.5) * 0.7; x += Math.cos(a) * 17; y += Math.sin(a) * 17; g.lineTo(x, y); } g.lineWidth = 2; g.stroke(); }
      g.strokeStyle = 'rgba(12,12,12,0.6)'; g.lineWidth = 1.2; for (let ring = 1; ring < 4; ring++) { g.beginPath(); for (let i = 0; i <= 18; i++) { const a = i / 18 * 6.283, d = ring * 50 + (r() - 0.5) * 18; g.lineTo(256 + Math.cos(a) * d, 256 + Math.sin(a) * d); } g.stroke(); }
    },
    water_stain: (g, r) => {
      for (let ring = 6; ring > 0; ring--) { g.strokeStyle = `rgba(120,90,45,${0.25 - ring * 0.02})`; g.lineWidth = 3 + r() * 4; g.beginPath(); for (let i = 0; i <= 30; i++) { const a = i / 30 * 6.283, d = ring * 36 + (r() - 0.5) * 20; g.lineTo(256 + Math.cos(a) * d, 200 + Math.sin(a) * d * 0.8); } g.stroke(); g.fillStyle = 'rgba(150,120,70,0.05)'; g.fill(); }
      g.fillStyle = 'rgba(120,90,45,0.22)'; for (let k = 0; k < 5; k++) g.fillRect(180 + r() * 150, 260, 4 + r() * 6, 100 + r() * 150);
    },
    soot: (g, r) => { for (let k = 0; k < 40; k++) { const t = r(), x = 256 + (r() - 0.5) * 200 * (0.4 + t), y = 480 - t * 440, rad = 40 + t * 90, gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, `rgba(8,7,6,${0.22 * (1 - t * 0.7)})`); gr.addColorStop(1, 'rgba(8,7,6,0)'); g.fillStyle = gr; g.fillRect(0, 0, 512, 512); } },
    scorch: (g, r) => { const gr = g.createRadialGradient(256, 256, 20, 256, 256, 240); gr.addColorStop(0, 'rgba(5,4,3,0.95)'); gr.addColorStop(0.5, 'rgba(15,10,6,0.7)'); gr.addColorStop(1, 'rgba(20,14,8,0)'); g.fillStyle = gr; g.fillRect(0, 0, 512, 512); for (let k = 0; k < 300; k++) { g.fillStyle = `rgba(0,0,0,${r() * 0.4})`; g.beginPath(); g.arc(256 + (r() - 0.5) * 400, 256 + (r() - 0.5) * 400, r() * 6, 0, 6.283); g.fill(); } },
    moss_patch: (g, r) => { for (let k = 0; k < 400; k++) { const a = r() * 6.283, d = Math.sqrt(r()) * 200; g.fillStyle = `rgba(${50 + r() * 50 | 0},${80 + r() * 60 | 0},${20 + r() * 30 | 0},${0.3 + r() * 0.5})`; g.beginPath(); g.arc(256 + Math.cos(a) * d, 256 + Math.sin(a) * d * 0.8, 4 + r() * 16 * (1 - d / 220), 0, 6.283); g.fill(); } },
    coffee_ring: g => { g.strokeStyle = 'rgba(90,55,25,0.55)'; g.lineWidth = 7; g.beginPath(); g.arc(256, 256, 150, 0.3, 6.1); g.stroke(); g.strokeStyle = 'rgba(90,55,25,0.25)'; g.lineWidth = 3; g.beginPath(); g.arc(270, 262, 146, 0, 6.283); g.stroke(); g.fillStyle = 'rgba(110,70,35,0.06)'; g.beginPath(); g.arc(256, 256, 146, 0, 6.283); g.fill(); },
    footprints: (g, r) => {
      g.fillStyle = 'rgba(55,40,28,0.6)';
      for (let k = 0; k < 6; k++) { const x = 256 + (k & 1 ? 40 : -40), y = 470 - k * 85; g.save(); g.translate(x, y); g.rotate((r() - 0.5) * 0.2); g.beginPath(); g.ellipse(0, -14, 20, 34, 0, 0, 6.283); g.fill(); g.beginPath(); g.ellipse(0, 34, 16, 18, 0, 0, 6.283); g.fill(); g.restore(); }
    },
    skid: (g, r) => { for (const x of [150, 362]) for (let k = 0; k < 8; k++) { g.fillStyle = `rgba(10,10,10,${0.12 + r() * 0.1})`; g.fillRect(x - 30 + k * 7 + (r() - 0.5) * 4, 0, 5, 512); } },
    oil: (g, r) => { for (let k = 0; k < 8; k++) { const x = 256 + (r() - 0.5) * 160, y = 256 + (r() - 0.5) * 160, rad = 50 + r() * 100, gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(8,8,10,0.5)'); gr.addColorStop(0.7, 'rgba(20,16,30,0.3)'); gr.addColorStop(1, 'rgba(20,16,30,0)'); g.fillStyle = gr; g.fillRect(0, 0, 512, 512); } },
    puddle: (g, r) => { const p = [r() * 6, r() * 6, r() * 6]; g.filter = 'blur(6px)'; g.fillStyle = 'rgba(10,12,14,0.6)'; g.beginPath(); for (let i = 0; i <= 64; i++) { const a = i / 64 * 6.283, d = 175 + Math.sin(a * 2 + p[0]) * 35 + Math.sin(a * 3 + p[1]) * 22 + Math.sin(a * 5 + p[2]) * 10; g.lineTo(256 + Math.cos(a) * d, 256 + Math.sin(a) * d * 0.75); } g.fill(); g.filter = 'none'; },
  };
  function decal(kind) {
    const D = DECALS[kind]; if (!D) { console.error('Tex.decal: unknown kind ' + kind); return text(kind); }
    return cached('decal:' + kind, 512, 512, (g, w, h, r) => D(g, r));
  }

  // ---- photos (painted prints) --------------------------------------------------------
  function person(g, x, y, s, o) {
    g.save(); g.translate(x, y); g.scale(s, s);
    g.fillStyle = o.polo || '#f2c418'; g.beginPath(); g.moveTo(-60, 0); g.quadraticCurveTo(-58, -70, 0, -76); g.quadraticCurveTo(58, -70, 60, 0); g.lineTo(60, 60); g.lineTo(-60, 60); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.15)'; g.beginPath(); g.moveTo(-10, -74); g.lineTo(0, -46); g.lineTo(10, -74); g.fill();
    g.fillStyle = o.skin || '#e0ad8a'; g.fillRect(-12, -92, 24, 22); g.beginPath(); g.ellipse(0, -118, 26, 32, 0, 0, 6.283); g.fill();
    g.fillStyle = 'rgba(120,60,40,0.18)'; g.beginPath(); g.ellipse(8, -112, 16, 24, 0, 0, 6.283); g.fill();
    g.fillStyle = o.hair || '#3a2a1e'; g.beginPath(); g.ellipse(0, -132, 28, 20, 0, Math.PI, 0); g.fill(); if (o.long) { g.fillRect(-28, -134, 12, 50); g.fillRect(16, -134, 12, 50); }
    if (o.cap) { g.fillStyle = o.cap; g.beginPath(); g.ellipse(0, -138, 29, 14, 0, Math.PI, 0); g.fill(); g.fillRect(-4, -140, 40, 6); }
    if (o.face) { g.fillStyle = 'rgba(40,25,20,0.6)'; g.fillRect(-12, -122, 7, 3); g.fillRect(5, -122, 7, 3); g.beginPath(); g.arc(0, -104, 7, 0, Math.PI); g.fill(); }
    g.restore();
  }
  function printFinish(g, w, h, r, warm = 0.12) {
    g.filter = 'blur(1.2px)'; g.drawImage(g.canvas, 0, 0); g.filter = 'none';
    g.fillStyle = `rgba(255,190,120,${warm})`; g.fillRect(0, 0, w, h);
    const vg = g.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.35)'); g.fillStyle = vg; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 300; k++) { g.fillStyle = `rgba(255,255,255,${r() * 0.06})`; g.fillRect(r() * w, r() * h, 2, 2); }
    g.strokeStyle = '#f6f3ea'; g.lineWidth = 36; g.strokeRect(0, 0, w, h);
  }
  const PHOTOS = {
    baby_in_polo: [384, 512, (g, w, h, r) => {
      g.fillStyle = '#ffcf12'; g.fillRect(0, 0, w, h); g.fillStyle = '#e8e2d2'; g.fillRect(0, 300, w, 212);
      g.fillStyle = '#0e3a47'; g.font = font(80, '900'); g.textAlign = 'center'; g.fillText('yes', 110, 130);
      person(g, 200, 520, 2.3, { polo: '#f2c418', face: true, hair: '#2e2118' });
      g.fillStyle = '#f7b8c8'; g.beginPath(); g.ellipse(190, 400, 78, 46, -0.3, 0, 6.283); g.fill(); g.fillStyle = '#f0c8a8'; g.beginPath(); g.arc(240, 380, 24, 0, 6.283); g.fill();
      g.fillStyle = '#e0ad8a'; g.beginPath(); g.ellipse(160, 440, 60, 18, 0.2, 0, 6.283); g.fill();
      printFinish(g, w, h, r, 0.14);
    }],
    fridge_faces: [512, 384, (g, w, h, r) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#6d8fb0'); gr.addColorStop(1, '#c9a27a'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      const face = (x, y, s, hair, tongue, long) => {
        g.save(); g.translate(x, y); g.scale(s, s); g.fillStyle = hair; g.beginPath(); g.ellipse(0, -30, 92, 80, 0, Math.PI, 0); g.fill(); if (long) { g.fillRect(-92, -30, 30, 150); g.fillRect(62, -30, 30, 150); }
        g.fillStyle = '#e8b594'; g.beginPath(); g.ellipse(0, 10, 78, 96, 0, 0, 6.283); g.fill();
        g.fillStyle = '#fff'; g.beginPath(); g.arc(-28, -8, 16, 0, 6.283); g.arc(28, -8, 16, 0, 6.283); g.fill();
        g.fillStyle = '#2a1d16'; g.beginPath(); g.arc(-22, -4, 7, 0, 6.283); g.arc(22, -12, 7, 0, 6.283); g.fill();
        g.fillStyle = '#6a2a2a'; g.beginPath(); g.ellipse(0, 50, 30, 22, 0, 0, Math.PI); g.fill(); if (tongue) { g.fillStyle = '#e46a7a'; g.beginPath(); g.ellipse(4, 70, 16, 20, 0, 0, 6.283); g.fill(); }
        g.fillStyle = 'rgba(220,100,90,0.25)'; g.beginPath(); g.arc(-48, 30, 16, 0, 6.283); g.arc(48, 30, 16, 0, 6.283); g.fill(); g.restore();
      };
      face(170, 200, 1.05, '#2e2118', false, false); face(350, 220, 0.85, '#6a4128', true, true);
      printFinish(g, w, h, r, 0.08);
    }],
    store_team: [512, 384, (g, w, h, r) => {
      g.fillStyle = '#d7dbe0'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffcf12'; g.fillRect(0, 30, w, 80); g.fillStyle = '#0e3a47'; g.font = font(64, '900'); g.textAlign = 'center'; g.fillText('yes', w / 2, 92);
      g.fillStyle = '#9aa3ad'; g.fillRect(0, 280, w, 104);
      [[90, 1], [170, 0.95], [250, 1.05], [330, 0.95], [410, 1]].forEach(([x, s], i) => person(g, x, 340, 0.95 * s, { polo: '#f2c418', hair: ['#2e2118', '#4a3020', '#1d1612', '#6a4128', '#3a2a1e'][i], cap: i === 3 ? '#222' : null, long: i === 2 }));
      g.fillStyle = '#d9b44a'; g.fillRect(238, 250, 24, 40); g.beginPath(); g.moveTo(230, 210); g.lineTo(270, 210); g.lineTo(262, 252); g.lineTo(238, 252); g.fill();
      printFinish(g, w, h, r, 0.1);
    }],
    launch_night: [512, 384, (g, w, h, r) => {
      g.fillStyle = '#0a0d18'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffcf12'; g.fillRect(140, 60, 240, 70); g.fillStyle = '#0e3a47'; g.font = font(54, '900'); g.textAlign = 'center'; g.fillText('yes', 260, 112);
      g.fillStyle = '#26303d'; g.fillRect(120, 130, 280, 200); g.fillStyle = 'rgba(255,240,200,0.5)'; g.fillRect(140, 150, 240, 150);
      for (let k = 0; k < 12; k++) { const x = 30 + k * 40, s = 0.5 + r() * 0.12; person(g, x, 390, s, { polo: '#1a1d24', skin: '#6a8ab8', hair: '#111' }); g.fillStyle = 'rgba(120,190,255,0.8)'; g.fillRect(x - 6, 390 - 70 * s * 1.3, 12, 8); }
      printFinish(g, w, h, r, 0.05);
    }],
    school_report: [384, 512, (g, w, h, r) => {
      g.fillStyle = '#fbfbf6'; g.fillRect(0, 0, w, h); g.fillStyle = '#1e4d8c'; g.fillRect(0, 0, w, 60); g.fillStyle = '#fff'; g.font = font(26, '800'); g.textAlign = 'center'; g.fillText('SEMESTER REPORT', w / 2, 40);
      g.fillStyle = '#333'; g.textAlign = 'left'; g.font = font(18, '600');
      [['ENGLISH', 'B'], ['MATHS', 'D'], ['SCIENCE', 'C'], ['ART', 'A'], ['HPE', 'B'], ['HISTORY', 'C']].forEach(([s, gr], i) => { g.fillStyle = '#333'; g.fillText(s, 40, 110 + i * 44); g.fillText(gr, 300, 110 + i * 44); g.fillStyle = '#ccc'; g.fillRect(40, 120 + i * 44, 300, 1); });
      g.save(); g.translate(250, 420); g.rotate(-0.2); handwrite(g, 'SEE ME', -90, 0, 58, '#c21d24', r); g.strokeStyle = '#c21d24'; g.lineWidth = 4; g.beginPath(); g.ellipse(-4, -18, 120, 50, 0, 0, 6.283); g.stroke(); g.restore();
    }],
  };
  function photo(kind) {
    const P = PHOTOS[kind]; if (!P) { console.error('Tex.photo: unknown kind ' + kind); return text(kind); }
    return cached('photo:' + kind, P[0], P[1], (g, w, h, r) => P[2](g, w, h, r));
  }

  // ---- screens --------------------------------------------------------------------------
  function infinity(g, cx, cy, s, col, lw) { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); for (let i = 0; i <= 60; i++) { const a = i / 60 * 6.283, d = 1 + Math.sin(a) ** 2; g.lineTo(cx + s * Math.cos(a) / d, cy + s * Math.sin(a) * Math.cos(a) / d); } g.stroke(); }
  function studio(g, w, h, r) {
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#0b2350'); gr.addColorStop(1, '#1c5aa6'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(${150 + r() * 100 | 0},${180 + r() * 60 | 0},255,${0.08 + r() * 0.2})`; g.beginPath(); g.arc(r() * w, h * 0.2 + r() * h * 0.4, 3 + r() * 10, 0, 6.283); g.fill(); }
    g.fillStyle = '#0a1a33'; g.fillRect(0, h * 0.72, w, h * 0.28);
  }
  function lowerThird(g, w, h, t) {
    g.fillStyle = '#c8102e'; g.fillRect(0, h * 0.74, w * 0.2, h * 0.1); g.fillStyle = '#fff'; g.font = font(h * 0.055, '900'); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('LIVE', w * 0.1, h * 0.79);
    g.fillStyle = '#f4f4f4'; g.fillRect(w * 0.2, h * 0.74, w * 0.8, h * 0.1); g.fillStyle = '#111'; g.textAlign = 'left'; fitText(g, t, w * 0.76, h * 0.05, '800'); g.fillText(t, w * 0.22, h * 0.79);
    g.fillStyle = '#0a1a33'; g.fillRect(0, h * 0.86, w, h * 0.08); g.fillStyle = '#ffcf12'; g.font = font(h * 0.04, '700'); g.fillText('BIGGEST UPDATE IN THE COUNTRY\'S HISTORY  ·  ROLLS OUT NATIONALLY AT MIDNIGHT  ·  ', w * 0.02, h * 0.9);
  }
  const SCREENS = {
    lock: [256, 512, (g, w, h, r, o) => {
      const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#231a4e'); gr.addColorStop(0.6, '#3a2f8a'); gr.addColorStop(1, '#c0508a'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = font(72, '200'); g.fillText(o.time || '11:44', w / 2, 110); g.font = font(16, '500'); g.fillText('FRIDAY', w / 2, 160);
      g.fillStyle = 'rgba(255,255,255,0.85)'; rrect(g, 14, 210, w - 28, 118, 16); g.fill();
      g.fillStyle = '#1f6fff'; rrect(g, 26, 222, 30, 30, 8); g.fill(); infinity(g, 41, 237, 11, '#fff', 3);
      g.fillStyle = '#111'; g.textAlign = 'left'; g.font = font(14, '800'); g.fillText('INFINITE', 64, 237);
      ['INFINITE is ready. Installs at 12:00.', 'A feed that finally', 'understands you.'].forEach((l, i) => { fitText(g, l, w - 50, 13, i ? '500' : '600'); g.fillText(l, 26, 270 + i * 18); });
    }],
    installing: [256, 512, (g, w, h, r, o) => {
      g.fillStyle = '#05070c'; g.fillRect(0, 0, w, h); infinity(g, w / 2, 190, 50, '#3aa7ff', 8);
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = font(18, '700'); g.fillText('INFINITE — Installing…', w / 2, 280);
      const p = o.pct ?? 42; g.fillStyle = '#1a2230'; rrect(g, 30, 310, w - 60, 10, 5); g.fill(); g.fillStyle = '#3aa7ff'; rrect(g, 30, 310, (w - 60) * p / 100, 10, 5); g.fill();
      g.fillStyle = '#9ab'; g.font = font(16, '600'); g.fillText(p + '%', w / 2, 345);
    }],
    news: [512, 288, (g, w, h, r) => {
      studio(g, w, h, r); person(g, 256, 300, 1.25, { polo: '#1d2230', skin: '#e0b090', hair: '#3a2418', long: true, face: true });
      g.fillStyle = '#132a4a'; g.fillRect(90, 205, 332, 30); g.fillStyle = '#9cc4ff'; g.fillRect(90, 205, 332, 3);
      g.fillStyle = '#fff'; g.font = font(16, '800'); g.textAlign = 'left'; g.fillText('NEWS 24', 16, 22); g.textAlign = 'right'; g.fillText('11:52', w - 16, 22);
      lowerThird(g, w, h, 'INFINITE UPDATE ROLLS OUT AT MIDNIGHT');
    }],
    news_scroll: [512, 288, (g, w, h, r) => {
      studio(g, w, h, r); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 0, w, h);
      g.save(); g.translate(256, 300); g.rotate(0.05); person(g, 0, 0, 1.25, { polo: '#1d2230', skin: '#8fb4e8', hair: '#2a1a12', long: true }); g.restore();
      const gl = g.createRadialGradient(262, 200, 4, 262, 200, 60); gl.addColorStop(0, 'rgba(120,200,255,0.9)'); gl.addColorStop(1, 'rgba(120,200,255,0)'); g.fillStyle = gl; g.fillRect(180, 130, 170, 140);
      g.fillStyle = '#132a4a'; g.fillRect(90, 205, 332, 30);
      g.fillStyle = '#fff'; g.font = font(16, '800'); g.textAlign = 'left'; g.fillText('NEWS 24', 16, 22);
      lowerThird(g, w, h, 'INFINITE UPDATE ROLLS OUT AT MIDNIGHT');
    }],
    demo: [256, 512, (g, w, h) => {
      g.fillStyle = '#ffcf12'; g.fillRect(0, 0, w, h); yesMark(g, w / 2, 130, 90);
      g.fillStyle = '#0e3a47'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = font(30, '900'); g.fillText('MIDNIGHT', w / 2, 250); g.fillText('LAUNCH', w / 2, 286);
      g.font = font(20, '700'); g.fillText('BE FIRST.', w / 2, 340); g.fillStyle = '#0e3a47'; rrect(g, 50, 400, w - 100, 50, 25); g.fill(); g.fillStyle = '#ffcf12'; g.font = font(18, '800'); g.fillText('TRY ME', w / 2, 426);
    }],
    monitor: [512, 320, (g, w, h) => {
      g.fillStyle = '#eef1f4'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffcf12'; g.fillRect(0, 0, w, 44); yesMark(g, 50, 32, 30); g.fillStyle = '#0e3a47'; g.font = font(18, '800'); g.textAlign = 'left'; g.fillText('POINT OF SALE', 96, 28);
      g.fillStyle = '#333'; g.font = font(16, '600'); [['Handset', '$0.00'], ['Plan 24m', '$65/m'], ['Case', '$49.00'], ['Screen guard', '$29.00']].forEach(([a, b], i) => { g.fillText(a, 24, 84 + i * 30); g.textAlign = 'right'; g.fillText(b, w - 24, 84 + i * 30); g.textAlign = 'left'; });
      g.fillStyle = '#1a9b4b'; rrect(g, 24, 220, w - 48, 56, 10); g.fill(); g.fillStyle = '#fff'; g.font = font(24, '800'); g.textAlign = 'center'; g.fillText('SALE COMPLETE', w / 2, 256);
      g.fillStyle = '#0e3a47'; g.font = font(14, '700'); g.fillText('STORE TODAY: 299 · TARGET 312', w / 2, 300);
    }],
    eftpos: [128, 128, (g, w, h) => { g.fillStyle = '#d8f0d0'; g.fillRect(0, 0, w, h); g.fillStyle = '#123'; g.font = font(18, '800'); g.textAlign = 'center'; g.fillText('APPROVED', 64, 58); g.font = font(14, '600'); g.fillText('$49.00', 64, 84); }],
    off: [64, 128, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#15181d'); gr.addColorStop(0.5, '#050608'); gr.addColorStop(1, '#0c0e11'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }],
  };
  function screen(kind, o = {}) {
    if (kind === 'feed') return get('screen_feed', { repeat: [1, 0.5] });
    const S = SCREENS[kind]; if (!S) { console.error('Tex.screen: unknown kind ' + kind); return text(kind); }
    return cached(`screen:${kind}:${JSON.stringify(o)}`, S[0], S[1], (g, w, h, r) => S[2](g, w, h, r, o));
  }
  // endless feed (tall, tileable vertically); animate() swipes it card by card
  function feedTex() {
    const W = 256, H = 1024, c = canvas(W, H), g = ctx(c), r = U.rng(77);
    g.fillStyle = '#04060b'; g.fillRect(0, 0, W, H);
    for (let k = 0; k < 4; k++) {
      const y0 = k * 256, hue = [205, 285, 190, 330][k];
      g.fillStyle = '#0c1220'; rrect(g, 8, y0 + 8, W - 16, 240, 14); g.fill();
      g.fillStyle = `hsl(${hue},80%,60%)`; g.beginPath(); g.arc(30, y0 + 30, 12, 0, 6.283); g.fill();
      g.fillStyle = '#7d8aa6'; g.fillRect(50, y0 + 22, 90, 7); g.fillStyle = '#4a5570'; g.fillRect(50, y0 + 34, 60, 5);
      const gr = g.createLinearGradient(0, y0 + 50, W, y0 + 200); gr.addColorStop(0, `hsl(${hue},90%,55%)`); gr.addColorStop(1, `hsl(${hue + 50},90%,35%)`);
      g.fillStyle = gr; g.fillRect(16, y0 + 50, W - 32, 150);
      for (let j = 0; j < 6; j++) { g.fillStyle = `hsla(${hue + r() * 80},100%,${60 + r() * 30}%,0.6)`; g.beginPath(); g.arc(20 + r() * (W - 40), y0 + 60 + r() * 130, 8 + r() * 30, 0, 6.283); g.fill(); }
      g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.arc(W / 2, y0 + 125, 22, 0, 6.283); g.fill(); g.fillStyle = `hsl(${hue},80%,40%)`; g.beginPath(); g.moveTo(W / 2 - 7, y0 + 113); g.lineTo(W / 2 + 11, y0 + 125); g.lineTo(W / 2 - 7, y0 + 137); g.fill();
      g.fillStyle = '#ff4f7a'; g.beginPath(); g.arc(24, y0 + 222, 6, 0, 6.283); g.arc(32, y0 + 222, 6, 0, 6.283); g.lineTo(28, y0 + 234); g.fill();
      g.fillStyle = '#7d8aa6'; g.fillRect(48, y0 + 218, 40, 7); g.fillRect(W - 70, y0 + 218, 50, 7);
    }
    const t = toTex(c); t.userData.feed = true; feeds.push(t); return t;
  }

  // ---- foliage cards ------------------------------------------------------------------------
  function foliage(kind) {
    return cached('foliage:' + kind, 256, 256, (g, w, h, r) => {
      const leaf = (x, y, a, l, wd, col) => { g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = col; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(wd, l * 0.4, 0, l); g.quadraticCurveTo(-wd, l * 0.4, 0, 0); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.15)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, l * 0.9); g.stroke(); g.restore(); };
      const shade = (base, k) => `rgb(${Math.min(255, base[0] * k * 1.9) | 0},${Math.min(255, base[1] * k * 1.8) | 0},${Math.min(255, base[2] * k * 1.9) | 0})`;
      if (kind === 'palm') {
        g.strokeStyle = '#5a6a2a'; g.lineWidth = 5; g.beginPath(); g.moveTo(128, 256); g.lineTo(128, 0); g.stroke();
        for (let i = 0; i < 26; i++) { const y = 250 - i * 9.5; for (const s of [-1, 1]) leaf(128, y, s * (1.9 - i * 0.02), 110 - i * 2.5, 7, shade([80, 118, 44], 0.75 + r() * 0.4)); }
      } else if (kind === 'pine') {
        for (let i = 0; i < 90; i++) { const x = 20 + r() * 216, y = 20 + r() * 216; g.strokeStyle = shade([40, 74, 44], 0.7 + r() * 0.5); g.lineWidth = 2; for (let k = 0; k < 6; k++) { const a = r() * 6.283; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 18, y + Math.sin(a) * 18); g.stroke(); } }
      } else if (kind === 'willow') {
        for (let i = 0; i < 16; i++) { const x = 10 + i * 15.5 + r() * 6; g.strokeStyle = '#6a7a3a'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (r() - 0.5) * 10, 256); g.stroke(); for (let y = 6; y < 250; y += 9) leaf(x + (r() - 0.5) * 6, y, (r() - 0.5) * 0.8, 22, 4, shade([120, 150, 60], 0.7 + r() * 0.45)); }
      } else if (kind === 'grass') {
        for (let i = 0; i < 70; i++) { const x = r() * 256; g.strokeStyle = shade([90, 120, 50], 0.6 + r() * 0.6); g.lineWidth = 2 + r() * 2; g.beginPath(); g.moveTo(x, 256); g.quadraticCurveTo(x + (r() - 0.5) * 40, 128, x + (r() - 0.5) * 80, 40 + r() * 120); g.stroke(); }
      } else {
        const P = { gum: [[96, 112, 70], 30, 5, 170], broad: [[52, 92, 40], 26, 13, 120], ivy: [[48, 86, 36], 18, 11, 150] }[kind] || [[70, 110, 50], 24, 8, 140];
        for (let i = 0; i < P[3]; i++) { const a = r() * 6.283, d = Math.sqrt(r()) * 108; leaf(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, a + 1.57 + (r() - 0.5) * 0.8 + (kind === 'gum' ? 3.14 : 0), P[1] * (0.7 + r() * 0.5), P[2], shade(P[0], 0.6 + r() * 0.6)); }
      }
    }, true, false);
  }

  // ---- animation -----------------------------------------------------------------------------
  let lastT = -1;
  function animate(dt, t) {
    if (t == null) { clock += dt; t = clock; }
    if (t === lastT) return; lastT = t;
    time.value = t;
    const step = Math.floor(t / 2.4), ph = Math.min(1, (t % 2.4) / 0.45), off = -(step + U.ease.out(ph)) * 0.25;
    for (const f of feeds) f.offset.y = off;
    const fl = 0.8 + 0.12 * Math.sin(t * 13.7) + 0.08 * Math.sin(t * 31.3) - (Math.sin(t * 1.7) > 0.97 ? 0.5 : 0);
    for (const m of rots) m.emissiveIntensity = m.userData.base * fl;
  }

  const PRE = ['concrete', 'brick', 'asphalt', 'planks', 'floorboards', 'plaster', 'tiles', 'fabric', 'metal', 'metal_painted', 'wood', 'grass', 'render', 'laminate'];
  return {
    get, normal, rough, mat, color, vc, text, sign, poster, graffiti, decal, photo, screen, foliage, animate, time,
    info: n => ({ tile: tileOf(n), metal: DEF[n]?.metal ?? 0, alpha: !!DEF[n]?.alpha }), names: NAMES,
    preload: () => PRE.map(n => () => set(n)),
  };
})();
