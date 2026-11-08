'use strict';
const { Raster, Palette, mulberry32, hash2, pnoise, dither, wobble, mod } = require('../lib/raster.js');
const { Pack } = require('../lib/pack.js');
const TR = require('../lib/terrain.js');
const K = require('../lib/kit.js');
const A = require('../lib/art.js');

const P = new Palette([
  ['out', '#221a24'],
  ['g0', '#24503b'], ['g1', '#35704a'], ['g2', '#4f9152'], ['g3', '#74b15c'], ['g4', '#a6d36e'],
  ['c0', '#3d3638'], ['c1', '#5d5354'], ['c2', '#7f7473'], ['c3', '#a39894'], ['c4', '#c9bfb7'],
  ['p1', '#cdb995'], ['p2', '#e9dcbc'], ['p3', '#f8f0dc'],
  ['t0', '#3b2420'], ['t1', '#5f3a2a'], ['t2', '#8a5a3a'], ['t3', '#b5844f'],
  ['r0', '#6b2a2a'], ['r1', '#9b3c34'], ['r2', '#c55b44'], ['r3', '#e08a5e'],
  ['s0', '#283247'], ['s1', '#3b4b66'], ['s2', '#557090'], ['s3', '#7f9bb7'],
  ['h0', '#6d5426'], ['h1', '#9d7b38'], ['h2', '#c9a24e'], ['h3', '#e8cc7a'],
  ['b0', '#2a3d5c'], ['b1', '#4d78a8'], ['b2', '#9fd0e6'],
  ['l0', '#e88a2c'], ['l1', '#f8c45a'], ['l2', '#fff0b8'],
  ['a1', '#2f8f86'], ['a2', '#56c1b0'], ['a4', '#6b4fa0'], ['a5', '#9a7fd0'],
  ['m0', '#3c4150'], ['m1', '#6b7385'], ['m2', '#a6adbb']
]);

/* ---------- ground ---------- */
const TUFTS = (() => { const L = new Raster(16, 16); const rng = mulberry32(8); for (let i = 0; i < 6; i++) { const x = Math.floor(rng() * 16), y = Math.floor(rng() * 16); L.set(x, y, P.g3); L.set(mod(x + 2, 16), y, P.g3); L.set(mod(x + 1, 16), mod(y + 1, 16), P.g1); } return L; })();
function grassTexV(v) {
  const inner = (() => { const L = new Raster(16, 16); const rng = mulberry32(90 + v * 17); for (let i = 0; i < 4; i++) { const x = Math.floor(rng() * 16), y = Math.floor(rng() * 16); L.set(x, y, P.g3); L.set(mod(x + 2, 16), y, P.g3); L.set(mod(x + 1, 16), mod(y + 1, 16), P.g1); } return L; })();
  return (x, y) => {
    const lx = mod(x, 16), ly = mod(y, 16), band = K.inBand(lx, ly);
    const t = band ? TUFTS.get(lx, ly) : inner.get(lx, ly); if (t) return t;
    const n = pnoise(lx, ly, 8, 16, band ? 2 : 2 + v * 5);
    if (n > 0.66 && dither(lx, ly, 0.5)) return P.g3;
    if (n < 0.3 && dither(lx + 1, ly, 0.4)) return P.g1;
    return P.g2;
  };
}
/* round cobbles on a 6px staggered lattice, periodic over 12? → use 16-periodic hand layout */
const COBBLES = (() => {
  const cells = []; const rng = mulberry32(12);
  const rows = [[0, 0], [5, 0], [10, 0], [2.5, 5], [7.5, 5], [12.5, 5], [0, 10.5], [5, 10.5], [10, 10.5]];
  for (const [x, y] of rows) cells.push([x + 2.6 + (rng() - 0.5), y + 2.4 + (rng() - 0.5), 2.2 + rng() * 0.5, rng()]);
  return cells;
})();
function cobbleTex(x, y) {
  const lx = mod(x, 16), ly = mod(y, 16);
  let best = null, bd = 9;
  for (const c of COBBLES) for (const ox of [-16, 0, 16]) for (const oy of [-16, 0, 16]) {
    const dx = lx + 0.5 - c[0] - ox, dy = ly + 0.5 - c[1] - oy;
    const d = Math.hypot(dx / 1.15, dy) / c[2];
    if (d < bd) { bd = d; best = [c, dx, dy]; }
  }
  if (bd > 1) return P.c1;
  const [c, dx, dy] = best;
  const l = -dx * 0.5 - dy * 0.7;
  if (bd > 0.82 && dx + dy > 0) return P.c1;
  if (l > 1.1) return P.c4;
  return c[3] > 0.5 ? P.c3 : P.c2;
}
const wob = (seed) => t => wobble(mod(t, 16), 16, 1, seed);
const cobbleShape = TR.shape({ top: 2, bottom: 2, left: 2, right: 2, wobTop: wob(1), wobBottom: wob(2), wobLeft: wob(3), wobRight: wob(4), outer: 4, inner: 3 });
function cobblePaint(x, y, q) {
  if (!q.inside(x, y)) return 0;
  const p = q.probe(x, y, 2);
  if (p.ring) return P.c0;
  if (p.down === 1) return P.c1;
  return cobbleTex(x, y);
}
function slabTex(x, y) {
  const lx = mod(x, 16), ly = mod(y, 16);
  const off = ly >= 8 ? 4 : 0;
  const u = mod(lx + off, 8), v = ly & 7;
  if (u === 0 || v === 0) return P.c2;
  if (v === 1) return P.p3;
  if (u === 7 || v === 7) return P.c3;
  return hash2(Math.floor(mod(lx + off, 16) / 8), ly >> 3, 3) > 0.5 ? P.p2 : P.p1;
}
const slabShape = TR.shape({ top: 2, bottom: 2, left: 2, right: 2, outer: 2, inner: 2 });
function slabPaint(x, y, q) {
  if (!q.inside(x, y)) return 0;
  const p = q.probe(x, y, 2);
  if (p.ring) return P.c1;
  if (p.down === 1 || p.right === 1) return P.c2;
  return slabTex(x, y);
}

