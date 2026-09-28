# The Last of Yes — Architecture

The deliverable is one file, `the-last-of-yes.html`. It is **built** from `src/`:
`node tools/build.mjs` concatenates `src/*.js` (sorted by filename) into the single
`<script type="module">` inside `src/index.html`. The full design is `docs/spec.md` (the build
prompt, including the complete script). Three.js r0.160.0 from jsdelivr is the only external request.

## Commands

```bash
node tools/build.mjs                       # -> the-last-of-yes.html
node tools/shot.mjs --q "dev&test=smoke" --wait 1500 --shot out/a.png
node tools/shot.mjs --q "dev&scene=P.1" --steps "ff:3,shot:out/p1a.png,ff:5,shot:out/p1b.png"
node tools/shot.mjs --q "dev&area=P2" --steps "down:KeyW,ff:2,up:KeyW,shot:out/walk.png"
node tools/shot.mjs --q "dev&goto=prologue:P.2" --steps "ff:10,shot:out/x.png,eval:GAME.Game.area.id"
```

`shot.mjs` builds to a private temp file, opens headless Chromium (SwiftShader WebGL; the jsdelivr
URLs are routed to `node_modules/three`), prints every console error/warning and exits non-zero if any.
`ff:N` fast-forwards N seconds of game time with fixed 1/30 s steps (async flows advance between steps).
Look at your screenshots with the Read tool — they are the only way to judge visuals.

Dev URL params (all need `dev`): `goto=chapter[:stepId]`, `scene=ID`, `area=ID` (free-roam as Chase at
`mk_start`), `test=name` (runs `CONTENT.dev[name](G)`), `title`. `window.GAME` exposes every module.

## File layout (one owner per file)

| File | Module | Owner |
| --- | --- | --- |
| `000_imports.js` | Three.js + addons imports | core |
| `010_config.js` | `CONFIG`, `SETTINGS`, `U` helpers, `PARAMS` | core |
| `020_content.js` | `CONTENT` tables, speakers, grades | core |
| `021_content_*.js` … `029_*` | chapter scripts: scenes, talks, flow steps | content agents |
| `100_engine.js` | `Engine` renderer + post + grade + env | core |
| `110_input.js` | `Input` | core |
| `120_audio.js` | `Audio` | audio agent |
| `130_tex.js` | `Tex` | world agent |
| `140_build.js` | `Build` | world agent |
| `150_chars.js` (+ `155_*`, `160_anim.js` optional) | `Chars` | chars agent |
| `170_ai.js` | `AI` | systems agent |
| `175_world.js` | `World` collision | core |
| `180_play.js` | `Play` | core → systems agent |
| `190_director.js` | `Director` | cinema agent |
| `200_dialogue.js` | `Dialogue` | cinema agent |
| `210_ui.js` | `UI` | ui agent |
| `220_save.js` | `Save` | core |
| `230_game.js` | `Game` + `G` API | core |
| `3xx_levels_*.js` | `CONTENT.levels[...]` area builders + `CONTENT.hooks` | level agents |
| `390_dev.js` | dev sandboxes | core |
| `900_main.js` | boot, loop, dev hooks | core |

The API of every module is documented in the header comment of its file. **That header is the
contract**: implement everything it lists, never rename or remove an API another module uses. If you
need something from another module, ask for it in your final report rather than editing that file.

## Code rules

- Each module file declares exactly one top-level name: `const Name = (() => { …; return api; })();`.
  Helpers live inside the closure. Content/level files only assign into `CONTENT`.
- Module closures must not touch other modules at evaluation time — only inside functions (`init()`,
  `update()`…). Evaluation order is filename order.
- Lean code (the "ponytail" rule): no speculative abstractions, no config for values that never
  change, no dead code, no TODOs, no placeholder text. But never cut spec content: every scripted
  line ships verbatim.
