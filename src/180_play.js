// ============================================================================
// Play — player controller, third-person camera, traversal, weapons and combat, stealth
// (crouch, Airplane Mode), throwing, crafting, inventory, pickups, health and death.
// Owned by: systems (player) agent. Spec §3 controls, §5 "Chloe as player", §6, §18 in-game UI.
// Implementation: 180_play (this: state, movement, camera, stealth, health, inventory, area helpers) · 181_play_data
// (CONTENT items/recipes/upgrades/skills) · 183_trav (Trav: traversal) · 185_arms (Arms: weapons, melee, takedowns,
// grabs, throwables, FX) · 187_kit (Kit: pickups, collectibles, backpack crafting, workbench) · 215_ui_play (UI extensions).
//
// CONTRACT
//   Play.setPlayer(char | null, profile)  profile: { walk=1.5, jog=3.2, run=5.2 (0 disables), accel=8, canCrouch, canJump,
//        combat=false, hud=false, carry: Character (being carried; forces carry gait), limp, speedMul, footsteps=true,
//        weapons:['revolver','shotgun','rifle','pistol','bow'] (allowed; default all owned), melee:'fists'|'box_cutter',
//        stats:'chase'|'chloe' }   combat enables aim/fire/melee/throw/crouch/Airplane Mode/backpack; hud shows the HUD.
//   Play.char, Play.enabled, Play.enable(on)      (disabled = no input; camera still follows)
//   Play.update(dt)                                reads Input, moves the player with World collisions, updates camPose
//   Play.camPose { pos: Vector3, target: Vector3, fov }   gameplay camera (Director blends to/from this)
//   Play.snapCamera()                              place camPose behind the player instantly (after teleports)
//   Play.lookMode(anchor Object3D | null, {yaw:[min,max], pitch:[min,max], fov, offset:[x,y,z], startYaw})  camera-only
//        look-around from an anchor (e.g. a car back seat). Input.look rotates within limits; movement disabled. null returns to OTS.
//   Play.forceLook(point | null, strength 0..1)    pull the view toward a point (look mode)
//   Play.nudge(point, dur=1)                       soft camera nudge toward a subject without taking control
//   Play.shake(amount, dur)                        camera shake (respects SETTINGS.shake)
//   Play.health / Play.maxHealth / Play.damage(n, src) / Play.heal(n)  → death at 0; 4 battery segments, regen only up to
//        the top of the current segment. Health 100 (Chloe 60, +15 per max-health skill level). Enemy damage is scaled for
//        difficulty by its dealer (AI). src: cause string or { type, agent } (death cut: the camera tilts away, then
//        Game.die(cause) — retry < 3 s).
//   Play.inventory, Play.resetInventory(), Play.setInventory(obj), Play.give(item, n) -> n taken (caps apply)
//        inventory: { weapons: [gun ids], weapon (equipped gun | null), clip: {gun: loaded}, ammo: {gun: reserve},
//        items: {id: n}, melee: {kind, hits, blade} | null, upgrades: {gun: [ids]}, throwSel }
//        give ids: CONTENT.items keys — guns (adds + loads), '<gun>_ammo' / 'arrow', melee kinds (pipe plank bat machete),
//        ingredients, crafted items, bottle/brick, bars. Emergency ammo tops up the first gun at every checkpoint and retry.
//   Play.crouched · Play.noiseRadius (current movement noise: sprint 12, walk 6, crouch/listen 2, still 0; each footstep
//        calls AI.noise(pos, noiseRadius, 'step'))
//        · Play.visibility 0..1 concealment where the player stands (A.dark, def.dark, A.tallGrass — grass hides a crouched
//        player best; 0 inside a vape cloud); posture and motion are left to AI perception · Play.aiming
//        The player's own noises reach AI.noise as 'step' 'land' 'vault' 'climb' 'takedown' 'melee' 'gunshot'.
//   Play.weapon (equipped gun id | null) · Play.equip(id | null)
//   Play.grab(agent, kind:'scroller'|'lurker'|'clicker'|'bloatware'|'human') -> Promise<'escaped'|'killed'|'died'>
//        mash F to break free (fail = heavy damage); Clicker: a SIM shiv breaks free and kills, else death; Bloatware: death.
//        'killed' also when the grabber dies during the struggle (companion rescue).
//   Play.listening (Airplane Mode held: desaturate, Audio.muffle, silhouettes of AI.listenTargets through walls via
//        Engine.overlay within 20 m (+5 m per skill level), slow move, HUD label)
//   Play.busy -> action name | null   (vault, climb, drop, ladder, squeeze, carry, boost, takedown, grab, heal, backpack,
//        bench, death)
//   Play.speed, Play.profile, Play.camYaw (get/set)
//   Play.extendArea(A) adds (area-local coordinates):
//     A.pickup({at, item, n=1, prompt}) -> it    glinting pickup, "e – pick up"; n scales with difficulty (Story ×2, Hard ×½)
//     A.collectible({at, kind:'artifact'|'lanyard'|'module'|'tip', id})   Save.collect (not tips); the entry with that id in
//        CONTENT.collectibles[kind + 's'] — artifacts {id, title, text} (read on a paper card), lanyards {id, title}
//        ('—— · Trainee · Chermside'), modules {id} (each raises the next skill) — or CONTENT.tips {id, lines:[{who, text,
//        emote}]} ("e – joke", no glint: the lines play once)
//     A.workbench({at, yaw})   bench prop + "e – use workbench": close-up camera, upgrades bought with bars
//     A.ladder({bottom, top, yaw}) fixed ladder: bottom = foot of the climb (lower floor), top = where you step off on top.
//        Portable: A.ladder({at, yaw, spots:[{bottom, top}]}) lies on the ground; carry it (E) and place it at a spot.
//     A.ledge({at, top, w=1.4})   explicit climb from `at` (feet below) to `top` (feet on top, walkable), up to 2.2 m
//     A.vault(box [x1,y1,z1,x2,y2,z2] | Object3D) -> World box   low cover you can vault either way (adds the collider)
//        Walkable World boxes are also climbable (≤ 2 m) and thin ones (≤ 1 m deep, ≤ 1.15 m high) vaultable without markup.
//     A.squeeze({from, to, onDone(G), mid(G), oneWay})   slow side-shuffle through a gap (hides a load: `mid` runs halfway)
//     A.plank({at, yaw, len=3, spots:[{from, to}]}) -> {place(i)}   carry a plank (E) and lay it across a gap (a walkable
//        bridge from `from` to `to`); place(i) drops it into spot i from script (Chloe kicking it down)
//     A.pallet({at, water:[x1,z1,x2,z2], y=0, to, onArrive(G)}) -> {ride(char|null), mesh, docked}   floating pallet the
//        player pushes through deep water by walking into it; a rider (Chloe) stands on it; it docks at `to`
//     A.boost({at, top, partner='chloe'})   two-person ledge (up to 3.4 m): space – boost; the lighter one goes up first and
//        pulls the other up (the partner's AI agent is set to 'scripted' for the duration)
//     A.hint(points)   hold T turns the camera toward the next point along the list
//     A.water({box:[x1,z1,x2,z2], y=0, deep})   shallow water slows; deep water swims (no weapons). Chloe can't swim.
//     A.dark(box [x1,z1,x2,z2], amount=0.6) · A.tallGrass(box)   stealth zones for Play.visibility (def.dark = area base)
// ============================================================================
const Play = (() => {
  const V3 = THREE.Vector3;
  const DEF = { walk: 1.5, jog: 3.2, run: 5.2, accel: 8, footsteps: true };
  const camPose = { pos: new V3(0, 2, 5), target: new V3(), fov: 70 };
  const tmp = new V3(), tmp2 = new V3(), tmp3 = new V3(), tmp4 = new V3();
  const zones = [];                     // { A, kind: 'dark'|'grass'|'water'|'hint', x1, z1, x2, z2, … } (world space)
  // Shared player state: Trav, Arms and Kit read and write it (they are only ever called from here).
  const S = {
    c: null, p: DEF, on: false, ctl: false,
    hp: 100, max: 100, regenWait: 0, dead: false,
    crouch: false, aim: false, throwAim: false, listenOn: false, listen: 0, heat: 0,
    speed: 0, vy: 0, fallTop: null, water: null,
    act: null, prompt: null, noise: 0, vis: 1, inv: null,
    cam: { yaw: 0, pitch: 0.12, dist: 2.2, col: 9, side: 1, sideK: 1, open: 0, openW: 0, openT: 0, fov: 70, h: 1.55, kick: 0, swayX: 0, swayY: 0, piv: new V3() },
    // exclusive action: { name, update(dt) -> true when done, end(done), move (walking allowed), speed (cap), root (the action
    // drives the root: no movement or gravity), fragile (damage cancels it), cam: {dist, side, h, fov, yaw, pitch, lockLook},
    // pose(camPose, dt) (final camera override) }
    start(a) { if (S.act && S.act.end) S.act.end(false); a.t = 0; S.act = a; return a; },
    stop() { const a = S.act; if (!a) return; S.act = null; if (a.end) a.end(false); },
    ask(text) { if (!S.prompt) S.prompt = text; },
    kick(p, y = 0) { S.cam.kick += p; S.cam.yaw += y; },
    skill(id) { const n = Save.data.collectibles.modules.length, i = CONTENT.skills.findIndex(s => s.id === id); return i < 0 ? 0 : U.clamp(Math.floor((n - 1 - i) / 6) + 1, 0, 2); },
    chloe: () => S.p.stats === 'chloe',
    shake: (a, d) => shake(a, d),
    damage: (n, src) => damage(n, src),
    die: cause => die(cause),
  };
  let lookAnchor = null, lookOpts = null, lookYaw = 0, lookPitch = 0, nudge = null, forced = null, shakeAmt = 0, shakeT = 0;
  let stepAcc = 0, shownPrompt = null, lastCk = null, beatT = 0, fxOn = false;

  const combat = () => !!S.p.combat;
  // SETTINGS.fov is the horizontal field of view on a 4:3 frame (Hor+); camPose.fov is vertical
  const baseFov = () => 360 / Math.PI * Math.atan(Math.tan(SETTINGS.fov * Math.PI / 360) * 0.75);

  // ---- player ---------------------------------------------------------------------------------------------------
  function setPlayer(c, p = {}) {
    const prev = S.c;
    S.stop(); Arms.release(S); clearSil();
    if (prev && prev !== c) { prev.ikT = {}; prev.lookAt(null); }
    S.c = c; S.p = Object.assign({}, DEF, p);
    S.speed = 0; S.vy = 0; S.fallTop = null; S.crouch = false; S.aim = false; S.throwAim = false; S.listenOn = false; S.listen = 0; S.heat = 0; S.dead = false;
    S.max = S.chloe() ? 60 : 100 + 15 * S.skill('health'); S.hp = S.max; S.regenWait = 0;
    postFx();
    if (!c) { UI.hud({ show: false }); return; }
    snapCamera();
    Arms.setup(S);
  }
  function enable(on) { S.on = !!on; if (on) Input.lock(); }
  function snapCamera() {
    if (!S.c) return;
    const C = S.cam; C.yaw = S.c.yaw; C.pitch = 0.12; C.kick = 0; C.dist = 2.2; C.col = 9; C.sideK = C.side;
    computeOts(1e3);
  }

  // ---- movement --------------------------------------------------------------------------------------------------
  function waterAt(x, z) { for (const w of zones) if (w.kind === 'water' && x >= w.x1 && x <= w.x2 && z >= w.z1 && z <= w.z2) return w; return null; }
  function move(dt) {
    const c = S.c, p = S.p, a = S.act, pos = c.root.position;
    if (a && a.root) { S.speed = 0; return; }
    const free = !a || a.move;
    const ctl = S.ctl && free;
    const mx = ctl ? Input.move.x : 0, my = ctl ? Input.move.y : 0;
    const mag = Math.min(1, Math.hypot(mx, my));
    const carry = !!p.carry;
    const deep = S.water && S.water.deep;
    const sprint = ctl && Input.down('sprint') && p.run > 0 && !carry && !S.aim && !S.throwAim && !deep;
    if (sprint && mag > 0.1) S.crouch = false;
    let top;
    if (a && a.speed != null) top = a.speed;
    else if (deep) top = 1.6;
    else if (S.aim || S.throwAim) top = S.crouch ? 1.1 : 1.5;
    else if (sprint) top = p.run;
    else if (S.listenOn) top = 1.1;
    else if (S.crouch) top = 1.5;
    else if (carry || p.limp) top = p.jog > 0 ? Math.min(p.jog, carry ? 2.4 : 1.2) : p.walk;
    else top = mag > 0.6 && p.jog > 0 ? p.jog : p.walk;
    top *= (p.speedMul ?? 1) * (S.water && !deep ? 0.62 : 1);
    const target = mag * top;
    S.speed = U.damp(S.speed, target, target > S.speed ? p.accel * 0.6 : p.accel, dt);
    S.heat = U.clamp(S.heat + (S.speed > 4 ? dt * 0.5 : -dt * 0.2));
    const fx = Math.sin(S.cam.yaw), fz = Math.cos(S.cam.yaw);
    const dx = fx * my - fz * mx, dz = fz * my + fx * mx;          // camera-relative input direction
    let vx = 0, vz = 0, strafe = null;
    if (S.aim || S.throwAim) {
      c.yaw = U.angleDamp(c.yaw, S.cam.yaw, 18, dt);
      if (mag > 0.05) { const l = Math.hypot(dx, dz); vx = dx / l; vz = dz / l; const s = Math.sin(c.yaw), k = Math.cos(c.yaw); strafe = [vx * k - vz * s, vx * s + vz * k]; }
    } else {
      if (mag > 0.05 && free) {
        const want = Math.atan2(dx, dz);
        if (S.speed > 4) c.yaw += U.clamp(U.wrapAngle(want - c.yaw), -2.7 * dt, 2.7 * dt);     // sprint: turn in an arc
        else c.yaw = U.angleDamp(c.yaw, want, 10, dt);
      }
      U.fwd(c.yaw, tmp); vx = tmp.x; vz = tmp.z;
    }
    if (S.speed > 0.01) {
      const r = World.move(pos.x, pos.y, pos.z, vx * S.speed * dt, vz * S.speed * dt, 0.33, c.height);
      const w = waterAt(r.x, r.z);
      if (w && w.deep && S.chloe()) S.speed *= 0.5;      // Chloe can't swim
      else { pos.x = r.x; pos.z = r.z; }
      stepSounds(dt);
    }
    if (!Director.active) gravity(dt);
    const was = S.water;
    S.water = waterAt(pos.x, pos.z);
    if (S.water && S.water.deep) { S.crouch = false; if (!(was && was.deep)) Audio.sfx('water_splash', { pos }); }
    if (!a || a.move) c.setMove(S.speed, { crouch: S.crouch, carry, limp: p.limp, strafe });
  }
  function gravity(dt) {
    const pos = S.c.root.position;
    let g = World.groundAt(pos.x, pos.z, pos.y + 0.01, 0.1);
    if (S.water && S.water.deep) g = Math.max(g, S.water.y - 1.25);
    if (g >= pos.y - 0.001) { pos.y = g > pos.y ? U.damp(pos.y, g, 25, dt) : g; land(); return; }
    if (S.fallTop == null && pos.y - g <= World.STEP) { pos.y = Math.max(g, pos.y - 6 * dt); return; }
    if (S.fallTop == null) S.fallTop = pos.y;
    S.vy -= 22 * dt; pos.y = Math.max(g, pos.y + S.vy * dt);
    if (pos.y <= g + 1e-4) land();
  }
  function land() {
    S.vy = 0;
    if (S.fallTop == null) return;
    const pos = S.c.root.position, h = S.fallTop - pos.y; S.fallTop = null;
    if (h < 1) return;
    Audio.footstep(World.surfaceAt(pos.x, pos.z, pos.y), pos, 1);
    shake(Math.min(0.12, h * 0.025), 0.3); S.cam.kick -= Math.min(0.08, h * 0.02);
    AI.noise(pos, Math.min(12, 3 + h * 2), 'land');
    if (h > 4.5) damage((h - 4.5) * 30, 'fall');
  }
  function stepSounds(dt) {
    const pos = S.c.root.position;
    stepAcc += S.speed * dt;
    if (stepAcc <= (S.speed > 4 ? 1.6 : S.crouch ? 0.9 : 1.25)) return;
    stepAcc = 0;
    if (S.p.footsteps) Audio.footstep(S.water ? 'water' : World.surfaceAt(pos.x, pos.z, pos.y), pos, U.clamp(S.speed / 5) * (S.crouch ? 0.45 : 1));
    if (S.noise > 0) AI.noise(pos, S.noise, 'step');
  }

  // ---- stealth ---------------------------------------------------------------------------------------------------
  function stealth(dt) {
    const pos = S.c.root.position, moving = S.speed > 0.3;
    S.noise = !moving ? 0 : S.speed > 4 ? 12 : S.crouch || S.listenOn ? 2 : 6;
    let dark = Game.area?.def.dark ?? 0, grass = false;
    for (const z of zones) if (pos.x >= z.x1 && pos.x <= z.x2 && pos.z >= z.z1 && pos.z <= z.z2) { if (z.kind === 'dark') dark = Math.max(dark, z.amount); else if (z.kind === 'grass') grass = true; }
    S.vis = Arms.inSmoke(pos) ? 0 : U.clamp((1 - dark) * (grass ? (S.crouch ? 0.25 : 0.7) : 1));
    // Airplane Mode (hold Q)
    S.listenOn = S.ctl && combat() && Input.down('listen') && !S.aim && !S.throwAim && (!S.act || S.act.move) && !(S.water && S.water.deep);
    S.listen = U.damp(S.listen, S.listenOn ? 1 : 0, S.listenOn ? 6 : 4, dt);
    silhouettes(dt);
    postFx();
  }
  function postFx() {
    const low = S.c && combat() && !S.dead && S.hp / S.max < 0.26 ? 0.3 : 0, want = Math.max(S.listen * 0.85, low);
    if (want < 0.002 && !fxOn) return;
    fxOn = want >= 0.002;
    Engine.uniforms.uDesat.value = fxOn ? want : 0;
    Engine.uniforms.uListen.value = S.listen * 0.55;
    Audio.muffle(S.listen * 0.8);
  }

  // silhouettes: overlay copies (sharing geometry and skeleton) of every character AI.listenTargets reports
  const sil = new Map();
  function silMaterial() {
    const m = new THREE.MeshLambertMaterial({ color: 0, emissive: 0xffffff, transparent: true, blending: THREE.AdditiveBlending });
    m.userData.k = { value: 0 };
    m.onBeforeCompile = sh => {
      sh.uniforms.uK = m.userData.k;
      sh.fragmentShader = 'uniform float uK;\n' + sh.fragmentShader.replace('#include <dithering_fragment>',
        'float rim = 1.0 - abs(dot(normalize(normal), normalize(vViewPosition)));\ngl_FragColor = vec4(vec3(0.14 + 0.9 * pow(rim, 2.2)) * uK, 1.0);');
    };
    return m;
  }
  function addSil(c) {
    const mat = silMaterial(), list = [];
    c.root.traverse(o => {
      if (!o.isMesh || !o.visible || o.material?.transparent) return;
      const m = o.isSkinnedMesh ? new THREE.SkinnedMesh(o.geometry, mat) : new THREE.Mesh(o.geometry, mat);
      if (o.isSkinnedMesh) m.bind(o.skeleton, o.bindMatrix);
      m.matrixAutoUpdate = false; m.frustumCulled = false;
      m.onBeforeRender = () => { m.matrixWorld.copy(o.matrixWorld); if (o.isSkinnedMesh) m.bindMatrixInverse.copy(o.bindMatrixInverse); };
      Engine.overlay.add(m); list.push(m);
    });
    sil.set(c, { mat, list, k: 0, want: true });
  }
  function dropSil(c, e) { for (const m of e.list) Engine.overlay.remove(m); e.mat.dispose(); sil.delete(c); }
  function clearSil() { for (const [c, e] of sil) dropSil(c, e); }
  function silhouettes(dt) {
    for (const e of sil.values()) e.want = false;
    if (S.listen > 0.05) {
      for (const ag of AI.listenTargets(S.c.root.position, 20 + 5 * S.skill('listen'))) {
        const c = ag.char; if (!c || !c.root.visible || c === S.c) continue;
        if (!sil.has(c)) addSil(c);
        sil.get(c).want = true;
      }
    }
    for (const [c, e] of sil) {
      if (!Chars.all.includes(c)) { dropSil(c, e); continue; }
      e.k = U.damp(e.k, e.want ? S.listen : 0, 5, dt);
      e.mat.userData.k.value = e.k * 0.9;
      if (!e.want && e.k < 0.01) dropSil(c, e);
    }
  }

  // ---- camera --------------------------------------------------------------------------------------------------
  const PROBES = [0, 0.785, 1.571, 2.356, 3.142, 3.927, 4.712, 5.498];
  function openness(piv) {
    for (const a of PROBES) { tmp4.set(piv.x + Math.sin(a) * 3.5, piv.y, piv.z + Math.cos(a) * 3.5); if (World.raycast(piv, tmp4, 'cam') < 1) return 0; }
    tmp4.set(piv.x, piv.y + 2.6, piv.z);
    return World.raycast(piv, tmp4, 'cam') >= 1 ? 1 : 0;
  }
  function nextHint(piv) {
    let best = null, bd = 1e9;
    for (const z of zones) if (z.kind === 'hint') {
      let bi = 0, d0 = 1e9;
      z.pts.forEach((q, i) => { const d = q.distanceTo(piv); if (d < d0) { d0 = d; bi = i; } });
      const q = z.pts[Math.min(z.pts.length - 1, d0 < 4 ? bi + 1 : bi)], d = q.distanceTo(piv);
      if (d < bd) { bd = d; best = q; }
    }
    return best;
  }
  function computeOts(dt) {
    const c = S.c, C = S.cam, a = S.act, o = (a && a.cam) || {};
    const sc = c.height / 1.8, aiming = S.aim || S.throwAim;
    if ((C.openT -= dt) <= 0) { C.openT = 0.3; C.openW = openness(C.piv); }
    C.open = U.damp(C.open, C.openW, 1.1, dt);
    const dist = o.dist ?? (aiming ? 1.4 : S.crouch ? 2.0 : 2.2 + C.open * 0.65 + (S.speed > 4 ? 0.3 : 0));
    C.dist = U.damp(C.dist, dist, aiming || o.dist ? 9 : 3, dt);
    C.sideK = U.damp(C.sideK, C.side, 7, dt);
    const side = (o.side ?? (aiming ? 0.55 : 0.45)) * C.sideK;
    C.h = U.damp(C.h, (o.h ?? (S.crouch ? 1.12 : 1.55)) * sc, 6, dt);
    C.fov = U.damp(C.fov, (o.fov ?? baseFov() * (aiming ? 0.87 : 1)) + (S.speed > 4 ? 3 : 0), 6, dt);
    if (o.yaw != null) C.yaw = U.angleDamp(C.yaw, o.yaw, 3, dt);
    if (o.pitch != null) C.pitch = U.damp(C.pitch, o.pitch, 3, dt);
    // pivot with a little lag: the camera trails the body when it starts and stops
    const p = c.root.position;
    tmp.set(p.x, p.y + C.h, p.z);
    if (dt >= 1) C.piv.copy(tmp);
    else {
      const k = 1 - Math.exp(-(aiming ? 30 : 12) * dt);
      C.piv.x += (tmp.x - C.piv.x) * k; C.piv.z += (tmp.z - C.piv.z) * k; C.piv.y += (tmp.y - C.piv.y) * (1 - Math.exp(-9 * dt));
    }
    // orientation (+ recoil and aim sway)
    C.kick = U.damp(C.kick, 0, 7, dt);
    const yaw = C.yaw + C.swayX, pitch = U.clamp(C.pitch - C.kick + C.swayY, -0.75, 1.0);
    const cp = Math.cos(pitch), dir = tmp2.set(Math.sin(yaw) * cp, -Math.sin(pitch), Math.cos(yaw) * cp);
    const rx = -Math.cos(yaw), rz = Math.sin(yaw);
    // shoulder, then boom, both kept in front of walls (pulled in at once, let out slowly)
    const sh = tmp3.set(C.piv.x + rx * side, C.piv.y, C.piv.z + rz * side);
    const ts = World.raycast(C.piv, sh, 'cam');
    if (ts < 1) sh.lerpVectors(C.piv, sh, Math.max(0, ts - 0.2));
    tmp4.copy(sh).addScaledVector(dir, -C.dist);
    const tb = World.raycast(sh, tmp4, 'cam'), hit = tb < 1 ? Math.max(0.25, C.dist * tb - 0.2) : 9;
    C.col = hit < C.col ? hit : U.damp(C.col, hit, 2.5, dt);
    camPose.pos.copy(sh).addScaledVector(dir, -Math.min(C.dist, C.col));
    camPose.target.copy(camPose.pos).addScaledVector(dir, 12);
    if (nudge) { nudge.t += dt; const w = Math.sin(Math.PI * U.clamp(nudge.t / nudge.dur)) * 0.35; camPose.target.lerp(nudge.point, w); if (nudge.t >= nudge.dur) nudge = null; }
    camPose.fov = C.fov;
    if (a && a.pose) a.pose(camPose, dt);
  }
  function camInput(dt) {
    const C = S.cam, a = S.act;
    if (!S.ctl || (a && a.cam && a.cam.lockLook)) return;
    const k = Arms.scoped ? 0.3 : 1;
    C.yaw -= Input.look.x * k; C.pitch = U.clamp(C.pitch + Input.look.y * k, -0.6, 0.9);
    if (Input.pressed('shoulder')) C.side = -C.side;
    if (Input.down('hint')) {
      const q = nextHint(C.piv);
      if (q) { C.yaw = U.angleDamp(C.yaw, U.yawTo(C.piv, q), 4, dt); C.pitch = U.damp(C.pitch, U.clamp(-Math.atan2(q.y + 0.8 - C.piv.y, Math.max(1, U.dist2(q, C.piv))), -0.3, 0.4), 3, dt); }
    }
  }

  function updateLook(dt) {
    const o = lookOpts;
    if (S.on) { lookYaw = U.clamp(lookYaw - Input.look.x, o.yaw[0], o.yaw[1]); lookPitch = U.clamp(lookPitch - Input.look.y, o.pitch[0], o.pitch[1]); }
    if (forced) { lookYaw = U.damp(lookYaw, forced.yaw, 6 * forced.k, dt); }
    lookAnchor.updateWorldMatrix(true, false);
    camPose.pos.set(...(o.offset || [0, 0, 0])).applyMatrix4(lookAnchor.matrixWorld);
    const q = new THREE.Quaternion().setFromRotationMatrix(lookAnchor.matrixWorld);
    const dir = tmp.set(Math.sin(lookYaw) * Math.cos(lookPitch), Math.sin(lookPitch), Math.cos(lookYaw) * Math.cos(lookPitch)).applyQuaternion(q);
    camPose.target.copy(camPose.pos).add(dir);
    camPose.fov = o.fov || baseFov();
    applyShake(dt);
  }
  function lookMode(anchor, o = {}) { lookAnchor = anchor; lookOpts = Object.assign({ yaw: [-2, 2], pitch: [-0.6, 0.5] }, o); lookYaw = o.startYaw || 0; lookPitch = 0; if (!anchor) forced = null; }
  function forceLook(point, k = 1) {
    if (!point || !lookAnchor) { forced = null; return; }
    const inv = new THREE.Matrix4().copy(lookAnchor.matrixWorld).invert();
    const lp = U.v3(point, tmp).applyMatrix4(inv);
    forced = { yaw: Math.atan2(lp.x, lp.z), k };
  }
  function shake(a, d) { if (shakeT <= 0 || a >= shakeAmt * U.clamp(shakeT * 2)) { shakeAmt = a; shakeT = d; } }
  function applyShake(dt) {
    if (shakeT <= 0) return;
    shakeT -= dt;
    if (!SETTINGS.shake) return;
    const a = shakeAmt * U.clamp(shakeT * 2);
    camPose.pos.x += (Math.random() - 0.5) * a; camPose.pos.y += (Math.random() - 0.5) * a;
    camPose.target.x += (Math.random() - 0.5) * a * 3; camPose.target.y += (Math.random() - 0.5) * a * 3;
  }

  // ---- health ------------------------------------------------------------------------------------------------------
  function damage(n, src) {
    if (!S.c || S.dead || !(n > 0)) return;
    S.hp = Math.max(0, S.hp - n); S.regenWait = 5;
    shake(0.04 + Math.min(0.1, n * 0.002), 0.3);
    if (S.act && S.act.fragile) S.stop();
    if (S.hp <= 0) die(typeof src === 'string' ? src : src && (src.faction || src.type) || 'hurt');
  }
  function heal(n) { if (S.c && !S.dead) S.hp = Math.min(S.max, S.hp + n); }
  function regen(dt) {
    S.regenWait -= dt;
    const seg = S.max / 4, top = Math.ceil(S.hp / seg - 1e-6) * seg;
    if (S.regenWait <= 0 && S.hp < top) S.hp = Math.min(top, S.hp + 3 * dt);
    if (combat() && S.hp / S.max < 0.26 && !S.dead && (beatT -= dt) <= 0) { beatT = 1.1; Audio.sfx('heartbeat', { vol: 0.5 }); }
  }
  // death: a short non-graphic cut — the camera tilts away from the body, then Game.die (click, fade, retry)
  function die(cause) {
    if (S.dead) return;
    S.dead = true;
    Arms.release(S);
    const c = S.c;
    c.gesture(null); c.ikT = {}; c.pose('kneel', { dur: 0.5 });
    const a = S.start({
      name: 'death', root: true,
      update() { if (a.t > 0.7 && !a.sent) { a.sent = true; Game.die(cause); } },
      pose(cp) { const k = U.ease.out(U.clamp(a.t / 0.8)); cp.target.y += k * 7; cp.pos.y += k * 0.5; cp.fov += k * 6; },
    });
  }

  // ---- inventory --------------------------------------------------------------------------------------------------
  const inventory = {};
  function resetInventory() {
    for (const k in inventory) delete inventory[k];
    Object.assign(inventory, { weapons: [], weapon: null, clip: {}, ammo: {}, items: {}, melee: null, upgrades: {}, throwSel: null });
  }
  resetInventory();
  S.inv = inventory;
  function setInventory(o) { resetInventory(); Object.assign(inventory, JSON.parse(JSON.stringify(o))); emergency(); if (S.c) Arms.setup(S); }
  // never soft-locked: guns with nothing to fire get a few rounds back at each checkpoint / retry
  function emergency() {
    const g = ['revolver', 'pistol', 'shotgun', 'bow', 'rifle'].find(w => inventory.weapons.includes(w));
    if (!g) return;
    const total = inventory.weapons.reduce((s, w) => s + (inventory.clip[w] || 0) + (inventory.ammo[w] || 0), 0);
    if (total < 3) inventory.ammo[g] = (inventory.ammo[g] || 0) + 3 - total;
  }

  // ---- area helpers ----------------------------------------------------------------------------------------------------
  function extendArea(A) {
    const box = (b, extra) => Object.assign({ A, x1: A.origin.x + Math.min(b[0], b[2]), z1: A.origin.z + Math.min(b[1], b[3]), x2: A.origin.x + Math.max(b[0], b[2]), z2: A.origin.z + Math.max(b[1], b[3]) }, extra);
    A.hint = pts => zones.push({ A, kind: 'hint', pts: pts.map(q => A.w(q)) });
    A.water = o => zones.push(box(o.box, { kind: 'water', y: A.origin.y + (o.y || 0), deep: !!o.deep }));
    A.dark = (b, amount = 0.6) => zones.push(box(b, { kind: 'dark', amount }));
    A.tallGrass = b => zones.push(box(b, { kind: 'grass' }));
    Trav.extendArea(A, S);
    Kit.extendArea(A, S);
  }
  function unloadArea(A) {
    for (let i = zones.length - 1; i >= 0; i--) if (zones[i].A === A) zones.splice(i, 1);
    if (S.act && S.act.A === A) S.stop();
    Trav.unloadArea(A); Kit.unloadArea(A); Arms.unloadArea(A);
    clearSil();
  }

  // ---- frame ----------------------------------------------------------------------------------------------------------
  function update(dt) {
    if (!S.c) return;
    if (lookAnchor) { updateLook(dt); return; }
    S.ctl = S.on && !Director.active && !S.dead;
    S.prompt = null;
    if (Save.data.checkpoint !== lastCk) { lastCk = Save.data.checkpoint; emergency(); }
    // subsystems may start an action; the running one ticks after them, so a key that ends it can't also start another
    if (S.ctl && !S.act && Input.pressed('crouch') && (S.p.canCrouch || combat()) && !S.p.carry && !(S.water && S.water.deep)) S.crouch = !S.crouch;
    Kit.update(S, dt);
    Arms.update(S, dt);
    Trav.update(S, dt);
    if (S.act) { S.act.t += dt; if (S.act.update(dt) === true) { const a = S.act; S.act = null; if (a.end) a.end(true); } }
    camInput(dt);
    move(dt);
    stealth(dt);
    regen(dt);
    computeOts(dt);
    Arms.view(S, camPose);
    applyShake(dt);
    if (S.ctl && S.prompt) UI.prompt(S.prompt); else if (shownPrompt) UI.prompt(null);
    shownPrompt = S.ctl ? S.prompt : null;
    UI.hud(Object.assign({ show: !!S.p.hud && !S.dead, health: S.hp / S.max, listen: S.listenOn }, Arms.hud(S)));
    UI.playTick(dt);
  }

  return {
    setPlayer, enable, update, snapCamera, lookMode, forceLook, camPose, inventory, resetInventory, setInventory, extendArea, unloadArea,
    give: (item, n = 1) => Kit.give(S, item, n),
    nudge(point, dur = 1) { nudge = { point: U.v3(point).clone(), dur, t: 0 }; },
    shake, damage, heal,
    equip: id => Arms.equip(S, id),
    grab: (agent, kind) => Arms.grab(S, agent, kind),
    get health() { return S.hp; }, get maxHealth() { return S.max; },
    get char() { return S.c; }, get enabled() { return S.on; }, get speed() { return S.speed; }, get profile() { return S.p; },
    get crouched() { return S.crouch; }, get noiseRadius() { return S.noise; }, get visibility() { return S.vis; },
    get aiming() { return S.aim; }, get weapon() { return S.inv.weapon; }, get listening() { return S.listenOn; },
    get busy() { return S.act ? S.act.name : null; },
    get camYaw() { return S.cam.yaw; }, set camYaw(v) { S.cam.yaw = v; },
  };
})();
