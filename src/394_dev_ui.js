// ============================================================================
// Dev UI sandboxes (only reachable with ?dev). Owned by: ui agent.
// Every screen the UI draws, for screenshots: ?dev&test=ui_<name>; ?dev&test=ui runs the in-game ones back to back.
// Times are game seconds after the test starts (use ff: steps).
//   ui_title     title screen, CONTINUE / CHAPTERS / EXTRAS unlocked in memory; menu takes input from ~3 s
//   ui_settings  title → SETTINGS → SUBTITLES rows with the sample subtitle (~4 s); &cat=1..4 another category
//   ui_chapters  title → CHAPTERS (~4 s) · ui_extras  title → EXTRAS → COLLECTIBLES (~4 s)
//   ui_pause     paused over the dev yard (~1 s); &then=settings opens SETTINGS, &then=quit the quit confirmation
//   ui_card      Yes Way card, &step=1..6: page from ~2 s, reading ~3.6 s, titles ~11–16 s
//   ui_text      REDCLIFFE… (0–6 s), then THE LAST OF YES / TEN YEARS LATER (8 s on, second line at 10.5 s)
//   ui_subs      subtitles, 4 s each: plain, off-screen, a long line paged in 2-line pages, inside the letterbox
//   ui_hud       full HUD (0–4 s), low battery + airplane mode (4–8 s), aiming (8–10 s), idle fade from 14 s
//   ui_phone     lock 0, notification 3, typing 6–10, sending 11.5, off 14.5, call 16.5, install 19.5, not delivered 22.5
//   ui_skip      cutscene letterbox + subtitle + skip ring at 65% (~2 s)
//   ui_stealth   detection arcs building from the left and behind-right + a prompt (~2 s)
//   ui_death     death: click + fade, RETRY ~1 s, retry ~2 s
//   ui_end       end of current build (text from ~3.5 s)
// ============================================================================
(() => {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const yard = async G => { await G.area('DEV'); G.player(G.actor('chase', 'chase', 'mk_start')); G.control(true); await G.wait(0.3); };
  // synthetic key taps, read by the UI on the next tick. Ticks are counted through Input.typed (a new array every
  // Input.update), so this also works while paused and under fast-forward.
  const macro = () => new Promise(r => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); });
  const ticks = async n => { while (n-- > 0) { const t = Input.typed; while (Input.typed === t) await macro(); } };
  const keys = async (...codes) => { for (const code of codes) { dispatchEvent(new KeyboardEvent('keydown', { code, key: code })); await ticks(1); dispatchEvent(new KeyboardEvent('keyup', { code, key: code })); await ticks(3); } };
  const unlockAll = () => {
    const d = Save.data;
    d.checkpoint = d.checkpoint || { chapter: 'prologue', step: 'P.2', inv: null, flags: {} };
    d.finished = true;
    for (const id of CONTENT.chapterOrder) if (CONTENT.chapters[id] && !d.chapters.includes(id)) d.chapters.push(id);
    for (const id of Object.keys(CONTENT.scenes).slice(0, 8)) if (!d.scenesSeen.includes(id)) d.scenesSeen.push(id);
  };
  const title = async G => {
    unlockAll();
    if (CONTENT.levels.TITLE) await Game.titleScreen();
    else { await G.area('DEV'); Director.manual({ pos: V(7, 1.6, 9), target: V(-3, 1.1, -5), fov: 45 }); Game.state = 'title'; UI.titleScreen(); }
    await G.wait(3.3);
  };
  const CARDS = [
    ['Chapter 1', 'ONBOARDING', 'SUMMER', 'Greet the customer. First impressions last!', [['chloe', 'Great.', 'smirk']]],
    ['Chapter 2', 'COLD CALLING', 'SUMMER', 'Build rapport. Find something in common!', [['chloe', 'We both hate you, Chase. That’s something.', 'smirk']]],
    ['Chapter 3', 'DOOR TO DOOR', 'LATE SUMMER', 'Discover needs. Ask open questions!', [['chloe', 'Open question. Why is everyone trying to kill us?', 'smirk']]],
    ['Chapter 4', 'THE DEAD ZONE', 'AUTUMN', 'Present the solution. Match the product to the need!', [['chloe', 'Chase, what’s the product?', 'neutral'], ['chase', 'Luke.', 'neutral']]],
    ['Chapter 5', 'HANDLING OBJECTIONS', 'LATE AUTUMN', 'Handle objections. Every no is just a not yet!', [['chloe', 'Wai wrote that one.', 'sad']]],
    ['Chapter 7', 'THE CLOSE', 'SPRING', 'The close. Maintain eye contact. Ask for the yes.', []],
  ];
  const MSG = 'proud of u dad. dont sell too m';
  const THREAD = [{ stamp: 'Today 11:21 PM' }, { from: 'me', text: 'wat time u home' }, { from: 'them', text: 'after midnight. go to bed. love u' }];
  const P = {
    async title(G) { await title(G); },
    async settings(G) { await title(G); await keys('ArrowDown', 'ArrowDown', 'ArrowDown', 'Enter', ...Array(+(PARAMS.get('cat') || 0)).fill('ArrowDown'), 'ArrowRight', 'ArrowDown'); },
    async chapters(G) { await title(G); await keys('ArrowDown', 'ArrowDown', 'Enter'); },
    async extras(G) { await title(G); await keys('ArrowUp', 'Enter', 'ArrowDown'); },
    async pause(G) {
      await yard(G); await G.wait(0.5); Game.setPaused(true); await ticks(8);
      if (PARAMS.get('then') === 'settings') await keys('ArrowDown', 'Enter');
      if (PARAMS.get('then') === 'quit') await keys('ArrowUp', 'Enter');
    },
    async card(G) {
      const i = U.clamp((+PARAMS.get('step') || 1) - 1, 0, 5), [t, name, season, text, vo] = CARDS[i], real = CONTENT.chapters['ch' + (i === 5 ? 7 : i + 1)];
      if (!real?.card) CONTENT.chapters.dev_card = { title: t, name, season, card: { step: i === 5 ? 6 : i + 1, text, vo: vo.map(([who, text, emote]) => ({ who, text, emote })) }, steps: [] };
      await yard(G); await G.card(real?.card ? 'ch' + (i === 5 ? 7 : i + 1) : 'dev_card');
    },
    async text(G) {
      await G.fade('black', 0);
      await G.title(['REDCLIFFE, QUEENSLAND. LAUNCH NIGHT.'], { hold: 3 });
      await G.wait(2);
      await G.title([{ text: 'THE LAST OF YES', size: 3.6 }, 'TEN YEARS LATER'], { gap: 2.5, hold: 3 });
      await G.fade('none', 1);
    },
    async subs(G) {
      await yard(G);
      await G.say('chase', 'Your grandkids’ll be in your hand, mate. Every night if you want.', { dur: 4 });
      await G.say('wai', 'Heard a rumour you’re chasing the record.', { off: true, dur: 4 });
      await G.say('newsreader', '…with the INFINITE update rolling out nationally at midnight. The network says it’s the biggest update in the country’s history, promising what developers call “a feed that finally understands you.”', { via: 'TV' });
      UI.letterbox(true); await G.wait(0.8);
      await G.say('bub', 'Did you get it? Three-twelve?', { dur: 4 });
      UI.letterbox(false);
    },
    async hud(G) {
      await yard(G);
      UI.hud({ show: true, health: 0.8, weapon: 'REVOLVER', ammo: 4, reserve: 12, throwable: { name: 'BOTTLE', n: 2 } }); await G.wait(4);
      UI.hud({ health: 0.22, listen: true }); await G.wait(4);
      UI.hud({ health: 0.6, listen: false, aim: true }); await G.wait(1); UI.hud({ hit: true }); await G.wait(1);
      UI.hud({ aim: false }); await G.wait(8);
      UI.hud({ show: false });
    },
    async phone(G) {
      await yard(G);
      UI.phone({ kind: 'lock', time: '11:44 PM' }); await G.wait(3);
      UI.phone({ kind: 'notification', time: '11:44 PM', notif: { app: 'INFINITE', text: 'INFINITE is ready. Installs at 12:00. A feed that finally understands you.' } }); await G.wait(3);
      for (let i = 1; i <= MSG.length; i++) { UI.phone({ kind: 'messages', time: '11:58 PM', title: 'Dad \u{1F3C6}', lines: THREAD, draft: MSG.slice(0, i), caret: true }); await G.wait(0.14); }
      await G.wait(1);
      UI.phone({ kind: 'messages', time: '11:59 PM', title: 'Dad \u{1F3C6}', lines: [...THREAD, { from: 'me', text: MSG, status: 'Sending…' }], caret: true }); await G.wait(3);
      UI.phone({ kind: 'off' }); await G.wait(2);
      UI.phone({ kind: 'call', time: '11:59 PM', title: 'Dad \u{1F3C6}' }); UI.prompt('e – answer'); await G.wait(3); UI.prompt(null);
      UI.phone({ kind: 'install', time: '11:59 PM', progress: 0.42 }); await G.wait(3);
      UI.phone({ kind: 'messages', time: '9:14 PM', title: 'Dad \u{1F3C6}', lines: [{ stamp: 'Today 11:59 PM' }, { from: 'me', text: MSG, status: 'Not Delivered. Tap to retry.', failed: true }], badge: 'Message not delivered', cracked: true }); await G.wait(3);
      UI.phone(null); await G.wait(0.5);
    },
    async skip(G) {
      await yard(G); UI.letterbox(true);
      G.say('luke', 'Three hundred.', { dur: 4 });
      for (let p = 0; p <= 0.65; p += 0.05) { UI.skipRing(p); await G.wait(1 / 15); }
      await G.wait(2); UI.skipRing(null); UI.letterbox(false); await G.wait(1);
    },
    async stealth(G) {
      await yard(G);
      const on = { v: true };
      G.A.update(() => { if (on.v) { UI.detect(-1.3, 0.75); UI.detect(2.5, 0.3); } });
      UI.prompt('hold q – airplane mode'); await G.wait(4);
      on.v = false; UI.prompt(null); await G.wait(0.5);
    },
    async death(G) { await yard(G); await G.wait(0.5); await UI.death('test'); await G.wait(2); },
    async end(G) { await yard(G); await G.wait(0.5); UI.endOfBuild(); },
  };
  for (const k in P) CONTENT.dev['ui_' + k] = P[k];
  CONTENT.dev.ui = async G => { for (const k of ['subs', 'hud', 'phone', 'skip', 'stealth', 'text', 'card', 'death', 'end']) await P[k](G); };
})();
