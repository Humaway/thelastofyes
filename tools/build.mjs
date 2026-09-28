// Concatenates src/*.js (sorted by filename) into one module script inside src/index.html.
// Usage: node tools/build.mjs [outFile]   (default: the-last-of-yes.html)
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
const root = new URL('..', import.meta.url).pathname;
const out = process.argv[2] || root + 'the-last-of-yes.html';
const files = readdirSync(root + 'src').filter(f => f.endsWith('.js')).sort();
const js = files.map(f => `// ===== ${f} =====\n` + readFileSync(root + 'src/' + f, 'utf8')).join('\n');
const html = readFileSync(root + 'src/index.html', 'utf8').replace('/*__SRC__*/', () => js);
writeFileSync(out, html);
console.log(`built ${out} (${files.length} files, ${(html.length / 1024).toFixed(0)} KB)`);
