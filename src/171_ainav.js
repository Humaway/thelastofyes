// ============================================================================
// AINav — the AI navigation grid (internal to AI; systems agent). Built from World boxes the first time an area needs it,
// cached per area and dropped when the area unloads. Ground-floor walkable heights and blocked cells are rasterised at
// 0.3 m with the agent radius (0.2 m) baked in; 8-connected weighted A* on a binary heap; string-pulled paths; cover spots along
// low walls and tall blockers.
//   AINav.get(A) -> grid (A = area context; bounds from A.navBox or the area's boxes) · AINav.drop(areaId)
//   grid.path(from, to) -> [Vector3] | null     smoothed waypoints (the first is the next corner, the last is `to`, snapped)
//   grid.free(p) · grid.snap(p, out) -> Vector3 | null (nearest free cell) · grid.clear(a, b) (straight walk possible)
//   grid.narrow(p) -> bool (a doorway / gap under 1.2 m wide) · grid.random(around, r, rng) -> Vector3 | null
//   grid.cover -> [{ pos, dir (unit XZ, toward the blocker), low (blocker 0.75–1.5 m: crouch cover) }]
// ============================================================================
const AINav = (() => {
  const V3 = THREE.Vector3;
  const CS = 0.3, R = 0.2, CLIMB = 0.35, MAXN = 520 * 520;
  const cache = new Map();

  function build(A) {
    const o = A.origin, box = A.navBox || boundsOf(A);
    const x0 = box[0], z0 = box[1], W = Math.max(2, Math.ceil((box[2] - x0) / CS)), H = Math.max(2, Math.ceil((box[3] - z0) / CS));
    if (W * H > MAXN) return null;
    const N = W * H, h = new Float32Array(N), blk = new Uint8Array(N), top = new Float32Array(N), T = World.terrain, cap = o.y + 1.2;
    const cx = i => x0 + (i + 0.5) * CS, cz = j => z0 + (j + 0.5) * CS;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) h[j * W + i] = T ? T(cx(i), cz(j)) : 0;
    const boxes = World.boxes.filter(b => b.max.x > x0 - 1 && b.min.x < box[2] + 1 && b.max.z > z0 - 1 && b.min.z < box[3] + 1);
    const span = (mn, mx, a0) => [Math.max(0, Math.ceil((mn - a0) / CS - 0.5)), Math.floor((mx - a0) / CS - 0.5)];
    for (const b of boxes) {
      if (!b.walk || b.max.y > cap) continue;
      const [i0, i1] = span(b.min.x, b.max.x, x0), [j0, j1] = span(b.min.z, b.max.z, z0);
      for (let j = j0; j <= Math.min(H - 1, j1); j++) for (let i = i0; i <= Math.min(W - 1, i1); i++) { const k = j * W + i; if (b.max.y > h[k]) h[k] = b.max.y; }
    }
    for (const b of boxes) {
      if (!b.block) continue;
      const [i0, i1] = span(b.min.x - R, b.max.x + R, x0), [j0, j1] = span(b.min.z - R, b.max.z + R, z0);
      for (let j = j0; j <= Math.min(H - 1, j1); j++) for (let i = i0; i <= Math.min(W - 1, i1); i++) {
        const k = j * W + i;
        if (b.max.y > h[k] + World.STEP && b.min.y < h[k] + 1.7) { blk[k] = 1; top[k] = Math.max(top[k], b.max.y - h[k]); }
      }
    }
    const g = { W, H, x0, z0, h, blk, top, cover: [] };
    const idx = (x, z) => { const i = Math.floor((x - x0) / CS), j = Math.floor((z - z0) / CS); return i < 0 || j < 0 || i >= W || j >= H ? -1 : j * W + i; };
    const pos = (k, out = new V3()) => out.set(cx(k % W), h[k], cz((k / W) | 0));
    const ok = k => k >= 0 && !blk[k];
    const step = (a, b) => ok(b) && Math.abs(h[a] - h[b]) <= CLIMB;

    // ---- A* ------------------------------------------------------------------------------------------
    const gs = new Float32Array(N), from = new Int32Array(N), seen = new Uint32Array(N), shut = new Uint32Array(N), heap = new Int32Array(N), f = new Float32Array(N);
    let stamp = 0, hn = 0;
    const push = k => { let i = hn++; heap[i] = k; while (i > 0) { const p = (i - 1) >> 1; if (f[heap[p]] <= f[k]) break; heap[i] = heap[p]; i = p; } heap[i] = k; };
    const pop = () => {
      const r = heap[0], k = heap[--hn]; let i = 0;
      for (;;) { let c = i * 2 + 1; if (c >= hn) break; if (c + 1 < hn && f[heap[c + 1]] < f[heap[c]]) c++; if (f[heap[c]] >= f[k]) break; heap[i] = heap[c]; i = c; }
      heap[i] = k; return r;
    };
    const DX = [1, -1, 0, 0, 1, 1, -1, -1], DZ = [0, 0, 1, -1, 1, -1, 1, -1];
    function astar(s, t) {
      stamp++; hn = 0;
      const ti = t % W, tj = (t / W) | 0, heu = k => { const dx = Math.abs(k % W - ti), dz = Math.abs(((k / W) | 0) - tj); return (dx + dz - 0.586 * Math.min(dx, dz)) * 1.15; };
      gs[s] = 0; f[s] = heu(s); seen[s] = stamp; from[s] = -1; push(s);
      let n = 0;
      while (hn) {
        const k = pop();
        if (k === t) { const out = []; for (let c = t; c >= 0; c = from[c]) out.push(c); return out.reverse(); }
        if (shut[k] === stamp) continue;
        shut[k] = stamp;
        if (++n > 40000) return null;
        const i = k % W, j = (k / W) | 0;
        for (let d = 0; d < 8; d++) {
          const ni = i + DX[d], nj = j + DZ[d];
          if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
          const nk = nj * W + ni;
          if (shut[nk] === stamp || !step(k, nk)) continue;
          if (d > 3 && (!step(k, j * W + ni) || !step(k, nj * W + i))) continue;
          const c = gs[k] + (d > 3 ? 1.4142 : 1) + Math.abs(h[nk] - h[k]) * 2;
          if (seen[nk] !== stamp || c < gs[nk]) { seen[nk] = stamp; gs[nk] = c; f[nk] = c + heu(nk); from[nk] = k; push(nk); }
        }
      }
      return null;
    }
    // nearest free cell (rings out to ~2.4 m)
    function snapK(p) {
      const k0 = idx(p.x, p.z);
      if (ok(k0)) return k0;
      const i0 = Math.floor((p.x - x0) / CS), j0 = Math.floor((p.z - z0) / CS);
      let best = -1, bd = 1e9;
      for (let r = 1; r <= 8 && best < 0; r++) for (let j = j0 - r; j <= j0 + r; j++) for (let i = i0 - r; i <= i0 + r; i++) {
        if (Math.max(Math.abs(i - i0), Math.abs(j - j0)) !== r || i < 0 || j < 0 || i >= W || j >= H) continue;
        const k = j * W + i; if (blk[k]) continue;
        const d = (cx(i) - p.x) ** 2 + (cz(j) - p.z) ** 2; if (d < bd) { bd = d; best = k; }
      }
      return best;
    }
    // straight walk between two points: every sample free and no ledge between samples (a start hugging a wall may begin
    // up to 0.5 m inside the inflated blocker)
    function clear(a, b) {
      const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(d / (CS * 0.5)));
      let prev = -1;
      for (let s = 0; s <= n; s++) {
        const k = idx(a.x + (b.x - a.x) * s / n, a.z + (b.z - a.z) * s / n);
        if (prev < 0) { if (ok(k)) prev = k; else if (s * d / n > 0.5) return false; }
        else if (k !== prev) { if (!step(prev, k)) return false; prev = k; }
      }
      return prev >= 0;
    }
    g.free = p => ok(idx(p.x, p.z));
    g.snap = (p, out = new V3()) => { const k = snapK(p); return k < 0 ? null : pos(k, out); };
    g.clear = clear;
    g.path = (a, b) => {
      const s = snapK(a), t = snapK(b);
      if (s < 0 || t < 0) return null;
      const cells = s === t ? [s] : astar(s, t);
      if (!cells) return null;
      const pts = cells.map(k => pos(k)), out = [];
      let i = 0; const start = U.v3(a).clone();
      let cur = start;
      while (i < pts.length - 1) {
        let j = i + 1;
        while (j + 1 < pts.length && clear(cur, pts[j + 1])) j++;
        out.push(pts[j]); cur = pts[j]; i = j;
      }
      if (!out.length) out.push(pts[0]);
      const end = out[out.length - 1];
      if (ok(idx(b.x, b.z)) && clear(end, b)) end.set(b.x, end.y, b.z);
      return out;
    };
    g.narrow = p => {
      const i = Math.floor((p.x - x0) / CS), j = Math.floor((p.z - z0) / CS), b = (di, dj) => { for (let s = 1; s <= 3; s++) { const ii = i + di * s, jj = j + dj * s; if (ii < 0 || jj < 0 || ii >= W || jj >= H || blk[jj * W + ii]) return true; } return false; };
      return (b(1, 0) && b(-1, 0)) || (b(0, 1) && b(0, -1));
    };
    g.random = (around, r, rng = Math.random) => {
      for (let n = 0; n < 12; n++) {
        const a = rng() * Math.PI * 2, d = r * Math.sqrt(rng()), q = new V3(around.x + Math.cos(a) * d, 0, around.z + Math.sin(a) * d), k = idx(q.x, q.z);
        if (ok(k) && Math.abs(h[k] - around.y) < 1) return pos(k, q);
      }
      return null;
    };

    // ---- cover spots: free cells 0.3–0.6 m from a blocker at least 0.75 m tall --------------------------------
    const taken = new Set(), key = (x, z) => Math.floor(x / 1.4) + ',' + Math.floor(z / 1.4);
    const addCover = (k, di, dj, t) => {
      const p = pos(k), kk = key(p.x, p.z); if (taken.has(kk)) return;
      taken.add(kk); g.cover.push({ pos: p, dir: new V3(di, 0, dj), low: t < 1.5 });
    };
    for (let j = 2; j < H - 2; j += 2) for (let i = 2; i < W - 2; i += 2) {
      const k = j * W + i; if (blk[k]) continue;
      for (let d = 0; d < 4; d++) for (let s = 1; s <= 2; s++) {
        const nk = (j + DZ[d] * s) * W + i + DX[d] * s;
        if (blk[nk] && top[nk] >= 0.75) { addCover(k, DX[d], DZ[d], top[nk]); d = 4; break; }
        if (blk[nk]) break;
      }
    }
    for (const p of A.coverPts || []) {
      const k = snapK(p); if (k < 0) continue;
      const i = k % W, j = (k / W) | 0;
      for (let d = 0; d < 4; d++) { const nk = (j + DZ[d] * 2) * W + i + DX[d] * 2; if (nk >= 0 && nk < N && blk[nk]) { g.cover.push({ pos: pos(k), dir: new V3(DX[d], 0, DZ[d]), low: top[nk] < 1.5 }); break; } }
    }
    return g;
  }

  // default bounds: the area's boxes (clamped to 150 m around the origin)
  function boundsOf(A) {
    const o = A.origin, b = [1e9, 1e9, -1e9, -1e9];
    for (const x of World.boxes) if (x.area === A.id) { b[0] = Math.min(b[0], x.min.x); b[1] = Math.min(b[1], x.min.z); b[2] = Math.max(b[2], x.max.x); b[3] = Math.max(b[3], x.max.z); }
    if (b[0] > b[2]) return [o.x - 20, o.z - 20, o.x + 20, o.z + 20];
    return [Math.max(b[0], o.x - 75), Math.max(b[1], o.z - 75), Math.min(b[2], o.x + 75), Math.min(b[3], o.z + 75)];
  }

  return {
    get(A) { if (!A) return null; if (!cache.has(A.id)) cache.set(A.id, build(A)); return cache.get(A.id); },
    drop(id) { cache.delete(id); },
  };
})();
