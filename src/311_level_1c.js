// ============================================================================
// Area 1C — the Wholesaler's warehouse (spec §9 1.3 Stock-Take, 1.4 The Wholesaler): a gutted electronics distribution
// centre on the river at Murarrie. Flow beats ch1.3, ch1.3b (mid checkpoint), ch1.4; scenes 1.3.in and 1.4.
// Owned by: level agent (c1b).
//
// 1C — origin [800,0,3000]; area-local +Z is north (down the hall), +X east (the river). The hall is x −16..16, z 0..48,
//   8 m to the eaves under a rusted gable roof, rain drumming on it.
//   Receiving (z 0..14): the side door (south-west) they slip in by, pallet cover, the goods-in cage (time clock, the
//     DAYS WITHOUT AN INCIDENT board), a forklift, the smugglers' card table, dock door 1 half up onto the wharf and the river.
//   Aisles (z 15..33): four rows of pallet racking, dark (the Wholesaler cut the lights), a cross-aisle at z 23..25; east of
//     them the roof has fallen in: rain through the hole, a pool, a young fig. The sawn-off is in an open crate in aisle 1.
//   Dispatch (z 33..48): the fire drum, the van, lockers, the empty pallet spot where Wai and Chase's stock was, and the
//     mezzanine (deck y 3.6, x −16..11, z 40..48) with the Wholesaler's lit office (x −14..−3, door x −5.5) and the fire
//     stairs behind its west wall. Stairs up at x 10, z 32.8..40.
// Flow: ch1.3 loads 1C behind a hard cut to 1.3.in (crane down the hall; Chase and Wai slip in the side door), then part A
//   (crouch, cover, the bottle, the choke) to the aisle mouth; checkpoint → ch1.3b: part B (Airplane Mode, the sawn-off,
//   dispatch) to the office door ("e – open" once nobody is hunting them). A flow without a '1.3b' step still gets the
//   checkpoint: ch1.3 saves with flags.c1cB and a retry resumes at part B. ch1.4 plays scene 1.4, which ends HELD
//   (exit hold, letterbox on) on the Operator's "Come and see." — 1.5 opens with a hard cut.
// Markers: mk_start (free roam) · mk_1c_start, mk_1c_wai (part A) · mk_1c_b, mk_1c_wai_b (part B) · mk_1c_door (outside the
//   office door) · mk_14_chase, mk_14_wai2, mk_14_whole, mk_14_op_back (where 1.4 leaves Chase, Wai, the body, the Operator).
// Area char: wholesaler (in his office from the start, visible through the lit windows). Persistent actors: chase, wai
// (bruised; AI companion with his bat in 1.3, dismissed for 1.4: he ends it with the pistol, the bat on the office floor),
// operator (wounded, pale, revolver in her right hand, left hand held to the wound while in 1C; created in ch1.4).
// ============================================================================
(() => {
  const PI = Math.PI, H = CONTENT.hooks, O = [800, 0, 3000], DECK = 3.6;
  const M = (n, o) => Tex.mat(n, o), C = (h, o) => Tex.color(h, o);
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), W = (x, y, z) => V(O[0] + x, y, O[2] + z);
  const SUN = [-0.62, -0.74, 0.26];
  const PROFILE = { combat: true, hud: true, canCrouch: true, canJump: true, weapons: ['revolver', 'shotgun'], melee: 'fists', stats: 'chase' };
  const ROWS = [-11.5, -5.5, 0.5, 6.5], SEGS = [[15.5, 23], [25, 32.5]];
  const FOES = {
    a: [
      { name: 'smuggler_bay', at: [-6.5, 9.8], yaw: PI / 2, weapon: 'pipe', behaviour: 'patrol', route: 'c1c_bay' },
      { name: 'smuggler_dock', at: [13.6, 8.3], yaw: PI / 2, weapon: 'pistol', behaviour: 'idle' },
    ],
    b: [
      { name: 'smuggler_aisle', at: [-2.5, 29], yaw: PI, weapon: 'pipe', behaviour: 'patrol', route: 'c1c_aisles' },
      { name: 'smuggler_fire', at: [-8.5, 37.5], yaw: PI, weapon: 'pistol', behaviour: 'idle' },
      { name: 'smuggler_torch', at: [-12, 44.2], yaw: PI / 2, weapon: 'pipe', behaviour: 'patrol', route: 'c1c_dispatch', torch: true },
    ],
  };
  const inBox = (p, b) => p.x >= O[0] + b[0] && p.x <= O[0] + b[2] && p.z >= O[2] + b[1] && p.z <= O[2] + b[3];
  const pp = () => Play.char.root.position;
  const foe = (A, n) => A.data.foes[n];
  const up = (A, n) => { const a = foe(A, n); return a && a.alive; };
  const calm = () => AI.list.every(a => a.companion || !a.alive || (a.state !== 'combat' && a.state !== 'search'));
  const comp = c => AI.list.find(a => a.companion && a.char === c);
  const waiSay = (text, emote) => Dialogue.say('wai', text, { emote, to: 'chase' });

  // ---- collectibles, remarks ------------------------------------------------------------------------------------------
  CONTENT.collectibles.artifacts.push({ id: 'c1_price_list', chapter: 'ch1', title: "The Wholesaler's price list",
    text: 'ALL PRICES IN BARS\n\nRadios (working) ........ 4\nCells, charged ........ 1 ea\nFlip phones (no camera, no feed) ... 6\nOld Nokias ........ 9 — no haggling\nSIM ejectors ........ 2 for 1\nSwollen batteries ........ free, please take them\n\nWai & Chase lot (40 bars) → Landlines, Friday.\nThey pay in food. Cash up front.\n\nRemember: every customer is a VALUED customer.' });
  CONTENT.collectibles.lanyards.push({ id: 'c1_lanyard_dispatch', chapter: 'ch1', title: '—— · Dispatch Lead · Murarrie DC' });
  Object.assign(CONTENT.remarks, {
    c1c_incident: { text: 'Zero days without an incident. At least they’re honest.', emote: 'smirk' },
    c1c_stock: { text: 'Every phone we ever sold came through this building.', emote: 'sad' },
    c1c_spot: { text: 'Forty bars of stock. Right there.', emote: 'angry' },
    c1c_fig: { text: 'Give it ten more years. It’ll all be rainforest.', emote: 'neutral' },
    c1c_cards: { text: 'Somebody was winning.', emote: 'smirk' },
  });

  // ---- kit pieces -------------------------------------------------------------------------------------------------------
  let yesTex = null;
  const yes = () => yesTex || (yesTex = Tex.sign('logo', '', { color: '#f2c200' }));
  // a pallet load of boxed stock: pallet + cartons (a few with the yes logo on the face that looks at `face`)
  function load(x, y, z, r, o = {}) {
    const wood = M('planks', { color: 0x9a8058 }), card = M('cardboard'), w = o.w ?? 1.0, d = o.d ?? 1.1, h = o.h ?? 0.5 + r() * 0.8;
    Build.box(w, 0.14, d, wood, { pos: [x, y, z], solid: false, ao: false });
    const tint = [0xffffff, 0xe8dcc8, 0xd8c8a8, 0xc8b89a][(r() * 4) | 0];
    if (r() < 0.55) {
      Build.box(w * 0.94, h, d * 0.94, card, { pos: [x, y + 0.14, z], tint, solid: false });
    } else {
      const hh = h * (0.45 + r() * 0.2);
      for (const [dx, dz] of [[-0.25, -0.27], [0.25, -0.27], [-0.25, 0.27], [0.25, 0.27]]) if (r() < 0.9) Build.box(w * 0.46, hh * (0.8 + r() * 0.5), d * 0.46, card, { pos: [x + dx * w, y + 0.14, z + dz * d], yaw: (r() - 0.5) * 0.12, tint: tint - (r() < 0.5 ? 0x101008 : 0), solid: false });
    }
    if (o.face != null && r() < 0.45) Build.decal(yes(), { pos: [x + Math.sin(o.face) * (w * 0.49), y + 0.14 + h * 0.55, z + Math.cos(o.face) * (d * 0.49)], yaw: o.face, w: 0.42, h: 0.21 });
    if (o.solid) Build.A.collider([x - w / 2, y, z - d / 2], [x + w / 2, y + 0.14 + h, z + d / 2]);
    return h + 0.14;
  }

  // a back-to-back double row of pallet racking centred on x, from z0 to z1 (collapsed: the east face half down)
  function rack(x, z0, z1, r, o = {}) {
    const upM = M('metal_painted', { color: 0x2a4670 }), bm = M('metal_painted', { color: 0xd0601c }), top = 5.2, lv = [0.05, 1.75, 3.45];
    const n = Math.round((z1 - z0) / 2.5), bay = (z1 - z0) / n;
    for (const s of [-1, 1]) {
      const fx = x + s * 1.05, bent = o.collapsed && s > 0;
      for (let i = 0; i <= n; i++) for (const dx of [0, -s * 0.9]) {
        const z = z0 + i * bay, lean = bent && i >= 1 && i <= 2 && dx === 0;
        Build.box(0.08, top, 0.08, upM, { pos: [fx + dx, 0, z], rot: lean ? [0, 0, s * 0.22] : undefined, solid: false });
      }
      for (const y of [1.75, 3.45, top - 0.14]) for (const dx of [0, -s * 0.9]) {
        if (bent && dx === 0 && y > 1) { Build.box(0.06, 0.13, bay * 1.1, bm, { pos: [fx + s * 0.4, y - 0.9, z0 + bay * 1.6], rot: [0.5, 0, s * 0.3], solid: false }); continue; }
        Build.box(0.06, 0.13, z1 - z0, bm, { pos: [fx + dx, y - 0.13, (z0 + z1) / 2], solid: false });
      }
      for (let i = 0; i < n; i++) for (const y of lv) for (const k of [-0.6, 0.6]) {
        if (r() > (o.fill ?? 0.78)) continue;
        if (bent && y > 1 && i >= 1) continue;
        load(x + s * 0.58, y, z0 + (i + 0.5) * bay + k * bay * 0.4, r, { w: 0.95, d: 1.0, h: 0.45 + r() * (y > 3 ? 0.9 : 1.15), face: s > 0 ? PI / 2 : -PI / 2 });
      }
    }
    Build.A.collider([x - 1.12, 0, z0 - 0.05], [x + 1.12, top, z1 + 0.05]);
  }

  // a counterbalance forklift, forks raised to `lift` with a load on them
  function forklift(x, z, yaw, lift, r) {
    const g = Build.group({ pos: [x, 0, z], yaw });
    const body = M('metal_painted', { color: 0xd89a1a }), dark = C(0x1a1a1a, { rough: 0.7 }), steel = M('metal', { color: 0x5a5c5e }), cage = C(0x2a2a2a, { rough: 0.5, metal: 0.5 });
    Build.box(1.12, 0.78, 1.95, body, { parent: g, pos: [0, 0.22, -0.25] });
    Build.box(1.12, 0.62, 0.55, body, { parent: g, pos: [0, 1.0, -0.98], tint: 0xb8b8b8, solid: false });
    Build.box(0.55, 0.12, 0.5, dark, { parent: g, pos: [0, 1.0, -0.35], solid: false });
    Build.box(0.55, 0.55, 0.1, dark, { parent: g, pos: [0, 1.1, -0.62], rot: [-0.15, 0, 0], solid: false });
    Build.box(0.06, 0.5, 0.06, dark, { parent: g, pos: [0, 1.0, 0.2], rot: [0.5, 0, 0], solid: false });
    for (const sx of [-0.52, 0.52]) for (const sz of [0.45, -0.95]) Build.box(0.06, 1.25, 0.06, cage, { parent: g, pos: [sx, 1.0, sz], solid: false });
    Build.box(1.14, 0.05, 1.5, cage, { parent: g, pos: [0, 2.25, -0.25], solid: false });
    for (const sx of [-0.36, 0.36]) Build.box(0.1, 2.4, 0.12, steel, { parent: g, pos: [sx, 0.12, 0.82], solid: false });
    Build.box(0.86, 0.5, 0.06, steel, { parent: g, pos: [0, lift, 0.9], solid: false });
    for (const sx of [-0.26, 0.26]) Build.box(0.12, 0.05, 1.1, steel, { parent: g, pos: [sx, lift, 1.45], solid: false });
    if (lift > 0.4) load(x + Math.sin(yaw) * 1.45, lift + 0.05, z + Math.cos(yaw) * 1.45, r, { w: 1.0, d: 1.05, h: 0.7 });
    const wheel = new THREE.CylinderGeometry(0.28, 0.28, 0.22, 14); wheel.rotateZ(PI / 2);
    Build.mesh(mergeGeometries([[-0.5, 0.45], [0.5, 0.45], [-0.5, -0.95], [0.5, -0.95]].map(([a, b]) => wheel.clone().translate(a, 0.28, b))), C(0x151515, { rough: 0.9 }), { parent: g });
    return g;
  }

  // one mesh per material for the whole hall (Build's 24 m cells would cut it into quarters: four times the draw calls)
  function mergeStatics(A) {
    A.group.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(A.group.matrixWorld).invert(), buckets = new Map(), c = V(), m = new THREE.Matrix4();
    A.group.traverse(o => {
      if (!o.isMesh || !o.userData.batch || o.isInstancedMesh) return;
      o.geometry.computeBoundingBox(); o.geometry.boundingBox.getCenter(c).applyMatrix4(o.matrixWorld).applyMatrix4(inv);
      const k = [o.material.uuid, Math.floor((c.x + 60) / 120), Math.floor((c.z + 36) / 120), o.castShadow, o.renderOrder, !!o.geometry.index, Object.keys(o.geometry.attributes).sort()].join('|');
      (buckets.get(k) || buckets.set(k, []).get(k)).push(o);
    });
    for (const arr of buckets.values()) {
      if (arr.length < 2) continue;
      const g = mergeGeometries(arr.map(o => o.geometry.clone().applyMatrix4(m.multiplyMatrices(inv, o.matrixWorld))));
      if (!g) continue;
      const me = new THREE.Mesh(g, arr[0].material); me.castShadow = arr[0].castShadow; me.receiveShadow = arr[0].receiveShadow; me.renderOrder = arr[0].renderOrder; A.group.add(me);
      for (const o of arr) { o.parent.remove(o); if (!o.geometry.userData.shared) o.geometry.dispose(); }
    }
    // under a storm sky only the big shapes throw readable shadows (walls, roof, racks, stacks): small clutter skips the shadow pass
    const bb = new THREE.Box3(), sz = V();
    A.group.traverse(o => { if (o.isMesh && o.castShadow && !o.isInstancedMesh && bb.setFromObject(o).getSize(sz).length() < 3.2) o.castShadow = false; });
  }

  // rain that only falls where it's open to the sky (outside the dock door, the lane, through the roof hole, two leaks)
  function rain(A, boxes) {
    const n = boxes.reduce((s, b) => s + b[6], 0), pos = new Float32Array(n * 6), seed = [], r = U.rng(71);
    let k = 0;
    for (const b of boxes) for (let i = 0; i < b[6]; i++, k++) seed.push([b[0] + r() * (b[3] - b[0]), b[2] + r() * (b[5] - b[2]), b[1], b[4] - b[1], r(), 8 + r() * 4]);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const ls = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xb8c8c4, transparent: true, opacity: 0.32, depthWrite: false }));
    ls.frustumCulled = false; A.group.add(ls);
    A.update((dt, t) => {
      for (let i = 0; i < n; i++) {
        const s = seed[i], y = s[2] + s[3] - ((t * s[5] + s[4] * s[3]) % s[3]);
        pos[i * 6] = s[0]; pos[i * 6 + 1] = y; pos[i * 6 + 2] = s[1];
        pos[i * 6 + 3] = s[0] - 0.04; pos[i * 6 + 4] = Math.max(s[2], y - 0.45); pos[i * 6 + 5] = s[1] + 0.01;
      }
      g.attributes.position.needsUpdate = true;
    });
  }

  // the storm sky seen through the high windows and the dock door, and the far bank of the river
  function outside(A) {
    const g = new THREE.SphereGeometry(700, 24, 12), p = g.attributes.position, col = [], c = new THREE.Color(), hz = new THREE.Color(0x7c8a84), zen = new THREE.Color(0x2e3836);
    for (let i = 0; i < p.count; i++) { const y = p.getY(i) / 700; c.copy(hz).lerp(zen, U.smooth(U.clamp(y * 2.4))); col.push(c.r, c.g, c.b); }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    A.data.sky = Build.mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }), { pos: [0, -60, 24], shadow: false, receive: false });
    const r = U.rng(9), towers = [];
    for (let z = -380; z < 460; z += 14 + r() * 26) {
      const w = 12 + r() * 26, h = 18 + Math.pow(r(), 1.6) * 120, x = 430 + r() * 60, b = new THREE.BoxGeometry(w * 0.8, h, w);
      b.translate(x, h / 2 - 2, z);
      const cc = new THREE.Color(0x56625e).lerp(new THREE.Color(0x7c8a84), 0.25 + r() * 0.3), arr = [];
      for (let i = 0; i < b.attributes.position.count; i++) arr.push(cc.r, cc.g, cc.b);
      b.setAttribute('color', new THREE.Float32BufferAttribute(arr, 3)); b.deleteAttribute('uv'); b.deleteAttribute('normal');
      towers.push(b);
    }
    Build.mesh(mergeGeometries(towers), new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }), { shadow: false, receive: false });
    Build.water({ x1: 34, z1: -400, x2: 700, z2: 500, y: -1.4, color: 0x14201c });
    // the wharf: wet apron, the edge, bollards, a container
    const conc = M('concrete_wet', { color: 0x70726c });
    Build.floor(16.3, -14, 34, 62, conc, { surface: 'concrete' });
    Build.box(0.5, 0.35, 76, M('concrete', { color: 0x8a8a84 }), { pos: [33.8, 0, 24], solid: false });
    for (const z of [-2, 9, 21, 34]) Build.prop('bollard', { pos: [33.1, 0, z], kind: 'steel', color: 0x2a2c2a });
    for (const z of [3, 15, 27]) Build.prop('tyre', { pos: [34.2, -0.6, z], yaw: PI / 2, standing: true });
    Build.box(2.4, 2.6, 6.1, M('corrugated', { color: 0x7a3a26 }), { pos: [25, 0, 13.5], yaw: 0.08 });
    Build.box(2.4, 2.6, 6.1, M('corrugated', { color: 0x2a4a5a }), { pos: [26.2, 0, 3.5], yaw: -0.05 });
    // the lane behind the side door: asphalt, the neighbour's brick wall, a skip
    Build.floor(-20, -6.5, -5, 0, M('asphalt', { color: 0x585a56 }), { surface: 'concrete' });
    Build.box(16, 7, 0.4, M('brick', { color: 0x7a5646 }), { pos: [-12.5, 0, -6.7] });
    Build.vines({ box: [-19, 1.5, -6.5, -9, 7, -6.45], density: 0.8, seed: 3, hang: true });
    Build.prop('bin', { kind: 'skip', pos: [-17.5, 0, -4.8], yaw: 0.1, open: true, worn: 0.9 });
    A.collider([-20.4, 0, -6.5], [-20, 4, 0]); A.collider([-5.2, 0, -6.5], [-4.8, 4, 0]); A.collider([-20.4, 0, -0.2], [-16, 4, 0.2]);
  }

  // ---- the hall -------------------------------------------------------------------------------------------------------
  function hall(A, r) {
    const clad = M('corrugated', { color: 0x6e746c }), plinth = M('concrete', { color: 0x7c7a72 }), steel = M('metal_painted', { color: 0x4a5048 });
    Build.floor(-16, 0, 16, 48, M('concrete', { color: 0x8c8c86, rough: 0.6, normal: 0.25, scale: 4 }), { surface: 'concrete' });
    // walls: tilt-up concrete to 1.2 m, cladding above; high clerestory windows east (the river light) and west (vines)
    Build.wall(16, 0, -16, 0, 8, clad, { thick: 0.3, trim: false, doors: [{ at: 12, w: 4, h: 4.5 }, { at: 29, w: 1.1, h: 2.2 }] });
    Build.wall(-16, 48, 16, 48, 8, clad, { thick: 0.3, trim: false });
    Build.wall(-16, 0, -16, 48, 5.2, clad, { thick: 0.3, trim: false });
    Build.wall(-16, 0, -16, 48, 2.8, clad, { y: 5.2, thick: 0.3, trim: false, windows: [9, 21, 33, 42].map(at => ({ at, w: 3.2, h: 1.7, sill: 0.5 })) });
    Build.wall(16, 48, 16, 0, 5.2, clad, { thick: 0.3, trim: false, doors: [{ at: 3, w: 4.2, h: 4.6 }, { at: 27, w: 4.2, h: 4.6 }, { at: 40, w: 4, h: 4.6 }] });
    Build.wall(16, 48, 16, 0, 2.8, clad, { y: 5.2, thick: 0.3, trim: false, windows: [3, 9, 15, 21, 27, 33, 39, 45].map(at => ({ at, w: 3.4, h: 1.7, sill: 0.5 })) });
    for (const [x1, z1, x2, z2] of [[-15.84, 0.16, -15.84, 47.84], [-15.84, 47.84, 15.84, 47.84], [-15.84, 0.16, -14, 0.16], [-12.4, 0.16, 2, 0.16], [6, 0.16, 15.84, 0.16], [15.84, 0.16, 15.84, 5.8], [15.84, 10.2, 15.84, 18.8], [15.84, 23.2, 15.84, 42.8]]) {
      const L = Math.hypot(x2 - x1, z2 - z1);
      Build.box(x1 === x2 ? 0.1 : L, 1.2, x1 === x2 ? L : 0.1, plinth, { pos: [(x1 + x2) / 2, 0, (z1 + z2) / 2], solid: false });
    }
    // gable ends
    const tri = new THREE.Shape([new THREE.Vector2(-16, 0), new THREE.Vector2(16, 0), new THREE.Vector2(0, 2.4)]);
    for (const z of [-0.15, 48.15]) Build.mesh(new THREE.ShapeGeometry(tri).translate(0, 8, z), M('corrugated', { color: 0x6e746c, side: THREE.DoubleSide }), { receive: true });
    // glass in some of the clerestory panes, the rest broken out
    const glass = M('glass_dirty', { transparent: true, opacity: 0.55, color: 0xa8b8b0 });
    for (const z of [3, 15, 33, 45]) Build.box(0.02, 1.7, 3.4, glass, { pos: [15.9, 5.7, z], solid: false });
    for (const z of [9, 42]) Build.box(0.02, 1.7, 3.2, glass, { pos: [-15.9, 5.7, z], solid: false });
    // portal frames: columns up the walls, rafters to the ridge, purlins
    const a = Math.atan2(2.4, 16), L = Math.hypot(16, 2.4);
    for (let z = 0; z <= 48; z += 6) {
      const zz = U.clamp(z, 0.3, 47.7);
      for (const s of [-1, 1]) {
        Build.box(0.36, 8, 0.24, steel, { pos: [s * 15.66, 0, zz], solid: z > 0 && z < 48 });
        Build.box(L, 0.42, 0.2, steel, { pos: [s * 8, 8 + 1.2 - 0.62, zz], rot: [0, 0, -s * a], solid: false });
      }
    }
    for (const u of [2.5, 6.5, 10.5, 14.5]) for (const s of [-1, 1]) Build.box(0.12, 0.2, 48, steel, { pos: [s * u, 10.4 - u * Math.tan(a) - 0.32, 24], solid: false });
    // the roof: corrugated strips, fibreglass skylights, and the hole over the east aisles
    const roofM = M('corrugated', { color: 0x5e625c, side: THREE.DoubleSide }), sky = C(0x7a8a7e, { emissive: 0x6c7c70, emissiveIntensity: 0.1, transparent: true, opacity: 0.75, side: THREE.DoubleSide });
    const panel = (s, z0, z1, u0, u1, m) => { const u = (u0 + u1) / 2; Build.box(u1 - u0, 0.05, z1 - z0, m, { pos: [s * u * Math.cos(a), 10.4 - u * Math.sin(a) - 0.02, (z0 + z1) / 2], rot: [0, 0, -s * a], solid: false }); };
    for (let z = 0; z < 48; z += 6) for (const s of [-1, 1]) {
      const hole = s > 0 && z === 24, lit = (z / 6 + (s > 0 ? 1 : 0)) % 2 === 0;
      if (hole) { panel(s, z, z + 6, 0, 4.6, roofM); panel(s, z, z + 6, 13.2, L, roofM); panel(s, z, z + 1.2, 4.6, 13.2, roofM); continue; }
      panel(s, z, z + 6, 0, 5.2, roofM); panel(s, z, z + 6, 5.2, 7.2, lit ? sky : roofM); panel(s, z, z + 6, 7.2, L, roofM);
    }
    // the roof hole: torn sheets hanging in, vines down its edges
    Build.box(3.2, 0.05, 2.2, roofM, { pos: [6.4, 8.7, 28.8], rot: [0.9, 0.2, -0.3], solid: false });
    Build.box(2.2, 0.05, 1.6, roofM, { pos: [11.6, 8.2, 29.2], rot: [-1.1, 0, 0.2], solid: false });
    Build.vines({ box: [4.8, 6.0, 25.2, 12.8, 9.4, 25.3], density: 0.9, seed: 12, hang: true });
    Build.vines({ box: [-15.8, 2.2, 18, -15.75, 7.6, 36], density: 0.7, seed: 5, hang: true });
    Build.vines({ box: [-15.8, 3.0, 5, -15.75, 7.6, 13], density: 0.6, seed: 6, hang: true });
    // floor story: painted walkway lines, oil, water stains, moss where the rain gets in, leaves blown through the dock door
    const paint = C(0xc8a42a, { rough: 0.8 });
    for (const x of [-13.8, 9.2]) Build.box(0.1, 0.005, 46, paint, { pos: [x, 0.004, 24.5], solid: false, ao: false });
    Build.box(28, 0.005, 0.1, paint, { pos: [0, 0.004, 14.2], solid: false, ao: false });
    Build.box(28, 0.005, 0.1, paint, { pos: [0, 0.004, 33.8], solid: false, ao: false });
    for (const [x, z, s, k] of [[-3.5, 8.2, 2.4, 'oil'], [5, 6, 1.4, 'oil'], [2.5, 38, 2.2, 'oil'], [13, 43, 2.8, 'oil'], [-9, 26, 3, 'water_stain'], [12, 12, 4, 'water_stain'], [-6, 44, 3, 'water_stain']]) Build.decal(k, { floor: true, pos: [x, 0.006, z], w: s, h: s * 0.8, spin: x + z, opacity: 0.8 });
    for (const [x, z, s] of [[15, 7, 2.6], [15.2, 20, 2], [-15.2, 21, 2.4], [8.4, 31.5, 3], [14.6, 31, 2.2], [-15.3, 40, 1.8]]) Build.decal('moss_patch', { floor: true, pos: [x, 0.008, z], w: s, h: s, spin: z });
    Build.scatter('leaves', { box: [11, 4, 15.8, 12], count: 90, seed: 4 });
    Build.scatter('debris', { box: [-15, 1, 15, 47], count: 160, seed: 8 });
    Build.scatter('paper', { box: [-15, 14, 15, 34], count: 30, seed: 9 });
  }

  function receiving(A, r) {
    // the side door they slip in by (hanging open), a strip of rain blowing in
    Build.prop('office_door', { pos: [-13, 0, 0], yaw: PI, open: 0.9, text: 'STAFF ENTRY', thick: 0.3, worn: 0.9 });
    Build.light('point', { pos: [-13, 2.1, 1.3], color: 0x9aaca8, intensity: 4, distance: 8, decay: 1.5 });
    Build.decal('puddle', { floor: true, pos: [-13, 0.007, 1.2], w: 2.2, h: 1.6 });
    Build.prop('roller_shutter', { pos: [4, 0, 0], yaw: PI, w: 4, h: 4.5, open: 0, color: 0x8a908c });
    Build.poster('comms_report', { pos: [-8.4, 1.7, 0.2], w: 0.62, worn: 0.5 });
    Build.poster('promo_upgrade', { pos: [-7.5, 1.6, 0.2], w: 0.6, worn: 0.8 });
    Build.decal(Tex.graffiti('NO REFUNDS', { color: '#c8c0b0', style: 'drip', w: 1024, h: 256 }), { pos: [9, 2.6, 0.18], w: 5, h: 1.25 });
    // pallet cover in front of the door (the bottle on top), stock and loads across the bay
    for (const [x, h] of [[-14.8, 1.45], [-13.6, 0.86], [-12.4, 0.9], [-11.2, 0.8]]) load(x, 0, 4.8, r, { h, face: PI, solid: true });
    for (const [x, z, h] of [[1.5, 4.2, 0.9], [2.7, 4.2, 1.2], [4.5, 12.4, 1.5], [5.7, 12.6, 0.8], [-7, 12.2, 0.9], [9.6, 12.6, 1.05], [-1, 12.3, 1.4], [12.6, 1.8, 0.8], [13.8, 1.8, 1.2]]) load(x, 0, z, r, { h, face: PI, solid: true });
    Build.prop('pallet', { pos: [7.2, 0, 9], yaw: 0.3, stack: 4 });
    Build.prop('pallet', { pos: [-15.2, 0, 1.2], tilt: 0.25, yaw: PI / 2 });
    forklift(-3.2, 8.2, 0.6, 1.3, r);
    // the goods-in cage: desk, time clock and card rack, the safety board
    Build.prop('fence', { kind: 'chainlink', pos: [-16, 0, 7], length: 3.8, h: 2.6 });
    Build.prop('fence', { kind: 'chainlink', pos: [-11, 0, 7], length: 0.6, h: 2.6 });
    Build.prop('fence', { kind: 'chainlink', pos: [-10.4, 0, 7], yaw: -PI / 2, length: 6, h: 2.6 });
    Build.prop('fence', { kind: 'chainlink', pos: [-16, 0, 13], length: 5.6, h: 2.6 });
    Build.prop('desk', { kind: 'office', pos: [-14.9, 0, 10.2], yaw: PI / 2, w: 1.4, d: 0.7 });
    Build.prop('chair', { kind: 'office', pos: [-14.1, 0, 10.4], yaw: -PI / 2 - 0.4 });
    Build.prop('filing_cabinet', { pos: [-15.55, 0, 12.3], yaw: PI / 2, open: 2 });
    Build.box(0.24, 0.34, 0.16, C(0xc8c4b4, { rough: 0.6 }), { pos: [-15.85, 1.25, 8.4], solid: false });
    Build.decal(Tex.text('IN  OUT', { w: 256, h: 64, color: '#2a2a2a', bg: '#d8d4c4' }), { pos: [-15.76, 1.52, 8.4], yaw: PI / 2, w: 0.22, h: 0.06 });
    const cardT = Tex.text('▮ ▮ ▮ ▮ ▮ ▮\n▮ ▮ ▮ ▮ ▮ ▮\n▮ ▮ ▮ ▮ ▮ ▮', { w: 256, h: 192, color: '#e8e4d4', bg: '#3a3c38' });
    Build.decal(cardT, { pos: [-15.8, 1.2, 9.3], yaw: PI / 2, w: 0.7, h: 0.5 });
    Build.decal(Tex.text('THIS SITE HAS WORKED\n\n0\n\nDAYS WITHOUT AN INCIDENT', { w: 512, h: 384, color: '#ffffff', bg: '#1e5a32', weight: 'bold' }), { pos: [-15.8, 2.05, 11.1], yaw: PI / 2, w: 1.2, h: 0.9 });
    Build.prop('ceiling_light', { kind: 'caged', pos: [-13.2, 2.9, 10], on: false });
    Build.box(0.04, 0.4, 0.04, C(0x2a2a2a), { pos: [-13.2, 2.9, 10], solid: false });
    // the card table by the dock door: cards, cans, a lantern, the chairs pushed back when they got up
    Build.prop('table', { kind: 'folding', pos: [10.4, 0, 4.2], w: 1.8, d: 0.8 });
    for (const [x, z, y, k] of [[9.3, 4.1, 1.7, 'folding'], [11.5, 4.3, -1.5, 'plastic'], [10.3, 5.0, PI + 0.4, 'folding']]) Build.prop('chair', { kind: k, pos: [x, 0, z], yaw: y });
    const cardM = C(0xf0ece0, { rough: 0.8 });
    for (let i = 0; i < 9; i++) Build.box(0.06, 0.004, 0.09, cardM, { pos: [9.9 + r() * 1.1, 0.735, 3.95 + r() * 0.45], yaw: r() * 3, solid: false, ao: false });
    Build.scatter('cans', { box: [9.4, 3.2, 11.8, 5.6], count: 10, seed: 3 });
    Build.box(0.14, 0.24, 0.14, C(0x2a2c2a, { rough: 0.5 }), { pos: [10.9, 0.73, 4.45], solid: false });
    Build.box(0.1, 0.12, 0.1, C(0xfff0c0, { emissive: 0xffc070, emissiveIntensity: 3 }), { pos: [10.9, 0.8, 4.45], solid: false });
    Build.glow({ pos: [10.9, 0.88, 4.45], color: 0xffb060, size: 1.1, opacity: 0.8 });
    Build.light('point', { pos: [10.9, 1.3, 4.45], color: 0xffb468, intensity: 3.5, distance: 7, decay: 1.6, flicker: 0.08 });
    Build.prop('esky', { pos: [12.2, 0, 5.4], yaw: 0.3 });
    Build.prop('mattress', { pos: [13.6, 0, 11.2], yaw: 0.1, dirty: true });
    Build.prop('camp_stove', { pos: [12.4, 0, 10.4], lit: false });
    // dock door 1, half up: grey river light, rain blowing in, a puddle
    Build.prop('roller_shutter', { pos: [16, 0, 8], yaw: -PI / 2, w: 4, h: 4.5, open: 0.56, color: 0x8a908c });
    Build.water({ x1: 12.4, z1: 6.2, x2: 15.85, z2: 10.2, y: 0.012, color: 0x1c2420 });
    Build.pool({ pos: [13.5, 0, 8], r: 4, color: 0x9ab4b0, opacity: 0.16 });
    Build.light('point', { pos: [14.2, 2.2, 8], color: 0xa4bcb8, intensity: 9, distance: 14, decay: 1.4 });
    Build.prop('roller_shutter', { pos: [16, 0, 21], yaw: -PI / 2, w: 4.2, h: 4.6, open: 0.04, color: 0x7a807c });
    Build.decal(Tex.graffiti('4', { style: 'tally', color: '#e0dcd0', w: 256, h: 256 }), { pos: [15.8, 1.6, 13], yaw: -PI / 2, w: 0.7, h: 0.7 });
  }

  function aisles(A, r) {
    ROWS.forEach((x, i) => SEGS.forEach(([z0, z1], j) => rack(x, z0, z1, r, { collapsed: i === 3 && j === 1, fill: i === 3 && j === 1 ? 0.5 : 0.78 })));
    // aisle numbers hung from the purlins, a faded launch banner over aisle 2
    [-8.5, -2.5, 3.5].forEach((x, i) => Build.sign({ pos: [x, 6.2, 15.2], yaw: PI, tex: Tex.text(`AISLE ${i + 1}`, { w: 512, h: 128, color: '#f0ece0', bg: '#2a4670', weight: 'bold' }), w: 1.3, h: 0.32 }));
    Build.prop('promo_banner', { pos: [-2.5, 5.1, 24], yaw: PI, text: 'MIDNIGHT LAUNCH — BE FIRST', w: 3.2, drop: 1.4 });
    // the Wholesaler's gun crate in aisle 1: lid off, straw, the sawn-off on top
    const wood = M('planks', { color: 0x8a6a48 });
    Build.box(1.1, 0.5, 0.7, wood, { pos: [-8.6, 0, 28.4] });
    Build.box(1.02, 0.02, 0.62, C(0xb8a060, { rough: 1 }), { pos: [-8.6, 0.48, 28.4], solid: false });
    Build.box(1.1, 0.04, 0.7, wood, { pos: [-9.5, 0, 29.3], rot: [0, 0.7, 1.2], solid: false });
    Build.decal(Tex.text('FRAGILE — THIS WAY UP', { w: 512, h: 64, color: '#1a1a1a' }), { pos: [-8.6, 0.3, 28.04], yaw: PI, w: 0.8, h: 0.1 });
    Build.prop('crate', { kind: 'wood', pos: [-7.4, 0, 29.6], yaw: 0.2 });
    // a bed between the racks in aisle 3: the smugglers live here
    Build.prop('mattress', { pos: [3.6, 0, 18.5], yaw: 0.05, dirty: true });
    Build.prop('tarp', { pos: [3.2, 0, 21], w: 2, d: 1.6, h: 0.5, color: 0x2a5a8a });
    Build.prop('rubbish_bag', { pos: [2.2, 0, 17.2], n: 2 });
    // east of the racks: the roof is down. Rain falls into a pool, a young fig reaches for the hole, ferns, moss
    Build.water({ x1: 8.2, z1: 23.4, x2: 14.8, z2: 31.2, y: 0.03, color: 0x10201a });
    A.water({ box: [8.2, 23.4, 14.8, 31.2], y: 0.03 });
    Build.tree('fig', { pos: [12.6, 0, 26.2], scale: 0.32, seed: 4 });
    Build.grass({ box: [8, 22.6, 15.6, 32], count: 380, color: 0x3e5a2a, height: 0.55 });
    Build.scatter('rubble', { box: [8.5, 24, 14, 30], count: 60, seed: 11 });
    for (let i = 0; i < 7; i++) { const x = 8 + r() * 3, z = 25 + r() * 7; Build.box(0.5 + r() * 0.4, 0.3 + r() * 0.4, 0.5 + r() * 0.4, M('cardboard', { color: 0x8a7a60 }), { pos: [x, 0, z], yaw: r() * 3, rot: [r() * 0.4, r() * 3, r() * 0.3], solid: false }); }
    Build.godray({ pos: [9, 9.6, 27.5], dir: SUN, w: 5, h: 13, color: 0xc8d8d0, opacity: 0.2 });
    Build.dust({ box: [2, 0.4, 23, 13, 9, 31], count: 260, color: 0xd8e4dc, size: 0.02, opacity: 0.5 });
    Build.light('point', { pos: [10.4, 4, 27.4], color: 0xa8c0bc, intensity: 6, distance: 14, decay: 1.4 });
  }

  function dispatch(A, r) {
    const y = DECK, steel = M('metal_painted', { color: 0x4a5048 }), rail = M('metal_painted', { color: 0xd8b020 });
    // the fire drum they warm their hands at, crates for seats, a pot
    Build.prop('barrel', { kind: 'burning', pos: [-8.5, 0, 36.4], light: 1.4 });
    for (const [x, z, yy] of [[-9.8, 35.6, 0.4], [-7.2, 35.4, -0.5]]) Build.prop('crate', { kind: 'plastic', pos: [x, 0, z], yaw: yy, color: 0x2a6ad8 });
    Build.prop('jerry_can', { pos: [-10.6, 0, 37.2], yaw: 1 });
    Build.decal('scorch', { floor: true, pos: [-8.5, 0.007, 36.4], w: 2.2, h: 2.2 });
    // the van, backed in for loading; lockers; the empty spot where their stock sat
    Build.car('van', { pos: [13.6, 0, 44.5], yaw: PI, color: 0xe6e2d8, seed: 7 });
    Build.prop('roller_shutter', { pos: [16, 0, 45], yaw: -PI / 2, w: 4.2, h: 4.6, open: 0, color: 0x7a807c });
    Build.prop('locker', { pos: [-15.55, 0, 42.6], yaw: PI / 2, n: 4, ajar: 1 });
    Build.prop('locker', { pos: [-15.55, 0, 44.9], yaw: PI / 2, n: 3 });
    Build.box(0.5, 0.8, 0.04, C(0xd8e020, { rough: 0.8 }), { pos: [-15.7, 1.1, 46.4], yaw: PI / 2, solid: false });
    const chalk = C(0xdedad0, { rough: 1 });
    for (const [x, z] of [[-7.6, 44.6], [-5.4, 44.6], [-7.6, 46.4], [-5.4, 46.4]]) for (const [w, d, dx, dz] of [[1.2, 0.05, 0, -0.6], [1.2, 0.05, 0, 0.6], [0.05, 1.2, -0.6, 0], [0.05, 1.2, 0.6, 0]]) Build.box(w, 0.004, d, chalk, { pos: [x + dx, 0.004, z + dz], solid: false, ao: false });
    Build.decal(Tex.graffiti('W&C', { style: 'spray', color: '#e8e4d8', w: 512, h: 256 }), { floor: true, pos: [-6.5, 0.009, 43.4], w: 1.6, h: 0.8, spin: PI });
    Build.prop('pallet', { pos: [-6.5, 0, 45.5], yaw: 0.1 });
    Build.prop('whiteboard', { pos: [-1.5, 1.0, 47.83], yaw: PI, stand: false, w: 1.3, h: 0.85, text: 'RUNS\nWED — BRISBANE ST (2)\nFRI — LANDLINES — 40\nr:NO CREDIT\nb:Stock-take Sunday' });
    for (const [x, z, h] of [[0.5, 45.5, 1.4], [1.7, 45.5, 1.1], [0.5, 46.7, 0.8], [-12.2, 46.9, 1.3], [-11, 46.9, 1.0], [4.5, 36.2, 1.1]]) load(x, 0, z, r, { h, face: PI, solid: true });
    Build.prop('pallet', { pos: [6.6, 0, 46.8], stack: 6, yaw: 0.05 });
    // the mezzanine: steel deck on columns, yellow railing, stairs at the east end
    Build.floor(-16, 40, 11, 48, M('metal', { color: 0x6a6c68, rough: 0.7 }), { y, thick: 0.3 });
    Build.box(27, 0.35, 0.2, steel, { pos: [-2.5, y - 0.65, 40.05], solid: false });
    for (const x of [-13, -8, -3, 2, 7, 10.85]) Build.box(0.22, y - 0.3, 0.22, steel, { pos: [x, 0, 40.2] });
    Build.stairs({ from: [10, 0, 32.8], to: [10, y, 40], width: 1.2, mat: M('metal_painted', { color: 0x3a3e3a }), rail: true });
    const railing = (x1, z1, x2, z2) => {
      const L = Math.hypot(x2 - x1, z2 - z1), cx = (x1 + x2) / 2, cz = (z1 + z2) / 2, along = x1 === x2;
      for (const h of [0.5, 1.05]) Build.box(along ? 0.05 : L, 0.05, along ? L : 0.05, rail, { pos: [cx, y + h, cz], solid: false });
      for (let t = 0; t <= L + 0.01; t += 1.5) Build.box(0.05, 1.08, 0.05, rail, { pos: [x1 + (x2 - x1) * t / L, y, z1 + (z2 - z1) * t / L], solid: false });
      A.collider([Math.min(x1, x2) - 0.05, y, Math.min(z1, z2) - 0.05], [Math.max(x1, x2) + 0.05, y + 1.2, Math.max(z1, z2) + 0.05]);
    };
    railing(-16, 40, 9.4, 40); railing(10.6, 40, 11, 40); railing(11, 40, 11, 48);
    Build.sign({ pos: [11.2, 1.5, 33.4], yaw: -PI / 2, tex: Tex.text('OFFICE ↑\nAUTHORISED PERSONNEL ONLY', { w: 512, h: 192, color: '#1a1a1a', bg: '#e8d020', weight: 'bold' }), w: 0.9, h: 0.34, post: 0 });
    // up on the deck: overflow stock, the generator and its cable into the office
    for (const [x, z, h] of [[2.2, 46.8, 1.0], [3.4, 46.8, 1.4], [6.4, 46.9, 0.9], [8.8, 45, 1.2]]) load(x, y, z, r, { h, face: PI, solid: true });
    Build.prop('generator', { pos: [-1.2, y, 41.2], yaw: 0.2, on: true });
    Build.wire([-1.4, y + 0.3, 41.4], [-3.05, y + 2.2, 42.4], { sag: 0.3, r: 0.012, color: 0x1a1a1a });
    Build.wire([-3.05, y + 2.2, 42.4], [-3.05, y + 2.5, 45], { sag: 0.1, r: 0.012, color: 0x1a1a1a });
    A.dark([-16, 40.3, 11, 48], 0.55);
    office(A);
  }

  function office(A) {
    const D = A.data, y = DECK;
    Build.room({ x: -8.5, z: 44.8, y, w: 11, d: 6.4, h: 2.8, omit: 'n', wall: M('plaster', { color: 0xbab4a2 }), outside: M('metal_painted', { color: 0x7e8278 }),
      floor: M('carpet', { color: 0x4e4a40 }), ceil: M('plaster', { color: 0xa8a294 }), surface: 'carpet',
      doors: [{ side: 's', at: 3, w: 0.9, h: 2.05 }, { side: 'w', at: 1, w: 0.9, h: 2.05 }],
      windows: [{ side: 's', at: -3, w: 2.2, h: 1.15, sill: 1.0 }, { side: 's', at: -0.2, w: 2.2, h: 1.15, sill: 1.0 }] });
    D.door = Build.prop('office_door', { pos: [-5.5, y, 41.6], yaw: PI, text: 'OFFICE', dynamic: true, worn: 0.6 });
    D.stairDoor = Build.prop('office_door', { pos: [-14, y, 45.8], yaw: -PI / 2, text: 'FIRE STAIRS', dynamic: true, worn: 0.6 });
    // the lit windows, seen from the floor: warm glass behind half-drawn blinds
    const warm = new THREE.MeshStandardMaterial({ color: 0x20160c, emissive: 0xffb060, emissiveIntensity: 0.3, transparent: true, opacity: 0.35, side: THREE.FrontSide, depthWrite: false });
    for (const x of [-11.5, -8.7]) {
      Build.mesh(new THREE.PlaneGeometry(2.2, 1.15), warm, { pos: [x, y + 1.575, 41.52], yaw: PI, shadow: false });
      for (let i = 0; i < 6; i++) Build.box(2.2, 0.025, 0.05, C(0x6a6456, { rough: 0.8 }), { pos: [x, y + 1.62 + i * 0.09, 41.66], rot: [0.5, 0, 0], solid: false, ao: false });
    }
    // the stairwell behind the west wall: dark, a green exit sign
    Build.wall(-16, 41.6, -14, 41.6, 2.8, M('metal_painted', { color: 0x7e8278 }), { y, thick: 0.15, trim: false });
    Build.box(2, 0.1, 6.4, M('plaster', { color: 0x6a6a64 }), { pos: [-15, y + 2.8, 44.8], solid: false });
    Build.box(0.36, 0.14, 0.04, C(0x1a8a3a, { emissive: 0x2aff6a, emissiveIntensity: 1.4 }), { pos: [-15, y + 2.4, 47.9], solid: false });
    // the Wholesaler's office: desk, lamp, the cash tin of cells, filing, a couch he sleeps on, the stock board, a calendar
    Build.prop('desk', { kind: 'office', pos: [-8.6, y, 46.7], yaw: 0, w: 1.7, d: 0.8 });
    Build.prop('chair', { kind: 'office', pos: [-8.4, y, 47.5], yaw: PI + 0.2 });
    Build.prop('lamp', { kind: 'desk', pos: [-9.25, y + 0.74, 46.85], yaw: 0.6, on: true });
    Build.box(0.34, 0.1, 0.22, M('metal_painted', { color: 0x2a4a34 }), { pos: [-8.1, y + 0.74, 46.5], solid: false });
    for (let i = 0; i < 6; i++) Build.box(0.035, 0.08, 0.035, C(0x2a8a4a, { emissive: 0x6aff9a, emissiveIntensity: 1.2 }), { pos: [-8.24 + (i % 3) * 0.07, y + 0.84, 46.45 + (i > 2 ? 0.08 : 0)], solid: false, ao: false });
    Build.box(0.24, 0.02, 0.32, C(0x6a2a1c, { rough: 0.8 }), { pos: [-7.7, y + 0.74, 46.8], yaw: 0.3, solid: false });
    for (const x of [-13.4, -12.8]) Build.prop('filing_cabinet', { pos: [x, y, 47.65], yaw: PI });
    Build.prop('couch', { pos: [-3.55, y, 45.2], yaw: -PI / 2, kind: 'leather', color: 0x3a2a22, pillows: 1 });
    Build.prop('whiteboard', { pos: [-6, y + 1.05, 47.93], yaw: PI, stand: false, w: 1.4, h: 0.9, text: 'STOCK\nRADIOS — 12\nCELLS — 140\nFLIPS — 30\nr:W&C LOT → LANDLINES FRI\nb:every customer is VALUED' });
    Build.decal(Tex.text('SURFERS\nPARADISE', { w: 256, h: 192, color: '#ffe888', bg: '#2a88c0', weight: 'bold' }), { pos: [-10.6, y + 1.75, 47.94], yaw: PI, w: 0.42, h: 0.32 });
    Build.decal(Tex.text('OCTOBER', { w: 256, h: 192, color: '#2a2a2a', bg: '#ece6d6' }), { pos: [-10.6, y + 1.42, 47.94], yaw: PI, w: 0.42, h: 0.32 });
    for (const [x, z, s] of [[-13.2, 42.6, 2], [-12.4, 42.4, 1]]) Build.prop('crate', { kind: 'plastic', pos: [x, y, z], stack: s, color: 0x3a3a3c });
    Build.prop('esky', { pos: [-4.2, y, 47.2], yaw: 0.2 });
    Build.prop('plant_pot', { pos: [-3.6, y, 42.2], kind: 'dead', pot: 'terracotta' });
    Build.prop('rug', { pos: [-8.3, y, 44.6], w: 2.4, d: 1.6, color: 0x7a3a2a });
    for (const x of [-10.5, -6.5]) Build.prop('ceiling_light', { kind: 'tube', pos: [x, y + 2.8, 44.6], color: 0xffe2b0, w: 1.2 });
    D.officeLight = Build.light('point', { pos: [-8.5, y + 2.3, 44.2], color: 0xffcc90, intensity: 7, distance: 10, decay: 1.5 });
    // window light onto the walkway and the floor below
    Build.light('spot', { pos: [-9.5, y + 2.2, 41.0], target: [-9.5, 0, 35.5], color: 0xffb46a, intensity: 26, distance: 14, angle: 0.75, penumbra: 0.8, decay: 1.4 });
    for (const x of [-11.5, -8.7]) Build.pool({ pos: [x, 0, 37.2], r: 2.2, color: 0xffa050, opacity: 0.12 });
    // the shot: blood on the desk front and the floor (shown in 1.4)
    D.blood = [Build.decal('blood', { pos: [-8.55, y + 0.55, 46.28], yaw: PI, w: 0.8, h: 0.7, dynamic: true }), Build.decal('blood', { floor: true, pos: [-8.6, y + 0.013, 45.3], w: 1.2, h: 1.0, spin: 0.4, dynamic: true })];
    for (const b of D.blood) b.visible = false;
    D.flash = Build.glow({ pos: [-9, y + 1.4, 43.6], color: 0xffd090, size: 0.6, dynamic: true }); D.flash.visible = false;
  }

  // ---- the area ----------------------------------------------------------------------------------------------------------
  CONTENT.levels['1C'] = {
    name: "The Wholesaler's warehouse", origin: O, grade: 'qz_green',
    fog: { color: 0x283230, density: 0.02 }, background: 0x283230, amb: 'warehouse', surface: 'concrete',
    env: { top: 0x3a4642, horizon: 0x6a7872, bottom: 0x0e0f0e, intensity: 0.55, spots: [{ dir: [1, 0.3, 0.1], color: 0xbfd0c8, power: 2.2 }, { dir: [-0.4, 0.2, 1], color: 0xffb060, power: 0.8 }] },
    build(A) {
      const D = A.data, r = U.rng(311);
      D.fresh = true; D.beats = []; D.foes = {}; D.tweens = []; D.listenT = 0;
      const hemi = Build.hemi({ sky: 0x6a7c76, ground: 0x1c1a14, intensity: 0.8 });
      D.sun = Build.sun({ dir: SUN, color: 0xbccac2, intensity: 2.6, area: 34, target: [0, 0, 24] });
      outside(A); hall(A, r); receiving(A, r); aisles(A, r); dispatch(A, r);
      for (const z of [9, 21, 33]) Build.godray({ pos: [15.6, 6.4, z], dir: SUN, w: 2.6, h: 9, color: 0xc8d8d0, opacity: 0.09 });
      Build.dust({ box: [-14, 0.4, 2, 14, 7, 46], count: 420, color: 0xc8d4cc, size: 0.018, opacity: 0.3 });
      rain(A, [[16.4, 0, 1, 31, 9, 15, 520], [5.2, 0, 25.4, 12.8, 9.4, 29.9, 300], [-19.6, 0, -6.2, -5.4, 6.5, -0.4, 240], [-6.1, 0, 23.8, -5.9, 9.8, 24.0, 10], [-13.6, 0, 36.2, -13.4, 8.2, 36.4, 8]]);
      // stealth: the dark aisles, the shadows under the deck; patrol routes; the way forward (hold T)
      A.dark([-16, 15, 8, 33.4], 0.62);
      A.dark([-16, 0, -10, 13], 0.3);
      A.navBounds(-16, 0, 16, 48);
      A.patrol('c1c_bay', [[-6.5, 0, 10], [3, 0, 10.3], [8, 0, 6.4], [-1.5, 0, 5.6]]);
      A.patrol('c1c_aisles', [[-2.5, 0, 16.6], [-2.5, 0, 31.8], [3.5, 0, 31.8], [3.5, 0, 16.6]]);
      A.patrol('c1c_dispatch', [[-12, 0, 44.2], [3, 0, 44.2], [7.6, 0, 37], [3, 0, 34.6], [-12, 0, 38.6]]);
      A.hint([[-6, 0, 5], [2, 0, 12.6], [-2.5, 0, 15], [-2.5, 0, 33], [9.9, 0, 32.4], [10, DECK, 40.5], [-5.5, DECK, 40.9]]);
      // pickups: scarce, where people left things
      A.pickup({ at: [-13.6, 1.02, 4.8], item: 'bottle' });
      A.pickup({ at: [6.5, 0.02, 13.5], item: 'bottle' });
      A.pickup({ at: [-15.55, 1.34, 12.3], item: 'cloth' });
      A.pickup({ at: [10.8, 0.75, 3.95], item: 'alcohol' });
      A.pickup({ at: [12.2, 0.46, 5.4], item: 'revolver_ammo', n: 2 });
      A.pickup({ at: [-1.8, 0.02, 7.2], item: 'pipe' });
      A.pickup({ at: [-8.75, 0.53, 28.35], item: 'shotgun' });
      A.pickup({ at: [-8.2, 0.53, 28.55], item: 'shotgun_ammo', n: 2 });
      A.pickup({ at: [-9.6, 0.02, 37.4], item: 'tape' });
      A.collectible({ at: [-14.85, 0.75, 10.0], kind: 'artifact', id: 'c1_price_list' });
      A.collectible({ at: [-15.0, 0.02, 43.7], kind: 'lanyard', id: 'c1_lanyard_dispatch' });
      for (const [id, at, rr] of [['c1c_incident', [-13.5, 0, 11], 3], ['c1c_stock', [-8.5, 0, 19.5], 3], ['c1c_spot', [-6.5, 0, 44], 3], ['c1c_fig', [10.2, 0, 32.2], 4], ['c1c_cards', [10.4, 0, 3.2], 3]]) A.remark({ at, r: rr, id, who: 'wai' });
      // the Wholesaler, in his office the whole time: pacing, counting, glancing down at the floor
      D.whole = A.char('wholesaler', { name: 'wholesaler', at: [-8.6, DECK, 45.7], yaw: 0 });
      // marks
      for (const [n, p, yaw] of [['mk_start', [-12.4, 0, 2.6], 0.3], ['mk_1c_out', [-13.1, 0, -1.6], 0], ['mk_1c_wai_out', [-13.7, 0, -2.9], 0.1],
        ['mk_1c_start', [-12.4, 0, 2.7], 0.3], ['mk_1c_wai', [-11.3, 0, 3.4], 0.15], ['mk_1c_b', [-7.6, 0, 11.1], 0.35], ['mk_1c_wai_b', [-8.9, 0, 10.6], 0.5],
        ['mk_1c_door', [-5.5, DECK, 40.9], 0], ['mk_14_chase_in', [-5.5, DECK, 40.8], 0], ['mk_14_wai_in', [-4.9, DECK, 40.6], -0.2],
        ['mk_14_chase', [-7.3, DECK, 43.4], -0.48], ['mk_14_wai', [-9.4, DECK, 43.1], 0.25], ['mk_14_wai2', [-9.9, DECK, 42.5], 0.8], ['mk_14_whole', [-8.6, DECK, 45.8], 0],
        ['mk_14_op_hide', [-15.1, DECK, 45.8], PI / 2], ['mk_14_op', [-12.8, DECK, 45.3], 1.92], ['mk_14_op_back', [-14.9, DECK, 45.9], -PI / 2]]) A.marker(n, p, yaw);
      // weather: lightning through the windows and the roof, thunder after; the Wholesaler pacing; beats; Airplane Mode time
      D.flashT = 6; D.paceT = 8;
      const base = { h: hemi.intensity, s: D.sun.intensity };
      D.loops = [Audio.loop('rain', { vol: 0.7 }), Audio.loop('drips', { pos: A.w([-6, 1, 24]), vol: 0.6 }), Audio.loop('turbine_hum', { pos: A.w([-1.2, DECK + 0.5, 41.2]), vol: 0.25 }), Audio.loop('water_lap', { pos: A.w([20, 0, 8]), vol: 0.5 })];
      A.update((dt, t) => {
        if ((D.birdT = (D.birdT ?? 9) - dt) <= 0) { D.birdT = 14 + Math.random() * 20; Audio.sfx(Math.random() < 0.6 ? 'pigeons' : 'metal_creak', { pos: A.w([-12 + Math.random() * 24, 8.5, 4 + Math.random() * 40]), vol: 0.45 }); }
        if ((D.flashT -= dt) <= 0) { D.flashT = 18 + Math.random() * 22; D.flash0 = t; Audio.sfx('thunder', { pos: A.w([80, 60, 20 + Math.random() * 40]), vol: 0.9 }); }
        const f = D.flash0 != null ? t - D.flash0 + 1.6 : 9;          // the flash leads the thunder
        const k = f < 0.1 ? 1 : f < 0.18 ? 0.2 : f < 0.3 ? 0.8 : f < 0.8 ? U.lerp(0.8, 0, (f - 0.3) / 0.5) : 0;
        hemi.intensity = base.h * (1 + k * 2.2); D.sun.intensity = base.s * (1 + k * 3); D.sky.material.color.setScalar(1 + k * 1.5);
        if (D.whole && !Director.active && (D.paceT -= dt) <= 0) { D.paceT = 7 + Math.random() * 8; const p = D.pace = !D.pace; D.whole.walkTo(A.w(p ? [-6.2, DECK, 44.2] : [-8.6, DECK, 45.8]), { speed: 0.9, face: p ? 0.6 : 0 }); }
        if (Play.listening) D.listenT += dt;
        for (const b of D.beats) if (!b.done && Play.char && !Director.active && b.when()) { b.done = true; b.run(); }
        teachTick(A, dt);
        if (D.opWound) wound(D.opWound);
        if (D.tweens.length) D.tweens = D.tweens.filter(f => !f(dt));
      });
      mergeStatics(A);
    },
    unload(A) { for (const l of A.data.loops) l.stop(0.4); if (A.data.opWound) A.data.opWound.ikT = {}; UI.prompt(null); },
  };

  // ---- small prompts (the only tutorial text): shown when nothing else is prompting, gone once done ----------------------
  function teach(A, text, done, o = {}) { A.data.teach = { text, done, t: 0, shown: 0, delay: o.delay ?? 0, max: o.max ?? 12 }; }
  function teachTick(A, dt) {
    const T = A.data.teach; if (!T) return;
    T.t += dt;
    if (T.done() || (T.shown && T.t - T.shown > T.max)) { if (T.shown) UI.prompt(null); A.data.teach = null; return; }
    if (!T.shown && T.t > T.delay && Play.char && Play.enabled && !Director.active && !Play.busy && !AI.takedownTarget(pp(), Play.char.yaw)) { UI.prompt(T.text); T.shown = T.t; }
  }
  const beat = (A, when, run) => A.data.beats.push({ when, run });

  // the Operator's free hand pressed to the blood on her cardigan
  const _w = V();
  function wound(c) {
    const f = U.fwd(c.yaw, V()), left = V(f.z, 0, -f.x);
    c.point('chest', _w).addScaledVector(f, 0.13).addScaledVector(left, 0.07).add(V(0, -0.24, 0));
    c.ikT = c.ikT || {}; c.ikT.L = { p: _w.clone(), w: 1 };
  }

  // ---- setup ---------------------------------------------------------------------------------------------------------------
  function reset(c) {
    c.stop(); c.detach(); c.gesture(null); c.lookAt(null); c.emote('neutral'); c.setVisible(true); c.ikT = {};
    for (const h of ['r', 'l']) if (c.held(h)) c.drop(h, { remove: true });
    c.pose('stand', { direct: true, dur: 0.01 });
  }
  const variant = (c, v) => { if (!(c.B && c.B.look && String(c.B.look.key).endsWith(':' + v))) c.outfit(v); };
  function kit() {
    const inv = Play.inventory;
    if (!inv.weapons.includes('revolver')) { Play.give('revolver', 1); Play.give('revolver_ammo', 4); }
  }
  function spawn(G, A, list) {
    list.forEach((f, i) => {
      const a = G.spawn('human', { pos: A.w([f.at[0], 0, f.at[1]]), yaw: f.yaw }, { name: f.name, faction: 'smuggler', weapon: f.weapon, behaviour: f.behaviour, route: f.route, seed: 60 + i + (f.torch ? 7 : 0) });
      if (f.torch) a.char.hold('torch', 'l', { light: true });
      A.data.foes[f.name] = a;
    });
  }
  // part 'a' (1.3) or 'b' (1.3b). Continues straight on when part A just handed over; otherwise a clean warehouse.
  async function setup(G, part, intro) {
    let A = G.areaById('1C');
    if (part === 'b' && A && A.data.handoff && G.A === A) { A.data.handoff = false; A.data.part = 'b'; return { A, cont: true }; }
    if (A && !A.data.fresh) G.unload('1C');       // a retry: a clean warehouse (the death fade covers it)
    A = await G.area('1C');
    A.data.fresh = false; A.data.part = part;
    const chase = G.actor('chase', 'chase'), wai = G.actor('wai', 'wai');
    reset(chase); reset(wai); variant(wai, 'bruised');
    const mk = part === 'b' ? ['mk_1c_b', 'mk_1c_wai_b'] : intro ? ['mk_1c_out', 'mk_1c_wai_out'] : ['mk_1c_start', 'mk_1c_wai'];
    G.place(chase, mk[0]); G.place(wai, mk[1]);
    G.player(chase, PROFILE); kit();
    AI.companion(wai, { role: 'wai' });
    if (part === 'a') spawn(G, A, FOES.a);
    spawn(G, A, FOES.b);
    for (let i = 0; i < 10; i++) Chars.update(1 / 30);
    Play.snapCamera();
    return { A, cont: false };
  }

  // ---- 1.3 part A: crouch, cover, the bottle, the choke ------------------------------------------------------------------
  async function partA(G, A) {
    const inv = Play.inventory, bottles = () => inv.items.bottle || 0;
    let had = bottles();
    teach(A, 'c – crouch', () => Play.crouched, { delay: 0.6, max: 14 });
    beat(A, () => { const n = bottles(); if (n < had) had = n; return n > had; }, () => {
      waiSay('Chuck it past him. They always look.', 'smirk');
      const n = bottles(); teach(A, 'hold g – aim, release to throw', () => bottles() < n, { delay: 1.8, max: 16 });
    });
    beat(A, () => {
      const s = foe(A, 'smuggler_dock'); if (!s || !s.alive || s.aware || s.state !== 'idle') return false;
      const q = s.char.root.position, d = U.dist2(pp(), q);
      return d < 6.5 && d > 2 && Math.cos(U.yawTo(q, pp()) - s.char.yaw) < -0.3;
    }, () => waiSay("He's got his back to you. Go on.", 'tense'));
    await G.until(() => inBox(pp(), [-16, 14.6, 16, 17]) && calm());
  }

  // ---- 1.3 part B: Airplane Mode, the sawn-off, dispatch, the office door --------------------------------------------------
  async function partB(G, A) {
    const D = A.data, wai = G.who('wai'), hadGun = Play.inventory.weapons.includes('shotgun');
    let taught = false;
    const lesson = () => {
      taught = true;
      const ag = comp(wai); if (ag) ag.hold(true);
      waiSay("Hold still. Listen. You can hear 'em breathing.", 'tense');
      D.listenT = 0;
      const t0 = G.t;
      teach(A, 'hold q – airplane mode', () => D.listenT > 1.4, { delay: 1.2, max: 16 });
      beat(A, () => D.listenT > 1.4 || G.t - t0 > 14 || !calm(), () => { const a = comp(wai); if (a) a.hold(false); });
    };
    const unaware = n => up(A, n) && !foe(A, n).aware && foe(A, n).state === 'idle';
    beat(A, () => !taught && inBox(pp(), [-16, 15.6, 8, 33]) && unaware('smuggler_aisle'), lesson);
    beat(A, () => !taught && inBox(pp(), [-16, 33, 16, 48]) && ['smuggler_fire', 'smuggler_torch'].some(unaware), lesson);
    if (!hadGun) beat(A, () => Play.inventory.weapons.includes('shotgun'), () => waiSay('Sawn-off. Save it for when it all goes wrong.', 'smirk'));
    beat(A, () => U.dist2(pp(), W(10, 0, 32.4)) < 2.6 && pp().y < 1 && calm(), () => waiSay("Office. Let's go say hello.", 'smirk'));
    // up the stairs: Wai comes up behind and waits by the door
    beat(A, () => pp().y > 1.6 && pp().z > O[2] + 34, () => {
      const ag = comp(wai); if (!ag) return;
      ag.hold(false);
      const foot = W(10, 0, 32.2), path = (AI.nav.path(wai.root.position, foot) || [foot]).concat([W(10, 0, 32.4), W(10, DECK, 40.5), W(3, DECK, 40.8)]);
      wai.walkTo(W(-4.3, DECK, 40.85), { path, speed: 2.4 }).then(() => { const a = comp(wai); if (a) a.hold(true); wai.turnTo(W(-5.5, DECK, 41.6), 0.5); });
    });
    await G.interact({ at: [-5.5, DECK, 40.9], r: 1.1, prompt: 'e – open', cond: calm });
  }

  const hasStep = id => CONTENT.chapters.ch1.steps.some(s => s.id === id);
  H['ch1.3'] = async G => {
    const resume = !!G.flags.c1cB, A0 = G.areaById('1C'), first = !resume && (!A0 || A0.data.fresh);
    const { A } = await setup(G, resume ? 'b' : 'a', first);
    if (!resume) {
      if (first) await G.scene('1.3.in');
      G.control(true);
      await partA(G, A);
      if (hasStep('1.3b')) { A.data.handoff = true; return; }
      G.flags.c1cB = true; G.save();
    } else G.control(true);
    await partB(G, A);
    G.flags.c1cB = false;
  };
  H['ch1.3b'] = async G => {
    const { A } = await setup(G, 'b');
    G.control(true);
    await partB(G, A);
  };

  // ---- 1.3.in — the cut into the warehouse --------------------------------------------------------------------------------
  CONTENT.scenes['1.3.in'] = {
    title: 'Stock-Take', area: '1C', grade: 'qz_green', start: { cut: true },
    cast: { chase: 'mk_1c_out', wai: 'mk_1c_wai_out' },
    shots: [
      // high in the rafters: the length of the hall, rain through the hole, the office glowing at the far end
      { cam: { type: 'crane', from: [O[0] + 3.5, 7.4, O[2] + 2.5], to: [O[0] + 2.2, 6.2, O[2] + 5.5], look: [O[0] - 6, 3.2, O[2] + 40], lens: 26, dur: 5.5 }, dur: 5.2, focus: null,
        cues: [{ t: 0.3, sfx: 'metal_creak', at: [O[0], 9, O[2] + 20], vol: 0.6 }, { t: 1.8, sfx: 'pigeons', at: [O[0] + 4, 9, O[2] + 12], vol: 0.5 }] },
      // the side door: they come in out of the rain and get down behind the pallets
      { cam: { type: 'static', at: [O[0] - 14.8, 1.4, O[2] + 3.9], look: [O[0] - 12.6, 1.1, O[2] + 0.8], lens: 30, push: 0.03 }, dur: 3.6, focus: 'wai',
        actions: [{ t: 0.1, who: 'wai', do: 'walkTo', at: 'mk_1c_wai', speed: 1.3, yaw: 0.15 }, { t: 0.5, who: 'chase', do: 'walkTo', at: 'mk_1c_start', speed: 1.2, yaw: 0.3 },
          { t: 2.9, who: 'wai', do: 'pose', name: 'crouch' }],
        cues: [{ t: 0.1, sfx: 'creak', at: [O[0] - 13, 1, O[2]], vol: 0.5 }] },
      // over Chase's shoulder into the bay: one of them out there with a pipe, the lantern, the river light
      { cam: { type: 'static', at: [O[0] - 13.0, 1.8, O[2] + 1.3], look: [O[0] - 5.5, 1.1, O[2] + 10.5], lens: 34, push: 0.03 }, dur: 4.4, focus: 'wai',
        actions: [{ t: 0, who: 'wai', do: 'lookAt', at: [O[0] - 6.5, 1.4, O[2] + 9.8] }, { t: 0.3, who: 'chase', do: 'lookAt', at: [O[0] - 6.5, 1.4, O[2] + 9.8] }],
        lines: [{ who: 'wai', text: 'Five of his boys. Stay low, stay behind something.', emote: 'tense', pause: 0.5, to: 'chase' }] },
    ],
    exit: { blend: 'gameplay', dur: 1.2 },
  };

  // ---- 1.4 — The Wholesaler --------------------------------------------------------------------------------------------
  // Blocking (area-local, deck y 3.6): the Wholesaler W against his desk (−8.6, 45.8); Chase C (−7.3, 43.4); Wai (−9.4, 43.1),
  // then (−9.9, 42.5) once the Operator is out; the Operator P (−12.8, 45.3) out of the fire-stairs door (−14, 45.8).
  // The Wholesaler exchange is shot from the east of the C–W line; the Operator exchange from the south of the C–P line.
  const L = (x, y, z) => [O[0] + x, DECK + y, O[2] + z];
  CONTENT.scenes['1.4'] = {
    title: 'The Wholesaler', area: '1C', grade: 'qz_green', start: { cut: true },
    cast: { chase: 'mk_14_chase_in', wai: 'mk_14_wai_in', wholesaler: { at: 'mk_14_whole', yaw: 0 }, operator: 'mk_14_op_hide' },
    shots: [
      // the door bangs open behind him; Chase comes in with the revolver up, Wai behind him with the bat
      { cam: { type: 'static', at: L(-11.7, 1.5, 47.3), look: L(-6.0, 1.15, 42.2), lens: 24, handheld: 0.35 }, dur: 3.4, focus: 'chase',
        actions: [{ t: 0, do: 'call', hook: 'c14.door' }, { t: 0, who: 'chase', do: 'hold', prop: 'revolver', hand: 'r' }, { t: 0.12, who: 'chase', do: 'walkTo', path: [L(-5.6, 0, 42.3), L(-7.3, 0, 43.4)], speed: 1.7, yaw: -0.48 },
          { t: 0.15, who: 'wholesaler', do: 'turnTo', to: 'chase', dur: 0.35 }, { t: 0.2, who: 'wholesaler', do: 'emote', name: 'shocked' }, { t: 0.45, who: 'wholesaler', do: 'pose', name: 'hands_up' },
          { t: 0.9, who: 'wai', do: 'walkTo', path: [L(-5.7, 0, 42.2), L(-9.4, 0, 43.1)], speed: 1.5, yaw: 0.25 }, { t: 1.4, who: 'wholesaler', do: 'emote', name: 'smile' },
          { t: 2.2, who: 'chase', do: 'aim', at: 'wholesaler' }],
        cues: [{ t: 0, sfx: 'door_slam', at: L(-5.5, 1, 41.6), vol: 1 }, { t: 0.05, shake: 0.12, dur: 0.3 }] },
      { cam: { type: 'ots', over: 'chase', on: 'wholesaler', side: 'left', push: 0.05 }, hold: 0.3,
        lines: [{ who: 'wholesaler', text: 'Gentlemen! Valued customers.', emote: 'smile', pause: 0.2, to: 'chase' }] },
      { cam: { type: 'static', at: L(-7.7, 1.62, 45.25), look: L(-9.4, 1.58, 43.1), lens: 50, push: 0.04 }, hold: 0.2, focus: 'wai',
        actions: [{ t: 0, who: 'wai', do: 'lookAt', at: 'wholesaler' }],
        lines: [{ who: 'wai', text: "Where's our stock?", emote: 'angry', pause: 0.3, to: 'wholesaler' }] },
      { cam: { type: 'ots', over: 'chase', on: 'wholesaler', push: 0.04 }, hold: 0.2,
        actions: [{ t: 0.6, who: 'wholesaler', do: 'gesture', name: 'shrug' }],
        lines: [{ who: 'wholesaler', text: 'Moved. Sold. You know how it is — high demand, low supply.', emote: 'smile', pause: 0.2, to: 'wai' }] },
      { cam: { type: 'ots', over: 'wholesaler', on: 'chase', push: 0.07 }, hold: 0.25,
        lines: [{ who: 'chase', text: 'Who?', emote: 'tense', pause: 0.4, to: 'wholesaler' }] },
      { cam: { type: 'close', who: 'wholesaler', push: 0.05 }, hold: 0.1,
        lines: [{ who: 'wholesaler', text: 'The Landlines. I had no choice, they had guns—', emote: 'afraid', pause: 0.15, to: 'chase', dur: 2.6 }] },
      // over the Wholesaler's shoulder: Wai lets the bat drop and takes a pistol out of his vest
      { cam: { type: 'static', at: L(-8.1, 1.7, 46.35), look: L(-9.4, 1.45, 43.1), lens: 40 }, hold: 0.2, focus: 'wai',
        actions: [{ t: 0, who: 'wai', do: 'drop', hand: 'r' }, { t: 0.35, who: 'wai', do: 'hold', prop: 'pistol', hand: 'r' }, { t: 0.45, who: 'wai', do: 'aim', at: 'wholesaler' }],
        lines: [{ who: 'wai', text: 'We have guns.', emote: 'neutral', pause: 0.8, to: 'wholesaler' }] },
      { cam: { type: 'close', who: 'wholesaler', push: 0.08 }, dur: 3.7,
        actions: [{ t: 0.3, who: 'wholesaler', do: 'emote', name: 'smile' }, { t: 1.1, who: 'wholesaler', do: 'gesture', name: 'shrug' }],
        lines: [{ who: 'wholesaler', text: 'They had more guns. Look — I can do you a discount on—', emote: 'smile', pause: 0.1, to: 'chase', dur: 3.6 }] },
      // from behind the two of them: Wai shoots him. Chase looks at Wai. Wai shrugs.
      { cam: { type: 'static', at: L(-8.2, 1.55, 41.9), look: L(-8.6, 1.15, 45.8), lens: 32 }, dur: 4.0, focus: 'wholesaler',
        actions: [{ t: 0, who: 'wai', do: 'fire', at: 'wholesaler', sfx: 'gunshot' }, { t: 0, do: 'call', hook: 'c14.shot' }, { t: 0.06, who: 'wholesaler', do: 'die' },
          { t: 0.1, who: 'chase', do: 'emote', name: 'shocked' }, { t: 0.9, who: 'chase', do: 'pose', name: 'stand' }, { t: 1.1, who: 'chase', do: 'lookAt', at: 'wai' },
          { t: 1.3, who: 'chase', do: 'turnTo', to: 'wai', dur: 0.8 }, { t: 1.6, who: 'chase', do: 'emote', name: 'angry' }, { t: 2.2, who: 'wai', do: 'pose', name: 'stand' },
          { t: 2.4, who: 'wai', do: 'turnTo', to: 'chase', dur: 0.6 }, { t: 2.5, who: 'wai', do: 'lookAt', at: 'chase' }, { t: 3.0, who: 'wai', do: 'gesture', name: 'shrug' }],
        cues: [{ t: 0.02, shake: 0.35, dur: 0.35 }, { t: 0.7, sfx: 'body_fall', at: 'wholesaler', vol: 0.9 }] },
      { cam: { type: 'static', at: L(-8.5, 1.6, 44.2), look: L(-9.4, 1.55, 43.1), lens: 50, push: 0.04 }, hold: 0.8, focus: 'wai',
        lines: [{ who: 'wai', text: 'What? He was pitching.', emote: 'neutral', pause: 0.2, to: 'chase' }] },
      // a woman's voice from the stairwell
      { cam: { type: 'static', at: L(-8.2, 1.68, 44.3), look: L(-7.3, 1.65, 43.4), lens: 55 }, dur: 2.6, focus: 'chase',
        actions: [{ t: 0.5, who: 'chase', do: 'lookAt', at: L(-14, 1.5, 45.8) }, { t: 0.7, who: 'wai', do: 'lookAt', at: L(-14, 1.5, 45.8) }, { t: 0.8, who: 'chase', do: 'emote', name: 'tense' }],
        lines: [{ who: 'operator', text: "Your stock's in a Landlines cache outside the wall. I can have it back to you. Doubled.", emote: 'exhausted', pause: 0.5, off: true, to: 'chase' }] },
      // past the body: the fire-stairs door opens and she steps into the lamplight; Wai moves wide, both guns on her
      { cam: { type: 'static', at: L(-5.2, 1.6, 47.3), look: L(-13.6, 1.1, 45.6), lens: 32, push: 0.05 }, dur: 4.6, focus: 'operator',
        actions: [{ t: 0, do: 'call', hook: 'c14.stairs' }, { t: 0.25, who: 'operator', do: 'walkTo', at: 'mk_14_op', speed: 0.8, yaw: 1.92 },
          { t: 0.3, who: 'chase', do: 'aim', at: 'operator' }, { t: 0.4, who: 'wai', do: 'walkTo', at: L(-9.9, 0, 42.5), speed: 1.2 }, { t: 1.8, who: 'wai', do: 'aim', at: 'operator' },
          { t: 1.2, who: 'operator', do: 'emote', name: 'exhausted' }] },
      { cam: { type: 'static', at: L(-10.9, 1.55, 44.25), look: L(-12.8, 1.32, 45.3), lens: 36, push: 0.05 }, dur: 2.8, focus: 'operator',
        actions: [{ t: 0.2, who: 'operator', do: 'lookAt', at: 'chase' }] },
      { cam: { type: 'static', at: L(-13.85, 1.78, 45.3), look: L(-7.3, 1.62, 43.4), lens: 40, push: 0.04 }, hold: 0.3, focus: 'chase',
        lines: [{ who: 'chase', text: 'And you are?', emote: 'tense', pause: 0.2, to: 'operator' }] },
      { cam: { type: 'static', at: L(-6.6, 1.78, 42.7), look: L(-12.8, 1.6, 45.3), lens: 50, push: 0.05 }, hold: 0.3, focus: 'operator',
        lines: [{ who: 'operator', text: 'Someone who needs a delivery.', emote: 'tense', pause: 0.3, to: 'chase' }] },
      { cam: { type: 'static', at: L(-11.2, 1.62, 43.05), look: L(-9.9, 1.55, 42.5), lens: 50 }, hold: 0.2, focus: 'wai',
        actions: [{ t: 0.1, who: 'wai', do: 'pose', name: 'stand' }],
        lines: [{ who: 'wai', text: "We're not couriers.", emote: 'smirk', pause: 0.2, to: 'operator' }] },
      { cam: { type: 'static', at: L(-11.3, 1.65, 44.45), look: L(-12.8, 1.62, 45.3), lens: 55, push: 0.04 }, hold: 0.3, focus: 'operator',
        lines: [{ who: 'operator', text: "You're smugglers. It's the same job with worse manners.", emote: 'smirk', pause: 0.3, to: 'wai' }] },
      { cam: { type: 'static', at: L(-8.55, 1.72, 43.5), look: L(-7.3, 1.68, 43.4), lens: 55, push: 0.07 }, hold: 0.3, focus: 'chase',
        actions: [{ t: 0.1, who: 'chase', do: 'pose', name: 'stand' }],
        lines: [{ who: 'chase', text: "What's the package?", emote: 'neutral', pause: 0.5, to: 'operator' }] },
      { cam: { type: 'static', at: L(-11.3, 1.65, 44.45), look: L(-12.8, 1.62, 45.3), lens: 55, push: 0.08 }, hold: 0.5, focus: 'operator',
        lines: [{ who: 'operator', text: 'Come and see.', emote: 'neutral', pause: 0.9, to: 'chase' }] },
      // behind Chase's shoulder: she turns back into the dark of the stairwell; Wai looks at him
      { cam: { type: 'static', at: L(-6.6, 1.5, 42.6), look: L(-12.6, 1.2, 45.6), lens: 28 }, dur: 3.6, focus: 'operator',
        actions: [{ t: 0.1, who: 'operator', do: 'walkTo', at: 'mk_14_op_back', speed: 0.85 }, { t: 0.6, who: 'wai', do: 'lookAt', at: 'chase' }, { t: 1.4, who: 'chase', do: 'lookAt', at: 'wai' }] },
    ],
    end: { place: { chase: 'mk_14_chase', wai: 'mk_14_wai2' }, call: { hook: 'c14.end' } },
    exit: { hold: true },
  };
  const area1C = G => G.areaById('1C');
  H['c14.door'] = G => {   // kicked open: the door swings in hard
    const A = area1C(G); if (!A) return;
    const d = A.data.door; let t = 0;
    A.data.tweens.push(dt => { t += dt; d.userData.setOpen(0.95 * U.ease.out(Math.min(1, t / 0.28))); return t > 0.3; });
  };
  H['c14.stairs'] = G => {
    const A = area1C(G); if (!A) return;
    const d = A.data.stairDoor; let t = 0;
    Audio.sfx('creak', { pos: A.w([-14, DECK + 1, 45.8]), vol: 0.7 });
    A.data.tweens.push(dt => { t += dt; d.userData.setOpen(0.85 * U.smooth(Math.min(1, t / 1.4))); return t > 1.4; });
  };
  H['c14.shot'] = G => {   // the flash in the room, the blood on the desk and the floor
    const A = area1C(G); if (!A) return;
    const D = A.data, wai = G.who('wai'), base = D.officeLight.intensity; let t = 0;
    wai.point('hand_r', D.flash.position); A.group.worldToLocal(D.flash.position); D.flash.visible = true;
    for (const b of D.blood) b.visible = true;
    D.tweens.push(dt => { t += dt; D.officeLight.intensity = base * (t < 0.06 ? 4 : 1); if (t > 0.06) D.flash.visible = false; return t > 0.1; });
  };
  H['c14.end'] = G => {   // the end state (also on skip)
    const A = area1C(G); if (!A) return;
    const D = A.data, w = G.who('wholesaler'), op = G.who('operator'), wai = G.who('wai');
    for (const b of D.blood) b.visible = true;
    D.door.userData.setOpen(0.95); D.stairDoor.userData.setOpen(0.85);
    if (w && w.poseName !== 'dead') w.pose('dead', { direct: true, dur: 0.2 });
    if (op) G.place(op, 'mk_14_op_back');
    const ag = comp(wai); if (ag) ag.dismiss();
  };
  H['ch1.4'] = async G => {
    const cont = G.A && G.A.id === '1C' && G.A.data.part;
    if (!cont) G.fade('black', 0);
    const A = await G.area('1C');
    A.data.fresh = false; A.data.whole = null;
    G.control(false); UI.prompt(null); A.data.teach = null; A.data.beats.length = 0;
    const chase = G.actor('chase', 'chase'), wai = G.actor('wai', 'wai'), op = G.actor('operator', 'operator', 'mk_14_op_hide');
    if (!cont) { reset(chase); reset(wai); variant(wai, 'bruised'); kit(); }
    reset(op); variant(op, 'wounded'); op.decal('fever'); op.hold('revolver', 'r'); A.data.opWound = op;
    if (!wai.held('r')) wai.hold('bat', 'r');
    const ag = comp(wai); if (ag) ag.dismiss();            // 1.5 makes him a companion again (AI.companion)
    G.player(chase, { hud: false });                  // Director owns his hands from here (the revolver)
    if (!cont) G.fade('none', 0.8);
    await G.scene('1.4');
  };
})();
