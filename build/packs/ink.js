'use strict';
/* Ink Edition: strict two-colour kit. Ink id 1 = paper, 2 = ink; 0 = transparent. */
const { Raster, Palette, mulberry32, hash2, wobble, dither, mod } = require('../lib/raster.js');
const { Pack } = require('../lib/pack.js');
const TR = require('../lib/terrain.js');
const K = require('../lib/kit.js');
const FG = require('../lib/figure.js');
const CK = require('./characters.js');

const P = new Palette([['paper', '#f1e6cf'], ['ink', '#262137']]);
const W = P.paper, I = P.ink;
const PAT = {
  paper: () => false, ink: () => true,
  sparse: (x, y) => (mod(x, 4) === 0 && mod(y, 4) === 0) || (mod(x, 4) === 2 && mod(y, 4) === 2),
  dots: (x, y) => mod(x, 2) === 0 && mod(y, 2) === 0,
  half: (x, y) => mod(x + y, 2) === 0,
  dense: (x, y) => !(mod(x, 2) === 0 && mod(y, 2) === 0),
  hs: (x, y) => mod(y, 2) === 0, vs: (x, y) => mod(x, 2) === 0, diag: (x, y) => mod(x - y, 4) === 0
};
const fp = (name, x, y) => PAT[name](x, y) ? I : W;
const KEY = { o: I, w: W, '#': I, d: 'd' };
function art(w, h, ox, oy, rows) {
  const r = new Raster(w, h);
  rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const ch = row[i]; if (ch === '.' || ch === ' ') continue; const x = ox + i, y = oy + j; r.set(x, y, ch === 'd' ? fp('half', x, y) : KEY[ch]); } });
  return r;
}

/* ---------- world terrain ---------- */
const TICKS = (() => { const L = new Raster(16, 16); const rng = mulberry32(3); for (let i = 0; i < 2; i++) { const x = Math.floor(rng() * 16), y = Math.floor(rng() * 16); L.set(x, y, I); L.set(mod(x + 2, 16), y, I); L.set(mod(x + 1, 16), mod(y + 1, 16), I); } return L; })();
const ground = (x, y) => TICKS.get(mod(x, 16), mod(y, 16)) || W;
const wob = s => t => wobble(mod(t, 16), 16, 1, s);
const pathShape = TR.shape({ wobTop: wob(1), wobBottom: wob(2), wobLeft: wob(3), wobRight: wob(4), outer: 4, inner: 3 });
function pathPaint(x, y, q) {
  if (!q.inside(x, y)) return 0;
  const p = q.probe(x, y, 2);
  if (p.ring) return mod(x + y, 2) ? I : W;
  return hash2(mod(x, 16), mod(y, 16), 8) < 0.05 ? I : W;
}
const waterShape = TR.shape({ wobTop: wob(5), wobBottom: wob(6), wobLeft: wob(7), wobRight: wob(8), outer: 5, inner: 3 });
function waterPaint(x, y, q, f) {
  if (!q.inside(x, y)) return 0;
  const p = q.probe(x, y, 3);
  if (p.ring || p.up === 1) return I;
  if (p.min === 1 || p.up === 2) return W;
  const band = Math.floor(mod(y, 16) / 8), shift = f * 2 + (band ? 4 : 0);
  const u = mod(x + shift, 8), r = mod(y, 8);
  if (r === 4) return (u === 0 || u === 2) ? I : W;
  if (r === 3) return u === 1 ? I : W;
  return W;
}
function tree1(kind) {
  const r = new Raster(16, 32);
  if (kind === 'pine') {
    for (let k = 0; k < 4; k++) { const top = 4 + k * 5, hw = 2 + k * 1.6; r.poly([[8, top], [8 + hw + 1, top + 7], [8 - hw - 1, top + 7]], W); }
    r.outline(I);
    for (let k = 1; k < 4; k++) { const y = 4 + k * 5 + 6; for (let x = 3; x < 13; x++) if (r.get(x, y) === W && mod(x, 2)) r.set(x, y, I); }
    for (let y = 8; y < 27; y++) for (let x = 9; x < 14; x++) if (r.get(x, y) === W && PAT.dots(x, y)) r.set(x, y, I);
    r.rect(7, 27, 2, 3, I);
  } else {
    r.disc(8, 12, 7, W); r.disc(4.5, 15, 4, W); r.disc(11.5, 15, 4, W);
    r.outline(I);
    for (const [x, y] of [[5, 8], [9, 7], [7, 12], [11, 11], [4, 14], [9, 16]]) { r.set(x, y, I); r.set(x + 1, y + 1, I); r.set(x + 2, y, I); }
    for (let y = 9; y < 21; y++) for (let x = 9; x < 16; x++) if (r.get(x, y) === W && PAT.half(x, y) && (x - 8) + (y - 12) > 4) r.set(x, y, I);
    r.rect(7, 21, 3, 7, W); r.vline(6, 21, 27, I); r.vline(10, 21, 27, I); r.vline(9, 22, 27, I);
    r.hline(4, 12, 28, I);
    for (let x = 3; x < 14; x++) if (mod(x, 2)) r.set(x, 29, I);
  }
  return r;
}
function bigTree() {
  const r = new Raster(32, 32);
  for (const [cx, cy, rad] of [[16, 11, 9], [8, 15, 6], [24, 15, 6], [16, 18, 7]]) r.disc(cx, cy, rad, W);
  r.outline(I);
  const rng = mulberry32(5);
  for (let k = 0; k < 14; k++) { const x = 5 + Math.floor(rng() * 22), y = 4 + Math.floor(rng() * 16); if (r.get(x, y) === W && r.get(x + 2, y) === W) { r.set(x, y, I); r.set(x + 1, y + 1, I); r.set(x + 2, y, I); } }
  for (let y = 0; y < 26; y++) for (let x = 0; x < 32; x++) if (r.get(x, y) === W && (x - 16) * 0.6 + (y - 12) > 7 && PAT.half(x, y)) r.set(x, y, I);
  r.rect(14, 23, 4, 6, W); r.vline(13, 23, 28, I); r.vline(18, 23, 28, I); r.vline(17, 24, 28, I);
  r.hline(9, 22, 29, I); for (let x = 8; x < 24; x += 2) r.set(x, 30, I);
  return r;
}
function bush1(dots) {
  const r = new Raster(16, 16);
  r.disc(8, 9, 5.5, W); r.disc(4.5, 10.5, 3.5, W); r.disc(11.5, 10.5, 3.5, W);
  r.outline(I);
  for (const [x, y] of [[6, 7], [9, 9], [5, 11]]) { r.set(x, y, I); r.set(x + 1, y + 1, I); }
  if (dots) for (const [x, y] of [[8, 6], [11, 9], [4, 9], [9, 12]]) { r.set(x, y, I); r.set(x + 1, y, I); r.set(x, y + 1, I); r.set(x + 1, y + 1, I); }
  for (let x = 2; x < 15; x += 2) r.set(x, 15, I);
  return r;
}
function rock1(big) {
  const r = new Raster(big ? 32 : 16, big ? 32 : 16);
  const cx = big ? 16 : 8, cy = big ? 18 : 9, rx = big ? 12 : 6, ry = big ? 9 : 4.5;
  r.ellipse(cx, cy, rx, ry, W); r.rect(cx - rx + 1, cy, rx * 2 - 2, ry, W);
  r.outline(I);
  r.line(cx - 2, cy - ry + 2, cx, cy, I); r.line(cx, cy, cx - 1, cy + 2, I);
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) if (r.get(x, y) === W && (x - cx) / rx + (y - cy) / ry > 0.7 && PAT.half(x, y)) r.set(x, y, I);
  return r;
}
function flowers1(kind) {
  const r = new Raster(16, 16);
  const spots = kind === 'a' ? [[4, 5], [11, 6], [7, 11]] : [[5, 9], [10, 4], [12, 11], [3, 13]];
  for (const [x, y] of spots) {
    r.set(x, y - 1, I); r.set(x - 1, y, I); r.set(x + 1, y, I); r.set(x, y + 1, I); r.set(x, y, W);
    r.vline(x, y + 2, y + 3, I);
  }
  return r;
}
function tallGrass1(f) {
  const r = new Raster(16, 16);
  const sway = [0, 1, 0, -1][f];
  for (let i = 0; i < 7; i++) {
    const x = 2 + i * 2, h = 5 + (i * 5) % 4;
    for (let k = 0; k < h; k++) r.set(x + Math.round((k / h) * (k / h) * (sway + (i % 2 ? 1 : -1))), 14 - k, I);
  }
  return r;
}
function fence1(x, y, m) {
  if (x >= 6 && x <= 9 && y >= 3 && y <= 12) return (x === 6 || x === 9 || y === 3 || y === 12) ? I : W;
  if ((((m & 2) && x > 9) || ((m & 8) && x < 6)) && (y === 5 || y === 9)) return I;
  if ((((m & 2) && x > 9) || ((m & 8) && x < 6)) && (y === 6 || y === 10)) return W;
  if ((((m & 2) && x > 9) || ((m & 8) && x < 6)) && (y === 7 || y === 11)) return I;
  if (((m & 1) && y < 3) || ((m & 4) && y > 12)) { if (x === 7 || x === 8) return W; if (x === 6 || x === 9) return I; }
  return 0;
}

