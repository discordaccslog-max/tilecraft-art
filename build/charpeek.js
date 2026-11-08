'use strict';
/* node build/charpeek.js [scale] — composites sample characters (all directions, walk + idle) into .review/chars.png */
const fs = require('fs');
const path = require('path');
const { encodePNG, scaleRGBA } = require('./lib/pack.js');
const { Raster } = require('./lib/raster.js');
const packId = process.argv[3] || 'characters';
const pack = require(`./packs/${packId}.js`).build();
const k = +(process.argv[2] || 4);
const combos = (pack.previewCombos || [
  ['ck-body-slim-skin2', 'ck-outfit-tunic-1-slim', 'ck-hair-crop-brown', null],
  ['ck-body-sturdy-skin5', 'ck-outfit-dress-1-sturdy', 'ck-hair-curls-black', 'ck-acc-flowers-1-sturdy'],
  ['ck-body-slim-skin3', 'ck-outfit-robe-2-slim', 'ck-hair-long-silver', 'ck-acc-circlet-1-slim'],
  ['ck-body-sturdy-skin1', 'ck-outfit-overalls-1-sturdy', 'ck-hair-ponytail-auburn', 'ck-acc-sunhat-1-sturdy'],
  ['ck-body-slim-skin6', 'ck-outfit-cloak-2-slim', 'ck-hair-braids-blonde', 'ck-acc-backpack-1-slim'],
  ['ck-body-sturdy-skin4', 'ck-outfit-guard-1-sturdy', 'ck-hair-bun-teal', 'ck-acc-scarf-1-sturdy'],
  ['ck-body-slim-skin1', 'ck-outfit-coat-3-slim', 'ck-hair-swept-blonde', 'ck-acc-glasses-1-slim'],
  ['ck-body-sturdy-skin3', 'ck-outfit-apron-1-sturdy', 'ck-hair-bob-auburn', 'ck-acc-beanie-1-sturdy']
]);
const dirs = ['down', 'left', 'right', 'up'];
const cols = 4 * 4 + 2 * 4 + 4, W = cols * 17, H = combos.length * 33;
const canvas = new Raster(W, H);
combos.forEach((combo, ci) => {
  let x = 0;
  for (const anim of ['walk', 'idle']) for (const dir of dirs) {
    const n = anim === 'walk' ? 4 : 2;
    for (let f = 0; f < n; f++) {
      for (const lid of combo) if (lid) { const a = pack.asset(`${lid}-${anim}-${dir}`); canvas.blit(a.frames[f], x, ci * 33); }
      x += 17;
    }
    if (anim === 'walk') x += 0;
  }
});
const resolve = pack.resolver(null);
const rgba = new Uint8Array(W * H * 4);
for (let i = 0; i < W * H; i++) { const v = canvas.d[i]; const c = v ? resolve(v) : [((i % W >> 3) + ((i / W | 0) >> 3)) & 1 ? 120 : 140, 0, 0, 255]; if (!v) { c[1] = c[0] + 8; c[2] = c[0] + 20; } rgba.set(c, i * 4); }
fs.writeFileSync(path.join(__dirname, '..', '.review', 'chars.png'), encodePNG(W * k, H * k, scaleRGBA(W, H, rgba, k)));
console.log(`chars: ${combos.length} combos, ${pack.assets.length} assets`);
