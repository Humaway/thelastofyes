// ============================================================================
// Play — player controller, third-person camera, (later) combat, stealth, crafting,
// inventory, health. Owned by: core (Prologue scope) then systems agent (Chapter 1+).
//
// CONTRACT
//   Play.setPlayer(char | null, profile)  profile: { walk=1.5, jog=3.2, run=5.2 (0 disables), accel=8, canCrouch, canJump,
//        combat=false, hud=false, carry: Character (being carried; forces carry gait), limp, speedMul, footsteps=true }
//   Play.char, Play.enabled, Play.enable(on)      (disabled = no input; camera still follows)
//   Play.update(dt)                                reads Input, moves the player with World collisions, updates camPose
//   Play.camPose { pos: Vector3, target: Vector3, fov }   gameplay camera (Director blends to/from this)
//   Play.snapCamera()                              place camPose behind the player instantly (after teleports)
//   Play.lookMode(anchor Object3D | null, {yaw:[min,max], pitch:[min,max], fov, offset:[x,y,z]})  camera-only look-around from an
//        anchor (e.g. a car back seat). Input.look rotates within limits; movement disabled. null returns to OTS.
//   Play.forceLook(point | null, strength 0..1)    pull the view toward a point (e.g. "camera is forced away" beats)
//   Play.nudge(point, dur=1)                       soft camera nudge toward a subject without taking control
//   Play.shake(amount, dur)                        camera shake (respects SETTINGS.shake)
//   Play.health / Play.maxHealth / Play.damage(n, src) / Play.heal(n)  → Game.die() at 0
//   Play.inventory, Play.resetInventory(), Play.setInventory(obj), Play.give(item, n)
// ============================================================================
const Play = (() => {
  let char = null, profile = {}, enabled = false;
  const camPose = { pos: new THREE.Vector3(0, 2, 5), target: new THREE.Vector3(), fov: 70 };
  let camYaw = 0, camPitch = 0.12, speed = 0, lookAnchor = null, lookOpts = null, lookYaw = 0, lookPitch = 0;
  let nudge = null, forced = null, shakeAmt = 0, shakeT = 0, stepAcc = 0;
  const vel = new THREE.Vector3(), tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), camDist = { v: 2.2 };
  const DEF = { walk: 1.5, jog: 3.2, run: 5.2, accel: 8, footsteps: true };

  function setPlayer(c, p = {}) { char = c; profile = Object.assign({}, DEF, p); speed = 0; if (c) { camYaw = c.yaw + Math.PI; snapCamera(); } }
  function enable(on) { enabled = !!on; if (on) Input.lock(); }
  function snapCamera() { if (!char) return; camYaw = char.yaw; camPitch = 0.12; computeOts(1e3); }

  function computeOts(dt) {
    const p = char.root.position;
    const back = camDist.v, side = 0.45, h = 1.55 * (char.height / 1.8);
    const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
    const pivot = tmp.set(p.x, p.y + h, p.z);
    const cp = Math.cos(camPitch), sp = Math.sin(camPitch);
    const want = tmp2.set(pivot.x - fx * back * cp + fz * -side, pivot.y + sp * back, pivot.z - fz * back * cp - fx * -side);
    // camera collision: pull in toward the pivot
    const t = World.raycast(pivot, want, 'cam');
    if (t < 1) want.lerpVectors(pivot, want, Math.max(0.15, t - 0.08));
    const k = 1 - Math.exp(-18 * dt);
    camPose.pos.lerp(want, k);
    const look = pivot.clone().add(new THREE.Vector3(fx * 4, -sp * 2.5, fz * 4)).add(new THREE.Vector3(fz * -side * 0.5, 0, -fx * -side * 0.5));
    if (nudge) { nudge.t += dt; const w = Math.sin(Math.PI * U.clamp(nudge.t / nudge.dur)) * 0.35; look.lerp(nudge.point, w); if (nudge.t >= nudge.dur) nudge = null; }
    camPose.target.lerp(look, k);
    camPose.fov = SETTINGS.fov;
  }

  function update(dt) {
    if (!char) return;
    if (lookAnchor) { updateLook(dt); return; }
    const ctl = enabled && !Director.active;
    // camera orbit
    if (ctl) { camYaw -= Input.look.x; camPitch = U.clamp(camPitch + Input.look.y, -0.5, 0.9); }
    // movement relative to camera
    let mx = ctl ? Input.move.x : 0, my = ctl ? Input.move.y : 0;
    const carry = !!profile.carry;
    let top = profile.walk;
    if (ctl && Input.down('sprint') && profile.run > 0 && !carry) top = profile.run;
    else if (carry || profile.limp) top = profile.jog > 0 ? Math.min(profile.jog, carry ? 2.4 : 1.2) : profile.walk;
    else if (Math.hypot(mx, my) > 0.6 && profile.jog > 0) top = profile.jog;
    top *= profile.speedMul ?? 1;
    const inputMag = Math.min(1, Math.hypot(mx, my));
    const target = inputMag * top;
    speed = U.damp(speed, target, target > speed ? profile.accel * 0.6 : profile.accel, dt);
    if (inputMag > 0.05) {
      const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
      const dx = fx * my - fz * mx, dz = fz * my + fx * mx;   // camera-forward/right
      const want = Math.atan2(dx, dz);
      char.yaw = U.angleDamp(char.yaw, want, speed > 4 ? 5 : 10, dt);
    }
    if (speed > 0.01) {
      const p = char.root.position, f = U.fwd(char.yaw, tmp);
      const r = World.move(p.x, p.y, p.z, f.x * speed * dt, f.z * speed * dt, 0.33, char.height);
      p.x = r.x; p.z = r.z;
      const g = World.groundAt(p.x, p.z, p.y + 0.01, 0.1);
      p.y = g > p.y ? U.damp(p.y, g, 25, dt) : Math.max(g, p.y - 6 * dt);
      if (profile.footsteps) { stepAcc += speed * dt; const stride = speed > 4 ? 1.6 : 1.25; if (stepAcc > stride) { stepAcc = 0; Audio.footstep(World.surfaceAt(p.x, p.z, p.y), p, U.clamp(speed / 5)); } }
    }
    char.setMove(speed, { carry, limp: profile.limp });
    camDist.v = U.damp(camDist.v, 2.2, 4, dt);
    computeOts(dt);
    applyShake(dt);
  }

  function updateLook(dt) {
    const o = lookOpts;
    if (enabled) { lookYaw = U.clamp(lookYaw - Input.look.x, o.yaw[0], o.yaw[1]); lookPitch = U.clamp(lookPitch - Input.look.y, o.pitch[0], o.pitch[1]); }
    if (forced) { lookYaw = U.damp(lookYaw, forced.yaw, 6 * forced.k, dt); }
    lookAnchor.updateWorldMatrix(true, false);
    camPose.pos.set(...(o.offset || [0, 0, 0])).applyMatrix4(lookAnchor.matrixWorld);
    const q = new THREE.Quaternion().setFromRotationMatrix(lookAnchor.matrixWorld);
    const dir = tmp.set(Math.sin(lookYaw) * Math.cos(lookPitch), Math.sin(lookPitch), Math.cos(lookYaw) * Math.cos(lookPitch)).applyQuaternion(q);
    camPose.target.copy(camPose.pos).add(dir);
    camPose.fov = o.fov || SETTINGS.fov;
    applyShake(dt);
  }
  function lookMode(anchor, o = {}) { lookAnchor = anchor; lookOpts = Object.assign({ yaw: [-2, 2], pitch: [-0.6, 0.5] }, o); lookYaw = o.startYaw || 0; lookPitch = 0; if (!anchor) forced = null; }
  // yaw-space force toward a world point (look mode) — computed relative to anchor
  function forceLook(point, k = 1) {
    if (!point || !lookAnchor) { forced = null; return; }
    const inv = new THREE.Matrix4().copy(lookAnchor.matrixWorld).invert();
    const lp = U.v3(point, tmp).applyMatrix4(inv);
    forced = { yaw: Math.atan2(lp.x, lp.z), k };
  }
  function applyShake(dt) {
    if (shakeT <= 0 || !SETTINGS.shake) return;
    shakeT -= dt; const a = shakeAmt * U.clamp(shakeT * 2);
    camPose.pos.x += (Math.random() - 0.5) * a; camPose.pos.y += (Math.random() - 0.5) * a;
  }

  const inventory = {};
  function resetInventory() { for (const k in inventory) delete inventory[k]; Object.assign(inventory, { ammo: {}, items: {}, weapons: [] }); }
  resetInventory();

  return {
    setPlayer, enable, update, snapCamera, lookMode, forceLook, camPose, inventory, resetInventory,
    setInventory(o) { resetInventory(); Object.assign(inventory, JSON.parse(JSON.stringify(o))); },
    give(item, n = 1) { inventory.items[item] = (inventory.items[item] || 0) + n; },
    nudge(point, dur = 1) { nudge = { point: U.v3(point).clone(), dur, t: 0 }; },
    shake(a, d) { shakeAmt = a; shakeT = d; },
    health: 100, maxHealth: 100, damage() {}, heal() {},
    get char() { return char; }, get enabled() { return enabled; }, get speed() { return speed; }, get profile() { return profile; },
    get camYaw() { return camYaw; }, set camYaw(v) { camYaw = v; },
  };
})();
