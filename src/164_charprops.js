// ============================================================================
// CharProps — hand props (shared geometry + vertex-coloured PBR), holding/dropping, the infection
// Badge on the skin, phone screen glow, muzzle flash, body decals. Internal to Chars (chars agent).
//   CharProps.P[name]() -> Object3D (fresh instance, shared geometry)   · CharProps.names
//   CharProps.hold(c, prop, hand, o) · drop(c, hand, o) · badge(c, value, where) · phoneGlow(c, on, o)
//   CharProps.flash(c) · bodyDecal(c, kind, on) · update(c, dt) · feedTexture (animated feed canvas)
// Props are modelled in the RIGHT hand's bone space: fingers along -Y, palm facing +X, thumb +Z.
// ============================================================================
const CharProps = (() => {
  const V3 = THREE.Vector3;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  // --- tiny prop geometry builder: boxes/cylinders/spheres with colour, roughness, metalness ---
  function PB() {
    const parts = [];
    const add = (g, col, pos, rot, rough = 0.7, metal = 0) => {
      if (rot) g.rotateX(rot[0] || 0).rotateY(rot[1] || 0).rotateZ(rot[2] || 0);
      if (pos) g.translate(pos[0], pos[1], pos[2]);
      g = g.index ? g.toNonIndexed() : g;
      const n = g.attributes.position.count, c = new THREE.Color(col), C = new Float32Array(n * 3), R = new Float32Array(n).fill(rough), M = new Float32Array(n).fill(metal);
      for (let i = 0; i < n; i++) { C[i * 3] = c.r; C[i * 3 + 1] = c.g; C[i * 3 + 2] = c.b; }
      g.setAttribute('color', new THREE.BufferAttribute(C, 3)); g.setAttribute('rough', new THREE.BufferAttribute(R, 1)); g.setAttribute('metal', new THREE.BufferAttribute(M, 1));
      g.deleteAttribute('uv');
      parts.push(g); return api;
    };
    const api = {
      box: (w, h, d, col, pos, rot, r, m) => add(new THREE.BoxGeometry(w, h, d), col, pos, rot, r, m),
      rbox: (w, h, d, rad, col, pos, rot, r, m) => add(new RoundedBoxGeometry(w, h, d, 2, rad), col, pos, rot, r, m),
      cyl: (r1, r2, h, col, pos, rot, seg = 10, r, m) => add(new THREE.CylinderGeometry(r1, r2, h, seg), col, pos, rot, r, m),
      sph: (rad, col, pos, sc, r, m) => { const g = new THREE.SphereGeometry(rad, 10, 8); if (sc) g.scale(sc[0], sc[1], sc[2]); return add(g, col, pos, null, r, m); },
      done: () => { const g = mergeGeometries(parts); g.computeVertexNormals(); g.userData.shared = true; return g; },
    };
    return api;
  }
  // material with per-vertex roughness + metalness
  let propMat = null;
  function pmat() {
    if (propMat) return propMat;
    propMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 1 });
    propMat.onBeforeCompile = sh => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float rough; attribute float metal; varying float vRough; varying float vMetal;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRough = rough; vMetal = metal;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vRough; varying float vMetal;')
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor *= vRough;')
        .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor *= vMetal;');
    };
    propMat.customProgramCacheKey = () => 'charprop';
    propMat.userData.shared = true;
    return propMat;
  }

  // --- the Feed: an animated scrolling screen (shared canvas) ---
  const feed = (() => {
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 128;
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.userData.shared = true;
    let y = 0;
    const draw = () => {
      const g = cv.getContext('2d');
      g.fillStyle = '#0a1a3a'; g.fillRect(0, 0, 64, 128);
      for (let i = -1; i < 6; i++) {
        const yy = i * 26 + (y % 26);
        const h = ((i + Math.floor(y / 26)) * 9301 + 49297) % 233280 / 233280;
        g.fillStyle = `hsl(${205 + h * 25},85%,${45 + h * 25}%)`; g.fillRect(4, yy, 56, 18);
        g.fillStyle = 'rgba(230,245,255,0.85)'; g.fillRect(4, yy + 20, 40 - h * 20, 2);
      }
      g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(0, 0, 64, 6);
      t.needsUpdate = true;
    };
    draw();
    return { tex: t, step(dt) { y += dt * 38; draw(); } };
  })();
  const mats = {};
  function screenMat(kind) {
    if (mats[kind]) return mats[kind];
    let m;
    if (kind === 'off') m = new THREE.MeshStandardMaterial({ color: 0x07080a, roughness: 0.12, metalness: 0.2 });
    else if (kind === 'feed') m = new THREE.MeshBasicMaterial({ map: feed.tex, color: new THREE.Color(1.6, 1.8, 2.4), toneMapped: false });
    else if (kind === 'lamp') m = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.8, 2.4), toneMapped: false });
    else if (kind === 'flash') m = new THREE.MeshBasicMaterial({ color: new THREE.Color(8, 5, 2), transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    m.userData.shared = true;
    return (mats[kind] = m);
  }

  // --- prop factories: geometry cached, instance per call ---
  const geoCache = {};
  const geo = (k, f) => geoCache[k] || (geoCache[k] = f());
  const G = x => x;  // readability
  function mk(name, g, extra) {
    const o = new THREE.Group(); o.name = 'prop:' + name;
    const m = new THREE.Mesh(g, pmat()); m.castShadow = true; o.add(m);
    if (extra) extra(o);
    return o;
  }
  function screen(o, w, h, pos, rot, kind = 'off') {
    const s = new THREE.Mesh(geo('scr' + w + h, () => { const g = new THREE.PlaneGeometry(w, h); g.userData.shared = true; return g; }), screenMat(kind));
    s.position.set(...pos); if (rot) s.rotation.set(...rot); o.add(s); o.userData.screen = s; return s;
  }
  // grip: right-hand local placement {p, r} of the prop's origin; off: off-hand grip point (prop space)
  const P = {
    phone: () => { const o = mk('phone', geo('phone', () => PB().rbox(0.074, 0.152, 0.008, 0.004, '#15171a', [0, 0, 0], null, 0.35, 0.3).done())); screen(o, 0.068, 0.146, [0, 0, 0.0042]); o.userData.grip = { p: [0.03, -0.075, 0.0], r: [0, Math.PI / 2, 0] }; o.userData.curl = 0.55; return o; },
    phone_cracked: () => { const o = P.phone(); o.name = 'prop:phone_cracked'; const c = new THREE.Mesh(geo('crack', () => { const g = new THREE.PlaneGeometry(0.068, 0.146); g.userData.shared = true; return g; }), crackMat()); c.position.z = 0.0047; o.add(c); return o; },
    torch: () => { const o = mk('torch', geo('torch', () => PB().cyl(0.017, 0.017, 0.16, '#222428', [0, 0, 0], [Math.PI / 2, 0, 0], 12, 0.4, 0.6).cyl(0.024, 0.018, 0.04, '#2a2c30', [0, 0, 0.09], [Math.PI / 2, 0, 0], 12, 0.35, 0.7).done())); const l = new THREE.Mesh(geo('lens', () => { const g = new THREE.CircleGeometry(0.02, 12); g.userData.shared = true; return g; }), screenMat('lamp')); l.position.z = 0.111; o.add(l); o.userData.grip = { p: [0.02, -0.07, 0.01], r: [0, 0, 0] }; o.userData.curl = 0.85; o.userData.lamp = l; return o; },
    tyre_iron: () => { const o = mk('tyre_iron', geo('tyre', () => PB().cyl(0.009, 0.009, 0.42, '#3a3c3e', [0, 0, 0.12], [Math.PI / 2, 0, 0], 8, 0.5, 0.8).cyl(0.012, 0.009, 0.1, '#3a3c3e', [0, -0.05, 0.33], null, 8, 0.5, 0.8).done())); o.userData.grip = { p: [0.02, -0.07, 0], r: [0.6, 0, 0] }; o.userData.curl = 0.9; return o; },
    revolver: () => { const o = mk('revolver', geo('rev', () => PB().box(0.028, 0.03, 0.11, '#2a2b2e', [0, 0.01, 0.06], null, 0.35, 0.85).cyl(0.017, 0.017, 0.04, '#2f3033', [0, 0.004, 0.02], [Math.PI / 2, 0, 0], 8, 0.35, 0.85).cyl(0.007, 0.007, 0.12, '#222', [0, 0.018, 0.13], [Math.PI / 2, 0, 0], 8, 0.3, 0.9).rbox(0.026, 0.09, 0.038, 0.008, '#5a3a22', [0, -0.04, -0.01], [0.25, 0, 0], 0.6, 0).done())); o.userData.grip = { p: [0.02, -0.06, 0.0], r: [-Math.PI / 2 + 0.25, 0, 0] }; o.userData.curl = 0.95; o.userData.muzzle = [0, 0.018, 0.19]; return o; },
    pistol: () => { const o = mk('pistol', geo('pistol', () => PB().box(0.028, 0.032, 0.17, '#1c1d20', [0, 0.02, 0.05], null, 0.4, 0.6).rbox(0.026, 0.1, 0.036, 0.006, '#141416', [0, -0.035, -0.01], [0.3, 0, 0], 0.7, 0.1).done())); o.userData.grip = { p: [0.02, -0.06, 0], r: [-Math.PI / 2 + 0.3, 0, 0] }; o.userData.curl = 0.95; o.userData.muzzle = [0, 0.02, 0.14]; return o; },
    shotgun: () => { const o = mk('shotgun', geo('sg', () => PB().cyl(0.011, 0.011, 0.36, '#2a2b2e', [0.01, 0.02, 0.24], [Math.PI / 2, 0, 0], 8, 0.35, 0.85).cyl(0.011, 0.011, 0.36, '#2a2b2e', [-0.01, 0.02, 0.24], [Math.PI / 2, 0, 0], 8, 0.35, 0.85).box(0.04, 0.045, 0.16, '#5a3a22', [0, 0.01, 0.06], null, 0.6, 0).rbox(0.035, 0.1, 0.05, 0.01, '#5a3a22', [0, -0.03, -0.05], [0.5, 0, 0], 0.6, 0).done())); o.userData.grip = { p: [0.02, -0.06, 0], r: [-Math.PI / 2 + 0.4, 0, 0] }; o.userData.curl = 0.95; o.userData.off = [0, 0.0, 0.26]; o.userData.muzzle = [0, 0.02, 0.43]; return o; },
    rifle: () => { const o = mk('rifle', geo('rifle', () => PB().cyl(0.009, 0.01, 0.55, '#232427', [0, 0.025, 0.36], [Math.PI / 2, 0, 0], 8, 0.35, 0.85).box(0.04, 0.05, 0.36, '#6a4526', [0, 0.005, 0.12], null, 0.55, 0).box(0.036, 0.07, 0.28, '#6a4526', [0, -0.01, -0.2], [0.12, 0, 0], 0.55, 0).cyl(0.016, 0.016, 0.22, '#1c1c1e', [0, 0.07, 0.12], [Math.PI / 2, 0, 0], 10, 0.3, 0.8).done())); o.userData.grip = { p: [0.02, -0.06, 0], r: [-Math.PI / 2 + 0.3, 0, 0] }; o.userData.curl = 0.95; o.userData.off = [0, -0.01, 0.34]; o.userData.muzzle = [0, 0.025, 0.64]; return o; },
    bat: () => { const o = mk('bat', geo('bat', () => { const b = PB().cyl(0.016, 0.016, 0.28, '#3a3a3a', [0, 0, 0.08], [Math.PI / 2, 0, 0], 8, 0.8, 0).box(0.1, 0.03, 0.5, '#d8c28e', [0, 0, 0.47], null, 0.7, 0); for (let i = 0; i < 9; i++) b.cyl(0.006, 0.006, 0.12, i % 2 ? '#e9e6dc' : '#1a1a1a', [0.0, 0.018, 0.3 + i * 0.05], [0, 0, Math.PI / 2], 6, 0.6, 0); return b.done(); })); o.userData.grip = { p: [0.02, -0.07, 0], r: [0.9, 0, 0] }; o.userData.curl = 0.95; return o; },
    box_cutter: () => { const o = mk('box_cutter', geo('bc', () => PB().rbox(0.018, 0.012, 0.13, 0.004, '#f2c200', [0, 0, 0.02], null, 0.5, 0).box(0.012, 0.004, 0.03, '#c9ccd0', [0, 0, 0.1], null, 0.2, 0.9).done())); o.userData.grip = { p: [0.02, -0.065, 0], r: [0, 0, 0] }; o.userData.curl = 0.9; return o; },
    knife: () => { const o = mk('knife', geo('knife', () => PB().rbox(0.02, 0.022, 0.1, 0.005, '#1a1a1a', [0, 0, 0], null, 0.6, 0).box(0.004, 0.024, 0.14, '#b8bcc0', [0, 0.004, 0.12], null, 0.2, 0.9).done())); o.userData.grip = { p: [0.02, -0.065, 0], r: [0, 0, 0] }; o.userData.curl = 0.95; return o; },
    manual: () => { const o = mk('manual', geo('manual', () => PB().box(0.012, 0.21, 0.15, '#f1ecdc', [0, 0, 0], null, 0.9, 0).box(0.013, 0.05, 0.151, '#f2c200', [0, 0.08, 0], null, 0.8, 0).done())); o.userData.grip = { p: [0.02, -0.07, 0.03], r: [0, 0, 0] }; o.userData.curl = 0.5; return o; },
    letter: () => { const o = mk('letter', geo('letter', () => PB().box(0.002, 0.14, 0.1, '#efe9da', [0, 0, 0], null, 0.95, 0).done())); o.userData.grip = { p: [0.015, -0.08, 0.03], r: [0, 0, 0] }; o.userData.curl = 0.35; return o; },
    coverage_map: () => { const o = mk('coverage_map', geo('map', () => PB().box(0.003, 0.3, 0.42, '#e9edf0', [0, 0, 0.1], null, 0.3, 0).box(0.0035, 0.12, 0.18, '#f8f8f8', [0, 0.02, 0.1], null, 0.3, 0).box(0.0035, 0.06, 0.08, '#e05a3a', [0, 0.1, 0.25], null, 0.3, 0).done())); o.userData.grip = { p: [0.015, -0.07, 0.0], r: [0, 0, 0] }; o.userData.curl = 0.4; return o; },
    cassette: () => { const o = mk('cassette', geo('cass', () => PB().box(0.012, 0.064, 0.1, '#1b1b1d', [0, 0, 0], null, 0.4, 0).box(0.013, 0.04, 0.08, '#f1ede0', [0, 0.008, 0], null, 0.8, 0).done())); o.userData.grip = { p: [0.02, -0.075, 0.02], r: [0, 0, 0] }; o.userData.curl = 0.45; return o; },
    mug: () => { const o = mk('mug', geo('mug', () => PB().cyl(0.04, 0.038, 0.095, '#e8e2d4', [0, 0, 0], null, 14, 0.45, 0).cyl(0.034, 0.034, 0.002, '#3a2618', [0, 0.046, 0], null, 14, 0.2, 0).box(0.012, 0.05, 0.03, '#e8e2d4', [-0.045, 0, 0], null, 0.45, 0).done())); o.userData.grip = { p: [0.05, -0.075, 0.0], r: [0, 0, 0] }; o.userData.curl = 0.7; return o; },
    ration_bar: () => { const o = mk('ration_bar', geo('bar', () => PB().box(0.02, 0.12, 0.045, '#7c7b52', [0, 0, 0], null, 0.8, 0).box(0.021, 0.03, 0.046, '#e8e4d0', [0, 0.02, 0], null, 0.8, 0).done())); o.userData.grip = { p: [0.02, -0.075, 0.02], r: [0, 0, 0] }; o.userData.curl = 0.6; return o; },
    flowers: () => { const o = mk('flowers', geo('flw', () => { const b = PB().cyl(0.012, 0.008, 0.2, '#4f7a34', [0, 0, 0.05], [Math.PI / 2 - 0.3, 0, 0], 6, 0.8, 0); const cs = ['#f2d24b', '#e8e8f0', '#c85aa8', '#f2d24b', '#8fa0e8', '#f09a3a']; for (let i = 0; i < 9; i++) b.sph(0.017, cs[i % cs.length], [(i % 3 - 1) * 0.022, 0.05 + Math.floor(i / 3) * 0.012, 0.15 + (i % 2) * 0.02], [1, 0.6, 1], 0.8, 0); return b.done(); })); o.userData.grip = { p: [0.02, -0.07, 0], r: [-0.6, 0, 0] }; o.userData.curl = 0.9; return o; },
    digital_pet: () => { const o = mk('digital_pet', geo('pet', () => PB().sph(0.028, '#8fd1c4', [0, 0, 0], [1, 1.2, 0.55], 0.4, 0).cyl(0.004, 0.004, 0.012, '#f25a8a', [0, -0.02, 0.015], [Math.PI / 2, 0, 0], 6, 0.5, 0).done())); screen(o, 0.022, 0.018, [0, 0.006, 0.0155]); o.userData.grip = { p: [0.025, -0.075, 0.01], r: [0, Math.PI / 2, 0] }; o.userData.curl = 0.55; return o; },
    clipboard: () => { const o = mk('clipboard', geo('clip', () => PB().box(0.006, 0.32, 0.23, '#9a7a4a', [0, 0, 0], null, 0.7, 0).box(0.007, 0.28, 0.21, '#f2eee4', [0.001, -0.01, 0], null, 0.9, 0).box(0.012, 0.03, 0.08, '#c0c4c8', [0.002, 0.15, 0], null, 0.3, 0.9).done())); o.userData.grip = { p: [0.015, -0.07, 0.08], r: [0, 0, 0] }; o.userData.curl = 0.5; return o; },
    megaphone: () => { const o = mk('megaphone', geo('mega', () => PB().cyl(0.03, 0.1, 0.28, '#e8e4d8', [0, 0.05, 0.14], [Math.PI / 2, 0, 0], 14, 0.5, 0).cyl(0.03, 0.03, 0.06, '#c83a2a', [0, 0.05, 0.0], [Math.PI / 2, 0, 0], 12, 0.5, 0).box(0.025, 0.09, 0.03, '#2a2a2a', [0, -0.01, 0.02], null, 0.6, 0).done())); o.userData.grip = { p: [0.02, -0.065, 0], r: [-Math.PI / 2 + 0.2, 0, 0] }; o.userData.curl = 0.95; return o; },
    axe: () => { const o = mk('axe', geo('axe', () => PB().cyl(0.016, 0.018, 0.85, '#c8452e', [0, 0, 0.3], [Math.PI / 2, 0, 0], 8, 0.5, 0).box(0.012, 0.13, 0.12, '#8a8e92', [0, 0.05, 0.7], null, 0.35, 0.8).box(0.014, 0.05, 0.06, '#8a8e92', [0, -0.05, 0.7], null, 0.35, 0.8).done())); o.userData.grip = { p: [0.02, -0.07, 0], r: [0.9, 0, 0] }; o.userData.curl = 0.95; return o; },
    scanner: () => {
      const o = mk('scanner', geo('scan', () => PB().box(0.045, 0.05, 0.16, '#d8d4c4', [0, 0.02, 0.05], null, 0.5, 0).rbox(0.035, 0.1, 0.04, 0.008, '#2a2a2a', [0, -0.04, -0.01], [0.3, 0, 0], 0.6, 0).cyl(0.02, 0.018, 0.02, '#1a1a1a', [0, 0.02, 0.14], [Math.PI / 2, 0, 0], 12, 0.3, 0).done()));
      const cv = document.createElement('canvas'); cv.width = 128; cv.height = 64; const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.MeshBasicMaterial({ map: tx, toneMapped: false, color: new THREE.Color(1.5, 1.5, 1.5) });
      const s = new THREE.Mesh(geo('scanscr', () => { const g = new THREE.PlaneGeometry(0.04, 0.02); g.userData.shared = true; return g; }), m);
      s.position.set(0, 0.0455, -0.01); s.rotation.set(-Math.PI / 2 + 0.5, 0, 0); o.add(s);
      o.userData.setText = (txt, red) => { const g = cv.getContext('2d'); g.fillStyle = red ? '#3a0606' : '#06200e'; g.fillRect(0, 0, 128, 64); g.fillStyle = red ? '#ff5040' : '#7dff9a'; g.font = 'bold 26px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, 64, 34); tx.needsUpdate = true; };
      o.userData.setText('READY');
      o.userData.disposeMat = m;
      o.userData.grip = { p: [0.02, -0.06, 0], r: [-Math.PI / 2 + 0.3, 0, 0] }; o.userData.curl = 0.95; return o;
    },
    radio: () => { const o = mk('radio', geo('radio', () => PB().rbox(0.035, 0.13, 0.06, 0.006, '#1e2022', [0, 0, 0], null, 0.6, 0.1).cyl(0.005, 0.004, 0.09, '#111', [0.0, 0.1, -0.015], null, 6, 0.5, 0).box(0.036, 0.03, 0.04, '#3a3d40', [0, 0.02, 0], null, 0.4, 0.3).done())); o.userData.grip = { p: [0.025, -0.075, 0.01], r: [0, 0, 0] }; o.userData.curl = 0.8; return o; },
    counter: () => { const o = mk('counter', geo('ctr', () => PB().cyl(0.022, 0.022, 0.016, '#c9ccd0', [0, 0, 0], [0, 0, Math.PI / 2], 14, 0.3, 0.85).box(0.006, 0.012, 0.012, '#e8e8e8', [0, 0.016, 0.018], null, 0.3, 0.6).done())); o.userData.grip = { p: [0.025, -0.07, 0.01], r: [0, 0, 0] }; o.userData.curl = 0.85; return o; },
    hammer: () => { const o = mk('hammer', geo('ham', () => PB().cyl(0.013, 0.015, 0.3, '#8a5a32', [0, 0, 0.08], [Math.PI / 2, 0, 0], 8, 0.6, 0).box(0.03, 0.03, 0.11, '#4a4c50', [0, 0, 0.23], [0, Math.PI / 2, 0], 0.4, 0.8).done())); o.userData.grip = { p: [0.02, -0.07, 0], r: [0.7, 0, 0] }; o.userData.curl = 0.95; return o; },
    slingshot: () => { const o = mk('slingshot', geo('sling', () => PB().cyl(0.008, 0.009, 0.1, '#6a4a2a', [0, 0, 0], [Math.PI / 2, 0, 0], 6, 0.7, 0).cyl(0.006, 0.006, 0.07, '#6a4a2a', [0, 0.025, 0.07], [Math.PI / 2 - 0.5, 0, 0], 6, 0.7, 0).cyl(0.006, 0.006, 0.07, '#6a4a2a', [0, -0.025, 0.07], [Math.PI / 2 + 0.5, 0, 0], 6, 0.7, 0).done())); o.userData.grip = { p: [0.02, -0.07, 0], r: [0, 0, 0] }; o.userData.curl = 0.95; return o; },
    flare_gun: () => { const o = mk('flare_gun', geo('flare', () => PB().cyl(0.018, 0.018, 0.14, '#e05a1a', [0, 0.02, 0.06], [Math.PI / 2, 0, 0], 10, 0.5, 0).rbox(0.026, 0.09, 0.034, 0.008, '#e05a1a', [0, -0.03, -0.01], [0.3, 0, 0], 0.5, 0).done())); o.userData.grip = { p: [0.02, -0.06, 0], r: [-Math.PI / 2 + 0.3, 0, 0] }; o.userData.curl = 0.95; o.userData.muzzle = [0, 0.02, 0.14]; return o; },
    syringe: () => { const o = mk('syringe', geo('syr', () => PB().cyl(0.006, 0.006, 0.08, '#e8eef2', [0, 0, 0.02], [Math.PI / 2, 0, 0], 8, 0.2, 0).cyl(0.001, 0.001, 0.03, '#c0c0c0', [0, 0, 0.075], [Math.PI / 2, 0, 0], 4, 0.2, 0.9).done())); o.userData.grip = { p: [0.02, -0.065, 0.01], r: [0, 0, 0] }; o.userData.curl = 0.7; return o; },
    scalpel: () => { const o = mk('scalpel', geo('scal', () => PB().box(0.008, 0.006, 0.12, '#c8ccd0', [0, 0, 0.02], null, 0.2, 0.9).box(0.003, 0.01, 0.025, '#e0e4e8', [0, 0, 0.09], null, 0.1, 1).done())); o.userData.grip = { p: [0.02, -0.065, 0.01], r: [0, 0, 0] }; o.userData.curl = 0.75; return o; },
    rag: () => { const o = mk('rag', geo('rag', () => PB().sph(0.04, '#b8b0a0', [0, 0, 0], [0.8, 1.2, 1], 0.95, 0).done())); o.userData.grip = { p: [0.025, -0.08, 0], r: [0, 0, 0] }; o.userData.curl = 0.8; return o; },
    bowl: () => { const o = mk('bowl', geo('bowl', () => PB().cyl(0.075, 0.05, 0.06, '#d8d4c8', [0, 0, 0], null, 16, 0.4, 0).cyl(0.068, 0.068, 0.002, '#6a3a22', [0, 0.024, 0], null, 16, 0.3, 0).done())); o.userData.grip = { p: [0.06, -0.08, 0], r: [0, 0, Math.PI / 2] }; o.userData.curl = 0.3; return o; },
    chips: () => { const o = mk('chips', geo('chips', () => PB().box(0.03, 0.2, 0.14, '#d83a2a', [0, 0, 0], null, 0.35, 0.4).box(0.031, 0.05, 0.1, '#f2c200', [0, 0.03, 0], null, 0.4, 0.2).done())); o.userData.grip = { p: [0.02, -0.08, 0.03], r: [0, 0, 0] }; o.userData.curl = 0.6; return o; },
    bottle: () => { const o = mk('bottle', geo('bottle', () => PB().cyl(0.032, 0.032, 0.18, '#3a6a3a', [0, 0.05, 0], null, 10, 0.1, 0).cyl(0.012, 0.03, 0.07, '#3a6a3a', [0, 0.17, 0], null, 10, 0.1, 0).done())); o.userData.grip = { p: [0.04, -0.07, 0], r: [Math.PI / 2, 0, 0] }; o.userData.curl = 0.8; return o; },
    brick: () => { const o = mk('brick', geo('brick', () => PB().box(0.065, 0.11, 0.22, '#9a4a36', [0, 0, 0.03], null, 0.95, 0).done())); o.userData.grip = { p: [0.04, -0.07, 0], r: [0, 0, 0] }; o.userData.curl = 0.7; return o; },
    pipe: () => { const o = mk('pipe', geo('pipe', () => PB().cyl(0.016, 0.016, 0.7, '#6a6c6e', [0, 0, 0.22], [Math.PI / 2, 0, 0], 8, 0.5, 0.8).done())); o.userData.grip = { p: [0.02, -0.07, 0], r: [0.9, 0, 0] }; o.userData.curl = 0.95; return o; },
    machete: () => { const o = mk('machete', geo('mach', () => PB().rbox(0.024, 0.026, 0.12, 0.006, '#1a1a1a', [0, 0, 0], null, 0.6, 0).box(0.004, 0.05, 0.42, '#9a9ea2', [0, 0.01, 0.27], null, 0.3, 0.9).done())); o.userData.grip = { p: [0.02, -0.07, 0], r: [0.9, 0, 0] }; o.userData.curl = 0.95; return o; },
    bow: () => { const o = mk('bow', geo('bow', () => { const b = PB().box(0.03, 0.03, 0.14, '#4a3222', [0, 0, 0], null, 0.6, 0); for (let i = 0; i < 6; i++) { const t = (i + 0.5) / 6; b.box(0.018, 0.012, 0.11, '#5a3e2a', [0, -0.03 * t * t * 3, 0.07 + t * 0.55], [0.25 * t, 0, 0], 0.6, 0).box(0.018, 0.012, 0.11, '#5a3e2a', [0, -0.03 * t * t * 3, -0.07 - t * 0.55], [-0.25 * t, 0, 0], 0.6, 0); } return b.cyl(0.001, 0.001, 1.34, '#e8e4d8', [0, -0.11, 0], [Math.PI / 2, 0, 0], 3, 0.8, 0).done(); })); o.userData.grip = { p: [0.02, -0.07, 0], r: [0, 0, 0] }; o.userData.curl = 0.95; return o; },
  };
  let crackM = null;
  function crackMat() {
    if (crackM) return crackM;
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 128; const g = cv.getContext('2d');
    g.strokeStyle = 'rgba(220,230,240,0.85)'; g.lineWidth = 1;
    const R = CharPaint.rng(9);
    for (let i = 0; i < 9; i++) { g.beginPath(); let x = 40, y = 30; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (R() - 0.5) * 26; y += (R() - 0.3) * 22; g.lineTo(x, y); } g.stroke(); }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.userData.shared = true;
    crackM = new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.1, metalness: 0, depthWrite: false }); crackM.userData.shared = true;
    return crackM;
  }

  // ---------------------------------------------------------------------------------------------
  function hold(c, prop, hand = 'r', o = {}) {
    const h = hand === 'l' ? 'l' : 'r';
    if (c.heldP[h]) drop(c, h, { remove: typeof prop === 'string' });
    const obj = typeof prop === 'string' ? (P[prop] ? P[prop]() : null) : prop;
    if (!obj) return null;
    const gr = obj.userData.grip || { p: [0.02, -0.07, 0], r: [0, 0, 0] }, sd = h === 'l' ? -1 : 1, s = c.D.s;
    const bone = c.bones[h === 'l' ? 'handL' : 'handR'];
    obj.position.set(gr.p[0] * sd * s, gr.p[1] * s, gr.p[2] * s);
    obj.rotation.set(gr.r[0], gr.r[1] * sd, gr.r[2] * sd);
    bone.add(obj);
    c.heldP[h] = obj;
    c.grip[h] = obj.userData.curl ?? 0.8;
    if (o.light && obj.userData.lamp) {
      const L = new THREE.SpotLight(0xfff0d8, 12, 22, 0.42, 0.55, 1.6);
      L.position.set(0, 0, 0.12); L.target.position.set(0, 0, 2); obj.add(L, L.target); obj.userData.light = L;
    }
    if (obj.userData.off && h === 'r') c.twoHand = () => c.poseName === 'aim' ? obj.localToWorld(new V3(...obj.userData.off)) : null;
    return obj;
  }
  function drop(c, hand = 'r', o = {}) {
    const h = hand === 'l' ? 'l' : 'r', obj = c.heldP[h];
    if (!obj) return null;
    c.heldP[h] = null; c.grip[h] = null;
    if (h === 'r') c.twoHand = null;
    if (c.glow && c.glow.phone === obj) phoneGlow(c, false);
    if (o.remove) { obj.parent && obj.parent.remove(obj); if (obj.userData.light) obj.userData.light.dispose(); if (obj.userData.disposeMat) { obj.userData.disposeMat.map.dispose(); obj.userData.disposeMat.dispose(); } return obj; }
    // leave it in the world, falling to the ground
    obj.updateWorldMatrix(true, false);
    const area = Game.area;
    (area ? area.group : Engine.scene).attach(obj);
    const wp = obj.getWorldPosition(new V3());
    falling.push({ obj, vy: 0, g: World.groundAt(wp.x, wp.z, wp.y, 0) + 0.02, spin: (Math.random() - 0.5) * 6 });
    return obj;
  }
  const falling = [];

  // ---- the Badge -----------------------------------------------------------------------------------
  const SPOT = {
    forearm_l: ['foreArmL', 0.45, 'in'], wrist_r: ['foreArmR', 0.9, 'in'], neck: ['neck', 0.5, 'side'], calf_r: ['shinR', 0.32, 'back'],
    forearm_r: ['foreArmR', 0.45, 'in'], wrist_l: ['foreArmL', 0.9, 'in'],
  };
  function badgeTex(value) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const g = cv.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 20, 64, 64, 64); gr.addColorStop(0, 'rgba(200,40,40,0.55)'); gr.addColorStop(1, 'rgba(200,40,40,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#e3221c'; g.beginPath(); g.arc(64, 64, 34, 0, 7); g.fill();
    const hl = g.createRadialGradient(54, 52, 2, 64, 64, 34); hl.addColorStop(0, 'rgba(255,190,180,0.6)'); hl.addColorStop(1, 'rgba(255,190,180,0)'); g.fillStyle = hl; g.beginPath(); g.arc(64, 64, 34, 0, 7); g.fill();
    const txt = String(value);
    g.fillStyle = '#fff'; g.font = `bold ${txt.length > 2 ? 26 : txt.length > 1 ? 34 : 40}px "Helvetica Neue", Helvetica, Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(txt, 64, 66);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  function badge(c, value, where) {
    let b = c.badgeObj;
    if (value == null) { if (b) { b.mesh.parent.remove(b.mesh); b.mesh.material.map.dispose(); b.mesh.material.emissiveMap = null; b.mesh.material.dispose(); c.badgeObj = null; } return; }
    where = where || (b && b.where) || 'forearm_l';
    if (!b || b.where !== where) {
      if (b) badge(c, null);
      const [bn, t, side] = SPOT[where] || SPOT.forearm_l, bone = c.bones[bn];
      const child = bone.children.find(x => x.isBone && x.name !== 'thumb' + bn.slice(-1)) || null;
      const S = bn.slice(-1), sd = S === 'L' ? 1 : -1, s = c.D.s;
      const m = new THREE.MeshStandardMaterial({ transparent: true, roughness: 0.35, emissive: 0xffffff, emissiveIntensity: 0.35, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false });
      const mesh = new THREE.Mesh(badgePlane(), m);
      const end = child ? c.bindPos[child.name] : new V3(0, 0.08, 0);
      const pos = end.clone().multiplyScalar(t);
      const r = where.startsWith('forearm') ? 0.034 * s : where.startsWith('wrist') ? 0.025 * s : where === 'neck' ? 0.05 * s : 0.055 * s;
      const nrm = side === 'in' ? new V3(-sd, 0, 0.35).normalize() : side === 'side' ? new V3(1, 0, 0.55).normalize() : new V3(0, 0, -1);
      pos.addScaledVector(nrm, r + 0.002);
      if (where === 'neck') pos.y = 0.05 * s;
      mesh.position.copy(pos); mesh.lookAt(pos.clone().add(nrm));
      mesh.quaternion.setFromUnitVectors(new V3(0, 0, 1), nrm);
      mesh.renderOrder = 2;
      bone.add(mesh);
      b = c.badgeObj = { mesh, where, value: null, rise: 0 };
    }
    if (b.value !== value) { const old = b.mesh.material.map; b.mesh.material.map = b.mesh.material.emissiveMap = badgeTex(value); b.mesh.material.needsUpdate = true; if (old) old.dispose(); b.value = value; b.pulse = 1; }
  }
  let bPlane = null;
  const badgePlane = () => bPlane || (bPlane = Object.assign(new THREE.PlaneGeometry(0.036, 0.036), {}), bPlane.userData.shared = true, bPlane);

  // ---- phone glow ---------------------------------------------------------------------------------------
  function phoneGlow(c, on, o = {}) {
    const ph = c.heldP.r && c.heldP.r.userData.screen ? c.heldP.r : c.heldP.l && c.heldP.l.userData.screen ? c.heldP.l : null;
    if (!on || !ph) {
      if (c.glow) { if (c.glow.phone.userData.screen) c.glow.phone.userData.screen.material = screenMat('off'); if (c.glow.light) { c.glow.light.parent.remove(c.glow.light); c.glow.light.dispose(); } c.glow = null; }
      c.face.u.uGlow.value.setRGB(0, 0, 0);
      return;
    }
    ph.userData.screen.material = screenMat('feed');
    c.glow = { phone: ph, light: null };
    if (o.light) { const L = new THREE.PointLight(0x7ab4ff, 0.9, 2.2, 2); L.position.set(0, 0, 0.06); ph.add(L); c.glow.light = L; }
  }
  const _hp = new V3(), _pp = new V3(), _inv = new THREE.Quaternion();
  function flash(c) {
    const g = c.heldP.r; if (!g || !g.userData.muzzle) return;
    const m = new THREE.Mesh(geoCache.flash || (geoCache.flash = (() => { const x = new THREE.PlaneGeometry(0.14, 0.14); x.userData.shared = true; return x; })()), screenMat('flash'));
    m.position.set(...g.userData.muzzle); m.rotation.x = Math.PI / 2 * 0; g.add(m);
    const m2 = m.clone(); m2.rotation.y = Math.PI / 2; g.add(m2);
    flashes.push({ a: m, b: m2, t: 0.06 });
  }
  const flashes = [];

  // ---- body decals ---------------------------------------------------------------------------------------
  function bodyDecal(c, kind, on) {
    if (kind === 'grime') { c.bodyMat.color.setRGB(...(on ? [0.8, 0.76, 0.7] : [1, 1, 1])); return; }
    if (kind === 'blood_knuckles') {
      const g = c.B.body.geometry, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, col = g.attributes.color;
      const fi = CharBody.BI.fingersR, hi = CharBody.BI.handR;
      if (!c.baseColors) c.baseColors = col.array.slice();
      for (let i = 0; i < si.count; i++) {
        const b0 = si.getX(i), w0 = sw.getX(i);
        const isKnuckle = (b0 === fi && w0 > 0.9) || (b0 === hi && w0 > 0.9 && g.attributes.position.getY(i) < c.B.J.fingersR.y + 0.02 * c.D.s);
        if (!isKnuckle) continue;
        if (on) col.setXYZ(i, c.baseColors[i * 3] * 0.8 + 0.12, c.baseColors[i * 3 + 1] * 0.25, c.baseColors[i * 3 + 2] * 0.22);
        else col.setXYZ(i, c.baseColors[i * 3], c.baseColors[i * 3 + 1], c.baseColors[i * 3 + 2]);
      }
      col.needsUpdate = true;
    }
  }

  // ---- per frame ------------------------------------------------------------------------------------------
  let lastFeed = -1;
  function update(c, dt) {
    // hand grip curl for held props
    for (const h of ['r', 'l']) {
      const g = c.grip[h]; if (g == null) continue;
      const S = h === 'l' ? 'L' : 'R', sd = h === 'l' ? 1 : -1;
      c.bones['fingers' + S].rotation.z = -sd * g * 1.1; c.bones['fingers2' + S].rotation.z = -sd * g * 1.0;
      if (!(c.poseName === 'phone' && h === 'r')) c.bones['thumb' + S].rotation.z = -sd * g * 0.6;
    }
    // phone thumb swipe while in the phone pose
    if (c.poseName === 'phone' && c.heldP.r) { const k = (Math.sin(c.t * (c.infected ? 11 : 6.5)) + 1) * 0.5; c.bones.thumbR.rotation.z = 0.2 + k * 0.5; c.bones.thumb2R.rotation.z = k * 0.4; }
    if (c.glow) {
      const ph = c.glow.phone, u = c.face.u;
      ph.getWorldPosition(_pp); c.bones.head.getWorldPosition(_hp);
      const d = _pp.distanceTo(_hp);
      c.root.getWorldQuaternion(_inv).invert();
      u.uGlowDir.value.copy(_pp).sub(_hp).applyQuaternion(_inv).normalize();
      const k = clamp(0.35 / Math.max(0.15, d), 0, 1.6) * (0.85 + 0.15 * Math.sin(c.t * 7));
      u.uGlow.value.setRGB(0.16 * k, 0.32 * k, 0.75 * k);
      if (c.glow.light) c.glow.light.intensity = 0.9 * (0.85 + 0.15 * Math.sin(c.t * 7));
      const now = Math.floor(Engine.time * 20); if (now !== lastFeed) { lastFeed = now; feed.step(0.05); }
    }
    const b = c.badgeObj;
    if (b) { b.rise = Math.min(1, b.rise + dt / 0.7); b.pulse = Math.max(0, (b.pulse || 0) - dt * 1.5); const e = b.rise < 1 ? 1 + 2.70158 * Math.pow(b.rise - 1, 3) + 1.70158 * Math.pow(b.rise - 1, 2) : 1; b.mesh.scale.setScalar(Math.max(0.01, e * (1 + b.pulse * 0.25))); b.mesh.material.opacity = Math.min(1, b.rise * 1.5); }
  }
  // global: falling dropped props and muzzle flashes (called once per frame from Chars via the first character)
  function tick(dt) {
    for (let i = falling.length - 1; i >= 0; i--) {
      const f = falling[i];
      f.vy -= 9.8 * dt; f.obj.position.y += f.vy * dt; f.obj.rotation.x += f.spin * dt;
      if (f.obj.parent && f.obj.getWorldPosition(_pp).y <= f.g) { f.obj.position.y += f.g - _pp.y; if (Math.abs(f.vy) > 1.2) { f.vy *= -0.3; f.spin *= 0.4; } else falling.splice(i, 1); }
      if (!f.obj.parent) falling.splice(i, 1);
    }
    for (let i = flashes.length - 1; i >= 0; i--) { const f = flashes[i]; f.t -= dt; if (f.t <= 0) { f.a.parent && f.a.parent.remove(f.a); f.b.parent && f.b.parent.remove(f.b); flashes.splice(i, 1); } }
  }

  return { P, names: P, hold, drop, badge, phoneGlow, flash, bodyDecal, update, tick, feed, pmat, PB, screenMat };
})();
