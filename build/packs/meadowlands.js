'use strict';
const { Raster, Palette, mulberry32, hash2, pnoise, dither, wobble, mod } = require('../lib/raster.js');
const { Pack } = require('../lib/pack.js');
const TR = require('../lib/terrain.js');
const K = require('../lib/kit.js');
const A = require('../lib/art.js');

const P = new Palette([
  ['out', '#1e1b2e'],
  ['g0', '#1f4535'], ['g1', '#2b6343'], ['g2', '#3f8548'], ['g3', '#5ea350'], ['g4', '#8cc35a'], ['g5', '#c6e07e'],
  ['d0', '#3a2622'], ['d1', '#5a3a2b'], ['d2', '#7f5536'], ['d3', '#a5774a'],
  ['s1', '#c9a26c'], ['s2', '#e3c88f'], ['s3', '#f3e4b6'],
  ['w0', '#1a2f52'], ['w1', '#21497a'], ['w2', '#2c6ba0'], ['w3', '#4596c0'], ['w4', '#86cad8'], ['w5', '#dff3ec'],
  ['k0', '#363749'], ['k1', '#585b70'], ['k2', '#868a9c'], ['k3', '#bfc0c4'],
  ['b0', '#46291f'], ['b1', '#6e4329'], ['b2', '#9c6538'], ['b3', '#c4915a'],
  ['fr', '#d84a5e'], ['fy', '#f0c040'], ['fv', '#9a72d2'], ['fb', '#4f8fe0'], ['fw', '#f5eee0']
]);

/* ---------- periodic textures ---------- */
function tuftLayer(seed, count, inks) {
  const L = new Raster(16, 16);
  const rng = mulberry32(seed);
  for (let i = 0; i < count; i++) {
    const x = Math.floor(rng() * 16), y = Math.floor(rng() * 16);
    const set = (dx, dy, c) => L.set(mod(x + dx, 16), mod(y + dy, 16), c);
    if (i % 3 === 2) { set(0, 0, inks[2]); set(0, 1, inks[1]); }
    else { set(0, 0, inks[2]); set(2, 0, inks[2]); set(1, 1, inks[1]); set(1, 2, inks[0]); }
  }
  return L;
}
const GRASS_TUFTS = tuftLayer(41, 7, [P.g1, P.g3, P.g4]);
/* Every grass variant shares the same 2-pixel border band (so any two join seamlessly)
 * but has its own interior, which keeps large fields from looking like a grid. */
function grassTexV(v) {
  const inner = tuftLayer(200 + v * 13, 4 + (v % 3), [P.g1, P.g3, P.g4]);
  return (x, y) => {
    const lx = mod(x, 16), ly = mod(y, 16), band = K.inBand(lx, ly);
    const t = band ? GRASS_TUFTS.get(lx, ly) : inner.get(lx, ly);
    if (t) return t;
    const n = pnoise(lx, ly, 8, 16, band ? 12 : 12 + v * 7);
    if (n > 0.64 && dither(lx, ly, (n - 0.64) * 3.2)) return P.g3;
    if (n < 0.3 && dither(lx + 2, ly + 1, (0.3 - n) * 2.4)) return P.g1;
    return P.g2;
  };
}
const DIRT_SPECKS = (() => {
  const L = new Raster(16, 16); const rng = mulberry32(77);
  for (let i = 0; i < 6; i++) { const x = Math.floor(rng() * 16), y = Math.floor(rng() * 16); L.set(x, y, P.d3); L.set(mod(x + 1, 16), y, P.d3); L.set(x, mod(y + 1, 16), P.d1); L.set(mod(x + 1, 16), mod(y + 1, 16), P.d1); }
  for (let i = 0; i < 7; i++) L.set(Math.floor(rng() * 16), Math.floor(rng() * 16), P.d1);
  return L;
})();
function dirtTex(x, y) {
  const lx = mod(x, 16), ly = mod(y, 16);
  const s = DIRT_SPECKS.get(lx, ly); if (s) return s;
  const n = pnoise(lx, ly, 8, 16, 31);
  if (n > 0.62 && dither(lx, ly, (n - 0.62) * 2.6)) return P.d3;
  return P.d2;
}
const PATH_PEBBLES = (() => {
  const L = new Raster(16, 16); const rng = mulberry32(93);
  for (let i = 0; i < 5; i++) { const x = Math.floor(rng() * 16), y = Math.floor(rng() * 16); L.set(x, y, P.s3); L.set(mod(x + 1, 16), y, P.s1); L.set(x, mod(y + 1, 16), P.s1); }
  for (let i = 0; i < 6; i++) L.set(Math.floor(rng() * 16), Math.floor(rng() * 16), P.s1);
  return L;
})();
function pathTex(x, y) {
  const lx = mod(x, 16), ly = mod(y, 16);
  const s = PATH_PEBBLES.get(lx, ly); if (s) return s;
  const n = pnoise(lx, ly, 8, 16, 53);
  if (n < 0.33 && dither(lx, ly, (0.33 - n) * 2.4)) return P.s1;
  return P.s2;
}

