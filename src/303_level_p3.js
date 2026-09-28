// ============================================================================
// Area P3 — Redcliffe streets by car — and the beat prologue.P5 "The Drive" (spec §8 P.5). Owned by: level agent (drive).
// The player is Bub in the back seat behind Luke (right-hand drive; Chase in the front passenger seat, twisted round to
// watch her). Camera only: Play.lookMode from her eye point in a car that follows a ~1.1 km spline at 35–45 km/h (~2 min):
// the esplanade along the bay (palms, heritage lamps, people standing in the road, a jogger stopped mid-stride, the jetty
// lined with blue faces), the shops, the suburbs (a family frozen on a porch, a dog barking at its owner, a stopped bus
// of blue faces, police lights and sirens far off, an INFINITE billboard), a servo, and the roundabout where a truck runs
// it. Far ahead, over black water, the lights of the Houghton Highway bridge. No HUD, no letterbox; lines play with G.say,
// timed by distance along the route. The hook ends on black and silence (the flow goes on to prologue.P6).
//
// How it works: the car (a hollow cabin: seats, dash, glowing gauges and radio, glass) moves in an area updater; the
// three actors are not parented to it, their roots are set from the car every frame (Chars' LOD and look-at stay in world
// space), Luke's hands are pinned to the wheel through c.ikT. Play.camPose is carried along by the car's frame delta
// (Play.update runs before area updaters). The one shadow-casting light is a spot that jumps to the street lamp nearest
// the car and fades to nothing midway between lamps, so each lamp sweeps through the cabin. Bub's head is hidden and her
// body clipped above the collar (clipping plane) while she is the camera. Statics are merged into 96 m cells and culled
// past the fog; far crowds are instanced impostors.
//
//   A.data.s / A.data.v   distance along the route (m) / car speed (m/s) · A.data.car  the car Group (area-local, yaw only)
//   Markers: mk_start (dev free-roam: the esplanade footpath) · mk_p3_crash (the roundabout impact point) ·
//            mk_p3_servo (the servo forecourt glimpsed just before the roundabout; P.6 runs through a servo)
// ============================================================================
(() => {
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const UP = V(0, 1, 0), PI = Math.PI;
  // ---- route: centreline control points (area-local x, z); the car keeps left ----------------------------------------
  const CP = [[0, -80], [0, 170], [-3, 320], [-16, 450], [-44, 580], [-78, 710], [-101, 840], [-112, 970], [-115, 1180]];
  const S0 = 55, S_ROAD1 = 118, S_JOG = 150, S_JETTY = 214, S_CAFE = 262, S_CLUSTER = 372, S_ESP = 468, S_PORCH = 568, S_DOG = 616, S_BUS = 716;
  const S_TALK = 826, S_BOARD = 872, S_SERVO = 962, S_RB = 1018, K_TRUCK = 1.8;
  const LANE = 1.75, ROAD = 5, SPACING = 27;
  const X_STREETS = [[522, -1, 'MARINE PDE'], [664, 1, 'SUTTONS AVE'], [812, -1, 'ANZAC AVE']];
  // car-local frame: +Z forward, +X = the car's LEFT (passenger side), cabin floor at y 0.28
  const SEATS = { luke: { at: [-0.38, 0.2, 0.34], yaw: 0, pose: 'drive' }, chase: { at: [0.3, 0.2, 0.38], yaw: -0.95, pose: 'sit_car' }, bub: { at: [-0.37, 0.3, -0.74], yaw: 0, pose: 'sit_car' } };
  const EYE = [-0.37, 1.25, -0.72], WHEEL = [-0.38, 0.87, 0.8], RADIO = [0, 0.8, 1.02], WINDOW = [-0.772, 1.13, -0.6];

  // ---- route sampling ------------------------------------------------------------------------------------------------
  let R = null;
  function route() {
    if (R) return R;
    const c = new THREE.CatmullRomCurve3(CP.map(p => V(p[0], 0, p[1])), false, 'centripetal'), len = c.getLength(), n = Math.ceil(len) + 2;
    R = { len, px: new Float32Array(n), pz: new Float32Array(n), tx: new Float32Array(n), tz: new Float32Array(n) };
    for (let i = 0; i < n; i++) { const u = Math.min(1, i / len), p = c.getPointAt(u), t = c.getTangentAt(u); R.px[i] = p.x; R.pz[i] = p.z; R.tx[i] = t.x; R.tz[i] = t.z; }
    return R;
  }
  // point at distance s, lateral offset u (+ = left of travel): {x, z, yaw (of travel), tx, tz}
  function at(s, u = 0, o = {}) {
    const f = U.clamp(s, 0, R.len), i = Math.min(Math.floor(f), R.px.length - 2), k = f - i;
    let tx = R.tx[i] + (R.tx[i + 1] - R.tx[i]) * k, tz = R.tz[i] + (R.tz[i + 1] - R.tz[i]) * k; const l = Math.hypot(tx, tz); tx /= l; tz /= l;
    o.x = R.px[i] + (R.px[i + 1] - R.px[i]) * k + tz * u; o.z = R.pz[i] + (R.pz[i + 1] - R.pz[i]) * k - tx * u;
    o.yaw = Math.atan2(tx, tz); o.tx = tx; o.tz = tz; return o;
  }
  const P3 = (s, u, y = 0) => { const p = at(s, u); return [p.x, y, p.z]; };
  const faceRoad = (s, u) => { const p = at(s); return u < 0 ? Math.atan2(p.tz, -p.tx) : Math.atan2(-p.tz, p.tx); };
  const frame = (s, u, yaw, y = 0) => new THREE.Matrix4().compose(V(...P3(s, u, y)), new THREE.Quaternion().setFromAxisAngle(UP, yaw ?? faceRoad(s, u)), V(1, 1, 1));
  // the car's plan: speed and lateral offset by route distance
  const VP = [[0, 10.5], [S_CLUSTER - 80, 10.5], [S_CLUSTER - 14, 1.7], [S_CLUSTER + 8, 1.5], [S_CLUSTER + 50, 11], [S_RB - 80, 11.5], [S_RB - 30, 9], [S_RB + 60, 9]];
  function vPlan(s) { for (let i = 1; i < VP.length; i++) if (s < VP[i][0]) { const a = VP[i - 1], b = VP[i]; return U.lerp(a[1], b[1], U.smooth((s - a[0]) / (b[0] - a[0]))); } return VP[VP.length - 1][1]; }
  const bump = (s, c, w, a) => Math.abs(s - c) < w ? a * 0.5 * (1 + Math.cos(PI * (s - c) / w)) : 0;
  const lat = s => LANE + bump(s, S_ROAD1, 22, -1.2) + bump(s, S_CLUSTER, 42, -1.95);

  // ---- geometry helpers ----------------------------------------------------------------------------------------------
  // collects geometry per material (optionally under a base matrix); flush() makes one mesh per material, merged() the geometries
  function batcher() {
    const parts = new Map(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    const put = (g, m) => { if (B.base) g.applyMatrix4(B.base); (parts.get(m) || parts.set(m, []).get(m)).push(g); return g; };
    const B = {
      base: null,
      add: (g, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => put(g.applyMatrix4(m4.compose(V(x, y, z), q.setFromEuler(e.set(rx, ry, rz, 'YXZ')), V(1, 1, 1))), m),
      box: (m, w, h, d, x, y, z, rx, ry, rz) => B.add(new THREE.BoxGeometry(w, h, d), m, x, y, z, rx, ry, rz),
      rbox: (m, w, h, d, r, x, y, z, rx, ry, rz) => B.add(new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2)), m, x, y, z, rx, ry, rz),
      cyl: (m, r1, r2, h, x, y, z, rx, ry, rz, seg = 10) => B.add(new THREE.CylinderGeometry(r1, r2, h, seg), m, x, y, z, rx, ry, rz),
      plane: (m, w, h, x, y, z, rx, ry, rz) => B.add(new THREE.PlaneGeometry(w, h), m, x, y, z, rx, ry, rz),
      strut: (m, a, b, w, t) => put(new THREE.BoxGeometry(w, t, a.distanceTo(b)).applyMatrix4(m4.lookAt(b, a, UP).setPosition(a.clone().add(b).multiplyScalar(0.5))), m),
      side: (m, x, pts) => put(new THREE.ShapeGeometry(new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], p[1])))).rotateY(-PI / 2).translate(x, 0, 0), m),   // polygon [z, y] in the plane x
      quad(m, a, b, c, d) { const g = new THREE.BufferGeometry().setFromPoints([a, b, c, a, c, d]); g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], 2)); g.computeVertexNormals(); return put(g, m); },
      merged() {
        const out = new Map();
        for (const [m, gs] of parts) { const list = gs.some(g => !g.index) ? gs.map(g => g.index ? g.toNonIndexed() : g) : gs; out.set(m, list.length > 1 ? mergeGeometries(list) : list[0]); }
        parts.clear(); B.base = null; return out;
      },
      flush(parent, o = {}) { for (const [m, g] of B.merged()) { const me = new THREE.Mesh(g, m); me.castShadow = o.shadow ?? !m.transparent; me.receiveShadow = !m.transparent; parent.add(me); } },
    };
    return B;
  }
  // a strip along the route between lateral offsets u0 -> u1 at heights y0 -> y1 (uv in metres)
  function strip(u0, u1, y0, y1, s0, s1, step = 2) {
    const pos = [], uv = [], idx = [], w = Math.hypot(u1 - u0, y1 - y0);
    for (let s = s0, n = 0; ; s = Math.min(s1, s + step), n++) {
      const a = at(s, u0), b = at(s, u1);
      pos.push(a.x, y0, a.z, b.x, y1, b.z); uv.push(0, s, w, s);
      if (n) { const i = (n - 1) * 2; idx.push(i, i + 2, i + 1, i + 1, i + 2, i + 3); }
      if (s >= s1) break;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.userData.draw = () => { draw(c.getContext('2d'), w, h); t.needsUpdate = true; }; t.userData.draw(); return t; }
  const soft = () => canvasTex(64, 64, (g, w, h) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, '#fff'); r.addColorStop(0.3, 'rgba(255,255,255,0.4)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, w, h); });
  const additive = (map, color, o = {}) => new THREE.MeshBasicMaterial(Object.assign({ map, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }, o));
  const hdr = (hex, k) => new THREE.Color(hex).multiplyScalar(k);
  const pickR = (r, a) => a[(r() * a.length) | 0];

  // ---- impostor crowds: frozen figures bowed over glowing phones (instanced; faces lit from below by the screen) -------
  const CLOTH = [0x2a3040, 0x3a2a2a, 0x2a3a2e, 0x4a4a52, 0x1c1c20, 0x5a4a3a, 0x6a6a70, 0x30384a, 0x7a5a4a, 0x28282c, 0x8a8478];
  const fig = (list, pos, yaw, r) => list.push({ m: new THREE.Matrix4().compose(V(...pos), new THREE.Quaternion().setFromAxisAngle(UP, yaw), V(1, 1, 1).multiplyScalar(0.9 + r() * 0.18)), c: pickR(r, CLOTH), k: 0.55 + r() * 0.6 });
  function crowd(A, list) {
    const B = batcher();
    for (const x of [-0.095, 0.095]) B.box('b', 0.13, 0.84, 0.15, x, 0.42, 0);
    B.box('b', 0.36, 0.6, 0.22, 0, 1.13, 0.01, 0.12); B.box('b', 0.1, 0.12, 0.1, 0, 1.47, 0.06);
    for (const s of [-1, 1]) { B.strut('b', V(s * 0.2, 1.38, 0.03), V(s * 0.21, 1.13, 0.1), 0.085, 0.085); B.strut('b', V(s * 0.21, 1.13, 0.1), V(s * 0.05, 1.3, 0.3), 0.07, 0.07); B.box('s', 0.06, 0.09, 0.04, s * 0.045, 1.31, 0.31); }
    B.add(new THREE.SphereGeometry(0.105, 10, 7), 's', 0, 1.6, 0.08);
    B.plane('p', 0.07, 0.14, 0, 1.33, 0.33, PI + 0.82);
    const G = B.merged(), sk = G.get('s'), n = sk.attributes.normal, L = V(0, -0.5, 1).normalize(), col = [];
    for (let i = 0; i < n.count; i++) { const k = Math.pow(Math.max(0, n.getX(i) * L.x + n.getY(i) * L.y + n.getZ(i) * L.z), 2.2) * (n.getY(i) > 0.55 ? 0.15 : 1); col.push(0.02 + 0.14 * k, 0.025 + 0.22 * k, 0.04 + 0.5 * k); }
    sk.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const mats = { b: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), s: new THREE.MeshBasicMaterial({ vertexColors: true }), p: new THREE.MeshBasicMaterial({ color: hdr(0x7ab0ff, 1.6) }) };
    const c = new THREE.Color(), halo = [], ph = V();
    for (const [k, g] of G) {
      const im = new THREE.InstancedMesh(g, mats[k], list.length); im.castShadow = false;
      list.forEach((f, i) => { im.setMatrixAt(i, f.m); if (k !== 'p') im.setColorAt(i, k === 'b' ? c.set(f.c) : c.setScalar(f.k)); });
      im.computeBoundingSphere(); A.group.add(im);
    }
    for (const f of list) { ph.set(0, 1.36, 0.3).applyMatrix4(f.m); halo.push(ph.x, ph.y, ph.z); }
    const hg = new THREE.BufferGeometry(); hg.setAttribute('position', new THREE.Float32BufferAttribute(halo, 3));
    A.group.add(new THREE.Points(hg, new THREE.PointsMaterial({ map: soft(), color: 0x1a3aa0, size: 0.45, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
  }
  // real people (area characters): the frozen launch-night crowd, bowed over their phones, eyes gone wet and red
  function person(A, name, pos, yaw, o = {}) {
    const c = A.char(o.def || 'crowd', { name, at: pos, yaw, seed: o.seed });
    c.hold('phone', 'r'); c.pose('phone', { direct: true, dur: 0.01 }); c.phoneGlow(true); c.decal('feed_eyes');
    A.data.people.push(c); return c;
  }
  const seedOf = (sex, from) => { for (let s = from; ; s++) if (Chars.resolveLook('crowd', { seed: s }).sex === sex) return s; };

  // ---- the car -------------------------------------------------------------------------------------------------------
  function buildCar(A) {
    const D = A.data, car = Build.group({}), body = Build.group({ parent: car });
    car.userData.dynamic = true;
    const B = batcher(), C = Tex.color;
    const paint = C(0x1c2636, { rough: 0.22, metal: 0.65 }), trim = C(0x151517, { rough: 0.7 }), plastic = C(0x26272a, { rough: 0.6 });
    const seat = Tex.mat('fabric', { color: 0x4c4e55, scale: 0.6 }), seat2 = C(0x34363b, { rough: 0.9 }), carpet = Tex.mat('carpet', { color: 0x252527 });
    const lining = C(0xa39e92, { rough: 0.95 }), pillar = C(0x55524c, { rough: 0.95 }), chrome = C(0x9a9ea2, { rough: 0.45, metal: 0.8 });
    // floor, tunnel; the outside we can see from in here: bonnet, cowl and wipers, boot, door tops, mirrors
    B.box(carpet, 1.5, 0.04, 2.9, 0, 0.26, -0.15); B.rbox(carpet, 0.26, 0.14, 2.4, 0.05, 0, 0.3, -0.1);
    B.rbox(paint, 1.72, 0.08, 1.32, 0.03, 0, 0.9, 1.84, 0.085); B.box(paint, 1.7, 0.4, 0.2, 0, 0.72, 2.46); B.box(trim, 1.62, 0.06, 0.26, 0, 0.955, 1.2);
    for (const s of [-1, 1]) { B.box(paint, 0.06, 0.62, 1.3, s * 0.86, 0.64, 1.82); B.box(trim, 0.014, 0.014, 0.72, s * 0.24, 0.99, 1.26, 0, 0.06 * s); }
    B.rbox(paint, 1.68, 0.08, 0.74, 0.03, 0, 0.95, -1.98, -0.05);
    for (const s of [-1, 1]) {
      B.box(paint, 0.06, 0.7, 3.6, s * 0.89, 0.62, -0.25); B.box(chrome, 0.02, 0.02, 2.8, s * 0.9, 0.965, -0.23);
      B.rbox(paint, 0.2, 0.13, 0.12, 0.03, s * 1.0, 0.98, 1.0); B.box(C(0x10141a, { rough: 0.05, metal: 1 }), 0.15, 0.09, 0.01, s * 1.0, 0.985, 0.935);
    }
    // dashboard, binnacle, centre stack and console, steering column
    B.rbox(plastic, 1.5, 0.3, 0.5, 0.05, 0, 0.66, 1.22); B.rbox(plastic, 1.5, 0.06, 0.44, 0.03, 0, 0.93, 1.13, -0.12); B.box(trim, 1.44, 0.28, 0.3, 0, 0.42, 1.14);
    B.rbox(plastic, 0.5, 0.14, 0.22, 0.05, -0.38, 0.96, 0.98, -0.1); B.rbox(plastic, 0.3, 0.38, 0.1, 0.02, 0, 0.64, 1.0);
    for (const [x, z] of [[-0.08, 0.95], [0.08, 0.95], [0.55, 0.99], [-0.64, 0.99]]) for (let i = 0; i < 4; i++) B.box(trim, 0.11, 0.008, 0.02, x, 0.85 + i * 0.018, z);
    B.rbox(trim, 0.22, 0.34, 0.66, 0.04, 0, 0.44, 0.58); B.rbox(plastic, 0.2, 0.08, 0.3, 0.03, 0, 0.62, 0.16); B.cyl(chrome, 0.012, 0.012, 0.16, 0, 0.66, 0.74, -0.25); B.cyl(trim, 0.03, 0.025, 0.05, 0, 0.75, 0.76);
    B.cyl(C(0xf2efe8, { rough: 0.6 }), 0.035, 0.03, 0.12, 0.06, 0.66, 0.44, 0, 0, 0, 12); B.cyl(C(0x4a2a1a, { rough: 0.8 }), 0.036, 0.036, 0.012, 0.06, 0.725, 0.44, 0, 0, 0, 12);
    // doors (inner cards), sills, armrests, speakers, pillars, visors, headliner, parcel shelf with a tissue box
    for (const s of [-1, 1]) {
      B.box(plastic, 0.05, 0.68, 2.55, s * 0.78, 0.62, -0.2); B.rbox(trim, 0.1, 0.035, 2.55, 0.015, s * 0.745, 0.955, -0.2);
      for (const z of [0.3, -0.62]) { B.rbox(seat2, 0.09, 0.07, 0.44, 0.03, s * 0.72, 0.66, z); B.box(chrome, 0.012, 0.03, 0.08, s * 0.748, 0.82, z + 0.2); B.cyl(trim, 0.075, 0.075, 0.012, s * 0.752, 0.44, z + 0.08, 0, 0, PI / 2, 16); }
      B.strut(pillar, V(s * 0.72, 0.96, 1.16), V(s * 0.64, 1.42, 0.4), 0.1, 0.06);
      B.rbox(pillar, 0.07, 0.5, 0.14, 0.02, s * 0.73, 1.18, -0.3);
      B.strut(pillar, V(s * 0.72, 0.97, -1.2), V(s * 0.63, 1.42, -0.84), 0.28, 0.06);
      B.rbox(lining, 0.26, 0.025, 0.4, 0.01, s * 0.38, 1.395, 0.64, 0.12);
    }
    B.box(lining, 1.38, 0.03, 1.46, 0, 1.42, -0.26); B.rbox(plastic, 0.22, 0.04, 0.12, 0.015, 0, 1.4, 0.22);
    B.box(C(0x222224, { rough: 0.9 }), 1.36, 0.03, 0.5, 0, 0.99, -1.42); B.rbox(C(0xd8d4cc, { rough: 0.8 }), 0.24, 0.1, 0.12, 0.02, 0.45, 1.05, -1.47);
    // rear-view mirror
    B.box(trim, 0.02, 0.08, 0.02, 0, 1.36, 0.97); B.rbox(plastic, 0.26, 0.075, 0.04, 0.015, 0, 1.3, 0.96); B.box(C(0x0c1016, { rough: 0.04, metal: 1 }), 0.23, 0.055, 0.004, 0, 1.3, 0.938);
    // seats: two front buckets (their backs face Bub), the rear bench
    for (const s of [-1, 1]) {
      B.rbox(seat, 0.5, 0.14, 0.52, 0.05, s * 0.38, 0.43, 0.38, 0.06); B.rbox(seat, 0.5, 0.62, 0.14, 0.06, s * 0.38, 0.86, 0.05, -0.16);
      B.rbox(seat2, 0.4, 0.34, 0.02, 0.01, s * 0.38, 0.72, -0.03, -0.16); B.rbox(seat, 0.25, 0.18, 0.1, 0.045, s * 0.38, 1.26, -0.02, -0.1);
      for (const d of [-0.07, 0.07]) B.cyl(chrome, 0.006, 0.006, 0.1, s * 0.38 + d, 1.18, 0);
      B.rbox(seat, 0.25, 0.17, 0.1, 0.045, s * 0.4, 1.22, -1.13, -0.2);
    }
    B.rbox(seat, 1.38, 0.15, 0.52, 0.06, 0, 0.47, -0.72, 0.05); B.rbox(seat, 1.38, 0.62, 0.15, 0.07, 0, 0.84, -1.07, -0.22);
    // instruments and radio: canvas screens behind glass
    D.gauges = canvasTex(256, 96, (g, w, h) => {
      g.fillStyle = '#040404'; g.fillRect(0, 0, w, h); g.textAlign = 'center';
      for (const [cx, lab] of [[64, 'km/h'], [192, 'x1000']]) {
        g.strokeStyle = 'rgba(255,150,60,0.9)'; g.lineWidth = 2; g.beginPath(); g.arc(cx, 52, 38, PI * 0.75, PI * 2.25); g.stroke();
        for (let i = 0; i <= 12; i++) { const a = PI * (0.75 + 1.5 * i / 12); g.beginPath(); g.moveTo(cx + Math.cos(a) * 30, 52 + Math.sin(a) * 30); g.lineTo(cx + Math.cos(a) * 37, 52 + Math.sin(a) * 37); g.stroke(); }
        g.fillStyle = 'rgba(255,160,70,0.9)'; g.font = '11px monospace'; g.fillText(lab, cx, 80);
      }
      g.fillStyle = 'rgba(255,170,80,0.85)'; g.font = 'bold 13px monospace'; g.fillText('12:11', 128, 22); g.fillText('19°', 128, 76);
    });
    D.radioTex = canvasTex(128, 36, (g, w, h) => { g.fillStyle = '#0a0602'; g.fillRect(0, 0, w, h); g.fillStyle = D.radioText ? '#ffb24a' : 'rgba(255,170,70,0.5)'; g.font = 'bold 18px monospace'; g.textAlign = 'center'; g.fillText(D.radioText || '12:11', w / 2, 25); });
    const screen = (t, k) => { const m = new THREE.MeshBasicMaterial({ map: t }); m.color.setScalar(k); return m; };
    B.box(screen(D.gauges, 1.7), 0.42, 0.14, 0.004, -0.38, 0.92, 0.9, -0.12);
    B.box(screen(D.radioTex, 1.8), 0.17, 0.05, 0.004, 0, 0.8, 0.948);
    B.box(C(0x3a0808, { emissive: 0xff2010, emissiveIntensity: 0.6 }), 0.025, 0.02, 0.01, 0, 0.73, 0.948);
    // glass: windscreen, rear window, four side windows
    const glass = new THREE.MeshStandardMaterial({ color: 0x0b0f14, transparent: true, opacity: 0.2, roughness: 0.3, metalness: 0.5, side: THREE.DoubleSide, depthWrite: false });
    B.quad(glass, V(0.68, 0.97, 1.17), V(-0.68, 0.97, 1.17), V(-0.62, 1.43, 0.41), V(0.62, 1.43, 0.41));
    B.quad(glass, V(-0.66, 0.99, -1.62), V(0.66, 0.99, -1.62), V(0.61, 1.42, -0.9), V(-0.61, 1.42, -0.9));
    for (const s of [-1, 1]) { B.side(glass, s * 0.772, [[-0.25, 0.97], [1.1, 0.97], [0.42, 1.4], [-0.25, 1.4]]); B.side(glass, s * 0.772, [[-1.05, 0.97], [-0.36, 0.97], [-0.36, 1.4], [-0.82, 1.4]]); }
    // the instruments reflected in the windscreen, the dash glow ghosted in the side glass
    const ghost = additive(soft(), 0x1c0e05, { side: THREE.DoubleSide });
    B.quad(additive(soft(), 0x2a1406), V(-0.2, 1.02, 1.1), V(-0.56, 1.02, 1.1), V(-0.54, 1.2, 0.84), V(-0.22, 1.2, 0.84));
    for (const s of [-1, 1]) for (const [z0, z1] of [[0.1, 0.7], [-0.9, -0.45]]) B.quad(ghost, V(s * 0.768, 0.99, z0), V(s * 0.768, 0.99, z1), V(s * 0.768, 1.3, z1), V(s * 0.768, 1.3, z0));
    B.flush(body);
    // steering wheel (turns with the road), speedo needle
    const wheel = Build.group({ parent: body, pos: WHEEL }); wheel.rotation.x = PI + 0.45;
    const spin = Build.group({ parent: wheel }), W2 = batcher();
    W2.add(new THREE.TorusGeometry(0.18, 0.018, 8, 28), trim); W2.cyl(plastic, 0.06, 0.06, 0.05, 0, 0, 0, PI / 2);
    for (const a of [0, PI, -PI / 2]) W2.box(trim, 0.16, 0.025, 0.012, Math.cos(a) * 0.1, Math.sin(a) * 0.1, 0, 0, 0, a);
    W2.flush(spin); W2.cyl(trim, 0.035, 0.04, 0.3, 0, 0, 0.16, PI / 2); W2.flush(wheel);
    const needle = Build.mesh(new THREE.BoxGeometry(0.003, 0.034, 0.002).translate(0, 0.017, 0), new THREE.MeshBasicMaterial({ color: 0xffb070 }), { parent: body, pos: [-0.274, 0.924, 0.894], shadow: false });
    needle.rotation.x = -0.12;
    // a phone slapped against Bub's window, screen first (hidden until then)
    D.slapPhone = Build.mesh(new THREE.PlaneGeometry(0.075, 0.155), Tex.mat('screen_feed'), { parent: body, pos: [WINDOW[0] - 0.012, WINDOW[1], WINDOW[2]], shadow: false });
    D.slapPhone.rotation.set(0, PI / 2, 0.25); D.slapPhone.visible = false;
    // headlights: a real spot plus the fake pool and haze cones; the tail lights on the road behind
    Build.light('spot', { pos: [0, 0.66, 2.62], target: [0, -0.4, 30], parent: body, color: 0xfff0d8, intensity: 32, distance: 60, angle: 0.4, penumbra: 0.6, decay: 1.2 });
    const pool = Build.pool({ pos: [0, 0.02, 13], r: 3.5, color: 0xfff0d8, opacity: 0.22, parent: body, dynamic: true }); pool.scale.set(1.5, 1, 2.6);
    for (const s of [-1, 1]) Build.beam({ pos: [s * 0.62, 0.7, 2.3], dir: [s * 0.04, -0.05, 1], len: 16, r: 1.8, color: 0xfff0d0, opacity: 0.045, parent: body });
    Build.pool({ pos: [0, 0.02, -3.4], r: 1.6, color: 0xff2010, opacity: 0.25, parent: body, dynamic: true }).scale.set(1.4, 1, 1);
    // cabin light: the dash glow, a faint bounce off the roof lining
    Build.light('point', { pos: [-0.1, 0.9, 0.98], parent: body, color: 0xff9a50, intensity: 0.5, distance: 2.1, decay: 2 });
    Build.light('point', { pos: [-0.05, 0.98, -0.3], parent: body, color: 0x9a94a0, intensity: 0.28, distance: 2.4, decay: 2 });
    // a cardboard pine-tree freshener on a string from the mirror; it swings with the car
    const fresh = Build.group({ parent: body, pos: [0.04, 1.27, 0.95] }), tree = new THREE.Shape([[0, 0], [0.028, -0.03], [0.012, -0.03], [0.034, -0.062], [0.014, -0.062], [0.04, -0.1], [0.004, -0.1], [0.004, -0.115], [-0.004, -0.115], [-0.004, -0.1], [-0.04, -0.1], [-0.014, -0.062], [-0.034, -0.062], [-0.012, -0.03], [-0.028, -0.03]].map(p => new THREE.Vector2(p[0], p[1])));
    Build.mesh(new THREE.ShapeGeometry(tree).translate(0, -0.05, 0), C(0x1e5a2a, { rough: 0.9, side: THREE.DoubleSide }), { parent: fresh, shadow: false });
    Build.mesh(new THREE.BoxGeometry(0.002, 0.05, 0.002).translate(0, -0.025, 0), trim, { parent: fresh, shadow: false });
    const eye = new THREE.Object3D(); eye.position.set(...EYE); body.add(eye);
    Object.assign(D, { car, body, wheel: spin, needle, eye, fresh });
  }

  // ---- window materials: most dark, some lamp-warm behind curtains or blinds, some phone-blue (flickering with the feed) ----
  function winMats() {
    const lit = (draw, k) => { const m = new THREE.MeshBasicMaterial({ map: canvasTex(64, 64, draw) }); m.color.setScalar(k); return m; };
    const warm = (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#6a3a18'); gr.addColorStop(0.6, '#d88a44'); gr.addColorStop(1, '#b0662c'); g.fillStyle = gr; g.fillRect(0, 0, w, h); };
    const curtains = (g, w, h) => { warm(g, w, h); for (const x of [0, w - 18]) { g.fillStyle = '#3a1e10'; g.fillRect(x, 0, 18, h); for (let i = 0; i < 18; i += 5) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x + i, 0, 2, h); } } };
    const blinds = (g, w, h) => { warm(g, w, h); g.fillStyle = 'rgba(40,20,8,0.55)'; for (let y = 2; y < h; y += 6) g.fillRect(0, y, w, 3); };
    const blueRoom = (g, w, h) => { g.fillStyle = '#04060c'; g.fillRect(0, 0, w, h); const r = g.createRadialGradient(34, 50, 2, 34, 50, 44); r.addColorStop(0, '#9ac4ff'); r.addColorStop(0.35, '#3a64c8'); r.addColorStop(1, 'rgba(10,20,60,0)'); g.fillStyle = r; g.fillRect(0, 0, w, h); g.fillStyle = '#05070c'; g.beginPath(); g.arc(30, 40, 7, 0, 7); g.fill(); g.fillRect(20, 46, 20, 18); };
    const shelves = (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#ffe8c0'); gr.addColorStop(0.2, '#c89060'); gr.addColorStop(1, '#6a4a30'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(30,18,10,0.7)'; for (let y = 22; y < h; y += 13) g.fillRect(4, y, w - 8, 4); for (let x = 4; x < w; x += 20) g.fillRect(x, 18, 3, h); };
    const phones = (g, w, h) => { g.fillStyle = '#060810'; g.fillRect(0, 0, w, h); for (let y = 14; y < h - 8; y += 16) for (let x = 6; x < w - 6; x += 11) { g.fillStyle = '#7ab0ff'; g.fillRect(x, y, 6, 10); } g.fillStyle = 'rgba(90,140,255,0.25)'; g.fillRect(0, 0, w, h); };
    const blue = [0, 1, 2].map(() => lit(blueRoom, 1.2));
    const w = { dark: Tex.color(0x0a0c10, { rough: 0.1, metal: 0.7 }), warm: [lit(curtains, 1.1), lit(blinds, 1.1)], blue, shop: lit(shelves, 1.2), phones: lit(phones, 1.6),
      frame: Tex.color(0xe8e4dc, { rough: 0.6 }), door: Tex.color(0x3a2a20, { rough: 0.7 }) };
    w.pick = r => { const k = r(); return k < 0.52 ? w.dark : k < 0.76 ? w.warm[(r() * 2) | 0] : blue[(r() * 3) | 0]; };
    return w;
  }

  // ---- the street ----------------------------------------------------------------------------------------------------
  function buildStreet(A) {
    const D = A.data, M = Tex.mat, L = R.len;
    const road = M('asphalt', { color: 0x7c7a78 }), kerb = M('concrete', { color: 0xb4b0a8 }), path = M('concrete', { color: 0x9c9890 }), verge = M('grass', { color: 0x44503a });
    const paint = M('paint', { alphaTest: 0.5, color: 0xe4e2da });
    Build.mesh(strip(-ROAD, ROAD, 0, 0, 0, L), road, { shadow: false });
    // kerbs and footpaths stop at the side streets
    for (const side of [-1, 1]) {
      const cuts = X_STREETS.filter(x => x[1] === side).map(x => x[0]), segs = [];
      let s0 = 0; for (const c of cuts) { segs.push([s0, c - 5]); s0 = c + 5; } segs.push([s0, L]);
      for (const [a, b] of segs) {
        const k = side * ROAD, sg = [[k, k, 0, 0.14, kerb], [k, k + side * 0.25, 0.14, 0.14, kerb], [k + side * 0.25, k + side * 2.4, 0.14, 0.14, path], [k + side * 2.4, k + side * 4.5, 0.12, 0.12, verge]];
        for (const [u0, u1, y0, y1, m] of sg) Build.mesh(side > 0 ? strip(u0, u1, y0, y1, a, b) : strip(u1, u0, y1, y0, a, b), m, { shadow: false });
      }
    }
    // lane markings: dashed centre, edge lines
    const B = batcher();
    for (let s = 2; s < L - 4; s += 9) B.add(strip(-0.06, 0.06, 0.012, 0.012, s, s + 3, 1.5), paint);
    for (const u of [-3.45, 3.45]) B.add(strip(u - 0.05, u + 0.05, 0.012, 0.012, 0, L, 3), paint);
    B.flush(A.group, { shadow: false });
    // ground: suburbs, the foreshore, seawall, beach, the bay (east of the esplanade and south, toward the bridge)
    Build.plane(700, 1500, M('grass', { color: 0x2c3524 }), { pos: [-330, -0.03, 560] });
    Build.plane(28, 1360, M('grass', { color: 0x34402c }), { pos: [4, 0.02, 560] });
    Build.box(1.4, 1.5, 1360, M('sandstone', { color: 0x9a8a70 }), { pos: [18.7, -1.4, 560], solid: false });
    Build.plane(12, 1360, M('sand', { color: 0x5a5244 }), { pos: [25, -1.25, 560] });
    const jz = at(S_JETTY).z, streaks = [];
    for (let i = 0; i < 9; i++) streaks.push({ x: 19.4 + (i + 0.5) * 170 / 9, z: jz + 1.6, color: 0xffa640, w: 1.4, len: 26 });
    for (let s = 20; s < S_ESP; s += SPACING) { const p = at(s, ROAD + 3.2); streaks.push({ x: 27, z: p.z, color: 0xffa640, w: 1.2, len: 18 }); }
    Build.water({ x1: 26, z1: -300, x2: 700, z2: 1320, y: -1.35, dark: true, streaks });
    Build.water({ x1: -700, z1: 1250, x2: 26, z2: 1900, y: -1.35, dark: true });
    // street lights: road lamps on the right, heritage lanterns along the foreshore (the sweep list lights the cabin)
    D.lamps = [];
    for (let s = 20, i = 0; s < L - 20; s += SPACING, i++) {
      const esp = s < S_ESP, left = esp || i % 2 === 0, u = left ? (esp ? ROAD + 3.2 : ROAD + 1.0) : -ROAD - 1.0, p = at(s, u);
      if (esp) Build.streetlight({ kind: 'heritage', pos: [p.x, 0.14, p.z], h: 4.4 });
      else Build.streetlight({ pos: [p.x, 0.14, p.z], yaw: faceRoad(s, u), h: 8 });
      const q = at(s, esp ? u : u - Math.sign(u) * 2.2);
      D.lamps.push({ s, pos: V(q.x, esp ? 4.8 : 8.2, q.z) });
      if (esp && i % 2) { const r = at(s, -ROAD - 1.0); Build.streetlight({ pos: [r.x, 0.14, r.z], yaw: faceRoad(s, -1), h: 8 }); }
    }
    for (let s = 30; s < S_ESP; s += 17) if (Math.abs(s - S_JETTY) > 6) { const p = at(s, ROAD + 5.4 + (s % 3)); Build.tree('palm', { pos: [p.x, 0.02, p.z], scale: 0.9 + (s % 5) * 0.08, seed: s }); }
    for (let s = 60; s < S_ESP; s += 43) { const p = at(s, ROAD + 7.6); Build.prop('bench', { pos: [p.x, 0.02, p.z], yaw: faceRoad(s, 1) + PI }); const b = at(s + 3, ROAD + 7.4); Build.prop('bin', { kind: 'street', pos: [b.x, 0.02, b.z] }); }
    A.marker('mk_start', P3(40, ROAD + 1.2, 0.14), at(40).yaw);
  }

  // ---- the esplanade: shops on the right, the jetty on the left -------------------------------------------------------
  const SHOPS = [['FISH & CHIPS', 'warm'], ['BAYSIDE CAFE', 'dark'], ['PHONE FIX', 'blue'], ['PHARMACY', 'warm'], ['SURF & SUP', 'dark'], ['THAI HOUSE', 'dark'], ['NEWSAGENCY', 'blue'], ['REAL ESTATE', 'dark'], ['BOTTLE-O', 'warm'], ['PIZZA', 'blue'], ['LAUNDROMAT', 'warm'], ['GELATO', 'dark']];
  function shops(A, W, win, figs, r) {
    const cream = Tex.color(0xe8e2d4, { rough: 0.7 }), post = Tex.color(0xd8d4cc, { rough: 0.5 }), n = SHOPS.length;
    const atlas = canvasTex(512, 64 * n, (g, w) => { g.fillStyle = '#1d1915'; g.fillRect(0, 0, w, 64 * n); g.fillStyle = '#f2e6cc'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = 'bold 40px "Helvetica Neue", Helvetica, Arial, sans-serif'; SHOPS.forEach(([t], i) => g.fillText(t, w / 2, 64 * i + 33, w - 24)); });
    const signM = new THREE.MeshBasicMaterial({ map: atlas, vertexColors: true });
    let s = 160;
    for (const [i, [name, look]] of SHOPS.entries()) {
      const w = 8 + r() * 3, c = s + w / 2, off = ROAD + 2.4, g = Build.group({ pos: P3(c, -off), yaw: faceRoad(c, -1) });
      W.base = frame(c, -off);
      const wall = Tex.mat('render'), tint = pickR(r, [0xfff4e0, 0xe8dcc8, 0xdce8e4, 0xfff0e0, 0xe8d4c4]);
      Build.box(w, 7.2, 12, wall, { parent: g, pos: [0, 0.14, -6], tint }); Build.box(w, 0.9, 0.3, wall, { parent: g, pos: [0, 7.3, -0.15], tint });
      const lit = look === 'blue' ? (name === 'PHONE FIX' ? win.phones : win.blue[(r() * 3) | 0]) : look === 'warm' ? win.shop : win.dark;
      W.plane(lit, w - 1.0, 2.5, 0, 1.5, 0.03); W.box(win.frame, w - 0.8, 0.08, 0.06, 0, 2.8, 0.04); W.box(win.door, 1.0, 2.2, 0.05, w / 2 - 1.1, 1.24, 0.05);
      for (let i = 0; i < 3; i++) { W.box(win.frame, 1.3, 1.5, 0.05, (i - 1) * w / 3.2, 5.1, 0.02); W.plane(win.pick(r), 1.16, 1.34, (i - 1) * w / 3.2, 5.1, 0.05); }
      Build.box(w, 0.16, 2.3, cream, { parent: g, pos: [0, 3.2, 1.15] });
      for (let x = -w / 2 + 0.2; x <= w / 2; x += w / 2 - 0.2) Build.box(0.1, 3.2, 0.1, post, { parent: g, pos: [x, 0.14, 2.2] });
      const sg = new THREE.PlaneGeometry(Math.min(w - 0.6, 5), 0.45), uv = sg.attributes.uv, k = look === 'dark' ? 0.35 : 1.3;
      for (let j = 0; j < uv.count; j++) uv.setY(j, 1 - (i + 1 - uv.getY(j)) / n);
      sg.setAttribute('color', new THREE.Float32BufferAttribute(new Array(uv.count * 3).fill(k), 3));
      W.add(sg, signM, 0, 3.28, 2.31);
      if (look !== 'dark') Build.pool({ parent: g, pos: [0, 0.15, 1.2], r: 2.6, color: look === 'blue' ? 0x4a78ff : 0xffb060, opacity: 0.3 });
      if (name === 'PHONE FIX') for (let i = 0; i < 3; i++) fig(figs, P3(c - 1.5 + i * 1.4, -off + 0.6 - (i % 2) * 0.4, 0.14), faceRoad(c, -1) + PI + (r() - 0.5), r);
      s += w;
    }
    A.data.shopsEnd = s;
    const a = at(S_CAFE - 4, -ROAD - 1.4); Build.prop('a_frame', { pos: [a.x, 0.14, a.z], yaw: faceRoad(S_CAFE, -1), poster: 'promo_launch' });
    for (const [ds, u] of [[0, -1.6], [2.2, -1.7]]) { const p = at(S_CAFE + ds, -ROAD + u); Build.prop('table', { kind: 'cafe', pos: [p.x, 0.14, p.z] }); }
  }
  function jetty(A, figs, r) {
    const p = at(S_JETTY), x0 = 19.4, L = 170;
    Build.prop('jetty', { pos: [x0, -1.35, p.z], yaw: PI / 2, length: L, width: 3.4, deck: 1.37, lamps: 9 });
    // lined both sides with people at the rail, a string of blue glows out over the black water
    const glow = [];
    for (let x = x0 + 5; x < x0 + L - 4; x += 1.8 + r() * 2) for (const sd of [-1, 1]) if (r() < 0.8) {
      const z = p.z + sd * (1.15 + r() * 0.2); fig(figs, [x + r() * 0.6, 0.02, z], (sd > 0 ? 0 : PI) + (r() - 0.5) * 1.6, r); glow.push(x, 1.4, z - sd * 0.3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(glow, 3));
    A.group.add(new THREE.Points(g, new THREE.PointsMaterial({ map: soft(), color: 0x3a6cff, size: 1.3, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
  }

  // ---- the suburbs ---------------------------------------------------------------------------------------------------
  function house(A, W, win, s, side, r, o = {}) {
    const w = o.w ?? 9 + r() * 3.5, d = 9 + r() * 2, set = o.set ?? 4.5 + r() * 3, off = ROAD + 4.5 + set + d / 2, q = o.q ?? r() < 0.45;
    const g = Build.group({ pos: P3(s, side * off), yaw: faceRoad(s, side) }), y0 = q ? 1.0 : 0.15, h = 2.7, zf = d / 2;
    W.base = frame(s, side * off);
    const wall = Tex.mat(q ? 'weatherboard' : r() < 0.6 ? 'brick' : 'render'), tint = q ? pickR(r, [0xffffff, 0xe0f0e4, 0xfff0d8, 0xdcecff, 0xf0e0c8]) : pickR(r, [0xffffff, 0xffe0d0, 0xe8d0c0, 0xf8f0e0]);
    const roofM = q ? Tex.mat('corrugated', { color: 0x8a7a70 }) : Tex.mat('roof_tiles', { color: 0x9a6a58 });
    Build.box(w, h, d, wall, { parent: g, pos: [0, y0, 0], tint });
    if (q) Build.box(w - 0.3, y0, d - 0.3, Tex.mat('planks', { color: 0x3e3630 }), { parent: g, pos: [0, 0, 0] });
    Build.roof({ parent: g, y: y0 + h, w, d, kind: q && r() < 0.5 ? 'gable' : 'hip', pitch: q ? 0.52 : 0.38, mat: roofM });
    const door = o.door ?? (r() < 0.5 ? -1 : 1) * (w / 2 - 1.8), dw = -Math.sign(door) * (w / 2 + 1.7), lit = o.lit ?? r() < 0.55;
    for (const x of [-w / 2 + 1.6, 0, w / 2 - 1.6]) if (Math.abs(x - door) > 1.3) { W.box(win.frame, 1.5, 1.3, 0.06, x, y0 + 1.55, zf + 0.02); W.plane(o.win ?? win.pick(r), 1.36, 1.16, x, y0 + 1.55, zf + 0.06); }
    W.box(win.door, 0.9, 2.05, 0.05, door, y0 + 1.03, zf + 0.03);
    if (q) {
      const white = Tex.color(0xeae6dc, { rough: 0.6 });
      Build.box(w, 0.12, 2.4, Tex.mat('floorboards', { color: 0x8a7a64 }), { parent: g, pos: [0, y0 - 0.12, zf + 1.2] });
      Build.box(w + 0.2, 0.06, 2.6, roofM, { parent: g, pos: [0, y0 + 2.5, zf + 1.3], rot: [0.12, 0, 0] });
      for (let i = 0; i <= 4; i++) Build.box(0.1, 2.5, 0.1, white, { parent: g, pos: [-w / 2 + 0.1 + i * (w - 0.2) / 4, y0, zf + 2.3] });
      for (const y of [0.12, 0.9]) Build.box(w, 0.06, 0.05, white, { parent: g, pos: [0, y0 + y, zf + 2.3], solid: false });
      for (let i = 0; i < 4; i++) Build.box(1.2, 0.18 * (i + 1), 0.28, Tex.mat('planks', { color: 0x6a5a48 }), { parent: g, pos: [door, 0.15, zf + 2.4 + 0.28 * (4 - i) - 0.14] });
    }
    if (lit) { Build.glow({ parent: g, pos: [door + 0.7, y0 + 2.2, zf + 0.12], color: 0xffc27a, size: 0.55 }); Build.pool({ parent: g, pos: [door, y0, zf + 1.2], r: 2.2, color: 0xffb060, opacity: 0.35 }); }
    // front yard: fence with a gate and a driveway gap, letterbox, driveway, maybe a car, maybe a tree
    const fz = zf + set - 0.2, half = (w + 6) / 2, gaps = [[door - 0.6, door + 0.6], [dw - 1.7, dw + 1.7]].sort((a, b) => a[0] - b[0]);
    const fence = pickR(r, ['post_rail', 'pool']);
    let x = -half; for (const [a, b] of gaps) { if (a - x > 0.6) Build.prop('fence', { parent: g, kind: fence, pos: [x, 0.12, fz], length: a - x, h: fence === 'paling' ? 1.2 : undefined }); x = b; }
    if (half - x > 0.6) Build.prop('fence', { parent: g, kind: fence, pos: [x, 0.12, fz], length: half - x, h: fence === 'paling' ? 1.2 : undefined });
    Build.prop('letterbox', { parent: g, kind: q ? 'post' : 'brick', number: String(2 + ((s * 7) | 0) % 90), pos: [door + (door > 0 ? -1 : 1), 0.12, fz + 0.3] });
    Build.plane(3, set + 1.2, Tex.mat('concrete', { color: 0x8a8680 }), { parent: g, pos: [dw, 0.13, zf + set / 2 - 0.2] });
    if (o.car ?? r() < 0.3) Build.car(pickR(r, ['hatch', 'sedan', 'ute']), { parent: g, pos: [dw, 0.13, zf + 1.6], yaw: r() < 0.5 ? 0 : PI, color: r() < 0.5 ? 0xe8e8e4 : 0x2a3e5c, plate: '425 KDL' });
    if (o.tree ?? r() < 0.25) Build.tree(pickR(r, ['gum', 'fig']), { parent: g, pos: [-dw * 0.6, 0.12, zf + set * 0.55], scale: 0.6 + r() * 0.3 });
    if (r() < 0.4) { const b = at(s + (r() - 0.5) * 6, side * (ROAD + 2.9)); Build.prop('bin', { kind: r() < 0.5 ? 'wheelie' : 'recycle', pos: [b.x, 0.14, b.z], yaw: faceRoad(s, side) }); }
    return { g, zf, y0, door, w, d, off, set };
  }
  function suburbs(A, W, win, figs, r) {
    const D = A.data, skip = (s, side) => X_STREETS.some(x => x[1] === side && Math.abs(s - x[0]) < 13) || (side < 0 && Math.abs(s - S_BUS) < 14) || (side > 0 && s > S_SERVO - 26) || (side < 0 && s > S_RB - 30) || (side < 0 && Math.abs(s - S_BOARD) < 9) || (side < 0 && Math.abs(s - S_PORCH) < 15) || (side > 0 && Math.abs(s - S_DOG) < 15) || (side < 0 && s > 150 && s < D.shopsEnd + 8);
    D.porch = house(A, W, win, S_PORCH, -1, r, { q: true, lit: true, set: 4, door: 0, car: false, tree: false, w: 11 });
    D.dogHouse = house(A, W, win, S_DOG, 1, r, { q: false, lit: true, set: 7, car: true, tree: false, w: 10 });
    for (const side of [-1, 1]) for (let s = side < 0 ? 12 : 492; s < S_RB - 8; s += 16 + r() * 5) {
      if (skip(s, side)) continue;
      const h = house(A, W, win, s, side, r);
      // someone inside, a blue silhouette at the window
      if (r() < 0.2) fig(figs, P3(s, side * (h.off - h.d / 2 + 1.2), h.y0), faceRoad(s, side) + PI + (r() - 0.5), r);
    }
    // side streets: stubs into the dark with a street sign
    for (const [s, side, name] of X_STREETS) {
      const a = at(s, side * ROAD), b = at(s, side * 110);
      Build.road({ from: [a.x, a.z], to: [b.x, b.z], width: 8, path: 2.2 });
      const c = at(s + 5.5, side * (ROAD + 1.2));
      Build.sign({ pos: [c.x, 0.14, c.z], yaw: at(s).yaw + PI / 2, tex: Tex.sign('street', name), w: 0.9, h: 0.17, post: 2.5 });
      for (const d of [30, 70]) { const l = at(s + 6, side * (ROAD + d)); Build.streetlight({ pos: [l.x, 0.05, l.z], yaw: at(s).yaw + PI, h: 8 }); }
      for (const d of [22, 44, 66, 88]) for (const k of [-1, 1]) { const hp = at(s + k * 16, side * (ROAD + d)); Build.box(9, 2.8, 8, Tex.mat('brick'), { pos: [hp.x, 0.05, hp.z], yaw: at(s).yaw + PI / 2 }); Build.roof({ x: hp.x, z: hp.z, y: 2.85, w: 9, d: 8, yaw: at(s).yaw + PI / 2, mat: Tex.mat('roof_tiles', { color: 0x9a6a58 }) }); }
    }
  }

  // ---- set pieces ----------------------------------------------------------------------------------------------------
  function porchFamily(A) {
    const D = A.data, h = D.porch, m = new THREE.Matrix4().compose(V(...P3(S_PORCH, -h.off)), new THREE.Quaternion().setFromAxisAngle(UP, faceRoad(S_PORCH, -1)), V(1, 1, 1));
    const P = (x, z) => V(x, h.y0, h.zf + z).applyMatrix4(m).toArray(), y = faceRoad(S_PORCH, -1);
    person(A, 'p3_dad', P(-1.1, 1.3), y + 0.3, { seed: seedOf('m', 70) });
    person(A, 'p3_mum', P(0.4, 0.9), y - 0.2, { seed: seedOf('f', 80) });
    person(A, 'p3_kid', P(1.4, 1.5), y + 0.7, { def: 'kid', seed: 5 });
    const glow = V(...P(0.2, 1.5)).setY(h.y0 + 1.45);
    D.blueSpots.push({ pos: glow, k: 1.4 });
    Build.light('point', { pos: glow.toArray(), color: 0x4a7cff, intensity: 3, distance: 7, decay: 2 });
  }
  function dog(A) {
    const D = A.data, h = D.dogHouse, m = new THREE.Matrix4().compose(V(...P3(S_DOG, h.off)), new THREE.Quaternion().setFromAxisAngle(UP, faceRoad(S_DOG, 1)), V(1, 1, 1));
    const P = (x, z) => V(x, 0.12, h.zf + z).applyMatrix4(m), y = faceRoad(S_DOG, 1);
    const own = P(1.6, h.set + 1.0), pup = P(0.9, h.set + 2.6);
    person(A, 'p3_owner', own.toArray(), y + PI + 0.5, { seed: seedOf('m', 90) });
    const g = Build.group({ pos: pup.toArray(), yaw: U.yawTo(pup, own) }), B = batcher();
    g.userData.dynamic = true;
    const fur = Tex.color(0x6a4a2c, { rough: 0.9 }), dark = Tex.color(0x241c16, { rough: 0.9 });
    B.add(new THREE.CapsuleGeometry(0.15, 0.45, 4, 8).rotateX(PI / 2), fur, 0, 0.45, 0);
    for (const [x, z] of [[0.08, 0.2], [-0.08, 0.2], [0.08, -0.22], [-0.08, -0.22]]) B.cyl(fur, 0.035, 0.03, 0.38, x, 0.19, z, 0, 0, 0, 6);
    B.cyl(dark, 0.02, 0.012, 0.3, 0, 0.55, -0.4, -0.9, 0, 0, 6);
    B.flush(g);
    const head = Build.group({ parent: g, pos: [0, 0.62, 0.34] });
    B.rbox(fur, 0.16, 0.16, 0.18, 0.05, 0, 0, 0); B.rbox(dark, 0.08, 0.08, 0.14, 0.03, 0, -0.03, 0.13);
    for (const s of [-1, 1]) B.add(new THREE.ConeGeometry(0.035, 0.1, 5), dark, s * 0.05, 0.11, -0.03);
    B.flush(head);
    D.dog = { g, head, t: 0, bark: 0.4 };
  }
  function bus(A, figs, r) {
    const D = A.data, u = -(ROAD - 1.35), p = at(S_BUS, u), yaw = p.yaw + PI, g = Build.group({ pos: [p.x, 0, p.z], yaw }), B = batcher();
    B.base = new THREE.Matrix4().compose(V(p.x, 0, p.z), new THREE.Quaternion().setFromAxisAngle(UP, yaw), V(1, 1, 1));
    const paint = Tex.color(0xcfd0cc, { rough: 0.45, metal: 0.2 }), stripe = Tex.color(0x1a4a8a, { rough: 0.4 }), trim = Tex.color(0x16171a, { rough: 0.6 }), tyre = Tex.color(0x121212, { rough: 0.9 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x060a10, transparent: true, opacity: 0.55, roughness: 0.15, metalness: 0.6, depthWrite: false, side: THREE.DoubleSide });
    B.box(paint, 2.5, 0.95, 12, 0, 0.78, 0); B.box(stripe, 2.52, 0.2, 12.02, 0, 0.55, 0); B.box(paint, 2.5, 0.5, 12, 0, 2.7, 0); B.box(trim, 2.52, 0.08, 12.02, 0, 1.3, 0);
    for (let z = -5.9; z <= 5.9; z += 1.475) B.box(trim, 2.52, 1.2, 0.1, 0, 1.88, z);
    for (const s of [-1, 1]) { B.plane(glass, 11.8, 1.2, s * 1.255, 1.88, 0, 0, s * PI / 2); for (const z of [-3.9, 3.7]) B.cyl(tyre, 0.5, 0.5, 0.3, s * 1.1, 0.5, z, 0, 0, PI / 2, 14); }
    B.plane(glass, 2.3, 1.4, 0, 1.9, 6.02); B.box(trim, 2.4, 0.34, 0.05, 0, 2.62, 6.02);
    B.plane(new THREE.MeshBasicMaterial({ map: Tex.text('690  REDCLIFFE', { w: 512, h: 64, color: '#ffa020', bg: '#0a0604', font: 'monospace' }), color: hdr(0xffffff, 1.6) }), 2.0, 0.24, 0, 2.64, 6.05);
    B.box(Tex.color(0x101012, { rough: 0.9 }), 2.3, 0.05, 11.6, 0, 0.62, 0); B.box(trim, 2.3, 0.04, 11.6, 0, 2.66, 0);
    for (let z = -5; z <= 4; z += 0.95) for (const s of [-1, 1]) B.box(Tex.color(0x22304a, { rough: 0.9 }), 0.9, 0.62, 0.12, s * 0.7, 0.65, z - 0.2);
    B.flush(A.group);
    for (let z = -5; z <= 4; z += 0.95) for (const s of [-1, 1]) if (r() < 0.75) { const q = V(s * 0.7 + (r() - 0.5) * 0.2, 0.2, z + 0.1).applyAxisAngle(UP, yaw); fig(figs, [p.x + q.x, 0.18, p.z + q.z], yaw + (r() - 0.5) * 0.4, r); }
    const dq = V(-0.6, 0.1, 5.2).applyAxisAngle(UP, yaw); fig(figs, [p.x + dq.x, 0.1, p.z + dq.z], yaw + 0.2, r);
    D.hazards = [[-1.1, 6.02], [1.1, 6.02], [-1.1, -6.02], [1.1, -6.02]].map(([x, z]) => Build.glow({ parent: g, pos: [x, 0.7, z], color: 0xffa020, size: 0.7, dynamic: true }));
    for (const s of [-1, 1]) Build.glow({ parent: g, pos: [s * 0.9, 0.6, 6.05], color: 0xfff0d0, size: 1.3 });
    const sh = at(S_BUS - 3, -ROAD - 1.3); Build.prop('bus_shelter', { pos: [sh.x, 0.14, sh.z], yaw: faceRoad(S_BUS, -1) });
    D.blueSpots.push({ pos: V(p.x, 1.8, p.z), k: 2.2 });
    Build.light('point', { pos: [p.x, 1.55, p.z], color: 0x3a6cff, intensity: 2.2, distance: 6.5, decay: 2 });
  }
  function servo(A, W, win, figs, r) {
    const D = A.data, off = ROAD + 17, yaw = faceRoad(S_SERVO, 1), g = Build.group({ pos: P3(S_SERVO, off), yaw });
    W.base = frame(S_SERVO, off);
    Build.plane(30, 26, Tex.mat('concrete', { color: 0x8a8884 }), { parent: g, pos: [0, 0.1, 1] });
    Build.prop('servo_canopy', { parent: g, pos: [0, 0.1, 1.5], w: 16, d: 9 });
    Build.prop('price_sign', { parent: g, pos: [-12, 0.1, 11], yaw: PI / 2, prices: 'UNLEADED 91|189.9\nPREMIUM 98|209.9\nDIESEL|203.9' });
    Build.box(18, 3.8, 9, Tex.mat('render', { color: 0xd8d4cc }), { parent: g, pos: [0, 0.1, -12] });
    W.plane(win.shop, 12, 2.4, 0, 1.4, -7.45); W.box(Tex.color(0xc81e1e, { rough: 0.5 }), 18.2, 0.5, 0.2, 0, 3.7, -7.4);
    Build.car('hatch', { parent: g, pos: [3.2, 0.1, 1.2], yaw: PI / 2, color: 0x8a1f22 });
    const person0 = V(4.8, 0.1, 2.6).applyMatrix4(frame(S_SERVO, off)); person(A, 'p3_pump', person0.toArray(), yaw + PI / 2 + 0.3, { seed: seedOf('m', 110) });
    for (const [x, z, a] of [[-3, 0.6, 2.2], [-4.4, 2.8, 0.4], [1.2, -6.6, 3]]) { const q = V(x, 0.1, z).applyMatrix4(frame(S_SERVO, off)); fig(figs, q.toArray(), yaw + a, r); }
    Build.light('point', { pos: V(0, 4.3, 1.5).applyMatrix4(frame(S_SERVO, off)).toArray(), color: 0xdce8ff, intensity: 14, distance: 22, decay: 1.6 });
    A.marker('mk_p3_servo', V(0, 0.1, 5).applyMatrix4(frame(S_SERVO, off)).toArray(), yaw);
  }
  function billboard(A) {
    const s = S_BOARD, off = ROAD + 9, g = Build.group({ pos: P3(s, -off), yaw: faceRoad(s, -1) - 0.35 });
    const tex = canvasTex(1024, 384, (c, w, h) => {
      const gr = c.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#0a1a4a'); gr.addColorStop(1, '#2a5ad8'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
      c.fillStyle = '#e8f0ff'; c.font = 'bold 120px "Helvetica Neue", Helvetica, Arial, sans-serif'; c.fillText('INFINITE', 60, 170);
      c.font = '40px "Helvetica Neue", Helvetica, Arial, sans-serif'; c.fillText('A feed that finally understands you.', 64, 250);
      c.font = 'bold 34px "Helvetica Neue", Helvetica, Arial, sans-serif'; c.fillStyle = '#ffd21a'; c.fillText('Tonight. 12:00. Only on yes.', 64, 320);
      c.fillStyle = '#05070c'; c.fillRect(760, 40, 180, 310); c.fillStyle = '#6ab0ff'; c.fillRect(772, 56, 156, 278);
    });
    for (const x of [-2.6, 2.6]) Build.box(0.3, 5, 0.3, Tex.mat('metal_painted', { color: 0x4a4e52 }), { parent: g, pos: [x, 0.1, 0] });
    Build.box(8.4, 3.3, 0.2, Tex.color(0x1a1c20), { parent: g, pos: [0, 5, -0.12] });
    Build.mesh(new THREE.PlaneGeometry(8, 3), new THREE.MeshBasicMaterial({ map: tex, color: hdr(0xffffff, 1.2) }), { parent: g, pos: [0, 6.6, 0.01] });
    for (const x of [-2.5, 2.5]) Build.glow({ parent: g, pos: [x, 4.9, 0.6], color: 0xe8f0ff, size: 0.6 });
  }
  function roundabout(A) {
    const D = A.data, c = at(S_RB + 13, 0), yaw = c.yaw;
    Build.prop('roundabout', { pos: [c.x, 0, c.z], yaw, r: 7 });
    for (const side of [-1, 1]) { const a = at(S_RB + 13, side * 11), b = at(S_RB + 13, side * 120); Build.road({ from: [a.x, a.z], to: [b.x, b.z], width: 9, path: 2.2 }); }
    const gw = at(S_RB + 1, LANE); Build.marking('give_way', { pos: [gw.x, 0.012, gw.z], yaw, w: 3.3 });
    for (const [ds, u] of [[-6, -ROAD - 1], [30, ROAD + 1], [26, -ROAD - 1]]) { const l = at(S_RB + 13 + ds, u); Build.streetlight({ pos: [l.x, 0.14, l.z], yaw: faceRoad(S_RB + ds, u), h: 8.5 }); }
    // the truck: comes out of the right-hand road, straight across the island
    const truck = Build.car('truck', { dynamic: true, solid: false, lights: true, beams: true, color: 0xd8d4c8 });
    truck.visible = false;
    D.truck = { g: truck, hit: V(...P3(S_RB - 0.6, LANE - 1.0)), from: V(...P3(S_RB + 9, -70)) };
    D.truck.dir = D.truck.hit.clone().sub(D.truck.from).normalize();
    A.marker('mk_p3_crash', P3(S_RB, LANE), at(S_RB).yaw);
  }
  // the police far down a side street, lights going; the bridge far across the bay
  function far(A) {
    const D = A.data, [s, side] = X_STREETS[1], p = at(s + 3, side * 72);
    Build.car('police', { pos: [p.x, 0.02, p.z], yaw: at(s).yaw + 1.2, lights: true });
    D.flash = [0xff2020, 0x2040ff].map((c, i) => Build.glow({ pos: [p.x, 1.8, p.z + (i - 0.5) * 0.8], color: c, size: 7, dynamic: true }));
    D.sirenAt = V(p.x, 1.5, p.z).add(A.origin);
    // the bridge (drawn nearer than it is and slid with the car: parallax for a light line ~2 km out)
    const g = Build.group({}), pts = [], refl = [], tex = soft();
    g.userData.dynamic = true;
    const a = V(-1250, 0, 1520), b = V(620, 0, 1320);
    for (let i = 0; i <= 110; i++) { const q = a.clone().lerp(b, i / 110), y = 7 + Math.sin(PI * i / 110) * 5; pts.push(q.x, y, q.z); refl.push(q.x, -1.3, q.z + 6); }
    for (let i = 0; i < 40; i++) { const q = b.clone().lerp(V(1100, 0, 1500), i / 40); pts.push(q.x + Math.sin(i * 7.1) * 30, 3 + (i % 3), q.z + Math.cos(i * 3.3) * 40); }
    const pm = (arr, size, color, o) => { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); const P = new THREE.Points(geo, new THREE.PointsMaterial(Object.assign({ map: tex, size, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }, o))); g.add(P); return P; };
    pm(pts, 9, hdr(0xffa648, 2.2)); pm(refl, 14, hdr(0xff8a30, 0.45));
    const glowTex = canvasTex(4, 64, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.8, 'rgba(255,150,70,0.5)'); gr.addColorStop(1, 'rgba(255,170,90,0.9)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); });
    const sky = Build.mesh(new THREE.PlaneGeometry(4000, 90), additive(glowTex, 0x6a3a1a, { fog: false, opacity: 0.7 }), { parent: g, pos: [-300, 40, 1700], shadow: false, receive: false });
    sky.rotation.y = PI;
    D.bridge = g;
  }

  // Build batches statics per 24 m cell; houses along a street are ~18 m apart, so merge again into 96 m cells
  function mergeStatics(A, cell = 96) {
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

  // a sky with the city's glow low on the horizon (silhouettes the palms and roofs); rides with the car
  function sky(A) {
    const g = new THREE.SphereGeometry(900, 32, 16), p = g.attributes.position, col = [], lo = new THREE.Color(0x3a2a24), mid = new THREE.Color(0x141824), top = new THREE.Color(0x05070c), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) { const y = p.getY(i) / 900; if (y < 0) c.set(0x0c0c10); else if (y < 0.08) c.copy(lo).lerp(mid, y / 0.08); else c.copy(mid).lerp(top, Math.min(1, (y - 0.08) / 0.5)); col.push(c.r, c.g, c.b); }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const m = Build.mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }), { shadow: false, receive: false });
    m.renderOrder = -10; m.userData.dynamic = true; A.data.sky = m;
  }

  // ---- per frame -----------------------------------------------------------------------------------------------------
  const _m = new THREE.Matrix4(), _prev = new THREE.Matrix4(), _v = V(), _w = V(), _p = {};
  const hash = x => { const s = Math.sin(x * 127.1) * 43758.5453; return s - Math.floor(s); };
  function drive(A, dt, t) {
    const D = A.data, car = D.car;
    if (D.run) {
      const want = D.stop != null ? Math.min(vPlan(D.s), Math.sqrt(Math.max(0, 2 * 3.5 * (D.stop - D.s)))) : vPlan(D.s);
      const a = U.clamp((want - D.v) * 2.5, -4.5, 2.4); D.acc = U.damp(D.acc, a, 6, dt);
      D.v = Math.max(0, D.v + a * dt); D.s += D.v * dt;
    }
    _prev.copy(car.matrixWorld);
    const s = D.s, l = lat(s), dl = (lat(s + 1) - lat(s - 1)) / 2, p = at(s, l, _p);
    const yaw = p.yaw + Math.atan(dl), yawRate = dt > 0 ? U.wrapAngle(yaw - (D.yaw ?? yaw)) / dt : 0; D.yaw = yaw;
    car.position.set(p.x, 0, p.z); car.rotation.y = yaw;
    D.body.rotation.x = U.damp(D.body.rotation.x, U.clamp(D.acc * 0.006, -0.02, 0.02), 5, dt);
    D.body.rotation.z = U.damp(D.body.rotation.z, U.clamp(-yawRate * D.v * 0.004, -0.03, 0.03), 4, dt);
    const rough = Math.min(1, D.v / 6); D.body.position.y = (Math.sin(t * 13.1) * 0.0018 + Math.sin(t * 7.3 + 1) * 0.0012) * rough;
    D.eye.position.set(EYE[0] + (D.flinch || 0), EYE[1] + Math.sin(t * 9.7) * 0.0015 * rough, EYE[2] + D.acc * 0.004);
    car.updateMatrixWorld(true);
    D.clip.constant = D.eye.getWorldPosition(_w).y - 0.13;
    // the gameplay camera was posed from last frame's car: carry it along
    if (Play.char === D.bub) { _m.copy(_prev).invert().premultiply(car.matrixWorld); Play.camPose.pos.applyMatrix4(_m); Play.camPose.target.applyMatrix4(_m); }
    // seated characters ride with the car
    for (const [c, o] of D.riders) { c.root.position.fromArray(o.at).applyMatrix4(car.matrixWorld); c.yaw = yaw + o.yaw; }
    const steer = U.clamp(Math.atan(dl) * 6 + U.wrapAngle(at(s + 4).yaw - p.yaw) * 5, -1.2, 1.2);
    D.wheel.rotation.z = U.damp(D.wheel.rotation.z, -steer, 6, dt);
    D.needle.rotation.z = 2.1 - U.clamp(D.v * 3.6 / 180, 0, 1) * 4.2;
    if (D.dj) D.dj.setPos(D.body.localToWorld(_v.set(...RADIO)));
    D.fresh.rotation.x = U.damp(D.fresh.rotation.x, D.acc * 0.12, 3, dt); D.fresh.rotation.z = U.damp(D.fresh.rotation.z, U.clamp(yawRate * D.v * 0.06, -0.5, 0.5) + Math.sin(t * 2.3) * 0.04, 3, dt); D.fresh.rotation.y = Math.sin(t * 0.7) * 0.6;
    // Chase's hands: the right on the console (reaching back for Bub when the phone hits the glass), the left in his lap
    if (D.chase) { const T = D.chase.ikT || (D.chase.ikT = {}); const k = D.reach || 0; T.R = { p: D.body.localToWorld(D.grip.C.set(0.1 - 0.16 * k, 0.92 + 0.09 * k, 0.22 - 0.52 * k)), w: D.chaseArm }; T.L = { p: D.body.localToWorld(D.grip.K.set(0.16, 0.64, 0.46)), w: D.chaseArm }; }
    // Luke's hands: on the wheel, or the left one at the radio
    if (D.luke) {
      const T = D.luke.ikT || (D.luke.ikT = {}), G2 = D.grip;
      D.wheel.localToWorld(G2.R.set(-0.17, 0.05, 0.01));
      if (D.radio) D.body.localToWorld(G2.L.set(RADIO[0] + Math.sin(t * 9) * 0.008, RADIO[1] - 0.02, RADIO[2] - 0.06)); else D.wheel.localToWorld(G2.L.set(0.17, 0.05, 0.01));
      T.L = { p: G2.L, w: 1 }; T.R = { p: G2.R, w: 1 };
    }
    // the street lamp overhead sweeps through the cabin
    const Ls = D.lamps; let i = 0; while (i < Ls.length - 1 && Ls[i + 1].s < s) i++;
    const a0 = Ls[i], a1 = Ls[Math.min(i + 1, Ls.length - 1)], near = s - a0.s < a1.s - s ? a0 : a1, mid = (a0.s + a1.s) / 2;
    const env = a1 === a0 ? 1 : U.clamp(Math.abs(s - mid) / Math.max(1, Math.abs(near.s - mid)));
    if (!D.crash) { D.sun.position.copy(near.pos); D.sun.target.position.set(p.x, 0.8, p.z); D.sun.intensity = 80 * env * env; }
    let j = i; while (j < Ls.length - 1 && Ls[j].s < s + 14) j++;
    D.ahead.position.copy(Ls[j].pos); D.ahead.intensity = 70 * U.clamp((Ls[j].s - s - 14) / 10) * U.clamp((s + 70 - Ls[j].s) / 20);
    // phone-blue light from whoever is nearest (or from the phone on the glass)
    let best = null, bd = 1e9;
    for (const b of D.blueSpots) { const d = Math.hypot(b.pos.x - p.x, b.pos.z - p.z); if (d < bd) { bd = d; best = b; } }
    if (D.slapT != null) { D.body.localToWorld(D.blue.position.set(WINDOW[0] + 0.35, WINDOW[1], WINDOW[2])).sub(A.origin); D.blue.intensity = 2.2 * Math.exp(-Math.max(0, t - D.slapT) * 0.8); }
    else if (best) { D.blue.position.copy(best.pos); D.blue.intensity = best.k * 6 * U.clamp(1 - bd / 24) ** 2; }
    // flickering feed-blue windows
    D.win.blue.forEach((m, j) => { const k = hash(Math.floor(t * 1.4 + j * 3.7) + j * 11); m.color.setScalar(U.damp(m.color.r, 0.5 + k * 1.1, 9, dt)); });
    // everything past the fog is skipped (statics are merged in 96 m cells): statics by distance, people too
    if (!D.cull && dt > 0) {
      D.cull = []; const bb = new THREE.Box3(), sp = new THREE.Sphere();
      for (const o of A.group.children) {
        if (o.userData.dynamic || o.isInstancedMesh || o.isLight || !(o.isMesh || o.isPoints || o.isGroup)) continue;
        bb.setFromObject(o).getBoundingSphere(sp); if (sp.radius < 120) D.cull.push({ o, c: sp.center.clone().sub(A.origin), r: sp.radius });
        o.traverse(m => { m.castShadow = false; });   // only the car and the people throw shadows (the lamp sweeping the cabin)
      }
    }
    if (D.cull && (D.cullT = (D.cullT || 0) - dt) <= 0) { D.cullT = 0.25; for (const k of D.cull) k.o.visible = Math.hypot(k.c.x - car.position.x, k.c.z - car.position.z) - k.r < 125; }
    for (const c of D.people) c.setVisible(Math.hypot(c.root.position.x - car.position.x - A.origin.x, c.root.position.z - car.position.z - A.origin.z) < 110);
    // the jogger stays frozen mid-stride
    if (D.jogger) { const L = D.jogger.loco; L.v = L.target = 2.9; L.phase = 0.13; }
    // the dog barks at a man who doesn't move
    const dg = D.dog;
    if (dg) {
      dg.t += dt; const ph = dg.t % 1.1, k = ph < 0.3 ? Math.sin(ph / 0.3 * PI) : 0;
      dg.head.rotation.x = -0.35 * k; dg.g.rotation.x = -0.12 * k; dg.g.position.y = 0.12 + 0.06 * k;
      if (ph < dt && Math.hypot(dg.g.position.x - p.x, dg.g.position.z - p.z) < 60) Audio.sfx('dog_bark', { pos: dg.g.getWorldPosition(_w), vol: 0.8 });
    }
    // hazard lights, the police lights far off
    const hz = Math.floor(t / 0.45) % 2 === 0; for (const h of D.hazards) h.visible = hz;
    const fl = Math.floor(t / 0.22) % 2; D.flash[0].visible = !!fl; D.flash[1].visible = !fl;
    D.bridge.position.set(car.position.x * 0.55, 0, car.position.z * 0.55); D.sky.position.set(car.position.x, -40, car.position.z);
    // the truck, tied to the car's approach so that they meet
    const T = D.truck, gap = (S_RB - s) * K_TRUCK;
    T.g.visible = gap < 95;
    T.g.position.copy(T.hit).addScaledVector(T.dir, -(gap + 3.9)); T.g.rotation.y = Math.atan2(T.dir.x, T.dir.z);
    if (D.crash) { T.g.localToWorld(D.sun.position.set(0, 1.1, 4.2)).sub(A.origin); D.sun.target.position.set(p.x, 1, p.z); D.sun.color.set(0xfff4e8); D.sun.intensity = 45 * U.clamp(1 - gap / 25) + 8; }
    if (D.lookTruck) Play.forceLook(T.g.localToWorld(_w.set(0, 1.5, 3.6)), 0.8);
    // the woman at the window walks with the car, her hand and phone on the glass
    const W = D.woman;
    if (W && W.on) {
      W.k = Math.min(1, W.k + dt / 0.35);
      const tgt = D.body.localToWorld(_w.set(-1.2, 0, -0.5)); tgt.y = 0;
      W.c.root.position.lerpVectors(W.from, tgt, U.smooth(W.k)); W.c.yaw = yaw + PI / 2 - 0.2;
      W.c.setMove(D.v * W.k);
      const T2 = W.c.ikT || (W.c.ikT = {}); T2.R = { p: D.body.localToWorld(W.hand.set(WINDOW[0] - 0.03, WINDOW[1], WINDOW[2])), w: U.smooth(W.k) };
    }
  }

  CONTENT.levels.P3 = {
    name: 'Redcliffe streets', origin: [0, 0, 1500],
    grade: 'launch_night', fog: { color: 0x14151e, near: 12, far: 140 },
    env: { top: 0x0e1628, horizon: 0x2a2226, bottom: 0x060606, intensity: 0.6, spots: [{ dir: [0.3, 0.25, 0.6], color: 0xff9a40, power: 2 }] },
    background: 0x0c0d14, amb: 'car_interior', surface: 'concrete',
    build(A) {
      route();
      const D = A.data, r = U.rng(3107), W = batcher(), win = winMats(), figs = [];
      Object.assign(D, { s: S0, v: 10.5, acc: 0, run: false, stop: null, riders: new Map(), grip: { L: V(), R: V(), C: V(), K: V() }, chaseArm: 1, clip: new THREE.Plane(V(0, -1, 0), 1.1), people: [], blueSpots: [], win, loops: [] });
      Build.hemi({ sky: 0x3a4868, ground: 0x1a120c, intensity: 0.55 });
      buildCar(A);
      buildStreet(A);
      shops(A, W, win, figs, r); jetty(A, figs, r); suburbs(A, W, win, figs, r);
      porchFamily(A); dog(A); bus(A, figs, r); servo(A, W, win, figs, r); billboard(A); roundabout(A); far(A); sky(A);
      W.flush(A.group, { shadow: false });
      // real people: in the road, the jogger, the jetty's end, the café, the cluster in the road (and the woman)
      const face = (s, a) => at(s).yaw + a;
      for (const [s, u, a, sd] of [[104, -2.4, 0.4, 11], [116, 3.4, -2.2, 13], [131, -1.2, 2.8, 17]]) person(A, 'p3_road' + s, P3(s, u), face(s, a), { seed: sd });
      D.jogger = person(A, 'p3_jogger', P3(S_JOG, ROAD + 1.3, 0.14), face(S_JOG, 0), { seed: seedOf('f', 30) });
      for (const [dx, dz, a, sd] of [[3, 1.2, 2.1, 21], [5.5, -1.1, -0.6, 23]]) { const p = at(S_JETTY); person(A, 'p3_jetty' + sd, [20 + dx, 0.02, p.z + dz], a, { seed: sd }); }
      const cafe = at(S_CAFE, -ROAD - 1.6); person(A, 'p3_cafe', [cafe.x + 0.5, 0.14, cafe.z], faceRoad(S_CAFE, -1), { seed: seedOf('m', 40) });
      for (const [ds, u, a, sd] of [[-8, 2.6, 1.3, 41], [-1, 3.3, 2.6, 43], [6, 2.2, -0.4, 47], [-12, -3.9, 0.9, 51], [13, -3.6, 2.2, 53]]) person(A, 'p3_cluster' + sd, P3(S_CLUSTER + ds, u), face(S_CLUSTER, a), { seed: sd });
      D.woman = { c: person(A, 'p3_woman', P3(S_CLUSTER + 1, -2.3), face(S_CLUSTER, 2.4), { seed: seedOf('f', 60) }), on: false, k: 0, from: V(), hand: V() };
      for (const [s, u] of [[S_ROAD1, 0], [S_JETTY, 12], [S_CLUSTER, 0], [S_CAFE, -7]]) D.blueSpots.push({ pos: V(...P3(s, u, 1.5)), k: 1 });
      // the esplanade crowd: standing in the road (clear of the car's line), on the foreshore, along the seawall
      for (let s = 70; s < S_CLUSTER + 40; s += 5 + r() * 7) {
        const k = r(), u = k < 0.35 ? -1.4 - r() * 3.2 : k < 0.5 ? 3.4 + r() * 1.2 : ROAD + 1.4 + r() * 8;
        if (Math.abs(s - S_CLUSTER) < 20 && u > -2.6 && u < 3.3) continue;
        fig(figs, P3(s, u, u > ROAD ? (u < ROAD + 2.4 ? 0.14 : 0.02) : 0), at(s).yaw + r() * 6.28, r);
      }
      for (let s = 60; s < S_ESP; s += 9 + r() * 10) { const p = at(s); fig(figs, [17.6, 0.02, p.z + r() * 4], PI / 2 + (r() - 0.5) * 0.8, r); }
      crowd(A, figs);
      // lights: the lamp that sweeps the cabin (the one shadow caster), the blue of the nearest phones
      D.sun = Build.light('spot', { pos: [0, 8, 0], color: 0xffa640, intensity: 0, distance: 40, angle: 0.8, penumbra: 0.7, decay: 1.6, shadow: true });
      D.sun.shadow.mapSize.set(512, 512); D.sun.shadow.camera.near = 1; D.sun.shadow.camera.far = 30;
      D.blue = Build.light('point', { pos: [0, 1.5, 0], color: 0x4a7cff, intensity: 0, distance: 14, decay: 2 });
      D.ahead = Build.light('point', { pos: [0, 8, 0], color: 0xffa640, intensity: 0, distance: 34, decay: 1.5 });
      mergeStatics(A);
      A.update((dt, t) => drive(A, dt, t));
      drive(A, 0, 0);
    },
    unload(A) {
      const D = A.data;
      Play.forceLook(null); Play.lookMode(null); Game.timeScale = 1; Audio.muffle(0);
      for (const c of D.riders.keys()) { c.ikT = {}; c.lookAt(null); }
      if (D.bub) { D.bub.B.head.visible = true; D.bub.bodyMat.clippingPlanes = null; Engine.renderer.localClippingEnabled = false; if (D.bub.held('r')) D.bub.drop('r', { remove: true }); }
      for (const l of D.loops) l.stop(0.2);
    },
  };

  // ---- the beat ------------------------------------------------------------------------------------------------------
  CONTENT.hooks['prologue.P5'] = async G => {
    if (G.areaById('P3')) G.unload('P3');   // a retry starts from a fresh drive
    const A = await G.area('P3'), D = A.data;
    Director.stop(); UI.hud({ show: false }); UI.letterbox(false, 0); UI.phone(null);
    const chase = G.actor('chase', 'chase_young'), luke = G.actor('luke', 'luke_young'), bub = G.actor('bub', 'bub');
    for (const [id, c] of [['chase', chase], ['luke', luke], ['bub', bub]]) {
      const o = SEATS[id]; c.stop(); c.detach(); c.gesture(null); c.gesture('shrug', { dur: 0.05 }); c.setVisible(true); for (const h of ['r', 'l']) if (c.held(h)) c.drop(h, { remove: true });
      c.pose(o.pose, { direct: true, dur: 0.01 }); D.riders.set(c, Object.assign({}, o));
    }
    chase.decal('blood_knuckles'); bub.decal('tears'); bub.hold('phone', 'r');
    // Bub's own head and hair would fill her view: hide the head, clip the body above her collar
    bub.B.head.visible = false; bub.bodyMat.clippingPlanes = [D.clip]; Engine.renderer.localClippingEnabled = true;
    Object.assign(D, { bub, luke, chase });
    const eyes = () => Engine.camera.position, ahead = () => D.body.localToWorld(_v.set(-0.38, 1.0, 14)), chaseHead = () => chase.point('head');
    chase.lookAt(eyes); chase.emote('tense'); luke.lookAt(ahead); luke.emote('tense');
    D.eye.getWorldPosition(Engine.camera.position);   // (characters near the camera animate every frame)
    for (let i = 0; i < 24; i++) { drive(A, 0, i / 30); Chars.update(1 / 30); }   // settle poses and hands before the first frame
    G.player(bub, { footsteps: false });
    Play.lookMode(D.eye, { yaw: [-2.3, 2.3], pitch: [-0.8, 0.6], fov: 66, startYaw: 0.4 });
    // compile and upload everything now (behind the cut), so turning her head never hitches
    Engine.renderer.compile(Engine.scene, Engine.camera);
    const texs = new Set(); Engine.scene.traverse(o => { for (const m of [].concat(o.material || [])) for (const k of ['map', 'normalMap', 'roughnessMap', 'emissiveMap', 'alphaMap']) if (m[k]) texs.add(m[k]); });
    for (const t of texs) Engine.renderer.initTexture(t);
    G.control(true);
    D.run = true;
    D.loops.push(Audio.loop('siren_far', { pos: D.sirenAt, vol: 0.5 }));
    G.fade('none', 0.8);
    const until = s => G.until(() => D.s >= s);
    const setRadio = txt => { D.radioText = txt; D.radioTex.userData.draw(); };
    // 1 — the esplanade: people standing in the road, the jogger, the jetty
    await until(S_JOG);
    await G.say('bub', "Dad, what's wrong with them?", { emote: 'afraid', to: 'chase' });
    await G.say('chase', "Don't look.", { emote: 'tense', pause: 0.5, to: eyes });
    // 2 — Luke brakes for the people in the road; a woman slaps her phone on Bub's window
    await until(S_CLUSTER - 70);
    luke.lookAt(() => D.woman.c.point('head')); luke.emote('afraid');
    await until(S_CLUSTER - 52); G.sfx('horn', { pos: D.car.getWorldPosition(_w), vol: 0.7 });
    const W = D.woman, womanHead = () => W.c.point('head');
    await until(S_CLUSTER - 6);
    W.c.turnTo(D.car.getWorldPosition(_w), 0.8); W.c.lookAt(eyes); Play.forceLook(womanHead(), 0.45);
    await until(S_CLUSTER - 1.4);
    W.from.copy(W.c.root.position); W.on = true; W.c.stop();
    G.sfx('whisper', { pos: womanHead() });
    await G.wait(0.3);
    D.slapPhone.visible = true; D.slapT = Game.time; if (W.c.held('r')) W.c.held('r').visible = false;
    G.sfx('knock', { pos: D.body.localToWorld(V(...WINDOW)), vol: 1.3 }); G.sfx('swipe', { pos: D.body.localToWorld(V(...WINDOW)) });
    Play.forceLook(D.body.localToWorld(V(...WINDOW)), 1); D.flinch = 0.07;
    await G.wait(0.35);
    Play.forceLook(chaseHead(), 1);
    chase.emote('afraid');
    for (let i = 1; i <= 8; i++) { D.reach = i / 8; await G.wait(1 / 30); }
    await G.wait(0.85);
    Play.forceLook(null);
    for (let i = 1; i <= 30; i++) { D.reach = 1 - U.smooth(i / 30); await G.wait(1 / 30); }
    await until(S_CLUSTER + 7);
    W.on = false; W.c.setMove(0); W.c.ikT = {}; W.c.lookAt(null); D.slapPhone.visible = false; if (W.c.held('r')) W.c.held('r').visible = true; D.slapT = null; D.flinch = 0;
    luke.lookAt(ahead);
    // the radio: every station the same
    await until(S_CLUSTER + 34);
    D.radio = true; luke.lookAt(() => D.body.localToWorld(_w.set(...RADIO)));
    const radioAt = () => D.body.localToWorld(V(...RADIO)), dj = D.dj = Audio.loop('radio_dj', { pos: radioAt(), vol: 0 }); D.loops.push(dj);
    for (const f of ['FM 92.1', 'FM 97.3', 'FM 101.1']) { setRadio(f); G.sfx('radio_static', { pos: radioAt(), vol: 0.6 }); dj.setVol(0); await G.wait(0.45); dj.setVol(0.7); await G.wait(0.9); }
    luke.lookAt(ahead); D.radio = false;
    await G.say('luke', "Every station's the same.", { emote: 'tense' });
    await G.say('radio_dj', '— no, wait, watch this, wait, this one, ha, wait—', { emote: 'laugh', via: 'radio' });
    await G.say('chase', 'Turn it off.', { emote: 'tense', to: 'luke' });
    D.radio = true; await G.wait(0.4); G.sfx('radio_click', { pos: radioAt() }); dj.stop(0.05); D.dj = null; setRadio(null); await G.wait(0.3); D.radio = false;
    // 3 — quiet; Chase turns to the road; Bub looks at the back of her dad's head
    await G.wait(1.2);
    const tw = D.riders.get(chase); chase.lookAt(ahead);
    for (let i = 1; i <= 45; i++) { const k = U.smooth(i / 45); tw.yaw = -0.95 * (1 - k); D.chaseArm = 1 - k; await G.wait(1 / 30); }
    await until(S_TALK - 25);
    Play.forceLook(chaseHead(), 0.35);
    await until(S_TALK);
    Play.forceLook(null);
    await G.say('bub', 'Is it the update? Is it the phones?', { emote: 'afraid', to: 'chase' });
    await G.say('chase', '…', { emote: 'ashamed', pause: 0.8 });
    await G.say('bub', 'Dad. You sold them all phones.', { emote: 'sad', pause: 1.4, to: 'chase' });
    // 4 — Chase can't answer. A truck runs the roundabout.
    chase.lookAt(() => D.body.localToWorld(_w.set(0.3, 0.6, 1.4))); chase.emote('ashamed');
    await until(S_RB - 26); G.sfx('truck_horn', { pos: D.truck.g.getWorldPosition(_w), vol: 1.2 });
    const tp = V(), truckAt = () => D.truck.g.getWorldPosition(tp);
    await until(S_RB - 18); D.lookTruck = true; luke.lookAt(truckAt); luke.emote('shocked'); chase.lookAt(truckAt); chase.emote('shocked');
    G.sfx('tyre_screech', { pos: D.truck.g.getWorldPosition(_w) });
    await until(S_RB - 9); D.crash = true;
    await until(S_RB - 1.1);
    Game.timeScale = 0.25; Audio.muffle(0.8);
    try { await until(S_RB); } finally { Game.timeScale = 1; Audio.muffle(0); }
    G.fade('black', 0); D.lookTruck = false; Play.forceLook(null); D.run = false;
    G.sfx('car_crash', { vol: 1.2 }); G.sfx('glass_break', { vol: 1 }); Audio.amb(null, 0.1);
    for (const l of D.loops.splice(0)) l.stop(0.05);
    await G.wait(4.4);   // the crash rings out over black, then a moment of silence
  };
})();