- Zero console errors or warnings. No `console.log` spam.
- Timing: gameplay/cinematic timing uses **game time** (`G.wait`, `Game.time`, `dt`) — never
  `setTimeout`/`setInterval`, so dev fast-forward and pause work.
- Everything procedural: canvas textures, generated geometry, Web Audio. No asset files, no fonts
  other than system fonts (`"Helvetica Neue", Helvetica, Arial, sans-serif`, monospace for screens).
- Memory: area geometry/materials are disposed on unload unless `userData.shared` is set (Tex caches
  set it). Reuse materials; instance repeated meshes (`Build.instanced`).
- Performance budget per area: ≤ 1 shadow-casting light (`Build.sun` or one spot), ≤ ~10 other lights,
  ≤ ~250 draw calls (merge static geometry with `mergeGeometries`, instance repeats), ≤ 12 active AI.

## Frame order (`Game.tick`)

`Input.update → Director.update → Play.update → AI.update → area updaters → Chars.update →
Dialogue.update → G waits → interactables → Director.camUpdate → UI.update → Audio.update`, then
`Engine.render`. `Engine.camera` is the only camera; `Director.camUpdate` poses it from the active shot,
a manual pose (`Director.manual`), a blend, or `Play.camPose`.

## Coordinates and units

Metres, Y up. Characters face local **+Z**; `yaw = root.rotation.y`; forward = `(sin yaw, 0, cos yaw)`;
`U.yawTo(from, to)` gives the yaw that faces a point. Positions in data are `[x, y, z]`.

## Areas (`CONTENT.levels[id]`)

```js
CONTENT.levels.P2 = {
  name: "Bub's house", origin: [500, 0, 0],       // world offset of the area (areas that coexist must not overlap)
  grade: 'launch_home', fog: { color: 0x0a0c14, near: 8, far: 45 } /* or {color, density} */,
  env: { top: 0x101828, horizon: 0x302830, bottom: 0x080808, intensity: 0.5, spots: [{ dir: [1, .3, 0], color: 0xff9a40, power: 3 }] } /* or 'room' or null */,
  background: 0x05070c, amb: 'house_night', surface: 'wood',
  build(A) { /* area-local coordinates */ },
  unload(A) {},                                    // optional cleanup
};
```

`G.area(id)` builds it (one frame hitch — hide it behind a cut, fade, squeeze or door) and unloads
every other area; `G.area(id, {keep: true})` keeps the others (for scenes that intercut two places).
Inside `build(A)` everything is **area-local**: `A.group` sits at `origin`; the helpers convert:

- `A.marker(name, localPos, yaw)` — named marks for scenes/flow (`mk_*`), stored in world space.
- `A.interactable({at, r, prompt, once, cond, use: async (G, it) => {}})` — "e – look" style prompts.
- `A.char(defId, {name, at, yaw, …})` — area-local characters (disposed with the area).
- `A.update((dt, t) => {})` — per-frame animation (flicker, water, traffic, drifting camera).
- `A.collider(min, max, opts)`, `A.surface(x1, z1, x2, z2, name)`, `A.w(localPos)` → world Vector3.
- `A.data` — free storage for the level's own runtime state.
- `Build.*` calls add to `A.group` and register colliders automatically (`solid`).

Area origins (keep coexisting areas ≥ 300 m apart): TITLE `[0,0,0]`, P1 `[0,0,0]`, P2 `[500,0,0]`,
P3 `[0,0,1500]`, P4 `[1500,0,0]`, P5 `[1500,0,1500]`. Later chapters: pick a free 2 km cell per chapter.

## Chapter flow (`CONTENT.chapters[id]`)

```js
CONTENT.chapters.prologue = {
  title: 'Prologue', name: 'LAUNCH DAY', season: '',       // chapter select + title card text
  card: null,                                              // or { step: 1, text: '…', vo: [{who, text, emote}] } (The Yes Way page)
  steps: [
    { id: 'P.1', run: async G => { await G.area('P1'); G.actor('chase', 'chase_young', 'mk_counter'); await G.scene('P.1'); } },
    { id: 'P.2', checkpoint: true, run: async G => { … } },
  ],
};
```

