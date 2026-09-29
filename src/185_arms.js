// ============================================================================
// Arms — the player's weapons and combat (internal to Play): aim/fire/reload with recoil, sway, aim assist and the rifle
// scope; the bow (silent, recoverable arrows); breakable melee and fists; stealth takedowns (choke / shiv / Chloe's box
// cutter); grabs (mash F; Clicker = death unless a SIM shiv); throwables with an arc preview (bottle, brick, spicy pillow
// fire pool, ringtone bomb, vape cloud); first aid; hit FX. Owned by: systems (player) agent.
//   Arms.setup(S) · Arms.update(S, dt) · Arms.view(S, camPose) · Arms.release(S) · Arms.unloadArea(A) · Arms.hud(S)
//   Arms.equip(S, id) · Arms.grab(S, agent, kind) -> Promise · Arms.inSmoke(pos) · Arms.scoped · Arms.GUN · Arms.RESERVE ·
//   Arms.MELEE · Arms.cap(S, gun)
// Damage passed to agent.damage is in melee-hit units (the AI contract): fists 0.5 (a punch: weapon 'fists'), melee weapon
// 1–1.6 (taped blade 10), revolver 1.6, shotgun 9 × 0.5 pellets (falls off with range), rifle 4, pistol 1.1, arrow 2.6 ×
// draw, fire 1 per 0.5 s, explosion ≤ 5. AI resolves headshots. Takedowns: AI animates the victim, Arms the player.
// The combat profile owns the right hand (the bow goes in the left).
// ============================================================================
const Arms = (() => {
  const V3 = THREE.Vector3;
  const GUN = {
    revolver: { prop: 'revolver', cap: 6, capUp: 8, dmg: 1.6, rof: 0.55, reload: [0.7, 0.34], spread: 0.008, kick: 0.07, range: 70, sfx: 'revolver_shot', anim: 'recoil' },
    shotgun: { prop: 'shotgun', cap: 2, capUp: 3, dmg: 0.5, pellets: 9, cone: 0.075, rof: 0.95, reload: [0.5, 0.65], spread: 0.01, kick: 0.16, range: 26, sfx: 'shotgun', anim: 'recoil' },
    rifle: { prop: 'rifle', cap: 5, capUp: 7, dmg: 4, rof: 1.25, reload: [0.8, 0.42], spread: 0.002, kick: 0.1, range: 150, sfx: 'rifle_shot', anim: 'recoil', scope: true },
    pistol: { prop: 'pistol', cap: 8, capUp: 12, dmg: 1.1, rof: 0.3, reload: [1.5, 0], spread: 0.012, kick: 0.045, range: 55, sfx: 'gunshot', anim: 'fire' },
    bow: { prop: 'bow', cap: 1, dmg: 2.6, rof: 0.45, reload: [0.55, 0], spread: 0.003, kick: 0.012, range: 90, sfx: 'bow', bow: true },
  };
  const RESERVE = { revolver: 18, shotgun: 8, rifle: 10, pistol: 24, bow: 12 };
  const MELEE = {
    fists: { dmg: 0.5, reach: 1.35, anim: 'punch', dur: 0.6, hit: 0.27, sfx: 'punch' },
    box_cutter: { stun: 1.4, reach: 1.3, anim: 'punch', dur: 0.55, hit: 0.25, sfx: 'punch' },       // Chloe: a shove; kills only from stealth
    pipe: { dmg: 1.2, hits: 5, reach: 1.9, anim: 'swing', dur: 0.95, hit: 0.42, sfx: 'metal_hit' },
    plank: { dmg: 1, hits: 4, reach: 1.9, anim: 'swing', dur: 0.95, hit: 0.42, sfx: 'punch' },
    bat: { dmg: 1.2, hits: 6, reach: 1.9, anim: 'swing', dur: 0.95, hit: 0.42, sfx: 'punch' },
    machete: { dmg: 1.6, hits: 4, reach: 1.8, anim: 'swing', dur: 0.85, hit: 0.38, sfx: 'stab' },
  };
  const THROWN = ['bottle', 'brick', 'pillow', 'ringtone', 'vape'];
  const HOSTILE = new Set(['scroller', 'lurker', 'clicker', 'bloatware', 'human']);
  const GRAV = 12;
  const st = { r: null, l: null };      // prop names in the player's hands
  let gunT = 9, cool = 0, reloading = null, draw = 0, scope = 0, assist = null, swayT = 0, fHold = null, throwAnim = 0;
  const proj = [], fx = [], hazards = [];
  let arc = null, ring = null;
  const _a = new V3(), _b = new V3(), _d = new V3(), _up = new V3(0, 1, 0), _m = new THREE.Matrix4();
  const sm = U.smooth, cl = U.clamp;
  const name = id => (CONTENT.items[id]?.name || id).toUpperCase();
  const has = (S, id) => (S.inv.items[id] || 0) > 0;
  const upg = (S, w, id) => (S.inv.upgrades[w] || []).includes(id);
  const cap = (S, w) => upg(S, w, 'cap') ? GUN[w].capUp : GUN[w].cap;
  const hostile = a => a.alive && a.char && HOSTILE.has(a.type);

  // ---- loadout ---------------------------------------------------------------------------------------------------
  // Chase: revolver, sawn-off, rifle (never Chloe's pistol or bow). Chloe: pistol and bow, no shotgun.
  function guns(S) {
    const mine = S.chloe() ? ['pistol', 'bow'] : ['revolver', 'shotgun', 'rifle'];
    return S.inv.weapons.filter(w => mine.includes(w) && (!S.p.weapons || S.p.weapons.includes(w)));
  }
  function setup(S) {
    if (!S.p.combat) return;
    const inv = S.inv, gs = guns(S);
    if (!gs.includes(inv.weapon)) inv.weapon = gs[0] || null;
    if (!inv.throwSel || !has(S, inv.throwSel)) inv.throwSel = THROWN.find(t => has(S, t)) || null;
    st.r = undefined; st.l = null;       // the right hand is ours from now on
    reloading = null; draw = 0; scope = 0;
  }
  function equip(S, id) {
    if (id && !guns(S).includes(id)) return false;
    if (S.inv.weapon !== id) { S.inv.weapon = id; reloading = null; draw = 0; }
    return true;
  }
  function hold(c, hand, prop) {
    if (st[hand] === prop) return;
    st[hand] = prop;
    if (c.held(hand)) c.drop(hand, { remove: true });
    if (prop) c.hold(Kit.mesh(prop, true), hand);
  }
  function release(S) {
    const c = S.c;
    if (c && S.p.combat) { if (S.aim) c.pose('stand', { dur: 0.3 }); c.ikT = {}; hold(c, 'l', null); }
    S.aim = S.throwAim = false; reloading = null; draw = 0; scope = 0; fHold = null; assist = null; UI.scope(0);
    S.cam.swayX = S.cam.swayY = 0;
    if (arc) arc.visible = ring.visible = false;
  }

  // ---- aiming ----------------------------------------------------------------------------------------------------------
  function camDir(out) { return out.copy(Play.camPose.target).sub(Play.camPose.pos).normalize(); }
  // what the crosshair is on: the first wall or character along the camera ray, starting at the player
  function aimPoint(S, out) {
    const o = Play.camPose.pos, d = camDir(_d);
    const s = Math.max(0, _a.copy(S.c.root.position).sub(o).dot(d));
    const start = _a.copy(o).addScaledVector(d, s), end = _b.copy(start).addScaledVector(d, 150);
    const t = World.raycast(start, end, null), h = AI.hitTest(start, d, 150 * t);
    return h ? out.copy(h.point) : out.copy(start).addScaledVector(d, 150 * t);
  }
  function muzzle(S, out) {
    const c = S.c, g = c.held(st.l === 'bow' ? 'l' : 'r');
    if (g && g.userData.muzzle) { g.updateWorldMatrix(true, false); return g.localToWorld(out.set(...g.userData.muzzle)); }
    return c.point('shoulder_r', out).addScaledVector(camDir(_d), 0.5);
  }
  function startAssist(S) {
    if (!(SETTINGS.aimAssist || SETTINGS.difficulty === 'story')) return;
    const o = Play.camPose.pos, d = camDir(_d);
    let best = null, ba = 0.3;
    for (const a of AI.list) {
      if (!hostile(a)) continue;
      const p = a.char.point('chest', new V3()), v = p.clone().sub(o), dist = v.length();
      if (dist > 35) continue;
      const ang = v.normalize().angleTo(d);
      if (ang < ba && World.visible(o, p)) { ba = ang; best = a; }
    }
    assist = best && { a: best, t: 0.25 };
  }
  function assistTick(S, dt) {
    if (!assist) return;
    if ((assist.t -= dt) <= 0 || !assist.a.alive) { assist = null; return; }
    const p = assist.a.char.point('chest', _a), o = Play.camPose.pos;
    S.cam.yaw = U.angleDamp(S.cam.yaw, U.yawTo(o, p), 18, dt);
    S.cam.pitch = U.damp(S.cam.pitch, -Math.atan2(p.y - o.y, Math.max(1, U.dist2(o, p))), 18, dt);
  }

  // ---- guns ---------------------------------------------------------------------------------------------------------
  function fire(S) {
    const inv = S.inv, w = inv.weapon, g = GUN[w], c = S.c;
    if (cool > 0 || reloading) return;
    if (g.bow && draw < 0.3) return;
    if ((inv.clip[w] || 0) <= 0) { Audio.sfx('dry_fire', { pos: c.root.position }); cool = 0.35; startReload(S); return; }
    inv.clip[w]--; gunT = 0;
    cool = g.rof * (w === 'rifle' && upg(S, w, 'reload') ? 0.75 : 1);
    const o = muzzle(S, new V3()), P = aimPoint(S, new V3());
    const dir = P.distanceTo(o) > 1.2 ? P.sub(o).normalize() : camDir(new V3());
    const dmg = g.dmg * (upg(S, w, 'dmg') ? 1.3 : 1);
    if (g.bow) {
      const v = dir.clone().multiplyScalar(22 + 30 * draw);
      proj.push({ kind: 'arrow', mesh: add(Kit.mesh('arrow')), pos: o, vel: v, dmg: dmg * draw, g: 2.5, t: 0 });
      Audio.sfx('bow', { pos: o }); draw = 0;
      if ((inv.ammo.bow || 0) > 0) startReload(S);
      return;
    }
    const spread = g.spread + (S.speed > 0.5 ? 0.012 : 0) + (S.crouch ? -0.003 : 0);
    let hit = false;
    for (let i = 0; i < (g.pellets || 1); i++) {
      const d = dir.clone();
      const cone = g.cone ? g.cone * (upg(S, w, 'dmg') ? 0.7 : 1) : 0;
      d.x += (Math.random() - 0.5) * 2 * (spread + cone); d.y += (Math.random() - 0.5) * 2 * (spread + cone) * 0.7; d.z += (Math.random() - 0.5) * 2 * (spread + cone); d.normalize();
      hit = shoot(o, d, g.range, g.pellets ? dmg * cl(1.35 - o.distanceTo(P) / 14, 0.25, 1.35) : dmg) || hit;
    }
    c.gesture(g.anim);
    flash(o, dir, g.pellets ? 0.75 : 0.5);
    puff(o.clone().addScaledVector(dir, 0.15), 0x9a948a, 0.3, 0.5, 0.25);
    Audio.sfx(g.sfx, { pos: o });
    AI.noise(o, 40, 'gunshot');
    S.kick(g.kick * (0.85 + Math.random() * 0.3), (Math.random() - 0.5) * g.kick * 0.25);
    S.shake(g.kick * 0.3, 0.16);
    if (hit) UI.hud({ hit: true });
  }
  function shoot(o, d, range, dmg) {
    const end = _b.copy(o).addScaledVector(d, range);
    const t = World.raycast(o, end, null), h = AI.hitTest(o, d, range * t);
    if (h) {
      h.agent.damage(dmg, { type: 'bullet', part: h.part, from: o.clone(), force: d.clone().multiplyScalar(4) });
      puff(h.point, 0x2a1210, 0.35, 0.18);
      return true;
    }
    if (t < 1) puff(_a.copy(o).addScaledVector(d, range * t - 0.02), 0xb8b0a2, 0.55, 0.22);
    return false;
  }
  function startReload(S) {
    const w = S.inv.weapon, g = GUN[w];
    if (!g || reloading) return;
    const have = S.inv.clip[w] || 0, n = Math.min(cap(S, w) - have, S.inv.ammo[w] || 0);
    if (n <= 0) return;
    reloading = { w, t: 0, n, dur: (g.reload[0] + g.reload[1] * n) * (upg(S, w, 'reload') ? 0.66 : 1), clicks: 0 };
    gunT = 0;
    if (!g.bow) { Audio.sfx('reload', { pos: S.c.root.position }); if (!S.chloe() && AI.alertLevel > 0.3) Dialogue.bark('chase', 'reload', { char: S.c }); }
  }
  function reloadTick(S, dt) {
    const r = reloading;
    if (!r) return;
    if (S.inv.weapon !== r.w) { reloading = null; return; }
    r.t += dt; gunT = 0;
    const g = GUN[r.w];
    if (g.reload[1] && r.t > g.reload[0] * 0.6 + (r.clicks + 1) * (r.dur - g.reload[0]) / r.n && r.clicks < r.n - 1) { r.clicks++; Audio.sfx('reload', { pos: S.c.root.position, vol: 0.5, rate: 1.15 }); }
    if (r.t < r.dur) return;
    S.inv.clip[r.w] = (S.inv.clip[r.w] || 0) + r.n; S.inv.ammo[r.w] -= r.n;
    reloading = null;
  }

  // ---- melee and takedowns -------------------------------------------------------------------------------------
  function meleeTarget(S, reach) {
    const c = S.c, p = c.root.position;
    let best = null, bd = reach;
    for (const a of AI.list) {
      if (!hostile(a)) continue;
      const q = a.char.root.position, d = U.dist2(p, q);
      if (d < bd && Math.abs(q.y - p.y) < 1.2 && Math.abs(U.wrapAngle(U.yawTo(p, q) - c.yaw)) < 1.2) { bd = d; best = a; }
    }
    return best;
  }
  function melee(S) {
    const c = S.c, m = S.inv.melee, kind = m ? m.kind : S.p.melee || (S.chloe() ? 'box_cutter' : 'fists'), M = MELEE[kind];
    const aim = meleeTarget(S, M.reach + 0.8);
    if (aim) c.yaw = U.yawTo(c.root.position, aim.char.root.position);
    if (kind === 'box_cutter') hold(c, 'r', 'box_cutter');
    c.gesture(M.anim, { dur: M.dur });
    Audio.sfx('swing', { pos: c.root.position, vol: 0.5 });
    let struck = false;
    S.start({
      name: 'melee', move: true, speed: 0.8,
      update() {
        if (!struck && this.t >= M.hit) { struck = true; const a = meleeTarget(S, M.reach); if (a) strike(S, a, kind, M); }
        return this.t >= M.dur;
      },
    });
  }
  function strike(S, a, kind, M) {
    const c = S.c, p = a.char.point('chest', new V3());
    U.fwd(c.yaw, _d);
    if (M.stun) { a.stun(M.stun); Audio.sfx('punch', { pos: p, vol: 0.7 }); S.shake(0.03, 0.12); return; }
    const blade = S.inv.melee && S.inv.melee.blade;
    a.damage(blade ? 10 : M.dmg, { type: 'melee', weapon: kind, part: 'body', from: c.root.position.clone(), force: _d.clone().multiplyScalar(3) });
    Audio.sfx(blade ? 'stab' : M.sfx, { pos: p });
    S.shake(0.06, 0.16); UI.hud({ hit: true });
    AI.noise(p, 6, 'melee');
    const w = S.inv.melee;
    if (w && --w.hits <= 0) {
      Audio.sfx(kind === 'pipe' || kind === 'machete' ? 'metal_hit' : 'wood_crash', { pos: p, vol: 0.8 });
      S.inv.melee = null; hold(c, 'r', null);
    }
  }
  function useShiv(S) {
    if (S.chloe()) return;
    const inv = S.inv;
    inv.shivWear = (inv.shivWear || 0) + 1;
    if (inv.shivWear > S.skill('shiv')) { inv.shivWear = 0; inv.items.shiv--; }
  }
  const hands2 = (c, a, b, w) => { const T = c.ikT || (c.ikT = {}); T.L = { p: a, w }; T.R = { p: b, w }; };
  // stealth takedown (AI places and animates the victim: choke 2.6 s, shiv 1.1 s, stab 0.9 s); the player's side is ours
  function takedown(S, agent, kind) {
    const c = S.c, g = agent.char;
    if (kind === 'shiv') useShiv(S);
    hold(c, 'l', null); hold(c, 'r', kind === 'choke' ? null : kind === 'shiv' ? 'knife' : 'box_cutter');
    let done = false;
    agent.takedown(kind).then(() => { done = true; });
    AI.noise(c.root.position, kind === 'choke' ? 2 : 3, 'takedown');
    Audio.sfx(kind === 'choke' ? 'tackle' : 'grab', { pos: c.root.position, vol: 0.5 });
    S.start({
      name: 'takedown', root: true, cam: { dist: 1.75, side: 0.75, h: 1.3, fov: 54, yaw: c.yaw + 0.85, pitch: 0.14, lockLook: true },
      update() {
        if (kind === 'choke') {       // arm round the neck, both sink into a crouch, let go as the body slumps
          const n = g.point('head', _a).addScaledVector(_up, -0.2), r = _b.set(Math.cos(c.yaw) * 0.12, 0, -Math.sin(c.yaw) * 0.12);
          hands2(c, n.clone().add(r), n.clone().sub(r), sm(cl(this.t / 0.35)) * (1 - sm(cl((this.t - 2.3) / 0.4))));
          c.setMove(0, { crouch: this.t > 0.8 && this.t < 2.6 });
        } else {                      // two quick stabs
          for (const [k, at] of [['s1', 0.1], ['s2', 0.5]]) if (this.t > at && !this[k]) { this[k] = 1; c.gesture('punch', { dur: 0.38 }); Audio.sfx('stab', { pos: g.point('chest', _a), vol: 0.7 }); }
          c.setMove(0);
        }
        return (done && this.t > 0.9) || this.t > 7;
      },
      end() { c.ikT = {}; },
    });
  }
  // grabbed by an enemy: mash F; a Clicker kills unless Chase has a shiv; Bloatware always kills
  function grab(S, agent, kind) {
    return new Promise(res => {
      const c = S.c, g = agent.char;
      if (!c || S.dead) { res('died'); return; }
      let out = null;
      const settle = r => { if (!out) { out = r; res(r); } };
      const face = dt => { c.yaw = U.angleDamp(c.yaw, U.yawTo(c.root.position, g.root.position), 12, dt); };
      const cam = { dist: 1.45, side: 0.6, h: 1.45, fov: 52, yaw: c.yaw + 1.0, pitch: 0.06, lockLook: true };
      release(S);
      const lethal = kind === 'bloatware' || (kind === 'clicker' && (S.chloe() || !has(S, 'shiv')));
      if (lethal) {
        c.gesture('struggle', { hold: true });
        S.start({ name: 'grab', root: true, cam, update(dt) { face(dt); if (this.t > 0.55) { settle('died'); S.die(kind); } }, end() { c.gesture(null); settle(S.dead ? 'died' : 'escaped'); } });
        return;
      }
      if (kind === 'clicker') {
        useShiv(S);
        c.gesture('struggle', { hold: true });
        S.start({
          name: 'grab', root: true, cam,
          update(dt) {                // the shiv comes up and goes in under the phone plate
            face(dt);
            if (this.t > 0.3) hold(c, 'r', 'knife');
            const k = sm(cl((this.t - 0.35) / 0.25)) * (1 - sm(cl((this.t - 0.9) / 0.3)));
            (c.ikT || (c.ikT = {})).R = k > 0 ? { p: g.point('head', new V3()).addScaledVector(_up, -0.08), w: k } : null;
            if (this.t > 0.6 && !this.stab) { this.stab = 1; Audio.sfx('stab', { pos: g.point('head', _a) }); agent.damage(10, { type: 'shiv', part: 'head', from: c.root.position.clone() }); }
            return this.t > 1.3;
          },
          end() { c.gesture(null); c.ikT = {}; hold(c, 'r', null); settle('killed'); },
        });
        return;
      }
      let m = 0.3;
      c.gesture('struggle', { hold: true });
      Audio.sfx('gasp', { pos: c.root.position, vol: 0.6 });
      S.start({
        name: 'grab', root: true, cam,
        update(dt) {
          face(dt);
          if (!agent.alive) { settle('killed'); return true; }
          if (S.ctl && Input.pressed('melee')) { m += SETTINGS.difficulty === 'story' ? 0.2 : 0.13; S.shake(0.03, 0.1); }
          m = cl(m - 0.28 * dt);
          UI.struggle(m);
          if (m >= 1) { c.gesture('punch', { dur: 0.5 }); Audio.sfx('tackle', { pos: g.root.position }); agent.stun(2); settle('escaped'); return true; }
          if (this.t > (SETTINGS.difficulty === 'hard' ? 2.8 : 3.4)) { S.damage(38, agent); settle(S.dead ? 'died' : 'escaped'); return true; }
        },
        end() { if (!S.dead) c.gesture(null); UI.struggle(null); settle(S.dead ? 'died' : 'escaped'); },
      });
    });
  }

  // ---- first aid -------------------------------------------------------------------------------------------------------
  function heal(S) {
    if (!has(S, 'medkit') || S.hp >= S.max) return;
    const c = S.c, dur = [3, 2.2, 1.5][S.skill('heal')];
    c.gesture('clean_hands', { hold: true });
    Audio.sfx('craft', { pos: c.root.position, vol: 0.6 });
    S.start({
      name: 'heal', move: true, speed: 1.0, fragile: true,
      update() { UI.progress('first aid', this.t / dur); if (this.t >= dur) { S.inv.items.medkit--; Play.heal(S.max * 0.6); Audio.sfx('craft', { pos: c.root.position, vol: 0.5, rate: 1.2 }); return true; } },
      end() { c.gesture(null); UI.progress(null); },
    });
  }

  // ---- throwables -------------------------------------------------------------------------------------------------------
  function throwFrom(S, out) { return S.c.point('shoulder_r', out).addScaledVector(_up, 0.28); }
  function throwVel(S, out) { return camDir(out).multiplyScalar(13.5).addScaledVector(_up, 3.2); }
  function throwIt(S, kind) {
    const inv = S.inv, c = S.c;
    inv.items[kind]--;
    if (!has(S, kind)) inv.throwSel = THROWN.find(t => has(S, t)) || null;
    const o = throwFrom(S, new V3()), v = throwVel(S, new V3());
    proj.push({ kind, mesh: add(Kit.mesh(kind)), pos: o, vel: v, spin: new V3(Math.random() * 9, Math.random() * 6, Math.random() * 9), g: GRAV, t: 0 });
    hold(c, 'r', null);
    throwAnim = 0.5;
    Audio.sfx('swing', { pos: o, vol: 0.7 });
  }
  // dots along the throw (white over a faint dark halo, sized by distance so they read at any range) and a landing ring
  function arcPreview(S) {
    const on = S.throwAim;
    if (!arc) {
      const dot = new THREE.SphereGeometry(1, 8, 6), mk = (color, opacity, order) => {
        const m = new THREE.InstancedMesh(dot, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthTest: false, depthWrite: false }), 64);
        m.frustumCulled = false; m.renderOrder = order; return m;
      };
      arc = new THREE.Group(); arc.add(mk(0x000000, 0.3, 9), mk(0xffffff, 0.9, 10));
      ring = new THREE.Group();
      for (const [r0, r1, color, opacity, order] of [[0.26, 0.37, 0x000000, 0.3, 9], [0.29, 0.34, 0xffffff, 0.85, 10]]) {
        const m = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthTest: false, depthWrite: false }));
        m.renderOrder = order; ring.add(m);
      }
      Engine.scene.add(arc, ring);
    }
    arc.visible = ring.visible = on;
    if (!on) return;
    const pos = throwFrom(S, _a), v = throwVel(S, _b), q = new V3(), cam = Engine.camera.position, [halo, core] = arc.children;
    let n = 0, hitAt = null;
    for (let i = 0; i < 64 && !hitAt; i++) {
      q.copy(pos); v.y -= GRAV / 30; pos.addScaledVector(v, 1 / 30);
      const t = World.raycast(q, pos, null);
      if (t < 1 || pos.y < World.groundAt(pos.x, pos.z, q.y, 0)) { hitAt = q.lerp(pos, Math.min(1, t)); break; }
      if (i < 2) continue;
      const d = pos.distanceTo(cam);
      halo.setMatrixAt(n, _m.makeScale(d * 0.0075, d * 0.0075, d * 0.0075).setPosition(pos));
      core.setMatrixAt(n, _m.makeScale(d * 0.0042, d * 0.0042, d * 0.0042).setPosition(pos));
      n++;
    }
    halo.count = core.count = n; halo.instanceMatrix.needsUpdate = core.instanceMatrix.needsUpdate = true;
    ring.visible = !!hitAt;
    if (hitAt) { ring.position.copy(hitAt); ring.position.y = World.groundAt(hitAt.x, hitAt.z, hitAt.y + 0.1, 0) + 0.03; ring.scale.setScalar(1 + 0.08 * Math.sin(Engine.time * 6)); }
  }

  // ---- projectiles --------------------------------------------------------------------------------------------------
  function add(o) { Engine.scene.add(o); return o; }
  function remove(o) { if (o.parent) o.parent.remove(o); }
  function tickProjectiles(S, dt) {
    for (let i = proj.length - 1; i >= 0; i--) {
      const p = proj[i], prev = _a.copy(p.pos);
      p.t += dt; p.vel.y -= p.g * dt; p.pos.addScaledVector(p.vel, dt);
      const seg = _b.copy(p.pos).sub(prev), len = seg.length();
      let t = World.raycast(prev, p.pos, null);
      if (p.pos.y < World.groundAt(p.pos.x, p.pos.z, prev.y, 0)) t = Math.min(t, 0.999);
      const h = len > 0 ? AI.hitTest(prev, seg.clone().normalize(), len * t) : null;
      if (h && hostile(h.agent)) { proj.splice(i, 1); hitAgent(S, p, h); continue; }
      if (t < 1 || p.t > 6) { proj.splice(i, 1); impact(S, p, prev.clone().addScaledVector(seg, Math.max(0, t - 0.02)), seg.normalize()); continue; }
      p.mesh.position.copy(p.pos);
      if (p.kind === 'arrow') p.mesh.lookAt(_d.copy(p.pos).add(p.vel));
      else { p.mesh.rotation.x += p.spin.x * dt; p.mesh.rotation.y += p.spin.y * dt; p.mesh.rotation.z += p.spin.z * dt; }
    }
  }
  function hitAgent(S, p, h) {
    const a = h.agent, from = S.c.root.position.clone();
    if (p.kind === 'arrow') {
      a.damage(p.dmg, { type: 'arrow', part: h.part, from, force: p.vel.clone().normalize().multiplyScalar(2) });
      UI.hud({ hit: true }); Audio.sfx('arrow_hit', { pos: h.point });
      remove(p.mesh);
      Kit.drop(_a.set(h.point.x, World.groundAt(h.point.x, h.point.z, h.point.y, 0) + 0.02, h.point.z), 'arrow', 1);
      return;
    }
    if (p.kind === 'bottle' || p.kind === 'brick') {
      a.stun(2.5);
      a.damage(0.25, { type: 'melee', part: h.part, from, force: p.vel.clone().normalize() });
      UI.hud({ hit: true });
    }
    impact(S, p, h.point.clone(), p.vel.clone().normalize());
  }
  function impact(S, p, at, dir) {
    const gy = World.groundAt(at.x, at.z, at.y + 0.1, 0);
    const ground = _d.set(at.x, gy, at.z);
    if (p.kind === 'arrow') {                 // sticks where it lands; pick it back up
      p.mesh.position.copy(at).addScaledVector(dir, 0.12);
      Audio.sfx('arrow_hit', { pos: at, vol: 0.6 });
      Kit.drop(p.mesh.position, 'arrow', 1, p.mesh);
      return;
    }
    remove(p.mesh);
    if (p.kind === 'bottle') { Audio.sfx('bottle_break', { pos: at }); AI.noise(at, 15, 'glass'); shards(at); }
    else if (p.kind === 'brick') { Audio.sfx('brick_hit', { pos: at }); AI.noise(at, 12, 'thrown'); Kit.drop(ground.clone().setY(gy + 0.06), 'brick', 1); }
    else if (p.kind === 'pillow') firePool(ground.clone());
    else if (p.kind === 'ringtone') ringBomb(ground.clone());
    else if (p.kind === 'vape') smokeCloud(ground.clone());
  }

  // ---- hazards: fire pools, ringing bombs, smoke ---------------------------------------------------------------------
  function firePool(at) {
    Audio.sfx('battery_burst', { pos: at }); Audio.sfx('fire_whoosh', { pos: at });
    AI.noise(at, 15, 'fire');
    const g = new THREE.Group(); g.position.copy(at);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(2.4, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: tex('soft'), color: 0xff6a1a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.position.y = 0.04; g.add(glow);
    const flames = [];
    for (let i = 0; i < 9; i++) {
      const s = sprite('flame', 0xffb060, THREE.AdditiveBlending);
      const a = i * 2.4, r = i ? 0.4 + (i % 3) * 0.55 : 0;
      s.position.set(Math.cos(a) * r, 0.5, Math.sin(a) * r); s.userData.ph = Math.random() * 6; g.add(s); flames.push(s);
    }
    add(g);
    const loop = Audio.loop('fire', { pos: at, vol: 0.9 });
    hazards.push({
      kind: 'fire', pos: at, r: 2.2, t: 0, dur: 4, tickT: 0, obj: g,
      tick(S, dt) {
        const k = cl(this.t / 0.2) * cl((this.dur - this.t) / 0.6);
        glow.material.opacity = 0.55 * k;
        for (const s of flames) { const f = 0.75 + 0.35 * Math.sin(this.t * 13 + s.userData.ph) + 0.15 * Math.sin(this.t * 29 + s.userData.ph * 2); s.scale.set(0.9 * k * f, 1.5 * k * f, 1); s.position.y = 0.65 * k * f; s.material.opacity = k; }
        if ((this.tickT -= dt) <= 0) {
          this.tickT = 0.5;
          for (const a of AI.list) if (a.alive && a.char && a.char.root.position.distanceTo(this.pos) < this.r + 0.3) a.damage(1, { type: 'fire', part: 'body', from: this.pos.clone() });
          if (S.c && S.c.root.position.distanceTo(this.pos) < this.r) S.damage(9, 'fire');
        }
      },
      end() { loop.stop(0.6); },
    });
  }
  function ringBomb(at) {
    const m = add(Kit.mesh('ringtone')); m.position.copy(at).setY(at.y + 0.02); m.rotation.y = Math.random() * 6;
    hazards.push({
      kind: 'ring', t: 0, dur: 3, beat: 0, obj: m,
      tick(S, dt) {
        const on = Math.sin(this.t * 18) > 0;
        m.userData.screen.material.color.setHex(on ? 0x9fe0ff : 0x203040);
        m.position.x = at.x + (on ? 0.006 : -0.006);
        if ((this.beat -= dt) <= 0) { this.beat = 1; Audio.sfx('ringtone', { pos: at }); AI.noise(at, 25, 'ringtone'); }
      },
      end(S) { if (S) explode(S, at); },
    });
  }
  function explode(S, at) {
    Audio.sfx('explosion', { pos: at }); AI.noise(at, 40, 'explosion');
    S.shake(0.25 * cl(1 - S.c.root.position.distanceTo(at) / 25), 0.6);
    for (const a of AI.list) if (a.alive && a.char) { const d = a.char.root.position.distanceTo(at); if (d < 4.5) a.damage(5 * (1 - d / 5), { type: 'explosion', part: 'body', from: at.clone(), force: a.char.root.position.clone().sub(at).setY(1).normalize().multiplyScalar(6) }); }
    const d = S.c.root.position.distanceTo(at);
    if (d < 4.5) S.damage(70 * (1 - d / 5), 'explosion');
    const f = sprite('soft', 0xffc890, THREE.AdditiveBlending); f.position.copy(at).setY(at.y + 0.6);
    fx.push({ obj: add(f), t: 0, dur: 0.45, tick(k) { f.scale.setScalar(1.5 + 5 * k); f.material.opacity = 1 - k; } });
    for (let i = 0; i < 8; i++) puff(at.clone().add(new V3((Math.random() - 0.5) * 1.5, 0.3 + Math.random(), (Math.random() - 0.5) * 1.5)), 0x3a3634, 2.4, 1.6 + Math.random(), 0.6);
  }
  function smokeCloud(at) {
    Audio.sfx('fire_whoosh', { pos: at, vol: 0.4, rate: 1.6 });
    const g = new THREE.Group(); g.position.copy(at);
    const puffs = [];
    for (let i = 0; i < 16; i++) {
      const s = sprite('soft', 0xd8dcd8, THREE.NormalBlending);
      const a = Math.random() * 6.28, r = Math.random() * 2.4;
      s.userData.to = new V3(Math.cos(a) * r, 0.4 + Math.random() * 1.6, Math.sin(a) * r); s.userData.sz = 2 + Math.random() * 1.6;
      g.add(s); puffs.push(s);
    }
    add(g);
    hazards.push({
      kind: 'smoke', pos: at, r: 3.2, t: 0, dur: 6, tickT: 0, obj: g,
      tick(S, dt) {
        const grow = U.ease.out(cl(this.t / 1.2)), fade = cl((this.dur - this.t) / 1.5);
        for (const s of puffs) { s.position.copy(s.userData.to).multiplyScalar(grow); s.position.y += this.t * 0.08; s.scale.setScalar(s.userData.sz * (0.4 + 0.6 * grow)); s.material.opacity = 0.55 * fade; }
        if ((this.tickT -= dt) <= 0) { this.tickT = 1; for (const a of AI.list) if (a.alive && a.type === 'human' && a.char.root.position.distanceTo(this.pos) < this.r) a.stun(1.2); }
      },
    });
  }
  function inSmoke(p) { for (const h of hazards) if (h.kind === 'smoke' && h.t > 0.6 && h.t < h.dur - 0.8 && p.distanceTo(h.pos) < h.r) return true; return false; }
  function tickHazards(S, dt) {
    for (let i = hazards.length - 1; i >= 0; i--) {
      const h = hazards[i]; h.t += dt;
      h.tick(S, dt);
      if (h.t >= h.dur) { hazards.splice(i, 1); if (h.end) h.end(S); disposeObj(h.obj); }
    }
  }

  // ---- FX -------------------------------------------------------------------------------------------------------------
  const TEX = {};
  function tex(kind) {
    if (TEX[kind]) return TEX[kind];
    const cv = document.createElement('canvas'), N = 64; cv.width = cv.height = N;
    const x = cv.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, N, N);
    if (kind === 'flame') {
      x.clearRect(0, 0, N, N);
      const f = x.createRadialGradient(32, 40, 2, 32, 36, 30);
      f.addColorStop(0, 'rgba(255,250,220,1)'); f.addColorStop(0.3, 'rgba(255,190,90,.9)'); f.addColorStop(0.65, 'rgba(230,80,20,.45)'); f.addColorStop(1, 'rgba(120,20,0,0)');
      x.fillStyle = f; x.beginPath(); x.moveTo(32, 2); x.bezierCurveTo(52, 26, 58, 44, 48, 56); x.quadraticCurveTo(32, 66, 16, 56); x.bezierCurveTo(6, 44, 12, 26, 32, 2); x.fill();
    } else if (kind === 'flash') {      // a four-point star over the glow
      x.globalCompositeOperation = 'lighter'; x.fillStyle = 'rgba(255,255,255,.9)';
      x.beginPath(); x.moveTo(32, 4); x.lineTo(35, 29); x.lineTo(60, 32); x.lineTo(35, 35); x.lineTo(32, 60); x.lineTo(29, 35); x.lineTo(4, 32); x.lineTo(29, 29); x.fill();
    }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.userData.shared = true;
    return (TEX[kind] = t);
  }
  function sprite(kind, color, blending) { return new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(kind), color, transparent: true, blending, depthWrite: false })); }
  function puff(at, color, size, dur, rise = 0.12) {
    const s = sprite('soft', color, THREE.NormalBlending); s.position.copy(at);
    fx.push({ obj: add(s), t: 0, dur, tick(k, dt) { s.scale.setScalar(size * (0.4 + k)); s.material.opacity = 0.7 * (1 - k); s.position.y += rise * dt; } });
  }
  function flash(at, dir, size) {
    const s = sprite('flash', 0xffd8a0, THREE.AdditiveBlending); s.position.copy(at).addScaledVector(dir, 0.05); s.material.rotation = Math.random() * 3;
    fx.push({ obj: add(s), t: 0, dur: 0.07, tick(k) { s.scale.setScalar(size * (1 - 0.5 * k)); s.material.opacity = 1 - k; } });
  }
  function shards(at) {
    const n = 16, geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), vel = [];
    for (let i = 0; i < n; i++) { pos.set([at.x, at.y + 0.05, at.z], i * 3); vel.push(new V3((Math.random() - 0.5) * 3, 1 + Math.random() * 2.5, (Math.random() - 0.5) * 3)); }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xcfe8d0, size: 0.035, transparent: true, depthWrite: false }));
    pts.frustumCulled = false;
    fx.push({ obj: add(pts), t: 0, dur: 0.9, tick(k, dt) {
      for (let i = 0; i < n; i++) { vel[i].y -= 9.8 * dt; pos[i * 3] += vel[i].x * dt; pos[i * 3 + 1] = Math.max(at.y, pos[i * 3 + 1] + vel[i].y * dt); pos[i * 3 + 2] += vel[i].z * dt; }
      geo.attributes.position.needsUpdate = true; pts.material.opacity = 1 - k;
    } });
  }
  function disposeObj(o) {
    remove(o);
    o.traverse(m => { if (m.geometry && !m.geometry.userData.shared) m.geometry.dispose(); if (m.material && !m.material.userData.shared) m.material.dispose(); });
  }
  function tickFx(dt) {
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i]; f.t += dt;
      const k = cl(f.t / f.dur);
      f.tick(k, dt);
      if (k >= 1) { fx.splice(i, 1); disposeObj(f.obj); }
    }
  }
  function unloadArea() {
    for (const p of proj) disposeObj(p.mesh);
    for (const h of hazards) { if (h.end) h.end(); disposeObj(h.obj); }
    for (const f of fx) disposeObj(f.obj);
    proj.length = hazards.length = fx.length = 0;
  }

  // ---- hands: props, aim pose and IK -----------------------------------------------------------------------------
  function hands(S, dt) {
    const c = S.c, inv = S.inv, w = inv.weapon, g = w && GUN[w];
    if (S.act && (!S.act.move || S.act.name === 'carry')) {           // traversal, carrying, bench, backpack: hands free
      if (!['takedown', 'grab', 'death'].includes(S.act.name)) { hold(c, 'r', null); hold(c, 'l', null); }
      return;
    }
    const gunOut = g && (S.aim || reloading || gunT < 2.2);
    const bow = gunOut && g.bow;
    hold(c, 'l', bow ? 'bow' : null);
    hold(c, 'r', S.throwAim || throwAnim > 0.35 ? (throwAnim > 0 ? null : inv.throwSel) : bow ? null : gunOut ? g.prop : inv.melee ? inv.melee.kind : null);
    const T = c.ikT || (c.ikT = {});
    const sh = c.point('shoulder_r', new V3()), d = camDir(new V3());
    if (bow) uprightBow(c, S.aim ? d : U.fwd(c.yaw, _b));
    if (S.aim && !g.bow) {
      const P = aimPoint(S, new V3()), dir = P.distanceTo(sh) > 1.5 ? P.sub(sh).normalize() : d;
      T.R = { p: sh.clone().addScaledVector(dir, 0.52).addScaledVector(_up, -0.04), w: 1 };
      T.L = g.prop === 'revolver' || g.prop === 'pistol' ? { p: T.R.p.clone().addScaledVector(_up, -0.03).add(_b.set(Math.cos(c.yaw) * 0.04, 0, -Math.sin(c.yaw) * 0.04)), w: 0.9 } : null;
    } else if (S.aim && g.bow) {
      const sl = c.point('shoulder_l', new V3());
      T.L = { p: sl.clone().addScaledVector(d, 0.62), w: 1 };
      T.R = { p: c.point('eyes', new V3()).addScaledVector(d, 0.06 + 0.3 * (1 - draw)).add(_b.set(-Math.cos(c.yaw) * 0.08, -0.05, Math.sin(c.yaw) * 0.08)), w: 1 };
    } else if (reloading) {
      const ch = c.point('chest', new V3()).addScaledVector(U.fwd(c.yaw, _b), 0.3).addScaledVector(_up, -0.12);
      T.R = { p: ch, w: 0.9 };
      T.L = { p: ch.clone().add(_b.set(Math.cos(c.yaw) * 0.06, 0.03 + 0.03 * Math.sin(reloading.t * 14), -Math.sin(c.yaw) * 0.06)), w: 0.9 };
    } else if (S.throwAim) {
      T.R = { p: sh.clone().addScaledVector(d, -0.25).addScaledVector(_up, 0.3), w: 1 }; T.L = { p: sh.clone().addScaledVector(d, 0.45).add(_b.set(Math.cos(c.yaw) * 0.4, 0, -Math.sin(c.yaw) * 0.4)), w: 0.6 };
    } else if (throwAnim > 0) {
      const k = 1 - throwAnim / 0.5;
      T.R = { p: sh.clone().addScaledVector(d, -0.25 + 0.85 * sm(cl(k * 2.2))).addScaledVector(_up, 0.3 - 0.35 * k), w: 1 - sm(cl((k - 0.6) / 0.4)) }; T.L = null;
    } else { T.R = null; T.L = null; }
    throwAnim = Math.max(0, throwAnim - dt);
  }

  // the bow is held upright whatever the wrist does: limbs (local Z) up, the belly (local +Y) toward the target
  const _q = new THREE.Quaternion(), _x = new V3(), _z = new V3();
  function uprightBow(c, dir) {
    const b = c.held('l');
    _z.copy(_up).addScaledVector(dir, -dir.y).normalize();
    _x.crossVectors(dir, _z);
    b.parent.getWorldQuaternion(_q).invert();
    b.quaternion.setFromRotationMatrix(_m.makeBasis(_x, dir, _z)).premultiply(_q);
  }

  // ---- input ------------------------------------------------------------------------------------------------------------
  function select(S) {
    const inv = S.inv, gs = guns(S);
    const side = gs.filter(w => w === 'revolver' || w === 'pistol'), long = gs.filter(w => !side.includes(w));
    const cycle = (list, cur) => list.length ? list[(list.indexOf(cur) + 1) % list.length] : cur;
    if (Input.pressed('slot1') && side.length) equip(S, side[0]);
    if (Input.pressed('slot2') && long.length) equip(S, long.includes(inv.weapon) ? cycle(long, inv.weapon) : long[0]);
    if (Input.pressed('next') || Input.pressed('prev')) { const all = [...gs, null], i = all.indexOf(inv.weapon), n = all.length; equip(S, all[(i + (Input.pressed('next') ? 1 : n - 1)) % n]); }
    if (Input.pressed('slot3')) { const own = THROWN.filter(t => has(S, t)); inv.throwSel = own.length ? cycle(own, inv.throwSel) : null; }
  }
  function update(S, dt) {
    const c = S.c, inv = S.inv;
    cool -= dt; gunT += dt;
    tickProjectiles(S, dt); tickHazards(S, dt); tickFx(dt);
    if (!S.p.combat) return;
    const can = S.ctl && (!S.act || !!S.act.move) && !(S.water && S.water.deep) && !(S.act && S.act.name === 'carry');
    if (can && (!S.act || S.act.name !== 'heal')) select(S);
    if (inv.throwSel && !has(S, inv.throwSel)) inv.throwSel = THROWN.find(t => has(S, t)) || null;
    // throw aim: hold G, release to throw
    const thr = inv.throwSel, wasThrow = S.throwAim;
    S.throwAim = can && !!thr && Input.down('throw') && !reloading && !(S.act && S.act.name === 'heal');
    if (wasThrow && !S.throwAim && can && Input.released('throw')) throwIt(S, thr);
    // gun aim
    if (can && Input.down('aim') && !inv.weapon) inv.weapon = guns(S)[0] || null;
    const g = inv.weapon && GUN[inv.weapon], wasAim = S.aim;
    S.aim = can && !S.throwAim && !!g && Input.down('aim') && !(S.act && S.act.name === 'heal');
    if (S.aim !== wasAim) { c.pose(S.aim ? 'aim' : 'stand', { dur: S.aim ? 0.18 : 0.3 }); if (S.aim) { startAssist(S); swayT = Math.random() * 10; } else { draw = 0; assist = null; } }
    if (S.aim) {
      assistTick(S, dt);
      if (g.bow) { if (!reloading && (inv.clip.bow || 0) > 0) { const was = draw; draw = Math.min(1, draw + dt / 0.7); if (was === 0) Audio.sfx('creak', { pos: c.root.position, vol: 0.3, rate: 1.6 }); } }
      if (Input.pressed('fire')) fire(S);
    }
    if (can && Input.pressed('reload') && !S.throwAim) startReload(S);
    reloadTick(S, dt);
    // aim sway: hurt, just sprinted, scoped; steadier with upgrades and training
    swayT += dt;
    const hurt = 1 - S.hp / S.max, steady = (1 - 0.25 * S.skill('steady')) * (g && upg(S, inv.weapon, 'sway') ? 0.6 : 1);
    const amp = S.aim ? (0.004 + 0.02 * S.heat + 0.016 * hurt) * steady * (scope > 0.5 ? 0.45 : 1) : 0;
    S.cam.swayX = U.damp(S.cam.swayX, amp * (Math.sin(swayT * 1.1) + 0.35 * Math.sin(swayT * 2.9)), 6, dt);
    S.cam.swayY = U.damp(S.cam.swayY, amp * 0.7 * (Math.sin(swayT * 1.63 + 1) + 0.3 * Math.sin(swayT * 3.7)), 6, dt);
    scope = U.damp(scope, S.aim && g.scope ? 1 : 0, 9, dt);
    if (scope < 0.02) scope = 0;
    UI.scope(scope > 0.6 ? scope : 0);
    // first aid (4), melee / takedowns (F)
    if (can && !S.act && Input.pressed('slot4')) heal(S);
    if (fHold) {
      fHold.t += dt;
      if (!Input.down('melee') || fHold.t > 0.3) { const a = fHold.a, k = fHold.t > 0.3 ? 'shiv' : 'choke'; fHold = null; if (!a.aware && a.alive) takedown(S, a, k); }
    } else if (can && !S.act) {
      const tgt = !S.aim && !S.throwAim ? AI.takedownTarget(c.root.position, c.yaw) : null;
      let prompt = null;
      if (tgt && tgt.type !== 'bloatware') {
        const shiv = has(S, 'shiv') && !S.chloe();
        if (S.chloe()) prompt = 'f – stab';
        else if (tgt.type === 'clicker') prompt = shiv ? 'f – shiv' : null;
        else prompt = shiv ? 'f – choke · hold f – shiv' : 'f – choke';
      }
      if (prompt) S.ask(prompt);
      if (Input.pressed('melee')) {
        if (!prompt) melee(S);
        else if (S.chloe()) takedown(S, tgt, 'stab');
        else if (tgt.type === 'clicker') takedown(S, tgt, 'shiv');
        else if (has(S, 'shiv')) fHold = { a: tgt, t: 0 };
        else takedown(S, tgt, 'choke');
      }
    }
    hands(S, dt);
    arcPreview(S);
  }
  // scoped rifle: the camera moves to the eye and zooms
  function view(S, cp) {
    if (scope <= 0) return;
    const c = S.c, d = camDir(_d), eye = c.point('eyes', _a).addScaledVector(d, 0.25);
    cp.pos.lerp(eye, scope); cp.target.copy(cp.pos).addScaledVector(d, 10);
    cp.fov = U.lerp(cp.fov, 17, scope);
  }

  function hud(S) {
    const inv = S.inv;
    if (!S.p.combat) return { weapon: null, ammo: null, reserve: null, throwable: null, aim: false };
    const w = inv.weapon, g = w && GUN[w];
    const thr = inv.throwSel && has(S, inv.throwSel) ? { name: name(inv.throwSel), n: inv.items[inv.throwSel] } : null;
    if (g) return { weapon: name(w), ammo: inv.clip[w] || 0, reserve: inv.ammo[w] || 0, throwable: thr, aim: S.aim && scope < 0.5 };
    const m = inv.melee;
    return { weapon: m ? name(m.kind) : null, ammo: m ? m.hits : null, reserve: null, throwable: thr, aim: false };
  }

  return { setup, update, view, release, unloadArea, hud, equip, grab, inSmoke, cap, GUN, RESERVE, MELEE, get scoped() { return scope > 0.5; } };
})();
