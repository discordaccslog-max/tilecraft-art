'use strict';
/* Tilecraft Art build: draws every pack, runs every check, writes sheets, metadata,
 * Tiled files and zips, then generates the website.  Usage: node build/build.js
 *
 * Third-party libraries (permissive licenses): pngjs (MIT) for PNG encoding,
 * fflate (MIT) for zip files. Fonts: Schibsted Grotesk and Pixelify Sans (SIL OFL 1.1). */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { Raster } = require('./lib/raster.js');
const { encodePNG, scaleRGBA } = require('./lib/pack.js');
const C = require('./content.js');
const SITE = require('./site.js');
const SCENES = require('./scenes.js');

const ROOT = path.join(__dirname, '..');
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);

const MODULES = ['interface', 'meadowlands', 'effects', 'stonehollow', 'hearthvale', 'characters', 'ink', 'fourseasons', 'atlas', 'sample'];
const packs = {};
for (const m of MODULES) {
  const pack = require(`./packs/${m}.js`).build();
  packs[pack.id] = pack;
  log(`drew ${pack.name}: ${pack.assets.length} assets, ${pack.report.seamComparisons.toLocaleString()} seam pixel comparisons, ${pack.report.redraws} redraws`);
}

fs.rmSync(path.join(ROOT, 'assets', 'packs'), { recursive: true, force: true });
const texts = { license: C.licenseText(), readme: C.readmeText };
for (const pack of Object.values(packs)) {
  pack.exportInfo = pack.exportAll(ROOT, texts);
  log(`exported ${pack.id}: ${pack.exportInfo.fileCount} files, zip ${(pack.exportInfo.zipSize / 1048576).toFixed(2)} MB`);
}

/* products from the owner-editable file */
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'js', 'products.js'), 'utf8'), sandbox);
const products = sandbox.window.TILECRAFT_PRODUCTS;

/* catalog for the studio */
const icons = { interface: 'ui-dusk-slot-selected', meadowlands: 'md-tree-oak', effects: 'fx-sparkle-gold', stonehollow: 'sh-chest-gilded', hearthvale: 'hv-well', 'character-kit': 'ck-hair-bun-teal-idle-down', 'ink-edition': 'nk-item-key', 'four-seasons': 'fs-meadow-tree', 'grand-atlas': 'ga-marker-castle' };
const catalog = Object.values(packs).filter(p => p.id !== 'sample').map(p => {
  const st = p.stats(), ia = p.asset(icons[p.id]);
  return { id: p.id, name: p.name, code: p.code, zip: `assets/packs/${p.id}/${p.exportInfo.zipName}`, zipSize: p.exportInfo.zipSize, fileCount: p.exportInfo.fileCount,
    meta: `assets/packs/${p.id}/meta.json`, assets: st.assets, frames: st.frames, variants: st.variants, autotiles: st.autotiles.length,
    tier: ['ink-edition', 'four-seasons', 'grand-atlas'].includes(p.id) ? 'Studio Edition' : 'Essentials',
    product: (products.find(pr => pr.packs.length === 1 && pr.packs[0] === p.id) || {}).id,
    icon: { sheet: `assets/packs/${p.id}/sheets/1x/${p.getSheet(ia.sheet).file}${p.variants ? '-' + p.variants[1].id : ''}.png`, x: ia.col * p.getSheet(ia.sheet).cellW, y: ia.row * p.getSheet(ia.sheet).cellH, w: ia.frames[0].w, h: ia.frames[0].h },
    tools: [p.autotiles.length || (p.extra.ground && p.extra.ground.length) ? 'playground' : null, p.characters ? 'characters' : null, p.extra.generator ? 'generator' : null].filter(Boolean) };
});
fs.writeFileSync(path.join(ROOT, 'assets', 'catalog.json'), JSON.stringify({ version: 1, built: '2026-11-08', packs: catalog }));

/* animated scenes */
const scenes = SCENES.build(packs);
fs.writeFileSync(path.join(ROOT, 'assets', 'scenes.json'), JSON.stringify(scenes));
log('wrote catalog and scenes');

