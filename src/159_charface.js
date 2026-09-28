// ============================================================================
// CharFace — live faces (chars agent, internal to Chars).
//   CharFace.create(built, look) -> face    face canvas texture (512 named / 256 extras) + head material
//   CharFace.emote(face, name, dur)         blend to an emote preset over 0.25 s (dur: hold, then back to the base emote)
//   CharFace.speak(face, text, dur)         viseme track from the text's letters for dur seconds
//   CharFace.blink(face) · CharFace.decal(face, kind, on) · CharFace.update(face, dt, gaze{x,y}, lod) · CharFace.dispose(face)
//   face.F (current expression params) · face.body (emote body offsets for Anim) · face.energy/emph (talk motion)
// The canvas holds skin, shading, stubble/freckles, brows, lips/teeth/tongue, lines, tears and decals.
// The EYES are drawn by the head material's shader (sclera, iris, pupil, catchlight, lids, lashes) from
// uniforms, so gaze darts and blinks never redraw the canvas. The canvas is redrawn only when the
// expression or mouth changes (throttled while talking).
// ============================================================================
const CharFace = (() => {
  const { rgbOf, css, mix, mul } = CharPaint;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const KEYS = ['bIL', 'bIR', 'bOL', 'bOR', 'fur', 'lT', 'lB', 'sL', 'sR', 'op', 'wd', 'pr', 'up', 'lo', 'th', 'ck', 'bl', 'fv', 'gX', 'gY', 'hP', 'hR', 'hY', 'sh', 'sag', 'tears', 'wet', 'red'];
  const ZERO = Object.fromEntries(KEYS.map(k => [k, 0])); ZERO.lT = 1; ZERO.wd = 1;
  const E = {
    neutral: {},
    smirk: { sL: 0.55, sR: 0.04, ck: 0.18, lB: 0.18, bOR: 0.25, bIR: 0.1, hR: 0.05, lT: 0.9 },
    smile: { sL: 0.66, sR: 0.66, ck: 0.5, lB: 0.34, th: 0.45, op: 0.07, bIL: 0.1, bIR: 0.1, lT: 0.9 },
    laugh: { sL: 0.95, sR: 0.95, ck: 0.92, lB: 0.6, th: 0.95, op: 0.55, bIL: 0.3, bIR: 0.3, lT: 0.52, hP: -0.12 },
    sad: { bIL: 0.78, bIR: 0.78, bOL: -0.35, bOR: -0.35, sL: -0.42, sR: -0.42, lT: 0.76, lo: 0.3, hP: 0.16, sag: 0.5, gY: -0.2 },
    crying: { bIL: 0.95, bIR: 0.95, bOL: -0.45, bOR: -0.45, fur: 0.55, sL: -0.7, sR: -0.7, op: 0.32, th: 0.35, lT: 0.5, lB: 0.45, ck: 0.35, bl: 0.6, hP: 0.2, sag: 0.6, tears: 1, wet: 1, red: 0.7 },
    angry: { bIL: -0.9, bIR: -0.9, bOL: 0.25, bOR: 0.25, fur: 1, lT: 0.8, lB: 0.3, pr: 0.45, up: 0.3, sL: -0.18, sR: -0.18, hP: 0.06, sh: 0.3 },
    afraid: { bIL: 0.88, bIR: 0.88, bOL: 0.45, bOR: 0.45, fur: 0.4, lT: 1.3, sL: -0.28, sR: -0.28, wd: 1.12, op: 0.18, th: 0.3, hP: -0.05, sh: 0.5 },
    shocked: { bIL: 1, bIR: 1, bOL: 0.9, bOR: 0.9, lT: 1.38, op: 0.58, wd: 0.84, th: 0.22, hP: -0.08 },
    tender: { bIL: 0.38, bIR: 0.38, sL: 0.32, sR: 0.32, ck: 0.22, lT: 0.84, lB: 0.22, hR: 0.1, bl: 0.15 },
    tense: { bIL: -0.32, bIR: -0.32, fur: 0.55, pr: 0.6, lT: 0.92, sh: 0.45, sL: -0.1, sR: -0.1 },
    ashamed: { bIL: 0.5, bIR: 0.5, bOL: -0.2, bOR: -0.2, lT: 0.62, sL: -0.22, sR: -0.22, hP: 0.28, hY: 0.2, gY: -0.6, gX: 0.3, bl: 0.3, sag: 0.4 },
    exhausted: { lT: 0.58, bIL: 0.2, bIR: 0.2, op: 0.08, hP: 0.15, sag: 0.8, sL: -0.1, sR: -0.1 },
    lying: { sL: 0.3, sR: 0.22, pr: 0.25, lT: 0.94, gX: 0.55, gY: -0.12, bOL: 0.12 },
  };
  const VIS = {
    rest: { op: 0.03 }, A: { op: 0.62, th: 0.35 }, E: { op: 0.28, wd: 1.18, th: 0.85 }, I: { op: 0.22, wd: 1.12, th: 0.7 },
    O: { op: 0.46, wd: 0.72, lo: 0.2 }, U: { op: 0.22, wd: 0.62 }, M: { op: 0, pr: 1 }, F: { op: 0.1, fv: 1, th: 0.9 },
    L: { op: 0.3, th: 0.6 }, C: { op: 0.16, wd: 1.02, th: 0.5 }, W: { op: 0.12, wd: 0.64 }, S: { op: 0.12, wd: 1.08, th: 0.9 },
  };
  const VK = ['op', 'wd', 'pr', 'th', 'fv', 'lo'];

  // ---- text -> viseme track -----------------------------------------------------------------------
  function track(text, dur) {
    const s = text.toLowerCase().replace(/\.\.\.|…/g, '…'), seq = [];
    for (let i = 0; i < s.length; i++) {
      const c = s[i], n = s[i + 1];
      if (c === 't' && n === 'h') { seq.push(['L', 0.7]); i++; continue; }
      if ((c === 's' || c === 'c') && n === 'h') { seq.push(['S', 0.8]); i++; continue; }
      if (c === 'e' && n === 'e') { seq.push(['I', 1.1]); i++; continue; }
      if (c === 'o' && n === 'o') { seq.push(['U', 1.1]); i++; continue; }
      const v = 'a' === c ? 'A' : 'e' === c ? 'E' : 'iy'.includes(c) ? 'I' : 'o' === c ? 'O' : 'u' === c ? 'U' : 'mbp'.includes(c) ? 'M' : 'fv'.includes(c) ? 'F' : 'wq'.includes(c) ? 'W' : c === 'l' ? 'L' : 'sz'.includes(c) ? 'S' : /[a-z]/.test(c) ? 'C' : /[0-9]/.test(c) ? 'A' : null;
      if (v) { seq.push([v, 'AEIOU'.includes(v) ? 1 : v === 'M' ? 0.75 : 0.55]); continue; }
      const p = c === ' ' ? 0.3 : c === ',' || c === '—' || c === '-' ? 1.1 : '.!?'.includes(c) ? 1.8 : c === '…' ? 2.4 : 0;
      if (p) { if (seq.length && seq[seq.length - 1][0] === 'rest') seq[seq.length - 1][1] += p; else seq.push(['rest', p]); }
    }
    while (seq.length && seq[seq.length - 1][0] === 'rest') seq.pop();
    const tot = seq.reduce((a, e) => a + e[1], 0) || 1, speak = Math.max(0.2, dur - 0.12);
    let t = 0;
    return seq.map(([v, w]) => { const e = { v, t0: t, t1: t + w / tot * speak }; t = e.t1; return e; });
  }

  // ---- create ---------------------------------------------------------------------------------------
  function create(B, look) {
    const S = look.faceRes || 512;
    const cv = document.createElement('canvas'); cv.width = cv.height = S;
    const base = document.createElement('canvas'); base.width = base.height = S;
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const L = B.layout;
    const f = {
      S, cv, ctx: cv.getContext('2d'), base, bctx: base.getContext('2d'), tex, L, look, D: B.D,
      F: Object.assign({}, ZERO), T: Object.assign({}, ZERO), from: Object.assign({}, ZERO), bt: 1, bdur: 0.25,
      baseEmote: look.emote || 'neutral', emoteName: look.emote || 'neutral', hold: 0,
      decals: new Set(look.decals || []), vis: null, vt: 0, speaking: false, M: { op: 0.03, wd: 1, pr: 0, th: 0, fv: 0, lo: 0 },
      blinkT: 1 + Math.random() * 3, blinkP: -1, dart: { x: 0, y: 0, t: 0.5 }, gaze: { x: 0, y: 0 }, noBlink: false,
      dirty: true, baseDirty: true, since: 1, energy: 0, emph: 0, last: {}, glow: 0,
    };
    Object.assign(f.T, E[f.baseEmote]); Object.assign(f.F, f.T);
    f.mat = material(f, look);
    return f;
  }

  // ---- head material with the eye shader --------------------------------------------------------------
  function material(f, look) {
    const L = f.L, m = new THREE.MeshStandardMaterial({ map: f.tex, roughness: 0.58, metalness: 0 });
    const eyeWu = L.eyeW * L.su, eyeWv = L.eyeW * L.sv;
    const u = f.u = {
      uEyeL: { value: new THREE.Vector4(L.eyeL[0], L.eyeL[1], eyeWu, eyeWv) },
      uEyeR: { value: new THREE.Vector4(L.eyeR[0], L.eyeR[1], eyeWu, eyeWv) },
      uLid: { value: new THREE.Vector4(1, 0, 1, 0) }, uGaze: { value: new THREE.Vector2() },
      uIris: { value: new THREE.Color(look.iris || '#5a4632') }, uSclera: { value: new THREE.Color(look.sclera || '#d6cdc0') },
      uLash: { value: new THREE.Color(look.lash || '#1a1410') }, uEyeP: { value: new THREE.Vector4(0.45, look.tilt ?? 0.04, look.lashW ?? (look.sex === 'f' ? 1.3 : 1), 0) },
      uWet: { value: 0 }, uRed: { value: look.red || 0 }, uFeed: { value: 0 }, uBlind: { value: look.blind ? 1 : 0 },
      uGlow: { value: new THREE.Color(0, 0, 0) }, uGlowDir: { value: new THREE.Vector3(0, -0.3, 1).normalize() },
    };
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, u);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vObjN;')
        .replace('#include <skinnormal_vertex>', '#include <skinnormal_vertex>\nvObjN = objectNormal;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + EYE_GLSL)
        .replace('#include <map_fragment>', MAP_GLSL)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.1, eyeIn);')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += eyeGlint + uGlow * diffuseColor.rgb * pow(max(dot(normalize(vObjN), uGlowDir), 0.0), 1.5);');
    };
    m.customProgramCacheKey = () => 'charface';
    return m;
  }
  const EYE_GLSL = `
    varying vec3 vObjN;
    uniform vec4 uEyeL, uEyeR, uLid, uEyeP; uniform vec2 uGaze; uniform vec3 uIris, uSclera, uLash, uGlow, uGlowDir;
    uniform float uWet, uRed, uFeed, uBlind;
    // returns rgb in .rgb, coverage in .a; glint -> g
    vec4 eyeCol(vec2 uv, vec4 E, float top, float bot, float side, out float glint, out float lashA) {
      vec2 p = (uv - E.xy) / E.zw; p.x *= side;                       // +x lateral, units = eye half-width
      float ax = abs(p.x), tilt = uEyeP.y * p.x;
      float up = 0.40 * pow(max(0.0, 1.0 - pow((p.x + 0.14) / 1.02, 2.0)), 0.62) + tilt;
      float lo = -0.27 * pow(max(0.0, 1.0 - pow((p.x - 0.05) / 1.0, 2.0)), 0.95) + tilt * 0.6;
      float closeY = mix(lo, up, 0.28);
      float yT = mix(closeY, up, top), yB = mix(lo, closeY, bot * 0.55);
      float fw = max(fwidth(p.y), 0.004) * 1.3;
      float inside = smoothstep(yB - fw, yB + fw, p.y) * smoothstep(yT + fw, yT - fw, p.y) * smoothstep(1.02, 0.94, ax);
      vec3 col = uSclera * (1.0 - 0.38 * smoothstep(0.45, 1.0, ax));
      col *= 1.0 - 0.5 * smoothstep(yT - 0.32, yT, p.y);                                     // lid shadow
      col *= 1.0 - 0.18 * smoothstep(yB + 0.12, yB, p.y);
      col = mix(col, vec3(0.78, 0.3, 0.28), uRed * (0.25 + 0.55 * smoothstep(0.35, 1.0, ax)));  // bloodshot
      vec2 ic = vec2(uGaze.x * side, uGaze.y);
      float ri = uEyeP.x, d = length(p - ic);
      float irisM = smoothstep(ri + fw, ri - fw, d);
      float ang = atan(p.y - ic.y, p.x - ic.x);
      float streak = 0.82 + 0.18 * sin(ang * 23.0 + d * 40.0) * sin(ang * 9.0 + 1.0);
      vec3 ir = uIris * streak * mix(1.35, 0.7, smoothstep(ri * 0.3, ri * 0.9, d));
      ir = mix(ir, uIris * 0.25, smoothstep(ri * 0.78, ri, d));
      ir = mix(ir, vec3(0.2, 0.45, 0.9), uFeed * 0.35);
      col = mix(col, ir, irisM);
      float pr = mix(0.36, 0.62, uFeed) * ri;
      col = mix(col, vec3(0.015), smoothstep(pr + fw, pr - fw, d));
      float c1 = smoothstep(0.075, 0.035, length(p - ic - vec2(-0.14 * side, 0.15)));
      float c2 = smoothstep(0.04, 0.015, length(p - ic - vec2(0.12 * side, -0.12))) * 0.5;
      glint = (c1 + c2 * (0.4 + uWet)) * inside * (1.0 - uBlind);
      col = mix(col, vec3(1.0), clamp(c1 + c2 * uWet, 0.0, 1.0));
      float wl = smoothstep(yB + 0.09, yB + 0.01, p.y) * inside;                            // lower waterline
      col = mix(col, vec3(0.86, 0.55, 0.52) + uWet * 0.3, wl * (0.45 + uWet * 0.4));
      // lash line along the upper lid (and a faint lower one)
      float lw = 0.075 * uEyeP.z * (0.7 + 0.6 * smoothstep(-0.6, 0.9, p.x));
      lashA = smoothstep(yT - fw, yT + fw * 0.5, p.y) * smoothstep(yT + lw + fw, yT + lw - fw, p.y) * smoothstep(1.12, 0.9, ax);
      lashA += 0.35 * smoothstep(yB + fw, yB - fw * 0.5, p.y) * smoothstep(yB - 0.035 - fw, yB - 0.035 + fw, p.y) * smoothstep(1.0, 0.7, ax);
      lashA *= (1.0 - uBlind);
      return vec4(col, inside * (1.0 - uBlind));
    }`;
  const MAP_GLSL = `
    vec4 sampledDiffuseColor = texture2D( map, vMapUv );
    diffuseColor *= sampledDiffuseColor;
    float eyeIn = 0.0; vec3 eyeGlint = vec3(0.0);
    {
      float g1, g2, l1, l2;
      vec4 eL = eyeCol(vMapUv, uEyeL, uLid.x, uLid.y, 1.0, g1, l1);
      vec4 eR = eyeCol(vMapUv, uEyeR, uLid.z, uLid.w, -1.0, g2, l2);
      diffuseColor.rgb = mix(diffuseColor.rgb, eL.rgb, eL.a);
      diffuseColor.rgb = mix(diffuseColor.rgb, eR.rgb, eR.a);
      diffuseColor.rgb = mix(diffuseColor.rgb, uLash, clamp(l1 + l2, 0.0, 1.0) * 0.92);
      eyeIn = max(eL.a, eR.a);
      eyeGlint = vec3(g1 + g2) * (0.35 + uWet * 0.4);
    }`;

  // ---- painting ----------------------------------------------------------------------------------------
  function P(f, x, y) { const uv = f.L.toUV(x, y); return [uv[0] * f.S, (1 - uv[1]) * f.S]; }
  function Pphi(f, phi, y) { const uv = CharBody.headUV(phi, y); return [uv[0] * f.S, (1 - uv[1]) * f.S]; }
  const px = (f, m) => m * f.L.sv * f.S;
  function soft(g, f, x, y, rx, ry, rgb, a, rot = 0) {
    const [X, Y] = P(f, x, y), RX = px(f, rx), RY = px(f, ry);
    g.save(); g.translate(X, Y); g.rotate(rot); g.scale(1, RY / RX);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, RX);
    gr.addColorStop(0, css(rgb, a)); gr.addColorStop(1, css(rgb, 0));
    g.fillStyle = gr; g.fillRect(-RX, -RX, RX * 2, RX * 2); g.restore();
  }
  function curve(g, f, pts, w, rgb, a) {
    g.strokeStyle = css(rgb, a); g.lineWidth = px(f, w); g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); pts.forEach((p, i) => { const [X, Y] = P(f, p[0], p[1]); i ? g.lineTo(X, Y) : g.moveTo(X, Y); }); g.stroke();
  }
  const rng = CharPaint.rng;

  function paintBase(f) {
    const g = f.bctx, S = f.S, L = f.L, lk = f.look, sk = rgbOf(lk.skin), age = lk.age ?? 30, fem = lk.sex === 'f' ? 1 : 0;
    const R = rng(lk.seed * 17 + 3 || 99), hairC = rgbOf((lk.hair && lk.hair.color) || lk.browColor || '#3a2a1e');
    const dark = (sk[0] + sk[1] + sk[2]) / 765 < 0.45;
    const feed = f.decals.has('feed'), fever = f.decals.has('fever');
    const skin = feed ? mix(sk, [175, 180, 170], 0.35) : fever ? mix(sk, [220, 215, 190], 0.25) : sk;
    g.fillStyle = css(skin); g.fillRect(0, 0, S, S);
    // mottling
    for (let i = 0; i < 60; i++) { const x = (R() - 0.5) * 0.15, y = -0.12 + R() * 0.23; soft(g, f, x, y, 0.008 + R() * 0.012, 0.008 + R() * 0.01, R() < 0.5 ? mul(skin, 0.94) : mix(skin, [230, 150, 140], 0.25), 0.1); }
    // broad form shading: forehead light, sides and under-jaw dark
    soft(g, f, 0, 0.05, 0.055, 0.03, mix(skin, [255, 240, 215], 0.3), 0.35);
    for (const sd of [1, -1]) {
      const [X] = Pphi(f, sd * 1.3, 0);
      const gr = g.createLinearGradient(S / 2 + (X - S / 2) * 0.55, 0, X, 0);
      gr.addColorStop(0, css(mul(skin, 0.86), 0)); gr.addColorStop(1, css(mul(skin, 0.86), 0.5));
      g.fillStyle = gr; g.fillRect(Math.min(X, S / 2 + (X - S / 2) * 0.55), 0, Math.abs(X - S / 2) * 0.45 + 2, S);
    }
    { const [, Y] = P(f, 0, -0.112); const gr = g.createLinearGradient(0, Y, 0, S); gr.addColorStop(0, css(mul(skin, 0.8), 0)); gr.addColorStop(1, css(mul(skin, 0.72), 0.7)); g.fillStyle = gr; g.fillRect(0, Y, S, S - Y); }
    // warmth: cheeks, nose, ears, chin
    const rosy = (lk.rosy ?? 0.5) * (dark ? 0.5 : 1);
    for (const sd of [1, -1]) soft(g, f, sd * 0.043, -0.036, 0.024, 0.02, mix(skin, [215, 95, 85], 0.55), 0.2 * rosy + (fever ? 0.25 : 0));
    soft(g, f, 0, -0.042 * L.noseK, 0.012, 0.011, mix(skin, [210, 90, 80], 0.5), 0.22 * rosy + 0.05);
    soft(g, f, 0, -0.1, 0.018, 0.012, mix(skin, [210, 110, 100], 0.4), 0.12 * rosy);
    soft(g, f, 0, -0.1, 0.012, 0.007, mix(skin, [255, 240, 225], 0.3), 0.2);                               // chin light
    soft(g, f, 0, 0.035, 0.03, 0.012, mix(skin, [255, 242, 228], 0.3), 0.2);                              // brow light
    for (const sd of [1, -1]) { const [X, Y] = Pphi(f, sd * 1.52, -0.015); const gr = g.createRadialGradient(X, Y, 0, X, Y, px(f, 0.03)); gr.addColorStop(0, css(mix(skin, [200, 90, 80], 0.4), 0.3)); gr.addColorStop(1, css(skin, 0)); g.fillStyle = gr; g.fillRect(X - 60, Y - 60, 120, 120); }
    // eyes: socket shadow, eyelid skin, crease, under-eye
    const tired = (lk.tired || 0) + age / 120 + (feed ? 0.8 : 0) + (fever ? 0.5 : 0);
    for (const sd of [1, -1]) {
      const ex = sd * L.ipd / 2;
      soft(g, f, ex * 1.04, 0.011, 0.021, 0.009, mul(skin, 0.68), 0.45);
      soft(g, f, sd * 0.05, -0.045, 0.014, 0.018, mul(skin, 0.8), 0.28);                                  // under the cheekbone
      soft(g, f, sd * 0.045, -0.018, 0.016, 0.01, mix(skin, [255, 240, 225], 0.3), 0.3);                 // cheekbone light
      soft(g, f, ex, 0.002, 0.017, 0.008, mix(skin, [150, 95, 95], 0.25), 0.55);
      soft(g, f, ex, -0.013, 0.016, 0.0065, mix(skin, feed ? [60, 50, 80] : [95, 65, 95], 0.55), 0.14 + tired * 0.28);
      curve(g, f, [[ex - sd * 0.013, 0.0055], [ex - sd * 0.004, 0.0098], [ex + sd * 0.006, 0.0102], [ex + sd * 0.0145, 0.0068]], 0.0011, mul(skin, 0.55), 0.35);
      if (age > 38) for (let k = 0; k < 3; k++) curve(g, f, [[ex + sd * 0.019, 0.004 - k * 0.004], [ex + sd * 0.026, 0.006 - k * 0.006]], 0.0006, mul(skin, 0.62), 0.25 * (age - 34) / 30);
      if (tired > 0.4) curve(g, f, [[ex - sd * 0.01, -0.012], [ex, -0.0155], [ex + sd * 0.012, -0.012]], 0.0008, mul(skin, 0.62), 0.25 * tired);
    }
    // nose: nostrils, under-nose shadow, bridge sides, philtrum
    for (const sd of [1, -1]) {
      const [X, Y] = P(f, sd * 0.0068 * L.noseW, -0.0512 * L.noseK);
      g.save(); g.translate(X, Y); g.rotate(sd * 0.45); g.scale(1, 0.5);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, px(f, 0.0036)); gr.addColorStop(0, 'rgba(45,20,16,0.75)'); gr.addColorStop(0.6, 'rgba(45,20,16,0.35)'); gr.addColorStop(1, 'rgba(45,20,16,0)');
      g.fillStyle = gr; g.fillRect(-20, -20, 40, 40); g.restore();
      soft(g, f, sd * 0.009, -0.02 * L.noseK, 0.004, 0.018, mul(skin, 0.8), 0.18);
      curve(g, f, [[sd * 0.0035, -0.0545], [sd * 0.0045, -0.064]], 0.0012, mul(skin, 0.86), 0.35);
    }
    soft(g, f, 0, -0.0545 * L.noseK, 0.013, 0.004, mul(skin, 0.6), 0.35);
    for (const sd of [1, -1]) {
      soft(g, f, sd * 0.0115, -0.03 * L.noseK, 0.006, 0.02, mul(skin, 0.72), 0.3);                       // nose side shadow
      soft(g, f, sd * 0.017, -0.047 * L.noseK, 0.006, 0.006, mul(skin, 0.68), 0.35);                      // alar crease
      soft(g, f, sd * 0.009, 0.011, 0.008, 0.006, mul(skin, 0.7), 0.3);                         // inner brow / nose root
      soft(g, f, sd * 0.052, -0.058, 0.02, 0.03, mul(skin, 0.86), 0.35);                         // cheek plane falloff
      soft(g, f, sd * 0.033, -0.082, 0.008, 0.01, mul(skin, 0.8), 0.25);                         // mouth corner hollow
    }
    soft(g, f, 0, -0.092, 0.018, 0.005, mul(skin, 0.75), 0.3);                                   // mentolabial crease
    soft(g, f, 0, -0.0, 0.006, 0.02, mix(skin, [255, 245, 230], 0.35), 0.3);                    // nose bridge highlight
    soft(g, f, 0, -0.064, 0.005, 0.005, mix(skin, [255, 240, 225], 0.3), 0.25);                 // philtrum highlight
    soft(g, f, 0, -0.0, 0.004, 0.02, mix(skin, [255, 240, 225], 0.3), 0.25);
    // age: nasolabial folds, forehead lines, jowls
    const ag = clamp((age - 28) / 35, 0, 1);
    for (const sd of [1, -1]) curve(g, f, [[sd * 0.017, -0.046], [sd * 0.026, -0.062], [sd * 0.031, -0.08]], 0.0016, mul(skin, 0.7), 0.1 + ag * 0.2);
    if (ag > 0.2) for (let k = 0; k < 3; k++) curve(g, f, [[-0.03, 0.042 + k * 0.009], [0, 0.044 + k * 0.009], [0.03, 0.042 + k * 0.009]], 0.0008, mul(skin, 0.7), 0.12 * ag);
    // beard shadow + stubble
    const stub = lk.stubble || 0;
    const beardMask = (phi, y) => {
      const a = Math.abs(phi);
      const top = a < 0.3 ? -0.057 : a < 1.0 ? lerp(-0.05, -0.02, (a - 0.3) / 0.7) : a < 1.35 ? 0.0 : -0.12;
      if (y > top || y < -0.13) return 0;
      const lips = ((phi / 0.42) ** 2 + ((y + 0.0745) / 0.0105) ** 2) < 1;
      return lips ? 0 : 1;
    };
    if (!fem && !lk.child) {
      const sh = dark ? [30, 25, 25] : mix(hairC, [70, 80, 95], 0.5);
      const a = 0.05 + stub * 0.22;
      for (let k = 0; k < 90; k++) { const phi = (R() * 2 - 1) * 1.35, y = -0.13 + R() * 0.13; if (beardMask(phi, y)) { const [X, Y] = Pphi(f, phi, y); const rr = px(f, 0.012); const gr = g.createRadialGradient(X, Y, 0, X, Y, rr); gr.addColorStop(0, css(sh, a * 0.5)); gr.addColorStop(1, css(sh, 0)); g.fillStyle = gr; g.fillRect(X - rr, Y - rr, rr * 2, rr * 2); } }
      if (stub > 0.1) {
        const sc = lk.stubbleColor ? rgbOf(lk.stubbleColor) : hairC, n = Math.round(stub * 60000 * (S / 512) ** 2), px1 = S / 512;
        for (let k = 0; k < n; k++) {
          const phi = (R() * 2 - 1) * 1.35, y = -0.13 + R() * 0.13;
          if (!beardMask(phi, y)) continue;
          const [X, Y] = Pphi(f, phi, y);
          const c = R() < (lk.greyStubble || 0) ? [205, 202, 196] : mul(sc, 0.6 + R() * 0.5);
          g.fillStyle = css(c, (0.12 + R() * 0.3) * Math.min(1, stub * 2.2)); g.fillRect(X, Y, px1 * (0.6 + R() * 0.7), px1 * (0.6 + R() * 0.9));
        }
      }
    }
    // freckles, moles
    const frk = lk.freckles || 0;
    for (let k = 0; k < frk * 260; k++) {
      const sd = R() < 0.5 ? -1 : 1, x = sd * Math.abs((R() + R() - 1) * 0.055), y = -0.03 + (R() + R() - 1) * 0.025;
      const w = Math.exp(-((Math.abs(x) - 0.03) ** 2) / 0.0006) + Math.exp(-(x * x) / 0.00008) * 0.8;
      if (R() > w) continue;
      const [X, Y] = P(f, x, y), r = S / 512 * (0.45 + R() * R() * 1.3);
      g.fillStyle = css(mix(skin, [140, 70, 35], 0.3 + R() * 0.3), 0.18 + R() * 0.32); g.beginPath(); g.arc(X, Y, r, 0, 7); g.fill();
    }
    for (let k = 0; k < (lk.moles ?? 2); k++) { const [X, Y] = P(f, (R() - 0.5) * 0.1, -0.09 + R() * 0.12); g.fillStyle = css(mix(skin, [70, 40, 25], 0.6), 0.6); g.beginPath(); g.arc(X, Y, S / 512 * 1.4, 0, 7); g.fill(); }
    // hairline: soft shadow and baby hairs where the scalp cap meets the forehead
    if (lk.hair && lk.hair.style !== 'bald') {
      const h = lk.hair;
      for (let k = 0; k < 90; k++) {
        const phi = (k / 89 - 0.5) * 2.9, y0 = CharHair.hairline(Object.assign({}, h, h.style === 'receding' ? { recede: 1 } : {}), Math.abs(phi));
        const [X, Y] = Pphi(f, phi, y0 - 0.003);
        const rr = px(f, 0.008);
        const gr = g.createRadialGradient(X, Y, 0, X, Y, rr); gr.addColorStop(0, css(mul(hairC, 0.9), 0.35)); gr.addColorStop(1, css(hairC, 0));
        g.fillStyle = gr; g.fillRect(X - rr, Y - rr, rr * 2, rr * 2);
        for (let q = 0; q < 3; q++) { g.strokeStyle = css(hairC, 0.25 + R() * 0.3); g.lineWidth = S / 512 * 0.8; g.beginPath(); g.moveTo(X + (R() - 0.5) * 6, Y - 2); g.lineTo(X + (R() - 0.5) * 8, Y + px(f, 0.003 + R() * 0.004)); g.stroke(); }
      }
      if (h.style === 'buzz') for (let k = 0; k < 4000 * (S / 512) ** 2; k++) { const phi = (R() * 2 - 1) * 1.55, y = 0.03 + R() * 0.09; if (y < CharHair.hairline(h, Math.abs(phi))) continue; const [X, Y] = Pphi(f, phi, y); g.fillStyle = css(hairC, 0.5); g.fillRect(X, Y, 1, 1); }
    }
    // decals
    if (f.decals.has('grime')) for (let k = 0; k < 16; k++) { const x = (R() - 0.5) * 0.12, y = -0.11 + R() * 0.18; soft(g, f, x, y, 0.006 + R() * 0.014, 0.004 + R() * 0.01, [70, 58, 45], 0.25 + R() * 0.25, R() * 3); }
    if (f.decals.has('bruise')) { soft(g, f, (lk.bruiseSide ?? -1) * 0.045, -0.028, 0.017, 0.013, [95, 60, 110], 0.45); soft(g, f, (lk.bruiseSide ?? -1) * 0.045, -0.028, 0.01, 0.008, [120, 50, 70], 0.35); }
    if (f.decals.has('blood_face')) {
      soft(g, f, -0.045, 0.06, 0.01, 0.006, [110, 12, 10], 0.7);
      curve(g, f, [[-0.045, 0.058], [-0.049, 0.03], [-0.05, 0.005], [-0.052, -0.02]], 0.0022, [120, 15, 10], 0.75);
      curve(g, f, [[0.004, -0.053], [0.006, -0.062], [0.005, -0.068]], 0.0018, [120, 15, 10], 0.7);
    }
    if (feed) for (const sd of [1, -1]) soft(g, f, sd * L.ipd / 2, -0.012, 0.018, 0.01, [120, 60, 70], 0.3);
    if (f.decals.has('sweat') || fever) for (let k = 0; k < 40; k++) { const [X, Y] = P(f, (R() - 0.5) * 0.1, -0.04 + R() * 0.1); g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(X, Y, S / 512 * (0.8 + R()), 0, 7); g.fill(); }
    f.baseDirty = false;
  }

  function paintDyn(f) {
    const g = f.ctx, F = f.F, L = f.L, lk = f.look, sk = rgbOf(lk.skin), fem = lk.sex === 'f' ? 1 : 0;
    g.drawImage(f.base, 0, 0);
    const age = clamp(((lk.age ?? 30) - 25) / 40, 0, 1);
    // expression lines
    const raise = Math.max(0, (F.bIL + F.bIR + F.bOL + F.bOR) / 4);
    if (raise > 0.1) for (let k = 0; k < 3; k++) curve(g, f, [[-0.028, 0.038 + k * 0.008], [0, 0.041 + k * 0.008 + raise * 0.002], [0.028, 0.038 + k * 0.008]], 0.0009, mul(sk, 0.66), raise * (0.18 + age * 0.3));
    if (F.fur > 0.1) for (const sd of [1, -1]) curve(g, f, [[sd * 0.0045, 0.012], [sd * 0.0055, 0.026]], 0.0011, mul(sk, 0.62), F.fur * 0.35);
    const smile = Math.max(0, (F.sL + F.sR) / 2);
    for (const sd of [1, -1]) {
      const s = sd > 0 ? F.sL : F.sR;
      curve(g, f, [[sd * 0.017, -0.046], [sd * (0.027 + s * 0.002), -0.061], [sd * (0.032 + s * 0.004), -0.078 + s * 0.004]], 0.002, mul(sk, 0.72), 0.1 + Math.max(0, s) * 0.3 + F.ck * 0.1);
      if (F.ck > 0.3) for (let k = 0; k < 3; k++) curve(g, f, [[sd * (L.ipd / 2 + 0.017), 0.003 - k * 0.005], [sd * (L.ipd / 2 + 0.026), 0.006 - k * 0.007]], 0.0007, mul(sk, 0.62), (F.ck - 0.3) * 0.4);
      if (F.ck > 0) soft(g, f, sd * 0.038, -0.03, 0.017, 0.012, mix(sk, [255, 235, 220], 0.4), F.ck * 0.25);
    }
    if (F.bl > 0.02) for (const sd of [1, -1]) soft(g, f, sd * 0.042, -0.034, 0.022, 0.016, [220, 80, 80], F.bl * 0.3);
    if (F.red > 0.05) { for (const sd of [1, -1]) soft(g, f, sd * L.ipd / 2, -0.002, 0.02, 0.012, [210, 90, 90], F.red * 0.25); soft(g, f, 0, -0.043, 0.012, 0.01, [220, 90, 85], F.red * 0.3); }
    brows(f, g, F, sk);
    mouth(f, g, F, sk);
    if (F.tears > 0.05) for (const sd of [1, -1]) {
      const ex = sd * L.ipd / 2;
      curve(g, f, [[ex - sd * 0.006, -0.009], [ex - sd * 0.004, -0.024], [ex - sd * 0.001, -0.04], [ex + sd * 0.004, -0.058]], 0.0022, mix(sk, [255, 255, 255], 0.2), 0.35 * F.tears);
      curve(g, f, [[ex - sd * 0.0055, -0.011], [ex - sd * 0.0035, -0.026], [ex - sd * 0.0005, -0.042]], 0.0006, [255, 255, 255], 0.55 * F.tears);
    }
    if (F.wet > 0.05 || f.decals.has('wet')) for (const [x, y] of [[0, -0.041], [0.02, 0.045], [-0.03, 0.03], [0.035, -0.022], [-0.034, -0.025]]) soft(g, f, x, y, 0.004, 0.003, [255, 255, 255], 0.4 * Math.max(F.wet, f.decals.has('wet') ? 1 : 0));
    f.tex.needsUpdate = true;
  }

  function brows(f, g, F, sk) {
    const L = f.L, lk = f.look, bc = rgbOf(lk.browColor || (lk.hair && lk.hair.color) || '#3a2a1e');
    const thick = (lk.browThick ?? (lk.sex === 'f' ? 0.75 : 1)) * 0.0052, R = rng(lk.seed * 5 + 1 || 5);
    for (const sd of [1, -1]) {
      const inH = sd > 0 ? F.bIL : F.bIR, outH = sd > 0 ? F.bOL : F.bOR, fur = F.fur;
      const by = L.browY + (lk.browY || 0), arch = lk.browArch ?? 0.0045;
      const p0 = [sd * (0.0108 - fur * 0.0028), by - 0.0008 + inH * 0.0058 - fur * 0.0022];
      const p1 = [sd * 0.031, by + arch + (inH * 0.35 + outH * 0.65) * 0.005];
      const p2 = [sd * 0.052, by - 0.0012 + outH * 0.0062];
      const N = 24, pts = [];
      for (let i = 0; i <= N; i++) { const t = i / N, a = (1 - t) * (1 - t), b = 2 * t * (1 - t), c = t * t; pts.push([a * p0[0] + b * p1[0] + c * p2[0], a * p0[1] + b * p1[1] + c * p2[1], t]); }
      const wAt = t => thick * (t < 0.15 ? lerp(0.85, 1, t / 0.15) : lerp(1, 0.3, (t - 0.15) / 0.85));
      // soft filled body (upper and lower edges)
      g.beginPath();
      pts.forEach(([x, y, t], i) => { const [X, Y] = P(f, x, y + wAt(t) * 0.55); i ? g.lineTo(X, Y) : g.moveTo(X, Y); });
      for (let i = N; i >= 0; i--) { const [x, y, t] = pts[i]; const [X, Y] = P(f, x, y - wAt(t) * 0.45); g.lineTo(X, Y); }
      g.closePath(); g.fillStyle = css(bc, 0.42); g.filter = `blur(${f.S / 512}px)`; g.fill(); g.filter = 'none';
      // hairs: short strokes, upward at the head, sweeping outward along the body
      const nick = lk.browNick && sd === (lk.browNick > 0 ? 1 : -1);
      for (let k = 0; k < 170; k++) {
        const t = Math.pow(R(), 0.9), i = Math.min(N - 1, Math.floor(t * N)), [x, y] = pts[i], [x2, y2] = pts[i + 1];
        if (nick && t > 0.55 && t < 0.64) continue;
        const w = wAt(t), o = (R() - 0.5) * w;
        const tx = x2 - x, ty = y2 - y, tl = Math.hypot(tx, ty) || 1;
        const bx = x + (-ty / tl) * o * sd, byy = y + (tx / tl) * o * sd;
        const up = t < 0.18 ? 0.85 : 0.25 + 0.2 * R();
        const len = w * (0.9 + R() * 0.7);
        const dx = (tx / tl) * Math.cos(up) * len, dy = Math.sin(up) * len;
        g.strokeStyle = css(mul(bc, 0.75 + R() * 0.5), 0.35 + R() * 0.45); g.lineWidth = f.S / 512 * (0.7 + R() * 0.5);
        const [X0, Y0] = P(f, bx - dx * 0.5, byy - dy * 0.5 - w * 0.1), [X1, Y1] = P(f, bx + dx * 0.5, byy + dy * 0.5);
        g.beginPath(); g.moveTo(X0, Y0); g.lineTo(X1, Y1); g.stroke();
      }
      if (nick) { const [x, y] = pts[Math.round(N * 0.595)]; curve(g, f, [[x - 0.0012, y - thick * 0.7], [x + 0.0008, y + thick * 0.7]], 0.0012, mix(sk, [255, 228, 218], 0.35), 0.95); }
    }
  }

  function mouth(f, g, F, sk) {
    const L = f.L, lk = f.look, my = L.mouthY, lips = lk.head && lk.head.lips || 1;
    const lipC = rgbOf(lk.lipColor || '#000'), dark = (sk[0] + sk[1] + sk[2]) / 765 < 0.45;
    const lc = lk.lipColor ? lipC : dark ? mix(sk, [90, 40, 45], 0.35) : mix(sk, [185, 85, 85], lk.sex === 'f' ? 0.48 : 0.36);
    const hw = L.mouthW * F.wd * (1 + 0.1 * Math.max(0, (F.sL + F.sR) / 2)) * (1 - F.pr * 0.05);
    const op = clamp(F.op, 0, 1), band = 0.0021;
    const cL = [hw + Math.max(0, F.sL) * 0.002, my + F.sL * 0.0042 - F.pr * 0.0003], cR = [-(hw + Math.max(0, F.sR) * 0.002), my + F.sR * 0.0042];
    const upT = 0.0068 * lips * (1 - F.pr * 0.4) * (1 - Math.max(0, F.sL + F.sR) * 0.1) + F.up * 0.002;
    const loT = 0.0085 * lips * (1 - F.pr * 0.35) + F.lo * 0.002;
    const oT = op * band + F.up * 0.0012, oB = op * band + F.fv * -0.0012;
    const wdO = F.wd < 0.85 ? (0.85 - F.wd) * 1.6 : 0;           // rounding for O/U
    const cy = (c) => c[1];
    const path = (pts) => { g.beginPath(); pts.forEach((p, i) => { const [X, Y] = P(f, p[0], p[1]); i ? g.lineTo(X, Y) : g.moveTo(X, Y); }); g.closePath(); };
    const qc = (a, b, c, n = 8) => { const o = []; for (let i = 0; i <= n; i++) { const t = i / n; o.push([(1 - t) ** 2 * a[0] + 2 * t * (1 - t) * b[0] + t * t * c[0], (1 - t) ** 2 * a[1] + 2 * t * (1 - t) * b[1] + t * t * c[1]]); } return o; };
    const mid = (cL[1] + cR[1]) / 2;
    // inner (opening) contours
    const inTop = qc(cR, [0, my + oT * 2 - (mid - my) * 0.2 + wdO * oT], cL);
    const inBot = qc(cL, [0, my - oB * 2 - (mid - my) * 0.6 - wdO * oB], cR);
    // outer contours: upper with a cupid's bow, lower full
    const bow = 0.0062 * (lk.bow ?? 1);
    const outTop = [cR, ...qc([cR[0] * 0.7, cy(cR) + upT * 0.55 + oT * 0.5], [-bow, my + upT + oT], [-bow * 0.6, my + upT + oT], 3).slice(0, 3), [0, my + upT * 0.86 + oT], [bow * 0.6, my + upT + oT], [bow, my + upT + oT], [cL[0] * 0.7, cy(cL) + upT * 0.55 + oT * 0.5], cL];
    const outBot = qc(cL, [0, my - loT * 2 - oB * 2 - Math.min(0, (F.sL + F.sR)) * 0.002 + wdO * 0.001], cR, 10);
    // open interior
    if (op > 0.02 || F.fv > 0.2) {
      path([...inTop, ...inBot]); g.fillStyle = 'rgb(46,16,16)'; g.fill();
      g.save(); path([...inTop, ...inBot]); g.clip();
      const th = F.th;
      if (th > 0.05) {                                                  // upper teeth under the upper lip
        const [X0, Y0] = P(f, -hw * 0.75, my + oT); const [X1, Y1] = P(f, hw * 0.75, my + oT - Math.min(oT * 2, 0.0028) - 0.0004 * F.fv);
        g.fillStyle = `rgba(232,226,208,${0.3 + th * 0.7})`; g.fillRect(X0, Y0 - 2, X1 - X0, Y1 - Y0 + 2);
        g.strokeStyle = 'rgba(120,100,90,0.35)'; g.lineWidth = 1;
        for (let i = -3; i <= 3; i++) { const [X, Y] = P(f, i * hw * 0.2, my + oT); g.beginPath(); g.moveTo(X, Y); g.lineTo(X, Y1); g.stroke(); }
        if (lk.braces) { g.fillStyle = 'rgba(190,195,200,0.95)'; const yy = (Y0 + Y1) / 2; g.fillRect(X0, yy - 1, X1 - X0, 2); for (let i = -3; i <= 3; i++) { const [X] = P(f, i * hw * 0.2, 0); g.fillRect(X - 2, yy - 2.5, 4, 5); } }
      }
      if (op > 0.35) {                                                  // lower teeth + tongue
        const [X0, Y0] = P(f, -hw * 0.6, my - oB * 0.8); const [X1] = P(f, hw * 0.6, 0);
        g.fillStyle = 'rgba(215,205,190,0.6)'; g.fillRect(X0, Y0, X1 - X0, px(f, 0.0015));
        soft(g, f, 0, my - oB * 1.3, hw * 0.55, oB * 0.6, [170, 70, 75], 0.9);
      }
      g.restore();
    }
    // lips
    path([...outTop, ...inTop.slice().reverse()]);
    const [, Yt] = P(f, 0, my + upT + oT), [, Ym] = P(f, 0, my + oT);
    let gr = g.createLinearGradient(0, Yt, 0, Ym); gr.addColorStop(0, css(mix(lc, sk, 0.25))); gr.addColorStop(1, css(mul(lc, 0.78)));
    g.fillStyle = gr; g.fill();
    path([...inBot, ...outBot.slice().reverse()]);
    const [, Yb] = P(f, 0, my - oB), [, Yl] = P(f, 0, my - oB - loT * 1.1);
    gr = g.createLinearGradient(0, Yb, 0, Yl); gr.addColorStop(0, css(mul(lc, 0.85))); gr.addColorStop(0.45, css(mix(lc, [255, 235, 230], 0.12))); gr.addColorStop(1, css(mix(lc, sk, 0.4)));
    g.fillStyle = gr; g.fill();
    // lip line + corners
    if (op < 0.05) { g.strokeStyle = `rgba(60,25,25,${0.5 + F.pr * 0.3})`; g.lineWidth = px(f, 0.0009 + F.pr * 0.0005); g.beginPath(); inTop.forEach((p, i) => { const [X, Y] = P(f, p[0], p[1]); i ? g.lineTo(X, Y) : g.moveTo(X, Y); }); g.stroke(); }
    for (const c of [cL, cR]) soft(g, f, c[0] * 1.03, c[1], 0.0025, 0.002, [70, 30, 30], 0.45);
    soft(g, f, 0, my - loT * 1.5 - oB * 2, hw * 0.55, 0.0025, mul(sk, 0.7), 0.3);                    // shadow under the lower lip
    soft(g, f, 0, my - oB - loT * 0.45, hw * 0.28, 0.0012, [255, 240, 235], 0.25 + (F.wet > 0 ? 0.2 : 0));    // lower-lip highlight
  }

  // ---- runtime ---------------------------------------------------------------------------------------------
  function emote(f, name, dur) {
    const p = E[name] ? name : 'neutral';
    f.from = Object.assign({}, f.F); f.T = Object.assign({}, ZERO, E[p]); f.bt = 0; f.emoteName = p;
    f.hold = dur > 0 ? dur : 0;
  }
  function speak(f, text, dur) { f.vis = track(text || '', dur); f.vt = 0; f.vdur = dur; f.speaking = true; }
  function blink(f) { if (f.blinkP < 0) f.blinkP = 0; }
  function decal(f, kind, on) {
    if (on) f.decals.add(kind); else f.decals.delete(kind);
    if (kind === 'wet' || kind === 'tears') { f.wetDecal = f.decals.has('wet') || f.decals.has('tears'); }
    if (kind === 'feed') { f.noBlink = on; }
    f.baseDirty = true; f.dirty = true;
  }

  function update(f, dt, gaze, lod) {
    // emote blend (0.25 s smooth) and hold/return
    if (f.bt < 1) { f.bt = Math.min(1, f.bt + dt / f.bdur); const t = f.bt * f.bt * (3 - 2 * f.bt); for (const k of KEYS) f.F[k] = lerp(f.from[k], f.T[k], t); f.dirty = true; }
    if (f.hold > 0) { f.hold -= dt; if (f.hold <= 0) emote(f, f.baseEmote); }
    if (f.decals.has('tears') && f.F.tears < 1) { f.F.tears = 1; f.dirty = true; }
    // visemes
    const M = f.M;
    let tgt = VIS.rest;
    if (f.vis) {
      f.vt += dt;
      const seg = f.vis.find(e => f.vt >= e.t0 && f.vt < e.t1);
      tgt = seg ? VIS[seg.v] : VIS.rest;
      if (seg && seg !== f.lastSeg) { f.lastSeg = seg; if ('AEIOU'.includes(seg.v) && Math.random() < 0.18) f.emph = 1; }
      if (f.vt > f.vdur) { f.vis = null; f.speaking = false; }
    }
    const rate = 1 - Math.exp(-24 * dt);
    for (const k of VK) { const v = tgt[k] ?? (k === 'wd' ? 1 : 0); M[k] += (v - M[k]) * rate; }
    f.emph = Math.max(0, f.emph - dt * 3);
    const talk = f.vis ? 1 : 0;
    // compose mouth: emote + visemes (visemes dominate the mouth while talking)
    const F = f.F, out = f.out || (f.out = {});
    Object.assign(out, F);
    if (talk || M.op > 0.035) {
      out.op = Math.max(F.op * 0.5, M.op + F.op * 0.3); out.wd = F.wd * M.wd; out.pr = Math.max(F.pr * 0.5, M.pr); out.th = Math.max(F.th, M.th); out.fv = M.fv; out.lo = F.lo + M.lo;
    }
    f.energy = out.op;
    // blinks
    if (!f.noBlink) {
      f.blinkT -= dt;
      if (f.blinkT <= 0 && f.blinkP < 0) { f.blinkP = 0; }
      if (f.blinkP >= 0) { f.blinkP += dt; if (f.blinkP > 0.24) { f.blinkP = -1; f.blinkT = 2 + Math.random() * 4 * (F.tears > 0.5 ? 0.6 : 1); } }
    } else f.blinkP = -1;
    const bp = f.blinkP < 0 ? 0 : f.blinkP < 0.07 ? f.blinkP / 0.07 : f.blinkP < 0.11 ? 1 : 1 - (f.blinkP - 0.11) / 0.13;
    const lidT = F.lT * (1 - bp) * (f.look.lidT ?? 1), lidB = clamp(F.lB + (f.look.lidB || 0), 0, 1);
    const sq = f.look.squint || 0;
    f.u.uLid.value.set(clamp(lidT - sq, 0, 1.4), lidB, clamp(lidT - sq, 0, 1.4), lidB);
    // gaze: target + darts + emote bias
    const d = f.dart;
    d.t -= dt;
    if (d.t <= 0) { d.t = 0.35 + Math.random() * (talk ? 1.2 : 2); d.x = (Math.random() - 0.5) * 0.12; d.y = (Math.random() - 0.5) * 0.08; if (Math.random() < 0.12) blink(f); }
    const gx = clamp((gaze ? gaze.x : 0) + d.x + F.gX * 0.5, -0.55, 0.55), gy = clamp((gaze ? gaze.y : 0) + d.y + F.gY * 0.3 - (1 - Math.min(1, lidT)) * 0.08, -0.32, 0.3);
    f.gaze.x += (gx - f.gaze.x) * (1 - Math.exp(-30 * dt)); f.gaze.y += (gy - f.gaze.y) * (1 - Math.exp(-30 * dt));
    f.u.uGaze.value.set(f.gaze.x, f.gaze.y);
    f.u.uWet.value = Math.max(F.wet, f.wetDecal ? 1 : 0, f.decals.has('feed') ? 1 : 0);
    f.u.uRed.value = Math.max(F.red, f.look.red || 0, f.decals.has('feed') ? 0.9 : 0, f.decals.has('fever') ? 0.4 : 0);
    f.u.uFeed.value = f.decals.has('feed') ? 1 : 0;
    // redraw when the painted expression/mouth changed (throttled)
    f.since += dt;
    if (lod > 1) return;
    let diff = 0; for (const k of ['op', 'wd', 'pr', 'th', 'fv', 'sL', 'sR', 'bIL', 'bIR', 'bOL', 'bOR', 'fur', 'ck', 'bl', 'tears', 'up', 'lo']) diff += Math.abs((out[k] || 0) - (f.last[k] || 0));
    if (f.baseDirty) { paintBase(f); f.dirty = true; }
    const minGap = lod > 0 ? 0.15 : 1 / 24;
    if ((f.dirty || diff > 0.04) && f.since >= minGap) {
      const keep = f.F; f.F = out; paintDyn(f); f.F = keep;
      Object.assign(f.last, out); f.dirty = false; f.since = 0;
    }
  }
  function dispose(f) { f.tex.dispose(); f.mat.dispose(); }
  return { create, emote, speak, blink, decal, update, dispose, EMOTES: E };
})();