/* ---------- building parts ---------- */
const MATERIALS = ['plaster', 'stone', 'planks'];
function wallPiece(mat, row, col) {
  /* row: 'upper' | 'lower', col: 'left' | 'mid' | 'right' */
  const r = new Raster(16, 16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const wy = row === 'upper' ? y : y + 16;
    let c;
    if (mat === 'plaster') {
      c = dither(x, wy, 0.12) ? P.p1 : P.p2;
      if (wy <= 1 || wy === 15 || wy === 16 || wy >= 29) c = wy === 0 || wy === 16 ? P.t2 : P.t1;
      if (row === 'upper' && col === 'mid' && y > 1 && y < 15 && (x === y || x === y - 1)) c = P.t1;
      if (row === 'lower' && col === 'mid' && (x === 7 || x === 8) && wy < 29) c = x === 7 ? P.t2 : P.t1;
    } else if (mat === 'stone') {
      const rowi = Math.floor(wy / 5), off = (rowi % 2) * 4;
      const u = mod(x + off, 8), v = wy % 5;
      c = (v === 4 || u === 7) ? P.c1 : v === 0 ? P.c4 : (hash2(Math.floor(mod(x + off, 16) / 8), rowi, 5) > 0.5 ? P.c3 : P.c2);
    } else {
      const v = wy % 4;
      c = v === 3 ? P.t1 : v === 0 ? P.t3 : P.t2;
      if (v === 2 && hash2(x, wy, 9) < 0.08) c = P.t1;
    }
    if (wy >= 29) c = wy === 29 ? P.c3 : wy === 30 ? P.c2 : P.c1;
    if (col === 'left' && x <= 1) c = x === 0 ? P.out : (mat === 'planks' ? P.t3 : mat === 'stone' ? P.c4 : P.t2);
    if (col === 'right' && x >= 14) c = x === 15 ? P.out : (mat === 'planks' ? P.t1 : mat === 'stone' ? P.c1 : P.t1);
    if (wy <= 1 && mat !== 'plaster') c = wy === 0 ? P.out : P.c0;
    if (wy === 0 && mat === 'plaster') c = P.out;
    if (wy === 31) c = P.out;
    r.set(x, y, c);
  }
  return r;
}
const ROOFS = {
  clay: { ink: [P.r0, P.r1, P.r2, P.r3], name: 'Clay' },
  slate: { ink: [P.s0, P.s1, P.s2, P.s3], name: 'Slate' },
  thatch: { ink: [P.h0, P.h1, P.h2, P.h3], name: 'Thatch' }
};
function roofTex(style, x, y) {
  const [d, m, l, h] = ROOFS[style].ink;
  const lx = mod(x, 16);
  if (style === 'clay') {
    const row = Math.floor(y / 4), off = (row % 2) * 2, u = mod(lx + off, 4), v = mod(y, 4);
    if (v === 3) return u === 3 ? d : m;
    if (u === 3) return m;
    if (v === 0) return h;
    return l;
  }
  if (style === 'slate') {
    const row = Math.floor(y / 4), off = (row % 2) * 4, u = mod(lx + off, 8), v = mod(y, 4);
    if (v === 3) return d;
    if (u === 7) return d;
    if (v === 0) return l;
    return hash2(Math.floor(mod(lx + off, 16) / 8), row % 4, 2) > 0.6 ? l : m;
  }
  const row = Math.floor(y / 5), v = mod(y, 5);
  if (v === 4) return d;
  const s = hash2(lx, row % 3, 4);
  if (v === 3) return s > 0.5 ? m : d;
  return s < 0.25 ? m : s > 0.8 ? h : l;
}
function roofPiece(style, row, col) {
  const r = new Raster(16, 16);
  const [d, m, l, h] = ROOFS[style].ink;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const ry = row === 'ridge' ? y : row === 'body' ? y + 16 : y + 32;
    let c = roofTex(style, x, ry);
    if (row === 'ridge' && y <= 3) c = y === 0 ? P.out : y === 1 ? h : y === 2 ? l : d;
    if (row === 'eave') { if (y === 12) c = d; if (y === 13) c = P.t2; if (y === 14) c = P.t1; if (y === 15) c = P.out; }
    if (col === 'left' && x === 0) c = P.out;
    if (col === 'left' && x === 1 && !(row === 'eave' && y >= 13)) c = h;
    if (col === 'right' && x === 15) c = P.out;
    if (col === 'right' && x === 14 && !(row === 'eave' && y >= 13)) c = d;
    r.set(x, y, c);
  }
  return r;
}
function chimney() {
  const r = new Raster(16, 16);
  r.rect(5, 2, 6, 12, P.c2); r.vline(5, 2, 13, P.c3); r.vline(10, 2, 13, P.c1);
  for (let y = 4; y < 14; y += 3) r.hline(6, 9, y, P.c1);
  r.rect(4, 1, 8, 2, P.c3); r.hline(4, 11, 1, P.c4);
  r.outline(P.out);
  return r;
}
function windowOverlay(kind, lit) {
  const r = new Raster(16, 16);
  const glass = lit ? [P.l0, P.l1, P.l2] : [P.b0, P.b1, P.b2];
  if (kind === 'round') {
    r.disc(8, 8, 5, P.t1); r.disc(8, 8, 3.6, glass[1]);
    r.set(6, 6, glass[2]); r.set(7, 6, glass[2]); r.set(6, 7, glass[2]);
    r.hline(5, 11, 8, P.t1); r.vline(8, 5, 11, P.t1);
    r.outline(P.out);
    return r;
  }
  r.rect(3, 3, 10, 9, P.t1);
  r.rect(4, 4, 8, 7, glass[1]);
  r.hline(4, 11, 7, P.t1); r.vline(7, 4, 10, P.t1); r.vline(8, 4, 10, P.t2);
  r.set(4, 4, glass[2]); r.set(5, 4, glass[2]); r.set(4, 5, glass[2]); r.set(9, 4, glass[2]); r.set(9, 8, glass[2]);
  if (!lit) { r.set(6, 10, glass[0]); r.set(11, 10, glass[0]); r.set(11, 6, glass[0]); }
  r.rect(2, 12, 12, 2, P.t3); r.hline(2, 13, 13, P.t1);
  if (kind === 'shutters') for (const sx of [0, 13]) { r.rect(sx, 3, 3, 9, P.a1); r.vline(sx + 1, 4, 10, P.a2); r.hline(sx, sx + 2, 7, P.out); }
  if (kind === 'flowers') { r.rect(3, 13, 10, 2, P.t2); r.hline(3, 12, 14, P.t1); for (const [fx, c] of [[4, P.r2], [6, P.l1], [8, P.a5], [10, P.r3], [12, P.l1]]) { r.set(fx, 12, c); r.set(fx - 1, 12, P.g3); } }
  r.outline(P.out);
  return r;
}
function doorOverlay(kind) {
  const r = new Raster(16, 32);
  const color = kind === 'green' ? [P.a1, P.a2, P.g0] : [P.t2, P.t3, P.t1];
  /* frame */
  r.rect(2, 10, 12, 21, P.c3); r.hline(3, 12, 9, P.c3); r.hline(4, 11, 8, P.c4);
  for (let y = 10; y <= 29; y++) for (let x = 4; x <= 11; x++) {
    if (y === 10 && (x === 4 || x === 11)) continue;
    let c = mod(x - 4, 3) === 2 ? color[2] : color[0];
    if (x === 4) c = color[1];
    if (y === 15 || y === 24) c = P.m1;
    r.set(x, y, c);
  }
  r.set(10, 20, P.l1); r.set(10, 21, P.l0);
  r.rect(1, 30, 14, 2, P.c2); r.hline(1, 14, 30, P.c4);
  if (kind === 'arched') { r.rect(6, 12, 4, 3, P.b1); r.set(6, 12, P.b2); r.set(7, 12, P.b2); r.vline(8, 12, 14, P.t1); }
  r.outline(P.out);
  return r;
}
function doubleDoor() {
  const r = new Raster(32, 32);
  r.rect(3, 8, 26, 23, P.c3); r.hline(5, 26, 7, P.c3); r.hline(7, 24, 6, P.c4);
  for (let y = 9; y <= 29; y++) for (let x = 5; x <= 26; x++) {
    let c = mod(x - 5, 3) === 2 ? P.t1 : P.t2;
    if (x === 15 || x === 16) c = P.out;
    if (y === 14 || y === 24) c = P.m1;
    r.set(x, y, c);
  }
  r.set(13, 19, P.l1); r.set(18, 19, P.l1);
  r.rect(2, 30, 28, 2, P.c2); r.hline(2, 29, 30, P.c4);
  r.outline(P.out);
  return r;
}

