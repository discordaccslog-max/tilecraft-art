'use strict';
/* Reusable drawing routines. Every routine takes its colours as an `inks` object so the
 * same shapes can be drawn in each pack's own palette. Light always comes from the top left. */
const { Raster, mulberry32, hash2, dither } = require('./raster.js');

const inDiscs = (discs, x, y) => discs.some(([cx, cy, r]) => (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r);

/* Leafy crown made of overlapping clumps. inks: o (outline), c: [darkest..lightest] (5). */
function crown(r, discs, inks, seed, opt = {}) {
  const rng = mulberry32(seed);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [cx, cy, rad] of discs) { x0 = Math.min(x0, cx - rad); y0 = Math.min(y0, cy - rad); x1 = Math.max(x1, cx + rad); y1 = Math.max(y1, cy + rad); }
  const gcx = (x0 + x1) / 2, gcy = (y0 + y1) / 2, gR = Math.max(x1 - x0, y1 - y0) / 2;
  const M = (x, y) => inDiscs(discs, x, y);
  const clumps = [];
  const sp = opt.spacing || 5;
  for (let y = y0 + 1; y <= y1; y += sp * 0.8) {
    let k = 0;
    for (let x = x0 + 1; x <= x1; x += sp) {
      const jx = x + (rng() - 0.5) * 2 + ((Math.round(y) / 4) % 2 ? sp / 2 : 0), jy = y + (rng() - 0.5) * 2;
      if (M(Math.floor(jx), Math.floor(jy))) clumps.push([jx, jy, (opt.clump || 3.4) + rng() * 1.2]);
      k++;
    }
  }
  clumps.sort((a, b) => a[1] - b[1]);
  const W = r.w, H = r.h;
  const tone = new Float32Array(W * H).fill(NaN);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!M(x, y)) continue;
    const gx = (x + 0.5 - gcx) / gR, gy = (y + 0.5 - gcy) / gR;
    tone[y * W + x] = 2 - gx * 0.7 - gy * 1.0;
  }
  for (const [cx, cy, rad] of clumps) {
    for (let y = Math.floor(cy - rad); y <= cy + rad; y++) for (let x = Math.floor(cx - rad); x <= cx + rad; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H || !M(x, y)) continue;
      const dx = (x + 0.5 - cx) / rad, dy = (y + 0.5 - cy) / rad;
      const d = dx * dx + dy * dy;
      if (d > 1) continue;
      const gx = (x + 0.5 - gcx) / gR, gy = (y + 0.5 - gcy) / gR;
      let t = 2 - gx * 0.6 - gy * 0.9 + (-dx * 0.6 - dy * 0.8) * 1.0;
      if (d > 0.62 && dx + dy > 0.35) t -= 1.1;
      tone[y * W + x] = t;
    }
  }
  const c = inks.c;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const t = tone[y * W + x];
    if (Number.isNaN(t)) continue;
    let i = t < 0.9 ? 0 : t < 1.75 ? 1 : t < 2.55 ? 2 : t < 3.35 ? 3 : 4;
    if (i === 4 && !dither(x, y, 0.75)) i = 3;
    r.set(x, y, c[i]);
  }
  if (inks.o) {
    const m = r.clone();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!M(x, y)) continue;
      if (!M(x - 1, y) || !M(x + 1, y) || !M(x, y - 1) || !M(x, y + 1)) r.set(x, y, inks.o);
    }
    void m;
  }
  return { clumps, bbox: { x0, y0, x1, y1 } };
}

/* Vertical trunk with flared roots. inks: o, d, m, l */
function trunk(r, cx, top, bottom, w, inks) {
  const x0 = Math.round(cx - w / 2);
  for (let y = top; y <= bottom; y++) {
    const flare = y >= bottom - 1 ? 1 : 0;
    for (let x = x0 - flare; x < x0 + w + flare; x++) {
      const rel = x - (x0 - flare), ww = w + flare * 2;
      let c = inks.m;
      if (rel === 0 || rel === ww - 1) c = inks.o;
      else if (rel === 1) c = inks.l;
      else if (rel >= ww - 2) c = inks.d;
      r.set(x, y, c);
    }
  }
  r.hline(x0 - 1, x0 + w, bottom + 1, inks.o);
  /* bark marks */
  for (let y = top + 2; y < bottom - 1; y += 3) r.set(x0 + 2 + (y % 2), y, inks.d);
}

function shadow(r, cx, cy, rx, ry, ink) {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
    const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
    if (dx * dx + dy * dy <= 1 && !r.get(x, y)) r.set(x, y, ink);
  }
}

