// ============================================================================
// Player UI — extensions to UI for Play's features (spec §18 in-game UI). Owned by: systems (player) agent.
// Assigned onto UI at evaluation time; DOM is created on first use inside #ui, above the HUD and below menus/fades.
//   UI.backpack(state | null)   radial crafting wheel over the live world. state: { sel, progress 0..1, recipes: [{id, name,
//                               use, can, count, need: [{name, n, have}]}], items: [{name, n}], melee, bars }
//   UI.workbench(state | null)  upgrade list: { guns: [names], gi, row, bars, list: [{name, text, cost, owned, can}] }
//   UI.toast(text, sub?)        small pickup/craft line, bottom right above the HUD (fades after ~3 s)
//   UI.reader({title, text} | null)   an artifact's text on a paper card, "e – close"
//   UI.struggle(p 0..1 | null)  grab struggle gauge ("mash f")
//   UI.progress(label, p 0..1 | null)  small hold ring (first aid)
//   UI.scope(k 0..1)            rifle scope mask and reticle
//   UI.playTick(dt)             per-frame animation (called by Play.update)
// ============================================================================
Object.assign(UI, (() => {
  const SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif';
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const PAD = { e: 'x', f: 'y', space: 'a', tab: 'back', 'w/s': 'd-pad', 'a/d': 'd-pad' };
  const key = k => `<b class="k${Input.device === 'pad' ? ' pad' : ''}">${esc(Input.device === 'pad' ? PAD[k] || k : k)}</b>`;
  const CSS = `
#up{position:absolute;inset:0;pointer-events:none;font-family:${SANS};color:#fff;-webkit-font-smoothing:antialiased;z-index:3}
#up .l{position:absolute;inset:0;visibility:hidden;opacity:0;transition:opacity .25s}
#up .on{visibility:visible;opacity:1}
#up .k{font-weight:600}#up .k.pad{display:inline-flex;align-items:center;justify-content:center;min-width:1.5em;height:1.5em;padding:0 .35em;border:1px solid rgba(255,255,255,.75);border-radius:1em;font-size:.8em}
#up .d{opacity:.55;margin:0 .45em}
#up .cap{text-transform:uppercase;letter-spacing:.32em;font-weight:300}
.up-shade{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 50%,rgba(0,0,0,.52) 0,rgba(0,0,0,.36) 38%,rgba(0,0,0,.14) 75%)}
.up-ring{position:absolute;left:50%;top:50%;width:min(66vh,86vw);height:min(66vh,86vw);transform:translate(-50%,-50%);overflow:visible;filter:drop-shadow(0 0 6px rgba(0,0,0,.5))}
.up-ring .sec{fill:rgba(255,255,255,.06);stroke:rgba(255,255,255,.18);stroke-width:.5;transition:fill .15s}
.up-ring .sec.sel{fill:rgba(255,255,255,.2);stroke:rgba(255,255,255,.85);stroke-width:.8}
.up-ring .ic{fill:none;stroke:#fff;stroke-width:1.3;stroke-linecap:round;stroke-linejoin:round}
.up-ring .dim{opacity:.35}
.up-ring text{fill:#fff;font-family:${SANS};font-weight:300;letter-spacing:.18em;text-transform:uppercase}
.up-ring .pr{fill:none;stroke:#fff;stroke-width:2.2;stroke-linecap:round;transform:rotate(-90deg)}
.up-ring .pr0{fill:none;stroke:rgba(255,255,255,.12);stroke-width:1}
.up-c{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(22vh,30vw);text-align:center;text-shadow:0 1px 3px rgba(0,0,0,.9)}
.up-c .n{font-size:max(12px,1.9vh);margin-bottom:.9vh}
.up-c .x{font-size:max(9px,1.25vh);opacity:.6;letter-spacing:.2em;margin-bottom:1.4vh}
.up-c .rq{font-size:max(10px,1.4vh);line-height:1.6}
.up-c .rq .no{color:#ff9478}
.up-c .u{font-size:max(9px,1.2vh);opacity:.55;line-height:1.45;margin-top:1.2vh}
.up-hint{position:absolute;left:50%;bottom:6vh;transform:translateX(-50%);font-size:max(11px,1.6vh);letter-spacing:.08em;text-transform:lowercase;white-space:nowrap;text-shadow:0 1px 3px rgba(0,0,0,.85)}
.up-inv{position:absolute;left:5vw;top:50%;transform:translateY(-50%);font-size:max(10px,1.35vh);line-height:2.15;text-shadow:0 1px 3px rgba(0,0,0,.85)}
.up-inv div{display:flex;justify-content:space-between;gap:2.4em;opacity:.8}.up-inv .z{opacity:.32}
.up-inv .h{font-size:max(9px,1.1vh);opacity:.5;margin-bottom:.8vh}
.up-wb{position:absolute;left:5.5vw;top:50%;transform:translateY(-50%);width:min(40vw,520px);text-shadow:0 1px 3px rgba(0,0,0,.85)}
.up-wb .h{font-size:max(13px,2.1vh);margin-bottom:.6vh}
.up-wb .b{display:flex;align-items:center;gap:.6em;font-size:max(10px,1.4vh);opacity:.75;margin-bottom:2.6vh}
.up-wb .tabs{display:flex;gap:2.2em;font-size:max(10px,1.35vh);margin-bottom:1.6vh}
.up-wb .tabs span{opacity:.35}.up-wb .tabs .s{opacity:1;border-bottom:1px solid #fff;padding-bottom:.4vh}
.up-wb .r{display:flex;justify-content:space-between;align-items:center;gap:1.5em;padding:1.35vh 1vw;border-bottom:1px solid rgba(255,255,255,.08);opacity:.5}
.up-wb .r.s{opacity:1;background:linear-gradient(90deg,rgba(255,255,255,.1),rgba(255,255,255,0))}
.up-wb .r .nm{font-size:max(11px,1.5vh);margin-bottom:.5vh}.up-wb .r .tx{font-size:max(10px,1.35vh);opacity:.7}
.up-wb .r .cs{display:flex;align-items:center;gap:.25em;white-space:nowrap;font-size:max(9px,1.2vh)}
.up-wb .r .cs.no{opacity:.45}.up-wb .r .ok{letter-spacing:.25em;opacity:.8}
.up-wb .foot{margin-top:2.4vh;font-size:max(10px,1.35vh);opacity:.6;display:flex;gap:1.8em;text-transform:lowercase}
.up-cell{display:inline-block;width:.42em;height:.9em;border:1px solid currentColor;border-radius:.12em;position:relative}
.up-cell::after{content:'';position:absolute;left:1px;right:1px;bottom:1px;height:55%;background:currentColor;opacity:.8}
.up-toast{position:absolute;right:3.6vw;bottom:22vh;display:flex;flex-direction:column;align-items:flex-end;gap:1vh;text-shadow:0 1px 3px rgba(0,0,0,.9)}
.up-toast div{font-size:max(11px,1.55vh);letter-spacing:.08em;text-transform:lowercase;transition:opacity .4s,transform .4s}
.up-toast small{display:block;text-align:right;font-size:.78em;opacity:.55;margin-top:.3vh}
.up-rd{position:absolute;right:9vw;top:50%;transform:translateY(-50%) rotate(.8deg);width:min(30vw,420px);min-width:280px;padding:4vh 2.4vw 4.4vh;color:#23211d;
  background:linear-gradient(170deg,#efe9dc,#e3dac6 60%,#d9ceb6);box-shadow:0 1.5vh 5vh rgba(0,0,0,.55),inset 0 0 6vh rgba(120,90,40,.15)}
.up-rd .t{font-size:max(11px,1.45vh);letter-spacing:.24em;text-transform:uppercase;font-weight:600;margin-bottom:2.4vh}
.up-rd .x{font-size:max(12px,1.7vh);line-height:1.62;white-space:pre-wrap}
.up-rd-p{position:absolute;right:9vw;bottom:14vh;font-size:max(11px,1.6vh);letter-spacing:.08em;text-shadow:0 1px 3px rgba(0,0,0,.85)}
.up-st{position:absolute;left:50%;bottom:17vh;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:1.4vh;text-shadow:0 1px 3px rgba(0,0,0,.85)}
.up-st svg{width:max(58px,8.5vh);height:max(58px,8.5vh);transform:rotate(-90deg);overflow:visible}
.up-st .kb{position:absolute;top:0;left:50%;width:max(58px,8.5vh);height:max(58px,8.5vh);margin-left:calc(max(58px,8.5vh) / -2);display:flex;align-items:center;justify-content:center;font-size:max(16px,2.6vh);font-weight:600}
.up-st .lb{font-size:max(11px,1.5vh);letter-spacing:.3em;text-transform:uppercase;font-weight:300}
.up-pg{position:absolute;left:50%;bottom:11vh;transform:translateX(-50%);display:flex;align-items:center;gap:.8em;font-size:max(10px,1.4vh);letter-spacing:.1em;text-transform:lowercase;text-shadow:0 1px 3px rgba(0,0,0,.85)}
.up-pg svg{width:2.2em;height:2.2em;transform:rotate(-90deg)}
.up-sc{position:absolute;inset:0;z-index:-1;background:radial-gradient(circle at 50% 50%,rgba(0,0,0,0) 0,rgba(0,0,0,0) calc(min(42vh,40vw) - 2px),rgba(8,8,8,.75) calc(min(42vh,40vw) - 1px),#050505 calc(min(42vh,40vw) + 1.2vh))}
.up-sc i{position:absolute;background:rgba(0,0,0,.85)}
.up-sc .v{left:50%;width:1px;top:calc(50% - min(42vh,40vw));bottom:calc(50% - min(42vh,40vw))}.up-sc .hz{top:50%;height:1px;left:calc(50% - min(42vh,40vw));right:calc(50% - min(42vh,40vw))}
.up-sc .v::after,.up-sc .hz::after{content:'';position:absolute;background:transparent}
.up-sc .dot{left:calc(50% - 2px);top:calc(50% - 2px);width:4px;height:4px;border-radius:50%;background:#e8402a;box-shadow:0 0 6px rgba(255,80,40,.8)}
.up-sc .gap{left:calc(50% - 3.5vh);top:calc(50% - 3.5vh);width:7vh;height:7vh;background:none;border:1px solid rgba(0,0,0,.35);border-radius:50%}
`;
  let root = null;
  const el = {};
  function ensure() {
    if (root) return;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    root = document.createElement('div'); root.id = 'up';
    root.innerHTML = `<div class="l sc"><div class="up-sc"><i class="v"></i><i class="hz"></i><i class="gap"></i><i class="dot"></i></div></div>
<div class="l bp"><div class="up-shade"></div><svg class="up-ring" viewBox="-130 -130 260 260"></svg><div class="up-c"></div><div class="up-inv"></div><div class="up-hint"></div></div>
<div class="l wb"><div class="up-shade" style="background:linear-gradient(90deg,rgba(0,0,0,.72),rgba(0,0,0,.35) 45%,rgba(0,0,0,0) 75%)"></div><div class="up-wb"></div></div>
<div class="l rd"><div class="up-rd"><div class="t"></div><div class="x"></div></div><div class="up-rd-p"></div></div>
<div class="l st"><div class="up-st"><svg viewBox="-24 -24 48 48"><circle r="20" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="1.5"/><circle class="m" r="20" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="125.66" stroke-dashoffset="125.66"/></svg><div class="kb"></div><div class="lb">struggle</div></div></div>
<div class="l pg"><div class="up-pg"><svg viewBox="-12 -12 24 24"><circle r="10" fill="none" stroke="rgba(255,255,255,.2)" stroke-width="1.5"/><circle class="m" r="10" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="62.83" stroke-dashoffset="62.83"/></svg><span></span></div></div>
<div class="up-toast"></div>`;
    document.getElementById('ui').appendChild(root);
    for (const k of ['sc', 'bp', 'wb', 'rd', 'st', 'pg']) el[k] = root.querySelector('.' + k);
    el.ring = root.querySelector('.up-ring'); el.center = root.querySelector('.up-c'); el.inv = root.querySelector('.up-inv'); el.hint = root.querySelector('.up-hint');
    el.wbBox = root.querySelector('.up-wb'); el.toast = root.querySelector('.up-toast');
  }
  const show = (k, on) => { ensure(); el[k].classList.toggle('on', !!on); };

  // ---- backpack wheel --------------------------------------------------------------------------------------------------
  const ICON = {
    medkit: '<rect x="-9" y="-7" width="18" height="14" rx="2"/><path d="M0 -4V4M-4 0H4"/>',
    shiv: '<path d="M-9 9L-3 3M-5 1L1 7M-3 3L8 -8L9 -9L7 -3L2 1"/><path d="M-7 5L-5 7"/>',
    pillow: '<path d="M-9 -2C-9 -7 -5 -8 0 -8C5 -8 9 -7 9 -2C9 4 5 6 0 6C-5 6 -9 4 -9 -2Z"/><path d="M0 -3C2 -1 3 1 1 3C0 1 -1 1 -2 2C-2 0 -1 -1 0 -3Z"/>',
    ringtone: '<rect x="-4" y="-9" width="8" height="18" rx="1.5"/><path d="M-2 -6H2V-2H-2Z"/><path d="M7 -5C9 -2 9 2 7 5M9.5 -7.5C12.5 -3 12.5 3 9.5 7.5"/>',
    vape: '<path d="M-8 4C-11 4 -11 -1 -8 -1C-8 -5 -3 -6 -1 -3C0 -6 6 -6 6 -2C10 -2 10 4 6 4Z"/><path d="M-6 8H6"/>',
    blade: '<path d="M-9 9L1 -1M1 -1L9 -9L6 -2L1 -1Z"/><path d="M-6 3L-3 6M-4 1L-1 4"/>',
  };
  function arcPath(a0, a1, r0, r1) {
    const P = (a, r) => `${(Math.sin(a) * r).toFixed(2)} ${(-Math.cos(a) * r).toFixed(2)}`;
    return `M${P(a0, r1)}A${r1} ${r1} 0 0 1 ${P(a1, r1)}L${P(a1, r0)}A${r0} ${r0} 0 0 0 ${P(a0, r0)}Z`;
  }
  let bpKey = '';
  function backpack(s) {
    show('bp', s);
    if (!s) { bpKey = ''; return; }
    const N = s.recipes.length, step = Math.PI * 2 / N, gap = 0.035;
    const k = JSON.stringify([s.sel, s.recipes.map(r => [r.can, r.count]), s.items, s.melee, Input.device]);
    if (k !== bpKey) {
      bpKey = k;
      let svg = '';
      s.recipes.forEach((r, i) => {
        const a = i * step, on = i === s.sel;
        svg += `<path class="sec${on ? ' sel' : ''}" d="${arcPath(a - step / 2 + gap, a + step / 2 - gap, 62, 102)}"/>`;
        const x = Math.sin(a) * 82, y = -Math.cos(a) * 82;
        svg += `<g class="ic${r.can ? '' : ' dim'}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(1.05)">${ICON[r.id] || ''}</g>`;
        const lx = Math.sin(a) * 117, ly = -Math.cos(a) * 117 + 2, anchor = Math.abs(Math.sin(a)) < 0.2 ? 'middle' : Math.sin(a) > 0 ? 'start' : 'end';
        svg += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" font-size="6.2" text-anchor="${anchor}" opacity="${on ? 1 : 0.55}">${esc(r.name)}${r.count ? `<tspan dx="4" opacity=".6">${r.count}</tspan>` : ''}</text>`;
      });
      svg += `<circle class="pr0" r="55"/><circle class="pr" r="55" stroke-dasharray="345.6" stroke-dashoffset="345.6"/>`;
      el.ring.innerHTML = svg;
      const r = s.recipes[s.sel];
      const need = r.need.map(q => `<span class="${q.have < q.n ? 'no' : ''}">${esc(q.name)} ${q.have}/${q.n}</span>`).join('<br>');
      el.center.innerHTML = `<div class="n cap">${esc(r.name)}</div><div class="x">${r.id === 'blade' ? esc(s.melee ? `on the ${s.melee}` : 'no melee weapon') : `carrying ${r.count}`}</div><div class="rq">${need}</div><div class="u">${esc(r.use)}</div>`;
      el.inv.innerHTML = `<div class="h cap">ingredients</div>` + s.items.map(q => `<div class="${q.n ? '' : 'z'}"><span>${esc(q.name)}</span><span>${q.n}</span></div>`).join('') + `<div style="margin-top:1.2vh"><span>bars</span><span>${s.bars}</span></div>`;
      el.hint.innerHTML = r.can ? `hold ${key('space')}<span class="d">–</span>craft<span class="d" style="margin:0 1.4em">·</span>${key('tab')}<span class="d">–</span>close`
        : `<span style="opacity:.6">${r.id === 'blade' && !s.melee ? 'needs a melee weapon' : r.need.some(q => q.have < q.n) ? 'missing ingredients' : 'can\'t carry more'}</span><span class="d" style="margin:0 1.4em">·</span>${key('tab')}<span class="d">–</span>close`;
    }
    el.ring.querySelector('.pr').setAttribute('stroke-dashoffset', (345.6 * (1 - U.clamp(s.progress))).toFixed(1));
  }

  // ---- workbench ---------------------------------------------------------------------------------------------------------
  let wbKey = '';
  function workbench(s) {
    show('wb', s);
    if (!s) { wbKey = ''; return; }
    const k = JSON.stringify([s, Input.device]);
    if (k === wbKey) return;
    wbKey = k;
    const cells = n => Array.from({ length: n }, () => '<i class="up-cell"></i>').join('');
    el.wbBox.innerHTML = `<div class="h cap">workbench</div><div class="b">${cells(1)}<span>${s.bars} ${s.bars === 1 ? 'bar' : 'bars'}</span></div>` +
      (s.guns.length ? `<div class="tabs cap">${s.guns.map((g, i) => `<span class="${i === s.gi ? 's' : ''}">${esc(g)}</span>`).join('')}</div>` +
        s.list.map((u, i) => `<div class="r${i === s.row ? ' s' : ''}"><div><div class="nm cap">${esc(u.name)}</div><div class="tx">${esc(u.text)}</div></div>` +
          (u.owned ? '<div class="ok cap">fitted</div>' : `<div class="cs${u.can ? '' : ' no'}">${cells(u.cost)}<span style="margin-left:.5em">${u.cost}</span></div>`) + '</div>').join('')
        : '<div class="tx" style="opacity:.6">Nothing here to work on.</div>') +
      `<div class="foot"><span>${key('w/s')}<span class="d">–</span>choose</span><span>${key('e')}<span class="d">–</span>fit</span>${s.guns.length > 1 ? `<span>${key('a/d')}<span class="d">–</span>weapon</span>` : ''}<span>${key('tab')}<span class="d">–</span>leave</span></div>`;
  }

  // ---- toasts, reader, struggle, progress, scope ------------------------------------------------------------------------------
  const toasts = [];
  function toast(text, sub) {
    ensure();
    const d = document.createElement('div');
    d.innerHTML = esc(text) + (sub ? `<small>${esc(sub)}</small>` : '');
    d.style.opacity = 0; d.style.transform = 'translateY(.6vh)';
    el.toast.appendChild(d);
    toasts.push({ d, t: 0 });
    while (toasts.length > 4) toasts.shift().d.remove();
  }
  function reader(o) {
    show('rd', o);
    if (!o) return;
    root.querySelector('.up-rd .t').textContent = o.title || '';
    root.querySelector('.up-rd .x').textContent = o.text || '';
    root.querySelector('.up-rd-p').innerHTML = `${key('e')}<span class="d">–</span>close`;
  }
  let stP = null, stPulse = 0;
  function struggle(p) {
    show('st', p != null);
    if (p == null) { stP = null; return; }
    if (stP != null && p > stP + 0.05) stPulse = 1;
    stP = p;
    el.st.querySelector('.m').setAttribute('stroke-dashoffset', (125.66 * (1 - U.clamp(p))).toFixed(1));
    el.st.querySelector('.kb').innerHTML = key('f');
  }
  function progress(label, p) {
    show('pg', p != null);
    if (p == null) return;
    el.pg.querySelector('span').textContent = label;
    el.pg.querySelector('.m').setAttribute('stroke-dashoffset', (62.83 * (1 - U.clamp(p))).toFixed(1));
  }
  function scope(k) {
    ensure();
    el.sc.classList.toggle('on', k > 0);
    el.sc.style.transition = 'none';
    el.sc.style.opacity = k;
  }
  function playTick(dt) {
    if (!root) return;
    for (let i = toasts.length - 1; i >= 0; i--) {
      const t = toasts[i]; t.t += dt;
      t.d.style.opacity = t.t < 0.3 ? t.t / 0.3 : t.t > 2.6 ? Math.max(0, 1 - (t.t - 2.6) / 0.5) : 1;
      t.d.style.transform = `translateY(${(Math.max(0, 0.3 - t.t) * 2).toFixed(2)}vh)`;
      if (t.t > 3.1) { t.d.remove(); toasts.splice(i, 1); }
    }
    stPulse = Math.max(0, stPulse - dt * 6);
    el.st.querySelector('.up-st').style.transform = `translateX(-50%) scale(${(1 + stPulse * 0.12).toFixed(3)})`;
    const hide = Director.active || UI.menuOpen();
    root.style.visibility = hide ? 'hidden' : '';
  }

  return { backpack, workbench, toast, reader, struggle, progress, scope, playTick };
})());