/* ---------- dungeon ---------- */
const wallShape = TR.shape({ top: 0, bottom: 0, left: 0, right: 0, outer: 0, inner: 0 });
function wallPaint(x, y, q) {
  const cx = Math.floor(x / 16), cy = Math.floor(y / 16);
  if (!q.occ(cx, cy)) return 0;
  const lx = mod(x, 16), ly = mod(y, 16);
  const o = (dx, dy) => q.occ(cx + dx, cy + dy);
  const N = o(0, -1), E = o(1, 0), Wt = o(-1, 0);
  if ((lx === 0 && !Wt) || (lx === 15 && !E)) return I;
  if (!o(0, 1)) {
    if (ly === 0 && !N) return I;
    if (ly < 3) return ly === 2 ? I : (mod(x - y, 4) === 0 ? I : W);
    if (ly === 15) return I;
    const row = Math.floor((ly - 3) / 4), off = mod(row, 2) * 4;
    if (mod(ly - 3, 4) === 3 || mod(lx + off, 8) === 7) return I;
    return W;
  }
  if (ly === 0 && !N) return I;
  const SE = o(1, 1), SW = o(-1, 1), NE = o(1, -1), NW = o(-1, -1);
  if (E && !SE && lx === 15 && ly >= 3) return I;
  if (Wt && !SW && lx === 0 && ly >= 3) return I;
  if (N && E && !NE && lx === 15 && ly === 0) return I;
  if (N && Wt && !NW && lx === 0 && ly === 0) return I;
  if ((lx === 1 && !Wt) || (ly === 1 && !N) || (lx === 14 && !E)) return W;
  return mod(x - y, 4) === 0 ? I : W;
}
function floorTile(kind) {
  const r = Raster.from(16, 16, (x, y) => ((mod(x, 8) === 0 || mod(y, 8) === 0) && mod(x + y, 2) === 0) ? I : W);
  if (kind === 'cracked') { r.line(3, 3, 6, 6, I); r.line(6, 6, 5, 7, I); r.line(11, 10, 13, 12, I); }
  if (kind === 'rubble') for (const [x, y] of [[4, 4], [11, 5], [6, 11], [12, 12]]) { r.set(x, y, I); r.set(x + 1, y, I); r.set(x, y + 1, I); }
  return r;
}
function door1(open) {
  const r = new Raster(16, 16);
  for (let y = 3; y < 16; y++) for (let x = 3; x <= 12; x++) { if (y === 3 && (x === 3 || x === 12)) continue; r.set(x, y, (x === 3 || x === 12 || y === 3) ? I : open ? (PAT.dense(x, y) ? I : W) : (mod(x - 4, 3) === 2 ? I : W)); }
  if (!open) { r.hline(4, 11, 7, I); r.hline(4, 11, 12, I); r.set(10, 10, I); }
  r.hline(2, 13, 2, I); r.set(2, 3, I); r.set(13, 3, I);
  return r;
}
function stairs1(down) {
  const r = Raster.from(16, 16, () => W);
  for (let k = 0; k < 5; k++) { const y = 2 + k * 3; r.hline(1 + (down ? k : 0), 14 - (down ? k : 0), y, I); if (down && k > 1) for (let x = 2 + k; x < 14 - k; x++) if (PAT.half(x, y + 1)) r.set(x, y + 1, I); }
  r.vline(0, 0, 15, I); r.vline(15, 0, 15, I);
  return r;
}
function chest1(f) {
  const r = new Raster(16, 16);
  r.rect(2, 9, 12, 6, W); r.box(2, 9, 12, 6, I); r.vline(5, 9, 14, I); r.vline(10, 9, 14, I);
  const lift = [0, 1, 3, 5][f];
  if (!lift) { r.rect(2, 5, 12, 4, W); r.box(2, 5, 12, 5, I); r.hline(3, 12, 4, I); r.rect(7, 8, 2, 2, I); }
  else {
    r.rect(3, 10, 10, 1, I);
    const top = 9 - lift - 3; r.rect(2, top, 12, 3, W); r.box(2, top, 12, 3, I);
    if (f === 3) { r.set(6, 9, W); r.set(9, 9, W); r.set(7, top - 2, I); r.set(8, top - 3, I); r.set(9, top - 2, I); }
  }
  return r;
}
function torch1(f) {
  const r = new Raster(16, 16);
  r.rect(7, 9, 2, 5, I); r.hline(5, 10, 13, I);
  const h = [5, 6, 5, 4][f], sx = [0, 1, 0, -1][f];
  for (let j = 0; j < h; j++) { const hw = Math.round((h - j) / 2.2); for (let x = 8 - hw + (j > 2 ? sx : 0); x <= 8 + hw - 1 + (j > 2 ? sx : 0); x++) r.set(x, 8 - j, j < 2 ? W : I); }
  r.set(7, 8, I); r.set(8, 8, I);
  return r;
}
function spikes1(f) {
  const r = floorTile('plain');
  const len = [0, 1, 4, 2][f];
  for (const hx of [3, 7, 11]) for (const hy of [6, 12]) { r.set(hx, hy, I); r.set(hx + 1, hy, I); for (let k = 1; k <= len; k++) { r.set(hx, hy - k, I); if (k < len) r.set(hx + 1, hy - k, I); } }
  return r;
}
function pillar1() {
  const r = new Raster(16, 32);
  r.rect(4, 4, 8, 24, W); r.box(4, 4, 8, 24, I); r.rect(3, 3, 10, 3, W); r.box(3, 3, 10, 3, I); r.rect(3, 26, 10, 3, W); r.box(3, 26, 10, 3, I);
  for (let y = 7; y < 26; y++) { if (PAT.half(9, y)) r.set(9, y, I); r.set(10, y, I); }
  return r;
}
function plate1(down) {
  const r = floorTile('plain');
  r.rect(3, 3, 10, 10, W); r.box(3, 3, 10, 10, I);
  if (!down) { r.hline(4, 11, 11, I); r.vline(11, 4, 11, I); } else for (let y = 4; y < 12; y++) for (let x = 4; x < 12; x++) if (PAT.dots(x, y)) r.set(x, y, I);
  return r;
}