/* ---------- props ---------- */
function stall(colors, goods) {
  const r = new Raster(32, 32);
  for (const px of [3, 27]) { r.rect(px, 8, 2, 20, P.t2); r.vline(px, 8, 27, P.t3); }
  for (let y = 2; y <= 9; y++) for (let x = 1; x <= 30; x++) {
    const stripe = Math.floor((x - 1) / 4) % 2;
    let c = stripe ? colors[0] : P.p3;
    if (y >= 8) c = stripe ? colors[1] : P.p1;
    if (y === 9 && mod(x, 4) === 0) continue;
    r.set(x, y, c);
  }
  r.hline(2, 29, 1, P.out);
  r.rect(2, 18, 28, 9, P.t2); r.hline(2, 29, 18, P.t3); r.hline(2, 29, 26, P.t1);
  for (let x = 6; x < 28; x += 6) r.vline(x, 19, 25, P.t1);
  const rng = mulberry32(goods.length * 7 + colors[0]);
  if (goods === 'fruit') for (let k = 0; k < 11; k++) { const x = 5 + k * 2 + Math.floor(rng() * 2), y = 15 + (k % 2); r.disc(x, y, 1.3, [P.r2, P.l1, P.g3][k % 3]); r.set(x - 1, y - 1, P.l2); }
  if (goods === 'cloth') for (let k = 0; k < 5; k++) { const x = 4 + k * 5; r.rect(x, 13, 4, 5, [P.a4, P.a1, P.r1, P.h2, P.s2][k]); r.hline(x, x + 3, 13, [P.a5, P.a2, P.r3, P.h3, P.s3][k]); }
  if (goods === 'pots') for (let k = 0; k < 5; k++) { const x = 6 + k * 5, h = 3 + (k % 2) * 2; r.ellipse(x, 17 - h / 2, 2, h / 2 + 0.5, k % 2 ? P.r1 : P.t3); r.set(x - 1, 16 - h, P.p3); }
  r.outline(P.out);
  return r;
}
function well() {
  const r = new Raster(32, 32);
  A.shadow(r, 16, 29.5, 12, 2, P.g1);
  r.ellipse(16, 22, 11, 6, P.c2);
  for (let y = 16; y <= 28; y++) for (let x = 5; x <= 27; x++) if (y > 21 && r.get(x, y - 6)) r.set(x, y, mod(x + (y > 25 ? 3 : 0), 6) === 0 || y === 25 ? P.c1 : y < 25 ? P.c3 : P.c2);
  r.ellipse(16, 21.5, 11, 5.5, P.c3); r.ellipse(16, 21.5, 8.5, 3.6, P.b0); r.ellipse(15, 21, 5, 2, P.b1); r.set(13, 20, P.b2);
  for (const px of [6, 25]) { r.rect(px, 4, 2, 18, P.t2); r.vline(px, 4, 21, P.t3); }
  r.hline(7, 25, 9, P.t1); r.rect(14, 10, 4, 4, P.t2); r.vline(16, 10, 13, P.m1);
  for (let k = 0; k < 4; k++) r.hline(3 + k * 0, 28, 1 + k, [P.r3, P.r2, P.r1, P.r0][k]);
  r.set(2, 4, P.r0); r.set(29, 4, P.r0);
  r.outline(P.out);
  return r;
}
function lamppost(f, lit) {
  const r = new Raster(16, 32);
  r.rect(7, 10, 2, 19, P.m0); r.vline(7, 10, 28, P.m1);
  r.rect(5, 28, 6, 2, P.m0); r.hline(5, 10, 28, P.m1);
  r.rect(4, 3, 8, 7, P.m0);
  const glow = lit ? [[P.l1, P.l2, P.l1], [P.l2, P.l2, P.l1], [P.l1, P.l1, P.l0], [P.l2, P.l1, P.l1]][f] : [P.b0, P.b1, P.b0];
  r.rect(5, 4, 6, 5, glow[0]); r.rect(6, 5, 4, 3, glow[1]); r.set(7, 6, glow[2]);
  r.hline(3, 12, 2, P.m1); r.hline(5, 10, 1, P.m0); r.set(7, 0, P.m0); r.set(8, 0, P.m0);
  r.hline(4, 11, 9, P.m1);
  r.outline(P.out);
  return r;
}
function crate(kind) {
  const r = new Raster(16, 16);
  r.rect(2, 4, 12, 11, P.t2); r.rect(2, 3, 12, 2, P.t3);
  r.box(2, 4, 12, 11, P.t1); r.hline(2, 13, 3, P.t3);
  if (kind === 'x') { r.line(3, 5, 12, 13, P.t1); r.line(12, 5, 3, 13, P.t1); }
  else { r.hline(3, 12, 8, P.t1); r.hline(3, 12, 11, P.t1); r.set(4, 6, P.t3); r.set(11, 13, P.t1); }
  r.outline(P.out);
  return r;
}
function barrel(open) {
  const r = new Raster(16, 16);
  for (let y = 3; y <= 14; y++) { const half = 4.5 + Math.sin(Math.PI * (y - 3) / 11) * 1.2; for (let x = Math.round(8 - half); x < Math.round(8 + half); x++) r.set(x, y, x < 6 ? P.t3 : x > 10 ? P.t1 : P.t2); }
  for (const y of [5, 12]) r.hline(3, 12, y, P.m1);
  r.ellipse(8, 3.5, 4.5, 1.6, open ? P.t1 : P.t3);
  if (open) { r.set(6, 3, P.r2); r.set(7, 3, P.r3); r.set(9, 3, P.r2); r.set(8, 2, P.l1); r.set(10, 3, P.g3); }
  else r.hline(6, 10, 3, P.t2);
  r.outline(P.out);
  return r;
}
function sacks() {
  const r = new Raster(16, 16);
  for (const [cx, cy, s] of [[5.5, 10, 4], [11, 11, 3.5]]) { r.ellipse(cx, cy, s, s + 0.5, P.h2); r.ellipse(cx - 1, cy - 1, s - 1.5, s - 1.2, P.h3); r.set(Math.round(cx), Math.round(cy - s - 0.5), P.h1); r.set(Math.round(cx), Math.round(cy + 1), P.h1); }
  r.outline(P.out);
  return r;
}
function signpost() {
  const r = new Raster(16, 32);
  r.rect(7, 6, 2, 23, P.t2); r.vline(7, 6, 28, P.t3);
  r.poly([[1, 8], [12, 8], [15, 10.5], [12, 13], [1, 13]], P.t3); r.hline(2, 12, 12, P.t1);
  r.poly([[4, 15], [15, 15], [15, 20], [4, 20], [1, 17.5]], P.t2); r.hline(4, 14, 15, P.t3);
  r.rect(6, 28, 4, 2, P.t1);
  r.outline(P.out);
  return r;
}
function hangingSign() {
  const r = new Raster(16, 16);
  r.hline(1, 14, 2, P.m1); r.set(1, 3, P.m0); r.vline(4, 3, 5, P.m0); r.vline(11, 3, 5, P.m0);
  r.rect(2, 6, 12, 8, P.t3); r.box(2, 6, 12, 8, P.t1); r.rect(4, 8, 8, 4, P.p2);
  r.outline(P.out);
  return r;
}
function noticeBoard() {
  const r = new Raster(32, 32);
  for (const px of [4, 26]) { r.rect(px, 6, 2, 23, P.t2); r.vline(px, 6, 28, P.t3); }
  r.rect(2, 5, 28, 16, P.t1); r.rect(3, 6, 26, 14, P.t2);
  r.poly([[1, 5], [16, 0.5], [31, 5]], P.r1); r.hline(1, 30, 5, P.r0);
  for (const [x, y, w, h] of [[5, 8, 7, 9], [14, 7, 6, 6], [22, 9, 5, 8], [14, 14, 7, 5]]) { r.rect(x, y, w, h, P.p3); r.vline(x + w - 1, y, y + h - 1, P.p1); r.set(x + (w >> 1), y, P.r2); }
  r.outline(P.out);
  return r;
}
function bench() {
  const r = new Raster(32, 16);
  r.rect(2, 4, 28, 3, P.t2); r.hline(2, 29, 4, P.t3);
  r.rect(2, 9, 28, 3, P.t3); r.hline(2, 29, 11, P.t1);
  for (const lx of [4, 26]) { r.rect(lx, 7, 2, 2, P.m1); r.rect(lx, 12, 2, 3, P.m0); }
  r.outline(P.out);
  return r;
}
function planter() {
  const r = new Raster(16, 16);
  r.rect(2, 9, 12, 6, P.t2); r.hline(2, 13, 9, P.t3); r.hline(2, 13, 14, P.t1);
  r.hline(3, 12, 8, P.t0);
  const fl = [[3, P.r2], [5, P.l1], [7, P.a5], [9, P.r3], [11, P.l1], [12, P.p3]];
  for (const [x, c] of fl) { r.set(x, 7, P.g2); r.set(x, 6, c); r.set(x + 1, 7, P.g3); }
  r.set(4, 5, P.r3); r.set(8, 5, P.a5); r.set(10, 5, P.p3);
  r.outline(P.out);
  return r;
}
function cart() {
  const r = new Raster(32, 32);
  r.rect(3, 12, 24, 9, P.t2); r.hline(3, 26, 12, P.t3); r.hline(3, 26, 20, P.t1);
  for (let x = 7; x < 26; x += 5) r.vline(x, 13, 19, P.t1);
  r.line(26, 18, 31, 22, P.t1); r.line(26, 19, 31, 23, P.t2);
  for (const [cx, cy] of [[8, 24], [21, 24]]) { r.disc(cx, cy, 4.5, P.t1); r.disc(cx, cy, 3.3, P.t3); r.disc(cx, cy, 1.2, P.m1); r.line(cx - 3, cy, cx + 3, cy, P.t1); r.line(cx, cy - 3, cx, cy + 3, P.t1); }
  for (let k = 0; k < 6; k++) r.ellipse(7 + k * 3.2, 11, 2.2, 1.8, k % 2 ? P.h2 : P.h3);
  r.outline(P.out);
  return r;
}
function hay() {
  const r = new Raster(16, 16);
  r.rect(2, 5, 12, 9, P.h2); r.hline(2, 13, 5, P.h3); r.hline(2, 13, 13, P.h1);
  for (let x = 3; x < 13; x += 2) r.vline(x, 6, 12, hash2(x, 1, 2) > 0.5 ? P.h1 : P.h3);
  r.vline(5, 5, 13, P.t1); r.vline(10, 5, 13, P.t1);
  r.outline(P.out);
  return r;
}
function picket(x, y, m) {
  const post = x >= 6 && x <= 9 && y >= 2 && y <= 13;
  if (post) { if (x === 6 || x === 9 || y === 13) return P.out; if (y === 2) return (x === 7 || x === 8) ? P.out : 0; return x === 7 ? P.p3 : P.p1; }
  const rail = y === 6 || y === 7 || y === 10 || y === 11;
  if (((m & 2) && x > 9) || ((m & 8) && x < 6)) {
    const lx = x;
    const pick = mod(lx, 4) === 1 || mod(lx, 4) === 2;
    if (pick && y >= 4 && y <= 12) { if (y === 4 && mod(lx, 4) === 2) return 0; return y === 12 ? P.out : (mod(lx, 4) === 1 ? P.p3 : P.p1); }
    if (rail) return y % 2 ? P.p1 : P.c4;
    if (y === 5 || y === 8 || y === 9 || y === 12) return pick ? P.out : 0;
    if (pick && (y === 3)) return P.out;
  }
  if (((m & 1) && y < 2) || ((m & 4) && y > 13)) { if (x === 7 || x === 8) return x === 7 ? P.p3 : P.p1; if (x === 6 || x === 9) return P.out; }
  return 0;
}

