// ============================================================================
// Dev: cinema test bench (?dev&test=cinema[&from=2|3]). A launch-night car park outside a phone store,
// and three scenes that exercise every camera type, blend, cue and action of the Director, then
// hand control back for a walk-and-talk (interrupted and resumed), a bark and an optional
// conversation ("e – talk" follows Chloe). Owned by: cinema agent.
// Camera positions are { of: 'mk_set', off: [x right, y up, z toward the store] }.
// ============================================================================
CONTENT.levels.CINEMA = {
  name: 'Cinema bench', origin: [-9000, 0, 0], grade: 'launch_night', amb: 'store_night', surface: 'concrete',
  fog: { color: 0x0a0d16, near: 14, far: 70 }, background: 0x06080e,
  env: { top: 0x0a1222, horizon: 0x1a1a22, bottom: 0x060606, intensity: 0.25 },
  build(A) {
    const box = (w, h, d, mat, pos, o = {}) => Build.box(w, h, d, mat, Object.assign({ pos }, o));
    const asphalt = Tex.mat('asphalt', { color: 0x46464c, repeat: [14, 14], rough: 0.9 });
    const paving = Tex.mat('concrete', { color: 0x8c8882, repeat: [10, 2] });
    const render = Tex.mat('render', { color: 0x76706a, repeat: [4, 2] });
    const dark = Tex.color(0x1a1c20, { rough: 0.5, metal: 0.4 });
    const glass = Tex.color(0x0e1218, { emissive: 0xb8ccf0, emissiveIntensity: 0.3, rough: 0.2 });
    const yellow = new THREE.MeshStandardMaterial({ color: 0x3a3000, emissive: 0xffd400, emissiveIntensity: 0.55 });   // own copy: the sign flickers
    const paint = Tex.color(0xd8d2a8, { rough: 0.7 });
    Build.hemi({ sky: 0x2a3450, ground: 0x0c0a08, intensity: 0.4 });
    Build.sun({ dir: [0.35, -1, 0.6], color: 0x9fb2e6, intensity: 0.55, area: 18 });
    Build.plane(70, 70, asphalt, { pos: [0, 0, 0] });
    for (let i = -3; i <= 3; i++) Build.plane(0.12, 4.6, paint, { pos: [i * 2.6, 0.004, 3.2] });
    box(26, 0.02, 3.4, paving, [0, 0, -6.6]);
    box(26, 0.12, 0.25, Tex.color(0x9a948c), [0, 0, -4.8], { solid: false });
    // the store: render walls, glowing shopfront, yellow sign band
    box(17, 5.4, 9, render, [0, 0, -12.8]);
    box(11.2, 2.7, 0.08, glass, [-1.2, 0.3, -8.26], { solid: false });
    for (let x = -6.6; x <= 4.3; x += 2.2) box(0.12, 2.9, 0.16, dark, [x, 0.2, -8.2], { solid: false });
    box(1.9, 2.7, 0.1, Tex.color(0x0b0e12, { emissive: 0x7f96c0, emissiveIntensity: 0.6 }), [6.1, 0.1, -8.24], { solid: false });
    box(17, 1.15, 0.35, yellow, [0, 3.3, -8.15], { solid: false });
    const fascia = Tex.sign('shopfront', 'NUNDAH');
    const fasciaMat = new THREE.MeshStandardMaterial({ map: fascia, emissiveMap: fascia, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.5 });
    Build.mesh(new THREE.PlaneGeometry(4.6, 1.15), fasciaMat, { pos: [0, 3.875, -7.96], shadow: false, receive: false });
    const vinyl = (tex, w, h, pos) => Build.mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.6, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.35 }), { pos, shadow: false, receive: false });
    vinyl(Tex.sign('banner', 'MIDNIGHT LAUNCH — BE FIRST'), 3.4, 0.85, [-2.2, 2.45, -8.18]);
    vinyl(Tex.poster('promo_upgrade'), 0.85, 1.2, [2.9, 1.25, -8.18]);
    A.data.signMats = [yellow, fasciaMat]; A.data.sign = Build.light('point', { pos: [0, 3.2, -6.8], color: 0xffcf40, intensity: 3, distance: 9 });
    Build.light('point', { pos: [-4, 1.8, -6.9], color: 0xcfe0ff, intensity: 3, distance: 10 });
    Build.light('point', { pos: [2.5, 1.8, -6.9], color: 0xcfe0ff, intensity: 3, distance: 10 });
    // sodium streetlight: the warm key on the pavement against the cool shopfront
    Build.mesh(new THREE.CylinderGeometry(0.07, 0.1, 6, 10), dark, { pos: [3.8, 3, -3.9] });
    box(1.4, 0.12, 0.2, dark, [3.2, 5.9, -3.9], { solid: false });
    box(0.5, 0.1, 0.3, Tex.color(0x201810, { emissive: 0xffa860, emissiveIntensity: 3 }), [2.7, 5.8, -3.9], { solid: false });
    Build.light('spot', { pos: [2.7, 5.7, -3.9], target: [0.6, 0, -5.4], color: 0xffa050, intensity: 70, distance: 16, angle: 0.8, penumbra: 0.8 });
    // parked hatch
    const car = Build.group({ pos: [4.6, 0, 4.2], yaw: 0.12 });
    box(4.1, 0.75, 1.8, Tex.color(0x7a1c18, { rough: 0.35, metal: 0.5 }), [0, 0.3, 0], { parent: car });
    box(2.3, 0.6, 1.6, Tex.color(0x101418, { rough: 0.1, metal: 0.6 }), [-0.2, 1.05, 0], { parent: car, solid: false });
    const wheel = new THREE.CylinderGeometry(0.33, 0.33, 0.22, 16).rotateX(Math.PI / 2);
    for (const [x, z] of [[-1.3, -0.9], [1.3, -0.9], [-1.3, 0.9], [1.3, 0.9]]) Build.mesh(wheel, dark, { pos: [x, 0.33, z], parent: car });
    for (const z of [-0.6, 0.6]) box(0.05, 0.14, 0.3, Tex.color(0x300000, { emissive: 0xff2010, emissiveIntensity: 1.6 }), [-2.07, 0.75, z], { parent: car, solid: false });
    // patrol ute idling in the car park, headlights on the shopfront (rim light for CINE.3)
    const ute = Build.group({ pos: [-3.2, 0, 11], yaw: Math.PI - 0.15 });
    box(2, 0.9, 4.6, Tex.color(0x3c4436, { rough: 0.5, metal: 0.3 }), [0, 0.35, 0], { parent: ute });
    box(1.8, 0.7, 1.8, Tex.color(0x0c0e10, { rough: 0.1, metal: 0.6 }), [0, 1.25, 0.5], { parent: ute, solid: false });
    for (const x of [-0.7, 0.7]) box(0.32, 0.16, 0.05, Tex.color(0x303030, { emissive: 0xfff2d8, emissiveIntensity: 4 }), [x, 0.85, 2.31], { parent: ute, solid: false });
    Build.light('spot', { pos: [-3.1, 0.9, 8.8], target: [-0.8, 0.6, -4], color: 0xfff0dc, intensity: 60, distance: 30, angle: 0.35, penumbra: 0.5 });
    // bench, bollards, bin
    box(1.8, 0.07, 0.45, Tex.mat('wood', { color: 0x6a4a30 }), [-4.6, 0.44, -6.2], { solid: false });
    box(1.8, 0.4, 0.06, Tex.mat('wood', { color: 0x6a4a30 }), [-4.6, 0.55, -6.44], { solid: false });
    for (const x of [-5.3, -3.9]) box(0.08, 0.44, 0.4, dark, [x, 0, -6.2]);
    const bollard = new THREE.CylinderGeometry(0.11, 0.13, 0.9, 10);
    for (let x = -9; x <= 9; x += 3) Build.mesh(bollard, Tex.color(0xb8b0a0), { pos: [x, 0.45, -4.95] });
    Build.mesh(new THREE.CylinderGeometry(0.3, 0.26, 0.95, 12), Tex.color(0x2c4a2c, { rough: 0.6 }), { pos: [-7.2, 0.47, -6.8] });
    // skyline behind: dark blocks with a few lit windows (bokeh in the background)
    const win = Tex.color(0x101010, { emissive: 0xffc890, emissiveIntensity: 1.4 });
    for (let i = 0; i < 7; i++) {
      const x = -30 + i * 10, h = 8 + (i * 37 % 9);
      box(8, h, 6, Tex.color(0x15171d), [x, 0, -30 - (i % 3) * 5]);
      for (let k = 0; k < 4; k++) if ((i + k) % 3) box(1, 0.7, 0.05, win, [x - 2.5 + k * 1.7, 2 + ((i * 3 + k * 5) % (h - 3)), -27 - (i % 3) * 5 + 0.02], { solid: false });
    }
    A.marker('mk_set', [0, 0, -5.5], Math.PI);
    A.marker('mk_start', [1.2, 0, 6.5], Math.PI + 0.15);
    A.marker('mk_meet', [0.4, 0, -4.5], Math.PI);
    A.marker('mk_wai', [-1.5, 0, -6.3], 0.45);
    A.marker('mk_chloe', [2.0, 0, -6.7], -0.55);
    A.marker('mk_c2', [0.5, 0, -5.1], Math.atan2(1.2, -0.9));
    A.marker('mk_k2', [1.7, 0, -6.0], Math.atan2(-1.2, 0.9));
    A.marker('mk_bench', [-4.6, 0, -6.05], 0);
    A.marker('mk_benchside', [-3.5, 0, -5.4], -0.6);
    A.marker('mk_soldier', [-1.3, 0, 1.2], Math.PI - 0.15);
    A.marker('mk_car', [4.6, 0.6, 4.2], 0);
    A.optional('CINE.opt', { near: 'chloe' });
  },
};

