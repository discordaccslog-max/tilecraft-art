'use strict';
/* Renders contact sheets for visual review: node build/review.js [packId ...] */
const path = require('path');
const K = require('./lib/kit.js');
const ids = process.argv.slice(2);
const out = path.join(__dirname, '..', '.review');
for (const id of ids) {
  const t = Date.now();
  const pack = require(`./packs/${id}.js`).build();
  const files = K.contactSheets(pack, out);
  const st = pack.stats();
  console.log(`${id}: ${st.assets} assets, ${st.frames} frames, ${st.animated} animated, ${pack.autotiles.length} autotile sets, ${Date.now() - t} ms`);
  console.log('  checks:', JSON.stringify(pack.report));
  for (const f of files) console.log('  ' + path.relative(process.cwd(), f));
}
