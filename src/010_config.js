// ============================================================================
// CONFIG, SETTINGS and U (shared math/util helpers). Owned by: core.
// ============================================================================
const PARAMS = new URLSearchParams(location.search);

const CONFIG = {
  version: 1,
  dev: PARAMS.has('dev'),
  fixedDt: 1 / 30,          // dev fast-forward step
  maxDt: 1 / 15,            // clamp for long frames
  quality: {
    low:    { scale: 0.7, maxScale: 0.8, shadowMap: 1024, bloom: true,  fxaa: true, shadows: true, pixelRatioCap: 1 },
    medium: { scale: 0.85, maxScale: 1,  shadowMap: 2048, bloom: true,  fxaa: true, shadows: true, pixelRatioCap: 1.5 },
    high:   { scale: 1,   maxScale: 1,   shadowMap: 2048, bloom: true,  fxaa: true, shadows: true, pixelRatioCap: 2 },
  },
  maxActiveAI: 12,
  aiFreezeDist: 60,
};

// Player-facing settings. Persisted by Save (Save.settings() merges stored values into this object).
const SETTINGS = {
  subtitles: true, subSize: 'M', subBg: 0.45, subNames: true,
  difficulty: 'normal',               // 'story' | 'normal' | 'hard'
  aimAssist: false, sens: 1, invertY: false, fov: 70,
  shake: true, grain: true, motion: true,
  quality: 'high',
  vol: { master: 0.9, music: 0.8, sfx: 0.9, dialogue: 1, amb: 0.8 },
  voice: false,                       // speechSynthesis for lines
};

// Shared helpers. Keep this small; module-specific helpers live inside their module closure.
const U = (() => {
  const TAU = Math.PI * 2;
  const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const inv = (a, b, v) => (v - a) / (b - a);
  const remap = (a, b, c, d, v) => lerp(c, d, clamp(inv(a, b, v)));
  // frame-rate independent exponential smoothing
  const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
  const smooth = t => t * t * (3 - 2 * t);
  const ease = {
    linear: t => t,
    in: t => t * t,
    out: t => 1 - (1 - t) * (1 - t),
    inOut: t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
    sine: t => 0.5 - 0.5 * Math.cos(Math.PI * t),
    outBack: t => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2),
  };
  const wrapAngle = a => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
  const angleDamp = (a, b, lambda, dt) => a + wrapAngle(b - a) * (1 - Math.exp(-lambda * dt));
  // Seeded PRNG (mulberry32). U.rng(seed) -> () => [0,1)
  const rng = seed => { let s = (seed >>> 0) || 1; return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
  const hash = str => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const rand = rng(12345);                       // shared non-critical randomness
  const range = (a, b, r = rand) => a + (b - a) * r();
  const pick = (arr, r = rand) => arr[Math.floor(r() * arr.length)];
  const v3 = (a, out = new THREE.Vector3()) => Array.isArray(a) ? out.set(a[0], a[1] ?? 0, a[2] ?? 0) : out.copy(a);
  const yawTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);   // yaw that faces +Z toward target
  const fwd = (yaw, out = new THREE.Vector3()) => out.set(Math.sin(yaw), 0, Math.cos(yaw));
  const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const lensToFov = mm => 2 * Math.atan(24 / (2 * mm)) * 180 / Math.PI;   // 36x24mm sensor, vertical FOV
  const words = s => (s.match(/\S+/g) || []).length;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  return { TAU, clamp, lerp, inv, remap, damp, smooth, ease, wrapAngle, angleDamp, rng, hash, rand, range, pick, v3, yawTo, fwd, dist2, lensToFov, words, sleep };
})();
