'use strict';
const { Raster, Palette, mulberry32, hash2, pnoise, dither, wobble, mod } = require('../lib/raster.js');
const { Pack } = require('../lib/pack.js');
const TR = require('../lib/terrain.js');
const K = require('../lib/kit.js');
const A = require('../lib/art.js');

const P = new Palette([
  ['out', '#14121c'], ['void', '#0c0b12'],
  ['s0', '#211f2d'], ['s1', '#302e43'], ['s2', '#45435d'], ['s3', '#5e5c79'], ['s4', '#7f7d99'], ['s5', '#a9a7bd'],
  ['f0', '#2b2631'], ['f1', '#423b47'], ['f2', '#574e5b'], ['f3', '#6f6572'], ['f4', '#8d8290'],
  ['m0', '#2c4436'], ['m1', '#46684a'], ['m2', '#6c8f53'],
  ['w0', '#3a2219'], ['w1', '#5d3723'], ['w2', '#86532e'], ['w3', '#b07a43'],
  ['i0', '#383d4b'], ['i1', '#656c80'], ['i2', '#9ea5b7'], ['i3', '#dde2ea'],
  ['y0', '#74491b'], ['y1', '#b47c29'], ['y2', '#e6b649'], ['y3', '#fbe6a0'],
  ['r0', '#8c2b1f'], ['r1', '#d0522a'], ['r2', '#f29638'], ['r3', '#ffd468'], ['r4', '#fff4c8'],
  ['c0', '#5a1f33'], ['c1', '#8e3047'], ['c2', '#b8495a'],
  ['t0', '#1f5f63'], ['t1', '#2f9a93'], ['t2', '#66d6c6'], ['t3', '#c3f5ea'],
  ['q1', '#2a4560'], ['q2', '#4a7896']
]);

/* ---------- floors ---------- */
const STONE_TINT = (bx, by) => hash2(mod(bx, 2), mod(by, 2), 4);
function flagstone(x, y) {
  const lx = mod(x, 16), ly = mod(y, 16);
  const bx = lx >> 3, by = ly >> 3, u = lx & 7, v = ly & 7;
  if (u === 0 || v === 0) return P.f0;
  const t = STONE_TINT(bx, by);
  if (v === 1 && u < 7) return t > 0.5 ? P.f4 : P.f3;
  if (u === 1 && v < 7) return P.f3;
  if (v === 7 || u === 7) return P.f1;
  const n = hash2(lx, ly, 9);
  if (n < 0.06) return P.f1;
  return t > 0.5 ? P.f3 : P.f2;
}
function floorVariant(kind) {
  const r = Raster.from(16, 16, flagstone);
  const rng = mulberry32(kind.length * 31);
  if (kind === 'cracked') { r.line(3, 3, 6, 6, P.f0); r.line(6, 6, 5, 7, P.f0); r.line(10, 10, 13, 12, P.f0); r.set(12, 10, P.f0); }
  if (kind === 'mossy') { for (const [x, y] of [[2, 6], [3, 6], [3, 5], [9, 7], [10, 7], [9, 6], [5, 14], [6, 14], [13, 3], [12, 2]]) r.set(x, y, P.m1); r.set(3, 7, P.m2); r.set(10, 6, P.m2); }
  if (kind === 'pebbles') { for (const [x, y] of [[4, 4], [11, 5], [5, 11], [12, 12]]) { r.set(x, y, P.f4); r.set(x + 1, y, P.f2); r.set(x, y + 1, P.f1); } }
  if (kind === 'worn') { for (let y = 2; y < 15; y++) for (let x = 2; x < 15; x++) if ((x & 7) && (y & 7) && hash2(x, y, 3) < 0.25) r.set(x, y, P.f2); }
  if (kind === 'rune') { const c = P.t0; r.set(4, 3, c); r.set(5, 4, c); r.set(4, 5, c); r.set(3, 4, c); r.set(11, 11, c); r.set(12, 12, c); r.set(11, 13, c); r.set(10, 12, c); }
  void rng;
  return r;
}

