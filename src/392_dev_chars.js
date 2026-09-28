// ============================================================================
// Character studio (dev only, chars agent): a cyclorama with three-point lighting, far from every area.
//   ?dev&test=chars[&who=id&view=full|face|face34|profile|eyes|close|bust|busts|turn|back&em=emote|talk&ang=rad]
//                                                          line-up of every character (or the listed ones)
//   ?dev&test=faces&who=id[&em=smile,sad]                  emote grid: every emote (or the listed ones) on one face
//   ?dev&test=anims                                        locomotion, poses, paired anims, gestures, talking
// ============================================================================
CONTENT.levels.STUDIO = {
  name: 'Character studio', origin: [-6000, 0, 0], grade: 'neutral', background: 0x1b1d21,
  fog: { color: 0x1b1d21, near: 30, far: 80 },
  env: { top: 0x5a6068, horizon: 0x6c655c, bottom: 0x2a2826, intensity: 0.55, spots: [{ dir: [0.6, 0.5, 0.7], color: 0xfff2e0, power: 2.2 }] },
  build(A) {
    // cyclorama: floor sweeping up into a back wall
    const prof = [];                                                   // (z, y) profile: floor, quarter-circle sweep, wall
    for (let i = 0; i <= 8; i++) prof.push([14 - i * 2.2, 0]);
    for (let i = 1; i <= 12; i++) { const a = i / 12 * Math.PI / 2; prof.push([-3.6 - Math.sin(a) * 5, 5 - Math.cos(a) * 5]); }
    prof.push([-8.6, 22]);
    const pos = [], idx = [];
    prof.forEach(([z, y]) => pos.push(-40, y, z, 40, y, z));
    for (let i = 0; i < prof.length - 1; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    const cyc = new THREE.BufferGeometry(); cyc.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); cyc.setIndex(idx); cyc.computeVertexNormals();
    Build.mesh(cyc, new THREE.MeshStandardMaterial({ color: 0x5a5c60, roughness: 0.92 }), { pos: [0, 0, 0], shadow: false, receive: true });
    Build.hemi({ sky: 0x9aa4b4, ground: 0x3a3430, intensity: 0.35 });
    const key = Build.sun({ dir: [0.55, -0.75, -0.6], color: 0xfff0dc, intensity: 2.6, area: 9, target: [0, 1, 0] });
    key.shadow.bias = -0.0002; key.shadow.normalBias = 0.02;
    Build.light('spot', { pos: [-5, 2.6, 3.5], target: [0, 1.3, 0], color: 0xb8ccff, intensity: 18, distance: 20, angle: 0.8, penumbra: 0.9 });
    Build.light('spot', { pos: [0.3, 3, -5], target: [0, 1.5, 0], color: 0xfff4e8, intensity: 24, distance: 16, angle: 0.7, penumbra: 0.6 });
    A.marker('mk_start', [0, 0, 3], Math.PI);
  },
};

