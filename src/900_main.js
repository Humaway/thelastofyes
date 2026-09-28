// ============================================================================
// Main — boot, loading screen, "click to begin", the frame loop, dev hooks. Owned by: core.
// Dev URL params (with ?dev):
//   goto=chapter[:stepId]  start the flow there (skips boot + title)
//   scene=ID               load the scene's area and play the scene
//   area=ID                load an area with Chase as free-roam player at marker mk_start (or origin)
//   test=name              run CONTENT.dev[name](G)
//   title                  go straight to the title screen
// window.GAME.dev.ff(sec) fast-forwards game time with fixed steps (used by tools/shot.mjs).
// ============================================================================
(() => {
  let last = performance.now(), ffActive = false;
  const errorsShown = new Set();
  addEventListener('unhandledrejection', e => { if (e.reason === Game.ABORT) e.preventDefault(); });

  function frame(now) {
    requestAnimationFrame(frame);
    if (ffActive) return;
    const dt = Math.min((now - last) / 1000, CONFIG.maxDt); last = now;
    try { Game.tick(dt); Engine.render(dt); }
    catch (e) { const k = String(e && e.message); if (!errorsShown.has(k)) { errorsShown.add(k); console.error(e); } }
  }

  const macro = () => new Promise(r => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); });
  const dev = {
    async ff(sec) { ffActive = true; try { const n = Math.round(sec / CONFIG.fixedDt); for (let i = 0; i < n; i++) { Game.tick(CONFIG.fixedDt); await macro(); } } finally { ffActive = false; last = performance.now(); } },
    render() { Engine.render(0.0001, false); },
    goto: (ch, step) => Game.startChapter(ch, step),
    scene: async id => { const s = CONTENT.scenes[id]; if (s && s.area) await Game.loadArea(s.area); Game.state = 'play'; return Director.play(id); },
    area: async id => { await Game.loadArea(id); Game.state = 'play'; const c = Game.actor('chase', 'chase', Game.area.markers.mk_start ? 'mk_start' : [0, 0, 0]); Play.setPlayer(c, {}); Play.enable(true); },
  };
  window.GAME = { ready: false, dev, Engine, Game, Director, Play, Chars, UI, Audio, Tex, Build, World, AI, Dialogue, Save, Input, CONTENT, THREE, SETTINGS };

  async function boot() {
    Save.init();
    Engine.init(document.getElementById('app'));
    Input.init();
    UI.init();
    UI.loading(0);
    requestAnimationFrame(frame);
    // Pre-build procedural assets in slices so the loading percentage moves.
    const jobs = [...(Tex.preload ? Tex.preload() : []), ...(Chars.preload ? Chars.preload() : [])];
    for (let i = 0; i < jobs.length; i++) { jobs[i](); UI.loading((i + 1) / jobs.length); if (i % 3 === 2) await macro(); }
    UI.loading(1);
    const p = PARAMS;
    if (CONFIG.dev && (p.has('goto') || p.has('scene') || p.has('area') || p.has('test') || p.has('title'))) {
      UI.loading(null);
      Audio.init();
      window.GAME.ready = true;
      if (p.has('goto')) { const [ch, st] = p.get('goto').split(':'); Game.startChapter(ch, st); }
      else if (p.has('scene')) dev.scene(p.get('scene'));
      else if (p.has('area')) dev.area(p.get('area'));
      else if (p.has('test')) { Game.state = 'play'; CONTENT.dev[p.get('test')](Game.G); }
      else Game.titleScreen();
      return;
    }
    window.GAME.ready = true;
    await UI.clickToBegin();       // unlocks audio
    Audio.init();
    Game.titleScreen();
  }
  boot().catch(e => console.error(e));
})();
