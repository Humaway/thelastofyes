// ============================================================================
// CharPaint — per-look canvas atlas painting and the body material (chars agent, internal to Chars).
//   CharPaint.atlas(look, D) -> { A (CharBody.Atlas), tex, paint() }   cached per look.key (shared by instances)
//   CharPaint.bodyMaterial(atlas) -> patched MeshStandardMaterial (per character instance, shares the texture)
// Region specs (set by CharDress/CharHair when they allocate): { t: 'skin'|'cloth'|'hair'|'shoe'|'badge'|'logo'|
//   'placket'|'print'|..., color, fab ('cotton'|'pique'|'twill'|'denim'|'canvas'|'knit'|'fleece'|'terry'|'nylon'|
//   'leather'|'rubber'|'hivis'|'scrubs'|'wool'|'plaid'|'hawaii'|'camo'), dirt, sweat, fade, text, ... }
// Painting is vector passes (canvas 2D) followed by a per-pixel fabric grain pass.
// ============================================================================
const CharPaint = (() => {
  const cache = new Map();
  const FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';
  function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  // '#rrggbb' | 0xrrggbb | [r,g,b] -> [r, g, b] (0..255, sRGB)
  function rgbOf(h) { if (Array.isArray(h)) return h; const n = typeof h === 'number' ? h : parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  const css = (rgb, a = 1) => `rgba(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0},${a})`;
  const mul = (rgb, k) => rgb.map(v => Math.max(0, Math.min(255, v * k)));
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

  function atlas(look, D) {
    if (cache.has(look.key)) return cache.get(look.key);
    const A = CharBody.Atlas(look.atlas || 1024);
    const tex = new THREE.CanvasTexture(A.cv);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; tex.userData.shared = true;
    const at = { A, tex, done: new Set(), look };
    at.paint = () => {
      let any = false;
      for (const k in A.R) if (!at.done.has(k)) { at.done.add(k); const r = A.R[k]; if (r.spec) paintRegion(A, r, r.spec, look); any = true; }
      if (any) tex.needsUpdate = true;
    };
    cache.set(look.key, at);
    return at;
  }
  function bodyMaterial(at) {
    const m = CharBody.patchBody(new THREE.MeshStandardMaterial({ map: at.tex, vertexColors: true, roughness: 1, metalness: 0 }));
    return m;
  }

  // ---------------------------------------------------------------------------------------------
  function paintRegion(A, r, sp, look) {
    const g = A.ctx, k = A.size / 1024;
    g.save(); g.beginPath(); g.rect(r.x, r.y, r.w, r.h); g.clip();
    const R = rng((look.seed || 1) * 31 + r.x * 7 + r.y * 13);
    const P = PAINT[sp.t] || PAINT.cloth;
    P(g, r, sp, R, k, look);
    g.restore();
    grain(A, r, sp, R);
  }

  // blotch: soft irregular stain
  function blotch(g, x, y, rad, rgb, a, R) {
    for (let i = 0; i < 4; i++) {
      const ox = x + (R() - 0.5) * rad, oy = y + (R() - 0.5) * rad, rr = rad * (0.4 + R() * 0.7);
      const gr = g.createRadialGradient(ox, oy, 0, ox, oy, rr);
      gr.addColorStop(0, css(rgb, a)); gr.addColorStop(1, css(rgb, 0));
      g.fillStyle = gr; g.fillRect(ox - rr, oy - rr, rr * 2, rr * 2);
    }
  }
  function stitch(g, x1, y1, x2, y2, rgb, k, dash = 3) {
    g.save(); g.strokeStyle = css(rgb, 0.55); g.lineWidth = Math.max(1, 1.1 * k); g.setLineDash([dash * k, dash * k * 0.8]);
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); g.restore();
  }
  function seamShade(g, x1, y1, x2, y2, w, rgb, a) {
    const gr = g.createLinearGradient(x1, y1, x2, y2);
    gr.addColorStop(0, css(rgb, a)); gr.addColorStop(1, css(rgb, 0));
    g.fillStyle = gr; g.fillRect(Math.min(x1, x2) - (x1 === x2 ? w : 0), Math.min(y1, y2) - (y1 === y2 ? w : 0), Math.abs(x2 - x1) || w * 2, Math.abs(y2 - y1) || w * 2);
  }
  // soft fold strokes (the geometry has faceted folds; the paint adds creases and highlights)
  function folds(g, r, R, k, n, horiz, amt = 0.1) {
    for (let i = 0; i < n; i++) {
      const x = r.x + R() * r.w, y = r.y + R() * r.h, L = (20 + R() * 60) * k, a = (horiz ? 0 : Math.PI / 2) + (R() - 0.5) * 0.7;
      g.strokeStyle = R() < 0.5 ? `rgba(0,0,0,${amt * (0.5 + R())})` : `rgba(255,255,255,${amt * 0.6 * (0.5 + R())})`;
      g.lineWidth = (1.5 + R() * 3) * k; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x - Math.cos(a) * L / 2, y - Math.sin(a) * L / 2);
      g.quadraticCurveTo(x + (R() - 0.5) * 10 * k, y + (R() - 0.5) * 10 * k, x + Math.cos(a) * L / 2, y + Math.sin(a) * L / 2); g.stroke();
    }
  }

  const PAINT = {
    skin(g, r, sp, R, k, look) {
      const base = rgbOf(sp.color);
      g.fillStyle = css(base); g.fillRect(r.x, r.y, r.w, r.h);
      for (let i = 0; i < 30; i++) blotch(g, r.x + R() * r.w, r.y + R() * r.h, 20 * k * (0.5 + R()), R() < 0.5 ? mul(base, 0.9) : mix(base, [220, 120, 110], 0.3), 0.08, R);
      if (sp.hand) {                                                    // knuckles, nails toward the tips
        g.fillStyle = css(mix(base, [200, 110, 100], 0.25), 0.25); g.fillRect(r.x, r.y + r.h * 0.05, r.w, r.h * 0.12);
      }
      if (look.tattoo && r.key === 'skin_arm') {                      // Luke: coiled-cord Landlines tattoo on the wrist
        g.strokeStyle = 'rgba(40,60,70,0.75)'; g.lineWidth = 2.2 * k;
        const cy = r.y + r.h * 0.9, x0 = r.x + r.w * 0.3;
        g.beginPath(); for (let i = 0; i <= 60; i++) { const t = i / 60, x = x0 + t * r.w * 0.4, y = cy + Math.sin(t * 6 * Math.PI * 2) * 5 * k; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
      }
      if (look.scar && r.key === 'skin_hand') { g.strokeStyle = css(mix(base, [255, 220, 210], 0.4), 0.9); g.lineWidth = 2 * k; g.beginPath(); g.moveTo(r.x + r.w * 0.55, r.y + r.h * 0.4); g.lineTo(r.x + r.w * 0.8, r.y + r.h * 0.6); g.stroke(); }
    },
    hair(g, r, sp, R, k) {
      const base = rgbOf(sp.color), grey = sp.grey || 0;
      g.fillStyle = css(base); g.fillRect(r.x, r.y, r.w, r.h);
      // strands: many thin vertical streaks of lighter/darker tone (v runs root -> tip)
      const n = Math.round(r.w * 1.6);
      for (let i = 0; i < n; i++) {
        const x = r.x + R() * r.w, lw = (0.6 + R() * 1.4) * k;
        const lt = R();
        let c = lt < 0.5 ? mul(base, 0.55 + R() * 0.3) : mul(base, 1.1 + R() * 0.45);
        if (R() < grey) c = mix(c, [205, 205, 200], 0.75);
        g.strokeStyle = css(c, 0.35 + R() * 0.4); g.lineWidth = lw;
        g.beginPath(); g.moveTo(x, r.y + r.h * R() * 0.3); g.bezierCurveTo(x + (R() - 0.5) * 6 * k, r.y + r.h * 0.4, x + (R() - 0.5) * 6 * k, r.y + r.h * 0.7, x + (R() - 0.5) * 8 * k, r.y + r.h * (0.8 + R() * 0.2)); g.stroke();
      }
      // roots darker (t=0 is the bottom of the region = root for clumps), tips catch light
      const gr = g.createLinearGradient(0, r.y + r.h, 0, r.y);
      gr.addColorStop(0, 'rgba(0,0,0,0.35)'); gr.addColorStop(0.35, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(255,240,220,0.08)');
      g.fillStyle = gr; g.fillRect(r.x, r.y, r.w, r.h);
      if (sp.cap) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(r.x, r.y + r.h * 0.85, r.w, r.h * 0.15); }
    },
    cloth(g, r, sp, R, k, look) {
      const base = rgbOf(sp.color || '#888');
      g.fillStyle = css(base); g.fillRect(r.x, r.y, r.w, r.h);
      const fab = sp.fab || 'cotton';
      // large-scale tone: sun fade toward the top/shoulders, wear
      if (sp.fade) { const gr = g.createLinearGradient(0, r.y, 0, r.y + r.h); gr.addColorStop(0, css(mix(base, [250, 248, 238], 0.35), sp.fade)); gr.addColorStop(1, css(base, 0)); g.fillStyle = gr; g.fillRect(r.x, r.y, r.w, r.h); }
      if (fab === 'plaid' || sp.plaid) plaid(g, r, sp, k);
      if (fab === 'hawaii') hawaii(g, r, sp, R, k);
      if (fab === 'camo') for (let i = 0; i < 40; i++) blotch(g, r.x + R() * r.w, r.y + R() * r.h, 18 * k, rgbOf(['#3d4430', '#5a5a40', '#2a2a22'][i % 3]), 0.5, R);
      if (sp.stripes) for (const s of sp.stripes) { g.fillStyle = s.color; if (r.key.endsWith('_sl') || sp.leg) g.fillRect(r.x, r.y + r.h * s.at, r.w, r.h * s.w); else g.fillRect(r.x, r.y + r.h * (1 - s.at - s.w), r.w, r.h * s.w); }
      folds(g, r, R, k, Math.round(r.w * r.h / 2200 * k), sp.leg || r.key.endsWith('_sl'), fab === 'nylon' || fab === 'puffer' ? 0.05 : 0.08);
      // seams
      const sc = mul(base, 0.72);
      if (!sp.rib && !sp.collar && !sp.waistband) {
        if (sp.pelvis) { stitch(g, r.x + r.w * 0.5, r.y, r.x + r.w * 0.5, r.y + r.h, sc, k); stitch(g, r.x + r.w * 0.02, r.y, r.x + r.w * 0.02, r.y + r.h, sc, k); }
        else if (sp.leg) { stitch(g, r.x + r.w * 0.5, r.y, r.x + r.w * 0.5, r.y + r.h, sc, k); stitch(g, r.x + 2, r.y, r.x + 2, r.y + r.h, sc, k); if ((sp.len ?? 1) > 0.9) stitch(g, r.x, r.y + r.h - 6 * k, r.x + r.w, r.y + r.h - 6 * k, sc, k); }
        else if (r.key.endsWith('_sl')) { stitch(g, r.x, r.y + r.h - 5 * k, r.x + r.w, r.y + r.h - 5 * k, sc, k); seamShade(g, r.x, r.y + r.h, r.x, r.y + r.h - 8 * k, 8 * k, [0, 0, 0], 0.12); }
        else { stitch(g, r.x + r.w * 0.25, r.y, r.x + r.w * 0.25, r.y + r.h, sc, k); stitch(g, r.x + r.w * 0.75, r.y, r.x + r.w * 0.75, r.y + r.h, sc, k); stitch(g, r.x, r.y + r.h - 5 * k, r.x + r.w, r.y + r.h - 5 * k, sc, k); }
      }
      if (sp.rib || sp.waistband) { g.strokeStyle = css(mul(base, 0.8), 0.5); g.lineWidth = 1 * k; for (let x = r.x; x < r.x + r.w; x += 3 * k) { g.beginPath(); g.moveTo(x, r.y); g.lineTo(x, r.y + r.h); g.stroke(); } }
      if (sp.pocketChest && !r.key.endsWith('_sl') && !sp.leg && !sp.pelvis && !sp.rib && !sp.collar) pocket(g, r.x + r.w * 0.62, r.y + r.h * 0.2, r.w * 0.07, r.h * 0.14, base, k, sp.pocketFlap);
      // sweat stains under the arms / down the back; dirt toward hems and knees
      if (sp.sweat && !sp.leg && !sp.rib && !sp.collar) {
        if (r.key.endsWith('_sl')) blotch(g, r.x + r.w * 0.5, r.y + r.h * 0.1, r.w * 0.2, mul(base, 0.72), 0.3 * sp.sweat, R);
        else { for (const x of [0.25, 0.75]) blotch(g, r.x + r.w * x, r.y + r.h * 0.15, r.w * 0.06, mul(base, 0.7), 0.35 * sp.sweat, R); blotch(g, r.x + r.w * 0.02, r.y + r.h * 0.35, r.w * 0.08, mul(base, 0.75), 0.25 * sp.sweat, R); blotch(g, r.x + r.w * 0.98, r.y + r.h * 0.35, r.w * 0.08, mul(base, 0.75), 0.25 * sp.sweat, R); }
      }
      const dirt = sp.dirt || 0;
      if (dirt) {
        const n = Math.round(6 + dirt * 26);
        for (let i = 0; i < n; i++) { const hy = sp.leg ? 0.35 + R() * 0.65 : 0.55 + R() * 0.45; blotch(g, r.x + R() * r.w, r.y + r.h * hy, (6 + R() * 16) * k, R() < 0.7 ? [70, 55, 38] : [30, 28, 24], 0.12 * dirt, R); }
        if (sp.leg) for (const x of [0.25, 0.75]) blotch(g, r.x + r.w * x, r.y + r.h * 0.55, 14 * k, [60, 48, 34], 0.25 * dirt, R);
      }
      if (sp.blood) for (let i = 0; i < 5; i++) blotch(g, r.x + r.w * (0.4 + R() * 0.3), r.y + r.h * (0.3 + R() * 0.3), (8 + R() * 18) * k, [90, 10, 8], 0.5 * sp.blood, R);
      if (sp.patchRect && !r.key.endsWith('_sl') && !sp.leg && !sp.rib && !sp.collar) {       // Zane: pale rectangle where a patch was torn off (on the back)
        g.fillStyle = css(mix(base, [230, 235, 240], 0.28)); const pw = r.w * 0.16, ph = r.h * 0.2; g.fillRect(r.x + r.w * 0.0 + 2, r.y + r.h * 0.18, pw * 0.5, ph); g.fillRect(r.x + r.w - pw * 0.5 - 2, r.y + r.h * 0.18, pw * 0.5, ph);
        g.strokeStyle = css(mul(base, 0.6), 0.6); g.setLineDash([2 * k, 2 * k]); g.strokeRect(r.x + 2, r.y + r.h * 0.18, pw * 0.5, ph); g.strokeRect(r.x + r.w - pw * 0.5 - 2, r.y + r.h * 0.18, pw * 0.5, ph); g.setLineDash([]);
      }
      if (sp.text && !r.key.endsWith('_sl') && !sp.leg && !sp.rib && !sp.collar && !sp.pelvis) {  // printed text on the back (e.g. SECURITY)
        g.fillStyle = sp.ink || 'rgba(240,240,235,0.92)'; g.font = `bold ${Math.round(r.h * 0.11)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(sp.text, r.x + 2 + r.w * 0.0, r.y + r.h * 0.32); g.fillText(sp.text, r.x + r.w - 2, r.y + r.h * 0.32);
      }
    },
    shoe(g, r, sp, R, k) {
      const base = rgbOf(sp.color || '#333'), style = sp.style;
      g.fillStyle = css(base); g.fillRect(r.x, r.y, r.w, r.h);
      if (sp.shaft) { if (style === 'sneaker') { g.fillStyle = css(mul(base, 1.1)); g.fillRect(r.x, r.y, r.w, r.h); } folds(g, r, R, k, 8, true, 0.1); if (style === 'fluffy') fuzz(g, r, base, R, k); return; }
      // sole band along the bottom of the u-range (phi ~ PI -> u 0.5)
      const sole = rgbOf(sp.sole || (style === 'sneaker' ? '#e8e4dc' : style === 'boot' ? '#2a2420' : '#1a1818'));
      g.fillStyle = css(sole); g.fillRect(r.x + r.w * 0.3, r.y, r.w * 0.4, r.h);
      if (style === 'sneaker') { g.fillStyle = css(mul(base, 0.85)); for (let i = 0; i < 4; i++) g.fillRect(r.x + r.w * 0.85, r.y + r.h * (0.35 + i * 0.1), r.w * 0.1, 2 * k); g.fillStyle = css(sp.accent ? rgbOf(sp.accent) : mul(base, 1.25)); g.fillRect(r.x + r.w * 0.1, r.y + r.h * 0.4, r.w * 0.12, r.h * 0.25); g.fillRect(r.x + r.w * 0.78, r.y + r.h * 0.4, r.w * 0.12, r.h * 0.25); }
      if (style === 'boot') { stitch(g, r.x, r.y + r.h * 0.75, r.x + r.w, r.y + r.h * 0.75, mul(base, 1.4), k, 2); }
      if (sp.tape) { g.fillStyle = 'rgba(160,160,155,0.95)'; g.fillRect(r.x, r.y + r.h * 0.55, r.w, r.h * 0.12); g.fillRect(r.x, r.y + r.h * 0.2, r.w, r.h * 0.08); }
      if (style === 'fluffy') fuzz(g, r, base, R, k);
      folds(g, r, R, k, 10, true, 0.12);
      for (let i = 0; i < 8; i++) blotch(g, r.x + R() * r.w, r.y + R() * r.h, 10 * k, [60, 50, 40], 0.12 * (sp.dirt ?? 0.5), R);
    },
    badge(g, r, sp, R, k) {                                            // staff name badge: white plate, yellow bar, text
      g.fillStyle = sp.color || '#fbfbf6'; g.fillRect(r.x, r.y, r.w, r.h);
      g.fillStyle = '#f2c200'; g.fillRect(r.x, r.y, r.w * 0.2, r.h);
      g.fillStyle = '#1a1a1a'; g.font = `bold ${Math.round(r.h * 0.34)}px ${FONT}`; g.textBaseline = 'middle'; g.textAlign = 'center';
      g.fillText('yes', r.x + r.w * 0.1, r.y + r.h * 0.5);
      const lines = sp.text.split(' — ');
      g.textAlign = 'left'; g.font = `bold ${Math.round(r.h * 0.3)}px ${FONT}`; g.fillText(lines[0], r.x + r.w * 0.24, r.y + r.h * 0.27);
      g.font = `${Math.round(r.h * 0.18)}px ${FONT}`; g.fillStyle = '#333';
      if (lines[1]) g.fillText(lines[1], r.x + r.w * 0.24, r.y + r.h * 0.56);
      if (lines[2]) { g.font = `italic ${Math.round(r.h * 0.15)}px ${FONT}`; g.fillText(lines[2], r.x + r.w * 0.24, r.y + r.h * 0.8); }
      g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2 * k; g.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
      if (sp.worn) for (let i = 0; i < 12; i++) blotch(g, r.x + R() * r.w, r.y + R() * r.h, 8 * k, [120, 100, 70], 0.2 * sp.worn, R);
    },
    logo(g, r, sp, R, k) {                                             // embroidered "yes" logo on the chest
      g.fillStyle = css(rgbOf(sp.color)); g.fillRect(r.x, r.y, r.w, r.h);
      g.fillStyle = sp.ink || 'rgba(20,20,20,0.85)'; g.font = `bold ${Math.round(r.h * 0.62)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(sp.logo === true ? 'yes' : sp.logo, r.x + r.w * 0.5, r.y + r.h * 0.52);
    },
    placket(g, r, sp, R, k) {
      const base = rgbOf(sp.color); g.fillStyle = css(base); g.fillRect(r.x, r.y, r.w, r.h);
      g.fillStyle = css(mul(base, 0.8), 0.6); g.fillRect(r.x + r.w * 0.47, r.y, r.w * 0.06, r.h);
      stitch(g, r.x + r.w * 0.3, r.y, r.x + r.w * 0.3, r.y + r.h, mul(base, 0.7), k, 2); stitch(g, r.x + r.w * 0.7, r.y, r.x + r.w * 0.7, r.y + r.h, mul(base, 0.7), k, 2);
      for (let i = 0; i < (sp.buttons || 3); i++) { const y = r.y + r.h * (0.2 + i * 0.3); g.fillStyle = 'rgba(240,238,228,1)'; g.beginPath(); g.arc(r.x + r.w * 0.5, y, r.w * 0.16, 0, 7); g.fill(); g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.arc(r.x + r.w * 0.5, y, r.w * 0.05, 0, 7); g.fill(); }
    },
    print(g, r, sp, R, k) {                                            // screen-printed chest text/graphic on a tee
      g.fillStyle = css(rgbOf(sp.color)); g.fillRect(r.x, r.y, r.w, r.h);
      g.fillStyle = sp.ink || 'rgba(245,240,230,0.9)'; g.textAlign = 'center'; g.textBaseline = 'middle';
      const lines = sp.print.split('\n');
      lines.forEach((l, i) => { g.font = `${i ? '' : 'bold '}${Math.round(r.h * (i ? 0.2 : 0.3))}px ${FONT}`; g.fillText(l, r.x + r.w / 2, r.y + r.h * (0.5 + (i - (lines.length - 1) / 2) * 0.34)); });
      for (let i = 0; i < 30; i++) { g.fillStyle = css(rgbOf(sp.color), 0.5); g.fillRect(r.x + R() * r.w, r.y + R() * r.h, 3 * k, 1.5 * k); }
    },
    plain(g, r, sp) { g.fillStyle = css(rgbOf(sp.color || '#888')); g.fillRect(r.x, r.y, r.w, r.h); },
    text(g, r, sp, R, k) {                                             // printed card/label: {bg, fg, lines:[..]}
      g.fillStyle = sp.bg || '#f4f1e8'; g.fillRect(r.x, r.y, r.w, r.h);
      g.fillStyle = sp.fg || '#222'; g.textAlign = 'center'; g.textBaseline = 'middle';
      const L = sp.lines;
      L.forEach((l, i) => { g.font = `${i === 0 ? 'bold ' : ''}${Math.round(r.h / (L.length + 1) * (i === 0 ? 0.8 : 0.62))}px ${FONT}`; g.fillText(l, r.x + r.w / 2, r.y + r.h * (i + 1) / (L.length + 1)); });
      if (sp.bar) { g.fillStyle = sp.bar; g.fillRect(r.x, r.y, r.w, r.h * 0.14); }
    },
  };
  PAINT.fur = PAINT.hair;
  PAINT.pocket = (g, r, sp, R, k) => {
    const base = rgbOf(sp.color || '#888'); g.fillStyle = css(mul(base, 0.96)); g.fillRect(r.x, r.y, r.w, r.h);
    const sc = mul(base, 0.62), m = 3 * k;
    stitch(g, r.x + m, r.y, r.x + m, r.y + r.h, sc, k, 2); stitch(g, r.x + r.w - m, r.y, r.x + r.w - m, r.y + r.h, sc, k, 2); stitch(g, r.x, r.y + r.h - m, r.x + r.w, r.y + r.h - m, sc, k, 2);
    if (sp.flap) { g.fillStyle = css(mul(base, 0.88)); g.fillRect(r.x, r.y, r.w, r.h * 0.32); stitch(g, r.x, r.y + r.h * 0.3, r.x + r.w, r.y + r.h * 0.3, sc, k, 2); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(r.x, r.y + r.h * 0.32, r.w, 2 * k); }
    else { g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(r.x, r.y, r.w, 2 * k); }
    for (let i = 0; i < 4; i++) blotch(g, r.x + R() * r.w, r.y + R() * r.h, 6 * k, [60, 50, 40], 0.1 * (sp.dirt || 0.3), R);
  };
  PAINT.cap = (g, r, sp, R, k) => {
    const base = rgbOf(sp.color); g.fillStyle = css(base); g.fillRect(r.x, r.y, r.w, r.h);
    for (let i = 0; i < 6; i++) stitch(g, r.x + r.w * i / 6, r.y, r.x + r.w * i / 6, r.y + r.h, mul(base, 0.7), k, 2);
    if (sp.fade) { g.fillStyle = css([240, 235, 220], sp.fade); g.fillRect(r.x, r.y, r.w, r.h * 0.5); }
    if (sp.text) {
      g.fillStyle = sp.ink || '#f2c200'; g.font = `bold ${Math.round(r.h * 0.34)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      const y = r.y + r.h * 0.62;
      if (sp.back) { g.fillText(sp.text, r.x, y); g.fillText(sp.text, r.x + r.w, y); } else g.fillText(sp.text, r.x + r.w * 0.5, y);
    }
    folds(g, r, R, k, 6, true, 0.1);
  };
  function pocket(g, x, y, w, h, base, k, flap) {
    g.fillStyle = css(mul(base, 0.93)); g.fillRect(x, y, w, h);
    stitch(g, x + 2 * k, y, x + 2 * k, y + h, mul(base, 0.65), k, 2); stitch(g, x + w - 2 * k, y, x + w - 2 * k, y + h, mul(base, 0.65), k, 2); stitch(g, x, y + h - 2 * k, x + w, y + h - 2 * k, mul(base, 0.65), k, 2);
    if (flap) { g.fillStyle = css(mul(base, 0.85)); g.fillRect(x - 1, y - h * 0.05, w + 2, h * 0.3); }
    g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(x, y + h * 0.26, w, 1.5 * k);
  }
  function fuzz(g, r, base, R, k) {
    for (let i = 0; i < r.w * r.h / 18; i++) { const c = R() < 0.5 ? mul(base, 1.15) : mul(base, 0.82); g.fillStyle = css(c, 0.5); g.fillRect(r.x + R() * r.w, r.y + R() * r.h, 2 * k, 2 * k); }
  }
  function plaid(g, r, sp, k) {
    const c1 = sp.plaidA || 'rgba(20,20,40,0.35)', c2 = sp.plaidB || 'rgba(255,255,255,0.18)', s = (sp.plaidSize || 26) * k;
    for (let x = r.x; x < r.x + r.w; x += s) { g.fillStyle = c1; g.fillRect(x, r.y, s * 0.35, r.h); g.fillStyle = c2; g.fillRect(x + s * 0.55, r.y, s * 0.08, r.h); }
    for (let y = r.y; y < r.y + r.h; y += s) { g.fillStyle = c1; g.fillRect(r.x, y, r.w, s * 0.35); g.fillStyle = c2; g.fillRect(r.x, y + s * 0.55, r.w, s * 0.08); }
  }
  function hawaii(g, r, sp, R, k) {
    const cols = ['#f2e6c8', '#e85d3a', '#f7c548', '#2f8f6a', '#f0f0e0'];
    for (let i = 0; i < r.w * r.h / 900; i++) {
      const x = r.x + R() * r.w, y = r.y + R() * r.h, s = (8 + R() * 10) * k, c = cols[(R() * cols.length) | 0];
      if (R() < 0.4) { g.fillStyle = '#2f7a55'; g.beginPath(); g.ellipse(x, y, s * 1.6, s * 0.5, R() * 3, 0, 7); g.fill(); continue; }
      g.fillStyle = c; for (let p = 0; p < 5; p++) { const a = p / 5 * 6.283; g.beginPath(); g.ellipse(x + Math.cos(a) * s * 0.6, y + Math.sin(a) * s * 0.6, s * 0.55, s * 0.3, a, 0, 7); g.fill(); }
      g.fillStyle = '#f7d04a'; g.beginPath(); g.arc(x, y, s * 0.25, 0, 7); g.fill();
    }
  }

  // Per-pixel fabric grain: multiplies the region by a weave pattern + fine noise.
  function grain(A, r, sp, R) {
    const fab = sp.t === 'skin' ? 'skin' : sp.t === 'hair' ? null : sp.t === 'badge' || sp.t === 'logo' || sp.t === 'text' ? 'paper' : sp.fab || (sp.t === 'shoe' ? (sp.style === 'fluffy' ? 'terry' : sp.style === 'sneaker' ? 'canvas' : 'leather') : 'cotton');
    if (!fab) return;
    const g = A.ctx, img = g.getImageData(r.x, r.y, r.w, r.h), d = img.data, W = r.w, k = A.size / 1024;
    const amp = { skin: 5, paper: 3, cotton: 7, pique: 7, twill: 9, denim: 16, canvas: 12, knit: 22, fleece: 8, terry: 18, nylon: 5, puffer: 5, leather: 7, rubber: 4, hivis: 6, scrubs: 6, wool: 18, plaid: 8, hawaii: 6, camo: 8 }[fab] ?? 8;
    const sc = Math.max(1, Math.round(k * (fab === 'knit' || fab === 'wool' ? 2 : 1)));
    for (let y = 0; y < r.h; y++) for (let x = 0; x < W; x++) {
      const X = (x / sc) | 0, Y = (y / sc) | 0;
      let v;
      switch (fab) {
        case 'denim': case 'twill': v = ((X + Y) % 4 < 2 ? 1 : -1) * 0.6 + (hash2(X, Y) - 0.5); break;
        case 'canvas': v = ((X % 2) ^ (Y % 2) ? 0.7 : -0.7) + (hash2(X >> 2, Y) - 0.5) * 0.8; break;
        case 'knit': case 'wool': { const cx = X % 6, cy = Y % 5; v = (Math.abs(cx - 3) + cy * 0.6 < 3.2 ? 0.8 : -0.8) + (hash2(X, Y) - 0.5) * 0.4; break; }
        case 'pique': v = ((X % 3 === 0) || (Y % 3 === 0) ? -0.8 : 0.4) + (hash2(X, Y) - 0.5) * 0.6; break;
        case 'terry': case 'fleece': v = (hash2(X, Y) - 0.5) * 2; break;
        case 'skin': v = (hash2(X >> 1, Y >> 1) - 0.5) * 1.2; break;
        default: v = (hash2(X, Y) - 0.5) * 1.3 + ((X + Y) % 2 ? 0.2 : -0.2);
      }
      const i = (y * W + x) * 4, m = 1 + v * amp / 255;
      d[i] = Math.min(255, d[i] * m); d[i + 1] = Math.min(255, d[i + 1] * m); d[i + 2] = Math.min(255, d[i + 2] * m);
    }
    g.putImageData(img, r.x, r.y);
  }
  const hash2 = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

  return { atlas, bodyMaterial, paintRegion, rgbOf, css, mix, mul, blotch, rng, FONT };
})();