/* ---------- walls (cap and face) ---------- */
const wallShape = TR.shape({ top: 0, bottom: 0, left: 0, right: 0, outer: 0, inner: 0 });
function brick(x, y) {
  const lx = mod(x, 16), ly = mod(y, 16);
  const row = Math.floor((ly - 4) / 4);
  const off = mod(row, 2) * 4;
  const bu = mod(lx + off, 8), bv = mod(ly - 4, 4);
  if (bv === 3) return P.s1;
  if (bu === 7) return P.s1;
  const tint = hash2(Math.floor(mod(lx + off, 16) / 8), mod(row, 4), 21);
  if (bv === 0) return tint > 0.5 ? P.s5 : P.s4;
  if (bv === 2) return P.s2;
  return tint > 0.66 ? P.s4 : P.s3;
}
function capTex(x, y) {
  const lx = mod(x, 16), ly = mod(y, 16);
  const n = pnoise(lx, ly, 4, 16, 5);
  if (n > 0.68 && dither(lx, ly, 0.5)) return P.s2;
  if (n < 0.28 && dither(lx + 1, ly, 0.5)) return P.s0;
  return P.s1;
}
function wallPaint(x, y, q) {
  const cx = Math.floor(x / 16), cy = Math.floor(y / 16);
  if (!q.occ(cx, cy)) return 0;
  const lx = mod(x, 16), ly = mod(y, 16);
  const o = (dx, dy) => q.occ(cx + dx, cy + dy);
  const face = !o(0, 1);
  const N = o(0, -1), E = o(1, 0), W = o(-1, 0);
  if (face) {
    if (lx === 0 && !W) return P.out;
    if (lx === 15 && !E) return P.out;
    if (ly < 4) {
      if (ly === 0 && !N) return P.out;
      if (ly === 1 && !N) return P.s4;
      if (ly === 3) return P.s2;
      if (lx === 1 && !W) return P.s4;
      return capTex(x, y);
    }
    if (ly === 15) return P.s0;
    if (lx === 1 && !W) return P.s4;
    if (lx === 14 && !E) return P.s2;
    return brick(x, y);
  }
  /* cap cell (south neighbour is wall) */
  const S = true;
  const NE = o(1, -1), NW = o(-1, -1), SE = o(1, 1), SW = o(-1, 1);
  if (lx === 0 && !W) return P.out;
  if (lx === 15 && !E) return P.out;
  if (ly === 0 && !N) return P.out;
  /* inner corners toward open diagonals */
  if (N && E && !NE && lx === 15 && ly === 0) return P.out;
  if (N && W && !NW && lx === 0 && ly === 0) return P.out;
  /* face beside this cap: separate cap from the bricks next to it */
  if (E && S && !SE && lx === 15 && ly >= 4) return P.out;
  if (W && S && !SW && lx === 0 && ly >= 4) return P.out;
  if ((lx === 1 && !W) || (ly === 1 && !N)) return P.s3;
  if (lx === 14 && !E) return P.s2;
  if (N && E && !NE && ((lx === 14 && ly === 0) || (lx === 15 && ly === 1))) return P.s3;
  if (N && W && !NW && ((lx === 1 && ly === 0) || (lx === 0 && ly === 1))) return P.s3;
  return capTex(x, y);
}

/* ---------- floor over pit ---------- */
const ledgeShape = TR.shape({ top: 1, bottom: 5, left: 1, right: 1, wobBottom: t => wobble(mod(t, 16), 16, 1, 44), outer: 2, inner: 2 });
function ledgePaint(x, y, q) {
  if (!q.cell(x, y)) return P.void;
  if (q.inside(x, y)) {
    const p = q.probe(x, y, 2);
    if (p.ring) return P.out;
    if (p.down === 1) return P.f1;
    return flagstone(x, y);
  }
  /* the cliff face only ever hangs inside this cell's own bottom margin */
  if (mod(y, 16) < 9) return P.void;
  for (let k = 1; k <= 6; k++) if (q.inside(x, y - k)) {
    if (k === 1) return P.s3;
    if (k >= 5) return dither(x, y, 0.5) ? P.s0 : P.void;
    const lx = mod(x, 16);
    if (mod(lx + (k > 2 ? 3 : 0), 6) === 0) return P.s0;
    return k === 2 ? P.s2 : k === 3 ? P.s1 : P.s0;
  }
  return P.void;
}

/* ---------- rug ---------- */
const rugShape = TR.shape({ top: 2, bottom: 2, left: 2, right: 2, outer: 2, inner: 2 });
function rugPaint(x, y, q) {
  if (!q.inside(x, y)) return 0;
  const p = q.probe(x, y, 4);
  if (p.ring) return P.c0;
  if (p.min === 1) return P.y1;
  if (p.min === 2) return P.c1;
  const lx = mod(x, 8), ly = mod(y, 8);
  if ((lx === 3 || lx === 4) && (ly === 3 || ly === 4)) return P.y2;
  if (Math.abs(lx - 3.5) + Math.abs(ly - 3.5) === 3) return P.c2;
  return P.c1;
}

