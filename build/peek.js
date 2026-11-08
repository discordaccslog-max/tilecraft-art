'use strict';
/* node build/peek.js <pack> <assetIdPrefix,...> [scale] [variant] — writes .review/peek.png */
const fs = require('fs');
const path = require('path');
const { encodePNG, scaleRGBA } = require('./lib/pack.js');
const [packId, list, scaleArg, variantId] = process.argv.slice(2);
const pack = require(`./packs/${packId}.js`).build();
const k = +(scaleArg || 5);
const pref = list.split(',');
const assets = pack.assets.filter(a => pref.some(p => a.id.startsWith(p)));
const v = variantId ? pack.variantList().find(x => x.id === variantId) : (pack.variants ? pack.variants[0] : null);
const resolve = pack.resolver(v);
const pad = 2;
let W = 0, H = 0, x = pad, y = pad, rowH = 0;
const maxW = 1200 / k;
const places = [];
for (const a of assets) {
  const fw = a.frames[0].w * a.frames.length + (a.frames.length - 1), fh = a.frames[0].h;
  if (x + fw > maxW && x > pad) { x = pad; y += rowH + pad; rowH = 0; }
  places.push([a, x, y]); x += fw + pad; rowH = Math.max(rowH, fh); W = Math.max(W, x); H = Math.max(H, y + rowH + pad);
}
const out = new Uint8Array(W * H * 4);
for (let i = 0; i < W * H; i++) { const px = i % W, py = (i / W) | 0; const c = ((px >> 2) + (py >> 2)) & 1 ? 96 : 78; out.set([c, c, c + 12, 255], i * 4); }
for (const [a, ax, ay] of places) a.frames.forEach((f, fi) => f.each((fx, fy, ink) => {
  if (!ink) return; const c = resolve(ink); const i = ((ay + fy) * W + ax + fi * (f.w + 1) + fx) * 4; out.set(c, i);
}));
fs.writeFileSync(path.join(__dirname, '..', '.review', 'peek.png'), encodePNG(W * k, H * k, scaleRGBA(W, H, out, k)));
console.log(`peek: ${assets.length} assets at ${k}x (${W * k}x${H * k})`);
