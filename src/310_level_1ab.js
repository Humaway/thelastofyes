// ============================================================================
// Chapter 1 areas 1A (Chase's room above a dead laundromat) and 1B (the QZ streets), scene 1.1 (Ten Years Later), the 1.2
// walk through the Quarantine Zone with Wai, and the flow beats ch1.1 / ch1.2 (spec §9 1.1, 1.2; §17 the market talk).
// Owned by: level agent (c1a).
//
// 1A — origin [0,0,3000]. One narrow room, 3.4 x 5.8 m, window at the north (-z) end over the rooftops, door at the south
//   end (x -0.9) onto a dark landing and the stairs down. Mattress under the window along the east wall, a timber chair
//   beside it with the canvas jacket over its back (Bub's phone in the chest pocket), camp stove on a milk crate, a store
//   calendar with no dates crossed off, the laminated coverage map, a bucket under a leak. Dawn and rain on the window.
//   Markers: mk_start · mk_1a_lie (pelvis on the mattress) · mk_1a_stand · mk_1a_wai_door (outside the door) · mk_1a_wai ·
//   mk_1a_exit (the landing: walking onto it ends ch1.1).
// 1B — origin [400,0,3000]. The walled CBD after rain. +z is north. Route: out of the laundromat's side door (z 0) north up
//   Albert Street past the ration queue at the old yes store (z 14..28); across the street the alley the trainee is taken
//   into (x -8, z 34); the COMMS checkpoint (z 44..58) with its wall of smashed phones; the truck (z 62..72, east kerb) the
//   execution happens behind; the T-junction wall with the Landlines cord over a COMMS poster (z 88); west along the cross
//   street to the market of tarps (x -8..-34, z 80..100); the side gate in the inner wall (x -44, z 86) with its guard,
//   and the gap beside it (the squeeze that hides the load into 1C).
//   Markers: mk_start · mk_1b_chase / mk_1b_wai (the laundromat door) · mk_1b_gate (the guard) · mk_1b_squeeze (the gap).
// Persistent actors: chase (def 'chase'), wai (def 'wai', variant 'bruised'). Wai is scripted in 1A/1B (no companion agent);
// ch1.3 makes him a companion. ch1.2 resolves at the midpoint of the squeeze (camera tight on the wall): ch1.3 should load
// 1C at once and put Chase at the far side of a matching gap.
// ============================================================================
(() => {
  const PI = Math.PI, V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const M = (n, o) => Tex.mat(n, o), C = (h, o) => Tex.color(h, o);
  const H = CONTENT.hooks;
  const OA = [0, 0, 3000], OB = [400, 0, 3000];
  const wa = (x, y, z) => [OA[0] + x, y, OA[2] + z], wb = (x, y, z) => [OB[0] + x, y, OB[2] + z];
  const shared = t => { t.userData.shared = true; return t; };
  function canvas(w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }
  const once = (f => { const m = new Map(); return (k, fn) => m.get(k) || (m.set(k, shared(fn())), m.get(k)); })();
  const SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif';
  // an actor back to a clean state (a checkpoint can start from anywhere)
  function reset(c) {
    c.stop(); c.detach(); if (c.pairOf) c.pairOf.detach(); c.gesture(null); c.lookAt(null); c.emote('neutral'); c.setVisible(true); c.badge(null);
    for (const h of ['r', 'l']) if (c.held(h)) c.drop(h, { remove: true });
    if (c.face && c.face.look) c.face.look.lidT = undefined;
    c.pose('stand', { direct: true, dur: 0.01 });
    const ag = AI.list.find(a => a.companion && a.char === c); if (ag) ag.dismiss();
  }
  function hideOthers(G, keep) { for (const id in G.actors) if (!keep.includes(id)) { const ag = AI.list.find(a => a.companion && a.char === G.actors[id]); if (ag) ag.dismiss(); G.actors[id].setVisible(false); } }
  // sitting up on the mattress with Bub's phone low in his right hand, head bowed over it (registered once, if the chars
  // module lacks it)
  function poses() {
    if (!Anim.POSES.sit_ground_phone) Anim.POSES.sit_ground_phone = { p: Anim.mk({ neck: [0.38, 0, 0], head: [0.22, 0.05, 0], armR: [0.42, 0.1, -0.25], foreR: [1.35, 0.7], handR: [0.2, 0.25], fingR: 0.8, fing2R: 0.6, thumbR: 0.2 }, Anim.POSES.sit_ground.p), seat: true };
  }
  function revolver() { if (!Play.inventory.weapons.includes('revolver')) { Play.give('revolver'); Play.give('revolver_ammo', 2); } }

  // ---- speakers, collectibles, remarks ---------------------------------------------------------------------------------
  CONTENT.speakers.loudspeaker = { name: 'LOUDSPEAKER', voice: [0.85, 0.85] };
  CONTENT.collectibles.artifacts.push(
    { id: 'c1_screen_offences', chapter: 'ch1', title: 'COMMS notice to residents', text:
      'COMMONWEALTH OFFICE OF MOBILE AND MEDIA SECURITY\nNOTICE TO RESIDENTS — BRISBANE QUARANTINE ZONE\n\nThe following are SCREEN OFFENCES:\n' +
      '1. Possession of a smartphone, tablet or any device with a display.\n2. Possession of a charger, cable or battery above 5 V without a permit.\n' +
      '3. Looking at a screen, or allowing another person to look at a screen.\n4. Failing to report a screen.\n5. Concealing a Badge.\n\n' +
      'Penalty for offences 1, 3 and 5: summary execution.\nPenalty for offences 2 and 4: loss of ration card.\n\nLOOK UP. STAY ALIVE.' },
    { id: 'c1_receipt_thread', chapter: 'ch1', title: 'Kiosk receipt, market', text:
      'A photo-kiosk receipt, the thermal print half gone. Someone printed a message thread to keep it.\n\n' +
      'u there\nu there??\nsorry was busy\nbusy doing what. ur online\nim not\nit literally says ur online\n' +
      'ok im watching something. one sec\nits been an hour\n2 secs\n\n(nothing after that)' });
  CONTENT.collectibles.lanyards.push(
    { id: 'c1_lanyard_valley', chapter: 'ch1', title: '—— · Store Manager · Fortitude Valley' },
    { id: 'c1_lanyard_indro', chapter: 'ch1', title: '—— · Customer Service · Indooroopilly' });
  CONTENT.collectibles.modules.push({ id: 'c1_module_greeting', chapter: 'ch1', title: 'Sales Training Module: The Warm Greeting', skill: 'listen_range' });

  // ===================================================================================================================
  // 1A — Chase's room
  // ===================================================================================================================
  // the calendar: a free store calendar, this month, no dates crossed off
  const calendarTex = () => once('c1_cal', () => canvas(256, 360, (g, w, h) => {
    g.fillStyle = '#e8e2d2'; g.fillRect(0, 0, w, h);
    const sky = g.createLinearGradient(0, 0, 0, 150); sky.addColorStop(0, '#8fb6c8'); sky.addColorStop(0.6, '#d8d0b0'); sky.addColorStop(1, '#c8b88a');
    g.fillStyle = sky; g.fillRect(10, 10, w - 20, 140);
    g.fillStyle = '#4a7a8a'; g.fillRect(10, 110, w - 20, 22); g.fillStyle = '#e0cc98'; g.fillRect(10, 128, w - 20, 22);
    g.fillStyle = '#f2c200'; g.fillRect(10, 150, w - 20, 26);
    g.fillStyle = '#1a1a1a'; g.font = `bold 18px ${SANS}`; g.textAlign = 'center'; g.fillText('yes  REDCLIFFE — SAY YES TO THE REST', w / 2, 169);
    g.font = `bold 24px ${SANS}`; g.fillStyle = '#2a2a2a'; g.fillText('FEBRUARY', w / 2, 204);
    g.font = `12px ${SANS}`; g.fillStyle = '#555';
    'SMTWTFS'.split('').forEach((d, i) => g.fillText(d, 26 + i * 34, 224));
    g.font = `15px ${SANS}`; g.fillStyle = '#333';
    for (let d = 1; d <= 28; d++) { const k = d + 2, x = 26 + (k % 7) * 34, y = 248 + Math.floor(k / 7) * 26; g.fillText(String(d), x, y); }
    g.strokeStyle = 'rgba(90,70,40,0.25)'; g.lineWidth = 1; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(10, 232 + i * 26); g.lineTo(w - 10, 232 + i * 26); g.stroke(); }
    const s = g.createRadialGradient(200, 300, 4, 200, 300, 90); s.addColorStop(0, 'rgba(120,90,40,0.35)'); s.addColorStop(1, 'rgba(120,90,40,0)'); g.fillStyle = s; g.fillRect(0, 0, w, h);
  }));
  // the laminated coverage map: Australia, the old network's coverage in blotches (he reads it backwards: white is safe)
  const mapTex = () => once('c1_map', () => canvas(512, 400, (g, w, h) => {
    g.fillStyle = '#f4f2ec'; g.fillRect(0, 0, w, h);
    const oz = [[70, 170], [120, 110], [190, 90], [215, 60], [250, 95], [300, 80], [330, 40], [350, 90], [395, 150], [440, 200], [445, 250], [410, 300], [360, 330], [310, 320], [270, 290], [220, 275], [160, 300], [100, 300], [70, 250]];
    g.beginPath(); oz.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fillStyle = '#ffffff'; g.fill(); g.strokeStyle = '#6a6a6a'; g.lineWidth = 2; g.stroke();
    g.save(); g.clip();
    const R = U.rng(7);
    for (const [cx, cy, r] of [[415, 240, 55], [380, 305, 50], [330, 318, 40], [120, 285, 34], [255, 290, 22], [405, 170, 26], [230, 90, 14], [150, 150, 10]]) {
      for (let i = 0; i < 14; i++) { const x = cx + (R() - 0.5) * r, y = cy + (R() - 0.5) * r * 0.8, rr = r * (0.3 + R() * 0.4); const gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, 'rgba(242,194,0,0.9)'); gr.addColorStop(0.7, 'rgba(242,160,0,0.45)'); gr.addColorStop(1, 'rgba(242,160,0,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, rr, 0, PI * 2); g.fill(); }
    }
    g.restore();
    g.fillStyle = '#1a1a1a'; g.font = `bold 22px ${SANS}`; g.fillText('yes  4G/5G COVERAGE', 20, 34);
    g.font = `13px ${SANS}`; g.fillStyle = '#4a4a4a'; g.fillText('Coverage is indicative only.', 20, 54);
    g.strokeStyle = '#c8261e'; g.lineWidth = 3; g.beginPath(); g.arc(425, 262, 7, 0, PI * 2); g.stroke();
    g.fillStyle = 'rgba(40,40,40,0.8)'; g.font = `italic 15px ${SANS}`; g.fillText('white = safe', 150, 360);
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(0, 0, w, h * 0.35);
  }));
  // rain on the glass: droplets, and rivulets that crawl down (the second layer scrolls)
  const dropsTex = () => once('c1_drops', () => { const t = canvas(256, 256, (g, w, h) => {
    const R = U.rng(3);
    for (let i = 0; i < 120; i++) {
      const x = R() * w, y = R() * h, r = 0.8 + R() * R() * 3;
      const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.75)'); gr.addColorStop(0.5, 'rgba(200,215,225,0.3)'); gr.addColorStop(1, 'rgba(120,140,150,0.05)');
      g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, r, r * 1.15, 0, 0, PI * 2); g.fill();
    }
  }); t.colorSpace = THREE.NoColorSpace; return t; });
  const trailsTex = () => once('c1_trails', () => { const t = canvas(256, 512, (g, w, h) => {
    const R = U.rng(11);
    g.lineCap = 'round';
    for (let i = 0; i < 16; i++) {
      let x = R() * w, y = R() * h; const len = 60 + R() * 220;
      g.strokeStyle = `rgba(230,240,245,${0.25 + R() * 0.3})`; g.lineWidth = 1 + R() * 2;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < len; k += 8) { x += (R() - 0.5) * 3; g.lineTo(x, (y + k) % h); }
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.arc(x, (y + len) % h, 2.5, 0, PI * 2); g.fill();
    }
  }); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace; return t; });
  // falling rain seen through a window (planes outside the glass; the texture scrolls)
  const streakTex = () => once('c1_streaks', () => { const t = canvas(128, 512, (g, w, h) => {
    const R = U.rng(5);
    for (let i = 0; i < 130; i++) { const x = R() * w, y = R() * h, l = 20 + R() * 50; const gr = g.createLinearGradient(x, y, x, y + l); gr.addColorStop(0, 'rgba(220,230,240,0)'); gr.addColorStop(1, `rgba(220,230,240,${0.25 + R() * 0.4})`); g.strokeStyle = gr; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 2, y + l); g.stroke(); }
  }); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; });
  const additive = (map, color, opacity) => new THREE.MeshBasicMaterial({ map, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });

  // a gradient sky dome (fog off): low dawn light along one side of the horizon
  function sky(r, horizon, zenith, glow, glowDir) {
    const g = new THREE.SphereGeometry(r, 24, 12), p = g.attributes.position, col = [], c = new THREE.Color(), h = new THREE.Color(horizon), z = new THREE.Color(zenith), w = new THREE.Color(glow);
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i) / r, dir = Math.atan2(p.getX(i), p.getZ(i));
      c.copy(h).lerp(z, U.smooth(U.clamp(y * 1.5 + 0.02))).lerp(w, Math.max(0, 1 - Math.abs(y - 0.04) * 7) * Math.max(0, Math.cos(dir - glowDir)) * 0.85);
      col.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return Build.mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }), { pos: [0, -20, 0], shadow: false, receive: false });
  }
  // simple city blocks: a box with a scatter of window squares (dark, a few lit) on the faces toward `face`
  function block(x, z, w, d, h, m, face, R, lit = 0.04, y0 = 0) {
    Build.box(w, h, d, m, { pos: [x, y0, z], solid: false });
    const win = C(0x0c0f10, { rough: 0.3, metal: 0.2 }), glow = C(0xffc88a, { emissive: 0xffb070, emissiveIntensity: 0.7 });
    const cols = Math.max(1, Math.floor((face === 'x' ? d : w) / 2.4)), rows = Math.max(1, Math.floor((h - 1.5) / 3.1));
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const u = -((face === 'x' ? d : w) / 2) + 1.2 + i * 2.4, y = y0 + 1.6 + j * 3.1, on = R() < lit;
      if (face === 'z') Build.box(1.1, 1.3, 0.05, on ? glow : win, { pos: [x + u, y, z + d / 2 + 0.01], solid: false, ao: false });
      else Build.box(0.05, 1.3, 1.1, on ? glow : win, { pos: [x - w / 2 - 0.01, y, z + u], solid: false, ao: false });
    }
  }
  // the canvas work jacket over the chair back (the phone is in its chest pocket)
  function jacket(pos, yaw) {
    const g = Build.group({ pos, yaw, dynamic: true }), cm = M('fabric', { color: 0x8a7552, side: THREE.DoubleSide });
    // folded over the top rail (y 0.95, z -0.19): the back hangs behind the chair back, the open fronts hang down the seat side
    const at = (u, v) => {
      const k = Math.abs(v), s = Math.sign(v) || 1, round = Math.min(k, 0.05) / 0.05;
      const wr = Math.sin(u * 23 + v * 7) * 0.006 + Math.sin(u * 9 - v * 13) * 0.01 * Math.min(1, k * 4);
      return [u * (1 + k * 0.18), 0.975 - 0.03 * round * round - Math.max(0, k - 0.05), -0.19 + s * (0.03 * Math.sin(round * PI / 2) + Math.max(0, k - 0.05) * 0.07) + wr];
    };
    const sheet = (u0, u1, v0, v1) => {
      const q = new THREE.PlaneGeometry(u1 - u0, v1 - v0, 7, 16), p = q.attributes.position;
      for (let i = 0; i < p.count; i++) { const r = at(p.getX(i) + (u0 + u1) / 2, p.getY(i) + (v0 + v1) / 2); p.setXYZ(i, r[0], r[1], r[2]); }
      q.computeVertexNormals(); return Build.mesh(q, cm, { parent: g });
    };
    sheet(-0.24, 0.24, -0.56, 0.08); sheet(-0.24, -0.012, 0.08, 0.5); sheet(0.012, 0.24, 0.08, 0.5);
    // the sleeves hang from the shoulders, the collar rolls over the rail
    for (const s of [-1, 1]) {
      const pts = [[s * 0.25, 0.94, -0.2], [s * 0.29, 0.74, -0.23], [s * 0.28, 0.54, -0.21], [s * 0.27, 0.38, -0.18]].map(q => new THREE.Vector3(...q));
      Build.mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.048, 7), cm, { parent: g });
    }
    Build.mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.44, 8), M('fabric', { color: 0x5e4a34 }), { pos: [0, 0.985, -0.19], rot: [0, 0, PI / 2], parent: g });
    // the chest pocket and its zip, on the right front
    const pk = at(0.13, 0.2);
    Build.mesh(new THREE.PlaneGeometry(0.12, 0.13), M('fabric', { color: 0x5e4a34, side: THREE.DoubleSide }), { pos: [pk[0], pk[1], pk[2] + 0.004], parent: g });
    Build.mesh(new THREE.BoxGeometry(0.11, 0.007, 0.008), C(0x2a2622, { metal: 0.6, rough: 0.4 }), { pos: [pk[0], pk[1] + 0.062, pk[2] + 0.008], parent: g });
    return g;
  }

  CONTENT.levels['1A'] = {
    name: "Chase's room", origin: OA, grade: 'qz_green',
    fog: { color: 0x6a7470, near: 4, far: 60 },
    env: { top: 0x3a4650, horizon: 0x6a6e6a, bottom: 0x1a1816, intensity: 0.45 },
    background: 0x6a7470, amb: 'qz_rain', surface: 'wood',
    build(A) {
      const D = A.data, R = U.rng(31);
      // the room
      const plaster = M('plaster', { color: 0xb8b2a2 }), ext = M('render', { color: 0x8a8678 });
      Build.room({ x: 0, z: 0, w: 3.4, d: 5.8, h: 2.7, wall: plaster, outside: ext, floor: M('floorboards', { color: 0x7a6a58, rough: 2.2 }), ceil: M('plaster', { color: 0xa8a294 }),
        doors: [{ side: 's', at: -0.9, w: 0.85, h: 2.05 }], windows: [{ side: 'n', at: 0.35, w: 1.3, h: 1.35, sill: 0.85 }], surface: 'wood' });
      Build.prop('window', { pos: [0.35, 0.85, -2.9], w: 1.3, h: 1.35, color: 0x9a9a8e, open: 0.85, worn: 0.8 });
      D.door = Build.prop('interior_door', { pos: [-0.9, 0, 2.9], yaw: PI, w: 0.85, worn: 0.9, dynamic: true });
      // damp, peeling, ten years of it
      Build.mesh(new THREE.PlaneGeometry(1.6, 1.4), new THREE.MeshStandardMaterial({ map: Tex.decal('water_stain'), transparent: true, depthWrite: false, roughness: 0.9 }), { pos: [-0.5, 2.695, 0.9], rot: [PI / 2, 0, 0], shadow: false });
      Build.decal('water_stain', { pos: [1.69, 1.9, 1.2], yaw: -PI / 2, w: 1.4, h: 1.8, opacity: 0.8 });
      Build.decal('water_stain', { pos: [-0.2, 1.6, -2.89], w: 3.2, h: 2, opacity: 0.6 });
      Build.decal('moss_patch', { pos: [0.35, 0.72, -2.89], w: 1.8, h: 0.5, opacity: 0.55 });
      Build.decal('crack', { pos: [-1.69, 1.8, 1.8], yaw: PI / 2, w: 1.2, h: 1.2 });
      // the bed, the chair, the jacket
      Build.prop('mattress', { pos: [0.95, 0, -1.5], worn: 0.7 });
      Build.prop('chair', { pos: [0.16, 0, -1.3], yaw: 0.35, kind: 'dining', worn: 0.8 });
      D.jacket = jacket([0.16, 0, -1.3], 0.35);
      // the stove on a milk crate, a pot, tins, water
      Build.prop('crate', { pos: [-1.25, 0, -2.3], kind: 'milk', worn: 0.5 });
      Build.prop('camp_stove', { pos: [-1.25, 0.32, -2.3], yaw: 0.4 });
      Build.scatter('cans', { box: [-1.55, -1.95, -0.9, -1.55], count: 6, seed: 3 });
      Build.prop('jerry_can', { pos: [-1.35, 0, -1.2], yaw: 1.2, color: 0x2a5a8a });
      Build.prop('cardboard_box', { pos: [-1.3, 0, 0.2], w: 0.5, h: 0.35, d: 0.4, open: true, worn: 0.8 });
      Build.prop('rubbish_bag', { pos: [1.3, 0, 2.3] });
      // the bucket under the leak
      Build.mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.28, 14, 1, true), C(0x6a6e6a, { metal: 0.6, rough: 0.5, side: THREE.DoubleSide }), { pos: [-0.5, 0.14, 0.9] });
      D.drip = Build.mesh(new THREE.CircleGeometry(0.14, 14), C(0x2a3438, { rough: 0.05, metal: 0.4 }), { pos: [-0.5, 0.2, 0.9], rot: [-PI / 2, 0, 0], shadow: false });
      // on the walls: the calendar, the coverage map, the notice slipped under the door
      Build.decal(calendarTex(), { pos: [-1.69, 1.25, -0.6], yaw: PI / 2, w: 0.34, h: 0.48, rough: 0.8 });
      Build.decal(mapTex(), { pos: [1.69, 1.05, -1.3], yaw: -PI / 2, w: 0.72, h: 0.56, rough: 0.25 });
      Build.prop('ceiling_light', { pos: [0, 2.7, 0], kind: 'bare', on: false });
      A.collectible({ at: [-0.75, 0.01, 2.45], kind: 'artifact', id: 'c1_screen_offences' });
      // outside: the rooftops of the QZ in the rain, a sky getting light
      sky(220, 0xa4aca6, 0x5e6a70, 0xe0cfb4, PI + 0.5);
      const bm = [M('render', { color: 0x6a6a60 }), M('brick', { color: 0x7a6a5a }), M('concrete', { color: 0x70726c })];
      for (const [x, z, w, d, h] of [[-7, -13, 9, 6, 3.9], [3.5, -16, 8, 7, 3.4], [12, -13, 7, 6, 4.2], [-14, -24, 9, 8, 9], [22, -26, 10, 8, 12], [-4, -45, 14, 10, 38], [16, -55, 12, 12, 48], [-22, -60, 12, 10, 30], [8, -95, 16, 14, 64]]) block(x, z, w, d, h, bm[(R() * 3) | 0], 'z', R, 0.05, -3.2);
      Build.mesh(new THREE.CylinderGeometry(1.1, 1.1, 1.8, 12), M('corrugated', { color: 0x6a6e66 }), { pos: [2.5, 0.2, -15], shadow: false });
      Build.box(40, 0.3, 30, M('concrete_wet', { color: 0x4a4e4a }), { pos: [0, -3.2, -14], solid: false });
      // falling rain through the window
      D.streaks = [];
      for (const [z, s, o] of [[-5, 1, 0.22], [-9, 1.6, 0.16]]) {
        const m = additive(streakTex().clone(), 0xc8d4dc, o); m.map.repeat.set(3 * s, 1.5 * s); m.map.needsUpdate = true;
        D.streaks.push(m.map); Build.mesh(new THREE.PlaneGeometry(14, 10), m, { pos: [0.3, 0, z], shadow: false, receive: false });
      }
      // rain on the glass (just inside it)
      const dm = new THREE.MeshBasicMaterial({ map: dropsTex(), transparent: true, opacity: 0.55, depthWrite: false, color: 0xc8d2d8 });
      Build.mesh(new THREE.PlaneGeometry(1.2, 1.25), dm, { pos: [0.35, 1.52, -2.87], shadow: false, receive: false });
      const tm = new THREE.MeshBasicMaterial({ map: trailsTex().clone(), transparent: true, opacity: 0.5, depthWrite: false, color: 0xc8d2d8 });
      tm.map.repeat.set(1, 0.5); tm.map.needsUpdate = true; D.trails = tm.map;
      Build.mesh(new THREE.PlaneGeometry(1.2, 1.25), tm, { pos: [0.35, 1.52, -2.865], shadow: false, receive: false });
      // the landing and the stairs down, dark but for the caged bulb
      Build.floor(-1.8, 2.97, 0.2, 4.3, M('concrete', { color: 0x5a5a54 }));
      Build.wall(-1.8, 4.3, 0.2, 4.3, 3, M('render', { color: 0x6a665a }));
      Build.wall(0.2, 2.97, 0.2, 4.3, 3, M('render', { color: 0x6a665a }));
      Build.wall(-1.8, 2.97, -1.8, 4.3, 3, M('render', { color: 0x6a665a }), { doors: [{ at: 0.66, w: 1.1, h: 2.4 }] });
      Build.box(2.2, 0.1, 1.5, M('plaster', { color: 0x6a665a }), { pos: [-0.8, 3, 3.6], solid: false });
      Build.stairs({ from: [-5.4, -2.9, 3.6], to: [-1.9, 0, 3.6], width: 1.1, mat: M('concrete', { color: 0x5a5a54 }) });
      Build.prop('ceiling_light', { pos: [-0.8, 3, 3.6], kind: 'caged', on: true, color: 0xffb870 });
      D.bulb = Build.light('point', { pos: [-0.8, 2.5, 3.95], color: 0xffa860, intensity: 2.4, distance: 2.2, decay: 1.2 });
      D.crack = Build.mesh(new THREE.PlaneGeometry(0.8, 0.03), new THREE.MeshBasicMaterial({ color: 0xffb870, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }), { pos: [-0.9, 0.012, 2.83], rot: [-PI / 2, 0, 0], shadow: false, receive: false });
      // light: the dawn through the window (the one shadow caster), a cool fill, dust in the shaft
      Build.hemi({ sky: 0x7a8894, ground: 0x2a241c, intensity: 0.7 });
      Build.light('point', { pos: [0.4, 1.4, -1.7], color: 0x98a6b2, intensity: 1.1, distance: 4.5, decay: 1.3 });   // the window's bounce
      D.key = Build.light('spot', { pos: [0.5, 2.75, -8], target: [0.1, 0.9, 0.6], color: 0xb4c2d0, intensity: 60, distance: 16, angle: 0.36, penumbra: 0.85, decay: 1.4, shadow: true });
      D.key.shadow.bias = -0.0004;
      Build.godray({ pos: [0.35, 2.1, -2.95], dir: [0.1, -0.55, 1], w: 1.2, h: 3.2, color: 0xc8d4dc, opacity: 0.12 });
      Build.dust({ box: [-0.4, 0.3, -2.8, 1.4, 2.2, -0.4], count: 90, color: 0xd8e0e4, size: 0.012, opacity: 0.5 });
      // marks
      A.marker('mk_start', [-0.5, 0, 0.6], 0);
      A.marker('mk_1a_lie', [0.95, 0.17, -1.45], 0);
      A.marker('mk_1a_stand', [0.55, 0, -0.75], PI * 0.9);
      A.marker('mk_1a_wai_door', [-0.9, 0, 3.7], PI);
      A.marker('mk_1a_wai', [-0.25, 0, 0.05], PI - 0.62);
      A.marker('mk_1a_waiout', [-0.9, 0, 3.8], 0);
      A.marker('mk_1a_exit', [-0.9, 0, 3.6], 0);
      D.loops = [Audio.loop('rain', { pos: A.w([0.35, 1.5, -3.4]), vol: 0.9 }), Audio.loop('drips', { pos: A.w([-0.5, 0.3, 0.9]), vol: 0.5 })];
      let dripT = 0.7, ring = 0;
      A.update((dt, t) => {
        for (const s of D.streaks) s.offset.y += dt * 1.9;
        D.trails.offset.y += dt * 0.035;
        if ((dripT -= dt) <= 0) { dripT = 1.3 + R() * 1.4; ring = 1; }
        ring = Math.max(0, ring - dt * 2.5); D.drip.scale.setScalar(1 + ring * 0.08);
      });
    },
    unload(A) { for (const l of A.data.loops) l.stop(0.3); },
  };

  // ---- 1.1 — Ten Years Later -------------------------------------------------------------------------------------------
  // The line of action runs down the room: Chase on the mattress at the window end, Wai at the door end. Every camera
  // stays on the west half of the room (Chase's right as he sits facing the door).
  CONTENT.scenes['1.1'] = {
    title: 'Ten Years Later', area: '1A', grade: 'qz_green', music: null,
    cast: { chase: 'mk_1a_lie', wai: 'mk_1a_wai_door' },
    start: { cut: true },
    shots: [
      // 1. Close on his eyes. Hold.
      { cam: { type: 'static', at: { of: 'chase', off: [0.1, 0.62, -0.5] }, look: 'chase.eyes', lens: 70, push: 0.04 }, dur: 6.2, focus: 'chase.eyes',
        actions: [{ t: 0, do: 'call', hook: 'c1.eyes', args: 0 }, { t: 2.4, do: 'call', hook: 'c1.eyes', args: 1 }, { t: 3.6, who: 'chase', do: 'emote', name: 'exhausted' }],
        cues: [{ t: 0, fade: 'none', dur: 2.2 }, { t: 0.6, title: ['BRISBANE QUARANTINE ZONE'], hold: 2.4 }] },
      // 2. He sits up on the mattress, the window grey behind him.
      { cam: { type: 'static', at: [OA[0] - 1.25, 1.05, OA[2] + 0.9], look: [OA[0] + 0.8, 0.7, OA[2] - 1.6], lens: 28 }, dur: 5.2, focus: 'chase',
        actions: [{ t: 0.3, who: 'chase', do: 'pose', name: 'sit_ground', dur: 1.6 }, { t: 1.2, who: 'chase', do: 'emote', name: 'exhausted' }, { t: 2.6, who: 'chase', do: 'lookAt', at: [OA[0] + 0.9, 0.2, OA[2] - 0.2] }, { t: 4.3, who: 'chase', do: 'lookAt', at: 'mk_1a_pocket' }] },
      // 3. The jacket on the chair: the phone out of the chest pocket.
      { cam: { type: 'static', at: [OA[0] - 0.35, 1.15, OA[2] + 0.1], look: [OA[0] + 0.62, 0.72, OA[2] - 1.5], lens: 35 }, dur: 3.8, focus: 'chase',
        actions: [{ t: 0.2, who: 'chase', do: 'gesture', name: 'grab', to: 'mk_1a_pocket' }, { t: 0.7, do: 'call', hook: 'c1.phone', args: true },
          { t: 1.3, who: 'chase', do: 'pose', name: 'sit_ground_phone', dur: 1.2 }, { t: 1.8, who: 'chase', do: 'lookAt', at: 'chase.hand_r' }],
        cues: [{ t: 0.55, sfx: 'craft', at: 'mk_1a_pocket', vol: 0.25, rate: 1.7 }] },
      // 4. He doesn't turn it on. His thumb across the dark glass.
      { cam: { type: 'static', at: { of: 'chase', off: [-0.22, 0.88, 0.58] }, look: 'chase.hand_r', lens: 70 }, dur: 5, focus: 'chase.hand_r',
        actions: [{ t: 1.2, who: 'chase', do: 'gesture', name: 'swipe', dur: 1.8 }, { t: 1.0, who: 'chase', do: 'emote', name: 'sad' }] },
      // 5. Insert: the beaded #1 DAD lanyard round his neck, the old staff ID on the end.
      { cam: { type: 'dolly', from: { of: 'chase', off: [0.1, 0.72, 0.55] }, to: { of: 'chase', off: [0.1, 0.6, 0.52] }, look: { of: 'chase', off: [0, 0.62, 0.15] }, lookTo: { of: 'chase', off: [0, 0.4, 0.17] }, lens: 60, dur: 3.8 }, dur: 4, focus: { of: 'chase', off: [0, 0.45, 0.17] } },
      // 6. The phone back in the pocket. The zip.
      { cam: { type: 'static', at: [OA[0] - 0.35, 1.15, OA[2] + 0.1], look: [OA[0] + 0.62, 0.72, OA[2] - 1.5], lens: 35 }, dur: 4.2, focus: 'chase',
        actions: [{ t: 0, who: 'chase', do: 'pose', name: 'sit_ground', dur: 0.6 }, { t: 0.3, who: 'chase', do: 'gesture', name: 'hand_over', to: 'mk_1a_pocket' }, { t: 1.0, do: 'call', hook: 'c1.phone', args: false },
          { t: 1.1, who: 'chase', do: 'lookAt', at: null }, { t: 2.4, who: 'chase', do: 'gesture', name: 'rub_palm' }],
        cues: [{ t: 1.35, sfx: 'craft', at: 'mk_1a_pocket', vol: 0.3, rate: 1.5 }] },
      // 7. A knock: three, a pause, one. Wai lets himself in.
      { cam: { type: 'static', at: [OA[0] + 1.3, 1.02, OA[2] - 2.3], look: [OA[0] - 0.8, 1.15, OA[2] + 2.6], lens: 32 }, dur: 8.4, focus: { rack: ['chase', 'wai'], at: 4.2, dur: 1 },
        actions: [{ t: 1.0, who: 'chase', do: 'lookAt', at: 'mk_1a_door' }, { t: 4.1, do: 'call', hook: 'c1.door', args: 1 },
          { t: 4.4, who: 'wai', do: 'walkTo', at: 'mk_1a_wai', speed: 1.1 }, { t: 6.4, do: 'call', hook: 'c1.door', args: 0 }, { t: 6.0, who: 'chase', do: 'lookAt', at: 'wai' }],
        cues: [{ t: 0.5, sfx: 'door_knock', at: 'mk_1a_door', vol: 0.9 }, { t: 2.9, sfx: 'knock', at: 'mk_1a_door', vol: 0.9 }, { t: 4.1, sfx: 'door_open', at: 'mk_1a_door', vol: 0.7 }, { t: 6.6, sfx: 'door_slam', at: 'mk_1a_door', vol: 0.25 }] },
      { cam: { type: 'ots', over: 'chase', on: 'wai', side: 'right' }, hold: 0.4,
        lines: [{ who: 'wai', text: 'Morning, sunshine.', emote: 'smirk', pause: 0.2 }] },
      { cam: { type: 'ots', over: 'wai', on: 'chase' }, hold: 0.3,
        lines: [{ who: 'chase', text: 'You look like shit.', emote: 'neutral', pause: 0.5 }] },
      { cam: { type: 'ots', over: 'chase', on: 'wai' }, hold: 0.2,
        actions: [{ t: 0.1, who: 'wai', do: 'gesture', name: 'shrug' }],
        lines: [{ who: 'wai', text: "I've been robbed, is what I've been.", emote: 'angry', pause: 0.3 }] },
      { cam: { type: 'ots', over: 'wai', on: 'chase' }, hold: 0.2,
        lines: [{ who: 'chase', text: 'How much?', emote: 'tense', pause: 0.3 }] },
      { cam: { type: 'ots', over: 'chase', on: 'wai', push: 0.05 }, hold: 0.3,
        actions: [{ t: 1.4, who: 'wai', do: 'gesture', name: 'wave_off' }],
        lines: [{ who: 'wai', text: 'All of it. Radios, cells, the flip phones. Forty bars of stock.', emote: 'exhausted', pause: 0.3 }] },
      { cam: { type: 'ots', over: 'wai', on: 'chase' }, hold: 0.2,
        lines: [{ who: 'chase', text: 'Who?', emote: 'tense', pause: 0.2 }] },
      { cam: { type: 'close', who: 'wai', push: 0.06 }, hold: 0.5,
        lines: [{ who: 'wai', text: 'The Wholesaler.', emote: 'angry', pause: 0.4 }] },
      // Chase stands, pulling on his boots
      { cam: { type: 'two_shot', a: 'chase', b: 'wai', lens: 32 }, dur: 4.6, focus: 'chase',
        actions: [{ t: 0.1, who: 'chase', do: 'pose', name: 'stand', dur: 1.2 }, { t: 0.2, who: 'chase', do: 'walkTo', at: 'mk_1a_stand', speed: 0.7 }, { t: 2.2, who: 'chase', do: 'pose', name: 'crouch', dur: 0.6 },
          { t: 2.6, who: 'chase', do: 'gesture', name: 'grab', to: { of: 'chase', off: [0.12, 0.1, 0.25] } }],
        lines: [{ who: 'chase', text: 'He owes us.', emote: 'tense', pause: 1.2 }] },
      { cam: { type: 'ots', over: 'chase', on: 'wai' }, hold: 0.3,
        actions: [{ t: 2.6, who: 'wai', do: 'gesture', name: 'push_glasses' }, { t: 1.0, who: 'chase', do: 'gesture', name: 'grab', to: { of: 'chase', off: [-0.1, 0.1, 0.3] } }],
        lines: [{ who: 'wai', text: 'He did. Now he owes us everything plus a black eye.', emote: 'smirk', pause: 0.3 }, { who: 'wai', text: "Word is he's been selling to the Landlines.", emote: 'tense', pause: 0.7 }] },
      { cam: { type: 'ots', over: 'wai', on: 'chase' }, hold: 0.3,
        actions: [{ t: 0.9, who: 'chase', do: 'pose', name: 'stand', dur: 0.8 }],
        lines: [{ who: 'chase', text: "Then he's dumber than he looks.", emote: 'smirk', pause: 0.4 }] },
      { cam: { type: 'ots', over: 'chase', on: 'wai', push: 0.04 }, hold: 0.1,
        actions: [{ t: 2.6, who: 'wai', do: 'turnTo', to: 'mk_1a_door' }],
        lines: [{ who: 'wai', text: "Get your boots on. We're doing a stock-take.", emote: 'smile', pause: 0.3 }] },
      // He takes the jacket, and follows Wai out.
      { cam: { type: 'static', at: [OA[0] - 1.2, 1.55, OA[2] - 2.2], look: [OA[0] - 0.4, 1.1, OA[2] + 0.4], lens: 28 }, dur: 4.4, focus: 'chase',
        actions: [{ t: 0, do: 'call', hook: 'c1.jacket' }, { t: 0.1, who: 'chase', do: 'gesture', name: 'pull_collar' }, { t: 0.3, do: 'call', hook: 'c1.door', args: 1 },
          { t: 0.2, who: 'wai', do: 'walkTo', at: 'mk_1a_waiout', speed: 1.3 }, { t: 1.4, who: 'chase', do: 'walkTo', at: 'mk_1a_follow', speed: 1.2 }],
        cues: [{ t: 0.3, sfx: 'door_open', at: 'mk_1a_door', vol: 0.5 }] },
    ],
    end: { place: { chase: 'mk_1a_follow' }, pose: { chase: 'stand' }, call: { hook: 'c1.after' } },
    exit: { blend: 'gameplay', dur: 1.2 },
  };

  const A1 = () => Game.areas.get('1A');
  H['c1.eyes'] = (G, open) => { const f = G.who('chase').face; if (f && f.look) f.look.lidT = open ? undefined : 0; };
  H['c1.phone'] = (G, on) => { const c = G.who('chase'); if (on) c.hold('phone_cracked', 'r'); else c.drop('r', { remove: true }); };
  H['c1.door'] = (G, v) => {
    const A = A1(); if (!A) return;
    const D = A.data, from = D.doorV ?? 0, t0 = G.t;
    if (D.doorTw) A.updaters.splice(A.updaters.indexOf(D.doorTw), 1);
    D.doorTw = A.update(() => { const k = U.smooth(U.clamp((G.t - t0) / 0.9)); D.doorV = U.lerp(from, v, k); D.door.userData.setOpen(D.doorV * 0.62); D.crack.visible = D.doorV < 0.05; });
  };
  H['c1.jacket'] = G => { const A = A1(), c = G.who('chase'); if (A) A.data.jacket.visible = false; if (!c.parts.jacket) c.setPart('jacket', true); };
  H['c1.after'] = G => {
    H['c1.jacket'](G); H['c1.eyes'](G, 1);
    const c = G.who('chase'); if (c.held('r')) c.drop('r', { remove: true });
    const A = A1(); if (A && (A.data.doorV ?? 0) < 0.9) H['c1.door'](G, 1);
  };

  H['ch1.1'] = async G => {
    G.fade('black', 0); UI.hud({ show: false }); UI.letterbox(false, 0);
    G.unload('1A');                                             // a retry starts from a fresh room (door shut, jacket on the chair)
    const A = await G.area('1A');
    poses();
    const chase = G.actor('chase', 'chase'), wai = G.actor('wai', 'wai');
    reset(chase); reset(wai); hideOthers(G, ['chase', 'wai']);
    if (chase.parts.jacket !== false) chase.setPart('jacket', false);
    wai.decal('bruise', true);
    A.marker('mk_1a_pocket', [0.24, 0.84, -1.49], 0);
    A.marker('mk_1a_door', [-0.9, 1.4, 2.9], 0);
    A.marker('mk_1a_follow', [-0.75, 0, 1.9], 0);
    G.place(chase, 'mk_1a_lie'); chase.pose('lie', { direct: true, dur: 0.01 }); H['c1.eyes'](G, 0);
    G.place(wai, 'mk_1a_wai_door');
    revolver();
    G.player(chase, { combat: false, hud: false, run: 0 });
    G.control(false);
    await G.scene('1.1');
    G.control(true);
    wai.walkTo([OA[0] - 0.9, 0, OA[2] + 3.9], { speed: 1.3 }).then(() => wai.walkTo([OA[0] - 1.7, 0, OA[2] + 3.6], { speed: 1.2 })).then(() => wai.setVisible(false));
    await G.zone({ box: [OA[0] - 1.8, OA[2] + 3.1, OA[0] + 0.2, OA[2] + 4.4] });
    G.control(false);
  };
})();
