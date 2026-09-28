// ============================================================================
// World showroom (dev only): every Tex material and Build prop/FX laid out by theme, at night
// (sodium + moon, default) or day. Owned by: world agent.
//   ?dev&test=world                     Chase as the player at the showroom entrance
//   ?dev&test=world&cam=store           a fixed camera preset (see CAMS below); cam=fly → WASD + mouse fly camera
//   &light=day                          daylight instead of night;  &rain  adds rain
//   &zone=store|house|street|bridge|nature|clutter|swatches|walls   build only one zone (fast screenshots)
//   CONTENT.dev.worldCam(name)          switch presets at runtime (tools/shot.mjs eval steps)
// ============================================================================
(() => {
  const DAY = PARAMS.get('light') === 'day';
  const CAMS = {
    overview: [[-2, 48, 62], [0, 0, 0]],
    store: [[-14.4, 2.0, -12.2], [-22, 1.1, -17.5]],
    store_front: [[-18.5, 1.7, -3.2], [-20, 2.2, -11]],
    counter: [[-21.6, 1.55, -16.4], [-23, 1.0, -19.6]],
    demo: [[-22.6, 1.35, -13.1], [-24, 0.85, -14.6]],
    shutter: [[-4.5, 1.6, -4.5], [-6, 1.5, -10.5]],
    bedroom: [[10.6, 1.6, -18.3], [7.8, 0.7, -21]],
    lounge: [[20.2, 1.65, -15.4], [15.5, 0.7, -19.3]],
    kitchen: [[14.6, 1.6, -15.5], [17.5, 1.1, -21.6]],
    hall: [[13.8, 1.6, -14.8], [12.5, 1.5, -20.5]],
    street: [[-6, 1.7, 3.2], [8, 1.2, 9]],
    cars: [[-2, 2.4, 13.8], [-2, 0.7, 8.8]],
    wrecks: [[4, 2.0, 15], [9, 0.6, 8.5]],
    servo: [[-18, 2.2, 13.5], [-30, 2.2, 25]],
    checkpoint: [[20, 1.8, 25.5], [20, 2.2, 42]],
    bridge: [[27, 4.5, 24], [18, -1, 62]],
    jetty: [[-8, 2.2, 28.5], [-15, -0.5, 45]],
    trees: [[45, 3.2, 10], [45, 4.5, -22]],
    clutter: [[-47, 2.6, 6], [-47, 0.4, -9]],
    swatches: [[-47, 2.4, -12], [-47, 1.4, -30]],
    walls: [[-8, 1.9, -24], [-8, 1.8, -34]],
    fire: [[10.8, 1.5, 10.6], [14.5, 1.1, 6.5]],
    posters: [[-15.5, 2.3, -29.5], [-15.5, 2.3, -34]],
    rot: [[1.5, 2.0, -28], [3.5, 2, -34]],
    clutter_a: [[-54.5, 1.6, 1.8], [-54.5, 0.3, -3]],
    clutter_b: [[-50, 1.7, -2.2], [-50, 0.3, -7]],
    clutter_c: [[-50, 1.6, -6.2], [-50, 0.3, -11]],
    house: [[4, 4.5, -3], [14, 1.5, -18]],
  };
  const L = (A, name) => { const c = CAMS[name] || CAMS.overview; return { pos: A.w(c[0]), target: A.w(c[1]), fov: 55 }; };

  CONTENT.levels.SHOWROOM = {
    name: 'World showroom', origin: [-3000, 0, 0],
    grade: DAY ? 'neutral' : 'launch_night',
    fog: DAY ? { color: 0xb8c4cc, near: 40, far: 220 } : { color: 0x070a12, near: 30, far: 190 },
    env: DAY ? { top: 0x6a90c0, horizon: 0xd8d0c0, bottom: 0x4a4438, intensity: 1.0, spots: [{ dir: [-0.4, 0.8, -0.5], color: 0xfff0d0, power: 6 }] }
      : { top: 0x0a1020, horizon: 0x1a1a24, bottom: 0x050505, intensity: 0.5, spots: [{ dir: [0.5, 0.2, 0.3], color: 0xff9a40, power: 2 }] },
    background: DAY ? 0xa8c0d8 : 0x05070c, surface: 'concrete',
    build(A) {
      const M = Tex.mat, zone = PARAMS.get('zone'), Z = (n, f) => { if (!zone || zone === n) f(); };
      const ZC = { store: [-20, -16], house: [14, -18], street: [-10, 10], bridge: [18, 42], nature: [46, -18], clutter: [-50, -10], swatches: [-48, -24], walls: [-8, -32] }[zone] || [0, 0];
      const sunO = { area: zone ? 28 : 70, target: [ZC[0], 0, ZC[1]] };
      // lighting -------------------------------------------------------------------
      if (DAY) { Build.hemi({ sky: 0xbcd4ec, ground: 0x6a5a48, intensity: 0.9 }); Build.sun({ dir: [-0.45, -1, -0.55], color: 0xfff0dc, intensity: 3.2, ...sunO }); }
      else { Build.hemi({ sky: 0x2a3650, ground: 0x0e0a08, intensity: 0.35 }); Build.sun({ dir: [0.35, -1, 0.55], color: 0x9ab0e0, intensity: 0.35, ...sunO }); }
      // ground -----------------------------------------------------------------------
      Build.floor(-62, -40, 62, 3.9, M('concrete', { color: 0xa8a49c }), { surface: 'concrete' });
      Build.floor(-62, 12.1, 62, 30, M('concrete', { color: 0xa8a49c }), { surface: 'concrete' });
      Z('store', () => {
      // STORE ---------------------------------------------------------------------------
      const white = M('plaster', { color: 0xf4f4f2 });
      Build.room({ x: -20, z: -16, w: 14, d: 10, h: 3.6, wall: white, outside: M('render', { color: 0xd8d4cc }), floor: M('tiles_mall'), ceil: M('plaster'), omit: 's', doors: [{ side: 'n', at: 4, w: 0.9, h: 2.1 }] });
      Build.prop('shopfront', { pos: [-20, 0, -11], w: 14.3, text: 'REDCLIFFE', open: 1 });
      Build.box(14.3, 0.4, 0.3, M('render', { color: 0xd8d4cc }), { pos: [-20, 3.6, -11.1] });
      Build.prop('office_door', { pos: [-16, 0, -21], w: 0.9 });
      Build.prop('store_counter', { pos: [-23, 0, -19.3], w: 2.6 }); Build.prop('store_counter', { pos: [-18.5, 0, -19.3], w: 2.6 });
      Build.prop('demo_table', { pos: [-24, 0, -14.6] }); Build.prop('demo_table', { pos: [-17.5, 0, -14.6], screen: 'feed' });
      Build.prop('wall_display', { pos: [-26.9, 0, -16.5], yaw: Math.PI / 2, w: 3.6 }); Build.prop('wall_display', { pos: [-13.1, 0, -16.5], yaw: -Math.PI / 2, w: 3.6 });
      Build.prop('whiteboard', { pos: [-20.8, 0, -18.4], yaw: 0.3, text: 'b:LAUNCH NIGHT LEADERBOARD\nCHASE 299\nLUKE 187\nr:TARGET 312' });
      Build.prop('promo_banner', { pos: [-20, 2.45, -13.5], text: 'MIDNIGHT LAUNCH — BE FIRST', w: 3.6, drop: 0.25 });
      Build.prop('promo_banner', { pos: [-20, 2.45, -17.8], text: 'UPGRADE YOUR LIFE', w: 3, drop: 0.25 });
      Build.prop('security_pedestals', { pos: [-20, 0, -11.8], w: 2.0 });
      for (const x of [-25, -20, -15]) for (const z of [-19, -16, -13]) Build.prop('ceiling_light', { pos: [x, 3.6, z], kind: 'panel', w: 1.2 });
      for (const x of [-23.5, -16.5]) { Build.light('spot', { pos: [x, 3.4, -15.5], target: [x, 0, -15.5], color: 0xf2f6ff, intensity: 40, distance: 16, angle: 1.15, penumbra: 0.9 }); Build.light('point', { pos: [x, 2.2, -16.5], color: 0xe8eeff, intensity: 5, distance: 12 }); }
      Build.poster('promo_launch', { pos: [-21.5, 1.9, -20.9], w: 0.7, worn: 0 }); Build.poster('values_teamwork', { pos: [-14.5, 1.8, -20.9], w: 0.6, worn: 0 });
      Build.dust({ box: [-26, 0.3, -20, -14, 3.3, -12], count: 260, opacity: 0.35 });
      Build.prop('queue_barrier', { pos: [-24, 0, -8.8], points: [[0, 0], [2.4, 0], [4.8, 0], [7.2, 0], [9.6, 0], [9.6, 1.6], [7.2, 1.6], [4.8, 1.6]] });
      Build.prop('a_frame', { pos: [-12.5, 0, -8.6], yaw: -0.4, poster: 'promo_rest' });
      // closed shop next door with a roller shutter and graffiti
      Build.wall(-12.9, -11, -1, -11, 3.6, M('brick_painted', { color: 0xe8e0d0 }), { doors: [{ at: 6, w: 3.2, h: 2.8 }], trim: false });
      Build.prop('roller_shutter', { pos: [-6.9, 0, -10.95], w: 3.2, h: 2.8, open: 0.25 });
      Build.decal(Tex.graffiti('GONE 99 — DON\'T OPEN', { style: 'drip' }), { pos: [-6.9, 1.2, -10.8], w: 2.8, h: 1.05 });
      Build.decal(Tex.graffiti('', { style: 'cord' }), { pos: [-2.4, 1.4, -10.9], w: 1.2, h: 1.2 });
      Build.decal(Tex.graffiti('23', { style: 'tally', color: '#f0ece0' }), { pos: [-10.6, 1.5, -10.9], w: 1.2, h: 1.2 });
      Build.decal('water_stain', { pos: [-4, 2.6, -10.9], w: 1.6, h: 1.6 });
      Build.decal('soot', { pos: [-10, 2.4, -10.9], w: 2, h: 2 });
      });
      Z('house', () => {
      // HOUSE ----------------------------------------------------------------------------
      const brick = M('brick'), paintB = M('plaster', { color: 0xd8c8e8 }), paintL = M('plaster', { color: 0xece4d4 });
      Build.room({ x: 9, z: -20, w: 4, d: 3.6, h: 2.7, wall: paintB, outside: brick, floor: M('carpet', { color: 0x6a6a8a }), windows: [{ side: 'w', at: 0, w: 1.4, h: 1.2, sill: 0.9 }], doors: [{ side: 'e', at: 1.1, w: 0.82 }] });
      Build.room({ x: 16.5, z: -18.2, w: 9, d: 7.2, h: 2.7, wall: paintL, outside: brick, floor: M('floorboards'), windows: [{ side: 's', at: 2.5, w: 1.8, h: 1.3, sill: 0.8 }], doors: [{ side: 's', at: -2.9, w: 0.87, h: 2.04 }], omit: 'w' });
      Build.wall(12, -14.6, 12, -18.2, 2.7, paintL, { back: brick, thick: 0.15, skirting: M('plaster', { color: 0xf6f2ea }) });
      Build.roof({ x: 14, z: -18.2, y: 2.8, w: 18.4, d: 7.6, kind: 'hip', pitch: 0.42 });
      Build.prop('bed', { pos: [8.2, 0, -20.6], color: 0xc8b0e0, toy: true });
      Build.prop('bedside_table', { pos: [9.5, 0, -21.5], on: true });
      Build.prop('phone', { pos: [8.3, 0.575, -20.3], yaw: 0.4, screen: 'lock' });
      Build.fairyLights({ points: [[7.2, 2.4, -21.72], [8.4, 2.25, -21.72], [9.6, 2.4, -21.72], [10.8, 2.3, -21.72]], color: 0xffd08a, sag: 0.25, light: 0.8, lightAt: [9, 1.9, -20.6] });
      Build.poster('band', { pos: [10.2, 1.6, -21.72], w: 0.5, worn: 0.1 });
      Build.prop('desk', { pos: [10.4, 0, -18.62], yaw: Math.PI, w: 1.1 }); Build.prop('chair', { pos: [10.4, 0, -19.2], kind: 'office', color: 0x6a3a6a });
      Build.prop('wardrobe', { pos: [7.4, 0, -18.55], yaw: Math.PI, w: 1.1 });
      Build.prop('school_bag', { pos: [9.6, 0, -19.1], yaw: 2.2, color: 0x3a5a9a });
      Build.prop('window', { pos: [6.925, 0.9, -20], yaw: Math.PI / 2, w: 1.4, h: 1.2, color: 0x9a7ab0 });
      Build.prop('rug', { pos: [9, 0, -19.8], w: 1.6, d: 1.1, color: 0x9a6a8a });
      Build.prop('interior_door', { pos: [11.0, 0, -18.9], yaw: Math.PI / 2, w: 0.82, open: 0.8 });
      // lounge + kitchen
      Build.prop('couch', { pos: [17.5, 0, -16.6], yaw: Math.PI, color: 0x5a6a78 });
      Build.prop('coffee_table', { pos: [17.5, 0, -18.1] });
      Build.prop('tv', { pos: [17.5, 0, -19.9], screen: 'news', light: true });
      Build.prop('rug', { pos: [17.5, 0, -18], w: 2.6, d: 2 });
      Build.prop('lamp', { pos: [19.5, 0, -16.5], kind: 'floor', light: 1.6 });
      Build.prop('bookshelf', { pos: [20.7, 0, -19.5], yaw: -Math.PI / 2, w: 0.9 });
      Build.prop('armchair', { pos: [19.8, 0, -18.2], yaw: -Math.PI / 2 - 0.3, color: 0x8a6a4a });
      Build.prop('kitchen_bench', { pos: [14.2, 0, -21.45], w: 3.4 });
      Build.prop('fridge', { pos: [12.55, 0, -21.4] });
      Build.prop('oven', { pos: [16.25, 0, -21.45], time: '11:44' });
      Build.prop('gift_box', { pos: [13.3, 0.9, -21.15], yaw: 0.2 });
      Build.prop('dining_table', { pos: [14.2, 0, -17.5], w: 1.5, d: 0.9, chairs: 4, set: true });
      Build.prop('front_door', { pos: [13.6, 0, -14.6], w: 0.87 });
      Build.prop('window', { pos: [19, 0.8, -14.675], yaw: Math.PI, w: 1.8, h: 1.3, color: 0xb8a078 });
      for (const [k, x] of [['baby_in_polo', -16.5], ['store_team', -17.2], ['launch_night', -17.9]]) Build.prop('photo_frame', { kind: k, pos: [12.09, 1.55, x], yaw: Math.PI / 2, w: 0.32 });
      Build.prop('ceiling_light', { pos: [16.5, 2.7, -18.2], kind: 'pendant', light: 2 }); Build.prop('ceiling_fan', { pos: [18, 2.7, -17.5], spin: 0.6 });
      Build.prop('ceiling_light', { pos: [9, 2.7, -20], kind: 'pendant', on: false });
      Build.light('point', { pos: [14.5, 2.2, -19.8], color: 0xffd8b0, intensity: 3, distance: 8 });
      Build.prop('letterbox', { pos: [11, 0, -12.2], number: '12' }); Build.prop('fence', { pos: [4, 0, -12], length: 6.5, kind: 'picket' });
      Build.prop('fence', { pos: [22, 0, -12], length: 8, kind: 'colorbond' }); Build.prop('fence', { pos: [22, 0, -24], yaw: Math.PI / 2, length: 12, kind: 'paling' });
      });
      Z('street', () => {
      Build.road({ from: [-62, 8], to: [23.5, 8], width: 7, path: 3.5 });
      Build.marking('arrow', { pos: [-10, 0, 9.8], yaw: Math.PI / 2 }); Build.marking('give_way', { pos: [22.8, 0, 9.8], yaw: Math.PI / 2, w: 3.3 }); Build.marking('zebra', { pos: [0, 0, 8], yaw: Math.PI / 2, w: 7, len: 3 });
      // STREET ------------------------------------------------------------------------------
      for (const x of [-50, -30, -10, 10]) Build.streetlight({ pos: [x, 0, 3.2], yaw: 0, beam: !DAY, on: !DAY });
      Build.streetlight({ pos: [-2, 0, 3.2], yaw: 0, on: !DAY, light: DAY ? 0 : 45 });
      Build.prop('bus_shelter', { pos: [-38, 0, 2.2], yaw: Math.PI, lit: !DAY });
      Build.prop('bench', { pos: [-31, 0, 2.6], yaw: Math.PI }); Build.prop('bin', { pos: [-33, 0, 2.6] }); Build.prop('bin', { pos: [2, 0, 1.5], kind: 'wheelie' }); Build.prop('bin', { pos: [2.7, 0, 1.5], kind: 'recycle' });
      Build.sign({ tex: Tex.sign('street', 'ANZAC AVE'), w: 0.9, h: 0.17, post: 2.6, pos: [-25, 0, 3.2] });
      Build.sign({ tex: Tex.sign('road_sign', '60'), w: 0.6, h: 0.6, post: 1.9, pos: [-45, 0, 12.8], yaw: Math.PI });
      Build.powerLine({ points: [[-60, 13.2], [-35, 13.2], [-10, 13.2], [15, 13.2]], lamp: false });
      Build.car('sedan', { pos: [-8, 0, 10.2], yaw: Math.PI / 2, color: 0x2a3e5c, lights: !DAY });
      Build.car('hatch', { pos: [-15, 0, 10.2], yaw: Math.PI / 2, color: 0xb03a2a });
      Build.car('ute', { pos: [-22.5, 0, 10.2], yaw: Math.PI / 2, color: 0xe8e8e4 });
      Build.car('police', { pos: [3, 0, 6], yaw: -Math.PI / 2, lights: !DAY });
      Build.car('van', { pos: [-3, 0, 5.8], yaw: -Math.PI / 2, color: 0xe8e8e4 });
      Build.car('camper', { pos: [-45, 0, 10.2], yaw: Math.PI / 2 });
      Build.car('truck', { pos: [-55, 0, 5.8], yaw: -Math.PI / 2, color: 0xd8d8d4 });
      Build.car('sedan', { pos: [9, 0, 8.5], yaw: 0.5, wrecked: true, color: 0x6a1f22 });
      Build.car('hatch', { pos: [14.5, 0, 6.5], yaw: 2.3, burnt: true });
      Build.fire({ pos: [14.5, 1.15, 6.5], size: 1.5 });
      Build.decal('skid', { floor: true, pos: [4, 0.012, 8.5], yaw: 0.2, w: 2, h: 9, opacity: 0.8 }); Build.decal('oil', { floor: true, pos: [9.5, 0.012, 8.2], w: 3, h: 3 });
      Build.scatter('glass', { box: [7, 6.5, 11, 10.5], count: 60 }); Build.scatter('debris', { box: [7, 6, 12, 11], count: 16 });
      Build.prop('roundabout', { pos: [30, 0, 8], r: 6 });
      Build.floor(23.5, 3.9, 38, 12.1, M('asphalt'), { thick: 0.1 });
      // servo
      Build.prop('servo_canopy', { pos: [-30, 0, 22], w: 14, d: 9, lit: !DAY });
      Build.prop('price_sign', { pos: [-19, 0, 17.5], lit: !DAY });
      Build.car('sedan', { pos: [-33.5, 0, 22], yaw: 0.1, color: 0x8a7a5a });
      Build.fire({ pos: [-26.5, 0.3, 21], size: 1.6 }); Build.car('ute', { pos: [-26.5, 0, 21], yaw: -0.2, burnt: true });
      Build.decal('scorch', { floor: true, pos: [-26.5, 0.01, 21], w: 7, h: 7 });
      });
      Z('bridge', () => {
      // CHECKPOINT + BRIDGE over black water -------------------------------------------------
      Build.water({ x1: -62, z1: 30, x2: 62, z2: 110, y: -2.4, dark: true, streaks: DAY ? [] : [{ x: 14.8, z: 40, color: 0xffa640, len: 30 }, { x: 25.2, z: 50, color: 0xffa640, len: 30 }, { x: -16.6, z: 36, color: 0xffb060, len: 22, w: 0.8 }, { x: -13.4, z: 45, color: 0xffb060, len: 22, w: 0.8 }] });
      Build.box(62 * 2, 2.6, 1, M('concrete', { color: 0x8a867e }), { pos: [0, -2.6, 29.5] });
      Build.box(10, 0.6, 80, M('concrete', { color: 0x9a968e }), { pos: [20, -0.6, 70] });
      Build.plane(9.4, 80, M('asphalt_lines'), { pos: [20, 0.002, 70] });
      for (const s of [-1, 1]) { Build.prop('bridge_railing', { pos: [20 + s * 4.85, 0, 30], yaw: -Math.PI / 2, length: 80 }); for (let z = 40; z < 110; z += 20) Build.streetlight({ pos: [20 + s * 4.7, 0.55, z + (s > 0 ? 10 : 0)], yaw: s > 0 ? -Math.PI / 2 : Math.PI / 2, kind: 'bridge', h: 7, on: !DAY, pool: true }); }
      Build.prop('boom_gate', { pos: [16, 0, 38], w: 7.2 });
      Build.prop('floodlight_tower', { pos: [23.4, 0, 44], yaw: Math.PI + 0.35, on: !DAY, light: DAY ? 0 : 500, shadow: false });
      Build.car('comms_van', { pos: [23, 0, 36], yaw: 0.25, lights: !DAY });
      Build.prop('barricade', { pos: [18, 0, 33.5], yaw: Math.PI, text: 'ROAD CLOSED — SCREEN CHECK' });
      Build.prop('sandbags', { pos: [14.6, 0, 42], yaw: -Math.PI / 2, length: 3.4, rows: 5 }); Build.prop('sandbags', { pos: [22.6, 0, 44], length: 2.2, rows: 4 });
      Build.prop('cone', { pos: [16.5, 0, 35], n: 4 }); Build.prop('jersey_barrier', { pos: [15.5, 0, 46], length: 4, kind: 'water' }); Build.prop('jersey_barrier', { pos: [20.5, 0, 46], length: 4 });
      Build.prop('crash_barrier', { pos: [0, 0, 29.9], length: 12 });
      Build.prop('jetty', { pos: [-15, -2.4, 30], length: 36, deck: 2.55, lamps: 5, on: !DAY });
      Build.prop('bench', { pos: [-18, 0, 26.5], yaw: Math.PI }); Build.tree('palm', { pos: [-21, 0, 27] }); Build.tree('palm', { pos: [-9, 0, 26.5] }); Build.tree('fig', { pos: [-2, 0, 22] });
      });
      Z('nature', () => {
      // NATURE ------------------------------------------------------------------------------------
      Build.terrain({ size: [30, 36], pos: [46, 0, -18], seg: 48, mat: M('grass'), height: (x, z) => Math.max(0, Math.sin((x - 31) * 0.2) * Math.sin(z * 0.15) * 0.6 + (x - 31) * 0.02) });
      const kinds = ['gum', 'fig', 'palm', 'poplar', 'willow', 'pine', 'snow_gum', 'dead'];
      kinds.forEach((k, i) => Build.tree(k, { pos: [35 + (i % 4) * 7, 0, -26 + Math.floor(i / 4) * 12], snow: k === 'snow_gum' }));
      Build.grass({ box: [33, -32, 60, -2], count: 6000 });
      Build.box(8, 3, 0.3, M('brick_painted'), { pos: [45, 0, -34] }); Build.vines({ box: [41, 0, -33.85, 49, 3, -33.8], density: 1.4, hang: true });
      Build.scatter('leaves', { box: [33, -12, 44, -4], count: 400 }); Build.scatter('bottles', { box: [46, -8, 50, -4], count: 20 }); Build.scatter('phones', { box: [50, -8, 54, -4], count: 26 });
      Build.scatter('rubble', { box: [54, -8, 58, -4], count: 40 }); Build.scatter('paper', { box: [46, -3, 52, 0], count: 30 }); Build.scatter('cans', { box: [53, -3, 57, 0], count: 20 });
      });
      Z('clutter', () => {
      // CLUTTER --------------------------------------------------------------------------------------
      const row = (names, z) => names.forEach((n, i) => Build.prop(n[0], { pos: [-58 + i * 2.2, 0, z], ...n[1] }));
      row([['crate', {}], ['crate', { kind: 'plastic', stack: 3 }], ['crate', { kind: 'milk', stack: 2 }], ['pallet', { stack: 3 }], ['barrel', {}], ['barrel', { kind: 'rust' }], ['barrel', { kind: 'plastic' }], ['barrel', { kind: 'burning' }], ['cardboard_box', { stack: 2 }], ['cardboard_box', { open: true }]], -2);
      row([['tarp', { w: 1.6, d: 1.2, h: 0.7 }], ['mattress', { yaw: 0.3 }], ['camp_stove', { lit: true }], ['table', {}], ['filing_cabinet', { open: 1 }], ['locker', { n: 2, ajar: 1 }], ['plant_pot', {}], ['plant_pot', { kind: 'palm', pot: 'planter' }], ['rubbish_bag', { n: 3 }], ['tyre', { stack: 3 }]], -6);
      row([['jerry_can', {}], ['esky', {}], ['generator', { on: true }], ['chair', { kind: 'plastic' }], ['chair', { kind: 'folding' }], ['chair', { kind: 'stool' }], ['table', { kind: 'cafe' }], ['bollard', {}], ['cone', {}], ['letterbox', { kind: 'post' }]], -10);
      Build.prop('shelving', { pos: [-50, 0, -14.5] }); Build.prop('table', { pos: [-45, 0, -14.5], kind: 'workbench' });
      });
      Z('swatches', () => {
      // SWATCHES: every material on a bevelled block --------------------------------------------------
      Tex.names.filter(n => n !== 'water').forEach((n, i) => {
        const x = -60 + (i % 12) * 2.1, z = -20 - Math.floor(i / 12) * 2.6;
        Build.box(1.4, 1.4, 1.4, n === 'screen_feed' ? M(n) : M(n, Tex.info(n).alpha ? { transparent: n === 'glass_dirty', alphaTest: n === 'glass_dirty' ? 0 : 0.3, side: THREE.DoubleSide } : {}), { pos: [x, 0, z], bevel: 0.04 });
        Build.sign({ tex: Tex.text(n, { w: 256, h: 48, color: '#fff', bg: '#222' }), w: 0.9, h: 0.17, pos: [x, 0.02, z + 0.72] });
      });
      });
      Z('walls', () => {
      // WALLS: posters, graffiti, decals, signage, screen-rot ------------------------------------------
      const wz = -34;
      Build.box(28, 4, 0.3, M('concrete'), { pos: [-8, 0, wz - 0.15] });
      ['comms_look_up', 'comms_report', 'comms_execution', 'comms_curfew', 'say_yes', 'missing_person', 'landlines_dialtone', 'school_notice', 'fitness', 'party_toga', 'first_aid', 'promo_upgrade'].forEach((k, i) => Build.poster(k, { pos: [-20.5 + i * 0.95, 2.6, wz + 0.01], w: 0.7, worn: k.startsWith('comms') || k === 'say_yes' || k === 'missing_person' ? 0.6 : 0.25 }));
      Build.decal(Tex.graffiti('LOOK UP', { style: 'stencil' }), { pos: [-17, 1.1, wz + 0.02], w: 2.6, h: 1 });
      Build.decal(Tex.graffiti('NO', { style: 'drip', color: '#111' }), { pos: [-13.5, 1.1, wz + 0.02], w: 2, h: 0.75 });
      Build.decal(Tex.sign('comms', 'CHECKPOINT 4'), { pos: [-10, 1.1, wz + 0.02], w: 2.2, h: 0.82, cutout: true });
      Build.decal(Tex.sign('ration', 'RATIONS — PLEASE TAKE A NUMBER'), { pos: [-6.5, 1.1, wz + 0.02], w: 2.6, h: 0.81, cutout: true });
      Build.decal(Tex.sign('plaque', 'STORE OF THE YEAR\nOPTUS REDCLIFFE'), { pos: [-3.6, 1.3, wz + 0.02], w: 0.7, h: 0.44, cutout: true });
      Build.decal(Tex.sign('neon', 'open'), { pos: [-1.6, 1.3, wz + 0.02], w: 1.2, h: 0.6, emissive: 2, cutout: true });
      Build.decal(Tex.sign('hand', 'FILM NIGHT — FRIDAY'), { pos: [1.2, 1.2, wz + 0.02], w: 2.4, h: 0.9, cutout: true });
      ['blood', 'stain', 'crack', 'moss_patch', 'coffee_ring', 'footprints'].forEach((k, i) => Build.decal(k, { floor: true, pos: [-19 + i * 2.2, 0.012, wz + 2.2], w: 1.6, h: 1.6 }));
      Build.screenrot({ pos: [3.5, 2, wz + 0.03], w: 5, h: 4 });
      Build.godray({ pos: [-3, 4.5, wz + 2.5], dir: [0.2, -1, 0.35], w: 1.6, h: 6, color: DAY ? 0xfff0d0 : 0x9ab8ff, opacity: 0.4 });
      });
      if (PARAMS.has('rain')) Build.rain({});
      A.marker('mk_start', [0, 0, 2], Math.PI);
      A.data.cams = CAMS;
    },
  };

  CONTENT.dev.worldCam = name => {
    const A = Game.G.A; if (!A) return;
    if (name === 'fly') {
      const p = L(A, 'overview'), pose = { pos: p.pos.clone(), target: p.target.clone(), fov: 60 };
      let yaw = Math.atan2(p.target.x - p.pos.x, p.target.z - p.pos.z), pitch = -0.6;
      Director.manual(pose); Input.lock && Input.lock();
      if (!A.data.fly) A.data.fly = A.update(dt => {
        yaw -= Input.look.x; pitch = U.clamp(pitch - Input.look.y, -1.4, 1.4);
        const f = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)), rt = new THREE.Vector3(-Math.cos(yaw), 0, Math.sin(yaw));
        const sp = (Input.down('sprint') ? 24 : 7) * dt;
        pose.pos.addScaledVector(f, Input.move.y * sp).addScaledVector(rt, Input.move.x * sp);
        pose.target.copy(pose.pos).add(f);
      });
      return;
    }
    Director.manual(L(A, name));
  };
  CONTENT.dev.world = async G => {
    await G.area('SHOWROOM');
    const cam = PARAMS.get('cam');
    if (cam) CONTENT.dev.worldCam(cam);
    else { G.player(G.actor('chase', 'chase', 'mk_start')); G.control(true); }
  };
})();
