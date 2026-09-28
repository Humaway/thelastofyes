// ============================================================================
// Shared content used across chapters (spec §17): the Sales Tips, and the collectible formats that chapter
// files append to. Owned by: core.
//
// Collectibles (chapter files push their own, ids prefixed by chapter, e.g. 'c1_…'):
//   CONTENT.collectibles.artifacts.push({ id, chapter, title, text })        // 30 in total — notes and objects read in the Journal
//   CONTENT.collectibles.lanyards.push({ id, chapter, title, remark? })      // 20 — "—— · Store Manager · Toowong" (never a name)
//   CONTENT.collectibles.modules.push({ id, chapter, title, skill })         // 12 — skill: listen_range craft_speed max_health
//                                                                              //   shiv_durability heal_speed steady_aim
//   Placed in areas with A.collectible({ at, kind, id }) (Play.extendArea); Save.collect(kind, id) records them.
// Chloe's remarks: CONTENT.remarks[id] = { text, emote } (text '' + silent:true for the ones she doesn't say); placed with
//   A.remark({ at, r, id }). At least 40 across the game, each plays once (spec §17).
// Sales Tips: placed with A.collectible({ at, kind: 'tip', id: n }); playing one runs its lines as an optional conversation.
// ============================================================================
CONTENT.tips = [
  { n: 1, chapter: 'ch1', tip: 'Always smile! Customers can hear it.', lines: [{ who: 'chloe', text: 'Can they hear it through a gas mask?', emote: 'smirk' }] },
  { n: 2, chapter: 'ch1', tip: "Mirror your customer's body language.", act: 'mirror_slouch', lines: [{ who: 'chase', text: 'Stop.', emote: 'tense' }, { who: 'chloe', text: 'Stop.', emote: 'smirk', note: 'slouching harder' }] },
  { n: 3, chapter: 'ch2', tip: "Never say no. Say 'What I can do is…'", lines: [{ who: 'chloe', text: 'What I can do is stab it.', emote: 'smirk' }] },
  { n: 4, chapter: 'ch2', tip: "The customer doesn't want a drill. They want a hole.", lines: [{ who: 'chloe', text: "…That's so dark, out of context.", emote: 'shocked' }] },
  { n: 5, chapter: 'ch2', tip: 'Always offer the case!', lines: [{ who: 'chloe', text: 'Chase, would you like a case with your shotgun?', emote: 'smile' }, { who: 'chase', text: 'Would you like a lift or a walk?', emote: 'smirk' }] },
  { n: 6, chapter: 'ch3', tip: 'Handle the objection, not the customer.', lines: [{ who: 'chloe', text: 'Too late.', emote: 'sad', note: 'looking at a dead Door Knocker' }] },
  { n: 7, chapter: 'ch3', tip: 'Silence is a closing tool.', lines: [{ who: 'chloe', text: "You'd be the best closer in the world.", emote: 'smirk' }, { who: 'chase', text: '…' }, { who: 'chloe', text: 'See?', emote: 'smile' }] },
  { n: 8, chapter: 'ch4', tip: 'Every interaction is a relationship!', lines: [{ who: 'chloe', text: 'So what are we, Chase? Prepaid?', emote: 'smirk' }, { who: 'chase', text: 'Month to month.', emote: 'neutral' }, { who: 'chloe', text: 'Wow.', emote: 'smirk' }] },
  { n: 9, chapter: 'ch4', tip: "Use the customer's name. People love hearing their own name.", lines: [{ who: 'chloe', text: 'People. Love. Hearing. Their own name.', emote: 'tense', note: 'pointedly' }, { who: 'chase', text: 'Noted.', emote: 'neutral' }, { who: 'chloe', text: 'Is it though.', emote: 'sad' }] },
  { n: 10, chapter: 'ch5', tip: "You're not selling a phone. You're selling connection.", lines: [{ who: 'chloe', text: '…Huh.', emote: 'tender', note: 'quietly' }] },
  { n: 11, chapter: 'ch7', tip: "Don't overpromise.", act: 'flat_close', lines: [], note: 'Chloe reads it flat and closes the book. Chase looks away.' },
  { n: 12, chapter: 'ch7', tip: 'Always ask for the referral!', where: 'the dormitory before 7.10', lines: [{ who: 'chloe', text: 'Chase. Do you know anyone else who wants to be shot at?', emote: 'smirk' }, { who: 'chase', text: 'No. Just you.', emote: 'smile', note: 'a real smile' }] },
];