A step with `checkpoint: true` autosaves when it starts; death restarts the last checkpoint step, so a
checkpoint step must set up everything it needs (area, actors and their positions, player, inventory is
restored by Game). The `G` API (`src/230_game.js`): `area unload look actor removeActor who place marker
scene player control wait until zone interact say talk fade card title music sfx amb spawn hook grade
flags t A save`. Every `G` promise rejects with `G.ABORT` when the flow is cancelled; Game swallows it.

## Scene format (`CONTENT.scenes[id]`) — the Director contract

```js
CONTENT.scenes['1.10'] = {
  title: 'Close One That Matters', area: '1G',   // area the scene expects (dev ?scene= loads it)
  grade: 'flagship_night',                        // optional grade at start
  letterbox: true,                                // default true
  music: null,                                    // cue id at start | 'stop' | null/omitted = leave as is
  silence: true,                                  // drop all music and most ambience for the whole scene
  amb: 'mall_dawn',                               // optional ambience change
  skippable: true,                                // default true (7.9–7.14 and endings: false on first viewing)
  cast: { chase: 'mk_counter', chloe: { at: 'mk_door', yaw: 3.1, pose: 'stand', def: 'chloe' } },
  start: { blend: 0.8 },                          // from the gameplay camera; { cut: true } for a hard cut
  shots: [ /* shot, shot, … */ ],
  end: { place: { chase: 'mk_exit' }, flags: { waiDead: true }, pose: { chase: 'stand' } },  // applied at the end and on skip
  exit: { blend: 'gameplay', dur: 1.2 },          // | { fade: 'black', dur: 1 } | { cut: true } | { hold: true }
};
```

`cast` places characters at the start (a persistent actor with that id if one exists, otherwise an
area char with that `name`; `def` creates it if missing). Never teleport on camera: marks are applied
during the opening blend/cut.

**Shot**

```js
{ cam: CamSpec, dur: 6, hold: 0.4, longTake: true,
  focus: 'wai' | { rack: ['chloe', 'chase'], at: 2, dur: 1.5 } | null,
  actions: [ { t: 0.8, who: 'wai', do: 'gesture', name: 'pull_collar' } ],
  lines:   [ { who: 'wai', text: 'Chase.', emote: 'tender', pause: 1.2, to: 'chase' } ],
  cues:    [ { t: 0, sfx: 'glass_break', at: 'mk_door' }, { t: 4, fade: 'black', dur: 1 } ] }
```

- Shot length = `dur` if given, else the max of camera `dur`, end of the last line + `hold`, last
  action/cue time. The Director never cuts inside a shot — long takes are single shots.
- Lines play in order: start = previous end + `pause` (default 0.3 s; first line starts at `pause`).
  Default line duration = `max(1.6, words × 0.32 + 0.6)`. `t` on a line forces an absolute start.
  The speaker animates (visemes, `emote`) and looks at `to` or the nearest other cast member.
  `off: true` → subtitle `[NAME]`; `via: 'phone'` → `NAME (phone)`. A silent beat is `text: '…'`.
- `focus` defaults to the current speaker; `null` disables depth of field for the shot.

**CamSpec** (`lens` mm → vertical FOV on a 36 mm sensor; `ease` default `inOut`; `push` 0–0.1 slow
push-in over the shot; `handheld` 0–1 noise amount on any type; `blend: s` blends from the previous
camera instead of cutting)