/* Large broadleaf tree: 32×48. */
function broadleaf(inks, seed, opt = {}) {
  const r = new Raster(32, 48);
  const rng = mulberry32(seed);
  shadow(r, 16, 44.5, 9, 2.6, inks.shadow);
  trunk(r, 16, 26, 43, 6, inks.bark);
  const j = () => (rng() - 0.5) * 1.5;
  const discs = [[16 + j(), 15, 11.5], [8.5 + j(), 19, 7], [23.5 + j(), 19, 7], [11 + j(), 8.5, 7], [21 + j(), 8.5, 7], [16, 24, 7]];
  crown(r, discs, inks.leaf, seed + 1, { spacing: 5, clump: 3.6 });
  if (opt.fruit) {
    for (let k = 0; k < 9; k++) {
      const x = 6 + Math.floor(rng() * 20), y = 6 + Math.floor(rng() * 20);
      if (r.get(x, y) && r.get(x, y) !== inks.leaf.o && r.get(x + 1, y + 1) && r.get(x + 1, y + 1) !== inks.leaf.o) {
        r.set(x, y, opt.fruit[0]); r.set(x + 1, y, opt.fruit[0]); r.set(x, y + 1, opt.fruit[1]); r.set(x + 1, y + 1, opt.fruit[0]);
      }
    }
  }
  if (opt.blossom) {
    for (let k = 0; k < 22; k++) {
      const x = 4 + Math.floor(rng() * 24), y = 3 + Math.floor(rng() * 24);
      const v = r.get(x, y);
      if (v && v !== inks.leaf.o && v !== inks.leaf.c[0]) r.set(x, y, k % 3 ? opt.blossom[0] : opt.blossom[1]);
    }
  }
  return r;
}

/* Conifer: 32×48, stacked drooping tiers. */
function conifer(inks, seed) {
  const r = new Raster(32, 48);
  shadow(r, 16, 44.5, 8, 2.5, inks.shadow);
  trunk(r, 16, 36, 43, 4, inks.bark);
  const tiers = [[3, 11, 5], [9, 17, 8], [16, 25, 11], [23, 34, 13.5]];
  const M = (x, y) => tiers.some(([ty, by, hw]) => {
    if (y < ty || y > by) return false;
    const t = (y - ty) / (by - ty);
    const half = 1 + t * hw + Math.sin(x * 1.7) * 0.4 * t;
    return Math.abs(x + 0.5 - 16) <= half;
  });
  const c = inks.leaf.c;
  for (let y = 0; y < 48; y++) for (let x = 0; x < 32; x++) {
    if (!M(x, y)) continue;
    const tier = tiers.find(([ty, by]) => y >= ty && y <= by);
    const t = (y - tier[0]) / (tier[1] - tier[0]);
    const side = (x + 0.5 - 16) / (tier[2] + 1);
    let v = 2.6 - side * 1.3 - t * 1.0;
    if (t > 0.82) v -= 1.0;
    let i = v < 1.0 ? 0 : v < 1.8 ? 1 : v < 2.6 ? 2 : v < 3.3 ? 3 : 4;
    if (i === 4 && !dither(x, y, 0.6)) i = 3;
    r.set(x, y, c[i]);
  }
  for (let y = 0; y < 48; y++) for (let x = 0; x < 32; x++) {
    if (M(x, y) && (!M(x - 1, y) || !M(x + 1, y) || !M(x, y - 1) || !M(x, y + 1))) r.set(x, y, inks.leaf.o);
  }
  void seed;
  return r;
}

/* Small tree 16×32. */
function sapling(inks, seed) {
  const r = new Raster(16, 32);
  shadow(r, 8, 29.5, 5, 1.8, inks.shadow);
  trunk(r, 8, 17, 28, 4, inks.bark);
  crown(r, [[8, 10, 6.5], [4.5, 13, 3.8], [11.5, 13, 3.8], [8, 15, 4]], inks.leaf, seed, { spacing: 4, clump: 2.8 });
  return r;
}

