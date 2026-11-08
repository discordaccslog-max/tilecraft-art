'use strict';
/* Post-build verification: node build/verify.js
 * 1. no leftover placeholder text anywhere on the site or in the zips
 * 2. every internal link and asset reference resolves
 * 3. thank-you pages are noindex, unlinked and absent from the sitemap
 * 4. every pack zip unzips and contains every file its metadata promises, at the right sizes
 * 5. license keys work for every product and unlock existing packs */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const fflate = require('fflate');
const { PNG } = require('pngjs');
const L = require('../js/license.js');

const ROOT = path.join(__dirname, '..');
const problems = [];
const fail = m => problems.push(m);
const SKIP = /[\\/](node_modules|\.git|\.review|build)([\\/]|$)/;
function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (SKIP.test(p.slice(ROOT.length)) || f === '.claude') continue;
    if (fs.statSync(p).isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}
const files = walk(ROOT);
const rel = p => path.relative(ROOT, p).split(path.sep).join('/');

/* 1. placeholder scan */
const BAD = [/\bTODO\b/, /\bFIXME\b/, /lorem/i, /ipsum/i, /coming soon/i, /\bTBD\b/, /\bXXX\b/, /placeholder text/i, /your-site-here/i, /example\.com/i];
const textFiles = files.filter(f => /\.(html|js|css|txt|md|xml|webmanifest)$/.test(f) && !/package-lock/.test(f));
let scanned = 0;
for (const f of textFiles) {
  const s = fs.readFileSync(f, 'utf8'); scanned++;
  for (const re of BAD) if (re.test(s)) fail(`placeholder pattern ${re} in ${rel(f)}`);
}

/* 2. links */
const htmlFiles = files.filter(f => f.endsWith('.html'));
let links = 0;
const linkTargets = {};
for (const f of htmlFiles) {
  const s = fs.readFileSync(f, 'utf8');
  for (const m of s.matchAll(/\s(?:href|src|data-src)="([^"]+)"/g)) {
    let u = m[1];
    if (/^(https?:|mailto:|data:|#|javascript:)/.test(u)) continue;
    links++;
    u = u.split('#')[0].split('?')[0];
    if (!u) continue;
    let target;
    if (u.startsWith('/tilecraft-art/')) target = path.join(ROOT, u.slice('/tilecraft-art/'.length));
    else if (u.startsWith('/')) { fail(`root-absolute link ${u} in ${rel(f)}`); continue; }
    else target = path.resolve(path.dirname(f), u);
    if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target, 'index.html');
    if (!fs.existsSync(target)) fail(`broken link ${m[1]} in ${rel(f)}`);
    else (linkTargets[rel(target)] = linkTargets[rel(target)] || []).push(rel(f));
  }
}
/* references made from JavaScript and JSON */
const scenes = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/scenes.json'), 'utf8'));
for (const [name, sc] of Object.entries(scenes)) for (const src of Object.values(sc.sheets)) {
  const variants = src.includes('{variant}') ? ['spring', 'summer', 'autumn', 'winter'] : [''];
  for (const v of variants) if (!fs.existsSync(path.join(ROOT, src.replace('{variant}', v)))) fail(`scene ${name} references missing ${src}`);
}
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/catalog.json'), 'utf8'));
for (const p of catalog.packs) for (const k of ['zip', 'meta']) if (!fs.existsSync(path.join(ROOT, p[k]))) fail(`catalog ${p.id} ${k} missing`);
for (const p of catalog.packs) if (!fs.existsSync(path.join(ROOT, p.icon.sheet))) fail(`catalog ${p.id} icon sheet missing`);
const swShell = fs.readFileSync(path.join(ROOT, 'studio/sw.js'), 'utf8').match(/var SHELL = \[([^\]]+)\]/)[1].match(/'([^']+)'/g).map(s => s.slice(1, -1));
for (const s of swShell) { const t = path.join(ROOT, 'studio', s); if (!fs.existsSync(t)) fail(`service worker shell file missing: ${s}`); }