/* ---------- town ---------- */
function plankWall(row, col) {
  const r = Raster.from(16, 16, (x, y) => { const wy = row === 'upper' ? y : y + 16; if (wy === 0 || wy === 31) return I; if (wy >= 29) return PAT.half(x, wy) ? I : W; return mod(wy, 4) === 3 ? I : W; });
  if (col === 'left') r.vline(0, 0, 15, I), r.vline(1, 0, 15, I);
  if (col === 'right') r.vline(15, 0, 15, I), r.vline(14, 0, 15, I);
  return r;
}
function roof1(row, col) {
  const r = Raster.from(16, 16, (x, y) => {
    const ry = row === 'ridge' ? y : row === 'body' ? y + 16 : y + 32;
    if (row === 'ridge' && y <= 2) return y === 1 ? W : I;
    if (row === 'eave' && y >= 13) return y === 14 ? W : I;
    const off = mod(Math.floor(ry / 3), 2) * 2;
    if (mod(ry, 3) === 2) return I;
    return mod(x + off, 4) === 3 ? I : W;
  });
  if (col === 'left') r.vline(0, 0, 15, I);
  if (col === 'right') r.vline(15, 0, 15, I);
  return r;
}
function window1(shutters) {
  const r = new Raster(16, 16);
  r.rect(4, 3, 8, 9, W); r.box(4, 3, 8, 9, I); r.hline(4, 11, 7, I); r.vline(7, 3, 11, I);
  for (const [x, y] of [[5, 4], [5, 5], [8, 4]]) r.set(x, y, I);
  r.hline(3, 12, 12, I); r.hline(3, 12, 13, I);
  if (shutters) for (const sx of [1, 12]) { r.rect(sx, 3, 3, 9, W); r.box(sx, 3, 3, 9, I); r.set(sx + 1, 7, I); }
  return r;
}
function townDoor() {
  const r = new Raster(16, 32);
  r.rect(3, 11, 10, 19, W); r.box(3, 11, 10, 19, I); r.hline(4, 11, 10, I); r.hline(5, 10, 9, I);
  for (let x = 5; x < 12; x += 2) r.vline(x, 12, 28, I);
  r.set(10, 20, W); r.hline(2, 13, 30, I); r.hline(2, 13, 31, I);
  return r;
}
function chimney1() { const r = new Raster(16, 16); r.rect(5, 3, 6, 11, W); r.box(5, 3, 6, 11, I); r.hline(4, 11, 2, I); r.hline(4, 11, 3, I); for (let y = 6; y < 13; y += 3) r.hline(6, 9, y, I); return r; }
function stall1() {
  const r = new Raster(32, 32);
  for (let y = 3; y <= 9; y++) for (let x = 1; x <= 30; x++) r.set(x, y, mod(Math.floor((x - 1) / 4), 2) ? I : W);
  r.hline(1, 30, 2, I); r.hline(1, 30, 10, I);
  r.vline(3, 10, 27, I); r.vline(28, 10, 27, I);
  r.rect(2, 18, 28, 9, W); r.box(2, 18, 28, 9, I); for (let x = 7; x < 28; x += 6) r.vline(x, 19, 25, I);
  for (let k = 0; k < 6; k++) r.disc(6 + k * 4, 16, 1.5, k % 2 ? I : W), r.ring(6 + k * 4, 16, 2, I);
  return r;
}
function well1() {
  const r = new Raster(32, 32);
  r.ellipse(16, 22, 11, 6, W); r.ring(16, 22, 11, I); r.ellipse(16, 22, 11, 6, W);
  r.outline(I); r.ellipse(16, 21, 8, 3.5, I); r.ellipse(15, 20.5, 4, 1.5, W);
  for (let y = 23; y < 29; y++) for (let x = 5; x < 28; x++) if (r.get(x, y) === W && (mod(x, 6) === 0 || y === 25)) r.set(x, y, I);
  r.vline(6, 4, 20, I); r.vline(7, 4, 20, I); r.vline(25, 4, 20, I); r.vline(26, 4, 20, I);
  r.poly([[3, 6], [16, 1], [29, 6]], W); r.hline(3, 29, 6, I); r.line(3, 6, 16, 1, I); r.line(16, 1, 29, 6, I);
  r.hline(8, 24, 9, I); r.rect(15, 10, 2, 4, I);
  return r;
}
function lamp1(f) {
  const r = new Raster(16, 32);
  r.rect(7, 10, 2, 19, I); r.hline(5, 10, 29, I); r.hline(4, 11, 30, I);
  r.rect(4, 3, 8, 7, I); r.rect(5, 4, 6, 5, W);
  if (f === 1) { r.set(7, 6, I); r.set(8, 6, I); } else { r.set(7, 5, I); r.set(8, 7, I); }
  r.hline(3, 12, 2, I); r.set(7, 1, I); r.set(8, 1, I);
  return r;
}
function crate1() { const r = new Raster(16, 16); r.rect(2, 4, 12, 11, W); r.box(2, 4, 12, 11, I); r.box(3, 5, 10, 9, I); r.line(3, 5, 12, 13, I); r.line(12, 5, 3, 13, I); return r; }
function barrel1() { const r = new Raster(16, 16); r.ellipse(8, 9, 5, 6, W); r.rect(3, 5, 10, 9, W); r.outline(I); r.ellipse(8, 4, 5, 1.6, W); r.hline(4, 11, 3, I); r.hline(3, 12, 6, I); r.hline(3, 12, 12, I); for (let y = 7; y < 12; y++) if (PAT.half(11, y)) r.set(11, y, I); r.outline(I); return r; }
function sign1() { const r = new Raster(16, 32); r.rect(7, 8, 2, 21, I); r.poly([[1, 8], [12, 8], [15, 11], [12, 14], [1, 14]], W); r.outline(I); r.hline(3, 11, 11, W); r.hline(2, 13, 29, I); return r; }
function bench1() { const r = new Raster(32, 16); r.rect(2, 5, 28, 3, W); r.box(2, 5, 28, 3, I); r.rect(2, 9, 28, 3, W); r.box(2, 9, 28, 3, I); for (const x of [4, 26]) r.rect(x, 12, 2, 3, I); return r; }

