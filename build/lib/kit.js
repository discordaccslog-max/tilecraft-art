'use strict';
/* Helpers shared by the pack scripts: autotile sets, sample maps, contact sheets. */
const fs = require('fs');
const path = require('path');
const AT = require('../../js/autotile.js');
const { Raster, hash2, mod } = require('./raster.js');
const TR = require('./terrain.js');
const { encodePNG, scaleRGBA } = require('./pack.js');

/* Adds a 47-tile blob set. painter(x, y, q, frame) → ink. Every frame is seam-checked. */
function addBlobSet(pack, o) {
  const frames = o.frames || 1;
  const s = o.shape || TR.shape();
  const byFrame = [];
  for (let f = 0; f < frames; f++) byFrame.push(TR.renderBlob(s, o.painter, f));
  const res = TR.checkBlob(`${pack.id}/${o.id}`, s, o.painter, byFrame, { emptyInk: o.emptyInk || 0 });
  if (res.errors.length) throw new Error('seam check failed:\n  ' + res.errors.join('\n  '));
  if (o.newRow !== false) pack.newRow(o.sheet);
  const ids = [];
  AT.BLOB47.forEach((mask, i) => {
    const id = `${o.prefix || pack.code.toLowerCase()}-${o.id}-${String(i).padStart(2, '0')}`;
    pack.add(o.sheet, {
      id, name: `${o.name} ${i + 1}/47`, category: o.category || o.name,
      frames: byFrame.map(t => t[i]), duration: o.duration, durations: o.durations, loop: o.loop, allowHold: true,
      tags: ['autotile', 'blob47', o.id].concat(o.tags || []), meta: { autotile: { set: o.id, mask } }
    });
    ids.push(id);
  });
  return pack.autotile({ id: o.id, name: o.name, type: 'blob47', sheet: o.sheet, tiles: ids, layer: o.layer || o.name, order: o.order || 0, color: o.color, frames, seamChecks: 47 * frames, comparisons: res.compared, connectsTo: o.connectsTo });
}

function addEdgeSet(pack, o) {
  const frames = o.frames || 1;
  const byFrame = [];
  for (let f = 0; f < frames; f++) byFrame.push(TR.renderEdge(o.painter, f));
  const res = TR.checkEdge(`${pack.id}/${o.id}`, byFrame);
  if (res.errors.length) throw new Error('seam check failed:\n  ' + res.errors.join('\n  '));
  if (o.newRow !== false) pack.newRow(o.sheet);
  const ids = [];
  for (let m = 0; m < 16; m++) {
    const id = `${o.prefix || pack.code.toLowerCase()}-${o.id}-${String(m).padStart(2, '0')}`;
    pack.add(o.sheet, {
      id, name: `${o.name} ${edgeName(m)}`, category: o.category || o.name,
      frames: byFrame.map(t => t[m]), duration: o.duration, durations: o.durations, loop: o.loop,
      tags: ['autotile', 'edge16', o.id], meta: { autotile: { set: o.id, mask: m } }
    });
    ids.push(id);
  }
  return pack.autotile({ id: o.id, name: o.name, type: 'edge16', sheet: o.sheet, tiles: ids, layer: o.layer || o.name, order: o.order || 0, color: o.color, frames, seamChecks: 16 * frames, comparisons: res.compared, connectsTo: o.connectsTo, special: o.special });
}
function edgeName(m) {
  const parts = [];
  if (m & 1) parts.push('N'); if (m & 2) parts.push('E'); if (m & 4) parts.push('S'); if (m & 8) parts.push('W');
  return parts.length ? parts.join('') : 'single';
}

/* Builds sample maps from grids and resolves autotiles exactly as the studio does. */
class MapBuilder {
  constructor(pack, id, name, w, h, variant) {
    Object.assign(this, { pack, id, name, w, h, variant });
    this.layers = [];
  }
  layer(name) {
    let L = this.layers.find(l => l.name === name);
    if (!L) { L = { name, data: new Array(this.w * this.h).fill(0) }; this.layers.push(L); }
    return L;
  }
  ref(assetId, i = 0, j = 0) { const a = this.pack.asset(assetId); return { sheet: a.sheet, tile: this.pack.tileIndex(a, i, j) }; }
  set(layer, x, y, assetId, i = 0, j = 0) { if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; this.layer(layer).data[y * this.w + x] = this.ref(assetId, i, j); }
  fill(layer, pick) { for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) { const id = pick(x, y); if (id) this.set(layer, x, y, id); } }
  stamp(layer, assetId, x, y) {
    const a = this.pack.asset(assetId);
    for (let j = 0; j < a.ch; j++) for (let i = 0; i < a.cw; i++) this.set(layer, x + i, y + j, assetId, i, j);
  }
  terrain(layer, setId, grid) {
    const set = this.pack.autotiles.find(t => t.id === setId);
    if (set.type === 'edge16') return this.edges(layer, setId, grid);
    const get = AT.clampGetter(grid, this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (!grid[y * this.w + x]) continue;
      this.set(layer, x, y, set.tiles[AT.blobIndex(get, x, y)]);
    }
  }
  edges(layer, setId, grid, connect) {
    const set = this.pack.autotiles.find(t => t.id === setId);
    const get = connect || ((x, y) => x >= 0 && y >= 0 && x < this.w && y < this.h && !!grid[y * this.w + x]);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (!grid[y * this.w + x]) continue;
      this.set(layer, x, y, set.tiles[AT.edgeMask(get, x, y)]);
    }
  }
  done() { const m = { id: this.id, name: this.name, w: this.w, h: this.h, layers: this.layers, variant: this.variant }; this.pack.maps.push(m); return m; }
}

