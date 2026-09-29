// ============================================================================
// Kit — the player's things (internal to Play): inventory gifts and caps, item meshes, glinting pickups, collectibles
// (artifacts, lost lanyards, Sales Training Modules → skills, Sales Tips), the backpack crafting wheel (Tab; the world
// keeps running) and workbenches (close-up camera, upgrades bought with bars). Owned by: systems (player) agent.
//   Kit.extendArea(A, S) · Kit.unloadArea(A) · Kit.update(S, dt) · Kit.give(S, item, n) -> taken
//   Kit.mesh(item, forHand) -> Object3D · Kit.drop(worldPos, item, n, mesh?)  (a pickup in the current area: arrows, bricks)
// ============================================================================
const Kit = (() => {
  const V3 = THREE.Vector3;
  const CAP = { cloth: 3, alcohol: 3, tape: 3, sim: 3, battery: 3, nokia: 3, scrap: 3, medkit: 3, shiv: 3, pillow: 3, ringtone: 2, vape: 2, bottle: 1, brick: 1 };
  const THROWN = ['bottle', 'brick', 'pillow', 'ringtone', 'vape'];
  const pickups = [];                 // { A, it, mesh, glint, item, n, t }
  const name = id => CONTENT.items[id]?.name || id;
  const _a = new V3();

  // ---- inventory ---------------------------------------------------------------------------------------------------
  function give(S, item, n = 1) {
    const inv = S.inv, G = Arms.GUN;
    if (G[item]) {
      if (inv.weapons.includes(item)) return give(S, item === 'bow' ? 'arrow' : item + '_ammo', Math.max(1, Math.round(G[item].cap / 2)));
      inv.weapons.push(item); inv.clip[item] = G[item].cap; inv.ammo[item] = inv.ammo[item] || 0;
      if (!inv.weapon) Arms.equip(S, item);
      return 1;
    }
    if (item === 'arrow' || item.endsWith('_ammo')) {
      const w = item === 'arrow' ? 'bow' : item.slice(0, -5), k = Math.max(0, Math.min(n, Arms.RESERVE[w] - (inv.ammo[w] || 0)));
      inv.ammo[w] = (inv.ammo[w] || 0) + k; return k;
    }
    const M = Arms.MELEE[item];
    if (M && M.hits) { inv.melee = { kind: item, hits: M.hits, blade: false }; return 1; }
    const k = Math.max(0, Math.min(n, (CAP[item] ?? 999) - (inv.items[item] || 0)));
    inv.items[item] = (inv.items[item] || 0) + k;
    if (k && THROWN.includes(item) && !inv.throwSel) inv.throwSel = item;
    return k;
  }

  // ---- item meshes -----------------------------------------------------------------------------------------------------
  const mat = (hex, o = {}) => Tex.color(hex, Object.assign({ rough: 0.7 }, o));
  function part(g, geo, m, p, r) { const x = new THREE.Mesh(geo, m); if (p) x.position.set(...p); if (r) x.rotation.set(...r); x.castShadow = true; g.add(x); return x; }
  const B = (w, h, d) => new THREE.BoxGeometry(w, h, d), C = (r1, r2, h, s = 12) => new THREE.CylinderGeometry(r1, r2, h, s);
  const BUILD = {
    tape: g => { part(g, C(0.056, 0.056, 0.048, 20), mat(0x8e9296, { rough: 0.45, metal: 0.2 }), [0, 0.024, 0]); part(g, C(0.036, 0.036, 0.05, 16), mat(0xb89a70), [0, 0.025, 0]); part(g, C(0.03, 0.03, 0.052, 12), mat(0x1a1a1a), [0, 0.025, 0]); },
    sim: g => { part(g, B(0.1, 0.005, 0.064), mat(0xe8e2d0), [0, 0.003, 0]); part(g, B(0.026, 0.006, 0.02), mat(0xd8b050, { metal: 0.7, rough: 0.3 }), [0.02, 0.005, 0]); part(g, C(0.0025, 0.0025, 0.07, 6), mat(0xc0c4c8, { metal: 0.9, rough: 0.25 }), [-0.025, 0.008, 0], [0, 0, Math.PI / 2]); },
    battery: g => { const m = part(g, new THREE.SphereGeometry(0.06, 16, 10), mat(0x9aa4b0, { rough: 0.35, metal: 0.5 }), [0, 0.02, 0]); m.scale.set(0.9, 0.36, 1.35); part(g, B(0.05, 0.004, 0.05), mat(0xe8b020), [0, 0.042, 0.01]); },
    nokia: g => {
      part(g, B(0.047, 0.018, 0.11), mat(0x1c2a44, { rough: 0.5 }), [0, 0.009, 0]);
      g.userData.screen = part(g, B(0.03, 0.002, 0.026), new THREE.MeshBasicMaterial({ color: 0x6a8a5a }), [0, 0.0185, 0.022]);
      part(g, B(0.036, 0.002, 0.04), mat(0x6a7280), [0, 0.0185, -0.025]);
    },
    scrap: g => { part(g, B(0.16, 0.012, 0.04), mat(0x7a5a44, { metal: 0.6, rough: 0.6 }), [0, 0.01, 0], [0, 0.4, 0.1]); part(g, B(0.1, 0.01, 0.05), mat(0x8a8e92, { metal: 0.7, rough: 0.4 }), [0.03, 0.025, 0.03], [0.2, -0.6, 0]); part(g, C(0.012, 0.012, 0.12, 8), mat(0x6a4a3a, { metal: 0.6 }), [-0.03, 0.02, -0.02], [0, 0, Math.PI / 2]); },
    alcohol: g => { part(g, C(0.034, 0.036, 0.16, 14), mat(0x8a5a22, { rough: 0.15, transparent: true, opacity: 0.85 }), [0, 0.08, 0]); part(g, C(0.013, 0.03, 0.06, 12), mat(0x8a5a22, { rough: 0.15, transparent: true, opacity: 0.85 }), [0, 0.19, 0]); part(g, C(0.036, 0.036, 0.06, 14), mat(0xe8e0cc), [0, 0.085, 0]); part(g, C(0.014, 0.014, 0.02, 10), mat(0x202020), [0, 0.23, 0]); },
    cloth: g => { part(g, B(0.2, 0.03, 0.16), mat(0xb8a890, { rough: 0.95 }), [0, 0.015, 0], [0, 0.3, 0]); part(g, B(0.16, 0.02, 0.1), mat(0x9a8a78, { rough: 0.95 }), [0.02, 0.04, 0.01], [0, -0.2, 0.08]); },
    revolver_ammo: g => { part(g, B(0.075, 0.035, 0.05), mat(0x8a2a22), [0, 0.018, 0]); for (let i = 0; i < 4; i++) part(g, C(0.0055, 0.0055, 0.03, 8), mat(0xc8a040, { metal: 0.8, rough: 0.3 }), [-0.02 + i * 0.013, 0.05, 0]); },
    pistol_ammo: g => { part(g, B(0.07, 0.03, 0.045), mat(0x2a3a5a), [0, 0.015, 0]); for (let i = 0; i < 3; i++) part(g, C(0.005, 0.005, 0.02, 8), mat(0xc8a040, { metal: 0.8, rough: 0.3 }), [-0.015 + i * 0.015, 0.04, 0]); },
    shotgun_ammo: g => { for (let i = 0; i < 3; i++) { part(g, C(0.011, 0.011, 0.065, 10), mat(0xa81c1c, { rough: 0.5 }), [-0.025 + i * 0.024, 0.011, i * 0.006], [Math.PI / 2, 0, 0]); part(g, C(0.0115, 0.0115, 0.016, 10), mat(0xc8a040, { metal: 0.8, rough: 0.3 }), [-0.025 + i * 0.024, 0.011, i * 0.006 + 0.04], [Math.PI / 2, 0, 0]); } },
    rifle_ammo: g => { for (let i = 0; i < 4; i++) part(g, C(0.0055, 0.0055, 0.07, 8), mat(0xc8a040, { metal: 0.8, rough: 0.3 }), [-0.02 + i * 0.013, 0.006, 0], [Math.PI / 2, 0, 0]); },
    arrow: g => {
      part(g, C(0.004, 0.004, 0.72, 6), mat(0x8a6a44), [0, 0, 0], [Math.PI / 2, 0, 0]);
      part(g, new THREE.ConeGeometry(0.01, 0.05, 6), mat(0x9aa0a6, { metal: 0.8, rough: 0.3 }), [0, 0, 0.38], [Math.PI / 2, 0, 0]);
      for (const r of [0, Math.PI / 2]) part(g, B(0.002, 0.03, 0.09), mat(0xd8d0c0, { side: THREE.DoubleSide }), [0, 0, -0.31], [0, 0, r]);
    },
    bars: g => { for (let i = 0; i < 3; i++) { part(g, C(0.0092, 0.0092, 0.065, 12), mat(0x2a8a4a, { rough: 0.35 }), [-0.02 + i * 0.02, 0.0092, 0], [Math.PI / 2, 0, 0]); part(g, C(0.0094, 0.0094, 0.012, 12), new THREE.MeshBasicMaterial({ color: 0x7affa0 }), [-0.02 + i * 0.02, 0.0092, 0.012], [Math.PI / 2, 0, 0]); } },
    medkit: g => { part(g, B(0.13, 0.05, 0.09), mat(0xe8e4dc), [0, 0.025, 0]); part(g, B(0.05, 0.002, 0.014), mat(0xc82a22), [0, 0.051, 0]); part(g, B(0.014, 0.002, 0.05), mat(0xc82a22), [0, 0.051, 0]); part(g, C(0.022, 0.022, 0.05, 12), mat(0xf0ece4, { rough: 0.95 }), [0.08, 0.022, 0], [Math.PI / 2, 0, 0]); },
    shiv: g => { part(g, B(0.022, 0.018, 0.09), mat(0x8e9296, { rough: 0.5 }), [0, 0.01, 0]); part(g, B(0.004, 0.006, 0.07), mat(0xc0c4c8, { metal: 0.9, rough: 0.25 }), [0, 0.01, 0.075]); },
    pillow: g => { const m = part(g, new THREE.SphereGeometry(0.06, 16, 10), mat(0xa8b0b8, { rough: 0.35, metal: 0.5 }), [0, 0.04, 0]); m.scale.set(1, 0.7, 1.3); part(g, B(0.13, 0.04, 0.03), mat(0xb8a890, { rough: 0.95 }), [0, 0.04, 0]); },
    ringtone: g => { BUILD.nokia(g); part(g, B(0.052, 0.022, 0.03), mat(0x8e9296, { rough: 0.45 }), [0, 0.01, -0.005]); part(g, B(0.03, 0.012, 0.03), mat(0x7a5a44, { metal: 0.6 }), [0.03, 0.012, 0.01], [0, 0.4, 0]); },
    vape: g => { part(g, C(0.011, 0.011, 0.12, 10), mat(0x303238, { rough: 0.3, metal: 0.5 }), [0, 0.011, 0], [Math.PI / 2, 0, 0]); part(g, C(0.018, 0.02, 0.07, 10), mat(0x8a5a22, { rough: 0.15, transparent: true, opacity: 0.85 }), [0.04, 0.035, 0]); },
    plank: g => { part(g, B(0.09, 0.035, 0.95), mat(0x9a7a52, { rough: 0.9 }), [0, 0, 0.36]); part(g, C(0.003, 0.003, 0.05, 5), mat(0x8a8a8a, { metal: 0.8 }), [0, 0.02, 0.7]); },
  };
  const HAND = { plank: { p: [0.02, -0.07, 0], r: [0.9, 0, 0] } };
  function mesh(item, forHand) {
    const src = { cloth: 'rag', shiv: 'knife' }[item] || item;
    let g;
    if (Chars.props[src] && !BUILD[item]) g = Chars.props[src]();
    else {
      g = new THREE.Group(); BUILD[item](g);
      g.userData.grip = HAND[item] || { p: [0.04, -0.07, 0], r: [Math.PI / 2, 0, 0] };
    }
    if (forHand) return g;
    // lying on the ground: the thinnest dimension up, resting on its underside
    const w = new THREE.Group(); w.add(g);
    const bb = new THREE.Box3().setFromObject(g), s = bb.getSize(_a);
    if (s.x < s.y && s.x <= s.z) g.rotation.z = Math.PI / 2; else if (s.z < s.y && s.z < s.x) g.rotation.x = Math.PI / 2;
    g.updateMatrixWorld(true);
    const b2 = new THREE.Box3().setFromObject(g), c = b2.getCenter(new V3());
    g.position.set(-c.x, -b2.min.y, -c.z);
    return w;
  }

  // ---- pickups -----------------------------------------------------------------------------------------------------
  let starTex = null;
  function star() {
    if (starTex) return starTex;
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const x = cv.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.12, 'rgba(255,250,235,.8)'); g.addColorStop(0.35, 'rgba(255,240,210,.12)'); g.addColorStop(1, 'rgba(255,240,210,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    x.globalCompositeOperation = 'lighter'; x.fillStyle = 'rgba(255,250,240,.9)';
    x.beginPath(); x.moveTo(32, 2); x.lineTo(34, 30); x.lineTo(62, 32); x.lineTo(34, 34); x.lineTo(32, 62); x.lineTo(30, 34); x.lineTo(2, 32); x.lineTo(30, 30); x.fill();
    starTex = new THREE.CanvasTexture(cv); starTex.colorSpace = THREE.SRGBColorSpace; starTex.userData.shared = true;
    return starTex;
  }
  function glint(parent, pos) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: star(), color: 0xfff4e0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.position.copy(pos); s.scale.setScalar(0.001); parent.add(s);
    return s;
  }
  const scale = n => Math.max(1, Math.round(n * (SETTINGS.difficulty === 'story' ? 2 : SETTINGS.difficulty === 'hard' ? 0.5 : 1)));
  function addPickup(A, S, local, item, n, prompt, m) {
    const P = { A, item, n, t: Math.random() * 3, mesh: m || mesh(item) };
    if (!m) { P.mesh.position.copy(local); P.mesh.rotation.y = U.hash(item + local.x.toFixed(2)) % 628 / 100; }
    if (!P.mesh.parent) A.group.add(P.mesh);
    P.glint = glint(A.group, local.clone().setY(local.y + 0.08));
    P.it = A.interactable({ at: [local.x, local.y, local.z], r: 1.3, once: false, prompt: prompt || 'e – pick up', cond: () => !S.act && S.p.combat, use: () => take(S, P) });
    pickups.push(P);
    return P;
  }
  function take(S, P) {
    const k = give(S, P.item, P.n);
    if (k <= 0) { UI.toast(`can't carry more ${name(P.item)}`); return; }
    P.n -= k;
    UI.toast(Arms.GUN[P.item] && !P.n ? name(P.item) : `+${k} ${name(P.item)}`);
    Audio.sfx('pickup', { pos: P.it.pos });
    S.c.gesture('grab', { dur: 0.5 });
    if (P.n <= 0) removePickup(P);
  }
  function removePickup(P) {
    P.it.used = true;
    P.A.group.remove(P.mesh, P.glint); P.glint.material.dispose();
    pickups.splice(pickups.indexOf(P), 1);
  }
  function drop(pos, item, n, m) {
    const A = Game.area; if (!A) return;
    if (m) { A.group.attach(m); }
    addPickup(A, SS, pos.clone().sub(A.origin), item, n, null, m);
  }

  // ---- collectibles ------------------------------------------------------------------------------------------------
  function paper(g, w, d, col) { part(g, B(w, 0.003, d), mat(col, { rough: 0.95 }), [0, 0.002, 0], [0, 0.2, 0]); }
  function collectible(A, S, o) {
    const entry = (o.kind === 'tip' ? CONTENT.tips : CONTENT.collectibles[o.kind + 's']).find(e => e.id === o.id);
    if (o.kind === 'tip') return A.interactable({ at: o.at, r: 1.6, prompt: 'e – joke', cond: () => !S.act, use: () => joke(entry) });
    if (Save.data.collectibles[o.kind + 's'].includes(o.id)) return null;
    const g = new THREE.Group();
    if (o.kind === 'artifact') paper(g, 0.21, 0.28, 0xe8e2d2);
    else if (o.kind === 'lanyard') {
      part(g, B(0.055, 0.004, 0.085), new THREE.MeshStandardMaterial({ map: Tex.sign('lanyard_card', entry.title.replace(/ · /g, '\n')), roughness: 0.6 }), [0, 0.003, 0]);
      for (let i = 0; i < 9; i++) part(g, B(0.012, 0.003, 0.05), mat(i % 2 ? 0xf0b400 : 0x2a2a2a), [Math.sin(i * 0.7) * 0.05, 0.002, -0.08 - i * 0.035], [0, Math.cos(i * 0.9) * 0.6, 0]);
    } else { part(g, B(0.15, 0.008, 0.21), mat(0xf2c200, { rough: 0.8 }), [0, 0.004, 0], [0, -0.3, 0]); part(g, B(0.12, 0.002, 0.04), mat(0x1a1a1a), [0, 0.009, -0.05], [0, -0.3, 0]); }
    const at = A.w(o.at).sub(A.origin);
    g.position.copy(at); A.group.add(g);
    const P = { A, item: null, mesh: g, glint: glint(A.group, at.clone().setY(at.y + 0.06)), t: Math.random() * 3 };
    P.it = A.interactable({
      at: o.at, r: 1.3, prompt: o.kind === 'artifact' ? 'e – read' : 'e – pick up', cond: () => !S.act,
      use: () => { removePickup(P); found(S, o, entry); },
    });
    pickups.push(P);
    return P;
  }
  function joke(entry) {
    (async () => { for (const l of entry.lines) await Dialogue.say(l.who, l.text, { emote: l.emote }); })().catch(e => { if (e !== Game.ABORT) console.error(e); });
  }
  function found(S, o, entry) {
    Audio.sfx(o.kind === 'lanyard' ? 'pickup' : 'page_turn', { pos: S.c.root.position });
    Save.collect(o.kind + 's', o.id);
    if (o.kind === 'artifact') read(S, entry);
    else if (o.kind === 'lanyard') UI.toast(entry.title, 'lost lanyard');
    else {
      const n = Save.data.collectibles.modules.length, sk = CONTENT.skills[(n - 1) % 6];
      UI.toast(`sales training module ${n} of 12`, sk.name.toLowerCase());
      if (sk.id === 'health' && !S.chloe()) { S.max = 100 + 15 * S.skill('health'); Play.heal(15); }
    }
  }
  function read(S, e) {
    UI.reader({ title: e.title, text: e.text });
    const p0 = S.c.root.position.clone();
    S.start({
      name: 'read', move: true, speed: 1.2, fragile: true,
      update() {             // ends a frame after the key, so the same E can't also pick something up
        if (this.shut) return true;
        this.shut = this.t > 0.3 && S.ctl && (Input.pressed('interact') || Input.pressed('backpack') || Input.pressed('back') || S.c.root.position.distanceTo(p0) > 2.5);
      },
      end() { UI.reader(null); Audio.sfx('page_turn', { vol: 0.5 }); },
    });
  }

  // ---- backpack crafting wheel -----------------------------------------------------------------------------------------
  let sel = 0;
  function craftable(S, r) {
    const inv = S.inv;
    for (const k in r.need) if ((inv.items[k] || 0) < r.need[k]) return false;
    if (r.id === 'blade') return !!inv.melee && !inv.melee.blade;
    return (inv.items[r.id] || 0) < (CAP[r.id] ?? 9);
  }
  function wheel(S, progress) {
    const inv = S.inv;
    return {
      sel, progress,
      recipes: CONTENT.recipes.map(r => ({ id: r.id, name: name(r.id), use: r.use, can: craftable(S, r), count: r.id === 'blade' ? (inv.melee && inv.melee.blade ? 1 : 0) : inv.items[r.id] || 0,
        need: Object.entries(r.need).map(([k, n]) => ({ id: k, name: name(k), n, have: inv.items[k] || 0 })) })),
      items: ['cloth', 'alcohol', 'tape', 'sim', 'battery', 'nokia', 'scrap'].map(k => ({ name: name(k), n: inv.items[k] || 0 })),
      melee: inv.melee ? name(inv.melee.kind) : null, bars: inv.items.bars || 0,
    };
  }
  function backpack(S) {
    const c = S.c, acc = { x: 0, y: 0 };
    let prog = 0, crafting = false, wait = false;
    c.pose('kneel_one', { dur: 0.35 });
    Audio.sfx('page_turn', { vol: 0.4, rate: 0.7 });
    const R = CONTENT.recipes, N = R.length;
    S.start({
      name: 'backpack', fragile: true, cam: { dist: 1.9, h: 0.95, side: 0.55, fov: 58, pitch: 0.3, lockLook: true },
      update(dt) {
        if (this.t > 0.15 && S.ctl && (Input.pressed('backpack') || Input.pressed('back'))) return true;
        if (!S.ctl) return;
        acc.x += Input.look.x; acc.y += Input.look.y;
        const l = Math.hypot(acc.x, acc.y);
        if (l > 0.12) { sel = ((Math.round(Math.atan2(acc.x, -acc.y) / (Math.PI * 2 / N)) % N) + N) % N; if (l > 0.3) { acc.x *= 0.3 / l; acc.y *= 0.3 / l; } }
        if (Input.pressed('menuLeft')) sel = (sel + N - 1) % N;
        if (Input.pressed('menuRight')) sel = (sel + 1) % N;
        const hold = Input.down('fire') || Input.down('confirm') || Input.down('interact');
        if (!hold) wait = false;
        const r = R[sel], ok = craftable(S, r) && hold && !wait;
        if (ok) prog += dt / (r.time * [1, 0.8, 0.6][S.skill('craft')]); else prog = Math.max(0, prog - dt * 3);
        if (ok !== crafting) { crafting = ok; c.gesture(ok ? 'clean_hands' : null, ok ? { hold: true } : {}); if (ok) Audio.sfx('craft', { pos: c.root.position, vol: 0.5 }); }
        if (prog >= 1) {
          prog = 0; wait = true;
          for (const k in r.need) S.inv.items[k] -= r.need[k];
          if (r.id === 'blade') { S.inv.melee.blade = true; S.inv.melee.hits = Math.max(S.inv.melee.hits, 3); } else give(S, r.id, 1);
          Audio.sfx('craft', { pos: c.root.position, rate: 1.25 });
          UI.toast(`crafted ${name(r.id)}`);
        }
        UI.backpack(wheel(S, prog));
      },
      end() { c.gesture(null); c.pose('stand', { dur: 0.35 }); UI.backpack(null); },
    });
    UI.backpack(wheel(S, 0));
  }

  // ---- workbench ----------------------------------------------------------------------------------------------------------
  function workbench(A, S, o) {
    const yaw = o.yaw || 0, f = U.fwd(yaw, new V3());
    Build.prop('table', { kind: 'workbench', pos: o.at, yaw });
    const at = A.w(o.at), W = { A, at, yaw, f, stand: at.clone().addScaledVector(f, 0.72) };
    A.interactable({ at: [o.at[0] + f.x * 0.75, o.at[1] || 0, o.at[2] + f.z * 0.75], r: 1.3, once: false, prompt: 'e – use workbench', cond: () => !S.act && S.p.combat, use: () => bench(S, W) });
    return W;
  }
  function bench(S, W) {
    const c = S.c, inv = S.inv, f = W.f, rx = -f.z, rz = f.x;
    const guns = () => inv.weapons.filter(w => CONTENT.upgrades[w]);
    let gi = Math.max(0, guns().indexOf(inv.weapon)), row = 0, tinker = 0, gunMesh = null, shown = null;
    const top = W.at.clone(); top.y += 0.9;
    const p0 = c.root.position.clone(), yaw0 = c.yaw;
    // close-up from over Chase's right side, looking down at the gun on the bench (the upgrade list sits screen-left)
    const camPos = top.clone().addScaledVector(f, 0.62).addScaledVector(new V3(rx, 0, rz), -1.1); camPos.y += 0.85;
    const camTgt = top.clone().addScaledVector(f, 0.05).addScaledVector(new V3(rx, 0, rz), 0.22);
    Audio.sfx('metal_hit', { pos: top, vol: 0.3 });
    const state = () => {
      const gs = guns(), w = gs[gi], bars = inv.items.bars || 0, have = inv.upgrades[w] || [];
      return { guns: gs.map(g => name(g)), gi, row, bars, list: w ? CONTENT.upgrades[w].map(u => ({ name: u.name, text: u.text, cost: u.cost, owned: have.includes(u.id), can: !have.includes(u.id) && bars >= u.cost })) : [] };
    };
    S.start({
      name: 'bench', root: true, cam: { lockLook: true },
      pose(cp, dt) { const k = U.smooth(U.clamp(this.t / 0.8)); cp.pos.lerp(camPos, k); cp.target.lerp(camTgt, k); cp.fov = U.lerp(cp.fov, 46, k); },
      update(dt) {
        const k = U.smooth(U.clamp(this.t / 0.5)), p = c.root.position;
        p.x = U.lerp(p0.x, W.stand.x, k); p.z = U.lerp(p0.z, W.stand.z, k);
        c.yaw = yaw0 + U.wrapAngle(W.yaw + Math.PI - yaw0) * k;
        c.setMove(k < 1 ? 1 : 0);
        const gs = guns(), w = gs[gi];
        if (w !== shown) {        // the gun lies on the bench while Chase works on it
          if (gunMesh) W.A.group.remove(gunMesh);
          shown = w; gunMesh = w ? mesh(w) : null;
          if (gunMesh) { gunMesh.position.copy(top).sub(W.A.origin); gunMesh.rotation.y = W.yaw + Math.PI / 2; W.A.group.add(gunMesh); }
        }
        tinker = Math.max(0, tinker - dt);
        const s = Math.sin(this.t * (tinker > 0 ? 16 : 3)) * (tinker > 0 ? 0.03 : 0.012);
        const T = c.ikT || (c.ikT = {});
        T.L = { p: top.clone().add(new V3(rx * 0.14 + f.x * 0.06, 0.03 + s, rz * 0.14 + f.z * 0.06)), w: k };
        T.R = { p: top.clone().add(new V3(-rx * 0.12 + f.x * 0.1, 0.05 - s, -rz * 0.12 + f.z * 0.1)), w: k };
        if (this.t < 0.6 || !S.ctl) { UI.workbench(state()); return; }
        if (Input.pressed('backpack') || Input.pressed('back')) return true;
        const L = w ? CONTENT.upgrades[w].length : 0;
        if (Input.pressed('menuLeft') && gs.length) { gi = (gi + gs.length - 1) % gs.length; row = 0; Audio.sfx('pluck', { vol: 0.4 }); }
        if (Input.pressed('menuRight') && gs.length) { gi = (gi + 1) % gs.length; row = 0; Audio.sfx('pluck', { vol: 0.4 }); }
        if (Input.pressed('menuUp') && L) { row = (row + L - 1) % L; Audio.sfx('pluck', { vol: 0.3 }); }
        if (Input.pressed('menuDown') && L) { row = (row + 1) % L; Audio.sfx('pluck', { vol: 0.3 }); }
        if (L && (Input.pressed('interact') || Input.pressed('confirm'))) {
          const u = CONTENT.upgrades[w][row], have = inv.upgrades[w] || (inv.upgrades[w] = []);
          if (!have.includes(u.id) && (inv.items.bars || 0) >= u.cost) {
            inv.items.bars -= u.cost; have.push(u.id); tinker = 1.2;
            if (u.id === 'cap') inv.clip[w] = Math.min(inv.clip[w] || 0, Arms.cap(S, w));
            Audio.sfx('craft', { pos: top }); Audio.sfx('metal_hit', { pos: top, vol: 0.5 });
          } else Audio.sfx('dry_fire', { vol: 0.4 });
        }
        UI.workbench(state());
      },
      end() { c.ikT = {}; if (gunMesh) W.A.group.remove(gunMesh); UI.workbench(null); },
    });
  }

  // ---- area + frame --------------------------------------------------------------------------------------------------
  let SS = null;
  function extendArea(A, S) {
    SS = S;
    A.pickup = o => addPickup(A, S, A.w(o.at).sub(A.origin), o.item, scale(o.n ?? 1), o.prompt);
    A.collectible = o => collectible(A, S, o);
    A.workbench = o => workbench(A, S, o);
  }
  function unloadArea(A) { for (let i = pickups.length - 1; i >= 0; i--) if (pickups[i].A === A) pickups.splice(i, 1); }
  function update(S, dt) {
    const p = S.c.root.position;
    for (const P of pickups) {
      P.t += dt;
      const d = P.glint.position.distanceTo(_a.copy(p).sub(P.A.origin));
      const tw = (P.t % 2.6) / 2.6, flash = tw < 0.18 ? Math.sin(tw / 0.18 * Math.PI) : 0;
      const k = U.clamp((14 - d) / 4) * (0.35 + flash);
      P.glint.scale.setScalar(0.001 + k * (0.14 + 0.12 * flash));
      P.glint.material.opacity = Math.min(1, k);
    }
    if (S.p.combat && S.ctl && !S.act && Input.pressed('backpack') && !(S.water && S.water.deep)) backpack(S);
  }

  return { extendArea, unloadArea, update, give, mesh, drop };
})();
