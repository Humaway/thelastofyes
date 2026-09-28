// ============================================================================
// Director — plays cutscene scripts from CONTENT.scenes; owns the final camera pose each
// frame (blends gameplay <-> cinematic), letterbox, DOF focus, cues. Owned by: cinema agent.
// Scene format: ARCHITECTURE.md "Scene format"; the details below complete it.
//
// CONTRACT
//   Director.play(id, {skippable}) -> Promise   resolves when the scene ends (when its exit blend starts)
//   Director.active (bool), Director.sceneId, Director.shot (index of the running shot, -1 outside scenes)
//   Director.update(dt)       advance scene time: actions, lines, cues, shot changes, hold-to-skip
//   Director.camUpdate(dt)    write Engine.camera from: active shot | held frame | manual pose | Play.camPose (+ blend, shake, DOF)
//   Director.stop()           abort silently (flow cancelled): gameplay camera, letterbox/DOF/slowmo/scene loops off
//   Director.skip()           dip to black, jump to the end state, apply side effects (scene.end), fade up into the exit blend
//   Director.manual(pose | null)  free camera override outside scenes (title screen, drive): {pos, target, fov} (live Vector3s)
//   Director.point(spec, out?) -> Vector3   resolve any position spec (below) to world space
//   Director.release(dur = 1.2)   end an exit {hold}: blend to gameplay and retract the letterbox
//
// DETAILS
//   Start: blend 0.8 s from the live camera (start.blend: s) or cut (start.cut, and whenever the blend would be ugly: the live
//     camera is > 40 m from the first shot (right after an area load), turns > 110° or its path crosses a character).
//     Cast members visible in the outgoing frame walk to marks < 3.5 m away during the blend; the rest are placed at once
//     (off-screen) or at mid-blend. A cast id that is neither an actor nor an
//     area char is created: from `def` as an area char, else as a persistent actor when Chars.defs has the id.
//     scene.grade / music / silence / amb apply at start; the letterbox slides in over 0.6 s.
//   Timing: line pause default 0.3 s, shot hold default 0.5 s; a shot with no lines, dur or timed content lasts 2 s.
//     slowmo {scale, dur}: dur is real seconds; everything else is scene time (slowed with it).
//   Actions: sit/stand/kneel/lie/pose take an optional `at` (walk there, turn to the marker's yaw, then pose); walkTo/runTo
//     take `yaw` (turn on arrival); fire takes `sfx` (default 'gunshot'); give/take move a named prop between right hands;
//     gesture passes its options through ({hold: true} keeps it until a gesture action with name: null).
//   Exit: {blend:'gameplay', dur:1.2} (default: Play.snapCamera(), then blend to the live gameplay or manual camera while
//     the letterbox retracts; the flow re-enables control; when the last shot looks at the player's front, the gameplay camera
//     takes the shot's heading (Play.camYaw) so the blend never swings through the player) · {cut:true} ·
//     {fade:'black'|'white', dur:1} (fades, then cuts to gameplay under the colour; the flow fades back in with
//     G.fade('none')) · {hold:true} (keeps the last frame and the letterbox until the next scene or Director.release()).
//   scene.end: { place:{who: at | {at, yaw}}, pose:{who: name}, flags:{…}, call:{hook, args} } — at the end and on skip.
//   Skip: hold Space / pad A 1.5 s (UI.skipRing) when skippable !== false, or the scene was seen, or play(id,{skippable:true}).
//     Remaining state-changing actions apply instantly (place, walkTo/runTo -> destination, turnTo, poses, props, give/take,
//     attach/detach, show/hide, badge, decal, phoneGlow, gesture releases) and state cues (music, amb, grade, look, loop, stopLoop,
//     ui); lines, gestures, emotes, looks, sfx, shake, slowmo, title and call are dropped (put essentials in scene.end).
//   Lines: a line still playing when a shot with a fixed `dur` ends carries into the next shot (L-cut); that shot's lines
//     wait for it. Before speaking, the speaker looks at `to` or the nearest cast member (eyes lead); cast members within
//     6 m look at the speaker; an emote:'lying' line looks past the listener. A lookAt action pins that character's gaze.
//   scene.key: false | {strength=0.7, color}: in shots of 40 mm and longer the subject gets a soft face key light and a
//     tight shadow frustum (Engine.cineKey / Engine.shadowFocus); false turns both off (e.g. for pitch-dark scenes).
//   Focus: default = the speaker while on screen (never an ots foreground shoulder), else the shot's subject.
//     'who' | spec | { rack:[a, b], at, dur } | null (no DOF). Aperture follows lens and focus distance.
//   CamSpec: lens default per type (35; crane 28; ots 50; two_shot 40; close 65; extreme_close 100, hands/badge 85, phone 50;
//     pov 40). dur = camera move time (default: the shot length). ease, push, handheld, blend as in ARCHITECTURE.md.
//     orbit: around (aim point), radius 2.5, height (relative to the aim point), from/to degrees relative to the subject's
//       facing (0 = in front, 90 = its left).
//     ots {over, on} / two_shot {a, b}: `side` is literal for the first shot of a pair in a scene; later ots / two_shot /
//       close shots on that pair stay on the same side of the line (180° rule), so the reverse shot flips shoulders itself.
//     close / extreme_close: shot from the partner's side when the character is in an exchange, else from its front;
//       distance from the lens unless `dist`. extreme_close parts: eyes hands hand_r badge phone; `badge` is the infection
//       Badge (c.badge) when one is shown, framed square-on, else the name badge.
//     follow: offset [x right, y up, z forward] from the feet (default [0.55, 1.75, -2.4]), lookAhead 1.5 m.
//     Computed positions (orbit, ots, two_shot, close, extreme_close, follow) are pulled in front of walls (World 'cam').
//   Cue kinds are matched in this order: music sfx loop stopLoop amb title shake slowmo grade look ui letterbox call fade
//     (so `fade` can be a parameter of music/amb/stopLoop). ui: { ui: { phone: state|null } }.
//   Position specs: [x,y,z] · 'mk_name' · 'who' (head) · 'who.part' · { of: who|marker, off: [x right, y up, z forward] }.
// ============================================================================
const Director = (() => {
  const LENS = { crane: 28, ots: 50, two_shot: 40, close: 65, extreme_close: 100, pov: 40 };
  const XC = { eyes: [0.16, 0.14], hands: [0.34, 0], hand_r: [0.24, 0], badge: [0.2, 0.35], phone: [0.2, 0] };  // frame height m, angle off the partner line
  const AUTO = ['orbit', 'ots', 'two_shot', 'close', 'extreme_close', 'follow'];   // computed positions get camera collision
  const KINDS = ['music', 'sfx', 'loop', 'stopLoop', 'amb', 'title', 'shake', 'slowmo', 'grade', 'look', 'ui', 'letterbox', 'call', 'fade'];
  const UP = new THREE.Vector3(0, 1, 0);
  const v3 = () => new THREE.Vector3();
  const mkPose = () => ({ pos: v3(), quat: new THREE.Quaternion(), fov: 50 });
  const shotPose = mkPose(), mixPose = mkPose(), basePose = mkPose();
  const m4 = new THREE.Matrix4(), eul = new THREE.Euler(), rq = new THREE.Quaternion(), seg = new THREE.Line3();
  const C = v3(), T = v3(), A = v3(), B = v3(), D = v3(), subj = v3(), focusPt = v3(), tv = v3(), fo = v3(), lie = v3();
  let S = null, manualPose = null, held = null, blend = null, shake = null, slow = null, skipT = 0, clock = 0, fadeDof = false, heldDof = false;
  const loops = {};
  const quiet = p => p && p.catch && p.catch(e => { if (e !== Game.ABORT) console.error(e); });
  const byT = list => [...(list || [])].sort((a, b) => (a.t || 0) - (b.t || 0));
  const kind = k => KINDS.find(n => k[n] !== undefined);

  // ---- position specs ------------------------------------------------------
  const who = s => typeof s === 'string' ? Game.who(s) : s && s.root ? s : null;   // Game.who passes non-strings through
  const isMarker = s => typeof s === 'string' && !Game.who(s);
  function mark(n) { for (const A of Game.areas.values()) if (A.markers[n]) return A.markers[n]; throw new Error(`no character or marker '${n}'`); }
  function frameOf(of) { const c = who(of); return c ? { pos: c.root.getWorldPosition(fo), yaw: c.yaw } : mark(of); }
  function point(spec, out = v3()) {
    if (Array.isArray(spec)) return out.fromArray(spec);
    if (typeof spec === 'string') {
      const i = spec.indexOf('.'), c = who(i < 0 ? spec : spec.slice(0, i));
      return c ? c.point(i < 0 ? 'head' : spec.slice(i + 1), out) : out.copy(mark(spec).pos);
    }
    if (spec.isVector3) return out.copy(spec);
    if (spec.root) return spec.point('head', out);
    if (spec.of != null) {
      const f = frameOf(spec.of), o = spec.off || [0, 0, 0], s = Math.sin(f.yaw), c = Math.cos(f.yaw);
      return out.set(f.pos.x - c * o[0] + s * o[2], f.pos.y + o[1], f.pos.z + s * o[0] + c * o[2]);
    }
    return out.copy(spec.pos);
  }
  const eyes = (spec, out) => { const c = who(spec); return c ? c.point('eyes', out) : point(spec, out); };
  const ground = (spec, out = v3()) => { const c = who(spec); return c ? c.root.getWorldPosition(out) : point(spec, out); };
  const yawOf = spec => { const c = who(spec); return c ? c.yaw : isMarker(spec) ? mark(spec).yaw : 0; };
  const placeAt = (c, spec, yaw) => Game.place(c, isMarker(spec) ? spec : ground(spec), yaw);
  const lookSpec = at => who(at) || point(at);
  const turnSpec = to => typeof to === 'number' ? to : who(to) || ground(to);

  // ---- poses ---------------------------------------------------------------
  function lookPose(p, from, to) { m4.lookAt(from, to, UP); p.quat.setFromRotationMatrix(m4); p.pos.copy(from); return p; }
  function snap(p = mkPose()) { const c = Engine.camera; p.pos.copy(c.position); p.quat.copy(c.quaternion); p.fov = c.fov; return p; }
  function base() { const b = manualPose || Play.camPose; lookPose(basePose, b.pos, b.target).fov = b.fov; return basePose; }
  // Target point that puts `at` at NDC (nx, ny) for a camera at `from` (small-angle composition).
  function aim(out, from, at, nx, ny, fov) {
    const tn = Math.tan(fov * Math.PI / 360), dx = at.x - from.x, dy = at.y - from.y, dz = at.z - from.z;
    const yaw = Math.atan2(dx, dz) + Math.atan(nx * tn * Engine.camera.aspect), pitch = Math.atan2(dy, Math.hypot(dx, dz)) - Math.atan(ny * tn);
    return out.set(from.x + Math.sin(yaw) * Math.cos(pitch), from.y + Math.sin(pitch), from.z + Math.cos(yaw) * Math.cos(pitch));
  }
  function onScreen(p) { tv.copy(p).project(Engine.camera); return tv.z < 1 && Math.abs(tv.x) < 0.95 && Math.abs(tv.y) < 0.95; }
  function seen(c) { return c.root.visible && onScreen(c.point('chest', tv)); }

  // 180° rule: the first ots/two_shot on a pair fixes the camera's side of the line (canonical order a < b); later
  // shots on the pair derive their shoulder from it. Returns the side (+1 right / -1 left) relative to the line a -> b.
  function lineSide(a, b, want) {
    const flip = a < b ? 1 : -1, key = flip > 0 ? a + '|' + b : b + '|' + a;
    if (S.sides[key] == null) S.sides[key] = want * flip;
    S.partner[a] = b; S.partner[b] = a;
    return S.sides[key] * flip;
  }
  // Direction from `who` toward its exchange partner (or along its facing), turned `ang` toward the established side.
  function coverDir(out, id, at, ang, want) {
    const p = S.partner[id], pc = p && who(p);
    let s = want;
    if (pc) { pc.point('eyes', out).sub(at).setY(0).normalize(); s = lineSide(id, p, want); } else U.fwd(yawOf(id), out);
    const x = out.x, z = out.z, c = Math.cos(ang), n = Math.sin(ang) * s;
    return [out.set(x * c - z * n, 0, z * c + x * n), s];
  }

  // ---- shot camera -----------------------------------------------------------
  function evalShot(dt) {
    const c = S.shot.cam || {}, type = c.type || 'static', part = c.part || 'eyes';
    const fov = U.lensToFov(c.lens || (type === 'extreme_close' && part !== 'eyes' ? (part === 'phone' ? 50 : 85) : LENS[type] || 35));
    const tn = Math.tan(fov * Math.PI / 360), vis = S.def.letterbox === false ? 1 : Math.min(1, Engine.camera.aspect / 2.39);
    const u = (U.ease[c.ease] || U.ease.inOut)(U.clamp(S.st / S.moveDur)), want = c.side === 'left' ? -1 : 1;
    let nx = null, ny = 0;
    S.fg = null;
    switch (type) {
      case 'dolly': case 'crane':
        C.lerpVectors(point(c.from, A), point(c.to, B), u); point(c.look, T);
        if (c.lookTo) T.lerp(point(c.lookTo, D), u);
        subj.copy(T); break;
      case 'pan': {
        point(c.at, C); point(c.look, A).sub(C); point(c.lookTo, B).sub(C);
        const la = A.length(), lb = B.length(), th = A.normalize().angleTo(B.normalize());
        T.copy(A); if (th > 1e-4) T.multiplyScalar(Math.sin((1 - u) * th)).addScaledVector(B, Math.sin(u * th)).divideScalar(Math.sin(th));
        T.multiplyScalar(U.lerp(la, lb, u)).add(C); subj.copy(T); break;
      }
      case 'orbit': {
        point(c.around, subj);
        const a = yawOf(c.around) + U.lerp(c.from ?? 0, c.to ?? 0, u) * Math.PI / 180, r = c.radius ?? 2.5;
        C.set(subj.x + Math.sin(a) * r, subj.y + (c.height ?? 0), subj.z + Math.cos(a) * r); nx = 0; ny = 0.25 * vis; break;
      }
      case 'ots': {
        point(c.over, A); eyes(c.on, subj);
        D.subVectors(subj, A).setY(0).normalize();
        const s = lineSide(c.over, c.on, want), lat = 0.55 * s, back = c.dist ?? 0.8;
        C.set(A.x - D.x * back - D.z * lat, A.y - 0.02, A.z - D.z * back + D.x * lat);
        nx = 0.24 * s; ny = 0.3 * vis; S.fg = who(c.over); break;
      }
      case 'two_shot': {
        eyes(c.a, A); eyes(c.b, B); subj.addVectors(A, B).multiplyScalar(0.5);
        D.subVectors(B, A).setY(0);
        const w = D.length(), s = lineSide(c.a, c.b, want), dist = c.dist ?? Math.max(1.6, (w + 1.1) / (2 * tn * Engine.camera.aspect));
        D.normalize();
        const k = Math.cos(0.26), n = Math.sin(0.26);   // 15° toward a, so b's face opens to the camera
        C.set(-D.z * s * k - D.x * n, 0, D.x * s * k - D.z * n).multiplyScalar(dist).add(subj);
        D.subVectors(A, C).normalize().add(tv.subVectors(B, C).normalize()).setY(0).normalize();   // bisector: a is nearer, so it projects wider
        subj.set(C.x + D.x * dist, subj.y, C.z + D.z * dist);
        nx = 0; ny = 0.22 * vis; break;
      }
      case 'close': case 'extreme_close': {
        const W = who(c.who), mark = type === 'extreme_close' && part === 'badge' && W.badgeObj && W.badgeObj.mesh;
        const xc = type === 'close' ? [0.56, 0.38] : mark ? [0.16, 0] : XC[part];
        if (mark) mark.getWorldPosition(subj);
        else if (type === 'close' || part === 'eyes') W.point('eyes', subj);
        else if (part === 'hands') W.point('hand_l', subj).add(W.point('hand_r', A)).multiplyScalar(0.5);
        else W.point(part === 'phone' ? 'hand_r' : part, subj);
        const [dir, s] = coverDir(D, c.who, subj, xc[1], want), dist = c.dist ?? xc[0] / (2 * vis * tn);
        nx = 0; ny = 0;
        if (mark) {   // along the Badge's normal, pulled toward the character's front and slightly above
          mark.getWorldQuaternion(rq); A.set(0, 0, 1).applyQuaternion(rq);
          C.copy(dir).multiplyScalar(0.8).add(A).addScaledVector(UP, 0.35).normalize().multiplyScalar(dist).add(subj);
        } else if (type === 'extreme_close' && part === 'phone') {   // over the shoulder, down the eye line onto the screen
          W.point('eyes', A); B.subVectors(A, subj).normalize();
          C.set(-B.z * s, 0, B.x * s).normalize().multiplyScalar(0.28).add(A).addScaledVector(B, 0.18); C.y += 0.06;
        } else if (type === 'extreme_close' && part !== 'eyes' && part !== 'badge') {   // hands: from above and in front
          C.copy(dir).multiplyScalar(0.8).addScaledVector(UP, 0.6).normalize().multiplyScalar(dist).add(subj);
        } else {
          C.copy(dir).multiplyScalar(dist).add(subj); C.y += 0.02;
          if (type === 'close') { nx = -0.14 * s; ny = 0.3 * vis; } else ny = 0.02;
        }
        break;
      }
      case 'pov': point(c.look, T); eyes(c.who, C); C.addScaledVector(D.subVectors(T, C).normalize(), 0.12); subj.copy(T); break;
      case 'follow': {
        const W = who(c.who), o = c.offset || [0.55, 1.75, -2.4], f = S.follow || (S.follow = { yaw: W.yaw, pos: null });
        f.yaw = U.angleDamp(f.yaw, W.yaw, 2.5, dt);
        const s = Math.sin(f.yaw), co = Math.cos(f.yaw);
        W.root.getWorldPosition(A);
        A.set(A.x - co * o[0] + s * o[2], A.y + o[1], A.z + s * o[0] + co * o[2]);
        f.pos = f.pos ? f.pos.lerp(A, 1 - Math.exp(-6 * dt)) : A.clone();
        C.copy(f.pos); W.point('head', subj); T.copy(subj).addScaledVector(U.fwd(f.yaw, D), c.lookAhead ?? 1.5); break;
      }
      default: point(c.at || c.from, C); point(c.look, T); subj.copy(T);   // static, handheld
    }
    if (AUTO.includes(type)) { const k = World.raycast(subj, C, 'cam'); if (k < 1) C.lerpVectors(subj, C, Math.max(0.15, k - 0.05)); }   // never behind a wall
    if (c.push) C.lerp(subj, c.push * U.ease.sine(U.clamp(S.st / S.estLen)));
    if (nx != null) aim(T, C, subj, nx, ny, fov);
    lookPose(shotPose, C, T).fov = fov;
    const h = c.handheld ?? (type === 'handheld' ? 0.6 : 0);
    if (h) {   // low-frequency layered sines: breathing operator, never jitter
      const t = clock;
      eul.set(h * 0.009 * (Math.sin(t * 0.53 + 2.1) * 0.6 + Math.sin(t * 1.61 + 0.2) * 0.3 + Math.sin(t * 3.3 + 1.7) * 0.1),
        h * 0.012 * (Math.sin(t * 0.71) * 0.6 + Math.sin(t * 1.37 + 1.3) * 0.3 + Math.sin(t * 2.9 + 0.4) * 0.1),
        h * 0.006 * (Math.sin(t * 0.37 + 0.9) * 0.7 + Math.sin(t * 1.13 + 2.6) * 0.3), 'YXZ');
      shotPose.quat.multiply(rq.setFromEuler(eul));
      shotPose.pos.x += h * 0.012 * Math.sin(t * 0.61); shotPose.pos.y += h * 0.01 * Math.sin(t * 0.83 + 1); shotPose.pos.z += h * 0.012 * Math.sin(t * 0.47 + 2);
    }
    return shotPose;
  }

  function focusOf(out) {
    const f = S.shot.focus;
    if (f && f.rack) return out.lerpVectors(point(f.rack[0], A), point(f.rack[1], B), U.ease.inOut(U.clamp((S.st - (f.at ?? 0)) / (f.dur ?? 1.5))));
    if (f != null) return eyes(f, out);
    const sp = S.speaker;
    return sp && sp !== S.fg && sp.root.visible && onScreen(sp.point('eyes', out)) ? out : out.copy(subj);
  }

  function camUpdate(dt) {
    const gdt = dt * Game.timeScale, cam = Engine.camera;
    clock += gdt;
    let p = held || base(), k = 1;
    if (S) try { p = evalShot(gdt); } catch (e) { p = shotPose; if (!S.broken) { S.broken = true; console.error(`scene ${S.id} shot ${S.idx} camera:`, e); } }
    if (blend) {
      blend.t += gdt; k = U.ease.inOut(U.clamp(blend.t / blend.dur));
      mixPose.pos.lerpVectors(blend.from.pos, p.pos, k); mixPose.quat.slerpQuaternions(blend.from.quat, p.quat, k); mixPose.fov = U.lerp(blend.from.fov, p.fov, k);
      p = mixPose;
    }
    cam.position.copy(p.pos); cam.quaternion.copy(p.quat);
    if (shake) {
      shake.t += gdt;
      const a = SETTINGS.shake ? shake.amt * Math.pow(1 - U.clamp(shake.t / shake.dur), 2) : 0, t = shake.t * 31;
      cam.rotateX(a * 0.05 * (Math.sin(t) + Math.sin(t * 1.73 + 1) * 0.5)); cam.rotateY(a * 0.05 * (Math.sin(t * 1.31 + 2) + Math.sin(t * 2.1) * 0.5));
      cam.position.y += a * 0.06 * Math.sin(t * 1.9 + 0.5);
      if (shake.t >= shake.dur) shake = null;
    }
    if (Math.abs(cam.fov - p.fov) > 1e-4) { cam.fov = p.fov; cam.updateProjectionMatrix(); }
    cam.updateMatrixWorld();
    // long-lens scene shots: a soft face key and a tight shadow frustum on the subject (scene.key: false | {strength, color})
    const lensMM = 12 / Math.tan(cam.fov * Math.PI / 360), kk = S && S.def.key;
    if (S && lensMM >= 40 && kk !== false) {
      focusOf(focusPt);
      const d = cam.position.distanceTo(focusPt);
      Engine.shadowFocus(focusPt, U.clamp(d * 0.7 + 1.2, 2, 6));
      Engine.cineKey(focusPt, cam.position, kk?.strength ?? 0.7, kk?.color);
    } else { Engine.shadowFocus(null); Engine.cineKey(null); }
    // depth of field: scenes only; fades in with the opening blend and out with the exit blend
    const dof = Engine.dof;
    const amt = S ? (S.shot.focus === null ? 0 : blend && blend.into ? k : 1) : held ? +heldDof : blend && blend.out && fadeDof ? 1 - k : 0;
    if (blend && k >= 1) blend = null;
    dof.enabled = amt > 0;
    if (!dof.enabled) return;
    if (S) focusOf(focusPt);
    const dist = Math.max(0.3, cam.position.distanceTo(focusPt)), lens = 12 / Math.tan(cam.fov * Math.PI / 360);
    dof.target = focusPt;
    dof.aperture = 0.0065 * (lens / 50) ** 2 / Math.max(0.6, dist) * amt;
    dof.maxblur = U.clamp(lens * 0.00015, 0.004, 0.013) * amt;
    if (S && S.cutFocus) { dof.focus = dist; S.cutFocus = false; }
  }

  // ---- actions -----------------------------------------------------------------
  function hook(name, args) {
    const f = CONTENT.hooks[name];
    if (!f) { console.error('no hook ' + name); return; }
    try { quiet(f(Game.G, args)); } catch (e) { if (e !== Game.ABORT) console.error(e); }
  }
  function walk(c, a) {
    const dest = a.path ? a.path[a.path.length - 1] : a.at, w = { c, dest, yaw: a.yaw };
    const conv = p => isMarker(p) ? p : ground(p);
    S.walks.push(w);
    c.walkTo(conv(dest), { speed: a.do === 'runTo' ? 'run' : a.speed, path: a.path && a.path.slice(0, -1).map(conv) }).then(() => {
      if (S && S.walks.includes(w)) S.walks.splice(S.walks.indexOf(w), 1);
      if (a.yaw != null) c.turnTo(a.yaw);
    });
  }
  function poseAt(c, name, a) {
    if (a.at == null) return quiet(c.pose(name, a));
    const yaw = a.yaw ?? (isMarker(a.at) ? mark(a.at).yaw : undefined);
    if (U.dist2(c.root.position, ground(a.at, tv)) < 0.3) { placeAt(c, a.at, yaw); quiet(c.pose(name, a)); return; }
    quiet(c.walkTo(isMarker(a.at) ? a.at : ground(a.at)).then(() => yaw != null && c.turnTo(yaw, 0.4)).then(() => c.pose(name, a)));
  }
  function handOver(from, to, a, now) {
    const give = () => { from.drop(a.hand || 'r', { remove: true }); to.hold(a.prop, 'r'); };
    if (now) return give();
    quiet(from.gesture('hand_over', { to })); S.timers.push({ t: 0.6, fn: give });
  }
  const opts = a => a.to == null ? a : Object.assign({}, a, { to: who(a.to) || point(a.to) });   // gesture targets: Character | Vector3
  function act(a) {
    if (a.do === 'call') return hook(a.hook, a.args);
    const c = who(a.who);
    if (!c) { console.warn(`scene ${S.id}: no character ${a.who}`); return; }
    S.chars.add(c);
    switch (a.do) {
      case 'place': placeAt(c, a.at, a.yaw); break;
      case 'walkTo': case 'moveTo': case 'runTo': walk(c, a); break;
      case 'turnTo': quiet(c.turnTo(turnSpec(a.to), a.dur)); break;
      case 'lookAt': S.locked.add(c); c.lookAt(a.at == null ? null : lookSpec(a.at)); break;
      case 'emote': c.emote(a.name, a.dur); break;
      case 'gesture': quiet(c.gesture(a.name, opts(a))); break;
      case 'anim': quiet(c.anim(a.name, opts(a))); break;
      case 'pose': poseAt(c, a.name, a); break;
      case 'sit': case 'stand': case 'kneel': case 'lie': poseAt(c, a.do, a); break;
      case 'die': quiet(c.pose('dead', a)); break;
      case 'hold': c.hold(a.prop, a.hand); break;
      case 'drop': c.drop(a.hand); break;
      case 'give': handOver(c, who(a.to), a); break;
      case 'take': handOver(who(a.from), c, a); break;
      case 'hug': c.attach(who(a.to), 'hug'); break;
      case 'carry': c.attach(who(a.to), 'carry'); break;
      case 'attach': c.attach(who(a.to), a.mode); break;
      case 'detach': c.detach(); break;
      case 'aim': { const p = point(a.at); S.locked.add(c); quiet(c.turnTo(p)); c.lookAt(p); quiet(c.pose('aim', { at: p })); break; }
      case 'fire': quiet(c.gesture('fire', { at: a.at != null ? point(a.at) : null })); Audio.sfx(a.sfx || 'gunshot', { pos: c.point('hand_r') }); break;
      case 'show': c.setVisible(true); break;
      case 'hide': c.setVisible(false); break;
      case 'badge': c.badge(a.value, a.where); break;
      case 'decal': c.decal(a.kind, a.on ?? true); break;
      case 'phoneGlow': c.phoneGlow(a.on ?? true); break;
      default: console.warn('unknown scene action ' + a.do);
    }
  }
  // Skip: the end state of an action that has not run yet.
  function settle(a) {
    const c = who(a.who);
    if (!c) return;
    switch (a.do) {
      case 'place': case 'walkTo': case 'moveTo': case 'runTo': placeAt(c, a.path ? a.path[a.path.length - 1] : a.at, a.yaw); break;
      case 'turnTo': c.yaw = typeof a.to === 'number' ? a.to : U.yawTo(c.root.position, ground(a.to)); break;
      case 'pose': case 'sit': case 'stand': case 'kneel': case 'lie':
        if (a.at != null) placeAt(c, a.at, a.yaw);
        quiet(c.pose(a.do === 'pose' ? a.name : a.do, a)); break;
      case 'give': handOver(c, who(a.to), a, true); break;
      case 'take': handOver(who(a.from), c, a, true); break;
      case 'gesture': if (a.name == null) act(a); break;   // release a held gesture
      case 'die': case 'hold': case 'drop': case 'hug': case 'carry': case 'attach': case 'detach':
      case 'show': case 'hide': case 'badge': case 'decal': case 'phoneGlow': act(a); break;
    }
  }

  // ---- cues ----------------------------------------------------------------------
  function cue(k) {
    switch (kind(k)) {
      case 'music': k.music === 'stop' ? Audio.stopMusic(k.fade ?? 2) : Audio.music(k.music, { fade: k.fade }); break;
      case 'sfx': Audio.sfx(k.sfx, { pos: k.at != null ? point(k.at) : undefined, vol: k.vol, rate: k.rate }); break;
      case 'loop': loops[k.id || k.loop] = Audio.loop(k.loop, { pos: k.at != null ? point(k.at) : undefined, vol: k.vol }); break;
      case 'stopLoop': { const l = loops[k.stopLoop]; if (l) l.stop(k.fade ?? 1); delete loops[k.stopLoop]; break; }
      case 'amb': Audio.amb(k.amb, k.fade ?? 2); break;
      case 'title': quiet(UI.titleText([].concat(k.title), k)); break;
      case 'shake': shake = { amt: k.shake, dur: k.dur ?? 0.6, t: 0 }; break;
      case 'slowmo': Game.timeScale = k.slowmo; slow = { t: k.dur ?? 1 }; break;
      case 'grade': Engine.setGrade(k.grade, k.dur ?? 0); break;
      case 'look': Game.applyLook(CONTENT.levels[k.look]); break;
      case 'ui': UI.phone(k.ui.phone ?? null); break;
      case 'letterbox': UI.letterbox(!!k.letterbox); break;
      case 'call': hook(k.call, k.args); break;
      case 'fade': quiet(UI.fade(k.fade, k.dur ?? 1)); break;
      default: console.warn('unknown scene cue ' + JSON.stringify(k));
    }
  }
  function settleCue(k) {
    const n = kind(k);
    if (n === 'grade') Engine.setGrade(k.grade, 0);
    else if (['music', 'amb', 'look', 'loop', 'stopLoop', 'ui'].includes(n)) cue(k);
  }

  // ---- lines -----------------------------------------------------------------------
  function nearest(sp) {
    let best = null, bd = 10;
    for (const c of S.chars) { const d = c === sp ? 1e9 : c.root.position.distanceTo(sp.root.position); if (d < bd) { bd = d; best = c; } }
    return best;
  }
  function gazeFor(L, sp) {
    if (!sp || S.locked.has(sp)) return undefined;
    const to = L.to != null ? lookSpec(L.to) : nearest(sp);
    if (!to || L.emote !== 'lying') return to;
    return () => {   // eyes slide past the listener
      if (to.root) to.point('head', lie); else lie.copy(to);
      sp.point('head', tv);
      const dx = lie.x - tv.x, dz = lie.z - tv.z, l = Math.hypot(dx, dz) || 1;
      return lie.set(lie.x - dz / l * 0.9, lie.y - 0.35, lie.z + dx / l * 0.9);
    };
  }
  function runLines() {
    const L = S.lines[S.li];
    if (!L) return;
    const sp = who(L.who);
    if (L.t != null ? S.st < L.t : S.line || S.st < S.lastEnd + (L.pause ?? 0.3)) {
      if (!S.line && S.pre !== L && sp) { S.pre = L; const g = gazeFor(L, sp); if (g !== undefined) sp.lookAt(g); }
      return;
    }
    const tok = {};
    S.li++; S.line = tok;
    if (sp) { S.chars.add(sp); S.speaker = sp; for (const c of S.chars) if (c !== sp && !S.locked.has(c) && c.root.position.distanceTo(sp.root.position) < 6) c.lookAt(sp); }
    Dialogue.say(L.who, L.text, { emote: L.emote, dur: L.dur, off: L.off, via: L.via, to: gazeFor(L, sp) })
      .then(() => { if (S && S.line === tok) { S.line = null; S.lastEnd = S.st; } });
  }

  // ---- scene flow ----------------------------------------------------------------------
  function startShot(i) {
    const sh = S.def.shots[i], c = sh.cam || {}, lines = sh.lines || [];
    const minLen = Math.max(c.dur || 0, ...(sh.actions || []).map(a => a.t || 0), ...(sh.cues || []).map(a => a.t || 0));
    let est = sh.dur;
    if (est == null) {
      let t = 0;
      for (const L of lines) t = (L.t ?? t + (L.pause ?? 0.3)) + (L.dur || Dialogue.lineDur(L.text));
      est = Math.max(lines.length ? t + (sh.hold ?? 0.5) : 0, minLen) || 2;
    }
    Object.assign(S, { idx: i, shot: sh, st: 0, ai: 0, ci: 0, li: 0, acts: byT(sh.actions), cues: byT(sh.cues), lines, minLen, estLen: est,
      moveDur: c.dur || est, lastEnd: S.line ? Infinity : 0, follow: null, pre: null, broken: false, speaker: S.line ? S.speaker : null });
    if (i > 0) { blend = c.blend ? { from: snap(), t: 0, dur: c.blend } : null; if (!c.blend) S.cutFocus = true; }
  }
  function shotOver() {
    const sh = S.shot;
    if (S.li < S.lines.length) return false;
    if (sh.dur != null) return S.st >= sh.dur;
    if (S.line && S.lines.length) return false;
    return S.st >= Math.max(S.minLen, S.lines.length ? S.lastEnd + (sh.hold ?? 0.5) : 0) && (S.st >= 2 || S.lines.length > 0 || S.minLen > 0);
  }
  function castList(cast) {   // resolve (or create: straight onto the mark, never seen before) every cast member
    const list = [];
    for (const id in cast || {}) {
      const e = cast[id] && cast[id].constructor === Object && cast[id].of == null ? cast[id] : { at: cast[id] };
      let c = who(id), fresh = !c;
      if (!c && e.def) c = Game.area.char(e.def, { name: id });
      else if (!c && Chars.defs[id]) c = Game.actor(id);
      if (!c) { console.warn(`scene ${S.id}: no cast member ${id}`); continue; }
      S.chars.add(c);
      if (fresh && e.at != null) placeAt(c, e.at, e.yaw);
      list.push({ c, e, fresh });
    }
    return list;
  }
  function castIn(list, cut, bd) {
    for (const { c, e, fresh } of list) {
      const settleIn = () => { if (e.pose) quiet(c.pose(e.pose)); };
      if (e.at == null || fresh) { settleIn(); continue; }
      const dest = ground(e.at), yaw = e.yaw ?? (isMarker(e.at) ? mark(e.at).yaw : undefined), d = U.dist2(c.root.position, dest);
      if (cut || !seen(c)) { placeAt(c, e.at, e.yaw); settleIn(); }
      else if (d < 0.05) { if (yaw != null) quiet(c.turnTo(yaw, 0.5)); settleIn(); }
      else if (d < 3.5) quiet(c.walkTo(dest, { speed: U.clamp(d / bd, 1.1, 2.4) }).then(() => yaw != null && c.turnTo(yaw, 0.3)).then(settleIn));
      else S.timers.push({ t: bd / 2, fn: () => { placeAt(c, e.at, e.yaw); settleIn(); } });
    }
  }
  function applyEnd(e) {
    if (!e) return;
    for (const id in e.place || {}) { const c = who(id), p = e.place[id]; if (c) p && p.constructor === Object && p.at != null ? placeAt(c, p.at, p.yaw) : placeAt(c, p); }
    for (const id in e.pose || {}) { const c = who(id); if (c) quiet(c.pose(e.pose[id])); }
    for (const k in e.flags || {}) Game.G.flags[k] = e.flags[k];
    if (e.call) hook(e.call.hook, e.call.args);
  }
  function flushTimers() { for (const t of S.timers.splice(0)) t.fn(); }
  function crosses(a, b) {   // does the straight camera path a -> b pass through a visible character?
    seg.set(a, b);
    return Chars.all.some(c => c.root.visible && ['head', 'chest'].some(n => seg.closestPointToPoint(c.point(n, tv), true, D).distanceTo(tv) < 0.6));
  }

  function play(id, o = {}) {
    const s = CONTENT.scenes[id];
    if (!s) { console.error('no scene ' + id); return Promise.resolve(); }
    if (S) { const old = S; flushTimers(); applyEnd(old.def.end); S = null; old.resolve(); }
    return new Promise(resolve => {
      const from = snap();
      held = null; skipT = 0;
      S = { id, def: s, resolve, chars: new Set(), locked: new Set(), sides: {}, partner: {}, walks: [], timers: [], line: null, speaker: null,
        canSkip: o.skippable ?? (s.skippable !== false || Save.seen(id)),
        finalFade: s.shots.flatMap(sh => byT(sh.cues)).filter(k => kind(k) === 'fade').pop()?.fade };
      startShot(0);
      const cast = castList(s.cast);
      let bad = false;   // cut instead of blending across the world (after an area load), through a character or turning around
      try { const p = evalShot(0); bad = p.pos.distanceTo(from.pos) > 40 || p.quat.angleTo(from.quat) > 1.9 || crosses(from.pos, p.pos); } catch (e) { bad = false; }
      const cut = !!(s.start && s.start.cut) || bad, bd = cut ? 0 : s.start?.blend ?? 0.8;
      if (s.grade) Engine.setGrade(s.grade, bd);
      if (s.music === 'stop') Audio.stopMusic(2); else if (s.music) Audio.music(s.music);
      if (s.silence) Audio.silence(true, 1.5);
      if (s.amb) Audio.amb(s.amb, 2);
      UI.letterbox(s.letterbox !== false, 0.6);
      castIn(cast, cut, bd);
      for (const sh of s.shots) for (const x of [...(sh.lines || []), ...(sh.actions || [])]) { const c = who(x.who); if (c) S.chars.add(c); }
      S.follow = null;
      blend = cut ? null : { from, t: 0, dur: bd, into: true };
      S.cutFocus = true;
    });
  }

  function finish(skipped) {
    const s = S.def, ex = s.exit || {}, done = S.resolve, fin = S.finalFade && S.finalFade !== 'none' ? S.finalFade : null;
    flushTimers();
    applyEnd(s.end);
    Save.sawScene(S.id);
    for (const c of S.chars) c.lookAt(null);
    if (s.silence) Audio.silence(false, 2);
    UI.skipRing(null);
    fadeDof = heldDof = Engine.dof.enabled;
    S = null;
    if (Play.char) {   // gameplay camera behind the player; when the last shot faces the player, keep its heading instead of swinging round
      Play.snapCamera();
      const h = Math.atan2(-Engine.camera.matrixWorld.elements[8], -Engine.camera.matrixWorld.elements[10]);
      if (!ex.cut && !ex.fade && Math.abs(U.wrapAngle(h - Play.char.yaw)) > Math.PI / 2) Play.camYaw = h;
    }
    if (ex.hold) held = snap();
    else if (ex.cut || ex.fade) { blend = null; UI.letterbox(false, 0); }
    else { const dur = ex.dur ?? 1.2; blend = { from: snap(), t: 0, dur, out: true }; UI.letterbox(false, Math.min(1, dur)); }
    if (skipped) quiet(UI.fade(ex.fade || fin || 'none', ex.fade || fin ? 0.01 : 0.7));   // skipping dipped to black: fade up into the exit
    done();
  }

  function skip() {
    if (!S || S.dip != null) return;
    UI.skipRing(null); skipT = 0;
    S.dip = 0.3; quiet(UI.fade('black', 0.25));
    Dialogue.hush();
  }
  function settleAll() {
    for (const w of S.walks.splice(0)) { w.c.stop(); placeAt(w.c, w.dest, w.yaw); }
    flushTimers();
    for (let i = S.idx; i < S.def.shots.length; i++) {
      const sh = S.def.shots[i];
      for (const a of i === S.idx ? S.acts.slice(S.ai) : byT(sh.actions)) settle(a);
      for (const k of i === S.idx ? S.cues.slice(S.ci) : byT(sh.cues)) settleCue(k);
    }
    if (slow) { Game.timeScale = 1; slow = null; }
    shake = null;
  }

  function fire() {
    while (S && S.ai < S.acts.length && (S.acts[S.ai].t || 0) <= S.st) act(S.acts[S.ai++]);
    while (S && S.ci < S.cues.length && (S.cues[S.ci].t || 0) <= S.st) cue(S.cues[S.ci++]);
  }
  function update(dt) {
    const real = dt / (Game.timeScale || 1);
    if (slow && (slow.t -= real) <= 0) { Game.timeScale = 1; slow = null; }
    if (!S) return;
    if (S.dip != null) { if ((S.dip -= real) <= 0) { settleAll(); finish(true); } return; }
    if (S.fadeOut != null) { if ((S.fadeOut -= dt) <= 0) finish(false); return; }
    if (S.canSkip) {
      skipT = Input.down('skip') ? skipT + real : 0;
      UI.skipRing(skipT > 0.2 ? U.clamp(skipT / 1.5) : null);
      if (skipT >= 1.5) return skip();
    }
    S.st += dt;
    for (const t of S.timers) t.t -= dt;
    for (let i = S.timers.length - 1; i >= 0; i--) if (S.timers[i].t <= 0) S.timers.splice(i, 1)[0].fn();
    fire();
    if (!S) return;
    runLines();
    if (!shotOver()) return;
    if (S.idx + 1 < S.def.shots.length) { startShot(S.idx + 1); fire(); return; }   // t:0 content lands on the cut frame
    if (S.line) return;
    const ex = S.def.exit || {};
    if (ex.fade) { S.fadeOut = ex.dur ?? 1; quiet(UI.fade(ex.fade, S.fadeOut)); } else finish(false);
  }

  function stop() {
    const done = S && S.resolve;
    if (S) { if (S.def.silence) Audio.silence(false, 0.5); for (const c of S.chars) c.lookAt(null); S = null; Dialogue.hush(); }
    blend = held = manualPose = shake = null;
    if (slow) { Game.timeScale = 1; slow = null; }
    for (const k in loops) { loops[k].stop(0.5); delete loops[k]; }
    Engine.dof.enabled = false; UI.letterbox(false, 0); UI.skipRing(null);
    if (done) done();
  }

  function release(dur = 1.2) {
    if (!held) return;
    blend = { from: held, t: 0, dur, out: true }; fadeDof = heldDof; held = null;
    UI.letterbox(false, Math.min(1, dur));
  }

  return {
    play, update, camUpdate, stop, skip, release, point,
    manual(p) { manualPose = p; },
    get active() { return !!S; }, get sceneId() { return S ? S.id : null; }, get shot() { return S ? S.idx : -1; },
  };
})();