/* Simple shapes for building maps. */
const grids = {
  blank: (w, h) => new Uint8Array(w * h),
  blob(w, h, cx, cy, rx, ry, seed, rough = 0.25) {
    const g = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      const n = (hash2(x, y, seed) - 0.5) * rough * 2;
      if (dx * dx + dy * dy < 1 + n) g[y * w + x] = 1;
    }
    return g;
  },
  rect(g, w, x0, y0, rw, rh, v = 1) { for (let y = y0; y < y0 + rh; y++) for (let x = x0; x < x0 + rw; x++) g[y * w + x] = v; return g; },
  union(a, b) { const g = a.slice(); for (let i = 0; i < g.length; i++) g[i] = a[i] || b[i] ? 1 : 0; return g; },
  minus(a, b) { const g = a.slice(); for (let i = 0; i < g.length; i++) if (b[i]) g[i] = 0; return g; },
  /* removes cells that would only produce single-cell slivers */
  clean(g, w, h, passes = 2) {
    for (let p = 0; p < passes; p++) {
      const o = g.slice();
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const at = (i, j) => (i < 0 || j < 0 || i >= w || j >= h) ? o[y * w + x] : o[j * w + i];
        const n = at(x - 1, y) + at(x + 1, y) + at(x, y - 1) + at(x, y + 1);
        if (o[y * w + x] && n <= 1) g[y * w + x] = 0;
        if (!o[y * w + x] && n >= 3) g[y * w + x] = 1;
      }
    }
    return g;
  },
  path(g, w, pts, width = 1) {
    for (let k = 0; k + 1 < pts.length; k++) {
      let [x0, y0] = pts[k]; const [x1, y1] = pts[k + 1];
      while (x0 !== x1 || y0 !== y1) {
        for (let a = 0; a < width; a++) for (let b = 0; b < width; b++) g[(y0 + b) * w + x0 + a] = 1;
        if (x0 !== x1) x0 += Math.sign(x1 - x0); else y0 += Math.sign(y1 - y0);
      }
      for (let a = 0; a < width; a++) for (let b = 0; b < width; b++) g[(y1 + b) * w + x1 + a] = 1;
    }
    return g;
  }
};

/* Contact sheets for visual review: every sheet over a checkerboard at 3×, plus maps at 2×. */
function contactSheets(pack, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const written = [];
  const variants = pack.variantList();
  for (const v of variants.slice(0, pack.reviewVariants || variants.length)) {
    const resolve = pack.resolver(v.id ? v : null);
    for (const s of pack.sheets) {
      const r = pack.sheetRaster(s);
      const k = r.w > 400 ? 2 : 3;
      const rgba = pack.toRGBA(r, resolve);
      const bg = new Uint8Array(rgba.length);
      for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
        const i = (y * r.w + x) * 4;
        const checker = ((x >> 3) + (y >> 3)) & 1 ? 150 : 120;
        const gridLine = (x % s.cellW === 0 || y % s.cellH === 0) ? 18 : 0;
        if (rgba[i + 3]) { bg[i] = rgba[i]; bg[i + 1] = rgba[i + 1]; bg[i + 2] = rgba[i + 2]; }
        else { bg[i] = checker - gridLine; bg[i + 1] = checker - gridLine; bg[i + 2] = checker + 10 - gridLine; }
        bg[i + 3] = 255;
      }
      const file = path.join(outDir, `${pack.id}-${s.id}${v.id ? '-' + v.id : ''}.png`);
      fs.writeFileSync(file, encodePNG(r.w * k, r.h * k, scaleRGBA(r.w, r.h, bg, k)));
      written.push(file);
    }
  }
  for (const m of pack.maps) {
    const v = m.variant ? variants.find(x => x.id === m.variant) : null;
    const r = pack.renderMap(m);
    const rgba = pack.toRGBA(r, pack.resolver(v));
    const file = path.join(outDir, `${pack.id}-map-${m.id}.png`);
    const k = r.w > 600 ? 1 : 2;
    fs.writeFileSync(file, encodePNG(r.w * k, r.h * k, scaleRGBA(r.w, r.h, rgba, k)));
    written.push(file);
  }
  return written;
}

/* Little drawing helpers used by several packs. */
const draw = {
  /* shaded sphere-ish fill: light from top-left. inks = [dark, mid, light, highlight] */
  shadeBlob(r, test, inks, opt = {}) {
    const { cx, cy, rad } = opt;
    for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
      if (!test(x, y)) continue;
      const dx = (x + 0.5 - cx) / rad, dy = (y + 0.5 - cy) / rad;
      const l = -dx * 0.6 - dy * 0.8;
      let c = inks[1];
      if (l > 0.55 && inks[3]) c = inks[3];
      else if (l > 0.15) c = inks[2];
      else if (l < -0.45) c = inks[0];
      r.set(x, y, c);
    }
    return r;
  },
  periodicSet(r, x, y, c) { r.set(mod(x, r.w), mod(y, r.h), c); }
};

/* Picks a ground tile for a cell: mostly plain variants, sometimes a decorated one. */
function pickGround(group, x, y) {
  const plain = group.plain || 1, n = Math.floor(hash2(x, y, 77) * 1e6);
  if (n % 10 < 8 || group.assets.length <= plain) return group.assets[(n >> 4) % plain];
  return group.assets[plain + ((n >> 8) % (group.assets.length - plain))];
}
/* true for pixels in the 2-pixel border band every ground variant shares */
const inBand = (lx, ly) => lx < 2 || lx > 13 || ly < 2 || ly > 13;

module.exports = { pickGround, inBand, addBlobSet, addEdgeSet, MapBuilder, grids, contactSheets, draw, edgeName };
