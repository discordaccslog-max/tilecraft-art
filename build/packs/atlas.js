'use strict';
/* Grand Atlas: world-map scale overworld set. Each 16×16 tile stands for a whole region. */
const { Raster, Palette, mulberry32, hash2, pnoise, dither, wobble, mod } = require('../lib/raster.js');
const { Pack } = require('../lib/pack.js');
const TR = require('../lib/terrain.js');
const K = require('../lib/kit.js');
const GEN = require('../../studio/atlas-gen.js');

const P = new Palette([
  ['out', '#2a2230'],
  ['o0', '#1d3a58'], ['o1', '#264f74'], ['o2', '#33698f'], ['o3', '#4f8eae'], ['o4', '#86c0cc'], ['foam', '#e3f1ea'],
  ['p0', '#5f8a4a'], ['p1', '#7ea85a'], ['p2', '#a2c46f'], ['p3', '#c9de93'],
  ['f0', '#1f4636'], ['f1', '#2d6545'], ['f2', '#40844f'], ['f3', '#62a35c'],
  ['h0', '#7d8f4c'], ['h1', '#a3ad62'], ['h2', '#c8c987'],
  ['m0', '#3b3746'], ['m1', '#5f5a6c'], ['m2', '#8a8597'], ['m3', '#b8b4c2'], ['snow', '#f2f1f6'],
  ['d0', '#b48a4e'], ['d1', '#d5b06f'], ['d2', '#ead098'], ['d3', '#f6e7bd'],
  ['t0', '#aab6c8'], ['t1', '#d3dbe6'],
  ['beach', '#e8d6a0'],
  ['r0', '#7a5636'], ['r1', '#a57b50'], ['r2', '#cba574'],
  ['w0', '#5d3b26'], ['w1', '#8a5c3a'], ['w2', '#b88a5a'],
  ['roof', '#b8483c'], ['roof2', '#e07a5a'], ['wall', '#efe3c8'], ['gold', '#e6b84a'], ['teal', '#3fb5a8'],
  ['pa0', '#8f7650'], ['pa1', '#c9b48a'], ['pa2', '#e8d9b5'], ['pa3', '#f6edd6']
]);

const wob = (s, a = 1) => t => wobble(mod(t, 16), 16, a, s);
const T16 = (x, y) => [mod(x, 16), mod(y, 16)];

