'use strict';
/* Mossway Sampler — the free sample pack. Its tiles appear in no paid pack. */
const { Raster, Palette, mulberry32, hash2, pnoise, dither, mod } = require('../lib/raster.js');
const { Pack } = require('../lib/pack.js');
const K = require('../lib/kit.js');
const A = require('../lib/art.js');

const P = new Palette([
  ['out', '#1a2422'], ['m0', '#203a33'], ['m1', '#2f5745'], ['m2', '#447a55'], ['m3', '#68a067'], ['m4', '#a3cf86'],
  ['s0', '#4a4f5c'], ['s1', '#727889'], ['s2', '#a0a6b4'], ['s3', '#d4d7dd'],
  ['b0', '#3b2a24'], ['b1', '#62463a'], ['b2', '#8f6a52'], ['bark', '#e8e2d4'],
  ['glow0', '#1f6f73'], ['glow1', '#3fc0b4'], ['glow2', '#b9f6e8'], ['bell0', '#4b55a8'], ['bell1', '#7d8ce0']
]);
const MOSS = (() => { const L = new Raster(16, 16); const rng = mulberry32(17); for (let i = 0; i < 4; i++) { const x = Math.floor(rng() * 16), y = Math.floor(rng() * 16); L.set(x, y, P.m3); L.set(mod(x + 1, 16), mod(y + 1, 16), P.m1); } return L; })();
const moss = (x, y) => { const lx = mod(x, 16), ly = mod(y, 16); const t = MOSS.get(lx, ly); if (t) return t; const n = pnoise(lx, ly, 8, 16, 5); return n > 0.7 && dither(lx, ly, 0.35) ? P.m3 : n < 0.25 && dither(lx + 2, ly + 1, 0.3) ? P.m1 : P.m2; };

function stone(r, cx, cy, rx, ry) {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
    const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, d = dx * dx + dy * dy;
    if (d > 1) continue;
    r.set(x, y, d > 0.7 && dx + dy > 0 ? P.s1 : (-dx - dy > 0.7 ? P.s3 : P.s2));
  }
}
function stepPainter() {
  const cache = {};
  return (x, y, m) => { if (!cache[m]) { const r = new Raster(16, 16); stone(r, 8, 8, 4.2, 3.4); for (const [bit, ax, ay] of [[1, 8, 2.5], [2, 13.5, 8], [4, 8, 13.5], [8, 2.5, 8]]) if (m & bit) stone(r, ax, ay, 2.3, 1.9); r.outline(P.s0); for (const [bit, gx, gy] of [[1, 8, 0], [4, 8, 15], [8, 0, 8], [2, 15, 8]]) if (m & bit) { const horiz = gy === 8; r.set(gx, gy, P.s1); r.set(horiz ? gx : 7, horiz ? 7 : gy, P.s2); } cache[m] = r; } return cache[m].get(x, y); };
}