(() => {
  const P = new URLSearchParams(location.search);
  const ORDER = () => Object.keys(Chars.defs).filter(id => !Chars.defs[id].hidden && !Chars.defs[id].quad);
  const cam = (pos, look, lens = 50) => Director.manual({ pos: new THREE.Vector3(...pos).add(new THREE.Vector3(-6000, 0, 0)), target: new THREE.Vector3(...look).add(new THREE.Vector3(-6000, 0, 0)), fov: U.lensToFov(lens) });
  const W = (x, y, z) => new THREE.Vector3(x - 6000, y, z);

  CONTENT.dev.cam = (x, y, z, tx, ty, tz, lens = 50) => cam([x, y, z], [tx, ty, tz], lens);   // eval helper for screenshots
  CONTENT.dev.profile = (id = 'crowd', n = 5) => {                              // eval helper: ms per build stage [body+head, atlas, face]
    const out = [];
    for (let i = 0; i < n; i++) {
      const look = Chars.resolveLook(id, { seed: 200 + i }), t0 = performance.now(), B = CharBody.build(look), t1 = performance.now();
      B.atlas.paint(); const t2 = performance.now(); const f = CharFace.create(B, look); CharFace.update(f, 0.03, null, 0);
      out.push([t1 - t0, t2 - t1, performance.now() - t2].map(Math.round)); CharBody.dispose(B); CharFace.dispose(f);
    }
    return out;
  };
  CONTENT.dev.faceCanvas = name => { const c = Game.G.who(name); return c.face.cv.toDataURL('image/png'); };   // eval helper: the live face canvas

  CONTENT.dev.chars = async G => {
    const A = await G.area('STUDIO');
    const who = P.get('who'), view = P.get('view') || 'full';
    const ids = who ? who.split(',') : ORDER();
    const wOf = id => Chars.defs[id]?.quad ? 2.4 : 0.95, list = [];      // animals stand side-on
    let x = -ids.reduce((a, id) => a + wOf(id), 0) / 2;
    ids.forEach((id, i) => {
      x += wOf(id) / 2;
      const c = A.char(id, { name: id + i, at: [x, 0, 0], yaw: (view === 'back' ? Math.PI : 0) + (Chars.defs[id]?.quad ? Math.PI / 2 : 0) });
      x += wOf(id) / 2;
      list.push(c);
    });
    if (view === 'turn') A.update((dt, t) => { for (const c of list) c.yaw += dt * 0.6; });
    const em = P.get('em');                                                   // &em=smile | talk: every character emotes / talks
    if (em === 'talk') A.update(() => { for (const c of list) if (!c.speaking) c.speak('Your grandkids’ll be in your hand, mate. Every night if you want.', 3.4); });
    else if (em) list.forEach(c => c.emote(em));
    if (view.startsWith('face') || view === 'close' || view === 'profile') list.forEach(c => c.lookAt(W(0, 1.6, 3)));
    const H = Math.max(...list.map(c => c.height)), span = ids.reduce((a, id) => a + wOf(id), 0);
    if (view === 'face') { const c = list[0]; const e = c.point('eyes'); cam([e.x + 6000 + 0.02, e.y - 0.01, 0.62], [e.x + 6000, e.y - 0.035, 0], 85); }
    else if (view === 'face34') { const c = list[0]; const e = c.point('eyes'); cam([e.x + 6000 + 0.42, e.y + 0.02, 0.5], [e.x + 6000, e.y - 0.03, 0], 85); }
    else if (view === 'profile') { const c = list[0]; const e = c.point('eyes'); cam([e.x + 6000 + 0.65, e.y, -0.02], [e.x + 6000, e.y - 0.03, -0.02], 85); }
    else if (view === 'eyes') { const c = list[0], e = c.point('eyes'); cam([e.x + 6000 + 0.08, e.y + 0.01, 0.55], [e.x + 6000, e.y - 0.005, 0], 100); }
    else if (view === 'close') { const c = list[0], e = c.point('eyes'), a = +(P.get('ang') || 0.35), d = 0.56 / (2 * Math.tan(U.lensToFov(65) * Math.PI / 360)); cam([e.x + 6000 + Math.sin(a) * d, e.y + 0.02, Math.cos(a) * d], [e.x + 6000, e.y - 0.1, 0], 65); }
    else if (view === 'bust') { const c = list[0]; const e = c.point('eyes'); cam([e.x + 6000 + 0.35, e.y - 0.05, 1.3], [e.x + 6000, e.y - 0.2, 0], 50); }
    else if (view === 'busts') { const e = list[0].point('eyes'); cam([0, e.y - 0.1, span * 0.95 + 0.6], [0, e.y - 0.25, 0], 35); }
    else if (ids.length === 1) cam([0.9, H * 0.62, 3.6], [0, H * 0.5, 0], 50);
    else cam([0, H * 0.6, Math.max(3.2, span * 1.02)], [0, H * 0.5, 0], 40);
  };

  CONTENT.dev.faces = async G => {
    const A = await G.area('STUDIO');
    const id = P.get('who') || 'chase_young';
    const emotes = P.get('em') ? P.get('em').split(',') : ['neutral', 'smirk', 'smile', 'laugh', 'sad', 'crying', 'angry', 'afraid', 'shocked', 'tender', 'tense', 'ashamed', 'exhausted', 'lying', 'talk'];
    const cols = Math.min(5, emotes.length), dx = 0.34, dy = 0.42;
    emotes.forEach((e, i) => {
      const r = Math.floor(i / cols), q = i % cols;
      const c = A.char(id, { name: 'f' + i, at: [(q - (cols - 1) / 2) * dx, -r * dy, 0], yaw: 0 });
      if (e === 'talk') { c.emote('neutral'); const say = () => { c.speak('Your grandkids’ll be in your hand, mate. Every night if you want.', 3.4); }; say(); A.update((dt, t) => { if (!c.speaking) say(); }); }
      else c.emote(e);
      c.lookAt(W((q - (cols - 1) / 2) * 0.1, 1.5, 3));
    });
    const c0 = G.who('f0');
    const ey = c0.point('eyes').y;
    const my = ey - (Math.ceil(emotes.length / cols) - 1) * dy / 2;
    cam([0, my + 0.03, 2.55], [0, my - 0.02, 0], emotes.length > cols ? 70 : 85);
  };

  // ?dev&test=crowd — the launch-night queue: 40 seeded extras. window.PERF gets the creation time;
  // CONTENT.dev.calls() -> {calls, tris} of one scene render (shadow pass included) for draw-call budgets.
  CONTENT.dev.calls = () => {
    const R = Engine.renderer; R.info.autoReset = false; R.info.reset(); R.render(Engine.scene, Engine.camera);
    const o = { calls: R.info.render.calls, tris: R.info.render.triangles }; R.info.autoReset = true; return o;
  };
  CONTENT.dev.crowd = async G => {
    const A = await G.area('STUDIO'), n = +(P.get('n') || 40);
    cam([0, 1.7, 7], [0, 1.1, -3], 35);
    const start = performance.now();
    for (let i = 0; i < n; i++) {
      const c = A.char('crowd', { name: 'q' + i, seed: 100 + i, at: [((i % 10) - 4.5) * 0.75 + (i >> 3) * 0.1, 0, -((i / 10) | 0) * 1.1], yaw: Math.PI * 0.5 + (i % 3 - 1) * 0.4 });
      if (i % 3 === 0) { c.pose('phone'); c.hold('phone', 'r'); c.phoneGlow(true); }
    }
    window.PERF = { create_ms: Math.round(performance.now() - start), per_char_ms: +((performance.now() - start) / n).toFixed(1) };
  };

  CONTENT.dev.anims = async G => {
    const A = await G.area('STUDIO');
    const view = P.get('view') || 'all', on = k => view === 'all' || view === k;
    const S = (id, name, x, z, yaw = 0) => A.char(id, { name, at: [x, 0, z], yaw });
    if (on('loco')) {                                   // walking, jogging, sprinting, crouch-walking, limping while carrying
      const loops = [];
      const loop = (c, speed, o = {}, r = 1.1) => loops.push({ c, speed, o, r, a: Math.random() * 6, cx: c.root.position.x, cz: c.root.position.z });
      loop(S('chase_young', 'walker', -6, -3), 1.4);
      loop(S('luke_young', 'jogger', -2.5, -3), 3.0, {}, 1.6);
      loop(S('chase_young', 'sprinter', 1.5, -3), 5.5, {}, 2.2);
      loop(S('bub', 'crouch', 5, -3), 1.0, { crouch: true }, 0.9);
      const limper = S('chase_young', 'limper', 8, -3); loop(limper, 1.1, { limp: true, carry: true }, 1.4);
      limper.attach(S('bub', 'carried', 8, -3), 'carry');
      A.update(dt => {
        for (const L of loops) {
          L.a += dt * L.speed / L.r;
          L.c.root.position.set(L.cx + Math.cos(L.a) * L.r, 0, L.cz + Math.sin(L.a) * L.r);
          L.c.yaw = Math.atan2(-Math.sin(L.a), Math.cos(L.a));
          L.c.setMove(L.speed, L.o);
        }
      });
    }
    if (on('poses')) {                                  // held poses and paired animations
      S('luke_young', 'sitter', -6, 0.5).pose('sit');
      S('bub', 'kneeler', -4.5, 0.5).pose('kneel');
      S('chase_young', 'lier', -2.5, 1).pose('lie');
      S('chase_young', 'hugA', 0, 0.2).attach(S('bub', 'hugB', 0, 0.6, Math.PI), 'hug');
      const fh1 = S('chase_young', 'faceA', 2, 0.2), fh2 = S('bub', 'faceB', 2, 0.6, Math.PI); fh1.attach(fh2, 'face_hold'); fh1.emote('tense'); fh2.emote('afraid');
      const cr1 = S('chase_young', 'cradleA', 4.5, 0.5), cr2 = S('bub', 'cradleB', 4.5, 0.8); cr1.attach(cr2, 'cradle'); cr1.emote('crying'); cr2.emote('tender');
      const k1 = S('luke_young', 'shoulderA', 6.5, 0.5); k1.attach(S('bub', 'shoulderB', 6.5, 0.5), 'shoulders');
    }
    if (on('ride')) {                                   // riding double on Horse, and a deer grazing
      const h = S('horse', 'horse', 0, 6, Math.PI / 2), r1 = S('chase', 'rider', 0, 6), r2 = S('chloe', 'pillion', 0, 6);
      r1.attach(h, 'ride'); r2.attach(h, 'ride_back');
      S('deer', 'deer', 3, 6.5, -0.6).pose('graze');
      A.update((dt, t) => { h.setMove(view === 'ride' ? 1.2 + Math.sin(t * 0.3) : 0); });
    }
    if (on('gest')) {                                   // the gesture library, talking, looking at a moving target
      const gests = ['point', 'shrug', 'wave_off', 'fold_arms', 'rub_face', 'hands_on_hips', 'cover_mouth', 'wave', 'rub_palm', 'type_phone'];
      gests.forEach((g, i) => {
        const c = S(i % 2 ? 'luke_young' : 'chase_young', 'g' + i, -7 + i * 1.5, 3.5);
        if (g === 'type_phone') { c.hold('phone', 'r'); c.phoneGlow(true); }
        const go = () => c.gesture(g, { to: W(0, 1.5, 8) }).then(go);
        go();
      });
      const talker = S('bub', 'talker', 8, 3.5); const say = () => talker.speak('Did you break it? Did you break the record?', 3); say(); A.update(() => { if (!talker.speaking) say(); });
      S('luke_young', 'watcher', 9.5, 3.5).lookAt(() => W(9.5 + Math.sin(Game.time * 0.9) * 2.5, 1.5 + Math.sin(Game.time * 1.7) * 0.4, 5.5));
    }
    if (view === 'loco') cam([1, 1.5, 4.5], [1, 0.9, -3], 28);
    else if (view === 'poses') cam([0.3, 1.5, 6], [0.3, 0.7, 0.5], 30);
    else if (view === 'gest') cam([1, 1.5, 11], [1, 1.1, 3.5], 32);
    else if (view === 'ride') cam([1.5, 1.8, 11], [1.5, 1.1, 6], 35);
    else cam([0, 6, 16], [0, 0.6, 0], 40);
  };
})();