function bush(inks, seed, opt = {}) {
  const r = new Raster(16, 16);
  const rng = mulberry32(seed);
  shadow(r, 8, 14, 6.5, 1.6, inks.shadow);
  crown(r, [[8, 9, 5.8], [4.6, 10.5, 3.6], [11.4, 10.5, 3.6], [8, 6.5, 4]], inks.leaf, seed, { spacing: 4, clump: 2.6 });
  if (opt.dots) {
    let placed = 0;
    for (let k = 0; k < 60 && placed < (opt.count || 6); k++) {
      const x = 3 + Math.floor(rng() * 10), y = 4 + Math.floor(rng() * 9);
      const v = r.get(x, y);
      if (v && v !== inks.leaf.o && r.get(x + 1, y) && r.get(x + 1, y) !== inks.leaf.o && r.get(x - 1, y) !== opt.dots[0]) {
        r.set(x, y, opt.dots[0]); if (opt.dots[1]) r.set(x, y - 1, opt.dots[1]); placed++;
      }
    }
  }
  return r;
}

/* Rock: shaded lump. inks: o, d, m, l, h (highlight) */
function rock(r, cx, cy, rx, ry, inks, seed, opt = {}) {
  const bump = (x, y) => (hash2(Math.floor(x / 2), Math.floor(y / 2), seed) - 0.5) * 0.35;
  const M = (x, y) => {
    const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
    const flat = dy > 0.55 ? (dy - 0.55) * 1.6 : 0;
    return dx * dx + dy * dy + flat + bump(x, y) <= 1;
  };
  for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
    if (!M(x, y)) continue;
    const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
    const l = -dx * 0.55 - dy * 0.95;
    let c = inks.m;
    if (l > 0.5) c = inks.h && dither(x, y, 0.7) ? inks.h : inks.l;
    else if (l > 0.05) c = inks.l;
    else if (l < -0.55) c = inks.d;
    r.set(x, y, c);
  }
  if (opt.crack) {
    let x = Math.round(cx + rx * 0.1), y = Math.round(cy - ry * 0.4);
    for (let k = 0; k < Math.round(ry); k++) { if (M(x, y)) r.set(x, y, inks.d); y++; if (k % 2) x += (seed + k) % 3 === 0 ? -1 : 1; }
  }
  if (opt.moss) {
    for (let y = Math.floor(cy - ry - 1); y <= cy; y++) for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
      if (!M(x, y)) continue;
      if (!M(x, y - 2) || hash2(x, y, seed + 9) < 0.18) r.set(x, y, M(x, y - 1) ? opt.moss[0] : opt.moss[1]);
    }
  }
  for (let y = Math.floor(cy - ry - 2); y <= cy + ry + 2; y++) for (let x = Math.floor(cx - rx - 2); x <= cx + rx + 2; x++) {
    if (M(x, y) && (!M(x - 1, y) || !M(x + 1, y) || !M(x, y - 1) || !M(x, y + 1))) r.set(x, y, inks.o);
  }
  return M;
}

/* Small flower heads. kind: daisy | cup | bell | star | button */
function flower(r, x, y, kind, inks) {
  const { petal, center, stem, leaf, dark } = inks;
  r.vline(x, y + 1, y + 3, stem);
  if (leaf) { r.set(x - 1, y + 3, leaf); r.set(x + 1, y + 2, leaf); }
  switch (kind) {
    case 'daisy': r.set(x - 1, y, petal); r.set(x + 1, y, petal); r.set(x, y - 1, petal); r.set(x, y + 1, petal); r.set(x, y, center); break;
    case 'cup': r.set(x - 1, y - 1, petal); r.set(x + 1, y - 1, petal); r.set(x - 1, y, petal); r.set(x, y, petal); r.set(x + 1, y, petal); r.set(x, y - 1, dark || petal); break;
    case 'bell': r.set(x, y - 1, petal); r.set(x - 1, y, petal); r.set(x, y, petal); r.set(x + 1, y, petal); r.set(x, y + 1, dark || petal); break;
    case 'star': r.set(x - 1, y - 1, petal); r.set(x + 1, y - 1, petal); r.set(x - 1, y + 1, petal); r.set(x + 1, y + 1, petal); r.set(x, y, center); break;
    case 'button': r.set(x, y, petal); r.set(x + 1, y, petal); r.set(x, y - 1, center); break;
  }
}

/* Grass blades for tall grass; lean shifts the tips (used for swaying). */
function blades(r, x, base, height, lean, inks) {
  for (let i = 0; i < height; i++) {
    const t = i / Math.max(1, height - 1);
    const off = Math.round(lean * t * t);
    r.set(x + off, base - i, i === height - 1 ? inks.tip : i > height * 0.5 ? inks.mid : inks.base);
  }
}

module.exports = { crown, trunk, shadow, broadleaf, conifer, sapling, bush, rock, flower, blades, inDiscs };
