// ============================================================================
// SANDBOX (dev only, spec §19 milestone 3): every enemy type fighting correctly and Chloe following, hiding, calling out and
// rescuing. Owned by: systems (AI) agent. An overgrown depot at dusk, far from every area:
//   north: the yard — wrecked cars, a low wall, tall grass, two Scrollers, a Lurker behind a car, a dark garage with two
//          Clickers, a Bloatware in the loading court
//   south: the street — two fibro houses, sandbags, barriers, a skip; four Door Knockers (patrol, guard, flank)
//   ?dev&test=sandbox[&fight=infected|humans|scrollers|lurker|clickers|bloatware]   Chase + Chloe at the gate (default: all)
//   CONTENT.dev.sbCam(x, y, z, tx, ty, tz, lens)   fixed camera in area-local coordinates (null = gameplay camera)
//   CONTENT.dev.sbAt(x, z, yaw)                   move the player (area-local)
// ============================================================================
CONTENT.levels.SANDBOX = {
  name: 'AI sandbox', origin: [-15000, 0, 0], grade: 'dry_gold', background: 0x9aa4ac,
  fog: { color: 0xa8a49a, near: 30, far: 140 },
  env: { top: 0x7a90a8, horizon: 0xc8b090, bottom: 0x3a342a, intensity: 0.8, spots: [{ dir: [0.55, 0.35, 0.62], color: 0xffc890, power: 4 }] },
  amb: 'outback_day', surface: 'concrete',
  build(A) {
    const M = Tex.mat;
    Build.hemi({ sky: 0xa8b8c8, ground: 0x5a4a38, intensity: 0.7 });
    Build.sun({ dir: [0.5, -0.6, 0.62], color: 0xffd0a0, intensity: 3, area: 48, target: [0, 0, 0] });
    // ground: cracked concrete lot, a strip of road to the south, grass verges
    Build.floor(-26, -46, 26, 12, M('concrete', { color: 0x9a968c }), { surface: 'concrete' });
    Build.floor(-26, 12, 26, 48, M('asphalt'), { surface: 'concrete' });
    Build.scatter('debris', { box: [-24, -44, 24, 46], count: 220, seed: 3 });
    Build.scatter('leaves', { box: [-24, -44, 24, 10], count: 160, seed: 5 });
    // perimeter: colorbond and chainlink, so nothing wanders off
    for (const [x, z, len, yaw] of [[-26, -46, 52, 0], [26, 48, 52, Math.PI], [26, -46, 94, -Math.PI / 2], [-26, 48, 94, Math.PI / 2]]) Build.prop('fence', { pos: [x, 0, z], yaw, kind: 'colorbond', length: len, h: 2.2, worn: 0.8 });
    // ---- the yard ------------------------------------------------------------------------------------------------------
    Build.wall(-20, -12, -3, -12, 1.15, M('brick', { color: 0x9a6a58 }), { thick: 0.3 });
    Build.wall(3, -12, 20, -12, 1.15, M('brick', { color: 0x9a6a58 }), { thick: 0.3 });
    Build.car('sedan', { pos: [-10, 0, -21], yaw: 0.3, wrecked: true, seed: 2 });
    Build.car('ute', { pos: [-2, 0, -27], yaw: -1.2, wrecked: true, seed: 4 });
    Build.car('hatch', { pos: [5, 0, -18], yaw: 2.1, burnt: true, seed: 6 });
    for (const [x, z, s] of [[-15, -16, 1], [-14, -17.2, 2], [2, -32, 1], [16, -8, 1], [-4, -6, 1]]) Build.prop('crate', { pos: [x, 0, z], stack: s, seed: x * 7 + z, worn: 0.7 });
    Build.prop('pallet', { pos: [14, 0, -30], stack: 3, worn: 0.8 });
    Build.grass({ box: [8, -27, 18, -15], count: 2600, height: 1.15, color: 0x7a8a4a });
    A.conceal(8, -27, 18, -15, 0.75, 0.2);
    Build.tree('gum', { pos: [20, 0, -20], scale: 1.1, seed: 3 });
    Build.tree('gum', { pos: [-22, 0, -4], scale: 0.9, seed: 8 });
    Build.scatter('phones', { box: [-6, -10, 6, -4], count: 14, seed: 9 });
    A.remark({ at: [0, 0, -7], r: 4, text: 'Everyone just dropped them. Like they were hot.', emote: 'sad' });
    // the garage: dark inside, open to the yard
    Build.room({ x: -12, z: -38, w: 12, d: 8, h: 3.2, wall: M('brick_painted', { color: 0x8a8a80 }), outside: M('brick', { color: 0x8a5a48 }), floor: M('concrete', { color: 0x6a665e }), ceil: M('corrugated', { color: 0x6a6a64 }), doors: [{ side: 's', at: 0, w: 6, h: 3 }] });
    A.conceal(-18, -42, -6, -34, 0.4);
    Build.prop('shelving', { pos: [-16.6, 0, -41.3], w: 2.4 });
    Build.prop('promo_banner', { pos: [-12, 2.1, -41.8], text: 'MIDNIGHT LAUNCH — BE FIRST', w: 3 });
    A.remark({ at: [-12, 0, -37], r: 5, text: 'Be first. Wow. They were.', emote: 'smirk' });
    Build.screenrot({ pos: [-7.2, 0.4, -40], yaw: -Math.PI / 2, w: 2.5, h: 2 });
    // the loading court
    Build.prop('bin', { pos: [16, 0, -40], kind: 'skip' });
    Build.prop('jersey_barrier', { pos: [4, 0, -40], length: 4 });
    // ---- the street ---------------------------------------------------------------------------------------------------------
    Build.road({ from: [-26, 30], to: [26, 30], width: 7, lines: 'dashed' });
    Build.room({ x: -14, z: 42, w: 9, d: 7, h: 2.7, wall: M('plaster'), outside: M('fibro', { color: 0xb8b0a0 }), floor: M('floorboards'), ceil: M('plaster'), doors: [{ side: 'n', at: 1.5 }], windows: [{ side: 'n', at: -2 }] });
    Build.room({ x: 12, z: 42, w: 10, d: 7, h: 2.7, wall: M('plaster'), outside: M('weatherboard', { color: 0x8a9aa0 }), floor: M('floorboards'), ceil: M('plaster'), doors: [{ side: 'n', at: -2 }], windows: [{ side: 'n', at: 2 }] });
    Build.poster('comms_execution', { pos: [-14, 1.5, 38.4], yaw: Math.PI, w: 0.7, worn: 0.5 });
    A.remark({ at: [-14, 0, 37], r: 4, text: 'They hung these in our classroom.', emote: 'tense' });
    Build.prop('sandbags', { pos: [-6, 0, 18], length: 3 });
    Build.prop('sandbags', { pos: [8, 0, 21], length: 3, yaw: 0.3 });
    Build.prop('jersey_barrier', { pos: [-16, 0, 24], length: 4 });
    Build.prop('bin', { pos: [18, 0, 18], kind: 'skip' });
    Build.car('van', { pos: [0, 0, 33], yaw: Math.PI / 2 + 0.2, wrecked: true, seed: 11 });
    Build.car('sedan', { pos: [-19, 0, 31], yaw: Math.PI / 2, wrecked: true, seed: 12 });
    for (const [x, z] of [[14, 26], [-8, 26], [3, 15]]) Build.prop('crate', { pos: [x, 0, z], seed: x + z, worn: 0.6 });
    Build.streetlight({ pos: [-4, 0, 26.5], on: false });
    Build.streetlight({ pos: [16, 0, 26.5], on: false });
    A.patrol('sb_street', [[-18, 0, 28], [0, 0, 27], [18, 0, 28], [0, 0, 36]]);
    A.patrol('sb_houses', [[-12, 0, 36], [10, 0, 36]]);
    A.navBounds(-26, -46, 26, 48);
    // marks
    A.marker('mk_start', [0, 0, 6], Math.PI);
    A.marker('mk_chloe', [-1.5, 0, 9], Math.PI);
    A.marker('mk_street', [0, 0, 11], 0);
  },
};

