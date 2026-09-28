// ============================================================================
// Player data — item names, crafting recipes, workbench upgrades and Sales Training skills (spec §6, §17).
// Read by Play (180), Kit (187) and the player UI (215). Owned by: systems (player) agent.
//   CONTENT.items[id]      { name }  every inventory id (ingredients, crafted items, ammo, weapons, melee)
//   CONTENT.recipes        [{ id, need: {item: n}, time (s), use }]  backpack wheel order
//   CONTENT.upgrades[gun]  [{ id: 'cap'|'reload'|'dmg'|'sway', name, text, cost (bars) }]
//   CONTENT.skills         six skills; the n-th Sales Training Module found raises skills[(n - 1) % 6] one level (max 2)
// ============================================================================
CONTENT.items = {
  cloth: { name: 'cloth' }, alcohol: { name: 'alcohol' }, tape: { name: 'tape' }, sim: { name: 'SIM ejector' },
  battery: { name: 'swollen battery' }, nokia: { name: 'old Nokia' }, scrap: { name: 'scrap' }, bars: { name: 'bars' },
  medkit: { name: 'first aid' }, shiv: { name: 'SIM shiv' }, pillow: { name: 'spicy pillow' }, ringtone: { name: 'ringtone bomb' },
  vape: { name: 'vape cloud' }, blade: { name: 'melee blade' }, bottle: { name: 'bottle' }, brick: { name: 'brick' },
  revolver_ammo: { name: 'revolver rounds' }, shotgun_ammo: { name: 'shells' }, rifle_ammo: { name: 'rifle rounds' },
  pistol_ammo: { name: 'pistol rounds' }, arrow: { name: 'arrows' },
  revolver: { name: 'revolver' }, shotgun: { name: 'sawn-off' }, rifle: { name: 'hunting rifle' }, pistol: { name: 'pistol' }, bow: { name: 'bow' },
  pipe: { name: 'pipe' }, plank: { name: 'plank' }, bat: { name: 'cricket bat' }, machete: { name: 'machete' },
  box_cutter: { name: 'box cutter' }, fists: { name: 'fists' },
};

CONTENT.recipes = [
  { id: 'medkit', need: { cloth: 1, alcohol: 1 }, time: 2.5, use: 'Heals 60%. Three seconds to apply.' },
  { id: 'shiv', need: { sim: 1, tape: 1 }, time: 1.5, use: 'Kills a Clicker silently, or breaks free of one.' },
  { id: 'pillow', need: { battery: 1, cloth: 1 }, time: 2, use: 'Fire bomb. Burns for four seconds.' },
  { id: 'ringtone', need: { nokia: 1, tape: 1, scrap: 1 }, time: 3, use: 'Rings at full volume, draws them in, then blows.' },
  { id: 'vape', need: { alcohol: 1, scrap: 1 }, time: 2, use: 'Smoke. Blinds anyone inside it for six seconds.' },
  { id: 'blade', need: { tape: 1, sim: 1 }, time: 2, use: 'Tapes a blade to the melee weapon in your hand. One-hit kills.' },
];

CONTENT.upgrades = {
  revolver: [
    { id: 'cap', name: 'Capacity', text: 'Holds eight rounds instead of six.', cost: 3 },
    { id: 'reload', name: 'Speed loader', text: 'Reloads a third faster.', cost: 2 },
    { id: 'dmg', name: 'Heavier load', text: 'Hits harder. Drops most things in one.', cost: 4 },
    { id: 'sway', name: 'Steady grip', text: 'Less sway when you aim.', cost: 2 },
  ],
  shotgun: [
    { id: 'cap', name: 'Third shell', text: 'Holds three shells.', cost: 5 },
    { id: 'reload', name: 'Shell holder', text: 'Reloads a third faster.', cost: 3 },
    { id: 'dmg', name: 'Tighter choke', text: 'Keeps its spread further out.', cost: 3 },
  ],
  rifle: [
    { id: 'cap', name: 'Capacity', text: 'Holds seven rounds.', cost: 4 },
    { id: 'reload', name: 'Smooth bolt', text: 'Reloads and cycles faster.', cost: 3 },
    { id: 'sway', name: 'Cheek rest', text: 'Steadier through the scope.', cost: 2 },
  ],
  pistol: [
    { id: 'cap', name: 'Extended mag', text: 'Holds twelve rounds.', cost: 3 },
    { id: 'sway', name: 'Steady grip', text: 'Less sway when you aim.', cost: 2 },
  ],
  bow: [
    { id: 'reload', name: 'Quiver', text: 'Nocks the next arrow faster.', cost: 2 },
    { id: 'dmg', name: 'Heavier draw', text: 'Arrows hit harder.', cost: 3 },
  ],
};

CONTENT.skills = [
  { id: 'listen', name: 'Airplane Mode range', text: 'Hear further while listening.' },
  { id: 'craft', name: 'Crafting speed', text: 'Craft faster.' },
  { id: 'health', name: 'Max health', text: 'More health.' },
  { id: 'shiv', name: 'Shiv durability', text: 'Shivs last one more use.' },
  { id: 'heal', name: 'Healing speed', text: 'Apply first aid faster.' },
  { id: 'steady', name: 'Steadier aim', text: 'Less sway when you aim.' },
];

