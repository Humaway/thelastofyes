// ============================================================================
// Save — checkpoints, progress and settings in localStorage (inside try/catch; the game
// runs normally if storage is blocked). Owned by: core.
// ============================================================================
const Save = (() => {
  const KEY = 'the-last-of-yes.v1';
  const fresh = () => ({ version: 1, checkpoint: null, chapters: [], scenesSeen: [], collectibles: { artifacts: [], lanyards: [], modules: [] }, finished: false, endings: [], settings: null });
  let data = fresh();

  function read() { try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  function write() { try { data.settings = JSON.parse(JSON.stringify(SETTINGS)); localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* storage blocked: keep going in memory */ } }

  function init() {
    const s = read();
    if (s && s.version === 1) data = Object.assign(fresh(), s);
    if (data.settings) { const v = Object.assign({}, SETTINGS.vol, data.settings.vol); Object.assign(SETTINGS, data.settings); SETTINGS.vol = v; }
  }

  return {
    init, write,
    get data() { return data; },
    hasContinue: () => !!data.checkpoint,
    newGame() { data.checkpoint = null; write(); },
    checkpoint(s) { data.checkpoint = s; write(); },
    unlockChapter(id) { if (!data.chapters.includes(id)) { data.chapters.push(id); write(); } },
    sawScene(id) { if (!data.scenesSeen.includes(id)) { data.scenesSeen.push(id); write(); } },
    seen: id => data.scenesSeen.includes(id),
    collect(kind, id) { const l = data.collectibles[kind]; if (l && !l.includes(id)) { l.push(id); write(); return true; } return false; },
    finish(ending) { data.finished = true; if (!data.endings.includes(ending)) data.endings.push(ending); data.lastEnding = ending; write(); },
    saveSettings: write,
  };
})();