| type | params |
| --- | --- |
| `static` | `at`, `look` |
| `dolly` / `crane` | `from`, `to`, `look`, `lookTo?`, `dur?` |
| `pan` | `at`, `look`, `lookTo` |
| `orbit` | `around`, `radius`, `height`, `from` (deg), `to` (deg) |
| `ots` | `over`, `on`, `side: 'right'\|'left'`, `dist?` — auto-framed over-the-shoulder (180° rule: keep `side` consistent per exchange) |
| `two_shot` | `a`, `b`, `side`, `dist?` |
| `close` | `who`, `side?`, `dist?` — head and shoulders |
| `extreme_close` | `who`, `part: 'eyes'\|'hands'\|'hand_r'\|'badge'\|'phone'`, `dist?` |
| `pov` | `who`, `look` |
| `follow` | `who`, `offset: [x,y,z]` (local), `lookAhead?` |
| `handheld` | shorthand for `static` with `handheld: 0.6` |

Position/target specs: `[x,y,z]` world · `'mk_name'` · `'who.part'` (head eyes chest hips feet hand_l
hand_r badge) · `'who'` (= head) · `{ of: who|marker, off: [x,y,z] }` (local offset: x right, y up, z forward).

**Actions** (`do`): `place {at, yaw}` (teleport, off-camera only) · `walkTo {at|path, speed}` · `runTo
{at}` · `turnTo {to}` · `lookAt {at|null}` · `emote {name}` · `gesture {name}` · `pose {name}` · `sit` `stand`
`kneel` `lie` · `hold {prop, hand}` · `give {prop, to}` · `take {prop, from}` · `drop {hand}` · `hug {to}` ·
`carry {to}` · `attach {to, mode}` · `detach` · `aim {at}` · `fire {at}` · `die` · `anim {name}` · `show` ·
`hide` · `badge {value, where}` · `decal {kind, on}` · `phoneGlow {on}` · `call {hook, args}` (runs
`CONTENT.hooks[hook](G, args)` for anything special).

**Cues**: `music {id|'stop', fade}` · `sfx {name, at, vol}` · `loop {name, at, id}` / `stopLoop {id}` · `amb
{name}` · `fade {to: 'black'|'white'|'none', dur}` · `title {lines, hold}` · `shake {amount, dur}` ·
`slowmo {scale, dur}` · `grade {name, dur}` · `look {area}` (apply another area's fog/env/grade when
intercutting) · `ui {phone: …}` · `letterbox {on}` · `call {hook, args}`.

## Phone overlay (`UI.phone(state)`)

A diegetic phone screen drawn over the view (for Bub's typing, texts, the lock screen, notifications):
`{ kind: 'lock'|'messages'|'notification'|'call'|'install', title, lines:[{from:'me'|'them', text}],
draft, caret, notif:{app, text}, progress, time: '11:58 PM', badge }`. `null` hides it.

## Characters (`Chars.defs`)

Required ids (see `docs/spec.md` §5 for the bible). Prologue first:
`chase_young, luke_young, bub, customer, security_guard, neighbour, soldier, crowd` (varied by seed),
`scroller` (varied by seed) — then `chase, chloe, chloe_winter, wai, zane, aidan, luke, operator,
level3, techsupport, closer, regional, wholesaler, facilitator, chef, lukes_wife, landline, doorknocker,
retreat, smuggler, bandit, townsperson, kid, man, lurker, clicker, bloatware, horse, deer`.

## Agent workflow (parallel agents)

Agents work in a private copy so half-finished files never break anyone else's build:

```bash
rsync -a --delete --exclude node_modules --exclude out --exclude .git /home/user/thelastofyes/ /tmp/tloy-NAME/
ln -sfn /home/user/thelastofyes/node_modules /tmp/tloy-NAME/node_modules
cd /tmp/tloy-NAME   # build + test here
```

When done: re-sync the *other* files from the main tree (`rsync` again but keep your own files),
re-test, then copy **only the files you own** back into `/home/user/thelastofyes/src/` and run
`node tools/shot.mjs --q "dev&test=smoke"` in the main tree. Never commit — the orchestrator commits.
