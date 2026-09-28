// ============================================================================
// AI — infected (Scroller, Lurker, Clicker, Bloatware), humans (factions), companions,
// crowds, perception (sight cones, noise), navigation. Owned by: systems agent.
// THIS IS A STUB: keep every API below, replace the implementation.
//
// CONTRACT
//   AI.spawn(type, at {pos, yaw}, opts) -> agent   types: scroller lurker clicker bloatware human crowd
//        opts: { name, char (existing Character to drive), behaviour: 'idle'|'wander'|'patrol'|'hunt'|'ambush'|'scripted'|'phone_idle'|'queue',
//                route:[points], faction (comms smuggler doorknocker retreat bandit landline), weapon, aware, hp, target }
//        agent: { char, type, state, hp, alive, kill(), alert(pos), setBehaviour(b, opts) }
//   AI.companion(char, {role, follow=true}) -> agent   companion brain (follow, stealth crouch, callouts, rescues)
//   AI.noise(pos, radius, source)     emit noise (footsteps, gunshots, thrown objects)
//   AI.update(dt) · AI.clear() · AI.list · AI.byName(name) · AI.alertLevel (0..1)
// ============================================================================
const AI = (() => {
  const list = [];
  return {
    list, spawn(type, at, o = {}) { const c = o.char || Chars.create(type, { name: o.name }); if (at) Game.place(c, at); const a = { char: c, type, state: 'idle', hp: 1, alive: true, kill() { a.alive = false; }, alert() {}, setBehaviour() {} }; list.push(a); return a; },
    companion(char) { return { char }; }, noise() {}, update() {}, clear() { for (const a of list) if (!a.char.persistent) a.char.dispose(); list.length = 0; },
    byName: n => list.find(a => a.char.name === n)?.char || null, alertLevel: 0,
  };
})();
