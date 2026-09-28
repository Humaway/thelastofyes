// ============================================================================
// Chapter 1 — Onboarding (Summer, spec §9). Establish the world, Chase and Wai, meet Chloe, teach stealth,
// Airplane Mode, crafting basics and the Clicker rules. Ends with Wai's sacrifice.
// Each beat is a hook implemented next to its areas:
//   ch1.1 ch1.2            src/310_level_1ab.js   1A Chase's room, 1B the QZ streets
//   ch1.3 ch1.4 ch1.5 ch1.6 ch1.7   src/311_level_1ce.js   1C warehouse, 1D Landlines basement, 1E under the wall
//   ch1.8 ch1.9 ch1.8b     src/312_level_1f.js    1F the drowned tower
//   ch1.10 ch1.11          src/313_level_1gh.js   1G Queen Street Mall + flagship, 1H stockroom, arcade, rooftop
// Every checkpoint beat sets up its own areas, actors, player and inventory (it may run first after a retry).
// ============================================================================
CONTENT.chapters.ch1 = {
  title: 'Chapter 1', name: 'ONBOARDING', season: 'SUMMER',
  card: { step: 1, text: 'Greet the customer. First impressions last!', vo: [{ who: 'chloe', text: 'Great.', emote: 'smirk' }] },
  steps: [
    { id: '1.1', checkpoint: true, run: async G => { await G.card('ch1'); await G.hook('ch1.1'); } },
    { id: '1.2', checkpoint: true, run: G => G.hook('ch1.2') },
    { id: '1.3', checkpoint: true, run: G => G.hook('ch1.3') },
    { id: '1.4', checkpoint: true, run: G => G.hook('ch1.4') },
    { id: '1.5', run: G => G.hook('ch1.5') },
    { id: '1.6', checkpoint: true, run: G => G.hook('ch1.6') },
    { id: '1.7', run: G => G.hook('ch1.7') },
    { id: '1.8', checkpoint: true, run: G => G.hook('ch1.8') },
    { id: '1.9', run: G => G.hook('ch1.9') },
    { id: '1.8b', checkpoint: true, run: G => G.hook('ch1.8b') },
    { id: '1.10', checkpoint: true, run: G => G.hook('ch1.10') },
    { id: '1.11', checkpoint: true, run: G => G.hook('ch1.11') },
  ],
};
