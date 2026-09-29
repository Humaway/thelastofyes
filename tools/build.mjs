// Concatenates src/*.js (sorted by filename) into one module script inside src/index.html.
// Usage: node tools/build.mjs [outFile] [--dev]   (default: the-last-of-yes.html)
// Release builds leave out the dev sandboxes (src/39x_dev*.js); --dev keeps them (tools/shot.mjs uses it).
// --skip=REGEX leaves out matching files (e.g. --skip=^31 to publish a build that stops before an unfinished chapter).
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
const root = new URL('..', import.meta.url).pathname;
const args = process.argv.slice(2), dev = args.includes('--dev'), skip = args.find(a => a.startsWith('--skip='));
const skipRe = skip ? new RegExp(skip.slice(7)) : null;
const out = args.find(a => !a.startsWith('--')) || root + 'the-last-of-yes.html';
const files = readdirSync(root + 'src').filter(f => f.endsWith('.js') && (dev || !/^39\d_dev/.test(f)) && !(skipRe && skipRe.test(f))).sort();
const js = files.map(f => `// ===== ${f} =====\n` + readFileSync(root + 'src/' + f, 'utf8')).join('\n');
const html = readFileSync(root + 'src/index.html', 'utf8').replace('/*__SRC__*/', () => js);
writeFileSync(out, html);
console.log(`built ${out} (${files.length} files, ${(html.length / 1024).toFixed(0)} KB)`);
