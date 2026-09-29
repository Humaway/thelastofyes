// ============================================================================
// Areas P4 (the burning servo forecourt and the bridge approach) and P5 (the bridge checkpoint), scenes P.6 (the tackle),
// P.6b (walking into the light) and P.7 (the bridge), and the flow beats prologue.P6 / prologue.P7 (spec §8 P.6, P.7).
// Owned by: level agent (bridge).
//
// P4 — origin [1500,0,0]; area-local +Z is north, toward the bridge. The Drive ended in the roundabout crash: Luke's car
//   (navy sedan) against the island at the south end, the truck on its side burning. The road north is choked by a burning
//   pile-up (z 17..45) behind a low planter wall, so Luke leads through the servo forecourt east of it: in at the glowing
//   price sign, north up the west lane, round the burning car at the pumps into the east lane, back west past the shop to
//   the exit gap (z 45..54), then up the causeway (water both sides, streetlights dead) toward the checkpoint's floodlight
//   far ahead. Scrollers sprint out of the smoke at three points; Luke intercepts and clubs them down (scripted, no fail).
//   The third time one gets through: scene P.6. Then the limp up the causeway and scene P.6b (held frame; P.7 cuts from it).
//   Markers: mk_start (dev free-roam) · mk_p6_start / mk_p6_luke (spawn) · mk_p6_tackle (the tackle; its frame anchors
//   P.6's cameras) · mk_p6_end, mk_p6_endc (P.6b)
// P5 — origin [1500,0,1500]; the south end of the long bridge, +Z north over black water. Checkpoint at z 0..10: jersey
//   barriers and a boom gate, barricades ROAD CLOSED — SCREEN CHECK facing the approach, the COMMS van behind the gate with its
//   headlights low across the wet road, a floodlight tower (the key and the area's one shadow caster) aimed south, sandbags,
//   the Soldiers' table, a crate of confiscated phones still lighting up. The bridge lamps recede north into the mist.
//   Area chars: soldier (the one who talks, the scanner, the radio) and soldier_b (rifle up behind the barrier).
//   Markers: mk_start · mk_p7_* (see M5 below)
// Persistent actors: chase (chase_young, the player in P.6), luke (luke_young), bub (bub). No HUD.
// ============================================================================
(() => {
  const PI = Math.PI, V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const M = (n, o) => Tex.mat(n, o), C = (h, o) => Tex.color(h, o);
  const H = CONTENT.hooks;
  const O4 = [1500, 0, 0], O5 = [1500, 0, 1500];
  const w4 = (x, y, z) => [O4[0] + x, y, O4[2] + z], w5 = (x, y, z) => [O5[0] + x, y, O5[2] + z];
  const soft = (() => { let t = null; return () => t || (t = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, '#fff'); r.addColorStop(0.25, 'rgba(255,255,255,0.45)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); const x = new THREE.CanvasTexture(c); x.userData.shared = true; return x; })()); })();
  // distant lights that must read through the fog (bridge lamps to the horizon, far fires): additive points, fog off
  function farLights(A, pts, color, size) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts.flat(), 3));
    const p = new THREE.Points(g, new THREE.PointsMaterial({ map: soft(), color, size, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    p.frustumCulled = false; A.group.add(p); return p;
  }
  // the night sky over the burning suburbs: a gradient dome (fog off) glowing low where the fires are
  function sky(A, horizon, zenith, glow) {
    const g = new THREE.SphereGeometry(900, 24, 12), p = g.attributes.position, col = [], c = new THREE.Color(), h = new THREE.Color(horizon), z = new THREE.Color(zenith), w = new THREE.Color(glow);
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i) / 900, dir = Math.atan2(p.getX(i), p.getZ(i));
      c.copy(h).lerp(z, U.smooth(U.clamp(y * 3.2 + 0.05))).lerp(w, Math.max(0, 1 - Math.abs(y) * 9) * (0.55 + 0.45 * Math.sin(dir * 3 + 1)));
      col.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return Build.mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }), { pos: [0, -40, 200], shadow: false, receive: false });
  }
  // one mesh per material for every static thing Build made (these long strips of props span many of Build's 24 m cells)
  function mergeStatics(A, cell = 400) {
    A.group.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(A.group.matrixWorld).invert(), buckets = new Map(), c = V(), m = new THREE.Matrix4();
    A.group.traverse(o => {
      if (!o.isMesh || !o.userData.batch || o.isInstancedMesh) return;
      o.geometry.computeBoundingBox(); o.geometry.boundingBox.getCenter(c).applyMatrix4(o.matrixWorld).applyMatrix4(inv);
      const k = [o.material.uuid, Math.floor(c.x / cell), Math.floor(c.z / cell), o.castShadow, o.renderOrder, !!o.geometry.index, Object.keys(o.geometry.attributes).sort()].join('|');
      (buckets.get(k) || buckets.set(k, []).get(k)).push(o);
    });
    for (const arr of buckets.values()) {
      if (arr.length < 2) continue;
      const g = mergeGeometries(arr.map(o => o.geometry.clone().applyMatrix4(m.multiplyMatrices(inv, o.matrixWorld))));
      if (!g) continue;
      const me = new THREE.Mesh(g, arr[0].material); me.castShadow = arr[0].castShadow; me.receiveShadow = arr[0].receiveShadow; me.renderOrder = arr[0].renderOrder; A.group.add(me);
      for (const o of arr) { o.parent.remove(o); if (!o.geometry.userData.shared) o.geometry.dispose(); }
    }
  }
  // an actor back to a clean state (a checkpoint can start from anywhere)
  function reset(c) {
    c.stop(); c.detach(); if (c.pairOf) c.pairOf.detach(); c.gesture(null); c.lookAt(null); c.emote('neutral'); c.setVisible(true); c.badge(null);
    for (const h of ['r', 'l']) if (c.held(h)) c.drop(h, { remove: true });
    c.gripRelease = false; c.pose('stand', { direct: true, dur: 0.01 });
  }
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

  // =================================================================================================================
  // P4 — the servo
  // =================================================================================================================
  const LEAD = [[5.5, 8], [8.6, 14], [9.2, 22], [11.5, 26.6], [18.8, 27.2], [20.2, 33], [19.6, 42.5], [13, 46.5], [8, 50.5], [4.2, 57], [2.6, 70], [2.2, 88], [1.8, 106], [1.6, 124], [1.6, 142], [1.6, 160]];
  const RUSH = [   // [trigger box x1,z1,x2,z2 (player), scrollers [x, z, seed]]
    { box: [4, 6, 13, 19], from: [[25.2, 25.5, 3]] },
    { box: [11, 20, 24, 31], from: [[7.8, 37.6, 11], [26, 46, 17]] },
  ];
  const TACKLE_BOX = [5, 43.5, 17, 52], END_Z = 132;
  const CAR = [0xe0dcd4, 0x2a2c2e, 0x6a1f22], PLATE = '630 RDC';

  // shelf faces for the servo shop: rows of snacks, cans and bottles (one canvas, shared)
  let goods = null;
  function goodsTex(bottles) {
    if (goods && goods[+bottles]) return goods[+bottles];
    goods = goods || [];
    const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d'), r = U.rng(bottles ? 5 : 3);
    const pal = bottles ? ['#c8261e', '#1e5aa8', '#f0c020', '#2a8a3a', '#e8e8e0', '#7a1e8a', '#ff7a20'] : ['#d8261e', '#f0b400', '#1e4aa8', '#2a7a3a', '#e8e0d0', '#8a2a8a', '#ff8a20', '#3a3a3a', '#5ac8e8'];
    g.fillStyle = bottles ? '#0c1418' : '#2a2826'; g.fillRect(0, 0, 512, 256);
    for (let row = 0; row < 4; row++) {
      const y0 = row * 64 + 6;
      for (let x = 2; x < 510;) {
        const w = bottles ? 10 + r() * 6 : 14 + r() * 26, h = bottles ? 40 + r() * 12 : 30 + r() * 24;
        g.fillStyle = pal[(r() * pal.length) | 0]; g.fillRect(x, y0 + 54 - h, w - 2, h);
        g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x + 2, y0 + 58 - h, (w - 2) * 0.3, h * 0.5);
        x += w;
      }
      g.fillStyle = bottles ? '#b8c8d0' : '#d8d8d4'; g.fillRect(0, y0 + 54, 512, 4);
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.userData.shared = true;
    return (goods[+bottles] = t);
  }
  function servoShop(A) {
    // convenience store east of the forecourt: open front (west), fluorescent interior spilling onto the concrete
    const wall = M('plaster', { color: 0xe6e4de }), out = M('render', { color: 0xcfc8ba });
    Build.room({ x: 30, z: 33, w: 9, d: 20, h: 3.6, wall, outside: out, floor: M('tiles', { color: 0xd8d6d0 }), ceil: M('plaster', { color: 0xeeeeea }),
      doors: [{ side: 'w', at: -6.5, w: 1.8, h: 2.3 }], windows: [{ side: 'w', at: 0.5, w: 9.5, h: 2.4, sill: 0.35 }], surface: 'tile' });
    Build.box(9.6, 0.9, 20.6, M('metal_painted', { color: 0xc8261e }), { pos: [30, 3.6, 33], solid: false });
    Build.sign({ tex: Tex.text('SERVO · FOOD · OPEN 24/7', { w: 1024, h: 128, color: '#ffffff', weight: 'bold' }), w: 8, h: 0.6, pos: [25.28, 3.72, 33], yaw: -PI / 2, lit: 1.3 });
    // glass: shattered where the Scroller came through
    const glass = C(0x9fb4bc, { rough: 0.05, metal: 0.3, transparent: true, opacity: 0.16 });
    Build.box(0.03, 2.4, 5.2, glass, { pos: [25.5, 0.35, 30.9], solid: false });
    Build.box(0.03, 1.1, 3.2, glass, { pos: [25.5, 0.35, 36.4], solid: false });
    Build.scatter('glass', { box: [23.6, 34.5, 25.4, 38.5], count: 90, seed: 4 });
    // interior: gondolas of snacks (one knocked over, stock across the floor), the drinks fridges glowing along the back wall
    const lam = M('laminate', { color: 0xe4e4e0 }), gt = goodsTex(false);
    for (const [z, fallen] of [[26.5, false], [30.5, false], [34.6, true]]) {
      if (fallen) { Build.box(3.0, 0.9, 1.45, lam, { pos: [30.2, 0, z], rot: [0, 0.2, 0] }); Build.decal(gt, { pos: [30.28, 0.912, z - 0.1], w: 2.8, h: 1.3, floor: true, yaw: 0.2 }); continue; }
      Build.box(3.0, 1.45, 0.9, lam, { pos: [30.2, 0, z] });
      for (const s of [-1, 1]) Build.decal(gt, { pos: [30.2, 0.72, z + s * 0.456], yaw: s > 0 ? 0 : PI, w: 2.9, h: 1.3 });
    }
    Build.scatter('cans', { box: [27.8, 35.6, 33, 38.2], count: 40, seed: 9 });
    Build.box(0.6, 2.1, 12, C(0x0c1418, { rough: 0.2 }), { pos: [34.2, 0, 32.5] });
    Build.decal(goodsTex(true), { pos: [33.88, 1.05, 32.5], yaw: -PI / 2, w: 11.8, h: 2.0, emissive: 0.9 });
    for (let z = 26.6; z <= 38.5; z += 1.18) Build.box(0.05, 2.1, 0.06, C(0x9a9ea2, { rough: 0.4, metal: 0.6 }), { pos: [33.84, 0, z], solid: false });
    Build.box(1.0, 1.0, 3.2, M('laminate', { color: 0xd8d4c8 }), { pos: [27.2, 0, 40.4] });
    for (const x of [27.5, 30.5, 33.2]) for (const z of [26, 31, 36, 40]) Build.box(1.2, 0.02, 0.5, C(0xf4f8ff, { emissive: 0xf4f8ff, emissiveIntensity: x === 30.5 && z === 36 ? 0.1 : 2.2 }), { pos: [x, 3.57, z], solid: false });
    A.data.shopLight = Build.light('point', { pos: [28.5, 3.1, 32], color: 0xdce8ff, intensity: 16, distance: 18, decay: 1.5, flicker: 0.12 });
    Build.pool({ pos: [23.2, 0, 32], r: 5, color: 0xcfe0ff, opacity: 0.18 });
    Build.prop('bin', { kind: 'street', pos: [24.6, 0, 22.4], blob: false });
    Build.prop('crate', { kind: 'milk', pos: [24.8, 0, 43.5], stack: 2, color: 0x2a6ad8, blob: false });
  }

  function forecourt(A, r) {
    const D = A.data;
    Build.floor(7.3, 4, 36, 57, M('concrete', { color: 0x8c8880 }), { surface: 'concrete' });
    for (const [x, z, s] of [[12, 12, 2.2], [17, 31.5, 3], [20.5, 44, 2], [9.5, 44, 2.6], [15.8, 20, 1.8]]) Build.decal('oil', { floor: true, pos: [x, 0.012, z], w: s, h: s * 0.8, spin: x, opacity: 0.8 });
    // the canopy: its west half dark, a few panels still burning on the east side
    Build.prop('servo_canopy', { pos: [15, 0, 33], yaw: PI / 2, w: 16, d: 10, lit: false, worn: 0.2 });
    for (const z of [31, 35, 39]) Build.box(0.5, 0.02, 1.2, C(0xf4f8ff, { emissive: 0xf4f8ff, emissiveIntensity: 2.4 }), { pos: [18.33, 4.772, z], solid: false });
    D.canopyLight = Build.light('point', { pos: [18.4, 4.3, 35], color: 0xe4ecff, intensity: 10, distance: 16, decay: 1.4, flicker: 0.35 });
    Build.pool({ pos: [18.4, 0, 35], r: 5.5, color: 0xdfe8ff, opacity: 0.16 });
    // the price sign still glowing at the entry
    Build.prop('price_sign', { pos: [6.3, 0, 7.2], yaw: 0.25, h: 6, prices: 'UNLEADED 91|189.9\nPREMIUM 98|209.9\nDIESEL|203.9\nE10|185.9' });
    Build.light('point', { pos: [6.3, 3.8, 6.2], color: 0xfff2d0, intensity: 3, distance: 7 });
    // cars: burning at the west pumps (blocks the lane), abandoned at the east pumps, one nosed into the shop front
    Build.car('sedan', { pos: [10.1, 0, 32.6], yaw: 1.42, burnt: true });
    Build.fire({ pos: [10.1, 0.55, 32.6], size: 1.7, light: 3 });
    Build.fire({ pos: [8.7, 0.3, 33.4], size: 0.9, light: false, smoke: false });
    Build.car('hatch', { pos: [21.4, 0, 37.8], yaw: PI + 0.12, wrecked: true, color: CAR[0], plate: PLATE });
    Build.car('ute', { pos: [22.8, 0, 47.5], yaw: -2.2, wrecked: true, color: CAR[1], plate: PLATE });
    Build.prop('barrel', { kind: 'burning', pos: [13.6, 0, 22.6], light: false });
    // spilled fuel burning in a ragged line from the west pumps
    for (const [x, z, k] of [[12.3, 27.6, 0.7], [13.4, 28.3, 0.55], [11.2, 27.1, 0.6], [14.3, 29.4, 0.45]]) Build.fire({ pos: [x, 0.02, z], size: k, light: false, smoke: false });
    Build.decal('scorch', { floor: true, pos: [12.6, 0.012, 28.2], w: 4.5, h: 2.6, spin: 0.3 });
    for (const [x, z, y] of [[14.2, 24.2, 0.3], [16.8, 45.5, 1.4]]) Build.prop('jerry_can', { pos: [x, 0, z], yaw: y });
    Build.prop('cone', { pos: [12, 0, 18.8], n: 1, blob: false });
    Build.prop('tyre', { pos: [15.5, 0, 48.6], stack: 3 });
    Build.scatter('debris', { box: [8, 8, 26, 54], count: 70, seed: 6 });
    Build.scatter('phones', { box: [8.5, 20, 24, 50], count: 9, seed: 12 });
    Build.dust({ box: [-8, 0.3, -20, 30, 9, 60], count: 420, color: 0xff8a3a, size: 0.035, opacity: 0.9 });
    // low brick planter wall between the road and the forecourt (the pile-up is on the other side); exit gap z 45..54
    const brick = M('brick', { color: 0x9a6a52 });
    Build.box(0.45, 0.62, 28, brick, { pos: [7.3, 0, 31] });
    Build.box(0.45, 0.62, 3.4, brick, { pos: [7.3, 0, 55.7] });
    Build.grass({ box: [7.1, 17, 7.5, 45], count: 300, color: 0x3a4a22, height: 0.5, y: 0.62 });
    // the north and east edges: a colorbond fence, the back of the shop, a skip bin
    Build.prop('fence', { kind: 'colorbond', pos: [7.5, 0, 57.4], length: 28.5, h: 1.8 });
    Build.prop('bin', { kind: 'skip', pos: [30, 0, 49], yaw: 0.1 });
    Build.prop('fence', { kind: 'colorbond', pos: [36, 0, 4], yaw: -PI / 2, length: 53.4, h: 1.8 });
    Build.prop('fence', { kind: 'colorbond', pos: [14.4, 0, 4], length: 21.6, h: 1.8 });
    servoShop(A);
  }

  function crashSite(A) {
    const D = A.data;
    // the roundabout, the truck on its side, Luke's car against the island
    Build.floor(-26, -44, 26, 4, M('asphalt', { rough: 0.7 }), { surface: 'concrete' });
    Build.prop('roundabout', { pos: [0, 0, -20], r: 6.5 });
    Build.floor(-70, -25, 70, -15, M('asphalt', { rough: 0.7 }), { y: -0.004 });
    Build.car('truck', { pos: [-7.5, 1.2, -9.5], rot: [0, 1.95, -PI / 2], wrecked: true, color: 0xd8d4c8 });
    Build.fire({ pos: [-4.4, 0.6, -9.2], size: 2.1, light: 3 });
    Build.smoke({ pos: [-4.8, 2.5, -9.4], size: 3.2, rate: 0.05, lit: 0.8 });
    Build.car('sedan', { pos: [4.6, 0, -9.2], yaw: -2.45, wrecked: true, color: 0x1c2636, lights: true, beams: true, plate: '729 LKE' });   // Luke's car
    D.hazard = [Build.glow({ pos: [5.9, 0.85, -7.4], color: 0xff9020, size: 0.7, dynamic: true }), Build.glow({ pos: [3.2, 0.85, -11.3], color: 0xff9020, size: 0.7, dynamic: true })];
    Build.scatter('glass', { box: [-2, -16, 7, -3], count: 160, seed: 2 });
    Build.scatter('debris', { box: [-8, -18, 8, 0], count: 60, seed: 3 });
    Build.decal('skid', { floor: true, pos: [2, 0.012, -2], w: 1.2, h: 9, yaw: 0.35 });
    Build.decal('scorch', { floor: true, pos: [-4.5, 0.012, -9.4], w: 7, h: 6 });
    // the edges of the playable space (the fog and the smoke hide them)
    A.collider([-12.6, 0, -32.4], [-12.2, 3, 4.2]); A.collider([-12.6, 0, -32.4], [14.4, 3, -32]); A.collider([14, 0, -32.4], [14.4, 3, 4]);
    for (const x of [-11, 11]) Build.streetlight({ pos: [x, 0, -2], yaw: x < 0 ? PI / 2 : -PI / 2, on: false, blob: false });
  }

  function pileUp(A) {
    // the road north is choked: burning cars across both lanes and the footpaths, behind the planter wall
    Build.road({ from: [0, 4], to: [0, 230], width: 9, path: 2.4 });
    Build.car('sedan', { pos: [-0.8, 0, 20.5], yaw: 1.28, burnt: true, plate: PLATE });
    Build.fire({ pos: [-0.8, 0.5, 20.5], size: 1.8, light: 3 });
    Build.car('ute', { pos: [3.1, 0, 24.8], yaw: -2.75, wrecked: true, color: CAR[2], plate: PLATE });
    Build.car('van', { pos: [-3.8, 0, 27.5], yaw: 0.35, wrecked: true, color: CAR[0], plate: PLATE });
    Build.car('hatch', { pos: [1.4, 0, 33], yaw: 0.15, burnt: true, plate: PLATE });
    Build.fire({ pos: [1.4, 0.4, 33], size: 1.3, light: false });
    Build.car('sedan', { pos: [5.6, 0, 18.2], yaw: 0.35, wrecked: true, color: CAR[1], plate: PLATE });
    Build.car('sedan', { pos: [2.2, 0, 41.2], yaw: 2.6, wrecked: true, color: CAR[2], plate: PLATE });
    Build.fire({ pos: [-2.2, 0.1, 43.5], size: 1.0, light: 2 });   // lights the exit gap
    Build.prop('jersey_barrier', { pos: [-6.6, 0, 22], yaw: -PI / 2, length: 16, kind: 'water' });
    A.collider([-7.4, 0, 14], [7.1, 2, 45.2], { sight: false, cam: false });   // the choked road: no way through
    for (const [x, z] of [[-0.8, 21], [1.4, 33], [-3, 43]]) Build.smoke({ pos: [x, 1.5, z], size: 3.4, rate: 0.045, lit: 1, color: 0x2a211c });
    // the west side: a paling fence and dark shops beyond the verge
    Build.prop('fence', { kind: 'paling', pos: [-9.6, 0, 4], yaw: -PI / 2, length: 70, broken: true });
    Build.floor(-40, -2, -7.2, 76, M('grass', { color: 0x3a4028 }), { y: -0.02, surface: 'grass' });
    // a dark row of shops across the verge, one window still lit
    for (const [z, d, h] of [[14, 12, 3.6], [32, 16, 4.2], [54, 12, 3.4]]) Build.box(9, h, d, M('brick', { color: 0x8a5a44 }), { pos: [-16, 0, z] });
    Build.box(0.04, 1.2, 2.4, C(0x201810, { emissive: 0xffc070, emissiveIntensity: 0.9 }), { pos: [-11.48, 1.2, 31], solid: false });
  }

  function causeway(A) {
    // north of the servo the road runs out onto the causeway: rock walls, dead streetlights, black water both sides
    Build.water({ x1: -500, z1: 62, x2: 500, z2: 900, y: -1.6, dark: true });
    const rock = M('concrete', { color: 0x4a4640, rough: 1.2 });
    for (const s of [-1, 1]) {
      Build.box(6, 1.8, 170, rock, { pos: [s * 10.2, -1.8, 146], rot: [0, 0, s * 0.42], solid: false });
      Build.prop('crash_barrier', { pos: [s * 7.3, 0, 56], yaw: -PI / 2, length: 174 });
    }
    Build.floor(-40, 56, -7.2, 66, M('grass', { color: 0x3a4028 }), { y: -0.02 });
    for (const z of [72, 106, 140]) Build.streetlight({ pos: [7.8, 0, z], yaw: -PI / 2, on: false, blob: false });
    // abandoned on the causeway: a hatch with its doors open, a ute with the hazards going, a suitcase, a phone still lit
    Build.car('hatch', { pos: [2.6, 0, 84], yaw: 0.25, color: CAR[0], wrecked: true, plate: PLATE });
    Build.car('ute', { pos: [-2.4, 0, 111], yaw: -0.2, color: CAR[1], plate: PLATE });
    A.data.hazard.push(Build.glow({ pos: [-3.1, 0.85, 113.6], color: 0xff9020, size: 0.6, dynamic: true }), Build.glow({ pos: [-1.2, 0.85, 113.5], color: 0xff9020, size: 0.6, dynamic: true }));
    Build.prop('cardboard_box', { pos: [0.4, 0, 96], w: 0.6, h: 0.45, d: 0.35, open: true });
    Build.prop('phone', { pos: [-0.8, 0.01, 103], yaw: 0.6, screen: 'feed', k: 1.6 });
    Build.glow({ pos: [-0.8, 0.12, 103], color: 0x4a7cff, size: 0.5, opacity: 0.8 });
    // far ahead: the checkpoint's floodlight in the mist and the bridge lamps running out over the water into black
    farLights(A, [[0.5, 7.2, 262]], 0x8090b0, 60);
    farLights(A, [[0.5, 7.2, 262], [-0.3, 7.4, 262.4], [1.3, 7.3, 262.2]], 0xf4f6ff, 6);
    const lamps = []; for (let z = 290; z < 2400; z += 36) lamps.push([z % 72 ? 6 : -6, 8, z]);
    farLights(A, lamps, 0xffa640, 2.2);
  }

  CONTENT.levels.P4 = {
    name: 'Servo forecourt', origin: O4, grade: 'launch_fire',
    fog: { color: 0x1f130e, density: 0.022 },
    env: { top: 0x1a0c08, horizon: 0x5a2a10, bottom: 0x080504, intensity: 0.8, spots: [{ dir: [0.1, 0.25, -1], color: 0xff7a30, power: 3 }, { dir: [0.6, 0.3, 0.4], color: 0xff6020, power: 1.5 }] },
    background: 0x1c0d07, amb: 'fire_street', surface: 'concrete',
    build(A) {
      const D = A.data, r = U.rng(44);
      D.hazard = [];
      Build.hemi({ sky: 0x2e3c60, ground: 0x1a0c06, intensity: 1.0 });   // cool night fill under the firelight
      sky(A, 0x24120a, 0x050303, 0x52240e);
      crashSite(A); pileUp(A); forecourt(A, r); causeway(A);
      // the one shadow caster: the pile-up fire throwing everyone's shadow across the forecourt
      D.key = Build.light('spot', { pos: [-1.5, 6.5, 22], target: [14, 0, 36], color: 0xff8a3a, intensity: 140, distance: 34, angle: 0.62, penumbra: 0.7, decay: 1.4, shadow: true, flicker: 0.35 });
      D.key.shadow.camera.far = 34;
      // the Scrollers: waiting in the smoke (hidden until they run)
      D.rush = RUSH.map((R, i) => Object.assign({}, R, { list: R.from.map(([x, z, seed], k) => { const c = A.char('scroller', { name: `p6_s${i}${k}`, at: [x, 0, z], yaw: 0, seed }); c.setVisible(false); return { c, state: 'wait' }; }) }));
      D.decoy = { c: A.char('scroller', { name: 'p6_decoy', at: [0.8, 0, 63], yaw: PI, seed: 29 }), state: 'wait' }; D.decoy.c.setVisible(false);
      D.tackler = A.char('scroller', { name: 'tackler', at: [2.4, 0, 44.6], yaw: 1, seed: 23 }); D.tackler.setVisible(false);
      // two of the launch-night crowd frozen on the rocks at the water's edge, phones up (they never look round)
      for (const [x, z, y, s] of [[-8.6, 99, -1.7, 61], [-9.4, 101.5, -1.2, 64]]) { const c = A.char('crowd', { name: 'p6_frozen' + s, at: [x, -0.55, z], yaw: y, seed: s }); c.hold('phone', 'r'); c.pose('phone', { direct: true, dur: 0.01 }); c.phoneGlow(true); c.decal('feed_eyes'); }
      A.marker('mk_start', [2.4, 0, -1], 0.1);
      A.marker('mk_p6_start', [2.2, 0, -1.4], 0.25);
      A.marker('mk_p6_luke', [4.4, 0, 2.6], 0.4);
      A.marker('mk_p6_tackle', [9.4, 0, 48.6], -0.75);
      A.marker('mk_p6_end', [1.6, 0, END_Z + 2], 0); A.marker('mk_p6_endc', [1.6, 0, END_Z + 2], 0);
      D.loops = [Audio.loop('fire', { pos: A.w([-4.4, 1, -12.4]), vol: 1 }), Audio.loop('fire', { pos: A.w([-0.8, 1, 20.5]), vol: 0.9 }), Audio.loop('fire', { pos: A.w([10.1, 1, 32.6]), vol: 0.8 }), Audio.loop('siren_far', { pos: A.w([60, 10, 300]), vol: 0.6 })];
      mergeStatics(A);
      D.alarmT = 0;
      D.boomT = 14;
      A.update((dt, t) => {
        for (const g of D.hazard) g.visible = t % 1.1 < 0.55;
        if ((D.alarmT -= dt) <= 0) { D.alarmT = 6 + r() * 3; Audio.sfx('car_alarm', { pos: A.w([3.1, 1, 24.8]), vol: 0.5 }); }
        // somewhere across the suburb a car goes up: the ground shakes a little
        if (D.run && D.run.on && (D.boomT -= dt) <= 0) { D.boomT = 13 + r() * 9; Audio.sfx('explosion', { pos: A.w([-120 + r() * 240, 5, 60 + r() * 120]), vol: 0.8 }); Play.shake(0.1, 0.6); }
      });
    },
    unload(A) { for (const l of A.data.loops) l.stop(0.3); },
  };

  // ---- the run: Luke leads, intercepts, clubs them down --------------------------------------------------------------
  function runner(A, chase, luke) {
    const D = A.data, lead = LEAD.map(([x, z]) => V(...w4(x, 0, z)));
    const st = D.run = { i: 0, fight: null, re: 0, on: true };
    const pp = () => chase.root.position;
    const strike = s => {
      st.fight = { s, t: 0 };
      luke.stop(); luke.turnTo(s.c, 0.12); luke.gesture('swing'); luke.emote('angry');
    };
    A.update(dt => {
      if (!st.on) return;
      const p = pp();
      // Scrollers: sprint at Chase, hover in his face (swiping, whispering) until Luke gets there
      const live = [];
      for (const R of D.rush) for (const s of R.list) if (s.state === 'run' || s.state === 'hover') live.push(s);
      if (D.decoy.state === 'run' || D.decoy.state === 'hover') live.push(D.decoy);
      for (const s of live) {
        const d = dist(s.c.root.position, p);
        if ((s.sw = (s.sw ?? Math.random()) - dt) <= 0) { s.sw = 0.8 + Math.random() * 0.9; Audio.sfx(Math.random() < 0.6 ? 'swipe' : 'click', { pos: s.c.point('hand_r'), vol: 0.7 }); }
        if (s.state === 'run') {
          if ((s.re -= dt) <= 0) { s.re = 0.3; s.c.walkTo(p.clone(), { speed: s.speed || 4.4, stopDist: 1.9 }); }
          if (d < 2.1) { s.state = 'hover'; s.c.stop(); s.c.turnTo(chase, 0.2); s.c.lookAt(chase); s.c.gesture('swipe', { dur: 9 }); Audio.sfx('whisper', { pos: s.c.point('head') }); }
        } else if (d > 3.2) s.state = 'run';
      }
      // Luke: fight the nearest, else lead the way (waiting for Chase, torch back on him)
      const F = st.fight;
      if (F) {
        F.t += dt;
        if (F.t > 0.34 && !F.hit) {
          F.hit = true;
          const s = F.s; s.state = 'down'; s.c.stop(); s.c.gesture(null); s.c.lookAt(null);
          Audio.sfx('metal_hit', { pos: s.c.point('head'), vol: 0.9 }); Audio.sfx('punch', { pos: s.c.point('head') });
          s.c.turnTo(luke.yaw, 0.1); s.c.pose('dead', { dur: 0.45, direct: true });
          const ph = s.c.drop('r'); if (ph) s.c.phoneGlow(false);
          Game.G.wait(0.5).then(() => Audio.sfx('body_fall', { pos: s.c.root.position }));
          Play.shake(0.14, 0.35);
        }
        if (F.t > 0.9) { st.fight = null; luke.emote('tense'); }
        return;
      }
      let tgt = null, td = 1e9;
      for (const s of live) { const d = dist(s.c.root.position, p); if (d < td) { td = d; tgt = s; } }
      if (tgt) {
        const sp = tgt.c.root.position;
        if (dist(luke.root.position, sp) < 1.6) return strike(tgt);
        if ((st.re -= dt) <= 0) { st.re = 0.2; const m = p.clone().sub(sp).setY(0); const k = Math.min(1.2, m.length()); m.normalize().multiplyScalar(k).add(sp); luke.walkTo(m, { speed: 5.6, stopDist: 0.3 }); }
        return;
      }
      const wp = lead[st.i], ld = dist(luke.root.position, wp), gap = dist(luke.root.position, p);
      if (ld < 0.6 && st.i < lead.length - 1 && gap < 6.5) st.i++;
      if ((st.re -= dt) <= 0) {
        st.re = 0.4;
        if (gap > 9 && ld < 0.6) { luke.stop(); luke.turnTo(chase, 0.4); luke.lookAt(chase); }
        else if (ld > 0.3) { luke.lookAt(null); luke.walkTo(lead[st.i], { speed: gap < 4 ? 3 : 2.2 }); }
      }
    });
  }
  function rush(A, R) {
    for (const s of R.list) {
      s.state = 'run'; s.re = 0; s.c.setVisible(true); s.c.pose('stand', { dur: 0.2 }); s.c.phoneGlow(true); s.c.emote('shocked');
      Audio.sfx('scroller_scream', { pos: s.c.point('head'), vol: 1 });
    }
    Play.shake(0.08, 0.4);
  }

  // ---- P.6 — the tackle -------------------------------------------------------------------------------------------
  // Every camera hangs off mk_p6_tackle's frame: +z forward (north-west, to the exit gap), +x Chase's right (the road and the
  // burning pile-up, so the fire is always behind the Scroller), -x his left (the forecourt, the shop's cold light).
  const T6 = (x, y, z) => ({ of: 'mk_p6_tackle', off: [x, y, z] });
  const at6 = (G, x, z) => { const f = G.marker('mk_p6_tackle'), s = Math.sin(f.yaw), c = Math.cos(f.yaw); return V(f.pos.x - c * x + s * z, f.pos.y, f.pos.z + s * x + c * z); };
  CONTENT.scenes['P.6'] = {
    title: 'On Foot', area: 'P4', grade: 'launch_fire',
    cast: { chase: 'mk_p6_tackle', tackler: { at: T6(3.4, 0, 1.3), yaw: -0.75 - PI / 2 - 0.3 } },
    start: { cut: true },
    shots: [
      // out of the smoke and into them from the side
      { cam: { type: 'static', at: T6(-2.7, 1.3, 2.7), look: T6(1.3, 1.0, 0.5), lens: 28, handheld: 1 }, dur: 1.9, focus: 'chase',
        actions: [{ t: 0, who: 'tackler', do: 'show' }, { t: 0, who: 'tackler', do: 'pose', name: 'stand', dur: 0.1 }, { t: 0, who: 'tackler', do: 'runTo', at: T6(0.45, 0, 0.3) },
          { t: 0.05, who: 'chase', do: 'turnTo', to: 'tackler', dur: 0.35 }, { t: 0.1, who: 'bub', do: 'emote', name: 'afraid' }, { t: 0.1, who: 'chase', do: 'emote', name: 'shocked' },
          { t: 0.42, who: 'tackler', do: 'gesture', name: 'tackle' }, { t: 0.62, do: 'call', hook: 'p6.hit' }],
        cues: [{ t: 0, sfx: 'scroller_scream', at: 'tackler', vol: 1.2 }, { t: 0.62, sfx: 'tackle', at: 'chase' }, { t: 0.66, shake: 0.9, dur: 0.6 }, { t: 1.05, sfx: 'body_fall', at: 'chase' }] },
      // it pins her and forces its screen over her eyes: two seconds of blue on her face
      { cam: { type: 'static', at: T6(-1.55, 0.42, 2.0), look: T6(-1.4, 0.24, 1.35), lens: 40, handheld: 0.7 }, dur: 2.5, focus: 'bub',
        actions: [{ t: 0, do: 'call', hook: 'p6.pin' }, { t: 0.1, who: 'bub', do: 'gesture', name: 'struggle', dur: 2.4 }],
        cues: [{ t: 0.1, sfx: 'swipe', at: 'bub' }, { t: 0.45, sfx: 'whisper', at: 'bub', vol: 1 }, { t: 1.1, sfx: 'swipe', at: 'bub' }, { t: 1.6, sfx: 'click', at: 'bub', vol: 0.6 }] },
      // Chase tears it off her and beats it: low past its head, up into his face, the canopy's light behind him, until Luke hauls him away
      { cam: { type: 'static', at: T6(3.1, 0.45, 1.7), look: T6(1.5, 0.8, 1.05), lens: 40, handheld: 1 }, dur: 5.0, focus: 'chase',
        actions: [{ t: 0, do: 'call', hook: 'p6.rip' }, { t: 0.45, who: 'chase', do: 'gesture', name: 'punch' }, { t: 1.1, who: 'chase', do: 'gesture', name: 'punch' },
          { t: 1.75, who: 'chase', do: 'gesture', name: 'punch' }, { t: 2.4, who: 'chase', do: 'gesture', name: 'punch' }, { t: 3.0, who: 'chase', do: 'gesture', name: 'punch' },
          { t: 1.6, who: 'luke', do: 'runTo', at: T6(0.7, 0, 1.9) }, { t: 3.35, who: 'luke', do: 'gesture', name: 'grab' }, { t: 3.6, do: 'call', hook: 'p6.pull' }],
        cues: [{ t: 0.05, sfx: 'tackle', at: 'chase', vol: 0.8 }, { t: 0.67, sfx: 'punch', at: 'tackler' }, { t: 1.32, sfx: 'punch', at: 'tackler' }, { t: 1.97, sfx: 'punch', at: 'tackler' },
          { t: 2.62, sfx: 'punch', at: 'tackler' }, { t: 3.22, sfx: 'punch', at: 'tackler', vol: 0.8 }, { t: 3.7, shake: 0.4, dur: 0.4 }] },
      // silhouettes against the fire: Luke holding him back; Chase sees her
      { cam: { type: 'static', at: T6(-3.4, 1.15, -0.8), look: T6(0.6, 1.0, 1.4), lens: 32 }, dur: 3.6, focus: 'chase',
        actions: [{ t: 0.1, who: 'chase', do: 'lookAt', at: 'bub' }, { t: 0.1, who: 'luke', do: 'lookAt', at: 'tackler' }, { t: 1.2, who: 'chase', do: 'walkTo', at: T6(-0.35, 0, 1.55), speed: 1.4 },
          { t: 2.6, who: 'chase', do: 'pose', name: 'kneel_one' }],
        cues: [{ t: 0.3, sfx: 'breath_in', at: 'chase', vol: 0.8 }] },
      // he lifts her up; on her wrist a red dot rises through the skin like a notification: 1, then 4
      { cam: { type: 'static', at: T6(-0.55, 1.0, 3.9), look: T6(-0.62, 0.8, 1.4), lens: 35 }, dur: 3.0, focus: 'bub',
        actions: [{ t: 0.1, do: 'call', hook: 'p6.lift' }, { t: 1.2, who: 'bub', do: 'lookAt', at: 'bub.hand_r' }, { t: 1.4, who: 'chase', do: 'lookAt', at: 'bub.hand_r' }],
        cues: [{ t: 0.4, sfx: 'gasp', at: 'bub', vol: 0.7 }] },
      { cam: { type: 'extreme_close', who: 'bub', part: 'badge', lens: 85 }, dur: 3.4, focus: 'bub.hand_r',
        actions: [{ t: 0.5, who: 'bub', do: 'badge', value: 1, where: 'wrist_r' }, { t: 0.55, do: 'call', hook: 'p6.badge' }, { t: 2.1, who: 'bub', do: 'badge', value: 4, where: 'wrist_r' }],
        cues: [{ t: 0.5, sfx: 'notif_chime', at: 'bub', vol: 0.3 }, { t: 2.1, sfx: 'notif_chime', at: 'bub', vol: 0.4 }] },
      { cam: { type: 'static', at: T6(-0.15, 0.72, 2.6), look: 'bub.eyes', lens: 50, push: 0.06 }, hold: 0.3, focus: 'bub',
        actions: [{ t: 0.15, who: 'chase', do: 'gesture', name: 'hold_hands', to: 'bub', hold: true }, { t: 0.6, who: 'bub', do: 'lookAt', at: 'chase' }],
        lines: [{ who: 'bub', text: 'What is that? Dad, what is that?', emote: 'afraid', pause: 0.9, to: 'chase' }] },
      { cam: { type: 'close', who: 'chase', push: 0.05 }, hold: 0.4,
        lines: [{ who: 'chase', text: "It's nothing. Bridge. Come on.", emote: 'lying', pause: 0.4, to: 'bub' }] },
      // up, and on: Luke already moving with the torch
      { cam: { type: 'static', at: T6(-2.6, 1.45, 0.4), look: T6(0.3, 1.1, 3.6), lens: 30 }, dur: 2.8, focus: 'chase',
        actions: [{ t: 0, who: 'chase', do: 'gesture', name: null }, { t: 0.2, do: 'call', hook: 'p6.carry' }, { t: 0.8, who: 'luke', do: 'walkTo', at: T6(0.4, 0, 6.5), speed: 1.8 }] },
    ],
    end: { call: { hook: 'p6.after' } },
    exit: { blend: 'gameplay', dur: 1.2 },
  };
  // P.6b — the causeway: the two of them walking into the white of the floodlight far ahead. Held; P.7 cuts from it.
  // mk_p6_end is set where Chase stands when it starts; mk_p6_endc (the frame the camera and the walks hang off) is the same
  // point pulled toward the middle of the causeway, so the camera never ends up over the rocks.
  const E6 = (x, y, z) => ({ of: 'mk_p6_endc', off: [x, y, z] });
  CONTENT.scenes['P.6b'] = {
    title: 'The Causeway', area: 'P4', grade: 'launch_fire',
    cast: { chase: 'mk_p6_end' },
    start: { blend: 1.4 },
    shots: [{ cam: { type: 'dolly', from: E6(-1.1, 0.55, -3.6), to: E6(-0.9, 0.6, -2.8), look: E6(0.4, 2.2, 60), lens: 32, dur: 7 }, dur: 6, focus: null,
      actions: [{ t: 0.2, who: 'chase', do: 'walkTo', at: E6(0.2, 0, 9), speed: 0.9 }, { t: 0, who: 'luke', do: 'walkTo', at: E6(1.4, 0, 11), speed: 1.0 }] }],
    exit: { hold: true },
  };

  H['p6.hit'] = G => {   // the Scroller hits them: Bub torn out of his arms, all three down
    const chase = G.who('chase'), bub = G.who('bub'), t = G.who('tackler'), f = G.marker('mk_p6_tackle');
    chase.detach(); t.stop();
    G.place(bub, at6(G, -0.9, 1.25), f.yaw - PI / 2); bub.pose('lie', { dur: 0.35, direct: true });
    chase.pose('sit_ground', { dur: 0.4, direct: true });
    t.pose('crouch', { dur: 0.3 });
    Play.shake(0.3, 0.5);
  };
  H['p6.pin'] = G => {
    const bub = G.who('bub'), t = G.who('tackler');
    t.attach(bub, 'pin'); t.phoneGlow(true, { light: true }); t.lookAt(bub); bub.emote('afraid');
    bub.lookAt(() => t.held('r') ? t.held('r').getWorldPosition(V()) : t.point('head'));
  };
  H['p6.rip'] = G => {   // Chase tears it off her; it goes down on its back, and he is on it
    const chase = G.who('chase'), bub = G.who('bub'), t = G.who('tackler'), f = G.marker('mk_p6_tackle');
    t.detach(); t.phoneGlow(false); t.drop('r');
    G.place(t, at6(G, 1.3, 1.1), f.yaw + PI / 2); t.pose('struggle_down', { direct: true, dur: 0.2 }); t.emote('shocked');
    G.place(chase, at6(G, 0.95, 1.1), f.yaw - PI / 2); chase.pose('pin', { direct: true, dur: 0.25 }); chase.emote('angry'); chase.lookAt(t);
    bub.lookAt(chase); bub.pose('sit_ground', { dur: 0.6 }); bub.emote('crying');
  };
  H['p6.pull'] = G => {
    const chase = G.who('chase'), luke = G.who('luke'), t = G.who('tackler');
    chase.pose('stand', { dur: 0.5 }); chase.emote('exhausted'); luke.lookAt(chase);
    t.pose('dead', { dur: 0.6 }); t.lookAt(null);
  };
  H['p6.badge'] = G => {   // turn the new Badge in its skin so its number stands upright for the insert (square-on, level camera)
    const m = G.who('bub').badgeObj?.mesh; if (!m) return;
    const q = m.getWorldQuaternion(new THREE.Quaternion()), n = V(0, 0, 1).applyQuaternion(q), y = V(0, 1, 0).applyQuaternion(q);
    if (Math.abs(n.y) > 0.95) return;
    const up = V(0, 1, 0).addScaledVector(n, -n.y).normalize();
    m.rotateZ(Math.atan2(y.clone().cross(up).dot(n), y.dot(up)));
  };
  H['p6.lift'] = G => { const bub = G.who('bub'); bub.emote('afraid'); bub.gesture('hand_over', { to: G.who('chase').point('chest'), hold: true }); };
  H['p6.carry'] = G => {
    const chase = G.who('chase'), bub = G.who('bub');
    bub.gesture(null); chase.pose('stand', { dur: 0.4 }); chase.attach(bub, 'carry'); chase.lookAt(null); chase.emote('tense');
  };
  H['p6.after'] = G => {   // the end state (also on skip)
    const chase = G.who('chase'), bub = G.who('bub'), t = G.who('tackler');
    if (chase.pair?.other !== bub) { chase.gesture(null); bub.gesture(null); chase.pose('stand', { direct: true, dur: 0.2 }); chase.attach(bub, 'carry'); }
    bub.badge(4, 'wrist_r'); bub.emote('afraid');
    if (t) { t.detach(); t.phoneGlow(false); t.setVisible(true); if (t.poseName !== 'dead') t.pose('dead', { direct: true, dur: 0.2 }); }
  };

  // ---- the beat -----------------------------------------------------------------------------------------------------
  H['prologue.P6'] = async G => {
    G.fade('black', 0); Director.stop(); UI.hud({ show: false }); UI.letterbox(false, 0); UI.phone(null);
    if (G.areaById('P4')) G.unload('P4');   // a retry starts from a fresh forecourt
    const A = await G.area('P4'), D = A.data;
    const chase = G.actor('chase', 'chase_young'), luke = G.actor('luke', 'luke_young'), bub = G.actor('bub', 'bub');
    for (const c of [chase, luke, bub]) reset(c);
    G.place(chase, 'mk_p6_start'); G.place(luke, 'mk_p6_luke'); G.place(bub, 'mk_p6_start');
    chase.decal('blood_knuckles'); chase.decal('grime'); luke.decal('grime'); bub.decal('tears'); bub.decal('grime');
    luke.hold('torch', 'l', { light: true }); luke.hold('tyre_iron', 'r');
    chase.attach(bub, 'carry'); chase.emote('tense'); luke.emote('tense'); bub.emote('crying');
    for (let i = 0; i < 20; i++) Chars.update(1 / 30);
    G.player(chase, { carry: bub, run: 0 }); Play.snapCamera();
    G.control(true);
    runner(A, chase, luke);
    G.fade('none', 1.6);
    G.say('bub', 'Dad, my leg—', { emote: 'crying', pause: 1.2, to: 'chase' })
      .then(() => G.say('chase', "I've got you. I've got you. Keep your eyes on me.", { emote: 'tender', pause: 0.4, to: 'bub' }));
    Play.nudge(A.w([8, 2, 16]), 2.5);
    // the forecourt: two rushes, Luke meets both
    for (const R of D.rush) { await G.zone({ box: [O4[0] + R.box[0], O4[2] + R.box[1], O4[0] + R.box[2], O4[2] + R.box[3]] }); rush(A, R); }
    // the exit: one on the road ahead for Luke, and while he is on it, one out of the smoke at them
    await G.zone({ box: [O4[0] + TACKLE_BOX[0], O4[2] + TACKLE_BOX[1], O4[0] + TACKLE_BOX[2], O4[2] + TACKLE_BOX[3]] });
    const dc = D.decoy; dc.state = 'run'; dc.speed = 3.6; dc.c.setVisible(true); dc.c.pose('stand', { dur: 0.2 }); dc.c.phoneGlow(true); dc.c.emote('shocked');
    Audio.sfx('scroller_scream', { pos: dc.c.point('head') });
    const t0 = G.t; await G.until(() => dc.state === 'down' || G.t - t0 > 4.5);
    await G.wait(0.5);
    Audio.sfx('scroller_scream', { pos: A.w([4.5, 1.5, 46]), vol: 1.2 });
    await G.wait(0.3);
    D.run.on = false; G.control(false); luke.stop();
    if (dc.state !== 'down') { dc.c.setVisible(false); dc.state = 'down'; }
    await G.scene('P.6');
    G.player(chase, { carry: bub, run: 0, limp: true, speedMul: 0.55 });
    G.control(true);
    D.run.on = true; D.run.i = Math.max(D.run.i, 9);
    await G.zone({ box: [O4[0] - 20, O4[2] + END_Z, O4[0] + 20, O4[2] + 400] });
    D.run.on = false; G.control(false);
    const p = chase.root.position; A.marker('mk_p6_end', [p.x - O4[0], p.y, p.z - O4[2]], 0); A.marker('mk_p6_endc', [U.clamp(p.x - O4[0], -2.5, 3), p.y, p.z - O4[2]], 0);
    await G.scene('P.6b');
  };

  // =================================================================================================================
  // P5 — the bridge checkpoint
  // =================================================================================================================
  // Marks (area-local). Chase walks in from the south and stops short of the soldier; he runs for the east (+x) railing,
  // goes down at FALL; Bub lands at BUB, in the van's headlights. The long take: the camera starts low on the road north of
  // her (CAM0); he crawls to her and sits back on his heels (CRADLE, facing the van, lit by its lights) with her across his
  // lap, her head in the crook of his left arm; the camera pushes in to CAM1, a low two-shot of his face above hers. Its aim
  // (mk_p7_look, moved every frame by the P5 updater) drifts from her, to their two faces, and once she is gone onto his.
  // Luke comes up behind Chase, soft in the dark behind him, and his hand comes down into the frame onto Chase's shoulder.
  const CY = -0.4, F = [Math.sin(CY), Math.cos(CY)], R = [-Math.cos(CY), Math.sin(CY)];
  const at5 = (o, f, r) => [o[0] + F[0] * f + R[0] * r, o[1] + F[1] * f + R[1] * r];
  const BUB = [2.6, -15.2], CRADLE = at5(BUB, -0.3, -0.08), FALL = at5(CRADLE, -1.6, -0.2);
  const CAM0 = at5(BUB, 3.3, -0.55), CAM1 = at5(CRADLE, 1.2, -0.62), STARE = at5(CAM1, 0.2, 0.42);
  const SHOULDER = at5(CRADLE, -0.15, 0.23), LUKE_END = at5(SHOULDER, -0.34, 0.14), LUKE_YAW = Math.atan2(SHOULDER[0] - LUKE_END[0], SHOULDER[1] - LUKE_END[1]);
  const LUKE_PATH = [[-0.5, -15.0], [1.4, -16.7]].map(([x, z]) => w5(x, 0, z));   // wide of the frame, then in behind Chase
  const M5 = {
    mk_start: [[1, 0, -40], 0],
    mk_p7_chase0: [[0.9, 0, -23.5], 0], mk_p7_luke0: [[2.3, 0, -24.1], 0],
    mk_p7_chase: [[0.9, 0, -16.2], 0], mk_p7_luke: [[2.35, 0, -16.6], -0.1],
    mk_p7_soldier: [[0.35, 0, -7.2], PI], mk_p7_scan: [[0.8, 0, -14.35], PI], mk_p7_back: [[-1.1, 0, -12.9], 2.6],
    mk_p7_scr: [[0.8, 1.3, -14.9], 0], mk_p7_scrcam: [[0.82, 1.42, -14.8], 0],   // the scanner's screen and the insert's camera (p7.scan sets them)
    mk_p7_soldier_b: [[-3.2, 0, 1.9], PI + 0.12],
    mk_p7_rail: [[6.2, 0, -18.4], 1.9], mk_p7_fall: [[FALL[0], 0, FALL[1]], CY], mk_p7_bub: [[BUB[0], 0, BUB[1]], CY - PI / 2],
    mk_p7_cradle: [[CRADLE[0], 0, CRADLE[1]], CY], mk_p7_luke_end: [[LUKE_END[0], 0, LUKE_END[1]], LUKE_YAW],
    mk_p7_look: [[BUB[0], 0.3, BUB[1]], 0],   // the long take's aim (see above)
  };

  function checkpoint(A) {
    const D = A.data;
    // the barrier line: jersey barriers, a boom gate in the gap, the stencilled barricades facing the approach
    Build.prop('jersey_barrier', { pos: [1.9, 0, 0.8], length: 4, blob: false });
    Build.prop('jersey_barrier', { pos: [-5.9, 0, 0.8], length: 4, blob: false });
    Build.prop('boom_gate', { pos: [1.75, 0, 1.45], yaw: PI, w: 3.3 });
    for (const x of [-3.9, 3.9]) Build.prop('barricade', { pos: [x, 0, -0.55], yaw: PI });
    Build.prop('cone', { pos: [-1.3, 0, -1.6], blob: false }); Build.prop('cone', { pos: [1.2, 0, -1.9], blob: false });
    for (let z = -26; z <= -5; z += 4.2) for (const x of [-3.3, 3.3]) if (x < 0 || z < -22) Build.prop('cone', { pos: [x, 0, z], blob: false });
    Build.prop('cone', { pos: [4.9, 0.17, -12.2], rot: [0, 1.2, PI / 2], blob: false, solid: false });
    // COMMS van behind the gate, idling, angled so its headlights rake low across the wet road toward the east railing
    // (where she will lie) and never straight down the approach into the lens
    D.van = Build.car('comms_van', { pos: [-0.4, 0, 9.4], yaw: PI - 0.4, lights: 'spot', plate: 'COMMS 04' });
    Object.assign(D.van.userData.spot, { intensity: 90, distance: 50, decay: 1.5, angle: 0.5, penumbra: 0.7 });
    // the cold fill from the south: the night itself, enough to find a face behind a gas mask
    Build.light('spot', { pos: [4, 7, -34], target: [0, 1, -12], color: 0x5a78b8, intensity: 70, distance: 45, angle: 0.5, penumbra: 0.8, decay: 1.4 });
    // the floodlight tower: the key light and the one shadow caster
    D.flood = Build.prop('floodlight_tower', { pos: [-5.3, 0, 6.8], yaw: PI - 0.26, h: 7.2, tilt: 0.33, light: 1500, shadow: true, color: 0xeef2ff });
    const sl = D.flood.userData.light; sl.shadow.mapSize.set(1024, 1024); sl.shadow.camera.near = 1; sl.shadow.camera.far = 45; sl.angle = 0.62;
    // sandbags, the Soldiers' table (radio set, thermos, clipboard), the COMMS board, a crate of confiscated phones still lighting up
    Build.prop('sandbags', { pos: [2.4, 0, 6.2], length: 3.4, rows: 5 });
    Build.prop('sandbags', { pos: [-6.2, 0, 3.4], length: 2.4, rows: 4 });
    Build.prop('table', { kind: 'folding', pos: [4.4, 0, 4.1], w: 1.6, d: 0.7, yaw: 0.1 });
    Build.box(0.36, 0.2, 0.24, C(0x2e3328, { rough: 0.5 }), { pos: [4.0, 0.74, 4.15], solid: false });
    Build.box(0.05, 0.02, 0.03, C(0x1a1a1a, { emissive: 0x7dff9a, emissiveIntensity: 1.6 }), { pos: [4.0, 0.88, 4.03], solid: false });
    Build.box(0.09, 0.3, 0.09, C(0x7a1e1a, { rough: 0.4 }), { pos: [4.7, 0.74, 4.2], solid: false });
    Build.box(0.24, 0.02, 0.32, C(0xd8d4c8, { rough: 0.9 }), { pos: [4.95, 0.74, 3.95], rot: [0, 0.3, 0], solid: false });
    Build.sign({ tex: Tex.sign('comms', 'SOUTH CHECKPOINT'), w: 2.2, h: 0.82, pos: [-6.0, 0, -0.1], post: 1.1, posts: 2, yaw: PI });
    Build.prop('crate', { kind: 'plastic', pos: [-4.2, 0, 2.9], w: 0.6, h: 0.3, d: 0.4, color: 0x3a3a3a, blob: false });
    for (let i = 0; i < 7; i++) Build.prop('phone', { pos: [-4.42 + (i % 4) * 0.13, 0.31, 2.8 + (i >> 2) * 0.17], yaw: i * 0.7, screen: i % 3 ? 'lock' : 'feed', k: 1.3 });
    Build.glow({ pos: [-4.2, 0.45, 2.9], color: 0x4a7cff, size: 0.9, opacity: 0.7 });
    Build.prop('generator', { pos: [-5.9, 0, 8.6], on: true, yaw: 0.3 });
    // a halogen work lamp on a tripod south of the barrier, turned on the barricades (the stencils read from the approach)
    Build.box(0.05, 1.7, 0.05, C(0x2a2a2a, { rough: 0.5 }), { pos: [5.1, 0, -4.6], solid: false });
    Build.box(0.34, 0.26, 0.16, C(0x1a1a1a, { rough: 0.4 }), { pos: [5.1, 1.7, -4.6], rot: [0, -0.5, 0], solid: false });
    Build.glow({ pos: [5.02, 1.83, -4.45], color: 0xfff0d0, size: 0.9 });
    Build.light('spot', { pos: [5.0, 1.85, -4.4], target: [-0.5, 0.9, 0.2], color: 0xffe4c0, intensity: 26, distance: 16, angle: 0.75, penumbra: 0.6, decay: 1.6 });
    Build.prop('jerry_can', { pos: [-5.2, 0, 9.3], yaw: 0.8 });
  }

  function bridge(A) {
    // wet, but not a mirror: the floodlight sits low at the end of the approach, and a glossier deck turns its reflection
    // into a white-out from the south; the puddles carry the mirror highlights
    const D = A.data, wet = M('asphalt', { rough: 0.68, normal: 0.22, color: 0x74747a });
    // deck (z -30..760) over the water, the causeway approach to the south, piers down into the black
    Build.water({ x1: -900, z1: -140, x2: 900, z2: 1200, y: -4.2, dark: true, streaks: [
      { x: 8.2, z: 12, len: 22, w: 1.4 }, { x: -8.2, z: 48, len: 22, w: 1.2 }, { x: 8.2, z: 84, len: 24, w: 1.1 }, { x: -8.2, z: 120, len: 24, w: 1 },
      { x: 7, z: 6, len: 26, w: 2.6, color: 0xd8e0ff, opacity: 0.6 }] });
    Build.box(14, 1.1, 790, M('concrete', { color: 0x6a6862 }), { pos: [0, -1.1, 365] });
    Build.road({ from: [0, -140], to: [0, 760], width: 9, path: 1.7, mat: wet, lines: 'dashed' });
    for (let z = 0; z < 700; z += 36) Build.box(3.2, 3.1, 2.2, M('concrete', { color: 0x4e4c48 }), { pos: [0, -4.2, z], solid: false });
    for (const s of [-1, 1]) {
      Build.prop('bridge_railing', { pos: [s * 6.55, 0, -30], yaw: -PI / 2, length: 790 });
      Build.prop('crash_barrier', { pos: [s * 6.4, 0, -140], yaw: -PI / 2, length: 110 });
      Build.box(9, 2.2, 110, M('concrete', { color: 0x4a4640, rough: 1.2 }), { pos: [s * 9.4, -3.6, -85], rot: [0, 0, s * 0.5], solid: false });
    }
    A.collider([-6.4, 0, -140], [-6.3, 3, 760]); A.collider([6.3, 0, -140], [6.4, 3, 760]);
    // puddles holding the light
    const r = U.rng(8);
    for (let i = 0; i < 26; i++) Build.decal('puddle', { floor: true, pos: [(r() - 0.5) * 9, 0.013, -30 + r() * 42], w: 1.2 + r() * 2.6, h: 0.9 + r() * 1.8, spin: r() * 6, opacity: 0.85 });
    // bridge lamps receding north into the mist (sodium), and two on the approach behind; far ones beyond the fog
    for (let z = 14; z < 320; z += 34) { const e = (z / 34 | 0) % 2 ? 1 : -1; Build.streetlight({ pos: [e * 6.1, 0, z], yaw: -e * PI / 2, h: 8.5, blob: false, pool: z < 150 }); }
    for (const z of [-60, -110]) Build.streetlight({ pos: [-6.1, 0, z], yaw: PI / 2, h: 8.5, blob: false });
    Build.light('point', { pos: [3.6, 8.2, 14], color: 0xffa640, intensity: 70, distance: 26, decay: 1.6 });
    const lamps = []; for (let z = 48; z < 3200; z += 34) lamps.push([((z / 34 | 0) % 2 ? 1 : -1) * 3.6, 8.5, z]);
    farLights(A, lamps, 0xffa640, 2.4);
    // the far shores: a few lights left on, a fire, the odd cold blue of a screen
    const r2 = U.rng(21), shore = [], blue = [];
    for (let i = 0; i < 70; i++) { const a = (r2() - 0.5) * 2.6, d = 900 + r2() * 900, p = [Math.sin(a) * d, 2 + r2() * 5, 300 + Math.cos(a) * d]; (r2() < 0.18 ? blue : shore).push(p); }
    farLights(A, shore, 0xffb070, 9); farLights(A, blue, 0x6a9cff, 7);
    // abandoned on the approach: a hatch with its hazards going, a sedan left in the lane, a suitcase, a phone face-up on the road
    Build.car('hatch', { pos: [3.2, 0, -38], yaw: 0.12, wrecked: true, color: 0xb8bcc0, plate: '425 KDL' });
    Build.car('sedan', { pos: [-2.6, 0, -55], yaw: -0.08, color: 0x2a3e5c, plate: '425 KDL' });
    D.hazard = [[2.4, -40.1], [4.0, -40.3], [2.5, -36.1], [4.1, -35.9]].map(([x, z]) => Build.glow({ pos: [x, 0.8, z], color: 0xff9020, size: 0.6, dynamic: true }));
    Build.prop('cardboard_box', { pos: [1.6, 0, -31], w: 0.55, h: 0.4, d: 0.3, yaw: 0.4 });
    Build.prop('phone', { pos: [-1.7, 0.01, -21.5], yaw: 2.2, screen: 'feed', k: 1.5 });
    Build.glow({ pos: [-1.7, 0.1, -21.5], color: 0x4a7cff, size: 0.45, opacity: 0.8 });
    // mist in the floodlight
    Build.dust({ box: [-6, 0.2, -26, 6, 6, 6], count: 520, color: 0xc8d4ff, size: 0.018, opacity: 0.45 });
  }

  CONTENT.levels.P5 = {
    name: 'The bridge', origin: O5, grade: 'launch_bridge',
    fog: { color: 0x0a0d12, density: 0.021 },
    env: { top: 0x04060a, horizon: 0x121824, bottom: 0x020203, intensity: 0.45, spots: [{ dir: [-0.3, 0.35, 1], color: 0xdfe6ff, power: 2.2 }, { dir: [0.2, 0.25, -1], color: 0xffa040, power: 0.6 }] },
    background: 0x07090d, amb: 'bridge_night', surface: 'concrete',
    build(A) {
      const D = A.data;
      Build.hemi({ sky: 0x22304a, ground: 0x06070a, intensity: 0.7 });
      sky(A, 0x10141c, 0x020305, 0x1c1a1e);
      checkpoint(A); bridge(A);
      D.soldier = A.char('soldier', { name: 'soldier', at: M5.mk_p7_soldier[0], yaw: M5.mk_p7_soldier[1] });
      D.soldierB = A.char('soldier', { name: 'soldier_b', at: M5.mk_p7_soldier_b[0], yaw: M5.mk_p7_soldier_b[1] });
      D.soldierB.pose('aim', { direct: true, dur: 0.01 });
      for (const k in M5) A.marker(k, M5[k][0], M5[k][1]);
      mergeStatics(A);
      D.loops = [Audio.loop('clicks_far', { pos: A.w([30, 6, 420]), vol: 1 }), Audio.loop('water_lap', { pos: A.w([8, -3, -14]), vol: 0.8 }), Audio.loop('siren_far', { pos: A.w([-200, 10, -500]), vol: 0.5 })];
      // the long take (p7.down / p7.cradle / p7.gone set D.look and D.gaze): eyes re-applied every frame after the cradle's own
      // gaze, and the camera's aim eased toward what the frame is about — her, their two faces, his face
      D.gaze = null; D.look = null;
      const aim = V(), her = V(), lk = A.markers.mk_p7_look.pos;
      A.update((dt, t) => {
        for (const g of D.hazard) g.visible = t % 1.1 < 0.55;
        if (D.gaze) for (const [c, at] of D.gaze) c.lookAt(at);
        if (!D.look) return;
        const chase = Game.who('chase'), bub = Game.who('bub');
        if (D.look === 'lying') bub.point('chest', aim).lerp(chase.point('eyes', her), 0.35);
        else chase.point('eyes', aim).lerp(bub.point('eyes', her), D.look === 'held' ? 0.45 : 0.28);
        lk.lerp(aim, D.lookSnap ? 1 : 1 - Math.exp(-0.7 * dt)); D.lookSnap = false;
      });
    },
    unload(A) { for (const l of A.data.loops) l.stop(0.2); },
  };

  // ---- P.7 — The Bridge -------------------------------------------------------------------------------------------
  // The Chase/Soldier line runs north-south; the exchange keeps the camera on the west (-x) side of it. From beat 5 on:
  // one continuous take.
  const radio = (text, emote, pause) => ({ who: 'soldier', via: 'radio', text, emote, pause });
  CONTENT.scenes['P.7'] = {
    title: 'The Bridge', area: 'P5', grade: 'launch_bridge', silence: true,
    cast: { chase: 'mk_p7_chase0', luke: 'mk_p7_luke0', soldier: 'mk_p7_soldier', soldier_b: 'mk_p7_soldier_b' },
    start: { cut: true },
    shots: [
      // 1. Wide, 28 mm: the bridge running into black, the checkpoint in its own light; Chase limping toward it with her,
      //    Luke beside him, hands up
      { cam: { type: 'dolly', from: w5(-2.2, 1.25, -33.5), to: w5(-2.0, 1.3, -32.2), look: w5(0.6, 2.4, 4), lens: 28, dur: 11 }, dur: 10.6, focus: null,
        actions: [{ t: 0, who: 'chase', do: 'walkTo', at: 'mk_p7_chase', speed: 1.05 }, { t: 0.3, who: 'luke', do: 'walkTo', at: 'mk_p7_luke', speed: 1.0 },
          { t: 3.6, who: 'soldier', do: 'aim', at: 'chase.chest' }],
        lines: [{ who: 'soldier', text: 'Stop! Stop right there! Hands where I can see them!', emote: 'angry', t: 4.2, to: 'chase' }] },
      { cam: { type: 'ots', over: 'soldier', on: 'chase', side: 'left', lens: 65, push: 0.05 }, hold: 0.6,
        actions: [{ t: 0.3, who: 'chase', do: 'lookAt', at: 'soldier' }, { t: 0.2, who: 'bub', do: 'lookAt', at: 'soldier' }],
        lines: [{ who: 'chase', text: "My daughter's hurt. We need a hospital.", emote: 'afraid', pause: 0.5, to: 'soldier' }] },
      // he keeps his rifle on them and thumbs the radio, walking in
      { cam: { type: 'ots', over: 'chase', on: 'soldier', lens: 60 }, hold: 0.4,
        actions: [{ t: 0.1, do: 'call', hook: 'p7.prop', args: 'radio' }, { t: 0.6, who: 'soldier', do: 'walkTo', at: 'mk_p7_scan', speed: 0.8 }],
        lines: [radio('Three civilians at the south checkpoint.', 'tense', 0.5), radio('…Copy.', 'tense', 1.8), { who: 'soldier', text: 'Hold her out. Arm.', emote: 'tense', pause: 0.6, to: 'chase' }],
        cues: [{ t: 3.4, sfx: 'radio_static', at: 'soldier', vol: 0.4 }] },
      // 2. The scanner raised at her face
      { cam: { type: 'static', at: w5(-1.6, 1.35, -14.4), look: w5(1.0, 1.35, -15.6), lens: 40 }, dur: 4.2, focus: 'bub',
        actions: [{ t: 0, do: 'call', hook: 'p7.prop', args: 'scanner' }, { t: 0.3, who: 'bub', do: 'lookAt', at: 'soldier.hand_r' }, { t: 0.6, who: 'bub', do: 'emote', name: 'afraid' },
          { t: 0.4, who: 'soldier', do: 'gesture', name: 'point', to: 'bub.eyes', hold: true }, { t: 2.4, do: 'call', hook: 'p7.scan' }],
        cues: [{ t: 1.2, sfx: 'scanner_beep', at: 'soldier.hand_r', vol: 0.5 }, { t: 2.4, sfx: 'scanner_beep', at: 'soldier.hand_r', vol: 0.9 }] },
      { cam: { type: 'static', at: 'mk_p7_scrcam', look: 'mk_p7_scr', lens: 100 }, dur: 2.4, focus: 'mk_p7_scr' },
      { cam: { type: 'static', at: { of: 'soldier', off: [-0.45, 1.52, 1.25] }, look: 'soldier.eyes', lens: 55, push: 0.04 }, hold: 0.6, focus: 'soldier',
        actions: [{ t: 0, who: 'soldier', do: 'gesture', name: null }],
        lines: [{ who: 'soldier', text: "She's tagged.", emote: 'tense', pause: 0.5, to: 'chase' }] },
      { cam: { type: 'close', who: 'chase', lens: 65, push: 0.06 }, hold: 0.3,
        actions: [{ t: 0.1, who: 'chase', do: 'turnTo', to: 'soldier', dur: 0.4 }],
        lines: [{ who: 'chase', text: "She's not — she's fine, she's talking, look at her—", emote: 'afraid', pause: 0.2, to: 'soldier' }] },
      { cam: { type: 'two_shot', a: 'chase', b: 'soldier', lens: 35 }, hold: 0.8,
        actions: [{ t: 0, do: 'call', hook: 'p7.prop', args: 'radio' }, { t: 0.1, who: 'soldier', do: 'walkTo', at: 'mk_p7_back', speed: 0.7 }, { t: 0.6, who: 'luke', do: 'lookAt', at: 'soldier' }],
        lines: [radio("Sir, the girl's tagged.", 'tense', 0.9), radio("…Sir, they're just—", 'afraid', 1.6), radio('…Copy.', 'sad', 2.6)],
        cues: [{ t: 3.1, sfx: 'radio_static', at: 'soldier', vol: 0.35 }, { t: 6.6, sfx: 'radio_static', at: 'soldier', vol: 0.4 }, { t: 9.1, sfx: 'radio_click', at: 'soldier', vol: 0.6 }] },
      // 3. He lowers the radio and raises his rifle. His voice is young under the mask.
      { cam: { type: 'static', at: { of: 'soldier', off: [-0.5, 1.5, 1.35] }, look: 'soldier.eyes', lens: 70, push: 0.08 }, hold: 1.0, focus: 'soldier',
        actions: [{ t: 0.2, do: 'call', hook: 'p7.prop', args: 'rifle' }, { t: 0.4, who: 'soldier', do: 'aim', at: 'chase.chest' }],
        lines: [{ who: 'soldier', text: "I'm sorry.", emote: 'sad', pause: 1.6, to: 'chase' }] },
      { cam: { type: 'close', who: 'luke', lens: 65, push: 0.05 }, hold: 0.1,
        actions: [{ t: 0.3, who: 'luke', do: 'lookAt', at: 'soldier' }],
        lines: [{ who: 'luke', text: "Mate. Mate, don't—", emote: 'afraid', pause: 0.2, to: 'soldier' }] },
      // 4. Chase turns his body to shield her and runs for the railing, across the frame, the Soldier at its edge. Two shots.
      { cam: { type: 'static', at: w5(-2.6, 1.2, -21.5), look: w5(2.0, 1.0, -15.5), lens: 35, handheld: 1.2 }, dur: 3.0, focus: 'chase',
        actions: [{ t: 0, who: 'chase', do: 'turnTo', to: 2.4, dur: 0.35 }, { t: 0.25, who: 'chase', do: 'runTo', at: 'mk_p7_rail' }, { t: 0.4, who: 'luke', do: 'emote', name: 'shocked' },
          { t: 0.62, who: 'soldier', do: 'fire', at: 'chase.chest', sfx: 'rifle_shot' }, { t: 0.95, who: 'soldier', do: 'fire', at: 'chase.chest', sfx: 'rifle_shot' }, { t: 1.08, do: 'call', hook: 'p7.fall' },
          { t: 1.2, who: 'luke', do: 'runTo', at: 'mk_p7_back' }],
        cues: [{ t: 0.62, shake: 0.5, dur: 0.3 }, { t: 0.95, shake: 0.5, dur: 0.3 }, { t: 1.35, sfx: 'body_fall', at: 'chase', vol: 1.2 }] },
      // Luke tackles him, wrestles the rifle; a third shot ends it. Silhouettes against the floodlight.
      { cam: { type: 'static', at: w5(0.3, 0.5, -17.9), look: w5(-1.2, 0.95, -12.9), lens: 32, handheld: 0.8 }, dur: 4.4, focus: 'soldier',
        actions: [{ t: 0, do: 'call', hook: 'p7.tackle' }, { t: 0, do: 'call', hook: 'p7.down' }, { t: 0.2, who: 'soldier', do: 'gesture', name: 'struggle', dur: 2.6 }, { t: 0.2, who: 'luke', do: 'gesture', name: 'struggle', dur: 2.6 },
          { t: 2.7, do: 'call', hook: 'p7.shot' }],
        cues: [{ t: 0, sfx: 'tackle', at: 'luke' }, { t: 0.25, sfx: 'body_fall', at: 'soldier' }, { t: 1.2, sfx: 'metal_hit', at: 'soldier', vol: 0.5 }, { t: 2.7, sfx: 'rifle_shot', at: 'soldier', vol: 1.1 }, { t: 2.7, shake: 0.35, dur: 0.3 }] },
      // Luke stands frozen over the body: low, past the dead man's head, the lights behind the lens on his face
      { cam: { type: 'static', at: { of: 'luke', off: [0.3, 0.38, 1.75] }, look: 'luke.chest', lens: 35 }, dur: 5.2, focus: 'luke',
        actions: [{ t: 0.4, do: 'call', hook: 'p7.stand' }, { t: 1.4, who: 'soldier_b', do: 'pose', name: 'stand' }, { t: 2.2, who: 'soldier_b', do: 'walkTo', at: w5(-3.4, 0, 4.4), speed: 0.5 },
          { t: 4.1, who: 'luke', do: 'drop', hand: 'r' }],
        cues: [{ t: 4.45, sfx: 'metal_hit', at: 'luke', vol: 0.4 }] },
      // 5–7. One continuous take. Low on the wet road, in the headlights: he crawls to her and pulls her into his lap; the
      //      camera pushes in for the whole of it, from the road to his face above hers.
      { longTake: true, dur: 85, focus: 'mk_p7_look',
        cam: { type: 'dolly', from: w5(CAM0[0], 0.52, CAM0[1]), to: w5(CAM1[0], 0.84, CAM1[1]), look: 'mk_p7_look', lens: 45, dur: 85, ease: 'inOut' },
        actions: [
          { t: 2.4, who: 'chase', do: 'pose', name: 'crawl', dur: 1.4 }, { t: 3.6, who: 'chase', do: 'walkTo', at: 'mk_p7_cradle', speed: 0.33 },
          { t: 9.0, do: 'call', hook: 'p7.cradle' },
          { t: 53.5, do: 'call', hook: 'p7.gone' }, { t: 55.5, who: 'bub', do: 'gesture', name: 'drop_hand' },
          { t: 70.4, who: 'luke', do: 'walkTo', path: [...LUKE_PATH, 'mk_p7_luke_end'], speed: 0.85, yaw: LUKE_YAW },
          { t: 78.3, who: 'luke', do: 'gesture', name: 'hand_on_shoulder', to: 'chase', hold: true }],
        lines: [
          { who: 'bub', text: 'Dad…', emote: 'afraid', t: 12.5, dur: 2.4, to: 'chase' },
          { who: 'chase', text: "Hey. Hey. Bub. Look at me. You're alright. Look at me.", emote: 'tender', pause: 1.6, dur: 5.4, to: 'bub' },
          { who: 'bub', text: 'It itches.', emote: 'sad', pause: 2.4, dur: 2.4, to: 'chase' },
          { who: 'chase', text: 'I know. I know. Just look at me. Keep looking at me.', emote: 'tender', pause: 1.8, dur: 5.2, to: 'bub' },
          { who: 'bub', text: 'Did you get it? Three-twelve?', emote: 'smile', pause: 3.2, dur: 3.4, to: 'chase' },
          { who: 'chase', text: 'Yeah. Yeah, I got it.', emote: 'crying', pause: 2.6, dur: 4, to: 'bub' },
          { who: 'bub', text: 'Told you.', emote: 'tender', pause: 2.2, dur: 2.6, to: 'chase' },
          { who: 'chase', text: 'Bub.', emote: 'crying', pause: 7, dur: 2.2, to: 'bub' },
          { who: 'chase', text: 'Bub, look at me.', emote: 'crying', pause: 2, dur: 2.6, to: 'bub' },
          { who: 'chase', text: '…Please.', emote: 'crying', pause: 2, dur: 2.8, to: 'bub' }],
        cues: [{ t: 84.9, fade: 'black', dur: 0 }, { t: 84.9, amb: null, fade: 0.05 }, { t: 84.9, call: 'p7.silence' }] },
    ],
    end: { call: { hook: 'p7.end' } },
    exit: { cut: true },
  };

  const S5 = () => Game.areas.get('P5');
  // the Soldier's hands: rifle (slung on his back when not in them), radio, scanner
  H['p7.prop'] = (G, what) => {
    const A = S5(), c = G.who('soldier'); if (!A || !c) return;
    const D = A.data;
    if (!D.rifle) { D.rifle = c.held('r') || c.hold('rifle', 'r'); }
    for (const h of ['r', 'l']) { const p = c.held(h); if (p && p !== D.rifle) c.drop(h, { remove: true }); }
    if (what === 'rifle') { c.hold(D.rifle, 'r'); return; }
    if (c.held('r') === D.rifle) c.drop('r', { remove: true });
    c.bones.chest.add(D.rifle); D.rifle.position.set(0.02 * c.D.s, 0.02 * c.D.s, -0.2 * c.D.s); D.rifle.rotation.set(-PI / 2 + 0.1, 0.7, 0);
    if (what === 'radio') { c.hold('radio', 'r'); c.pose('phone_ear', { dur: 0.4 }); }
    if (what === 'scanner') { D.scanner = c.hold('scanner', 'r'); c.pose('stand', { dur: 0.3 }); }
  };
  H['p7.scan'] = G => {   // the number comes up; the insert looks straight down onto the screen on top of the scanner
    const A = S5(), D = A && A.data; if (!D || !D.scanner) return;
    let scr = null; D.scanner.traverse(o => { if (o.isMesh && o.material.map) scr = o; });
    const cv = scr.material.map.image, g = cv.getContext('2d');   // drawn here so all nine characters fit the screen
    g.fillStyle = '#3a0606'; g.fillRect(0, 0, cv.width, cv.height); g.fillStyle = '#ff5040'; g.font = 'bold 21px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('BADGE: 14', cv.width / 2, cv.height / 2 + 2); scr.material.map.needsUpdate = true;
    scr.position.y += 0.02; scr.scale.setScalar(1.5);              // a touch bigger, clear of the casing once it tilts back
    const p = scr.getWorldPosition(V()), up = D.scanner.localToWorld(V(0, 1, 0)).sub(D.scanner.getWorldPosition(V())), cam = up.multiplyScalar(0.32).add(p);
    scr.lookAt(cam);                                                // square to the lens, the text level
    A.marker('mk_p7_scr', p.sub(A.origin).toArray()); A.marker('mk_p7_scrcam', cam.sub(A.origin).toArray());
  };
  H['p7.fall'] = G => {   // hit: he goes down hard and she goes out of his arms
    const chase = G.who('chase'), bub = G.who('bub');
    chase.detach(); chase.stop(); bub.stop();
    bub.pose('dead', { direct: true, dur: 0.3 }); bub.emote('shocked'); bub.lookAt(null);
    chase.pose('struggle_down', { direct: true, dur: 0.28 }); chase.emote('shocked');
  };
  H['p7.down'] = G => {   // (off camera) where they lie for the long take: she in the headlights, he a body length away
    const chase = G.who('chase'), bub = G.who('bub'), D = S5().data;
    G.place(bub, 'mk_p7_bub'); bub.pose('dead', { direct: true, dur: 0.05 }); bub.emote('exhausted');
    G.place(chase, 'mk_p7_fall'); chase.pose('struggle_down', { direct: true, dur: 0.05 }); chase.emote('exhausted'); chase.lookAt(bub);
    D.look = 'lying'; D.lookSnap = true;
  };
  H['p7.tackle'] = G => {
    const luke = G.who('luke'), s = G.who('soldier');
    s.stop(); luke.stop(); s.lookAt(luke); luke.lookAt(s); s.emote('afraid'); luke.emote('angry');
    luke.attach(s, 'pin');
  };
  H['p7.shot'] = G => { const s = G.who('soldier'); s.gesture('fire'); s.lookAt(null); s.emote('neutral'); s.pose('dead', { dur: 0.5 }); };
  H['p7.stand'] = G => {
    const luke = G.who('luke'), s = G.who('soldier'), D = S5().data;
    luke.detach(); if (s.held('r')) s.drop('r', { remove: true }); if (D.rifle.parent) D.rifle.parent.remove(D.rifle);
    luke.hold(D.rifle, 'r'); luke.pose('stand', { dur: 1.4 }); luke.emote('shocked'); luke.lookAt(s.point('chest'));
    if (s.poseName !== 'dead') s.pose('dead', { direct: true, dur: 0.2 });
  };
  // while she talks he looks down the length of her (his face stays open to the camera); she looks up at him. After, her
  // eyes rest on nothing just above his head and his on nothing just past the lens.
  const gaze = (chase, bub, gone) => {
    const a = V(), b = V();
    const D = S5().data; D.look = gone ? 'gone' : 'held';
    D.gaze = gone ? [[chase, V(...w5(STARE[0], 0.95, STARE[1]))], [bub, chase.point('head', b).add(V(0, 0.45, 0))]] : [[chase, () => bub.point('hips', a)], [bub, () => chase.point('eyes', b)]];
  };
  H['p7.cradle'] = G => {
    const chase = G.who('chase'), bub = G.who('bub');
    chase.stop(); chase.turnTo(CY, 0.6); chase.attach(bub, 'cradle'); chase.emote('afraid'); bub.emote('afraid');
    gaze(chase, bub, false);
  };
  H['p7.gone'] = G => {   // her eyes lose focus: they stay open, fixed on nothing past his shoulder
    const bub = G.who('bub'); bub.emote('exhausted'); if (bub.face) bub.face.noBlink = true;
    gaze(G.who('chase'), bub, true);
  };
  H['p7.silence'] = () => { const A = S5(); if (A) for (const l of A.data.loops) l.stop(0.05); };
  H['p7.end'] = G => {   // the end state (also on skip): she is gone, in his lap; Luke's hand on his shoulder
    const chase = G.who('chase'), bub = G.who('bub'), luke = G.who('luke'), s = G.who('soldier');
    if (s && s.poseName !== 'dead') s.pose('dead', { direct: true, dur: 0.2 });
    G.place(chase, 'mk_p7_cradle'); chase.attach(bub, 'cradle', { grip: false }); chase.emote('crying'); bub.emote('exhausted'); gaze(chase, bub, true); S5().data.lookSnap = true;
    if (luke.pair) luke.detach(); G.place(luke, 'mk_p7_luke_end'); luke.pose('stand', { direct: true, dur: 0.2 });
    H['p7.silence'](G); Audio.amb(null, 0.05);
  };

  H['prologue.P7'] = async G => {
    const cont = !!G.areaById('P4');   // straight on from the causeway's held frame (else a retry: start on black)
    if (!cont) { Director.stop(); G.fade('black', 0); }
    UI.hud({ show: false }); UI.phone(null);
    if (G.areaById('P5')) G.unload('P5');
    await G.area('P5');
    const chase = G.actor('chase', 'chase_young', 'mk_p7_chase0'), luke = G.actor('luke', 'luke_young', 'mk_p7_luke0'), bub = G.actor('bub', 'bub', 'mk_p7_chase0');
    for (const c of [chase, luke, bub]) reset(c);
    if (bub.face) bub.face.noBlink = false;
    G.player(null); G.control(false);
    chase.decal('blood_knuckles'); chase.decal('grime'); luke.decal('grime'); bub.decal('tears'); bub.decal('grime');
    chase.attach(bub, 'carry'); chase.setMove(0, { carry: true, limp: true }); chase.emote('exhausted'); bub.emote('sad');
    bub.badge(14, 'wrist_r');
    luke.pose('hands_up', { direct: true, dur: 0.01 }); luke.emote('afraid');
    for (let i = 0; i < 20; i++) Chars.update(1 / 30);
    const done = G.scene('P.7');
    if (!cont) G.fade('none', 2);
    await done;
    G.fade('black', 0);
    await G.wait(5);
    G.music('theme_a');
    await G.wait(2.2);
    await G.title([{ text: 'THE LAST OF YES', size: 3.6 }, 'TEN YEARS LATER'], { gap: 5, hold: 4.5, fadeIn: 2.2, fadeOut: 2.4 });
    await G.wait(1.5);
  };
})();
