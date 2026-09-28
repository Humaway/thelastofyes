// ============================================================================
// Chars — character factory, skeleton, face rig, clothing, hair, props, cast definitions,
// and procedural animation (locomotion, poses, gestures, paired anims).
// Owned by: chars agent. THIS IS A STUB: keep every API below, replace the implementation.
//
// CONTRACT
//   Chars.defs[defId]           cast definitions (see ARCHITECTURE.md for the required list)
//   Chars.create(defId, {name, seed, variant}) -> Character      (added to Engine.scene)
//   Chars.update(dt)            advance all live characters (called by Game.tick)
//   Chars.all                   array of live characters
//   Chars.preload()             optional: array of () => void jobs run under the loading screen
//
// Character c:
//   c.name, c.def (with c.def.id), c.root (Group; feet at root.position; facing +Z; yaw = root.rotation.y)
//   c.yaw (get/set), c.bones {hips, spine, chest, neck, head, jaw, clavL/R, upperArmL/R, foreArmL/R, handL/R, thighL/R, shinL/R, footL/R}
//   c.point(name, out?) -> world Vector3. names: head, eyes, chest, hips, feet, hand_l, hand_r, shoulder_r, shoulder_l, badge
//   c.height (m)
//   Locomotion (used by Play/AI every frame):
//     c.setMove(speed m/s, {crouch, carry, limp, strafe:[x,z] local dir}) — gait from speed: <0.1 idle, walk ~1.4, jog ~3, sprint ~5.5
//   Scripted movement (Director/AI; ignores collisions; drives setMove itself):
//     c.walkTo(target, {speed=1.4 | 'walk'|'jog'|'run', path:[...points], stopDist=0.1, face}) -> Promise
//        target/path points: Vector3 | [x,y,z] | marker name (resolved via Game.G.marker)
//     c.turnTo(yaw | Vector3 | Character, dur=0.5) -> Promise
//     c.stop()  cancel walkTo/turnTo (resolves their promises)
//   Face & head:
//     c.lookAt(Vector3 | Character | () => Vector3 | null)  head/neck/eyes track target (null = forward)
//     c.emote(name, dur?)  neutral smirk smile laugh sad crying angry afraid shocked tender tense ashamed exhausted lying (blend 0.25 s)
//     c.speak(text, dur)   visemes from text syllables for dur seconds;  c.speaking (bool)
//     c.blink()            force a blink
//   Body:
//     c.pose(name, opts) -> Promise   held base pose: stand sit kneel lie crouch carry(=carrying someone) carried dead hands_up
//                                      phone(=infected/crowd: phone held to face, thumb swiping) phone_ear aim sit_car drive
//     c.gesture(name, opts) -> Promise one-shot upper-body overlay: point shrug wave_off hand_on_shoulder fold_arms rub_face
//                                      hands_on_hips push_glasses pull_collar rub_palm click_cutter wipe_tears cover_mouth
//                                      hand_over hold_hands lean_railing head_on_shoulder cpr punch tackle swing fire recoil
//                                      struggle type_phone slam_phone wave knock grab
//     c.anim(name, opts) -> Promise   alias: routes to pose() or gesture()
//     c.hold(prop, hand='r')  prop: name from Chars.props ('phone','torch','tyre_iron','revolver','shotgun','rifle','bat','box_cutter','manual','bow','pistol','clipboard','megaphone','axe','scanner','radio','mug','ration_bar','flowers','digital_pet','cassette','letter') or Object3D;  c.drop(hand)
//     c.attach(other, mode) / c.detach()   paired anims: 'carry' (other in c's arms), 'hug', 'face_hold' (c holds other's face), 'pin' (c on top of other)
//     c.setVisible(bool)
//     c.decal(kind, on=true)   'blood_knuckles' 'grime' 'tears' 'wet' 'blood_face' 'sweat' 'fever'
//     c.badge(value | null, where)  red infection dot with white number on skin; where: 'forearm_l' 'wrist_r' 'neck' 'calf_r'
//     c.phoneGlow(on)          screen glow on the held phone (blue emissive + face light)
//     c.dispose()
// ============================================================================
const Chars = (() => {
  const all = [];
  const defs = {};
  const tmp = new THREE.Vector3();
  function create(defId, o = {}) {
    const def = defs[defId] || { id: defId, height: 1.75, color: 0x888888 };
    const root = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, def.height - 0.44, 4, 8), new THREE.MeshStandardMaterial({ color: def.color ?? 0x888888 }));
    body.position.y = def.height / 2; body.castShadow = true; root.add(body);
    Engine.scene.add(root);
    const c = {
      name: o.name || defId, def, root, height: def.height, bones: {}, speaking: false,
      get yaw() { return root.rotation.y; }, set yaw(v) { root.rotation.y = v; },
      point(n, out = new THREE.Vector3()) { const y = { head: def.height - 0.12, eyes: def.height - 0.1, chest: def.height * 0.72, hips: def.height * 0.52, feet: 0 }[n] ?? def.height * 0.6; return out.set(0, y, 0).applyMatrix4(root.matrixWorld); },
      setMove() {}, walkTo(t) { const p = Game.G.marker(t); if (p) root.position.copy(p.pos); return Promise.resolve(); },
      turnTo() { return Promise.resolve(); }, stop() {}, lookAt() {}, emote() {}, speak() {}, blink() {},
      pose() { return Promise.resolve(); }, gesture() { return Promise.resolve(); }, anim() { return Promise.resolve(); },
      hold() {}, drop() {}, attach() {}, detach() {}, setVisible(v) { root.visible = v; }, decal() {}, badge() {}, phoneGlow() {},
      update() {}, dispose() { Engine.scene.remove(root); body.geometry.dispose(); body.material.dispose(); all.splice(all.indexOf(c), 1); },
    };
    all.push(c);
    return c;
  }
  return { defs, create, all, update(dt) { for (const c of all) c.update(dt); }, props: {} };
})();
