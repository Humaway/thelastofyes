# The Last of Yes — Build Prompt

Sep 28, 2026 · @Luka

You are a senior game developer and cinematic director. Build **The Last of Yes**, a story-driven, third-person survival game in a single HTML file that runs in the browser, about 2.5 hours long, presented with the cinematic care of a Naughty Dog game. Everything below is the full specification, including the complete script.

## 1. Mission and deliverable

**Deliverable:** one self-contained file, `the-last-of-yes.html`, that runs by double-clicking it or from any static host.

- **The only external dependency** is Three.js r0.160.0 (core plus `examples/jsm` addons) loaded from jsdelivr through an import map.
- **Everything else is procedural:** geometry, characters, textures (canvas-drawn), music, sound effects and UI. No image, audio, model or font files.
- **No TODOs, no placeholder text in shipped content, zero console errors.** Every scene, line and level described here ships.
- **Always emit the full file** at every milestone, never a diff.

**Priorities, in order.** When anything must be cut, cut from the bottom of this list.

1. Story and characters — they must feel like real people talking to each other.
2. Cinematic presentation — in-engine cutscenes, seamless transitions, deliberate camera work.
3. A rich, lived-in world — environmental storytelling in every room.
4. Gameplay feel — tense stealth, scrappy combat, a companion who helps.
5. Visual fidelity.

If you must trim, cut combat encounters or optional areas. Never cut or shorten a scripted scene or its dialogue.

### Runtime budget

Target total: **about 2 hours 50 minutes**, roughly 30% cutscene and 70% gameplay.

| Chapter | Gameplay (min) | Cutscenes (min) | Total (min) |
| --- | --- | --- | --- |
| Prologue — Launch Day | 6 | 7 | 13 |
| 1 — Onboarding | 16 | 9 | 25 |
| 2 — Cold Calling | 12 | 6 | 18 |
| 3 — Door to Door | 20 | 10 | 30 |
| 4 — The Dead Zone | 9 | 8 | 17 |
| 5 — Handling Objections | 8 | 5 | 13 |
| 6 — Team Building | 16 | 8 | 24 |
| 7 — The Close | 9 | 12 | 21 |
| Ending A or B | 2–6 | 6–8 | 8–12 |

Pacing rule: never more than 12 minutes of combat without a quiet scene, and never two long cutscenes back to back without at least 60 seconds of player control between them (a walk, a look-around, an optional conversation).

## 2. Creative direction

### The Naughty Dog standard

- **Cutscene and gameplay are one continuous film.** Cutscenes are rendered in-engine with the same characters and lighting as gameplay. They start from wherever the player is standing and blend back into control without a fade or loading screen.
- **Characters are the game.** Chloe talks, reacts, jokes, sulks, helps in fights and notices things. She has a life of her own on screen, not just in cutscenes.
- **Restraint.** Long silences, held shots, and no music under the heaviest moments. A look carries more than a speech.
- **Quiet between the loud.** Every chapter has at least one moment with no threat at all: a walk, a view, a conversation.
- **Environmental storytelling.** Every room tells what happened there: notes, abandoned belongings, barricades, graffiti, a table set for a dinner that never happened.
- **Minimal HUD, no waypoints.** The world guides the player through lighting, composition and companion lines.

### Tone rules

1. **The jokes live in the world, never in the grief.** Signs, slang, factions and props are Optus parody. Deaths, loss and the ending are played completely straight.
2. **Everyone is selling something.** Every scene should reveal what a character wants the other person to buy.
3. **Quiet beats loud.** The best scenes are two people in a vehicle at dusk.
4. **Violence is ugly and costs something.** Killing humans is never celebrated; characters react to it.
5. **Australian voices.** Dry, understated, laconic. "Mate", "bloody", "reckon", "arvo", "ute" — used naturally, never as caricature.

### The naming rule (enforce everywhere)

Only six characters have names: **Chase, Chloe, Wai, Zane, Aidan, Luke.** Everyone else is a job title (The Operator, Level 3, Tech Support, The Closer, The Regional, the Wholesaler, the Facilitator, the Chef, Soldier) or a nickname (Bub). Enemies call each other by titles too.

**Hard rule:** Chase never says "Chloe" out loud until scene 6.10. Before that he calls her "Trainee", "kid" or nothing. After that scene he never calls her "Trainee" again, and his combat barks switch from "kid" to "Chloe".

### The story in brief

Ten years ago, at the midnight launch of a new flagship phone, a global update called INFINITE pushed a feed so perfectly addictive that it rewired anyone who watched long enough. Chase, the top sales rep at Optus Redcliffe, sold 312 phones that night and gave one to his 13-year-old daughter, Bub. She died in his arms at a checkpoint before dawn.

Now Chase smuggles contraband in the Brisbane Quarantine Zone. The resistance hires him to deliver Chloe, an 18-year-old Optus trainee whose infection has stopped at 1 for three weeks. She's immune. The Operator promises Chloe the cure is "a scan and some blood". In Canberra, Chase discovers it will kill her and hides it. Chloe finds out in Perth. Unable to choose between the world and her own life, she asks Chase to decide. The player makes that choice.

**Core theme:** being connected is not the same as having a connection.

### World glossary

| Term | Meaning |
| --- | --- |
| The Update / INFINITE | The launch-night software update whose feed hijacks the brain. "Every network pushed it. Optus just pushed it fastest." |
| Tagged | Infected. An infected person grabs you and forces their screen in front of your eyes. |
| The Badge | A red dot that rises on the skin where you were grabbed, showing a climbing number like an app notification. At 99+ you turn. |
| Going 99 | Turning. |
| The Unread | The Landlines' name for Chloe: her Badge has read 1 for weeks. |
| Scrollers | Newly turned. Head down, swiping, muttering. Sprint at noise. |
| Lurkers | Weeks turned. Hide and ambush up close. "Lurkers never post." |
| Clickers | Over a year turned. Phone fused over the face, cracked glowing screen plates blooming from the eye sockets. Blind; hunt by the click of their own swiping. One grab kills. |
| Bloatware | Years turned. Armoured in fused devices, throws swollen lithium batteries ("spicy pillows") that burst into toxic fire. |
| The Group Chat | One unique mass of fused infected in the head office server hall. |
| Screen-rot | Glowing blue growth on walls in old infected buildings. It flickers with the Feed; looking at it infects. |
| Night Shift goggles | Red-lensed goggles that block the blue light. Chloe doesn't need them. |
| Black spots | Areas with no mobile coverage. The infected drift toward signal, so black spots are safe. Chase reads his old coverage map backwards: white is safe. |
| Bars | Currency: charged battery cells. "That'll cost you three bars." |
| COMMS | Commonwealth Office of Mobile and Media Security. The military government of the Quarantine Zones. Owning a smartphone means execution. Slogan: LOOK UP. STAY ALIVE. |
| The Landlines | The resistance, founded by ex-network engineers. Symbol: a coiled phone cord. Motto: "When you're lost in the static, listen for the dial tone." |
| The Door Knockers | Sydney raiders, once door-to-door energy sales crews. Ambush line: "Sorry to bother you, I'm not selling anything." |
| The Retreat | A leadership offsite at a ski lodge that never went home. Now a cannibal cult run like a company. |
| The Dead Zone | Luke's settlement at a hydro dam in a Snowy Mountains black spot. |
| The Yes Way | Chloe's dog-eared sales manual, "7 Steps to the Close". She reads one step on each chapter card. |
| The Exchange | The old central telephone exchange in Perth, the Landlines' base, sitting on the network core and the undersea cables. |
| The Patch | The cure: Chloe's immunity written into the network core and pushed to every device in the country, then the world. Reading it out of her brain kills her. |

## 3. Technical foundation

### Stack

- Import map: `"three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js"` and `"three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"`.
- Post-processing through `EffectComposer`: `RenderPass`, `UnrealBloomPass` (screen glow, fire, headlights), `BokehPass` (cutscene depth of field only), a custom `ShaderPass` for colour grade, vignette, film grain and chromatic fringe, then `OutputPass`. FXAA at the end.
- Web Audio API for all music and sound. Optional `speechSynthesis` for voiced lines (off by default).
- Gamepad API with the standard mapping.

### Architecture inside the one file

Organise the script into clearly commented modules, in this order:

1. `CONFIG` and `SETTINGS` (quality presets, defaults).
2. `CONTENT` — all writing and data, kept apart from code: `CONTENT.scenes` (cutscene scripts), `CONTENT.talks` (walk-and-talks, optional conversations), `CONTENT.barks`, `CONTENT.levels` (area layouts, spawns, triggers, checkpoints), `CONTENT.collectibles`, `CONTENT.chapters`.
3. `Engine` — renderer, composer, clock, resize, dynamic resolution.
4. `Input` — keyboard, mouse (pointer lock), gamepad; context actions.
5. `Audio` — `Score`, `Sfx`, `Voice`, mixer buses (music, sfx, voice, ambience), ducking under dialogue.
6. `Tex` — procedural canvas textures (concrete, brick, asphalt, rust, wood, moss, fabric, signage, posters, graffiti, paper).
7. `Build` — level-builder kit: rooms, streets, stores, houses, vegetation, water, terrain, props, instancing helpers.
8. `Chars` — character factory, skeleton, face rig, clothing, props (section 5).
9. `Anim` — procedural animation, locomotion, gestures, interaction anchors.
10. `AI` — companion, infected, humans, perception, navigation grid.
11. `Play` — player controller, camera, combat, stealth, crafting, inventory, health.
12. `Director` — cutscene runner, camera rigs, blends, title cards (section 4).
13. `Dialogue` — subtitles, talk queue, interruptions, barks.
14. `UI` — HUD, menus, backpack, journal, choice screen, credits.
15. `Save` — checkpoints and settings.
16. `Game` — chapter flow, area loading and unloading, triggers.

### World streaming

Each chapter is split into **areas** (listed per chapter). Build an area's geometry when the player approaches its entry and dispose of the previous area's geometry, materials and textures when they leave. Hide every load behind something diegetic, the Naughty Dog way: a cutscene, a slow squeeze through a gap, a heavy door Chase and Chloe push together, or a ladder climb.

### Performance targets

- 60 fps on a mid-range laptop at the High preset; never below 30 fps on Low.
- Dynamic resolution: drop render scale in 0.1 steps (minimum 0.6) when frame time exceeds 20 ms for a second.
- One shadow-casting directional or key light per area; everything else unshadowed.
- Instanced meshes for debris, grass, leaves, rubble, bottles, phones on the ground.
- Cap active AI at 12; freeze AI more than 60 m away.
- Reuse materials; generate each canvas texture once and cache it.

### Saving

- Save to `localStorage` inside `try/catch`; the game must run correctly if storage fails.
- Autosave at every checkpoint: chapter, area, checkpoint id, inventory, weapons, upgrades, collectibles found, settings, and whether the story has been finished.
- Checkpoints every 2–4 minutes of gameplay and immediately before every cutscene that follows combat.
- Main menu: Continue, New Game, Chapters (unlocked as reached), Settings, Extras (after finishing).

### Controls

| Action | Keyboard and mouse | Gamepad |
| --- | --- | --- |
| Move / look | WASD / mouse | Left stick / right stick |
| Sprint | Shift | L3 |
| Crouch (toggle) | C | B / Circle |
| Jump, vault, climb (context) | Space | A / Cross |
| Interact, pick up, talk | E | X / Square |
| Airplane Mode (listen) | Hold Q | Hold R1 |
| Aim / fire | Right mouse / left mouse | L2 / R2 |
| Reload | R | X / Square while aiming |
| Melee, struggle, shiv | F | Y / Triangle |
| Throw | G | R1 while aiming |
| Backpack (crafting; time keeps running) | Tab | Touchpad / Back |
| Weapons and items | 1–4, mouse wheel | D-pad |
| Swap shoulder | Middle mouse | R3 |
| Look toward the path (hint) | Hold T | Hold L3 + R3 |
| Skip cutscene | Hold Space for 1.5 s | Hold A for 1.5 s |
| Pause | Esc | Start |

### Accessibility and settings

Subtitles on by default (size S/M/L/XL, background opacity, speaker names and colours). Difficulty: Story, Normal, Hard. Aim assist toggle. Mouse sensitivity, invert Y, field of view 60–90. Camera shake, film grain and motion effects toggles. Quality preset Low/Medium/High. Separate volume sliders for master, music, effects, dialogue, ambience. Optional voiced lines via speech synthesis.

## 4. The cinematic system

### The Director

The `Director` plays scene scripts from `CONTENT.scenes`. A scene is a list of **shots**; each shot sets a camera and runs timed **actions** for characters, **lines** of dialogue, and **cues** for music, sound and fades. Build the format so that writing a new scene never needs new code. Use this shape (extend it as needed):

```js
CONTENT.scenes['1.10'] = {
  title: 'Close One That Matters', area: '1G', grade: 'flagship_night',
  letterbox: true, music: null, // silence under the heaviest scenes
  cast: { chase: 'mk_counter', chloe: 'mk_door', wai: 'mk_bench' },
  shots: [
    { cam: { type: 'dolly', from: [2,1.6,6], to: [1.2,1.5,4], look: 'wai.head', lens: 35, dur: 6 },
      focus: 'wai', actions: [ { t: 0, who: 'wai', do: 'sit', at: 'mk_bench' } ],
      lines: [ { who: 'chase', text: 'Wai. Get up. We\u2019re going back.', emote: 'tense' } ] },
    { cam: { type: 'ots', over: 'chase', on: 'wai', lens: 50 },
      lines: [ { who: 'wai', text: 'Chase.', emote: 'tender', pause: 1.2 } ],
      actions: [ { t: 0.8, who: 'wai', do: 'gesture', name: 'pull_collar' } ] },
  ],
  exit: { blend: 'gameplay', dur: 1.2 }
};
```

- **Camera types:** `static`, `dolly` (from/to with ease), `pan`, `crane`, `orbit` (around a target), `ots` (over-the-shoulder, auto-framed from two characters), `two_shot`, `close` (head and shoulders), `extreme_close` (eyes or hands), `pov`, `handheld` (adds low-frequency noise to any type), `follow` (tracks a walking character from behind or beside).
- **Lens:** focal length in mm converted to vertical FOV for a 36 mm sensor. Wide 24–28 mm for establishing shots, 35 mm for walking two-shots, 50–85 mm for emotional close-ups.
- **Focus:** Bokeh depth of field on the named target. Rack focus between two targets over a set time.
- **Actions:** `moveTo`, `walkTo` (with path), `runTo`, `turnTo`, `lookAt` (head and eyes), `emote` (face), `gesture` (from the gesture library), `sit`, `stand`, `kneel`, `lie`, `hold` / `give` / `take` / `drop` prop, `hug`, `carry`, `aim`, `fire`, `die`, `anim` (any named procedural animation).
- **Lines:** `who`, `text`, `emote`, optional `pause` before, optional `dur`. Default duration = max(1.6 s, words × 0.32 s + 0.6 s). Lines advance automatically; never require a button press.
- **Cues:** `music` (cue id or `stop` with fade), `sfx`, `amb` (ambience change), `fade` (to/from black or white), `cut` (hard cut), `title` (title or chapter card), `shake`, `slowmo`, `grade` (colour grade change).

### Camera language rules

1. **Letterbox** to 2.39:1 with bars that slide in over 0.6 s at the start of every cutscene and out as control returns.
2. **180-degree rule** for every dialogue exchange. Shot/reverse-shot uses OTS framing.
3. **Slow push-ins** (5–10% over the line) on important lines. No zooms.
4. **Long takes for the heaviest moments.** These scenes must play without a single cut in their marked section: P.7 (Bub's death), 1.10 (Wai's goodbye), 3.12 (the morning), 6.10 ("Chloe"), 7.9 (the phone), 7.14 (the ask), A.3 (the table), B.9 (the last question).
5. **Handheld** only under tension; locked-off or smooth dolly for calm and grief.
6. **Eyes lead.** Characters look at each other before they speak and away when lying. Chase looks away when he lies — except in the final scene of Ending B, where he holds eye contact.

### Seamless transitions

- **Into a cutscene:** begin from the current gameplay camera and blend to the first shot over 0.8 s, or hard-cut if the scene opens on a strong image. Move characters to their start marks off-screen or during the blend; never teleport on camera.
- **Out of a cutscene:** the last shot ends near the player's back. Blend to the gameplay camera over 1.2 s while the letterbox retracts and the HUD fades in. The player regains control mid-blend. No fade to black unless the script asks for one.
- **Mid-gameplay moments** (Chloe pointing something out, a door opening) use a soft camera nudge toward the subject without taking control.

### Title cards

Each chapter opens on black. A canvas-drawn page from The Yes Way fades up: worn off-white paper, a yellow header band reading THE YES WAY, the step number and text in a friendly corporate font, coffee rings, Chloe's pencil doodles in the margins. Chloe reads the step in subtitles (and voice, if enabled), then adds her own comment. Then the chapter title and season appear in thin white capitals. The Prologue and Chapter 6 have no manual page (see those chapters).

### Walk-and-talks

Conversations that play during gameplay while the player moves, triggered by volumes in `CONTENT.talks`.

- One talk plays at a time from a priority queue; barks never overlap a talk.
- If combat or a scripted event interrupts a talk, stop it cleanly at the end of the current line. When it's calm again, resume with a resume line ("Anyway — like I was saying…") and continue from the next line.
- If the player walks away from the speaker (over 12 m), pause the talk; resume when they're back.

### Optional conversations

At marked spots, an "E – Talk" prompt appears near the companion. These add character but can be missed. Each is 20–90 seconds, plays without letterbox, and lets the player keep looking around. Listed in section 17.

### Subtitles

Bottom centre, max two lines, 42 characters per line, white text with a soft shadow and an optional dark panel. Speaker names in their colour: Chase `#C9A94A`, Chloe `#FFD400`, Wai `#4FB3A9`, Zane `#7A8FB3`, Aidan `#F28C28`, Luke `#8FB38A`, Bub `#F5A3C7`, The Operator `#D9D9D9`, every other title character `#B0A8A0`. Off-screen speakers get their name in brackets.

### Faces and voices in scenes

Every line carries an `emote` that drives the face rig (section 5): neutral, smirk, smile, laugh, sad, crying, angry, afraid, shocked, tender, tense, ashamed, exhausted, lying. The mouth animates from syllables in the text. If voice is enabled, `speechSynthesis` speaks the line with the character's voice profile, and line timing follows the voice's end event.

### Skipping

Hold to skip (1.5 s ring fill). Skipping jumps to the scene's end state, applies all its side effects (items given, characters placed) and blends into gameplay. The first viewing of scenes 7.9 to 7.14 and both endings can't be skipped.

## 5. Characters

### How characters are built

- **Style:** stylised realism in low poly — believable proportions, flat-shaded clothing folds, expressive faces. Think a painted miniature, not a cartoon.
- **Skeleton:** hips, spine, chest, neck, head, jaw, and for each side clavicle, upper arm, forearm, hand (with a thumb and a mitten-style finger group that can curl), thigh, shin, foot. Body parts are shaped meshes (lathe and extruded capsules, tapered boxes) parented to bones.
- **Clothing:** separate meshes over the body with canvas textures: fabric weave, dirt, sweat stains, printed text (name badges, logos). Jackets get a subtle secondary sway.
- **Hair:** sculpted low-poly clumps with a strand-noise texture; ponytails and loose strands swing on a damped spring.
- **Faces:** a front face mesh with a live canvas texture (512 px) redrawn only when the expression changes or the character talks. Draw: eyes (whites, iris, pupil, catchlight, eyelids that blink every 2–6 s and narrow with emotion), eyebrows (inner and outer height), mouth (visemes: rest, M/B/P closed, A open, E wide, O round, F/V, plus smile/frown corners), nose shading, stubble or freckles, tear streaks and wet eyes for crying, grime and blood decals. Eyes track `lookAt` targets with small darts.
- **Emotes** map to eyebrow, eyelid, mouth-corner and head-tilt presets and blend over 0.25 s: neutral, smirk, smile, laugh, sad, crying, angry, afraid, shocked, tender, tense, ashamed, exhausted, lying (eyes slide away, tight smile).
- **Procedural animation:** idle breathing and weight shifts; walk, jog, sprint, crouch-walk, limp; ladder, ledge climb, vault, squeeze; aim and recoil; melee swings; takedowns; carry another character; drag; ride a horse; sit in vehicles. Gesture library: point, shrug, wave off, hand on shoulder, hug, fold arms, rub face, hands on hips, push glasses, pull collar, rub palm scar, click box cutter, wipe tears, cover mouth, kneel, CPR, hand over, hold hands, lean on railing, head on shoulder.
- **Interaction anchors:** paired animations (hug, carry, hand-over, boost up a ledge, pull up a ledge, grab and struggle) use shared anchor points so hands meet correctly.

