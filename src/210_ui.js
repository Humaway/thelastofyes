// ============================================================================
// UI — DOM overlay: boot, title menu, pause, settings, chapters, extras, fades, letterbox,
// subtitles, prompts, The Yes Way chapter cards (canvas), title text, HUD, phone overlay,
// skip ring, death, end of build, stealth detection arcs. Owned by: ui agent.
// Thin capitals are drawn with a built-in stroke font (SVG) so they look the same on every OS.
// Every UI animation runs on UI.update(dt) (game ticks), so dev fast-forward and screenshots agree.
//
// CONTRACT
//   UI.init() · UI.update(dt)
//   UI.loading(pct 0..1 | null)            boot screen: pulsing coiled-cord icon + percentage (null hides)
//   UI.clickToBegin() -> Promise           "Click to begin" (click or key; unlocks audio)
//   UI.titleScreen()                       logo + menu over the live TITLE area; clears every overlay; plays Audio.music('title')
//   UI.hideMenus() · UI.menuOpen() -> bool (title, pause, death or end screen owns input) · UI.pauseMenu(on)
//   UI.fade(to 'black'|'white'|'none', dur) -> Promise
//   UI.letterbox(on, dur=0.6)             2.39:1 bars
//   UI.subtitle(name|null, text, color, dur?)  bottom-centre, pages of ≤ 2 lines × 42 chars (a long line pages over dur,
//                                          default Dialogue.lineDur(text)); respects SETTINGS.subtitles/subSize/subBg/subNames
//   UI.prompt(text|null)                   small lowercase prompt, "e – talk" (gamepad: "x – talk" with a button glyph)
//   UI.card(chapterId) -> Promise          chapter opening from CONTENT.chapters[id] = {title, name, season, card}. Opens on black.
//                                          card = {step, text, vo: [{who, text, emote, …say opts}], hold=1.4}: the Yes Way page
//                                          fades up, Chloe reads "Step N. text", the vo lines play, `hold` s of silence; then
//                                          title / name / season in thin capitals. card null: just the titles. Ends on black.
//   UI.titleText(lines, {hold=3, fadeIn=1.5, fadeOut=1.5, size=2.2, gap=0}) -> Promise
//                                          centred thin widely-spaced capitals over whatever is on screen (fade to black first
//                                          for black). lines: string | {text, size}; size = cap height in vh; gap = seconds
//                                          between successive lines appearing (earlier lines stay up)
//   UI.phone(state|null)                   phone overlay, bottom right (below). Each call passes the full state.
//   UI.hud(state)                          merges {show, health 0..1, weapon, ammo, reserve, throwable: name | {name, n}, listen,
//                                          aim (centre crosshair), hit: true (one crosshair flick)}; fades out when idle
//   UI.skipRing(p 0..1 | null)
//   UI.death(cause) -> Promise             click + fade to black, RETRY auto-selected after one second; resolves ~2 s in, on black
//   UI.endOfBuild()                        "End of current build" + RETURN TO TITLE
//   UI.detect(dirRadians, amount 0..1)     stealth arc at the screen edge; dir 0 = ahead (top), +π/2 = right. UI already draws
//                                          AI.detectors ({dir, amount}, same convention) every frame; call this for anything else.
//
// Black hand-off: starting a game from a menu, UI.card and a death retry end on black. If the flow has not called
// UI.fade within 0.25 s the view fades back in over 1.2 s; a step that must stay black calls G.fade('black', 0) first.
//
// Phone state { kind: 'lock'|'notification'|'messages'|'call'|'install'|'off', time: '11:58 PM', date, title, text,
//   lines: [{from: 'me'|'them', text, status, failed} | {stamp}], draft, caret, notif: {app ('INFINITE' | 'Messages'), text,
//   badge (count on the icon)}, progress 0..1,
//   badge: 'Message not delivered', cracked }
//   lock / notification: wallpaper, clock, date; notif as a lock-screen card ('notification' slides it in)
//   messages: thread with `title` (avatar + name); `draft` in the input field; caret: true = the field is focused (blinking
//     caret, keyboard up, the last typed key pops); line.status under a bubble ('Sending…'); failed: red (!) and red status
//   call: incoming call from `title` (`text` = subtitle, default 'mobile'), accept pulses, phone buzzes
//   install: `title` (default INFINITE), `text`, progress bar, "Installing… 42%"
//   notif on messages/install shows as a banner · badge: red pill · cracked: shattered glass · off: dark glass
// ============================================================================
const UI = (() => {
  const SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif';
  const TAU = Math.PI * 2;
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  // ---- stroke font: geometric monoline capitals, cap height 100 units, y down ---------------------------
  const GL = {
    A: [62, 'M0 100L31 0L62 100M12 62H50'], B: [51, 'M0 100V0H24A23 23 0 0 1 24 46H0M24 46A27 27 0 0 1 24 100H0'],
    C: [79, 'M78.9 13.2A48 48 0 1 0 78.9 86.8'], D: [72, 'M0 0V100H22A50 50 0 0 0 22 0Z'],
    E: [50, 'M50 0H0V100H50M0 49H44'], F: [48, 'M50 0H0V100M0 49H44'],
    G: [100, 'M85.4 14.6A50 50 0 1 0 100 50H56'], H: [62, 'M0 0V100M62 0V100M0 50H62'], I: [0, 'M0 0V100'],
    J: [36, 'M36 0V78A18 22 0 0 1 0 78'], K: [56, 'M0 0V100M54 0L0 60M19 39L56 100'], L: [44, 'M0 0V100H44'],
    M: [80, 'M0 100L7 0L40 100L73 0L80 100'], N: [64, 'M0 100V0L64 100V0'],
    O: [100, 'M100 50A50 50 0 1 1 0 50A50 50 0 1 1 100 50'], P: [50, 'M0 100V0H24A26 26 0 0 1 24 52H0'],
    Q: [100, 'M100 50A50 50 0 1 1 0 50A50 50 0 1 1 100 50M62 66L98 102'], R: [56, 'M0 100V0H24A26 26 0 0 1 24 52H0M24 52L56 100'],
    S: [54, 'M50 14C45 5 37 0 27 0C13 0 3 9 3 23C3 37 14 43 27 48C41 53 54 59 54 75C54 90 42 100 27 100C13 100 3 93 0 84'],
    T: [56, 'M0 0H56M28 0V100'], U: [62, 'M0 0V69A31 31 0 0 0 62 69V0'], V: [62, 'M0 0L31 100L62 0'],
    W: [96, 'M0 0L23 100L48 0L73 100L96 0'], X: [58, 'M0 0L58 100M58 0L0 100'], Y: [60, 'M0 0L30 52L60 0M30 52V100'],
    Z: [58, 'M3 0H56L0 100H58'],
    0: [56, 'M28 0C12 0 0 22 0 50C0 78 12 100 28 100C44 100 56 78 56 50C56 22 44 0 28 0Z'], 1: [26, 'M4 18L26 0V100'],
    2: [56, 'M2 22C4 9 15 0 28 0C43 0 54 10 54 25C54 42 38 55 0 100H56'],
    3: [56, 'M4 12C9 4 18 0 28 0C42 0 52 9 52 23C52 37 41 46 24 46C44 46 56 57 56 73C56 89 44 100 28 100C16 100 6 94 0 85'],
    4: [60, 'M42 100V0L0 68H60'], 5: [56, 'M52 0H12L6 42C13 37 21 35 29 35C45 35 56 47 56 66C56 86 44 100 27 100C15 100 5 94 0 86'],
    6: [56, 'M46 0L3 60M0 71A28 28 0 1 0 56 71A28 28 0 1 0 0 71'], 7: [56, 'M0 0H56L16 100'],
    8: [56, 'M28 0A22 23 0 1 1 28 46A22 23 0 1 1 28 0M28 46A27 27 0 1 1 28 100A27 27 0 1 1 28 46'],
    9: [56, 'M0 29A28 28 0 1 0 56 29A28 28 0 1 0 0 29M53 40L10 100'],
    '.': [4, 'M2 99L2 99.1'], ',': [4, 'M3 96L0 110'], "'": [3, 'M2 0L0 16'], '’': [3, 'M2 0L0 16'], '-': [30, 'M0 58H30'],
    '–': [50, 'M0 58H50'], '—': [90, 'M0 58H90'], ':': [4, 'M2 40L2 40.1M2 99L2 99.1'], ';': [4, 'M2 40L2 40.1M3 96L0 110'], '!': [4, 'M2 0V72M2 99L2 99.1'],
    '?': [48, 'M0 22C0 9 11 0 24 0C37 0 48 9 48 22C48 38 25 42 25 62V72M25 99L25 99.1'], '/': [44, 'M44 0L0 100'],
    '<': [36, 'M36 22L0 50L36 78'], '>': [36, 'M0 22L36 50L0 78'], '×': [34, 'M0 38L34 72M34 38L0 72'],
    '…': [24, 'M2 99L2 99.1M12 99L12 99.1M22 99L22 99.1'], '"': [11, 'M2 0L0 16M10 0L8 16'], '“': [11, 'M2 0L0 16M10 0L8 16'],
    '”': [11, 'M2 0L0 16M10 0L8 16'], '%': [56, 'M50 0L6 100M0 14A11 14 0 1 0 22 14A11 14 0 1 0 0 14M34 86A11 14 0 1 0 56 86A11 14 0 1 0 34 86'],
  };
  // type(text, cap height as a CSS length, {track (× cap height), stroke px, last: class of the final glyph}) -> <svg>
  function type(text, capH, o = {}) {
    const tr = (o.track ?? 0.42) * 100, chars = [...String(text).toUpperCase()];
    let x = 0, d = '';
    chars.forEach((c, i) => {
      const g = GL[c];
      if (!g) { x += 40 + tr; return; }
      d += `<path${o.last && i === chars.length - 1 ? ` class="${o.last}"` : ''} transform="translate(${x} 0)" d="${g[1]}"/>`;
      x += g[0] + tr;
    });
    return `<svg class="ty" viewBox="-6 -12 ${Math.max(1, x - tr) + 12} 124" style="height:calc(${capH} * 1.24)" role="img" aria-label="${esc(text)}"><g fill="none" stroke="currentColor" stroke-width="${o.stroke ?? 1.2}" stroke-linecap="round" stroke-linejoin="round">${d}</g></svg>`;
  }
  const cap = (vh, min) => `max(${min}px, ${vh}vh)`;
  const T = { item: cap(1.5, 10), row: cap(1.28, 9), head: cap(2.1, 13), pre: cap(1.05, 8) };

  // ---- tweens and timers (advanced by update) --------------------------------------------------------------
  const tweens = new Map();
  let timers = [];
  function tween(key, from, to, dur, apply, ease = U.ease.inOut) {
    const old = tweens.get(key); if (old) { tweens.delete(key); old.done(); }
    return new Promise(done => {
      if (!(dur > 0)) { apply(to); done(); return; }
      apply(from); tweens.set(key, { t: 0, dur, from, to, apply, ease, done });
    });
  }
  const after = (t, f) => timers.push({ t, f });
  const setO = (el, v) => { el._o = v; el.style.opacity = v; el.style.visibility = v > 0.002 ? 'visible' : 'hidden'; };
  const fadeTo = (el, to, dur = 0.4, ease) => tween(el, el._o ?? 0, to, dur, v => setO(el, v), ease);

  // ---- CSS ---------------------------------------------------------------------------------------------------
  const CSS = `
#ui{font-family:${SANS};color:#fff;-webkit-font-smoothing:antialiased}
#ui .l{position:absolute;inset:0;pointer-events:none}
#ui .ty{display:block;overflow:visible}
#ui .ty path{vector-effect:non-scaling-stroke}
#u-black{z-index:8;background:#000}#u-white{z-index:8;background:#fff}
.u-lb{position:absolute;left:0;right:0;height:0;background:#000;z-index:5}
#u-sub{position:absolute;left:50%;bottom:7vh;transform:translateX(-50%);z-index:12;text-align:center;white-space:nowrap;line-height:1.34;font-weight:500;padding:.2em .64em .24em;border-radius:.3em;text-shadow:0 1px 2px rgba(0,0,0,.9),0 0 14px rgba(0,0,0,.55)}
#u-sub .n{font-size:.8em;font-weight:600;letter-spacing:.08em;margin-right:.5em}
#u-prompt{position:absolute;left:50%;bottom:4.4vh;transform:translateX(-50%);z-index:4;display:flex;align-items:center;gap:.55em;white-space:nowrap;font-size:${cap(1.75, 12)};letter-spacing:.08em;text-transform:lowercase;text-shadow:0 1px 3px rgba(0,0,0,.85),0 0 10px rgba(0,0,0,.4)}
.u-k{font-weight:600}.u-k.pad{display:inline-flex;align-items:center;justify-content:center;min-width:1.6em;height:1.6em;padding:0 .4em;border:1px solid rgba(255,255,255,.75);border-radius:1em;font-size:.8em;letter-spacing:0}
.u-dash{opacity:.55}
#u-skip{position:absolute;right:3.4vw;bottom:3.6vh;z-index:10;display:flex;align-items:center;gap:.8em;font-size:${cap(1.45, 11)};letter-spacing:.08em;text-transform:lowercase;text-shadow:0 1px 3px rgba(0,0,0,.8)}
#u-skip svg{width:2.3em;height:2.3em;transform:rotate(-90deg)}
#u-detect{z-index:2}
#u-title{z-index:9}
.u-tt{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4.6vh}
#u-card{z-index:9}
.u-page{position:absolute;left:50%;top:45%;height:74vh;transform:translate(-50%,-50%) rotate(-1.2deg)}
.u-page canvas{height:100%;display:block}
.u-cht{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2.6vh}
.u-cht .a,.u-cht .c{opacity:.62}
#u-menu{z-index:11}
#u-menu .shade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,0,0,.66),rgba(0,0,0,.34) 36%,rgba(0,0,0,.06) 68%,rgba(0,0,0,0))}
#u-menu:not(.root) .shade{background:linear-gradient(90deg,rgba(0,0,0,.78),rgba(0,0,0,.5) 42%,rgba(0,0,0,.28))}
#u-logo{position:absolute;left:7.5vw;top:27vh;filter:drop-shadow(0 0 1.4vh rgba(255,255,255,.22))}
.u-wrap{position:absolute;left:7.5vw;top:24vh;pointer-events:auto}
#u-menu.root .u-wrap{top:47vh}
.u-head{margin-bottom:4vh}.u-head .pre{opacity:.5;margin-bottom:1.3vh}
.u-note{margin-top:1.8vh;font-size:${cap(1.6, 12)};line-height:1.5;opacity:.6;max-width:34em}
.u-body{display:flex;align-items:flex-start;gap:5vw}
.u-col{min-width:max(19vw,190px);max-height:52vh;overflow-y:auto;scrollbar-width:none}
.u-col::-webkit-scrollbar{display:none}
.mi{position:relative;padding:1.15vh 0 1.15vh 1.7vw;cursor:pointer;opacity:.45;transition:opacity .3s}
.mi .lb{position:relative}
.mi .mk{position:absolute;left:-1.7vw;top:50%;width:0;height:1px;background:#fff;transition:width .35s}
.mi.on{opacity:1}.mi.on .mk{width:.95vw}
.mi.dim{opacity:.2}.mi.dim.on{opacity:.62}
.mi .pre{opacity:.55;margin-bottom:.8vh}.mi .sub{opacity:.45;margin-top:.8vh}
.u-panel{width:min(44vw,560px);pointer-events:auto}
.row{display:flex;align-items:center;justify-content:space-between;height:4.4vh;min-height:26px;padding:0 1vw;opacity:.5;cursor:pointer;border-bottom:1px solid rgba(255,255,255,.07);transition:opacity .25s}
.row.on{opacity:1;background:linear-gradient(90deg,rgba(255,255,255,.085),rgba(255,255,255,0))}
.u-panel.pv .row{opacity:.26}
.row .v{display:flex;align-items:center;gap:.8vw}
.row .ar{padding:.6vh .3vw;opacity:.55}
.tr{position:relative;width:max(8vw,80px);height:1px;background:rgba(255,255,255,.22)}
.tr i{position:absolute;left:0;top:0;height:1px;background:#fff}
.tr b{position:absolute;top:-.55vh;width:1px;height:1.1vh;background:#fff}
.u-desc{margin-top:2.6vh;padding:0 1vw;font-size:${cap(1.55, 11)};line-height:1.55;opacity:.58;min-height:3em}
.u-det{display:flex;flex-direction:column;align-items:flex-start;gap:1.8vh;padding-top:1vh}
.u-det .f{opacity:.55}.u-det p{margin:1.2vh 0 0;font-size:${cap(1.65, 12)};line-height:1.5;opacity:.7;font-style:italic;max-width:26em}
.u-det .cnt{display:flex;justify-content:space-between;width:min(26vw,300px);opacity:.8}
.u-hint{position:absolute;left:7.5vw;bottom:5.5vh;font-size:${cap(1.45, 11)};letter-spacing:.08em;opacity:.45;white-space:nowrap;display:flex;gap:2em;text-transform:lowercase}
#u-death,#u-end{z-index:11;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4.6vh}
.u-bar{width:max(7vw,70px);height:1px;background:rgba(255,255,255,.18);position:relative}
.u-bar i{position:absolute;left:0;top:0;bottom:0;background:#fff}
#u-end .f{opacity:.55}#u-end .mi{padding-left:0}
#u-load{z-index:13;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2.4vh}
#u-load .coil{width:max(9vw,96px);animation:u-pulse 2.6s ease-in-out infinite}
#u-load .coil .sig{stroke-dasharray:18 400;animation:u-sig 2.6s linear infinite}
#u-load .pct{opacity:.55}
#u-load .go{position:absolute;font-size:${cap(1.7, 12)};letter-spacing:.2em;opacity:0}
@keyframes u-pulse{0%,100%{opacity:.35}50%{opacity:.95}}
@keyframes u-sig{from{stroke-dashoffset:18}to{stroke-dashoffset:-400}}
#u-hud{z-index:1}
.hud{position:absolute;right:3.6vw;bottom:5vh;display:flex;flex-direction:column;align-items:flex-end;gap:1.5vh;font-size:${cap(1.6, 10)};filter:drop-shadow(0 1px 3px rgba(0,0,0,.7))}
.hud .air{display:flex;align-items:center;gap:.7em;animation:u-pulse 2.4s ease-in-out infinite}
.hud .air .pl{width:1.3em;height:1.3em;fill:#fff}
.hud .thr,.hud .wn{opacity:.72}
.hud .wpn{display:flex;flex-direction:column;align-items:flex-end;gap:.9vh}
.hud .am{display:flex;align-items:flex-end;gap:.7em}.hud .am .rs{opacity:.55;margin-bottom:.1em}
.bat{position:relative;display:flex;gap:.16em;width:3.5em;height:1.5em;padding:.18em;border:1.5px solid currentColor;border-radius:.34em;color:rgba(255,255,255,.9);margin-right:.3em}
.bat i{position:relative;flex:1;background:rgba(255,255,255,.1);border-radius:.08em;overflow:hidden}
.bat b{position:absolute;left:0;top:0;bottom:0;background:currentColor}
.bat .nub{position:absolute;right:-.42em;top:32%;height:36%;width:.24em;background:currentColor;border-radius:0 .1em .1em 0}
.bat.low{color:#ff5a4c;animation:u-pulse 1.1s ease-in-out infinite}
.cross{position:absolute;z-index:1;left:50%;top:50%;width:18px;height:18px;margin:-9px 0 0 -9px;border:1px solid rgba(255,255,255,.5);border-radius:50%;opacity:0;transition:opacity .2s,transform .12s}
.cross::after{content:'';position:absolute;left:50%;top:50%;width:2px;height:2px;margin:-1px 0 0 -1px;background:#fff;border-radius:50%}
#u-phone{position:absolute;right:10vw;bottom:-5vh;z-index:3;pointer-events:none;--h:max(72vh,300px);width:calc(var(--h) * .49);height:var(--h);font-size:calc(var(--h) / 40);perspective:160em}
.ph{position:absolute;inset:0;transform:rotateY(-11deg) rotateX(5deg) rotate(-3deg);transform-origin:50% 100%;border-radius:3em;background:linear-gradient(150deg,#34373c,#101114 22%,#060607 60%,#16171a);box-shadow:inset 0 0 0 .14em #4a4d53,inset 0 0 0 .34em #0b0b0d,0 2em 5em rgba(0,0,0,.75),0 0 7em rgba(120,150,255,.13)}
.ph.ring{animation:u-buzz 1.6s infinite}
@keyframes u-buzz{0%,24%,48%,100%{translate:0 0}4%,12%,20%{translate:.12em 0}8%,16%{translate:-.12em 0}28%,36%,44%{translate:.1em 0}32%,40%{translate:-.1em 0}}
.ph .spk{position:absolute;left:50%;top:2.3em;width:3.6em;height:.42em;margin-left:-1.8em;border-radius:.3em;background:#191a1d;box-shadow:inset 0 .06em .1em #000}
.ph .cam{position:absolute;left:calc(50% - 3.3em);top:2.25em;width:.55em;height:.55em;border-radius:50%;background:radial-gradient(circle at 35% 35%,#3b4a66,#0a0c12 60%)}
.ph .home{position:absolute;left:50%;bottom:1.35em;width:3.1em;height:3.1em;margin-left:-1.55em;border-radius:50%;border:.13em solid #2b2d31;box-shadow:inset 0 0 .3em #000}
.ph .scr{position:absolute;left:1.1em;right:1.1em;top:4.7em;bottom:4.9em;overflow:hidden;background:#000;border-radius:.2em;font-family:${SANS};color:#fff}
.ph .scr::after{content:'';position:absolute;inset:0;pointer-events:none;background:linear-gradient(118deg,rgba(255,255,255,.1),rgba(255,255,255,.02) 32%,rgba(255,255,255,0) 46%)}
.ph .sv{position:absolute;inset:0}
.ph .st{position:relative;align-self:stretch;display:flex;justify-content:space-between;align-items:center;height:1.55em;padding:0 .55em;font-size:.6em;font-weight:600;z-index:2}
.ph .st.dk{color:#111}.ph .st .c{position:absolute;left:0;right:0;text-align:center}
.ph .sig{letter-spacing:.05em}.ph .bt{display:inline-block;width:1.9em;height:.85em;border:1px solid currentColor;border-radius:.2em;padding:1px;margin-left:.3em;vertical-align:-.1em}.ph .bt i{display:block;height:100%;width:84%;background:currentColor;border-radius:.1em}
.ph .wall{position:absolute;inset:0;background:radial-gradient(60% 34% at 22% 88%,rgba(255,150,120,.55),rgba(255,150,120,0)),radial-gradient(50% 30% at 85% 70%,rgba(255,90,160,.35),rgba(255,90,160,0)),radial-gradient(8% 5% at 30% 62%,rgba(255,255,255,.18),rgba(255,255,255,0)),radial-gradient(6% 4% at 70% 48%,rgba(255,255,255,.14),rgba(255,255,255,0)),radial-gradient(10% 6% at 62% 80%,rgba(255,220,240,.16),rgba(255,220,240,0)),radial-gradient(80% 50% at 90% 10%,rgba(80,110,255,.55),rgba(80,110,255,0)),linear-gradient(172deg,#141a44,#2d2466 46%,#6a2f63 78%,#8e4a5c)}
.ph .wall.dim::after{content:'';position:absolute;inset:0;background:rgba(10,10,20,.55)}
.ph .clk{position:relative;margin-top:2.4em;text-align:center;font-size:3.9em;font-weight:200;letter-spacing:-.02em;line-height:1}
.ph .dt{position:relative;text-align:center;font-size:.85em;margin-top:.35em;opacity:.92}
.ph .nc{position:relative;margin:2.2em .5em 0;padding:.55em .65em .7em;border-radius:.75em;background:rgba(242,242,247,.8);color:#111;box-shadow:0 .3em 1em rgba(0,0,0,.25)}
.ph .sl{animation:u-sl .55s cubic-bezier(.2,.9,.25,1.1)}
@keyframes u-sl{from{transform:translateY(-3em);opacity:0}}
.ph .nh{display:flex;align-items:center;gap:.45em;font-size:.58em;letter-spacing:.06em;text-transform:uppercase;opacity:.75;margin-bottom:.4em}
.ph .nh .nt{margin-left:auto;text-transform:none;letter-spacing:0}
.ph .nb{font-size:.78em;line-height:1.3}
.ph .ic{position:relative;display:inline-flex;align-items:center;justify-content:center;width:1.6em;height:1.6em;border-radius:.4em;background:linear-gradient(135deg,#3a6bff,#8b3dff 55%,#ff4d8d)}
.ph .ic svg{width:78%;fill:none;stroke:#fff;stroke-width:2.2}
.ph .ic.ms{background:linear-gradient(#67e06a,#1fb33e)}.ph .ic.ms svg{width:70%;fill:#fff;stroke:none}
.ph .ic .bd{position:absolute;right:-.5em;top:-.5em;min-width:1.1em;height:1.1em;padding:0 .25em;border-radius:.6em;background:#ff3b30;color:#fff;font-size:.8em;font-weight:700;letter-spacing:0;display:flex;align-items:center;justify-content:center}
.ph .unl{position:absolute;left:0;right:0;bottom:1.1em;text-align:center;font-size:.62em;opacity:.75}
.ph .msg{position:absolute;inset:0;display:flex;flex-direction:column;background:#fff;color:#111}
.ph .nav{display:flex;align-items:flex-end;justify-content:center;position:relative;height:3.5em;padding-bottom:.35em;background:#f7f7f9;border-bottom:1px solid #d9d9de}
.ph .nav .bk{position:absolute;left:.45em;top:.55em;font-size:.72em;color:#1b7cf5}
.ph .who{display:flex;flex-direction:column;align-items:center;gap:.2em;font-size:.62em}
.ph .av{display:flex;align-items:center;justify-content:center;width:2.6em;height:2.6em;border-radius:50%;background:linear-gradient(#a9aeb8,#868b95);color:#fff;font-size:1.05em;font-weight:500}
.ph .th{flex:1;display:flex;flex-direction:column;justify-content:flex-end;gap:.3em;padding:.5em .5em .4em;overflow:hidden}
.ph .b{max-width:74%;padding:.38em .62em .42em;border-radius:1em;font-size:.76em;line-height:1.28;word-wrap:break-word}
.ph .b.them{align-self:flex-start;background:#e5e5ea;color:#111;border-bottom-left-radius:.3em}
.ph .b.me{align-self:flex-end;background:#1b86f9;color:#fff;border-bottom-right-radius:.3em}
.ph .bs{align-self:flex-end;font-size:.56em;color:#8e8e93;margin:-.1em .2em .2em}
.ph .bs.f{color:#ff3b30}
.ph .fw{align-self:flex-end;display:flex;align-items:center;gap:.4em;max-width:84%}
.ph .fw .b{max-width:none}
.ph .x{flex:none;display:flex;align-items:center;justify-content:center;width:1.1em;height:1.1em;border-radius:50%;background:#ff3b30;color:#fff;font-size:.7em;font-weight:700}
.ph .stp{align-self:center;font-size:.56em;color:#8e8e93;margin:.3em 0}
.ph .inp{display:flex;align-items:center;gap:.4em;padding:.35em .45em;border-top:1px solid #e0e0e4;background:#f7f7f9}
.ph .fld{flex:1;min-height:1.9em;padding:.32em .6em;border:1px solid #c8c8cd;border-radius:1em;background:#fff;font-size:.74em;line-height:1.25;color:#111;word-wrap:break-word}
.ph .fld .ph0{color:#b4b4b9}
.ph .car{display:inline-block;width:1.5px;height:1.15em;margin-left:1px;vertical-align:-.2em;background:#1b86f9;animation:u-car 1.05s steps(1) infinite}
@keyframes u-car{50%{opacity:0}}
.ph .snd{flex:none;width:1.55em;height:1.55em;border-radius:50%;background:#c7c7cc;color:#fff;display:flex;align-items:center;justify-content:center;font-size:.8em;font-weight:700}
.ph .snd.on{background:#1b86f9}
.ph .kb{background:#d1d4da;padding:.35em .12em .45em;display:flex;flex-direction:column;gap:.34em}
.ph .kr{display:flex;justify-content:center;gap:.22em;padding:0 .1em}
.ph .kr i{flex:0 0 8.6%;height:2.05em;display:flex;align-items:center;justify-content:center;border-radius:.28em;background:#fff;box-shadow:0 1px 0 #8c8f95;font-style:normal;font-size:.78em;color:#111}
.ph .kr i.w{flex:0 0 12.5%;background:#adb2bb;font-size:.62em}.ph .kr i.sp{flex:1 1 auto}.ph .kr i.rt{flex:0 0 23%;background:#adb2bb;font-size:.62em}
.ph .kr i.hit{animation:u-key .35s ease-out}
@keyframes u-key{0%{transform:translateY(-.55em) scale(1.35);box-shadow:0 .3em .6em rgba(0,0,0,.35)}100%{transform:none}}
.ph .ban{position:absolute;left:.35em;right:.35em;top:1.9em;z-index:3;padding:.5em .6em .6em;border-radius:.7em;background:rgba(28,28,32,.88);color:#fff;box-shadow:0 .4em 1em rgba(0,0,0,.35)}
.ph .ban .nh{opacity:.7}
.ph .call{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center}
.ph .cn{position:relative;margin-top:2.6em;font-size:1.55em;font-weight:300;letter-spacing:.01em}
.ph .cs{position:relative;font-size:.72em;opacity:.7;margin-top:.3em}
.ph .cb{position:absolute;left:0;right:0;bottom:2.4em;display:flex;justify-content:space-around}
.ph .cb div{display:flex;flex-direction:column;align-items:center;gap:.5em;font-size:.62em}
.ph .btn{display:flex;align-items:center;justify-content:center;width:4.8em;height:4.8em;border-radius:50%}
.ph .btn svg{width:48%;fill:#fff}
.ph .btn.dec{background:#ff3b30}.ph .btn.dec svg{transform:rotate(135deg)}
.ph .btn.acc{background:#4cd964;animation:u-acc 1.3s ease-out infinite}
@keyframes u-acc{0%{box-shadow:0 0 0 0 rgba(76,217,100,.7)}100%{box-shadow:0 0 0 1.6em rgba(76,217,100,0)}}
.ph .inst{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;background:radial-gradient(90% 55% at 50% 38%,#1a1b33,#07070c 70%)}
.ph .inst .ic{margin-top:3.6em;width:4.4em;height:4.4em;border-radius:1em;box-shadow:0 0 2.2em rgba(120,90,255,.55)}
.ph .inst .ic svg{stroke-width:1.6}
.ph .itl{margin-top:1.1em;font-size:.95em;font-weight:600;letter-spacing:.24em}
.ph .itx{margin-top:.5em;font-size:.6em;opacity:.55;padding:0 1.5em;text-align:center;line-height:1.35}
.ph .pb{margin-top:2.4em;width:70%;height:.28em;border-radius:.2em;background:rgba(255,255,255,.14);overflow:hidden}
.ph .pb i{display:block;height:100%;background:linear-gradient(90deg,#3a6bff,#b04dff)}
.ph .ipc{margin-top:.8em;font-size:.66em;opacity:.8}
.ph .bdg{position:absolute;left:50%;bottom:3em;z-index:3;transform:translateX(-50%);display:flex;align-items:center;gap:.45em;white-space:nowrap;padding:.4em .8em;border-radius:1em;background:#ff3b30;color:#fff;font-size:.66em;font-weight:600;box-shadow:0 .3em .9em rgba(255,40,30,.45)}
.ph .msg~.bdg{top:5.7em;bottom:auto}
.ph .bdg b{display:flex;align-items:center;justify-content:center;width:1.3em;height:1.3em;border-radius:50%;background:#fff;color:#ff3b30}
.ph .off{position:absolute;inset:0;background:linear-gradient(160deg,#101216,#030304)}
.ph .crk{position:absolute;inset:0;z-index:4;width:100%;height:100%}
`;

  // ---- DOM ---------------------------------------------------------------------------------------------------
  let root, black, white, lbTop, lbBot, subEl, promptEl, skipEl, skipArc, detCv, detCx, titleEl, cardEl, menuEl, logoEl, logoS,
    wrapEl, headEl, colEl, panelEl, hintEl, deathEl, endEl, loadEl, hudEl, hudBox, crossEl, phoneEl;
  const $ = s => root.querySelector(s);
  const coil = (() => {
    // a sagging coiled cord: a prolate trochoid (loops) bent along a shallow arc
    const T = 16 * Math.PI; let d = 'M0 3.5';
    for (let t = 0; t <= T + 0.01; t += 0.15) d += `L${(10 + 1.45 * t - 6 * Math.sin(t)).toFixed(1)} ${(10 - 6 * Math.cos(t) + 5 * Math.sin(Math.PI * t / T)).toFixed(1)}`;
    d += 'L93 3.5';
    return `<svg class="coil" viewBox="-2 -1 97 24"><g fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="${d}" stroke="rgba(255,255,255,.5)" stroke-width="1.1"/><path class="sig" d="${d}" stroke="#fff" stroke-width="1.6"/></g></svg>`;
  })();
  const ICON = {
    inf: '<svg viewBox="0 0 24 24"><path d="M12 12c-2.2-2.6-4-3.9-5.6-3.9a3.9 3.9 0 0 0 0 7.8c1.6 0 3.4-1.3 5.6-3.9zm0 0c2.2 2.6 4 3.9 5.6 3.9a3.9 3.9 0 0 0 0-7.8c-1.6 0-3.4 1.3-5.6 3.9z"/></svg>',
    call: '<svg viewBox="0 0 24 24"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1l-2.3 2.2z"/></svg>',
    bubble: '<svg viewBox="0 0 24 24"><path d="M12 3.5c-5.2 0-9.4 3.4-9.4 7.6 0 2.3 1.3 4.4 3.3 5.8l-.9 3.6 4-2.2c1 .3 1.9.4 3 .4 5.2 0 9.4-3.4 9.4-7.6S17.2 3.5 12 3.5z"/></svg>',
    plane: '<svg class="pl" viewBox="0 0 24 24"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/></svg>',
  };

  function init() {
    root = document.getElementById('ui');
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    root.innerHTML = `
<div id="u-hud" class="l"><div class="hud"></div></div><div class="cross"></div>
<canvas id="u-detect" class="l"></canvas>
<div id="u-phone"></div>
<div id="u-prompt"></div>
<div class="u-lb" style="top:0"></div><div class="u-lb" style="bottom:0"></div>
<div id="u-black" class="l"></div><div id="u-white" class="l"></div>
<div id="u-title" class="l"></div><div id="u-card" class="l"></div>
<div id="u-sub"></div>
<div id="u-skip"><span class="lbl"></span><svg viewBox="0 0 28 28"><circle cx="14" cy="14" r="11" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="1.5"/><circle class="arc" cx="14" cy="14" r="11" fill="none" stroke="#fff" stroke-width="1.8" stroke-dasharray="69.12" stroke-dashoffset="69.12" stroke-linecap="round"/></svg></div>
<div id="u-menu" class="l"><div class="shade"></div><div id="u-logo">${type('THE LAST OF YES', cap(4.6, 24), { track: 0.62, stroke: 1.5, last: 'dying' })}</div>
  <div class="u-wrap"><div class="u-head"></div><div class="u-body"><div class="u-col"></div><div class="u-panel"></div></div></div><div class="u-hint"></div></div>
<div id="u-death" class="l">${type('RETRY', cap(1.7, 11), { track: 0.6 })}<div class="u-bar"><i></i></div></div>
<div id="u-end" class="l"></div>
<div id="u-load" class="l">${coil}<div class="pct"></div><div class="go">Click to begin</div></div>`;
    [black, white] = [$('#u-black'), $('#u-white')];
    [lbTop, lbBot] = root.querySelectorAll('.u-lb');
    subEl = $('#u-sub'); promptEl = $('#u-prompt'); skipEl = $('#u-skip'); skipArc = $('#u-skip .arc');
    detCv = $('#u-detect'); detCx = detCv.getContext('2d');
    titleEl = $('#u-title'); cardEl = $('#u-card'); menuEl = $('#u-menu'); logoEl = $('#u-logo'); logoS = $('#u-logo .dying');
    wrapEl = $('.u-wrap'); headEl = $('.u-head'); colEl = $('.u-col'); panelEl = $('.u-panel'); hintEl = $('.u-hint');
    deathEl = $('#u-death'); endEl = $('#u-end'); loadEl = $('#u-load'); hudEl = $('#u-hud'); hudBox = $('.hud'); crossEl = $('.cross'); phoneEl = $('#u-phone');
    for (const e of [black, white, subEl, promptEl, skipEl, menuEl, deathEl, endEl, hudEl, phoneEl]) setO(e, 0);
    setO(loadEl, 1);
    menuEvents();
    // pointer lock belongs to gameplay: losing it mid-play pauses; clicking the view while playing takes it back
    document.addEventListener('pointerlockchange', () => {
      if (!document.pointerLockElement && Game.state === 'play' && !Game.paused && !mode) Game.setPaused(true);
    });
    Engine.renderer.domElement.addEventListener('mousedown', () => {
      if (Game.state === 'play' && !Game.paused && !mode && Play.enabled && !Input.locked) Input.lock();
    });
  }

  // ---- fades, letterbox ----------------------------------------------------------------------------------------
  let fadeState = 'none', fadeSerial = 0;
  function fade(to, dur = 1) {
    fadeState = to; fadeSerial++;
    return Promise.all([fadeTo(black, to === 'black' ? 1 : 0, dur, U.ease.linear), fadeTo(white, to === 'white' ? 1 : 0, dur, U.ease.linear)]).then(() => {});
  }
  // after a hand-off on black: reveal unless the flow takes over the fade within 0.25 s
  function autoReveal() { const s = fadeSerial; after(0.25, () => { if (s === fadeSerial && fadeState !== 'none') fade('none', 1.2); }); }
  const lb = { v: 0 };
  function letterbox(on, dur = 0.6) { tween('lb', lb.v, on ? 1 : 0, dur, v => { lb.v = v; }); }

  // ---- subtitles --------------------------------------------------------------------------------------------
  let sub = null, subSample = false;
  const SUB_SIZE = { S: cap(2.3, 13), M: cap(2.85, 15), L: cap(3.45, 18), XL: cap(4.2, 21) };
  const SAMPLE = { name: 'CHLOE', text: 'Open question. Why is everyone trying to kill us?', color: '#FFD400' };
  // pages of ≤ 2 balanced lines of ≤ 42 chars (the speaker label counts on each page's first line), evened out across pages
  function paginate(text, off) {
    const words = String(text).split(/\s+/).filter(Boolean);
    const split = ws => {
      const all = ws.join(' ');
      if (all.length + off <= 42 || ws.length === 1) return [all];
      let best = null, bd = Infinity;
      for (let k = 1; k < ws.length; k++) {
        const a = ws.slice(0, k).join(' '), b = ws.slice(k).join(' '), d = Math.abs(a.length + off - b.length);
        if (a.length + off <= 42 && b.length <= 42 && d < bd) { bd = d; best = [a, b]; }
      }
      return best;
    };
    const fill = limit => {
      const pages = []; let cur = [];
      for (const w of words) {
        const c = [...cur, w];
        if (cur.length && (!split(c) || c.join(' ').length > limit)) { pages.push(cur); cur = [w]; } else cur = c;
        if (limit < Infinity && /[.!?]$/.test(w) && cur.join(' ').length > limit * 0.6) { pages.push(cur); cur = []; }
      }
      if (cur.length) pages.push(cur);
      return pages;
    };
    let pages = fill(Infinity);
    if (pages.length > 1) { const even = fill(Math.ceil(words.join(' ').length / pages.length) + 6); if (even.length === pages.length) pages = even; }
    return pages.map(split);
  }
  function subtitle(name, text, color, dur) {
    sub = name || text ? { name, text: text || '', color, total: dur || Dialogue.lineDur(text || ''), t: 0, i: 0 } : null;
    layoutSub(sub); renderSub();
  }
  function layoutSub(s) {
    if (!s) return;
    s.pages = paginate(s.text, SETTINGS.subNames && s.name ? Math.round(s.name.length * 0.8) + 2 : 0);
    const lens = s.pages.map(p => p.join(' ').length), sum = lens.reduce((a, b) => a + b, 0) || 1;
    let acc = 0; s.ends = lens.map(l => (acc += l) / sum * (s.total || 1));
    s.i = Math.min(s.i || 0, s.pages.length - 1);
  }
  function renderSub() {
    const s = subSample ? SAMPLE : sub;
    if (!s || !SETTINGS.subtitles || !s.pages.length) { setO(subEl, 0); return; }
    const label = SETTINGS.subNames && s.name ? `<span class="n" style="color:${s.color || '#B0A8A0'}">${esc(s.name)}${s.name[0] === '[' ? '' : ':'}</span>` : '';
    subEl.innerHTML = label + s.pages[s.i].map(esc).join('<br>');
    subEl.style.fontSize = SUB_SIZE[SETTINGS.subSize] || SUB_SIZE.M;
    subEl.style.background = `rgba(0,0,0,${SETTINGS.subBg})`;
    setO(subEl, 1);
  }
  function setSample(on) { if (on === subSample) return; subSample = on; if (on) layoutSub(SAMPLE); renderSub(); }
  function restyleSub() { layoutSub(sub); if (subSample) layoutSub(SAMPLE); renderSub(); }

  // ---- prompts ------------------------------------------------------------------------------------------------
  let promptText = null, lastDevice = 'kbm';
  const PAD = { e: 'x', q: 'r1', space: 'a', f: 'y', r: 'x', g: 'r1', c: 'b', t: 'l3 + r3', tab: 'back', esc: 'start', shift: 'l3', enter: 'a' };
  function keyLabel(k) { const pad = Input.device === 'pad'; return `<span class="u-k${pad ? ' pad' : ''}">${esc(pad ? PAD[k] || k : k)}</span>`; }
  function promptHTML(t) {
    const m = /^(hold\s+)?(\S+)\s+[–—-]\s+(.+)$/i.exec(t);
    return m ? `${m[1] ? 'hold ' : ''}${keyLabel(m[2].toLowerCase())}<span class="u-dash">–</span><span>${esc(m[3])}</span>` : esc(t);
  }
  function prompt(t) {
    if ((t || null) === promptText) return;
    promptText = t || null;
    if (promptText) { promptEl.innerHTML = promptHTML(promptText); fadeTo(promptEl, 0.92, 0.2); } else fadeTo(promptEl, 0, 0.25);
  }

  // ---- skip ring, detection arcs --------------------------------------------------------------------------------
  let skipOn = false;
  const skipLabel = () => { skipEl.querySelector('.lbl').innerHTML = `${keyLabel('space')} <span class="u-dash">–</span> skip`; };
  function skipRing(p) {
    if (p == null) { if (skipOn) { skipOn = false; fadeTo(skipEl, 0, 0.3); } return; }
    if (!skipOn) { skipOn = true; skipLabel(); fadeTo(skipEl, 1, 0.2); }
    skipArc.setAttribute('stroke-dashoffset', (69.12 * (1 - U.clamp(p))).toFixed(2));
  }
  let arcsIn = [], arcs = [], arcsDrawn = false;
  function detect(dir, amount) { if (amount > 0.001) arcsIn.push({ dir, amount: U.clamp(amount) }); }
  function drawDetect() {
    if (!arcs.length && !arcsDrawn) return;
    const w = innerWidth, h = innerHeight, x = detCx;
    if (detCv.width !== w || detCv.height !== h) { detCv.width = w; detCv.height = h; }
    x.clearRect(0, 0, w, h);
    arcsDrawn = arcs.length > 0;
    const m = Math.min(w, h) * 0.035, rx = w / 2 - m, ry = h / 2 - m;
    x.shadowColor = 'rgba(255,255,255,.8)'; x.shadowBlur = 10; x.lineCap = 'round';
    for (const a of arcs) {
      const c = a.dir - Math.PI / 2, N = 24;
      x.lineWidth = 1.5 + a.amount * 2.5;
      for (let i = 0; i < N; i++) {
        const t0 = -1 + 2 * i / N, t1 = t0 + 2 / N, f = Math.cos((t0 + t1) * Math.PI / 4) ** 2;
        x.beginPath(); x.ellipse(w / 2, h / 2, rx, ry, 0, c + t0 * 0.5, c + t1 * 0.5);
        x.strokeStyle = `rgba(255,255,255,${(a.amount * f * 0.9).toFixed(3)})`; x.stroke();
      }
    }
  }

  // ---- HUD ------------------------------------------------------------------------------------------------------
  const hs = { show: false, health: 1, weapon: null, ammo: null, reserve: null, throwable: null, listen: false, aim: false };
  let hudWake = 0, hudO = 0, flick = 0;
  function hud(s) {
    if (s.hit) flick = 0.16;
    let ch = false;
    for (const k in s) if (k !== 'hit' && JSON.stringify(hs[k]) !== JSON.stringify(s[k])) { hs[k] = s[k]; ch = true; }
    if (!ch) return;
    hudWake = 4;
    const segs = [0, 1, 2, 3].map(i => `<i><b style="width:${(U.clamp(hs.health * 4 - i) * 100).toFixed(1)}%"></b></i>`).join('');
    const th = hs.throwable && (typeof hs.throwable === 'string' ? hs.throwable : hs.throwable.name + (hs.throwable.n > 1 ? ' × ' + hs.throwable.n : ''));
    const small = s => type(s, cap(1.05, 8), { track: 0.4 });
    hudBox.innerHTML = (hs.listen ? `<div class="air">${ICON.plane}${type('AIRPLANE MODE', cap(1.2, 9), { track: 0.4 })}</div>` : '') +
      (th ? `<div class="thr">${small(th)}</div>` : '') +
      (hs.weapon ? `<div class="wpn"><div class="wn">${small(hs.weapon)}</div>` + (hs.ammo != null ? `<div class="am">${type(String(hs.ammo), cap(2.8, 17), { track: 0.25, stroke: 1.4 })}` +
        (hs.reserve != null ? `<span class="rs">${type('/ ' + hs.reserve, cap(1.25, 9), { track: 0.3 })}</span>` : '') + '</div>' : '') + '</div>' : '') +
      `<div class="bat${hs.health <= 0.26 ? ' low' : ''}">${segs}<span class="nub"></span></div>`;
  }

  // ---- phone overlay ----------------------------------------------------------------------------------------------
  let phoneState = null;
  const phoneV = { v: 0 };
  const KB = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
  const CRACK = (() => {
    const r = U.rng(99), cx = 64, cy = 72; let d = '';
    for (let i = 0; i < 11; i++) {
      let a = i / 11 * TAU + r() * 0.4, x = cx, y = cy;
      d += `M${cx} ${cy}`;
      for (let k = 0; k < 4; k++) { const l = 6 + r() * 18; a += (r() - 0.5) * 0.6; x += Math.cos(a) * l; y += Math.sin(a) * l; d += `L${x.toFixed(1)} ${y.toFixed(1)}`; }
    }
    for (const rr of [5, 11]) d += `M${cx + rr} ${cy}A${rr} ${rr * 0.9} 0 1 1 ${cx + rr - 0.1} ${cy - 1.5}`;
    return `<svg class="crk" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="${d}" fill="none" stroke="rgba(255,255,255,.6)" stroke-width=".35"/><path d="${d}" fill="none" stroke="rgba(0,0,0,.35)" stroke-width=".2" transform="translate(.3 .3)"/></svg>`;
  })();
  function phone(s) {
    const prev = phoneState; phoneState = s || null;
    if (!s) { if (prev) tween('phone', phoneV.v, 0, 0.35, placePhone, U.ease.in); return; }
    const newNotif = s.notif && JSON.stringify(prev?.notif) !== JSON.stringify(s.notif);
    const bar = dark => `<div class="st${dark ? ' dk' : ''}"><span class="sig">●●●●○ YES 4G</span><span class="c">${esc(s.time)}</span><span>84%<span class="bt"><i></i></span></span></div>`;
    const notif = cls => s.notif ? `<div class="${cls}${newNotif && (cls === 'ban' || s.kind === 'notification') ? ' sl' : ''}"><div class="nh"><span class="ic${s.notif.app === 'Messages' ? ' ms' : ''}">${s.notif.app === 'Messages' ? ICON.bubble : ICON.inf}${s.notif.badge ? `<span class="bd">${esc(s.notif.badge)}</span>` : ''}</span>` +
      `<span>${esc(s.notif.app || 'INFINITE')}</span><span class="nt">now</span></div><div class="nb">${esc(s.notif.text)}</div></div>` : '';
    let html;
    if (s.kind === 'lock' || s.kind === 'notification') {
      html = `<div class="wall"></div>${bar()}<div class="clk">${esc((s.time || '').replace(/\s*[AP]M$/i, ''))}</div><div class="dt">${esc(s.date || 'Friday, 16 September')}</div>${notif('nc')}<div class="unl">Press home to open</div>`;
    } else if (s.kind === 'messages') {
      const lines = (s.lines || []).map(l => l.stamp ? `<div class="stp">${esc(l.stamp)}</div>` :
        (l.failed ? `<div class="fw"><div class="b me">${esc(l.text)}</div><span class="x">!</span></div>` : `<div class="b ${l.from === 'me' ? 'me' : 'them'}">${esc(l.text)}</div>`) +
        (l.status ? `<div class="bs${l.failed ? ' f' : ''}">${esc(l.status)}</div>` : '')).join('');
      const draft = s.draft || '', typed = prev?.kind === 'messages' && draft.length > (prev.draft || '').length ? draft.slice(-1).toLowerCase() : null;
      const key = k => `<i${typed === k ? ' class="hit"' : ''}>${k}</i>`, row = k => `<div class="kr">${k}</div>`;
      html = `<div class="msg">${bar(true)}<div class="nav"><span class="bk">‹ Messages</span><div class="who"><span class="av">${esc([...(s.title || '?')][0].toUpperCase())}</span><span>${esc(s.title)} ›</span></div></div>` +
        `<div class="th">${lines}</div><div class="inp"><div class="fld">${draft ? esc(draft) : s.caret ? '' : '<span class="ph0">iMessage</span>'}${s.caret ? '<i class="car"></i>' : ''}</div><span class="snd${draft ? ' on' : ''}">↑</span></div>` +
        (s.caret ? `<div class="kb">${row([...KB[0]].map(key).join(''))}${row([...KB[1]].map(key).join(''))}${row(`<i class="w">⇧</i>${[...KB[2]].map(key).join('')}<i class="w">⌫</i>`)}` +
        `${row(`<i class="w">123</i><i class="w">☺</i><i class="sp${typed === ' ' ? ' hit' : ''}">space</i><i class="rt">return</i>`)}</div>` : '') + `</div>${notif('ban')}`;
    } else if (s.kind === 'call') {
      html = `<div class="wall dim"></div>${bar()}<div class="call"><div class="cn">${esc(s.title)}</div><div class="cs">${esc(s.text || 'mobile')}</div>` +
        `<div class="cb"><div><span class="btn dec">${ICON.call}</span>Decline</div><div><span class="btn acc">${ICON.call}</span>Accept</div></div></div>`;
    } else if (s.kind === 'install') {
      const p = U.clamp(s.progress ?? 0);
      html = `<div class="inst">${bar()}<span class="ic">${ICON.inf}</span><div class="itl">${esc(s.title || 'INFINITE')}</div>${s.text ? `<div class="itx">${esc(s.text)}</div>` : ''}` +
        `<div class="pb"><i style="width:${(p * 100).toFixed(1)}%"></i></div><div class="ipc">${p >= 1 ? 'Installed' : `Installing… ${Math.floor(p * 100)}%`}</div></div>${notif('ban')}`;
    } else html = '<div class="off"></div>';
    if (s.badge) html += `<div class="bdg"><b>!</b>${esc(s.badge)}</div>`;
    if (s.cracked) html += CRACK;
    phoneEl.innerHTML = `<div class="ph${s.kind === 'call' ? ' ring' : ''}"><i class="spk"></i><i class="cam"></i><div class="scr"><div class="sv">${html}</div></div><i class="home"></i></div>`;
    if (prev?.kind !== s.kind) { const sv = phoneEl.querySelector('.sv'); setO(sv, 0); fadeTo(sv, 1, 0.3); }
    if (!prev) tween('phone', phoneV.v, 1, 0.5, placePhone, U.ease.out);
  }
  function placePhone(v) { phoneV.v = v; setO(phoneEl, U.clamp(v * 2)); phoneEl.style.transform = `translateY(${((1 - v) * 55).toFixed(2)}%)`; }

  // ---- menus -----------------------------------------------------------------------------------------------------------
  // screen: { title, pre, note, items: [{label, pre, sub, act, rows, detail, sample}], focus, rows: true (a settings category) }
  let mode = null, stack = [], navCool = 0, busy = false, panelKey = null, dragRow = null, session = 0;
  const sy = { t: 0, on: false }, sx = { t: 0, on: false };
  const top = () => stack[stack.length - 1];
  const listScreen = () => top().rows ? stack[stack.length - 2] : top();
  const pluck = i => Audio.sfx('pluck', { rate: Math.pow(2, [0, 5, 7, 8, 7, 5, 3, 0][i % 8] / 12), vol: 0.6 });
  const tog = (k, label, apply) => ({ label, kind: 'toggle', get: () => SETTINGS[k], set: v => { SETTINGS[k] = v; if (apply) apply(); } });
  const vol = (k, label) => ({ label, kind: 'slider', min: 0, max: 1, step: 0.05, fmt: v => String(Math.round(v * 100)), get: () => SETTINGS.vol[k], set: v => { SETTINGS.vol[k] = v; Audio.setVolumes(); Audio.sfx('pluck', { vol: 0.5 }); } });
  const regrade = () => Engine.applyGrade();
  const DIFF = { story: 'Double supplies, half damage from enemies, aim assist on.', normal: 'Supplies are scarce. Make every round count.', hard: 'Half the supplies. Clickers hear better.' };
  const settingsScreen = () => ({ title: 'SETTINGS', items: [
    { label: 'SUBTITLES', sample: true, rows: [
      tog('subtitles', 'SUBTITLES', restyleSub),
      { label: 'SIZE', kind: 'choice', opts: [['S', 'SMALL'], ['M', 'MEDIUM'], ['L', 'LARGE'], ['XL', 'EXTRA LARGE']], get: () => SETTINGS.subSize, set: v => { SETTINGS.subSize = v; restyleSub(); } },
      { label: 'BACKGROUND', kind: 'slider', min: 0, max: 1, step: 0.05, fmt: v => Math.round(v * 100) + '%', get: () => SETTINGS.subBg, set: v => { SETTINGS.subBg = v; restyleSub(); } },
      tog('subNames', 'SPEAKER NAMES', restyleSub),
    ] },
    { label: 'GAMEPLAY', rows: [
      { label: 'DIFFICULTY', kind: 'choice', opts: [['story', 'STORY'], ['normal', 'NORMAL'], ['hard', 'HARD']], get: () => SETTINGS.difficulty, set: v => { SETTINGS.difficulty = v; }, desc: v => DIFF[v] },
      tog('aimAssist', 'AIM ASSIST'),
    ] },
    { label: 'CONTROLS', rows: [
      { label: 'SENSITIVITY', kind: 'slider', min: 0.2, max: 3, step: 0.1, fmt: v => v.toFixed(1), get: () => SETTINGS.sens, set: v => { SETTINGS.sens = v; } },
      tog('invertY', 'INVERT Y'),
    ] },
    { label: 'DISPLAY', rows: [
      { label: 'FIELD OF VIEW', kind: 'slider', min: 60, max: 90, step: 1, fmt: v => String(Math.round(v)), get: () => SETTINGS.fov, set: v => { SETTINGS.fov = v; } },
      { label: 'QUALITY', kind: 'choice', opts: [['low', 'LOW'], ['medium', 'MEDIUM'], ['high', 'HIGH']], get: () => SETTINGS.quality, set: v => { SETTINGS.quality = v; Engine.setQuality(v); } },
      tog('shake', 'CAMERA SHAKE'), tog('grain', 'FILM GRAIN', regrade), tog('motion', 'MOTION EFFECTS', regrade),
    ] },
    { label: 'AUDIO', rows: [
      vol('master', 'MASTER'), vol('music', 'MUSIC'), vol('sfx', 'EFFECTS'), vol('dialogue', 'DIALOGUE'), vol('amb', 'AMBIENCE'),
      { ...tog('voice', 'VOICED LINES'), desc: () => 'Lines are spoken aloud by your system’s speech synthesis.' },
    ] },
  ] });
  const chapterList = () => CONTENT.chapterOrder.filter(id => CONTENT.chapters[id] && Save.data.chapters.includes(id));
  const chapterDetail = id => {
    const c = CONTENT.chapters[id];
    return `<div class="u-det"><div class="f">${type(c.title, T.pre, { track: 0.5 })}</div>${type(c.name, cap(2.3, 14), { track: 0.5 })}` +
      (c.season ? `<div class="f">${type(c.season, T.pre, { track: 0.5 })}</div>` : '') + (c.card ? `<p>Step ${c.card.step}. ${esc(c.card.text)}</p>` : '') + '</div>';
  };
  function titleItems() {
    const cc = CONTENT.chapters[Save.data.checkpoint?.chapter];
    return [
      Save.hasContinue() && { label: 'CONTINUE', act: () => begin(() => Game.continueGame()), sub: cc && `${cc.title} — ${cc.name}` },
      { label: 'NEW GAME', act: () => Save.hasContinue() ? confirm('START A NEW GAME?', 'Your saved progress will be replaced.', 'START NEW GAME', () => begin(() => Game.newGame())) : begin(() => Game.newGame()) },
      chapterList().length && { label: 'CHAPTERS', act: () => push({ title: 'CHAPTERS', items: chapterList().map(id => ({ pre: CONTENT.chapters[id].title, label: CONTENT.chapters[id].name, detail: chapterDetail(id), act: () => begin(() => Game.startChapter(id)) })) }) },
      { label: 'SETTINGS', act: () => push(settingsScreen()) },
      Save.data.finished && { label: 'EXTRAS', act: () => push({ title: 'EXTRAS', items: extrasItems() }) },
    ].filter(Boolean);
  }
  function extrasItems() {
    const seen = Object.keys(CONTENT.scenes).filter(id => Save.seen(id));
    const count = ([k, label]) => `<div class="cnt">${type(label, T.row)}${type(`${Save.data.collectibles[k].length} / ${CONTENT.collectibles[k].length}`, T.row, { track: 0.3 })}</div>`;
    return [
      seen.length && { label: 'CUTSCENE THEATRE', act: () => push({ title: 'CUTSCENE THEATRE', items: seen.map(id => ({ pre: id, label: CONTENT.scenes[id].title || id, act: () => theatre(id) })) }) },
      { label: 'COLLECTIBLES', detail: `<div class="u-det">${[['artifacts', 'ARTIFACTS'], ['lanyards', 'LOST LANYARDS'], ['modules', 'TRAINING MODULES']].map(count).join('')}</div>` },
    ].filter(Boolean);
  }
  const pauseItems = () => [
    { label: 'RESUME', act: () => Game.setPaused(false) },
    { label: 'SETTINGS', act: () => push(settingsScreen()) },
    { label: 'RESTART CHECKPOINT', act: () => confirm('RESTART CHECKPOINT?', 'Progress since the last checkpoint will be lost.', 'RESTART', () => leave(() => { Game.setPaused(false); Game.retry(); })) },
    { label: 'QUIT TO MENU', act: () => confirm('QUIT TO MENU?', 'Progress since the last checkpoint will be lost.', 'QUIT', () => leave(() => Game.quitToTitle())) },
  ];
  const confirm = (title, note, ok, fn) => push({ title, note, focus: 1, items: [{ label: ok, act: fn }, { label: 'CANCEL', act: back }] });

  function open(m, first) {
    mode = m; stack = []; busy = false;
    menuEl.className = 'l ' + m;
    setO(wrapEl, 1);
    fadeTo(menuEl, 1, m === 'pause' ? 0.25 : 1.2);
    push(first);
    navCool = m === 'pause' ? 0.15 : 2.6;
  }
  function closeMenus() { if (mode === 'title' || mode === 'pause') mode = null; stack = []; setSample(false); fadeTo(menuEl, 0, 0.3); }
  function push(s) { s.focus = s.focus ?? 0; stack.push(s); build(); }
  function back() { if (stack.length > 1) { stack.pop(); build(); pluck(0); } else if (mode === 'pause') Game.setPaused(false); }
  // fade to black, close the menus, run fn (it starts a flow), then hand off on black
  async function begin(fn) {
    if (busy) return; busy = true; Audio.stopMusic(2);
    fadeTo(menuEl, 0, 0.8);
    await fade('black', 1.2);
    closeMenus(); busy = false; fn(); autoReveal();
  }
  async function leave(fn) {
    if (busy) return; busy = true;
    fadeTo(menuEl, 0, 0.3);
    await fade('black', 0.6);
    closeMenus(); busy = false; fn(); autoReveal();
  }
  async function theatre(id) {
    const s = CONTENT.scenes[id], my = ++session;
    await begin(() => {});
    try { if (s.area) await Game.loadArea(s.area); Game.state = 'play'; await Director.play(id); } catch (e) { if (e !== Game.ABORT) console.error(e); }
    if (my !== session) return;
    await fade('black', 1);
    if (my === session) Game.titleScreen();
  }

  function build() {
    const L = listScreen(), m = mode, root1 = stack.length === 1, ch = m === 'pause' && root1 && CONTENT.chapters[Game.chapter];
    logoEl.style.display = m === 'title' && root1 ? '' : 'none';
    menuEl.classList.toggle('root', m === 'title' && root1);
    const pre = L.pre || ch?.title, title = L.title || ch?.name;
    headEl.innerHTML = (pre ? `<div class="pre">${type(pre, T.pre, { track: 0.5 })}</div>` : '') + (title ? type(title, T.head, { track: 0.5, stroke: 1.3 }) : '') +
      (L.note ? `<div class="u-note">${esc(L.note)}</div>` : '');
    headEl.style.display = pre || title ? '' : 'none';
    colEl.innerHTML = L.items.map((it, i) => `<div class="mi" data-i="${i}">${it.pre ? `<div class="pre">${type(it.pre, T.pre, { track: 0.5 })}</div>` : ''}<div class="lb"><span class="mk"></span>${type(it.label, T.item, { track: 0.4 })}</div>${it.sub ? `<div class="sub">${type(it.sub, T.pre, { track: 0.5 })}</div>` : ''}</div>`).join('');
    panelKey = null;
    const body = colEl.parentNode;
    tween('screen', 0, 1, 0.35, v => { for (const e of [headEl, body]) { e.style.opacity = v; e.style.transform = `translateX(${((1 - v) * -0.6).toFixed(3)}vw)`; } }, U.ease.out);
    refresh(); hints();
  }
  function refresh() {
    const t = top(), L = listScreen(), f = L.items[L.focus];
    colEl.querySelectorAll('.mi').forEach((e, i) => { e.classList.toggle('on', i === L.focus); e.classList.toggle('dim', !!t.rows); });
    colEl.querySelector('.mi.on')?.scrollIntoView({ block: 'nearest' });
    const rows = t.rows ? t : f?.rows ? { items: f.rows, focus: -1 } : null;
    const key = rows ? f.label + (t.rows ? ':on' : ':pv') : f?.detail ? 'd' + L.focus : '';
    if (key !== panelKey) {
      panelKey = key;
      panelEl.className = 'u-panel' + (rows && !t.rows ? ' pv' : '');
      panelEl.innerHTML = rows ? rows.items.map((r, i) => `<div class="row" data-r="${i}">${type(r.label, T.row, { track: 0.4 })}<div class="v"></div></div>`).join('') + '<div class="u-desc"></div>' : f?.detail || '';
    }
    if (rows) {
      panelEl.querySelectorAll('.row').forEach((e, i) => { e.classList.toggle('on', i === rows.focus); e.querySelector('.v').innerHTML = rowValue(rows.items[i]); });
      const r = rows.items[rows.focus];
      panelEl.querySelector('.u-desc').textContent = r?.desc ? r.desc(r.get()) : '';
    }
    setSample(!!f?.sample);
  }
  function rowValue(r) {
    const v = r.get();
    if (r.kind === 'toggle') return type(v ? 'ON' : 'OFF', T.row, { track: 0.4 });
    if (r.kind === 'choice') return `<span class="ar" data-d="-1">${type('<', T.row)}</span>${type(r.opts.find(o => o[0] === v)?.[1] ?? v, T.row, { track: 0.4 })}<span class="ar" data-d="1">${type('>', T.row)}</span>`;
    const p = (v - r.min) / (r.max - r.min) * 100;
    return `<span class="tr"><i style="width:${p}%"></i><b style="left:${p}%"></b></span><span style="min-width:3.2em;display:flex;justify-content:flex-end">${type(r.fmt(v), T.row, { track: 0.3 })}</span>`;
  }
  function hints() {
    const pad = Input.device === 'pad', k = (kb, pd, what) => `<span>${keyLabel(pad ? pd : kb)} <span class="u-dash">–</span> ${what}</span>`;
    hintEl.innerHTML = mode === 'title' && stack.length === 1 ? '' : (top().rows ? k('← →', 'd-pad', 'change') : k('enter', 'a', 'select')) + k('esc', 'b', 'back');
  }
  function move(d) {
    const s = top(), n = s.items.length, i = (s.focus + d + n) % n;
    if (i !== s.focus) { s.focus = i; refresh(); pluck(i); }
  }
  function adjust(r, d, abs) {
    const v = r.get();
    if (r.kind === 'toggle') r.set(!v);
    else if (r.kind === 'choice') { const n = r.opts.length, i = r.opts.findIndex(o => o[0] === v); r.set(r.opts[(i + d + n) % n][0]); }
    else {
      const nv = U.clamp(Math.round(((abs ?? v + d * r.step) - r.min) / r.step) * r.step + r.min, r.min, r.max);
      if (Math.abs(nv - v) < 1e-6) return;
      r.set(+nv.toFixed(3));
    }
    Save.saveSettings(); refresh();
    if (r.kind !== 'slider') Audio.sfx('ui_select', { vol: 0.6 });
  }
  function activate() {
    const s = top(), it = s.items[s.focus];
    if (s.rows) { adjust(it, 1); return; }
    if (!it.act && !it.rows) return;
    Audio.sfx('ui_select');
    if (it.rows) push({ rows: true, items: it.rows, focus: 0 }); else it.act();
  }
  function nav(dt) {
    const rep = (v, s) => {
      if (Input.device !== 'pad' || Math.abs(v) < 0.6) { s.t = 0; s.on = false; return 0; }
      if ((s.t -= dt) > 0) return 0;
      s.t = s.on ? 0.14 : 0.4; s.on = true; return Math.sign(v);
    };
    const d = (Input.pressed('menuDown') ? 1 : Input.pressed('menuUp') ? -1 : 0) || -rep(Input.move.y, sy);
    const h = (Input.pressed('menuRight') ? 1 : Input.pressed('menuLeft') ? -1 : 0) || rep(Input.move.x, sx);
    if (d) move(d);
    const t = top();
    if (h) { if (t.rows) adjust(t.items[t.focus], h); else if (h > 0 && t.items[t.focus].rows) activate(); }
    if (Input.pressed('confirm')) activate();
    else if (Input.pressed('back')) back();
    else if (mode === 'pause' && Input.pressed('pause')) Game.setPaused(false);
  }
  function menuEvents() {
    const hit = e => {
      const r = e.target.closest('[data-r]'), m = e.target.closest('.mi[data-i]');
      return r ? { row: +r.dataset.r } : m && colEl.contains(m) ? { item: +m.dataset.i } : null;
    };
    const ready = () => stack.length && !busy && navCool <= 0 && (mode === 'title' || mode === 'pause');
    menuEl.addEventListener('mousemove', e => {
      const h = hit(e); if (!h || !ready()) return;
      const t = top();
      if (h.item != null) {
        if (t.rows) { stack.pop(); build(); }
        if (top().focus !== h.item) { top().focus = h.item; refresh(); pluck(h.item); }
      } else if (!t.rows) { if (t.items[t.focus].rows) push({ rows: true, items: t.items[t.focus].rows, focus: h.row }); }
      else if (t.focus !== h.row) { t.focus = h.row; refresh(); pluck(h.row); }
    });
    menuEl.addEventListener('mousedown', e => {
      const h = e.button === 0 && hit(e); if (!h || !ready()) return;
      if (h.item != null) { top().focus = h.item; activate(); return; }
      const t = top(); if (!t.rows) return;
      const r = t.items[h.row], a = e.target.closest('[data-d]');
      if (r.kind === 'slider') { dragRow = h.row; drag(e); } else adjust(r, a ? +a.dataset.d : 1);
    });
    const drag = e => {
      const tr = dragRow != null && panelEl.querySelector(`[data-r="${dragRow}"] .tr`), t = top(); if (!tr || !t?.rows) return;
      const b = tr.getBoundingClientRect(), r = t.items[dragRow];
      adjust(r, 0, r.min + U.clamp((e.clientX - b.left) / b.width) * (r.max - r.min));
    };
    addEventListener('mousemove', drag);
    addEventListener('mouseup', () => { dragRow = null; });
  }

  function titleScreen() {
    session++;
    clearOverlays();
    Input.unlock(); Engine.uniforms.uDesat.value = 0; Audio.pause(false);
    Audio.music('title', { fade: 1 });
    fade('none', 2.5);
    open('title', { items: titleItems() });
    setO(logoEl, 0); setO(wrapEl, 0);
    after(0.6, () => fadeTo(logoEl, 1, 2.6));
    after(1.8, () => fadeTo(wrapEl, 1, 1.4));
  }
  function pauseMenu(on) {
    if (on) { if (!mode) open('pause', { items: pauseItems() }); } else if (mode === 'pause') closeMenus();
  }
  function clearOverlays() {
    subtitle(null); prompt(null); phone(null); skipRing(null); hud({ show: false }); letterbox(false, 0);
    titleEl.innerHTML = ''; cardEl.innerHTML = ''; cardPush = null; arcs = []; arcsIn = [];
    setO(deathEl, 0); setO(endEl, 0);
  }

  // ---- title text and chapter cards ---------------------------------------------------------------------------
  async function titleText(lines, o = {}) {
    const fi = o.fadeIn ?? 1.5, fo = o.fadeOut ?? 1.5, W = s => Game.G.wait(s);
    const box = document.createElement('div'); box.className = 'u-tt'; titleEl.appendChild(box);
    const els = lines.map(l => {
      const L = typeof l === 'string' ? { text: l } : l, size = L.size ?? o.size ?? 2.2, e = document.createElement('div');
      e.innerHTML = type(L.text, cap(size, Math.round(size * 5.5)), { track: 0.55, stroke: U.clamp(size * 0.42, 1, 2) });
      box.appendChild(e); setO(e, 0); return e;
    });
    try {
      for (let i = 0; i < els.length; i++) { fadeTo(els[i], 1, fi); if (i < els.length - 1 && o.gap) await W(o.gap); }
      await W(fi + (o.hold ?? 3));
      for (const e of els) fadeTo(e, 0, fo);
      await W(fo);
    } finally { box.remove(); }
  }
  let cardPush = null;
  async function card(id) {
    const ch = CONTENT.chapters[id], W = s => Game.G.wait(s);
    try {
      if (fadeState !== 'black') await fade('black', 1);
      if (ch.card) {
        const pg = document.createElement('div'); pg.className = 'u-page'; pg.appendChild(drawPage(ch.card)); cardEl.appendChild(pg); setO(pg, 0);
        cardPush = { el: pg, t: 0 };
        fadeTo(pg, 1, 2);
        Audio.sfx('page_turn', { vol: 0.5 });
        await W(1.6);
        await Dialogue.say('chloe', `Step ${ch.card.step}. ${ch.card.text}`);
        for (const l of ch.card.vo || []) await Dialogue.say(l.who, l.text, l);
        await W(ch.card.hold ?? 1.4);
        fadeTo(pg, 0, 1.4); await W(2);
        pg.remove(); cardPush = null;
      }
      const t = document.createElement('div'); t.className = 'u-cht';
      t.innerHTML = `<div class="a">${type(ch.title, cap(1.3, 9), { track: 0.6 })}</div>${type(ch.name, cap(3.3, 18), { track: 0.6, stroke: 1.5 })}` +
        (ch.season ? `<div class="c">${type(ch.season, cap(1.3, 9), { track: 0.6 })}</div>` : '');
      cardEl.appendChild(t); setO(t, 0);
      fadeTo(t, 1, 1.8); await W(1.8 + 3.2);
      fadeTo(t, 0, 1.6); await W(2);
    } finally { cardEl.innerHTML = ''; cardPush = null; }
    autoReveal();
  }

  // The Yes Way manual page: worn paper, yellow header band, the step, clip-art, coffee rings, Chloe's pencil doodles.
  function drawPage(cd) {
    const W = 1000, H = 1320, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const x = cv.getContext('2d'), r = U.rng(cd.step * 7919 + 17), n = cd.step, Y = '#f0c22e', INK = '#272521';
    const circle = (cx, cy, rr, fill) => { x.beginPath(); x.arc(cx, cy, rr, 0, TAU); x.fillStyle = fill; x.fill(); };
    const rrect = (x0, y0, w, h, rad, fill) => { x.beginPath(); x.roundRect(x0, y0, w, h, rad); x.fillStyle = fill; x.fill(); };
    const font = (wt, px, ls = 0) => { x.font = `${wt} ${px}px ${SANS}`; x.letterSpacing = ls + 'px'; };
    // "friendly corporate": heavy sans with rounded corners from a round-joined stroke of the same ink
    const friendly = (t, px0, py0, px, col, align = 'left') => { font(800, px); x.textAlign = align; x.lineJoin = 'round'; x.lineWidth = px * 0.075; x.strokeStyle = x.fillStyle = col; x.strokeText(t, px0, py0); x.fillText(t, px0, py0); x.textAlign = 'left'; };
    const wrap = (t, maxW) => { const out = []; let cur = ''; for (const w of t.split(' ')) { const c = cur ? cur + ' ' + w : w; if (x.measureText(c).width > maxW && cur) { out.push(cur); cur = w; } else cur = c; } if (cur) out.push(cur); return out; };
    // paper: mottling, grain, fibres
    x.fillStyle = '#efe8d5'; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 70; i++) {
      const px = r() * W, py = r() * H, rad = 40 + r() * 240, g = x.createRadialGradient(px, py, 0, px, py, rad);
      g.addColorStop(0, r() < 0.6 ? `rgba(150,115,60,${0.02 + r() * 0.05})` : `rgba(255,252,240,${0.05 + r() * 0.08})`); g.addColorStop(1, 'rgba(150,115,60,0)');
      x.fillStyle = g; x.fillRect(px - rad, py - rad, rad * 2, rad * 2);
    }
    const tile = document.createElement('canvas'); tile.width = tile.height = 256;
    const tx = tile.getContext('2d'), img = tx.createImageData(256, 256);
    for (let i = 0; i < img.data.length; i += 4) { img.data[i] = img.data[i + 1] = img.data[i + 2] = r() * 255; img.data[i + 3] = 22; }
    tx.putImageData(img, 0, 0); x.fillStyle = x.createPattern(tile, 'repeat'); x.fillRect(0, 0, W, H);
    x.lineWidth = 1;
    for (let i = 0; i < 260; i++) { const px = r() * W, py = r() * H, a = r() * TAU, l = 4 + r() * 14; x.strokeStyle = r() < 0.5 ? 'rgba(90,70,40,.08)' : 'rgba(255,255,250,.18)'; x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke(); }
    // header band with the "yes" bubble mark
    x.fillStyle = Y; x.fillRect(0, 70, W, 124);
    x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(0, 70, W, 6); x.fillStyle = 'rgba(110,70,0,.16)'; x.fillRect(0, 190, W, 4);
    x.beginPath(); x.ellipse(150, 130, 36, 31, 0, 0, TAU); x.moveTo(128, 152); x.lineTo(118, 172); x.lineTo(146, 158); x.fillStyle = '#fffaf0'; x.fill();
    x.strokeStyle = INK; x.lineWidth = 7; x.lineCap = x.lineJoin = 'round'; x.beginPath(); x.moveTo(135, 131); x.lineTo(147, 143); x.lineTo(167, 118); x.stroke();
    friendly('THE YES WAY', 206, 153, 60, INK);
    font(700, 19, 3); x.fillStyle = 'rgba(39,37,33,.75)'; x.textAlign = 'right'; x.fillText('7 STEPS TO THE CLOSE', 930, 141); x.textAlign = 'left';
    // the step
    circle(185, 352, 84, Y);
    friendly(String(n), 185, 390, 108, INK, 'center');
    font(700, 21, 5); x.fillStyle = '#8f846d'; x.fillText(`STEP ${n} OF 7`, 305, 298);
    const parts = cd.text.split(/(?<=[.!?])\s+/), head = parts.shift();
    font(800, 56); const hl = wrap(head, 620); let y = 368;
    for (const l of hl) { friendly(l, 305, y, 56, INK); y += 62; }
    const headEnd = { x: 305 + Math.min(620, x.measureText(hl[hl.length - 1]).width), y: y - 62 };
    font(400, 35); x.fillStyle = '#45423c';
    for (const l of wrap(parts.join(' '), 620)) { x.fillText(l, 305, y + 6); y += 46; }
    // clip-art: the rep and a pensioner across the counter
    const by = Math.max(600, y + 36);
    rrect(110, by, 820, 330, 26, 'rgba(240,194,46,.17)');
    const fig = (cx, body, skin, hair, specs) => {
      rrect(cx - 64, by + 172, 128, 150, 44, body);
      circle(cx, by + 122, 44, skin);
      x.beginPath(); x.arc(cx, by + 114, 46, Math.PI * 1.05, Math.PI * 1.95); x.lineTo(cx + 40, by + 100); x.quadraticCurveTo(cx, by + 86, cx - 40, by + 100); x.fillStyle = hair; x.fill();
      circle(cx - 15, by + 124, 4.5, INK); circle(cx + 15, by + 124, 4.5, INK);
      x.strokeStyle = INK; x.lineWidth = 4; x.beginPath(); x.arc(cx, by + 134, 15, 0.2 * Math.PI, 0.8 * Math.PI); x.stroke();
      if (specs) { x.strokeStyle = 'rgba(39,37,33,.6)'; x.lineWidth = 3; x.strokeRect(cx - 27, by + 116, 20, 14); x.strokeRect(cx + 7, by + 116, 20, 14); }
    };
    fig(380, Y, '#e2b793', '#5a3b26');
    rrect(398, by + 208, 34, 18, 4, '#fffaf0');
    fig(640, '#7f97aa', '#d3a482', '#c9c4bb', true);
    x.strokeStyle = '#e2b793'; x.lineWidth = 22; x.lineCap = 'round'; x.beginPath(); x.moveTo(430, by + 205); x.quadraticCurveTo(478, by + 222, 500, by + 262); x.stroke();
    rrect(200, by + 262, 620, 68, 10, '#d8cfbd'); x.fillStyle = 'rgba(0,0,0,.08)'; x.fillRect(200, by + 262, 620, 7);
    rrect(488, by + 244, 58, 24, 6, '#2c2c30'); rrect(493, by + 248, 48, 16, 3, '#6d8cff');
    rrect(690, by + 26, 190, 76, 36, '#fffaf0'); x.beginPath(); x.moveTo(716, by + 92); x.lineTo(690, by + 120); x.lineTo(748, by + 98); x.fill();
    font(800, 36); x.fillStyle = INK; x.textAlign = 'center'; x.fillText(['Hi!', 'Me too!', 'Well…', 'Perfect!', 'Hmm…', 'Yes!', 'Yes!'][n - 1] || 'Yes!', 785, by + 77); x.textAlign = 'left';
    // notes lines, footer
    const ny = by + 380;
    font(700, 17, 4); x.fillStyle = '#8f846d'; x.fillText('MY NOTES', 110, ny);
    x.strokeStyle = 'rgba(110,135,160,.33)'; x.lineWidth = 2;
    for (let i = 1; i <= 4; i++) { x.beginPath(); x.moveTo(110, ny + i * 44); x.lineTo(930, ny + i * 44); x.stroke(); }
    for (let i = 0; i < 7; i++) { x.beginPath(); x.arc(118 + i * 34, 1252, 9, 0, TAU); if (i === n - 1) { x.fillStyle = Y; x.fill(); } x.strokeStyle = i === n - 1 ? INK : '#b1a893'; x.lineWidth = 2.5; x.stroke(); }
    font(700, 14, 3); x.fillStyle = '#9d937e'; x.textAlign = 'right'; x.fillText(`RETAIL ACADEMY  ·  INTERNAL USE ONLY  ·  ${6 + n * 4}`, 930, 1258); x.textAlign = 'left';
    font(400, 10);
    // coffee rings
    const ring = (cx, cy, R) => {
      const g = x.createRadialGradient(cx, cy, R * 0.2, cx, cy, R); g.addColorStop(0, 'rgba(140,85,35,.03)'); g.addColorStop(0.9, 'rgba(140,85,35,.08)'); g.addColorStop(1, 'rgba(140,85,35,0)');
      x.fillStyle = g; x.beginPath(); x.arc(cx, cy, R, 0, TAU); x.fill();
      const ph = r() * TAU, gap = r() * TAU;
      for (let a = 0; a < TAU; a += 0.03) {
        const k = (Math.sin(a * 2 + ph) * 0.5 + 0.5) * (Math.abs(U.wrapAngle(a - gap)) < 0.5 ? 0.2 : 1);
        x.strokeStyle = `rgba(118,70,28,${(0.1 + 0.28 * k).toFixed(3)})`; x.lineWidth = 1.5 + 3.5 * k * r();
        x.beginPath(); x.arc(cx, cy, R + Math.sin(a * 5 + ph) * 1.6, a, a + 0.04); x.stroke();
      }
    };
    const spots = [[800, by - 30, 98], [250, ny + 110, 86], [820, ny + 150, 92], [610, 420, 94]];
    ring(...spots.splice(Math.floor(r() * spots.length), 1)[0]);
    if (r() < 0.6) ring(...spots[Math.floor(r() * spots.length)]);
    // Chloe's pencil doodles
    const pencil = (pts, w = 3) => {
      for (let p = 0; p < 2; p++) {
        x.beginPath(); pts.forEach(([px, py], i) => { const jx = px + (r() - 0.5) * 1.8, jy = py + (r() - 0.5) * 1.8; if (i) x.lineTo(jx, jy); else x.moveTo(jx, jy); });
        x.lineWidth = w * (p ? 0.55 : 1); x.strokeStyle = `rgba(48,48,58,${p ? 0.4 : 0.72})`; x.lineCap = x.lineJoin = 'round'; x.stroke();
      }
    };
    const arc = (cx, cy, rx, ry, a0 = 0, a1 = TAU, k = 36) => Array.from({ length: k + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / k; return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]; });
    const seg = (a, b, w) => pencil([a, b], w);
    const D = {
      star: (cx, cy, s) => pencil(Array.from({ length: 11 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? s * 0.42 : s; return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]; })),
      spiral: (cx, cy, s) => pencil(Array.from({ length: 70 }, (_, i) => { const t = i * 0.19, k = t / 13.3; return [cx + Math.cos(t) * k * s, cy + Math.sin(t) * k * s]; })),
      heart: (cx, cy, s) => pencil(Array.from({ length: 44 }, (_, i) => { const t = i / 43 * TAU; return [cx + s * 0.06 * 16 * Math.sin(t) ** 3, cy - s * 0.06 * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))]; })),
      smiley: (cx, cy, s) => { pencil(arc(cx, cy, s, s)); for (const k of [-1, 1]) seg([cx + k * s * 0.35, cy - s * 0.3], [cx + k * s * 0.33, cy - s * 0.1]); pencil(arc(cx, cy + s * 0.05, s * 0.55, s * 0.5, 0.45, Math.PI - 0.45, 12)); },
      cat: (cx, cy, s) => {
        pencil(arc(cx, cy, s, s * 0.85));
        for (const k of [-1, 1]) {
          pencil([[cx + k * s * 0.85, cy - s * 0.35], [cx + k * s * 0.75, cy - s * 1.25], [cx + k * s * 0.25, cy - s * 0.82]]);
          seg([cx + k * s * 0.35, cy - s * 0.15], [cx + k * s * 0.35, cy + s * 0.02]);
          seg([cx + k * s * 0.25, cy + s * 0.3], [cx + k * s * 1.3, cy + s * 0.18], 1.6); seg([cx + k * s * 0.25, cy + s * 0.42], [cx + k * s * 1.3, cy + s * 0.5], 1.6);
        }
      },
      cloud: (cx, cy, s) => {
        pencil([...arc(cx - s * 0.5, cy, s * 0.45, s * 0.45, Math.PI * 0.5, Math.PI * 1.6, 10), ...arc(cx, cy - s * 0.35, s * 0.55, s * 0.55, Math.PI * 1.1, Math.PI * 1.95, 12), ...arc(cx + s * 0.55, cy, s * 0.45, s * 0.45, Math.PI * 1.4, Math.PI * 2.5, 10), [cx - s * 0.5, cy + s * 0.45]]);
        for (let i = 0; i < 4; i++) seg([cx - s * 0.6 + i * s * 0.38, cy + s * 0.7], [cx - s * 0.72 + i * s * 0.38, cy + s * 1.05], 2);
      },
      sun: (cx, cy, s) => { pencil(arc(cx, cy, s * 0.5, s * 0.5)); for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; seg([cx + Math.cos(a) * s * 0.7, cy + Math.sin(a) * s * 0.7], [cx + Math.cos(a) * s, cy + Math.sin(a) * s], 2); } },
      house: (cx, cy, s) => { pencil([[cx - s * 0.7, cy - s * 0.1], [cx - s * 0.7, cy + s * 0.8], [cx + s * 0.7, cy + s * 0.8], [cx + s * 0.7, cy - s * 0.1]]); pencil([[cx - s * 0.9, cy], [cx, cy - s * 0.8], [cx + s * 0.9, cy]]); pencil([[cx - s * 0.18, cy + s * 0.8], [cx - s * 0.18, cy + s * 0.3], [cx + s * 0.18, cy + s * 0.3], [cx + s * 0.18, cy + s * 0.8]]); },
      leaf: (cx, cy, s) => { // a gum leaf
        const L = s * 1.1, w = s * 0.36, c = Math.cos(-0.5), sn = Math.sin(-0.5), P = (u, v) => [cx + c * u - sn * v, cy + sn * u + c * v];
        const edge = k => Array.from({ length: 17 }, (_, i) => { const t = i / 16; return P((t - 0.5) * 2 * L, k * w * Math.sin(Math.PI * t ** 0.8)); });
        pencil([...edge(-1), ...edge(1).reverse()]); seg(P(-L * 1.3, s * 0.05), P(L * 0.9, 0), 1.8);
        for (let k = 1; k < 4; k++) seg(P(-L + k * 0.45 * L, 0), P(-L + k * 0.45 * L + 0.3 * L, -w * 0.7), 1.4);
      },
      flake: (cx, cy, s) => {
        for (let i = 0; i < 3; i++) {
          const a = i * Math.PI / 3, c = Math.cos(a) * s, d = Math.sin(a) * s;
          seg([cx - c, cy - d], [cx + c, cy + d]);
          for (const k of [-1, 1]) { const bx = cx + k * c * 0.6, bY = cy + k * d * 0.6, q = s * 0.28; pencil([[bx + Math.cos(a + k * 2.4) * q, bY + Math.sin(a + k * 2.4) * q], [bx, bY], [bx + Math.cos(a - k * 2.4) * q, bY + Math.sin(a - k * 2.4) * q]], 1.8); }
        }
      },
      whale: (cx, cy, s) => {
        pencil([[cx - s, cy], ...arc(cx - s * 0.1, cy, s * 0.9, s * 0.55, Math.PI, TAU, 16), [cx + s * 1.1, cy - s * 0.35], [cx + s * 1.25, cy - s * 0.1], [cx + s * 0.95, cy + s * 0.12], ...arc(cx - s * 0.1, cy + s * 0.02, s * 0.95, s * 0.35, 0.1, Math.PI, 12)]);
        seg([cx - s * 0.55, cy - s * 0.12], [cx - s * 0.53, cy - s * 0.08], 3.5);
        for (const k of [-0.18, 0, 0.18]) seg([cx - s * 0.2, cy - s * 0.6], [cx - s * 0.2 + k * s, cy - s * 0.92], 1.8);
      },
      tally: (cx, cy, s) => { for (let i = 0; i < 4; i++) seg([cx - s * 0.6 + i * s * 0.3, cy - s * 0.5], [cx - s * 0.62 + i * s * 0.3, cy + s * 0.5], 2); seg([cx - s * 0.8, cy + s * 0.35], [cx + s * 0.5, cy - s * 0.35], 2); },
    };
    D[['cloud', 'sun', 'house', 'leaf', 'flake', 'whale', 'star'][n - 1] || 'star'](790, ny + 96, 58);
    const extra = ['star', 'spiral', 'heart', 'smiley', 'cat', 'tally'].sort(() => r() - 0.5);
    D[extra[0]](270, ny + 104, 36); D[extra[1]](530, ny + 96, 32); D[extra[2]](958, 500 + r() * 320, 18); D[extra[3]](52, 470 + r() * 90, 20);
    if (n % 2) pencil(arc(185, 352, 104, 98, -0.6, TAU + 0.9, 60), 2.4);
    else { seg([305, headEnd.y + 16], [headEnd.x, headEnd.y + 13], 2.2); seg([312, headEnd.y + 27], [headEnd.x - 8, headEnd.y + 25], 2); }
    // wear: darkened edges, punched holes, nicks, the dog-ear, lamp falloff
    for (const [a, b, c, d] of [[0, 0, 60, 0], [W, 0, W - 60, 0], [0, 0, 0, 60], [0, H, 0, H - 60]]) { const g = x.createLinearGradient(a, b, c, d); g.addColorStop(0, 'rgba(125,90,40,.3)'); g.addColorStop(1, 'rgba(125,90,40,0)'); x.fillStyle = g; x.fillRect(0, 0, W, H); }
    for (const hy of [300, 660, 1020]) circle(52, hy, 21, 'rgba(120,95,60,.12)');
    x.globalCompositeOperation = 'destination-out';
    for (const hy of [300, 660, 1020]) circle(52, hy, 16, '#000');
    x.beginPath(); x.moveTo(W - 78, 0); x.lineTo(W, 0); x.lineTo(W, 78); x.fill();
    for (let i = 0; i < 26; i++) {
      const e = r() < 0.5, p = r() * (e ? W : H), s = 2 + r() * 5, edge = r() < 0.5 ? 0 : e ? H : W, k = edge ? -s : s;
      x.beginPath();
      if (e) { x.moveTo(p, edge); x.lineTo(p + s, edge); x.lineTo(p + s / 2, edge + k); } else { x.moveTo(edge, p); x.lineTo(edge, p + s); x.lineTo(edge + k, p + s / 2); }
      x.fill();
    }
    x.globalCompositeOperation = 'source-over';
    x.beginPath(); x.moveTo(W - 78, 0); x.lineTo(W, 78); x.lineTo(W - 70, 88); x.closePath(); x.fillStyle = 'rgba(0,0,0,.18)'; x.fill();
    const fg = x.createLinearGradient(W - 78, 78, W - 39, 39); fg.addColorStop(0, '#d9cfb8'); fg.addColorStop(1, '#f1ead9');
    x.beginPath(); x.moveTo(W - 78, 0); x.lineTo(W, 78); x.lineTo(W - 78, 78); x.closePath(); x.fillStyle = fg; x.fill();
    const lamp = x.createRadialGradient(W * 0.35, H * 0.3, 100, W * 0.5, H * 0.5, H * 0.8);
    lamp.addColorStop(0, 'rgba(255,245,220,.08)'); lamp.addColorStop(1, 'rgba(30,18,6,.28)');
    x.globalCompositeOperation = 'source-atop'; x.fillStyle = lamp; x.fillRect(0, 0, W, H); x.globalCompositeOperation = 'source-over';
    return cv;
  }

  // ---- boot, death, end of build ----------------------------------------------------------------------------------
  function loading(p) {
    if (p == null) { fadeTo(loadEl, 0, 0.4); return; }
    loadEl.querySelector('.pct').innerHTML = type(Math.round(p * 100) + '%', cap(0.95, 8), { track: 0.4, stroke: 1 });
  }
  function clickToBegin() {
    fadeTo(loadEl.querySelector('.coil'), 0, 0.6); fadeTo(loadEl.querySelector('.pct'), 0, 0.6);
    after(0.6, () => fadeTo(loadEl.querySelector('.go'), 0.9, 1.2));
    return new Promise(res => {
      const done = () => {
        removeEventListener('pointerdown', done); removeEventListener('keydown', done);
        fade('black', 0); setO(loadEl, 0); res();
      };
      addEventListener('pointerdown', done); addEventListener('keydown', done);
    });
  }
  let retryNow = null;
  function death() {
    mode = 'death';
    Audio.sfx('click');
    prompt(null); phone(null); skipRing(null); subtitle(null); letterbox(false, 0.8); arcs = []; arcsIn = [];
    const bar = deathEl.querySelector('.u-bar i'); bar.style.width = '0%';
    fade('black', 0.8);
    return new Promise(res => {
      retryNow = () => {
        if ((deathEl._o ?? 0) < 0.5) return;
        retryNow = null; Audio.sfx('ui_select'); fadeTo(deathEl, 0, 0.25); mode = null; res(); autoReveal();
      };
      after(0.85, () => {
        fadeTo(deathEl, 1, 0.35);
        tween('death', 0, 1, 1, v => { bar.style.width = (v * 100).toFixed(1) + '%'; }, U.ease.linear).then(() => retryNow?.());
      });
    });
  }
  function endReturn() {
    if (busy) return; busy = true; Audio.sfx('ui_select');
    fadeTo(endEl, 0, 0.8).then(() => { busy = false; mode = null; Game.quitToTitle(); });
  }
  function endOfBuild() {
    mode = 'end'; Input.unlock();
    prompt(null); phone(null); skipRing(null); hud({ show: false }); letterbox(false, 1);
    endEl.innerHTML = `<div class="f">${type('END OF CURRENT BUILD', cap(1.5, 10), { track: 0.6 })}</div><div class="mi on">${type('RETURN TO TITLE', T.item, { track: 0.4 })}</div>`;
    fade('black', 2).then(() => { if (mode === 'end') fadeTo(endEl, 1, 1.5); });
    navCool = 2.5;
  }

  // ---- per frame ---------------------------------------------------------------------------------------------------
  const flk = { next: 4, burst: 0 };
  function update(dt) {
    for (const [k, t] of tweens) {
      t.t += dt; const p = Math.min(1, t.t / t.dur);
      t.apply(t.from + (t.to - t.from) * t.ease(p));
      if (p >= 1) { tweens.delete(k); t.done(); }
    }
    if (timers.length) { const due = timers; timers = []; for (const t of due) { if ((t.t -= dt) <= 0) t.f(); else timers.push(t); } }
    const bar = Math.max(0, (innerHeight - innerWidth / 2.39) / 2) * lb.v;
    lbTop.style.height = lbBot.style.height = bar.toFixed(1) + 'px';
    // subtitle pages; placement centred in the lower bar when it fits
    if (sub && !subSample && !Game.paused && sub.i < sub.pages.length - 1) { sub.t += dt * Game.timeScale; if (sub.t >= sub.ends[sub.i]) { sub.i++; renderSub(); } }
    if (subEl._o > 0) { const h = subEl.offsetHeight; subEl.style.bottom = (bar > h + 14 ? (bar - h) / 2 : Math.max(innerHeight * 0.07, bar + 10)).toFixed(1) + 'px'; }
    // input
    navCool -= dt;
    if (Input.device !== lastDevice) {
      lastDevice = Input.device;
      if (promptText) promptEl.innerHTML = promptHTML(promptText);
      if (stack.length) hints();
      if (skipOn) skipLabel();
    }
    if (!busy && navCool <= 0) {
      if ((mode === 'title' || mode === 'pause') && stack.length) nav(dt);
      else if (mode === 'death' && (Input.pressed('confirm') || Input.pressed('fire'))) retryNow?.();
      else if (mode === 'end' && (Input.pressed('confirm') || Input.pressed('fire'))) endReturn();
    }
    // HUD: visible while something changes, when hurt or listening; never in cutscenes or menus
    hudWake -= dt; flick -= dt;
    const want = hs.show && !Director.active && !mode && (hudWake > 0 || hs.listen || hs.aim || hs.health <= 0.26) ? 1 : 0;
    hudO = U.damp(hudO, want, want ? 7 : 2.2, dt); setO(hudEl, hudO < 0.005 ? 0 : hudO);
    crossEl.style.opacity = hs.aim && hs.show && !Director.active && !mode ? 1 : 0;
    crossEl.style.transform = flick > 0 ? 'scale(1.6)' : '';
    // detection arcs: AI.detectors plus UI.detect calls made during this frame
    if (!Game.paused) { arcs = arcsIn.concat(AI.detectors || []); arcsIn = []; }
    drawDetect();
    // the dying S of YES
    if (mode === 'title') {
      if ((flk.next -= dt) <= 0) { flk.burst = 0.18 + U.rand() * 0.35; flk.next = 3 + U.rand() * 7; }
      flk.burst -= dt;
      logoS.style.opacity = flk.burst > 0 && U.rand() < 0.55 ? 0.12 : 0.42;
    }
    if (cardPush) { cardPush.t += dt; cardPush.el.style.transform = `translate(-50%,-50%) rotate(-1.2deg) scale(${(1 + 0.04 * U.smooth(Math.min(1, cardPush.t / 18))).toFixed(4)})`; }
  }

  return {
    init, update, loading, clickToBegin, titleScreen, pauseMenu, fade, letterbox, subtitle, prompt, card, titleText, phone, hud,
    skipRing, death, endOfBuild, detect, hideMenus: closeMenus, menuOpen: () => !!mode,
  };
})();
