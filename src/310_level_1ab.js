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
// 1B — origin [400,0,3000]. The walled CBD after rain. +z is north. Route: out of the laundromat's side door (x 7, z 6)
//   north up Albert Street past the ration queue at the old yes store (east kerb, z 14..28); across the street the alley
//   the trainee is taken into (x -7..-22, z 29..33); the COMMS compound on the east kerb (z 29..64) with the truck (z 43)
//   the execution happens behind; the checkpoint across Albert St at the junction (queue z 60..66, T-walls faced with
//   smashed phones at z 68); the corner wall with the Landlines cord over a COMMS poster (x -12.6, z 55); west along the
//   cross street (z ~61) through the market of tarps (x -16..-40); the side gate in the inner cordon (x -45.8, z 58..63)
//   with its guard, and the gap beside it (z 57.6: the squeeze that hides the load into 1C).
//   Markers: mk_start · mk_1b_chase / mk_1b_wai (the laundromat door) · mk_1b_gate (the guard) · mk_1b_squeeze (the gap).
// Persistent actors: chase (def 'chase'), wai (def 'wai', bruise decal). Wai is scripted in 1A/1B (no companion agent);
// ch1.3 makes him a companion. ch1.2 resolves at the midpoint of the squeeze (camera tight on the wall, control off); ch1.3
// loads 1C and hard-cuts to its establishing shot (a time jump to the warehouse side door).
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
  // the plant: Chloe in just the trainee polo (seen from behind across a street, the eye has to find the yellow first), and
  // the two in hooded raincoats
  function defs() {
    const D = Chars.defs;
    if (!D.c1_trainee) D.c1_trainee = Object.assign({}, D.chloe, { outfit: D.chloe.outfit.filter(g => g.k !== 'hoodie') });
    if (!D.c1_raincoat) D.c1_raincoat = { gen: (R, s) => {
      const L = CharKit.civ(R, { worn: 1 }), col = ['#2e3a34', '#3a3c42', '#46402e'][s % 3];
      L.outfit = [{ k: 'tee', color: '#2a2a28' }, { k: 'pants', color: '#2a2c30', fab: 'denim', dirt: 0.5 }, ...L.outfit.filter(g => g.k === 'shoes'), { k: 'coat', color: col, fab: 'nylon', dirt: 0.4 }];
      L.acc = [{ k: 'hood_up', color: col }]; L.beard = null;
      return L;
    } };
  }
  function revolver() { if (!Play.inventory.weapons.includes('revolver')) { Play.give('revolver'); Play.give('revolver_ammo', 2); } }

  // ---- speakers, collectibles, remarks ---------------------------------------------------------------------------------
  CONTENT.speakers.loudspeaker = { name: '[LOUDSPEAKER]', voice: [0.85, 0.85] };   // always off-screen (a horn on a pole)
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
      Build.hemi({ sky: 0x7a8894, ground: 0x2a241c, intensity: 0.9 });
      Build.light('point', { pos: [0.3, 1.6, -1.2], color: 0x98a6b2, intensity: 2.2, distance: 6.5, decay: 1.1 });   // the window's bounce
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
      { cam: { type: 'dolly', from: { of: 'chase', off: [0.1, 0.56, 0.78] }, to: { of: 'chase', off: [0.1, 0.54, 0.7] }, look: { of: 'chase', off: [0, 0.52, 0.18] }, lens: 42, dur: 4 }, dur: 4, focus: 'chase.badge' },
      // 6. The phone back in the pocket. The zip.
      { cam: { type: 'static', at: [OA[0] - 0.35, 1.15, OA[2] + 0.1], look: [OA[0] + 0.62, 0.72, OA[2] - 1.5], lens: 35 }, dur: 4.2, focus: 'chase',
        actions: [{ t: 0, who: 'chase', do: 'pose', name: 'sit_ground', dur: 0.6 }, { t: 0.3, who: 'chase', do: 'gesture', name: 'hand_over', to: 'mk_1a_pocket' }, { t: 1.0, do: 'call', hook: 'c1.phone', args: false },
          { t: 1.1, who: 'chase', do: 'lookAt', at: null }, { t: 2.4, who: 'chase', do: 'gesture', name: 'rub_palm' }],
        cues: [{ t: 1.35, sfx: 'craft', at: 'mk_1a_pocket', vol: 0.3, rate: 1.5 }] },
      // 7. A knock: three, a pause, one. His head comes up.
      { cam: { type: 'close', who: 'chase', lens: 60, push: 0.04 }, dur: 3.9, focus: 'chase',
        actions: [{ t: 1.0, who: 'chase', do: 'lookAt', at: 'mk_1a_door' }, { t: 1.1, who: 'chase', do: 'emote', name: 'tense' }],
        cues: [{ t: 0.5, sfx: 'door_knock', at: 'mk_1a_door', vol: 0.9 }, { t: 2.9, sfx: 'knock', at: 'mk_1a_door', vol: 0.9 }] },
      // Wai lets himself in (from where Chase sits, low, the west side of the room)
      { cam: { type: 'static', at: [OA[0] + 0.45, 0.95, OA[2] - 1.05], look: [OA[0] - 0.8, 1.2, OA[2] + 2.9], lens: 32 }, dur: 4.5, focus: 'wai',
        actions: [{ t: 0.2, do: 'call', hook: 'c1.door', args: 1 }, { t: 0.5, who: 'wai', do: 'walkTo', at: 'mk_1a_wai', speed: 1.1 },
          { t: 2.1, who: 'chase', do: 'lookAt', at: 'wai' }, { t: 2.5, do: 'call', hook: 'c1.door', args: 0 }],
        cues: [{ t: 0.2, sfx: 'door_open', at: 'mk_1a_door', vol: 0.7 }, { t: 2.7, sfx: 'door_slam', at: 'mk_1a_door', vol: 0.25 }] },
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

  // ===================================================================================================================
  // 1B — the QZ streets
  // ===================================================================================================================
  // upper-floor windows for a 12 x 9.6 m bay of facade (4 x 3 windows): dark glass, broken panes, boarded, a curtain, an air
  // conditioner rusting under a sill, a COMMS cross on a condemned one. Cut-out decal over the wall material.
  const winTex = k => once('c1_win' + k, () => canvas(512, 410, (g, w, h) => {
    const R = U.rng(40 + k), bw = w / 4, fh = h / 3;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
      const x = c * bw + bw * 0.27, y = r * fh + fh * 0.18, ww = bw * 0.46, wh = fh * 0.55, t = R();
      g.fillStyle = '#3a3a36'; g.fillRect(x - 5, y - 5, ww + 10, wh + 12);                       // frame and sill
      const gl = g.createLinearGradient(x, y, x + ww, y + wh); gl.addColorStop(0, '#5a6668'); gl.addColorStop(0.45, '#1c2224'); gl.addColorStop(1, '#0c1012');
      g.fillStyle = gl; g.fillRect(x, y, ww, wh);
      if (t < 0.18) { g.fillStyle = '#050606'; g.beginPath(); g.moveTo(x + ww * 0.2, y); g.lineTo(x + ww * 0.7, y + wh * 0.6); g.lineTo(x + ww, y + wh * 0.2); g.lineTo(x + ww, y + wh); g.lineTo(x, y + wh); g.lineTo(x, y + wh * 0.3); g.fill(); }
      else if (t < 0.36) { g.fillStyle = '#8a7a5a'; for (let i = 0; i < 4; i++) { g.save(); g.translate(x + ww / 2, y + wh * (0.15 + i * 0.24)); g.rotate((R() - 0.5) * 0.25); g.fillRect(-ww * 0.6, -6, ww * 1.2, 12); g.restore(); } }
      else if (t < 0.5) { g.fillStyle = ['#8a5a4a', '#6a7a6a', '#b8a888'][(R() * 3) | 0]; g.fillRect(x + 2, y + 2, ww * 0.4, wh - 4); }
      else if (t < 0.56) { g.strokeStyle = '#d8d0b8'; g.lineWidth = 6; g.beginPath(); g.moveTo(x, y); g.lineTo(x + ww, y + wh); g.moveTo(x + ww, y); g.lineTo(x, y + wh); g.stroke(); }
      g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(x + 3, y + 3, ww * 0.3, wh * 0.35);
      if (R() < 0.3) { g.fillStyle = '#9a9a92'; g.fillRect(x + ww * 0.1, y + wh + 10, ww * 0.55, fh * 0.13); g.fillStyle = '#6a3a22'; g.fillRect(x + ww * 0.1, y + wh + 10 + fh * 0.13, ww * 0.55, 3); }
      g.fillStyle = 'rgba(40,30,20,0.35)'; g.fillRect(x - 2, y + wh + 7, ww + 4, fh * 0.2 * R());   // rust streaks under the sill
    }
  }));
  // the checkpoint's wall of smashed phones: one screen texture (black glass, cracks, a few still faintly lit)
  const deadScreen = () => once('c1_dead', () => canvas(128, 256, (g, w, h) => {
    g.fillStyle = '#0a0c0e'; g.fillRect(0, 0, w, h);
    const R = U.rng(17); g.strokeStyle = 'rgba(210,225,235,0.55)'; g.lineWidth = 1.2;
    const cx = w * (0.3 + R() * 0.4), cy = h * (0.3 + R() * 0.4);
    for (let i = 0; i < 11; i++) { g.beginPath(); g.moveTo(cx, cy); let x = cx, y = cy; const a = R() * PI * 2; for (let k = 0; k < 5; k++) { x += Math.cos(a + (R() - 0.5)) * 30; y += Math.sin(a + (R() - 0.5)) * 30; g.lineTo(x, y); } g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(4, 4, w * 0.4, h);
  }));
  function mosaic(x1, x2, z, y1, y2, R) {
    const geo = new THREE.BoxGeometry(0.075, 0.15, 0.012), mats = [], cols = [], c = new THREE.Color(), q = new THREE.Quaternion(), e = new THREE.Euler(), m = new THREE.Matrix4();
    for (let y = y1; y < y2; y += 0.13) for (let x = x1; x < x2; x += 0.085) {
      if (R() < 0.08) continue;
      e.set((R() - 0.5) * 0.12, (R() - 0.5) * 0.12, (R() - 0.5) * 1.4);
      m.compose(new THREE.Vector3(x + (R() - 0.5) * 0.04, y + (R() - 0.5) * 0.05, z + R() * 0.008), q.setFromEuler(e), new THREE.Vector3(1, 1, 1));
      mats.push(m.clone()); c.setHSL(0.55 + R() * 0.1, 0.1, 0.35 + R() * 0.65); if (R() < 0.04) c.setRGB(0.5, 0.75, 1.6); cols.push(c.clone());
    }
    const mat = new THREE.MeshStandardMaterial({ map: deadScreen(), roughness: 0.18, metalness: 0.3, color: 0xffffff });
    return Build.instanced(geo, mat, mats, { colors: cols, shadow: false });
  }
  // a street block: a solid box whose street face gets windows above a ground-floor band. face: 'px' 'nx' 'pz' 'nz'
  const FACE = { px: [1, 0, PI / 2], nx: [-1, 0, -PI / 2], pz: [0, 1, 0], nz: [0, -1, PI] };
  function block1b(x1, z1, x2, z2, h, [m, tint], face, k = 0) {
    Build.box(x2 - x1, h, z2 - z1, m, { pos: [(x1 + x2) / 2, 0, (z1 + z2) / 2], tint });
    const [fx, fz, yaw] = FACE[face], along = fx ? z2 - z1 : x2 - x1, n = Math.max(1, Math.round(along / 12)), seg = along / n;
    const fX = fx > 0 ? x2 + 0.02 : fx < 0 ? x1 - 0.02 : 0, fZ = fz > 0 ? z2 + 0.02 : fz < 0 ? z1 - 0.02 : 0;
    const top = Math.min(h - 0.8, 13.2), hh = top - 3.6;
    if (hh > 2) for (let i = 0; i < n; i++) {
      const u = (fx ? z1 : x1) + seg * (i + 0.5);
      Build.decal(winTex(0), { pos: fx ? [fX, 3.6 + hh / 2, u] : [u, 3.6 + hh / 2, fZ], yaw, w: seg, h: hh, cutout: true });
    }
    // a concrete awning band over the shopfronts
    Build.box(fx ? 1.3 : along, 0.22, fx ? along : 1.3, M('concrete'), { tint: 0x8a8880, pos: fx ? [fX + fx * 0.63, 3.2, (z1 + z2) / 2] : [(x1 + x2) / 2, 3.2, fZ + fz * 0.63], solid: false });
    return { at: (u, y = 0, out = 0) => fx ? [fX + fx * out, y, u] : [u, y, fZ + fz * out], yaw };
  }
  // a hand-made sign board (hand-painted text on plywood)
  const hand = (text, o) => Build.sign(Object.assign({ tex: Tex.sign('hand', text) }, o));
  // tarp canopy on four poles, sagging in the middle
  function canopy(x1, z1, x2, z2, h, color) {
    const q = new THREE.PlaneGeometry(x2 - x1, z2 - z1, 6, 6), p = q.attributes.position, c = new THREE.Color(color), col = []; q.rotateX(-PI / 2);
    for (let i = 0; i < p.count; i++) { const x = p.getX(i) / (x2 - x1) * 2, z = p.getZ(i) / (z2 - z1) * 2; p.setY(i, -(1 - x * x) * (1 - z * z) * 0.28 + Math.sin(x * 7 + z * 5) * 0.02); col.push(c.r, c.g, c.b); }
    q.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); q.translate((x1 + x2) / 2, h, (z1 + z2) / 2); q.computeVertexNormals();
    for (const [x, z] of [[x1, z1], [x2, z1], [x1, z2], [x2, z2]]) Build.box(0.05, h, 0.05, M('metal'), { pos: [x, 0, z], solid: false, tint: 0x6a6a64 });
    return q;
  }
  // a horn loudspeaker cluster on a pole (the COMMS loop)
  function loudspeaker(x, z, yaw) {
    Build.prop('power_pole', { pos: [x, 0, z], yaw, h: 8.5 });
    const hm = C(0xd8d4c8, { rough: 0.5, metal: 0.3 });
    for (const a of [-0.5, 0.5]) {
      const cone = Build.mesh(new THREE.CylinderGeometry(0.28, 0.06, 0.55, 12, 1, true), C(0xd8d4c8, { rough: 0.5, metal: 0.3, side: THREE.DoubleSide }), { pos: [x + Math.sin(yaw + a) * 0.35, 6.4, z + Math.cos(yaw + a) * 0.35], shadow: false });
      cone.rotation.set(PI / 2 - 0.25, yaw + a, 0, 'YXZ');
    }
    Build.box(0.25, 0.3, 0.2, hm, { pos: [x, 6.2, z], solid: false });
    return A1b().w([x, 6.3, z]);
  }
  const A1b = () => Game.areas.get('1B') || Build.A;
  // one mesh per material for every static thing Build made (a long street spans many of Build's 24 m cells)
  function mergeStatics(A) {
    A.group.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(A.group.matrixWorld).invert(), buckets = new Map(), m = new THREE.Matrix4();
    A.group.traverse(o => {
      if (!o.isMesh || !o.userData.batch || o.isInstancedMesh) return;
      const k = [o.material.uuid, o.castShadow, o.renderOrder, !!o.geometry.index, Object.keys(o.geometry.attributes).sort()].join('|');
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
  const LEAD = {   // Wai's walk, area-local [x, z]; the numbered stops are the beats
    start: [4.6, 5.4], ration: [2.5, 17.8], plant: [0.6, 25], check: [-2.5, 51.4], corner: [-5.2, 57.5],
    wall: [-10.5, 60.4], market: [-26.2, 60.6], gate: [-42.9, 60.2], gap: [-44.4, 57.6], lane: [-48.3, 58.3],
  };
  const ROUTE = ['start', [3.4, 10.5], 'ration', 'plant', [-1.2, 31], [-2.2, 42], 'check', 'corner', 'wall', [-17, 60.8], 'market', [-34, 60.8], 'gate', 'gap', 'lane'];

  CONTENT.levels['1B'] = {
    name: 'The QZ', origin: OB, grade: 'qz_green',
    fog: { color: 0x7c8680, density: 0.021 },
    env: { top: 0x8a969a, horizon: 0xa6aca4, bottom: 0x2a2a24, intensity: 0.6 },
    background: 0x7c8680, amb: 'qz_rain', surface: 'concrete',
    build(A) {
      const D = A.data, R = U.rng(1202);
      Build.hemi({ sky: 0x9aa8ae, ground: 0x3a362c, intensity: 0.9 });
      D.sun = Build.sun({ dir: [0.35, -0.8, 0.45], color: 0xc8ccc4, intensity: 1.1, area: 34, target: [-8, 0, 40] });
      sky(600, 0xa8b0aa, 0x6e7a80, 0xc8c0ac, 0.3);
      // ---- ground: Albert Street (N–S) and the cross street west to the inner cordon
      Build.road({ from: [0, -12], to: [0, 70], width: 8, lines: 'dashed', path: 3 });
      Build.road({ from: [-7, 61], to: [-46, 61], width: 7, lines: 'none', path: 3 });
      Build.road({ from: [0, 70], to: [0, 150], width: 8, lines: 'dashed', path: 3 });
      Build.floor(-7, 54.8, 7, 67.2, M('asphalt'), { y: 0.004 });
      for (const [x, z, r] of [[-2, 13.5, 1.6], [-1, 22, 1.4], [2.4, 38, 1.2], [-2.5, 49, 1.7], [-6, 44, 1], [-12, 63, 1.1], [-18.6, 60.7, 1.6], [-30, 58, 1.3]]) Build.decal('puddle', { pos: [x, 0.008, z], w: r * 2, h: r * 1.5, floor: true, spin: R() * 3, opacity: 0.8 });
      Build.grass({ box: [-7.2, -10, -6.6, 54], count: 260, height: 0.35, color: 0x5a6a3a });
      Build.grass({ box: [6.6, -10, 7.2, 28], count: 150, height: 0.35, color: 0x5a6a3a });
      Build.grass({ box: [-44, 54.9, -8, 55.4], count: 180, height: 0.3, color: 0x5a6a3a });
      Build.scatter('leaves', { box: [-7, -8, 7, 60], count: 260, seed: 3 });
      Build.scatter('debris', { box: [-44, 56, -8, 66], count: 60, seed: 7 });
      // ---- blocks. West side of Albert St (street face +x), east side (street face -x)
      const render = c => [M('render'), c], brick = c => [M('brick'), c];
      block1b(-20, -14, -7, 10, 11, render(0x8a8474), 'px', 0);
      block1b(-20, 10, -7, 29, 14, brick(0x7a5a48), 'px', 1);
      block1b(-20, 33, -7, 55, 12, render(0x7a8074), 'px', 2);
      block1b(-24, 67, -7, 92, 16, render(0x6e7068), 'px', 1);
      const laundro = block1b(7, -14, 20, 9, 8, render(0x9a9280), 'nx', 2);
      const store = block1b(7, 9, 20, 28, 10, render(0x8e8a7e), 'nx', 0);
      block1b(7, 28, 20, 40, 13, brick(0x6a5244), 'nx', 1);
      block1b(7, 45, 20, 68, 16, render(0x74786e), 'nx', 2);
      block1b(7, 68, 24, 96, 20, render(0x6a6c66), 'nx', 0);
      // the alley behind the truck, the alley the trainee is taken into
      Build.floor(7, 40, 20, 45, M('concrete_wet', { color: 0x5a5a54 }));
      Build.box(0.4, 6, 5, M('render'), { pos: [20, 0, 42.5], tint: 0x5a5a52 });
      Build.floor(-22, 29, -7, 33, M('concrete_wet', { color: 0x5a5a54 }));
      Build.box(0.3, 3, 4, M('metal_painted', { color: 0x3a4a3a }), { pos: [-22, 0, 31] });
      Build.prop('bin', { kind: 'skip', pos: [-13.5, 0, 29.9], yaw: PI / 2, worn: 0.8 });
      Build.prop('rubbish_bag', { pos: [-9.2, 0, 32.4], n: 3 });
      Build.decal(Tex.graffiti('17', { style: 'tally' }), { pos: [-15, 1.5, 32.97], yaw: PI, w: 1.2, h: 1.2, cutout: true });
      // cross street: south side (street face +z), north side (street face -z); the corner fig breaking the footpath
      block1b(-46, 40, -20, 55, 11, brick(0x7a6250), 'pz', 1);
      const north = block1b(-46, 67, -24, 84, 13, render(0x7e7a6c), 'nz', 0);
      Build.tree('fig', { pos: [-9, 0, 53.6], scale: 1.05, seed: 4 });
      Build.decal('crack', { pos: [-8.6, 0.06, 55.5], w: 3, h: 3, floor: true });
      // ---- north of the checkpoint, into the haze: the street keeps going, nobody on it
      block1b(-24, 92, -7, 150, 22, render(0x6a6c66), 'px', 2);
      block1b(7, 96, 24, 150, 28, render(0x686a66), 'nx', 1);
      for (const [x, z, w, d, h] of [[-30, 170, 20, 16, 60], [18, 190, 24, 20, 80], [-4, 230, 30, 20, 110]]) Build.box(w, h, d, M('render'), { pos: [x, 0, z], solid: false, tint: 0x6a6e6c });

      // ---- 1. the laundromat (Chase's building) and its side door
      Build.prop('shopfront', { pos: laundro.at(2, 0), yaw: laundro.yaw, w: 7.5, text: 'SUDS', faded: 1, lit: false, open: 0, broken: true });
      Build.box(0.05, 2.5, 7, M('plywood', { color: 0x8a7a60 }), { pos: laundro.at(2, 0, 0.06), solid: false });
      Build.decal(Tex.graffiti('GONE 99 — DON\'T OPEN', { style: 'drip', color: '#b8181e' }), { pos: laundro.at(1.2, 1.3, 0.1), yaw: laundro.yaw, w: 3.4, h: 1.25, cutout: true });
      Build.prop('front_door', { pos: laundro.at(6.2, 0), yaw: laundro.yaw + PI, open: 0.9, color: 0x3a4a3a, worn: 1, dynamic: true });
      Build.box(0.3, 2.3, 1.2, M('render'), { pos: laundro.at(6.2, 0, -0.2), tint: 0x14120e, solid: false });
      Build.prop('bin', { kind: 'wheelie', pos: [6.2, 0, -7.5], yaw: -1.2, worn: 0.8 });
      Build.vines({ box: [6.95, 2.6, -13, 7.0, 8, -6], density: 1.1, hang: true, seed: 2 });

      // ---- 2. the ration queue at the old store: RATIONS — PLEASE TAKE A NUMBER
      Build.prop('shopfront', { pos: store.at(18.5, 0), yaw: store.yaw, w: 11, text: 'ALBERT ST', faded: 0.85, lit: false, open: 0.25 });
      Build.sign({ tex: Tex.sign('ration', 'RATIONS — PLEASE TAKE A NUMBER'), w: 5.2, h: 1.6, pos: store.at(18.5, 2.35, 0.25), yaw: store.yaw, back: M('plywood') });
      hand('NOW SERVING 214', { pos: store.at(15.2, 1.1, 0.3), yaw: store.yaw, w: 0.9, h: 0.34, post: 0, back: M('plywood') });
      Build.prop('queue_barrier', { pos: [4.7, 0, 18.8], yaw: 0, points: [[0, 0], [0, 3], [0, 6], [0, 9.2]] });
      Build.prop('queue_barrier', { pos: [6.3, 0, 18.8], yaw: 0, points: [[0, 0], [0, 3], [0, 6], [0, 9.2]] });
      Build.poster('comms_look_up', { pos: store.at(23.4, 1.6, 0.03), yaw: store.yaw, w: 0.8, worn: 0.4 });
      Build.poster('comms_report', { pos: store.at(24.4, 1.6, 0.03), yaw: store.yaw, w: 0.8, worn: 0.6 });
      Build.vines({ box: [6.95, 3.4, 23, 7.0, 9.5, 27.8], density: 0.9, seed: 5, hang: true });
      D.loud = [loudspeaker(-4.7, 9, PI / 2), loudspeaker(-4.7, 38, PI / 2)];
      Build.wire([-4.7, 7.9, 9], [-4.7, 7.9, 38], { sag: 0.6 }); Build.wire([-4.7, 7.9, 9], [-7, 9.5, 2], { sag: 0.3 }); Build.wire([-4.7, 7.9, 38], [-7, 9, 46], { sag: 0.3 });
      // washing strung across the street between the upper floors: people still live up there
      for (const [z, y] of [[4, 6.4], [30.5, 7.2]]) {
        Build.wire([-7, y, z], [7, y + 0.3, z + 1], { sag: 0.7 });
        for (let i = 0; i < 7; i++) { const t = 0.15 + i * 0.1 + R() * 0.03, x = -7 + 14 * t, yy = y + 0.3 * t - 0.7 * 4 * t * (1 - t) - 0.02; Build.box(0.35 + R() * 0.3, 0.45 + R() * 0.3, 0.02, M('fabric'), { pos: [x, yy - 0.5, z + t], solid: false, tint: [0xb8a888, 0x8a3a3a, 0x3a5a7a, 0xd8d0c0, 0x5a6a4a][i % 5] }); }
      }

      // ---- 3. the COMMS compound on the east kerb (fenced: the truck and the alley behind it are theirs)
      for (const [z1, z2] of [[29, 38.6], [49.6, 64]]) Build.prop('fence', { kind: 'chainlink', pos: [3.9, 0, z1], yaw: -PI / 2, length: z2 - z1, h: 2.2 });
      D.boom = Build.prop('boom_gate', { pos: [3.9, 0, 49.5], yaw: PI / 2, w: 2.6, open: 0, dynamic: true });
      A.collider([3.7, 0, 46.4], [4.1, 2, 49.6]);
      Build.prop('jersey_barrier', { pos: [3.95, 0, 29], yaw: -PI / 2, length: 4 });
      hand('COMMS VEHICLES — KEEP OUT', { pos: [3.8, 1.2, 33], yaw: -PI / 2, w: 1.8, h: 0.5, post: 0, back: M('plywood') });
      D.truck = Build.car('truck', { pos: [5.1, 0, 42.8], yaw: 0, color: 0x4a5040, seed: 3 });
      Build.decal(Tex.sign('comms', 'COMMS'), { pos: [3.88, 1.9, 41.8], yaw: -PI / 2, w: 3.2, h: 1.2 });
      Build.decal('water_stain', { pos: [3.87, 1.2, 43.5], yaw: -PI / 2, w: 5, h: 2.2, opacity: 0.7 });
      Build.car('comms_van', { pos: [5.2, 0, 53], yaw: 0.05 });
      Build.prop('sandbags', { pos: [-7, 0, 64.2], length: 3, rows: 3 });
      Build.poster('comms_execution', { pos: [-6.97, 1.7, 36], yaw: PI / 2, w: 0.85, worn: 0.3 });
      Build.poster('comms_execution', { pos: [-6.97, 1.7, 37.2], yaw: PI / 2, w: 0.85, worn: 0.5 });
      Build.poster('comms_execution', { pos: [-6.97, 1.7, 38.4], yaw: PI / 2, w: 0.85, worn: 0.2 });
      Build.poster('comms_curfew', { pos: [-6.97, 1.7, 40], yaw: PI / 2, w: 0.85, worn: 0.6 });
      Build.car('sedan', { pos: [-2.9, 0, 5], yaw: 0.12, wrecked: true, color: 0x6a3a2a, seed: 5 });
      for (const [x, z] of [[-2.6, 7], [2.2, 36.5]]) Build.smoke({ pos: [x, 0, z], size: 0.55, color: 0x9aa09c, rate: 0.05, count: 10 });
      Build.prop('streetlight', { pos: [-4.4, 0, 22], yaw: PI / 2, on: false });
      Build.prop('streetlight', { pos: [4.4, 0, 4], yaw: -PI / 2, on: false });

      // ---- 4. the checkpoint: T-walls across Albert St faced with smashed phones, the gate, the scanner
      const wall = M('concrete', { color: 0x9a9890 });
      for (const [x1, x2] of [[-7, -1.25], [1.25, 7]]) {
        Build.box(x2 - x1, 3.5, 0.5, wall, { pos: [(x1 + x2) / 2, 0, 68] });
        mosaic(x1 + 0.1, x2 - 0.1, 67.74, 0.25, 3.3, R);
      }
      Build.decal(Tex.sign('comms', 'CHECKPOINT 9'), { pos: [-4.1, 3.05, 67.72], w: 2.6, h: 0.95 });
      Build.prop('boom_gate', { pos: [-1.2, 0, 67.4], w: 2.4, open: 0 });
      Build.prop('barricade', { pos: [-3.2, 0, 63.6], yaw: 0.2, text: 'SCREEN CHECK — EYES UP' });
      Build.prop('floodlight_tower', { pos: [3.5, 0, 72], yaw: PI, h: 6.5, on: true });
      Build.prop('table', { kind: 'folding', pos: [2.8, 0, 66.2], yaw: 0.1 });
      Build.prop('crate', { kind: 'plastic', pos: [2.4, 0.74, 66.2], color: 0x2a4a6a });
      Build.scatter('phones', { box: [2.2, 65.9, 3.4, 66.5], count: 12, seed: 9, y: 0.76 });
      A.collectible({ at: [-6.2, 0.06, 66.6], kind: 'lanyard', id: 'c1_lanyard_valley' });

      // ---- 5. the Landlines' cord over a COMMS poster, and the speaker they put up last night (ripped off its bracket)
      Build.poster('comms_look_up', { pos: [-12.6, 1.8, 55.03], yaw: 0, w: 1.4, worn: 0.3 });
      Build.decal(Tex.graffiti('', { style: 'cord' }), { pos: [-12.6, 2.0, 55.07], w: 2.5, h: 2.5, cutout: true });
      Build.decal(Tex.graffiti('LISTEN FOR THE DIAL TONE', { style: 'spray', color: '#ece6d2' }), { pos: [-12.9, 0.55, 55.08], w: 3.9, h: 1.45, cutout: true });
      Build.box(0.3, 0.3, 0.18, C(0x2a2a2a, { rough: 0.5 }), { pos: [-10.9, 3.1, 55.1], rot: [0, 0, 0.5], solid: false });
      Build.wire([-10.9, 3.2, 55.15], [-10.2, 4.6, 55.1], { sag: 0.2 });
      Build.decal(Tex.graffiti('SAY YES', { style: 'drip', color: '#c8161d' }), { pos: [-17, 1.5, 55.05], w: 2.4, h: 0.9, cutout: true });
      Build.poster('say_yes', { pos: [-15.2, 1.7, 55.03], w: 0.8, worn: 0.8 });

      // ---- 6. the market of tarps, down the cross street
      const TARPS = [0x4a7ac8, 0xb85a3a, 0x6a8a5a, 0xd8b84a, 0x5a7ab0, 0x9a9a92, 0xc86a4a, 0x4a7ac8];
      const STALLS = [[-18, 55.6], [-24.5, 55.6], [-31, 55.6], [-37, 55.6], [-20.5, 64], [-27, 64], [-33.5, 64]];
      const tarps = STALLS.map(([x, z], i) => canopy(x - 2.4, z, x + 2.4, z + 2.4, 2.35 + R() * 0.25, TARPS[i]));
      Build.mesh(mergeGeometries(tarps), Tex.vc(M('fabric', { side: THREE.DoubleSide })), { shadow: true });
      STALLS.forEach(([x, z], i) => {
        Build.prop('table', { kind: 'folding', pos: [x, 0, z + (z < 60 ? 1.7 : 0.7)], w: 1.8 });
        Build.prop('crate', { kind: i % 2 ? 'milk' : 'wood', pos: [x - 1.6, 0, z + 1.2], stack: 2 });
      });
      Build.scatter('cans', { box: [-19, 57.1, -17, 57.5], count: 16, seed: 11, y: 0.74 });
      Build.scatter('bottles', { box: [-25.5, 57.1, -23.5, 57.5], count: 12, seed: 12, y: 0.74 });
      Build.scatter('phones', { box: [-28, 64.5, -26, 64.9], count: 10, seed: 13, y: 0.74 });   // flip phones and old Nokias, no screens worth the name
      for (let i = 0; i < 14; i++) Build.box(0.06, 0.1, 0.06, M('metal_painted'), { pos: [-31.8 + (i % 7) * 0.2, 0.74, 57.1 + ((i / 7) | 0) * 0.2], solid: false, tint: [0x2a6a3a, 0xc8a020, 0x2a2a2a][i % 3] });
      hand('BARS — CHARGED TODAY', { pos: [-31, 2.0, 57.9], w: 1.6, h: 0.45, post: 0, back: M('plywood') });
      hand('RADIO REPAIRS', { pos: [-33.5, 2.0, 64.3], yaw: PI, w: 1.4, h: 0.45, post: 0, back: M('plywood') });
      hand('SWAP ONLY', { pos: [-20.5, 2.0, 64.3], yaw: PI, w: 1.1, h: 0.45, post: 0, back: M('plywood') });
      for (let i = 0; i < 5; i++) Build.box(0.22, 0.14, 0.16, M('metal_painted'), { pos: [-34.4 + i * 0.42, 0.74, 64.7], solid: false, tint: [0x3a3a36, 0x5a4a3a, 0x2a2a2a][i % 3] });
      Build.prop('barrel', { kind: 'burning', pos: [-28.8, 0, 60.9], light: true });
      Build.prop('generator', { pos: [-22.6, 0, 65.8], on: true });
      Build.fairyLights({ points: [[-17, 2.5, 57.8], [-24, 2.7, 64], [-31, 2.5, 57.8], [-37.5, 2.6, 63.8]], color: 0xffd8a0, per: 3, light: 1.2, lightAt: [-26, 2.1, 61] });
      A.collectible({ at: [-22.3, 0.02, 63.4], kind: 'artifact', id: 'c1_receipt_thread' });
      A.collectible({ at: [-31.4, 0.76, 57.3], kind: 'lanyard', id: 'c1_lanyard_indro' });
      A.collectible({ at: [-17.6, 0.02, 31.4], kind: 'module', id: 'c1_module_greeting' });
      D.flips = A.w([-27, 1.2, 64.7]);

      // ---- 7. the inner cordon: T-walls, razor wire, the side gate and the gap beside it
      for (const [z1, z2] of [[44, 57.2], [62.9, 76]]) Build.box(0.6, 4, z2 - z1, wall, { pos: [-45.8, 0, (z1 + z2) / 2] });
      for (const z of [58.1, 62.7]) Build.box(0.18, 2.6, 0.18, M('metal_painted', { color: 0x4a4e4a }), { pos: [-45.8, 0, z] });
      Build.prop('fence', { kind: 'chainlink', pos: [-45.8, 0, 58.2], yaw: -PI / 2, length: 4.4, h: 2.5 });
      Build.mesh(new THREE.TorusGeometry(0.08, 0.02, 6, 12), C(0x8a8a86, { metal: 0.8, rough: 0.3 }), { pos: [-45.7, 1.1, 60.4], rot: [0, PI / 2, 0] });
      const coil = []; for (let i = 0; i <= 160; i++) { const a = i * 0.5; coil.push(new THREE.Vector3(-45.8 + Math.cos(a) * 0.3, 4.25 + Math.sin(a) * 0.3, 44 + i * 0.2)); }
      Build.mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(coil), 640, 0.012, 3), C(0x9a9a96, { metal: 0.8, rough: 0.35 }), { shadow: false });
      Build.decal(Tex.sign('stencil', 'INNER CORDON — NO ENTRY'), { pos: [-45.48, 2.6, 66], yaw: PI / 2, w: 3, h: 1.1 });
      Build.decal(Tex.graffiti('', { style: 'cord', color: '#c8c2b0' }), { pos: [-45.48, 0.5, 56.4], yaw: PI / 2, w: 0.5, h: 0.5, cutout: true, opacity: 0.8 });
      // beyond: the dark lane on the far side of the gap
      Build.floor(-60, 54, -46.1, 62, M('concrete_wet', { color: 0x3a3a36 }));
      Build.box(14, 6, 0.4, M('render'), { pos: [-53, 0, 54], tint: 0x4a4a44 });
      Build.box(14, 6, 0.4, M('render'), { pos: [-53, 0, 62], tint: 0x4a4a44 });
      Build.box(0.4, 6, 8.4, M('brick'), { pos: [-60.2, 0, 58], tint: 0x5a4a40 });
      for (const z of [46.8, 69.4]) Build.box(14, 8.5, 14.4, M('render'), { pos: [-53.1, 0, z], solid: false, tint: 0x55574f });
      Build.prop('roller_shutter', { pos: [-59.95, 0, 57.4], yaw: PI / 2, w: 2.8, h: 2.6, open: 0.35, color: 0x5a5e58, worn: 0.9 });
      Build.box(0.05, 0.9, 2.7, C(0x060707), { pos: [-59.97, 0, 57.4], solid: false, ao: false });
      Build.prop('rubbish_bag', { pos: [-58.6, 0, 60.9], n: 3 });
      // the inner city beyond the cordon: towers in the haze
      for (const [x, z, w, d, h] of [[-72, 40, 18, 22, 24], [-68, 74, 16, 18, 34], [-96, 58, 24, 20, 58], [-88, 20, 20, 16, 42], [-120, 90, 30, 24, 90]]) Build.box(w, h, d, M('render'), { pos: [x, 0, z], solid: false, tint: 0x656a68 });
      A.collider([-46.1, 0, 57.2], [-45.5, 2.6, 58.02]);          // too tight to walk: only the squeeze (ch1.2 opens it once Wai is through)
      A.dark([-60, 54, -46.1, 62], 0.8);
      Build.dust({ box: [-40, 0.2, 56, -16, 3, 66], count: 120, color: 0xd8d0c0, size: 0.02, opacity: 0.4 });
      Build.rain({ area: 30, count: 900, color: 0xb8c4c8, speed: 8 });


      // ---- people (area chars; ch1.2 puts the ration queue and the shoppers under AI crowd control and scripts the rest)
      const person = (name, at, yaw, seed, def = 'human') => A.char(def, { name, at, yaw, seed });
      D.ration = [0, 1, 2, 3, 4, 5, 6].map(i => person('c1_rq' + i, [5.3 + (i % 2) * 0.35, 0, 20.3 + i * 1.08], PI + (R() - 0.5) * 0.5, 310 + i));
      D.keepers = [[-18.2, 56.4, 0.1], [-31.2, 56.3, -0.1], [-27, 65.7, PI]].map(([x, z, y], i) => person('c1_keeper' + i, [x, 0, z], y, 330 + i));
      D.shoppers = [[-21, 61.4], [-24.6, 59.2], [-30.6, 62.6], [-35.2, 60.2]].map(([x, z], i) => person('c1_shop' + i, [x, 0, z], R() * 6, 340 + i));
      D.cq = [0, 1, 2, 3, 4, 5].map(i => person(i === 2 ? 'c1_man' : 'c1_cq' + i, [(R() - 0.5) * 0.3, 0, 65.9 - i * 1.1], (R() - 0.5) * 0.3, 350 + i));
      D.man = D.cq[2];
      D.scanner = A.char('soldier', { name: 'c1_scanner', at: [0.95, 0, 66.9], yaw: PI - 0.3, seed: 1 }); D.scanner.hold('scanner', 'l');
      D.s2 = A.char('soldier', { name: 'c1_s2', at: [2.9, 0, 65.4], yaw: PI * 0.85, seed: 2 });
      D.s3 = A.char('soldier', { name: 'c1_s3', at: [-2.4, 0, 66.5], yaw: PI + 0.35, seed: 3 });
      D.guard = A.char('soldier', { name: 'guard', at: [-44.3, 0, 61.1], yaw: PI / 2, seed: 4 });
      D.walkers = [[[-5.8, 36], [-5.9, 53]], [[-10, 57.2], [-40, 57.4]]].map(([a, b], i) => ({ c: person('c1_walk' + i, [a[0], 0, a[1]], 0, 360 + i), pts: [A.w([a[0], 0, a[1]]), A.w([b[0], 0, b[1]])], k: 1, t: R() * 4 }));
      defs();
      D.trio = [A.char('c1_trainee', { name: 'c1_trainee', at: [-5.3, 0, 19.6], yaw: 0 }), A.char('c1_raincoat', { name: 'c1_hood0', at: [-5.9, 0, 18.6], yaw: 0, seed: 71 }), A.char('c1_raincoat', { name: 'c1_hood1', at: [-4.8, 0, 18.2], yaw: 0, seed: 72 })];
      for (const c of D.trio) c.setVisible(false);
      // ---- markers
      A.marker('mk_start', [6.1, 0, 6.2], -0.4);
      A.marker('mk_1b_chase', [6.3, 0, 6.2], -0.35);
      A.marker('mk_1b_wai', [LEAD.start[0], 0, LEAD.start[1]], PI * 0.9);
      A.marker('mk_1b_gate', [-44.3, 0, 61.1], PI / 2);
      A.marker('mk_1b_squeeze', [-44.6, 0, 57.62], -PI / 2);
      A.hint([[4, 0, 14], [-1.5, 0, 40], [-6, 0, 60], [-26, 0, 61], [-44.6, 0, 57.6]].map(([x, y, z]) => [x, 1.6, z]));
      mergeStatics(A);
      // overcast: the street itself casts no sun shadows (the people and the truck still ground themselves)
      A.group.traverse(o => { if (o.isMesh && !o.isInstancedMesh && o !== D.truck) o.castShadow = false; });
      D.truck.traverse(o => { if (o.isMesh) o.castShadow = true; });
      D.loops = [Audio.loop('crowd_murmur', { pos: A.w([5.5, 1.5, 22]), vol: 0.5 }), Audio.loop('crowd_murmur', { pos: A.w([-27, 1.5, 61]), vol: 0.7 }), Audio.loop('drips', { pos: A.w([6.5, 3, 5]), vol: 0.5 }),
        Audio.loop('fire', { pos: A.w([-28.8, 1, 60.9]), vol: 0.35 }), Audio.loop('radio_dj', { pos: A.w([-33.8, 1.2, 64.6]), vol: 0.25 })];
    },
    unload(A) { for (const l of A.data.loops) l.stop(0.3); },
  };

  // ---- 1.2 — the QZ: talks, the lead, the beats -------------------------------------------------------------------------
  CONTENT.talks.c1_dialtone = {
    lines: [
      { who: 'wai', text: 'They put a speaker on the wall last night. Some woman’s voice. “When you’re lost in the static, listen for the dial tone.”', emote: 'neutral' },
      { who: 'chase', text: 'Catchy.', emote: 'smirk', pause: 0.6 },
      { who: 'wai', text: 'That’s what you used to say about our jingles.', emote: 'smirk' },
      { who: 'chase', text: 'Our jingles were catchy.', emote: 'smirk' },
      { who: 'wai', text: '“Say yes to the rest.” God. I still hum it in the shower.', emote: 'laugh', pause: 0.5 },
    ],
    resume: { who: 'wai', text: 'Anyway.', emote: 'neutral' },
  };
  CONTENT.talks.c1_market = {
    optional: true,
    lines: [
      { who: 'wai', text: 'You still got it on you?', emote: 'tender' },
      { who: 'chase', text: 'Got what.', emote: 'tense' },
      { who: 'wai', text: 'Chase.', emote: 'tender', pause: 0.6 },
      { who: 'chase', text: '…', emote: 'ashamed', pause: 0.4 },
      { who: 'wai', text: 'If they ever scan your pockets—', emote: 'tense' },
      { who: 'chase', text: 'They won’t.', emote: 'tense' },
      { who: 'wai', text: 'Ten years, mate.', emote: 'sad', pause: 0.5 },
      { who: 'chase', text: 'Drop it.', emote: 'angry' },
    ],
  };
  CONTENT.barks.loudspeaker = { speaker: 'loudspeaker', loop: ['Look up. Stay alive. Report all screens.'] };
  const LOOP = 'Look up. Stay alive. Report all screens.';
  const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const wB = (x, y, z) => V(OB[0] + x, y, OB[2] + z);

  // Wai leads: along ROUTE up to the current stop, waiting (turned back, watching) when Chase falls behind
  function leader(A, wai, chase) {
    const pts = ROUTE.map(k => typeof k === 'string' ? LEAD[k] : k).map(([x, z]) => wB(x, 0, z)), names = ROUTE.map(k => typeof k === 'string' ? k : null);
    const L = { i: 0, stop: 0, re: 0, on: true, idle: false, speed: 1.3 };
    L.go = name => { L.stop = names.indexOf(name); };
    // at a stop, wait for Chase; if he hangs back (or ran on ahead) for 6 s, Wai goes to him. Resolves when they're together.
    L.meet = async (G, name, r) => {
      let t0 = null;
      await G.until(() => {
        if (!L.there(name)) return false;
        if (flat(chase.root.position, wai.root.position) < r) return true;
        if (t0 === null) t0 = G.t;
        return G.t - t0 > 6;
      });
      if (flat(chase.root.position, wai.root.position) < r) return;
      L.on = false;
      await wai.walkTo(chase.root.position.clone().setY(0), { speed: 1.6, stopDist: Math.min(2, r * 0.6) });
      L.on = true; L.i = Math.min(L.i + 1, pts.length - 1);   // don't walk back to the stop afterwards
    };
    L.there = name => { const k = names.indexOf(name); return L.i >= k && flat(wai.root.position, pts[k]) < 0.5; };
    A.update(dt => {
      if (!L.on || Director.active) return;
      const w = wai.root.position, p = chase.root.position, gap = flat(w, p);
      if (flat(w, pts[L.i]) < 0.45 && L.i < L.stop) L.i++;
      if ((L.re -= dt) > 0) return;
      L.re = 0.3;
      const arrived = flat(w, pts[L.i]) < 0.45 || L.i > L.stop, ahead = (pts[L.i].x - w.x) * (p.x - w.x) + (pts[L.i].z - w.z) * (p.z - w.z) > 0;
      if (arrived || (gap > 9 && !ahead)) {
        if (!L.idle) { L.idle = true; wai.stop(); if (gap < 14) wai.turnTo(chase, 0.8); }
        wai.lookAt(gap < 12 ? chase : null);
        return;
      }
      L.idle = false; wai.lookAt(null);
      wai.walkTo(pts[L.i], { speed: gap < 3 ? L.speed + 0.2 : L.speed });
    });
    return L;
  }
  // the checkpoint: the scanner goes to the front of the queue, CLEAR, they walk through, the queue shuffles up; new people
  // come in off the cross street at the back
  function checkpoint(A) {
    const D = A.data, Q = { list: D.cq.slice(), t: 2.5, phase: 0, on: true }, sc = D.scanner, scr = sc.held('l');
    const slot = i => wB(Math.sin(i * 2.3) * 0.15, 0, 65.9 - i * 1.1);
    for (const c of Q.list) c.lookAt(null);
    if (scr) scr.userData.setText('READY');
    A.update(dt => {
      if (!Q.on || (Q.t -= dt) > 0) return;
      const f = Q.list[0];
      if (!f) { Q.t = 1; return; }
      if (Q.phase === 0) {
        sc.turnTo(f, 0.4); sc.gesture('hand_over', { to: f.point('eyes'), hand: 'l', dur: 1.8 }); f.lookAt(sc.point('head'));
        Audio.sfx('scanner_beep', { pos: sc.point('hand_l'), vol: 0.5 });
        if (scr) scr.userData.setText('SCANNING');
        Q.phase = 1; Q.t = 1.7;
      } else {
        if (scr) scr.userData.setText('CLEAR');
        Q.list.shift(); f.lookAt(null);
        if (f !== D.man) {
          f.walkTo(wB(0.2, 0, 75), { speed: 1.2 }).then(() => f.walkTo(wB(-1.2, 0, 96), { speed: 1.1 })).then(() => {
            if (!Q.on) return;
            Game.place(f, wB(-11.5, 0, 57.8), PI / 2); f.walkTo(wB(-2, 0, 58.6), { speed: 1.1 }).then(() => { Q.list.push(f); f.walkTo(slot(Q.list.length - 1), { speed: 0.8 }); });
          });
        }
        Q.list.forEach((c, i) => c.walkTo(slot(i), { speed: 0.7, face: wB(0, 0, 70) }));
        Q.phase = 0; Q.t = 3.2 + Math.random() * 1.8;
      }
    });
    return Q;
  }
  // two passers-by pace their stretch of street
  function walkers(A) {
    A.update(dt => { for (const w of A.data.walkers) if ((w.t -= dt) <= 0 && flat(w.c.root.position, w.pts[w.k]) < 0.5) { w.k = 1 - w.k; w.t = 4 + Math.random() * 6; } else if (w.t <= 0 && !w.c.mv) w.c.walkTo(w.pts[w.k], { speed: 1.15 }); });
  }
  // the loudspeakers: the loop, whenever nobody's talking and a pole is within earshot
  function loudLoop(A) {
    let t = 60;
    A.update(dt => {
      if ((t -= dt) > 0 || Director.active) return;
      const cam = Engine.camera.position, near = A.data.loud.find(p => p.distanceTo(cam) < 32);
      if (!near) { t = 3; return; }
      if (Dialogue.bark('loudspeaker', 'loop', { pos: near })) { Audio.sfx('radio_click', { pos: near, vol: 0.6 }); t = 60; } else t = 4;
    });
  }
  // the compound's boom gate, raised and lowered by hand
  function boom(G, A, v) {
    const D = A.data, from = D.boomV || 0, t0 = G.t;
    D.boomTw = t0;
    A.update(() => { if (D.boomTw !== t0) return; const k = U.clamp((G.t - t0) / 1.4); D.boomV = U.lerp(from, v, U.smooth(k)); D.boom.userData.set(D.boomV); if (k >= 1) D.boomTw = null; });
  }
  // the man with the phone: the scanner shrieks at him, they drag him out of the line and behind the truck. One shot.
  async function execution(G, A, Q) {
    const D = A.data, man = D.man, sc = D.scanner, s2 = D.s2, s3 = D.s3, scr = sc.held('l');
    Q.on = false;
    sc.stop(); sc.turnTo(man, 0.3); sc.gesture('hand_over', { to: man.point('eyes'), hand: 'l', dur: 2.2 });
    if (scr) scr.userData.setText('SCREEN');
    G.sfx('scanner_shriek', { pos: sc.point('hand_l'), vol: 0.9 });
    Play.nudge(man.point('head'), 1.4);
    man.hold('phone', 'r'); man.phoneGlow(true); man.emote('afraid'); man.lookAt(sc);
    for (const c of D.cq) if (c !== man) { c.lookAt(man); c.emote('afraid', 2); }
    await G.wait(0.5);
    s2.walkTo(man.root.position.clone().add(V(0.5, 0, -0.3)), { speed: 3.2 }); s3.walkTo(man.root.position.clone().add(V(-0.6, 0, 0.4)), { speed: 3 });
    await G.wait(1.1);
    s2.turnTo(man, 0.2); s2.gesture('grab', { to: man.point('chest') }); man.gesture('struggle', { dur: 2.5 }); man.emote('crying');
    G.sfx('punch', { pos: man.point('chest'), vol: 0.5 });
    await G.wait(0.8);
    // the queue turns away
    for (const c of D.cq) if (c !== man) { c.lookAt(null); c.turnTo(c.yaw + (Math.random() < 0.5 ? 1.3 : -1.3), 0.9); c.emote('sad'); }
    for (const c of D.ration) c.lookAt(null);
    const path = [wB(2.4, 0, 56.5), wB(3.1, 0, 50.5), wB(4.5, 0, 48.2), wB(6.7, 0, 46.2), wB(8.6, 0, 43.2), wB(11.2, 0, 42.6)];
    man.walkTo(path[path.length - 1], { path: path.slice(0, -1), speed: 1.7 });
    s2.walkTo(path[path.length - 1].clone().add(V(0.9, 0, 0.6)), { path: path.slice(0, -1).map(p => p.clone().add(V(0.5, 0, 0.5))), speed: 1.75 });
    s3.walkTo(path[path.length - 2], { path: path.slice(0, -2).map(p => p.clone().add(V(-0.4, 0, 1.2))), speed: 1.6 });
    man.lookAt(() => man.root.position.clone().add(V(-3, 1.6, 4)));
    await G.until(() => man.root.position.z < OB[2] + 53.5);
    boom(G, A, 1); G.sfx('metal_creak', { pos: wB(3.9, 1, 49.5), vol: 0.4 });
    await G.until(() => man.root.position.x > OB[0] + 7);
    Play.nudge(wB(5.2, 1.6, 43.5), 1.2);
    await G.until(() => man.root.position.x > OB[0] + 8.3);
    man.lookAt(null);
    await G.wait(1.6);
    G.sfx('gunshot', { pos: wB(11.4, 1.2, 42.6), vol: 1 });
    Play.shake(0.04, 0.2);
    man.setVisible(false); man.phoneGlow(false);
    // everyone flinches, and keeps walking
    const near = [...D.cq, ...D.walkers.map(w => w.c), ...D.ration].filter(c => c !== man);
    for (const c of near) { c.emote('shocked', 1.2); if (Math.random() < 0.35) c.gesture('cover_mouth', { dur: 1.6 }); }
    G.who('wai').emote('tense'); G.who('chase').emote('tense');
    await G.wait(1.2);
    for (const c of near) c.emote('neutral');
    Q.list = Q.list.filter(c => c !== man); Q.on = true; Q.t = 4;
    for (const c of D.cq) if (c !== man) c.turnTo(0, 1.4);
    G.wait(5).then(() => { s3.walkTo(wB(-2.4, 0, 66.5), { speed: 1.2, face: wB(-2, 0, 60) }); s2.setVisible(false); boom(G, A, 0); });
  }
  // the trainee, hustled across the street and into the alley by two hooded raincoats
  async function plant(G, A) {
    const [girl, h0, h1] = A.data.trio;
    for (const c of A.data.trio) c.setVisible(true);
    const path = (dx, dz) => [wB(-5.5 + dx, 0, 24 + dz), wB(-5.9 + dx, 0, 29.4 + dz), wB(-9.5 + dx, 0, 31 + dz), wB(-19.5 + dx, 0, 31.2 + dz)];
    girl.walkTo(path(0, 0)[3], { path: path(0, 0).slice(0, 3), speed: 1.85 }); girl.emote('tense');
    h0.walkTo(path(-0.4, -1)[3], { path: path(-0.4, -1).slice(0, 3), speed: 1.85 }); h0.gesture('hand_on_shoulder', { to: girl, hold: true });
    h1.walkTo(path(0.5, -1.4)[3], { path: path(0.5, -1.4).slice(0, 3), speed: 1.9 });
    await G.wait(1.2);
    Play.nudge(girl.point('head'), 1); girl.lookAt(G.who('chase'));
    await G.wait(1.4);
    girl.lookAt(null);
    await G.until(() => !girl.mv);
    for (const c of A.data.trio) c.setVisible(false);
    h0.gesture(null);
  }
  // Wai side-steps through the gap, back to the wall (the same shuffle as the player's squeeze)
  function sidle(A, c, a, b) {
    const dir = U.yawTo(a, b), len = a.distanceTo(b);
    let k = 0;
    return new Promise(done => A.update(dt => {
      if (k >= 1) return;
      k = Math.min(1, k + 0.75 * dt / len);
      c.yaw = U.angleDamp(c.yaw, dir - PI / 2, 8, dt); c.root.position.lerpVectors(a, b, k);
      c.setMove(k < 1 ? 0.75 : 0, { strafe: [-1, 0] });
      if (k >= 1) done();
    }));
  }
  // the bar for the guard: a charged cell with a hand-written tag
  function cell() {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.1, 10), Tex.color(0x2a6a3a, { rough: 0.4, metal: 0.4 })));
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.012, 8), Tex.color(0xc8c8c0, { metal: 0.8, rough: 0.3 })); cap.position.y = 0.056; g.add(cap);
    return g;
  }

  H['ch1.2'] = async G => {
    UI.hud({ show: false }); UI.letterbox(false, 0); Director.stop();
    if (G.areaById('1B')) G.unload('1B');                              // a retry starts from a fresh street
    const A = await G.area('1B'), D = A.data;
    const chase = G.actor('chase', 'chase'), wai = G.actor('wai', 'wai');
    reset(chase); reset(wai); hideOthers(G, ['chase', 'wai']);
    if (chase.parts.jacket === false) chase.setPart('jacket', true);
    wai.decal('bruise', true); wai.hold('bat', 'r');
    G.place(chase, 'mk_1b_chase'); G.place(wai, 'mk_1b_wai');
    revolver();
    for (const c of D.ration) AI.spawn('crowd', null, { char: c, behaviour: 'queue' });
    for (const c of D.shoppers) AI.spawn('crowd', null, { char: c, behaviour: 'wander', radius: 1.6 });
    for (const c of D.keepers) c.gesture('fold_arms', { hold: true });
    D.scanner.lookAt(null);
    D.guard.lookAt(null);
    const Q = checkpoint(A); walkers(A); loudLoop(A);
    G.player(chase, { combat: false, hud: false, run: 3.6, canJump: true }); Play.snapCamera();   // canJump: the squeeze at the end
    G.control(true);
    const L = leader(A, wai, chase);
    const near = (at, r) => G.until(() => flat(chase.root.position, at) < r);
    const waiNear = r => flat(chase.root.position, wai.root.position) < r;

    // 1. the ration queue. The loudspeaker; "You eat?"; the bar.
    L.go('ration');
    await near(wB(3.2, 0, 14), 6.5);
    G.sfx('radio_click', { pos: D.loud[0], vol: 0.6 });
    await G.say('loudspeaker', LOOP);
    await L.meet(G, 'ration', 4);
    await G.say('wai', 'You eat?', { emote: 'neutral', to: chase, char: wai });
    await G.say('chase', 'Yesterday.', { emote: 'neutral', to: wai, pause: 0.4 });
    wai.hold('ration_bar', 'l');
    await G.say('wai', 'Growing boy.', { emote: 'smirk', to: chase, char: wai, pause: 0.3 });
    if (!waiNear(1.9)) await wai.walkTo(chase.root.position.clone().lerp(wai.root.position, 0.5).setY(0), { speed: 1.2, stopDist: 1.1 });
    wai.turnTo(chase, 0.3); wai.gesture('hand_over', { to: chase, hand: 'l' });
    const here = G.say('wai', 'Here.', { emote: 'tender', to: chase, char: wai, pause: 0.2 });
    await G.wait(0.75);
    wai.drop('l', { remove: true }); chase.hold('ration_bar', 'r'); G.sfx('pickup', { pos: chase.point('hand_r'), vol: 0.4 });
    await here;
    G.wait(2.5).then(() => { chase.gesture('hand_on_pocket'); return G.wait(0.6); }).then(() => chase.drop('r', { remove: true }));

    // 2. across the street: the trainee (nobody comments)
    L.go('plant');
    await G.until(() => chase.root.position.z > OB[2] + 17);
    plant(G, A);

    // 3–4. the checkpoint; the execution behind the truck
    L.go('check');
    await L.meet(G, 'check', 6.5);
    L.speed = 1.1;
    wai.lookAt(D.scanner);
    await G.wait(1.5);
    await execution(G, A, Q);
    await G.wait(0.9);
    await G.say('wai', 'Third this week.', { emote: 'sad', to: chase, char: wai });
    await G.say('chase', 'Don’t look.', { emote: 'tense', to: wai, pause: 0.5 });
    await G.say('wai', 'You say that like it fixes anything.', { emote: 'tense', to: chase, char: wai, pause: 0.4 });
    L.speed = 1.3;

    // 5. round the corner: the cord over the COMMS poster
    L.go('wall');
    await G.until(() => L.i >= ROUTE.indexOf('wall') && waiNear(7));
    wai.gesture('point', { to: wB(-12.6, 2, 55) }); Play.nudge(wB(-12.6, 1.6, 55), 1.6);
    L.go('market');
    const talk = G.talk('c1_dialtone', { speakers: ['wai', 'chase'] });

    // 6. the market of tarps: the optional talk, Wai's eye on the flip phones
    A.optional('c1_market', { near: 'wai', r: 2.4, cond: () => chase.root.position.x < OB[0] - 16 && chase.root.position.x > OB[0] - 38 });
    await G.until(() => L.there('market'));
    wai.turnTo(wB(-26.8, 0, 57.4), 0.6); wai.gesture('wave_off');
    await talk;
    A.update(() => {
      if (D.flipsSaid || Dialogue.busy || flat(chase.root.position, D.flips) > 3 || flat(wai.root.position, D.flips) > 6) return;
      D.flipsSaid = true; G.say('wai', 'Flip phones. We used to give those away on a two-year plan.', { emote: 'smirk', char: wai, to: chase });
    });
    const t0 = G.t;
    await G.until(() => chase.root.position.x < OB[0] - 30 || (G.t - t0 > 30 && chase.root.position.x < OB[0] - 22));
    await G.until(() => !Dialogue.busy);

    // 7. the side gate: a bar for the guard, and he looks away
    L.go('gate');
    await G.until(() => L.there('gate'));
    L.on = false;
    const g = D.guard;
    wai.turnTo(g, 0.4); g.turnTo(wai, 0.5); g.lookAt(wai);
    await G.until(() => waiNear(8));
    wai.hold(cell(), 'l'); wai.gesture('hand_over', { to: g, hand: 'l' });
    await G.wait(0.8);
    wai.drop('l', { remove: true }); g.hold(cell(), 'l'); g.gesture('hand_on_pocket', { hand: 'l' });
    await G.wait(0.8);
    g.drop('l', { remove: true }); g.lookAt(wB(-40, 1.7, 75)); g.turnTo(0.3, 1.2);
    await wai.walkTo(wB(-44.4, 0, 57.62), { speed: 1.2 });
    await sidle(A, wai, wB(-44.4, 0, 57.62), wB(-47.2, 0, 57.62));
    await wai.walkTo(wB(LEAD.lane[0], 0, LEAD.lane[1]), { speed: 0.8 });
    wai.turnTo(chase, 0.6); wai.lookAt(chase);
    // the gap beside the gate: ch1.3 takes over halfway through (the load hides behind the squeeze)
    A.squeeze({ from: [-44.6, 0, 57.62], to: [-47.1, 0, 57.62], oneWay: true, mid: () => { D.through = true; } });
    await G.until(() => D.through);
    G.control(false);
  };
})();