/* ---------- items ---------- */
const ITEMS = {
  key: ['.oooo.......', 'owwwwo......', 'owoowo......', 'owwwwoooooo.', '.oooowwwwwwo', '.....oowowoo', '......o.o...'],
  coin: ['...oooooo...', '..owwwwwwo..', '.owwoooowwo.', '.owowwwwowo.', '.owowwwwowo.', '.owowwwwowo.', '.owowwwwowo.', '.owwoooowwo.', '..owwwwwwo..', '...oooooo...'],
  gem: ['...oooooo...', '..owwowwwo..', '.owwowwwwwo.', 'oooooooooooo', '.owwwowwwwo.', '..owwowwwo..', '...owwowo...', '....owwo....', '.....oo.....'],
  flask: ['....oooo....', '....owwo....', '...oooooo...', '....owwo....', '...owwwwo...', '..owwwwwwo..', '.owwwwwwwwo.', '.oddddddddo.', '.oddddddddo.', '.oddddddddo.', '..oddddddo..', '...oooooo...'],
  scroll: ['.oooooooooo.', 'owwwwwwwwwwo', 'oowwwwwwwwoo', '.owoooooowo.', '.owwwwwwwwo.', '.owoooooowo.', '.owwwwwwwwo.', '.owooooowwo.', 'oowwwwwwwwoo', 'owwwwwwwwwwo', '.oooooooooo.'],
  apple: ['......o.....', '.....o......', '...oo.oo....', '..owwowwo...', '.owwwwwwwo..', '.owwwwwwwo..', '.owwwwwwdo..', '.owwwwwddo..', '..owwwddo...', '...ooooo....'],
  bread: ['............', '...oooooo...', '..owwwwwwo..', '.owwowwowwo.', '.owwwwwwwwo.', '.oddddddddo.', '..oooooooo..'],
  mushroom: ['...oooooo...', '..owwwwwwo..', '.owwoowwwwo.', '.owwoowwoowo', '.owwwwwwoowo', '.oooooooooo.', '....owwo....', '....owwo....', '....owdo....', '....oooo....'],
  feather: ['..........oo', '........oowo', '.......owwo.', '......owwo..', '.....owwoo..', '....owwo....', '...owwoo....', '..owwo......', '..oo........', '.o..........'],
  lantern: ['.....oo.....', '....o..o....', '...oooooo...', '...owwwwo...', '..oowddwoo..', '..owddddwo..', '..owddddwo..', '..oowddwoo..', '...owwwwo...', '...oooooo...'],
  book: ['.oooooooooo.', '.owwwwwwwwo.', '.owoooooowo.', '.owwwwwwwwo.', '.owwwwwwwwo.', '.owwwwwwwwo.', '.oddddddddo.', '.oooooooooo.'],
  shield: ['.oooooooooo.', '.owwwwwwwwo.', '.owwwoowwwo.', '.owwoddowwo.', '.owwoddowwo.', '.owwwoowwwo.', '..owwwwwwo..', '...owwwwo...', '....oooo....'],
  pouch: ['....oooo....', '...owwwwo...', '....oooo....', '...owwwwo...', '..owwwwwwo..', '.owwwwwwwwo.', '.owwwwwwwwo.', '.owwwwwwwdo.', '..owwwwwdo..', '...oooooo...'],
  ring: ['....oooo....', '...owddwo...', '....oooo....', '...oooooo...', '..oo....oo..', '..o......o..', '..o......o..', '..oo....oo..', '...oooooo...'],
  crystal: ['.....o......', '....owo.....', '....owoo....', '...owwowo...', '...owwowo...', '..owwwowwo..', '..owwwowwo..', '..owwwowwo..', '...owwowo...', '....oooo....'],
  herb: ['.......oo...', '......owwo..', '..oo..owwo..', '.owwo.oowo..', '.owwoo.o....', '..oowo.o....', '....oo.o....', '......oo....', '......o.....'],
  fish: ['............', '....oooo....', '..oowwwwoo.o', '.owowwwwwwoo', '.owwwwwwwwwo', '.owwwwwwwdoo', '..oowwwdoo.o', '....oooo....'],
  candle: ['.....o......', '....owo.....', '....oo......', '...oooo.....', '...owwo.....', '...owwo.....', '...owwo.....', '...owwo.....', '.oooooooo...', '.owwwwwwo...', '.oooooooo...'],
  bell: ['.....oo.....', '....owwo....', '...owwwwo...', '...owwwwo...', '..owwwwwwo..', '..owwwwwwo..', '.owwwwwwwwo.', '.oooooooooo.', '.....oo.....'],
  map: ['oooooooooooo', 'owwwowwwowwo', 'owdwowwwowwo', 'owwdowwwowwo', 'owwwodwwowwo', 'owwwowdwowwo', 'owwwowwdowwo', 'owwwowwwodwo', 'oooooooooooo'],
  hourglass: ['.oooooooooo.', '..owwwwwwo..', '..oddddddo..', '...oddddo...', '....oddo....', '....owwo....', '...owddwo...', '..owddddwo..', '..oddddddo..', '.oooooooooo.'],
  mug: ['............', '..oooooooo..', '..owwwwwwooo', '..owwwwwwo.o', '..owwwwwwo.o', '..owwwwwwooo', '..owwwwwwo..', '..oooooooo..']
};

/* ---------- interface ---------- */
function uiPanel(title) {
  const r = Raster.from(48, 48, (x, y) => {
    const e = Math.min(x, y, 47 - x, 47 - y);
    if (e === 0) return (x === 0 || x === 47) && (y === 0 || y === 47) ? 0 : I;
    if (e === 1) return W; if (e === 2) return I; if (e === 3) return W;
    if (title && y >= 4 && y <= 11) return y === 11 ? I : (PAT.half(x, y) ? I : W);
    return W;
  });
  return r;
}
function uiButton(state) {
  const r = new Raster(48, 16);
  const top = state === 'pressed' ? 1 : 0;
  for (let y = top; y < 16; y++) for (let x = 0; x < 48; x++) {
    const edge = x === 0 || x === 47 || y === top || y === 15;
    if (edge) { if ((x === 0 || x === 47) && (y === top || y === 15)) continue; r.set(x, y, I); continue; }
    if (state !== 'pressed' && y >= 13) { r.set(x, y, I); continue; }
    r.set(x, y, state === 'hover' ? (PAT.sparse(x, y) ? I : W) : state === 'pressed' ? (PAT.half(x, y) ? I : W) : W);
  }
  return r;
}
function uiSlot(state) {
  const r = Raster.from(32, 32, (x, y) => {
    const e = Math.min(x, y, 31 - x, 31 - y);
    if (e === 0) return I;
    if (e === 1) return state === 'selected' ? I : (x === 1 || y === 1 ? I : W);
    if (e === 2 && state !== 'normal') return state === 'hover' ? (PAT.half(x, y) ? I : W) : W;
    return W;
  });
  if (state === 'selected') for (const [x, y] of [[3, 3], [28, 3], [3, 28], [28, 28]]) r.set(x, y, I);
  return r;
}
function uiBar(fill) {
  const r = new Raster(48, 16);
  if (!fill) { for (let y = 3; y <= 12; y++) for (let x = 0; x < 48; x++) { const e = x === 0 || x === 47 || y === 3 || y === 12; if (e && (x === 0 || x === 47) && (y === 3 || y === 12)) continue; r.set(x, y, e ? I : W); } return r; }
  for (let y = 5; y <= 10; y++) for (let x = 2; x <= 45; x++) r.set(x, y, y === 5 ? W : PAT.dense(x, y) ? I : W);
  return r;
}
function uiDialogue() { return Raster.from(48, 48, (x, y) => { const e = Math.min(x, y, 47 - x, 47 - y); if (e === 0) return (x === 0 || x === 47) && (y === 0 || y === 47) ? 0 : I; if (e === 1) return I; if (e === 2) return W; if (e === 3) return mod(x + y, 2) ? I : W; return W; }); }
function uiCheck(on) { const r = new Raster(16, 16); r.rect(3, 3, 10, 10, W); r.box(3, 3, 10, 10, I); if (on) { r.line(5, 8, 7, 10, I); r.line(7, 10, 11, 5, I); r.line(5, 7, 7, 9, I); } return r; }

