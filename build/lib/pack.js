'use strict';
/* Pack: collects assets, lays them out on sheets, checks them and exports every file.
 *
 * Third-party code used by the build (both permissively licensed):
 *   pngjs 7  — PNG encoder/decoder, MIT License, https://github.com/pngjs/pngjs
 *   fflate 0.8 — zip writer/reader, MIT License, https://github.com/101arrowz/fflate
 */
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const fflate = require('fflate');
const AT = require('../../js/autotile.js');
const { Raster } = require('./raster.js');

const ZIP_DATE = new Date('2026-11-08T12:00:00Z');
const slug = s => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function encodePNG(w, h, rgba) {
  const png = new PNG({ width: w, height: h, colorType: 6, inputHasAlpha: true });
  png.data = Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength);
  return PNG.sync.write(png, { colorType: 6, deflateLevel: 9, deflateStrategy: 3, filterType: -1 });
}
function scaleRGBA(w, h, src, k) {
  if (k === 1) return src;
  const out = new Uint8Array(w * k * h * k * 4);
  for (let y = 0; y < h * k; y++) for (let x = 0; x < w * k; x++) {
    const si = ((y / k | 0) * w + (x / k | 0)) * 4, di = (y * w * k + x) * 4;
    out[di] = src[si]; out[di + 1] = src[si + 1]; out[di + 2] = src[si + 2]; out[di + 3] = src[si + 3];
  }
  return out;
}
const xml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

