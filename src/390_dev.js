// ============================================================================
// Dev sandbox content (only reachable with ?dev). Owned by: core.
// ============================================================================
CONTENT.levels.DEV = {
  name: 'Dev yard', grade: 'neutral', fog: { color: 0x9aa6b0, near: 30, far: 120 }, env: { top: 0x7090b0, horizon: 0xb0a890, bottom: 0x403830, intensity: 0.8 },
  build(A) {
    Build.hemi({ sky: 0x9ab0c8, ground: 0x4a4030, intensity: 0.5 });
    Build.sun({ dir: [-0.4, -1, -0.6], color: 0xfff0d8, intensity: 2.5, area: 25 });
    Build.box(60, 0.1, 60, Tex.mat('concrete', { color: 0x777777, repeat: [20, 20] }), { pos: [0, -0.1, 0] });
    for (let i = 0; i < 6; i++) Build.box(1.2, 1 + i * 0.4, 1.2, Tex.mat('brick', { color: 0x995544 }), { pos: [-6 + i * 2.4, 0, -6] });
    A.marker('mk_start', [0, 0, 4], Math.PI);
    A.marker('mk_a', [-1, 0, 0], Math.PI / 2);
    A.marker('mk_b', [1, 0, 0], -Math.PI / 2);
  },
};
CONTENT.scenes.TEST = {
  title: 'Test', area: 'DEV', grade: 'neutral', letterbox: true, music: null,
  cast: { chase: 'mk_a', chloe: 'mk_b' },
  shots: [
    { cam: { type: 'static', at: [0, 1.6, 4.5], look: [0, 1.4, 0], lens: 35 }, lines: [{ who: 'chase', text: 'Test line one.', emote: 'tense' }] },
    { cam: { type: 'ots', over: 'chase', on: 'chloe', lens: 50 }, lines: [{ who: 'chloe', text: 'And the reply.', emote: 'smirk' }] },
  ],
  exit: { blend: 'gameplay', dur: 1.2 },
};
CONTENT.dev.smoke = async G => {
  await G.area('DEV');
  G.actor('chase', 'chase', 'mk_a'); G.actor('chloe', 'chloe', 'mk_b');
  await G.scene('TEST');
  G.player('chase'); G.control(true);
};
