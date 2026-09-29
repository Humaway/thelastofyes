// ============================================================================
// AI — infected (Scroller, Lurker, Clicker, Bloatware), humans (factions), companions, crowds, perception (sight cones,
// noise, darkness), navigation grid (171_ainav.js), barks (172_barks.js). Owned by: systems (AI) agent.
// Spec §5 (companion AI), §6 (stealth, infected, humans), §7 (the click, whispers), §17 (barks).
//
// CONTRACT
//   AI.spawn(type, at {pos, yaw}, opts) -> agent   types: scroller lurker clicker bloatware human crowd
//        opts: { name, char (existing Character to drive), behaviour: 'idle'|'wander'|'patrol'|'hunt'|'ambush'|'scripted'|
//                'phone_idle'|'queue'|'guard', route:[points] | patrol name, faction ('comms'|'smuggler'|'doorknocker'|'retreat'|
//                'bandit'|'landline'), weapon ('rifle'|'pistol'|'pipe'|'machete'|'axe'|'bow'|'shotgun'), aware, hp, target, seed,
//                def (Chars def override), radius (wander radius, default 5) }
//        agent: { char, type, faction, state ('idle'|'suspicious'|'search'|'combat'|'flee'|'dead'), hp, alive, aware,
//                 damage(n, {type:'bullet'|'melee'|'fire'|'shiv'|'choke'|'explosion'|'arrow'|'stab', part:'head'|'body', from:Vector3, force,
//                 weapon ('fists' = a punch), by (agent that dealt it; omitted = the player)}),
//                 stun(sec), kill(), alert(pos), setBehaviour(b, opts), onDeath(fn), takedown(kind), grabbing (kind while it holds the player) }
//        Damage n is in melee hits (Play's units: fists 0.5, melee weapon 1–1.6, revolver 1.6, pistol 1.1, rifle 4, shotgun
//        pellets 0.5, arrow ≤ 2.6, fire 1 per 0.5 s). Bullet/arrow headshots kill Scrollers, Lurkers and humans outright and
//        count double on Clickers and Bloatware. Scrollers take 2 hits, Lurkers 3, humans 3, Clickers 4 (2 headshots or a close
//        shotgun blast; a punch — melee under 1 hit — does nothing and earns a grab; fire, shiv or stab kills), Bloatware 18
//        (fire ×3; melee barely scratches it). Hit reactions flinch and stagger; the dead drop their weapon; bodies stay, and a
//        human who sees a friend's body raises the alarm and the group sweeps round it.
//        setBehaviour('scripted') parks any agent (companions too) until another behaviour is set.
//   AI.companion(char, {role:'chloe'|'wai'|'zane'|'aidan'|'luke'|'techsupport'|'regional', follow=true, weapon}) -> agent
//        follow 3–5 m (inside of corners, never in doorways or the line of fire; teleports near the player if > 25 m behind and
//        off-screen), crouches/holds still in stealth, invisible to enemies (a scene scripts any exception), combat callouts,
//        throws bricks/bottles to stun, rescue-stab when the player is grabbed (≤ once per 60 s), hands over supplies,
//        idles with life (looks around, points, strolls into view, sits, remarks from A.remark tags; jumpy after a fight, quiet after
//        a death). companion.say(line) / .goTo(pt) / .hold(bool)
//        Also companion.dismiss() (stop driving the character). Companions survive AI.clear(); one agent per character.
//        Weapons by role: chloe bricks and bottles (+ weapon 'pistol' after 4.7: rare, bad shots), wai bat, zane/luke/regional
//        rifle, aidan slingshot (stuns), techsupport shotgun. Chloe hands over 'bars' in the calm and a 'bottle' in fights
//        (Play.give). Companions take no damage; enemies only ever target the player.
//   AI.noise(pos, radius, source)      emit noise: footsteps (Play), gunshots 40 m, glass 15 m, thrown objects where they land
//        source 'step' | 'land' | 'vault' | 'climb' | 'takedown' | 'melee' | 'gunshot' | 'player' = the player's own noise
//        (infected hunt it, humans investigate or engage); any other string is a distraction (everyone investigates the spot);
//        humans treat 'explosion' like gunfire.
//   AI.hitTest(origin, dir, maxDist) -> { agent, part:'head'|'body', point, dist } | null     (character hit volumes; world
//        geometry between origin and the hit blocks it; companions and crowds are never hit)
//   AI.takedownTarget(pos, yaw) -> agent | null     an unaware (or stunned) enemy within 1.3 m whose back faces the player;
//        never Bloatware. Clickers are returned too — Play decides (SIM shiv only).
//   agent.takedown(kind:'choke'|'shiv'|'stab') -> Promise   paired animation with Play.char: AI turns the pair to face the
//        same way, sets the victim 0.42 m in front and animates it (Play animates the player); resolves when done (agent
//        dead). choke 2.6 s, shiv 1.1 s, stab 0.9 s.
//   AI.listenTargets(pos, r) -> agents currently making noise within r (Airplane Mode silhouettes)
//   AI.detectors -> [{ dir (radians relative to camera yaw), amount 0..1 }]  detection building (UI.detect arcs)
//   AI.update(dt) · AI.clear() · AI.list · AI.byName(name) -> Character · AI.alertLevel (0..1, drives Audio.tension)
//   AI.nav   navigation grid built from World boxes on area load: AI.nav.path(from, to) -> [Vector3] | null
//   AI.extendArea(A) adds A.patrol(name, points), A.cover(points), A.navBounds(x1, z1, x2, z2)
//        + A.remark({at, r=4, text | id (CONTENT.remarks), emote, who='chloe', cond}) — a companion remark tag, each plays
//          once when she is near it and nothing else is happening (she walks over, looks, says it; after ~100 s of calm
//          without one she goes to any unplayed tag within 12 m of the player); text null = she only looks and goes quiet
//        Darkness, tall grass and smoke come from Play.visibility (A.dark / A.tallGrass): they shrink how far and how fast
//        the player is seen; crouching shortens it too, standing still slows it, and waist-high cover hides a crouched body.
//   AI.fire(pos, {r=1.8, dur=4, by}) — a toxic fire pool (Bloatware pillows): burns the player and every agent inside
//        (Clickers die, Bloatware ×3), except `by`
//   AI.grabber -> the agent holding the player (or null)
// Rules: cap 12 active agents (CONFIG.maxActiveAI; crowd extras are cheap and not counted); freeze agents > 60 m away;
// companions never break stealth; the player always knows why they were spotted (detection builds visibly: the head turns,
// the arc fills, they stop and bark at the half-way mark); enemies bark by title/slang (CONTENT.barks), never names.
// When an agent grabs the player it turns both to face each other, holds itself 0.55 m in front of the player and calls
// Play.grab(agent, kind); Play resolves 'killed' when the agent dies during the struggle (e.g. the companion's rescue stab).
// ============================================================================
const AI = (() => {
  const V3 = THREE.Vector3, TAU = Math.PI * 2;
  const list = [], detectors = [], noises = [], fx = [], remarks = [], routes = new Map();
  const _a = new V3(), _b = new V3(), _c = new V3(), _d = new V3(), _e = new V3();
  let alertLevel = 0, grabber = null, fxRoot = null, seedN = 1, stealthOn = false, combatWas = false, fightT = 0;

  // ---- tables ------------------------------------------------------------------------------------------------------
  const TYPES = {
    scroller: { hp: 2, walk: 0.6, run: 5.1, sight: 0.75, headKill: true, beh: 'wander' },
    lurker: { hp: 3, walk: 0.9, run: 5.6, sight: 0.36, headKill: true, beh: 'ambush' },
    clicker: { hp: 4, walk: 0.5, run: 3.2, sight: 0, noPunch: true, beh: 'wander' },
    bloatware: { hp: 18, walk: 0.7, sight: 0, noPunch: true, fire: 3, beh: 'idle', big: true },
    human: { hp: 3, walk: 1.3, run: 4.4, sight: 1, headKill: true, beh: 'idle' },
    crowd: { hp: 1, walk: 1.1, beh: 'phone_idle' },
    companion: { hp: 1 },
  };
  const WEAPONS = {
    rifle: { range: 34, dmg: 24, acc: 0.72, burst: [1, 2], gap: 0.55, mag: 5, cd: [2.2, 3.4], sfx: 'rifle_shot', hit: 3 },
    pistol: { range: 22, dmg: 15, acc: 0.62, burst: [1, 3], gap: 0.4, mag: 8, cd: [1.5, 2.6], sfx: 'gunshot', hit: 1 },
    shotgun: { range: 13, dmg: 45, acc: 0.85, burst: [1, 1], gap: 0, mag: 2, cd: [2.2, 3.2], sfx: 'shotgun', hit: 4 },
    bow: { range: 26, dmg: 32, acc: 0.6, burst: [1, 1], gap: 0, mag: 99, cd: [3, 4.2], sfx: 'bow', arrow: true, hit: 2 },
    pipe: { melee: true, dmg: 20, reach: 1.7, wind: 0.42, cd: [1.3, 2.1], hit: 1.5, g: 'swing' },
    machete: { melee: true, dmg: 28, reach: 1.8, wind: 0.38, cd: [1.4, 2.2], hit: 1.5, g: 'swing' },
    axe: { melee: true, dmg: 34, reach: 1.9, wind: 0.55, cd: [1.8, 2.6], hit: 2, g: 'swing' },
    bat: { melee: true, dmg: 22, reach: 1.8, wind: 0.4, cd: [1.1, 1.7], hit: 1.5, g: 'swing' },
  };
  const FISTS = { dmg: 12, reach: 1.4, wind: 0.3, cd: [1, 1.6], g: 'punch' }, BUTT = { dmg: 14, reach: 1.6, wind: 0.35, cd: [1.4, 2], g: 'swing' };
  const CLAW = { dmg: 10, reach: 1.3, wind: 0.3, cd: [1, 1.6], g: 'grab' }, LUNGE = { dmg: 18, reach: 1.4, wind: 0.25, cd: [0.6, 0.8], g: 'grab' };
  const FACTIONS = {
    comms: { def: 'soldier', weapons: ['rifle', 'rifle', 'pistol'] },
    smuggler: { def: 'smuggler', weapons: ['pistol', 'pipe'] },
    doorknocker: { def: 'doorknocker', weapons: ['pistol', 'rifle', 'machete'] },
    retreat: { def: 'retreat', weapons: ['bow', 'rifle', 'axe'] },
    bandit: { def: 'bandit', weapons: ['rifle', 'pipe', 'pistol'] },
    landline: { def: 'landline', weapons: ['rifle'] },
  };
  const ROLES = { chloe: 'brick', wai: 'bat', zane: 'rifle', aidan: 'slingshot', luke: 'rifle', techsupport: 'shotgun', regional: 'rifle' };
  const PLAYER_NOISE = new Set(['player', 'step', 'land', 'vault', 'climb', 'takedown', 'melee', 'gunshot']);

  // ---- small helpers ---------------------------------------------------------------------------------------------------
  const pos = a => a.char.root.position;
  const flat = (p, q) => Math.hypot(p.x - q.x, p.z - q.z);
  const now = () => Game.time;
  const rnd = (a, r) => a[0] + (a[1] - a[0]) * r();
  const eye = (a, out) => out.copy(pos(a)).setY(pos(a).y + a.char.height * (a.crouch ? 0.62 : 0.92));
  const chest = (c, out) => out.copy(c.root.position).setY(c.root.position.y + c.height * 0.72);
  const enemy = a => a.alive && !a.companion && a.type !== 'crowd';
  const gridOf = a => AINav.get(Game.areas.get(a.area) || Game.area);
  const camYaw = () => { Engine.camera.getWorldDirection(_e); return Math.atan2(_e.x, _e.z); };
  const relDir = p => U.wrapAngle(camYaw() - U.yawTo(Engine.camera.position, p));
  const bark = (a, cat) => Dialogue.bark(a.type === 'scroller' ? 'scroller' : a.faction, cat, { pos: pos(a), char: a.char });
  const chaseBark = cat => Play.profile.stats !== 'chloe' && Dialogue.bark('chase', cat, { char: Play.char });
  function onScreen(p) {
    const v = _e.copy(p).setY(p.y + 1).project(Engine.camera);
    return v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05 && World.visible(Engine.camera.position, _d.copy(p).setY(p.y + 1));
  }
  // sight: walls and tall props (World), plus the low solid cover Build leaves out of LOS (barriers, crates, sandbags, car
  // bodies) so a crouched body behind waist-high cover is hidden
  function lowCover(p, q) {
    const d = [q.x - p.x, q.y - p.y, q.z - p.z], o = [p.x, p.y, p.z];
    for (const b of World.boxes) {
      if (b.sight || !b.block || b.max.y - b.min.y > 1.4) continue;
      const mn = [b.min.x, b.min.y, b.min.z], mx = [b.max.x, b.max.y, b.max.z];
      let t0 = 0, t1 = 1;
      for (let i = 0; i < 3 && t0 <= t1; i++) {
        if (Math.abs(d[i]) < 1e-9) { if (o[i] < mn[i] || o[i] > mx[i]) t0 = 2; continue; }
        let a = (mn[i] - o[i]) / d[i], c = (mx[i] - o[i]) / d[i]; if (a > c) [a, c] = [c, a];
        t0 = Math.max(t0, a); t1 = Math.min(t1, c);
      }
      if (t0 <= t1 && t0 > 0) return true;
    }
    return false;
  }
  const los = (p, q) => World.visible(p, q) && !lowCover(p, q);

  // ---- spawning ------------------------------------------------------------------------------------------------------------
  function spawn(type, at, o = {}) {
    const T = TYPES[type] || TYPES.human, seed = o.seed ?? seedN++, rng = U.rng(seed * 977 + 13);
    const faction = type === 'human' ? o.faction || 'smuggler' : null, F = faction && FACTIONS[faction];
    const c = o.char || Chars.create(o.def || (F ? F.def : type), { name: o.name, seed });
    if (at) Game.place(c, at);
    const a = agent(type, c, Object.assign({}, o, { rng, faction }));
    a.wname = o.weapon || (F ? U.pick(F.weapons, rng) : null);
    a.hand = a.wname === 'bow' ? 'l' : 'r';
    if (WEAPONS[a.wname] && !c.held(a.hand)) c.hold(a.wname, a.hand);
    a.W = WEAPONS[a.wname] || null; a.ammo = a.W ? a.W.mag : 0;
    if (type === 'bloatware') a.crackle = Audio.loop('fire', { pos: pos(a).clone(), vol: 0.1 });
    setBehaviour(a, o.behaviour || T.beh, o);
    if (o.aware || o.behaviour === 'hunt') alert(a, o.target ? Game.G.marker(o.target).pos : null);
    list.push(a);
    return a;
  }
  function agent(type, c, o) {
    c.root.rotation.order = 'YXZ';
    const a = {
      char: c, type, T: TYPES[type], faction: o.faction || null, name: o.name || c.name, rng: o.rng || U.rng(seedN++ * 31), state: 'idle',
      hp: o.hp ?? TYPES[type].hp, alive: true, aware: false, area: Game.area ? Game.area.id : null, home: c.root.position.clone(), homeYaw: c.yaw,
      rest: c.poseName, radius: o.radius ?? 5, det: 0, seeK: 0, vis: false, perT: 0, lkp: null, seenT: -99, heardT: -99, spotT: -99, stunned: 0,
      v: 0, goal: null, path: null, pi: 0, planT: 0, dirty: false, spd: 0, stop: 0.5, crouch: false, face: null, stuckT: 0, stuckN: 0, lastP: c.root.position.clone(),
      stunT: 0, busy: null, grabbing: null, grabCd: 0, cd: 0, timer: 0, sub: null, W: null, ammo: 0, ownChar: !o.char, deathFns: [], lean: 0,
      damage: (n, opt) => damage(a, n, opt), stun: s => stun(a, s), kill: () => die(a, {}), alert: p => alert(a, p),
      setBehaviour: (b, opt) => setBehaviour(a, b, opt), onDeath: fn => { a.deathFns.push(fn); }, takedown: k => takedown(a, k),
    };
    a.maxHp = a.hp;
    return a;
  }
  function setBehaviour(a, b, o = {}) {
    a.behaviour = b; a.sub = null; a.goal = null; a.path = null;
    if (a.alive) a.state = 'idle';
    if (o.route) a.route = typeof o.route === 'string' ? (routes.get(o.route) || { pts: [] }).pts : o.route.map(p => Game.G.marker(p).pos.clone());
    if (o.radius) a.radius = o.radius;
    a.ri = 0; a.timer = 0.5 + a.rng() * 1.5; a.lookYaw = a.char.yaw;
    if (a.type === 'crowd') crowdSetup(a);
  }

  // ---- damage, stun, death ------------------------------------------------------------------------------------------------------------
  function damage(a, n, o = {}) {
    if (!a.alive || a.companion || a.busy === 'takedown') return;
    const T = a.T, type = o.type || 'bullet', head = o.part === 'head';
    const from = o.from ? U.v3(o.from).clone() : o.by ? pos(o.by).clone() : Play.char ? Play.char.root.position.clone() : pos(a).clone();
    if (type === 'melee' && T.noPunch && (o.weapon === 'fists' || n < 1)) {        // a punch does nothing to Clickers and Bloatware
      react(a, 0.3, from);
      if (a.type === 'clicker' && !o.by && canGrab(a) && flat(pos(a), Play.char.root.position) < 2) startGrab(a, 'clicker');
      return;
    }
    let d = n;
    if (type === 'fire') d = a.type === 'clicker' ? a.hp : n * (T.fire || 1);
    else if ((type === 'bullet' || type === 'arrow') && head) d = T.headKill ? a.hp : n * 2;
    else if (type === 'shiv' || type === 'stab' || type === 'choke') d = a.type === 'bloatware' ? 1 : a.hp;
    else if (type === 'melee' && a.type === 'bloatware') d = n * 0.2;
    a.hp -= d;
    if (a.hp <= 0) { die(a, Object.assign({}, o, { type, from })); return; }
    react(a, Math.min(1, d / a.maxHp + (type === 'melee' || type === 'explosion' ? 0.35 : 0.15)), from);
    const src = o.by ? pos(o.by) : Play.char ? Play.char.root.position : from;
    if (a.state !== 'combat' && a.state !== 'flee') alert(a, src); else if (a.lkp) a.lkp.copy(src);
    if (a.type === 'lurker') a.sub = { k: 'retreat' };
  }
  // flinch: recoil overlay, the body rocks back from the hit and slides a little; heavy hits stagger
  function react(a, k, from) {
    const c = a.char, p = pos(a), dx = p.x - from.x, dz = p.z - from.z, L = Math.hypot(dx, dz) || 1, push = (a.T.big ? 0.15 : 0.5) * k;
    c.gesture('recoil');
    a.lean = -0.1 - 0.35 * k;
    const r = World.move(p.x, p.y, p.z, dx / L * push, dz / L * push, 0.28, c.height); p.x = r.x; p.z = r.z;
    a.stunT = Math.max(a.stunT, a.T.big ? 0.15 : 0.2 + k * 0.6);
    if (a.type === 'human') c.emote(k > 0.5 ? 'afraid' : 'angry', 1.2);
  }
  function stun(a, sec) {
    if (!a.alive || a.companion) return;
    a.stunT = Math.max(a.stunT, sec); a.stunned = now() + sec; a.lean = -0.3;
    a.char.gesture('struggle', { dur: Math.min(2.5, sec) });
    if (a.type === 'human') a.char.emote('afraid', sec);
    if (a.state !== 'combat' && a.state !== 'flee') alert(a, Play.char ? Play.char.root.position : null);
  }
  function die(a, o) {
    if (!a.alive) return;
    const c = a.char, from = o.from || (Play.char ? Play.char.root.position : pos(a));
    a.alive = false; a.state = 'dead'; a.hp = 0; a.goal = null; a.path = null; a.busy = null; a.lean = 0;
    if (grabber === a) grabber = null;
    c.stop(); c.gesture(null); c.lookAt(null); c.setMove(0); c.root.rotation.x = 0;
    if (!o.silent) c.yaw = U.yawTo(pos(a), from);
    c.emote('shocked', 0.6);
    if (a.type === 'human' && c.held(a.hand)) c.drop(a.hand);
    c.phoneGlow(false);
    c.pose('dead', { dur: o.silent ? 0.9 : 0.55 });
    later(o.silent ? 0.9 : 0.5, () => Audio.sfx('body_fall', { pos: pos(a).clone(), vol: a.T.big ? 1 : 0.8 }));
    if (a.crackle) { a.crackle.stop(0.5); a.crackle = null; }
    if (a.type === 'bloatware') { Audio.sfx('battery_burst', { pos: pos(a).clone() }); fire(pos(a).clone(), { r: 2.2, dur: 5, by: a }); }
    noise(pos(a), 4, a);
    for (const f of a.deathFns) f(a, o);
    // the living react: a friend barks, the companion goes quiet, Chase notes the kill
    const friend = list.find(b => b !== a && b.alive && b.faction && b.faction === a.faction && b.state === 'combat' && flat(pos(b), pos(a)) < 25);
    if (friend) later(0.7, () => bark(friend, 'death'));
    for (const b of list) {
      if (!b.companion) continue;
      b.quietT = 45;
      const d = flat(pos(b), pos(a));
      if (b.role === 'chloe' && d < 15) later(0.9, () => Dialogue.bark('chloe', o.silent ? 'nice' : a.type === 'human' ? 'down' : d < 6 ? 'gross' : 'nice', { char: b.char }));
    }
    if (!o.by && !o.silent && Math.random() < 0.3) later(0.4, () => chaseBark('kill'));
  }

  // ---- perception --------------------------------------------------------------------------------------------------------------
  // How well agent `a` sees the player right now: 0 (not at all) .. 1. Cone 100°, 18 m, cut by darkness, grass, smoke, crouching.
  function sightK(a, pl) {
    const pp = pl.root.position, e = eye(a, _a), crouched = !!Play.crouched, conceal = Play.visibility ?? 1;
    const d = flat(e, pp), range = 18 * a.T.sight * (0.15 + 0.85 * conceal) * (crouched ? 0.7 : 1) * (a.aware ? 1.3 : 1);
    if (d > range) return 0;
    const ang = Math.abs(U.wrapAngle(U.yawTo(e, pp) - a.char.yaw));
    if (ang > 0.87 && !(d < 2.2 && Play.speed > 0.6)) return 0;
    let seen = false;
    for (const h of crouched ? [0.7] : [1.5, 1.0]) if (los(e, _b.set(pp.x, pp.y + h, pp.z))) { seen = true; break; }
    return seen ? conceal * (ang > 0.55 ? 0.55 : 1) : 0;
  }
  // detection build-up: faster when close and when the player moves; slower in the periphery and crouched
  function perceive(a, dt, pl) {
    if ((a.perT -= dt) <= 0) { a.perT = 0.1 + a.rng() * 0.05; a.seeK = sightK(a, pl); }
    const pp = pl.root.position, d = flat(pos(a), pp);
    if (a.seeK > 0) {
      const sp = Play.speed || 0, mv = sp > 4 ? 1.6 : sp > 0.4 ? (Play.crouched ? 0.75 : 1.1) : (Play.crouched ? 0.35 : 0.55);
      a.det = Math.min(1, a.det + a.seeK * mv / (0.35 + d * 0.12) * (a.aware ? 1.5 : 1) * (a.type === 'scroller' ? 0.8 : 1) * dt);
      (a.lkp || (a.lkp = new V3())).copy(pp); a.seenT = now();
      if (a.det > 0.2) a.char.lookAt(pl);
    } else {
      a.det = Math.max(0, a.det - dt * (a.state === 'suspicious' ? 0.1 : 0.22));
      if (a.det < 0.15 && a.state === 'idle') a.char.lookAt(null);
    }
    if (a.det >= 1) spotted(a);
    else if (a.det >= 0.45 && a.state === 'idle') suspicious(a, pp);
    if (a.state !== 'combat' && a.det > 0.02) detectors.push({ dir: relDir(pos(a)), amount: a.det });
  }
  function spotted(a) {
    const pl = Play.char;
    a.state = 'combat'; a.aware = true; a.det = 1; a.spotT = now(); a.sub = null; a.first = true;
    a.lkp = pl.root.position.clone(); a.seenT = now(); a.fireT = 0.7 + a.rng() * 0.6; a.cd = 0.4;
    a.char.lookAt(pl);
    if (a.type === 'scroller') { Audio.sfx('scroller_scream', { pos: pos(a).clone(), rate: 0.9 + a.rng() * 0.2 }); bark(a, 'chase'); a.char.pose('stand'); }
    else if (a.type === 'human') { a.char.emote('angry', 2); bark(a, Play.profile.stats === 'chloe' && a.faction === 'retreat' ? 'flight' : 'spot'); }
    // call to each other: allies join after a beat
    for (const b of list) {
      if (b === a || !enemy(b) || b.state === 'combat') continue;
      const same = a.faction ? b.faction === a.faction : a.type === 'scroller' && b.type === 'scroller';
      if (same && flat(pos(a), pos(b)) < (a.faction ? 30 : 14)) later(0.4 + b.rng() * 0.8, () => { if (b.alive && b.state !== 'combat') alert(b, a.lkp); });
    }
  }
  function suspicious(a, p) {
    a.state = 'suspicious'; a.sub = { k: 'look', t: 0, p: U.v3(p).clone() };
    halt(a, a.sub.p);
    if (a.type === 'human') { bark(a, 'search'); a.char.emote('tense', 3); a.char.lookAt(a.sub.p.clone().setY(a.sub.p.y + 1.4)); }
    else if (a.type === 'scroller' && a.rng() < 0.5) bark(a, 'chase');
  }
  function alert(a, p) {
    if (!a.alive || a.companion || a.type === 'crowd') return;
    const pl = Play.char, q = p ? U.v3(p).clone() : pl ? pl.root.position.clone() : pos(a).clone();
    a.aware = true; a.lkp = q;
    if (a.type === 'clicker') { a.state = 'suspicious'; a.sub = { k: 'go', p: q }; return; }
    if (a.type === 'lurker') { a.primed = now(); return; }
    a.state = 'combat'; a.seenT = now() - 2; a.spotT = now(); a.sub = null; a.fireT = 0.8 + a.rng(); a.first = true;
    if (a.type === 'scroller') a.char.pose('stand');
  }
  // noise ------------------------------------------------------------------------------------------------------------------
  function noise(p, r, source) { noises.push({ pos: U.v3(p).clone(), r, source }); }
  function hear(a, n) {
    if (n.source === a) return;
    const e = eye(a, _a), d = flat(e, n.pos), hardEars = a.type === 'clicker' && SETTINGS.difficulty === 'hard' ? 1.5 : 1;
    if (d > n.r * hardEars * (World.visible(e, _b.copy(n.pos).setY(n.pos.y + 0.6)) ? 1 : 0.6)) return;
    const mine = PLAYER_NOISE.has(n.source), src = typeof n.source === 'object' ? n.source : null;
    if (src && src.faction && src.faction === a.faction) { if (a.state !== 'combat' && src.state === 'combat') alert(a, src.lkp); return; }
    if (src && src.type === 'human' && a.type === 'human') return;          // another faction's gunfire is not this fight
    a.heardT = now();
    if (a.type === 'scroller') {
      if (a.state === 'combat') { if (mine) a.lkp.copy(n.pos); }
      else if (mine && (d < n.r * 0.7 || n.source === 'gunshot')) { a.lkp = n.pos.clone(); spotted(a); }
      else { a.state = 'suspicious'; a.sub = { k: 'go', p: n.pos.clone(), run: true }; }
    } else if (a.type === 'clicker') {
      a.lkp = n.pos.clone(); a.aware = true;
      if (mine && d < 5) { if (a.state !== 'combat') { a.state = 'combat'; a.sub = null; Audio.sfx('scroller_scream', { pos: pos(a).clone(), rate: 0.55, vol: 0.8 }); } }
      else if (a.state !== 'combat') { a.state = 'suspicious'; a.sub = { k: 'go', p: n.pos.clone() }; }
    } else if (a.type === 'lurker') {
      if (d < 7) { a.primed = now(); a.lkp = n.pos.clone(); }
    } else if (a.type === 'bloatware') {
      a.lkp = n.pos.clone();
      if (mine) { if (a.state !== 'combat') { a.state = 'combat'; a.fireT = 1.5; } a.seenT = now(); }
      else if (a.state !== 'combat') { a.state = 'suspicious'; a.sub = { k: 'go', p: n.pos.clone() }; }
    } else if (a.state === 'flee') return;                                   // running or begging: past caring
    else if (a.state === 'combat') { if (mine) { a.lkp.copy(n.pos); if (n.source === 'gunshot') a.seenT = Math.max(a.seenT, now() - 1); } }
    else if (n.source === 'gunshot' || n.source === 'explosion' || (n.source === 'melee' && d < 6)) alert(a, n.pos);
    else if (a.state !== 'suspicious' || a.sub.k !== 'go') { a.det = Math.max(a.det, mine ? 0.3 : 0.15); suspicious(a, n.pos); }
  }

  // ---- locomotion: A* path + string pulling (AINav), separation, World collisions ----------------------------------------------------------
  function go(a, t, spd, stop = 0.5) {
    if (flat(pos(a), t) <= stop) { a.goal = null; a.path = null; return true; }
    if (!a.goal) { a.goal = t.clone(); a.path = null; }
    else if (a.goal.distanceTo(t) > 0.7) { a.goal.copy(t); a.dirty = true; }
    a.spd = spd; a.stop = stop; a.face = null;
    return false;
  }
  function halt(a, face) { a.goal = null; a.path = null; a.face = face ? (a.face || new V3()).copy(face) : null; }
  function plan(a) {
    const p = pos(a), g = gridOf(a);
    a.path = (g && !g.clear(p, a.goal) && g.path(p, a.goal)) || [a.goal.clone()];
    a.pi = 0; a.planT = 0.35 + a.rng() * 0.2; a.dirty = false;
  }
  function drive(a, dt) {
    const c = a.char, p = c.root.position;
    let want = 0;
    a.planT -= dt;
    if (a.goal) {
      if (!a.path || (a.dirty && a.planT <= 0)) plan(a);
      let wp = a.path[a.pi];
      while (a.pi < a.path.length - 1 && flat(p, wp) < 0.45) wp = a.path[++a.pi];
      const last = a.pi === a.path.length - 1, dd = flat(p, wp);
      if (last && dd <= a.stop) { a.goal = null; a.path = null; }
      else {
        const err = U.wrapAngle(U.yawTo(p, wp) - c.yaw), tr = a.spd > 3 ? 7 : 4.5;
        c.yaw += U.clamp(err, -tr * dt, tr * dt);
        want = a.spd * U.clamp(1.25 - Math.abs(err) / 1.3, 0.1, 1) * (last ? U.clamp(dd / 1.5 + 0.35, 0, 1) : 1);
      }
      // stuck: asked to move but not moving -> replan, then give up
      if ((a.stuckT += dt) > 0.8) {
        if (want > 0.3 && flat(p, a.lastP) < 0.12 * a.spd) { a.path = null; if (++a.stuckN > 3) { a.goal = null; a.stuckN = 0; } } else a.stuckN = 0;
        a.stuckT = 0; a.lastP.copy(p);
      }
    } else if (a.face) {
      const err = U.wrapAngle(U.yawTo(p, a.face) - c.yaw);
      c.yaw += U.clamp(err, -5 * dt, 5 * dt);
    }
    a.v = U.damp(a.v, want, want > a.v ? 5 : 9, dt);
    if (a.v > 0.02) {
      const f = U.fwd(c.yaw, _d); let dx = f.x * a.v * dt, dz = f.z * a.v * dt;
      for (const o of list) {
        if (o === a || !o.alive || o.busy) continue;
        const q = pos(o), ox = p.x - q.x, oz = p.z - q.z, d2 = ox * ox + oz * oz;
        if (d2 < 0.55 && d2 > 1e-6) { const d = Math.sqrt(d2), k = (0.75 - d) * 2.2 * dt; dx += ox / d * k; dz += oz / d * k; }
      }
      const pl = Play.char;
      if (pl && pl !== c) { const q = pl.root.position, ox = p.x - q.x, oz = p.z - q.z, d = Math.hypot(ox, oz); if (d < 0.7 && d > 1e-3) { dx += ox / d * (0.7 - d); dz += oz / d * (0.7 - d); } }
      const r = World.move(p.x, p.y, p.z, dx, dz, 0.28, c.height); p.x = r.x; p.z = r.z;
      const gy = World.groundAt(p.x, p.z, p.y + 0.5, 0.1); p.y = gy > p.y ? U.damp(p.y, gy, 20, dt) : Math.max(gy, p.y - 5 * dt);
      if ((a.stepAcc = (a.stepAcc || 0) + a.v * dt) > (a.v > 3 ? 1.6 : 1.2)) {                                // footsteps you can track
        a.stepAcc = 0;
        if (p.distanceTo(Engine.camera.position) < (a.type === 'crowd' ? 15 : 30)) Audio.footstep(World.surfaceAt(p.x, p.z, p.y), p, U.clamp(a.v / 5) * (a.crouch ? 0.4 : a.T.big ? 1.3 : 0.85));
      }
    }
    c.setMove(a.v, { crouch: a.crouch });
  }
  // lean from hits settles back
  function posture(a, dt) { a.lean = U.damp(a.lean, 0, 5, dt); a.char.root.rotation.x = a.lean; }

  // ---- grabs and blows -------------------------------------------------------------------------------------------------------------------------
  const NO_GRAB = new Set(['takedown', 'grab', 'death', 'squeeze', 'ladder', 'climb', 'boost']);
  const canGrab = a => !grabber && a.grabCd < now() && !!Play.char && !Director.active && !NO_GRAB.has(Play.busy);
  function startGrab(a, kind) {
    const pl = Play.char, pp = pl.root.position, c = a.char;
    grabber = a; a.busy = 'grab'; a.grabbing = kind; a.goal = null; a.path = null; a.v = 0;
    pl.yaw = U.yawTo(pp, pos(a)); c.yaw = pl.yaw + Math.PI;
    c.gesture('struggle', { hold: true });
    if (kind === 'scroller' || kind === 'lurker') { c.phoneGlow(true); Audio.sfx('scroller_scream', { pos: pos(a).clone(), rate: 1.2, vol: 0.7 }); }   // the lit screen, in his face
    Audio.sfx('tackle', { pos: pp.clone() });
    Play.grab(a, kind).then(res => {
      if (grabber === a) grabber = null;
      if (!list.includes(a)) return;                                          // cleared with its area mid-struggle
      a.busy = null; a.grabbing = null; c.gesture(null);
      if (a.type !== 'lurker') c.phoneGlow(false);
      if (res === 'killed') { if (a.alive) die(a, { type: 'stab', from: pp.clone() }); }
      else if (res === 'escaped' && a.alive) { react(a, 1, pp); a.stunT = 2; a.stunned = now() + 2; a.grabCd = now() + 5; if (a.type === 'lurker') a.sub = { k: 'retreat' }; }
    });
  }
  function holdGrab(a) {
    const pl = Play.char; if (!pl) return;
    const pp = pl.root.position, f = U.fwd(pl.yaw, _d);
    pos(a).set(pp.x + f.x * 0.55, pp.y, pp.z + f.z * 0.55);
    a.char.yaw = pl.yaw + Math.PI; a.char.setMove(0);
  }
  // a melee blow at the player: wind-up, then it connects if the player is still in reach and in front
  function strike(a, W) {
    a.cd = rnd(W.cd, a.rng) + W.wind; a.busy = 'strike';
    a.char.gesture(W.g);
    later(W.wind, () => {
      if (a.busy === 'strike') a.busy = null;
      if (!a.alive || a.stunT > 0 || !Play.char) return;
      const pp = Play.char.root.position, d = flat(pos(a), pp), ang = Math.abs(U.wrapAngle(U.yawTo(pos(a), pp) - a.char.yaw));
      Audio.sfx('swing', { pos: pos(a).clone(), vol: 0.6 });
      if (d < W.reach + 0.35 && ang < 1.1 && !grabber) { Play.damage(W.dmg, a); Audio.sfx('punch', { pos: pp.clone() }); }
    });
  }

  // ---- infected brains -----------------------------------------------------------------------------------------------------------------
  function wander(a, dt, spd) {
    if (!a.goal && (a.timer -= dt) <= 0) {
      const g = gridOf(a), q = g && g.random(a.home, a.radius, a.rng);
      if (q) go(a, q, spd, 0.4);
      a.timer = 3 + a.rng() * 6;
    }
  }
  function scroller(a, dt, pl) {
    const pp = pl.root.position, d = flat(pos(a), pp);
    if ((a.mutT = (a.mutT ?? 2 + a.rng() * 4) - dt) <= 0) {
      a.mutT = a.state === 'combat' ? 2 + a.rng() * 3 : 3.5 + a.rng() * 5;
      if (a.state === 'combat') Audio.sfx('swipe', { pos: pos(a).clone(), vol: 0.5 });
      else { Audio.sfx('whisper', { pos: pos(a).clone(), vol: 0.9 }); if (a.rng() < 0.35) bark(a, 'idle'); if (a.rng() < 0.5) a.char.gesture('swipe'); }
    }
    if (a.state !== 'combat') perceive(a, dt, pl);
    if (a.state === 'idle') { if (a.behaviour === 'wander') wander(a, dt, TYPES.scroller.walk); else halt(a); return; }
    if (a.state === 'suspicious') {
      const s = a.sub; s.t = (s.t || 0) + dt;
      if (s.k === 'look') { halt(a, s.p); if (s.t > 1.2) { s.k = 'go'; s.t = 0; } return; }
      if (go(a, s.p, s.run ? 3.4 : 1.2, 1) || s.t > 12) { a.state = 'idle'; a.home.copy(pos(a)); a.timer = 2; }
      return;
    }
    if (a.state === 'combat') {
      if ((a.perT -= dt) <= 0) { a.perT = 0.15; a.vis = d < 25 && los(eye(a, _a), chest(pl, _b)); if (a.vis) { a.lkp.copy(pp); a.seenT = now(); } }
      if (now() - a.seenT > 6) { a.state = 'search'; a.sub = { t: 0 }; a.home.copy(a.lkp); a.char.pose(a.rest); return; }
      if (grabber && grabber !== a) { if (d < 2.6) halt(a, pp); else go(a, pp, 3, 2.4); return; }
      if (a.vis && d < 1.35 && a.cd <= 0) { halt(a, pp); if (canGrab(a)) startGrab(a, 'scroller'); else strike(a, CLAW); return; }
      go(a, a.vis ? pp : a.lkp, TYPES.scroller.run * (0.92 + (a.pace ??= a.rng()) * 0.16), a.vis ? 1.1 : 0.8);
      return;
    }
    wander(a, dt, 1.3);                                                      // search: mill about where the player vanished
    if ((a.sub.t += dt) > 14) { a.state = 'idle'; a.aware = false; }
  }
  function lurker(a, dt, pl) {
    const pp = pl.root.position, d = flat(pos(a), pp), s = a.sub || (a.sub = { k: 'hide' });
    if ((a.perT -= dt) <= 0) { a.perT = 0.12; a.seeK = sightK(a, pl); if (a.seeK > 0) { a.primed = now(); a.lkp = pp.clone(); } }
    if (s.k === 'hide') {
      if (!a.spot) a.spot = coverNear(a, a.home, 8, pp);
      a.crouch = true; a.state = a.primed > now() - 3 ? 'suspicious' : 'idle';
      if (a.spot && !go(a, a.spot.pos, 2.2, 0.35)) return;
      halt(a, _c.copy(pos(a)).sub(a.spot ? a.spot.dir : _d.set(0, 0, -1)));
      a.char.phoneGlow(true);
      if ((a.scrollT = (a.scrollT ?? 3) - dt) <= 0) { a.scrollT = 5 + a.rng() * 4; Audio.sfx('swipe', { pos: pos(a).clone(), vol: 0.22, rate: 0.6 }); }
      if (d < 4 && a.primed > now() - 2.5 && a.cd <= 0) { s.k = 'inhale'; s.t = 0; Audio.sfx('breath_in', { pos: pos(a).clone() }); a.char.lookAt(pl); halt(a, pp); }
      else if (d > 4 && d < 13 && a.primed > now() - 6 && Math.abs(relDir(pos(a))) > 1.9 && (a.stalkT = (a.stalkT ?? 4) - dt) <= 0) {
        a.stalkT = 6; const q = coverNear(a, pp, 6, pp, 3.5); if (q) a.spot = q;          // creeps closer while the player looks away
      }
      return;
    }
    a.state = 'combat';
    if (s.k === 'inhale') { a.crouch = false; halt(a, pp); if ((s.t += dt) > 0.4) { s.k = 'burst'; s.t = 0; a.char.phoneGlow(false); a.char.pose('stand', { dur: 0.2 }); } return; }
    if (s.k === 'burst') {
      if (d < 1.3) { halt(a, pp); if (canGrab(a) && a.rng() < 0.55) startGrab(a, 'lurker'); else strike(a, LUNGE); s.k = 'retreat'; return; }
      go(a, pp, TYPES.lurker.run, 1.1);
      if ((s.t += dt) > 2.8) s.k = 'retreat';
      return;
    }
    if (!s.to) { s.to = coverNear(a, pos(a), 16, pp, 7) || { pos: pos(a).clone(), dir: new V3(0, 0, 1) }; a.cd = 4; }   // retreat and re-hide
    a.crouch = false;
    if (go(a, s.to.pos, TYPES.lurker.run * 0.9, 0.4)) { a.spot = s.to; a.home.copy(s.to.pos); a.sub = { k: 'hide' }; a.primed = 0; a.state = 'idle'; a.char.pose(a.rest); }
  }
  // a cover spot near `around`, at least `minFromThreat` from the threat, preferring ones the threat can't see
  function coverNear(a, around, r, threat, minFromThreat = 0) {
    const g = gridOf(a); if (!g) return null;
    let best = null, bs = -1e9;
    for (const cv of g.cover) {
      const d = flat(cv.pos, around); if (d > r || flat(cv.pos, threat) < minFromThreat) continue;
      if (list.some(o => o !== a && o.alive && (o.spot === cv || o.cover === cv))) continue;
      const sc = -d + (los(_a.copy(threat).setY(threat.y + 1.5), _b.copy(cv.pos).setY(cv.pos.y + 0.9)) ? 0 : 6) + a.rng();
      if (sc > bs) { bs = sc; best = cv; }
    }
    return best;
  }
  function clicker(a, dt, pl) {
    const pp = pl.root.position, d = flat(pos(a), pp);
    if ((a.clickT = (a.clickT ?? a.rng()) - dt) <= 0) {
      a.clickT = a.state === 'combat' ? 0.35 + a.rng() * 0.3 : 0.6 + a.rng() * 0.6;
      Audio.sfx('click', { pos: eye(a, _a).clone(), vol: a.state === 'idle' ? 0.85 : 1 });
    }
    if ((d < 0.75 || (d < 1.1 && Play.speed > 0.05)) && canGrab(a)) { halt(a, pp); startGrab(a, 'clicker'); return; }   // bumped into
    if (a.state === 'idle') { wander(a, dt, TYPES.clicker.walk); return; }
    if (a.state === 'suspicious') {
      if (go(a, a.sub.p, 1.15, 0.8)) { a.sub.t = (a.sub.t || 0) + dt; halt(a); if (a.sub.t > 2.5) { a.state = 'idle'; a.home.copy(pos(a)); a.timer = 1; } }
      return;
    }
    if (now() - a.heardT > 4) { a.state = 'suspicious'; a.sub = { k: 'go', p: a.lkp.clone() }; return; }
    if (d < 1.2 && canGrab(a)) { halt(a, pp); startGrab(a, 'clicker'); return; }
    go(a, a.lkp, TYPES.clicker.run, 0.6);
  }
  function bloatware(a, dt, pl) {
    const pp = pl.root.position, d = flat(pos(a), pp);
    a.crackle.setPos(pos(a));
    if (d < 1.5 && canGrab(a)) { halt(a, pp); startGrab(a, 'bloatware'); return; }
    if (a.state === 'idle') { halt(a); if ((a.timer -= dt) <= 0) { a.timer = 5 + a.rng() * 5; a.char.gesture('swipe'); } return; }
    if (a.state === 'suspicious') { if (go(a, a.sub.p, TYPES.bloatware.walk, 1.5)) { a.state = 'idle'; a.timer = 4; } return; }
    if (now() - a.seenT > 12) { a.state = 'suspicious'; a.sub = { k: 'go', p: a.lkp.clone() }; return; }
    if (flat(pos(a), a.lkp) > 7) go(a, a.lkp, TYPES.bloatware.walk, 6); else halt(a, a.lkp);
    if ((a.fireT -= dt) <= 0) {                                   // the whine, the wind-up, the lob
      a.fireT = 5 + a.rng() * 2.5; a.busy = 'throw';
      const target = a.lkp.clone();
      halt(a, target);
      Audio.sfx('battery_whine', { pos: pos(a).clone() });
      a.char.gesture('slam_phone', { dur: 1.6 });
      later(1.25, () => {
        if (a.busy === 'throw') a.busy = null;
        if (!a.alive || a.stunT > 0) return;
        if (Play.char && flat(Play.char.root.position, target) < 4) target.lerp(Play.char.root.position, 0.6);
        lob(a.char.point('hand_r', new V3()), target, 1.05, 'pillow', p => { Audio.sfx('battery_burst', { pos: p }); fire(p, { r: 1.8, dur: 4, by: a }); noise(p, 12, 'distraction'); });
      });
    }
  }

  // ---- humans ------------------------------------------------------------------------------------------------------------------------------
  function human(a, dt, pl) {
    const pp = pl.root.position, d = flat(pos(a), pp);
    if (a.state !== 'combat' && a.state !== 'flee') { perceive(a, dt, pl); if ((a.bodyT = (a.bodyT ?? 0.5) - dt) <= 0) { a.bodyT = 0.5; findBody(a); } }
    if (a.state === 'idle') { routine(a, dt, pl); a.crouch = a.behaviour === 'ambush'; setPose(a, a.rest); return; }
    if (a.state === 'flee') { flee(a, dt, pl, d); return; }
    setPose(a, a.W && !a.W.melee ? 'aim' : a.rest);
    if (a.state === 'suspicious') {
      const s = a.sub; s.t += dt; a.crouch = false;
      if (s.k === 'look') { halt(a, s.p); if (s.t > 1.3) { s.k = 'go'; s.t = 0; } }
      else if (s.k === 'go') { if (go(a, s.p, 1.45, 1.2) || s.t > 18) { s.k = 'scan'; s.t = 0; s.yaw = a.char.yaw; a.char.lookAt(null); } }
      else { halt(a, _e.copy(pos(a)).add(U.fwd(s.yaw + Math.sin(s.t * 1.4) * 1.3, _d))); if (s.t > 5) { a.state = 'idle'; a.det = Math.min(a.det, 0.3); a.sub = null; } }
      return;
    }
    if (a.state === 'search') {
      const s = a.sub; s.t += dt; a.crouch = false;
      if (!s.p || go(a, s.p, 1.6, 1)) { if ((s.wait -= dt) <= 0) { s.wait = 1.5 + a.rng() * 2; const g = gridOf(a); s.p = (g && g.random(a.lkp, 8, a.rng)) || a.lkp.clone(); if (a.rng() < 0.4) bark(a, 'search'); } }
      if (s.t > 24) { a.state = 'idle'; a.sub = null; a.char.lookAt(null); }
      return;
    }
    // combat -----------------------------------------------------------------------------
    if ((a.perT -= dt) <= 0) {
      a.perT = 0.15 + a.rng() * 0.05;
      a.vis = d < 45 && Play.visibility !== 0 && los(eye(a, _a), _b.set(pp.x, pp.y + (Play.crouched ? 0.7 : 1.4), pp.z));
      if (a.vis) { a.lkp.copy(pp); a.seenT = now(); }
    }
    a.char.lookAt(a.vis ? pl : null);
    if (now() - a.seenT > 8) { a.state = 'search'; a.sub = { t: 0, wait: 0, p: a.lkp.clone() }; a.cover = null; a.flank = false; bark(a, 'search'); return; }
    if ((a.barkT = (a.barkT ?? 3) - dt) <= 0) { a.barkT = 4 + a.rng() * 6; bark(a, 'combat'); }
    if ((a.fleeT = (a.fleeT ?? 1) - dt) <= 0) {                                 // badly outnumbered, or hurt and cornered: run (some beg)
      a.fleeT = 1;
      if (outnumbered(a) || (a.hp < a.maxHp * 0.4 && d < 6 && (a.pleads ??= a.rng() < 0.5))) { a.state = 'flee'; a.sub = null; a.cover = null; a.char.pose('stand'); return; }
    }
    if (grabber && grabber !== a) { halt(a, pp); a.crouch = false; return; }
    if (!a.W || a.W.melee) brawl(a, pl, d, a.W || FISTS); else gunfight(a, dt, pl, d);
  }
  // a friend's body in view: the alarm goes round and they sweep the area around it
  function findBody(a) {
    if (a.state === 'search') return;
    const e = eye(a, _a), b = list.find(o => !o.alive && !o.found && o.faction === a.faction && flat(pos(o), e) < 14 &&
      Math.abs(U.wrapAngle(U.yawTo(e, pos(o)) - a.char.yaw)) < 0.87 && los(e, _b.copy(pos(o)).setY(pos(o).y + 0.3)));
    if (!b) return;
    b.found = true;
    for (const o of list) if (o.alive && o.faction === a.faction && o.state !== 'combat' && flat(pos(o), pos(b)) < 25) {
      o.state = 'search'; o.aware = true; o.lkp = pos(b).clone(); o.sub = { t: 0, wait: o === a ? 0 : 1 + o.rng() * 2, p: pos(b).clone() };
    }
    a.char.emote('shocked', 2); bark(a, 'search');
  }
  function setPose(a, name) { if (a.char.poseName !== name) a.char.pose(name, { dur: 0.35 }); }
  function routine(a, dt, pl) {
    const b = a.behaviour;
    if (b === 'patrol' && a.route && a.route.length) {
      const q = a.route[a.ri % a.route.length];
      if (a.timer > 0) { a.timer -= dt; halt(a, _e.copy(pos(a)).add(U.fwd(a.lookYaw + Math.sin(a.timer * 1.5) * 0.8, _d))); return; }   // a look round at each stop
      if (go(a, q, TYPES.human.walk, 0.4)) { a.ri++; a.timer = 1.5 + a.rng() * 2.5; a.lookYaw = a.char.yaw; }
    } else if (b === 'wander') wander(a, dt, TYPES.human.walk * 0.85);
    else if (b === 'hunt') { a.state = 'search'; a.sub = { t: 0, wait: 0, p: pl.root.position.clone() }; a.lkp = a.sub.p.clone(); }
    else if (flat(pos(a), a.home) > 0.6) go(a, a.home, TYPES.human.walk, 0.3);
    else {
      halt(a, _e.copy(pos(a)).add(U.fwd(a.homeYaw + (b === 'guard' ? Math.sin(now() * 0.35 + a.homeYaw) * 0.9 : 0), _d)));
      if (b === 'ambush' && flat(pos(a), pl.root.position) < 7) spotted(a);
    }
  }
  function outnumbered(a) {
    let mine = 0, lost = 0;
    for (const b of list) if (b.faction === a.faction && flat(pos(b), pos(a)) < 40) { if (b.alive && b.state !== 'flee') mine++; else if (!b.alive) lost++; }
    const theirs = 1 + list.filter(b => b.companion).length;
    return lost >= 2 && mine < theirs && (mine === 1 || a.hp < a.maxHp * 0.5);
  }
  function flee(a, dt, pl, d) {
    const s = a.sub || (a.sub = {});
    a.crouch = false;
    if (s.plead) {                                                  // hands up, backing off, begging
      setPose(a, 'hands_up'); halt(a, pl.root.position); a.char.lookAt(pl); a.char.emote(a.faction === 'landline' ? 'crying' : 'afraid');
      if ((s.t += dt) > 1 && d > 9) { s.plead = false; s.to = null; setPose(a, 'stand'); }
      return;
    }
    if (d < 4 && a.hp < a.maxHp && (a.pleads ??= a.rng() < 0.6)) {                     // the gun goes down, the hands go up
      s.plead = true; s.t = 0; bark(a, 'plead');
      if (a.char.held(a.hand)) a.char.drop(a.hand);
      a.W = null;
      return;
    }
    setPose(a, 'stand');
    if (!s.to) {
      const g = gridOf(a); let bd = -1;
      for (let i = 0; i < 10 && g; i++) { const q = g.random(pos(a), 26, a.rng); if (q && flat(q, pl.root.position) > bd) { bd = flat(q, pl.root.position); s.to = q; } }
      s.to = s.to || pos(a).clone();
      a.char.emote('afraid', 3);
    }
    if (go(a, s.to, TYPES.human.run * 1.05, 0.8)) { halt(a, pl.root.position); a.crouch = true; if (d < 10) s.to = null; }
  }
  function brawl(a, pl, d, W) {
    const pp = pl.root.position; a.crouch = false;
    if (d < W.reach && a.cd <= 0) { halt(a, pp); if (canGrab(a) && a.rng() < 0.2) startGrab(a, 'human'); else strike(a, W); return; }
    if (a.flank && flankTo(a, pl)) return;
    go(a, a.vis ? pp : a.lkp, a.vis || d > 6 ? TYPES.human.run : 2.2, W.reach * 0.75);
  }
  function flankTo(a, pl) {
    const pp = pl.root.position;
    if (!a.flankP) {
      const g = gridOf(a), ang = U.yawTo(pp, pos(a)) + (a.rng() < 0.5 ? 1.6 : -1.6);
      a.flankP = g && g.snap(_e.copy(pp).add(U.fwd(ang, _d).multiplyScalar(8)));
      if (!a.flankP) { a.flank = false; return false; }
      bark(a, 'flank');
    }
    if (go(a, a.flankP, TYPES.human.run, 1.5)) { a.flank = false; a.flankP = null; return false; }
    return true;
  }
  function gunfight(a, dt, pl, d) {
    const W = a.W, pp = pl.root.position, s = a.sub || (a.sub = { k: 'move' });
    if (d < 2.2 && a.cd <= 0) { halt(a, pp); strike(a, BUTT); return; }
    if (a.flank && flankTo(a, pl)) { a.crouch = false; return; }
    // cover: pick one (and again when the player gets round it)
    if ((a.coverT = (a.coverT ?? 0) - dt) <= 0) {
      a.coverT = 1.5 + a.rng();
      if (!a.cover || flat(a.cover.pos, pp) < 4 || los(_a.set(pp.x, pp.y + 1.5, pp.z), _b.copy(a.cover.pos).setY(a.cover.pos.y + (a.cover.low ? 0.7 : 1.3)))) { a.cover = pickCover(a, pp, W); if (s.k === 'hold') s.k = 'move'; }
    }
    if (a.reloadT > 0) {
      a.reloadT -= dt; if (a.reloadT <= 0) a.ammo = W.mag;
      if (a.cover && !go(a, a.cover.pos, TYPES.human.run, 0.35)) return;
      halt(a, pp); a.crouch = !!(a.cover && a.cover.low); return;
    }
    if (s.k === 'move') {
      a.crouch = false;
      const tgt = a.cover ? a.cover.pos : d > W.range * 0.8 || !a.vis ? a.lkp : null;
      if (tgt && !go(a, tgt, a.cover ? TYPES.human.run : 2.4, a.cover ? 0.35 : 3)) return;
      halt(a, pp); s.k = 'hold';
      return;
    }
    if (s.k === 'hold') {
      a.crouch = !!(a.cover && a.cover.low); halt(a, a.lkp);
      if (a.cover && flat(pos(a), a.cover.pos) > 1.2) { s.k = 'move'; return; }
      if ((a.fireT -= dt) <= 0) {
        if (shooters() >= 2) a.fireT = 0.3 + a.rng() * 0.6;                        // two guns up at a time: the rest hold and yell
        else { s.n = Math.round(rnd(W.burst, a.rng)); s.t = 0; if (a.cover && !a.cover.low) { s.k = 'peek'; s.to = peekSpot(a, pp); } else s.k = 'aim'; }
      }
      else if (!a.cover && !a.vis && now() - a.seenT > 2.5) s.k = 'move';
      return;
    }
    if (s.k === 'peek') { if (!s.to || go(a, s.to, 2.2, 0.25)) { s.k = 'aim'; s.t = 0; } return; }
    if (s.k === 'aim') {                                                // pop up, aim a beat, fire a short burst
      a.crouch = false; halt(a, pp); s.t += dt;
      if (s.t < (a.first ? 0.6 : 0.35)) return;
      if (!a.vis) { s.k = 'back'; a.fireT = 0.8; return; }
      if ((s.g = (s.g ?? 0) - dt) > 0) return;
      shoot(a, pl); s.g = W.gap; a.first = false;
      if (--s.n <= 0 || a.ammo <= 0) { s.k = 'back'; s.g = 0; a.fireT = rnd(W.cd, a.rng); if (a.ammo <= 0) { a.reloadT = 2.2; Audio.sfx('reload', { pos: pos(a).clone(), vol: 0.7 }); } }
      return;
    }
    if (!a.cover || go(a, a.cover.pos, 2.4, 0.3)) { s.k = 'hold'; assignFlank(a); }       // back into cover
  }
  const shooters = () => list.reduce((n, b) => n + (b.alive && b.sub && (b.sub.k === 'aim' || b.sub.k === 'peek') ? 1 : 0), 0);
  function peekSpot(a, pp) {
    const g = gridOf(a), c = a.cover; if (!g) return null;
    for (const side of [1, -1]) {
      const q = _e.set(-c.dir.z * side, 0, c.dir.x * side).multiplyScalar(0.9).add(c.pos);
      if (g.free(q) && los(_a.copy(q).setY(q.y + 1.5), _b.set(pp.x, pp.y + 1.2, pp.z))) return q.clone();
    }
    return null;
  }
  function pickCover(a, threat, W) {
    const g = gridOf(a); if (!g) return null;
    const ideal = Math.min(W.range * 0.55, 14), te = _a.set(threat.x, threat.y + 1.5, threat.z);
    let best = null, bs = -1e9, tests = 0;
    for (const cv of g.cover) {
      const dSelf = flat(cv.pos, pos(a)), dT = flat(cv.pos, threat);
      if (dSelf > 16 || dT < 5 || dT > W.range * 0.9) continue;
      if ((cv.dir.x * (threat.x - cv.pos.x) + cv.dir.z * (threat.z - cv.pos.z)) / dT < 0.55) continue;     // the blocker faces the threat
      const sc = -dSelf - Math.abs(dT - ideal) * 0.5 + (cv.low ? 1.5 : 0) + a.rng();
      if (sc <= bs || list.some(o => o !== a && o.alive && (o.cover === cv || o.spot === cv))) continue;
      if (++tests > 24) break;
      if (los(te, _b.copy(cv.pos).setY(cv.pos.y + (cv.low ? 0.7 : 1.3)))) continue;
      bs = sc; best = cv;
    }
    return best;
  }
  // one combatant goes round the side while the rest hold
  function assignFlank(a) {
    if (a.flankDone) return;
    a.flankDone = true;
    if (a.rng() < 0.45 && list.some(b => b !== a && b.alive && b.faction === a.faction && b.state === 'combat') && !list.some(b => b.flank && b.alive)) { a.flank = true; a.flankP = null; }
  }
  // hitscan with accuracy falloff; a muzzle flash, a faint tracer, dust where it misses
  function shoot(a, pl) {
    const W = a.W, c = a.char, pp = pl.root.position, d = flat(pos(a), pp);
    a.ammo--;
    c.gesture('fire');
    const muzzle = muzzleOf(c, new V3(), a.hand);
    Audio.sfx(W.sfx, { pos: muzzle.clone() });
    noise(muzzle, W.arrow ? 6 : 40, a);
    flash(muzzle);
    const sp = Play.speed || 0;
    const p = W.acc * U.clamp(1.15 - d / W.range, 0.1, 1) * (sp > 4 ? 0.5 : sp > 1 ? 0.8 : 1) * (a.first ? 0.35 : 1);
    const hit = a.rng() < p, tgt = chest(pl, new V3());
    if (!hit) { tgt.add(U.fwd(U.yawTo(muzzle, tgt) + Math.PI / 2, _d).multiplyScalar((a.rng() - 0.5) * 2.2)); tgt.y += (a.rng() - 0.3) * 1.2; tgt.sub(muzzle).multiplyScalar(3).add(muzzle); }
    if (W.arrow) { arrow(muzzle, tgt, hit ? () => Play.damage(W.dmg, a) : null); return; }
    const t = World.raycast(muzzle, tgt, null), end = muzzle.clone().lerp(tgt, hit ? 1 : t);
    tracer(muzzle, end);
    if (hit) Play.damage(W.dmg, a);
    else if (t < 1) puff(end);
  }
  function muzzleOf(c, out, hand = 'r') { const g = c.held(hand); if (g && g.userData.muzzle) { g.updateWorldMatrix(true, false); return out.set(...g.userData.muzzle).applyMatrix4(g.matrixWorld); } return c.point('hand_' + hand, out); }

  // ---- companions --------------------------------------------------------------------------------------------------------------------------
  function companion(c, o = {}) {
    const old = list.find(a => a.companion && a.char === c);
    const role = o.role || (old ? old.role : c.name);
    const a = old || agent('companion', c, { name: role });
    Object.assign(a, { companion: true, role, follow: o.follow !== false, holding: false, dest: null });
    a.wname = o.weapon || ROLES[role]; a.W = WEAPONS[a.wname] || null;
    if ((a.W || a.wname === 'slingshot') && !c.held('r')) c.hold(a.wname, 'r');
    if (old) return a;
    Object.assign(a, { slot: null, slotT: 0, rescueT: -99, quietT: 0, throwT: 5, fireT: 3, offerT: 40, calloutT: 0, idleT: 0, actT: 4, supplyT: 150 + a.rng() * 90, stillT: 0, farT: 0, sitting: false });
    a.say = (line, opts = {}) => Dialogue.say(role, line, Object.assign({ char: c }, opts));
    a.goTo = pt => { a.dest = Game.G.marker(pt).pos.clone(); a.holding = false; };
    a.hold = on => { a.holding = !!on; if (on) { a.dest = null; halt(a); } };
    a.dismiss = () => { const i = list.indexOf(a); if (i >= 0) list.splice(i, 1); halt(a); c.setMove(0); };
    list.push(a);
    return a;
  }
  function companionThink(a, dt, pl, enemies) {
    const c = a.char, cp = pos(a), pp = pl.root.position, d = flat(cp, pp);
    a.quietT -= dt; a.crouch = false;
    // rescue: the box cutter (or whatever they carry) into whatever is holding Chase
    const g = grabber;
    if (g && g.alive && g.grabbing !== 'clicker' && g.grabbing !== 'bloatware' && now() - a.rescueT > 60 && flat(cp, pos(g)) < 14) {
      standUp(a);
      if (!a.rescuing) { a.rescuing = g; if (a.role === 'chloe') { const l = CONTENT.barks.chloe.rescue[0]; Dialogue.say('chloe', l.text, { emote: l.emote, char: c }); } }
      if (!a.busy && go(a, pos(g), 5.6, 1.0)) {
        a.busy = 'rescue'; halt(a, pos(g));
        const cutter = a.role === 'chloe', hand = cutter && c.held('r') ? 'l' : 'r';
        if (cutter) c.hold('box_cutter', hand);
        c.gesture(a.W && a.W.melee ? 'swing' : 'punch', { hand });
        later(0.3, () => {
          a.busy = null; a.rescuing = null; a.rescueT = now();
          Audio.sfx(cutter ? 'stab' : 'punch', { pos: pos(g).clone() });
          g.damage(99, { type: 'stab', from: pos(a).clone(), by: a });
        });
        if (cutter) later(1.2, () => c.drop(hand, { remove: true }));
      }
      return;
    }
    a.rescuing = null;
    if (a.busy) return;
    if (a.dest) { if (go(a, a.dest, 3, 0.4)) { a.dest = null; a.holding = true; } return; }
    if (a.holding || !a.follow) { halt(a); return; }
    const combat = enemies.some(e => e.state === 'combat' && flat(pos(e), pp) < 35);
    const stealth = !combat && enemies.some(e => flat(pos(e), pp) < 25);
    // left far behind and nobody can see: appear somewhere close and hidden
    if (d > 25 && !onScreen(cp)) { const q = hiddenSpot(pl); if (q) { cp.copy(q); c.yaw = U.yawTo(cp, pp); halt(a); a.slot = null; return; } }
    a.farT = d > 12 ? a.farT + dt : 0;
    if (a.farT > 4) { a.farT = 0; chaseBark('follow'); }
    if (combat && companionCombat(a, dt, pl, enemies)) return;
    if (a.busy) return;
    if (stealth && a.role === 'chloe') {
      if (enemies.some(e => e.type === 'clicker' && flat(pos(e), cp) < 7)) Dialogue.bark('chloe', 'clicker', { char: c });
      else if (a.rng() < dt / 25) Dialogue.bark('chloe', enemies.some(e => e.type !== 'human' && flat(pos(e), pp) < 25) ? 'stealthInfected' : 'stealth', { char: c });
    }
    const mode = combat ? 'combat' : stealth ? 'stealth' : 'calm';
    a.calmT = mode === 'calm' ? (a.calmT || 0) + dt : 0;
    if (mode === 'calm' && a.visit) { standUp(a); visit(a, pl); return; }
    if (mode === 'calm' && a.stroll && (Play.speed || 0) < 0.3) { if (go(a, a.stroll, 1.1, 0.3)) a.stroll = null; return; }
    a.stroll = null;
    a.crouch = mode === 'stealth' || (mode === 'combat' && !!Play.crouched);
    if (mode === 'stealth' && d < 6 && (Play.speed || 0) < 0.3 && enemies.some(e => e.state !== 'combat' && flat(pos(e), cp) < 9)) { halt(a); standUp(a); return; }   // hold still
    if ((a.slotT -= dt) <= 0) {
      a.slotT = 0.4;
      if (!a.goal && slotOk(a, cp, pl, mode)) a.slot = null;
      else if (!a.slot || !slotOk(a, a.slot, pl, mode)) a.slot = pickSlot(a, pl, mode);
    }
    if (a.slot) {
      standUp(a);
      const far = flat(cp, a.slot), ps = Play.speed || 0;
      const spd = mode === 'stealth' ? (far > 4 ? 2.4 : 1.5) : far > 7 || ps > 4 ? 5.2 : far > 3 || ps > 2 ? 3.1 : 1.5;
      if (go(a, a.slot, spd, 0.35)) a.slot = null;
      a.stillT = 0;
    } else {
      halt(a, mode === 'combat' && enemies[0] ? pos(enemies[0]) : null);
      if (mode === 'calm') idleLife(a, dt, pl); else standUp(a);
    }
  }
  function slotOk(a, p, pl, mode) {
    const pp = pl.root.position, d = flat(p, pp), [lo, hi] = mode === 'stealth' ? [1.4, 4] : mode === 'combat' ? [2.2, 7] : [2, 5.5];
    if (d < lo || d > hi) return false;
    const g = gridOf(a);
    if (g && (!g.free(p) || g.narrow(p) || !g.clear(pp, p))) return false;
    if ((mode === 'combat' || Play.aiming) && Math.abs(U.wrapAngle(U.yawTo(pp, p) - camYaw())) < 0.65) return false;   // line of fire
    const cam = Engine.camera.position, cx = pp.x - cam.x, cz = pp.z - cam.z, t = Math.max(0, ((p.x - cam.x) * cx + (p.z - cam.z) * cz) / (cx * cx + cz * cz || 1));
    if (Math.hypot(cam.x + cx * t - p.x, cam.z + cz * t - p.z) < 0.9) return false;                   // on the camera's ray through the player
    return !list.some(o => o !== a && o.companion && flat(o.slot || pos(o), p) < 1.3);
  }
  const SLOTS = [2.5, -2.5, 3.14, 2, -2, 1.5, -1.5];
  function pickSlot(a, pl, mode) {
    const pp = pl.root.position, base = Play.speed > 0.5 ? pl.yaw : camYaw(), r0 = mode === 'stealth' ? 2.3 : mode === 'combat' ? 4 : 3.4;
    const g = gridOf(a), cov = mode === 'stealth' && g ? g.cover : null;
    let best = null, bs = -1e9;
    for (const ang of SLOTS) for (const r of [r0, r0 + 1, r0 - 0.7]) {
      const q = _e.copy(pp).add(U.fwd(base + ang, _d).multiplyScalar(r)), s = g ? g.snap(q, new V3()) : q.clone();
      if (!s || !slotOk(a, s, pl, mode)) continue;
      let sc = -flat(s, pos(a)) * 0.6 - Math.abs(Math.abs(ang) - 2.5) * 1.5;
      if (cov && cov.some(cv => flat(cv.pos, s) < 0.9)) sc += 2.5;
      if (sc > bs) { bs = sc; best = s; }
    }
    return best || (flat(pos(a), pp) > 5 ? pp.clone() : null);
  }
  function hiddenSpot(pl) {
    const g = AINav.get(Game.area), pp = pl.root.position, away = U.yawTo(Engine.camera.position, pp) + Math.PI;
    for (const r of [4.5, 6, 3.5]) for (const k of [0, 0.5, -0.5, 1, -1]) {
      const q = _e.copy(pp).add(U.fwd(away + k, _d).multiplyScalar(r)), s = g ? g.snap(q, new V3()) : q.clone();
      if (s && (!g || g.clear(pp, s)) && !onScreen(s)) return s;
    }
    return null;
  }
  function standUp(a) { if (a.sitting) { a.sitting = false; a.char.pose('stand'); } }
  // idle life: look around, point things out, sit when the player lingers, hand over what she found
  function idleLife(a, dt, pl) {
    const c = a.char, pp = pl.root.position;
    if ((a.stillT += dt) < 2) return;
    if (Play.speed > 0.3) { a.idleT = 0; standUp(a); } else a.idleT += dt;
    if (!a.sitting && a.idleT > 22 && a.role === 'chloe' && !Dialogue.busy && !(a.jumpyT > now())) { a.sitting = true; c.lookAt(null); c.pose('sit_ground'); }
    if ((a.actT -= dt) <= 0) {
      const jumpy = a.jumpyT > now();
      a.actT = jumpy ? 1.2 + a.rng() * 1.5 : 4 + a.rng() * 6;
      const r = jumpy ? 0 : !a.sitting && !onScreen(pos(a)) ? 0.8 : a.rng();       // jumpy: keeps looking round; out of sight: comes into view
      if (r < 0.4) { const t = pos(a).clone().add(U.fwd(c.yaw + (a.rng() - 0.5) * 2.6, _d).multiplyScalar(5)); t.y += 1.2 + (a.rng() - 0.6); c.lookAt(t); }
      else if (r < 0.6) c.lookAt(pl);
      else if (r < 0.72 && !a.sitting) c.gesture('point', { to: pos(a).clone().add(U.fwd(c.yaw + (a.rng() - 0.5), _d).multiplyScalar(2.5)) });
      else if (r < 0.9 && !a.sitting && a.idleT > 4) a.stroll = strollSpot(a, pl);
      else c.lookAt(null);
    }
    if (a.role === 'chloe' && (a.supplyT -= dt) <= 0 && flat(pos(a), pp) < 6 && !Dialogue.busy) {
      a.supplyT = 180 + a.rng() * 120; standUp(a);
      handOver(a, pl, 'supplies', 'bars');
    }
  }
  function handOver(a, pl, cat, item) {
    const c = a.char; a.busy = 'give';
    c.turnTo(pl, 0.4); c.gesture('hand_over', { to: pl });
    Dialogue.bark('chloe', cat, { char: c });
    later(1.1, () => { a.busy = null; Play.give(item, 1); Audio.sfx('pickup', { pos: pl.root.position.clone(), vol: 0.6 }); });
  }
  // remark tags: a line → she walks over to it, looks, says it; no line → a look and a quiet spell, and she keeps walking
  function remarkCheck(a, pl, enemies) {
    if (a.visit || a.quietT > 0 || Dialogue.busy || enemies.some(e => flat(pos(e), pl.root.position) < 30)) return;
    const pull = a.calmT > 100;                                                // nothing said for a while: she goes looking
    for (const r of remarks) {
      if (r.done || r.who !== a.role || (r.cond && !r.cond())) continue;
      if (pull ? flat(pl.root.position, r.pos) > 12 : flat(pl.root.position, r.pos) > r.r + 3 || flat(pos(a), r.pos) > r.r + 8) continue;
      r.done = true; a.calmT = 0;
      if (r.text) { a.visit = r; return; }
      a.char.lookAt(r.pos.clone().setY(r.pos.y + 0.6)); a.char.emote(r.emote || 'sad', 4); a.quietT = 20; a.actT = 6;
      later(2.5, () => a.char.lookAt(null));
      return;
    }
  }
  function visit(a, pl) {
    const r = a.visit, c = a.char, t = _e.copy(r.pos).setY(r.pos.y + 0.6);
    if (flat(pos(a), pl.root.position) > 12) { a.visit = null; return; }
    if (r.talking) { halt(a, r.pos); return; }
    if (!go(a, r.pos, 1.4, Math.min(r.r, 1.5))) return;
    r.talking = true; halt(a, r.pos); c.lookAt(t.clone()); a.actT = 6; a.stillT = 0;
    if (a.rng() < 0.5) c.gesture('point', { to: t.clone() });
    Dialogue.say(a.role, r.text, { emote: r.emote, char: c }).then(() => { c.lookAt(null); a.visit = null; });
  }
  // a few steps to somewhere in view while Chase stands about
  function strollSpot(a, pl) {
    const g = gridOf(a), pp = pl.root.position;
    for (let i = 0; i < 8; i++) {
      const q = _e.copy(pp).add(U.fwd(camYaw() + (a.rng() - 0.5) * 2.2, _d).multiplyScalar(2.5 + a.rng() * 2.5)), s = g ? g.snap(q, new V3()) : q.clone();
      if (s && slotOk(a, s, pl, 'calm') && onScreen(s)) return s;
    }
    return null;
  }
  // in a fight: callouts, thrown bricks and bottles, their own weapon; returns true while it engages up close
  function companionCombat(a, dt, pl, enemies) {
    const c = a.char, cp = pos(a), pp = pl.root.position, W = a.W;
    const live = enemies.filter(e => e.state === 'combat' && flat(pos(e), pp) < 30);
    if (a.role === 'chloe' && (a.calloutT -= dt) <= 0) {
      a.calloutT = 0.6;
      for (const e of live) {
        const d = flat(pos(e), pp);
        if (e.type === 'clicker' && d < 14) { Dialogue.bark('chloe', 'clicker', { char: c }); break; }
        const side = relDir(pos(e)), near = d < 11 && (e.v > 1 || e.type === 'human');                   // she only calls "left" and "behind"
        if (near && Math.abs(side) > 2.3) { Dialogue.bark('chloe', 'behind', { char: c }); break; }
        if (near && side < -0.5 && !onScreen(pos(e))) { Dialogue.bark('chloe', 'callout', { char: c }); break; }
        if (d < 5 && flat(pos(e), cp) < 4 && Math.abs(U.wrapAngle(U.yawTo(cp, pos(e)) - c.yaw)) > 2) { chaseBark('behind'); break; }
      }
      if (a.role === 'chloe' && (a.offerT -= 0.6) <= 0 && flat(cp, pp) < 4) { a.offerT = 70 + a.rng() * 50; handOver(a, pl, 'offer', 'bottle'); return false; }
    }
    const tgts = live.filter(e => e.type !== 'bloatware' && flat(pos(e), cp) < 16 && los(eye(a, _a), chest(e.char, _b)));
    tgts.sort((x, y) => flat(pos(x), pp) - flat(pos(y), pp));
    const t = tgts[0];
    if (!t) return false;
    if ((a.role === 'chloe' || a.wname === 'slingshot') && (a.throwT -= dt) <= 0 && t.stunT <= 0 && t.type !== 'clicker') { a.throwT = 7 + a.rng() * 6; throwAt(a, t); return false; }
    if (W && !W.melee) {
      if ((a.fireT -= dt) <= 0) {
        const bad = a.role === 'chloe';
        a.fireT = bad ? 6 + a.rng() * 5 : rnd(W.cd, a.rng);
        halt(a, pos(t)); c.gesture('fire');
        const m = muzzleOf(c, new V3()), tg = chest(t.char, new V3());
        Audio.sfx(W.sfx, { pos: m.clone() }); flash(m); noise(m, 40, 'gunshot');
        if (a.rng() < (bad ? 0.3 : 0.65)) { tracer(m, tg); t.damage(W.hit, { type: 'bullet', part: a.rng() < 0.15 ? 'head' : 'body', from: cp.clone(), by: a }); }
        else { tg.y += 0.8 + a.rng(); tracer(m, tg); }
      }
      return false;
    }
    if (W && W.melee && flat(pos(t), pp) < 9) {                          // Wai and his bat
      if (go(a, pos(t), 5, W.reach * 0.8) && a.cd <= 0) {
        a.cd = rnd(W.cd, a.rng); c.gesture('swing'); halt(a, pos(t));
        later(W.wind, () => { if (t.alive && flat(pos(t), pos(a)) < W.reach + 0.5) { Audio.sfx('punch', { pos: pos(t).clone() }); t.damage(W.hit, { type: 'melee', weapon: a.wname, from: pos(a).clone(), by: a }); } });
      }
      return true;
    }
    return false;
  }
  function throwAt(a, t) {
    const c = a.char, what = a.wname === 'slingshot' ? null : a.rng() < 0.5 ? 'brick' : 'bottle', hand = what && c.held('r') ? 'l' : 'r';
    a.busy = 'throw'; halt(a, pos(t)); c.turnTo(t.char, 0.25);
    if (what) c.hold(what, hand);
    c.gesture(what ? 'swing' : 'fire', { hand });
    later(what ? 0.35 : 0.2, () => {
      a.busy = null;
      if (what) c.drop(hand, { remove: true });
      if (!t.alive) return;
      Audio.sfx('swing', { pos: pos(a).clone(), vol: 0.4 });
      lob(c.point('hand_' + hand, new V3()), chest(t.char, new V3()), 0.5, what || 'stone', p => {
        Audio.sfx(what === 'bottle' ? 'bottle_break' : 'brick_hit', { pos: p });
        if (t.alive && flat(pos(t), p) < 1.2) { t.stun(2.6); t.damage(0.5, { type: 'melee', weapon: what || 'stone', from: pos(a).clone(), by: a }); }
        noise(p, 8, 'distraction');
      });
    });
  }

  // ---- crowds (cheap extras) ---------------------------------------------------------------------------------------------------------------------
  function crowdSetup(a) {
    const c = a.char;
    if (a.behaviour === 'phone_idle') { if (!c.held('r')) c.hold('phone', 'r'); c.pose('phone'); c.phoneGlow(true); }
    else c.pose('stand');
    if (a.behaviour === 'queue') a.face = a.home.clone().add(U.fwd(a.homeYaw, _d).multiplyScalar(5));
  }
  function crowd(a, dt) {
    const c = a.char;
    a.timer -= dt;
    if (a.behaviour === 'phone_idle') { if (a.timer <= 0) { a.timer = 3 + a.rng() * 6; c.gesture('swipe'); } }
    else if (a.behaviour === 'queue' && a.timer <= 0) {
      a.timer = 6 + a.rng() * 10;
      const r = a.rng();
      if (r < 0.3) { a.goal = a.home.clone().add(U.fwd(a.homeYaw, _d).multiplyScalar(a.rng() * 0.5)); a.path = [a.goal.clone()]; a.pi = 0; a.spd = 0.7; a.stop = 0.1; }   // a shuffle
      else if (r < 0.7) c.lookAt(pos(a).clone().add(U.fwd(c.yaw + (a.rng() - 0.5) * 3, _d).multiplyScalar(4)).setY(pos(a).y + 1.5));
      else c.lookAt(null);
    } else if (a.behaviour === 'wander' && !a.goal && a.timer <= 0) {
      a.timer = 2 + a.rng() * 5;
      const ang = a.rng() * TAU, r = a.rng() * a.radius;
      a.goal = new V3(a.home.x + Math.cos(ang) * r, a.home.y, a.home.z + Math.sin(ang) * r); a.path = [a.goal.clone()]; a.pi = 0;
      a.spd = TYPES.crowd.walk * (0.85 + a.rng() * 0.3); a.stop = 0.4;
    }
    drive(a, dt);
  }

  // ---- takedowns -------------------------------------------------------------------------------------------------------------------------------
  function takedownTarget(p, yaw) {
    let best = null, bd = 1.3;
    const f = U.fwd(yaw, _d);
    for (const a of list) {
      if (!enemy(a) || a.type === 'bloatware' || a.busy) continue;
      const q = pos(a), d = flat(p, q);
      if (d > bd || d < 1e-3) continue;
      const dx = (q.x - p.x) / d, dz = (q.z - p.z) / d;
      if (f.x * dx + f.z * dz < 0.4) continue;                                       // the player faces it…
      const af = U.fwd(a.char.yaw, _e), behind = af.x * dx + af.z * dz > 0.35;       // …and it faces away
      if (a.stunned <= now() && (!behind || a.state === 'combat')) continue;
      best = a; bd = d;
    }
    return best;
  }
  function takedown(a, kind) {
    const pl = Play.char, c = a.char;
    if (!a.alive || !pl) return Promise.resolve();
    a.busy = 'takedown'; a.goal = null; a.path = null; a.v = 0;
    c.stop(); c.gesture(null); c.setMove(0);
    const pp = pl.root.position, yaw = U.yawTo(pp, pos(a)), f = U.fwd(yaw, _d);
    pl.yaw = yaw; c.yaw = yaw;
    pos(a).set(pp.x + f.x * 0.42, pos(a).y, pp.z + f.z * 0.42);
    const choke = kind === 'choke', dur = choke ? 2.6 : kind === 'shiv' ? 1.1 : 0.9;
    c.gesture('struggle', { dur });
    if (a.type === 'human') c.emote('afraid', dur);
    if (choke) { Audio.sfx('gasp', { pos: pos(a).clone(), vol: 0.5 }); later(0.9, () => c.setMove(0, { crouch: true })); }
    return new Promise(res => later(dur, () => { a.busy = null; die(a, { type: kind, silent: true, from: pp.clone() }); res(); }));
  }

  // ---- hit volumes: a head sphere and a stack of body spheres per character --------------------------------------------------------------------
  function hitTest(o, dir, maxDist) {
    const D = _c.copy(dir).normalize();
    const ray = (cx, r) => {
      const ox = cx.x - o.x, oy = cx.y - o.y, oz = cx.z - o.z, b = ox * D.x + oy * D.y + oz * D.z, h = r * r - (ox * ox + oy * oy + oz * oz - b * b);
      if (h < 0) return -1;
      const s = Math.sqrt(h); return b - s >= 0 ? b - s : b + s >= 0 ? 0 : -1;
    };
    let best = null, bt = maxDist;
    for (const a of list) {
      if (!enemy(a)) continue;
      const c = a.char, root = c.root.position, k = a.T.big ? 1.6 : 1;
      if (ray(_b.copy(root).setY(root.y + c.height * 0.5), c.height * 0.65 * k) < 0) continue;
      const head = c.point('head', new V3()), ch = c.point('chest', new V3()), hips = c.point('hips', new V3());
      const parts = [[head, 0.13 * k, 'head'], [ch, 0.23 * k], [_d.lerpVectors(hips, ch, 0.5).clone(), 0.23 * k], [hips, 0.21 * k],
        [_e.copy(root).lerp(hips, 0.55).clone(), 0.17 * k], [root.clone().setY(root.y + 0.2), 0.15 * k]];
      for (const [cx, r, part] of parts) {
        const t = ray(cx, r);
        if (t >= 0 && t < bt) { bt = t; best = { agent: a, part: part || 'body', point: o.clone().addScaledVector(D, t), dist: t }; }
      }
    }
    if (best && World.raycast(o, best.point, null) < 0.999) return null;
    return best;
  }

  // ---- effects: timers, lobbed objects, fire pools, tracers, flashes -------------------------------------------------------------------------
  function later(sec, fn) { fx.push({ dur: sec, fn }); }
  function root() { if (!fxRoot) { fxRoot = new THREE.Group(); fxRoot.name = 'ai-fx'; } if (!fxRoot.parent) Engine.scene.add(fxRoot); return fxRoot; }
  function dispose(o) {
    if (o.parent) o.parent.remove(o);
    if (!o.userData.keep) o.traverse(m => { if (m.geometry && !m.isSprite && !m.geometry.userData.shared) m.geometry.dispose(); if (m.material && !m.material.userData.shared) m.material.dispose(); });
  }
  const cached = {};
  const once = (k, f) => cached[k] || (cached[k] = f());
  const shared = x => { x.userData.shared = true; return x; };
  const glowTex = () => once('glowTex', () => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.4)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return shared(new THREE.CanvasTexture(cv));
  });
  // a five-point star with a hot core: the muzzle flash
  const flashTex = () => once('flashTex', () => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 30);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.translate(32, 32);
    for (let i = 0; i < 5; i++) { g.rotate(TAU / 5); g.beginPath(); g.moveTo(-4, 0); g.lineTo(0, -30); g.lineTo(4, 0); g.fill(); }
    g.beginPath(); g.arc(0, 0, 9, 0, TAU); g.fill();
    return shared(new THREE.CanvasTexture(cv));
  });
  const sprite = (k, color, o = {}) => new THREE.Sprite(once('sm' + k, () => shared(new THREE.SpriteMaterial(Object.assign({ color, map: glowTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }, o)))));
  function thing(kind) {
    if (kind === 'pillow') {
      const m = new THREE.Mesh(once('gPillow', () => shared(new RoundedBoxGeometry(0.2, 0.08, 0.28, 2, 0.035))), once('mPillow', () => shared(new THREE.MeshStandardMaterial({ color: 0x3a3a3e, emissive: 0xff5a18, emissiveIntensity: 1.6, roughness: 0.5 }))));
      const s = sprite('pillow', 0xff7a30, { opacity: 0.8 }); s.scale.setScalar(0.7); m.add(s);
      return m;
    }
    if (kind === 'arrow') return new THREE.Mesh(once('gArrow', () => shared(new THREE.CylinderGeometry(0.006, 0.006, 0.75, 4).rotateX(Math.PI / 2))), once('mArrow', () => shared(new THREE.MeshStandardMaterial({ color: 0x6a5a40, roughness: 0.8 }))));
    if (kind === 'stone') return new THREE.Mesh(once('gStone', () => shared(new THREE.IcosahedronGeometry(0.03, 0))), once('mStone', () => shared(new THREE.MeshStandardMaterial({ color: 0x6a665e, roughness: 0.9 }))));
    const p = Chars.props[kind](); p.userData.keep = true;
    return p;
  }
  // an object thrown in an arc; onLand(point) where it comes down (or where it hits a wall)
  function lob(from, to, dur, kind, onLand) {
    const m = thing(kind), a = from.clone(), b = to.clone(), h = Math.max(0.5, a.distanceTo(b) * 0.18), prev = a.clone();
    root().add(m); m.position.copy(a);
    fx.push({ dur, obj: m, step(k, dt) {
      prev.copy(m.position);
      m.position.lerpVectors(a, b, k); m.position.y += 4 * h * k * (1 - k);
      m.rotation.x += dt * 9; m.rotation.z += dt * 5;
      if (k > 0.2 && k < 1 && World.raycast(prev, m.position, null) < 1) this.age = this.dur;
    }, end() { dispose(m); onLand(m.position.clone()); } });
  }
  function arrow(from, to, onHit) {
    const m = thing('arrow'), far = to.clone().sub(from).multiplyScalar(onHit ? 1 : 1.6).add(from);
    root().add(m); m.position.copy(from); m.lookAt(to);
    const t = onHit ? 1 : World.raycast(from, far, null), end = from.clone().lerp(far, t);
    fx.push({ dur: from.distanceTo(end) / 32, obj: m, step(k) { m.position.lerpVectors(from, end, k); }, end() {
      Audio.sfx('arrow_hit', { pos: end.clone(), vol: 0.6 });
      if (onHit) { dispose(m); onHit(); } else fx.push({ dur: 20, obj: m, end() { dispose(m); } });
    } });
  }
  function tracer(a, b) {
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), once('mTracer', () => shared(new THREE.LineBasicMaterial({ color: 0xffe0a0, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }))));
    root().add(l);
    fx.push({ dur: 0.06, obj: l, end() { dispose(l); } });
  }
  function flash(p) {
    const s = sprite('flash', 0xffe0a0, { map: flashTex() }); s.position.copy(p); root().add(s);
    fx.push({ dur: 0.07, obj: s, step(k) { s.scale.setScalar(0.75 * (1 - k) + 0.2); }, end() { dispose(s); } });
  }
  function puff(p) {
    const s = sprite('puff', 0x8a8274, { blending: THREE.NormalBlending, opacity: 0.45 }); s.position.copy(p); root().add(s);
    fx.push({ dur: 0.5, obj: s, step(k) { s.scale.setScalar(0.15 + k * 0.5); s.position.y += 0.004; }, end() { dispose(s); } });
  }
  function fire(p, o = {}) {
    const r = o.r ?? 1.8, g = new THREE.Group(), c = U.v3(p).clone();
    g.position.copy(c); root().add(g);
    const f = Build.fire({ pos: [0, 0, 0], size: r * 0.55, light: false, smoke: false, parent: g });
    Build.pool({ pos: [0, 0, 0], r: r * 1.4, color: 0xff6a20, opacity: 0.55, parent: g });
    Audio.sfx('fire_whoosh', { pos: c.clone(), vol: 0.8 });
    const snd = Audio.loop('fire', { pos: c.clone(), vol: 0.5 });
    fx.push({ dur: o.dur ?? 4, obj: g, step(k, dt) {
      f.scale.setScalar(k < 0.1 ? 0.4 + k * 6 : k > 0.85 ? (1 - k) / 0.15 : 1);
      const pl = Play.char;
      if (pl && flat(pl.root.position, c) < r && Math.abs(pl.root.position.y - c.y) < 1.5) Play.damage(22 * dt, 'fire');
      for (const a of list) if (a !== o.by && enemy(a) && flat(pos(a), c) < r) a.damage(1.2 * dt, { type: 'fire', from: c, by: o.by });
    }, end() { snd.stop(0.6); dispose(g); } });
  }
  function updateFx(dt) {
    for (let i = fx.length - 1; i >= 0; i--) {
      const e = fx[i];
      e.age = (e.age || 0) + dt;
      if (e.step) e.step(Math.min(1, e.age / e.dur), dt);
      if (e.age >= e.dur) { fx.splice(i, 1); if (e.fn) e.fn(); else if (e.end) e.end(); }
    }
  }

  // ---- the frame --------------------------------------------------------------------------------------------------------------------------------------
  function update(dt) {
    detectors.length = 0;
    updateFx(dt);
    for (let i = list.length - 1; i >= 0; i--) if (!list[i].char.root.parent) list.splice(i, 1);   // characters disposed elsewhere
    if (list.length && Game.area) AINav.get(Game.area);                      // the grid is built on the first frame an area has agents
    const pl = Play.char, scene = Director.active || Play.busy === 'death';
    const ref = pl ? pl.root.position : Engine.camera.position;
    // the closest CONFIG.maxActiveAI agents within CONFIG.aiFreezeDist think; crowd extras (cheap) all move; the rest hold still
    const near = list.filter(a => a.alive && !a.companion && flat(pos(a), ref) < CONFIG.aiFreezeDist);
    const act = near.filter(a => a.type !== 'crowd').sort((x, y) => flat(pos(x), ref) - flat(pos(y), ref)).slice(0, CONFIG.maxActiveAI).concat(near.filter(a => a.type === 'crowd'));
    const on = new Set(act);
    for (const n of noises) for (const a of act) if (enemy(a) && !a.busy) hear(a, n);
    noises.length = 0;
    const enemies = act.filter(enemy);
    let lvl = 0;
    for (const a of list) {
      const c = a.char;
      if (!a.alive || c.mv || c.pair || c.pairOf || a.behaviour === 'scripted') continue;
      a.cd -= dt;
      if (a.companion) {
        if (scene || !pl || pl === c) continue;
        companionThink(a, dt, pl, enemies);
        if (!a.busy) remarkCheck(a, pl, enemies);
        drive(a, dt);
        continue;
      }
      if (!on.has(a)) { if (a.v > 0) { a.v = 0; halt(a); c.setMove(0); } continue; }
      if (a.type === 'crowd') { crowd(a, dt); continue; }
      posture(a, dt);
      if (a.busy === 'grab') { holdGrab(a); continue; }
      if (a.busy === 'takedown') continue;
      if (scene || !pl) { halt(a); drive(a, dt); continue; }
      if (a.stunT > 0 || a.busy) { a.stunT -= dt; halt(a, a.busy ? pl.root.position : null); a.crouch = false; drive(a, dt); continue; }
      if (a.type === 'scroller') scroller(a, dt, pl);
      else if (a.type === 'lurker') lurker(a, dt, pl);
      else if (a.type === 'clicker') clicker(a, dt, pl);
      else if (a.type === 'bloatware') bloatware(a, dt, pl);
      else human(a, dt, pl);
      drive(a, dt);
      const d = flat(pos(a), ref);
      lvl = Math.max(lvl, a.state === 'combat' ? (d < 30 ? 1 : 0.7) : a.state === 'search' ? 0.55 : a.state === 'suspicious' ? 0.4 : a.det * 0.5, a.type === 'clicker' && d < 12 ? 0.25 : 0);
      if (a.spotT > now() - 0.8) detectors.push({ dir: relDir(pos(a)), amount: 1 });
    }
    alertLevel = U.damp(alertLevel, lvl, lvl > alertLevel ? 3 : 0.35, dt);
    // Chase: "Stay low." going into stealth, "Chloe, you good?" when a fight is over
    const fighting = enemies.some(e => e.state === 'combat');
    if (!stealthOn && !fighting && Play.crouched && enemies.some(e => flat(pos(e), ref) < 18)) { stealthOn = true; later(0.8, () => chaseBark('stealth')); }
    if (!enemies.some(e => flat(pos(e), ref) < 30)) stealthOn = false;
    if (fighting) { fightT = now(); combatWas = true; }
    else if (combatWas && now() - fightT > 3) {                                   // after a fight: Chase checks on her; she stays jumpy
      combatWas = false;
      for (const a of list) if (a.companion && a.role === 'chloe') { chaseBark('check'); a.jumpyT = now() + 25; a.char.emote('tense', 12); }
    }
  }

  function drop(a) { if (a.crackle) a.crackle.stop(0.2); if (a.ownChar && !a.char.persistent) a.char.dispose(); }
  function clear() {
    for (let i = list.length - 1; i >= 0; i--) if (!list[i].companion) { drop(list[i]); list.splice(i, 1); }
    for (const e of fx) if (e.obj) dispose(e.obj);
    fx.length = 0; noises.length = 0; detectors.length = 0; grabber = null; alertLevel = 0;
  }
  function unloadArea(A) {
    for (let i = list.length - 1; i >= 0; i--) if (list[i].area === A.id && !list[i].companion) { drop(list[i]); list.splice(i, 1); }
    for (let i = remarks.length - 1; i >= 0; i--) if (remarks[i].area === A.id) remarks.splice(i, 1);
    for (const [k, r] of routes) if (r.area === A.id) routes.delete(k);
    AINav.drop(A.id);
  }
  function extendArea(A) {
    const o = A.origin;
    A.patrol = (name, points) => { routes.set(name, { area: A.id, pts: points.map(p => A.w(p)) }); };
    A.cover = points => { A.coverPts = (A.coverPts || []).concat(points.map(p => A.w(p))); };
    A.navBounds = (x1, z1, x2, z2) => { A.navBox = [Math.min(x1, x2) + o.x, Math.min(z1, z2) + o.z, Math.max(x1, x2) + o.x, Math.max(z1, z2) + o.z]; };
    A.remark = r => { const R = r.id ? CONTENT.remarks[r.id] : {}; remarks.push({ area: A.id, pos: A.w(r.at), r: r.r ?? 4, text: r.text !== undefined ? r.text : R.text, emote: r.emote || R.emote, who: r.who || 'chloe', cond: r.cond, done: false }); };
  }

  return {
    list, spawn, companion, noise, hitTest, takedownTarget, update, clear, unloadArea, extendArea, fire,
    listenTargets: (p, r) => list.filter(a => enemy(a) && flat(pos(a), p) < r && (a.type === 'scroller' || a.type === 'clicker' || a.type === 'bloatware' || a.v > 0.3 || a.state === 'combat')),
    byName: n => (list.find(a => a.name === n || a.char.name === n) || {}).char || null,
    nav: { path: (from, to) => { const g = AINav.get(Game.area); return g ? g.path(U.v3(from), U.v3(to)) : null; } },
    get detectors() { return detectors; }, get alertLevel() { return alertLevel; }, get grabber() { return grabber; },
  };
})();