/* RGBA composition of a scene for the social preview image */
function sceneRGBA(scene, x0, y0, w, h) {
  const out = new Uint8Array(w * 16 * h * 16 * 4);
  const cache = {};
  const sheetRGBA = key => {
    if (cache[key]) return cache[key];
    const [pid, sid] = key.split(':'), pk = packs[pid], s = pk.getSheet(sid), r = pk.sheetRaster(s);
    return (cache[key] = { w: r.w, data: pk.toRGBA(r, pk.resolver(pk.variants ? pk.variants[1] : null)) });
  };
  const blit = (key, sx, sy, dx, dy, bw, bh) => {
    const S = sheetRGBA(key);
    for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) {
      const X = dx + i, Y = dy + j; if (X < 0 || Y < 0 || X >= w * 16 || Y >= h * 16) continue;
      const si = ((sy + j) * S.w + sx + i) * 4; if (!S.data[si + 3]) continue;
      out.set(S.data.subarray(si, si + 4), (Y * w * 16 + X) * 4);
    }
  };
  for (const L of scene.layers) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const t = L[(y0 + y) * scene.w + x0 + x]; if (!t) continue;
    const tile = scene.tiles[t - 1]; blit(tile.s, tile.f[0][0], tile.f[0][1], x * 16, y * 16, 16, 16);
  }
  return out;
}
{
  const W = 15, H = 8, k = 5;
  const rgba = sceneRGBA(scenes.hero, 18, 1, W, H);
  const cropH = 126;
  const out = new Uint8Array(1200 * 630 * 4);
  const scaled = scaleRGBA(W * 16, H * 16, rgba, k);
  for (let y = 0; y < cropH * k; y++) out.set(scaled.subarray((y + k) * W * 16 * k * 4, (y + k + 1) * W * 16 * k * 4), y * 1200 * 4);
  fs.writeFileSync(path.join(ROOT, 'assets', 'og.png'), encodePNG(1200, 630, out));
}

/* studio icons: a gem on a tiled indigo field, drawn on a 32×32 grid */
{
  const r = new Raster(32, 32);
  const pal = { 1: [20, 18, 43], 2: [33, 30, 66], 3: [63, 209, 189], 4: [31, 143, 132], 5: [255, 247, 230], 6: [52, 48, 92] };
  r.fill(1);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if (x % 8 === 0 || y % 8 === 0) r.set(x, y, 2);
  const gem = ['....######....', '..##########..', '.############.', '##############', '##############', '##############', '###########...'.replace(/\./g, '#'), '.############.', '..##########..', '....######....'];
  r.pattern(9, 11, gem.map(s => s.padEnd(14, '.')), { '#': 3 });
  for (let y = 15; y < 21; y++) for (let x = 16; x < 23; x++) if (r.get(x, y) === 3) r.set(x, y, 4);
  r.rect(12, 13, 3, 1, 5); r.rect(12, 14, 1, 1, 5);
  const toRGBA = (ras) => { const o = new Uint8Array(ras.w * ras.h * 4); ras.d.forEach((v, i) => { const c = pal[v] || [0, 0, 0]; o.set([c[0], c[1], c[2], 255], i * 4); }); return o; };
  fs.mkdirSync(path.join(ROOT, 'studio', 'icons'), { recursive: true });
  const base = toRGBA(r);
  for (const [k, name] of [[6, 'icon-192.png'], [16, 'icon-512.png']]) fs.writeFileSync(path.join(ROOT, 'studio', 'icons', name), encodePNG(32 * k, 32 * k, scaleRGBA(32, 32, base, k)));
}

const pub = SITE.writeAll(ROOT, { products, packs, sample: { zipSize: packs.sample.exportInfo.zipSize, fileCount: packs.sample.exportInfo.fileCount, meta: packs.sample.exportInfo.meta } });
log(`wrote ${pub.length} public pages plus thank-you pages, studio and 404`);

const report = Object.values(packs).map(p => Object.assign({ pack: p.id, assets: p.assets.length, files: p.exportInfo.fileCount, zipBytes: p.exportInfo.zipSize }, p.report));
fs.writeFileSync(path.join(ROOT, 'build', 'last-build-report.json'), JSON.stringify(report, null, 1));
const totals = report.reduce((a, r) => ({ assets: a.assets + r.assets, seam: a.seam + r.seamComparisons, palette: a.palette + r.paletteChecks, anim: a.anim + r.animChecks, redraws: a.redraws + r.redraws }), { assets: 0, seam: 0, palette: 0, anim: 0, redraws: 0 });
log(`checks passed: ${totals.assets} assets, ${totals.palette} palette checks, ${totals.anim} animation checks, ${totals.seam.toLocaleString()} seam pixel comparisons, ${totals.redraws} redraws`);