{
const at = (x, y, z) => ({ of: 'mk_set', off: [x, y, z] });
CONTENT.scenes['CINE.1'] = {
  title: 'The Car Park', area: 'CINEMA', grade: 'launch_night', amb: 'store_night', music: 'theme_a',
  cast: { chase: 'mk_start', wai: 'mk_wai', chloe: 'mk_chloe' },
  shots: [
    { cam: { type: 'crane', from: at(3.5, 6.5, -10), to: at(2.6, 1.55, -7.5), look: at(0, 8.5, 9), lookTo: 'wai.chest', lens: 24, dur: 7 }, dur: 6,
      cues: [{ t: 0.2, title: ['CAR PARK', '11:40 PM'], hold: 2, fadeIn: 1, fadeOut: 1 }, { t: 1, sfx: 'notif_chime', at: 'mk_chloe' }],
      actions: [{ t: 2.5, who: 'chase', do: 'walkTo', at: 'mk_meet' }, { t: 3, who: 'wai', do: 'gesture', name: 'push_glasses' }] },
    { cam: { type: 'follow', who: 'chase', offset: [0.6, 1.7, -2.3], lookAhead: 2 }, focus: 'chase',
      lines: [{ who: 'wai', text: "You're late.", off: true, pause: 0.6 }, { who: 'chase', text: "I'm early for tomorrow.", emote: 'smirk' }] },
    { cam: { type: 'dolly', from: at(-3.4, 1.5, -1.6), to: at(-1.2, 1.45, -2.1), look: 'wai', lookTo: 'chase', lens: 35, push: 0.04 },
      lines: [{ who: 'wai', text: "Queue's forty deep and not one of them has looked up.", emote: 'tense' },
        { who: 'chase', text: "Then they're ready to buy.", emote: 'smirk' }] },
    { cam: { type: 'pan', at: at(3.6, 1.6, -2.6), look: at(-2.2, 2.5, 2.7), lookTo: 'chloe.chest', lens: 32, dur: 3.5 },
      actions: [{ t: 0.4, who: 'chloe', do: 'lookAt', at: at(-2.2, 2.45, 2.7) }, { t: 3.4, who: 'chloe', do: 'lookAt', at: 'chase' }],
      lines: [{ who: 'chloe', text: "“Midnight launch. Be first.” First for what?", pause: 1.2 }, { who: 'wai', text: 'Whatever comes next.' }] },
    { cam: { type: 'handheld', at: at(0.4, 1.45, -4.4), look: at(0.3, 1.35, 0.6), lens: 28, handheld: 0.35 }, focus: null,
      lines: [{ who: 'chase', text: "Who's the kid?", to: 'wai' }, { who: 'wai', text: 'New trainee. Be nice.', emote: 'smile' }] },
  ],
  exit: { hold: true },
};

CONTENT.scenes['CINE.2'] = {
  title: 'Step Four', area: 'CINEMA',
  start: { blend: 1.5 },   // from CINE.1's held frame; Chase and Chloe walk to their marks during it
  cast: { chase: 'mk_c2', chloe: 'mk_k2', wai: { at: 'mk_wai', yaw: 0.8 } },
  shots: [
    { cam: { type: 'ots', over: 'chase', on: 'chloe', side: 'right', push: 0.06 },
      actions: [{ t: 0, who: 'chloe', do: 'hold', prop: 'manual', hand: 'r' }],
      lines: [{ who: 'chloe', text: "Step four. “Build rapport with every customer.”", emote: 'smile' }] },
    { cam: { type: 'ots', over: 'chloe', on: 'chase', side: 'right' },
      lines: [{ who: 'chase', text: "Step four's for people with time.", emote: 'neutral' }] },
    { cam: { type: 'close', who: 'chloe', push: 0.08 },
      lines: [{ who: 'chloe', text: "You haven't even read it.", emote: 'smirk' }] },
    { cam: { type: 'extreme_close', who: 'chase', part: 'eyes', push: 0.05 },
      lines: [{ who: 'chase', text: 'Read it twice.', emote: 'lying', pause: 0.8 }] },
    { cam: { type: 'two_shot', a: 'chase', b: 'chloe' },
      actions: [{ t: 0.6, who: 'chloe', do: 'give', prop: 'manual', to: 'chase' }, { t: 0.5, who: 'chloe', do: 'emote', name: 'tender' }],
      lines: [{ who: 'chloe', text: "Then you won't need it back.", pause: 0.4 }] },
    { cam: { type: 'extreme_close', who: 'chase', part: 'hands' }, dur: 2.4,
      actions: [{ t: 0.3, who: 'chase', do: 'gesture', name: 'rub_palm' }] },
    { cam: { type: 'static', at: { of: 'chase', off: [0.5, 1.55, -1.1] }, look: 'chloe', lens: 60 }, focus: { rack: ['chase', 'chloe'], at: 1.2, dur: 1.4 },
      actions: [{ t: 1.4, who: 'chloe', do: 'take', prop: 'manual', from: 'chase' }],
      lines: [{ who: 'chase', text: 'Here.', pause: 0.5 }, { who: 'chloe', text: 'Suit yourself.', emote: 'sad', pause: 0.9 }] },
    { cam: { type: 'extreme_close', who: 'chloe', part: 'badge' }, dur: 2.6,
      lines: [{ who: 'chloe', text: '…', pause: 0.6 }] },
    { cam: { type: 'extreme_close', who: 'chase', part: 'phone' }, dur: 3.2,
      actions: [{ t: 0, who: 'chase', do: 'hold', prop: 'phone', hand: 'r' }, { t: 0, who: 'chase', do: 'phoneGlow', on: true },
        { t: 0, who: 'chase', do: 'gesture', name: 'type_phone', hold: true }],
      cues: [{ t: 0.2, sfx: 'phone_buzz' }, { t: 0.3, ui: { phone: { kind: 'messages', title: 'WAI', time: '11:41 PM', lines: [{ from: 'them', text: 'head office wants a photo at 300' }, { from: 'them', text: 'smile for once' }] } } },
        { t: 3.1, ui: { phone: null } }] },
    { cam: { type: 'orbit', around: 'wai', radius: 2.3, height: -0.05, from: -35, to: 25, lens: 45 },
      lines: [{ who: 'wai', text: "Head office wants a photo when you hit three hundred.", emote: 'smile', pause: 0.5 }] },
    { cam: { type: 'pov', who: 'chase', look: 'wai' },
      actions: [{ t: 0.2, who: 'wai', do: 'turnTo', to: 'chase' }],
      lines: [{ who: 'wai', text: 'Smile for once.', emote: 'laugh', pause: 0.4 }, { who: 'chase', text: '…', off: true }] },
  ],
  exit: { hold: true },
};

CONTENT.scenes['CINE.3'] = {
  title: 'Contact', area: 'CINEMA', skippable: true,
  start: { cut: true },    // the glass breaks on the cut
  cast: { soldier: { def: 'soldier', at: 'mk_soldier' }, chase: 'mk_c2', chloe: 'mk_k2', wai: { at: 'mk_wai', yaw: 0.8 } },
  shots: [
    { cam: { type: 'handheld', at: at(-2.6, 1.55, -3.2), look: 'soldier.chest', lens: 30, handheld: 0.8 },
      cues: [{ t: 0, sfx: 'glass_break', at: 'mk_car' }, { t: 0, shake: 0.5, dur: 0.7 }, { t: 0.1, loop: 'siren_far', id: 'siren' }, { t: 0.2, music: 'tension', fade: 0.5 }],
      actions: [{ t: 0.3, who: 'soldier', do: 'aim', at: 'chase' }, { t: 0.4, who: 'chase', do: 'turnTo', to: 'soldier' }, { t: 0.5, who: 'chloe', do: 'emote', name: 'afraid' },
        { t: 0.8, who: 'chloe', do: 'kneel' }, { t: 1, who: 'chase', do: 'phoneGlow', on: false }, { t: 1, who: 'chase', do: 'gesture', name: null },
        { t: 1, who: 'chase', do: 'drop', hand: 'r' }],
      lines: [{ who: 'soldier', text: "Hands! Everyone's hands where I can see them!", emote: 'angry', pause: 0.5 }] },
    { cam: { type: 'close', who: 'soldier', handheld: 0.5, side: 'left' },
      actions: [{ t: 0, who: 'chase', do: 'pose', name: 'hands_up' }],
      lines: [{ who: 'chase', text: 'Easy. Easy, mate.', off: true, pause: 0.3 }] },
    { cam: { type: 'follow', who: 'wai', offset: [-0.8, 1.6, -2.6], lookAhead: 3, handheld: 0.6 }, dur: 2.2,
      actions: [{ t: 0, who: 'wai', do: 'runTo', at: { of: 'soldier', off: [0, 0, 0.9] } }, { t: 1.6, who: 'wai', do: 'gesture', name: 'tackle' }],
      cues: [{ t: 1.5, slowmo: 0.35, dur: 0.9 }] },
    { cam: { type: 'static', at: at(-3.6, 0.6, -3.4), look: 'soldier.hips', lens: 28, handheld: 0.4 }, dur: 3.2,
      actions: [{ t: 0, who: 'soldier', do: 'fire', at: at(-1, 25, 12), sfx: 'rifle_shot' }, { t: 0.4, who: 'soldier', do: 'die' }, { t: 0.9, who: 'wai', do: 'kneel' },
        { t: 1.8, who: 'wai', do: 'anim', name: 'rub_face' }],
      cues: [{ t: 0, shake: 0.7, dur: 0.5 }, { t: 0.4, grade: 'launch_fire', dur: 2 }, { t: 1.2, stopLoop: 'siren', fade: 2 }, { t: 1.5, music: 'stop', fade: 2 }] },
    { cam: { type: 'two_shot', a: 'chase', b: 'chloe', side: 'left', lens: 45 },
      actions: [{ t: 0, who: 'chloe', do: 'stand' }, { t: 0, who: 'chase', do: 'pose', name: 'stand' }, { t: 0.4, who: 'chase', do: 'hug', to: 'chloe' },
        { t: 2.6, who: 'chase', do: 'attach', to: 'chloe', mode: 'face_hold' }, { t: 4.6, who: 'chase', do: 'detach' }, { t: 4.8, who: 'chase', do: 'decal', kind: 'blood_knuckles' }],
      lines: [{ who: 'chase', text: "You're alright. Look at me. You're alright.", emote: 'tense', pause: 0.8 }, { who: 'chloe', text: "I'm alright.", emote: 'crying' }] },
    { cam: { type: 'crane', from: at(-6.4, 1.1, -2.2), to: at(-7, 3.4, -3.4), look: 'chase.chest', lens: 30, blend: 1.4 }, dur: 5,
      actions: [{ t: 0, who: 'chase', do: 'carry', to: 'chloe' }, { t: 0.2, who: 'chase', do: 'walkTo', path: [at(-2, 0, -0.2), 'mk_benchside'] },
        { t: 3, who: 'chase', do: 'detach' }, { t: 3.1, who: 'chloe', do: 'sit', at: 'mk_bench' }, { t: 3.4, who: 'chase', do: 'lookAt', at: 'chloe' }, { do: 'call', t: 3.6, hook: 'dev.cinema.flicker' }],
      lines: [{ who: 'wai', text: "Car. Now. Before the rest of them come.", off: true, pause: 1.6 }] },
    { cam: { type: 'static', at: at(-3.2, 1.3, -3.2), look: 'chase', lens: 40 }, dur: 5.5,
      cues: [{ t: 0.3, fade: 'black', dur: 0.8 }, { t: 1.2, look: 'CINEMA' }, { t: 1.3, fade: 'none', dur: 1.2 }, { t: 1.2, amb: 'store_night' },
        { t: 2.5, call: 'dev.cinema.flicker' }, { t: 4.2, letterbox: false }],
      actions: [{ t: 1.1, who: 'soldier', do: 'hide' }, { t: 1.1, who: 'wai', do: 'place', at: 'mk_meet' }, { t: 1.15, who: 'wai', do: 'show' }, { t: 1.15, who: 'wai', do: 'stand' },
        { t: 1.15, who: 'chloe', do: 'badge', value: 1, where: 'forearm_l' }, { t: 1.15, who: 'soldier', do: 'lie' }, { t: 2.2, who: 'chase', do: 'lookAt', at: null }, { t: 2.3, who: 'chase', do: 'turnTo', to: 'mk_meet' }, { t: 2.4, who: 'chloe', do: 'stand' }] },
  ],
  end: { place: { chase: 'mk_benchside' }, pose: { chloe: 'stand' }, flags: { cinemaSeen: true } },
  exit: { blend: 'gameplay', dur: 1.2 },
};
}

