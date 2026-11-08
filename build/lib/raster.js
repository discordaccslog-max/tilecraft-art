'use strict';
/* Indexed-colour raster used to draw every asset pixel by pixel.
 * Each pixel stores an ink id (0 = transparent). Ink ids are resolved to
 * colours only at export time, which is what makes palette swaps possible. */

class Raster {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.d = new Uint8Array(w * h);
  }
  static from(w, h, fn) {
    const r = new Raster(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) r.d[y * w + x] = fn(x, y) || 0;
    return r;
  }
  inb(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  get(x, y) { x |= 0; y |= 0; return this.inb(x, y) ? this.d[y * this.w + x] : 0; }
  set(x, y, c) { x |= 0; y |= 0; if (this.inb(x, y)) this.d[y * this.w + x] = c; }
  px(x, y, c) { if (c) this.set(x, y, c); return this; }
  clear(x, y) { this.set(x, y, 0); return this; }
  clone() { const r = new Raster(this.w, this.h); r.d.set(this.d); return r; }
  fill(c) { this.d.fill(c); return this; }

  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c);
    return this;
  }
  box(x, y, w, h, c) {
    for (let i = 0; i < w; i++) { this.px(x + i, y, c); this.px(x + i, y + h - 1, c); }
    for (let j = 0; j < h; j++) { this.px(x, y + j, c); this.px(x + w - 1, y + j, c); }
    return this;
  }
  hline(x0, x1, y, c) { if (x1 < x0) [x0, x1] = [x1, x0]; for (let x = x0; x <= x1; x++) this.px(x, y, c); return this; }
  vline(x, y0, y1, c) { if (y1 < y0) [y0, y1] = [y1, y0]; for (let y = y0; y <= y1; y++) this.px(x, y, c); return this; }
  line(x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.px(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
    return this;
  }
  /* Filled ellipse using pixel-centre sampling. cx/cy may be fractional. */
  ellipse(cx, cy, rx, ry, c) {
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
      for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.px(x, y, c);
      }
    return this;
  }
  disc(cx, cy, r, c) { return this.ellipse(cx, cy, r, r, c); }
  ring(cx, cy, r, c, t = 1) {
    for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++)
      for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d <= r && d > r - t) this.px(x, y, c);
      }
    return this;
  }
  poly(points, c) {
    let minY = Infinity, maxY = -Infinity;
    for (const [, y] of points) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const py = y + 0.5; const xs = [];
      for (let i = 0; i < points.length; i++) {
        const [x0, y0] = points[i], [x1, y1] = points[(i + 1) % points.length];
        if ((y0 <= py && y1 > py) || (y1 <= py && y0 > py)) xs.push(x0 + (py - y0) / (y1 - y0) * (x1 - x0));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2)
        for (let x = Math.ceil(xs[k] - 0.5); x <= Math.floor(xs[k + 1] - 0.5); x++) this.px(x, y, c);
    }
    return this;
  }
  /* Draws an ASCII pattern. key maps characters to inks; '.' and ' ' are skipped. */
  pattern(x, y, rows, key, flip = false) {
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch === '.' || ch === ' ') continue;
        const c = typeof key === 'function' ? key(ch) : key[ch];
        if (c === undefined) throw new Error('pattern: no ink for "' + ch + '"');
        this.px(flip ? x + row.length - 1 - i : x + i, y + j, c);
      }
    });
    return this;
  }
  blit(src, dx, dy, opt = {}) {
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
      const sx = opt.flipX ? src.w - 1 - x : x;
      const sy = opt.flipY ? src.h - 1 - y : y;
      let c = src.d[sy * src.w + sx];
      if (!c) continue;
      if (opt.map) c = opt.map[c] !== undefined ? opt.map[c] : c;
      if (c) this.set(dx + x, dy + y, c);
    }
    return this;
  }
  crop(x, y, w, h) {
    const r = new Raster(w, h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) r.d[j * w + i] = this.get(x + i, y + j);
    return r;
  }
  flipX() {
    const r = new Raster(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) r.d[y * this.w + x] = this.d[y * this.w + this.w - 1 - x];
    return r;
  }
  shift(dx, dy) { const r = new Raster(this.w, this.h); r.blit(this, dx, dy); return r; }
  replace(from, to) { for (let i = 0; i < this.d.length; i++) if (this.d[i] === from) this.d[i] = to; return this; }
  remap(map) { for (let i = 0; i < this.d.length; i++) { const v = map[this.d[i]]; if (v !== undefined) this.d[i] = v; } return this; }
  /* Adds an outline of ink c around every opaque pixel (4-neighbour, or 8 with diag). */
  outline(c, diag = false) {
    const src = this.clone();
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (src.get(x, y)) continue;
      let n = src.get(x - 1, y) || src.get(x + 1, y) || src.get(x, y - 1) || src.get(x, y + 1);
      if (!n && diag) n = src.get(x - 1, y - 1) || src.get(x + 1, y - 1) || src.get(x - 1, y + 1) || src.get(x + 1, y + 1);
      if (n) this.set(x, y, c);
    }
    return this;
  }
  /* Recolours the opaque pixels that sit on the shape's edge facing a direction. */
  edgeShade(dx, dy, c, onlyInks) {
    const src = this.clone();
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const v = src.get(x, y);
      if (!v || (onlyInks && !onlyInks.includes(v))) continue;
      if (!src.get(x + dx, y + dy)) this.set(x, y, c);
    }
    return this;
  }
  each(fn) { for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) fn(x, y, this.d[y * this.w + x]); }
  count() { let n = 0; for (const v of this.d) if (v) n++; return n; }
  bbox() {
    let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
    this.each((x, y, v) => { if (v) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } });
    return x1 < 0 ? null : { x0, y0, x1, y1 };
  }
  equals(o) { if (o.w !== this.w || o.h !== this.h) return false; for (let i = 0; i < this.d.length; i++) if (this.d[i] !== o.d[i]) return false; return true; }
  diff(o) { let n = 0; for (let i = 0; i < this.d.length; i++) if (this.d[i] !== o.d[i]) n++; return n; }
}

