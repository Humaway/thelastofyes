// ============================================================================
// CharFace — live faces (chars agent, internal to Chars).
//   CharFace.create(built, look) -> face    face canvas texture (512 named / 256 extras) + head material
//   CharFace.emote(face, name, dur)         blend to an emote preset over 0.25 s (dur: hold, then back to the base emote)
//   CharFace.speak(face, text, dur)         viseme track from the text's letters for dur seconds
//   CharFace.blink(face) · CharFace.decal(face, kind, on) · CharFace.update(face, dt, gaze{x,y}, lod) · CharFace.dispose(face)
//   CharFace.frame()   once per frame: resets the budget for extras' first face paints (a few per frame)
// Extras (merged bodies) paint into their body atlas instead, eyes included, with no eye shader.
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
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
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
    const S = B.merged ? B.faceR.w : look.faceRes || 512;
    const cv = document.createElement('canvas'); cv.width = cv.height = S;
    const base = document.createElement('canvas'); base.width = base.height = S;
    const tex = B.merged ? null : new THREE.CanvasTexture(cv);
    if (tex) { tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; }
    const L = B.layout;
    const f = {
      S, cv, ctx: cv.getContext('2d'), base, bctx: base.getContext('2d', { willReadFrequently: true }), tex, L, look, D: B.D,
      F: Object.assign({}, ZERO), T: Object.assign({}, ZERO), from: Object.assign({}, ZERO), bt: 1, bdur: 0.25,
      baseEmote: look.emote || 'neutral', emoteName: look.emote || 'neutral', hold: 0,
      decals: new Set(look.decals || []), vis: null, vt: 0, speaking: false, M: { op: 0.03, wd: 1, pr: 0, th: 0, fv: 0, lo: 0 },
      blinkT: 1 + Math.random() * 3, blinkP: -1, dart: { x: 0, y: 0, t: 0.5 }, gaze: { x: 0, y: 0 }, noBlink: false,
      dirty: true, baseDirty: true, since: 1, energy: 0, emph: 0, last: {}, glow: 0,
    };
    Object.assign(f.T, E[f.baseEmote]); Object.assign(f.F, f.T);
    if (B.merged) {                                                           // extras: painted into the body atlas, eyes painted too
      f.atlas = B.atlas; f.region = B.faceR; f.mat = null;
      const g = B.atlas.A.ctx; g.fillStyle = css(rgbOf(look.skin)); g.fillRect(f.region.x, f.region.y, f.region.w, f.region.h);   // bare skin until painted
      f.u = { uGlow: { value: new THREE.Color(0, 0, 0) }, uGlowDir: { value: new THREE.Vector3(0, 0, 1) } };
      const R = rng(look.seed * 3 + 11 || 3); f.fixGaze = [(R() - 0.5) * 0.3, (R() - 0.5) * 0.12];
    } else {
      f.mat = material(f, look);
      f.head = B.head; f.morph = B.head.morphTargetDictionary && B.head.morphTargetDictionary.smileL != null ? B.head.morphTargetDictionary : null;
    }
    return f;
  }

  // ---- head material with the eye shader --------------------------------------------------------------
  function material(f, look) {
    const L = f.L, m = new THREE.MeshStandardMaterial({ map: f.tex, roughness: 0.66, metalness: 0, envMapIntensity: 0.6 });
    const eyeWu = L.eyeW * L.su, eyeWv = L.eyeW * L.sv;
    const u = f.u = {
      uEyeL: { value: new THREE.Vector4(L.eyeL[0], L.eyeL[1], eyeWu, eyeWv) },
      uEyeR: { value: new THREE.Vector4(L.eyeR[0], L.eyeR[1], eyeWu, eyeWv) },
      uLid: { value: new THREE.Vector4(1, 0, 1, 0) }, uGaze: { value: new THREE.Vector2() },
      uIris: { value: new THREE.Color(look.iris || '#5a4632') }, uSclera: { value: new THREE.Color(look.sclera || '#cdc3b6') },
      uLash: { value: new THREE.Color(look.lash || '#1a1410') }, uEyeP: { value: new THREE.Vector4(0.45, look.tilt ?? 0.04, look.lashW ?? (look.sex === 'f' ? 1.3 : 1), 0) },
      uWet: { value: 0 }, uRed: { value: look.red || 0 }, uFeed: { value: 0 }, uBlind: { value: look.blind ? 1 : 0 },
      uGlow: { value: new THREE.Color(0, 0, 0) }, uGlowDir: { value: new THREE.Vector3(0, -0.3, 1).normalize() },
    };
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, u);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vObjN;')
        .replace('#include <skinnormal_vertex>', '#include <skinnormal_vertex>\nvObjN = objectNormal;')
        .replace('#include <shadowmap_vertex>', SHADOW_V);
      sh.fragmentShader = CharBody.softShadow(sh.fragmentShader).replace('#include <common>', '#include <common>\n' + EYE_GLSL)
        .replace('#include <map_fragment>', MAP_GLSL)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.1, eyeIn);')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += eyeGlint + uGlow * diffuseColor.rgb * pow(max(dot(normalize(vObjN), uGlowDir), 0.0), 1.5);');
    };
    m.customProgramCacheKey = () => 'charface';
    return m;
  }
  // the face looks up shadows 10 cm off its surface: no blotchy self-shadowing from the nose, brow or hair at
  // shadow-map resolution, while walls and roofs still shade it
  const SHADOW_V = THREE.ShaderChunk.shadowmap_vertex.replace(/(\w+\[ i \])\.shadowNormalBias/g, '($1.shadowNormalBias + 0.1)');
  const EYE_GLSL = `
    varying vec3 vObjN;
    uniform vec4 uEyeL, uEyeR, uLid, uEyeP; uniform vec2 uGaze; uniform vec3 uIris, uSclera, uLash, uGlow, uGlowDir;
    uniform float uWet, uRed, uFeed, uBlind;
    // returns rgb in .rgb, coverage in .a; glint -> g
    vec4 eyeCol(vec2 uv, vec4 E, float top, float bot, float side, out float glint, out float lashA) {
      vec2 p = (uv - E.xy) / E.zw; p.x *= side;                       // +x lateral, units = eye half-width
      float ax = abs(p.x), tilt = uEyeP.y * p.x;
      float up = 0.4 * pow(max(0.0, 1.0 - pow((p.x + 0.14) / 1.02, 2.0)), 0.62) + tilt;
      float lo = -0.25 * pow(max(0.0, 1.0 - pow((p.x - 0.05) / 1.0, 2.0)), 0.95) + tilt * 0.6;
      float closeY = mix(lo, up, 0.28);
      float yT = mix(closeY, up, top), yB = mix(lo, closeY, bot * 0.55);
      float fw = max(fwidth(p.y), 0.004) * 1.3;
      float inside = smoothstep(yB - fw, yB + fw, p.y) * smoothstep(yT + fw, yT - fw, p.y) * smoothstep(1.02, 0.94, ax);
      vec3 col = uSclera * (1.0 - 0.34 * smoothstep(0.4, 1.0, ax));
      col = mix(col, vec3(0.78, 0.5, 0.48), smoothstep(-0.6, -0.97, p.x) * 0.6);           // caruncle, inner corner
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
      col *= 1.0 + 0.12 * smoothstep(ri * 0.62, ri * 0.5, d) * irisM * smoothstep(pr, pr * 1.3, d);   // collarette
      col *= 1.0 - 0.58 * smoothstep(yT - 0.42, yT, p.y);                                    // the upper lid's shadow on the eye
      col *= 1.0 - 0.2 * smoothstep(yB + 0.12, yB, p.y);
      float c1 = smoothstep(0.075, 0.035, length(p - ic - vec2(-0.14 * side, 0.15)));
      float c2 = smoothstep(0.04, 0.015, length(p - ic - vec2(0.12 * side, -0.12))) * 0.5;
      glint = (c1 + c2 * (0.4 + uWet)) * inside * (1.0 - uBlind);
      col = mix(col, vec3(1.0), clamp(c1 + c2 * uWet, 0.0, 1.0));
      float wl = smoothstep(yB + 0.09, yB + 0.01, p.y) * inside;                            // lower waterline
      col = mix(col, vec3(0.86, 0.55, 0.52) + uWet * 0.3, wl * (0.45 + uWet * 0.4));
      // lash line along the upper lid (and a faint lower one)
      float lw = 0.085 * uEyeP.z * (0.65 + 0.7 * smoothstep(-0.6, 0.95, p.x)) * (0.92 + 0.08 * sin(p.x * 131.0));
      lashA = smoothstep(yT - fw, yT + fw * 0.5, p.y) * smoothstep(yT + lw + fw, yT + lw - fw, p.y) * smoothstep(1.14, 0.9, ax);
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
  // Head-space front coordinates (x, y) map to the canvas through the head's ray grid (L.toUV). The mesh
  // carries the form, so the paint is colour zones, soft cavities, lids, lips, hair and marks.
  function P(f, x, y) { const uv = f.L.toUV(x, y); return [uv[0] * f.S, (1 - uv[1]) * f.S]; }
  function Pphi(f, phi, y) { const uv = CharBody.headUV(phi, y); return [uv[0] * f.S, (1 - uv[1]) * f.S]; }
  const px = (f, m) => m * f.L.sv * f.S;
  function soft(g, f, x, y, rx, ry, rgb, a, rot = 0) {
    const [X, Y] = P(f, x, y), RX = Math.max(0.5, px(f, rx)), RY = px(f, ry);
    g.save(); g.translate(X, Y); g.rotate(rot); g.scale(1, RY / RX);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, RX);
    gr.addColorStop(0, css(rgb, a)); gr.addColorStop(0.5, css(rgb, a * 0.6)); gr.addColorStop(1, css(rgb, 0));
    g.fillStyle = gr; g.fillRect(-RX, -RX, RX * 2, RX * 2); g.restore();
  }
  // a stroke; blur > 0 softens it with wider, fainter passes underneath (canvas filters are far too slow here)
  function line(g, f, pts, w, rgb, a, blur = 0) {
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); pts.forEach((p, i) => { const [X, Y] = P(f, p[0], p[1]); i ? g.lineTo(X, Y) : g.moveTo(X, Y); });
    const passes = blur ? [[w + blur * 2.4, a * 0.22], [w + blur * 1.2, a * 0.3], [w, a * 0.55]] : [[w, a]];
    for (const [ww, aa] of passes) { g.strokeStyle = css(rgb, aa); g.lineWidth = Math.max(0.6, px(f, ww)); g.stroke(); }
  }
  const quad = (a, b, c, n = 8) => { const o = []; for (let i = 0; i <= n; i++) { const t = i / n; o.push([(1 - t) ** 2 * a[0] + 2 * t * (1 - t) * b[0] + t * t * c[0], (1 - t) ** 2 * a[1] + 2 * t * (1 - t) * b[1] + t * t * c[1]]); } return o; };
  const rng = CharPaint.rng;
  // skin under shadow shifts toward red (light scattering in skin)
  const deep = (skin, k) => mix(mul(skin, k), [150, 45, 35], (1 - k) * 0.35);
  const lite = (skin, k) => mix(skin, [255, 244, 232], k);

  function paintBase(f) {
    const g = f.bctx, S = f.S, L = f.L, K = L.P, lk = f.look, age = lk.age ?? 30, fem = K.fem, kid = K.kid;
    const R = rng(lk.seed * 17 + 3 || 99), sk = rgbOf(lk.skin), hairC = rgbOf((lk.hair && lk.hair.color) || lk.browColor || '#3a2a1e');
    const dark = (sk[0] * 0.3 + sk[1] * 0.59 + sk[2] * 0.11) / 255 < 0.45;
    const feed = f.decals.has('feed'), fever = f.decals.has('fever');
    const skin = feed ? mix(sk, [175, 180, 170], 0.35) : fever ? mix(sk, [220, 215, 190], 0.25) : sk;
    const ex = L.ipd / 2, tY = L.tipY, nW = L.noseW, mY = L.mouthY, mW = L.mouthW, cY = L.chinY;
    const rosy = (lk.rosy ?? 0.5) * (dark ? 0.55 : 1), ag = clamp((age - 28) / 40, 0, 1);
    const tired = (lk.tired || 0) + age / 140 + (feed ? 0.8 : 0) + (fever ? 0.5 : 0);
    g.fillStyle = css(skin); g.fillRect(0, 0, S, S);
    // colour zones: golden forehead, ruddy cheeks/nose/ears, cooler lower face (beard shadow on men)
    soft(g, f, 0, 0.042, 0.075, 0.04, mix(skin, [235, 195, 140], 0.18), 0.4);
    for (const sd of [1, -1]) {
      soft(g, f, sd * 0.044, -0.03, 0.032, 0.03, mix(skin, [205, 80, 80], 0.42), 0.3 * rosy + (fever ? 0.25 : 0) + 0.04);
      const [X, Y] = Pphi(f, sd * 1.53, -0.02), r = px(f, 0.035), gr = g.createRadialGradient(X, Y, 0, X, Y, r);
      gr.addColorStop(0, css(mix(skin, [200, 80, 75], 0.45), 0.45)); gr.addColorStop(1, css(skin, 0)); g.fillStyle = gr; g.fillRect(X - r, Y - r, r * 2, r * 2);
    }
    soft(g, f, 0, tY + 0.012, 0.013, 0.03, mix(skin, [210, 90, 85], 0.4), 0.26 * rosy + 0.08);
    soft(g, f, 0, mY - 0.028, 0.06, 0.04, fem || kid ? mix(skin, [210, 150, 150], 0.2) : mix(skin, [115, 120, 138], 0.3), fem || kid ? 0.2 : 0.3);
    for (let i = 0; i < (S < 300 ? 30 : 80); i++) { const x = (R() - 0.5) * 0.15, y = -0.125 + R() * 0.2; soft(g, f, x, y, 0.005 + R() * 0.014, 0.005 + R() * 0.012, R() < 0.5 ? mul(skin, 0.93) : mix(skin, [225, 135, 125], 0.3), 0.1); }
    // eyes: inner corners, the socket under the brow, pinker lids, lid crease, lower lid and under-eye
    for (const sd of [1, -1]) {
      const X = x => sd * x;
      soft(g, f, X(ex - 0.013), 0.0012, 0.0045, 0.004, deep(skin, 0.6), 0.45);
      soft(g, f, X(ex - 0.0128), 0.0008, 0.0022, 0.0018, [200, 115, 112], 0.7);
      soft(g, f, X(ex + 0.002), 0.012, 0.019, 0.006, deep(skin, 0.72), 0.3);
      soft(g, f, X(ex), 0.0062, 0.017, 0.006, mix(skin, [180, 110, 115], 0.28), 0.55);
      line(g, f, quad([X(ex - 0.012), 0.0078], [X(ex), 0.0128], [X(ex + 0.0145), 0.0082]), 0.0011, deep(skin, 0.55), 0.4, 0.0004);
      soft(g, f, X(ex + 0.001), -0.0088, 0.015, 0.0042, mix(deep(skin, 0.8), [95, 70, 110], 0.25), 0.18 + tired * 0.3);
      line(g, f, quad([X(ex - 0.011), -0.0072], [X(ex), -0.0098], [X(ex + 0.012), -0.0068]), 0.0008, deep(skin, 0.7), 0.2 + tired * 0.2, 0.0004);
      if (tired > 0.45) line(g, f, quad([X(ex - 0.012), -0.012], [X(ex - 0.001), -0.0165], [X(ex + 0.013), -0.0125]), 0.0009, deep(skin, 0.7), 0.25 * (tired - 0.3), 0.0005);
      if (age > 36) for (let k = 0; k < 3; k++) line(g, f, [[X(ex + 0.017), 0.003 - k * 0.0045], [X(ex + 0.025), 0.005 - k * 0.0065]], 0.0006, deep(skin, 0.65), 0.2 * clamp((age - 34) / 25, 0, 1), 0.0003);
      // nose: side shadow, alar crease, nostril, cheekbone light, mouth corner, nasolabial fold
      soft(g, f, X(0.0105), -0.012, 0.004, 0.014, deep(skin, 0.75), 0.25);
      line(g, f, quad([X(0.0165 * nW), tY + 0.0045], [X(0.0205 * nW), tY - 0.002], [X(0.0155 * nW), tY - 0.0078]), 0.0014, deep(skin, 0.55), 0.5, 0.0005);
      soft(g, f, X(0.0195 * nW), tY - 0.004, 0.0035, 0.005, deep(skin, 0.6), 0.35);
      const [NX, NY] = P(f, X(0.0066 * nW), tY - 0.0072);
      g.save(); g.translate(NX, NY); g.rotate(sd * 0.4); g.scale(1, 0.48);
      const nr = px(f, 0.0036), gn = g.createRadialGradient(0, 0, 0, 0, 0, nr); gn.addColorStop(0, 'rgba(40,16,14,0.9)'); gn.addColorStop(0.55, 'rgba(50,20,16,0.6)'); gn.addColorStop(1, 'rgba(60,24,20,0)');
      g.fillStyle = gn; g.fillRect(-nr, -nr, nr * 2, nr * 2); g.restore();
      soft(g, f, X(0.046), -0.015, 0.014, 0.006, lite(skin, 0.3), 0.22);
      soft(g, f, X(mW + 0.0015), mY + 0.0005, 0.0032, 0.003, deep(skin, 0.55), 0.45);
      const fold = [[X(0.0195 * nW), tY - 0.0005], [X(0.0275), (tY + mY) / 2 - 0.004], [X(mW + 0.0065), mY - 0.005]];
      line(g, f, quad(...fold), 0.0022, deep(skin, 0.7), 0.1 + ag * 0.28, 0.0008);
      line(g, f, quad(...fold.map(p => [p[0] + X(0.0022), p[1] + 0.0008])), 0.0018, lite(skin, 0.3), 0.12, 0.0008);
      soft(g, f, X(0.028), 0.02, 0.016, 0.004, lite(skin, 0.3), 0.14);                                    // brow bone light
      if (ag > 0.5) line(g, f, [[X(mW + 0.003), mY - 0.004], [X(mW + 0.006), mY - 0.018], [X(mW + 0.005), cY + 0.004]], 0.0018, deep(skin, 0.72), (ag - 0.5) * 0.5, 0.0008);
    }
    soft(g, f, 0, tY - 0.0095, 0.0095, 0.0028, deep(skin, 0.6), 0.4);                                     // under the nose
    soft(g, f, 0, tY + 0.0045, 0.0045, 0.004, lite(skin, 0.35), 0.35);                                   // nose tip light
    soft(g, f, 0, -0.012, 0.0028, 0.014, lite(skin, 0.3), 0.28);                                          // bridge light
    soft(g, f, 0, 0.012, 0.006, 0.004, deep(skin, 0.75), 0.18);                                           // nose root
    for (const sd of [1, -1]) line(g, f, [[sd * 0.0036, tY - 0.011], [sd * 0.0048, mY + 0.0085]], 0.0011, lite(skin, 0.25), 0.3, 0.0004); // philtrum ridges
    soft(g, f, 0, mY + 0.013, 0.0025, 0.004, deep(skin, 0.8), 0.2);
    soft(g, f, 0, mY - 0.0165, 0.017, 0.0035, deep(skin, 0.65), 0.35);                                   // under the lower lip
    soft(g, f, 0, cY + 0.003, 0.012, 0.008, lite(skin, 0.3), 0.22);                                       // chin light
    soft(g, f, 0, 0.045, 0.03, 0.015, lite(skin, 0.25), 0.2);                                             // forehead light
    if (ag > 0.2) for (let k = 0; k < 3; k++) line(g, f, quad([-0.03, 0.041 + k * 0.009], [0, 0.044 + k * 0.009], [0.03, 0.041 + k * 0.009]), 0.0008, deep(skin, 0.72), 0.12 * ag, 0.0004);
    // beard shadow + stubble
    const stub = lk.stubble || 0;
    const beardMask = (phi, y) => {
      const a = Math.abs(phi), top = a < 0.3 ? tY - 0.012 : a < 1.0 ? lerp(tY - 0.01, -0.048, sstep(0.3, 1.0, a)) : a < 1.35 ? lerp(-0.048, -0.01, sstep(1.0, 1.15, a)) : -0.12;
      if (y > top || y < -0.13) return 0;
      return ((phi / 0.4) ** 2 + ((y - mY + 0.001) / 0.0105) ** 2) < 1 ? 0 : 1;
    };
    if (!fem && !kid) {
      const sh = dark ? [30, 25, 25] : mix(hairC, [70, 80, 95], 0.5), a = 0.03 + stub * 0.15;
      const top = phi => { const t = Math.abs(phi); return t < 0.3 ? tY - 0.012 : t < 1.0 ? lerp(tY - 0.01, -0.048, sstep(0.3, 1.0, t)) : lerp(-0.048, -0.01, sstep(1.0, 1.15, t)); };
      for (const [lift, al] of [[0.006, 0.3], [0.002, 0.45], [-0.002, 0.5]]) {   // the shaved shadow: soft-edged, a little stronger low on the jaw
        g.beginPath();
        for (let k = 0; k <= 40; k++) { const phi = (k / 40 * 2 - 1) * 1.3, [X, Y] = Pphi(f, phi, top(phi) + lift); k ? g.lineTo(X, Y) : g.moveTo(X, Y); }
        for (let k = 40; k >= 0; k--) { const [X, Y] = Pphi(f, (k / 40 * 2 - 1) * 1.3, -0.14); g.lineTo(X, Y); }
        g.closePath(); g.fillStyle = css(sh, a * al); g.fill();
      }
      if (stub > 0.1) {
        const sc = lk.stubbleColor ? rgbOf(lk.stubbleColor) : hairC, n = Math.round(stub * 26000 * (S / 512) ** 2), p1 = S / 512;
        for (let k = 0; k < n; k++) {
          const phi = (R() * 2 - 1) * 1.35, y = -0.13 + R() * 0.13;
          if (!beardMask(phi, y + (R() - 0.5) * 0.008)) continue;            // ragged edge
          const [X, Y] = Pphi(f, phi, y);
          const c = R() < (lk.greyStubble || 0) ? [205, 202, 196] : mul(sc, 0.55 + R() * 0.4);
          g.fillStyle = css(c, (0.1 + R() * 0.22) * Math.min(1, stub * 1.8)); g.fillRect(X, Y, p1 * (0.5 + R() * 0.5), p1 * (0.8 + R() * 1.1));
        }
      }
    }
    // freckles, moles
    const frk = lk.freckles || 0;
    for (let k = 0; k < frk * 300; k++) {
      const sd = R() < 0.5 ? -1 : 1, x = sd * Math.abs((R() + R() - 1) * 0.055), y = -0.03 + (R() + R() - 1) * 0.025;
      const w = Math.exp(-((Math.abs(x) - 0.03) ** 2) / 0.0006) + Math.exp(-(x * x) / 0.00008) * 0.8;
      if (R() > w) continue;
      const [X, Y] = P(f, x, y), r = S / 512 * (0.45 + R() * R() * 1.2);
      g.fillStyle = css(mix(skin, [140, 70, 35], 0.3 + R() * 0.3), 0.16 + R() * 0.3); g.beginPath(); g.arc(X, Y, r, 0, 7); g.fill();
    }
    for (let k = 0; k < (lk.moles ?? 2); k++) { const [X, Y] = P(f, (R() - 0.5) * 0.1, -0.09 + R() * 0.12); g.fillStyle = css(mix(skin, [70, 40, 25], 0.6), 0.55); g.beginPath(); g.arc(X, Y, S / 512 * 1.3, 0, 7); g.fill(); }
    // hairline: soft shadow and fine hairs where the scalp shell meets the skin
    if (lk.hair && lk.hair.style !== 'bald') {
      const h = lk.hair;
      const nh = S < 300 ? 45 : 110, hl = Object.assign({}, h, h.style === 'receding' ? { recede: 1 } : {});
      // the scalp under the shell carries a root tone, so skin never shows as a bright strip between the painted
      // hairline and the shell's edge (the forehead's top faces the key light)
      g.fillStyle = css(mix(skin, hairC, h.style === 'buzz' ? 0.3 : 0.7), 1); g.beginPath();
      for (let k = 0; k <= 40; k++) { const phi = (k / 40 - 0.5) * 3.0, [X, Y] = Pphi(f, phi, CharHair.hairline(hl, Math.abs(phi)) - 0.0045); k ? g.lineTo(X, Y) : g.moveTo(X, Y); }
      for (let k = 40; k >= 0; k--) { const [X, Y] = Pphi(f, (k / 40 - 0.5) * 3.0, 0.14); g.lineTo(X, Y); }
      g.fill();
      for (let k = 0; k < nh; k++) {
        const phi = (k / (nh - 1) - 0.5) * 3.0, y0 = CharHair.hairline(Object.assign({}, h, h.style === 'receding' ? { recede: 1 } : {}), Math.abs(phi));
        const [X, Y] = Pphi(f, phi, y0 - 0.006), rr = px(f, 0.009);
        const gr = g.createRadialGradient(X, Y, 0, X, Y, rr); gr.addColorStop(0, css(mix(skin, hairC, 0.6), 0.42)); gr.addColorStop(1, css(hairC, 0));
        g.fillStyle = gr; g.fillRect(X - rr, Y - rr, rr * 2, rr * 2);
        for (let q = 0; q < (S < 300 ? 2 : 4); q++) { g.strokeStyle = css(hairC, 0.2 + R() * 0.35); g.lineWidth = S / 512 * 0.7; g.beginPath(); g.moveTo(X + (R() - 0.5) * 6, Y - 2); g.lineTo(X + (R() - 0.5) * 8, Y + px(f, 0.002 + R() * 0.005)); g.stroke(); }
      }
      if (h.style === 'buzz') for (let k = 0; k < 5000 * (S / 512) ** 2; k++) { const phi = (R() * 2 - 1) * 1.55, y = 0.03 + R() * 0.09; if (y < CharHair.hairline(h, Math.abs(phi))) continue; const [X, Y] = Pphi(f, phi, y); g.fillStyle = css(hairC, 0.45); g.fillRect(X, Y, 1, 1); }
    }
    // decals
    if (f.decals.has('grime')) for (let k = 0; k < 16; k++) { const x = (R() - 0.5) * 0.12, y = -0.11 + R() * 0.18; soft(g, f, x, y, 0.006 + R() * 0.014, 0.004 + R() * 0.01, [70, 58, 45], 0.25 + R() * 0.25, R() * 3); }
    if (f.decals.has('bruise')) { soft(g, f, (lk.bruiseSide ?? -1) * 0.045, -0.028, 0.017, 0.013, [95, 60, 110], 0.45); soft(g, f, (lk.bruiseSide ?? -1) * 0.045, -0.028, 0.01, 0.008, [120, 50, 70], 0.35); }
    if (f.decals.has('blood_face')) {
      soft(g, f, -0.045, 0.06, 0.01, 0.006, [110, 12, 10], 0.7);
      line(g, f, [[-0.045, 0.058], [-0.049, 0.03], [-0.05, 0.005], [-0.052, -0.02]], 0.0022, [120, 15, 10], 0.75);
      line(g, f, [[0.004, tY - 0.01], [0.006, mY + 0.012], [0.005, mY + 0.006]], 0.0018, [120, 15, 10], 0.7);
    }
    if (feed) for (const sd of [1, -1]) soft(g, f, sd * ex, -0.01, 0.018, 0.01, [120, 60, 70], 0.3);
    if (f.decals.has('sweat') || fever) for (let k = 0; k < 40; k++) { const [X, Y] = P(f, (R() - 0.5) * 0.1, -0.04 + R() * 0.1); g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(X, Y, S / 512 * (0.8 + R()), 0, 7); g.fill(); }
    // below the jaw the canvas returns to the plain skin tone of the body's neck
    { const [, Y] = P(f, 0, cY - 0.004), [, Y1] = P(f, 0, cY - 0.022); const gr = g.createLinearGradient(0, Y, 0, Y1); gr.addColorStop(0, css(skin, 0)); gr.addColorStop(1, css(skin, 1)); g.fillStyle = gr; g.fillRect(0, Y, S, S - Y); }
    pores(g, S, lk.seed || 1);
    f.baseDirty = false;
  }
  // fine skin grain (pores, tone noise)
  function pores(g, S, seed) {
    const img = g.getImageData(0, 0, S, S), d = img.data, k = S / 512;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const X = (x / k) | 0, Y = (y / k) | 0;
      let h = (X * 374761393 + Y * 668265263 + seed * 1013) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; const v = ((h ^ (h >>> 16)) >>> 0) / 4294967296 - 0.5;
      const m = 1 + v * 0.045, i = (y * S + x) * 4;
      d[i] = Math.min(255, d[i] * m); d[i + 1] = Math.min(255, d[i + 1] * (m * 0.5 + 0.5)); d[i + 2] = Math.min(255, d[i + 2] * (m * 0.5 + 0.5));
    }
    g.putImageData(img, 0, 0);
  }

  function paintDyn(f) {
    const g = f.ctx, F = f.F, L = f.L, lk = f.look, sk = rgbOf(lk.skin);
    g.drawImage(f.base, 0, 0);
    const age = clamp(((lk.age ?? 30) - 22) / 40, 0, 1), ex = L.ipd / 2, mY = L.mouthY, tY = L.tipY;
    // expression lines: forehead, frown lines, smile folds, crow's feet, cheek lift, blush
    const raise = Math.max(0, (F.bIL + F.bIR) * 0.3 + (F.bOL + F.bOR) * 0.2);
    if (raise > 0.1) for (let k = 0; k < 3; k++) line(g, f, quad([-0.03, 0.037 + k * 0.0085], [0, 0.041 + k * 0.0085 + raise * 0.002], [0.03, 0.037 + k * 0.0085]), 0.0009, deep(sk, 0.66), raise * (0.22 + age * 0.3), 0.0004);
    if (F.fur > 0.1) for (const sd of [1, -1]) line(g, f, [[sd * 0.0048, 0.011], [sd * 0.006, 0.026]], 0.001, deep(sk, 0.6), F.fur * 0.4, 0.0004);
    for (const sd of [1, -1]) {
      const s = sd > 0 ? F.sL : F.sR;
      const fold = [[sd * 0.0195 * L.noseW, tY - 0.0005], [sd * (0.028 + Math.max(0, s) * 0.003), (tY + mY) / 2 - 0.003], [sd * (L.mouthW + 0.006 + Math.max(0, s) * 0.004), mY - 0.004 + s * 0.004]];
      line(g, f, quad(...fold), 0.0024, deep(sk, 0.66), Math.max(0, s) * 0.32 + F.ck * 0.1, 0.0008);
      if (F.ck > 0.3) for (let k = 0; k < 3; k++) line(g, f, [[sd * (ex + 0.016), 0.002 - k * 0.0045], [sd * (ex + 0.025), 0.005 - k * 0.0065]], 0.0007, deep(sk, 0.6), (F.ck - 0.3) * 0.45, 0.0003);
      if (F.ck > 0) soft(g, f, sd * 0.04, -0.028, 0.016, 0.011, lite(sk, 0.35), F.ck * 0.22);
      if (s < -0.2) line(g, f, [[sd * (L.mouthW + 0.002), mY - 0.002], [sd * (L.mouthW + 0.004), mY - 0.014]], 0.0014, deep(sk, 0.7), (-s - 0.2) * 0.4, 0.0006);
    }
    if (F.bl > 0.02) for (const sd of [1, -1]) soft(g, f, sd * 0.042, -0.032, 0.022, 0.016, [220, 80, 80], F.bl * 0.3);
    if (F.red > 0.05) { for (const sd of [1, -1]) soft(g, f, sd * ex, -0.002, 0.02, 0.012, [210, 90, 90], F.red * 0.25); soft(g, f, 0, tY + 0.002, 0.012, 0.01, [220, 90, 85], F.red * 0.3); }
    brows(f, g, F, sk);
    mouth(f, g, F, sk);
    if (F.tears > 0.05) for (const sd of [1, -1]) {
      const x0 = sd * (ex - 0.008);
      line(g, f, [[x0, -0.006], [x0 + sd * 0.001, -0.022], [x0 + sd * 0.004, -0.04], [x0 + sd * 0.008, -0.058]], 0.0022, lite(sk, 0.2), 0.35 * F.tears, 0.0004);
      line(g, f, [[x0 + sd * 0.0005, -0.008], [x0 + sd * 0.0015, -0.024], [x0 + sd * 0.0045, -0.042]], 0.0006, [255, 255, 255], 0.55 * F.tears);
    }
    if (F.wet > 0.05 || f.decals.has('wet')) for (const [x, y] of [[0, tY + 0.004], [0.02, 0.045], [-0.03, 0.03], [0.035, -0.022], [-0.034, -0.025]]) soft(g, f, x, y, 0.004, 0.003, [255, 255, 255], 0.4 * Math.max(F.wet, f.decals.has('wet') ? 1 : 0));
    if (f.atlas) { eyes2D(f, g, F); f.atlas.A.ctx.drawImage(f.cv, f.region.x, f.region.y); f.atlas.tex.needsUpdate = true; }
    else f.tex.needsUpdate = true;
  }

  // Painted eyes for extras (the same lid and iris shapes the eye shader draws), open, looking slightly off.
  function eyes2D(f, g, F) {
    const L = f.L, lk = f.look, S = f.S;
    if (lk.blind) return;
    const iris = rgbOf(lk.iris || '#5a4632'), red = Math.max(F.red || 0, lk.red || 0, f.decals.has('feed') ? 0.9 : 0), tilt = lk.tilt ?? 0.04;
    const lidT = clamp(F.lT - (lk.squint || 0), 0.15, 1.4), lidB = clamp(F.lB + (lk.lidB || 0), 0, 1);
    for (const [E, sd] of [[L.eyeL, 1], [L.eyeR, -1]]) {
      const cx = E[0] * S, cy = (1 - E[1]) * S, hw = L.eyeW * L.su * S, hh = L.eyeW * L.sv * S;
      const up = x => 0.4 * Math.pow(Math.max(0, 1 - ((x + 0.14) / 1.02) ** 2), 0.62) + tilt * x, lo = x => -0.25 * Math.pow(Math.max(0, 1 - ((x - 0.05) / 1) ** 2), 0.95) + tilt * 0.6 * x;
      const yT = x => { const c = lo(x) + (up(x) - lo(x)) * 0.28; return c + (up(x) - c) * lidT; }, yB = x => { const c = lo(x) + (up(x) - lo(x)) * 0.28; return lo(x) + (c - lo(x)) * lidB * 0.55; };
      const X = x => cx + sd * x * hw;
      g.save(); g.beginPath();
      for (let i = 0; i <= 16; i++) { const x = -1 + i / 8; g.lineTo(X(x), cy - yT(x) * hh); }
      for (let i = 16; i >= 0; i--) { const x = -1 + i / 8; g.lineTo(X(x), cy - yB(x) * hh); }
      g.closePath(); g.clip();
      const scl = mix([205, 195, 182], [200, 90, 85], red * 0.5), gr = g.createRadialGradient(cx, cy, 0, cx, cy, hw);
      gr.addColorStop(0, css(scl)); gr.addColorStop(1, css(mul(scl, 0.62))); g.fillStyle = gr; g.fillRect(cx - hw * 1.2, cy - hh, hw * 2.4, hh * 2);
      const ix = X(f.fixGaze[0]), iy = cy - f.fixGaze[1] * hh, ir = 0.45;
      g.fillStyle = css(mul(iris, 0.45)); g.beginPath(); g.ellipse(ix, iy, ir * hw, ir * hh, 0, 0, 7); g.fill();
      g.fillStyle = css(iris); g.beginPath(); g.ellipse(ix, iy, ir * hw * 0.82, ir * hh * 0.82, 0, 0, 7); g.fill();
      g.fillStyle = 'rgb(8,6,6)'; g.beginPath(); g.ellipse(ix, iy, ir * 0.4 * hw, ir * 0.4 * hh, 0, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.ellipse(ix - sd * 0.13 * hw, iy - 0.15 * hh, 0.07 * hw, 0.07 * hh, 0, 0, 7); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(cx - hw * 1.2, cy - yT(0) * hh - hh, hw * 2.4, hh * 1.15);
      g.restore();
      g.strokeStyle = css(rgbOf(lk.lash || '#1a1410'), 0.9); g.lineWidth = Math.max(1, hh * 0.12); g.lineCap = 'round';
      g.beginPath(); for (let i = 0; i <= 16; i++) { const x = -1 + i / 8; g.lineTo(X(x), cy - yT(x) * hh); } g.stroke();
    }
  }

  function brows(f, g, F, sk) {
    const L = f.L, lk = f.look, bc = rgbOf(lk.browColor || (lk.hair && lk.hair.color) || '#3a2a1e');
    const thick = (lk.browThick ?? (lk.sex === 'f' ? 0.75 : 1)) * 0.0052, R = rng(lk.seed * 5 + 1 || 5), n = f.S >= 512 ? 190 : 90;
    for (const sd of [1, -1]) {
      const inH = sd > 0 ? F.bIL : F.bIR, outH = sd > 0 ? F.bOL : F.bOR, fur = F.fur;
      const by = L.browY + (lk.browY || 0), arch = lk.browArch ?? 0.0042;
      const p0 = [sd * (0.0105 - fur * 0.0028), by - 0.0008 + inH * 0.0058 - fur * 0.0022];
      const p1 = [sd * 0.03, by + arch + (inH * 0.35 + outH * 0.65) * 0.005];
      const p2 = [sd * 0.051, by - 0.0014 + outH * 0.006];
      const N = 24, pts = [];
      for (let i = 0; i <= N; i++) { const t = i / N, a = (1 - t) * (1 - t), b = 2 * t * (1 - t), c = t * t; pts.push([a * p0[0] + b * p1[0] + c * p2[0], a * p0[1] + b * p1[1] + c * p2[1], t]); }
      const wAt = t => thick * (t < 0.15 ? lerp(0.8, 1, t / 0.15) : lerp(1, 0.3, (t - 0.15) / 0.85));
      g.beginPath();
      pts.forEach(([x, y, t], i) => { const [X, Y] = P(f, x, y + wAt(t) * 0.55); i ? g.lineTo(X, Y) : g.moveTo(X, Y); });
      for (let i = N; i >= 0; i--) { const [x, y, t] = pts[i]; const [X, Y] = P(f, x, y - wAt(t) * 0.45); g.lineTo(X, Y); }
      g.closePath(); g.fillStyle = css(mix(bc, sk, 0.25), 0.3); g.fill(); g.strokeStyle = css(mix(bc, sk, 0.25), 0.14); g.lineWidth = f.S / 512 * 2.6; g.stroke();
      const nick = lk.browNick && sd === (lk.browNick > 0 ? 1 : -1);
      for (let k = 0; k < n; k++) {
        const t = Math.pow(R(), 0.9), i = Math.min(N - 1, Math.floor(t * N)), [x, y] = pts[i], [x2, y2] = pts[i + 1];
        if (nick && t > 0.55 && t < 0.64) continue;
        const w = wAt(t), o = (R() - 0.5) * w;
        const tx = x2 - x, ty = y2 - y, tl = Math.hypot(tx, ty) || 1;
        const bx = x + (-ty / tl) * o * sd, byy = y + (tx / tl) * o * sd;
        const up = t < 0.18 ? 0.85 : 0.22 + 0.2 * R(), len = w * (0.9 + R() * 0.7);
        const dx = (tx / tl) * Math.cos(up) * len, dy = Math.sin(up) * len;
        g.strokeStyle = css(mul(bc, 0.7 + R() * 0.55), 0.3 + R() * 0.45); g.lineWidth = f.S / 512 * (0.6 + R() * 0.5);
        const [X0, Y0] = P(f, bx - dx * 0.5, byy - dy * 0.5 - w * 0.1), [X1, Y1] = P(f, bx + dx * 0.5, byy + dy * 0.5);
        g.beginPath(); g.moveTo(X0, Y0); g.lineTo(X1, Y1); g.stroke();
      }
      if (nick) { const [x, y] = pts[Math.round(N * 0.595)]; line(g, f, [[x - 0.0012, y - thick * 0.7], [x + 0.0008, y + thick * 0.7]], 0.0012, mix(sk, [255, 228, 218], 0.35), 0.95); }
    }
  }

  // Lips: soft-edged vermilion over the sculpted lips; the opening shows teeth and tongue.
  function mouth(f, g, F, sk) {
    const L = f.L, lk = f.look, my = L.mouthY, lips = (lk.head && lk.head.lips) || 1, fem = L.P.fem;
    const dark = (sk[0] + sk[1] + sk[2]) / 765 < 0.45;
    const lc = lk.lipColor ? rgbOf(lk.lipColor) : dark ? mix(sk, [95, 42, 48], 0.35) : mix(sk, [180, 88, 90], fem ? 0.42 : 0.3);
    const hw = L.mouthW * F.wd * (1 + 0.1 * Math.max(0, (F.sL + F.sR) / 2)) * (1 - F.pr * 0.08);
    const op = clamp(F.op, 0, 1), band = 0.0024;
    const cL = [hw + Math.max(0, F.sL) * 0.002, my + F.sL * 0.0045], cR = [-(hw + Math.max(0, F.sR) * 0.002), my + F.sR * 0.0045];
    const upT = 0.0088 * lips * (1 - F.pr * 0.25) * (1 - Math.max(0, F.sL + F.sR) * 0.12) + F.up * 0.002;
    const loT = 0.0102 * lips * (1 - F.pr * 0.2) + F.lo * 0.002;
    const oT = op * band + F.up * 0.0012, oB = op * band * 1.4 - F.fv * 0.0012;
    const rnd = F.wd < 0.85 ? (0.85 - F.wd) * 1.6 : 0;
    const mid = (cL[1] + cR[1]) / 2;
    const inTop = quad(cR, [0, my + oT * 2 - (mid - my) * 0.25 + rnd * oT], cL);
    const inBot = quad(cL, [0, my - oB * 2 - (mid - my) * 0.6 - rnd * oB], cR);
    const bow = 0.0058 * (lk.bow ?? 1), top = my + upT + oT;
    const outTop = [cR, ...quad([cR[0] * 0.72, cR[1] + upT * 0.5 + oT * 0.6], [-bow * 1.1, top], [-bow, top], 3).slice(0, 3), [-bow * 0.45, top - upT * 0.05], [0, top - upT * 0.14], [bow * 0.45, top - upT * 0.05], [bow, top], ...quad([bow, top], [bow * 1.1, top], [cL[0] * 0.72, cL[1] + upT * 0.5 + oT * 0.6], 3).slice(1), cL];
    const outBot = quad(cL, [0, my - loT * 2 - oB * 2 - Math.min(0, F.sL + F.sR) * 0.002 + rnd * 0.001], cR, 10);
    const path = pts => { g.beginPath(); pts.forEach((p, i) => { const [X, Y] = P(f, p[0], p[1]); i ? g.lineTo(X, Y) : g.moveTo(X, Y); }); g.closePath(); };
    if (op > 0.02 || F.fv > 0.2) {                                         // the opening: dark, upper teeth, lower teeth + tongue
      path([...inTop, ...inBot]); g.fillStyle = 'rgb(40,14,14)'; g.fill();
      g.save(); path([...inTop, ...inBot]); g.clip();
      if (F.th > 0.05) {
        const [X0, Y0] = P(f, -hw * 0.8, my + oT), [X1, Y1] = P(f, hw * 0.8, my + oT - Math.min(oT * 2, 0.003) - 0.0004 * F.fv);
        const gt = g.createLinearGradient(X0, 0, X1, 0); gt.addColorStop(0, 'rgba(150,140,125,0.9)'); gt.addColorStop(0.3, 'rgba(236,230,214,1)'); gt.addColorStop(0.7, 'rgba(236,230,214,1)'); gt.addColorStop(1, 'rgba(150,140,125,0.9)');
        g.globalAlpha = 0.3 + F.th * 0.7; g.fillStyle = gt; g.fillRect(X0, Y0 - 3, X1 - X0, Y1 - Y0 + 3); g.globalAlpha = 1;
        g.strokeStyle = 'rgba(110,95,85,0.3)'; g.lineWidth = 1;
        for (let i = -3; i <= 3; i++) { const [X, Y] = P(f, i * hw * 0.19, my + oT); g.beginPath(); g.moveTo(X, Y); g.lineTo(X, Y1); g.stroke(); }
        if (lk.braces) { g.fillStyle = 'rgba(190,195,200,0.95)'; const yy = (Y0 + Y1) / 2; g.fillRect(X0, yy - 1, X1 - X0, 2); for (let i = -3; i <= 3; i++) { const [X] = P(f, i * hw * 0.19, 0); g.fillRect(X - 2, yy - 2.5, 4, 5); } }
      }
      if (op > 0.3) {
        const [X0, Y0] = P(f, -hw * 0.6, my - oB * 0.9), [X1] = P(f, hw * 0.6, 0);
        g.fillStyle = 'rgba(215,205,190,0.55)'; g.fillRect(X0, Y0, X1 - X0, px(f, 0.0016));
        soft(g, f, 0, my - oB * 1.4, hw * 0.55, oB * 0.6, [165, 68, 72], 0.9);
      }
      g.restore();
    }
    path([...outTop, ...inTop.slice().reverse()]);
    const [, Yt] = P(f, 0, top), [, Ym] = P(f, 0, my + oT);
    let gr = g.createLinearGradient(0, Yt, 0, Ym); gr.addColorStop(0, css(mix(lc, sk, 0.35), 0.9)); gr.addColorStop(0.5, css(mul(lc, 0.92))); gr.addColorStop(1, css(deep(lc, 0.72)));
    g.fillStyle = gr; g.fill();
    path([...inBot, ...outBot.slice().reverse()]);
    const [, Yb] = P(f, 0, my - oB), [, Yl] = P(f, 0, my - oB - loT * 1.9);
    gr = g.createLinearGradient(0, Yb, 0, Yl); gr.addColorStop(0, css(deep(lc, 0.8))); gr.addColorStop(0.35, css(mix(lc, [255, 225, 220], 0.1))); gr.addColorStop(0.8, css(mix(lc, sk, 0.3), 0.9)); gr.addColorStop(1, css(mix(lc, sk, 0.6), 0.6));
    g.fillStyle = gr; g.fill();
    line(g, f, outBot, 0.0012, mix(lc, sk, 0.55), 0.35);                                                // soft outer edges
    line(g, f, outTop, 0.001, mix(lc, sk, 0.5), 0.3);
    line(g, f, outTop.slice(2, -2), 0.0007, lite(sk, 0.3), 0.3, 0.0004);                                    // the white roll above the upper lip
    if (op < 0.05) line(g, f, inTop, 0.0008 + F.pr * 0.0004, [55, 22, 22], 0.55 + F.pr * 0.2, 0.0003);
    for (const c of [cL, cR]) soft(g, f, c[0] * 1.02, c[1], 0.0026, 0.0022, [70, 28, 28], 0.4);
    soft(g, f, 0, my - oB - loT * 0.7, hw * 0.32, 0.0014, [255, 238, 232], 0.22 + (F.wet > 0 ? 0.2 : 0));
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
    if (f.morph && lod < 2) {                                                 // the sculpt follows the expression
      const m = f.head.morphTargetInfluences, M = f.morph, sm = Math.max(0, out.sL + out.sR) / 2;
      m[M.smileL] = clamp(out.sL, 0, 1); m[M.smileR] = clamp(out.sR, 0, 1); m[M.frown] = clamp(-(out.sL + out.sR) / 2, 0, 1);
      m[M.browIn] = clamp((out.bIL + out.bIR) / 2, 0, 1); m[M.browOut] = clamp((out.bOL + out.bOR) / 2, 0, 1);
      m[M.fur] = clamp(out.fur + Math.max(0, -(out.bIL + out.bIR) / 2) * 0.5, 0, 1);
      m[M.pucker] = clamp(out.pr * 0.8 + (1 - out.wd) * 2.2, 0, 1) * (1 - sm * 0.6); m[M.wide] = clamp((out.wd - 1) * 5, 0, 1);
    }
    // blinks
    if (!f.noBlink) {
      f.blinkT -= dt;
      if (f.blinkT <= 0 && f.blinkP < 0) { f.blinkP = 0; }
      if (f.blinkP >= 0) { f.blinkP += dt; if (f.blinkP > 0.24) { f.blinkP = -1; f.blinkT = 2 + Math.random() * 4 * (F.tears > 0.5 ? 0.6 : 1); } }
    } else f.blinkP = -1;
    const bp = f.blinkP < 0 ? 0 : f.blinkP < 0.07 ? f.blinkP / 0.07 : f.blinkP < 0.11 ? 1 : 1 - (f.blinkP - 0.11) / 0.13;
    const lidT = F.lT * (1 - bp) * (f.look.lidT ?? 1), lidB = clamp(F.lB + (f.look.lidB || 0), 0, 1);
    const sq = f.look.squint || 0;
    if (f.mat) f.u.uLid.value.set(clamp(lidT - sq, 0, 1.4), lidB, clamp(lidT - sq, 0, 1.4), lidB);
    // gaze: target + darts + emote bias
    const d = f.dart;
    d.t -= dt;
    if (d.t <= 0) { d.t = 0.35 + Math.random() * (talk ? 1.2 : 2); d.x = (Math.random() - 0.5) * 0.12; d.y = (Math.random() - 0.5) * 0.08; if (Math.random() < 0.12) blink(f); }
    const gx = clamp((gaze ? gaze.x : 0) + d.x + F.gX * 0.5, -0.55, 0.55), gy = clamp((gaze ? gaze.y : 0) + d.y + F.gY * 0.3 - (1 - Math.min(1, lidT)) * 0.08, -0.32, 0.3);
    f.gaze.x += (gx - f.gaze.x) * (1 - Math.exp(-30 * dt)); f.gaze.y += (gy - f.gaze.y) * (1 - Math.exp(-30 * dt));
    if (f.mat) {
      f.u.uGaze.value.set(f.gaze.x, f.gaze.y);
      f.u.uWet.value = Math.max(F.wet, f.wetDecal ? 1 : 0, f.decals.has('feed') ? 1 : 0);
      f.u.uRed.value = Math.max(F.red, f.look.red || 0, f.decals.has('feed') ? 0.9 : 0, f.decals.has('fever') ? 0.4 : 0);
      f.u.uFeed.value = f.decals.has('feed') ? 1 : 0;
    }
    // redraw when the painted expression/mouth changed (throttled)
    f.since += dt;
    if (lod > 1 && !(f.atlas && f.baseDirty)) return;
    if (f.atlas && f.baseDirty) { if (budget <= 0) return; budget--; }      // extras' first paints are spread over frames
    let diff = 0; for (const k of ['op', 'wd', 'pr', 'th', 'fv', 'sL', 'sR', 'bIL', 'bIR', 'bOL', 'bOR', 'fur', 'ck', 'bl', 'tears', 'up', 'lo']) diff += Math.abs((out[k] || 0) - (f.last[k] || 0));
    if (f.baseDirty) { paintBase(f); f.dirty = true; }
    const minGap = f.atlas ? 0.2 : lod > 0 ? 0.15 : 1 / 24;
    if ((f.dirty || diff > (f.atlas ? 0.08 : 0.04)) && (f.since >= minGap || f.baseDirty)) {
      const keep = f.F; f.F = out; paintDyn(f); f.F = keep;
      Object.assign(f.last, out); f.dirty = false; f.since = 0;
    }
  }
  let budget = 3;
  const frame = () => { budget = 3; };
  function dispose(f) { if (f.tex) f.tex.dispose(); if (f.mat) f.mat.dispose(); }
  return { create, emote, speak, blink, decal, update, frame, dispose, EMOTES: E };
})();
