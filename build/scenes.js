'use strict';
/* Builds the animated scenes shown on the site (home hero and product vignettes).
 * Every scene references real tiles and sprites from the pack sheets. */
const AT = require('../js/autotile.js');
const { hash2 } = require('./lib/raster.js');
const K = require('./lib/kit.js');
const GEN = require('../studio/atlas-gen.js');

class Scene {
  constructor(packs, w, h, opt = {}) { Object.assign(this, { packs, w, h }); this.tiles = []; this.tileIdx = {}; this.layers = []; this.sprites = []; this.walkers = []; this.sheets = {}; this.opt = opt; }
  sheetKey(pack, sheetId) {
    const s = pack.getSheet(sheetId);
    const key = `${pack.id}:${sheetId}`;
    this.sheets[key] = `assets/packs/${pack.id}/sheets/1x/${s.file}${pack.variants ? '-{variant}' : ''}.png`;
    return key;
  }
  frameList(pack, a, i = 0, j = 0) {
    const s = pack.getSheet(a.sheet);
    return a.frames.map((_, f) => [(a.col + f * a.cw + i) * s.cellW, (a.row + j) * s.cellH, a.durations[f]]);
  }
  tileRef(packId, assetId, i = 0, j = 0) {
    const pack = this.packs[packId], a = pack.asset(assetId);
    const key = `${packId}|${assetId}|${i}|${j}`;
    if (this.tileIdx[key] === undefined) { this.tiles.push({ s: this.sheetKey(pack, a.sheet), f: this.frameList(pack, a, i, j) }); this.tileIdx[key] = this.tiles.length; }
    return this.tileIdx[key];
  }
  layer(n) { while (this.layers.length <= n) this.layers.push(new Array(this.w * this.h).fill(0)); return this.layers[n]; }
  put(n, x, y, packId, assetId, i = 0, j = 0) { if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; this.layer(n)[y * this.w + x] = this.tileRef(packId, assetId, i, j); }
  stamp(n, x, y, packId, assetId) { const a = this.packs[packId].asset(assetId); for (let j = 0; j < a.ch; j++) for (let i = 0; i < a.cw; i++) this.put(n, x + i, y + j, packId, assetId, i, j); }
  fill(n, packId, pick) { for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) { const id = pick(x, y); if (id) this.put(n, x, y, packId, id); } }
  terrain(n, packId, setId, grid) {
    const pack = this.packs[packId], set = pack.autotiles.find(t => t.id === setId);
    const get = set.type === 'blob47' ? AT.clampGetter(grid, this.w, this.h) : (x, y) => x >= 0 && y >= 0 && x < this.w && y < this.h && !!grid[y * this.w + x];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (grid[y * this.w + x]) this.put(n, x, y, packId, set.tiles[set.type === 'blob47' ? AT.blobIndex(get, x, y) : AT.edgeMask(get, x, y)]);
  }
  sprite(packId, assetId, px, py, opt = {}) {
    const pack = this.packs[packId];
    const ids = Array.isArray(assetId) ? assetId : [assetId];
    const parts = ids.map(id => { const a = pack.asset(id); return { s: this.sheetKey(pack, a.sheet), w: a.frames[0].w, h: a.frames[0].h, f: this.frameList(pack, a), loop: a.loop !== false }; });
    this.sprites.push(Object.assign({ x: px, y: py, cycle: parts, hold: opt.hold || 0 }, opt.z !== undefined ? { z: opt.z } : {}));
  }
  walker(packId, layerIds, y, opt = {}) {
    const pack = this.packs[packId];
    const layers = layerIds.filter(Boolean).map(id => { const L = pack.characters.layers.find(l => l.id === id); if (!L) throw new Error('no layer ' + id); return [this.sheetKey(pack, L.sheet), L.x, L.y]; });
    this.walkers.push(Object.assign({ layers, y, dir: 'right', speed: 18, x: 0, anim: 'walk' }, opt));
  }
  toJSON() { return { w: this.w, h: this.h, tile: 16, sheets: this.sheets, tiles: this.tiles, layers: this.layers, sprites: this.sprites, walkers: this.walkers, variants: this.opt.variants, variantMs: this.opt.variantMs, glow: this.opt.glow }; }
}

