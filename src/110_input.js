// ============================================================================
// Input — keyboard, mouse (pointer lock), gamepad (standard mapping); named actions.
// Owned by: core.
//   Input.down(a) held now · Input.pressed(a) went down this frame · Input.released(a)
//   Input.heldTime(a) seconds held · Input.move {x,y} (y = forward) · Input.look {x,y} (per-frame delta, radians-ish)
//   Input.typed: array of printable keys pressed this frame (for typing beats) · Input.anyPressed
//   Input.device 'kbm' | 'pad'
// ============================================================================
const Input = (() => {
  const KEYS = {
    up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
    sprint: ['ShiftLeft', 'ShiftRight'], crouch: ['KeyC'], jump: ['Space'], interact: ['KeyE'], listen: ['KeyQ'],
    reload: ['KeyR'], melee: ['KeyF'], throw: ['KeyG'], backpack: ['Tab'], hint: ['KeyT'], skip: ['Space'],
    pause: ['Escape', 'KeyP'], confirm: ['Enter', 'Space'], back: ['Escape', 'Backspace'],
    slot1: ['Digit1'], slot2: ['Digit2'], slot3: ['Digit3'], slot4: ['Digit4'],
    menuUp: ['ArrowUp', 'KeyW'], menuDown: ['ArrowDown', 'KeyS'], menuLeft: ['ArrowLeft', 'KeyA'], menuRight: ['ArrowRight', 'KeyD'],
  };
  // gamepad standard mapping button indices
  const PAD = {
    jump: [0], confirm: [0], skip: [0], crouch: [1], back: [1], interact: [2], reload: [2], melee: [3],
    listen: [5], throw: [5], aim: [6], fire: [7], backpack: [8], pause: [9], sprint: [10], shoulder: [11],
    menuUp: [12], menuDown: [13], menuLeft: [14], menuRight: [15], slot1: [12], slot2: [15], slot3: [13], slot4: [14],
  };
  const keys = new Set(), mouse = new Set(), hit = new Set(), mhit = new Set(); // hit*: went down since last update (catches taps shorter than a frame)
  const state = {}, prev = {}, held = {};
  const move = { x: 0, y: 0 }, look = { x: 0, y: 0 };
  let mdx = 0, mdy = 0, wheel = 0, typed = [], anyPressed = false, anyKey = false;
  let device = 'kbm', locked = false;
  const actions = new Set([...Object.keys(KEYS), ...Object.keys(PAD), 'aim', 'fire', 'shoulder', 'next', 'prev']);

  function init() {
    addEventListener('keydown', e => {
      if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      if (!e.repeat) { keys.add(e.code); hit.add(e.code); anyKey = true; if (e.key.length === 1) typed.push(e.key); }
      device = 'kbm';
    });
    addEventListener('keyup', e => keys.delete(e.code));
    addEventListener('blur', () => { keys.clear(); mouse.clear(); });
    addEventListener('mousedown', e => { mouse.add(e.button); mhit.add(e.button); anyKey = true; device = 'kbm'; });
    addEventListener('mouseup', e => mouse.delete(e.button));
    addEventListener('contextmenu', e => e.preventDefault());
    addEventListener('mousemove', e => { if (locked) { mdx += e.movementX; mdy += e.movementY; } });
    addEventListener('wheel', e => { wheel += Math.sign(e.deltaY); }, { passive: true });
    document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement != null; });
  }

  function lock() { if (!locked && !CONFIG.dev) Engine.renderer.domElement.requestPointerLock?.()?.catch?.(() => {}); }
  function unlock() { if (locked) document.exitPointerLock?.(); }

  function update(dt) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = [...pads].find(p => p && p.mapping === 'standard') || null;
    const pb = i => gp && gp.buttons[i] && gp.buttons[i].pressed;
    if (gp && gp.buttons.some(b => b.pressed)) device = 'pad';
    for (const a of actions) {
      prev[a] = state[a] || false;
      let d = (KEYS[a] || []).some(k => keys.has(k) || hit.has(k)) || (PAD[a] || []).some(pb);
      if (a === 'aim') d = d || mouse.has(2) || mhit.has(2);
      if (a === 'fire') d = d || mouse.has(0) || mhit.has(0);
      if (a === 'shoulder') d = d || mouse.has(1) || mhit.has(1);
      state[a] = d;
      held[a] = d ? (held[a] || 0) + dt : 0;
    }
    state.next = wheel > 0; state.prev = wheel < 0; wheel = 0;
    // movement
    let mx = (state.right ? 1 : 0) - (state.left ? 1 : 0), my = (state.up ? 1 : 0) - (state.down ? 1 : 0);
    const dz = v => Math.abs(v) < 0.18 ? 0 : (v - Math.sign(v) * 0.18) / 0.82;
    if (gp) { const ax = dz(gp.axes[0] || 0), ay = dz(gp.axes[1] || 0); if (ax || ay) { mx = ax; my = -ay; device = 'pad'; } }
    const len = Math.hypot(mx, my); if (len > 1) { mx /= len; my /= len; }
    move.x = mx; move.y = my;
    // look
    const s = SETTINGS.sens, inv = SETTINGS.invertY ? -1 : 1;
    look.x = mdx * 0.0022 * s; look.y = mdy * 0.0022 * s * inv; mdx = mdy = 0;
    if (gp) { const rx = dz(gp.axes[2] || 0), ry = dz(gp.axes[3] || 0); look.x += rx * 2.6 * s * dt; look.y += ry * 1.8 * s * dt * inv; }
    anyPressed = anyKey; anyKey = false; hit.clear(); mhit.clear();
    Input.typed = typed; typed = [];
    Input.anyPressed = anyPressed;
  }

  return {
    init, update, lock, unlock, move, look, typed: [], anyPressed: false,
    down: a => !!state[a], pressed: a => !!state[a] && !prev[a], released: a => !state[a] && !!prev[a], heldTime: a => held[a] || 0,
    get device() { return device; }, get locked() { return locked; },
  };
})();
