// ============================================================================
// Trav — context traversal on Space for the player (internal to Play; see the A.* helpers in the Play header):
// vault, climb (≤ 2 m, or marked ledges), drop down, ladders (fixed and portable), squeeze gaps, planks carried and
// laid across gaps, pallets pushed through deep water, two-person boosts. Owned by: systems (player) agent.
//   Trav.extendArea(A, S) · Trav.unloadArea(A) · Trav.update(S, dt)   (S = Play's shared player state)
// Traversal needs profile.combat or profile.canJump. Every move is an exclusive Play action that drives the root.
// ============================================================================
const Trav = (() => {
  const V3 = THREE.Vector3;
  const spots = [];                 // { A, kind: 'ladder'|'ledge'|'squeeze'|'boost', … } world space
  const items = [];                 // portable planks/ladders and pallets
  const RUNG = 0.3;
  const wood = () => Tex.color(0x8a6a4a, { rough: 0.85 }), metal = () => Tex.color(0x6e7479, { rough: 0.5, metal: 0.6 });
  const _a = new V3(), _b = new V3(), _f = new V3();
  const sm = U.smooth, cl = U.clamp;

  // ---- meshes ---------------------------------------------------------------------------------------------------
  function box(g, w, h, d, mat, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; }
  // ladder standing on its feet at the group origin, climbing face toward -Z, `len` tall
  function ladderMesh(len) {
    const g = new THREE.Group(), m = metal();
    for (const x of [-0.22, 0.22]) box(g, 0.05, len, 0.06, m, x, len / 2, 0);
    for (let y = RUNG; y < len - 0.05; y += RUNG) box(g, 0.44, 0.035, 0.035, m, 0, y, 0);
    return g;
  }
  function plankMesh(len) { const g = new THREE.Group(); box(g, 0.32, 0.05, len, wood(), 0, 0.025, 0); box(g, 0.3, 0.012, len - 0.06, Tex.color(0x6a5038, { rough: 0.9 }), 0, 0.056, 0); return g; }

  // ---- area helpers ---------------------------------------------------------------------------------------------
  function extendArea(A, S) {
    A.ladder = o => {
      if (o.spots) return portable(A, S, 'ladder', o);
      const L = fixedLadder(A, A.w(o.bottom), A.w(o.top), o.yaw);
      A.add(L.mesh); return L;
    };
    A.ledge = o => { const s = { A, kind: 'ledge', at: A.w(o.at), top: A.w(o.top), w: o.w ?? 1.4 }; spots.push(s); return s; };
    A.vault = b => {
      const wb = b.isObject3D ? World.addObject(b) : A.collider([b[0], b[1], b[2]], [b[3], b[4], b[5]]);
      wb.vault = true; return wb;
    };
    A.squeeze = o => { const s = Object.assign({ A, kind: 'squeeze' }, o, { from: A.w(o.from), to: A.w(o.to) }); spots.push(s); return s; };
    A.plank = o => portable(A, S, 'plank', o);
    A.boost = o => { const s = { A, kind: 'boost', at: A.w(o.at), top: A.w(o.top), partner: o.partner || 'chloe' }; spots.push(s); return s; };
    A.pallet = o => pallet(A, S, o);
  }
  function unloadArea(A) {
    for (const l of [spots, items]) for (let i = l.length - 1; i >= 0; i--) if (l[i].A === A) l.splice(i, 1);
  }
  function fixedLadder(A, bottom, top, yaw) {
    yaw = yaw ?? U.yawTo(bottom, top);
    const f = U.fwd(yaw, new V3()), base = bottom.clone().addScaledVector(f, 0.42);
    const mesh = ladderMesh(top.y - bottom.y + 1.05);
    mesh.position.copy(base).sub(A.origin); mesh.rotation.y = yaw;
    const L = { A, kind: 'ladder', bottom, top, yaw, base, mesh };
    spots.push(L);
    return L;
  }

  // ---- portable planks and ladders ----------------------------------------------------------------------------
  function portable(A, S, kind, o) {
    const len = kind === 'plank' ? o.len ?? 3 : 3.2;
    const it = { A, kind, len, spots: o.spots.map(s => kind === 'plank' ? { from: A.w(s.from), to: A.w(s.to) } : { bottom: A.w(s.bottom), top: A.w(s.top) }), carried: false, placed: null };
    it.mesh = kind === 'plank' ? plankMesh(len) : ladderMesh(len);
    it.lie = () => { it.mesh.rotation.set(kind === 'plank' ? 0 : -Math.PI / 2, it.yaw, 0, 'YXZ'); };
    it.yaw = o.yaw || 0;
    it.mesh.position.copy(A.w(o.at)).sub(A.origin); it.lie();
    if (kind === 'ladder') it.mesh.position.y += 0.03;
    A.add(it.mesh);
    it.use = A.interactable({ at: o.at, r: 1.6, once: false, prompt: `e – pick up ${kind}`, cond: () => !it.carried && !it.placed && !S.act, use: () => carry(S, it) });
    it.place = i => place(S, it, i);
    items.push(it);
    return it;
  }
  function carry(S, it) {
    it.carried = true;
    Audio.sfx('creak', { pos: S.c.root.position, vol: 0.6 });
    const c = S.c, g = it.mesh;
    S.start({
      name: 'carry', A: it.A, move: true, speed: 2.1,
      update() {
        // held at the right hip in both hands, angled out to the right so it reads past him; the far end a little up
        U.fwd(c.yaw, _f);
        const rx = -_f.z, rz = _f.x, p = c.point('chest', _a).addScaledVector(_f, 0.3); p.x += rx * 0.12; p.z += rz * 0.12; p.y -= 0.34;
        const T = c.ikT || (c.ikT = {});
        T.L = { p: new V3(p.x - rx * 0.2, p.y, p.z - rz * 0.2), w: 0.9 }; T.R = { p: new V3(p.x + rx * 0.2, p.y, p.z + rz * 0.2), w: 0.9 };
        const yaw = c.yaw - 0.16, q = it.kind === 'plank' ? it.len / 2 - 0.55 : -0.55;   // plank pivots at its middle, ladder at its feet
        g.position.copy(p).addScaledVector(U.fwd(yaw, _b), q).sub(it.A.origin); g.position.y += Math.max(0, q) * 0.08 - 0.03;
        g.rotation.set(it.kind === 'plank' ? -0.08 : Math.PI / 2 - 0.08, yaw, 0, 'YXZ');
        if (this.shut) return true;    // a frame after the key, so the same E can't pick it straight back up
        const si = spotNear(S, it);
        S.ask(si >= 0 ? `e – place ${it.kind}` : `e – put down ${it.kind}`);
        if (S.ctl && Input.pressed('interact')) { if (si >= 0) place(S, it, si); else drop(S, it); this.shut = true; }
      },
      end() { c.ikT = {}; if (it.carried) drop(S, it); },
    });
  }
  function spotNear(S, it) {
    const p = S.c.root.position;
    return it.spots.findIndex(s => (it.kind === 'plank' ? Math.min(U.dist2(p, s.from), U.dist2(p, s.to)) : U.dist2(p, s.bottom)) < 1.4);
  }
  function drop(S, it) {
    it.carried = false;
    const c = S.c; U.fwd(c.yaw, _f);
    _a.copy(c.root.position).addScaledVector(_f, 0.9);
    _a.y = World.groundAt(_a.x, _a.z, c.root.position.y + 0.3, 0);
    it.yaw = c.yaw; it.mesh.position.copy(_a).sub(it.A.origin); it.lie();
    it.use.pos.copy(_a);
    Audio.sfx('wood_crash', { pos: _a, vol: 0.35 });
  }
  function place(S, it, i) {
    const s = it.spots[i];
    if (it.carried) { S.act = null; S.c.ikT = {}; }
    it.carried = false; it.placed = s;
    if (it.kind === 'plank') {
      const y = Math.max(s.from.y, s.to.y) + 0.02, yaw = U.yawTo(s.from, s.to), len = U.dist2(s.from, s.to) + 0.6;
      it.mesh.scale.z = len / it.len;
      it.mesh.position.set((s.from.x + s.to.x) / 2, y - 0.02, (s.from.z + s.to.z) / 2).sub(it.A.origin);
      it.mesh.rotation.set(0, yaw, 0);
      const hx = Math.abs(Math.sin(yaw)) * len / 2 + 0.2, hz = Math.abs(Math.cos(yaw)) * len / 2 + 0.2, cx = (s.from.x + s.to.x) / 2, cz = (s.from.z + s.to.z) / 2;
      const wb = World.addBox([cx - hx, y - 0.3, cz - hz], [cx + hx, y + 0.06, cz + hz], { block: false, sight: false, cam: false, surface: 'wood' });
      wb.area = it.A.id;
      Audio.sfx('wood_crash', { pos: it.mesh.getWorldPosition(_a), vol: 0.6 });
    } else {
      const L = fixedLadder(it.A, s.bottom, s.top);
      it.A.group.remove(it.mesh); it.mesh = L.mesh; it.A.add(L.mesh);
      Audio.sfx('metal_hit', { pos: s.bottom, vol: 0.5 });
    }
  }

  // ---- pallets -----------------------------------------------------------------------------------------------------
  // the pallet is a solid box in the water: the swimmer bumps into it and, walking on, shoves it ahead (steering with it)
  const PH = 0.58;
  function pallet(A, S, o) {
    const g = Build.prop('pallet', { pos: o.at, dynamic: true, solid: false, blob: false });
    const w = o.water, y = A.origin.y + (o.y || 0);
    const P = { A, kind: 'pallet', mesh: g, pos: A.w(o.at), to: A.w(o.to), y, docked: false, rider: null, onArrive: o.onArrive, t: 0,
      box: World.addBox([0, 0, 0], [0, 0, 0], { walk: false, sight: false, cam: false, surface: 'wood' }),
      x1: A.origin.x + Math.min(w[0], w[2]) + PH, x2: A.origin.x + Math.max(w[0], w[2]) - PH, z1: A.origin.z + Math.min(w[1], w[3]) + PH, z2: A.origin.z + Math.max(w[1], w[3]) - PH };
    P.ride = c => { P.rider = c; };
    items.push(P);
    return P;
  }
  function palletTick(S, P, dt) {
    P.t += dt;
    const c = S.c;
    if (!P.docked && c && S.water && S.water.deep && S.speed > 0.2) {
      const p = c.root.position, dx = P.pos.x - p.x, dz = P.pos.z - p.z, gap = Math.max(Math.abs(dx), Math.abs(dz)) - PH, d = Math.hypot(dx, dz);
      U.fwd(c.yaw, _f);
      if (gap < 0.42 && (_f.x * dx + _f.z * dz) / d > 0.35) {
        const v = S.speed * 0.9 * dt, side = dx * _f.z - dz * _f.x, k = Math.min(1, 5 * dt);   // ahead, and drawn in front of him
        P.pos.x = cl(P.pos.x + _f.x * v - _f.z * side * k, P.x1, P.x2); P.pos.z = cl(P.pos.z + _f.z * v + _f.x * side * k, P.z1, P.z2);
        if ((P.creak = (P.creak || 0) - dt) <= 0) { P.creak = 1.4; Audio.sfx('water_splash', { pos: P.pos, vol: 0.25 }); Audio.sfx('creak', { pos: P.pos, vol: 0.2 }); }
      }
      if (U.dist2(P.pos, P.to) < 1.3) {
        P.docked = true; P.pos.set(P.to.x, P.pos.y, P.to.z);
        Object.assign(P.box, { block: false, walk: true });
        if (P.onArrive) P.onArrive(Game.G);
      }
    }
    const bob = P.docked ? 0 : Math.sin(P.t * 1.7) * 0.025;
    P.box.min.set(P.pos.x - PH, P.y - 0.6, P.pos.z - PH); P.box.max.set(P.pos.x + PH, P.y + 0.14, P.pos.z + PH);
    P.mesh.position.set(P.pos.x - P.A.origin.x, P.y - 0.02 + bob - P.A.origin.y, P.pos.z - P.A.origin.z);
    P.mesh.rotation.set(Math.sin(P.t * 1.3) * 0.02, P.mesh.rotation.y, Math.sin(P.t * 1.1 + 1) * 0.02);
    if (P.rider) { P.rider.root.position.set(P.pos.x, P.y + 0.14 + bob, P.pos.z); P.rider.setMove(0, { crouch: true }); }
  }

  // ---- context detection --------------------------------------------------------------------------------------------
  // ray (p, f) against a box in XZ: [t0, t1] or null
  function slab(p, f, b) {
    let t0 = -1e9, t1 = 1e9;
    for (const [o, d, mn, mx] of [[p.x, f.x, b.min.x, b.max.x], [p.z, f.z, b.min.z, b.max.z]]) {
      if (Math.abs(d) < 1e-6) { if (o < mn || o > mx) return null; continue; }
      let a = (mn - o) / d, c = (mx - o) / d; if (a > c) [a, c] = [c, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, c); if (t0 > t1) return null;
    }
    return [t0, t1];
  }
  function blocked(x, z, y0, y1, r = 0.3) {
    for (const b of World.boxes) if (b.block && b.max.y > y0 && b.min.y < y1 && x + r > b.min.x && x - r < b.max.x && z + r > b.min.z && z - r < b.max.z) return true;
    return false;
  }
  const facing = (S, to) => Math.abs(U.wrapAngle(U.yawTo(S.c.root.position, to) - S.c.yaw)) < 1.1;
  function context(S) {
    const c = S.c, p = c.root.position;
    for (const s of spots) {
      if (s.kind === 'ladder') {
        if (U.dist2(p, s.bottom) < 0.9 && Math.abs(p.y - s.bottom.y) < 0.4 && facing(S, s.base)) return { kind: 'ladder', s, down: false, prompt: 'space – climb' };
        if (U.dist2(p, s.top) < 0.9 && Math.abs(p.y - s.top.y) < 0.4 && facing(S, s.base)) return { kind: 'ladder', s, down: true, prompt: 'space – climb down' };
      } else if (s.kind === 'ledge') {
        if (U.dist2(p, s.at) < s.w * 0.5 + 0.4 && Math.abs(p.y - s.at.y) < 0.4 && facing(S, s.top)) return { kind: 'climb', from: s.at, to: s.top, prompt: 'space – climb' };
      } else if (s.kind === 'squeeze') {
        if (U.dist2(p, s.from) < 0.9 && Math.abs(p.y - s.from.y) < 0.5) return { kind: 'squeeze', s, a: s.from, b: s.to, prompt: 'space – squeeze through' };
        if (!s.oneWay && U.dist2(p, s.to) < 0.9 && Math.abs(p.y - s.to.y) < 0.5) return { kind: 'squeeze', s, a: s.to, b: s.from, prompt: 'space – squeeze through' };
      } else if (s.kind === 'boost') {
        const other = Game.who(s.partner);
        if (other && other !== c && U.dist2(p, s.at) < 1.2 && Math.abs(p.y - s.at.y) < 0.4 && other.root.position.distanceTo(p) < 9) return { kind: 'boost', s, other, prompt: 'space – boost' };
      }
    }
    // generic: the nearest blocking box straight ahead
    const f = U.fwd(c.yaw, _f);
    let best = null;
    for (const b of World.boxes) {
      if (!b.block || b.max.y <= p.y + World.STEP || b.max.y > p.y + 2.05 || b.min.y > p.y + 0.6) continue;
      const r = slab(p, f, b);
      if (!r || r[0] < 0 || r[0] > 0.75 || (best && r[0] >= best.r[0])) continue;
      best = { b, r };
    }
    if (best) {
      const { b, r } = best, h = b.max.y - p.y, depth = r[1] - r[0];
      if ((b.vault || (b.walk && depth <= 1.0)) && h <= 1.15) {
        const land = p.clone().addScaledVector(f, r[1] + 0.55);
        land.y = World.groundAt(land.x, land.z, p.y + 0.4, 0.1);
        if (land.y > p.y - 1.6 && !blocked(land.x, land.z, land.y + 0.3, land.y + 1.6) && !blocked(p.x + f.x * (r[0] + r[1]) / 2, p.z + f.z * (r[0] + r[1]) / 2, b.max.y + 0.05, b.max.y + 0.9, 0.2))
          return { kind: 'vault', top: b.max.y, from: p.clone(), to: land, edge: r[0], mid: (r[0] + r[1]) / 2, prompt: 'space – vault' };
      }
      if (b.walk && h > 0.5) {
        const to = p.clone().addScaledVector(f, r[0] + 0.45); to.y = b.max.y;
        if (Math.abs(World.groundAt(to.x, to.z, b.max.y + 0.05, 0) - b.max.y) < 0.05 && !blocked(to.x, to.z, b.max.y + 0.05, b.max.y + 1.75, 0.25))
          return { kind: 'climb', from: p.clone(), to, prompt: 'space – climb' };
      }
      return null;
    }
    // drop down: an edge right ahead with a 1–4.8 m fall and nothing in the way
    const e = _b.copy(p).addScaledVector(f, 0.75);
    const g = World.groundAt(e.x, e.z, p.y + 0.01, 0.1);
    if (p.y - g > 1 && p.y - g < 4.8 && !blocked(e.x, e.z, p.y + 0.3, p.y + 1.6, 0.25) && World.groundAt(p.x + f.x * 0.3, p.z + f.z * 0.3, p.y + 0.01, 0) > p.y - 0.2)
      return { kind: 'drop', from: p.clone(), to: e.clone().setY(g), prompt: 'space – drop down' };
    return null;
  }

  // ---- moves -------------------------------------------------------------------------------------------------------
  const hands = (c, a, b, w) => { const T = c.ikT || (c.ikT = {}); T.L = { p: a, w }; T.R = { p: b, w }; };
  // two hand points on an edge at height y, `d` ahead of p along yaw, 0.2 m apart
  function edgeHands(p, yaw, d, y) {
    const f = U.fwd(yaw, new V3()), rx = -f.z, rz = f.x;
    return [new V3(p.x + f.x * d + rx * 0.2, y, p.z + f.z * d + rz * 0.2), new V3(p.x + f.x * d - rx * 0.2, y, p.z + f.z * d - rz * 0.2)];
  }
  function vault(S, x) {
    const c = S.c, dur = 0.72, yaw = c.yaw, from = x.from, to = x.to, top = x.top;
    const [hl, hr] = edgeHands(from, yaw, x.mid, top + 0.02);
    c.gesture('tackle', { dur: 0.7 });
    Audio.sfx('swing', { pos: from, vol: 0.3 });
    AI.noise(from, 4, 'vault');
    S.start({
      name: 'vault', root: true, cam: { dist: 2.5 },
      update() {
        const t = cl(this.t / dur), k = U.ease.inOut(t), p = c.root.position;
        p.x = U.lerp(from.x, to.x, k); p.z = U.lerp(from.z, to.z, k);
        p.y = U.lerp(from.y, to.y, k) + Math.max(0, top + 0.12 - Math.max(from.y, to.y)) * Math.pow(Math.sin(Math.PI * cl(t * 1.1)), 0.7);
        c.setMove(t < 0.85 ? 2.4 : 1.2, { crouch: t > 0.2 && t < 0.75 });
        hands(c, hl, hr, sm(cl(t / 0.2)) * sm(cl((0.62 - t) / 0.15)));
        if (t >= 1) { Audio.footstep(World.surfaceAt(p.x, p.z, p.y), p, 0.6); return true; }
      },
      end() { c.ikT = {}; },
    });
  }
  function climb(S, x) {
    const c = S.c, from = x.from, to = x.to, h = to.y - from.y, high = h > 1.2, dur = high ? 1.35 : 0.8;
    const yaw = U.yawTo(from, to), edge = Math.max(0.25, U.dist2(from, to) - 0.4);
    const [hl, hr] = edgeHands(from, yaw, edge, to.y + 0.02);
    c.yaw = yaw;
    Audio.sfx('breath_in', { pos: from, vol: 0.35 });
    AI.noise(from, 4, 'climb');
    S.start({
      name: 'climb', root: true, cam: { dist: 2.7, pitch: high ? 0.02 : 0.12 },
      update() {
        const t = cl(this.t / dur), p = c.root.position;
        const up = high ? sm(cl((t - 0.12) / 0.55)) : sm(cl(t / 0.55)), fw = sm(cl((t - (high ? 0.5 : 0.35)) / 0.45));
        p.y = from.y + h * up; p.x = U.lerp(from.x, to.x, fw); p.z = U.lerp(from.z, to.z, fw);
        if (high && t < 0.12) p.y = from.y + 0.25 * Math.sin(Math.PI * t / 0.12);
        c.setMove(0, { crouch: t > 0.35 && t < 0.9 });
        hands(c, hl, hr, sm(cl(t / 0.12)) * sm(cl((0.85 - t) / 0.15)));
        if (t >= 1) { Audio.footstep(World.surfaceAt(p.x, p.z, p.y), p, 0.5); return true; }
      },
      end() { c.ikT = {}; c.root.position.copy(to); },
    });
  }
  function dropDown(S, x) {
    const c = S.c, from = x.from, e = x.to;
    S.start({
      name: 'drop', root: true,
      update() {
        const t = cl(this.t / 0.35), p = c.root.position;
        p.x = U.lerp(from.x, e.x, t); p.z = U.lerp(from.z, e.z, t); p.y = from.y + 0.1 * Math.sin(Math.PI * t);
        c.setMove(1.2, { crouch: true });
        return t >= 1;
      },
      end() { S.fallTop = null; S.vy = -1; },
    });
  }
  function ladder(S, x) {
    const c = S.c, L = x.s, f = U.fwd(L.yaw, new V3()), yTop = L.top.y - 1.3;
    let y = x.down ? yTop : L.bottom.y, phase = x.down ? 'on_top' : 'mount', climbed = 0;
    const px = L.base.x - f.x * 0.36, pz = L.base.z - f.z * 0.36;
    S.start({
      name: 'ladder', root: true, A: L.A, cam: { dist: 2.6, side: 0.5 },
      update(dt) {
        const t = this.t, p = c.root.position;
        c.yaw = U.angleDamp(c.yaw, L.yaw, 12, dt);
        if (phase === 'mount') { const k = cl(t / 0.3); p.x = U.lerp(p.x, px, k); p.z = U.lerp(p.z, pz, k); if (t >= 0.3) phase = 'climb'; }
        else if (phase === 'on_top') {        // step back off the top onto the ladder
          const k = sm(cl(t / 0.9)); p.x = U.lerp(L.top.x, px, k); p.z = U.lerp(L.top.z, pz, k); p.y = U.lerp(L.top.y, yTop, k);
          c.setMove(0, { crouch: k < 0.8 });
          if (t >= 0.9) { phase = 'climb'; y = yTop; }
        } else if (phase === 'climb') {
          const v = S.ctl ? Input.move.y : 0, dy = v * 1.25 * dt;
          y = Math.min(yTop, y + dy); climbed += Math.abs(dy);
          p.set(px, y, pz);
          c.setMove(Math.abs(v) > 0.1 ? 1.1 : 0);
          if (climbed > RUNG) { climbed = 0; Audio.footstep('metal', p, 0.35); }
          if (y <= L.bottom.y && v < -0.1) { p.y = L.bottom.y; return true; }
          if (y >= yTop - 1e-3 && v > 0.1) { phase = 'over'; this.t0 = t; }
          S.ask(y >= yTop - 1e-3 ? 'w – climb up' : '');
        } else {                              // over the top edge
          const k = cl((t - this.t0) / 0.95);
          p.y = U.lerp(yTop, L.top.y, sm(cl(k / 0.6))); const fw = sm(cl((k - 0.4) / 0.6));
          p.x = U.lerp(px, L.top.x, fw); p.z = U.lerp(pz, L.top.z, fw);
          c.setMove(0, { crouch: k > 0.3 && k < 0.9 });
          if (k >= 1) return true;
        }
        // hands on the rungs (alternating), or on the top edge while going over
        const hy = phase === 'over' || phase === 'on_top' ? L.top.y + 0.02 : Math.floor((p.y + 1.62) / RUNG) * RUNG + L.bottom.y % RUNG;
        const alt = Math.floor(p.y / RUNG) % 2 ? RUNG : 0;
        const rx = -f.z * 0.19, rz = f.x * 0.19, bx = L.base.x - f.x * 0.04, bz = L.base.z - f.z * 0.04;
        hands(c, new V3(bx + rx, Math.min(hy + alt, L.top.y + 0.9), bz + rz), new V3(bx - rx, Math.min(hy + RUNG - alt, L.top.y + 0.9), bz - rz), 1);
      },
      end() { c.ikT = {}; },
    });
  }
  function squeeze(S, x) {
    const c = S.c, a = x.a, b = x.b, len = a.distanceTo(b), dir = U.yawTo(a, b), s = x.s;
    let k = 0, mid = false;
    Audio.sfx('breath_in', { pos: a, vol: 0.3 });
    S.start({
      name: 'squeeze', root: true, A: s.A, cam: { dist: 1.7, side: 0.12, fov: 55, yaw: dir + 0.15, pitch: 0.1 },
      update(dt) {
        const p = c.root.position, input = S.ctl ? Math.hypot(Input.move.x, Input.move.y) : 0;
        if (this.t < 0.4) { const q = cl(this.t / 0.4); p.x = U.lerp(p.x, a.x, q); p.z = U.lerp(p.z, a.z, q); }
        else k = Math.min(1, k + (input > 0.2 ? 0.7 : 0) * dt / len);
        c.yaw = U.angleDamp(c.yaw, dir - Math.PI / 2, 8, dt);
        if (this.t >= 0.4) p.lerpVectors(a, b, k);
        c.setMove(input > 0.2 && this.t >= 0.4 && k < 1 ? 0.7 : 0, { strafe: [-1, 0] });
        if (!mid && k >= 0.5) { mid = true; if (s.mid) s.mid(Game.G); }
        if (k >= 1) return true;
      },
      end(done) { if (done && s.onDone) s.onDone(Game.G); },
    });
  }
  function boost(S, x) {
    const s = x.s, pc = S.c, other = x.other, lifterIsPlayer = !S.chloe();
    const lifter = lifterIsPlayer ? pc : other, climber = lifterIsPlayer ? other : pc;
    const agent = AI.list.find(a => a.char === other);
    const yaw = U.yawTo(s.at, s.top), f = U.fwd(yaw, new V3()), h = s.top.y - s.at.y;
    const spotL = s.at.clone(), spotC = s.at.clone().addScaledVector(f, 0.45);
    const topC = s.top.clone(), topL = s.top.clone().addScaledVector(new V3(-f.z, 0, f.x), 0.7);
    const [el, er] = edgeHands(s.at, yaw, Math.max(0.3, U.dist2(s.at, s.top) - 0.4), s.top.y + 0.02);
    if (agent) agent.setBehaviour('scripted');
    other.stop();
    let ready = false;
    other.walkTo(lifterIsPlayer ? spotC : spotL, { speed: 1.6 }).then(() => { ready = true; });
    S.start({
      name: 'boost', root: true, A: s.A, cam: { dist: 3.2, h: 1.7, pitch: 0.02, side: 0.6 },
      update(dt) {
        const t = this.t;
        if (!ready && t < 4) { pc.yaw = U.angleDamp(pc.yaw, yaw, 8, dt); pc.setMove(0); this.t0 = t; return; }
        if (!ready) { other.stop(); other.root.position.copy(lifterIsPlayer ? spotC : spotL); ready = true; this.t0 = t; }
        const k = t - this.t0;
        lifter.yaw = U.angleDamp(lifter.yaw, yaw, 10, dt); if (k < 1.9) climber.yaw = U.angleDamp(climber.yaw, yaw, 10, dt);
        const L = lifter.root.position, C = climber.root.position;
        if (k < 0.6) {                     // the lifter crouches and cups his hands; the climber steps in
          L.lerp(spotL, 0.2); C.lerp(spotC, 0.2);
          lifter.setMove(0, { crouch: true }); climber.setMove(0);
          hands(lifter, spotC.clone().setY(L.y + 0.5), spotC.clone().setY(L.y + 0.56), sm(cl(k / 0.4)));
        } else if (k < 2.2) {              // heaved up to his chest, then she pulls herself over the edge
          const heave = sm(cl((k - 0.6) / 0.6)), pull = sm(cl((k - 1.25) / 0.6)), fw = sm(cl((k - 1.55) / 0.6));
          C.y = s.at.y + 1.25 * heave + (h - 1.25) * pull; C.x = U.lerp(spotC.x, topC.x, fw); C.z = U.lerp(spotC.z, topC.z, fw);
          lifter.setMove(0, { crouch: heave < 0.4 });
          hands(lifter, spotC.clone().setY(C.y + 0.04), spotC.clone().setY(C.y + 0.1), 1 - sm(cl((k - 1.3) / 0.3)));
          hands(climber, el, er, sm(cl((k - 0.8) / 0.35)) * (1 - sm(cl((k - 1.9) / 0.25))));
          climber.setMove(0, { crouch: pull > 0.3 && k < 2.1 });
          if (k > 0.65 && !this.grunt) { this.grunt = 1; Audio.sfx('breath_in', { pos: C, vol: 0.4 }); }
        } else if (k < 2.9) {              // turns round, kneels at the edge and reaches down
          climber.ikT = {}; climber.yaw = U.angleDamp(climber.yaw, yaw + Math.PI, 8, dt); climber.setMove(0, { crouch: true });
          lifter.setMove(0);
        } else {                           // pulls the lifter up
          const q = sm(cl((k - 2.9) / 1.3)), fw = sm(cl((k - 3.5) / 0.8));
          climber.setMove(0, { crouch: k < 4.1 });
          hands(climber, L.clone().setY(L.y + 1.9), L.clone().setY(L.y + 1.95), (1 - sm(cl((k - 3.9) / 0.3))) * sm(cl((k - 2.9) / 0.3)));
          hands(lifter, el, er, sm(cl((k - 2.9) / 0.3)) * (1 - fw));
          L.y = s.at.y + h * sm(cl((k - 3.1) / 0.8)); L.x = U.lerp(spotL.x, topL.x, fw); L.z = U.lerp(spotL.z, topL.z, fw);
          lifter.setMove(0, { crouch: q > 0.3 && q < 0.9 });
          if (k >= 4.3) return true;
        }
      },
      end() { lifter.ikT = {}; climber.ikT = {}; if (agent) agent.setBehaviour('follow'); },
    });
  }

  // ---- frame -------------------------------------------------------------------------------------------------------
  function update(S, dt) {
    for (const it of items) if (it.kind === 'pallet') palletTick(S, it, dt);
    if (!S.ctl || S.act || !(S.p.combat || S.p.canJump) || S.aim || S.throwAim || S.p.carry) return;
    const x = context(S);
    if (!x) return;
    S.ask(x.prompt);
    if (!Input.pressed('jump')) return;
    S.crouch = false;
    ({ vault, climb, drop: dropDown, ladder, squeeze, boost })[x.kind](S, x);
  }

  return { extendArea, unloadArea, update };
})();