function build() {
  const pack = new Pack({ id: 'sample', name: 'Mossway Sampler (free)', code: 'FREE', palette: P });
  pack.sheet('sampler', { name: 'Mossway sampler', cols: 8 });
  const g = [];
  const deco = [() => { }, r => { for (const [x, y] of [[5, 6], [10, 10]]) { r.set(x, y, P.glow1); r.set(x, y + 1, P.m1); } }, r => { for (const [x, y] of [[4, 9], [11, 5]]) { r.set(x, y, P.s2); r.set(x + 1, y, P.s1); } }];
  deco.forEach((d, i) => { const r = Raster.from(16, 16, moss); d(r); g.push(pack.add('sampler', { id: `free-moss-${i + 1}`, name: `Moss ${i + 1}`, category: 'Ground', frames: [r], meta: { ground: 'moss' } }).id); });
  pack.extra.ground = [{ id: 'moss', name: 'Moss', assets: g }];
  K.addEdgeSet(pack, { sheet: 'sampler', id: 'stones', prefix: 'free', name: 'Stepping stones', category: 'Stepping stones (autotile)', painter: stepPainter(), order: 1, color: '#a0a6b4' });
  pack.newRow('sampler');
  const leaf = { o: P.out, c: [P.m0, P.m1, P.m2, P.m3, P.m4] };
  pack.add('sampler', () => { const r = new Raster(16, 16); for (let k = 0; k < 7; k++) { const a = -Math.PI * (0.12 + k * 0.125); for (let t = 1; t < 8; t++) { r.set(Math.round(8 + Math.cos(a) * t), Math.round(14 + Math.sin(a) * t + t * t * 0.05), t > 5 ? P.m4 : t > 2 ? P.m3 : P.m2); } } return { id: 'free-fern', name: 'Fern', category: 'Plants', frames: [r] }; });
  pack.add('sampler', () => { const r = new Raster(16, 16); for (const [cx, cy, s] of [[5, 9, 2.6], [10, 11, 2], [11, 6, 1.6]]) { r.rect(Math.round(cx) - 1, Math.round(cy), 2, 3, P.bark); r.ellipse(cx, cy, s + 0.5, s * 0.75, P.glow1); r.set(Math.round(cx - s / 2), Math.round(cy - s * 0.4), P.glow2); } r.outline(P.glow0); return { id: 'free-glowcaps', name: 'Glowcaps', category: 'Plants', frames: [r] }; });
  pack.add('sampler', () => { const r = new Raster(16, 16); for (const [x, top] of [[4, 6], [8, 4], [12, 7]]) { r.vline(x, top, 14, P.m2); for (let k = 0; k < 3; k++) { r.set(x + 1, top + 1 + k * 2, P.bell1); r.set(x + 1, top + 2 + k * 2, P.bell0); } } return { id: 'free-bluebells', name: 'Bluebells', category: 'Plants', frames: [r] }; });
  pack.add('sampler', () => { const r = new Raster(16, 16); A.shadow(r, 8, 13, 6, 1.4, P.m1); A.rock(r, 8, 9, 6, 4.4, { o: P.out, d: P.s0, m: P.s1, l: P.s2, h: P.s3 }, 5, { moss: [P.m3, P.m4] }); return { id: 'free-boulder', name: 'Mossy boulder', category: 'Rocks', frames: [r] }; });
  pack.add('sampler', () => { const r = new Raster(16, 16); r.rect(4, 6, 8, 7, P.b1); r.vline(5, 7, 12, P.b2); r.ellipse(8, 6, 4.5, 2, P.b2); r.ellipse(8, 6, 2.5, 1, P.b1); r.set(5, 5, P.m3); r.set(6, 5, P.m4); r.set(10, 5, P.m3); r.set(3, 12, P.b1); r.set(12, 12, P.b1); r.outline(P.out); return { id: 'free-stump', name: 'Mossy stump', category: 'Plants', frames: [r] }; });
  pack.add('sampler', () => { const r = new Raster(16, 32); A.shadow(r, 8, 29.5, 4.5, 1.4, P.m1); r.rect(7, 16, 2, 13, P.bark); r.vline(8, 16, 28, P.s2); for (let y = 18; y < 28; y += 3) r.set(7, y, P.out); A.crown(r, [[8, 10, 6], [5, 13, 3.4], [11, 13, 3.4]], leaf, 9, { spacing: 4, clump: 2.6 }); return { id: 'free-birch', name: 'Birch sapling', category: 'Plants', frames: [r] }; });
  /* sample map */
  const W = 20, H = 12, mb = new K.MapBuilder(pack, 'mossway-sample', 'Mossway glade', W, H);
  mb.fill('Ground', (x, y) => g[hash2(x, y, 1) < 0.8 ? 0 : 1 + Math.floor(hash2(x, y, 2) * 2)]);
  const path = K.grids.path(K.grids.blank(W, H), W, [[0, 6], [6, 6], [6, 3], [13, 3], [13, 8], [19, 8]], 1);
  mb.edges('Path', 'stones', path);
  for (const [id, x, y] of [['free-birch', 2, 1], ['free-birch', 16, 2], ['free-fern', 4, 9], ['free-glowcaps', 9, 6], ['free-bluebells', 15, 5], ['free-boulder', 9, 9], ['free-stump', 17, 10], ['free-fern', 11, 1]]) mb.stamp('Decor', id, x, y);
  mb.done();
  return pack;
}

module.exports = { build, palette: P };
