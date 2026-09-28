// ============================================================================
// Chars — character factory, skeleton, face rig, clothing, hair, props, cast definitions,
// and procedural animation (locomotion, poses, gestures, paired anims). Owned by: chars agent.
// Implementation: 150_chars (this: API, cast, runtime) · 154_charhead (SDF-sculpted head, expression morphs) ·
// 155_charbody (skeleton, skinned body; extras merge the head into one mesh with a painted-in face) ·
// 156_chardress (outfits, accessories) · 157_charhair · 158_charpaint (atlas) · 159_charface (face canvas + eye shader) ·
// 160_anim (poses, gaits, look-at, springs) · 162_gest (gestures, IK, paired anchors) · 163_charkit (seeded extras) · 164_charprops (props, badge) ·
// 166_charinf (infected looks) · 168_quad (horse, deer)
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
//
// ADDITIONS (chars agent)
//   Poses also: sit_ground kneel_one crawl (locomotes on hands and knees) pin ride sit_shoulders cradle cradled struggle_down.
//     pose(name, {dur=0.6}) blends; lie/dead/sit_ground/cradle from standing go via a kneel/crouch so they never float.
//     Poses that sit/lie/kneel treat root.position as the pelvis' ground point.
//   gesture(name, {dur, hold:true (stay until c.gesture(null)), to: Character|Vector3|marker (point/hand_on_shoulder/hand_over/
//     hold_hands/knock/grab/punch/cpr target), hand:'l'|'r'}) — plus push_sweatband, chew_sleeve, adjust_cap, touch_headset,
//     wind_cord, steeple, clean_hands, bounce, swipe, hand_on_pocket, drop_hand (cradled hand falls), hug.
//   attach modes also: 'cradle' (c sits on the ground with other across the lap; {grip:false} lets other's hand fall from the
//     collar), 'shoulders' (other rides on c's shoulders), 'ride' / 'ride_back' (c rides the horse `other`), 'drag'.
//   c.hold(prop, hand, {light:true}) gives a torch a real SpotLight; c.hold returns the prop; c.held(hand) -> prop;
//   c.drop(hand, {remove}) returns the prop, left falling to the ground in the current area unless remove.
//   Extra props: phone_cracked counter hammer slingshot flare_gun knife syringe scalpel rag coverage_map bowl chips bottle
//     brick pipe machete; scanner.userData.setText('BADGE: 14').
//   c.phoneGlow(on, {light}) — light:true adds a small blue PointLight at the screen (heroes only; budget).
//   c.decal kinds also: 'feed_eyes' (red, wet, unblinking — the Update taking hold), 'bruise'.
//   c.setPart(name, state): 'sweatband' 'up'|'down'; 'jacket' | 'glasses' | 'cap' | 'goggles' | 'beanie' | 'lanyard' |
//     'backpack' | 'hood' true/false (goggles also 'up') — rebuilds the body mesh.
//   c.outfit(variant) — e.g. chloe 'pyjamas', chase 'shirt' (jacket off); c.parts (current part states).
//   c.infected (scroller/lurker/clicker/bloatware defs) · c.persistent (flag honoured by AI.clear)
// ============================================================================
const Chars = (() => {
  const all = [];
  const V3 = THREE.Vector3;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  let seedCounter = 1;

  // ---------------------------------------------------------------------------------------------
  // Cast. Looks: H (m), sex, age, build {sh ch wa hi arm leg neck belly bust fat musc legLen armLen}, head {jaw chin width
  // cranium nose noseW noseBump cheek brow ear lips hollow full ipd eyeW mouthW hairline}, skin, iris, hair {style color grey
  // part len vol line recede}, beard, stubble, freckles, outfit [garments], acc [accessories], tics [gestures when idle].
  const POLO_YELLOW = '#f0b400', TRAINEE_YELLOW = '#ffd21a', FADED_CREAM = '#e6dcb8';
  const defs = {
    // ---- Prologue ---------------------------------------------------------------------------------
    chase_young: { name: 'Chase', H: 1.83, sex: 'm', age: 34, named: true, tics: ['rub_palm'], scar: true,
      build: { sh: 1.12, ch: 1.06, wa: 0.97, musc: 0.35, arm: 1.05, leg: 1.04 },
      head: { jaw: 1.1, chin: 1.1, width: 1.0, brow: 1.25, nose: 1.02, noseBump: 0.5, cheek: 1.1, lips: 0.95, hairline: 0.07 },
      skin: '#d6a383', iris: '#5d7282', stubble: 0.12, rosy: 0.45, browThick: 1.1,
      hair: { style: 'side_part', color: '#3e2c20', part: 0.4 },
      outfit: [{ k: 'polo', color: POLO_YELLOW, tuck: true, logo: true, badge: 'CHASE — Senior Consultant — Ask me about upgrading!', fab: 'pique' },
        { k: 'pants', color: '#2a2d35', style: 'chinos', fab: 'twill', taper: 0.3 }, { k: 'shoes', style: 'dress', color: '#171412' }],
      acc: [{ k: 'belt', color: '#1a1614' }, { k: 'watch' }] },
    luke_young: { name: 'Luke', H: 1.80, sex: 'm', age: 29, named: true, tics: ['adjust_cap'],
      build: { sh: 1.0, ch: 1.0, wa: 1.05, fat: 0.2, belly: 0.25 },
      head: { jaw: 0.95, chin: 0.95, nose: 0.96, noseW: 1.08, cheek: 0.95, full: 0.5, lips: 1.05, hairline: 0.066 },
      skin: '#e0b096', iris: '#6a5234', stubble: 0.05, rosy: 0.7,
      hair: { style: 'tied_back', color: '#6a4a2c', len: 0.14 },
      outfit: [{ k: 'polo', color: POLO_YELLOW, logo: true, badge: 'LUKE — Sales Consultant', fab: 'pique', loose: 1.2 },
        { k: 'pants', color: '#252a33', style: 'jeans', fab: 'denim' }, { k: 'shoes', style: 'sneaker', color: '#3a3a3a', accent: '#d8d0c0' }],
      acc: [{ k: 'cap', color: '#1d1d1f', text: 'yes', back: true, ink: '#f2c200' }] },
    bub: { name: 'Bub', H: 1.53, sex: 'f', age: 13, child: true, named: true, tics: ['chew_sleeve'], headSize: 0.92,
      build: { sh: 0.86, ch: 0.9, wa: 0.95, hi: 0.86, arm: 0.84, leg: 0.9, bust: 0.1, neck: 0.9, legLen: 1.02 },
      head: { jaw: 0.86, chin: 0.9, nose: 0.8, noseW: 0.9, cheek: 0.95, full: 0.35, lips: 0.92, eyeW: 0.0156, ipd: 0.058, mouthW: 0.0215, hairline: 0.064 },
      skin: '#e9bb9b', iris: '#6b4c2c', freckles: 0.35, rosy: 0.9, braces: true, browThick: 0.8,
      hair: { style: 'buns', color: '#5c3a22' },
      outfit: [{ k: 'tee', color: '#27324a', loose: 2.2, sleeve: 0.46, hem: 0.405, print: 'REP OF THE YEAR\nOPTUS REDCLIFFE', ink: '#f2c200', dirt: 0.1 },
        { k: 'shoes', style: 'fluffy', color: '#f3c9d6' }] },
    customer: { name: 'Customer', H: 1.6, sex: 'f', age: 74, tics: [], stoop: 0.35,
      build: { sh: 0.92, ch: 1.05, wa: 1.15, hi: 1.05, fat: 0.3, belly: 0.35, bust: 0.8, arm: 0.95 },
      head: { jaw: 0.95, chin: 0.9, nose: 1.02, cheek: 0.9, full: 0.4, lips: 0.8, hairline: 0.07 },
      skin: '#eac2a8', iris: '#6a7a86', rosy: 0.8, tired: 0.4, browColor: '#b8b0a8', browThick: 0.6,
      hair: { style: 'perm', color: '#dcd8d2', grey: 0.9 },
      outfit: [{ k: 'shirt', color: '#e8e0cf', fab: 'cotton', tuck: true, pocket: false }, { k: 'cardigan', color: '#8e7c9c' },
        { k: 'pants', color: '#b8ab92', style: 'chinos', fab: 'twill' }, { k: 'shoes', style: 'dress', color: '#5a4030', sole: '#3a2a20' }],
      acc: [{ k: 'glasses', color: '#8a6a4a', round: true }] },
    security_guard: { name: 'Security', H: 1.87, sex: 'm', age: 45, tics: [], hold: 'counter',
      build: { sh: 1.2, ch: 1.15, wa: 1.2, fat: 0.35, belly: 0.45, musc: 0.3, neck: 1.2, arm: 1.1, leg: 1.08 },
      head: { jaw: 1.2, chin: 1.0, width: 1.08, nose: 1.05, noseW: 1.15, cheek: 1.0, full: 0.6, hairline: 0.07 },
      skin: '#8a5a3c', iris: '#3a2618', stubble: 0.5, rosy: 0.3,
      hair: { style: 'buzz', color: '#15110e' }, beard: { style: 'full', color: '#2a211b' },
      outfit: [{ k: 'polo', color: '#16181b', tuck: true, text: 'SECURITY', logo: false }, { k: 'pants', color: '#141518', style: 'cargo' }, { k: 'shoes', style: 'boot', color: '#101010' }],
      acc: [{ k: 'belt', color: '#0e0e0e' }, { k: 'earpiece' }, { k: 'radio', phi: -0.55 }] },
    neighbour: { name: 'Neighbour', H: 1.76, sex: 'm', age: 61, tics: [], hold: 'phone',
      build: { sh: 1.0, ch: 1.0, wa: 1.15, fat: 0.3, belly: 0.55, arm: 0.95 },
      head: { jaw: 1.0, chin: 0.9, nose: 1.12, noseW: 1.1, cheek: 0.95, full: 0.3, lips: 0.85 },
      skin: '#e3b39a', iris: '#5a6048', stubble: 0.45, greyStubble: 0.8, rosy: 0.9, tired: 0.5,
      hair: { style: 'receding', color: '#9a948c', grey: 0.8 },
      outfit: [{ k: 'pants', color: '#44587a', fab: 'plaid', plaidA: 'rgba(230,230,240,0.35)', plaidB: 'rgba(20,20,40,0.2)', bag: 1.3 }, { k: 'tee', color: '#b8b4aa' },
        { k: 'robe', color: '#6a2a2e', fab: 'terry' }, { k: 'shoes', style: 'slipper', color: '#6a4a36' }] },
    soldier: { name: 'Soldier', H: 1.8, sex: 'm', age: 22, tics: [], hold: 'rifle',
      build: { sh: 1.08, ch: 1.02, wa: 0.98, musc: 0.3 },
      head: { jaw: 0.95, chin: 1.0, nose: 1.0 }, skin: '#d8a888', iris: '#4a5a3a', stubble: 0.1,
      hair: { style: 'crop', color: '#3a2c20' },
      outfit: [{ k: 'shirt', color: '#3d4232', fab: 'camo', tuck: true, pocket: false }, { k: 'pants', color: '#3d4232', style: 'cargo', fab: 'camo' }, { k: 'shoes', style: 'boot', color: '#1a1814' },
        { k: 'vest', color: '#c9e234', fab: 'hivis', stripes: [{ at: 0.3, w: 0.07, color: '#c9ccc8' }, { at: 0.55, w: 0.07, color: '#c9ccc8' }], back: 'COMMS', backInk: '#1a1a1a', hem: 0.54 }],
      acc: [{ k: 'belt', color: '#2a2a24' }, { k: 'gloves', color: '#1a1a18' }, { k: 'helmet', color: '#454b36' }, { k: 'gas_mask' }, { k: 'radio', phi: 0.5 }] },
    // ---- Main cast ----------------------------------------------------------------------------------
    chase: { name: 'Chase', H: 1.83, sex: 'm', age: 44, named: true, tics: ['rub_palm', 'hand_on_pocket'], scar: true, stoop: 0.14,
      build: { sh: 1.12, ch: 1.04, wa: 1.0, musc: 0.3, arm: 1.05, leg: 1.04 },
      head: { jaw: 1.1, chin: 1.1, brow: 1.3, nose: 1.02, noseBump: 0.7, cheek: 1.12, lips: 0.9, hollow: 0.25, hairline: 0.073 },
      skin: '#c9946f', iris: '#5d7282', stubble: 0.7, greyStubble: 0.35, stubbleColor: '#3a2c22', rosy: 0.35, tired: 0.6, browThick: 1.1,
      hair: { style: 'messy', color: '#3a2c22', grey: 0.3 },
      outfit: [{ k: 'polo', color: FADED_CREAM, cut: true, fade: 0.25, dirt: 0.5, sweat: 0.6, logo: true, logoInk: 'rgba(40,36,30,0.45)', badge: false, loose: 1.1 },
        { k: 'pants', color: '#4d4b3e', style: 'cargo', fab: 'canvas', dirt: 0.7 }, { k: 'shoes', style: 'boot', color: '#3a2a1e', tape: true, tapeR: true, dirt: 0.8 },
        { k: 'jacket', color: '#8a7550', fab: 'canvas', dirt: 0.8, collar: '#5a4630', collarFab: 'twill', part: 'jacket' }],
      acc: [{ k: 'belt', color: '#2a1e16' }, { k: 'holster' }, { k: 'lanyard', text: 'CHASE — Senior Consultant — Ask me about upgrading!', worn: 1, beads: ['#f2f0e8', '#1c1c1c', '#e8c040', '#d83a3a', '#3a6ad8', '#f2f0e8', '#1c1c1c', '#e8c040', '#8a3ad8'], part: 'lanyard' }] },
    chloe: { name: 'Chloe', H: 1.6, sex: 'f', age: 18, named: true, tics: ['click_cutter', 'push_sweatband'], quick: true,
      build: { sh: 0.95, ch: 0.95, wa: 0.95, hi: 0.95, arm: 0.95, leg: 0.97, bust: 0.55 },
      head: { jaw: 0.9, chin: 0.94, nose: 0.82, noseW: 0.95, cheek: 1.02, lips: 1.05, eyeW: 0.0157, ipd: 0.06, hairline: 0.071 },
      skin: '#e8b996', iris: '#5a7a4a', freckles: 0.75, rosy: 0.75, browNick: 1, browThick: 0.85, browColor: '#4a2a18',
      hair: { style: 'ponytail', color: '#6b3a22', len: 0.2, seed: 21, temple: 0.012 },
      outfit: [{ k: 'polo', color: TRAINEE_YELLOW, loose: 1.55, hem: 0.47, logo: true, badge: 'CHLOE — TRAINEE — Still learning! Please be patient :)', badgeAt: -0.26 },
        { k: 'hoodie', color: '#4a5236', gap: 0.42, dirt: 0.5, hem: 0.505 }, { k: 'pants', color: '#3e5a7c', fab: 'denim', len: 0.9, roll: true, rollColor: '#7a94b0', taper: 0.4, dirt: 0.4 },
        { k: 'shoes', style: 'sneaker', color: '#d8d4cc', accent: '#9a3a3a', dirt: 0.9 }],
      acc: [{ k: 'sweatband', side: 'L' }, { k: 'backpack', color: '#4a4436', size: 1.12, plush: '#7ab8d8', part: 'backpack' }, { k: 'manual_pocket' }] },
    wai: { name: 'Wai', H: 1.72, sex: 'm', age: 45, named: true, tics: ['push_glasses'],
      build: { sh: 1.12, ch: 1.15, wa: 1.2, hi: 1.05, fat: 0.35, belly: 0.5, neck: 1.2, arm: 1.05, leg: 1.02 },
      head: { jaw: 1.08, chin: 0.95, width: 1.06, cranium: 1.03, nose: 0.95, noseW: 1.12, cheek: 1.05, full: 0.6, lips: 1.0, hairline: 0.075 },
      skin: '#c89468', iris: '#2e1e14', stubble: 0.35, rosy: 0.4, browThick: 1.0, browColor: '#1c1612', tilt: 0.1,
      hair: { style: 'buzz', color: '#1c1612' },
      outfit: [{ k: 'shirt', color: '#8a2c2c', fab: 'plaid', plaidA: 'rgba(20,20,50,0.4)', plaidB: 'rgba(240,230,200,0.2)', loose: 1.1 },
        { k: 'pants', color: '#2c3038', style: 'jeans', fab: 'denim' }, { k: 'shoes', style: 'boot', color: '#2a221c' },
        { k: 'vest', color: '#1e2a4a', fab: 'fleece', gap: 0.03, badge: 'WAI — Store Manager', text: 'yes' }],
      acc: [{ k: 'glasses', color: '#2a2622', tape: true }, { k: 'bumbag' }] },
    zane: { name: 'Zane', H: 1.88, sex: 'm', age: 28, named: true, tics: ['touch_headset'],
      build: { sh: 1.0, ch: 0.9, wa: 0.88, hi: 0.95, fat: -0.3, arm: 0.9, leg: 0.95, legLen: 1.03 },
      head: { jaw: 1.02, chin: 1.08, width: 0.93, nose: 1.1, noseBump: 0.3, cheek: 1.2, hollow: 1, lips: 0.85, hairline: 0.068 },
      skin: '#d4a488', iris: '#4a3a2a', stubble: 0.55, rosy: 0.25, tired: 0.7,
      hair: { style: 'messy', color: '#1e1814', len: 0.9 },
      outfit: [{ k: 'tee', color: '#34363a', loose: 1 }, { k: 'pants', color: '#1e1e22', fab: 'denim', taper: 0.4 }, { k: 'shoes', style: 'boot', color: '#1c1a18' },
        { k: 'jacket', color: '#4a5e7c', fab: 'denim', patchRect: true, patchColor: '#7189aa', hem: 0.54, collar: '#3a4c66' }],
      acc: [{ k: 'headset' }, { k: 'gloves', color: '#1a1a1a', fingerless: true }] },
    aidan: { name: 'Aidan', H: 1.7, sex: 'm', age: 16, named: true, child: true, tics: ['bounce'],
      build: { sh: 0.9, ch: 0.84, wa: 0.85, hi: 0.88, fat: -0.35, arm: 0.84, leg: 0.86, neck: 0.85, armLen: 1.04, legLen: 1.03 },
      head: { jaw: 0.9, chin: 0.95, nose: 0.95, noseW: 0.95, cheek: 0.95, lips: 1.05, ear: 1.12, ipd: 0.06 },
      skin: '#e2b08e', iris: '#4a3624', freckles: 0.15, rosy: 0.7, browThick: 0.85,
      hair: { style: 'curly', color: '#3a2618', len: 1.1 },
      outfit: [{ k: 'hoodie', color: '#3a6a70', loose: 1.9, hem: 0.47, print: 'OPTUS SPORT', ink: 'rgba(240,210,60,0.75)', fade: 0.3, dirt: 0.4 },
        { k: 'pants', color: '#8a8a88', style: 'tights', fab: 'knit' }, { k: 'shorts', color: '#6a6448', fab: 'canvas', over: true, len: 0.42 },
        { k: 'shoes', style: 'sneaker', color: '#4a4a52', accent: '#e8e4dc', tapeR: true, dirt: 0.8 }],
      acc: [{ k: 'cap', color: '#1a3a5a', text: 'yes', back: true, fade: 0.2 }, { k: 'pet' }] },
    luke: { name: 'Luke', H: 1.80, sex: 'm', age: 39, named: true, tics: ['adjust_cap'], tattoo: true,
      build: { sh: 1.0, ch: 1.02, wa: 1.1, fat: 0.3, belly: 0.35 },
      head: { jaw: 0.97, chin: 0.95, nose: 0.97, noseW: 1.08, cheek: 0.95, full: 0.55, lips: 1.02, hairline: 0.07 },
      skin: '#d9a888', iris: '#6a5234', stubble: 0.06, rosy: 0.75,
      hair: { style: 'tied_back', color: '#6a4a2c', grey: 0.15, len: 0.18 },
      outfit: [{ k: 'pants', color: '#3e3a32', style: 'cargo', fab: 'canvas' }, { k: 'jumper', color: '#b0764a', fab: 'knit' }, { k: 'shoes', style: 'boot', color: '#4a3424' }],
      acc: [{ k: 'cap', color: '#d9b830', text: 'yes', fade: 0.45, ink: '#1c1c1c' }] },
    // ---- Title characters ----------------------------------------------------------------------------
    operator: { name: 'The Operator', H: 1.78, sex: 'f', age: 56, tics: ['wind_cord'], upright: true,
      build: { sh: 1.02, ch: 1.0, wa: 1.02, hi: 0.95, bust: 0.5, arm: 0.95, leg: 1.02, legLen: 1.03 },
      head: { jaw: 1.0, chin: 1.05, width: 0.96, nose: 1.1, noseBump: 0.4, cheek: 1.15, hollow: 0.3, lips: 0.8, hairline: 0.07 },
      skin: '#e6c0a4', iris: '#6a7a8a', rosy: 0.4, tired: 0.4, browColor: '#8a8680', browThick: 0.7,
      hair: { style: 'bob', color: '#a8a6a2', grey: 0.9, part: 0.3, len: 0.95 },
      outfit: [{ k: 'shirt', color: '#d8d6d0', tuck: true, pocket: false }, { k: 'armour', color: '#2a2e2a' }, { k: 'cardigan', color: '#5a5650', outer: 1 },
        { k: 'pants', color: '#2c2c30', style: 'chinos' }, { k: 'shoes', style: 'boot', color: '#1c1a18' }],
      acc: [{ k: 'switchboard' }] },
    level3: { name: 'Level 3', H: 1.76, sex: 'm', age: 46, tics: ['clean_hands'], stoop: 0.3, hold: null,
      build: { sh: 0.96, ch: 0.96, wa: 1.05, fat: 0.1, belly: 0.2 },
      head: { jaw: 0.95, chin: 0.9, nose: 1.05, cheek: 0.95, hollow: 0.3, hairline: 0.08 },
      skin: '#d8b096', iris: '#5a4a38', stubble: 0.5, greyStubble: 0.3, tired: 1, rosy: 0.3,
      hair: { style: 'receding', color: '#4a3a2c', grey: 0.35 },
      outfit: [{ k: 'polo', color: '#2a3a52', tuck: false, logo: 'TECH SUPPORT', logoInk: 'rgba(220,220,210,0.8)' }, { k: 'scrubs', color: '#5a7a8a', blood: 0.5, loose: 1.3 },
        { k: 'pants', color: '#5a7a8a', fab: 'scrubs', bag: 1.4 }, { k: 'shoes', style: 'sneaker', color: '#d8d4cc' }],
      acc: [{ k: 'head_torch' }] },
    techsupport: { name: 'Tech Support', H: 1.91, sex: 'm', age: 57, tics: ['knock'],
      build: { sh: 1.0, ch: 0.88, wa: 0.88, hi: 0.92, fat: -0.35, arm: 0.92, leg: 0.95, legLen: 1.04, armLen: 1.04 },
      head: { jaw: 1.0, chin: 1.0, width: 0.94, nose: 1.18, noseBump: 0.8, cheek: 1.2, hollow: 1, brow: 1.3, lips: 0.8, hairline: 0.085 },
      skin: '#d4a488', iris: '#6a7a6a', stubble: 0.2, greyStubble: 0.9, tired: 0.8, rosy: 0.6, browColor: '#b8b4ac', browThick: 1.3,
      hair: { style: 'receding', color: '#b0aca4', grey: 0.95, len: 1.3 }, beard: { style: 'big', color: '#aeaaa2', grey: 0.95, len: 1.1 },
      outfit: [{ k: 'shirt', color: '#5a5448', fab: 'canvas', loose: 1.1 }, { k: 'pants', color: '#3a3a36', style: 'cargo', fab: 'canvas', dirt: 0.6 },
        { k: 'vest', color: '#d8762a', fab: 'hivis', fade: 0.45, dirt: 0.7, stripes: [{ at: 0.35, w: 0.07, color: '#b8bab4' }, { at: 0.6, w: 0.07, color: '#b8bab4' }] },
        { k: 'shoes', style: 'boot', color: '#2a2018' }],
      acc: [{ k: 'goggles' }, { k: 'toolbelt' }] },
    closer: { name: 'The Closer', H: 1.79, sex: 'm', age: 46, emote: 'smile', tics: ['wave'],
      build: { sh: 1.15, ch: 1.2, wa: 1.35, hi: 1.15, fat: 0.6, belly: 0.9, neck: 1.25, arm: 1.12, leg: 1.1 },
      head: { jaw: 1.15, chin: 0.9, width: 1.1, nose: 1.05, noseW: 1.2, cheek: 1.0, full: 1, lips: 1.1, mouthW: 0.028, hairline: 0.075 },
      skin: '#e2a888', iris: '#3a5a7a', stubble: 0.35, rosy: 1, decals: ['sweat'],
      hair: { style: 'comb', color: '#5a3e28' },
      outfit: [{ k: 'shirt', color: '#dfe6ee', tuck: true, sweat: 1, dirt: 0.5 }, { k: 'pants', color: '#3a3c44', style: 'chinos' }, { k: 'shoes', style: 'dress', color: '#2a1e16' }],
      acc: [{ k: 'belt', color: '#1a1410' }, { k: 'tie_headband', color: '#a8242a' }, { k: 'lanyard', text: 'THE CLOSER — Team Leader', h: 0.69 }] },
    regional: { name: 'The Regional', H: 1.76, sex: 'm', age: 55, tics: ['steeple'],
      build: { sh: 0.98, ch: 1.0, wa: 1.12, hi: 1.05, fat: 0.3, belly: 0.35 },
      head: { jaw: 0.95, chin: 0.95, nose: 1.0, noseW: 1.0, cheek: 0.95, full: 0.5, lips: 0.9, hairline: 0.068 },
      skin: '#e8c0a4', iris: '#7a8a9a', rosy: 0.6, stubble: 0.05,
      hair: { style: 'side_part', color: '#b4b0a8', grey: 0.85, part: 0.35, len: 0.8 },
      outfit: [{ k: 'shirt', color: '#c8d8e8', tuck: true, pocket: false }, { k: 'pants', color: '#c8b88e', style: 'chinos' }, { k: 'shoes', style: 'dress', color: '#4a3424' },
        { k: 'vest', color: '#23324a', fab: 'fleece', text: 'REGIONAL\nLEADERSHIP\nOFFSITE' }],
      acc: [{ k: 'belt', color: '#3a2618' }, { k: 'glasses', cord: true, color: '#8a6a3a' }, { k: 'lanyard', text: 'KEY CARD — Regional', h: 0.66 }] },
    wholesaler: { name: 'Wholesaler', H: 1.74, sex: 'm', age: 50, emote: 'smile', decals: ['sweat'],
      build: { sh: 1.05, ch: 1.1, wa: 1.3, hi: 1.12, fat: 0.55, belly: 0.8, neck: 1.2 },
      head: { jaw: 1.05, chin: 0.85, nose: 1.1, noseW: 1.15, full: 0.9, lips: 1.05, hairline: 0.08 },
      skin: '#dca888', iris: '#4a3a2a', stubble: 0.4, rosy: 1.1,
      hair: { style: 'receding', color: '#3a2c20' },
      outfit: [{ k: 'shirt', color: '#2a7a8a', fab: 'hawaii', loose: 1.25, sleeve: 0.28, open: true, sweat: 1 }, { k: 'pants', color: '#c8bc98', style: 'chinos', bag: 1.2 }, { k: 'shoes', style: 'sandal', color: '#5a4030' }],
      acc: [{ k: 'watch', color: '#c8a040' }] },
    facilitator: { name: 'The Facilitator', H: 1.79, sex: 'm', age: 31, hold: 'rifle',
      build: { sh: 1.04, ch: 1.0, musc: 0.2 }, head: { jaw: 1.05, chin: 1.0, nose: 1.0, cheek: 1.05 },
      skin: '#e0b494', iris: '#4a5a6a', stubble: 0.4, rosy: 0.8,
      hair: { style: 'short', color: '#8a6a44' },
      outfit: [{ k: 'jumper', color: '#6a6a60', fab: 'knit' }, { k: 'pants', color: '#3a3e44', style: 'cargo' }, { k: 'shoes', style: 'boot', color: '#2a2420' },
        { k: 'puffer', color: '#2e3a30', sleeve: 1 }],
      acc: [{ k: 'beanie', color: '#4a4034' }, { k: 'lanyard', text: 'FACILITATOR — Team Culture', h: 0.66 }] },
    chef: { name: 'The Chef', H: 1.84, sex: 'm', age: 48,
      build: { sh: 1.15, ch: 1.1, wa: 1.25, fat: 0.5, belly: 0.6, arm: 1.12, neck: 1.15 },
      head: { jaw: 1.12, chin: 0.95, width: 1.05, nose: 1.1, noseW: 1.2, full: 0.7, hairline: 0.09 },
      skin: '#e4b498', iris: '#3a3028', stubble: 0.6, rosy: 1,
      hair: { style: 'buzz', color: '#6a5a4a' },
      outfit: [{ k: 'tee', color: '#d8d6d0', sleeve: 0.24, dirt: 0.5 }, { k: 'pants', color: '#2a2a2c', style: 'chinos', bag: 1.2 }, { k: 'shoes', style: 'boot', color: '#1a1818' },
        { k: 'apron', color: '#e2ddd2', dirt: 0.8, blood: 0.6 }] },
    lukes_wife: { name: "Luke's wife", H: 1.66, sex: 'f', age: 38, tics: [],
      build: { sh: 0.98, ch: 1.0, hi: 1.02, bust: 0.7 },
      head: { jaw: 0.9, chin: 0.95, nose: 0.92, cheek: 1.08, lips: 1.05, hairline: 0.066 },
      skin: '#b87a56', iris: '#3a2618', rosy: 0.5,
      hair: { style: 'buns', color: '#1c1410', seed: 5 },
      outfit: [{ k: 'shirt', color: '#5a7a5a', fab: 'plaid', plaidA: 'rgba(20,30,20,0.35)', plaidB: 'rgba(240,230,210,0.2)', sleeve: 0.62 }, { k: 'pants', color: '#3a4a64', fab: 'denim' },
        { k: 'cardigan', color: '#c8b89a' }, { k: 'shoes', style: 'boot', color: '#5a3e2a' }] },
    man: { name: 'Man', H: 1.8, sex: 'm', age: 38,
      build: { sh: 1.05, ch: 1.02, wa: 1.05, fat: 0.15 }, head: { jaw: 1.05, nose: 1.05 },
      skin: '#d9a888', iris: '#5a4a3a', stubble: 0.5, rosy: 0.8,
      hair: { style: 'short', color: '#4a3524' },
      outfit: [{ k: 'polo', color: '#6a8aa8', logo: false }, { k: 'pants', color: '#b0a484', style: 'chinos' }, { k: 'shoes', style: 'sneaker', color: '#e8e4dc' }],
      acc: [{ k: 'lanyard', text: 'ENERGY SAVINGS — Field Rep', h: 0.69 }] },
    // ---- Minor roles (seeded from a shared kit) -------------------------------------------------------
    crowd: { gen: (R, s) => CharKit.civ(R, { launch: true }) },
    human: { gen: (R, s) => CharKit.civ(R, {}) },
    townsperson: { gen: (R, s) => CharKit.civ(R, { country: true }) },
    kid: { gen: (R, s) => CharKit.civ(R, { kid: true }) },
    landline: { gen: (R, s) => CharKit.faction(R, 'landline') },
    doorknocker: { gen: (R, s) => CharKit.faction(R, 'doorknocker') },
    retreat: { gen: (R, s) => CharKit.faction(R, 'retreat') },
    smuggler: { gen: (R, s) => CharKit.faction(R, 'smuggler') },
    bandit: { gen: (R, s) => CharKit.faction(R, 'bandit') },
    // ---- Infected -------------------------------------------------------------------------------------
    scroller: { gen: (R, s) => Object.assign(CharKit.civ(R, { worn: 1 }), { inf: 'scroller' }) },
    lurker: { gen: (R, s) => Object.assign(CharKit.civ(R, { worn: 2 }), { inf: 'lurker' }) },
    clicker: { gen: (R, s) => Object.assign(CharKit.civ(R, { worn: 3 }), { inf: 'clicker' }) },
    bloatware: { gen: (R, s) => Object.assign(CharKit.civ(R, { worn: 3, big: true }), { inf: 'bloatware' }) },
    // ---- Animals (built by 168_quad; same Character API) ---------------------------------------------
    horse: { name: 'Horse', quad: true },
    deer: { name: 'Deer', quad: true },
  };
  // chloe_winter: puffer over everything, beanie, the bow slung across her back
  defs.chloe_winter = Object.assign({}, defs.chloe, {
    outfit: [...defs.chloe.outfit.map(g => g.k === 'hoodie' ? Object.assign({}, g, { gap: 0 }) : g), { k: 'puffer', color: '#7a2e2e', sleeve: 1, hem: 0.49, outer: 2 }],
    acc: [{ k: 'beanie', color: '#d8c8a0', pom: '#e8dcc0' }, { k: 'sweatband', side: 'L' }, { k: 'backpack', color: '#4a4436', size: 1.12, plush: '#7ab8d8', part: 'backpack' }, { k: 'pet', neck: true }],
    slung: 'bow', tics: ['click_cutter'] });
  // variants override outfit/look bits of a def (Chars.create(id, {variant}) or c.outfit(variant))
  const VARIANTS = {
    chase: { shirt: { parts: { jacket: false } } },
    chloe: {
      pyjamas: l => Object.assign({}, l, { hair: Object.assign({}, l.hair, { style: 'long', len: 0.9, color: '#4a2818' }), decals: ['wet'],
        outfit: [{ k: 'tee', color: '#8a9ab0', loose: 1.4, sleeve: 0.46 }, { k: 'pants', color: '#b8a8c8', fab: 'plaid', plaidA: 'rgba(60,40,80,0.3)', bag: 1.3 }, { k: 'shoes', style: 'sock', color: '#d8d4cc' }],
        acc: [{ k: 'sweatband', side: 'L' }] }),
      pet: l => Object.assign({}, l, { acc: [...l.acc, { k: 'pet', neck: true }] }),
    },
    operator: { wounded: l => Object.assign({}, l, { outfit: l.outfit.map(g => g.k === 'cardigan' ? Object.assign({}, g, { blood: 1 }) : g) }) },
    wai: { bruised: { decals: ['bruise'] } },
  };

  function resolveLook(defId, o) {
    const def = defs[defId] || defs.crowd || null;
    const seed = o.seed ?? (def && def.gen ? seedCounter++ : 1);
    let look = Object.assign({}, def);
    if (def && def.gen) Object.assign(look, def.gen(CharPaint.rng(seed * 7919 + 17), seed));
    const v = o.variant && VARIANTS[defId] && VARIANTS[defId][o.variant];
    if (v) look = Object.assign({}, look, typeof v === 'function' ? v(look) : v);
    look.seed = seed;
    look.key = defId + ':' + (def && def.gen ? seed : '') + ':' + (o.variant || '');
    look.atlas = look.atlas || (look.named ? 1024 : 512);
    look.faceRes = look.faceRes || (look.named ? 512 : def && def.gen ? 256 : 512);
    look.fem = look.fem ?? (look.sex === 'f' ? 1 : 0);
    if (look.hair && look.head && look.head.hairline != null && look.hair.line == null) look.hair = Object.assign({}, look.hair, { line: look.head.hairline });
    return look;
  }

  // ---------------------------------------------------------------------------------------------
  const POINT = { head: ['head', [0, 0.1, 0.03]], eyes: ['head', [0, 0.037, 0.08]], chest: ['chest', [0, 0.08, 0.1]], hips: ['hips', [0, 0, 0]],
    hand_l: ['handL', [0, -0.07, 0]], hand_r: ['handR', [0, -0.07, 0]], shoulder_l: ['upperArmL', [0, 0.03, 0]], shoulder_r: ['upperArmR', [0, 0.03, 0]], badge: ['chest', [-0.08, 0.1, 0.12]] };
  const SPEED = { walk: 1.4, jog: 3, run: 5.5 };

  function resolvePt(p, out = new V3()) {
    if (p == null) return null;
    if (p.isVector3) return out.copy(p);
    if (Array.isArray(p)) return out.set(p[0], p[1] ?? 0, p[2] ?? 0);
    if (typeof p === 'string') { const m = Game.G.marker(p); return m ? out.copy(m.pos) : null; }
    if (p.root) return out.copy(p.root.position);
    if (p.pos) return out.copy(p.pos);
    return null;
  }

  function create(defId, o = {}) {
    if (Quad.kinds[defId]) { const q = Object.assign(Quad.create(defId, o), API, Quad.API, { def: { id: defId } }); all.push(q); return q; }
    const look = resolveLook(defId, o);
    if (look.inf) CharInf.prep(look);
    const B = CharBody.build(look);
    const at = B.atlas;
    at.paint();
    const bodyMat = CharPaint.bodyMaterial(at);
    B.body.material = bodyMat;
    const face = CharFace.create(B, look);
    if (B.head) B.head.material = face.mat;
    const root = B.root;
    root.name = 'char:' + (o.name || defId);
    Engine.scene.add(root);
    const bindPos = {}; for (const k in B.bones) bindPos[k] = B.bones[k].position.clone();
    const def = Object.assign({ id: defId }, defs[defId] || {});
    const c = {
      name: o.name || defId, def, root, bones: B.bones, B, D: B.D, look, face, bodyMat, bindPos,
      height: B.D.headO.y + 0.122 * B.D.hs, speaking: false, persistent: false,
      P: Anim.pose(), B0: Float32Array.from(Anim.P0), basePose: Anim.POSES.stand, poseName: 'stand', poseBlend: { from: Float32Array.from(Anim.P0), t: 1, dur: 0.5, resolve: null },
      loco: { v: 0, target: 0, phase: 0, dir: new V3(0, 0, 1), crouch: false, carry: false, limp: false, crouchW: 0, carryW: 0, limpW: 0, turnRate: 0, moveW: 0 },
      idle: { breath: 0.25, bph: Math.random(), wt: 2 + Math.random() * 3, w: 0, wTarget: 0, seed: Math.random() * 10 },
      look: { target: null, yaw: 0, pitch: 0 }, gaze: { x: 0, y: 0 }, lookW: 0,
      t: Math.random() * 100, mv: null, turn: null, gest: null, fidget: null, heldP: {}, grip: {}, springs: [], pair: null, pairOf: null,
      parts: Object.assign({}, look.parts || {}), badgeObj: null, glow: null, infected: look.inf || null, idleT: 0,
      get yaw() { return root.rotation.y; }, set yaw(v) { root.rotation.y = v; },
    };
    Object.assign(c, API);
    setupSprings(c);
    if (look.inf) CharInf.attach(c);
    if (look.hold) c.hold(look.hold, 'r');
    if (look.slung) { const p = CharProps.P[look.slung](); p.position.set(0.02 * c.D.s, 0.02 * c.D.s, -0.2 * c.D.s); p.rotation.set(-Math.PI / 2 + 0.1, 0.7, 0); c.bones.chest.add(p); c.slung = p; }
    for (const d of look.decals || []) if (d === 'grime' || d === 'blood_knuckles') CharProps.bodyDecal(c, d, true);
    if (look.pose) { c.basePose = Anim.POSES[look.pose]; c.poseName = look.pose; c.poseBlend.from = Float32Array.from(c.basePose.p); }
    if (look.emote) CharFace.emote(face, look.emote);
    all.push(c);
    return c;
  }

  function setupSprings(c) {
    const B = c.bones, look = c.look, h = look.hair || {};
    const sp = (bone, rest, o) => c.springs.push(Object.assign({ bone, rest: rest.clone().normalize(), dir: rest.clone().normalize(), dv: new V3(), k: 60, damp: 6, grav: 0.5, inertia: 0.004 }, o));
    if (h.style === 'ponytail' || h.style === 'tied_back') {
      const d0 = new V3().subVectors(c.B.J.hair1, c.B.J.hair0), d1 = new V3().subVectors(c.B.J.hair2, c.B.J.hair1);
      sp(B.hair0, d0, { k: 70, damp: 7, grav: 0.35, inertia: 0.006 }); sp(B.hair1, d1, { k: 50, damp: 5, grav: 0.7, inertia: 0.008 });
    }
    if (h.style === 'ponytail') { sp(B.strandL, new V3(0, -1, 0.1), { k: 40, damp: 5, grav: 0.8, inertia: 0.003 }); sp(B.strandR, new V3(0, -1, 0.1), { k: 40, damp: 5, grav: 0.8, inertia: 0.003 }); }
    if (look.coat) for (const n of ['coatL', 'coatR', 'coatB']) sp(B[n], new V3(0, -1, 0), { k: 90, damp: 8, grav: 0.2, inertia: 0.0025 });
  }

  // ---------------------------------------------------------------------------------------------
  const _t = new V3();
  const API = {
    point(name, out = new V3()) {
      if (name === 'feet') return out.copy(this.root.position);
      const p = POINT[name] || POINT.head;
      const b = this.bones[p[0]];
      b.updateWorldMatrix(true, false);
      const s = name === 'head' || name === 'eyes' ? this.D.hs : this.D.s;
      return out.set(p[1][0] * s, p[1][1] * s, p[1][2] * s).applyMatrix4(b.matrixWorld);
    },
    setMove(speed, o = {}) {
      const L = this.loco;
      L.target = Math.max(0, speed); L.crouch = !!o.crouch; L.carry = !!o.carry; L.limp = !!o.limp;
      if (o.strafe) L.dir.set(o.strafe[0], 0, o.strafe[1]).normalize(); else L.dir.set(0, 0, 1);
    },
    walkTo(target, o = {}) {
      this.stopMove();
      const pts = [...(o.path || []), ...(target != null ? [target] : [])].map(p => resolvePt(p)).filter(Boolean);
      if (!pts.length) return Promise.resolve();
      const speed = typeof o.speed === 'string' ? SPEED[o.speed] || 1.4 : o.speed ?? 1.4;
      return new Promise(res => { this.mv = { pts, i: 0, speed, stop: o.stopDist ?? 0.1, face: o.face, res }; });
    },
    turnTo(to, dur = 0.5) {
      if (this.turn) { const r = this.turn.res; this.turn = null; r(); }
      let y;
      if (typeof to === 'number') y = to;
      else { const p = to && to.root ? to.root.position : resolvePt(to, _t); if (!p) return Promise.resolve(); y = Math.atan2(p.x - this.root.position.x, p.z - this.root.position.z); }
      const from = this.root.rotation.y, d = U.wrapAngle(y - from);
      if (Math.abs(d) < 0.01) return Promise.resolve();
      return new Promise(res => { this.turn = { from, d, t: 0, dur: Math.max(0.05, dur), res }; });
    },
    stopMove() { if (this.mv) { const r = this.mv.res; this.mv = null; r(); } },
    stop() {
      this.stopMove();
      if (this.turn) { const r = this.turn.res; this.turn = null; r(); }
      this.loco.target = 0; this.loco.v = 0;
      this.loco.lastYaw = this.root.rotation.y;
      for (const s of this.springs) s.last = null;
    },
    lookAt(t) { this.look.target = t || null; },
    emote(name, dur) { CharFace.emote(this.face, name, dur); },
    speak(text, dur) { CharFace.speak(this.face, text, dur); this.speaking = true; this.idleT = 0; },
    blink() { CharFace.blink(this.face); },
    pose(name, o = {}) { return Gest.pose(this, name, o); },
    gesture(name, o = {}) { return Gest.gesture(this, name, o); },
    anim(name, o = {}) {
      if (name === 'die') return Gest.pose(this, 'dead', o);
      return Anim.POSES[name] ? Gest.pose(this, name, o) : Gest.gesture(this, name, o);
    },
    hold(prop, hand = 'r', o = {}) { return CharProps.hold(this, prop, hand, o); },
    held(hand = 'r') { return this.heldP[hand] || null; },
    drop(hand = 'r', o = {}) { return CharProps.drop(this, hand, o); },
    attach(other, mode, o = {}) { Gest.attach(this, other, mode, o); },
    detach() { Gest.detach(this); },
    setVisible(v) { this.root.visible = v; },
    decal(kind, on = true) {
      if (kind === 'blood_knuckles' || kind === 'grime') CharProps.bodyDecal(this, kind, on);
      if (kind !== 'blood_knuckles') CharFace.decal(this.face, kind === 'feed_eyes' ? 'feed' : kind, on);
    },
    badge(value, where = 'forearm_l') { CharProps.badge(this, value, where); },
    phoneGlow(on, o = {}) { CharProps.phoneGlow(this, on, o); },
    // appearance lives in this.B.look (this.look is the gaze state)
    setPart(name, state) { this.parts[name] = state; CharBody.rebuild(this.B, Object.assign({}, this.B.look, { parts: Object.assign({}, this.parts) })); this.B.atlas.paint(); },
    outfit(variant) {
      const look = Object.assign(resolveLook(this.def.id, { seed: this.B.look.seed, variant }), { parts: Object.assign({}, this.parts) });
      this.B.atlas = CharPaint.atlas(look, this.D);
      CharBody.rebuild(this.B, look); this.B.atlas.paint();
      this.bodyMat.map = this.B.atlas.tex; this.bodyMat.needsUpdate = true;
    },
    dispose() {
      Gest.detach(this); if (this.pairOf) Gest.detach(this.pairOf);
      for (const h of ['r', 'l']) if (this.heldP[h]) CharProps.drop(this, h, { remove: true });
      CharProps.badge(this, null);
      CharProps.phoneGlow(this, false);
      this.stop();
      if (this.root.parent) this.root.parent.remove(this.root);
      CharBody.dispose(this.B); this.bodyMat.dispose(); CharFace.dispose(this.face);
      if (this.glowMesh) this.glowMesh.geometry.dispose();
      const i = all.indexOf(this); if (i >= 0) all.splice(i, 1);
    },
    update(dt) {
      this.t += dt;
      moveUpdate(this, dt);
      if (this.quad) return;
      this.speaking = this.face.speaking;
      // idle tics when nothing else is going on (outside cutscenes)
      if (!this.gest && !this.speaking && this.loco.v < 0.05 && this.basePose === Anim.POSES.stand && this.def.tics && !Director.active) {
        this.idleT += dt;
        if (this.idleT > (this.nextTic || (this.nextTic = 9 + Math.random() * 10))) { this.idleT = 0; this.nextTic = 12 + Math.random() * 14; Gest.gesture(this, this.def.tics[(Math.random() * this.def.tics.length) | 0], {}); }
      } else this.idleT = 0;
    },
  };

  // scripted walk/turn
  function moveUpdate(c, dt) {
    const r = c.root;
    if (c.turn) {
      const T = c.turn; T.t += dt;
      const k = clamp(T.t / T.dur, 0, 1), e = k * k * (3 - 2 * k);
      r.rotation.y = T.from + T.d * e;
      if (k >= 1) { c.turn = null; T.res(); }
    }
    const M = c.mv;
    if (!M) return;
    const p = r.position, wp = M.pts[M.i];
    const dx = wp.x - p.x, dz = wp.z - p.z, dist = Math.hypot(dx, dz);
    const last = M.i === M.pts.length - 1;
    if (dist < (last ? M.stop : Math.max(0.4, M.speed * 0.35))) {
      if (!last) { M.i++; return; }
      c.mv = null; c.loco.target = 0;
      if (M.face != null && M.face !== false && M.face !== true) c.turnTo(M.face, 0.5).then(M.res);
      else M.res();
      return;
    }
    const want = Math.atan2(dx, dz), err = U.wrapAngle(want - r.rotation.y);
    const turnRate = M.speed > 3 ? 3.2 : 4.5;
    r.rotation.y += clamp(err, -turnRate * dt, turnRate * dt);
    let remain = dist; for (let i = M.i + 1; i < M.pts.length; i++) remain += M.pts[i].distanceTo(M.pts[i - 1]);
    const arrive = clamp(remain / Math.max(0.6, M.speed * 0.5), 0.25, 1);
    const facing = clamp(1 - (Math.abs(err) - 0.6) / 0.9, 0, 1);
    c.loco.target = M.speed * arrive * facing; c.loco.dir.set(0, 0, 1);
    const step = Math.min(c.loco.v * dt, dist);
    p.x += Math.sin(r.rotation.y) * step; p.z += Math.cos(r.rotation.y) * step;
    const g = World.groundAt(p.x, p.z, p.y + 0.5, 0.1);
    p.y = lerp(p.y, g, 1 - Math.exp(-12 * dt));
  }

  // ---------------------------------------------------------------------------------------------
  const _cam = new V3();
  function update(dt) {
    Engine.camera.getWorldPosition(_cam);
    CharProps.tick(dt); CharInf.tick(dt); CharFace.frame();
    for (const c of all) {
      if (!c.root.visible) continue;
      c.update(dt);
      if (c.quad) { Quad.frame(c, dt); continue; }
      const d = _cam.distanceTo(c.root.position);
      c.lod = d < 9 ? 0 : d < 30 ? 1 : 2;
      c.skip = c.lod === 2 ? (c.skip || 0) + 1 : 0;
      if (c.lod === 2 && c.skip % 3) { c.frozen = true; continue; }
      c.frozen = false;
      Anim.frame(c, dt);
    }
    for (const c of all) if (c.pair && c.root.visible && !c.frozen) Gest.pairUpdate(c, dt);
    for (const c of all) {
      if (!c.root.visible || c.quad || c.frozen) continue;
      c.root.updateMatrixWorld(true);
      Gest.post(c, dt);
      if (c.lod < 2) Anim.springs(c, dt);
      CharFace.update(c.face, dt, c.gaze, c.lod);
      CharProps.update(c, dt);
    }
  }

  function preload() {
    const ids = ['chase_young', 'luke_young', 'bub', 'customer', 'security_guard', 'neighbour', 'soldier'].filter(id => defs[id]);
    return ids.map(id => () => { const look = resolveLook(id, {}); const B = CharBody.build(look); B.atlas.paint(); CharBody.dispose(B); });
  }

  return { defs, VARIANTS, create, update, all, preload, get props() { return CharProps.names; }, resolveLook, COLORS: { POLO_YELLOW, TRAINEE_YELLOW, FADED_CREAM } };
})();