class Pack {
  constructor(o) {
    Object.assign(this, { tile: 16, variants: null, description: '', readme: [], engines: true }, o);
    this.sheets = []; this.assets = []; this.autotiles = []; this.maps = []; this.scenes = {}; this.extra = {};
    this.report = { assetsChecked: 0, redraws: 0, paletteChecks: 0, seamChecks: 0, seamComparisons: 0, animChecks: 0, gridChecks: 0, notes: [] };
  }
  /* ---------- registration ---------- */
  sheet(id, o) {
    const s = Object.assign({ id, name: id, cellW: this.tile, cellH: this.tile, cols: 16, tileset: true, rows: 0, grid: [] }, o);
    s.file = `${this.id}-${id}`;
    this.sheets.push(s);
    return s;
  }
  getSheet(id) { const s = this.sheets.find(s => s.id === id); if (!s) throw new Error('no sheet ' + id); return s; }
  /* make(attempt) must return an asset definition; it is called again with a new
   * attempt number (and therefore a new random seed) whenever a check fails. */
  add(sheetId, make, check) {
    let lastErr = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      const a = typeof make === 'function' ? make(attempt) : make;
      const errs = this.checkAsset(sheetId, a).concat(check ? check(a) || [] : []);
      this.report.assetsChecked++;
      if (!errs.length) { if (attempt) this.report.redraws += attempt; return this.place(sheetId, a); }
      lastErr = errs;
      if (typeof make !== 'function') break;
    }
    throw new Error(`asset ${this.id}/${(typeof make === 'function' ? make(0) : make).id} failed checks: ${lastErr.join('; ')}`);
  }
  checkAsset(sheetId, a) {
    const s = this.getSheet(sheetId), errs = [];
    const f0 = a.frames[0];
    if (!a.id || !a.name || !a.category) errs.push('missing id/name/category');
    if (f0.w % s.cellW || f0.h % s.cellH) errs.push(`size ${f0.w}x${f0.h} is not on the ${s.cellW}x${s.cellH} grid`);
    this.report.gridChecks++;
    for (const f of a.frames) {
      if (f.w !== f0.w || f.h !== f0.h) errs.push('frame sizes differ');
      for (const v of f.d) if (v > this.inkCount()) { errs.push('ink outside palette'); break; }
    }
    this.report.paletteChecks++;
    if (!a.frames.some(f => f.count())) errs.push('asset is empty');
    if (a.frames.length > 1) {
      this.report.animChecks++;
      const diffs = [];
      for (let i = 0; i + 1 < a.frames.length; i++) diffs.push(a.frames[i].diff(a.frames[i + 1]));
      if (diffs.some(d => d === 0) && !a.allowHold) errs.push('two consecutive frames are identical');
      const loopMode = a.loop === false ? (a.oneShot || 'hold') : 'loop';
      if (loopMode === 'loop') {
        const back = a.frames[a.frames.length - 1].diff(a.frames[0]);
        const lim = Math.max(...diffs) * 1.6 + 4;
        if (back > lim) errs.push(`loop seam jump ${back} px > ${Math.round(lim)}`);
      } else if (loopMode === 'fade') {
        const maxC = Math.max(...a.frames.map(f => f.count()));
        if (a.frames[a.frames.length - 1].count() > maxC * 0.35) errs.push('one-shot effect does not fade out');
      }
      if (a.anchor === 'feet') {
        const base = a.frames.map(f => f.bbox().y1);
        if (new Set(base).size > 1) errs.push('feet baseline moves between frames: ' + base.join(','));
        const cx = a.frames.map(f => { const b = f.bbox(); return (b.x0 + b.x1) / 2; });
        if (Math.max(...cx) - Math.min(...cx) > 2.5) errs.push('horizontal drift between frames');
      }
    }
    return errs;
  }
  inkCount() { return this.palette.size; }
  place(sheetId, a) {
    const s = this.getSheet(sheetId);
    const cw = a.frames[0].w / s.cellW, ch = a.frames[0].h / s.cellH;
    const stripW = cw * a.frames.length;
    if (stripW > s.cols) throw new Error(`asset ${a.id} (${stripW} cells wide) does not fit sheet ${s.id}`);
    let pos = a.at;
    const free = (c, r) => { for (let j = 0; j < ch; j++) for (let i = 0; i < stripW; i++) if ((s.grid[r + j] || [])[c + i]) return false; return c + stripW <= s.cols; };
    if (!pos) {
      outer: for (let r = s.cursorRow || 0; ; r++) for (let c = 0; c + stripW <= s.cols; c++) if (free(c, r)) { pos = [c, r]; break outer; }
    } else if (!free(pos[0], pos[1])) throw new Error(`asset ${a.id} overlaps another asset`);
    for (let j = 0; j < ch; j++) { s.grid[pos[1] + j] = s.grid[pos[1] + j] || []; for (let i = 0; i < stripW; i++) s.grid[pos[1] + j][pos[0] + i] = a.id; }
    s.rows = Math.max(s.rows, pos[1] + ch);
    if (this.assets.some(o => o.id === a.id)) throw new Error('duplicate asset id ' + a.id);
    const durations = a.frames.map((_, i) => Array.isArray(a.durations) ? a.durations[i] : (a.duration || 120));
    const rec = Object.assign({}, a, { sheet: sheetId, col: pos[0], row: pos[1], cw, ch, durations });
    this.assets.push(rec);
    return rec;
  }
  /* Sheet rows can be grouped: the next assets start on a fresh row. */
  newRow(sheetId) { const s = this.getSheet(sheetId); s.cursorRow = s.rows; }
  autotile(def) { this.autotiles.push(def); this.report.seamChecks += def.seamChecks || 0; this.report.seamComparisons += def.comparisons || 0; return def; }
  asset(id) { const a = this.assets.find(a => a.id === id); if (!a) throw new Error('no asset ' + id); return a; }
  tileIndex(a, i = 0, j = 0) { const s = this.getSheet(a.sheet); return (a.row + j) * s.cols + a.col + i; }

  /* ---------- colour resolution ---------- */
  variantList() { return this.variants || [{ id: null, name: 'Default' }]; }
  resolver(variant) {
    const cache = [[0, 0, 0, 0]];
    for (let i = 1; i <= this.palette.size; i++) {
      const name = this.palette.entries[i - 1].name;
      let hex = this.palette.entries[i - 1].hex;
      if (variant && variant.map) { hex = variant.map[name]; if (!hex) throw new Error(`variant ${variant.id} has no colour for ${name}`); }
      cache.push([parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16), 255]);
    }
    return id => cache[id];
  }
  masterPalette() {
    const seen = new Map();
    for (const v of this.variantList()) {
      for (let i = 1; i <= this.palette.size; i++) {
        const name = this.palette.entries[i - 1].name;
        const hex = (v.map ? v.map[name] : this.palette.entries[i - 1].hex).toLowerCase();
        if (!seen.has(hex)) seen.set(hex, v.map ? (this.colorNames && this.colorNames[hex]) || name : name);
      }
    }
    return [...seen.entries()].map(([hex, name]) => ({ hex, name }));
  }
  toRGBA(r, resolve) {
    const out = new Uint8Array(r.w * r.h * 4);
    for (let i = 0; i < r.d.length; i++) { const c = resolve(r.d[i]); out[i * 4] = c[0]; out[i * 4 + 1] = c[1]; out[i * 4 + 2] = c[2]; out[i * 4 + 3] = c[3]; }
    return out;
  }
  checkRGBA(rgba, label, allowed) {
    this.report.paletteChecks++;
    for (let i = 0; i < rgba.length; i += 4) {
      const a = rgba[i + 3];
      if (a === 0) continue;
      if (a !== 255) throw new Error(`${label}: semi-transparent pixel`);
      const hex = '#' + [rgba[i], rgba[i + 1], rgba[i + 2]].map(v => v.toString(16).padStart(2, '0')).join('');
      if (!allowed.has(hex)) throw new Error(`${label}: colour ${hex} is not in the palette`);
    }
  }

  /* ---------- rasters ---------- */
  sheetRaster(s) {
    const r = new Raster(s.cols * s.cellW, Math.max(1, s.rows) * s.cellH);
    for (const a of this.assets.filter(a => a.sheet === s.id))
      a.frames.forEach((f, i) => r.blit(f, (a.col + i * a.cw) * s.cellW, a.row * s.cellH));
    /* grid check: every pixel lies inside the cells its asset owns */
    this.report.gridChecks++;
    r.each((x, y, v) => {
      if (!v) return;
      const owner = (s.grid[(y / s.cellH) | 0] || [])[(x / s.cellW) | 0];
      if (!owner) throw new Error(`${s.id}: stray pixel at ${x},${y}`);
    });
    return r;
  }
  stripRaster(a) {
    const f0 = a.frames[0];
    const r = new Raster(f0.w * a.frames.length, f0.h);
    a.frames.forEach((f, i) => r.blit(f, i * f0.w, 0));
    return r;
  }
  sheetFile(s, v) { return `sheets/1x/${s.file}${v && v.id ? '-' + v.id : ''}.png`; }

  /* ---------- statistics for the product pages ---------- */
  stats() {
    const nv = this.variantList().length;
    const cats = {};
    let frames = 0, animated = 0;
    const anims = [];
    for (const a of this.assets) {
      const c = cats[a.category] || (cats[a.category] = { assets: 0, frames: 0, animated: 0 });
      c.assets++; c.frames += a.frames.length; frames += a.frames.length;
      if (a.frames.length > 1) {
        c.animated++; animated++;
        anims.push({ id: a.id, name: a.name, category: a.category, frames: a.frames.length, durations: a.durations, loop: a.loop !== false, size: `${a.frames[0].w}×${a.frames[0].h}` });
      }
    }
    const sizes = {};
    for (const a of this.assets) { const k = `${a.frames[0].w}×${a.frames[0].h}`; sizes[k] = (sizes[k] || 0) + 1; }
    return {
      assets: this.assets.length, frames, animated, variants: nv,
      assetFiles: this.assets.length * nv, categories: cats, animations: anims, sizes,
      autotiles: this.autotiles.map(t => ({ id: t.id, name: t.name, type: t.type, tiles: t.tiles.length, frames: t.frames || 1 })),
      sheets: this.sheets.map(s => ({ id: s.id, name: s.name, width: s.cols * s.cellW, height: s.rows * s.cellH, cellW: s.cellW, cellH: s.cellH })),
      maps: this.maps.map(m => ({ id: m.id, name: m.name, w: m.w, h: m.h })),
      palette: this.masterPalette().length
    };
  }

  /* ---------- metadata ---------- */
  metadata() {
    return {
      id: this.id, name: this.name, code: this.code, version: '1.0.0', tileSize: this.tile,
      generator: 'Tilecraft Art build script — every pixel drawn in code',
      palette: this.masterPalette(),
      inks: this.variants ? this.palette.entries.map(e => e.name) : undefined,
      variants: this.variants ? this.variants.map(v => ({ id: v.id, name: v.name, colors: this.palette.entries.map(e => v.map[e.name]) })) : undefined,
      sheets: this.sheets.map(s => ({
        id: s.id, name: s.name, file: `sheets/1x/${s.file}${this.variants ? '-{variant}' : ''}.png`,
        width: s.cols * s.cellW, height: s.rows * s.cellH, cellWidth: s.cellW, cellHeight: s.cellH, columns: s.cols,
        tileset: s.tileset, tiled: s.tileset ? `tiled/${s.file}${this.variants ? '-{variant}' : ''}.tsx` : undefined
      })),
      assets: this.assets.map(a => {
        const s = this.getSheet(a.sheet);
        const o = {
          id: a.id, name: a.name, category: a.category, sheet: a.sheet,
          x: a.col * s.cellW, y: a.row * s.cellH, w: a.frames[0].w, h: a.frames[0].h,
          file: `assets/1x/${slug(a.category)}/${a.id}${this.variants ? '-{variant}' : ''}.png`
        };
        if (s.tileset) o.tile = this.tileIndex(a);
        if (a.frames.length > 1) {
          o.frames = a.frames.map((f, i) => ({ x: (a.col + i * a.cw) * s.cellW, y: a.row * s.cellH, duration: a.durations[i] }));
          o.loop = a.loop !== false;
        }
        if (a.tags) o.tags = a.tags;
        if (a.meta) Object.assign(o, a.meta);
        return o;
      }),
      autotile: this.autotiles.map(t => {
        const o = { id: t.id, name: t.name, type: t.type, sheet: t.sheet, layer: t.layer, order: t.order, tiles: t.tiles.map(id => this.asset(id).tile ?? this.tileIndex(this.asset(id))) };
        o.assets = t.tiles;
        if (t.type === 'blob47') o.masks = AT.BLOB47.slice();
        if (t.connectsTo) o.connectsTo = t.connectsTo;
        if (t.special) o.special = t.special;
        return o;
      }),
      maps: this.maps.map(m => ({ id: m.id, name: m.name, width: m.w, height: m.h, file: `tiled/${m.id}.tmx`, image: `maps/${m.id}.png`, variant: m.variant || undefined })),
      playground: this.playground || undefined,
      characters: this.characters || undefined,
      extra: Object.keys(this.extra).length ? this.extra : undefined
    };
  }

  /* ---------- Tiled ---------- */
  tsx(s, v) {
    const tiles = this.assets.filter(a => a.sheet === s.id);
    const lines = [];
    const W = s.cols * s.cellW, H = s.rows * s.cellH;
    lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    lines.push(`<tileset version="1.10" tiledversion="1.11.0" name="${xml(s.name + (v && v.id ? ' (' + v.name + ')' : ''))}" tilewidth="${s.cellW}" tileheight="${s.cellH}" tilecount="${s.cols * s.rows}" columns="${s.cols}">`);
    lines.push(` <image source="../${this.sheetFile(s, v)}" width="${W}" height="${H}"/>`);
    const tileEls = new Map();
    const el = id => { if (!tileEls.has(id)) tileEls.set(id, { attrs: '', anim: null }); return tileEls.get(id); };
    for (const a of tiles) {
      if (a.frames.length > 1) {
        for (let j = 0; j < a.ch; j++) for (let i = 0; i < a.cw; i++) {
          const base = (a.row + j) * s.cols + a.col + i;
          el(base).anim = a.frames.map((_, f) => `<frame tileid="${base + f * a.cw}" duration="${a.durations[f]}"/>`).join('');
        }
      }
    }
    for (const t of this.autotiles.filter(t => t.sheet === s.id && t.type === 'blob47')) {
      const islandTile = this.tileIndex(this.asset(t.tiles[0]));
      el(islandTile).attrs = ' probability="0"';
    }
    [...tileEls.keys()].sort((a, b) => a - b).forEach(id => {
      const e = tileEls.get(id);
      if (e.anim) lines.push(` <tile id="${id}"${e.attrs}><animation>${e.anim}</animation></tile>`);
      else lines.push(` <tile id="${id}"${e.attrs}/>`);
    });
    const sets = this.autotiles.filter(t => t.sheet === s.id);
    if (sets.length) {
      lines.push(' <wangsets>');
      for (const t of sets) {
        const isBlob = t.type === 'blob47';
        const full = isBlob ? this.tileIndex(this.asset(t.tiles[t.tiles.length - 1])) : this.tileIndex(this.asset(t.tiles[15]));
        lines.push(`  <wangset name="${xml(t.name)}" type="${isBlob ? 'mixed' : 'edge'}" tile="${full}">`);
        lines.push(`   <wangcolor name="${xml(t.name)}" color="${t.color || '#30c0b0'}" tile="${full}" probability="1"/>`);
        lines.push(`   <wangcolor name="Surroundings" color="#404060" tile="-1" probability="1"/>`);
        t.tiles.forEach((id, i) => {
          const wid = isBlob ? AT.blobWangId(AT.BLOB47[i]) : AT.edgeWangId(i);
          lines.push(`   <wangtile tileid="${this.tileIndex(this.asset(id))}" wangid="${wid.join(',')}"/>`);
        });
        lines.push('  </wangset>');
      }
      lines.push(' </wangsets>');
    }
    lines.push('</tileset>');
    return lines.join('\n') + '\n';
  }
  /* map layers hold {sheet, tile} refs (or 0). */
  tmx(m) {
    const v = m.variant ? this.variantList().find(x => x.id === m.variant) : null;
    const used = this.sheets.filter(s => s.tileset);
    let gid = 1; const first = {};
    for (const s of used) { first[s.id] = gid; gid += s.cols * s.rows; }
    const lines = ['<?xml version="1.0" encoding="UTF-8"?>',
      `<map version="1.10" tiledversion="1.11.0" orientation="orthogonal" renderorder="right-down" width="${m.w}" height="${m.h}" tilewidth="${this.tile}" tileheight="${this.tile}" infinite="0" nextlayerid="${m.layers.length + 1}" nextobjectid="1">`];
    for (const s of used) lines.push(` <tileset firstgid="${first[s.id]}" source="${s.file}${v ? '-' + v.id : ''}.tsx"/>`);
    m.layers.forEach((L, li) => {
      lines.push(` <layer id="${li + 1}" name="${xml(L.name)}" width="${m.w}" height="${m.h}">`);
      lines.push('  <data encoding="csv">');
      const rows = [];
      for (let y = 0; y < m.h; y++) {
        const r = [];
        for (let x = 0; x < m.w; x++) { const c = L.data[y * m.w + x]; r.push(c ? first[c.sheet] + c.tile : 0); }
        rows.push(r.join(','));
      }
      lines.push(rows.join(',\n'));
      lines.push('</data>');
      lines.push(' </layer>');
    });
    lines.push('</map>');
    return lines.join('\n') + '\n';
  }
  renderMap(m, frame = 0) {
    const rasters = {};
    for (const s of this.sheets.filter(s => s.tileset)) rasters[s.id] = this.sheetRaster(s);
    const out = new Raster(m.w * this.tile, m.h * this.tile);
    const T = this.tile;
    for (const L of m.layers) for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      const c = L.data[y * m.w + x];
      if (!c) continue;
      const s = this.getSheet(c.sheet);
      let tile = c.tile;
      if (frame) {
        const a = this.assets.find(a => a.sheet === s.id && a.frames.length > 1 && tile >= a.row * s.cols + a.col && (tile - a.row * s.cols - a.col) < a.cw);
        if (a) tile += (frame % a.frames.length) * a.cw;
      }
      const sx = (tile % s.cols) * T, sy = Math.floor(tile / s.cols) * T;
      out.blit(rasters[s.id].crop(sx, sy, T, T), x * T, y * T);
    }
    return out;
  }

  /* ---------- export ---------- */
  exportAll(siteRoot, texts) {
    const files = {};
    const root = `tilecraft-${this.id}/`;
    const siteDir = path.join(siteRoot, 'assets', 'packs', this.id);
    fs.mkdirSync(path.join(siteDir, 'sheets', '1x'), { recursive: true });
    const allowed = new Set(this.masterPalette().map(p => p.hex));
    const sheetCache = {};
    for (const s of this.sheets) sheetCache[s.id] = this.sheetRaster(s);
    for (const v of this.variantList()) {
      const resolve = this.resolver(v.id ? v : null);
      for (const s of this.sheets) {
        const r = sheetCache[s.id];
        const rgba = this.toRGBA(r, resolve);
        this.checkRGBA(rgba, `${this.id}/${s.id}`, allowed);
        for (const k of [1, 2, 4]) {
          const png = encodePNG(r.w * k, r.h * k, scaleRGBA(r.w, r.h, rgba, k));
          const rel = this.sheetFile(s, v).replace('/1x/', `/${k}x/`);
          files[root + rel] = png;
          if (k === 1) fs.writeFileSync(path.join(siteDir, rel), png);
        }
        if (s.tileset) files[root + `tiled/${s.file}${v.id ? '-' + v.id : ''}.tsx`] = Buffer.from(this.tsx(s, v.id ? v : null));
      }
      for (const a of this.assets) {
        const r = this.stripRaster(a);
        const rgba = this.toRGBA(r, resolve);
        for (const k of [1, 2, 4]) {
          files[root + `assets/${k}x/${slug(a.category)}/${a.id}${v.id ? '-' + v.id : ''}.png`] = encodePNG(r.w * k, r.h * k, scaleRGBA(r.w, r.h, rgba, k));
        }
      }
    }
    for (const m of this.maps) {
      files[root + `tiled/${m.id}.tmx`] = Buffer.from(this.tmx(m));
      const v = m.variant ? this.variantList().find(x => x.id === m.variant) : null;
      const r = this.renderMap(m);
      const rgba = this.toRGBA(r, this.resolver(v));
      this.checkRGBA(rgba, `${this.id}/map ${m.id}`, allowed);
      files[root + `maps/${m.id}.png`] = encodePNG(r.w, r.h, rgba);
      files[root + `maps/${m.id}@2x.png`] = encodePNG(r.w * 2, r.h * 2, scaleRGBA(r.w, r.h, rgba, 2));
      fs.mkdirSync(path.join(siteDir, 'maps'), { recursive: true });
      fs.writeFileSync(path.join(siteDir, 'maps', `${m.id}.png`), files[root + `maps/${m.id}.png`]);
    }
    const meta = this.metadata();
    const metaJson = JSON.stringify(meta, null, 1);
    files[root + `metadata/${this.id}.json`] = Buffer.from(metaJson);
    fs.writeFileSync(path.join(siteDir, 'meta.json'), JSON.stringify(meta));
    const pal = this.masterPalette();
    files[root + `palette/${this.id}.hex`] = Buffer.from(pal.map(p => p.hex.slice(1)).join('\n') + '\n');
    files[root + `palette/${this.id}.gpl`] = Buffer.from(gpl(this.name, pal));
    if (this.variants) for (const v of this.variants) {
      const vp = [...new Set(this.palette.entries.map(e => v.map[e.name].toLowerCase()))].map(hex => ({ hex, name: (this.colorNames && this.colorNames[hex]) || hex }));
      files[root + `palette/${this.id}-${v.id}.hex`] = Buffer.from(vp.map(p => p.hex.slice(1)).join('\n') + '\n');
      files[root + `palette/${this.id}-${v.id}.gpl`] = Buffer.from(gpl(`${this.name} — ${v.name}`, vp));
    }
    if (this.characters) for (const L of this.characters.layers) {
      const s = this.getSheet(L.sheet), r = new Raster(96, 128);
      const sheetR = sheetCache[s.id];
      r.blit(sheetR.crop(L.x, L.y, 96, 128), 0, 0);
      const rgba = this.toRGBA(r, this.resolver(null));
      for (const k of [1, 2, 4]) files[root + `layers/${k}x/${L.category}/${L.id}.png`] = encodePNG(96 * k, 128 * k, scaleRGBA(96, 128, rgba, k));
    }
    files[root + 'LICENSE.txt'] = Buffer.from(texts.license);
    files[root + 'README.txt'] = Buffer.from(texts.readme(this, meta, Object.keys(files).map(f => f.slice(root.length))));
    const zipInput = {};
    for (const [k, v] of Object.entries(files)) zipInput[k] = [new Uint8Array(v), { mtime: ZIP_DATE, level: k.endsWith('.png') ? 0 : 9 }];
    const zip = fflate.zipSync(zipInput, { mtime: ZIP_DATE });
    const zipName = `tilecraft-${this.id}.zip`;
    fs.writeFileSync(path.join(siteDir, zipName), zip);
    return { zipName, zipSize: zip.length, fileCount: Object.keys(files).length, files: Object.keys(files), meta };
  }
}

function gpl(name, pal) {
  const lines = ['GIMP Palette', `Name: ${name}`, 'Columns: 8', '#'];
  for (const p of pal) {
    const r = parseInt(p.hex.slice(1, 3), 16), g = parseInt(p.hex.slice(3, 5), 16), b = parseInt(p.hex.slice(5, 7), 16);
    lines.push(`${String(r).padStart(3)} ${String(g).padStart(3)} ${String(b).padStart(3)}\t${p.name}`);
  }
  return lines.join('\n') + '\n';
}

module.exports = { Pack, encodePNG, scaleRGBA, slug, gpl };
