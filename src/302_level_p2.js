// ============================================================================
// Prologue P.2–P.4 — Bub's house, Redcliffe, 11:44 pm. Area P2, the flow beats prologue.P2 / prologue.P3 / prologue.P4,
// scenes P.2.up and P.2.sit (short, no letterbox), P.3 (the call: store and house intercut) and P.4 (home).
// Owned by: house agent.
//
// STAGE PLAN (area-local; P2 sits at world [500,0,0]. Scene data below converts with w(x,y,z) = [x+500, y, z].)
//   A small lowset brick house, floor y 0, ceilings 2.6. North = -Z (backyard), south = +Z (street, then the bay).
//   Bub's room      x -6.8..-3.2  z -5.0..-1.4   carpet; bed on the west wall (head north), fairy lights, desk under the
//                                                north window, band poster on the east wall, door on the east wall z -2.05
//   Hallway         x -3.2..-2.0  z -5.0.. 0.4   family photos on the east wall (baby_in_polo opposite Bub's door), hall
//                                                light left on for Dad; arch into the living area at z -1.4..0.2
//   Bathroom        x -6.8..-3.2  z -1.4.. 0.4   door ajar (blocked), nightlight · Chase's room x -6.8..-2.0 z 0.4..3.2
//                                                (door ajar, blocked: made bed, spare polo on a chair)
//   Living          x -2.0.. 5.2  z -5.0.. 3.2   kitchen along the north wall (bench, oven with the clock, fridge with the
//                                                photo and the report, the gift box on the bench), dining table, lounge:
//                                                couch at x 1.9 facing east, coffee table x 3.2 (breaks in P.4), TV on the
//                                                east wall, floor lamp at the couch's north end, front door (frosted glass)
//                                                on the south wall at x 0, front window x 2.2..4.4
//   Outside         front yard z 3.2..9.7, road along z 15.6, park, then black water with the bridge lights far off;
//                   next door (x 9..19) the Neighbour stands on his lawn at [8.6, -0.12, 8.8] staring at his phone.
//   One shadow light: the sodium streetlight at [7.0, 0, 11.6] (spot through the front window). Headlights: a spot that
//   rides Luke's car in P.4. Every light that changes state changes intensity only (no recompiles).
//
//   Markers (local)                                  notes
//   mk_start      [0.6, 0, -0.6]    π/2              dev free roam (living area)
//   mk_bub_bed    [-6.09, 0.45, -3.82] 0             Bub lying on her bed (pelvis ground point on the mattress)
//   mk_bub_up     [-5.0, 0, -3.6]   π/2              standing beside the bed
//   mk_couch      [2.1, 0.06, 0.72] π/2              seated on the couch facing the TV (mk_couch_front: standing in front)
//   mk_tv_btn     [4.3, 0, 1.95]    π/2              in front of the TV's corner (power button at [4.84, 0.7, 1.72])
//   mk_bub_p4     [2.85, 0, -0.55]  2.0              P.4 start: in the dark beside the couch
//   mk_bub_back   [4.35, 0, 2.2]    -1.75            P.4: backed into the corner by the window, in the streetlight
//   mk_bub_pulled [3.0, 0, -2.75]   0                where Luke pulls her to (the kitchen light: the face-hold)
//   mk_door_out   [0.0, -0.02, 3.72] π              the porch, facing the door (the Neighbour's silhouette)
//   mk_nb_in / mk_nb_tackle / mk_nb_down             the Neighbour's way in / where Chase hits him / on the broken table
//   mk_chase_out / mk_luke_out                       on the front path, out of sight (P.4 cast)
//   mk_neighbour  [8.6, -0.12, 8.8] -2.42            on his lawn
//
// HOOKS
//   prologue.P2   checkpoint beat: fresh house (the store P1 stays loaded but hidden for the P.3 intercut), Bub on her bed,
//                 lock-screen notification, "e – get up", free exploration (7 looks with Bub's lines, the oven clock runs
//                 11:44 -> 11:58), the couch, typing "proud of u dad. dont sell too m" (any key), DAD calling, "e – answer"
//   prologue.P3   the call (scene P.3), store and house intercut; builds both areas itself when started on its own
//   prologue.P4   P1 unloaded, the dark lounge (playable), Bub turns the TV off, two knocks, the silhouette, "Go away." —
//                 then scene P.4; ends on the three of them heading for the headlights (hard cut to prologue.P5)
//   p2.house / p2.store (scene cues)  switch hemisphere fills when a scene cuts between the house and the store
//   (internal: p2.getUp, p2.sit, p2.hangUp, p2.glass, p2.door, p2.car, p2.impact, p3.slam)
// ============================================================================
(() => {
  const PI = Math.PI, M = (n, o) => Tex.mat(n, o), C = (h, o) => Tex.color(h, o), V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const HT = 2.6, OX = 500, w = (x, y, z) => [x + OX, y, z];
  const MSG = 'proud of u dad. dont sell too m', DAD = 'Dad 🏆', NOTE = 'INFINITE is ready. Installs at 12:00. A feed that finally understands you.';
  const THREAD = [{ stamp: 'Today 11:39 PM' }, { from: 'me', text: 'wat time u home' }, { from: 'them', text: 'after midnight. go to bed. love u' }];
  const LINES = {
    poster: ['Dad says they\'re "a lot of noise." He sings them in the car.', 'smile'],
    photo: ['He was already working. Even then.', 'tender'],
    fridge: ['Worst photo ever. Best photo ever.', 'laugh'],
    report: ['Not looking at that.', 'ashamed'],
    gift: ['Took me four hours. The D kept falling off.', 'smile'],
    window: ['Mr… um. Neighbour. It\'s midnight, mate.', 'smirk'],
  };
  const NEWS = '…with the INFINITE update rolling out nationally at midnight. The network says it\'s the biggest update in the country\'s history, promising what developers call "a feed that finally understands you."';
  const BUB = { walk: 1.05, jog: 0, run: 0, accel: 5 };   // fluffy socks: slow, no run, soft steps
  const HK = CONTENT.hooks, P1 = () => Game.areas.get('P1'), P2 = () => Game.areas.get('P2');

  // ---- canvas helpers (area-owned textures: disposed with the area) ----------------------------------------------------
  function canvasTex(cw, ch, draw) {
    const c = document.createElement('canvas'); c.width = cw; c.height = ch; draw(c.getContext('2d'), cw, ch);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  // the front door's frosted panel: porch light behind it; the Neighbour's silhouette with a phone pressed to the glass; the
  // jagged rim left after it breaks
  function frost(kind) {
    return canvasTex(128, 256, (g, cw, ch) => {
      const gr = g.createLinearGradient(0, 0, 0, ch); gr.addColorStop(0, '#d8a270'); gr.addColorStop(0.45, '#9a7052'); gr.addColorStop(1, '#4a3a30');
      g.fillStyle = gr; g.fillRect(0, 0, cw, ch);
      const r = U.rng(7);
      for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(255,236,210,${(r() * 0.1).toFixed(3)})`; g.fillRect(r() * cw, r() * ch, 1 + r() * 2, 1 + r() * 2); }
      if (kind === 'sil') {
        g.filter = 'blur(6px)'; g.fillStyle = 'rgba(14,10,12,0.92)';
        g.beginPath(); g.ellipse(60, 72, 21, 27, 0.08, 0, 7); g.fill();
        g.beginPath(); g.moveTo(-8, ch); g.quadraticCurveTo(0, 116, 60, 104); g.quadraticCurveTo(124, 114, 136, ch); g.fill();
        g.filter = 'blur(12px)'; g.fillStyle = 'rgba(110,170,255,0.95)'; g.fillRect(40, 96, 46, 72);
        g.filter = 'blur(2.5px)'; g.fillStyle = '#e8f4ff'; g.fillRect(50, 106, 26, 50);
        g.filter = 'none';
      }
      if (kind === 'rim') {
        g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000'; g.beginPath();
        const pts = [[10, 22], [40, 8], [62, 30], [96, 12], [118, 40], [104, 92], [122, 150], [100, 206], [116, 246], [70, 226], [44, 250], [14, 214], [22, 150], [6, 96]];
        pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fill();
      }
    });
  }
  // Bub's phone screen seen in the room: her thread with Dad (the overlay carries the words)
  function msgTex(sending) {
    return canvasTex(128, 256, (g, cw, ch) => {
      g.fillStyle = '#f3f4f6'; g.fillRect(0, 0, cw, ch);
      g.fillStyle = '#e2e4e8'; g.fillRect(0, 0, cw, 40); g.fillStyle = '#9aa0aa'; g.beginPath(); g.arc(64, 17, 9, 0, 7); g.fill();
      const bub = (x, y, bw, bh, c) => { g.fillStyle = c; g.beginPath(); g.roundRect(x, y, bw, bh, 9); g.fill(); };
      bub(8, 56, 74, 20, '#2f7cf6'); bub(8, 84, 86, 30, '#dfe1e6');
      if (sending) { bub(30, 124, 90, 34, '#2f7cf6'); g.fillStyle = '#8a909a'; g.font = '11px sans-serif'; g.textAlign = 'right'; g.fillText('Sending…', 118, 174); }
      else { g.fillStyle = '#d3d6dc'; g.fillRect(0, 170, cw, 86); g.fillStyle = '#fff'; for (let rI = 0; rI < 4; rI++) for (let k = 0; k < 9; k++) g.fillRect(4 + k * 13.5, 176 + rI * 19, 11, 15); g.fillStyle = '#2f7cf6'; g.fillRect(6, 150, 70, 12); }
    });
  }
  // a sunset print of the bay over the TV (bought at the Sunday markets)
  function bayPrint() {
    return canvasTex(384, 240, (g, cw, ch) => {
      const sky = g.createLinearGradient(0, 0, 0, ch * 0.62); sky.addColorStop(0, '#3a3a6a'); sky.addColorStop(0.55, '#d8745a'); sky.addColorStop(1, '#f2c27a');
      g.fillStyle = sky; g.fillRect(0, 0, cw, ch * 0.62);
      g.fillStyle = '#ffe2a0'; g.beginPath(); g.arc(250, ch * 0.6, 26, 0, 7); g.fill();
      const sea = g.createLinearGradient(0, ch * 0.62, 0, ch); sea.addColorStop(0, '#c86a50'); sea.addColorStop(1, '#2a2a48'); g.fillStyle = sea; g.fillRect(0, ch * 0.62, cw, ch);
      g.fillStyle = 'rgba(255,220,150,0.5)'; for (let i = 0; i < 14; i++) g.fillRect(236 - i * 2, ch * 0.64 + i * 6, 28 + i * 4, 2);
      g.fillStyle = '#2a2020'; g.fillRect(0, ch * 0.6, 190, 5); for (let x = 6; x < 190; x += 16) g.fillRect(x, ch * 0.6, 3, 16);
      g.fillStyle = '#f6f3ea'; g.lineWidth = 0; g.strokeStyle = '#f6f3ea'; g.lineWidth = 14; g.strokeRect(0, 0, cw, ch);
    });
  }
  function glowTex() {
    return canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  }

  // ---- the house ---------------------------------------------------------------------------------------------------
  // axis-aligned walls with explicit faces: wx runs along X at z (north / south faces), wz along Z at x (west / east faces)
  const wx = (z, x1, x2, north, south, o = {}) => Build.wall(x1, z, x2, z, HT, south, Object.assign({ back: north, thick: 0.12 }, o));
  const wz = (x, z1, z2, west, east, o = {}) => Build.wall(x, z1, x, z2, HT, west, Object.assign({ back: east, thick: 0.12 }, o));

  function shell(A) {
    const brick = M('brick', { color: 0xc4906e }), bubW = M('plaster', { color: 0xaebcc4 }), hall = M('plaster', { color: 0xe4d9c6 }),
      living = M('plaster', { color: 0xe6ddcc }), bath = M('tiles', { color: 0xdde4e2 }), chaseW = M('plaster', { color: 0xcfcbbe }), ext = { thick: 0.24 };
    // exterior (brick outside)
    wx(-5.0, -6.92, -3.2, brick, bubW, Object.assign({ windows: [{ at: 2.42, w: 1.2, h: 1.1, sill: 1.0 }] }, ext));
    wx(-5.0, -3.2, -2.0, brick, hall, ext);
    wx(-5.0, -2.0, 5.32, brick, living, Object.assign({ windows: [{ at: 3.0, w: 1.4, h: 0.95, sill: 1.15 }] }, ext));
    wx(3.2, -6.92, -2.0, chaseW, brick, Object.assign({ windows: [{ at: 2.52, w: 1.2, h: 1.1, sill: 0.95 }] }, ext));
    wx(3.2, -2.0, 5.32, living, brick, Object.assign({ doors: [{ at: 2.0, w: 0.98, h: 2.1 }], windows: [{ at: 5.3, w: 2.2, h: 1.45, sill: 0.75 }] }, ext));
    wz(-6.8, -5.0, -1.4, brick, bubW, ext); wz(-6.8, -1.4, 0.4, brick, bath, ext); wz(-6.8, 0.4, 3.2, brick, chaseW, ext);
    wz(5.2, -5.0, 3.2, living, brick, ext);
    // interior
    wz(-3.2, -5.0, -1.4, bubW, hall, { doors: [{ at: 2.95, w: 0.9, h: 2.1 }] });
    wx(-1.4, -6.8, -3.2, bubW, bath);
    wz(-3.2, -1.4, 0.4, bath, hall, { doors: [{ at: 0.9, w: 0.86, h: 2.1 }] });
    wx(0.4, -6.8, -3.2, bath, chaseW);
    wx(0.4, -3.2, -2.0, hall, chaseW, { doors: [{ at: 0.6, w: 0.9, h: 2.1 }] });
    wz(-2.0, -5.0, 0.4, hall, living, { doors: [{ at: 4.4, w: 1.6, h: 2.25 }] });
    wz(-2.0, 0.4, 3.2, chaseW, living);
    // floors and ceiling
    Build.floor(-6.8, -5.0, -3.2, -1.4, M('carpet', { color: 0x8e8a92 }), { surface: 'carpet' });
    Build.floor(-3.2, -5.0, -2.0, 0.4, M('floorboards', { color: 0xa88e72 }), { surface: 'wood' });
    Build.floor(-6.8, -1.4, -3.2, 0.4, M('tiles', { color: 0xc8ccc8 }), { surface: 'tile' });
    Build.floor(-6.8, 0.4, -2.0, 3.2, M('carpet', { color: 0x6a6660 }), { surface: 'carpet' });
    Build.floor(-2.0, -5.0, 5.2, -3.3, M('tiles', { color: 0xd6cfc0 }), { surface: 'tile' });
    Build.floor(-2.0, -3.3, 5.2, 3.2, M('floorboards', { color: 0xa88e72 }), { surface: 'wood' });
    Build.box(12.5, 0.1, 8.7, M('plaster', { color: 0xf0ece4 }), { pos: [-0.8, HT, -0.9], block: false, cam: true, sight: false, ao: false });
    Build.roof({ x: -0.8, z: -0.9, y: HT + 0.06, w: 12.24, d: 8.44, kind: 'hip', pitch: 0.42, mat: M('roof_tiles', { color: 0x9a5a44 }) });
    // doors
    Build.prop('interior_door', { pos: [-3.2, 0, -2.05], yaw: -PI / 2, w: 0.82, open: 0.95, thick: 0.12 });
    Build.prop('interior_door', { pos: [-3.2, 0, -0.5], yaw: -PI / 2, w: 0.78, open: 0.16, thick: 0.12 });
    Build.prop('interior_door', { pos: [-2.6, 0, 0.4], yaw: 0, w: 0.82, open: 0.22, thick: 0.12 });
  }

  function bubRoom(A, D) {
    Build.prop('bed', { pos: [-6.13, 0, -3.84], w: 1.07, color: 0xd9a6c4, head: 0x6e5a7e, toy: true });
    Build.prop('bedside_table', { pos: [-5.3, 0, -4.64], on: true });
    Build.prop('desk', { pos: [-4.3, 0, -4.56], w: 1.2 });
    Build.prop('chair', { pos: [-4.15, 0, -3.95], yaw: PI + 0.35, kind: 'office', color: 0x5a4a6a });
    Build.box(0.44, 0.07, 0.36, M('fabric', { color: 0x3a5a7a }), { pos: [-4.12, 0.5, -3.88], yaw: 0.4, bevel: 0.03, solid: false });   // her hoodie on the chair
    Build.prop('window', { pos: [-4.5, 1.0, -5.0], w: 1.2, h: 1.1, color: 0xe6c2d4, open: 0.3 });
    Build.prop('wardrobe', { pos: [-5.9, 0, -1.78], yaw: PI, w: 1.2, color: 0xe8e2d8, mirror: true });
    Build.prop('rug', { pos: [-4.7, 0, -3.05], w: 1.7, d: 1.15, color: 0x5a86a0, border: 0xe8d8e0 });
    Build.prop('school_bag', { pos: [-3.62, 0, -3.35], yaw: -1.85, color: 0x2a3a5a });
    Build.poster('band', { pos: [-3.27, 1.62, -3.55], yaw: -PI / 2, w: 0.62 });
    Build.poster('school_notice', { pos: [-3.27, 1.5, -4.45], yaw: -PI / 2, w: 0.34 });
    Build.poster('fitness', { pos: [-4.55, 1.55, -1.47], yaw: PI, w: 0.36 });
    // clothes on the floor, sneakers, a stack of books
    const fab = c => M('fabric', { color: c });
    for (const [x, z, sx, sz, yaw, c] of [[-5.05, -2.25, 0.5, 0.36, 0.5, 0x2a2a30], [-4.8, -2.05, 0.34, 0.3, -0.3, 0xe86a8a], [-3.9, -2.4, 0.42, 0.3, 1.1, 0x6a8a5a]])
      Build.box(sx, 0.05, sz, fab(c), { pos: [x, 0.005, z], yaw, bevel: 0.02, solid: false });
    for (const [x, z, yaw] of [[-3.75, -2.0, 0.3], [-3.62, -1.92, 0.1]]) Build.box(0.11, 0.08, 0.27, C(0xf0f0f0, { rough: 0.6 }), { pos: [x, 0, z], yaw, bevel: 0.03, solid: false });
    // polaroids pegged along the fairy lights
    const shots = ['fridge_faces', 'store_team', 'launch_night', 'fridge_faces', 'baby_in_polo'];
    shots.forEach((k, i) => Build.decal(Tex.photo(k), { pos: [-6.67, 1.96 - (i % 2) * 0.05, -2.2 - i * 0.55], yaw: PI / 2, w: 0.14, h: k === 'baby_in_polo' ? 0.18 : 0.11, spin: (i % 2 ? 0.08 : -0.06) }));
    Build.fairyLights({ points: [[-6.66, 2.2, -1.62], [-6.66, 2.22, -3.3], [-6.66, 2.2, -4.85], [-5.2, 2.28, -4.86], [-3.36, 2.2, -4.86]], color: 0xffb896, per: 7, sag: 0.16 });
    Build.prop('ceiling_light', { pos: [-5.0, HT, -3.2], kind: 'pendant', on: false });
    // the new phone glowing on the duvet
    D.bedPhone = Build.prop('phone', { pos: [-5.88, 0.585, -3.2], yaw: 0.5, screen: 'lock', k: 1.4, dynamic: true, solid: false, blob: false });
    D.bedGlow = Build.glow({ pos: [-5.88, 0.64, -3.2], color: 0x7ab0ff, size: 0.55, opacity: 0.6, dynamic: true });
  }

  function hallway(A, D) {
    Build.prop('photo_frame', { pos: [-2.07, 1.5, -2.08], yaw: -PI / 2, kind: 'baby_in_polo', w: 0.34 });
    Build.prop('photo_frame', { pos: [-2.07, 1.62, -3.25], yaw: -PI / 2, kind: 'store_team', w: 0.42 });
    Build.prop('photo_frame', { pos: [-2.07, 1.38, -3.9], yaw: -PI / 2, kind: 'fridge_faces', w: 0.26 });
    Build.prop('photo_frame', { pos: [-3.13, 1.55, -4.2], yaw: PI / 2, kind: 'launch_night', w: 0.3 });
    Build.box(0.9, 0.78, 0.3, M('wood', { color: 0x6a4a32 }), { pos: [-2.6, 0, -4.72], bevel: 0.01 });
    Build.prop('photo_frame', { pos: [-2.85, 0.78, -4.76], kind: 'store_team', w: 0.16, stand: true });
    Build.box(0.2, 0.05, 0.2, C(0xb07a4a, { rough: 0.4 }), { pos: [-2.4, 0.78, -4.7], bevel: 0.02, solid: false });   // the key bowl, empty
    Build.prop('ceiling_light', { pos: [-2.6, HT, -2.7], kind: 'pendant', on: true });
    Build.glow({ pos: [-3.55, 0.28, -0.62], color: 0x9affc0, size: 0.22, opacity: 0.8 });                                  // bathroom nightlight
    Build.pool({ pos: [-2.9, 0, -0.5], r: 0.8, color: 0x9affc0, opacity: 0.08 });
    // Chase's room, glimpsed through the gap: a made bed, the spare polo on a chair
    Build.prop('bed', { pos: [-5.6, 0, 1.82], yaw: PI / 2, w: 1.53, color: 0x6a707a, head: 0x3a3a40, messy: false });
    Build.prop('chair', { pos: [-2.75, 0, 2.55], yaw: -2.6, kind: 'dining' });
    Build.box(0.44, 0.06, 0.4, M('fabric', { color: 0xf2c418 }), { pos: [-2.72, 0.46, 2.52], yaw: -2.6, bevel: 0.03, solid: false });
    Build.prop('window', { pos: [-4.4, 0.95, 3.2], yaw: PI, w: 1.2, h: 1.1, curtains: false, blind: true });
  }

  function living(A, D) {
    // kitchen
    Build.prop('kitchen_bench', { pos: [1.8, 0, -4.57], w: 3.0, sink: -0.8, cooktop: false, color: 0xe8e2d4 });
    D.oven = Build.prop('oven', { pos: [3.62, 0, -4.58], time: '11:44' });
    D.fridge = Build.prop('fridge', { pos: [4.6, 0, -4.53], dynamic: true });
    D.gift = Build.prop('gift_box', { pos: [2.35, 0.9, -4.42], yaw: 0.35 });
    Build.prop('window', { pos: [1.0, 1.15, -5.0], w: 1.4, h: 0.95, curtains: false, blind: true });
    Build.box(2.7, 0.02, 0.05, C(0xfff2d8, { emissive: 0xffd8a0, emissiveIntensity: 1.3 }), { pos: [1.8, 1.14, -4.6], solid: false });   // strip light under the cupboards
    Build.box(0.35, 0.3, 0.3, C(0xd8dcd8, { rough: 0.4 }), { pos: [0.1, 0.9, -4.63], bevel: 0.03, solid: false });                    // microwave-ish appliance
    // dining: dinner for one, school books
    Build.prop('dining_table', { pos: [0.3, 0, -2.45], w: 1.6, d: 0.9 });
    Build.box(0.24, 0.02, 0.24, C(0xf2efe8, { rough: 0.35 }), { pos: [-0.2, 0.75, -2.2], bevel: 0.01, solid: false });
    Build.box(0.3, 0.04, 0.22, C(0x2a6ad8, { rough: 0.7 }), { pos: [0.6, 0.75, -2.55], yaw: 0.2, solid: false });
    Build.box(0.28, 0.03, 0.21, C(0xe0503a, { rough: 0.7 }), { pos: [0.64, 0.79, -2.53], yaw: -0.1, solid: false });
    Build.box(0.34, 0.02, 0.24, C(0xa8aeb4, { rough: 0.35, metal: 0.6 }), { pos: [0.95, 0.75, -2.3], yaw: -0.3, solid: false });
    Build.prop('crate', { pos: [-1.5, 0, -0.95], kind: 'plastic', w: 0.55, h: 0.32, d: 0.4, color: 0xe8e8e0 });                        // washing basket
    Build.box(0.46, 0.1, 0.34, M('fabric', { color: 0x9ab0c8 }), { pos: [-1.5, 0.3, -0.95], bevel: 0.04, solid: false });
    // lounge
    Build.prop('rug', { pos: [3.25, 0, 1.2], yaw: PI / 2, w: 2.4, d: 1.8, color: 0x7a4a3a, border: 0xd8c8a8 });
    Build.prop('couch', { pos: [1.9, 0, 1.2], yaw: PI / 2, w: 2.1, color: 0x56687a });
    D.table = Build.prop('coffee_table', { pos: [3.2, 0, 1.2], yaw: PI / 2, dynamic: true });
    D.tv = Build.prop('tv', { pos: [4.85, 0, 1.2], yaw: -PI / 2, w: 1.1, light: 1.6 });
    D.lampOn = Build.prop('lamp', { pos: [1.72, 0, -0.22], kind: 'floor', dynamic: true });
    D.lampOff = Build.prop('lamp', { pos: [1.72, 0, -0.22], kind: 'floor', on: false, dynamic: true, solid: false, blob: false });
    D.lampOff.visible = false;
    Build.prop('ceiling_fan', { pos: [3.1, HT, 1.2], spin: 0.35 });
    Build.prop('bookshelf', { pos: [-1.78, 0, 2.2], yaw: PI / 2, w: 0.9, h: 1.8 });
    // Dad's trophies on top of the shelf
    Build.decal(Tex.sign('plaque', 'REP OF THE YEAR\nOPTUS REDCLIFFE'), { pos: [-1.925, 1.95, 2.0], yaw: PI / 2, w: 0.3, h: 0.19 });
    for (const [z, h] of [[2.35, 0.26], [2.55, 0.2]]) { Build.box(0.08, 0.04, 0.08, C(0x2a2a2a), { pos: [-1.78, 1.8, z], solid: false }); Build.box(0.05, h, 0.05, C(0xd8b04a, { rough: 0.25, metal: 0.9 }), { pos: [-1.78, 1.84, z], bevel: 0.02, solid: false }); }
    Build.prop('plant_pot', { pos: [4.85, 0, 2.85], kind: 'fern' });
    Build.box(1.12, 0.74, 0.04, M('wood', { color: 0x3a2a1e }), { pos: [5.06, 1.36, 1.2], yaw: PI / 2, solid: false });
    Build.mesh(new THREE.PlaneGeometry(1.04, 0.66), new THREE.MeshStandardMaterial({ map: bayPrint(), roughness: 0.5 }), { pos: [5.035, 1.73, 1.2], yaw: -PI / 2, shadow: false });
    Build.box(0.62, 0.74, 0.32, M('wood', { color: 0x6a4a32 }), { pos: [1.25, 0, 2.9], bevel: 0.01 });                               // hall table by the door
    Build.box(0.16, 0.05, 0.2, C(0x1a1b1d, { rough: 0.4 }), { pos: [1.12, 0.74, 2.9], yaw: 0.2, bevel: 0.01, solid: false });     // cordless landline base
    Build.box(0.012, 0.012, 0.004, C(0x40ff70, { emissive: 0x40ff70, emissiveIntensity: 3 }), { pos: [1.07, 0.792, 2.99], solid: false });
    Build.box(0.25, 0.012, 0.18, C(0xf0ece2, { rough: 0.9 }), { pos: [1.4, 0.74, 2.88], yaw: -0.3, solid: false });                  // mail
    D.frontWin = Build.prop('window', { pos: [3.3, 0.75, 3.2], yaw: PI, w: 2.2, h: 1.45, color: 0xb8a888, open: 0.8 });
    // front door: frosted panel drawn by hand so the porch light (and later the silhouette) shows through
    D.door = Build.prop('front_door', { pos: [0.0, 0, 3.2], yaw: PI, w: 0.87, thick: 0.24 });
    const leaf = D.door.userData.door, lw = 0.862, fm = new THREE.MeshBasicMaterial({ map: frost('idle'), color: 0xffffff });
    leaf.userData.glass.visible = false;
    D.frost = { idle: fm.map, sil: frost('sil'), rim: frost('rim'), mat: fm };
    D.frostMesh = new THREE.Mesh(new THREE.PlaneGeometry(lw * 0.5, 0.8), fm);
    D.frostMesh.position.set(lw / 2, 1.35, 0.24 / 2 - 0.03 + 0.025); leaf.add(D.frostMesh);
    D.frostOut = new THREE.Mesh(new THREE.PlaneGeometry(lw * 0.5, 0.8), fm);
    D.frostOut.position.set(lw / 2, 1.35, 0.24 / 2 - 0.03 - 0.025); D.frostOut.rotation.y = PI; leaf.add(D.frostOut);
    D.rim = new THREE.Mesh(new THREE.PlaneGeometry(lw * 0.5, 0.8), new THREE.MeshBasicMaterial({ map: D.frost.rim, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }));
    D.rim.position.copy(D.frostMesh.position); D.rim.visible = false; leaf.add(D.rim);
    D.shards = Build.scatter('glass', { box: [-0.55, 2.35, 0.65, 3.05], count: 34, seed: 4 }); D.shards.visible = false;
    // by the door: shoes, key hook
    for (const [x, z, yaw, c] of [[0.75, 2.85, 0.2, 0x1a1a1a], [0.88, 2.9, 0.4, 0x1a1a1a], [-0.72, 2.9, -0.3, 0xe8e4f0], [-0.6, 2.95, -0.1, 0xe8e4f0]])
      Build.box(0.1, 0.09, 0.27, C(c, { rough: 0.5 }), { pos: [x, 0, z], yaw, bevel: 0.03, solid: false });
    Build.box(0.3, 0.06, 0.03, M('wood', { color: 0x6a4a32 }), { pos: [0.72, 1.55, 3.06], solid: false });
    Build.prop('ceiling_light', { pos: [0.8, HT, -2.4], kind: 'pendant', on: false });
    // the phone the Neighbour drops when Chase hits him: face up, still scrolling
    D.floorPhone = Build.prop('phone', { pos: [2.55, 0.01, 2.15], yaw: 2.2, screen: 'feed', k: 1.3, dynamic: true, solid: false, blob: false });
    D.floorPhone.visible = false;
  }

  function outside(A, D) {
    const grass = M('grass', { color: 0x5a6a44 }), conc = M('concrete', { color: 0xb8b2a6 });
    Build.floor(-16, -14, 26, 9.7, grass, { y: -0.12, surface: 'grass' });
    Build.floor(-1.0, 3.32, 1.0, 4.4, conc, { y: -0.02, surface: 'concrete' });                                                   // porch
    Build.floor(-0.55, 4.4, 0.55, 9.7, conc, { y: -0.1, surface: 'concrete' });                                                  // path
    Build.floor(-5.6, 3.32, -2.6, 9.7, conc, { y: -0.1, surface: 'concrete' });                                                  // empty driveway
    Build.decal(Tex.decal('oil'), { pos: [-4.1, -0.095, 5.6], w: 1.2, h: 1.0, floor: true, opacity: 0.8 });
    Build.box(0.7, 0.02, 0.45, C(0x3a3028, { rough: 1 }), { pos: [0, -0.02, 3.62], solid: false });                               // doormat
    Build.box(0.16, 0.12, 0.08, C(0x2a2a2a), { pos: [0.72, 2.1, 3.36], solid: false });                                          // porch light
    Build.glow({ pos: [0.72, 2.12, 3.44], color: 0xffc880, size: 0.7, opacity: 0.9 });
    Build.prop('plant_pot', { pos: [0.85, -0.02, 3.85], kind: 'palm', s: 0.8 });
    Build.prop('letterbox', { pos: [1.3, -0.12, 9.3], number: '14' });
    Build.prop('bin', { pos: [-6.4, -0.12, 9.3], kind: 'wheelie' }); Build.prop('bin', { pos: [-7.1, -0.12, 9.35], kind: 'recycle' });   // bin night
    Build.tree('palm', { pos: [5.9, -0.12, 6.9], scale: 0.75, seed: 3 });
    Build.tree('fig', { pos: [-9.5, -0.12, 6.0], scale: 0.7, seed: 8 });
    // street, verge, the park, the bay
    Build.road({ from: [-60, 15.6], to: [70, 15.6], width: 7, lines: 'dashed', y: -0.14 });
    Build.streetlight({ pos: [7.0, -0.12, 11.6], kind: 'road', light: false });
    Build.streetlight({ pos: [-26, -0.12, 11.6], kind: 'road', light: false });
    Build.streetlight({ pos: [34, -0.12, 11.6], kind: 'road', light: false });
    Build.floor(-60, 21.5, 70, 30, grass, { y: -0.14, surface: 'grass' });
    for (const [x, z, s] of [[-12, 25, 1.0], [6, 26, 1.15], [24, 24.5, 0.9]]) Build.tree('palm', { pos: [x, -0.14, z], scale: s, seed: x });
    Build.prop('bench', { pos: [1.5, -0.14, 24.5], yaw: PI });
    Build.streetlight({ pos: [14, -0.14, 28.5], kind: 'heritage', light: false });
    Build.box(130, 0.6, 1.2, M('sandstone', { color: 0x8a8070 }), { pos: [5, -0.74, 30.3], solid: false });
    Build.water({ x1: -140, z1: 30.8, x2: 160, z2: 220, y: -1.0, dark: true });
    // the Houghton Highway bridge far across the water: a string of sodium lights with their reflections (no fog: they are the
    // only thing out there)
    const gt = glowTex(), bridgeM = new THREE.PointsMaterial({ map: gt, color: 0xffa650, size: 7, sizeAttenuation: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    const bp = [], refl = [];
    for (let x = -170; x <= 90; x += 7) { const y = 3.2 + Math.sin(x * 0.01) * 0.6; bp.push(x, y, 190 - x * 0.12); refl.push(new THREE.PlaneGeometry(0.9, 9).translate(x, -1 - 4.5, 190 - x * 0.12 - 0.2)); }
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3));
    A.add(new THREE.Points(bg, bridgeM));
    A.add(Object.assign(new THREE.Mesh(mergeGeometries(refl), new THREE.MeshBasicMaterial({ map: gt, color: 0x6a3a14, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })), { renderOrder: 3 }));
    // next door: brick, a blue window, porch light on, front door open, the car in the drive; the fence between
    Build.room({ x: 14, z: -1.2, w: 10, d: 9.6, h: 2.6, wall: M('plaster', { color: 0xd8d0c0 }), outside: M('brick', { color: 0xb88a70 }), floor: false, ceil: false,
      windows: [{ side: 's', at: -2.2, w: 1.8, h: 1.3, sill: 0.8 }, { side: 'w', at: 0.5, w: 1.2, h: 1.1, sill: 0.95 }], doors: [{ side: 's', at: 1.8, w: 0.95, h: 2.1 }] });
    Build.roof({ x: 14, z: -1.2, y: 2.66, w: 10.3, d: 9.9, kind: 'hip', pitch: 0.4, mat: M('roof_tiles', { color: 0x6a6a70 }) });
    Build.box(1.7, 1.25, 0.02, C(0x0a1020, { emissive: 0x3a70d0, emissiveIntensity: 0.45 }), { pos: [11.8, 0.82, 3.52], solid: false });
    Build.box(0.9, 2.05, 0.02, C(0x1a1410, { emissive: 0xffb070, emissiveIntensity: 0.55 }), { pos: [15.8, 0, 3.3], solid: false });
    Build.glow({ pos: [15.0, 2.2, 3.75], color: 0xffc880, size: 0.8, opacity: 0.85 });
    Build.pool({ pos: [15.8, -0.1, 4.6], r: 2.2, color: 0xffb870, opacity: 0.22 });
    Build.floor(15.2, 3.6, 16.4, 9.7, conc, { y: -0.1, surface: 'concrete' });
    Build.car('sedan', { pos: [17.9, -0.12, 6.2], yaw: PI, color: 0x9a9c9e });
    Build.prop('letterbox', { pos: [14.4, -0.12, 9.3], kind: 'post' });
    Build.prop('fence', { kind: 'colorbond', pos: [7.35, -0.12, -12], yaw: -PI / 2, length: 15.6, h: 1.8 });
    // the backyard, dark through Bub's window and the kitchen's: back fence, Hills hoist, mango tree, shed
    Build.prop('fence', { pos: [-14, -0.12, -12.2], length: 21.3 });
    Build.tree('fig', { pos: [3.2, -0.12, -9.6], scale: 0.85, seed: 12 });
    const hoist = C(0x9a9c98, { rough: 0.4, metal: 0.6 });
    Build.box(0.06, 2.1, 0.06, hoist, { pos: [-2.4, -0.12, -8.6] });
    for (let i = 0; i < 4; i++) Build.box(2.6, 0.04, 0.04, hoist, { pos: [-2.4, 1.92, -8.6], yaw: i * PI / 4 + 0.3, solid: false });
    Build.box(2.2, 2.0, 1.8, M('corrugated', { color: 0x7a8474 }), { pos: [-9.4, -0.12, -9.6] });
    Build.box(2.5, 0.06, 2.1, M('corrugated', { color: 0x8a9484 }), { pos: [-9.4, 1.88, -9.6], rot: [0.12, 0, 0], solid: false });
  }

  // ---- area ----------------------------------------------------------------------------------------------------------
  CONTENT.levels.P2 = {
    name: "Bub's house — Redcliffe, 11:44 pm", origin: [OX, 0, 0],
    grade: 'launch_home', fog: { color: 0x0a0d16, near: 16, far: 95 }, background: 0x06080e, amb: 'house_night', surface: 'wood',
    env: { top: 0x0e1424, horizon: 0x2c2426, bottom: 0x070707, intensity: 0.45, spots: [{ dir: [0.1, 0.35, 1], color: 0xff9a40, power: 2.2 }] },
    build(A) {
      const D = A.data;
      Object.assign(D, { seen: 0, min: 44, explore: false, tweens: [], loops: [], mats: [] });
      shell(A);
      bubRoom(A, D); hallway(A, D); living(A, D); outside(A, D);
      // ---- light: sodium through the front window (the one shadow), warm practicals, a cool moonlit fill ------------------
      D.hemi = Build.hemi({ sky: 0x243048, ground: 0x0e0c0a, intensity: 0.32 });
      D.street = Build.light('spot', { pos: [7.0, 5.6, 13.1], target: [5.0, 0, 4.3], color: 0xff9a3c, intensity: 340, distance: 30, angle: 0.64, penumbra: 0.6, shadow: true });
      D.street.shadow.camera.far = 30;
      Build.pool({ pos: [7.0, -0.1, 12.6], r: 4.5, color: 0xff9a40, opacity: 0.18 });
      D.fairy = Build.light('point', { pos: [-5.5, 1.7, -3.5], color: 0xffb38a, intensity: 2.2, distance: 5.5 });
      D.hall = Build.light('point', { pos: [-2.6, 2.2, -2.7], color: 0xffcf98, intensity: 1.1, distance: 5 });
      D.lamp = Build.light('point', { pos: [1.72, 1.4, -0.22], color: 0xffc080, intensity: 3.2, distance: 7 });
      D.kitchen = Build.light('point', { pos: [1.8, 1.1, -4.3], color: 0xffd6a0, intensity: 1.6, distance: 4.5 });
      D.porch = Build.light('point', { pos: [0.7, 2.1, 3.7], color: 0xffc070, intensity: 2.2, distance: 7 });
      D.head = Build.light('spot', { pos: [0, 1, 20], target: [0, 0, 0], color: 0xf4f0e6, intensity: 0, distance: 40, angle: 0.5, penumbra: 0.5 });
      D.car = Build.car('hatch', { pos: [-30, -0.14, 14.6], yaw: PI / 2, color: 0x3a4652, lights: true, beams: true, dynamic: true });
      D.car.visible = false;
      Build.dust({ box: [-2, 0.3, -4.8, 5, 2.4, 3], count: 120, opacity: 0.16, size: 0.013 });
      Build.dust({ box: [-6.7, 0.3, -4.9, -3.3, 2.4, -1.5], count: 60, opacity: 0.2, size: 0.013, color: 0xffd0b8 });
      // ---- the Neighbour on his lawn -------------------------------------------------------------------------------
      const nb = D.neighbour = A.char('neighbour', { name: 'neighbour', at: [8.6, -0.12, 8.8], yaw: -2.42 });
      if (!nb.held('r')) nb.hold('phone');
      nb.pose('phone'); nb.phoneGlow(true);
      // ---- markers -------------------------------------------------------------------------------------------------
      for (const [n, p, y] of [['mk_start', [0.6, 0, -0.6], PI / 2], ['mk_bub_bed', [-6.21, 0.45, -3.82], 0], ['mk_bub_up', [-5.0, 0, -3.6], PI / 2],
        ['mk_couch', [2.1, 0.06, 0.72], PI / 2], ['mk_couch_front', [2.78, 0, 0.72], PI / 2], ['mk_tv_btn', [4.2, 0, 1.95], PI / 2],
        ['mk_bub_p4', [2.85, 0, -0.55], 2.0], ['mk_bub_back', [4.35, 0, 2.2], -1.4], ['mk_bub_pulled', [3.0, 0, -2.75], 0],
        ['mk_door_out', [0.0, -0.02, 3.72], PI], ['mk_nb_in', [0.3, 0, 2.45], 1.2], ['mk_nb_tackle', [2.95, 0, 2.25], 1.6], ['mk_nb_down', [3.15, 0.12, 1.15], 1.9],
        ['mk_chase_out', [0.25, -0.1, 7.5], PI], ['mk_luke_out', [-0.35, -0.1, 8.4], PI], ['mk_neighbour', [8.6, -0.12, 8.8], -2.42]]) A.marker(n, p, y);
      // ---- things to look at (P.2) --------------------------------------------------------------------------------------
      const pt = (o, x = 0, y = 0, z = 0) => o.getWorldPosition(V()).add(V(x, y, z));
      const can = () => D.explore && !Dialogue.busy;
      const looks = [
        ['poster', [-3.7, 0, -3.55], 1.3, () => A.w([-3.27, 1.62, -3.55])],
        ['photo', [-2.5, 0, -2.08], 1.2, () => A.w([-2.07, 1.5, -2.08]), 'point'],
        ['fridge', [4.5, 0, -3.8], 1.3, () => pt(D.fridge.userData.photo), 'point'],
        ['report', [4.5, 0, -3.8], 1.3, () => pt(D.fridge.userData.report), null, () => D.seenFridge],
        ['gift', [2.35, 0, -3.85], 1.3, () => A.w([2.35, 0.95, -4.52]), 'hand_over'],
        ['window', [3.3, 0, 2.55], 1.5, () => nb.point('head')],
      ];
      for (const [key, at, r, target, gest, extra] of looks) A.interactable({ at, r, prompt: 'e – look', cond: () => can() && (!extra || extra()), use: G => look(G, key, target(), gest) });
      A.interactable({ at: [4.1, 0, 1.3], r: 1.35, prompt: 'e – turn on', cond: can, use: G => tvOn(G) });
      // ---- per frame: the oven clock, tweens, the headlights riding the car --------------------------------------------------
      A.update((dt, t) => {
        if (D.explore) {
          const m = Math.min(58, 44 + D.seen * 2 + Math.floor((t - D.t0) / 12));
          if (m !== D.min) { D.min = m; D.oven.userData.setTime('11:' + m); }
        }
        for (let i = D.tweens.length - 1; i >= 0; i--) {
          const q = D.tweens[i]; q.t += dt; const k = U.ease.inOut(U.clamp(q.t / q.dur));
          q.c.root.position.lerpVectors(q.from, q.to, k); if (q.yaw != null) q.c.yaw = q.y0 + U.wrapAngle(q.yaw - q.y0) * k;
          if (k >= 1) D.tweens.splice(i, 1);
        }
        if (D.drive) driveCar(D, dt);
      });
    },
    unload(A) {
      const D = A.data;
      for (const l of D.loops) l.stop(0.3);
      for (const m of D.mats) { if (m.map) m.map.dispose(); m.dispose(); }
      for (const t of Object.values(D.frost)) if (t.isTexture) t.dispose();
      for (const id of ['bub', 'chase', 'luke']) { const c = Game.actors[id]; if (c && c.pairOf) c.pairOf.detach(); }
    },
  };

  // ---- runtime helpers ---------------------------------------------------------------------------------------------------
  function tween(c, to, yaw, dur) { const D = P2().data; D.tweens.push({ c, from: c.root.position.clone(), to: to.isVector3 ? to.clone() : P2().w(to), y0: c.yaw, yaw, t: 0, dur }); }
  function screen(ph, tex) {   // a lit screen material for a held phone
    const D = P2().data, m = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(0.62, 0.64, 0.7), toneMapped: false });
    D.mats.push(m); ph.userData.screen.material = m; return m;
  }
  // the store P1 stays loaded (hidden) through P.2 for the P.3 intercut. It comes back — lights included, so the shaders
  // recompile once — when Bub sits down to text (a pause on an input press), and both stay lit through P.3; the hemisphere
  // fills are swapped on every cut between the two.
  let storeHidden = [];
  function storeVisible(on) {
    const A = P1(); if (!A || A.group.visible === on) return;
    A.group.visible = on;
    if (!on) storeHidden = A.chars.filter(c => c.root.visible);
    for (const c of on ? storeHidden : A.chars) c.setVisible(on);
    for (const id of ['chase', 'luke']) if (Game.actors[id]) Game.actors[id].setVisible(on);
  }
  let storeHemi = null;
  function fills(house) {
    const A = P1(), h = A && A.group.children.find(o => o.isHemisphereLight);
    if (h) { if (storeHemi == null) storeHemi = h.intensity; h.intensity = house ? 0 : storeHemi; }
    const B = P2(); if (B) B.data.hemi.intensity = house ? 0.32 : 0;
  }
  HK['p2.house'] = G => { G.look('P2'); fills(true); };
  HK['p2.store'] = G => { G.look('P1'); fills(false); };

  async function look(G, key, at, gest) {
    const bub = G.who('bub'), D = P2().data, [text, emote] = LINES[key];
    bub.lookAt(at); Play.nudge(at, 2.6);
    if (gest) bub.gesture(gest, { to: at, hand: 'l' });
    if (key === 'fridge') D.seenFridge = true;
    await G.say('bub', text, { emote, to: at });
    D.seen++;
    if (!Dialogue.busy) bub.lookAt(null);
  }
  async function tvOn(G) {
    const A = P2(), D = A.data, bub = G.who('bub'), scr = A.w([4.83, 0.9, 1.2]);
    bub.lookAt(scr); bub.gesture('hand_over', { to: A.w([4.76, 0.72, 1.74]), hand: 'l' });
    await G.wait(0.55);
    D.tv.userData.setScreen('news'); G.sfx('tv_on', { pos: scr, vol: 0.7 }); Play.nudge(scr, 3);
    await G.say('newsreader', NEWS, { via: 'tv', to: scr });
    D.seen++;
    if (!D.tvLoop) D.loops.push(D.tvLoop = Audio.loop('tv_murmur', { pos: scr, vol: 0.35 }));
    if (!Dialogue.busy) bub.lookAt(null);
  }
  // ease the gameplay camera round to a heading (after a scripted move)
  function turnCam(yaw, dur) {
    const A = P2(), from = Play.camYaw; let t = 0;
    const f = A.update(dt => { t += dt; Play.camYaw = from + U.wrapAngle(yaw - from) * U.ease.inOut(U.clamp(t / dur)); if (t >= dur) A.updaters.splice(A.updaters.indexOf(f), 1); });
  }
  // Luke's car: in along the street from the west, a left turn onto the kerb, headlights across the front window
  const ROUTE = [[-30, 14.6], [-9, 14.6], [-3, 14.2], [0.2, 12.6], [0.9, 10.9]];
  let routeCurve = null;
  function driveCar(D, dt) {
    const c = routeCurve || (routeCurve = new THREE.CatmullRomCurve3(ROUTE.map(([x, z]) => V(x, -0.14, z))));
    D.drive.t += dt;
    const u = U.ease.out(U.clamp(D.drive.t / 4.2)), p = c.getPointAt(u), tn = c.getTangentAt(Math.min(0.999, u));
    D.car.position.copy(p); D.car.rotation.y = Math.atan2(tn.x, tn.z);
    const A = P2(), f = V(Math.sin(D.car.rotation.y), 0, Math.cos(D.car.rotation.y));
    D.head.position.copy(A.w([p.x, 0.75, p.z])).addScaledVector(f, 2.1);
    D.head.target.position.copy(D.head.position).addScaledVector(f, 12).add(V(0, -0.6, 0));
    D.head.intensity = 900 * U.clamp(D.drive.t * 2);
    if (u >= 1) D.drive = null;
  }

  // ---- setting the stage (every beat can be the first thing that runs) -------------------------------------------------
  // P.2: the house fresh, the store from P.1 kept (or rebuilt when P.2 is started on its own or restarted)
  async function stageHouse(G) {
    const cont = Game.areas.has('P1') && !Game.areas.has('P2');
    if (!cont) { G.unload('P2'); G.unload('P1'); await G.area('P1'); }
    const A = await G.area('P2', { keep: true });
    const chase = G.actor('chase', 'chase_young'), luke = G.actor('luke', 'luke_young');
    if (!cont) { G.place(chase, 'mk_chase_counter'); G.place(luke, 'mk_luke_counter'); HK['p1.settle'](G); }
    storeVisible(false); fills(true);
    return A;
  }
  // P.3: both areas, Bub on the couch with her draft (built from scratch when the beat is started on its own)
  async function stageCall(G) {
    if (Game.areas.has('P1') && Game.areas.has('P2')) return P2();
    const A = await stageHouse(G), bub = G.actor('bub', 'bub');
    UI.letterbox(false, 0);
    seat(G, bub); A.data.min = 58; A.data.oven.userData.setTime('11:58');
    storeVisible(true); Engine.renderer.compile(Engine.scene, Engine.camera);
    return A;
  }
  function seat(G, bub) {
    const A = P2();
    G.place(bub, 'mk_couch'); bub.pose('sit', { dur: 0.01 }); bub.lookAt(null);
    phoneUp(G, bub, msgTex(false));
    A.data.lampOn.visible = true;
  }
  function phoneUp(G, bub, tex) {
    const ph = bub.held('r') || bub.hold('phone', 'r');
    bub.phoneGlow(true); screen(ph, tex);
  }

  // ---- P.2 — Bub -----------------------------------------------------------------------------------------------------
  HK['prologue.P2'] = async G => {
    UI.hud({ show: false }); G.control(false);
    const A = await stageHouse(G), D = A.data;
    const bub = G.actor('bub', 'bub', 'mk_bub_bed');
    for (const h of ['r', 'l']) if (bub.held(h)) bub.drop(h, { remove: true });
    bub.pose('lie', { dur: 0.01 }); bub.emote('neutral'); bub.lookAt(A.w([-5.9, 2.4, -3.4]));
    const ph = bub.hold('phone', 'r'); screen(ph, Tex.screen('lock', { time: '11:44' })); ph.visible = false;
    Engine.renderer.compile(Engine.scene, Engine.camera);           // the light set changed and Bub is new: compile it all now, behind the cut
    // opening frame: her face in the phone's glow, the fairy lights behind; a slow push while she waits
    const cam = { pos: A.w([-5.2, 1.25, -2.75]), target: A.w([-6.4, 0.95, -4.45]), fov: U.lensToFov(30) };
    const from = cam.pos.clone(), to = A.w([-5.4, 1.15, -3.0]), t0 = G.t;
    Director.manual(cam);
    const push = A.update(() => { cam.pos.lerpVectors(from, to, U.ease.sine(U.clamp((G.t - t0) / 14))); });
    await G.wait(1.3);
    G.sfx('notif_chime', { pos: A.w([-5.88, 0.6, -3.2]), vol: 0.6 }); bub.lookAt(A.w([-5.88, 0.6, -3.2]));
    UI.phone({ kind: 'notification', time: '11:44 PM', notif: { app: 'INFINITE', text: NOTE } });
    await G.wait(1.6);
    bub.pose('sit_ground', { dur: 1.3 }); tween(bub, [-6.15, 0.46, -3.54], 0.5, 1.3);
    await G.wait(0.9);
    D.bedPhone.visible = false; D.bedGlow.visible = false;
    ph.visible = true; bub.phoneGlow(true); screen(ph, Tex.screen('lock', { time: '11:44' }));
    bub.lookAt(() => bub.point('hand_r'));
    UI.phone({ kind: 'lock', time: '11:44 PM', notif: { app: 'INFINITE', text: NOTE } });
    await G.wait(1.4);
    UI.prompt('e – get up');
    await G.until(() => Input.pressed('interact'));
    UI.prompt(null); UI.phone(null);
    bub.phoneGlow(false); bub.lookAt(null);
    A.updaters.splice(A.updaters.indexOf(push), 1);
    G.player(bub, BUB);
    Director.manual(null);
    await G.scene('P.2.up');
    // explore: 11:44 -> 11:58
    D.explore = true; D.t0 = G.t;
    G.control(true);
    await G.until(() => D.min >= 58);
    D.lamp.intensity = 4.2;                                           // the couch, lit like the next place to be
    await G.until(() => !Dialogue.busy);
    D.explore = false;
    const couch = A.w([2.1, 0.8, 0.9]);
    if (bub.root.position.x > A.w([-2.0, 0, 0]).x) Play.nudge(couch, 2.2);
    await G.interact({ at: [2.75, 0, 0.8], r: 1.6, prompt: 'e – sit' });
    G.control(false); Dialogue.hush();
    storeVisible(true); fills(true); Engine.renderer.compile(Engine.scene, Engine.camera);
    await G.scene('P.2.sit');
    // the text: any key types the next letter
    const base = { kind: 'messages', title: DAD, time: '11:58 PM', lines: THREAD };
    UI.phone(Object.assign({ draft: '', caret: true }, base));
    bub.gesture('type_phone', { hold: true });
    UI.prompt('any key – type');
    for (let n = 1; n <= MSG.length; n++) {
      await G.until(() => Input.anyPressed);
      if (n === 1) UI.prompt(null);
      UI.phone(Object.assign({ draft: MSG.slice(0, n), caret: true }, base));
      G.sfx('typing_tap', { pos: bub.point('hand_r'), vol: 0.35 });
    }
    await G.wait(0.45);
    // mid-word: Dad
    UI.phone({ kind: 'call', title: DAD, text: 'mobile', time: '11:59 PM' });
    const ring = Audio.loop('phone_ring', { pos: bub.point('hand_r'), vol: 0.9 });
    D.loops.push(ring);
    bub.gesture(null); bub.emote('shocked', 0.6);
    await G.wait(0.7);
    bub.emote('smile');
    UI.prompt('e – answer');
    await G.until(() => Input.pressed('interact'));
    UI.prompt(null); ring.stop(0.05); G.sfx('pickup', { pos: bub.point('hand_r'), vol: 0.4 });
  };
  // getting up: legs over the edge, then up onto her socks
  HK['p2.getUp'] = async G => {
    const bub = G.who('bub');
    bub.pose('sit', { dur: 0.9 }); tween(bub, [-5.45, 0.07, -3.6], PI / 2, 0.9);
    await G.wait(1.15);
    bub.pose('stand', { dur: 0.8 }); tween(bub, [-5.0, 0, -3.6], PI / 2, 0.75);
  };
  // onto the couch: in front of it, turn, sit back into the cushions, phone up
  HK['p2.sit'] = async G => {
    const bub = G.who('bub');
    await bub.walkTo('mk_couch_front', { speed: 1.0 });
    await bub.turnTo(PI / 2, 0.6);
    bub.pose('sit', { dur: 0.8 }); tween(bub, P2().markers.mk_couch.pos, PI / 2, 0.8);
    await G.wait(0.9);
    phoneUp(G, bub, msgTex(false));
    bub.gesture('type_phone', { hold: true }); bub.lookAt(() => bub.point('hand_r'));
  };

  const POV_BED = w(-5.4, 1.15, -3.0);
  CONTENT.scenes['P.2.up'] = {
    title: 'Get Up', area: 'P2', letterbox: false, skippable: false, start: { blend: 0.6 },
    shots: [{ cam: { type: 'dolly', from: POV_BED, to: w(-3.75, 1.4, -2.5), look: 'bub.chest', lens: 30, dur: 3.2 }, dur: 3.0, focus: 'bub',
      actions: [{ t: 0, do: 'call', hook: 'p2.getUp' }, { t: 0.2, who: 'bub', do: 'emote', name: 'neutral' }, { t: 2.2, who: 'bub', do: 'gesture', name: 'chew_sleeve' }] }],
    exit: { blend: 'gameplay', dur: 1.4 },
  };
  CONTENT.scenes['P.2.sit'] = {
    title: 'Dad', area: 'P2', letterbox: false, skippable: false, start: { blend: 1.1 },
    shots: [{ cam: { type: 'dolly', from: w(4.3, 1.4, -0.55), to: w(3.95, 1.22, -0.3), look: w(2.2, 0.85, 0.75), lens: 35, dur: 6 }, dur: 5.2, focus: 'bub',
      actions: [{ t: 0, do: 'call', hook: 'p2.sit' }] }],
    exit: { hold: true },
  };

  // ---- P.3 — The Call --------------------------------------------------------------------------------------------------
  HK['prologue.P3'] = async G => {
    const A = await stageCall(G), D = A.data;
    UI.hud({ show: false }); G.control(false);
    const bub = G.who('bub');
    storeVisible(true);
    HK['p1.infinite'](G);
    const chase = G.who('chase'), luke = G.who('luke');
    G.place(chase, 'mk_chase_counter'); G.place(luke, 'mk_luke_counter');
    HK['p1.chasePhone'](G, { pct: 42 }); chase.pose('phone_ear', { dur: 0.01 }); chase.emote('tense');
    luke.pose('stand'); luke.lookAt(chase);
    bub.lookAt(null);
    D.lampOn.visible = true;
    await G.scene('P.3');
  };
  // seated, so the phone goes to her ear as a held reach (the phone_ear pose is a standing pose)
  HK['p2.ear'] = G => {
    const bub = G.who('bub'), hs = bub.D.hs, ear = V(), A = P2();
    const follow = A.update(() => { if (bub.gest && bub.gest.o.to === ear) bub.bones.head.localToWorld(ear.set(-0.085 * hs, -0.03 * hs, 0.01 * hs)); else A.updaters.splice(A.updaters.indexOf(follow), 1); });
    bub.bones.head.updateWorldMatrix(true, false); bub.bones.head.localToWorld(ear.set(-0.085 * hs, -0.03 * hs, 0.01 * hs));
    bub.gesture('hand_over', { to: ear, hold: true }); bub.lookAt(A.w([4.6, 1.0, 0.9]));
  };
  HK['p2.hangUp'] = G => { const bub = G.who('bub'); screen(bub.held('r'), msgTex(false)); bub.gesture('type_phone', { hold: true }); bub.lookAt(() => bub.point('hand_r')); };
  HK['p2.send'] = G => { screen(G.who('bub').held('r'), msgTex(true)); };
  HK['p2.phoneOff'] = G => { const bub = G.who('bub'); bub.phoneGlow(false); };
  HK['p3.slam'] = G => { HK['p1.slamPhone'](G); };
  const bubClose = (x, push, extra = {}) => Object.assign({ type: 'static', at: { of: 'bub', off: [x, 1.0, 0.95] }, look: 'bub.eyes', lens: 65, push }, extra);
  const chaseClose = (x, push, extra = {}) => Object.assign({ type: 'static', at: { of: 'chase', off: [x, 1.68, 1.05] }, look: 'chase.eyes', lens: 65, push }, extra);
  const house = { t: 0, call: 'p2.house' }, store = { t: 0, call: 'p2.store' };
  CONTENT.scenes['P.3'] = {
    title: 'The Call', area: 'P2', grade: 'launch_home', music: null,
    cast: { chase: { at: 'mk_chase_counter', def: 'chase_young' }, luke: { at: 'mk_luke_counter', def: 'luke_young' } },
    start: { blend: 0.7 },
    shots: [
      // she answers: the phone to her ear, a smile already there
      { cam: bubClose(0.5, 0.04), dur: 2.4, focus: 'bub',
        actions: [{ t: 0.1, do: 'call', hook: 'p2.ear' }, { t: 0.3, who: 'bub', do: 'lookAt', at: w(4.6, 1.0, 0.9) }, { t: 0.3, who: 'bub', do: 'emote', name: 'smile' }],
        cues: [{ t: 0.15, ui: { phone: null } }] },
      // 1. The store, 11:59. The customer has stopped mid-sentence.
      { cam: { type: 'static', at: { of: 'chase', off: [0.05, 1.62, 0.25] }, look: 'customer.eyes', lens: 35 }, dur: 2.6, focus: 'customer',
        cues: [store, { t: 0.6, sfx: 'swipe', at: 'customer.hand_r', vol: 0.5 }] },
      { cam: { type: 'extreme_close', who: 'customer', part: 'eyes', dist: 0.55 }, dur: 3.2, focus: 'customer',
        cues: [{ t: 0.5, sfx: 'swipe', at: 'customer.hand_r', vol: 0.6 }, { t: 1.2, sfx: 'click', at: 'customer.hand_r', vol: 0.35 }, { t: 1.9, sfx: 'swipe', at: 'customer.hand_r', vol: 0.6 }, { t: 2.6, sfx: 'click', at: 'customer.hand_r', vol: 0.35 }] },
      { cam: { type: 'dolly', from: 'mk_cam_demo', to: { of: 'mk_cam_demo', off: [0, -0.05, 0.25] }, look: [-3.9, 0.95, -3.4], lens: 32 }, dur: 3.0, focus: [-3.9, 0.95, -3.4] },
      // 2. Handheld, slowly turning: the queue has gone silent, forty faces in the same blue
      { cam: { type: 'pan', at: 'mk_cam_queue_out', look: [0.8, 1.45, 1.2], lookTo: 'mk_cam_queue_look', lens: 30, handheld: 0.7 }, dur: 5.6, focus: null,
        cues: [{ t: 1.5, sfx: 'swipe', at: [8, 1.4, 1.4], vol: 0.35 }, { t: 3.1, sfx: 'click', at: [10, 1.4, 1.4], vol: 0.3 }] },
      { cam: { type: 'static', at: 'mk_cam_grab', look: [9.3, 1.45, 1.35], lens: 38, handheld: 0.8 }, dur: 4.2, focus: [9.25, 1.5, 1.2],
        actions: [{ t: 0.3, do: 'call', hook: 'p1.grab' }] },
      // 3. Chase, the phone already at his ear. Intercut with Bub on the couch.
      { cam: chaseClose(-0.55, 0.05), focus: 'chase', hold: 0.4,
        actions: [{ t: 0, who: 'chase', do: 'lookAt', at: 'customer' }],
        lines: [{ who: 'bub', via: 'phone', text: 'Did you break it? Did you break the record?', emote: 'smile', pause: 0.6 },
          { who: 'chase', text: 'Bub. Listen to me. Turn your phone off.', emote: 'tense', pause: 0.5 }] },
      { cam: bubClose(0.45, 0.03), focus: 'bub', hold: 0.15, cues: [house],
        lines: [{ who: 'bub', text: 'What? I\'m literally texting y—', emote: 'smirk', pause: 0.3 }] },
      { cam: chaseClose(-0.5, 0.05, { lens: 75, handheld: 0.25 }), focus: 'chase', hold: 0.3, cues: [store],
        lines: [{ who: 'chase', text: 'Turn it off. Right now. Don\'t look at anything on it. Don\'t open anything.', emote: 'tense', pause: 0.1 }] },
      { cam: bubClose(0.45, 0.04, { lens: 72 }), focus: 'bub', hold: 0.5, cues: [house],
        lines: [{ who: 'bub', text: 'Dad, you\'re being weird.', emote: 'tense', pause: 0.3 }] },
      { cam: chaseClose(-0.5, 0.09, { lens: 85 }), focus: 'chase', hold: 0.8, cues: [store],
        lines: [{ who: 'chase', text: 'Bub. I need you to do this for me. Please.', emote: 'sad', pause: 0.6 }] },
      { cam: bubClose(0.42, 0.09, { lens: 85 }), focus: 'bub', hold: 0.9, cues: [house],
        actions: [{ t: 0.4, who: 'bub', do: 'emote', name: 'afraid' }],
        lines: [{ who: 'bub', text: '…Okay. Okay. Love you. Turning it off.', emote: 'afraid', pause: 1.1 }] },
      // 4. Her thumb: send on the half-finished message, then the power button. Sending… and black.
      { cam: { type: 'extreme_close', who: 'bub', part: 'phone' }, dur: 5.0, focus: 'bub.hand_r',
        actions: [{ t: 0, do: 'call', hook: 'p2.hangUp' }, { t: 1.3, do: 'call', hook: 'p2.send' }, { t: 3.4, do: 'call', hook: 'p2.phoneOff' }],
        cues: [{ t: 0.2, ui: { phone: { kind: 'messages', title: DAD, time: '11:59 PM', lines: THREAD, draft: MSG, caret: false } } },
          { t: 1.3, ui: { phone: { kind: 'messages', title: DAD, time: '11:59 PM', lines: [...THREAD, { from: 'me', text: MSG, status: 'Sending…' }], draft: '', caret: false } } },
          { t: 1.3, sfx: 'typing_tap', at: 'bub.hand_r', vol: 0.5 },
          { t: 3.4, ui: { phone: { kind: 'off', time: '11:59 PM' } } }, { t: 4.4, ui: { phone: null } }] },
      // 5. Store. He lowers his phone: INFINITE — Installing… 42%. One beat too long.
      { cam: chaseClose(-0.62, 0.02, { lens: 50 }), dur: 2.4, focus: 'chase', cues: [store],
        actions: [{ t: 0.3, who: 'chase', do: 'lookAt', at: null }, { t: 0.4, who: 'chase', do: 'pose', name: 'phone' }, { t: 0.6, who: 'chase', do: 'emote', name: 'exhausted' }] },
      { cam: { type: 'extreme_close', who: 'chase', part: 'phone' }, dur: 2.8, focus: 'chase.hand_r' },
      { cam: { type: 'static', at: { of: 'chase', off: [-1.15, 1.5, 1.6] }, look: { of: 'chase', off: [0.12, 1.22, 0.2] }, lens: 35 }, dur: 2.2, focus: 'chase',
        actions: [{ t: 0.05, who: 'chase', do: 'pose', name: 'stand' }, { t: 0.1, who: 'chase', do: 'emote', name: 'angry' }, { t: 0.1, who: 'chase', do: 'gesture', name: 'slam_phone' }, { t: 0.72, do: 'call', hook: 'p3.slam' }],
        cues: [{ t: 0.72, sfx: 'phone_slam', at: [-1.25, 1.02, -7.62], vol: 1 }, { t: 0.72, shake: 0.35, dur: 0.35 }] },
      { cam: { type: 'static', at: { of: 'luke', off: [0.45, 1.62, 1.3] }, look: 'luke.eyes', lens: 60 }, focus: 'luke', hold: 0.3,
        actions: [{ t: 0, who: 'luke', do: 'lookAt', at: 'chase' }, { t: 0, who: 'luke', do: 'emote', name: 'shocked' }],
        lines: [{ who: 'luke', text: 'Chase—', emote: 'shocked', pause: 0.5, to: 'chase' }] },
      { cam: chaseClose(-0.55, 0.06, { lens: 65 }), focus: 'chase', hold: 0.9,
        actions: [{ t: 0, who: 'chase', do: 'lookAt', at: 'luke' }],
        lines: [{ who: 'chase', text: 'Get the car.', emote: 'tense', pause: 0.5, to: 'luke' }] },
    ],
    exit: { cut: true },
  };

  // ---- P.4 — Home --------------------------------------------------------------------------------------------------
  HK['prologue.P4'] = async G => {
    G.unload('P1');
    const A = Game.areas.has('P2') ? P2() : await G.area('P2'), D = A.data;
    G.look('P2'); fills(true); Engine.renderer.compile(Engine.scene, Engine.camera);
    UI.hud({ show: false }); UI.phone(null); UI.prompt(null); G.control(false);
    for (const l of D.loops.splice(0)) l.stop(0.2);
    D.explore = false; D.tvLoop = null;
    // the house gone dark: lamp and kitchen off, the TV on by itself, the newsreader scrolling her own phone on air
    D.lamp.intensity = 0; D.hall.intensity = 0.55; D.kitchen.intensity = 1.2; D.kitchen.position.copy(A.w([2.7, 1.25, -4.1]));
    D.lampOn.visible = false; D.lampOff.visible = true;
    D.tv.userData.setScreen('news_scroll');
    const bub = G.actor('bub', 'bub', 'mk_bub_p4');
    bub.detach(); if (bub.pairOf) bub.pairOf.detach();
    for (const h of ['r', 'l']) if (bub.held(h)) bub.drop(h, { remove: true });
    bub.hold('phone', 'r'); bub.pose('stand', { dur: 0.01 }); bub.gesture(null); bub.emote('afraid'); bub.lookAt(null);
    const nb = D.neighbour;
    G.place(nb, 'mk_door_out'); nb.pose('stand'); nb.phoneGlow(true); nb.decal('feed_eyes', true);
    for (const [id, def, mk] of [['chase', 'chase_young', 'mk_chase_out'], ['luke', 'luke_young', 'mk_luke_out']]) {
      const c = G.actor(id, def, mk); c.stop(); c.detach(); c.pose('stand', { dur: 0.01 }); c.setVisible(false);
      for (const h of ['r', 'l']) if (c.held(h)) c.drop(h, { remove: true });
    }
    G.player(bub, BUB); Play.snapCamera();
    G.control(true);
    // 1. she goes to the TV and turns it off herself
    const tv = A.w([4.3, 0, 1.2]), scr = A.w([4.83, 0.9, 1.2]);
    await Promise.race([G.until(() => U.dist2(bub.root.position, tv) < 2.1), G.wait(16)]);
    G.control(false);
    bub.lookAt(scr);
    await bub.walkTo('mk_tv_btn', { speed: 0.9 });
    await bub.turnTo(A.w([4.76, 0, 1.6]), 0.4);
    bub.gesture('hand_over', { to: A.w([4.76, 0.72, 1.74]), hand: 'l' });
    await G.wait(0.6);
    D.tv.userData.setScreen(null); G.sfx('tv_off', { pos: scr, vol: 0.7 });
    await G.wait(0.8);
    bub.lookAt(null);
    await bub.walkTo(A.w([3.75, 0, 2.3]), { speed: 0.7 });
    const door = A.w([0, 0, 3.2]);
    turnCam(U.yawTo(bub.root.position, door), 1.4); await bub.turnTo(door, 0.9);
    G.control(true);
    // 2. a knock; the silhouette at the frosted glass, a phone glowing against it; another knock
    await G.wait(1.8);
    const glass = A.w([0.0, 1.35, 3.12]);
    G.sfx('knock', { pos: glass, vol: 1 });
    D.frost.mat.map = D.frost.sil; D.frost.mat.color.setScalar(1.25);
    bub.lookAt(glass); bub.emote('afraid'); Play.nudge(glass, 2);
    await G.wait(2.6);
    G.sfx('knock', { pos: glass, vol: 1 });
    await G.wait(1.3);
    await G.say('bub', 'Go away. Go away.', { emote: 'afraid', to: glass });
    await G.wait(0.5);
    G.control(false);
    await G.scene('P.4');
  };
  HK['p2.glass'] = G => {
    const D = P2().data;
    D.frostMesh.visible = D.frostOut.visible = false; D.rim.visible = true; D.shards.visible = true;
    G.sfx('glass_break', { pos: P2().w([0, 1.35, 3.2]), vol: 1 });
  };
  HK['p2.door'] = G => {
    const D = P2().data, d = D.door.userData;
    let t = 0; const up = P2().update(dt => { t += dt; d.setOpen(U.ease.out(U.clamp(t / 0.7)) * 0.92); if (t >= 0.7) P2().updaters.splice(P2().updaters.indexOf(up), 1); });
    G.sfx('door_open', { pos: P2().w([0, 1.2, 3.2]), vol: 0.9 });
  };
  HK['p2.car'] = G => {
    const D = P2().data;
    D.car.visible = true; D.drive = { t: 0 };
    D.loops.push(Audio.loop('engine_idle', { pos: P2().w([0, 0.6, 12]), vol: 0.8 }));
    G.sfx('tyre_screech', { pos: P2().w([-2, 0.4, 14]), vol: 0.7 });
  };
  HK['p2.impact'] = G => {
    const A = P2(), D = A.data, nb = D.neighbour, chase = G.who('chase');
    D.table.userData.break();
    nb.drop('r', { remove: true }); nb.stop(); G.place(nb, 'mk_nb_down'); nb.pose('lie', { dur: 0.2 }); nb.emote('shocked'); nb.lookAt(null);
    D.floorPhone.visible = true;
    chase.stop(); chase.attach(nb, 'pin');
    for (const s of ['wood_crash', 'tackle', 'body_fall']) G.sfx(s, { pos: A.w([3.2, 0.4, 1.2]), vol: 1 });
  };
  HK['p2.up'] = G => { const chase = G.who('chase'); chase.detach(); chase.pose('stand', { dur: 0.7 }); chase.decal('blood_knuckles'); };
  CONTENT.scenes['P.4'] = {
    title: 'Home', area: 'P2', grade: 'launch_home', music: null,
    cast: { bub: { at: 'mk_bub_back' }, neighbour: { at: 'mk_door_out' }, chase: { at: 'mk_chase_out', def: 'chase_young' }, luke: { at: 'mk_luke_out', def: 'luke_young' } },
    start: { cut: true },
    shots: [
      // glass shatters; through the hole, a face in blue light; the door gives
      { cam: { type: 'static', at: w(1.15, 1.2, 1.55), look: w(0.02, 1.32, 3.15), lens: 35, handheld: 0.35 }, dur: 2.7, focus: w(0.1, 1.4, 3.2),
        actions: [{ t: 0, who: 'neighbour', do: 'pose', name: 'stand' }, { t: 0.1, who: 'neighbour', do: 'gesture', name: 'punch' }, { t: 1.25, do: 'call', hook: 'p2.door' },
          { t: 1.5, who: 'neighbour', do: 'walkTo', path: ['mk_nb_in', w(1.7, 0, 2.85), 'mk_nb_tackle'], speed: 0.75 }],
        cues: [{ t: 0.3, call: 'p2.glass' }, { t: 0.3, shake: 0.3, dur: 0.4 }] },
      // Bub, backed into the corner
      { cam: { type: 'close', who: 'bub', dist: 1.15, lens: 60, handheld: 0.3 }, dur: 2.2, focus: 'bub',
        actions: [{ t: 0, who: 'bub', do: 'lookAt', at: 'neighbour' }, { t: 0.1, who: 'bub', do: 'emote', name: 'afraid' }, { t: 0.4, who: 'bub', do: 'gesture', name: 'cover_mouth' }] },
      // he comes on, phone out at arm's length toward her face; headlights begin to sweep the room
      { cam: { type: 'ots', over: 'bub', on: 'neighbour', side: 'left', dist: 0.9, handheld: 0.5 }, focus: 'neighbour', hold: 0.2,
        actions: [{ t: 0.1, who: 'neighbour', do: 'gesture', name: 'point', to: 'bub.eyes', hold: true }, { t: 0.2, who: 'neighbour', do: 'emote', name: 'smile' }, { t: 0.2, who: 'neighbour', do: 'lookAt', at: 'bub' }],
        cues: [{ t: 0.5, call: 'p2.car' }, { t: 0.6, sfx: 'whisper', at: 'neighbour', vol: 0.8 }],
        lines: [{ who: 'neighbour', text: 'wait, watch this, wait', emote: 'smile', pause: 0.8, to: 'bub' }] },
      // her eyes on the screen coming at her
      { cam: { type: 'pov', who: 'bub', look: 'neighbour.hand_r', lens: 40, handheld: 0.6 }, dur: 1.5, focus: 'neighbour.hand_r',
        cues: [{ t: 0.2, sfx: 'whisper', at: 'neighbour', vol: 0.9 }] },
      // Chase through the door, into him
      { cam: { type: 'static', at: w(3.1, 1.55, -2.4), look: w(1.6, 0.95, 2.4), lens: 28, handheld: 0.45 }, dur: 1.0, focus: w(1.8, 1.0, 2.5),
        actions: [{ t: 0, who: 'chase', do: 'show' }, { t: 0, who: 'chase', do: 'place', at: w(0.05, 0, 3.9), yaw: 1.2 }, { t: 0.02, who: 'chase', do: 'runTo', at: w(2.45, 0, 2.45) }, { t: 0.62, who: 'chase', do: 'gesture', name: 'tackle' }],
        cues: [{ t: 0, sfx: 'door_slam', at: w(0, 1, 3.2), vol: 0.8 }] },
      // through the coffee table
      { cam: { type: 'static', at: w(4.35, 0.42, 2.25), look: w(3.1, 0.35, 1.1), lens: 24, handheld: 0.55 }, dur: 2.2, focus: w(3.1, 0.4, 1.2),
        actions: [{ t: 0, do: 'call', hook: 'p2.impact' }, { t: 0.7, who: 'chase', do: 'gesture', name: 'punch' }, { t: 1.3, who: 'chase', do: 'gesture', name: 'punch' }],
        cues: [{ t: 0, shake: 0.7, dur: 0.5 }, { t: 0.85, sfx: 'punch', at: w(3.15, 0.4, 1.15), vol: 1 }, { t: 1.45, sfx: 'punch', at: w(3.15, 0.4, 1.15), vol: 1 }] },
      // Luke drags Bub back, away from it, toward the kitchen
      { cam: { type: 'static', at: w(4.95, 1.45, -1.3), look: w(4.0, 1.0, 1.5), lens: 30 }, dur: 2.6, focus: 'bub',
        actions: [{ t: 0, who: 'luke', do: 'show' }, { t: 0, who: 'luke', do: 'place', at: w(3.95, 0, 0.55), yaw: 0.2 }, { t: 0.02, who: 'luke', do: 'runTo', at: w(4.15, 0, 1.55) },
          { t: 0.45, who: 'luke', do: 'gesture', name: 'hand_on_shoulder', to: 'bub', hold: true }, { t: 0.6, who: 'bub', do: 'walkTo', path: [w(4.2, 0, 0.3), 'mk_bub_pulled'], speed: 1.7 },
          { t: 0.65, who: 'luke', do: 'walkTo', path: [w(3.95, 0, 0.1), w(3.55, 0, -2.3)], speed: 1.7 }, { t: 1.0, who: 'bub', do: 'lookAt', at: 'chase' }, { t: 1.2, who: 'luke', do: 'lookAt', at: 'chase' }] },
      // Chase gets up, breathing hard, blood on his knuckles
      { cam: { type: 'static', at: w(4.4, 1.05, 2.45), look: w(3.25, 1.2, 1.0), lens: 35 }, dur: 3.4, focus: 'chase',
        actions: [{ t: 0.2, do: 'call', hook: 'p2.up' }, { t: 0.3, who: 'chase', do: 'emote', name: 'exhausted' }, { t: 1.1, who: 'chase', do: 'lookAt', at: 'chase.hand_r' },
          { t: 0.4, who: 'luke', do: 'gesture', name: null }, { t: 0.5, who: 'bub', do: 'turnTo', to: 0, dur: 0.6 }, { t: 0.9, who: 'luke', do: 'walkTo', at: w(2.3, 0, 0.75), speed: 1.2 },
          { t: 2.1, who: 'chase', do: 'lookAt', at: 'bub' }, { t: 2.4, who: 'chase', do: 'walkTo', path: [w(3.9, 0, 0.2), w(3.0, 0, -2.25)], speed: 1.5 }],
        cues: [{ t: 0.6, sfx: 'breath_in', at: 'chase', vol: 0.8 }, { t: 1.7, sfx: 'breath_in', at: 'chase', vol: 0.7 }] },
      // his hands on her face
      { cam: { type: 'two_shot', a: 'chase', b: 'bub', side: 'right', lens: 40 }, focus: 'chase', hold: 0.3,
        actions: [{ t: 0, who: 'chase', do: 'turnTo', to: 'bub', dur: 0.3 }, { t: 0.35, who: 'chase', do: 'attach', to: 'bub', mode: 'face_hold' }, { t: 0.4, who: 'bub', do: 'emote', name: 'crying' }],
        lines: [{ who: 'chase', text: 'You okay? Look at me. You okay?', emote: 'tense', pause: 0.9, to: 'bub' }] },
      { cam: { type: 'ots', over: 'chase', on: 'bub', push: 0.06 }, focus: 'bub', hold: 0.5,
        lines: [{ who: 'bub', text: 'He was trying to show me something.', emote: 'afraid', pause: 0.4, to: 'chase' }] },
      { cam: { type: 'ots', over: 'bub', on: 'chase', push: 0.08 }, focus: 'chase', hold: 0.4,
        lines: [{ who: 'chase', text: 'Don\'t look at anyone\'s hands. Anyone\'s. Car. Now.', emote: 'tense', pause: 0.3, to: 'bub' }] },
      // out into the headlights; his phone still scrolling on the floor
      { cam: { type: 'static', at: w(3.55, 0.3, 2.7), look: w(0.9, 0.95, 2.1), lens: 28 }, dur: 5.2, focus: { rack: [w(2.55, 0.02, 2.15), 'bub'], at: 1.6, dur: 1.8 },
        actions: [{ t: 0, who: 'chase', do: 'detach' }, { t: 0.1, who: 'chase', do: 'gesture', name: 'hand_on_shoulder', to: 'bub', hold: true },
          { t: 0.1, who: 'luke', do: 'walkTo', path: [w(1.4, 0, 2.6), w(0.1, 0, 3.9)], speed: 2.0 }, { t: 0.3, who: 'bub', do: 'walkTo', path: [w(2.4, 0, -1.2), w(1.15, 0, -0.5), w(1.05, 0, 2.5), w(0.1, 0, 3.8)], speed: 2.0 },
          { t: 0.4, who: 'chase', do: 'walkTo', path: [w(2.2, 0, -1.4), w(0.9, 0, -0.6), w(0.8, 0, 2.4), w(0.15, 0, 3.6)], speed: 2.0 }] },
    ],
    exit: { cut: true },
  };
})();