### The cast

Faces and skin tones are open; give each character a distinct, grounded look. Silhouettes must read instantly at 30 m.

| Character | Age | Build and silhouette | Clothing and props | Voice profile (TTS pitch / rate) | Tics |
| --- | --- | --- | --- | --- | --- |
| **Chase** | 44 (34 in prologue) | 183 cm, broad, slightly stooped, heavy boots | Old Optus staff polo sun-faded from yellow to newspaper-cream, sleeves cut off; stained canvas work jacket; cargo pants; taped boots; Bub's beaded #1 DAD lanyard holding his staff ID ("CHASE — Senior Consultant — Ask me about upgrading!"); Bub's cracked phone in the chest pocket; laminated coverage map; revolver, sawn-off shotgun. Prologue: crisp yellow polo, clean-shaven, no lanyard yet. | 0.8 / 0.9 | Rubs the scar on his right palm with his thumb; answers questions with questions |
| **Chloe** | 18 | 160 cm, quick, backpack almost as big as her torso | Oversized, still-bright yellow Optus trainee polo under an army-green hoodie; rolled jeans; beaten sneakers; badge "CHLOE — TRAINEE — Still learning! Please be patient :)"; terry sweatband over the red Badge on her left forearm (a red dot with a white 1); The Yes Way manual in her back pocket; Ollie plush keyring on her backpack; stockroom box cutter. Winter: puffer jacket over everything, beanie, bow. Later: Aidan's digital pet on a cord. Freckles, messy ponytail, a nick through one eyebrow. | 1.25 / 1.1 | Clicks the box cutter when nervous; reads out signs; hums when bored |
| **Wai** | 45 | 172 cm, stocky, shaved head | Glasses taped at the bridge; navy Optus fleece vest over flannel; bum bag of battery cells; clipboard ledger; badge "WAI — Store Manager"; cricket bat wrapped in charging cable. Badge (infection) on his neck under the collar. | 0.95 / 1.0 | Pushes his glasses up; counts things under his breath |
| **Zane** | 28 | 188 cm, wiry, hollow-cheeked | Dead call-centre headset around his neck; denim jacket with a pale rectangle where a Door Knockers patch was torn off; fingerless gloves; hunting rifle | 0.85 / 1.0 | Touches the headset; always faces doorways |
| **Aidan** | 16 | 170 cm, skinny, all elbows | Mop of curly hair under a backwards cap; oversized faded Optus Sport hoodie; shorts over thermals; one sneaker held together with tape; knock-off digital pet clipped to a belt loop; slingshot | 1.15 / 1.15 | Hums an old ringtone when scared; bounces on his heels |
| **Luke** | 39 (29 in prologue) | 180 cm, softer build | Long hair tied back; clean-shaven; hand-knitted jumper; work boots; coiled-cord Landlines tattoo on his wrist; faded Optus YES cap (the same one from the prologue); scoped rifle | 0.9 / 0.95 | Adjusts his cap; puts a hand on people's shoulders |
| **Bub** | 13 | Small, gangly | Braces, hair in two buns, her dad's old Rep of the Year T-shirt as pyjamas, fluffy socks | 1.35 / 1.1 | Chews her sleeve |
| **The Operator** | 50s | Tall, very upright | Grey bob; cardigan over body armour; vintage switchboard headset with a coiled cord around her neck; revolver. Chapter 1: blood through the cardigan. | 0.95 / 0.9 | Winds the headset cord around a finger |
| **Level 3** | 40s | Medium, tired shoulders | Blood-spotted scrubs over a tech-support polo; head torch | 0.9 / 0.95 | Cleans his hands with a rag |
| **Tech Support** | 50s | Tall, gaunt | Big grey beard; Night Shift goggles pushed up on his forehead; tool belt of screwdrivers; faded technician hi-vis; shotgun; a hammer he smashes phones with | 0.75 / 1.05 | Talks to himself; taps things to check they're solid |
| **The Closer** | 40s | Heavy, big grin | Sweat-stained business shirt, tie as a headband, lanyard, clipboard, flare gun, megaphone | 0.85 / 1.2 | Never stops smiling |
| **The Regional** | 50s | Average height, soft, neat | Pressed chinos, collared shirt, fleece vest embroidered REGIONAL LEADERSHIP OFFSITE, reading glasses on a cord, lanyard key card, fire axe | 0.85 / 0.85 | Speaks softly; steeples his fingers |

