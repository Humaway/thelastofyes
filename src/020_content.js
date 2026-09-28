// ============================================================================
// CONTENT — all writing and data, kept apart from code.
// Chapter files (021_*.js …) and level files (3xx_*.js) add to these tables.
// ============================================================================
const CONTENT = {
  scenes: {},        // cutscene scripts, see ARCHITECTURE.md "Scene format"
  talks: {},         // walk-and-talks + optional conversations: { lines:[{who,text,emote,pause}], resume, priority, optional }
  barks: {},         // barks[speakerSet][category] = [lines]
  levels: {},        // area definitions: { name, grade, fog, env, amb, surface, build(A) }
  chapters: {},      // chapters[id] = { title, season, card, steps:[{ id, checkpoint, run: async G => {} }] }
  chapterOrder: ['prologue', 'ch1', 'ch2', 'ch3', 'ch4', 'ch5', 'ch6', 'ch7'],
  collectibles: { artifacts: [], lanyards: [], modules: [] },
  remarks: {},       // Chloe's world remarks, remarks[id] = { text, emote }
  tips: [],          // the 12 Sales Tips
  grades: {},        // colour grades, see Engine.setGrade
  hooks: {},         // named special behaviours callable from scenes: hooks[name](G, args)
  dev: {},           // dev sandboxes: dev[name] = async G => {} (run with ?dev&test=name)
  speakers: {},
};

// Speaker display names, subtitle colours, TTS voice profile [pitch, rate].
// Anyone not listed uses their id upper-cased, colour #B0A8A0, voice [1, 1].
CONTENT.speakers = {
  chase:    { name: 'CHASE',    color: '#C9A94A', voice: [0.8, 0.9] },
  chloe:    { name: 'CHLOE',    color: '#FFD400', voice: [1.25, 1.1] },
  wai:      { name: 'WAI',      color: '#4FB3A9', voice: [0.95, 1.0] },
  zane:     { name: 'ZANE',     color: '#7A8FB3', voice: [0.85, 1.0] },
  aidan:    { name: 'AIDAN',    color: '#F28C28', voice: [1.15, 1.15] },
  luke:     { name: 'LUKE',     color: '#8FB38A', voice: [0.9, 0.95] },
  bub:      { name: 'BUB',      color: '#F5A3C7', voice: [1.35, 1.1] },
  operator: { name: 'THE OPERATOR', color: '#D9D9D9', voice: [0.95, 0.9] },
  level3:   { name: 'LEVEL 3',  voice: [0.9, 0.95] },
  techsupport: { name: 'TECH SUPPORT', voice: [0.75, 1.05] },
  closer:   { name: 'THE CLOSER', voice: [0.85, 1.2] },
  regional: { name: 'THE REGIONAL', voice: [0.85, 0.85] },
  wholesaler: { name: 'WHOLESALER', voice: [0.9, 1.1] },
  facilitator: { name: 'THE FACILITATOR', voice: [0.95, 1.0] },
  chef:     { name: 'THE CHEF', voice: [0.8, 0.9] },
  soldier:  { name: 'SOLDIER',  voice: [1.0, 1.05] },
  customer: { name: 'CUSTOMER', voice: [1.1, 0.85] },
  store_manager: { name: 'STORE MANAGER', voice: [0.9, 1.1] },
  newsreader: { name: 'NEWSREADER', voice: [1.05, 1.0] },
  radio_dj: { name: 'RADIO DJ', voice: [1.0, 1.3] },
  man:      { name: 'MAN',      voice: [0.9, 1.1] },
  landline: { name: 'LANDLINE', voice: [1.0, 1.0] },
  cook:     { name: 'THE COOK', voice: [0.9, 0.9] },
  lukes_wife: { name: "LUKE'S WIFE", voice: [1.1, 1.0] },
  guard:    { name: 'GUARD',    voice: [0.9, 1.0] },
};

