// ============================================================================
// Director — plays cutscene scripts from CONTENT.scenes; owns the final camera pose each
// frame (blends gameplay <-> cinematic), letterbox, DOF focus, cues. Owned by: cinema agent.
// THIS IS A STUB: keep every API below, replace the implementation. Full format: ARCHITECTURE.md.
//
// CONTRACT
//   Director.play(id, {skippable}) -> Promise   resolves when the scene ends (after its exit blend starts)
//   Director.active (bool), Director.sceneId
//   Director.update(dt)       advance scene time: actions, lines, cues, shot changes
//   Director.camUpdate(dt)    write Engine.camera from: active shot | manual pose | blend-out | Play.camPose
//   Director.stop()           abort silently (flow cancelled)
//   Director.skip()           jump to end state, apply side effects (scene.end), blend to gameplay
//   Director.manual(pose | null)  free camera override outside scenes (title screen, drive): {pos, target, fov} (Vector3s)
// ============================================================================
const Director = (() => {
  let active = false, sceneId = null, manualPose = null, resolveEnd = null;
  const cine = { pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: 50 };
  const P = (spec, out = new THREE.Vector3()) => {
    if (Array.isArray(spec)) return out.fromArray(spec);
    if (typeof spec === 'string') { const [w, part] = spec.split('.'); const c = Game.who(w); if (c) return c.point(part || 'head', out); const m = Game.G.marker(spec); return m ? out.copy(m.pos) : out; }
    return out;
  };
  async function play(id) {
    const s = CONTENT.scenes[id]; if (!s) { console.error('no scene ' + id); return; }
    active = true; sceneId = id; UI.letterbox(s.letterbox !== false);
    for (const shot of s.shots) {
      if (!active) break;
      const c = shot.cam || {};
      P(c.from || c.at || [0, 1.6, 4], cine.pos); P(c.look || [0, 1.5, 0], cine.target); cine.fov = U.lensToFov(c.lens || 35);
      for (const l of shot.lines || []) { if (!active) break; await Dialogue.say(l.who, l.text, l); }
      if (!(shot.lines || []).length) await Game.G.wait(c.dur || 2);
    }
    active = false; sceneId = null; UI.letterbox(false);
  }
  function camUpdate() {
    const cam = Engine.camera, pose = active ? cine : manualPose || Play.camPose;
    cam.position.copy(pose.pos); cam.lookAt(pose.target);
    if (cam.fov !== pose.fov) { cam.fov = pose.fov; cam.updateProjectionMatrix(); }
  }
  return {
    play, update() {}, camUpdate, stop() { active = false; }, skip() { active = false; },
    manual(p) { manualPose = p; }, get active() { return active; }, get sceneId() { return sceneId; },
  };
})();
