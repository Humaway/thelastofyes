// ============================================================================
// Barks (spec §17) — CONTENT.barks[set][category] = [lines], played through Dialogue.bark by AI. Owned by: systems (AI).
// Categories used by AI: enemies spot · search · combat · flank · death (a friend went down) · plead (wounded, cornered);
// Scrollers idle · chase; Chloe callout (enemy on Chase's left) · behind · down · supplies · offer · gross · clicker ·
// rescue · nice · stealth; Chase stealth · behind · follow · reload · kill · check. Chase's set reads G.flags.saidChloe:
// from scene 6.10 on he uses her name and never says "Trainee" again.
// Enemies call each other by titles and slang, never names.
// ============================================================================
Object.assign(CONTENT.speakers, {
  doorknocker: { name: 'DOOR KNOCKER', voice: [1.0, 1.25] },
  retreat: { name: 'RETREAT', voice: [0.9, 0.95] },
  smuggler: { name: 'SMUGGLER', voice: [0.85, 1.1] },
  bandit: { name: 'BANDIT', voice: [0.8, 1.05] },
  scroller: { name: 'SCROLLER', color: '#7f8fa6', voice: [0.1, 0.6] },
});
(() => {
  const B = CONTENT.barks, before = () => !Game.G.flags.saidChloe;
  B.chase = {
    get stealth() { return before() ? ['Stay low.', 'Quiet.', "Don't run."] : ['Stay low.']; },
    behind: ['Behind you.'],
    get follow() { return before() ? ['Kid, stay close.', 'Trainee, move.'] : ['Chloe, stay close.', 'With me, Chloe.']; },
    reload: ['Reloading.'],
    get kill() { return before() ? ['Got one.'] : []; },
    get check() { return before() ? [] : ['Chloe, you good?']; },
  };
  B.chloe = {
    callout: [{ text: 'Chase, left!', emote: 'afraid' }],
    behind: [{ text: 'Behind you!', emote: 'afraid' }],
    down: ["He's down!"],
    supplies: [{ text: 'Got you some bars!', emote: 'smile' }],
    offer: ['Want this?'],
    gross: [{ text: 'That was gross.', emote: 'tense' }],
    clicker: [{ text: 'Clicker, clicker, clicker—', emote: 'afraid' }],
    rescue: [{ text: 'Get OFF him!', emote: 'angry' }],
    nice: [{ text: 'Nice!', emote: 'smile' }],
    stealth: ["I'll stay behind you.", 'Why are they so slow? Good. Stay slow.', { text: "Don't breathe. Don't breathe.", emote: 'afraid' }],
  };
  B.doorknocker = {
    speaker: 'doorknocker',
    spot: ['Knock knock!', "I'm not selling anything!"],
    search: ['Knock knock!', 'Just two minutes of your time!', "I'm not selling anything!"],
    combat: ['Sign here, champ!', "He's not interested!", "Closer wants 'em alive!"],
    flank: ['Round the back!'],
    death: ['Great chat!'],
  };
  B.retreat = {
    speaker: 'retreat',
    spot: ['Team, eyes up.'],
    search: ["Let's circle back to the kitchen.", 'Touch base with the east wing.'],
    combat: ['Synergy, people!', 'Take it offline.'],
    breach: ['Breach in Breakout Room B!'],
    flight: ["She's a flight risk!"],
  };
  B.comms = {
    speaker: 'soldier',
    spot: ['Contact, contact!'],
    search: ["Scanner's pinging!", 'Screen check, now!'],
    combat: ['Look up! Look up!', 'Show me your eyes!'],
  };
  B.smuggler = { speaker: 'smuggler', spot: ['Who let them in?'], search: ['Cut the lights!', 'Get the turbine!'], combat: ["That's our stock!"] };
  B.bandit = Object.assign({}, B.smuggler, { speaker: 'bandit' });
  B.landline = {
    speaker: 'landline',
    spot: ["He's heading for the hall!"],
    combat: ["Please — we're trying to fix it!", "Think about what you're doing!", "You're killing the whole world!", "Don't let him reach her!"],
    plead: [{ text: "My sister's out there. She's in there. Please.", emote: 'crying' }],
  };
  B.scroller = {
    speaker: 'scroller',
    idle: ['just one more', 'wait, watch this', 'did you see this', 'refresh', 'lol'],
    chase: ["who's that", 'you have to see this', 'did you see this'],
  };
})();