/* 3. thank-you pages */
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'js/products.js'), 'utf8'), sandbox);
const products = sandbox.window.TILECRAFT_PRODUCTS;
const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
for (const p of products) {
  const f = path.join(ROOT, p.thankYouPath, 'index.html');
  if (!fs.existsSync(f)) { fail(`thank-you page missing for ${p.id}`); continue; }
  const s = fs.readFileSync(f, 'utf8');
  if (!/<meta name="robots" content="noindex/.test(s)) fail(`thank-you page ${p.id} lacks noindex`);
  if (sitemap.includes('thank-you')) fail('sitemap lists a thank-you page');
  const linkedFrom = (linkTargets[rel(f)] || []);
  if (linkedFrom.length) fail(`thank-you page ${p.id} is linked from ${linkedFrom.join(', ')}`);
  if (!fs.existsSync(path.join(ROOT, 'products', p.id, 'index.html'))) fail(`product page missing for ${p.id}`);
  if (p.checkoutUrl !== '') fail(`checkoutUrl for ${p.id} is not empty`);
}

/* 4. zips */
const zipReport = [];
for (const p of catalog.packs.concat([{ id: 'sample', zip: 'assets/packs/sample/tilecraft-sample.zip' }])) {
  const zip = fflate.unzipSync(new Uint8Array(fs.readFileSync(path.join(ROOT, p.zip))));
  const names = Object.keys(zip);
  const rootDir = names[0].split('/')[0] + '/';
  const has = n => zip[rootDir + n] !== undefined;
  const meta = JSON.parse(Buffer.from(zip[rootDir + `metadata/${p.id}.json`]).toString());
  const variants = meta.variants ? meta.variants.map(v => v.id) : [null];
  const sizeOf = n => { const png = PNG.sync.read(Buffer.from(zip[rootDir + n])); return [png.width, png.height]; };
  for (const req of ['LICENSE.txt', 'README.txt', `palette/${p.id}.hex`, `palette/${p.id}.gpl`]) if (!has(req)) fail(`${p.id}.zip lacks ${req}`);
  let checkedPNG = 0;
  for (const v of variants) {
    for (const s of meta.sheets) for (const k of [1, 2, 4]) {
      const n = s.file.replace('{variant}', v || '').replace('/1x/', `/${k}x/`);
      if (!has(n)) { fail(`${p.id}.zip lacks ${n}`); continue; }
      const [w, h] = sizeOf(n); checkedPNG++;
      if (w !== s.width * k || h !== s.height * k) fail(`${p.id}.zip ${n} is ${w}x${h}, expected ${s.width * k}x${s.height * k}`);
      if (s.tileset && !has(s.tiled.replace('{variant}', v || ''))) fail(`${p.id}.zip lacks ${s.tiled}`);
    }
    meta.assets.forEach((a, i) => {
      for (const k of [1, 2, 4]) {
        const n = a.file.replace('{variant}', v || '').replace('/1x/', `/${k}x/`);
        if (!has(n)) { fail(`${p.id}.zip lacks ${n}`); return; }
        if (i % 25 === 0) { const [w, h] = sizeOf(n); checkedPNG++; const fw = a.w * (a.frames ? a.frames.length : 1) * k; if (w !== fw || h !== a.h * k) fail(`${p.id}.zip ${n} is ${w}x${h}, expected ${fw}x${a.h * k}`); }
      }
    });
  }
  for (const m of meta.maps) { if (!has(m.file)) fail(`${p.id}.zip lacks ${m.file}`); if (!has(m.image)) fail(`${p.id}.zip lacks ${m.image}`); }
  if (meta.characters) for (const lay of meta.characters.layers) for (const k of [1, 2, 4]) if (!has(`layers/${k}x/${lay.category}/${lay.id}.png`)) fail(`${p.id}.zip lacks layer sheet ${lay.id}`);
  const readme = Buffer.from(zip[rootDir + 'README.txt']).toString();
  if (!/HOW THESE ASSETS ARE MADE/.test(readme) || !/AI assistance/.test(readme)) fail(`${p.id} README lacks the disclosure`);
  for (const n of names) if (/\.(txt|json|tsx|tmx|gpl|hex)$/.test(n)) { const s = Buffer.from(zip[n]).toString(); for (const re of BAD) if (re.test(s)) fail(`placeholder ${re} in ${p.id}.zip/${n}`); }
  zipReport.push(`${p.id}: ${names.length} files, ${meta.assets.length} assets × ${variants.length} palette(s), ${checkedPNG} PNGs decoded and size-checked`);
}

/* 5. keys */
const packIds = new Set(catalog.packs.map(p => p.id));
for (const p of products) {
  for (let i = 0; i < 200; i++) {
    const k = L.generate(p.code), r = L.parse(k);
    if (!r.ok) { fail(`generated key for ${p.id} does not validate`); break; }
    if (JSON.stringify(r.packs.slice().sort()) !== JSON.stringify(p.packs.slice().sort())) { fail(`key for ${p.id} unlocks ${r.packs} but product lists ${p.packs}`); break; }
    for (const id of r.packs) if (!packIds.has(id)) fail(`key for ${p.id} unlocks unknown pack ${id}`);
  }
}

console.log(`scanned ${scanned} text files, ${links} internal links in ${htmlFiles.length} pages`);
zipReport.forEach(r => console.log('  ' + r));
if (problems.length) { console.log(`\n${problems.length} PROBLEMS:`); [...new Set(problems)].slice(0, 80).forEach(p => console.log('  - ' + p)); process.exit(1); }
console.log('All verification checks passed.');