/* ---------- autotile painters ---------- */
const wob = (seed, amp = 1) => t => wobble(mod(t, 16), 16, amp, seed);
const dirtShape = TR.shape({ top: 3, bottom: 3, left: 3, right: 3, wobTop: wob(1), wobBottom: wob(2), wobLeft: wob(3), wobRight: wob(4), outer: 5, inner: 3 });
function dirtPaint(x, y, q) {
  if (!q.inside(x, y)) return 0;
  const p = q.probe(x, y, 3);
  if (p.up === 0) return P.d0;
  if (p.up === 1) return P.d1;
  if (p.left === 0 || p.right === 0) return P.d1;
  if (p.down === 0) return P.d1;
  if (p.ring) return P.d1;
  if (p.down === 1) return P.d3;
  return dirtTex(x, y);
}
const pathShape = TR.shape({ top: 3, bottom: 3, left: 3, right: 3, wobTop: wob(5), wobBottom: wob(6), wobLeft: wob(7), wobRight: wob(8), outer: 5, inner: 3 });
function pathPaint(x, y, q) {
  if (!q.inside(x, y)) return 0;
  const p = q.probe(x, y, 3);
  if (p.ring) return P.d3;
  if (p.down === 1) return P.s1;
  if (p.up === 1 && dither(x, y, 0.5)) return P.s1;
  return pathTex(x, y);
}
const waterShape = TR.shape({ top: 3, bottom: 3, left: 3, right: 3, wobTop: wob(9), wobBottom: wob(10), wobLeft: wob(11), wobRight: wob(12), outer: 5, inner: 3 });
const RIPPLES = (() => {
  const rng = mulberry32(5); const list = [];
  for (let i = 0; i < 6; i++) list.push({ x: Math.floor(rng() * 16), y: Math.floor(rng() * 16), len: 2 + Math.floor(rng() * 3), ph: i % 4 });
  return list;
})();
function ripple(x, y, f) {
  const lx = mod(x, 16), ly = mod(y, 16);
  for (const r of RIPPLES) {
    const st = (r.ph + f) % 4;
    if (st === 3) continue;
    const rx = mod(r.x + (st === 2 ? 1 : 0), 16);
    if (ly === r.y && mod(lx - rx, 16) < r.len + (st === 1 ? 1 : 0)) return st === 1 && mod(lx - rx, 16) === 1 ? P.w4 : P.w3;
  }
  return 0;
}
function waterPaint(x, y, q, f) {
  if (!q.inside(x, y)) return 0;
  const p = q.probe(x, y, 4);
  if (p.up === 0) return P.d2;
  if (p.up === 1) return P.d1;
  if (p.left === 0 || p.right === 0) return p.up <= 2 ? P.d1 : P.w0;
  if (p.down === 0) return P.w4;
  if (p.up === 2) return mod(x - f * 2, 8) < 5 ? P.w5 : P.w4;
  if (p.left === 1 || p.right === 1) return mod(y + f, 4) < 2 ? P.w3 : P.w2;
  if (p.down === 1 || p.up === 3) return P.w3;
  const rp = ripple(x, y, f);
  if (rp) return rp;
  return p.min >= 4 ? P.w1 : P.w2;
}

