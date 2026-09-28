// ============================================================================
// Gest — base-pose transitions, the gesture library (upper-body overlays with IK hand targets), two-bone
// arm IK, and paired animations with shared anchors (carry, hug, face_hold, pin, cradle, shoulders, ride,
// drag). Internal to Chars (chars agent).
//   Gest.pose(c, name, o) · Gest.gesture(c, name, o) · Gest.apply(c, P, dt) (overlay, from Anim.frame)
//   Gest.attach(c, other, mode, o) · Gest.detach(c) · Gest.pairUpdate(c, dt) · Gest.post(c, dt) (IK after FK)
// Gesture: { dur, mask, keys: [[t 0..1, spec]], add: [[t, spec]] (additive), hold: t (where {hold:true} pauses),
//   ik: { r|l: [boneName | 'to:<point>', [x,y,z] offset (bone space, scaled)] , w: [[t, weight]] }, osc(c, P, t, w) }
// ============================================================================
const Gest = (() => {
  const { CH, N, POSES, P0, mk, MASK } = Anim;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const sm = t => t * t * (3 - 2 * t);
  const V3 = THREE.Vector3, Q = THREE.Quaternion;

  // spec -> { v: values, m: mask } (only the channels the spec names)
  function part(spec) { const v = mk(spec), m = new Float32Array(N), z = mk(Object.fromEntries(Object.keys(spec).map(k => [k, (Array.isArray(spec[k]) ? spec[k] : [spec[k]]).map(() => 1)]))); for (let i = 0; i < N; i++) m[i] = z[i]; return { v, m }; }

  // ---- gesture library -------------------------------------------------------------------------------------
  const R_ = { armR: [0.3, 0.1, 0], foreR: [0.6, 0.4] };
  const G = {
    point: { dur: 1.7, hold: 0.55, keys: [[0, { armR: [0.3, 0.2, 0.1], foreR: [0.6, 0.6] }], [0.3, { armR: [1.35, 0.25, 0.3], foreR: [0.1, 0.9], handR: [-0.1, 0], fingR: 0.05, fing2R: 0.05, thumbR: 0.5, chest: [0, -0.1, 0] }], [0.8, { armR: [1.3, 0.25, 0.3], foreR: [0.12, 0.9], fingR: 0.05, fing2R: 0.05 }], [1, { armR: [0.1, -0.05, 0.05], foreR: [0.3, 0.3] }]], ik: { r: 'point', w: [[0.15, 0], [0.35, 1], [0.8, 1], [1, 0]] }, look: true },
    shrug: { dur: 1.3, keys: [[0, {}], [0.35, { clav: [0.3, 0.05], arm: [0.1, 0.25, 0.55], fore: [1.2, 1.4], hand: [-0.2, 0], fing: 0.1, fing2: 0.1, head: [-0.12, 0, 0.12] }], [0.65, { clav: [0.28, 0.05], arm: [0.1, 0.25, 0.55], fore: [1.2, 1.4], hand: [-0.2, 0], fing: 0.1, head: [-0.1, 0, 0.12] }], [1, {}]] },
    wave_off: { dur: 1.1, keys: [[0, {}], [0.3, { armR: [0.4, 0.1, -0.3], foreR: [1.8, 0.5], handR: [0.3, 0], fingR: 0.2 }], [0.6, { armR: [0.35, 0.55, 0.4], foreR: [0.9, 1.1], handR: [-0.4, 0], fingR: 0.1, head: [0, -0.15, 0] }], [1, {}]] },
    hand_on_shoulder: { dur: 2.6, hold: 0.7, keys: [[0, {}], [0.3, { armR: [0.9, 0.2, 0.2], foreR: [0.6, 0.3], handR: [0.4, 0], fingR: 0.35 }], [0.75, { armR: [0.9, 0.2, 0.2], foreR: [0.6, 0.3], handR: [0.4, 0], fingR: 0.35 }], [1, {}]], ik: { r: 'to:shoulder', w: [[0.1, 0], [0.35, 1], [0.75, 1], [1, 0]] }, look: true },
    fold_arms: { dur: 3.5, hold: 0.8, keys: [[0, {}], [0.2, { arm: [0.35, 0.12, -0.35], fore: [2.05, 0.9], hand: [0.25, 0], fing: 0.6, fing2: 0.5, chest: [-0.04, 0, 0] }], [0.85, { arm: [0.35, 0.12, -0.35], fore: [2.05, 0.9], hand: [0.25, 0], fing: 0.6, fing2: 0.5 }], [1, {}]], ik: { l: ['upperArmR', [0.02, -0.19, 0.07]], r: ['upperArmL', [-0.02, -0.15, 0.1]], w: [[0.05, 0], [0.22, 1], [0.85, 1], [1, 0]] } },
    rub_face: { dur: 2.2, keys: [[0, {}], [0.25, { arm: [0.7, 0.15, -0.1], fore: [2.2, 0.9], hand: [-0.3, 0], fing: 0.15, neck: [0.2, 0, 0], head: [0.15, 0, 0] }], [0.8, { arm: [0.7, 0.15, -0.1], fore: [2.2, 0.9], hand: [-0.3, 0], fing: 0.15, neck: [0.2, 0, 0], head: [0.15, 0, 0] }], [1, {}]], ik: { l: ['head', [0.045, 0.0, 0.1]], r: ['head', [-0.045, 0.0, 0.1]], w: [[0.1, 0], [0.3, 1], [0.8, 1], [1, 0]] }, osc: (c, P, t, w, o) => { o.ikOff = Math.sin(t * 20) * 0.012 * w; } },
    hands_on_hips: { dur: 3, hold: 0.8, keys: [[0, {}], [0.25, { arm: [-0.1, 0.55, 0.6], fore: [1.6, 0.2], hand: [0.5, 0], fing: 0.1, fing2: 0.2, thumb: 0.0 }], [0.85, { arm: [-0.1, 0.55, 0.6], fore: [1.6, 0.2], hand: [0.5, 0], fing: 0.1 }], [1, {}]], ik: { l: ['hips', [0.15, 0.06, 0.02]], r: ['hips', [-0.15, 0.06, 0.02]], w: [[0.05, 0], [0.28, 1], [0.85, 1], [1, 0]] } },
    push_glasses: { dur: 1.1, keys: [[0, {}], [0.4, { armR: [0.6, 0.05, -0.2], foreR: [2.4, 0.9], handR: [-0.2, 0.3], fingR: 0.7, fing2R: 0.6, head: [0.06, 0, 0] }], [0.6, { armR: [0.6, 0.05, -0.2], foreR: [2.4, 0.9], handR: [-0.2, 0.3], fingR: 0.7 }], [1, {}]], ik: { r: ['head', [0, 0.045, 0.125]], w: [[0.15, 0], [0.4, 1], [0.6, 1], [0.9, 0]] } },
    pull_collar: { dur: 2.2, hold: 0.6, keys: [[0, {}], [0.3, { armR: [0.5, 0.35, -0.2], foreR: [2.2, 0.8], handR: [0.4, 0], fingR: 0.9, fing2R: 0.8, head: [0.05, -0.35, -0.2] }], [0.75, { armR: [0.5, 0.35, -0.2], foreR: [2.2, 0.8], handR: [0.4, 0], fingR: 0.9, head: [0.05, -0.35, -0.2] }], [1, {}]], ik: { r: ['neck', [0.06, 0.0, 0.06]], w: [[0.1, 0], [0.32, 1], [0.75, 1], [1, 0]] } },
    rub_palm: { dur: 2.6, keys: [[0, {}], [0.25, { arm: [0.35, -0.1, -0.2], fore: [1.3, 0.9], hand: [0.3, 0], fingR: 0.5, fingL: 0.3, thumbL: 0.2 }], [0.8, { arm: [0.35, -0.1, -0.2], fore: [1.3, 0.9], hand: [0.3, 0] }], [1, {}]], ik: { l: ['hips', [-0.015, 0.16, 0.2]], r: ['hips', [-0.03, 0.14, 0.22]], w: [[0.1, 0], [0.3, 1], [0.8, 1], [1, 0]] }, osc: (c, P, t, w) => { P[CH.thumbL] += Math.sin(t * 9) * 0.35 * w; P[CH.thumb2L] += Math.sin(t * 9) * 0.3 * w; } },
    click_cutter: { dur: 1.9, keys: [[0, {}], [0.2, { armR: [0.3, 0.05, -0.1], foreR: [1.6, 0.9], handR: [0.1, 0.1], fingR: 0.9, fing2R: 0.9, head: [0.15, 0, 0] }], [0.85, { armR: [0.3, 0.05, -0.1], foreR: [1.6, 0.9], fingR: 0.9 }], [1, {}]], osc: (c, P, t, w) => { P[CH.thumbR] += (Math.sin(t * 13) > 0 ? 0.35 : -0.1) * w; } },
    wipe_tears: { dur: 1.5, keys: [[0, {}], [0.35, { armR: [0.7, 0.05, -0.15], foreR: [2.4, 0.3], handR: [0.2, 0], fingR: 0.8, fing2R: 0.7, head: [0.1, 0.1, 0] }], [0.7, { armR: [0.65, 0.2, -0.1], foreR: [2.2, 0.4], handR: [0.2, 0], fingR: 0.8, head: [0.1, 0.1, 0] }], [1, {}]], ik: { r: ['head', [-0.035, 0.012, 0.1]], w: [[0.15, 0], [0.35, 1], [0.6, 1], [0.85, 0]] }, osc: (c, P, t, w, o) => { o.ikOff = (t % 1.5) * 0.02 * w; } },
    cover_mouth: { dur: 2.6, hold: 0.7, keys: [[0, {}], [0.25, { armR: [0.7, 0.05, -0.2], foreR: [2.3, 0.6], handR: [-0.1, 0], fingR: 0.2, fing2R: 0.2, head: [0.1, 0, 0] }], [0.8, { armR: [0.7, 0.05, -0.2], foreR: [2.3, 0.6], handR: [-0.1, 0], fingR: 0.2 }], [1, {}]], ik: { r: ['head', [0.0, -0.06, 0.12]], w: [[0.1, 0], [0.3, 1], [0.8, 1], [1, 0]] } },
    hand_over: { dur: 1.6, hold: 0.55, keys: [[0, {}], [0.4, { armR: [0.9, 0.05, 0.3], foreR: [0.5, 1.0], handR: [0, 0], fingR: 0.45, fing2R: 0.4 }], [0.7, { armR: [0.9, 0.05, 0.3], foreR: [0.5, 1.0], fingR: 0.45 }], [1, {}]], ik: { r: 'to:hand', w: [[0.1, 0], [0.4, 1], [0.7, 1], [1, 0]] }, look: true },
    hold_hands: { dur: 3, hold: 0.5, keys: [[0, {}], [0.3, { armL: [0.15, 0.1, 0.1], foreL: [0.3, 0.4], fingL: 0.6, fing2L: 0.5 }], [1, {}]], ik: { l: 'to:hand', w: [[0.1, 0], [0.35, 1], [0.85, 1], [1, 0]] } },
    lean_railing: { dur: 4, hold: 0.5, keys: [[0, {}], [0.3, { spine: [0.2, 0, 0], chest: [0.15, 0, 0], neck: [-0.1, 0, 0], head: [-0.1, 0, 0], arm: [1.1, 0.05, -0.2], fore: [1.5, 1.2], hand: [0.3, 0], fing: 0.5, thigh: [0.1, 0.05, 0.1], kneeL: 0.25 }], [0.85, { spine: [0.2, 0, 0], chest: [0.15, 0, 0], arm: [1.1, 0.05, -0.2], fore: [1.5, 1.2], hand: [0.3, 0] }], [1, {}]] },
    head_on_shoulder: { dur: 4, hold: 0.5, keys: [[0, {}], [0.35, { neck: [0.15, 0, 0.35], head: [0.1, 0.15, 0.3], chest: [0, 0, 0.1] }], [0.85, { neck: [0.15, 0, 0.35], head: [0.1, 0.15, 0.3] }], [1, {}]] },
    cpr: { dur: 3, hold: 0.5, keys: [[0, {}], [0.2, { spine: [0.35, 0, 0], chest: [0.25, 0, 0], neck: [0.15, 0, 0], arm: [0.85, -0.12, -0.2], fore: [0.12, 0.8], hand: [-1.1, 0], fing: 0.1 }], [0.85, { spine: [0.35, 0, 0], chest: [0.25, 0, 0], arm: [0.85, -0.12, -0.2], fore: [0.12, 0.8], hand: [-1.1, 0] }], [1, {}]], ik: { l: 'to:chest', r: 'to:chest+', w: [[0.1, 0], [0.25, 1], [0.85, 1], [1, 0]] }, osc: (c, P, t, w, o) => { const k = Math.max(0, Math.sin(t * 12)); P[CH.chest] += k * 0.08 * w; P[CH.spine] += k * 0.05 * w; o.ikOff = -k * 0.035 * w; } },
    punch: { dur: 0.65, keys: [[0, {}], [0.2, { armR: [0.3, 0.3, -0.2], foreR: [2.0, 0.4], fingR: 1, fing2R: 1, thumbR: 0.8, chest: [0, 0.35, 0] }], [0.42, { armR: [1.45, 0.1, -0.3], foreR: [0.1, 0.1], handR: [0.1, 0], fingR: 1, fing2R: 1, chest: [0.08, -0.4, 0], spine: [0.08, -0.15, 0] }], [0.62, { armR: [1.2, 0.1, -0.2], foreR: [0.5, 0.2], fingR: 1, fing2R: 1 }], [1, {}]] },
    tackle: { dur: 0.9, keys: [[0, {}], [0.3, { spine: [0.45, 0, 0], chest: [0.3, 0, 0], neck: [-0.3, 0, 0], arm: [1.3, 0.3, 0.2], fore: [0.6, 0.4], fing: 0.5 }], [0.7, { spine: [0.5, 0, 0], chest: [0.3, 0, 0], arm: [1.2, 0.4, 0.3], fore: [0.9, 0.4] }], [1, {}]] },
    swing: { dur: 0.95, keys: [[0, {}], [0.3, { armR: [1.2, 0.9, 0.6], foreR: [1.4, 0.5], armL: [0.9, 0.4, 0.2], foreL: [1.5, 0.8], chest: [-0.05, 0.6, 0], spine: [0, 0.25, 0], fing: 1, fing2: 1 }], [0.55, { armR: [1.1, -0.2, -0.4], foreR: [0.2, 0.5], armL: [1.2, -0.1, 0], foreL: [0.4, 0.8], chest: [0.15, -0.6, 0], spine: [0.1, -0.3, 0], fing: 1, fing2: 1 }], [1, {}]] },
    fire: { dur: 0.35, add: [[0, {}], [0.15, { armR: [0.12, 0, 0], foreR: [0.2, 0], chest: [-0.04, 0, 0], head: [-0.03, 0, 0] }], [1, {}]], flash: 0.08 },
    recoil: { dur: 0.6, add: [[0, {}], [0.15, { armR: [0.3, 0, 0], foreR: [0.4, 0], armL: [0.2, 0, 0], chest: [-0.12, 0, 0], spine: [-0.06, 0, 0], head: [-0.1, 0, 0] }], [1, {}]], flash: 0.08 },
    struggle: { dur: 2.5, hold: 0.5, keys: [[0, {}], [0.2, { arm: [1.1, 0.2, 0.1], fore: [1.0, 0.8], hand: [-0.6, 0], fing: 0.2, chest: [-0.1, 0, 0], neck: [-0.1, 0, 0] }], [0.85, { arm: [1.1, 0.2, 0.1], fore: [1.0, 0.8], hand: [-0.6, 0] }], [1, {}]], osc: (c, P, t, w) => { P[CH.chest + 1] += Math.sin(t * 17) * 0.1 * w; P[CH.armL] += Math.sin(t * 23) * 0.12 * w; P[CH.armR] += Math.sin(t * 19 + 1) * 0.12 * w; P[CH.head + 1] += Math.sin(t * 11) * 0.2 * w; } },
    type_phone: { dur: 3, hold: 0.5, keys: [[0, {}], [0.25, { arm: [0.45, -0.05, -0.15], fore: [1.75, 1.25], hand: [0.25, 0.2], fing: 0.75, fing2: 0.6, thumb: 0.1, neck: [0.3, 0, 0], head: [0.2, 0, 0] }], [0.85, { arm: [0.45, -0.05, -0.15], fore: [1.75, 1.25], hand: [0.25, 0.2], fing: 0.75, neck: [0.3, 0, 0], head: [0.2, 0, 0] }], [1, {}]], osc: (c, P, t, w) => { P[CH.thumbR] += Math.max(0, Math.sin(t * 16)) * 0.5 * w; P[CH.thumbL] += Math.max(0, Math.sin(t * 16 + 2)) * 0.5 * w; } },
    slam_phone: { dur: 1.3, keys: [[0, {}], [0.35, { armR: [0.9, 0.15, -0.1], foreR: [1.6, 1.3], handR: [0.2, 0], fingR: 0.9, chest: [-0.05, 0.15, 0] }], [0.5, { armR: [0.55, 0.1, -0.1], foreR: [0.6, 1.3], handR: [0.6, 0], fingR: 0.9, chest: [0.18, 0, 0], spine: [0.1, 0, 0] }], [0.8, { armR: [0.5, 0.1, -0.1], foreR: [0.6, 1.3], handR: [0.6, 0], fingR: 0.4, chest: [0.15, 0, 0] }], [1, {}]] },
    wave: { dur: 2, keys: [[0, {}], [0.2, { armR: [0.3, 1.2, 0.9], foreR: [1.7, 0.6], handR: [-0.2, 0], fingR: 0.05, fing2R: 0.05 }], [0.8, { armR: [0.3, 1.2, 0.9], foreR: [1.7, 0.6], handR: [-0.2, 0], fingR: 0.05 }], [1, {}]], osc: (c, P, t, w) => { P[CH.foreR + 1] += Math.sin(t * 9) * 0.25 * w; P[CH.handR + 1] += Math.sin(t * 9) * 0.3 * w; } },
    knock: { dur: 1.4, keys: [[0, {}], [0.2, { armR: [0.95, 0.2, -0.3], foreR: [1.5, 0.3], handR: [0.2, 0], fingR: 1, fing2R: 1, thumbR: 0.8 }], [0.85, { armR: [0.95, 0.2, -0.3], foreR: [1.5, 0.3], fingR: 1, fing2R: 1 }], [1, {}]], osc: (c, P, t, w) => { const k = t > 0.3 && t < 1.1 ? Math.max(0, Math.sin((t - 0.3) * 23.5)) : 0; P[CH.foreR] -= k * 0.35 * w; P[CH.armR] += k * 0.08 * w; } },
    grab: { dur: 0.7, keys: [[0, {}], [0.35, { arm: [1.25, 0.25, 0.2], fore: [0.4, 0.8], fing: 0.1, fing2: 0.1, chest: [0.15, 0, 0], spine: [0.1, 0, 0] }], [0.6, { arm: [1.1, 0.2, 0.2], fore: [0.8, 0.8], fing: 1, fing2: 1 }], [1, {}]] },
    hug: { dur: 3, hold: 0.5, keys: [[0, {}], [0.3, { arm: [1.0, 0.45, -0.3], fore: [1.5, 0.6], hand: [0.3, 0], fing: 0.3, chest: [0.05, 0, 0] }], [0.85, { arm: [1.0, 0.45, -0.3], fore: [1.5, 0.6], hand: [0.3, 0] }], [1, {}]] },
    // additions: character tics and small beats
    push_sweatband: { dur: 1.6, keys: [[0, {}], [0.3, { armL: [0.7, -0.1, -0.4], foreL: [1.7, 1.3], handL: [0.1, 0], armR: [0.6, -0.05, -0.4], foreR: [1.9, 0.9], fingR: 0.4, head: [0.2, 0.1, 0] }], [0.75, { armL: [0.7, -0.1, -0.4], foreL: [1.7, 1.3], armR: [0.6, -0.05, -0.4], foreR: [1.9, 0.9], head: [0.2, 0.1, 0] }], [1, {}]], ik: { r: ['foreArmL', [0, -0.08, 0.03]], w: [[0.15, 0], [0.35, 1], [0.75, 1], [0.95, 0]] }, at: [0.55, c => { if (c.parts.sweatband !== 'up') c.setPart('sweatband', 'up'); }] },
    chew_sleeve: { dur: 2.4, keys: [[0, {}], [0.3, { armR: [0.75, 0.0, -0.3], foreR: [2.3, 0.9], handR: [0.5, 0], fingR: 0.9, fing2R: 0.9, head: [0.12, 0.1, 0] }], [0.8, { armR: [0.75, 0.0, -0.3], foreR: [2.3, 0.9], handR: [0.5, 0], fingR: 0.9, head: [0.12, 0.1, 0] }], [1, {}]], ik: { r: ['head', [-0.01, -0.085, 0.1]], w: [[0.1, 0], [0.32, 1], [0.8, 1], [1, 0]] } },
    adjust_cap: { dur: 1.4, keys: [[0, {}], [0.4, { armR: [0.9, 0.3, -0.1], foreR: [2.2, 0.6], handR: [0.2, 0], fingR: 0.7, fing2R: 0.5 }], [0.65, { armR: [0.9, 0.3, -0.1], foreR: [2.2, 0.6], fingR: 0.7, head: [0.05, 0, 0] }], [1, {}]], ik: { r: ['head', [-0.02, 0.12, 0.08]], w: [[0.15, 0], [0.4, 1], [0.65, 1], [0.9, 0]] } },
    touch_headset: { dur: 1.5, keys: [[0, {}], [0.4, { armR: [0.6, 0.2, -0.2], foreR: [2.1, 0.8], fingR: 0.4 }], [0.7, { armR: [0.6, 0.2, -0.2], foreR: [2.1, 0.8], fingR: 0.4 }], [1, {}]], ik: { r: ['neck', [-0.04, 0.0, 0.07]], w: [[0.15, 0], [0.4, 1], [0.7, 1], [0.95, 0]] } },
    wind_cord: { dur: 3, keys: [[0, {}], [0.25, { arm: [0.45, -0.05, -0.2], fore: [1.7, 1.1], hand: [0.2, 0], fingR: 0.6, fingL: 0.2, head: [0.12, 0, 0] }], [0.85, { arm: [0.45, -0.05, -0.2], fore: [1.7, 1.1], hand: [0.2, 0] }], [1, {}]], ik: { l: ['chest', [0.02, 0.06, 0.26]], r: ['chest', [-0.02, 0.07, 0.25]], w: [[0.1, 0], [0.3, 1], [0.85, 1], [1, 0]] }, osc: (c, P, t, w, o) => { o.ikOffV = new V3(Math.cos(t * 7) * 0.02, Math.sin(t * 7) * 0.02, 0).multiplyScalar(w); } },
    steeple: { dur: 3.5, hold: 0.5, keys: [[0, {}], [0.25, { arm: [0.35, 0.05, -0.25], fore: [1.9, 1.3], hand: [-0.3, 0.2], fing: 0.05, fing2: 0.05, thumb: 0.1 }], [0.85, { arm: [0.35, 0.05, -0.25], fore: [1.9, 1.3], hand: [-0.3, 0.2], fing: 0.05, fing2: 0.05 }], [1, {}]], ik: { l: ['chest', [0.022, -0.04, 0.28]], r: ['chest', [-0.022, -0.04, 0.28]], w: [[0.1, 0], [0.3, 1], [0.85, 1], [1, 0]] } },
    clean_hands: { dur: 2.8, keys: [[0, {}], [0.25, { arm: [0.35, -0.05, -0.25], fore: [1.4, 1.0], hand: [0.2, 0], fing: 0.5, fing2: 0.3 }], [0.85, { arm: [0.35, -0.05, -0.25], fore: [1.4, 1.0], fing: 0.5 }], [1, {}]], ik: { l: ['hips', [0.02, 0.2, 0.24]], r: ['hips', [-0.02, 0.19, 0.25]], w: [[0.1, 0], [0.3, 1], [0.85, 1], [1, 0]] }, osc: (c, P, t, w, o) => { o.ikOffV = new V3(Math.sin(t * 10) * 0.025, 0, 0).multiplyScalar(w); } },
    bounce: { dur: 1.6, add: [[0, {}], [1, {}]], osc: (c, P, t, w) => { const k = Math.max(0, Math.sin(t * 11)); P[CH.root + 1] += k * 0.025 * w; P[CH.footL] -= k * 0.35 * w; P[CH.footR] -= k * 0.35 * w; P[CH.toeL] += k * 0.4 * w; P[CH.toeR] += k * 0.4 * w; } },
    swipe: { dur: 2, add: [[0, {}], [1, {}]], osc: (c, P, t, w) => { P[CH.thumbR] += (0.35 + 0.35 * Math.sin(t * 14)) * w; P[CH.thumb2R] += 0.3 * Math.sin(t * 14) * w; } },
    hand_on_pocket: { dur: 2.5, hold: 0.6, keys: [[0, {}], [0.3, { armR: [0.55, 0.0, -0.3], foreR: [1.9, 0.7], handR: [0.2, 0], fingR: 0.15, fing2R: 0.15 }], [0.8, { armR: [0.55, 0.0, -0.3], foreR: [1.9, 0.7], handR: [0.2, 0], fingR: 0.15 }], [1, {}]], ik: { r: ['chest', [0.07, 0.07, 0.13]], w: [[0.1, 0], [0.35, 1], [0.8, 1], [1, 0]] } },
    nod: { dur: 0.8, add: [[0, {}], [0.3, { neck: [0.12, 0, 0], head: [0.12, 0, 0] }], [0.6, { neck: [-0.02, 0, 0], head: [-0.03, 0, 0] }], [1, {}]] },
    shake_head: { dur: 1.2, add: [[0, {}], [1, {}]], osc: (c, P, t, w) => { P[CH.head + 1] += Math.sin(t * 11) * 0.22 * w; P[CH.neck + 1] += Math.sin(t * 11) * 0.08 * w; } },
    drop_hand: { dur: 1.2, keys: [[0, {}], [1, {}]], release: true },
  };
  for (const k in G) {
    const g = G[k];
    g.K = (g.keys || []).map(([t, s]) => [t, part(s)]);
    g.A = (g.add || []).map(([t, s]) => [t, mk(s)]);
  }

  // ---- base poses -------------------------------------------------------------------------------------------
  const UPRIGHT = new Set(['stand', 'crouch', 'hands_up', 'phone', 'phone_ear', 'aim', 'carry']);
  const LOW = { lie: 'kneel', dead: 'kneel', sit_ground: 'crouch', cradle: 'kneel', struggle_down: 'kneel', crawl: 'kneel', pin: 'kneel' };
  function pose(c, name, o = {}) {
    if (!POSES[name]) name = 'stand';
    c.aimAt = name === 'aim' && o.at ? (o.at.isVector3 ? o.at.clone() : null) : null;
    const cur = c.poseName;
    const via = !o.direct && UPRIGHT.has(cur) && LOW[name] && POSES[LOW[name]] ? LOW[name] : !o.direct && LOW[cur] && UPRIGHT.has(name) ? LOW[cur] : null;
    const dur = o.dur ?? (name === 'dead' ? 0.7 : 0.6);
    if (via && via !== cur && via !== name) return set(c, via, dur * 0.55).then(() => c.poseName === via ? set(c, name, dur * 0.7) : null);
    return set(c, name, dur);
  }
  function set(c, name, dur) {
    const bt = c.poseBlend;
    if (bt.resolve) { const r = bt.resolve; bt.resolve = null; r(); }
    bt.from = Float32Array.from(c.B0);
    c.basePose = POSES[name]; c.poseName = name; bt.t = 0; bt.dur = Math.max(0.05, dur);
    return new Promise(r => { bt.resolve = r; });
  }

  // ---- gestures ---------------------------------------------------------------------------------------------
  function gesture(c, name, o = {}) {
    if (c.gest && c.gest.res) { const r = c.gest.res; c.gest.res = null; c.gest.release = true; r(); }
    if (!name) return Promise.resolve();
    const g = G[name];
    if (!g) return Promise.resolve();
    const dur = o.dur ?? g.dur;
    if (name === 'drop_hand') { c.gripRelease = true; }
    return new Promise(res => { c.gest = { name, g, t: 0, dur, o, res, w: 0, hold: !!o.hold, done: new Set() }; if (g.look && o.to) c.look.target = o.to; });
  }
  function sample(keys, t, out, mask) {
    let i = 0; while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
    const a = keys[i], b = keys[i + 1], k = sm(clamp((t - a[0]) / (b[0] - a[0] || 1), 0, 1));
    for (let j = 0; j < N; j++) {
      const ma = a[1].m ? a[1].m[j] : 1, mb = b[1].m ? b[1].m[j] : 1;
      out[j] = lerp(ma ? (a[1].v ? a[1].v[j] : a[1][j]) : NaN, mb ? (b[1].v ? b[1].v[j] : b[1][j]) : NaN, k);
      mask[j] = lerp(ma, mb, k);
      if (!ma && mb) out[j] = b[1].v[j]; else if (ma && !mb) out[j] = a[1].v[j];
    }
  }
  const _o = new Float32Array(N), _m = new Float32Array(N);
  function apply(c, P, dt) {
    const s = c.gest, g = s.g;
    let t = s.t + dt / s.dur;
    if (s.hold && g.hold != null && t > g.hold && !s.release) t = g.hold;
    s.t = Math.min(1, t);
    if (g.at && s.t >= g.at[0] && !s.done.has('at')) { s.done.add('at'); g.at[1](c); }
    const tt = s.t;
    s.w = sm(clamp(tt / 0.12, 0, 1)) * sm(clamp((1 - tt) / 0.12, 0, 1));
    if (g.K.length) {
      sample(g.K, tt, _o, _m);
      for (let i = 0; i < N; i++) if (_m[i] > 0) { const v = _o[i]; if (!isNaN(v)) P[i] = lerp(P[i], v, _m[i] * clamp(s.w * 1.4, 0, 1)); }
    }
    if (g.A.length) {
      let i = 0; while (i < g.A.length - 2 && tt > g.A[i + 1][0]) i++;
      const a = g.A[i], b = g.A[i + 1], k = sm(clamp((tt - a[0]) / (b[0] - a[0] || 1), 0, 1));
      for (let j = 0; j < N; j++) P[j] += lerp(a[1][j], b[1][j], k);
    }
    if (g.osc) g.osc(c, P, tt * s.dur, Math.min(1, s.w * 1.5), s);
    if (g.flash && tt < g.flash / s.dur && !s.done.has('flash')) { s.done.add('flash'); CharProps.flash(c); }
    if (s.t >= 1) { c.gest = null; if (s.res) s.res(); if (g.look && s.o.to && c.look.target === s.o.to) c.look.target = null; }
  }

  // ---- IK ----------------------------------------------------------------------------------------------------
  const _a = new V3(), _b = new V3(), _c = new V3(), _d = new V3(), _e = new V3(), _pv = new V3(), _q = new Q(), _q2 = new Q();
  function rotToward(bone, from, to, w) {
    bone.getWorldPosition(_e);
    _a.subVectors(from, _e).normalize(); _b.subVectors(to, _e).normalize();
    if (_a.lengthSq() < 1e-8 || _b.lengthSq() < 1e-8) return;
    _q.setFromUnitVectors(_a, _b);
    if (w < 1) _q.slerp(_q2.identity(), 1 - w);
    bone.getWorldQuaternion(_q2);
    const wq = _q.multiply(_q2);
    bone.parent.getWorldQuaternion(_q2).invert();
    bone.quaternion.copy(_q2.multiply(wq));
    bone.updateMatrixWorld(true);
  }
  // two-bone IK for 'L'/'R' arm toward world target t; pole: world point the elbow bends toward
  function armIK(c, S, t, w, pole) {
    if (w <= 0.001) return;
    const A = c.bones['upperArm' + S], Bb = c.bones['foreArm' + S], C = c.bones['hand' + S];
    const L1 = Bb.position.length(), L2 = C.position.length();
    A.getWorldPosition(_a); Bb.getWorldPosition(_b); C.getWorldPosition(_c);
    const sa = _a.clone();
    let d = _d.subVectors(t, sa).length();
    const dir = _d.normalize().clone();
    d = clamp(d, Math.abs(L1 - L2) * 1.05 + 0.01, (L1 + L2) * 0.999);
    _pv.subVectors(pole, sa); _pv.addScaledVector(dir, -_pv.dot(dir)).normalize();
    const cosA = clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
    const elbow = sa.clone().addScaledVector(dir, L1 * cosA).addScaledVector(_pv, L1 * sinA);
    rotToward(A, _b, elbow, w);
    Bb.getWorldPosition(_b); C.getWorldPosition(_c);
    rotToward(Bb, _c, t, w);
  }
  const _poleL = new V3(), _tmp = new V3();
  function pole(c, S, out) {                               // the elbow bends toward this point (chest space; c.ikPole overrides per side)
    const sd = S === 'L' ? 1 : -1, o = c.ikPole && c.ikPole[S];
    return (o ? out.set(o[0], o[1], o[2]) : out.set(sd * 0.45, -0.35, -0.35)).applyMatrix4(c.bones.chest.matrixWorld);
  }
  // bone-relative point (offset scaled by body/head size)
  function bonePt(c, bone, off, out) { const s = bone === 'head' || bone === 'jaw' ? c.D.hs : c.D.s; return out.set(off[0] * s, off[1] * s, off[2] * s).applyMatrix4(c.bones[bone].matrixWorld); }
  function targetOf(c, spec, S, o, out) {
    if (Array.isArray(spec)) return bonePt(c, spec[0], spec[1], out);
    const to = o.to && typeof o.to === 'string' ? Game.who(o.to) || Game.G.marker(o.to)?.pos : o.to;
    if (spec === 'point') {
      const p = to ? (to.isVector3 ? to : to.point ? to.point('chest', _tmp) : to) : null;
      c.bones['upperArm' + S].getWorldPosition(out);
      if (!p) return out.add(new V3(0, 0, 0.7).applyQuaternion(c.root.quaternion));
      return out.add(_tmp.copy(p).sub(out).normalize().multiplyScalar(0.62 * c.D.s));
    }
    if (!to) return null;
    if (to.isVector3) return out.copy(to);
    if (!to.point) return null;
    if (spec === 'to:shoulder') { to.point('shoulder_l', out); to.point('shoulder_r', _tmp); if (_tmp.distanceTo(c.root.position) < out.distanceTo(c.root.position)) out.copy(_tmp); return out.add(new V3(0, 0.02, 0)); }
    if (spec === 'to:hand') return to.point(S === 'L' ? 'hand_r' : 'hand_r', out);
    if (spec === 'to:chest') return to.point('chest', out);
    if (spec === 'to:chest+') return to.point('chest', out).add(new V3(0, 0.03, 0));
    return null;
  }
  function wAt(keys, t) { let i = 0; while (i < keys.length - 2 && t > keys[i + 1][0]) i++; const a = keys[i], b = keys[i + 1]; return lerp(a[1], b[1], sm(clamp((t - a[0]) / (b[0] - a[0] || 1), 0, 1))); }

  // the support hand on a long gun: palm up under the fore-end, fingers across it; moves the wrist target `p` below and
  // left of the fore-end and returns the hand's world orientation
  const _gf = new V3(), _gn = new V3(), _gd = new V3(), _gq = new Q();
  function foreGrip(c, g, p) {
    g.updateWorldMatrix(true, false);
    const e = g.matrixWorld.elements;
    _gd.set(e[8], e[9], e[10]).normalize(); _gn.set(e[4], e[5], e[6]).normalize();       // barrel, gun up
    _gf.crossVectors(_gd, _gn).normalize();                                                // across, to the shooter's right
    p.addScaledVector(_gn, -0.035 * c.D.s).addScaledVector(_gf, -0.045 * c.D.s);
    _x.copy(_gn).negate(); _y.copy(_gf).negate(); _z.crossVectors(_x, _y);
    _m3.makeBasis(_x, _y, _z);
    return _gq.setFromRotationMatrix(_m3);
  }
  // palm toward a point (the eyes: a phone screen faces the face), fingers up
  const _m3 = new THREE.Matrix4(), _x = new V3(), _y = new V3(), _z = new V3();
  function palmTo(c, S, target, w) {
    const h = c.bones['hand' + S], sd = S === 'L' ? -1 : 1;              // palm normal: +X (right hand) / -X (left hand)
    h.getWorldPosition(_e);
    _x.subVectors(target, _e).normalize().multiplyScalar(sd);
    _y.set(0, -1, 0).addScaledVector(_x, _x.y).normalize();               // local +Y points back up the arm: fingers up
    _y.subVectors(_e, c.bones['foreArm' + S].getWorldPosition(_a)).normalize().negate();
    _y.addScaledVector(_x, -_y.dot(_x)).normalize();
    _z.crossVectors(_x, _y);
    _m3.makeBasis(_x, _y, _z); _q.setFromRotationMatrix(_m3);
    h.parent.getWorldQuaternion(_q2).invert();
    const local = _q2.multiply(_q);
    h.quaternion.slerp(local, w); h.updateMatrixWorld(true);
  }
  // after FK + matrices: base-pose IK, gesture IK, pair IK, prop off-hand IK
  function post(c, dt) {
    const s = c.gest, ikT = c.ikT || (c.ikT = {}), bp = c.basePose, bw = c.poseBlend.t, gun = bp === POSES.aim && c.heldP.r && c.heldP.r.userData.muzzle ? c.heldP.r : null;
    for (const S of ['R', 'L']) {                            // right first: the left hand may grip what the right one holds
      let tgt = null, w = 0;
      const pr = ikT[S];
      if (pr && pr.w > 0.001) { tgt = pr.p; w = pr.w; }
      if (!tgt && bp.ik && bp.ik[S]) { tgt = bonePt(c, bp.ik[S][0], bp.ik[S][1], new V3()); w = sm(bw); }
      if (!tgt && gun && S === 'R') { tgt = bonePt(c, 'chest', gun.userData.off ? [-0.09, 0.25, 0.28] : [-0.03, 0.2, 0.48], new V3()); w = sm(bw); }   // a long gun shouldered, a pistol at arm's length
      if (s && s.g.ik) {
        const spec = s.g.ik[S.toLowerCase()];
        if (spec) {
          const gw = wAt(s.g.ik.w, s.t) * (s.hold && s.g.hold != null && !s.release ? 1 : 1);
          const p = targetOf(c, spec, S, s.o, new V3());
          if (p && gw > 0) {
            if (s.ikOff) p.add(new V3(0, s.ikOff, 0));
            if (s.ikOffV) p.add(s.ikOffV.clone().applyQuaternion(c.root.quaternion));
            tgt = tgt ? tgt.clone().lerp(p, gw) : p; w = Math.max(w, gw);
          }
        }
      }
      let fore = null;
      if (!tgt && c.twoHand && S === 'L') { const pp = c.twoHand(); if (pp) { fore = foreGrip(c, c.heldP.r, pp); tgt = pp; w = 1; } }
      if (tgt) armIK(c, S, tgt, w, pole(c, S, _poleL));
      if (fore) { const h = c.bones.handL; h.parent.getWorldQuaternion(_q2).invert(); h.quaternion.copy(_q2.multiply(fore)); h.updateMatrixWorld(true); }
      if (bp.palm && bp.palm[S] && !(pr && pr.w > 0.5)) palmTo(c, S, bp.palm[S] === 'eyes' ? c.point('eyes', _b) : c.bones.head.getWorldPosition(_b), sm(bw) * (s && s.g.ik && s.g.ik[S.toLowerCase()] ? 0 : 1));
      if (gun && S === 'R') aimGun(c, gun, sm(bw));
    }
  }
  // turn the right hand so the gun's barrel points at c.aimAt (set by pose('aim', {at})), else straight ahead
  function aimGun(c, g, w) {
    const h = c.bones.handR, m = g.userData.muzzle;
    g.updateWorldMatrix(true, false);
    const o = g.localToWorld(_a.set(0, m[1], 0)), dir = g.localToWorld(_b.set(m[0], m[1], m[2])).sub(o).normalize();
    const want = c.aimAt ? _c.copy(c.aimAt).sub(o).normalize() : _c.set(0, -0.05, 1).applyQuaternion(c.root.quaternion).normalize();
    _q.setFromUnitVectors(dir, want); if (w < 1) _q.slerp(_q2.identity(), 1 - w);
    h.getWorldQuaternion(_q2); _q.multiply(_q2);
    h.parent.getWorldQuaternion(_q2).invert(); h.quaternion.copy(_q2.multiply(_q)); h.updateMatrixWorld(true);
  }

  // ---- paired animations -----------------------------------------------------------------------------------
  // leader c, follower other. Anchors are in the leader's local frame; follower root blends in over 0.45 s.
  const MODES = {
    carry: { lead: 'carry', follow: 'carried', place: (c, o) => ({ p: [0.02 * c.D.s, c.D.yChest * 0.79 - o.D.yHips, 0.27 * c.D.s], yaw: -Math.PI / 2 }) },
    hug: { lead: null, follow: null, place: (c, o) => ({ p: [0.06 * c.D.s, 0, 0.24 * (c.D.s + o.D.s) / 2 + 0.02], yaw: Math.PI }) },
    face_hold: { lead: null, follow: null, place: (c, o) => ({ p: [0, 0, 0.36 * c.D.s], yaw: Math.PI }) },
    pin: { lead: 'pin', follow: 'struggle_down', place: (c, o) => ({ p: [0, 0, 0.12 * c.D.s], yaw: Math.PI }), followerIsBase: true },
    cradle: { lead: 'cradle', follow: 'cradled', place: (c, o) => ({ p: [-0.22 * c.D.s, 0.33 * c.D.s - o.D.yHips, 0.31 * c.D.s], yaw: -Math.PI / 2 }) },
    shoulders: { lead: null, follow: 'sit_shoulders', place: (c, o) => ({ p: [0, c.D.yNeck + 0.02 - o.D.yHips + 0.04 * o.D.s, -0.05 * c.D.s], yaw: 0 }) },
    drag: { lead: 'crouch', follow: 'lie', place: (c, o) => ({ p: [0, 0, 0.55 * c.D.s], yaw: 0 }) },
  };
  function attach(c, other, mode, o = {}) {
    if (mode === 'ride' || mode === 'ride_back') { Quad.mount(other, c, mode === 'ride_back'); return; }
    const M = MODES[mode]; if (!M || !other) return;
    if (c.pair && c.pair.other !== other) detach(c);
    const again = c.pair && c.pair.other === other && c.pair.mode === mode;
    c.pair = { other, mode, M, o, t: again ? c.pair.t : 0, grip: o.grip !== false, from: again ? c.pair.from : { p: other.root.position.clone(), yaw: other.root.rotation.y } };
    other.pairOf = c;
    if (!again) {
      other.stop();
      if (M.lead) pose(c, M.lead, { direct: mode === 'carry' });
      if (M.follow) pose(other, M.follow, { direct: true, dur: 0.45 });
      if (mode === 'hug') { c.look.target = null; other.look.target = null; }
      if (mode === 'face_hold') { c.lookAt(other); other.lookAt(c); }
    }
    if (mode === 'cradle' && other.gripRelease && c.pair.grip) other.gripRelease = false;
  }
  function detach(c) {
    if (c.mount) { Quad.dismount(c); return; }
    const pr = c.pair; if (!pr) return;
    const o = pr.other;
    c.pair = null; o.pairOf = null; c.ikPole = o.ikPole = o.lookBody = null;
    if (c.ikT) c.ikT = {};
    if (o.ikT) o.ikT = {};
    if (pr.M.lead && c.poseName === pr.M.lead) pose(c, 'stand');
    if (pr.mode === 'carry' || pr.mode === 'shoulders') { o.root.position.y = World.groundAt(o.root.position.x, o.root.position.z, o.root.position.y + 1, 0.1); pose(o, 'stand', { direct: true, dur: 0.35 }); }
    if (pr.mode === 'face_hold') { c.lookAt(null); o.lookAt(null); }
  }
  const _lp = new V3(), _m4 = new THREE.Matrix4();
  function pairUpdate(c, dt) {
    const pr = c.pair, o = pr.other, M = pr.M;
    pr.t = Math.min(1, pr.t + dt / 0.45);
    const k = sm(pr.t);
    const pl = M.place(c, o);
    c.root.updateMatrixWorld(true);
    const target = _lp.set(pl.p[0], pl.p[1], pl.p[2]).applyMatrix4(c.root.matrixWorld);
    const yaw = c.root.rotation.y + pl.yaw;
    if (M.followerIsBase) {                                   // pin: the leader moves onto the lying follower instead
      const inv = _lp.set(-pl.p[0], 0, -pl.p[2]).applyAxisAngle(new V3(0, 1, 0), o.root.rotation.y + Math.PI);
      c.root.position.lerpVectors(pr.from.lp || (pr.from.lp = c.root.position.clone()), new V3().copy(o.root.position).add(inv), k);
      c.root.rotation.y = lerpAngle(pr.from.ly ?? (pr.from.ly = c.root.rotation.y), o.root.rotation.y + Math.PI, k);
    } else {
      o.root.position.lerpVectors(pr.from.p, target, k);
      o.root.rotation.y = lerpAngle(pr.from.yaw, yaw, k);
    }
    c.root.updateMatrixWorld(true); o.root.updateMatrixWorld(true);
    // IK targets
    const T = (ch, S, p, w) => { const t = ch.ikT || (ch.ikT = {}); t[S] = { p, w: w * k }; };
    const s = c.D.s, os = o.D.s;
    if (pr.mode === 'carry') {
      T(c, 'L', bonePt(o, 'chest', [-0.02, -0.02, -0.14], new V3()), 1);
      T(c, 'R', bonePt(o, 'shinL', [0, 0.02, -0.07], new V3()).lerp(bonePt(o, 'shinR', [0, 0.02, -0.07], new V3()), 0.5), 1);
      T(o, 'R', bonePt(c, 'neck', [0.035, 0.0, -0.045], new V3()), 0.9);      // her arm round his neck
      o.ikPole = { R: [-0.5, 1.0, 0.1] };
      o.lookAt(c);
    } else if (pr.mode === 'hug') {
      T(c, 'L', bonePt(o, 'chest', [-0.1, 0.02, -0.13], new V3()), 1); T(c, 'R', bonePt(o, 'chest', [0.1, -0.05, -0.12], new V3()), 1);
      const low = o.D.H < c.D.H - 0.12;
      T(o, 'L', bonePt(c, low ? 'spine' : 'chest', [-0.11, low ? 0.02 : -0.02, -0.12], new V3()), 1); T(o, 'R', bonePt(c, low ? 'spine' : 'chest', [0.11, low ? 0.05 : 0.02, -0.12], new V3()), 1);
      addHead(c, 0.45, 0.25, 0.12); addHead(o, low ? -0.6 : 0.45, low ? 0.35 : 0.25, low ? 0.05 : 0.1);
    } else if (pr.mode === 'face_hold') {
      T(c, 'L', bonePt(o, 'head', [-0.074, 0.0, 0.035], new V3()), 1); T(c, 'R', bonePt(o, 'head', [0.074, 0.0, 0.035], new V3()), 1);
    } else if (pr.mode === 'pin') {
      T(c, 'L', o.point('shoulder_r', new V3()).add(new V3(0, 0.04, 0)), 1);
      T(c, 'R', o.point('eyes', new V3()).add(new V3(0, 0.14, 0)), 1);
      T(o, 'L', bonePt(c, 'chest', [0.08, 0.02, 0.12], new V3()), 0.8); T(o, 'R', bonePt(c, 'foreArmR', [0, -0.12, 0], new V3()), 0.9);
    } else if (pr.mode === 'cradle') {                        // his left arm under her shoulders (her head in its crook), right hand at her hair
      T(c, 'L', bonePt(o, 'chest', [0.1, 0.1, -0.04], new V3()), 1);
      T(c, 'R', bonePt(o, 'head', [-0.1, 0.05, -0.06], new V3()), 0.85);   // cupping the back of her head, fingers in her hair
      T(o, 'L', bonePt(o, 'spine', [0.03, 0.02, 0.11], new V3()), 1);   // her own left hand rests on her stomach
      c.ikPole = { L: [1.2, -1.2, -0.1] };
      const g = pr.grip && !o.gripRelease ? 1 : 0;
      o.gripW = lerp(o.gripW ?? g, g, 1 - Math.exp(-3 * dt));
      T(o, 'R', bonePt(c, 'chest', [0.02, 0.09, 0.14], new V3()), o.gripW);
      o.lookAt(c); c.lookAt(o); o.lookBody = 0.3;                         // her face stays up, toward the camera; her eyes find him
    } else if (pr.mode === 'shoulders') {
      T(o, 'L', bonePt(c, 'head', [0.06, 0.1, 0.02], new V3()), 1); T(o, 'R', bonePt(c, 'head', [-0.06, 0.1, 0.02], new V3()), 1);
      T(c, 'L', bonePt(o, 'shinL', [0, -0.1, 0.02], new V3()), 1); T(c, 'R', bonePt(o, 'shinR', [0, -0.1, 0.02], new V3()), 1);
    } else if (pr.mode === 'drag') {
      T(c, 'L', bonePt(o, 'chest', [0.05, 0.14, 0.08], new V3()), 1); T(c, 'R', bonePt(o, 'chest', [-0.05, 0.14, 0.08], new V3()), 1);
    }
  }
  function addHead(ch, yaw, tilt, pitch) { const b = ch.bones.head; _e.set(pitch, yaw, tilt); b.quaternion.multiply(_q.setFromEuler(new THREE.Euler(pitch, yaw, tilt, 'YXZ'))); }
  const lerpAngle = (a, b, t) => a + U.wrapAngle(b - a) * t;

  return { pose, gesture, apply, post, attach, detach, pairUpdate, armIK, G, MODES, bonePt };
})();