(() => {
  const O = new THREE.Vector3(-15000, 0, 0), W = (x, z, y = 0) => new THREE.Vector3(x, y, z).add(O);
  const SPAWNS = {
    scrollers: [['scroller', [-3, -20], 0.4, {}], ['scroller', [7, -24], 2.6, {}]],
    lurker: [['lurker', [-10, -23.5], 0, {}]],
    clickers: [['clicker', [-14, -38], 0, { radius: 3.5 }], ['clicker', [-9, -36.5], 2, { radius: 3.5 }]],
    bloatware: [['bloatware', [9, -38], Math.PI, {}]],
    humans: [
      ['human', [-12, 28], Math.PI / 2, { faction: 'doorknocker', weapon: 'pistol', behaviour: 'patrol', route: 'sb_street' }],
      ['human', [10, 36], 0, { faction: 'doorknocker', weapon: 'rifle', behaviour: 'patrol', route: 'sb_houses' }],
      ['human', [16, 22], -2.4, { faction: 'doorknocker', weapon: 'machete', behaviour: 'guard' }],
      ['human', [-6, 40], Math.PI, { faction: 'doorknocker', weapon: 'rifle', behaviour: 'wander', radius: 4 }],
    ],
  };
  SPAWNS.infected = [...SPAWNS.scrollers, ...SPAWNS.lurker, ...SPAWNS.clickers, ...SPAWNS.bloatware];
  SPAWNS.all = [...SPAWNS.infected, ...SPAWNS.humans];

  CONTENT.dev.sandbox = async G => {
    await G.area('SANDBOX');
    const fight = PARAMS.get('fight') || 'all', human = fight === 'humans';
    const chase = G.actor('chase', 'chase', human ? 'mk_street' : 'mk_start'), chloe = G.actor('chloe', 'chloe', 'mk_chloe', human ? 0 : Math.PI);
    G.player(chase, { combat: true, hud: true, canCrouch: true, canJump: true, weapons: ['revolver', 'shotgun'], melee: 'fists', stats: 'chase' });
    AI.companion(chloe, { role: 'chloe' });
    SPAWNS[fight].forEach(([type, [x, z], yaw, o], i) => G.spawn(type, { pos: W(x, z), yaw }, Object.assign({ seed: 40 + i }, o)));
    Play.snapCamera();
    G.control(true);
  };
  CONTENT.dev.sbCam = (x, y, z, tx, ty, tz, lens = 35) => Director.manual(x == null ? null : { pos: W(x, z, y), target: W(tx, tz, ty), fov: U.lensToFov(lens) });
  CONTENT.dev.sbAt = (x, z, yaw = Play.char.yaw) => { Game.place(Play.char, W(x, z), yaw); Play.snapCamera(); };
})();
