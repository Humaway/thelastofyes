// ============================================================================
// World — collision, ground height, line-of-sight raycasts against the current area's
// axis-aligned boxes. Owned by: core. Colliders are registered by Build/levels via
// World.addBox and cleared by Game when an area unloads.
// ============================================================================
const World = (() => {
  const boxes = [];            // { min: Vector3, max: Vector3, surface, walk (top is walkable), block (blocks movement), sight (blocks LOS) }
  const surfaces = [];         // { x1, z1, x2, z2, name } footstep surface zones (last added wins)
  let terrain = null;          // optional (x, z) => ground height
  let baseSurface = 'concrete';
  let owner = null;            // area id that new boxes/surfaces belong to (set by Game while building)
  const STEP = 0.45;

  function addBox(min, max, o = {}) {
    const b = { area: owner, min: U.v3(min).clone(), max: U.v3(max).clone(), surface: o.surface || null, walk: o.walk !== false, block: o.block !== false, sight: o.sight !== false, cam: o.cam !== false, tag: o.tag || null };
    boxes.push(b); return b;
  }
  // From a mesh/group's world bounding box.
  function addObject(obj, o = {}) { obj.updateWorldMatrix(true, true); const bb = new THREE.Box3().setFromObject(obj); return addBox(bb.min, bb.max, o); }
  function removeBox(b) { const i = boxes.indexOf(b); if (i >= 0) boxes.splice(i, 1); }
  // clear(areaId) removes that area's boxes/surfaces; clear() removes everything
  function clear(areaId) {
    if (areaId == null) { boxes.length = 0; surfaces.length = 0; terrain = null; baseSurface = 'concrete'; return; }
    for (const l of [boxes, surfaces]) for (let i = l.length - 1; i >= 0; i--) if (l[i].area === areaId) l.splice(i, 1);
  }

  function groundAt(x, z, y = 1e4, r = 0) {
    let g = terrain ? terrain(x, z) : 0;
    for (const b of boxes) {
      if (!b.walk || b.max.y > y + STEP) continue;
      if (x + r < b.min.x || x - r > b.max.x || z + r < b.min.z || z - r > b.max.z) continue;
      if (b.max.y > g) g = b.max.y;
    }
    return g;
  }

  // Slide a circle (radius r) at feet height y by (dx, dz). Returns {x, z, hit}.
  const res = { x: 0, z: 0, hit: false };
  function move(x, y, z, dx, dz, r = 0.35, h = 1.7) {
    res.hit = false;
    let nx = x + dx, nz = z + dz;
    for (let iter = 0; iter < 3; iter++) {
      let any = false;
      for (const b of boxes) {
        if (!b.block || b.max.y <= y + STEP || b.min.y >= y + h) continue;
        // closest point on box (XZ) to circle centre
        const cx = U.clamp(nx, b.min.x, b.max.x), cz = U.clamp(nz, b.min.z, b.max.z);
        let ox = nx - cx, oz = nz - cz; const d2 = ox * ox + oz * oz;
        if (d2 >= r * r) continue;
        any = true; res.hit = true;
        if (d2 > 1e-8) { const d = Math.sqrt(d2), push = r - d; nx += ox / d * push; nz += oz / d * push; }
        else { // centre inside box: push out along the shallowest axis
          const px1 = nx - b.min.x, px2 = b.max.x - nx, pz1 = nz - b.min.z, pz2 = b.max.z - nz, m = Math.min(px1, px2, pz1, pz2);
          if (m === px1) nx = b.min.x - r; else if (m === px2) nx = b.max.x + r; else if (m === pz1) nz = b.min.z - r; else nz = b.max.z + r;
        }
      }
      if (!any) break;
    }
    res.x = nx; res.z = nz; return res;
  }

  // Segment vs boxes (slab test). Returns t in [0,1] of the first hit, 1 if clear.
  // filter: 'sight' (LOS) or 'cam' (camera collision) or null (any blocking box)
  function raycast(from, to, filter = 'sight') {
    const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
    let best = 1;
    for (const b of boxes) {
      if (filter && !b[filter]) continue;
      let t0 = 0, t1 = best, ok = true;
      for (const [o, d, mn, mx] of [[from.x, dx, b.min.x, b.max.x], [from.y, dy, b.min.y, b.max.y], [from.z, dz, b.min.z, b.max.z]]) {
        if (Math.abs(d) < 1e-9) { if (o < mn || o > mx) { ok = false; break; } continue; }
        let a = (mn - o) / d, c = (mx - o) / d; if (a > c) [a, c] = [c, a];
        if (a > t0) t0 = a; if (c < t1) t1 = c; if (t0 > t1) { ok = false; break; }
      }
      if (ok && t0 < best && t0 > 0) best = t0;
    }
    return best;
  }
  const visible = (a, b) => raycast(a, b, 'sight') >= 0.999;

  function addSurface(x1, z1, x2, z2, name) { surfaces.push({ area: owner, x1: Math.min(x1, x2), z1: Math.min(z1, z2), x2: Math.max(x1, x2), z2: Math.max(z1, z2), name }); }
  function surfaceAt(x, z, y = 1e4) {
    for (let i = surfaces.length - 1; i >= 0; i--) { const s = surfaces[i]; if (x >= s.x1 && x <= s.x2 && z >= s.z1 && z <= s.z2) return s.name; }
    let top = null, g = -1e9;
    for (const b of boxes) if (b.surface && b.max.y <= y + STEP && b.max.y > g && x >= b.min.x && x <= b.max.x && z >= b.min.z && z <= b.max.z) { g = b.max.y; top = b.surface; }
    return top || baseSurface;
  }

  return {
    boxes, addBox, addObject, removeBox, clear, groundAt, move, raycast, visible, addSurface, surfaceAt, STEP,
    set terrain(fn) { terrain = fn; }, get terrain() { return terrain; },
    set baseSurface(s) { baseSurface = s; }, get baseSurface() { return baseSurface; },
    set owner(id) { owner = id; }, get owner() { return owner; },
  };
})();