function build() {
  const pack = new Pack({ id: 'hearthvale', name: 'Hearthvale Town Tileset', code: 'HV', palette: P });
  pack.sheet('terrain', { name: 'Hearthvale ground', cols: 16 });
  pack.sheet('buildings', { name: 'Hearthvale buildings', cols: 16 });
  pack.sheet('props', { name: 'Hearthvale props', cols: 16 });

  const grass = [];
  const deco = [() => { }, r => { r.set(6, 7, P.g4); r.set(8, 7, P.g4); r.set(7, 8, P.g3); }, r => { for (const [x, y] of [[5, 6], [10, 10]]) { r.set(x, y, P.p3); r.set(x + 1, y, P.l1); } }, r => { r.set(9, 5, P.c3); r.set(10, 5, P.c2); r.set(9, 6, P.c1); }];
  [() => { }, () => { }].concat(deco).forEach((d, i) => { const r = Raster.from(16, 16, grassTexV(i % 3)); d(r); grass.push(pack.add('terrain', { id: `hv-grass-${i + 1}`, name: `Grass ${i + 1}`, category: 'Ground', frames: [r], meta: { ground: 'grass' } }).id); });
  const plaza = pack.add('terrain', { id: 'hv-plaza', name: 'Plaza stone', category: 'Ground', frames: [Raster.from(16, 16, slabTex)], meta: { ground: 'plaza' } }).id;
  const cob = pack.add('terrain', { id: 'hv-cobble-fill', name: 'Cobblestones', category: 'Ground', frames: [Raster.from(16, 16, cobbleTex)], meta: { ground: 'cobble' } }).id;
  pack.extra.ground = [{ id: 'grass', name: 'Grass', assets: grass, plain: 3 }, { id: 'cobble', name: 'Cobblestones', assets: [cob] }, { id: 'plaza', name: 'Plaza stone', assets: [plaza] }];
  K.addBlobSet(pack, { sheet: 'terrain', id: 'cobble', name: 'Cobblestone path', category: 'Cobblestone (autotile)', shape: cobbleShape, painter: cobblePaint, order: 1, color: '#7f7473' });
  K.addBlobSet(pack, { sheet: 'terrain', id: 'plaza', name: 'Plaza slabs', category: 'Plaza (autotile)', shape: slabShape, painter: slabPaint, order: 2, color: '#e9dcbc' });

  const B = 'buildings';
  for (const mat of MATERIALS) {
    pack.newRow(B);
    for (const row of ['upper', 'lower']) for (const col of ['left', 'mid', 'right'])
      pack.add(B, { id: `hv-wall-${mat}-${row}-${col}`, name: `${mat[0].toUpperCase() + mat.slice(1)} wall ${row} ${col}`, category: 'Walls', frames: [wallPiece(mat, row, col)], tags: ['building', mat] });
  }
  for (const style of Object.keys(ROOFS)) {
    pack.newRow(B);
    for (const row of ['ridge', 'body', 'eave']) for (const col of ['left', 'mid', 'right'])
      pack.add(B, { id: `hv-roof-${style}-${row}-${col}`, name: `${ROOFS[style].name} roof ${row} ${col}`, category: 'Roofs', frames: [roofPiece(style, row, col)], tags: ['building', style] });
  }
  pack.newRow(B);
  pack.add(B, { id: 'hv-chimney', name: 'Chimney', category: 'Roofs', frames: [chimney()], tags: ['overlay'] });
  for (const [k, lit] of [['plain', false], ['shutters', false], ['flowers', false], ['round', false], ['plain', true], ['round', true]])
    pack.add(B, { id: `hv-window-${k}${lit ? '-lit' : ''}`, name: `Window (${k}${lit ? ', lit' : ''})`, category: 'Windows', frames: [windowOverlay(k, lit)], tags: ['overlay'] });
  pack.newRow(B);
  pack.add(B, { id: 'hv-door-wood', name: 'Wooden door', category: 'Doors', frames: [doorOverlay('wood')], tags: ['overlay'] });
  pack.add(B, { id: 'hv-door-green', name: 'Painted door', category: 'Doors', frames: [doorOverlay('green')], tags: ['overlay'] });
  pack.add(B, { id: 'hv-door-arched', name: 'Door with window', category: 'Doors', frames: [doorOverlay('arched')], tags: ['overlay'] });
  pack.add(B, { id: 'hv-door-double', name: 'Double door', category: 'Doors', frames: [doubleDoor()], tags: ['overlay'] });

  const R = 'props';
  pack.add(R, { id: 'hv-stall-fruit', name: 'Market stall (fruit)', category: 'Market', frames: [stall([P.r2, P.r1], 'fruit')] });
  pack.add(R, { id: 'hv-stall-cloth', name: 'Market stall (cloth)', category: 'Market', frames: [stall([P.a1, P.g0], 'cloth')] });
  pack.add(R, { id: 'hv-stall-pots', name: 'Market stall (pottery)', category: 'Market', frames: [stall([P.a4, P.out], 'pots')] });
  pack.add(R, { id: 'hv-well', name: 'Well', category: 'Town square', frames: [well()] });
  pack.add(R, { id: 'hv-notice-board', name: 'Notice board', category: 'Signs', frames: [noticeBoard()] });
  pack.add(R, { id: 'hv-cart', name: 'Hay cart', category: 'Town square', frames: [cart()] });
  pack.add(R, { id: 'hv-lamppost', name: 'Lamppost (lit)', category: 'Lampposts', frames: [0, 1, 2, 3].map(f => lamppost(f, true)), duration: 180, tags: ['animated'] });
  pack.add(R, { id: 'hv-lamppost-unlit', name: 'Lamppost (unlit)', category: 'Lampposts', frames: [lamppost(0, false)] });
  pack.add(R, { id: 'hv-signpost', name: 'Signpost', category: 'Signs', frames: [signpost()] });
  pack.add(R, a => ({ id: 'hv-tree', name: 'Town tree', category: 'Greenery', frames: [A.sapling({ leaf: { o: P.g0, c: [P.g0, P.g1, P.g2, P.g3, P.g4] }, bark: { o: P.t0, d: P.t0, m: P.t1, l: P.t2 }, shadow: P.g1 }, 12 + a)] }));
  pack.newRow(R);
  pack.add(R, { id: 'hv-crate', name: 'Crate', category: 'Storage', frames: [crate('x')] });
  pack.add(R, { id: 'hv-crate-slats', name: 'Slatted crate', category: 'Storage', frames: [crate('slats')] });
  pack.add(R, { id: 'hv-barrel', name: 'Barrel', category: 'Storage', frames: [barrel(false)] });
  pack.add(R, { id: 'hv-barrel-apples', name: 'Barrel of apples', category: 'Storage', frames: [barrel(true)] });
  pack.add(R, { id: 'hv-sacks', name: 'Grain sacks', category: 'Storage', frames: [sacks()] });
  pack.add(R, { id: 'hv-hay', name: 'Hay bale', category: 'Storage', frames: [hay()] });
  pack.add(R, { id: 'hv-hanging-sign', name: 'Hanging sign', category: 'Signs', frames: [hangingSign()], tags: ['overlay'] });
  pack.add(R, { id: 'hv-planter', name: 'Flower planter', category: 'Greenery', frames: [planter()] });
  pack.add(R, a => ({ id: 'hv-shrub', name: 'Shrub', category: 'Greenery', frames: [A.bush({ leaf: { o: P.g0, c: [P.g0, P.g1, P.g2, P.g3, P.g4] }, shadow: P.g1 }, 33 + a)] }));
  pack.add(R, { id: 'hv-bench', name: 'Bench', category: 'Town square', frames: [bench()] });
  K.addEdgeSet(pack, { sheet: R, id: 'picket', name: 'Picket fence', category: 'Fences', painter: picket, order: 9, color: '#e9dcbc' });

  sampleMap(pack);
  return pack;
}