/* ocean base, animated */
function ocean(x, y, f) {
  const [lx, ly] = T16(x, y);
  const n = pnoise(lx, ly, 8, 16, 3);
  const w = mod(lx - f * 2 + (ly >= 8 ? 4 : 0), 8);
  if (mod(ly, 8) === 4 && (w === 0 || w === 2)) return P.o2;
  if (mod(ly, 8) === 3 && w === 1) return P.o2;
  return n > 0.62 && dither(lx, ly, 0.5) ? P.o1 : P.o0;
}
const shallowShape = TR.shape({ top: 2, bottom: 2, left: 2, right: 2, wobTop: wob(1, 2), wobBottom: wob(2, 2), wobLeft: wob(3, 2), wobRight: wob(4, 2), outer: 5, inner: 3 });
function shallowPaint(x, y, q) {
  if (!q.inside(x, y)) return 0;
  const p = q.probe(x, y, 2);
  if (p.ring) return dither(x, y, 0.5) ? P.o2 : P.o1;
  const [lx, ly] = T16(x, y);
  return hash2(lx, ly, 6) < 0.05 ? P.o4 : P.o2;
}
const landShape = TR.shape({ top: 3, bottom: 3, left: 3, right: 3, wobTop: wob(5, 2), wobBottom: wob(6, 2), wobLeft: wob(7, 2), wobRight: wob(8, 2), outer: 5, inner: 3 });
function plains(x, y) {
  const [lx, ly] = T16(x, y);
  const n = pnoise(lx, ly, 8, 16, 9);
  if (hash2(lx, ly, 2) < 0.03) return P.p0;
  if (n > 0.66 && dither(lx, ly, 0.5)) return P.p2;
  return P.p1;
}
function landPaint(x, y, q, f) {
  if (!q.cell(x, y)) return 0;
  if (q.inside(x, y)) {
    const p = q.probe(x, y, 2);
    if (p.ring) return P.out;
    if (p.min === 1) return P.beach;
    if (p.down === 2) return P.p0;
    return plains(x, y);
  }
  /* animated surf just off the coast, kept inside this cell */
  const near = q.inside(x - 1, y) || q.inside(x + 1, y) || q.inside(x, y - 1) || q.inside(x, y + 1);
  if (near) return mod(x + y + f * 2, 8) < 4 ? P.foam : 0;
  return 0;
}
const forestShape = TR.shape({ top: 2, bottom: 2, left: 2, right: 2, wobTop: wob(11, 2), wobBottom: wob(12, 1), wobLeft: wob(13, 2), wobRight: wob(14, 2), outer: 5, inner: 3 });
function forestPaint(x, y, q) {
  if (!q.inside(x, y)) return 0;
  const p = q.probe(x, y, 2);
  if (p.ring) return P.out;
  const [lx, ly] = T16(x, y);
  const row = Math.floor(ly / 4), off = mod(row, 2) * 2;
  const u = mod(lx + off, 4), v = mod(ly, 4);
  if (v === 3) return u === 3 ? P.f0 : P.f1;
  if (u === 3) return P.f1;
  if (v === 0 && u < 2) return P.f3;
  return P.f2;
}
const hillShape = TR.shape({ top: 3, bottom: 3, left: 3, right: 3, wobTop: wob(15), wobBottom: wob(16), wobLeft: wob(17), wobRight: wob(18), outer: 5, inner: 3 });
function hillPaint(x, y, q) {
  if (!q.inside(x, y)) return 0;
  const p = q.probe(x, y, 2);
  if (p.ring) return P.h0;
  const [lx, ly] = T16(x, y);
  const u = mod(lx + (ly >= 8 ? 4 : 0), 8), v = mod(ly, 8);
  const d = (u - 3.5) * (u - 3.5) / 9 + (v - 5) * (v - 5) / 4;
  if (d < 1 && v >= 3) return v === 3 || u < 3 ? P.h2 : v === 7 ? P.h0 : P.h1;
  return P.h1;
}
const mountShape = TR.shape({ top: 2, bottom: 2, left: 2, right: 2, wobTop: wob(21), wobBottom: wob(22), wobLeft: wob(23), wobRight: wob(24), outer: 4, inner: 3 });
function peakPixel(lx, ly, size, ox) {
  /* a peak centred at ox with base on row 14; returns 0 none, 1 lit face, 2 shadow face, 3 snow, 4 outline */
  const h = size, apex = 14 - h, half = h * 0.62;
  if (ly < apex || ly > 14) return 0;
  const t = (ly - apex) / h, w = t * half;
  const dx = lx + 0.5 - ox;
  if (Math.abs(dx) > w + 0.5) return 0;
  if (Math.abs(dx) > w - 0.6 || ly === 14) return 4;
  if (ly - apex < h * 0.3) return 3;
  return dx < 0.3 ? 1 : 2;
}
function mountPaint(x, y, q) {
  if (!q.inside(x, y)) return 0;
  const cx = Math.floor(x / 16), cy = Math.floor(y / 16);
  const [lx, ly] = T16(x, y);
  const nb = (q.occ(cx - 1, cy) ? 1 : 0) + (q.occ(cx + 1, cy) ? 1 : 0) + (q.occ(cx, cy - 1) ? 1 : 0) + (q.occ(cx, cy + 1) ? 1 : 0);
  const big = 8 + nb;
  const peaks = nb >= 3 ? [[big, 6], [big - 3, 11.5]] : nb === 2 ? [[big, 7.5], [5, 13]] : [[big, 8]];
  for (const [size, ox] of peaks) {
    const v = peakPixel(lx, ly, size, ox);
    if (v) return [0, P.m2, P.m1, P.snow, P.out][v];
  }
  const p = q.probe(x, y, 2);
  if (p.ring) return P.m0;
  return hash2(lx, ly, 4) < 0.12 ? P.m1 : P.m2 === 0 ? 0 : (dither(lx, ly, 0.3) ? P.p0 : P.h0);
}
const desertShape = TR.shape({ top: 3, bottom: 3, left: 3, right: 3, wobTop: wob(31, 2), wobBottom: wob(32, 2), wobLeft: wob(33, 2), wobRight: wob(34, 2), outer: 5, inner: 3 });
function desertPaint(x, y, q) {
  if (!q.inside(x, y)) return 0;
  const p = q.probe(x, y, 2);
  if (p.ring) return P.d0;
  const [lx, ly] = T16(x, y);
  if (mod(ly + Math.floor(lx / 4), 4) === 0 && mod(lx, 4) !== 3) return P.d1;
  return hash2(lx, ly, 8) < 0.04 ? P.d3 : P.d2;
}
const snowShape = TR.shape({ top: 3, bottom: 3, left: 3, right: 3, wobTop: wob(41, 2), wobBottom: wob(42, 2), wobLeft: wob(43, 2), wobRight: wob(44, 2), outer: 5, inner: 3 });
function snowPaint(x, y, q) {
  if (!q.inside(x, y)) return 0;
  const p = q.probe(x, y, 2);
  if (p.ring) return P.t0;
  const [lx, ly] = T16(x, y);
  return hash2(lx, ly, 9) < 0.06 ? P.t0 : (pnoise(lx, ly, 8, 16, 2) > 0.6 ? P.snow : P.t1);
}
function riverPaint(x, y, m, f) {
  const arm = (a, b) => x >= a && x <= b;
  const inCh = (u, v) => (u >= 6 && u <= 9 && v >= 6 && v <= 9) || ((m & 1) && u >= 6 && u <= 9 && v < 6) || ((m & 4) && u >= 6 && u <= 9 && v > 9) || ((m & 8) && v >= 6 && v <= 9 && u < 6) || ((m & 2) && v >= 6 && v <= 9 && u > 9);
  void arm;
  if (inCh(x, y)) {
    const edge = !inCh(x - 1, y) || !inCh(x + 1, y) || !inCh(x, y - 1) || !inCh(x, y + 1);
    if (edge) return P.o1;
    return mod(x + y + f, 4) === 0 ? P.o4 : P.o3;
  }
  return 0;
}
function roadPaint(x, y, m) {
  const inR = (u, v) => (u >= 7 && u <= 8 && v >= 7 && v <= 8) || ((m & 1) && u >= 7 && u <= 8 && v < 7) || ((m & 4) && u >= 7 && u <= 8 && v > 8) || ((m & 8) && v >= 7 && v <= 8 && u < 7) || ((m & 2) && v >= 7 && v <= 8 && u > 8);
  if (!inR(x, y)) return 0;
  return mod(x + y, 3) === 0 ? P.r0 : (x === 7 || y === 7) ? P.r2 : P.r1;
}
function bridge(horizontal) {
  const r = Raster.from(16, 16, (x, y) => riverPaint(x, y, horizontal ? 5 : 10, 0));
  const R = Raster.from(16, 16, (x, y) => roadPaint(x, y, horizontal ? 10 : 5));
  r.blit(R, 0, 0);
  if (horizontal) { for (let x = 4; x <= 11; x++) { r.set(x, 6, P.w0); r.set(x, 9, P.w0); r.set(x, 7, P.w2); r.set(x, 8, P.w1); } r.set(4, 5, P.w1); r.set(11, 5, P.w1); r.set(4, 10, P.w1); r.set(11, 10, P.w1); }
  else { for (let y = 4; y <= 11; y++) { r.set(6, y, P.w0); r.set(9, y, P.w0); r.set(7, y, P.w2); r.set(8, y, P.w1); } r.set(5, 4, P.w1); r.set(5, 11, P.w1); r.set(10, 4, P.w1); r.set(10, 11, P.w1); }
  return r;
}

