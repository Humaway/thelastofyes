// ============================================================================
// Prologue P.1 — the "yes" store, Redcliffe. Area P1 (launch night, 11:40 pm), area TITLE (the same store ten
// years on, at dawn), scene P.1, flow hook prologue.P1, and the store-side hooks for P.3. Owned by: store agent.
//
// STAGE PLAN (area-local = world; P1 and TITLE both sit at origin [0,0,0]; P2 is at [500,0,0], so P1 stays loaded
// under G.area('P2', {keep:true}) for the P.3 intercut. Cut back to the store with the cue { look: 'P1' }.)
//
//   Store interior x -7..7, z -10 (back wall) .. 0 (glass shopfront, street side +Z), ceiling 3.3 m, cool white retail
//   light; graphite feature wall behind the counters with a yellow "yes" logo and LED strip. Queue lane down the middle
//   (x ≈ 0.1, z -5.3 .. -1.3) between belt barriers; demo tables at x ±3.9, z -3.4 and -1.2; wall displays on both
//   side walls. Back-office door (STAFF ONLY, ajar, warm light behind; the Store Manager is never seen) at x -5.9.
//   Outside: footpath z 0..3.6, the queue runs from the doors along the footpath (+X) to x 13.5, turns into the car
//   park at x 14.8 and runs to z 11. Car park z 3.6..34 under sodium lights, road at z 39.5.
//
//   Markers                          pos                       yaw     notes
//   mk_chase_counter                 [-1.6, 0, -8.2]           0       Chase behind his counter, facing the customer (+Z)
//   mk_luke_counter                  [ 1.6, 0, -8.2]           0       Luke's counter (next along, Chase's left)
//   mk_customer                      [-1.6, 0, -6.72]          π       customer side of Chase's counter (the Customer)
//   mk_customer_side                 [-2.6, 0, -6.72]          π       where she sets up her new phone at the end of P.1
//   mk_next                          [ 0.1, 0, -5.3]           π       head of the inside queue (next customer)
//   mk_store_phone                   [-0.72, 1.0, -7.52]       0       store landline on Chase's counter (Luke's end)
//   mk_chase_phone                   [-0.8, 0, -8.3]           0.3     Chase on the landline (the handset cord reaches)
//   mk_whiteboard                    [-0.95, 0, -9.35]         2.7     writing on the leaderboard (board centre [0, 1.58, -9.86])
//   mk_luke_board                    [ 0.95, 0, -8.55]         -1.35   Luke at the board, cheated open to the shop floor
//   mk_luke_phone / mk_luke_lean     [-0.05,0,-8.25] / [0.15,0,-8.35]   Luke at the landline / leaning in to Chase
//   mk_eftpos                        [-1.2, 1.02, -7.25]               the EFTPOS pad on Chase's counter (customer side)
//   mk_door                          [-5.9, 0, -9.7]           0       back-office door (Store Manager's voice: [-5.9,1.6,-10.8])
//   mk_entrance                      [ 0, 0, 0.6]              π       the sliding doors, outside
//   mk_guard                         [-1.75, 0, 1.0]           π/2     Security Guard with the clicker counter
//   mk_start                         [ 0, 0, 7]                π       free roam (dev)
//   Camera marks (position -> look target):
//   mk_cam_counter  [-1.35, 1.52, -5.6] -> Chase's eyes            customer-side single on Chase over the counter (65 mm)
//   mk_cam_luke     [ 1.9, 1.5, -5.7]   -> mk_luke_counter + 1.6    Luke single (keep the camera on +Z of the counters)
//   mk_cam_store    [ 5.6, 2.1, -0.8]   -> [-1, 1.2, -7.8]          wide of the store: demo tables, queue lane, counters
//   mk_cam_demo     [-2.3, 1.25, -2.4]  -> [-3.9, 0.95, -3.4]        low over a demo table (the phones switch to the feed)
//   mk_cam_door_in  [ 0.4, 1.7, -3.6]   -> [ 1.5, 1.4, 3.5]          from inside through the glass to the silent queue
//   mk_cam_queue_out [3.6, 1.62, 4.1]   -> mk_cam_queue_look [10, 1.4, 1.3]   along the queue's faces (handheld turn)
//   mk_cam_grab     [ 7.4, 1.6, 3.6]    -> [9.3, 1.45, 1.35]: the grab pair (man_grab [9.3,0,1.8] turns his back to this camera,
//                                       man_grabbed [9.2,0,1.05] faces it with the screen forced in front of his eyes)
//   Sightlines: counter exchanges keep the camera on the customer side (+Z) of the Chase/Luke line; the Chase/Customer
//   pair was established with the camera on Chase's left (+X; the POS monitor blocks the -X side) — keep it there in P.3.
//   Area chars (A.char names): customer, security_guard, next_customer, man_grab, man_grabbed, kid (on dad's shoulders),
//   q0..qN (the queue). Persistent actors: chase (chase_young), luke (luke_young).
//
// HOOKS
//   prologue.P1                  flow beat: builds P1, places actors and extras, hides the HUD, plays P.1 (hard cut out)
//   p1.infinite(G)               the store at 11:59: every demo phone and crowd phone on the same feed, the Customer frozen
//                                at mk_customer (feed eyes, thumb swiping), the queue silent and still, crowd murmur off
//   p1.grab(G)                   on cue: man_grab seizes man_grabbed and forces his screen in front of his eyes (≈3 s)
//   p1.chasePhone(G, {pct=42})   Chase's own phone in his right hand showing "INFINITE — Installing… 42%"
//   p1.slamPhone(G)              the phone leaves his hand and lies face-down, cracked, on his counter
//   (internal, used by P.1: p1.handset 'luke'|'chase'|'base', p1.board n, p1.type, p1.myPhone, p1.pocket, p1.settle)
//   After P.1 the Customer stands at mk_customer_side holding her new phone, next_customer at mk_customer, Chase at
//   mk_chase_counter, Luke at mk_luke_counter, the board reads CHASE 300; p1.infinite puts the Customer back at mk_customer
//   and next_customer back at mk_next (off-camera moves: call it on a cut away from the store).
// ============================================================================
(() => {
  const PI = Math.PI, M = (n, o) => Tex.mat(n, o), C = (h, o) => Tex.color(h, o);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const st = { infinite: false };                   // P1 ambience follows the 11:59 state (applyLook reads def.amb)
  const BOARD = n => `b:MIDNIGHT LAUNCH\nCHASE ${n}\nLUKE 187\nr:TARGET 312`;
  const PHONE_T = '11:41 PM';

  // shared held-phone screens for the queue before 11:59 (lock screen with the INFINITE card, the store demo, the news)
  let scrMats = null, litMat = null;
  const lit = () => litMat || (litMat = Object.assign(new THREE.MeshBasicMaterial({ color: new THREE.Color(0.82, 0.84, 0.88), toneMapped: false }), { userData: { shared: true } }));
  const screens = () => scrMats || (scrMats = ['lock', 'demo', 'news', 'lock'].map(k => {
    const m = new THREE.MeshBasicMaterial({ map: Tex.screen(k), color: new THREE.Color(1.5, 1.6, 1.9), toneMapped: false });
    m.userData.shared = true; return m;
  }));

  // ---- the store shell (both eras) --------------------------------------------------------------------------------
  function store(A, ruin) {
    const age = ruin ? 1 : 0;
    const white = M('plaster', { color: ruin ? 0xb8b2a2 : 0xf4f4f2 }), graphite = M('plaster', { color: ruin ? 0x3a3832 : 0x3c4048 });
    const floorM = M('tiles_mall', { color: ruin ? 0x9a968a : 0xe9e9e7 });
    Build.room({ x: 0, z: -5, w: 14, d: 10, h: 3.3, wall: white, outside: M('render', { color: 0xd8d2c4 }), floor: floorM, ceil: ruin ? false : M('plaster', { color: 0xf0f0ee }),
      omit: 's', doors: [{ side: 'n', at: -5.9, w: 0.9, h: 2.1 }], surface: 'tile' });
    // graphite feature wall behind the counters, yellow LED strip, the "yes" logo
    Build.box(11.6, 3.3, 0.04, graphite, { pos: [1.2, 0, -9.9], solid: false });
    Build.box(11.6, 0.04, 0.02, C(0xffc400, { emissive: 0xffc400, emissiveIntensity: ruin ? 0 : 0.9 }), { pos: [1.2, 2.72, -9.86], solid: false });
    Build.decal(Tex.sign('logo', 'yes', { color: '#ffcf12', faded: age * 0.6 }), { pos: [4.6, 2.05, -9.87], w: 1.5, h: 0.75, emissive: ruin ? 0 : 0.4, cutout: true });
    // backlit lightbox posters behind the counters (a soft bright shape behind Chase in the counter shots)
    for (const [x, k] of [[-2.55, 'promo_launch'], [2.6, 'promo_upgrade']]) {
      Build.box(1.04, 1.44, 0.06, C(0xd8dadc, { rough: 0.4, metal: 0.5 }), { pos: [x, 0.98, -9.86], solid: false });
      Build.decal(Tex.poster(k, { worn: age * 0.8 }), { pos: [x, 1.7, -9.82], w: 0.96, h: 1.36, emissive: ruin ? 0 : 0.55, cutout: true });
    }
    // back office (its lamp is warm; the door stands ajar)
    Build.room({ x: -5.2, z: -12, w: 3.6, d: 4, h: 2.7, wall: M('plaster', { color: 0xd8cfb8 }), floor: M('carpet', { color: 0x4a4a52 }), omit: 's', surface: 'carpet' });
    Build.prop('office_door', { pos: [-5.9, 0, -10], w: 0.9, open: ruin ? 0.9 : 0.22, text: 'STAFF ONLY', worn: age });
    Build.prop('desk', { pos: [-5.4, 0, -13.4], kind: 'office', w: 1.4, worn: age });
    Build.prop('filing_cabinet', { pos: [-3.9, 0, -13.6], worn: age });
    Build.prop('chair', { pos: [-5.3, 0, -12.7], yaw: PI, kind: 'office' });
    // counters, whiteboard, back fixtures
    Build.prop('store_counter', { pos: [-1.6, 0, -7.45], w: 2.4, worn: age });
    Build.prop('store_counter', { pos: [1.6, 0, -7.45], w: 2.4, worn: age });
    for (const x of [-3.5, 3.4]) Build.box(1.8, 0.95, 0.5, M('laminate', { color: ruin ? 0x7a7870 : 0xd8dadc }), { pos: [x, 0, -9.6], bevel: 0.01 });
    Build.prop('wall_display', { pos: [4.9, 0, -9.92], w: 3.0, lit: !ruin, worn: age });
    for (const [x, n] of [[-3.1, 3], [3.0, 2]]) Build.prop('cardboard_box', { pos: [x, 0.95, -9.6], stack: n, w: 0.4, h: 0.22, d: 0.3, worn: age });
    // side walls: stocked displays and accessory walls
    for (const s of ruin ? [1] : [-1, 1]) {
      Build.prop('wall_display', { pos: [s * 6.92, 0, -6.4], yaw: -s * PI / 2, w: 3.2, lit: !ruin, worn: age });
      Build.prop('wall_display', { pos: [s * 6.92, 0, -2.4], yaw: -s * PI / 2, w: 3.2, lit: !ruin, worn: age });
    }
    // demo tables (P.3 switches every screen to the feed)
    A.data.demo = (ruin ? [[-3.9, -3.4], [5.0, -6.1], [-3.9, -1.2]] : [[-3.9, -3.4], [3.9, -3.4], [-3.9, -1.2], [3.9, -1.2]]).map(([x, z], i) =>
      Build.prop('demo_table', { pos: [x, 0, z], yaw: i & 1 ? 0.04 : -0.04, screen: ruin ? 'off' : 'demo', phones: ruin ? 2 : 6, worn: age }));
    // front of house: shopfront, parapet, pedestals, entry banner
    Build.prop('shopfront', { pos: [0, 0, 0], w: 14.3, h: 3.6, text: 'REDCLIFFE', open: ruin ? 0.35 : 1, faded: age, broken: ruin, lit: !ruin });
    Build.box(14.6, 0.7, 0.4, M('render', { color: ruin ? 0x9a948a : 0xdcd6ca }), { pos: [0, 3.6, -0.02] });
    Build.prop('security_pedestals', { pos: [0, 0, -0.7], w: 2.0, worn: age });
  }

  // ---- the landline on Chase's counter: base, handset (moves between hands), live coiled cord ----------------------
  function landline(A) {
    const base = new THREE.Group(), dark = C(0x1d1f22, { rough: 0.45 }), grey = C(0x3a3d42, { rough: 0.5 }), key = C(0xd8dadc, { rough: 0.6 });
    base.position.set(-0.72, 1.0, -7.52); base.rotation.y = PI - 0.35; A.group.add(base);
    // parts merged per material (one draw call each)
    const merged = (p, parts) => { for (const [m, list] of parts) { const me = new THREE.Mesh(mergeGeometries(list.map(([g, x, y, z, rx]) => g.rotateX(rx || 0).translate(x, y, z))), m); me.castShadow = true; p.add(me); } };
    const B = (w, h, d) => new THREE.BoxGeometry(w, h, d), keys = [];
    for (let i = 0; i < 12; i++) keys.push([B(0.022, 0.006, 0.016), -0.03 + (i % 3) * 0.03, 0.064 + Math.floor(i / 3) * 0.004, 0.065 - Math.floor(i / 3) * 0.022, -0.12]);
    merged(base, [[dark, [[B(0.2, 0.05, 0.22), 0, 0.025, 0]]], [grey, [[B(0.18, 0.012, 0.12), 0, 0.055, 0.03, -0.12]]], [key, keys],
      [C(0x1a1a1a, { emissive: 0x7fd6a0, emissiveIntensity: 1.2 }), [[B(0.035, 0.012, 0.018), 0.06, 0.066, 0.075, -0.12]]]]);
    // the handset (Chars' landline handset, made for phone_ear); the live cord below runs from the base to its foot
    const hs = Chars.props.handset(), foot = hs.userData.cord.foot.clone();
    hs.remove(hs.userData.cord.mesh); delete hs.userData.cord;
    const cradle = () => { base.add(hs); hs.position.set(0, 0.092, -0.03); hs.rotation.set(PI / 2, 0, PI / 2); };
    cradle();
    // coiled cord: base socket -> handset foot, rebuilt only when the handset moves
    const cordMat = C(0x1a1b1d, { rough: 0.6 }), cord = new THREE.Mesh(new THREE.BufferGeometry(), cordMat); cord.frustumCulled = false;
    A.group.add(cord);
    const a = V(0, 0, 0), b = V(0, 0, 0), last = V(1e9, 0, 0), pts = [], n = 90;
    A.update(() => {
      base.localToWorld(a.set(-0.1, 0.03, -0.05)); hs.localToWorld(b.copy(foot));
      if (b.distanceToSquared(last) < 1e-6) return;
      last.copy(b);
      const L = a.distanceTo(b), dir = V(0, 0, 0).subVectors(b, a).normalize(), u = V(0, 1, 0).cross(dir);
      if (u.lengthSq() < 1e-4) u.set(1, 0, 0); u.normalize();
      const w = V(0, 0, 0).crossVectors(dir, u), coils = 8 + L * 40, sag = Math.max(0.03, 0.35 - L * 0.4);
      pts.length = 0;
      for (let i = 0; i <= n; i++) {
        const t = i / n, ang = t * coils * PI * 2, r = 0.011;
        pts.push(V(0, 0, 0).lerpVectors(a, b, t).addScaledVector(u, Math.cos(ang) * r).addScaledVector(w, Math.sin(ang) * r).add(V(0, -Math.sin(t * PI) * sag, 0)));
      }
      cord.geometry.dispose(); cord.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n * 3, 0.0032, 4, false);
    });
    return { hs, cradle };
  }

  // ---- queue and crowd ----------------------------------------------------------------------------------------------
  function crowd(A) {
    const out = [], scr = screens();
    let seed = 400;
    const person = (name, at, yaw, o = {}) => {
      const c = A.char(o.def || 'crowd', { name, at, yaw, seed: o.def ? undefined : seed++ });
      if (o.phone) { c.hold('phone'); c.pose('phone'); c.phoneGlow(true); c.held('r').userData.screen.material = scr[out.length % scr.length]; }
      out.push(c); return c;
    };
    const R = U.rng(77), jit = a => (R() - 0.5) * a;
    // inside: the lane between the belts, facing the counters
    [-4.5, -3.7, -2.9, -2.1, -1.3].forEach((z, i) => person('q_in' + i, [0.1 + jit(0.25), 0, z + jit(0.15)], PI + jit(0.4), { phone: i !== 2 }));
    A.char('crowd', { name: 'next_customer', at: [0.1, 0, -5.3], yaw: PI, seed: 390 });
    // outside, along the footpath toward the doors (+X), then down the car park
    let x = 1.5, i = 0, grab = false;
    while (x < 13.6) {
      const z = 1.25 + jit(0.35);
      if (!grab && x > 8.7) {             // the pair P.3 needs: one grabs the man beside him (mk_cam_grab frames them)
        grab = true; x = 9.2;
        A.data.grab = [person('man_grab', [x + 0.1, 0, 1.8], -PI / 2 - 0.1, { phone: true }), person('man_grabbed', [x, 0, 1.05], -PI / 2 + 0.2, { phone: true })];
      } else if (i === 6) {
        const dad = person('dad', [x, 0, z], -PI / 2 + jit(0.3)), kid = A.char('kid', { name: 'kid', at: [x, 0, z], yaw: -PI / 2, seed: 12 });
        dad.attach(kid, 'shoulders'); kid.hold('phone'); A.data.kid = kid;
      } else {
        person('q' + i, [x, 0, z], -PI / 2 + jit(0.5), { phone: R() < 0.72 });
        if (R() < 0.2) person('q' + i + 'b', [x + jit(0.2), 0, z + 0.55], -PI / 2 + jit(0.8), { phone: R() < 0.5 });
      }
      x += 0.72 + R() * 0.25; i++;
    }
    for (let z = 2.6; z < 11.4; z += 0.8 + R() * 0.2, i++) person('q' + i, [14.8 + jit(0.3), 0, z], PI + jit(0.5), { phone: R() < 0.4 });
    // the man in the camp chair who has been here since this morning
    person('camper', [12.1, 0, 2.35], -PI / 2 - 0.3, { phone: true }).pose('sit');
    return out;
  }

  // ---- P1: launch night ---------------------------------------------------------------------------------------------
  CONTENT.levels.P1 = {
    name: 'Optus Redcliffe — launch night', origin: [0, 0, 0],
    grade: 'launch_night', fog: { color: 0x0b0d15, near: 22, far: 95 }, background: 0x070910, surface: 'concrete',
    env: { top: 0x0c1222, horizon: 0x2a2226, bottom: 0x060606, intensity: 0.5, spots: [{ dir: [0.3, 0.2, 0.6], color: 0xff9a40, power: 2.5 }, { dir: [0, 1, -0.4], color: 0xdfe8ff, power: 1.5 }] },
    get amb() { return st.infinite ? 'lab' : 'store_night'; },
    build(A) {
      st.infinite = false;
      store(A, false);
      // ---- lighting: one shadow key over the counters, cool retail fill, sodium outside, yellow sign spill -----------
      Build.hemi({ sky: 0x3a4660, ground: 0x151210, intensity: 0.45 });
      Build.light('spot', { pos: [-0.3, 3.2, -4.6], target: [-0.5, 1.0, -8.6], color: 0xf2f5ff, intensity: 13, distance: 12, angle: 0.95, penumbra: 1, shadow: true });
      Build.light('point', { pos: [0, 3.0, -1.6], color: 0xe8eeff, intensity: 5, distance: 10 });
      Build.light('point', { pos: [-0.2, 2.4, -5.6], color: 0xf0f2ff, intensity: 5, distance: 6.5 });
      Build.light('point', { pos: [-1.6, 2.5, -8.0], color: 0xfff4e6, intensity: 2.2, distance: 5 });
      Build.light('point', { pos: [-5.9, 2.2, -12.3], color: 0xffc890, intensity: 4, distance: 6 });
      Build.light('point', { pos: [0.6, 2.1, 2.6], color: 0xffd25a, intensity: 4.5, distance: 8 });
      Build.light('point', { pos: [6.5, 2.0, 1.2], color: 0xdfe6ff, intensity: 5, distance: 8 });
      for (const x of [-4.5, 0, 4.5]) for (const z of [-8.2, -5.2, -2.2]) Build.prop('ceiling_light', { pos: [x, 3.3, z], kind: 'panel', w: 1.2 });
      Build.pool({ pos: [0, 0, 1.4], r: 3.2, color: 0xffd060, opacity: 0.25 });
      Build.pool({ pos: [0, 0, 0.9], r: 5.5, color: 0xcfe0ff, opacity: 0.12 });
      // ---- interior dressing -----------------------------------------------------------------------------------
      const board = Build.prop('whiteboard', { pos: [0, 1.1, -9.86], stand: false, w: 1.5, h: 0.95, text: BOARD(299) });
      A.data.board = board;
      Build.prop('promo_banner', { pos: [0.1, 2.35, -3.4], text: 'MIDNIGHT LAUNCH — BE FIRST', w: 3.4, drop: 0.55 });
      Build.prop('promo_banner', { pos: [-3.9, 2.45, -6.6], yaw: 0.5, text: 'UPGRADE YOUR LIFE', w: 2.2, drop: 0.45 });
      Build.prop('queue_barrier', { pos: [0, 0, 0], points: [[-0.62, -0.9], [-0.62, -3.3], [-0.62, -5.0]] });
      Build.prop('queue_barrier', { pos: [0, 0, 0], points: [[0.85, -0.9], [0.85, -3.3], [0.85, -5.0]] });
      Build.poster('promo_launch', { pos: [-6.83, 1.55, -8.6], yaw: PI / 2, w: 0.7, worn: 0, tape: false });
      Build.poster('values_teamwork', { pos: [-4.2, 1.6, -9.84], w: 0.5, worn: 0.1 });
      Build.prop('bin', { pos: [2.9, 0, -8.8], kind: 'street', scale: 0.6 });
      Build.prop('phone_box', { pos: [-2.05, 1.0, -7.3], yaw: 0.3 });
      Build.decal(Tex.decal('coffee_ring'), { pos: [2.3, 1.001, -7.55], w: 0.12, h: 0.12, floor: true });
      Build.dust({ box: [-6.5, 0.4, -9.5, 6.5, 3.1, -0.5], count: 160, opacity: 0.18, size: 0.015 });
      A.data.phone = landline(A);
      A.data.cracked = Build.prop('phone', { pos: [-1.25, 1.013, -7.62], yaw: 0.4, rot: [0, 0.4, PI], screen: null, cracked: true, dynamic: true });
      A.data.cracked.visible = false;
      // ---- outside: the strip, the footpath, the car park --------------------------------------------------------
      const pave = M('pavers', { color: 0x9a968e }), asph = M('asphalt'), render = M('render', { color: 0xcfc6b4 });
      Build.floor(-40, 0, 40, 3.6, pave, { surface: 'concrete' });
      Build.floor(-60, 3.6, 60, 60, asph, { surface: 'concrete' });
      Build.box(26, 0.14, 0.22, M('concrete', { color: 0xb8b4aa }), { pos: [-0.5, 0, 3.6], solid: false });
      Build.box(22, 0.14, 0.22, M('concrete', { color: 0xb8b4aa }), { pos: [28, 0, 3.6], solid: false });
      const paint = C(0xd8d8cc, { rough: 0.9 });
      for (let bx = -24; bx <= 12; bx += 2.6) { Build.plane(0.1, 5, paint, { pos: [bx, 0.006, 6.3] }); Build.plane(0.1, 5, paint, { pos: [bx, 0.006, 18.5] }); }
      for (let bx = 18; bx <= 30; bx += 2.6) Build.plane(0.1, 5, paint, { pos: [bx, 0.006, 6.3] });
      [['sedan', -20.7, 6.4, 0.02, 0x2a3440], ['hatch', -15.5, 6.2, -0.03, 0xb8b8b4], ['ute', -10.3, 6.6, 0.04, 0xe8e6e0], ['hatch', -4.1, 6.3, -0.02, 0x7a1e22],
        ['sedan', 5.3, 6.4, 0.03, 0x1c1c1e], ['hatch', 10.5, 6.2, 0, 0x3a5a7a], ['van', -18.1, 18.8, PI + 0.03, 0xd8d8d0], ['sedan', -7.7, 18.5, PI - 0.04, 0x5a5a58],
        ['hatch', 0.1, 18.4, PI + 0.02, 0xc9a24a], ['ute', 7.9, 18.7, PI, 0x2e3a2c], ['sedan', 23.2, 6.4, 0, 0x8a8a88]].forEach(([k, cx, cz, yaw, color]) => Build.car(k, { pos: [cx, 0, cz], yaw, color }));
      for (const [lx, lz, light] of [[-11, 12.3, false], [4, 12.3, true], [19, 12.3, true]]) Build.streetlight({ pos: [lx, 0, lz], yaw: PI, kind: 'road', light, beam: light });
      Build.road({ from: [-80, 39.5], to: [80, 39.5], width: 7, lines: 'dashed' });
      for (const px of [-30, -12, 8, 26, 44]) Build.tree('palm', { pos: [px, 0, 45.5], scale: 1.1, seed: px });
      Build.streetlight({ pos: [-4, 0, 35.5], kind: 'road', light: false });
      // neighbours: a closed bakery (shutter down) and a pharmacy with its green cross still lit
      for (const [x0, x1, name] of [[-19, -7.2, 'BAYSIDE BAKERY'], [7.2, 19, 'REDCLIFFE CHEMIST']]) {
        const cx = (x0 + x1) / 2;
        Build.box(x1 - x0, 4.2, 0.3, render, { pos: [cx, 0, -0.2] });
        Build.box(x1 - x0, 0.6, 0.12, C(0x2a2622, { rough: 0.7 }), { pos: [cx, 2.95, 0.02] });
        Build.decal(Tex.text(name, { w: 1024, h: 96, color: '#e8e0cc' }), { pos: [cx, 3.25, 0.09], w: 5.4, h: 0.5 });
        Build.prop('roller_shutter', { pos: [cx, 0, 0], w: (x1 - x0) - 1.4, h: 2.8, open: 0 });
        Build.box(x1 - x0, 0.14, 2.8, C(0xe0dcd2, { rough: 0.8 }), { pos: [cx, 3.1, 1.4], solid: false });
        for (let px = x0 + 1; px < x1; px += 2.6) { Build.box(0.22, 0.02, 0.22, C(0xffffff, { emissive: 0xffe0b0, emissiveIntensity: 1.6 }), { pos: [px, 3.08, 1.4], solid: false }); Build.pool({ pos: [px, 0, 1.6], r: 1.6, color: 0xffd8a0, opacity: 0.16 }); }
      }
      Build.box(0.5, 0.5, 0.05, C(0x10aa40, { emissive: 0x22ff66, emissiveIntensity: 1.2 }), { pos: [12.2, 3.5, 0.1], solid: false });
      Build.box(0.17, 0.5, 0.06, C(0xffffff, { emissive: 0xffffff, emissiveIntensity: 1.5 }), { pos: [12.2, 3.5, 0.1], solid: false });
      Build.box(0.5, 0.17, 0.06, C(0xffffff, { emissive: 0xffffff, emissiveIntensity: 1.5 }), { pos: [12.2, 3.66, 0.1], solid: false });
      // the fascia at a readable glow (over the prop's own lightbox face)
      const fascia = Tex.sign('shopfront', 'REDCLIFFE');
      Build.mesh(new THREE.PlaneGeometry(14.2, 0.76), new THREE.MeshStandardMaterial({ map: fascia, emissive: 0xffffff, emissiveMap: fascia, emissiveIntensity: 0.7, roughness: 0.4 }), { pos: [0, 3.15, 0.226], shadow: false });
      // launch night on the footpath: banner, balloons at the doors, A-frame, the campers' gear
      Build.prop('promo_banner', { pos: [-4.3, 1.85, 0.3], text: 'MIDNIGHT LAUNCH — BE FIRST', w: 3.8, drop: 0.85 });
      Build.prop('a_frame', { pos: [2.6, 0, 2.6], yaw: -0.5, poster: 'promo_launch' });
      Build.prop('queue_barrier', { pos: [0, 0, 0], points: [[14.1, 2.2], [14.1, 6.2], [14.1, 10.2], [14.1, 13.4]] });
      Build.prop('queue_barrier', { pos: [0, 0, 0], points: [[15.5, 2.2], [15.5, 6.2], [15.5, 10.2], [15.5, 13.4]] });
      Build.prop('chair', { pos: [12.1, 0, 2.35], yaw: -PI / 2 - 0.3, kind: 'folding' });
      Build.prop('esky', { pos: [12.8, 0, 2.9], yaw: 0.4 });
      Build.prop('cardboard_box', { pos: [11.6, 0, 3.0], w: 0.42, h: 0.05, d: 0.42, stack: 2 });
      Build.sign({ pos: [12.7, 0.02, 2.6], yaw: -0.9, tex: Tex.text('FIRST IN LINE\nSINCE 6AM', { w: 512, h: 256, color: '#1a1a1a', bg: '#d8c49a' }), w: 0.6, h: 0.3, post: 0.55 });
      Build.scatter('cans', { box: [3, 1.6, 13, 3.4], count: 14, seed: 5 });
      Build.scatter('paper', { box: [2, 1.8, 14, 3.5], count: 6, seed: 6 });
      Build.prop('bin', { pos: [-1.9, 0, 3.1], kind: 'street' });
      Build.prop('bench', { pos: [-9.5, 0, 2.8], yaw: PI });
      const bal = [], m4 = new THREE.Matrix4(), cols = [], pal = [0xffcf12, 0xfff6dc, 0xffcf12, 0xffe680].map(h => new THREE.Color(h));
      const strings = [];
      for (const s of [-1, 1]) for (let k = 0; k < 7; k++) {
        const a = k * 2.4, top = V(s * 1.32 + Math.cos(a) * 0.17, 2.05 + (k % 3) * 0.14, 0.3 + Math.sin(a) * 0.14), r = 0.1 + (k % 2) * 0.012;
        bal.push(m4.clone().compose(top, new THREE.Quaternion(), V(r, r * 1.2, r))); cols.push(pal[k % 4]);
        strings.push(new THREE.BufferGeometry().setFromPoints([top, V(s * 1.32, 0.95, 0.12)]));
      }
      Build.instanced(new THREE.SphereGeometry(1, 12, 9), C(0xffffff, { rough: 0.25 }), bal, { colors: cols });
      A.add(new THREE.LineSegments(mergeGeometries(strings), new THREE.LineBasicMaterial({ color: 0x9a968e, transparent: true, opacity: 0.3 })));
      // ---- people ------------------------------------------------------------------------------------------------
      A.data.queue = crowd(A);
      A.data.guard = A.char('security_guard', { name: 'security_guard', at: [-1.75, 0, 1.0], yaw: PI / 2 }); A.data.guard.hold('counter', 'r');
      A.data.customer = A.char('customer', { name: 'customer', at: [-1.6, 0, -6.72], yaw: PI });
      // ---- markers --------------------------------------------------------------------------------------------------
      for (const [n, p, y] of [['mk_chase_counter', [-1.6, 0, -8.2], 0], ['mk_luke_counter', [1.6, 0, -8.2], 0], ['mk_customer', [-1.6, 0, -6.72], PI],
        ['mk_customer_side', [-2.6, 0, -6.72], PI], ['mk_next', [0.1, 0, -5.3], PI], ['mk_store_phone', [-0.72, 1.0, -7.52], 0], ['mk_chase_phone', [-0.8, 0, -8.3], 0.3],
        ['mk_luke_phone', [-0.05, 0, -8.25], -0.5], ['mk_luke_lean', [0.15, 0, -8.35], -1.3], ['mk_whiteboard', [-0.95, 0, -9.35], 2.7], ['mk_luke_board', [0.95, 0, -8.55], -1.35], ['mk_door', [-5.9, 0, -9.7], 0],
        ['mk_entrance', [0, 0, 0.6], PI], ['mk_guard', [-1.75, 0, 1.0], PI / 2], ['mk_start', [0, 0, 7], PI], ['mk_eftpos', [-1.2, 1.02, -7.25], 0],
        ['mk_cam_counter', [-1.35, 1.52, -5.6], 0], ['mk_cam_luke', [1.9, 1.5, -5.7], 0], ['mk_cam_store', [5.6, 2.1, -0.8], 0], ['mk_cam_demo', [-2.3, 1.25, -2.4], 0],
        ['mk_cam_door_in', [0.4, 1.7, -3.6], 0], ['mk_cam_queue_out', [3.6, 1.62, 4.1], 0], ['mk_cam_queue_look', [10, 1.4, 1.3], 0], ['mk_cam_grab', [7.4, 1.6, 3.6], 0]]) A.marker(n, p, y);
    },
    unload(A) {
      if (A.data.murmur) A.data.murmur.stop(0.5);
      st.infinite = false;
      for (const c of Chars.all) if (c.held && c.held('r') === A.data.phone.hs) c.drop('r', { remove: true });   // a cancelled scene may leave the handset in a hand
    },
  };

  // ---- TITLE: the same store ten years on, dawn ---------------------------------------------------------------------
  CONTENT.levels.TITLE = {
    name: 'Optus Redcliffe — ten years on', origin: [0, 0, 0],
    grade: 'title_dawn', fog: { color: 0x8c8272, near: 12, far: 66 }, background: 0xc8b494, amb: 'title_dawn', surface: 'tile',
    env: { top: 0x4a5664, horizon: 0x9a8468, bottom: 0x2a261e, intensity: 0.42, spots: [{ dir: [0.45, 0.3, 1], color: 0xffb070, power: 4 }] },
    build(A) {
      store(A, true);
      const fin = Save.data.finished, end = Save.data.lastEnding, R = U.rng(5);
      // dawn: a low sun through the smashed shopfront, a shaft through the collapsed ceiling bay, deep cool shade elsewhere
      Build.hemi({ sky: 0x7d93b4, ground: 0x2a2418, intensity: 0.4 });
      Build.sun({ dir: [0.45, -0.33, -0.83], color: 0xffbe7a, intensity: 7.5, area: 13, target: [0, 0, -5] });
      Build.light('point', { pos: [3.5, 3.0, -3.9], color: 0xffd8a8, intensity: 4.2, distance: 7 });   // the bay's bounce, on the polo's front
      Build.light('point', { pos: [0.5, 2.2, -8.6], color: 0x8a98b0, intensity: 1.5, distance: 7 });
      Build.light('spot', { pos: [-1.2, 3.8, -7.3], target: [-1.2, 1.0, -7.35], color: 0xffe2b8, intensity: 9, distance: 5, angle: 0.32, penumbra: 0.7 });
      // ceiling: tiles around a collapsed bay over the fig tree, exposed purlins, fallen panels
      const ceil = M('plaster', { color: 0x9a927e });
      Build.box(5.35, 0.1, 3.15, ceil, { pos: [-4.475, 3.3, -8.5] }); Build.box(7.75, 0.1, 3.15, ceil, { pos: [3.275, 3.3, -8.5] }); Build.box(1.2, 0.1, 2.17, ceil, { pos: [-1.2, 3.3, -8.99] });
      Build.box(14.3, 0.1, 4.35, ceil, { pos: [0, 3.3, -2.05] });
      Build.box(9.75, 0.1, 2.8, ceil, { pos: [-2.25, 3.3, -5.6] }); Build.box(1.35, 0.1, 2.8, ceil, { pos: [6.45, 3.3, -5.6] });
      for (const x of [3.3, 4.9]) Build.box(0.12, 0.2, 3.2, C(0x4a3c2e, { rough: 0.8 }), { pos: [x, 3.34, -5.6], solid: false });
      Build.box(1.2, 0.03, 0.6, ceil, { pos: [2.6, 0.03, -6.3], rot: [0.06, 0.9, 0.03] });
      Build.box(0.6, 0.03, 1.2, ceil, { pos: [5.4, 0.05, -4.2], rot: [0.1, 0.3, 0.12] });
      Build.box(40, 0.1, 40, C(0x9aaec4, { emissive: 0xd8e4f0, emissiveIntensity: 0.55 }), { pos: [0, 5.6, -5], solid: false, shadow: false });
      // the fig has taken the demo table; vines down the walls and out of the hole; moss, leaf litter, weeds in the cracks
      Build.tree('fig', { pos: [5.0, 0, -6.1], scale: 0.36, seed: 3 });
      Build.vines({ box: [-6.95, 0.6, -9.6, -6.85, 3.3, -0.4], density: 1.3, seed: 11 });
      Build.vines({ box: [6.85, 1.2, -9.6, 6.95, 3.3, -5.0], density: 1.0, seed: 14 });
      Build.vines({ box: [2.6, 3.2, -7.0, 5.8, 3.3, -4.2], density: 1.6, hang: true, seed: 12 });
      Build.vines({ box: [-7.2, 2.6, 0.02, 7.2, 3.6, 0.1], density: 1.1, hang: true, seed: 13 });
      Build.vines({ box: [-6.0, 2.2, -9.84, -3.0, 3.3, -9.8], density: 1.2, hang: true, seed: 15 });
      for (const [x, z, w, h, k, sp] of [[3.6, -5.2, 5.5, 4.5, 'moss_patch', 0], [-1.5, -1.0, 4, 2.5, 'moss_patch', 1.3], [-4.8, -6.5, 3, 3, 'moss_patch', 2.1], [3.2, -4.6, 2.6, 2, 'puddle', 0.4],
        [0.5, -6.0, 3, 2, 'water_stain', 0.8], [-3, -3, 2.5, 2.5, 'stain', 2], [5.5, -7, 2.5, 2, 'moss_patch', 0.7], [-0.8, -8.4, 2.4, 1.2, 'stain', 0]]) Build.decal(k, { pos: [x, 0.004 + R() * 0.002, z], w, h, floor: true, spin: sp });
      Build.decal('water_stain', { pos: [3.2, 2.4, -9.85], w: 2.4, h: 1.8 });
      Build.decal('water_stain', { pos: [-6.93, 2.0, -4.0], yaw: PI / 2, w: 3, h: 2.2 });
      for (const z of [-6.4, -2.4]) Build.decal('stain', { pos: [-6.93, 1.2, z], yaw: PI / 2, w: 3.2, h: 2.3, opacity: 0.6 });
      Build.decal('crack', { pos: [-1.2, 2.3, -9.84], w: 1.2, h: 1.2 });
      Build.scatter('leaves', { box: [-6.5, -9.5, 6.5, 0.5], count: 1400, seed: 2 });
      Build.scatter('leaves', { box: [2.0, -7.5, 6.5, -3.5], count: 700, seed: 7 });
      Build.scatter('glass', { box: [-6.5, -1.6, 6.5, 0.8], count: 90, seed: 3 });
      Build.scatter('paper', { box: [-5, -8, 5, -1], count: 18, seed: 4 });
      Build.scatter('phones', { box: [-2, -7, 3, -1.5], count: 9, seed: 5 });
      Build.scatter('debris', { box: [2.2, -7, 5.8, -4], count: 26, seed: 6 });
      Build.grass({ box: [-7, 0.2, 7, 3.6], count: 900, height: 0.45 });
      Build.grass({ box: [2.6, -7.0, 5.8, -4.2], count: 320, height: 0.3 });
      Build.grass({ box: [-6.8, -9.6, -5.2, -0.5], count: 180, height: 0.22 });
      Build.prop('plant_pot', { pos: [-6.4, 0, -0.6], kind: 'dead', pot: 'planter', s: 1.1, worn: 1 });
      Build.prop('chair', { pos: [0.9, 0, -5.9], yaw: 2.2, kind: 'office', worn: 1 });
      Build.prop('queue_post', { pos: [-0.62, 0.12, -2.2], worn: 1, rot: [0, 0.4, PI / 2 - 0.05] });
      Build.prop('queue_post', { pos: [0.85, 0, -3.3], worn: 1 });
      Build.prop('promo_banner', { pos: [-4.6, 0.12, -6.4], rot: [-1.35, 0.5, 0], text: 'MIDNIGHT LAUNCH — BE FIRST', w: 3.4, drop: 0.3, worn: 1 });
      Build.prop('cardboard_box', { pos: [-4.6, 0, -8.8], w: 0.5, h: 0.35, d: 0.4, open: true, worn: 1 });
      Build.prop('whiteboard', { pos: [0, 1.28, -9.86], stand: false, w: 1.5, h: 0.95, text: 'b:MIDNIGHT LAUNCH\nCHASE 312\nLUKE 190\nr:TARGET 312', worn: 0.6 });
      // outside: the car park gone to grass, a dead hatch, gum trees in the sun
      Build.floor(-40, 0, 40, 40, M('asphalt', { color: 0x7a7a70 }));
      Build.grass({ box: [-20, 3.6, 20, 22], count: 2600, height: 0.6 });
      Build.car('hatch', { pos: [3.5, 0, 7.2], yaw: 0.25, color: 0x8a3a2a, wrecked: true });
      Build.tree('gum', { pos: [-6, 0, 12], scale: 1.1, seed: 8 }); Build.tree('gum', { pos: [11, 0, 16], seed: 9 });
      Build.streetlight({ pos: [4, 0, 12.3], yaw: PI, kind: 'road', on: false, pool: false });
      // god rays: the collapsed bay and the smashed glass; dust turning in the beams
      Build.godray({ pos: [4.2, 3.5, -5.6], dir: [0.1, -1, 0.15], w: 2.6, h: 4.4, color: 0xffd6a0, opacity: 0.5 });
      Build.godray({ pos: [-3.2, 3.0, 0.4], dir: [0.45, -0.33, -0.83], w: 1.8, h: 8, color: 0xffc080, opacity: 0.2 });
      Build.godray({ pos: [0.8, 3.0, 0.4], dir: [0.45, -0.33, -0.83], w: 1.6, h: 7, color: 0xffc080, opacity: 0.16 });
      Build.godray({ pos: [-1.2, 3.35, -7.4], dir: [0.02, -1, 0.03], w: 0.8, h: 2.4, color: 0xffe6c0, opacity: 0.3 });
      Build.dust({ box: [-2, 0.3, -8, 6, 3.2, -1], count: 420, opacity: 0.6, size: 0.018, color: 0xffe8c8 });
      // the hanger over the counter; the polo on it sways in the breeze from the broken window (gone after the story)
      const hang = new THREE.Group(); hang.position.set(3.3, 2.58, -4.7); A.group.add(hang);
      const wire = C(0x8a8a88, { rough: 0.4, metal: 0.8 });
      Build.box(0.012, 0.66, 0.012, wire, { pos: [3.3, 2.62, -4.7], solid: false });
      Build.mesh(new THREE.TorusGeometry(0.035, 0.004, 4, 12, PI * 1.5), wire, { parent: hang, pos: [0, 0.03, 0] });
      Build.mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.46, 4), wire, { parent: hang, pos: [0, -0.1, 0], rot: [0, 0, PI / 2] });
      if (!fin) Build.mesh(poloGeo(), M('fabric', { color: 0xe6d488 }), { parent: hang, pos: [0, -0.1, 0], shadow: true });
      A.update((dt, t) => { hang.rotation.z = Math.sin(t * 0.7) * 0.07 + Math.sin(t * 1.9) * 0.02; hang.rotation.y = 0.5 + Math.sin(t * 0.45) * 0.3; });
      // two mynas on the counter
      const birds = [[-1.9, 1.0, -7.25, 0.8], [0.45, 2.07, -9.82, -0.3]].map(([x, y, z, yaw]) => {
        const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = yaw; A.group.add(g);
        Build.mesh(new THREE.SphereGeometry(0.05, 8, 6).scale(0.8, 0.8, 1.3), C(0x4a3a2c, { rough: 0.8 }), { parent: g, pos: [0, 0.07, 0] });
        const head = Build.mesh(new THREE.SphereGeometry(0.03, 8, 6), C(0x1a1612, { rough: 0.7 }), { parent: g, pos: [0, 0.12, 0.055] });
        Build.mesh(new THREE.ConeGeometry(0.009, 0.03, 5).rotateX(PI / 2), C(0xe8c020, { rough: 0.5 }), { parent: head, pos: [0, -0.004, 0.035] });
        Build.mesh(new THREE.BoxGeometry(0.04, 0.008, 0.08), C(0x2a2018), { parent: g, pos: [0, 0.06, -0.08], rot: [0.4, 0, 0] });
        return head;
      });
      A.update((dt, t) => birds.forEach((h, i) => { const k = Math.floor(t * 0.8 + i * 3.7); h.rotation.y = Math.sin(k * 12.9898) * 0.9; h.rotation.x = Math.sin(k * 4.1) > 0.7 ? 0.5 : 0; }));
      if (fin && end === 'A') {
        const pet = new THREE.Group(); pet.position.set(-1.1, 1.0, -7.3); pet.rotation.set(-0.2, 0.5, 0.15); A.group.add(pet);
        Build.mesh(new THREE.SphereGeometry(0.045, 12, 10).scale(1, 1.2, 0.55), C(0x6ab8d8, { rough: 0.35 }), { parent: pet, pos: [0, 0.05, 0] });
        const face = Build.mesh(new THREE.PlaneGeometry(0.036, 0.03), C(0x0a1a10, { emissive: 0x9aff9a, emissiveIntensity: 0.9 }), { parent: pet, pos: [0, 0.055, 0.026] });
        let next = 3;
        A.update((dt, t) => { if (t > next) { next = t + 6 + R() * 8; Audio.sfx('chirp', { pos: pet.getWorldPosition(V(0, 0, 0)), vol: 0.5 }); } face.material.emissiveIntensity = 0.7 + 0.3 * Math.sin(t * 3); });
      }
      if (fin && end === 'B') for (const [mx, mz, c] of [[-1.25, -7.35, 0xe8e2d6], [-0.95, -7.2, 0x2a4a6a]]) {
        Build.mesh(new THREE.CylinderGeometry(0.042, 0.038, 0.1, 14), C(c, { rough: 0.4 }), { pos: [mx, 1.05, mz] });
        Build.mesh(new THREE.TorusGeometry(0.028, 0.007, 6, 10, PI), C(c, { rough: 0.4 }), { pos: [mx + 0.045, 1.05, mz], rot: [0, 0, -PI / 2] });
      }
      // a slow live drift from inside the smashed front toward the counters and back, tilting up to the polo in the light; the
      // fig frames the right, the menu sits over the shaded west wall
      const pos = V(0, 0, 0), target = V(0, 0, 0);
      Director.manual({ pos, target, fov: U.lensToFov(35) });
      const P0 = V(4.4, 1.45, -0.3), T0 = V(0.4, 1.4, -9.0), P1 = V(3.95, 1.43, -0.9), T1 = V(0.2, 1.62, -9.0);
      A.update((dt, t) => {
        const k = (1 - Math.cos(t * 0.045)) / 2, w = Math.sin(t * 0.13);
        pos.lerpVectors(P0, P1, k).y += w * 0.04; target.lerpVectors(T0, T1, k);
      });
    },
    unload() { Director.manual(null); },
  };

  // a polo shirt on a hanger: flat front/back panels with sleeves, slightly billowed
  function poloGeo() {
    const s = new THREE.Shape();
    s.moveTo(-0.07, 0.2); s.lineTo(-0.2, 0.17); s.lineTo(-0.31, 0.05); s.lineTo(-0.25, -0.01); s.lineTo(-0.19, 0.06);
    s.lineTo(-0.2, -0.46); s.lineTo(0.2, -0.46); s.lineTo(0.19, 0.06); s.lineTo(0.25, -0.01); s.lineTo(0.31, 0.05); s.lineTo(0.2, 0.17); s.lineTo(0.07, 0.2);
    s.quadraticCurveTo(0, 0.14, -0.07, 0.2);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.012, bevelSegments: 2, curveSegments: 6 });
    g.translate(0, 0, -0.03);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i), x = p.getX(i); p.setZ(i, p.getZ(i) * (1 + (0.2 - y) * 1.2) + Math.sin(x * 9 + y * 5) * 0.012); }
    g.computeVertexNormals();
    return g;
  }

  // ---- scene P.1 — Midnight Launch ---------------------------------------------------------------------------------
  // Chase/Customer exchange: camera on the +X side of their line (the dolly's side, clear of the POS monitor). Chase/Luke: camera on the shop floor (+Z).
  const chime = (t, at, vol = 0.45) => ({ t, sfx: 'notif_chime', at, vol });
  CONTENT.scenes['P.1'] = {
    title: 'Midnight Launch', area: 'P1', grade: 'launch_night', music: null,
    cast: { chase: { at: 'mk_chase_counter', def: 'chase_young' }, luke: { at: 'mk_luke_counter', def: 'luke_young' }, customer: 'mk_customer', next_customer: 'mk_next' },
    start: { cut: true },
    shots: [
      // 1. Black. The murmur of the queue, a notification chime somewhere, the place and the night.
      { cam: { type: 'static', at: [2.2, 7.2, 11.5], look: [0.3, 3.3, 0.2], lens: 24 }, dur: 6.4, focus: null,
        cues: [{ t: 0.3, title: ['REDCLIFFE, QUEENSLAND. LAUNCH NIGHT.'], hold: 2.6 }, chime(0.8, [6, 1.4, 1.4]), chime(2.6, [10, 1.4, 1.3], 0.35), chime(4.3, [3, 1.4, 1.2]), chime(5.9, [14.6, 1.4, 6], 0.3)] },
      // 2. The sign, craning down to the queue: forty faces lit blue, a kid on his dad's shoulders.
      { cam: { type: 'crane', from: [2.2, 7.2, 11.5], to: [3.7, 1.62, 4.3], look: [0.3, 3.3, 0.2], lookTo: [10, 1.35, 1.4], lens: 24, dur: 10 }, dur: 9.4, focus: null,
        cues: [{ t: 0, fade: 'none', dur: 2.5 }, chime(3.2, [8, 1.4, 1.3], 0.4), chime(7.4, [5, 1.4, 1.5], 0.4)] },
      // The Security Guard counts them in: the first click of the game.
      { cam: { type: 'static', at: [1.1, 1.5, 2.2], look: [-1.75, 1.35, 0.95], lens: 35 }, dur: 3.8, focus: 'security_guard',
        actions: [{ t: 0.3, who: 'q0', do: 'walkTo', path: [[0.7, 0, 1.0], [0.15, 0, -0.55]], yaw: PI }, { t: 0.9, who: 'security_guard', do: 'lookAt', at: 'q0' },
          { t: 1.1, who: 'security_guard', do: 'gesture', name: 'hand_over', to: [-1.32, 1.18, 1.2] }],
        cues: [{ t: 1.75, sfx: 'click_counter', at: 'security_guard.hand_r', vol: 0.9 }] },
      // 3. Inside: along the counter to Chase, closing a sale.
      { cam: { type: 'dolly', from: [2.4, 1.48, -6.05], to: [-0.45, 1.5, -6.2], look: 'chase.chest', lens: 35, dur: 6.5 }, hold: 0.3,
        actions: [{ t: 0, who: 'chase', do: 'hold', prop: 'phone' }, { t: 0, who: 'chase', do: 'lookAt', at: 'customer' }, { t: 1.2, who: 'chase', do: 'gesture', name: 'point', to: 'customer' }, { t: 4.6, who: 'chase', do: 'gesture', name: 'nod' }],
        lines: [{ who: 'customer', text: 'And it does the... the video calls?', emote: 'smile', pause: 3.2, to: 'chase' }] },
      { cam: { type: 'ots', over: 'customer', on: 'chase', side: 'right', push: 0.06 },
        lines: [{ who: 'chase', text: "Your grandkids'll be in your hand, mate. Every night if you want.", emote: 'tender', pause: 0.2 }] },
      { cam: { type: 'ots', over: 'chase', on: 'customer' }, hold: 0.9,
        lines: [{ who: 'customer', text: "They don't call now.", emote: 'sad', pause: 0.6 }] },
      { cam: { type: 'ots', over: 'customer', on: 'chase', push: 0.05 }, hold: 0.3,
        actions: [{ t: 1.6, who: 'chase', do: 'gesture', name: 'shrug' }],
        lines: [{ who: 'chase', text: "Then we'll get you a case in their favourite colour. Guilt 'em into it.", emote: 'smirk', pause: 0.5 }] },
      // 4. She laughs and signs; he hands her the phone and goes to the board. 299 becomes 300.
      { cam: { type: 'static', at: [0.75, 1.38, -7.0], look: [-1.6, 1.25, -7.45], lens: 40 }, dur: 3.6, focus: 'customer',
        actions: [{ t: 0, who: 'customer', do: 'emote', name: 'laugh' }, { t: 0.2, who: 'chase', do: 'emote', name: 'smile' }, { t: 0.9, who: 'customer', do: 'gesture', name: 'point', to: 'mk_eftpos' },
          { t: 2.1, who: 'chase', do: 'give', prop: 'phone', to: 'customer' }, { t: 3.3, who: 'chase', do: 'lookAt', at: null }],
        cues: [{ t: 1.4, sfx: 'typing_tap', at: 'mk_eftpos', vol: 0.5 }, { t: 1.7, sfx: 'typing_tap', at: 'mk_eftpos', vol: 0.5 }] },
      { cam: { type: 'static', at: [0.3, 1.58, -7.25], look: [-0.25, 1.5, -9.9], lens: 35 }, dur: 4.2, focus: 'chase',
        actions: [{ t: 0, who: 'chase', do: 'walkTo', at: 'mk_whiteboard', yaw: PI }, { t: 0.2, who: 'customer', do: 'emote', name: 'smile' },
          { t: 1.7, who: 'chase', do: 'gesture', name: 'point', to: [-0.5, 1.66, -9.86] }, { t: 2.3, do: 'call', hook: 'p1.board', args: 300 }, { t: 3.3, who: 'chase', do: 'turnTo', to: 'luke' },
          { t: 1.9, who: 'luke', do: 'walkTo', at: 'mk_luke_board', yaw: -1.35 }] },
      { cam: { type: 'static', at: [0.0, 1.56, -6.4], look: [0.0, 1.45, -9.0], lens: 32, push: 0.04 }, hold: 0.7,
        lines: [{ who: 'luke', text: 'Three hundred.', emote: 'smirk', pause: 0.4 }, { who: 'chase', text: 'Three-twelve by midnight.', emote: 'smile' },
          { who: 'luke', text: "It's eleven-forty.", emote: 'neutral' }, { who: 'chase', text: 'Then stop talking to me.', emote: 'smirk', pause: 0.4 }] },
      // 5. The store phone. Luke answers, rolls his eyes, holds it out.
      { cam: { type: 'static', at: [1.1, 1.5, -5.4], look: [-0.45, 1.15, -8.3], lens: 35 }, dur: 7.2, focus: 'luke',
        actions: [{ t: 0.4, who: 'customer', do: 'walkTo', at: 'mk_customer_side', yaw: PI }, { t: 1.1, who: 'next_customer', do: 'walkTo', at: 'mk_customer', yaw: PI },
          { t: 0.9, who: 'luke', do: 'walkTo', at: 'mk_luke_phone', yaw: -0.5 }, { t: 1.2, who: 'chase', do: 'lookAt', at: 'mk_store_phone' },
          { t: 2.7, do: 'call', hook: 'p1.handset', args: 'luke' }, { t: 2.75, who: 'luke', do: 'pose', name: 'phone_ear' }, { t: 3.7, who: 'luke', do: 'emote', name: 'exhausted' },
          { t: 4.1, who: 'luke', do: 'gesture', name: 'shake_head' }, { t: 3.9, who: 'chase', do: 'walkTo', at: 'mk_chase_phone', yaw: 0.3 }, { t: 4.1, who: 'chase', do: 'lookAt', at: 'luke' },
          { t: 5.0, who: 'luke', do: 'pose', name: 'stand' }, { t: 5.0, who: 'luke', do: 'gesture', name: 'hand_over', to: 'chase' },
          { t: 5.6, do: 'call', hook: 'p1.handset', args: 'chase' }, { t: 5.65, who: 'chase', do: 'pose', name: 'phone_ear' }, { t: 5.9, who: 'chase', do: 'lookAt', at: null },
          { t: 6.3, who: 'luke', do: 'walkTo', at: 'mk_luke_counter', yaw: -0.35 }, { t: 3.0, who: 'customer', do: 'pose', name: 'phone' }],
        cues: [{ t: 0.3, sfx: 'landline_ring', at: 'mk_store_phone' }, { t: 1.6, sfx: 'landline_ring', at: 'mk_store_phone' }, { t: 2.7, sfx: 'pickup', at: 'mk_store_phone', vol: 0.6 }] },
      { cam: { type: 'static', at: { of: 'chase', off: [-0.74, 1.66, 1.36] }, look: 'chase.eyes', lens: 65, push: 0.05 }, focus: 'chase', hold: 0.3,
        lines: [{ who: 'wai', via: 'phone', text: "Heard a rumour you're chasing the record.", emote: 'smirk', pause: 0.5 }, { who: 'chase', text: "Heard a rumour you're not.", emote: 'smirk' },
          { who: 'wai', via: 'phone', text: "Queen Street's on two-sixty. We've got the foot traffic, mate. You've got pensioners and seagulls.", emote: 'smirk' },
          { who: 'chase', text: 'Pensioners buy phones.', emote: 'smile' }] },
      { cam: { type: 'static', at: { of: 'luke', off: [0.35, 1.6, 1.4] }, look: 'luke.eyes', lens: 50 }, focus: 'luke', hold: 0.2,
        actions: [{ t: 0.2, who: 'luke', do: 'lookAt', at: 'chase' }, { t: 0.4, who: 'luke', do: 'emote', name: 'smirk' }, { t: 1.2, who: 'luke', do: 'gesture', name: 'adjust_cap' }],
        lines: [{ who: 'wai', via: 'phone', text: 'Pensioners buy one phone. Every five years.', emote: 'smirk' }] },
      { cam: { type: 'static', at: { of: 'chase', off: [-0.72, 1.66, 1.3] }, look: 'chase.eyes', lens: 65, push: 0.07 }, focus: 'chase', hold: 0.5,
        lines: [{ who: 'chase', text: "Then I'll sell 'em two.", emote: 'smile', pause: 0.2 }, { who: 'wai', via: 'phone', text: "Three-twelve and I'll believe it. Head office'll want a photo.", emote: 'laugh' },
          { who: 'chase', text: 'Get your camera ready.', emote: 'smirk' }] },
      // 6. He hangs up. His own phone: Bub.
      { cam: { type: 'static', at: [0.2, 1.45, -6.0], look: [-0.8, 1.2, -8.2], lens: 40 }, dur: 3.6, focus: 'chase',
        actions: [{ t: 0.1, who: 'chase', do: 'pose', name: 'stand' }, { t: 0.2, who: 'chase', do: 'gesture', name: 'hand_over', to: 'mk_store_phone' }, { t: 0.75, do: 'call', hook: 'p1.handset', args: 'base' },
          { t: 1.8, who: 'chase', do: 'gesture', name: 'hand_on_pocket' }, { t: 2.3, do: 'call', hook: 'p1.myPhone' }, { t: 2.35, who: 'chase', do: 'pose', name: 'phone' }, { t: 2.9, who: 'chase', do: 'emote', name: 'tender' }],
        cues: [{ t: 0.75, sfx: 'pickup', at: 'mk_store_phone', vol: 0.6 }, { t: 1.5, sfx: 'phone_buzz', at: 'chase.hips', vol: 0.8 }] },
      { cam: { type: 'static', at: { of: 'chase', off: [-0.22, 1.56, 1.0] }, look: 'chase.hand_r', lens: 45 }, dur: 5.6, focus: 'chase.hand_r',
        actions: [{ t: 0, do: 'call', hook: 'p1.type' }, { t: 0.6, who: 'chase', do: 'gesture', name: 'type_phone', dur: 3.6 }] },
      { cam: { type: 'ots', over: 'chase', on: 'luke', side: 'right' }, hold: 0.2,
        actions: [{ t: 0, who: 'luke', do: 'walkTo', at: 'mk_luke_lean', yaw: -1.3 }, { t: 1.0, who: 'chase', do: 'lookAt', at: 'luke' }],
        cues: [{ t: 0, ui: { phone: null } }],
        lines: [{ who: 'luke', text: "You gave her one, didn't you. The pre-release.", emote: 'smirk', pause: 1.3 }] },
      { cam: { type: 'ots', over: 'luke', on: 'chase' }, hold: 0.3,
        lines: [{ who: 'chase', text: 'Early birthday.', emote: 'tender', pause: 0.3 }] },
      { cam: { type: 'ots', over: 'chase', on: 'luke' }, hold: 0.2,
        lines: [{ who: 'luke', text: "Store'll crucify you.", emote: 'tense', pause: 0.3 }] },
      { cam: { type: 'ots', over: 'luke', on: 'chase', push: 0.05 }, hold: 0.5,
        lines: [{ who: 'chase', text: "Store's not gonna know.", emote: 'smirk', pause: 0.3 }] },
      // 7. The Store Manager, from the back office. Badge straight, and the smile for the next customer.
      { cam: { type: 'static', at: [-0.8, 1.6, -5.25], look: [-1.6, 1.5, -8.2], lens: 45, push: 0.04 }, dur: 5.4, focus: 'chase',
        actions: [{ t: 0.5, who: 'chase', do: 'lookAt', at: [-5.9, 1.6, -10.6] }, { t: 0.6, who: 'luke', do: 'lookAt', at: [-5.9, 1.6, -10.6] }, { t: 1.6, who: 'chase', do: 'pose', name: 'stand' },
          { t: 1.7, do: 'call', hook: 'p1.pocket' }, { t: 1.9, who: 'chase', do: 'gesture', name: 'pull_collar' }, { t: 2.2, who: 'luke', do: 'walkTo', at: 'mk_luke_counter', yaw: 0 },
          { t: 2.6, who: 'chase', do: 'walkTo', at: 'mk_chase_counter', yaw: 0 }, { t: 3.4, who: 'chase', do: 'lookAt', at: 'next_customer' }, { t: 3.6, who: 'chase', do: 'emote', name: 'smile' }],
        lines: [{ who: 'store_manager', off: true, text: 'Chase! Customer!', emote: 'angry', pause: 0.2 }] },
    ],
    end: { place: { chase: 'mk_chase_counter', luke: 'mk_luke_counter', customer: 'mk_customer_side', next_customer: 'mk_customer' }, pose: { chase: 'stand', luke: 'stand' }, call: { hook: 'p1.settle' } },
    exit: { hold: true },   // hard cut: prologue.P2 builds the house behind this frame and cuts straight to Bub
  };

  // ---- hooks --------------------------------------------------------------------------------------------------------
  const H = CONTENT.hooks, P1 = () => Game.areas.get('P1');

  H['prologue.P1'] = async G => {
    G.fade('black', 0);
    UI.hud({ show: false });
    G.unload('P1');                                   // always a fresh store: a retry may come from the 11:59 state
    const A = await G.area('P1');
    const chase = G.actor('chase', 'chase_young', 'mk_chase_counter'), luke = G.actor('luke', 'luke_young', 'mk_luke_counter');
    for (const c of [chase, luke]) { c.drop('r', { remove: true }); c.pose('stand'); }
    if (G.actors.bub) G.actors.bub.setVisible(false);
    G.control(false);
    if (!A.data.murmur) A.data.murmur = Audio.loop('crowd_murmur', { pos: V(7, 1.5, 2), vol: 0.9 });
    await G.scene('P.1');
  };

  // Luke picks up the handset / hands it to Chase / Chase hangs up
  H['p1.handset'] = (G, to) => {
    const A = P1(), ph = A && A.data.phone; if (!ph) return;
    for (const id of ['luke', 'chase']) { const c = G.who(id); if (c && c.held('r') === ph.hs) c.drop('r', { remove: true }); }
    if (to === 'base') ph.cradle(); else G.who(to).hold(ph.hs, 'r');
  };
  H['p1.settle'] = G => {
    const A = P1(); if (!A) return;
    H['p1.handset'](G, 'base'); A.data.board.userData.setText(BOARD(300));
    const c = G.who('chase'); c.drop('r', { remove: true }); c.lookAt(null); UI.phone(null);
    if (!A.data.customer.held('r')) A.data.customer.hold('phone');
  };
  H['p1.board'] = (G, n) => { const A = P1(); if (A) A.data.board.userData.setText(BOARD(n)); };
  H['p1.pocket'] = G => G.who('chase').drop('r', { remove: true });
  H['p1.myPhone'] = G => { G.who('chase').hold('phone').userData.screen.material = lit(); };
  // the insert: Chase's thumbs answer Bub on the phone overlay
  H['p1.type'] = async G => {
    const base = { kind: 'messages', title: 'Bub', time: PHONE_T, lines: [{ stamp: 'Today 11:39 PM' }, { from: 'them', text: 'wat time u home' }] };
    const msg = 'after midnight. go to bed. love u', live = () => Director.sceneId === 'P.1';
    UI.phone(Object.assign({ draft: '', caret: true }, base));
    await G.wait(0.7);
    for (let i = 1; i <= msg.length && live(); i++) {
      await G.wait(msg[i - 1] === ' ' ? 0.16 : 0.07 + (i % 5) * 0.012);
      if (!live()) return;
      UI.phone(Object.assign({ draft: msg.slice(0, i), caret: true }, base));
      if (i % 2) G.sfx('typing_tap', { vol: 0.4 });
    }
    await G.wait(0.35);
    if (!live()) return;
    UI.phone(Object.assign({}, base, { lines: [...base.lines, { from: 'me', text: msg, status: 'Delivered' }], draft: '', caret: false }));
    G.sfx('send_whoosh', { vol: 0.5 });
  };

  // ---- P.3 support: the store at 11:59 ------------------------------------------------------------------------------
  H['p1.infinite'] = G => {
    const A = P1(); if (!A) return;
    st.infinite = true;
    if (A.data.murmur) { A.data.murmur.stop(1); A.data.murmur = null; }
    if (Game.area === A) Audio.amb('lab', 1);
    for (const t of A.data.demo) t.userData.setScreens('feed');
    for (const c of A.data.queue) {
      if (!c.held('r')) c.hold('phone');
      if (c.poseName !== 'sit') c.pose('phone');
      c.phoneGlow(true); c.lookAt(null); c.emote('neutral');
    }
    const kid = A.data.kid; kid.phoneGlow(true);
    const nx = G.who('next_customer'); if (nx) { G.place(nx, 'mk_next'); nx.hold('phone'); nx.pose('phone'); nx.phoneGlow(true); }
    const cu = A.data.customer;
    G.place(cu, 'mk_customer');
    cu.hold('phone'); cu.pose('phone'); cu.phoneGlow(true); cu.decal('feed_eyes', true); cu.emote('shocked'); cu.lookAt(null);
    A.data.guard.lookAt(null); A.data.guard.emote('neutral');
  };
  H['p1.grab'] = G => {
    const A = P1(); if (!A) return;
    const [a, b] = A.data.grab, t0 = Game.time, at = s => G.until(() => Game.time - t0 > s);
    a.lookAt(b); a.pose('stand'); a.turnTo(b, 0.25); a.gesture('grab');
    b.phoneGlow(false); b.pose('stand'); b.turnTo(a, 0.4); b.lookAt(a);
    at(0.35).then(() => { b.emote('afraid'); b.gesture('struggle', { dur: 2.2 }); a.gesture('point', { to: b.point('eyes').add(V(0, -0.03, 0)), hold: true }); });
    at(2.6).then(() => { b.lookAt(null); b.emote('neutral'); b.decal('feed_eyes', true); b.pose('phone'); b.phoneGlow(true); });
    at(3.6).then(() => { a.gesture(null); a.lookAt(null); a.turnTo(-PI / 2 + 0.2, 0.8); a.pose('phone'); });
  };
  H['p1.chasePhone'] = (G, o = {}) => {
    const c = G.who('chase'), p = c.hold('phone'), m = new THREE.MeshBasicMaterial({ map: Tex.screen('installing', { pct: o.pct ?? 42 }), color: new THREE.Color(1.4, 1.5, 1.8), toneMapped: false });
    p.userData.screen.material = m; p.userData.disposeMat = m;
  };
  H['p1.slamPhone'] = G => {
    const A = P1(), c = G.who('chase');
    c.drop('r', { remove: true });
    if (A) A.data.cracked.visible = true;
  };
})();
