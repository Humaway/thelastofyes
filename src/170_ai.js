// ============================================================================
// AI — infected (Scroller, Lurker, Clicker, Bloatware), humans (factions), companions,
// crowds, perception (sight cones, noise, darkness), navigation grid. Owned by: systems (AI) agent.
// THIS IS A STUB: keep every API below, replace the implementation. Spec §5 (companion AI), §6 (stealth,
// infected, humans), §17 (barks).
//
// CONTRACT
//   AI.spawn(type, at {pos, yaw}, opts) -> agent   types: scroller lurker clicker bloatware human crowd
//        opts: { name, char (existing Character to drive), behaviour: 'idle'|'wander'|'patrol'|'hunt'|'ambush'|'scripted'|
//                'phone_idle'|'queue'|'guard', route:[points], faction ('comms'|'smuggler'|'doorknocker'|'retreat'|'bandit'|'landline'),
//                weapon ('rifle'|'pistol'|'pipe'|'machete'|'axe'|'bow'|'shotgun'), aware, hp, target, seed, def (Chars def override) }
//        agent: { char, type, faction, state ('idle'|'suspicious'|'search'|'combat'|'flee'|'dead'), hp, alive, aware,
//                 damage(n, {type:'bullet'|'melee'|'fire'|'shiv'|'choke'|'explosion'|'arrow'|'stab', part:'head'|'body', from:Vector3, force}),
//                 stun(sec), kill(), alert(pos), setBehaviour(b, opts), onDeath(fn) }
//   AI.companion(char, {role:'chloe'|'wai'|'zane'|'aidan'|'luke'|'techsupport'|'regional', follow=true, weapon}) -> agent
//        follow 3–5 m (inside of corners, never in doorways or the line of fire; teleports near the player if > 25 m behind and
//        off-screen), crouches/holds still in stealth, invisible to enemies during stealth unless scripted, combat callouts,
//        throws bricks/bottles to stun, rescue-stab when the player is grabbed (≤ once per 60 s), hands over supplies,
//        idles with life (looks around, reads signs, hums, remarks from A.remark tags). companion.say(line) / .goTo(pt) / .hold(bool)
//   AI.noise(pos, radius, source)      emit noise: footsteps (Play), gunshots 40 m, glass 15 m, thrown objects where they land
//   AI.hitTest(origin, dir, maxDist) -> { agent, part:'head'|'body', point, dist } | null     (character hit volumes)
//   AI.takedownTarget(pos, yaw) -> agent | null     an unaware enemy within 1.3 m whose back faces the player
//   agent.takedown(kind:'choke'|'shiv'|'stab') -> Promise   paired animation with Play.char; resolves when done (agent dead)
//   AI.listenTargets(pos, r) -> agents currently making noise within r (Airplane Mode silhouettes)
//   AI.detectors -> [{ dir (radians relative to camera yaw), amount 0..1 }]  detection building (UI.detect arcs)
//   AI.update(dt) · AI.clear() · AI.list · AI.byName(name) · AI.alertLevel (0..1, drives Audio.tension)
//   AI.nav   navigation grid built from World boxes on area load: AI.nav.path(from, to) -> [Vector3] | null
//   AI.extendArea(A) adds A.patrol(name, points), A.cover(points), A.navBounds(x1, z1, x2, z2)
// Rules: cap 12 active agents (CONFIG.maxActiveAI); freeze agents > 60 m away; companions never break stealth; the player
// always knows why they were spotted (detection builds visibly); enemies bark by title/slang (CONTENT.barks), never names.
// When an agent grabs the player it calls Play.grab(agent, kind) and acts on the promised outcome.
// ============================================================================
const AI = (() => {
  const list = [];
  return {
    list, spawn(type, at, o = {}) { const c = o.char || Chars.create(type, { name: o.name }); if (at) Game.place(c, at); const a = { char: c, type, state: 'idle', hp: 1, alive: true, kill() { a.alive = false; }, alert() {}, setBehaviour() {} }; list.push(a); return a; },
    companion(char) { return { char }; }, noise() {}, update() {}, clear() { for (const a of list) if (!a.char.persistent) a.char.dispose(); list.length = 0; },
    byName: n => list.find(a => a.char.name === n)?.char || null, alertLevel: 0,
  };
})();