/* ---------- objects ---------- */
const leafInks = { o: P.g0, c: [P.g0, P.g1, P.g2, P.g3, P.g4] };
const treeInks = { leaf: leafInks, bark: { o: P.b0, d: P.b0, m: P.b1, l: P.b2 }, shadow: P.g1 };
const stone = { o: P.k0, d: P.k1, m: P.k2, l: P.k3, h: P.fw };

function tallGrass(seed, f, dense) {
  const r = new Raster(16, 16);
  const rng = mulberry32(seed);
  const n = dense ? 14 : 10;
  const sway = [0, 1, 0, -1][f];
  r.ellipse(8, 14, dense ? 6.5 : 5.5, 1.8, P.g1);
  for (let i = 0; i < n; i++) {
    const x = (dense ? 2 : 3) + Math.floor(i * (dense ? 12 : 10) / n + rng() * 1.5), h = 6 + Math.floor(rng() * (dense ? 7 : 5)), base = 15 - Math.floor(rng() * 2);
    const lean = (x < 8 ? -1 : 1) * (0.5 + rng()) + sway * (0.8 + h / 9);
    const shade = i % 3;
    A.blades(r, x, base, h, lean, shade === 0 ? { base: P.g0, mid: P.g2, tip: P.g3 } : shade === 1 ? { base: P.g1, mid: P.g3, tip: P.g4 } : { base: P.g1, mid: P.g3, tip: P.g5 });
  }
  return r;
}
function flowersTile(seed, kinds) {
  const r = new Raster(16, 16);
  const rng = mulberry32(seed);
  const spots = [[4, 5], [11, 4], [7, 10], [12, 11], [3, 12]];
  kinds.forEach((k, i) => {
    const [x, y] = spots[i % spots.length];
    A.flower(r, x + Math.floor(rng() * 2), y + Math.floor(rng() * 2), k.shape, { petal: k.petal, center: k.center || P.fy, stem: P.g1, leaf: P.g3, dark: k.dark });
  });
  return r;
}
function fence(x, y, m) {
  /* edge16 painter: posts at the centre, two rails on east/west, one on north/south */
  const post = x >= 6 && x <= 9 && y >= 3 && y <= 12;
  if (post) {
    if (x === 6 || x === 9 || y === 3 || y === 12) return P.b0;
    if (y === 4) return P.b3;
    return x === 7 ? P.b2 : P.b1;
  }
  const railH = (yy) => yy === 5 || yy === 6 || yy === 9 || yy === 10;
  if (((m & 2) && x > 9) || ((m & 8) && x < 6)) {
    if (railH(y)) return (y === 5 || y === 9) ? P.b2 : P.b1;
    if (y === 4 || y === 7 || y === 8 || y === 11) return P.b0;
  }
  if (((m & 1) && y < 3) || ((m & 4) && y > 12)) {
    if (x === 7 || x === 8) return x === 7 ? P.b2 : P.b1;
    if (x === 6 || x === 9) return P.b0;
  }
  return 0;
}
function bridgePiece(kind) {
  /* kind: h-left h-mid h-right v-top v-mid v-bottom */
  const r = new Raster(16, 16);
  const hz = kind[0] === 'h';
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const u = hz ? x : y, v = hz ? y : x;
    if (v < 2 || v > 13) continue;
    let c = (mod(u, 4) === 3) ? P.b0 : (v === 2 || v === 13) ? P.b0 : (v === 3 ? P.b3 : (v < 8 ? P.b2 : P.b1));
    if (v === 12) c = P.b0;
    r.set(x, y, c);
  }
  const posts = [];
  if (kind.endsWith('left') || kind.endsWith('top')) posts.push(1);
  if (kind.endsWith('right') || kind.endsWith('bottom')) posts.push(13);
  for (const pu of posts) for (const pv of [1, 12]) {
    for (let a = 0; a < 3; a++) for (let b = 0; b < 4; b++) {
      const x = hz ? pu + a : pv + (b < 3 ? b : 2), y = hz ? pv + b - 1 : pu + a;
      r.set(x, y, a === 0 || b === 0 ? P.b0 : a === 1 ? P.b3 : P.b1);
    }
  }
  if (hz) { r.hline(0, 15, 1, P.b0); r.hline(0, 15, 14, P.b0); for (let x = 0; x < 16; x++) { r.set(x, 0, mod(x, 8) === 0 ? P.b0 : 0); } }
  return r;
}
function butterfly(f, wing, body) {
  const r = new Raster(16, 16);
  const yb = [7, 6, 7, 8][f];
  const open = [2, 1, 0, 1][f];
  const cx = 8;
  r.vline(cx, yb - 1, yb + 1, body);
  for (let s of [-1, 1]) {
    const w = open === 2 ? 3 : open === 1 ? 2 : 1;
    for (let i = 1; i <= w; i++) { r.set(cx + s * i, yb - 1, wing); r.set(cx + s * i, yb, wing); }
    if (open > 0) r.set(cx + s * (w + 0), yb - 2, wing);
    if (open === 2) r.set(cx + s * 2, yb + 1, wing);
  }
  r.set(cx - 1, yb - 2, 0); r.set(cx + 1, yb - 2, 0);
  r.set(cx, yb - 2, body);
  return r;
}
function lilyPads(seed, bloom) {
  const r = new Raster(16, 16);
  const pads = [[5, 6, 3.5], [11, 10, 3]];
  for (const [cx, cy, rad] of pads) {
    r.ellipse(cx, cy, rad, rad * 0.75, P.g3);
    r.edgeShade(0, 1, P.g1);
    r.set(Math.round(cx), Math.round(cy), P.w2); r.set(Math.round(cx) + 1, Math.round(cy) - 1, P.w2);
    r.set(Math.round(cx - rad + 1), Math.round(cy - 1), P.g4);
  }
  if (bloom) { const x = 5, y = 5; r.set(x, y - 1, P.fw); r.set(x - 1, y, P.fw); r.set(x + 1, y, P.fw); r.set(x, y, P.fy); r.set(x, y + 1, P.fr); }
  void seed;
  return r;
}
function reeds(f) {
  const r = new Raster(16, 16);
  const stems = [[3, 9], [6, 12], [9, 10], [12, 11]];
  const sway = [0, 1, 0, -1][f];
  stems.forEach(([x, h], i) => {
    const lean = (i % 2 ? 0.5 : -0.5) + sway;
    for (let k = 0; k < h; k++) { const t = k / h; r.set(x + Math.round(lean * t * t * 2), 15 - k, k < 3 ? P.g1 : P.g2); }
    if (i % 2 === 0) { const tx = x + Math.round(lean * 2); r.vline(tx, 15 - h - 2, 15 - h, P.b1); r.set(tx + 1, 15 - h - 1, P.b0); r.set(tx, 15 - h - 3, P.g3); }
    else r.set(x + Math.round(lean * 2), 15 - h, P.g4);
  });
  return r;
}
function mushrooms() {
  const r = new Raster(16, 16);
  const key = { o: P.b0, H: P.s3, h: P.b3, m: P.b2, d: P.b1, S: P.s3, s: P.s1, g: P.g1 };
  r.pattern(1, 4, ['..oooo..', '.oHhhmo.', 'oHhmmmmo', 'ommmmmdo', '.oddddo.', '..oSso..', '..oSso..', '..oSso..', '.goooog.'], key);
  r.pattern(9, 7, ['.ooo.', 'ohmmo', 'ommdo', '.oSo.', '.oSo.', 'goog.'], key);
  r.pattern(12, 3, ['.oo.', 'ohmo', '.oo.', '.oo.'], key);
  return r;
}