/* ---------- markers ---------- */
function house(r, x, y, roof = P.roof) { r.rect(x, y + 2, 4, 3, P.wall); r.poly([[x - 0.5, y + 2.5], [x + 2, y - 0.5], [x + 4.5, y + 2.5]], roof); r.set(x + 1, y + 4, P.w0); }
function marker(kind, f = 0) {
  const r = new Raster(16, 16);
  switch (kind) {
    case 'village': house(r, 3, 6); house(r, 9, 8, P.roof2); house(r, 6, 10); break;
    case 'town': house(r, 2, 8); house(r, 10, 9, P.roof2); r.rect(6, 4, 4, 9, P.wall); r.poly([[5.5, 4.5], [8, 0.5], [10.5, 4.5]], P.roof); r.set(7, 7, P.w0); r.set(7, 11, P.w0); r.set(8, 11, P.w0); break;
    case 'city': r.rect(1, 6, 14, 8, P.m3); for (let x = 1; x < 15; x += 2) r.set(x, 5, P.m3); house(r, 3, 3); house(r, 9, 2, P.roof2); r.rect(6, 1, 3, 6, P.wall); r.set(7, 0, P.gold); r.rect(6, 10, 3, 4, P.w0); break;
    case 'castle': r.rect(3, 6, 10, 8, P.m3); for (const tx of [2, 11]) { r.rect(tx, 3, 3, 11, P.m2); r.set(tx, 2, P.m2); r.set(tx + 2, 2, P.m2); } r.rect(7, 2, 2, 4, P.m3); r.set(7, 0, P.teal); r.set(8, 1, P.teal); r.vline(7, 0, 2, P.w0); r.rect(7, 10, 2, 4, P.w0); break;
    case 'port': house(r, 3, 4); r.rect(2, 10, 12, 2, P.w1); for (const px of [4, 8, 12]) r.vline(px, 12, 13, P.w0); r.vline(11, 2, 8, P.w0); r.poly([[11.5, 2], [14.5, 6], [11.5, 6]], P.wall); break;
    case 'tower': r.rect(6, 3, 4, 11, P.m3); r.vline(9, 3, 13, P.m2); r.rect(5, 2, 6, 2, P.m2); r.set(5, 1, P.m2); r.set(7, 1, P.m2); r.set(9, 1, P.m2); r.set(7, 6, P.w0); r.set(7, 10, P.w0); break;
    case 'ruins': r.rect(3, 8, 2, 6, P.m2); r.rect(3, 6, 1, 2, P.m2); r.rect(9, 9, 2, 5, P.m2); r.rect(12, 11, 2, 3, P.m3); r.hline(2, 13, 13, P.m1); r.set(6, 12, P.m3); r.set(7, 12, P.m3); break;
    case 'shrine': r.rect(4, 9, 8, 5, P.wall); r.poly([[2.5, 9.5], [8, 4.5], [13.5, 9.5]], P.teal); r.rect(7, 11, 2, 3, P.gold); r.set(8, 3, P.gold); break;
    case 'lighthouse': r.poly([[6, 4], [10, 4], [11, 14], [5, 14]], P.wall); r.rect(5, 8, 7, 2, P.roof); r.rect(6, 1, 4, 3, P.m2); r.rect(7, 2, 2, 1, [P.gold, P.foam][f % 2]); if (f % 2) { r.set(4, 2, P.gold); r.set(11, 2, P.gold); } break;
    case 'cave': r.ellipse(8, 11, 6, 4.5, P.m2); r.ellipse(8, 12, 3, 3, P.out); r.rect(5, 13, 6, 2, P.out); r.set(4, 8, P.m3); r.set(5, 7, P.m3); break;
    case 'stones': for (const [sx, sh] of [[3, 5], [6, 7], [10, 6], [13, 4]]) { r.rect(sx - 1, 14 - sh, 2, sh, P.m3); r.vline(sx, 14 - sh, 13, P.m2); } r.hline(2, 14, 14, P.p0); break;
    case 'mine': r.ellipse(8, 10, 6, 4, P.m2); r.rect(5, 9, 6, 5, P.out); r.rect(4, 8, 8, 1, P.w1); r.vline(4, 8, 13, P.w1); r.vline(11, 8, 13, P.w1); r.set(7, 12, P.gold); break;
    case 'camp': r.poly([[3, 13], [7, 5], [11, 13]], P.roof2); r.vline(7, 6, 12, P.w0); r.poly([[7, 13], [7, 7], [9, 13]], P.roof); r.set(12, 12, [P.gold, P.roof2][f % 2]); r.set(13, 13, P.w0); r.set(11, 13, P.w0); break;
    case 'windmill': r.rect(6, 7, 4, 7, P.wall); r.poly([[5.5, 7.5], [8, 4.5], [10.5, 7.5]], P.roof); { const a = f * Math.PI / 4; for (let k = 0; k < 4; k++) { const ang = a + k * Math.PI / 2; r.line(8, 6, Math.round(8 + Math.cos(ang) * 5), Math.round(6 + Math.sin(ang) * 5), P.w1); } } r.set(8, 6, P.w0); break;
    case 'obelisk': r.poly([[7, 2], [9, 2], [10, 13], [6, 13]], P.m3); r.vline(9, 3, 12, P.m2); r.set(8, 1, P.gold); r.hline(5, 11, 14, P.m1); break;
    case 'ship': { const b = [0, 1, 0, -1][f]; r.poly([[2, 10 + b], [14, 10 + b], [12, 13 + b], [4, 13 + b]], P.w1); r.vline(8, 3 + b, 10 + b, P.w0); r.poly([[8.5, 3 + b], [13, 8 + b], [8.5, 8 + b]], P.wall); r.poly([[7.5, 4 + b], [7.5, 9 + b], [4, 9 + b]], P.wall); r.set(8, 2 + b, P.roof); break; }
    case 'whirlpool': for (let k = 0; k < 30; k++) { const a = k * 0.42 + f * Math.PI / 2, rad = 1 + k * 0.2; r.set(Math.round(8 + Math.cos(a) * rad), Math.round(8 + Math.sin(a) * rad * 0.7), k % 3 ? P.o4 : P.foam); } break;
    case 'waves': for (const [wx, wy] of [[3, 5], [9, 9], [4, 12]]) { const s = mod(wx + f, 4); r.set(wx + s, wy, P.foam); r.set(wx + s + 1, wy - 1, P.foam); r.set(wx + s + 2, wy, P.o4); } break;
    case 'reef': for (const [cx, cy, rr] of [[5, 9, 2], [10, 7, 1.6], [11, 11, 1.4]]) { r.disc(cx, cy, rr + 1.5, P.o3); r.disc(cx, cy, rr, P.m2); } break;
  }
  r.outline(P.out);
  return r;
}
function compass() {
  const r = new Raster(32, 32);
  r.ring(16, 16, 13, P.pa1, 2); r.ring(16, 16, 10.5, P.pa0, 1);
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2 - Math.PI / 2, b = a + Math.PI / 4;
    const tip = [16 + Math.cos(a) * 15, 16 + Math.sin(a) * 15], side1 = [16 + Math.cos(a + 1.57) * 3, 16 + Math.sin(a + 1.57) * 3], side2 = [16 + Math.cos(a - 1.57) * 3, 16 + Math.sin(a - 1.57) * 3];
    r.poly([[16, 16], tip, side1], k === 0 ? P.roof : P.pa3); r.poly([[16, 16], tip, side2], k === 0 ? P.roof2 : P.pa1);
    const t2 = [16 + Math.cos(b) * 9, 16 + Math.sin(b) * 9];
    r.poly([[16, 16], t2, [16 + Math.cos(b + 1.57) * 2, 16 + Math.sin(b + 1.57) * 2]], P.pa1);
  }
  r.disc(16, 16, 2, P.gold);
  r.outline(P.out);
  return r;
}
function parchmentFrame() {
  return Raster.from(48, 48, (x, y) => {
    const e = Math.min(x, y, 47 - x, 47 - y);
    if (e === 0) return P.out; if (e === 1) return P.pa0; if (e === 2) return P.pa2; if (e === 3) return P.pa1;
    if (e === 4) return P.pa0;
    if (e < 6) return P.pa3;
    return 0;
  });
}
function cartouche() {
  const r = new Raster(48, 16);
  r.rect(4, 2, 40, 12, P.pa3); r.box(4, 2, 40, 12, P.pa0); r.box(5, 3, 38, 10, P.pa1);
  for (const sx of [1, 44]) { r.rect(sx, 4, 3, 8, P.pa2); r.vline(sx + (sx < 10 ? 0 : 2), 4, 11, P.pa0); }
  r.outline(P.out);
  return r;
}