const G = K.grids;
function build(packs) {
  const out = {};
  const P = id => packs[id];
  /* ---------- hero: a wide strip from town to meadow to ruin ---------- */
  {
    const W = 64, H = 14, s = new Scene(packs, W, H, { glow: [] });
    s.fill(0, 'meadowlands', (x, y) => K.pickGround(P('meadowlands').extra.ground[0], x, y));
    const path = G.path(G.blank(W, H), W, [[0, 10], [63, 10]], 2);
    const cob = G.rect(G.blank(W, H), W, 0, 10, 17, 2);
    s.terrain(1, 'hearthvale', 'cobble', cob);
    s.terrain(1, 'meadowlands', 'path', G.minus(path, G.rect(G.blank(W, H), W, 0, 10, 15, 2)));
    const pond = G.clean(G.union(G.blob(W, H, 30, 4.5, 5.5, 3.2, 3), G.blob(W, H, 35, 6, 3.5, 2.5, 4)), W, H);
    s.terrain(2, 'meadowlands', 'water', G.minus(pond, path));
    const dirt = G.clean(G.blob(W, H, 45, 13, 4, 1.6, 6), W, H);
    s.terrain(1, 'meadowlands', 'dirt', G.minus(dirt, path));
    /* town houses */
    const house = (x, y, w, mat, roof, door, win) => {
      const col = i => i === 0 ? 'left' : i === w - 1 ? 'right' : 'mid';
      for (let i = 0; i < w; i++) { ['ridge', 'body', 'eave'].forEach((r, j) => s.put(3, x + i, y + j, 'hearthvale', `hv-roof-${roof}-${r}-${col(i)}`)); s.put(3, x + i, y + 3, 'hearthvale', `hv-wall-${mat}-upper-${col(i)}`); s.put(3, x + i, y + 4, 'hearthvale', `hv-wall-${mat}-lower-${col(i)}`); }
      s.stamp(4, x + door, y + 3, 'hearthvale', 'hv-door-wood');
      win.forEach(([i, k]) => s.stamp(4, x + i, y + 3, 'hearthvale', `hv-window-${k}`));
    };
    house(1, 3, 5, 'plaster', 'clay', 2, [[0, 'shutters'], [4, 'plain-lit']]);
    house(8, 2, 6, 'stone', 'slate', 3, [[1, 'flowers'], [5, 'round-lit']]);
    s.stamp(4, 3, 3, 'hearthvale', 'hv-chimney');
    s.sprite('effects', 'fx-smoke-plume', 3 * 16, 0 * 16 - 4);
    for (const [x, y] of [[0, 8], [14, 8]]) { s.stamp(5, x, y, 'hearthvale', 'hv-lamppost'); s.opt.glow.push([x * 16 + 8, y * 16 + 6]); }
    s.stamp(5, 6, 12, 'hearthvale', 'hv-barrel'); s.stamp(5, 7, 12, 'hearthvale', 'hv-crate'); s.stamp(5, 15, 12, 'hearthvale', 'hv-planter');
    s.opt.glow.push([1 * 16 + 8 + 4 * 16, 6 * 16 + 8], [12 * 16 + 8 + 1 * 16, 5 * 16 + 8]);
    /* meadow */
    const O = (id, x, y) => s.stamp(5, x, y, 'meadowlands', id);
    O('md-tree-oak', 18, 2); O('md-tree-blossom', 22, 6); O('md-tree-pine', 39, 1); O('md-tree-apple', 50, 6); O('md-tree-young', 25, 0);
    O('md-tallgrass-1', 20, 12); O('md-tallgrass-3', 23, 12); O('md-tallgrass-2', 41, 8); O('md-tallgrass-1', 44, 7); O('md-tallgrass-3', 27, 8); O('md-reeds', 26, 4); O('md-reeds', 37, 4);
    O('md-flowers-mix', 21, 9); O('md-flowers-daisy', 32, 12); O('md-flowers-blue', 47, 12); O('md-flowers-rose', 42, 2); O('md-bush-flower', 36, 8); O('md-lilypads-bloom', 31, 4); O('md-rock-mossy', 34, 1);
    s.sprite('meadowlands', 'md-butterfly-gold', 24 * 16, 7 * 16); s.sprite('meadowlands', 'md-butterfly-violet', 44 * 16, 4 * 16);
    s.sprite('effects', 'fx-sparkle-teal', 33 * 16, 5 * 16);
    /* ruin on the right */
    const wall = G.blank(W, H); G.rect(wall, W, 54, 3, 10, 2); G.rect(wall, W, 54, 5, 1, 4); G.rect(wall, W, 63, 5, 1, 4);
    s.terrain(3, 'stonehollow', 'walls', wall);
    s.stamp(4, 58, 4, 'stonehollow', 'sh-door-arch'); s.stamp(4, 56, 4, 'stonehollow', 'sh-torch-wall'); s.stamp(4, 60, 4, 'stonehollow', 'sh-torch-wall');
    s.stamp(4, 61, 3, 'stonehollow', 'sh-banner-teal');
    s.stamp(5, 56, 6, 'stonehollow', 'sh-brazier'); s.stamp(5, 61, 6, 'stonehollow', 'sh-pillar-broken');
    s.opt.glow.push([56 * 16 + 8, 4 * 16 + 4], [60 * 16 + 8, 4 * 16 + 4], [56 * 16 + 8, 6 * 16 + 6]);
    s.walker('character-kit', ['ck-body-slim-skin3', 'ck-outfit-tunic-1-slim', 'ck-hair-ponytail-auburn', 'ck-acc-backpack-1-slim'], 9 * 16 - 2, { x: 120, speed: 16 });
    s.walker('character-kit', ['ck-body-sturdy-skin5', 'ck-outfit-cloak-1-sturdy', 'ck-hair-curls-black', null], 9 * 16 + 4, { x: 540, speed: 12 });
    s.walker('character-kit', ['ck-body-slim-skin1', 'ck-outfit-dress-2-slim', 'ck-hair-bob-blonde', 'ck-acc-sunhat-2-slim'], 9 * 16 + 1, { x: 820, speed: 14, dir: 'left' });
    out.hero = s.toJSON();
  }
  const V = (packId, w = 10, h = 6) => new Scene(packs, w, h);
  /* ---------- vignettes ---------- */
  { const s = V('interface'); s.fill(0, 'meadowlands', () => 'md-grass-plain');
    s.sprite('interface', 'ui-dusk-window', 8, 8); s.sprite('interface', ['ui-dusk-button-normal', 'ui-dusk-button-hover', 'ui-dusk-button-pressed', 'ui-dusk-button-hover'], 64, 12, { hold: 700 });
    s.sprite('interface', ['ui-vellum-slot-normal', 'ui-vellum-slot-hover', 'ui-vellum-slot-selected'], 64, 34, { hold: 800 }); s.sprite('interface', ['ui-moss-slot-normal', 'ui-moss-slot-selected', 'ui-moss-slot-hover'], 100, 34, { hold: 800 });
    s.sprite('interface', 'ui-dusk-bar-frame', 104, 8); s.sprite('interface', 'ui-bar-health', 104, 8); s.sprite('interface', 'ui-vellum-bar-frame', 104, 70); s.sprite('interface', 'ui-bar-energy-segmented', 104, 70);
    s.sprite('interface', 'ui-dusk-continue', 34, 34); s.sprite('interface', 'ui-cursor-hand', 82, 18); s.sprite('interface', ['ui-moss-toggle-off', 'ui-moss-toggle-on'], 20, 70, { hold: 900 }); s.sprite('interface', 'ui-cursor-busy', 64, 74);
    out['interface-essentials'] = s.toJSON(); }
  { const s = V('meadowlands'); s.fill(0, 'meadowlands', (x, y) => K.pickGround(P('meadowlands').extra.ground[0], x, y));
    s.terrain(1, 'meadowlands', 'water', G.clean(G.blob(10, 6, 6.5, 3, 3.6, 2.6, 2), 10, 6)); s.terrain(1, 'meadowlands', 'path', G.path(G.blank(10, 6), 10, [[0, 4], [3, 4], [3, 5]], 1));
    s.stamp(2, 0, 0, 'meadowlands', 'md-tree-oak'); s.stamp(2, 9, 3, 'meadowlands', 'md-tallgrass-3'); s.stamp(2, 4, 1, 'meadowlands', 'md-reeds'); s.stamp(2, 8, 0, 'meadowlands', 'md-bush-berry'); s.stamp(2, 2, 3, 'meadowlands', 'md-tallgrass-1'); s.stamp(2, 6, 2, 'meadowlands', 'md-lilypads-bloom');
    s.sprite('meadowlands', 'md-butterfly-gold', 40, 60); out.meadowlands = s.toJSON(); }
  { const s = V('effects'); s.fill(0, 'stonehollow', (x, y) => P('stonehollow').extra.ground[0].assets[hash2(x, y, 2) < 0.7 ? 0 : 1 + Math.floor(hash2(x, y, 3) * 4)]);
    s.sprite('effects', 'fx-swirl-teal', 4, 4); s.sprite('effects', ['fx-impact-ember', 'fx-impact-rose', 'fx-impact-teal'], 46, 8); s.sprite('effects', ['fx-levelup-gold', 'fx-levelup-teal'], 100, 0);
    s.sprite('effects', ['fx-splash-water', 'fx-smoke-puff', 'fx-dust-dust'], 10, 50); s.sprite('effects', ['fx-pickup-gold', 'fx-pickup-teal'], 56, 52); s.sprite('effects', 'fx-sparkle-gold', 136, 20); s.sprite('effects', 'fx-sparkle-rose', 140, 60);
    out['effects-particles'] = s.toJSON(); }
  { const s = V('stonehollow'); const f = P('stonehollow').extra.ground[0].assets; s.fill(0, 'stonehollow', (x, y) => f[hash2(x, y, 4) < 0.7 ? 0 : 1 + Math.floor(hash2(x, y, 5) * 5)]);
    const wl = G.rect(G.blank(10, 6), 10, 0, 0, 10, 2); G.rect(wl, 10, 0, 2, 1, 4); G.rect(wl, 10, 9, 2, 1, 4); s.terrain(1, 'stonehollow', 'walls', wl);
    s.stamp(2, 2, 1, 'stonehollow', 'sh-torch-wall'); s.stamp(2, 7, 1, 'stonehollow', 'sh-torch-wall'); s.stamp(2, 4, 1, 'stonehollow', 'sh-door-gate');
    s.sprite('stonehollow', 'sh-chest-gilded', 5 * 16, 3 * 16, { hold: 600 }); s.stamp(2, 2, 4, 'stonehollow', 'sh-spikes'); s.stamp(2, 3, 4, 'stonehollow', 'sh-spikes'); s.stamp(2, 7, 2, 'stonehollow', 'sh-brazier'); s.stamp(2, 1, 2, 'stonehollow', 'sh-pillar');
    out.stonehollow = s.toJSON(); }
  { const s = V('hearthvale'); s.fill(0, 'hearthvale', (x, y) => K.pickGround(P('hearthvale').extra.ground[0], x, y));
    s.terrain(1, 'hearthvale', 'cobble', G.rect(G.blank(10, 6), 10, 0, 5, 10, 1));
    const col = (i, w) => i === 0 ? 'left' : i === w - 1 ? 'right' : 'mid';
    for (let i = 0; i < 5; i++) { ['ridge', 'body', 'eave'].forEach((r, j) => s.put(2, 1 + i, j, 'hearthvale', `hv-roof-clay-${r}-${col(i, 5)}`)); s.put(2, 1 + i, 3, 'hearthvale', `hv-wall-plaster-upper-${col(i, 5)}`); s.put(2, 1 + i, 4, 'hearthvale', `hv-wall-plaster-lower-${col(i, 5)}`); }
    s.stamp(3, 3, 3, 'hearthvale', 'hv-door-green'); s.stamp(3, 1, 3, 'hearthvale', 'hv-window-flowers'); s.stamp(3, 5, 3, 'hearthvale', 'hv-window-shutters'); s.stamp(3, 2, 0, 'hearthvale', 'hv-chimney');
    s.stamp(3, 7, 2, 'hearthvale', 'hv-lamppost'); s.stamp(3, 8, 1, 'hearthvale', 'hv-tree'); s.stamp(3, 6, 4, 'hearthvale', 'hv-barrel-apples'); s.stamp(3, 9, 4, 'hearthvale', 'hv-crate');
    s.sprite('effects', 'fx-smoke-plume', 2 * 16, -10); out.hearthvale = s.toJSON(); }
  { const s = V('character-kit'); s.fill(0, 'hearthvale', (x, y) => K.pickGround(P('hearthvale').extra.ground[0], x, y));
    const combos = [['ck-body-slim-skin2', 'ck-outfit-robe-1-slim', 'ck-hair-long-hsilver'.replace('hsilver', 'silver'), 'ck-acc-circlet-1-slim'], ['ck-body-sturdy-skin6', 'ck-outfit-overalls-2-sturdy', 'ck-hair-bun-auburn', 'ck-acc-scarf-2-sturdy'], ['ck-body-slim-skin4', 'ck-outfit-jacket-2-slim', 'ck-hair-swept-black', 'ck-acc-glasses-2-slim'], ['ck-body-sturdy-skin3', 'ck-outfit-guard-3-sturdy', 'ck-hair-braids-brown', null]];
    combos.forEach((c, i) => s.walker('character-kit', c, 34 + (i % 2) * 10, { x: 8 + i * 38, speed: 0, dir: ['down', 'left', 'right', 'down'][i] }));
    out['character-kit'] = s.toJSON(); }
  { const s = V('essentials-bundle'); s.fill(0, 'meadowlands', (x, y) => K.pickGround(P('meadowlands').extra.ground[0], x, y));
    s.terrain(1, 'meadowlands', 'water', G.clean(G.blob(10, 6, 8.5, 1.5, 2.6, 2.2, 3), 10, 6));
    const col = (i, w) => i === 0 ? 'left' : i === w - 1 ? 'right' : 'mid';
    for (let i = 0; i < 3; i++) { ['ridge', 'body', 'eave'].forEach((r, j) => s.put(2, i, j, 'hearthvale', `hv-roof-thatch-${r}-${col(i, 3)}`)); s.put(2, i, 3, 'hearthvale', `hv-wall-planks-upper-${col(i, 3)}`); s.put(2, i, 4, 'hearthvale', `hv-wall-planks-lower-${col(i, 3)}`); }
    s.stamp(3, 1, 3, 'hearthvale', 'hv-door-wood'); s.stamp(3, 4, 0, 'meadowlands', 'md-tree-young'); s.stamp(3, 5, 4, 'stonehollow', 'sh-chest-wood'); s.stamp(3, 3, 4, 'meadowlands', 'md-tallgrass-2');
    s.sprite('effects', 'fx-sparkle-gold', 5 * 16, 3 * 16 + 4); s.sprite('interface', 'ui-vellum-nameplate', 104, 72);
    s.walker('character-kit', ['ck-body-slim-skin5', 'ck-outfit-vest-1-slim', 'ck-hair-crop-black', 'ck-acc-satchel-1-slim'], 50, { x: 20, speed: 10 });
    out['essentials-bundle'] = s.toJSON(); }
  { const s = V('ink-edition'); const g = P('ink-edition').extra.ground[0].assets; s.fill(0, 'ink-edition', (x, y) => g[hash2(x, y, 2) < 0.75 ? 0 : 1 + Math.floor(hash2(x, y, 3) * 3)]);
    s.terrain(1, 'ink-edition', 'water', G.clean(G.blob(10, 6, 7.5, 3.5, 3.2, 2.4, 1), 10, 6));
    const col = (i, w) => i === 0 ? 'left' : i === w - 1 ? 'right' : 'mid';
    for (let i = 0; i < 4; i++) { ['ridge', 'body', 'eave'].forEach((r, j) => s.put(2, i, j, 'ink-edition', `nk-roof-${r}-${col(i, 4)}`)); s.put(2, i, 3, 'ink-edition', `nk-wall-upper-${col(i, 4)}`); s.put(2, i, 4, 'ink-edition', `nk-wall-lower-${col(i, 4)}`); }
    s.stamp(3, 1, 3, 'ink-edition', 'nk-door-house'); s.stamp(3, 3, 3, 'ink-edition', 'nk-window'); s.stamp(3, 5, 0, 'ink-edition', 'nk-tree'); s.stamp(3, 4, 3, 'ink-edition', 'nk-lamp'); s.stamp(3, 9, 0, 'ink-edition', 'nk-pine');
    s.walker('ink-edition', ['nk-body-slim-paper', 'nk-outfit-tunic-1-slim', 'nk-hair-crop-dark', null], 58, { x: 70, speed: 9 });
    out['ink-edition'] = s.toJSON(); }
  { const s = new Scene(packs, 10, 6, { variants: ['spring', 'summer', 'autumn', 'winter'], variantMs: 2600 }); const g = P('four-seasons').extra.ground.find(x => x.id === 'meadow');
    s.fill(0, 'four-seasons', (x, y) => K.pickGround(g, x, y));
    s.terrain(1, 'four-seasons', 'meadow-pond', G.clean(G.blob(10, 6, 7, 3.4, 3, 2.3, 1), 10, 6)); s.terrain(1, 'four-seasons', 'meadow-dirt', G.rect(G.blank(10, 6), 10, 0, 4, 3, 2));
    s.stamp(2, 0, 0, 'four-seasons', 'fs-meadow-tree'); s.stamp(2, 3, 2, 'four-seasons', 'fs-meadow-bush'); s.stamp(2, 9, 4, 'four-seasons', 'fs-meadow-tallgrass'); s.stamp(2, 4, 4, 'four-seasons', 'fs-meadow-wildflowers'); s.stamp(2, 9, 0, 'four-seasons', 'fs-meadow-sapling');
    out['four-seasons'] = s.toJSON(); }
  { const world = GEN.generate({ seed: 'vignette', width: 18, height: 11, land: 0.42, towns: 0.3, rivers: 0.4 });
    const meta = P('grand-atlas').metadata(); const layers = GEN.toLayers(world, meta);
    const s = new Scene(packs, 18, 11); const pk = P('grand-atlas');
    layers.forEach((L, n) => L.data.forEach((t, i) => { if (!t) return; const a = pk.assets.find(a2 => a2.sheet === t.sheet && pk.tileIndex(a2) === t.tile); if (a) s.put(n, i % 18, Math.floor(i / 18), 'grand-atlas', a.id); }));
    out['grand-atlas'] = s.toJSON(); }
  { const s = V('sample'); const g = P('sample').extra.ground[0].assets; s.fill(0, 'sample', (x, y) => g[hash2(x, y, 1) < 0.85 ? 0 : 1 + Math.floor(hash2(x, y, 2) * 2)]); out.sample = s.toJSON(); }
  return out;
}

module.exports = { build, Scene };