function build() {
  const pack = new Pack({ id: 'meadowlands', name: 'Meadowlands Tileset', code: 'MD', palette: P });
  pack.sheet('terrain', { name: 'Meadowlands terrain', cols: 16 });
  pack.sheet('water', { name: 'Meadowlands water', cols: 16 });
  pack.sheet('nature', { name: 'Meadowlands nature', cols: 16 });

  /* ground fills: one shared periodic base, interior details only */
  const ground = [];
  const variants = [
    ['plain', () => { }], ['plain-2', () => { }, 1], ['plain-3', () => { }, 2], ['plain-4', () => { }, 3],
    ['tufts', r => { r.set(5, 6, P.g4); r.set(7, 6, P.g4); r.set(6, 7, P.g3); r.set(10, 10, P.g4); r.set(12, 10, P.g4); r.set(11, 11, P.g3); r.set(11, 12, P.g1); }],
    ['clover', r => { for (const [x, y] of [[5, 5], [9, 9], [11, 4]]) { r.set(x, y, P.g4); r.set(x + 1, y, P.g4); r.set(x, y + 1, P.g4); r.set(x + 1, y + 1, P.g3); r.set(x + 1, y + 2, P.g1); } }],
    ['daisies', r => { for (const [x, y] of [[5, 6], [10, 10], [11, 4]]) { r.set(x, y, P.fy); r.set(x - 1, y, P.fw); r.set(x + 1, y, P.fw); r.set(x, y - 1, P.fw); r.set(x, y + 1, P.fw); } }],
    ['buttercups', r => { for (const [x, y] of [[4, 9], [8, 5], [11, 11], [12, 6]]) { r.set(x, y, P.fy); r.set(x, y + 1, P.g1); } }],
    ['pebbles', r => { for (const [x, y] of [[5, 9], [10, 6]]) { r.set(x, y, P.k3); r.set(x + 1, y, P.k2); r.set(x, y + 1, P.k1); r.set(x + 1, y + 1, P.k1); } r.set(8, 12, P.k2); }],
    ['sprouts', r => { for (const [x, y] of [[4, 6], [9, 11], [11, 5]]) { r.set(x, y, P.g5); r.set(x + 1, y - 1, P.g4); r.set(x, y + 1, P.g1); } }],
    ['violets', r => { for (const [x, y] of [[5, 10], [10, 5], [11, 11]]) { r.set(x, y, P.fv); r.set(x + 1, y, P.fv); r.set(x, y - 1, P.fv); r.set(x + 1, y + 1, P.g1); } }]
  ];
  variants.forEach(([name, deco, v], i) => {
    const r = Raster.from(16, 16, grassTexV(v !== undefined ? v : i % 4));
    deco(r);
    ground.push(pack.add('terrain', { id: `md-grass-${name}`, name: `Grass (${name.replace('-', ' ')})`, category: 'Ground', frames: [r], tags: ['ground', 'grass'], meta: { ground: 'grass' } }).id);
  });
  pack.extra.ground = [{ id: 'grass', name: 'Grass', assets: ground, plain: 4 }];

  K.addBlobSet(pack, { sheet: 'terrain', id: 'dirt', name: 'Dirt', category: 'Dirt (autotile)', shape: dirtShape, painter: dirtPaint, order: 1, color: '#7f5536' });
  K.addBlobSet(pack, { sheet: 'terrain', id: 'path', name: 'Path', category: 'Path (autotile)', shape: pathShape, painter: pathPaint, order: 2, color: '#e3c88f' });
  K.addBlobSet(pack, { sheet: 'water', id: 'water', name: 'Water', category: 'Water (autotile)', shape: waterShape, painter: waterPaint, frames: 4, duration: 220, order: 3, color: '#2c6ba0', newRow: false });

  /* nature objects */
  const N = 'nature';
  for (let i = 0; i < 3; i++) pack.add(N, a => ({ id: `md-tallgrass-${i + 1}`, name: `Tall grass ${i + 1}`, category: 'Swaying grass', frames: [0, 1, 2, 3].map(f => tallGrass(300 + i * 7 + a, f, i === 2)), duration: 200, tags: ['animated', 'grass'] }));
  pack.add(N, { id: 'md-reeds', name: 'Reeds', category: 'Swaying grass', frames: [0, 1, 2, 3].map(f => reeds(f)), duration: 240, tags: ['animated', 'water edge'] });
  const fl = [
    ['md-flowers-daisy', 'Daisies', [{ shape: 'daisy', petal: P.fw }, { shape: 'daisy', petal: P.fw }, { shape: 'daisy', petal: P.fw }]],
    ['md-flowers-rose', 'Rose cups', [{ shape: 'cup', petal: P.fr, dark: P.b0 }, { shape: 'cup', petal: P.fr, dark: P.b0 }, { shape: 'button', petal: P.fr, center: P.fy }]],
    ['md-flowers-gold', 'Buttercups', [{ shape: 'button', petal: P.fy, center: P.fw }, { shape: 'button', petal: P.fy, center: P.fy }, { shape: 'button', petal: P.fy, center: P.fw }, { shape: 'button', petal: P.fy, center: P.fy }]],
    ['md-flowers-bell', 'Bellflowers', [{ shape: 'bell', petal: P.fv, dark: P.out }, { shape: 'bell', petal: P.fv, dark: P.out }, { shape: 'bell', petal: P.fv, dark: P.out }]],
    ['md-flowers-blue', 'Cornflowers', [{ shape: 'star', petal: P.fb, center: P.fw }, { shape: 'star', petal: P.fb, center: P.fw }, { shape: 'star', petal: P.fb, center: P.fy }]],
    ['md-flowers-mix', 'Wildflower mix', [{ shape: 'daisy', petal: P.fw }, { shape: 'cup', petal: P.fr, dark: P.b0 }, { shape: 'star', petal: P.fb, center: P.fw }, { shape: 'bell', petal: P.fv, dark: P.out }, { shape: 'button', petal: P.fy, center: P.fy }]]
  ];
  fl.forEach(([id, name, kinds], i) => pack.add(N, { id, name, category: 'Flowers', frames: [flowersTile(500 + i, kinds)], tags: ['flowers'] }));
  pack.add(N, { id: 'md-mushrooms', name: 'Mushrooms', category: 'Flowers', frames: [mushrooms()], tags: ['plants'] });
  pack.add(N, { id: 'md-lilypads', name: 'Lily pads', category: 'Water plants', frames: [lilyPads(1, false)], tags: ['water'] });
  pack.add(N, { id: 'md-lilypads-bloom', name: 'Lily pads with bloom', category: 'Water plants', frames: [lilyPads(2, true)], tags: ['water'] });
  pack.add(N, () => { const r = new Raster(16, 16); A.rock(r, 5, 9, 3.2, 2.4, stone, 4); A.rock(r, 11, 7, 2.6, 2, stone, 5); A.rock(r, 10, 12, 2, 1.5, stone, 6); return { id: 'md-pebbles', name: 'Pebbles', category: 'Rocks', frames: [r] }; });
  pack.add(N, () => { const r = new Raster(16, 16); A.shadow(r, 8, 13, 6, 1.6, P.g1); A.rock(r, 8, 9, 6, 4.6, stone, 7, { crack: true }); return { id: 'md-rock', name: 'Rock', category: 'Rocks', frames: [r] }; });
  pack.add(N, () => { const r = new Raster(16, 16); A.shadow(r, 8, 13, 6, 1.6, P.g1); A.rock(r, 8, 9, 6, 4.6, stone, 8, { moss: [P.g3, P.g4] }); return { id: 'md-rock-mossy', name: 'Mossy rock', category: 'Rocks', frames: [r] }; });
  pack.add(N, () => { const r = new Raster(16, 16); A.rock(r, 4.5, 8, 2.8, 2.4, stone, 9); A.rock(r, 11, 10, 2.8, 2.2, stone, 10); A.rock(r, 7, 12.5, 2.5, 1.8, stone, 11); return { id: 'md-stepping-stones', name: 'Stepping stones', category: 'Water plants', frames: [r], tags: ['water'] }; });
  pack.add(N, () => { const r = new Raster(32, 32); A.shadow(r, 16, 27, 13, 3, P.g1); A.rock(r, 16, 17, 13, 10, stone, 12, { crack: true }); return { id: 'md-boulder', name: 'Boulder', category: 'Rocks', frames: [r] }; });
  pack.add(N, () => { const r = new Raster(32, 32); A.shadow(r, 16, 27, 13, 3, P.g1); A.rock(r, 11, 19, 8, 6.5, stone, 13, { moss: [P.g3, P.g4] }); A.rock(r, 21.5, 21, 7, 5.5, stone, 14); return { id: 'md-rock-cluster', name: 'Rock cluster', category: 'Rocks', frames: [r] }; });

  pack.add(N, a => ({ id: 'md-bush', name: 'Bush', category: 'Bushes', frames: [A.bush(treeInks, 20 + a)] }));
  pack.add(N, a => ({ id: 'md-bush-berry', name: 'Berry bush', category: 'Bushes', frames: [A.bush(treeInks, 30 + a, { dots: [P.fr, null], count: 6 })] }));
  pack.add(N, a => ({ id: 'md-bush-flower', name: 'Flowering bush', category: 'Bushes', frames: [A.bush(treeInks, 40 + a, { dots: [P.fw, P.fy], count: 5 })] }));
  pack.add(N, a => ({ id: 'md-bush-violet', name: 'Violet bush', category: 'Bushes', frames: [A.bush(treeInks, 50 + a, { dots: [P.fv, null], count: 7 })] }));

  pack.add(N, a => ({ id: 'md-tree-oak', name: 'Broadleaf tree', category: 'Trees', frames: [A.broadleaf(treeInks, 60 + a)] }));
  pack.add(N, a => ({ id: 'md-tree-apple', name: 'Fruit tree', category: 'Trees', frames: [A.broadleaf(treeInks, 70 + a, { fruit: [P.fr, P.b0] })] }));
  pack.add(N, a => ({ id: 'md-tree-blossom', name: 'Blossom tree', category: 'Trees', frames: [A.broadleaf(treeInks, 80 + a, { blossom: [P.fw, P.fr] })] }));
  pack.add(N, a => ({ id: 'md-tree-pine', name: 'Pine tree', category: 'Trees', frames: [A.conifer(treeInks, 90 + a)] }));
  pack.add(N, a => ({ id: 'md-tree-young', name: 'Young tree', category: 'Trees', frames: [A.sapling(treeInks, 100 + a)] }));
  pack.add(N, () => {
    const r = new Raster(16, 16);
    A.shadow(r, 8, 13, 6, 1.5, P.g1);
    r.rect(3, 6, 10, 7, P.b1); r.vline(4, 7, 12, P.b2); r.vline(11, 7, 12, P.b0);
    r.ellipse(8, 6, 5, 2.5, P.b3); r.ellipse(8, 6, 3, 1.5, P.b2); r.set(8, 6, P.b3);
    r.set(2, 12, P.b1); r.set(13, 12, P.b1); r.outline(P.b0);
    return { id: 'md-stump', name: 'Tree stump', category: 'Trees', frames: [r] };
  });
  pack.add(N, () => {
    const r = new Raster(32, 16);
    A.shadow(r, 16, 13, 13, 1.6, P.g1);
    r.rect(4, 5, 23, 7, P.b1); r.hline(4, 26, 6, P.b2); r.hline(4, 26, 11, P.b0);
    for (let x = 7; x < 26; x += 5) r.set(x, 8, P.b0), r.set(x + 1, 9, P.b0);
    r.ellipse(27, 8.5, 2.5, 3.6, P.b3); r.set(27, 8, P.b2); r.set(28, 9, P.b2);
    r.set(14, 4, P.g3); r.set(15, 4, P.g4); r.set(15, 3, P.g3);
    r.outline(P.b0);
    return { id: 'md-log', name: 'Fallen log', category: 'Trees', frames: [r] };
  });

  K.addEdgeSet(pack, { sheet: N, id: 'fence', name: 'Fence', category: 'Fences', painter: fence, order: 9, color: '#9c6538' });
  pack.add(N, () => { const r = Raster.from(16, 16, (x, y) => fence(x, y, 10)); for (let x = 1; x <= 14; x++) if (x < 6 || x > 9) r.set(x, 7, P.b2), r.set(x, 8, P.b1); return { id: 'md-gate', name: 'Gate (closed)', category: 'Fences', frames: [r] }; });
  pack.add(N, () => { const r = Raster.from(16, 16, (x, y) => (x <= 9 ? fence(x, y, 8) : 0)); for (let y = 4; y <= 12; y++) { r.set(11, y, P.b0); r.set(12, y, P.b2); r.set(13, y, P.b0); } return { id: 'md-gate-open', name: 'Gate (open)', category: 'Fences', frames: [r] }; });

  pack.newRow(N);
  for (const k of ['h-left', 'h-mid', 'h-right']) pack.add(N, { id: `md-bridge-${k}`, name: `Bridge ${k.replace('-', ' ')}`, category: 'Bridges', frames: [bridgePiece(k)] });
  for (const k of ['v-top', 'v-mid', 'v-bottom']) pack.add(N, { id: `md-bridge-${k}`, name: `Bridge ${k.replace('-', ' ')}`, category: 'Bridges', frames: [bridgePiece(k)] });
  pack.add(N, { id: 'md-butterfly-gold', name: 'Butterfly (gold)', category: 'Critters', frames: [0, 1, 2, 3].map(f => butterfly(f, P.fy, P.out)), duration: 110, tags: ['animated'] });
  pack.add(N, { id: 'md-butterfly-violet', name: 'Butterfly (violet)', category: 'Critters', frames: [0, 1, 2, 3].map(f => butterfly(f, P.fv, P.out)), duration: 110, tags: ['animated'] });

  sampleMap(pack);
  return pack;
}