function build() {
  const pack = new Pack({ id: 'grand-atlas', name: 'Grand Atlas: Overworld Studio', code: 'GA', palette: P });
  pack.sheet('terrain', { name: 'Atlas terrain', cols: 16 });
  pack.sheet('coast', { name: 'Atlas coastline (animated)', cols: 16 });
  pack.sheet('features', { name: 'Atlas rivers, roads and markers', cols: 16 });
  const oceanA = pack.add('terrain', { id: 'ga-ocean', name: 'Ocean', category: 'Ocean', frames: [0, 1, 2, 3].map(f => Raster.from(16, 16, (x, y) => ocean(x, y, f))), duration: 260, meta: { ground: 'ocean' }, tags: ['animated'] });
  pack.extra.ground = [{ id: 'ocean', name: 'Ocean', assets: [oceanA.id] }];
  K.addBlobSet(pack, { sheet: 'terrain', id: 'shallows', prefix: 'ga', name: 'Shallows', category: 'Shallows (autotile)', shape: shallowShape, painter: shallowPaint, order: 1, color: '#33698f' });
  K.addBlobSet(pack, { sheet: 'coast', id: 'land', prefix: 'ga', name: 'Land', category: 'Coastline (autotile)', shape: landShape, painter: landPaint, frames: 4, duration: 260, order: 2, color: '#7ea85a', newRow: false });
  K.addBlobSet(pack, { sheet: 'terrain', id: 'desert', prefix: 'ga', name: 'Desert', category: 'Desert (autotile)', shape: desertShape, painter: desertPaint, order: 3, color: '#ead098' });
  K.addBlobSet(pack, { sheet: 'terrain', id: 'snowfield', prefix: 'ga', name: 'Snowfield', category: 'Snowfield (autotile)', shape: snowShape, painter: snowPaint, order: 4, color: '#d3dbe6' });
  K.addBlobSet(pack, { sheet: 'terrain', id: 'hills', prefix: 'ga', name: 'Hills', category: 'Hills (autotile)', shape: hillShape, painter: hillPaint, order: 5, color: '#a3ad62' });
  K.addBlobSet(pack, { sheet: 'terrain', id: 'forest', prefix: 'ga', name: 'Forest', category: 'Forest (autotile)', shape: forestShape, painter: forestPaint, order: 6, color: '#40844f' });
  K.addBlobSet(pack, { sheet: 'terrain', id: 'mountains', prefix: 'ga', name: 'Mountains', category: 'Mountains (autotile)', shape: mountShape, painter: mountPaint, order: 7, color: '#8a8597' });
  K.addEdgeSet(pack, { sheet: 'features', id: 'river', prefix: 'ga', name: 'River', category: 'Rivers', painter: riverPaint, frames: 4, duration: 220, order: 8, color: '#4f8eae', newRow: false });
  K.addEdgeSet(pack, { sheet: 'features', id: 'road', prefix: 'ga', name: 'Road', category: 'Roads', painter: roadPaint, order: 9, color: '#a57b50' });
  pack.newRow('features');
  pack.add('features', { id: 'ga-bridge-h', name: 'Bridge (east–west)', category: 'Bridges', frames: [bridge(true)] });
  pack.add('features', { id: 'ga-bridge-v', name: 'Bridge (north–south)', category: 'Bridges', frames: [bridge(false)] });
  const MARK = [['village', 'Village'], ['town', 'Town'], ['city', 'Walled city'], ['castle', 'Keep'], ['port', 'Harbour'], ['tower', 'Watchtower'], ['ruins', 'Ruins'], ['shrine', 'Shrine'], ['cave', 'Cave'], ['stones', 'Standing stones'], ['mine', 'Mine'], ['obelisk', 'Monument']];
  for (const [k, n] of MARK) pack.add('features', { id: `ga-marker-${k}`, name: n, category: k.match(/village|town|city|castle|port/) ? 'Settlements' : 'Landmarks', frames: [marker(k)], meta: { marker: k } });
  for (const [k, n, frames, d] of [['lighthouse', 'Lighthouse', 2, 500], ['windmill', 'Windmill', 2, 300], ['camp', 'Camp', 2, 300]]) pack.add('features', { id: `ga-marker-${k}`, name: n, category: 'Landmarks', frames: Array.from({ length: frames }, (_, f) => marker(k, f)), duration: d, meta: { marker: k }, tags: ['animated'] });
  for (const [k, n] of [['ship', 'Ship'], ['whirlpool', 'Whirlpool'], ['waves', 'Waves']]) pack.add('features', { id: `ga-sea-${k}`, name: n, category: 'Sea', frames: [0, 1, 2, 3].map(f => marker(k, f)), duration: 220, tags: ['animated'] });
  pack.add('features', { id: 'ga-sea-reef', name: 'Reef', category: 'Sea', frames: [marker('reef')] });
  pack.newRow('features');
  pack.add('features', { id: 'ga-compass', name: 'Compass rose', category: 'Map dressing', frames: [compass()] });
  pack.add('features', { id: 'ga-frame', name: 'Parchment border', category: 'Map dressing', frames: [parchmentFrame()], meta: { nineSlice: [6, 6, 6, 6] } });
  pack.add('features', { id: 'ga-cartouche', name: 'Title cartouche', category: 'Map dressing', frames: [cartouche()], meta: { nineSlice: [8, 4, 8, 4] } });
  pack.extra.generator = true;
  sampleMaps(pack);
  return pack;
}

function sampleMaps(pack) {
  const meta = pack.metadata();
  for (const [id, name, opts] of [['atlas-sample-1', 'Sample world: Tidewater', { seed: 'tidewater', width: 64, height: 44 }], ['atlas-sample-2', 'Sample world: Ember Reach', { seed: 'ember reach', width: 64, height: 44, land: 0.62, mountains: 0.7 }], ['atlas-sample-3', 'Sample world: Isles of Vael', { seed: 'isles of vael', width: 64, height: 44, land: 0.36, rivers: 0.3 }]]) {
    const world = GEN.generate(opts);
    const layers = GEN.toLayers(world, meta);
    const mb = new K.MapBuilder(pack, id, name, world.width, world.height);
    for (const L of layers) { const ml = mb.layer(L.name); ml.data = L.data.map(t => t ? { sheet: t.sheet, tile: t.tile } : 0); }
    mb.done();
  }
}

module.exports = { build, palette: P };
