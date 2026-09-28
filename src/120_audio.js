// ============================================================================
// Audio — Web Audio score (Karplus–Strong guitar, drones, piano, phone tones), sfx, ambience,
// voice (speechSynthesis, optional), mixer buses with ducking, positional sound.
// Owned by: audio agent. THIS IS A STUB: keep every API below, replace the implementation.
//
// CONTRACT (every call must be safe before init() and when the AudioContext is unavailable)
//   Audio.init()                      create context on user gesture (idempotent)
//   Audio.update(dt)                  listener follows Engine.camera; ducking; loops
//   Audio.music(cueId, {fade})        cue ids: 'title' (full theme once then silence), 'theme_a', 'theme_b', 'theme' (full),
//                                     'chloe_motif', 'bub_motif', 'wai' (low drone then phrase A), 'film_night',
//                                     'whales', 'choice_drone', 'piano_theme', 'tension' (loop; use Audio.tension(level))
//   Audio.stopMusic(fadeSec=2)
//   Audio.tension(level 0..1)         stealth/combat drone intensity (0 = off)
//   Audio.sfx(name, {pos: Vector3, vol, rate}) -> {stop()}   one-shots. Names (at least):
//      click (clicker), click_counter (security guard counter), notif_chime, phone_ring, phone_buzz, phone_boot (Bub's motif),
//      glass_break, door_knock, door_open, door_slam, wood_crash (table), punch, body_fall, tackle, gunshot, gunshot_far,
//      rifle_shot, revolver_shot, shotgun, reload, dry_fire, car_crash, tyre_screech, horn, truck_horn, siren, scanner_beep,
//      scanner_shriek, swipe, whisper (scroller mutter), scroller_scream, heartbeat, typing_tap, send_whoosh,
//      tv_on, tv_off, radio_static, radio_click, fire_whoosh, explosion, bottle_break, brick_hit, pluck (UI hover), ui_select,
//      page_turn, breath_in, gasp, chirp (digital pet), tape_click, tape_hiss, shovel, bell, water_splash
//   Audio.loop(name, {pos, vol}) -> {stop(fade), setVol(v), setPos(v3)}   continuous sources:
//      fire, engine_idle, engine_drive, rain, wind, tv_murmur, radio_dj, crowd_murmur, fluorescent_hum, water_lap, siren_far,
//      clicks_far (thousands of distant clicks), cicadas, turbine_hum, phone_feed (scrolling murmur)
//   Audio.amb(name|null, fade)        area ambience bed (crossfades). Names: store_night, suburb_night, house_night, car_interior,
//      fire_street, bridge_night, title_dawn, qz_rain, warehouse, tunnel, tower, mall_dawn, outback_day, … (unknown names = silence)
//   Audio.footstep(surface, pos, intensity)   surfaces: concrete gravel grass wood water snow metal tile carpet
//   Audio.voice(who, text, {pitch, rate}) -> Promise   speechSynthesis when SETTINGS.voice; resolves immediately otherwise
//   Audio.duck(on)                    duck music+amb under dialogue
//   Audio.muffle(t 0..1)              low-pass everything (Airplane Mode, underwater)
//   Audio.setVolumes()                re-read SETTINGS.vol
//   Audio.pause(bool)                 pause menu: suspend sfx/amb, keep UI sounds
//   Audio.silence(on, fade)           drop all music and most ambience (heaviest scenes)
// ============================================================================
const Audio = (() => {
  const h = { stop() {}, setVol() {}, setPos() {} };
  return {
    init() {}, update() {}, music() {}, stopMusic() {}, tension() {}, sfx: () => h, loop: () => h, amb() {}, footstep() {},
    voice: () => Promise.resolve(), duck() {}, muffle() {}, setVolumes() {}, pause() {}, silence() {},
  };
})();