/* ---------- objects ---------- */
function flame(r, cx, base, h, w, f, seed) {
  const rng = mulberry32(seed * 31 + f);
  const tipShift = [0, 1, 0, -1, 0, 1][f % 6];
  const hh = h + [0, 1, 2, 1, 0, -1][f % 6];
  for (let j = 0; j < hh; j++) {
    const t = j / hh;
    const half = (w / 2) * Math.sin(Math.PI * (0.35 + t * 0.65)) * (1 - t * 0.35);
    const cxx = cx + tipShift * t * t * 1.5;
    for (let x = Math.floor(cxx - half); x <= Math.ceil(cxx + half); x++) {
      const d = Math.abs(x + 0.5 - cxx) / Math.max(0.6, half);
      let c = d > 0.75 ? P.r1 : d > 0.45 ? P.r2 : P.r3;
      if (t > 0.75) c = d > 0.5 ? P.r1 : P.r2;
      if (t < 0.4 && d < 0.3) c = P.r4;
      r.set(x, base - j, c);
    }
  }
  if (rng() < 0.7) r.set(Math.round(cx + (rng() - 0.5) * w), base - hh - 1 - Math.floor(rng() * 2), P.r2);
}
function wallTorch(f) {
  const r = new Raster(16, 16);
  r.rect(7, 9, 2, 6, P.w1); r.set(7, 9, P.w2); r.set(7, 10, P.w2);
  r.rect(5, 12, 6, 2, P.i1); r.hline(5, 10, 12, P.i2); r.set(4, 12, P.i0); r.set(11, 12, P.i0);
  r.rect(6, 8, 4, 2, P.w0);
  flame(r, 8, 7, 6, 5, f, 1);
  return r;
}
function brazier(f) {
  const r = new Raster(16, 32);
  r.rect(7, 18, 2, 11, P.i1); r.vline(7, 18, 28, P.i2);
  r.rect(4, 28, 8, 2, P.i1); r.hline(4, 11, 28, P.i2); r.hline(3, 12, 30, P.out);
  r.rect(2, 13, 12, 4, P.i1); r.hline(2, 13, 13, P.i2); r.hline(3, 12, 17, P.i0); r.hline(1, 14, 12, P.i0);
  r.rect(3, 12, 10, 1, P.r0);
  flame(r, 8, 11, 9, 9, f, 2);
  const embers = [[4, 3], [11, 5], [6, 1], [10, 2]];
  embers.forEach(([ex, ey], i) => { const yy = ey + ((f + i * 2) % 6) * -1 + 3; if (yy > 0) r.set(ex, yy, i % 2 ? P.r3 : P.r2); });
  r.outline(P.out);
  return r;
}
function candles(f) {
  const r = new Raster(16, 16);
  const cs = [[4, 9, 5], [8, 7, 7], [11, 10, 4]];
  cs.forEach(([x, top, h], i) => {
    r.rect(x, top, 2, h, P.y3); r.vline(x + 1, top, top + h - 1, P.s5);
    const fl = (f + i) % 4;
    r.set(x, top - 1, P.r3); r.set(x + (fl === 1 ? 1 : 0), top - 2, fl === 2 ? P.r4 : P.r2);
    if (fl === 3) r.set(x, top - 3, P.r1);
  });
  r.hline(3, 13, 14, P.y1); r.hline(3, 13, 15, P.y0);
  return r;
}
function chest(f, gold) {
  const r = new Raster(16, 16);
  const wood = gold ? [P.c0, P.c1, P.c2] : [P.w1, P.w2, P.w3];
  const band = gold ? [P.y1, P.y2, P.y3] : [P.i0, P.i1, P.i2];
  /* body */
  r.rect(2, 9, 12, 6, wood[1]); r.hline(2, 13, 9, wood[2]); r.hline(2, 13, 14, wood[0]);
  for (const bx of [4, 11]) { r.vline(bx, 9, 14, band[1]); r.set(bx, 9, band[2]); }
  const lid = [0, 1, 3, 5, 5][f];
  if (lid === 0) {
    r.rect(2, 5, 12, 4, wood[1]); r.hline(3, 12, 4, wood[2]); r.hline(2, 13, 5, wood[2]); r.hline(2, 13, 8, wood[0]);
    for (const bx of [4, 11]) { r.vline(bx, 4, 8, band[1]); r.set(bx, 4, band[2]); }
    r.set(7, 7, P.y3); r.set(8, 7, P.y2); r.set(7, 8, P.y2); r.set(8, 8, P.y1); r.set(7, 9, P.y1); r.set(8, 9, P.y0);
  } else {
    r.rect(3, 9, 10, 2, P.s0);
    if (f >= 2) { r.set(5, 9, P.y2); r.set(6, 9, P.y3); r.set(9, 9, P.y2); r.set(10, 10, P.y1); r.set(8, 9, P.t2); }
    const top = 9 - lid - 3;
    r.rect(2, top, 12, 3 + Math.min(lid, 2), wood[0]); r.hline(3, 12, top, wood[1]);
    for (const bx of [4, 11]) r.vline(bx, top, top + 2 + Math.min(lid, 2), band[0]);
    if (lid === 1) { r.hline(3, 12, 8, P.r3); }
    r.rect(7, 10, 2, 2, P.y2);
  }
  if (f === 4) { r.set(7, 2, P.y3); r.set(6, 3, P.y2); r.set(8, 3, P.y2); r.set(7, 4, P.y2); r.set(12, 4, P.y3); r.set(3, 5, P.y3); }
  r.outline(P.out);
  return r;
}
function spikes(f) {
  const r = Raster.from(16, 16, flagstone);
  const len = [0, 1, 3, 5, 3][f];
  for (const hx of [3, 7, 11]) for (const hy of [5, 11]) {
    const x = hx + (hy === 11 ? 1 : 0);
    r.set(x, hy, P.out); r.set(x + 1, hy, P.out); r.set(x, hy + 1, P.f0); r.set(x + 1, hy + 1, P.f0);
    for (let k = 0; k < len; k++) {
      const yy = hy - k;
      r.set(x, yy, k === len - 1 ? P.i3 : P.i2); r.set(x + 1, yy, k === len - 1 ? P.i2 : P.i1);
    }
  }
  return r;
}
function plate(down, rune) {
  const r = Raster.from(16, 16, flagstone);
  const top = down ? 4 : 3;
  r.rect(3, 3, 10, 10, P.out);
  r.rect(4, top, 8, 8, rune ? (down ? P.t0 : P.s3) : (down ? P.f1 : P.f3));
  if (!down) { r.hline(4, 11, 3, rune ? P.s4 : P.f4); r.hline(4, 11, 11, P.f0); r.vline(11, 4, 11, P.f1); }
  if (rune) { const c = down ? P.t2 : P.t0; r.set(7, 6 + (down ? 1 : 0), c); r.set(8, 6 + (down ? 1 : 0), c); r.set(6, 7 + (down ? 1 : 0), c); r.set(9, 7 + (down ? 1 : 0), c); r.set(7, 8 + (down ? 1 : 0), c); r.set(8, 8 + (down ? 1 : 0), c); if (down) { r.set(5, 5, P.t1); r.set(10, 10, P.t1); } }
  return r;
}
function pillar(kind) {
  const r = new Raster(16, 32);
  const top = kind === 'broken' ? 12 : 3;
  for (let y = top + 3; y <= 26; y++) for (let x = 4; x <= 11; x++) {
    let c = x === 4 ? P.out : x === 11 ? P.out : x === 5 ? P.s5 : x === 6 ? P.s4 : x >= 9 ? P.s2 : P.s3;
    if (mod(y, 6) === 0 && x > 4 && x < 11) c = P.s2;
    r.set(x, y, c);
  }
  if (kind !== 'broken') { r.rect(3, top, 10, 3, P.s4); r.hline(3, 12, top, P.s5); r.hline(3, 12, top + 2, P.s2); }
  else { r.set(5, top + 2, P.s4); r.set(6, top + 1, P.s4); r.set(7, top + 2, P.s3); r.set(9, top + 1, P.s3); r.set(10, top + 2, P.s2); }
  r.rect(2, 26, 12, 4, P.s3); r.hline(2, 13, 26, P.s5); r.hline(2, 13, 29, P.s1);
  if (kind === 'mossy') for (let y = 8; y < 28; y++) for (let x = 5; x < 11; x++) if (hash2(x, y, 7) < 0.16 + (y > 22 ? 0.2 : 0)) r.set(x, y, hash2(x, y, 8) < 0.5 ? P.m1 : P.m2);
  r.outline(P.out);
  if (kind === 'broken') { r.set(1, 30, P.s3); r.set(13, 29, P.s2); r.set(14, 30, P.s3); }
  return r;
}
function doorOverlay(kind, f = 0) {
  const r = new Raster(16, 16);
  /* stone arch frame */
  for (let y = 3; y <= 15; y++) for (let x = 2; x <= 13; x++) {
    const inArch = (x >= 4 && x <= 11 && y >= 6) || (x >= 5 && x <= 10 && y >= 5);
    const inFrame = (x >= 3 && x <= 12 && y >= 4) || (x >= 4 && x <= 11 && y >= 3);
    if (inArch) continue;
    if (inFrame) r.set(x, y, y === 3 || (y === 4 && (x === 3 || x === 12)) ? P.s5 : x <= 4 ? P.s4 : P.s3);
  }
  const opening = kind === 'arch' ? 1 : [0, 0.35, 0.7, 1][f];
  for (let y = 5; y <= 15; y++) for (let x = 4; x <= 11; x++) {
    if (y === 5 && (x === 4 || x === 11)) continue;
    r.set(x, y, y > 13 ? P.s0 : P.void);
  }
  if (kind === 'wood') {
    const w = Math.round(8 * (1 - opening));
    for (let y = 5; y <= 15; y++) for (let x = 4; x < 4 + w; x++) {
      if (y === 5 && x === 4) continue;
      let c = mod(x - 4, 3) === 2 ? P.w0 : P.w2;
      if (y === 8 || y === 13) c = P.i1;
      if (x === 4 + w - 1) c = P.w1;
      r.set(x, y, c);
    }
    if (w > 3) { r.set(4 + w - 2, 10, P.y2); r.set(4 + w - 2, 11, P.y1); }
  }
  if (kind === 'gate') {
    const lift = Math.round(9 * opening);
    for (let y = 5; y <= 15 - lift; y++) for (let x = 4; x <= 11; x++) {
      if (y === 5 && (x === 4 || x === 11)) continue;
      if (mod(x - 4, 2) === 1 || y === 7 + 0 || y === 12) r.set(x, y, x % 2 ? P.i2 : P.i1);
    }
    for (let x = 4; x <= 11; x += 2) r.set(x + 1, 15 - lift, P.i3);
  }
  r.outline(P.out);
  return r;
}
function stairs(dir) {
  const r = Raster.from(16, 16, flagstone);
  if (dir === 'down') {
    for (let k = 0; k < 5; k++) {
      const y = 3 + k * 2, inset = 2 + k;
      r.rect(inset, y, 16 - inset * 2, 2, k < 4 ? [P.f4, P.f3, P.f2, P.f1][k] : P.void);
      r.hline(inset, 15 - inset, y + 1, k < 4 ? P.f0 : P.void);
    }
    r.rect(6, 13, 4, 3, P.void);
    r.box(1, 2, 14, 14, P.out);
  } else {
    for (let k = 0; k < 6; k++) {
      const y = 14 - k * 2;
      r.rect(2, y - 1, 12, 2, [P.s3, P.s4, P.s3, P.s4, P.s3, P.s4][k]); r.hline(2, 13, y - 1, P.s5);
    }
    r.vline(1, 2, 15, P.out); r.vline(14, 2, 15, P.out); r.hline(1, 14, 2, P.out);
  }
  return r;
}
function urn(seed, tall) {
  const r = new Raster(16, 16);
  const h = tall ? 11 : 8, top = 15 - h;
  for (let y = 0; y < h; y++) {
    const t = y / h;
    const half = tall ? 2 + Math.sin(Math.PI * Math.min(1, t * 1.1)) * 3 : 2.5 + Math.sin(Math.PI * t) * 2.5;
    for (let x = Math.round(8 - half); x < Math.round(8 + half); x++) {
      const rel = (x - (8 - half)) / (half * 2);
      r.set(x, top + y, rel < 0.3 ? P.c2 : rel > 0.75 ? P.c0 : P.c1);
    }
  }
  r.hline(6, 9, top, P.c0); r.rect(6, top - 1, 4, 1, P.c1);
  r.hline(5, 10, top + Math.round(h * 0.45), P.y1);
  r.outline(P.out);
  void seed;
  return r;
}
function crystal(f) {
  const r = new Raster(16, 16);
  const shards = [[8, 2, 3, 13], [4, 7, 2, 13], [12, 6, 2, 13]];
  const glow = [P.t2, P.t3, P.t2, P.t1][f];
  for (const [cx, top, half, base] of shards) {
    for (let y = top; y <= base; y++) {
      const w = Math.min(half, Math.floor((y - top) * 0.8));
      for (let x = cx - w; x <= cx + w; x++) r.set(x, y, x < cx ? P.t2 : x === cx ? glow : P.t1);
    }
  }
  r.rect(3, 13, 11, 2, P.s2); r.hline(3, 13, 13, P.s3);
  r.outline(P.out);
  if (f === 1) r.set(8, 4, P.t3), r.set(4, 9, P.t3);
  if (f === 2) r.set(12, 8, P.t3);
  return r;
}
function cobweb(flip) {
  const r = new Raster(16, 16);
  const c = P.s5;
  for (let i = 0; i < 10; i++) { r.set(i, 0, c); r.set(0, i, c); }
  r.line(0, 0, 9, 9, c); r.line(0, 0, 11, 4, c); r.line(0, 0, 4, 11, c);
  for (const k of [3, 6, 9]) { r.line(k, 0, 0, k, c); }
  return flip ? r.flipX() : r;
}
function banner(color) {
  const r = new Raster(16, 16);
  r.hline(3, 12, 1, P.w2); r.set(2, 1, P.w1); r.set(13, 1, P.w1);
  for (let y = 2; y <= 13; y++) for (let x = 4; x <= 11; x++) {
    if (y >= 12 && Math.abs(x - 7.5) < (y - 11) * 1.5) continue;
    r.set(x, y, x === 4 ? color[2] : x === 11 ? color[0] : color[1]);
  }
  /* original emblem: two interlocking diamonds */
  for (const [cx, cy] of [[6.5, 7], [9.5, 7]]) for (let k = 0; k < 4; k++) { r.set(Math.round(cx - 2 + k), Math.round(cy - Math.abs(k - 1.5) + 0.5), P.y2); r.set(Math.round(cx - 2 + k), Math.round(cy + Math.abs(k - 1.5) - 0.5), P.y2); }
  r.outline(P.out);
  return r;
}
function chains() {
  const r = new Raster(16, 16);
  for (const x of [4, 11]) for (let y = 0; y < 14; y += 3) { r.set(x, y, P.i2); r.set(x - 1, y + 1, P.i1); r.set(x + 1, y + 1, P.i1); r.set(x, y + 2, P.i0); }
  r.set(4, 14, P.i2); r.set(11, 14, P.i2);
  return r;
}
function lever(on) {
  const r = new Raster(16, 16);
  r.rect(4, 10, 8, 4, P.s3); r.hline(4, 11, 10, P.s5); r.hline(4, 11, 13, P.s1);
  if (on) { r.line(8, 10, 12, 4, P.w2); r.disc(12.5, 4, 1.5, P.c1); }
  else { r.line(7, 10, 3, 4, P.w2); r.disc(3.5, 4, 1.5, P.c1); }
  r.outline(P.out);
  return r;
}
function grate() {
  const r = Raster.from(16, 16, flagstone);
  r.rect(3, 4, 10, 8, P.out);
  for (let x = 4; x <= 11; x++) for (let y = 5; y <= 10; y++) r.set(x, y, x % 2 ? P.i1 : P.void);
  r.hline(4, 11, 5, P.i2);
  return r;
}
function puddle() {
  const r = new Raster(16, 16);
  r.ellipse(8, 9, 6, 3.4, P.q1); r.ellipse(7, 8.5, 4, 2, P.q2); r.set(5, 8, P.t3); r.set(6, 8, P.t2); r.set(10, 10, P.t2);
  return r;
}
function rubble(seed) {
  const r = new Raster(16, 16);
  const inks = { o: P.out, d: P.s1, m: P.s2, l: P.s3, h: P.s4 };
  A.rock(r, 5, 11, 3, 2.4, inks, seed); A.rock(r, 10.5, 12, 2.5, 2, inks, seed + 1); A.rock(r, 8, 8, 2.2, 1.8, inks, seed + 2);
  r.set(13, 13, P.s3); r.set(2, 14, P.s2);
  return r;
}
function bookshelf() {
  const r = new Raster(16, 32);
  r.rect(1, 2, 14, 28, P.w1); r.rect(2, 3, 12, 26, P.w0);
  const spines = [P.c1, P.t1, P.y1, P.m1, P.c2, P.i1, P.w3, P.t0];
  for (let shelf = 0; shelf < 3; shelf++) {
    const by = 10 + shelf * 9;
    r.hline(1, 14, by, P.w2); r.hline(1, 14, by + 1, P.w0);
    let x = 2; let k = shelf * 3;
    while (x < 14) { const w = 1 + ((k * 7) % 3 === 0 ? 1 : 0), h = 5 + (k % 3); if (x + w > 14) break; r.rect(x, by - h, w, h, spines[k % spines.length]); r.set(x, by - h, P.y3); x += w + (k % 4 === 0 ? 1 : 0); k++; }
  }
  r.hline(1, 14, 2, P.w3);
  r.outline(P.out);
  return r;
}
function altar() {
  const r = new Raster(32, 16);
  r.rect(2, 4, 28, 4, P.s4); r.hline(2, 29, 4, P.s5); r.hline(2, 29, 7, P.s2);
  r.rect(4, 8, 24, 6, P.s3); r.vline(4, 8, 13, P.s4); r.vline(27, 8, 13, P.s1);
  for (const x of [9, 22]) r.rect(x, 9, 2, 4, P.s2);
  r.rect(13, 2, 6, 2, P.c1); r.hline(13, 18, 2, P.c2); r.set(15, 1, P.y2); r.set(16, 1, P.y3);
  r.outline(P.out);
  return r;
}

