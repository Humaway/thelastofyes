// ============================================================================
// UI — DOM overlay: loading, click-to-begin, title menu, pause, settings, chapters, extras,
// fades, letterbox, subtitles, prompts, manual-page chapter cards (canvas), title text, HUD,
// phone-screen overlays, skip ring, death, choice screen, credits, journal, backpack.
// Owned by: cinema agent. THIS IS A STUB: keep every API below, replace the implementation.
//
// CONTRACT
//   UI.init() · UI.update(dt)
//   UI.loading(pct 0..1 | null)            boot screen: pulsing coiled-cord icon + percentage (null hides)
//   UI.clickToBegin() -> Promise           "Click to begin" (unlocks audio)
//   UI.titleScreen()                       logo + menu (CONTINUE, NEW GAME, CHAPTERS, SETTINGS, EXTRAS) over the live TITLE area
//   UI.hideMenus() · UI.menuOpen() -> bool · UI.pauseMenu(on)
//   UI.fade(to 'black'|'white'|'none', dur) -> Promise
//   UI.letterbox(on, dur=0.6)             2.39:1 bars
//   UI.subtitle(name|null, text, color)    bottom-centre; respects SETTINGS.subtitles/subSize/subBg/subNames
//   UI.prompt(text|null)                   small lowercase prompt bottom-centre ("e – talk")
//   UI.card(chapterId) -> Promise          chapter opening: The Yes Way manual page (CONTENT.chapters[id].card) then title + season
//   UI.titleText(lines[], {hold, fadeIn, fadeOut, size, gap}) -> Promise   thin widely-spaced white capitals, centred, over black or image
//   UI.phone(state|null)                   phone screen overlay (see ARCHITECTURE.md "phone overlay")
//   UI.hud(state)                          {show, health 0..1, weapon, ammo, reserve, throwable, listen}
//   UI.skipRing(p 0..1 | null)
//   UI.death(cause) -> Promise             fade to black under a click; resolves when retry should start (< 3 s)
//   UI.endOfBuild()                        "End of current build" screen with Return to title
//   UI.detect(dirRadians, amount 0..1)     stealth detection arc at the screen edge
// ============================================================================
const UI = (() => {
  let root, fadeEl, subEl, promptEl, lbTop, lbBot, loadEl, textEl;
  const css = `
  .ui-full{position:absolute;inset:0}
  #ui-fade{background:#000;opacity:0;transition:opacity .01s linear}
  .ui-lb{position:absolute;left:0;right:0;height:0;background:#000;transition:height .6s ease}
  #ui-sub{position:absolute;left:50%;bottom:9%;transform:translateX(-50%);max-width:44ch;text-align:center;font-size:22px;line-height:1.35;text-shadow:0 1px 3px #000,0 0 8px #000;padding:6px 14px;border-radius:4px}
  #ui-prompt{position:absolute;left:50%;bottom:4%;transform:translateX(-50%);font-size:14px;letter-spacing:.08em;opacity:.85;text-transform:lowercase}
  #ui-load{display:flex;align-items:center;justify-content:center;font-size:13px;letter-spacing:.2em;background:#000;pointer-events:auto}
  #ui-text{display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:200;letter-spacing:.5em;font-size:28px;text-align:center;opacity:0}
  `;
  const el = (tag, id, cls) => { const e = document.createElement(tag); if (id) e.id = id; if (cls) e.className = cls; root.appendChild(e); return e; };
  function init() {
    root = document.getElementById('ui');
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    lbTop = el('div', null, 'ui-lb'); lbTop.style.top = 0; lbBot = el('div', null, 'ui-lb'); lbBot.style.bottom = 0;
    subEl = el('div', 'ui-sub'); promptEl = el('div', 'ui-prompt'); textEl = el('div', 'ui-text', 'ui-full');
    fadeEl = el('div', 'ui-fade', 'ui-full'); loadEl = el('div', 'ui-load', 'ui-full');
  }
  function fade(to, dur = 1) {
    fadeEl.style.transition = `opacity ${dur}s linear`;
    fadeEl.style.background = to === 'white' ? '#fff' : '#000';
    fadeEl.style.opacity = to === 'none' ? 0 : 1;
    return Game.G.wait(dur).catch(() => {});
  }
  function letterbox(on, dur = 0.6) { const h = on ? `${Math.max(0, (innerHeight - innerWidth / 2.39) / 2)}px` : '0px'; for (const b of [lbTop, lbBot]) { b.style.transition = `height ${dur}s ease`; b.style.height = h; } }
  function subtitle(name, text, color) { if (!name && !text) { subEl.innerHTML = ''; return; } subEl.innerHTML = (name ? `<b style="color:${color}">${name}:</b> ` : '') + text; }
  function prompt(t) { promptEl.textContent = t || ''; }
  function loading(p) { if (p == null) { loadEl.style.display = 'none'; return; } loadEl.style.display = 'flex'; loadEl.textContent = Math.round(p * 100) + '%'; }
  function clickToBegin() { loadEl.style.display = 'flex'; loadEl.textContent = 'Click to begin'; return new Promise(r => loadEl.addEventListener('click', () => { loadEl.style.display = 'none'; r(); }, { once: true })); }
  async function titleText(lines, o = {}) { textEl.innerHTML = lines.map(l => `<div>${l}</div>`).join(''); textEl.style.transition = `opacity ${o.fadeIn ?? 1.5}s`; textEl.style.opacity = 1; await Game.G.wait((o.fadeIn ?? 1.5) + (o.hold ?? 3)); textEl.style.transition = `opacity ${o.fadeOut ?? 1.5}s`; textEl.style.opacity = 0; await Game.G.wait(o.fadeOut ?? 1.5); }
  return {
    init, update() {}, loading, clickToBegin, titleScreen() { Game.newGame(); }, hideMenus() {}, menuOpen: () => false, pauseMenu() {},
    fade, letterbox, subtitle, prompt, card: async () => {}, titleText, phone() {}, hud() {}, skipRing() {},
    death: async () => { await fade('black', 0.8); }, endOfBuild() { subtitle('', 'End of current build'); }, detect() {},
  };
})();