CONTENT.talks['CINE.walk'] = {
  priority: 1, resume: { who: 'wai', text: 'Anyway. Like I was saying.', emote: 'smirk' },
  lines: [
    { who: 'wai', text: "Forty in the queue and not one of them's looked up." },
    { who: 'chase', text: "Good. Means they're ready." },
    { who: 'wai', text: 'Ready for what?' },
    { who: 'chase', text: "Whatever's on the screen." },
    { who: 'wai', text: "That's bleak, mate.", emote: 'sad' },
    { who: 'chase', text: "That's sales." },
  ],
};
CONTENT.talks['CINE.opt'] = {
  optional: true,
  lines: [
    { who: 'chloe', text: 'Do you ever switch it off?' },
    { who: 'chase', text: 'What?' },
    { who: 'chloe', text: 'The voice. The sales voice.' },
    { who: 'chase', text: '…', pause: 1 },
    { who: 'chloe', text: "Didn't think so.", emote: 'smirk' },
  ],
};
CONTENT.barks.cine_chase = { speaker: 'chase', combat: ['Stay low.', 'Behind you.', 'Quiet.'] };

CONTENT.hooks['dev.cinema.flicker'] = async G => {   // the sign stutters like a failing ballast
  const { sign, signMats } = G.A.data, li = sign.intensity, ei = signMats.map(m => m.emissiveIntensity);
  const set = k => { sign.intensity = li * k; signMats.forEach((m, i) => { m.emissiveIntensity = ei[i] * k; }); };
  for (let i = 0; i < 7; i++) { set(i % 2 ? 1 : 0.12); await G.wait(0.06 + (i % 3) * 0.05); }
  set(1);
};

CONTENT.dev.cinema = async G => {
  await G.area('CINEMA');
  G.actor('chase', 'chase', 'mk_start'); G.actor('wai', 'wai', 'mk_wai'); G.actor('chloe', 'chloe', 'mk_chloe');
  G.player('chase'); G.control(true);
  await G.wait(1.5);
  for (let n = +(PARAMS.get('from') || 1); n <= 3; n++) await G.scene('CINE.' + n);   // &from=N starts at scene CINE.N
  G.control(true);
  G.talk('CINE.walk');
  await G.wait(5);
  Dialogue.interrupt();                     // e.g. combat: the talk stops at the end of the line…
  await G.until(() => !Dialogue.busy);
  Dialogue.bark('cine_chase', 'combat');    // …barks may play…
  await G.wait(3);
  Dialogue.resume();                        // …and it picks up again with its resume line
};