/* ---------- effects ---------- */
function fxSparkle(f) { const r = new Raster(16, 16); const s = [1, 2, 3, 2][f]; r.set(7, 7, W); for (let k = 1; k <= s; k++) { r.set(7 + k, 7, I); r.set(7 - k, 7, I); r.set(7, 7 + k, I); r.set(7, 7 - k, I); } if (f === 2) { r.set(12, 3, I); r.set(3, 12, I); } r.set(7, 7, I); if (s > 1) { r.set(6, 6, 0); } return r; }
function fxDust(f) { const r = new Raster(32, 16); const t = f / 4; for (const d of [-1, 1]) { const cx = 16 + d * (3 + t * 8), cy = 11 - t * 3, rad = 2 + t * 2.5 * (1 - t * 0.6); r.disc(cx, cy, rad, W); r.ring(cx, cy, rad + 0.6, I, 1); if (t > 0.5) for (let y = 0; y < 16; y++) for (let x = 0; x < 32; x++) if (r.get(x, y) && dither(x, y, (t - 0.5) * 2.2)) r.set(x, y, 0); } return r; }
function fxSmoke(f) { const r = new Raster(16, 32); for (let k = 0; k < 3; k++) { const ph = ((f + k * 2.67) % 8) / 8, cy = 28 - ph * 24, cx = 8 + Math.sin(ph * 6 + k) * 1.5, rad = 1.5 + ph * 3; if (ph > 0.8) continue; r.disc(cx, cy, rad, W); r.ring(cx, cy, rad + 0.6, I, 1); } return r; }
function fxSplash(f) { const r = new Raster(32, 32); const t = f / 4; const rng = mulberry32(4); for (let i = 0; i < 8; i++) { const vx = (rng() - 0.5) * 20, vy = -(12 + rng() * 10); const x = 16 + vx * t, y = 26 + vy * t + 30 * t * t; if (y < 28) { r.set(Math.round(x), Math.round(y), I); r.set(Math.round(x), Math.round(y) + 1, I); } } const rx = 3 + t * 11; for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; if (t > 0.5 && i % 2) continue; r.set(Math.round(16 + Math.cos(a) * rx), Math.round(27 + Math.sin(a) * rx * 0.3), I); } if (f === 4) { r.d.fill(0); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; r.set(Math.round(16 + Math.cos(a) * 14), Math.round(27 + Math.sin(a) * 4), I); } } return r; }
function fxBurst(f) { const r = new Raster(32, 32); const L = [4, 11, 14, 13][f], s = [0, 3, 7, 11][f]; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; for (let d = s; d <= L; d++) { if (f === 3 && d % 2) continue; r.set(Math.round(15.5 + Math.cos(a) * d), Math.round(15.5 + Math.sin(a) * d), I); } } if (f === 0) { r.disc(16, 16, 3, I); r.disc(16, 16, 1.5, W); } if (f === 1) { r.disc(16, 16, 4, I); r.disc(16, 16, 2.5, W); } return r; }
function fxSwirl(f) { const r = new Raster(32, 32); for (let i = 0; i < 3; i++) for (let tr = 5; tr >= 0; tr--) { const a = (f - tr * 0.3) / 8 * Math.PI * 2 + i * Math.PI * 2 / 3; const x = Math.round(15.5 + Math.cos(a) * 10), y = Math.round(15.5 + Math.sin(a) * 6.5); r.set(x, y, I); if (tr === 0) { r.set(x + 1, y, I); r.set(x - 1, y, I); r.set(x, y - 1, I); r.set(x, y + 1, I); r.set(x, y, W); } } return r; }
function fxGlint(f) { const r = new Raster(16, 32); const t = f / 4; const h = Math.round(4 + t * 20); if (f < 4) for (let y = 30 - h; y < 30; y++) r.set(7 + (y % 2), y, I); for (let i = 0; i < 4; i++) { const y = Math.round(26 - t * (14 + i * 3)); const x = 3 + i * 3; if (y > 1 && (i + f) % 2 === 0) { r.set(x, y, I); r.set(x - 1, y, I); r.set(x + 1, y, I); r.set(x, y - 1, I); r.set(x, y + 1, I); } } if (f === 4) { r.d.fill(0); r.set(4, 6, I); r.set(11, 9, I); } return r; }

/* ---------- characters: shared figure geometry, painted with 1-bit patterns ---------- */
const NAME_PATTERNS = {
  out: ['ink'], blush: ['paper'], metal1: ['paper'], metal2: ['dots'],
  cream: ['paper', 'paper', 'sparse'], slate: ['dots', 'half', 'dense'], red: ['hs', 'hs', 'dense'], green: ['sparse', 'dots', 'half'],
  blue: ['half', 'half', 'dense'], gold: ['paper', 'sparse', 'dots'], purple: ['dense', 'dense', 'ink'], leather: ['half', 'dense', 'ink'],
  hblack: ['dense', 'ink', 'ink'], hbrown: ['half', 'dense', 'ink'], hauburn: ['dots', 'half', 'dense'], hblonde: ['paper', 'paper', 'sparse'], hsilver: ['paper', 'sparse', 'dots'], hteal: ['sparse', 'dots', 'half']
};
function patternFor(name) {
  if (NAME_PATTERNS[name]) return NAME_PATTERNS[name][0];
  const base = name.slice(0, -1), idx = 'abc'.indexOf(name.slice(-1));
  const p = NAME_PATTERNS[base];
  if (!p) return 'half';
  return p[Math.min(idx, p.length - 1)];
}
function convertLayer(frames, build) {
  const out = {};
  for (const dir of ['down', 'left', 'up']) {
    out[dir] = {};
    for (const anim of Object.keys(frames[dir])) out[dir][anim] = frames[dir][anim].map((r, f) => {
      const bob = FG.pose(anim, f).bob;
      const fig = FG.figure(dir, anim, f, build);
      const c = Raster.from(16, 32, (x, y) => { const v = r.get(x, y); if (!v) return 0; const name = CK.palette.entries[v - 1].name; return fp(patternFor(name), x, y < 23 ? y + bob : y); });
      /* 1-bit needs an ink edge wherever a garment, hair or accessory meets uncovered body */
      const edged = c.clone();
      c.each((x, y, v) => {
        if (!v) return;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const lab = fig.get(x + dx, y + dy);
          if (!c.get(x + dx, y + dy) && lab && lab !== FG.L.OUT) { edged.set(x, y, I); break; }
        }
      });
      return edged;
    });
  }
  out.right = {};
  for (const anim of Object.keys(out.left)) out.right[anim] = out.left[anim].map(r => r.flipX());
  return out;
}
const TONES = [['paper', ['paper', 'paper', 'sparse'], 'Paper'], ['stipple', ['sparse', 'dots', 'half'], 'Stipple'], ['shade', ['dots', 'half', 'dense'], 'Shade']];
function inkBody(build, tone) {
  const L = FG.L;
  return FG.layerFrames(build, (dir, fig, anim, f) => {
    const bob = FG.pose(anim, f).bob, dy = fig.dy;
    const pf = (name, x, y) => fp(name, x, y < 23 ? y + bob : y);
    const r = FG.paint(fig, (l, s, x, y) => {
      switch (l) {
        case L.OUT: return I;
        case L.EYE: return tone[0] === 'shade' ? W : I;
        case L.BLUSH: case L.HEAD: return pf(tone[1][Math.min(s, 1)], x, y);
        case L.HAND: case L.SHIN: return pf(tone[1][s], x, y);
        case L.FARHAND: return pf(tone[1][2], x, y);
        case L.ARM: return y <= 17 + dy ? W : pf(tone[1][s], x, y);
        case L.FARARM: return y <= 17 + dy ? pf('sparse', x, y) : pf(tone[1][2], x, y);
        case L.TORSO: return s === 2 ? pf('sparse', x, y) : W;
        case L.THIGH: return pf('half', x, y);
        case L.FARLEG: return y <= 24 + dy ? pf('dense', x, y) : pf(tone[1][2], x, y);
        case L.FOOT: case L.FARFOOT: return I;
      }
      return 0;
    });
    /* ink seams where parts of the same colour touch: chin over collar, near arm over torso */
    fig.lab.forEach((l, i) => {
      const x = i % 16, y = (i / 16) | 0;
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b2]) => fig.get(x + a, y + b2));
      if (l === L.TORSO && nb.includes(L.HEAD)) r.set(x, y, I);
      if ((l === L.ARM || l === L.HAND) && dir === 'left' && nb.includes(L.TORSO)) r.set(x, y, I);
    });
    return r;
  });
}