Minor roles (the Wholesaler, Soldier, the Facilitator, the Chef, Luke's wife, Landlines members, Dead Zone townspeople) are built from a shared kit with varied proportions, clothes and colours. Never reuse a named character's face on an extra.

### Companion AI (Chloe, and Wai, Zane, Aidan, Luke when present)

- **Follow** 3–5 m behind or beside the player; take the inside of corners; never stand in doorways or the player's line of fire. Teleport to a hidden spot near the player if more than 25 m behind and off-screen.
- **Stealth:** crouch when the player crouches; move between cover; hold still near enemies. Companions are invisible to enemies during stealth (unless a scene scripts otherwise) so they can never break it.
- **Combat:** Chloe throws bricks and bottles to stun, calls out enemies ("Chase, left!"), and stabs anything that grabs Chase (a scripted rescue with her box cutter, at most once per 60 s). After scene 4.7 she also shoots her pistol, rarely and badly at first. Other companions fight with their own weapons.
- **Help:** she finds and hands over supplies ("Got you some bars!"), points out paths, and boosts or pulls Chase at two-person ledges.
- **Can't swim:** Chloe needs pallets, planks or rafts at water sections. These are traversal puzzles.
- **Life:** when idle she looks around, reads signs aloud, sits, hums, pokes at things, and makes remarks tied to her surroundings (section 17). She reacts to what just happened: quiet after deaths, jumpy after scares, giddy after good news.
- **Chloe as player (Chapter 6):** same controller with her stats: 60% health, box cutter instead of shiv (unbreakable, stealth kills only), bow and pistol, no shotgun, can't fight Clickers head-on.

## 6. Gameplay systems

### Camera and movement

- Third-person over-the-shoulder camera, right shoulder by default, 2.2 m back, 0.45 m to the side. Pulls in to 1.4 m when aiming, pushes out in open spaces, and collides smoothly with walls.
- Weighty movement: acceleration and deceleration, not instant. Chase turns in a small arc when sprinting.
- Context traversal on Space: vault low cover, climb ledges up to 2 m, ladders, squeeze through gaps (slow, used to hide area loads), drop down. Chase boosts Chloe to high ledges; she drops a ladder or kicks down a plank.
- Traversal puzzles: carry and place planks and ladders, push pallets through water for Chloe, restart generators to open shutters, pull a dumpster to reach a fire escape.

### Stealth

- **Noise:** sprinting is loud (12 m), walking is medium (6 m), crouch-walking is quiet (2 m). Gunshots 40 m. Breaking glass 15 m. Thrown bottles and bricks make noise where they land.
- **Sight:** humans and Scrollers see in a 100° cone to 18 m, reduced in darkness and tall grass. Detection builds over time (faster when closer and when the player moves); a subtle white arc at the screen edge shows which side it's building from.
- **Airplane Mode (hold Q):** the listen mode. The world desaturates, sound goes muffled, and anything making noise within 20 m glows as a white silhouette through walls. Chase moves slowly while it's held. HUD label: AIRPLANE MODE.
- **Stealth takedowns** from behind: choke humans (slow, quiet) or shiv them (fast). Clickers need a SIM shiv.

### Infected

| Type | Senses | Behaviour | Health and kills | Signature sound |
| --- | --- | --- | --- | --- |
| Scroller | Sight and sound | Wander head-down, swiping; mutter; sprint when alerted; grab and try to force a screen into your face (struggle: mash F) | 2 melee hits or 1 headshot | Swipes, whispers: "just one more", "wait, watch this", "did you see this", "refresh", "lol" |
| Lurker | Sound, short sight | Crouch behind cover with a dimmed screen; burst out within 4 m; retreat and re-hide | 3 melee hits or 1 headshot | Almost silent, a slow scroll sound, a sharp inhale before attacking |
| Clicker | Sound only (blind) | Echolocate with a click every 0.6–1.2 s; walk toward noises; a grab is instant death unless Chase has a SIM shiv (the shiv breaks free and kills) | Can't be punched; 2 headshots, 1 shotgun blast at close range, fire, or a shiv | A haptic click: short filtered noise burst plus a resonant ping at about 2.5 kHz, with a throat rattle |
| Bloatware | Sound only | Slow; lob spicy pillows in an arc (4 s toxic fire pool); grab is instant death; can't be stealth-killed | Very tanky; weak to fire | Wet crackle of batteries, a rising electronic whine before a throw |
| The Group Chat | Special (boss) | See Chapter 3 | See Chapter 3 | Dozens of feeds playing in sync |

Infected look: stooped, phone hands raised to the face, thumbs twitching. Scrollers still look human with red wet eyes and raw thumbs. Clickers have the phone fused over the face, with cracked screen plates blooming out of the eye sockets and glowing blue. Bloatware are armoured in dozens of fused phones, tablets and power banks, with charging cables trailing like roots.

### Humans

- Patrol routes, investigate noises, flank, take cover, call to each other, and search last-known positions. They retreat when badly outnumbered, and some plead when wounded or cornered.
- Every human faction has its own bark set (section 17). Enemies address each other by titles and slang, never names.
- Factions and loadouts: COMMS soldiers (rifles, gas masks, hi-vis, scanners), the Wholesaler's smugglers (pistols, pipes), Door Knockers (pistols, rifles, machetes, clipboards clipped to belts), Retreat members (bows, rifles, axes, lanyards), Canberra raiders (who turn out to be Retreat hunters), bandits at the dam, Landlines (rifles, in Ending B only).

### Weapons

| Weapon | Found | Notes |
| --- | --- | --- |
| Revolver | Start of Chapter 1 | 6 rounds, slow reload, reliable |
| Sawn-off shotgun | Chapter 1, the Wholesaler's warehouse | 2 shells, devastating up close |
| Hunting rifle | Chapter 3, after Zane's death | 5 rounds, scope |
| Pistol (Chloe's) | Chapter 3; Chase takes it, returns it in scene 4.7 | Chloe's weapon; Chase never uses it |
| Bow | Chapter 6 (Chloe) | Silent; arrows can be recovered |
| Melee | Pipes, planks, cricket bats, machetes found in the world | Breaks after 4–6 hits; upgrade with tape and a SIM-ejector blade for one-hit kills |

Ammo is scarce. On Normal the player should usually have 3–8 revolver rounds and 1–4 shells. Aim sway increases when Chase is hurt or has just sprinted.

### Crafting (Backpack, Tab)

The world keeps moving while the backpack is open. Crafting takes 1–3 s with an animation. Ingredients: cloth, alcohol, tape, SIM ejectors, swollen batteries, old Nokias, scrap.

| Item | Recipe | Use |
| --- | --- | --- |
| First Aid | cloth + alcohol | Heals 60%; 3 s to apply |
| SIM Shiv | SIM ejector + tape | Kill a Clicker silently, or break free from a Clicker grab |
| Spicy Pillow | swollen battery + cloth | Fire bomb |
| Ringtone Bomb | old Nokia + tape + scrap | Throw: rings at full volume for 3 s, drawing infected, then explodes |
| Vape Cloud | alcohol + scrap | Smoke screen that blinds humans for 6 s |
| Melee upgrade | tape + SIM ejector | Adds a blade to the held melee weapon |

### Upgrades

- **Bars** (charged battery cells) are found in the world and spent at **workbenches** on weapon upgrades: capacity, reload speed, damage, sway. About 3 workbenches per chapter from Chapter 2.
- **Sales Training Modules** (12 hidden pamphlets) unlock player skills: Airplane Mode range, crafting speed, max health, shiv durability, healing speed, steadier aim.

### Health, death and difficulty

- Health is shown as a phone-battery icon bottom-right, draining in segments. It doesn't regenerate above the current segment.
- Death: a short non-graphic cut (camera tilts away, a final click or gunshot), fade to black, reload the last checkpoint in under 3 s.
- Story difficulty doubles supplies, halves enemy damage and enables aim assist. Hard halves supplies and makes Clickers hear better.

### HUD

Minimal and diegetic. It fades out when nothing is happening. Bottom-right: health battery, current weapon and ammo, selected throwable. A small prompt when an interaction is available. No minimap, no objective markers, no hit markers beyond a subtle crosshair flick. Hold T to nudge the camera toward the way forward.

## 7. Art direction and audio

### Look

- **Nature has taken back Australia.** Vines over shopfronts, moss on escalators, gum trees through car park floors, grass cracking the highways, possums and birds in the rafters. Ten years of rain and sun on everything.
- **Lighting sells it.** Warm key light from low sun, cool fill, fake god rays (additive planes with soft noise) through broken roofs, dust motes in beams, bloom on screens and fire.
- **Retail ghosts everywhere.** Faded YES signage, promo banners ("MIDNIGHT LAUNCH — BE FIRST", "UPGRADE YOUR LIFE"), phone display stands, queue barriers, name badges on the floor, walls of smashed phones outside checkpoints.
- **Posters and graffiti** drawn procedurally: COMMS posters (LOOK UP. STAY ALIVE. / SEE A SCREEN? REPORT A SCREEN.), Landlines coiled-cord symbols marking safe routes, SAY YES billboards with YES crossed out, tallies on walls, "GONE 99 — DON'T OPEN" sprayed on doors.
- **Screen-rot** is a blue emissive growth texture (animated flicker, faint scrolling pixel shapes) on walls and ceilings. Its blue glow is the only saturated blue in most scenes.
- **Night Shift view:** red tint, darkened edges, scratches and a faint fog of breath on the lens.

### Colour script

| Colour | Meaning | Where it lives |
| --- | --- | --- |
| Faded yellow | The old world, the brand bleached out | Chase's polo, dead signage |
| Clean yellow | Hope, the future | Chloe's trainee polo only — the eye should always find her first |
| Feed blue | Infection, temptation | Screens, screen-rot, Clicker faces |
| Night Shift red | Safety | Goggle lenses, the Dead Zone's red lamps |
| Badge red | Danger and love at once | Every Badge, Bub's undelivered message |

### Grade and weather per chapter

| Chapter | Grade | Weather and light |
| --- | --- | --- |
| Prologue | Sodium orange streetlights against phone blue; clean and modern | Humid spring night, then fire |
| 1 Onboarding | Humid green-grey, heavy blacks | Summer storms, rain, wet reflections; dawn at the end |
| 2 Cold Calling | Dry gold, dusty | Hot inland afternoon, cicadas, heat shimmer |
| 3 Door to Door | Bleached summer haze; head office cold and fluorescent-blue | Late summer, harsh sun; night in the suburbs |
| 4 The Dead Zone | Warm amber and red leaves | Autumn, mist on the dam, woodsmoke |
| 5 Handling Objections | Frost blue, pale | Late autumn frost, first snow at the end |
| 6 Team Building | White and steel blue, then fire orange | Snowfall, blizzard, burning lodge |
| 7 The Close | Saturated ochre desert and deep ocean blue; Perth at night in sodium and emergency red | Clear spring skies, wind on the cliffs, flooded underpass |
| Endings | Dawn gold (A) / pale morning green (B) | Spring |

### Score

The score is sparse, mostly a single plucked guitar in the style of a ronroco, synthesised with Karplus–Strong (a noise burst into a tuned feedback delay with a low-pass in the loop), a long hall reverb (convolution with a generated decaying-noise impulse), and occasional low cello-like drones (filtered sawtooth). Silence is the default.

- **Main theme, "The Last of Yes":** in D minor, 72 bpm, played slowly with space between phrases. Phrase A: A3, D4, E4, F4 (hold), E4, D4, C4, A3 (hold). Phrase B: F4, G4, A4 (hold), G4, F4, E4, D4 (hold two bars). Pluck each note with slight timing drift and a soft strum on held notes.
- **Chloe's motif:** the first four notes of phrase B, played higher and brighter.
- **Bub's motif:** the ringtone-like figure D5, A4, D5, E5, F5, played on a thin sine "phone" tone. It returns only on Bub's phone in 7.9.

| Cue | Where | Music |
| --- | --- | --- |
| Title | Main menu | Full theme, once, then ambience |
| Ten years later | End of P.7 | Theme phrase A over black, the first music in the game |
| Wai | After 1.10 | A single low drone, then phrase A |
| The brothers | After 3.12 | Silence, then Chloe's motif alone |
| Film night | 4.5 | Warm theme on guitar with a soft second part |
| Chloe | 6.10, as they walk into the snow | Full theme |
| Whales | 7.3 | Chloe's motif rising into phrase B |
| The phone | 7.9 | Bub's motif on the phone speaker only |
| The choice | 7.14 | No music. A barely audible drone that rises over minutes |
| Endings | A.5 and B.9 | Theme on piano (synthesised), then credits |
| Tension | Stealth and combat | Low pulsing drone and scraped strings, only when enemies are alert |

### Sound design

- Build everything from oscillators, filtered noise, envelopes and convolution: footsteps per surface (concrete, gravel, grass, wood, water, snow, metal), gunshots with distance filtering, reloads, bottles breaking, doors, rain, wind, cicadas, magpies, kookaburras at dawn, the dam's water, fire, snow crunch, whale song (slow glides of filtered sine clusters).
- **The click** is the game's signature sound; tune it until it's unsettling.
- **Scroller whispers:** if voice is enabled, very quiet speech synthesis with a low rate and pitch, heavily low-passed; otherwise filtered noise murmurs.
- **Ambience changes by area** and ducks under dialogue. Interiors get short reverbs; big halls get long ones.
- **Silence is a tool.** In P.7, 1.10, 3.12, 7.9 and 7.14 drop all music and most ambience.

## 8. Prologue — Launch Day (13 min)

Ten years before the main story. No manual card. The player controls Bub, then Chase. This chapter must make the player love Bub in six minutes.

**How to read the scripts (all chapters):** each scene has a type (Cutscene, Gameplay, or Gameplay with talk), a length and an area. Numbered beats give the camera and action; dialogue sits under each beat. Words in *italics* are delivery notes and map to emotes. Play every line exactly as written.

### Areas

| Area | Place | What's there |
| --- | --- | --- |
| P1 | Optus Redcliffe store and car park | A small suburban store at 11:40 pm. Queue of about 40 people out the door, phones glowing. Banner: MIDNIGHT LAUNCH — BE FIRST. Two counters, demo tables, a leaderboard whiteboard reading "CHASE 299 / LUKE 187". |
| P2 | Bub's house, Redcliffe | A small brick house near the water. Bub's bedroom (posters, fairy lights, school bag), hallway with family photos, lounge with TV, kitchen with the lanyard gift on the bench. Neighbour's house visible through the window. |
| P3 | Redcliffe streets by car | Back-seat ride: the esplanade, the jetty, a roundabout, a servo, the approach to the Houghton Highway bridge. |
| P4 | Burning servo forecourt and bridge approach | On foot, carrying Bub. Fire, crashed cars, Scrollers. |
| P5 | Bridge checkpoint | South end of the long bridge over black water. Floodlights, a COMMS van, two soldiers in gas masks and hi-vis. |

### P.1 — Midnight Launch · Cutscene · 2 min · P1

1. Black. Crowd murmur, a phone notification chime repeating somewhere. White text fades in: **REDCLIFFE, QUEENSLAND. LAUNCH NIGHT.**
2. Wide exterior, 24 mm, crane down from the glowing store sign to the queue. Faces lit blue by phones. A kid on a dad's shoulders. A security guard (title) counts people with a clicker counter — the first click of the game, innocent.
3. Inside, dolly along the counter to Chase, 34, clean-shaven, crisp yellow polo, name badge. He's closing a sale with a pensioner (title: Customer), all charm.
   - **CUSTOMER:** And it does the... the video calls?
   - **CHASE:** *warm* Your grandkids'll be in your hand, mate. Every night if you want.
   - **CUSTOMER:** They don't call now.
   - **CHASE:** *smirk* Then we'll get you a case in their favourite colour. Guilt 'em into it.
4. The customer laughs and signs. Chase turns to the whiteboard and changes 299 to 300. Two-shot with Luke at the next counter, 29, cap on backwards.
   - **LUKE:** Three hundred.
   - **CHASE:** Three-twelve by midnight.
   - **LUKE:** It's eleven-forty.
   - **CHASE:** Then stop talking to me.
5. The store phone rings. Luke answers, rolls his eyes, holds it out. Close on Chase, phone to ear. Wai's voice comes through slightly tinny.
   - **WAI (phone):** Heard a rumour you're chasing the record.
   - **CHASE:** Heard a rumour you're not.
   - **WAI (phone):** Queen Street's on two-sixty. We've got the foot traffic, mate. You've got pensioners and seagulls.
   - **CHASE:** Pensioners buy phones.
   - **WAI (phone):** Pensioners buy one phone. Every five years.
   - **CHASE:** Then I'll sell 'em two.
   - **WAI (phone):** *laughing* Three-twelve and I'll believe it. Head office'll want a photo.
   - **CHASE:** Get your camera ready.
6. Chase hangs up. His own phone buzzes: a text from BUB — "wat time u home". Insert shot on his thumbs typing: "after midnight. go to bed. love u".
   - **LUKE:** *leaning over* You gave her one, didn't you. The pre-release.
   - **CHASE:** Early birthday.
   - **LUKE:** Store'll crucify you.
   - **CHASE:** Store's not gonna know.
7. From the back office, the Store Manager (title, never seen) shouts. Chase straightens his badge and turns to the next customer with a smile. Hard cut to P.2.
   - **STORE MANAGER (off):** Chase! Customer!

### P.2 — Bub · Gameplay · 4 min · P2

The player controls Bub. No combat, no HUD. She walks slowly in fluffy socks. Clock on the oven: 11:44.

1. **Start** on Bub's bed. The new phone glows on the duvet with a notification: "INFINITE is ready. Installs at 12:00. A feed that finally understands you." She sits up. Prompt: E – Get up.
2. **Explore freely.** Each interaction plays a short line from Bub:
   - Poster of a band on the wall: **BUB:** Dad says they're "a lot of noise." He sings them in the car.
   - Photo in the hallway, Chase holding her as a baby in a store polo: **BUB:** He was already working. Even then.
   - Fridge photo, Bub and Chase pulling faces: **BUB:** Worst photo ever. Best photo ever.
   - School report on the fridge with "SEE ME" in red: **BUB:** *quick* Not looking at that.
   - Kitchen bench, a small box with a beaded lanyard spelling #1 DAD and a note in her handwriting: "For Rep of the Year (again). Don't be a sook about it. — Bub". **BUB:** Took me four hours. The D kept falling off.
   - The TV (turn it on): a late-night newsreader. **NEWSREADER (TV):** …with the INFINITE update rolling out nationally at midnight. The network says it's the biggest update in the country's history, promising what developers call "a feed that finally understands you."
   - The front window: next door, the Neighbour (title) stands on his lawn in his dressing gown, staring at his phone, not moving. **BUB:** Mr… um. Neighbour. It's midnight, mate.
3. **The text.** At 11:58 Bub sits on the couch and opens messages to "Dad (with a trophy icon)". Any key types the next letter of her message on screen, at her pace: "proud of u dad. dont sell too m—".
4. The phone rings mid-word: DAD calling. Prompt: E – Answer. Blend to P.3.

### P.3 — The Call · Cutscene · 1.5 min · P1 and P2 intercut

1. Store, 11:59. The customer at Chase's counter has stopped mid-sentence. Close on her eyes: wet, unblinking. Her thumb swipes. *Click.* Swipe. *Click.* The demo phones on every table glow with the same scrolling feed.
2. Handheld, slowly turning: the queue outside has gone silent. Forty faces lit blue, thumbs moving together. A man grabs the man beside him and forces his screen in front of his eyes. The second man stops struggling.
3. Close on Chase, the phone already at his ear. Intercut with Bub on the couch.
   - **BUB:** *cheerful* Did you break it? Did you break the record?
   - **CHASE:** Bub. Listen to me. Turn your phone off.
   - **BUB:** What? I'm literally texting y—
   - **CHASE:** Turn it off. Right now. Don't look at anything on it. Don't open anything.
   - **BUB:** Dad, you're being weird.
   - **CHASE:** *breaking a little* Bub. I need you to do this for me. Please.
   - **BUB:** *small* …Okay. Okay. Love you. Turning it off.
4. Insert on Bub's thumb: she taps send on the half-finished message, then holds the power button. The screen shows "Sending…" and goes black. We never see whether it sent.
5. Store. Chase lowers his phone. His own screen shows "INFINITE — Installing… 42%". He looks at it one beat too long, then slams it face-down into the counter and cracks it. Luke stares.
   - **LUKE:** Chase—
   - **CHASE:** Get the car.

### P.4 — Home · Gameplay into cutscene · 1.5 min · P2

1. Bub (playable) in the dark lounge. The TV now shows the newsreader scrolling on her own phone, on air, not speaking. Bub turns it off without being prompted.
2. A knock. Then another. The Neighbour's silhouette at the frosted door glass, a phone glowing against it. **BUB:** *whisper* Go away. Go away.
3. Glass shatters. Cutscene: the Neighbour stumbles in, phone held out at arm's length toward her face, muttering "wait, watch this, wait". Headlights sweep the room. Chase crashes in and tackles him through the coffee table. Luke drags Bub back.
4. Chase gets up, breathing hard, blood on his knuckles. He takes Bub's face in his hands.
   - **CHASE:** You okay? Look at me. You okay?
   - **BUB:** *shaking* He was trying to show me something.
   - **CHASE:** Don't look at anyone's hands. Anyone's. Car. Now.

### P.5 — The Drive · Gameplay (camera only) · 2 min · P3

Back seat, Bub's point of view. The player can only look around. Luke drives, Chase in the passenger seat twisted round to watch her.

1. Passing the esplanade: people standing in the road with glowing phones; a jogger stopped mid-stride; the jetty lined with blue faces over the black water.
   - **BUB:** Dad, what's wrong with them?
   - **CHASE:** Don't look.
2. A woman slaps her phone against Bub's window, screen first. The camera is forced away from it toward Chase for a second.
   - **LUKE:** *fiddling with the radio* Every station's the same.
   - **RADIO DJ:** *laughing, on and on* — no, wait, watch this, wait, this one, ha, wait—
   - **CHASE:** Turn it off.
3. Quiet. Bub looks at the back of her dad's head.
   - **BUB:** Is it the update? Is it the phones?
   - **CHASE:** …
   - **BUB:** *not accusing, just working it out* Dad. You sold them all phones.
4. Chase can't answer. A truck runs the roundabout. Slow motion for 0.5 s, then impact, glass, black.

### P.6 — On Foot · Gameplay · 2 min · P4

1. The player is now Chase, carrying Bub (her ankle is broken). Slow run only. Luke leads with a torch and clears the way with a tyre iron.
   - **BUB:** *crying* Dad, my leg—
   - **CHASE:** I've got you. I've got you. Keep your eyes on me.
2. Run through a burning servo forecourt. Scrollers sprint out of the smoke. Luke fights; the player can only move.
3. A Scroller tackles them. Cutscene: Bub is torn from Chase's arms. The Scroller pins her and forces its screen over her eyes for two seconds before Chase rips it off and beats it until Luke pulls him away.
4. Chase lifts Bub. On her wrist, a red dot rises through the skin like a notification. A white **1**. Then **4**. Chase covers it with his hand.
   - **BUB:** What is that? Dad, what is that?
   - **CHASE:** It's nothing. Bridge. Come on.

### P.7 — The Bridge · Cutscene · 2.5 min · P5

No music. Only water, distant sirens, and far away, thousands of clicks. From beat 5 onward: **one continuous take, no cuts.**

1. Wide, 28 mm: the long bridge stretching into black. A floodlit checkpoint: a COMMS van, a stencilled sign reading ROAD CLOSED — SCREEN CHECK. Two soldiers in gas masks and hi-vis. Chase limps toward the light carrying Bub; Luke beside him with his hands up.
   - **SOLDIER:** Stop! Stop right there! Hands where I can see them!
   - **CHASE:** My daughter's hurt. We need a hospital.
   - **SOLDIER:** *into radio* Three civilians at the south checkpoint. …Copy. *to Chase* Hold her out. Arm.
2. The soldier raises a scanner gun at Bub's face. It beeps and shows a number. Close on the screen: **BADGE: 14**.
   - **SOLDIER:** She's tagged.
   - **CHASE:** She's not — she's fine, she's talking, look at her—
   - **SOLDIER:** *radio* Sir, the girl's tagged. …Sir, they're just— *listens* …Copy.
3. He lowers the radio and raises his rifle. His voice is young under the mask.
   - **SOLDIER:** I'm sorry.
   - **LUKE:** Mate. Mate, don't—
4. Chase turns his body to shield her and runs for the railing. Two shots. Chase goes down hard. Luke tackles the soldier, wrestles the rifle, and a third shot ends it. Luke stands frozen over the body.
5. **Continuous take begins.** Camera low on the wet road. Chase crawls to Bub, who lies in the headlight glare. He pulls her into his lap. Slow push-in over ninety seconds.
   - **BUB:** *small* Dad…
   - **CHASE:** Hey. Hey. Bub. Look at me. You're alright. Look at me.
   - **BUB:** It itches.
   - **CHASE:** I know. I know. Just look at me. Keep looking at me.
   - **BUB:** *a tiny smile* Did you get it? Three-twelve?
   - **CHASE:** *crying* Yeah. Yeah, I got it.
   - **BUB:** Told you.
6. Her eyes lose focus. Her hand drops from his collar. On her wrist the Badge still reads 14; it will never change now.
   - **CHASE:** Bub. *pause 2 s* Bub, look at me. *pause 2 s* …Please.
7. Hold on Chase's face for eight seconds. Luke's hand enters the frame onto his shoulder. Chase doesn't react.
8. Cut to black. Five seconds of silence. Then the first music in the game: the theme, phrase A, on the lone guitar. Title fades in: **THE LAST OF YES.** Hold. Then: **TEN YEARS LATER.**

## 9. Chapter 1 — Onboarding (Summer, 25 min)

**Card:** Step 1. "Greet the customer. First impressions last!" **CHLOE (V.O.):** *dry* Great.

Purpose: establish the world, Chase and Wai's partnership, meet Chloe, teach stealth, Airplane Mode, crafting basics and the Clicker rules. Ends with Wai's sacrifice.

### Areas

| Area | Place | What's there |
| --- | --- | --- |
| 1A | Chase's room | A narrow room above a dead laundromat in the Brisbane Quarantine Zone. Mattress, camp stove, a calendar with no dates crossed off, rain on the window. |
| 1B | QZ streets | The walled CBD: ration queue outside an old Optus store now signed RATIONS — PLEASE TAKE A NUMBER; a market of tarps; COMMS patrols; loudspeakers; execution posters; a wall of smashed phones at a checkpoint. Humid, grey, steaming after rain. |
| 1C | The Wholesaler's warehouse | A gutted electronics distribution warehouse by the river. Crates, forklifts, a mezzanine office. Five smugglers. Stealth tutorial. |
| 1D | Landlines hideout | Basement of an old office building. Radio sets, maps of Australia strung with cord, a coiled-cord symbol painted on the wall. |
| 1E | Under the wall | A drainage tunnel under the QZ wall into the dark city outside; exit into a flooded street where a COMMS patrol waits. |
| 1F | The drowned tower | A tilted office tower, lower floors flooded, upper floors glowing with screen-rot. First Autoplay zone, first Clickers, Night Shift goggles. |
| 1G | Queen Street Mall and the flagship | The overgrown mall at dawn: fig roots through tiles, Scrollers in the food court, and the old two-storey Optus flagship with its Store of the Year plaque. |
| 1H | Stockroom, arcade, rooftop | Escape route: the flagship stockroom, a loading dock, a heritage arcade, a rooftop at sunrise. |

### 1.1 — Ten Years Later · Cutscene · 1.5 min · 1A

1. Dawn, rain. Close on Chase's eyes opening, 44 now, grey stubble. Hold.
2. He sits up on the mattress, reaches into the jacket on the chair and takes out a cracked phone. He doesn't turn it on. His thumb runs across the dark glass. Insert: the beaded #1 DAD lanyard around his neck, his old staff ID on the end. He puts the phone back and zips the pocket.
3. A knock: three, a pause, one. Wai lets himself in — 45, bruised cheek, glasses taped.
   - **WAI:** Morning, sunshine.
   - **CHASE:** You look like shit.
   - **WAI:** I've been robbed, is what I've been.
   - **CHASE:** How much?
   - **WAI:** All of it. Radios, cells, the flip phones. Forty bars of stock.
   - **CHASE:** Who?
   - **WAI:** The Wholesaler.
   - **CHASE:** *standing, pulling on boots* He owes us.
   - **WAI:** He did. Now he owes us everything plus a black eye. *pushes glasses up* Word is he's been selling to the Landlines.
   - **CHASE:** Then he's dumber than he looks.
   - **WAI:** Get your boots on. We're doing a stock-take.
4. Blend to gameplay as Chase follows Wai out the door.

### 1.2 — The QZ · Gameplay with talk · 4 min · 1B

A calm walk through the Quarantine Zone. Wai leads. The world does the storytelling.

1. **Ration queue** outside the old Optus store. A COMMS loudspeaker loops: "Look up. Stay alive. Report all screens."
   - **WAI:** You eat?
   - **CHASE:** Yesterday.
   - **WAI:** Growing boy. *hands him a ration bar* Here.
2. **Plant:** across the street, a girl in a bright yellow trainee polo is hustled into an alley by two people in hooded raincoats. The camera nudges toward her for one second. Neither man comments. (It's Chloe; the player learns later.)
3. **Checkpoint:** a wall of smashed phones glued into the concrete like a mosaic. A soldier scans a queue of civilians' eyes one by one.
4. **Execution, off-screen.** Behind a truck, a man is dragged out holding a phone. The crowd turns away. One shot. The crowd flinches and keeps walking.
   - **WAI:** *quiet* Third this week.
   - **CHASE:** Don't look.
   - **WAI:** You say that like it fixes anything.
5. **Landlines graffiti:** a coiled phone cord sprayed over a COMMS poster, and under it, "LISTEN FOR THE DIAL TONE".
   - **WAI:** They put a speaker on the wall last night. Some woman's voice. "When you're lost in the static, listen for the dial tone."
   - **CHASE:** Catchy.
   - **WAI:** That's what you used to say about our jingles.
   - **CHASE:** Our jingles were catchy.
   - **WAI:** *grinning* "Say yes to the rest." God. I still hum it in the shower.
6. Optional conversation near the market (section 17). Then a guard at a side gate takes a bar from Wai and looks away. Squeeze through into 1C.

### 1.3 — Stock-Take · Gameplay · 5 min · 1C

Stealth tutorial through the warehouse: crouch, cover, throw a bottle, choke takedown, Airplane Mode (Wai teaches it: "Hold still. Listen. You can hear 'em breathing."). Pick up the sawn-off shotgun in a crate. Wai fights alongside with his cricket bat. Ends at the mezzanine office.

### 1.4 — The Wholesaler · Cutscene · 1.5 min · 1C

1. The Wholesaler (title), a sweaty man in a Hawaiian shirt, backs against his desk with his hands up, smiling hard.
   - **WHOLESALER:** Gentlemen! Valued customers.
   - **WAI:** Where's our stock?
   - **WHOLESALER:** Moved. Sold. You know how it is — high demand, low supply.
   - **CHASE:** Who?
   - **WHOLESALER:** The Landlines. I had no choice, they had guns—
   - **WAI:** We have guns.
   - **WHOLESALER:** They had *more* guns. Look — I can do you a discount on—
2. Wai shoots him. Chase looks at Wai. Wai shrugs.
   - **WAI:** What? He was pitching.
3. A woman's voice from the stairwell. The Operator steps out, pale, one hand pressed to a bloody patch on her cardigan, a revolver in the other. A switchboard headset hangs around her neck.
   - **OPERATOR:** Your stock's in a Landlines cache outside the wall. I can have it back to you. Doubled.
   - **CHASE:** And you are?
   - **OPERATOR:** Someone who needs a delivery.
   - **WAI:** We're not couriers.
   - **OPERATOR:** You're smugglers. It's the same job with worse manners.
   - **CHASE:** What's the package?
   - **OPERATOR:** Come and see.

### 1.5 — The Package · Cutscene · 2.5 min · 1D

1. Landlines basement. Radios crackle. On a crate under a bare bulb sits Chloe, reading a dog-eared manual, clicking her box cutter open and shut. She looks up.
   - **CHLOE:** Oh. You're the smuggler.
   - **CHASE:** *to the Operator* No.
   - **OPERATOR:** You haven't heard the offer.
   - **CHASE:** It's a kid.
   - **CHLOE:** I'm eighteen.
   - **CHASE:** It's a kid with a box cutter.
   - **CHLOE:** *clicks it shut, stands* Trainee. Ration depot, Albert Street. Three years. I can do inventory and I can do you.
   - **WAI:** *delighted* I like her.
   - **CHASE:** You like everyone.
   - **CHLOE:** *looking Chase up and down* You look like a sad uncle at a barbecue.
   - **CHASE:** And you look like a delay.
2. Wide: the Operator lowers herself into a chair, grimacing.
   - **OPERATOR:** My people are waiting at the old flagship in the Queen Street Mall. Tonight. They'll take her the rest of the way. You get your stock, doubled, the moment she's handed over.
   - **WAI:** What's so special about her?
   - **OPERATOR:** She's important.
   - **CHASE:** Everybody's important to somebody.
   - **OPERATOR:** Not like this.
3. Chloe crosses to the Operator. Chase and Wai are in the soft background; focus on the two women. Chase watches.
   - **CHLOE:** *quiet* When I get there. What happens? Really.
   - **OPERATOR:** *her eyes slide to the radio for a moment* A scan and some blood at our lab. Then you come home — and the world comes with you.
   - **CHLOE:** *a small, amazed smile* The world. Okay.
4. Rack focus to Chase. He saw the Operator's eyes move. He files it away.
   - **OPERATOR:** *to Chase* Her name's Chloe.
   - **CHASE:** Don't need it.
   - **CHLOE:** *pulling on her backpack* It's on my badge. In case you forget.

### 1.6 — Under the Wall · Gameplay with talk · 3 min · 1D to 1E

Night. Sneak through back lanes to the drainage tunnel. Chloe's first walk-and-talk.

- **CHLOE:** So what do I call you?
- **CHASE:** You don't.
- **CHLOE:** *to Wai* What do I call him?
- **WAI:** Chase.
- **CHLOE:** Chase. Like a car chase.
- **CHASE:** Like be quiet.
- **CHLOE:** *pulling out the manual* Step one. "Greet the customer. Use their name and smile!" *beaming* Hi, Chase.
- **CHASE:** Where'd you get that?
- **CHLOE:** The depot. Every trainee gets one. Nobody reads it. I've read it forty times.
- **WAI:** *laughing* The Yes Way. God, I wrote the quiz for that.
- **CHLOE:** You did not.
- **WAI:** Step five, handle objections, "every no is just a not yet". That was me.
- **CHLOE:** *reverent* That's my favourite one.
- **CHASE:** Tunnel. Shut up.

### 1.7 — The Scan · Cutscene · 1.5 min · 1E

1. They climb out of the tunnel into a flooded street. Torches snap on. A COMMS patrol of two.
   - **SOLDIER:** Down! On your knees! Eyes up!
2. The soldier scans Wai (CLEAR), Chase (CLEAR). Chloe keeps her left arm behind her back. He grabs it; the sweatband slips. The scanner shrieks.
   - **SOLDIER:** She's tagged! She's—
3. Chase moves: an elbow, the soldier's own knife. Wai clubs the second soldier. Silence except the rain. Chase grabs Chloe's forearm and pushes the sweatband up. Close: a red dot on her skin, a white **1**.
   - **CHASE:** How long.
   - **CHLOE:** Three weeks.
   - **WAI:** That's not possible.
   - **CHLOE:** It says one. It's always said one.
   - **WAI:** Nobody stays on one. Nobody.
4. Chase draws his revolver and points it at her head. Chloe doesn't flinch; she stares straight into the barrel.
   - **CHASE:** Then she's about to be two.
   - **CHLOE:** Wait for it, then. I've got time. I've had three weeks of time.
5. Hold three seconds. Chase lowers the gun.
   - **WAI:** This is what they want her for. Chase. If she's real—
   - **CHASE:** If she's real, she's someone else's problem. By morning.

### 1.8 — The Drowned Tower · Gameplay · 5 min · 1F

Push a pallet so Chloe can cross flooded lobby water ("I can't swim, okay? Don't make it a thing."). Climb stairs into the first Autoplay zone. Night Shift goggles tutorial. First Clickers: Wai whispers the rules ("They can't see. Don't run. Don't let 'em touch you. Ever."). Craft the first SIM shiv. Halfway up, scene 1.9 interrupts.

### 1.9 — Night Shift · Cutscene · 1 min · 1F

1. An atrium blooming with screen-rot, walls shimmering blue. Chloe fights with her goggle strap, gives up and pulls the goggles off.
2. Chase lunges and grabs her arm.
   - **CHASE:** *hissed* Put them back on—
   - **CHLOE:** *looking at the glowing walls, blinking* …It's just pretty.
3. Wai stares at her. Chase stares at her. Nothing happens.
   - **CHASE:** Put them back on.
   - **CHLOE:** Why? Nothing's happening.
   - **CHASE:** Because I said.
4. She pushes them up onto her forehead instead. For the rest of the tower, whenever the player looks at Chloe, Chase's camera lingers on her eyes for a beat.

### 1.10 — Close One That Matters · Cutscene · 3.5 min · 1G

No music. From beat 5 onward: **one continuous take.**

1. Dawn through the flagship's broken skylight. Bodies of three Landlines on the tiled floor, coiled-cord armbands. On the wall, a dusty plaque: STORE OF THE YEAR — QUEEN STREET MALL — WAI & CHASE. Wai sits heavily on a display bench.
   - **CHASE:** They're dead. We're going back.
   - **WAI:** Chase.
2. Wai pulls down his collar. On his neck, a red dot: **38**.
   - **WAI:** Got me in the tower. On the stairs. Thought it was a mosquito.
   - **CHASE:** *stepping back* No.
   - **CHLOE:** Let me see. *she looks, and her face falls* It's going up.
   - **WAI:** Yeah. It does that.
3. Engines outside. Spotlights through the shutter slats: COMMS trucks.
   - **WAI:** They followed us. The tower pinged their scanners. *stands, pushes his glasses up* Right. Here's the plan.
   - **CHASE:** There's no plan.
   - **WAI:** There's always a plan, mate. I'm a manager. *points* Stockroom, loading dock, through the arcade to George Street. Take her to Luke.
   - **CHASE:** Luke's—
   - **WAI:** Luke was Landlines. He'll know where they'd take her.
4. Chloe backs toward the stockroom door. Wai picks up his cricket bat.
5. **Continuous take.** Slow push-in on the two men, Chloe soft in the background.
   - **WAI:** Chase. Look at me.
   - (Chase looks at him.)
   - **WAI:** Ten years I watched you not care about anything. And that was fine. That was the job. *nods at Chloe* But this might be the only thing we ever did that mattered.
   - **CHASE:** I'm not doing this without you.
   - **WAI:** *smiling* You were always a better closer than me. I just took the credit. *pause* So close one that matters.
6. Wai straightens the Store of the Year plaque on the wall. He pushes Chase toward the stockroom. Chase goes. The door swings shut behind him and Chloe.
7. Camera stays with Wai, facing the rising shutter, spotlights flooding in, bat on his shoulder. His Badge reads **51**.
   - **WAI:** *to the soldiers, bright retail voice* Welcome to Optus. How can I help you today?
8. Hard cut to the dark stockroom as the gunfire starts, muffled through the door. Chase has his back against it, eyes shut. Chloe watches him. The shooting stops.
   - **CHLOE:** *barely audible* I'm sorry.
   - **CHASE:** *not opening his eyes* Move.

### 1.11 — Onebar · Gameplay into cutscene · 3 min · 1H

Escape through the stockroom (Chase walks past a rack of old demo phones and doesn't look), a loading dock, and the heritage arcade with COMMS searching (stealth, or fight). Climb to a rooftop.

Cutscene, 45 s: sunrise over the drowned city, the river gold. Chase looks west.

- **CHASE:** There's a bloke in Onebar. Owes me a car.
- **CHLOE:** Is he nice?
- **CHASE:** No.
- **CHLOE:** *pause* …Was Wai nice?
- **CHASE:** *long pause* Yeah.

He walks off. She follows. Fade to the Chapter 2 card.

## 10. Chapter 2 — Cold Calling (Summer, 18 min)

**Card:** Step 2. "Build rapport. Find something in common!" **CHLOE (V.O.):** We both hate you, Chase. That's something.

Purpose: a lighter chapter after Wai. Meet Tech Support, learn crafting and traps, the first Bloatware, the note, and the first real laughs between Chase and Chloe. Plant Chase's easy lying and the naming rule.

### Areas

| Area | Place | What's there |
| --- | --- | --- |
| 2A | Outskirts of Onebar | Dry paddocks, a rusted road sign reading WELCOME TO ONEBAR — POP. 1 (the 1 painted over an older number), tripwires made of charging cables, tin cans on strings, snares. |
| 2B | Main Street | One pub, a servo, a church, a closed bank, and ONEBAR MOBILE REPAIRS with "NO PHONES. NO EXCEPTIONS." painted over its sign. Barricades of shopping trolleys. |
| 2C | Tech Support's shop | Workbench, disassembled radios, jars of screws, a bench vice holding a smashed phone, hundreds of smashed phones in a skip out back. |
| 2D | Onebar High School | Classrooms, a gym with a solar-battery bank on the roof. The Bloatware nests in the gym. |
| 2E | The house on the edge of town | Neat, dusty, two mugs on a kitchen table, a chair facing the window, an empty doorway to the bush. |
| 2F | The mechanic's and the gate | A ute on blocks, then the main road out of town. |
| 2G | The highway | Driving scene: sunset on an empty inland highway. |

### 2.1 — The Walk · Cutscene · 1 min · 2A

1. A short travel montage, no dialogue: the pair walking a highway at noon; sleeping in a bus shelter; Chloe asleep against Chase's shoulder on a rail trolley he's pumping; Chase gently moving her head off it.
2. The sign. They stop.
   - **CHLOE:** Pop one. Is that him?
   - **CHASE:** That's him.
   - **CHLOE:** Where's everyone else?
   - **CHASE:** He's not a people person.

### 2.2 — Snared · Gameplay · 3 min · 2A to 2B

Trap tutorial: Chloe spots the first tripwire ("Chase, charging cable. Across the road."). Later a scripted snare yanks Chase upside down. Scrollers attack. The player shoots upside down while Chloe runs for the counterweight and cuts the rope with her box cutter. A shotgun booms from a rooftop and the last Scrollers drop.

### 2.3 — Tech Support · Cutscene · 2 min · 2B

1. Chase hits the ground hard. A tall gaunt man with a huge grey beard and red goggles on his forehead drops from an awning, shotgun level.
   - **TECH SUPPORT:** You set off every bell in town.
   - **CHASE:** *getting up* Missed you too.
   - **TECH SUPPORT:** I didn't say I missed you. I said you set off every bell in town. *looks at Chloe* What's that?
   - **CHLOE:** A person.
   - **TECH SUPPORT:** I can see it's a person. What's it doing in my town?
   - **CHASE:** You owe me.
   - **TECH SUPPORT:** I owe you nothing. You owe me a lecture. You don't bring people here.
   - **CHASE:** I need the car.
   - **TECH SUPPORT:** There is no car.
   - **CHASE:** There's always a car.
   - **TECH SUPPORT:** *long pause* There's a ute. It doesn't run. It needs a battery. There isn't a battery.
2. Chloe steps forward.
   - **CHLOE:** What's your name?
   - **TECH SUPPORT:** Tech Support.
   - **CHLOE:** That's not a name.
   - **TECH SUPPORT:** You call, I don't answer. *holds out a hand* Pockets. Both of you. Phones.
   - **CHLOE:** I've never had a phone.
   - **TECH SUPPORT:** *to Chase* And you?
3. Close on Chase. Hold two seconds. Insert: his hand resting over the zipped chest pocket. Back to his face, which gives nothing away.
   - **CHASE:** No.
   - **TECH SUPPORT:** Good. *turns* Shop. Don't touch anything.
4. Chloe glances at Chase's chest pocket, then away. She doesn't know what's there. The player does.

### 2.4 — The Shop · Gameplay with talk · 2 min · 2C

Crafting and workbench tutorial. Tech Support narrates with contempt ("Tape. Blade. Don't cut your thumb off, I'm out of thumbs."). He gives Chase two spicy pillows. The battery is at the high school's solar bank.

- **CHLOE:** *picking up a smashed phone from the vice* Why do you break them all?
- **TECH SUPPORT:** Because I fixed 'em all. Fixed every phone in this district for twenty years. Screens, batteries, water damage. Made 'em work better.
- **CHLOE:** So?
- **TECH SUPPORT:** So I'm undoing my life's work, one at a time. *smashes it with the hammer* Nearly done.

### 2.5 — The High School · Gameplay · 4 min · 2D

Stealth through classrooms (graffiti: "YR 12 2016 — ONEBAR FOREVER"), then the gym. Short cutscene (15 s): the gym is dark; forty cracked screens glow in a heap that stands up — a Bloatware, lit from inside. Tech Support: "That's Coach." Fight with fire and shotgun while Tech Support covers from the stands. Recover the battery.

### 2.6 — The Note · Cutscene · 1.5 min · 2E

1. Shortcut back through a neat house on the edge of town. Chloe goes in ahead. Two mugs on the table, one clean, one with ten-year-old tea stains. A chair turned to the window. A folded letter under the mug.
2. Chloe reads it. The letter's text appears in handwriting on screen while she reads it aloud, quietly.
   - **CHLOE:** *reading* "You were right. I looked. Just once. It was only a video of the ocean. I thought, what's the harm in the ocean. It's already at twelve. I'm going to walk out past the fence while it's still me doing the walking. Don't come after me. You were always better at fixing things than me. Some things you don't fix."
3. The floor creaks. Tech Support stands in the doorway. He crosses the room, takes the letter gently from her hands, folds it along its old creases and puts it back under the mug, exactly where it was.
   - **TECH SUPPORT:** Wasn't for you.
   - **CHLOE:** I'm sorry.
   - **TECH SUPPORT:** *looking at the chair by the window* …Everyone's sorry.
4. He leaves. Chloe looks at the doorway to the bush for a long moment. Chase, outside, has heard everything.

### 2.7 — Roll-Start · Gameplay · 2 min · 2F

Fit the battery; it's weak. Push-start set piece: Chloe steers, Chase and Tech Support push the ute downhill along Main Street while Scrollers pour out of the pub. Chase jumps in as it catches. Tech Support runs for the gate.

### 2.8 — Don't Name Her · Cutscene · 1 min · 2F

1. The ute idles at the gate. Tech Support swings it open and leans on Chase's window.
   - **TECH SUPPORT:** Don't come back.
   - **CHASE:** Wasn't planning on it.
2. He glances past Chase at Chloe, who is fiddling with the radio. He lowers his voice.
   - **TECH SUPPORT:** And Chase. Don't name her. You name 'em, you lose 'em.
   - **CHASE:** I don't even know it.
   - **TECH SUPPORT:** Liar.
3. He slaps the roof twice. The ute pulls away. In the mirror, Tech Support stands in the road until he's gone.

### 2.9 — The Road · Gameplay (camera and talk) · 3 min · 2G

A driving scene the player can't crash: Chase drives automatically; the player looks around and can trigger conversation topics by looking at Chloe and pressing E. Sunset, cicadas, the inland highway. The main conversation plays automatically; three short optional topics are in section 17.

1. Chloe unfolds Chase's laminated coverage map.
   - **CHLOE:** Why's the whole middle white?
   - **CHASE:** No coverage.
   - **CHLOE:** Isn't that bad?
   - **CHASE:** Best thing Optus ever did.
2. She flips through the manual.
   - **CHLOE:** Step six. "The close. Maintain eye contact. Ask for the yes." *turns in her seat and stares at him*
   - **CHASE:** What.
   - **CHLOE:** I'm maintaining eye contact.
   - **CHASE:** Watch the road for me.
   - **CHLOE:** You're driving. *stares harder* Chase. Will you… be my friend?
   - **CHASE:** No.
   - **CHLOE:** Every no is just a not yet. That's step five.
   - **CHASE:** You skipped four.
   - **CHLOE:** *flips back* "Present the solution." Boring. *stares again* Chase.
   - **CHASE:** *the corner of his mouth moving* …Stop it.
   - **CHLOE:** *pointing* Ha! I saw it! Rapport! Built!
3. Quieter now. The sun is low.
   - **CHLOE:** What's a group chat?
   - **CHASE:** Forty people ignoring you at once.
   - **CHLOE:** What's "seen at nine forty-two"?
   - **CHASE:** When someone reads what you said and decides you're not worth an answer.
   - **CHLOE:** That's so mean. *pause* Did people do that?
   - **CHASE:** All day.
   - **CHLOE:** *looking out the window* I would've been so bad at before.
   - **CHASE:** *after a while* Everyone was bad at before.
4. Fade out on the ute's headlights coming on, the road running into the dark.

## 11. Chapter 3 — Door to Door (Late summer, 30 min)

**Card:** Step 3. "Discover needs. Ask open questions!" **CHLOE (V.O.):** Open question. Why is everyone trying to kill us?

Purpose: human enemies, Chloe's first kill, Zane and Aidan, the head office guilt reveal, the Group Chat boss, and the chapter's devastating ending.

### Areas

| Area | Place | What's there |
| --- | --- | --- |
| 3A | Western Sydney arterial road | Car yards, fast-food shells, a broken-down hatchback with a man waving. Harsh summer sun. |
| 3B | Suburban blocks | Fibro houses and brick units the Door Knockers use as a hunting ground; front doors all marked with chalk tallies and sales scrawl ("NOT INTERESTED", "CALL BACK"). |
| 3C | Gutted shopping centre | Two-level mall at night: dead escalators, a department store, a food court under a collapsed skylight open to stars. |
| 3D | Head office, Macquarie Park | A glass campus overgrown with vines. Lobby with a banner WELCOME TO THE FUTURE — YES. Open-plan floors of desks, beanbags, a dead kombucha fridge, motivational decals ("FAIL FAST", "CUSTOMER OBSESSED"). Executive floor. A server hall in the basement. |
| 3E | Stormwater tunnels | Concrete drains, rising water, grates, Clickers echoing. |
| 3F | Suburban cul-de-sac | Dusk. A dozen houses around a turning circle, a kids' trampoline, a burnt-out car. |
| 3G | The house | A family home with the kids' bedrooms intact. Night, then morning. A backyard with a Hills Hoist. |

### 3.1 — Not Selling Anything · Cutscene · 1 min · 3A

1. The ute rolls through western Sydney. A man in a polo shirt waves both arms beside a hatchback with its bonnet up.
   - **MAN:** Sorry to bother you! I'm not selling anything! My car's broken down, my kid's hurt—
   - **CHLOE:** Chase, we should—
   - **CHASE:** Nobody who says "I'm not selling anything" isn't selling something.
2. He floors it. The man drops the act and raises a rifle. Rounds punch the windscreen. The ute veers through a shopfront and stops in a cloud of plaster.

### 3.2 — Door to Door · Gameplay · 4 min · 3B

First full human combat. Door Knockers hunt house to house, calling barks (section 17). Near the end, a scripted grab: a Door Knocker pins Chase against a fridge and chokes him. The screen darkens. A pistol shot. The man falls. Chloe stands in the doorway holding a pistol she took from a body.

### 3.3 — First Kill · Cutscene · 1.5 min · 3B

1. Chase coughs, gets up. Chloe hasn't lowered the gun. Her hands shake.
   - **CHASE:** Where did you get that?
   - **CHLOE:** He was going to—
   - **CHASE:** I told you to stay in the car.
   - **CHLOE:** There is no car! The car's in a shop!
   - **CHASE:** Give it here.
   - **CHLOE:** No. *pause* No. I just saved your life. You don't get to be angry about it.
2. Close on Chloe. She looks at the man on the floor for the first time. Her face crumples, then locks.
   - **CHASE:** *quieter* You okay?
   - **CHLOE:** …No.
   - **CHASE:** Good. Don't ever be okay with that.
3. He holds out his hand. She gives him the pistol. He tucks it into his belt.
   - **CHASE:** You'll get it back when you know how not to use it.

### 3.4 — The Brothers · Cutscene · 2 min · 3C

1. Night. The pair creep through the dark department store. A slingshot pebble pings off a mannequin beside Chase's head.
   - **AIDAN (off):** Don't move!
2. Torchlight. Zane steps out with a hunting rifle raised; Aidan, 16, behind him with a slingshot drawn.
   - **ZANE:** Hands where I can see 'em. You with the Closer?
   - **CHASE:** Do I look like I'm with the Closer?
   - **ZANE:** You look like you'd sell your nan.
   - **CHASE:** Already did.
3. Aidan's eyes have landed on Chloe's polo.
   - **AIDAN:** Is that a trainee badge? Like, an actual Optus one?
   - **CHLOE:** Is that an Optus Sport hoodie? Like, an actual one?
   - **AIDAN:** It was my dad's.
   - **CHLOE:** This was a dead bloke's.
   - **AIDAN:** *grinning* Cool.
   - **ZANE:** Aidan.
   - **AIDAN:** What? She's funny.
4. Zane lowers the rifle an inch.
   - **ZANE:** We're getting out of the city. North side's clear of Door Knockers — they won't go past the old head office. Too many infected.
   - **CHASE:** How many guns you got?
   - **ZANE:** One. Mine.
   - **CHASE:** Then you need us more than we need you.
   - **ZANE:** Or we all die separately. Your pick.
   - **CHASE:** *after a beat* Dawn. We leave at dawn.

### 3.5 — Night Watch · Gameplay with talk · 3 min · 3C

The food court under the broken skylight. The player controls Chase and can move between two conversations. Both play automatically when approached; each is worth hearing.

**Chloe and Aidan**, sitting on a food-court table:

- **AIDAN:** Wanna see something? *unclips the digital pet* He's ten.
- **CHLOE:** *recoiling* That's a screen.
- **AIDAN:** It's safe. It never got the Update. It's too dumb. *it chirps* See? He's hungry. He's always hungry.
- **CHLOE:** How is it still alive?
- **AIDAN:** Batteries. Every time I find a watch battery. I've never let him die. Not once. *pause* Zane says it's stupid.
- **CHLOE:** It's not stupid.
- **AIDAN:** Do you reckon they're still in there? The Clickers. The person, I mean. Just watching. Forever.
- **CHLOE:** …I don't know.
- **AIDAN:** I reckon they are. I reckon that's the worst bit.
- **CHLOE:** *after a long moment, pushing up her sweatband* Can you keep a secret?
- **AIDAN:** *seeing the Badge* …One? What's that mean, one?
- **CHLOE:** It means three weeks and it's never gone up.
- **AIDAN:** *whisper* No way. *pause* That's the coolest thing I've ever seen.

**Chase and Zane**, at the top of the dead escalator on watch:

- **ZANE:** He's all I've got.
- **CHASE:** Then keep him close.
- **ZANE:** You got anyone?
- **CHASE:** No.
- **ZANE:** What about her?
- **CHASE:** She's cargo.
- **ZANE:** *looks at him a long time* Sure. *pause* I knocked on doors for the Closer. Two years. Kept Aidan fed.
- **CHASE:** Why'd you stop?
- **ZANE:** He started sending kids to knock. People open the door for kids. *touches the dead headset at his neck* I used to run a call centre, you know. Forty people. "Thank you for calling, how can I help." *laughs once* How can I help.

### 3.6 — Head Office · Gameplay · 5 min · 3D

The four enter the head office campus. Lobby: the YES banner, a reception desk with a dusty visitor sign-in book. Open-plan floors infested with Clickers among the desks; Lurkers under beanbags. Aidan and Chloe whisper jokes about the motivational decals. Lift shaft climb to the executive floor.

### 3.7 — Engagement · Cutscene · 2 min · 3D

1. A corner office with floor-to-ceiling glass. On the desk, under a coffee cup, a printed email. On the wall, a framed leaderboard with a photo: a younger Chase grinning, holding up a phone.
2. Chloe reads the email.
   - **CHLOE:** "Project INFINITE. Engagement up four hundred percent in trials. Some adverse reactions in long sessions. Recommend we ship." *looks up* Ship it.
   - **ZANE:** They knew.
   - **CHASE:** Everyone knew. Nobody cared.
3. Chloe turns to the wall. Insert on the frame: LAUNCH NIGHT NATIONAL LEADERBOARD — #1 CHASE — REDCLIFFE — 312 UNITS.
   - **CHLOE:** Chase. This is you.
4. Chase crosses, takes the frame off the wall, looks at his own face for two seconds, and lays it face-down on the desk.
   - **CHLOE:** Three hundred and twelve.
   - **CHASE:** Leave it.
   - **CHLOE:** You sold three hundred and twelve—
   - **CHASE:** *hard* I said leave it.
5. Silence. Aidan, trying to help:
   - **AIDAN:** Three-twelve's pretty good though.
   - **ZANE:** Aidan.
6. Chase walks out. Chloe looks at the face-down frame, then follows.

### 3.8 — The Group Chat · Boss · 5 min · 3D

The server hall: long aisles of racks strangled in screen-rot, and at the far end a mass of dozens of fused infected forming a wall of screens that scroll in perfect sync, with a huge glowing red Badge at its heart reading **99+**.

1. **Intro (20 s cutscene):** the four freeze in the doorway. Every screen in the mass turns toward them at once and shows the same frame: their own reflection. Aidan hums the ringtone under his breath. Zane puts a hand over his mouth.
2. **Phase 1 — Mute it.** The mass is dormant. Sneak down the aisles and pull the breakers on three power racks while Clickers ("notifications") wander. Each breaker makes the mass flicker and scream in chimes.
3. **Phase 2 — Replies.** The mass wakes. It sends "replies": chunks tear loose as Scrollers and Clickers and hunt the player. Its screens flash white to blind (look away or wear Night Shift). Companions shout warnings.
4. **Phase 3 — Burn it.** Expose the red Badge core and hit it with spicy pillows or ringtone bombs. Three hits.
5. **End (30 s cutscene):** every screen in the mass goes black at once. Total silence. Then, from every dead phone in the hall, a single click. Chloe: *whisper* "Nope." They run for the drainage hatch.

### 3.9 — The Gate · Gameplay into cutscene · 3 min · 3E

Stormwater tunnels. Chloe rides a floating pallet. Clickers in the dark. At a steel gate Chase lifts it for the others to crawl under while infected pour in behind him.

1. Cutscene: Zane and Aidan are through. Chloe is through. Chase is still on the wrong side, holding the gate. Zane grabs the chain and drops the gate shut.
   - **ZANE:** I'm sorry. I can't risk him.
   - **AIDAN:** Zane! Open it!
   - **CHLOE:** *hammering the gate* Open it! Open it, you coward!
   - **ZANE:** *dragging them both away* Move!
2. Chase alone. He turns to the dark. Gameplay: a tense solo run through a side channel, then a reunion outside a stormwater outlet, where Zane is waiting with his rifle raised at the tunnel mouth — to cover Chase.
   - **ZANE:** You'd have done the same.
   - **CHASE:** *walking past him* Yeah. I would've.
   - **CHLOE:** *to Chase, low* I wouldn't have.

### 3.10 — Limited Time Offer · Set piece · 4 min · 3F

1. Dusk. The cul-de-sac. Zane hands Chase the rifle.
   - **ZANE:** You're the better shot. Prove it.
2. Gameplay: Chase covers from an upstairs window while Zane, Aidan and Chloe cross the turning circle house by house. Door Knockers appear on rooftops.
3. The Closer's ute roars in with a roof spotlight. His voice booms through a megaphone, all game-show cheer:
   - **THE CLOSER:** Folks! Folks! This is a limited time offer! Come on out now, and we'll only take the guns and the girl! …No? Your loss, champions!
4. Survive the assault, then take down the Closer as he stands on the ute's tray. His megaphone clatters on the road and squeals.
5. The gunfire has drawn a flood of Scrollers. Run. Scripted mid-gameplay moment (no letterbox): a Scroller tackles Chloe; Aidan shoulder-charges it off her, goes down under it for two seconds, then scrambles up, pulling his sock high.
   - **AIDAN:** I'm fine! I'm fine! Go!
6. The group dives into the house and barricades the door.

### 3.11 — It Itches · Cutscene · 2.5 min · 3G

1. Night. A kid's bedroom with glow-in-the-dark stars on the ceiling. Zane asleep against the wall with the rifle. Chloe and Aidan lie on the floor on sleeping bags. Aidan stares at the ceiling.
   - **AIDAN:** Can I ask you something?
   - **CHLOE:** You're going to anyway.
   - **AIDAN:** When you got tagged. Did it hurt?
   - **CHLOE:** It itched. Then I stopped noticing.
   - **AIDAN:** Did you know? Straight away? That you'd be okay?
   - **CHLOE:** No. I just waited. Counted every morning. One. One. One.
   - **AIDAN:** *quietly* What if someone else was like you?
   - **CHLOE:** Then they'd be the luckiest person alive.
   - **AIDAN:** *pause* Yeah.
2. The digital pet chirps. Chloe hands it to him.
   - **CHLOE:** Feed him. He's beeping.
   - **AIDAN:** *pressing the button* I've never let him die. Not once.
   - **CHLOE:** I know. Night, Aidan.
   - **AIDAN:** Night.
3. Wide, locked-off: the two of them under the plastic stars. In the doorway, Chase, who couldn't sleep, looks at them for a moment and goes back to the window. Under the blanket, Aidan scratches his calf. Fade out.

### 3.12 — The Morning · Cutscene · 2 min · 3G

No music. From beat 3 to beat 5: **one continuous take.**

1. Grey morning light. Close on Chloe's face as she wakes to a sound: the digital pet beeping, unfed, over and over.
2. Aidan stands with his back to her at the window. His thumb is swiping at nothing. From his throat: *click. click.* His sock has slipped. On his calf a red Badge reads **99+**.
   - **CHLOE:** *sitting up* Aidan?
3. **Continuous take.** He turns. His eyes are wet and empty. He lunges, pinning her, trying to press the dead digital pet against her eyes like a screen. Chloe screams. Chase crashes in and hauls at him. Zane wakes.
4. Zane shoots his brother. The sound fills the house. Aidan falls. The pet skitters across the floor, still beeping.
5. Zane kneels, drops the rifle, gathers Aidan up.
   - **ZANE:** Aidan. Aidan— *he sees the Badge* No. No—
   - **CHASE:** *slowly* Zane. Look at me. Zane.
   - **ZANE:** *reaching for the rifle on the floor* Don't.
   - **CHASE:** Zane, look at me—
6. Hard cut to black the instant before the shot. The shot plays over black. Hold black for four full seconds.
7. Fade up: the backyard. The sound of a shovel. Two fresh graves beside the Hills Hoist. Chloe kneels by the smaller one, the digital pet in her hands. She presses the feed button.
   - **CHLOE:** I'm sorry. *pause* He asked me. He asked me if it hurt, and I didn't know what he was asking.
   - **CHASE:** …
   - **CHLOE:** Everyone I—
   - **CHASE:** Keep moving. *she doesn't move* …Please.
8. She clips the pet to her backpack and stands. Chase takes Zane's rifle. They go. Fade to the Chapter 4 card.

## 12. Chapter 4 — The Dead Zone (Autumn, 17 min)

**Card:** Step 4. "Present the solution. Match the product to the need!" **CHLOE (V.O.):** Chase, what's the product? **CHASE (V.O.):** Luke.

Purpose: breathing room after Chapter 3. A glimpse of a life worth living. The brothers. Film night. The fight that makes Chase choose Chloe.

### Areas

| Area | Place | What's there |
| --- | --- | --- |
| 4A | The mountain road | Winding road into a Snowy Mountains valley. Poplars and willows in red and gold. The ute runs dry at the top. |
| 4B | The dam and turbine hall | A concrete hydro dam wall, spillway mist, a humming turbine hall lit by caged bulbs. |
| 4C | The settlement | A tidy village below the dam: vegetable gardens, a horse paddock of brumbies, washing lines, kids playing cricket with a milk crate for stumps, a town hall with a hand-painted sign FILM NIGHT — FRIDAY, red-filtered lamps at dusk. An old copper telephone in a booth by the hall. |
| 4D | Luke's house | A weatherboard cottage with a deep porch facing the dam. Home brew, a guitar, a drawing by a kid pinned by the door. |
| 4E | The high-country homestead | An abandoned farmhouse up the valley. A child's bedroom frozen ten years ago: pop-star posters, a dead phone on the bedside table, a tin of hair ties. |

### 4.1 — Black Spot · Cutscene · 1.5 min · 4A

1. The ute coughs and dies at the top of the pass. Chase gets out, unfolds the coverage map. Insert: the valley below is a pure white patch.
   - **CHLOE:** White's good, right?
   - **CHASE:** White's good.
2. They walk down through falling leaves. A rider on a brumby appears on the road ahead with a scoped rifle. He lowers it slowly and pushes back a faded YES cap. Luke, 39.
   - **LUKE:** …You look old.
   - **CHASE:** You look like Dad.
   - **LUKE:** That's the meanest thing you've ever said to me.
3. He swings down. An awkward handshake that turns into a hard hug. Chase's hand stays on the back of Luke's neck a second longer than he means it to. Luke looks past him.
   - **LUKE:** And who's—
   - **CHASE:** Cargo.
   - **CHLOE:** Chloe. Hi. He's like this with everyone.
   - **LUKE:** *smiling* Yeah. I know.

### 4.2 — The Dead Zone · Gameplay with talk · 3 min · 4C

No threats. Walk through the village with Luke leading his horse. Townspeople nod; kids stare at Chloe's yellow polo. Everything Chloe sees gets a comment.

- **CHLOE:** *at the cricket game* They've never seen a phone. None of them.
- **LUKE:** Nope. They think "scrolling" is what you do to a map.
- **CHLOE:** *at the brumbies* What's that one's name?
- **LUKE:** Doesn't have one.
- **CHLOE:** Can I name it?
- **CHASE:** No.
- **CHLOE:** *to the horse, whispering* Hi, Horse.
- **LUKE:** *at the gardens* Potatoes, silverbeet, pumpkins the size of your head. My wife runs the clinic. Hydro runs the lights. Nobody's lit up a screen here in eight years.
- **CHLOE:** How?
- **LUKE:** *pointing at the mountains* No signal. They don't come where there's nothing to look at.

Optional: Luke's wife (title), the town's doctor, patches a cut on Chloe's hand and asks where she's from. Optional conversations in section 17.

### 4.3 — Every Single One · Cutscene · 2 min · 4D

1. Evening on the porch, the dam wall lit red by lamps. Two chairs, two jars of home brew.
   - **LUKE:** Called the copper line this arvo. The Landlines had a lab in Canberra. The uni on the lake. Last I heard.
   - **CHASE:** You're not with them anymore?
   - **LUKE:** I left. They wanted me to do things I'd already done enough of.
   - **CHASE:** *drinks* Like what we did.
   - **LUKE:** I remember what we had to do. Every single one.
   - **CHASE:** I don't.
   - **LUKE:** Yeah you do. You just don't let yourself.
2. Silence. The dam hums.
   - **CHASE:** I need you to take her.
   - **LUKE:** What?
   - **CHASE:** To Canberra. You know the Landlines. You know the roads.
   - **LUKE:** And you?
   - **CHASE:** I've got things in Brisbane.
   - **LUKE:** You don't have anything in Brisbane.
   - **CHASE:** Luke.
   - **LUKE:** What is she to you?
   - **CHASE:** Nothing.
   - **LUKE:** *a long look* You're a terrible liar when it's about yourself. Always were.
3. A bell clangs from the dam. Men shouting. Luke is already on his feet with the rifle.
   - **LUKE:** Bandits. They hit the turbines every autumn.

### 4.4 — The Raid · Gameplay · 4 min · 4B

Night defence of the turbine hall with Luke and villagers. Bandits come across the dam wall and up from the spillway. Chloe hands Chase ammo and warns of flankers. Ends with Luke and Chase back to back as the last bandit flees. Luke grins; Chase almost does.

### 4.5 — Film Night · Cutscene · 2 min · 4C

Almost no dialogue. Warm guitar theme with a soft second part.

1. The town hall. Rows of folding chairs, kids on the floor, a hand-cranked reel projector throwing a flickering black-and-white comedy onto a bedsheet (an original silent comedy: a man, a ladder and a pie).
2. Close on Chloe: the light of a screen on her face, the first safe screen of her life. She laughs, properly, for the first time in the game — bent over, hand over her mouth.
3. Two seats along, Chase isn't watching the film. He's watching her. Slow push-in on his face: something unguarded.
4. Behind them, Luke leans on the back wall watching Chase watch her. He smiles and shakes his head.
5. Later: Chloe slips out for water. Passing the kitchen door she hears Chase and Luke inside.
   - **CHASE (off):** In the morning. You take her. I'll go before she's up.
6. Close on Chloe in the dark corridor. The laughter drains from her face. She sets the cup down very carefully and walks out.

### 4.6 — After Her · Gameplay · 2 min · 4C to 4E

Morning. Horse is gone from the paddock. Chase and Luke ride up the valley following hoofprints through frost and red leaves. Simple horse riding. Luke talks.

- **LUKE:** She took the one she named.
- **CHASE:** She didn't name it.
- **LUKE:** She called it Horse, mate. That's a name.

### 4.7 — Then What Are You? · Cutscene · 3 min · 4E

1. The homestead. Chase finds Chloe in the child's bedroom, sitting on the bed under faded pop-star posters, turning a dead phone over in her hands. Luke waits downstairs.
   - **CHLOE:** *not looking up* Was going to get a head start.
   - **CHASE:** On a stolen horse.
   - **CHLOE:** Borrowed.
   - **CHASE:** Trainee—
   - **CHLOE:** Don't. Don't call me that.
2. She stands. Shot/reverse-shot, 50 mm, tightening as it goes.
   - **CHLOE:** Wai. Aidan. Zane. Everyone I've met since the wall is dead. Except you. So don't you tell me I'm safer with someone else.
   - **CHASE:** Luke knows the roads. He's got people. He's better at this than me.
   - **CHLOE:** He's not better at it than you. Nobody's better at it than you.
   - **CHASE:** You don't know what I'm good at.
   - **CHLOE:** I read the leaderboard.
3. Silence. That lands.
   - **CHASE:** *quietly* You're not my kid. And I'm not your trainer.
   - **CHLOE:** Then what are you?
4. Hold for four seconds on Chase. He has no answer. His eyes go to the dead phone in her hand. His own hand goes to his chest pocket.
5. Luke calls from downstairs.
   - **LUKE (off):** Riders. Coming up the valley. Time to go.
6. At the horses. Chase checks the saddle straps without looking at anyone.
   - **CHASE:** I'll take her.
   - **LUKE:** Yeah. I figured.
7. Chase pulls the pistol from his belt and holds it out to Chloe, grip first.
   - **CHASE:** Safety's on the left. Keep it on until you mean it.
   - **CHLOE:** *taking it, surprised* …Okay.
8. Luke hands Chloe the reins of Horse.
   - **LUKE:** Canberra. The uni on the lake, the science buildings. Look after him.
   - **CHLOE:** He's the adult.
   - **LUKE:** *pulling his cap down* Not really.
9. Wide: Chase and Chloe riding out of the valley on one horse, Luke watching from the homestead. The leaves fall. Fade to the Chapter 5 card.

## 13. Chapter 5 — Handling Objections (Late autumn, 13 min)

**Card:** Step 5. "Handle objections. Every no is just a not yet!" **CHLOE (V.O.):** Wai wrote that one.

Purpose: Chloe's hope peaks. Chase learns the procedure will kill her and hides it. The player now knows what Chloe doesn't. Chase is nearly killed.

### Areas

| Area | Place | What's there |
| --- | --- | --- |
| 5A | The ride into Canberra | Frosted roads, empty roundabouts, a lake with swans, Parliament House overgrown on its hill in the distance. |
| 5B | The university campus | Brutalist concrete buildings, frosted lawns, bike racks full of rusted bikes, student posters for parties ten years gone. |
| 5C | The Landlines lab | A science building's third floor: a lab with a reel-to-reel recorder, an answering machine, whiteboards of brain diagrams and network maps, cages full of old phones, a vending machine still full of chips. |
| 5D | Walkways and atrium | Glass skybridges between buildings, a collapsed atrium with a snapped antenna mast lying across it. |

### 5.1 — The Ride In · Gameplay with talk · 2 min · 5A

Chase rides Horse with Chloe behind him. The player steers at a walk. Frost crunches.

- **CHLOE:** What was Canberra?
- **CHASE:** Where they made the rules.
- **CHLOE:** Did it work?
- **CHASE:** Look around.
- **CHLOE:** *pause* When this is done. When they've done the scan and I'm back. Could I come to Luke's too?
- **CHASE:** *a beat* We'll see.
- **CHLOE:** That's a yes.
- **CHASE:** That's a "we'll see".
- **CHLOE:** In sales, "we'll see" is a yes. Page thirty-one.
- **CHASE:** *under his breath* Bloody manual.

### 5.2 — The Campus · Gameplay · 3 min · 5B

Scrollers in the frosted quad; Lurkers in a lecture theatre. Landlines coiled-cord symbols on doors lead to the science building. Chloe reads student posters aloud ("'Toga party, Friday.' What's a toga?").

### 5.3 — The Only One · Cutscene · 1.5 min · 5C

1. The lab. Dust on everything. A red light blinks on an answering machine. Chloe presses play.
   - **OPERATOR (recording):** All teams, this is the Operator. Canberra is compromised. We're moving to the Perth Exchange. If the Unread reaches this lab, bring her west. Listen for the dial tone.
2. Chase threads the reel-to-reel and presses play. A tired man's voice.
   - **LEVEL 3 (recording):** Subject forty-one. Tagged at eight a.m. Gone ninety-nine at nineteen hours. *click* Subject fifty. Same. *click* That's fifty volunteers. Fifty. Every one of them went. The girl in Brisbane is the only one who stayed at one.
3. Close on Chloe as it sinks in. Her face opens up.
   - **CHLOE:** The only one. *quietly* Chase. It's actually me.
   - **CHASE:** Yeah.
   - **CHLOE:** *a laugh bursting out* Perth. That's the whole country.
   - **CHASE:** It is.
   - **CHLOE:** Okay. Okay! *grabs her backpack* I'm finding us supplies. Bars. Whatever. Don't move.
4. She's gone down the corridor, humming. Chase is alone.

### 5.4 — Subject U · Cutscene · 2 min · 5C

No music. The key secret of the story.

1. Chase notices a locked steel drawer in the recorder desk. He works the lock with the SIM tool from his shiv. Inside: one cassette, labelled in marker: **L3 — SUBJECT U — PROCEDURE.**
2. He slots it into a desk tape player. Close on the spinning reels, then on Chase.
   - **LEVEL 3 (tape):** Procedure notes, Subject U. The immunity isn't in her blood. It's a pattern in the brain itself. To copy it into the core we have to read all of it, all at once. The read burns out every pathway it touches. *pause* The subject will not survive. I want that on record.
   - **OPERATOR (tape):** Noted.
   - **LEVEL 3 (tape):** She should be told.
   - **OPERATOR (tape):** She doesn't need to know. Keep calling it a scan. People walk further toward hope than toward a grave.
   - **LEVEL 3 (tape):** …That's a sales pitch.
   - **OPERATOR (tape):** Everything is.
3. The tape clicks off. Chase doesn't move. Five seconds on his face.
4. From down the corridor, delighted:
   - **CHLOE (off):** Chase! There's a vending machine and it's still got chips in it! Ten-year-old chips!
5. He ejects the tape. His hand hovers over a bin by the desk. Then he zips it into his chest pocket, beside Bub's phone.
   - **CHASE:** *calling back, steady* Coming.
6. He walks out into the corridor. Chloe is holding up a faded chip packet like a trophy, grinning. He looks at her. Blend to gameplay; the player now carries the secret.

### 5.5 — Raiders · Gameplay · 3 min · 5D

Armed raiders in winter gear (later revealed as Retreat hunters) storm the building. Fight across the glass skybridges. Chloe covers with her pistol, rarely hitting. On the last skybridge, a raider tackles Chase through a cracked glass panel.

### 5.6 — Get Up · Cutscene · 2 min · 5D to 5A

1. Slow motion for one second as Chase falls into the atrium. Hard cut to impact. A snapped antenna mast has gone through his side. Keep it off-camera: frame on his face and Chloe's.
2. Chloe kills the raider above with two panicked shots and scrambles down.
   - **CHLOE:** Chase. Chase! Okay — okay — you have to help me.
   - **CHASE:** *grey, gasping* Go.
   - **CHLOE:** Shut up. On three. One, two—
3. She pulls him off the mast. He screams. She drags him by the jacket; the chest pocket strains and the corner of the cassette pokes out. Close on it. She doesn't notice. It stays in.
4. Outside. She heaves him up onto Horse and climbs on behind him. Snow begins to fall.
5. Riding. Chase slumps. Then he slides off into the snow. Chloe jumps down and grabs his face.
   - **CHLOE:** Chase. Get up. You're not allowed to — you don't get to — get up. *shouting* Get up!
6. Chase's point of view: her face above him, snow falling past it, the image blurring. Fade to white.

## 14. Chapter 6 — Team Building (Winter, 24 min)

**Card:** No manual page — it's in Chase's jacket and Chloe is alone. Open on black and silence, then a hand-painted banner over a ski lodge door, snow falling across it: **WELCOME TO THE TEAM.** Then the chapter title and WINTER.

Purpose: Chloe carries the game. She is small, outmatched and brave. The Regional is the most frightening human in the story because he is polite. The chapter ends with the first time Chase says her name.

**The player controls Chloe** for the whole chapter (see section 5 for her abilities).

### Areas

| Area | Place | What's there |
| --- | --- | --- |
| 6A | Snowy forest | Snow gums and alpine ash, deep snow, a frozen creek, deer tracks. |
| 6B | Ski patrol hut | A one-room hut: bunk, pot-belly stove, first-aid posters, a hunting bow on the wall. Chase lies here. |
| 6C | Chairlift station | A lift terminal at the top of a run, chairs swinging in the wind, a snowed-in ticket booth. |
| 6D | The ski village | A-frame chalets, a frozen lift queue, signs for ski hire. |
| 6E | The Retreat lodge | A big alpine lodge. Kitchen and cold room; corridors with a whiteboard of targets ("WOOD: 40/40 ✓ — MEAT: 12/20"), an Employee of the Month wall of Polaroids, conference rooms (Breakout Room A, Breakout Room B), and a timber dining hall with a stone fireplace. |

### 6.1 — The Hut · Cutscene · 1 min · 6B

1. Grey light through frosted windows. Chase on the bunk, sweating, grey-faced, the wound dressed with torn polo sleeve. Chloe changes the bandage and doesn't let herself react to the smell.
   - **CHASE:** *fever-thin* …Where are we?
   - **CHLOE:** A ski hut. You'd hate it. It's cosy.
   - **CHASE:** You should go.
   - **CHLOE:** Shut up. *she takes the bow off the wall and tests the string* Back soon.
2. She pulls her beanie on, looks back at him once, and goes out into the snow. Blend to gameplay.

### 6.2 — The Hunt · Gameplay · 3 min · 6A

Bow tutorial. Track a sambar deer by its prints and blood through the snow gums. Chloe talks to herself ("Okay. Breathe. Wai would say breathe."). Bring the deer down at the edge of the ski village. Two men step out of the trees.

### 6.3 — Leadership Potential · Cutscene · 2 min · 6D

1. The Regional — soft voice, fleece vest, reading glasses on a cord — raises both hands. Beside him the Facilitator (title), younger, with a rifle.
   - **THE REGIONAL:** Easy. Easy. We're not going to hurt you. That's a beautiful shot. Clean.
   - **CHLOE:** *bow drawn* Stay there.
   - **THE REGIONAL:** Of course. Respect the boundary. *to the Facilitator* Lower it. *smiles at Chloe* What do we call you?
   - **CHLOE:** You don't.
   - **THE REGIONAL:** Fair. I'm the Regional. This is the Facilitator. We're part of a bigger team, down the mountain.
2. Chloe keeps the arrow nocked.
   - **CHLOE:** I need medicine. Antibiotics. I'll trade half the deer.
   - **THE REGIONAL:** That's a generous offer. We can work with that. *to the Facilitator* Go back and get the kit. The good stuff. *the Facilitator goes* We'll wait. Together.
3. A click echoes through the trees. Then several.
   - **THE REGIONAL:** *unhurried, lifting a rifle from his back* Ah. Timing. Can you shoot as well as you negotiate?

### 6.4 — The Chairlift · Gameplay · 4 min · 6C

Wave defence at the chairlift terminal, back to back with the Regional. Clickers and Scrollers out of the snow. The Regional calls targets calmly and compliments her kills ("Lovely." "Good instinct."). He shoots one off her at the last second and says nothing about it.

### 6.5 — Is That the Pitch? · Cutscene · 1.5 min · 6C

1. After the fight. They sit on the frozen lift ramp, breath steaming.
   - **THE REGIONAL:** You didn't flinch. Not once. Do you know how rare that is?
   - **CHLOE:** I flinch.
   - **THE REGIONAL:** Not where anyone can see. That's leadership. *pause* The man you're getting medicine for. He's lucky.
   - **CHLOE:** He's not lucky. He's stubborn.
   - **THE REGIONAL:** Same thing, in a manager.
2. The Facilitator returns with a first-aid kit. The Regional hands it to her.
   - **THE REGIONAL:** As promised. We honour our agreements. Come down to the lodge sometime. Hot water. A roof. Rituals. People who'd see what I see in you.
   - **CHLOE:** Which is?
   - **THE REGIONAL:** Potential.
   - **CHLOE:** *standing, shouldering the kit* Is that the pitch?
   - **THE REGIONAL:** *smiling wider* Everything's a pitch, sweetheart.
3. She walks away into the snow. Stay on the two men.
   - **THE FACILITATOR:** Those raiders at the uni. That was our crew. The man with her killed—
   - **THE REGIONAL:** I know. *watching her go* Let her carry the medicine home first. It's rude to interrupt.

### 6.6 — The Medicine · Gameplay into cutscene · 2 min · 6B

1. Back at the hut. Interactive: prepare the syringe, find the vein (a short, careful input), press. Chloe whispers: "Please work. Please, please work."
2. Night. Chloe dozes by the stove with the box cutter in her hand. Chase murmurs in his fever. Subtitles show only *\[indistinct\]*.
3. The camera drifts to the frosted window. A shadow is standing outside it, listening. It slips away. Chloe doesn't wake.

### 6.7 — The Hunt Turns · Gameplay into cutscene · 3 min · 6A to 6D

1. Dawn. Torches in the trees. The Retreat has come for Chase. Chloe climbs out the back window, gets on Horse and deliberately draws them away, shouting and firing her pistol into the air.
2. A horseback chase through the snow gums with men on foot and one on a snowmobile.
3. Cutscene: a rifle shot. Horse screams and goes down. Chloe is thrown into the snow.
   - **CHLOE:** Horse — no, no, no—
4. She crawls to the horse's head. Its breath stops. A boot steps into frame. The Regional looks down at her kindly.
   - **THE REGIONAL:** You should have taken the offer.
5. A rifle butt. Black.

### 6.8 — Staff Meal · Cutscene · 2.5 min · 6E

1. Chloe wakes in a cage in a steel commercial kitchen. A laminated sign on the wall: **STAFF MEAL — 12:30**. A man in an apron (the Chef, title) works at a butcher's block with his back to her. Keep it implied: the camera finds a work boot on the floor beside the block, then a pile of lanyards in a tray. Chloe understands, turns away and retches.
2. The Regional enters with a steaming bowl, pulls up a stool outside the cage and sets the bowl on the floor.
   - **THE REGIONAL:** You must be starving.
   - **CHLOE:** What is that.
   - **THE REGIONAL:** Protein.
   - **CHLOE:** What is it.
   - **THE REGIONAL:** It's how a team survives a winter. Everyone contributes. Even the ones who leave.
3. He steeples his fingers. Slow push-in, 85 mm.
   - **THE REGIONAL:** The world ended because people stopped belonging to something. They sat alone in the dark, looking at their hands. I give them something to belong to. Rituals. Targets. Purpose. Huddle at six. Employee of the Month. *smiling* They love it.
   - **CHLOE:** You're eating them.
   - **THE REGIONAL:** I'm keeping the team together.
4. Her sleeve has ridden up. He sees the red Badge. His face changes: hunger of a different kind.
   - **THE REGIONAL:** Oh. Oh, what's this. *reaching through the bars and turning her wrist* One. How long?
   - **CHLOE:** *pulling free* Long enough.
   - **THE REGIONAL:** Someone like you isn't staff. You're a team asset. You could lead with me… Chloe.
5. She freezes.
   - **CHLOE:** How do you know my name?
   - **THE REGIONAL:** Your man says it in his sleep. Over and over. We stood at his window for an hour listening. *stands* Think about it. There's no I in team.
6. He leaves the bowl. Chloe sits very still. Close on her face: the Regional's words have told her something she didn't know. Then her eyes go to the Chef's key ring hanging from his apron.

### 6.9 — Breakout Room B · Gameplay · 5 min · 6E

1. **Escape:** Chloe calls the Chef over ("Hey. Hey! I'll eat it. I'm hungry."), grabs his keys when he bends, and the scene cuts away as the box cutter comes out.
2. **Stealth through the lodge.** Chloe can't win a fair fight. Box cutter stealth kills only; bow and pistol for emergencies. Retreat members patrol with corporate barks (section 17). Environmental storytelling: the targets whiteboard, the Employee of the Month Polaroids (the same faces keep winning), a "Values" poster reading TEAMWORK — OWNERSHIP — HUNGER.
3. A knocked-over lantern sets the dining hall alight.
4. **Boss: The Regional in the burning dining hall.** Fire spreads and blocks routes; smoke hides Chloe but also hides him. He hunts her with a fire axe, calling out in a patient, managerial voice. Chloe must sneak up and stab him three times; each time he staggers, laughs and resumes. If he spots her, he charges. His lines, spaced out:
   - "Chloe! This isn't a performance review."
   - "I'm disappointed. But I'm not angry."
   - "There's no I in team, Chloe!"
   - "You would have been Employee of the Month. Every month."
   - "Let's take this offline, just you and me."
   - "Everyone leaves eventually. You'll leave him too."
5. After the third stab he grabs her and pins her to the floor. Blend straight into 6.10.

### 6.10 — Chloe · Cutscene · 3 min · 6E

The most important scene before the ending. From beat 3 onward: **one continuous take.** No music until beat 7.

1. The Regional on top of her, hands at her throat, fire behind him. She gets the box cutter free and drives it into him. He falls sideways. Frame on her face and the firelight only; the body is out of frame.
2. She keeps going. Again. Again. Screaming. The sound of the fire swallows the rest.
3. **Continuous take.** Chase staggers into the hall — pale, feverish, revolver in one hand, the other pressed to his side. He sees her and drops the gun. He pulls her back by the arms. She fights him, blind with rage, not recognising him.
   - **CHASE:** Hey. Hey! Stop. Stop. It's me. Look at me.
   - **CHLOE:** Get off — get off me — get OFF—
4. He turns her around and holds her face in his hands, the way he held Bub's in the prologue.
   - **CHASE:** Chloe.
5. She stops. Hold two seconds. The first time he has ever said it.
   - **CHASE:** Chloe. Look at me. It's me.
   - **CHLOE:** *seeing him* …Chase?
   - **CHASE:** It's okay. It's okay, Chloe.
   - **CHLOE:** He kept — he kept saying I belonged to them—
   - **CHASE:** You don't. You don't belong to anyone. I've got you.
   - **CHLOE:** *sobbing into him* You're up. You're up—
   - **CHASE:** You got the medicine. You did that. I've got you, Chloe. I've got you.
6. He lifts her to her feet and walks her out through the burning doorway. The camera stays wide and still as they walk out into the snow, holding each other up.
7. The theme plays in full. Behind them the WELCOME TO THE TEAM banner catches fire, burns through and falls. Hold on the two small figures in the white until they're almost gone. Fade to the Chapter 7 card.

**From this point on:** Chase always calls her Chloe, and his combat barks use her name.

## 15. Chapter 7 — The Close (Spring, 21 min)

**Card:** Step 6. "The close. Maintain eye contact. Ask for the yes." Chloe reads it flatly, with no joke after it. Hold a beat of silence where the joke used to be.

Purpose: the calm, the whales, Bub, the arrival, the message, the betrayal, the truth, and the choice. Most of this chapter is cutscene; keep the gameplay between scenes slow and quiet.

### Areas

| Area | Place | What's there |
| --- | --- | --- |
| 7A | The Nullarbor | An endless straight highway through saltbush, a roadhouse, a sign reading AUSTRALIA'S LONGEST STRAIGHT ROAD, a camper van. |
| 7B | Head of Bight | Limestone cliffs over the Southern Ocean, a timber boardwalk, wind, whales in the bay below. |
| 7C | Perth outskirts | A flooded rail underpass at dusk: carriages half-submerged, Clickers in the water, a collapsing platform. |
| 7D | The Perth Exchange | A sandstone telephone exchange building lit by generators: a courtyard, a dormitory floor, a charging room, the switchboard room (rows of old cord boards), the Operator's office, stairs to the roof, and in the basement the network core in a server hall fitted out as an operating theatre. |

### 7.1 — Road West · Cutscene · 1.5 min · 7A

1. Travel montage: a camper van found in Adelaide; Chase, still stiff, driving; Chloe asleep in the passenger seat with Aidan's digital pet on her chest; the LONGEST STRAIGHT ROAD sign flashing past.
2. A roadhouse at noon. They eat from tins on the bonnet. Chase has the manual now. He reads from it, awkwardly.
   - **CHASE:** "Step four. Present the solution. Match the product to—" *looks at her* "—to the need."
   - **CHLOE:** …
   - **CHASE:** This is your bit. You do the voices.
   - **CHLOE:** …
   - **CHASE:** *trying* Why did the sales rep cross the road?
   - **CHLOE:** *small* Why.
   - **CHASE:** …I don't know. I was hoping you'd know.
   - **CHLOE:** *the ghost of a smile* That's terrible.
   - **CHASE:** Yeah. It is.
3. Close on Chase's hand resting on his chest pocket as she looks away.

### 7.2 — The Boardwalk · Gameplay · 2 min · 7B

No threats. The player walks the cliff boardwalk in the wind. Chloe runs ahead for the first time since Winter, reading the faded information boards aloud. Optional conversation on the bench (section 17).

### 7.3 — Are They Real? · Cutscene · 3 min · 7B

1. Chloe at the railing, shouting over the wind.
   - **CHLOE:** Chase. Chase! CHASE!
   - **CHASE:** *hurrying, hand on the revolver* What — what's wrong—
   - **CHLOE:** *pointing, awestruck* What is that.
2. Wide, 28 mm, from behind them: a southern right whale surfaces in the bay below, then breaches, huge and slow, and crashes back in white water. A calf rolls beside its mother.
   - **CHLOE:** Oh my god. Oh my god. Are they… are they real?
   - **CHASE:** Yeah. They're real.
   - **CHLOE:** They're so big. They're so— *laughing and crying at once* Nobody told me. Ten years and nobody told me they were still here.
   - **CHASE:** They didn't get the Update.
   - **CHLOE:** *laughing* Lucky.
3. They sit on the boardwalk, legs through the railing. Whale song carries up on the wind. Chase takes out the cracked phone and turns it over in his hands.
   - **CHASE:** I had a daughter.
   - **CHLOE:** *turning* …What?
   - **CHASE:** Bub. *he stops, can't get past the nickname* Bub. Thirteen. The night of the Update. *holds up the phone* This was hers. I gave it to her. Early birthday present.
   - **CHLOE:** Is she…
   - **CHASE:** At the bridge. A soldier. *pause* Only picture I've got's on here.
   - **CHLOE:** You never charged it?
   - **CHASE:** Scared of what else is on there.
   - **CHLOE:** *softly* Like what?
   - **CHASE:** *shaking his head* Like anything.
4. She leans her head on his shoulder. He lets her. A whale blows below. Chloe's motif rises into phrase B. Hold.

### 7.4 — Turn Around · Cutscene · 1.5 min · 7A

1. Sunset at the van. Chloe is feeding the digital pet. Chase stands at the driver's door and doesn't get in.
   - **CHASE:** We don't have to go.
   - **CHLOE:** What?
   - **CHASE:** Perth. We could turn around. Go back to Luke's. Film night every Friday. You could learn to ride properly.
   - **CHLOE:** Why would we do that?
   - **CHASE:** *a beat too long* Because I'm asking.
2. Close on Chloe, studying him.
   - **CHLOE:** Chase. After all of it? Wai. Aidan. Zane. It can't be for nothing. *pause* It's a scan. Then we go to Luke's. After.
   - **CHASE:** *his hand on his chest pocket* …After.
   - **CHLOE:** Maintain eye contact.
3. She stares at him. He holds it. She smiles for real.
   - **CHLOE:** See? Deal.
4. He gets in the van. The player knows exactly what she's driving toward.

### 7.5 — The Underpass · Gameplay · 4 min · 7C

The last combat section before the Exchange. A flooded rail underpass at dusk; Clickers in waist-deep water, carriages to climb through, Chloe on a floating door she pushes with a pole. Near the end the platform collapses and the current drags her under.

### 7.6 — Breathe · Cutscene · 1.5 min · 7C

1. Underwater, murky: Chase dives, finds her hand, hauls her up.
2. On the platform, frame on Chase's face and hands only as he does CPR.
   - **CHASE:** Come on. Come on. Don't you — breathe. *pressing* Breathe. BREATHE.
3. She coughs up water. He sags over her, forehead against hers for a second.
4. Torches from every side. Rifles. People in coiled-cord armbands.
   - **LANDLINE (title):** Don't move!
5. A handheld radio crackles. The Operator's voice.
   - **OPERATOR (radio):** Stand down. Stand down. It's her.
6. A Landline kneels and gently pushes up Chloe's wet sleeve. The red 1. Whispers pass along the line: "The Unread." They lower their guns.

### 7.7 — Welcome Home · Cutscene · 2 min · 7D

1. The Exchange courtyard at night, strung with generator lights. Landlines gather in their dozens. As Chloe passes they reach out and touch her shoulder, her sleeve, quietly. A child gives her a bunch of wildflowers.
2. The Operator pushes through, healed now, cardigan over body armour, and pulls Chloe into a hug.
   - **OPERATOR:** You made it. You actually made it.
   - **CHLOE:** *overwhelmed* Hi. Um. Hi.
   - **OPERATOR:** *to Chase* And the delivery man.
   - **CHASE:** Where's my stock?
   - **OPERATOR:** *laughing* Wherever you want it. Name it.
3. Chloe, holding the flowers.
   - **CHLOE:** When's the scan?
   - **OPERATOR:** *a tiny pause* Dawn. Get some sleep. Hot water on the third floor. Real beds.
   - **CHLOE:** Real beds! Chase! Real beds!
4. In the background, a man in scrubs with a head torch (Level 3) watches Chloe, then looks at the ground and walks away. Chase notices him.

### 7.8 — The Exchange at Night · Gameplay with talk · 3 min · 7D

The player walks Chase through the Exchange. Landlines eat, play cards, repair radios. Everyone calls Chloe "the Unread". Notes and whiteboards describe the Patch plan ("CORE → ALL NATIONAL TOWERS → SUBSEA CABLES → WORLD"). Optional talks with Landlines and with Chloe in the dormitory (section 17). The path leads to the charging room.

### 7.9 — Not Delivered · Cutscene · 2.5 min · 7D

No music except what comes out of the phone. From beat 4 onward: **one continuous take.**

1. A small room. A workbench stencilled AIRPLANE MODE ONLY with charging cables. Chase sits. He takes out Bub's phone. He takes off his jacket and hangs it over the chair.
2. He plugs the phone in. Nothing. Ten seconds of nothing. He almost pulls the cable out. Then a faint battery icon.
3. He holds the power button. A boot chime (Bub's motif on the thin phone tone). The screen lights his face.
4. **Continuous take.** Over his shoulder: the lock screen. Bub and Chase in the store on launch night, Bub pulling a face, Chase laughing, the MIDNIGHT LAUNCH banner behind them. His breath catches.
5. A notification slides down, with a red badge: **1**. "Message not delivered." He taps it. Her words fill the screen, timestamped 11:59 PM:
   - (on screen) **proud of u dad. dont sell too m**
   - (under it, in red) **Not Delivered. Tap to retry.**
6. He reads it. Reads it again. His thumb hovers over "Tap to retry". It stays there for five seconds. He doesn't press it.
7. He laughs once, a broken sound, and puts his hand over his mouth. His shoulders shake. The camera does not move and does not cut for forty seconds. He sets the phone face-up on the bench, still glowing, and walks out to the balcony to breathe. The jacket stays on the chair.

### 7.10 — The Tape · Cutscene · 2 min · 7D

The only scene in the game that follows Chloe without Chase.

1. Chloe in pyjamas from the Landlines' stores, hair wet, wanders into the charging room looking for Chase.
   - **CHLOE:** Chase? I want the manual. I've got a new—
2. She stops. Bub's phone is glowing on the bench. She picks it up. Close on the lock screen: Bub's face. Chloe smiles sadly at it.
   - **CHLOE:** *whisper* Hi, Bub.
3. She puts it down carefully and reaches into the jacket for the manual. Her hand finds something else. She pulls out the cassette. Insert: **L3 — SUBJECT U — PROCEDURE.**
   - **CHLOE:** *reading* Subject U. *a beat* U. Unread.
4. The switchboard room. Rows of old cord boards. She finds a tape deck at the supervisor's desk and slots the cassette in. The camera stays on her face for the whole recording.
   - **LEVEL 3 (tape):** …The read burns out every pathway it touches. The subject will not survive.
   - **OPERATOR (tape):** She doesn't need to know. Keep calling it a scan. People walk further toward hope than toward a grave.
5. The tape clicks off. The click echoes off the boards. Chloe doesn't move.

### 7.11 — How Long? · Cutscene · 2 min · 7D

1. Chase comes in, looking for his jacket, and sees her holding the cassette. He stops dead.
   - **CHLOE:** How long have you known?
   - **CHASE:** …
   - **CHLOE:** How long?
   - **CHASE:** Since Canberra.
   - **CHLOE:** *a horrified laugh* Canberra. That's the whole winter. That's the whales.
   - **CHASE:** I asked you to turn around—
   - **CHLOE:** You let me walk across the whole country to die!
   - **CHASE:** I asked you to turn around!
   - **CHLOE:** You didn't tell me WHY! *quieter, worse* You just stood there and let me say "after". I said "after" to you. And you said it back.
   - **CHASE:** I didn't know how.
   - **CHLOE:** You sell things for a living. You know exactly how to say things.
   - **CHASE:** Not this.
2. She pushes past him with the tape.

### 7.12 — I'm Asking Her Now · Cutscene · 2.5 min · 7D

1. The Operator's office: a switchboard console, maps of undersea cables on the wall, a kettle. Chloe slams the cassette down on the desk. Chase in the doorway.
   - **OPERATOR:** *looks at it; closes her eyes* Level 3 keeps records. I should have burned that.
   - **CHLOE:** Is it true?
   - **OPERATOR:** Yes.
   - **CHLOE:** I die.
   - **OPERATOR:** Yes. *pause* I'm sorry. I told you what you needed to hear to get you here. It doesn't make the rest untrue.
   - **CHASE:** You lied to her.
   - **OPERATOR:** I sold her a road.
2. She turns to the wall map and puts her hand on it.
   - **OPERATOR:** The core under this building still reaches every tower in the country that's running. Pushed from here, the Patch goes through every network in Australia, then down the cables under the ocean. Jakarta. Singapore. Everywhere. Every Scroller. Every Clicker. We think they're still in there. We think the Patch lets them out.
   - **CHLOE:** You think.
   - **OPERATOR:** It's the best chance anyone has ever had. It's the only one.
   - **CHASE:** Find someone else.
   - **OPERATOR:** There is no one else. Fifty volunteers. She's the only one who stayed at one.
3. The Operator steps closer to Chase. Quiet.
   - **OPERATOR:** I was on shift the night of the Update. Network operations. I watched the numbers climb on the big board and thought it was the best night of my career. I pushed that button, Chase. Let me push this one.
   - **CHASE:** Did anyone ask her?
   - **OPERATOR:** *turning to Chloe* I'm asking her now. *pause* Dawn. It's your choice. I won't take it from you.
4. Close on Chloe. She has nothing to say. She walks out.

### 7.13 — The Stairs · Gameplay with talk · 1.5 min · 7D

Chase walks the silent Exchange. Landlines avoid his eyes. An optional talk with Level 3 on the stairs:

- **LEVEL 3:** I told her the truth would come out. In tech support you learn the logs never lie. *cleaning his hands on a rag* For what it's worth, I'm sorry.
- **CHASE:** It's not worth anything.
- **LEVEL 3:** No. I suppose it isn't.

The stairs lead up to the roof door. It's open. Wind.

### 7.14 — The Roof · Cutscene into the choice · 4 min · 7D

No music. A faint drone that rises almost imperceptibly across the whole scene. From beat 6 onward: **one continuous take.**

1. The Exchange roof. Perth dark below, a few generator lights, the ocean a black line far off, stars. Chloe sits on the parapet with her feet over the edge, the digital pet in her hands.
   - **CHASE:** You'll fall.
   - **CHLOE:** Then I won't have to decide.
2. He sits beside her. Long silence. The pet chirps.
   - **CHLOE:** I keep feeding him. Every hour. Like if I stop, something bad happens. *a laugh* Something bad already happened.
3. She looks out at the dark city.
   - **CHLOE:** I want it to mean something. Wai, Aidan, Zane — they died getting me here. My best friend's still out there somewhere with a screen where her face was. Everyone's best friend is. And I could just… let them out.
   - **CHASE:** You could.
   - **CHLOE:** *her voice breaking* And I don't want to die. I'm eighteen. I've never even had a phone. I've never been anywhere that wasn't falling down. I saw whales one time.
   - **CHASE:** Chloe—
   - **CHLOE:** If I say yes, I'm choosing to die. If I say no, I'm choosing to leave them all in there. Forever. Aidan said that's the worst bit. Watching forever. *pause* I can't be the one. I can't.
4. She turns to him.
   - **CHLOE:** The Regional said you say my name in your sleep.
   - **CHASE:** …Do I.
   - **CHLOE:** Over and over.
5. She stands on the roof and faces him. He stands too.
6. **Continuous take.** Slow push-in over Chloe's shoulder onto Chase's face. She steadies herself; a trace of the old joke comes into her voice.
   - **CHLOE:** Step six. Maintain eye contact.
   - (She holds his eyes. Tears, but she doesn't look away.)
   - **CHLOE:** Look at me. You always know what to say. So you decide. Whatever you say, I'll do it. I promise.
   - **CHASE:** You can't put this on me.
   - **CHLOE:** *a tiny smile* I'm asking for the yes, Chase. Or the no. I'm asking.
7. **The choice.** The frame stays live: wind in their hair and clothes, breathing, blinking, the pet's faint chirp. White text fades in centred over the image:

**GIVE CHLOE TO THE OPERATOR?**

**YES       NO**

- Highlight with mouse, arrow keys or stick. Confirm by holding for 1.5 s while a ring fills, so it can never be chosen by accident. Neither option is pre-selected.
- While YES is highlighted the camera drifts very slightly past Chloe toward the lights of the city and the sea. While NO is highlighted it drifts slightly toward Chloe's face. The drift is barely noticeable.
- **No timer.** If the player waits, Chloe fills the silence, then stops:
  - At 20 s: **CHLOE:** Chase?
  - At 45 s: **CHLOE:** Please just say something.
  - At 90 s: **CHLOE:** *quietly* It's okay. Whatever it is. It's okay.
  - At 150 s: she sits back down on the parapet facing him. **CHLOE:** …I'll wait.
  - After that, nothing but wind and the pet, forever.
- No autosave is offered between this prompt and the end of either ending. After the ending, the save records which choice was made; Chapter select lets the player replay 7.14 and choose again.

## 16. The endings

Neither ending is canon, and nothing in the game rewards or judges either choice. Both end on the same ridge above the Dead Zone, with Chase saying "Yes" to a question he can't truly answer. The final title card is the same in both.

### Ending A — YES: The Close (8 min)

#### A.1 — Yes · Cutscene · 1 min · the roof

1. The choice text fades. The continuous take from 7.14 carries on.
   - **CHASE:** *barely audible* …Yes.
2. Chloe nods, slowly.
   - **CHLOE:** Okay. *breath* Okay.
3. Chase's face goes first. He cries without a sound. Only when she sees him crying does her own face break. She steps into him and holds on.
   - **CHLOE:** *into his shoulder* Thank you. For not making me.
4. Hold on them until the first grey of dawn touches the edge of the sky.

#### A.2 — Dawn · Gameplay (walk only) · 2 min · 7D

1. The player controls Chase at a slow walk only; no running, no weapons, no HUD. Chloe holds his hand. They descend the Exchange stairs.
2. Landlines line the corridors in silence. Some put a hand over their heart. The child who gave Chloe flowers is there; Chloe touches her head as she passes.
3. On the last flight of stairs, Chloe takes the manual from his jacket pocket and reads the last page as they walk.
   - **CHLOE:** "Step seven. Follow up. A yes is the beginning of a relationship." *laughs softly* That's so stupid.
4. She tears the page out, folds it small, and tucks it behind his staff ID on the beaded lanyard.
   - **CHLOE:** For later.

#### A.3 — The Table · Cutscene · 3 min · 7D

No music. From beat 4 to beat 7: **one continuous take.**

1. The server hall. Racks of blue lights, cables gathered into a halo over a padded table. Level 3 in scrubs. The Operator at a heavy old exchange switch, her hand not yet on it.
2. Before she lies down, Chloe unclips the digital pet and presses it into Chase's hand, closing his fingers over it.
   - **CHLOE:** Keep him alive. You're rubbish at it, so try really hard.
   - **CHASE:** *a broken laugh* Okay.
3. She lies down. Level 3 places the contacts gently.
   - **LEVEL 3:** Count backwards from ten for me, Chloe.
4. **Continuous take,** 85 mm on Chloe's face in profile; Chase at the edge of frame holding her hand.
   - **CHLOE:** Ten. Nine. *turns her head to Chase* Look at me.
   - (He does.)
   - **CHLOE:** Eight. Seven. *softer* Six…
5. Her voice stops. Her eyes stay on him. Then they close.
6. The camera slides down her arm to the Badge. The red **1** flickers, greys out, and fades from her skin. Nothing is left.
7. Level 3, quietly: "Pattern captured." The Operator pushes the switch. The racks flare white. Chase never looks away from Chloe's face.
8. Wide: the screen-rot on the server hall walls flickers and goes dark. Then the corridor outside. Then the next. A wave of darkness travels outward through the whole building, room by room.

#### A.4 — Someone Looks Up · Cutscene · 2.5 min · the Nullarbor, then montage

1. Weeks later. The van heading east, Chase alone. The digital pet sits on the dashboard. The torn manual page is still behind his staff ID.
2. He stops. In a paddock of wheat, a Clicker stands alone. *Click. Click.* Then the clicking stops. The cracked screen plates on its face split and slide off into the wheat.
3. Underneath is a woman. Pale, blinking in the daylight, crying. She lifts her face and looks up at the sky.
4. Chase gets out and walks toward her slowly. He kneels a few metres away. She looks at him and tries to speak; nothing comes out.
   - **CHASE:** It's okay. You're okay. *gently* Look at me.
   - (She does.)
5. Montage, no dialogue, theme on piano beginning: a man standing up out of a flooded Brisbane street, looking at his empty hands; figures in the Sydney head office lobby sitting on the floor in a shaft of sun; at the Onebar gate, an older person in faded clothes walking up the road — and Tech Support, on the other side of the fence, dropping his hammer.

#### A.5 — Was It Worth It? · Cutscene · 1.5 min · the ridge above the Dead Zone

1. Spring grass. The dam below, the village, brumbies in the paddock. Chase walks up the ridge alone. Luke is waiting at the top with his cap in his hands. He doesn't need to ask.
2. They stand side by side looking down at the valley for a long time.
   - **LUKE:** Was it worth it?
3. Chase looks at the digital pet in his hand. It chirps. He presses the feed button.
   - **CHASE:** …Yes.
4. Hold on his face. Cut to black. **THE LAST OF YES.** Credits (section 18).

### Ending B — NO: Follow-Up (12 min)

#### B.1 — No · Cutscene · 1 min · the roof

1. The choice text fades. The continuous take from 7.14 carries on.
   - **CHASE:** No.
2. Chloe breaks — relief and shame at the same time. She laughs and sobs together.
   - **CHLOE:** Okay. *pause* Okay.
3. She grabs him and holds on hard.
   - **CHLOE:** I'm sorry. I'm sorry. I'm so selfish.
   - **CHASE:** You're eighteen.

#### B.2 — The World Doesn't Get a Vote · Cutscene · 1.5 min · the roof

1. The roof door bangs open. The Operator, with four armed Landlines.
   - **OPERATOR:** I'm sorry. I said I wouldn't take it from you. I lied about that too.
   - **CHASE:** *stepping in front of Chloe* Don't.
   - **OPERATOR:** The world doesn't get a vote on this. Neither do we.
2. A Landline jabs a syringe into Chloe's neck from behind. Chase lunges and is clubbed down. Close on the roof gravel at his eye level: Chloe being carried away, her hand reaching back toward him, the digital pet falling from her fingers and bouncing on the roof, chirping.
3. Black.

#### B.3 — The Exchange · Gameplay · 4 min · 7D

1. Chase wakes zip-tied in a storeroom with one guard. He snaps free and kills the guard (a scripted takedown the player triggers). He picks up the digital pet from the guard's pocket, where it was put.
2. Fight down through the Exchange to the basement. **No music.** The enemies are Landlines — people who were kind to Chloe hours ago. They don't bark like villains:
   - "He's heading for the hall!"
   - "Please — we're trying to fix it!"
   - "Think about what you're doing!"
   - "You're killing the whole world!"
   - "Don't let him reach her!"
   - A wounded Landline: "My sister's out there. She's in there. Please."
3. The child from the courtyard is visible once, hiding under a table as Chase passes. He doesn't stop.

#### B.4 — Level 3 · Cutscene with forced input · 1 min · 7D

1. The server hall. Chloe unconscious on the table. Level 3 stands between Chase and her, a scalpel in his shaking hand.
   - **LEVEL 3:** I won't let you.
2. The camera settles into Chase's aim. Control returns only as far as the trigger. There is no other input that progresses. If the player waits, Level 3 speaks, then says nothing more:
   - **LEVEL 3:** You know what this is worth. You know.
3. The shot. Level 3 falls. Chase pulls the contacts off Chloe and lifts her.

#### B.5 — Carrying Her · Gameplay · 1 min · 7D

The player carries Chloe through the Exchange car park at a slow limp: the same animation and camera as carrying Bub in the prologue. Sirens and shouting behind. The van at the far end.

#### B.6 — The One Who Asked Me · Cutscene · 1.5 min · 7D

1. The Operator steps out from behind a pillar, revolver at her side, not raised.
   - **OPERATOR:** Chase. You're choosing one girl over everyone.
   - **CHASE:** I'm choosing the one who asked me.
   - **OPERATOR:** She asked you to decide. You decided for the world.
   - **CHASE:** So did you. Ten years ago.
   - **OPERATOR:** *crying* Then let me fix it.
2. Chase shakes his head once. He shoots her. She falls. He doesn't look at her.
3. He looks back at the Exchange, its lights still on: the only people who could ever have built the Patch. Then he lays Chloe in the back of the van and drives.

#### B.7 — The Drive · Cutscene · 1 min · the Nullarbor

1. Dawn on the endless straight road. Chloe wakes in the back of the van. She sees Chase's hands on the wheel, the blood on his knuckles. She doesn't ask. She already knows.
2. Chase, without looking back, holds the digital pet over his shoulder. She takes it. It chirps. She feeds it. Nobody speaks for a long time. Fade.

#### B.8 — Card · Title card

The manual page for Step 7. **CHLOE (V.O.):** *flat, then a shaky breath* "Step seven. Follow up. A yes is the beginning of a relationship."

#### B.9 — Tell Me · Cutscene · 3 min · the ridge above the Dead Zone

No music until the title. From beat 3 onward: **one continuous take.**

1. Weeks later. Spring grass on the ridge, the dam and the village below, brumbies in the paddock. Chloe stops walking. Chase stops beside her.
   - **CHLOE:** I never told you about her. My best friend.
   - **CHASE:** You don't have to.
   - **CHLOE:** We snuck out past the wall. There was this old shopping centre. She wanted to see the shoe shop. That's it. Shoes. *a small laugh* We got tagged in the food court. She was at forty by the time we got back to the wall. I was at one. I sat with her the whole night. In the morning she was just… scrolling. Looking right through me.
2. She looks down at the valley.
   - **CHLOE:** I waited for my turn. Every morning I counted. One. One. One. And then Wai. And Aidan. And Zane. *pause* She's still in there. Everyone is. And I'm out here.
3. **Continuous take.** She turns to face him.
   - **CHLOE:** Look at me.
   - (He does.)
   - **CHLOE:** Tell me we did the right thing.
4. Slow push-in on Chase. He holds her eyes — Step 6, maintain eye contact — for four seconds.
   - **CHASE:** …Yes.
5. A long pause. She studies his face. The player should not be able to tell whether she believes him.
   - **CHLOE:** …Okay.
6. Cut to black. **THE LAST OF YES.** Credits (section 18).

## 17. Companion dialogue and collectibles

These make the characters feel alive between cutscenes. All of it is optional for the player and mandatory for the build.

### Optional conversations

Each triggers from an "E – Talk" prompt at the listed spot.

**Chapter 1**

- **The market (Wai):**
  - **WAI:** You still got it on you?
  - **CHASE:** Got what.
  - **WAI:** Chase.
  - **CHASE:** …
  - **WAI:** If they ever scan your pockets—
  - **CHASE:** They won't.
  - **WAI:** Ten years, mate.
  - **CHASE:** Drop it.
- **Landlines basement (Chloe and Wai; Chase listens):**
  - **CHLOE:** Were you really a store manager?
  - **WAI:** Best in Queensland.
  - **CHLOE:** What did you actually do?
  - **WAI:** Taught teenagers to smile at people who were yelling at them.
  - **CHLOE:** Sounds hard.
  - **WAI:** Hardest job in the world. Till the world ended.
- **Tower stairwell (Chloe):**
  - **CHLOE:** Have you killed a lot of people?
  - **CHASE:** Keep your voice down.
  - **CHLOE:** That's not a no.
  - **CHASE:** It's a keep your voice down.

**Chapter 2**

- **Tech Support's shop:**
  - **CHLOE:** Can you fix anything?
  - **TECH SUPPORT:** Anything with a screw in it.
  - **CHLOE:** *nodding at Chase* Could you fix him?
  - **TECH SUPPORT:** No screws in him. That's the problem.
- **The road, topic "Music":**
  - **CHLOE:** What music did you like? Before.
  - **CHASE:** Old stuff.
  - **CHLOE:** Sing some.
  - **CHASE:** No.
  - **CHLOE:** *singing* "Say yes to the rest—"
  - **CHASE:** Where'd you hear that?
  - **CHLOE:** Wai. On the stairs. He was humming it. *pause* Sorry.
  - **CHASE:** *long pause* He was flat.
- **The road, topic "The beads":**
  - **CHLOE:** What's with the beads? The D's a different colour.
  - **CHASE:** It kept falling off. She fixed it with the wrong bead.
  - **CHLOE:** She?
  - **CHASE:** …Drop it.

**Chapter 3**

- **The shopping centre, after the first kill:**
  - **CHLOE:** Does it get easier?
  - **CHASE:** Yes.
  - **CHLOE:** Is that good?
  - **CHASE:** No.
- **Head office lobby (Aidan and Chloe at a wall decal):**
  - **AIDAN:** *reading* "Fail fast."
  - **CHLOE:** They did.
  - **AIDAN:** *snorting* Put that on my grave.
  - **CHLOE:** Don't.
- **Before the cul-de-sac (Zane):**
  - **ZANE:** If something happens to me—
  - **CHASE:** Nothing's happening to you.
  - **ZANE:** If it does. Get him to the coast. There's boats at Pittwater.
  - **CHASE:** …
  - **ZANE:** Say it.
  - **CHASE:** Yeah.

**Chapter 4**

- **The clinic (Luke's wife patches Chloe's hand):**
  - **LUKE'S WIFE:** Where are you from, love?
  - **CHLOE:** Brisbane. The QZ.
  - **LUKE'S WIFE:** And you're with Chase?
  - **CHLOE:** Sort of.
  - **LUKE'S WIFE:** He came here once, years ago. Stayed one night. Left before breakfast.
  - **CHLOE:** He does that.
- **The paddock (Luke and Chloe):**
  - **LUKE:** He used to be funny, you know.
  - **CHLOE:** Chase? No.
  - **LUKE:** Funniest bloke in the store. Did the regional manager's voice so well he got written up for it.
  - **CHLOE:** What happened?
  - **LUKE:** Ask him.
  - **CHLOE:** He won't tell me.
  - **LUKE:** Then he's not ready. He's slow. But he gets there.

**Chapter 5**

- **The lab, a board of fifty volunteer photos (before 5.4):**
  - **CHLOE:** They all went ninety-nine.
  - **CHASE:** Yeah.
  - **CHLOE:** *touching one photo* I'm going to make it count. For them.
  - **CHASE:** …

**Chapter 6**

- **The hut (Chloe to sleeping Chase):**
  - **CHLOE:** You'd hate this. I'm doing everything. *pause* Don't die, okay? You'd make it so weird.
- **Outside the hut at dawn (Chloe to Horse):**
  - **CHLOE:** Don't tell him I named you.

**Chapter 7**

- **The boardwalk bench:**
  - **CHLOE:** Do you think whales know about us?
  - **CHASE:** Hope not.
- **The dormitory (Chloe bouncing on a bed, before 7.10):**
  - **CHLOE:** Chase. It's got springs.
  - **CHASE:** Go to sleep.
  - **CHLOE:** After the scan, can we go back? To the whales?
  - **CHASE:** …
  - **CHLOE:** That's a yes.
  - (Chase says nothing.)
- **The courtyard (a Landline cook, title):**
  - **THE COOK:** My boy's out there. Went ninety-nine at fourteen. Wanders the river foreshore. I see him some mornings. *pause* If the girl can… Well. You know.

### The Sales Tips

Twelve "E – Joke" moments hidden at quiet spots, like a pun book. Chloe reads a tip from The Yes Way and riffs on it. They stop after Chapter 5 except the last two, which play very differently.

| # | Chapter | The tip | The riff |
| --- | --- | --- | --- |
| 1 | 1 | "Always smile! Customers can hear it." | **CHLOE:** Can they hear it through a gas mask? |
| 2 | 1 | "Mirror your customer's body language." | She copies Chase's slouch exactly. **CHASE:** Stop. **CHLOE:** *slouching harder* Stop. |
| 3 | 2 | "Never say no. Say 'What I can do is…'" | **CHLOE:** What I can do is stab it. |
| 4 | 2 | "The customer doesn't want a drill. They want a hole." | **CHLOE:** …That's so dark, out of context. |
| 5 | 2 | "Always offer the case!" | **CHLOE:** Chase, would you like a case with your shotgun? **CHASE:** Would you like a lift or a walk? |
| 6 | 3 | "Handle the objection, not the customer." | **CHLOE:** *looking at a dead Door Knocker* Too late. |
| 7 | 3 | "Silence is a closing tool." | **CHLOE:** You'd be the best closer in the world. **CHASE:** … **CHLOE:** See? |
| 8 | 4 | "Every interaction is a relationship!" | **CHLOE:** So what are we, Chase? Prepaid? **CHASE:** Month to month. **CHLOE:** Wow. |
| 9 | 4 | "Use the customer's name. People love hearing their own name." | **CHLOE:** *pointedly* People. Love. Hearing. Their own name. **CHASE:** Noted. **CHLOE:** Is it though. |
| 10 | 5 | "You're not selling a phone. You're selling connection." | **CHLOE:** *quietly* …Huh. |
| 11 | 7 | "Don't overpromise." | Chloe reads it flat and closes the book. Chase looks away. |
| 12 | 7 | "Always ask for the referral!" | Only in the dormitory before 7.10. **CHLOE:** Chase. Do you know anyone else who wants to be shot at? **CHASE:** *a real smile* No. Just you. |

### Chloe's remarks on the world

Play one when she's near a tagged object and nothing else is happening. Each plays once. Write at least 40 in total; here are the kind:

- *A dead phone on the ground:* "Everyone just dropped them. Like they were hot."
- *A cot in an apartment:* (she says nothing and walks faster)
- *A MIDNIGHT LAUNCH banner:* "Be first. Wow. They were."
- *A COMMS execution poster:* "They hung these in our classroom."
- *A school:* "I did two years of school. Then they made it a barracks."
- *A kids' trampoline:* "I've always wanted to go on one. Not now. I'm not stupid."
- *Snow, first time:* "It's so quiet. Why is it so quiet?"
- *A shoe shop:* (a long pause) "…Keep going."
- *A coiled-cord symbol on a door:* "Dial tone. We're on the right track."
- *A Store of the Year plaque in another store:* "Wai's was nicer."

### Barks

Short contextual lines with cooldowns (8–20 s per bark, 60 s before any exact repeat).

| Speaker | When | Lines |
| --- | --- | --- |
| Chase (before 6.10) | Combat and stealth | "Stay low." "Behind you." "Kid, stay close." "Reloading." "Got one." "Quiet." "Don't run." "Trainee, move." |
| Chase (after 6.10) | Same | "Stay low." "Behind you." "Chloe, stay close." "Reloading." "Chloe, you good?" "With me, Chloe." |
| Chloe | Combat | "Chase, left!" "Behind you!" "He's down!" "Got you some bars!" "Want this?" "That was gross." "Clicker, clicker, clicker—" "Get OFF him!" (the rescue stab) "Nice!" |
| Chloe | Stealth | "I'll stay behind you." "Why are they so slow? Good. Stay slow." "Don't breathe. Don't breathe." |
| Door Knockers | Searching and fighting | "Knock knock!" "Just two minutes of your time!" "I'm not selling anything!" "Sign here, champ!" "Round the back!" "He's not interested!" "Great chat!" (when a friend dies) "Closer wants 'em alive!" |
| Retreat | Searching and fighting | "Team, eyes up." "Let's circle back to the kitchen." "Touch base with the east wing." "Synergy, people!" "Take it offline." "Breach in Breakout Room B!" "She's a flight risk!" |
| COMMS | Searching and fighting | "Look up! Look up!" "Show me your eyes!" "Scanner's pinging!" "Screen check, now!" "Contact, contact!" |
| Smugglers and bandits | Searching and fighting | "That's our stock!" "Who let them in?" "Get the turbine!" "Cut the lights!" |
| Landlines (Ending B) | See B.3 | Pleading, never villainous |
| Scrollers | Idle and chasing | "just one more" "wait, watch this" "did you see this" "refresh" "lol" "who's that" "you have to see this" |

### Collectibles and the Journal

- **Artifacts (30):** notes and objects with a short text each, read in the Journal. Examples: a COMMS notice listing "screen offences"; a text thread printed on a kiosk receipt between two friends arguing about who'd stopped replying; Tech Support's old repair tickets ("cracked screen — customer says 'it's fine, I'll still use it'"); a Landlines pamphlet about the dial tone; the Retreat's whiteboard of targets; a child's drawing at the Dead Zone of "what a phone looks like" (it's a sandwich with buttons); the INFINITE launch press release.
- **Lost Lanyards (20):** Optus staff lanyards on bodies and floors. Every name has been scratched out; only titles and stores remain ("—— · Store Manager · Toowong", "—— · Trainee · Chermside"). Chloe comments on some ("Another trainee."). In the Journal they form a list of titles with no names: the naming theme, made physical.
- **Sales Training Modules (12):** unlock skills (section 6).
- **The Journal** is Chloe's copy of The Yes Way. Its margins fill up with her pencil doodles as the game goes on: a drawing of each companion when they're met (Wai with his bat, Tech Support's beard, Aidan and the pet, Horse), with small additions after they die (a halo on Aidan's cap, a little star by Wai). After Chapter 6 a new doodle appears: Chase, drawn carefully, labelled "Chase" in her handwriting.

## 18. Menus, UI and credits

### Boot and title screen

1. On load, a black screen with a small pulsing coiled-cord icon while procedural assets build. Show a percentage, never a tip.
2. A single line of white text: "Click to begin" (unlocks audio).
3. **Title screen:** a slow, live camera drift through the Optus Redcliffe store ten years on. Vines through the ceiling, a fig tree growing out of the demo table, the leaderboard whiteboard still reading CHASE 312, and a faded yellow polo on a hanger swaying in the breeze from the broken window. Dawn light. The theme plays once, then ambience: birds, wind, a distant click.
4. Logo: **THE LAST OF YES** in thin, widely spaced white capitals. The "S" of YES is very slightly faded, as if the sign is dying.
5. Menu in small caps down the left: CONTINUE, NEW GAME, CHAPTERS, SETTINGS, EXTRAS. Hover sound: a soft pluck from the theme.

### In-game UI

- **Pause** (the world freezes and desaturates slightly): Resume, Journal, Settings, Restart Checkpoint, Quit to Menu.
- **Journal:** Chloe's copy of The Yes Way rendered as a book, pages turned with a paper sound. Tabs: Manual (the seven steps with her doodles), Artifacts, Lost Lanyards, Training, and "People" (her drawings of each companion).
- **Backpack:** a radial crafting wheel over a live, still-moving world, with ingredient counts and a hold-to-craft ring.
- **Workbench:** a close-up camera on the bench; Chase's hands work on the gun while upgrades are chosen from a list of short, plain descriptions.
- **Prompts:** small, lowercase, bottom-centre, e.g. "e – talk", "e – pick up", "hold q – airplane mode".
- **Chapter transitions:** the manual title card (section 4), then straight into the chapter; no stats screens.
- **Death:** fade to black under a single click, then "Retry" auto-selected after one second.

### Credits

A slow scroll in thin white type on black, with the theme on solo piano.

1. **Named characters first,** one per line with a moment of space around each: Chase, Chloe, Wai, Zane, Aidan, Luke.
2. Then a pause, and the titles, in smaller type: Bub, The Operator, Level 3, Tech Support, The Closer, The Regional, the Wholesaler, the Facilitator, the Chef, Luke's wife, Soldier.
3. Then the Lost Lanyards the player found, listed as titles only.
4. Final credit line: "For everyone still looking down."
5. After the credits, return to the title screen. The title-screen polo is gone from the hanger. In Ending A, the digital pet sits on the counter, chirping. In Ending B, two mugs sit on the counter. Unlock Chapters and Extras.

### Extras (after finishing)

- **Chapters:** replay any chapter, with collectibles tracked.
- **Cutscene theatre:** watch any scene seen so far.
- **Cast:** each character on a slow turntable under the credits lighting, with their bible line and a play button for one of their lines.

## 19. Build milestones and acceptance checklist

This game is too large to write in one pass. Build it in eight milestones. **At the end of every milestone, emit the complete `the-last-of-yes.html`, never a diff.** Each build must run from the title screen to the end of the last finished chapter with zero console errors. Until the final milestone, the game may stop after the last finished chapter on a plain "End of current build" screen; remove it in Milestone 8. When the user says "next" or "continue", deliver the next milestone.

| Milestone | Delivers | Done when |
| --- | --- | --- |
| 1. Engine and Director | Renderer and post-processing; player controller and camera; input; settings; save; subtitles; the Director with the full scene format; walk-and-talk queue; title cards; a test scene | A test scene plays with letterbox, shot/reverse-shot, depth of field and lines, then blends into gameplay with no fade |
| 2. Characters | Character factory, face rig and emotes, procedural animation and gestures, all main and title characters | A turntable shows every character; each can walk, talk with visemes, blink, look at a target, hug and carry |
| 3. Systems | Stealth, Airplane Mode, all infected types, human AI, weapons, crafting, workbenches, health, HUD, companion AI, barks | A sandbox area has every enemy type fighting correctly and Chloe following, hiding, calling out and rescuing |
| 4. Prologue and Chapter 1 | Areas P1–P5 and 1A–1H, scenes P.1–1.11, score and ambience for both | Playable from the title screen through Wai's death to the Onebar rooftop |
| 5. Chapters 2 and 3 | Areas 2A–2G and 3A–3G, the Bloatware, the Group Chat boss | Playable through the graves in 3.12 |
| 6. Chapters 4 and 5 | Areas 4A–4E and 5A–5D, horse riding, film night | Playable through "Get up" and the fade to white |
| 7. Chapter 6 | Areas 6A–6E, Chloe as the player, the Regional boss | Playable through scene 6.10 |
| 8. Chapter 7, endings, polish | Areas 7A–7D, the choice, both endings, credits, extras; final audio, grading and performance pass | Both endings reachable; full run 2.5–3 hours on Normal |

### Acceptance checklist

**Story and characters**

- [ ] Every scripted line appears verbatim, spoken by the right character, with the given emote.
- [ ] Only the six named characters have names anywhere in the game, including enemy barks, notes and credits.
- [ ] Chase never says "Chloe" before scene 6.10, and never says "Trainee" after it; his barks switch.
- [ ] Chase's dialogue never reveals the tape to Chloe before 7.10; the camera shows the tape exactly where the script says.
- [ ] Every optional conversation, sales tip and remark in section 17 is reachable.
- [ ] Chloe comments on her surroundings at least once every two minutes of calm gameplay.

**Cinematics**

- [ ] Every cutscene starts from the gameplay camera or a deliberate hard cut and returns to gameplay with a blend, not a fade (unless scripted).
- [ ] The eight marked long takes contain no cuts in their marked sections.
- [ ] The heaviest scenes play without music as specified; the theme first appears at the end of the prologue.
- [ ] Letterbox, depth of field and colour grading change per scene as written.
- [ ] No cutscene runs longer than 4.5 minutes; most run 1.5 to 2.5.

**The choice**

- [ ] Neither option is pre-selected, there is no timer, and confirming requires a 1.5 s hold.
- [ ] Chloe's idle lines play at 20, 45, 90 and 150 seconds, then stop.
- [ ] Both endings play in full and end on the same title card; neither is labelled canon.

**Gameplay**

- [ ] Stealth is readable: the player always knows why they were spotted.
- [ ] Clickers kill on grab unless Chase has a shiv; companions never break stealth.
- [ ] Chloe never blocks a doorway, never gets stuck, and needs pallets or planks at every water crossing.
- [ ] Supplies stay scarce on Normal; the player is never soft-locked without ammo (spawn a minimal emergency supply at checkpoints if needed).
- [ ] Checkpoints every 2–4 minutes; death to retry in under 3 seconds.

**Technical**

- [ ] One HTML file; Three.js r0.160.0 from jsdelivr is the only external request.
- [ ] Zero console errors or warnings across a full playthrough.
- [ ] 60 fps on High on a mid-range laptop; no area drops below 30 fps on Low.
- [ ] Areas load and unload behind diegetic cover with no visible pop-in or hitches.
- [ ] The game runs correctly with `localStorage` blocked.
- [ ] All settings work and persist; subtitles are readable at every size.