function sampleMap(pack) {
  const W = 40, H = 26;
  const mb = new K.MapBuilder(pack, 'meadowlands-sample', 'Meadow crossing', W, H);
  const ground = pack.extra.ground[0].assets;
  mb.fill('Ground', (x, y) => K.pickGround(pack.extra.ground[0], x, y));
  const G = K.grids;
  const water = G.clean(G.union(G.blob(W, H, 29, 9, 7.5, 5.2, 5), G.blob(W, H, 34, 15, 4.5, 3.5, 6)), W, H);
  const path = G.path(G.blank(W, H), W, [[0, 17], [10, 17], [10, 12], [20, 12], [20, 21], [39, 21]], 2);
  const dirt = G.clean(G.union(G.blob(W, H, 6, 6, 4.5, 3.2, 7), G.rect(G.blank(W, H), W, 13, 20, 4, 3)), W, H);
  mb.terrain('Dirt', 'dirt', G.minus(dirt, path));
  mb.terrain('Path', 'path', path);
  mb.terrain('Water', 'water', water);
  const fence = G.blank(W, H);
  for (let x = 2; x <= 9; x++) { fence[2 * W + x] = 1; fence[10 * W + x] = 1; }
  for (let y = 2; y <= 10; y++) { fence[y * W + 2] = 1; fence[y * W + 9] = 1; }
  fence[10 * W + 6] = 0;
  mb.edges('Objects', 'fence', fence);
  mb.set('Objects', 6, 10, 'md-gate-open');
  const O = (id, x, y) => mb.stamp('Objects', id, x, y);
  O('md-tree-oak', 13, 1); O('md-tree-pine', 16, 4); O('md-tree-apple', 0, 19); O('md-tree-blossom', 23, 15);
  O('md-tree-young', 12, 6); O('md-tree-young', 37, 2); O('md-tree-oak', 36, 22);
  O('md-boulder', 17, 15); O('md-rock-cluster', 2, 22);
  O('md-bush', 11, 9); O('md-bush-berry', 19, 9); O('md-bush-flower', 26, 3); O('md-bush-violet', 8, 20);
  O('md-stump', 25, 18); O('md-log', 29, 23);
  O('md-rock', 22, 7); O('md-rock-mossy', 33, 19); O('md-pebbles', 14, 23);
  O('md-lilypads', 27, 9); O('md-lilypads-bloom', 31, 7); O('md-reeds', 24, 6); O('md-reeds', 33, 12);
  O('md-stepping-stones', 30, 11);
  O('md-flowers-daisy', 4, 14); O('md-flowers-rose', 15, 9); O('md-flowers-mix', 22, 2); O('md-flowers-bell', 6, 24); O('md-flowers-blue', 38, 9); O('md-flowers-gold', 27, 19);
  O('md-tallgrass-1', 5, 4); O('md-tallgrass-2', 7, 7); O('md-tallgrass-3', 4, 7); O('md-tallgrass-1', 18, 23); O('md-tallgrass-3', 35, 24); O('md-tallgrass-2', 38, 13);
  O('md-mushrooms', 14, 3);
  O('md-butterfly-gold', 24, 12);
  mb.done();
}

module.exports = { build, palette: P };