function build() {
  const pack = new Pack({ id: 'ink-edition', name: 'Ink Edition: 1-Bit World Kit', code: 'NK', palette: P });
  pack.sheet('world', { name: 'Ink world', cols: 16 });
  pack.sheet('water', { name: 'Ink water', cols: 16 });
  pack.sheet('dungeon', { name: 'Ink dungeon', cols: 16 });
  pack.sheet('town', { name: 'Ink town', cols: 16 });
  pack.sheet('items', { name: 'Ink items and interface', cols: 24 });
  pack.sheet('fx', { name: 'Ink effects', cols: 20 });
  for (const id of ['body', 'outfit', 'hair', 'accessory']) pack.sheet(id, { name: `Ink characters — ${id}`, cellW: 16, cellH: 32, cols: 24, tileset: false });

  /* world */
  const gr = [];
  const gv = [['plain', () => { }], ['flowers', r => { for (const [x, y] of [[5, 6], [10, 10]]) { r.set(x, y - 1, I); r.set(x - 1, y, I); r.set(x + 1, y, I); r.set(x, y + 1, I); } }], ['pebbles', r => { for (const [x, y] of [[5, 9], [10, 5], [11, 11]]) { r.set(x, y, I); r.set(x + 1, y, I); } }], ['tufts', r => { for (const [x, y] of [[4, 6], [9, 9], [6, 12]]) { r.set(x, y, I); r.set(x + 2, y, I); r.set(x + 1, y + 1, I); } }]];
  for (const [k, d] of gv) { const r = Raster.from(16, 16, ground); d(r); gr.push(pack.add('world', { id: `nk-ground-${k}`, name: `Ground (${k})`, category: 'Ground', frames: [r], meta: { ground: 'field' } }).id); }
  const fl = []; for (const k of ['plain', 'cracked', 'rubble']) fl.push(pack.add('world', { id: `nk-floor-${k}`, name: `Floor (${k})`, category: 'Ground', frames: [floorTile(k)], meta: { ground: 'floor' } }).id);
  const cob = pack.add('world', { id: 'nk-cobbles', name: 'Cobbles', category: 'Ground', frames: [Raster.from(16, 16, (x, y) => { const u = mod(x + (mod(Math.floor(y / 5), 2) ? 3 : 0), 6), v = mod(y, 5); return (u === 5 || v === 4) ? I : W; })], meta: { ground: 'cobble' } }).id;
  pack.extra.ground = [{ id: 'field', name: 'Field', assets: gr }, { id: 'floor', name: 'Dungeon floor', assets: fl }, { id: 'cobble', name: 'Cobbles', assets: [cob] }];
  K.addBlobSet(pack, { sheet: 'world', id: 'path', name: 'Path', category: 'Path (autotile)', shape: pathShape, painter: pathPaint, order: 1, color: '#f1e6cf' });
  K.addBlobSet(pack, { sheet: 'water', id: 'water', name: 'Water', category: 'Water (autotile)', shape: waterShape, painter: waterPaint, frames: 4, duration: 240, order: 2, color: '#262137', newRow: false });
  const Wd = 'world';
  pack.newRow(Wd);
  pack.add(Wd, { id: 'nk-tallgrass', name: 'Tall grass', category: 'Nature', frames: [0, 1, 2, 3].map(tallGrass1), duration: 200, tags: ['animated'] });
  pack.add(Wd, { id: 'nk-flowers-a', name: 'Flowers', category: 'Nature', frames: [flowers1('a')] });
  pack.add(Wd, { id: 'nk-flowers-b', name: 'Flowers (scattered)', category: 'Nature', frames: [flowers1('b')] });
  pack.add(Wd, { id: 'nk-bush', name: 'Bush', category: 'Nature', frames: [bush1(false)] });
  pack.add(Wd, { id: 'nk-bush-berries', name: 'Berry bush', category: 'Nature', frames: [bush1(true)] });
  pack.add(Wd, { id: 'nk-rock', name: 'Rock', category: 'Nature', frames: [rock1(false)] });
  K.addEdgeSet(pack, { sheet: Wd, id: 'fence', name: 'Fence', category: 'Fences', painter: fence1, order: 9, color: '#262137' });
  pack.newRow(Wd);
  pack.add(Wd, { id: 'nk-tree', name: 'Tree', category: 'Nature', frames: [tree1('round')] });
  pack.add(Wd, { id: 'nk-pine', name: 'Pine', category: 'Nature', frames: [tree1('pine')] });
  pack.add(Wd, { id: 'nk-tree-big', name: 'Great tree', category: 'Nature', frames: [bigTree()] });
  pack.add(Wd, { id: 'nk-boulder', name: 'Boulder', category: 'Nature', frames: [rock1(true)] });

  /* dungeon */
  const D = 'dungeon';
  K.addBlobSet(pack, { sheet: D, id: 'walls', name: 'Walls', category: 'Walls (autotile)', shape: wallShape, painter: wallPaint, order: 5, color: '#262137', newRow: false });
  pack.newRow(D);
  pack.add(D, { id: 'nk-door', name: 'Door', category: 'Dungeon', frames: [door1(false)], tags: ['wall overlay'] });
  pack.add(D, { id: 'nk-door-open', name: 'Doorway', category: 'Dungeon', frames: [door1(true)], tags: ['wall overlay'] });
  pack.add(D, { id: 'nk-stairs-down', name: 'Stairs down', category: 'Dungeon', frames: [stairs1(true)] });
  pack.add(D, { id: 'nk-stairs-up', name: 'Stairs up', category: 'Dungeon', frames: [stairs1(false)] });
  pack.add(D, { id: 'nk-chest', name: 'Chest (opening)', category: 'Dungeon', frames: [0, 1, 2, 3].map(chest1), durations: [700, 90, 90, 600], loop: false, tags: ['animated'] });
  pack.add(D, { id: 'nk-torch', name: 'Torch', category: 'Dungeon', frames: [0, 1, 2, 3].map(torch1), duration: 130, tags: ['animated', 'wall overlay'] });
  pack.add(D, { id: 'nk-spikes', name: 'Spike trap', category: 'Dungeon', frames: [0, 1, 2, 3].map(spikes1), durations: [700, 80, 600, 90], tags: ['animated'] });
  pack.add(D, { id: 'nk-plate-up', name: 'Pressure plate', category: 'Dungeon', frames: [plate1(false)] });
  pack.add(D, { id: 'nk-plate-down', name: 'Pressure plate (pressed)', category: 'Dungeon', frames: [plate1(true)] });
  pack.add(D, { id: 'nk-pillar', name: 'Pillar', category: 'Dungeon', frames: [pillar1()] });

  /* town */
  const T = 'town';
  for (const row of ['upper', 'lower']) for (const col of ['left', 'mid', 'right']) pack.add(T, { id: `nk-wall-${row}-${col}`, name: `House wall ${row} ${col}`, category: 'Town', frames: [plankWall(row, col)] });
  for (const row of ['ridge', 'body', 'eave']) for (const col of ['left', 'mid', 'right']) pack.add(T, { id: `nk-roof-${row}-${col}`, name: `Roof ${row} ${col}`, category: 'Town', frames: [roof1(row, col)] });
  pack.add(T, { id: 'nk-window', name: 'Window', category: 'Town', frames: [window1(false)], tags: ['overlay'] });
  pack.add(T, { id: 'nk-window-shutters', name: 'Window with shutters', category: 'Town', frames: [window1(true)], tags: ['overlay'] });
  pack.add(T, { id: 'nk-chimney', name: 'Chimney', category: 'Town', frames: [chimney1()], tags: ['overlay'] });
  pack.add(T, { id: 'nk-crate', name: 'Crate', category: 'Town', frames: [crate1()] });
  pack.add(T, { id: 'nk-barrel', name: 'Barrel', category: 'Town', frames: [barrel1()] });
  pack.newRow(T);
  pack.add(T, { id: 'nk-door-house', name: 'House door', category: 'Town', frames: [townDoor()], tags: ['overlay'] });
  pack.add(T, { id: 'nk-lamp', name: 'Lamppost', category: 'Town', frames: [0, 1].map(lamp1), duration: 400, tags: ['animated'] });
  pack.add(T, { id: 'nk-sign', name: 'Signpost', category: 'Town', frames: [sign1()] });
  pack.add(T, { id: 'nk-stall', name: 'Market stall', category: 'Town', frames: [stall1()] });
  pack.add(T, { id: 'nk-well', name: 'Well', category: 'Town', frames: [well1()] });
  pack.add(T, { id: 'nk-bench', name: 'Bench', category: 'Town', frames: [bench1()] });

  /* items + interface */
  const IT = 'items';
  for (const [k, rows] of Object.entries(ITEMS)) pack.add(IT, { id: `nk-item-${k}`, name: k[0].toUpperCase() + k.slice(1), category: 'Items', frames: [art(16, 16, 2, Math.max(1, Math.floor((16 - rows.length) / 2)), rows)] });
  pack.newRow(IT);
  pack.add(IT, { id: 'nk-ui-panel', name: 'Panel', category: 'Interface', frames: [uiPanel(false)], meta: { nineSlice: [5, 5, 5, 5] } });
  pack.add(IT, { id: 'nk-ui-window', name: 'Window', category: 'Interface', frames: [uiPanel(true)], meta: { nineSlice: [5, 13, 5, 5] } });
  pack.add(IT, { id: 'nk-ui-dialogue', name: 'Dialogue box', category: 'Interface', frames: [uiDialogue()], meta: { nineSlice: [5, 5, 5, 5] } });
  for (const st of ['normal', 'hover', 'selected']) pack.add(IT, { id: `nk-ui-slot-${st}`, name: `Slot ${st}`, category: 'Interface', frames: [uiSlot(st)], meta: { nineSlice: [4, 4, 4, 4] } });
  for (const st of ['normal', 'hover', 'pressed']) pack.add(IT, { id: `nk-ui-button-${st}`, name: `Button ${st}`, category: 'Interface', frames: [uiButton(st)], meta: { nineSlice: [4, 4, 4, 4] } });
  pack.add(IT, { id: 'nk-ui-bar', name: 'Bar frame', category: 'Interface', frames: [uiBar(false)], meta: { nineSlice: [3, 4, 3, 4] } });
  pack.add(IT, { id: 'nk-ui-bar-fill', name: 'Bar fill', category: 'Interface', frames: [uiBar(true)] });
  pack.add(IT, { id: 'nk-ui-check-off', name: 'Checkbox', category: 'Interface', frames: [uiCheck(false)] });
  pack.add(IT, { id: 'nk-ui-check-on', name: 'Checkbox (checked)', category: 'Interface', frames: [uiCheck(true)] });
  pack.add(IT, { id: 'nk-ui-cursor', name: 'Cursor', category: 'Interface', frames: [art(16, 16, 1, 1, ['o.........', 'oo........', 'owo.......', 'owwo......', 'owwwo.....', 'owwwwo....', 'owwwwwo...', 'owwoooo...', 'owo.......', 'oo........'])], meta: { hotspot: [1, 1] } });
  pack.add(IT, { id: 'nk-ui-hand', name: 'Hand cursor', category: 'Interface', frames: [art(16, 16, 2, 1, ['..oo......', '.owwo.....', '.owwoooo..', '.owwowwoo.', 'oowwwwwwwo', 'owowwwwwwo', 'owwwwwwwwo', '.owwwwwwo.', '..owwwwwo.', '..oooooo..'])], meta: { hotspot: [4, 1] } });

  /* effects */
  const F = 'fx', fr = (n, fn) => Array.from({ length: n }, (_, i) => fn(i));
  pack.add(F, { id: 'nk-fx-sparkle', name: 'Sparkle', category: 'Effects', frames: fr(4, fxSparkle), duration: 110 });
  pack.add(F, { id: 'nk-fx-dust', name: 'Dust puff', category: 'Effects', frames: fr(5, fxDust), duration: 80, loop: false, oneShot: 'fade' });
  pack.add(F, { id: 'nk-fx-smoke', name: 'Rising smoke', category: 'Effects', frames: fr(8, fxSmoke), duration: 130 });
  pack.newRow(F);
  pack.add(F, { id: 'nk-fx-splash', name: 'Splash', category: 'Effects', frames: fr(5, fxSplash), duration: 80, loop: false, oneShot: 'fade' });
  pack.add(F, { id: 'nk-fx-burst', name: 'Impact burst', category: 'Effects', frames: fr(4, fxBurst), duration: 70, loop: false, oneShot: 'fade', allowHold: true });
  pack.newRow(F);
  pack.add(F, { id: 'nk-fx-swirl', name: 'Magic swirl', category: 'Effects', frames: fr(8, fxSwirl), duration: 90 });
  pack.add(F, { id: 'nk-fx-glint', name: 'Pickup glint', category: 'Effects', frames: fr(5, fxGlint), duration: 80, loop: false, oneShot: 'fade' });

  /* characters */
  const layers = [], counters = { body: 0, outfit: 0, hair: 0, accessory: 0 };
  const sheetName = { body: 'Bodies', outfit: 'Outfits', hair: 'Hair', accessory: 'Accessories' };
  const addLayer = (cat, id, name, frames, extra) => {
    const k = counters[cat]++, col0 = (k % 4) * 6, row0 = Math.floor(k / 4) * 4;
    FG.DIRS.forEach((dir, d) => { for (const [anim, col] of [['walk', 0], ['idle', 4]]) pack.add(cat, { id: `${id}-${anim}-${dir}`, name: `${name} — ${anim} ${dir}`, category: `Characters: ${sheetName[cat]}`, frames: frames[dir][anim], durations: FG.ANIMS[anim].durations, at: [col0 + col, row0 + d], anchor: cat === 'body' ? 'feet' : undefined, allowHold: true }); });
    layers.push(Object.assign({ id, name, category: cat, sheet: cat, x: col0 * 16, y: row0 * 32 }, extra));
  };
  const builds = [['slim', 'Slim'], ['sturdy', 'Sturdy']];
  for (const [b, bn] of builds) for (const tone of TONES) addLayer('body', `nk-body-${b}-${tone[0]}`, `${bn} body, ${tone[2]}`, inkBody(b, tone), { build: b, option: tone[0], optionName: tone[2], group: `body-${b}`, groupName: `${bn} body`, swatch: ['#f1e6cf', '#c7bba6', '#8c8392'][TONES.indexOf(tone)] });
  const OUT = { tunic: [['cream', 'leather', 'gold'], ['purple', 'slate', 'leather']], dress: [['cream', 'cream', 'gold'], ['blue', 'cream', 'leather']], robe: [['cream', 'leather', 'cream'], ['purple', 'gold', 'cream']], overalls: [['blue', 'cream', 'leather'], ['leather', 'cream', 'slate']], cloak: [['cream', 'purple', 'gold'], ['slate', 'leather', 'gold']], coat: [['red', 'leather', 'gold'], ['slate', 'leather', 'cream']] };
  for (const [b, bn] of builds) for (const [st, cws] of Object.entries(OUT)) cws.forEach((cw, i) => addLayer('outfit', `nk-outfit-${st}-${i + 1}-${b}`, `${CK.OUTFITS[st].name} ${i + 1} (${bn.toLowerCase()})`, convertLayer(CK.outfitLayer(b, st, cw), b), { build: b, group: st, groupName: CK.OUTFITS[st].name, option: String(i + 1), optionName: i ? 'Dark' : 'Light', swatch: i ? '#262137' : '#f1e6cf' }));
  for (const st of ['crop', 'bob', 'long', 'ponytail', 'bun', 'curls']) for (const [hc, hn] of [['hblonde', 'Light'], ['hblack', 'Dark']]) addLayer('hair', `nk-hair-${st}-${hn.toLowerCase()}`, `${CK.HAIRSTYLES[st].name} hair, ${hn.toLowerCase()}`, convertLayer(CK.hairLayer(st, hc), 'slim'), { group: st, groupName: CK.HAIRSTYLES[st].name, option: hn.toLowerCase(), optionName: hn, swatch: hn === 'Dark' ? '#262137' : '#f1e6cf' });
  for (const [b, bn] of builds) for (const [kind, cols] of [['sunhat', ['gold', 'red']], ['scarf', ['red', 'gold']], ['backpack', ['leather', 'gold']], ['glasses', ['leather', 'blue']]]) addLayer('accessory', `nk-acc-${kind}-${b}`, `${CK.ACCESSORIES[kind].name} (${bn.toLowerCase()})`, convertLayer(CK.accessoryLayer(b, kind, cols), b), { build: b, group: kind, groupName: CK.ACCESSORIES[kind].name, option: '1', optionName: 'Ink', swatch: '#262137' });
  pack.characters = { frameWidth: 16, frameHeight: 32, directions: FG.DIRS, animations: { walk: { column: 0, frames: 4, durations: FG.ANIMS.walk.durations }, idle: { column: 4, frames: 2, durations: FG.ANIMS.idle.durations } }, layerSize: { columns: 6, rows: 4 }, order: ['body', 'outfit', 'hair', 'accessory'], builds: builds.map(([id, name]) => ({ id, name })), layers, ink: true };
  pack.previewCombos = [['nk-body-slim-paper', 'nk-outfit-tunic-1-slim', 'nk-hair-crop-dark', null], ['nk-body-sturdy-shade', 'nk-outfit-dress-2-sturdy', 'nk-hair-curls-dark', null], ['nk-body-slim-stipple', 'nk-outfit-robe-2-slim', 'nk-hair-long-light', 'nk-acc-glasses-slim'], ['nk-body-sturdy-paper', 'nk-outfit-overalls-1-sturdy', 'nk-hair-ponytail-light', 'nk-acc-sunhat-sturdy']];
  pack.extra.recolor = { paper: '#f1e6cf', ink: '#262137' };
  samples(pack);
  return pack;
}

