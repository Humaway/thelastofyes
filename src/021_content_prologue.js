// ============================================================================
// Prologue — Launch Day (spec §8). Ten years before the main story. No manual card.
// The flow is a sequence of beats; each beat is a hook implemented next to its area:
//   prologue.P1 (+ TITLE area, scene P.1)  src/301_level_p1.js     store on launch night / ten years on
//   prologue.P2, prologue.P3, prologue.P4  src/302_level_p2.js     Bub's house (P.3 intercuts store + house)
//   prologue.P5                            src/303_level_p3.js     the drive
//   prologue.P6, prologue.P7               src/304_level_p4_p5.js  the servo, the bridge
// Every checkpoint beat sets up its own areas, actors and player (it may be the first thing run after a retry).
// ============================================================================
CONTENT.chapters.prologue = {
  title: 'Prologue', name: 'LAUNCH DAY', season: '', card: null,
  steps: [
    { id: 'P.1', checkpoint: true, run: G => G.hook('prologue.P1') },
    { id: 'P.2', checkpoint: true, run: G => G.hook('prologue.P2') },
    { id: 'P.3', run: G => G.hook('prologue.P3') },
    { id: 'P.4', run: G => G.hook('prologue.P4') },
    { id: 'P.5', checkpoint: true, run: G => G.hook('prologue.P5') },
    { id: 'P.6', checkpoint: true, run: G => G.hook('prologue.P6') },
    { id: 'P.7', checkpoint: true, run: G => G.hook('prologue.P7') },
  ],
};
