// ============================================================================
// Game — chapter flow, area loading/unloading, the G API used by content, triggers,
// interactables, checkpoints, death/retry, pause, the per-frame tick. Owned by: core.
//
// Flow model: CONTENT.chapters[id].steps is an ordered list of { id, checkpoint, run: async G => {} }.
// A step with checkpoint:true autosaves when it starts; death/retry restarts the last checkpoint step.
// Every checkpoint step must establish its own state at the start (G.area, G.actor placement, G.player).
// Any G.* promise rejects with Game.ABORT when the flow is cancelled (retry, quit, chapter select);
// Game swallows ABORT, so content never needs to handle it.
// ============================================================================
const Game = (() => {
  const ABORT = Symbol('abort');
  let runId = 0;
  const waits = new Set();              // { check(dt) -> bool, resolve, reject, id }
  let area = null;                      // primary area (the one the player is in)
  const areas = new Map();              // every loaded area by id (usually just one; scenes may intercut two)
  const actors = {};                    // persistent named characters (chase, chloe, …)
  let flags = {};
  let chapterId = null, stepIndex = 0, lastCheckpoint = null;
  let paused = false, state = 'boot', time = 0, timeScale = 1;
  let focusIt = null;                   // interactable currently prompted

  // ---- areas -------------------------------------------------------------
  // Area context. Everything inside def.build(A) is in AREA-LOCAL coordinates: A.group sits at def.origin,
  // and A.marker / A.interactable / A.char / A.collider / A.w() convert local -> world.
  function makeArea(id) {
    const def = CONTENT.levels[id];
    if (!def) throw new Error('Unknown area ' + id);
    const origin = U.v3(def.origin || [0, 0, 0]).clone();
    const w = (p, out = new THREE.Vector3()) => U.v3(p, out).add(origin);
    const A = {
      id, def, origin, w, group: new THREE.Group(), markers: {}, interactables: [], updaters: [], chars: [], data: {},
      add(o) { A.group.add(o); return o; },
      marker(name, pos, yaw = 0) { A.markers[name] = { pos: w(pos), yaw }; return A.markers[name]; },
      update(fn) { A.updaters.push(fn); return fn; },
      // Interactable: { id, at:[x,y,z] (local), r, prompt:'e – look', once, cond:()=>bool, use: async (G, it) => {} }
      interactable(o) { const it = Object.assign({ r: 1.4, once: true, used: false }, o); it.pos = w(o.at); A.interactables.push(it); return it; },
      // Area-local character (disposed with the area). o.at is local unless it is a marker name.
      char(defId, o = {}) { const c = Chars.create(defId, o); place(c, typeof o.at === 'string' ? o.at : w(o.at ?? [0, 0, 0]), o.yaw); A.chars.push(c); return c; },
      collider: (min, max, o) => World.addBox(w(min), w(max), o),
      surface: (x1, z1, x2, z2, name) => World.addSurface(x1 + origin.x, z1 + origin.z, x2 + origin.x, z2 + origin.z, name),
    };
    A.group.name = 'area:' + id;
    A.group.position.copy(origin);
    A.group.updateMatrixWorld(true);
    for (const m of [Play, AI, Dialogue, Build]) m.extendArea && m.extendArea(A);   // modules add their own A.* helpers (pickups, ladders, remarks…)
    return A;
  }

  function disposeObject(root) {
    root.traverse(o => {
      if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
      const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      for (const m of ms) if (!m.userData.shared) { for (const k in m) { const v = m[k]; if (v && v.isTexture && !v.userData.shared) v.dispose(); } m.dispose(); }
      if (o.isLight && o.shadow && o.shadow.map) o.shadow.map.dispose();
    });
  }

  function unloadArea(id) {
    const A = areas.get(id); if (!A) return;
    try { A.def.unload && A.def.unload(A); } catch (e) { console.error(e); }
    for (const m of [Play, AI, Dialogue, Build]) m.unloadArea && m.unloadArea(A);
    for (const c of A.chars) c.dispose();
    Engine.scene.remove(A.group);
    disposeObject(A.group);
    World.clear(id);
    areas.delete(id);
    if (area === A) area = null;
  }

  // Load an area and make it primary. By default every other area is unloaded; {keep:true} keeps them
  // (for scenes that intercut two places — give such areas distinct def.origin offsets).
  async function loadArea(id, o = {}) {
    if (area && area.id === id && !o.reload) return area;
    if (!o.keep) { AI.clear(); for (const k of [...areas.keys()]) if (k !== id) unloadArea(k); }
    let A = areas.get(id);
    if (!A) {
      A = makeArea(id);
      areas.set(id, A);
      World.owner = id;
      Build.begin(A);
      try { A.def.build(A); } finally { Build.end(A); World.owner = null; }
      Engine.scene.add(A.group);
    }
    area = A;
    applyLook(A.def);
    Engine.renderer.compile(Engine.scene, Engine.camera);
    return A;
  }
  // Fog, background, environment, grade, ambience of an area (also used when a scene cuts between areas).
  function applyLook(d) {
    Engine.setGrade(d.grade || 'neutral');
    Engine.scene.fog = d.fog ? (d.fog.density != null ? new THREE.FogExp2(d.fog.color, d.fog.density) : new THREE.Fog(d.fog.color, d.fog.near, d.fog.far)) : null;
    Engine.scene.background = d.background != null ? (d.background.isTexture ? d.background : new THREE.Color(d.background)) : new THREE.Color(d.fog ? d.fog.color : 0x000000);
    Engine.setEnv(d.env ?? null);
    World.baseSurface = d.surface || 'concrete';
    Audio.amb(d.amb || null, 1.5);
  }

  // ---- characters --------------------------------------------------------
  function resolveAt(at) {
    if (at == null) return null;
    if (typeof at === 'string') { let m = area && area.markers[at]; if (!m) for (const A of areas.values()) if (A.markers[at]) { m = A.markers[at]; break; } if (!m) { console.warn('missing marker ' + at); return { pos: new THREE.Vector3(), yaw: 0 }; } return m; }
    if (at.isVector3) return { pos: at, yaw: undefined };
    if (Array.isArray(at)) return { pos: U.v3(at), yaw: undefined };
    return at; // {pos,yaw}
  }
  function place(c, at, yaw) {
    const m = resolveAt(at);
    if (m) c.root.position.copy(m.pos);
    const y = yaw ?? m?.yaw; if (y != null) c.yaw = y;
    if (c.stop) c.stop();
    return c;
  }
  // Get or create a persistent named actor. defId defaults to id.
  function actor(id, defId, at, yaw) {
    let c = actors[id];
    if (c && defId && c.def.id !== defId) { c.dispose(); c = null; }
    if (!c) { c = actors[id] = Chars.create(defId || id, { name: id }); }
    c.setVisible(true);
    if (at != null) place(c, at, yaw);
    return c;
  }
  function removeActor(id) { const c = actors[id]; if (c) { c.dispose(); delete actors[id]; } }
  // Look up any speaker/actor by id (persistent actors first, then area chars with .name)
  function who(id) { if (!id) return null; if (typeof id !== 'string') return id; if (actors[id]) return actors[id]; for (const A of areas.values()) { const c = A.chars.find(c => c.name === id); if (c) return c; } return AI.byName?.(id) || null; }

  // ---- waits ---------------------------------------------------------------
  function wait(check) {
    const my = runId;
    return new Promise((resolve, reject) => { const w = { check, resolve, reject, id: my }; waits.add(w); });
  }
  function guard(p) { const my = runId; return Promise.resolve(p).then(v => { if (my !== runId) throw ABORT; return v; }); }
  const flowIts = [];                   // interactables created by G.interact (retired on cancel)
  function cancelWaits() { for (const w of waits) w.reject(ABORT); waits.clear(); for (const it of flowIts) it.used = true; flowIts.length = 0; }

  // ---- G: the API content uses --------------------------------------------
  const G = {
    ABORT,
    area: (id, o) => guard(loadArea(id, o)),
    unload: id => unloadArea(id),
    look: id => applyLook(CONTENT.levels[id]),
    get A() { return area; },
    areaById: id => areas.get(id),
    get t() { return time; },
    get actors() { return actors; },
    flags: new Proxy({}, { get: (_, k) => flags[k], set: (_, k, v) => { flags[k] = v; return true; } }),
    actor, removeActor, who, place,
    marker: name => resolveAt(name),
    scene: (id, opts) => guard(Director.play(id, opts)),
    player: (id, profile) => { const c = typeof id === 'string' ? actor(id) : id; Play.setPlayer(c, profile); return c; },
    control: on => Play.enable(on),
    wait: sec => { let t = 0; return wait(dt => (t += dt) >= sec); },
    until: fn => wait(() => fn()),
    // resolves when the player enters a sphere {at, r} or rectangle {box:[x1,z1,x2,z2]}
    zone: o => { const p = o.at && U.v3(o.at); return wait(() => { const pl = Play.char; if (!pl) return false; const q = pl.root.position; return o.box ? (q.x >= Math.min(o.box[0], o.box[2]) && q.x <= Math.max(o.box[0], o.box[2]) && q.z >= Math.min(o.box[1], o.box[3]) && q.z <= Math.max(o.box[1], o.box[3])) : q.distanceTo(p) <= (o.r ?? 2); }); },
    // resolves when the player uses it. o: {at, r, prompt, face}
    interact: o => {
      let it = null;
      const p = wait(() => it.used);
      it = area.interactable(Object.assign({ prompt: 'e – interact' }, o, { use: () => { it.used = true; } }));
      flowIts.push(it);
      return p;
    },
    say: (w, text, o) => guard(Dialogue.say(w, text, o)),
    talk: (id, o) => guard(Dialogue.talk(id, o)),
    fade: (to, dur = 1) => guard(UI.fade(to, dur)),
    card: id => guard(UI.card(id)),
    title: (lines, o) => guard(UI.titleText(lines, o)),
    music: (id, o) => Audio.music(id, o),
    sfx: (id, o) => Audio.sfx(id, o),
    amb: (id, fade) => Audio.amb(id, fade),
    spawn: (type, at, o = {}) => AI.spawn(type, resolveAt(at), o),
    hook: (name, args) => guard(CONTENT.hooks[name](G, args)),
    grade: (g, dur) => Engine.setGrade(g, dur),
    save: () => saveCheckpoint(),
  };

  // ---- flow ----------------------------------------------------------------
  function snapshot() { return { chapter: chapterId, step: CONTENT.chapters[chapterId].steps[stepIndex].id, inv: Play.inventory ? JSON.parse(JSON.stringify(Play.inventory)) : null, flags: JSON.parse(JSON.stringify(flags)) }; }
  function saveCheckpoint() { lastCheckpoint = snapshot(); Save.checkpoint(lastCheckpoint); }

  async function runFrom(chId, stepId) {
    const my = ++runId; cancelWaits(); Director.stop(); Dialogue.stop(); UI.prompt(null);
    state = 'play'; unpause();
    chapterId = chId;
    const ch = CONTENT.chapters[chId];
    if (!ch) { console.error('no chapter ' + chId); return; }
    let i = stepId ? ch.steps.findIndex(s => s.id === stepId) : 0;
    if (i < 0) i = 0;
    Save.unlockChapter(chId);
    for (; i < ch.steps.length; i++) {
      if (my !== runId) return;
      stepIndex = i;
      const st = ch.steps[i];
      if (st.checkpoint) saveCheckpoint();
      try { await st.run(G); }
      catch (e) { if (e === ABORT) return; console.error(e); return; }
    }
    if (my !== runId) return;
    const order = CONTENT.chapterOrder, next = order[order.indexOf(chId) + 1];
    if (next && CONTENT.chapters[next]) return runFrom(next);
    UI.endOfBuild();
  }

  function newGame() { flags = {}; if (Play.resetInventory) Play.resetInventory(); Save.newGame(); return startChapter(CONTENT.chapterOrder[0]); }
  function continueGame() { const s = Save.data.checkpoint; if (!s) return newGame(); restore(s); return runFrom(s.chapter, s.step); }
  function startChapter(chId, stepId) { flags = {}; if (Play.resetInventory) Play.resetInventory(); UI.hideMenus && UI.hideMenus(); return runFrom(chId, stepId); }
  function restore(s) { flags = JSON.parse(JSON.stringify(s.flags || {})); if (s.inv && Play.setInventory) Play.setInventory(s.inv); }
  function retry() { const s = lastCheckpoint || Save.data.checkpoint; if (!s) return; restore(s); return runFrom(s.chapter, s.step); }
  async function die(cause) {
    if (state !== 'play') return;
    const my = runId;
    Play.enable(false);
    await UI.death(cause);
    if (my === runId) retry();
  }
  function quitToTitle() { ++runId; cancelWaits(); Director.stop(); Dialogue.stop(); unpause(); titleScreen(); }

  async function titleScreen() {
    state = 'title';
    Play.enable(false); Play.setPlayer(null);
    for (const k in actors) actors[k].setVisible(false);
    if (CONTENT.levels.TITLE) await loadArea('TITLE');
    UI.titleScreen();
  }

  function unpause() { if (!paused) return; paused = false; Engine.uniforms.uDesat.value = 0; Audio.pause && Audio.pause(false); UI.pauseMenu(false); }
  function setPaused(p) {
    if (state !== 'play' || paused === p) return;
    paused = p;
    Engine.uniforms.uDesat.value = p ? 0.35 : 0;
    Audio.pause && Audio.pause(p);
    if (p) { Input.unlock(); UI.pauseMenu(true); } else { UI.pauseMenu(false); Input.lock(); }
  }

  // ---- interactables -------------------------------------------------------
  const tmpV = new THREE.Vector3();
  function updateInteract() {
    let best = null, bd = 1e9;
    const pl = Play.char;
    if (area && pl && Play.enabled && !Director.active) {
      const p = pl.root.position;
      for (const A of areas.values()) for (const it of A.interactables) {
        if (it.used || (it.cond && !it.cond())) continue;
        const d = tmpV.copy(it.pos).setY(p.y).distanceTo(p);
        if (d > it.r || Math.abs(it.pos.y - p.y) > 2.2) continue;
        if (d < bd) { bd = d; best = it; }
      }
    }
    if (best !== focusIt) { focusIt = best; UI.prompt(best ? best.prompt : null); }
    if (best && Input.pressed('interact')) {
      if (best.once) best.used = true;
      focusIt = null; UI.prompt(null);
      const r = best.use && best.use(G, best);
      if (r && r.catch) r.catch(e => { if (e !== ABORT) console.error(e); });
    }
  }

  // ---- tick ----------------------------------------------------------------
  function tick(dt) {
    Input.update(dt);
    if (state === 'play' && Input.pressed('pause') && !UI.menuOpen?.()) setPaused(!paused);
    if (paused || state === 'boot') { UI.update(dt); Audio.update(dt); return; }
    const sdt = dt * timeScale;
    time += sdt;
    Director.update(sdt);
    Play.update(sdt);
    AI.update(sdt);
    for (const A of areas.values()) for (const f of A.updaters) f(sdt, time);
    Chars.update(sdt);
    Dialogue.update(sdt);
    for (const w of waits) { let done = false; try { done = w.check(sdt); } catch (e) { console.error(e); done = true; } if (done) { waits.delete(w); w.resolve(); } }
    updateInteract();
    Director.camUpdate(dt);
    UI.update(dt);
    Audio.update(dt);
  }

  return {
    ABORT, G, tick, loadArea, unloadArea, applyLook, areas, actor, who, place, newGame, continueGame, startChapter, runFrom, retry, die, quitToTitle, titleScreen, setPaused,
    get area() { return area; }, get actors() { return actors; }, get state() { return state; }, set state(s) { state = s; },
    get paused() { return paused; }, get time() { return time; }, get chapter() { return chapterId; },
    get timeScale() { return timeScale; }, set timeScale(v) { timeScale = v; }, flags: () => flags,
  };
})();
