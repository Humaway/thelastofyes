// ============================================================================
// Dialogue — spoken lines (subtitles + face visemes + optional voice), walk-and-talk queue
// with interruption/resume, optional conversations, barks with cooldowns. Owned by: cinema agent.
//
// CONTRACT
//   Dialogue.say(who, text, {emote, dur, pause, off, via, to, char}) -> Promise   one line; resolves when it ends (or is cut).
//        who: speaker id (CONTENT.speakers) — animates `char` or Game.who(who) if present (speak visemes, emote, lookAt `to`).
//        via: 'phone'|'radio'|'tape'|'tv'|'recording'|'V.O.' → name suffix "WAI (phone)"; off:true → "[WAI]"
//        dur default = max(1.6, words × 0.32 + 0.6); if SETTINGS.voice, timing follows the voice's end.
//        to: who | position spec | Vector3 | Character | () => Vector3. A silent beat ('…') shows but moves no mouth.
//        A scripted line (say / scene) cuts whatever is playing; a cut walk-and-talk line replays after its resume line.
//   Dialogue.lineDur(text) -> seconds
//   Dialogue.talk(id, {speakers}) -> Promise   walk-and-talk from CONTENT.talks[id] = {lines, resume, priority, maxDist}
//        One talk at a time, highest priority first (FIFO within a priority). Waits for scenes and scripted lines, pauses
//        while the player is > maxDist (12 m) from any other speaker, and after Dialogue.interrupt() stops at the end of
//        the current line; when it continues after an interruption (or after another talk took over) it first plays
//        `resume` ({who, text, emote} or a string said by the next speaker). speakers: ids for the distance check
//        (default: every `who` in lines). Speakers look at each other; resolves when the last line ends.
//   Dialogue.optional(id) -> Promise           optional conversation (no letterbox, top priority, same rules)
//   Dialogue.bark(who, category, {pos, char}) -> bool  CONTENT.barks[who][category] = [text | {text, emote}] (+ optional
//        CONTENT.barks[who].speaker: the subtitle speaker id). 8–20 s per-speaker cooldown, 60 s per exact line; never over
//        another line, a talk under way or a scene; skipped when pos is > 40 m from the camera. char: Character to animate.
//   Dialogue.interrupt() / Dialogue.resume()
//   Dialogue.busy (a line is playing), Dialogue.stop() (clear everything, flow cancelled), Dialogue.hush() (cut the line now)
//   Dialogue.update(dt)
//   Dialogue.speaker(who) -> {name, color, voice}
//   Dialogue.extendArea(A) adds (area-local positions):
//        A.talk(id, {at, r=3 | box:[x1,z1,x2,z2], speakers, cond}) — starts Dialogue.talk(id) once when the player enters
//        A.optional(id, {near: who | at, r=1.8, prompt='e – talk', cond}) — prompt that follows `near`; plays it once
// ============================================================================
const Dialogue = (() => {
  let cur = null, quietT = 0, ducked = false, interrupted = false, lastTalk = null, seq = 0;
  const queue = [], spkCool = {}, lineCool = {};
  const speaker = who => Object.assign({ name: String(who).toUpperCase(), color: '#B0A8A0', voice: [1, 1] }, CONTENT.speakers[who]);
  const lineDur = text => Math.max(1.6, U.words(text) * 0.32 + 0.6);
  const target = to => to == null || typeof to === 'function' || to.root || to.isVector3 ? to : (typeof to === 'string' && Game.who(to)) || Director.point(to);

  // ---- the line channel (one line at a time) ----------------------------------
  function start(who, text, o, kind, talk) {
    if (cur) end(true);
    const sp = speaker(who), c = o.char || Game.who(who), dur = o.dur || lineDur(text), mute = !/[\p{L}\p{N}]/u.test(text);
    return new Promise(resolve => {
      const L = cur = { c, t: 0, dur, kind, talk, resolve, voiceOn: SETTINGS.voice && !mute, voiceEnd: null };
      if (c) { if (!mute) c.speak(text, dur); if (o.emote) c.emote(o.emote); if (o.to !== undefined) c.lookAt(target(o.to)); }
      UI.subtitle(o.off ? `[${sp.name}]` : sp.name + (o.via ? ` (${o.via})` : ''), text, sp.color, dur);
      if (!ducked) { Audio.duck(true); ducked = true; }
      if (L.voiceOn) Audio.voice(who, text, { pitch: sp.voice[0], rate: sp.voice[1] }).then(() => { L.voiceEnd = L.t; });
    });
  }
  function end(cut) {
    const L = cur;
    cur = null; quietT = 0;
    if (cut && L.c && L.c.speaking) L.c.speak('', 0);
    if (cut && L.voiceOn && window.speechSynthesis) speechSynthesis.cancel();
    UI.subtitle(null);
    if (L.talk) lineDone(L.talk, cut);
    L.resolve();
  }
  async function say(who, text, o = {}) {
    if (o.pause) await Game.G.wait(o.pause);
    return start(who, text, o, 'say');
  }

  // ---- walk-and-talks ---------------------------------------------------------
  function talk(id, o = {}) {
    const d = CONTENT.talks[id];
    if (!d) { console.error('no talk ' + id); return Promise.resolve(); }
    return new Promise(resolve => queue.push({ id, d, i: 0, gap: 0, seq: seq++, pri: o.optional ? Infinity : d.priority || 0, resolve,
      speakers: o.speakers || [...new Set(d.lines.map(l => l.who))], needResume: false, resuming: false, last: null }));
  }
  function lineDone(T, cut) {
    T.gap = 0;
    if (T.resuming) { T.resuming = false; if (!cut) T.needResume = false; return; }
    if (cut) { if (T.i > 0) T.needResume = true; return; }   // replay the cut line after the resume line
    T.last = T.d.lines[T.i].who;
    if (++T.i < T.d.lines.length) return;
    queue.splice(queue.indexOf(T), 1);
    for (const id of T.speakers) { const c = Game.who(id); if (c) c.lookAt(null); }
    if (lastTalk === T) lastTalk = null;
    T.resolve();
  }
  function far(T) {
    const pl = Play.char, max = T.d.maxDist ?? 12;
    if (!pl) return false;
    return T.speakers.some(id => { const c = Game.who(id); return c && c !== pl && c.root.position.distanceTo(pl.root.position) > max; });
  }
  function partner(T, who) {
    if (T.last && T.last !== who && Game.who(T.last)) return Game.who(T.last);
    for (const id of T.speakers) if (id !== who && Game.who(id)) return Game.who(id);
    return Play.char && Play.char !== Game.who(who) ? Play.char : null;
  }
  function runTalks(dt) {
    if (!queue.length || cur || interrupted || Director.active) return;
    const T = queue.reduce((a, b) => b.pri > a.pri || (b.pri === a.pri && b.seq < a.seq) ? b : a);
    if (far(T)) return;
    if (T !== lastTalk && T.i > 0) T.needResume = true;
    lastTalk = T;
    const r = T.needResume && T.d.resume, next = T.d.lines[T.i];
    const L = r ? (typeof r === 'string' ? { who: next.who, text: r } : r) : next;
    if ((T.gap += dt) < (L.pause ?? 0.4)) return;
    T.resuming = !!r; if (!r) T.needResume = false;
    const sp = Game.who(L.who), to = L.to ?? partner(T, L.who);
    for (const id of T.speakers) { const c = Game.who(id); if (c && c !== sp && sp) c.lookAt(sp); }
    start(L.who, L.text, Object.assign({}, L, { to }), 'talk', T);
  }

  // ---- barks ----------------------------------------------------------------------
  function bark(who, category, o = {}) {
    const set = CONTENT.barks[who], list = set && set[category], now = Game.time;
    if (!list || !list.length || cur || Director.active || now < (spkCool[who] || 0)) return false;
    if (!interrupted && queue.some(T => T.i > 0)) return false;
    if (o.pos && Engine.camera.position.distanceTo(o.pos) > 40) return false;
    const free = list.filter(l => (lineCool[l.text || l] || 0) <= now);
    if (!free.length) return false;
    const l = U.pick(free), text = l.text || l;
    spkCool[who] = now + U.range(8, 20); lineCool[text] = now + 60;
    start(set.speaker || who, text, { emote: l.emote, char: o.char }, 'bark');
    return true;
  }

  function update(dt) {
    if (cur) {
      cur.t += dt;
      if (cur.kind === 'talk' && Director.active) end(true);
      else if (cur.voiceOn ? (cur.voiceEnd != null && cur.t >= (cur.voiceEnd < 0.3 ? cur.dur : cur.voiceEnd + 0.1)) || cur.t > cur.dur * 2.5 + 3 : cur.t >= cur.dur) end(false);
    }
    if (!cur && ducked && (quietT += dt) > 0.6) { Audio.duck(false); ducked = false; }
    runTalks(dt);
  }

  function stop() {
    if (cur) end(true);
    for (const T of queue.splice(0)) T.resolve();
    interrupted = false; lastTalk = null;
    if (ducked) { Audio.duck(false); ducked = false; }
    UI.subtitle(null);
  }

  function extendArea(A) {
    A.talk = (id, o = {}) => {
      let done = false;
      const p = o.at && A.w(o.at), b = o.box, ox = A.origin.x, oz = A.origin.z;
      A.update(() => {
        const pl = Play.char;
        if (done || !pl || (o.cond && !o.cond())) return;
        const q = pl.root.position;
        const inside = b ? q.x >= Math.min(b[0], b[2]) + ox && q.x <= Math.max(b[0], b[2]) + ox && q.z >= Math.min(b[1], b[3]) + oz && q.z <= Math.max(b[1], b[3]) + oz
          : U.dist2(q, p) <= (o.r ?? 3);
        if (inside) { done = true; talk(id, o); }
      });
    };
    A.optional = (id, o = {}) => {
      const it = A.interactable({ at: o.at || [0, 0, 0], r: o.r ?? 1.8, prompt: o.prompt || 'e – talk', cond: o.cond, use: () => optional(id) });
      if (o.near) A.update(() => { const c = Game.who(o.near); if (c) it.pos.copy(c.root.position); });
      return it;
    };
  }

  const optional = id => talk(id, { optional: true });
  return {
    say, lineDur, speaker, talk, optional, bark, update, stop, extendArea,
    hush() { if (cur) end(true); },
    interrupt() { interrupted = true; for (const T of queue) if (T.i > 0 || (cur && cur.talk === T)) T.needResume = true; },
    resume() { interrupted = false; },
    get busy() { return !!cur; },
  };
})();