// Colour grades (Engine.setGrade). Values are applied in the grade ShaderPass.
//   exposure: linear multiplier; sat: saturation (1 = unchanged); contrast (1 = unchanged)
//   lift/gamma/gain: [r,g,b] ASC-CDL-ish (lift adds, gain multiplies, gamma is power ~1)
//   vignette 0..1; grain 0..1; fringe (chromatic aberration) 0..1; bloom [strength, radius, threshold]
//   toneExposure: renderer.toneMappingExposure
CONTENT.grades = {
  neutral:        { exposure: 1, sat: 1, contrast: 1, lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1], vignette: 0.3, grain: 0.25, fringe: 0.15, bloom: [0.6, 0.5, 0.85], toneExposure: 1 },
  launch_night:   { exposure: 1.05, sat: 1.05, contrast: 1.08, lift: [0.01, 0.008, 0.02], gamma: [1, 1, 1.02], gain: [1.06, 0.98, 0.95], vignette: 0.35, grain: 0.2, fringe: 0.15, bloom: [0.8, 0.55, 0.7], toneExposure: 1.1 },
  launch_home:    { exposure: 1.0, sat: 0.95, contrast: 1.05, lift: [0.01, 0.01, 0.025], gamma: [1, 1, 1.03], gain: [1.04, 0.99, 0.96], vignette: 0.4, grain: 0.22, fringe: 0.12, bloom: [0.7, 0.5, 0.75], toneExposure: 1.05 },
  launch_fire:    { exposure: 1.05, sat: 1.1, contrast: 1.15, lift: [0.02, 0.008, 0.0], gamma: [0.98, 1, 1.04], gain: [1.12, 0.96, 0.85], vignette: 0.45, grain: 0.3, fringe: 0.25, bloom: [0.9, 0.6, 0.6], toneExposure: 1.05 },
  launch_bridge:  { exposure: 0.95, sat: 0.8, contrast: 1.12, lift: [0.0, 0.01, 0.02], gamma: [1.02, 1, 0.98], gain: [1.0, 1.0, 1.04], vignette: 0.5, grain: 0.3, fringe: 0.2, bloom: [0.7, 0.6, 0.7], toneExposure: 1.0 },
  title_dawn:     { exposure: 1.05, sat: 0.9, contrast: 1.05, lift: [0.02, 0.02, 0.03], gamma: [1, 1, 1], gain: [1.08, 1.0, 0.92], vignette: 0.4, grain: 0.25, fringe: 0.1, bloom: [0.7, 0.6, 0.75], toneExposure: 1.0 },
  qz_green:       { exposure: 0.95, sat: 0.75, contrast: 1.15, lift: [0.0, 0.01, 0.0], gamma: [1.02, 0.98, 1.02], gain: [0.97, 1.02, 0.97], vignette: 0.45, grain: 0.3, fringe: 0.15, bloom: [0.5, 0.5, 0.8], toneExposure: 1.0 },
  flagship_night: { exposure: 0.9, sat: 0.7, contrast: 1.1, lift: [0.0, 0.01, 0.02], gamma: [1, 1, 1], gain: [0.98, 1.0, 1.05], vignette: 0.55, grain: 0.3, fringe: 0.15, bloom: [0.6, 0.5, 0.75], toneExposure: 1.0 },
  dawn_gold:      { exposure: 1.05, sat: 1.0, contrast: 1.05, lift: [0.02, 0.015, 0.0], gamma: [1, 1, 1], gain: [1.12, 1.02, 0.88], vignette: 0.35, grain: 0.2, fringe: 0.1, bloom: [0.7, 0.6, 0.75], toneExposure: 1.05 },
  dry_gold:       { exposure: 1.1, sat: 0.85, contrast: 1.08, lift: [0.03, 0.02, 0.0], gamma: [1, 1, 1], gain: [1.1, 1.02, 0.85], vignette: 0.35, grain: 0.25, fringe: 0.12, bloom: [0.5, 0.5, 0.85], toneExposure: 1.05 },
  summer_haze:    { exposure: 1.12, sat: 0.8, contrast: 1.0, lift: [0.04, 0.04, 0.03], gamma: [1, 1, 1], gain: [1.05, 1.03, 0.95], vignette: 0.3, grain: 0.22, fringe: 0.12, bloom: [0.6, 0.6, 0.8], toneExposure: 1.08 },
  office_blue:    { exposure: 0.95, sat: 0.7, contrast: 1.12, lift: [0.0, 0.01, 0.03], gamma: [1, 1, 1], gain: [0.94, 1.0, 1.08], vignette: 0.45, grain: 0.25, fringe: 0.15, bloom: [0.7, 0.5, 0.7], toneExposure: 1.0 },
  autumn_amber:   { exposure: 1.05, sat: 1.05, contrast: 1.05, lift: [0.02, 0.01, 0.0], gamma: [1, 1, 1], gain: [1.1, 1.0, 0.86], vignette: 0.35, grain: 0.22, fringe: 0.1, bloom: [0.6, 0.55, 0.8], toneExposure: 1.02 },
  frost_blue:     { exposure: 1.05, sat: 0.7, contrast: 1.05, lift: [0.01, 0.02, 0.04], gamma: [1, 1, 1], gain: [0.95, 1.0, 1.08], vignette: 0.35, grain: 0.22, fringe: 0.1, bloom: [0.6, 0.55, 0.8], toneExposure: 1.05 },
  snow_steel:     { exposure: 1.05, sat: 0.6, contrast: 1.08, lift: [0.01, 0.02, 0.035], gamma: [1, 1, 1], gain: [0.96, 1.0, 1.06], vignette: 0.4, grain: 0.25, fringe: 0.1, bloom: [0.6, 0.55, 0.8], toneExposure: 1.05 },
  fire_orange:    { exposure: 1.0, sat: 1.05, contrast: 1.15, lift: [0.02, 0.005, 0.0], gamma: [1, 1, 1], gain: [1.15, 0.95, 0.8], vignette: 0.5, grain: 0.3, fringe: 0.2, bloom: [0.9, 0.6, 0.6], toneExposure: 1.0 },
  desert_ochre:   { exposure: 1.1, sat: 1.1, contrast: 1.08, lift: [0.02, 0.01, 0.0], gamma: [1, 1, 1], gain: [1.1, 1.0, 0.9], vignette: 0.3, grain: 0.2, fringe: 0.1, bloom: [0.5, 0.5, 0.85], toneExposure: 1.05 },
  perth_night:    { exposure: 0.95, sat: 0.95, contrast: 1.12, lift: [0.01, 0.005, 0.01], gamma: [1, 1, 1], gain: [1.1, 0.95, 0.9], vignette: 0.5, grain: 0.28, fringe: 0.15, bloom: [0.8, 0.55, 0.7], toneExposure: 1.0 },
  morning_green:  { exposure: 1.05, sat: 0.85, contrast: 1.02, lift: [0.01, 0.02, 0.01], gamma: [1, 1, 1], gain: [0.98, 1.04, 0.96], vignette: 0.3, grain: 0.2, fringe: 0.1, bloom: [0.6, 0.55, 0.8], toneExposure: 1.05 },
};
