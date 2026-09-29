// ============================================================================
// Areas 1D (the Landlines hideout: an office basement, the back lanes, the QZ wall) and 1E (under the wall: the drainage
// tunnel and the flooded street outside), scenes 1.5 (The Package) and 1.7 (The Scan), the 1.6 walk-and-talk (Under the
// Wall), the Landlines basement optional conversation, collectibles and Chloe's remarks (spec §9 1.5–1.7, §17).
// Flow beats ch1.5, ch1.6, ch1.7. Owned by: level agent (c1c).
//
// 1D — origin [1200,0,3000]; +Z north. The basement (x −8..8, z 0..14, ceiling 2.9) of an old office block that stands on
//   the slope: the front stairs come down from Albert Street (the stairwell south of z 0, door x 5.6), the back door (x −5.5,
//   z 14) opens at grade onto the lanes. Chloe's crate under the bare bulb (0.2, 7.4); the Operator's chair and her radio
//   (4.7, 8.6); the radio table and the switchboard on the east wall; the strung maps and the painted cord on the north wall;
//   cots, the kitchen and the first-aid table on the west side.
//   Lanes: A runs north (x −8.5..−2.5, z 14..36), B runs west (x −34..−2.5, z 36..44) — a COMMS curfew patrol of two walks it
//   with torches — and opens onto the apron under the QZ wall (wall face x −39.5, z 26..54). A watchtower at the north end
//   sweeps the apron with a searchlight (stand in the beam and the arc fills; full, and the tower opens fire). The culvert
//   through the wall (z 38.6..41.4) is behind a rusted grate: squeeze through the bent bars; 6 m into the dark the tunnel
//   continues seamlessly in 1E (the tunnel is identical there; the player and the companions keep their offsets).
// 1E — origin [1600,0,3000]; the grate at local x 0 (same cross-section: z −1.4..1.4, 2.4 high, floor y 0). The tunnel runs
//   west: a street-drain shaft of light at x −14, the camp where someone waited it out (x −24..−30: tally, candles, a sleeping
//   bag, the lost lanyard), luminous Landlines cords on the walls, silt and phones at the second grate (x −36), the outfall at
//   x −50 into Ann Street, flooded shin-deep (x −50..−100). The COMMS dinghy and its spotlight; the drowned tower leaning
//   over the city to the west (the way to 1F).
// Flow: ch1.5 hard-cuts from 1.4's held frame into 1D and plays 1.5; it blends out into gameplay (Chase in the basement, Chloe
//   and Wai companions; the optional conversation and the collectibles). ch1.6 (checkpoint) sets all of that up again when it
//   runs first; the walk-and-talk starts at the back door, pauses near the patrol, and ends with "Tunnel. Shut up." at the
//   grate (the squeeze opens only then). The flow ends in the 1E tunnel near the outfall; ch1.7 plays scene 1.7, which ends
//   HELD (exit hold, letterbox on) on the three of them wading off toward the drowned tower — 1.8 opens with a cut.
// Markers (1D): mk_start · mk_15_* (1.5 blocking) · mk_16_chase / mk_16_chloe / mk_16_wai / mk_16_op (1.6 start) ·
//   mk_1d_grate (the squeeze). (1E): mk_start · mk_1e_chase / mk_1e_chloe / mk_1e_wai (near the outfall) · mk_17_* (1.7) ·
//   mk_17_end_* (where 1.7 leaves the three of them, in the street heading west).
// Persistent actors: chase, wai (bruised; companion with his bat, a torch in the tunnel), chloe (companion from 1.6),
//   operator (wounded; sits in her chair in 1D, hidden when 1D unloads). Area chars: landline (1D, at the radios),
//   soldier / soldier_b (1E, the patrol in 1.7).
// ============================================================================
(() => {
  const PI = Math.PI, H = CONTENT.hooks, OD = [1200, 0, 3000], OE = [1600, 0, 3000];
  const M = (n, o) => Tex.mat(n, o), C = (h, o) => Tex.color(h, o);
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const d = (x, y, z) => [OD[0] + x, y, OD[2] + z], e = (x, y, z) => [OE[0] + x, y, OE[2] + z];
  const PROFILE = { combat: true, hud: true, canCrouch: true, canJump: true, weapons: ['revolver', 'shotgun'], melee: 'fists', stats: 'chase' };
  const GRATE_D = [-40, 0, 40], GRATE_E = [0, 0, 0];           // the same grate in both areas (local)
  const GY_E = -0.36;                                            // Ann Street's roadway under the flood (1E)
  const SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif';
  const once = (() => { const m = new Map(); return (k, fn) => { if (!m.has(k)) { const t = fn(); t.userData.shared = true; m.set(k, t); } return m.get(k); }; })();
  function canvas(w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }

  // ---- collectibles, remarks, talks ------------------------------------------------------------------------------------
  CONTENT.collectibles.artifacts.push({ id: 'c1_dialtone', chapter: 'ch1', title: 'Landlines pamphlet: the dial tone',
    text: "WHEN YOU'RE LOST IN THE STATIC, LISTEN FOR THE DIAL TONE.\n\n" +
      'Before the Update, when you picked up a phone, the first thing you heard was a steady hum. It meant the line was open. ' +
      'It meant somebody, somewhere, had strung copper and glass across a whole country so your voice could reach anyone who picked up.\n\n' +
      'Nobody listened to it. It was just the sound before the call.\n\n' +
      'The Feed wants your eyes. The dial tone never wanted anything. It just waited for you to speak.\n\n' +
      'We kept the exchanges running. We are still here. We are still listening.\n\n' +
      "Look for the coiled cord. Keep your head up and your screen off. Don't answer anything that glows.\n\n— THE LANDLINES" });
  CONTENT.collectibles.lanyards.push({ id: 'c1_lanyard_tunnel', chapter: 'ch1', title: '—— · Trainee · Fortitude Valley' });
  CONTENT.collectibles.modules.push({ id: 'c1_module_lane', chapter: 'ch1', title: 'Sales Training Module: Reading the Room', skill: 'listen_range' });
  Object.assign(CONTENT.remarks, {
    c1d_map: { text: "Perth's got the most string. Everything goes to Perth.", emote: 'neutral' },
    c1d_radio: { text: 'They let me sit up with the radios. Mostly static. Sometimes someone laughs.', emote: 'tender' },
    c1d_cot: { text: 'Three weeks on that cot. I counted the pipes. Forty-four.', emote: 'smirk' },
    c1d_wai_radio: { text: "Car batteries and a soldering iron. Someone's kept these alive. That's love, that is.", emote: 'smile' },
    c1d_wai_switch: { text: 'A PMG switchboard. My nan ran one of these in Toowoomba.', emote: 'tender' },
    c1d_cord: { text: "Dial tone. We're on the right track.", emote: 'smile' },
    c1d_poster: { text: 'They hung these in our classroom.', emote: 'sad' },
    c1d_wall: { text: "I've never been on the other side of it. Not since I was eight.", emote: 'afraid' },
    c1e_phones: { text: 'Everyone just dropped them. Like they were hot.', emote: 'neutral' },
    c1e_tally: { text: 'Somebody counted to forty-one down here.', emote: 'sad' },
    c1e_shoe: { text: '', silent: true, emote: 'sad' },
  });
  // the basement: Chloe and Wai; Chase listens (spec §17)
  CONTENT.talks['c1d.basement'] = { lines: [
    { who: 'chloe', text: 'Were you really a store manager?', emote: 'smile', to: 'wai' },
    { who: 'wai', text: 'Best in Queensland.', emote: 'smirk', to: 'chloe' },
    { who: 'chloe', text: 'What did you actually do?', emote: 'smirk', to: 'wai' },
    { who: 'wai', text: 'Taught teenagers to smile at people who were yelling at them.', emote: 'smile', to: 'chloe' },
    { who: 'chloe', text: 'Sounds hard.', emote: 'neutral', to: 'wai' },
    { who: 'wai', text: 'Hardest job in the world. Till the world ended.', emote: 'sad', pause: 0.6, to: 'chloe' },
  ] };
  // 1.6 — Chloe's first walk-and-talk (spec §9). Split where she takes out the manual; "Tunnel. Shut up." plays at the grate.
  CONTENT.talks['c1.6a'] = { resume: { who: 'chloe', text: 'Anyway. Like I was saying.', emote: 'smirk' }, lines: [
    { who: 'chloe', text: 'So what do I call you?', emote: 'smile', to: 'chase' },
    { who: 'chase', text: "You don't.", emote: 'neutral', to: 'chloe' },
    { who: 'chloe', text: 'What do I call him?', emote: 'smirk', to: 'wai' },
    { who: 'wai', text: 'Chase.', emote: 'smile', to: 'chloe' },
    { who: 'chloe', text: 'Chase. Like a car chase.', emote: 'smirk', to: 'chase' },
    { who: 'chase', text: 'Like be quiet.', emote: 'tense', to: 'chloe' },
  ] };
  CONTENT.talks['c1.6b'] = { resume: { who: 'chloe', text: 'Anyway. Like I was saying.', emote: 'smirk' }, lines: [
    { who: 'chloe', text: 'Step one. "Greet the customer. Use their name and smile!"', emote: 'neutral', to: 'chase' },
    { who: 'chloe', text: 'Hi, Chase.', emote: 'smile', pause: 0.5, to: 'chase' },
    { who: 'chase', text: "Where'd you get that?", emote: 'neutral', pause: 0.6, to: 'chloe' },
    { who: 'chloe', text: 'The depot. Every trainee gets one. Nobody reads it. I’ve read it forty times.', emote: 'smirk', to: 'chase' },
    { who: 'wai', text: 'The Yes Way. God, I wrote the quiz for that.', emote: 'laugh', to: 'chloe' },
    { who: 'chloe', text: 'You did not.', emote: 'shocked', to: 'wai' },
    { who: 'wai', text: 'Step five, handle objections, "every no is just a not yet". That was me.', emote: 'smirk', to: 'chloe' },
    { who: 'chloe', text: "That's my favourite one.", emote: 'tender', pause: 0.5, to: 'wai' },
  ] };

  // ---- canvas textures (drawn once) --------------------------------------------------------------------------------------
  // a radio set's front panel: frequency window, dials, a VU needle, switches, a stencilled model number
  const radioFace = k => once('c1d_radio' + k, () => canvas(256, 128, (g, w, h) => {
    const r = U.rng(40 + k);
    g.fillStyle = ['#3a3e34', '#2c3034', '#4a4232', '#34302c'][k]; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 3; g.strokeRect(4, 4, w - 8, h - 8);
    g.fillStyle = '#120c06'; g.fillRect(16, 16, 128, 36);
    const gr = g.createLinearGradient(16, 16, 16, 52); gr.addColorStop(0, '#ffb454'); gr.addColorStop(1, '#c86a1c');
    g.fillStyle = gr; g.globalAlpha = 0.85; g.fillRect(20, 20, 120, 28); g.globalAlpha = 1;
    g.strokeStyle = '#3a2008'; g.lineWidth = 1;
    for (let i = 0; i < 24; i++) { g.beginPath(); g.moveTo(22 + i * 5, 48); g.lineTo(22 + i * 5, i % 4 ? 42 : 36); g.stroke(); }
    g.strokeStyle = '#d8200c'; g.lineWidth = 2; const nx = 30 + r() * 100; g.beginPath(); g.moveTo(nx, 20); g.lineTo(nx, 48); g.stroke();
    g.fillStyle = '#1a1c18'; g.fillRect(156, 16, 84, 44);
    g.fillStyle = '#e8dcb0'; g.beginPath(); g.arc(198, 58, 36, PI * 1.15, PI * 1.85); g.lineTo(198, 58); g.fill();
    g.strokeStyle = '#1a1a1a'; g.lineWidth = 2; g.beginPath(); g.moveTo(198, 56); g.lineTo(198 + Math.cos(PI * 1.3 + r() * 0.4) * 32, 56 + Math.sin(PI * 1.3 + r() * 0.4) * 32); g.stroke();
    for (const [x, rr] of [[36, 16], [80, 12], [118, 12], [210, 14]]) {
      g.fillStyle = '#0e0e0e'; g.beginPath(); g.arc(x, 92, rr, 0, PI * 2); g.fill();
      g.fillStyle = '#5a5a56'; g.beginPath(); g.arc(x - rr * 0.25, 92 - rr * 0.25, rr * 0.35, 0, PI * 2); g.fill();
    }
    g.fillStyle = '#c8c0a8'; g.font = 'bold 11px monospace'; g.fillText(['AWA TR-9', 'CODAN 8528', 'PRC-77', 'KENWOOD'][k], 150, 82);
    for (let i = 0; i < 4; i++) { g.fillStyle = i === 1 ? '#3aff6a' : '#6a1a10'; g.beginPath(); g.arc(160 + i * 12, 118 - 6, 3, 0, PI * 2); g.fill(); }
    for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,240,220'},${r() * 0.05})`; g.fillRect(r() * w, r() * h, 2, 2); }
  }));
  // a PMG cord switchboard: a field of jacks with lamps, keys along the shelf
  const switchFace = () => once('c1d_switch', () => canvas(256, 256, (g, w, h) => {
    g.fillStyle = '#1e1a16'; g.fillRect(0, 0, w, h);
    for (let j = 0; j < 8; j++) for (let i = 0; i < 10; i++) {
      const x = 18 + i * 23, y = 18 + j * 28;
      g.fillStyle = (i * 7 + j * 3) % 11 === 0 ? '#ffcf6a' : '#3a2e22'; g.beginPath(); g.arc(x, y, 4, 0, PI * 2); g.fill();
      g.fillStyle = '#060606'; g.beginPath(); g.arc(x, y + 11, 5, 0, PI * 2); g.fill();
      g.strokeStyle = '#8a7a5a'; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y + 11, 6.5, 0, PI * 2); g.stroke();
    }
    g.fillStyle = '#c8b890'; g.font = 'bold 12px monospace'; g.fillText('P.M.G.  BRISBANE  EXCH.  No 4', 22, 248);
  }));
  // the big map of Australia: coast, state borders, cities; Chloe's route pencilled on (the cords are 3D)
  const AUS = [[142.5, -10.7], [143.5, -14], [145.3, -15], [146, -17], [146.3, -19], [148.8, -20.3], [150.8, -22.5], [151.5, -24], [153.1, -25.5], [153.6, -28.2], [153.3, -30], [152.9, -31.5], [151.8, -33], [151.3, -33.9], [150.9, -34.6], [150.2, -35.8], [149.9, -37.5], [148.2, -37.8], [146.4, -39.1], [145, -38.4], [144.5, -38.2], [143.5, -38.8], [141.6, -38.4], [140.4, -37.9], [139.6, -36.9], [138.9, -35.6], [138.5, -35], [138.6, -34.6], [138, -33.2], [137.8, -32.6], [137.2, -33.6], [136, -34.8], [135.2, -34.6], [134.2, -32.9], [132.3, -31.9], [131, -31.5], [129, -31.7], [126.5, -32.3], [124, -33.3], [123.5, -33.9], [121.8, -33.9], [119.9, -34], [118.3, -35], [116.6, -35], [115.1, -34.3], [115.6, -33.3], [115.7, -31.9], [115, -30], [114.9, -29], [114.2, -27.5], [113.4, -26], [113.7, -24.5], [113.4, -23.5], [113.9, -22], [114.6, -21.8], [116.7, -20.6], [118.8, -20.3], [121, -19.5], [122.2, -18], [123.6, -16.4], [124.8, -15.3], [126.1, -14], [127.4, -13.9], [128.2, -15], [129.7, -14.9], [130.3, -12.7], [131, -12.2], [132.6, -11.5], [133.9, -11.8], [136, -12], [136.9, -12.3], [136, -13.5], [135.5, -15], [137.8, -16.3], [139.3, -17.4], [140.8, -17.4], [141.6, -15.5], [141.6, -12.9]];
  const TAS = [[144.6, -40.7], [146.6, -41.1], [148.3, -40.9], [148.3, -42.2], [147.9, -43.2], [146.9, -43.6], [145.9, -43.5], [145.2, -42.3]];
  const CITY = { BRISBANE: [153.03, -27.47], SYDNEY: [151.2, -33.87], CANBERRA: [149.13, -35.28], MELBOURNE: [144.96, -37.81], ADELAIDE: [138.6, -34.93], PERTH: [115.86, -31.95], DARWIN: [130.84, -12.46], HOBART: [147.33, -42.88] };
  const mapUV = ([lon, lat]) => [(lon - 111) / 45, (lat + 8.5) / -37];          // 0..1 across the sheet
  const ausMap = () => once('c1d_aus', () => canvas(1024, 842, (g, w, h) => {
    const r = U.rng(77), P = p => { const [u, v] = mapUV(p); return [u * w, v * h]; };
    g.fillStyle = '#b8c4bc'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { g.strokeStyle = 'rgba(40,70,80,0.08)'; g.beginPath(); g.moveTo(0, i * 22); g.lineTo(w, i * 22 + 10); g.stroke(); }
    const shape = pts => { g.beginPath(); pts.forEach((p, i) => { const [x, y] = P(p); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); };
    for (const pts of [AUS, TAS]) { shape(pts); g.fillStyle = '#e6dcc0'; g.fill(); g.strokeStyle = '#4a4a40'; g.lineWidth = 2.5; g.stroke(); }
    g.setLineDash([8, 6]); g.strokeStyle = 'rgba(90,70,60,0.7)'; g.lineWidth = 1.5;
    for (const line of [[[129, -14.9], [129, -31.7]], [[129, -26], [138, -26]], [[138, -16.3], [138, -26], [141, -26], [141, -38.3]], [[141, -29], [153.5, -28.3]], [[141, -34], [144.5, -35.9], [148.2, -37.8]]]) {
      g.beginPath(); line.forEach((p, i) => { const [x, y] = P(p); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
    }
    g.setLineDash([]);
    g.font = 'bold 17px ' + SANS; g.textBaseline = 'middle';
    for (const [n, p] of Object.entries(CITY)) {
      const [x, y] = P(p); g.fillStyle = '#1a1a1a'; g.beginPath(); g.arc(x, y, 5, 0, PI * 2); g.fill();
      g.fillStyle = '#2a2622'; g.textAlign = x > w * 0.7 ? 'right' : 'left'; g.fillText(n, x + (x > w * 0.7 ? -10 : 10), y - 12);
    }
    g.textAlign = 'left'; g.fillStyle = '#3a3a34'; g.font = 'bold 44px ' + SANS; g.fillText('AUSTRALIA', 40, 70);
    g.font = '16px ' + SANS; g.fillText('TELECOM TRUNK NETWORK — 1:5 000 000', 42, 104);
    // pencil: circled cities, a question mark in the Snowy, "BLACK SPOT?" and the Nullarbor crossed with arrows
    g.strokeStyle = '#1c1c20'; g.lineWidth = 2;
    for (const n of ['BRISBANE', 'PERTH']) { const [x, y] = P(CITY[n]); g.beginPath(); g.ellipse(x, y, 22, 16, 0.2, 0, PI * 2); g.stroke(); }
    g.font = 'italic 22px ' + SANS; g.fillStyle = '#1c1c20';
    const [sx, sy] = P([148.3, -36.4]); g.fillText('?', sx - 30, sy + 4); g.font = 'italic 15px ' + SANS; g.fillText('black spot?', sx - 110, sy + 30);
    const [px, py] = P(CITY.PERTH); g.fillText('THE EXCHANGE', px + 12, py + 22);
    for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(${r() < 0.6 ? '90,70,40' : '255,250,235'},${r() * 0.06})`; g.fillRect(r() * w, r() * h, 3, 3); }
    const st = g.createRadialGradient(w * 0.8, h * 0.2, 10, w * 0.8, h * 0.2, 120); st.addColorStop(0, 'rgba(120,90,40,0.25)'); st.addColorStop(1, 'rgba(120,90,40,0)'); g.fillStyle = st; g.fillRect(0, 0, w, h);
  }));
  // the Brisbane street map with the route out: Albert St → the lanes → drain 7 → Ann St → the tower → the flagship
  const cbdMap = () => once('c1d_cbd', () => canvas(512, 384, (g, w, h) => {
    g.fillStyle = '#e4dcc4'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#6a8aa0'; g.lineWidth = 34; g.beginPath(); g.moveTo(-20, 330); g.bezierCurveTo(140, 260, 110, 120, 260, 60); g.bezierCurveTo(360, 20, 460, 120, 540, 90); g.stroke();
    g.strokeStyle = '#b0a888'; g.lineWidth = 7;
    for (let i = 0; i < 8; i++) { g.beginPath(); g.moveTo(60 + i * 58, 0); g.lineTo(20 + i * 58, h); g.stroke(); }
    for (let j = 0; j < 6; j++) { g.beginPath(); g.moveTo(0, 30 + j * 62); g.lineTo(w, 60 + j * 62); g.stroke(); }
    g.strokeStyle = '#1a1a1a'; g.lineWidth = 5; g.setLineDash([12, 8]); g.beginPath(); g.moveTo(90, 300); g.lineTo(200, 300); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#1a1a1a'; g.font = 'bold 13px monospace'; g.fillText('THE WALL', 206, 296);
    g.fillStyle = '#b01a10'; g.font = 'italic bold 16px ' + SANS;
    for (const [t, x, y] of [['US', 330, 250], ['DRAIN 7', 150, 280], ['ANN ST — WADE', 120, 180], ['TOWER — 8+ ROT', 230, 120], ['FLAGSHIP 0600', 330, 70]]) { g.fillText(t, x, y); g.beginPath(); g.arc(x - 8, y - 5, 4, 0, PI * 2); g.fill(); }
  }));

  // ---- 1D kit pieces -------------------------------------------------------------------------------------------------
  let wet = null, glassDark = null, glassLit = null;
  const wetConc = () => wet || (wet = M('concrete_wet', { color: 0x5e625e }));
  // windows set into a facade: dark glass, the odd lit one (curfew: most are dark)
  function facadeWindows(x1, z1, x2, z2, y0, floors, r, o = {}) {
    glassDark = glassDark || C(0x0c1014, { rough: 0.15, metal: 0.4 });
    glassLit = glassLit || C(0x2a1a08, { emissive: 0xffb060, emissiveIntensity: 0.9, rough: 0.4 });
    const L = Math.hypot(x2 - x1, z2 - z1), n = Math.floor(L / (o.pitch ?? 3.2)), yaw = Math.atan2(x2 - x1, z2 - z1) - PI / 2;
    for (let f = 0; f < floors; f++) for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, x = x1 + (x2 - x1) * t, z = z1 + (z2 - z1) * t;
      if (r() < (o.skip ?? 0.1)) continue;
      Build.box(1.3, 1.5, 0.08, r() < (o.lit ?? 0.06) ? glassLit : glassDark, { pos: [x, y0 + f * 3.4 + 0.9, z], yaw, solid: false, ao: false, shadow: false });
    }
  }
  // a zig-zag steel fire escape against a wall facing `face` (yaw), from y 3.4 up `floors` storeys
  function fireEscape(x, z, face, floors) {
    const g = Build.group({ pos: [x, 0, z], yaw: face }), st = M('metal_painted', { color: 0x2c302c }), rs = M('rust', { color: 0x6a4a3a });
    for (let f = 1; f <= floors; f++) {
      const y = f * 3.4;
      Build.box(3.6, 0.06, 1.2, rs, { parent: g, pos: [0, y, 0.7], solid: false });
      for (const s of [-1, 1]) Build.box(0.04, 1, 0.04, st, { parent: g, pos: [s * 1.78, y, 1.28], solid: false });
      Build.box(3.6, 0.04, 0.04, st, { parent: g, pos: [0, y + 0.98, 1.28], solid: false });
      Build.box(3.6, 0.04, 0.04, st, { parent: g, pos: [0, y + 0.5, 1.28], solid: false });
      const dir = f % 2 ? 1 : -1;
      Build.box(0.7, 0.05, 4.4, st, { parent: g, pos: [dir * 0.2, y - 1.7, 0.95], rot: [dir * 0.86, PI / 2, 0], solid: false });
    }
    Build.box(0.5, 0.05, 2.6, st, { parent: g, pos: [-1.3, 2.0, 0.95], rot: [-1.2, PI / 2, 0], solid: false });      // the drop ladder, left down
  }
  function acUnit(x, y, z, yaw) {
    Build.box(0.9, 0.6, 0.55, M('metal_painted', { color: 0xa8aaa0 }), { pos: [x, y, z], yaw, solid: y < 1 });
    Build.box(0.5, 0.5, 0.02, C(0x1a1a1a, { rough: 0.6 }), { pos: [x + Math.sin(yaw) * 0.28, y + 0.05, z + Math.cos(yaw) * 0.28], yaw, solid: false, ao: false });
  }
  // a radio set on a surface: box with the face texture, handle, antenna
  function radioSet(x, y, z, yaw, k, s = 1) {
    const w = 0.46 * s, h = 0.24 * s, dd = 0.3 * s;
    Build.box(w, h, dd, M('metal_painted', { color: [0x4a5040, 0x3a4048, 0x5a5040, 0x403a36][k] }), { pos: [x, y, z], yaw, solid: false });
    const f = U.fwd(yaw);
    Build.decal(radioFace(k), { pos: [x + f.x * (dd / 2 + 0.003), y + h / 2, z + f.z * (dd / 2 + 0.003)], yaw, w: w * 0.96, h: h * 0.92 });
    Build.box(0.012, 0.5 * s, 0.012, C(0x1a1a1a, { rough: 0.4, metal: 0.6 }), { pos: [x - f.z * w * 0.4, y + h, z + f.x * w * 0.4], rot: [0.2, yaw, 0.15], solid: false, ao: false });
  }
  function bareBulb(A, x, y, z, drop) {
    Build.box(0.012, drop, 0.012, C(0x141414), { pos: [x, y, z], solid: false, ao: false, shadow: false });
    Build.box(0.05, 0.06, 0.05, C(0x2a2622, { metal: 0.5 }), { pos: [x, y - 0.06, z], solid: false, ao: false, shadow: false });
    const b = Build.mesh(new THREE.SphereGeometry(0.045, 12, 8), C(0xfff2d0, { emissive: 0xffd890, emissiveIntensity: 6 }), { pos: [x, y - 0.1, z], shadow: false, receive: false });
    Build.glow({ pos: [x, y - 0.1, z], color: 0xffc070, size: 0.9, opacity: 0.9 });
    return b;
  }

  // ---- 1D: the basement -------------------------------------------------------------------------------------------------
  function basement(A, r) {
    const D = A.data, H0 = 2.9;
    const wallM = M('render', { color: 0x7e867c }), floorM = M('concrete', { color: 0x6c6a62, rough: 0.7 }), ceilM = M('concrete', { color: 0x5a5a54 });
    Build.floor(-8, 0, 8, 14, floorM, { surface: 'concrete' });
    Build.box(16.3, 0.2, 14.3, ceilM, { pos: [0, H0, 7], solid: false, shadow: true });
    Build.wall(-8, 0, 8, 0, H0, wallM, { thick: 0.3, trim: false, doors: [{ at: 13.6, w: 1.1, h: 2.1 }] });
    Build.wall(8, 14, -8, 14, H0, wallM, { thick: 0.3, trim: false, doors: [{ at: 13.5, w: 1.1, h: 2.15 }], windows: [{ at: 1.4, w: 1.6, h: 0.8, sill: 1.9 }] });
    Build.wall(-8, 14, -8, 0, H0, wallM, { thick: 0.3, trim: false });
    Build.wall(8, 0, 8, 14, H0, wallM, { thick: 0.3, trim: false });
    for (const [x, z] of [[-4, 4.7], [4, 4.7], [-4, 9.6], [4, 9.6]]) Build.box(0.45, H0, 0.45, M('concrete', { color: 0x8a8a82 }), { pos: [x, 0, z] });
    // ceiling: beams, a duct, pipes, cable tray
    for (const z of [4.7, 9.6]) Build.box(16, 0.4, 0.4, M('concrete', { color: 0x6a6a64 }), { pos: [0, H0 - 0.4, z], solid: false });
    Build.box(0.7, 0.4, 14, M('metal', { color: 0x8a8c88 }), { pos: [-6.2, H0 - 0.45, 7], solid: false });
    for (const [x, rr, c] of [[2.6, 0.06, 0x7a3a2a], [2.85, 0.05, 0x4a5a6a], [6.5, 0.08, 0x5a5a5a]]) Build.box(rr * 2, rr * 2, 14, M('metal_painted', { color: c }), { pos: [x, H0 - 0.25 - rr, 7], solid: false, ao: false });
    Build.box(0.4, 0.05, 14, M('metal', { color: 0x6a6c6a }), { pos: [5.4, H0 - 0.35, 7], solid: false, ao: false });
    // stains, damp, moss where the lane water gets in under the back door
    for (const [x, z, s, k] of [[-7.85, 6, 2.6, 'water_stain'], [7.85, 3, 2.2, 'water_stain'], [-2, 13.85, 3, 'water_stain'], [3, 0.15, 2.4, 'water_stain']]) {
      const yaw = Math.abs(x) > 7 ? (x < 0 ? PI / 2 : -PI / 2) : (z < 1 ? 0 : PI);
      Build.decal(k, { pos: [x, 1.6, z], yaw, w: s, h: 2.6, opacity: 0.7 });
    }
    for (const [x, z, s, k] of [[-5.2, 13, 2.4, 'puddle'], [-5.6, 12.4, 2, 'moss_patch'], [1.5, 5, 3, 'stain'], [5, 9, 2, 'oil'], [-2, 3, 2, 'water_stain']]) Build.decal(k, { floor: true, pos: [x, 0.006, z], w: s, h: s * 0.8, spin: x * z, opacity: 0.75 });
    Build.scatter('debris', { box: [-7.5, 0.5, 7.5, 13.5], count: 90, seed: 21 });
    Build.scatter('paper', { box: [-7, 1, 7, 13], count: 18, seed: 22 });

    // Chloe's corner: the crate under the bare bulb, her backpack, the manual's home
    Build.prop('crate', { kind: 'wood', pos: [0.2, 0, 7.4], yaw: 0.1, w: 0.62, h: 0.44, d: 0.5 });
    D.bulb = bareBulb(A, 0.2, H0 - 0.2, 7.25, 0.35);
    D.bag = Build.prop('school_bag', { pos: [0.75, 0, 7.75], yaw: -0.7, color: 0x4a4436, dynamic: true });
    Build.prop('pallet', { pos: [-0.6, 0, 8.3], yaw: 0.4 });
    Build.prop('crate', { kind: 'milk', pos: [-0.5, 0, 8.4], yaw: 0.2, color: 0x2a4aa0 });
    Build.prop('rug', { pos: [0.3, 0, 6.6], w: 2.6, d: 1.8, color: 0x6a3a2a, border: 0xb8a078 });

    // east: the radio table, the switchboard, the Operator's chair and her own set on a crate beside it
    Build.prop('table', { kind: 'workbench', pos: [7.35, 0, 8.2], yaw: -PI / 2, w: 3.6, d: 0.9 });
    radioSet(7.35, 0.92, 7.0, -PI / 2, 0); radioSet(7.3, 0.92, 7.6, -PI / 2, 1, 0.8); radioSet(7.4, 1.12, 7.45, -PI / 2 + 0.05, 2, 0.7);
    radioSet(7.35, 0.92, 8.6, -PI / 2, 3, 1.1); radioSet(7.3, 0.92, 9.4, -PI / 2 - 0.1, 0, 0.75);
    for (let i = 0; i < 5; i++) Build.box(0.02, 0.26, 0.012, C(0x1a1a1a), { pos: [7.1, 0.91, 6.9 + i * 0.6], rot: [0.9, 0, 0], solid: false, ao: false, shadow: false });
    for (const z of [6.8, 7.3, 9.6]) Build.box(0.26, 0.2, 0.18, M('metal_painted', { color: 0x1a1a1a }), { pos: [7.5, 0, z], solid: false });
    Build.wire([7.5, 0.2, 6.8], [7.35, 0.92, 7.0], { sag: 0.1, r: 0.008, color: 0x8a1a10 });
    Build.wire([7.5, 0.2, 7.3], [7.35, 0.92, 8.6], { sag: 0.2, r: 0.008, color: 0x1a1a1a });
    D.dials = [];
    for (const [x, y, z] of [[7.19, 1.06, 7.0], [7.13, 1.06, 8.6], [7.2, 1.02, 9.4]]) D.dials.push(Build.box(0.01, 0.05, 0.14, C(0x1a0c04, { emissive: 0xff9a3a, emissiveIntensity: 1.8 }), { pos: [x, y, z], solid: false, ao: false, shadow: false, dynamic: true }));
    Build.glow({ pos: [7.0, 1.1, 8.0], color: 0xff9040, size: 2.2, opacity: 0.35 });
    // the switchboard (PMG, rescued from the old exchange), patch cords hanging, headset hook
    const sb = [7.72, 0, 11.4];
    Build.box(0.5, 1.2, 1.3, M('wood', { color: 0x5a3a22 }), { pos: sb });
    Build.box(0.36, 1.1, 1.3, M('wood', { color: 0x4a2e1a }), { pos: [7.8, 1.2, 11.4], solid: false });
    Build.decal(switchFace(), { pos: [7.61, 1.72, 11.4], yaw: -PI / 2, w: 1.2, h: 1.0 });
    for (let i = 0; i < 7; i++) {
      const z0 = 10.9 + r() * 1.0, z1 = 10.9 + r() * 1.0, y0 = 1.3 + r() * 0.9;
      Build.wire([7.58, y0, z0], [7.5, 1.2, (z0 + z1) / 2], { sag: 0.1 + r() * 0.2, r: 0.007, color: [0x2a1a10, 0x6a1a10, 0x1a1a1a][i % 3] });
    }
    Build.box(0.3, 0.04, 1.3, M('wood', { color: 0x6a4a2a }), { pos: [7.52, 1.18, 11.4], solid: false });
    Build.prop('chair', { kind: 'stool', pos: [6.8, 0, 11.3], yaw: PI / 2 });
    // the Operator's corner: an office chair, her own set on a crate, a mug, a first aid kit, bloody gauze
    Build.prop('crate', { kind: 'wood', pos: [4.55, 0, 9.55], yaw: 0.3, w: 0.55, h: 0.5, d: 0.45 });
    radioSet(4.55, 0.5, 9.5, PI + 0.75, 1, 0.85);
    D.opDial = Build.box(0.12, 0.05, 0.01, C(0x1a0c04, { emissive: 0xff9a3a, emissiveIntensity: 2 }), { pos: [4.4, 0.64, 9.35], yaw: PI + 0.75, solid: false, ao: false, shadow: false, dynamic: true });
    Build.prop('chair', { kind: 'office', pos: [4.7, 0, 8.55], yaw: -1.95 });
    Build.decal('blood', { floor: true, pos: [4.6, 0.008, 8.1], w: 0.5, h: 0.4, spin: 1, opacity: 0.8 });

    // north: the maps of Australia strung with cord, the Brisbane map, the painted cord, the slogan
    const mw = 2.2, mh = mw * 842 / 1024, mx = 2.4, my = 1.05, mz = 13.8;
    Build.box(mw + 0.12, mh + 0.12, 0.04, M('plywood', { color: 0x9a8a6a }), { pos: [mx, my - 0.06, mz + 0.02], solid: false });
    Build.decal(ausMap(), { pos: [mx, my + mh / 2, mz - 0.005], yaw: PI, w: mw, h: mh });
    const pin = n => { const [u, v] = mapUV(CITY[n]); return [mx + mw / 2 - u * mw, my + mh - v * mh, mz - 0.03]; };   // the decal faces -Z: u runs to -x
    const pinM = C(0xd02010, { rough: 0.4 });
    for (const n of Object.keys(CITY)) Build.box(0.022, 0.022, 0.03, pinM, { pos: pin(n), solid: false, ao: false, shadow: false });
    const route = ['BRISBANE', 'SYDNEY', 'CANBERRA', 'ADELAIDE', 'PERTH'];
    for (let i = 0; i < route.length - 1; i++) Build.wire(pin(route[i]), pin(route[i + 1]), { sag: 0.01, r: 0.004, color: 0xc81a10 });
    Build.wire(pin('BRISBANE'), pin('DARWIN'), { sag: 0.01, r: 0.004, color: 0x2a4a8a });
    Build.wire(pin('MELBOURNE'), pin('HOBART'), { sag: 0.01, r: 0.004, color: 0x2a4a8a });
    const cw = 0.9, ch = cw * 0.75, cx = 4.85, cy = 1.35;
    Build.box(cw + 0.06, ch + 0.06, 0.03, M('plywood', { color: 0x9a8a6a }), { pos: [cx, cy - 0.03, mz + 0.02], solid: false });
    Build.decal(cbdMap(), { pos: [cx, cy + ch / 2, mz - 0.005], yaw: PI, w: cw, h: ch });
    // cords from the big map out to the Brisbane map and to index cards pinned round it
    Build.wire(pin('BRISBANE'), [cx + cw / 2 - 0.05, cy + ch * 0.35, mz - 0.03], { sag: 0.12, r: 0.004, color: 0xc81a10 });
    const card = C(0xe8e2d0, { rough: 0.9 });
    for (const [x, y] of [[0.95, 1.9], [0.8, 1.35], [3.85, 2.2], [3.9, 0.95], [5.6, 2.3], [5.55, 1.05]]) {
      Build.box(0.15, 0.1, 0.004, card, { pos: [x, y, mz - 0.01], yaw: (r() - 0.5) * 0.3, solid: false, ao: false, shadow: false });
      Build.wire([x, y + 0.08, mz - 0.03], x < 2 ? pin('BRISBANE') : pin('PERTH'), { sag: 0.05, r: 0.003, color: 0xc81a10 });
    }
    Build.decal(Tex.graffiti('', { style: 'cord', color: '#e2dccb', w: 512, h: 512 }), { pos: [-2.6, 0.55, mz - 0.01], yaw: PI, w: 1.7, h: 1.7 });
    Build.decal(Tex.graffiti('LISTEN FOR THE DIAL TONE', { style: 'drip', color: '#d8d0bc', w: 1024, h: 192 }), { pos: [-2.6, 2.25, mz - 0.01], yaw: PI, w: 2.8, h: 0.52 });
    Build.prop('lamp', { kind: 'floor', pos: [4.05, 0, 13.45], yaw: PI - 0.5, on: true });
    Build.prop('table', { kind: 'folding', pos: [2.6, 0, 13.3], w: 1.8, d: 0.6 });
    Build.prop('lamp', { kind: 'desk', pos: [2.0, 0.74, 13.35], yaw: PI - 0.4, on: true });
    Build.box(0.3, 0.02, 0.22, C(0xe8e2d0, { rough: 0.9 }), { pos: [2.7, 0.74, 13.2], yaw: 0.2, solid: false, ao: false });
    Build.box(0.2, 0.02, 0.28, C(0xe0dac8, { rough: 0.9 }), { pos: [3.1, 0.74, 13.3], yaw: -0.3, solid: false, ao: false });
    // the blacked-out windows onto the lane: plywood inside, a line of cold light at the edges
    for (const at of [1.4]) {
      const x = 8 - at;
      Build.box(1.7, 0.9, 0.03, M('plywood', { color: 0x7a6a50 }), { pos: [x, 1.85, 13.82], solid: false });
      Build.box(1.6, 0.02, 0.01, C(0x9ab0c0, { emissive: 0x7a98b0, emissiveIntensity: 1.6 }), { pos: [x, 2.72, 13.8], solid: false, ao: false, shadow: false });
    }
    // the back door out to the lanes
    D.backDoor = Build.prop('office_door', { pos: [-5.5, 0, 14], yaw: 0, w: 1.0, h: 2.08, thick: 0.3, text: 'FIRE EXIT', dynamic: true, worn: 0.8 });
    Build.decal(Tex.graffiti('', { style: 'cord', color: '#e8e2cf', w: 256, h: 256 }), { pos: [-7.1, 1.3, 13.84], yaw: PI, w: 0.5, h: 0.5 });

    // west: cots under fairy lights, Chloe's cot and her tally, shelves of supplies, the kitchen, the first aid table
    for (const [z, dirty] of [[3.2, true], [5.4, true], [11.6, false]]) {
      Build.prop('pallet', { pos: [-6.9, 0, z], yaw: PI / 2, stack: 1 });
      Build.prop('mattress', { pos: [-6.9, 0.14, z], yaw: PI / 2, dirty, w: 0.9, l: 1.9 });
    }
    Build.prop('pallet', { pos: [-6.9, 0, 9.3], yaw: PI / 2 });
    Build.prop('mattress', { pos: [-6.9, 0.14, 9.3], yaw: PI / 2, dirty: false, w: 0.9, l: 1.9 });
    Build.box(0.7, 0.08, 0.5, C(0x7a3a3a, { rough: 0.95 }), { pos: [-6.6, 0.3, 8.6], yaw: 0.2, solid: false });            // her folded blanket
    Build.decal(Tex.graffiti('21', { style: 'tally', color: '#2a2622', w: 256, h: 256 }), { pos: [-7.84, 0.95, 9.4], yaw: PI / 2, w: 0.42, h: 0.42 });
    const doodle = once('c1d_doodle', () => canvas(256, 256, (g, w, h) => {
      g.fillStyle = '#ece6d4'; g.fillRect(0, 0, w, h); g.strokeStyle = '#3a3a40'; g.lineWidth = 3;
      g.beginPath(); g.arc(128, 110, 50, 0, PI * 2); g.stroke(); g.beginPath(); g.arc(110, 100, 6, 0, PI * 2); g.arc(146, 100, 6, 0, PI * 2); g.stroke();
      g.beginPath(); g.arc(128, 122, 22, 0.2, PI - 0.2); g.stroke();
      g.font = 'italic 26px ' + SANS; g.fillStyle = '#3a3a40'; g.fillText('still 1 :)', 70, 210);
    }));
    Build.decal(doodle, { pos: [-7.84, 1.35, 9.0], yaw: PI / 2, w: 0.26, h: 0.26 });
    Build.fairyLights({ points: [[-7.8, 2.4, 2], [-5.8, 2.2, 5], [-7.8, 2.4, 8], [-5.8, 2.2, 11], [-7.8, 2.4, 13.6]], color: 0xffc070, sag: 0.18 });
    Build.prop('bookshelf', { pos: [-7.8, 0, 7.1], yaw: PI / 2, w: 0.9, h: 1.8, fill: 0.6, color: 0x5a4a3a });
    Build.prop('shelving', { pos: [-4.8, 0, 0.45], yaw: 0, w: 2.2, h: 2.0, d: 0.5, levels: 4, fill: 0.55 });
    for (const [x, z] of [[-7.3, 0.6], [-6.6, 0.6], [-7.3, 1.3]]) Build.prop('barrel', { kind: 'plastic', pos: [x, 0, z] });
    Build.prop('table', { kind: 'folding', pos: [-2.2, 0, 0.7], w: 1.6, d: 0.7 });
    Build.prop('camp_stove', { pos: [-2.6, 0.74, 0.7], lit: true });
    Build.scatter('cans', { box: [-1.9, 0.5, -1.5, 0.9], count: 6, seed: 5, y: 0.74 });
    Build.prop('cardboard_box', { pos: [-0.7, 0, 0.5], w: 0.6, h: 0.45, d: 0.45, stack: 2 });
    Build.prop('esky', { pos: [-3.4, 0, 1.2], yaw: 0.4 });
    Build.prop('table', { kind: 'folding', pos: [2.2, 0, 1.1], w: 1.4, d: 0.7 });
    Build.box(0.34, 0.14, 0.24, C(0xe8e4dc, { rough: 0.6 }), { pos: [2.0, 0.74, 1.1], yaw: 0.2, solid: false });
    Build.box(0.05, 0.004, 0.14, C(0xc82a22), { pos: [2.0, 0.885, 1.1], yaw: 0.2, solid: false, ao: false });
    Build.decal('blood', { pos: [2.5, 0.745, 1.05], floor: true, w: 0.5, h: 0.4, spin: 2 });
    Build.decal('blood', { floor: true, pos: [2.6, 0.007, 1.6], w: 0.9, h: 0.7, spin: 0.5, opacity: 0.8 });
    Build.box(0.2, 0.03, 0.14, C(0xd8c8c0, { rough: 0.95 }), { pos: [2.55, 0.745, 1.25], yaw: 0.6, solid: false, ao: false });
    Build.prop('rubbish_bag', { pos: [3.4, 0, 0.5], n: 2 });
    // the office that was: desks stacked against the wall, a dead plant, a whiteboard with the run
    Build.prop('filing_cabinet', { pos: [-0.8, 0, 13.6], yaw: PI, open: 1 });
    Build.prop('filing_cabinet', { pos: [-0.2, 0, 13.6], yaw: PI });
    Build.prop('plant_pot', { pos: [7.4, 0, 13.4], kind: 'dead', pot: 'planter' });
    Build.prop('whiteboard', { pos: [-7.84, 1.0, 12.6], yaw: PI / 2, stand: false, w: 1.3, h: 0.85, text: 'TONIGHT\nDRAIN 7 → ANN ST\nr:TOWER — GOGGLES ON\nFLAGSHIP 0600\nb:bring her home' });
    Build.poster('landlines_dialtone', { pos: [7.84, 1.7, 3.0], yaw: -PI / 2, w: 0.62, worn: 0.4 });
    Build.poster('comms_look_up', { pos: [7.84, 1.65, 4.3], yaw: -PI / 2, w: 0.6, worn: 0.7 });
    Build.decal(Tex.graffiti('', { style: 'cord', color: '#c81a10', w: 256, h: 256 }), { pos: [7.8, 1.7, 4.3], yaw: -PI / 2, w: 0.55, h: 0.55 });
    Build.prop('ceiling_light', { kind: 'tube', pos: [-2, H0 - 0.02, 4], on: false });
    Build.prop('ceiling_light', { kind: 'tube', pos: [2, H0 - 0.02, 11], on: false });

    // the stairwell up to Albert Street (the way they came in): concrete flights, a cold light from the street door
    Build.floor(4.9, -6.8, 6.5, 0, M('concrete', { color: 0x6a6a64 }), {});
    Build.stairs({ from: [5.7, 0, -0.3], to: [5.7, 3.2, -5.5], width: 1.2, mat: M('concrete', { color: 0x7a7a74 }), rail: true });
    Build.floor(4.9, -6.8, 6.5, -5.5, M('concrete', { color: 0x6a6a64 }), { y: 3.2 });
    Build.wall(4.9, -6.8, 4.9, 0, 6.4, M('render', { color: 0x6e746c }), { thick: 0.2, trim: false });
    Build.wall(6.5, 0, 6.5, -6.8, 6.4, M('render', { color: 0x6e746c }), { thick: 0.2, trim: false });
    Build.wall(4.9, -6.8, 6.5, -6.8, 6.4, M('render', { color: 0x6e746c }), { thick: 0.2, trim: false, doors: [{ at: 0.8, w: 1.0, h: 2.1 }] });
    Build.box(1.9, 0.2, 7, M('concrete', { color: 0x5a5a54 }), { pos: [5.7, 6.4, -3.4], solid: false });
    Build.box(1.0, 2.1, 0.05, C(0x8ea0b0, { emissive: 0x6a8098, emissiveIntensity: 0.9 }), { pos: [5.7, 3.2, -6.72], solid: false, ao: false });
    Build.decal('water_stain', { pos: [5.7, 4.5, -6.65], w: 1.6, h: 3, opacity: 0.6 });
    Build.poster('comms_curfew', { pos: [4.99, 4.8, -4.4], yaw: PI / 2, w: 0.55, worn: 0.6 });
    A.dark([-8, 0, 8, 14], 0.35);
  }

  // ---- the night sky, the city inside the wall, the dark city outside it, the drowned tower leaning over it all ------------
  function nightSky(A, pos, towers, tower) {
    const g = new THREE.SphereGeometry(600, 24, 12), p = g.attributes.position, col = [], c = new THREE.Color(), hz = new THREE.Color(0x2c3434), zen = new THREE.Color(0x06090b);
    for (let i = 0; i < p.count; i++) { const y = p.getY(i) / 600; c.copy(hz).lerp(zen, U.smooth(U.clamp(y * 3))); col.push(c.r, c.g, c.b); }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    A.data.sky = Build.mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }), { pos, shadow: false, receive: false });
    const r = U.rng(19), boxes = [], lit = [];
    for (const [x0, z0, x1, z1, n, dark] of towers) for (let i = 0; i < n; i++) {
      const x = x0 + r() * (x1 - x0), z = z0 + r() * (z1 - z0), w = 10 + r() * 22, h = 20 + Math.pow(r(), 1.5) * (dark ? 70 : 110), b = new THREE.BoxGeometry(w, h, w * (0.7 + r() * 0.6));
      b.translate(x, h / 2 - 1, z);
      const cc = new THREE.Color(dark ? 0x0c1012 : 0x141a1c).multiplyScalar(0.8 + r() * 0.5), arr = [];
      for (let k = 0; k < b.attributes.position.count; k++) arr.push(cc.r, cc.g, cc.b);
      b.setAttribute('color', new THREE.Float32BufferAttribute(arr, 3)); b.deleteAttribute('uv'); b.deleteAttribute('normal'); boxes.push(b);
      if (!dark) for (let k = 0; k < 3 + r() * 8; k++) { const q = new THREE.PlaneGeometry(1.4, 1.2), s = r() < 0.5 ? 1 : -1; q.rotateY(s > 0 ? 0 : PI); q.translate(x + (r() - 0.5) * w * 0.8, 3 + r() * (h - 6), z + s * (w * 0.35 + 0.02)); q.deleteAttribute('uv'); q.deleteAttribute('normal'); lit.push(q); }
    }
    Build.mesh(mergeGeometries(boxes), new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }), { shadow: false, receive: false });
    if (lit.length) Build.mesh(mergeGeometries(lit), new THREE.MeshBasicMaterial({ color: 0xffb468, fog: false, side: THREE.DoubleSide }), { shadow: false, receive: false });
    if (tower) {   // the tilted tower of 1F: a dark slab leaning, screen-rot glowing blue on its top floors
      const [tx, tz, ty = -2] = tower, t = Build.group({ pos: [tx, ty, tz], rot: [0.06, 0.5, -0.11] });
      Build.mesh(new THREE.BoxGeometry(26, 110, 22).translate(0, 55, 0), new THREE.MeshBasicMaterial({ color: 0x0a0e10, fog: false }), { parent: t, shadow: false, receive: false });
      const pts = [];
      for (let k = 0; k < 26; k++) { const q = new THREE.PlaneGeometry(3 + r() * 5, 1.2 + r() * 2.5); q.translate((r() - 0.5) * 22, 70 + r() * 36, 11.05); pts.push(q); }
      A.data.rotGlow = Build.mesh(mergeGeometries(pts), new THREE.MeshBasicMaterial({ color: 0x3aa8ff, fog: false, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }), { parent: t, shadow: false, receive: false });
      Build.glow({ pos: [tx, ty + 97, tz], color: 0x2a78d8, size: 70, opacity: 0.22 });
    }
  }

  // ---- 1D: the lanes -----------------------------------------------------------------------------------------------------
  function lanes(A, r) {
    const D = A.data, asph = M('asphalt', { color: 0x4a4c4a, rough: 0.55 }), brick = M('brick', { color: 0x6a4a3e }), rend = M('render', { color: 0x7a7a70 }), dark = M('render', { color: 0x5a5e58 });
    Build.floor(-8.5, 14, -2.5, 36, asph, { surface: 'concrete' });
    Build.floor(-34, 36, -2.5, 44, asph, { surface: 'concrete' });
    // the blocks either side
    Build.box(11.5, 14, 22, brick, { pos: [-14.25, 0, 25] });              // W1 (the lane's west side, the south side of lane B)
    Build.box(14, 14, 22, brick, { pos: [-27, 0, 25] });
    Build.box(12.5, 11, 34, rend, { pos: [3.75, 0, 31] });                  // E1 (east of lane A, closing lane B's east end)
    Build.box(31.5, 13, 12, dark, { pos: [-18.25, 0, 50] });                // N1 (north side of lane B)
    Build.box(16.6, 16, 14.6, M('render', { color: 0x6c706a }), { pos: [0, 2.9, 7], solid: false });   // the office block over the basement
    facadeWindows(-8.45, 15, -8.45, 35, 3.6, 3, r, { lit: 0.03 });
    facadeWindows(-2.55, 35, -2.55, 15, 3.6, 3, r, { lit: 0.04 });
    facadeWindows(-33, 43.95, -3.5, 43.95, 3.6, 3, r, { lit: 0.08 });
    facadeWindows(-9, 36.05, -33, 36.05, 3.6, 3, r, { lit: 0.03 });
    fireEscape(-8.2, 24, PI / 2, 3);
    fireEscape(-17, 36.3, 0, 3);
    fireEscape(-26, 43.7, PI, 2);
    // lane A: bins, the curfew posters, the cord on a door, a fig breaking the corner, overhead wires, the module in the nook
    Build.prop('bin', { kind: 'wheelie', pos: [-3.1, 0, 17.5], yaw: -PI / 2, worn: 0.8 });
    Build.prop('bin', { kind: 'recycle', pos: [-3.1, 0, 18.3], yaw: -PI / 2 - 0.2, worn: 0.8 });
    Build.prop('rubbish_bag', { pos: [-3.4, 0, 19.4], n: 3 });
    Build.prop('pallet', { pos: [-8.2, 0, 17], yaw: PI / 2, tilt: 0.3 });
    Build.prop('pallet', { pos: [-8.2, 0, 17.9], yaw: PI / 2, tilt: 0.25 });
    Build.prop('mattress', { pos: [-3.0, 0, 27.5], yaw: 0.1, dirty: true });
    Build.prop('tyre', { pos: [-7.8, 0, 29], stack: 3 });
    acUnit(-2.9, 2.6, 22, -PI / 2); acUnit(-2.9, 5.9, 26, -PI / 2); acUnit(-8.1, 3.2, 31, PI / 2);
    Build.poster('comms_execution', { pos: [-2.58, 1.6, 21.2], yaw: -PI / 2, w: 0.64, worn: 0.5 });
    Build.poster('comms_look_up', { pos: [-2.58, 1.6, 22.0], yaw: -PI / 2, w: 0.6, worn: 0.8 });
    Build.box(0.08, 2.2, 1.1, M('metal_painted', { color: 0x3a4a3a }), { pos: [-8.45, 0, 30], solid: false });
    Build.decal(Tex.graffiti('', { style: 'cord', color: '#e8e2cf', w: 256, h: 256 }), { pos: [-8.4, 1.35, 30], yaw: PI / 2, w: 0.55, h: 0.55 });
    Build.decal(Tex.graffiti("GONE 99 DON'T OPEN", { style: 'drip', color: '#c8161d', w: 1024, h: 256 }), { pos: [-2.56, 1.4, 31.5], yaw: -PI / 2, w: 2.4, h: 0.6 });
    Build.box(0.08, 2.1, 1.0, M('metal_painted', { color: 0x5a3a2a }), { pos: [-2.5, 0, 31.5], solid: false });
    Build.tree('fig', { pos: [-7.3, 0, 35.2], scale: 0.28, seed: 31 });
    Build.vines({ box: [-8.45, 2, 33, -8.4, 11, 36], density: 1, seed: 32, hang: true });
    Build.vines({ box: [-3.05, 6, 14.5, -2.55, 11, 22], density: 0.7, seed: 33, hang: true });
    for (const [a, b] of [[[-8.4, 6.5, 19], [-2.6, 6.1, 20.5]], [[-8.4, 7.2, 27], [-2.6, 7.8, 25]], [[-8.4, 5.5, 33], [-2.6, 6.4, 34]]]) Build.wire(a, b, { sag: 0.5, r: 0.012, color: 0x141414 });
    Build.prop('crate', { kind: 'plastic', pos: [-7.9, 0, 35.3], color: 0x3a3a3c });
    // lane B: the skip, the burnt hatch, bins and pallets to hide behind, shutters, the one light that still works
    Build.prop('bin', { kind: 'skip', pos: [-13, 0, 41.7], yaw: PI / 2, worn: 0.9, open: true });
    Build.car('hatch', { pos: [-21.5, 0, 38.4], yaw: 1.45, burnt: true, wrecked: true, seed: 12 });
    Build.prop('bin', { kind: 'wheelie', pos: [-17.2, 0, 43.2], yaw: PI, worn: 0.8 });
    Build.prop('pallet', { pos: [-27.5, 0, 37.2], yaw: 0.2, stack: 5 });
    Build.prop('pallet', { pos: [-28.6, 0, 37.1], yaw: -0.1, stack: 3 });
    Build.prop('tyre', { pos: [-8.8, 0, 43.2], stack: 2 });
    Build.prop('jersey_barrier', { pos: [-32.5, 0, 42.7], yaw: 0.1, length: 2 });
    Build.prop('crate', { kind: 'wood', pos: [-6.2, 0, 43.3], stack: 2 });
    for (const x of [-9, -24]) Build.prop('roller_shutter', { pos: [x, 0, 44], yaw: PI, w: 3, h: 2.8, open: 0, color: 0x6a6e68 });
    Build.decal(Tex.graffiti('SAY YES', { style: 'spray', color: '#e8c020', w: 512, h: 256 }), { pos: [-24, 1.6, 43.9], yaw: PI, w: 2.2, h: 1.1 });
    Build.decal(Tex.graffiti('NO', { style: 'drip', color: '#c8161d', w: 256, h: 256 }), { pos: [-23.2, 1.8, 43.88], yaw: PI, w: 1, h: 1 });
    Build.decal(Tex.graffiti('17', { style: 'tally', color: '#e0dcd0', w: 256, h: 256 }), { pos: [-30, 1.4, 36.05], w: 0.6, h: 0.6 });
    Build.vines({ box: [-34, 3, 36.05, -28, 12, 36.1], density: 0.8, seed: 34, hang: true });
    Build.vines({ box: [-14, 4, 43.9, -8, 12, 43.95], density: 0.7, seed: 35, hang: true });
    acUnit(-11, 3.1, 36.35, 0); acUnit(-30, 4.3, 43.65, PI);
    Build.box(0.34, 0.2, 0.18, M('metal_painted', { color: 0x2a2a2a }), { pos: [-20, 4.4, 43.85], solid: false });
    Build.glow({ pos: [-20, 4.4, 43.7], color: 0xffa040, size: 1.6, opacity: 0.8 });
    Build.light('point', { pos: [-20, 4.2, 43.2], color: 0xffa050, intensity: 7, distance: 13, decay: 1.4, flicker: 0.15 });
    Build.pool({ pos: [-20, 0, 41.5], r: 5, color: 0xffa040, opacity: 0.12 });
    for (const [x, z] of [[-5.5, 20], [-4, 29], [-10, 40.5], [-19, 40], [-26, 40.8], [-31, 39.5]]) Build.decal('puddle', { floor: true, pos: [x, 0.008, z], w: 2.6 + r(), h: 1.8, spin: x });
    Build.water({ x1: -24, z1: 39.3, x2: -15, z2: 40.8, y: 0.012, color: 0x0a1010, streaks: [{ x: -20, z: 40, color: 0xffa040, w: 1.2, len: 5 }] });
    Build.scatter('debris', { box: [-33, 14.5, -3, 43.5], count: 140, seed: 36 });
    Build.scatter('leaves', { box: [-8.4, 30, -5, 36], count: 60, seed: 37 });
    Build.scatter('paper', { box: [-30, 37, -4, 43], count: 20, seed: 38 });
    // the back door's caged bulb, the only light in lane A
    Build.prop('ceiling_light', { kind: 'caged', pos: [-5.5, 2.75, 14.25], on: true, color: 0xffc070 });
    Build.light('point', { pos: [-5.5, 2.5, 14.7], color: 0xffb870, intensity: 3, distance: 9, decay: 1.5, flicker: 0.1 });
    A.dark([-8.5, 16, -2.5, 36], 0.45);
    A.dark([-34, 36, -2.5, 44], 0.55);
  }

  // ---- 1D: the apron under the QZ wall, the watchtower, the culvert and its grate ---------------------------------------
  function wallApron(A, r) {
    const D = A.data, panel = M('concrete', { color: 0x8a8a84, rough: 0.8 }), cz0 = 38.6, cz1 = 41.4;
    Build.floor(-39.5, 24, -34, 56, wetConc(), { surface: 'concrete' });
    // the wall: precast panels, seams, razor wire along the top, floodlight heads, the stencils
    Build.box(3.5, 9, cz0 - 20, panel, { pos: [-41.25, 0, (20 + cz0) / 2] });
    Build.box(3.5, 9, 80 - cz1, panel, { pos: [-41.25, 0, (80 + cz1) / 2] });
    Build.box(3.5, 9 - 2.4, cz1 - cz0, panel, { pos: [-41.25, 2.4, 40] });
    const seam = C(0x3a3a38, { rough: 0.9 });
    for (let z = 21; z < 80; z += 3) if (z < cz0 - 0.2 || z > cz1 + 0.2) Build.box(0.02, 9, 0.05, seam, { pos: [-39.49, 0, z], solid: false, ao: false, shadow: false });
    Build.box(0.3, 0.3, 60, C(0x5a5a56), { pos: [-39.4, 8.7, 50], solid: false });
    const coil = []; for (let i = 0; i <= 600; i++) { const t = i / 600, a = t * 150 * PI; coil.push(new THREE.Vector3(-41.2 + Math.cos(a) * 0.3, 9.35 + Math.sin(a) * 0.3, 20 + t * 60)); }
    Build.mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(coil), 1200, 0.008, 3), C(0x8a8e90, { metal: 0.8, rough: 0.35 }), { shadow: false, receive: false });
    for (const z of [30, 50, 66]) { Build.box(0.12, 1.2, 0.12, C(0x2a2a2a, { metal: 0.6 }), { pos: [-39.6, 9, z], solid: false }); Build.box(0.5, 0.3, 0.3, C(0x2a2a2a, { metal: 0.5 }), { pos: [-39.4, 10.1, z], rot: [0.6, PI / 2, 0], solid: false }); }
    Build.box(0.36, 0.2, 0.05, C(0xe8f0ff, { emissive: 0xdde8ff, emissiveIntensity: 4 }), { pos: [-39.2, 10.05, 30], rot: [0.9, PI / 2, 0], solid: false, ao: false, shadow: false });
    Build.glow({ pos: [-39.1, 10, 30], color: 0xc8d8ff, size: 3, opacity: 0.7 });
    Build.light('point', { pos: [-37.5, 8.5, 29], color: 0xb8c8e0, intensity: 16, distance: 16, decay: 1.3 });
    Build.sign({ pos: [-39.45, 3.2, 33], yaw: PI / 2, tex: Tex.sign('stencil', 'QUARANTINE BOUNDARY — LETHAL FORCE AUTHORISED'), w: 3.2, h: 1.2, post: 0 });
    Build.poster('comms_look_up', { pos: [-39.45, 1.6, 46.5], yaw: PI / 2, w: 0.7, worn: 0.6 });
    Build.poster('comms_execution', { pos: [-39.45, 1.6, 47.4], yaw: PI / 2, w: 0.7, worn: 0.8 });
    Build.decal(Tex.graffiti('LOOK UP', { style: 'stencil', color: '#1a1a1a', w: 1024, h: 256 }), { pos: [-39.45, 5.2, 46], yaw: PI / 2, w: 5, h: 1.2 });
    Build.decal('water_stain', { pos: [-39.45, 1.5, 36], yaw: PI / 2, w: 3, h: 3.2, opacity: 0.7 });
    Build.decal('moss_patch', { pos: [-39.45, 0.8, 43.2], yaw: PI / 2, w: 1.6, h: 1.6 });
    // the fences closing the apron, sandbags, barriers, the watchtower and its searchlight
    Build.prop('fence', { kind: 'chainlink', pos: [-39.5, 0, 54], length: 5.5, h: 3.2 });
    Build.prop('fence', { kind: 'chainlink', pos: [-39.5, 0, 26], length: 5.5, h: 3.2 });
    Build.prop('sandbags', { pos: [-38.5, 0, 27.2], length: 3, rows: 3 });
    Build.prop('jersey_barrier', { pos: [-37, 0, 34.5], yaw: PI / 2, length: 2 });
    Build.prop('jersey_barrier', { pos: [-36.6, 0, 48], yaw: PI / 2 + 0.2, length: 2 });
    Build.prop('barricade', { pos: [-36.5, 0, 52.6], yaw: 0.1, text: 'NO ENTRY — BOUNDARY ZONE' });
    const T = [-37, 0, 57], st = M('metal_painted', { color: 0x3a3e38 });
    for (const [dx, dz] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) Build.box(0.16, 7, 0.16, st, { pos: [T[0] + dx, 0, T[2] + dz] });
    for (const y of [2.3, 4.6]) for (const s of [-1, 1]) { Build.box(2.5, 0.08, 0.08, st, { pos: [T[0], y, T[2] + s * 1.2], rot: [0, 0, 0.6 * s], solid: false }); Build.box(0.08, 0.08, 2.5, st, { pos: [T[0] + s * 1.2, y, T[2]], rot: [0.6 * s, 0, 0], solid: false }); }
    Build.box(3.2, 0.15, 3.2, M('planks', { color: 0x6a5a48 }), { pos: [T[0], 7, T[2]], solid: false });
    for (const s of [-1, 1]) { Build.box(3.2, 1.1, 0.06, M('corrugated', { color: 0x4a5048 }), { pos: [T[0], 7.15, T[2] + s * 1.6], solid: false }); Build.box(0.06, 1.1, 3.2, M('corrugated', { color: 0x4a5048 }), { pos: [T[0] + s * 1.6, 7.15, T[2]], solid: false }); }
    Build.box(3.6, 0.08, 3.6, M('corrugated', { color: 0x3a403a }), { pos: [T[0], 9.3, T[2]], solid: false });
    for (const [dx, dz] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) Build.box(0.08, 2.1, 0.08, st, { pos: [T[0] + dx, 7.15, T[2] + dz], solid: false });
    D.searchHead = Build.group({ pos: [T[0], 8.35, T[2] - 1.7] });
    Build.mesh(new THREE.CylinderGeometry(0.28, 0.24, 0.5, 14).rotateX(PI / 2), C(0x2a2c2a, { metal: 0.6, rough: 0.4 }), { parent: D.searchHead });
    Build.mesh(new THREE.CircleGeometry(0.25, 16), C(0xffffff, { emissive: 0xeef4ff, emissiveIntensity: 5 }), { parent: D.searchHead, pos: [0, 0, 0.26] });
    Build.glow({ pos: [T[0], 8.35, T[2] - 2], color: 0xdde8ff, size: 3.5, opacity: 0.9 });
    D.search = Build.light('spot', { pos: [T[0], 8.35, T[2] - 1.9], target: [-37, 0, 40], color: 0xe4ecff, intensity: 90, distance: 40, angle: 0.13, penumbra: 0.35, decay: 1.2 });
    D.searchBeam = Build.beam({ pos: [T[0], 8.35, T[2] - 1.9], dir: [0, -0.5, -1], len: 20, r: 2.4, color: 0xdde8ff, opacity: 0.22 });
    D.searchPool = Build.pool({ pos: [-37, 0, 40], r: 2.6, color: 0xdde8ff, opacity: 0.35, dynamic: true });
    D.tower = A.w([T[0], 8.35, T[2] - 1.9]);
    // the culvert mouth: a concrete headwall frame, the grate (bars bent apart low on the left), the trickle, the Landlines mark
    const hw = M('concrete', { color: 0x6a6a64 });
    Build.box(0.4, 0.4, cz1 - cz0 + 0.8, hw, { pos: [-39.3, 2.4, 40], solid: false });
    for (const z of [cz0 - 0.2, cz1 + 0.2]) Build.box(0.4, 2.4, 0.4, hw, { pos: [-39.3, 0, z] });
    grate(A, -39.55, 40);
    Build.decal(Tex.graffiti('', { style: 'cord', color: '#e8e2cf', w: 256, h: 256 }), { pos: [-39.08, 1.9, cz0 - 0.9], yaw: PI / 2, w: 0.6, h: 0.6 });
    Build.water({ x1: -39.4, z1: 39.3, x2: -35.5, z2: 40.7, y: 0.01, color: 0x0a1210 });
    Build.decal('moss_patch', { floor: true, pos: [-38.5, 0.009, 40], w: 2.4, h: 2, spin: 1 });
    Build.scatter('rubble', { box: [-39.3, 27, -34.5, 53], count: 40, seed: 41 });
    Build.scatter('leaves', { box: [-39.3, 36, -36.5, 44], count: 50, seed: 42 });
    A.dark([-39.5, 36.5, -36, 43.5], 0.5);
  }
  // the rusted grate across the culvert (x = its plane, zc = the culvert's centre line). Bars bent apart at zc −1.1..−0.5:
  // the squeeze. Colliders either side of the gap.
  function grate(A, x, zc) {
    const bar = M('rust', { color: 0x5a3a2a });
    for (let z = zc - 1.28; z < zc + 1.4; z += 0.16) {
      const k = z - (zc - 0.8), bent = Math.abs(k) < 0.34;
      Build.box(0.035, 2.3, 0.035, bar, { pos: [x, 0, bent ? zc - 0.8 + Math.sign(k || 1) * (0.3 + Math.abs(k) * 0.4) : z], rot: bent ? [Math.sign(k || 1) * -0.12, 0, 0] : undefined, solid: false, ao: false });
    }
    for (const y of [0.6, 1.6, 2.25]) Build.box(0.05, 0.06, 2.8, bar, { pos: [x, y, zc], solid: false, ao: false, shadow: y < 1 });
    A.collider([x - 0.15, 0, zc - 0.5], [x + 0.15, 2.4, zc + 1.4]);
    A.collider([x - 0.15, 0, zc - 1.4], [x + 0.15, 2.4, zc - 1.12]);
  }

  // ---- the culvert under the wall (first 18 m): the same tube in 1D and 1E, so the hand-over between them is invisible ------
  // x0 = local x of the grate; the tube runs toward -x, centred on zc.
  function culvert(A, x0, zc, len) {
    const cm = M('concrete_wet', { color: 0x4e524c }), fl = M('concrete', { color: 0x3e423c, rough: 0.5 }), W2 = 1.4, H2 = 2.4;
    Build.floor(x0 - len, zc - W2, x0 + 0.6, zc + W2, fl, { surface: 'concrete' });
    for (const s of [-1, 1]) Build.box(len, H2, 0.4, cm, { pos: [x0 - len / 2 - 0.1, 0, zc + s * (W2 + 0.2)] });
    Build.box(len, 0.4, W2 * 2 + 0.8, cm, { pos: [x0 - len / 2 - 0.1, H2, zc], solid: false });
    Build.box(len, 0.02, 0.5, C(0x1a1e1a, { rough: 0.2 }), { pos: [x0 - len / 2, 0.001, zc], solid: false, ao: false, shadow: false });
    for (let x = x0 - 2; x > x0 - len; x -= 2.5) for (const s of [-1, 1]) Build.box(0.04, H2, 0.04, C(0x2a2e2a, { rough: 0.9 }), { pos: [x, 0, zc + s * (W2 - 0.01)], solid: false, ao: false, shadow: false });
    for (const [x, s, k] of [[3, -1, 'moss_patch'], [7, 1, 'water_stain'], [11, -1, 'water_stain'], [15, 1, 'moss_patch']]) if (x < len) Build.decal(k, { pos: [x0 - x, 0.9, zc + s * (W2 - 0.02)], yaw: s < 0 ? 0 : PI, w: 2.2, h: 1.8, opacity: 0.8 });
    // the street drain 14 m in: a shaft, rain and grey light falling through, grass in the light
    const sx = x0 - 14, cm2 = M('concrete', { color: 0x4a4e48 });
    Build.box(1.3, 4, 0.2, cm2, { pos: [sx, H2, zc - 0.75], solid: false }); Build.box(1.3, 4, 0.2, cm2, { pos: [sx, H2, zc + 0.75], solid: false });
    Build.box(0.2, 4, 1.3, cm2, { pos: [sx - 0.75, H2, zc], solid: false }); Build.box(0.2, 4, 1.3, cm2, { pos: [sx + 0.75, H2, zc], solid: false });
    for (let i = -3; i <= 3; i++) Build.box(0.04, 0.05, 1.2, C(0x1a1a1a, { metal: 0.6 }), { pos: [sx + i * 0.17, H2 + 4, zc], solid: false, ao: false });
    Build.box(1.2, 0.02, 1.2, C(0x6a7a86, { emissive: 0x5a6a78, emissiveIntensity: 0.9 }), { pos: [sx, H2 + 4.1, zc], solid: false, ao: false, shadow: false });
    Build.godray({ pos: [sx, H2 + 3.9, zc], dir: [0.1, -1, 0.05], w: 1.1, h: 6.2, color: 0x9ab0c0, opacity: 0.3 });
    Build.pool({ pos: [sx, 0, zc], r: 1.6, color: 0x8aa0b0, opacity: 0.35 });
    Build.grass({ box: [sx - 0.7, zc - 1.2, sx + 0.7, zc + 1.2], count: 50, color: 0x3a5a2a, height: 0.35 });
    Build.light('point', { pos: [sx, 1.9, zc], color: 0x8aa0b8, intensity: 3.2, distance: 8, decay: 1.4 });
    Build.dust({ box: [x0 - len, 0.3, zc - 1.3, x0, 2.3, zc + 1.3], count: 120, color: 0xb8c8d0, size: 0.014, opacity: 0.35 });
    A.dark([x0 - len, zc - 1.4, x0, zc + 1.4], 0.75);
  }

  // ---- 1D ------------------------------------------------------------------------------------------------------------------
  const LOOK = { grade: 'qz_green', fog: { color: 0x0a0e0f, density: 0.035 }, background: 0x0a0e0f,
    env: { top: 0x1a2226, horizon: 0x2a3232, bottom: 0x060606, intensity: 0.35, spots: [{ dir: [0.2, 0.6, 0.3], color: 0x8aa0b0, power: 0.8 }] } };
  CONTENT.levels['1D'] = Object.assign({}, LOOK, {
    name: 'The Landlines hideout', origin: OD, amb: 'qz_rain', surface: 'concrete',
    build(A) {
      const D = A.data, r = U.rng(312);
      D.fresh = true; D.tweens = [];
      D.hemi = Build.hemi({ sky: 0x4a5a66, ground: 0x14120e, intensity: 0.55 });
      nightSky(A, [-20, -40, 30], [[20, -120, 160, 200, 34, false], [-420, -200, -120, 250, 40, true]], [-300, -30]);
      basement(A, r); lanes(A, r); wallApron(A, r); culvert(A, -40, 40, 18);
      Build.box(0.2, 2.4, 2.8, C(0x000000), { pos: [-58.2, 0, 40], solid: false, ao: false, shadow: false });
      // light: the bare bulb is the key (and the area's one shadow caster); the radios, the map lamp, the stairwell
      D.key = Build.light('spot', { pos: [0.2, 2.55, 7.25], target: [0.2, 0, 7.3], color: 0xffc27a, intensity: 26, distance: 11, angle: 1.05, penumbra: 0.7, decay: 1.3, shadow: true });
      Build.light('point', { pos: [0.2, 2.3, 7.25], color: 0xffb46a, intensity: 1.6, distance: 6, decay: 1.4 });
      Build.light('point', { pos: [6.3, 1.2, 8.2], color: 0xff9a48, intensity: 2.2, distance: 4.5, decay: 1.5, flicker: 0.12 });
      Build.light('point', { pos: [4.0, 1.7, 12.8], color: 0xffd6a0, intensity: 3.2, distance: 5.5, decay: 1.5 });
      Build.light('point', { pos: [5.7, 5.2, -5.4], color: 0x8ea0b8, intensity: 5, distance: 9, decay: 1.4 });
      D.rain = Build.rain({ area: 30, count: 3200, color: 0x8aa0b0, speed: 12 });
      Build.dust({ box: [-7, 0.3, 1, 7, 2.7, 13], count: 200, color: 0xffe0b8, size: 0.014, opacity: 0.35 });
      // stealth, nav, hints (hold T): back door → lane A → lane B → the apron → the grate
      A.navBounds(-44, -1, 9, 57);
      A.patrol('c1d_lane', [[-30, 0, 40.5], [-6, 0, 40], [-6.2, 0, 39.3], [-30, 0, 39.6]]);
      A.hint([[-5.5, 0, 15], [-5.5, 0, 36], [-14, 0, 39.5], [-33, 0, 40], [-38.8, 0, 39.2]]);
      // pickups: scarce, where people left them
      A.pickup({ at: [-2.2, 0.76, 0.9], item: 'cloth' });
      A.pickup({ at: [7.2, 0.92, 10.1], item: 'tape' });
      A.pickup({ at: [-3.3, 0.02, 19.0], item: 'bottle' });
      A.pickup({ at: [-27.4, 0.7, 37.2], item: 'revolver_ammo', n: 2 });
      A.pickup({ at: [-12.9, 0.02, 43.3], item: 'brick' });
      A.pickup({ at: [-6.1, 0.9, 43.3], item: 'alcohol' });
      A.collectible({ at: [2.35, 0.75, 13.15], kind: 'artifact', id: 'c1_dialtone' });
      A.collectible({ at: [-7.9, 0.4, 35.3], kind: 'module', id: 'c1_module_lane' });
      for (const [id, at, rr, who] of [['c1d_map', [2.4, 0, 12.4], 2.5, 'chloe'], ['c1d_radio', [6.3, 0, 8.0], 2.5, 'chloe'], ['c1d_cot', [-6.2, 0, 9.3], 2.5, 'chloe'],
        ['c1d_wai_radio', [6.4, 0, 7.0], 2.2, 'wai'], ['c1d_wai_switch', [6.8, 0, 11.4], 2.2, 'wai'], ['c1d_cord', [-7.6, 0, 30], 3, 'chloe'], ['c1d_poster', [-3.4, 0, 21.5], 3, 'chloe'],
        ['c1d_wall', [-35.5, 0, 40.5], 3.5, 'chloe']]) A.remark({ at, r: rr, id, who });
      // the radio operator: head down over the sets all night
      Build.prop('chair', { kind: 'folding', pos: [6.75, 0, 8.3], yaw: PI / 2 });
      D.landline = A.char('landline', { name: 'landline', at: [6.75, 0, 8.3], yaw: PI / 2, seed: 4 });
      D.landline.pose('sit', { direct: true, dur: 0.01 });
      // marks (area-local)
      for (const [n, p, yaw] of [['mk_start', [-4.8, 0, 11.6], PI / 2], ['mk_1d_grate', [-38.9, 0, 39.2], -PI / 2],
        ['mk_15_chloe', [0.2, 0, 7.42], PI + 0.1], ['mk_15_in_chase', [5.6, 0, -0.9], 0], ['mk_15_in_wai', [5.7, 0.9, -2.2], 0], ['mk_15_in_op', [5.6, 0, 0.35], 0],
        ['mk_15_chase', [1.05, 0, 4.25], -0.28], ['mk_15_wai', [2.75, 0, 3.75], -0.62], ['mk_15_op', [2.35, 0, 5.3], -0.9], ['mk_15_op_chair', [4.7, 0, 8.55], -1.95],
        ['mk_15_chloe_op', [3.75, 0, 7.95], 1.1], ['mk_15_chloe_end', [0.9, 0, 6.2], PI + 0.5],
        ['mk_16_chase', [0.7, 0, 4.9], -0.4], ['mk_16_chloe', [0.9, 0, 6.3], -2.6], ['mk_16_wai', [2.8, 0, 4.2], -0.9]]) A.marker(n, p, yaw);
      // weather and life: lightning, thunder, the radios crackling and their dials breathing, the searchlight's sweep
      D.flashT = 8;
      D.loops = [Audio.loop('drips', { pos: A.w([-5.5, 1, 13]), vol: 0.4 }), Audio.loop('tape_hiss', { pos: A.w([7.2, 1.1, 8.2]), vol: 0.35 })];
      A.update((dt, t) => {
        const cam = Engine.camera.position, lx = cam.x - OD[0], lz = cam.z - OD[2];
        D.rain.visible = !(lx > -8.2 && lx < 8.2 && lz > -7 && lz < 14.1) && !(lx < -39.4 && lz > 38.4 && lz < 41.6);
        for (const k of D.dials) k.material.emissiveIntensity = 1.5 + Math.sin(t * 3.1) * 0.35;
        if ((D.flashT -= dt) <= 0) { D.flashT = 16 + Math.random() * 20; D.flash0 = t; Audio.sfx('thunder', { pos: A.w([-60, 60, 30 + Math.random() * 40]), vol: 0.8 }); }
        const f = D.flash0 != null ? t - D.flash0 + 1.4 : 9, k = f < 0.1 ? 1 : f < 0.18 ? 0.2 : f < 0.3 ? 0.8 : f < 0.8 ? U.lerp(0.8, 0, (f - 0.3) / 0.5) : 0;
        D.hemi.intensity = 0.55 * (1 + k * 2.5); D.sky.material.color.setScalar(1 + k * 2);
        if ((D.crackT = (D.crackT ?? 3) - dt) <= 0) { D.crackT = 2 + Math.random() * 5; Audio.sfx(Math.random() < 0.6 ? 'radio_static' : 'radio_click', { pos: A.w([7.2, 1.1, 8]), vol: 0.3 }); }
        searchlight(A, dt);
        if (D.tweens.length) D.tweens = D.tweens.filter(fn => !fn(dt));
      });
    },
    unload(A) { for (const l of A.data.loops) l.stop(0.4); },
  });

  // the searchlight: a slow sweep of the apron. Standing in its pool fills an arc (slower crouched); full, the tower fires.
  const _s = V(), _s2 = V(), DOWN = V(0, -1, 0);
  function searchlight(A, dt) {
    const D = A.data, S = D.searchS || (D.searchS = { heat: 0, fireT: 0, ph: 0 });
    if (!Director.active) S.ph += dt * 0.42;
    const z = 40 + Math.sin(S.ph) * 12.5, x = -36.6 + Math.sin(S.ph * 2.3) * 1.1;
    D.search.target.position.set(x, 0, z);
    D.searchPool.position.set(x, 0.012, z);
    _s2.set(OD[0] + x, 0, OD[2] + z).sub(D.tower);
    const len = _s2.length(); _s2.normalize();
    D.searchBeam.quaternion.setFromUnitVectors(DOWN, _s2); D.searchBeam.scale.set(1, len / 20, 1);
    D.searchHead.lookAt(OD[0] + x, 0, OD[2] + z);
    const pl = Play.char;
    if (!pl || Director.active || !Play.enabled) { S.heat = Math.max(0, S.heat - dt); return; }
    const p = pl.root.position, lit = Math.hypot(p.x - OD[0] - x, p.z - OD[2] - z) < 2.3 && p.x - OD[0] > -39.4;
    S.heat = U.clamp(S.heat + (lit ? dt / (Play.crouched ? 1.4 : 0.9) : -dt * 0.6), 0, 1);
    if (S.heat > 0.02) { Engine.camera.getWorldDirection(_s); UI.detect(U.wrapAngle(Math.atan2(_s.x, _s.z) - U.yawTo(Engine.camera.position, D.tower)), S.heat); }
    if (S.heat >= 1 && (S.fireT -= dt) <= 0) {
      S.fireT = 0.75;
      Audio.sfx('rifle_shot', { pos: D.tower, vol: 1 });
      if (lit) Play.damage(26, 'shot');
      for (const a of AI.list) if (a.alive && !a.companion && a.faction === 'comms' && a.state !== 'combat') a.alert(p.clone());
    }
  }

  // ---- 1E: under the wall ------------------------------------------------------------------------------------------------
  function tunnelE(A, r) {
    const D = A.data, cm = M('concrete_wet', { color: 0x4e524c }), fl = M('concrete', { color: 0x3e423c, rough: 0.5 });
    culvert(A, 0, 0, 18);
    grate(A, 0.05, 0);
    Build.box(0.1, 2.4, 2.8, C(0x0c1216, { emissive: 0x1a2a34, emissiveIntensity: 0.6 }), { pos: [0.7, 0, 0], solid: false, ao: false, shadow: false });
    // the chamber where two drains meet (x −18..−30): wider, higher; the side pipe spilling; the camp on the south ledge
    Build.floor(-30, -2.6, -18, 2.6, fl, { surface: 'concrete' });
    for (const s of [-1, 1]) Build.box(12, 2.9, 0.4, cm, { pos: [-24, 0, s * 2.8] });
    for (const x of [-18, -30]) for (const s of [-1, 1]) Build.box(0.4, 2.9, 1.2, cm, { pos: [x, 0, s * 2.0] });
    for (const x of [-18, -30]) Build.box(0.4, 0.5, 2.8, cm, { pos: [x, 2.4, 0], solid: false });
    Build.box(12.4, 0.4, 6, cm, { pos: [-24, 2.9, 0], solid: false });
    Build.box(12, 0.4, 1.2, M('concrete', { color: 0x5a5e58 }), { pos: [-24, 0, -2.0] });
    Build.mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.6, 16, 1, true).rotateX(PI / 2), cm, { pos: [-22.5, 1.2, 2.35] });
    Build.mesh(new THREE.CircleGeometry(0.5, 16), C(0x050706), { pos: [-22.5, 1.2, 2.58], yaw: PI });
    Build.water({ x1: -23.3, z1: -1.3, x2: -21.7, z2: 2.55, y: 0.03, color: 0x0a1210 });
    Build.decal('moss_patch', { pos: [-22.5, 0.5, 2.58], yaw: PI, w: 1.6, h: 1.4 });
    // the camp: a pallet bed, a sleeping bag, candles in jar lids, tins, a book, the tally of days, a drawing of the sun
    Build.prop('pallet', { pos: [-26.5, 0.4, -2.0], yaw: 0 });
    Build.prop('mattress', { pos: [-26.5, 0.54, -2.0], yaw: PI / 2, dirty: true, w: 0.8, l: 1.8 });
    Build.box(0.7, 0.14, 1.5, C(0x3a5a3a, { rough: 0.95 }), { pos: [-26.6, 0.66, -2.0], yaw: 0.1, solid: false });
    Build.prop('camp_stove', { pos: [-24.4, 0.4, -2.1], lit: false });
    Build.scatter('cans', { box: [-25.4, -2.5, -23.6, -1.5], count: 8, seed: 51, y: 0.4 });
    const candle = C(0xe8e0c8, { rough: 0.8 });
    for (const [x, z, h] of [[-25.2, -2.35, 0.12], [-25.0, -2.4, 0.08], [-28.3, -2.4, 0.1], [-23.3, -2.4, 0.06]]) {
      Build.box(0.04, h, 0.04, candle, { pos: [x, 0.4, z], solid: false, ao: false, shadow: false });
      Build.glow({ pos: [x, 0.43 + h, z], color: 0xffa040, size: 0.35, opacity: 0.9 });
    }
    Build.light('point', { pos: [-25.5, 0.9, -1.8], color: 0xff9a40, intensity: 2.6, distance: 6, decay: 1.4, flicker: 0.3 });
    Build.decal(Tex.graffiti('41', { style: 'tally', color: '#d8d0c0', w: 256, h: 256 }), { pos: [-27.6, 1.3, -2.58], w: 0.9, h: 0.9 });
    const sun = once('c1e_sun', () => canvas(256, 256, (g, w, h) => {
      g.fillStyle = '#ece4cc'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#f2b400'; g.beginPath(); g.arc(128, 110, 40, 0, PI * 2); g.fill();
      g.strokeStyle = '#f2b400'; g.lineWidth = 6; for (let i = 0; i < 12; i++) { const a = i * PI / 6; g.beginPath(); g.moveTo(128 + Math.cos(a) * 52, 110 + Math.sin(a) * 52); g.lineTo(128 + Math.cos(a) * 78, 110 + Math.sin(a) * 78); g.stroke(); }
      g.fillStyle = '#3a8a3a'; g.fillRect(0, 200, w, 56); g.fillStyle = '#2a2a2a'; g.font = 'bold 22px ' + SANS; g.fillText('OUTSIDE', 80, 240);
    }));
    Build.decal(sun, { pos: [-25.9, 1.35, -2.58], w: 0.34, h: 0.34 });
    Build.box(0.16, 0.03, 0.22, C(0x8a2a22, { rough: 0.8 }), { pos: [-27.8, 0.55, -1.7], yaw: 0.4, solid: false, ao: false });
    Build.box(0.09, 0.05, 0.22, C(0xd8d0c0, { rough: 0.9 }), { pos: [-20.5, 0.4, -2.3], yaw: 0.7, solid: false });
    // a child's shoe in the water
    Build.box(0.1, 0.07, 0.19, C(0xd86a8a, { rough: 0.8 }), { pos: [-27.4, 0.0, 0.9], yaw: 1.2, rot: [0, 1.2, 0.3], solid: false });
    // the luminous Landlines cords: the way out, painted in glow paint
    const lum = Tex.graffiti('', { style: 'cord', color: '#bfffe0', w: 256, h: 256 });
    for (const [x, z, yaw] of [[-8, -1.39, 0], [-19.6, 1.21, PI], [-33, -1.39, 0], [-44, 1.39, PI]]) Build.decal(lum, { pos: [x, 1.5, z], yaw, w: 0.55, h: 0.55, emissive: 1.6, color: 0x8affc8 });
    Build.decal(Tex.graffiti('→ ANN ST', { style: 'drip', color: '#bfffe0', w: 512, h: 128 }), { pos: [-33, 0.95, -1.39], w: 1.1, h: 0.28, emissive: 1.4, color: 0x8affc8 });
    // the tube on to the outfall (x −30..−50): silt, a trash rack full of phones, water deepening toward the mouth
    Build.floor(-50.3, -1.4, -30, 1.4, fl, { surface: 'concrete' });
    for (const s of [-1, 1]) Build.box(20.3, 2.4, 0.4, cm, { pos: [-40.15, 0, s * 1.6] });
    Build.box(20.3, 0.4, 3.6, cm, { pos: [-40.15, 2.4, 0], solid: false });
    for (let x = -32; x > -50; x -= 2.5) for (const s of [-1, 1]) Build.box(0.04, 2.4, 0.04, C(0x2a2e2a, { rough: 0.9 }), { pos: [x, 0, s * 1.39], solid: false, ao: false, shadow: false });
    const rack = M('rust', { color: 0x4a3226 });
    for (let z = -1.3; z <= 1.3; z += 0.2) Build.box(0.04, 0.9 - Math.abs(z) * 0.2, 0.04, rack, { pos: [-36, 0, z], rot: [0, 0, 0.35], solid: false, ao: false });
    Build.box(0.05, 0.05, 2.8, rack, { pos: [-36.2, 0.75, 0], solid: false, ao: false });
    Build.box(1.6, 0.14, 2.7, M('dirt', { color: 0x3a3226 }), { pos: [-35.4, 0, 0], solid: false });
    Build.scatter('phones', { box: [-36.2, -1.2, -34.6, 1.2], count: 26, seed: 52, y: 0.14 });
    Build.scatter('bottles', { box: [-36.2, -1.2, -34.8, 1.2], count: 6, seed: 53, y: 0.14 });
    Build.scatter('leaves', { box: [-36.2, -1.3, -34, 1.3], count: 40, seed: 54, y: 0.14 });
    Build.water({ x1: -50.3, z1: -1.4, x2: -38, z2: 1.4, y: 0.08, color: 0x0a1210 });
    A.water({ box: [-50.3, -1.4, -41, 1.4], y: 0.08 });
    for (const [x, s] of [[-39, 1], [-43, -1], [-47, 1]]) Build.decal('moss_patch', { pos: [x, 0.6, s * 1.38], yaw: s > 0 ? PI : 0, w: 2, h: 1.2 });
    Build.vines({ box: [-50, 1.6, -1.4, -47.5, 2.4, 1.4], density: 1, seed: 55, hang: true });
    Build.light('point', { pos: [-48.5, 1.6, 0], color: 0x6a8494, intensity: 3, distance: 9, decay: 1.4 });
    A.dark([-50, -2.6, -18, 2.6], 0.7);
    D.shoe = [-27.4, 0, 0.9];
  }

  // the flooded street outside: Ann Street under half a metre of water, the retaining wall with the outfall, the QZ wall
  // behind it, dead shopfronts, drowned cars, the COMMS dinghy; the drowned tower at the end of the street
  function streetE(A, r) {
    const D = A.data, WY = 0.12, GY = -0.36;
    Build.floor(-120, -120, -50, 120, M('asphalt', { color: 0x3a3c3a }), { y: GY });
    Build.water({ x1: -120, z1: -120, x2: -50.2, z2: 120, y: WY, color: 0x0c1412, streaks: [{ x: -61, z: -1, color: 0xdde8ff, w: 1.2, len: 9 }] });
    // the retaining wall and the outfall mouth (x −50), the embankment over the tunnel, the QZ wall beyond
    const ret = M('concrete', { color: 0x6a6c66, rough: 0.8 });
    Build.box(1, 4.5, 118.6, ret, { pos: [-49.8, GY, -60.7] });
    Build.box(1, 4.5, 118.6, ret, { pos: [-49.8, GY, 60.7] });
    Build.box(1, 4.5 - 2.76, 2.8, ret, { pos: [-49.8, 2.4, 0] });
    Build.box(0.3, 0.3, 3.8, M('concrete', { color: 0x5a5c56 }), { pos: [-50.4, 2.3, 0], solid: false });
    Build.box(46, 0.4, 240, M('dirt', { color: 0x2a2a20 }), { pos: [-27, 3.8, 0], solid: false, shadow: false });
    Build.grass({ box: [-50, -30, -40, 30], count: 900, color: 0x2e4226, height: 0.7, y: 4.2 });
    for (const [x, z, k, s] of [[-47, -9, 'gum', 0.7], [-45, 12, 'fig', 0.5], [-48.5, 22, 'gum', 0.55], [-44, -24, 'fig', 0.45]]) Build.tree(k, { pos: [x, 4.2, z], scale: s, seed: x * z | 0 });
    Build.vines({ box: [-50.3, 0.4, -12, -50.25, 4.1, -2], density: 1, seed: 56, hang: true });
    Build.vines({ box: [-50.3, 0.8, 2, -50.25, 4.1, 14], density: 0.9, seed: 57, hang: true });
    Build.decal('water_stain', { pos: [-50.31, 1.4, -5], yaw: -PI / 2, w: 5, h: 3 });
    Build.decal(Tex.graffiti('', { style: 'cord', color: '#bfffe0', w: 256, h: 256 }), { pos: [-50.31, 2.9, 1.9], yaw: -PI / 2, w: 0.6, h: 0.6, emissive: true, color: 0x6adca8 });
    Build.box(3.5, 9, 240, M('concrete', { color: 0x7a7a74 }), { pos: [-1.75, 0, 0], solid: false });
    for (const z of [-40, -10, 22, 50]) { Build.box(0.36, 0.2, 0.05, C(0xe8f0ff, { emissive: 0xdde8ff, emissiveIntensity: 4 }), { pos: [-3.6, 9.6, z], rot: [0.9, -PI / 2, 0], solid: false, ao: false, shadow: false }); Build.glow({ pos: [-3.8, 9.6, z], color: 0xc8d8ff, size: 4, opacity: 0.6 }); }
    // the far side of the street: a row of dead buildings, their ground floors shops under the waterline
    const fac = [M('render', { color: 0x6a6a60 }), M('brick', { color: 0x5e4438 }), M('render', { color: 0x5a6660 }), M('sandstone', { color: 0x8a7a60 })];
    let z = -95;
    for (let i = 0; z < 95; i++) {
      const w = 12 + r() * 10, h = 10 + r() * 26, m = fac[i % 4];
      Build.box(20, h, w - 0.4, m, { pos: [-78, GY, z + w / 2] });
      facadeWindows(-67.95, z + 1, -67.95, z + w - 1, 3.5 + GY, Math.floor((h - 4) / 3.4), r, { lit: 0, skip: 0.15 });
      Build.box(0.3, 0.2, w - 0.6, M('metal_painted', { color: 0x3a3c3a }), { pos: [-67.4, 3.1 + GY, z + w / 2], solid: false });
      if (r() < 0.6) Build.vines({ box: [-68.05, 2 + GY, z + 1, -68, 4 + r() * (h - 4), z + w - 1], density: 0.7, seed: 60 + i, hang: true });
      z += w;
    }
    Build.prop('shopfront', { pos: [-67.9, GY, -12], yaw: PI / 2, w: 11, text: 'ANN ST', lit: false, faded: 0.85, broken: true, open: 0.4 });
    Build.prop('shopfront', { pos: [-67.9, GY, 16], yaw: PI / 2, w: 9, text: 'CENTRAL', lit: false, faded: 0.95, broken: true, open: 0 });
    Build.poster('say_yes', { pos: [-67.85, 1.6, 5], yaw: PI / 2, w: 0.9, worn: 0.8 });
    Build.poster('comms_look_up', { pos: [-67.85, 1.6, 6.1], yaw: PI / 2, w: 0.8, worn: 0.8 });
    Build.tree('fig', { pos: [-66, GY, 30], scale: 0.7, seed: 58 });
    Build.tree('gum', { pos: [-65.5, GY, -34], scale: 0.6, seed: 59 });
    // the near side, north and south of the outfall: a footpath, awnings, a dead bus shelter
    Build.floor(-54, -120, -50.3, 120, M('concrete', { color: 0x5a5a54 }), { y: GY + 0.18 });
    Build.prop('bus_shelter', { pos: [-52.4, GY + 0.18, -14], yaw: PI / 2, lit: false, poster: 'promo_upgrade' });
    for (const zz of [-26, 12, 36]) Build.streetlight({ pos: [-53.4, GY + 0.18, zz], yaw: PI / 2, on: false });
    Build.sign({ pos: [-53.6, 2.6, 7], yaw: PI / 2, tex: Tex.sign('street', 'ANN ST'), w: 1.2, h: 0.24, post: 2.6 + GY });
    // the drowned traffic: cars nose-down in the water, a truck across the lane, a traffic light that never changed
    Build.car('sedan', { pos: [-60, GY - 0.25, 9], yaw: 0.25, wrecked: true, seed: 21, color: 0x5a6a7a });
    Build.car('ute', { pos: [-63, GY - 0.2, -18], yaw: PI + 0.15, wrecked: true, seed: 22, color: 0x8a8a80 });
    Build.car('hatch', { pos: [-58, GY - 0.3, -30], yaw: -0.4, wrecked: true, seed: 23, color: 0x7a2a22 });
    Build.car('truck', { pos: [-61, GY - 0.25, 38], yaw: 1.2, wrecked: true, seed: 24 });
    Build.car('sedan', { pos: [-57, GY - 0.3, -48], yaw: 0.1, wrecked: true, seed: 25, color: 0xd8d4c8 });
    Build.box(0.2, 5, 0.2, C(0x2a2c2a, { metal: 0.5 }), { pos: [-65.6, GY, 22] });
    Build.box(4, 0.16, 0.16, C(0x2a2c2a, { metal: 0.5 }), { pos: [-63.8, 4.6 + GY, 22], solid: false });
    Build.box(0.34, 0.95, 0.3, C(0x1a1a1a), { pos: [-62, 3.6 + GY, 22], solid: false });
    Build.scatter('leaves', { box: [-66, -40, -51, 40], count: 160, seed: 61, y: WY + 0.005 });
    Build.scatter('debris', { box: [-54, -40, -50.5, 40], count: 60, seed: 62, y: GY + 0.2 });
    // the COMMS dinghy tied to the lamp post: a punt with an outboard and a spotlight on a pole
    const boat = Build.group({ pos: [-61.5, WY - 0.2, -2.8], yaw: 0.35 }), al = M('metal', { color: 0x8a9294, rough: 0.45 });
    Build.box(1.5, 0.55, 3.8, al, { parent: boat, pos: [0, 0, 0], solid: false });
    Build.box(1.3, 0.1, 3.6, C(0x2a2e2e), { parent: boat, pos: [0, 0.46, 0], solid: false });
    Build.box(0.3, 0.6, 0.3, C(0x1a1a1a, { rough: 0.5 }), { parent: boat, pos: [0, 0.2, -2.0], solid: false });
    Build.box(1.3, 0.06, 0.3, al, { parent: boat, pos: [0, 0.55, 0.8], solid: false });
    Build.box(0.05, 1.1, 0.05, C(0x2a2a2a, { metal: 0.6 }), { parent: boat, pos: [0.4, 0.5, 1.6], solid: false });
    Build.box(0.3, 0.26, 0.36, C(0x2a2a2a, { metal: 0.5 }), { parent: boat, pos: [0.4, 1.55, 1.6], rot: [0, -0.8, 0], solid: false });
    Build.decal(Tex.sign('comms', 'COMMS'), { pos: [0.76, 0.28, 0], yaw: PI / 2, w: 1.2, h: 0.45, parent: boat });
    Build.wire([-61, 0.6, -1.2], [-53.4, 1.0, 12], { sag: 1.2, r: 0.01, color: 0xc8b890 });
    D.lampAt = A.w([-61.1, 1.6, -1.35]);
    D.boatLamp = Build.mesh(new THREE.CircleGeometry(0.13, 12), C(0x202020, { emissive: 0xeef4ff, emissiveIntensity: 0 }), { pos: [-60.95, 1.6, -1.3], yaw: 1.9 });
    D.boatGlow = Build.glow({ pos: [-60.9, 1.6, -1.25], color: 0xdde8ff, size: 2.4, opacity: 0.9, dynamic: true }); D.boatGlow.visible = false;
    D.spot = Build.light('spot', { pos: [-60.9, 1.62, -1.25], target: [-53.5, 0.3, 1.2], color: 0xe8f0ff, intensity: 0, distance: 30, angle: 0.36, penumbra: 0.55, decay: 1.2, shadow: true });
    D.spotBeam = Build.beam({ pos: [-60.9, 1.62, -1.25], dir: [7.4, -1.3, 2.45], len: 9, r: 2.2, color: 0xdde8ff, opacity: 0.16 }); D.spotBeam.visible = false;
  }

  CONTENT.levels['1E'] = Object.assign({}, LOOK, {
    name: 'Under the wall', origin: OE, amb: 'tunnel', surface: 'concrete',
    build(A) {
      const D = A.data, r = U.rng(313);
      D.fresh = true; D.tweens = [];
      D.hemi = Build.hemi({ sky: 0x3e4c58, ground: 0x0e0e0c, intensity: 0.5 });
      nightSky(A, [-60, -40, 0], [[40, -200, 300, 200, 30, false], [-420, -300, -90, 300, 60, true], [-90, 60, 60, 300, 12, true], [-90, -300, 60, -90, 12, true]], [-57, -190, -6]);
      tunnelE(A, r); streetE(A, r);
      D.rain = Build.rain({ area: 30, count: 3600, color: 0x8aa0b0, speed: 12 });
      A.navBounds(-51, -3, 1, 3);
      A.hint([[-8, 0, 0], [-24, 0, 0], [-40, 0, 0], [-49, 0, 0]]);
      A.pickup({ at: [-24.0, 0.42, -2.3], item: 'cloth' });
      A.pickup({ at: [-35.0, 0.16, 0.6], item: 'sim' });
      A.collectible({ at: [-26.2, 0.72, -1.7], kind: 'lanyard', id: 'c1_lanyard_tunnel' });
      for (const [id, at, rr] of [['c1e_tally', [-27, 0, -1], 2.8], ['c1e_shoe', [-27.4, 0, 0.9], 2.2], ['c1e_phones', [-34.6, 0, 0], 3]]) A.remark({ at, r: rr, id });
      // soldiers of the patrol, waiting in the dark (hidden until 1.7)
      D.soldier = A.char('soldier', { name: 'soldier', at: [-57.6, GY_E, -2.6], yaw: 1.25, seed: 71 });
      D.soldierB = A.char('soldier', { name: 'soldier_b', at: [-56.8, GY_E, 3.6], yaw: 2.2, seed: 72 });
      for (const s of [D.soldier, D.soldierB]) s.setVisible(false);
      for (const [n, p, yaw] of [['mk_start', [-3, 0, 0], -PI / 2], ['mk_1e_chase', [-40, 0, 0], -PI / 2], ['mk_1e_chloe', [-38, 0, 0.6], -PI / 2], ['mk_1e_wai', [-37.5, 0, -0.6], -PI / 2],
        ['mk_17_chase_in', [-47.6, 0, 0.2], -PI / 2], ['mk_17_wai_in', [-46.4, 0, -0.5], -PI / 2], ['mk_17_chloe_in', [-45.3, 0, 0.5], -PI / 2],
        ['mk_17_wai', [-53.3, GY_E, 2.1], -PI / 2 - 0.25], ['mk_17_chase', [-53.6, GY_E, 0.6], -PI / 2], ['mk_17_chloe', [-53.3, GY_E, -0.9], -PI / 2 + 0.2],
        ['mk_17_s1', [-57.6, GY_E, -2.6], 1.25], ['mk_17_s2', [-56.8, GY_E, 3.6], 2.2], ['mk_17_scan_wai', [-54.35, GY_E, 2.25], PI / 2], ['mk_17_scan_chase', [-54.6, GY_E, 0.75], PI / 2],
        ['mk_17_scan_chloe', [-54.3, GY_E, -0.95], PI / 2 - 0.1],
        ['mk_17_end_chase', [-56, GY_E, -9], PI], ['mk_17_end_chloe', [-55, GY_E, -7.5], PI], ['mk_17_end_wai', [-57.2, GY_E, -7.8], PI]]) A.marker(n, p, yaw);
      D.loops = [Audio.loop('drips', { pos: A.w([-24, 1.5, 0]), vol: 0.6 }), Audio.loop('water_lap', { pos: A.w([-52, 0, 0]), vol: 0.5 }), Audio.loop('rain', { pos: A.w([-14, 4, 0]), vol: 0.35 })];
      A.update((dt, t) => {
        const cam = Engine.camera.position, lx = cam.x - OE[0], lz = cam.z - OE[2];
        D.rain.visible = !(lx > -50.2 && lx < 1 && Math.abs(lz) < 2.9 && cam.y < 2.8);
        D.rotGlow.material.opacity = 0.7 + Math.sin(t * 2.3) * 0.08 + Math.sin(t * 7.1) * 0.05;
        if (D.tweens.length) D.tweens = D.tweens.filter(fn => !fn(dt));
      });
    },
    unload(A) { for (const l of A.data.loops) l.stop(0.4); },
  });
})();
