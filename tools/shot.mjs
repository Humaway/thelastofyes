// Headless test runner: builds the game, opens it in Chromium (jsdelivr routed to node_modules/three),
// reports console errors, runs optional JS steps, and saves screenshots.
// Usage:
//   node tools/shot.mjs --q "dev&goto=prologue:P.2" [--w 1280 --h 720] [--wait 2000]
//        [--ff 5] [--shot out/a.png] [--eval "GAME.dev.x()"] [--steps "ff:3,shot:out/b.png,eval:...,wait:500,key:KeyE"]
// Steps run in order after load. ff:N fast-forwards N seconds of game time (fixed 1/30 dt).
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
const root = new URL('..', import.meta.url).pathname;
const a = process.argv.slice(2), arg = (k, d) => { const i = a.indexOf('--' + k); return i < 0 ? d : a[i + 1]; };
const outHtml = root + `out/build-${process.pid}.html`;
mkdirSync(root + 'out', { recursive: true });
execFileSync('node', [root + 'tools/build.mjs', outHtml], { stdio: 'inherit' });
const W = +arg('w', 1280), H = +arg('h', 720);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errors = [];
page.on('console', m => { const t = m.type(); if (t === 'error' || t === 'warning') errors.push(`[${t}] ${m.text()}`); else if (a.includes('--log')) console.log('[log]', m.text()); });
page.on('pageerror', e => errors.push('[pageerror] ' + (e.stack || e.message)));
await page.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', r => {
  const p = r.request().url().split('three@0.160.0/')[1];
  r.fulfill({ body: readFileSync(root + 'node_modules/three/' + p), contentType: 'application/javascript' });
});
await page.goto('file://' + outHtml + '?' + arg('q', 'dev'));
await page.waitForFunction(() => window.GAME && window.GAME.ready, null, { timeout: 60000 }).catch(e => errors.push('[timeout] GAME.ready not set: ' + e.message));
await page.waitForTimeout(+arg('wait', 500));
const steps = [];
if (arg('ff')) steps.push('ff:' + arg('ff'));
if (arg('eval')) steps.push('eval:' + arg('eval'));
if (arg('shot')) steps.push('shot:' + arg('shot'));
if (arg('steps')) steps.push(...arg('steps').split(/,(?=\w+:)/));
for (const s of steps) {
  const i = s.indexOf(':'), k = s.slice(0, i), v = s.slice(i + 1);
  try {
    if (k === 'ff') await page.evaluate(n => GAME.dev.ff(+n), v);
    else if (k === 'wait') await page.waitForTimeout(+v);
    else if (k === 'eval') console.log('[eval]', JSON.stringify(await page.evaluate(v)));
    else if (k === 'key') await page.keyboard.press(v);
    else if (k === 'down') await page.keyboard.down(v);
    else if (k === 'up') await page.keyboard.up(v);
    else if (k === 'click') await page.mouse.click(W / 2, H / 2);
    else if (k === 'shot') { await page.evaluate(() => GAME.dev.render && GAME.dev.render()); mkdirSync(dirname(root + v), { recursive: true }); await page.screenshot({ path: root + v }); console.log('[shot]', v); }
  } catch (e) { errors.push(`[step ${s}] ${e.message}`); }
}
try { (await import('node:fs')).unlinkSync(outHtml); } catch {}
console.log(errors.length ? `ERRORS (${errors.length}):\n` + errors.join('\n') : 'no console errors');
await browser.close();
process.exit(errors.length ? 1 : 0);