/* ---- deterministic randomness ---- */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash2(x, y, seed = 0) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function strSeed(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
const mod = (a, n) => ((a % n) + n) % n;
/* Periodic value noise: wraps every `period` pixels so textures tile seamlessly. */
function pnoise(x, y, cell, period, seed) {
  const cells = Math.max(1, Math.round(period / cell));
  const fx = x / cell, fy = y / cell;
  const ix = Math.floor(fx), iy = Math.floor(fy);
  const tx = fx - ix, ty = fy - iy;
  const s = t => t * t * (3 - 2 * t);
  const v = (i, j) => hash2(mod(i, cells), mod(j, cells), seed);
  const a = v(ix, iy), b = v(ix + 1, iy), c = v(ix, iy + 1), d = v(ix + 1, iy + 1);
  return (a + (b - a) * s(tx)) + ((c + (d - c) * s(tx)) - (a + (b - a) * s(tx))) * s(ty);
}
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/* Ordered dither: true when `level` (0..1) covers this pixel. */
function dither(x, y, level) { return (BAYER4[mod(y, 4) * 4 + mod(x, 4)] + 0.5) / 16 < level; }
/* Periodic 1D wobble used for natural-looking terrain edges. Returns an int in [0, amp]. */
function wobble(t, period, amp, seed) {
  const v = pnoise(t, 0.5, period / 4, period, seed);
  return Math.min(amp, Math.floor(v * (amp + 1)));
}

/* A palette is an ordered list of named colours; names become ink ids starting at 1. */
class Palette {
  constructor(entries) {
    this.entries = entries.map(([name, hex]) => ({ name, hex: hex.toLowerCase() }));
    this.ids = {};
    this.entries.forEach((e, i) => { this.ids[e.name] = i + 1; this[e.name] = i + 1; });
    if (this.entries.length > 254) throw new Error('palette too large');
  }
  hex(id) { return id ? this.entries[id - 1].hex : null; }
  get size() { return this.entries.length; }
  rgba(id) {
    if (!id) return [0, 0, 0, 0];
    const h = this.entries[id - 1].hex;
    return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255];
  }
}

module.exports = { Raster, Palette, mulberry32, hash2, strSeed, pnoise, dither, wobble, mod, BAYER4 };
