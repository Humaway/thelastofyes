// ============================================================================
// Anim — procedural animation for Chars (chars agent, internal to Chars).
// A pose is a Float32Array of joint channels in "anatomical" units (radians; flex = forward, abduct = out,
// twist = external), mirrored per side when applied. Layers per frame:
//   base pose (blended transitions) -> locomotion (legs/hips + arm swing) -> idle life (breath, weight shift)
//   -> emote body offsets -> gesture overlay (masked) -> look-at -> apply to bones -> IK / paired anchors -> springs
//   Anim.CH (channel indices) · Anim.POSES · Anim.GESTURES · Anim.frame(c, dt) · Anim.post(c, dt) · Anim.springs(c, dt)
// ============================================================================
const Anim = (() => {
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const TAU = Math.PI * 2;
  const V3 = THREE.Vector3, Q = THREE.Quaternion;

  // ---- channels ------------------------------------------------------------------------------------
  const CH = { root: 0, hips: 3, spine: 6, chest: 9, neck: 12, head: 15, jaw: 18 };
  const SIDE = 21, SB = { L: 19, R: 19 + SIDE };
  const SO = { clav: 0, arm: 2, fore: 5, hand: 7, fing: 9, fing2: 10, thumb: 11, thumb2: 12, thigh: 13, knee: 16, foot: 17, toe: 19, spare: 20 };
  for (const S of 'LR') for (const k in SO) CH[k + S] = SB[S] + SO[k];
  const N = 19 + SIDE * 2;
  const pose = () => new Float32Array(N);

  // Build a pose from a readable spec. Side-agnostic keys apply to both sides (arm, fore...), keys ending in L/R to one.
  // { root:[x,y,z], hips:[p,y,r], spine, chest, neck, head, jaw, clav:[elev,prot], arm:[flex,abd,twist], fore:[bend,twist],
  //   hand:[flex,dev], fing, fing2, thumb, thumb2, thigh:[flex,abd,twist], knee, foot:[flex,roll], toe }
  function mk(spec, base) {
    const p = base ? Float32Array.from(base) : pose();
    for (const k in spec) {
      const v = spec[k], arr = Array.isArray(v) ? v : [v];
      const sides = k.endsWith('L') && CH[k] !== undefined ? [k] : k.endsWith('R') && CH[k] !== undefined ? [k] : CH[k + 'L'] !== undefined ? [k + 'L', k + 'R'] : [k];
      for (const kk of sides) { const i = CH[kk]; if (i === undefined) continue; for (let j = 0; j < arr.length; j++) p[i + j] = arr[j]; }
    }
    return p;
  }
  // masks: which channels a layer owns
  const range = (a, b) => { const m = new Float32Array(N); for (let i = a; i < b; i++) m[i] = 1; return m; };
  const MASK = {
    upper: (() => { const m = range(CH.spine, CH.jaw + 1); for (const S of 'LR') for (let i = SB[S]; i < SB[S] + SO.thigh; i++) m[i] = 1; return m; })(),
    arms: (() => { const m = pose(); for (const S of 'LR') for (let i = SB[S]; i < SB[S] + SO.thigh; i++) m[i] = 1; return m; })(),
    armR: (() => { const m = pose(); for (let i = SB.R; i < SB.R + SO.thigh; i++) m[i] = 1; return m; })(),
    armL: (() => { const m = pose(); for (let i = SB.L; i < SB.L + SO.thigh; i++) m[i] = 1; return m; })(),
  };

  // ---- base poses ----------------------------------------------------------------------------------------
  // flags: loco (locomotes: legs from the gait), swing (arms swing), lower:false (pose owns the legs even when moving)
  const STAND = {
    spine: [0.03, 0, 0], chest: [-0.03, 0, 0], neck: [0.12, 0, 0], head: [-0.1, 0, 0],
    clav: [0, 0], arm: [0.04, -0.07, 0.05], fore: [0.24, 0.25], hand: [0.1, 0.05], fing: 0.3, fing2: 0.35, thumb: 0.25, thumb2: 0.2,
    thigh: [0, 0.03, 0.06], knee: 0.05, foot: [0.0, 0],
  };
  const P0 = mk(STAND);
  const POSES = {
    stand: { p: P0, loco: 1, swing: 1 },
    crouch: { p: mk({ root: [0, -0.3, -0.03], hips: [0.25, 0, 0], spine: [0.18, 0, 0], chest: [0.08, 0, 0], neck: [-0.1, 0, 0], head: [-0.22, 0, 0], arm: [0.45, 0.05, 0.1], fore: [0.8, 0.3], thigh: [1.05, 0.12, 0.1], knee: 1.75, foot: [0.8, 0] }, P0), loco: 1, swing: 0.4, crouch: 1 },
    hands_up: { p: mk({ arm: [0.25, 1.35, 0.9], fore: [1.35, 0.4], hand: [-0.3, 0], fing: 0.05, fing2: 0.05, thumb: 0.1, chest: [-0.06, 0, 0], clav: [0.12, 0] }, P0), loco: 1, swing: 0 },
    phone: { p: mk({ neck: [0.34, 0, 0], head: [0.2, 0, 0], chest: [0.08, 0, 0], spine: [0.06, 0, 0], armR: [0.5, 0.05, -0.5], foreR: [1.9, 0.6], handR: [0.1, 0.1], fingR: 0.9, fing2R: 0.7, thumbR: 0.1, armL: [0.1, -0.02, 0.1], foreL: [0.6, 0.4] }, P0), loco: 1, swing: 0.2, ik: { R: ['head', [-0.01, -0.12, 0.26]] }, palm: { R: 'eyes' } },
    phone_ear: { p: mk({ armR: [0.25, 0.42, 0.3], foreR: [2.45, 0.9], handR: [0.2, -0.2], fingR: 0.75, fing2R: 0.6, head: [-0.02, 0, -0.08] }, P0), loco: 1, swing: 0.3, ik: { R: ['head', [-0.085, -0.03, 0.01]] }, palm: { R: 'head' } },
    aim: { p: mk({ chest: [0.02, 0.35, 0], spine: [0.02, 0.2, 0], neck: [0.05, -0.3, 0], head: [-0.05, -0.2, 0.05], armR: [1.35, 0.25, 0.2], foreR: [0.35, 0.4], handR: [0.0, 0.1], fingR: 0.8, fing2R: 0.8, armL: [1.2, -0.35, 0.2], foreL: [0.9, 1.2], handL: [0.2, 0], fingL: 0.7, fing2L: 0.6 }, P0), loco: 1, swing: 0 },
    carry: { p: mk({ spine: [-0.06, 0, 0], chest: [-0.06, 0, 0], neck: [0.2, 0, 0], head: [0.05, 0, 0], arm: [0.6, 0.12, 0.2], fore: [1.3, 1.1], hand: [0.1, 0], fing: 0.5, fing2: 0.3 }, P0), loco: 1, swing: 0, carry: 1 },
    sit: { p: mk({ root: [0, -0.46, -0.04], hips: [-0.12, 0, 0], spine: [0.1, 0, 0], chest: [0.05, 0, 0], neck: [0.1, 0, 0], head: [-0.05, 0, 0], arm: [0.45, -0.05, 0.1], fore: [0.95, 0.9], hand: [0.25, 0], thigh: [1.55, 0.1, 0.12], knee: 1.5, foot: [0.05, 0] }, P0), seat: true },
    sit_ground: { p: mk({ root: [0, -0.77, -0.05], hips: [-0.22, 0, 0], spine: [0.22, 0, 0], chest: [0.12, 0, 0], neck: [0.12, 0, 0], head: [-0.06, 0, 0], arm: [0.55, 0.12, 0.3], fore: [0.9, 1.0], hand: [0.2, 0], thigh: [1.85, 0.55, 0.6], knee: 2.45, foot: [0.5, 0.2] }, P0), seat: true },
    sit_car: { p: mk({ root: [0, -0.52, -0.02], hips: [-0.32, 0, 0], spine: [0.08, 0, 0], chest: [0.05, 0, 0], neck: [0.2, 0, 0], head: [-0.05, 0, 0], arm: [0.35, -0.05, 0.1], fore: [1.0, 1.0], hand: [0.2, 0], thigh: [1.45, 0.12, 0.1], knee: 1.2, foot: [0.1, 0] }, P0), seat: true },
    // sit_car_turn: a front passenger twisted round to his right to look into the back seat, legs still in the footwell
    sit_car_turn: { p: mk({ root: [0, -0.52, -0.02], hips: [-0.3, -0.12, 0], spine: [0.06, -0.35, 0.04], chest: [0.02, -0.5, 0.06], neck: [0.12, -0.38, 0], head: [-0.02, -0.35, 0.05], armL: [0.35, 0.05, 0.1], foreL: [1.1, 1.0], hand: [0.2, 0], thighL: [1.42, 0.02, 0.08], thighR: [1.42, 0.2, 0.12], knee: 1.25, foot: [0.1, 0] }, P0), seat: true },
    drive: { p: mk({ root: [0, -0.52, -0.02], hips: [-0.32, 0, 0], spine: [0.08, 0, 0], chest: [0.05, 0, 0], neck: [0.2, 0, 0], head: [-0.05, 0, 0], arm: [0.95, 0.12, 0.1], fore: [0.9, 0.3], hand: [0.1, 0.3], fing: 0.9, fing2: 0.8, thumb: 0.5, thigh: [1.4, 0.1, 0.1], knee: 1.1, foot: [0.2, 0] }, P0), seat: true },
    kneel: { p: mk({ root: [0, -0.43, -0.02], hips: [0.05, 0, 0], spine: [0.08, 0, 0], chest: [0.04, 0, 0], neck: [0.15, 0, 0], head: [0.0, 0, 0], arm: [0.25, -0.02, 0.1], fore: [0.5, 0.5], thigh: [0.12, 0.06, 0.1], knee: 1.72, foot: [-1.3, 0] }, P0) },
    kneel_one: { p: mk({ root: [0, -0.34, 0.02], hips: [0.05, 0, 0], spine: [0.1, 0, 0], neck: [0.12, 0, 0], thighL: [1.45, 0.08, 0.05], kneeL: 1.5, footL: [0.05, 0], thighR: [0.0, 0.05, 0.1], kneeR: 1.65, footR: [-0.5, 0], toeR: 0.9, armL: [0.5, 0, 0.2], foreL: [1.2, 0.8], armR: [0.2, 0, 0.1], foreR: [0.4, 0.4] }, P0) },
    lie: { p: mk({ root: [0, -0.8, 0], hips: [-1.52, 0, 0], spine: [0.04, 0, 0], chest: [0.02, 0, 0.03], neck: [0.1, 0, 0], head: [0.05, 0.35, 0.05], armL: [0.3, 0.22, 0.2], foreL: [1.25, 0.4], handL: [0.2, 0], armR: [0.05, 0.38, 0.15], foreR: [0.35, 0.3], fing: 0.35, fing2: 0.3, thighL: [0.16, 0.16, 0.35], kneeL: 0.32, footL: [-0.3, 0.2], thighR: [0.04, 0.06, 0.2], kneeR: 0.12, footR: [-0.45, 0] }, P0) },
    dead: { p: mk({ root: [0, -0.82, 0.1], hips: [-1.52, 0.2, 0.3], spine: [0.1, 0.1, 0.1], chest: [0.05, 0.1, 0], neck: [0.2, 0.4, 0.2], head: [0.1, 0.5, 0.3], armL: [0.3, 0.7, 0.5], foreL: [0.6, 0.3], armR: [-0.2, 0.3, 0.2], foreR: [0.2, 0], fing: 0.5, thighL: [0.35, 0.1, 0.4], kneeL: 0.7, thighR: [0.05, 0.1, 0.1], kneeR: 0.1, foot: [-0.6, 0.2] }, P0) },
    carried: { p: mk({ root: [0, 0, 0], hips: [-0.78, 0, 0], spine: [0.16, 0, 0], chest: [0.1, -0.22, 0], neck: [0.28, -0.2, 0], head: [0.1, -0.25, 0.1], armL: [0.35, 0.2, 0.3], foreL: [1.25, 0.6], armR: [0.6, 0.1, 0.2], foreR: [1.4, 0.9], fing: 0.4, fing2: 0.3, thigh: [1.55, 0.08, 0], knee: 1.45, foot: [-0.3, 0] }, P0) },
    crawl: { p: mk({ root: [0, -0.42, 0.05], hips: [0.95, 0, 0], spine: [0.25, 0, 0], chest: [0.12, 0, 0], neck: [-0.35, 0, 0], head: [-0.4, 0, 0], arm: [1.25, 0.05, 0.1], fore: [0.2, 0.3], hand: [-1.0, 0], fing: 0.05, thigh: [0.55, 0.1, 0], knee: 1.95, foot: [-0.6, 0] }, P0), crawl: 1, loco: 1 },
    pin: { p: mk({ root: [0, -0.45, 0.1], hips: [0.6, 0, 0], spine: [0.35, 0, 0], chest: [0.2, 0, 0], neck: [-0.2, 0, 0], head: [-0.2, 0, 0], arm: [1.2, 0.1, 0.1], fore: [0.5, 0.4], thigh: [0.65, 0.4, 0.3], knee: 1.9, foot: [-0.6, 0] }, P0) },
    ride: { p: mk({ root: [0, 0, 0], hips: [-0.05, 0, 0], spine: [0.08, 0, 0], neck: [0.1, 0, 0], arm: [0.55, 0.05, 0.2], fore: [1.2, 0.6], hand: [0.3, 0.2], fing: 0.9, fing2: 0.8, thigh: [0.85, 0.55, 0.3], knee: 1.1, foot: [0.2, 0] }, P0) },
    sit_shoulders: { p: mk({ root: [0, 0, 0], hips: [-0.05, 0, 0], spine: [0.05, 0, 0], thigh: [1.45, 0.55, 0.3], knee: 1.4, foot: [-0.2, 0], arm: [0.7, 0.3, 0.2], fore: [1.3, 0.8], hand: [0.2, 0], fing: 0.7 }, P0) },
    // cradle: kneeling, sat back on his heels, knees apart, leaning over the child across his lap (Gest 'cradle' places her)
    cradle: { p: mk({ root: [0, -0.62, -0.1], hips: [0.1, 0, 0], spine: [0.18, 0.08, 0.06], chest: [0.08, 0.12, 0.1], neck: [-0.05, 0.08, 0], head: [-0.2, 0.1, 0], armL: [0.7, 0.35, 0.3], foreL: [1.5, 1.0], armR: [0.6, 0.1, 0.1], foreR: [1.3, 0.8], hand: [0.15, 0], fing: 0.45, fing2: 0.35, thumb: 0.3, thigh: [1.4, 0.3, 0.3], knee: 2.55, foot: [-1.45, 0] }, P0), seat: true },
    // cradled: across a lap, lying back with the head raised toward the holder; the right arm (toward him) limp at her side
    cradled: { p: mk({ hips: [-1.02, 0, 0], spine: [0.1, 0, 0], chest: [0.1, -0.05, 0], neck: [-0.02, -0.05, 0], head: [-0.3, 0.35, 0.08], armL: [0.2, 0.1, 0.1], foreL: [0.8, 0.5], armR: [0.15, 0.08, 0.1], foreR: [0.35, 0.3], fing: 0.35, fing2: 0.3, thumb: 0.2, thigh: [0.7, 0.06, 0.1], knee: 1.15, foot: [0.3, 0] }, P0) },
    feed: { p: mk({ spine: [0.12, 0, 0], chest: [0.12, 0, 0], neck: [0.3, 0, 0], head: [0.15, 0, 0], clav: [0.08, 0.1], arm: [0.85, 0.28, -0.35], fore: [1.85, 1.1], hand: [0.35, 0.1], fing: 0.75, fing2: 0.8, thumb: 0.3, thigh: [0.12, 0.06, 0.1], knee: 0.22, foot: [0.1, 0] }, P0), loco: 1, swing: 0.15, ik: { L: ['head', [0.06, -0.12, 0.2]], R: ['head', [-0.05, -0.1, 0.22]] }, palm: { L: 'eyes', R: 'eyes' } },
    // struggle_down: on his back, propped on the left elbow, head up, right arm reaching, one knee drawn up
    struggle_down: { p: mk({ root: [0, -0.8, 0], hips: [-1.5, 0, 0.05], spine: [0.28, 0, 0.04], chest: [0.24, 0.1, 0], neck: [0.28, 0.1, 0], head: [0.12, 0.15, 0], armL: [-0.55, 0.45, 0.2], foreL: [1.35, 0.2], handL: [-0.3, 0], armR: [0.85, 0.25, 0.3], foreR: [0.7, 0.6], fing: 0.35, fing2: 0.3, thighL: [0.95, 0.12, 0.25], kneeL: 1.55, footL: [0.4, 0], thighR: [0.12, 0.08, 0.15], kneeR: 0.25, footR: [-0.3, 0] }, P0) },
  };

  // ---- gait ------------------------------------------------------------------------------------------------
  // keyed curves over one leg's phase (0 = heel strike of that leg)
  function curve(keys, p) {
    p = ((p % 1) + 1) % 1;
    let i = 0; while (i < keys.length - 2 && p > keys[i + 1][0]) i++;
    const a = keys[i], b = keys[i + 1], t = (p - a[0]) / (b[0] - a[0]);
    return lerp(a[1], b[1], t * t * (3 - 2 * t));
  }
  const KNEE_W = [[0, 0.06], [0.1, 0.26], [0.3, 0.1], [0.5, 0.18], [0.62, 0.62], [0.74, 1.08], [0.88, 0.45], [1, 0.06]];
  const KNEE_R = [[0, 0.32], [0.14, 0.62], [0.32, 0.3], [0.44, 0.45], [0.6, 1.45], [0.74, 1.85], [0.88, 0.95], [1, 0.32]];
  const FOOT_W = [[0, 0.28], [0.1, 0], [0.42, 0], [0.6, -0.55], [0.7, -0.25], [0.86, 0.12], [1, 0.28]];
  const FOOT_R = [[0, 0.1], [0.12, 0], [0.3, -0.25], [0.42, -0.7], [0.6, -0.3], [0.85, 0.1], [1, 0.1]];

  function gait(c, P, dt) {
    const L = c.loco, sp = L.v, H = c.D.H, s = H / 1.75;
    const crouch = L.crouchW, carry = L.carryW, limp = L.limpW, crawl = L.crawl;
    const legLen = c.D.yHipJ;
    // turning in place drives small steps
    const turnStep = clamp(Math.abs(L.turnRate) * 0.35, 0, 0.7) * (1 - sstep(0.2, 0.6, sp));
    const vEff = Math.max(sp, turnStep);
    const stepsPerSec = (1.35 + 0.38 * vEff) * (crouch ? 0.85 : 1) * (1.75 / H) ** 0.3 * (carry ? 0.92 : 1);
    let rate = stepsPerSec / 2;
    if (limp > 0) { const ph = L.phase % 1; rate *= lerp(1, ph >= 0.5 && ph < 0.8 ? 1.6 : 0.82, limp); }
    L.phase = (L.phase + rate * dt) % 1;
    const move = sstep(0.04, 0.4, vEff);
    L.moveW = move;
    if (move <= 0.001) return;
    const run = sstep(1.9, 3.3, sp), spr = sstep(3.8, 5.6, sp);
    const stepLen = vEff / stepsPerSec;
    const A = Math.asin(clamp(stepLen / (2 * legLen), 0, 0.9)) * lerp(0.95, 0.8, run) * (turnStep > sp ? 0.5 : 1);
    const st = lerp(0.6, 0.38, run);
    const ph = L.phase;
    const a = Math.atan2(L.dir.x, L.dir.z);                       // movement direction relative to facing
    const ca = Math.cos(a), sa = Math.sin(a);
    for (const [S, sd, off] of [['L', 1, 0], ['R', -1, 0.5]]) {
      const p = (ph + off) % 1;
      const q = p < st ? 0.5 * p / st : 0.5 + 0.5 * (p - st) / (1 - st);
      let th = A * Math.cos(TAU * q) + lerp(0.03, 0.18, run);
      let kn = lerp(curve(KNEE_W, p), curve(KNEE_R, p) + spr * 0.45 * Math.max(0, Math.sin(TAU * (p - 0.55))), run) * lerp(0.55, 1, sstep(0.2, 1.2, vEff));
      if (limp > 0 && S === 'R') { kn *= lerp(1, 0.45, limp); th *= lerp(1, 0.75, limp); }
      const wp = lerp(curve(FOOT_W, p), curve(FOOT_R, p), run);
      const flex = th * ca, abd = th * sa * 0.6 * sd;
      P[CH['thigh' + S]] = lerp(P[CH['thigh' + S]], P[CH['thigh' + S]] * (crouch ? 1 : 0) + flex + (crouch ? 0 : 0), move);
      P[CH['thigh' + S] + 1] = lerp(P[CH['thigh' + S] + 1], P[CH['thigh' + S] + 1] + abd, move);
      P[CH['knee' + S]] = lerp(P[CH['knee' + S]], P[CH['knee' + S]] + kn, move);
      const shinPitch = (P[CH['thigh' + S]]) - P[CH['knee' + S]];
      const footFlex = -shinPitch + wp * (crouch ? 0.5 : 1);
      P[CH['foot' + S]] = lerp(P[CH['foot' + S]], footFlex, move * (crawl ? 0 : 1));
      P[CH['toe' + S]] = lerp(P[CH['toe' + S]], Math.max(0, -wp) * 0.9 * (p > 0.4 && p < 0.68 ? 1 : 0), move);
      // arm swing (opposite leg)
      const sw = c.basePose.swing ?? 1;
      if (sw > 0) {
        const as = (lerp(0.22, 0.5, run) + spr * 0.25) * sw * clamp(vEff / 1.4, 0.3, 1.3) * (crouch ? 0.5 : 1);
        const arm = -as * Math.cos(TAU * q) + lerp(0, 0.1, run);
        P[CH['arm' + S]] += arm * move;
        P[CH['arm' + S] + 1] += lerp(0, 0.08, run) * move;
        P[CH['fore' + S]] += (lerp(0.1, 1.15, run) + spr * 0.25 + Math.max(0, arm) * 0.4) * move * sw;
        P[CH['fing' + S]] += run * 0.4 * move * sw;
      }
    }
    // pelvis & torso
    const bob = lerp(0.022, 0.05, run) * clamp(vEff / 1.4, 0.3, 1.2) * s * (crouch ? 0.5 : 1) * (carry ? 1.3 : 1);
    P[CH.root + 1] += (run > 0.5 ? bob * Math.cos(TAU * 2 * (ph - 0.35)) : -bob * Math.cos(TAU * 2 * ph)) * move - lerp(0, 0.03, run) * s * move;
    P[CH.root] += 0.018 * s * Math.sin(TAU * ph) * move * (1 - run * 0.6);
    P[CH.hips + 1] += -lerp(0.09, 0.14, run) * Math.cos(TAU * ph) * move * ca;
    P[CH.hips + 2] += 0.05 * Math.sin(TAU * ph) * move * (1 - run * 0.5);
    P[CH.chest + 1] += lerp(0.1, 0.16, run) * Math.cos(TAU * ph) * move;
    P[CH.head + 1] -= lerp(0.08, 0.12, run) * Math.cos(TAU * ph) * move * 0.8;
    const lean = (lerp(0.03, 0.12, run) + spr * 0.14) * ca * (carry ? -0.5 : 1);
    P[CH.spine] += lean * move * 0.6; P[CH.chest] += lean * move * 0.4; P[CH.neck] -= lean * move * 0.5; P[CH.head] -= lean * move * 0.4;
    if (limp > 0) {                                                   // lurch over the good leg, hip hike on the bad one
      const bad = Math.max(0, Math.sin(TAU * (ph - 0.5)));
      P[CH.chest + 2] += 0.12 * limp * (bad - 0.3) * move; P[CH.hips + 2] -= 0.08 * limp * bad * move; P[CH.root + 1] -= 0.03 * s * limp * bad * move;
      P[CH.neck] += 0.08 * limp * bad * move;
    }
    if (crawl) {                                                       // hands and knees: arms alternate with the opposite leg
      for (const [S, off] of [['L', 0.5], ['R', 0]]) { const p = (ph + off) % 1; P[CH['arm' + S]] += 0.35 * Math.cos(TAU * p) * move; P[CH['fore' + S]] += 0.25 * Math.max(0, Math.sin(TAU * p)) * move; }
    }
  }

  // ---- idle life ------------------------------------------------------------------------------------------
  function idle(c, P, dt, still) {
    const I = c.idle, t = c.t, s = c.D.s;
    const br = I.breath;                                                  // breathing rate rises after exertion
    I.bph = (I.bph + dt * br) % 1;
    const b = Math.sin(TAU * I.bph);
    P[CH.chest] -= 0.014 * b; P[CH.spine] -= 0.006 * b; P[CH.neck] += 0.01 * b; P[CH.clavL] += 0.012 * b; P[CH.clavR] += 0.012 * b;
    P[CH.armL + 1] += 0.008 * b; P[CH.armR + 1] += 0.008 * b;
    if (!still) return;
    // weight shift
    I.wt -= dt;
    if (I.wt <= 0) { I.wt = 4 + Math.random() * 5; I.wTarget = [-1, -0.5, 0.5, 1][(Math.random() * 4) | 0] * (c.def.fidget ?? 1); }
    I.w += (I.wTarget - I.w) * (1 - Math.exp(-1.6 * dt));
    const w = I.w * still;
    P[CH.root] += 0.022 * s * w; P[CH.hips + 2] -= 0.045 * w; P[CH.chest + 2] += 0.03 * w; P[CH.neck + 2] += 0.015 * w;
    const free = w > 0 ? 'R' : 'L', aw = Math.abs(w);
    P[CH['knee' + free]] += 0.18 * aw; P[CH['thigh' + free]] += 0.06 * aw; P[CH['foot' + free]] += 0.06 * aw; P[CH['thigh' + free] + 1] += 0.03 * aw;
    P[CH.root + 1] -= 0.006 * s * aw;
    // slow sway
    P[CH.spine + 2] += 0.01 * Math.sin(t * 0.37 + I.seed) * still; P[CH.hips + 1] += 0.02 * Math.sin(t * 0.23 + I.seed) * still;
  }

  // ---- emote body offsets + talking head motion ----------------------------------------------------------------
  function emoteBody(c, P, dt) {
    const f = c.face; if (!f) return;
    const F = f.F;
    P[CH.head] += F.hP * 0.6; P[CH.neck] += F.hP * 0.5; P[CH.head + 2] += F.hR; P[CH.head + 1] += F.hY * (c.lookW > 0.5 ? 0.3 : 1);
    P[CH.clavL] += F.sh * 0.12; P[CH.clavR] += F.sh * 0.12;
    P[CH.chest] += F.sag * 0.1; P[CH.neck] += F.sag * 0.08; P[CH.clavL] -= F.sag * 0.05; P[CH.clavR] -= F.sag * 0.05;
    if (f.emoteName === 'laugh') { const k = Math.max(0, Math.sin(c.t * 14)) * 0.5; P[CH.chest] -= k * 0.05; P[CH.head] -= k * 0.06; P[CH.clavL] += k * 0.04; P[CH.clavR] += k * 0.04; }
    if (f.emoteName === 'crying') { const k = Math.max(0, Math.sin(c.t * 9 + Math.sin(c.t * 2.3) * 2)) * 0.5; P[CH.chest] += k * 0.035; P[CH.clavL] += k * 0.05; P[CH.clavR] += k * 0.05; P[CH.head] += k * 0.03; }
    // talking: small nods and head drift with the syllables, brow flashes on emphasis
    const e = f.energy, em = f.emph;
    c.talkHead = lerp(c.talkHead || 0, f.speaking ? 1 : 0, 1 - Math.exp(-4 * dt));
    P[CH.head] += (0.03 * e + 0.05 * em) * c.talkHead; P[CH.head + 1] += 0.03 * Math.sin(c.t * 1.7) * c.talkHead; P[CH.head + 2] += 0.02 * Math.sin(c.t * 1.1 + 1) * c.talkHead;
    P[CH.jaw] += e * 0.16 + (f.look.jawOpen || 0);
  }

  // ---- look-at: chest/neck/head + eyes ---------------------------------------------------------------------------
  const _v = new V3(), _m = new THREE.Matrix4(), _lq = new Q();
  function lookAt(c, P, dt) {
    let tgt = null;
    const L = c.look;
    if (L.target) {
      const t = L.target;
      if (typeof t === 'function') tgt = t(); else if (t.isVector3) tgt = t; else if (t.point) tgt = t.point('eyes', _v);
    }
    let yaw = 0, pitch = 0;
    if (tgt && P[CH.hips] < -0.8) {                                     // lying on the back: angles from the face's rest direction (the pelvis' +Z)
      c.bones.hips.getWorldQuaternion(_lq).invert();
      const d = c.bones.head.getWorldPosition(_v).negate().add(tgt).applyQuaternion(_lq);
      yaw = Math.atan2(d.x, d.z); pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
      if (Math.abs(yaw) > 2.3) yaw = Math.sign(yaw) * 1.0;
    } else if (tgt) {
      c.root.updateWorldMatrix(true, false);
      _m.copy(c.root.matrixWorld).invert();
      const lp = _v.copy(tgt).applyMatrix4(_m);
      const hx = 0, hy = c.D.headO.y + P[CH.root + 1], hz = c.D.headO.z;
      yaw = Math.atan2(lp.x - hx, lp.z - hz);
      pitch = Math.atan2(lp.y - hy, Math.hypot(lp.x - hx, lp.z - hz));
      if (Math.abs(yaw) > 2.3) yaw = Math.sign(yaw) * 1.0;
    }
    const k = 1 - Math.exp(-(tgt ? 5 : 3) * dt);
    L.yaw += (clamp(yaw, -1.5, 1.5) - L.yaw) * k; L.pitch += (clamp(pitch, -0.7, 0.6) - L.pitch) * k;
    c.lookW = lerp(c.lookW || 0, tgt ? 1 : 0, 1 - Math.exp(-4 * dt));
    const bw = c.lookBody ?? 1, y = L.yaw * c.lookW * bw, p = L.pitch * c.lookW * bw;   // lookBody < 1: the eyes do more of the turning
    const bodyY = clamp(y, -1.4, 1.4);
    P[CH.chest + 1] += bodyY * 0.22; P[CH.spine + 1] += bodyY * 0.08; P[CH.neck + 1] += bodyY * 0.3; P[CH.head + 1] += bodyY * 0.4;
    const hf = p < 0 ? 0.68 : 0.9;                                        // looking down, the eyes lower more and the head bows less
    P[CH.neck] -= p * hf * 0.45; P[CH.head] -= p * hf * 0.55;
    // eyes take the rest of the angle (in eye half-widths; ~0.5 = 30 degrees)
    const eyYaw = (tgt ? yaw : 0) - y, eyP = (tgt ? pitch : 0) - p * hf;
    c.gaze.x = clamp(eyYaw * 0.9 + y * 0.12, -0.5, 0.5); c.gaze.y = clamp(eyP * 0.8, -0.3, 0.28);
  }

  // ---- apply channels to bones -------------------------------------------------------------------------------
  const _e = new THREE.Euler();
  function setB(b, x, y, z, order) { _e.set(x, y, z, order); b.quaternion.setFromEuler(_e); }
  function apply(c, P) {
    const B = c.bones, bp = c.bindPos, k = c.D.H / 1.75;
    B.hips.position.set(bp.hips.x + P[0] * k, bp.hips.y + P[1] * k, bp.hips.z + P[2] * k);
    setB(B.hips, P[3], P[4], P[5], 'YXZ'); setB(B.spine, P[6], P[7], P[8], 'YXZ'); setB(B.chest, P[9], P[10], P[11], 'YXZ');
    setB(B.neck, P[12], P[13], P[14], 'YXZ'); setB(B.head, P[15], P[16], P[17], 'YXZ'); setB(B.jaw, P[18], 0, 0, 'XYZ');
    for (const [S, sd] of [['L', 1], ['R', -1]]) {
      const o = SB[S];
      setB(B['clav' + S], 0, -sd * P[o + 1], sd * P[o], 'XYZ');
      setB(B['upperArm' + S], -P[o + 2], sd * P[o + 4], sd * P[o + 3], 'XZY');
      setB(B['foreArm' + S], -P[o + 5], sd * P[o + 6], 0, 'XYZ');
      setB(B['hand' + S], -P[o + 8], 0, -sd * P[o + 7], 'XYZ');
      setB(B['fingers' + S], 0, 0, -sd * P[o + 9], 'XYZ'); setB(B['fingers2' + S], 0, 0, -sd * P[o + 10], 'XYZ');
      setB(B['thumb' + S], P[o + 11] * 0.3, 0, -sd * P[o + 11], 'XYZ'); setB(B['thumb2' + S], 0, 0, -sd * P[o + 12], 'XYZ');
      setB(B['thigh' + S], -P[o + 13], sd * P[o + 15], sd * P[o + 14], 'XZY');
      setB(B['shin' + S], P[o + 16], 0, 0, 'XYZ');
      setB(B['foot' + S], -P[o + 17], 0, sd * P[o + 18], 'XYZ');
      setB(B['toe' + S], -P[o + 19], 0, 0, 'XYZ');
    }
  }

  // ---- per-frame composition ------------------------------------------------------------------------------
  function frame(c, dt) {
    const P = c.P;
    // base pose (blending)
    const bt = c.poseBlend;
    if (bt.t < 1) { bt.t = Math.min(1, bt.t + dt / bt.dur); if (bt.t >= 1 && bt.resolve) { const r = bt.resolve; bt.resolve = null; r(); } }
    const k = bt.t * bt.t * (3 - 2 * bt.t);
    const from = bt.from, to = c.basePose.p;
    for (let i = 0; i < N; i++) P[i] = from[i] + (to[i] - from[i]) * k;
    c.B0.set(P);
    const st = (c.look.stoop || 0) - (c.look.upright ? 0.2 : 0);
    if (st) { P[CH.spine] += st * 0.06; P[CH.chest] += st * 0.1; P[CH.neck] += st * 0.16; P[CH.head] -= st * 0.1; P[CH.clavL + 1] += st * 0.12; P[CH.clavR + 1] += st * 0.12; P[CH.kneeL] += st * 0.06; P[CH.kneeR] += st * 0.06; }
    if (c.infected && c.t % 1.3 < 0.08) { P[CH.head + 1] += (Math.random() - 0.5) * 0.25; P[CH.neck + 2] += (Math.random() - 0.5) * 0.15; }   // twitches
    // locomotion
    const L = c.loco;
    L.v += (L.target - L.v) * (1 - Math.exp(-(L.target > L.v ? 6 : 9) * dt));
    L.crouchW = lerp(L.crouchW, L.crouch ? 1 : 0, 1 - Math.exp(-6 * dt));
    L.carryW = lerp(L.carryW, L.carry ? 1 : 0, 1 - Math.exp(-6 * dt));
    L.limpW = lerp(L.limpW, L.limp ? 1 : 0, 1 - Math.exp(-4 * dt));
    L.crawl = c.basePose.crawl ? 1 : 0;
    if (L.crouchW > 0.01 && c.basePose.loco && !c.basePose.crouch) {
      const cp = POSES.crouch.p, m = L.crouchW;
      for (let i = 0; i < N; i++) if (i < CH.clavL || MASK.arms[i] === 0) P[i] += (cp[i] - P0[i]) * m * (i >= SB.L + SO.thigh || i >= SB.R + SO.thigh || i < CH.neck ? 1 : 0.6);
    }
    if (c.basePose.loco && bt.t >= 1) gait(c, P, dt); else L.moveW = 0;
    // yaw rate for turning steps
    const yaw = c.root.rotation.y;
    L.turnRate = lerp(L.turnRate, (((yaw - (L.lastYaw ?? yaw)) + Math.PI) % TAU + TAU) % TAU / dt - Math.PI / dt, 1 - Math.exp(-10 * dt));
    L.lastYaw = yaw;
    // exertion -> breathing rate
    c.idle.breath = lerp(c.idle.breath, 0.24 + clamp(L.v / 5.5, 0, 1) * 0.4 + (c.face && c.face.emoteName === 'crying' ? 0.1 : 0), 1 - Math.exp(-0.5 * dt));
    idle(c, P, dt, c.basePose === POSES.stand || c.basePose.idle ? 1 - (L.moveW || 0) : 0);
    emoteBody(c, P, dt);
    // gesture overlay
    if (c.gest) Gest.apply(c, P, dt);
    lookAt(c, P, dt);
    apply(c, P);
  }

  // ---- springs: ponytail/strands/coat hem driven by head/hips motion ---------------------------------------------
  const _w = new V3(), _g = new V3(), _q = new Q(), _d = new V3();
  function springs(c, dt) {
    if (dt <= 0) return;
    for (const s of c.springs) {
      const b = s.bone, par = b.parent;
      par.getWorldQuaternion(_q).invert();
      b.getWorldPosition(_w);
      // world acceleration of the pivot
      if (!s.last) s.last = _w.clone();
      const vel = _d.subVectors(_w, s.last).divideScalar(dt); s.last.copy(_w);
      if (!s.vel) s.vel = vel.clone();
      const acc = vel.clone().sub(s.vel).divideScalar(dt); s.vel.copy(vel);
      if (acc.lengthSq() > 900) acc.setLength(30);
      // target: rest direction blended toward gravity (in parent space), pushed by inertia
      _g.set(0, -1, 0).applyQuaternion(_q);
      const tgt = s.rest.clone().lerp(_g, s.grav).normalize().addScaledVector(acc.applyQuaternion(_q), -s.inertia).normalize();
      s.dv.addScaledVector(_d.subVectors(tgt, s.dir), s.k * dt).multiplyScalar(Math.exp(-s.damp * dt));
      s.dir.addScaledVector(s.dv, dt).normalize();
      b.quaternion.setFromUnitVectors(s.rest, s.dir);
    }
  }

  return { CH, N, SB, SO, pose, mk, MASK, POSES, P0, frame, apply, springs, gait, curve };
})();
