// ============================================================================
// Tex — procedural canvas textures and cached PBR materials. Every texture/material is
// generated once and cached; cached objects carry userData.shared = true so area unloads
// never dispose them. Owned by: world agent. THIS IS A STUB: keep the API, replace the implementation.
//
// CONTRACT
//   Tex.get(name, opts) -> THREE.Texture  (colour map, sRGB, RepeatWrapping). Names (at least):
//      concrete, concrete_wet, brick, brick_painted, asphalt, asphalt_lines, rust, metal, metal_painted, wood, planks,
//      floorboards, plywood, moss, grass, dirt, gravel, sand, snow, leaves, bark, fabric, carpet, tiles, tiles_mall,
//      plaster, wallpaper, render (painted wall), roof_tiles, corrugated, glass_dirty, paper, water, noise, screenrot,
//      screen_feed (animated-looking scroll feed; call Tex.animate(dt) each frame to scroll), skin, denim, knit
//   Tex.normal(name) -> normal map texture derived from the same pattern (for PBR relief)
//   Tex.mat(name, opts) -> cached MeshStandardMaterial using Tex.get(name) (+ normal/roughness)
//      opts: { color (tint), repeat:[u,v], rough, metal, emissive, emissiveIntensity, transparent, opacity, side, key }
//      same name+opts returns the same material instance
//   Tex.color(hex, opts) -> cached plain MeshStandardMaterial (rough/metal/emissive opts)
//   Tex.text(text, {w, h, font, size, color, bg, align, pad, weight, italic, glow}) -> Texture   (signs, labels)
//   Tex.sign(kind, text) -> Texture   kinds: shopfront (Optus-style yellow YES), banner (promo banner), street, road_sign,
//      stencil (military), neon, whiteboard (handwriting), plaque, price_tag, ration, lanyard_card
//   Tex.poster(kind) -> Texture       kinds: comms_look_up, comms_report, comms_execution, band, promo_launch, promo_upgrade,
//      say_yes (YES crossed out), missing_person, landlines_dialtone, school_notice, fitness, party_toga, values_teamwork
//   Tex.graffiti(text, {color, style:'spray'|'drip'|'stencil'|'tally'|'cord'}) -> Texture (transparent)
//   Tex.decal(kind) -> Texture (transparent): blood, stain, crack, water_stain, soot, moss_patch, coffee_ring, footprints
//   Tex.photo(kind) -> Texture        framed family photos (painted, faceless-ish): baby_in_polo, fridge_faces, store_team, launch_night
//   Tex.preload() -> [jobs]           optional list of () => void to warm the cache during the loading screen
//   Tex.animate(dt)                   advance animated textures (screen feeds, screen-rot flicker)
// ============================================================================
const Tex = (() => {
  const mats = new Map(), texs = new Map();
  const shared = x => (x.userData.shared = true, x);
  function get(name) {
    if (texs.has(name)) return texs.get(name);
    const c = document.createElement('canvas'); c.width = c.height = 4;
    const g = c.getContext('2d'); g.fillStyle = '#888'; g.fillRect(0, 0, 4, 4);
    const t = shared(new THREE.CanvasTexture(c)); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; texs.set(name, t); return t;
  }
  function color(hex, o = {}) {
    const k = 'c' + hex + JSON.stringify(o);
    if (!mats.has(k)) mats.set(k, shared(new THREE.MeshStandardMaterial({ color: hex, roughness: o.rough ?? 0.8, metalness: o.metal ?? 0, emissive: o.emissive ?? 0, emissiveIntensity: o.emissiveIntensity ?? 1 })));
    return mats.get(k);
  }
  const mat = (name, o = {}) => color(o.color ?? 0x999999, o);
  const text = () => get('text'), sign = () => get('sign'), poster = () => get('poster'), graffiti = () => get('graffiti'), decal = () => get('decal'), photo = () => get('photo');
  return { get, normal: get, mat, color, text, sign, poster, graffiti, decal, photo, preload: () => [], animate() {} };
})();