function house(mb, x, y, w, mat, roof, opt = {}) {
  const col = i => i === 0 ? 'left' : i === w - 1 ? 'right' : 'mid';
  for (let i = 0; i < w; i++) {
    mb.set('Buildings', x + i, y, `hv-roof-${roof}-ridge-${col(i)}`);
    mb.set('Buildings', x + i, y + 1, `hv-roof-${roof}-body-${col(i)}`);
    mb.set('Buildings', x + i, y + 2, `hv-roof-${roof}-eave-${col(i)}`);
    mb.set('Buildings', x + i, y + 3, `hv-wall-${mat}-upper-${col(i)}`);
    mb.set('Buildings', x + i, y + 4, `hv-wall-${mat}-lower-${col(i)}`);
  }
  if (opt.chimney !== undefined) mb.stamp('Details', 'hv-chimney', x + opt.chimney, y);
  (opt.windows || []).forEach(([i, k]) => mb.stamp('Details', `hv-window-${k}`, x + i, y + 3));
  if (opt.door !== undefined) mb.stamp('Details', opt.doorKind || 'hv-door-wood', x + opt.door, y + 3);
}
function sampleMap(pack) {
  const W = 34, H = 24;
  const mb = new K.MapBuilder(pack, 'hearthvale-sample', 'Hearthvale square', W, H);
  const grass = pack.extra.ground[0].assets;
  mb.fill('Ground', (x, y) => K.pickGround(pack.extra.ground[0], x, y));
  const G = K.grids;
  const plaza = G.rect(G.blank(W, H), W, 11, 9, 12, 8);
  const cob = G.blank(W, H);
  G.path(cob, W, [[0, 12], [13, 12]], 2); G.path(cob, W, [[20, 12], [33, 12]], 2); G.path(cob, W, [[16, 15], [16, 23]], 2); G.path(cob, W, [[16, 0], [16, 11]], 2);
  G.path(cob, W, [[5, 8], [5, 12]], 1); G.path(cob, W, [[27, 8], [27, 12]], 1);
  mb.terrain('Paths', 'cobble', cob);
  mb.terrain('Plaza', 'plaza', plaza);
  mb.layer('Buildings'); mb.layer('Details');
  house(mb, 2, 3, 6, 'plaster', 'clay', { chimney: 4, windows: [[1, 'shutters'], [4, 'flowers']], door: 3 });
  house(mb, 24, 3, 6, 'stone', 'slate', { chimney: 1, windows: [[1, 'plain-lit'], [4, 'round']], door: 3, doorKind: 'hv-door-arched' });
  house(mb, 25, 17, 5, 'planks', 'thatch', { windows: [[0, 'plain'], [4, 'flowers']], door: 2, doorKind: 'hv-door-green' });
  const O = (id, x, y) => mb.stamp('Props', id, x, y);
  O('hv-well', 16, 11); O('hv-stall-fruit', 11, 9); O('hv-stall-cloth', 20, 9); O('hv-stall-pots', 12, 14);
  O('hv-lamppost', 11, 15); O('hv-lamppost', 22, 15); O('hv-lamppost', 8, 10); O('hv-lamppost-unlit', 25, 10);
  O('hv-notice-board', 19, 14); O('hv-cart', 2, 15); O('hv-signpost', 9, 17);
  O('hv-crate', 1, 9); O('hv-crate-slats', 1, 10); O('hv-barrel', 8, 6); O('hv-barrel-apples', 9, 7); O('hv-sacks', 30, 9); O('hv-hay', 6, 16);
  O('hv-planter', 3, 8); O('hv-planter', 29, 8); O('hv-bench', 13, 18); O('hv-tree', 0, 1); O('hv-tree', 32, 1); O('hv-tree', 12, 2); O('hv-tree', 21, 1);
  O('hv-shrub', 10, 4); O('hv-shrub', 23, 7); O('hv-shrub', 31, 15);
  const fence = G.blank(W, H); for (let x = 1; x <= 9; x++) fence[21 * W + x] = 1; for (let y = 18; y <= 21; y++) fence[y * W + 1] = 1;
  mb.edges('Props', 'picket', fence);
  mb.stamp('Details', 'hv-hanging-sign', 7, 6);
  mb.done();
}

module.exports = { build, palette: P };
