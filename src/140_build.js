// ============================================================================
// Build — level-builder kit: primitives with colliders, rooms, streets, stores, houses,
// vegetation, water, terrain, lights, FX (fire, god rays, dust, rain), a prop library, and
// instancing helpers. Everything built lands in the current area (Game sets Build.begin(A)).
// Owned by: world agent. THIS IS A STUB: keep the API, replace/extend the implementation.
//
// CONTRACT (all positions are [x,y,z] arrays or Vector3; yaw in radians; objects are added to
// the current area group and returned)
//   Build.begin(A) / Build.end(A)          called by Game around def.build(A)
//   Build.A                                current area context
//   Build.mesh(geo, mat, {pos, yaw, rot:[x,y,z], scale, solid, walk, surface, shadow, receive, parent}) -> Mesh
//   Build.box(w, h, d, mat, {pos (= centre of the BOTTOM face), yaw, solid=true, …}) -> Mesh
//   Build.plane(w, d, mat, {pos, yaw, rot, …}) -> Mesh (horizontal by default)
//   Build.group({pos, yaw, parent}) -> Group
//   Build.floor(x1, z1, x2, z2, mat, {y, surface}) ; Build.wall(x1, z1, x2, z2, h, mat, {y, thick, doors:[{at, w, h}], windows:[{at, w, h, sill}]})
//   Build.room({x, z, w, d, h, yaw, wall, floor, ceil, doors, windows, surface}) -> Group  (walls with openings, floor, ceiling, colliders)
//   Build.stairs({from, to, width}) ; Build.ramp(...)
//   Build.prop(name, {pos, yaw, scale, variant, text, color, solid, seed}) -> Group   — see Build.propNames for the library.
//   Build.sun({dir, color, intensity, area:[size], target}) -> DirectionalLight (the ONE shadow caster per area)
//   Build.light(type 'point'|'spot', {pos, color, intensity, distance, decay, angle, penumbra, target, flicker}) -> Light (no shadows)
//   Build.hemi({sky, ground, intensity})
//   Build.fire({pos, size, light}) ; Build.smoke({pos, size}) ; Build.godray({pos, dir, w, h, color, opacity})
//   Build.dust({box:[x1,y1,z1,x2,y2,z2], count}) ; Build.rain({area}) ; Build.fairyLights({points, color})
//   Build.water({x1, z1, x2, z2, y, color, dark}) ; Build.terrain({size, height:(x,z)=>y, mat}) (also sets World.terrain)
//   Build.tree(kind, {pos, scale, seed}) kinds: gum, fig, palm, poplar, willow, pine, snow_gum, dead
//   Build.grass({box, count, color}) ; Build.vines({box|mesh, density}) ; Build.scatter(kind, {box, count, seed})  (debris, leaves, bottles, phones, rubble, paper)
//   Build.car(kind, {pos, yaw, color, wrecked, lights}) kinds: hatch, sedan, ute, van, truck, comms_van, camper, police
//   Build.streetlight({pos, yaw, on, color}) ; Build.sign({pos, yaw, tex, w, h, post, lit})
//   Build.instanced(geo, mat, matrices[]) -> InstancedMesh
//   Build.text3d? no — use Tex.text on planes.
// ============================================================================
const Build = (() => {
  let A = null;
  const tmpE = new THREE.Euler();
  function mesh(geo, mat, o = {}) {
    const m = new THREE.Mesh(geo, mat);
    if (o.pos) U.v3(o.pos, m.position);
    if (o.rot) m.rotation.set(...o.rot); else if (o.yaw) m.rotation.y = o.yaw;
    if (o.scale) typeof o.scale === 'number' ? m.scale.setScalar(o.scale) : m.scale.set(...o.scale);
    m.castShadow = o.shadow ?? true; m.receiveShadow = o.receive ?? true;
    (o.parent || A.group).add(m);
    if (o.solid) World.addObject(m, { surface: o.surface, walk: o.walk });
    return m;
  }
  function box(w, h, d, mat, o = {}) {
    const g = new THREE.BoxGeometry(w, h, d); g.translate(0, h / 2, 0);
    return mesh(g, mat, Object.assign({ solid: true }, o));
  }
  function plane(w, d, mat, o = {}) { const g = new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2); return mesh(g, mat, Object.assign({ shadow: false }, o)); }
  function group(o = {}) { const g = new THREE.Group(); if (o.pos) U.v3(o.pos, g.position); if (o.yaw) g.rotation.y = o.yaw; (o.parent || A.group).add(g); return g; }
  function sun(o = {}) {
    const l = new THREE.DirectionalLight(o.color ?? 0xffffff, o.intensity ?? 2);
    const d = U.v3(o.dir || [-0.5, -1, -0.3]).normalize();
    const t = U.v3(o.target || [0, 0, 0]);
    l.position.copy(t).addScaledVector(d, -40); l.target.position.copy(t);
    l.castShadow = true; const s = o.area ?? 30;
    Object.assign(l.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 120 });
    l.shadow.mapSize.set(Engine.shadowMapSize, Engine.shadowMapSize); l.shadow.bias = -0.0004; l.shadow.normalBias = 0.03;
    A.group.add(l, l.target); return l;
  }
  function light(type, o = {}) {
    const l = type === 'spot' ? new THREE.SpotLight(o.color ?? 0xffffff, o.intensity ?? 10, o.distance ?? 20, o.angle ?? 0.6, o.penumbra ?? 0.5, o.decay ?? 2)
      : new THREE.PointLight(o.color ?? 0xffffff, o.intensity ?? 5, o.distance ?? 12, o.decay ?? 2);
    if (o.pos) U.v3(o.pos, l.position);
    if (type === 'spot') { U.v3(o.target || [0, 0, 0], l.target.position); A.group.add(l.target); }
    A.group.add(l); return l;
  }
  function hemi(o = {}) { const l = new THREE.HemisphereLight(o.sky ?? 0x8899aa, o.ground ?? 0x332211, o.intensity ?? 0.6); A.group.add(l); return l; }
  function prop(name, o = {}) { const g = group(o); box(0.5, 0.5, 0.5, Tex.color(0xaa33aa), { parent: g, solid: false }); return g; }
  return {
    begin(a) { A = a; }, end() { }, get A() { return A; },
    mesh, box, plane, group, sun, light, hemi, prop, propNames: [],
  };
})();
