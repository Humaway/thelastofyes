// ============================================================================
// Build — level-builder kit: primitives with colliders, rooms, streets, stores, houses,
// vegetation, water, terrain, lights, FX (fire, god rays, dust, rain), a prop library, and
// instancing helpers. Everything built lands in the current area (Game sets Build.begin(A)).
// Owned by: world agent.
//
// CONVENTIONS (read these first)
//   * Positions are area-local [x,y,z] arrays (or Vector3); yaw in radians; props face local +Z; `pos` is the centre
//     of the object's FOOTPRINT on the floor unless noted. Everything returns the created Object3D.
//   * UVs of every Build geometry are world-aligned METRES, so Tex.mat(name) materials tile at real-world scale on
//     any size of box/wall/floor (see Tex header). Don't pass `repeat` to Tex.mat for Build geometry.
//   * Baked AO: Build geometry gets vertex-colour darkening near its base (and on undersides); `tint` (hex) on kit parts
//     multiplies colour per part so one material can serve many colours.
//   * STATIC BATCHING: at Build.end(A) every static mesh Build made (props, boxes, walls, floors, rooms, stairs, trees,
//     cars, signs, streetlights, decals…) is merged per material into ~24 m cells. So after the area is built those
//     objects can no longer be moved/hidden individually. Pass { dynamic: true } to any Build call whose result you
//     will move, hide or animate later (doors you open, a car that drives, a prop a character picks up).
//     Named handles listed below (door, screen, clock…) are always kept dynamic. Build.mesh (raw) is never batched.
//   * Colliders: solid things register axis-aligned boxes with World (props default solid; pass solid:false to skip).
//     Rotated objects get the AABB of their rotated bounds, so keep big walls axis-aligned for tight collision.
//     Props are walk:false (you can't step onto furniture) unless noted; sight/cam blockers only when taller than 1.2 m.
//   * Light budget: nothing here adds a real light unless you ask (light: true / Build.light). Glows, light pools and
//     beam cones fake the rest for free. Screens, lamps and signs are emissive and bloom.
//
// CONTRACT
//   Build.begin(A) / Build.end(A)          called by Game around def.build(A) (end() does the static batching)
//   Build.A                                current area context
//   Build.mesh(geo, mat, {pos, yaw, rot:[x,y,z], scale, solid, walk, surface, shadow, receive, parent}) -> Mesh (raw, not batched)
//   Build.box(w, h, d, mat, {pos (= centre of the BOTTOM face), yaw, rot, solid=true, walk, sight, cam, surface, bevel (radius),
//        tint, ao, shadow, dynamic, parent}) -> Mesh
//   Build.plane(w, d, mat, {pos, yaw, rot, uv:'unit'|'proj', dynamic, parent}) -> Mesh (horizontal, not solid)
//   Build.group({pos, yaw, parent}) -> Group
//   Build.floor(x1, z1, x2, z2, mat, {y=0, thick=0.1, surface}) -> Mesh (top at y, walkable)
//   Build.wall(x1, z1, x2, z2, h, mat, {y, thick=0.15, back (material of the other face), doors:[{at, w=0.9, h=2.1}],
//        windows:[{at, w=1.2, h=1.2, sill=0.9}], trim (frame material | false), skirting (material), parent}) -> Group
//        `at` = distance along the wall from (x1,z1) to the opening centre. The FRONT face (mat) is on the left when
//        walking from (x1,z1) to (x2,z2). Window openings get an invisible collider; fill them with Build.prop('window').
//   Build.room({x, z, w, d, h=2.7, yaw, y, wall (interior mat), outside (exterior mat), floor, ceil (mat | false), thick,
//        doors:[{side:'n'|'e'|'s'|'w', at, w, h}], windows:[{side, at, w, h, sill}], surface, skirting=true, trim})
//        -> Group (userData.walls {n,e,s,w}). Centred on (x,z). Sides: n = -z, s = +z, w = -x, e = +x. `at` = offset
//        from the wall centre along +x (n/s walls) or +z (e/w walls).
//   Build.roof({x, z, y (eave height)=2.7, w, d, yaw, kind:'hip'|'gable', pitch=0.4 (rad), overhang=0.45, mat (roof_tiles;
//        mat('corrugated', {color}) for a Queenslander tin roof), fascia, gutter, soffit, gable (gable-end wall mat)}) -> Group
//   Build.stairs({from:[x,y,z], to:[x,y,z], width=1.1, mat, rail}) -> Group (steps rise ≤ 0.18 m; walkable)
//   Build.ramp({from, to, width=1.2, mat}) -> Mesh (walkable, via stepped colliders)
//   Build.prop(name, {pos, yaw, scale, seed, solid, dynamic, blob, worn 0..1, burnt, …prop options}) -> Group — see PROPS below.
//        Every prop accepts worn (grime, damp and fading baked into vertex colours — ten years on) and burnt (charred).
//        blob:false skips the soft contact shadow every floor-standing prop gets.
//   Build.propNames -> array of every prop name
//   Build.sun({dir, color, intensity, area:[half-size m]=30, target, far}) -> DirectionalLight (the ONE shadow caster per area)
//   Build.light(type 'point'|'spot', {pos, color, intensity, distance, decay, angle, penumbra, target, flicker 0..1,
//        shadow (spot only; counts as the area's shadow caster)}) -> Light
//   Build.hemi({sky, ground, intensity}) -> HemisphereLight
//   Build.glow({pos, color, size=1, opacity=1}) -> Sprite       additive halo (lamps, bulbs, headlights)
//   Build.pool({pos, r=3, color, opacity=0.5}) -> Mesh         additive light pool on the floor under a fake light
//   Build.beam({pos, dir, len=6, r=1.5, color, opacity=0.15}) -> Mesh   soft volumetric cone (headlights, torches, floods)
//   Build.fire({pos, size=1, light=true, smoke=true, embers=true}) -> Group (animated flame billboards + flickering light)
//   Build.smoke({pos, size=1, color, rate=0.1, count=22, lit (0..1 warm fire glow at its base)}) -> Mesh ; Build.godray({pos (source), dir, w=1.5, h=6, color, opacity=0.35}) -> Group
//   Build.dust({box:[x1,y1,z1,x2,y2,z2], count=300, color, size, opacity}) -> Points
//   Build.rain({area=36, count=4000, color, speed=11, height=18}) -> LineSegments (follows the camera)
//   Build.fairyLights({points:[[x,y,z]…], color (hex | 'multi'), per=6 (bulbs per metre), sag=0.12, light (true|intensity: one soft point light), lightAt:[x,y,z] (default 0.5 m under the middle; keep it off the wall)}) -> Group
//   Build.water({x1, z1, x2, z2, y, color, dark, streaks:[{x, z, color, w, len}]}) -> Mesh  rippled reflective
//        surface; streaks = shimmering light reflections that always point at the camera (lamp posts across water).
//   Build.terrain({size:[w,d], pos, seg, height:(x,z)=>y (area-local), mat, color}) -> Mesh (also sets World.terrain)
//   Build.tree(kind, {pos, scale, seed, color, snow}) kinds: gum, fig, palm, poplar, willow, pine, snow_gum, dead
//   Build.grass({box:[x1,z1,x2,z2], count, color, height, y}) -> InstancedMesh (wind)
//   Build.vines({box:[x1,y1,z1,x2,y2,z2] (a thin box on a wall/ceiling face), density=1, seed, hang}) -> Group
//   Build.scatter(kind, {box:[x1,z1,x2,z2], count, seed, y}) kinds: debris, leaves, bottles, phones, rubble, paper,
//        glass (shards), cans -> Group of InstancedMeshes
//   Build.car(kind, {pos, yaw, color, wrecked, burnt, lights (true|'spot'), beams, seed, dynamic}) kinds: hatch, sedan,
//        ute, van, truck, comms_van, camper, police -> Group (userData.lights = headlight meshes)
//   Build.streetlight({pos, yaw, on=true, color=0xffa640, kind:'road'|'heritage'|'bridge', h, light, pool=true, beam}) -> Group
//   Build.sign({pos (bottom centre of the panel or of the posts), yaw, tex, w, h, post (0 | height), posts:1|2, lit, back, y}) -> Group
//   Build.decal(tex | kind, {pos, yaw, w=1, h=1, floor, spin (in-plane rotation), opacity=1, color, emissive, cutout, rough}) -> Mesh
//        kind = a Tex.decal name; vertical decals face +Z rotated by yaw; floor:true lies flat.
//   Build.poster(kind, {pos, yaw, w=0.6, worn, tape}) -> Mesh  (Tex.poster on a wall, with tape corners)
//   Build.screenrot({pos, yaw, w=2, h=2, floor, ceiling, intensity}) -> Mesh  glowing blue growth patch (flickers)
//   Build.road({from:[x,z], to:[x,z], width=7, lines:'dashed'|'double'|'none', edge=true, kerb=true, path=2.4, y=0, pathMat}) -> Group
//   Build.marking(kind, {pos, yaw, w, len, text}) kinds: arrow, stop_line, give_way, zebra, text -> Mesh (road paint)
//   Build.wire(from, to, {sag=0.4, r=0.01, color}) -> Mesh      a sagging cable
//   Build.powerLine({points:[[x,z]…], h=9, wires=3, lamp}) -> Group   timber poles + sagging wires between them
//   Build.instanced(geo, mat, matrices[], {colors, shadow}) -> InstancedMesh
//   Build.windify(material, amount) -> material (adds wind sway in the vertex shader; used by foliage)
//
// PROPS — Build.prop(name, {pos, yaw, worn, burnt, dynamic, solid, blob, …options below}); '=' marks defaults.
//   Front of a prop = local +Z. Cars: Build.car(kind, …) (props car_<kind>). Street lights: Build.streetlight(…).
//   streetlight        street/esplanade/bridge light {kind (variant): road (galvanised pole, cobra head) | heritage (black
//                      lantern post) | bridge (double arm), on=true, color=0xffa640 (sodium), h, light (real point light,
//                      counts to the budget), pool=true (fake light pool), beam (fake cone in fog)}
//   store_counter      phone-store sales counter: white carcass, yellow "yes" front (+Z = customer side), POS monitor facing
//                      staff (-Z), EFTPOS, receipt printer, phone boxes {w=2.4}. userData.monitor (screen mesh)
//   demo_table         store demo table: pale timber top on white slab legs, glowing demo phones on acrylic stands with
//                      security cables and price tents {w=1.8, phones=6, screen (Tex.screen kind | Texture, default demo)}.
//                      userData.screens (meshes), userData.setScreens(kind|Texture|null) — P.3 switches them all to "feed"
//   phone              a smartphone lying flat, screen up {screen: Tex.screen kind | Texture | null (off), cracked, k (glow)}.
//                      userData.screen, userData.setScreen(kind|Texture|null)
//   phone_box          a retail phone box (sealed) lying flat
//   queue_post         single chrome stanchion with a retractable belt head {h=0.95}
//   queue_barrier      retractable-belt queue line: stanchions at `points` [[x,z],…] (prop-local) joined by belts {points,
//                      color=0xffcf12}
//   whiteboard         marker whiteboard {text ("\n" lines; prefix "r:" red, "b:" blue, "g:" green), w=1.5, h=0.95, stand=true
//                      (mobile A-frame) | false (wall-mounted; pos = bottom centre of the board)}. userData.board,
//                      userData.setText(text)
//   promo_banner       hanging vinyl promo banner {text="MIDNIGHT LAUNCH — BE FIRST", w=3, h=w/4, drop=0.4 (cords up to the
//                      ceiling)}; pos = bottom centre of the banner
//   wall_display       wall of boxed phones: laminate back panel with a backlit "yes" header, glass shelves stocked with phone
//                      boxes {w=2.4, h=2.3, lit=true}; stands against a wall, pos = bottom centre of its back
//   office_door        back-office door in a frame: grey leaf, STAFF ONLY plate, kick plate, closer {w=0.82, h=2.04, thick
//                      (wall)=0.15, open 0..1, text}. Sits in a Build.wall door opening. userData.door (pivot),
//                      userData.setOpen(0..1)
//   interior_door      painted interior door in a frame {w=0.82, open, thick}. userData.door, userData.setOpen
//   front_door         timber front door with a frosted-glass panel (the neighbour's silhouette shows through it) {w=0.87,
//                      open, color, thick}. userData.door, userData.glass (hide it to "shatter"; add Build.scatter("glass")),
//                      userData.setOpen
//   shopfront          phone-store facade (a whole front wall): aluminium-framed glazing, central sliding doors, glowing yellow
//                      "yes" lightbox fascia, window vinyls, entry mat {w=10, h=3.6, door=2.2, text="REDCLIFFE", lit=true,
//                      open=1 (doors slid 0..1), faded 0..1 (ruined store), broken (glass smashed out)}; pos = centre of the
//                      facade base, street side = +Z. userData.doors (sliding leaves group)
//   roller_shutter     security roller shutter over an opening: housing, guide rails, horizontal slats {w=3, h=2.8, open 0..1
//                      (raised fraction), color}. userData.curtain, userData.set(open)
//   security_pedestals pair of anti-theft gate pedestals flanking a store entrance {w=1.6}
//   ceiling_light      ceiling fitting, pos = on the ceiling (y = ceiling height) {kind: panel (LED troffer) | tube
//                      (fluorescent batten) | pendant (house, fabric shade) | caged (bulb in a cage) | bare, on=true, color, w,
//                      light (adds a point light: true|intensity)}
//   a_frame            footpath A-frame sign with a poster on each face {poster = Tex.poster kind (promo_launch)}
//   bed                bed: timber base, mattress, rumpled draped duvet, pillows, upholstered headboard {w=1.07 (king single;
//                      1.53 queen), l=2.03, color (duvet)=0xb8a8d8, messy=true, toy (plush bunny)}; head end at -Z
//   school_bag         slumped school backpack with front pocket, straps and a keyring {color=0x2a4a7a}
//   desk               desk {kind: study (timber, drawer pedestal, lamp, books, closed laptop) | office (grey laminate on steel
//                      legs, monitor, keyboard, paper trays), w=1.2, d=0.6, clutter=true}
//   wardrobe           freestanding wardrobe with two doors, handles and cornice {w=1.2, h=2.0, d=0.6, color, mirror}
//   couch              three-seat couch: plump seat and back cushions, arms, timber feet, throw pillows and a draped throw
//                      {w=2.1, color=0x6a7280, kind: fabric | leather, pillows=2}
//   armchair           single armchair matching the couch {color, kind}
//   coffee_table       timber coffee table with a lower shelf, magazines, remote and mug; breakable {w=1.1, d=0.6}.
//                      userData.break() swaps to the smashed version (split top, splayed legs, debris) and drops its collider
//   tv                 flat-screen TV on feet {w=1.2 (screen width), screen: Tex.screen kind | Texture | null (off; default),
//                      unit=true (low timber TV cabinet), light (a soft screen-glow point light, on while the screen shows
//                      something)}. userData.screen, userData.setScreen(kind|Texture|null)
//   kitchen_bench      kitchen run: base cupboards and drawers, laminate benchtop, tiled splashback, sink with mixer, cooktop,
//                      optional wall cupboards and range hood, everyday clutter {w=3, sink (x offset | false), cooktop (x
//                      offset | false), uppers=true, clutter=true, color (doors)}; back against the wall at -Z
//   fridge             fridge-freezer covered in magnets, a photo (fridge_faces) and a school report ("SEE ME") {w=0.7, h=1.75,
//                      color, photo=true, report=true}. userData.photo / userData.report meshes (for interactables:
//                      getWorldPosition)
//   oven               freestanding stove: oven with glass door, knobs, cooktop and a glowing digital clock {time="11:44",
//                      color}. userData.clock, userData.setTime("11:58")
//   gift_box           small gift box on its lid: tissue paper, a beaded "#1 DAD" lanyard and a handwritten note. userData.note
//                      / userData.lanyard meshes
//   photo_frame        framed photo {kind (Tex.photo) = baby_in_polo, w=0.3, stand (on a shelf) | wall (default: pos = centre
//                      of the frame on the wall)}. userData.photo
//   lamp               lamp {kind: floor | table | desk, on=true, color=0xffd6a0, shade, light (true|intensity: adds a warm
//                      point light)}
//   rug                floor rug with a border {w=2, d=1.4, color=0x8a4a3a, border=0xd8c8a8}
//   bookshelf          bookshelf full of books, a few lying stacks and ornaments {w=0.9, h=1.8, d=0.3, fill=0.85, color}
//   chair              chair {kind: dining (timber) | office (swivel) | plastic (outdoor) | folding | stool, color}
//   dining_table       timber dining table with chairs round it {w=1.6, d=0.9, chairs=4, set (plates, cutlery, glasses: a
//                      dinner that never happened), color}
//   bedside_table      bedside table with a drawer, lamp and alarm clock {lamp=true, on (lamp), time="11:44"}
//   ceiling_fan        Queensland ceiling fan, pos = on the ceiling {spin=0 (rev/s)}. userData.blades (spins by itself if spin
//                      > 0)
//   window             window unit for a Build.wall window opening: aluminium frame, mullion, glass, inside sill, curtains on a
//                      rod {w=1.2, h=1.2, curtains=true, color (curtain), open (curtains drawn open 0..1)=0.6, broken, blind,
//                      frame=0xd8dcd8}; pos = centre of the opening BOTTOM (sill height), +Z = interior side
//   bench              park bench: dark cast frame, timber slats, armrests {w=1.8, color (frame)}
//   bin                rubbish bin {kind: street (council litter bin) | wheelie (red lid) | recycle (yellow-lid wheelie) | skip
//                      (steel skip bin, 3 m), open (skip), color}
//   bus_shelter        bus shelter: aluminium posts, flat roof, glass back, backlit ad panel (poster), bench, timetable and BUS
//                      STOP sign {w=3.6, poster=promo_upgrade, lit=true}
//   jetty              timber jetty on piles running along +Z from pos (the landward end), railings, heritage lamp posts
//                      {length=40, width=3.2, deck=2.4 (deck top above pos), pile=4 (depth below pos), lamps=5, on=true (lamps
//                      lit)}
//   fence              fence running along +X from pos {kind: paling (timber, default) | colorbond (steel sheet) | picket
//                      (white) | chainlink | pool (black aluminium) | post_rail (rural), length=5, h, color, broken (paling
//                      gaps)}
//   letterbox          letterbox {kind: brick (pier with slot and house number) | post (timber post and metal box),
//                      number="12"}
//   power_pole         timber power pole with crossarm and insulators {h=9, lamp (adds a street-light arm)}; used by
//                      Build.powerLine
//   roundabout         roundabout island: concrete kerb ring, grass and low shrubs, a palm, KEEP LEFT sign {r=6}
//   servo_canopy       petrol-station canopy: clad columns, deep lit fascia with brand stripe, recessed light panels, optional
//                      pump islands {w=14, d=9, h=4.8, lit=true, pumps=true, brand="FUEL · FOOD · OPEN 24/7"}
//   fuel_pump          single fuel pump (see servo_canopy for islands) {lit}
//   price_sign         servo pylon price sign, lit both sides {prices ("UNLEADED|189.9\n…"), h=5, lit=true}
//   crash_barrier      W-beam steel guardrail on posts, along +X {length=8}
//   jersey_barrier     concrete jersey barriers in a row along +X {length=2 (multiples of 2), kind: concrete | water
//                      (orange/white plastic)}
//   bridge_railing     bridge railing along +X: concrete parapet, steel posts and two rails {length=10}
//   cone               traffic cone with reflective bands {n=1 (a short row along +X)}
//   bollard            bollard {kind: steel (yellow) | concrete}
//   boom_gate          checkpoint boom gate: pedestal and a red/white arm across +X {w=5, open 0..1}. userData.arm (pivot),
//                      userData.set(open)
//   floodlight_tower   mobile lighting tower: trailer, generator, mast and four floodlights aimed along +Z {h=7, on=true,
//                      tilt=0.45, light (spot, true|intensity), shadow (the spot casts the area's shadows), color}
//   sandbags           stacked sandbag wall along +X, staggered courses {length=3, rows=4}
//   barricade          COMMS road barricade: striped sawhorse legs, a board carrying a stencil sign, blinking amber lamp
//                      {text="ROAD CLOSED — SCREEN CHECK", w=2.4, lamp=true}
//   crate              crate {kind: wood (slatted, battened) | plastic (stacking crate) | milk (open lattice milk crate), w, h,
//                      d, color, stack=1}
//   pallet             timber pallet (AU 1165 mm) {stack=1, tilt (leaning against a wall, radians)}
//   barrel             200 L drum {kind: steel (painted, chipped) | rust | plastic (blue) | burning (rusty drum with a fire in
//                      it), color}
//   cardboard_box      cardboard carton with packing tape {w=0.5, h=0.4, d=0.4, open (flaps up), stack=1}
//   tarp               blue tarp draped over a lump (or flat on the ground) {w=2.5, d=2, h=0.8 (height of what's under it),
//                      color}
//   mattress           single mattress on the floor {dirty (stains, a pillow and a rumpled blanket), w=0.92, l=1.88}
//   camp_stove         portable butane camp stove with a dented pot and a spare canister {lit (small blue flame)}
//   table              table {kind: folding (trestle, white top on steel legs) | cafe (round metal) | plastic (outdoor) |
//                      workbench (heavy timber bench with vice and pegboard), w, d}
//   filing_cabinet     steel filing cabinet {drawers=4, open (index of a pulled-out drawer), color}
//   locker             bank of steel lockers with vents and handles {n=3, ajar (index of an open door), color}
//   plant_pot          potted plant {kind: fern | palm | succulent | dead, pot: terracotta | planter (square grey), s=1}
//   rubbish_bag        lumpy black garbage bags {n=1}
//   tyre               old tyre lying flat {stack=1, standing}
//   jerry_can          jerry can {color=0xc8261e}
//   esky               esky (cooler box) {color (lid)=0x2a6ad8}
//   generator          portable petrol generator in a tube frame {on (runs: exhaust haze)}
//   shelving           steel warehouse shelving / racking with stock {w=2.4, h=2.4, d=0.6, levels=4, fill=0.7}
// ============================================================================
const Build = (() => {
  let A = null;
  const T = Tex.time;
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color(), _n3 = new THREE.Matrix3();
  const UP = new THREE.Vector3(0, 1, 0);
  const ss = (a, b, v) => { const t = U.clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const mat = (n, o) => Tex.mat(n, o), col = (h, o) => Tex.color(h, o);
  const YEL = 0xffcf12, TEAL = 0x0e3a47;
  const cache = new Map();
  const once = (k, f) => { if (!cache.has(k)) cache.set(k, f()); return cache.get(k); };
  const shared = x => (x.userData.shared = true, x);

  // ---- geometry helpers --------------------------------------------------------
  const KEEP = new Set(['position', 'normal', 'uv', 'color']);
  function prep(g) {
    if (g.index) { const n = g.toNonIndexed(); g.dispose(); g = n; }
    for (const k of Object.keys(g.attributes)) if (!KEEP.has(k)) g.deleteAttribute(k);
    const n = g.attributes.position.count;
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    if (!g.attributes.color) g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
    g.clearGroups(); g.morphAttributes = {};
    return g;
  }
  // world-aligned planar UVs in metres (per face, works at any yaw); M = optional transform applied first
  function projUV(g, s = 1, rot = false, M = null) {
    const p = g.attributes.position.array, n = g.attributes.normal.array, uv = g.attributes.uv.array;
    if (M) _n3.getNormalMatrix(M);
    for (let i = 0, j = 0; i < p.length; i += 3, j += 2) {
      _v.set(p[i], p[i + 1], p[i + 2]); _v2.set(n[i], n[i + 1], n[i + 2]);
      if (M) { _v.applyMatrix4(M); _v2.applyMatrix3(_n3).normalize(); }
      let u, v;
      if (Math.abs(_v2.y) > 0.707) { u = _v.x; v = _v2.y > 0 ? -_v.z : _v.z; }
      else { const l = Math.hypot(_v2.x, _v2.z) || 1; u = (_v.x * _v2.z - _v.z * _v2.x) / l; v = _v.y; }
      if (rot) { const t = u; u = v; v = t; }
      uv[j] = u * s; uv[j + 1] = v * s;
    }
  }
  // tint + baked AO (darker near y0 and on undersides)
  // plain-colour and tinted texture materials fold their colour into vertex colours on one shared base material,
  // so parts of any colour merge into the same draw call when the area is batched
  const _tc = new THREE.Color();
  function palette(m, tint) {
    const u = m.userData;
    if (!u.tintOf && !u.plainOf) return [m, tint];
    _tc.set(tint ?? 0xffffff).multiply(m.color);
    return [u.tintOf ? Tex.mat(u.tintOf[0], u.tintOf[1]) : Tex.color(0xffffff, u.plainOf), _tc];
  }
  function shade(g, tint, ao = true, y0 = 0) {
    const p = g.attributes.position.array, n = g.attributes.normal.array, c = g.attributes.color.array;
    if (tint == null) _c.setRGB(1, 1, 1); else if (tint.isColor) _c.copy(tint); else _c.set(tint);
    for (let i = 0; i < p.length; i += 3) {
      let k = 1;
      if (ao) { const y = p[i + 1] - y0, ny = n[i + 1]; k = ny > 0.6 ? 0.8 + 0.2 * ss(0, 0.25, y) : 0.5 + 0.5 * ss(0, 0.5, y); if (ny < -0.6) k *= 0.62; }
      c[i] *= _c.r * k; c[i + 1] *= _c.g * k; c[i + 2] *= _c.b * k;
    }
  }
  function xf(o, out = _m) {
    const s = o.s ?? 1;
    return out.compose(_v.set(o.x || 0, o.y || 0, o.z || 0), _q.setFromEuler(_e.set(o.rx || 0, o.ry || 0, o.rz || 0, 'YXZ')), typeof s === 'number' ? _s.setScalar(s) : _s.set(s[0], s[1], s[2]));
  }
  function place(obj, o) {
    if (o.pos) U.v3(o.pos, obj.position);
    if (o.rot) obj.rotation.set(o.rot[0], o.rot[1], o.rot[2], 'YXZ'); else if (o.yaw) obj.rotation.y = o.yaw;
    if (o.scale) typeof o.scale === 'number' ? obj.scale.setScalar(o.scale) : obj.scale.set(...o.scale);
  }
  const parentOf = o => o.parent || A.group;
  // AABB of a local box under obj's world transform -> World collider
  const _corner = new THREE.Vector3(), _min = new THREE.Vector3(), _max = new THREE.Vector3();
  function colBox(obj, x1, y1, z1, x2, y2, z2, f = {}, M = null) {
    obj.updateWorldMatrix(true, false);
    _min.set(1e9, 1e9, 1e9); _max.set(-1e9, -1e9, -1e9);
    for (let i = 0; i < 8; i++) {
      _corner.set(i & 1 ? x2 : x1, i & 2 ? y2 : y1, i & 4 ? z2 : z1);
      if (M) _corner.applyMatrix4(M);
      _corner.applyMatrix4(obj.matrixWorld); _min.min(_corner); _max.max(_corner);
    }
    const tall = _max.y - _min.y > 1.2;
    return World.addBox(_min, _max, { walk: f.walk ?? false, sight: f.sight ?? tall, cam: f.cam ?? tall, block: f.block ?? true, surface: f.surface, tag: f.tag });
  }
  function addCol(obj, o) {
    return World.addObject(obj, { surface: o.surface, walk: o.walk, sight: o.sight, cam: o.cam, block: o.block, tag: o.tag });
  }

  // shared helper textures / materials
  const radTex = () => once('rad', () => {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,255,255,0.6)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.16)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return shared(new THREE.CanvasTexture(c));
  });
  const blobMat = () => once('blobmat', () => {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 4, 32, 32, 32); gr.addColorStop(0, '#fff'); gr.addColorStop(0.55, '#8a8a8a'); gr.addColorStop(1, '#000');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const m = shared(new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: shared(new THREE.CanvasTexture(c)), transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
    m.userData.novc = true; return m;
  });
  // emissive screen material; label (texture on unit-UV planes)
  const scr = (tex, k = 1.3) => once('scr' + tex.uuid + k, () => shared(new THREE.MeshStandardMaterial({ color: 0x020203, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: k, roughness: 0.16 })));
  const lab = (tex, o = {}) => once('lab' + tex.uuid + JSON.stringify(o), () => shared(new THREE.MeshStandardMaterial({
    map: tex, roughness: o.rough ?? 0.7, metalness: o.metal ?? 0, transparent: !!o.alpha, alphaTest: o.cut ? 0.5 : 0, depthWrite: !o.alpha, side: o.side ?? THREE.FrontSide, color: o.color ?? 0xffffff,
    emissive: o.lit ? 0xffffff : 0, emissiveMap: o.lit ? tex : null, emissiveIntensity: o.lit ?? 1, polygonOffset: !!o.alpha, polygonOffsetFactor: -1, polygonOffsetUnits: -2,
  })));
  const glowMat = (hex, k = 2) => col(hex, { emissive: hex, emissiveIntensity: k, rough: 0.4 });
  const glass = (op = 0.22, tint = 0x9fb4bc) => col(tint, { rough: 0.04, metal: 0.3, transparent: true, opacity: op });

  // ---- kit: builds a prop from parts, merged per material ---------------------------------
  function kit(seed = 1) {
    const parts = new Map(), named = [], subs = [], cols = [];
    let base = null;
    const K = {
      r: U.rng(seed),
      add(geo, m, o = {}) {
        let tint; [m, tint] = palette(m, o.tint);
        const g = prep(geo); g.applyMatrix4(xf(o)); if (base) g.applyMatrix4(base);
        const uv = o.uv ?? 'proj';
        if (uv === 'proj') projUV(g, o.uvs ?? 1, o.uvRot);
        else if (Array.isArray(uv)) { const a = g.attributes.uv.array; for (let j = 0; j < a.length; j += 2) { a[j] *= uv[0]; a[j + 1] *= uv[1]; } }
        shade(g, tint, o.ao !== false && !m.userData.novc, o.aoY ?? 0);
        if (o.name) named.push([o.name, g, m]);
        else { if (!parts.has(m)) parts.set(m, []); parts.get(m).push(g); }
        return g;
      },
      box(m, w, h, d, x = 0, y = 0, z = 0, o = {}) { const g = o.r ? new RoundedBoxGeometry(w, h, d, 1, Math.min(o.r, w / 2, h / 2, d / 2)) : new THREE.BoxGeometry(w, h, d); g.translate(0, h / 2, 0); return K.add(g, m, { ...o, x, y, z }); },
      cyl(m, rt, rb, h, x = 0, y = 0, z = 0, o = {}) { const g = new THREE.CylinderGeometry(rt, rb, h, o.seg || 14, 1, !!o.open); g.translate(0, h / 2, 0); return K.add(g, m, { uv: [Math.PI * 2 * Math.max(rt, rb), h], ...o, x, y, z }); },
      sph(m, r, x = 0, y = 0, z = 0, o = {}) { const n = o.seg || 12; return K.add(new THREE.SphereGeometry(r, n, Math.max(4, n * 0.6 | 0)), m, { uv: [Math.PI * 2 * r, Math.PI * r], ...o, x, y, z }); },
      lathe(m, pts, x = 0, y = 0, z = 0, o = {}) { const g = new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), o.seg || 16); return K.add(g, m, { uv: [Math.PI * 2 * Math.max(...pts.map(p => p[0])), Math.abs(pts[pts.length - 1][1] - pts[0][1]) || 1], ...o, x, y, z }); },
      plane(m, w, h, x = 0, y = 0, z = 0, o = {}) { return K.add(new THREE.PlaneGeometry(w, h, o.sx || 1, o.sy || 1), m, { uv: 'unit', ao: false, ...o, x, y, z }); },
      tube(m, pts, r, o = {}) { const c = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], p[2]))); return K.add(new THREE.TubeGeometry(c, o.seg || Math.max(6, pts.length * 5), r, o.rs || 6, false), m, { uv: [c.getLength(), Math.PI * 2 * r], ...o }); },
      shape(m, shp, depth, o = {}) { const g = new THREE.ExtrudeGeometry(shp, { depth, bevelEnabled: !!o.bevel, bevelThickness: o.bevel || 0, bevelSize: o.bevel || 0, bevelSegments: 2, curveSegments: o.curve || 8, steps: o.steps || 1 }); g.translate(0, 0, -depth / 2); return K.add(g, m, o); },
      geo(m, g, o = {}) { return K.add(g, m, o); },
      // compose: build part of the prop in a sub-frame (x,y,z, yaw)
      at(x, y, z, ry, fn, rx = 0) {
        const prev = base, mm = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry || 0, 0, 'YXZ')), new THREE.Vector3(1, 1, 1));
        base = prev ? prev.clone().multiply(mm) : mm; fn(K); base = prev;
      },
      col(x1, y1, z1, x2, y2, z2, f = {}) { cols.push([x1, y1, z1, x2, y2, z2, f, base && base.clone()]); },
      sub(name, o = {}) { const k = kit(seed * 31 + subs.length + 7); subs.push([name, k, o]); return k; },
      blob(w, d, x = 0, z = 0) { K.add(new THREE.PlaneGeometry(w, d), blobMat(), { uv: 'unit', rx: -Math.PI / 2, x, y: 0.006, z, ao: false }); },
      get parts() { return parts; }, named, subs, cols,
    };
    return K;
  }
  function mkMesh(g, m, batch, o) {
    const me = new THREE.Mesh(g, Tex.vc(m));
    me.castShadow = o.shadow ?? (!m.transparent && !m.userData.noshadow); me.receiveShadow = !m.userData.novc;
    me.userData.batch = batch; return me;
  }
  function finish(K, grp, o = {}) {
    const dyn = !!o.dynamic;
    for (const [m, gs] of K.parts) grp.add(mkMesh(gs.length > 1 ? mergeGeometries(gs) : gs[0], m, !dyn, o));
    for (const [m, gs] of K.parts) if (gs.length > 1) for (const g of gs) g.dispose();
    const byName = new Map();
    for (const [name, g, m] of K.named) { const k = name + '|' + m.uuid; if (!byName.has(k)) byName.set(k, [name, m, []]); byName.get(k)[2].push(g); }
    for (const [name, m, gs] of byName.values()) {
      const me = mkMesh(gs.length > 1 ? mergeGeometries(gs) : gs[0], m, false, o); grp.add(me);
      const cur = grp.userData[name]; grp.userData[name] = cur ? [].concat(cur, me) : me;
    }
    for (const [name, k, so] of K.subs) {
      const sg = new THREE.Group(); sg.position.set(so.x || 0, so.y || 0, so.z || 0); sg.rotation.set(so.rx || 0, so.ry || 0, so.rz || 0, 'YXZ');
      grp.add(sg); finish(k, sg, { ...o, dynamic: true }); grp.userData[name] = sg; if (so.visible === false) sg.visible = false;
    }
  }
  function kitCols(K, grp, def, o) {
    if ((o.solid ?? def.solid ?? true) === false) return [];
    grp.updateWorldMatrix(true, false);
    if (K.cols.length) return K.cols.map(c => colBox(grp, c[0], c[1], c[2], c[3], c[4], c[5], c[6], c[7]));
    const bb = new THREE.Box3();
    for (const [m, gs] of K.parts) if (m !== blobMat()) for (const g of gs) { g.computeBoundingBox(); bb.union(g.boundingBox); }
    if (bb.isEmpty()) return [];
    return [colBox(grp, bb.min.x, bb.min.y, bb.min.z, bb.max.x, bb.max.y, bb.max.z, def.col || {})];
  }

  // ---- primitives ------------------------------------------------------------------------
  function group(o = {}) { const g = new THREE.Group(); place(g, o); parentOf(o).add(g); return g; }
  function mesh(geo, m, o = {}) {
    const me = new THREE.Mesh(geo, m); place(me, o);
    me.castShadow = o.shadow ?? true; me.receiveShadow = o.receive ?? true;
    parentOf(o).add(me);
    if (o.solid) addCol(me, o);
    return me;
  }
  const relM = new THREE.Matrix4(), invA = new THREE.Matrix4();
  function areaMatrix(obj) { obj.updateWorldMatrix(true, false); A.group.updateWorldMatrix(true, false); return relM.copy(invA.copy(A.group.matrixWorld).invert()).multiply(obj.matrixWorld); }
  function box(w, h, d, m, o = {}) {
    let tint; [m, tint] = palette(m, o.tint);
    const g = prep(o.bevel ? new RoundedBoxGeometry(w, h, d, 1, Math.min(o.bevel, w / 2, h / 2, d / 2)) : new THREE.BoxGeometry(w, h, d)); g.translate(0, h / 2, 0);
    const me = new THREE.Mesh(g, m); place(me, o); parentOf(o).add(me);
    projUV(g, 1, o.uvRot, areaMatrix(me));
    shade(g, tint, o.ao ?? h > 0.3);
    me.material = Tex.vc(m); me.castShadow = o.shadow ?? !m.transparent; me.receiveShadow = true; me.userData.batch = !o.dynamic;
    if (o.solid !== false) addCol(me, o);
    return me;
  }
  function plane(w, d, m, o = {}) {
    const g = prep(new THREE.PlaneGeometry(w, d)); g.rotateX(-Math.PI / 2);
    const me = new THREE.Mesh(g, m); place(me, o); parentOf(o).add(me);
    if (o.uv !== 'unit') projUV(g, 1, false, areaMatrix(me));
    me.material = Tex.vc(m); me.castShadow = false; me.receiveShadow = true; me.userData.batch = !o.dynamic;
    return me;
  }
  function floor(x1, z1, x2, z2, m, o = {}) {
    const t = o.thick ?? 0.1, y = o.y ?? 0;
    const me = box(Math.abs(x2 - x1), t, Math.abs(z2 - z1), m, { pos: [(x1 + x2) / 2, y - t, (z1 + z2) / 2], ao: false, surface: o.surface, walk: true, sight: false, cam: true, parent: o.parent, dynamic: o.dynamic });
    if (o.surface) A.surface(x1, z1, x2, z2, o.surface);
    return me;
  }
  const TRIM = () => col(0xe9e5dc, { rough: 0.55 });
  function wall(x1, z1, x2, z2, h, m, o = {}) {
    const dx = x2 - x1, dz = z2 - z1, L = Math.hypot(dx, dz), t = o.thick ?? 0.15;
    const g = group({ pos: [x1, o.y || 0, z1], yaw: Math.atan2(-dz, dx), parent: o.parent });
    const trim = o.trim === false ? null : o.trim || TRIM(), back = o.back || m;
    const ops = [...(o.doors || []).map(p => ({ at: p.at, w: p.w ?? 0.9, y0: 0, y1: p.h ?? 2.1, door: true })),
      ...(o.windows || []).map(p => ({ at: p.at, w: p.w ?? 1.2, y0: p.sill ?? 0.9, y1: (p.sill ?? 0.9) + (p.h ?? 1.2) }))].sort((a, b) => a.at - b.at);
    const seg = (u0, u1, y0, y1) => {
      if (u1 - u0 < 0.004 || y1 - y0 < 0.004) return;
      if (back === m) box(u1 - u0, y1 - y0, t, m, { parent: g, pos: [(u0 + u1) / 2, y0, 0], ao: y0 < 0.1 && y1 - y0 > 0.3, dynamic: o.dynamic });
      else {
        box(u1 - u0, y1 - y0, t / 2, m, { parent: g, pos: [(u0 + u1) / 2, y0, t / 4], ao: y0 < 0.1 && y1 - y0 > 0.3, dynamic: o.dynamic });
        box(u1 - u0, y1 - y0, t / 2, back, { parent: g, pos: [(u0 + u1) / 2, y0, -t / 4], ao: y0 < 0.1 && y1 - y0 > 0.3, dynamic: o.dynamic });
      }
    };
    const skirt = (u0, u1) => { if (o.skirting && u1 - u0 > 0.01) box(u1 - u0, 0.09, 0.014, o.skirting, { parent: g, pos: [(u0 + u1) / 2, 0, t / 2 + 0.007], solid: false, ao: false, shadow: false }); };
    let u = 0;
    for (const p of ops) {
      const a = p.at - p.w / 2, b = p.at + p.w / 2;
      seg(u, a, 0, h); seg(a, b, 0, p.y0); seg(a, b, p.y1, h); skirt(u, a); if (!p.door) skirt(a, b);
      if (!p.door) colBox(g, a, p.y0, -t / 2, b, p.y1, t / 2, { sight: false, cam: false });
      if (trim) for (const s of [1, -1]) {
        const z = s * (t / 2 + 0.01);
        box(0.07, p.y1 - p.y0 + 0.07, 0.02, trim, { parent: g, pos: [a - 0.035, p.y0, z], solid: false, ao: false, shadow: false });
        box(0.07, p.y1 - p.y0 + 0.07, 0.02, trim, { parent: g, pos: [b + 0.035, p.y0, z], solid: false, ao: false, shadow: false });
        box(p.w + 0.14, 0.07, 0.02, trim, { parent: g, pos: [p.at, p.y1, z], solid: false, ao: false, shadow: false });
        if (!p.door) box(p.w + 0.1, 0.03, 0.05, trim, { parent: g, pos: [p.at, p.y0 - 0.03, s * (t / 2 + 0.025)], solid: false, ao: false, shadow: false });
      }
      if (trim) { box(0.02, p.y1 - p.y0, t, trim, { parent: g, pos: [a + 0.01, p.y0, 0], solid: false, ao: false }); box(0.02, p.y1 - p.y0, t, trim, { parent: g, pos: [b - 0.01, p.y0, 0], solid: false, ao: false }); box(p.w, 0.02, t, trim, { parent: g, pos: [p.at, p.y1 - 0.02, 0], solid: false, ao: false }); }
      u = b;
    }
    seg(u, L, 0, h); skirt(u, L);
    return g;
  }
  function room(o) {
    const w = o.w ?? 4, d = o.d ?? 4, h = o.h ?? 2.7, t = o.thick ?? 0.15, e = t / 2;
    const g = group({ pos: [o.x || 0, o.y || 0, o.z || 0], yaw: o.yaw, parent: o.parent });
    const inner = o.wall || mat('plaster'), outer = o.outside || inner;
    const S = { n: [-w / 2 - e, -d / 2, w / 2 + e, -d / 2, v => v + w / 2 + e], e: [w / 2, -d / 2, w / 2, d / 2, v => v + d / 2], s: [w / 2 + e, d / 2, -w / 2 - e, d / 2, v => w / 2 + e - v], w: [-w / 2, d / 2, -w / 2, -d / 2, v => d / 2 - v] };
    g.userData.walls = {};
    for (const k of 'nesw') {
      const [a, b, c, dd, f] = S[k], pick = arr => (arr || []).filter(p => (p.side || 'n') === k).map(p => ({ ...p, at: f(p.at || 0) }));
      if ((o.omit || '').includes(k)) continue;
      g.userData.walls[k] = wall(a, b, c, dd, h, inner, { parent: g, thick: t, back: outer, doors: pick(o.doors), windows: pick(o.windows), trim: o.trim, skirting: o.skirting === false ? null : o.skirting || TRIM(), dynamic: o.dynamic });
    }
    if (o.floor !== false) box(w, 0.1, d, o.floor || mat('floorboards'), { parent: g, pos: [0, -0.094, 0], ao: false, walk: true, sight: false, surface: o.surface, dynamic: o.dynamic });
    if (o.ceil !== false) box(w + 2 * t, 0.1, d + 2 * t, o.ceil || mat('plaster'), { parent: g, pos: [0, h, 0], ao: false, walk: false, block: false, dynamic: o.dynamic });
    if (o.surface) { const x = o.x || 0, z = o.z || 0, rw = Math.abs(Math.cos(o.yaw || 0)) > 0.7 ? [w, d] : [d, w]; A.surface(x - rw[0] / 2, z - rw[1] / 2, x + rw[0] / 2, z + rw[1] / 2, o.surface); }
    return g;
  }
  // pitched roof over a w x d footprint: hip (4 slopes) or gable (2 slopes + gable walls), fascia, gutters, soffit, ridge cap
  function roof(o = {}) {
    const w = o.w ?? 8, d = o.d ?? 6, pitch = o.pitch ?? 0.4, ov = o.overhang ?? 0.45, hip = (o.kind || 'hip') === 'hip';
    const swap = d > w, g = group({ pos: [o.x || 0, o.y ?? 2.7, o.z || 0], yaw: (o.yaw || 0) + (swap ? Math.PI / 2 : 0), parent: o.parent });
    const L = (swap ? d : w) / 2 + ov, S = (swap ? w : d) / 2 + ov, rise = Math.tan(pitch) * S, hi = hip ? S : 0;
    const V = (x, y, z) => new THREE.Vector3(x, y, z), E = [V(-L, 0, -S), V(L, 0, -S), V(L, 0, S), V(-L, 0, S)], R = [V(-L + hi, rise, 0), V(L - hi, rise, 0)];
    const K = kit(17), rm = o.mat || mat('roof_tiles'), fm = o.fascia || col(0xe8e4da, { rough: 0.6 });
    const face = (pts, m) => {
      const n = new THREE.Vector3().subVectors(pts[1], pts[0]).cross(new THREE.Vector3().subVectors(pts[2], pts[0])).normalize();
      const c = pts.reduce((a, p) => a.add(p), V(0, 0, 0)).divideScalar(pts.length);
      if (n.dot(c.clone().sub(V(0, rise * 0.3, 0))) < 0) { pts = pts.slice().reverse(); n.negate(); }
      const ed = new THREE.Vector3().subVectors(pts[1], pts[0]).normalize(), up = new THREE.Vector3().crossVectors(n, ed).normalize(), P = [], UV = [];
      for (let i = 1; i < pts.length - 1; i++) for (const p of [pts[0], pts[i], pts[i + 1]]) { P.push(p.x, p.y, p.z); UV.push(p.dot(ed), p.dot(up)); }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); geo.computeVertexNormals();
      K.add(geo, m, { uv: 'unit', ao: false });
    };
    face([E[3], E[2], R[1], R[0]], rm); face([E[1], E[0], R[0], R[1]], rm);
    if (hip) { face([E[0], E[3], R[0]], rm); face([E[2], E[1], R[1]], rm); }
    else for (const s of [-1, 1]) face([V(s * (L - ov), 0, -S + ov), V(s * (L - ov), 0, S - ov), V(s * (L - ov), rise * (1 - ov / S), 0)], o.gable || o.wall || mat('weatherboard'));
    K.box(o.soffit || col(0xf0ece4, { rough: 0.8 }), L * 2, 0.02, S * 2, 0, -0.02, 0, { ao: false });
    for (const s of [-1, 1]) { K.box(fm, L * 2, 0.2, 0.03, 0, -0.18, s * S); K.box(o.gutter || col(0xd8d4c8, { rough: 0.5, metal: 0.4 }), L * 2, 0.1, 0.1, 0, -0.15, s * (S + 0.06)); if (hip) K.box(fm, 0.03, 0.2, S * 2, s * L, -0.18, 0); }
    if (R[1].x - R[0].x > 0.05) K.box(o.ridge || mat('roof_tiles', { color: 0xc8b0a0 }), R[1].x - R[0].x + 0.1, 0.12, 0.26, 0, rise - 0.05, 0, { r: 0.05, ao: false });
    finish(K, g, o);
    colBox(g, -L, 0, -S, L, rise, S, { sight: true, cam: true, block: false });
    return g;
  }
  function stairs(o) {
    const f = U.v3(o.from), t = U.v3(o.to), dy = t.y - f.y, n = Math.max(1, Math.ceil(dy / 0.18)), rise = dy / n;
    const run = Math.hypot(t.x - f.x, t.z - f.z) / n, w = o.width ?? 1.1, m = o.mat || mat('concrete');
    const g = group({ pos: [f.x, f.y, f.z], yaw: Math.atan2(t.x - f.x, t.z - f.z), parent: o.parent });
    for (let i = 0; i < n; i++) box(w, rise * (i + 1), run, m, { parent: g, pos: [0, 0, run * (i + 0.5)], walk: true, sight: false, cam: false, ao: false, dynamic: o.dynamic });
    if (o.rail) for (const s of [-1, 1]) {
      const K = kit(3), L = run * n, rm = col(0x2a2c2e, { rough: 0.5, metal: 0.6 });
      for (let i = 0; i <= n; i += 3) K.cyl(rm, 0.02, 0.02, 0.95, s * (w / 2 - 0.05), rise * Math.min(i, n), run * Math.min(i, n - 0.5));
      K.tube(rm, [[s * (w / 2 - 0.05), 0.95, 0], [s * (w / 2 - 0.05), dy + 0.95, L]], 0.025);
      const rg = group({ parent: g }); finish(K, rg, o);
    }
    return g;
  }
  function ramp(o) {
    const f = U.v3(o.from), t = U.v3(o.to), dy = t.y - f.y, len = Math.hypot(t.x - f.x, t.z - f.z), w = o.width ?? 1.2;
    const g = group({ pos: [f.x, f.y, f.z], yaw: Math.atan2(t.x - f.x, t.z - f.z), parent: o.parent });
    const L = Math.hypot(dy, len), geo = prep(new THREE.BoxGeometry(w, 0.12, L));
    const me = new THREE.Mesh(geo, o.mat || mat('concrete')); me.position.set(0, dy / 2 - 0.06, len / 2); me.rotation.x = -Math.atan2(dy, len); g.add(me);
    projUV(geo, 1, false, areaMatrix(me)); shade(geo, null, false); me.material = Tex.vc(me.material); me.castShadow = me.receiveShadow = true; me.userData.batch = !o.dynamic;
    const n = Math.max(1, Math.ceil(dy / 0.08));
    for (let i = 0; i < n; i++) colBox(g, -w / 2, -0.1, len * i / n, w / 2, dy * (i + 1) / n, len * (i + 1) / n, { walk: true, sight: false, cam: false });
    return me;
  }

  // ---- lights --------------------------------------------------------------------------
  function sun(o = {}) {
    const l = new THREE.DirectionalLight(o.color ?? 0xffffff, o.intensity ?? 2);
    const d = U.v3(o.dir || [-0.5, -1, -0.3]).normalize(), t = U.v3(o.target || [0, 0, 0]);
    l.position.copy(t).addScaledVector(d, -60); l.target.position.copy(t);
    l.castShadow = true; const s = o.area ?? 30;
    Object.assign(l.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: o.far ?? 150 });
    l.shadow.mapSize.set(Engine.shadowMapSize, Engine.shadowMapSize); l.shadow.bias = -0.0004; l.shadow.normalBias = 0.03;
    A.group.add(l, l.target); return l;
  }
  const flickerN = (t, s) => 0.55 + 0.22 * Math.sin(t * 13.1 + s) + 0.14 * Math.sin(t * 23.7 + s * 1.3) + 0.09 * Math.sin(t * 41.3 + s * 2.1);
  function light(type, o = {}) {
    const l = type === 'spot' ? new THREE.SpotLight(o.color ?? 0xffffff, o.intensity ?? 10, o.distance ?? 20, o.angle ?? 0.6, o.penumbra ?? 0.5, o.decay ?? 2)
      : new THREE.PointLight(o.color ?? 0xffffff, o.intensity ?? 5, o.distance ?? 12, o.decay ?? 2);
    if (o.pos) U.v3(o.pos, l.position);
    if (type === 'spot') {
      U.v3(o.target || [l.position.x, 0, l.position.z], l.target.position); (o.parent || A.group).add(l.target);
      if (o.shadow) { l.castShadow = true; l.shadow.mapSize.set(1024, 1024); l.shadow.bias = -0.0006; l.shadow.normalBias = 0.02; l.shadow.camera.near = 0.3; }
    }
    (o.parent || A.group).add(l);
    if (o.flicker) { const base = l.intensity, s = U.hash(String(l.position.x + l.position.z)) % 100; A.update((dt, t) => { l.intensity = base * (1 - o.flicker + o.flicker * flickerN(t, s) * 1.1); }); }
    return l;
  }
  function hemi(o = {}) { const l = new THREE.HemisphereLight(o.sky ?? 0x8899aa, o.ground ?? 0x332211, o.intensity ?? 0.6); A.group.add(l); return l; }
  function glow(o = {}) {
    const m = once('glow' + (o.color ?? 0xffffff) + (o.opacity ?? 1), () => shared(new THREE.SpriteMaterial({ map: radTex(), color: o.color ?? 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: o.opacity ?? 1 })));
    const s = new THREE.Sprite(m); place(s, o); s.scale.setScalar(o.size ?? 1); parentOf(o).add(s); if (o.dynamic) s.userData.dynamic = true; return s;
  }
  function pool(o = {}) {
    const m = once('pool' + (o.color ?? 0xffb060) + (o.opacity ?? 0.5), () => shared(new THREE.MeshBasicMaterial({ map: radTex(), color: o.color ?? 0xffb060, transparent: true, opacity: o.opacity ?? 0.5, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 })));
    m.userData.novc = true;
    const r = o.r ?? 3, me = plane(r * 2, r * 2, m, { uv: 'unit', pos: U.v3(o.pos || [0, 0, 0]).clone().add(_v.set(0, 0.012, 0)), parent: o.parent, dynamic: o.dynamic });
    return me;
  }

  // ---- FX shaders -------------------------------------------------------------------------
  const FOGV = '\n#include <fog_pars_vertex>\n', FOGF = '\n#include <fog_pars_fragment>\n';
  const FOGA = `
  #ifdef USE_FOG
    #ifdef FOG_EXP2
      float fogF = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
    #else
      float fogF = smoothstep(fogNear, fogFar, vFogDepth);
    #endif
    gl_FragColor.rgb *= 1.0 - fogF;
  #endif
  `;
  function fxMat(key, vert, frag, uni = {}, o = {}) {
    return once('fx' + key, () => shared(new THREE.ShaderMaterial({
      uniforms: Object.assign(THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uni), vertexShader: vert, fragmentShader: frag, fog: true,
      transparent: true, depthWrite: false, blending: o.blending ?? THREE.AdditiveBlending, side: o.side ?? THREE.FrontSide,
    })));
  }
  const noiseTex = () => { const t = Tex.get('noise'); return t; };
  // camera-facing quads: position = centre, aC = corner, aS = (seed, size, kind)
  function quads(list) {
    const n = list.length, P = new Float32Array(n * 12), Cn = new Float32Array(n * 8), S = new Float32Array(n * 12), I = [];
    list.forEach((q, k) => {
      const c = [[-1, 0], [1, 0], [1, 1], [-1, 1]];
      for (let j = 0; j < 4; j++) { P.set(q.p, (k * 4 + j) * 3); Cn.set(c[j], (k * 4 + j) * 2); S.set([q.seed, q.size, q.kind], (k * 4 + j) * 3); }
      I.push(k * 4, k * 4 + 1, k * 4 + 2, k * 4, k * 4 + 2, k * 4 + 3);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('aC', new THREE.BufferAttribute(Cn, 2)); g.setAttribute('aS', new THREE.BufferAttribute(S, 3)); g.setIndex(I);
    return g;
  }
  const fireMat = () => fxMat('fire', `uniform float uT; attribute vec2 aC; attribute vec3 aS; varying vec2 vUv; varying vec3 vS; varying float vL; ${FOGV}
    void main(){
      vec3 p = position; float seed = aS.x, size = aS.y, kind = aS.z; vL = 0.0; vec2 c = aC;
      if (kind > 0.5 && kind < 1.5) { vL = fract(uT * (0.3 + seed * 0.35) + seed * 7.0); p += vec3(sin(seed * 40.0 + uT * 2.0) * 0.35 * vL, vL * size * 9.0, cos(seed * 23.0 + uT * 1.7) * 0.35 * vL) * size; c.y -= 0.5; size *= 0.035; }
      else if (kind > 1.5) { c.y -= 0.5; size *= 2.2 + 0.15 * sin(uT * 9.0 + seed); }
      else { size *= 0.9 + 0.2 * sin(uT * 6.0 + seed * 9.0); }
      vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
      float sc = length(modelMatrix[0].xyz);
      mvPosition.xy += vec2(c.x * 0.45, c.y) * size * sc;
      vUv = vec2(aC.x * 0.5 + 0.5, aC.y); vS = aS;
      gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }`, `uniform float uT; uniform sampler2D tN; varying vec2 vUv; varying vec3 vS; varying float vL; ${FOGF}
    void main(){
      float kind = vS.z, seed = vS.x;
      if (kind > 1.5) { float d = length(vUv - vec2(0.5)) * 2.0; gl_FragColor = vec4(vec3(1.0, 0.36, 0.08) * pow(max(0.0, 1.0 - d), 2.2) * 0.12, 1.0); ${FOGA} return; }
      if (kind > 0.5) { float d = length(vUv - vec2(0.5)) * 2.0; gl_FragColor = vec4(vec3(1.0, 0.55, 0.2) * max(0.0, 1.0 - d) * (1.0 - vL) * 3.0, 1.0); ${FOGA} return; }
      float n = texture2D(tN, vec2(vUv.x * 0.7 + seed * 3.1, vUv.y * 0.55 - uT * 1.25 + seed)).r;
      float n2 = texture2D(tN, vec2(vUv.x * 1.4 - seed, vUv.y * 1.1 - uT * 2.3)).r;
      float x = (vUv.x - 0.5) * 2.0 + (n - 0.5) * 1.1 * vUv.y;
      float wid = pow(max(0.0, 1.0 - vUv.y), 0.9) * 0.75 + 0.03;
      float i = (1.0 - smoothstep(0.1, 1.0, abs(x) / wid)) * (1.0 - smoothstep(0.2, 0.95, vUv.y + (n2 - 0.5) * 0.7)) * smoothstep(0.0, 0.1, vUv.y);
      i = clamp(i * 1.35, 0.0, 1.0);
      vec3 c = mix(vec3(0.45, 0.03, 0.0), vec3(1.0, 0.3, 0.02), smoothstep(0.08, 0.5, i));
      c = mix(c, vec3(1.0, 0.72, 0.28), smoothstep(0.7, 1.0, i));
      gl_FragColor = vec4(c * i * i * 1.25, 1.0);
      ${FOGA}
    }`, { uT: T, tN: { value: noiseTex() } });
  const smokeMat = () => fxMat('smoke', `uniform float uT; attribute vec2 aC; attribute vec3 aS; varying vec2 vUv; varying float vA; varying float vSeed; varying float vAge; ${FOGV}
    void main(){
      float seed = aS.x, size = aS.y, rate = aS.z, age = fract(uT * rate + seed * 13.7);
      vec3 p = position + vec3(sin(seed * 31.0) * 0.35 + age * age * 2.2 + sin(uT * 0.3 + seed * 9.0) * 0.3 * age, age * 5.5, cos(seed * 17.0) * 0.35 + age * 0.6) * size;
      vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
      float s = size * (0.35 + age * 2.2) * length(modelMatrix[0].xyz);
      float a = uT * 0.2 + seed * 6.0; vec2 c = vec2(aC.x, aC.y * 2.0 - 1.0); c = mat2(cos(a), -sin(a), sin(a), cos(a)) * c;
      mvPosition.xy += c * s;
      vUv = vec2(aC.x * 0.5 + 0.5, aC.y); vA = smoothstep(0.0, 0.12, age) * (1.0 - age); vSeed = seed + age * 0.001; vAge = age;
      gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }`, `uniform sampler2D tN; uniform vec3 uC; uniform float uO; uniform float uLit; varying vec2 vUv; varying float vA; varying float vSeed; varying float vAge; ${FOGF}
    void main(){
      float d = length(vUv - vec2(0.5)) * 2.0; float n = texture2D(tN, vUv * 0.6 + vSeed).r;
      float a = smoothstep(1.0, 0.2, d + (n - 0.5) * 0.8) * vA * uO;
      gl_FragColor = vec4(mix(vec3(0.34, 0.13, 0.04) * uLit + uC, uC, smoothstep(0.0, 0.3, vAge)), a);
      #include <fog_fragment>
    }`, { uT: T, tN: { value: noiseTex() }, uC: { value: new THREE.Color(0x1a1714) }, uO: { value: 0.38 }, uLit: { value: 0 } }, { blending: THREE.NormalBlending });
  function fire(o = {}) {
    const g = group(o), size = o.size ?? 1, r = U.rng(o.seed ?? U.hash(JSON.stringify(o.pos || 0))), list = [];
    for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283 + r(), d = i ? (0.15 + r() * 0.2) * size : 0; list.push({ p: [Math.cos(a) * d, 0, Math.sin(a) * d], seed: r(), size: size * (i ? 0.55 + r() * 0.5 : 1.05), kind: 0 }); }
    list.push({ p: [0, 0.4 * size, 0], seed: r(), size, kind: 2 });
    if (o.embers !== false) for (let i = 0; i < 22; i++) list.push({ p: [(r() - 0.5) * 0.6 * size, 0.2 * size, (r() - 0.5) * 0.6 * size], seed: r(), size, kind: 1 });
    const me = new THREE.Mesh(quads(list), fireMat()); me.frustumCulled = false; me.renderOrder = 5; g.add(me);
    if (o.smoke !== false) smoke({ pos: [0, size * 0.9, 0], size: size * 0.9, parent: g, lit: 1 });
    if (o.light !== false) g.userData.light = light('point', { pos: [0, size * 0.7, 0], color: 0xff7a2a, intensity: 8 * size * (o.light === true || o.light == null ? 1 : o.light), distance: 10 * size + 4, flicker: 0.5, parent: g });
    return g;
  }
  function smoke(o = {}) {
    const size = o.size ?? 1, r = U.rng(o.seed ?? 5), list = [];
    const n = o.count ?? 22;
    for (let i = 0; i < n; i++) list.push({ p: [(r() - 0.5) * 0.4 * size, 0, (r() - 0.5) * 0.4 * size], seed: i / n + r() * 0.03, size, kind: o.rate ?? 0.1 });
    const m = o.color || o.lit ? once('smoke' + o.color + o.lit, () => { const b = smokeMat(), x = b.clone(); if (o.color) x.uniforms.uC.value.set(o.color); x.uniforms.uLit.value = o.lit || 0; x.uniforms.uT = T; x.uniforms.tN = b.uniforms.tN; x.userData.shared = true; return x; }) : smokeMat();
    const me = new THREE.Mesh(quads(list), m); place(me, o); me.frustumCulled = false; me.renderOrder = 4; parentOf(o).add(me);
    return me;
  }
  const rayMat = () => fxMat('ray', `uniform float uT; varying vec2 vUv; varying float vF; ${FOGV}
    void main(){
      vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vec3 n = normalize(normalMatrix * normal); vF = abs(dot(n, normalize(-mvPosition.xyz))) * smoothstep(0.6, 3.0, -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }`, `uniform float uT; uniform sampler2D tN; uniform vec3 uC; uniform float uO; varying vec2 vUv; varying float vF; ${FOGF}
    void main(){
      float edge = pow(sin(vUv.x * 3.14159), 2.0), along = pow(1.0 - vUv.y, 1.3) * smoothstep(0.0, 0.08, vUv.y);
      float st = texture2D(tN, vec2(vUv.x * 1.5 + uT * 0.01, vUv.y * 0.12)).r;
      float a = edge * along * (0.45 + st * 0.9) * smoothstep(0.08, 0.6, vF) * uO;
      gl_FragColor = vec4(uC * a, 1.0);
      ${FOGA}
    }`, { uT: T, tN: { value: noiseTex() }, uC: { value: new THREE.Color(1, 1, 1) }, uO: { value: 1 } }, { side: THREE.DoubleSide });
  function tintedFx(base, key, c, op) {
    return once(key + c + op, () => { const m = base.clone(); m.uniforms.uT = T; m.uniforms.tN = base.uniforms.tN; m.uniforms.uC.value = new THREE.Color(c); m.uniforms.uO.value = op; m.userData.shared = true; return m; });
  }
  function godray(o = {}) {
    const w = o.w ?? 1.5, h = o.h ?? 6, dir = U.v3(o.dir || [0.3, -1, 0.2]).normalize();
    const g = group({ pos: o.pos, parent: o.parent });
    g.quaternion.setFromUnitVectors(_v.set(0, -1, 0), dir);
    const geos = [0, 1, 2].map(i => { const p = new THREE.PlaneGeometry(w, h); p.translate(0, -h / 2, 0); p.rotateY(i * Math.PI / 3); const uv = p.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setY(k, 1 - uv.getY(k)); return p; });
    const me = new THREE.Mesh(mergeGeometries(geos), tintedFx(rayMat(), 'ray', o.color ?? 0xfff0d0, o.opacity ?? 0.35)); me.renderOrder = 6; g.add(me);
    return g;
  }
  const beamMatBase = () => fxMat('beam', `varying float vF; varying float vY; uniform float uLen; ${FOGV}
    void main(){
      vY = clamp(-position.y / uLen, 0.0, 1.0); vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vec3 n = normalize(normalMatrix * normal); vF = pow(abs(dot(n, normalize(-mvPosition.xyz))), 1.6) * smoothstep(0.3, 2.5, -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }`, `uniform vec3 uC; uniform float uO; varying float vF; varying float vY; ${FOGF}
    void main(){ gl_FragColor = vec4(uC * vF * pow(1.0 - vY, 1.6) * uO, 1.0); ${FOGA} }`, { uC: { value: new THREE.Color(1, 1, 1) }, uO: { value: 1 }, uLen: { value: 1 } }, { side: THREE.DoubleSide });
  function beam(o = {}) {
    const len = o.len ?? 6, r = o.r ?? 1.5, dir = U.v3(o.dir || [0, -1, 0]).normalize();
    const geo = new THREE.CylinderGeometry(0.06, r, len, 20, 1, true); geo.translate(0, -len / 2, 0);
    const m = once('beam' + (o.color ?? 0xffe0b0) + (o.opacity ?? 0.15) + len, () => { const x = beamMatBase().clone(); x.uniforms.uC.value = new THREE.Color(o.color ?? 0xffe0b0); x.uniforms.uO.value = o.opacity ?? 0.15; x.uniforms.uLen.value = len; x.userData.shared = true; return x; });
    const me = new THREE.Mesh(geo, m); U.v3(o.pos || [0, 0, 0], me.position); me.quaternion.setFromUnitVectors(_v.set(0, -1, 0), dir); me.renderOrder = 6;
    parentOf(o).add(me); return me;
  }
  const dustMat = () => fxMat('dust', `uniform float uT; uniform float uSize; attribute vec3 aS; varying float vA; ${FOGV}
    void main(){
      vec3 p = position + vec3(sin(uT * 0.21 + aS.x * 6.28), sin(uT * 0.13 + aS.y * 6.28) * 0.6, cos(uT * 0.17 + aS.z * 6.28)) * 0.18;
      vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
      gl_PointSize = uSize * (0.6 + aS.x) * 300.0 / -mvPosition.z; vA = 0.5 + 0.5 * sin(uT * (0.5 + aS.y) + aS.z * 20.0);
      gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }`, `uniform vec3 uC; uniform float uO; varying float vA; ${FOGF}
    void main(){ float d = length(gl_PointCoord - vec2(0.5)) * 2.0; gl_FragColor = vec4(uC * smoothstep(1.0, 0.0, d) * vA * uO, 1.0); ${FOGA} }`, { uT: T, uSize: { value: 0.02 }, uC: { value: new THREE.Color(1, 0.95, 0.85) }, uO: { value: 0.6 } });
  function dust(o = {}) {
    const [x1, y1, z1, x2, y2, z2] = o.box || [-3, 0, -3, 3, 3, 3], n = o.count ?? 300, r = U.rng(o.seed ?? 3);
    const P = new Float32Array(n * 3), S = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { P.set([x1 + r() * (x2 - x1), y1 + r() * (y2 - y1), z1 + r() * (z2 - z1)], i * 3); S.set([r(), r(), r()], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('aS', new THREE.BufferAttribute(S, 3));
    const m = once('dust' + (o.color ?? 0) + (o.opacity ?? 0.6) + (o.size ?? 0.02), () => { const x = dustMat().clone(); x.uniforms.uT = T; if (o.color != null) x.uniforms.uC.value = new THREE.Color(o.color); x.uniforms.uO.value = o.opacity ?? 0.6; x.uniforms.uSize.value = o.size ?? 0.02; x.userData.shared = true; return x; });
    const p = new THREE.Points(g, m); p.frustumCulled = false; parentOf(o).add(p); return p;
  }
  function rain(o = {}) {
    const n = o.count ?? 4000, r = U.rng(9), P = new Float32Array(n * 6), E = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { const a = [r(), r(), r()]; P.set(a, i * 6); P.set(a, i * 6 + 3); E[i * 2 + 1] = 1; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('aE', new THREE.BufferAttribute(E, 1));
    const m = once('rain', () => shared(new THREE.ShaderMaterial({
      uniforms: Object.assign(THREE.UniformsUtils.clone(THREE.UniformsLib.fog), { uT: T, uSize: { value: 36 }, uH: { value: 18 }, uSpeed: { value: 11 }, uC: { value: new THREE.Color(0x9fb0c0) } }),
      vertexShader: `uniform float uT, uSize, uH, uSpeed; attribute float aE; varying float vA; ${FOGV}
        void main(){
          vec3 s = position; vec3 p;
          p.x = cameraPosition.x + (fract(s.x - cameraPosition.x / uSize) - 0.5) * uSize;
          p.z = cameraPosition.z + (fract(s.z - cameraPosition.z / uSize) - 0.5) * uSize;
          p.y = cameraPosition.y - uH * 0.35 + (1.0 - fract(s.y + uT * uSpeed / uH)) * uH;
          p += vec3(0.08, -0.55, 0.03) * aE;
          vec4 mvPosition = viewMatrix * vec4(p, 1.0); vA = (1.0 - aE * 0.7) * smoothstep(0.5, 3.0, -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `uniform vec3 uC; varying float vA; ${FOGF} void main(){ gl_FragColor = vec4(uC * vA * 0.5, 1.0); ${FOGA} }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true,
    })));
    if (o.color != null) m.uniforms.uC.value.set(o.color);
    m.uniforms.uSize.value = o.area ?? 36; m.uniforms.uH.value = o.height ?? 18; m.uniforms.uSpeed.value = o.speed ?? 11;
    const me = new THREE.LineSegments(g, m); me.frustumCulled = false; me.renderOrder = 7; A.group.add(me); return me;
  }
  const bulbMat = () => fxMat('bulb', `uniform float uT; attribute vec3 aS; varying vec3 vC; ${FOGV}
    void main(){
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      float tw = 0.75 + 0.25 * sin(uT * (1.0 + aS.x * 2.0) + aS.y * 30.0);
      gl_PointSize = 0.09 * 300.0 / -mvPosition.z; vC = color * tw;
      gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }`, `varying vec3 vC; ${FOGF}
    void main(){ float d = length(gl_PointCoord - vec2(0.5)) * 2.0; float k = smoothstep(1.0, 0.0, d); gl_FragColor = vec4(vC * (k * k * 0.9 + smoothstep(0.35, 0.0, d) * 3.0), 1.0); ${FOGA} }`, { uT: T });
  function catenary(a, b, sag, n) {
    const out = [];
    for (let i = 0; i <= n; i++) { const t = i / n; out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t]); }
    return out;
  }
  function fairyLights(o = {}) {
    const pts = o.points || [], per = o.per ?? 6, sag = o.sag ?? 0.12, g = group({ parent: o.parent }), K = kit(4), r = U.rng(o.seed ?? 11);
    const bulbs = [], cols = [], seeds = [];
    const PAL = [0xffd18a, 0xff7a7a, 0x8ad4ff, 0xa6ff8a, 0xffe36e, 0xd08aff];
    for (let i = 0; i < pts.length - 1; i++) {
      const L = _v.fromArray(pts[i]).distanceTo(_v2.fromArray(pts[i + 1])), c = catenary(pts[i], pts[i + 1], sag * L / 2, Math.max(4, L * per | 0));
      K.tube(col(0x1c2a1a, { rough: 0.6 }), c, 0.003, { rs: 3, seg: c.length * 2, ao: false });
      c.forEach((p, j) => { if (j === c.length - 1 && i < pts.length - 2) return; bulbs.push(p[0], p[1] - 0.015, p[2]); _c.set(o.color === 'multi' ? PAL[j % PAL.length] : o.color ?? 0xffd18a); cols.push(_c.r, _c.g, _c.b); seeds.push(r(), r(), r()); });
    }
    finish(K, g, { ...o, shadow: false });
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(bulbs, 3)); bg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); bg.setAttribute('aS', new THREE.Float32BufferAttribute(seeds, 3));
    const m = bulbMat(); m.vertexColors = true;
    const p = new THREE.Points(bg, m); p.frustumCulled = false; g.add(p);
    if (o.light) { const c = o.lightAt ? U.v3(o.lightAt) : pts.reduce((a, q) => a.add(_v.fromArray(q)), new THREE.Vector3()).divideScalar(pts.length).add(_v2.set(0, -0.5, 0)); g.userData.light = light('point', { pos: [c.x, c.y, c.z], color: o.color === 'multi' ? 0xffc890 : o.color ?? 0xffc080, intensity: o.light === true ? 1.5 : o.light, distance: 5, parent: g }); }
    return g;
  }

  // ---- water ---------------------------------------------------------------------------------
  function water(o = {}) {
    const x1 = o.x1 ?? -20, z1 = o.z1 ?? -20, x2 = o.x2 ?? 20, z2 = o.z2 ?? 20, y = o.y ?? 0;
    const m = once('water' + (o.color ?? 0) + !!o.dark, () => {
      const w = shared(new THREE.MeshStandardMaterial({ color: o.color ?? (o.dark ? 0x020304 : 0x0a1418), roughness: 0.06, metalness: 0, normalMap: Tex.normal('water'), normalScale: new THREE.Vector2(0.55, 0.55), envMapIntensity: o.dark ? 0.7 : 1 }));
      w.onBeforeCompile = s => {
        s.uniforms.uT = T;
        s.fragmentShader = 'uniform float uT;\n' + s.fragmentShader.replace('#include <normal_fragment_maps>', `
          vec3 mapN = texture2D(normalMap, vNormalMapUv + vec2(uT * 0.013, uT * 0.009)).xyz + texture2D(normalMap, vNormalMapUv * 1.9 + vec2(-uT * 0.011, uT * 0.016)).xyz - 1.0;
          mapN.xy *= normalScale; normal = normalize(tbn * mapN);`);
      };
      w.customProgramCacheKey = () => 'water'; w.userData.novc = true; return w;
    });
    const g = prep(new THREE.PlaneGeometry(x2 - x1, z2 - z1, 1, 1)); g.rotateX(-Math.PI / 2);
    const uv = g.attributes.uv.array, p = g.attributes.position.array;
    for (let i = 0, j = 0; i < p.length; i += 3, j += 2) { uv[j] = (p[i] + (x1 + x2) / 2) / 5; uv[j + 1] = -(p[i + 2] + (z1 + z2) / 2) / 5; }
    const me = new THREE.Mesh(g, m); me.position.set((x1 + x2) / 2, y, (z1 + z2) / 2); me.receiveShadow = true; A.group.add(me);
    for (const s of o.streaks || []) streak({ ...s, y: y + 0.01 });
    return me;
  }
  const streakMat = () => fxMat('streak', `varying vec2 vUv; ${FOGV}
    void main(){ vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }`, `uniform float uT; uniform sampler2D tN; uniform vec3 uC; uniform float uO; varying vec2 vUv; ${FOGF}
    void main(){
      float x = abs(vUv.x - 0.5) * 2.0;
      float n = texture2D(tN, vec2(vUv.x * 0.8 + uT * 0.05, vUv.y * 6.0 - uT * 0.15)).r;
      float g = smoothstep(0.5, 0.75, n + (1.0 - x) * 0.25);
      float a = (1.0 - smoothstep(0.0, 1.0, x + (n - 0.5) * 0.6)) * pow(1.0 - vUv.y, 1.2) * smoothstep(0.0, 0.04, vUv.y) * (0.04 + g * 0.9);
      gl_FragColor = vec4(uC * a * uO, 1.0);
      ${FOGA}
    }`, { uT: T, tN: { value: noiseTex() }, uC: { value: new THREE.Color(1, 1, 1) }, uO: { value: 1 } });
  function streak(o) {
    const w = o.w ?? 1.2, len = o.len ?? 18, geo = new THREE.PlaneGeometry(w, len); geo.rotateX(-Math.PI / 2); geo.translate(0, 0, len / 2);
    const uv = geo.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setY(k, 1 - uv.getY(k));
    const me = new THREE.Mesh(geo, tintedFx(streakMat(), 'streak', o.color ?? 0xffa040, o.opacity ?? 1)); me.position.set(o.x, o.y, o.z); me.renderOrder = 3; A.group.add(me);
    A.update(() => { const c = Engine.camera.position; me.rotation.y = Math.atan2(c.x - A.origin.x - me.position.x, c.z - A.origin.z - me.position.z); });
    return me;
  }

  // ---- terrain & vegetation ---------------------------------------------------------------------
  function terrain(o = {}) {
    const [w, d] = Array.isArray(o.size) ? o.size : [o.size ?? 100, o.size ?? 100], seg = o.seg ?? 96, c = U.v3(o.pos || [0, 0, 0]).clone();
    const hf = o.height || (() => 0);
    const g = new THREE.PlaneGeometry(w, d, seg, Math.round(seg * d / w)); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, hf(p.getX(i) + c.x, p.getZ(i) + c.z));
    g.computeVertexNormals();
    const pg = prep(g), n = pg.attributes.normal.array, cc = pg.attributes.color.array, pp = pg.attributes.position.array;
    for (let i = 0; i < pp.length; i += 3) { const slope = 1 - n[i + 1], k = 1 - ss(0.05, 0.4, slope) * 0.35 + (Math.sin(pp[i] * 0.21 + pp[i + 2] * 0.13) * Math.sin(pp[i + 2] * 0.17 - pp[i] * 0.07)) * 0.08; cc[i] = cc[i + 1] = cc[i + 2] = k; }
    if (o.color != null) { _c.set(o.color); for (let i = 0; i < cc.length; i += 3) { cc[i] *= _c.r; cc[i + 1] *= _c.g; cc[i + 2] *= _c.b; } }
    projUV(pg);
    const me = new THREE.Mesh(pg, Tex.vc(o.mat || mat('grass'))); me.position.set(c.x, 0, c.z); me.receiveShadow = true; A.group.add(me);
    const ox = A.origin.x, oy = A.origin.y, oz = A.origin.z;
    World.terrain = (x, z) => hf(x - ox, z - oz) + oy;
    return me;
  }
  const groundY = (x, z) => World.terrain ? World.terrain(x + A.origin.x, z + A.origin.z) - A.origin.y : 0;
  function windify(m, amt = 1) {
    const prev = m.onBeforeCompile;
    m.onBeforeCompile = s => {
      prev && prev(s);
      s.uniforms.uT = T;
      s.vertexShader = 'uniform float uT;\n' + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          vec4 wp = modelMatrix * vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            wp = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
          #endif
          float h = max(transformed.y, 0.0) * ${amt.toFixed(4)};
          float sw = sin(uT * 1.3 + wp.x * 0.31 + wp.z * 0.23) + 0.5 * sin(uT * 2.9 + wp.x * 0.7);
          float fl = sin(uT * 7.0 + wp.x * 5.0 + wp.y * 4.0 + wp.z * 3.0);
          transformed.x += (sw * 0.03 + fl * 0.006) * h; transformed.z += (sw * 0.018 + fl * 0.006) * h;
        }`);
    };
    m.customProgramCacheKey = () => 'wind' + amt;
    return m;
  }
  const leafMat = (kind, tint = 0xffffff) => once('leaf' + kind + tint, () => windify(shared(new THREE.MeshStandardMaterial({ map: Tex.foliage(kind), color: tint, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85, vertexColors: true })), 1));
  const blobLeaf = tint => once('blobleaf' + tint, () => windify(shared(new THREE.MeshStandardMaterial({ color: tint, roughness: 0.9, flatShading: true, vertexColors: true })), 0.6));
  // leaf cluster: a noisy blob + crossed leaf cards whose normals point out of the cluster (soft volumetric shading)
  function cluster(K, x, y, z, rad, kind, tint, r, o = {}) {
    const b = new THREE.IcosahedronGeometry(rad * 0.62, 1), bp = b.attributes.position;
    for (let i = 0; i < bp.count; i++) { _v.fromBufferAttribute(bp, i); const k = 1 + (Math.sin(_v.x * 7 + x) * Math.sin(_v.y * 5 + z) * 0.18) + (r() - 0.5) * 0.12; bp.setXYZ(i, _v.x * k, _v.y * k * (o.flat ?? 0.8), _v.z * k); }
    b.computeVertexNormals();
    const bg = K.add(b, blobLeaf(tint), { x, y, z, ao: false, uv: 'unit' });
    { const n = bg.attributes.normal.array, c = bg.attributes.color.array, tc = new THREE.Color(tint), tv = [tc.r, tc.g, tc.b]; for (let i = 0; i < n.length; i += 3) { const k = 0.72 + 0.28 * ss(-0.6, 0.8, n[i + 1]), sn = o.snow ? ss(0.35, 0.6, n[i + 1]) : 0; for (let j = 0; j < 3; j++) c[i + j] = c[i + j] * k * (1 - sn) + sn * 0.85 / Math.max(0.02, tv[j]); } }
    const cards = o.cards ?? 7;
    for (let i = 0; i < cards; i++) {
      const s = rad * (1.3 + r() * 0.7), pg = new THREE.PlaneGeometry(s, s);
      pg.rotateY(r() * Math.PI); pg.rotateX((r() - 0.5) * 1.2);
      const cx = (r() - 0.5) * rad * 0.9, cy = (r() - 0.3) * rad * 0.7, cz = (r() - 0.5) * rad * 0.9;
      pg.translate(cx, cy, cz);
      const pos = pg.attributes.position, nn = pg.attributes.normal;
      for (let k = 0; k < pos.count; k++) { _v.fromBufferAttribute(pos, k).normalize(); _v.y += 0.5; _v.normalize(); nn.setXYZ(k, _v.x, _v.y, _v.z); }
      K.add(pg, leafMat(kind), { x, y, z, uv: 'unit', ao: false, tint: o.snow && r() < 0.35 ? 0xe8eef4 : _c.set(tint).offsetHSL(0, 0, (r() - 0.4) * 0.12).getHex() });
    }
  }
  function limb(K, m, a, b, r0, r1, seg = 7) {
    const d = _v2.subVectors(b, a), L = d.length();
    const g = new THREE.CylinderGeometry(r1, r0, L, seg, 1, true); g.translate(0, L / 2, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(UP, d.normalize());
    g.applyQuaternion(q); g.translate(a.x, a.y, a.z);
    K.add(g, m, { uv: [Math.PI * 2 * r0, L], ao: a.y < 0.5 });
  }
  const TREES = {
    gum: { h: [7, 10], r: 0.28, bark: () => mat('bark_gum'), depth: 3, spread: [0.45, 0.85], kids: 3, cl: [1.1, 1.7], kind: 'gum', tint: 0x7c8c5c, droop: 0.2 },
    fig: { h: [3.5, 4.5], r: 0.75, bark: () => mat('bark_gum', { color: 0x9a9890 }), depth: 3, spread: [0.9, 1.25], kids: 4, cl: [2.2, 3.2], kind: 'broad', tint: 0x3e5c2c, roots: true, len: 0.75 },
    poplar: { h: [9, 12], r: 0.22, bark: () => mat('bark', { color: 0xb0a898 }), depth: 2, spread: [0.12, 0.28], kids: 4, cl: [1.1, 1.5], kind: 'broad', tint: 0x6a8a3a, column: true },
    willow: { h: [3, 4], r: 0.4, bark: () => mat('bark'), depth: 2, spread: [0.7, 1.0], kids: 5, cl: [1.4, 2], kind: 'willow', tint: 0x8aa050, hang: true },
    pine: { h: [9, 13], r: 0.3, bark: () => mat('bark', { color: 0x8a6a50 }), depth: 0, kind: 'pine', tint: 0x2e4a30, cone: true },
    snow_gum: { h: [3.5, 5], r: 0.2, bark: () => mat('bark_gum', { color: 0xd8c8b8 }), depth: 3, spread: [0.6, 1.1], kids: 3, cl: [0.9, 1.3], kind: 'gum', tint: 0x6e7e58, stems: 3 },
    dead: { h: [6, 8], r: 0.26, bark: () => mat('bark', { color: 0x9a948c }), depth: 3, spread: [0.5, 0.95], kids: 3, cl: null },
  };
  function tree(kind, o = {}) {
    if (kind === 'palm') return palm(o);
    const P = TREES[kind]; if (!P) { console.error('Build.tree: unknown kind ' + kind); return group(o); }
    const seed = o.seed ?? U.hash(kind + JSON.stringify(o.pos || 0)), r = U.rng(seed), K = kit(seed);
    const bark = P.bark(), tint = o.color ?? P.tint, H = P.h[0] + r() * (P.h[1] - P.h[0]);
    const grow = (a, dir, len, rad, depth) => {
      const b = a.clone().addScaledVector(dir, len);
      limb(K, bark, a, b, rad, rad * 0.62);
      if (depth <= 0 || !P.depth) {
        if (P.cl) { const cr = P.cl[0] + r() * (P.cl[1] - P.cl[0]); cluster(K, b.x, b.y, b.z, cr, P.kind, tint, r, { snow: o.snow }); const m = a.clone().lerp(b, 0.5); cluster(K, m.x + (r() - 0.5) * cr, m.y + cr * 0.2, m.z + (r() - 0.5) * cr, cr * 0.7, P.kind, tint, r, { snow: o.snow, cards: 5 }); } if (P.hang) hangers(K, b, P, r); return; }
      const n = P.kids - (depth < P.depth ? 1 : 0) + (r() < 0.4 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const az = (i / n) * Math.PI * 2 + r() * 1.2, el = P.spread[0] + r() * (P.spread[1] - P.spread[0]);
        const nd = new THREE.Vector3(Math.sin(el) * Math.cos(az), Math.cos(el), Math.sin(el) * Math.sin(az)).lerp(dir, 0.25).normalize();
        nd.y -= (P.droop || 0) * (1 - depth / P.depth); nd.normalize();
        const at = a.clone().lerp(b, 0.75 + r() * 0.25);
        grow(at, nd, len * (P.len ?? 0.62) * (0.8 + r() * 0.4), rad * 0.62, depth - 1);
      }
      if (P.column) for (let k = 0; k < 16; k++) { const t = k / 15, rr = Math.sin(Math.PI * (0.15 + t * 0.85)) * 1.1 + 0.3, an = r() * 6.283; cluster(K, a.x + Math.cos(an) * rr * 0.6, a.y + len * (0.1 + t * 1.05), a.z + Math.sin(an) * rr * 0.6, 0.7 + r() * 0.35, P.kind, tint, r, { flat: 1.2, cards: 5 }); }
    };
    if (P.cone) {
      limb(K, bark, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, H, 0), P.r, 0.04);
      for (let k = 0; k < 7; k++) {
        const y = H * (0.25 + k * 0.1), rr = (1 - k / 7) * H * 0.22 + 0.5, cg = new THREE.ConeGeometry(rr, H * 0.2, 9, 1, true), cp = cg.attributes.position;
        for (let i = 0; i < cp.count; i++) { _v.fromBufferAttribute(cp, i); const k2 = 1 + (r() - 0.5) * 0.25; cp.setXYZ(i, _v.x * k2, _v.y, _v.z * k2); }
        cg.computeVertexNormals(); K.add(cg, blobLeaf(tint), { y: y + H * 0.1, ry: r() * 3, uv: 'unit', ao: false });
        for (let i = 0; i < 4; i++) { const a = i / 4 * 6.283 + r(); const pg = new THREE.PlaneGeometry(rr * 1.2, rr * 0.7); pg.translate(0, 0, 0); K.add(pg, leafMat('pine'), { x: Math.cos(a) * rr * 0.6, y: y + H * 0.05, z: Math.sin(a) * rr * 0.6, ry: -a + Math.PI / 2, rx: 0.5, uv: 'unit', ao: false, tint }); }
      }
    } else {
      const stems = P.stems || 1;
      for (let s = 0; s < stems; s++) {
        const lean = stems > 1 ? 0.35 : 0.12, az = s / stems * 6.283 + r();
        const dir = new THREE.Vector3(Math.cos(az) * lean * r(), 1, Math.sin(az) * lean * r()).normalize();
        const mid = new THREE.Vector3(0, 0, 0).addScaledVector(dir, H * 0.45);
        mid.x += (r() - 0.5) * 0.4; mid.z += (r() - 0.5) * 0.4;
        limb(K, bark, new THREE.Vector3(0, -0.2, 0), mid, P.r * 1.15 / Math.sqrt(stems), P.r * 0.85 / Math.sqrt(stems));
        grow(mid, dir, H * 0.55, P.r * 0.85 / Math.sqrt(stems), P.depth);
      }
      if (P.roots) for (let i = 0; i < 7; i++) { const a = i / 7 * 6.283 + r() * 0.5, L = 1.2 + r() * 1.4; limb(K, bark, new THREE.Vector3(Math.cos(a) * 0.3, 1.2, Math.sin(a) * 0.3), new THREE.Vector3(Math.cos(a) * L, -0.1, Math.sin(a) * L), 0.28, 0.06, 5); }
    }
    const g = group({ pos: o.pos, yaw: r() * 6.283, scale: o.scale, parent: o.parent });
    finish(K, g, { ...o, shadow: true });
    colBox(g, -P.r * 1.2, 0, -P.r * 1.2, P.r * 1.2, H * 0.6, P.r * 1.2, { sight: true, cam: true });
    return g;
  }
  function hangers(K, b, P, r) {
    for (let i = 0; i < 7; i++) {
      const a = r() * 6.283, d = 0.6 + r() * 1.2, L = 2 + r() * 1.8, pg = new THREE.PlaneGeometry(0.7, L); pg.translate(0, -L / 2, 0);
      K.add(pg, leafMat('willow'), { x: b.x + Math.cos(a) * d, y: b.y + 0.3, z: b.z + Math.sin(a) * d, ry: -a, uv: 'unit', ao: false, tint: P.tint });
    }
  }
  function palm(o = {}) {
    const seed = o.seed ?? U.hash('palm' + JSON.stringify(o.pos || 0)), r = U.rng(seed), K = kit(seed);
    const H = 6 + r() * 4, lean = new THREE.Vector3((r() - 0.5) * 0.5, 0, (r() - 0.5) * 0.5), pts = [];
    for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(new THREE.Vector3(lean.x * t * t * H * 0.3, t * H, lean.z * t * t * H * 0.3)); }
    const bark = mat('bark', { color: 0xb5a78e, scale: 0.4 });
    for (let i = 0; i < 8; i++) limb(K, bark, pts[i], pts[i + 1], 0.2 - i * 0.008, 0.2 - (i + 1) * 0.008, 8);
    const top = pts[8];
    K.sph(col(0x6a5a3a, { rough: 0.9 }), 0.26, top.x, top.y - 0.1, top.z, { s: [1, 1.3, 1] });
    const n = 12 + (r() * 4 | 0);
    for (let i = 0; i < n; i++) {
      const a = i / n * 6.283 + r() * 0.3, L = 2.6 + r() * 1.2, droop = 0.3 + r() * 0.9 + (i % 3) * 0.2, pg = new THREE.PlaneGeometry(1.0, L, 1, 8), pp = pg.attributes.position;
      for (let k = 0; k < pp.count; k++) { const t = (pp.getY(k) + L / 2) / L; pp.setXYZ(k, pp.getX(k) * (1 - t * 0.5), 0, t * L); pp.setY(k, Math.sin(t * 1.2) * 0.9 - t * t * droop * 2); }
      pg.computeVertexNormals();
      const nn = pg.attributes.normal; for (let k = 0; k < nn.count; k++) { const x = nn.getX(k), y = Math.abs(nn.getY(k)) + 0.6, z = nn.getZ(k); const l = Math.hypot(x, y, z); nn.setXYZ(k, x / l, y / l, z / l); }
      K.add(pg, leafMat('palm'), { x: top.x, y: top.y, z: top.z, ry: a, uv: 'unit', ao: false, tint: o.color ?? 0x9aa06a });
    }
    const g = group({ pos: o.pos, scale: o.scale, parent: o.parent });
    finish(K, g, o);
    colBox(g, -0.25, 0, -0.25, 0.25, 3, 0.25, { sight: true, cam: true });
    return g;
  }
  function grass(o = {}) {
    const [x1, z1, x2, z2] = o.box || [-5, -5, 5, 5], n = o.count ?? 800, r = U.rng(o.seed ?? 21), H = o.height ?? 0.35;
    const blades = [];
    for (let b = 0; b < 14; b++) {
      const a = r() * 6.283, d = Math.sqrt(r()) * 0.16, h = H * (0.45 + r() * 0.7), lean = 0.15 + r() * 0.45, w = 0.016 + r() * 0.012;
      const bx = Math.cos(a) * d, bz = Math.sin(a) * d, dx = Math.cos(a + 1.57) * w, dz = Math.sin(a + 1.57) * w, lx = Math.cos(a) * lean * h, lz = Math.sin(a) * lean * h;
      const P = [[bx - dx, 0, bz - dz], [bx + dx, 0, bz + dz], [bx + lx * 0.4 - dx * 0.6, h * 0.55, bz + lz * 0.4 - dz * 0.6], [bx + lx * 0.4 + dx * 0.6, h * 0.55, bz + lz * 0.4 + dz * 0.6], [bx + lx, h, bz + lz]];
      const tri = (i, j, k) => blades.push(...P[i], ...P[j], ...P[k]);
      tri(0, 1, 3); tri(0, 3, 2); tri(2, 3, 4);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(blades, 3)); g.computeVertexNormals();
    const pa = g.attributes.position, cA = new Float32Array(pa.count * 3), nn = g.attributes.normal;
    for (let i = 0; i < pa.count; i++) { const t = pa.getY(i) / H; cA.set([0.35 + t * 0.7, 0.4 + t * 0.65, 0.3 + t * 0.4], i * 3); nn.setXYZ(i, nn.getX(i) * 0.3, 1, nn.getZ(i) * 0.3); }
    g.setAttribute('color', new THREE.BufferAttribute(cA, 3)); g.normalizeNormals && g.normalizeNormals();
    const m = once('grass' + (o.color ?? 0x5f7a34), () => windify(shared(new THREE.MeshStandardMaterial({ color: o.color ?? 0x5f7a34, roughness: 0.9, side: THREE.DoubleSide, vertexColors: true })), 3));
    const im = new THREE.InstancedMesh(g, m, n), M = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      const x = x1 + r() * (x2 - x1), z = z1 + r() * (z2 - z1), s = 0.7 + r() * 0.6;
      M.compose(_v.set(x, (o.y ?? groundY(x, z)) - 0.01, z), _q.setFromAxisAngle(UP, r() * 6.283), _s.set(s, s * (0.8 + r() * 0.4), s)); im.setMatrixAt(i, M);
      im.setColorAt(i, _c.setHSL(0.2 + r() * 0.06, 0.35 + r() * 0.2, 0.45 + r() * 0.2));
    }
    im.receiveShadow = true; im.castShadow = false; A.group.add(im); return im;
  }
  function vines(o = {}) {
    const [x1, y1, z1, x2, y2, z2] = o.box || [0, 0, 0, 2, 3, 0.1], r = U.rng(o.seed ?? 31), K = kit(5);
    const ext = [x2 - x1, y2 - y1, z2 - z1], thin = ext.indexOf(Math.min(...ext));
    const stem = col(0x3a3222, { rough: 0.9 }), leaf = leafMat('ivy'), n = Math.round((o.density ?? 1) * Math.max(ext[0], ext[2], ext[1]) * 2.2);
    const onPlane = (a, b) => { const p = [0, 0, 0]; const ax = [0, 1, 2].filter(i => i !== thin); p[ax[0]] = [x1, y1, z1][ax[0]] + a * ext[ax[0]]; p[ax[1]] = [x1, y1, z1][ax[1]] + b * ext[ax[1]]; p[thin] = [x1, y1, z1][thin] + ext[thin] * 0.5; return p; };
    const ceil = thin === 1;
    for (let v = 0; v < n; v++) {
      let a = r(), b = ceil ? r() : 1, pts = [];
      const steps = 8 + (r() * 10 | 0);
      for (let s = 0; s < steps; s++) {
        pts.push(onPlane(U.clamp(a), U.clamp(b)));
        a += (r() - 0.5) * 0.12; b -= ceil ? (r() - 0.5) * 0.12 : (0.03 + r() * 0.08) * (o.hang ? 1.4 : 1);
        if (b < 0) break;
      }
      if (pts.length < 2) continue;
      K.tube(stem, pts, 0.01, { rs: 4, ao: false });
      for (const p of pts) for (let k = 0; k < 2; k++) {
        const s = 0.22 + r() * 0.22, pg = new THREE.PlaneGeometry(s, s);
        if (ceil) pg.rotateX(-Math.PI / 2 + (r() - 0.5) * 0.8); else if (thin === 0) pg.rotateY(Math.PI / 2 + (r() - 0.5) * 0.9); else pg.rotateY((r() - 0.5) * 0.9);
        pg.rotateZ(r() * 6.283);
        K.add(pg, leaf, { x: p[0] + (r() - 0.5) * 0.15, y: p[1] + (r() - 0.5) * 0.15, z: p[2] + (r() - 0.5) * 0.15, uv: 'unit', ao: false, tint: _c.setHSL(0.26, 0.4, 0.35 + r() * 0.15).getHex() });
      }
    }
    const g = group({ parent: o.parent }); finish(K, g, { ...o, shadow: true }); return g;
  }
  // scatter: small instanced clutter on the ground
  function scatter(kind, o = {}) {
    const [x1, z1, x2, z2] = o.box || [-3, -3, 3, 3], n = o.count ?? 40, r = U.rng(o.seed ?? U.hash(kind));
    const SC = {
      debris: () => [[new THREE.BoxGeometry(0.22, 0.07, 0.11), mat('brick')], [new THREE.BoxGeometry(0.5, 0.025, 0.09), mat('wood', { color: 0x7a6a5a })]],
      rubble: () => [[new THREE.DodecahedronGeometry(0.12, 0), mat('concrete')], [new THREE.TetrahedronGeometry(0.1, 0), mat('concrete', { color: 0xb0a898 })]],
      leaves: () => [[new THREE.PlaneGeometry(0.07, 0.035).rotateX(-Math.PI / 2), col(0xffffff, { rough: 0.9, side: THREE.DoubleSide })]],
      paper: () => [[new THREE.PlaneGeometry(0.21, 0.297, 2, 2).rotateX(-Math.PI / 2), mat('paper', { side: THREE.DoubleSide })]],
      bottles: () => [[new THREE.LatheGeometry([[0, 0], [0.035, 0], [0.037, 0.02], [0.037, 0.17], [0.014, 0.23], [0.013, 0.29], [0, 0.29]].map(p => new THREE.Vector2(...p)), 10), col(0xffffff, { rough: 0.1, metal: 0.1, transparent: true, opacity: 0.8 })]],
      cans: () => [[new THREE.CylinderGeometry(0.033, 0.033, 0.12, 10), col(0xffffff, { rough: 0.35, metal: 0.8 })]],
      phones: () => [[new RoundedBoxGeometry(0.075, 0.009, 0.155, 1, 0.004), col(0x121315, { rough: 0.3, metal: 0.4 })], [new THREE.PlaneGeometry(0.068, 0.145).rotateX(-Math.PI / 2).translate(0, 0.0051, 0), null]],
      glass: () => [[new THREE.TetrahedronGeometry(0.04, 0).scale(1, 0.12, 1), glass(0.5, 0xcfe0e4)]],
    };
    const def = SC[kind]; if (!def) { console.error('Build.scatter: unknown kind ' + kind); return group(); }
    const layers = def(), g = group({ parent: o.parent }), M = new THREE.Matrix4(), mats = [];
    for (let i = 0; i < n; i++) {
      const x = x1 + r() * (x2 - x1), z = z1 + r() * (z2 - z1), y = o.y ?? groundY(x, z), s = 0.7 + r() * 0.6;
      const lying = kind === 'bottles' || kind === 'cans' ? r() < 0.75 : false;
      _e.set(lying ? Math.PI / 2 : (kind === 'paper' || kind === 'leaves' ? (r() - 0.5) * 0.3 : (r() - 0.5) * 0.6), r() * 6.283, (r() - 0.5) * 0.3, 'YXZ');
      M.compose(_v.set(x, y + (lying ? 0.035 : kind === 'rubble' ? 0.03 : 0.004), z), _q.setFromEuler(_e), _s.setScalar(s)); mats.push(M.clone());
    }
    layers.forEach(([geo, m], li) => {
      if (!m) m = scr(Tex.screen('feed'), 1.1);
      const im = new THREE.InstancedMesh(geo, m, n); mats.forEach((mm, i) => im.setMatrixAt(i, mm));
      if (kind === 'leaves') for (let i = 0; i < n; i++) im.setColorAt(i, _c.setHSL(0.07 + r() * 0.1, 0.45, 0.25 + r() * 0.2));
      if (kind === 'bottles') for (let i = 0; i < n; i++) im.setColorAt(i, new THREE.Color([0x2e5a2a, 0x5a3a1a, 0x9ab0a0][i % 3]));
      if (kind === 'cans') for (let i = 0; i < n; i++) im.setColorAt(i, new THREE.Color([0xc02020, 0xd8d8d8, 0x2050a0, 0x20a040][i % 4]));
      if (kind === 'phones' && li === 1) { im.count = Math.ceil(n * 0.35); }
      im.castShadow = kind !== 'leaves' && kind !== 'paper'; im.receiveShadow = true; g.add(im);
    });
    return g;
  }
  function instanced(geo, m, mats, o = {}) {
    const im = new THREE.InstancedMesh(geo, m, mats.length); mats.forEach((mm, i) => im.setMatrixAt(i, mm));
    if (o.colors) o.colors.forEach((c, i) => im.setColorAt(i, _c.set(c)));
    im.castShadow = o.shadow ?? true; im.receiveShadow = true; parentOf(o).add(im); return im;
  }

  // ---- decals, posters, screen-rot, signs, wires ---------------------------------------------------
  function decal(t, o = {}) {
    const tex = typeof t === 'string' ? Tex.decal(t) : t;
    const m = once('decal' + tex.uuid + JSON.stringify([o.opacity, o.color, o.emissive, o.cutout, o.rough]), () => {
      const x = shared(new THREE.MeshStandardMaterial({ map: tex, color: o.color ?? 0xffffff, roughness: o.rough ?? 0.85, transparent: !o.cutout, alphaTest: o.cutout ? 0.5 : 0.01, opacity: o.opacity ?? 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, emissive: o.emissive ? 0xffffff : 0, emissiveMap: o.emissive ? tex : null, emissiveIntensity: o.emissive || 0 }));
      x.userData.noshadow = true; return x;
    });
    const g = prep(new THREE.PlaneGeometry(o.w ?? 1, o.h ?? 1)); if (o.floor) g.rotateX(-Math.PI / 2);
    shade(g, null, false);
    const me = new THREE.Mesh(g, Tex.vc(m)); place(me, o); if (o.floor && o.yaw) me.rotation.y = o.yaw; if (o.spin) me.rotation.z = o.spin;
    me.receiveShadow = true; me.userData.batch = !o.dynamic; me.renderOrder = 1; parentOf(o).add(me);
    return me;
  }
  function poster(kind, o = {}) {
    const w = o.w ?? 0.6, h = w * 724 / 512, g = group({ pos: o.pos, yaw: o.yaw, parent: o.parent });
    decal(Tex.poster(kind, { worn: o.worn }), { w, h, cutout: true, parent: g, rough: 0.9, dynamic: o.dynamic, pos: [0, 0, 0.004] });
    if (o.tape !== false) for (const [x, y] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) decal(Tex.decal('stain'), { w: 0.06, h: 0.025, color: 0xe8e0c0, opacity: 0.8, parent: g, pos: [x * (w / 2 - 0.01), y * (h / 2 - 0.01), 0.006], spin: x * y * 0.6, dynamic: o.dynamic });
    return g;
  }
  function screenrot(o = {}) {
    const m = mat('screenrot', { transparent: true, emissiveIntensity: o.intensity ?? 1.6, scale: o.scale ?? 2 });
    const g = prep(new THREE.PlaneGeometry(o.w ?? 2, o.h ?? 2));
    if (o.floor) g.rotateX(-Math.PI / 2); if (o.ceiling) g.rotateX(Math.PI / 2);
    const me = new THREE.Mesh(g, m); place(me, o); parentOf(o).add(me);
    projUV(g, 1, false, areaMatrix(me)); me.renderOrder = 2; me.userData.batch = !o.dynamic;
    return me;
  }
  function sign(o = {}) {
    const w = o.w ?? 1, h = o.h ?? 0.5, post = o.post ?? 0, posts = o.posts ?? 1, K = kit(8);
    const metal = mat('metal', { color: 0xb8bcc0 }), y = post || (o.y ?? 0);
    K.box(o.back || mat('metal_painted', { color: 0x8a9096 }), w, h, 0.03, 0, y, -0.016, { r: 0.008 });
    K.plane(o.lit ? lab(o.tex, { lit: o.lit === true ? 1.6 : o.lit, rough: 0.4, cut: true }) : lab(o.tex, { rough: 0.6, cut: true }), w - 0.01, h - 0.01, 0, y + h / 2, 0.001);
    if (post) for (let i = 0; i < posts; i++) K.cyl(metal, 0.035, 0.035, post + h * 0.9, posts === 1 ? 0 : (i ? 1 : -1) * w * 0.35, 0, -0.06);
    const g = group({ pos: o.pos, yaw: o.yaw, parent: o.parent }); finish(K, g, o);
    if (post && o.solid !== false) colBox(g, -0.08, 0, -0.1, 0.08, post, 0);
    return g;
  }
  function wire(a, b, o = {}) {
    const pts = catenary(U.v3(a).toArray(), U.v3(b).toArray(), o.sag ?? 0.4, 16), K = kit(2);
    K.tube(col(o.color ?? 0x151515, { rough: 0.6 }), pts, o.r ?? 0.01, { rs: 4, seg: 24, ao: false });
    const g = group({ parent: o.parent }); finish(K, g, { ...o, shadow: false }); return g;
  }

  // ---- props --------------------------------------------------------------------------------------
  const PROPS = {};
  function prop(name, o = {}) {
    const def = PROPS[name]; if (!def) { console.error('Build.prop: unknown prop ' + name); return group(o); }
    const seed = o.seed ?? U.hash(name + JSON.stringify(o.pos || 0));
    const g = group(o); g.name = name; if (o.dynamic) g.userData.dynamic = true;
    const K = kit(seed);
    def.f(K, o, K.r, g);
    if (o.worn || o.burnt) grime(K, o.worn ?? 0, !!o.burnt, seed);
    if ((o.blob ?? def.blob ?? true) && K.parts.size) {
      const bb = new THREE.Box3(); for (const [m, gs] of K.parts) if (!m.transparent) for (const x of gs) { x.computeBoundingBox(); bb.union(x.boundingBox); }
      if (!bb.isEmpty() && bb.min.y < 0.2) K.blob((bb.max.x - bb.min.x) * 1.25 + 0.2, (bb.max.z - bb.min.z) * 1.25 + 0.2, (bb.min.x + bb.max.x) / 2, (bb.min.z + bb.max.z) / 2);
    }
    finish(K, g, o);
    g.userData.colliders = kitCols(K, g, def, o);
    if (def.after) def.after(g, o);
    return g;
  }
  const P = (name, desc, f, extra = {}) => { PROPS[name] = { desc, f, ...extra }; };
  // generic ageing baked into vertex colours: splotchy grime + rising damp (worn 0..1), or charring (burnt)
  function grime(K, amt, burnt, seed) {
    const r = U.rng(seed + 99), ph = [r() * 10, r() * 10, r() * 10];
    for (const [m, gs] of K.parts) {
      if (m.userData.novc) continue;
      for (const g of gs) {
        const p = g.attributes.position.array, c = g.attributes.color.array;
        for (let i = 0; i < p.length; i += 3) {
          const x = p[i], y = p[i + 1], z = p[i + 2], n = 0.5 + 0.5 * Math.sin(x * 3.1 + ph[0]) * Math.sin(z * 2.7 + ph[1]) * Math.sin(y * 1.9 + ph[2]);
          if (burnt) { const k = 0.14 + 0.12 * n; c[i] *= k * 1.1; c[i + 1] *= k; c[i + 2] *= k * 0.9; continue; }
          const d = amt * (0.4 * n + 0.4 * (1 - ss(0, 1.2, y)));
          c[i] *= 1 - d * 0.5; c[i + 1] *= 1 - d * 0.56; c[i + 2] *= 1 - d * 0.66;
        }
      }
    }
  }

  // shared prop pieces
  const dark = () => col(0x1a1c1f, { rough: 0.5 }), chrome = () => col(0xdfe3e6, { rough: 0.16, metal: 1 }), alu = () => col(0xbfc4c9, { rough: 0.32, metal: 0.85 });
  const offMat = () => col(0x050608, { rough: 0.1, metal: 0.25 });
  function setScreen(meshes, t, k = 1.3) { const m = t ? scr(typeof t === 'string' ? Tex.screen(t) : t, k) : offMat(); for (const s of [].concat(meshes || [])) s.material = m; }
  function monitor(K, tex) {
    const d = col(0x18191b, { rough: 0.4 });
    K.box(d, 0.22, 0.012, 0.16, 0, 0, 0, { r: 0.005 }); K.box(d, 0.04, 0.2, 0.03, 0, 0.012, -0.03);
    K.box(d, 0.52, 0.33, 0.03, 0, 0.14, 0, { r: 0.008 });
    K.plane(scr(tex || Tex.screen('monitor'), 1.05), 0.49, 0.3, 0, 0.305, 0.0155);
  }
  function eftpos(K) {
    const d = col(0x222428, { rough: 0.35 });
    K.box(d, 0.09, 0.02, 0.1, 0, 0, 0, { r: 0.008 }); K.box(d, 0.08, 0.035, 0.17, 0, 0.02, 0, { rx: -0.35, r: 0.012 });
    K.plane(scr(Tex.screen('eftpos'), 0.9), 0.055, 0.045, 0, 0.087, 0.035, { rx: -0.35 - Math.PI / 2 + 0.6 });
    K.plane(col(0x3a3d42, { rough: 0.5 }), 0.06, 0.06, 0, 0.055, -0.035, { rx: -0.35 - Math.PI / 2 + 0.6 });
  }
  function demoPhone(K, tex) {
    const cl = glass(0.35, 0xe8f0f2), ph = col(0x111214, { rough: 0.25, metal: 0.3 });
    K.box(cl, 0.1, 0.012, 0.09, 0, 0, 0, { r: 0.004 });
    K.box(cl, 0.1, 0.1, 0.012, 0, 0.012, -0.035, { rx: -0.35 });
    K.box(ph, 0.075, 0.155, 0.009, 0, 0.018, -0.005, { rx: -0.35, r: 0.004 });
    K.plane(scr(tex, 1.3), 0.068, 0.144, 0, 0.0924, -0.0272, { rx: -0.35, name: 'screens' });
    K.tube(col(0x2a2c30, { rough: 0.5 }), [[0, 0.03, -0.01], [0, 0.01, 0.03], [0.03, 0.004, 0.06], [0.05, 0.003, 0.02], [0.06, -0.03, 0.0]], 0.003, { rs: 4 });
    const pt = lab(Tex.sign('price_tag', 'FLAGSHIP 256GB|$0'), { rough: 0.6 });
    K.plane(pt, 0.07, 0.045, 0, 0.02, 0.075, { rx: -0.45 });
  }
  function stanchion(K, x, z, h = 0.95) {
    K.cyl(dark(), 0.16, 0.17, 0.03, x, 0, z, { seg: 20 }); K.cyl(chrome(), 0.024, 0.024, h - 0.03, x, 0.03, z, { seg: 10 }); K.cyl(dark(), 0.045, 0.045, 0.07, x, h - 0.07, z, { seg: 14 });
    K.blob(0.5, 0.5, x, z);
  }
  function wheel(K, x, z, r, o = {}) {
    const w = o.w ?? 0.22, side = Math.sign(x), fl = o.flat ? 0.84 : 1;
    const cy = o.burnt ? r * 0.62 : r * fl;
    if (!o.burnt) K.cyl(col(0x141414, { rough: 0.88 }), r, r, w, x + side * w / 2, cy, z, { rz: side * Math.PI / 2, s: [fl, 1, 1], seg: 18 });
    K.cyl(o.burnt ? col(0x2e2724, { rough: 0.9, metal: 0.4 }) : o.steel ? col(0x2a2c2f, { rough: 0.5, metal: 0.6 }) : col(0xb8bcc0, { rough: 0.3, metal: 0.85 }), r * 0.62, r * 0.62, w + 0.012, x + side * (w + 0.012) / 2, cy, z, { rz: side * Math.PI / 2, seg: 12 });
    K.cyl(dark(), r * 0.2, r * 0.2, w + 0.024, x + side * (w + 0.024) / 2, cy, z, { rz: side * Math.PI / 2, seg: 8 });
  }
  // car kinds: side outline (z = along the car, y up) from rear-bottom over the top to front-bottom; cab = greenhouse polygon
  const CARS = {
    sedan: { L: 4.7, W: 1.8, wb: 2.75, wr: 0.32, clr: 0.24, head: [0.74, 2.3], tail: [0.86, -2.33], belt: 0.98,
      top: [[-2.33, 0.4], [-2.38, 0.64], [-2.3, 0.9], [-1.95, 0.98], [-1.45, 1.0], [1.0, 1.0], [1.55, 0.92], [2.2, 0.82], [2.36, 0.68], [2.36, 0.4]],
      cab: [[-1.52, 0.97], [-0.85, 1.43], [0.25, 1.44], [1.03, 0.97]] },
    hatch: { L: 3.95, W: 1.74, wb: 2.48, wr: 0.3, clr: 0.22, head: [0.74, 1.94], tail: [0.95, -1.96], belt: 0.98,
      top: [[-1.95, 0.4], [-1.99, 0.62], [-1.97, 0.96], [-1.8, 1.0], [0.75, 1.0], [1.25, 0.92], [1.85, 0.8], [1.98, 0.66], [1.98, 0.4]],
      cab: [[-1.93, 0.97], [-1.72, 1.46], [0.05, 1.48], [0.78, 0.97]] },
    police: 'sedan',
    ute: { L: 5.2, W: 1.86, wb: 3.1, wr: 0.34, clr: 0.3, head: [0.82, 2.55], tail: [0.8, -2.62], belt: 1.04,
      top: [[-0.62, 0.45], [-0.64, 1.04], [0.95, 1.04], [1.5, 0.98], [2.45, 0.88], [2.58, 0.72], [2.58, 0.45]],
      cab: [[-0.6, 1.02], [-0.52, 1.64], [0.35, 1.66], [0.98, 1.02]], tray: [-2.62, -0.66, 1.04] },
    van: { L: 4.85, W: 1.9, wb: 2.9, wr: 0.33, clr: 0.26, head: [0.9, 2.44], tail: [1.0, -2.44], box: true, belt: 1.15,
      top: [[-2.42, 0.4], [-2.44, 1.96], [-2.32, 2.03], [1.7, 2.03], [2.06, 1.9], [2.33, 1.2], [2.45, 1.04], [2.46, 0.42]],
      screen: [[2.33, 1.2], [2.06, 1.9]], side: [1.2, 2.02, 1.2, 1.84] },
    comms_van: 'van',
    camper: { L: 4.6, W: 1.85, wb: 2.6, wr: 0.33, clr: 0.28, head: [0.92, 2.28], tail: [0.95, -2.3], box: true, belt: 1.15, pop: true,
      top: [[-2.28, 0.42], [-2.32, 1.9], [-2.2, 2.0], [1.6, 2.0], [2.02, 1.86], [2.24, 1.2], [2.32, 1.0], [2.32, 0.44]],
      screen: [[2.24, 1.2], [2.02, 1.86]], side: [-1.9, 1.95, 1.22, 1.8] },
    truck: { L: 7.6, W: 2.4, wb: 5.6, wr: 0.5, clr: 0.4, head: [1.0, 3.78], tail: [1.0, -3.8], box: true, belt: 1.45, truck: true,
      top: [[1.5, 0.6], [1.5, 2.85], [1.62, 2.95], [3.55, 2.95], [3.72, 2.7], [3.8, 1.45], [3.82, 0.6]],
      screen: [[3.8, 1.5], [3.72, 2.6]], side: [2.6, 3.55, 1.55, 2.5] },
  };
  function carBody(C, arch = true) {
    const s = new THREE.Shape(), yb = C.clr, wf = C.wb / 2, R = C.wr + 0.08, a = Math.asin(U.clamp((C.wr - yb) / R, -0.99, 0.99));
    const x0 = C.top[0][0], x1 = C.top[C.top.length - 1][0];
    s.moveTo(x0, yb); for (const p of C.top) s.lineTo(p[0], p[1]); s.lineTo(x1, yb);
    for (const cx of [wf, -wf]) if (arch && cx - R > x0 && cx + R < x1) { s.lineTo(cx + R * Math.cos(a), yb); s.absarc(cx, C.wr, R, -a, Math.PI + a, false); }
    s.lineTo(x0, yb);
    return s;
  }
  const poly = pts => { const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) s.lineTo(p[0], p[1]); return s; };
  function glassQuad(K, m, a, b, w, x = 0) { // a,b = [z,y] ends of a sloped pane across the car's width
    const dz = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dz, dy), th = Math.atan2(dz, dy);
    K.plane(m, w, L, x, (a[1] + b[1]) / 2 - Math.sin(th) * 0.015, (a[0] + b[0]) / 2 + Math.cos(th) * 0.015, { rx: th });
  }
  function carFn(kind) {
    return (K, o, r) => {
      let C = CARS[kind]; if (typeof C === 'string') C = CARS[C];
      const W = C.W, L = C.L, wreck = !!(o.wrecked || o.burnt), PAL = [0xe8e8e4, 0xb8bcc0, 0x2a3e5c, 0x6a1f22, 0x8a7a5a, 0x2a2c2e, 0x4a5a3a, 0x9a5a2a];
      const c = o.color ?? (kind === 'police' || kind === 'comms_van' ? 0xf2f2f0 : kind === 'camper' ? 0x6a8a8a : PAL[r() * PAL.length | 0]);
      const paint = o.burnt ? mat('rust', { color: 0x6a605a }) : wreck ? mat('metal_painted', { color: c }) : col(c, { rough: 0.28, metal: 0.45 });
      const glassM = o.burnt ? col(0x080706, { rough: 0.95 }) : o.interior ? glass(0.18, 0x6a7a80) : wreck ? col(0x0a0c0e, { rough: 0.6, metal: 0.2 }) : col(0x0c1116, { rough: 0.04, metal: 0.7 });
      const trimM = o.burnt ? col(0x151210, { rough: 0.95 }) : col(0x17181a, { rough: 0.55 }), lift = o.burnt ? -C.wr * 0.38 : o.wrecked ? -0.05 : 0;
      const tilt = wreck ? [(r() - 0.5) * 0.05, (r() - 0.5) * 0.06] : [0, 0];
      const on = !!o.lights && !o.burnt;
      K.at(0, lift, 0, 0, () => {
        const T = C.truck;
        const bw = W - 0.08, body = new THREE.ExtrudeGeometry(carBody(C), { depth: bw, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2, curveSegments: 10, steps: wreck ? 5 : 1 });
        body.translate(0, 0, -bw / 2); body.rotateY(-Math.PI / 2);
        if (wreck) { const p = body.attributes.position; for (let i = 0; i < p.count; i++) { const d = Math.sin(p.getX(i) * 3.1 + p.getZ(i) * 1.7) * Math.sin(p.getY(i) * 4 + p.getZ(i) * 2.3); if (d > 0.4) p.setX(i, p.getX(i) * (1 - (d - 0.4) * 0.06)); } body.computeVertexNormals(); }
        const bg = K.geo(C.pop ? col(0xffffff, { rough: 0.35, metal: 0.3 }) : paint, body, { rx: tilt[0], rz: tilt[1] });
        if (C.pop) { const cc = bg.attributes.color.array, pp = bg.attributes.position.array, lo = new THREE.Color(c), hi = new THREE.Color(0xeee8d8); for (let i = 0; i < pp.length; i += 3) { const q = pp[i + 1] > C.belt ? hi : lo; cc[i] *= q.r; cc[i + 1] *= q.g; cc[i + 2] *= q.b; } }
        if (C.cab) {
          const cab = new THREE.ExtrudeGeometry(poly(C.cab), { depth: W * 0.8, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 2 });
          cab.translate(0, 0, -W * 0.4); cab.rotateY(-Math.PI / 2); K.geo(glassM, cab, { rx: tilt[0], rz: tilt[1], ao: false });
          const [, [rz0, ry], [rz1]] = C.cab;
          K.box(paint, W * 0.8 + 0.12, 0.05, rz1 - rz0 + 0.1, 0, ry + 0.02, (rz0 + rz1) / 2, { r: 0.025, rx: tilt[0], rz: tilt[1] });
          const [b0, b1] = [C.cab[0], C.cab[3]], mz = (b0[0] + b1[0]) / 2 - 0.1;
          for (const s of [-1, 1]) {
            const px = s * (W * 0.4 + 0.05);
            K.box(paint, 0.05, ry - C.belt + 0.04, 0.09, px, C.belt - 0.02, mz, { rx: tilt[0], rz: tilt[1] });
            K.tube(paint, [[px, b1[1], b1[0] + 0.02], [px, ry + 0.02, C.cab[2][0]]], 0.035, { rs: 5, seg: 4 });
            K.tube(paint, [[px, b0[1], b0[0] - 0.02], [px, ry + 0.02, C.cab[1][0]]], 0.04, { rs: 5, seg: 4 });
            K.box(trimM, 0.1, 0.07, 0.12, s * (W / 2 + 0.02), C.belt + 0.02, b1[0] - 0.12, { r: 0.02 });
            for (const z of [b1[0] - 0.05, mz - 0.02, b0[0] + 0.12]) K.box(trimM, 0.01, C.belt - 0.4, 0.01, s * (W / 2 + 0.002), 0.38, z, { ao: false });
            for (const z of [mz + 0.35, b0[0] + 0.45]) K.box(chrome(), 0.02, 0.025, 0.13, s * (W / 2 + 0.01), C.belt - 0.12, z);
          }
        }
        if (C.box) {
          glassQuad(K, glassM, C.screen[0], C.screen[1], W * 0.84);
          const [z0, z1, y0, y1] = C.side;
          for (const s of [-1, 1]) K.plane(glassM, z1 - z0, y1 - y0, s * (W / 2 + 0.012), (y0 + y1) / 2, (z0 + z1) / 2, { ry: s * Math.PI / 2 });
          if (T) {
            K.box(col(0xe8e6e0, { rough: 0.6 }), W + 0.1, 2.9, 5.4, 0, 0.95, -1.2, { r: 0.03 });
            K.box(trimM, 0.9, 0.25, 7.0, 0, 0.45, 0);
          }
          if (C.pop) K.box(col(0xeee8d8, { rough: 0.5 }), W * 0.86, 0.32, 2.4, 0, 2.02, -0.4, { r: 0.05 });
          if (!T) {
            const bz = C.top[0][0];
            for (const s of [-1, 1]) {
              for (const z of [C.side[0] - 0.04, C.side[0] - 1.0, bz + 0.9]) K.box(trimM, 0.012, C.side[3] - 0.45, 0.012, s * (W / 2 + 0.003), 0.42, z, { ao: false });
              K.box(trimM, 0.03, 0.08, L - 0.9, s * (W / 2 + 0.01), 0.62, 0.1, { r: 0.01 }); K.box(chrome(), 0.02, 0.03, 0.14, s * (W / 2 + 0.012), 1.02, C.side[0] - 0.2);
            }
            K.box(trimM, 0.012, 1.5, 0.012, 0, 0.42, bz - 0.022, { ao: false });
            for (const s of [-1, 1]) K.plane(glassM, W * 0.36, 0.5, s * W * 0.21, 1.55, bz - 0.03, { ry: Math.PI });
          }
          for (const s of [-1, 1]) K.box(trimM, 0.09, 0.12, 0.12, s * (W / 2 + 0.05), C.side[3] - 0.25, C.side[1] - 0.05, { r: 0.02 });
        }
        if (C.tray) {
          const [t0, t1, ty] = C.tray, alu2 = col(0xc8ccd0, { rough: 0.4, metal: 0.8 });
          K.box(alu2, W + 0.06, 0.06, t1 - t0, 0, ty - 0.06, (t0 + t1) / 2); K.box(trimM, 0.18, 0.28, t1 - t0, 0.5, ty - 0.34, (t0 + t1) / 2); K.box(trimM, 0.18, 0.28, t1 - t0, -0.5, ty - 0.34, (t0 + t1) / 2);
          for (const s of [-1, 1]) K.box(alu2, 0.04, 0.3, t1 - t0, s * (W / 2 + 0.01), ty, (t0 + t1) / 2);
          K.box(alu2, W + 0.06, 0.3, 0.04, 0, ty, t0); K.box(alu2, W + 0.06, 0.62, 0.05, 0, ty, t1 - 0.02);
          for (let i = 0; i < 5; i++) K.box(alu2, 0.04, 0.62, 0.04, -W / 2 + 0.05 + i * (W - 0.1) / 4, ty, t1 - 0.02);
        }
        // underbody (hides the view through the arches), bumpers, grille, plates, lamps
        K.box(trimM, W - 0.55, 0.22, L * 0.72, 0, C.clr - 0.06, T ? 0.8 : 0);
        const fz = C.head[1], rz = C.tail[1];
        K.box(trimM, W + 0.04, 0.22, 0.14, 0, 0.3 + (T ? 0.2 : 0), fz + 0.02, { r: 0.05 }); K.box(trimM, W + 0.04, 0.2, 0.14, 0, 0.3 + (T ? 0.2 : 0), T ? -3.8 : rz - 0.02, { r: 0.05 });
        K.box(trimM, W * 0.42, 0.12, 0.05, 0, C.head[0] - 0.12, fz + 0.03, { r: 0.02 });
        K.plane(lab(Tex.sign('plate', o.plate || ['425 KDL', '071 QLD', '118 BNE', '630 RDC'][r() * 4 | 0])), 0.37, 0.14, 0, 0.44 + (T ? 0.2 : 0), fz + 0.1);
        K.plane(lab(Tex.sign('plate', o.plate || '511 MTB')), 0.37, 0.14, 0, 0.62, (T ? -3.8 : rz) - 0.1, { ry: Math.PI });
        const hm = on ? glowMat(0xfff2d8, 6) : o.burnt ? trimM : col(0xd8e0e6, { rough: 0.06, metal: 0.5 }), tm = on ? glowMat(0xff1a10, 3) : o.burnt ? trimM : col(0x6a0c0c, { rough: 0.2 });
        for (const s of [-1, 1]) {
          K.box(hm, 0.3, 0.1, 0.07, s * (W / 2 - 0.28), C.head[0], fz - 0.02, { r: 0.025, name: on ? 'lights' : undefined });
          K.box(tm, 0.26, 0.12, 0.06, s * (W / 2 - 0.2), C.tail[0], (T ? -3.8 : rz) - 0.02, { r: 0.02, name: on ? 'lights' : undefined });
        }
        const ax = W / 2 - 0.13;
        for (const s of [-1, 1]) { wheel(K, s * ax, C.wb / 2, C.wr, { flat: o.wrecked && s > 0, burnt: o.burnt }); wheel(K, s * ax, -C.wb / 2, C.wr, { flat: o.wrecked && s < 0, burnt: o.burnt, w: T ? 0.44 : 0.22 }); }
        if (kind === 'police') {
          for (const s of [-1, 1]) K.plane(lab(Tex.sign('police'), { rough: 0.4 }), 2.6, 0.26, s * (W / 2 + 0.004), 0.6, 0.1, { ry: s * Math.PI / 2 });
          const bar = o.lights ? [glowMat(0xff2020, 4), glowMat(0x2040ff, 4)] : [col(0x801010, { rough: 0.2 }), col(0x102080, { rough: 0.2 })];
          K.box(dark(), 1.1, 0.06, 0.28, 0, 1.46, -0.3); K.box(bar[0], 0.5, 0.09, 0.24, -0.27, 1.52, -0.3, { r: 0.03 }); K.box(bar[1], 0.5, 0.09, 0.24, 0.27, 1.52, -0.3, { r: 0.03 });
        }
        if (kind === 'comms_van') {
          for (const s of [-1, 1]) K.plane(lab(Tex.sign('comms', 'MOBILE UNIT'), { rough: 0.5 }), 2.4, 0.9, s * (W / 2 + 0.006), 1.35, -0.6, { ry: s * Math.PI / 2 });
          K.box(dark(), 1.3, 0.06, 0.3, 0, 2.05, 1.2); K.box(on ? glowMat(0xffa010, 4) : col(0xa06010, { rough: 0.2 }), 1.2, 0.1, 0.24, 0, 2.11, 1.2, { r: 0.03 });
          for (const s of [-1, 1]) K.cyl(col(0xd8d8d0, { rough: 0.5 }), 0.18, 0.06, 0.3, s * 0.45, 2.2, 0.2, { rx: Math.PI / 2 - 0.2, seg: 12, open: true });
          K.cyl(dark(), 0.008, 0.012, 1.4, -0.7, 2.03, -1.8);
          K.box(mat('metal_painted', { color: 0x3a4a34 }), W - 0.2, 0.15, 3.0, 0, 2.03, -0.9);
        }
        if (o.interior && C.cab) {
          const seat = mat('fabric', { color: 0x2c2c30 }), dash = col(0x1c1d20, { rough: 0.7 });
          for (const s of [-1, 1]) { K.box(seat, 0.5, 0.18, 0.5, s * 0.38, 0.38, 0.1, { r: 0.05 }); K.box(seat, 0.48, 0.62, 0.14, s * 0.38, 0.5, -0.18, { r: 0.05, rx: -0.2 }); K.box(seat, 0.24, 0.16, 0.1, s * 0.38, 1.12, -0.26, { r: 0.04 }); }
          K.box(seat, W - 0.3, 0.2, 0.55, 0, 0.36, -0.95, { r: 0.05 }); K.box(seat, W - 0.3, 0.55, 0.14, 0, 0.5, -1.22, { r: 0.05, rx: -0.18 });
          K.box(dash, W - 0.14, 0.3, 0.5, 0, 0.72, 0.85, { r: 0.06 }); K.box(dash, 0.2, 0.34, 0.6, 0, 0.3, 0.5, { r: 0.04 });
          K.geo(dash, new THREE.TorusGeometry(0.19, 0.02, 6, 20), { x: -0.38, y: 0.92, z: 0.58, rx: 0.35 });
          K.plane(glowMat(0xffa860, 0.8), 0.3, 0.08, -0.38, 0.98, 0.62, { rx: -0.6 });
          for (const s of [-1, 1]) K.box(col(0x3a3a3e, { rough: 0.8 }), 0.04, C.belt - 0.35, L * 0.6, s * (W / 2 - 0.08), 0.35, 0);
          K.box(dark(), W - 0.2, 0.02, L * 0.62, 0, 0.3, 0);
          K.plane(col(0xb8b2a8, { rough: 0.95 }), W * 0.8, C.cab[2][0] - C.cab[1][0] + 0.3, 0, C.cab[1][1] - 0.03, (C.cab[1][0] + C.cab[2][0]) / 2, { rx: Math.PI / 2 });
        }
      });
      K.col(-W / 2 - 0.05, 0, -L / 2, W / 2 + 0.05, C.box ? 2.0 : 1.45, L / 2, { sight: true, cam: true });
    };
  }
  for (const k of Object.keys(CARS)) P('car_' + k, `car (see Build.car) — ${k}`, carFn(k), {
    after(g, o) {
      let C = CARS[k]; if (typeof C === 'string') C = CARS[C];
      if (o.lights && !o.burnt) {
        for (const s of [-1, 1]) { glow({ pos: [s * (C.W / 2 - 0.28), C.head[0], C.head[1] + 0.05], color: 0xfff0d0, size: 0.9, parent: g }); glow({ pos: [s * (C.W / 2 - 0.2), C.tail[0], (C.truck ? -3.8 : C.tail[1]) - 0.05], color: 0xff2010, size: 0.5, opacity: 0.7, parent: g }); }
        const sp = pool({ pos: [0, 0.01, C.head[1] + 5.5], r: 3, color: 0xfff0d8, opacity: 0.4, parent: g, dynamic: true }); sp.scale.set(1.1, 1, 2.2);
        if (o.beams) for (const s of [-1, 1]) beam({ pos: [s * (C.W / 2 - 0.28), C.head[0], C.head[1] + 0.05], dir: [s * 0.04, -0.03, 1], len: 12, r: 1.4, color: 0xfff0d0, opacity: 0.05, parent: g });
        if (o.lights === 'spot') g.userData.spot = light('spot', { pos: [0, C.head[0] + 0.1, C.head[1] + 0.2], target: [0, 0, C.head[1] + 14], color: 0xfff0d8, intensity: 60, distance: 40, angle: 0.55, penumbra: 0.6, parent: g });
      }
      if (o.burnt) decal('scorch', { floor: true, w: C.W * 1.8, h: C.L * 1.2, pos: [0, 0.01, 0], parent: g, opacity: 0.8, dynamic: o.dynamic });
    },
  });

  // streetlights -----------------------------------------------------------------------------------------
  P('streetlight', 'street/esplanade/bridge light {kind (variant): road (galvanised pole, cobra head) | heritage (black lantern post) | bridge (double arm), on=true, color=0xffa640 (sodium), h, light (real point light, counts to the budget), pool=true (fake light pool), beam (fake cone in fog)}', (K, o) => {
    const v = o.variant || 'road', on = o.on !== false, c = o.color ?? 0xffa640, lens = on ? glowMat(c, 6) : col(0x6a6a60, { rough: 0.3 });
    const galv = mat('metal', { color: 0xd0d2cc, metal: 0.35, rough: 1.5 }), black = col(0x1d2124, { rough: 0.5, metal: 0.3 });
    if (v === 'heritage') {
      const h = o.h ?? 4.2;
      K.lathe(black, [[0, 0], [0.16, 0], [0.16, 0.08], [0.1, 0.14], [0.1, 0.5], [0.07, 0.6], [0.05, 0.62]], 0, 0, 0, { seg: 12 });
      K.cyl(black, 0.045, 0.06, h - 0.6, 0, 0.6, 0, { seg: 10 });
      K.lathe(black, [[0.05, 0], [0.18, 0.08], [0.2, 0.12], [0.02, 0.14]], 0, h, 0, { seg: 8 });
      K.cyl(lens, 0.15, 0.1, 0.4, 0, h + 0.1, 0, { seg: 8 }); for (let i = 0; i < 4; i++) K.box(black, 0.02, 0.42, 0.02, Math.cos(i * 1.57 + 0.78) * 0.15, h + 0.1, Math.sin(i * 1.57 + 0.78) * 0.15);
      K.lathe(black, [[0.2, 0], [0.18, 0.05], [0.05, 0.22], [0.02, 0.32], [0, 0.34]], 0, h + 0.5, 0, { seg: 8 });
      K.col(-0.16, 0, -0.16, 0.16, h, 0.16, { sight: false, cam: false });
      o._lamp = [[0, h + 0.3, 0]];
    } else {
      const h = o.h ?? (v === 'bridge' ? 7 : 8.5), arm = v === 'bridge' ? 1.4 : 2.0, arms = v === 'bridge' ? [1, -1] : [1];
      K.cyl(galv, 0.07, 0.13, h, 0, 0, 0, { seg: 12 }); K.box(mat('concrete'), 0.4, 0.12, 0.4, 0, 0, 0, { r: 0.02 });
      o._lamp = [];
      for (const s of arms) {
        K.tube(galv, [[0, h - 0.4, 0], [0, h + 0.05, s * 0.3], [0, h + 0.22, s * arm * 0.7], [0, h + 0.25, s * arm]], 0.045, { rs: 6 });
        K.box(col(0x9a9c98, { rough: 0.4, metal: 0.5 }), 0.3, 0.14, 0.65, 0, h + 0.14, s * (arm + 0.22), { r: 0.06 });
        K.box(lens, 0.22, 0.03, 0.46, 0, h + 0.12, s * (arm + 0.24), { r: 0.012 });
        o._lamp.push([0, h + 0.08, s * (arm + 0.24)]);
      }
      K.col(-0.13, 0, -0.13, 0.13, h, 0.13, { sight: false, cam: false });
    }
  }, {
    after(g, o) {
      const on = o.on !== false, c = o.color ?? 0xffa640;
      if (!on) return;
      for (const p of o._lamp) {
        glow({ pos: [p[0], p[1] - 0.05, p[2]], color: c, size: o.variant === 'heritage' ? 1.4 : 2.2, opacity: 0.9, parent: g });
        if (o.pool !== false) pool({ pos: [p[0], 0, p[2]], r: o.variant === 'heritage' ? 3.2 : 5.5, color: c, opacity: 0.35, parent: g, dynamic: o.dynamic });
        if (o.beam) beam({ pos: [p[0], p[1] - 0.05, p[2]], dir: [0, -1, 0], len: p[1], r: p[1] * 0.55, color: c, opacity: 0.06, parent: g });
        if (o.light) light('point', { pos: [p[0], p[1] - 0.4, p[2]], color: c, intensity: o.light === true ? 40 : o.light, distance: 18, parent: g });
      }
    },
  });

  // roads --------------------------------------------------------------------------------------------
  const paintMat = () => mat('paint', { alphaTest: 0.5, color: 0xe4e2da });
  function roadFn(o = {}) {
    const [ax, az] = o.from || [-20, 0], [bx, bz] = o.to || [20, 0], L = Math.hypot(bx - ax, bz - az), w = o.width ?? 7, y = o.y ?? 0;
    const g = group({ pos: [(ax + bx) / 2, y, (az + bz) / 2], yaw: Math.atan2(bx - ax, bz - az), parent: o.parent });
    box(w, 0.1, L, o.mat || mat('asphalt'), { parent: g, pos: [0, -0.1, 0], ao: false, walk: true, sight: false, cam: true, dynamic: o.dynamic });
    const K = kit(12), pm = paintMat();
    if (o.lines !== 'none') {
      const dash = (x) => { for (let z = -L / 2 + 1; z < L / 2 - 3; z += 9) K.box(pm, 0.1, 0.004, 3, x, 0.001, z + 1.5, { ao: false }); };
      if (o.lines === 'double') { K.box(pm, 0.1, 0.004, L, -0.12, 0.001, 0, { ao: false }); K.box(pm, 0.1, 0.004, L, 0.12, 0.001, 0, { ao: false }); }
      else dash(0);
    }
    if (o.edge !== false) for (const s of [-1, 1]) K.box(pm, 0.08, 0.004, L, s * (w / 2 - 0.35), 0.001, 0, { ao: false });
    finish(K, g, { ...o, shadow: false });
    if (o.kerb !== false) for (const s of [-1, 1]) {
      box(0.18, 0.15, L, mat('concrete', { color: 0xc8c4bc }), { parent: g, pos: [s * (w / 2 + 0.09), -0.1, 0], bevel: 0.03, ao: false, walk: true, sight: false, cam: false, dynamic: o.dynamic });
      const pw = o.path ?? 2.4;
      if (pw > 0) box(pw, 0.15, L, o.pathMat || mat('concrete', { color: 0xb8b4ac }), { parent: g, pos: [s * (w / 2 + 0.18 + pw / 2), -0.1, 0], ao: false, walk: true, sight: false, cam: false, dynamic: o.dynamic });
    }
    return g;
  }
  function markingFn(kind, o = {}) {
    const K = kit(13), pm = paintMat(), w = o.w ?? 3.5;
    if (kind === 'arrow') { const s = new THREE.Shape(); s.moveTo(-0.15, 0); s.lineTo(0.15, 0); s.lineTo(0.15, -3); s.lineTo(0.45, -3); s.lineTo(0, -4.5); s.lineTo(-0.45, -3); s.lineTo(-0.15, -3); s.lineTo(-0.15, 0); K.add(new THREE.ShapeGeometry(s).rotateX(-Math.PI / 2), pm, { y: 0.004, ao: false }); }
    else if (kind === 'stop_line') K.box(pm, w, 0.004, 0.45, 0, 0.001, 0, { ao: false });
    else if (kind === 'give_way') { for (let x = -w / 2 + 0.3; x < w / 2; x += 0.9) K.box(pm, 0.6, 0.004, 0.3, x, 0.001, 0, { ao: false }); }
    else if (kind === 'zebra') { const len = o.len ?? 4; for (let x = -w / 2 + 0.3; x < w / 2; x += 1.0) K.box(pm, 0.5, 0.004, len, x, 0.001, 0, { ao: false }); }
    else if (kind === 'text') K.plane(lab(Tex.text(o.text || 'SLOW', { w: 256, h: 512, color: '#e6e4dc' }), { alpha: true, rough: 0.6 }), 1.0, 2.4, 0, 0.004, 0, { rx: -Math.PI / 2 });
    const g = group({ pos: o.pos, yaw: o.yaw, parent: o.parent }); finish(K, g, { ...o, shadow: false }); return g;
  }
  function powerLineFn(o = {}) {
    const pts = o.points || [[0, 0], [30, 0]], h = o.h ?? 9, g = group({ parent: o.parent }), heads = [];
    pts.forEach((p, i) => {
      const nx = pts[Math.min(i + 1, pts.length - 1)], pv = pts[Math.max(i - 1, 0)], yaw = Math.atan2(nx[0] - pv[0], nx[1] - pv[1]);
      const pole = prop('power_pole', { pos: [p[0], groundY(p[0], p[1]), p[1]], yaw, h, parent: g, lamp: o.lamp && i % 2 === 0, dynamic: o.dynamic });
      pole.updateWorldMatrix(true, false);
      heads.push([-0.9, 0, 0.9].slice(0, o.wires ?? 3).map(x => pole.localToWorld(new THREE.Vector3(x, h - 0.35, 0)).sub(A.origin).toArray()));
    });
    for (let i = 0; i < heads.length - 1; i++) for (let k = 0; k < heads[i].length; k++) wire(heads[i][k], heads[i + 1][k], { sag: 0.5 + k * 0.05, parent: g });
    return g;
  }

  // phone store -----------------------------------------------------------------------------------------
  P('store_counter', 'phone-store sales counter: white carcass, yellow "yes" front (+Z = customer side), POS monitor facing staff (-Z), EFTPOS, receipt printer, phone boxes {w=2.4}. userData.monitor (screen mesh)', (K, o, r) => {
    const w = o.w ?? 2.4, d = 0.72, h = 1.0, lam = mat('laminate');
    K.box(dark(), w - 0.1, 0.1, d - 0.12, 0, 0, -0.03);
    K.box(lam, w, h - 0.14, d, 0, 0.1, 0, { r: 0.012 });
    K.box(col(YEL, { rough: 0.38 }), w - 0.06, 0.6, 0.02, 0, 0.24, d / 2 + 0.008, { r: 0.006 });
    K.plane(lab(Tex.sign('logo'), { alpha: true, rough: 0.4 }), 0.5, 0.25, -w / 2 + 0.4, 0.58, d / 2 + 0.02);
    K.box(mat('laminate', { color: 0xc9ccd0, rough: 0.7 }), w + 0.04, 0.04, d + 0.06, 0, h - 0.04, 0.01, { r: 0.012 });
    K.at(-w * 0.22, h, -0.12, Math.PI, () => { const d2 = col(0x18191b, { rough: 0.4 }); K.box(d2, 0.22, 0.012, 0.16, 0, 0, 0, { r: 0.005 }); K.box(d2, 0.04, 0.2, 0.03, 0, 0.012, -0.03); K.box(d2, 0.52, 0.33, 0.03, 0, 0.14, 0, { r: 0.008 }); K.plane(scr(Tex.screen('monitor'), 1.05), 0.49, 0.3, 0, 0.305, 0.0155, { name: 'monitor' }); });
    K.at(w * 0.18, h, 0.2, 0.25, () => eftpos(K));
    K.box(col(0xe4e4e2, { rough: 0.5 }), 0.15, 0.12, 0.19, w * 0.37, h, -0.16, { r: 0.02 }); K.plane(col(0xfafaf8, { rough: 0.9 }), 0.08, 0.12, w * 0.37, h + 0.16, -0.08, { rx: 0.4 });
    K.cyl(col(0x2a2c30, { rough: 0.4 }), 0.035, 0.03, 0.1, -w * 0.43, h, 0.1, { seg: 10 });
    for (let i = 0; i < 3; i++) K.cyl(col([0x1d3fa8, 0x111111, 0xc21d24][i]), 0.004, 0.004, 0.14, -w * 0.43 + (i - 1) * 0.012, h + 0.02, 0.1, { rz: (i - 1) * 0.2, seg: 5 });
    const pb = lab(Tex.sign('phone_box'), { rough: 0.5 });
    for (let i = 0; i < 3; i++) K.box(pb, 0.095, 0.05, 0.175, -w * 0.05 + i * 0.03, h + i * 0.05, -0.2 + (r() - 0.5) * 0.04, { ry: (r() - 0.5) * 0.3, uv: 'unit' });
    K.col(-w / 2, 0, -d / 2, w / 2, h, d / 2);
  });
  P('demo_table', 'store demo table: pale timber top on white slab legs, glowing demo phones on acrylic stands with security cables and price tents {w=1.8, phones=6, screen (Tex.screen kind | Texture, default demo)}. userData.screens (meshes), userData.setScreens(kind|Texture|null) — P.3 switches them all to "feed"', (K, o) => {
    const w = o.w ?? 1.8, d = 0.9, h = 0.9, lam = mat('laminate');
    K.box(mat('wood', { color: 0xf2dfc4, rough: 0.9 }), w, 0.05, d, 0, h - 0.05, 0, { r: 0.018 });
    for (const s of [-1, 1]) K.box(lam, 0.07, h - 0.05, d - 0.14, s * (w / 2 - 0.16), 0, 0, { r: 0.01 });
    K.box(lam, w - 0.38, 0.1, 0.04, 0, h - 0.18, 0);
    const n = o.phones ?? 6, per = Math.ceil(n / 2), tex = typeof o.screen === 'string' ? Tex.screen(o.screen) : o.screen || Tex.screen('demo');
    for (let i = 0; i < n; i++) { const side = i < per ? 1 : -1, j = i % per; K.at(-w / 2 + (j + 0.5) * w / per, h, side * (d / 2 - 0.2), side > 0 ? 0 : Math.PI, () => demoPhone(K, tex)); }
    K.col(-w / 2, 0, -d / 2, w / 2, h, d / 2);
  }, { after(g) { g.userData.setScreens = t => setScreen(g.userData.screens, t); } });
  P('phone', 'a smartphone lying flat, screen up {screen: Tex.screen kind | Texture | null (off), cracked, k (glow)}. userData.screen, userData.setScreen(kind|Texture|null)', (K, o) => {
    K.box(col(0x121315, { rough: 0.3, metal: 0.4 }), 0.074, 0.008, 0.152, 0, 0, 0, { r: 0.0035 });
    const t = o.screen === undefined ? 'lock' : o.screen;
    K.plane(t ? scr(typeof t === 'string' ? Tex.screen(t) : t, o.k ?? 1.2) : offMat(), 0.068, 0.144, 0, 0.0083, 0, { rx: -Math.PI / 2, name: 'screen' });
    if (o.cracked) K.plane(lab(Tex.decal('crack'), { alpha: true }), 0.08, 0.08, 0.01, 0.0087, -0.03, { rx: -Math.PI / 2 });
  }, { solid: false, blob: false, after(g, o) { g.userData.setScreen = (t, k) => setScreen(g.userData.screen, t, k ?? o.k ?? 1.2); } });
  P('phone_box', 'a retail phone box (sealed) lying flat', K => K.box(lab(Tex.sign('phone_box'), { rough: 0.5 }), 0.095, 0.05, 0.175, 0, 0, 0, { uv: 'unit' }), { solid: false, blob: false });
  P('queue_post', 'single chrome stanchion with a retractable belt head {h=0.95}', (K, o) => stanchion(K, 0, 0, o.h), { blob: false, col: { sight: false, cam: false } });
  P('queue_barrier', 'retractable-belt queue line: stanchions at `points` [[x,z],…] (prop-local) joined by belts {points, color=0xffcf12}', (K, o) => {
    const pts = o.points || [[0, 0], [2, 0]], belt = col(o.color ?? YEL, { rough: 0.6 });
    pts.forEach(p => stanchion(K, p[0], p[1]));
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az), yaw = Math.atan2(bx - ax, bz - az);
      K.box(belt, 0.004, 0.05, L - 0.06, (ax + bx) / 2, 0.86, (az + bz) / 2, { ry: yaw, ao: false });
      K.col(Math.min(ax, bx) - 0.05, 0, Math.min(az, bz) - 0.05, Math.max(ax, bx) + 0.05, 0.95, Math.max(az, bz) + 0.05, { sight: false, cam: false });
    }
  }, { blob: false });
  P('whiteboard', 'marker whiteboard {text ("\\n" lines; prefix "r:" red, "b:" blue, "g:" green), w=1.5, h=0.95, stand=true (mobile A-frame) | false (wall-mounted; pos = bottom centre of the board)}. userData.board, userData.setText(text)', (K, o) => {
    const w = o.w ?? 1.5, h = o.h ?? 0.95, y = o.stand === false ? 0 : 0.85, a = alu();
    K.box(col(0xf4f4f2, { rough: 0.3 }), w, h, 0.02, 0, y, 0);
    K.plane(lab(Tex.sign('whiteboard', o.text ?? 'b:LAUNCH NIGHT\nCHASE 299\nLUKE 187'), { rough: 0.22 }), w - 0.02, h - 0.02, 0, y + h / 2, 0.0105, { name: 'board' });
    for (const [bw, bh, x, yy] of [[w + 0.04, 0.025, 0, y - 0.0125], [w + 0.04, 0.025, 0, y + h - 0.0125], [0.025, h, -w / 2 - 0.0125, y], [0.025, h, w / 2 + 0.0125, y]]) K.box(a, bw, bh, 0.03, x, yy, 0);
    K.box(a, w * 0.5, 0.015, 0.07, 0, y - 0.03, 0.035);
    for (let i = 0; i < 3; i++) K.cyl(col([0x1d3fa8, 0x111111, 0xc21d24][i], { rough: 0.4 }), 0.008, 0.008, 0.13, -0.1 + i * 0.05 + 0.065, y - 0.007, 0.04, { rz: Math.PI / 2, seg: 6 });
    if (o.stand !== false) for (const s of [-1, 1]) {
      K.cyl(a, 0.016, 0.016, y + h + 0.08, s * (w / 2 + 0.05), 0.08, 0, { seg: 8 }); K.box(a, 0.04, 0.03, 0.6, s * (w / 2 + 0.05), 0.06, 0, { r: 0.01 });
      for (const z of [-0.28, 0.28]) K.cyl(dark(), 0.03, 0.03, 0.03, s * (w / 2 + 0.05) + 0.015, 0.03, z, { rz: Math.PI / 2, seg: 10 });
    }
  }, { after(g) { g.userData.setText = t => { g.userData.board.material = lab(Tex.sign('whiteboard', t), { rough: 0.22 }); }; }, blob: true });
  P('promo_banner', 'hanging vinyl promo banner {text="MIDNIGHT LAUNCH — BE FIRST", w=3, h=w/4, drop=0.4 (cords up to the ceiling)}; pos = bottom centre of the banner', (K, o) => {
    const w = o.w ?? 3, h = o.h ?? w / 4, drop = o.drop ?? 0.4;
    for (const back of [false, true]) {
      const g = new THREE.PlaneGeometry(w, h, 16, 1), p = g.attributes.position;
      for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 2.1) * 0.02 + (back ? -0.003 : 0));
      if (back) g.rotateY(Math.PI);
      g.computeVertexNormals();
      K.add(g, back ? col(0x10222f, { rough: 0.7 }) : lab(Tex.sign('banner', o.text ?? 'MIDNIGHT LAUNCH — BE FIRST'), { rough: 0.55 }), { y: h / 2, uv: 'unit', ao: false });
    }
    for (const s of [-1, 1]) K.cyl(col(0x222222), 0.004, 0.004, drop, s * (w / 2 - 0.05), h, 0, { seg: 4 });
  }, { solid: false, blob: false });
  P('wall_display', 'wall of boxed phones: laminate back panel with a backlit "yes" header, glass shelves stocked with phone boxes {w=2.4, h=2.3, lit=true}; stands against a wall, pos = bottom centre of its back', (K, o, r) => {
    const w = o.w ?? 2.4, h = o.h ?? 2.3, lam = mat('laminate'), pb = lab(Tex.sign('phone_box'), { rough: 0.5 }), gl = glass(0.35, 0xdfeef0);
    K.box(lam, w, h, 0.06, 0, 0, 0.03, { r: 0.008 });
    K.box(dark(), w, 0.3, 0.05, 0, h - 0.36, 0.085);
    K.plane(lab(Tex.sign('shopfront', 'LATEST PHONES'), { lit: o.lit === false ? 0 : 0.75, rough: 0.35 }), w - 0.04, 0.26, 0, h - 0.21, 0.111);
    K.box(dark(), w, 0.12, 0.36, 0, 0, 0.24);
    for (const y of [0.45, 0.8, 1.15, 1.5]) {
      K.box(gl, w - 0.1, 0.012, 0.3, 0, y, 0.21);
      for (const s of [-1, 1]) K.box(alu(), 0.02, 0.05, 0.28, s * (w / 2 - 0.1), y - 0.05, 0.2);
      const n = Math.floor((w - 0.24) / 0.12);
      for (let i = 0; i < n; i++) if (r() < 0.9) K.box(pb, 0.095, 0.17, 0.05, -w / 2 + 0.17 + i * 0.12, y + 0.012, 0.24 + (r() - 0.5) * 0.02, { ry: (r() - 0.5) * 0.08, uv: 'unit' });
    }
    K.col(-w / 2, 0, 0, w / 2, h, 0.42);
  });
  function doorFn(kind) {
    return (K, o) => {
      const w = o.w ?? (kind === 'front' ? 0.87 : 0.82), h = o.h ?? 2.04, t = o.thick ?? 0.15, trim = TRIM();
      K.box(trim, 0.045, h + 0.045, t + 0.02, -w / 2 - 0.0225, 0, 0); K.box(trim, 0.045, h + 0.045, t + 0.02, w / 2 + 0.0225, 0, 0); K.box(trim, w + 0.09, 0.045, t + 0.02, 0, h, 0);
      const D = K.sub('door', { x: -w / 2 + 0.004, ry: -(o.open ?? 0) * 1.7 }), lw = w - 0.008, lz = kind === 'front' ? t / 2 - 0.03 : 0;
      if (kind === 'front') {
        const tim = mat('wood', { color: o.color ?? 0x7a5236, rough: 0.8 }), gw = lw * 0.5, gy = 0.95, gh = 0.8;
        D.box(tim, lw, gy, 0.045, lw / 2, 0, lz); D.box(tim, lw, h - 0.01 - gy - gh, 0.045, lw / 2, gy + gh, lz);
        D.box(tim, (lw - gw) / 2, gh, 0.045, (lw - gw) / 4, gy, lz); D.box(tim, (lw - gw) / 2, gh, 0.045, lw - (lw - gw) / 4, gy, lz);
        D.box(col(0xe6ecef, { rough: 0.9, transparent: true, opacity: 0.72 }), gw, gh, 0.012, lw / 2, gy, lz, { name: 'glass', ao: false });
        for (const y of [0.25, 0.6]) D.box(tim, lw * 0.7, 0.2, 0.012, lw / 2, y, lz + 0.027, { ao: false });
        D.box(col(0xb89a50, { rough: 0.3, metal: 0.9 }), 0.03, 0.18, 0.02, lw - 0.07, 0.95, lz + 0.03, { r: 0.008 }); D.cyl(col(0xb89a50, { rough: 0.3, metal: 0.9 }), 0.012, 0.012, 0.12, lw - 0.07, 1.0, lz + 0.05, { rz: Math.PI / 2, seg: 8 });
      } else {
        const pnt = col(kind === 'office' ? 0x5a6068 : 0xf0ede6, { rough: 0.55 });
        D.box(pnt, lw, h - 0.01, 0.04, lw / 2, 0, lz, { r: 0.004 });
        D.box(chrome(), 0.02, 0.02, 0.14, lw - 0.08, 1.0, lz + 0.03); D.box(chrome(), 0.12, 0.02, 0.02, lw - 0.13, 1.0, lz + 0.09);
        if (kind === 'office') {
          D.plane(lab(Tex.sign('door', o.text || 'STAFF ONLY')), 0.3, 0.11, lw / 2, 1.55, lz + 0.021);
          D.box(mat('metal', { rough: 0.8 }), lw - 0.04, 0.25, 0.004, lw / 2, 0.02, lz + 0.021, { ao: false });
          D.box(dark(), 0.35, 0.04, 0.04, lw - 0.3, h - 0.12, lz + 0.04);
        }
      }
    };
  }
  P('office_door', 'back-office door in a frame: grey leaf, STAFF ONLY plate, kick plate, closer {w=0.82, h=2.04, thick (wall)=0.15, open 0..1, text}. Sits in a Build.wall door opening. userData.door (pivot), userData.setOpen(0..1)', doorFn('office'), { after: doorAfter, blob: false, solid: false });
  P('interior_door', 'painted interior door in a frame {w=0.82, open, thick}. userData.door, userData.setOpen', doorFn('interior'), { after: doorAfter, blob: false, solid: false });
  P('front_door', 'timber front door with a frosted-glass panel (the neighbour\'s silhouette shows through it) {w=0.87, open, color, thick}. userData.door, userData.glass (hide it to "shatter"; add Build.scatter("glass")), userData.setOpen', doorFn('front'), { after: doorAfter, blob: false, solid: false });
  function doorAfter(g, o) {
    const w = o.w ?? 0.85, t = o.thick ?? 0.15, c = colBox(g, -w / 2, 0, -t / 2, w / 2, 2.0, t / 2, { sight: true, cam: false });
    c.block = (o.open ?? 0) < 0.3; c.sight = c.block;
    g.userData.colliders = [c];
    g.userData.setOpen = v => { g.userData.door.rotation.y = -v * 1.7; c.block = c.sight = v < 0.3; };
  }
  P('shopfront', 'phone-store facade (a whole front wall): aluminium-framed glazing, central sliding doors, glowing yellow "yes" lightbox fascia, window vinyls, entry mat {w=10, h=3.6, door=2.2, text="REDCLIFFE", lit=true, open=1 (doors slid 0..1), faded 0..1 (ruined store), broken (glass smashed out)}; pos = centre of the facade base, street side = +Z. userData.doors (sliding leaves group)', (K, o, r) => {
    const w = o.w ?? 10, h = o.h ?? 3.6, dw = o.door ?? 2.2, fh = 0.9, gh = h - fh, a = alu(), gl = glass(0.16);
    K.box(col(0x2a2d31, { rough: 0.6 }), w, fh, 0.36, 0, gh, 0.04);
    K.plane(lab(Tex.sign('shopfront', o.text ?? 'REDCLIFFE', { faded: o.faded }), { lit: o.lit === false ? 0 : 1.1, rough: 0.35 }), w - 0.1, fh - 0.14, 0, gh + fh / 2, 0.222);
    K.box(a, w, 0.1, 0.08, 0, 0, 0); K.box(a, w, 0.07, 0.08, 0, gh - 0.07, 0); K.box(a, dw + 0.1, 0.06, 0.1, 0, 2.35, 0);
    const xs = [-w / 2, -dw / 2, dw / 2, w / 2], cols = [];
    for (const [x0, x1] of [[-w / 2, -dw / 2], [dw / 2, w / 2]]) {
      const n = Math.max(1, Math.round((x1 - x0) / 1.6));
      for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n; K.box(a, 0.06, gh, 0.1, x, 0, 0); cols.push(x); }
      for (let i = 0; i < n; i++) { const xa = x0 + (x1 - x0) * i / n, xb = x0 + (x1 - x0) * (i + 1) / n; if (!o.broken || r() < 0.4) K.plane(gl, xb - xa - 0.06, gh - 0.17, (xa + xb) / 2, 0.1 + (gh - 0.17) / 2, 0, { ao: false }); }
      K.col(x0, 0, -0.08, x1, gh, 0.08, { sight: false });
    }
    K.box(a, dw, 0.05, 0.1, 0, gh - 0.3, 0); if (!o.broken) K.plane(gl, dw, gh - 2.45, 0, 2.4 + (gh - 2.45) / 2, 0, { ao: false });
    const D = K.sub('doors'), sl = (o.open ?? 1) * dw * 0.42;
    for (const s of [-1, 1]) { const x = s * (dw / 4 + sl); D.box(a, dw / 2, 0.08, 0.05, x, 0.02, -0.06); D.box(a, dw / 2, 0.05, 0.05, x, 2.28, -0.06); D.box(a, 0.04, 2.3, 0.05, x - s * dw / 4, 0.02, -0.06); if (!o.broken) D.plane(gl, dw / 2 - 0.04, 2.2, x, 1.18, -0.06, { ao: false }); }
    const vin = [['promo_launch', -w / 2 + 0.9], ['promo_upgrade', w / 2 - 0.9]];
    if (!o.broken) for (const [k, x] of vin) K.plane(lab(Tex.poster(k, { worn: o.faded ? 0.7 : 0 }), { rough: 0.5, cut: true }), 0.9, 1.27, x, 1.1, -0.012, { ry: Math.PI });
    for (const [k, x] of vin) if (!o.broken) K.plane(lab(Tex.poster(k, { worn: o.faded ? 0.7 : 0 }), { rough: 0.5, cut: true }), 0.9, 1.27, x, 1.1, -0.014);
    K.plane(lab(Tex.text('MIDNIGHT LAUNCH\nTONIGHT 11PM', { w: 512, h: 128, color: '#ffffff' }), { alpha: true }), 1.4, 0.35, -dw / 2 - 0.9, 2.25, 0.012);
    K.box(col(0x202224, { rough: 0.95 }), dw + 0.6, 0.012, 1.1, 0, 0, 0.62, { ao: false });
  }, { blob: false });
  P('roller_shutter', 'security roller shutter over an opening: housing, guide rails, horizontal slats {w=3, h=2.8, open 0..1 (raised fraction), color}. userData.curtain, userData.set(open)', (K, o) => {
    const w = o.w ?? 3, h = o.h ?? 2.8, m = mat('metal_painted', { color: o.color ?? 0x9aa0a4 });
    K.box(m, w + 0.2, 0.38, 0.38, 0, h, 0.14, { r: 0.03 });
    for (const s of [-1, 1]) K.box(mat('metal', { color: 0x9a9c98 }), 0.08, h, 0.1, s * (w / 2 + 0.04), 0, 0.05);
    const C = K.sub('curtain', { y: h });
    C.box(mat('corrugated', { color: o.color ?? 0xb0b4b6, scale: 0.6 }), w, 1, 0.025, 0, -1, 0.05, { uvRot: true, ao: false });
    C.box(dark(), w, 0.06, 0.05, 0, -1.03, 0.05);
  }, {
    blob: false, solid: false,
    after(g, o) {
      const w = o.w ?? 3, h = o.h ?? 2.8, c = colBox(g, -w / 2, 0, 0, w / 2, h, 0.1, { sight: true, cam: true });
      g.userData.set = v => { const cur = g.userData.curtain, len = Math.max(0.05, h * (1 - v)); cur.scale.y = len; c.block = c.sight = v < 0.6; };
      g.userData.set(o.open ?? 0);
    },
  });
  P('security_pedestals', 'pair of anti-theft gate pedestals flanking a store entrance {w=1.6}', (K, o) => {
    const w = o.w ?? 1.6;
    for (const s of [-1, 1]) { K.box(dark(), 0.1, 0.06, 0.45, s * w / 2, 0, 0, { r: 0.02 }); K.box(glass(0.4, 0xe0f0f4), 0.03, 1.5, 0.4, s * w / 2, 0.06, 0, { r: 0.015 }); K.box(glowMat(0x7fd0ff, 0.6), 0.034, 0.02, 0.36, s * w / 2, 1.2, 0); }
    K.col(-w / 2 - 0.06, 0, -0.23, -w / 2 + 0.06, 1.56, 0.23, { sight: false }); K.col(w / 2 - 0.06, 0, -0.23, w / 2 + 0.06, 1.56, 0.23, { sight: false });
  });
  P('ceiling_light', 'ceiling fitting, pos = on the ceiling (y = ceiling height) {kind: panel (LED troffer) | tube (fluorescent batten) | pendant (house, fabric shade) | caged (bulb in a cage) | bare, on=true, color, w, light (adds a point light: true|intensity)}', (K, o) => {
    const on = o.on !== false, c = o.color ?? 0xfff4e6, v = o.kind || 'panel', lens = on ? glowMat(c, 2.2) : col(0xdadad6, { rough: 0.5 });
    if (v === 'panel') { const w = o.w ?? 1.2; K.box(alu(), w, 0.04, 0.6, 0, -0.04, 0); K.box(on ? glowMat(c, 1.1) : lens, w - 0.06, 0.012, 0.54, 0, -0.05, 0, { ao: false }); o._g = -0.12; }
    else if (v === 'tube') { const w = o.w ?? 1.2; K.box(col(0xe8e8e6, { rough: 0.5 }), w, 0.05, 0.08, 0, -0.05, 0, { r: 0.01 }); K.cyl(lens, 0.016, 0.016, w - 0.1, -w / 2 + 0.05, -0.07, 0, { rz: -Math.PI / 2, seg: 8, ao: false }); o._g = -0.1; }
    else if (v === 'pendant') { K.cyl(col(0x222222), 0.004, 0.004, 0.6, 0, -0.6, 0, { seg: 4 }); K.lathe(mat('fabric', { color: o.shade ?? 0xe8dcc4, side: THREE.DoubleSide }), [[0.13, 0], [0.18, -0.02], [0.2, -0.24], [0.21, -0.25]].map(p => [p[0], -p[1]]), 0, -0.85, 0, { seg: 18, ao: false }); K.sph(lens, 0.05, 0, -0.74, 0, { ao: false }); o._g = -0.74; }
    else { K.cyl(dark(), 0.05, 0.05, 0.08, 0, -0.08, 0); K.sph(lens, 0.055, 0, -0.14, 0, { ao: false }); if (v === 'caged') for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; K.tube(dark(), [[Math.cos(a) * 0.05, -0.08, Math.sin(a) * 0.05], [Math.cos(a) * 0.09, -0.15, Math.sin(a) * 0.09], [0, -0.23, 0]], 0.004, { rs: 3 }); } o._g = -0.14; }
  }, {
    solid: false, blob: false,
    after(g, o) {
      if (o.on === false) return;
      if (o.kind !== 'panel' && o.kind) glow({ pos: [0, o._g, 0], color: o.color ?? 0xfff4e6, size: 0.7, opacity: 0.35, parent: g });
      if (o.light) light('point', { pos: [0, o._g - 0.1, 0], color: o.color ?? 0xfff4e6, intensity: o.light === true ? 6 : o.light, distance: 9, parent: g });
    },
  });
  P('a_frame', 'footpath A-frame sign with a poster on each face {poster = Tex.poster kind (promo_launch)}', (K, o) => {
    const m = col(0x1a1c20, { rough: 0.5 }), t = lab(Tex.poster(o.poster || 'promo_launch', { worn: o.worn ?? 0 }), { rough: 0.5 });
    for (const s of [-1, 1]) { K.box(m, 0.62, 1.0, 0.03, 0, 0, s * 0.16, { rx: s * 0.16 }); K.plane(t, 0.52, 0.74, 0, 0.53, s * 0.2 + s * 0.08 * 0.5, { rx: s * 0.16, ry: s > 0 ? 0 : Math.PI }); }
  });
  // house ------------------------------------------------------------------------------------------------
  const fab = c => mat('fabric', { color: c }), timber = c => mat('wood', { color: c ?? 0xd8b890 });
  function book(K, x, y, z, r, ry = 0, lying = false) {
    const h = 0.18 + r() * 0.1, t = 0.02 + r() * 0.035, d = 0.14 + r() * 0.06, c = [0x7a2a2a, 0x2a4a6a, 0x2a5a3a, 0xc8b070, 0x5a3a6a, 0xd8d0c0, 0x1a1a1a, 0xb05a2a][r() * 8 | 0];
    if (lying) K.box(col(0xffffff, { rough: 0.8 }), h, t, d, x, y, z, { ry, tint: c, ao: false });
    else K.box(col(0xffffff, { rough: 0.8 }), t, h, d, x, y, z, { ry, rz: (r() - 0.5) * 0.06, tint: c, ao: false });
    return lying ? t : t + 0.002;
  }
  function mug(K, x, y, z, c = 0xf0ece4) { K.cyl(col(c, { rough: 0.35 }), 0.04, 0.036, 0.095, x, y, z, { seg: 12, ao: false }); K.geo(col(c, { rough: 0.35 }), new THREE.TorusGeometry(0.025, 0.007, 5, 10, Math.PI), { x: x + 0.04, y: y + 0.048, z, rz: -Math.PI / 2, ao: false }); }
  P('bed', 'bed: timber base, mattress, rumpled draped duvet, pillows, upholstered headboard {w=1.07 (king single; 1.53 queen), l=2.03, color (duvet)=0xb8a8d8, messy=true, toy (plush bunny)}; head end at -Z', (K, o, r) => {
    const w = o.w ?? 1.07, l = o.l ?? 2.03, fr = timber(0xe0c8a8);
    K.box(fr, w + 0.05, 0.2, l + 0.05, 0, 0.12, 0, { r: 0.02 });
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) K.box(fr, 0.06, 0.12, 0.06, x * (w / 2 - 0.02), 0, z * (l / 2 - 0.02));
    K.box(fab(0xf2efe8), w, 0.2, l, 0, 0.32, 0, { r: 0.06 });
    K.box(fab(o.head ?? 0x5e5e6e), w + 0.12, 0.72, 0.08, 0, 0.3, -l / 2 - 0.06, { r: 0.04 });
    const dg = new THREE.PlaneGeometry(w + 0.62, l * 0.74, 18, 18), p = dg.attributes.position; dg.rotateX(-Math.PI / 2);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), dx = Math.abs(x) - w / 2 - 0.02, m = o.messy === false ? 0.3 : 1;
      let y = (Math.sin(x * 9 + z * 4) * Math.sin(z * 6.5 + x * 2) * 0.025 + Math.sin(z * 3 + 1) * 0.02) * m;
      if (dx > 0) { y -= Math.min(dx * 1.6, 0.27); p.setX(i, Math.sign(x) * (w / 2 + 0.03 + dx * 0.12)); }
      const dz = z - l * 0.37; if (dz > -0.02) y -= Math.min(Math.max(dz + 0.02, 0) * 1.6, 0.27);
      p.setY(i, y + 0.05);
    }
    dg.computeVertexNormals();
    K.geo(mat('fabric', { color: o.color ?? 0xb8a8d8, side: THREE.DoubleSide }), dg, { y: 0.52, z: l * 0.13, ao: false });
    K.box(fab(0xf6f3ee), w + 0.04, 0.05, 0.3, 0, 0.51, -l / 2 + 0.72, { r: 0.02, rx: 0.05 });
    const np = o.pillows ?? (w > 1.2 ? 2 : 1);
    for (let i = 0; i < np; i++) K.box(fab(0xfaf8f4), np > 1 ? w / 2 - 0.08 : w - 0.3, 0.14, 0.4, np > 1 ? (i - 0.5) * (w / 2) : 0, 0.5, -l / 2 + 0.28, { r: 0.065, ry: (r() - 0.5) * 0.15, rz: (r() - 0.5) * 0.08 });
    if (o.toy) { const pk = fab(0xe8d8e0); K.sph(pk, 0.09, w / 2 - 0.25, 0.63, -l / 2 + 0.55, { s: [1, 1.1, 0.9] }); K.sph(pk, 0.065, w / 2 - 0.25, 0.77, -l / 2 + 0.55); for (const s of [-1, 1]) K.sph(pk, 0.025, w / 2 - 0.25 + s * 0.03, 0.87, -l / 2 + 0.55, { s: [0.6, 2.2, 0.6] }); }
    K.col(-w / 2 - 0.05, 0, -l / 2 - 0.1, w / 2 + 0.05, 0.55, l / 2);
  });
  P('school_bag', 'slumped school backpack with front pocket, straps and a keyring {color=0x2a4a7a}', (K, o) => {
    const c = o.color ?? 0x2a4a7a, m = fab(c), m2 = fab(new THREE.Color(c).multiplyScalar(0.7).getHex());
    K.box(m, 0.32, 0.42, 0.17, 0, 0, 0, { r: 0.07, rx: -0.12 });
    K.box(m2, 0.25, 0.2, 0.06, 0, 0.04, 0.1, { r: 0.04, rx: -0.12 });
    for (const s of [-1, 1]) K.tube(m2, [[s * 0.08, 0.38, -0.09], [s * 0.1, 0.25, -0.16], [s * 0.1, 0.05, -0.13]], 0.018, { rs: 4 });
    K.tube(m2, [[-0.05, 0.4, -0.02], [0, 0.46, -0.03], [0.05, 0.4, -0.02]], 0.01, { rs: 4 });
    K.sph(col(0xff5a8a, { rough: 0.4 }), 0.025, 0.08, 0.22, 0.14);
  }, { solid: false });
  P('desk', 'desk {kind: study (timber, drawer pedestal, lamp, books, closed laptop) | office (grey laminate on steel legs, monitor, keyboard, paper trays), w=1.2, d=0.6, clutter=true}', (K, o, r) => {
    const w = o.w ?? 1.2, d = o.d ?? 0.6, h = 0.74, off = o.kind === 'office', top = off ? mat('laminate', { color: 0xb8b8b4 }) : timber(0xc8a070);
    K.box(top, w, 0.03, d, 0, h - 0.03, 0, { r: 0.006 });
    if (off) { for (const s of [-1, 1]) { K.box(dark(), 0.05, h - 0.03, 0.05, s * (w / 2 - 0.05), 0, 0); K.box(dark(), 0.05, 0.04, d - 0.05, s * (w / 2 - 0.05), 0, 0); } K.box(col(0x9a9c9e, { rough: 0.6, metal: 0.4 }), w - 0.15, 0.35, 0.015, 0, h - 0.4, -d / 2 + 0.04); }
    else {
      K.box(top, 0.4, h - 0.03, d - 0.02, w / 2 - 0.2, 0, 0);
      for (let i = 0; i < 3; i++) { K.box(timber(0xb89060), 0.37, 0.2, 0.012, w / 2 - 0.2, 0.05 + i * 0.22, d / 2 - 0.004); K.box(chrome(), 0.1, 0.012, 0.02, w / 2 - 0.2, 0.17 + i * 0.22, d / 2 + 0.008); }
      K.box(top, 0.03, h - 0.03, d - 0.02, -w / 2 + 0.015, 0, 0); K.box(top, w - 0.4, 0.3, 0.015, -0.2, h - 0.33, -d / 2 + 0.01);
    }
    if (o.clutter !== false) {
      if (off) { K.at(-0.1, h, -0.1, 0, () => monitor(K, Tex.screen('off'))); K.box(col(0x222326, { rough: 0.5 }), 0.44, 0.02, 0.14, -0.1, h, 0.14, { r: 0.006 }); K.box(col(0x222326, { rough: 0.4 }), 0.06, 0.02, 0.1, 0.22, h, 0.15, { r: 0.01 }); for (let i = 0; i < 3; i++) K.box(col(0xf4f4f0, { rough: 0.9 }), 0.22, 0.004, 0.3, w / 2 - 0.2, h + i * 0.012, -0.05, { ry: (r() - 0.5) * 0.3, ao: false }); }
      else {
        K.box(col(0x9ea2a6, { rough: 0.35, metal: 0.7 }), 0.33, 0.018, 0.23, -0.12, h, 0.02, { r: 0.006, ry: 0.1 });
        let y = h; for (let i = 0; i < 4; i++) y += book(K, w / 2 - 0.2, y, -0.12, r, (r() - 0.5) * 0.4, true);
        K.cyl(col(0x4a7a9a, { rough: 0.4 }), 0.035, 0.032, 0.1, -w / 2 + 0.12, h, -0.18, { seg: 10 });
        K.cyl(dark(), 0.07, 0.075, 0.02, -w / 2 + 0.2, h, 0.05, { seg: 12 }); K.tube(dark(), [[-w / 2 + 0.2, h + 0.02, 0.05], [-w / 2 + 0.2, h + 0.3, 0.0], [-w / 2 + 0.3, h + 0.42, 0.05]], 0.008, { rs: 4 }); K.cyl(col(0xe8c040, { rough: 0.4 }), 0.03, 0.07, 0.1, -w / 2 + 0.3, h + 0.34, 0.07, { open: true, seg: 12, rz: 0.6 });
        mug(K, 0.1, h, 0.15, 0xe86a5a);
        for (let i = 0; i < 3; i++) K.box(col([0xfff27a, 0xff9ad0, 0x9ae0ff][i], { rough: 0.9 }), 0.07, 0.002, 0.07, -0.3 + i * 0.09, h, 0.2, { ry: (r() - 0.5) * 0.4, ao: false });
      }
    }
    K.col(-w / 2, 0, -d / 2, w / 2, h, d / 2);
  });
  P('wardrobe', 'freestanding wardrobe with two doors, handles and cornice {w=1.2, h=2.0, d=0.6, color, mirror}', (K, o) => {
    const w = o.w ?? 1.2, h = o.h ?? 2.0, d = o.d ?? 0.6, m = o.color ? mat('laminate', { color: o.color }) : timber(0xc8a880);
    K.box(m, w, h, d, 0, 0.06, 0, { r: 0.008 }); K.box(dark(), w - 0.04, 0.06, d - 0.04, 0, 0, 0); K.box(m, w + 0.04, 0.05, d + 0.04, 0, h + 0.06, 0, { r: 0.01 });
    K.box(dark(), 0.006, h - 0.06, 0.004, 0, 0.09, d / 2 + 0.001, { ao: false });
    for (const s of [-1, 1]) K.box(chrome(), 0.015, 0.2, 0.025, s * 0.05, 1.0, d / 2 + 0.012);
    if (o.mirror) K.plane(col(0xd8e0e4, { rough: 0.03, metal: 1 }), w / 2 - 0.12, h - 0.4, w / 4, h / 2 + 0.06, d / 2 + 0.002);
  });
  P('couch', 'three-seat couch: plump seat and back cushions, arms, timber feet, throw pillows and a draped throw {w=2.1, color=0x6a7280, kind: fabric | leather, pillows=2}', (K, o, r) => {
    const w = o.w ?? 2.1, d = 0.92, up = mat(o.kind === 'leather' ? 'leather' : 'fabric', { color: o.color ?? 0x6a7280 });
    K.box(up, w, 0.22, d, 0, 0.1, 0, { r: 0.04 });
    for (const s of [-1, 1]) { K.box(up, 0.2, 0.45, d, s * (w / 2 - 0.1), 0.1, 0, { r: 0.08 }); for (const z of [-1, 1]) K.cyl(timber(0x6a4a30), 0.025, 0.02, 0.1, s * (w / 2 - 0.08), 0, z * (d / 2 - 0.08), { seg: 8 }); }
    K.box(up, w - 0.4, 0.5, 0.2, 0, 0.3, -d / 2 + 0.1, { r: 0.08, rx: -0.1 });
    const n = Math.max(1, Math.round((w - 0.4) / 0.6)), cw = (w - 0.4) / n;
    for (let i = 0; i < n; i++) { const x = -w / 2 + 0.2 + (i + 0.5) * cw; K.box(up, cw - 0.015, 0.16, d - 0.24, x, 0.31, 0.1, { r: 0.07 }); K.box(up, cw - 0.03, 0.44, 0.18, x, 0.44, -d / 2 + 0.25, { r: 0.08, rx: -0.2 }); }
    const pc = [0xd8a860, 0xc85a4a, 0x4a7a8a];
    for (let i = 0; i < (o.pillows ?? 2); i++) K.box(fab(pc[i % 3]), 0.4, 0.4, 0.13, (i ? 1 : -1) * (w / 2 - 0.42), 0.5, -d / 2 + 0.38, { r: 0.07, rx: -0.35, rz: (i ? -1 : 1) * 0.25 });
    if (o.throw !== false) { const tg = new THREE.PlaneGeometry(0.55, 1.1, 6, 12), p = tg.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setZ(i, Math.max(0, y) * -0.6 + Math.sin(p.getX(i) * 12) * 0.01); p.setY(i, y < 0 ? y : y * 0.5); } tg.computeVertexNormals(); K.geo(mat('knit', { color: 0xd8cfc0, side: THREE.DoubleSide }), tg, { x: w / 2 - 0.1, y: 0.6, z: 0.1, ry: Math.PI / 2, rx: 0.2, ao: false }); }
    K.col(-w / 2, 0, -d / 2, w / 2, 0.8, d / 2);
  });
  P('armchair', 'single armchair matching the couch {color, kind}', (K, o) => {
    const w = 0.9, d = 0.9, up = mat(o.kind === 'leather' ? 'leather' : 'fabric', { color: o.color ?? 0x7a6a5a });
    K.box(up, w, 0.22, d, 0, 0.1, 0, { r: 0.04 });
    for (const s of [-1, 1]) { K.box(up, 0.18, 0.44, d, s * (w / 2 - 0.09), 0.1, 0, { r: 0.08 }); for (const z of [-1, 1]) K.cyl(timber(0x6a4a30), 0.025, 0.02, 0.1, s * (w / 2 - 0.08), 0, z * (d / 2 - 0.08), { seg: 8 }); }
    K.box(up, w - 0.36, 0.52, 0.2, 0, 0.3, -d / 2 + 0.1, { r: 0.08, rx: -0.1 }); K.box(up, w - 0.37, 0.16, d - 0.24, 0, 0.31, 0.1, { r: 0.07 });
  });
  P('coffee_table', 'timber coffee table with a lower shelf, magazines, remote and mug; breakable {w=1.1, d=0.6}. userData.break() swaps to the smashed version (split top, splayed legs, debris) and drops its collider', (K, o, r) => {
    const w = o.w ?? 1.1, d = o.d ?? 0.6, h = 0.42, tm = timber(0x8a6040), I = K.sub('intact'), B = K.sub('broken', { visible: false });
    I.box(tm, w, 0.04, d, 0, h - 0.04, 0, { r: 0.01 }); I.box(tm, w - 0.1, 0.02, d - 0.1, 0, 0.12, 0);
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) I.box(tm, 0.045, h - 0.04, 0.045, x * (w / 2 - 0.05), 0, z * (d / 2 - 0.05));
    I.box(col(0xe8e4dc, { rough: 0.8 }), 0.22, 0.012, 0.29, -0.2, 0.14, 0.02, { ry: 0.2, ao: false }); I.box(col(0x3a6a9a, { rough: 0.7 }), 0.22, 0.01, 0.29, -0.15, 0.152, 0.0, { ry: -0.1, ao: false });
    I.box(col(0x1a1a1a, { rough: 0.4 }), 0.05, 0.02, 0.18, 0.28, h, 0.05, { ry: 0.4, r: 0.01 }); mugIn(I, -0.3, h, -0.1);
    for (const s of [-1, 1]) B.box(tm, w / 2, 0.04, d, s * w / 4, 0.02, 0, { rz: s * 0.45, r: 0.01 });
    for (let i = 0; i < 4; i++) B.box(tm, 0.045, h - 0.04, 0.045, (r() - 0.5) * w, 0.03, (r() - 0.5) * d, { rz: 1.4 + r() * 0.2, ry: r() * 3 });
    for (let i = 0; i < 12; i++) B.box(tm, 0.02 + r() * 0.08, 0.015, 0.01 + r() * 0.04, (r() - 0.5) * w * 1.4, 0, (r() - 0.5) * d * 1.4, { ry: r() * 3, ao: false });
    B.box(col(0xe8e4dc, { rough: 0.8 }), 0.22, 0.012, 0.29, 0.3, 0, 0.3, { ry: 0.9, ao: false });
  }, {
    solid: false,
    after(g, o) {
      const w = o.w ?? 1.1, d = o.d ?? 0.6, c = colBox(g, -w / 2, 0, -d / 2, w / 2, 0.42, d / 2);
      g.userData.break = () => { g.userData.intact.visible = false; g.userData.broken.visible = true; c.block = false; };
    },
  });
  function mugIn(K, x, y, z) { mug(K, x, y, z); }
  P('tv', 'flat-screen TV on feet {w=1.2 (screen width), screen: Tex.screen kind | Texture | null (off; default), unit=true (low timber TV cabinet), light (a soft screen-glow point light, on while the screen shows something)}. userData.screen, userData.setScreen(kind|Texture|null)', (K, o) => {
    const w = o.w ?? 1.2, sh = w * 0.5625, uh = o.unit === false ? 0 : 0.5;
    if (uh) {
      const tm = timber(0x5a4030);
      K.box(tm, w + 0.5, uh - 0.06, 0.42, 0, 0.06, 0, { r: 0.01 }); K.box(dark(), w + 0.45, 0.06, 0.38, 0, 0, 0);
      for (const s of [-1, 1]) K.box(timber(0x4a3426), (w + 0.5) / 2 - 0.02, uh - 0.12, 0.01, s * (w + 0.5) / 4, 0.09, 0.212);
      K.box(col(0x1a1b1d, { rough: 0.35 }), 0.36, 0.06, 0.26, w * 0.3, uh, 0.02, { r: 0.008 }); K.plane(glowMat(0x2aff6a, 1.2), 0.03, 0.008, w * 0.3 + 0.14, uh + 0.03, 0.151);
      K.box(col(0x1a1b1d, { rough: 0.4 }), 0.26, 0.05, 0.2, -w * 0.3, uh, 0.05, { r: 0.02 });
    }
    K.box(col(0x121314, { rough: 0.3, metal: 0.3 }), 0.34, 0.012, 0.18, 0, uh, -0.02, { r: 0.004 }); K.box(col(0x121314, { rough: 0.3 }), 0.06, 0.1, 0.03, 0, uh, -0.03);
    K.box(col(0x0c0c0d, { rough: 0.2, metal: 0.4 }), w + 0.03, sh + 0.03, 0.045, 0, uh + 0.08, -0.03, { r: 0.008 });
    const t = o.screen ?? null;
    K.plane(t ? scr(typeof t === 'string' ? Tex.screen(t) : t, 1.1) : offMat(), w, sh, 0, uh + 0.08 + 0.015 + sh / 2, -0.007, { name: 'screen' });
    K.col(-(w + 0.5) / 2, 0, -0.21, (w + 0.5) / 2, uh + 0.1, 0.21);
  }, {
    after(g, o) {
      const w = o.w ?? 1.2, uh = o.unit === false ? 0 : 0.5;
      if (o.light) g.userData.light = light('point', { pos: [0, uh + w * 0.3, 0.6], color: 0x6aa0ff, intensity: o.screen ? (o.light === true ? 1.2 : o.light) : 0, distance: 6, parent: g });
      g.userData.setScreen = t => { setScreen(g.userData.screen, t, 1.1); if (g.userData.light) g.userData.light.intensity = t ? (o.light === true ? 1.2 : o.light) : 0; };
    },
  });
  P('kitchen_bench', 'kitchen run: base cupboards and drawers, laminate benchtop, tiled splashback, sink with mixer, cooktop, optional wall cupboards and range hood, everyday clutter {w=3, sink (x offset | false), cooktop (x offset | false), uppers=true, clutter=true, color (doors)}; back against the wall at -Z', (K, o, r) => {
    const w = o.w ?? 3, d = 0.62, h = 0.9, door = mat('laminate', { color: o.color ?? 0xe8e4da }), topM = mat('laminate', { color: 0x8a8278, rough: 0.6 });
    K.box(dark(), w - 0.04, 0.12, d - 0.1, 0, 0, -0.04); K.box(door, w, h - 0.16, d - 0.04, 0, 0.12, -0.02);
    const n = Math.max(1, Math.round(w / 0.6)), cw = w / n;
    for (let i = 0; i < n; i++) { const x = -w / 2 + (i + 0.5) * cw; K.box(dark(), 0.006, h - 0.18, 0.004, x + cw / 2, 0.13, d / 2 - 0.02, { ao: false }); K.box(dark(), cw - 0.02, 0.006, 0.004, x, 0.72, d / 2 - 0.02, { ao: false }); K.box(chrome(), 0.14, 0.012, 0.02, x, 0.78, d / 2 - 0.005); K.box(chrome(), 0.012, 0.12, 0.02, x + cw / 2 - 0.06, 0.5, d / 2 - 0.005); }
    K.box(topM, w + 0.02, 0.035, d + 0.02, 0, h - 0.035, 0, { r: 0.006 });
    K.box(mat('tiles', { color: 0xf0ede4, scale: 0.4 }), w, 0.6, 0.012, 0, h, -d / 2 + 0.006, { ao: false });
    if (o.sink !== false) {
      const sx = o.sink ?? -w / 4;
      K.box(col(0xc8ccd0, { rough: 0.25, metal: 0.9 }), 0.7, 0.012, 0.45, sx, h + 0.001, 0, { ao: false }); K.box(col(0x6a6e72, { rough: 0.3, metal: 0.9 }), 0.4, 0.013, 0.36, sx - 0.1, h + 0.001, 0, { ao: false });
      K.cyl(chrome(), 0.02, 0.025, 0.08, sx - 0.1, h, -0.22, { seg: 8 }); K.tube(chrome(), [[sx - 0.1, h + 0.08, -0.22], [sx - 0.1, h + 0.32, -0.2], [sx - 0.1, h + 0.34, -0.08], [sx - 0.1, h + 0.28, -0.02]], 0.012, { rs: 6 });
      K.box(col(0xd8dcd8, { rough: 0.5 }), 0.3, 0.1, 0.25, sx + 0.22, h, 0.02, { ry: 0.1, r: 0.01 });
    }
    if (o.cooktop !== false) {
      const cx = o.cooktop ?? w / 4;
      K.box(col(0x0d0e10, { rough: 0.08, metal: 0.4 }), 0.58, 0.008, 0.5, cx, h, 0, { ao: false });
      for (const [x, z, rr] of [[-0.13, -0.11, 0.09], [0.13, -0.11, 0.07], [-0.13, 0.11, 0.07], [0.13, 0.11, 0.09]]) K.geo(col(0x3a3c3e, { rough: 0.5 }), new THREE.TorusGeometry(rr, 0.004, 3, 24), { x: cx + x, y: h + 0.009, z, rx: Math.PI / 2, ao: false });
      if (o.uppers !== false) { K.box(col(0xb8bcc0, { rough: 0.3, metal: 0.8 }), 0.6, 0.12, 0.5, cx, 1.62, -d / 2 + 0.25); K.box(col(0xb8bcc0, { rough: 0.3, metal: 0.8 }), 0.26, 0.5, 0.25, cx, 1.74, -d / 2 + 0.125); }
    }
    if (o.uppers !== false) {
      const um = o.cooktop === false ? null : o.cooktop ?? w / 4;
      for (let i = 0; i < n; i++) { const x = -w / 2 + (i + 0.5) * cw; if (um != null && Math.abs(x - um) < 0.35) continue; K.box(door, cw - 0.012, 0.7, 0.34, x, 1.5, -d / 2 + 0.17, { ao: false }); K.box(dark(), 0.005, 0.66, 0.004, x, 1.52, -d / 2 + 0.341, { ao: false }); K.box(chrome(), 0.012, 0.1, 0.02, x - 0.04, 1.54, -d / 2 + 0.35); K.box(chrome(), 0.012, 0.1, 0.02, x + 0.04, 1.54, -d / 2 + 0.35); }
    }
    if (o.clutter !== false) {
      K.at(w / 2 - 0.35, h, -0.12, -0.3, () => { K.cyl(col(0xd8d8d4, { rough: 0.3, metal: 0.6 }), 0.07, 0.085, 0.2, 0, 0, 0, { seg: 14 }); K.cyl(dark(), 0.1, 0.1, 0.02, 0, 0, 0, { seg: 14 }); K.box(dark(), 0.02, 0.12, 0.04, 0.09, 0.05, 0); });
      K.box(col(0xc83a2a, { rough: 0.35, metal: 0.3 }), 0.28, 0.2, 0.16, -w / 2 + 0.3, h, -0.18, { r: 0.04 });
      K.cyl(col(0xe8e0d0, { rough: 0.4 }), 0.13, 0.08, 0.08, 0.05, h, -0.1, { seg: 16 });
      for (let i = 0; i < 3; i++) K.sph(col([0xd8342a, 0xf0c030, 0x6aa030][i], { rough: 0.5 }), 0.04, 0.02 + (i - 1) * 0.05, h + 0.08, -0.1 + (i & 1) * 0.04);
      K.cyl(col(0xf6f4ee, { rough: 0.9 }), 0.055, 0.055, 0.26, -w / 2 + 0.6, h, -0.22, { seg: 12 });
    }
    K.col(-w / 2, 0, -d / 2, w / 2, h, d / 2);
  });
  P('fridge', 'fridge-freezer covered in magnets, a photo (fridge_faces) and a school report ("SEE ME") {w=0.7, h=1.75, color, photo=true, report=true}. userData.photo / userData.report meshes (for interactables: getWorldPosition)', (K, o, r) => {
    const w = o.w ?? 0.7, h = o.h ?? 1.75, d = 0.68, m = col(o.color ?? 0xeeeeea, { rough: 0.3, metal: 0.1 });
    K.box(m, w, h, d, 0, 0.02, 0, { r: 0.03 }); K.box(dark(), w - 0.02, 0.006, 0.004, 0, h * 0.62, d / 2 + 0.001, { ao: false });
    for (const [y0, hh] of [[h * 0.66, 0.35], [h * 0.3, 0.45]]) K.box(col(0xd0d0cc, { rough: 0.3, metal: 0.6 }), 0.03, hh, 0.04, -w / 2 + 0.06, y0, d / 2 + 0.02, { r: 0.012 });
    const mag = [0xd8342a, 0x2a6ad8, 0xf0c030, 0x3aa04a, 0xa04ad8];
    for (let i = 0; i < 9; i++) K.box(col(mag[i % 5], { rough: 0.4 }), 0.035, 0.035, 0.012, (r() - 0.3) * w * 0.7, h * (0.35 + r() * 0.6), d / 2 + 0.006, { r: 0.008, ao: false });
    if (o.photo !== false) K.plane(lab(Tex.photo('fridge_faces'), { rough: 0.35 }), 0.16, 0.12, 0.08, h * 0.82, d / 2 + 0.004, { rz: 0.06, name: 'photo' });
    if (o.report !== false) K.plane(lab(Tex.photo('school_report'), { rough: 0.9 }), 0.21, 0.28, 0.06, h * 0.44, d / 2 + 0.004, { rz: -0.04, name: 'report' });
    K.plane(lab(Tex.sign('hand', 'LOVE U — xx'), { rough: 0.9 }), 0.18, 0.07, -0.1, h * 0.7, d / 2 + 0.004, { rz: 0.1 });
    K.box(col(0xff6aa0, { rough: 0.4 }), 0.03, 0.03, 0.012, 0.08, h * 0.82 + 0.06, d / 2 + 0.01, { r: 0.008 }); K.box(col(0x2a6ad8, { rough: 0.4 }), 0.03, 0.03, 0.012, 0.06, h * 0.44 + 0.14, d / 2 + 0.01, { r: 0.008 });
  });
  P('oven', 'freestanding stove: oven with glass door, knobs, cooktop and a glowing digital clock {time="11:44", color}. userData.clock, userData.setTime("11:58")', (K, o) => {
    const w = 0.6, h = 0.9, d = 0.6, st = col(o.color ?? 0xc0c4c8, { rough: 0.28, metal: 0.85 });
    K.box(st, w, h, d, 0, 0, 0, { r: 0.01 }); K.box(col(0x0a0b0c, { rough: 0.05, metal: 0.4 }), w - 0.1, 0.36, 0.01, 0, 0.2, d / 2); K.box(chrome(), w - 0.14, 0.02, 0.04, 0, 0.6, d / 2 + 0.03, { r: 0.008 });
    K.box(dark(), w, 0.12, 0.06, 0, h, -d / 2 + 0.03); K.box(col(0x0d0e10, { rough: 0.08, metal: 0.4 }), w, 0.01, d - 0.06, 0, h, 0.03, { ao: false });
    for (const [x, z] of [[-0.14, -0.1], [0.14, -0.1], [-0.14, 0.13], [0.14, 0.13]]) K.geo(col(0x3a3c3e, { rough: 0.5 }), new THREE.TorusGeometry(0.075, 0.005, 3, 20), { x, y: h + 0.011, z, rx: Math.PI / 2, ao: false });
    for (let i = 0; i < 4; i++) K.cyl(dark(), 0.02, 0.02, 0.025, -0.22 + i * 0.1 + (i > 1 ? 0.06 : 0), 0.74, d / 2, { rx: Math.PI / 2, seg: 10 });
    K.box(col(0x050505, { rough: 0.2 }), 0.12, 0.05, 0.004, 0.05, 0.72, d / 2 + 0.002, { ao: false });
    K.plane(lab(Tex.text(o.time ?? '11:44', { w: 256, h: 96, color: '#5dfc8a', font: 'monospace', bg: '#050505', glow: true }), { lit: 1.6 }), 0.1, 0.035, 0.05, 0.745, d / 2 + 0.005, { name: 'clock' });
  }, { after(g) { g.userData.setTime = t => { g.userData.clock.material = lab(Tex.text(t, { w: 256, h: 96, color: '#5dfc8a', font: 'monospace', bg: '#050505', glow: true }), { lit: 1.6 }); }; } });
  P('gift_box', 'small gift box on its lid: tissue paper, a beaded "#1 DAD" lanyard and a handwritten note. userData.note / userData.lanyard meshes', (K, o, r) => {
    const bx = col(0x2a5a9a, { rough: 0.5 });
    K.box(bx, 0.16, 0.05, 0.12, 0, 0, 0, { r: 0.004 }); K.box(bx, 0.165, 0.02, 0.125, 0.12, 0, 0.06, { ry: 0.5, r: 0.004 });
    K.box(col(0xfff4f8, { rough: 0.95 }), 0.15, 0.012, 0.11, 0, 0.045, 0, { ao: false });
    const PAL = [0xff5a8a, 0xffd23a, 0x3ac8ff, 0xffffff, 0x9a5aff];
    for (let i = 0; i < 26; i++) { const a = i / 26 * 6.283; K.sph(col(PAL[i % 5], { rough: 0.3 }), 0.007, Math.cos(a) * 0.05, 0.06, Math.sin(a) * 0.035, { seg: 6, ao: false, name: 'lanyard' }); }
    K.plane(lab(Tex.text('#1 DAD', { w: 256, h: 64, color: '#1a1a1a', bg: '#fbf8ef' }), { rough: 0.8 }), 0.06, 0.015, 0, 0.068, 0, { rx: -Math.PI / 2, name: 'lanyard' });
    K.plane(lab(Tex.text('For Rep of the Year (again).\nDon\'t be a sook about it.\n— Bub', { w: 512, h: 256, color: '#2a2a6a', bg: '#fbf8ef', italic: true, weight: '500' }), { rough: 0.9 }), 0.12, 0.06, -0.14, 0.002, 0.05, { rx: -Math.PI / 2, rz: 0.2, name: 'note' });
  }, { solid: false, blob: false });
  P('photo_frame', 'framed photo {kind (Tex.photo) = baby_in_polo, w=0.3, stand (on a shelf) | wall (default: pos = centre of the frame on the wall)}. userData.photo', (K, o) => {
    const t = Tex.photo(o.kind || 'baby_in_polo'), ar = t.image.height / t.image.width, w = o.w ?? 0.3, h = w * ar, fm = o.frame ?? 0x2a1d14, y = o.stand ? h / 2 + 0.01 : 0, tilt = o.stand ? -0.15 : 0;
    const fr = timber(fm);
    K.box(fr, w + 0.05, h + 0.05, 0.02, 0, y - h / 2 - 0.025, 0, { rx: tilt, ao: false });
    K.plane(lab(t, { rough: 0.3 }), w, h, 0, y, 0.011 * Math.cos(tilt), { rx: tilt, name: 'photo' });
    if (o.stand) K.box(fr, 0.03, h * 0.9, 0.01, 0, 0, -0.08, { rx: 0.4 });
  }, { solid: false, blob: false });
  P('lamp', 'lamp {kind: floor | table | desk, on=true, color=0xffd6a0, shade, light (true|intensity: adds a warm point light)}', (K, o) => {
    const v = o.kind || 'floor', on = o.on !== false, c = o.color ?? 0xffd6a0, shade = mat('fabric', { color: o.shade ?? 0xf0e4cc, side: THREE.DoubleSide, emissive: on ? c : 0, emissiveIntensity: on ? 0.55 : 0 });
    if (v === 'floor') { K.cyl(dark(), 0.16, 0.17, 0.03, 0, 0, 0, { seg: 18 }); K.cyl(col(0xb09060, { rough: 0.3, metal: 0.8 }), 0.012, 0.012, 1.45, 0, 0.03, 0, { seg: 8 }); K.cyl(shade, 0.16, 0.22, 0.3, 0, 1.35, 0, { open: true, seg: 20, ao: false }); o._y = 1.45; }
    else if (v === 'table') { K.lathe(col(0x7a9aa0, { rough: 0.25 }), [[0, 0], [0.08, 0], [0.1, 0.1], [0.07, 0.22], [0.02, 0.26], [0.01, 0.32], [0, 0.32]], 0, 0, 0, { seg: 16 }); K.cyl(shade, 0.1, 0.15, 0.2, 0, 0.3, 0, { open: true, seg: 18, ao: false }); o._y = 0.38; }
    else { K.cyl(dark(), 0.07, 0.075, 0.02, 0, 0, 0, { seg: 12 }); K.tube(dark(), [[0, 0.02, 0], [0, 0.3, -0.05], [0.1, 0.42, 0]], 0.008, { rs: 4 }); K.cyl(col(0xe8c040, { rough: 0.4 }), 0.03, 0.07, 0.1, 0.1, 0.34, 0.02, { open: true, seg: 12, rz: 0.6 }); o._y = 0.36; }
    if (on) K.sph(glowMat(c, 3), 0.03, v === 'desk' ? 0.12 : 0, o._y, 0, { ao: false });
  }, { after(g, o) { if (o.on === false) return; glow({ pos: [o.kind === 'desk' ? 0.12 : 0, o._y, 0], color: o.color ?? 0xffd6a0, size: 0.9, opacity: 0.6, parent: g }); if (o.light) g.userData.light = light('point', { pos: [0, o._y, 0], color: o.color ?? 0xffc890, intensity: o.light === true ? 2.5 : o.light, distance: 6, parent: g }); } });
  P('rug', 'floor rug with a border {w=2, d=1.4, color=0x8a4a3a, border=0xd8c8a8}', (K, o) => {
    const w = o.w ?? 2, d = o.d ?? 1.4, b = 0.12;
    K.box(mat('carpet', { color: o.color ?? 0x8a4a3a }), w, 0.012, d, 0, 0, 0, { ao: false });
    const bm = mat('carpet', { color: o.border ?? 0xd8c8a8 });
    for (const s of [-1, 1]) { K.box(bm, w, 0.013, b * 0.5, 0, 0, s * (d / 2 - b), { ao: false }); K.box(bm, b * 0.5, 0.013, d - 2 * b, s * (w / 2 - b), 0, 0, { ao: false }); }
    K.box(bm, 0.3, 0.013, 0.3, 0, 0, 0, { ry: Math.PI / 4, ao: false });
  }, { solid: false, blob: false });
  P('bookshelf', 'bookshelf full of books, a few lying stacks and ornaments {w=0.9, h=1.8, d=0.3, fill=0.85, color}', (K, o, r) => {
    const w = o.w ?? 0.9, h = o.h ?? 1.8, d = o.d ?? 0.3, m = timber(o.color ?? 0xb08860), n = Math.max(2, Math.round(h / 0.36));
    for (const s of [-1, 1]) K.box(m, 0.02, h, d, s * (w / 2 - 0.01), 0, 0); K.box(m, w, 0.02, d, 0, h - 0.02, 0); K.box(m, w, 0.01, 0.005, 0, 0, -d / 2 + 0.0025); K.box(m, w - 0.04, h - 0.02, 0.008, 0, 0, -d / 2 + 0.004);
    for (let i = 0; i < n; i++) {
      const y = 0.04 + i * (h - 0.06) / n; K.box(m, w - 0.04, 0.02, d - 0.01, 0, y, 0);
      let x = -w / 2 + 0.03;
      while (x < w / 2 - 0.08) { if (r() > (o.fill ?? 0.85)) { x += 0.06; continue; } if (r() < 0.1) { let yy = y + 0.02; for (let k = 0; k < 3; k++) yy += book(K, x + 0.12, yy, 0, r, (r() - 0.5) * 0.3, true); x += 0.28; continue; } if (r() < 0.05) { K.lathe(col(0x6a9aa0, { rough: 0.2 }), [[0, 0], [0.04, 0], [0.05, 0.08], [0.02, 0.15], [0.025, 0.17], [0, 0.17]], x + 0.05, y + 0.02, 0, { seg: 10 }); x += 0.12; continue; } x += book(K, x + 0.015, y + 0.02, (r() - 0.5) * 0.03, r); }
    }
  });
  function chairAt(K, kind, c) {
    if (kind === 'office') { K.cyl(dark(), 0.3, 0.3, 0.02, 0, 0.06, 0, { seg: 5 }); K.cyl(chrome(), 0.025, 0.025, 0.36, 0, 0.08, 0, { seg: 8 }); K.box(fab(c ?? 0x2a2c30), 0.5, 0.08, 0.48, 0, 0.44, 0, { r: 0.03 }); K.box(fab(c ?? 0x2a2c30), 0.46, 0.5, 0.06, 0, 0.55, -0.24, { r: 0.03, rx: -0.1 }); for (let i = 0; i < 5; i++) K.sph(dark(), 0.03, Math.cos(i * 1.2566) * 0.28, 0.03, Math.sin(i * 1.2566) * 0.28); return; }
    if (kind === 'plastic') { const m = col(c ?? 0xf2f2ee, { rough: 0.5 }); for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) K.cyl(m, 0.02, 0.028, 0.44, x * 0.21, 0, z * 0.2, { rz: x * 0.08, rx: -z * 0.08, seg: 6 }); K.box(m, 0.48, 0.04, 0.44, 0, 0.42, 0, { r: 0.02 }); K.box(m, 0.46, 0.4, 0.03, 0, 0.46, -0.22, { rx: -0.15, r: 0.015 }); return; }
    if (kind === 'folding') { const m = col(c ?? 0x4a4e52, { rough: 0.5, metal: 0.5 }); for (const s of [-1, 1]) { K.box(m, 0.025, 0.85, 0.025, s * 0.2, 0, -0.18, { rx: 0.12 }); K.box(m, 0.025, 0.5, 0.025, s * 0.2, 0, 0.18, { rx: -0.3 }); } K.box(m, 0.42, 0.03, 0.38, 0, 0.44, 0); K.box(m, 0.42, 0.2, 0.02, 0, 0.65, -0.21, { rx: 0.12 }); return; }
    if (kind === 'stool') { const m = timber(c); K.cyl(m, 0.17, 0.17, 0.04, 0, 0.62, 0, { seg: 16 }); for (let i = 0; i < 4; i++) K.cyl(m, 0.018, 0.022, 0.64, Math.cos(i * 1.57 + 0.78) * 0.13, 0, Math.sin(i * 1.57 + 0.78) * 0.13, { seg: 6 }); return; }
    const m = timber(c ?? 0x8a6040);
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) K.box(m, 0.035, z < 0 ? 0.95 : 0.44, 0.035, x * 0.19, 0, z * 0.19);
    K.box(m, 0.44, 0.04, 0.44, 0, 0.44, 0, { r: 0.01 }); K.box(m, 0.4, 0.06, 0.02, 0, 0.86, -0.19); K.box(m, 0.4, 0.06, 0.02, 0, 0.66, -0.19);
  }
  P('chair', 'chair {kind: dining (timber) | office (swivel) | plastic (outdoor) | folding | stool, color}', (K, o) => chairAt(K, o.kind || 'dining', o.color));
  P('dining_table', 'timber dining table with chairs round it {w=1.6, d=0.9, chairs=4, set (plates, cutlery, glasses: a dinner that never happened), color}', (K, o, r) => {
    const w = o.w ?? 1.6, d = o.d ?? 0.9, h = 0.75, m = timber(o.color ?? 0x7a5234);
    K.box(m, w, 0.04, d, 0, h - 0.04, 0, { r: 0.008 }); K.box(m, w - 0.12, 0.08, d - 0.12, 0, h - 0.12, 0);
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) K.box(m, 0.06, h - 0.04, 0.06, x * (w / 2 - 0.06), 0, z * (d / 2 - 0.06));
    const n = o.chairs ?? 4, seats = [];
    for (let i = 0; i < n; i++) { const side = i % 2 ? 1 : -1, k = Math.floor(i / 2), per = Math.ceil(n / 2), x = -w / 2 + (k + 0.5) * w / per; seats.push([x, side * (d / 2 + 0.12), side > 0 ? Math.PI : 0]); }
    for (const [x, z, ry] of seats) K.at(x + (r() - 0.5) * 0.06, 0, z + Math.sign(z) * r() * 0.08, ry + (r() - 0.5) * 0.15, () => chairAt(K, 'dining', o.color ?? 0x7a5234));
    if (o.set) for (const [x, z] of seats) { const zz = z * 0.6; K.cyl(col(0xf4f2ec, { rough: 0.3 }), 0.13, 0.1, 0.02, x, h, zz, { seg: 20, ao: false }); K.box(chrome(), 0.015, 0.004, 0.18, x - 0.17, h, zz, { ao: false }); K.box(chrome(), 0.015, 0.004, 0.2, x + 0.17, h, zz, { ao: false }); K.cyl(glass(0.35, 0xe0eef0), 0.035, 0.03, 0.12, x + 0.15, h, zz - Math.sign(z) * 0.18, { seg: 10, ao: false }); }
    if (o.set) K.cyl(glass(0.4, 0xd8e8e0), 0.05, 0.06, 0.25, 0, h, 0, { seg: 12, ao: false });
    K.col(-w / 2, 0, -d / 2, w / 2, h, d / 2);
  });
  P('bedside_table', 'bedside table with a drawer, lamp and alarm clock {lamp=true, on (lamp), time="11:44"}', (K, o) => {
    const m = timber(0xd8c0a0); K.box(m, 0.45, 0.5, 0.38, 0, 0.05, 0, { r: 0.008 }); for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) K.box(m, 0.03, 0.05, 0.03, x * 0.2, 0, z * 0.17);
    K.box(timber(0xc8b090), 0.41, 0.14, 0.01, 0, 0.36, 0.19); K.sph(chrome(), 0.012, 0, 0.43, 0.2);
    K.box(dark(), 0.12, 0.07, 0.06, 0.12, 0.55, 0.05, { r: 0.01 }); K.plane(lab(Tex.text(o.time ?? '11:44', { w: 256, h: 96, color: '#ff4a2a', font: 'monospace', bg: '#050505', glow: true }), { lit: 1.5 }), 0.1, 0.035, 0.12, 0.585, 0.0805);
    if (o.lamp !== false) K.at(-0.08, 0.55, -0.04, 0, () => { const on = !!o.on; K.lathe(col(0xe8e0d0, { rough: 0.3 }), [[0, 0], [0.06, 0], [0.07, 0.08], [0.02, 0.16], [0.01, 0.2], [0, 0.2]], 0, 0, 0, { seg: 14 }); K.cyl(mat('fabric', { color: 0xf0e4cc, side: THREE.DoubleSide, emissive: on ? 0xffd6a0 : 0, emissiveIntensity: on ? 0.5 : 0 }), 0.08, 0.12, 0.16, 0, 0.18, 0, { open: true, seg: 16, ao: false }); });
  });
  P('ceiling_fan', 'Queensland ceiling fan, pos = on the ceiling {spin=0 (rev/s)}. userData.blades (spins by itself if spin > 0)', (K, o) => {
    K.cyl(col(0xf0f0ec, { rough: 0.5 }), 0.012, 0.012, 0.3, 0, -0.3, 0, { seg: 6 }); K.cyl(col(0xf0f0ec, { rough: 0.5 }), 0.1, 0.12, 0.1, 0, -0.4, 0, { seg: 16 });
    const B = K.sub('blades', { y: -0.36 }); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; B.box(timber(0xc8a878), 0.55, 0.008, 0.13, Math.cos(a) * 0.38, 0, -Math.sin(a) * 0.38, { ry: a, rx: 0.12, ao: false }); }
  }, { solid: false, blob: false, after(g, o) { if (o.spin) A.update(dt => { g.userData.blades.rotation.y += dt * o.spin * 6.283; }); } });
  P('window', 'window unit for a Build.wall window opening: aluminium frame, mullion, glass, inside sill, curtains on a rod {w=1.2, h=1.2, curtains=true, color (curtain), open (curtains drawn open 0..1)=0.6, broken, blind, frame=0xd8dcd8}; pos = centre of the opening BOTTOM (sill height), +Z = interior side', (K, o, r) => {
    const w = o.w ?? 1.2, h = o.h ?? 1.2, fm = col(o.frame ?? 0xd8dcd8, { rough: 0.35, metal: 0.5 }), t = 0.05;
    for (const s of [-1, 1]) K.box(fm, t, h, 0.07, s * (w / 2 - t / 2), 0, 0); K.box(fm, w, t, 0.07, 0, 0, 0); K.box(fm, w, t, 0.07, 0, h - t, 0); K.box(fm, 0.035, h - 2 * t, 0.06, 0, t, 0);
    if (!o.broken) for (const s of [-1, 1]) K.plane(glass(0.14, 0xbcd0d6), w / 2 - t, h - 2 * t, s * w / 4, h / 2, 0, { ao: false });
    else { const sh = glass(0.3, 0xbcd0d6); for (let i = 0; i < 6; i++) K.geo(sh, new THREE.ShapeGeometry(poly([[0, 0], [0.12 + r() * 0.1, 0], [r() * 0.1, 0.1 + r() * 0.25]])), { x: -w / 2 + t + (i % 2) * (w - 0.3), y: i < 2 ? t : h - t - 0.2, z: 0, rz: i < 2 ? 0 : Math.PI, ao: false }); }
    K.box(TRIM(), w + 0.1, 0.03, 0.2, 0, -0.03, 0.08);
    if (o.blind) K.box(col(0xe8e4d8, { rough: 0.8 }), w - 0.1, h * 0.45, 0.01, 0, h * 0.55 - 0.05, 0.09, { ao: false });
    if (o.curtains !== false) {
      const cm = mat('fabric', { color: o.color ?? 0xc8b89a, side: THREE.DoubleSide }), rodY = h + 0.15, op = o.open ?? 0.6; cm.userData.noshadow = true;
      K.cyl(chrome(), 0.012, 0.012, w + 0.5, w / 2 + 0.25, rodY, 0.14, { rz: Math.PI / 2, seg: 8 });
      for (const s of [-1, 1]) {
        const cw = (w / 2 + 0.25) * (1 - op * 0.7), ch = h + 0.35, g = new THREE.PlaneGeometry(cw, ch, 56, 4), p = g.attributes.position;
        const folds = 5 + op * 6;
        for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), f = (x / cw + 0.5); p.setZ(i, Math.sin(f * folds * 6.283) * 0.022 * (1 + op) * (0.8 + 0.2 * Math.sin(y * 3))); }
        g.computeVertexNormals();
        K.geo(cm, g, { x: s * (w / 2 + 0.25 - cw / 2), y: rodY - ch / 2, z: 0.15, uv: 'unit', ao: false });
      }
    }
  }, { solid: false, blob: false });
  // streets ------------------------------------------------------------------------------------------------
  const galv = () => mat('metal', { color: 0xd0d2cc, metal: 0.35, rough: 1.5 });
  P('bench', 'park bench: dark cast frame, timber slats, armrests {w=1.8, color (frame)}', (K, o) => {
    const w = o.w ?? 1.8, fr = mat('metal_painted', { color: o.color ?? 0x2a3a30 }), sl = timber(0xa07a54);
    for (const s of [-1, 1]) {
      const x = s * (w / 2 - 0.15);
      K.box(fr, 0.05, 0.44, 0.05, x, 0, 0.2); K.box(fr, 0.05, 0.85, 0.05, x, 0, -0.24, { rx: -0.08 });
      K.box(fr, 0.05, 0.05, 0.52, x, 0.4, -0.02); K.box(fr, 0.06, 0.04, 0.48, x + s * 0.03, 0.64, 0, { r: 0.015 });
    }
    for (let i = 0; i < 4; i++) K.box(sl, w, 0.03, 0.09, 0, 0.44, -0.17 + i * 0.11, { r: 0.008 });
    for (let i = 0; i < 3; i++) K.box(sl, w, 0.09, 0.03, 0, 0.55 + i * 0.12, -0.26 - i * 0.012, { rx: -0.1, r: 0.008 });
    K.col(-w / 2, 0, -0.3, w / 2, 0.5, 0.25);
  });
  P('bin', 'rubbish bin {kind: street (council litter bin) | wheelie (red lid) | recycle (yellow-lid wheelie) | skip (steel skip bin, 3 m), open (skip), color}', (K, o) => {
    const v = o.kind || 'street';
    if (v === 'street') { const m = mat('metal_painted', { color: o.color ?? 0x2e4a36 }); K.cyl(m, 0.3, 0.28, 0.85, 0, 0.05, 0, { seg: 18 }); K.cyl(dark(), 0.26, 0.26, 0.05, 0, 0, 0, { seg: 16 }); K.lathe(m, [[0.31, 0], [0.31, 0.06], [0.2, 0.2], [0.05, 0.24], [0, 0.24]], 0, 0.9, 0, { seg: 18 }); K.box(dark(), 0.26, 0.1, 0.05, 0, 0.94, 0.24, { rx: -0.5 }); return; }
    if (v === 'skip') { const m = mat('metal_painted', { color: o.color ?? 0x3a6a3a }); const s = poly([[-1.6, 0], [1.6, 0], [2.0, 1.2], [-2.0, 1.2]]); K.shape(m, s, 1.7, { rx: 0, y: 0.15 }); K.box(dark(), 0.12, 0.15, 1.6, -1.2, 0, 0); K.box(dark(), 0.12, 0.15, 1.6, 1.2, 0, 0); K.box(col(0x0b0b0b, { rough: 1 }), 3.7, 0.02, 1.6, 0, 1.3, 0, { ao: false }); return; }
    const body = col(o.color ?? 0x2e4a36, { rough: 0.55 }), lid = col(v === 'recycle' ? 0xf2c020 : 0xc8261e, { rough: 0.5 });
    K.box(body, 0.56, 0.95, 0.68, 0, 0.05, 0, { r: 0.03, s: [1, 1, 1] }); K.box(lid, 0.6, 0.05, 0.74, 0, 1.0, 0.02, { r: 0.015 }); K.cyl(dark(), 0.02, 0.02, 0.62, 0.31, 0.96, -0.36, { rz: Math.PI / 2, seg: 6 });
    for (const s of [-1, 1]) K.cyl(dark(), 0.1, 0.1, 0.05, s * 0.28 + s * 0.025, 0.1, -0.3, { rz: s * Math.PI / 2, seg: 12 });
  });
  P('bus_shelter', 'bus shelter: aluminium posts, flat roof, glass back, backlit ad panel (poster), bench, timetable and BUS STOP sign {w=3.6, poster=promo_upgrade, lit=true}', (K, o) => {
    const w = o.w ?? 3.6, d = 1.4, h = 2.5, a = alu(), gl = glass(0.2);
    for (const x of [-w / 2, w / 2]) for (const z of [-d / 2, d / 2]) K.box(a, 0.08, h, 0.08, x, 0, z);
    K.box(a, w + 0.3, 0.1, d + 0.3, 0, h, 0.05, { r: 0.02 }); K.box(col(0x3a4046, { rough: 0.5 }), w + 0.25, 0.02, d + 0.25, 0, h - 0.02, 0.05);
    K.plane(gl, w, 2.0, 0, 1.2, -d / 2, { ao: false }); K.plane(gl, w, 2.0, 0, 1.2, -d / 2, { ry: Math.PI, ao: false });
    K.box(col(0x22262a, { rough: 0.4 }), 0.12, 1.9, 1.25, w / 2 + 0.1, 0.25, 0);
    const pt = lab(Tex.poster(o.poster || 'promo_upgrade', { worn: 0 }), { lit: o.lit === false ? 0 : 1.1, rough: 0.3 });
    K.plane(pt, 1.1, 1.55, w / 2 + 0.162, 1.2, 0, { ry: Math.PI / 2 }); K.plane(pt, 1.1, 1.55, w / 2 + 0.038, 1.2, 0, { ry: -Math.PI / 2 });
    for (let i = 0; i < 3; i++) K.box(a, w * 0.6, 0.03, 0.1, -0.2, 0.46, -d / 2 + 0.12 + i * 0.12, { r: 0.01 });
    for (const x of [-w * 0.25, w * 0.1]) K.box(a, 0.05, 0.46, 0.3, x, 0, -d / 2 + 0.22);
    K.plane(lab(Tex.text('ROUTE 680\nREDCLIFFE — CITY\nEvery 30 min', { w: 256, h: 256, color: '#111', bg: '#f4f4ee' })), 0.3, 0.3, -w / 2 + 0.4, 1.5, -d / 2 + 0.01);
    K.cyl(galv(), 0.035, 0.035, 2.6, -w / 2 - 0.5, 0, d / 2 + 0.2); K.plane(lab(Tex.text('BUS\nSTOP', { w: 256, h: 256, color: '#fff', bg: '#1d5aa8' })), 0.4, 0.4, -w / 2 - 0.5, 2.4, d / 2 + 0.24);
    K.col(-w / 2 - 0.05, 0, -d / 2 - 0.05, w / 2 + 0.16, h, -d / 2 + 0.05, { sight: false }); K.col(w / 2 - 0.05, 0, -d / 2, w / 2 + 0.16, h, d / 2);
  });
  P('jetty', 'timber jetty on piles running along +Z from pos (the landward end), railings, heritage lamp posts {length=40, width=3.2, deck=2.4 (deck top above pos), pile=4 (depth below pos), lamps=5, on=true (lamps lit)}', (K, o, r) => {
    const L = o.length ?? 40, W = o.width ?? 3.2, D = o.deck ?? 2.4, pd = o.pile ?? 4, pm = mat('wood', { color: 0x6a5a48, rough: 1.1 }), rail = timber(0x9a8a74);
    K.box(mat('planks', { color: 0xc0b8a8 }), W, 0.08, L, 0, D - 0.08, L / 2, { uvRot: true, ao: false });
    for (let z = 1.5; z < L; z += 3) {
      K.box(pm, W + 0.3, 0.2, 0.2, 0, D - 0.3, z);
      for (const s of [-1, 1]) K.cyl(pm, 0.15, 0.17, D + pd - 0.1, s * (W / 2 - 0.1), -pd, z, { seg: 10, ao: false });
      K.box(pm, 0.08, 0.08, 3.2, -W / 2 + 0.1, D - 1.4, z, { rx: 0.55, ao: false });
    }
    for (const s of [-1, 1]) {
      for (let z = 0.1; z <= L; z += 1.6) K.box(rail, 0.09, 1.05, 0.09, s * (W / 2 - 0.05), D, z);
      K.box(rail, 0.14, 0.06, L, s * (W / 2 - 0.05), D + 1.05, L / 2, { r: 0.015 }); K.box(rail, 0.05, 0.08, L, s * (W / 2 - 0.05), D + 0.5, L / 2);
      K.col(s * W / 2 - 0.08, D, 0, s * W / 2 + 0.08, D + 1.1, L, { sight: false, cam: false });
    }
    K.col(-W / 2, D - 0.6, 0, W / 2, D, L, { walk: true, sight: false, cam: false });
  }, {
    blob: false,
    after(g, o) { const L = o.length ?? 40, W = o.width ?? 3.2, D = o.deck ?? 2.4, n = o.lamps ?? 5; for (let i = 0; i < n; i++) prop('streetlight', { variant: 'heritage', pos: [(i & 1 ? 1 : -1) * (W / 2 - 0.05), D + 0.02, 4 + i * (L - 6) / Math.max(1, n - 1)], on: o.on, parent: g, pool: false, dynamic: o.dynamic }); },
  });
  P('fence', 'fence running along +X from pos {kind: paling (timber, default) | colorbond (steel sheet) | picket (white) | chainlink | pool (black aluminium) | post_rail (rural), length=5, h, color, broken (paling gaps)}', (K, o, r) => {
    const L = o.length ?? 5, v = o.kind || 'paling', h = o.h ?? { picket: 0.95, pool: 1.2, chainlink: 1.8, post_rail: 1.1 }[v] ?? 1.8, bay = v === 'colorbond' ? 2.36 : 2.4, nb = Math.max(1, Math.round(L / bay)), bw = L / nb;
    if (v === 'paling') {
      const pst = mat('wood', { color: 0x7a6a58, rough: 1.1 }), pal = mat('planks', { color: o.color ?? 0xb0a28a, scale: 1.1 });
      for (let i = 0; i <= nb; i++) K.box(pst, 0.1, h + 0.05, 0.1, i * bw, 0, -0.08);
      for (const y of [0.3, h - 0.3]) K.box(pst, L, 0.1, 0.05, L / 2, y, -0.055);
      if (o.broken) { for (let x = 0.05; x < L; x += 0.105) if (r() > 0.18) K.box(pal, 0.095, h - r() * 0.3 * (r() < 0.2 ? 1 : 0), 0.018, x, 0.02, -0.02, { rz: (r() - 0.5) * 0.04 }); }
      else K.box(pal, L, h, 0.02, L / 2, 0.02, -0.02);
    } else if (v === 'colorbond') {
      const m = mat('corrugated', { color: o.color ?? 0x6a7266, metal: 0.3, scale: 1 });
      for (let i = 0; i <= nb; i++) K.box(m, 0.05, h + 0.02, 0.05, i * bw, 0, 0); K.box(m, L, h, 0.02, L / 2, 0, 0); K.box(m, L, 0.05, 0.06, L / 2, h, 0, { r: 0.01 });
    } else if (v === 'picket') {
      const m = col(o.color ?? 0xf2f0ea, { rough: 0.6 });
      for (let i = 0; i <= nb; i++) K.box(m, 0.09, h + 0.1, 0.09, i * bw, 0, -0.06);
      for (const y of [0.2, h - 0.25]) K.box(m, L, 0.07, 0.035, L / 2, y, -0.03);
      const pk = poly([[-0.035, 0], [0.035, 0], [0.035, h - 0.05], [0, h], [-0.035, h - 0.05]]);
      for (let x = 0.08; x < L; x += 0.13) K.shape(m, pk, 0.018, { x, y: 0.05 });
    } else if (v === 'chainlink') {
      const m = galv();
      for (let i = 0; i <= nb; i++) K.cyl(m, 0.03, 0.03, h + 0.05, i * bw, 0, 0, { seg: 8 });
      K.cyl(m, 0.022, 0.022, L, L, h, 0, { rz: Math.PI / 2, seg: 6 });
      K.plane(mat('chainlink', { side: THREE.DoubleSide, alphaTest: 0.5 }), L, h - 0.05, L / 2, (h - 0.05) / 2 + 0.03, 0, { uv: [L / 0.3, (h - 0.05) / 0.3] });
    } else if (v === 'pool') {
      const m = mat('metal_painted', { color: 0x1a1c1e });
      for (let i = 0; i <= nb; i++) K.box(m, 0.05, h, 0.05, i * bw, 0, 0);
      for (const y of [0.08, h - 0.08]) K.box(m, L, 0.04, 0.03, L / 2, y, 0);
      for (let x = 0.06; x < L; x += 0.1) K.box(m, 0.018, h - 0.1, 0.018, x, 0.08, 0, { ao: false });
    } else {
      const m = mat('wood', { color: 0x8a7a64, rough: 1.1 });
      for (let i = 0; i <= nb; i++) K.box(m, 0.14, h + 0.1, 0.14, i * bw, 0, 0, { ry: (r() - 0.5) * 0.2 });
      for (const y of [0.35, 0.7, h - 0.05]) K.box(m, L, 0.1, 0.05, L / 2, y, 0.08, { rz: (r() - 0.5) * 0.02 });
    }
    const opaque = v === 'paling' || v === 'colorbond';
    K.col(0, 0, -0.1, L, h, 0.1, { sight: opaque && h > 1.2, cam: opaque });
  }, { blob: false });
  P('letterbox', 'letterbox {kind: brick (pier with slot and house number) | post (timber post and metal box), number="12"}', (K, o) => {
    if (o.kind === 'post') { K.box(timber(0x8a7050), 0.08, 1.0, 0.08, 0, 0, 0); K.box(mat('metal_painted', { color: 0x2a5a3a }), 0.28, 0.25, 0.4, 0, 1.0, 0.05, { r: 0.04 }); K.box(dark(), 0.2, 0.02, 0.004, 0, 1.18, 0.252, { ao: false }); return; }
    K.box(mat('brick'), 0.46, 1.05, 0.46, 0, 0, 0); K.box(mat('concrete', { color: 0xd8d4cc }), 0.52, 0.06, 0.52, 0, 1.05, 0, { r: 0.01 });
    K.box(dark(), 0.28, 0.035, 0.004, 0, 0.82, 0.232, { ao: false }); K.plane(lab(Tex.text(o.number ?? '12', { w: 128, h: 128, color: '#1a1a1a', bg: '#d8c890' })), 0.12, 0.12, 0, 0.55, 0.232);
  });
  P('power_pole', 'timber power pole with crossarm and insulators {h=9, lamp (adds a street-light arm)}; used by Build.powerLine', (K, o) => {
    const h = o.h ?? 9, m = mat('wood', { color: 0x8a7a68, rough: 1.1 });
    K.cyl(m, 0.12, 0.16, h, 0, 0, 0, { seg: 10 }); K.box(m, 2.2, 0.1, 0.1, 0, h - 0.45, 0);
    for (const x of [-0.9, 0, 0.9]) { K.cyl(col(0x8a4a2a, { rough: 0.3 }), 0.04, 0.05, 0.12, x, h - 0.35, 0, { seg: 8 }); K.cyl(galv(), 0.01, 0.01, 0.06, x, h - 0.23, 0, { seg: 4 }); }
    K.tube(galv(), [[0, h - 0.6, 0], [0.6, h - 0.45, 0.3], [0.9, h - 0.8, 0]], 0.02, { rs: 4 });
    K.plane(lab(Tex.text('No. 4417', { w: 256, h: 64, color: '#111', bg: '#e8d850' })), 0.22, 0.06, 0, 2.2, 0.155);
    if (o.lamp) { K.tube(galv(), [[0, h - 1.5, 0], [0, h - 1.1, 0.8], [0, h - 1.0, 1.7]], 0.04, { rs: 5 }); K.box(col(0x9a9c98, { rough: 0.4, metal: 0.5 }), 0.28, 0.12, 0.6, 0, h - 1.12, 1.9, { r: 0.05 }); K.box(glowMat(0xffa640, 6), 0.2, 0.03, 0.42, 0, h - 1.14, 1.9); }
    K.col(-0.16, 0, -0.16, 0.16, h, 0.16, { sight: false, cam: false });
  }, { blob: false, after(g, o) { if (o.lamp) { const h = o.h ?? 9; glow({ pos: [0, h - 1.2, 1.9], color: 0xffa640, size: 2, opacity: 0.9, parent: g }); pool({ pos: [0, 0, 1.9], r: 5, color: 0xffa640, opacity: 0.3, parent: g }); } } });
  P('roundabout', 'roundabout island: concrete kerb ring, grass and low shrubs, a palm, KEEP LEFT sign {r=6}', (K, o, r) => {
    const R = o.r ?? 6;
    K.lathe(mat('concrete', { color: 0xc8c4bc }), [[R - 0.3, 0], [R, 0], [R, 0.12], [R - 0.05, 0.16], [R - 0.3, 0.16]], 0, 0, 0, { seg: 48 });
    K.cyl(mat('grass'), R - 0.3, R - 0.3, 0.14, 0, 0, 0, { seg: 40, uv: [R, R] });
    K.col(-R, 0, -R, R, 0.16, R, { walk: true, sight: false, cam: false });
  }, {
    blob: false,
    after(g, o) {
      const R = o.r ?? 6, r = U.rng(5);
      tree('palm', { pos: [0.3, 0.14, -0.2], parent: g, seed: 7 });
      const K = kit(3); for (let i = 0; i < 9; i++) { const a = i / 9 * 6.283, d = R * 0.55; cluster(K, Math.cos(a) * d, 0.35, Math.sin(a) * d, 0.5 + r() * 0.3, 'broad', 0x4a6a34, r, { cards: 3, flat: 0.7 }); }
      const kg = group({ parent: g }); finish(K, kg, o);
      sign({ tex: Tex.sign('road_sign', 'KEEP LEFT'), w: 0.6, h: 0.6, post: 1.4, pos: [0, 0.14, R - 0.6], parent: g });
    },
  });
  P('servo_canopy', 'petrol-station canopy: clad columns, deep lit fascia with brand stripe, recessed light panels, optional pump islands {w=14, d=9, h=4.8, lit=true, pumps=true, brand="FUEL · FOOD · OPEN 24/7"}', (K, o) => {
    const w = o.w ?? 14, d = o.d ?? 9, h = o.h ?? 4.8, lit = o.lit !== false, cl = col(0xeceae4, { rough: 0.5 });
    for (const x of [-w / 4, w / 4]) for (const z of [-d / 4, d / 4]) { K.box(cl, 0.5, h, 0.5, x, 0, z, { r: 0.03 }); K.box(col(0xc8261e, { rough: 0.4 }), 0.52, 0.5, 0.52, x, 0.3, z, { r: 0.03 }); }
    K.box(cl, w, 0.9, d, 0, h, 0, { r: 0.04 }); K.box(col(0xc8261e, { rough: 0.4, emissive: lit ? 0xc8261e : 0, emissiveIntensity: 0.7 }), w + 0.02, 0.22, d + 0.02, 0, h + 0.5, 0);
    const bt = lab(Tex.text(o.brand ?? 'FUEL · FOOD · OPEN 24/7', { w: 1024, h: 128, color: '#ffffff' }), { alpha: true, lit: lit ? 1.4 : 0 });
    K.plane(bt, w * 0.6, 0.3, 0, h + 0.28, d / 2 + 0.012); K.plane(bt, w * 0.6, 0.3, 0, h + 0.28, -d / 2 - 0.012, { ry: Math.PI });
    const pm = lit ? glowMat(0xf4f8ff, 2.4) : col(0xd8dcdc, { rough: 0.4 });
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) K.box(pm, 1.2, 0.02, 0.5, -w * 0.375 + i * w / 4, h - 0.02, -d / 3 + j * d / 3, { ao: false });
    if (o.pumps !== false) for (const x of [-w / 4, w / 4]) { K.box(mat('concrete', { color: 0xd0ccc4 }), 1.0, 0.15, 4.6, x, 0, 0, { r: 0.03 }); K.at(x, 0.15, -1.2, 0, () => pumpAt(K, lit)); K.at(x, 0.15, 1.2, Math.PI, () => pumpAt(K, lit)); for (const z of [-2.1, 2.1]) K.cyl(mat('metal_painted', { color: 0xf0c020 }), 0.08, 0.08, 1.0, x, 0.15, z, { seg: 10 }); }
    for (const x of [-w / 4, w / 4]) for (const z of [-d / 4, d / 4]) K.col(x - 0.25, 0, z - 0.25, x + 0.25, h, z + 0.25, { sight: false, cam: false });
    if (o.pumps !== false) for (const x of [-w / 4, w / 4]) K.col(x - 0.5, 0, -2.3, x + 0.5, 1.9, 2.3, { sight: false, cam: false });
  }, { blob: false, solid: true, after(g, o) { if (o.lit === false) return; const w = o.w ?? 14; for (const x of [-w / 4, w / 4]) pool({ pos: [x, 0.16, 0], r: 6, color: 0xe8f0ff, opacity: 0.22, parent: g }); } });
  function pumpAt(K, lit) {
    const wh = col(0xf2f2ee, { rough: 0.45 }), rd = col(0xc8261e, { rough: 0.4 });
    K.box(wh, 0.75, 1.75, 0.42, 0, 0, 0, { r: 0.03 }); K.box(rd, 0.77, 0.3, 0.44, 0, 1.75, 0, { r: 0.03, emissive: 0 });
    K.plane(lab(Tex.text('$ 45.20\n23.81 L', { w: 256, h: 128, color: '#9dffb0', font: 'monospace', bg: '#0a0f0a', glow: true }), { lit: lit ? 1.2 : 0.2 }), 0.4, 0.2, 0, 1.4, 0.212);
    for (const s of [-1, 1]) { K.box(dark(), 0.1, 0.18, 0.08, s * 0.25, 0.85, 0.24); K.tube(dark(), [[s * 0.25, 1.0, 0.25], [s * 0.36, 0.7, 0.34], [s * 0.32, 0.3, 0.3], [s * 0.3, 0.9, 0.22]], 0.018, { rs: 5 }); }
  }
  P('fuel_pump', 'single fuel pump (see servo_canopy for islands) {lit}', (K, o) => pumpAt(K, o.lit !== false));
  P('price_sign', 'servo pylon price sign, lit both sides {prices ("UNLEADED|189.9\\n…"), h=5, lit=true}', (K, o) => {
    const h = o.h ?? 5, m = col(0x2a2c30, { rough: 0.5, metal: 0.3 }), t = lab(Tex.sign('fuel_prices', o.prices || ''), { lit: o.lit === false ? 0 : 1.3, rough: 0.3 });
    for (const s of [-1, 1]) K.box(m, 0.18, h - 2.2, 0.18, s * 0.5, 0, 0);
    K.box(m, 1.35, 2.4, 0.3, 0, h - 2.3, 0, { r: 0.03 }); K.plane(t, 1.2, 2.3, 0, h - 1.1, 0.152); K.plane(t, 1.2, 2.3, 0, h - 1.1, -0.152, { ry: Math.PI });
    K.col(-0.6, 0, -0.15, 0.6, h, 0.15, { sight: false });
  });
  P('crash_barrier', 'W-beam steel guardrail on posts, along +X {length=8}', (K, o) => {
    const L = o.length ?? 8, m = galv();
    for (let x = 0; x <= L + 0.01; x += 2) K.box(m, 0.1, 0.75, 0.12, x, 0, -0.1);
    const s = new THREE.Shape(); s.moveTo(0, 0); for (const [z, y] of [[0.05, 0.02], [0.02, 0.08], [0.05, 0.155], [0.02, 0.23], [0.05, 0.29], [0.0, 0.31], [-0.01, 0.31], [0.03, 0.23], [0.0, 0.155], [0.03, 0.08], [0.0, 0.02], [-0.01, 0]]) s.lineTo(z, y);
    K.shape(m, s, L, { ry: Math.PI / 2, x: L / 2, y: 0.42, z: 0 });
    K.col(0, 0, -0.18, L, 0.75, 0.08, { sight: false, cam: false });
  }, { blob: false });
  P('jersey_barrier', 'concrete jersey barriers in a row along +X {length=2 (multiples of 2), kind: concrete | water (orange/white plastic)}', (K, o) => {
    const L = o.length ?? 2, n = Math.max(1, Math.round(L / 2)), s = poly([[-0.3, 0], [0.3, 0], [0.26, 0.08], [0.1, 0.3], [0.08, 0.81], [-0.08, 0.81], [-0.1, 0.3], [-0.26, 0.08]]);
    for (let i = 0; i < n; i++) {
      const m = o.kind === 'water' ? col(i & 1 ? 0xf2f2ee : 0xe8661e, { rough: 0.5 }) : mat('concrete', { color: 0xc8c4bc });
      K.shape(m, s, 1.96, { ry: Math.PI / 2, x: i * 2 + 1, bevel: 0.01 });
    }
    K.col(0, 0, -0.3, n * 2, 0.81, 0.3, { sight: false, cam: false });
  });
  P('bridge_railing', 'bridge railing along +X: concrete parapet, steel posts and two rails {length=10}', (K, o) => {
    const L = o.length ?? 10, m = galv();
    K.box(mat('concrete', { color: 0xbcb8b0 }), L, 0.55, 0.35, L / 2, 0, 0, { r: 0.02 });
    for (let x = 0.2; x <= L; x += 2.5) K.box(m, 0.08, 0.6, 0.08, x, 0.55, 0);
    for (const y of [0.8, 1.1]) K.box(m, L, 0.07, 0.1, L / 2, y, 0, { r: 0.02 });
    K.col(0, 0, -0.18, L, 1.2, 0.18, { sight: false, cam: false });
  }, { blob: false });
  P('cone', 'traffic cone with reflective bands {n=1 (a short row along +X)}', (K, o) => {
    for (let i = 0; i < (o.n ?? 1); i++) { const x = i * 0.9; K.box(dark(), 0.36, 0.035, 0.36, x, 0, 0, { r: 0.02 }); K.lathe(col(0xf0661e, { rough: 0.45 }), [[0.15, 0], [0.13, 0.12], [0.02, 0.7], [0, 0.7]], x, 0.03, 0, { seg: 14 }); K.lathe(col(0xe8e8e0, { rough: 0.3 }), [[0.105, 0], [0.08, 0.18], [0.079, 0.18]], x, 0.28, 0, { seg: 14 }); }
  }, { col: { sight: false, cam: false } });
  P('bollard', 'bollard {kind: steel (yellow) | concrete}', (K, o) => {
    if (o.kind === 'concrete') { K.cyl(mat('concrete'), 0.18, 0.2, 0.9, 0, 0, 0, { seg: 14 }); K.sph(mat('concrete'), 0.18, 0, 0.9, 0, { s: [1, 0.5, 1] }); return; }
    K.cyl(mat('metal_painted', { color: 0xf0c020 }), 0.07, 0.07, 1.0, 0, 0, 0, { seg: 12 }); K.cyl(col(0xe8e8e0, { rough: 0.2 }), 0.072, 0.072, 0.06, 0, 0.8, 0, { seg: 12 }); K.sph(mat('metal_painted', { color: 0xf0c020 }), 0.07, 0, 1.0, 0, { s: [1, 0.4, 1] });
  }, { col: { sight: false, cam: false } });
  P('boom_gate', 'checkpoint boom gate: pedestal and a red/white arm across +X {w=5, open 0..1}. userData.arm (pivot), userData.set(open)', (K, o) => {
    const w = o.w ?? 5;
    K.box(col(0xf2f2ee, { rough: 0.5 }), 0.42, 1.0, 0.42, 0, 0, 0, { r: 0.03 }); K.box(col(0xc8261e, { rough: 0.5 }), 0.44, 0.2, 0.44, 0, 0.7, 0, { r: 0.03 });
    const Arm = K.sub('arm', { y: 0.92, rz: (o.open ?? 0) * 1.45 }), n = Math.round(w / 0.5);
    for (let i = 0; i < n; i++) Arm.box(col(i & 1 ? 0xf2f2ee : 0xc8261e, { rough: 0.45 }), w / n, 0.1, 0.06, 0.25 + (i + 0.5) * w / n, -0.05, 0.25);
    Arm.box(dark(), 0.5, 0.2, 0.12, -0.25, -0.1, 0.25);
    K.box(col(0xc8261e, { rough: 0.5 }), 0.1, 0.85, 0.1, w + 0.1, 0, 0.25); K.box(dark(), 0.2, 0.06, 0.12, w + 0.1, 0.8, 0.25);
  }, {
    col: { sight: false, cam: false },
    after(g, o) { const w = o.w ?? 5, c = colBox(g, 0.2, 0, 0.15, w + 0.2, 1.0, 0.35, { sight: false, cam: false }); g.userData.set = v => { g.userData.arm.rotation.z = v * 1.45; c.block = v < 0.5; }; g.userData.set(o.open ?? 0); },
  });
  P('floodlight_tower', 'mobile lighting tower: trailer, generator, mast and four floodlights aimed along +Z {h=7, on=true, tilt=0.45, light (spot, true|intensity), shadow (the spot casts the area\'s shadows), color}', (K, o) => {
    const h = o.h ?? 7, y = col(0xe8b820, { rough: 0.5 }), on = o.on !== false, tilt = o.tilt ?? 0.45;
    K.box(y, 1.3, 0.8, 2.2, 0, 0.45, 0, { r: 0.04 }); K.box(dark(), 0.1, 0.1, 1.2, 0, 0.35, 1.6);
    for (const s of [-1, 1]) wheel(K, s * 0.75, -0.3, 0.3, { steel: true });
    for (const [x, z] of [[-0.8, -0.9], [0.8, -0.9], [-0.8, 0.9], [0.8, 0.9]]) K.cyl(galv(), 0.04, 0.05, 0.6, x, 0, z, { seg: 8 });
    K.box(col(0x3a3c3e, { rough: 0.6 }), 1.0, 0.3, 0.6, 0, 1.25, -0.5); for (let i = 0; i < 5; i++) K.box(dark(), 0.02, 0.2, 0.62, -0.35 + i * 0.12, 0.8, -0.5);
    K.cyl(galv(), 0.09, 0.11, h - 3, 0, 1.25, 0.4, { seg: 10 }); K.cyl(galv(), 0.07, 0.07, 2, 0, h - 1.75, 0.4, { seg: 10 });
    K.box(galv(), 1.5, 0.08, 0.08, 0, h, 0.4);
    const lm = on ? glowMat(o.color ?? 0xf4f6ff, 8) : col(0xc8ccd0, { rough: 0.2 });
    for (let i = 0; i < 4; i++) { const x = -0.6 + i * 0.4, yy = h + (i & 1 ? 0.35 : 0.05); K.box(dark(), 0.34, 0.26, 0.12, x, yy, 0.44, { rx: tilt, r: 0.02 }); K.box(lm, 0.28, 0.2, 0.01, x, yy + 0.02, 0.5 + 0.03, { rx: tilt, ao: false }); }
    K.col(-0.8, 0, -1.1, 0.8, h, 1.1, { sight: true, cam: true });
  }, {
    after(g, o) {
      if (o.on === false) return;
      const h = o.h ?? 7, c = o.color ?? 0xf4f6ff, tilt = o.tilt ?? 0.45, dir = [0, -Math.sin(tilt), Math.cos(tilt)];
      for (let i = 0; i < 4; i++) glow({ pos: [-0.6 + i * 0.4, h + 0.15 + (i & 1 ? 0.35 : 0.05), 0.62], color: c, size: 1.6, parent: g });
      beam({ pos: [0, h + 0.2, 0.62], dir, len: 20, r: 7, color: c, opacity: 0.06, parent: g });
      if (o.light) g.userData.light = light('spot', { pos: [0, h + 0.3, 0.7], target: [0, 0, 0.7 + (h + 0.3) / Math.tan(tilt)], color: c, intensity: o.light === true ? 400 : o.light, distance: 60, angle: 0.75, penumbra: 0.5, shadow: o.shadow, parent: g });
    },
  });
  P('sandbags', 'stacked sandbag wall along +X, staggered courses {length=3, rows=4}', (K, o, r) => {
    const L = o.length ?? 3, rows = o.rows ?? 4, m = mat('fabric', { color: 0xa8946a, scale: 0.5 });
    for (let j = 0; j < rows; j++) for (let x = (j & 1) * 0.28; x < L - 0.2; x += 0.56) {
      const g = new THREE.SphereGeometry(0.5, 10, 6), p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setY(i, Math.sign(y) * Math.pow(Math.abs(y) * 2, 0.5) * 0.5); }
      g.computeVertexNormals();
      K.add(g, m, { x: x + 0.28, y: 0.075 + j * 0.14 + (r() - 0.5) * 0.01, z: (r() - 0.5) * 0.04, s: [0.3, 0.085, 0.19], ry: (r() - 0.5) * 0.12, uv: 'unit' });
    }
    K.col(0, 0, -0.2, L, rows * 0.14 + 0.05, 0.2, { sight: rows > 6 });
  });
  P('barricade', 'COMMS road barricade: striped sawhorse legs, a board carrying a stencil sign, blinking amber lamp {text="ROAD CLOSED — SCREEN CHECK", w=2.4, lamp=true}', (K, o) => {
    const w = o.w ?? 2.4, st = [col(0xf2f2ee, { rough: 0.5 }), col(0xc8261e, { rough: 0.5 })];
    for (const s of [-1, 1]) for (const z of [-1, 1]) K.box(st[0], 0.08, 1.15, 0.05, s * (w / 2 - 0.2), 0, z * 0.2, { rx: -z * 0.18 });
    for (let i = 0; i < 6; i++) K.box(st[i & 1], w / 6, 0.2, 0.04, -w / 2 + (i + 0.5) * w / 6, 0.95, 0.24);
    K.box(col(0xd9d2bd, { rough: 0.8 }), w - 0.2, 0.85, 0.04, 0, 1.15, 0.2); K.plane(lab(Tex.sign('stencil', o.text ?? 'ROAD CLOSED — SCREEN CHECK'), { rough: 0.8 }), w - 0.22, 0.83, 0, 1.575, 0.221);
    if (o.lamp !== false) { K.box(dark(), 0.12, 0.08, 0.1, w / 2 - 0.3, 2.0, 0.2); K.cyl(blinkMat(), 0.07, 0.07, 0.1, w / 2 - 0.3, 2.08, 0.2, { seg: 12, ao: false }); }
    K.col(-w / 2, 0, -0.1, w / 2, 2.0, 0.35, { sight: false, cam: false });
  });
  const blinkMat = () => once('blink', () => shared(new THREE.MeshStandardMaterial({ color: 0x7a4a08, emissive: 0xffa010, emissiveIntensity: 4, roughness: 0.3 })));

  // clutter --------------------------------------------------------------------------------------------------
  P('crate', 'crate {kind: wood (slatted, battened) | plastic (stacking crate) | milk (open lattice milk crate), w, h, d, color, stack=1}', (K, o) => {
    const v = o.kind || 'wood', n = o.stack ?? 1;
    for (let k = 0; k < n; k++) {
      if (v === 'wood') {
        const w = o.w ?? 0.8, h = o.h ?? 0.6, d = o.d ?? 0.6, y = k * h, pl = mat('planks', { color: o.color ?? 0xc8a878 }), bt = timber(0xa88858);
        K.box(pl, w, h, d, 0, y, 0);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.box(bt, 0.06, h, 0.06, sx * (w / 2 - 0.02), y, sz * (d / 2 - 0.02));
        for (const yy of [y, y + h - 0.06]) { K.box(bt, w + 0.02, 0.06, 0.03, 0, yy, d / 2); K.box(bt, w + 0.02, 0.06, 0.03, 0, yy, -d / 2); }
        K.box(bt, w + 0.02, 0.06, 0.03, 0, y + h / 2 - 0.03, d / 2, { rz: Math.atan2(h - 0.1, w) });
      } else if (v === 'plastic') {
        const w = o.w ?? 0.6, h = o.h ?? 0.3, d = o.d ?? 0.4, y = k * h, m = col(o.color ?? 0x2a6aa8, { rough: 0.55 });
        K.box(m, w, h, d, 0, y, 0, { r: 0.02 }); for (const s of [-1, 1]) K.box(dark(), 0.004, 0.05, 0.12, s * (w / 2 + 0.001), y + h - 0.1, 0, { ao: false });
        for (let i = 0; i < 5; i++) K.box(col(0, { rough: 0.9 }), 0.03, h * 0.5, 0.004, -w / 2 + 0.1 + i * (w - 0.2) / 4, y + 0.06, d / 2 + 0.001, { ao: false });
      } else {
        const s = 0.33, y = k * 0.28, m = col(o.color ?? 0xc8261e, { rough: 0.55 });
        for (const [dx, dz, ry] of [[0, s / 2, 0], [0, -s / 2, 0], [s / 2, 0, Math.PI / 2], [-s / 2, 0, Math.PI / 2]]) K.at(dx, y, dz, ry, () => {
          for (const yy of [0, 0.13, 0.26]) K.box(m, s, 0.025, 0.02, 0, yy, 0);
          for (let i = 0; i < 5; i++) K.box(m, 0.02, 0.28, 0.02, -s / 2 + i * s / 4, 0, 0);
        });
        for (let i = 0; i < 4; i++) K.box(m, s, 0.015, 0.02, 0, y, -s / 2 + (i + 0.5) * s / 4);
      }
    }
  });
  P('pallet', 'timber pallet (AU 1165 mm) {stack=1, tilt (leaning against a wall, radians)}', (K, o) => {
    const S = 1.165, m = mat('planks', { color: 0xb89a70, scale: 1.2 }), n = o.stack ?? 1;
    K.at(0, 0, o.tilt ? S / 2 * Math.cos(o.tilt) : 0, 0, () => {
      for (let k = 0; k < n; k++) {
        const y = k * 0.145;
        for (let i = 0; i < 3; i++) K.box(m, 0.1, 0.02, S, -S / 2 + 0.05 + i * (S - 0.1) / 2, y, 0, { ao: k === 0 });
        for (let i = 0; i < 3; i++) K.box(m, 0.075, 0.1, S, -S / 2 + 0.05 + i * (S - 0.1) / 2, y + 0.02, 0, { ao: false });
        for (let i = 0; i < 7; i++) K.box(m, S, 0.022, 0.1, 0, y + 0.12, -S / 2 + 0.05 + i * (S - 0.1) / 6, { ao: false });
      }
    }, -(o.tilt || 0));
  });
  P('barrel', '200 L drum {kind: steel (painted, chipped) | rust | plastic (blue) | burning (rusty drum with a fire in it), color}', (K, o) => {
    const v = o.kind || 'steel', m = v === 'rust' || v === 'burning' ? mat('rust') : v === 'plastic' ? col(o.color ?? 0x1e5aa8, { rough: 0.45 }) : mat('metal_painted', { color: o.color ?? 0x2a5a8a });
    if (v === 'plastic') { K.box(m, 0.56, 0.92, 0.56, 0, 0, 0, { r: 0.12 }); K.cyl(col(0x1a1a1a, { rough: 0.5 }), 0.035, 0.035, 0.02, 0.15, 0.92, 0.1, { seg: 8 }); return; }
    K.cyl(m, 0.29, 0.29, 0.88, 0, 0, 0, { seg: 20, open: v === 'burning' });
    for (const y of [0.29, 0.59]) K.geo(m, new THREE.TorusGeometry(0.292, 0.012, 4, 24), { y, rx: Math.PI / 2 });
    K.geo(m, new THREE.TorusGeometry(0.285, 0.014, 4, 24), { y: 0.875, rx: Math.PI / 2 });
    if (v === 'burning') K.cyl(col(0x0a0806, { rough: 1 }), 0.27, 0.27, 0.02, 0, 0.7, 0, { seg: 16 }); else K.cyl(m, 0.28, 0.28, 0.02, 0, 0.86, 0, { seg: 20 });
  }, { after(g, o) { if (o.kind === 'burning') fire({ pos: [0, 0.72, 0], size: 0.55, parent: g, light: o.light }); } });
  P('cardboard_box', 'cardboard carton with packing tape {w=0.5, h=0.4, d=0.4, open (flaps up), stack=1}', (K, o, r) => {
    const w = o.w ?? 0.5, h = o.h ?? 0.4, d = o.d ?? 0.4, m = mat('cardboard'), tape = col(0xc8a86a, { rough: 0.3 });
    for (let k = 0; k < (o.stack ?? 1); k++) {
      const y = k * h, ry = (r() - 0.5) * 0.15;
      K.at(0, y, 0, ry, () => {
        K.box(m, w, h, d, 0, 0, 0);
        if (o.open && k === (o.stack ?? 1) - 1) { for (const s of [-1, 1]) { K.box(m, w, 0.004, d / 2, 0, h, s * (d / 2 + d / 4 * 0.7), { rx: s * 0.6 }); K.box(m, w / 2, 0.004, d, s * (w / 2 + w / 4 * 0.5), h, 0, { rz: -s * 1.2 }); } K.box(col(0x0a0806, { rough: 1 }), w - 0.01, 0.005, d - 0.01, 0, h - 0.04, 0, { ao: false }); }
        else K.box(tape, 0.05, 0.004, d + 0.004, 0, h, 0, { ao: false });
        K.box(tape, 0.05, h * 0.3, 0.004, 0, h * 0.7, d / 2 + 0.002, { ao: false }); K.box(tape, 0.05, h * 0.3, 0.004, 0, h * 0.7, -d / 2 - 0.002, { ao: false });
      });
    }
  });
  P('tarp', 'blue tarp draped over a lump (or flat on the ground) {w=2.5, d=2, h=0.8 (height of what\'s under it), color}', (K, o, r) => {
    const w = o.w ?? 2.5, d = o.d ?? 2, h = o.h ?? 0.8, g = new THREE.PlaneGeometry(w + h * 2, d + h * 2, 24, 24); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), ox = Math.max(0, Math.abs(x) - w / 2), oz = Math.max(0, Math.abs(z) - d / 2), out = Math.hypot(ox, oz);
      let y = h - Math.min(out * 1.3, h) + Math.sin(x * 5 + z * 3) * Math.sin(z * 4) * 0.04 + (r() - 0.5) * 0.02;
      if (out > 0) { const k = Math.min(1, out / (h + 0.01)) * 0.5; p.setX(i, x - Math.sign(x) * ox * k); p.setZ(i, z - Math.sign(z) * oz * k); }
      p.setY(i, Math.max(0.01, y));
    }
    g.computeVertexNormals();
    K.geo(mat('tarp', { color: o.color ?? 0xffffff, side: THREE.DoubleSide }), g, { ao: false });
    K.col(-w / 2, 0, -d / 2, w / 2, h, d / 2);
  });
  P('mattress', 'single mattress on the floor {dirty (stains, a pillow and a rumpled blanket), w=0.92, l=1.88}', (K, o) => {
    const w = o.w ?? 0.92, l = o.l ?? 1.88;
    K.box(mat('fabric', { color: o.color ?? 0xd8d0c0 }), w, 0.18, l, 0, 0, 0, { r: 0.06 });
    if (o.dirty !== false) {
      K.plane(lab(Tex.decal('stain'), { alpha: true }), w * 0.8, w * 0.8, 0.05, 0.181, 0.3, { rx: -Math.PI / 2 });
      K.box(fab(0xe8e4d8), w * 0.6, 0.1, 0.35, 0, 0.18, -l / 2 + 0.25, { r: 0.05, ry: 0.1 });
      const bg = new THREE.PlaneGeometry(w + 0.2, l * 0.6, 10, 10), p = bg.attributes.position; bg.rotateX(-Math.PI / 2);
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, 0.2 + Math.sin(x * 8 + z * 5) * Math.sin(z * 6) * 0.04 - Math.max(0, Math.abs(x) - w / 2) * 1.5); }
      bg.computeVertexNormals(); K.geo(mat('knit', { color: 0x5a6a5a, side: THREE.DoubleSide }), bg, { z: l * 0.18, ry: 0.15, ao: false });
    }
  });
  P('camp_stove', 'portable butane camp stove with a dented pot and a spare canister {lit (small blue flame)}', (K, o) => {
    K.box(col(0x3a3c40, { rough: 0.4, metal: 0.5 }), 0.34, 0.09, 0.26, 0, 0, 0, { r: 0.015 }); K.box(dark(), 0.3, 0.005, 0.22, 0, 0.09, 0, { ao: false });
    K.geo(dark(), new THREE.TorusGeometry(0.06, 0.006, 4, 16), { y: 0.1, rx: Math.PI / 2 }); K.cyl(dark(), 0.04, 0.04, 0.02, 0.12, 0.05, 0.13, { rx: Math.PI / 2, seg: 8 });
    K.cyl(col(0xa8acb0, { rough: 0.3, metal: 0.8 }), 0.1, 0.09, 0.12, 0, 0.12, 0, { seg: 16 }); K.box(dark(), 0.18, 0.012, 0.02, 0.18, 0.2, 0, { rz: 0.1 });
    K.cyl(col(0xc8261e, { rough: 0.4, metal: 0.3 }), 0.035, 0.035, 0.18, 0.3, 0, 0.1, { rz: Math.PI / 2, seg: 10 });
    if (o.lit) K.cyl(glowMat(0x3a7aff, 4), 0.06, 0.05, 0.015, 0, 0.1, 0, { seg: 12, open: true, ao: false });
  }, { solid: false });
  P('table', 'table {kind: folding (trestle, white top on steel legs) | cafe (round metal) | plastic (outdoor) | workbench (heavy timber bench with vice and pegboard), w, d}', (K, o) => {
    const v = o.kind || 'folding';
    if (v === 'cafe') { const m = mat('metal_painted', { color: 0x2a2c2e }); K.cyl(m, 0.35, 0.35, 0.03, 0, 0.72, 0, { seg: 20 }); K.cyl(m, 0.03, 0.03, 0.72, 0, 0, 0, { seg: 8 }); K.cyl(m, 0.22, 0.24, 0.03, 0, 0, 0, { seg: 16 }); return; }
    const w = o.w ?? (v === 'workbench' ? 2 : 1.8), d = o.d ?? (v === 'workbench' ? 0.7 : 0.75), h = v === 'workbench' ? 0.9 : 0.73;
    if (v === 'workbench') {
      const m = mat('wood', { color: 0x8a6a48, rough: 1.1 });
      K.box(m, w, 0.06, d, 0, h - 0.06, 0); for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) K.box(m, 0.09, h - 0.06, 0.09, x * (w / 2 - 0.08), 0, z * (d / 2 - 0.08)); K.box(m, w - 0.2, 0.03, d - 0.1, 0, 0.18, 0);
      K.box(mat('plywood', { color: 0xc8b090 }), w, 0.9, 0.02, 0, h, -d / 2 + 0.01); K.box(dark(), 0.18, 0.1, 0.12, w / 2 - 0.2, h, d / 2 - 0.04, { r: 0.01 });
      return;
    }
    const top = v === 'plastic' ? col(0xf2f2ee, { rough: 0.5 }) : mat('laminate', { color: 0xe8e8e4 });
    K.box(top, w, 0.04, d, 0, h - 0.04, 0, { r: 0.015 });
    for (const s of [-1, 1]) { K.box(galv(), 0.03, h - 0.04, 0.03, s * (w / 2 - 0.1), 0, -d / 2 + 0.08, { rx: 0.1 }); K.box(galv(), 0.03, h - 0.04, 0.03, s * (w / 2 - 0.1), 0, d / 2 - 0.08, { rx: -0.1 }); K.box(galv(), 0.03, 0.03, d - 0.2, s * (w / 2 - 0.1), 0.2, 0); }
  });
  P('filing_cabinet', 'steel filing cabinet {drawers=4, open (index of a pulled-out drawer), color}', (K, o) => {
    const n = o.drawers ?? 4, m = mat('metal_painted', { color: o.color ?? 0x8a9096 }), h = n * 0.33;
    K.box(m, 0.47, h, 0.62, 0, 0, 0, { r: 0.01 });
    for (let i = 0; i < n; i++) { const y = 0.02 + i * 0.33, out = o.open === i ? 0.35 : 0; K.box(m, 0.44, 0.3, 0.02, 0, y, 0.31 + out, { r: 0.006 }); K.box(chrome(), 0.14, 0.02, 0.03, 0, y + 0.18, 0.335 + out); K.box(col(0xf4f0e0, { rough: 0.9 }), 0.08, 0.035, 0.004, 0, y + 0.23, 0.322 + out, { ao: false }); if (out) K.box(m, 0.42, 0.26, 0.36, 0, y + 0.02, 0.13 + out); }
  });
  P('locker', 'bank of steel lockers with vents and handles {n=3, ajar (index of an open door), color}', (K, o) => {
    const n = o.n ?? 3, w = 0.38, h = 1.8, d = 0.45, m = mat('metal_painted', { color: o.color ?? 0x5a7a8a });
    K.box(m, n * w, h, d, 0, 0.08, 0, { r: 0.006 }); K.box(dark(), n * w - 0.02, 0.08, d - 0.04, 0, 0, 0);
    for (let i = 0; i < n; i++) {
      const x = -n * w / 2 + (i + 0.5) * w;
      K.at(x - w / 2 + 0.01, 0, d / 2, o.ajar === i ? -1.1 : 0, () => { K.box(m, w - 0.02, h - 0.04, 0.015, w / 2 - 0.01, 0.1, 0.008); for (let v = 0; v < 5; v++) K.box(dark(), w * 0.5, 0.012, 0.004, w / 2 - 0.01, 1.6 + v * 0.03, 0.017, { ao: false }); K.box(chrome(), 0.02, 0.1, 0.03, w - 0.07, 1.0, 0.02); });
      if (o.ajar === i) K.box(col(0x0a0b0c, { rough: 1 }), w - 0.04, h - 0.06, 0.004, x, 0.11, d / 2 - 0.01, { ao: false });
    }
  });
  P('plant_pot', 'potted plant {kind: fern | palm | succulent | dead, pot: terracotta | planter (square grey), s=1}', (K, o, r) => {
    const s = o.s ?? 1, v = o.kind || 'fern';
    if (o.pot === 'planter') K.box(mat('concrete', { color: 0x6a6a68 }), 0.45 * s, 0.45 * s, 0.45 * s, 0, 0, 0, { r: 0.02 });
    else K.lathe(col(0xb8643a, { rough: 0.8 }), [[0, 0], [0.13 * s, 0], [0.18 * s, 0.3 * s], [0.2 * s, 0.31 * s], [0.2 * s, 0.35 * s], [0.18 * s, 0.35 * s]], 0, 0, 0, { seg: 16 });
    const top = (o.pot === 'planter' ? 0.44 : 0.33) * s;
    K.cyl(mat('dirt'), 0.17 * s, 0.17 * s, 0.01, 0, top - 0.01, 0, { seg: 12, ao: false });
    if (v === 'succulent') { for (let i = 0; i < 9; i++) K.sph(col(0x6a9a7a, { rough: 0.6 }), 0.05 * s, (r() - 0.5) * 0.2 * s, top + 0.03 * s, (r() - 0.5) * 0.2 * s, { s: [0.7, 1.4, 0.7], rx: (r() - 0.5), rz: (r() - 0.5) }); return; }
    if (v === 'dead') { for (let i = 0; i < 5; i++) K.tube(col(0x5a4a3a, { rough: 1 }), [[0, top, 0], [(r() - 0.5) * 0.2 * s, top + 0.25 * s, (r() - 0.5) * 0.2 * s], [(r() - 0.5) * 0.4 * s, top + 0.45 * s, (r() - 0.5) * 0.4 * s]], 0.006, { rs: 3 }); return; }
    const lm = leafMat(v === 'palm' ? 'palm' : 'broad');
    for (let i = 0; i < 9; i++) { const a = i / 9 * 6.283 + r() * 0.3, L = (0.45 + r() * 0.3) * s, pg = new THREE.PlaneGeometry(0.25 * s, L, 1, 4), p = pg.attributes.position; for (let k = 0; k < p.count; k++) { const t = (p.getY(k) + L / 2) / L; p.setXYZ(k, p.getX(k) * (1 - t * 0.4), 0, t * L); p.setY(k, Math.sin(t * 1.4) * L * 0.6 - t * t * L * 0.4); } pg.computeVertexNormals(); K.add(pg, lm, { y: top, ry: a, uv: 'unit', ao: false, tint: 0x6a8a4a }); }
  });
  P('rubbish_bag', 'lumpy black garbage bags {n=1}', (K, o, r) => {
    for (let k = 0; k < (o.n ?? 1); k++) {
      const g = new THREE.IcosahedronGeometry(0.3, 2), p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { _v.fromBufferAttribute(p, i); const k2 = 1 + Math.sin(_v.x * 13 + k) * Math.sin(_v.y * 11) * 0.12 + (r() - 0.5) * 0.06; p.setXYZ(i, _v.x * k2, Math.max(-0.2, _v.y * k2 * 0.85), _v.z * k2); }
      g.computeVertexNormals();
      const x = (k % 3) * 0.45 - 0.45 * (Math.min(o.n ?? 1, 3) - 1) / 2, z = Math.floor(k / 3) * 0.4;
      K.add(g, col(0x0e0f10, { rough: 0.32, metal: 0.1 }), { x, y: 0.2, z, ry: r() * 6, uv: 'unit' });
      K.sph(col(0x0e0f10, { rough: 0.32 }), 0.05, x, 0.47, z, { s: [0.8, 1.4, 0.8] });
    }
  });
  P('tyre', 'old tyre lying flat {stack=1, standing}', (K, o) => {
    for (let k = 0; k < (o.stack ?? 1); k++) K.geo(col(0x151515, { rough: 0.9 }), new THREE.TorusGeometry(0.3, 0.11, 8, 20), o.standing ? { y: 0.41, ry: 0.3 } : { y: 0.1 + k * 0.21, rx: Math.PI / 2, ry: k * 0.4 });
  });
  P('jerry_can', 'jerry can {color=0xc8261e}', (K, o) => {
    const m = col(o.color ?? 0xc8261e, { rough: 0.45 });
    K.box(m, 0.17, 0.46, 0.35, 0, 0, 0, { r: 0.025 }); for (const z of [-0.08, 0, 0.08]) K.box(m, 0.03, 0.05, 0.03, 0, 0.46, z); K.box(m, 0.03, 0.02, 0.2, 0, 0.51, 0);
    K.cyl(dark(), 0.025, 0.025, 0.06, 0, 0.44, 0.15, { rx: 0.7, seg: 8 });
  });
  P('esky', 'esky (cooler box) {color (lid)=0x2a6ad8}', (K, o) => {
    K.box(col(0xf2f2ee, { rough: 0.5 }), 0.6, 0.36, 0.38, 0, 0, 0, { r: 0.03 }); K.box(col(o.color ?? 0x2a6ad8, { rough: 0.45 }), 0.62, 0.07, 0.4, 0, 0.36, 0, { r: 0.025 });
    for (const s of [-1, 1]) K.box(col(o.color ?? 0x2a6ad8, { rough: 0.45 }), 0.03, 0.06, 0.14, s * 0.31, 0.26, 0);
  });
  P('generator', 'portable petrol generator in a tube frame {on (runs: exhaust haze)}', (K, o) => {
    const m = col(0xd8a020, { rough: 0.5 }), f = dark();
    K.box(m, 0.55, 0.4, 0.42, 0, 0.12, 0, { r: 0.03 }); K.box(col(0x2a2c2e, { rough: 0.5 }), 0.3, 0.2, 0.44, -0.1, 0.25, 0);
    for (const s of [-1, 1]) { K.tube(f, [[s * 0.33, 0, -0.25], [s * 0.33, 0.62, -0.25], [s * 0.33, 0.62, 0.25], [s * 0.33, 0, 0.25]], 0.015, { rs: 4 }); }
    K.box(col(0xc8261e, { rough: 0.4 }), 0.35, 0.1, 0.3, 0.05, 0.52, 0, { r: 0.04 });
  }, { after(g, o) { if (o.on) smoke({ pos: [0.3, 0.3, 0.2], size: 0.25, color: 0x5a5a5a, rate: 0.35, count: 8, parent: g }); } });
  P('shelving', 'steel warehouse shelving / racking with stock {w=2.4, h=2.4, d=0.6, levels=4, fill=0.7}', (K, o, r) => {
    const w = o.w ?? 2.4, h = o.h ?? 2.4, d = o.d ?? 0.6, n = o.levels ?? 4, m = mat('metal_painted', { color: 0x3a5a8a }), sh = mat('metal', { color: 0xa8acb0 });
    for (const x of [-w / 2, w / 2]) for (const z of [-d / 2, d / 2]) K.box(m, 0.05, h, 0.05, x, 0, z);
    for (let i = 0; i < n; i++) {
      const y = 0.1 + i * (h - 0.2) / (n - 1); K.box(sh, w, 0.03, d, 0, y, 0); K.box(col(0xe8661e, { rough: 0.5 }), w, 0.06, 0.02, 0, y - 0.03, d / 2);
      if (i < n - 1) for (let x = -w / 2 + 0.25; x < w / 2 - 0.2; x += 0.45) if (r() < (o.fill ?? 0.7)) { const bw = 0.3 + r() * 0.1, bh = 0.2 + r() * 0.25; K.box(mat('cardboard'), bw, bh, d * 0.8, x, y + 0.03, 0, { ry: (r() - 0.5) * 0.1 }); }
    }
    K.col(-w / 2, 0, -d / 2, w / 2, h, d / 2);
  });

  // ---- area lifecycle + static batching ----------------------------------------------------------
  // static glow sprites -> one camera-facing billboard mesh per area (one draw call)
  const glowBatchMat = () => fxMat('glowb', `attribute vec2 aC; attribute vec2 aS; attribute vec3 color; varying vec2 vUv; varying vec3 vC; ${FOGV}
    void main(){ vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); mvPosition.xy += aC * aS.x * 0.5; vUv = aC * 0.5 + 0.5; vC = color * aS.y; gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }`, `uniform sampler2D tR; varying vec2 vUv; varying vec3 vC; ${FOGF} void main(){ gl_FragColor = vec4(vC * texture2D(tR, vUv).a, 1.0); ${FOGA} }`, { tR: { value: radTex() } });
  function batchGlows(a, inv) {
    const list = [];
    a.group.traverse(o => { if (!o.isSprite) return; for (let p = o; p && p !== a.group; p = p.parent) if (p.userData.dynamic) return; list.push(o); });
    if (list.length < 2) return;
    const P = [], C = [], S = [], Co = [], I = [];
    list.forEach((s, k) => {
      const w = s.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv), c = s.material.color, sc = s.getWorldScale(_s).x;
      for (const [cx, cy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { P.push(w.x, w.y, w.z); C.push(cx, cy); S.push(sc, s.material.opacity); Co.push(c.r, c.g, c.b); }
      I.push(k * 4, k * 4 + 1, k * 4 + 2, k * 4, k * 4 + 2, k * 4 + 3);
      s.parent.remove(s);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('aC', new THREE.Float32BufferAttribute(C, 2)); g.setAttribute('aS', new THREE.Float32BufferAttribute(S, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(Co, 3)); g.setIndex(I);
    const me = new THREE.Mesh(g, glowBatchMat()); me.frustumCulled = false; me.renderOrder = 8; a.group.add(me);
  }
  function begin(a) {
    A = a;
    a.update((dt, t) => { Tex.animate(dt, t); const b = cache.get('blink'); if (b) b.emissiveIntensity = t % 1.2 < 0.6 ? 4 : 0.15; });
  }
  function end(a) {
    a.group.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(a.group.matrixWorld).invert(), buckets = new Map(), list = [];
    a.group.traverse(o => { if (o.isMesh && o.userData.batch && !o.isInstancedMesh) list.push(o); });
    for (const o of list) {
      o.geometry.computeBoundingBox(); const c = o.geometry.boundingBox.getCenter(_v).applyMatrix4(o.matrixWorld).applyMatrix4(inv);
      const k = o.material.uuid + '|' + Math.floor(c.x / 24) + ',' + Math.floor(c.z / 24) + (o.castShadow ? 's' : '') + (o.renderOrder || 0);
      if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(o);
    }
    batchGlows(a, inv);
    for (const arr of buckets.values()) {
      if (arr.length < 2) continue;
      const geos = arr.map(o => o.geometry.clone().applyMatrix4(_m.multiplyMatrices(inv, o.matrixWorld)));
      const merged = mergeGeometries(geos); if (!merged) continue;
      geos.forEach(x => x.dispose());
      const me = new THREE.Mesh(merged, arr[0].material); me.castShadow = arr[0].castShadow; me.receiveShadow = arr[0].receiveShadow; me.renderOrder = arr[0].renderOrder;
      a.group.add(me);
      for (const o of arr) { o.parent.remove(o); o.geometry.dispose(); }
    }
  }

  return {
    begin, end, get A() { return A; },
    mesh, box, plane, group, floor, wall, room, roof, stairs, ramp, prop, get propNames() { return Object.keys(PROPS); },
    sun, light, hemi, glow, pool, beam, fire, smoke, godray, dust, rain, fairyLights, water, terrain, tree, grass, vines, scatter,
    car: (kind, o) => prop('car_' + kind, o), streetlight: o => prop('streetlight', { ...o, variant: o && o.kind }), sign, decal, poster, screenrot,
    road: o => roadFn(o), marking: (k, o) => markingFn(k, o), wire, powerLine: o => powerLineFn(o), instanced, windify,
  };
})();