function build() {
  const pack = new Pack({ id: 'stonehollow', name: 'Stonehollow Dungeon Tileset', code: 'SH', palette: P });
  pack.sheet('terrain', { name: 'Stonehollow terrain', cols: 16 });
  pack.sheet('props', { name: 'Stonehollow props', cols: 16 });

  const floors = [];
  for (const k of ['plain', 'cracked', 'mossy', 'pebbles', 'worn', 'rune']) floors.push(pack.add('terrain', { id: `sh-floor-${k}`, name: `Floor (${k})`, category: 'Floors', frames: [floorVariant(k)], meta: { ground: 'floor' } }).id);
  floors.push(pack.add('terrain', { id: 'sh-pit', name: 'Pit', category: 'Floors', frames: [Raster.from(16, 16, () => P.void)], meta: { ground: 'pit' } }).id);
  pack.extra.ground = [{ id: 'floor', name: 'Flagstones', assets: floors.slice(0, 6) }, { id: 'pit', name: 'Pit', assets: [floors[6]] }];
  K.addBlobSet(pack, { sheet: 'terrain', id: 'ledge', name: 'Floor ledge', category: 'Floor ledge (autotile)', shape: ledgeShape, painter: ledgePaint, emptyInk: P.void, order: 0, color: '#6f6572' });
  K.addBlobSet(pack, { sheet: 'terrain', id: 'rug', name: 'Rug', category: 'Rug (autotile)', shape: rugShape, painter: rugPaint, order: 1, color: '#8e3047' });
  K.addBlobSet(pack, { sheet: 'terrain', id: 'walls', name: 'Walls', category: 'Walls (autotile)', shape: wallShape, painter: wallPaint, order: 5, color: '#5e5c79' });

  const R = 'props';
  pack.add(R, { id: 'sh-door-wood', name: 'Wooden door (opening)', category: 'Doors', frames: [0, 1, 2, 3].map(f => doorOverlay('wood', f)), durations: [600, 90, 90, 600], loop: false, tags: ['animated', 'wall overlay'] });
  pack.add(R, { id: 'sh-door-gate', name: 'Iron gate (rising)', category: 'Doors', frames: [0, 1, 2, 3].map(f => doorOverlay('gate', f)), durations: [600, 110, 110, 600], loop: false, tags: ['animated', 'wall overlay'] });
  pack.add(R, { id: 'sh-door-arch', name: 'Open archway', category: 'Doors', frames: [doorOverlay('arch')], tags: ['wall overlay'] });
  pack.add(R, { id: 'sh-stairs-down', name: 'Stairs down', category: 'Stairs', frames: [stairs('down')] });
  pack.add(R, { id: 'sh-stairs-up', name: 'Stairs up', category: 'Stairs', frames: [stairs('up')] });
  pack.add(R, { id: 'sh-chest-wood', name: 'Wooden chest (opening)', category: 'Chests', frames: [0, 1, 2, 3, 4].map(f => chest(f, false)), durations: [800, 90, 90, 120, 600], loop: false, tags: ['animated'] });
  pack.add(R, { id: 'sh-chest-gilded', name: 'Gilded chest (opening)', category: 'Chests', frames: [0, 1, 2, 3, 4].map(f => chest(f, true)), durations: [800, 90, 90, 120, 600], loop: false, tags: ['animated'] });
  pack.add(R, { id: 'sh-torch-wall', name: 'Wall torch', category: 'Torches & light', frames: [0, 1, 2, 3, 4, 5].map(wallTorch), duration: 110, tags: ['animated', 'wall overlay'] });
  pack.add(R, { id: 'sh-candles', name: 'Candles', category: 'Torches & light', frames: [0, 1, 2, 3].map(candles), duration: 160, tags: ['animated'] });
  pack.add(R, { id: 'sh-crystal', name: 'Glow crystal', category: 'Torches & light', frames: [0, 1, 2, 3].map(crystal), duration: 200, tags: ['animated'] });
  pack.add(R, { id: 'sh-spikes', name: 'Spike trap', category: 'Traps', frames: [0, 1, 2, 3, 4].map(spikes), durations: [700, 80, 80, 650, 110], tags: ['animated'] });
  pack.add(R, { id: 'sh-plate-up', name: 'Pressure plate (up)', category: 'Traps', frames: [plate(false, false)] });
  pack.add(R, { id: 'sh-plate-down', name: 'Pressure plate (pressed)', category: 'Traps', frames: [plate(true, false)] });
  pack.add(R, { id: 'sh-rune-plate-up', name: 'Rune plate (up)', category: 'Traps', frames: [plate(false, true)] });
  pack.add(R, { id: 'sh-rune-plate-down', name: 'Rune plate (pressed)', category: 'Traps', frames: [plate(true, true)] });
  pack.add(R, { id: 'sh-lever-off', name: 'Lever (left)', category: 'Traps', frames: [lever(false)] });
  pack.add(R, { id: 'sh-lever-on', name: 'Lever (right)', category: 'Traps', frames: [lever(true)] });
  pack.add(R, { id: 'sh-grate', name: 'Floor grate', category: 'Dressing', frames: [grate()] });
  pack.add(R, { id: 'sh-puddle', name: 'Puddle', category: 'Dressing', frames: [puddle()] });
  pack.add(R, { id: 'sh-rubble-1', name: 'Rubble', category: 'Dressing', frames: [rubble(3)] });
  pack.add(R, { id: 'sh-rubble-2', name: 'Rubble (small)', category: 'Dressing', frames: [rubble(17)] });
  pack.add(R, { id: 'sh-urn', name: 'Urn', category: 'Dressing', frames: [urn(1, false)] });
  pack.add(R, { id: 'sh-urn-tall', name: 'Tall urn', category: 'Dressing', frames: [urn(2, true)] });
  pack.add(R, { id: 'sh-cobweb-left', name: 'Cobweb (left corner)', category: 'Dressing', frames: [cobweb(false)], tags: ['wall overlay'] });
  pack.add(R, { id: 'sh-cobweb-right', name: 'Cobweb (right corner)', category: 'Dressing', frames: [cobweb(true)], tags: ['wall overlay'] });
  pack.add(R, { id: 'sh-banner-crimson', name: 'Banner (crimson)', category: 'Dressing', frames: [banner([P.c0, P.c1, P.c2])], tags: ['wall overlay'] });
  pack.add(R, { id: 'sh-banner-teal', name: 'Banner (teal)', category: 'Dressing', frames: [banner([P.t0, P.t1, P.t2])], tags: ['wall overlay'] });
  pack.add(R, { id: 'sh-chains', name: 'Hanging chains', category: 'Dressing', frames: [chains()], tags: ['wall overlay'] });
  pack.newRow(R);
  pack.add(R, { id: 'sh-brazier', name: 'Brazier', category: 'Torches & light', frames: [0, 1, 2, 3, 4, 5].map(brazier), duration: 110, tags: ['animated'] });
  pack.add(R, { id: 'sh-pillar', name: 'Pillar', category: 'Pillars', frames: [pillar('intact')] });
  pack.add(R, { id: 'sh-pillar-mossy', name: 'Mossy pillar', category: 'Pillars', frames: [pillar('mossy')] });
  pack.add(R, { id: 'sh-pillar-broken', name: 'Broken pillar', category: 'Pillars', frames: [pillar('broken')] });
  pack.add(R, { id: 'sh-bookshelf', name: 'Bookshelf', category: 'Dressing', frames: [bookshelf()] });
  pack.add(R, { id: 'sh-altar', name: 'Stone altar', category: 'Dressing', frames: [altar()] });

  sampleMap(pack);
  return pack;
}

