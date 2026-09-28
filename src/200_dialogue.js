// ============================================================================
// Dialogue — spoken lines (subtitles + face visemes + optional voice), walk-and-talk queue
// with interruption/resume, optional conversations, barks with cooldowns. Owned by: cinema agent.
// THIS IS A STUB: keep every API below, replace the implementation.
//
// CONTRACT
//   Dialogue.say(who, text, {emote, dur, pause, off, via, to}) -> Promise   one line; resolves when it ends.
//        who: speaker id (CONTENT.speakers) — animates Game.who(who) if present (speak visemes, emote, lookAt `to`).
//        via: 'phone'|'radio'|'tape'|'tv'|'recording'|'V.O.' → name suffix "WAI (phone)"; off:true → "[WAI]"
//        dur default = max(1.6, words × 0.32 + 0.6); if SETTINGS.voice, timing follows the voice's end.
//   Dialogue.lineDur(text) -> seconds
//   Dialogue.talk(id, {speakers}) -> Promise   walk-and-talk from CONTENT.talks[id] = {lines, resume, priority, maxDist}
//        pauses when the player is > 12 m from the speaker; interrupted by combat (Dialogue.interrupt()) and resumes with `resume` line
//   Dialogue.optional(id) -> Promise           optional conversation (no letterbox)
//   Dialogue.bark(who, category, {pos}) -> bool  CONTENT.barks[who][category]; 8–20 s per-speaker cooldown, 60 s per exact line
//   Dialogue.interrupt() / Dialogue.resume()
//   Dialogue.busy (a line is playing), Dialogue.stop() (clear everything, flow cancelled)
//   Dialogue.update(dt)
//   Dialogue.speaker(who) -> {name, color, voice}
// ============================================================================
const Dialogue = (() => {
  let busy = false;
  const speaker = who => Object.assign({ name: String(who).toUpperCase(), color: '#B0A8A0', voice: [1, 1] }, CONTENT.speakers[who]);
  const lineDur = text => Math.max(1.6, U.words(text) * 0.32 + 0.6);
  async function say(who, text, o = {}) {
    const sp = speaker(who), dur = o.dur || lineDur(text);
    const c = Game.who(who); if (c) { c.speak(text, dur); if (o.emote) c.emote(o.emote); }
    busy = true;
    UI.subtitle(o.off ? `[${sp.name}]` : sp.name + (o.via ? ` (${o.via})` : ''), text, sp.color);
    try { await Game.G.wait(dur); } finally { UI.subtitle(null); busy = false; }
  }
  return {
    say, lineDur, speaker, talk: async () => {}, optional: async () => {}, bark: () => false, interrupt() {}, resume() {},
    stop() { busy = false; UI.subtitle(null); }, update() {}, get busy() { return busy; },
  };
})();
