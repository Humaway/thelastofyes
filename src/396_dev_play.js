// ============================================================================
// Player playground (dev only): every Play mechanic in one yard. Owned by: systems (player) agent.
//   ?dev&test=play                 Chase (combat, HUD, a full kit) at the supply pad; Chloe follows
//   ?dev&test=play&who=chloe       Chloe as the player (pistol, bow, box cutter, 60% health)
//   &spot=NAME                     start somewhere else: start bench trav ladder plank portable squeeze boost water grass
//                                  listen takedown range
//   &enemies=0                     no enemies
//   CONTENT.dev.playSpot(name)     teleport the player (and the companion) at runtime — for tools/shot.mjs eval steps
// Layout (area-local; origin [-12000, 0, 0]; north = -Z, the player starts facing it):
//   supply pad x -4..8 z -2..8: workbench, glinting pickups, an artifact, a lanyard, a training module, a Sales Tip
//   traversal lane x -12..-2: low wall (vault) · 1.5 m block (climb, drop) · 2.1 m wall (marked ledge) · ladder up a 4 m
//     platform · plank carried across a 2.5 m gap · drop down · portable ladder to a 3 m roof · squeeze gap
//   west: a 3.2 m wall (two-person boost) and a flooded tank (deep water; push the pallet across for Chloe)
//   east: tall grass, a dark shed, cover; Scrollers, a Clicker, a Lurker, a smuggler patrol and a guard facing away
// ============================================================================
(() => {
  const SPOTS = {
    start: [[0, 0, 2], Math.PI], bench: [[3.3, 0, 1], Math.PI / 2], trav: [[-8, 0, -1.5], Math.PI],
    ladder: [[-10.5, 0, -20.4], Math.PI], plank: [[-6.4, 4, -24.2], Math.PI], portable: [[-1, 0, -34.5], Math.PI],
    squeeze: [[-8, 0, -44.6], Math.PI], boost: [[-17, 0, -28.3], Math.PI], water: [[-21, 0, -4.2], Math.PI + 0.3],
    grass: [[14, 0, -18.5], Math.PI], listen: [[26, 0, -11.2], Math.PI + 0.15], takedown: [[8, 0, -11.9], Math.PI],
    range: [[18, 0, -19.5], Math.PI + 0.2],
  };
  const asChloe = () => PARAMS.get('who') === 'chloe';

  CONTENT.levels.PLAY = {
    name: 'Playground', origin: [-12000, 0, 0], grade: 'summer_haze',
    fog: { color: 0xa8b8c4, near: 45, far: 160 },
    env: { top: 0x5f84ac, horizon: 0xc8bca4, bottom: 0x4c443a, intensity: 0.85 },
    background: 0x8eaac4, amb: 'suburb_day', surface: 'concrete',
    build(A) {
      Build.hemi({ sky: 0xb0c4d8, ground: 0x5a4c3a, intensity: 0.55 });
      Build.sun({ dir: [-0.55, -1, -0.3], color: 0xffe4c4, intensity: 2.7, area: 48 });
      const conc = Tex.mat('concrete'), brick = Tex.mat('brick'), block = Tex.mat('render', { color: 0xb8b0a4 });
      // ground, and a flooded tank at x -32..-20, z -20..-6 (1.4 m walls; deep water, the pallet floats in it)
      Build.floor(-40, -60, 40, 20, conc);
      for (const [w, d, x, z] of [[12.6, 0.3, -26, -5.85], [12.6, 0.3, -26, -20.15], [0.3, 14, -32.15, -13], [0.3, 14, -19.85, -13]]) Build.box(w, 1.4, d, block, { pos: [x, 0, z] });
      Build.water({ x1: -32, z1: -20, x2: -20, z2: -6, y: 1.25 });
      A.water({ box: [-32, -20, -20, -6], y: 1.25, deep: true });
      A.data.pallet = A.pallet({ at: [-22.2, 1.25, -8.2], water: [-32, -20, -20, -6], y: 1.25, to: [-30.4, 1.25, -18.6],
        onArrive: () => {         // Chloe steps off onto the far wall and follows again
          const ch = Game.who('chloe'), P = A.data.pallet;
          if (P.rider !== ch) return;
          P.ride(null); ch.root.position.copy(A.w([-30.4, 1.4, -20.15]));
          AI.list.find(a => a.char === ch).setBehaviour('follow');
        } });
      // yard edge
      for (const [x, z, yaw, len] of [[-40, 20, 0, 80], [-40, -60, 0, 80], [-40, -60, -Math.PI / 2, 80], [40, 20, Math.PI / 2, 80]]) Build.prop('fence', { kind: 'colorbond', pos: [x, 0, z], yaw, length: len, color: 0x6a746c, worn: 0.4 });
      for (const [x, z, s] of [[-36, 12, 1.1], [34, 14, 0.9], [36, -54, 1.2], [-37, -52, 1]]) Build.tree('gum', { pos: [x, 0, z], scale: s, seed: x * 7 + z });

      // ---- supply pad --------------------------------------------------------------------------------------------------
      A.workbench({ at: [5, 0, 1], yaw: -Math.PI / 2 });
      Build.prop('crate', { kind: 'wood', pos: [5.2, 0, -1.6], w: 1.1, h: 0.7, d: 0.8, worn: 0.5 });
      Build.prop('pallet', { pos: [6.4, 0, 3.6], stack: 2 });
      const P = (at, item, n) => A.pickup({ at, item, n });
      [['revolver', 1], ['shotgun', 1], ['rifle', 1], ['revolver_ammo', 6], ['shotgun_ammo', 4], ['rifle_ammo', 5]].forEach(([k, n], i) => P([-3 + i * 0.9, 0, -0.8], k, n));
      [['pipe', 1], ['bat', 1], ['machete', 1], ['plank', 1], ['bottle', 1], ['brick', 1]].forEach(([k, n], i) => P([-3 + i * 0.9, 0, -2.2], k, n));
      [['cloth', 2], ['alcohol', 2], ['tape', 2], ['sim', 2], ['battery', 1], ['nokia', 1], ['scrap', 2], ['bars', 6]].forEach(([k, n], i) => P([-3.2 + i * 0.8, 0, 6.2], k, n));
      A.collectible({ at: [5.2, 0.71, -1.6], kind: 'artifact', id: 'dev_notice' });
      A.collectible({ at: [1.6, 0, 4.4], kind: 'lanyard', id: 'dev_lanyard' });
      A.collectible({ at: [-1.8, 0, 4.2], kind: 'module', id: 'dev_module' });
      A.collectible({ at: [6.2, 0, 6], kind: 'tip', id: 'dev_tip' });

      // ---- traversal lane (x -12..-2) --------------------------------------------------------------------------------------
      A.vault(Build.box(4, 1.0, 0.35, brick, { pos: [-8, 0, -4], solid: false }));
      Build.box(3, 1.5, 2, block, { pos: [-8, 0, -10] });                          // climb up, drop off the far side
      Build.box(3, 2.1, 1.4, brick, { pos: [-8, 0, -16] });                        // too tall to scramble: a marked ledge
      A.ledge({ at: [-8, 0, -14.85], top: [-8, 2.1, -15.9] });
      Build.box(8, 4, 4, block, { pos: [-8, 0, -24] });                            // platform 1 (z -26..-22) + ladder
      A.ladder({ bottom: [-10.5, 0, -21.35], top: [-10.5, 4, -22.6] });
      Build.box(8, 4, 4, block, { pos: [-8, 0, -30.5] });                          // platform 2 across a 2.5 m gap
      A.plank({ at: [-5.3, 4, -23.6], yaw: Math.PI / 2, len: 3.2, spots: [{ from: [-8, 4, -25.7], to: [-8, 4, -28.8] }] });
      Build.box(6, 3, 3, brick, { pos: [-5, 0, -41.5] });                          // a 3 m roof: the portable ladder's spot
      A.ladder({ at: [-0.6, 0, -36], yaw: 0.3, spots: [{ bottom: [-4, 0, -39.4], top: [-4, 3, -40.6] }] });
      Build.box(2.9, 3, 4, brick, { pos: [-9.7, 0, -48] }); Build.box(2.9, 3, 4, brick, { pos: [-6.3, 0, -48] });   // 0.5 m gap
      A.squeeze({ from: [-8, 0, -45.5], to: [-8, 0, -50.5] });
      A.hint([[-8, 0, -2], [-8, 0, -12], [-8, 0, -18], [-10.5, 0, -21], [-8, 4, -25], [-8, 4, -31], [-1, 0, -36], [-4, 0, -39], [-8, 0, -45]]);

      // ---- west: boost wall ------------------------------------------------------------------------------------------------------
      Build.box(6, 3.2, 3, block, { pos: [-17, 0, -31.5] });
      A.boost({ at: [-17, 0, -29.3], top: [-17, 3.2, -30.8], partner: asChloe() ? 'chase' : 'chloe' });

      // ---- east: stealth field -------------------------------------------------------------------------------------------------
      Build.grass({ box: [8, -30, 20, -20], count: 2600, height: 0.95, color: 0x7a8a4a });
      A.tallGrass([8, -30, 20, -20]);
      Build.room({ x: 26, z: -16, w: 8, d: 6, h: 3, wall: Tex.mat('plaster', { color: 0x9a948a }), outside: brick, floor: conc, doors: [{ side: 'w', at: 0, w: 1.1 }] });
      A.dark([22, -19, 30, -13], 0.8);
      Build.prop('jersey_barrier', { pos: [12, 0, -38], length: 4 });
      Build.prop('jersey_barrier', { pos: [24, 0, -40], yaw: 0.3, length: 4 });
      Build.car('sedan', { pos: [18, 0, -44], yaw: 1.2, wrecked: true, seed: 3 });
      for (const [x, z] of [[30, -34], [31, -35], [9, -46]]) Build.prop('barrel', { kind: 'rust', pos: [x, 0, z] });
      Build.prop('crate', { kind: 'wood', pos: [15, 0, -33], w: 1.2, h: 1.1, d: 1.2, stack: 2 });
      Build.prop('sandbags', { pos: [26, 0, -26], length: 3 });

      for (const [k, [p, yaw]] of Object.entries(SPOTS)) A.marker('mk_' + k, p, yaw);
      A.marker('mk_chloe', [1.6, 0, 3.6], Math.PI);
    },
  };

  // dev-only journal entries so the playground's collectibles have something to show
  function devEntries() {
    const C = CONTENT.collectibles;
    if (C.artifacts.some(e => e.id === 'dev_notice')) return;
    C.artifacts.push({ id: 'dev_notice', title: 'COMMS NOTICE 14', text: 'SCREEN OFFENCES\n\n1. Possession of a live handset.\n2. Charging a device without a permit.\n3. Looking down in a public place.\n4. Scrolling.\n\nReport offences at any checkpoint. Look up.' });
    C.lanyards.push({ id: 'dev_lanyard', title: '—— · Trainee · Chermside' });
    C.modules.push({ id: 'dev_module' });
    CONTENT.tips.push({ id: 'dev_tip', lines: [{ who: 'chloe', text: '"Always smile! Customers can hear it."' }, { who: 'chloe', text: 'Can they hear it through a gas mask?', emote: 'smirk' }] });
  }

  CONTENT.dev.playSpot = name => {
    const [p, yaw] = SPOTS[name], A = Game.area, pl = Play.char, mate = Game.who(asChloe() ? 'chase' : 'chloe');
    Game.place(pl, A.w(p), yaw);
    if (mate) Game.place(mate, A.w(p).add(U.fwd(yaw + 2.4, new THREE.Vector3()).multiplyScalar(2.2)), yaw);
    Play.camYaw = yaw; Play.snapCamera();
  };

  CONTENT.dev.play = async G => {
    devEntries();
    await G.area('PLAY');
    const chloeP = asChloe(), chase = G.actor('chase', 'chase', 'mk_start'), chloe = G.actor('chloe', 'chloe', 'mk_chloe');
    const pl = chloeP ? chloe : chase;
    Play.resetInventory();
    G.player(pl, { combat: true, hud: true, stats: chloeP ? 'chloe' : 'chase' });
    const kit = chloeP ? { pistol: 1, bow: 1, pistol_ammo: 10, arrow: 8, bottle: 1, medkit: 1, cloth: 1, alcohol: 1 }
      : { revolver: 1, revolver_ammo: 8, shotgun: 1, shotgun_ammo: 3, pipe: 1, medkit: 1, shiv: 2, bottle: 1, pillow: 1, ringtone: 1, vape: 1, cloth: 2, alcohol: 1, tape: 2, sim: 1, battery: 1, scrap: 1, bars: 9 };
    for (const k in kit) Play.give(k, kit[k]);
    Play.equip(chloeP ? 'pistol' : 'revolver');
    const spot = PARAMS.get('spot') || 'start';
    if (!chloeP) AI.companion(chloe, { role: 'chloe' });
    CONTENT.dev.playSpot(spot);
    if (spot === 'water' && !chloeP) { AI.list.find(a => a.char === chloe).setBehaviour('scripted'); G.A.data.pallet.ride(chloe); }
    G.control(true);
    if (PARAMS.get('enemies') === '0') return;
    const w = p => G.A.w(p), at = (p, yaw) => ({ pos: w(p), yaw });
    G.spawn('scroller', at([14, 0, -36], 0.4), { behaviour: 'wander', radius: 4 });
    G.spawn('scroller', at([22, 0, -33], 2), { behaviour: 'wander', radius: 3 });
    G.spawn('clicker', at([29, 0, -28], -1), { behaviour: 'wander', radius: 3 });
    G.spawn('lurker', at([31, 0, -44], 3), { behaviour: 'ambush' });
    G.spawn('human', at([10, 0, -48], Math.PI / 2), { faction: 'smuggler', weapon: 'pistol', behaviour: 'patrol', route: [w([10, 0, -48]), w([33, 0, -48])] });
    G.spawn('human', at([8, 0, -13], Math.PI), { faction: 'smuggler', weapon: 'pipe', behaviour: 'idle' });
  };
})();