function sampleMap(pack) {
  const W = 30, H = 22;
  const mb = new K.MapBuilder(pack, 'stonehollow-sample', 'Stonehollow halls', W, H);
  const G = K.grids;
  const floor = G.blank(W, H);
  G.rect(floor, W, 2, 3, 11, 8); G.rect(floor, W, 16, 2, 12, 9); G.rect(floor, W, 6, 13, 18, 7); G.rect(floor, W, 12, 6, 5, 3); G.rect(floor, W, 7, 10, 3, 4); G.rect(floor, W, 21, 10, 3, 4);
  const pit = G.blank(W, H); G.rect(pit, W, 12, 15, 5, 3);
  const walk = G.minus(floor, pit);
  const walls = G.blank(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (walk[y * W + x]) continue;
    let near = false;
    for (let dy = -2; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H && walk[yy * W + xx]) near = true; }
    if (near && !pit[y * W + x]) walls[y * W + x] = 1;
  }
  const floors = pack.extra.ground[0].assets;
  mb.fill('Floor', (x, y) => (pit[y * W + x] || !(walk[y * W + x] || walls[y * W + x])) ? 'sh-pit' : floors[hash2(x, y, 1) < 0.7 ? 0 : 1 + Math.floor(hash2(x, y, 2) * 5)]);
  mb.terrain('Floor', 'ledge', G.minus(G.union(walk, walls), pit));
    const rug = G.blank(W, H); G.rect(rug, W, 19, 4, 6, 5);
  mb.terrain('Rug', 'rug', rug);
  mb.terrain('Walls', 'walls', walls);
  const O = (id, x, y) => mb.stamp('Objects', id, x, y);
  O('sh-pillar', 4, 3); O('sh-pillar-mossy', 10, 3); O('sh-pillar-broken', 4, 8); O('sh-brazier', 18, 3); O('sh-brazier', 25, 3);
  O('sh-chest-gilded', 21, 5); O('sh-chest-wood', 3, 9); O('sh-altar', 21, 2);
  O('sh-spikes', 13, 7); O('sh-spikes', 14, 7); O('sh-plate-up', 8, 11); O('sh-rune-plate-down', 22, 11);
  O('sh-stairs-down', 22, 17); O('sh-candles', 7, 18); O('sh-crystal', 18, 18); O('sh-urn', 23, 14); O('sh-urn-tall', 6, 14);
  O('sh-rubble-1', 10, 16); O('sh-puddle', 19, 15); O('sh-grate', 8, 5); O('sh-bookshelf', 27, 4);
  O('sh-lever-off', 11, 13);
  const F = (id, x, y) => mb.stamp('Overlay', id, x, y);
  F('sh-torch-wall', 6, 2); F('sh-torch-wall', 22, 1); F('sh-door-wood', 14, 5); F('sh-banner-crimson', 19, 1); F('sh-banner-teal', 24, 1);
  F('sh-cobweb-left', 2, 2); F('sh-chains', 9, 2); F('sh-torch-wall', 13, 12); F('sh-door-gate', 26, 12);
  mb.done();
}

module.exports = { build, palette: P };