function samples(pack) {
  const G = K.grids;
  { const W2 = 30, H2 = 20; const mb = new K.MapBuilder(pack, 'ink-village', 'Ink village', W2, H2);
    const gr = pack.extra.ground[0].assets;
    mb.fill('Ground', (x, y) => gr[hash2(x, y, 2) < 0.7 ? 0 : 1 + Math.floor(hash2(x, y, 3) * 3)]);
    mb.terrain('Path', 'path', G.path(G.blank(W2, H2), W2, [[0, 13], [14, 13], [14, 7], [29, 7]], 2));
    mb.terrain('Water', 'water', G.clean(G.blob(W2, H2, 24, 15, 5.5, 3.6, 4), W2, H2));
    mb.layer('Buildings');
    const col = (i, w) => i === 0 ? 'left' : i === w - 1 ? 'right' : 'mid';
    for (const [hx, hy, w] of [[2, 2, 5], [17, 1, 4]]) for (let i = 0; i < w; i++) { ['ridge', 'body', 'eave'].forEach((row, j) => mb.set('Buildings', hx + i, hy + j, `nk-roof-${row}-${col(i, w)}`)); mb.set('Buildings', hx + i, hy + 3, `nk-wall-upper-${col(i, w)}`); mb.set('Buildings', hx + i, hy + 4, `nk-wall-lower-${col(i, w)}`); }
    const O = (id, x, y, L = 'Objects') => mb.stamp(L, id, x, y);
    O('nk-door-house', 4, 5, 'Details'); O('nk-window', 2, 5, 'Details'); O('nk-window-shutters', 6, 5, 'Details'); O('nk-chimney', 3, 2, 'Details'); O('nk-door-house', 18, 4, 'Details'); O('nk-window', 20, 4, 'Details');
    O('nk-tree-big', 9, 1); O('nk-tree', 26, 0); O('nk-pine', 0, 14); O('nk-pine', 1, 16); O('nk-tree', 11, 15); O('nk-well', 8, 8); O('nk-stall', 22, 9);
    O('nk-lamp', 13, 3); O('nk-sign', 16, 11); O('nk-crate', 7, 6); O('nk-barrel', 1, 6); O('nk-bench', 4, 9); O('nk-bush', 27, 4); O('nk-bush-berries', 6, 17); O('nk-rock', 19, 17); O('nk-boulder', 27, 17);
    O('nk-flowers-a', 9, 12); O('nk-flowers-b', 4, 16); O('nk-tallgrass', 13, 18); O('nk-tallgrass', 14, 17);
    const fence = G.blank(W2, H2); for (let x = 20; x <= 28; x++) fence[12 * W2 + x] = 0; for (let x = 2; x <= 8; x++) fence[11 * W2 + x] = 1; mb.edges('Objects', 'fence', fence);
    mb.done(); }
  { const W2 = 22, H2 = 16; const mb = new K.MapBuilder(pack, 'ink-dungeon', 'Ink dungeon', W2, H2);
    const fl = pack.extra.ground[1].assets;
    mb.fill('Floor', (x, y) => fl[hash2(x, y, 6) < 0.8 ? 0 : 1 + Math.floor(hash2(x, y, 7) * 2)]);
    const room = G.blank(W2, H2); G.rect(room, W2, 2, 3, 8, 6); G.rect(room, W2, 12, 2, 8, 7); G.rect(room, W2, 4, 9, 14, 5); G.rect(room, W2, 10, 5, 2, 2);
    const walls = G.blank(W2, H2);
    for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) { if (room[y * W2 + x]) continue; let near = false; for (let dy = -2; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W2 && yy < H2 && room[yy * W2 + xx]) near = true; } walls[y * W2 + x] = near ? 1 : 1; }
    mb.terrain('Walls', 'walls', walls);
    const O = (id, x, y, L = 'Objects') => mb.stamp(L, id, x, y);
    O('nk-pillar', 3, 3); O('nk-pillar', 8, 3); O('nk-chest', 17, 4); O('nk-spikes', 9, 11); O('nk-spikes', 10, 11); O('nk-plate-up', 6, 12); O('nk-stairs-down', 16, 12); O('nk-torch', 5, 2, 'Details'); O('nk-torch', 15, 1, 'Details'); O('nk-door', 11, 1, 'Details');
    mb.done(); }
}

module.exports = { build, palette: P };
